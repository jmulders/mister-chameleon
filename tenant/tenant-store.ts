/**
 * Tenant Store — Supabase-backed
 *
 * Supabase implementation of the tenant settings store.
 * Replaces the original fs/promises + JSON file backend so the platform
 * runs safely on Vercel and any other serverless environment with a
 * read-only filesystem.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Data is persisted in the `tenant_settings` Supabase table.
 *   Each row carries the full TenantSettings object as JSONB under the
 *   `settings` column, keyed by `tenant_id`.
 *
 *   SQL schema:
 *     supabase/migrations/20240101000009_create_tenant_settings.sql
 *
 * ─── Validation and enforcement ───────────────────────────────────────────────
 *
 *   saveTenant applies two passes before writing (identical to the previous
 *   file-backed implementation):
 *
 *   1. validateTenantSettings — structural check (field types, known enum
 *      values).  Rejects with an error if the shape is invalid.
 *
 *   2. enforcePackageLimits — clamps the validated settings to the package's
 *      allow-lists.  Never rejects; returns a normalized copy plus violation
 *      strings surfaced as warnings.
 *
 *   The persisted object is always the normalized, package-compliant copy.
 *
 * ─── Domain and slug lookups ──────────────────────────────────────────────────
 *
 *   getTenantByDomain and getTenantBySlug fetch all tenant rows and filter
 *   in application code.  This is efficient for the expected tenant count
 *   (< 100 rows) and avoids complex JSONB query operators.
 *
 * ─── API summary ──────────────────────────────────────────────────────────────
 *
 *   getAllTenants()             → Promise<TenantSettings[]>
 *   getTenantById(id)          → Promise<TenantSettings | null>
 *   getTenantByDomain(host)    → Promise<TenantSettings | null>
 *   getTenantBySlug(slug)      → Promise<TenantSettings | null>
 *   saveTenant(tenant)         → Promise<StoreResult<TenantSettings>>  (upsert)
 *   createTenant(tenant)       → Promise<StoreResult<TenantSettings>>  (insert only)
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   All public functions return `StoreResult<T>` rather than throwing.
 *   Supabase errors are caught internally and surfaced as `{ ok: false, error }`.
 *   Callers can use `result.ok` to branch without a try/catch.
 */

import "server-only";

import type {
  TenantSettings,
  PackageKey,
  TenantFeatures,
  TenantBlocks,
  TenantAiSettings,
  TenantCmsSettings,
  TenantDesignSettings,
  ContextBlockKey,
  ContentBlockKey,
  ThemeKey,
  CMSProviderName,
} from "./types";
import { enforcePackageLimits }  from "./package-enforcement";
import { DESIGN_PRESETS }        from "./design-theme";
import { getDb, isNetworkError } from "@/data/db";
import { getDomainByHostname }   from "./domain-store";
import { logger }                from "@/lib/logger";

// ── Typed query helpers ───────────────────────────────────────────────────────
//
// Same workaround as data/repositories — the hand-authored Database type lacks
// the `PostgrestVersion` discriminant, causing `.select()` to return `never[]`
// in strict mode.  Cast the result to the known Row shape immediately.

type SelectResult<T> = { data: T[] | null; error: { message: string } | null };
type SingleResult<T> = { data: T | null;   error: { message: string } | null };

function asRows<T>(result: unknown): SelectResult<T>  { return result as SelectResult<T>;  }
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

// ── Store result ──────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by all mutating store operations.
 *
 *   ok: true  — the operation succeeded; `data` carries the saved tenant.
 *               `warnings` is present when enforcePackageLimits adjusted any
 *               values to conform to the package — non-empty means the
 *               persisted settings differ from what was submitted.
 *
 *   ok: false — the operation failed; `error` is a human-readable reason.
 *
 * Callers should branch on `result.ok` rather than catching exceptions.
 */
export type StoreResult<T> =
  | { ok: true;  data: T; warnings?: string[] }
  | { ok: false; error: string };

// ── Allowed value sets ────────────────────────────────────────────────────────
// Used in validateTenantSettings — mirrors the union types in types.ts without
// importing them as values (they are type-only).
//
// VALID_THEME_KEYS is derived from DESIGN_PRESETS — the platform's single
// source of truth for available themes.  Adding a new theme to DESIGN_PRESETS
// automatically makes it valid in the save path without a separate update here.

const VALID_PACKAGE_KEYS       = new Set<PackageKey>(["starter", "growth", "pro"]);
const VALID_AI_MODES           = new Set(["disabled", "shadow", "live"]);
const VALID_AI_PROVIDER_NAMES  = new Set(["openai", "claude", "gemini"]);
const VALID_CMS_PROVIDERS    = new Set<CMSProviderName>(["sanity", "storyblok", "statamic", "mock"]);
const VALID_THEME_KEYS       = new Set<ThemeKey>(
  Object.keys(DESIGN_PRESETS) as ThemeKey[],
);
const VALID_CONTEXT_BLOCKS   = new Set<ContextBlockKey>([
  "hero", "proof", "cta",
  // adaptive slots
  "feature", "conversion", "notification",
]);
const VALID_CONTENT_BLOCKS   = new Set<ContentBlockKey>([
  // text
  "textSection", "richText",
  // media
  "image", "video", "slider",
  // social proof
  "testimonialSection", "quote", "logoStrip", "stats",
  // features / content
  "featureGrid", "faqSection", "about", "newsList", "caseHighlight",
  // listing / detail
  "listing", "articleBody", "articleMeta", "relatedContent",
  "vacancyMeta", "applyPanel", "filterBar",
  // search
  "search",
  // conversion
  "ctaSection",
  // conversion / pricing
  "pricingSection",
  // forms
  "formSection",
  // careers
  "processSteps", "recruiterPanel",
  // content / editorial
  "contentSection", "teamSection",
  // new core blocks
  "timeline", "quickLinks", "textMedia", "contactSection",
  // commerce / product
  "productOverview", "productDetail", "cartSummary", "checkoutBlock",
  // map
  "mapBlock",
  // NOTE: "searchResults" is intentionally excluded — internal rendering concept only
]);

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates an unknown value as a TenantSettings object.
 *
 * Checks structural validity only — field presence, correct types, and
 * membership in the global value sets.  Does NOT enforce package-tier limits;
 * that is the job of enforcePackageLimits() called after this function.
 *
 * Returns all validation errors at once so callers see the full picture.
 *
 * @param raw  The value to validate (typically parsed JSON).
 * @returns    StoreResult with the typed TenantSettings, or a list of errors.
 */
export function validateTenantSettings(raw: unknown): StoreResult<TenantSettings> {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Tenant must be a non-null object." };
  }

  const r = raw as Record<string, unknown>;

  // ── tenantId ───────────────────────────────────────────────────────────────
  if (typeof r.tenantId !== "string" || r.tenantId.trim() === "") {
    errors.push("tenantId: must be a non-empty string.");
  }

  // ── packageKey ─────────────────────────────────────────────────────────────
  if (!VALID_PACKAGE_KEYS.has(r.packageKey as PackageKey)) {
    errors.push(
      `packageKey: must be one of ${[...VALID_PACKAGE_KEYS].join(", ")}. Got: ${String(r.packageKey)}.`,
    );
  }

  // ── features ───────────────────────────────────────────────────────────────
  if (typeof r.features !== "object" || r.features === null) {
    errors.push("features: must be an object.");
  } else {
    const f = r.features as Record<string, unknown>;
    for (const key of ["experiments", "ai", "analytics"] as const) {
      if (typeof f[key] !== "boolean") {
        errors.push(`features.${key}: must be a boolean.`);
      }
    }
  }

  // ── blocks ─────────────────────────────────────────────────────────────────
  if (typeof r.blocks !== "object" || r.blocks === null) {
    errors.push("blocks: must be an object.");
  } else {
    const b = r.blocks as Record<string, unknown>;

    if (!Array.isArray(b.context)) {
      errors.push("blocks.context: must be an array.");
    } else {
      const badContext = (b.context as unknown[]).filter(
        (k) => !VALID_CONTEXT_BLOCKS.has(k as ContextBlockKey),
      );
      if (badContext.length > 0) {
        errors.push(
          `blocks.context: invalid keys [${badContext.join(", ")}]. ` +
          `Allowed: ${[...VALID_CONTEXT_BLOCKS].join(", ")}.`,
        );
      }
    }

    if (!Array.isArray(b.content)) {
      errors.push("blocks.content: must be an array.");
    } else {
      // Backward compat: "searchResults" was previously a tenant-facing key.
      const normalizedContent = (b.content as unknown[]).filter(
        (k) => k !== "searchResults",
      );
      const badContent = normalizedContent.filter(
        (k) => !VALID_CONTENT_BLOCKS.has(k as ContentBlockKey),
      );
      if (badContent.length > 0) {
        errors.push(
          `blocks.content: invalid keys [${badContent.join(", ")}]. ` +
          `Allowed: ${[...VALID_CONTENT_BLOCKS].join(", ")}.`,
        );
      }
      b.content = normalizedContent;
    }
  }

  // ── ai ─────────────────────────────────────────────────────────────────────
  if (typeof r.ai !== "object" || r.ai === null) {
    errors.push("ai: must be an object.");
  } else {
    const ai = r.ai as Record<string, unknown>;

    if (!VALID_AI_MODES.has(ai.mode as string)) {
      errors.push(
        `ai.mode: must be one of ${[...VALID_AI_MODES].join(", ")}. Got: ${String(ai.mode)}.`,
      );
    }

    if (ai.liveProvider !== undefined) {
      if (typeof ai.liveProvider !== "object" || ai.liveProvider === null) {
        errors.push("ai.liveProvider: must be an object when present.");
      } else {
        const lp = ai.liveProvider as Record<string, unknown>;
        if (!VALID_AI_PROVIDER_NAMES.has(lp.name as string)) {
          errors.push(
            `ai.liveProvider.name: must be one of ` +
            `${[...VALID_AI_PROVIDER_NAMES].join(", ")}. Got: ${String(lp.name)}.`,
          );
        }
        if (lp.apiKey !== undefined && typeof lp.apiKey !== "string") {
          errors.push("ai.liveProvider.apiKey: must be a string when present.");
        }
        if (lp.model !== undefined && typeof lp.model !== "string") {
          errors.push("ai.liveProvider.model: must be a string when present.");
        }
      }
    }

    if (ai.shadowProvider !== undefined) {
      if (typeof ai.shadowProvider !== "object" || ai.shadowProvider === null) {
        errors.push("ai.shadowProvider: must be an object when present.");
      } else {
        const sp = ai.shadowProvider as Record<string, unknown>;
        if (!VALID_AI_PROVIDER_NAMES.has(sp.name as string)) {
          errors.push(
            `ai.shadowProvider.name: must be one of ` +
            `${[...VALID_AI_PROVIDER_NAMES].join(", ")}. Got: ${String(sp.name)}.`,
          );
        }
        if (sp.apiKey !== undefined && typeof sp.apiKey !== "string") {
          errors.push("ai.shadowProvider.apiKey: must be a string when present.");
        }
        if (sp.model !== undefined && typeof sp.model !== "string") {
          errors.push("ai.shadowProvider.model: must be a string when present.");
        }
      }
    }

    if (ai.confidenceThreshold !== undefined) {
      const ct = ai.confidenceThreshold;
      if (typeof ct !== "number" || ct < 0 || ct > 1) {
        errors.push("ai.confidenceThreshold: must be a number in [0, 1] when present.");
      }
    }
  }

  // ── cms ────────────────────────────────────────────────────────────────────
  if (typeof r.cms !== "object" || r.cms === null) {
    errors.push("cms: must be an object.");
  } else {
    const cms = r.cms as Record<string, unknown>;
    if (!VALID_CMS_PROVIDERS.has(cms.provider as CMSProviderName)) {
      errors.push(
        `cms.provider: must be one of ${[...VALID_CMS_PROVIDERS].join(", ")}. ` +
        `Got: ${String(cms.provider)}.`,
      );
    }
    if (cms.projectId !== undefined && typeof cms.projectId !== "string") {
      errors.push("cms.projectId: must be a string when present.");
    }
    if (cms.dataset !== undefined && typeof cms.dataset !== "string") {
      errors.push("cms.dataset: must be a string when present.");
    }
    if (cms.writeToken !== undefined && typeof cms.writeToken !== "string") {
      errors.push("cms.writeToken: must be a string when present.");
    }
  }

  // ── design ─────────────────────────────────────────────────────────────────
  if (typeof r.design !== "object" || r.design === null) {
    errors.push("design: must be an object.");
  } else {
    const d = r.design as Record<string, unknown>;
    if (!VALID_THEME_KEYS.has(d.theme as ThemeKey)) {
      errors.push(
        `design.theme: must be one of ${[...VALID_THEME_KEYS].join(", ")}. ` +
        `Got: ${String(d.theme)}.`,
      );
    }
    if (d.primaryColor !== undefined && typeof d.primaryColor !== "string") {
      errors.push("design.primaryColor: must be a string when present.");
    }
    if (d.primaryFont !== undefined && typeof d.primaryFont !== "string") {
      errors.push("design.primaryFont: must be a string when present.");
    }
    if (d.tokenOverrides !== undefined) {
      if (typeof d.tokenOverrides !== "object" || d.tokenOverrides === null) {
        errors.push("design.tokenOverrides: must be an object when present.");
      } else {
        const to = d.tokenOverrides as Record<string, unknown>;

        const LEGACY_OVERRIDE_KEYS = ["radiusInteractive", "radiusCard", "radiusPopover"] as const;
        for (const key of LEGACY_OVERRIDE_KEYS) {
          if (to[key] !== undefined && typeof to[key] !== "string") {
            errors.push(`design.tokenOverrides.${key}: must be a string when present.`);
          }
        }

        const GROUPED_OVERRIDE_KEYS = [
          "color", "typography", "radius", "spacing",
          "border", "shadow", "motion", "component",
          // "layout" carries structural chrome tokens: header/footer shell colors
          // (headerBg, headerFg, headerBorder, footerBg, footerFg, footerBorder)
          // and navigation typography overrides (navLinkSize, navLinkWeight,
          // navLinkTracking, navDropdownItemSize, footerNavSize).
          // These map to --header-*, --footer-*, --nav-link-* CSS custom properties
          // via LAYOUT_CSS_VARS in resolve-theme.ts.
          "layout",
        ] as const;
        for (const group of GROUPED_OVERRIDE_KEYS) {
          if (to[group] === undefined) continue;
          if (typeof to[group] !== "object" || to[group] === null || Array.isArray(to[group])) {
            errors.push(`design.tokenOverrides.${group}: must be an object when present.`);
            continue;
          }
          const groupMap = to[group] as Record<string, unknown>;
          for (const [k, v] of Object.entries(groupMap)) {
            if (typeof v !== "string") {
              errors.push(`design.tokenOverrides.${group}.${k}: must be a string. Got ${typeof v}.`);
            }
          }
        }

        const ALL_OVERRIDE_KEYS: readonly string[] = [
          ...LEGACY_OVERRIDE_KEYS,
          ...GROUPED_OVERRIDE_KEYS,
        ];
        const unknownOverrideKeys = Object.keys(to).filter(
          (k) => !ALL_OVERRIDE_KEYS.includes(k),
        );
        if (unknownOverrideKeys.length > 0) {
          errors.push(
            `design.tokenOverrides: unknown keys [${unknownOverrideKeys.join(", ")}]. ` +
            `Allowed: ${ALL_OVERRIDE_KEYS.join(", ")}.`,
          );
        }
      }
    }
  }

  // ── name (optional) ────────────────────────────────────────────────────────
  if (r.name !== undefined && typeof r.name !== "string") {
    errors.push("name: must be a string when present.");
  }

  // ── slug (optional) ────────────────────────────────────────────────────────
  if (r.slug !== undefined) {
    if (typeof r.slug !== "string") {
      errors.push("slug: must be a string when present.");
    } else if (r.slug.trim() !== "" && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(r.slug)) {
      errors.push(
        "slug: must contain only lowercase letters, digits, and hyphens, " +
        "starting and ending with a letter or digit.",
      );
    }
  }

  // ── primaryDomain (optional) ───────────────────────────────────────────────
  if (r.primaryDomain !== undefined) {
    if (typeof r.primaryDomain !== "string") {
      errors.push("primaryDomain: must be a string when present.");
    } else if (r.primaryDomain.trim() !== "" && /^https?:\/\//i.test(r.primaryDomain)) {
      errors.push("primaryDomain: must not include a protocol (e.g. use 'acme.com', not 'https://acme.com').");
    }
  }

  // ── additionalDomains (optional) ──────────────────────────────────────────
  if (r.additionalDomains !== undefined) {
    if (!Array.isArray(r.additionalDomains)) {
      errors.push("additionalDomains: must be an array when present.");
    } else {
      const badDomains = (r.additionalDomains as unknown[]).filter(
        (d) => typeof d !== "string",
      );
      if (badDomains.length > 0) {
        errors.push("additionalDomains: all entries must be strings.");
      }
      const protocolDomains = (r.additionalDomains as string[]).filter(
        (d) => /^https?:\/\//i.test(d),
      );
      if (protocolDomains.length > 0) {
        errors.push("additionalDomains: entries must not include a protocol.");
      }
    }
  }

  // ── cmsProvisionedAt (optional) ────────────────────────────────────────────
  if (r.cmsProvisionedAt !== undefined && typeof r.cmsProvisionedAt !== "string") {
    errors.push("cmsProvisionedAt: must be a string when present.");
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    return {
      ok:    false,
      error: `TenantSettings validation failed:\n${errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }

  return { ok: true, data: raw as TenantSettings };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch all tenant rows from Supabase and return as TenantSettings[].
 * Returns [] on any database error (logged to console).
 *
 * Always selects both `tenant_id` (the DB primary key) and `settings` (JSONB).
 * The DB column is used as the authoritative source for `tenantId` on the
 * returned object — this guards against rows where `settings.tenantId` is
 * absent, empty, or out-of-sync with the real primary key (e.g. manually
 * inserted rows, legacy data written before validation was enforced).
 */
async function fetchAllTenants(): Promise<TenantSettings[]> {
  const { data, error } = asRows<{ tenant_id: string; settings: Record<string, unknown> }>(
    await getDb()
      .from("tenant_settings")
      .select("tenant_id, settings"),
  );

  if (error) {
    if (isNetworkError(error.message)) {
      logger.error(
        "[tenant-store] fetchAllTenants: network-level DB failure — " +
        "Supabase may be paused or unreachable. " +
        "Check https://supabase.com/dashboard and verify NEXT_PUBLIC_SUPABASE_URL.",
        { errorMessage: error.message },
      );
    } else {
      logger.error("[tenant-store] fetchAllTenants DB error", {
        message: error.message,
      });
    }
    return [];
  }

  return (data ?? []).map((row) => ({
    // Spread the JSONB blob first, then override tenantId with the DB column.
    // The DB column is the true primary key and is always present and unique.
    ...(row.settings as TenantSettings),
    tenantId: row.tenant_id,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all tenants in the store.
 *
 * Never throws — returns an empty array on database failure.
 *
 * @example
 * const tenants = await getAllTenants();
 * // → [{ tenantId: "mister-chameleon", packageKey: "pro", ... }]
 */
export async function getAllTenants(): Promise<TenantSettings[]> {
  return fetchAllTenants();
}

/**
 * Returns the tenant with the given ID, or null if not found.
 *
 * Never throws — returns null on database failure.
 *
 * @param tenantId  The stable tenant slug, e.g. "mister-chameleon".
 *
 * @example
 * const tenant = await getTenantById("mister-chameleon");
 * if (!tenant) { ... }
 */
export async function getTenantById(tenantId: string): Promise<TenantSettings | null> {
  // Select both `tenant_id` and `settings` so we can inject the DB column as
  // the authoritative `tenantId` — identical to what fetchAllTenants() does.
  //
  // The JSONB settings blob may lack `tenantId` (rows inserted manually,
  // legacy data written before validation was enforced, or rows where the JSONB
  // was not yet written with a `tenantId` key).  Relying on `settings.tenantId`
  // alone causes "tenantId: must be a non-empty string" in validateTenantSettings
  // when any downstream action calls saveTenant() after reading with this function.
  const { data, error } = asSingle<{ tenant_id: string; settings: Record<string, unknown> }>(
    await getDb()
      .from("tenant_settings")
      .select("tenant_id, settings")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  );

  if (error) {
    if (isNetworkError(error.message)) {
      logger.error(
        "[tenant-store] getTenantById: network-level DB failure — " +
        "Supabase may be paused or unreachable. " +
        "Check https://supabase.com/dashboard and verify NEXT_PUBLIC_SUPABASE_URL.",
        { tenantId, errorMessage: error.message },
      );
    } else {
      logger.error("[tenant-store] getTenantById DB error", {
        tenantId,
        message: error.message,
      });
    }
    return null;
  }

  if (!data) return null;

  // Spread the JSONB blob first, then override tenantId with the DB column.
  // The DB column is the true primary key and is always present and unique.
  // Double-cast via `unknown` is required here because the hand-authored
  // Database type lacks the PostgrestVersion discriminant, causing Supabase's
  // typed helpers to narrow `settings` to `Record<string, unknown>`.
  return {
    ...(data.settings as unknown as TenantSettings),
    tenantId: data.tenant_id,
  };
}

/**
 * Returns the tenant whose hostname matches the given host, or null if none
 * match.  Resolution is a two-step process:
 *
 *   Step 1 — tenant_domains table (O(1) index lookup):
 *     Checks the `tenant_domains` table for an exact hostname match.
 *     This is the canonical path for domains registered via the admin UI.
 *     All status values (pending / active / error) are treated as matching —
 *     once an operator claims a domain it routes to their tenant regardless of
 *     Vercel verification state.
 *
 *   Step 2 — JSONB scan (backward compat, O(n)):
 *     Falls back to scanning `tenant_settings.settings` for tenants that still
 *     carry `primaryDomain` / `additionalDomains` in their JSONB column
 *     (rows written before the `tenant_domains` table was created).
 *     New domains should always be added via the admin UI (Step 1).
 *
 * The comparison normalises the incoming hostname to lowercase before matching.
 *
 * @param hostname  The Host header value (no protocol, may include port).
 *                  Example: "acme.com", "staging.workengine.io"
 *
 * @example
 * const tenant = await getTenantByDomain("acme.com");
 * if (tenant) { ... }
 */
export async function getTenantByDomain(hostname: string): Promise<TenantSettings | null> {
  const normalised = hostname.toLowerCase().trim();

  // ── Step 1: tenant_domains table (fast path) ──────────────────────────────
  try {
    const domainRow = await getDomainByHostname(normalised);
    if (domainRow) {
      const tenant = await getTenantById(domainRow.tenant_id);
      if (tenant) return tenant;
      // Row found but tenant missing — fall through to JSONB scan.
      console.warn(
        `[tenant-store] tenant_domains has hostname "${normalised}" for tenant ` +
        `"${domainRow.tenant_id}" but no matching tenant_settings row was found.`,
      );
    }
  } catch (err) {
    // Never let a domain-store error break tenant resolution — fall through.
    console.error("[tenant-store] getTenantByDomain domain-store error:", err);
  }

  // ── Step 2: JSONB scan (legacy backward compat) ───────────────────────────
  const tenants = await fetchAllTenants();

  return tenants.find((t) => {
    if (t.primaryDomain?.toLowerCase().trim() === normalised) return true;
    if (t.additionalDomains?.some((d) => d.toLowerCase().trim() === normalised)) return true;
    return false;
  }) ?? null;
}

/**
 * Returns the tenant whose snippet siteKey matches the given string, or null.
 *
 * Uses a direct Supabase JSONB column filter so only the matching row is
 * fetched from the database — O(1) query instead of loading all tenants and
 * filtering in application code.  This is the correct lookup path for the
 * hot /api/snippet/decide endpoint which is called on every visitor pageview.
 *
 * @param siteKey  The public snippet site key, e.g. "sk_live_abc123".
 *
 * @example
 * const tenant = await getTenantBySiteKey("sk_live_abc123");
 * if (!tenant) return 403;
 */
export async function getTenantBySiteKey(siteKey: string): Promise<TenantSettings | null> {
  const { data, error } = asSingle<{ tenant_id: string; settings: Record<string, unknown> }>(
    await getDb()
      .from("tenant_settings")
      .select("tenant_id, settings")
      // PostgREST JSONB path: settings->'snippet'->>'siteKey'
      // Uses the ->> text operator so the comparison is against a plain string.
      .filter("settings->snippet->>siteKey", "eq", siteKey)
      .maybeSingle(),
  );

  if (error) {
    logger.error("[tenant-store] getTenantBySiteKey DB error", {
      siteKey,
      message: error.message,
    });
    return null;
  }

  if (!data) return null;

  return {
    ...(data.settings as TenantSettings),
    tenantId: data.tenant_id,
  };
}

/**
 * Returns the tenant whose slug matches the given string, or null if not found.
 *
 * Slug comparison is case-insensitive.
 *
 * @param slug  The public slug to look up, e.g. "acme" or "work-engine".
 */
export async function getTenantBySlug(slug: string): Promise<TenantSettings | null> {
  const tenants    = await fetchAllTenants();
  const normalised = slug.toLowerCase().trim();

  return tenants.find(
    (t) => t.slug?.toLowerCase().trim() === normalised,
  ) ?? null;
}

/**
 * Upserts a tenant — creates it if it does not exist, replaces it if it does.
 *
 * Applies two passes before writing:
 *   1. validateTenantSettings — rejects if the shape is structurally invalid.
 *   2. enforcePackageLimits   — normalizes values to the package allow-lists;
 *      violations are returned as warnings in the success result so the caller
 *      can surface them to the user.
 *
 * The object written to the database is always the package-compliant normalized
 * copy, not the raw input.
 *
 * @param tenant  The full TenantSettings object to save.
 *
 * @example
 * const result = await saveTenant({ tenantId: "acme", packageKey: "growth", ... });
 * if (!result.ok) console.error(result.error);
 * if (result.ok && result.warnings?.length) console.warn(result.warnings);
 */
export async function saveTenant(
  tenant: TenantSettings,
): Promise<StoreResult<TenantSettings>> {
  // ── Pass 1: structural validation ─────────────────────────────────────────
  const validation = validateTenantSettings(tenant);
  if (!validation.ok) return validation;

  // ── Fetch existing record (for package-change detection) ──────────────────
  const existing           = await getTenantById(validation.data.tenantId);
  const previousPackageKey = existing?.packageKey;

  // ── Pass 2: package-aware normalization ───────────────────────────────────
  const { settings: enforced, violations } = enforcePackageLimits(
    validation.data,
    { previousPackageKey },
  );

  if (violations.length > 0) {
    console.warn(
      `[tenant-store] saveTenant — package enforcement adjusted settings for ` +
      `"${enforced.tenantId}" (${enforced.packageKey}):`,
      violations,
    );
  }

  // ── Persist (upsert) ──────────────────────────────────────────────────────
  //
  // `id` is set to the same value as `tenant_id` (the tenant slug).
  // The live tenant_settings table has an `id` NOT NULL column that was added
  // by the Supabase dashboard after the original migration was applied.  It
  // mirrors tenant_id and must be included explicitly because the column has
  // no DEFAULT — omitting it causes a null constraint violation on INSERT.
  // On the UPDATE (conflict) path it is idempotent: the slug doesn't change.
  const { error } = await getDb()
    .from("tenant_settings")
    .upsert(
      {
        id:         enforced.tenantId,
        tenant_id:  enforced.tenantId,
        settings:   enforced as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

  if (error) {
    return { ok: false, error: `[tenant-store] saveTenant DB error: ${error.message}` };
  }

  return {
    ok:   true,
    data: enforced,
    ...(violations.length > 0 ? { warnings: [...violations] } : {}),
  };
}

/**
 * Creates a new tenant.  Fails if a tenant with the same ID already exists.
 *
 * Use `saveTenant()` for upsert behaviour.
 *
 * Applies the same two-pass validation + enforcement as saveTenant().
 *
 * @param tenant  The full TenantSettings object to insert.
 *
 * @example
 * const result = await createTenant({ tenantId: "acme", packageKey: "growth", ... });
 * if (!result.ok) console.error(result.error);  // "Tenant 'acme' already exists."
 */
export async function createTenant(
  tenant: TenantSettings,
): Promise<StoreResult<TenantSettings>> {
  // ── Pass 1: structural validation ─────────────────────────────────────────
  const validation = validateTenantSettings(tenant);
  if (!validation.ok) return validation;

  // ── Pass 2: package-aware normalization ───────────────────────────────────
  const { settings: enforced, violations } = enforcePackageLimits(validation.data);

  if (violations.length > 0) {
    console.warn(
      `[tenant-store] createTenant — package enforcement adjusted settings for ` +
      `"${enforced.tenantId}" (${enforced.packageKey}):`,
      violations,
    );
  }

  // ── Check for existing record ─────────────────────────────────────────────
  const existing = await getTenantById(enforced.tenantId);
  if (existing) {
    return {
      ok:    false,
      error: `Tenant '${enforced.tenantId}' already exists. Use saveTenant() to update it.`,
    };
  }

  // ── Insert new row ────────────────────────────────────────────────────────
  //
  // `id` mirrors `tenant_id` — see saveTenant() for the full explanation.
  const { error } = await getDb()
    .from("tenant_settings")
    .insert({
      id:         enforced.tenantId,
      tenant_id:  enforced.tenantId,
      settings:   enforced as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { ok: false, error: `[tenant-store] createTenant DB error: ${error.message}` };
  }

  return {
    ok:   true,
    data: enforced,
    ...(violations.length > 0 ? { warnings: [...violations] } : {}),
  };
}

// ── getTenantPipelineStages ────────────────────────────────────────────────────

/**
 * Load the enrichment pipeline stage configuration for a tenant from the
 * `tenant_pipeline_stages` table (migration 090).
 *
 * Returns an array of stage rows that can be passed directly as the
 * `stageConfig` option of `buildCompanyCrmChain`.
 *
 * Returns an empty array when:
 *   • The table does not exist yet (migration 090 not applied).
 *   • No rows exist for this tenant (defaults in the chain are used).
 *   • Any DB error (safe fallback — pipeline runs in default order).
 */
export async function getTenantPipelineStages(
  tenantId: string,
): Promise<Array<{ stageKey: string; position: number; enabled: boolean }>> {
  if (!tenantId) return [];

  try {
    const { data, error } = await getDb()
      .from("tenant_pipeline_stages")
      .select("stage_key, position, enabled")
      .eq("tenant_id", tenantId);

    // 42P01 = table does not exist (migration 090 not yet applied) — silent fallback.
    if (error) {
      if (error.code !== "42P01") {
        logger.warn("[tenant-store] getTenantPipelineStages DB error", {
          tenantId,
          code:    error.code,
          message: error.message,
        });
      }
      return [];
    }

    if (!data || data.length === 0) return [];

    return (data as { stage_key: string; position: number; enabled: boolean }[]).map((r) => ({
      stageKey: r.stage_key,
      position: r.position,
      enabled:  Boolean(r.enabled),
    }));
  } catch {
    return [];
  }
}
