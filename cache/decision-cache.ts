/**
 * Cache Layer — Decision Plan In-Process Cache
 *
 * Caches the resolved ExperiencePlan per (sessionId, contextHash) pair so the
 * rules engine is not re-evaluated on every page view within the same session
 * when the visitor context has not meaningfully changed.
 *
 * ─── Key schema ───────────────────────────────────────────────────────────────
 *
 *   Primary key: "{sessionId}:{contextHash}"
 *
 *   contextHash is a stable djb2 hash of the decision-relevant subset of the
 *   DecisionInput (source, device, geo-country, industry, UTM params,
 *   visit-type, page-view bucket, CTA click status).  Fields that do NOT
 *   influence the decision (raw IP, requestId, enrichment debug data) are
 *   excluded so they don't cause spurious cache invalidations.
 *
 * ─── Enabling / disabling ─────────────────────────────────────────────────────
 *
 *   Disabled by default in development so rule changes are visible immediately
 *   without a restart.
 *
 *   Force-enable in dev:  DECISION_FORCE_CACHE=true
 *   TTL override:         DECISION_CACHE_TTL_SECONDS=<number>  (default: 300 = 5 min)
 *
 * ─── Storage ─────────────────────────────────────────────────────────────────
 *
 *   An in-process Map.  Not shared across replicas or cold starts.
 *   Worst case on a cold start: one extra rule evaluation per session.
 */

import type { ExperiencePlan } from "@/decision/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const _IS_DEV       = process.env.NODE_ENV === "development";
const _FORCE_CACHE  = process.env.DECISION_FORCE_CACHE === "true";
const _TTL_OVERRIDE = process.env.DECISION_CACHE_TTL_SECONDS
  ? Number(process.env.DECISION_CACHE_TTL_SECONDS) * 1_000
  : null;

/**
 * Whether the decision plan cache is active.
 *
 * Always true in production.  False in development unless
 * `DECISION_FORCE_CACHE=true` is set.
 */
export const DECISION_CACHE_ENABLED: boolean = !_IS_DEV || _FORCE_CACHE;

/** TTL for every entry.  Defaults to 5 minutes. */
export const DECISION_CACHE_TTL_MS: number = _TTL_OVERRIDE ?? 5 * 60 * 1_000;

// ── Internal store ────────────────────────────────────────────────────────────

interface DecisionEntry {
  plan:      ExperiencePlan;
  tenantId:  string | null | undefined;
  cachedAt:  number;
}

/** Primary index: `${sessionId}:${contextHash}` → entry. */
const _store = new Map<string, DecisionEntry>();

/**
 * Secondary index: sessionId → most recent cachedAt across all context-hash
 * variants.  Used by getDecisionPlanMeta to report whether any plan exists for
 * this session without needing the contextHash.
 */
const _sessionIndex = new Map<string, number>();

// ── Private helpers ───────────────────────────────────────────────────────────

function _storeKey(sessionId: string, contextHash: string): string {
  return `${sessionId}:${contextHash}`;
}

function _isStale(entry: DecisionEntry): boolean {
  return Date.now() - entry.cachedAt > DECISION_CACHE_TTL_MS;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieve the cached plan for (sessionId, contextHash).
 *
 * Returns null on cache miss, disabled cache, or stale entry.
 */
export function getDecisionPlan(
  sessionId:   string,
  contextHash: string,
): ExperiencePlan | null {
  if (!DECISION_CACHE_ENABLED) return null;
  const entry = _store.get(_storeKey(sessionId, contextHash));
  if (!entry) return null;
  if (_isStale(entry)) {
    _store.delete(_storeKey(sessionId, contextHash));
    return null;
  }
  return entry.plan;
}

/**
 * Store a resolved plan for (sessionId, contextHash).
 *
 * No-op when the cache is disabled.
 */
export function setDecisionPlan(
  sessionId:   string,
  contextHash: string,
  plan:        ExperiencePlan,
  tenantId:    string | null | undefined,
): void {
  if (!DECISION_CACHE_ENABLED) return;
  const now = Date.now();
  _store.set(_storeKey(sessionId, contextHash), { plan, tenantId, cachedAt: now });
  // Update secondary session index with the most recent cachedAt.
  const prev = _sessionIndex.get(sessionId) ?? 0;
  if (now > prev) _sessionIndex.set(sessionId, now);
}

/**
 * Returns metadata about whether a plan exists for this session.
 *
 * Useful for the debug overlay: reports cache age without needing the
 * contextHash (which is not known at the observability-read site in page.tsx).
 *
 * `exists` is false when the cache is disabled, no plan has been stored for
 * this session, or all entries for this session have expired.
 */
export function getDecisionPlanMeta(
  sessionId: string,
): { exists: boolean; ageMs: number | null } {
  if (!DECISION_CACHE_ENABLED) return { exists: false, ageMs: null };
  const cachedAt = _sessionIndex.get(sessionId);
  if (cachedAt === undefined) return { exists: false, ageMs: null };
  const ageMs = Date.now() - cachedAt;
  if (ageMs > DECISION_CACHE_TTL_MS) {
    _sessionIndex.delete(sessionId);
    return { exists: false, ageMs: null };
  }
  return { exists: true, ageMs };
}

/**
 * Compute a stable short hash of the decision-relevant fields of a
 * DecisionInput / visitor context object.
 *
 * Only includes fields that actually influence the decision engine output.
 * Fields like raw IP, requestId, and enrichment debug data are excluded
 * to prevent spurious cache invalidations.
 *
 * Uses a djb2 XOR variant with 32-bit unsigned arithmetic.
 */
export function hashDecisionContext(context: Record<string, unknown>): string {
  const relevant = {
    source:        context["source"],
    device:        context["device"],
    country:       context["geoCountry"] ?? context["country"],
    industry:      context["industry"],
    utmSource:     context["utmSource"],
    utmMedium:     context["utmMedium"],
    utmCampaign:   context["utmCampaign"],
    utmContent:    context["utmContent"],
    visitType:     context["visitType"],
    pageViewBucket: context["pageViewBucket"],
    hasClickedCta: context["hasClickedCta"],
  };

  // Stable serialisation: sort keys so insertion order doesn't matter.
  const str = JSON.stringify(relevant, Object.keys(relevant).sort());

  // djb2 XOR hash
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface DecisionCacheStats {
  size:  number;
  fresh: number;
  stale: number;
}

export function getDecisionCacheStats(): DecisionCacheStats {
  let fresh = 0;
  let stale = 0;
  const now = Date.now();
  for (const entry of _store.values()) {
    if (now - entry.cachedAt > DECISION_CACHE_TTL_MS) stale++;
    else fresh++;
  }
  return { size: _store.size, fresh, stale };
}

// ── Invalidation helpers ──────────────────────────────────────────────────────

/**
 * Evict all decision plans for a specific tenant.
 * Called by the invalidation handler on "tenant-config-changed" events.
 */
export function pruneDecisionCacheForTenant(
  tenantId: string | null | undefined,
): void {
  for (const [key, entry] of _store.entries()) {
    if (entry.tenantId === tenantId) {
      _store.delete(key);
    }
  }
  // Rebuild session index for remaining entries.
  _sessionIndex.clear();
  for (const [key, entry] of _store.entries()) {
    const sessionId = key.split(":")[0];
    if (sessionId) {
      const prev = _sessionIndex.get(sessionId) ?? 0;
      if (entry.cachedAt > prev) _sessionIndex.set(sessionId, entry.cachedAt);
    }
  }
}

/**
 * Evict the decision plan for a specific session.
 * Called by the invalidation handler on "session-reset" events.
 */
export function pruneDecisionCacheForSession(sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
  _sessionIndex.delete(sessionId);
}

/** Evict every decision plan entry. */
export function flushAllDecisionCache(): void {
  _store.clear();
  _sessionIndex.clear();
}
