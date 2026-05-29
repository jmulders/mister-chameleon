/**
 * SiteBuilderReadiness
 *
 * Compact pre-flight checklist for the page-system / site-builder stack.
 * Shows whether the tenant's runtime infrastructure is wired up and ready:
 * template registry, block registry, design tokens, CMS connectivity, and
 * the key content-capability gates (forms, listing/detail, search).
 *
 * ─── What it shows ────────────────────────────────────────────────────────────
 *
 *   Header: "X of Y ready" with a colour-coded badge.
 *   Body:   One row per readiness item — ✓/✗ icon, status phrase, and a hint
 *           (only shown on failing rows).
 *
 * ─── Check overview ───────────────────────────────────────────────────────────
 *
 *   1. Templates registered      — getAllTemplateDefinitions().length > 0
 *   2. Block registry            — live block count from getAllBlockDefinitions()
 *   3. Theme & tokens resolved   — getResolvedTenantTheme() succeeds; non-default
 *                                  preset or color/font overrides in use?
 *   4. CMS page mapping          — cms.provider !== "mock" AND cms.projectId set
 *   5. Forms capability          — formSection in getEnabledContentTypes()
 *   6. Listing & detail pages    — listing or articleBody enabled
 *   7. Search                    — search block enabled
 *
 * ─── Surfaces ─────────────────────────────────────────────────────────────────
 *
 *   1. /admin/tenants/[tenantId]  — full infrastructure + capability check
 *   2. /dashboard/tenant          — operational readiness summary
 *
 * ─── Server-safe ──────────────────────────────────────────────────────────────
 *
 *   No "use client" directive — pure presentational, no hooks, no event
 *   handlers.  Safe to import from Server Components or tests.
 */

import { cn }                                       from "@/lib/utils";
import { Card, CardContent }                        from "@/components/ui/Card";
import { Badge }                                    from "@/components/ui/Badge";
import { getAllTemplateDefinitions, getAllBlockDefinitions } from "@/page-config";
import { getEnabledContentTypes, getResolvedTenantTheme }   from "@/tenant";
import type { TenantSettings }                      from "@/tenant";
import type { ContentBlockKey }                     from "@/tenant";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

interface ReadinessItem {
  id:      string;
  label:   string;
  passed:  boolean;
  /** Brief status phrase — always visible to the right of the label. */
  detail:  string;
  /** Actionable hint — only shown when the check has not passed. */
  hint?:   string;
}

// ── Logic ─────────────────────────────────────────────────────────────────────

function computeItems(tenant: TenantSettings | null): ReadinessItem[] {

  // ── 1. Template registry ────────────────────────────────────────────────────
  const templates     = getAllTemplateDefinitions();
  const tplCount      = templates.length;
  const tplReady      = tplCount > 0;

  // ── 2. Block registry — live blocks only ────────────────────────────────────
  const allBlocks     = getAllBlockDefinitions();
  const liveBlocks    = allBlocks.filter((b) => b.status === "live");
  const definedBlocks = allBlocks.filter((b) => b.status === "defined");
  const blocksReady   = liveBlocks.length > 0;

  // ── 3. Theme / tokens resolved ──────────────────────────────────────────────
  // getResolvedTenantTheme() always returns (has full defaults), so the
  // readiness check is "is there any intentional customisation applied?".
  // We surface this as informational (always passed) with a status phrase
  // that distinguishes "customised" from "using platform defaults".
  getResolvedTenantTheme(tenant); // ensure it resolves without throwing
  const isCustomTheme =
    !!tenant &&
    (tenant.design?.theme !== "default" ||
      !!tenant.design?.primaryColor      ||
      !!tenant.design?.primaryFont);
  const themeDetail = isCustomTheme
    ? [
        tenant!.design?.theme !== "default" ? tenant!.design?.theme : null,
        tenant!.design?.primaryColor ?? null,
        tenant!.design?.primaryFont  ?? null,
      ]
        .filter(Boolean)
        .join(" · ") || "customised"
    : "platform defaults";

  // ── 4. CMS page mapping ──────────────────────────────────────────────────────
  const cmsProvider  = tenant?.cms?.provider ?? "mock";
  const cmsProjectId = tenant?.cms?.projectId ?? "";
  // Sanity requires a per-tenant projectId; Storyblok, Statamic, and platform
  // use platform-level credentials so an empty projectId is fine for them.
  const cmsNeedsProjectId = cmsProvider === "sanity";
  const cmsReady     = cmsProvider !== "mock" && (!cmsNeedsProjectId || !!cmsProjectId);
  const cmsDetail    = cmsReady
    ? cmsProjectId ? `${cmsProvider} · ${cmsProjectId}` : cmsProvider
    : cmsProvider === "mock"
      ? "mock (no live content)"
      : `${cmsProvider} — projectId missing`;

  // ── 4b. CMS content provisioned ─────────────────────────────────────────────
  // Checks whether provisionSiteAction has been run for this tenant by reading
  // the cmsProvisionedAt timestamp stored in TenantSettings.
  const cmsProvisioned       = !!tenant?.cmsProvisionedAt;
  const cmsProvisionedDetail = cmsProvisioned
    ? (() => {
        try {
          return new Date(tenant!.cmsProvisionedAt!).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          });
        } catch {
          return "provisioned";
        }
      })()
    : "not provisioned";

  // ── 5–7. Content capability gates ───────────────────────────────────────────
  const enabledTypes = getEnabledContentTypes(tenant); // null = unrestricted

  function isEnabled(keys: ContentBlockKey[]): boolean {
    if (enabledTypes === null) return true;
    return keys.some((k) => enabledTypes.has(k));
  }

  const formsEnabled   = isEnabled(["formSection"]);
  const listingEnabled = isEnabled(["listing", "articleBody"]);
  const searchEnabled  = isEnabled(["search"]);

  // ── Assemble items ───────────────────────────────────────────────────────────

  return [
    {
      id:     "templates",
      label:  "Templates registered",
      passed: tplReady,
      detail: tplReady
        ? `${tplCount} template${tplCount !== 1 ? "s" : ""}`
        : "registry empty",
      hint: "No templates found — check page-config/templates.ts.",
    },
    {
      id:     "block-registry",
      label:  "Block registry",
      passed: blocksReady,
      detail: blocksReady
        ? `${liveBlocks.length} live · ${definedBlocks.length} defined`
        : "no live blocks",
      hint: "No blocks have status \"live\" — check page-config/registry.ts.",
    },
    {
      id:     "theme-tokens",
      label:  "Theme & tokens resolved",
      passed: true, // always resolves; we flag customisation status only
      detail: themeDetail,
    },
    {
      id:     "cms-mapping",
      label:  "CMS page mapping",
      passed: cmsReady,
      detail: cmsDetail,
      hint: cmsProvider === "mock"
        ? "Switch to a real CMS provider and set cms.projectId in tenant settings."
        : "Set cms.projectId in tenant settings to connect to the CMS project.",
    },
    {
      id:     "cms-provisioned",
      label:  "CMS content provisioned",
      passed: cmsProvisioned,
      detail: cmsProvisionedDetail,
      hint:   "Run 'Initialize site' on the Overview tab for first-time bootstrap, or 'Sync CMS' on the Content tab to repair missing CMS documents.",
    },
    {
      id:     "forms",
      label:  "Forms capability",
      passed: formsEnabled,
      detail: formsEnabled ? "formSection enabled" : "not enabled",
      hint: "Enable the formSection content block in tenant settings.",
    },
    {
      id:     "listing-detail",
      label:  "Listing & detail pages",
      passed: listingEnabled,
      detail: listingEnabled ? "listing / articleBody enabled" : "not enabled",
      hint: "Enable the listing or articleBody content blocks in tenant settings.",
    },
    {
      id:     "search",
      label:  "Search",
      passed: searchEnabled,
      detail: searchEnabled ? "search enabled" : "not enabled",
      hint: "Enable the search content block in tenant settings.",
    },
  ];
}

// ── Internal atoms ────────────────────────────────────────────────────────────

/** A single row in the readiness checklist. */
function CheckRow({ item }: { item: ReadinessItem }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-neutral-100 py-2.5 last:border-0">

      {/* Pass / fail indicator */}
      <span
        className={cn(
          "mt-px shrink-0 text-sm font-bold leading-none",
          item.passed ? "text-success-600" : "text-warning-500",
        )}
        aria-hidden
      >
        {item.passed ? "✓" : "✗"}
      </span>

      {/* Label, status phrase, and optional hint */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span
            className={cn(
              "text-sm",
              item.passed ? "text-neutral-800" : "text-neutral-500",
            )}
          >
            {item.label}
          </span>
          <span className="shrink-0 text-xs text-neutral-400">
            {item.detail}
          </span>
        </div>
        {!item.passed && item.hint && (
          <p className="mt-0.5 text-xs leading-snug text-neutral-400">
            {item.hint}
          </p>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Site builder readiness checklist card.
 *
 * @param tenant     The tenant's stored settings, or null to evaluate defaults.
 * @param title      Card header label. Defaults to "Site builder readiness".
 * @param className  Optional extra CSS classes on the outer Card wrapper.
 *
 * @example
 * // Admin tenant detail page:
 * <SiteBuilderReadiness tenant={tenant} className="mb-8" />
 *
 * // Dashboard with custom title:
 * <SiteBuilderReadiness tenant={tenantSettings} title="System readiness" />
 */
export function SiteBuilderReadiness({
  tenant,
  title,
  className,
}: {
  tenant:     TenantSettings | null;
  title?:     string;
  className?: string;
}) {
  const items       = computeItems(tenant);
  const passedCount = items.filter((i) => i.passed).length;
  const totalCount  = items.length;
  const allPassed   = passedCount === totalCount;

  const badgeVariant: BadgeVariant = allPassed
    ? "success"
    : passedCount >= Math.ceil(totalCount / 2)
      ? "warning"
      : "outline";

  const badgeLabel = allPassed
    ? "All ready"
    : `${passedCount} / ${totalCount}`;

  return (
    <Card padding="md" shadow="sm" className={className}>

      {/* Card header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {title ?? "Site builder readiness"}
        </p>
        <Badge variant={badgeVariant} size="sm" dot={allPassed}>
          {badgeLabel}
        </Badge>
      </div>

      <CardContent>

        {/* Summary line when not fully ready */}
        {!allPassed && (
          <p className="mb-3 text-xs text-neutral-500">
            {totalCount - passedCount} item
            {totalCount - passedCount !== 1 ? "s" : ""} need attention before
            the site builder is fully operational.
          </p>
        )}

        {/* Check rows */}
        <div>
          {items.map((item) => (
            <CheckRow key={item.id} item={item} />
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
