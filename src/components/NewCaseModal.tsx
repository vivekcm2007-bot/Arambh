import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: { title: string; domain: string; description: string }) => Promise<void>;
  isSubmitting: boolean;
}

export function NewCaseModal({
  isOpen,
  onClose,
  onCreate,
  isSubmitting,
}: NewCaseModalProps) {
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Case title is required.');
      return;
    }
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        domain: domain.trim() || 'Cross-Modal Forensics',
        description: description.trim(),
      });
      setTitle('');
      setDomain('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case.');
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-case-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-emerald-300 bg-emerald-50 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 px-5 py-4">
              <h2 id="new-case-title" className="text-base font-semibold text-emerald-950">
                New Investigation Workspace
              </h2>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-950"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-emerald-900 mb-1">
                  Workspace Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Grid Substation Incident #42"
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-emerald-900 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g., Supply Chain / Compliance / Clinical Audit"
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-emerald-900 mb-1">
                  Investigation Scope
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what modalities you will cross-examine..."
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-2 border-t border-emerald-200 pt-4">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-emerald-300 bg-emerald-100/70 px-4 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-200/70"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
