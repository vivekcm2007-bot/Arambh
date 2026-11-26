import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  GitMerge,
  Layers,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';
import type { CaseWorkspace } from '../shared/types';

type WorkspaceTab = 'vault' | 'graph' | 'conflicts' | 'interrogate';

interface FrontPageViewProps {
  cases: CaseWorkspace[];
  onEnterWorkspace: (tab?: WorkspaceTab, caseId?: string) => void;
}

const HACKATHON_TRACKS = [
  {
    code: 'A01',
    name: 'OMNIS-X',
    subtitle: 'A College That Cannot Afford a Single Operational Failure',
    domain: 'College & Institutional Systems',
    active: false,
  },
  {
    code: 'A02',
    name: 'CERBERUS-X',
    subtitle: 'A Knowledge System Where Every Modality Can Contradict the Others',
    domain: 'AI / ML / GenAI',
    active: true,
  },
  {
    code: 'A03',
    name: 'NEMESIS-X',
    subtitle: 'Understanding Events That Have Never Been Seen Before',
    domain: 'AI / ML / Computer Vision',
    active: false,
  },
  {
    code: 'A07',
    name: 'MEDUSA-X',
    subtitle: 'The Clinical Record That Cannot Be Trusted',
    domain: 'Healthcare / Agentic AI / Clinical NLP',
    active: false,
  },
  {
    code: 'A05',
    name: 'ARGUS-X',
    subtitle: 'Track the Untrackable',
    domain: 'Advanced Computer Vision',
    active: false,
  },
  {
    code: 'A06',
    name: 'PROMETHEUS-X',
    subtitle: 'Detect the Defect That Your Model Has Never Been Trained to Recognize',
    domain: 'Advanced Computer Vision',
    active: false,
  },
];

const CORE_CAPABILITIES: Array<{
  num: string;
  title: string;
  tab: WorkspaceTab;
  summary: string;
  icon: typeof Layers;
}> = [
  {
    num: '01',
    title: 'Multimodal Evidence Ingestion',
    tab: 'vault',
    summary:
      'Ingests documents, scanned images, PDFs, Excel workbooks, CSV logs, and JSON datasets with SHA-256 hashing and deterministic integrity scanning.',
    icon: Layers,
  },
  {
    num: '02',
    title: 'Entity Resolution & Evidence Graph',
    tab: 'graph',
    summary:
      'Merges entity aliases across disparate formats into a unified cross-modal provenance graph linking sources, atomic claims, and canonical entities.',
    icon: GitMerge,
  },
  {
    num: '03',
    title: 'Contradiction & Reliability Audit',
    tab: 'conflicts',
    summary:
      'Surfaces numerical, temporal, and status discrepancies across modalities while scoring source reliability and isolating prompt injections.',
    icon: AlertTriangle,
  },
  {
    num: '04',
    title: 'Conflict-Aware Interrogation',
    tab: 'interrogate',
    summary:
      'Answers complex queries by separating corroborated facts, active disputes, compromised records, and explicit insufficient-evidence abstentions.',
    icon: MessageSquareText,
  },
];

export function FrontPageView({ cases, onEnterWorkspace }: FrontPageViewProps) {
  const [selectedTrackCode, setSelectedTrackCode] = useState('A02');

  const totalSources = cases.reduce((sum, c) => sum + c.sources.length, 0);
  const totalConflicts = cases.reduce((sum, c) => sum + (c.graph?.conflicts.length ?? 0), 0);
  const totalEntities = cases.reduce((sum, c) => sum + (c.graph?.entities.length ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-emerald-100 text-emerald-950">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-emerald-200 bg-emerald-50/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between gap-8 px-6 py-4">
          <a
            href="#problem-brief"
            className="font-display text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0"
          >
            Cerberus-X
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-emerald-800">
            <a
              href="#problem-brief"
              className="hover:text-emerald-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Problem Brief
            </a>
            <a
              href="#capabilities"
              className="hover:text-emerald-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#live-cases"
              className="hover:text-emerald-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Live Cases
            </a>
            <a
              href="#problem-statements"
              className="hover:text-emerald-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Problem Statements
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => onEnterWorkspace('vault')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              Open Workspace
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1280px] w-full px-6 py-10 space-y-12">
        {/* Hero: Problem Statement 2 Spotlight */}
        <section id="problem-brief" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 rounded-lg border border-emerald-200 bg-emerald-50 p-7 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-emerald-800">
                <span>Problem Statement 2</span>
                <span aria-hidden="true">·</span>
                <span>Code A02 — CERBERUS-X</span>
                <span aria-hidden="true">·</span>
                <span>AI / ML / GenAI</span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-emerald-950 leading-[1.12]"
                style={{
                  fontSize: 'clamp(2rem, 3.6vw, 3.1rem)',
                  textWrap: 'balance',
                }}
              >
                A Knowledge System Where Every Modality Can Contradict the Others
              </h1>

              <p className="text-base font-medium text-emerald-800">
                Multimodal Evidence Graph Construction & Conflict-Aware Reasoning
              </p>

              <p className="text-sm text-emerald-900 leading-relaxed max-w-2xl">
                An intelligence workspace that ingests documents, images, Excel and CSV tables, JSON
                datasets, and scanned records to resolve cross-modal entities, detect contradictions,
                score source reliability, and answer complex questions while resisting manipulated or
                adversarial instructions.
              </p>

              <div className="rounded-lg border border-emerald-200 bg-emerald-100/70 p-4 text-sm text-emerald-950 leading-relaxed">
                <span className="font-semibold">Core Challenge: </span>
                Determine what is true, what conflicts, what is unreliable, and when the evidence is
                insufficient to answer.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <motion.button
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onEnterWorkspace('vault')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Launch Investigation Workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </motion.button>
              <motion.button
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onEnterWorkspace('graph')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-100/80 px-5 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-200/70 transition-colors whitespace-nowrap"
              >
                Inspect Cinematic Evidence Graph
              </motion.button>
            </div>
          </motion.div>

          {/* Right Panel: Cinematic Cross-Modal Signal Canvas */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 rounded-lg border border-emerald-900 bg-[#0A110D] p-6 flex flex-col justify-between text-emerald-50 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
              <span>CROSS-MODAL VERIFICATION SIGNAL</span>
              <span>A02 · LIVE</span>
            </div>

            <div className="my-4">
              <svg viewBox="0 0 420 210" className="w-full h-auto block">
                <defs>
                  <pattern
                    id="front-hero-grid"
                    width="52"
                    height="52"
                    patternUnits="userSpaceOnUse"
                  >
                    <path d="M 52 0 L 0 0 0 52" fill="none" stroke="#172A1E" strokeWidth="1" />
                  </pattern>
                  <linearGradient id="front-hero-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
                  </linearGradient>
                  <filter id="front-hero-glow" x="-15%" y="-25%" width="130%" height="150%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <clipPath id="front-hero-reveal">
                    <motion.rect
                      x={0}
                      y={0}
                      width={420}
                      height={210}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{ transformOrigin: '0px 0px' }}
                    />
                  </clipPath>
                </defs>

                <rect width="420" height="210" fill="url(#front-hero-grid)" />

                <path
                  d="M 16 178 C 52 108, 86 108, 120 156 C 154 204, 198 62, 236 86 C 274 110, 304 148, 344 74 C 370 28, 392 28, 404 18 L 404 196 L 16 196 Z"
                  fill="url(#front-hero-grad)"
                  clipPath="url(#front-hero-reveal)"
                />
                <motion.path
                  d="M 16 178 C 52 108, 86 108, 120 156 C 154 204, 198 62, 236 86 C 274 110, 304 148, 344 74 C 370 28, 392 28, 404 18"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#front-hero-glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
                />

                {[
                  { x: 16, y: 178, label: 'Ingest' },
                  { x: 120, y: 156, label: 'Resolve' },
                  { x: 236, y: 86, label: 'Audit' },
                  { x: 344, y: 74, label: 'Graph' },
                  { x: 404, y: 18, label: 'Verify' },
                ].map((pt, i) => (
                  <motion.g
                    key={pt.label}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: 0.25 + i * 0.2 }}
                  >
                    <circle cx={pt.x} cy={pt.y} r="4.5" fill="#4ADE80" stroke="#0A110D" strokeWidth="2" />
                    <text
                      x={pt.x}
                      y={204}
                      textAnchor="middle"
                      className="fill-emerald-400 font-mono text-[10px]"
                    >
                      {pt.label}
                    </text>
                  </motion.g>
                ))}
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-emerald-900 pt-4 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-emerald-400">Active Cases</div>
                <div className="mt-0.5 text-xl font-semibold text-emerald-50">{cases.length}</div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-400">Artifacts</div>
                <div className="mt-0.5 text-xl font-semibold text-emerald-50">{totalSources}</div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-400">Conflicts</div>
                <div className="mt-0.5 text-xl font-semibold text-amber-300">{totalConflicts}</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* System Capabilities Mapped to Live Modules */}
        <section id="capabilities" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-emerald-950">
                Implemented Architecture for A02 — CERBERUS-X
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                Select any module below to jump directly into its live workspace interface ({totalEntities}{' '}
                resolved entities across active cases).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CORE_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <motion.button
                  key={cap.num}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => onEnterWorkspace(cap.tab)}
                  className="text-left rounded-lg border border-emerald-200 bg-emerald-50 p-5 space-y-3 hover:border-emerald-400 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-700">
                      <span className="font-semibold">{cap.num}.</span>
                      <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-emerald-950">{cap.title}</h3>
                    <p className="text-xs text-emerald-800 leading-relaxed">{cap.summary}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 pt-1">
                    Open Module
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Live Pre-Loaded Forensic Workspaces */}
        <section id="live-cases" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-emerald-950">
              Active Investigation Workspaces
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
              Open a live multimodal case workspace directly to inspect artifacts, graphs, and
              conflict-aware answers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases.map((c) => (
              <motion.button
                key={c.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={() => onEnterWorkspace('vault', c.id)}
                className="text-left rounded-lg border border-emerald-200 bg-emerald-50 p-5 space-y-3 hover:border-emerald-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-700">
                  <span className="font-medium">{c.domain}</span>
                  <span className="font-mono tabular-nums">
                    {c.sources.length} sources · {c.graph?.conflicts.length ?? 0} conflicts
                  </span>
                </div>
                <h3 className="text-base font-semibold text-emerald-950">{c.title}</h3>
                <p className="text-xs text-emerald-800 leading-relaxed line-clamp-2">
                  {c.description}
                </p>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                  Inspect Case Workspace
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Hackathon Problem Statements Directory */}
        <section
          id="problem-statements"
          className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden"
        >
          <div className="border-b border-emerald-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-emerald-950">
                Hackathon Problem Statements Registry
              </h2>
              <p className="text-xs text-emerald-700 mt-0.5">
                Full 24-hour track index highlighting Problem Statement 2 (A02 — CERBERUS-X)
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Active Build: A02 — CERBERUS-X
            </span>
          </div>

          <div className="divide-y divide-emerald-200">
            {HACKATHON_TRACKS.map((track, idx) => {
              const isSelected = selectedTrackCode === track.code;
              return (
                <motion.button
                  key={track.code}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={() => setSelectedTrackCode(track.code)}
                  className={`w-full text-left px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    track.active
                      ? 'bg-emerald-100/90'
                      : isSelected
                        ? 'bg-emerald-100/50'
                        : 'hover:bg-emerald-100/40'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-emerald-950 tabular-nums">
                        0{idx + 1}. {track.code} — {track.name}
                      </span>
                      <span aria-hidden="true" className="text-emerald-400">
                        ·
                      </span>
                      <span className="text-emerald-700">{track.domain}</span>
                    </div>
                    <div className="text-sm font-medium text-emerald-950">{track.subtitle}</div>
                  </div>
                  <div className="shrink-0 text-xs font-medium">
                    {track.active ? (
                      <span className="text-emerald-800 font-semibold">Our Selected Track</span>
                    ) : (
                      <span className="text-emerald-700">Event Track</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-emerald-200 bg-emerald-50 py-5 px-6">
        <div className="mx-auto max-w-[1280px] flex flex-wrap items-center justify-between gap-4 text-xs text-emerald-700">
          <span>Cerberus-X · Problem Statement A02 Multimodal Evidence Intelligence</span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => onEnterWorkspace('vault')}
            className="font-medium text-emerald-800 hover:underline"
          >
            Enter Live Workspace
          </motion.button>
        </div>
      </footer>
    </div>
  );
}
