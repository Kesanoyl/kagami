import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { STATUS_META } from '@/lib/constants';
import type { WatchStatus } from '@/types';

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-dim border-line',
    brand: 'bg-brand/12 text-brand-bright border-brand/25',
    success: 'bg-success/12 text-success border-success/25',
    warning: 'bg-warning/12 text-warning border-warning/25',
    danger: 'bg-danger/12 text-danger border-danger/25',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Written out in full rather than interpolated: Tailwind scans source text, so
 * a template literal like `bg-${token}` would never be compiled.
 */
export const STATUS_DOT: Record<WatchStatus, string> = {
  watching: 'bg-st-watching',
  completed: 'bg-st-completed',
  planned: 'bg-st-planned',
  paused: 'bg-st-paused',
  dropped: 'bg-st-dropped',
};

export const STATUS_TEXT: Record<WatchStatus, string> = {
  watching: 'text-st-watching',
  completed: 'text-st-completed',
  planned: 'text-st-planned',
  paused: 'text-st-paused',
  dropped: 'text-st-dropped',
};

/** Status is never conveyed by colour alone — the label always ships with it. */
export function StatusBadge({
  status,
  className,
  dotOnly = false,
}: {
  status: WatchStatus;
  className?: string;
  dotOnly?: boolean;
}) {
  const meta = STATUS_META[status];
  const dot = STATUS_DOT[status];

  if (dotOnly) {
    return (
      <span
        className={cn('inline-block h-2 w-2 rounded-full', dot, className)}
        role="img"
        aria-label={meta.label}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/80 px-2 py-0.5 text-[11px] font-medium text-ink-dim whitespace-nowrap',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
      {meta.short}
    </span>
  );
}
