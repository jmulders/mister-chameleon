/**
 * CRM Identity Repository
 *
 * Persists visitor ↔ CRM contact mappings to the `visitor_crm_identity` table.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Identity resolution bridges the gap between anonymous behavioral tracking
 *   (visitor_id / mc_session_id) and CRM records (contactId, accountId).
 *
 *   Once a visitor submits a form or is matched via a CRM tracking cookie,
 *   their CRM identity is stored here so subsequent requests can look up the
 *   full CRM profile without re-triggering enrichment.
 *
 * ─── Table schema (migration required) ───────────────────────────────────────
 *
 *   CREATE TABLE visitor_crm_identity (
 *     id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     session_id   text        NOT NULL,
 *     tenant_id    text        NOT NULL,
 *     contact_id   text        NOT NULL,
 *     account_id   text,
 *     email        text,
 *     resolved_at  timestamptz NOT NULL DEFAULT now(),
 *     resolved_via text        NOT NULL,   -- 'email' | 'crm_cookie' | 'manual'
 *     crm_source   text        NOT NULL,   -- 'hubspot' | 'salesforce' | 'other'
 *     UNIQUE (session_id, tenant_id)
 *   );
 *
 *   CREATE INDEX ON visitor_crm_identity (session_id, tenant_id);
 *   CREATE INDEX ON visitor_crm_identity (contact_id, tenant_id);
 *
 * ─── Privacy ──────────────────────────────────────────────────────────────────
 *
 *   Email is stored only when it was captured via an explicit form submit
 *   (user-initiated action with consent).  It is never derived from IP or
 *   third-party sources.  The table is subject to the same data retention
 *   and deletion policies as sessions.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   All functions return discriminated union results.  They never throw;
 *   callers decide how to handle DB failures.
 */

import { getDb } from "../db";
import { logger } from "@/lib/logger";
import type { VisitorCrmIdentity } from "@/lib/crm/types";

// ── DB helper ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Result types ──────────────────────────────────────────────────────────────

export type CrmIdentityResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── DB row shape ──────────────────────────────────────────────────────────────

interface CrmIdentityRow {
  id:           string;
  session_id:   string;
  tenant_id:    string;
  contact_id:   string;
  account_id:   string | null;
  email:        string | null;
  resolved_at:  string;
  resolved_via: string;
  crm_source:   string;
}

function rowToIdentity(row: CrmIdentityRow): VisitorCrmIdentity {
  return {
    sessionId:   row.session_id,
    tenantId:    row.tenant_id,
    contactId:   row.contact_id,
    accountId:   row.account_id,
    email:       row.email,
    resolvedAt:  row.resolved_at,
    resolvedVia: row.resolved_via as VisitorCrmIdentity["resolvedVia"],
    crmSource:   row.crm_source   as VisitorCrmIdentity["crmSource"],
  };
}

// ── Repository functions ───────────────────────────────────────────────────────

/**
 * Fetches the CRM identity for a visitor session.
 * Returns null when no identity has been resolved for this session/tenant pair.
 */
export async function getCrmIdentityBySession(
  sessionId: string,
  tenantId:  string,
): Promise<CrmIdentityResult<VisitorCrmIdentity | null>> {
  try {
    const db = dbAny();
    const res = (await db
      .from("visitor_crm_identity")
      .select("*")
      .eq("session_id", sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: CrmIdentityRow | null; error: { message: string } | null };

    if (res.error) {
      return { ok: false, error: res.error.message };
    }

    return { ok: true, data: res.data ? rowToIdentity(res.data) : null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[crm-identity-repository] getCrmIdentityBySession failed", {
      sessionId, tenantId, error: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Fetches all sessions mapped to a specific CRM contact.
 * Useful for re-hydrating identity when a contact logs in on a new device.
 */
export async function getSessionsByContactId(
  contactId: string,
  tenantId:  string,
): Promise<CrmIdentityResult<VisitorCrmIdentity[]>> {
  try {
    const db = dbAny();
    const res = (await db
      .from("visitor_crm_identity")
      .select("*")
      .eq("contact_id", contactId)
      .eq("tenant_id", tenantId)
      .order("resolved_at", { ascending: false })
      .limit(20)) as { data: CrmIdentityRow[] | null; error: { message: string } | null };

    if (res.error) {
      return { ok: false, error: res.error.message };
    }

    return { ok: true, data: (res.data ?? []).map(rowToIdentity) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[crm-identity-repository] getSessionsByContactId failed", {
      contactId, tenantId, error: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Persists a visitor → CRM contact identity mapping.
 *
 * Uses ON CONFLICT DO NOTHING — if a mapping already exists for this
 * (session_id, tenant_id) pair, the existing row is preserved.
 *
 * @param identity  The resolved identity to persist.
 * @returns         The stored identity on success.
 */
export async function upsertCrmIdentity(
  identity: Omit<VisitorCrmIdentity, "resolvedAt">,
): Promise<CrmIdentityResult<VisitorCrmIdentity>> {
  try {
    const db = dbAny();

    const res = (await db
      .from("visitor_crm_identity")
      .upsert(
        {
          session_id:   identity.sessionId,
          tenant_id:    identity.tenantId,
          contact_id:   identity.contactId,
          account_id:   identity.accountId  ?? null,
          email:        identity.email      ?? null,
          resolved_at:  new Date().toISOString(),
          resolved_via: identity.resolvedVia,
          crm_source:   identity.crmSource,
        },
        { onConflict: "session_id, tenant_id", ignoreDuplicates: true },
      )
      .select()
      .maybeSingle()) as { data: CrmIdentityRow | null; error: { message: string } | null };

    if (res.error) {
      logger.error("[crm-identity-repository] upsertCrmIdentity failed", {
        sessionId: identity.sessionId,
        tenantId:  identity.tenantId,
        error:     res.error.message,
      });
      return { ok: false, error: res.error.message };
    }

    // When ignoreDuplicates fires, PostgREST returns null data.
    // Re-fetch the existing row in that case.
    if (!res.data) {
      return getCrmIdentityBySession(identity.sessionId, identity.tenantId)
        .then((r) => r.ok && r.data ? { ok: true, data: r.data } : { ok: false, error: "Row not found after upsert" });
    }

    return { ok: true, data: rowToIdentity(res.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[crm-identity-repository] upsertCrmIdentity threw", {
      sessionId: identity.sessionId,
      tenantId:  identity.tenantId,
      error:     msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Resolves CRM identity from a form submission email.
 *
 * Called when a visitor submits a form with their email address.
 * Looks up the CRM contact by email and, if found, persists the mapping.
 *
 * Returns null when no CRM contact matches the email.
 *
 * @param sessionId   Visitor session UUID.
 * @param tenantId    Tenant slug.
 * @param email       Email address from form submit.
 * @param contactId   CRM contact ID (resolved by the CRM provider lookup).
 * @param accountId   CRM account / company ID (optional).
 * @param crmSource   Which CRM the contact was found in.
 */
export async function resolveIdentityFromEmail(
  sessionId: string,
  tenantId:  string,
  email:     string,
  contactId: string,
  accountId: string | null,
  crmSource: VisitorCrmIdentity["crmSource"],
): Promise<CrmIdentityResult<VisitorCrmIdentity>> {
  return upsertCrmIdentity({
    sessionId,
    tenantId,
    contactId,
    accountId,
    email,
    resolvedVia: "email",
    crmSource,
  });
}
