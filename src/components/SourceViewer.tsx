import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import type { EvidenceClaim, EvidenceSource, SourceAssessment } from '../shared/types';

interface SourceViewerProps {
  caseId: string;
  source: EvidenceSource;
  assessment?: SourceAssessment;
  claims: EvidenceClaim[];
}

interface ParsedSheet {
  name?: string;
  rows: string[][];
}

function parseTableSheets(rawText: string): ParsedSheet[] {
  const sections = rawText.split(/\n(?=# Sheet: )/);
  return sections
    .map((section) => {
      const lines = section
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let name: string | undefined;
      let dataLines = lines;
      if (lines[0]?.startsWith('# Sheet:')) {
        name = lines[0].replace(/^# Sheet:\s*/, '').trim();
        dataLines = lines.slice(1);
      }
      const rows = dataLines.map((line) => line.split(',').map((cell) => cell.trim()));
      return { name, rows };
    })
    .filter((s) => s.rows.length > 0);
}

export function TrustLabel({ assessment }: { assessment?: SourceAssessment }) {
  if (!assessment) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" />
        Pending Graph Audit
      </span>
    );
  }
  if (assessment.trustTier === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Verified · {assessment.reliabilityScore}%
      </span>
    );
  }
  if (assessment.trustTier === 'compromised') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Compromised · {assessment.reliabilityScore}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Uncertain · {assessment.reliabilityScore}%
    </span>
  );
}

export function SourceViewer({ caseId, source, assessment, claims }: SourceViewerProps) {
  const [imageError, setImageError] = useState(false);
  const [showInlinePdf, setShowInlinePdf] = useState(false);
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

  useEffect(() => {
    setImageError(false);
    setShowInlinePdf(false);
    setExpandedClaimId(null);
  }, [source.id]);

  const sheets = useMemo(() => {
    if (source.modality !== 'table' || !source.textContent) return null;
    return parseTableSheets(source.textContent);
  }, [source.modality, source.textContent]);

  const isImage =
    source.mimeType.startsWith('image/') && Boolean(source.binaryDataUrl) && !imageError;
  const isPdf = source.mimeType === 'application/pdf' && Boolean(source.binaryDataUrl);
  const rawDownloadUrl = `/api/cases/${encodeURIComponent(caseId)}/sources/${encodeURIComponent(source.id)}/raw`;

  return (
    <motion.div
      key={source.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-200 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-mono tabular-nums">
            <span className="font-semibold text-emerald-950">{source.id}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{source.modality}</span>
            <span aria-hidden="true">·</span>
            <span>SHA-256 {source.sha256}</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-emerald-950">{source.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-800">
            <span>Origin: {source.originAuthority}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{source.filename}</span>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <TrustLabel assessment={assessment} />
          {assessment && (
            <div className="ml-auto h-1.5 w-28 rounded-full bg-emerald-200 overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full origin-left ${
                  assessment.trustTier === 'verified'
                    ? 'bg-emerald-600'
                    : assessment.trustTier === 'compromised'
                      ? 'bg-red-600'
                      : 'bg-amber-500'
                }`}
                style={{ width: `${assessment.reliabilityScore}%` }}
              />
            </div>
          )}
          <p className="text-xs text-emerald-700 font-mono tabular-nums">
            {new Date(source.ingestedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {(source.deterministicFlags.length > 0 ||
        (assessment && (assessment.adversarialDetected || assessment.manipulationSignals.length > 0))) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.16 }}
          className="rounded-lg border border-red-200 bg-red-50/90 p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Integrity & Adversarial Manipulation Alerts</span>
          </div>
          <ul className="space-y-1.5 text-xs text-red-900">
            {source.deterministicFlags.map((flag, i) => (
              <li key={`${flag.code}-${i}`} className="leading-relaxed">
                <span className="font-mono font-semibold">{flag.code}:</span> {flag.summary}
                {flag.excerpt && (
                  <span className="mt-1 block font-mono text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {flag.excerpt}
                  </span>
                )}
              </li>
            ))}
            {assessment?.manipulationSignals.map((sig, idx) => (
              <li key={`sig-${idx}`} className="leading-relaxed">
                <span className="font-semibold">Graph Audit Signal:</span> {sig}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {assessment && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-100/60 p-3.5">
          <div className="text-xs font-semibold text-emerald-900">Reliability Assessment</div>
          <p className="mt-1 text-sm text-emerald-900 leading-relaxed">{assessment.rationale}</p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-800">
            Raw Multimodal Artifact Preview
          </span>
          {isPdf && (
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setShowInlinePdf((v) => !v)}
                className="text-xs font-medium text-emerald-800 hover:underline"
              >
                {showInlinePdf ? 'Hide Inline Preview' : 'Show Inline Preview'}
              </motion.button>
              <motion.a
                whileTap={{ scale: 0.95 }}
                href={rawDownloadUrl}
                download={source.filename}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download PDF
              </motion.a>
            </div>
          )}
        </div>

        {isImage && source.binaryDataUrl ? (
          <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-100/70">
            <img
              src={source.binaryDataUrl}
              alt={source.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-auto max-h-[440px] object-contain mx-auto bg-emerald-50"
            />
          </div>
        ) : source.mimeType.startsWith('image/') ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100/60 p-8 text-center">
            <ImageIcon className="h-8 w-8 text-emerald-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-emerald-900">{source.title}</p>
            <p className="mt-1 text-xs text-emerald-700">Image preview unavailable</p>
          </div>
        ) : isPdf ? (
          <AnimatePresence mode="wait">
            {showInlinePdf ? (
              <motion.div
                key="pdf-inline"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-100 h-[420px]"
              >
                <iframe
                  src={rawDownloadUrl}
                  title={source.title}
                  className="w-full h-full border-0 bg-emerald-50"
                />
              </motion.div>
            ) : (
              <motion.div
                key="pdf-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-100/60 p-5"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-emerald-950 truncate">
                      {source.filename}
                    </div>
                    <p className="mt-0.5 text-xs text-emerald-800">
                      PDF binary stored for Gemini multimodal vision & document extraction.
                      {claims.length > 0
                        ? ` ${claims.length} claims extracted below.`
                        : ' Click Build Evidence Graph to extract claims.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.a
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    href={rawDownloadUrl}
                    download={source.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                  </motion.a>
                  <motion.a
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    href={rawDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-900 whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Open PDF
                  </motion.a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : sheets && sheets.length > 0 ? (
          <div className="space-y-4">
            {sheets.map((sheet, sIdx) => (
              <div
                key={sIdx}
                className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50"
              >
                {sheet.name && (
                  <div className="border-b border-emerald-200 bg-emerald-100/80 px-3 py-2 text-xs font-semibold text-emerald-900">
                    Sheet: {sheet.name}
                  </div>
                )}
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-200 bg-emerald-100/80">
                      {sheet.rows[0].map((col, idx) => (
                        <th
                          key={idx}
                          className="px-3 py-2.5 font-mono font-semibold text-emerald-900 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-200/70">
                    {sheet.rows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-emerald-100/50 transition-colors">
                        {row.map((cell, cIdx) => {
                          const isNumeric = /^-?\d+(\.\d+)?$/.test(cell);
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-2 font-mono tabular-nums text-emerald-900 whitespace-nowrap ${
                                isNumeric ? 'text-right' : 'text-left'
                              }`}
                            >
                              {cell || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : source.textContent ? (
          <pre className="max-h-[360px] overflow-auto rounded-lg border border-emerald-800 bg-emerald-950 p-4 font-mono text-xs text-emerald-50 leading-relaxed whitespace-pre-wrap">
            {source.textContent}
          </pre>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-100/60 p-4 text-xs text-emerald-800">
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>No inline preview available for {source.mimeType}.</span>
          </div>
        )}
      </div>

      {claims.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">
              Extracted Claims ({claims.length})
            </span>
            <span className="text-xs text-emerald-700 font-mono tabular-nums">
              {claims.filter((c) => c.status === 'contested').length} contested ·{' '}
              {claims.filter((c) => c.status === 'rejected').length} rejected
            </span>
          </div>
          <div className="divide-y divide-emerald-200 rounded-lg border border-emerald-200 bg-emerald-50">
            {claims.map((claim) => {
              const isExpanded = expandedClaimId === claim.id;
              return (
                <motion.button
                  key={claim.id}
                  type="button"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExpandedClaimId(isExpanded ? null : claim.id)}
                  className="w-full text-left p-3 text-xs space-y-1 hover:bg-emerald-100/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-emerald-700 tabular-nums">
                      <span className="font-semibold text-emerald-950">{claim.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{claim.subjectEntityId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{claim.confidence}% conf.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-medium ${
                          claim.status === 'verified'
                            ? 'text-emerald-800'
                            : claim.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-800'
                        }`}
                      >
                        {claim.status === 'verified'
                          ? 'Verified'
                          : claim.status === 'rejected'
                            ? 'Rejected'
                            : 'Contested'}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-emerald-700 transition-transform duration-150 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div className="text-emerald-950 font-medium">
                    {claim.predicate}: <span className="font-mono">{claim.objectValue}</span>
                  </div>
                  <div className="text-emerald-800 italic">"{claim.excerpt}"</div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.14 }}
                        className="pt-1.5 font-mono text-[11px] text-emerald-700"
                      >
                        Source {claim.sourceId} · Subject {claim.subjectEntityId}
                        {claim.timestamp ? ` · Timestamp ${claim.timestamp}` : ''}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function ModalityIcon({ modality }: { modality: EvidenceSource['modality'] }) {
  if (modality === 'table' || modality === 'dataset') {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />;
  }
  if (modality === 'image' || modality === 'scan') {
    return <ImageIcon className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />;
  }
  return <FileText className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />;
}
