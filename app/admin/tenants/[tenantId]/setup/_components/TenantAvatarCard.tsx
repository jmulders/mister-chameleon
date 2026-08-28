"use client";

/**
 * TenantAvatarCard
 *
 * Self-service editor for the tenant avatar on /setup. Wraps the shared
 * AvatarPicker (upload / replace image, emoji + colour, or reset to initials)
 * and persists each change via saveTenantAvatarAction. Auto-saves on change so
 * there is no separate Save button to forget; a small status line reports the
 * outcome. English admin UI.
 */

import { useState, useTransition } from "react";
import { AvatarPicker } from "@/components/admin/AvatarPicker";
import type { AdminAvatarConfig } from "@/components/admin/avatar-util";
import { saveTenantAvatarAction } from "../../actions";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function TenantAvatarCard({
  tenantId, name, seed, initial,
}: {
  tenantId: string;
  /** Display name — drives the fallback initials. */
  name:     string;
  /** Stable seed — drives the deterministic fallback colour. */
  seed:     string;
  initial:  AdminAvatarConfig | null;
}) {
  const [value,  setValue]  = useState<AdminAvatarConfig | null>(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();

  function handleChange(next: AdminAvatarConfig | null) {
    setValue(next);
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const res = await saveTenantAvatarAction(tenantId, next);
      if (res.success) setStatus({ kind: "saved" });
      else             setStatus({ kind: "error", message: res.error });
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Avatar</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Shown next to your workspace in the admin. Upload an image, pick an emoji,
        or leave it empty to use your initials.
      </p>

      <AvatarPicker
        value={value}
        onChange={handleChange}
        name={name}
        seed={seed}
        tenantId={tenantId}
      />

      <div className="mt-3 h-4 text-xs" aria-live="polite">
        {status.kind === "saving" && <span className="text-neutral-400">Saving…</span>}
        {status.kind === "saved"  && <span className="text-emerald-600">Saved.</span>}
        {status.kind === "error"  && <span className="text-rose-600">Could not save: {status.message}</span>}
      </div>
    </div>
  );
}
