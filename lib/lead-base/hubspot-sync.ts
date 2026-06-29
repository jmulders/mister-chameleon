/**
 * Lead Base — HubSpot sync.
 *
 * Pushes a recognised lead into HubSpot as first-party CRM data:
 *   • Company  — firmographics (name, domain, employees, revenue, industry) +
 *                a readable description fallback. Deduped by domain, else name.
 *   • Contact  — the named person (first/last name, job title), associated to the
 *                company. Deduped by exact first+last name.
 *   • Note     — a "website visit" timeline entry, associated to both, written at
 *                most once per session by the caller.
 *
 * Every call is fail-open: missing token / API error → no-op, never throws. The
 * `industry` company property is a HubSpot enumeration, so free-text values can
 * 400 the whole write — we retry with only the always-safe properties.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";

const API        = "https://api.hubapi.com";
const COMPANIES  = `${API}/crm/v3/objects/companies`;
const CONTACTS   = `${API}/crm/v3/objects/contacts`;
const NOTES      = `${API}/crm/v3/objects/notes`;
const TIMEOUT_MS = 4000;

export interface HubspotCompanyInput {
  name?:             string | null;
  domain?:           string | null;   // preferred dedup key
  industry?:         string | null;   // enum — best-effort, dropped on 400
  numberOfEmployees?: number | null;
  annualRevenue?:    number | null;
  description?:      string | null;   // free text — safe summary fallback
}

export interface HubspotContactInput {
  firstName?: string | null;
  lastName?:  string | null;
  jobTitle?:  string | null;
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

/** Search an object type by exact-match filters (AND), return the first id. */
async function search(
  token: string,
  searchUrl: string,
  filters: Array<{ propertyName: string; value: string }>,
): Promise<string | null> {
  const res = await hsFetch(token, `${searchUrl}/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: filters.map((f) => ({ ...f, operator: "EQ" })) }],
      properties: filters.map((f) => f.propertyName),
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as HubspotSearchResponse;
  return json.results?.[0]?.id ?? null;
}

/** PUT the default (primary) association between two records. Fail-open. */
async function associateDefault(
  token: string,
  fromType: string, fromId: string,
  toType:   string, toId:   string,
): Promise<void> {
  try {
    await hsFetch(
      token,
      `${API}/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`,
      { method: "PUT", body: "[]" },
    );
  } catch (err) {
    logger.warn("[lead-base] HubSpot associate failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Upsert a HubSpot company. Returns the company id on success. */
export async function syncCompanyToHubspot(
  token:   string,
  company: HubspotCompanyInput,
): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  try {
    if (!company.domain && !company.name) {
      return { ok: false, error: "No domain or name — nothing to upsert." };
    }

    // Always-accepted properties (free text / never validated against an enum).
    const safeProps: Record<string, string> = {};
    if (company.domain)      safeProps.domain      = company.domain;
    if (company.name)        safeProps.name        = company.name;
    if (company.description) safeProps.description  = company.description;

    // Bonus properties that CAN be rejected (enum / numeric). Attempted first,
    // then dropped on a 400 so the core record still lands.
    const tryProps: Record<string, string> = { ...safeProps };
    if (company.industry)                          tryProps.industry          = company.industry;
    if (typeof company.numberOfEmployees === "number") tryProps.numberofemployees = String(company.numberOfEmployees);
    if (typeof company.annualRevenue === "number")     tryProps.annualrevenue     = String(company.annualRevenue);

    const existingId = company.domain
      ? await search(token, COMPANIES, [{ propertyName: "domain", value: company.domain }])
      : await search(token, COMPANIES, [{ propertyName: "name",   value: company.name! }]);

    const write = (props: Record<string, string>) =>
      existingId
        ? hsFetch(token, `${COMPANIES}/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties: props }) })
        : hsFetch(token, COMPANIES, { method: "POST", body: JSON.stringify({ properties: props }) });

    let res = await write(tryProps);
    if (res.status === 400 && Object.keys(tryProps).length > Object.keys(safeProps).length) {
      const body = await res.text().catch(() => "");
      logger.warn("[lead-base] HubSpot company 400 — retrying with safe props", { body: body.slice(0, 200) });
      res = await write(safeProps);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("[lead-base] HubSpot company non-2xx", { status: res.status, body: text.slice(0, 300) });
      return { ok: false, error: `HubSpot API ${res.status}: ${text.slice(0, 300)}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, ...(json.id ? { companyId: json.id } : {}) };
  } catch (err) {
    logger.warn("[lead-base] syncCompanyToHubspot failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Upsert a HubSpot contact (the named person) and associate it to a company.
 * Deduped by exact first+last name (we hold no email for ABM-imported leads).
 * Returns the contact id on success.
 */
export async function syncContactToHubspot(
  token:     string,
  contact:   HubspotContactInput,
  companyId?: string | null,
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  try {
    if (!contact.firstName && !contact.lastName) {
      return { ok: false, error: "No name — nothing to upsert." };
    }

    const properties: Record<string, string> = {};
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName)  properties.lastname  = contact.lastName;
    if (contact.jobTitle)  properties.jobtitle  = contact.jobTitle;

    const nameFilters = [
      ...(contact.firstName ? [{ propertyName: "firstname", value: contact.firstName }] : []),
      ...(contact.lastName  ? [{ propertyName: "lastname",  value: contact.lastName  }] : []),
    ];
    const existingId = nameFilters.length ? await search(token, CONTACTS, nameFilters) : null;

    const res = existingId
      ? await hsFetch(token, `${CONTACTS}/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties }) })
      : await hsFetch(token, CONTACTS, { method: "POST", body: JSON.stringify({ properties }) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("[lead-base] HubSpot contact non-2xx", { status: res.status, body: text.slice(0, 300) });
      return { ok: false, error: `HubSpot API ${res.status}: ${text.slice(0, 300)}` };
    }

    const json = (await res.json()) as { id?: string };
    const contactId = json.id;
    if (contactId && companyId) {
      await associateDefault(token, "contact", contactId, "company", companyId);
    }
    return { ok: true, ...(contactId ? { contactId } : {}) };
  } catch (err) {
    logger.warn("[lead-base] syncContactToHubspot failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Log a "website visit" Note on the timeline, associated to the company and
 * (when known) the contact. Caller throttles to once per session.
 */
export async function logVisitNote(
  token: string,
  args:  { body: string; timestampMs?: number; companyId?: string | null; contactId?: string | null },
): Promise<{ ok: boolean; noteId?: string; error?: string }> {
  try {
    const res = await hsFetch(token, NOTES, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: args.body,
          hs_timestamp: args.timestampMs ?? Date.now(),
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("[lead-base] HubSpot note non-2xx", { status: res.status, body: text.slice(0, 300) });
      return { ok: false, error: `HubSpot API ${res.status}` };
    }
    const json = (await res.json()) as { id?: string };
    const noteId = json.id;
    if (noteId) {
      if (args.companyId) await associateDefault(token, "note", noteId, "company", args.companyId);
      if (args.contactId) await associateDefault(token, "note", noteId, "contact", args.contactId);
    }
    return { ok: true, ...(noteId ? { noteId } : {}) };
  } catch (err) {
    logger.warn("[lead-base] logVisitNote failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
