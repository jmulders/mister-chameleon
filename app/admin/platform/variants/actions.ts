"use server";

import {
  savePlatformContentBudgetSettings,
  type PlatformContentBudgetSettings,
} from "@/platform/platform-store";

// ── Save content budget ────────────────────────────────────────────────────────

export type SaveBudgetResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveBudgetAction(
  input: PlatformContentBudgetSettings,
): Promise<SaveBudgetResult> {
  const result = await savePlatformContentBudgetSettings(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
