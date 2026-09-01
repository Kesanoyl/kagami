/**
 * Two clearly separated concerns:
 *  - `Anime`     : catalogue data owned by the API (cached, replaceable, never edited)
 *  - `UserAnime` : everything *I* wrote — progress, rating, notes. Never comes from the API.
 * Nothing in `UserAnime` duplicates `Anime`; they are joined by `animeId`.
 */

export type WatchStatus = 'watching' | 'completed' | 'planned' | 'paused' | 'dropped';

export type AiringStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export interface NextAiringEpisode {
  episode: number;
  /** Unix seconds. */
  airingAt: number;
}

export interface Anime {
  /** AniList media id — the canonical key across the whole app. */
  id: number;
  malId: number | null;
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  poster: string | null;
  banner: string | null;
  /** Dominant colour extracted by AniList from the cover — used for hero glows. */
  color: string | null;
  synopsis: string | null;
  genres: string[];
  episodes: number | null;
  /** Average episode length, minutes. */
  duration: number | null;
  year: number | null;
  season: string | null;
  format: string | null;
  airingStatus: AiringStatus | null;
  /** 0–100 community score. */
  averageScore: number | null;
  popularity: number | null;
  studio: string | null;
  source: string | null;
  startDate: string | null;
  endDate: string | null;
  nextEpisode: NextAiringEpisode | null;
  siteUrl: string | null;
  isAdult: boolean;
  /** When this record was cached locally. */
  cachedAt: number;
}

/** One episode that has already aired. */
export interface AiredEpisode {
  anime: Anime;
  episode: number;
  /** Unix seconds. */
  airingAt: number;
}

export interface ProgressEvent {
  /** ISO date. */
  at: string;
  /** Episode number reached at that moment. */
  episode: number;
}

export interface UserAnime {
  animeId: number;
  status: WatchStatus;
  currentEpisode: number;
  /** Free-form season/part tracking — the API is rarely precise enough. */
  currentSeason: number | null;
  currentPart: string | null;
  currentArc: string | null;
  /** Personal score, 0–10, one decimal allowed. */
  rating: number | null;
  notes: string;
  notesUpdatedAt: string | null;
  favorite: boolean;
  rewatches: number;
  addedAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Capped log powering the "episodes per month" chart. */
  history: ProgressEvent[];
}

/** An entry joined with its catalogue data — what the UI actually renders. */
export interface LibraryEntry {
  user: UserAnime;
  anime: Anime;
}

export interface ReminderSettings {
  newEpisode: boolean;
  airingSoon: boolean;
  seriesFinished: boolean;
}

export interface Settings {
  titleLanguage: 'romaji' | 'english';
  sidebarCollapsed: boolean;
  /** Auto-flip to "completed" when the last episode is reached. */
  autoComplete: boolean;
  reminders: ReminderSettings;
  adultContent: boolean;
}

export interface AppNotification {
  id: string;
  animeId: number;
  kind: 'new-episode' | 'airing-soon' | 'finished';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface BackupFile {
  app: 'kagami';
  version: 1;
  exportedAt: string;
  entries: UserAnime[];
  animes: Anime[];
  settings: Settings;
}

export interface ImportPreview {
  totalEntries: number;
  newEntries: number;
  updatedEntries: number;
  unchangedEntries: number;
  hasSettings: boolean;
}
