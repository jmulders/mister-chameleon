/**
 * Platform - IP company cache (read-only).
 *
 * The platform-wide IP to company lookup cache (ip_company_cache): one paid
 * Leadinfo identify per IP per freshness window, shared across every tenant.
 * This screen shows what firmographics we hold and lets a super-admin clear the
 * whole cache. Read-only per row (no per-row refresh). Keyed by a one-way IP
 * hash; no IP, hash, or raw payload is shown.
 */

import { requireSuperAdmin } from "@/lib/admin-auth/authorization";
import { fetchIpCacheAction } from "./actions";
import { IpCacheClient } from "./_components/IpCacheClient";

export const dynamic = "force-dynamic";

export default async function IpCachePage() {
  await requireSuperAdmin();
  const overview = await fetchIpCacheAction();

  return (
    <div className="p-8 max-w-6xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Platform</div>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">IP company cache</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-600">
        Firmographics we resolved from visitor IPs, cached platform-wide so a paid Leadinfo lookup runs at most
        once per IP per freshness window and is reused across all tenants. Matched entries stay fresh for 30 days,
        unmatched for 7. The cache is keyed by a one-way IP hash; no IP address, hash, or raw response is stored
        here or shown below.
      </p>
      <p className="mt-2 max-w-3xl rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Read-only. Entries refresh automatically on the next lookup after they go stale. Clearing the cache only
        discards data we would re-query, so it is safe; it does not affect any tenant configuration.
      </p>
      <div className="mt-6">
        <IpCacheClient initial={overview} />
      </div>
    </div>
  );
}
