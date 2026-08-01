/**
 * RegisteredFormsTable
 *
 * Displays all platform-registered form definitions in a compact table.
 *
 * ─── Columns ──────────────────────────────────────────────────────────────────
 *
 *   Key          — the form's registry key (used in the submission URL)
 *   Title        — human-readable form name
 *   Store        — effective store-submissions flag (code default or tenant override)
 *   Notify       — effective notify-backoffice flag
 *   Confirm      — effective send-confirmation flag
 *   Source       — whether the effective behavior comes from the code definition
 *                  or from this tenant's settings
 *   Action       — "Configure" link (placeholder for per-form override page)
 *
 * ─── Effective source logic ───────────────────────────────────────────────────
 *
 *   For Store: if the tenant has a setting, it overrides the definition default.
 *   For Notify / Confirm: same — tenant settings can override the definition.
 *
 *   "source" column reflects the highest-priority layer that produced the
 *   effective value:
 *     • "Tenant"     — tenant settings are set (overriding the code definition)
 *     • "Definition" — no tenant override; using the code definition default
 *
 * This is a pure server component — no client-side state.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FormSummaryItem {
  key:              string;
  title:            string;
  /** Store default from the form definition. */
  defStore:         boolean;
  /** Notify default from the form definition. */
  defNotify:        boolean;
  /** Confirm default from the form definition. */
  defConfirm:       boolean;
}

interface RegisteredFormsTableProps {
  forms:            FormSummaryItem[];
  tenantId:         string;
  /** Tenant-level store setting — overrides defStore for all forms. */
  tenantStore:      boolean;
  /** Tenant-level confirm setting — overrides defConfirm for all forms. */
  tenantConfirm:    boolean;
  /** Whether the tenant has set any notification recipients (affects Notify display). */
  tenantHasRecipients: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RegisteredFormsTable({
  forms,
  tenantId,
  tenantStore,
  tenantConfirm,
  tenantHasRecipients,
}: RegisteredFormsTableProps) {
  if (forms.length === 0) {
    return (
      <p className="text-sm text-neutral-400 italic">
        No platform-registered forms found.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Registered Forms</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Platform-registered form definitions. Tenant settings (above) apply as tenant-level
          defaults; each definition may further restrict behavior in code.
        </p>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-left border-b border-neutral-200">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-700">Key</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700">Title</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700 text-center">Store</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700 text-center">Notify</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700 text-center">Confirm</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700">Source</th>
              <th className="px-4 py-2.5 font-medium text-neutral-700" />
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => {
              // Effective values: tenant overrides definition default.
              const effStore   = tenantStore;   // tenant setting always overrides store
              const effConfirm = tenantConfirm; // tenant setting always overrides confirm
              // For notify, the flag comes from the definition; but tenant's recipients
              // control WHERE the notification goes.
              const effNotify  = form.defNotify;

              // The "source" column shows what drives Store and Confirm.
              // If the tenant value differs from the definition value, highlight it.
              const storeOverridden   = effStore   !== form.defStore;
              const confirmOverridden = effConfirm !== form.defConfirm;
              const isOverridden      = storeOverridden || confirmOverridden;

              return (
                <tr
                  key={form.key}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-neutral-700 whitespace-nowrap">
                    {form.key}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{form.title}</td>
                  <td className="px-4 py-2.5 text-center">
                    <FlagCell
                      effective={effStore}
                      definition={form.defStore}
                      overridden={storeOverridden}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <FlagCell
                      effective={effNotify}
                      definition={form.defNotify}
                      overridden={false}
                      dimWhenFalse={!tenantHasRecipients && effNotify}
                      dimHint="No recipients configured"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <FlagCell
                      effective={effConfirm}
                      definition={form.defConfirm}
                      overridden={confirmOverridden}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {isOverridden ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
                        Tenant
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">Definition</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={`/admin/tenants/${tenantId}/content/forms/${form.key}`}
                      className="text-xs text-neutral-400 hover:text-neutral-700 underline"
                      aria-label={`Configure ${form.title}`}
                    >
                      Configure
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-5 py-3 text-xs text-neutral-400 border-t border-neutral-100">
        Store / Confirm reflect tenant-level defaults. Notify uses the per-form definition
        flag; the active recipient comes from Notification Recipients above.
      </p>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FlagCell({
  effective,
  definition,
  overridden,
  dimWhenFalse = false,
  dimHint,
}: {
  effective:    boolean;
  definition:   boolean;
  overridden:   boolean;
  /** When true and effective is true, show a warning dot because of a missing dependency. */
  dimWhenFalse?: boolean | boolean;
  dimHint?:     string;
}) {
  if (effective) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${dimWhenFalse ? "text-amber-600" : overridden ? "text-green-700" : "text-neutral-700"}`}
        title={
          dimWhenFalse
            ? dimHint
            : overridden
            ? `On (tenant override; definition default: ${definition ? "on" : "off"})`
            : "On (definition default)"
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${dimWhenFalse ? "bg-amber-400" : overridden ? "bg-green-500" : "bg-neutral-400"}`}
          aria-hidden
        />
        on
      </span>
    );
  }
  return (
    <span className="text-neutral-400" title={overridden ? `Off (tenant override; definition default: ${definition ? "on" : "off"})` : "Off (definition default)"}>
      off
    </span>
  );
}
