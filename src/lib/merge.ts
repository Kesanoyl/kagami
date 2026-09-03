import type { UserAnime } from '@/types';

/**
 * Union of two watchlists, never a replacement.
 *
 * Used whenever two versions of the library meet — most importantly when a
 * second browser tab writes to `localStorage` while this one is open. Naïve
 * last-write-wins would silently discard everything the other tab did.
 *
 * Rules: an entry present on either side is kept; when both sides have it, the
 * most recently updated one wins.
 */
export function mergeEntries(mine: UserAnime[], theirs: UserAnime[]): UserAnime[] {
  const byId = new Map<number, UserAnime>();

  for (const entry of mine) byId.set(entry.animeId, entry);

  for (const entry of theirs) {
    const existing = byId.get(entry.animeId);
    if (!existing) {
      byId.set(entry.animeId, entry);
      continue;
    }
    // localeCompare on ISO strings orders them correctly.
    if (entry.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byId.set(entry.animeId, entry);
    }
  }

  return [...byId.values()];
}

/** True when the two lists hold the same entries with the same timestamps. */
export function sameEntries(a: UserAnime[], b: UserAnime[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((entry) => [entry.animeId, entry.updatedAt]));
  return b.every((entry) => byId.get(entry.animeId) === entry.updatedAt);
}
