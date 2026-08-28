/**
 * Platform - first-party company DB (read-only).
 *
 * The durable, platform-wide IP to company store (ip_company_cache): a paid
 * Leadinfo identify per IP per freshness window, shared across every tenant and
 * reused first-party to skip paid calls. This screen shows the firmographics we
 * hold (incl. the raw provider payload and pool stats) and lets a super-admin
 * clear the whole store. Read-only per row. Keyed by a one-way IP hash; no IP or
 * hash is shown.
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
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">First-party company DB</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-600">
        Firmographics we resolved from visitor IPs, held platform-wide so a paid Leadinfo lookup runs at most once
        per IP per freshness window and is reused across all tenants (first-party). Matched entries stay fresh for
        30 days, unmatched for 7, then serve stale while being re-verified up to 180 / 30 days. The store is keyed
        by a one-way IP hash; no IP address or hash is shown. The raw provider payload below is company-level data,
        not personal data.
      </p>
      <p className="mt-2 max-w-3xl rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Read-only. Entries refresh automatically on the next lookup after they expire. Clearing the store only
        discards data we would re-query, so it is safe; it does not affect any tenant configuration.
      </p>
      <div className="mt-6">
        <IpCacheClient initial={overview} />
      </div>
    </div>
  );
}
