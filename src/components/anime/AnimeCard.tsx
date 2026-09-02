import { memo, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Ellipsis, ListPlus, Plus, Star } from 'lucide-react';
import type { Anime, UserAnime } from '@/types';
import { cn } from '@/lib/cn';
import { Poster } from '@/components/ui/Poster';
import { StatusBadge, STATUS_DOT } from '@/components/ui/Badge';
import { MyRating } from './Rating';
import { EditEntryModal } from './EditEntryModal';
import { AddToListModal } from './AddToListModal';
import { useWatchlist } from '@/hooks/useWatchlist';
import { altTitle, communityScore, displayTitle, progressPercent } from '@/lib/format';
import { FORMAT_LABEL } from '@/lib/constants';

/** Stops a quick action from following the card's link. */
function swallow(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export const AnimeCard = memo(function AnimeCard({
  anime,
  entry,
  eager = false,
  rank,
  className,
}: {
  anime: Anime;
  entry?: UserAnime;
  eager?: boolean;
  /** 1-based position, shown as a large ghosted digit on ranked rails. */
  rank?: number;
  className?: string;
}) {
  const { settings, advance, setStatus } = useWatchlist();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const title = displayTitle(anime, settings.titleLanguage);
  const alt = altTitle(anime, settings.titleLanguage);
  const score = communityScore(anime.averageScore);
  const percent = entry ? progressPercent(entry, anime) : 0;
  const canAdvance = entry ? !anime.episodes || entry.currentEpisode < anime.episodes : false;

  return (
    <article className={cn('group relative', className)}>
      <Link
        to={`/anime/${anime.id}`}
        className="block rounded-card focus-visible:outline-offset-4"
        aria-label={title}
      >
        <div
          className={cn(
            'glow-tint relative overflow-hidden rounded-card border border-line bg-surface shadow-soft',
            'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-soft)]',
            'group-hover:-translate-y-1.5 group-hover:border-line-strong group-hover:shadow-lift',
          )}
          // The cover colour AniList extracted becomes this card's own light.
          style={anime.color ? ({ '--glow': anime.color } as CSSProperties) : undefined}
        >
          <Poster
            src={anime.poster}
            alt=""
            eager={eager}
            tint={anime.color}
            imgClassName="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.06]"
          />

          {/* Permanent cinematic wash so text and badges always stay legible. */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent"
            aria-hidden
          />

          {score && (
            <span className="tnum absolute top-2 right-2 flex items-center gap-0.5 rounded-md border border-white/10 bg-black/75 px-1.5 py-1 text-[11px] font-bold text-ink backdrop-blur-sm">
              <Star size={9} fill="currentColor" strokeWidth={0} className="text-warning" />
              {score}
            </span>
          )}

          {rank != null && (
            <span
              className="rank-digit pointer-events-none absolute bottom-1 left-1.5 text-4xl select-none"
              aria-hidden
            >
              {rank}
            </span>
          )}

          {/* Prime slot: the user's own score when they have set one, otherwise
              the status. The status stays visible either way, as a dot below. */}
          {entry?.rating != null ? (
            <span className="absolute top-2 left-2">
              <MyRating value={entry.rating} size="md" onPoster />
            </span>
          ) : entry ? (
            <span className="absolute top-2 left-2">
              <StatusBadge status={entry.status} className="bg-black/70 backdrop-blur-sm" />
            </span>
          ) : null}

          {/* Desktop hover layer — never the only route to these actions. */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 hidden flex-col gap-2 p-2.5 lg:flex',
              'translate-y-2 opacity-0 transition-[opacity,transform] duration-250 ease-[var(--ease-out-soft)]',
              'group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100',
              'group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100',
            )}
          >
            {entry ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={(event) => {
                    swallow(event);
                    advance(anime);
                  }}
                  className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand text-xs font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus size={14} /> 1 ép.
                </button>
                <button
                  type="button"
                  aria-label="Marquer comme terminé"
                  title="Marquer comme terminé"
                  onClick={(event) => {
                    swallow(event);
                    setStatus(anime, 'completed');
                  }}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/60 text-ink backdrop-blur-sm transition-[background-color,transform] duration-200 hover:bg-black/80 active:scale-95"
                >
                  <Check size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  swallow(event);
                  setAdding(true);
                }}
                className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand text-xs font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95"
              >
                <ListPlus size={14} /> Ajouter
              </button>
            )}
          </div>

          {/* Touch devices get one always-visible primary action instead of hover:
              advance the episode, or open the add dialog for a new series. */}
          {entry && canAdvance && (
            <button
              type="button"
              aria-label={`Épisode ${entry.currentEpisode + 1}`}
              onClick={(event) => {
                swallow(event);
                advance(anime);
              }}
              className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand/95 text-white shadow-lift transition-transform duration-200 active:scale-90 lg:hidden"
            >
              <Plus size={16} />
            </button>
          )}

          {!entry && (
            <button
              type="button"
              aria-label={`Ajouter ${title} à ma liste`}
              onClick={(event) => {
                swallow(event);
                setAdding(true);
              }}
              className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand/95 text-white shadow-lift transition-transform duration-200 active:scale-90 lg:hidden"
            >
              <ListPlus size={15} />
            </button>
          )}

          {entry && anime.episodes ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/55">
              <div
                className="h-full origin-left bg-gradient-to-r from-brand to-brand-bright transition-transform duration-500 ease-[var(--ease-out-soft)]"
                style={{ width: '100%', transform: `scaleX(${percent / 100})` }}
              />
            </div>
          ) : null}
        </div>
      </Link>

      <div className="mt-3 min-w-0">
        <Link
          to={`/anime/${anime.id}`}
          className="line-clamp-2 text-sm leading-snug font-semibold text-ink transition-colors duration-200 hover:text-brand-bright"
        >
          {title}
        </Link>

        {alt && <p className="mt-1 line-clamp-1 text-xs text-ink-faint">{alt}</p>}

        <div className="mt-1.5 flex items-center justify-between gap-2">
          {entry ? (
            <p className="tnum flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-ink-dim">
              <span
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[entry.status])}
                aria-hidden
              />
              <span className="truncate">
                <span className="text-ink">{entry.currentEpisode}</span>
                {anime.episodes ? (
                  <>
                    <span className="text-ink-faint"> / {anime.episodes}</span>
                    <span className="text-ink-faint"> · {percent}%</span>
                  </>
                ) : (
                  <span className="text-ink-faint"> épisodes</span>
                )}
              </span>
            </p>
          ) : (
            <p className="truncate text-xs text-ink-dim">
              {[anime.year, anime.format ? (FORMAT_LABEL[anime.format] ?? anime.format) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {/* Noter / annoter doit rester atteignable sans survol : ce bouton est
              visible en permanence, sur toutes les tailles d'écran. */}
          {entry && (
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label={`Noter et annoter ${title}`}
                title="Note, épisodes, arc et notes personnelles"
                onClick={() => setEditing(true)}
                // 28px visually, but the pseudo-element extends the tap area to
                // 44px so it clears the touch-target minimum on phones.
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line text-ink-faint transition-[background-color,border-color,color] duration-200 after:absolute after:-inset-2.5 after:content-[''] hover:border-line-strong hover:bg-surface-2 hover:text-ink"
              >
                <Ellipsis size={14} />
              </button>
            </span>
          )}
        </div>
      </div>

      {entry ? (
        <EditEntryModal
          anime={anime}
          entry={entry}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : (
        <AddToListModal anime={anime} open={adding} onClose={() => setAdding(false)} />
      )}
    </article>
  );
});
