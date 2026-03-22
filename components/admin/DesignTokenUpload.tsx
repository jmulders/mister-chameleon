"use client";

/**
 * DesignTokenUpload
 *
 * Client component that lets a designer upload a JSON token file and have it
 * applied to the tenant's design settings in one click.
 *
 * ─── Workflow ────────────────────────────────────────────────────────────────
 *
 *   1. Designer picks a .json file from their local machine.
 *   2. The component reads and parses it client-side, running the same
 *      validateDesignTokenUpload() validator used server-side to give
 *      immediate pre-submit feedback.
 *   3. If valid, a preview of the recognised tokens is shown and the designer
 *      confirms with "Apply tokens".
 *   4. applyDesignTokensAction() runs server-side (authoritative validation +
 *      merge + persist).  The result (success or errors) is shown inline.
 *
 * ─── Supported formats ────────────────────────────────────────────────────────
 *
 *   Legacy flat format   — theme, primaryColor, primaryFont, radiusInteractive,
 *                          radiusCard, radiusPopover at the top level.
 *   Grouped token format — theme plus group objects: color, typography, radius,
 *                          spacing, border, shadow, motion, component.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   tenantId       — the tenant to update.
 *   currentDesign  — the tenant's current design settings, used to show what
 *                    is already applied.
 */

import React, { useState, useRef } from "react";
import { applyDesignTokensAction }        from "@/app/admin/tenants/[tenantId]/actions";
import {
  validateDesignTokenUpload,
  DESIGN_TOKEN_KEYS,
  GROUPED_TOKEN_GROUPS,
  GROUP_TOKEN_KEYS,
} from "@/tenant/design-token-validator";
import type { DesignTokenUploadInput } from "@/tenant/design-token-validator";
import type { TenantDesignSettings, TenantTokenOverrides } from "@/tenant/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type UploadState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "invalid"; errors: string[] }
  | {
      status:      "ready";
      filename:    string;
      tokens:      DesignTokenUploadInput;
      appliedKeys: string[];
      warnings:    string[];
      format:      "legacy" | "grouped";
    }
  | { status: "applying" }
  | { status: "success"; appliedKeys: string[]; warnings: string[]; format: "legacy" | "grouped" }
  | { status: "failed";  errors: string[] };

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Renders a token preview table for the "ready" state.
 *
 * Legacy format: key → value rows.
 * Grouped format: group header rows with nested key → value rows.
 */
function TokenPreview({
  tokens,
  appliedKeys,
  format,
}: {
  tokens:      DesignTokenUploadInput;
  appliedKeys: string[];
  format:      "legacy" | "grouped";
}) {
  if (format === "legacy") {
    return (
      <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {appliedKeys.map((key) => (
          // React.Fragment with key — avoids the "unique key" warning that
          // occurs when a component returning <> is used in a mapped list.
          <React.Fragment key={key}>
            <dt className="font-mono text-neutral-400">{key}</dt>
            <dd className="font-mono text-neutral-700 truncate">
              {String(tokens[key as keyof DesignTokenUploadInput] ?? "")}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    );
  }

  // Grouped format
  return (
    <div className="mb-2 space-y-2 text-xs">
      {appliedKeys.map((key) => {
        if (key === "theme") {
          return (
            <dl key="theme" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="font-mono text-neutral-400">theme</dt>
              <dd className="font-mono text-neutral-700">{tokens.theme}</dd>
            </dl>
          );
        }
        const group = tokens[key as keyof DesignTokenUploadInput] as Record<string, string> | undefined;
        if (!group) return null;
        const count = Object.keys(group).length;
        return (
          <div key={key}>
            <p className="mb-0.5 font-medium text-neutral-600">
              <span className="font-mono">{key}</span>{" "}
              <span className="text-neutral-400 font-normal">
                ({count} token{count !== 1 ? "s" : ""})
              </span>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-3">
              {Object.entries(group).map(([k, v]) => (
                <React.Fragment key={`${key}.${k}`}>
                  <dt className="font-mono text-neutral-400">{k}</dt>
                  <dd className="font-mono text-neutral-700 truncate">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders the "currently applied tokens" section from TenantDesignSettings.
 *
 * Shows legacy flat overrides (primaryColor, primaryFont, radius*) as well as
 * any grouped token overrides stored in tokenOverrides.
 */
function CurrentTokensSummary({ design }: { design: TenantDesignSettings }) {
  const to: TenantTokenOverrides | undefined = design.tokenOverrides;

  const legacyRows: React.ReactNode[] = [];

  if (design.primaryColor) {
    legacyRows.push(
      <dt key="pc-k" className="font-mono text-neutral-400">primaryColor</dt>,
      <dd key="pc-v" className="flex items-center gap-1.5 font-mono text-neutral-700">
        <span
          className="inline-block size-3 shrink-0 rounded-sm border border-neutral-200"
          style={{ background: design.primaryColor }}
          aria-hidden
        />
        {design.primaryColor}
      </dd>,
    );
  }
  if (design.primaryFont) {
    legacyRows.push(
      <dt key="pf-k" className="font-mono text-neutral-400">primaryFont</dt>,
      <dd key="pf-v" className="font-mono text-neutral-700 truncate">{design.primaryFont}</dd>,
    );
  }
  if (to?.radiusInteractive) {
    legacyRows.push(
      <dt key="ri-k" className="font-mono text-neutral-400">radiusInteractive</dt>,
      <dd key="ri-v" className="font-mono text-neutral-700">{to.radiusInteractive}</dd>,
    );
  }
  if (to?.radiusCard) {
    legacyRows.push(
      <dt key="rc-k" className="font-mono text-neutral-400">radiusCard</dt>,
      <dd key="rc-v" className="font-mono text-neutral-700">{to.radiusCard}</dd>,
    );
  }
  if (to?.radiusPopover) {
    legacyRows.push(
      <dt key="rp-k" className="font-mono text-neutral-400">radiusPopover</dt>,
      <dd key="rp-v" className="font-mono text-neutral-700">{to.radiusPopover}</dd>,
    );
  }

  // Grouped overrides
  const groupSections: React.ReactNode[] = [];
  if (to) {
    for (const group of GROUPED_TOKEN_GROUPS) {
      const groupOverrides = to[group as keyof TenantTokenOverrides] as
        | Readonly<Record<string, string>>
        | undefined;
      if (!groupOverrides || Object.keys(groupOverrides).length === 0) continue;
      const count = Object.keys(groupOverrides).length;
      groupSections.push(
        <div key={group} className="mt-1.5">
          <p className="mb-0.5 text-xs font-medium text-neutral-500">
            <span className="font-mono">{group}</span>{" "}
            <span className="font-normal text-neutral-400">
              ({count} token{count !== 1 ? "s" : ""})
            </span>
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-3 text-xs">
            {Object.entries(groupOverrides).map(([k, v]) => (
              <React.Fragment key={`${group}-${k}`}>
                <dt className="font-mono text-neutral-400">{k}</dt>
                <dd className="font-mono text-neutral-700 truncate">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>,
      );
    }
  }

  if (legacyRows.length === 0 && groupSections.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-neutral-600">Currently applied tokens</p>
      {legacyRows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {legacyRows}
        </dl>
      )}
      {groupSections}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DesignTokenUploadProps {
  tenantId:      string;
  currentDesign: TenantDesignSettings;
}

export function DesignTokenUpload({ tenantId, currentDesign }: DesignTokenUploadProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const fileRef           = useRef<HTMLInputElement>(null);

  // ── File selection ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setState({ status: "invalid", errors: ["Only .json files are accepted."] });
      return;
    }
    if (file.size > 64 * 1024) {
      setState({ status: "invalid", errors: ["Token file must be smaller than 64 KB."] });
      return;
    }

    setState({ status: "parsing" });

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json   = JSON.parse(ev.target?.result as string);
        const result = validateDesignTokenUpload(json);

        if (!result.ok) {
          setState({ status: "invalid", errors: result.errors });
        } else {
          setState({
            status:      "ready",
            filename:    file.name,
            tokens:      result.tokens,
            appliedKeys: result.appliedKeys,
            warnings:    result.warnings,
            format:      result.format,
          });
        }
      } catch {
        setState({
          status: "invalid",
          errors: ["Could not parse the file — make sure it is valid JSON."],
        });
      }
    };
    reader.onerror = () =>
      setState({ status: "invalid", errors: ["Could not read the file."] });
    reader.readAsText(file);
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  async function handleApply() {
    if (state.status !== "ready") return;
    setState({ status: "applying" });

    const result = await applyDesignTokensAction(tenantId, state.tokens);

    if (result.ok) {
      setState({
        status:      "success",
        appliedKeys: result.appliedKeys,
        warnings:    result.warnings ?? [],
        format:      result.format,
      });
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setState({ status: "failed", errors: result.errors });
    }
  }

  function handleReset() {
    setState({ status: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Active token summary ────────────────────────────────────────────────────

  const to = currentDesign.tokenOverrides;
  const hasActiveOverrides =
    currentDesign.primaryColor ||
    currentDesign.primaryFont  ||
    (to && (
      to.radiusInteractive || to.radiusCard || to.radiusPopover ||
      to.color || to.typography || to.radius || to.spacing ||
      to.border || to.shadow || to.motion || to.component
    ));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 mb-6 rounded-lg border border-neutral-200 bg-white p-5">

      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">Design Token Upload</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
          JSON
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Upload a <code className="font-mono">.json</code> file to apply design tokens to this tenant.
        Tokens are layered on top of the active theme preset — only the fields you upload are overridden.
      </p>

      {/* Currently applied tokens (read-only) */}
      {hasActiveOverrides && state.status !== "success" && (
        <CurrentTokensSummary design={currentDesign} />
      )}

      {/* Format hint */}
      <details className="mb-4 group">
        <summary className="cursor-pointer select-none text-xs text-neutral-400 hover:text-neutral-600">
          Show accepted token formats
        </summary>
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Legacy flat format</p>
            <pre className="overflow-x-auto rounded-md bg-neutral-950 px-4 py-3 text-xs leading-relaxed text-neutral-100">
{`{
  "theme":             "custom",
  "primaryColor":      "#e63946",
  "primaryFont":       "'Poppins', sans-serif",
  "radiusInteractive": "4px",
  "radiusCard":        "8px",
  "radiusPopover":     "6px"
}`}
            </pre>
            <p className="mt-1 text-xs text-neutral-400">
              All fields optional. Accepted keys:{" "}
              {DESIGN_TOKEN_KEYS.map((k, i) => (
                <span key={k}>
                  {i > 0 && ", "}
                  <code className="font-mono">{k}</code>
                </span>
              ))}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Grouped token format</p>
            <pre className="overflow-x-auto rounded-md bg-neutral-950 px-4 py-3 text-xs leading-relaxed text-neutral-100">
{`{
  "theme": "custom",
  "color":      { "primary": "#e63946", "secondary": "#4a90e2" },
  "typography": { "fontSans": "'Poppins', sans-serif" },
  "radius":     { "interactive": "4px", "card": "8px", "popover": "6px" },
  "spacing":    { "sm": "8px", "md": "16px" },
  "border":     { "width": "1px" },
  "shadow":     { "sm": "0 1px 2px rgba(0,0,0,0.05)" },
  "motion":     { "durationBase": "200ms" },
  "component":  { "buttonRadius": "4px" }
}`}
            </pre>
            <p className="mt-1 text-xs text-neutral-400">
              All groups and their fields are optional. Supported groups:{" "}
              {GROUPED_TOKEN_GROUPS.map((g, i) => (
                <span key={g}>
                  {i > 0 && ", "}
                  <code className="font-mono">{g}</code>
                </span>
              ))}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Legacy and grouped keys may not be mixed in the same file.{" "}
              <code className="font-mono">theme</code> is valid in both formats.
            </p>
          </div>
        </div>
      </details>

      {/* File input */}
      <div className="mb-3">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={state.status === "applying"}
          className="block w-full text-xs text-neutral-500
            file:mr-3 file:cursor-pointer file:rounded file:border
            file:border-neutral-200 file:bg-white file:px-2.5 file:py-1.5
            file:text-xs file:font-medium file:text-neutral-700
            file:transition-colors file:hover:bg-neutral-50
            disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* State-specific panels */}
      {state.status === "parsing" && (
        <p className="text-xs text-neutral-400">Parsing file…</p>
      )}

      {state.status === "ready" && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="mb-2 text-xs font-medium text-neutral-700">
            <span className="font-mono">{state.filename}</span>{" "}
            — {state.appliedKeys.length} {state.format === "grouped" ? "group" : "token"}{state.appliedKeys.length !== 1 ? "s" : ""} recognised
            {state.format === "grouped" && (
              <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                grouped
              </span>
            )}
          </p>

          {/* Token preview */}
          <TokenPreview
            tokens={state.tokens}
            appliedKeys={state.appliedKeys}
            format={state.format}
          />

          {state.warnings.length > 0 && (
            <ul className="mb-2 text-xs text-amber-700">
              {state.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
            >
              Apply tokens
            </button>
            <button
              onClick={handleReset}
              className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.status === "applying" && (
        <p className="text-xs text-neutral-400">Applying tokens…</p>
      )}

      {state.status === "success" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-3">
          <p className="mb-1.5 text-xs font-semibold text-green-800">
            ✓ {state.appliedKeys.length} {state.format === "grouped" ? "group" : "token"}{state.appliedKeys.length !== 1 ? "s" : ""} applied and saved
          </p>
          <p className="mb-1 text-xs text-green-700">
            Applied:{" "}
            {state.appliedKeys.map((k, i) => (
              <span key={k}>
                {i > 0 && ", "}
                <code className="font-mono">{k}</code>
              </span>
            ))}
          </p>
          {state.warnings.length > 0 && (
            <ul className="mt-1.5 text-xs text-amber-700">
              {state.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-green-600 underline hover:text-green-800"
          >
            Upload another file
          </button>
        </div>
      )}

      {(state.status === "invalid" || state.status === "failed") && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3">
          <p className="mb-1.5 text-xs font-semibold text-red-800">
            {state.status === "invalid" ? "Invalid token file" : "Failed to apply tokens"}
          </p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {state.errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
