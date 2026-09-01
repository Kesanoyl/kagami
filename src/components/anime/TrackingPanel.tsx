import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { NotebookPen, Trash2 } from 'lucide-react';
import type { Anime, UserAnime } from '@/types';
import { useWatchlist } from '@/hooks/useWatchlist';
import { EpisodeStepper } from './EpisodeStepper';
import { StatusPicker } from './StatusPicker';
import { RatingInput } from './Rating';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { relativeTime } from '@/lib/format';

/**
 * A text field that keeps its own draft and only commits after a pause or on
 * blur. Writing on every keystroke bumped `updatedAt`, which reshuffled the
 * "En cours" list on the home page while the user was still typing.
 */
function DraftInput({
  value,
  onCommit,
  ...props
}: {
  value: string;
  onCommit: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const commit = useRef(onCommit);
  const latest = useRef(draft);
  commit.current = onCommit;
  latest.current = draft;

  // Follow the stored value unless the user is mid-edit.
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    commit.current(latest.current);
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(flush, 500);
    return () => window.clearTimeout(timer);
  }, [draft, flush]);

  useEffect(() => () => flush(), [flush]);

  return (
    <Input
      {...props}
      value={draft}
      onChange={(event) => {
        dirty.current = true;
        setDraft(event.target.value);
      }}
      onBlur={flush}
    />
  );
}

/**
 * "Mon suivi" — the full editing surface for one entry.
 * Shared verbatim between the detail page and the quick-edit modal, so there is
 * exactly one implementation of the tracking rules in the UI.
 */
export function TrackingPanel({
  anime,
  entry,
  onRemoved,
}: {
  anime: Anime;
  entry: UserAnime;
  onRemoved?: () => void;
}) {
  const { setEpisode, setStatus, setRating, setNotes, patch, remove } = useWatchlist();

  const [notes, setNotesDraft] = useState(entry.notes);
  const [savedAt, setSavedAt] = useState(entry.notesUpdatedAt);
  const dirty = useRef(false);

  /**
   * Autosave.
   *
   * Everything the save needs is read from refs at call time. That matters:
   * `setNotes` is rebuilt whenever the library context changes, and an earlier
   * version of this effect listed it as a dependency — so each rebuild tore down
   * the pending timer and re-registered it with a stale `notes` closure. The net
   * effect was that the debounce never completed and an empty string was written
   * instead of the text. Refs keep the timer independent of render churn.
   */
  const latestNotes = useRef(notes);
  const latestAnimeId = useRef(entry.animeId);
  const saveNotes = useRef(setNotes);
  latestNotes.current = notes;
  latestAnimeId.current = entry.animeId;
  saveNotes.current = setNotes;

  const flushNotes = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    saveNotes.current(latestAnimeId.current, latestNotes.current);
    setSavedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(flushNotes, 600);
    return () => window.clearTimeout(timer);
  }, [notes, flushNotes]);

  // `flushNotes` is stable, so this cleanup runs on unmount only — closing the
  // modal or leaving the page always commits what was typed.
  useEffect(() => () => flushNotes(), [flushNotes]);

  // Pick up notes edited elsewhere, but never overwrite an in-progress edit.
  useEffect(() => {
    if (dirty.current) return;
    setNotesDraft(entry.notes);
    setSavedAt(entry.notesUpdatedAt);
  }, [entry.notes, entry.notesUpdatedAt]);

  return (
    <div className="space-y-7">
      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">Statut</h3>
        <StatusPicker value={entry.status} onChange={(status) => setStatus(anime, status)} />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Progression
        </h3>
        <EpisodeStepper
          entry={entry}
          anime={anime}
          onChange={(episode) => setEpisode(anime, episode)}
        />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Saison, partie et arc
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <DraftInput
            label="Saison"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="3"
            value={entry.currentSeason == null ? '' : String(entry.currentSeason)}
            onCommit={(value) => {
              const parsed = Number.parseInt(value, 10);
              patch(entry.animeId, {
                currentSeason: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
              });
            }}
          />
          <DraftInput
            label="Partie / cour"
            placeholder="Partie 2"
            value={entry.currentPart ?? ''}
            onCommit={(value) => patch(entry.animeId, { currentPart: value.trim() || null })}
          />
        </div>
        <div className="mt-3">
          <DraftInput
            label="Arc actuel"
            placeholder="Shibuya Incident Arc"
            value={entry.currentArc ?? ''}
            onCommit={(value) => patch(entry.animeId, { currentArc: value.trim() || null })}
            helper="Facultatif — utile pour reprendre exactement au bon endroit."
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Ma note
        </h3>
        <RatingInput value={entry.rating} onChange={(rating) => setRating(anime, rating)} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            <NotebookPen size={13} /> Mes notes
          </h3>
          <span className="text-[11px] text-ink-faint">
            {savedAt ? `Modifié ${relativeTime(savedAt)}` : 'Sauvegarde automatique'}
          </span>
        </div>
        <textarea
          value={notes}
          rows={5}
          placeholder="Arrêté à l'épisode 135, reprendre après l'arc filler…"
          onChange={(event) => {
            dirty.current = true;
            setNotesDraft(event.target.value);
          }}
          // Leaving the field commits immediately, without waiting out the debounce.
          onBlur={flushNotes}
          className="scroll-slim w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors duration-200 placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:outline-none"
        />
      </section>

      <section className="border-t border-line pt-5">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            remove(anime);
            onRemoved?.();
          }}
        >
          <Trash2 size={14} /> Retirer de ma liste
        </Button>
      </section>
    </div>
  );
}
