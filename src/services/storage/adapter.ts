import type { Anime, AppNotification, Settings, UserAnime } from '@/types';

/**
 * The one contract the app depends on for persistence.
 *
 * It is deliberately async and batch-oriented: swapping `LocalStorageAdapter`
 * for a Supabase/Firebase implementation means writing a second class here and
 * changing a single line in `services/storage/index.ts` — no UI change at all.
 */
export interface StorageAdapter {
  loadEntries(): Promise<UserAnime[]>;
  saveEntries(entries: UserAnime[]): Promise<void>;

  loadAnimes(): Promise<Anime[]>;
  saveAnimes(animes: Anime[]): Promise<void>;

  loadSettings(): Promise<Settings | null>;
  saveSettings(settings: Settings): Promise<void>;

  loadNotifications(): Promise<AppNotification[]>;
  saveNotifications(notifications: AppNotification[]): Promise<void>;

  clear(): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  titleLanguage: 'romaji',
  sidebarCollapsed: false,
  autoComplete: true,
  reminders: {
    newEpisode: true,
    airingSoon: true,
    seriesFinished: false,
  },
  adultContent: false,
};
