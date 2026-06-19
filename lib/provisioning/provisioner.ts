/**
 * Provider-agnostic tenant provisioning (orchestrator contract)
 *
 * Goal: provision a new tenant end-to-end across ANY supported CMS with a single
 * flow. The CMS-specific work differs a lot, so each provider implements the
 * `TenantProvisioner` contract; the orchestrator handles everything common
 * (tenant record, domain → Vercel + DNS, platform redeploy, smoke test).
 *
 *   ┌─ common (orchestrator) ──────────────────────────────────────────────┐
 *   │ create tenant → [provider.provision] → [provider.finalize] →          │
 *   │ Vercel domain + DNS (manual at registrar) → platform redeploy → smoke │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Provider matrix:
 *   - statamic  → self-hosted: GitHub repo from template + Ploi Cloud app (IaC).
 *                 Reference implementation lives in the tenant Setup actions
 *                 (provisionTenantCmsAction / finalizeTenantProvisioningAction)
 *                 and lib/provisioning/cms-provisioner.ts.
 *   - sanity    → SaaS: Sanity Management API — create project + dataset, mint a
 *                 write token, seed platform variant docs, store on the tenant.
 *   - storyblok → SaaS: Storyblok Management API — create space, read the access
 *                 token, seed content, store on the tenant.
 *
 * NOT automatable from the platform (inherent manual / async):
 *   - DNS records at the registrar (e.g. Strato) — outside our control.
 *   - Waiting for the Ploi app to become healthy (Statamic) and for DNS / SSL.
 */

import "server-only";
import type { TenantSettings } from "@/tenant/server";

export type CmsProviderKey = "statamic" | "sanity" | "storyblok";

export interface ProvisionStep { label: string; ok: boolean; note: string }

export interface ProvisionContext {
  tenantId: string;
  tenant:   TenantSettings;
  /** Public apex domain chosen for the tenant, e.g. "steunles.nl" (optional at provision time). */
  domain?:  string;
  /** Preview only — don't create external resources. */
  dryRun?:  boolean;
}

export interface ProvisionOutcome {
  ok:      boolean;
  steps:   ProvisionStep[];
  /** Provider-specific handle the operator needs for the finalize step (e.g. the Ploi host). */
  awaiting?: { label: string; hint: string } | null;
  detail?: string;
}

/**
 * A CMS-specific provisioner. `provision()` creates the backing CMS instance
 * (repo + Ploi app / Sanity project / Storyblok space). `finalize()` wires the
 * tenant to it (base URL / project id / token) once any async creation settled.
 */
export interface TenantProvisioner {
  readonly provider: CmsProviderKey;
  /** Human label for the admin UI. */
  readonly label: string;
  /** Whether this provider needs infra (repo/host) vs pure SaaS API. */
  readonly selfHosted: boolean;
  provision(ctx: ProvisionContext): Promise<ProvisionOutcome>;
  finalize(ctx: ProvisionContext & { handle?: string }): Promise<ProvisionOutcome>;
}

/**
 * Registry. Statamic is implemented today via the tenant Setup actions; Sanity
 * and Storyblok are added here in the next phase (each with its own first-run
 * test against the live Management API).
 */
const REGISTRY: Partial<Record<CmsProviderKey, () => Promise<TenantProvisioner>>> = {
  // statamic: async () => (await import("./providers/statamic-provisioner")).statamicProvisioner,
  // sanity:    async () => (await import("./providers/sanity-provisioner")).sanityProvisioner,
  // storyblok: async () => (await import("./providers/storyblok-provisioner")).storyblokProvisioner,
};

export async function getProvisioner(provider: CmsProviderKey): Promise<TenantProvisioner | null> {
  const factory = REGISTRY[provider];
  return factory ? factory() : null;
}

export function isProvisioningSupported(provider: string): provider is CmsProviderKey {
  return provider === "statamic" || provider === "sanity" || provider === "storyblok";
}
