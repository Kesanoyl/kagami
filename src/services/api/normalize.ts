import type { Anime, AiringStatus } from '@/types';

/** Shape of an AniList `Media` node, narrowed to the fields we ask for. */
export interface RawMedia {
  id: number;
  idMal: number | null;
  isAdult?: boolean | null;
  title: { romaji: string | null; english: string | null; native: string | null } | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage: string | null;
  description: string | null;
  genres: string[] | null;
  episodes: number | null;
  duration: number | null;
  seasonYear: number | null;
  season: string | null;
  format: string | null;
  status: string | null;
  averageScore: number | null;
  popularity: number | null;
  source: string | null;
  siteUrl: string | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  endDate: { year: number | null; month: number | null; day: number | null } | null;
  studios: { nodes: { name: string }[] } | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

const AIRING_STATUSES: AiringStatus[] = [
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
];

/** AniList descriptions carry a little HTML; strip it and cap the length we cache. */
function cleanSynopsis(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text || null;
}

function toISODate(
  date: { year: number | null; month: number | null; day: number | null } | null,
): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, '0');
  const day = String(date.day ?? 1).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

export function normalizeMedia(raw: RawMedia): Anime {
  const status = AIRING_STATUSES.find((s) => s === raw.status) ?? null;

  return {
    id: raw.id,
    malId: raw.idMal ?? null,
    title: raw.title?.romaji ?? raw.title?.english ?? raw.title?.native ?? 'Sans titre',
    titleEnglish: raw.title?.english ?? null,
    titleNative: raw.title?.native ?? null,
    poster: raw.coverImage?.extraLarge ?? raw.coverImage?.large ?? null,
    banner: raw.bannerImage ?? null,
    color: raw.coverImage?.color ?? null,
    synopsis: cleanSynopsis(raw.description),
    genres: raw.genres ?? [],
    episodes: raw.episodes ?? null,
    duration: raw.duration ?? null,
    year: raw.seasonYear ?? (raw.startDate?.year ?? null),
    season: raw.season ?? null,
    format: raw.format ?? null,
    airingStatus: status,
    averageScore: raw.averageScore ?? null,
    popularity: raw.popularity ?? null,
    studio: raw.studios?.nodes?.[0]?.name ?? null,
    source: raw.source ?? null,
    startDate: toISODate(raw.startDate),
    endDate: toISODate(raw.endDate),
    nextEpisode: raw.nextAiringEpisode
      ? { episode: raw.nextAiringEpisode.episode, airingAt: raw.nextAiringEpisode.airingAt }
      : null,
    siteUrl: raw.siteUrl ?? null,
    isAdult: raw.isAdult === true,
    cachedAt: Date.now(),
  };
}

export function normalizeMany(list: (RawMedia | null)[] | null | undefined): Anime[] {
  if (!list) return [];
  return list.filter((m): m is RawMedia => Boolean(m?.id)).map(normalizeMedia);
}

/** Removes duplicates while preserving order — recommendation feeds overlap a lot. */
export function dedupe(animes: Anime[]): Anime[] {
  const seen = new Set<number>();
  const out: Anime[] = [];
  for (const anime of animes) {
    if (seen.has(anime.id)) continue;
    seen.add(anime.id);
    out.push(anime);
  }
  return out;
}
