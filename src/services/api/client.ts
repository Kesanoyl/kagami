/**
 * AniList GraphQL transport.
 *
 * Everything the app knows about the network lives here: rate limiting, retries,
 * response caching and request de-duplication. Nothing above this file should
 * ever call `fetch` directly.
 */

const ENDPOINT = 'https://graphql.anilist.co';

/** AniList currently serves 30 req/min; we stay comfortably under it. */
const MAX_REQUESTS_PER_WINDOW = 24;
const WINDOW_MS = 60_000;
/** Minimum spacing between two requests, so a burst never looks like a flood. */
const MIN_GAP_MS = 250;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface CacheRecord {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheRecord>();
const inflight = new Map<string, Promise<unknown>>();

/** Timestamps of the requests sent inside the current rolling window. */
let sentAt: number[] = [];
let lastSent = 0;
/** Set when the server answers 429 — every caller waits until this passes. */
let blockedUntil = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForSlot(): Promise<void> {
  // Loop rather than compute once: several callers may be queued at the same time.
  for (;;) {
    const now = Date.now();

    if (blockedUntil > now) {
      await sleep(blockedUntil - now);
      continue;
    }

    sentAt = sentAt.filter((t) => now - t < WINDOW_MS);

    if (sentAt.length >= MAX_REQUESTS_PER_WINDOW) {
      await sleep(WINDOW_MS - (now - sentAt[0]) + 50);
      continue;
    }

    const gap = now - lastSent;
    if (gap < MIN_GAP_MS) {
      await sleep(MIN_GAP_MS - gap);
      continue;
    }

    sentAt.push(now);
    lastSent = now;
    return;
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; status?: number }[];
}

async function send<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  await waitForSlot();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: signal ?? null,
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '30');
    blockedUntil = Date.now() + (Number.isFinite(retryAfter) ? retryAfter : 30) * 1000;
    throw new ApiError('Trop de requêtes, patiente un instant.', 429, true);
  }

  if (res.status >= 500) {
    throw new ApiError('AniList est momentanément indisponible.', res.status, true);
  }

  const json = (await res.json().catch(() => null)) as GraphQLResponse<T> | null;

  if (!res.ok || !json) {
    const message = json?.errors?.[0]?.message ?? 'Requête refusée par AniList.';
    throw new ApiError(message, res.status, false);
  }

  if (json.errors?.length && json.data == null) {
    throw new ApiError(json.errors[0].message, json.errors[0].status ?? 400, false);
  }

  return json.data as T;
}

export interface RequestOptions {
  /** How long the successful response stays fresh in memory. */
  ttl?: number;
  signal?: AbortSignal;
  retries?: number;
}

const DEFAULT_TTL = 5 * 60_000;

/**
 * Runs a query. Identical concurrent calls share one network round-trip, and
 * results are memoised for `ttl` milliseconds.
 */
export async function request<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { ttl = DEFAULT_TTL, signal, retries = 2 }: RequestOptions = {},
): Promise<T> {
  const key = `${query}::${JSON.stringify(variables)}`;
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data as T;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const run = (async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await send<T>(query, variables, signal);
        cache.set(key, { data, expiresAt: Date.now() + ttl });
        return data;
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
        if (!(error instanceof ApiError) || !error.retryable) throw error;
        if (attempt === retries) break;
        await sleep(500 * 2 ** attempt);
      }
    }

    // A stale cached copy still beats an error screen.
    if (cached) return cached.data as T;
    throw lastError;
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

export function clearApiCache(): void {
  cache.clear();
}
