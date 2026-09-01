import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The h1 block every page opens with. Keeping it in one component is what makes
 * the pages feel like one product rather than seven screens.
 */
export function PageTitle({
  title,
  subtitle,
  kicker,
  action,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && (
          <p className="kicker-jp mb-1.5 text-[11px]" aria-hidden>
            {kicker}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-dim">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionHeader({
  title,
  subtitle,
  kicker,
  action,
  to,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Japanese kicker shown above the title. Decorative only — never read out. */
  kicker?: string;
  action?: ReactNode;
  /** Renders a "Tout voir" link when provided. */
  to?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 items-stretch gap-3">
        <span className="accent-bar shrink-0" aria-hidden />

        <div className="min-w-0">
          {kicker && (
            <p className="kicker-jp mb-1 text-[10px]" aria-hidden>
              {kicker}
            </p>
          )}
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 truncate text-xs text-ink-dim sm:text-sm">{subtitle}</p>}
        </div>
      </div>

      {action ??
        (to && (
          <Link
            to={to}
            className="group flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface/60 px-3 py-2 text-xs font-medium text-ink-dim transition-[background-color,border-color,color] duration-200 hover:border-line-strong hover:bg-surface-2 hover:text-ink"
          >
            Tout voir
            <ArrowRight
              size={13}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        ))}
    </div>
  );
}
