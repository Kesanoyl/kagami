import { useMemo } from 'react';
import { useWatchlist } from './useWatchlist';
import type { LibraryEntry, WatchStatus } from '@/types';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';

/** Fallback used when AniList has no runtime for a title. */
const DEFAULT_EPISODE_MINUTES = 24;

export interface MonthlyPoint {
  /** `YYYY-MM`, used as the sort key. */
  key: string;
  label: string;
  episodes: number;
}

export interface GenrePoint {
  genre: string;
  count: number;
}

export interface StatusPoint {
  status: WatchStatus;
  label: string;
  count: number;
}

export interface RatingPoint {
  bucket: string;
  count: number;
}

export interface Statistics {
  totalAnime: number;
  episodesWatched: number;
  watchMinutes: number;
  counts: Record<WatchStatus, number>;
  statusDistribution: StatusPoint[];
  monthly: MonthlyPoint[];
  topGenres: GenrePoint[];
  ratingDistribution: RatingPoint[];
  averageRating: number | null;
  ratedCount: number;
  longestSeries: LibraryEntry | null;
  bestRated: LibraryEntry[];
  /** Episodes logged over the last 30 days. */
  recentEpisodes: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function useStatistics(): Statistics {
  const { joined, counts } = useWatchlist();

  return useMemo(() => {
    let episodesWatched = 0;
    let watchMinutes = 0;
    let ratingSum = 0;
    let ratedCount = 0;
    const genreCount = new Map<string, number>();
    const ratingBuckets = new Map<number, number>();

    for (const { user, anime } of joined) {
      const perEpisode = anime.duration ?? DEFAULT_EPISODE_MINUTES;
      const watched = user.currentEpisode + user.rewatches * (anime.episodes ?? user.currentEpisode);

      episodesWatched += watched;
      watchMinutes += watched * perEpisode;

      if (user.rating != null) {
        ratingSum += user.rating;
        ratedCount += 1;
        const bucket = Math.min(10, Math.max(1, Math.ceil(user.rating)));
        ratingBuckets.set(bucket, (ratingBuckets.get(bucket) ?? 0) + 1);
      }

      // Only count genres for series the user actually engaged with.
      if (user.status !== 'planned') {
        for (const genre of anime.genres) {
          genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
        }
      }
    }

    // ---- episodes per month, rebuilt from the progress log -------------------
    const perMonth = new Map<string, number>();
    for (const { user } of joined) {
      let previous = 0;
      const sorted = [...user.history].sort((a, b) => a.at.localeCompare(b.at));
      for (const event of sorted) {
        const delta = Math.max(0, event.episode - previous);
        previous = Math.max(previous, event.episode);
        if (delta === 0) continue;
        const date = new Date(event.at);
        if (Number.isNaN(date.getTime())) continue;
        const key = monthKey(date);
        perMonth.set(key, (perMonth.get(key) ?? 0) + delta);
      }
    }

    // Always render the last 12 months, gaps included — a chart with holes lies.
    const monthly: MonthlyPoint[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 11; i >= 0; i--) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      const key = monthKey(date);
      monthly.push({
        key,
        label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date),
        episodes: perMonth.get(key) ?? 0,
      });
    }

    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    let recentEpisodes = 0;
    for (const { user } of joined) {
      let previous = 0;
      const sorted = [...user.history].sort((a, b) => a.at.localeCompare(b.at));
      for (const event of sorted) {
        const delta = Math.max(0, event.episode - previous);
        previous = Math.max(previous, event.episode);
        if (delta > 0 && new Date(event.at).getTime() >= thirtyDaysAgo) recentEpisodes += delta;
      }
    }

    const statusDistribution: StatusPoint[] = STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_META[status].label,
      count: counts[status],
    })).filter((point) => point.count > 0);

    const topGenres = [...genreCount.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const ratingDistribution: RatingPoint[] = Array.from({ length: 10 }, (_, index) => {
      const bucket = index + 1;
      return { bucket: String(bucket), count: ratingBuckets.get(bucket) ?? 0 };
    });

    const longestSeries =
      joined.reduce<LibraryEntry | null>((best, entry) => {
        if (entry.user.currentEpisode <= (best?.user.currentEpisode ?? 0)) return best;
        return entry;
      }, null) ?? null;

    const bestRated = joined
      .filter((entry) => entry.user.rating != null)
      .sort((a, b) => (b.user.rating ?? 0) - (a.user.rating ?? 0))
      .slice(0, 5);

    return {
      totalAnime: joined.length,
      episodesWatched,
      watchMinutes,
      counts,
      statusDistribution,
      monthly,
      topGenres,
      ratingDistribution,
      averageRating: ratedCount > 0 ? ratingSum / ratedCount : null,
      ratedCount,
      longestSeries,
      bestRated,
      recentEpisodes,
    };
  }, [joined, counts]);
}
