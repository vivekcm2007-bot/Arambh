import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  AlertTriangle,
  Download,
  FilePlus2,
  FolderPlus,
  GitMerge,
  Home,
  Layers,
  Menu,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  analyzeCaseGraph,
  createCase,
  deleteSource,
  fetchCases,
  ingestSources,
  queryCase,
  resetCase,
  type IngestItemPayload,
} from './api/client';
import { ConflictMatrixView } from './components/ConflictMatrixView';
import { EvidenceGraphCanvas } from './components/EvidenceGraphCanvas';
import { FrontPageView } from './components/FrontPageView';
import { IngestModal } from './components/IngestModal';
import { InterrogateView } from './components/InterrogateView';
import { NewCaseModal } from './components/NewCaseModal';
import { ModalityIcon, SourceViewer, TrustLabel } from './components/SourceViewer';
import type { CaseWorkspace } from './shared/types';

type WorkspaceTab = 'vault' | 'graph' | 'conflicts' | 'interrogate';

const VIEW_LABELS: Record<WorkspaceTab, string> = {
  vault: 'Evidence Vault',
  graph: 'Evidence Graph',
  conflicts: 'Conflict Matrix',
  interrogate: 'Interrogate',
};

export default function App() {
  const [cases, setCases] = useState<CaseWorkspace[]>([]);
  const [showFrontPage, setShowFrontPage] = useState<boolean>(true);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('vault');
  const [vaultMode, setVaultMode] = useState<'single' | 'all'>('single');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [isCreatingCase, setIsCreatingCase] = useState<boolean>(false);
  const [ingestOpen, setIngestOpen] = useState<boolean>(false);
  const [newCaseOpen, setNewCaseOpen] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    const preventFileNav = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventFileNav);
    window.addEventListener('drop', preventFileNav);
    return () => {
      window.removeEventListener('dragover', preventFileNav);
      window.removeEventListener('drop', preventFileNav);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchCases();
        if (!mounted) return;
        setCases(list);
        if (list.length > 0) {
          setActiveCaseId(list[0].id);
          setSelectedSourceId(list[0].sources[0]?.id ?? '');
        }
      } catch (err) {
        if (mounted) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed to load workspaces.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) ?? cases[0] ?? null,
    [cases, activeCaseId]
  );

  const selectedSource = useMemo(() => {
    if (!activeCase) return null;
    return (
      activeCase.sources.find((s) => s.id === selectedSourceId) ?? activeCase.sources[0] ?? null
    );
  }, [activeCase, selectedSourceId]);

  function replaceCaseInState(updated: CaseWorkspace) {
    setCases((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((c) => (c.id === updated.id ? updated : c));
    });
  }

  function handleSelectCase(c: CaseWorkspace) {
    setActiveCaseId(c.id);
    setSelectedSourceId(c.sources[0]?.id ?? '');
    setErrorBanner(null);
    setMobileNavOpen(false);
  }

  function handleJumpToSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setVaultMode('single');
    setActiveTab('vault');
    setShowFrontPage(false);
  }

  function handleEnterWorkspace(tab: WorkspaceTab = 'vault', caseId?: string) {
    if (caseId) {
      const target = cases.find((c) => c.id === caseId);
      if (target) {
        setActiveCaseId(target.id);
        setSelectedSourceId(target.sources[0]?.id ?? '');
      }
    }
    setActiveTab(tab);
    setShowFrontPage(false);
    setMobileNavOpen(false);
  }

  async function handleBuildGraph() {
    if (!activeCase || isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorBanner(null);
    try {
      const res = await analyzeCaseGraph(activeCase.id);
      replaceCaseInState(res.caseWorkspace);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Graph construction failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleIngest(
    items: IngestItemPayload[],
    onProgress?: (uploadedCount: number, totalCount: number) => void
  ) {
    if (!activeCase) return;
    setIsIngesting(true);
    setErrorBanner(null);
    try {
      const updated = await ingestSources(activeCase.id, items, onProgress);
      replaceCaseInState(updated);
      const last = updated.sources[updated.sources.length - 1];
      if (last) setSelectedSourceId(last.id);
      if (items.length > 1) {
        setVaultMode('all');
      }
    } finally {
      setIsIngesting(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!activeCase) return;
    setErrorBanner(null);
    try {
      const updated = await deleteSource(activeCase.id, sourceId);
      replaceCaseInState(updated);
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(updated.sources[0]?.id ?? '');
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to remove source.');
    }
  }

  async function handleAskQuestion(question: string) {
    if (!activeCase) return;
    setIsQuerying(true);
    setErrorBanner(null);
    try {
      const res = await queryCase(activeCase.id, question);
      replaceCaseInState(res.caseWorkspace);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Query failed.');
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleResetCase() {
    if (!activeCase) return;
    setErrorBanner(null);
    try {
      const updated = await resetCase(activeCase.id);
      replaceCaseInState(updated);
      setSelectedSourceId(updated.sources[0]?.id ?? '');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Reset failed.');
    }
  }

  async function handleCreateCase(payload: {
    title: string;
    domain: string;
    description: string;
  }) {
    setIsCreatingCase(true);
    setErrorBanner(null);
    try {
      const created = await createCase(payload);
      replaceCaseInState(created);
      setActiveCaseId(created.id);
      setSelectedSourceId('');
      setActiveTab('vault');
    } finally {
      setIsCreatingCase(false);
    }
  }

  const graphStats = useMemo(() => {
    const g = activeCase?.graph;
    const sources = activeCase?.sources ?? [];
    const compromisedFromFlags = sources.filter((s) =>
      s.deterministicFlags.some((f) => f.severity === 'high')
    ).length;
    const compromisedFromGraph =
      g?.sourceAssessments.filter((sa) => sa.adversarialDetected || sa.trustTier === 'compromised')
        .length ?? 0;

    const scansAndImages = sources.filter(
      (s) => s.modality === 'scan' || s.modality === 'image'
    ).length;
    const tablesAndExcel = sources.filter((s) => s.modality === 'table').length;
    const jsonDatasets = sources.filter((s) => s.modality === 'dataset').length;
    const docsAndPdfs = sources.filter((s) => s.modality === 'document').length;
    const verifiedSources =
      g?.sourceAssessments.filter((sa) => sa.trustTier === 'verified').length ?? 0;
    const uncertainSources =
      g?.sourceAssessments.filter((sa) => sa.trustTier === 'uncertain').length ?? 0;

    return {
      sourcesCount: sources.length,
      entitiesCount: g?.entities.length ?? 0,
      conflictsCount: g?.conflicts.length ?? 0,
      compromisedCount: Math.max(compromisedFromFlags, compromisedFromGraph),
      scansAndImages,
      tablesAndExcel,
      jsonDatasets,
      docsAndPdfs,
      verifiedSources,
      uncertainSources,
    };
  }, [activeCase]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-emerald-50 border-r border-emerald-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-200">
        <span className="font-display text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap">
          Cerberus-X
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden rounded p-1 text-emerald-700 hover:text-emerald-950"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      <div className="px-3 py-4 space-y-1 border-b border-emerald-200">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => {
            setShowFrontPage(true);
            setMobileNavOpen(false);
          }}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 transition-colors whitespace-nowrap mb-2"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Problem Statements</span>
        </motion.button>

        <div className="px-2 pb-1.5 text-[11px] font-semibold text-emerald-700">Workspace</div>
        {(
          [
            ['vault', 'Evidence Vault', Layers],
            ['graph', 'Evidence Graph', GitMerge],
            ['conflicts', 'Conflict Matrix', AlertTriangle],
            ['interrogate', 'Interrogate', MessageSquareText],
          ] as const
        ).map(([tabKey, label, Icon]) => {
          const isActive = activeTab === tabKey;
          return (
            <motion.button
              key={tabKey}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => {
                setActiveTab(tabKey);
                setMobileNavOpen(false);
              }}
              className={`relative w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-emerald-50'
                  : 'text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-tab"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-emerald-900"
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </span>
              {tabKey === 'conflicts' && graphStats.conflictsCount > 0 && (
                <span
                  className={`relative z-10 font-mono text-xs tabular-nums ${
                    isActive ? 'text-emerald-100' : 'text-red-700'
                  }`}
                >
                  {graphStats.conflictsCount}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold text-emerald-700">Investigations</span>
          <motion.button
            whileHover={{ y: -0.5 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => setNewCaseOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            New
          </motion.button>
        </div>

        <div className="space-y-1">
          {cases.map((c) => {
            const isActive = activeCase?.id === c.id;
            return (
              <motion.button
                key={c.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => handleSelectCase(c)}
                className={`relative w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs'
                    : 'text-emerald-800 hover:bg-emerald-100/70 border border-transparent'
                }`}
              >
                <div className="text-xs font-semibold truncate">{c.title}</div>
                <div className="mt-0.5 text-[11px] text-emerald-700 truncate">
                  {c.sources.length} sources · {c.graph ? 'Graph ready' : 'Unanalyzed'}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
      <AnimatePresence mode="wait">
        {showFrontPage ? (
          <motion.div
            key="front-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <FrontPageView cases={cases} onEnterWorkspace={handleEnterWorkspace} />
          </motion.div>
        ) : (
          <motion.div
            key="workspace-shell"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-screen flex bg-emerald-100 text-emerald-950"
          >
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
              {sidebarContent}
            </aside>

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 bg-emerald-950/45"
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-[260px] max-w-[80vw] h-full z-10"
              >
                {sidebarContent}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Shell */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Bar Contract */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-emerald-200 bg-emerald-50 px-6 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden rounded-md p-1.5 text-emerald-800 hover:bg-emerald-100"
              >
                <Menu className="h-5 w-5" />
              </motion.button>
              <div className="flex items-center gap-2 text-sm min-w-0 truncate">
                <span className="text-emerald-700 whitespace-nowrap">Cases</span>
                <span className="text-emerald-400" aria-hidden="true">/</span>
                <span className="font-medium text-emerald-800 truncate">
                  {activeCase?.title ?? 'Loading'}
                </span>
                <span className="text-emerald-400 hidden sm:inline" aria-hidden="true">/</span>
                <span className="font-semibold text-emerald-950 hidden sm:inline whitespace-nowrap">
                  {VIEW_LABELS[activeTab]}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handleBuildGraph}
                disabled={!activeCase || isAnalyzing || activeCase.sources.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isAnalyzing
                  ? 'Analyzing Modalities...'
                  : activeCase?.graph && !activeCase.graphStale
                    ? 'Rebuild Evidence Graph'
                    : 'Build Evidence Graph'}
              </motion.button>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto space-y-6">
            <AnimatePresence>
              {errorBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">{errorBanner}</span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    onClick={() => setErrorBanner(null)}
                    className="text-xs font-medium text-red-700 hover:underline shrink-0"
                  >
                    Dismiss
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {loading || !activeCase ? (
              <div className="space-y-4">
                <div className="h-24 rounded-lg border border-emerald-200 bg-emerald-50 animate-pulse" />
                <div className="h-96 rounded-lg border border-emerald-200 bg-emerald-50 animate-pulse" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCase.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-6"
                >
                  {/* Case Overview + Action Strip */}
                  <section className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-emerald-700">
                          {activeCase.domain}
                          {activeCase.graph && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">
                                Graph built {new Date(activeCase.graph.builtAt).toLocaleTimeString()}
                              </span>
                            </>
                          )}
                          {activeCase.graphStale && activeCase.graph && (
                            <span className="text-amber-700 font-semibold">
                              {' · '}Needs rebuild after source update
                            </span>
                          )}
                        </div>
                        <h1 className="mt-1 text-xl font-semibold text-emerald-950">
                          {activeCase.title}
                        </h1>
                        <p className="mt-1 text-sm text-emerald-800 max-w-3xl leading-relaxed">
                          {activeCase.graph?.summary || activeCase.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => setIngestOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3.5 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-200/70 whitespace-nowrap"
                        >
                          <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Ingest Evidence
                        </motion.button>
                        <motion.a
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          href={`/api/cases/${encodeURIComponent(activeCase.id)}/export`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3.5 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-200/70 whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Export JSON
                        </motion.a>
                        {activeCase.isPreset && (
                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.96 }}
                            type="button"
                            onClick={handleResetCase}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3.5 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70 whitespace-nowrap"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Reset Preset
                          </motion.button>
                        )}
                      </div>
                    </div>

                    {/* Tabular Metric Strip */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-emerald-200 bg-emerald-100/45">
                      <div className="px-5 py-3.5">
                        <div className="text-xs text-emerald-700">Ingested Sources</div>
                        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-950">
                          {graphStats.sourcesCount}
                        </div>
                      </div>
                      <div className="px-5 py-3.5">
                        <div className="text-xs text-emerald-700">Resolved Entities</div>
                        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-950">
                          {activeCase.graph ? graphStats.entitiesCount : '—'}
                        </div>
                      </div>
                      <div className="px-5 py-3.5">
                        <div className="text-xs text-emerald-700">Cross-Modal Conflicts</div>
                        <div
                          className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                            graphStats.conflictsCount > 0 ? 'text-amber-700' : 'text-emerald-950'
                          }`}
                        >
                          {activeCase.graph ? graphStats.conflictsCount : '—'}
                        </div>
                      </div>
                      <div className="px-5 py-3.5">
                        <div className="text-xs text-emerald-700">Adversarial / Compromised</div>
                        <div
                          className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                            graphStats.compromisedCount > 0 ? 'text-red-700' : 'text-emerald-950'
                          }`}
                        >
                          {graphStats.compromisedCount}
                        </div>
                      </div>
                    </div>

                    {/* Modality Coverage & Trust Posture Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs text-emerald-800">
                      <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                        <span className="font-sans font-semibold text-emerald-950">Modalities:</span>
                        <span>{graphStats.scansAndImages} Scans/Images</span>
                        <span aria-hidden="true">·</span>
                        <span>{graphStats.tablesAndExcel} Tables/Excel</span>
                        <span aria-hidden="true">·</span>
                        <span>{graphStats.jsonDatasets} JSON</span>
                        <span aria-hidden="true">·</span>
                        <span>{graphStats.docsAndPdfs} Docs/PDFs</span>
                      </div>
                      {activeCase.graph && (
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className="font-sans font-semibold text-emerald-950">Posture:</span>
                          <span className="text-emerald-800">
                            {graphStats.verifiedSources} Verified
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700">
                            {graphStats.uncertainSources} Uncertain
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-700">
                            {graphStats.compromisedCount} Compromised
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Workspace Views */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'vault' && (
                      <motion.div
                        key="tab-vault"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                          <div className="text-xs font-medium text-emerald-800">
                            Showing{' '}
                            <span className="font-mono font-semibold text-emerald-950">
                              {activeCase.sources.length}
                            </span>{' '}
                            ingested artifact{activeCase.sources.length === 1 ? '' : 's'} across{' '}
                            <span className="font-mono font-semibold text-emerald-950">
                              {new Set(activeCase.sources.map((s) => s.modality)).size}
                            </span>{' '}
                            modalit
                            {new Set(activeCase.sources.map((s) => s.modality)).size === 1
                              ? 'y'
                              : 'ies'}
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 p-1">
                            {(
                              [
                                ['single', 'Artifact Inspector'],
                                ['all', `All Artifacts Table (${activeCase.sources.length})`],
                              ] as const
                            ).map(([modeKey, label]) => {
                              const active = vaultMode === modeKey;
                              return (
                                <button
                                  key={modeKey}
                                  type="button"
                                  onClick={() => setVaultMode(modeKey)}
                                  className={`relative px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                    active ? 'text-white' : 'text-emerald-800 hover:text-emerald-950'
                                  }`}
                                >
                                  {active && (
                                    <motion.span
                                      layoutId="vault-mode-pill"
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

                        <AnimatePresence mode="wait">
                          {vaultMode === 'all' ? (
                            <motion.div
                              key="vault-all"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50"
                            >
                              <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr className="border-b border-emerald-200 bg-emerald-100/80 text-emerald-800">
                                    <th className="px-4 py-3 font-semibold">ID</th>
                                    <th className="px-4 py-3 font-semibold">Artifact & Filename</th>
                                    <th className="px-4 py-3 font-semibold">Modality</th>
                                    <th className="px-4 py-3 font-semibold">Trust State</th>
                                    <th className="px-4 py-3 font-semibold text-right">Claims</th>
                                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-200">
                                  {activeCase.sources.map((src) => {
                                    const sa = activeCase.graph?.sourceAssessments.find(
                                      (a) => a.sourceId === src.id
                                    );
                                    const claimCount =
                                      activeCase.graph?.claims.filter((c) => c.sourceId === src.id)
                                        .length ?? 0;
                                    return (
                                      <tr
                                        key={src.id}
                                        className="hover:bg-emerald-100/60 transition-colors"
                                      >
                                        <td className="px-4 py-3 font-mono font-semibold text-emerald-950 whitespace-nowrap">
                                          {src.id}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="font-medium text-emerald-950">
                                            {src.title}
                                          </div>
                                          <div className="font-mono text-[11px] text-emerald-700">
                                            {src.filename} · {src.originAuthority}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono uppercase text-emerald-800 whitespace-nowrap">
                                          {src.modality}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <TrustLabel assessment={sa} />
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-950">
                                          {activeCase.graph ? claimCount : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                                          <motion.button
                                            whileTap={{ scale: 0.94 }}
                                            type="button"
                                            onClick={() => {
                                              setSelectedSourceId(src.id);
                                              setVaultMode('single');
                                            }}
                                            className="font-medium text-emerald-800 hover:underline"
                                          >
                                            Inspect
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.94 }}
                                            type="button"
                                            onClick={() => handleDeleteSource(src.id)}
                                            className="font-medium text-red-700 hover:underline"
                                          >
                                            Remove
                                          </motion.button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="vault-single"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.15 }}
                              className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
                            >
                              {/* Source List */}
                              <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
                                <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-3">
                                  <span className="text-xs font-semibold text-emerald-950">
                                    Artifact Queue ({activeCase.sources.length})
                                  </span>
                                  <motion.button
                                    whileTap={{ scale: 0.94 }}
                                    type="button"
                                    onClick={() => setIngestOpen(true)}
                                    className="text-xs font-medium text-emerald-800 hover:underline"
                                  >
                                    + Add Source
                                  </motion.button>
                                </div>

                                {activeCase.sources.length === 0 ? (
                                  <div className="p-6 text-center space-y-3">
                                    <p className="text-xs text-emerald-800">
                                      No evidence artifacts ingested in this workspace yet.
                                    </p>
                                    <motion.button
                                      whileHover={{ y: -1 }}
                                      whileTap={{ scale: 0.96 }}
                                      type="button"
                                      onClick={() => setIngestOpen(true)}
                                      className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800"
                                    >
                                      Upload First Artifact
                                    </motion.button>
                                  </div>
                                ) : (
                                  <div className="divide-y divide-emerald-200">
                                    {activeCase.sources.map((src) => {
                                      const isSelected = selectedSource?.id === src.id;
                                      const sa = activeCase.graph?.sourceAssessments.find(
                                        (a) => a.sourceId === src.id
                                      );
                                      const hasAlert =
                                        src.deterministicFlags.length > 0 ||
                                        Boolean(sa?.adversarialDetected);
                                      return (
                                        <div
                                          key={src.id}
                                          className={`group flex items-start justify-between gap-2 px-4 py-3 transition-colors ${
                                            isSelected ? 'bg-emerald-100/90' : 'hover:bg-emerald-100/50'
                                          }`}
                                        >
                                          <motion.button
                                            whileTap={{ scale: 0.985 }}
                                            type="button"
                                            onClick={() => setSelectedSourceId(src.id)}
                                            className="flex-1 min-w-0 text-left space-y-1"
                                          >
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-700">
                                              <ModalityIcon modality={src.modality} />
                                              <span className="font-semibold text-emerald-950">
                                                {src.id}
                                              </span>
                                              <span aria-hidden="true">·</span>
                                              <span className="uppercase">{src.modality}</span>
                                              {hasAlert && (
                                                <>
                                                  <span aria-hidden="true">·</span>
                                                  <span className="text-red-700 font-semibold">
                                                    Flagged
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                            <div className="text-sm font-medium text-emerald-950 truncate">
                                              {src.title}
                                            </div>
                                            <div>
                                              <TrustLabel assessment={sa} />
                                            </div>
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            type="button"
                                            onClick={() => handleDeleteSource(src.id)}
                                            aria-label={`Remove ${src.title}`}
                                            className="p-1 text-emerald-600 hover:text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </motion.button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Active Source Detail */}
                              <div className="lg:col-span-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                                {!selectedSource ? (
                                  <div className="py-16 text-center text-sm text-emerald-700">
                                    Select an artifact from the queue or ingest new files to inspect
                                    them.
                                  </div>
                                ) : (
                                  <SourceViewer
                                    caseId={activeCase.id}
                                    source={selectedSource}
                                    assessment={activeCase.graph?.sourceAssessments.find(
                                      (sa) => sa.sourceId === selectedSource.id
                                    )}
                                    claims={
                                      activeCase.graph?.claims.filter(
                                        (c) => c.sourceId === selectedSource.id
                                      ) ?? []
                                    }
                                  />
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                    {activeTab === 'graph' && (
                      <motion.div
                        key="tab-graph"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <EvidenceGraphCanvas
                          workspace={activeCase}
                          onJumpToSource={handleJumpToSource}
                          onBuildGraph={handleBuildGraph}
                          isAnalyzing={isAnalyzing}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'conflicts' && (
                      <motion.div
                        key="tab-conflicts"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ConflictMatrixView
                          workspace={activeCase}
                          onJumpToSource={handleJumpToSource}
                          onBuildGraph={handleBuildGraph}
                          isAnalyzing={isAnalyzing}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'interrogate' && (
                      <motion.div
                        key="tab-interrogate"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <InterrogateView
                          workspace={activeCase}
                          onAskQuestion={handleAskQuestion}
                          isQuerying={isQuerying}
                          onJumpToSource={handleJumpToSource}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        <IngestModal
          isOpen={ingestOpen}
          onClose={() => setIngestOpen(false)}
          onIngest={handleIngest}
          isSubmitting={isIngesting}
        />

            <NewCaseModal
              isOpen={newCaseOpen}
              onClose={() => setNewCaseOpen(false)}
              onCreate={handleCreateCase}
              isSubmitting={isCreatingCase}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
