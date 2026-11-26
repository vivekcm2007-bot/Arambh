import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  HelpCircle,
  Play,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { CaseWorkspace, QueryAnswer } from '../shared/types';

interface InterrogateViewProps {
  workspace: CaseWorkspace;
  onAskQuestion: (question: string) => Promise<void>;
  isQuerying: boolean;
  onJumpToSource: (sourceId: string) => void;
}

function VerdictBanner({ answer }: { answer: QueryAnswer }) {
  const barColor =
    answer.verdict === 'ANSWERABLE'
      ? 'bg-emerald-700'
      : answer.verdict === 'CONTESTED'
        ? 'bg-amber-600'
        : 'bg-red-600';

  if (answer.verdict === 'ANSWERABLE') {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-emerald-300 bg-emerald-100 px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Verified Consensus · Answerable</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block h-1.5 w-20 rounded-full bg-emerald-200 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full origin-left ${barColor}`}
              style={{ width: `${answer.confidence}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-emerald-900">
            Confidence {answer.confidence}%
          </span>
        </div>
      </div>
    );
  }
  if (answer.verdict === 'CONTESTED') {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50/90 px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Contested Evidence · Cross-Modal Conflict</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block h-1.5 w-20 rounded-full bg-amber-200 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full origin-left ${barColor}`}
              style={{ width: `${answer.confidence}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-amber-800">
            Confidence {answer.confidence}%
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50/90 px-5 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Insufficient Evidence · Abstaining From Speculation</span>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:block h-1.5 w-20 rounded-full bg-red-200 overflow-hidden">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full origin-left ${barColor}`}
            style={{ width: `${answer.confidence}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-red-800">
          Confidence {answer.confidence}%
        </span>
      </div>
    </div>
  );
}

export function InterrogateView({
  workspace,
  onAskQuestion,
  isQuerying,
  onJumpToSource,
}: InterrogateViewProps) {
  const [question, setQuestion] = useState('');
  const [runningSuite, setRunningSuite] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isQuerying || runningSuite) return;
    await onAskQuestion(trimmed);
    setQuestion('');
  }

  async function handleRunSuite() {
    if (runningSuite || isQuerying || workspace.suggestedQuestions.length === 0) return;
    setRunningSuite(true);
    try {
      const askedSet = new Set(workspace.queries.map((q) => q.question.trim().toLowerCase()));
      const pending = workspace.suggestedQuestions.filter(
        (sq) => !askedSet.has(sq.trim().toLowerCase())
      );
      const targets = pending.length > 0 ? pending : workspace.suggestedQuestions;
      for (const q of targets) {
        await onAskQuestion(q);
      }
    } finally {
      setRunningSuite(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-emerald-950">
              Conflict-Aware Cross-Modal Reasoning
            </h2>
            <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
              Ask complex questions across all ingested modalities. Cerberus-X weighs source
              reliability, resists embedded prompt injections, surfaces contradictions, and abstains
              when evidence is missing.
            </p>
          </div>
          {workspace.suggestedQuestions.length > 1 && (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              disabled={isQuerying || runningSuite || workspace.sources.length === 0}
              onClick={handleRunSuite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70 disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              {runningSuite ? 'Running Suite...' : 'Run All Verification Probes'}
            </motion.button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a cross-modal verification question..."
            disabled={isQuerying || runningSuite || workspace.sources.length === 0}
            className="flex-1 rounded-lg border border-emerald-300 bg-emerald-50/70 px-3.5 py-2.5 text-sm text-emerald-950 placeholder:text-emerald-600 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-emerald-100/60"
          />
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={isQuerying || runningSuite || !question.trim() || workspace.sources.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isQuerying ? 'Reasoning...' : 'Interrogate'}
          </motion.button>
        </form>

        {workspace.suggestedQuestions.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-medium text-emerald-700">
              Suggested Verification Prompts
            </div>
            <div className="flex flex-wrap gap-2">
              {workspace.suggestedQuestions.map((sq, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ y: -1.5 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  disabled={isQuerying || runningSuite}
                  onClick={() => onAskQuestion(sq)}
                  className="text-left rounded-lg border border-emerald-200 bg-emerald-100/70 px-3 py-1.5 text-xs text-emerald-900 hover:border-emerald-300 hover:bg-emerald-200/60 disabled:opacity-50 transition-colors"
                >
                  {sq}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {(isQuerying || runningSuite) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 space-y-3 animate-pulse"
          >
            <div className="h-4 w-56 rounded bg-emerald-200" />
            <div className="h-3 w-full rounded bg-emerald-100" />
            <div className="h-3 w-5/6 rounded bg-emerald-100" />
          </motion.div>
        )}
      </AnimatePresence>

      {workspace.queries.length === 0 && !isQuerying ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-10 text-center text-sm text-emerald-800">
          Select a suggested prompt above, click Run All Verification Probes, or ask your own
          question to generate a traceable, conflict-aware answer.
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {workspace.queries.map((item) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: -10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50"
              >
                <VerdictBanner answer={item} />

                <div className="p-5 space-y-5">
                  <div>
                    <div className="text-xs font-mono text-emerald-700 tabular-nums">
                      {new Date(item.askedAt).toLocaleString()}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-emerald-950">{item.question}</h3>
                    <p className="mt-2.5 text-sm text-emerald-900 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-emerald-200 pt-4 text-xs">
                    <div className="space-y-1.5">
                      <div className="font-semibold text-emerald-800">What Is Established</div>
                      {item.truthSummary.length === 0 ? (
                        <p className="text-emerald-700">
                          No corroborated cross-modal facts directly confirm this query.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-emerald-900 leading-relaxed">
                          {item.truthSummary.map((line, i) => (
                            <li key={i}>• {line}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-amber-800">Cross-Modal Conflicts</div>
                      {item.conflictSummary.length === 0 ? (
                        <p className="text-emerald-700">
                          No unresolved cross-modal contradictions affect this specific question.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-emerald-900 leading-relaxed">
                          {item.conflictSummary.map((line, i) => (
                            <li key={i}>• {line}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 font-semibold text-red-800">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Discounted / Adversarial Evidence</span>
                      </div>
                      {item.unreliableOrIgnored.length === 0 ? (
                        <p className="text-emerald-700">
                          No compromised or adversarial sources impacted this query.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-emerald-900 leading-relaxed">
                          {item.unreliableOrIgnored.map((line, i) => (
                            <li key={i}>• {line}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-emerald-950">Missing Evidence & Gaps</div>
                      {item.missingEvidence.length === 0 ? (
                        <p className="text-emerald-700">
                          No critical evidence gaps detected for this question.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-emerald-900 leading-relaxed">
                          {item.missingEvidence.map((line, i) => (
                            <li key={i}>• {line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {item.citations.length > 0 && (
                    <div className="border-t border-emerald-200 pt-4">
                      <div className="text-xs font-semibold text-emerald-900 mb-2">
                        Traceable Citations ({item.citations.length})
                      </div>
                      <div className="divide-y divide-emerald-200 rounded-lg border border-emerald-200 bg-emerald-100/50">
                        {item.citations.map((cit, cIdx) => (
                          <motion.div
                            key={cIdx}
                            whileHover={{ x: 2 }}
                            transition={{ duration: 0.12 }}
                            className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-2.5 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 font-mono">
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  onClick={() => onJumpToSource(cit.sourceId)}
                                  className="font-semibold text-emerald-800 hover:underline"
                                >
                                  {cit.sourceId}
                                </motion.button>
                                {cit.claimId && (
                                  <span className="text-emerald-700">· {cit.claimId}</span>
                                )}
                              </div>
                              <p className="text-emerald-900 italic">"{cit.quote}"</p>
                            </div>
                            <span
                              className={`font-medium shrink-0 ${
                                cit.weight === 'primary'
                                  ? 'text-emerald-800'
                                  : cit.weight === 'discounted'
                                    ? 'text-red-700'
                                    : 'text-amber-800'
                              }`}
                            >
                              {cit.weight === 'primary'
                                ? 'Primary Weight'
                                : cit.weight === 'discounted'
                                  ? 'Discounted'
                                  : 'Contested'}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
