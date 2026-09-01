import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Shuffle, Sparkles } from 'lucide-react';
import { browseAnime, currentSeason, getRecommendationsFor } from '@/services/api/anime';
import type { Anime } from '@/types';
import { useAsync } from '@/hooks/useAsync';
import { useCacheAnimes, useWatchlist } from '@/hooks/useWatchlist';
import { AnimeGrid, AnimeRail } from '@/components/anime/AnimeGrid';
import { ScrollRow } from '@/components/ui/ScrollRow';
import { PageTitle, SectionHeader } from '@/components/ui/SectionHeader';
import { CardGridSkeleton, RowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { GENRES, SEASON_LABEL } from '@/lib/constants';

/**
 * Seven stacked rails made the page a wall. The sections are grouped into four
 * tabs instead, so at most three rails compete for attention at a time.
 */
type Tab = 'moment' | 'pour-toi' | 'classements' | 'genres';

const TABS: { id: Tab; label: string; kicker: string }[] = [
  { id: 'moment', label: 'Le moment', kicker: '今' },
  { id: 'pour-toi', label: 'Pour toi', kicker: 'おすすめ' },
  { id: 'classements', label: 'Classements', kicker: '殿堂' },
  { id: 'genres', label: 'Par genre', kicker: 'ジャンル' },
];

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('moment');
  const [genre, setGenre] = useState<string | null>(null);
  const { season, year } = useMemo(() => currentSeason(), []);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="space-y-8">
      <PageTitle
        kicker="発見"
        title="Découvrir"
        subtitle="Tendances, saison en cours et suggestions basées sur ce que tu regardes."
        action={<SurpriseButton />}
      />

      <div
        role="tablist"
        aria-label="Sections de découverte"
        className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((item) => {
          const isActive = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.id)}
              className={cn(
                'relative shrink-0 cursor-pointer px-4 pb-3 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-200',
                isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-dim',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-bright transition-opacity duration-200',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div key={active.id} className="animate-fade space-y-14">
        {tab === 'moment' && (
          <>
            <Rail
              title="Tendances du moment"
              kicker="人気"
              subtitle="Ce que la communauté regarde cette semaine"
              ranked
              load={(signal) => browseAnime({ sort: 'TRENDING_DESC', perPage: 18, signal })}
            />
            <Rail
              title={`Saison ${SEASON_LABEL[season] ?? season} ${year}`}
              kicker="今季"
              subtitle="Les sorties en cours de diffusion"
              load={(signal) =>
                browseAnime({
                  sort: 'POPULARITY_DESC',
                  season,
                  seasonYear: year,
                  perPage: 18,
                  signal,
                })
              }
            />
            <Rail
              title="En diffusion"
              kicker="放送中"
              subtitle="Nouveaux épisodes chaque semaine"
              load={(signal) =>
                browseAnime({ sort: 'TRENDING_DESC', status: 'RELEASING', perPage: 18, signal })
              }
            />
          </>
        )}

        {tab === 'pour-toi' && <RecommendationRail />}

        {tab === 'classements' && (
          <>
            <Rail
              title={`Les meilleurs de ${year}`}
              kicker="年間"
              subtitle="Les mieux notés sortis cette année"
              ranked
              load={(signal) =>
                browseAnime({ sort: 'SCORE_DESC', seasonYear: year, perPage: 18, signal })
              }
            />
            <Rail
              title="Les plus aimés au monde"
              kicker="殿堂"
              subtitle="Classés par nombre de fans, toutes époques confondues"
              ranked
              load={(signal) => browseAnime({ sort: 'FAVOURITES_DESC', perPage: 18, signal })}
            />
            <Rail
              title="Les mieux notés"
              kicker="名作"
              subtitle="Le haut du panier, toutes époques confondues"
              ranked
              load={(signal) => browseAnime({ sort: 'SCORE_DESC', perPage: 18, signal })}
            />
          </>
        )}

        {tab === 'genres' && (
          <div className="space-y-7">
            <GenreFilter value={genre} onChange={setGenre} />
            {genre ? (
              <GenreResults key={genre} genre={genre} />
            ) : (
              <EmptyState
                icon={<Compass size={22} />}
                title="Choisis un genre"
                description="Sélectionne un genre ci-dessus pour parcourir le catalogue, du plus populaire au moins connu."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Surprends-moi" — jumps to a random well-rated title the user has not seen.
 * Picks a random page rather than a random index, so results actually vary.
 */
function SurpriseButton() {
  const navigate = useNavigate();
  const { isInLibrary, cacheAnimes, settings } = useWatchlist();
  const [loading, setLoading] = useState(false);

  const surprise = async () => {
    setLoading(true);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const page = 1 + Math.floor(Math.random() * 25);
        const result = await browseAnime({
          sort: 'POPULARITY_DESC',
          page,
          perPage: 25,
          adult: settings.adultContent,
        });
        cacheAnimes(result.items);

        const candidates = result.items.filter(
          (anime) => !isInLibrary(anime.id) && (anime.averageScore ?? 0) >= 65,
        );
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick) {
          navigate(`/anime/${pick.id}`);
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={() => void surprise()}>
      <Shuffle size={14} /> Surprends-moi
    </Button>
  );
}

function GenreFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (genre: string | null) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <FilterChip active={value === null} onClick={() => onChange(null)}>
        Tous
      </FilterChip>
      {GENRES.map((item) => (
        <FilterChip key={item} active={value === item} onClick={() => onChange(item)}>
          {item}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 cursor-pointer rounded-lg border px-3.5 text-xs font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color] duration-200',
        active
          ? 'border-brand/40 bg-brand/15 text-ink'
          : 'border-line bg-surface/60 text-ink-dim hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** One horizontally scrolling section, with its own loading and error states. */
function Rail({
  title,
  subtitle,
  kicker,
  ranked = false,
  load,
}: {
  title: string;
  subtitle: string;
  kicker?: string;
  ranked?: boolean;
  load: (signal: AbortSignal) => Promise<{ items: Anime[] }>;
}) {
  const { data, loading, error, reload } = useAsync((signal) => load(signal), [title]);
  useCacheAnimes(data?.items);

  return (
    <section>
      <SectionHeader title={title} kicker={kicker} subtitle={subtitle} />
      {loading && <RowSkeleton />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <ScrollRow>
          <AnimeRail animes={data?.items ?? []} ranked={ranked} />
        </ScrollRow>
      )}
    </section>
  );
}

/** "Because you watched…" — seeded by the user's best-rated and in-progress titles. */
function RecommendationRail() {
  const { joined, entries } = useWatchlist();

  const seeds = useMemo(() => {
    const rated = joined
      .filter((entry) => entry.user.rating != null)
      .sort((a, b) => (b.user.rating ?? 0) - (a.user.rating ?? 0));
    const watching = joined
      .filter((entry) => entry.user.status === 'watching')
      .sort((a, b) => b.user.updatedAt.localeCompare(a.user.updatedAt));

    const ids: number[] = [];
    for (const entry of [...rated, ...watching, ...joined]) {
      if (!ids.includes(entry.anime.id)) ids.push(entry.anime.id);
      if (ids.length === 3) break;
    }
    return ids;
  }, [joined]);

  const exclude = useMemo(() => new Set(entries.map((e) => e.animeId)), [entries]);
  const seedKey = seeds.join(',');

  const { data, loading, error, reload } = useAsync(
    (signal) => getRecommendationsFor(seeds, exclude, signal),
    [seedKey],
    { enabled: seeds.length > 0 },
  );
  useCacheAnimes(data);

  if (seeds.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Pour toi"
        kicker="おすすめ"
        subtitle="D’après les séries que tu as notées et regardées"
        action={
          <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <Sparkles size={12} /> personnalisé
          </span>
        }
      />
      {loading && <RowSkeleton />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) > 0 && (
        <ScrollRow>
          <AnimeRail animes={(data ?? []).slice(0, 20)} />
        </ScrollRow>
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <p className="text-sm text-ink-dim">
          Note quelques séries pour affiner les suggestions.
        </p>
      )}
    </section>
  );
}

/**
 * Genre view: a paginated grid rather than a rail.
 * Mounted with `key={genre}` so switching genre resets pagination for free.
 */
function GenreResults({ genre }: { genre: string }) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<Anime[]>([]);

  const { data, loading, error, reload } = useAsync(
    (signal) => browseAnime({ sort: 'POPULARITY_DESC', genre, page, perPage: 24, signal }),
    [genre, page],
    { keepPrevious: true },
  );
  useCacheAnimes(data?.items);

  useEffect(() => {
    if (!data) return;
    setAccumulated((current) => {
      if (data.page === 1) return data.items;
      const seen = new Set(current.map((a) => a.id));
      return [...current, ...data.items.filter((a) => !seen.has(a.id))];
    });
  }, [data]);

  if (error && accumulated.length === 0) return <ErrorState message={error} onRetry={reload} />;
  if (loading && accumulated.length === 0) return <CardGridSkeleton count={12} />;
  if (!loading && accumulated.length === 0) {
    return (
      <EmptyState
        icon={<Compass size={22} />}
        title="Aucun résultat"
        description={`Rien à afficher pour le genre « ${genre} ».`}
      />
    );
  }

  return (
    <div className="space-y-8">
      <AnimeGrid animes={accumulated} />
      {data?.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" loading={loading} onClick={() => setPage((p) => p + 1)}>
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}
