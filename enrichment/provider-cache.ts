/**
 * Enrichment Layer — In-Process Provider Cache
 *
 * A lightweight, TTL-based in-memory cache for use inside individual
 * enrichment providers.  Each provider that makes external API calls
 * maintains its own module-level `ProviderCache` instance, keyed by the
 * lookup key that is most stable for that provider (IP, domain, org name, …).
 *
 * ─── Why in-process rather than distributed? ────────────────────────────────
 *
 *   The data being cached (company lookups, holiday lists, domain matches)
 *   is stable within the cache TTL window.  An in-process Map is:
 *     • Zero-latency on hit (no network roundtrip)
 *     • Zero-dependency (no Redis / KV setup required)
 *     • Safe to lose on cold-start (lookup simply re-runs)
 *
 *   The process-level cache survives hot reloads in dev and is shared
 *   across concurrent requests within the same Node.js process.  On
 *   Vercel serverless it resets on cold start — acceptable because TTLs
 *   are conservative and the worst case is one extra API call.
 *
 * ─── Cache key design ────────────────────────────────────────────────────────
 *
 *   Each provider chooses its own key:
 *     Leadinfo:       effective IP address (1 h TTL)
 *     OpenKvK:        normalized query string (6 h TTL)
 *     HubSpot domain: lowercase domain name (2 h TTL)
 *     Nager.Date:     "{countryCode}:{year}" (24 h TTL)
 *
 * ─── Debug / observability ───────────────────────────────────────────────────
 *
 *   `getCacheResult` returns a discriminated union that includes a `hit`
 *   boolean.  Callers can emit a debug log when `hit === true` so the
 *   pipeline trace shows cache reuse.
 */

// ── ProviderCache ─────────────────────────────────────────────────────────────

interface CacheEntry<V> {
  value:     V;
  cachedAt:  number; // Date.now() ms
}

/** Result of a cache lookup — discriminated union for clear branching. */
export type CacheResult<V> =
  | { hit: true;  value: V }
  | { hit: false };

/** Snapshot of cache occupancy for observability. */
export interface ProviderCacheStats {
  /** Total entries currently stored (including potentially stale). */
  size:    number;
  /** Entries that have not yet exceeded their TTL. */
  fresh:   number;
  /** Entries past TTL but not yet evicted (lazy eviction). */
  stale:   number;
  /** Configured TTL in milliseconds. */
  ttlMs:   number;
}

/**
 * Generic in-process TTL cache for enrichment provider results.
 *
 * Thread-safe for single-threaded Node.js (no locking needed).
 * All methods are synchronous.
 *
 * @example
 * const cache = new ProviderCache<Partial<EnrichmentOutput>>(60 * 60 * 1000);
 * const result = cache.get("8.8.8.8");
 * if (result.hit) return result.value;
 * const fresh = await fetchFromApi("8.8.8.8");
 * cache.set("8.8.8.8", fresh);
 * return fresh;
 */
export class ProviderCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();

  /**
   * @param ttlMs — Time-to-live in milliseconds.  Entries older than this
   *                are treated as misses and evicted on next access.
   */
  constructor(private readonly ttlMs: number) {}

  /**
   * Look up a key in the cache.
   *
   * Returns `{ hit: true, value }` when a fresh entry exists.
   * Returns `{ hit: false }` on miss or when the entry has expired.
   * Expired entries are evicted lazily (on access).
   */
  get(key: string): CacheResult<V> {
    const entry = this.store.get(key);
    if (!entry) return { hit: false };

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(key); // lazy eviction
      return { hit: false };
    }

    return { hit: true, value: entry.value };
  }

  /** Store a value for `key`, replacing any existing entry. */
  set(key: string, value: V): void {
    this.store.set(key, { value, cachedAt: Date.now() });
  }

  /** Return true when a fresh entry exists for `key`. */
  has(key: string): boolean {
    return this.get(key).hit;
  }

  /** Number of entries currently in the store (including potentially stale ones). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Evict all entries older than `ttlMs`.
   * Call periodically (e.g. on each cold-start warm-up) to prevent unbounded growth.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.cachedAt > this.ttlMs) this.store.delete(key);
    }
  }

  /**
   * Evict all entries whose key starts with `prefix`.
   *
   * Used for tenant-scoped invalidation: pass the tenant key prefix (e.g.
   * `"acme:"`) to flush all cached data belonging to that tenant without
   * clearing the entire cache.
   */
  pruneForPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Remove all entries from the cache immediately.
   * Use for full invalidation (e.g. environment reset, admin action).
   */
  flush(): void {
    this.store.clear();
  }

  /**
   * Return a snapshot of cache occupancy for observability / debug endpoints.
   */
  stats(): ProviderCacheStats {
    const now = Date.now();
    let fresh = 0;
    let stale = 0;
    for (const entry of this.store.values()) {
      if (now - entry.cachedAt <= this.ttlMs) fresh++;
      else stale++;
    }
    return { size: this.store.size, fresh, stale, ttlMs: this.ttlMs };
  }
}
