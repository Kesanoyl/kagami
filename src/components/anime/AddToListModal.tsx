import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Anime, WatchStatus } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Poster } from '@/components/ui/Poster';
import { RatingInput } from './Rating';
import { STATUS_DOT } from '@/components/ui/Badge';
import { useWatchlist } from '@/hooks/useWatchlist';
import { cn } from '@/lib/cn';
import { altTitle, displayTitle } from '@/lib/format';
import { FORMAT_LABEL, STATUS_META } from '@/lib/constants';

/** The statuses the "already finished?" question does not answer. */
const OTHER_STATUSES: WatchStatus[] = ['planned', 'paused', 'dropped'];

/**
 * Everything an entry needs, captured in one pass at add time: whether it is
 * finished, where the user is, their score and a remark.
 *
 * Only the status is required — the rest is optional and the dialog can be
 * confirmed immediately, so adding stays a two-click action when nothing else
 * is worth saying.
 */
export function AddToListModal({
  anime,
  open,
  onClose,
}: {
  anime: Anime;
  open: boolean;
  onClose: () => void;
}) {
  const { add, settings } = useWatchlist();

  const [status, setStatus] = useState<WatchStatus>('watching');
  const [episode, setEpisode] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Reset on each open so a previous draft never leaks into another series.
  useEffect(() => {
    if (!open) return;
    setStatus('watching');
    setEpisode(0);
    setRating(null);
    setNotes('');
  }, [open, anime.id]);

  const total = anime.episodes;
  // "Completed" fills the counter itself; "planned" has nothing to track yet.
  const showProgress = status !== 'completed' && status !== 'planned';

  const submit = () => {
    add(anime, status, {
      currentEpisode: showProgress ? episode : undefined,
      rating,
      notes,
    });
    onClose();
  };

  const meta = [
    anime.year,
    anime.format ? (FORMAT_LABEL[anime.format] ?? anime.format) : null,
    total ? `${total} épisodes` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter à ma liste"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit}>
            <Check size={15} /> Ajouter
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <div className="flex items-center gap-3">
          <Poster
            src={anime.poster}
            alt=""
            tint={anime.color}
            className="w-14 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-ink">
              {displayTitle(anime, settings.titleLanguage)}
            </p>
            {altTitle(anime, settings.titleLanguage) && (
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-faint">
                {altTitle(anime, settings.titleLanguage)}
              </p>
            )}
            <p className="mt-1 text-[11px] text-ink-dim">{meta}</p>
          </div>
        </div>

        <section>
          <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Tu l’as déjà terminé ?
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={status === 'completed'}
              onClick={() => setStatus('completed')}
              label="Oui, terminé"
              hint={total ? `les ${total} épisodes` : 'série finie'}
            />
            <ChoiceButton
              active={status === 'watching'}
              onClick={() => setStatus('watching')}
              label="Non, en cours"
              hint="je le regarde"
            />
          </div>

          {/* Only the statuses the binary question does not already cover —
              repeating "terminé" and "en cours" here made the user answer twice. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-faint">ou plutôt :</span>
            {OTHER_STATUSES.map((item) => {
              const active = status === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(item)}
                  className={cn(
                    'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium',
                    'transition-[background-color,border-color,color] duration-200',
                    active
                      ? 'border-brand/50 bg-brand/15 text-ink'
                      : 'border-line bg-surface-2 text-ink-dim hover:border-line-strong hover:text-ink',
                  )}
                >
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[item])}
                    aria-hidden
                  />
                  {STATUS_META[item].label}
                </button>
              );
            })}
          </div>
        </section>

        {showProgress && (
          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
              Où en es-tu ?
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEpisode((n) => Math.max(0, n - 1))}
                disabled={episode === 0}
                aria-label="Un épisode de moins"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2 text-ink transition-[background-color,transform] duration-200 hover:bg-surface-3 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <div className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3">
                <span className="text-xs text-ink-faint">Ép.</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={episode}
                  aria-label="Épisode atteint"
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value.replace(/[^0-9]/g, ''), 10);
                    const next = Number.isNaN(parsed) ? 0 : parsed;
                    setEpisode(total ? Math.min(next, total) : next);
                  }}
                  className="tnum w-14 bg-transparent text-center text-base font-semibold text-ink outline-none"
                />
                <span className="tnum text-xs text-ink-faint">/ {total ?? '?'}</span>
              </div>
              <button
                type="button"
                onClick={() => setEpisode((n) => (total ? Math.min(total, n + 1) : n + 1))}
                aria-label="Un épisode de plus"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand text-white transition-[background-color,transform] duration-200 hover:bg-brand-bright active:scale-95"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              Laisse à 0 si tu ne l’as pas encore commencé.
            </p>
          </section>
        )}

        <section>
          <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Ta note <span className="font-normal normal-case">— facultatif</span>
          </h3>
          <RatingInput value={rating} onChange={setRating} />
        </section>

        <section>
          <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Une remarque <span className="font-normal normal-case">— facultatif</span>
          </h3>
          <textarea
            value={notes}
            rows={3}
            placeholder="Conseillé par un ami, à regarder en VO, reprendre après l’arc filler…"
            onChange={(event) => setNotes(event.target.value)}
            className="scroll-slim w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors duration-200 placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:outline-none"
          />
        </section>
      </div>
    </Modal>
  );
}

function ChoiceButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border px-3 py-3 text-left transition-[background-color,border-color] duration-200',
        active
          ? 'border-brand/50 bg-brand/15'
          : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-3',
      )}
    >
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="mt-0.5 block text-[11px] text-ink-dim">{hint}</span>
    </button>
  );
}
