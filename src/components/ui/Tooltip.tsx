import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Hover/focus tooltip used by the collapsed sidebar. Purely decorative: the
 * accessible name always lives on the trigger itself via `aria-label`.
 */
export function Tooltip({
  label,
  children,
  side = 'right',
  className,
}: {
  label: string;
  children: ReactNode;
  side?: 'right' | 'top';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-50 rounded-md border border-line bg-overlay px-2 py-1 text-xs font-medium whitespace-nowrap text-ink shadow-lift',
          'transition-[opacity,transform] duration-150 ease-[var(--ease-out-soft)]',
          side === 'right'
            ? 'top-1/2 left-[calc(100%+10px)] -translate-y-1/2'
            : 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
