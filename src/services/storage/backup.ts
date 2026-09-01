import type { Anime, BackupFile, ImportPreview, Settings, UserAnime } from '@/types';
import { coerceAnime, coerceEntry, coerceSettings, isRecord } from './coerce';

export function buildBackup(
  entries: UserAnime[],
  animes: Anime[],
  settings: Settings,
): BackupFile {
  const kept = new Set(entries.map((e) => e.animeId));
  return {
    app: 'kagami',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    // Only ship catalogue data the entries actually need.
    animes: animes.filter((a) => kept.has(a.id)),
    settings,
  };
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = backup.exportedAt.slice(0, 10);
  link.href = url;
  link.download = `kagami-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export class InvalidBackupError extends Error {}

export interface ParsedBackup {
  entries: UserAnime[];
  animes: Anime[];
  settings: Settings | null;
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidBackupError("Ce fichier n'est pas un JSON valide.");
  }

  if (!isRecord(json) || !Array.isArray(json.entries)) {
    throw new InvalidBackupError("Structure inattendue : la clé « entries » est introuvable.");
  }

  const entries = json.entries.map(coerceEntry).filter((e): e is UserAnime => e !== null);
  if (entries.length === 0) {
    throw new InvalidBackupError('Aucune entrée exploitable dans ce fichier.');
  }

  const animes = Array.isArray(json.animes)
    ? json.animes.map(coerceAnime).filter((a): a is Anime => a !== null)
    : [];

  const settings = isRecord(json.settings) ? coerceSettings(json.settings) : null;

  return { entries, animes, settings };
}

/** What the user sees before committing to an import. */
export function previewImport(parsed: ParsedBackup, current: UserAnime[]): ImportPreview {
  const byId = new Map(current.map((e) => [e.animeId, e]));
  let newEntries = 0;
  let updatedEntries = 0;
  let unchangedEntries = 0;

  for (const entry of parsed.entries) {
    const existing = byId.get(entry.animeId);
    if (!existing) {
      newEntries++;
    } else if (
      existing.status !== entry.status ||
      existing.currentEpisode !== entry.currentEpisode ||
      existing.rating !== entry.rating ||
      existing.notes !== entry.notes
    ) {
      updatedEntries++;
    } else {
      unchangedEntries++;
    }
  }

  return {
    totalEntries: parsed.entries.length,
    newEntries,
    updatedEntries,
    unchangedEntries,
    hasSettings: parsed.settings !== null,
  };
}
