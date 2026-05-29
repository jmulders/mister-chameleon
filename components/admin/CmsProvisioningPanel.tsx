/**
 * CmsProvisioningPanel — "Sync CMS"
 *
 * Admin panel for syncing / repairing a tenant's CMS content.  This is a
 * REPEATABLE action that recreates missing or stale CMS documents without
 * touching tenant settings, design, or integration config.
 *
 * ─── What "Sync CMS" does ─────────────────────────────────────────────────────
 *
 *   Writes (or overwrites) the following documents in the CMS:
 *     • Homepage, About, Contact page documents
 *     • Any additional pages stored in the internal page builder
 *     • Hero / Proof / CTA variant documents (default starter copy)
 *     • Package-gated homepage section blocks
 *
 *   Uses create-or-replace — each run is safe to repeat.
 *   Records cmsProvisionedAt after a successful sync.
 *
 * ─── What "Sync CMS" does NOT do ─────────────────────────────────────────────
 *
 *   • Does NOT touch tenant settings, packageKey, or features
 *   • Does NOT reset design system baseline (theme, blocks, token overrides)
 *   • Does NOT reset integration config (CRM, enrichment, AI mode)
 *   • Does NOT set siteInitializedAt — that timestamp is exclusive to
 *     "Initialize site" on the Overview page
 *
 * ─── Distinct from "Initialize site" ─────────────────────────────────────────
 *
 *   "Initialize site" (on the Overview tab) is the first-time full tenant
 *   bootstrap: it sets design system baseline, integration defaults, AND
 *   provisions CMS pages in one step.  Use it once when onboarding a tenant.
 *
 *   "Sync CMS" is for ongoing maintenance — recreating missing CMS docs,
 *   repairing a broken or partial provisioning, or syncing CMS content after
 *   a page-builder change.  Safe to run at any time.
 *
 * ─── Guards ───────────────────────────────────────────────────────────────────
 *
 *   The "Sync CMS" button is disabled when the CMS provider is "mock" or when
 *   no projectId is configured — a real CMS must be connected first.
 */

"use client";

import { useTransition, useState }    from "react";
import { Card, CardContent }          from "@/components/ui/Card";
import { Badge }                      from "@/components/ui/Badge";
import { getPackageDefinition }       from "@/tenant";
import { provisionSiteAction }        from "@/app/admin/tenants/[tenantId]/actions";
import type { ProvisionSiteResult }   from "@/app/admin/tenants/[tenantId]/types";
import type { TenantSettings, PackageKey } from "@/tenant";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CmsProvisioningPanelProps {
  tenant: Pick<
    TenantSettings,
    "tenantId" | "packageKey" | "design" | "cms" | "cmsProvisionedAt"
  > & {
    /**
     * Whether a per-tenant CMS write token is stored server-side.
     * When false AND no platform env var is configured, syncing will fail
     * with a clear error. The panel shows a warning in this case so the
     * operator knows to add a token before syncing.
     */
    hasCmsWriteToken?: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year:   "numeric",
      month:  "short",
      day:    "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Sync CMS panel for the admin Content tab.
 *
 * Displays current sync state, a summary of what will be written, and the
 * action button.  Keeps result state locally so the page doesn't reload on
 * success.
 *
 * @example
 * <CmsProvisioningPanel tenant={tenant} />
 */
export function CmsProvisioningPanel({ tenant }: CmsProvisioningPanelProps) {
  const { tenantId, packageKey, design, cms, cmsProvisionedAt, hasCmsWriteToken } = tenant;

  const [isPending, startTransition] = useTransition();
  const [result, setResult]          = useState<ProvisionSiteResult | null>(null);

  const pkg           = getPackageDefinition(packageKey);
  const allowedBlocks = pkg.allowedBlocks.content;

  // ── CMS guard ────────────────────────────────────────────────────────────
  // Sanity requires a per-tenant projectId; other real providers (Storyblok,
  // Statamic, platform) rely on platform-level credentials and have no
  // per-tenant projectId requirement.
  const needsProjectId = cms.provider === "sanity";
  const cmsReady       = cms.provider !== "mock" && (!needsProjectId || !!cms.projectId);
  const alreadySynced  = !!cmsProvisionedAt;
  // Write-token warning is Sanity-only — Storyblok/Statamic/platform use
  // platform-level credentials, not a per-tenant write token.
  // Only warn when hasCmsWriteToken is explicitly false (not undefined) so we
  // stay silent when the parent page doesn't supply the prop.
  const showTokenWarning = cms.provider === "sanity" && hasCmsWriteToken === false;

  // ── Action ───────────────────────────────────────────────────────────────
  function handleSync() {
    startTransition(async () => {
      const r = await provisionSiteAction(tenantId);
      setResult(r);
    });
  }

  // ── What will be synced ──────────────────────────────────────────────────
  // Matches the logic in buildHomepageSections() in tenant-provisioner.ts.
  const allowedSet      = new Set(allowedBlocks);
  const plannedSections: string[] = [];
  if (allowedSet.has("textSection"))        plannedSections.push("Text section (intro)");
  if (allowedSet.has("featureGrid"))        plannedSections.push("Feature grid");
  if (allowedSet.has("testimonialSection")) plannedSections.push("Testimonial section");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card padding="md" shadow="sm" className="mb-6">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Sync CMS
        </p>
        <Badge
          variant={alreadySynced ? "success" : "outline"}
          size="sm"
          dot={alreadySynced}
        >
          {alreadySynced ? "Synced" : "Not synced"}
        </Badge>
      </div>

      <CardContent>

        {/* Last synced date */}
        {alreadySynced && (
          <p className="mb-3 text-xs text-neutral-500">
            Last synced:{" "}
            <span className="font-medium text-neutral-700">
              {formatDate(cmsProvisionedAt!)}
            </span>
          </p>
        )}

        {/* Scope callout — what this action does and doesn't change */}
        <div className="mb-4 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-xs">
          <p className="mb-2 font-medium text-neutral-700">Will sync / repair:</p>
          <ul className="space-y-1 text-neutral-500">
            <li>• Homepage page document (<code>home</code>)</li>
            <li>• About page document (<code>about</code>)</li>
            <li>• Contact page document (<code>contact</code>)</li>
            <li>• Hero variant — default brand copy</li>
            <li>• Proof variant — starter trust signals</li>
            <li>• CTA variant — get-in-touch call to action</li>
            {plannedSections.map((s) => (
              <li key={s}>• Homepage section: {s}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-neutral-400">
            Any additional pages stored in the page builder for this tenant will also be
            synced.  Each document is written with create-or-replace — safe to repeat.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 pt-2 text-neutral-400 border-t border-neutral-200">
            <span>
              Package:{" "}
              <span className="font-medium text-neutral-600">
                {PACKAGE_DISPLAY[packageKey]}
              </span>
            </span>
            <span>
              Theme:{" "}
              <span className="font-medium text-neutral-600">
                {design.theme}
                {design.primaryColor ? ` · ${design.primaryColor}` : ""}
              </span>
            </span>
            <span>
              CMS:{" "}
              <span className="font-medium text-neutral-600">
                {cms.provider}
                {cms.projectId ? ` · ${cms.projectId}` : ""}
              </span>
            </span>
          </div>
          <p className="mt-2 text-[11px] italic text-neutral-400 border-t border-neutral-200 pt-2">
            Only CMS documents are updated — tenant settings, design tokens, and
            integration config are not changed.
          </p>
        </div>

        {/* Warning when re-syncing (content in Sanity Studio may be overwritten) */}
        {alreadySynced && !result && (
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ Resyncing will overwrite existing starter documents in the CMS.  Any
            content edits made directly in Sanity Studio since the last sync may be lost.
          </p>
        )}

        {/* CMS not configured warning */}
        {!cmsReady && (
          <p className="mb-3 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
            {cms.provider === "mock"
              ? "Switch to a real CMS provider in tenant settings before syncing."
              : <>
                  CMS not ready — provider is{" "}
                  <code className="font-mono">{cms.provider}</code>
                  {needsProjectId && !cms.projectId ? " but Project ID is missing" : ""}.
                  {needsProjectId
                    ? " Configure the Project ID and Dataset in tenant settings."
                    : " Configure the provider credentials in Platform → CMS settings."}
                </>
            }
          </p>
        )}

        {/* Write token warning — shown when no per-tenant token is stored */}
        {cmsReady && showTokenWarning && (
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ No per-tenant write token configured. Syncing will use the{" "}
            <code className="font-mono">SANITY_API_WRITE_TOKEN</code> /{" "}
            <code className="font-mono">SANITY_WRITE_TOKEN</code> environment variable
            if set. If neither is configured, the sync will fail.
            Add a write token via the CMS Credentials panel above.
          </p>
        )}

        {/* Result feedback */}
        {result && (
          <div
            className={`mb-3 rounded-md border px-3 py-2.5 text-xs ${
              result.ok
                ? "border-success-200 bg-success-50 text-success-800"
                : "border-error-200 bg-error-50 text-error-800"
            }`}
          >
            {result.ok ? (
              <>
                <p className="mb-1 font-semibold">✓ CMS synced</p>
                <div className="mt-1 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-success-700">
                  <span>
                    Pages:{" "}
                    <span className="font-semibold">{result.pagesCreated} created</span>
                    {result.pagesUpdated > 0 && (
                      <span>, {result.pagesUpdated} updated</span>
                    )}
                  </span>
                  <span>
                    Variants:{" "}
                    <span className="font-semibold">{result.variantsWritten} written</span>
                  </span>
                </div>
                <ul className="space-y-0.5 text-success-700">
                  {result.documentIds.map((id) => (
                    <li key={id}>
                      <code className="font-mono">{id}</code>
                    </li>
                  ))}
                </ul>
                {result.warnings.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-amber-700">
                    {result.warnings.map((w, i) => (
                      <li key={i}>⚠ {w}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="mb-1 font-semibold">✗ Sync failed</p>
                <p className="text-error-700">{result.error}</p>
                {result.partial && result.partial.length > 0 && (
                  <p className="mt-1 text-error-600">
                    Partial write — {result.partial.length} document
                    {result.partial.length !== 1 ? "s" : ""} were written before the error.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleSync}
          disabled={isPending || !cmsReady}
          className="rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          {isPending
            ? "Syncing…"
            : alreadySynced
              ? "Resync CMS"
              : "Sync CMS"
          }
        </button>

      </CardContent>
    </Card>
  );
}
