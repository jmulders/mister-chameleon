import { TenantSetupWizard } from "./_components/TenantSetupWizard";

/**
 * New Tenant Setup — /dashboard/tenants/new
 *
 * Internal-only guided wizard for creating a new tenant configuration.
 * Walks through 6 steps: identity, providers, pages & blocks, contact &
 * features, theme, then generates a copy-pasteable TypeScript config snippet.
 *
 * Persistence approach (Phase 3):
 *   No config store or DB write yet. The wizard outputs a fully-formed
 *   TypeScript code block that the developer copies into:
 *     tenant/templates/<tenantId>-config.ts
 *   …and registers in resolve-tenant.ts.
 *
 *   When a config store is ready, add a Server Action to the final step
 *   that writes the config and triggers a resolver rebuild.
 */
export const metadata = {
  title: "New Tenant · Dashboard",
};

export default function NewTenantPage() {
  return <TenantSetupWizard />;
}
