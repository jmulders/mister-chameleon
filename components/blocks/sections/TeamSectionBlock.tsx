/**
 * TeamSectionBlock
 *
 * A dedicated team-member showcase.  Distinct from the `team-grid` variant of
 * AboutBlock: TeamSectionBlock is a first-class block type that supports richer
 * member data (profile links, social handles) and can appear standalone on any page.
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   team_grid    — 3-col card grid with avatar, name, role, bio, and social links (default)
 *   team_compact — tight single-column list: avatar + name + role inline
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TeamSectionBlockData  { heading?, intro?, members[] }
 *   variant   TeamSectionVariant    see above
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg          Section background
 *   --section-subtle-bg   Avatar placeholder background
 *   --card-bg             Card background
 *   --card-border         Card border colour
 *   --card-radius         Card border-radius
 *   --text-brand          Role label accent / avatar initial colour
 *   --font-heading        Heading font family
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { TeamSectionVariant } from "@/page-config/block-variants";
import type { TeamSectionBlockData, TeamMemberItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface TeamSectionBlockProps {
  data:     TeamSectionBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Social icon links ─────────────────────────────────────────────────────────

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

// ── Member card (team_grid) ────────────────────────────────────────────────────

function MemberCard({ member }: { member: TeamMemberItem }) {
  const { name, role, bio, imageUrl, profileHref, socials } = member;

  const inner = (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {/* Avatar */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="h-20 w-20 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold"
          style={{
            background: "var(--primary-subtle)",
            color:      "var(--primary)",
          }}
        >
          {name.charAt(0)}
        </div>
      )}

      {/* Name + role */}
      <div>
        <Text variant="body" weight="semibold">{name}</Text>
        <Text
          variant="body-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {role}
        </Text>
      </div>

      {/* Bio */}
      {bio && (
        <Text variant="body-sm" color="muted" className="text-center">
          {bio}
        </Text>
      )}

      {/* Social links — mt-auto pushes them to the card bottom when bio is short */}
      {socials && (socials.linkedin || socials.twitter || socials.github) && (
        <div className="mt-auto flex items-center gap-3" style={{ color: "var(--text-muted, #6b7280)" }}>
          {socials.linkedin && (
            <a
              href={socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on LinkedIn`}
              className="transition-opacity hover:opacity-70"
            >
              <LinkedInIcon />
            </a>
          )}
          {socials.twitter && (
            <a
              href={socials.twitter}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on X / Twitter`}
              className="transition-opacity hover:opacity-70"
            >
              <TwitterIcon />
            </a>
          )}
          {socials.github && (
            <a
              href={socials.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on GitHub`}
              className="transition-opacity hover:opacity-70"
            >
              <GitHubIcon />
            </a>
          )}
        </div>
      )}
    </div>
  );

  // Wrap in a link if profileHref is provided.
  return profileHref ? (
    <a href={profileHref} className="block no-underline hover:opacity-90">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ── Compact row (team_compact) ─────────────────────────────────────────────────

function MemberRow({ member }: { member: TeamMemberItem }) {
  const { name, role, imageUrl, profileHref, socials } = member;

  const inner = (
    <div
      className="flex items-center gap-4 rounded-lg border px-5 py-4"
      style={{
        borderColor: "var(--card-border)",
      }}
    >
      {/* Avatar */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: "var(--primary-subtle)",
            color:      "var(--primary)",
          }}
        >
          {name.charAt(0)}
        </div>
      )}

      {/* Name + role */}
      <div className="flex-1">
        <Text variant="body" weight="semibold">{name}</Text>
        <Text variant="body-sm" color="muted">{role}</Text>
      </div>

      {/* Social links */}
      {socials && (socials.linkedin || socials.twitter || socials.github) && (
        <div className="flex items-center gap-2" style={{ color: "var(--text-muted, #6b7280)" }}>
          {socials.linkedin && (
            <a
              href={socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on LinkedIn`}
              className="transition-opacity hover:opacity-70"
            >
              <LinkedInIcon />
            </a>
          )}
          {socials.twitter && (
            <a
              href={socials.twitter}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on X / Twitter`}
              className="transition-opacity hover:opacity-70"
            >
              <TwitterIcon />
            </a>
          )}
          {socials.github && (
            <a
              href={socials.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on GitHub`}
              className="transition-opacity hover:opacity-70"
            >
              <GitHubIcon />
            </a>
          )}
        </div>
      )}
    </div>
  );

  return profileHref ? (
    <a href={profileHref} className="block no-underline hover:opacity-90">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function TeamSectionBlock({ data, variant: rawVariant, surface }: TeamSectionBlockProps) {
  const variant = resolveBlockVariant("teamSection", rawVariant) as TeamSectionVariant;
  const { heading, intro, members } = data;
  const items = members ?? [];

  // ── team_compact ───────────────────────────────────────────────────────────

  if (variant === "team_compact") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="md">
          <Stack gap={10}>
            {(heading || intro) && (
              <Stack gap={3} align="center">
                {heading && <Text variant="h2" align="center" style={{ fontFamily: "var(--font-heading)" }}>{heading}</Text>}
                {intro   && <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto">{intro}</Text>}
              </Stack>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-3">
                {items.map((member) => (
                  <MemberRow key={member.name} member={member} />
                ))}
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── team_grid (default) ────────────────────────────────────────────────────

  const cols = Math.min(items.length || 3, 4);

  return (
    <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="lg">
        <Stack gap={12}>
          {(heading || intro) && (
            <Stack gap={3} align="center">
              {heading && <Text variant="h2" align="center" style={{ fontFamily: "var(--font-heading)" }}>{heading}</Text>}
              {intro   && <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto">{intro}</Text>}
            </Stack>
          )}

          {items.length > 0 && (
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {items.map((member) => (
                <MemberCard key={member.name} member={member} />
              ))}
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
