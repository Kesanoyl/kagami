import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Anime, AppNotification, LibraryEntry, Settings, UserAnime, WatchStatus } from '@/types';
import { DEFAULT_SETTINGS, storage } from '@/services/storage';
import { getAnimesByIds } from '@/services/api/anime';
import { applyEpisode, applyStatus, createEntry, type NewEntryValues } from '@/lib/progress';
import { buildNotifications } from '@/services/notifications';
import { captureDailySnapshot, captureSnapshot } from '@/services/storage/snapshots';
import { coerceEntries } from '@/services/storage/coerce';
import { mergeEntries, sameEntries } from '@/lib/merge';
import { requestPersistentStorage } from '@/services/storage/durability';
import { buildBackup } from '@/services/storage/backup';
import { getBackupTarget, writeBackupFile, type BackupTarget } from '@/services/storage/fileBackup';

/**
 * Owns every piece of user state. Components read through the hooks in
 * `hooks/useWatchlist.ts`; nothing else talks to `services/storage`.
 */

interface LibraryContextValue {
  ready: boolean;
  entries: UserAnime[];
  animes: Map<number, Anime>;
  settings: Settings;
  notifications: AppNotification[];
  refreshing: boolean;
  /** Name of the disk file receiving automatic backups, when one is set up. */
  backupFileName: string | null;
  lastBackupAt: string | null;
  refreshBackupTarget: () => Promise<void>;
  backupNow: () => Promise<boolean>;

  getEntry: (animeId: number) => UserAnime | undefined;
  getAnime: (animeId: number) => Anime | undefined;

  addToLibrary: (anime: Anime, status?: WatchStatus, values?: NewEntryValues) => void;
  removeFromLibrary: (animeId: number) => void;
  restoreEntry: (entry: UserAnime) => void;
  patchEntry: (animeId: number, patch: Partial<UserAnime>) => void;
  setEpisode: (animeId: number, episode: number) => boolean;
  setStatus: (animeId: number, status: WatchStatus) => void;
  cacheAnimes: (animes: Anime[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  markNotificationsRead: () => void;
  replaceAll: (entries: UserAnime[], animes: Anime[], settings?: Settings | null) => void;
  resetAll: () => void;
  restoreSnapshot: (entries: UserAnime[]) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

/** Catalogue data older than this is refreshed on launch (airing dates move). */
const STALE_AFTER = 6 * 60 * 60 * 1000;

function toMap(animes: Anime[]): Map<number, Anime> {
  return new Map(animes.map((a) => [a.id, a]));
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<UserAnime[]>([]);
  const [animes, setAnimes] = useState<Map<number, Anime>>(() => new Map());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const backupTarget = useRef<BackupTarget | null>(null);

  // ---------------------------------------------------------------- hydration
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedEntries, storedAnimes, storedSettings, storedNotifications] = await Promise.all([
        storage.loadEntries(),
        storage.loadAnimes(),
        storage.loadSettings(),
        storage.loadNotifications(),
      ]);
      if (cancelled) return;

      setEntries(storedEntries);
      setAnimes(toMap(storedAnimes));
      setSettings(storedSettings ?? DEFAULT_SETTINGS);
      setNotifications(storedNotifications);
      setReady(true);

      // Ask the browser never to evict this origin's data under disk pressure.
      void requestPersistentStorage();
      // One restore point per day, taken from the state as it was found.
      captureDailySnapshot(storedEntries);

      // Silently reconnect to the backup file chosen in a previous session.
      const target = await getBackupTarget(false);
      if (cancelled || !target) return;
      backupTarget.current = target;
      setBackupFileName(target.name);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------- cross-tab safety
  /**
   * Two tabs share one `localStorage`. Without this, the tab that saves last
   * silently overwrites everything the other one did — days of work gone with
   * no error anywhere. Incoming changes are merged entry by entry instead,
   * newest `updatedAt` winning.
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'kagami:v1:entries' || !event.newValue) return;
      try {
        const incoming = coerceEntries(JSON.parse(event.newValue));
        setEntries((current) => {
          const merged = mergeEntries(current, incoming);
          return sameEntries(current, merged) ? current : merged;
        });
      } catch {
        // A tab that wrote garbage must not take this one down with it.
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // -------------------------------------------------------------- persistence
  const persistTimers = useRef<Record<string, number>>({});

  const persist = useCallback((key: string, run: () => void) => {
    window.clearTimeout(persistTimers.current[key]);
    persistTimers.current[key] = window.setTimeout(run, 200);
  }, []);

  useEffect(() => {
    if (!ready) return;
    persist('entries', () => void storage.saveEntries(entries));
  }, [entries, ready, persist]);

  useEffect(() => {
    if (!ready) return;
    // Only catalogue records that back a library entry are worth persisting —
    // browsing results stay in memory and are re-fetched on demand.
    const tracked = new Set(entries.map((e) => e.animeId));
    persist('animes', () => {
      const subset = [...animes.values()].filter((a) => tracked.has(a.id));
      void storage.saveAnimes(subset);
    });
  }, [animes, entries, ready, persist]);

  useEffect(() => {
    if (!ready) return;
    persist('settings', () => void storage.saveSettings(settings));
  }, [settings, ready, persist]);

  useEffect(() => {
    if (!ready) return;
    persist('notifications', () => void storage.saveNotifications(notifications));
  }, [notifications, ready, persist]);

  // ------------------------------------------------------ automatic file backup
  // Catalogue data is read through a ref so that merely browsing Discover does
  // not trigger a disk write; only real changes to the watchlist do.
  const entriesRef = useRef(entries);
  const animesRef = useRef(animes);
  const settingsRef = useRef(settings);
  entriesRef.current = entries;
  animesRef.current = animes;
  settingsRef.current = settings;

  const runBackup = useCallback(async (): Promise<boolean> => {
    const target = backupTarget.current;
    if (!target) return false;
    const backup = buildBackup(
      entriesRef.current,
      [...animesRef.current.values()],
      settingsRef.current,
    );
    const written = await writeBackupFile(target, backup);
    if (written) setLastBackupAt(new Date().toISOString());
    return written;
  }, []);

  const backupTimer = useRef(0);
  useEffect(() => {
    if (!ready || !backupFileName) return;
    window.clearTimeout(backupTimer.current);
    // Longer debounce than localStorage: a disk write is not free.
    backupTimer.current = window.setTimeout(() => void runBackup(), 2000);
    return () => window.clearTimeout(backupTimer.current);
  }, [entries, settings, ready, backupFileName, runBackup]);

  const refreshBackupTarget = useCallback(async () => {
    const target = await getBackupTarget(true);
    backupTarget.current = target;
    setBackupFileName(target?.name ?? null);
    if (target) await runBackup();
  }, [runBackup]);

  // ------------------------------------------------- background catalogue sync
  const synced = useRef(false);

  useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;

    const tracked = entries.map((e) => e.animeId);
    if (tracked.length === 0) return;

    const now = Date.now();
    const stale = tracked.filter((id) => {
      const cached = animes.get(id);
      return !cached || now - cached.cachedAt > STALE_AFTER;
    });
    if (stale.length === 0) return;

    let cancelled = false;
    setRefreshing(true);

    getAnimesByIds(stale)
      .then((fresh) => {
        if (cancelled || fresh.length === 0) return;
        setAnimes((current) => {
          const next = new Map(current);
          fresh.forEach((anime) => next.set(anime.id, anime));
          return next;
        });
        setNotifications((current) => buildNotifications(entries, fresh, current, settings));
      })
      .catch(() => {
        /* Offline or rate-limited: cached data keeps the app usable. */
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // Runs once, right after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ------------------------------------------------------------------ actions
  const getEntry = useCallback(
    (animeId: number) => entries.find((e) => e.animeId === animeId),
    [entries],
  );

  const getAnime = useCallback((animeId: number) => animes.get(animeId), [animes]);

  const cacheAnimes = useCallback((incoming: Anime[]) => {
    if (incoming.length === 0) return;
    setAnimes((current) => {
      let changed = false;
      const next = new Map(current);
      for (const anime of incoming) {
        const existing = next.get(anime.id);
        // Skip writes that would only bump `cachedAt` — they cause needless renders.
        if (existing && anime.cachedAt - existing.cachedAt < 60_000) continue;
        next.set(anime.id, anime);
        changed = true;
      }
      return changed ? next : current;
    });
  }, []);

  const addToLibrary = useCallback(
    (anime: Anime, status: WatchStatus = 'planned', values: NewEntryValues = {}) => {
      cacheAnimes([anime]);
      setEntries((current) => {
        if (current.some((e) => e.animeId === anime.id)) return current;
        return [...current, createEntry(anime, status, values)];
      });
    },
    [cacheAnimes],
  );

  const removeFromLibrary = useCallback((animeId: number) => {
    setEntries((current) => current.filter((e) => e.animeId !== animeId));
  }, []);

  const restoreEntry = useCallback((entry: UserAnime) => {
    setEntries((current) =>
      current.some((e) => e.animeId === entry.animeId) ? current : [...current, entry],
    );
  }, []);

  const patchEntry = useCallback((animeId: number, patch: Partial<UserAnime>) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.animeId === animeId
          ? { ...entry, ...patch, updatedAt: new Date().toISOString() }
          : entry,
      ),
    );
  }, []);

  /** Returns true when this change completed the series (so callers can celebrate). */
  const setEpisode = useCallback(
    (animeId: number, episode: number) => {
      let completed = false;
      setEntries((current) =>
        current.map((entry) => {
          if (entry.animeId !== animeId) return entry;
          const result = applyEpisode(entry, animes.get(animeId), episode, settings.autoComplete);
          completed = result.justCompleted;
          return result.entry;
        }),
      );
      return completed;
    },
    [animes, settings.autoComplete],
  );

  const setStatus = useCallback(
    (animeId: number, status: WatchStatus) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.animeId === animeId ? applyStatus(entry, animes.get(animeId), status) : entry,
        ),
      );
    },
    [animes],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const replaceAll = useCallback(
    (nextEntries: UserAnime[], nextAnimes: Anime[], nextSettings?: Settings | null) => {
      // Restore point taken *before* the overwrite, so an unwanted import is undoable.
      captureSnapshot(entriesRef.current, 'import');
      setEntries(nextEntries);
      setAnimes((current) => {
        const merged = new Map(current);
        nextAnimes.forEach((anime) => merged.set(anime.id, anime));
        return merged;
      });
      if (nextSettings) setSettings(nextSettings);
      synced.current = false;
    },
    [],
  );

  const resetAll = useCallback(() => {
    // `storage.clear()` deliberately leaves the snapshots key alone: wiping the
    // library must stay reversible from Settings.
    captureSnapshot(entriesRef.current, 'reset');
    setEntries([]);
    setAnimes(new Map());
    setNotifications([]);
    setSettings(DEFAULT_SETTINGS);
    void storage.clear();
  }, []);

  /** Puts an old snapshot back as the current watchlist. */
  const restoreSnapshot = useCallback((snapshotEntries: UserAnime[]) => {
    captureSnapshot(entriesRef.current, 'manuel');
    setEntries(snapshotEntries);
    synced.current = false;
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      ready,
      entries,
      animes,
      settings,
      notifications,
      refreshing,
      backupFileName,
      lastBackupAt,
      refreshBackupTarget,
      backupNow: runBackup,
      getEntry,
      getAnime,
      addToLibrary,
      removeFromLibrary,
      restoreEntry,
      patchEntry,
      setEpisode,
      setStatus,
      cacheAnimes,
      updateSettings,
      markNotificationsRead,
      replaceAll,
      resetAll,
      restoreSnapshot,
    }),
    [
      ready,
      entries,
      animes,
      settings,
      notifications,
      refreshing,
      backupFileName,
      lastBackupAt,
      refreshBackupTarget,
      runBackup,
      getEntry,
      getAnime,
      addToLibrary,
      removeFromLibrary,
      restoreEntry,
      patchEntry,
      setEpisode,
      setStatus,
      cacheAnimes,
      updateSettings,
      markNotificationsRead,
      replaceAll,
      resetAll,
      restoreSnapshot,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary doit être utilisé dans un LibraryProvider');
  return context;
}

/** Joins entries with their catalogue data, dropping any that are not cached yet. */
export function joinEntries(entries: UserAnime[], animes: Map<number, Anime>): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  for (const user of entries) {
    const anime = animes.get(user.animeId);
    if (anime) out.push({ user, anime });
  }
  return out;
}
