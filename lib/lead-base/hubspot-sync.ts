/**
 * Lead Base — HubSpot Company sync.
 *
 * On qualification, upsert the lead's account as a HubSpot **Company** (deduped by
 * domain). Company firmographics (name / domain / industry) are exactly what the
 * Lead Base holds, and a Company needs no email — so this works without PII and
 * fits the free HubSpot tier (a private app with `crm.objects.companies.write`).
 *
 * Fail-open: missing token / no domain / API error → no-op, never throws.
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";

const BASE = "https://api.hubapi.com/crm/v3/objects/companies";
const TIMEOUT_MS = 4000;

export interface HubspotCompanyInput {
  name?:     string | null;
  /** Preferred dedup key. When absent, we fall back to deduping by name. */
  domain?:   string | null;
  industry?: string | null;
}

interface HubspotSearchResponse { results?: Array<{ id?: string }> }

async function hsFetch(token: string, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Find an existing HubSpot company id by an exact property match, or null. */
async function findBy(token: string, propertyName: string, value: string): Promise<string | null> {
  const res = await hsFetch(token, `${BASE}/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName, operator: "EQ", value }] }],
      properties: [propertyName],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as HubspotSearchResponse;
  return json.results?.[0]?.id ?? null;
}

/**
 * Upsert a HubSpot company by domain. Returns the company id on success.
 */
export async function syncCompanyToHubspot(
  token:   string,
  company: HubspotCompanyInput,
): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  try {
    if (!company.domain && !company.name) {
      return { ok: false, error: "No domain or name — nothing to upsert." };
    }

    const properties: Record<string, string> = {};
    if (company.domain)   properties.domain   = company.domain;
    if (company.name)     properties.name     = company.name;
    if (company.industry) properties.industry = company.industry;

    // Dedup by domain when available (most reliable); otherwise by exact name.
    const existingId = company.domain
      ? await findBy(token, "domain", company.domain)
      : await findBy(token, "name", company.name!);

    const res = existingId
      ? await hsFetch(token, `${BASE}/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties }) })
      : await hsFetch(token, BASE, { method: "POST", body: JSON.stringify({ properties }) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("[lead-base] HubSpot sync non-2xx", { status: res.status, body: text.slice(0, 200) });
      return { ok: false, error: `HubSpot API ${res.status}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, companyId: json.id };
  } catch (err) {
    logger.warn("[lead-base] syncCompanyToHubspot failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
