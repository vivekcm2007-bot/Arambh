import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ExternalLink,
  GitMerge,
  Play,
  ShieldAlert,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  CaseWorkspace,
  EvidenceClaim,
  EvidenceSource,
  GraphConflict,
  ResolvedEntity,
} from '../shared/types';

interface EvidenceGraphCanvasProps {
  workspace: CaseWorkspace;
  onJumpToSource: (sourceId: string) => void;
  onBuildGraph: () => void;
  isAnalyzing: boolean;
}

type NodeFilter = 'all' | 'conflicts' | 'verified' | 'adversarial';

type SelectedNode =
  | { kind: 'source'; data: EvidenceSource }
  | { kind: 'claim'; data: EvidenceClaim }
  | { kind: 'entity'; data: ResolvedEntity }
  | { kind: 'conflict'; data: GraphConflict };

function buildSmoothSplinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function EvidenceGraphCanvas({
  workspace,
  onJumpToSource,
  onBuildGraph,
  isAnalyzing,
}: EvidenceGraphCanvasProps) {
  const [filter, setFilter] = useState<NodeFilter>('all');
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [replayCount, setReplayCount] = useState(0);

  const graph = workspace.graph;

  const assessmentBySource = useMemo(() => {
    const map = new Map<string, NonNullable<typeof graph>['sourceAssessments'][number]>();
    if (!graph) return map;
    for (const sa of graph.sourceAssessments) {
      map.set(sa.sourceId, sa);
    }
    return map;
  }, [graph]);

  const conflictClaimIds = useMemo(() => {
    const set = new Set<string>();
    if (!graph) return set;
    for (const c of graph.conflicts) {
      for (const cid of c.claimIds) set.add(cid);
    }
    return set;
  }, [graph]);

  const highlightedSets = useMemo(() => {
    if (!selected || !graph) return null;
    const sources = new Set<string>();
    const claims = new Set<string>();
    const entities = new Set<string>();

    if (selected.kind === 'source') {
      sources.add(selected.data.id);
      for (const clm of graph.claims) {
        if (clm.sourceId === selected.data.id) {
          claims.add(clm.id);
          entities.add(clm.subjectEntityId);
        }
      }
    } else if (selected.kind === 'claim') {
      claims.add(selected.data.id);
      sources.add(selected.data.sourceId);
      entities.add(selected.data.subjectEntityId);
      for (const edge of graph.edges) {
        if (
          edge.fromId === selected.data.id &&
          (edge.relation === 'CONTRADICTS' || edge.relation === 'CORROBORATES')
        ) {
          claims.add(edge.toId);
        }
        if (
          edge.toId === selected.data.id &&
          (edge.relation === 'CONTRADICTS' || edge.relation === 'CORROBORATES')
        ) {
          claims.add(edge.fromId);
        }
      }
    } else if (selected.kind === 'entity') {
      entities.add(selected.data.id);
      for (const clm of graph.claims) {
        if (clm.subjectEntityId === selected.data.id) {
          claims.add(clm.id);
          sources.add(clm.sourceId);
        }
      }
    } else if (selected.kind === 'conflict') {
      for (const cid of selected.data.claimIds) claims.add(cid);
      for (const sid of selected.data.sourceIds) sources.add(sid);
      for (const clm of graph.claims) {
        if (claims.has(clm.id)) {
          entities.add(clm.subjectEntityId);
          sources.add(clm.sourceId);
        }
      }
    }

    return { sources, claims, entities };
  }, [selected, graph]);

  const layout = useMemo(() => {
    if (!graph) return null;

    const visibleClaims = graph.claims.filter((claim) => {
      if (filter === 'all') return true;
      if (filter === 'conflicts') {
        return claim.status === 'contested' || conflictClaimIds.has(claim.id);
      }
      if (filter === 'verified') return claim.status === 'verified';
      if (filter === 'adversarial') {
        const sa = assessmentBySource.get(claim.sourceId);
        return Boolean(sa?.adversarialDetected || sa?.trustTier === 'compromised');
      }
      return true;
    });

    const visibleClaimIds = new Set(visibleClaims.map((c) => c.id));
    const visibleSourceIds = new Set(visibleClaims.map((c) => c.sourceId));
    const visibleEntityIds = new Set(visibleClaims.map((c) => c.subjectEntityId));

    const sources =
      filter === 'all'
        ? workspace.sources
        : workspace.sources.filter((s) => visibleSourceIds.has(s.id));

    const entities =
      filter === 'all'
        ? graph.entities
        : graph.entities.filter((e) => visibleEntityIds.has(e.id));

    const colX = { source: 28, claim: 356, entity: 742 };
    const cardW = { source: 234, claim: 290, entity: 230 };
    const sourceH = 74;
    const claimH = 62;
    const entityH = 64;
    const gap = 16;

    const sourceNodes = sources.map((s, i) => ({
      source: s,
      x: colX.source,
      y: 44 + i * (sourceH + gap),
      w: cardW.source,
      h: sourceH,
    }));

    const claimNodes = visibleClaims.map((c, i) => ({
      claim: c,
      x: colX.claim,
      y: 44 + i * (claimH + 12),
      w: cardW.claim,
      h: claimH,
    }));

    const entityNodes = entities.map((e, i) => ({
      entity: e,
      x: colX.entity,
      y: 44 + i * (entityH + gap),
      w: cardW.entity,
      h: entityH,
    }));

    const sourcePos = new Map(sourceNodes.map((n) => [n.source.id, n]));
    const claimPos = new Map(claimNodes.map((n) => [n.claim.id, n]));
    const entityPos = new Map(entityNodes.map((n) => [n.entity.id, n]));

    const svgHeight = Math.max(
      460,
      44 +
        Math.max(
          sourceNodes.length * (sourceH + gap),
          claimNodes.length * (claimH + 12),
          entityNodes.length * (entityH + gap)
        ) +
        36
    );

    const visibleConflicts = graph.conflicts.filter(
      (cnf) => filter === 'all' || cnf.claimIds.some((id) => visibleClaimIds.has(id))
    );

    // Trust Trajectory Curve points matching the cinematic green spline style
    const curveW = 1000;
    const curveH = 160;
    const padX = 56;
    const padTop = 26;
    const padBottom = 32;
    const plotH = curveH - padTop - padBottom;
    const plotW = curveW - padX * 2;
    const curveSources = sources.length > 0 ? sources : workspace.sources;
    const curvePoints = curveSources.map((src, idx) => {
      const score = assessmentBySource.get(src.id)?.reliabilityScore ?? 55;
      const x =
        curveSources.length === 1
          ? curveW / 2
          : padX + (idx / (curveSources.length - 1)) * plotW;
      const y = padTop + ((100 - score) / 100) * plotH;
      return { source: src, score, x, y };
    });

    const curvePath = buildSmoothSplinePath(curvePoints);
    const curveAreaPath =
      curvePoints.length > 0
        ? `${curvePath} L ${curvePoints[curvePoints.length - 1].x.toFixed(1)} ${(curveH - padBottom).toFixed(1)} L ${curvePoints[0].x.toFixed(1)} ${(curveH - padBottom).toFixed(1)} Z`
        : '';

    return {
      sourceNodes,
      claimNodes,
      entityNodes,
      sourcePos,
      claimPos,
      entityPos,
      visibleConflicts,
      svgWidth: 1000,
      svgHeight,
      curveW,
      curveH,
      padX,
      padTop,
      padBottom,
      curvePoints,
      curvePath,
      curveAreaPath,
    };
  }, [graph, workspace.sources, filter, conflictClaimIds, assessmentBySource]);

  if (!graph || !layout) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-12 text-center">
        <GitMerge className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-3 text-base font-semibold text-emerald-950">
          Evidence Graph Not Built Yet
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-emerald-800 leading-relaxed">
          Run cross-modal analysis to extract claims from scanned documents, Excel/CSV tables, JSON
          logs, and memos, resolve entities, and map contradictions.
        </p>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={onBuildGraph}
          disabled={isAnalyzing || workspace.sources.length === 0}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {isAnalyzing ? 'Constructing Graph...' : 'Build Evidence Graph'}
        </motion.button>
      </div>
    );
  }

  const inspectorKey = selected ? `${selected.kind}-${selected.data.id}` : 'default';
  const sceneKey = `${workspace.id}-${filter}-${replayCount}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 p-1">
          {(
            [
              ['all', 'All Nodes'],
              ['conflicts', 'Contested Only'],
              ['verified', 'Verified'],
              ['adversarial', 'Adversarial'],
            ] as const
          ).map(([key, label]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'text-white' : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="graph-filter-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-emerald-700 shadow-sm"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-emerald-800">
          <div className="hidden lg:flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 bg-emerald-500" />
              Provenance Link
            </span>
            <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
              <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-red-600" />
              Contradicts
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
              <span className="inline-block h-0.5 w-5 bg-emerald-600" />
              Corroborates
            </span>
          </div>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setReplayCount((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-100/80 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70 whitespace-nowrap"
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            Replay Trace
          </motion.button>

          <div className="flex items-center gap-1 border border-emerald-200 rounded-md p-0.5 bg-emerald-100/70">
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out graph"
              className="p-1.5 text-emerald-800 hover:text-emerald-950 rounded"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </motion.button>
            <span className="px-1.5 font-mono text-xs tabular-nums text-emerald-900">
              {Math.round(zoom * 100)}%
            </span>
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in graph"
              className="p-1.5 text-emerald-800 hover:text-emerald-950 rounded"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </div>
      </div>

      {layout.visibleConflicts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">
            Trace Conflict:
          </span>
          {layout.visibleConflicts.map((cnf) => {
            const isSel = selected?.kind === 'conflict' && selected.data.id === cnf.id;
            return (
              <motion.button
                key={cnf.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() =>
                  setSelected(isSel ? null : { kind: 'conflict', data: cnf })
                }
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  isSel
                    ? 'border-red-600 bg-red-50 text-red-900 shadow-sm'
                    : 'border-emerald-200 bg-emerald-100/60 text-emerald-900 hover:border-red-400 hover:text-red-800'
                }`}
              >
                <span className="font-mono font-semibold">{cnf.id}</span> ·{' '}
                {cnf.title.length > 36 ? `${cnf.title.slice(0, 35)}…` : cnf.title}
              </motion.button>
            );
          })}
          {selected && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto text-xs font-medium text-emerald-800 hover:underline"
            >
              Reset Focus
            </motion.button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Cinematic Dark-Grid Provenance & Reliability Canvas */}
        <div className="xl:col-span-8 overflow-hidden rounded-lg border border-emerald-900 bg-[#0A110D] shadow-lg">
          <div className="overflow-auto">
            <div className="min-w-[820px] p-3">
              <svg
                key={sceneKey}
                width={layout.svgWidth * zoom}
                height={layout.svgHeight * zoom}
                viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
                className="block transition-all duration-150"
              >
                <defs>
                  <pattern
                    id="cinematic-grid"
                    width="64"
                    height="64"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 64 0 L 0 0 0 64"
                      fill="none"
                      stroke="#172A1E"
                      strokeWidth="1"
                    />
                  </pattern>
                  <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="crimson-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="emerald-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Crisp dark grid backdrop */}
                <rect width={layout.svgWidth} height={layout.svgHeight} fill="url(#cinematic-grid)" />

                <motion.text
                  x={28}
                  y={24}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="fill-emerald-400 font-mono text-[11px] font-semibold tracking-wide"
                >
                  INGESTED SOURCES ({layout.sourceNodes.length})
                </motion.text>
                <motion.text
                  x={356}
                  y={24}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="fill-emerald-400 font-mono text-[11px] font-semibold tracking-wide"
                >
                  EXTRACTED CLAIMS ({layout.claimNodes.length})
                </motion.text>
                <motion.text
                  x={742}
                  y={24}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="fill-emerald-400 font-mono text-[11px] font-semibold tracking-wide"
                >
                  RESOLVED ENTITIES ({layout.entityNodes.length})
                </motion.text>

                {/* Edges: Source -> Claim (Cinematic Glowing Green Spline Draw) */}
                {layout.claimNodes.map((cn, idx) => {
                  const sn = layout.sourcePos.get(cn.claim.sourceId);
                  if (!sn) return null;
                  const x1 = sn.x + sn.w;
                  const y1 = sn.y + sn.h / 2;
                  const x2 = cn.x;
                  const y2 = cn.y + cn.h / 2;
                  const mx = (x1 + x2) / 2;
                  const isLit =
                    !highlightedSets ||
                    (highlightedSets.sources.has(sn.source.id) &&
                      highlightedSets.claims.has(cn.claim.id));
                  return (
                    <g
                      key={`sc-${cn.claim.id}`}
                      style={{
                        opacity: isLit ? 1 : 0.14,
                        transition: 'opacity 220ms ease',
                      }}
                    >
                      <motion.path
                        d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={highlightedSets && isLit ? '#4ADE80' : '#22C55E'}
                        strokeWidth={highlightedSets && isLit ? 2.6 : 1.75}
                        filter="url(#emerald-glow)"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.9 }}
                        transition={{
                          pathLength: {
                            duration: 0.65,
                            delay: 0.15 + Math.min(idx * 0.04, 0.35),
                            ease: [0.22, 1, 0.36, 1],
                          },
                          opacity: { duration: 0.2, delay: 0.15 },
                        }}
                      />
                    </g>
                  );
                })}

                {/* Edges: Claim -> Entity (Cinematic Second-Wave Spline Draw) */}
                {layout.claimNodes.map((cn, idx) => {
                  const en = layout.entityPos.get(cn.claim.subjectEntityId);
                  if (!en) return null;
                  const x1 = cn.x + cn.w;
                  const y1 = cn.y + cn.h / 2;
                  const x2 = en.x;
                  const y2 = en.y + en.h / 2;
                  const mx = (x1 + x2) / 2;
                  const isLit =
                    !highlightedSets ||
                    (highlightedSets.claims.has(cn.claim.id) &&
                      highlightedSets.entities.has(en.entity.id));
                  return (
                    <g
                      key={`ce-${cn.claim.id}`}
                      style={{
                        opacity: isLit ? 1 : 0.14,
                        transition: 'opacity 220ms ease',
                      }}
                    >
                      <motion.path
                        d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={highlightedSets && isLit ? '#4ADE80' : '#16A34A'}
                        strokeWidth={highlightedSets && isLit ? 2.5 : 1.6}
                        filter="url(#emerald-glow)"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.85 }}
                        transition={{
                          pathLength: {
                            duration: 0.65,
                            delay: 0.45 + Math.min(idx * 0.04, 0.35),
                            ease: [0.22, 1, 0.36, 1],
                          },
                          opacity: { duration: 0.2, delay: 0.45 },
                        }}
                      />
                    </g>
                  );
                })}

                {/* Edges: Claim <-> Claim (Corroborates / Contradicts Final Reveal) */}
                {graph.edges
                  .filter((e) => e.relation === 'CONTRADICTS' || e.relation === 'CORROBORATES')
                  .map((edge, idx) => {
                    const fromN = layout.claimPos.get(edge.fromId);
                    const toN = layout.claimPos.get(edge.toId);
                    if (!fromN || !toN) return null;
                    const x1 = fromN.x + fromN.w;
                    const y1 = fromN.y + fromN.h / 2;
                    const x2 = toN.x + toN.w;
                    const y2 = toN.y + toN.h / 2;
                    const arcOffset = Math.max(30, Math.abs(y2 - y1) * 0.26);
                    const isConflict = edge.relation === 'CONTRADICTS';
                    const isLit =
                      !highlightedSets ||
                      (highlightedSets.claims.has(edge.fromId) &&
                        highlightedSets.claims.has(edge.toId));
                    return (
                      <g
                        key={edge.id}
                        style={{
                          opacity: isLit ? 1 : 0.12,
                          transition: 'opacity 220ms ease',
                        }}
                      >
                        <motion.path
                          d={`M ${x1} ${y1} C ${x1 + arcOffset} ${y1}, ${x2 + arcOffset} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={isConflict ? '#F87171' : '#4ADE80'}
                          strokeWidth={isConflict ? 2.3 : 1.9}
                          strokeDasharray={isConflict ? '6 4' : undefined}
                          filter={isConflict ? 'url(#crimson-glow)' : 'url(#emerald-glow)'}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.95 }}
                          transition={{
                            pathLength: {
                              duration: 0.7,
                              delay: 0.72 + Math.min(idx * 0.05, 0.3),
                              ease: [0.22, 1, 0.36, 1],
                            },
                            opacity: { duration: 0.2, delay: 0.72 },
                          }}
                        />
                      </g>
                    );
                  })}

                {/* Source Nodes */}
                {layout.sourceNodes.map(({ source, x, y, w, h }, idx) => {
                  const sa = assessmentBySource.get(source.id);
                  const isSelected = selected?.kind === 'source' && selected.data.id === source.id;
                  const isDimmed = Boolean(
                    highlightedSets && !highlightedSets.sources.has(source.id)
                  );
                  const strokeColor = isSelected
                    ? '#4ADE80'
                    : sa?.trustTier === 'compromised'
                      ? '#EF4444'
                      : sa?.trustTier === 'verified'
                        ? '#22C55E'
                        : '#F59E0B';
                  const fillColor =
                    sa?.trustTier === 'compromised' ? '#251012' : '#0E1C14';
                  const score = sa?.reliabilityScore ?? 50;
                  const barColor =
                    sa?.trustTier === 'compromised'
                      ? '#EF4444'
                      : sa?.trustTier === 'verified'
                        ? '#22C55E'
                        : '#F59E0B';

                  return (
                    <motion.g
                      key={source.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: isDimmed ? 0.28 : 1, x: 0 }}
                      transition={{
                        opacity: { duration: 0.22 },
                        x: {
                          duration: 0.35,
                          delay: Math.min(idx * 0.05, 0.25),
                          ease: [0.16, 1, 0.3, 1],
                        },
                      }}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelected(isSelected ? null : { kind: 'source', data: source })
                      }
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={8}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.4 : 1.25}
                        filter={isSelected ? 'url(#emerald-glow)' : undefined}
                      />
                      <text
                        x={x + 12}
                        y={y + 19}
                        className="fill-emerald-400 font-mono text-[10px]"
                      >
                        {source.id} · {source.modality.toUpperCase()} · {score}%
                      </text>
                      <text
                        x={x + 12}
                        y={y + 37}
                        className="fill-emerald-50 text-[12px] font-semibold"
                      >
                        {source.title.length > 28
                          ? `${source.title.slice(0, 27)}…`
                          : source.title}
                      </text>
                      <rect x={x + 12} y={y + 46} width={w - 24} height={4} rx={2} fill="#16291F" />
                      <rect
                        x={x + 12}
                        y={y + 46}
                        width={Math.max(4, ((w - 24) * score) / 100)}
                        height={4}
                        rx={2}
                        fill={barColor}
                      />
                      <text
                        x={x + 12}
                        y={y + 64}
                        className={`text-[10px] font-medium ${
                          sa?.trustTier === 'compromised'
                            ? 'fill-red-400'
                            : sa?.trustTier === 'verified'
                              ? 'fill-emerald-400'
                              : 'fill-amber-300'
                        }`}
                      >
                        {sa?.adversarialDetected
                          ? 'Adversarial Flagged'
                          : sa?.trustTier === 'verified'
                            ? 'Verified Source'
                            : 'Uncertain Reliability'}
                      </text>
                    </motion.g>
                  );
                })}

                {/* Claim Nodes */}
                {layout.claimNodes.map(({ claim, x, y, w, h }, idx) => {
                  const isSelected = selected?.kind === 'claim' && selected.data.id === claim.id;
                  const isDimmed = Boolean(
                    highlightedSets && !highlightedSets.claims.has(claim.id)
                  );
                  const isContested =
                    claim.status === 'contested' || conflictClaimIds.has(claim.id);
                  const strokeColor = isSelected
                    ? '#4ADE80'
                    : claim.status === 'rejected'
                      ? '#EF4444'
                      : isContested
                        ? '#F59E0B'
                        : '#22C55E';
                  const fillColor =
                    claim.status === 'rejected'
                      ? '#251012'
                      : isContested
                        ? '#231B0B'
                        : '#0E1C14';
                  const labelText = `${claim.predicate}: ${claim.objectValue}`;
                  return (
                    <motion.g
                      key={claim.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: isDimmed ? 0.25 : 1, scale: 1 }}
                      transition={{
                        opacity: { duration: 0.25 },
                        scale: {
                          duration: 0.35,
                          delay: 0.35 + Math.min(idx * 0.03, 0.25),
                          ease: [0.16, 1, 0.3, 1],
                        },
                      }}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelected(isSelected ? null : { kind: 'claim', data: claim })
                      }
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={8}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.4 : 1.25}
                        filter={isSelected ? 'url(#emerald-glow)' : undefined}
                      />
                      <text
                        x={x + 12}
                        y={y + 19}
                        className="fill-emerald-400 font-mono text-[10px]"
                      >
                        {claim.id} · {claim.sourceId} · {claim.confidence}%
                      </text>
                      <text
                        x={x + 12}
                        y={y + 37}
                        className="fill-emerald-50 text-[11.5px] font-medium"
                      >
                        {labelText.length > 38 ? `${labelText.slice(0, 37)}…` : labelText}
                      </text>
                      <text
                        x={x + 12}
                        y={y + 52}
                        className={`text-[10px] font-medium ${
                          claim.status === 'verified'
                            ? 'fill-emerald-400'
                            : claim.status === 'rejected'
                              ? 'fill-red-400'
                              : 'fill-amber-300'
                        }`}
                      >
                        {claim.status === 'verified'
                          ? 'Corroborated'
                          : claim.status === 'rejected'
                            ? 'Rejected / Compromised'
                            : 'Contested Claim'}
                      </text>
                    </motion.g>
                  );
                })}

                {/* Entity Nodes */}
                {layout.entityNodes.map(({ entity, x, y, w, h }, idx) => {
                  const isSelected = selected?.kind === 'entity' && selected.data.id === entity.id;
                  const isDimmed = Boolean(
                    highlightedSets && !highlightedSets.entities.has(entity.id)
                  );
                  return (
                    <motion.g
                      key={entity.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: isDimmed ? 0.28 : 1, x: 0 }}
                      transition={{
                        opacity: { duration: 0.25 },
                        x: {
                          duration: 0.35,
                          delay: 0.6 + Math.min(idx * 0.04, 0.25),
                          ease: [0.16, 1, 0.3, 1],
                        },
                      }}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelected(isSelected ? null : { kind: 'entity', data: entity })
                      }
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={8}
                        fill="#102218"
                        stroke={isSelected ? '#4ADE80' : '#22C55E'}
                        strokeWidth={isSelected ? 2.4 : 1.25}
                        filter={isSelected ? 'url(#emerald-glow)' : undefined}
                      />
                      <text
                        x={x + 12}
                        y={y + 19}
                        className="fill-emerald-400 font-mono text-[10px]"
                      >
                        {entity.id} · {entity.entityType}
                      </text>
                      <text
                        x={x + 12}
                        y={y + 38}
                        className="fill-emerald-50 text-[12px] font-semibold"
                      >
                        {entity.canonicalName.length > 27
                          ? `${entity.canonicalName.slice(0, 26)}…`
                          : entity.canonicalName}
                      </text>
                      <text x={x + 12} y={y + 54} className="fill-emerald-300 text-[10px]">
                        {entity.aliases.length} alias{entity.aliases.length === 1 ? '' : 'es'} ·{' '}
                        {entity.sourceIds.length} source{entity.sourceIds.length === 1 ? '' : 's'}
                      </text>
                    </motion.g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Cinematic Source Reliability Curve Strip (matching glowing spline style) */}
          {layout.curvePoints.length > 0 && (
            <div className="border-t border-emerald-900/90 bg-[#080F0B] px-3 pb-3 pt-2">
              <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-mono text-emerald-400">
                <span>SOURCE RELIABILITY TRAJECTORY</span>
                <span className="text-emerald-300/80 tabular-nums">
                  {layout.curvePoints.length} artifacts plotted
                </span>
              </div>
              <svg
                key={`curve-${sceneKey}`}
                viewBox={`0 0 ${layout.curveW} ${layout.curveH}`}
                className="w-full h-36 block"
              >
                <defs>
                  <linearGradient id="curve-fill-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
                  </linearGradient>
                  <filter id="spline-glow" x="-15%" y="-30%" width="130%" height="160%">
                    <feGaussianBlur stdDeviation="3.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <clipPath id={`curve-reveal-${replayCount}`}>
                    <motion.rect
                      x={0}
                      y={0}
                      width={layout.curveW}
                      height={layout.curveH}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                      style={{ transformOrigin: '0px 0px' }}
                    />
                  </clipPath>
                </defs>

                {/* Horizontal + Vertical Reference Grid */}
                {[0.2, 0.5, 0.8].map((ratio, rIdx) => {
                  const y = layout.padTop + ratio * (layout.curveH - layout.padTop - layout.padBottom);
                  return (
                    <line
                      key={`hg-${rIdx}`}
                      x1={layout.padX}
                      x2={layout.curveW - layout.padX}
                      y1={y}
                      y2={y}
                      stroke="#172A1E"
                      strokeWidth="1"
                    />
                  );
                })}
                {layout.curvePoints.map((pt) => (
                  <line
                    key={`vg-${pt.source.id}`}
                    x1={pt.x}
                    x2={pt.x}
                    y1={layout.padTop - 8}
                    y2={layout.curveH - layout.padBottom}
                    stroke="#172A1E"
                    strokeWidth="1"
                  />
                ))}
                <line
                  x1={layout.padX}
                  x2={layout.curveW - layout.padX}
                  y1={layout.curveH - layout.padBottom}
                  y2={layout.curveH - layout.padBottom}
                  stroke="#274734"
                  strokeWidth="1"
                />

                {/* Gradient fill under curve revealed left-to-right */}
                {layout.curveAreaPath && (
                  <path
                    d={layout.curveAreaPath}
                    fill="url(#curve-fill-grad)"
                    clipPath={`url(#curve-reveal-${replayCount})`}
                  />
                )}

                {/* Luminous animated spline */}
                {layout.curvePath && (
                  <motion.path
                    d={layout.curvePath}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    filter="url(#spline-glow)"
                    initial={{ pathLength: 0, opacity: 0.4 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}

                {/* Interactive vertex markers & axis labels */}
                {layout.curvePoints.map((pt, idx) => {
                  const isSel = selected?.kind === 'source' && selected.data.id === pt.source.id;
                  return (
                    <motion.g
                      key={pt.source.id}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.25,
                        delay: 0.2 + (idx / Math.max(1, layout.curvePoints.length)) * 0.85,
                      }}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelected(isSel ? null : { kind: 'source', data: pt.source })
                      }
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSel ? 6 : 4}
                        fill={pt.score < 40 ? '#EF4444' : '#4ADE80'}
                        stroke="#080F0B"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={layout.curveH - 12}
                        textAnchor="middle"
                        className={`font-mono text-[10px] ${
                          isSel ? 'fill-emerald-300 font-semibold' : 'fill-emerald-500'
                        }`}
                      >
                        {pt.source.id} ({pt.score}%)
                      </text>
                    </motion.g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Right Inspector Panel */}
        <div className="xl:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={inspectorKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {!selected ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-950">Graph Inspector</h3>
                    <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                      Click any Source, Claim, Entity, Reliability vertex, or Conflict pill to
                      highlight its exact cross-modal provenance chain.
                    </p>
                  </div>

                  <div className="border-t border-emerald-200 pt-4">
                    <div className="text-xs font-semibold text-emerald-900">
                      Detected Cross-Modal Conflicts ({layout.visibleConflicts.length})
                    </div>
                    {layout.visibleConflicts.length === 0 ? (
                      <p className="mt-2 text-xs text-emerald-700">No conflicts in current filter.</p>
                    ) : (
                      <div className="mt-2.5 divide-y divide-emerald-200 border border-emerald-200 rounded-lg bg-emerald-100/40 overflow-hidden">
                        {layout.visibleConflicts.map((cnf) => (
                          <motion.button
                            key={cnf.id}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.985 }}
                            type="button"
                            onClick={() => setSelected({ kind: 'conflict', data: cnf })}
                            className="w-full text-left p-3 hover:bg-emerald-100 transition-colors space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-semibold text-red-700">{cnf.id}</span>
                              <span className="text-emerald-700 capitalize">{cnf.severity}</span>
                            </div>
                            <div className="text-xs font-medium text-emerald-950">{cnf.title}</div>
                            <div className="text-[11px] text-emerald-700">
                              {cnf.sourceIds.join(', ')}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : selected.kind === 'source' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-700">{selected.data.id}</span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-950"
                    >
                      Clear
                    </motion.button>
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-950">{selected.data.title}</h3>
                  <p className="text-xs text-emerald-800">
                    Origin: {selected.data.originAuthority}
                  </p>
                  {(() => {
                    const sa = assessmentBySource.get(selected.data.id);
                    if (!sa) return null;
                    return (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-100/60 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-950">
                          {sa.trustTier === 'compromised' ? (
                            <ShieldAlert className="h-4 w-4 text-red-600" />
                          ) : sa.trustTier === 'verified' ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                          <span>
                            Reliability: {sa.reliabilityScore}% ({sa.trustTier})
                          </span>
                        </div>
                        <p className="text-emerald-900 leading-relaxed">{sa.rationale}</p>
                      </div>
                    );
                  })()}
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => onJumpToSource(selected.data.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/70 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Inspect Raw Artifact
                  </motion.button>
                </div>
              ) : selected.kind === 'claim' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-700">
                      {selected.data.id} · from {selected.data.sourceId}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-950"
                    >
                      Clear
                    </motion.button>
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    {selected.data.predicate}: {selected.data.objectValue}
                  </h3>
                  <p className="text-xs text-emerald-900 italic bg-emerald-100/60 border border-emerald-200 rounded p-2.5">
                    "{selected.data.excerpt}"
                  </p>
                  <div className="text-xs text-emerald-800 font-mono tabular-nums">
                    Status: {selected.data.status} · Confidence: {selected.data.confidence}%
                  </div>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => onJumpToSource(selected.data.sourceId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/70 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Source {selected.data.sourceId}
                  </motion.button>
                </div>
              ) : selected.kind === 'entity' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-700">
                      {selected.data.id} · {selected.data.entityType}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-950"
                    >
                      Clear
                    </motion.button>
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    {selected.data.canonicalName}
                  </h3>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    {selected.data.resolutionNote}
                  </p>
                  <div className="text-xs">
                    <div className="font-semibold text-emerald-900">Resolved Aliases</div>
                    <ul className="mt-1 space-y-1 font-mono text-emerald-800">
                      {selected.data.aliases.map((a, idx) => (
                        <li key={idx}>• {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-red-700 font-semibold">
                      {selected.data.id} · {selected.data.severity.toUpperCase()}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-950"
                    >
                      Clear
                    </motion.button>
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-950">{selected.data.title}</h3>
                  <p className="text-xs text-emerald-900 leading-relaxed">{selected.data.description}</p>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-100/60 p-3 text-xs space-y-1">
                    <div className="font-semibold text-emerald-950">Resolution Assessment</div>
                    <p className="text-emerald-900 leading-relaxed">
                      {selected.data.resolutionAssessment}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selected.data.sourceIds.map((sid) => (
                      <motion.button
                        key={sid}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        type="button"
                        onClick={() => onJumpToSource(sid)}
                        className="rounded border border-emerald-300 bg-emerald-100/70 px-2 py-1 font-mono text-[11px] text-emerald-800 hover:bg-emerald-200/70"
                      >
                        Inspect {sid}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
