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
import { makeUnsubscribeToken } from "./unsubscribe-token";
import { sanitizeEmailHtml } from "./sanitize-email-html";
import { resolvePublicBaseUrl } from "@/lib/base-url";
import type { AbmLead } from "@/lib/abm/abm-store";
import type { EnrichmentOutput } from "@/enrichment/types";
import { DEFAULT_LOCALE } from "@/lib/locale";

export type EmailTemplateKey =
  | "abm_intro"
  | "application_followup"
  | "contact_followup"
  | "appointment_followup";

/**
 * One entry in an email template's ordered block list:
 *   - a string: an adaptive block key ("hero", …) or the email-native "footer";
 *   - a { text } object: plain free copy (escaped, newlines → <br>);
 *   - an { html } object: rich HTML authored in the WYSIWYG editor (sanitized;
 *     supports text, tables, images, links). Both support {name} / {company}.
 */
export type EmailBlockEntry = string | { readonly text: string } | { readonly html: string };

interface EmailTemplate {
  label:      string;
  blocks:     EmailBlockEntry[];  // adaptive keys + "footer" + free-text, in order
  subject:    string;     // may contain {name} / {company}
  preheader?: string;     // inbox preview text; may contain {name} / {company}
}

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  abm_intro:            { label: "ABM intro",             blocks: ["hero", "proof", "cta", "footer"], subject: "A quick idea for {company}",      preheader: "A tailored idea for {company}." },
  application_followup: { label: "Application follow-up",  blocks: ["hero", "cta", "footer"],          subject: "Thanks for applying, {name}",     preheader: "We received your application." },
  contact_followup:     { label: "Contact follow-up",     blocks: ["hero", "cta", "footer"],          subject: "Thanks for reaching out, {name}", preheader: "We got your message and will be in touch." },
  appointment_followup: { label: "Appointment follow-up", blocks: ["hero", "cta", "footer"],          subject: "Let's get your call set, {name}", preheader: "About your requested call with {company}." },
};

/**
 * Blocks an email template may include: adaptive content blocks (content comes
 * from the adaptive blocks library) plus the email-native "footer" (sender line
 * + unsubscribe link, rendered by the email layer, not the blocks library).
 */
export const EMAIL_BLOCK_KEYS = ["hero", "proof", "cta", "feature", "conversion", "notification", "footer"] as const;

/**
 * Effective template for a tenant: the per-tenant override (settings.emailTemplates)
 * layered over the code default. Subject, preheader, and the block set/order are
 * overridable — the adaptive block CONTENT still comes from the blocks library.
 */
export function resolveEmailTemplate(
  tenant: { emailTemplates?: Record<string, { subject?: string; blocks?: EmailBlockEntry[]; preheader?: string }> } | null,
  key: EmailTemplateKey,
): EmailTemplate {
  const base = EMAIL_TEMPLATES[key];
  const ov   = tenant?.emailTemplates?.[key];
  const validBlocks = (ov?.blocks ?? []).filter(
    (b) => (typeof b === "object" && b !== null
              && (("text" in b && typeof b.text === "string") || ("html" in b && typeof b.html === "string")))
      || (typeof b === "string" && (EMAIL_BLOCK_KEYS as readonly string[]).includes(b)),
  );
  return {
    label:     base.label,
    subject:   ov?.subject && ov.subject.trim() ? ov.subject.trim() : base.subject,
    preheader: ov?.preheader && ov.preheader.trim() ? ov.preheader.trim() : base.preheader,
    blocks:    validBlocks.length > 0 ? validBlocks : base.blocks,
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

function fillVars(str: string, lead: AbmLead | null): string {
  const name    = lead?.profile.firstName || lead?.profile.name || "there";
  const company = lead?.profile.company || "your team";
  return str.replace(/\{name\}/g, name).replace(/\{company\}/g, company);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Absolute base URL for a tenant's own site (for making email links absolute). */
function tenantBaseUrl(tenant: { primaryDomain?: string | null }): string {
  const dom = tenant.primaryDomain?.trim();
  if (dom) return /^https?:\/\//.test(dom) ? dom.replace(/\/$/, "") : `https://${dom}`;
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

/**
 * Rewrite root-relative href/src ("/signup") to absolute against `base`. Email
 * clients can't resolve relative URLs — they mangle them to "http:///signup".
 * Protocol-relative ("//"), absolute (http/https), mailto/tel are left untouched.
 */
function absolutizeLinks(html: string, base: string): string {
  if (!base) return html;
  return html
    .replace(/href="\/(?!\/)/g, `href="${base}/`)
    .replace(/src="\/(?!\/)/g, `src="${base}/`);
}

/**
 * Email-native footer: sender line + one-click unsubscribe link. Not an adaptive
 * block — rendered by the email layer so campaign/ABM sends are compliant.
 */
function renderEmailFooter(tenantId: string, tenantName: string, recipientEmail: string): string {
  // The unsubscribe endpoint lives on the PLATFORM, not the tenant's own site,
  // so resolve a stable platform base (NEXT_PUBLIC_SITE_URL → VERCEL production
  // host → deploy host). Always scheme-prefixed, so the link can never come out
  // relative — which email clients mangle into "http:///api/…".
  const base  = resolvePublicBaseUrl();
  const token = makeUnsubscribeToken(tenantId, recipientEmail);
  const url   = `${base}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
  return (
    `<div style="padding:24px 16px;margin-top:8px;text-align:center;color:#8a8a8a;font-size:12px;line-height:1.6;">` +
    `<p style="margin:0 0 4px">You're receiving this because you're in contact with ${escapeHtml(tenantName)}.</p>` +
    `<p style="margin:0"><a href="${url}" style="color:#8a8a8a;text-decoration:underline">Unsubscribe</a></p>` +
    `</div>`
  );
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
  const tmpl = resolveEmailTemplate(tenant as { emailTemplates?: Record<string, { subject?: string; blocks?: EmailBlockEntry[]; preheader?: string }> }, params.templateKey);
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
  const baseUrl = tenantBaseUrl(tenant as { primaryDomain?: string | null });
  const parts: string[] = [];
  const used:  string[] = [];
  for (const entry of tmpl.blocks) {
    // Operator-authored blocks: rich HTML (WYSIWYG) or plain text.
    if (typeof entry === "object" && entry !== null) {
      if ("html" in entry) {
        const clean = sanitizeEmailHtml(fillVars(entry.html ?? "", lead));
        if (clean.trim()) {
          parts.push(`<div style="padding:8px 24px;color:var(--text,#333333);font-size:15px;line-height:1.6;">${absolutizeLinks(clean, baseUrl)}</div>`);
          used.push("html");
        }
        continue;
      }
      const txt = fillVars(entry.text ?? "", lead).trim();
      if (txt) {
        parts.push(`<div style="padding:8px 24px;color:var(--text,#333333);font-size:15px;line-height:1.6;">${escapeHtml(txt).replace(/\n/g, "<br>")}</div>`);
        used.push("text");
      }
      continue;
    }
    const key = entry;
    if (key === "footer") {
      parts.push(renderEmailFooter(params.tenantId, tenant.name ?? params.tenantId, params.recipient.email));
      used.push("footer");
      continue;
    }
    let data: unknown = null;
    if      (key === "hero"         && plan.heroKey)         data = await cms.getHeroVariant(plan.heroKey).catch(() => null);
    else if (key === "proof"        && plan.proofKey)        data = await cms.getProofVariant(plan.proofKey).catch(() => null);
    else if (key === "cta"          && plan.ctaKey)          data = await cms.getCTAVariant(plan.ctaKey).catch(() => null);
    else if (key === "feature"      && plan.featureKey)      data = await cms.getFeatureVariant(plan.featureKey).catch(() => null);
    else if (key === "conversion"   && plan.conversionKey)   data = await cms.getConversionVariant(plan.conversionKey).catch(() => null);
    else if (key === "notification" && plan.notificationKey) data = await cms.getNotificationVariant(plan.notificationKey).catch(() => null);
    const html = data ? renderBlockHtml(key, data) : null;
    if (html) { parts.push(absolutizeLinks(html, baseUrl)); used.push(key); }
  }

  // 6. Theme tokens as a container style (email-safe: inline CSS vars, no <style>).
  const tokens = cssDeclarationsToRecord(resolvedThemeToCSS(resolveThemeForTenant(tenant, null)));
  const styleVars = Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";");
  const body =
    `<div style="${styleVars};max-width:640px;margin:0 auto;background:var(--bg,#ffffff);">` +
    parts.join("") +
    `</div>`;
  // Preheader: hidden inbox-preview text right after <body> (email convention).
  const preheaderText = tmpl.preheader ? fillVars(tmpl.preheader, lead) : "";
  const preheaderHtml = preheaderText
    ? `<span style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden">${escapeHtml(preheaderText)}</span>`
    : "";

  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f4f5f7;padding:24px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
    preheaderHtml +
    body +
    `</body></html>`;

  return { subject: fillVars(tmpl.subject, lead), html, usedBlocks: used, knownLead: !!lead };
}
