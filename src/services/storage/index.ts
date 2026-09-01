import { LocalStorageAdapter } from './localStorage';
import type { StorageAdapter } from './adapter';

/** Single swap point: change this line to move the app to a remote backend. */
export const storage: StorageAdapter = new LocalStorageAdapter();

export { DEFAULT_SETTINGS } from './adapter';
export type { StorageAdapter } from './adapter';
