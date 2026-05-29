/**
 * PricingSectionBlock
 *
 * Renders a `pricingSection` page section — a set of pricing tiers displayed
 * as elevated cards.  Supports a section heading/subheading, an optional
 * legal footnote, and a highlighted "most popular" tier.
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   pricing_tiers   — elevated card grid, one card per tier (default)
 *   pricing_compact — simplified row list with price inline; lower footprint
 *   pricing_table   — comparison table; tiers as columns, features as rows
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      PricingSectionBlockData  { heading?, subheading?, tiers[], footnote? }
 *   variant   PricingSectionVariant    see above
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg          Default section background
 *   --section-subtle-bg   Subtle section background (non-highlighted tiers)
 *   --card-bg             Card background (highlighted tier)
 *   --card-border         Card border colour
 *   --card-radius         Card border-radius
 *   --text-brand          Accent colour for badge, highlight border, check icons
 *   --font-heading        Heading font family
 */

import { Container }             from "@/components/primitives/Container";
import { Section }               from "@/components/primitives/Section";
import { Stack }                 from "@/components/primitives/Stack";
import { Text }                  from "@/components/primitives/Text";
import { resolveBlockVariant }   from "@/page-config/block-variants";
import type { PricingSectionVariant } from "@/page-config/block-variants";
import type { PricingSectionBlockData, PriceTier } from "@/page-config";
import { PricingCartButton }     from "@/components/blocks/sections/PricingCartButton";

interface PricingSectionBlockProps {
  data:     PricingSectionBlockData;
  variant?: string;
}

// ── Check icon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0"
      style={{ color: "var(--primary)" }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Tier card (pricing_tiers variant) ─────────────────────────────────────────

function TierCard({ tier }: { tier: PriceTier }) {
  const { name, price, period, description, features, ctaLabel, ctaHref, highlighted, badge } = tier;

  return (
    <div
      className="relative flex flex-col rounded-xl border p-8"
      style={{
        backgroundColor: highlighted ? "var(--card-bg, white)" : "var(--section-subtle-bg)",
        borderColor:     highlighted ? "var(--text-brand)"      : "var(--card-border)",
        borderRadius:    "var(--card-radius)",
        boxShadow:       highlighted ? "0 4px 24px 0 rgba(0,0,0,0.10)" : undefined,
      }}
    >
      {/* Badge */}
      {badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: "var(--text-brand)",
            color:      "white",
          }}
        >
          {badge}
        </span>
      )}

      {/* Tier header */}
      <div className="mb-6">
        <Text variant="body" weight="semibold" className="mb-2">{name}</Text>

        <div className="flex items-end gap-1">
          <span
            className="text-4xl font-bold"
            style={{ fontFamily: "var(--font-heading)", color: "inherit" }}
          >
            {price}
          </span>
          {period && (
            <span className="mb-1 text-sm" style={{ color: "var(--text-muted, #6b7280)" }}>
              {period}
            </span>
          )}
        </div>

        {description && (
          <Text variant="body-sm" color="muted" className="mt-2">{description}</Text>
        )}
      </div>

      {/* Feature list */}
      {features.length > 0 && (
        <ul className="mb-8 flex-1 space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckIcon />
              <Text variant="body-sm">{feature}</Text>
            </li>
          ))}
        </ul>
      )}

      {/* CTA */}
      <PricingCartButton
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        highlighted={highlighted ?? false}
        className="block rounded-lg px-6 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90"
        style={
          highlighted
            ? { background: "var(--text-brand)", color: "white" }
            : { background: "var(--card-border, #e5e7eb)", color: "inherit" }
        }
      />
    </div>
  );
}

// ── Compact row (pricing_compact variant) ─────────────────────────────────────

function TierRow({ tier }: { tier: PriceTier }) {
  const { name, price, period, description, ctaLabel, ctaHref, highlighted } = tier;

  return (
    <div
      className="flex flex-col items-start gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: highlighted ? "var(--card-bg, white)" : "var(--section-subtle-bg)",
        borderColor:     highlighted ? "var(--text-brand)"     : "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {/* Name + description */}
      <div className="flex-1">
        <Text variant="body" weight="semibold">{name}</Text>
        {description && (
          <Text variant="body-sm" color="muted" className="mt-0.5">{description}</Text>
        )}
      </div>

      {/* Price */}
      <div className="flex items-end gap-1 sm:min-w-[6rem] sm:text-right">
        <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          {price}
        </span>
        {period && (
          <span className="mb-0.5 text-xs" style={{ color: "var(--text-muted, #6b7280)" }}>
            {period}
          </span>
        )}
      </div>

      {/* CTA */}
      <PricingCartButton
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        highlighted={highlighted ?? false}
        className="rounded-lg px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        style={
          highlighted
            ? { background: "var(--text-brand)", color: "white" }
            : { background: "var(--card-border, #e5e7eb)", color: "inherit" }
        }
      />
    </div>
  );
}

// ── Comparison table (pricing_table variant) ──────────────────────────────────

function PricingTable({ tiers, heading, subheading, footnote }: {
  tiers:       readonly PriceTier[];
  heading?:    string;
  subheading?: string;
  footnote?:   string;
}) {
  // Collect all unique features across tiers to build table rows.
  const allFeatures = Array.from(
    new Set(tiers.flatMap((t) => t.features)),
  );

  return (
    <Section spacing="lg">
      <Container size="lg">
        <Stack gap={10}>
          {(heading || subheading) && (
            <Stack gap={3} align="center">
              {heading    && <Text variant="h2" align="center">{heading}</Text>}
              {subheading && (
                <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto">
                  {subheading}
                </Text>
              )}
            </Stack>
          )}

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {/* Feature column header */}
                  <th className="pb-4 pr-6 text-sm font-medium" style={{ color: "var(--text-muted, #6b7280)", minWidth: "10rem" }}>
                    Features
                  </th>
                  {tiers.map((tier) => (
                    <th
                      key={tier.name}
                      className="pb-4 px-4 text-center align-bottom"
                      style={{
                        borderBottom: tier.highlighted
                          ? `2px solid var(--primary)`
                          : `1px solid var(--card-border, #e5e7eb)`,
                      }}
                    >
                      {tier.badge && (
                        <div className="mb-1">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{ background: "var(--text-brand)", color: "white" }}
                          >
                            {tier.badge}
                          </span>
                        </div>
                      )}
                      <Text variant="body" weight="semibold">{tier.name}</Text>
                      <div className="mt-1 flex items-end justify-center gap-0.5">
                        <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                          {tier.price}
                        </span>
                        {tier.period && (
                          <span className="mb-0.5 text-xs" style={{ color: "var(--text-muted, #6b7280)" }}>
                            {tier.period}
                          </span>
                        )}
                      </div>
                      <div className="mt-3">
                        <PricingCartButton
                          ctaHref={tier.ctaHref}
                          ctaLabel={tier.ctaLabel}
                          highlighted={tier.highlighted ?? false}
                          className="inline-block rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                          style={
                            tier.highlighted
                              ? { background: "var(--text-brand)", color: "white" }
                              : { background: "var(--card-border, #e5e7eb)", color: "inherit" }
                          }
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((feature, i) => (
                  <tr
                    key={i}
                    style={{ borderTop: "1px solid var(--card-border, #e5e7eb)" }}
                  >
                    <td className="py-3 pr-6 text-sm">{feature}</td>
                    {tiers.map((tier) => (
                      <td key={tier.name} className="py-3 px-4 text-center">
                        {tier.features.includes(feature) ? (
                          <CheckIcon />
                        ) : (
                          <span className="inline-block h-4 w-4" aria-label="Not included" style={{ color: "var(--text-muted, #9ca3af)" }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {footnote && (
            <Text variant="body-sm" color="muted" align="center">{footnote}</Text>
          )}
        </Stack>
      </Container>
    </Section>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function PricingSectionBlock({ data, variant: rawVariant }: PricingSectionBlockProps) {
  const variant = resolveBlockVariant("pricingSection", rawVariant) as PricingSectionVariant;
  const { heading, subheading, tiers, footnote } = data;
  const items = tiers ?? [];

  // ── pricing_table variant ───────────────────────────────────────────────────

  if (variant === "pricing_table") {
    return (
      <PricingTable
        tiers={items}
        heading={heading}
        subheading={subheading}
        footnote={footnote}
      />
    );
  }

  // ── pricing_compact variant ─────────────────────────────────────────────────

  if (variant === "pricing_compact") {
    return (
      <Section spacing="lg">
        <Container size="md">
          <Stack gap={10}>
            {(heading || subheading) && (
              <Stack gap={3} align="center">
                {heading && <Text variant="h2" align="center">{heading}</Text>}
                {subheading && (
                  <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto">
                    {subheading}
                  </Text>
                )}
              </Stack>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-4">
                {items.map((tier) => (
                  <TierRow key={tier.name} tier={tier} />
                ))}
              </div>
            )}

            {footnote && (
              <Text variant="body-sm" color="muted" align="center">
                {footnote}
              </Text>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── pricing_tiers variant (default) ────────────────────────────────────────

  // Grid column count: cap at 4, then match number of tiers for visual balance.
  const cols = Math.min(items.length || 3, 4);

  return (
    <Section spacing="lg">
      <Container size="lg">
        <Stack gap={12}>
          {(heading || subheading) && (
            <Stack gap={3} align="center">
              {heading && <Text variant="h2" align="center">{heading}</Text>}
              {subheading && (
                <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto">
                  {subheading}
                </Text>
              )}
            </Stack>
          )}

          {items.length > 0 && (
            <div
              className="grid gap-8"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {items.map((tier) => (
                <TierCard key={tier.name} tier={tier} />
              ))}
            </div>
          )}

          {footnote && (
            <Text variant="body-sm" color="muted" align="center">
              {footnote}
            </Text>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
