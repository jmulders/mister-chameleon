/**
 * Admin — AI Field Fill
 *
 * Per-field AI content fill configuration for the three core content slots:
 * hero, proof, and CTA.
 *
 * ─── What this page controls ──────────────────────────────────────────────────
 *
 *   When enabled for a slot, AI may rewrite individual text fields within the
 *   CMS-fetched variant block.  The variant KEY is never changed — only the
 *   text content within it.
 *
 *   Each field can have:
 *     • aiEnabled — whether AI may rewrite this field
 *     • maxWords  — word count ceiling for AI output
 *     • maxChars  — character count ceiling for AI output (applied after maxWords)
 *     • style     — tone/style guidance injected into the AI prompt
 *
 * ─── Relationship to Phase 1 (Slot Modes) ────────────────────────────────────
 *
 *   Phase 1 (Settings → Slots) controls WHICH variant is selected.
 *   Phase 2 (this page) controls WHAT TEXT is shown within that variant.
 *
 *   Both phases are independently configurable and operate in the same pipeline:
 *   Decision Engine (Phase 1) → CMS Fetch → AI Field Fill (Phase 2) → Render.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Any failure in the field fill pipeline silently returns the original CMS
 *   content for that slot.  The page always renders — field fill is best-effort.
 */

import { notFound }           from "next/navigation";
import { getTenantById }      from "@/tenant/server";
import { getFieldFillAction } from "./actions";
import { FieldFillClient }    from "./_components/FieldFillClient";

export const dynamic = "force-dynamic";

export default async function FieldFillPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const savedSettings = await getFieldFillAction(tenantId);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">AI Field Fill</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Allow AI to rewrite individual text fields within a selected variant to better
          resonate with the current visitor. The variant layout and key are never changed,
          only the copy within it.
        </p>
      </div>

      {/* Phase relationship banner */}
      <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-medium text-blue-800">
          This is Phase 2, content personalisation.{" "}
          <span className="font-normal">
            Phase 1 (slot mode selection) controls which variant is shown.
            Phase 2 controls what text appears within that variant.
          </span>
        </p>
      </div>

      {/* Global AI mode warning */}
      {(!tenant.ai?.mode || tenant.ai.mode === "disabled") && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Global AI mode:{" "}
            <span className="font-semibold">disabled</span>
            {" — "}
            AI is disabled. Field fill settings are saved but will have no effect until
            AI is enabled in Settings → AI.
          </p>
        </div>
      )}

      <FieldFillClient tenantId={tenantId} initialSettings={savedSettings} />
    </div>
  );
}
