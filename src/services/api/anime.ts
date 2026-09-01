import { request } from './client';
import {
  BROWSE_QUERY,
  BY_IDS_QUERY,
  DETAIL_QUERY,
  RECENT_AIRINGS_QUERY,
  RECOMMENDATIONS_QUERY,
  SEARCH_QUERY,
  USER_LIST_QUERY,
} from './queries';
import { dedupe, normalizeMany, normalizeMedia, type RawMedia } from './normalize';
import type { AiredEpisode, Anime, WatchStatus } from '@/types';

/** Public surface of the catalogue. The UI only ever sees normalised `Anime`. */

interface PageResult<T> {
  Page: { pageInfo?: { hasNextPage: boolean; currentPage: number }; media: T[] };
}

const MINUTE = 60_000;

export interface Paged<T> {
  items: T[];
  hasNextPage: boolean;
  page: number;
}

export async function searchAnime(
  query: string,
  options: { page?: number; perPage?: number; adult?: boolean; signal?: AbortSignal } = {},
): Promise<Paged<Anime>> {
  const { page = 1, perPage = 20, adult = false, signal } = options;
  const data = await request<PageResult<RawMedia>>(
    SEARCH_QUERY,
    { q: query, page, perPage, isAdult: adult ? undefined : false },
    { ttl: 10 * MINUTE, signal },
  );
  return {
    items: normalizeMany(data.Page.media),
    hasNextPage: data.Page.pageInfo?.hasNextPage ?? false,
    page,
  };
}

export type BrowseSort =
  | 'TRENDING_DESC'
  | 'POPULARITY_DESC'
  | 'SCORE_DESC'
  | 'START_DATE_DESC'
  | 'FAVOURITES_DESC';

export interface BrowseParams {
  sort: BrowseSort;
  page?: number;
  perPage?: number;
  season?: string;
  seasonYear?: number;
  status?: 'RELEASING' | 'NOT_YET_RELEASED' | 'FINISHED';
  genre?: string;
  adult?: boolean;
  signal?: AbortSignal;
}

export async function browseAnime({
  sort,
  page = 1,
  perPage = 20,
  season,
  seasonYear,
  status,
  genre,
  adult = false,
  signal,
}: BrowseParams): Promise<Paged<Anime>> {
  const data = await request<PageResult<RawMedia>>(
    BROWSE_QUERY,
    {
      page,
      perPage,
      sort: [sort],
      season,
      seasonYear,
      status,
      genre,
      isAdult: adult ? undefined : false,
    },
    { ttl: 15 * MINUTE, signal },
  );
  return {
    items: normalizeMany(data.Page.media),
    hasNextPage: data.Page.pageInfo?.hasNextPage ?? false,
    page,
  };
}

export interface AnimeDetail extends Anime {
  recommendations: Anime[];
  relations: { relation: string; anime: Anime }[];
}

interface DetailResult {
  Media: RawMedia & {
    relations: { edges: { relationType: string | null; node: RawMedia | null }[] } | null;
    recommendations: { nodes: { mediaRecommendation: RawMedia | null }[] } | null;
  };
}

export async function getAnimeDetail(id: number, signal?: AbortSignal): Promise<AnimeDetail> {
  const data = await request<DetailResult>(DETAIL_QUERY, { id }, { ttl: 30 * MINUTE, signal });
  const media = data.Media;

  const relations = (media.relations?.edges ?? [])
    .filter((edge) => edge.node && edge.relationType)
    .filter((edge) => ['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'ALTERNATIVE'].includes(edge.relationType!))
    .map((edge) => ({ relation: edge.relationType!, anime: normalizeMedia(edge.node!) }));

  return {
    ...normalizeMedia(media),
    recommendations: normalizeMany(
      (media.recommendations?.nodes ?? []).map((n) => n.mediaRecommendation),
    ),
    relations,
  };
}

/** Refreshes catalogue data for a batch of library entries in a single call. */
export async function getAnimesByIds(ids: number[], signal?: AbortSignal): Promise<Anime[]> {
  if (ids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const results = await Promise.all(
    chunks.map((chunk) =>
      request<PageResult<RawMedia>>(
        BY_IDS_QUERY,
        { ids: chunk, perPage: chunk.length },
        { ttl: 30 * MINUTE, signal },
      ).then((data) => normalizeMany(data.Page.media)),
    ),
  );

  return results.flat();
}

interface RecosResult {
  Media: { recommendations: { nodes: { mediaRecommendation: RawMedia | null }[] } | null };
}

/**
 * Builds a "because you watched…" feed from a handful of seed titles.
 * Seeds are queried sequentially-ish through the shared rate limiter, and any
 * seed that fails is simply skipped rather than failing the whole section.
 */
export async function getRecommendationsFor(
  seedIds: number[],
  exclude: Set<number>,
  signal?: AbortSignal,
): Promise<Anime[]> {
  if (seedIds.length === 0) return [];

  const batches = await Promise.all(
    seedIds.slice(0, 3).map((id) =>
      request<RecosResult>(RECOMMENDATIONS_QUERY, { id }, { ttl: 60 * MINUTE, signal })
        .then((data) =>
          normalizeMany((data.Media.recommendations?.nodes ?? []).map((n) => n.mediaRecommendation)),
        )
        .catch(() => [] as Anime[]),
    ),
  );

  // Interleave so the feed is not dominated by a single seed.
  const merged: Anime[] = [];
  const maxLength = Math.max(0, ...batches.map((b) => b.length));
  for (let i = 0; i < maxLength; i++) {
    for (const batch of batches) if (batch[i]) merged.push(batch[i]);
  }

  return dedupe(merged).filter((anime) => !exclude.has(anime.id));
}

interface AiringResult {
  Page: {
    airingSchedules: { episode: number; airingAt: number; media: RawMedia | null }[];
  };
}

/**
 * Episodes released over the last `hours`, newest first.
 * Pass `ids` to restrict the feed to the user's own series.
 */
export async function getRecentAirings({
  ids,
  hours = 48,
  perPage = 30,
  adult = false,
  signal,
}: {
  ids?: number[];
  hours?: number;
  perPage?: number;
  adult?: boolean;
  signal?: AbortSignal;
} = {}): Promise<AiredEpisode[]> {
  if (ids && ids.length === 0) return [];

  const to = Math.floor(Date.now() / 1000);
  const from = to - hours * 3600;

  const data = await request<AiringResult>(
    RECENT_AIRINGS_QUERY,
    // AniList rejects an explicit null for mediaId_in, so the key is omitted.
    { ...(ids ? { ids } : {}), from, to, perPage },
    { ttl: 5 * MINUTE, signal },
  );

  return data.Page.airingSchedules
    .filter((slot) => slot.media)
    .map((slot) => ({
      anime: normalizeMedia(slot.media!),
      episode: slot.episode,
      airingAt: slot.airingAt,
    }))
    .filter((item) => adult || !item.anime.isAdult);
}

export interface ImportedListEntry {
  anime: Anime;
  status: WatchStatus;
  progress: number;
  rating: number | null;
  repeat: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
}

export interface ImportedList {
  username: string;
  avatar: string | null;
  entries: ImportedListEntry[];
}

export class ListImportError extends Error {}

const STATUS_MAP: Record<string, WatchStatus> = {
  CURRENT: 'watching',
  REPEATING: 'watching',
  COMPLETED: 'completed',
  PLANNING: 'planned',
  PAUSED: 'paused',
  DROPPED: 'dropped',
};

interface RawListEntry {
  status: string | null;
  progress: number | null;
  repeat: number | null;
  score: number | null;
  startedAt: { year: number | null; month: number | null; day: number | null } | null;
  completedAt: { year: number | null; month: number | null; day: number | null } | null;
  notes: string | null;
  media: RawMedia | null;
}

interface UserListResult {
  MediaListCollection: {
    user: { id: number; name: string; avatar: { medium: string | null } | null } | null;
    lists: { name: string; entries: RawListEntry[] }[];
  } | null;
}

function fuzzyToISO(
  date: { year: number | null; month: number | null; day: number | null } | null,
): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, '0');
  const day = String(date.day ?? 1).padStart(2, '0');
  return new Date(`${date.year}-${month}-${day}T12:00:00Z`).toISOString();
}

/**
 * Reads a public AniList profile and maps it onto our own model.
 * A private profile raises a clear, actionable error rather than an empty list.
 */
export async function importAniListUser(
  username: string,
  signal?: AbortSignal,
): Promise<ImportedList> {
  const name = username.trim();
  if (!name) throw new ListImportError('Indique un pseudo AniList.');

  let data: UserListResult;
  try {
    data = await request<UserListResult>(USER_LIST_QUERY, { name }, { ttl: MINUTE, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/private/i.test(message)) {
      throw new ListImportError(
        `La liste de « ${name} » est privée. Passe-la en public dans les réglages AniList.`,
      );
    }
    if (/not found/i.test(message)) {
      throw new ListImportError(`Aucun utilisateur AniList nommé « ${name} ».`);
    }
    throw new ListImportError(message || 'Import impossible pour le moment.');
  }

  const collection = data.MediaListCollection;
  if (!collection) throw new ListImportError(`Aucun utilisateur AniList nommé « ${name} ».`);

  // Custom lists can repeat the same media; the first occurrence wins.
  const seen = new Set<number>();
  const entries: ImportedListEntry[] = [];

  for (const list of collection.lists) {
    for (const raw of list.entries) {
      if (!raw.media?.id || seen.has(raw.media.id)) continue;
      seen.add(raw.media.id);
      entries.push({
        anime: normalizeMedia(raw.media),
        status: STATUS_MAP[raw.status ?? ''] ?? 'planned',
        progress: Math.max(0, raw.progress ?? 0),
        rating: typeof raw.score === 'number' && raw.score > 0 ? raw.score : null,
        // AniList counts re-watches separately from the REPEATING status.
        repeat: Math.max(0, raw.repeat ?? 0),
        startedAt: fuzzyToISO(raw.startedAt),
        completedAt: fuzzyToISO(raw.completedAt),
        notes: raw.notes ?? '',
      });
    }
  }

  return {
    username: collection.user?.name ?? name,
    avatar: collection.user?.avatar?.medium ?? null,
    entries,
  };
}

/** The anime season currently running, e.g. `{ season: 'SUMMER', year: 2026 }`. */
export function currentSeason(date = new Date()): { season: string; year: number } {
  const month = date.getMonth();
  const season =
    month < 3 ? 'WINTER' : month < 6 ? 'SPRING' : month < 9 ? 'SUMMER' : 'FALL';
  return { season, year: date.getFullYear() };
}
