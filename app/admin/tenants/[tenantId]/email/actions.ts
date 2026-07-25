"use server";

/**
 * Adaptive email — admin preview action (slice 1: render only, no send).
 * Renders the personalised email for a given recipient so an operator can see
 * exactly what a known lead would receive. Auth is enforced by the tenant
 * workspace layout (assertTenantAccess) and re-checked here.
 */

import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { renderAdaptiveEmail, EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email/adaptive-email";

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
