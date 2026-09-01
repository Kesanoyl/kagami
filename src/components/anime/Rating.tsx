import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRating } from '@/lib/format';

const STARS = 10;

/**
 * The user's own score, shown as a gold pill.
 *
 * This is the number that matters most on a series they have watched, so it
 * gets the prime slot on the poster rather than a footnote under it. Gold + a
 * filled star distinguishes it at a glance from the grey community score.
 */
export function MyRating({
  value,
  size = 'md',
  onPoster = false,
  className,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  /** Adds a dark backdrop so it stays legible over cover art. */
  onPoster?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: { box: 'gap-0.5 px-1.5 py-0.5 text-[11px]', star: 10 },
    md: { box: 'gap-1 px-2 py-1 text-sm', star: 13 },
    lg: { box: 'gap-1.5 px-3 py-1.5 text-lg', star: 18 },
  } as const;
  const s = sizes[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg font-bold text-warning tabular-nums',
        onPoster
          ? 'border border-warning/35 bg-black/75 shadow-soft backdrop-blur-sm'
          : 'border border-warning/25 bg-warning/12',
        s.box,
        className,
      )}
      title={`Ma note : ${formatRating(value)} sur 10`}
    >
      <Star size={s.star} fill="currentColor" strokeWidth={0} aria-hidden />
      {formatRating(value)}
      <span className="sr-only">sur 10 (ma note)</span>
    </span>
  );
}

/** Compact star + value, for dense rows. */
export function RatingStars({
  value,
  size = 12,
  className,
  showValue = true,
}: {
  value: number | null;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  if (value == null) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-warning', className)}>
      <Star size={size} fill="currentColor" strokeWidth={0} aria-hidden />
      {showValue && (
        <span className="tnum text-xs font-semibold text-ink">{formatRating(value)}</span>
      )}
      <span className="sr-only">Note personnelle : {formatRating(value)} sur 10</span>
    </span>
  );
}

/**
 * Ten stars, half-star precision: the left half of a star sets `n - 0.5`, the
 * right half sets `n`. A numeric fallback lives in the edit modal for people who
 * prefer typing.
 */
export function RatingInput({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  className?: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value ?? 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div
        className="flex items-center"
        role="group"
        aria-label="Note personnelle sur 10"
        onMouseLeave={() => setPreview(null)}
        // Without this, tabbing away left the hovered preview stuck on screen,
        // showing a score the user never actually set.
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
        }}
      >
        {Array.from({ length: STARS }, (_, index) => {
          const full = index + 1;
          const half = full - 0.5;
          const fillRatio = Math.min(1, Math.max(0, shown - index));

          return (
            <span key={full} className="relative flex h-11 items-center">
              <Star
                size={17}
                className="pointer-events-none text-surface-3"
                fill="currentColor"
                strokeWidth={0}
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-warning"
                style={{ width: `${fillRatio * 17}px` }}
                aria-hidden
              >
                <Star size={17} fill="currentColor" strokeWidth={0} />
              </span>

              {/* Two invisible hit zones per star give the 0.5 precision. */}
              <button
                type="button"
                aria-label={`Noter ${formatRating(half)} sur 10`}
                onMouseEnter={() => setPreview(half)}
                onFocus={() => setPreview(half)}
                onClick={() => onChange(half)}
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
              />
              <button
                type="button"
                aria-label={`Noter ${formatRating(full)} sur 10`}
                onMouseEnter={() => setPreview(full)}
                onFocus={() => setPreview(full)}
                onClick={() => onChange(full)}
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
              />
            </span>
          );
        })}
      </div>

      <span className="tnum min-w-14 text-lg font-semibold text-ink">
        {value == null ? <span className="text-ink-faint">—</span> : formatRating(value)}
        <span className="ml-0.5 text-xs font-normal text-ink-faint">/10</span>
      </span>

      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-ink-faint transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <X size={12} /> Retirer
        </button>
      )}
    </div>
  );
}
