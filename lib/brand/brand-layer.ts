/**
 * lib/brand/brand-layer.ts
 *
 * Which brand layer a site carries.
 *
 * The platform serves many tenants, each with its own theme. Mister Chameleon's
 * own marketing site carries one thing more: decoration taken from the logo
 * (the arc of coloured dots). That decoration lives in
 * app/brand/mister-chameleon.css and is scoped to `html[data-brand]`, so no
 * other tenant ever sees it.
 */

export type BrandLayer = "mister-chameleon";

/** Tenant that runs the marketing site when MARKETING_SITE_TENANT is not set. */
export const DEFAULT_MARKETING_SITE_TENANT = "statamic";

/**
 * The brand layer for a tenant, or null for none. Only the marketing-site
 * tenant gets one (MARKETING_SITE_TENANT, default "statamic").
 */
export function brandLayerFor(
  tenantId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): BrandLayer | null {
  const marketingTenant = env["MARKETING_SITE_TENANT"]?.trim() || DEFAULT_MARKETING_SITE_TENANT;
  return tenantId && tenantId === marketingTenant ? "mister-chameleon" : null;
}
