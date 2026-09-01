import { useEffect, useMemo, useState } from 'react';
import { searchAnime } from '@/services/api/anime';
import { useDebounce } from './useDebounce';
import { useWatchlist } from './useWatchlist';
import type { Anime, LibraryEntry } from '@/types';
import { displayTitle } from '@/lib/format';

const MIN_QUERY_LENGTH = 2;

export interface SearchState {
  /** Matches inside the user's own watchlist — always instant. */
  local: LibraryEntry[];
  /** Catalogue matches from AniList, excluding anything already shown locally. */
  remote: Anime[];
  loading: boolean;
  error: string | null;
  tooShort: boolean;
}

/** Case- and accent-insensitive comparison key. */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function useAnimeSearch(query: string, options: { enabled?: boolean } = {}): SearchState {
  const { enabled = true } = options;
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, 300);
  const { joined, settings, cacheAnimes } = useWatchlist();

  const [remote, setRemote] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const local = useMemo(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return [];
    const needle = normalize(trimmed);
    return joined
      .filter(({ anime }) => {
        const haystack = normalize(
          [anime.title, anime.titleEnglish, anime.titleNative].filter(Boolean).join(' '),
        );
        return haystack.includes(needle);
      })
      .sort((a, b) =>
        displayTitle(a.anime, settings.titleLanguage).localeCompare(
          displayTitle(b.anime, settings.titleLanguage),
        ),
      )
      .slice(0, 5);
  }, [joined, trimmed, settings.titleLanguage]);

  useEffect(() => {
    if (!enabled || debounced.length < MIN_QUERY_LENGTH) {
      setRemote([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    searchAnime(debounced, { perPage: 12, adult: settings.adultContent, signal: controller.signal })
      .then((page) => {
        if (!active) return;
        setRemote(page.items);
        cacheAnimes(page.items);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Recherche impossible.');
        setRemote([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debounced, enabled, settings.adultContent, cacheAnimes]);

  const localIds = useMemo(() => new Set(local.map((e) => e.anime.id)), [local]);

  return {
    local,
    remote: remote.filter((anime) => !localIds.has(anime.id)),
    // Keep the spinner up while the debounce is still pending.
    loading: loading || (trimmed !== debounced && trimmed.length >= MIN_QUERY_LENGTH),
    error,
    tooShort: trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH,
  };
}
