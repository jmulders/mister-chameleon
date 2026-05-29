/**
 * AboutBlock
 *
 * Renders an `about` page section — narrative copy with an optional feature
 * image.
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   media_right — text left, image right (default media layout)
 *   media_left  — image left, text right
 *   media_full  — full-width image above text
 *
 *   Legacy variants:
 *   default   — text above an optional image; standard editorial section
 *   split     → media_right (alias)
 *   team-grid — narrative copy above a grid of team-member cards
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      AboutBlockData  { heading?, body?, imageUrl?, imageAlt?, teamMembers? }
 *   variant   AboutVariant    see above
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg          Default section background
 *   --section-subtle-bg   Subtle section background (team-grid card rows)
 *   --card-bg             Team member card background
 *   --card-border         Team member card border
 *   --card-radius         Team member card border-radius
 *   --text-brand          Accent colour on team member role label
 *   --font-heading        Heading font family
 */

import { Container } from "@/components/primitives/Container";
import { Section }   from "@/components/primitives/Section";
import { Stack }     from "@/components/primitives/Stack";
import { Text }      from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { AboutVariant }   from "@/page-config/block-variants";
import type { AboutBlockData, TeamMember, BlockCTA } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface AboutBlockProps {
  data:     AboutBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Team member card ──────────────────────────────────────────────────────────

function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {member.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.imageUrl}
          alt={member.name}
          className="h-16 w-16 rounded-full object-cover"
        />
      )}
      {!member.imageUrl && (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: "var(--section-subtle-bg)", color: "var(--text-brand)" }}
        >
          {member.name.charAt(0)}
        </div>
      )}
      <div>
        <Text variant="body" weight="semibold">{member.name}</Text>
        <Text variant="body-sm" style={{ color: "var(--text-muted)" }}>{member.role}</Text>
        {member.bio && (
          <Text variant="body-sm" color="muted" className="mt-1">{member.bio}</Text>
        )}
      </div>
    </div>
  );
}

// ── CTA row ───────────────────────────────────────────────────────────────────

/**
 * Renders 0–2 CTA buttons in a flex row.
 * Position-based variant defaults: idx 0 → primary, idx 1 → secondary.
 */
function AboutCTARow({ ctas }: { ctas?: readonly BlockCTA[] }) {
  const visible = (ctas ?? []).slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {visible.map((cta, i) => {
        const v = cta.variant ?? (i === 0 ? "primary" : "secondary");
        const isPrimary = v === "primary";
        return (
          <a
            key={cta.href}
            href={cta.href}
            className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={
              isPrimary
                ? { background: "var(--text-brand)", color: "white" }
                : { background: "var(--bg-subtle)", color: "var(--text)" }
            }
          >
            {cta.label}
          </a>
        );
      })}
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

// ── Shared plain-text body extractor ─────────────────────────────────────────
// AboutBlock uses a simple plain-text rendering for the body in split layouts.
// Full Portable Text rendering is available through PortableTextRenderer — this
// light-weight extractor avoids pulling that dependency into every variant.

function extractPlainText(body: AboutBlockData["body"]): string {
  if (!body) return "";
  return body
    .filter((b) => b._type === "block" && Array.isArray((b as { children?: unknown[] }).children))
    .map((b) =>
      ((b as { children?: { text?: string }[] }).children ?? [])
        .map((s) => s.text ?? "")
        .join(""),
    )
    .join(" ");
}

export function AboutBlock({ data, variant: rawVariant, surface }: AboutBlockProps) {
  const resolved = resolveBlockVariant("about", rawVariant) as AboutVariant;
  const { heading, body, imageUrl, imageAlt, teamMembers, ctas } = data;
  const members   = teamMembers ?? [];
  const bodyText  = extractPlainText(body);

  // Normalise canonical spec names → implementation keys.
  // media_right → split (text left, image right)
  // media_left  → media_left (new layout; image left, text right)
  // media_full  → media_full (new layout; full-width image above text)
  const variant: AboutVariant = (
    resolved === "media_right" ? "split"      :
    resolved
  ) as AboutVariant;

  // ── media_left variant ─────────────────────────────────────────────────────
  //
  // Image on the left, text on the right.

  if (variant === "media_left") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

            {/* Image column — left */}
            {imageUrl && (
              <div className="w-full flex-shrink-0 lg:w-1/2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={imageAlt ?? heading ?? ""}
                  className="w-full rounded-xl object-cover shadow-md"
                  style={{ maxHeight: "420px" }}
                />
              </div>
            )}

            {/* Text column — right */}
            <div className="flex-1">
              <Stack gap={6}>
                {heading && <Text variant="h2">{heading}</Text>}
                {bodyText && (
                  <Text variant="body" color="muted">
                    {bodyText}
                  </Text>
                )}
                <AboutCTARow ctas={ctas} />
              </Stack>
            </div>

          </div>
        </Container>
      </Section>
    );
  }

  // ── media_full variant ─────────────────────────────────────────────────────
  //
  // Full-width image displayed above the text content.

  if (variant === "media_full") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={10}>
            {/* Full-width image */}
            {imageUrl && (
              <div className="w-full overflow-hidden rounded-xl shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={imageAlt ?? heading ?? ""}
                  className="w-full object-cover"
                  style={{ maxHeight: "480px" }}
                />
              </div>
            )}

            {/* Text below */}
            <Stack gap={4} align="center">
              {heading && <Text variant="h2" align="center">{heading}</Text>}
              {bodyText && (
                <Text variant="body" color="muted" align="center" className="max-w-2xl mx-auto">
                  {bodyText}
                </Text>
              )}
              <AboutCTARow ctas={ctas} />
            </Stack>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── split variant ──────────────────────────────────────────────────────────
  //
  // Image on the right, copy on the left. Ideal for a platform overview or
  // product highlight section mid-page.

  if (variant === "split") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

            {/* Text column — left */}
            <div className="flex-1">
              <Stack gap={6}>
                {heading && <Text variant="h2">{heading}</Text>}
                {bodyText && (
                  <Text variant="body" color="muted">
                    {bodyText}
                  </Text>
                )}
                <AboutCTARow ctas={ctas} />
              </Stack>
            </div>

            {/* Image column — right */}
            {imageUrl && (
              <div className="w-full flex-shrink-0 lg:w-1/2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={imageAlt ?? heading ?? ""}
                  className="w-full rounded-xl object-cover shadow-md"
                  style={{ maxHeight: "420px" }}
                />
              </div>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  // ── team-grid variant ──────────────────────────────────────────────────────
  //
  // Narrative copy above a responsive grid of team-member cards.

  if (variant === "team-grid") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={12}>
            <Stack gap={4} align="center">
              {heading && <Text variant="h2" align="center">{heading}</Text>}
              {bodyText && (
                <Text variant="body" color="muted" align="center" className="max-w-2xl mx-auto">
                  {bodyText}
                </Text>
              )}
            </Stack>

            {members.length > 0 && (
              <div
                className="grid gap-6"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(members.length, 4)}, minmax(0, 1fr))`,
                }}
              >
                {members.map((m) => (
                  <TeamMemberCard key={m.name} member={m} />
                ))}
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ────────────────────────────────────────────────────────
  //
  // Text section with an optional image below the heading.

  return (
    <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="md">
        <Stack gap={8} align="center">
          {heading && <Text variant="h2" align="center">{heading}</Text>}

          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt ?? heading ?? ""}
              className="w-full rounded-xl object-cover shadow-sm"
              style={{ maxHeight: "380px" }}
            />
          )}

          {bodyText && (
            <Text variant="body" color="muted" align="center">
              {bodyText}
            </Text>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
