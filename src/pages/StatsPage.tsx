import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Clock, Film, Layers, Star } from 'lucide-react';
import { useStatistics } from '@/hooks/useStatistics';
import { useWatchlist } from '@/hooks/useWatchlist';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTitle } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Poster } from '@/components/ui/Poster';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { STATUS_DOT } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { displayTitle, formatNumber, formatRating, formatWatchTime } from '@/lib/format';

// Recharts is the heaviest dependency in the app — it only loads on this route.
const StatsCharts = lazy(() => import('@/components/stats/StatsCharts'));

export default function StatsPage() {
  const stats = useStatistics();
  const { entries, settings, ready } = useWatchlist();

  if (ready && entries.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader />
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Pas encore de statistiques"
          description="Ajoute des séries et enregistre ta progression : les graphiques se construisent tout seuls."
          action={
            <Link
              to="/discover"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
            >
              Découvrir des animes
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat
          icon={<Clock size={15} />}
          value={formatWatchTime(stats.watchMinutes)}
          label="Temps de visionnage"
          hint={`≈ ${formatNumber(Math.round(stats.watchMinutes / 60))} heures`}
        />
        <BigStat
          icon={<Film size={15} />}
          value={formatNumber(stats.episodesWatched)}
          label="Épisodes vus"
          hint={`${stats.recentEpisodes} sur les 30 derniers jours`}
        />
        <BigStat
          icon={<Layers size={15} />}
          value={formatNumber(stats.totalAnime)}
          label="Séries suivies"
          hint={`${stats.counts.completed} terminées`}
        />
        <BigStat
          icon={<Star size={15} />}
          value={stats.averageRating != null ? formatRating(stats.averageRating) : '—'}
          label="Note moyenne"
          hint={
            stats.ratedCount > 0 ? `sur ${stats.ratedCount} série(s) notée(s)` : 'aucune note encore'
          }
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Répartition</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              to={STATUS_META[status].route}
              className="rounded-xl border border-line bg-surface/60 p-4 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
            >
              <span className="flex items-center gap-2 text-xs text-ink-dim">
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} aria-hidden />
                {STATUS_META[status].label}
              </span>
              <p className="tnum mt-2 text-2xl font-semibold text-ink">{stats.counts[status]}</p>
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<ChartsSkeleton />}>
        <StatsCharts stats={stats} />
      </Suspense>

      {stats.bestRated.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink">Tes meilleures notes</h2>
          <ol className="space-y-2">
            {stats.bestRated.map(({ user, anime }, index) => (
              <li key={anime.id}>
                <Link
                  to={`/anime/${anime.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-2.5 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
                >
                  <span className="tnum w-5 shrink-0 text-center text-sm font-semibold text-ink-faint">
                    {index + 1}
                  </span>
                  <Poster
                    src={anime.poster}
                    alt=""
                    tint={anime.color}
                    className="w-9 shrink-0 rounded-md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {displayTitle(anime, settings.titleLanguage)}
                    </span>
                    <span className="tnum block text-[11px] text-ink-faint">
                      {anime.episodes ? `${anime.episodes} épisodes` : 'Nombre d’épisodes inconnu'}
                    </span>
                  </span>
                  <span className="tnum flex shrink-0 items-center gap-1 text-sm font-semibold text-warning">
                    <Star size={13} fill="currentColor" strokeWidth={0} />
                    {formatRating(user.rating)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <PageTitle
      kicker="統計"
      title="Statistiques"
      subtitle="Calculées à partir de ta progression enregistrée sur cet appareil."
    />
  );
}

function BigStat({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface/60 p-4">
      <span className="flex items-center text-ink-faint">{icon}</span>
      <p className="tnum mt-2 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-ink-dim">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-72 rounded-panel" />
      <Skeleton className="h-72 rounded-panel" />
    </div>
  );
}
