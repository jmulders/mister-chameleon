/**
 * Leadinfo Client-Side Context
 *
 * Cookie serialisation, type definitions, and enrichment mapping for the
 * Leadinfo client-side identify integration.
 *
 * ─── Cookie: mc_li ────────────────────────────────────────────────────────────
 *
 *   Name     : mc_li  ("Mister Chameleon — Leadinfo")
 *   Format   : compact URL-encoded JSON, ≈ 300 bytes max
 *   httpOnly : true — not readable by client JS; set by /api/enrichment/leadinfo
 *   SameSite : Lax
 *   MaxAge   : 7 days (refreshed on each successful Leadinfo run)
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   1. LeadinfoProvider (client component) calls the Leadinfo Identify API
 *      from the browser using the real visitor IP.
 *   2. On success it POSTs the normalised LeadinfoData to /api/enrichment/leadinfo.
 *   3. The API route validates, serialises, and persists the data in mc_li.
 *   4. On subsequent server renders, buildDecisionContext reads mc_li and
 *      merges the leadinfo* fields into the enrichment output.
 *
 * ─── Zero project imports ─────────────────────────────────────────────────────
 *
 *   This file imports nothing from the project.  It is the lowest level of the
 *   context layer — other files import from here, never the reverse.
 */

// ── Cookie name and max-age ───────────────────────────────────────────────────

/** Cookie name for the persisted Leadinfo enrichment payload. */
export const LEADINFO_COOKIE = "mc_li";

/**
 * Cookie max-age in seconds.
 * 7 days — refreshed on each successful Leadinfo run.
 * Leadinfo identify results are fairly stable (company IP assignments change
 * infrequently), so a 7-day cache is appropriate without sacrificing freshness.
 */
export const LEADINFO_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 604 800 s

// ── LeadinfoData ──────────────────────────────────────────────────────────────

/**
 * Normalised data returned by the Leadinfo Identify API and stored in mc_li.
 *
 * All fields are nullable — the cookie payload may be partial when Leadinfo
 * returned only some fields for a match, or when the visitor's company had
 * limited data.
 *
 * Compact field names are used in the serialised JSON to keep the cookie small.
 */
export interface LeadinfoData {
  /** Whether Leadinfo matched a company (true) or definitively did not (false). */
  matched:          boolean;
  /** Leadinfo internal company ID, e.g. "li_abc123". */
  companyId:        string | null;
  /** Company display name, e.g. "Acme Corp". */
  companyName:      string | null;
  /** City from the company record, e.g. "Amsterdam". */
  companyCity:      string | null;
  /** Primary domain, e.g. "acme.com". */
  companyDomain:    string | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "NL". */
  companyCountry:   string | null;
  /** Employee size bucket, e.g. "11-50". */
  employees:        string | null;
  /** Total employee count (integer). */
  employeesTotal:   number | null;
  /** Annual sales volume bucket, e.g. "1M-10M". */
  salesVolume:      string | null;
  /** Dutch KvK / CoC number, e.g. "12345678". */
  cocNumber:        string | null;
  /** Industry branch code (SBI / NACE). */
  branchCode:       string | null;
  /** SIC-87 industry branch code. */
  branchCodeSic87:  string | null;
}

// ── Cookie compact key mapping ────────────────────────────────────────────────
//
// Maps LeadinfoData keys to 2–3 character abbreviations used in the serialised
// JSON to keep the cookie payload below 512 bytes on typical matches.
//
// IMPORTANT: Never rename these abbreviations once deployed — doing so would
// silently invalidate all existing mc_li cookies.

/** Compact key for `matched` */
const K_MATCHED          = "m"  as const;
/** Compact key for `companyId` */
const K_COMPANY_ID       = "ci" as const;
/** Compact key for `companyName` */
const K_COMPANY_NAME     = "cn" as const;
/** Compact key for `companyCity` */
const K_COMPANY_CITY     = "cc" as const;
/** Compact key for `companyDomain` */
const K_COMPANY_DOMAIN   = "cd" as const;
/** Compact key for `companyCountry` */
const K_COMPANY_COUNTRY  = "co" as const;
/** Compact key for `employees` */
const K_EMPLOYEES        = "e"  as const;
/** Compact key for `employeesTotal` */
const K_EMPLOYEES_TOTAL  = "et" as const;
/** Compact key for `salesVolume` */
const K_SALES_VOLUME     = "sv" as const;
/** Compact key for `cocNumber` */
const K_COC_NUMBER       = "kv" as const;
/** Compact key for `branchCode` */
const K_BRANCH_CODE      = "bc" as const;
/** Compact key for `branchCodeSic87` */
const K_BRANCH_CODE_SIC  = "bs" as const;

// ── Serialisation ─────────────────────────────────────────────────────────────

/**
 * Serialise a LeadinfoData object to a compact URL-encoded JSON string
 * suitable for storage in a cookie value.
 *
 * Null fields are omitted to keep the payload small.
 * The `matched` field is always included so the server can distinguish
 * "no match" (matched=false) from "not run" (cookie absent).
 */
export function serializeLeadinfoData(data: LeadinfoData): string {
  // Build a compact object — omit null values to save bytes.
  const compact: Record<string, string | number | boolean> = {
    [K_MATCHED]: data.matched,
  };

  if (data.companyId       !== null) compact[K_COMPANY_ID]      = data.companyId;
  if (data.companyName     !== null) compact[K_COMPANY_NAME]    = data.companyName;
  if (data.companyCity     !== null) compact[K_COMPANY_CITY]    = data.companyCity;
  if (data.companyDomain   !== null) compact[K_COMPANY_DOMAIN]  = data.companyDomain;
  if (data.companyCountry  !== null) compact[K_COMPANY_COUNTRY] = data.companyCountry;
  if (data.employees       !== null) compact[K_EMPLOYEES]       = data.employees;
  if (data.employeesTotal  !== null) compact[K_EMPLOYEES_TOTAL] = data.employeesTotal;
  if (data.salesVolume     !== null) compact[K_SALES_VOLUME]    = data.salesVolume;
  if (data.cocNumber       !== null) compact[K_COC_NUMBER]      = data.cocNumber;
  if (data.branchCode      !== null) compact[K_BRANCH_CODE]     = data.branchCode;
  if (data.branchCodeSic87 !== null) compact[K_BRANCH_CODE_SIC] = data.branchCodeSic87;

  return encodeURIComponent(JSON.stringify(compact));
}

// ── Deserialisation ────────────────────────────────────────────────────────────

/**
 * Parse a `mc_li` cookie value string into a LeadinfoData object.
 *
 * Returns `null` when the cookie is absent, malformed, or does not contain
 * the required `matched` field.  The caller (`buildDecisionContext`) treats
 * null as "Leadinfo has not run" and skips the merge.
 */
export function parseLeadinfoCookie(cookieValue: string | null | undefined): LeadinfoData | null {
  if (!cookieValue) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(decodeURIComponent(cookieValue)) as Record<string, unknown>;
  } catch {
    return null;
  }

  // `matched` is required — if absent the payload is malformed.
  if (typeof raw[K_MATCHED] !== "boolean") return null;

  return {
    matched:         raw[K_MATCHED] as boolean,
    companyId:       typeof raw[K_COMPANY_ID]      === "string" ? raw[K_COMPANY_ID]      : null,
    companyName:     typeof raw[K_COMPANY_NAME]    === "string" ? raw[K_COMPANY_NAME]    : null,
    companyCity:     typeof raw[K_COMPANY_CITY]    === "string" ? raw[K_COMPANY_CITY]    : null,
    companyDomain:   typeof raw[K_COMPANY_DOMAIN]  === "string" ? raw[K_COMPANY_DOMAIN]  : null,
    companyCountry:  typeof raw[K_COMPANY_COUNTRY] === "string" ? raw[K_COMPANY_COUNTRY] : null,
    employees:       typeof raw[K_EMPLOYEES]       === "string" ? raw[K_EMPLOYEES]       : null,
    employeesTotal:  typeof raw[K_EMPLOYEES_TOTAL] === "number" ? raw[K_EMPLOYEES_TOTAL] : null,
    salesVolume:     typeof raw[K_SALES_VOLUME]    === "string" ? raw[K_SALES_VOLUME]    : null,
    cocNumber:       typeof raw[K_COC_NUMBER]      === "string" ? raw[K_COC_NUMBER]      : null,
    branchCode:      typeof raw[K_BRANCH_CODE]     === "string" ? raw[K_BRANCH_CODE]     : null,
    branchCodeSic87: typeof raw[K_BRANCH_CODE_SIC] === "string" ? raw[K_BRANCH_CODE_SIC] : null,
  };
}

// ── Enrichment mapping ─────────────────────────────────────────────────────────

import type { EnrichmentOutput } from "@/enrichment/types";

/**
 * Map a parsed LeadinfoData record to the Leadinfo-specific fields in
 * `EnrichmentOutput`.
 *
 * Only leadinfo* fields are set here — generic company fields (companyName,
 * companyDomain, etc.) are intentionally NOT overwritten.  The caller
 * (`buildDecisionContext`) decides whether to promote leadinfo data into the
 * generic company slot based on tenant config and pipeline priority.
 *
 * Returns an empty object when `data` is null (safe no-op).
 */
export function leadinfoToEnrichment(
  data: LeadinfoData | null,
): Partial<EnrichmentOutput> {
  if (!data) return {};

  return {
    leadinfoMatched:        data.matched,
    leadinfoCompanyId:      data.companyId,
    leadinfoCompanyName:    data.companyName,
    leadinfoCompanyCity:    data.companyCity,
    leadinfoCompanyDomain:  data.companyDomain,
    leadinfoCompanyCountry: data.companyCountry,
    leadinfoEmployees:      data.employees,
    leadinfoEmployeesTotal: data.employeesTotal,
    leadinfoSalesVolume:    data.salesVolume,
    leadinfoCocNumber:      data.cocNumber,
    leadinfoBranchCode:     data.branchCode,
    leadinfoBranchCodeSic87: data.branchCodeSic87,
  };
}
