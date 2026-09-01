import type { Anime, Settings, UserAnime, WatchStatus } from '@/types';
import { DEFAULT_SETTINGS } from './adapter';

/**
 * Defensive rehydration.
 *
 * Everything read back from disk goes through here. The rule is absolute:
 * **an entry is never dropped because a field is missing or malformed** — the
 * field is filled with a sane default instead. That is what makes it safe to
 * add or rename fields in a future version of the app without losing the
 * watchlist that is already stored.
 */

const STATUSES: WatchStatus[] = ['watching', 'completed', 'planned', 'paused', 'dropped'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringOrNull(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : null;
}

/** Returns null only when there is no usable id at all — nothing else disqualifies. */
export function coerceEntry(raw: unknown): UserAnime | null {
  if (!isRecord(raw)) return null;

  const animeId = toInt(raw.animeId, 0);
  if (animeId <= 0) return null;

  const now = new Date().toISOString();
  const status = STATUSES.includes(raw.status as WatchStatus)
    ? (raw.status as WatchStatus)
    : 'planned';

  const rating =
    typeof raw.rating === 'number' && raw.rating >= 0 && raw.rating <= 10
      ? Math.round(raw.rating * 10) / 10
      : null;

  return {
    animeId,
    status,
    currentEpisode: Math.max(0, toInt(raw.currentEpisode, 0)),
    currentSeason:
      typeof raw.currentSeason === 'number' && raw.currentSeason > 0 ? raw.currentSeason : null,
    currentPart: toStringOrNull(raw.currentPart, 60),
    currentArc: toStringOrNull(raw.currentArc, 120),
    rating,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 20_000) : '',
    notesUpdatedAt: typeof raw.notesUpdatedAt === 'string' ? raw.notesUpdatedAt : null,
    favorite: raw.favorite === true,
    rewatches: Math.max(0, toInt(raw.rewatches, 0)),
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    history: Array.isArray(raw.history)
      ? raw.history
          .filter(
            (h): h is { at: string; episode: number } =>
              isRecord(h) && typeof h.at === 'string' && typeof h.episode === 'number',
          )
          .slice(-500)
      : [],
  };
}

/** Catalogue records are replaceable, so this one is allowed to be strict-ish. */
export function coerceAnime(raw: unknown): Anime | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id, 0);
  if (id <= 0 || typeof raw.title !== 'string') return null;

  return {
    ...(raw as unknown as Anime),
    id,
    title: raw.title,
    genres: Array.isArray(raw.genres) ? (raw.genres as string[]) : [],
    cachedAt: typeof raw.cachedAt === 'number' ? raw.cachedAt : Date.now(),
  };
}

export function coerceSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const reminders = isRecord(raw.reminders) ? raw.reminders : {};
  return {
    ...DEFAULT_SETTINGS,
    ...(raw as Partial<Settings>),
    // Nested object: merged key by key, so a new reminder type defaults on.
    reminders: { ...DEFAULT_SETTINGS.reminders, ...(reminders as Partial<Settings['reminders']>) },
  };
}

export function coerceEntries(raw: unknown): UserAnime[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: UserAnime[] = [];
  for (const item of raw) {
    const entry = coerceEntry(item);
    // A duplicated id would silently shadow one of the two entries later on.
    if (!entry || seen.has(entry.animeId)) continue;
    seen.add(entry.animeId);
    out.push(entry);
  }
  return out;
}

export function coerceAnimes(raw: unknown): Anime[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceAnime).filter((a): a is Anime => a !== null);
}
