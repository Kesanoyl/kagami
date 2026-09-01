import type { Anime, AppNotification, Settings, UserAnime } from '@/types';
import { type StorageAdapter } from './adapter';
import { coerceAnimes, coerceEntries, coerceSettings } from './coerce';

const PREFIX = 'kagami:v1';
const KEYS = {
  entries: `${PREFIX}:entries`,
  animes: `${PREFIX}:animes`,
  settings: `${PREFIX}:settings`,
  notifications: `${PREFIX}:notifications`,
} as const;

/** Catalogue cache is disposable — trim it before ever touching user data. */
const MAX_CACHED_ANIMES = 600;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota exceeded: drop the replaceable catalogue cache and retry once.
    if (key !== KEYS.animes) {
      try {
        localStorage.removeItem(KEYS.animes);
        localStorage.setItem(key, JSON.stringify(value));
        return;
      } catch {
        /* fall through */
      }
    }
    console.warn('[kagami] écriture impossible dans localStorage', error);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async loadEntries(): Promise<UserAnime[]> {
    // Coerced, never validated-and-discarded: a watchlist written by an older
    // version of the app must always come back, whatever fields it is missing.
    return coerceEntries(read<unknown>(KEYS.entries, []));
  }

  async saveEntries(entries: UserAnime[]): Promise<void> {
    write(KEYS.entries, entries);
  }

  async loadAnimes(): Promise<Anime[]> {
    return coerceAnimes(read<unknown>(KEYS.animes, []));
  }

  async saveAnimes(animes: Anime[]): Promise<void> {
    // Keep the freshest records; the rest can always be re-fetched.
    const trimmed =
      animes.length > MAX_CACHED_ANIMES
        ? [...animes].sort((a, b) => b.cachedAt - a.cachedAt).slice(0, MAX_CACHED_ANIMES)
        : animes;
    write(KEYS.animes, trimmed);
  }

  async loadSettings(): Promise<Settings | null> {
    const stored = read<unknown>(KEYS.settings, null);
    if (!stored) return null;
    return coerceSettings(stored);
  }

  async saveSettings(settings: Settings): Promise<void> {
    write(KEYS.settings, settings);
  }

  async loadNotifications(): Promise<AppNotification[]> {
    return read<AppNotification[]>(KEYS.notifications, []);
  }

  async saveNotifications(notifications: AppNotification[]): Promise<void> {
    write(KEYS.notifications, notifications.slice(0, 50));
  }

  async clear(): Promise<void> {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }
}
