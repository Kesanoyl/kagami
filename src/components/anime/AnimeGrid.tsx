import type { Anime } from '@/types';
import { AnimeCard } from './AnimeCard';
import { useWatchlist } from '@/hooks/useWatchlist';
import { cn } from '@/lib/cn';

/**
 * The one grid used by Discover, Library and search results, so poster sizing
 * stays identical across the whole product.
 */
export function AnimeGrid({
  animes,
  className,
  eagerCount = 6,
}: {
  animes: Anime[];
  className?: string;
  /** Above-the-fold posters load eagerly; everything else is lazy. */
  eagerCount?: number;
}) {
  const { getEntry } = useWatchlist();

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
        className,
      )}
    >
      {animes.map((anime, index) => (
        <AnimeCard
          key={anime.id}
          anime={anime}
          entry={getEntry(anime.id)}
          eager={index < eagerCount}
          className="animate-in-up"
        />
      ))}
    </div>
  );
}

/** Same cards, laid out as a swipeable rail. */
export function AnimeRail({ animes, ranked = false }: { animes: Anime[]; ranked?: boolean }) {
  const { getEntry } = useWatchlist();

  return (
    <>
      {animes.map((anime, index) => (
        <div
          key={anime.id}
          className="w-[42vw] shrink-0 snap-start sm:w-44 md:w-48 lg:w-[13.5rem]"
        >
          <AnimeCard
            anime={anime}
            entry={getEntry(anime.id)}
            eager={index < 4}
            rank={ranked ? index + 1 : undefined}
          />
        </div>
      ))}
    </>
  );
}
