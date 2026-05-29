"use client";

/**
 * PipelineStageEditor
 *
 * Client component that renders the enrichment pipeline stage list with:
 *   • Enable / disable toggles per stage
 *   • ↑ / ↓ reorder buttons (within each wave group only)
 *   • Save / Reset buttons with optimistic state
 *
 * Grouped visually by wave:
 *   Wave 1  — MaxMind, IPinfo, GA4  (run in parallel)
 *   Wave 2  — Reverse Geocode, Weather, OpenKvK, Leadinfo  (run in parallel)
 *   Sequential — HubSpot CRM, Seasonal Events  (run after all waves)
 *
 * Reordering is restricted to within each wave group — cross-wave ordering
 * is fixed by dependency constraints.
 */

import { useState, useTransition }   from "react";
import { cn }                         from "@/lib/utils";
import type { PipelineConfig, PipelineStageRow } from "../actions";
import {
  savePipelineConfigAction,
  resetPipelineConfigAction,
} from "../actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PipelineStageEditorProps {
  tenantId:      string;
  initialConfig: PipelineConfig;
}

type Wave = 1 | 2 | "sequential";

interface WaveGroup {
  wave:        Wave;
  label:       string;
  description: string;
  stages:      PipelineStageRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WAVE_LABELS: Record<string, string> = {
  "1":          "Wave 1 — Parallel",
  "2":          "Wave 2 — Parallel",
  "sequential": "Sequential",
};

const WAVE_DESCRIPTIONS: Record<string, string> = {
  "1":          "These stages run concurrently after IP classification. They only read the request IP or visitor ID — no inter-dependencies.",
  "2":          "These stages run concurrently after Wave 1 completes. They can read geo and network data from Wave 1.",
  "sequential": "These stages run one at a time after all wave groups complete. They can read the full accumulated enrichment output.",
};

function groupByWave(stages: PipelineStageRow[]): WaveGroup[] {
  const order: Wave[] = [1, 2, "sequential"];
  return order.map((wave) => ({
    wave,
    label:       WAVE_LABELS[String(wave)],
    description: WAVE_DESCRIPTIONS[String(wave)],
    stages:      stages
      .filter((s) => String(s.meta.wave) === String(wave))
      .sort((a, b) => a.position - b.position),
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineStageEditor({
  tenantId,
  initialConfig,
}: PipelineStageEditorProps) {
  const [stages, setStages] = useState<PipelineStageRow[]>(
    initialConfig.stages,
  );
  const [isDirty, setDirty]     = useState(false);
  const [status, setStatus]     = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const waveGroups = groupByWave(stages);

  // ── Toggle enable/disable ─────────────────────────────────────────────────

  function toggleStage(stageKey: string) {
    setStages((prev) =>
      prev.map((s) =>
        s.stageKey === stageKey ? { ...s, enabled: !s.enabled } : s,
      ),
    );
    setDirty(true);
    setStatus("idle");
  }

  // ── Reorder within wave ───────────────────────────────────────────────────

  function moveStage(stageKey: string, direction: "up" | "down") {
    setStages((prev) => {
      const stage = prev.find((s) => s.stageKey === stageKey);
      if (!stage) return prev;

      // Get all stages in the same wave, sorted by position
      const sameWave = prev
        .filter((s) => String(s.meta.wave) === String(stage.meta.wave))
        .sort((a, b) => a.position - b.position);

      const idx = sameWave.findIndex((s) => s.stageKey === stageKey);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;

      if (swapIdx < 0 || swapIdx >= sameWave.length) return prev;

      // Swap positions
      const swapTarget = sameWave[swapIdx];
      const newStages = prev.map((s) => {
        if (s.stageKey === stageKey) {
          return { ...s, position: swapTarget.position };
        }
        if (s.stageKey === swapTarget.stageKey) {
          return { ...s, position: stage.position };
        }
        return s;
      });

      // Re-normalise positions to be sequential (1, 2, 3…) within each wave
      const waveGroups2 = new Map<string, PipelineStageRow[]>();
      for (const s of newStages) {
        const key = String(s.meta.wave);
        if (!waveGroups2.has(key)) waveGroups2.set(key, []);
        waveGroups2.get(key)!.push(s);
      }

      const normalised: PipelineStageRow[] = [];
      for (const group of waveGroups2.values()) {
        group.sort((a, b) => a.position - b.position);
        group.forEach((s, i) => normalised.push({ ...s, position: i + 1 }));
      }

      return normalised;
    });
    setDirty(true);
    setStatus("idle");
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const result = await savePipelineConfigAction(
        tenantId,
        stages.map((s) => ({
          stageKey: s.stageKey,
          position: s.position,
          enabled:  s.enabled,
        })),
      );
      if (result.ok) {
        setDirty(false);
        setStatus("saved");
        setErrorMsg(null);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Save failed.");
      }
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function handleReset() {
    if (!confirm("Reset pipeline config to platform defaults for this tenant?")) return;
    startTransition(async () => {
      const result = await resetPipelineConfigAction(tenantId);
      if (result.ok) {
        // Page will revalidate — reload to get fresh server data
        window.location.reload();
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Reset failed.");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Wave groups */}
      {waveGroups.map((group) => (
        <div key={String(group.wave)}>
          {/* Wave header */}
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  group.wave === 1
                    ? "bg-blue-100 text-blue-700"
                    : group.wave === 2
                    ? "bg-violet-100 text-violet-700"
                    : "bg-neutral-100 text-neutral-600",
                )}
              >
                {group.label}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              {group.description}
            </p>
          </div>

          {/* Stage cards */}
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {group.stages.map((stage, idx) => {
              const isFirst = idx === 0;
              const isLast  = idx === group.stages.length - 1;

              return (
                <div
                  key={stage.stageKey}
                  className={cn(
                    "flex items-start gap-4 px-4 py-3.5 transition-colors",
                    stage.enabled ? "bg-white" : "bg-neutral-50",
                  )}
                >
                  {/* Icon + label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none" aria-hidden="true">
                        {stage.meta.icon}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          stage.enabled ? "text-neutral-900" : "text-neutral-400",
                        )}
                      >
                        {stage.meta.label}
                      </span>
                      {stage.meta.requiresCredentials && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          Requires credentials
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-xs leading-relaxed",
                        stage.enabled ? "text-neutral-500" : "text-neutral-400",
                      )}
                    >
                      {stage.meta.description}
                    </p>
                    {stage.enabled && (
                      <p className="mt-1 text-[11px] font-mono text-neutral-400">
                        → {stage.meta.outputSummary}
                      </p>
                    )}
                    {stage.meta.dependsOn.length > 0 && stage.enabled && (
                      <p className="mt-1 text-[11px] text-neutral-400">
                        Depends on:{" "}
                        {stage.meta.dependsOn.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                    {/* Reorder arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveStage(stage.stageKey, "up")}
                        disabled={isFirst || isPending}
                        aria-label={`Move ${stage.meta.label} up`}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors",
                          isFirst && "invisible",
                        )}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStage(stage.stageKey, "down")}
                        disabled={isLast || isPending}
                        aria-label={`Move ${stage.meta.label} down`}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors",
                          isLast && "invisible",
                        )}
                      >
                        ↓
                      </button>
                    </div>

                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stage.enabled}
                      onClick={() => toggleStage(stage.stageKey)}
                      disabled={isPending}
                      className={cn(
                        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                        stage.enabled ? "bg-brand-600" : "bg-neutral-200",
                      )}
                    >
                      <span className="sr-only">
                        {stage.enabled ? "Disable" : "Enable"} {stage.meta.label}
                      </span>
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          stage.enabled ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer: always-on stages info */}
      <div className="rounded-md border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        <p className="font-medium text-neutral-600 mb-1">Always-on stages (not configurable)</p>
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1">
            <span>🔢</span>
            <span>IP Classification — classifies IPv4 vs IPv6</span>
          </span>
          <span className="flex items-center gap-1">
            <span>☁️</span>
            <span>Cloud Detection — flags datacenter / CDN IPs</span>
          </span>
        </div>
      </div>

      {/* Save / Reset bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="text-sm">
          {isPending && (
            <span className="text-neutral-500">Saving…</span>
          )}
          {!isPending && status === "saved" && (
            <span className="text-green-600 font-medium">✓ Pipeline config saved</span>
          )}
          {!isPending && status === "error" && (
            <span className="text-red-600">{errorMsg ?? "Save failed."}</span>
          )}
          {!isPending && status === "idle" && isDirty && (
            <span className="text-amber-600">You have unsaved changes</span>
          )}
          {!isPending && status === "idle" && !isDirty && (
            <span className="text-neutral-400">No changes</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isPending}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isDirty && !isPending
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
            )}
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
