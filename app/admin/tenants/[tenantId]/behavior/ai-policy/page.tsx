/**
 * Admin — AI Policy (Unified AI Governance)
 *
 * Configures the operational mode and confidence threshold for both AI
 * sub-systems: Phase 1 (variant selection) and Phase 2 (content field fill).
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   For each AI phase:
 *     slot override → tenant policy (this page) → platform env vars → system defaults
 *
 *   Tenant settings here override the platform-wide defaults but are themselves
 *   overridable by per-slot config on individual variant packs.
 *
 * ─── Modes ────────────────────────────────────────────────────────────────────
 *
 *   disabled — AI is not called; original content is always served.
 *   shadow   — AI runs but its output is only logged, never applied to responses.
 *              Use shadow mode to observe AI decisions before enabling live mode.
 *   live     — AI output is served when confidence ≥ threshold; otherwise fallback.
 */

import { notFound }           from "next/navigation";
import { getTenantById }      from "@/tenant/server";
import { getAiPolicyAction }  from "./actions";
import { AiPolicyClient }     from "./_components/AiPolicyClient";

export const dynamic = "force-dynamic";

export default async function AiPolicyPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const savedSettings = await getAiPolicyAction(tenantId);

  // Read platform defaults from environment (server-side only)
  const platformDefaults = {
    selectionMode:      process.env.MC_AI_SELECTION_MODE,
    selectionThreshold: process.env.MC_AI_SELECTION_THRESHOLD,
    fieldFillMode:      process.env.MC_AI_FIELD_FILL_MODE,
    fieldFillThreshold: process.env.MC_AI_FIELD_FILL_THRESHOLD,
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">AI Policy</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Control the AI mode and confidence threshold for each AI sub-system.
          Changes apply immediately — shadow mode lets you observe AI decisions
          safely before enabling live serving.
        </p>
      </div>

      {/* Resolution order explainer */}
      <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-medium text-blue-800">
          Resolution order:{" "}
          <span className="font-normal">
            slot override → tenant policy (this page) → platform environment → system default.
            Tenant settings override platform defaults. Slot overrides (on individual variant packs)
            override tenant settings.
          </span>
        </p>
      </div>

      <AiPolicyClient
        tenantId={tenantId}
        initialSettings={savedSettings}
        platformDefaults={platformDefaults}
      />
    </div>
  );
}
