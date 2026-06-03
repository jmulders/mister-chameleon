/**
 * Admin — Formulier Inzendingen
 *
 * Accessible at /admin/tenants/[tenantId]/forms/submissions.
 *
 * Server component — pre-fetches the first page of submissions and passes
 * everything to the SubmissionsClient for interactive filtering/pagination.
 */

export const runtime = "nodejs";

import { notFound }   from "next/navigation";
import Link           from "next/link";
import { getTenantById }   from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { listFormSubmissionsAction } from "./actions";
import { getTenantFormSettingsAction } from "@/app/admin/tenants/[tenantId]/forms/actions";
import { SubmissionsClient } from "./_components/SubmissionsClient";

export default async function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // ── Parallel data fetch ──────────────────────────────────────────────────────
  const [submissionsResult, settingsResult] = await Promise.all([
    listFormSubmissionsAction(tenantId, { page: 1 }),
    getTenantFormSettingsAction(tenantId),
  ]);

  const initialRows  = submissionsResult.ok ? submissionsResult.rows  : [];
  const initialTotal = submissionsResult.ok ? submissionsResult.total : 0;

  // Collect unique form keys from the first page for the filter dropdown.
  const formKeys = Array.from(new Set(initialRows.map((r) => r.form_key))).sort();

  const retentionDays = settingsResult.ok
    ? (settingsResult.settings.submissionRetentionDays ?? null)
    : null;

  return (
    <div className="p-8 max-w-5xl space-y-6">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link
          href={`/admin/tenants/${tenantId}/forms`}
          className="hover:text-white transition-colors"
        >
          Formulier instellingen
        </Link>
        <span>/</span>
        <span className="text-white">Inzendingen</span>
      </div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">Formulier inzendingen</h1>
        <p className="text-sm text-slate-400">
          Bekijk, zoek en exporteer inzendingen voor{" "}
          <span className="font-medium text-slate-200">
            {tenant.name ?? tenant.tenantId}
          </span>
          .{" "}
          {retentionDays
            ? `Inzendingen worden automatisch verwijderd na ${retentionDays} dagen (AVG-instelling).`
            : "Geen automatische verwijdering ingesteld."}
        </p>
      </div>

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {!submissionsResult.ok && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          Fout bij ophalen inzendingen: {submissionsResult.error}
        </div>
      )}

      {/* ── Submissions client ────────────────────────────────────────────── */}
      <SubmissionsClient
        initialRows={initialRows}
        initialTotal={initialTotal}
        tenantId={tenantId}
        formKeys={formKeys}
      />
    </div>
  );
}
