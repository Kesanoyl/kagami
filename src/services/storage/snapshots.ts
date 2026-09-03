import type { UserAnime } from '@/types';
import { coerceEntries } from './coerce';

/**
 * Rolling local snapshots of the watchlist.
 *
 * This is the safety net behind every destructive action (import, reset, or a
 * bug in a future version): the previous state is always one click away in
 * Settings. Only `UserAnime[]` is captured — catalogue data is re-fetchable and
 * would blow through the storage quota for no benefit.
 */

const KEY = 'kagami:v1:snapshots';
const MAX_SNAPSHOTS = 6;
/** At most one automatic snapshot per day, so daily use does not churn them. */
const AUTO_INTERVAL = 20 * 60 * 60 * 1000;

export interface Snapshot {
  at: string;
  reason: 'auto' | 'import' | 'reset' | 'manuel';
  entryCount: number;
  entries: UserAnime[];
}

function read(): Snapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        at: typeof s.at === 'string' ? s.at : new Date(0).toISOString(),
        reason: (['auto', 'import', 'reset', 'manuel'] as const).includes(s.reason as never)
          ? (s.reason as Snapshot['reason'])
          : 'auto',
        entryCount: typeof s.entryCount === 'number' ? s.entryCount : 0,
        entries: coerceEntries(s.entries),
      }));
  } catch {
    return [];
  }
}

function write(snapshots: Snapshot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
  } catch {
    // Out of quota: drop the oldest half rather than losing the newest state.
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshots.slice(0, 2)));
    } catch {
      /* nothing else to do — the live data still matters more */
    }
  }
}

export function listSnapshots(): Snapshot[] {
  return read().sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Records a snapshot. Used before anything destructive.
 * Consecutive identical captures are collapsed so a single action (which can
 * trigger both an explicit capture and the adapter's safety net) does not eat
 * two of the six slots.
 */
export function captureSnapshot(entries: UserAnime[], reason: Snapshot['reason']): void {
  if (entries.length === 0) return;

  const snapshots = read().sort((a, b) => b.at.localeCompare(a.at));
  const [latest] = snapshots;
  const isDuplicate =
    latest &&
    latest.entryCount === entries.length &&
    Date.now() - new Date(latest.at).getTime() < 5000;
  if (isDuplicate) return;

  write([
    { at: new Date().toISOString(), reason, entryCount: entries.length, entries },
    ...snapshots,
  ]);
}

/** Records a snapshot only if the most recent one is old enough. */
export function captureDailySnapshot(entries: UserAnime[]): void {
  if (entries.length === 0) return;
  const [latest] = listSnapshots();
  if (latest && Date.now() - new Date(latest.at).getTime() < AUTO_INTERVAL) return;
  captureSnapshot(entries, 'auto');
}

export function clearSnapshots(): void {
  localStorage.removeItem(KEY);
}
