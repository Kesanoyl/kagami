import { useCallback, useEffect, useMemo } from 'react';
import { joinEntries, useLibrary } from '@/store/LibraryContext';
import { useToast } from '@/store/ToastContext';
import type { Anime, LibraryEntry, UserAnime, WatchStatus } from '@/types';
import { STATUS_META } from '@/lib/constants';
import { displayTitle } from '@/lib/format';
import type { NewEntryValues } from '@/lib/progress';

/**
 * The API every screen uses to read and mutate the watchlist.
 * It wraps the raw context with joins, sorting and user feedback.
 */
export function useWatchlist() {
  const library = useLibrary();
  const toast = useToast();
  const { entries, animes, settings } = library;

  const joined = useMemo(() => joinEntries(entries, animes), [entries, animes]);

  const byStatus = useMemo(() => {
    const map = new Map<WatchStatus, LibraryEntry[]>();
    for (const entry of joined) {
      const list = map.get(entry.user.status) ?? [];
      list.push(entry);
      map.set(entry.user.status, list);
    }
    return map;
  }, [joined]);

  const counts = useMemo(() => {
    const result: Record<WatchStatus, number> = {
      watching: 0,
      completed: 0,
      planned: 0,
      paused: 0,
      dropped: 0,
    };
    // Counts come from raw entries so they stay correct even before the
    // catalogue data for an entry has been fetched back.
    for (const entry of entries) result[entry.status] += 1;
    return result;
  }, [entries]);

  const isInLibrary = useCallback(
    (animeId: number) => entries.some((e) => e.animeId === animeId),
    [entries],
  );

  const add = useCallback(
    (anime: Anime, status: WatchStatus = 'planned', values: NewEntryValues = {}) => {
      if (isInLibrary(anime.id)) return;
      library.addToLibrary(anime, status, values);

      const extras = [
        values.rating != null ? `noté ${values.rating.toFixed(1)}` : null,
        values.notes?.trim() ? 'remarque enregistrée' : null,
      ].filter(Boolean);

      toast({
        title: 'Ajouté à ta liste',
        description: [
          displayTitle(anime, settings.titleLanguage),
          STATUS_META[status].label,
          ...extras,
        ].join(' · '),
        variant: 'success',
      });
    },
    [isInLibrary, library, toast, settings.titleLanguage],
  );

  const remove = useCallback(
    (anime: Anime) => {
      const previous = entries.find((e) => e.animeId === anime.id);
      library.removeFromLibrary(anime.id);
      toast({
        title: 'Retiré de ta liste',
        description: displayTitle(anime, settings.titleLanguage),
        action: previous
          ? { label: 'Annuler', onClick: () => library.restoreEntry(previous) }
          : undefined,
      });
    },
    [entries, library, toast, settings.titleLanguage],
  );

  const setEpisode = useCallback(
    (anime: Anime, episode: number, options: { silent?: boolean } = {}) => {
      const completed = library.setEpisode(anime.id, episode);
      if (options.silent) return completed;

      if (completed) {
        toast({
          title: 'Anime terminé 🎉',
          description: displayTitle(anime, settings.titleLanguage),
          variant: 'success',
        });
      } else {
        toast({
          title: `Épisode ${episode} enregistré`,
          description: displayTitle(anime, settings.titleLanguage),
        });
      }
      return completed;
    },
    [library, toast, settings.titleLanguage],
  );

  /** `+1 épisode` — the single most used action in the app. */
  const advance = useCallback(
    (anime: Anime) => {
      const entry = library.getEntry(anime.id);
      if (!entry) return false;
      return setEpisode(anime, entry.currentEpisode + 1);
    },
    [library, setEpisode],
  );

  const setStatus = useCallback(
    (anime: Anime, status: WatchStatus) => {
      library.setStatus(anime.id, status);
      toast({
        title: STATUS_META[status].label,
        description: displayTitle(anime, settings.titleLanguage),
        variant: status === 'completed' ? 'success' : 'default',
      });
    },
    [library, toast, settings.titleLanguage],
  );

  const setRating = useCallback(
    (anime: Anime, rating: number | null) => {
      library.patchEntry(anime.id, { rating });
      toast({
        title: rating == null ? 'Note retirée' : `Noté ${rating.toFixed(1)} / 10`,
        description: displayTitle(anime, settings.titleLanguage),
      });
    },
    [library, toast, settings.titleLanguage],
  );

  const setNotes = useCallback(
    (animeId: number, notes: string) => {
      library.patchEntry(animeId, { notes, notesUpdatedAt: new Date().toISOString() });
    },
    [library],
  );

  const patch = useCallback(
    (animeId: number, values: Partial<UserAnime>) => library.patchEntry(animeId, values),
    [library],
  );

  const toggleFavorite = useCallback(
    (anime: Anime) => {
      const entry = library.getEntry(anime.id);
      if (!entry) return;
      library.patchEntry(anime.id, { favorite: !entry.favorite });
    },
    [library],
  );

  return {
    ready: library.ready,
    refreshing: library.refreshing,
    settings,
    entries,
    joined,
    byStatus,
    counts,
    getEntry: library.getEntry,
    getAnime: library.getAnime,
    isInLibrary,
    cacheAnimes: library.cacheAnimes,
    add,
    remove,
    advance,
    setEpisode,
    setStatus,
    setRating,
    setNotes,
    patch,
    toggleFavorite,
  };
}

/**
 * Feeds freshly fetched catalogue data into the shared cache, so a card the user
 * saw in Discover renders instantly on the detail page and after a reload.
 */
export function useCacheAnimes(animes: Anime[] | null | undefined): void {
  const { cacheAnimes } = useLibrary();
  useEffect(() => {
    if (animes && animes.length > 0) cacheAnimes(animes);
  }, [animes, cacheAnimes]);
}

/** Entries a user is actively watching, most recently touched first. */
export function useContinueWatching(limit = 12): LibraryEntry[] {
  const { byStatus } = useWatchlist();
  return useMemo(() => {
    const list = byStatus.get('watching') ?? [];
    return [...list]
      .sort((a, b) => b.user.updatedAt.localeCompare(a.user.updatedAt))
      .slice(0, limit);
  }, [byStatus, limit]);
}
