import { cn } from '@/lib/cn';

/**
 * Progress is animated on the width of an inner bar via `transform: scaleX`,
 * which keeps it off the layout path.
 */
export function Progress({
  value,
  className,
  barClassName,
  label,
}: {
  /** 0–100. */
  value: number;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progression'}
    >
      <div
        className={cn(
          'h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-[var(--ease-out-soft)]',
          barClassName,
        )}
        style={{ transform: `scaleX(${clamped / 100})`, width: '100%' }}
      />
    </div>
  );
}
