/**
 * ProductOverviewBlock
 *
 * Renders a `productOverview` page section — an optional heading and intro
 * text followed by a responsive grid of product cards with optional prices,
 * badges, and per-card CTAs.  A section-level CTA row is rendered below the
 * grid when present.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ProductOverviewBlockData   { heading?, intro?, products[], ... }
 *   variant   string                     "product_grid" | "product_cards" | "product_list"
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   product_grid   — 3-col bordered card grid (default)
 *   product_cards  — elevated shadow cards on white
 *   product_list   — stacked horizontal list view
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --card-bg, --card-border, --card-radius
 *   --feature-grid-bg, --feature-grid-border  (section background tokens)
 */

import { Container }  from "@/components/primitives/Container";
import { Section }    from "@/components/primitives/Section";
import { Grid }       from "@/components/primitives/Grid";
import { Stack }      from "@/components/primitives/Stack";
import { Text }       from "@/components/primitives/Text";
import { Button }     from "@/components/ui/Button";
import type { ProductOverviewBlockData, BlockCTA, ProductCardItem } from "@/page-config";

// ── CTA helper (shared with FeatureGridBlock pattern) ─────────────────────────

function BlockCTAButton({ cta }: { cta: BlockCTA }) {
  if (cta.variant === "link") {
    return (
      <div className="flex justify-center pt-2">
        <a
          href={cta.href}
          className="text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-brand)" }}
        >
          {cta.label}
        </a>
      </div>
    );
  }
  return (
    <div className="flex justify-center pt-2">
      <Button as="a" href={cta.href} variant={cta.variant ?? "primary"} size="lg">
        {cta.label}
      </Button>
    </div>
  );
}

// ── Badge pill ────────────────────────────────────────────────────────────────

function BadgePill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: "var(--bg-subtle)",
        color:           "var(--text-muted)",
      }}
    >
      {label}
    </span>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  showPrice,
  elevated,
}: {
  product:   ProductCardItem;
  showPrice: boolean;
  elevated?: boolean;
}) {
  return (
    <Stack
      gap={4}
      className="border p-5 sm:p-6 h-full"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
        boxShadow:       elevated ? "var(--feature-grid-card-shadow)" : undefined,
      }}
    >
      {/* Product image */}
      {product.imageUrl && (
        <div
          className="overflow-hidden rounded-md"
          style={{ borderRadius: "var(--card-radius)" }}
        >
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            className="w-full h-40 object-cover"
          />
        </div>
      )}

      {/* Badge + title */}
      <div className="space-y-1.5">
        {product.badge && <BadgePill label={product.badge} />}
        <Text variant="h4" style={{ fontWeight: "var(--font-subheading-weight)" }}>
          {product.title}
        </Text>
      </div>

      {/* Description */}
      <Text variant="body-sm" color="muted" className="flex-1">
        {product.description}
      </Text>

      {/* Price */}
      {showPrice && product.price && (
        <p
          className="text-lg font-bold tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {product.price}
        </p>
      )}

      {/* Per-card CTA */}
      {product.cta && (
        <div>
          {product.cta.variant === "link" ? (
            <a
              href={product.cta.href}
              className="text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--text-brand)" }}
            >
              {product.cta.label}
            </a>
          ) : (
            <Button
              as="a"
              href={product.cta.href}
              variant={product.cta.variant ?? "primary"}
              size="md"
              className="w-full"
            >
              {product.cta.label}
            </Button>
          )}
        </div>
      )}
    </Stack>
  );
}

// ── List-view row ─────────────────────────────────────────────────────────────

function ProductListRow({
  product,
  showPrice,
}: {
  product:   ProductCardItem;
  showPrice: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 p-4 border rounded-lg"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.imageAlt ?? product.title}
          className="w-20 h-20 object-cover rounded-md shrink-0"
          style={{ borderRadius: "var(--card-radius)" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {product.badge && <BadgePill label={product.badge} />}
            <Text variant="h4" style={{ fontWeight: "var(--font-subheading-weight)" }}>
              {product.title}
            </Text>
            <Text variant="body-sm" color="muted">
              {product.description}
            </Text>
          </div>
          {showPrice && product.price && (
            <p className="text-base font-bold tabular-nums shrink-0" style={{ color: "var(--text)" }}>
              {product.price}
            </p>
          )}
        </div>
        {product.cta && (
          <div className="mt-3">
            <Button
              as="a"
              href={product.cta.href}
              variant={product.cta.variant === "link" ? "ghost" : (product.cta.variant ?? "primary")}
              size="sm"
            >
              {product.cta.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProductOverviewBlockProps {
  data:     ProductOverviewBlockData;
  variant?: string;
}

export function ProductOverviewBlock({ data, variant }: ProductOverviewBlockProps) {
  const { heading, intro, products, showPrices = true, cta } = data;
  const items    = products ?? [];
  const resolved = variant ?? "product_grid";

  // ── product_list variant ───────────────────────────────────────────────────

  if (resolved === "product_list") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={10}>
            {(heading || intro) && (
              <Stack gap={3}>
                {heading && <Text variant="h2" align="center">{heading}</Text>}
                {intro   && <Text variant="body" color="muted" align="center">{intro}</Text>}
              </Stack>
            )}
            {items.length > 0 && (
              <Stack gap={3}>
                {items.map((p) => (
                  <ProductListRow key={p.title} product={p} showPrice={showPrices} />
                ))}
              </Stack>
            )}
            {cta && <BlockCTAButton cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── product_cards variant (elevated shadow cards on white) ─────────────────

  if (resolved === "product_cards") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={12}>
            {(heading || intro) && (
              <Stack gap={3}>
                {heading && <Text variant="h2" align="center">{heading}</Text>}
                {intro   && <Text variant="body" color="muted" align="center">{intro}</Text>}
              </Stack>
            )}
            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((p) => (
                  <ProductCard key={p.title} product={p} showPrice={showPrices} elevated />
                ))}
              </Grid>
            )}
            {cta && <BlockCTAButton cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── product_grid variant (default — bordered card grid on subtle bg) ───────

  return (
    <Section
      spacing="lg"
      style={{
        background:        "var(--feature-grid-bg)",
        borderTopColor:    "var(--feature-grid-border)",
        borderBottomColor: "var(--feature-grid-border)",
      }}
      className="border-y"
    >
      <Container size="lg">
        <Stack gap={12}>
          {(heading || intro) && (
            <Stack gap={3}>
              {heading && <Text variant="h2" align="center">{heading}</Text>}
              {intro   && <Text variant="body" color="muted" align="center">{intro}</Text>}
            </Stack>
          )}
          {items.length > 0 && (
            <Grid cols={3} gap="lg">
              {items.map((p) => (
                <ProductCard key={p.title} product={p} showPrice={showPrices} />
              ))}
            </Grid>
          )}
          {cta && <BlockCTAButton cta={cta} />}
        </Stack>
      </Container>
    </Section>
  );
}
