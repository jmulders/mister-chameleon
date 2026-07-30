/**
 * LayoutVariantEditor
 *
 * Admin UI for selecting the structural header and footer variants for a tenant.
 *
 * ─── Responsibility ───────────────────────────────────────────────────────────
 *
 *   This editor controls STRUCTURAL shape — which nav/footer component is
 *   rendered — separately from color tokens (which live in the Advanced tab).
 *
 *   Header variants:
 *     minimal     — compact strip, horizontal links, no dropdown panels
 *     flyout      — standard height, vertical flyout dropdown on hover
 *     mega        — standard height, full-width multi-column panel
 *     transparent — no initial background, floats over the hero section
 *
 *   Footer variants:
 *     minimal    — single row: brand | nav links | copyright
 *     corporate  — multi-column: brand+tagline left, link categories right
 *     branding   — centred logo with centred nav and copyright below
 *
 *   Footer density (independent of variant):
 *     compact   — tighter vertical rhythm
 *     spacious  — generous padding
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Reads current values from `design` prop (TenantDesignSettings).
 *   Saves via saveVisualTokensAction — same action used by the token editor.
 *   Empty-string ("") tells the action to clear the override, reverting to
 *   the active theme family's default.
 */

"use client";

import { useState, useTransition } from "react";
import { saveVisualTokensAction }  from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantDesignSettings } from "@/tenant/types";
import type { HeaderVariant, FooterVariant, FooterDensity } from "@/tenant/types";
import {
  getFeaturedFamilyForPreset,
  getFamilyLayoutDefaults,
  isHeaderVariantOverridden,
  isFooterVariantOverridden,
  isFooterDensityOverridden,
} from "@/design-system/theme/style-defaults";
import { isFeaturedFamilyKey } from "@/design-system/theme/theme-families.config";
import type { FeaturedFamilyKey } from "@/design-system/theme/theme-families.config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayoutVariantEditorProps {
  tenantId: string;
  design:   TenantDesignSettings;
}

// ── Header variant catalogue ──────────────────────────────────────────────────

interface HeaderVariantDef {
  value:       HeaderVariant;
  label:       string;
  description: string;
}

const HEADER_VARIANTS: readonly HeaderVariantDef[] = [
  {
    value:       "minimal",
    label:       "Minimal",
    description: "Compact strip with horizontal links and no dropdown panels.",
  },
  {
    value:       "flyout",
    label:       "Flyout",
    description: "Standard height with vertical flyout dropdown panels on hover.",
  },
  {
    value:       "mega",
    label:       "Mega",
    description: "Full-width multi-column panel for deep navigation hierarchies.",
  },
  {
    value:       "transparent",
    label:       "Transparent",
    description: "No initial background. The header floats over the hero section.",
  },
] as const;

// ── Footer variant catalogue ──────────────────────────────────────────────────

interface FooterVariantDef {
  value:       FooterVariant;
  label:       string;
  description: string;
}

const FOOTER_VARIANTS: readonly FooterVariantDef[] = [
  {
    value:       "minimal",
    label:       "Minimal",
    description: "Single row. Brand on the left, nav links centre, copyright right.",
  },
  {
    value:       "corporate",
    label:       "Corporate",
    description: "Multi-column layout. Brand + tagline on the left, organised link categories on the right.",
  },
  {
    value:       "branding",
    label:       "Branding",
    description: "Centred brand-first with prominent logo, centred nav links, and copyright below.",
  },
] as const;

// ── CSS-only header mini-preview ──────────────────────────────────────────────
//
// Renders a tiny diagram of each header variant's structure at ~240×72px.
// Uses only HTML div elements and inline styles — zero dependencies.

function HeaderMiniPreview({ variant }: { variant: HeaderVariant }) {
  const bar: React.CSSProperties = {
    width:           "100%",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         "0 10px",
    gap:             "8px",
    borderBottom:    variant === "transparent" ? "1px dashed rgba(255,255,255,0.4)" : "1px solid #e5e7eb",
    background:      variant === "transparent" ? "transparent" : "#ffffff",
    height:          variant === "minimal" ? "28px" : "36px",
    flexShrink:      0,
  };

  // Logo stub
  const logo = (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#3b82f6" }} />
      <div style={{ width: "28px", height: "4px", borderRadius: "2px", background: "#374151" }} />
    </div>
  );

  // Nav items stub — differ per variant
  const navItems = () => {
    if (variant === "minimal") {
      return (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {[36, 30, 32, 26].map((w, i) => (
            <div key={i} style={{ width: `${w}px`, height: "3px", borderRadius: "2px", background: "#9ca3af" }} />
          ))}
        </div>
      );
    }
    if (variant === "mega") {
      return (
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {[36, 30, 32, 26, 28].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <div style={{ width: `${w}px`, height: "3px", borderRadius: "2px", background: "#9ca3af" }} />
              <div style={{ width: "4px", height: "3px", borderRadius: "1px", background: "#d1d5db" }} />
            </div>
          ))}
        </div>
      );
    }
    // flyout / transparent
    return (
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {[36, 30, 32].map((w, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <div style={{ width: `${w}px`, height: "3px", borderRadius: "2px", background: variant === "transparent" ? "rgba(255,255,255,0.8)" : "#9ca3af" }} />
            <div style={{ width: "0", height: "0", borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: `4px solid ${variant === "transparent" ? "rgba(255,255,255,0.5)" : "#d1d5db"}` }} />
          </div>
        ))}
      </div>
    );
  };

  // Panel shown below the bar for mega / flyout
  const panel = () => {
    if (variant === "mega") {
      return (
        <div style={{
          width: "100%", padding: "6px 10px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex", gap: "8px",
        }}>
          {[0, 1, 2].map((col) => (
            <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ width: "60%", height: "3px", borderRadius: "2px", background: "#374151", opacity: 0.6 }} />
              {[0, 1, 2].map((r) => (
                <div key={r} style={{ width: "80%", height: "2px", borderRadius: "2px", background: "#9ca3af" }} />
              ))}
            </div>
          ))}
        </div>
      );
    }
    if (variant === "flyout") {
      return (
        <div style={{
          width: "90px", padding: "4px 6px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0 0 4px 4px",
          marginLeft: "50px",
          display: "flex", flexDirection: "column", gap: "3px",
        }}>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} style={{ width: "70%", height: "2px", borderRadius: "2px", background: "#9ca3af" }} />
          ))}
        </div>
      );
    }
    return null;
  };

  const wrapper: React.CSSProperties = {
    width:           "100%",
    height:          "72px",
    overflow:        "hidden",
    display:         "flex",
    flexDirection:   "column",
    borderRadius:    "0.375rem 0.375rem 0 0",
    background:      variant === "transparent" ? "linear-gradient(135deg, #1e3a5f 0%, #2d4a7a 100%)" : "#f9fafb",
    position:        "relative",
  };

  return (
    <div style={wrapper}>
      <div style={bar}>
        {logo}
        {navItems()}
      </div>
      {panel()}
      {variant === "transparent" && (
        // Hero text stubs under the transparent header
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "4px",
          padding: "4px 10px",
        }}>
          <div style={{ width: "50%", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.9)" }} />
          <div style={{ width: "35%", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.55)" }} />
        </div>
      )}
    </div>
  );
}

// ── CSS-only footer mini-preview ──────────────────────────────────────────────

function FooterMiniPreview({ variant, density }: { variant: FooterVariant; density: FooterDensity }) {
  const padY = density === "spacious" ? "10px" : "6px";

  const wrapper: React.CSSProperties = {
    width:           "100%",
    height:          "72px",
    overflow:        "hidden",
    background:      "#1e293b",
    borderRadius:    "0 0 0.375rem 0.375rem",
    display:         "flex",
    flexDirection:   "column",
    justifyContent:  "center",
    padding:         `${padY} 10px`,
    gap:             "5px",
  };

  // Brand stub
  const brandStub = (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div style={{ width: "7px", height: "7px", borderRadius: "1px", background: "#3b82f6" }} />
      <div style={{ width: "32px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.8)" }} />
    </div>
  );

  // Link row stub
  const linkRow = (count: number) => (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: `${20 + (i % 3) * 8}px`, height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.4)" }} />
      ))}
    </div>
  );

  // Copyright stub
  const copyright = (
    <div style={{ width: "80px", height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.2)" }} />
  );

  if (variant === "minimal") {
    return (
      <div style={wrapper}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          {brandStub}
          {linkRow(4)}
          {copyright}
        </div>
      </div>
    );
  }

  if (variant === "corporate") {
    return (
      <div style={wrapper}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          {/* Brand side */}
          <div style={{ width: "60px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
            {brandStub}
            <div style={{ width: "50px", height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.25)" }} />
            <div style={{ width: "40px", height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.15)" }} />
          </div>
          {/* Two link columns */}
          {[0, 1].map((col) => (
            <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ width: "40px", height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.6)" }} />
              {[0, 1, 2].map((r) => (
                <div key={r} style={{ width: `${25 + r * 5}px`, height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.3)" }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "4px" }}>
          {copyright}
        </div>
      </div>
    );
  }

  // branding — centred
  return (
    <div style={{ ...wrapper, alignItems: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>{brandStub}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>{linkRow(4)}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>{copyright}</div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize:      "0.6875rem",
      fontWeight:    600,
      color:         "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      margin:        "0 0 0.75rem",
    }}>
      {children}
    </p>
  );
}

// ── Variant card ──────────────────────────────────────────────────────────────

interface VariantCardProps {
  isActive:   boolean;
  isAuto:     boolean;  // true when no override is set and this is the family default
  onSelect:   () => void;
  label:      string;
  description: string;
  preview:    React.ReactNode;
}

function VariantCard({ isActive, isAuto, onSelect, label, description, preview }: VariantCardProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        display:       "flex",
        flexDirection: "column",
        borderRadius:  "0.625rem",
        border:        isActive ? "2px solid #3b82f6" : "1px solid #e5e7eb",
        overflow:      "hidden",
        background:    "#ffffff",
        boxShadow:     isActive
          ? "0 0 0 3px rgba(59,130,246,0.12)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        cursor:        "pointer",
        transition:    "box-shadow 0.15s ease, border-color 0.15s ease",
        userSelect:    "none",
      }}
    >
      {/* Preview area */}
      <div style={{ height: "72px", overflow: "hidden", flexShrink: 0 }}>
        {preview}
      </div>

      {/* Card body */}
      <div style={{ padding: "0.625rem 0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827" }}>
            {label}
          </span>
          {isActive && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "1px 6px", borderRadius: "9999px",
              fontSize: "0.625rem", fontWeight: 600,
              background: "#eff6ff", color: "#2563eb", flexShrink: 0,
            }}>
              Active
            </span>
          )}
          {isAuto && !isActive && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "1px 6px", borderRadius: "9999px",
              fontSize: "0.625rem", fontWeight: 500,
              background: "#f0fdf4", color: "#16a34a", flexShrink: 0,
            }}>
              Family default
            </span>
          )}
        </div>
        <p style={{ fontSize: "0.6875rem", color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// ── Density toggle ────────────────────────────────────────────────────────────

interface DensityToggleProps {
  value:     FooterDensity | "auto";
  onChange:  (v: FooterDensity | "auto") => void;
  familyDefault: FooterDensity;
}

function DensityToggle({ value, onChange, familyDefault }: DensityToggleProps) {
  const options: Array<{ v: FooterDensity | "auto"; label: string }> = [
    { v: "auto",     label: `Auto (${familyDefault})` },
    { v: "compact",  label: "Compact" },
    { v: "spacious", label: "Spacious" },
  ];

  return (
    <div style={{ display: "inline-flex", borderRadius: "0.375rem", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      {options.map(({ v, label }) => {
        const isSel = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding:    "0.375rem 0.75rem",
              fontSize:   "0.75rem",
              fontWeight: isSel ? 600 : 400,
              color:      isSel ? "#1d4ed8" : "#6b7280",
              background: isSel ? "#eff6ff" : "transparent",
              border:     "none",
              borderLeft: v !== "auto" ? "1px solid #e5e7eb" : "none",
              cursor:     "pointer",
              transition: "all 0.12s ease",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── LayoutVariantEditor ───────────────────────────────────────────────────────

// ── Nav typography section ────────────────────────────────────────────────────

interface NavTypographyField {
  key:       string;
  label:     string;
  hint:      string;
  example:   string;
}

const NAV_TYPO_FIELDS: readonly NavTypographyField[] = [
  {
    key:     "navLinkSize",
    label:   "Nav link size",
    hint:    "Font size for top-level header nav links",
    example: "e.g. 1rem, 0.9375rem, 15px",
  },
  {
    key:     "navLinkWeight",
    label:   "Nav link weight",
    hint:    "Font weight for top-level header nav links",
    example: "e.g. 400, 500, 600, 700",
  },
  {
    key:     "navLinkTracking",
    label:   "Nav link tracking",
    hint:    "Letter-spacing for top-level header nav links",
    example: "e.g. normal, 0.025em, 0.05em",
  },
  {
    key:     "navDropdownItemSize",
    label:   "Dropdown item size",
    hint:    "Font size for dropdown / submenu child links",
    example: "e.g. 0.875rem, 0.8125rem",
  },
  {
    key:     "footerNavSize",
    label:   "Footer nav size",
    hint:    "Font size for footer navigation links",
    example: "e.g. 0.875rem, 0.8125rem",
  },
] as const;

// ── LayoutVariantEditor ───────────────────────────────────────────────────────

export function LayoutVariantEditor({ tenantId, design }: LayoutVariantEditorProps) {
  const [pending,       startTransition] = useTransition();

  // Local state mirrors the stored values; "auto" means "use family default"
  const [headerVal,     setHeaderVal]    = useState<HeaderVariant | "auto">(
    design.headerVariant ?? "auto",
  );
  const [footerVal,     setFooterVal]    = useState<FooterVariant | "auto">(
    design.footerVariant ?? "auto",
  );
  const [densityVal,    setDensityVal]   = useState<FooterDensity | "auto">(
    design.footerDensity ?? "auto",
  );

  // Nav typography override state — keyed by field key
  const storedNavTypo: Record<string, string> = (design.tokenOverrides?.layout ?? {}) as Record<string, string>;
  const [navTypoVals, setNavTypoVals] = useState<Record<string, string>>({
    navLinkSize:         storedNavTypo.navLinkSize         ?? "",
    navLinkWeight:       storedNavTypo.navLinkWeight       ?? "",
    navLinkTracking:     storedNavTypo.navLinkTracking     ?? "",
    navDropdownItemSize: storedNavTypo.navDropdownItemSize ?? "",
    footerNavSize:       storedNavTypo.footerNavSize       ?? "",
  });

  const [error,         setError]        = useState<string | null>(null);
  const [savedAt,       setSavedAt]      = useState<number | null>(null);

  // ── Active family resolution ───────────────────────────────────────────────
  //
  // Priority: selectedStyleFamily stored on design > infer from active theme preset.
  // Only FeaturedFamilyKey entries have structural config entries.

  const activeFamilyKey: FeaturedFamilyKey | null = (() => {
    const stored = design.selectedStyleFamily;
    if (stored && isFeaturedFamilyKey(stored)) return stored as FeaturedFamilyKey;
    if (design.theme) return getFeaturedFamilyForPreset(String(design.theme));
    return null;
  })();

  const familyDefaults = activeFamilyKey ? getFamilyLayoutDefaults(activeFamilyKey) : null;

  // Effective defaults (used in "Auto" labels and status lines).
  const defaultHeaderVariant: HeaderVariant = familyDefaults?.headerVariant ?? "flyout";
  const defaultFooterVariant: FooterVariant = familyDefaults?.footerVariant ?? "minimal";
  const defaultFooterDensity: FooterDensity = familyDefaults?.footerDensity ?? "compact";
  const familyLabel: string                 = familyDefaults?.familyLabel   ?? "";

  // Override detection — compares stored values against family defaults.
  const headerIsOverridden  = isHeaderVariantOverridden(design.headerVariant, activeFamilyKey);
  const footerIsOverridden  = isFooterVariantOverridden(design.footerVariant, activeFamilyKey);
  const densityIsOverridden = isFooterDensityOverridden(design.footerDensity, activeFamilyKey);

  // ── Dirty check ────────────────────────────────────────────────────────────

  const headerDirty  = headerVal  !== (design.headerVariant ?? "auto");
  const footerDirty  = footerVal  !== (design.footerVariant ?? "auto");
  const densityDirty = densityVal !== (design.footerDensity ?? "auto");

  const navTypoDirty = NAV_TYPO_FIELDS.some(
    (f) => navTypoVals[f.key] !== (storedNavTypo[f.key] ?? ""),
  );

  const isDirty = headerDirty || footerDirty || densityDirty || navTypoDirty;

  // ── Save handler ───────────────────────────────────────────────────────────

  function handleSave() {
    if (!isDirty) return;
    setError(null);

    // Compute nav typo changes upfront (avoids stale closure issues in transition)
    const navSize     = navTypoVals.navLinkSize         ?? "";
    const navWeight   = navTypoVals.navLinkWeight       ?? "";
    const navTracking = navTypoVals.navLinkTracking     ?? "";
    const dropSize    = navTypoVals.navDropdownItemSize ?? "";
    const footerSize  = navTypoVals.footerNavSize       ?? "";

    const navSizeDirty     = navSize     !== (storedNavTypo.navLinkSize         ?? "");
    const navWeightDirty   = navWeight   !== (storedNavTypo.navLinkWeight       ?? "");
    const navTrackingDirty = navTracking !== (storedNavTypo.navLinkTracking     ?? "");
    const dropSizeDirty    = dropSize    !== (storedNavTypo.navDropdownItemSize ?? "");
    const footerSizeDirty  = footerSize  !== (storedNavTypo.footerNavSize       ?? "");

    startTransition(async () => {
      const result = await saveVisualTokensAction(tenantId, {
        // "" tells the action to clear the override (revert to family default)
        ...(headerDirty      ? { headerVariant:       headerVal  === "auto" ? "" : headerVal  } : {}),
        ...(footerDirty      ? { footerVariant:       footerVal  === "auto" ? "" : footerVal  } : {}),
        ...(densityDirty     ? { footerDensity:       densityVal === "auto" ? "" : densityVal } : {}),
        // Nav typography overrides — each field saved independently
        ...(navSizeDirty     ? { navLinkSize:         navSize     } : {}),
        ...(navWeightDirty   ? { navLinkWeight:       navWeight   } : {}),
        ...(navTrackingDirty ? { navLinkTracking:     navTracking } : {}),
        ...(dropSizeDirty    ? { navDropdownItemSize: dropSize    } : {}),
        ...(footerSizeDirty  ? { footerNavSize:       footerSize  } : {}),
      });
      if (result.ok) {
        setSavedAt(Date.now());
      } else {
        setError(result.errors?.join(", ") ?? "Failed to save layout settings.");
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "800px" }}>

      {/* ── Header variants ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Header variant</SectionLabel>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 0.75rem" }}>
          Controls the navigation style and header background. "Auto" uses the default for your active theme family.
        </p>

        {/* Inherited / override status indicator */}
        {familyLabel && (
          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {!headerIsOverridden ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "0.75rem", color: "#16a34a", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>✦</span>
                Inherited from {familyLabel}: <strong>{defaultHeaderVariant}</strong>
              </span>
            ) : (
              <>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "1px 8px", borderRadius: "9999px",
                  fontSize: "0.6875rem", fontWeight: 600,
                  background: "#fff7ed", color: "#c2410c",
                  border: "1px solid #fed7aa",
                }}>
                  Override active
                </span>
                <button
                  type="button"
                  onClick={() => setHeaderVal("auto")}
                  style={{
                    fontSize: "0.6875rem", color: "#6b7280", fontWeight: 500,
                    background: "none", border: "none", cursor: "pointer",
                    textDecoration: "underline", padding: 0,
                  }}
                >
                  Reset to {familyLabel} default ({defaultHeaderVariant})
                </button>
              </>
            )}
          </div>
        )}

        {/* Auto option (reset) */}
        <div style={{ marginBottom: "0.625rem" }}>
          <button
            type="button"
            onClick={() => setHeaderVal("auto")}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "0.375rem",
              padding:      "0.375rem 0.75rem",
              borderRadius: "9999px",
              border:       headerVal === "auto" ? "1.5px solid #3b82f6" : "1px solid #e5e7eb",
              background:   headerVal === "auto" ? "#eff6ff" : "#ffffff",
              color:        headerVal === "auto" ? "#1d4ed8" : "#6b7280",
              fontSize:     "0.75rem",
              fontWeight:   headerVal === "auto" ? 600 : 400,
              cursor:       "pointer",
              transition:   "all 0.12s ease",
            }}
          >
            Auto ({defaultHeaderVariant})
          </button>
        </div>

        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap:                 "0.75rem",
        }}>
          {HEADER_VARIANTS.map((hv) => (
            <VariantCard
              key={hv.value}
              isActive={headerVal === hv.value}
              isAuto={false}
              onSelect={() => setHeaderVal(hv.value)}
              label={hv.label}
              description={hv.description}
              preview={<HeaderMiniPreview variant={hv.value} />}
            />
          ))}
        </div>
      </div>

      {/* ── Footer variants ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Footer variant</SectionLabel>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 0.75rem" }}>
          Controls the footer layout structure. Color tokens remain configurable separately in the Advanced tab.
        </p>

        {/* Inherited / override status indicator */}
        {familyLabel && (
          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {!footerIsOverridden ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "0.75rem", color: "#16a34a", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>✦</span>
                Inherited from {familyLabel}: <strong>{defaultFooterVariant}</strong>
              </span>
            ) : (
              <>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "1px 8px", borderRadius: "9999px",
                  fontSize: "0.6875rem", fontWeight: 600,
                  background: "#fff7ed", color: "#c2410c",
                  border: "1px solid #fed7aa",
                }}>
                  Override active
                </span>
                <button
                  type="button"
                  onClick={() => setFooterVal("auto")}
                  style={{
                    fontSize: "0.6875rem", color: "#6b7280", fontWeight: 500,
                    background: "none", border: "none", cursor: "pointer",
                    textDecoration: "underline", padding: 0,
                  }}
                >
                  Reset to {familyLabel} default ({defaultFooterVariant})
                </button>
              </>
            )}
          </div>
        )}

        {/* Auto option (reset) */}
        <div style={{ marginBottom: "0.625rem" }}>
          <button
            type="button"
            onClick={() => setFooterVal("auto")}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "0.375rem",
              padding:      "0.375rem 0.75rem",
              borderRadius: "9999px",
              border:       footerVal === "auto" ? "1.5px solid #3b82f6" : "1px solid #e5e7eb",
              background:   footerVal === "auto" ? "#eff6ff" : "#ffffff",
              color:        footerVal === "auto" ? "#1d4ed8" : "#6b7280",
              fontSize:     "0.75rem",
              fontWeight:   footerVal === "auto" ? 600 : 400,
              cursor:       "pointer",
              transition:   "all 0.12s ease",
            }}
          >
            Auto ({defaultFooterVariant})
          </button>
        </div>

        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                 "0.75rem",
          marginBottom:        "1rem",
        }}>
          {FOOTER_VARIANTS.map((fv) => (
            <VariantCard
              key={fv.value}
              isActive={footerVal === fv.value}
              isAuto={false}
              onSelect={() => setFooterVal(fv.value)}
              label={fv.label}
              description={fv.description}
              preview={
                <FooterMiniPreview
                  variant={fv.value}
                  density={densityVal === "auto" ? "compact" : densityVal}
                />
              }
            />
          ))}
        </div>

        {/* Footer density */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#374151" }}>
              Footer density
            </span>
            <DensityToggle
              value={densityVal}
              onChange={setDensityVal}
              familyDefault={defaultFooterDensity}
            />
          </div>
          {/* Density override status */}
          {familyLabel && densityIsOverridden && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "1px 8px", borderRadius: "9999px",
                fontSize: "0.6875rem", fontWeight: 600,
                background: "#fff7ed", color: "#c2410c",
                border: "1px solid #fed7aa",
              }}>
                Override active
              </span>
              <button
                type="button"
                onClick={() => setDensityVal("auto")}
                style={{
                  fontSize: "0.6875rem", color: "#6b7280", fontWeight: 500,
                  background: "none", border: "none", cursor: "pointer",
                  textDecoration: "underline", padding: 0,
                }}
              >
                Reset to {familyLabel} default ({defaultFooterDensity})
              </button>
            </div>
          )}
          {familyLabel && !densityIsOverridden && (
            <span style={{ fontSize: "0.6875rem", color: "#16a34a", fontWeight: 500 }}>
              <span style={{ opacity: 0.7 }}>✦</span> Inherited from {familyLabel}: {defaultFooterDensity}
            </span>
          )}
        </div>
      </div>

      {/* ── Navigation typography ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Navigation typography</SectionLabel>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 0.75rem" }}>
          Override font size, weight, and letter-spacing for header nav links and footer nav links.
          Leave blank to use the active theme family's defaults.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {NAV_TYPO_FIELDS.map((field) => {
            const val    = navTypoVals[field.key] ?? "";
            const stored = storedNavTypo[field.key] ?? "";
            const hasOverride = stored !== "";

            return (
              <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{
                  fontSize:   "0.75rem",
                  fontWeight: 500,
                  color:      "#374151",
                  display:    "flex",
                  alignItems: "center",
                  gap:        "0.375rem",
                }}>
                  {field.label}
                  {hasOverride && (
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "1px 6px", borderRadius: "9999px",
                      fontSize: "0.5625rem", fontWeight: 600,
                      background: "#fff7ed", color: "#c2410c",
                      border: "1px solid #fed7aa",
                    }}>
                      Override
                    </span>
                  )}
                </label>
                <p style={{ fontSize: "0.6875rem", color: "#9ca3af", margin: "0 0 0.25rem" }}>
                  {field.hint}
                </p>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  <input
                    type="text"
                    value={val}
                    placeholder={field.example}
                    onChange={(e) => setNavTypoVals((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    style={{
                      flex:         1,
                      padding:      "0.375rem 0.625rem",
                      fontSize:     "0.8125rem",
                      border:       val !== stored ? "1px solid #3b82f6" : "1px solid #e5e7eb",
                      borderRadius: "0.375rem",
                      outline:      "none",
                      fontFamily:   "monospace",
                      background:   "#fafafa",
                      color:        "#111827",
                    }}
                  />
                  {val !== "" && (
                    <button
                      type="button"
                      title="Clear override"
                      onClick={() => setNavTypoVals((prev) => ({ ...prev, [field.key]: "" }))}
                      style={{
                        padding:      "0.375rem 0.5rem",
                        borderRadius: "0.375rem",
                        border:       "1px solid #e5e7eb",
                        background:   "#f9fafb",
                        color:        "#9ca3af",
                        fontSize:     "0.75rem",
                        cursor:       "pointer",
                        flexShrink:   0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Save bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         "0.75rem",
        paddingTop:  "0.5rem",
        borderTop:   "1px solid #f3f4f6",
      }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || pending}
          style={{
            padding:      "0.5rem 1.125rem",
            borderRadius: "0.375rem",
            border:       "none",
            background:   !isDirty || pending ? "#e5e7eb" : "#111827",
            color:        !isDirty || pending ? "#9ca3af" : "#ffffff",
            fontSize:     "0.8125rem",
            fontWeight:   600,
            cursor:       !isDirty || pending ? "default" : "pointer",
            transition:   "background 0.15s ease, opacity 0.15s ease",
          }}
        >
          {pending ? "Saving…" : "Save layout settings"}
        </button>

        {savedAt && !isDirty && !pending && (
          <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 500 }}>
            ✓ Saved
          </span>
        )}

        {error && (
          <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
            {error}
          </span>
        )}

        {isDirty && !pending && (
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* ── Info note ────────────────────────────────────────────────────── */}
      <p style={{
        fontSize:    "0.75rem",
        color:       "#9ca3af",
        margin:      0,
        lineHeight:  1.6,
        borderTop:   "1px solid #f3f4f6",
        paddingTop:  "1rem",
      }}>
        Header and footer <strong>color tokens</strong> (background, foreground, border) are
        configured separately in the <strong>Advanced</strong> tab under the Layout group.
        The controls above govern structural shape only.
      </p>
    </div>
  );
}
