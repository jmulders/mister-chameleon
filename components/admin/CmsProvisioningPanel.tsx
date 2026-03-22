/**
 * CmsProvisioningPanel
 *
 * Admin panel for provisioning a tenant's starter content into the shared
 * Sanity CMS.  Shows the current provisioning state, a summary of what will
 * be written, and a "Provision site to CMS" action button.
 *
 * ─── What it shows ────────────────────────────────────────────────────────────
 *
 *   • Provisioning status — "Not provisioned" or "Last provisioned: <date>"
 *   • Package summary — which package tier controls the content block set
 *   • Content block set — the sections that will be written (package-gated)
 *   • Design snapshot — active theme preset + primaryColor if set
 *   • CMS target — provider and projectId from tenant settings
 *   • Action result — document IDs written on success, or error details
 *
 * ─── Idempotency warning ──────────────────────────────────────────────────────
 *
 *   When the tenant has already been provisioned, a "content will be replaced"
 *   warning is shown before the button so operators know re-provisioning
 *   overwrites any customisations made in Sanity Studio.
 *
 * ─── Guards ───────────────────────────────────────────────────────────────────
 *
 *   The "Provision" button is disabled when the CMS provider is "mock" or
 *   when no projectId is configured — the operator must connect a real CMS
 *   before provisioning makes sense.
 *
 * ─── Server action integration ────────────────────────────────────────────────
 *
 *   Calls `provisionSiteAction(tenantId)` via `useTransition` so the button
 *   shows a loading state without a page reload.
 */

"use client";

import { useTransition, useState }    from "react";
import { Card, CardContent }          from "@/components/ui/Card";
import { Badge }                      from "@/components/ui/Badge";
import { getPackageDefinition }       from "@/tenant";
import { provisionSiteAction }        from "@/app/admin/tenants/[tenantId]/actions";
import type { ProvisionSiteResult }   from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantSettings, PackageKey } from "@/tenant";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CmsProvisioningPanelProps {
  tenant: Pick<
    TenantSettings,
    "tenantId" | "packageKey" | "design" | "cms" | "cmsProvisionedAt"
  > & {
    /**
     * Whether a per-tenant CMS write token is stored server-side.
     * When false AND no platform env var is configured, provisioning will fail
     * with a clear error. The panel shows a warning in this case so the
     * operator knows to add a token before provisioning.
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
 * Provisioning panel for the admin tenant detail page.
 *
 * Displays current provisioning state, a summary of what will be written,
 * and the action button.  Keeps result state locally in the component so
 * the page doesn't reload on success (the revalidatePath in the action
 * will refresh the server component data on next navigation).
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
  const cmsReady       = cms.provider !== "mock" && !!cms.projectId;
  const alreadyDone    = !!cmsProvisionedAt;
  // Show a token warning when neither a per-tenant token nor an env-level
  // token is known to be configured.  We can't verify the env vars client-side
  // so we only warn when hasCmsWriteToken is explicitly false; when undefined
  // (not supplied by the parent page) we stay silent.
  const showTokenWarning = hasCmsWriteToken === false;

  // ── Action ───────────────────────────────────────────────────────────────
  function handleProvision() {
    startTransition(async () => {
      const r = await provisionSiteAction(tenantId);
      setResult(r);
    });
  }

  // ── Sections that will be written ────────────────────────────────────────
  // Matches the logic in buildHomepageSections() in tenant-provisioner.ts.
  const allowedSet     = new Set(allowedBlocks);
  const plannedSections: string[] = [];
  if (allowedSet.has("textSection"))       plannedSections.push("Text section (intro)");
  if (allowedSet.has("featureGrid"))       plannedSections.push("Feature grid");
  if (allowedSet.has("testimonialSection")) plannedSections.push("Testimonial section");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card padding="md" shadow="sm" className="mb-6">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          CMS provisioning
        </p>
        <Badge
          variant={alreadyDone ? "success" : "outline"}
          size="sm"
          dot={alreadyDone}
        >
          {alreadyDone ? "Provisioned" : "Not provisioned"}
        </Badge>
      </div>

      <CardContent>

        {/* Last provisioned date */}
        {alreadyDone && (
          <p className="mb-3 text-xs text-neutral-500">
            Last provisioned:{" "}
            <span className="font-medium text-neutral-700">
              {formatDate(cmsProvisionedAt!)}
            </span>
          </p>
        )}

        {/* What will be written */}
        <div className="mb-4 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-xs">
          <p className="mb-2 font-medium text-neutral-700">Will provision:</p>
          <ul className="space-y-1 text-neutral-500">
            <li>• Homepage page document (<code>home</code>)</li>
            <li>• Hero variant — default brand copy</li>
            <li>• Proof variant — starter trust signals</li>
            <li>• CTA variant — get-in-touch call to action</li>
            {plannedSections.map((s) => (
              <li key={s}>• Homepage section: {s}</li>
            ))}
          </ul>
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
        </div>

        {/* Idempotency warning when already provisioned */}
        {alreadyDone && !result && (
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ Re-provisioning will <strong>replace</strong> the existing starter documents.
            Any content you have edited in Sanity Studio will be overwritten.
          </p>
        )}

        {/* CMS not configured warning */}
        {!cmsReady && (
          <p className="mb-3 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
            CMS is not configured (provider is{" "}
            <code className="font-mono">{cms.provider}</code>
            {!cms.projectId ? ", projectId missing" : ""}).
            Configure a real CMS provider and project ID in tenant settings before provisioning.
          </p>
        )}

        {/* Write token warning — shown when no per-tenant token is stored */}
        {cmsReady && showTokenWarning && (
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ No per-tenant write token configured. Provisioning will use the{" "}
            <code className="font-mono">SANITY_API_WRITE_TOKEN</code> /{" "}
            <code className="font-mono">SANITY_WRITE_TOKEN</code> environment variable
            if set. If neither is configured, provisioning will fail.
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
                <p className="mb-1 font-semibold">
                  ✓ Provisioned {result.documentIds.length} document
                  {result.documentIds.length !== 1 ? "s" : ""}
                </p>
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
                <p className="mb-1 font-semibold">✗ Provisioning failed</p>
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
          onClick={handleProvision}
          disabled={isPending || !cmsReady}
          className="rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          {isPending
            ? "Provisioning…"
            : alreadyDone
              ? "Re-provision site"
              : "Provision site to CMS"
          }
        </button>

      </CardContent>
    </Card>
  );
}
