/**
 * Back-office lead sync — pure core for POST /api/abm/leads (fase 1).
 *
 * A back-office / CRM upserts a lead by its OWN record id (`external_id`) and gets
 * the opaque handle (`/go/{identifier}`) back to put in its mail links. This file
 * holds the framework-free pieces so they are unit-testable without a running
 * server or DB:
 *
 *   • verifyTenantApiKey — constant-time check of the Bearer key against the
 *     tenant's stored (encrypted) key.
 *   • parseAbmSyncBody   — strict body validation; unknown fields ignored.
 *   • handleAbmSync      — the orchestration (auth → validate → idempotent upsert
 *     → optional visitor-profile link → response), over injected deps.
 *
 * The route (app/api/abm/leads/route.ts) is a thin adapter that wires the real
 * store functions into handleAbmSync. See docs/abm-backoffice-sync-api.md.
 */

import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { decryptSecret } from "@/lib/email-crypto";
import type {
  AbmLead,
  AbmLeadProfile,
  AbmLeadStatus,
  AbmExternalUpsertInput,
} from "@/lib/abm/abm-store";

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Constant-time verification of a presented API key against the tenant's stored
 * (encrypted) key. Fail-closed: false when either side is missing, when the
 * stored value can't be decrypted, or when they differ. The comparison runs over
 * fixed-length SHA-256 digests so it neither leaks length nor short-circuits.
 */
export function verifyTenantApiKey(
  provided:        string | null | undefined,
  storedEncrypted: string | null | undefined,
): boolean {
  if (!provided || !storedEncrypted) return false;
  let expected: string;
  try {
    expected = decryptSecret(storedEncrypted);
  } catch {
    return false;
  }
  if (!expected) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

// ── Body validation ──────────────────────────────────────────────────────────

const PROFILE_KEYS = [
  "firstName", "name", "company", "role", "industry", "companySize", "linkedinUrl",
] as const;

const STATUSES: readonly AbmLeadStatus[] = ["active", "paused", "expired"];

export interface ParsedAbmSync {
  tenantId:      string;
  externalId:    string;
  profile:       AbmLeadProfile;
  contactName?:  string | null;
  contactEmail?: string | null;
  segmentHint?:  string | null;
  targetPath?:   string | null;
  expiresAt?:    string | null;
  status?:       AbmLeadStatus;
  visitorKey?:   string | null;
}

export type ParseResult =
  | { ok: true;  value: ParsedAbmSync }
  | { ok: false; error: string };

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : null;
}
function capped(v: string | null, max: number): string | null {
  if (v == null) return null;
  return v.length > max ? v.slice(0, max) : v;
}

/** Read the claimed tenantId for the auth stage, before full validation. */
export function extractTenantId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const t = str((raw as Record<string, unknown>).tenantId);
  return t && t.length ? t : null;
}

/**
 * Strictly validate + normalize the sync body. Only known fields are read;
 * unknown fields are silently ignored. `tenantId` and `externalId` are required.
 */
export function parseAbmSyncBody(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = raw as Record<string, unknown>;

  const tenantId = capped(str(b.tenantId), 128);
  if (!tenantId) return { ok: false, error: "tenantId is required." };

  const externalId = capped(str(b.externalId), 256);
  if (!externalId) return { ok: false, error: "externalId is required." };

  // Profile: pick only the known string keys; drop empties + unknowns.
  const profile: AbmLeadProfile = {};
  const rawProfile = (b.profile && typeof b.profile === "object" && !Array.isArray(b.profile))
    ? (b.profile as Record<string, unknown>)
    : {};
  for (const k of PROFILE_KEYS) {
    const v = capped(str(rawProfile[k]), 256);
    if (v) profile[k] = v;
  }

  const value: ParsedAbmSync = { tenantId, externalId, profile };

  const contactName = capped(str(b.contactName), 200);
  if (contactName) value.contactName = contactName;
  const contactEmail = capped(str(b.contactEmail), 320);
  if (contactEmail) value.contactEmail = contactEmail;
  const segmentHint = capped(str(b.segmentHint), 128);
  if (segmentHint) value.segmentHint = segmentHint;

  if (b.targetPath !== undefined) {
    const tp = str(b.targetPath);
    if (tp) {
      // Relative, same-origin path only — no protocol / no protocol-relative.
      if (!tp.startsWith("/") || tp.startsWith("//")) {
        return { ok: false, error: "targetPath must be a relative path starting with '/'." };
      }
      value.targetPath = capped(tp, 512);
    }
  }

  if (b.expiresAt !== undefined && b.expiresAt !== null) {
    const iso = str(b.expiresAt);
    const t = iso ? Date.parse(iso) : NaN;
    if (!iso || Number.isNaN(t)) {
      return { ok: false, error: "expiresAt must be an ISO-8601 timestamp." };
    }
    value.expiresAt = new Date(t).toISOString();
  }

  if (b.status !== undefined && b.status !== null) {
    const s = str(b.status);
    if (!s || !STATUSES.includes(s as AbmLeadStatus)) {
      return { ok: false, error: `status must be one of ${STATUSES.join(", ")}.` };
    }
    value.status = s as AbmLeadStatus;
  }

  const visitorKey = capped(str(b.visitorKey), 256);
  if (visitorKey) value.visitorKey = visitorKey;

  return { ok: true, value };
}

// ── Orchestration ────────────────────────────────────────────────────────────

export interface AbmSyncDeps {
  /** The tenant's stored (encrypted) sync key, or null when unset. */
  getEncryptedSyncKey: (tenantId: string) => Promise<string | null>;
  /** Idempotent upsert on (tenant_id, external_id); returns the lead + created flag. */
  upsertByExternalId:  (input: AbmExternalUpsertInput) => Promise<{ lead: AbmLead; created: boolean } | null>;
  /** Best-effort link of an existing visitor_profiles row to the lead (fail-open). */
  linkProfile:         (tenantId: string, visitorKey: string, abmLeadId: string) => Promise<void>;
}

export interface AbmSyncResult {
  status: number;
  body:   Record<string, unknown>;
  /** Present on success — for the route's structured, PII-free log line. */
  event?: { tenantId: string; externalId: string; outcome: "created" | "updated" };
}

/**
 * Run one sync request. Auth is fail-closed and checked BEFORE validation errors
 * are surfaced, so an unauthenticated caller never learns whether their body was
 * otherwise valid (and never sees a tenant-existence signal): every auth-stage
 * failure returns an identical 401.
 */
export async function handleAbmSync(
  deps: AbmSyncDeps,
  args: { bearer: string | null; rawBody: unknown },
): Promise<AbmSyncResult> {
  const UNAUTHORIZED: AbmSyncResult = { status: 401, body: { error: "Unauthorized." } };

  // ── Auth (fail-closed) ──────────────────────────────────────────────────────
  const tenantId = extractTenantId(args.rawBody);
  if (!tenantId || !args.bearer) return UNAUTHORIZED;

  const storedKey = await deps.getEncryptedSyncKey(tenantId);
  if (!verifyTenantApiKey(args.bearer, storedKey)) return UNAUTHORIZED;

  // ── Validation (post-auth) ──────────────────────────────────────────────────
  const parsed = parseAbmSyncBody(args.rawBody);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const v = parsed.value;

  // ── Idempotent upsert ───────────────────────────────────────────────────────
  const result = await deps.upsertByExternalId({
    tenantId:     v.tenantId,
    externalId:   v.externalId,
    profile:      v.profile,
    contactName:  v.contactName,
    contactEmail: v.contactEmail,
    segmentHint:  v.segmentHint,
    targetPath:   v.targetPath,
    expiresAt:    v.expiresAt,
    status:       v.status,
  });
  if (!result) return { status: 500, body: { error: "Upsert failed." } };

  // ── Optional reverse link to a known visitor profile (fail-open) ────────────
  if (v.visitorKey) {
    try {
      await deps.linkProfile(v.tenantId, v.visitorKey, result.lead.id);
    } catch {
      // Non-fatal: the lead + handle still stand.
    }
  }

  const { lead } = result;
  return {
    status: 200,
    body: {
      handle:     lead.identifier,
      goPath:     `/go/${lead.identifier}`,
      vanityPath: lead.vanityPath,
      status:     lead.status,
    },
    event: { tenantId: v.tenantId, externalId: v.externalId, outcome: result.created ? "created" : "updated" },
  };
}
