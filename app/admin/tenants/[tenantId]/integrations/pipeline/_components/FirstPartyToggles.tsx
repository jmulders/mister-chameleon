"use client";

/**
 * Per-tenant first-party company-DB ToS toggles.
 *
 * Two independent policy controls (separate from the reorderable pipeline
 * stages):
 *   • Consume (READ)     — may this tenant read the shared pool to skip a paid
 *                          Leadinfo call?
 *   • Contribute (WRITE) — may this tenant's Leadinfo results warm the shared
 *                          cross-tenant pool?
 *
 * Each is tri-state: Inherit (platform default) / On / Off.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveFirstPartyTogglesAction,
  type FirstPartyTogglesConfig,
  type FirstPartyToggleState,
} from "../actions";

const STATES: FirstPartyToggleState[] = ["inherit", "on", "off"];

function Segmented({
  value, onChange, platformDefault,
}: {
  value: FirstPartyToggleState;
  onChange: (s: FirstPartyToggleState) => void;
  platformDefault: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {STATES.map((s) => {
        const label =
          s === "inherit" ? `Inherit (${platformDefault ? "on" : "off"})` : s === "on" ? "On" : "Off";
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="rounded border px-3 py-1.5 text-sm font-medium"
            style={
              active
                ? { borderColor: "#4f46e5", background: "#eef2ff", color: "#4f46e5" }
                : { borderColor: "#d4d4d4", background: "#fff", color: "#404040" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FirstPartyToggles({ initial }: { initial: FirstPartyTogglesConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [consume, setConsume]       = useState<FirstPartyToggleState>(initial.consume);
  const [contribute, setContribute] = useState<FirstPartyToggleState>(initial.contribute);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = consume !== initial.consume || contribute !== initial.contribute;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await saveFirstPartyTogglesAction(initial.tenantId, consume, contribute);
      if (res.ok) {
        setStatus({ kind: "ok", text: "Saved." });
        router.refresh();
      } else {
        setStatus({ kind: "error", text: res.error ?? "Could not save." });
      }
    });
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-4">
      <h2 className="text-sm font-semibold text-neutral-900">First-party company DB</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Controls how this tenant participates in the shared, cross-tenant company pool. These are ToS controls,
        separate from the pipeline stages above.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-neutral-800">
            Consume (read) — skip paid Leadinfo calls on a shared-pool hit
          </div>
          <div className="text-xs text-neutral-500">
            Off means this tenant always runs its own paid Leadinfo lookup.
          </div>
          <Segmented value={consume} onChange={setConsume} platformDefault={initial.platformConsume} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-neutral-800">
            Contribute (write) — warm the shared pool with this tenant&apos;s Leadinfo results
          </div>
          <div className="text-xs text-neutral-500">
            Off keeps this tenant&apos;s Leadinfo-identified companies out of the shared pool. Open-data sources
            (OpenKvK/KvK) are unaffected.
          </div>
          <Segmented value={contribute} onChange={setContribute} platformDefault={initial.platformContribute} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {status && (
          <span className="text-xs" style={{ color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
