import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Poster/banner image with a reserved aspect box (no CLS), lazy loading and a
 * fade-in that only runs the first time the bitmap decodes.
 */
export function Poster({
  src,
  alt,
  className,
  imgClassName,
  eager = false,
  ratio = 'aspect-[2/3]',
  tint,
}: {
  src: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  ratio?: string;
  /** AniList cover colour, used as the placeholder wash. */
  tint?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-2', ratio, className)}
      style={tint ? { backgroundColor: `color-mix(in oklab, ${tint} 22%, var(--color-surface-2))` } : undefined}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500 ease-[var(--ease-out-soft)]',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint">
          <ImageOff size={22} aria-hidden />
          <span className="sr-only">{alt}</span>
        </div>
      )}
    </div>
  );
}
