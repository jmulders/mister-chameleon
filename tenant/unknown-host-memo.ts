/**
 * tenant/unknown-host-memo.ts
 *
 * Remembers, for a short while, hostnames that are known not to belong to any
 * tenant.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 *
 * A request for a hostname the platform does not know costs three database
 * reads before it lands on the fallback tenant: the domain table, a scan of
 * every tenant's settings, and the host-resolution cache. None of that is
 * cached, because a miss is deliberately never stored in the shared cache (a
 * stored miss could pin a real customer domain to the wrong site).
 *
 * Measured on production on 13 Nov 2026: right after a deploy, 56 requests
 * came in on the deployment's own vercel.app address within ten seconds. That
 * was 168 reads, 56 of them full scans of tenant_settings, and it made simple
 * lookups take four seconds. From 27 May to 13 Nov the full scan ran 79,053
 * times.
 *
 * ─── What is safe to remember ─────────────────────────────────────────────────
 *
 * Only a miss the database itself confirmed: every lookup answered without an
 * error and found nothing. A lookup that failed says nothing about the host,
 * so it is never remembered. The memory is per server instance and short, so a
 * domain added in the admin is picked up within UNKNOWN_HOST_TTL_MS.
 */

/** How long a confirmed miss is remembered. */
export const UNKNOWN_HOST_TTL_MS = 60_000;

/** Hard ceiling, so a scan with made-up hostnames cannot grow the map. */
export const UNKNOWN_HOST_MAX = 500;

const unknownUntil = new Map<string, number>();

const norm = (host: string) => host.toLowerCase().trim();

/** True when `host` was confirmed unknown less than UNKNOWN_HOST_TTL_MS ago. */
export function isUnknownHost(host: string, nowMs: number = Date.now()): boolean {
  const key   = norm(host);
  const until = unknownUntil.get(key);
  if (until === undefined) return false;
  if (nowMs < until) return true;
  unknownUntil.delete(key);
  return false;
}

/** Remember that the database confirmed `host` belongs to no tenant. */
export function rememberUnknownHost(host: string, nowMs: number = Date.now()): void {
  const key = norm(host);
  if (!key) return;
  if (!unknownUntil.has(key) && unknownUntil.size >= UNKNOWN_HOST_MAX) {
    for (const [k, until] of unknownUntil) {
      if (until <= nowMs) unknownUntil.delete(k);
    }
    if (unknownUntil.size >= UNKNOWN_HOST_MAX) unknownUntil.clear();
  }
  unknownUntil.set(key, nowMs + UNKNOWN_HOST_TTL_MS);
}

/** Forget `host`, for example once it resolved to a tenant. */
export function forgetUnknownHost(host: string): void {
  unknownUntil.delete(norm(host));
}

/** Number of remembered hosts. For tests. */
export function unknownHostCount(): number {
  return unknownUntil.size;
}

/** Forget everything. For tests. */
export function resetUnknownHosts(): void {
  unknownUntil.clear();
}

/**
 * May a miss be remembered?
 *
 * @param domainLookupDefinitive  The domain lookup answered without an error.
 * @param persistedLookupOk       The host-resolution cache answered without an error.
 * @param knownProductionHost     The host is hard-coded as a production domain.
 */
export function mayRememberUnknown(input: {
  domainLookupDefinitive: boolean;
  persistedLookupOk:      boolean;
  knownProductionHost:    boolean;
}): boolean {
  return input.domainLookupDefinitive && input.persistedLookupOk && !input.knownProductionHost;
}
