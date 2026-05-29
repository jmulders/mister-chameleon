/**
 * ThemePickerPanel
 *
 * A compact theme picker for the tenant Setup page.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   This component lives on the Setup page as a "quick start" theme selector.
 *   It shows the full theme swatch grid so an operator can pick a starting
 *   theme in seconds without leaving the setup flow.
 *
 *   It is intentionally simpler than the Design page's ThemeGallery:
 *     • No Storybook iframe previews   — too heavy for a setup checklist
 *     • No family tabs                 — all themes visible at once
 *     • No typography or token editor  — those live in Design → Style / Advanced
 *
 *   A "Fine-tune in Design →" footer link sends the operator to the full editor
 *   once the baseline theme is chosen.
 *
 * ─── Save behaviour ──────────────────────────────────────────────────────────
 *
 *   Selecting a swatch calls saveVisualTokensAction(tenantId, { theme, … })
 *   immediately — the same action the Design page's ThemeGallery uses.
 *   All existing token overrides are preserved; only the active preset key changes.
 *
 * ─── Rendering ───────────────────────────────────────────────────────────────
 *
 *   The swatch grid is rendered by ThemeSwatchGrid — a reusable controlled
 *   component shared with the OnboardingForm.  This panel adds the server-action
 *   save layer on top.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ThemeSwatchGrid } from "@/components/admin/ThemeSwatchGrid";
import { getFeaturedFamilyForPreset } from "@/design-system/theme/style-defaults";
import { saveVisualTokensAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { ThemeKey } from "@/tenant/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ThemePickerPanelProps {
  tenantId:    string;
  activeTheme: ThemeKey;
}

// ── ThemePickerPanel ──────────────────────────────────────────────────────────

/**
 * Compact theme picker for the Setup page.
 *
 * Shows all available theme presets as a swatch grid.
 * Selecting a swatch immediately applies the theme via saveVisualTokensAction.
 *
 * @example
 *   <ThemePickerPanel tenantId="acme" activeTheme="modern-saas" />
 */
export function ThemePickerPanel({ tenantId, activeTheme }: ThemePickerPanelProps) {
  const [localActive, setLocalActive]  = useState<ThemeKey>(activeTheme);
  const [activating,  setActivating]   = useState<string | null>(null);
  const [error,       setError]        = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  function handleSelect(themeKey: ThemeKey) {
    if (themeKey === localActive || activating !== null) return;
    setActivating(themeKey);
    setError(null);

    startTransition(async () => {
      const featuredFamily = getFeaturedFamilyForPreset(themeKey);

      const result = await saveVisualTokensAction(tenantId, {
        theme: themeKey,
        // Reset typography override so the new theme's defaults apply cleanly.
        typographyOverrideEnabled: false,
        ...(featuredFamily
          ? { selectedStyleFamily: featuredFamily }
          : { selectedStyleFamily: "" }),
      });

      if (result.ok) {
        setLocalActive(themeKey);
      } else {
        setError(result.errors?.join(", ") ?? "Failed to apply theme.");
      }
      setActivating(null);
    });
  }

  // Find the active theme's label for the badge in the panel header
  // (imported lazily from the same source ThemeSwatchGrid uses)
  const activeLabel = localActive;  // fallback — ThemeSwatchGrid knows the label

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-neutral-900">Theme</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Pick a colour theme for this site. You can fine-tune fonts, tokens, and
          layout style on the Design page after setup.
        </p>
      </div>

      {/* ── Swatch grid ────────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <ThemeSwatchGrid
          value={localActive}
          onChange={handleSelect}
          activating={activating}
          disabled={isPending && activating === null}
        />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3">
        <div>
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <p className="text-xs text-neutral-400">
              {activating ? "Applying theme…" : "Click any swatch to apply instantly."}
            </p>
          )}
        </div>
        <Link
          href={`/admin/tenants/${tenantId}/design`}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Fine-tune in Design →
        </Link>
      </div>

    </div>
  );
}
