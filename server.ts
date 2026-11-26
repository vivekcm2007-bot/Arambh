import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { constructEvidenceGraph, interrogateEvidenceGraph } from './src/server/geminiService.ts';
import { computeSha256, scanDeterministicIntegrity } from './src/server/integrity.ts';
import { caseStore } from './src/server/store.ts';
import type { CaseWorkspace, EvidenceSource, Modality } from './src/shared/types.ts';

const PORT = 3000;
const ALLOWED_MODALITIES: ReadonlySet<Modality> = new Set([
  'document',
  'image',
  'table',
  'dataset',
  'scan',
]);

function extractSpreadsheetCsv(binaryDataUrl: string): string | null {
  try {
    const commaIdx = binaryDataUrl.indexOf(',');
    const base64Data = commaIdx >= 0 ? binaryDataUrl.slice(commaIdx + 1) : binaryDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetSections = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet).trim();
      if (workbook.SheetNames.length === 1) return csv;
      return `# Sheet: ${sheetName}\n${csv}`;
    }).filter(Boolean);
    return sheetSections.join('\n\n') || null;
  } catch {
    return null;
  }
}

function extractErrorMessage(err: unknown): { status: number; message: string } {
  if (err && typeof err === 'object') {
    const record = err as { status?: number; message?: string };
    const status = typeof record.status === 'number' && record.status >= 400 ? record.status : 500;
    const message =
      typeof record.message === 'string' && record.message.trim().length > 0
        ? record.message
        : 'Unexpected server error.';
    return { status, message };
  }
  return { status: 500, message: 'Unexpected server error.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '250mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cases', (_req, res) => {
    res.json({ cases: caseStore.listCases() });
  });

  app.post('/api/cases', (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!title || title.length > 140) {
      res.status(400).json({ error: 'Case title is required and must be under 140 characters.' });
      return;
    }

    const newCase: CaseWorkspace = {
      id: `case-${Date.now()}`,
      title,
      domain: domain || 'Cross-Modal Forensics',
      description:
        description ||
        'Custom multimodal evidence workspace for entity resolution, contradiction detection, and conflict-aware Q&A.',
      isPreset: false,
      suggestedQuestions: [
        'What are the strongest corroborated facts across the ingested sources?',
        'Which sources contradict each other, and which modality appears most reliable?',
        'Are there any adversarial directives or gaps in the evidence?',
      ],
      sources: [],
      graph: null,
      graphStale: false,
      queries: [],
      updatedAt: new Date().toISOString(),
    };

    const saved = caseStore.upsertCase(newCase);
    res.status(201).json({ caseWorkspace: saved });
  });

  app.post('/api/cases/:id/reset', (req, res) => {
    const updated = caseStore.resetCase(req.params.id);
    if (!updated) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }
    res.json({ caseWorkspace: updated });
  });

  app.post('/api/cases/:id/ingest', (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (rawItems.length === 0 || rawItems.length > 250) {
      res.status(400).json({ error: 'Provide between 1 and 250 evidence items per upload batch.' });
      return;
    }

    const added: EvidenceSource[] = [];
    for (const item of rawItems) {
      const title = typeof item?.title === 'string' ? item.title.trim() : '';
      const filename = typeof item?.filename === 'string' ? item.filename.trim() : 'record.txt';
      const modalityRaw = typeof item?.modality === 'string' ? item.modality : 'document';
      let modality: Modality = ALLOWED_MODALITIES.has(modalityRaw as Modality)
        ? (modalityRaw as Modality)
        : 'document';
      let mimeType =
        typeof item?.mimeType === 'string' && item.mimeType.trim()
          ? item.mimeType.trim()
          : 'text/plain';
      const originAuthority =
        typeof item?.originAuthority === 'string' && item.originAuthority.trim()
          ? item.originAuthority.trim()
          : 'User Ingested Artifact';
      let textContent = typeof item?.textContent === 'string' ? item.textContent : undefined;
      let binaryDataUrl =
        typeof item?.binaryDataUrl === 'string' && item.binaryDataUrl.startsWith('data:')
          ? item.binaryDataUrl
          : undefined;

      const isExcel =
        /\.(xlsx|xls)$/i.test(filename) ||
        mimeType.includes('spreadsheetml') ||
        mimeType.includes('ms-excel');
      if (isExcel && binaryDataUrl) {
        const parsedCsv = extractSpreadsheetCsv(binaryDataUrl);
        if (!parsedCsv) {
          res.status(400).json({ error: `Unable to parse Excel workbook "${filename}".` });
          return;
        }
        textContent = parsedCsv;
        binaryDataUrl = undefined;
        modality = 'table';
        mimeType = 'text/csv';
      }

      if (!title || (!textContent && !binaryDataUrl)) {
        res.status(400).json({
          error: 'Each evidence artifact requires a title and either textContent or binaryDataUrl.',
        });
        return;
      }

      const nextIdx =
        workspace.sources.reduce((max, s) => {
          const m = s.id.match(/^SRC-(\d+)$/);
          return m ? Math.max(max, Number(m[1])) : max;
        }, 0) +
        added.length +
        1;
      const id = `SRC-${String(nextIdx).padStart(2, '0')}`;
      const hashInput = binaryDataUrl ?? textContent ?? filename;

      added.push({
        id,
        title: title.slice(0, 140),
        filename: filename.slice(0, 140),
        modality,
        mimeType,
        sha256: computeSha256(hashInput),
        ingestedAt: new Date().toISOString(),
        originAuthority: originAuthority.slice(0, 120),
        textContent,
        binaryDataUrl,
        deterministicFlags: scanDeterministicIntegrity(modality, textContent),
      });
    }

    workspace.sources.push(...added);
    workspace.graphStale = true;
    const saved = caseStore.upsertCase(workspace);
    res.status(201).json({ added, caseWorkspace: saved });
  });

  app.delete('/api/cases/:id/sources/:sourceId', (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }

    const beforeLen = workspace.sources.length;
    workspace.sources = workspace.sources.filter((s) => s.id !== req.params.sourceId);
    if (workspace.sources.length === beforeLen) {
      res.status(404).json({ error: 'Source not found in case.' });
      return;
    }

    workspace.graphStale = workspace.sources.length > 0;
    if (workspace.sources.length === 0) {
      workspace.graph = null;
    }
    const saved = caseStore.upsertCase(workspace);
    res.json({ caseWorkspace: saved });
  });

  app.post('/api/cases/:id/analyze', async (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }
    if (workspace.sources.length === 0) {
      res.status(400).json({ error: 'Ingest at least one source before building the evidence graph.' });
      return;
    }

    try {
      const graph = await constructEvidenceGraph(workspace);
      workspace.graph = graph;
      workspace.graphStale = false;
      const saved = caseStore.upsertCase(workspace);
      res.json({ graph, caseWorkspace: saved });
    } catch (err) {
      const { status, message } = extractErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/cases/:id/query', async (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question || question.length > 800) {
      res.status(400).json({ error: 'Question must be between 1 and 800 characters.' });
      return;
    }
    if (workspace.sources.length === 0) {
      res.status(400).json({ error: 'Ingest evidence sources before querying.' });
      return;
    }

    try {
      if (!workspace.graph || workspace.graphStale) {
        workspace.graph = await constructEvidenceGraph(workspace);
        workspace.graphStale = false;
      }
      const answer = await interrogateEvidenceGraph(workspace, question);
      workspace.queries.unshift(answer);
      const saved = caseStore.upsertCase(workspace);
      res.json({ answer, caseWorkspace: saved });
    } catch (err) {
      const { status, message } = extractErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/cases/:id/sources/:sourceId/raw', (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }
    const source = workspace.sources.find((s) => s.id === req.params.sourceId);
    if (!source) {
      res.status(404).json({ error: 'Source artifact not found.' });
      return;
    }
    if (source.binaryDataUrl) {
      const commaIdx = source.binaryDataUrl.indexOf(',');
      const b64 = commaIdx >= 0 ? source.binaryDataUrl.slice(commaIdx + 1) : source.binaryDataUrl;
      const buffer = Buffer.from(b64, 'base64');
      res.setHeader('Content-Type', source.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${source.filename.replace(/"/g, '')}"`
      );
      res.send(buffer);
      return;
    }
    res.setHeader('Content-Type', source.mimeType || 'text/plain; charset=utf-8');
    res.send(source.textContent ?? '');
  });

  app.get('/api/cases/:id/export', (req, res) => {
    const workspace = caseStore.getCase(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Case workspace not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${workspace.id}-evidence-graph.json"`
    );
    res.send(JSON.stringify(workspace, null, 2));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cerberus-X server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Cerberus-X server:', err);
  process.exit(1);
});
