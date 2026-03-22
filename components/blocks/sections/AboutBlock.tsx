/**
 * AboutBlock
 *
 * Renders an `about` page section — narrative copy with an optional feature
 * image. Three visual variants cover the most common marketing patterns:
 *
 *   default   — text above an optional image; standard editorial section
 *   split     — image and text side-by-side; image on the right by default
 *   team-grid — narrative copy above a grid of team-member cards
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      AboutBlockData  { heading?, body?, imageUrl?, imageAlt?, teamMembers? }
 *   variant   AboutVariant    "default" | "split" | "team-grid"
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
import type { AboutBlockData, TeamMember } from "@/page-config";

interface AboutBlockProps {
  data:     AboutBlockData;
  variant?: string;
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
        <Text variant="body-sm" style={{ color: "var(--text-brand)" }}>{member.role}</Text>
        {member.bio && (
          <Text variant="body-sm" color="muted" className="mt-1">{member.bio}</Text>
        )}
      </div>
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function AboutBlock({ data, variant: rawVariant }: AboutBlockProps) {
  const variant = resolveBlockVariant("about", rawVariant) as AboutVariant;
  const { heading, body, imageUrl, imageAlt, teamMembers } = data;
  const members = teamMembers ?? [];

  // ── split variant ──────────────────────────────────────────────────────────
  //
  // Image on the right, copy on the left. Ideal for a platform overview or
  // product highlight section mid-page.

  if (variant === "split") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

            {/* Text column */}
            <div className="flex-1">
              <Stack gap={6}>
                {heading && <Text variant="h2">{heading}</Text>}
                {body && body.length > 0 && (
                  <Text variant="body" color="muted">
                    {/* Portable Text rendered as plain text in this MVP layer */}
                    {body
                      .filter((b) => b._type === "block" && Array.isArray((b as { children?: unknown[] }).children))
                      .map((b) =>
                        ((b as { children?: { text?: string }[] }).children ?? [])
                          .map((s) => s.text ?? "")
                          .join(""),
                      )
                      .join(" ")}
                  </Text>
                )}
              </Stack>
            </div>

            {/* Image column */}
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
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={12}>
            <Stack gap={4} align="center">
              {heading && <Text variant="h2" align="center">{heading}</Text>}
              {body && body.length > 0 && (
                <Text variant="body" color="muted" align="center" className="max-w-2xl mx-auto">
                  {body
                    .filter((b) => b._type === "block" && Array.isArray((b as { children?: unknown[] }).children))
                    .map((b) =>
                      ((b as { children?: { text?: string }[] }).children ?? [])
                        .map((s) => s.text ?? "")
                        .join(""),
                    )
                    .join(" ")}
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
    <Section spacing="lg">
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

          {body && body.length > 0 && (
            <Text variant="body" color="muted" align="center">
              {body
                .filter((b) => b._type === "block" && Array.isArray((b as { children?: unknown[] }).children))
                .map((b) =>
                  ((b as { children?: { text?: string }[] }).children ?? [])
                    .map((s) => s.text ?? "")
                    .join(""),
                )
                .join(" ")}
            </Text>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
