/**
 * TenantReadinessChecklist
 *
 * Renders the readiness checklist for a tenant — a compact card that shows
 * which configuration steps are complete and which still need attention.
 *
 * ─── What it shows ────────────────────────────────────────────────────────────
 *
 *   Header: "X of Y checks passed" with a colour-coded badge.
 *   Body:   One row per readiness check — ✓/✗ icon, label, and hint text
 *           (only shown when the check has not passed).
 *
 * ─── Surfaces ─────────────────────────────────────────────────────────────────
 *
 *   1. Onboarding success panel (/admin/onboarding)
 *      — Pass `websiteUrl` from the form so the URL check evaluates correctly.
 *
 *   2. Tenant detail page (/admin/tenants/[tenantId])
 *      — Omit `websiteUrl`; the URL check shows as "pending" with a reminder.
 *
 * ─── Server-safe ──────────────────────────────────────────────────────────────
 *
 *   No "use client" directive — pure presentational, no hooks, no event
 *   handlers.  Uses only getTenantReadiness() (a pure function) and standard
 *   React JSX.  Safe to import from Server Components, Client Components, or
 *   tests.
 */

import { cn }                  from "@/lib/utils";
import { Card, CardContent }   from "@/components/ui/Card";
import { Badge }               from "@/components/ui/Badge";
import { getTenantReadiness }  from "@/onboarding";
import type { TenantSettings } from "@/tenant";
import type { ReadinessCheck } from "@/onboarding";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

// ── Internal atoms ────────────────────────────────────────────────────────────

/** A single row in the checklist. */
function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-neutral-100 py-2.5 last:border-0">
      {/* Pass / fail indicator */}
      <span
        className={cn(
          "mt-px shrink-0 text-sm font-bold leading-none",
          check.passed ? "text-success-600" : "text-warning-500",
        )}
        aria-hidden
      >
        {check.passed ? "✓" : "✗"}
      </span>

      {/* Label and optional hint */}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            check.passed ? "text-neutral-800" : "text-neutral-500",
          )}
        >
          {check.label}
        </span>
        {!check.passed && check.hint && (
          <p className="mt-0.5 text-xs leading-snug text-neutral-400">
            {check.hint}
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
 * Readiness checklist card for a single tenant.
 *
 * @param tenant      The tenant's stored settings (required).
 * @param websiteUrl  The tenant's primary website URL or hostname, when
 *                    available.  Not stored in TenantSettings — pass it from
 *                    the onboarding form state.  Omit on the tenant detail page.
 * @param title       Card header label.  Defaults to "Setup readiness".
 *                    Pass "Before launch" on the onboarding success panel.
 * @param className   Optional extra CSS classes on the outer Card wrapper.
 *
 * @example
 * // Onboarding success panel — custom title + websiteUrl from form state:
 * <TenantReadinessChecklist
 *   tenant={result.tenant}
 *   websiteUrl={form.websiteUrl}
 *   title="Before launch"
 * />
 *
 * // Tenant detail page — default title, no websiteUrl:
 * <TenantReadinessChecklist tenant={tenant} />
 */
export function TenantReadinessChecklist({
  tenant,
  websiteUrl,
  title,
  className,
}: {
  tenant:      TenantSettings;
  websiteUrl?: string;
  title?:      string;
  className?:  string;
}) {
  const readiness = getTenantReadiness(tenant, { websiteUrl });

  // ── Header badge ─────────────────────────────────────────────────────────────
  const badgeVariant: BadgeVariant = readiness.allPassed
    ? "success"
    : readiness.passedCount >= readiness.totalCount / 2
      ? "warning"
      : "outline";

  const badgeLabel = readiness.allPassed
    ? "All set"
    : `${readiness.passedCount} / ${readiness.totalCount}`;

  return (
    <Card padding="md" shadow="sm" className={className}>
      {/* Card header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {title ?? "Setup readiness"}
        </p>
        <Badge variant={badgeVariant} size="sm" dot={readiness.allPassed}>
          {badgeLabel}
        </Badge>
      </div>

      <CardContent>
        {/* Summary line when not fully ready */}
        {!readiness.allPassed && (
          <p className="mb-3 text-xs text-neutral-500">
            {readiness.totalCount - readiness.passedCount} step
            {readiness.totalCount - readiness.passedCount !== 1 ? "s" : ""} remaining
            before this tenant is production-ready.
          </p>
        )}

        {/* Check rows */}
        <div>
          {readiness.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
