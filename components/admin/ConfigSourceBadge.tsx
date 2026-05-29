"use client";

/**
 * ConfigSourceBadge
 *
 * Renders a small, consistent status badge indicating which configuration
 * layer is currently active for a given domain.
 *
 * Designed to be used in admin pages alongside integration settings forms,
 * surfacing "where does this config come from?" at a glance.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <ConfigSourceBadge source="tenant"   />  → green   "Tenant override"
 *   <ConfigSourceBadge source="platform" />  → blue    "Platform default"
 *   <ConfigSourceBadge source="env"      />  → neutral "Env var fallback"
 *   <ConfigSourceBadge source="system"   />  → neutral "System default"
 *   <ConfigSourceBadge source="none"     />  → amber   "Not configured"
 *
 *   // With custom label:
 *   <ConfigSourceBadge source="platform" label="Using platform email" />
 *
 *   // With size variant:
 *   <ConfigSourceBadge source="tenant" size="sm" />  // smaller text
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This component is safe to use in client components — it only receives
 *   a `ConfigSource` string, never any secrets or raw config values.
 */

import type { ConfigSource } from "@/lib/config/types";
import { sourceLabel, sourceBadgeClass, sourceDescription } from "@/lib/config/types";

// ─────────────────────────────────────────────────────────────────────────────
// ConfigSourceBadge
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigSourceBadgeProps {
  /** The configuration source to display. */
  source: ConfigSource;
  /**
   * Optional custom label.  When omitted, uses `sourceLabel(source)`.
   */
  label?: string;
  /**
   * Size variant.
   * - "xs" — extra small (default): suitable for inline badges in form labels
   * - "sm" — small: suitable for standalone status rows
   */
  size?: "xs" | "sm";
  /**
   * Whether to show a tooltip with the source description on hover.
   * Defaults to true.
   */
  tooltip?: boolean;
  /** Additional CSS classes to merge onto the badge element. */
  className?: string;
}

export function ConfigSourceBadge({
  source,
  label,
  size = "xs",
  tooltip = true,
  className = "",
}: ConfigSourceBadgeProps) {
  const text   = label ?? sourceLabel(source);
  const colors = sourceBadgeClass(source);
  const title  = tooltip ? sourceDescription(source) : undefined;

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-xs"
    : "px-1.5 py-px text-[10px]";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${sizeClass} ${colors} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor(source)}`}
        aria-hidden="true"
      />
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfigSourceRow — convenience wrapper for admin settings pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A two-column row pairing a label with a `ConfigSourceBadge`.
 * Useful for "Transport source: [Tenant override]" rows in admin pages.
 *
 * @example
 *   <ConfigSourceRow label="Transport" source={resolution.source} />
 *   <ConfigSourceRow label="Recipients" source={resolution.recipientSource} note="backoffice@acme.com" />
 */
interface ConfigSourceRowProps {
  label:    string;
  source:   ConfigSource;
  /** Optional detail text shown after the badge (e.g. the effective value). */
  note?:    string;
  className?: string;
}

export function ConfigSourceRow({
  label,
  source,
  note,
  className = "",
}: ConfigSourceRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-xs ${className}`}>
      <span className="text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        {note && (
          <span className="text-neutral-700 font-mono">{note}</span>
        )}
        <ConfigSourceBadge source={source} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function dotColor(source: ConfigSource): string {
  switch (source) {
    case "tenant":   return "bg-green-500";
    case "platform": return "bg-blue-500";
    case "env":      return "bg-neutral-400";
    case "system":   return "bg-neutral-300";
    case "none":     return "bg-amber-400";
  }
}
