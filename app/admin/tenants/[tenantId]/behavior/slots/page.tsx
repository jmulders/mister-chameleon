/**
 * Admin — Adaptive Slot Modes
 *
 * Per-slot AI selection mode configuration for the three core content slots:
 * hero, proof, and CTA.
 *
 * ─── What this page controls ──────────────────────────────────────────────────
 *
 *   Each core slot can be configured with one of three modes:
 *
 *   AI-assisted  (default) — AI may select this slot when the global confidence
 *                            gates pass. Falls back to the rules plan key when AI
 *                            is unavailable or below threshold.
 *
 *   Rules only             — The rules plan key is always used for this slot.
 *                            The AI model is never consulted. Useful when a slot
 *                            should be 100% deterministic (e.g. during a campaign).
 *
 *   Static                 — A fixed operator-chosen variant key is always served
 *                            regardless of visitor context, rules, or AI decisions.
 *                            Useful for locked campaigns or QA testing.
 *
 * ─── Relationship to AI mode ─────────────────────────────────────────────────
 *
 *   The global AI mode (Settings → AI → mode) must be "shadow" or "live" for
 *   "ai-assisted" slots to have effect.  When AI is disabled globally, all
 *   slots fall through to the rules plan regardless of this configuration.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   When no settings are saved (new tenants or pre-Phase-1 tenants), all slots
 *   default to "ai-assisted" — identical to the previous behaviour.
 */

import { notFound }        from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { getSlotModesAction } from "./actions";
import { SlotModesClient } from "./_components/SlotModesClient";

export const dynamic = "force-dynamic";

export default async function SlotModesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const savedSettings = await getSlotModesAction(tenantId);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Adaptive Slot Modes</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Control how each core content slot selects its variant. AI-assisted slots
          let the AI choose when confidence is high. Rules-only slots always use
          the rules plan. Static slots serve a fixed key you specify.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-medium text-amber-800">
          Global AI mode:{" "}
          <span className="font-semibold">{tenant.ai?.mode ?? "disabled"}</span>
          {" — "}
          {tenant.ai?.mode === "disabled"
            ? "AI is disabled. All slots use the rules plan regardless of this setting."
            : tenant.ai?.mode === "shadow"
            ? "Shadow mode: AI decisions are logged but never served. AI-assisted slots will observe AI proposals in logs only."
            : "Live mode: AI may serve AI-assisted slots when confidence gates pass."}
        </p>
      </div>

      <SlotModesClient tenantId={tenantId} initialSettings={savedSettings} />
    </div>
  );
}
