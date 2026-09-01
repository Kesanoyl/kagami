import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis, Play, Sparkles } from 'lucide-react';
import type { LibraryEntry } from '@/types';
import { Poster } from '@/components/ui/Poster';
import { Progress } from '@/components/ui/Progress';
import { EditEntryModal } from './EditEntryModal';
import { MyRating } from './Rating';
import { useWatchlist } from '@/hooks/useWatchlist';
import { displayTitle, progressPercent } from '@/lib/format';
import { pendingEpisodes } from '@/lib/progress';

/**
 * The single most important element of the app: one tap resumes a series.
 * "Continuer" advances the counter by one and saves immediately.
 */
export function ContinueCard({ entry: { user, anime }, eager = false }: { entry: LibraryEntry; eager?: boolean }) {
  const { settings, advance } = useWatchlist();
  const [editing, setEditing] = useState(false);

  const title = displayTitle(anime, settings.titleLanguage);
  const percent = progressPercent(user, anime);
  const next = user.currentEpisode + 1;
  const finished = anime.episodes != null && user.currentEpisode >= anime.episodes;
  const pending = pendingEpisodes(user, anime);

  return (
    <article
      className="glow-tint group relative overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,transform] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-line-strong"
      style={anime.color ? ({ '--glow': anime.color } as CSSProperties) : undefined}
    >
      {/* A thin colour seam on the leading edge, drawn from the cover art. */}
      <span
        className="absolute inset-y-0 left-0 w-0.5"
        style={{ background: anime.color ?? 'var(--color-brand)' }}
        aria-hidden
      />
      {anime.banner && (
        <img
          src={anime.banner}
          alt=""
          aria-hidden
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 transition-[opacity,transform] duration-500 ease-[var(--ease-out-soft)] group-hover:scale-105 group-hover:opacity-35"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/60"
        aria-hidden
      />

      <div className="relative flex items-center gap-3.5 p-3.5">
        <Link to={`/anime/${anime.id}`} className="shrink-0" aria-label={title}>
          <Poster
            src={anime.poster}
            alt=""
            eager={eager}
            tint={anime.color}
            className="w-16 rounded-lg shadow-soft sm:w-[4.5rem]"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Link
                to={`/anime/${anime.id}`}
                className="line-clamp-1 text-base font-semibold text-ink transition-colors duration-200 hover:text-brand-bright"
              >
                {title}
              </Link>
              {user.rating != null && <MyRating value={user.rating} size="sm" />}
            </span>
            {pending > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-bright">
                <Sparkles size={10} /> {pending} nouv.
              </span>
            )}
          </div>

          <p className="tnum mt-1.5 text-xs text-ink-dim">
            Épisode <span className="font-semibold text-ink">{user.currentEpisode}</span>
            {anime.episodes ? ` / ${anime.episodes}` : ''}
            {user.currentArc && <span className="text-ink-faint"> · {user.currentArc}</span>}
          </p>

          <div className="mt-2.5 flex items-center gap-3">
            <Progress value={percent} className="h-1" />
            <span className="tnum shrink-0 text-[11px] font-medium text-ink-faint">{percent}%</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={finished}
            onClick={() => advance(anime)}
            aria-label={`Continuer — épisode ${next}`}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white shadow-soft transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:px-4"
          >
            <Play size={14} fill="currentColor" strokeWidth={0} />
            <span className="hidden sm:inline">Continuer</span>
            <span className="tnum sm:hidden">{next}</span>
          </button>

          {/* Noter / annoter sans quitter l'accueil. */}
          <button
            type="button"
            aria-label={`Noter et annoter ${title}`}
            title="Note, épisodes, arc et notes personnelles"
            onClick={() => setEditing(true)}
            className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-xl border border-line text-ink-faint transition-[background-color,border-color,color] duration-200 hover:border-line-strong hover:bg-surface-2 hover:text-ink"
          >
            <Ellipsis size={16} />
          </button>
        </div>
      </div>

      <EditEntryModal
        anime={anime}
        entry={user}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </article>
  );
}
