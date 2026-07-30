/**
 * Tenant Admin — Audience Segments
 *
 * Server component: loads segments + plan info, renders shell + banners.
 * All interactivity is delegated to SegmentsClient (client component).
 */

import { notFound }           from "next/navigation";
import { getTenantById }      from "@/tenant/server";
import { normalizeTenant }    from "@/tenant/normalize";
import { Text }               from "@/components/primitives/Text";
import { listAudienceSegmentsAction } from "./actions";
import { SegmentsClient }     from "./_components/SegmentsClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTableMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("schema cache")              ||
    lower.includes("could not find the table")  ||
    lower.includes("does not exist")            ||
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
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">audience_segments</code>{" "}
        table does not exist yet.
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

export default async function AudienceSegmentsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();
  const tenant = normalizeTenant(rawTenant);

  const segmentsResult = await listAudienceSegmentsAction(tenantId);

  const tableMissing = !segmentsResult.ok && isTableMissingError(segmentsResult.error ?? "");
  const error: string | null = segmentsResult.ok || tableMissing ? null : (segmentsResult.error ?? null);

  const segments = segmentsResult.ok ? segmentsResult.data : [];

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Audience segments</h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-xl">
            Define named visitor segments for{" "}
            <span className="font-medium text-neutral-700">{tenant.name ?? tenantId}</span>.{" "}
            Each segment evaluates a condition tree against the visitor context at request time.
            Matched segment keys become the{" "}
            <code className="font-mono text-xs bg-neutral-100 px-1 rounded">audienceSegmentIds</code>{" "}
            context variable available in rules and AI decisions.
          </p>
        </div>
      </div>

      {/* ── Banners ────────────────────────────────────────────────────────── */}
      {tableMissing && <MigrationNeededBanner />}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Failed to load segments</p>
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
        </div>
      )}

      {/* ── Body — delegated to client component ───────────────────────────── */}
      {!tableMissing && !error && (
        <SegmentsClient
          initialSegments={segments}
          tenantId={tenantId}
        />
      )}

    </div>
  );
}
