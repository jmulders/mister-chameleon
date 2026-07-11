/**
 * Lead Base — suppression list.
 *
 * Emails that must NOT be marketed to: unsubscribes, opt-outs, consent
 * withdrawals. Suppressed emails are excluded from retargeting audiences (the
 * ad-sync segment resolver skips them) and removed from the ad platforms on
 * suppression. Keyed by lowercased email per tenant. Service-role client.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";

/** Suppress an email for a tenant (idempotent). */
export async function addSuppression(
  tenantId: string,
  email:    string,
  reason?:  string | null,
  source?:  string | null,
): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db
      .from("lead_suppressions")
      .upsert(
        { tenant_id: tenantId, email: e, reason: reason ?? null, source: source ?? null },
        { onConflict: "tenant_id,email" },
      );
    return !error;
  } catch (err) {
    logger.warn("[lead-base] addSuppression failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Lift a suppression (re-opt-in). */
export async function removeSuppression(tenantId: string, email: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db
      .from("lead_suppressions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("email", email.trim().toLowerCase());
    return !error;
  } catch {
    return false;
  }
}

/** All suppressed (lowercased) emails for a tenant, as a lookup set. */
export async function listSuppressedEmails(tenantId: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("lead_suppressions")
        .select("email")
        .eq("tenant_id", tenantId)
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as Array<{ email: string }>) out.add(String(r.email).toLowerCase());
      if (data.length < PAGE) break;
    }
  } catch (err) {
    logger.warn("[lead-base] listSuppressedEmails failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
  return out;
}
