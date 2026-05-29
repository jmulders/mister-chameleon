/**
 * Cache Layer — CMS In-Process Cache
 *
 * A lightweight, tenant-scoped, TTL-based in-process cache for CMS variant
 * fetches.  Prevents redundant Sanity API calls within the same Node.js process
 * lifetime for content that changes infrequently (hero/proof/cta variants,
 * site settings, page-by-slug).
 *
 * ─── Key schema ───────────────────────────────────────────────────────────────
 *
 *   Variant   → "{tenantId}:variant:{type}:{key}"
 *   Singleton → "{tenantId}:singleton:{key}"
 *   Slug      → "{tenantId}:slug:{type}:{slug}"
 *
 *   tenantId null/undefined maps to the sentinel "_" so platform-level content
 *   (no tenant) is also cached correctly.
 *
 * ─── Enabling / disabling ─────────────────────────────────────────────────────
 *
 *   Disabled by default in development (NODE_ENV=development) so CMS edits are
 *   visible immediately without a restart.
 *
 *   Force-enable in dev:  CMS_FORCE_CACHE=true
 *   TTL override:         CMS_CACHE_TTL_SECONDS=<number>  (default: 300 = 5 min)
 *
 * ─── Negative caching ─────────────────────────────────────────────────────────
 *
 *   Null values returned by the CMS provider (key not found) are stored using
 *   an internal sentinel so repeated misses don't fan out to the CMS API.
 *   Callers receive null back and cannot distinguish a positive hit from a
 *   negative hit — both paths result in the correct final value.
 *
 * ─── Storage ─────────────────────────────────────────────────────────────────
 *
 *   An in-process Map.  Not shared across Vercel replicas or serverless
 *   invocations.  Resets on cold start — worst case is one extra CMS fetch
 *   per process lifetime.  No external dependency required.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const _IS_DEV         = process.env.NODE_ENV === "development";
const _FORCE_CACHE    = process.env.CMS_FORCE_CACHE === "true";
const _TTL_OVERRIDE   = process.env.CMS_CACHE_TTL_SECONDS
  ? Number(process.env.CMS_CACHE_TTL_SECONDS) * 1_000
  : null;

/**
 * Whether the CMS in-process cache is active.
 *
 * Always true in production.  False in development unless `CMS_FORCE_CACHE=true`
 * is set (useful for local load testing or when Sanity has a cold CDN).
 */
export const CMS_CACHE_ENABLED: boolean = !_IS_DEV || _FORCE_CACHE;

/** TTL for every entry.  Defaults to 5 minutes. */
export const CMS_CACHE_TTL_MS: number = _TTL_OVERRIDE ?? 5 * 60 * 1_000;

// ── Internal store ────────────────────────────────────────────────────────────

/** Sentinel stored when the CMS returned null — distinguishes negative hits. */
const _NULL_SENTINEL = Symbol("cms-null");

interface CmsEntry {
  /** Raw value or the null sentinel. */
  value:    unknown | typeof _NULL_SENTINEL;
  cachedAt: number;
}

const _store = new Map<string, CmsEntry>();

// ── Private helpers ───────────────────────────────────────────────────────────

function _tid(tenantId: string | null | undefined): string {
  return tenantId ?? "_";
}

function _isStale(entry: CmsEntry): boolean {
  return Date.now() - entry.cachedAt > CMS_CACHE_TTL_MS;
}

function _get<T>(key: string): T | null {
  if (!CMS_CACHE_ENABLED) return null;
  const entry = _store.get(key);
  if (!entry) return null;
  if (_isStale(entry)) {
    _store.delete(key);
    return null;
  }
  // Negative hit — was cached as null
  if (entry.value === _NULL_SENTINEL) return null as unknown as T;
  return entry.value as T;
}

function _getWithHit(key: string): { found: true; value: unknown } | { found: false } {
  if (!CMS_CACHE_ENABLED) return { found: false };
  const entry = _store.get(key);
  if (!entry) return { found: false };
  if (_isStale(entry)) {
    _store.delete(key);
    return { found: false };
  }
  return { found: true, value: entry.value === _NULL_SENTINEL ? null : entry.value };
}

function _set(key: string, value: unknown): void {
  if (!CMS_CACHE_ENABLED) return;
  _store.set(key, {
    value:    value === null ? _NULL_SENTINEL : value,
    cachedAt: Date.now(),
  });
}

// ── Public API — Variant cache ─────────────────────────────────────────────────

/**
 * Read a CMS variant from the in-process cache.
 *
 * Returns null when:
 *   - cache is disabled
 *   - entry does not exist
 *   - entry is stale (auto-evicted)
 *   - the CMS returned null (negative cache hit — same return value)
 */
export function getCmsVariant<T>(
  tenantId: string | null | undefined,
  type:     string,
  key:      string,
): T | null {
  const result = _getWithHit(`${_tid(tenantId)}:variant:${type}:${key}`);
  if (!result.found) return null;
  return result.value as T | null;
}

/**
 * Store a CMS variant (or null for a negative result) in the in-process cache.
 */
export function setCmsVariant(
  tenantId: string | null | undefined,
  type:     string,
  key:      string,
  value:    unknown,
): void {
  _set(`${_tid(tenantId)}:variant:${type}:${key}`, value);
}

// ── Public API — Singleton cache ───────────────────────────────────────────────

/**
 * Read a CMS singleton (e.g. site settings) from the cache.
 */
export function getCmsSingleton<T>(
  tenantId: string | null | undefined,
  key:      string,
): T | null {
  const result = _getWithHit(`${_tid(tenantId)}:singleton:${key}`);
  if (!result.found) return null;
  return result.value as T | null;
}

/**
 * Store a CMS singleton in the cache.
 */
export function setCmsSingleton(
  tenantId: string | null | undefined,
  key:      string,
  value:    unknown,
): void {
  _set(`${_tid(tenantId)}:singleton:${key}`, value);
}

// ── Public API — Slug cache ────────────────────────────────────────────────────

/**
 * Read a CMS document by slug from the cache.
 */
export function getCmsSlug<T>(
  tenantId: string | null | undefined,
  type:     string,
  slug:     string,
): T | null {
  const result = _getWithHit(`${_tid(tenantId)}:slug:${type}:${slug}`);
  if (!result.found) return null;
  return result.value as T | null;
}

/**
 * Store a CMS document by slug in the cache.
 */
export function setCmsSlug(
  tenantId: string | null | undefined,
  type:     string,
  slug:     string,
  value:    unknown,
): void {
  _set(`${_tid(tenantId)}:slug:${type}:${slug}`, value);
}

// ── Public API — Observability ────────────────────────────────────────────────

/** Stats snapshot of the current in-process cache state. */
export interface CmsCacheStats {
  size:  number;
  fresh: number;
  stale: number;
}

/**
 * Returns a point-in-time snapshot of the cache: how many entries are fresh
 * (within TTL) and how many are stale (past TTL, awaiting lazy eviction).
 */
export function getCmsCacheStats(): CmsCacheStats {
  let fresh = 0;
  let stale = 0;
  const now = Date.now();
  for (const entry of _store.values()) {
    if (now - entry.cachedAt > CMS_CACHE_TTL_MS) {
      stale++;
    } else {
      fresh++;
    }
  }
  return { size: _store.size, fresh, stale };
}

// ── Public API — Invalidation helpers ────────────────────────────────────────

/**
 * Evict all entries belonging to the given tenant.
 * Called by the invalidation handler on "cms-content-updated" or
 * "tenant-config-changed" events.
 */
export function pruneCmsCacheForTenant(tenantId: string | null | undefined): void {
  const prefix = `${_tid(tenantId)}:`;
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) {
      _store.delete(key);
    }
  }
}

/**
 * Evict every entry in the cache regardless of tenant.
 * Called on "full-flush" events.
 */
export function flushAllCmsCache(): void {
  _store.clear();
}
