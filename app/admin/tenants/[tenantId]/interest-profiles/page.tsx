/**
 * Tenant Admin — Interest Profiles
 *
 * Server component: loads data, renders shell + banners.
 * All interactivity (toggle, optimistic update) is handled by ProfilesClient.
 *
 * ─── Why ProfilesClient is a client component ─────────────────────────────────
 *
 *   The inline `"use server"` pattern for toggle buttons only works inside
 *   async server component functions, NOT in synchronous React function
 *   components.  ProfileToggle was a sync component — its server action
 *   binding was silently dropped by Next.js, leaving the button unresponsive.
 *
 *   The fix: move the toggle table into a "use client" component (ProfilesClient)
 *   that calls POST /api/admin/tenants/[tenantId]/interest-profiles/toggle with
 *   optimistic state updates and per-row error rollback.
 *
 * ─── Per-tenant overrides (migration 088) ─────────────────────────────────────
 *
 *   Platform-wide active profiles default to "enabled" for every tenant.
 *   Admins can disable individual platform profiles per tenant.
 *   The runtime scoring engine (listActiveInterestProfiles) filters these out.
 *
 * ─── Scoring context ──────────────────────────────────────────────────────────
 *
 *   Context variables produced:
 *     interestPrimary    — key of the top-scoring profile
 *     interestSecondary  — key of the second-highest profile
 *     interestConfidence — normalised score (0–1) of the primary profile
 *     interest<Key>Score — per-profile score (e.g. interestPricingFocusedScore)
 */

import Link                         from "next/link";
import { notFound }                 from "next/navigation";
import { getTenantById }            from "@/tenant/server";
import { normalizeTenant }          from "@/tenant/normalize";
import { listProfilesWithOverridesAction, setProfileEnabledAction } from "./actions";
import type { AnnotatedInterestProfile }   from "./actions";
import { Text }                     from "@/components/primitives/Text";
import { ProfilesClient }           from "./_components/ProfilesClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTableMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("schema cache")             ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist")           ||
    lower.includes("undefined_table")
  );
}

// ── Banners ───────────────────────────────────────────────────────────────────

function MigrationNeededBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 space-y-2">
      <p className="font-semibold">Database migration required</p>
      <p>
        The{" "}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">interest_profiles</code>{" "}
        table does not exist yet, or the{" "}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">tenant_id</code>{" "}
        column has not been added.
      </p>
      <p className="text-xs text-amber-700">
        Run{" "}
        <code className="font-mono bg-amber-100 px-0.5 rounded">supabase db push</code>{" "}
        from the project root to apply all pending migrations, then reload this page.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantInterestProfilesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();
  const tenant = normalizeTenant(rawTenant);

  const result = await listProfilesWithOverridesAction(tenantId);
  const tableMissing = !result.ok && isTableMissingError(result.error);


  const allProfiles: AnnotatedInterestProfile[] = result.ok ? result.data : [];
  const error: string | null = result.ok || tableMissing ? null : result.error;

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Interest profiles</h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-xl">
            Manage interest profiles for{" "}
            <span className="font-medium text-neutral-700">{tenant.name ?? tenantId}</span>.{" "}
            Toggle platform-wide profiles on or off for this tenant.
            Scores become context variables for rules and AI decisions.
          </p>
        </div>
        <Link
          href={`/admin/tenants/${tenantId}/interest-profiles/new`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <span>+</span>
          New profile
        </Link>
      </div>

      {/* ── Banners ────────────────────────────────────────────────────────── */}
      {tableMissing && <MigrationNeededBanner />}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Failed to load profiles</p>
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {/* ── Plan gate (removed — interest profiles are available on all plans) */}
      {false && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-700">Interest profiles not included in current plan</p>
          <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
            Upgrade this tenant&apos;s plan at{" "}
            <Link href="/admin/platform/billing/plans" className="text-brand-600 hover:underline">/admin/platform/billing/plans</Link>
            {" "}to unlock interest profiles and behavioral scoring.
          </p>
        </div>
      )}

      {/* ── Body — delegated to client component ───────────────────────────── */}
      {!tableMissing && !error && (
        <ProfilesClient
          initialProfiles={allProfiles}
          tenantId={tenantId}
        />
      )}

    </div>
  );
}
