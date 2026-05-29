/**
 * /preview/theme/[presetKey]
 *
 * Standalone full-website theme preview.  Renders a simulated multi-page
 * website (nav, 8 page types, footer) styled with the selected preset.
 *
 * Used by ThemeFullPreview in the onboarding wizard instead of a bare
 * Storybook story — gives prospective tenants a realistic feel for the
 * full template, not just the homepage hero.
 *
 * ─── Theme injection ──────────────────────────────────────────────────────────
 *
 *   The root layout already injects [data-site] CSS vars for the active
 *   tenant's theme.  This page renders its own [data-site] <style> block
 *   INSIDE the body (i.e. later in document order than the root layout's
 *   <head> styles).  Because equal-specificity CSS rules resolve by document
 *   order, the preview vars always win — zero flicker, no !important hacks.
 *
 * ─── [data-site] wrapper ──────────────────────────────────────────────────────
 *
 *   All block and layout components read theme tokens from [data-site].
 *   ThemeWebPreview wraps its output in <div data-site="">, which anchors
 *   the tenant CSS variable scope — same pattern as app/(site)/layout.tsx.
 */

import { notFound }          from "next/navigation";
import { THEME_PRESETS, isThemePresetKey } from "@/design-system/theme/presets";
import { tenantThemeToCSS }  from "@/design-system/theme";
import { ThemeWebPreview }   from "./ThemeWebPreview";

type Props = { params: Promise<{ presetKey: string }> };

export function generateMetadata() {
  return { title: "Theme Preview" };
}

export default async function ThemePreviewPage({ params }: Props) {
  const { presetKey } = await params;

  if (!isThemePresetKey(presetKey)) notFound();

  const preset = THEME_PRESETS[presetKey];

  // Inject [data-site] vars for the selected preset.
  // Rendered inside <body> — wins by document order over the root layout's
  // head styles (same [data-site] specificity, later position).
  const css = `[data-site] {\n${tenantThemeToCSS(preset)}}`;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ThemeWebPreview presetKey={presetKey} />
    </>
  );
}
