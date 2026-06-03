"use server";

/**
 * Server actions for the form submissions inbox.
 *
 * All actions verify the tenantId scoping via the repository layer —
 * no cross-tenant data access is possible.
 */

export const runtime = "nodejs";

import { createClient }          from "@supabase/supabase-js";
import { cookies }               from "next/headers";
import { revalidatePath }        from "next/cache";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import {
  listFormSubmissions,
  deleteFormSubmission,
  type FormSubmissionRow,
  type ListFormSubmissionsInput,
} from "@/data/repositories/form-submissions-repository";
import { getTenantFormSettingsAction } from "@/app/admin/tenants/[tenantId]/forms/actions";
import { DEFAULT_TENANT_FORM_SETTINGS } from "@/tenant/types";
import type { TenantFormSettings }       from "@/tenant/types";
import { logger }                        from "@/lib/logger";

// ── Page size constant ─────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ── Auth helper ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) throw new Error("Admin session required");
  const session = await verifySession(token);
  if (!session) throw new Error("Invalid or expired admin session");
}

function getServiceClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Actions ────────────────────────────────────────────────────────────────────

/**
 * List form submissions for a tenant with optional filters and pagination.
 */
export async function listFormSubmissionsAction(
  tenantId: string,
  params: {
    formKey?: string;
    search?:  string;
    from?:    string;
    to?:      string;
    page?:    number;
  },
): Promise<
  | { ok: true; rows: FormSubmissionRow[]; total: number; page: number; pageSize: number }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    const page   = params.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    const input: ListFormSubmissionsInput = {
      tenantId,
      limit:  PAGE_SIZE,
      offset,
    };

    if (params.formKey) input.formKey = params.formKey;
    if (params.search)  input.search  = params.search;
    if (params.from)    input.from    = params.from;
    if (params.to)      input.to      = params.to;

    const client = getServiceClient();
    const result = await listFormSubmissions(client, input);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok:       true,
      rows:     result.data.rows,
      total:    result.data.total,
      page,
      pageSize: PAGE_SIZE,
    };
  } catch (err) {
    logger.error("[submissions-actions] listFormSubmissionsAction failed", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Kan inzendingen niet ophalen" };
  }
}

/**
 * Delete a single form submission for a tenant.
 */
export async function deleteFormSubmissionAction(
  tenantId:     string,
  submissionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();

    const client = getServiceClient();
    const result = await deleteFormSubmission(client, submissionId, tenantId);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath(`/admin/tenants/${tenantId}/forms/submissions`);
    return { ok: true };
  } catch (err) {
    logger.error("[submissions-actions] deleteFormSubmissionAction failed", {
      tenantId,
      submissionId,
      error: String(err),
    });
    return { ok: false, error: "Kan inzending niet verwijderen" };
  }
}

/**
 * Export all matching submissions as a CSV string.
 * Detects all unique value keys across all rows and builds headers dynamically.
 */
export async function exportFormSubmissionsAction(
  tenantId: string,
  params: {
    formKey?: string;
    from?:    string;
    to?:      string;
  },
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();

    // Fetch all rows (no pagination) for export.
    const input: ListFormSubmissionsInput = {
      tenantId,
      limit:  10000,
      offset: 0,
    };

    if (params.formKey) input.formKey = params.formKey;
    if (params.from)    input.from    = params.from;
    if (params.to)      input.to      = params.to;

    const client = getServiceClient();
    const result = await listFormSubmissions(client, input);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const rows = result.data.rows;

    if (rows.length === 0) {
      return { ok: true, csv: "id,created_at,form_key\n" };
    }

    // Collect all unique value keys across all rows.
    const valueKeys = Array.from(
      new Set(rows.flatMap((r) => Object.keys(r.values))),
    ).sort();

    // Build CSV with proper escaping.
    const escapeCell = (v: string): string => {
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };

    const header = ["id", "created_at", "form_key", ...valueKeys].map(escapeCell).join(",");

    const dataRows = rows.map((row) => {
      const cells: string[] = [
        escapeCell(row.id),
        escapeCell(row.created_at),
        escapeCell(row.form_key),
        ...valueKeys.map((k) => escapeCell(row.values[k] ?? "")),
      ];
      return cells.join(",");
    });

    return { ok: true, csv: [header, ...dataRows].join("\n") };
  } catch (err) {
    logger.error("[submissions-actions] exportFormSubmissionsAction failed", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Kan CSV niet exporteren" };
  }
}

/**
 * Save the GDPR retention setting for a tenant.
 * Uses a read-then-merge pattern to preserve all other settings.
 */
export async function saveRetentionSettingAction(
  tenantId:      string,
  retentionDays: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();

    // Read current settings.
    const current = await getTenantFormSettingsAction(tenantId);
    const base: TenantFormSettings = current.ok
      ? current.settings
      : { ...DEFAULT_TENANT_FORM_SETTINGS };

    // Merge the retention setting.
    const merged: TenantFormSettings = {
      ...base,
      submissionRetentionDays: retentionDays,
    };

    // Persist via raw upsert (mirrors saveFormBehaviorAction pattern).
    const client = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (client as any)
      .from("tenant_form_settings")
      .upsert(
        {
          tenant_id:  tenantId,
          settings:   merged as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };

    if (error) {
      return { ok: false, error: `Opslaan mislukt: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/forms`);
    return { ok: true };
  } catch (err) {
    logger.error("[submissions-actions] saveRetentionSettingAction failed", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Bewaartermijn opslaan mislukt" };
  }
}
