/**
 * POST /api/abm/leads — back-office / CRM lead sync (fase 1).
 *
 * A back-office upserts a lead by its own `external_id` and gets the opaque
 * handle back to build its own /go/{handle} mail links. Idempotent on
 * (tenant_id, external_id): the handle stays stable across re-syncs.
 *
 * ─── Auth (fail-closed) ──────────────────────────────────────────────────────
 *   Authorization: Bearer <per-tenant sync key>
 *   Missing / wrong key, or no key configured for the tenant → 401.
 *
 * ─── Body ────────────────────────────────────────────────────────────────────
 *   { tenantId, externalId, profile:{ firstName,name,company,role,industry,
 *     companySize,linkedinUrl }, contactName?, contactEmail?, segmentHint?,
 *     targetPath?, expiresAt?, status?, visitorKey? }
 *   Unknown fields are ignored; validation is strict.
 *
 * ─── Response (200) ──────────────────────────────────────────────────────────
 *   { handle, goPath:"/go/{handle}", vanityPath: null|string, status }
 *
 *   400 invalid body · 401 unauthorized · 500 internal
 *
 * See lib/abm/backoffice-sync.ts and docs/abm-backoffice-sync-api.md.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAbmSyncApiKey, upsertAbmLeadByExternalId } from "@/lib/abm/abm-store";
import { linkProfileToAbmLead } from "@/lib/lead-base/visitor-profiles-store";
import { handleAbmSync } from "@/lib/abm/backoffice-sync";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null; // Non-JSON body → fails auth (no tenantId) → 401.
  }

  const result = await handleAbmSync(
    {
      getEncryptedSyncKey: getAbmSyncApiKey,
      upsertByExternalId:  upsertAbmLeadByExternalId,
      linkProfile:         linkProfileToAbmLead,
    },
    { bearer: bearer || null, rawBody: raw },
  );

  // Structured, PII-free log: tenantId + external_id + outcome only.
  if (result.event) {
    logger.info("[abm-sync] lead upserted", result.event);
  }

  return NextResponse.json(result.body, { status: result.status });
}
