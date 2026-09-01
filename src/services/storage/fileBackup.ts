import type { BackupFile } from '@/types';

/**
 * Continuous backup to a real file on disk, via the File System Access API.
 *
 * This is the only mechanism that survives *everything*: clearing the browser,
 * changing machine, or moving the app to another URL (where `localStorage`
 * would start empty). The user picks the file once; the handle is kept in
 * IndexedDB and reused on every launch.
 *
 * Chromium-only. When unsupported, the app falls back to manual export and the
 * UI says so rather than pretending the backup is running.
 */

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

type PermissionMode = { mode: 'read' | 'readwrite' };

interface WritableHandle extends FileSystemFileHandle {
  queryPermission?: (options: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (options: PermissionMode) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

const DB_NAME = 'kagami-backup';
const STORE = 'handles';
const HANDLE_KEY = 'auto-backup';

export function isFileBackupSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/** A file handle cannot be JSON-serialised, so it lives in IndexedDB. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(value: FileSystemFileHandle | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (value) store.put(value, HANDLE_KEY);
    else store.delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<WritableHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<WritableHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as WritableHandle) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** Asks the user where to keep the backup file. Returns its name, or null. */
export async function chooseBackupFile(): Promise<string | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'kagami-watchlist.json',
      types: [
        { description: 'Sauvegarde Kagami', accept: { 'application/json': ['.json'] } },
      ],
    });
    await idbSet(handle);
    return handle.name;
  } catch {
    // The user dismissed the picker — not an error.
    return null;
  }
}

export async function forgetBackupFile(): Promise<void> {
  await idbSet(null);
}

export interface BackupTarget {
  handle: WritableHandle;
  name: string;
}

/**
 * Returns the stored target if we still hold write permission.
 * `interactive: false` never prompts, so it is safe to call on every launch.
 */
export async function getBackupTarget(interactive = false): Promise<BackupTarget | null> {
  const handle = await idbGet();
  if (!handle) return null;

  try {
    const current = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (current === 'granted') return { handle, name: handle.name };
    if (!interactive) return null;

    const asked = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    return asked === 'granted' ? { handle, name: handle.name } : null;
  } catch {
    return null;
  }
}

export async function writeBackupFile(
  target: BackupTarget,
  backup: BackupFile,
): Promise<boolean> {
  try {
    const writable = await target.handle.createWritable();
    await writable.write(JSON.stringify(backup, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
