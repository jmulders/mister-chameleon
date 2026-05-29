/**
 * site/index.ts
 *
 * Barrel export for the site initialization module.
 *
 * ─── Primary consumer ─────────────────────────────────────────────────────────
 *
 *   app/admin/tenants/[tenantId]/actions.ts — calls initializeSite() from
 *   createSiteAction() as PART 6 (blueprint-driven initialization).
 *
 * ─── Secondary consumers ──────────────────────────────────────────────────────
 *
 *   components/layout/Header.tsx — imports getSiteNavigation() for the
 *   DB-nav fallback when CMS nav is empty.
 */

// Central orchestrator
export { initializeSite }              from "./initialize-site";

// Navigation DB layer (used by Header for CMS fallback)
export { getSiteNavigation }           from "./navigation-store";

// Types
export type {
  SiteIntakeData,
  InitializeSiteInput,
  InitializeSiteResult,
  CreatedPageResult,
  NavItemResult,
  TenantSiteRow,
  TenantSiteSetupRow,
  SiteNavRow,
}                                      from "./types";
