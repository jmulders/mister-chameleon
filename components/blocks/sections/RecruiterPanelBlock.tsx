/**
 * RecruiterPanelBlock
 *
 * Renders a `recruiterPanel` page section — the recruiter contact card that
 * appears on vacancy detail pages to give candidates a direct human contact.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      RecruiterPanelBlockData  { heading?, name, role?, bio?,
 *                                        avatarUrl?, email?, phone?,
 *                                        ctaLabel?, ctaHref? }
 *   variant   RecruiterPanelVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — full card: avatar + name/role/bio + contact row
 *   compact — minimal inline bar: avatar + name + contact badges
 *   card    — elevated card style for standalone placement
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background (default variant)
 *   --section-subtle-border  Section border colour
 *   --card-bg                Card background
 *   --card-border            Card border colour
 *   --card-radius            Card border-radius
 *   --card-shadow            Card box-shadow (card variant)
 *   --text                   Primary text colour
 *   --text-muted             Secondary text colour
 *   --text-brand             Link / CTA colour
 *   --font-subheading-weight Name font weight
 */

import { Container }           from "@/components/primitives/Container";
import { Section }             from "@/components/primitives/Section";
import { Stack }               from "@/components/primitives/Stack";
import { Text }                from "@/components/primitives/Text";
import { resolveBlockVariant }  from "@/page-config/block-variants";
import type { RecruiterPanelVariant } from "@/page-config/block-variants";
import type { RecruiterPanelBlockData } from "@/page-config";

interface RecruiterPanelBlockProps {
  data:     RecruiterPanelBlockData;
  variant?: string;
}

// ── Avatar subcomponent ───────────────────────────────────────────────────────

function Avatar({ src, name, size = "md" }: { src?: string; name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-9 w-9" : "h-14 w-14";
  const initial = name.charAt(0).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover shrink-0`}
        style={{ border: "2px solid var(--card-border)" }}
      />
    );
  }

  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center shrink-0 text-lg font-bold`}
      style={{
        background: "color-mix(in srgb, var(--text-brand) 15%, transparent)",
        color:      "var(--text-brand)",
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

// ── Contact links ─────────────────────────────────────────────────────────────

function ContactRow({ email, phone }: { email?: string; phone?: string }) {
  if (!email && !phone) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-1.5 text-sm transition-colors hover:underline"
          style={{ color: "var(--text-brand)" }}
        >
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
            <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
          </svg>
          {email}
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex items-center gap-1.5 text-sm transition-colors hover:underline"
          style={{ color: "var(--text-brand)" }}
        >
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
              clipRule="evenodd"
            />
          </svg>
          {phone}
        </a>
      )}
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function RecruiterPanelBlock({ data, variant: rawVariant }: RecruiterPanelBlockProps) {
  const variant  = resolveBlockVariant("recruiterPanel", rawVariant) as RecruiterPanelVariant;
  const { heading, name, role, bio, avatarUrl, email, phone, ctaLabel, ctaHref } = data;

  // ── compact variant ──────────────────────────────────────────────────────────
  //
  // Minimal inline bar: avatar + name + contact badges.
  // Good for sidebar embeds or below vacancy title sections.

  if (variant === "compact") {
    return (
      <Section spacing="sm">
        <Container size="md">
          <div
            className="flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor:     "var(--card-border)",
            }}
          >
            <Avatar src={avatarUrl} name={name} size="sm" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className="text-sm"
                style={{
                  fontWeight: "var(--font-subheading-weight)",
                  color:      "var(--text)",
                }}
              >
                {name}
              </span>
              {role && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {role}
                </span>
              )}
            </div>
            <div className="ml-auto">
              <ContactRow email={email} phone={phone} />
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  // ── card variant ─────────────────────────────────────────────────────────────
  //
  // Elevated card style; the section has no background — the card itself
  // provides the visual container.  Ideal for standalone placement.

  if (variant === "card") {
    return (
      <Section spacing="lg">
        <Container size="md">
          {heading && (
            <Text variant="h2" className="mb-8 text-center">
              {heading}
            </Text>
          )}

          <div
            className="rounded-xl border p-8"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor:     "var(--card-border)",
              boxShadow:       "var(--card-shadow)",
            }}
          >
            <Stack gap={6}>
              <div className="flex items-center gap-4">
                <Avatar src={avatarUrl} name={name} size="lg" />
                <div className="flex flex-col gap-1">
                  <Text variant="h3">{name}</Text>
                  {role && <Text variant="body" color="muted">{role}</Text>}
                </div>
              </div>

              {bio && (
                <Text variant="body" color="muted" className="leading-relaxed">
                  {bio}
                </Text>
              )}

              <ContactRow email={email} phone={phone} />

              {ctaLabel && ctaHref && (
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:underline"
                  style={{ color: "var(--text-brand)" }}
                >
                  {ctaLabel}
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
            </Stack>
          </div>
        </Container>
      </Section>
    );
  }

  // ── default variant ──────────────────────────────────────────────────────────
  //
  // Full card on a subtle-bg section: avatar + name/role/bio + contact row.

  return (
    <Section
      spacing="lg"
      style={{
        background:          "var(--section-subtle-bg)",
        borderTopColor:    "var(--section-subtle-border)",
        borderBottomColor: "var(--section-subtle-border)",
      }}
      className="border-y"
    >
      <Container size="md">
        <Stack gap={8}>
          {heading && (
            <Text variant="h2" align="center">
              {heading}
            </Text>
          )}

          <div
            className="rounded-xl border p-8"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor:     "var(--card-border)",
            }}
          >
            <Stack gap={6}>
              <div className="flex items-center gap-5">
                <Avatar src={avatarUrl} name={name} size="lg" />
                <div className="flex flex-col gap-1">
                  <Text variant="h3">{name}</Text>
                  {role && <Text variant="body" color="muted">{role}</Text>}
                </div>
              </div>

              {bio && (
                <Text variant="body" color="muted" className="leading-relaxed">
                  {bio}
                </Text>
              )}

              <ContactRow email={email} phone={phone} />

              {ctaLabel && ctaHref && (
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:underline"
                  style={{ color: "var(--text-brand)" }}
                >
                  {ctaLabel}
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
            </Stack>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
