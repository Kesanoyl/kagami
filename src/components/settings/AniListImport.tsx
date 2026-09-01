import { useState } from 'react';
import { Download, UserRound } from 'lucide-react';
import { importAniListUser, ListImportError, type ImportedList } from '@/services/api/anime';
import { useLibrary } from '@/store/LibraryContext';
import { useToast } from '@/store/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { STATUS_DOT } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { UserAnime, WatchStatus } from '@/types';

/**
 * Pulls a public AniList profile into the local watchlist.
 *
 * This is read-only and unauthenticated: we never ask for a password, and
 * nothing is ever written back to AniList.
 */
export function AniListImport() {
  const { entries, replaceAll } = useLibrary();
  const toast = useToast();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportedList | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await importAniListUser(username);
      if (list.entries.length === 0) {
        setError(`La liste de « ${list.username} » est vide.`);
        return;
      }
      setPreview(list);
    } catch (err) {
      setError(
        err instanceof ListImportError
          ? err.message
          : 'Import impossible. Réessaie dans un instant.',
      );
    } finally {
      setLoading(false);
    }
  };

  const counts = preview
    ? preview.entries.reduce<Record<WatchStatus, number>>(
        (acc, entry) => {
          acc[entry.status] += 1;
          return acc;
        },
        { watching: 0, completed: 0, planned: 0, paused: 0, dropped: 0 },
      )
    : null;

  const known = new Set(entries.map((e) => e.animeId));
  const fresh = preview?.entries.filter((e) => !known.has(e.anime.id)).length ?? 0;

  const confirm = () => {
    if (!preview) return;
    const now = new Date().toISOString();

    // Imported progress wins on conflict; anything only present locally is kept.
    const merged = new Map<number, UserAnime>(entries.map((e) => [e.animeId, e]));

    for (const item of preview.entries) {
      const existing = merged.get(item.anime.id);
      merged.set(item.anime.id, {
        animeId: item.anime.id,
        status: item.status,
        currentEpisode: item.progress,
        currentSeason: existing?.currentSeason ?? null,
        currentPart: existing?.currentPart ?? null,
        currentArc: existing?.currentArc ?? null,
        rating: item.rating ?? existing?.rating ?? null,
        // Local notes are personal — never overwritten by an import.
        notes: existing?.notes || item.notes,
        notesUpdatedAt: existing?.notesUpdatedAt ?? (item.notes ? now : null),
        favorite: existing?.favorite ?? false,
        rewatches: item.repeat,
        addedAt: existing?.addedAt ?? item.startedAt ?? now,
        updatedAt: now,
        startedAt: item.startedAt ?? existing?.startedAt ?? null,
        completedAt: item.completedAt ?? existing?.completedAt ?? null,
        // AniList gives no per-episode log; seed one point so the stats have data.
        history:
          existing?.history?.length
            ? existing.history
            : item.progress > 0
              ? [{ at: item.completedAt ?? item.startedAt ?? now, episode: item.progress }]
              : [],
      });
    }

    replaceAll(
      [...merged.values()],
      preview.entries.map((e) => e.anime),
    );

    toast({
      title: 'Liste AniList importée',
      description: `${preview.entries.length} série(s) depuis « ${preview.username} ».`,
      variant: 'success',
    });
    setPreview(null);
    setUsername('');
  };

  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3.5">
      <div className="flex items-start gap-3">
        <UserRound size={15} className="mt-0.5 shrink-0 text-ink-faint" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Importer depuis AniList</p>
          <p className="mt-0.5 text-xs text-ink-dim">
            Récupère une liste publique en une fois : statuts, progression, notes et re-visionnages.
            Aucun mot de passe, aucune écriture chez AniList.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Pseudo AniList"
            placeholder="MonPseudo"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && username.trim()) void fetchList();
            }}
          />
        </div>
        <Button
          variant="secondary"
          loading={loading}
          disabled={!username.trim()}
          onClick={() => void fetchList()}
          className="sm:mb-0"
        >
          <Download size={14} /> Récupérer
        </Button>
      </div>

      {error && (
        <p className="mt-2.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={`Liste de ${preview?.username ?? ''}`}
        description="Rien n’est modifié tant que tu n’as pas confirmé."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={confirm}>
              Importer {preview?.entries.length ?? 0} séries
            </Button>
          </>
        }
      >
        {counts && (
          <>
            <ul className="space-y-1.5">
              {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
                <li
                  key={status}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-xs text-ink-dim">
                    <span
                      className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
                      aria-hidden
                    />
                    {STATUS_META[status].label}
                  </span>
                  <span className="tnum text-sm font-semibold text-ink">{counts[status]}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-ink-dim">
              {fresh} nouvelle{fresh > 1 ? 's' : ''} série{fresh > 1 ? 's' : ''} ·{' '}
              {preview!.entries.length - fresh} déjà dans ta liste (progression mise à jour).
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Tes notes personnelles existantes sont conservées, et un point de restauration est
              créé avant l’import.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
