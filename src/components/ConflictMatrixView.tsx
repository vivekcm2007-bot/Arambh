import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CaseWorkspace } from '../shared/types';

interface ConflictMatrixViewProps {
  workspace: CaseWorkspace;
  onJumpToSource: (sourceId: string) => void;
  onBuildGraph: () => void;
  isAnalyzing: boolean;
}

type SeverityFilter = 'all' | 'critical' | 'other';

export function ConflictMatrixView({
  workspace,
  onJumpToSource,
  onBuildGraph,
  isAnalyzing,
}: ConflictMatrixViewProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const graph = workspace.graph;

  const filteredConflicts = useMemo(() => {
    if (!graph) return [];
    return graph.conflicts.filter((c) => {
      if (severityFilter === 'all') return true;
      if (severityFilter === 'critical') return c.severity === 'critical';
      return c.severity !== 'critical';
    });
  }, [graph, severityFilter]);

  if (!graph) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-12 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-3 text-base font-semibold text-emerald-950">
          Conflict Matrix Awaits Analysis
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-emerald-800">
          Build the evidence graph to populate cross-modal contradictions, entity alias resolution,
          and source reliability rankings.
        </p>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={onBuildGraph}
          disabled={isAnalyzing || workspace.sources.length === 0}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isAnalyzing ? 'Analyzing Sources...' : 'Build Evidence Graph'}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cross-Modal Contradictions */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
        <div className="border-b border-emerald-200 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-emerald-950">
              Cross-Modal Contradictions
            </h2>
            <p className="text-xs text-emerald-700 mt-0.5">
              Discrepancies detected across documents, scanned images, CSV tables, and JSON datasets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 p-1">
              {(
                [
                  ['all', `All (${graph.conflicts.length})`],
                  [
                    'critical',
                    `Critical (${graph.conflicts.filter((c) => c.severity === 'critical').length})`,
                  ],
                  [
                    'other',
                    `Major / Minor (${graph.conflicts.filter((c) => c.severity !== 'critical').length})`,
                  ],
                ] as const
              ).map(([key, label]) => {
                const active = severityFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverityFilter(key)}
                    className={`relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active ? 'text-white' : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="conflict-severity-pill"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className="absolute inset-0 rounded-md bg-emerald-700 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredConflicts.length === 0 ? (
          <div className="p-6 text-sm text-emerald-800">
            No cross-modal contradictions match the current severity filter.
          </div>
        ) : (
          <div className="divide-y divide-emerald-200">
            <AnimatePresence initial={false}>
              {filteredConflicts.map((conflict) => {
                const linkedClaims = graph.claims.filter((c) => conflict.claimIds.includes(c.id));
                const isCollapsed = Boolean(collapsedIds[conflict.id]);
                return (
                  <motion.div
                    key={conflict.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="p-5 space-y-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedIds((prev) => ({
                          ...prev,
                          [conflict.id]: !prev[conflict.id],
                        }))
                      }
                      className="w-full flex flex-wrap items-center justify-between gap-2 text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle
                          className={`h-4 w-4 shrink-0 ${
                            conflict.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs font-semibold text-emerald-700">
                          {conflict.id}
                        </span>
                        <h3 className="text-sm font-semibold text-emerald-950 group-hover:text-emerald-800">
                          {conflict.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <span className="capitalize">{conflict.severity}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {conflict.unresolved ? 'Unresolved Conflict' : 'Resolved by Reliability'}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-emerald-700 transition-transform duration-150 ${
                            isCollapsed ? '-rotate-90' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-3"
                        >
                          <p className="text-sm text-emerald-900 leading-relaxed">
                            {conflict.description}
                          </p>

                          {linkedClaims.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {linkedClaims.map((clm) => {
                                const isWinner = conflict.winningClaimId === clm.id;
                                return (
                                  <motion.div
                                    key={clm.id}
                                    whileHover={{ y: -1 }}
                                    transition={{ duration: 0.14 }}
                                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                                      isWinner
                                        ? 'border-emerald-400 bg-emerald-100/80'
                                        : 'border-emerald-200 bg-emerald-100/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-mono">
                                      <motion.button
                                        whileTap={{ scale: 0.94 }}
                                        type="button"
                                        onClick={() => onJumpToSource(clm.sourceId)}
                                        className="font-semibold text-emerald-800 hover:underline"
                                      >
                                        {clm.sourceId} · {clm.id}
                                      </motion.button>
                                      <span
                                        className={
                                          isWinner
                                            ? 'text-emerald-800 font-semibold'
                                            : clm.status === 'rejected'
                                              ? 'text-red-700 font-semibold'
                                              : 'text-amber-800 font-semibold'
                                        }
                                      >
                                        {isWinner
                                          ? 'Preferred Claim'
                                          : clm.status === 'rejected'
                                            ? 'Discounted'
                                            : 'Conflicting'}
                                      </span>
                                    </div>
                                    <div className="font-medium text-emerald-950">
                                      {clm.predicate}:{' '}
                                      <span className="font-mono">{clm.objectValue}</span>
                                    </div>
                                    <div className="text-emerald-800 italic">"{clm.excerpt}"</div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}

                          <div className="text-xs text-emerald-900 bg-emerald-100/60 border border-emerald-200 rounded-lg px-3.5 py-2.5">
                            <span className="font-semibold text-emerald-950">Assessment: </span>
                            {conflict.resolutionAssessment}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Source Reliability Audit Table */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
        <div className="border-b border-emerald-200 px-5 py-4">
          <h2 className="text-base font-semibold text-emerald-950">
            Source Reliability & Adversarial Resistance Audit
          </h2>
          <p className="text-xs text-emerald-700 mt-0.5">
            Trust scoring, provenance verification, and manipulation signals per artifact
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-emerald-200 bg-emerald-100/80 text-emerald-800">
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Trust State</th>
                <th className="px-4 py-3 font-semibold text-right">Reliability</th>
                <th className="px-4 py-3 font-semibold">Adversarial Signals & Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-200">
              {graph.sourceAssessments.map((sa) => {
                const src = workspace.sources.find((s) => s.id === sa.sourceId);
                return (
                  <tr key={sa.sourceId} className="hover:bg-emerald-100/50 transition-colors align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        type="button"
                        onClick={() => onJumpToSource(sa.sourceId)}
                        className="font-mono font-semibold text-emerald-800 hover:underline"
                      >
                        {sa.sourceId}
                      </motion.button>
                      <div className="text-emerald-950 font-medium mt-0.5">
                        {src?.title ?? sa.sourceId}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sa.trustTier === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Verified
                        </span>
                      ) : sa.trustTier === 'compromised' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          Compromised
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          Uncertain
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-950">
                      {sa.reliabilityScore}%
                    </td>
                    <td className="px-4 py-3 text-emerald-900 max-w-xl space-y-1">
                      <p className="leading-relaxed">{sa.rationale}</p>
                      {sa.manipulationSignals.length > 0 && (
                        <p className="text-red-700 font-medium">
                          Manipulation flagged: {sa.manipulationSignals.join(' · ')}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Entity Resolution Registry */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
        <div className="border-b border-emerald-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-emerald-950">
              Cross-Modal Entity Resolution Registry
            </h2>
            <p className="text-xs text-emerald-700 mt-0.5">
              Canonical identities merged across disparate filenames, abbreviations, and modalities
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-emerald-800">
            {graph.entities.length} entities
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-emerald-200 bg-emerald-100/80 text-emerald-800">
                <th className="px-4 py-3 font-semibold">Entity ID</th>
                <th className="px-4 py-3 font-semibold">Canonical Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Resolved Aliases</th>
                <th className="px-4 py-3 font-semibold">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-200">
              {graph.entities.map((ent) => (
                <tr key={ent.id} className="hover:bg-emerald-100/50 transition-colors align-top">
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-900 whitespace-nowrap">
                    {ent.id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-950">
                    <div>{ent.canonicalName}</div>
                    <div className="mt-0.5 font-normal text-emerald-700">{ent.resolutionNote}</div>
                  </td>
                  <td className="px-4 py-3 text-emerald-800 whitespace-nowrap">{ent.entityType}</td>
                  <td className="px-4 py-3 font-mono text-emerald-900">
                    {ent.aliases.join(' · ')}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-800 whitespace-nowrap">
                    {ent.sourceIds.map((sid, idx) => (
                      <span key={sid}>
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() => onJumpToSource(sid)}
                          className="hover:underline"
                        >
                          {sid}
                        </motion.button>
                        {idx < ent.sourceIds.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {graph.coverageGaps.length > 0 && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Identified Evidence Coverage Gaps</span>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-emerald-900">
            {graph.coverageGaps.map((gap, i) => (
              <li key={i}>• {gap}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
