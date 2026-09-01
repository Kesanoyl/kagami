import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'default' | 'success' | 'error';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional single-level undo, surfaced as a button inside the toast. */
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: ReactNode }> = {
  default: {
    ring: 'text-brand-bright',
    icon: <Info size={16} />,
  },
  success: {
    ring: 'text-st-completed',
    icon: <Check size={16} />,
  },
  error: {
    ring: 'text-danger',
    icon: <TriangleAlert size={16} />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...input, id }]);
      window.setTimeout(() => dismiss(id), input.duration ?? 3800);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[120] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const variant = VARIANT_STYLES[item.variant ?? 'default'];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line px-4 py-3 shadow-pop"
              >
                <span className={cn('mt-0.5 shrink-0', variant.ring)}>{variant.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-ink-dim">{item.description}</p>
                  )}
                </div>
                {item.action && (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-brand-bright transition-colors duration-200 hover:bg-surface-2"
                  >
                    {item.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Fermer la notification"
                  className="-mr-1 shrink-0 cursor-pointer rounded-md p-1 text-ink-faint transition-colors duration-200 hover:text-ink"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return context;
}
