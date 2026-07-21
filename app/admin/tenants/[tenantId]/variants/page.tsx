/**
 * Admin — Tenant Workspace › Content › Variants
 *
 * Two complementary views of how variant keys are distributed across pages:
 *
 *   1. Page → Variants table
 *      Rows are pages; columns show which variant key is assigned to each
 *      context slot (Hero / Proof / CTA).  Empty cells mean no context slot
 *      is configured for that page.
 *
 *   2. Variant → Pages reverse-lookup
 *      For each variant key in the catalogue, shows which pages use it as a
 *      fallback key for at least one slot.  Dead keys (no pages) are still
 *      shown so operators can spot unused catalogue entries.
 *
 * ─── Data sources ─────────────────────────────────────────────────────────────
 *
 *   fetchPagesWithVariants(tenantId)
 *     → Sanity: live query for pages with contextConfig (preferred)
 *     → Platform DB: getPagesByTenant() fallback (Storyblok / Statamic)
 *
 *   fetchVariantCatalogue(tenantId)
 *     → Platform-defined variant keys + CMS-defined keys merged and deduplicated
 *
 * ─── Refresh ──────────────────────────────────────────────────────────────────
 *
 *   The page is a Server Component.  The RefreshButton at the top triggers
 *   router.refresh() which re-runs all server-side data fetching without a
 *   full navigation.  Useful after re-seeding pages in Sanity Studio.
 *
 * ─── Works for all three CMS providers ───────────────────────────────────────
 *
 *   • Sanity    — live query from Sanity dataset
 *   • Storyblok — platform DB (pages synced at provision time)
 *   • Statamic  — platform DB (pages synced at provision time)
 */

import { notFound }           from "next/navigation";
import { getTenantById }      from "@/tenant/server";
import { normalizeTenant }    from "@/tenant/normalize";
import { Text }               from "@/components/primitives/Text";
import { fetchVariantCatalogue }    from "@/decision/rules/fetch-variant-catalogue";
import { fetchPagesWithVariants }   from "@/decision/rules/fetch-pages-with-variants";
import type { PageVariantInfo }     from "@/decision/rules/fetch-pages-with-variants";
import type { VariantCatalogue, VariantEntry } from "@/decision/rules/variant-catalogue";
import { RefreshButton }      from "../rules/_components/RefreshButton";
import { cn }                 from "@/lib/utils";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VariantsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();
  const tenant = normalizeTenant(rawTenant);

  const [pages, catalogue] = await Promise.all([
    fetchPagesWithVariants(tenantId, tenant.cms.provider),
    fetchVariantCatalogue(tenantId),
  ]);

  // Derive data source for the header note.
  const dataSource = pages[0]?.source ?? "db";

  return (
    <div className="p-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-neutral-900">Variant Assignments</h1>
          <RefreshButton label="Refresh" />
        </div>
        <p className="text-sm text-neutral-500">
          Which CMS fallback variant key is assigned to each context slot for
          every published page of{" "}
          <span className="font-medium text-neutral-700">
            {tenant.name ?? tenant.tenantId}
          </span>.
          {dataSource === "sanity" && (
            <span className="ml-1 text-violet-600">
              Live from Sanity.
            </span>
          )}
          {dataSource === "db" && (
            <span className="ml-1 text-neutral-400">
              Reflects platform DB — re-provision to sync latest CMS changes.
            </span>
          )}
        </p>
      </div>

      {pages.length === 0 ? (
        <EmptyState tenantId={tenantId} />
      ) : (
        <div className="flex flex-col gap-10">
          {/* View 1: Page → Variant assignments */}
          <PageVariantTable pages={pages} />

          {/* View 2: Variant → Pages reverse lookup */}
          <VariantToPageMap pages={pages} catalogue={catalogue} />
        </div>
      )}
    </div>
  );
}

// ── View 1: Page → Variant table ──────────────────────────────────────────────

function PageVariantTable({ pages }: { pages: PageVariantInfo[] }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-neutral-900">Page → Slot assignments</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          The fallback variant key each page uses per context slot. The decision engine
          may override these keys at runtime based on visitor signals.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 min-w-[180px]">
                Page
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 min-w-[80px]">
                Slug
              </th>
              <SlotHeader label="Hero"       color="text-violet-700 bg-violet-50 border-violet-200" />
              <SlotHeader label="Proof"      color="text-blue-700 bg-blue-50 border-blue-200" />
              <SlotHeader label="CTA"        color="text-emerald-700 bg-emerald-50 border-emerald-200" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page, idx) => (
              <tr
                key={page.id}
                className={cn(
                  "border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-neutral-50/30",
                )}
              >
                <td className="px-4 py-2">
                  <span className="font-medium text-neutral-800 truncate block max-w-[260px]">
                    {page.title}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <code className="rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600 font-mono">
                    /{page.slug}
                  </code>
                </td>
                <VariantCell value={page.hero}  color="bg-violet-50 text-violet-800 border-violet-200" />
                <VariantCell value={page.proof} color="bg-blue-50 text-blue-800 border-blue-200" />
                <VariantCell value={page.cta}   color="bg-emerald-50 text-emerald-800 border-emerald-200" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-400">
        {pages.length} page{pages.length !== 1 ? "s" : ""} — empty cells indicate the slot is not configured for that page.
      </p>
    </section>
  );
}

function SlotHeader({ label, color }: { label: string; color: string }) {
  return (
    <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 min-w-[160px]">
      <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold", color)}>
        {label}
      </span>
    </th>
  );
}

function VariantCell({ value, color }: { value: string | null; color: string }) {
  if (!value) {
    return (
      <td className="px-4 py-2 text-center">
        <span className="text-neutral-300 text-xs">—</span>
      </td>
    );
  }
  const short = value.replace(/^(hero|proof|cta|feature|conversion)_/, "");
  return (
    <td className="px-4 py-2">
      <span
        className={cn("inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium font-mono leading-tight whitespace-nowrap", color)}
        title={value}
      >
        {short}
      </span>
    </td>
  );
}

// ── View 2: Variant → Pages reverse lookup ────────────────────────────────────

type SlotName = "hero" | "proof" | "cta";

interface VariantPageUsage {
  entry:    VariantEntry;
  slot:     SlotName;
  pages:    { id: string; slug: string; title: string }[];
}

function buildReverseMap(
  pages:     PageVariantInfo[],
  catalogue: VariantCatalogue,
): VariantPageUsage[] {
  const slots: { slot: SlotName; entries: VariantEntry[] }[] = [
    { slot: "hero",  entries: catalogue.hero },
    { slot: "proof", entries: catalogue.proof },
    { slot: "cta",   entries: catalogue.cta },
  ];

  const result: VariantPageUsage[] = [];

  for (const { slot, entries } of slots) {
    for (const entry of entries) {
      const matchingPages = pages
        .filter((p) => p[slot] === entry.key)
        .map((p) => ({ id: p.id, slug: p.slug, title: p.title }));

      result.push({ entry, slot, pages: matchingPages });
    }
  }

  // Sort: most used first; within same count, alphabetical by key.
  result.sort((a, b) => {
    if (b.pages.length !== a.pages.length) return b.pages.length - a.pages.length;
    return a.entry.key.localeCompare(b.entry.key);
  });

  return result;
}

const SLOT_COLORS: Record<SlotName, string> = {
  hero:  "bg-violet-50 text-violet-700 border-violet-200",
  proof: "bg-blue-50 text-blue-700 border-blue-200",
  cta:   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SOURCE_BADGES: Record<string, string> = {
  platform:    "bg-neutral-50 text-neutral-500 border-neutral-200",
  "cms-tenant": "bg-violet-50 text-violet-600 border-violet-200",
  "cms-shared": "bg-sky-50 text-sky-600 border-sky-200",
};

function VariantToPageMap({
  pages,
  catalogue,
}: {
  pages:     PageVariantInfo[];
  catalogue: VariantCatalogue;
}) {
  const usages = buildReverseMap(pages, catalogue);
  const dead   = usages.filter((u) => u.pages.length === 0);
  const active = usages.filter((u) => u.pages.length > 0);

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-neutral-900">Variant → Pages</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          Which pages use each variant key as a fallback. Variants with no pages
          are dead content — safe to archive or remove from the CMS.
        </p>
      </div>

      {/* Active variants */}
      {active.length > 0 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 min-w-[200px]">Variant key</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 w-24">Slot</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 w-24 hidden sm:table-cell">Source</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500">Pages</th>
              </tr>
            </thead>
            <tbody>
              {active.map((u, idx) => (
                <tr
                  key={`${u.slot}-${u.entry.key}`}
                  className={cn(
                    "border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors",
                    idx % 2 === 0 ? "bg-white" : "bg-neutral-50/30",
                  )}
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-0.5">
                      <code className="font-mono text-[11px] text-neutral-700">{u.entry.key}</code>
                      {u.entry.label !== u.entry.key && (
                        <span className="text-[10px] text-neutral-400">{u.entry.label}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold", SLOT_COLORS[u.slot])}>
                      {u.slot.charAt(0).toUpperCase() + u.slot.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", SOURCE_BADGES[u.entry.source] ?? SOURCE_BADGES.platform)}>
                      {u.entry.source === "platform" ? "platform" : u.entry.source === "cms-tenant" ? "cms · tenant" : "cms · shared"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.pages.map((p) => (
                        <code
                          key={p.id}
                          className="inline-block rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[10px] font-mono text-neutral-600"
                          title={p.title}
                        >
                          /{p.slug}
                        </code>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dead variants — collapsed section */}
      {dead.length > 0 && (
        <DeadVariantsSection dead={dead} />
      )}
    </section>
  );
}

// ── Dead variants section ─────────────────────────────────────────────────────

/**
 * Collapsed "dead variants" section rendered as a server component.
 * Uses a <details> / <summary> element so it works without JS.
 */
function DeadVariantsSection({ dead }: { dead: VariantPageUsage[] }) {
  return (
    <details className="group rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-medium text-neutral-500 select-none hover:bg-neutral-100 transition-colors list-none">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-[10px] font-semibold text-neutral-500">
            {dead.length}
          </span>
          <span>Dead variants — no pages reference these keys</span>
        </div>
        {/* Chevron: rotates when open via group-open */}
        <svg
          className="size-3.5 text-neutral-400 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {dead.map((u) => (
            <div
              key={`${u.slot}-${u.entry.key}`}
              className="flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1"
            >
              <span className={cn("inline-block rounded border px-1 py-0 text-[9px] font-semibold", SLOT_COLORS[u.slot])}>
                {u.slot}
              </span>
              <code className="font-mono text-[10px] text-neutral-500">{u.entry.key}</code>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-neutral-400">
          These variants exist in the catalogue but are not assigned as a fallback on any published page.
          They may still be served if the decision engine resolves them via rules — check the{" "}
          <a href="../rules" className="text-indigo-600 hover:underline">Rules page</a>.
        </p>
      </div>
    </details>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tenantId }: { tenantId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-600">No published pages found</p>
      <p className="mt-1 text-xs text-neutral-400">
        Provision the CMS or seed pages for{" "}
        <strong>{tenantId}</strong> first, then return here to see variant assignments.
      </p>
    </div>
  );
}
