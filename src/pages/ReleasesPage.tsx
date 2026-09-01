import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Globe, Radio, Sparkles } from 'lucide-react';
import { getRecentAirings } from '@/services/api/anime';
import { useAsync } from '@/hooks/useAsync';
import { useCacheAnimes, useWatchlist } from '@/hooks/useWatchlist';
import { Poster } from '@/components/ui/Poster';
import { PageTitle, SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { RowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ScrollRow } from '@/components/ui/ScrollRow';
import { AnimeRail } from '@/components/anime/AnimeGrid';
import { StatusBadge } from '@/components/ui/Badge';
import { MyRating } from '@/components/anime/Rating';
import { cn } from '@/lib/cn';
import { communityScore, displayTitle, formatNumber, relativeTime } from '@/lib/format';
import type { AiredEpisode } from '@/types';

const WINDOWS = [
  { hours: 24, label: '24 h' },
  { hours: 72, label: '3 jours' },
  { hours: 168, label: '7 jours' },
] as const;

export default function ReleasesPage() {
  const { entries, settings, ready } = useWatchlist();
  const [hours, setHours] = useState<number>(72);

  const trackedIds = useMemo(() => entries.map((e) => e.animeId), [entries]);
  const idsKey = trackedIds.join(',');

  return (
    <div className="space-y-12">
      <PageTitle
        kicker="最新話"
        title="Dernières sorties"
        subtitle="Les épisodes déjà diffusés — les tiens d’abord, puis tout le reste."
        action={
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Période">
            <Link
              to="/calendar"
              className="mr-1 flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-3 text-xs font-medium text-ink-dim transition-[background-color,border-color,color] duration-200 hover:border-line-strong hover:bg-surface-2 hover:text-ink"
            >
              <CalendarDays size={13} /> À venir
            </Link>
            {WINDOWS.map((window) => (
              <button
                key={window.hours}
                type="button"
                aria-pressed={hours === window.hours}
                onClick={() => setHours(window.hours)}
                className={cn(
                  'h-9 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-[background-color,border-color,color] duration-200',
                  hours === window.hours
                    ? 'border-brand/40 bg-brand/15 text-ink'
                    : 'border-line bg-surface/60 text-ink-dim hover:border-line-strong hover:text-ink',
                )}
              >
                {window.label}
              </button>
            ))}
          </div>
        }
      />

      {ready && trackedIds.length > 0 && (
        <MyReleases ids={trackedIds} idsKey={idsKey} hours={hours} />
      )}

      <WorldReleases hours={hours} adult={settings.adultContent} />
    </div>
  );
}

/** Episodes of the user's own series, with a one-click "mark as watched". */
function MyReleases({ ids, idsKey, hours }: { ids: number[]; idsKey: string; hours: number }) {
  const { getEntry, setEpisode, settings } = useWatchlist();

  const { data, loading, error, reload } = useAsync(
    (signal) =>
      getRecentAirings({ ids, hours, perPage: 50, adult: settings.adultContent, signal }),
    [idsKey, hours],
  );
  useCacheAnimes(useMemo(() => data?.map((item) => item.anime) ?? [], [data]));

  // Keep only the newest episode per series, and only those not yet watched.
  const unwatched = useMemo(() => {
    if (!data) return [];
    const best = new Map<number, AiredEpisode>();
    for (const item of data) {
      const current = best.get(item.anime.id);
      if (!current || item.episode > current.episode) best.set(item.anime.id, item);
    }
    return [...best.values()]
      .filter((item) => {
        const entry = getEntry(item.anime.id);
        return entry ? entry.status !== 'dropped' && entry.currentEpisode < item.episode : false;
      })
      .sort((a, b) => b.airingAt - a.airingAt);
  }, [data, getEntry]);

  return (
    <section>
      <SectionHeader
        title="Dans mes séries"
        kicker="自分の"
        subtitle="Épisodes sortis que tu n’as pas encore marqués"
        action={
          unwatched.length > 0 ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-danger/12 px-2.5 py-1.5 text-[11px] font-semibold text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              {unwatched.length} à rattraper
            </span>
          ) : undefined
        }
      />

      {loading && (
        <div className="grid gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
          ))}
        </div>
      )}

      {error && !loading && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && unwatched.length === 0 && (
        <div className="flex items-center gap-3 rounded-panel border border-line bg-surface/40 px-5 py-6">
          <Check size={18} className="shrink-0 text-st-completed" />
          <p className="text-sm text-ink-dim">
            Tu es à jour sur toutes tes séries pour cette période.
          </p>
        </div>
      )}

      {!loading && !error && unwatched.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {unwatched.map((item) => {
            const entry = getEntry(item.anime.id);
            const behind = entry ? item.episode - entry.currentEpisode : 0;

            return (
              <li
                key={item.anime.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2.5 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
              >
                <Link to={`/anime/${item.anime.id}`} className="shrink-0">
                  <Poster
                    src={item.anime.poster}
                    alt=""
                    tint={item.anime.color}
                    className="w-11 rounded-md"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Link
                      to={`/anime/${item.anime.id}`}
                      className="truncate text-sm font-semibold text-ink transition-colors duration-200 hover:text-brand-bright"
                    >
                      {displayTitle(item.anime, settings.titleLanguage)}
                    </Link>
                    {entry?.rating != null && <MyRating value={entry.rating} size="sm" />}
                  </span>
                  <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-dim">
                    <span className="font-medium text-ink">Épisode {item.episode}</span>
                    <span className="text-ink-faint">{relativeTime(new Date(item.airingAt * 1000).toISOString())}</span>
                    {behind > 1 && (
                      <span className="text-warning">{behind} épisodes de retard</span>
                    )}
                  </p>
                </div>

                {entry && (
                  <button
                    type="button"
                    onClick={() => setEpisode(item.anime, item.episode)}
                    className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95"
                  >
                    <Check size={14} />
                    <span className="hidden sm:inline">Vu</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The worldwide feed, so new series can be discovered from what just aired. */
function WorldReleases({ hours, adult }: { hours: number; adult: boolean }) {
  const { isInLibrary, settings } = useWatchlist();
  const [hideKnown, setHideKnown] = useState(false);

  const { data, loading, error, reload } = useAsync(
    (signal) => getRecentAirings({ hours, perPage: 50, adult, signal }),
    [hours, adult],
  );
  useCacheAnimes(useMemo(() => data?.map((item) => item.anime) ?? [], [data]));

  const feed = useMemo(() => {
    if (!data) return [];
    const best = new Map<number, AiredEpisode>();
    for (const item of data) {
      const current = best.get(item.anime.id);
      if (!current || item.airingAt > current.airingAt) best.set(item.anime.id, item);
    }
    return [...best.values()]
      .filter((item) => !hideKnown || !isInLibrary(item.anime.id))
      .sort((a, b) => b.airingAt - a.airingAt);
  }, [data, hideKnown, isInLibrary]);

  // The most popular of the batch, surfaced as posters worth trying.
  const worthWatching = useMemo(
    () =>
      [...feed]
        .filter((item) => !isInLibrary(item.anime.id))
        .sort((a, b) => (b.anime.popularity ?? 0) - (a.anime.popularity ?? 0))
        .slice(0, 14)
        .map((item) => item.anime),
    [feed, isInLibrary],
  );

  return (
    <>
      {worthWatching.length > 0 && !loading && (
        <section>
          <SectionHeader
            title="Sorties à ne pas manquer"
            kicker="注目"
            subtitle="Les séries les plus suivies parmi celles qui viennent de sortir un épisode"
            action={
              <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                <Sparkles size={12} /> pas encore dans ta liste
              </span>
            }
          />
          <ScrollRow>
            <AnimeRail animes={worthWatching} />
          </ScrollRow>
        </section>
      )}

      <section>
        <SectionHeader
          title="Tout ce qui vient de sortir"
          kicker="世界中"
          subtitle="Le flux mondial des épisodes diffusés"
          action={
            <button
              type="button"
              aria-pressed={hideKnown}
              onClick={() => setHideKnown((v) => !v)}
              className={cn(
                'h-9 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-[background-color,border-color,color] duration-200',
                hideKnown
                  ? 'border-brand/40 bg-brand/15 text-ink'
                  : 'border-line bg-surface/60 text-ink-dim hover:border-line-strong hover:text-ink',
              )}
            >
              Masquer ma liste
            </button>
          }
        />

        {loading && <RowSkeleton />}
        {error && !loading && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && feed.length === 0 && (
          <EmptyState
            icon={<Globe size={22} />}
            title="Rien sur cette période"
            description="Élargis la fenêtre à 3 ou 7 jours pour voir plus de sorties."
          />
        )}

        {!loading && !error && feed.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface/40">
            {feed.slice(0, 40).map((item) => (
              <li key={item.anime.id}>
                <Link
                  to={`/anime/${item.anime.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <Poster
                    src={item.anime.poster}
                    alt=""
                    tint={item.anime.color}
                    className="w-9 shrink-0 rounded"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {displayTitle(item.anime, settings.titleLanguage)}
                      </span>
                      {isInLibrary(item.anime.id) && <StatusBadge status="watching" dotOnly />}
                    </span>
                    <span className="tnum mt-0.5 block truncate text-[11px] text-ink-faint">
                      Épisode {item.episode} ·{' '}
                      {relativeTime(new Date(item.airingAt * 1000).toISOString())}
                      {item.anime.popularity
                        ? ` · ${formatNumber(item.anime.popularity)} membres`
                        : ''}
                    </span>
                  </span>
                  {communityScore(item.anime.averageScore) && (
                    <span className="tnum shrink-0 text-xs font-semibold text-ink-dim">
                      {communityScore(item.anime.averageScore)}
                    </span>
                  )}
                  <Radio size={13} className="shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
