"use server";

/**
 * Snippet Admin — Server Actions
 *
 * Generates and saves the snippet site key for a tenant, and toggles
 * the snippet integration on/off.
 */

import { revalidatePath }    from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import { generateSiteKey }   from "@/lib/snippet/generate-site-key";
import { sanitizeSelectorMap } from "@/lib/snippet/decide-response";
import { sanitizeAllowedOrigins } from "@/lib/snippet/origin-allowlist";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";

export type SnippetActionResult =
  | { ok: true;  siteKey?: string }
  | { ok: false; error: string };

// ── Generate / Regenerate site key ────────────────────────────────────────────

/**
 * Generates a new snippet site key for the tenant and saves it to TenantSettings.
 * Overwrites any previously existing key — clients using the old key will
 * immediately lose personalisation until they update their script tag.
 */
export async function generateSnippetSiteKeyAction(
  tenantId: string,
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const siteKey = generateSiteKey();
  const now     = new Date().toISOString();

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      siteKey,
      siteKeyGeneratedAt: now,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true, siteKey };
}

// ── Toggle snippet enabled ─────────────────────────────────────────────────────

/**
 * Enables or disables the snippet integration for a tenant.
 * When disabled, /api/snippet/decide returns 403 for this tenant's site key.
 */
export async function setSnippetEnabledAction(
  tenantId: string,
  enabled: boolean,
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      enabled,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true };
}

// ── Save selector map ──────────────────────────────────────────────────────────

/**
 * Persists the tenant's slot → CSS-selector map. This lets a slot target an
 * element that carries no `data-mc-slot` attribute — the mechanism that makes
 * the snippet usable inside WordPress page builders and other CMSes where the
 * markup can't be edited. The decide endpoint returns this map as `selectors`.
 *
 * Entries arrive as an ordered array (so the editor can keep row order); blank
 * or malformed rows are dropped via sanitizeSelectorMap before saving.
 */
export async function saveSnippetSelectorMapAction(
  tenantId: string,
  entries: { key: string; selector: string }[],
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  // Array → record (last wins on duplicate keys), then sanitise.
  const raw: Record<string, string> = {};
  for (const entry of entries) {
    if (entry && typeof entry.key === "string") raw[entry.key.trim()] = entry.selector;
  }
  const selectorMap = sanitizeSelectorMap(raw) ?? {};

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      selectorMap,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true };
}

// ── Save allowed snippet origins ────────────────────────────────────────────────

/**
 * Persists the tenant's snippet origin allowlist. The site key is public, so
 * this restricts which hostnames may call `/api/snippet/decide` — a leaked key
 * replayed from another site is rejected with 403 (see the decide endpoint).
 *
 * Opt-in: saving an empty list removes the restriction entirely. Entries are
 * normalised to bare hostnames (scheme/port/path/"www." stripped) and de-duped.
 */
export async function saveSnippetAllowedOriginsAction(
  tenantId: string,
  origins:  string[],
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const allowedSnippetOrigins = sanitizeAllowedOrigins(origins);

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      allowedSnippetOrigins,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true };
}

// ── Snippet timing (reveal / abort) ───────────────────────────────────────────

/**
 * Save the per-tenant snippet timing. These are baked into the embed as
 * `data-mc-reveal-ms` / `data-mc-call-ms`. Pass null to clear an override
 * (falls back to the snippet defaults: 700 / 4000). Values are clamped to the
 * same bounds the snippet enforces client-side.
 */
export async function saveSnippetTimingAction(
  tenantId: string,
  revealMs: number | null,
  callMs:   number | null,
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const clamp = (v: number | null, min: number, max: number): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.min(max, Math.max(min, Math.round(v)))
      : undefined;

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      revealMs: clamp(revealMs, 0, 5000),
      callMs:   clamp(callMs, 500, 15000),
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true };
}
