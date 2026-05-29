/**
 * Experiments Dashboard Page — Step A4 (read/create/edit)
 *
 * Server component. Loads all experiments from Supabase, then renders:
 *
 *   1. PageHeader          — count + tenant context + refresh link (server JSX)
 *   2. CreateExperimentForm — collapsible create form (client component)
 *   3. Slot-conflict banner — when two active experiments share a slot
 *   4. ExperimentsTable    — read-only table with inline edit per row (client)
 *   5. EmptyState          — shown when there are no experiments yet
 *
 * Both client components call router.refresh() after a successful mutation,
 * which re-runs this server component and passes fresh data back as props.
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *
 *   Resolves the active tenant using the same order as the frontend site so the
 *   displayed tenant is always consistent. The experiments table is not yet
 *   tenant-scoped (all experiments are shown regardless of tenant), but the
 *   resolved tenant is shown in the header and a dev override banner is rendered
 *   when a ?tenant= or mc_dev_tenant override is active.
 */

import type { Metadata }          from "next";
import Link                       from "next/link";
import type { ExperimentRow }     from "@/data/types";
import { listAllExperiments }     from "@/data/repositories/experiments-repository";
import { getActiveTenantWithDevOverride } from "@/tenant/server";
import { fetchVariantCatalogue }  from "@/decision/rules/fetch-variant-catalogue";
import { CreateExperimentForm }   from "@/components/dashboard/CreateExperimentForm";
import { ExperimentsTable }       from "@/components/dashboard/ExperimentsTable";

export const metadata: Metadata = { title: "Experiments · Dashboard" };

// ── Page props ─────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ExperimentsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const { tenantConfig, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "dashboard/experiments");

  // Fetch experiments + variant catalogue in parallel.
  // Catalogue is scoped to the active tenant so CMS variants are included.
  const [result, variantCatalogue] = await Promise.all([
    listAllExperiments(),
    fetchVariantCatalogue(tenantConfig.tenantId),
  ]);

  if (!result.ok) {
    return (
      <div className="px-8 py-8">
        <PageHeader
          count={null}
          tenantConfig={tenantConfig}
          devTenantOverride={devTenantOverride}
        />
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p className="font-semibold">Failed to load experiments</p>
          <p className="mt-1 text-red-700">{result.error}</p>
          <p className="mt-2 text-xs text-red-600">
            Check that the Supabase connection is configured and the{" "}
            <code className="font-mono">experiments</code> table exists.
          </p>
        </div>
      </div>
    );
  }

  const experiments = result.data;

  // Slot-conflict detection — two active experiments on the same slot
  const activeBySlot = new Map<string, ExperimentRow[]>();
  for (const exp of experiments) {
    if (exp.status === "active") {
      const bucket = activeBySlot.get(exp.slot) ?? [];
      bucket.push(exp);
      activeBySlot.set(exp.slot, bucket);
    }
  }
  const conflicts = [...activeBySlot.entries()].filter(([, rows]) => rows.length > 1);

  return (
    <div className="flex flex-col gap-6 px-8 py-8">
      <PageHeader
        count={experiments.length}
        tenantConfig={tenantConfig}
        devTenantOverride={devTenantOverride}
      />

      {devTenantOverride && (
        <DevOverrideBanner
          tenantId={devTenantOverride}
          source={devOverrideSource}
          page="experiments"
        />
      )}

      {/* Create form */}
      <CreateExperimentForm variantCatalogue={variantCatalogue} />

      {/* Slot conflict warning */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Slot conflict detected</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-700">
            {conflicts.map(([slot, rows]) => (
              <li key={slot}>
                Slot{" "}
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold mx-0.5 ${SLOT_INLINE_CLS[slot as ExperimentRow["slot"]]}`}>
                  {slot}
                </span>{" "}
                has {rows.length} active experiments.{" "}
                {rows
                  .map((r) => (
                    <code key={r.id} className="font-mono text-xs">{r.id}</code>
                  ))
                  .reduce<React.ReactNode[]>(
                    (acc, el, i) => (i === 0 ? [el] : [...acc, ", ", el]),
                    [],
                  )}{" "}
                — only the first (by creation date) will be served.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table or empty state */}
      {experiments.length === 0 ? (
        <EmptyState />
      ) : (
        <ExperimentsTable experiments={experiments} />
      )}
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader({
  count,
  tenantConfig,
  devTenantOverride,
}: {
  count:             number | null;
  tenantConfig:      { tenantId: string; name: string };
  devTenantOverride: string | null;
}) {
  const subtitle =
    count === null
      ? "A/B experiment catalogue"
      : count === 0
        ? "No experiments yet"
        : `${count} experiment${count === 1 ? "" : "s"} total`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">Experiments</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span>{subtitle}</span>
          <span className="text-neutral-300">·</span>
          <span>
            Tenant:{" "}
            <span className="font-medium text-neutral-700">{tenantConfig.name}</span>
          </span>
          <span className="font-mono text-xs text-neutral-400">
            ({tenantConfig.tenantId})
          </span>
          {devTenantOverride && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-700">
              dev override
            </span>
          )}
        </div>
      </div>

      <Link
        href="/dashboard/experiments"
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
      >
        <svg
          className="size-3.5 text-neutral-500"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" strokeLinecap="round" />
          <path d="M10.5 4.5 13.5 4.7 13.3 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Refresh
      </Link>
    </div>
  );
}

// ── DevOverrideBanner ─────────────────────────────────────────────────────────

function DevOverrideBanner({
  tenantId,
  source,
  page,
}: {
  tenantId: string;
  source:   "query-param" | "cookie" | null;
  page:     string;
}) {
  const sourceLabel =
    source === "query-param"
      ? <><code className="font-mono">?tenant=</code> query param</>
      : source === "cookie"
        ? <><code className="font-mono">mc_dev_tenant</code> cookie</>
        : "dev override";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Dev override active.</strong> Active tenant is{" "}
      <code className="font-mono font-semibold">{tenantId}</code> via{" "}
      {sourceLabel}.{" "}
      This override is ignored in production.{" "}
      <span className="text-amber-600">
        Bookmark:{" "}
        <code className="font-mono text-xs">
          /dashboard/{page}?tenant={tenantId}
        </code>
      </span>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-8 py-16 text-center">
      <svg
        className="size-10 text-neutral-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          d="M9 3v8.5L4.5 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-3l-4.5-6.5V3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6 3h12" strokeLinecap="round" />
        <circle cx="9"  cy="14" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="14" cy="16" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <p className="mt-4 text-sm font-medium text-neutral-700">No experiments yet</p>
      <p className="mt-1 max-w-xs text-xs text-neutral-500">
        Use the form above to create your first experiment, or add rows directly
        in the <code className="font-mono">experiments</code> table in Supabase.
      </p>
    </div>
  );
}

// ── Inline slot pill classes (for the server-rendered conflict banner) ─────────

const SLOT_INLINE_CLS: Record<ExperimentRow["slot"], string> = {
  hero:  "bg-violet-50 text-violet-700 border-violet-200",
  proof: "bg-sky-50    text-sky-700    border-sky-200",
  cta:   "bg-amber-50  text-amber-700  border-amber-200",
};
