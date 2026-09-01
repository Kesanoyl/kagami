import { cn } from '@/lib/cn';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { STATUS_DOT } from '@/components/ui/Badge';
import type { WatchStatus } from '@/types';

/** Five mutually exclusive chips — one tap to change where a series belongs. */
export function StatusPicker({
  value,
  onChange,
  className,
}: {
  value: WatchStatus;
  onChange: (status: WatchStatus) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup" aria-label="Statut">
      {STATUS_ORDER.map((status) => {
        const active = status === value;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(status)}
            className={cn(
              'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium',
              'transition-[background-color,border-color,color] duration-200',
              active
                ? 'border-brand/40 bg-brand/15 text-ink'
                : 'border-line bg-surface-2 text-ink-dim hover:border-line-strong hover:text-ink',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} aria-hidden />
            {STATUS_META[status].label}
          </button>
        );
      })}
    </div>
  );
}
