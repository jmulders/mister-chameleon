/**
 * Admin — Interest Profiles List
 *
 * Lists all platform-managed interest profiles grouped by family and status.
 *
 *   ACTIVE     — is_active = true; evaluated on every page request.
 *   SUGGESTED  — is_active = false, default_status = 'suggested'; shown as
 *                recommended profiles operators can enable per-tenant.
 *
 * Interest profiles are used by the scoring engine to categorise visitor
 * engagement. When a visitor views pages with matching metaKeywords, the
 * platform accumulates a keyword cloud and scores it against each profile.
 * The resulting scores feed the interestPrimary, interestSecondary, and
 * interestConfidence context variables used by rules and AI decisions.
 */

import React                        from "react";
import Link                        from "next/link";
import { listAllInterestProfiles } from "@/interest-profiles/repository";
import { SeedCatalogButton }             from "./_components/SeedCatalogButton";
import { Badge }                   from "@/components/ui/Badge";
import { Card, CardContent }       from "@/components/ui/Card";
import { Text }                    from "@/components/primitives/Text";
import { CATALOG_SIZE }            from "@/interest-profiles/catalog";
import type {
  InterestProfile,
  InterestProfileFamily,
}                                  from "@/interest-profiles/types";

// ── Family display config ─────────────────────────────────────────────────────

const FAMILY_CONFIG: Record<
  InterestProfileFamily,
  { label: string; colour: string }
> = {
  b2b_saas:    { label: "B2B / SaaS",   colour: "bg-blue-50 text-blue-700 ring-blue-200" },
  careers:     { label: "Careers",      colour: "bg-violet-50 text-violet-700 ring-violet-200" },
  commerce:    { label: "Commerce",     colour: "bg-amber-50 text-amber-700 ring-amber-200" },
  real_estate: { label: "Real Estate",  colour: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

const FAMILY_ORDER: InterestProfileFamily[] = [
  "b2b_saas", "careers", "commerce", "real_estate",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive the scoring engine context variable from a profile key.
 * Matches toPascalCase() in interest-profiles/scoring.ts exactly
 * (handles both hyphens and underscores).
 */
function toScoreVar(key: string): string {
  const pascal = key
    .replace(/[-_](.)/g, (_, c: string) => (c as string).toUpperCase())
    .replace(/^(.)/, (c) => (c as string).toUpperCase());
  return `interest${pascal}Score`;
}

function isTableMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("schema cache")            ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist")           ||
    lower.includes("undefined_table")
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
        <svg className="h-7 w-7 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-neutral-800">No interest profiles yet</p>
      <p className="mt-1 text-sm text-neutral-500 max-w-sm">
        Run <code className="font-mono text-xs bg-neutral-100 px-1 rounded">supabase db push</code> to
        seed the canonical catalog, or create the first profile manually.
      </p>
      <Link
        href="/admin/interest-profiles/new"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        <span>+</span>
        New profile
      </Link>
    </div>
  );
}

function MigrationNeededBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 space-y-2">
      <p className="font-semibold">Database migration required</p>
      <p>
        The{" "}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">interest_profiles</code>{" "}
        table does not exist in your database yet. Interest profile management will not be
        available until the migration is applied.
      </p>
      <p className="text-xs text-amber-700">
        Run{" "}
        <code className="font-mono bg-amber-100 px-0.5 rounded">supabase db push</code>{" "}
        from the project root to apply all pending migrations, then reload this page.
      </p>
    </div>
  );
}

function FamilyBadge({ family }: { family: InterestProfileFamily | undefined }) {
  if (!family) return null;
  const cfg = FAMILY_CONFIG[family];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cfg.colour}`}>
      {cfg.label}
    </span>
  );
}

// ── Profile row ───────────────────────────────────────────────────────────────

function ProfileRow({ profile }: { profile: InterestProfile }) {
  const validTags  = profile.tags.filter((t) => t != null);
  const tagPreview = validTags.slice(0, 3);
  const overflow   = validTags.length - tagPreview.length;
  const isSuggested = profile.defaultStatus === "suggested";

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
      {/* Key + name + family */}
      <td className="px-4 py-3 max-w-xs">
        <Link href={`/admin/interest-profiles/${profile.id}`} className="group block">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-neutral-900 group-hover:text-brand-700 transition-colors">
              {profile.name}
            </p>
            <FamilyBadge family={profile.family} />
          </div>
          <code className="text-xs font-mono text-neutral-400">{profile.key}</code>
          {profile.description && (
            <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{profile.description}</p>
          )}
        </Link>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {isSuggested ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Suggested
          </span>
        ) : (
          <Badge variant={profile.isActive ? "success" : "default"} size="sm" dot>
            {profile.isActive ? "Active" : "Inactive"}
          </Badge>
        )}
      </td>

      {/* Tag preview */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {tagPreview.map((tag, i) => (
            <span
              key={`${tag.keyword ?? ""}-${i}`}
              className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
            >
              {tag.keyword}
              <span className="ml-1 text-neutral-400 font-normal">×{tag.weight}</span>
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-xs text-neutral-400">+{overflow} more</span>
          )}
          {validTags.length === 0 && (
            <span className="text-xs text-neutral-400">No tags</span>
          )}
        </div>
      </td>

      {/* Context variable */}
      <td className="px-4 py-3">
        <code className="text-xs font-mono text-neutral-700 block">{toScoreVar(profile.key)}</code>
        <span className="text-xs text-neutral-400">Scoring engine</span>
      </td>

      {/* Edit */}
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/interest-profiles/${profile.id}`}
          className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
        >
          Edit →
        </Link>
      </td>
    </tr>
  );
}

// ── Section heading row (inline inside table) ─────────────────────────────────

function FamilySectionRow({ label, count }: { label: string; count: number }) {
  return (
    <tr className="bg-neutral-50/80 border-b border-neutral-200">
      <th
        colSpan={5}
        className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
      >
        {label}: {count} profile{count !== 1 ? "s" : ""}
      </th>
    </tr>
  );
}

// ── Profile table ─────────────────────────────────────────────────────────────

function ProfileTable({
  profiles,
  groupByFamily = false,
}: {
  profiles:       InterestProfile[];
  groupByFamily?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Profile
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Status
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Keywords
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Score variable
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {groupByFamily ? (
            <>
              {FAMILY_ORDER.map((family) => {
                const group = profiles.filter((p) => p.family === family);
                if (group.length === 0) return null;
                const cfg = FAMILY_CONFIG[family];
                return (
                  <React.Fragment key={family}>
                    <FamilySectionRow label={cfg.label} count={group.length} />
                    {group.map((profile) => (
                      <ProfileRow key={profile.id} profile={profile} />
                    ))}
                  </React.Fragment>
                );
              })}
              {/* Fallback: profiles without a recognised family (e.g. legacy/custom) */}
              {(() => {
                const ungrouped = profiles.filter(
                  (p) => !p.family || !FAMILY_ORDER.includes(p.family),
                );
                if (ungrouped.length === 0) return null;
                return (
                  <React.Fragment key="__ungrouped__">
                    <FamilySectionRow label="Other" count={ungrouped.length} />
                    {ungrouped.map((profile) => (
                      <ProfileRow key={profile.id} profile={profile} />
                    ))}
                  </React.Fragment>
                );
              })()}
            </>
          ) : (
            profiles.map((profile) => (
              <ProfileRow key={profile.id} profile={profile} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function InterestProfilesPage() {
  const result       = await listAllInterestProfiles();
  const tableMissing = !result.ok && isTableMissingError(result.error);
  const profiles: InterestProfile[] = result.ok ? result.data : [];
  const error: string | null = result.ok || tableMissing ? null : result.error;

  // Split active vs suggested.
  const activeProfiles    = profiles.filter((p) => p.isActive);
  const suggestedProfiles = profiles.filter((p) => !p.isActive && p.defaultStatus === "suggested");
  const inactiveProfiles  = profiles.filter((p) => !p.isActive && p.defaultStatus !== "suggested");

  // Catalog mismatch: DB has fewer platform profiles than the canonical catalog.
  const platformProfileCount = profiles.filter((p) => !p.tenantId).length;
  const catalogMismatch      = !tableMissing && platformProfileCount < CATALOG_SIZE;

  // Family counts for the stats strip.
  const familyCounts = FAMILY_ORDER.map((f) => ({
    family: f,
    label:  FAMILY_CONFIG[f].label,
    count:  activeProfiles.filter((p) => p.family === f).length,
  })).filter((fc) => fc.count > 0);

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Text variant="h2">Interest profiles</Text>
          <p className="mt-1 text-sm text-neutral-500 max-w-xl">
            Platform-managed profiles that score visitor interest based on the keywords
            of pages they visit. Scores become context variables (
            <code className="font-mono text-xs text-neutral-600">interestPrimary</code>,{" "}
            <code className="font-mono text-xs text-neutral-600">interestSecondary</code>,{" "}
            <code className="font-mono text-xs text-neutral-600">interestConfidence</code>)
            available to rules and AI decisions.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <SeedCatalogButton highlight={catalogMismatch} />
          <Link
            href="/admin/interest-profiles/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <span>+</span>
            New profile
          </Link>
        </div>
      </div>

      {/* ── Banners ──────────────────────────────────────────────────────────── */}
      {tableMissing && <MigrationNeededBanner />}
      {error && (
        <div className="mb-6 rounded-lg border border-error-200 bg-error-50 px-4 py-3">
          <p className="text-sm font-medium text-error-700">Failed to load profiles</p>
          <p className="text-xs text-error-600 mt-0.5">{error}</p>
        </div>
      )}
      {catalogMismatch && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 space-y-2">
          <p className="font-semibold">
            Catalog out of sync: {platformProfileCount} of {CATALOG_SIZE} canonical profiles found
          </p>
          <p>
            The database is missing{" "}
            <strong>{CATALOG_SIZE - platformProfileCount} platform profile{CATALOG_SIZE - platformProfileCount !== 1 ? "s" : ""}</strong>.
            This is usually caused by a pending migration. Click{" "}
            <strong>Seed catalog</strong> above to restore all {CATALOG_SIZE} canonical profiles,
            or run{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">supabase db push</code>{" "}
            to apply migration 078.
          </p>
          <p className="text-xs text-amber-700">
            Seeding replaces all platform-wide profiles. Tenant-scoped profiles are never affected.
          </p>
        </div>
      )}

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      {profiles.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Active</p>
                <p className="mt-1 text-2xl font-bold text-success-600">{activeProfiles.length}</p>
                <p className="text-xs text-neutral-400">Evaluated at runtime</p>
              </div>
              {suggestedProfiles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Suggested</p>
                  <p className="mt-1 text-2xl font-bold text-amber-500">{suggestedProfiles.length}</p>
                  <p className="text-xs text-neutral-400">Enable per-tenant</p>
                </div>
              )}
              {inactiveProfiles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Inactive</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-400">{inactiveProfiles.length}</p>
                </div>
              )}
              {familyCounts.length > 0 && (
                <div className="border-l border-neutral-100 pl-8 flex gap-6">
                  {familyCounts.map(({ family, label, count }) => {
                    const cfg = FAMILY_CONFIG[family];
                    return (
                      <div key={family}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
                        <p className={`mt-1 text-xl font-bold ${cfg.colour.split(" ").find((c) => c.startsWith("text-"))}`}>
                          {count}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-l border-neutral-100 pl-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Context variables</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  <code className="text-xs font-mono text-neutral-600">interestPrimary</code>
                  <code className="text-xs font-mono text-neutral-600">interestSecondary</code>
                  <code className="text-xs font-mono text-neutral-600">interestConfidence</code>
                  <code className="text-xs font-mono text-neutral-400">interest&lt;Key&gt;Score</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {profiles.length === 0 && !error && !tableMissing ? (
        <EmptyState />
      ) : (
        <>
          {/* How-it-works callout */}
          <Card className="mb-6 border-brand-200 bg-brand-50">
            <CardContent>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1.5">
                How scoring works
              </p>
              <p className="text-sm text-brand-800 max-w-2xl">
                Add <code className="font-mono text-xs bg-brand-100 px-1 rounded">metaKeywords</code> to
                CMS pages. As a visitor browses, the platform accumulates a keyword cloud.
                On each request the cloud is scored against every <strong>active</strong> profile: 
                raw score = Σ(keyword frequency × tag weight). Scores are normalised to 0-1
                and exposed as context variables for rules and AI decisions.{" "}
                <strong>Suggested</strong> profiles are seeded inactive: enable them per-tenant
                by editing the profile and toggling Active.
              </p>
            </CardContent>
          </Card>

          {/* ── Active profiles — grouped by family ───────────────────────── */}
          {activeProfiles.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700">
                Active: {" "}
                <span className="font-normal text-neutral-500">
                  {activeProfiles.length} profile{activeProfiles.length !== 1 ? "s" : ""} evaluated at runtime
                </span>
              </h2>
              <ProfileTable profiles={activeProfiles} groupByFamily />
            </div>
          )}

          {/* ── Inactive (manually disabled, not "suggested") ─────────────── */}
          {inactiveProfiles.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700">
                Inactive: {" "}
                <span className="font-normal text-neutral-500">
                  {inactiveProfiles.length} profile{inactiveProfiles.length !== 1 ? "s" : ""} skipped by scoring engine
                </span>
              </h2>
              <ProfileTable profiles={inactiveProfiles} />
            </div>
          )}

          {/* ── Suggested profiles ────────────────────────────────────────── */}
          {suggestedProfiles.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold text-neutral-700">
                  Suggested: {" "}
                  <span className="font-normal text-neutral-500">
                    {suggestedProfiles.length} profile{suggestedProfiles.length !== 1 ? "s" : ""} available to enable per-tenant
                  </span>
                </h2>
              </div>
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs text-amber-800">
                  These profiles are seeded inactive. To use one, click Edit and toggle it Active.
                  It will then be evaluated for all tenants at runtime.
                  To limit it to specific tenants, consider creating a tenant-scoped copy instead.
                </p>
              </div>
              <ProfileTable profiles={suggestedProfiles} groupByFamily />
            </div>
          )}
        </>
      )}
    </div>
  );
}
