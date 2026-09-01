import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Anime, UserAnime } from '@/types';
import { Progress } from '@/components/ui/Progress';
import { progressPercent } from '@/lib/format';

/**
 * `−  Épisode 42  +` with a direct-entry field and a slider.
 * Every change is committed immediately — there is no save button anywhere.
 */
export function EpisodeStepper({
  entry,
  anime,
  onChange,
  className,
}: {
  entry: UserAnime;
  anime: Anime;
  onChange: (episode: number) => void;
  className?: string;
}) {
  const total = anime.episodes;
  const [draft, setDraft] = useState(String(entry.currentEpisode));

  // Keep the field in sync when the episode changes from elsewhere (+1 on a card).
  useEffect(() => setDraft(String(entry.currentEpisode)), [entry.currentEpisode]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(entry.currentEpisode));
      return;
    }
    const clamped = Math.max(0, total ? Math.min(parsed, total) : parsed);
    setDraft(String(clamped));
    if (clamped !== entry.currentEpisode) onChange(clamped);
  };

  const percent = progressPercent(entry, anime);
  const canDecrement = entry.currentEpisode > 0;
  const canIncrement = !total || entry.currentEpisode < total;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(entry.currentEpisode - 1)}
          disabled={!canDecrement}
          aria-label="Épisode précédent"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2 text-ink transition-[background-color,transform] duration-200 hover:bg-surface-3 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus size={16} />
        </button>

        <div className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3">
          <span className="shrink-0 text-xs text-ink-faint">Ép.</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label="Épisode actuel"
            className="tnum w-12 bg-transparent text-center text-base font-semibold text-ink outline-none"
          />
          <span className="tnum shrink-0 text-xs text-ink-faint">/ {total ?? '?'}</span>
        </div>

        <button
          type="button"
          onClick={() => onChange(entry.currentEpisode + 1)}
          disabled={!canIncrement}
          aria-label="Épisode suivant"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand text-white transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>

      {total ? (
        <>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={entry.currentEpisode}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label="Progression par épisode"
            className="h-11 w-full cursor-pointer accent-[var(--color-brand)]"
          />
          <div className="flex items-center gap-3">
            <Progress value={percent} className="h-1.5" />
            <span className="tnum shrink-0 text-xs font-medium text-ink-dim">{percent}%</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-faint">
          Nombre total d'épisodes inconnu — la progression reste libre.
        </p>
      )}
    </div>
  );
}
