import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Compass, Flame, ListVideo, Play, Sparkles, Trophy } from 'lucide-react';
import { useCacheAnimes, useContinueWatching, useWatchlist } from '@/hooks/useWatchlist';
import { useStatistics } from '@/hooks/useStatistics';
import { useAsync } from '@/hooks/useAsync';
import { browseAnime, type BrowseSort } from '@/services/api/anime';
import { ContinueCard } from '@/components/anime/ContinueCard';
import { AnimeRail } from '@/components/anime/AnimeGrid';
import { ScrollRow } from '@/components/ui/ScrollRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { formatCompactWatchTime } from '@/lib/format';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Bonne nuit';
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default function HomePage() {
  const { joined, byStatus, counts, ready } = useWatchlist();
  const stats = useStatistics();
  const continueWatching = useContinueWatching(8);

  const upNext = useMemo(
    () =>
      [...(byStatus.get('planned') ?? [])]
        .sort((a, b) => b.user.addedAt.localeCompare(a.user.addedAt))
        .slice(0, 12),
    [byStatus],
  );

  const recentlyCompleted = useMemo(
    () =>
      [...(byStatus.get('completed') ?? [])]
        .filter((entry) => entry.user.completedAt)
        .sort((a, b) => (b.user.completedAt ?? '').localeCompare(a.user.completedAt ?? ''))
        .slice(0, 12),
    [byStatus],
  );

  const isEmpty = ready && joined.length === 0;

  // Newcomers land on something alive rather than five empty sections.
  const trending = useAsync(
    (signal) => browseAnime({ sort: 'TRENDING_DESC', perPage: 12, signal }),
    [],
    { enabled: isEmpty },
  );

  useCacheAnimes(trending.data?.items);

  return (
    <div className="space-y-12">
      <header className="animate-fade">
        <p className="kicker-jp mb-1.5 text-[11px]" aria-hidden>
          ホーム
        </p>
        <p className="text-sm text-ink-dim">{greeting()}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {continueWatching.length > 0
            ? 'Reprends où tu t’es arrêté'
            : 'Ta bibliothèque personnelle'}
        </h1>

        {!isEmpty && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              icon={<Play size={14} />}
              value={counts.watching}
              label="en cours"
              to="/library/watching"
            />
            <MiniStat
              icon={<Flame size={14} />}
              value={stats.recentEpisodes}
              label="ép. sur 30 j"
              to="/stats"
            />
            <MiniStat
              icon={<Clock size={14} />}
              value={formatCompactWatchTime(stats.watchMinutes)}
              label="de visionnage"
              to="/stats"
            />
            <MiniStat
              icon={<Trophy size={14} />}
              value={counts.completed}
              label="terminés"
              to="/library/completed"
            />
          </div>
        )}
      </header>

      {isEmpty ? (
        <section className="space-y-10">
          <EmptyState
            icon={<Sparkles size={22} />}
            title="Commence ta collection"
            description="Cherche un anime avec ⌘K, ou pioche directement dans les tendances du moment. Tout est enregistré sur cet appareil."
            action={
              <Link
                to="/discover"
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
              >
                <Compass size={15} /> Explorer le catalogue
              </Link>
            }
          />

          <section>
            <SectionHeader
              title="Tendances du moment"
              kicker="人気"
              subtitle="Les séries que tout le monde regarde"
              to="/discover"
            />
            {trending.loading ? (
              <RowSkeleton />
            ) : (
              <ScrollRow>
                <AnimeRail animes={trending.data?.items ?? []} ranked />
              </ScrollRow>
            )}
          </section>
        </section>
      ) : (
        <>
          {continueWatching.length > 0 && (
            <section>
              <SectionHeader
                title="En cours"
                kicker="視聴中"
                subtitle="Un clic sur Continuer enregistre l’épisode suivant"
                to="/library/watching"
              />
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {continueWatching.map((entry, index) => (
                  <ContinueCard key={entry.anime.id} entry={entry} eager={index < 3} />
                ))}
              </div>
            </section>
          )}

          {upNext.length > 0 && (
            <section>
              <SectionHeader
                title="À regarder ensuite"
                kicker="予定"
                subtitle="Ta pile de séries en attente"
                to="/library/planned"
              />
              <ScrollRow>
                <AnimeRail animes={upNext.map((entry) => entry.anime)} />
              </ScrollRow>
            </section>
          )}

          {recentlyCompleted.length > 0 && (
            <section>
              <SectionHeader
                title="Terminés récemment"
                kicker="完了"
                subtitle="Pense à leur mettre une note"
                to="/library/completed"
              />
              <ScrollRow>
                <AnimeRail animes={recentlyCompleted.map((entry) => entry.anime)} />
              </ScrollRow>
            </section>
          )}

          <HomeRail
            title={`Les meilleurs de ${new Date().getFullYear()}`}
            kicker="年間"
            subtitle="Les mieux notés sortis cette année"
            sort="SCORE_DESC"
            seasonYear={new Date().getFullYear()}
          />

          <HomeRail
            title="Les plus aimés au monde"
            kicker="殿堂"
            subtitle="Le panthéon, classé par nombre de fans"
            sort="FAVOURITES_DESC"
          />

          {continueWatching.length === 0 && (
            <EmptyState
              icon={<ListVideo size={22} />}
              title="Aucune série en cours"
              description="Lance une série depuis ta liste « À regarder » ou découvre de nouveaux titres."
              action={
                <Link
                  to="/discover"
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
                >
                  <Compass size={15} /> Découvrir
                </Link>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/** A catalogue rail on the home page — loads only once the personal content is set. */
function HomeRail({
  title,
  kicker,
  subtitle,
  sort,
  seasonYear,
}: {
  title: string;
  kicker: string;
  subtitle: string;
  sort: BrowseSort;
  seasonYear?: number;
}) {
  const { data, loading } = useAsync(
    (signal) => browseAnime({ sort, seasonYear, perPage: 16, signal }),
    [sort, seasonYear],
  );
  useCacheAnimes(data?.items);

  return (
    <section>
      <SectionHeader title={title} kicker={kicker} subtitle={subtitle} to="/discover" />
      {loading ? (
        <RowSkeleton />
      ) : (
        <ScrollRow>
          <AnimeRail animes={data?.items ?? []} ranked />
        </ScrollRow>
      )}
    </section>
  );
}

function MiniStat({
  icon,
  value,
  label,
  to,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-line bg-surface/60 px-3.5 py-3 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
    >
      <span className="flex items-center gap-1.5 text-ink-faint transition-colors duration-200 group-hover:text-brand-bright">
        {icon}
      </span>
      <p className="tnum mt-1.5 text-xl font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-ink-dim">{label}</p>
    </Link>
  );
}
