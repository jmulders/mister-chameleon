/**
 * Adaptive email — core (slice 1: render + preview, no send).
 *
 * For a KNOWN recipient, resolve personalisation context and render a small set
 * of blocks to email-safe HTML — reusing the same decision engine, block library
 * and renderer as the adaptive website/ads. Identity is known up front, so no IP
 * enrichment is needed: firmographics are seeded from the recipient's ABM lead.
 *
 * Pipeline (mirrors the decide route's CMS branch + the ads cost-safe context):
 *   recipient email → ABM lead (deterministic handle) → seedEnrichment
 *   → buildDecisionContext (synthetic Request, no staged enrichers = cost-safe)
 *   → ExperimentDecisionProvider(RulesDecisionProvider).getHomepagePlan
 *   → per template block: cms.get<Block>Variant(plan.<block>Key) → renderBlockHtml
 *   → wrap in a token-styled container → email HTML + subject.
 *
 * See docs/design/adaptive-email.md. Sending (Resend) is a later slice.
 */

import "server-only";

import { createHash } from "node:crypto";
import { getTenantById } from "@/tenant/server";
import { resolveThemeForTenant, resolvedThemeToCSS } from "@/tenant/server";
import { buildDecisionContext } from "@/decision/context/build-decision-context";
import { RulesDecisionProvider, ExperimentDecisionProvider } from "@/decision";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { createCMSProvider } from "@/cms";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";
import { getAbmLeadByHandle, getAbmLeadById } from "@/lib/abm/abm-store";
import type { AbmLead } from "@/lib/abm/abm-store";
import type { EnrichmentOutput } from "@/enrichment/types";
import { DEFAULT_LOCALE } from "@/lib/locale";

export type EmailTemplateKey = "abm_intro" | "application_followup";

interface EmailTemplate {
  label:   string;
  blocks:  string[];   // adaptive block keys, in order
  subject: string;     // may contain {name} / {company}
}

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  abm_intro:            { label: "ABM intro",            blocks: ["hero", "proof", "cta"], subject: "A quick idea for {company}" },
  application_followup: { label: "Application follow-up", blocks: ["hero", "cta"],          subject: "Thanks for applying, {name}" },
};

/** Adaptive block keys an email template may include (those renderAdaptiveEmail can render). */
export const EMAIL_BLOCK_KEYS = ["hero", "proof", "cta", "feature", "conversion", "notification"] as const;

/**
 * Effective template for a tenant: the per-tenant override (settings.emailTemplates)
 * layered over the code default. Only the subject and the block set/order are
 * overridable — the block CONTENT still comes from the adaptive blocks library.
 */
export function resolveEmailTemplate(
  tenant: { emailTemplates?: Record<string, { subject?: string; blocks?: string[] }> } | null,
  key: EmailTemplateKey,
): EmailTemplate {
  const base = EMAIL_TEMPLATES[key];
  const ov   = tenant?.emailTemplates?.[key];
  const validBlocks = ov?.blocks?.filter((b) => (EMAIL_BLOCK_KEYS as readonly string[]).includes(b)) ?? [];
  return {
    label:   base.label,
    subject: ov?.subject && ov.subject.trim() ? ov.subject.trim() : base.subject,
    blocks:  validBlocks.length > 0 ? validBlocks : base.blocks,
  };
}

export interface EmailRecipient {
  email:    string;
  /** Optional explicit ABM lead id; otherwise resolved from the email. */
  leadId?:  string;
}

export interface RenderedEmail {
  subject:    string;
  html:       string;
  usedBlocks: string[];
  knownLead:  boolean;
}

/** Deterministic ABM lead handle from an email (mirrors inbound form capture). */
function emailHandle(tenantId: string, email: string): string {
  return "form_" + createHash("sha256").update(`${tenantId}:${email.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

/** Parse a "--k: v;" CSS declaration block into a record (from resolvedThemeToCSS). */
function cssDeclarationsToRecord(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const k = m[1].trim(), v = m[2].trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function fillSubject(tmpl: EmailTemplate, lead: AbmLead | null): string {
  const name    = lead?.profile.firstName || lead?.profile.name || "there";
  const company = lead?.profile.company || "your team";
  return tmpl.subject.replace(/\{name\}/g, name).replace(/\{company\}/g, company);
}

/**
 * Render an adaptive email for a known recipient. Never sends — returns the
 * subject + HTML for preview (or, in a later slice, for a send helper).
 */
export async function renderAdaptiveEmail(params: {
  tenantId:    string;
  recipient:   EmailRecipient;
  templateKey: EmailTemplateKey;
  locale?:     string;
}): Promise<RenderedEmail> {
  if (!EMAIL_TEMPLATES[params.templateKey]) throw new Error(`Unknown email template: ${params.templateKey}`);

  const tenant = await getTenantById(params.tenantId);
  if (!tenant) throw new Error("Tenant not found.");
  // Effective template = per-tenant override (subject + block set) over the default.
  const tmpl = resolveEmailTemplate(tenant as { emailTemplates?: Record<string, { subject?: string; blocks?: string[] }> }, params.templateKey);
  const locale = params.locale ?? DEFAULT_LOCALE;

  // 1. Identity → known ABM lead (explicit id, else deterministic email handle).
  const lead: AbmLead | null = params.recipient.leadId
    ? await getAbmLeadById(params.recipient.leadId).catch(() => null)
    : await getAbmLeadByHandle(params.tenantId, emailHandle(params.tenantId, params.recipient.email)).catch(() => null);

  // 2. Cost-safe decision context (synthetic request, no staged enrichers).
  //    Firmographics are seeded from the known lead — no IP lookup needed.
  const url = new URL(`https://${params.tenantId}.email.local/${params.templateKey}`);
  const request = new Request(url.toString(), { headers: { "user-agent": "mc-email" } });
  const seed: Partial<EnrichmentOutput> = {};
  if (lead?.profile.company)     seed.companyName     = lead.profile.company;
  if (lead?.profile.industry)    seed.companyIndustry = lead.profile.industry;
  if (lead?.profile.companySize) seed.companySize     = lead.profile.companySize;

  const ctx = await buildDecisionContext({
    request,
    tenantId:       params.tenantId,
    templateKey:    params.templateKey,
    pageType:       "email",
    email:          params.recipient.email,
    sessionId:      params.recipient.email,
    seedEnrichment: seed,
  });

  // 3. Plan (rules + experiments), same as the web decision.
  const cfg = await loadTenantRulesConfig(params.tenantId).catch(() => null);
  const provider = new ExperimentDecisionProvider(
    new RulesDecisionProvider(cfg ?? undefined),
    params.recipient.email,
    tenant.experiments?.enabled ?? true,
    params.tenantId,
  );
  const plan = await provider.getHomepagePlan(ctx);

  // 4/5. Fetch winning variant content per template block and render it.
  const cms = createCMSProvider(tenant.cms, params.tenantId, locale);
  const parts: string[] = [];
  const used:  string[] = [];
  for (const key of tmpl.blocks) {
    let data: unknown = null;
    if      (key === "hero"         && plan.heroKey)         data = await cms.getHeroVariant(plan.heroKey).catch(() => null);
    else if (key === "proof"        && plan.proofKey)        data = await cms.getProofVariant(plan.proofKey).catch(() => null);
    else if (key === "cta"          && plan.ctaKey)          data = await cms.getCTAVariant(plan.ctaKey).catch(() => null);
    else if (key === "feature"      && plan.featureKey)      data = await cms.getFeatureVariant(plan.featureKey).catch(() => null);
    else if (key === "conversion"   && plan.conversionKey)   data = await cms.getConversionVariant(plan.conversionKey).catch(() => null);
    else if (key === "notification" && plan.notificationKey) data = await cms.getNotificationVariant(plan.notificationKey).catch(() => null);
    const html = data ? renderBlockHtml(key, data) : null;
    if (html) { parts.push(html); used.push(key); }
  }

  // 6. Theme tokens as a container style (email-safe: inline CSS vars, no <style>).
  const tokens = cssDeclarationsToRecord(resolvedThemeToCSS(resolveThemeForTenant(tenant, null)));
  const styleVars = Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";");
  const body =
    `<div style="${styleVars};max-width:640px;margin:0 auto;background:var(--bg,#ffffff);">` +
    parts.join("") +
    `</div>`;
  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f4f5f7;padding:24px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
    body +
    `</body></html>`;

  return { subject: fillSubject(tmpl, lead), html, usedBlocks: used, knownLead: !!lead };
}
