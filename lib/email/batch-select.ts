/**
 * Adaptive email — batch audience selection (pure).
 *
 * Turns a tenant's known ABM leads into a de-duplicated list of mailable
 * recipients for a campaign, applying operator-chosen firmographic filters.
 *
 * Pure and dependency-free (no server-only imports) so it is unit-testable and
 * safe to import from anywhere. The actual sending lives in
 * ./send-adaptive-batch; the server action fetches leads and calls this to
 * compute the candidate set the operator confirms before sending.
 */

import type { AbmLead } from "@/lib/abm/abm-store";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** One mailable recipient derived from a known lead. */
export interface BatchRecipient {
  leadId:       string;
  email:        string;
  name:         string | null;
  company:      string | null;
  industry:     string | null;
  companySize:  string | null;
}

/** Operator-chosen filters. Empty/undefined fields mean "no restriction". */
export interface BatchAudienceFilters {
  /** Case-insensitive exact match on profile.industry. */
  industry?:     string;
  /** Case-insensitive exact match on profile.companySize. */
  companySize?:  string;
  /**
   * Only include leads that are still live (status=active, not expired).
   * Defaults to true — you almost never want to mail paused/expired leads.
   */
  activeOnly?:   boolean;
}

function isLive(lead: AbmLead, now: number): boolean {
  if (lead.status !== "active") return false;
  if (lead.expiresAt && new Date(lead.expiresAt).getTime() < now) return false;
  return true;
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Compute the campaign audience from a tenant's leads.
 *
 * Rules, in order:
 *   1. (default) drop leads that are not live;
 *   2. drop leads without a valid email in their profile;
 *   3. apply industry / companySize filters (case-insensitive exact match);
 *   4. de-duplicate by lowercased email — first occurrence wins.
 *
 * The input order is preserved (callers pass newest-first), so the first
 * lead seen for a given email is kept.
 *
 * @param leads    Tenant leads (e.g. from listAbmLeads).
 * @param filters  Optional firmographic filters.
 * @param now      Injectable clock for tests. Defaults to Date.now().
 */
export function selectBatchRecipients(
  leads:   AbmLead[],
  filters: BatchAudienceFilters = {},
  now:     number = Date.now(),
): BatchRecipient[] {
  const activeOnly = filters.activeOnly !== false;
  const wantIndustry = norm(filters.industry);
  const wantSize     = norm(filters.companySize);

  const seen = new Set<string>();
  const out: BatchRecipient[] = [];

  for (const lead of leads) {
    if (activeOnly && !isLive(lead, now)) continue;

    const email = norm(lead.profile.email);
    if (!email || !EMAIL_RE.test(email)) continue;

    if (wantIndustry && norm(lead.profile.industry) !== wantIndustry) continue;
    if (wantSize && norm(lead.profile.companySize) !== wantSize) continue;

    if (seen.has(email)) continue;
    seen.add(email);

    out.push({
      leadId:      lead.id,
      email,
      name:        lead.profile.firstName || lead.profile.name || null,
      company:     lead.profile.company ?? null,
      industry:    lead.profile.industry ?? null,
      companySize: lead.profile.companySize ?? null,
    });
  }

  return out;
}

/** Distinct, sorted non-empty values of a profile field across live-eligible leads. */
export function collectFilterOptions(
  leads: AbmLead[],
  field: "industry" | "companySize",
): string[] {
  const set = new Set<string>();
  for (const lead of leads) {
    const v = lead.profile[field];
    if (typeof v === "string" && v.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
