import type { SourceHealth } from './types.js';

export interface Cached<T> extends SourceHealth {
  value: T | null;
}

/**
 * TTL cache with stale-while-revalidate. Returns the cached value instantly and
 * refreshes in the background once older than ttlMs. Never throws to callers:
 * a failed refresh keeps the last good value and flips status to 'stale'/'error'.
 */
export function createCache<T>(loader: () => Promise<T>, ttlMs: number) {
  let entry: Cached<T> = { value: null, status: 'error', at: new Date(0).toISOString() };
  let fetchedAt = 0;
  let inFlight: Promise<void> | null = null;

  function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = loader()
      .then((value) => {
        entry = { value, status: 'ok', at: new Date().toISOString() };
        fetchedAt = Date.now();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        entry = { value: entry.value, status: entry.value ? 'stale' : 'error', at: entry.at, error: message };
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    async get(): Promise<Cached<T>> {
      if (entry.value === null) {
        await refresh(); // first call must wait for an initial value
      } else if (Date.now() - fetchedAt > ttlMs) {
        void refresh(); // stale: kick off a background refresh, return current value now
      }
      return entry;
    },
  };
}
