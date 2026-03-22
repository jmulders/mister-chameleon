/**
 * ApplyPanelBlock
 *
 * Renders an `applyPanel` content block — the primary application
 * call-to-action for a vacancy detail page.
 *
 * ─── Two integration patterns ─────────────────────────────────────────────────
 *
 *   External ATS  — `primaryCta.href` links to Greenhouse, Lever, Workday,
 *                   etc.  The component renders a standard CTA button.
 *
 *   Platform form — `formKey` references a registered FormKey
 *                   (e.g. "application").  The `FormSectionBlock` is rendered
 *                   inline so candidates apply without leaving the page.
 *                   When both formKey and primaryCta are set, the form takes
 *                   precedence and the primaryCta is shown as a fallback link.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ApplyPanelBlockData   { heading?, body?, primaryCta?,
 *                                     secondaryCta?, formKey?, closingDate? }
 *   variant   ApplyPanelVariant     see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default   — Full-width section with centred heading, body, urgency callout,
 *               and CTA button(s).  Standard vacancy footer.
 *
 *   inline    — Card embedded mid-page, e.g. between description sections.
 *               Same content but in a bordered card rather than a full section.
 *
 *   sticky    — Same as default.  Reserved for a future fixed-bottom bar on
 *               scroll implementation.
 *
 * ─── Urgency callout ─────────────────────────────────────────────────────────
 *
 *   When `closingDate` is set and the deadline is within 14 days, a warning
 *   callout is rendered above the CTA buttons to convey urgency.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --section-cta-bg / --section-cta-body
 *   --card-bg / --card-border / --card-radius
 *   --btn-bg / --btn-text / --btn-hover-bg / --btn-radius / --btn-shadow / --btn-font-weight
 *   --text / --text-muted
 *   --color-error-500
 *   --font-heading / --font-heading-weight
 *   --transition-base
 */

import { Container }              from "@/components/primitives/Container";
import { Section }                from "@/components/primitives/Section";
import { Stack }                  from "@/components/primitives/Stack";
import { resolveBlockVariant }    from "@/page-config/block-variants";
import type { ApplyPanelVariant } from "@/page-config/block-variants";
import type { ApplyPanelBlockData } from "@/page-config";
import { FormSectionBlock }       from "@/components/blocks/sections/FormSectionBlock";
import { isFormKey }              from "@/forms";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ApplyPanelBlockProps {
  data:     ApplyPanelBlockData;
  variant?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(iso: string): number | null {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const deadline = new Date(y, m - 1, d);
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

function UrgencyCallout({ closingDate }: { closingDate: string }) {
  const days = daysUntil(closingDate);
  if (days === null || days > 14 || days < 0) return null;

  const message =
    days === 0 ? "Applications close today."
    : days === 1 ? "Applications close tomorrow."
    : `Applications close in ${days} days.`;

  return (
    <div
      role="alert"
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "0.5rem",
        padding:         "0.75rem 1rem",
        backgroundColor: "color-mix(in srgb, var(--color-error-500, #ef4444) 10%, transparent)",
        border:          "1px solid color-mix(in srgb, var(--color-error-500, #ef4444) 30%, transparent)",
        borderRadius:    "var(--card-radius)",
        fontSize:        "0.875rem",
        fontWeight:      600,
        color:           "var(--color-error-500, #ef4444)",
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
      >
        <path d="M8 1L15 13H1L8 1z" />
        <path d="M8 6v3M8 11v.5" />
      </svg>
      {message}
    </div>
  );
}

function PrimaryButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "0.75rem 2rem",
        backgroundColor: "var(--btn-bg)",
        color:           "var(--btn-text)",
        fontWeight:      "var(--btn-font-weight)",
        fontSize:        "1rem",
        borderRadius:    "var(--btn-radius)",
        boxShadow:       "var(--btn-shadow)",
        textDecoration:  "none",
        transition:      "background-color var(--transition-base)",
        border:          "none",
        cursor:          "pointer",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--btn-hover-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--btn-bg)"; }}
    >
      {label}
    </a>
  );
}

function SecondaryButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "0.75rem 1.5rem",
        backgroundColor: "transparent",
        color:           "var(--text)",
        fontWeight:      500,
        fontSize:        "0.9375rem",
        borderRadius:    "var(--btn-radius)",
        textDecoration:  "none",
        border:          "1px solid var(--card-border)",
        transition:      "border-color var(--transition-base), color var(--transition-base)",
        cursor:          "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--text-muted)";
        (e.currentTarget as HTMLAnchorElement).style.color       = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--card-border)";
        (e.currentTarget as HTMLAnchorElement).style.color       = "var(--text)";
      }}
    >
      {label}
    </a>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplyPanelBlock({ data, variant: rawVariant }: ApplyPanelBlockProps) {
  const variant = resolveBlockVariant("applyPanel", rawVariant) as ApplyPanelVariant;

  const heading = data.heading ?? "Apply for this role";
  const body    = data.body;

  // If formKey is valid, render the form inline.
  const hasForm = Boolean(data.formKey && isFormKey(data.formKey));

  // ── Inline form content ────────────────────────────────────────────────────
  //
  // When a formKey is present, delegate entirely to FormSectionBlock using
  // the "minimal" variant so it flows without double section wrapping.
  if (hasForm) {
    return (
      <div style={{ borderTop: "1px solid var(--card-border)" }}>
        <FormSectionBlock
          data={{
            formKey:      data.formKey!,
            title:        heading,
            intro:        body,
            submitLabel:  "Submit application",
          }}
          variant="minimal"
        />
      </div>
    );
  }

  // ── Shared panel content (CTA-only path) ───────────────────────────────────

  const panelContent = (
    <Stack gap={5} align="center">
      <h2
        style={{
          margin:     0,
          fontSize:   "clamp(1.375rem, 3vw, 2rem)",
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--font-heading-weight)",
          color:      variant === "default" ? "var(--section-cta-body, #fff)" : "var(--text)",
          textAlign:  "center",
          lineHeight: 1.25,
        }}
      >
        {heading}
      </h2>

      {body && (
        <p
          style={{
            margin:    0,
            fontSize:  "1rem",
            color:     variant === "default" ? "color-mix(in srgb, var(--section-cta-body, #fff) 80%, transparent)" : "var(--text-muted)",
            lineHeight: 1.6,
            textAlign: "center",
            maxWidth:  "40ch",
          }}
        >
          {body}
        </p>
      )}

      {data.closingDate && (
        <UrgencyCallout closingDate={data.closingDate} />
      )}

      {/* CTA buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
        {data.primaryCta && (
          <PrimaryButton label={data.primaryCta.label} href={data.primaryCta.href} />
        )}
        {data.secondaryCta && (
          <SecondaryButton label={data.secondaryCta.label} href={data.secondaryCta.href} />
        )}
        {!data.primaryCta && !data.secondaryCta && (
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
            No application link configured.
          </p>
        )}
      </div>
    </Stack>
  );

  // ── inline variant — card ─────────────────────────────────────────────────
  if (variant === "inline") {
    return (
      <Section spacing="md" style={{ background: "var(--bg)" }}>
        <Container size="md">
          <div
            style={{
              backgroundColor: "var(--card-bg)",
              border:          "1px solid var(--card-border)",
              borderRadius:    "var(--card-radius)",
              padding:         "2.5rem 2rem",
              textAlign:       "center",
            }}
          >
            {panelContent}
          </div>
        </Container>
      </Section>
    );
  }

  // ── default / sticky — full-width CTA section ─────────────────────────────
  return (
    <Section
      spacing="xl"
      style={{ background: "var(--section-cta-bg)", textAlign: "center" }}
    >
      <Container size="md">
        {panelContent}
      </Container>
    </Section>
  );
}
