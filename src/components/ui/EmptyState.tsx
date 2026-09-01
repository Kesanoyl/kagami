import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** No screen ever renders blank — every empty list explains itself and offers a way out. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-panel border border-dashed border-line px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-ink-faint">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-dim">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-panel border border-danger/20 bg-danger/5 px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
