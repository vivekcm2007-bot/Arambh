import fs from 'node:fs';
import path from 'node:path';
import type { CaseWorkspace } from '../shared/types.ts';
import { createPresetCases } from './presets.ts';

const DATA_DIR = path.resolve(process.cwd(), '.cerberus-data');
const CASES_FILE = path.resolve(DATA_DIR, 'cases.json');

function assertConfinedPath(targetPath: string): void {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Path confinement violation');
  }
}

export class CaseStore {
  private cases: CaseWorkspace[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      assertConfinedPath(CASES_FILE);
      if (fs.existsSync(CASES_FILE)) {
        const raw = fs.readFileSync(CASES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const presets = createPresetCases();
          this.cases = (parsed as CaseWorkspace[]).map((c) => {
            const matchingPreset = presets.find((p) => p.id === c.id);
            if (matchingPreset && !c.graph && c.sources.length === matchingPreset.sources.length) {
              return { ...matchingPreset, queries: c.queries?.length ? c.queries : matchingPreset.queries };
            }
            if (c.graph?.claims) {
              c.graph.claims = c.graph.claims.map((clm) => {
                const rawStatus = (clm.status as string).toLowerCase();
                return {
                  ...clm,
                  status:
                    rawStatus === 'disputed'
                      ? 'contested'
                      : rawStatus === 'refuted' || rawStatus === 'false'
                        ? 'rejected'
                        : clm.status,
                };
              });
            }
            return c;
          });
          this.save();
          return;
        }
      }
    } catch (err) {
      console.warn('Initializing fresh Cerberus-X preset store:', err);
    }
    this.cases = createPresetCases();
    this.save();
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      assertConfinedPath(CASES_FILE);
      fs.writeFileSync(CASES_FILE, JSON.stringify(this.cases, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist cases:', err);
    }
  }

  listCases(): CaseWorkspace[] {
    return this.cases;
  }

  getCase(id: string): CaseWorkspace | undefined {
    return this.cases.find((c) => c.id === id);
  }

  upsertCase(updated: CaseWorkspace): CaseWorkspace {
    const idx = this.cases.findIndex((c) => c.id === updated.id);
    updated.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      this.cases[idx] = updated;
    } else {
      this.cases.unshift(updated);
    }
    this.save();
    return updated;
  }

  resetCase(id: string): CaseWorkspace | undefined {
    const preset = createPresetCases().find((c) => c.id === id);
    if (preset) {
      return this.upsertCase(preset);
    }
    const existing = this.getCase(id);
    if (!existing) return undefined;
    existing.sources = [];
    existing.graph = null;
    existing.graphStale = false;
    existing.queries = [];
    return this.upsertCase(existing);
  }
}

export const caseStore = new CaseStore();
