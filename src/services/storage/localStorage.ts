import type { Anime, AppNotification, Settings, UserAnime } from '@/types';
import { type StorageAdapter } from './adapter';
import { coerceAnimes, coerceEntries, coerceSettings } from './coerce';
import { captureSnapshot, listSnapshots } from './snapshots';

const PREFIX = 'kagami:v1';
const KEYS = {
  entries: `${PREFIX}:entries`,
  animes: `${PREFIX}:animes`,
  settings: `${PREFIX}:settings`,
  notifications: `${PREFIX}:notifications`,
} as const;

/** Where unparseable watchlist data is set aside instead of being dropped. */
const QUARANTINE_KEY = `${PREFIX}:entries.corrupt`;

/** Catalogue cache is disposable — trim it before ever touching user data. */
const MAX_CACHED_ANIMES = 600;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Unparseable watchlist data must never simply vanish: the app would come
    // up empty and then write that emptiness straight back over it. Move the
    // raw text aside first so it can still be salvaged by hand.
    if (key === KEYS.entries) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) localStorage.setItem(QUARANTINE_KEY, raw);
      } catch {
        /* nothing more we can do */
      }
    }
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

/**
 * Looks for a watchlist left behind under a different key.
 *
 * The storage prefix is versioned (`kagami:v1:…`). If a future release ever
 * bumps it, the previous data would still be sitting there, unreferenced and
 * invisible. Rather than trust that nobody makes that mistake, an empty
 * watchlist triggers a scan of every `kagami:*:entries` key and adopts the
 * richest one found.
 */
function recoverOrphanedEntries(): UserAnime[] {
  let best: UserAnime[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === KEYS.entries) continue;
      if (!/^kagami:.*entries$/.test(key)) continue;

      const candidate = coerceEntries(read<unknown>(key, []));
      if (candidate.length > best.length) best = candidate;
    }
  } catch {
    return [];
  }

  return best;
}

export class LocalStorageAdapter implements StorageAdapter {
  async loadEntries(): Promise<UserAnime[]> {
    // Coerced, never validated-and-discarded: a watchlist written by an older
    // version of the app must always come back, whatever fields it is missing.
    const entries = coerceEntries(read<unknown>(KEYS.entries, []));
    if (entries.length > 0) return entries;

    // Nothing under the current key — make sure it is genuinely a fresh start
    // and not data stranded by a key change or a failed read.
    const recovered = recoverOrphanedEntries();
    if (recovered.length > 0) {
      console.warn(
        `[kagami] ${recovered.length} série(s) récupérées depuis une ancienne clé de stockage.`,
      );
      write(KEYS.entries, recovered);
      return recovered;
    }

    const snapshot = listSnapshots()[0];
    if (snapshot && snapshot.entries.length > 0) {
      // Do NOT auto-restore: an intentional "clear everything" must stay
      // cleared. Just make the rescue path discoverable in the console.
      console.warn(
        `[kagami] Watchlist vide, mais un point de restauration du ${snapshot.at} contient ` +
          `${snapshot.entryCount} série(s) — Paramètres › Points de restauration.`,
      );
    }

    return entries;
  }

  /**
   * The last line of defence.
   *
   * Any write that ends up with fewer series than are already on disk takes a
   * restore point first — whatever the cause: a deliberate deletion, an import,
   * a failed read that came back empty, or a bug in a future version. Legitimate
   * removals still go through; they simply become undoable.
   */
  async saveEntries(entries: UserAnime[]): Promise<void> {
    const stored = coerceEntries(read<unknown>(KEYS.entries, []));
    if (stored.length > entries.length) {
      captureSnapshot(stored, entries.length === 0 ? 'reset' : 'manuel');
    }
    write(KEYS.entries, entries);
  }

  /** Raw text of a watchlist that could not be parsed, if one was quarantined. */
  readQuarantined(): string | null {
    try {
      return localStorage.getItem(QUARANTINE_KEY);
    } catch {
      return null;
    }
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
