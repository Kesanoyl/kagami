/**
 * Makes the browser treat this app's data as precious.
 *
 * By default a browser may evict `localStorage` for a site under storage
 * pressure. `navigator.storage.persist()` opts out of that: once granted, the
 * data is only removed if the user explicitly clears it.
 */

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  /** Bytes currently used by this origin, when the browser reports it. */
  usage: number | null;
  quota: number | null;
}

export async function requestPersistentStorage(): Promise<StorageStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { supported: false, persisted: false, usage: null, quota: null };
  }

  let persisted = false;
  try {
    persisted = await navigator.storage.persisted();
    // Chrome grants this silently for engaged sites; Firefox may prompt.
    if (!persisted) persisted = await navigator.storage.persist();
  } catch {
    persisted = false;
  }

  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const estimate = await navigator.storage.estimate();
    usage = estimate.usage ?? null;
    quota = estimate.quota ?? null;
  } catch {
    /* estimate is optional */
  }

  return { supported: true, persisted, usage, quota };
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
