/**
 * render-block-html
 *
 * Server-side rendering of an adaptive variant to a SELF-CONTAINED HTML string,
 * for the snippet's block mode (data-mc-block). Unlike the platform's own React
 * block components (Tailwind classes that only exist on our site), this output
 * is injected into an ARBITRARY external page (a WordPress site, etc.), so it
 * carries all its styling inline.
 *
 * Theming: colours/spacing reference CSS custom properties (`var(--primary)`,
 * `var(--hero-bg)`, …) with hard-coded fallbacks. The decide route sets those
 * variables on the `data-mc-block` container (via BlockSlot.tokens, sourced from
 * the tenant's active theme), so the block adopts the tenant's look while still
 * rendering acceptably if a variable is missing.
 *
 * All variant text is HTML-escaped — it originates in the tenant's CMS, but we
 * treat it as untrusted and never inject raw markup.
 */

import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
} from "@/cms/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Escape a string for safe interpolation into HTML text / attribute context. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s), root-relative, mailto and tel hrefs — never javascript:. */
function safeHref(href: unknown): string {
  const s = String(href ?? "").trim();
  if (!s) return "#";
  if (/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(s)) return escapeHtml(s);
  return "#";
}

const WRAP =
  "box-sizing:border-box;max-width:1120px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,4vw,32px);" +
  // Inherit the host page's typography so the block reads as native to the site.
  // Colours/radius still come from the tenant's design tokens (scoped vars).
  "font-family:inherit;";

/** A primary button. */
function button(label: string, href: unknown, variant: "primary" | "ghost" = "primary"): string {
  const base =
    "display:inline-block;padding:12px 22px;border-radius:var(--btn-radius,var(--radius-interactive,8px));" +
    "font-weight:600;font-size:15px;text-decoration:none;line-height:1;transition:opacity .15s;";
  const style = variant === "primary"
    ? base + "background:var(--primary,#4f46e5);color:var(--primary-text,#fff);border:1px solid transparent;"
    : base + "background:transparent;color:var(--text,#0f172a);border:1px solid var(--border,#e2e8f0);";
  return `<a href="${safeHref(href)}" style="${style}">${escapeHtml(label)}</a>`;
}

// ── Per-block renderers ───────────────────────────────────────────────────────

function renderHero(d: HeroBlockData): string {
  const ctas = (d.ctas ?? []).filter((c) => c && c.label);
  const buttons = ctas
    .map((c, i) => button(c.label!, c.href, i === 0 ? "primary" : "ghost"))
    .join("");
  return (
    `<section style="background:var(--hero-bg,#0f172a);color:var(--hero-title-color,#fff);">` +
      `<div style="${WRAP}text-align:center;">` +
        (d.tag
          ? `<span style="display:inline-block;background:var(--accent,rgba(255,255,255,.12));color:var(--primary,#c7d2fe);` +
            `border-radius:999px;padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:16px;">${escapeHtml(d.tag)}</span>`
          : "") +
        (d.title
          ? `<h1 style="font-family:inherit;font-size:clamp(28px,5vw,46px);line-height:1.1;font-weight:800;margin:0 0 14px;">${escapeHtml(d.title)}</h1>`
          : "") +
        (d.subtitle
          ? `<p style="color:var(--hero-subtitle-color,#94a3b8);font-size:clamp(16px,2.2vw,19px);line-height:1.5;max-width:64ch;margin:0 auto 24px;">${escapeHtml(d.subtitle)}</p>`
          : "") +
        (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">${buttons}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

function renderProof(d: ProofBlockData): string {
  const items = (d.items ?? []).filter((i) => i && (i.title || i.text));
  const cards = items
    .map(
      (i) =>
        `<div style="flex:1 1 240px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
        `border-radius:var(--card-radius,14px);padding:20px 22px;">` +
          (i.title ? `<div style="font-size:24px;font-weight:800;color:var(--primary,#4f46e5);margin-bottom:6px;">${escapeHtml(i.title)}</div>` : "") +
          (i.text ? `<div style="font-size:14px;line-height:1.55;color:var(--muted-foreground,#64748b);">${escapeHtml(i.text)}</div>` : "") +
        `</div>`,
    )
    .join("");
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 28px;">${escapeHtml(d.title)}</h2>` : "") +
        `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>` +
      `</div>` +
    `</section>`
  );
}

function renderCta(d: CTABlockData): string {
  const cta = d.cta;
  return (
    `<section style="background:var(--section-cta-bg,var(--primary,#4f46e5));color:var(--primary-text,#fff);">` +
      `<div style="${WRAP}text-align:center;">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,4vw,34px);font-weight:800;margin:0 0 12px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.text ? `<p style="font-size:clamp(15px,2.2vw,18px);line-height:1.5;opacity:.92;max-width:56ch;margin:0 auto 22px;">${escapeHtml(d.text)}</p>` : "") +
        (cta && cta.label
          ? `<a href="${safeHref(cta.href)}" style="display:inline-block;background:var(--card-bg,#fff);color:var(--primary,#4f46e5);` +
            `padding:13px 26px;border-radius:var(--btn-radius,var(--radius-interactive,8px));font-weight:700;font-size:15px;text-decoration:none;">${escapeHtml(cta.label)}</a>`
          : "") +
      `</div>` +
    `</section>`
  );
}

function renderFeature(d: FeatureBlockData): string {
  const items = (d.items ?? []).filter((i) => i && (i.title || i.body));
  const cards = items
    .map(
      (i) =>
        `<div style="flex:1 1 260px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
        `border-radius:var(--card-radius,14px);padding:22px 24px;">` +
          (i.title ? `<div style="font-size:17px;font-weight:700;color:var(--text,#0f172a);margin-bottom:8px;">${escapeHtml(i.title)}</div>` : "") +
          (i.body ? `<div style="font-size:14.5px;line-height:1.55;color:var(--muted-foreground,#64748b);">${escapeHtml(i.body)}</div>` : "") +
        `</div>`,
    )
    .join("");
  return (
    `<section style="background:var(--feature-grid-bg,var(--bg-subtle,#f8fafc));color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 8px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.subtitle ? `<p style="text-align:center;color:var(--muted-foreground,#64748b);font-size:16px;max-width:60ch;margin:0 auto 28px;">${escapeHtml(d.subtitle)}</p>` : "") +
        `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>` +
      `</div>` +
    `</section>`
  );
}

function renderConversion(d: ConversionBlockData): string {
  const ctas = (d.ctas ?? []).filter((c) => c && c.label);
  const buttons = ctas.map((c, i) => button(c.label!, c.href, i === 0 ? "primary" : "ghost")).join("");
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}text-align:center;max-width:760px;">` +
        (d.urgencyLabel
          ? `<span style="display:inline-block;background:var(--accent,#eef2ff);color:var(--primary,#4f46e5);border-radius:999px;` +
            `padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;margin-bottom:14px;">${escapeHtml(d.urgencyLabel)}</span>`
          : "") +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,4vw,34px);font-weight:800;margin:0 0 12px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.text ? `<p style="font-size:clamp(15px,2.2vw,18px);line-height:1.5;color:var(--muted-foreground,#64748b);margin:0 auto 22px;">${escapeHtml(d.text)}</p>` : "") +
        (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">${buttons}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

function renderNotification(d: NotificationBlockData): string {
  const sev = String(d.severity ?? "info");
  const accent =
    sev === "success" ? "#16a34a" : sev === "warning" ? "#d97706" : sev === "error" ? "#dc2626" : "var(--primary,#4f46e5)";
  const cta = d.ctaLabel
    ? ` <a href="${safeHref(d.ctaHref)}" style="color:${accent};font-weight:700;text-decoration:underline;">${escapeHtml(d.ctaLabel)}</a>`
    : "";
  return (
    `<div style="box-sizing:border-box;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
    `border-left:4px solid ${accent};border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;` +
    `font-family:inherit;color:var(--text,#0f172a);font-size:14.5px;line-height:1.5;">` +
      `<span>${escapeHtml(d.message)}${cta}</span>` +
    `</div>`
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Render a variant to self-contained HTML for the given block slot key.
 * Returns `null` for an unknown key or when the data yields no content.
 */
export function renderBlockHtml(slotKey: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  let html: string;
  switch (slotKey) {
    case "hero":         html = renderHero(data as HeroBlockData); break;
    case "proof":        html = renderProof(data as ProofBlockData); break;
    case "cta":          html = renderCta(data as CTABlockData); break;
    case "feature":      html = renderFeature(data as FeatureBlockData); break;
    case "conversion":   html = renderConversion(data as ConversionBlockData); break;
    case "notification": html = renderNotification(data as NotificationBlockData); break;
    default:             return null;
  }
  // A block with no fields renders to just the empty shell — treat as nothing.
  return /<(h1|h2|p|div|span|a)[ >]/.test(html) && html.replace(/<[^>]+>/g, "").trim() !== ""
    ? html
    : null;
}
