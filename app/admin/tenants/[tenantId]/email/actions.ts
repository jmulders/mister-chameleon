"use server";

/**
 * Adaptive email — admin preview action (slice 1: render only, no send).
 * Renders the personalised email for a given recipient so an operator can see
 * exactly what a known lead would receive. Auth is enforced by the tenant
 * workspace layout (assertTenantAccess) and re-checked here.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/server";
import { renderAdaptiveEmail, EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email/adaptive-email";
import { sendAdaptiveEmail } from "@/lib/email/send-adaptive-email";
import { sendAdaptiveBatch, MAX_BATCH_RECIPIENTS, type BatchSendSummary } from "@/lib/email/send-adaptive-batch";
import { selectBatchRecipients, collectFilterOptions, type BatchRecipient, type BatchAudienceFilters } from "@/lib/email/batch-select";
import { listAbmLeads } from "@/lib/abm/abm-store";

export interface EmailPreviewResult {
  subject:    string;
  html:       string;
  knownLead:  boolean;
  usedBlocks: string[];
}

export async function previewAdaptiveEmailAction(
  tenantId: string, input: { email: string; templateKey: string },
): Promise<{ ok: true; data: EmailPreviewResult } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const email = input.email.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!(input.templateKey in EMAIL_TEMPLATES)) return { ok: false, error: "Unknown template." };

  try {
    const r = await renderAdaptiveEmail({
      tenantId,
      recipient:   { email },
      templateKey: input.templateKey as EmailTemplateKey,
    });
    return { ok: true, data: { subject: r.subject, html: r.html, knownLead: r.knownLead, usedBlocks: r.usedBlocks } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Preview failed." };
  }
}

/**
 * Send the personalised email to a TEST address (real delivery via Resend/SMTP),
 * while personalising for the entered recipient. Lets you verify end-to-end
 * without mailing a real lead.
 */
export async function sendTestAdaptiveEmailAction(
  tenantId: string, input: { email: string; templateKey: string; testTo: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const testTo = input.testTo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testTo)) return { ok: false, error: "Enter a valid test address." };
  if (!(input.templateKey in EMAIL_TEMPLATES)) return { ok: false, error: "Unknown template." };

  const r = await sendAdaptiveEmail({
    tenantId,
    recipient:   { email: input.email.trim() || testTo },
    templateKey: input.templateKey as EmailTemplateKey,
    to:          testTo,
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.skipped) return { ok: false, error: r.skipped === "suppressed" ? "That test address is suppressed." : "Already sent." };
  return { ok: true };
}

// ── Batch / ABM campaign ──────────────────────────────────────────────────────

export interface BatchAudienceResult {
  candidates:    BatchRecipient[];
  totalLeads:    number;
  withEmail:     number;
  industries:    string[];
  companySizes:  string[];
  capped:        boolean;
  maxRecipients: number;
}

/**
 * Compute the campaign audience for the tenant: known leads filtered to those
 * with a valid email, matching optional firmographic filters, de-duped by email.
 * Read-only — no email is sent here. The operator confirms the list, then calls
 * sendBatchAction with the chosen lead ids.
 */
export async function fetchBatchAudienceAction(
  tenantId: string, filters: BatchAudienceFilters = {},
): Promise<{ ok: true; data: BatchAudienceResult } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  try {
    const leads = await listAbmLeads(tenantId);
    const candidates = selectBatchRecipients(leads, filters);
    const withEmail = selectBatchRecipients(leads, { ...filters, industry: undefined, companySize: undefined }).length;
    return {
      ok: true,
      data: {
        candidates:    candidates.slice(0, MAX_BATCH_RECIPIENTS),
        totalLeads:    leads.length,
        withEmail,
        industries:    collectFilterOptions(leads, "industry"),
        companySizes:  collectFilterOptions(leads, "companySize"),
        capped:        candidates.length > MAX_BATCH_RECIPIENTS,
        maxRecipients: MAX_BATCH_RECIPIENTS,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load audience." };
  }
}

/**
 * Send the chosen template to the selected leads (real delivery). Suppression
 * and per-campaign dedupe are enforced by the send layer. The operator has
 * already reviewed the list; this is the confirmed, side-effectful step.
 */
export async function sendBatchAction(
  tenantId: string, input: { templateKey: string; leadIds: string[] },
): Promise<{ ok: true; data: BatchSendSummary } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  if (!(input.templateKey in EMAIL_TEMPLATES)) return { ok: false, error: "Unknown template." };
  const leadIds = [...new Set((input.leadIds ?? []).filter(Boolean))];
  if (leadIds.length === 0) return { ok: false, error: "Select at least one recipient." };
  if (leadIds.length > MAX_BATCH_RECIPIENTS) {
    return { ok: false, error: `Too many recipients — max ${MAX_BATCH_RECIPIENTS} per campaign.` };
  }

  // Re-resolve recipients server-side from the chosen ids (don't trust client emails).
  const leads = await listAbmLeads(tenantId);
  const byId = new Map(leads.map((l) => [l.id, l]));
  const chosen = leadIds.map((id) => byId.get(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const recipients = selectBatchRecipients(chosen, { activeOnly: false });
  if (recipients.length === 0) return { ok: false, error: "None of the selected leads have a valid email." };

  const summary = await sendAdaptiveBatch({
    tenantId,
    templateKey: input.templateKey as EmailTemplateKey,
    recipients,
  });
  return { ok: true, data: summary };
}

/**
 * Enable/disable the live form-submit trigger for this tenant (opt-in). When on,
 * a form submitter is emailed the chosen template after capture (deduped per lead).
 */
export async function setFormSubmitTriggerAction(
  tenantId: string, input: { enabled: boolean; templateKey: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  if (input.enabled && !(input.templateKey in EMAIL_TEMPLATES)) return { ok: false, error: "Unknown template." };
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await saveTenant({ ...tenant, adaptiveEmail: { onFormSubmit: { enabled: input.enabled, templateKey: input.templateKey } } } as any);
  revalidatePath(`/admin/tenants/${tenantId}/email`);
  return { ok: true };
}
