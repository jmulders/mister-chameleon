/**
 * /admin/context — Context Variable Metadata Management
 *
 * Interactive management view for context variable metadata.
 *
 * ─── What this page does ──────────────────────────────────────────────────────
 *
 *   Combines the static context/registry.ts (67 built-in variables) with
 *   operator-editable metadata from the context_variable_metadata DB table to
 *   produce a live, editable dictionary.
 *
 *   Operators can:
 *     • Edit  label, description, category, sort order, availability gates
 *             (usableInRules, usableInAI), and the enabled flag for any variable.
 *     • Create brand-new custom variables (key, type, source, gates, label, description).
 *     • Delete custom variables (built-in variables are protected).
 *     • Toggle enabled state inline without opening the edit form.
 *
 * ─── What is read-only ────────────────────────────────────────────────────────
 *
 *   For built-in variables, the system fields defined in context/registry.ts
 *   (type, source, operators, allowedValues) are always read-only.  The admin
 *   page and edit form clearly mark these as immutable.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   This file is an async server component: it fetches merged variable data,
 *   then passes it to <ContextVariableManager> (client component) for
 *   interactive editing.  Server actions in actions.ts handle persistence.
 *
 * ─── Security notes ───────────────────────────────────────────────────────────
 *
 *   Only metadata is stored — no API keys, no secrets, no raw IPs.
 *   The actions layer prevents overwriting built-in keys via the custom-create
 *   flow and prevents deletion of non-custom rows.
 */

import { getMergedContextVariables } from "@/context/merged-registry";
import { ContextVariableManager } from "./ContextVariableManager";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ContextVariablesPage() {
  const vars = await getMergedContextVariables();

  return (
    <div className="max-w-6xl p-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Context Variables</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage the metadata for all runtime context variables.
          Built-in variable system fields (type, source, operators) are read-only.
          Labels, descriptions, availability gates, and enabled state are editable for all variables.
          Custom variables can be created and deleted.
        </p>
      </div>

      {/* Interactive manager (client component) */}
      <ContextVariableManager initialVars={vars} />
    </div>
  );
}
