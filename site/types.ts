/**
 * site/types.ts
 *
 * TypeScript types for the site initialization system.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   site/initialize-site.ts   — central orchestrator
 *   site/page-factory.ts      — creates EditablePages from blueprint
 *   site/navigation-store.ts  — reads/writes site_navigation table
 *   site/profile-activator.ts — activates interest profiles
 *
 * ─── DB tables ────────────────────────────────────────────────────────────────
 *
 *   tenant_sites       (migration 077) — blueprint + theme + status per tenant
 *   tenant_site_setup  (migration 077) — intake data + setup_status per tenant
 *   site_navigation    (migration 077) — DB-backed nav items (Header fallback)
 */

// ── Intake form data ──────────────────────────────────────────────────────────

/**
 * Content collected from the operator during the site setup wizard.
 * Used by the content generator to scaffold initial block data.
 */
export interface SiteIntakeData {
  /** Company or brand name, e.g. "Acme Corp". */
  companyName:     string;
  /** One-paragraph description of what the company does. */
  description:     string;
  /** The target visitor segment, e.g. "B2B decision-makers at mid-market SaaS companies". */
  targetAudience:  string;
  /** Writing personality, e.g. "professional and direct" or "friendly and conversational". */
  toneOfVoice:     string;
  /** Primary CTA button label, e.g. "Book a demo" or "Start free trial". */
  primaryCtaLabel: string;
}

// ── initializeSite() input ────────────────────────────────────────────────────

export interface InitializeSiteInput {
  /** Owning tenant ID. */
  tenantId:      string;
  /**
   * Industry / archetype key matching a blueprint key, e.g. "b2b_saas".
   * Written to tenant_sites.site_type_key and used to select which interest
   * profile families to activate.
   */
  siteTypeKey:   string;
  /**
   * Blueprint key — typically equals siteTypeKey but can differ for custom
   * blueprints.  Used to look up the Blueprint definition for page + nav generation.
   */
  blueprintKey:  string;
  /**
   * Theme preset key to apply, e.g. "corporate-blue".
   * When omitted, falls back to blueprint.recommendedThemePreset ?? "default".
   */
  themeKey?:     string;
  /** Intake data from the setup wizard form. */
  intake:        SiteIntakeData;
  /**
   * Optional URL of an existing site to inspect for context.
   * Stored in tenant_site_setup.reference_url; analysis is best-effort.
   */
  referenceUrl?: string;
  /**
   * When true, overwrite existing pages and navigation (re-initialization).
   * Default: false — skips pages whose slug already exists.
   */
  overwrite?:    boolean;
}

// ── initializeSite() output ───────────────────────────────────────────────────

/** Per-page result within an initializeSite() run. */
export interface CreatedPageResult {
  /** The page's stable ID (UUID). */
  pageId:  string;
  /** URL slug, e.g. "/" for the homepage. */
  slug:    string;
  /** Human-readable page title. */
  title:   string;
  /**
   * created    — new row inserted.
   * overwritten — existing row replaced (overwrite=true).
   * skipped    — row already existed and overwrite=false.
   */
  status:  "created" | "overwritten" | "skipped";
}

/** One generated navigation item. */
export interface NavItemResult {
  /** UUID from site_navigation.id */
  id:    string;
  label: string;
  href:  string;
  order: number;
}

/**
 * Return value of initializeSite().
 *
 *   siteId         — UUID of the tenant_sites row.
 *   pages          — per-page result for every blueprint page.
 *   navigation     — top-level nav items written to site_navigation.
 *   theme          — the theme key that was applied.
 *   activeProfiles — keys of interest profiles that were activated.
 *   warnings       — non-fatal notes (e.g. profile activation errors).
 *   previewUrl     — root-relative URL for the tenant's homepage preview.
 */
export interface InitializeSiteResult {
  siteId:           string;
  pages:            CreatedPageResult[];
  navigation:       NavItemResult[];
  theme:            string;
  activeProfiles:   string[];
  /** Number of decision rules written to rules_config (preset seed). */
  seededRulesCount: number;
  warnings:         string[];
  previewUrl:       string;
}

// ── DB row types ──────────────────────────────────────────────────────────────

/** Row shape for the `tenant_sites` table (migration 077). */
export interface TenantSiteRow {
  id:            string;
  tenant_id:     string;
  site_type_key: string;
  theme_key:     string | null;
  blueprint_key: string | null;
  status:        string;
  created_at:    string;
  updated_at:    string;
}

/** Insert shape for `tenant_sites`. */
export interface TenantSiteInsert {
  id?:           string;
  tenant_id:     string;
  site_type_key: string;
  theme_key?:    string | null;
  blueprint_key?: string | null;
  status?:       string;
}

/** Row shape for the `tenant_site_setup` table (migration 077). */
export interface TenantSiteSetupRow {
  id:                string;
  tenant_id:         string;
  setup_status:      string;
  initialized_at:    string | null;
  company_name:      string | null;
  description:       string | null;
  target_audience:   string | null;
  tone_of_voice:     string | null;
  primary_cta_label: string | null;
  reference_url:     string | null;
  created_at:        string;
  updated_at:        string;
}

/** Insert shape for `tenant_site_setup`. */
export interface TenantSiteSetupInsert {
  id?:                string;
  tenant_id:          string;
  setup_status?:      string;
  initialized_at?:    string | null;
  company_name?:      string | null;
  description?:       string | null;
  target_audience?:   string | null;
  tone_of_voice?:     string | null;
  primary_cta_label?: string | null;
  reference_url?:     string | null;
}

/** Row shape for the `site_navigation` table (migration 077). */
export interface SiteNavRow {
  id:          string;
  tenant_id:   string;
  label:       string;
  href:        string;
  order_index: number;
  parent_id:   string | null;
  created_at:  string;
  updated_at:  string;
}

/** Insert shape for `site_navigation`. */
export interface SiteNavInsert {
  id?:         string;
  tenant_id:   string;
  label:       string;
  href:        string;
  order_index: number;
  parent_id?:  string | null;
}
