import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  ListPlus,
  Play,
  Plus,
  Star,
} from 'lucide-react';
import { getAnimeDetail } from '@/services/api/anime';
import { useAsync } from '@/hooks/useAsync';
import { useCacheAnimes, useWatchlist } from '@/hooks/useWatchlist';
import { Poster } from '@/components/ui/Poster';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/EmptyState';
import { ScrollRow } from '@/components/ui/ScrollRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AnimeRail } from '@/components/anime/AnimeGrid';
import { TrackingPanel } from '@/components/anime/TrackingPanel';
import { AddToListModal } from '@/components/anime/AddToListModal';
import { MyRating } from '@/components/anime/Rating';
import {
  AIRING_LABEL,
  FORMAT_LABEL,
  RELATION_LABEL,
  SEASON_LABEL,
  SOURCE_LABEL,
} from '@/lib/constants';
import {
  altTitle,
  communityScore,
  countdown,
  displayTitle,
  formatISODate,
  formatNumber,
} from '@/lib/format';
import type { Anime } from '@/types';

export default function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const animeId = Number(id);
  const navigate = useNavigate();
  const { getEntry, getAnime, settings, advance, setStatus } = useWatchlist();
  // `?add=1` lets the command palette hand off with the dialog already open.
  const [searchParams, setSearchParams] = useSearchParams();
  const [adding, setAdding] = useState(searchParams.get('add') === '1');

  const closeAdd = () => {
    setAdding(false);
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  };

  const { data, loading, error, reload } = useAsync(
    (signal) => getAnimeDetail(animeId, signal),
    [animeId],
    { enabled: Number.isFinite(animeId) },
  );

  // Show the cached copy immediately while the full record loads.
  const cached = getAnime(animeId);
  const anime: Anime | undefined = data ?? cached;
  const entry = getEntry(animeId);

  const relatedForCache = useMemo(
    () => [...(data?.recommendations ?? []), ...(data?.relations.map((r) => r.anime) ?? [])],
    [data],
  );
  useCacheAnimes(relatedForCache);

  if (!Number.isFinite(animeId)) {
    return <ErrorState message="Identifiant d’anime invalide." />;
  }

  if (!anime && loading) return <DetailSkeleton />;

  if (!anime) {
    return (
      <ErrorState
        message={error ?? 'Impossible de charger cette fiche.'}
        onRetry={reload}
      />
    );
  }

  const title = displayTitle(anime, settings.titleLanguage);
  const alt = altTitle(anime, settings.titleLanguage);
  const score = communityScore(anime.averageScore);
  const canAdvance = entry ? !anime.episodes || entry.currentEpisode < anime.episodes : false;

  return (
    <div className="-mt-6 space-y-10">
      {/* ------------------------------------------------------------ hero */}
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="relative h-56 overflow-hidden sm:h-72 lg:h-96">
          {anime.banner ? (
            <img
              src={anime.banner}
              alt=""
              aria-hidden
              fetchPriority="high"
              className="h-full w-full scale-105 object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${anime.color ?? '#4338ca'}66, var(--color-canvas))`,
              }}
              aria-hidden
            />
          )}

          {/* The series' own colour bleeds up from the bottom of the banner. */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 90% at 50% 105%, ${anime.color ?? '#4338ca'}4d, transparent 65%)`,
            }}
            aria-hidden
          />
          {/* Opaque enough at the bottom that a two-line title sits on canvas,
              not on the artwork. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/90 to-canvas/25"
            aria-hidden
          />

          {/* Native title as a watermark.
              It lives in the TOP band: the title block below is pulled up into
              the banner, so anything anchored to the bottom collided with it as
              soon as the romaji title wrapped onto two lines. Hidden on small
              screens, where there is no spare width at all. */}
          {anime.titleNative && (
            <p
              className="pointer-events-none absolute top-4 right-4 hidden max-w-[45%] truncate text-right text-3xl font-bold text-ink/[0.07] select-none sm:block lg:right-8 lg:text-4xl"
              style={{ fontFamily: 'var(--font-jp)' }}
              aria-hidden
            >
              {anime.titleNative}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="glass absolute top-4 left-4 flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-medium text-ink transition-colors duration-200 hover:bg-surface-2 sm:left-6 lg:left-8"
        >
          <ArrowLeft size={15} /> Retour
        </button>

        {/* `relative z-10` is load-bearing, not decoration.
            This block is pulled up into the banner, and the banner's gradient
            layers are absolutely positioned — so by CSS painting order they
            covered this statically-positioned content even though it comes
            later in the DOM. The first title line and the badges were being
            painted over, which read as a title sliced at the banner edge. */}
        <div className="relative z-10 mx-auto -mt-24 max-w-[112rem] px-4 sm:-mt-28 sm:px-6 lg:-mt-32 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <Poster
              src={anime.poster}
              alt={title}
              eager
              tint={anime.color}
              className="w-32 shrink-0 rounded-card border border-line/60 shadow-pop sm:w-40 lg:w-48"
            />

            <div className="min-w-0 flex-1 pb-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {entry?.rating != null && <MyRating value={entry.rating} size="md" />}
                {entry && <StatusBadge status={entry.status} />}
                {anime.airingStatus && (
                  <Badge tone={anime.airingStatus === 'RELEASING' ? 'brand' : 'neutral'}>
                    {AIRING_LABEL[anime.airingStatus] ?? anime.airingStatus}
                  </Badge>
                )}
                {/* Neutral, and labelled: gold + star is reserved for the
                    user's own score, otherwise the two read as duplicates. */}
                {score && (
                  <Badge tone="neutral" className="gap-1.5">
                    <Star size={10} fill="currentColor" strokeWidth={0} className="text-ink-faint" />
                    <span className="tnum text-ink">{score}</span>
                    <span className="text-ink-faint">communauté</span>
                  </Badge>
                )}
              </div>

              {/* The shadow keeps long titles legible if they ride up over a
                  bright banner before the gradient takes over. */}
              <h1 className="text-3xl leading-[1.15] font-bold tracking-tight text-ink [text-shadow:0_2px_16px_rgba(0,0,0,0.75)] sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              {alt && <p className="mt-2 text-base text-ink-dim">{alt}</p>}

              <p className="mt-3 text-xs text-ink-dim">
                {[
                  anime.year,
                  anime.season ? (SEASON_LABEL[anime.season] ?? anime.season) : null,
                  anime.format ? (FORMAT_LABEL[anime.format] ?? anime.format) : null,
                  anime.episodes ? `${anime.episodes} épisodes` : null,
                  anime.studio,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {entry ? (
                  <>
                    <button
                      type="button"
                      disabled={!canAdvance}
                      onClick={() => advance(anime)}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-soft transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play size={15} fill="currentColor" strokeWidth={0} />
                      Continuer — ép. {entry.currentEpisode + 1}
                    </button>
                    {entry.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => setStatus(anime, 'completed')}
                        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-3"
                      >
                        <Check size={15} /> Terminé
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-soft transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-[0.98]"
                  >
                    <ListPlus size={15} /> Ajouter à ma liste
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/8 px-4 py-3 text-xs text-warning">
          <CircleAlert size={14} /> Données partielles : {error}
        </p>
      )}

      {/* --------------------------------------------------------- content */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          {anime.synopsis && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Synopsis</h2>
              <p className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-line text-ink-dim">
                {anime.synopsis}
              </p>
            </section>
          )}

          {entry ? (
            <section className="rounded-panel border border-line bg-surface/50 p-5 sm:p-6">
              <h2 className="mb-5 text-lg font-semibold text-ink">Mon suivi</h2>
              <TrackingPanel anime={anime} entry={entry} />
            </section>
          ) : (
            <section className="rounded-panel border border-dashed border-line px-5 py-8 text-center">
              <p className="text-sm text-ink-dim">
                Ajoute cette série à ta liste pour suivre ta progression, ta note et tes notes
                personnelles.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-4 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
              >
                <Plus size={15} /> Ajouter à ma liste
              </button>
            </section>
          )}

          {data && data.relations.length > 0 && (
            <section>
              <SectionHeader title="Dans la même série" subtitle="Préquelles, suites et dérivés" />
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.relations.map(({ relation, anime: related }) => (
                  <li key={`${relation}-${related.id}`}>
                    <Link
                      to={`/anime/${related.id}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-2.5 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
                    >
                      <Poster
                        src={related.poster}
                        alt=""
                        tint={related.color}
                        className="w-10 shrink-0 rounded-md"
                      />
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold tracking-wide text-brand-bright uppercase">
                          {RELATION_LABEL[relation] ?? relation}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink">
                          {displayTitle(related, settings.titleLanguage)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.recommendations.length > 0 && (
            <section>
              <SectionHeader title="Si tu aimes ça" subtitle="Recommandations de la communauté" />
              <ScrollRow>
                <AnimeRail animes={data.recommendations} />
              </ScrollRow>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {anime.nextEpisode && (
            <div className="rounded-panel border border-brand/25 bg-brand/8 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-brand-bright uppercase">
                <Clock size={12} /> Prochain épisode
              </p>
              <p className="mt-2 text-sm font-medium text-ink">
                Épisode {anime.nextEpisode.episode}
              </p>
              <p className="tnum mt-0.5 text-xs text-ink-dim">
                {countdown(anime.nextEpisode.airingAt)} ·{' '}
                {new Intl.DateTimeFormat('fr-FR', {
                  weekday: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(anime.nextEpisode.airingAt * 1000))}
              </p>
            </div>
          )}

          <div className="rounded-panel border border-line bg-surface/50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Informations</h2>
            <dl className="space-y-2.5 text-xs">
              <Info label="Format" value={anime.format ? (FORMAT_LABEL[anime.format] ?? anime.format) : null} />
              <Info label="Épisodes" value={anime.episodes ? String(anime.episodes) : null} />
              <Info label="Durée" value={anime.duration ? `${anime.duration} min / ép.` : null} />
              <Info label="Studio" value={anime.studio} />
              <Info
                label="Source"
                value={anime.source ? (SOURCE_LABEL[anime.source] ?? anime.source) : null}
              />
              <Info label="Début" value={formatISODate(anime.startDate)} />
              <Info label="Fin" value={formatISODate(anime.endDate)} />
              <Info
                label="Popularité"
                value={anime.popularity ? `${formatNumber(anime.popularity)} membres` : null}
              />
            </dl>

            {anime.genres.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-[11px] font-medium text-ink-faint">Genres</p>
                <div className="flex flex-wrap gap-1.5">
                  {anime.genres.map((genre) => (
                    <Badge key={genre}>{genre}</Badge>
                  ))}
                </div>
              </div>
            )}

            {anime.siteUrl && (
              <a
                href={anime.siteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-dim transition-colors duration-200 hover:text-brand-bright"
              >
                Voir sur AniList <ExternalLink size={12} />
              </a>
            )}
          </div>
        </aside>
      </div>

      {!entry && (
        <AddToListModal anime={anime} open={adding} onClose={closeAdd} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-faint">{label}</dt>
      <dd className="truncate text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="-mt-6 space-y-10">
      <Skeleton className="-mx-4 h-52 rounded-none sm:-mx-6 sm:h-64 lg:-mx-8 lg:h-80" />
      <div className="flex gap-5">
        <Skeleton className="h-56 w-32 shrink-0 rounded-card sm:w-40 lg:w-48" />
        <div className="flex-1 space-y-3 pt-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-11 w-56 rounded-xl" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-9/12" />
      </div>
    </div>
  );
}
