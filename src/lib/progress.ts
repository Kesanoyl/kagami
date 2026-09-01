import type { Anime, ProgressEvent, UserAnime, WatchStatus } from '@/types';

const HISTORY_CAP = 500;

export function createEntry(anime: Anime, status: WatchStatus = 'planned'): UserAnime {
  const now = new Date().toISOString();
  // Adding something straight as "completed" (a series watched before using the
  // app) should arrive with a full counter, not at episode 0.
  const alreadyDone = status === 'completed';
  const total = anime.episodes ?? 0;

  return {
    animeId: anime.id,
    status,
    currentEpisode: alreadyDone ? total : 0,
    currentSeason: null,
    currentPart: null,
    currentArc: null,
    rating: null,
    notes: '',
    notesUpdatedAt: null,
    favorite: false,
    rewatches: 0,
    addedAt: now,
    updatedAt: now,
    startedAt: status === 'watching' || alreadyDone ? now : null,
    completedAt: alreadyDone ? now : null,
    history: alreadyDone && total > 0 ? [{ at: now, episode: total }] : [],
  };
}

function appendHistory(history: ProgressEvent[], episode: number): ProgressEvent[] {
  const next = [...history, { at: new Date().toISOString(), episode }];
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}

export interface ProgressResult {
  entry: UserAnime;
  /** True only on the transition into `completed`, so the UI can celebrate once. */
  justCompleted: boolean;
}

/**
 * The single place where progress rules live.
 *
 * Reaching the last known episode promotes the entry to `completed` (when the
 * user has not disabled it); moving backwards from a completed series returns
 * it to `watching`.
 */
export function applyEpisode(
  entry: UserAnime,
  anime: Anime | undefined,
  rawEpisode: number,
  autoComplete: boolean,
): ProgressResult {
  const total = anime?.episodes ?? null;
  const episode = Math.max(0, total ? Math.min(rawEpisode, total) : rawEpisode);
  const now = new Date().toISOString();

  if (episode === entry.currentEpisode) return { entry, justCompleted: false };

  let status = entry.status;
  let completedAt = entry.completedAt;
  let justCompleted = false;

  const reachedEnd = total !== null && episode >= total;

  if (reachedEnd && autoComplete && entry.status !== 'completed') {
    status = 'completed';
    completedAt = now;
    justCompleted = true;
  } else if (!reachedEnd && entry.status === 'completed') {
    // Rewinding a finished series means the user is watching it again.
    status = 'watching';
    completedAt = null;
  } else if (episode > 0 && (entry.status === 'planned' || entry.status === 'paused')) {
    status = 'watching';
  }

  return {
    entry: {
      ...entry,
      currentEpisode: episode,
      status,
      completedAt,
      startedAt: entry.startedAt ?? (episode > 0 ? now : null),
      updatedAt: now,
      history: episode > entry.currentEpisode ? appendHistory(entry.history, episode) : entry.history,
    },
    justCompleted,
  };
}

/**
 * Changing status by hand has its own consequences: marking "completed" fills
 * in the episode counter, and starting a planned series stamps a start date.
 */
export function applyStatus(
  entry: UserAnime,
  anime: Anime | undefined,
  status: WatchStatus,
): UserAnime {
  const now = new Date().toISOString();
  if (status === entry.status) return entry;

  let currentEpisode = entry.currentEpisode;
  let history = entry.history;

  if (status === 'completed') {
    const total = anime?.episodes ?? null;
    if (total && currentEpisode < total) {
      currentEpisode = total;
      history = appendHistory(history, total);
    }
  }

  return {
    ...entry,
    status,
    currentEpisode,
    history,
    startedAt: entry.startedAt ?? (status === 'watching' ? now : null),
    completedAt: status === 'completed' ? (entry.completedAt ?? now) : null,
    updatedAt: now,
  };
}

/** How many episodes have aired but are still unwatched. */
export function pendingEpisodes(entry: UserAnime, anime: Anime | undefined): number {
  if (!anime) return 0;
  const aired = anime.nextEpisode
    ? anime.nextEpisode.episode - 1
    : (anime.episodes ?? entry.currentEpisode);
  return Math.max(0, aired - entry.currentEpisode);
}
