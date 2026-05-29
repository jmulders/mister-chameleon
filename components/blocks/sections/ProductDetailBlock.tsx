/**
 * ProductDetailBlock
 *
 * Renders a `productDetail` page section — full product detail view with
 * gallery/images, title, description, specs table, price, and CTAs.
 * Optional related products row below.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ProductDetailBlockData   { title, description?, gallery?, ... }
 *   variant   string                   "product_detail_default" | "product_detail_full"
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   product_detail_default — gallery left, copy right (2-col split on desktop)
 *   product_detail_full    — stacked full-width layout
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --card-bg, --card-border, --card-radius
 *   --btn-bg, --btn-text  (via Button component)
 */

import { Container } from "@/components/primitives/Container";
import { Section }   from "@/components/primitives/Section";
import { Stack }     from "@/components/primitives/Stack";
import { Text }      from "@/components/primitives/Text";
import { Grid }      from "@/components/primitives/Grid";
import { Button }    from "@/components/ui/Button";
import type { ProductDetailBlockData, ProductCardItem } from "@/page-config";

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

// ── Gallery panel ─────────────────────────────────────────────────────────────

function GalleryPanel({
  images,
  title,
}: {
  images: readonly { url: string; alt: string }[];
  title:  string;
}) {
  const [hero, ...thumbs] = images;
  if (!hero) {
    // Placeholder when no images are provided.
    return (
      <div
        className="flex items-center justify-center rounded-xl aspect-square"
        style={{
          background: "var(--bg-subtle)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--border)",
        }}
        aria-label={`${title} product image placeholder`}
      >
        <span className="text-5xl opacity-30" aria-hidden="true">🖼</span>
      </div>
    );
  }
  return (
    <Stack gap={3}>
      <div
        className="overflow-hidden rounded-xl aspect-square"
        style={{ borderRadius: "var(--card-radius)" }}
      >
        <img
          src={hero.url}
          alt={hero.alt || title}
          className="w-full h-full object-cover"
        />
      </div>
      {thumbs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {thumbs.slice(0, 5).map((img, i) => (
            <div
              key={i}
              className="shrink-0 w-16 h-16 overflow-hidden rounded-md border"
              style={{
                borderRadius: "var(--card-radius)",
                borderColor:  "var(--card-border)",
              }}
            >
              <img
                src={img.url}
                alt={img.alt || `${title} image ${i + 2}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}

// ── Specs table ───────────────────────────────────────────────────────────────

function SpecsTable({ specs }: { specs: readonly { label: string; value: string }[] }) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--card-border)" }}
    >
      <table className="w-full text-sm">
        <tbody>
          {specs.map(({ label, value }, i) => (
            <tr
              key={i}
              className="border-b last:border-0"
              style={{ borderColor: "var(--card-border)" }}
            >
              <td
                className="px-4 py-2.5 font-medium w-2/5"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </td>
              <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Related product mini-card ─────────────────────────────────────────────────

function RelatedProductCard({ product }: { product: ProductCardItem }) {
  return (
    <Stack
      gap={3}
      className="border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {product.badge && (
        <BadgePill label={product.badge} />
      )}
      <Text variant="h4" style={{ fontWeight: "var(--font-subheading-weight)" }}>
        {product.title}
      </Text>
      <Text variant="body-sm" color="muted">
        {product.description}
      </Text>
      {product.price && (
        <p className="text-base font-bold tabular-nums" style={{ color: "var(--text)" }}>
          {product.price}
        </p>
      )}
      {product.cta && (
        <Button
          as="a"
          href={product.cta.href}
          variant={product.cta.variant === "link" ? "ghost" : (product.cta.variant ?? "secondary")}
          size="sm"
        >
          {product.cta.label}
        </Button>
      )}
    </Stack>
  );
}

// ── Copy panel (right column) ─────────────────────────────────────────────────

function CopyPanel({ data }: { data: ProductDetailBlockData }) {
  const { title, description, price, badge, specs, cta, secondaryCta } = data;
  return (
    <Stack gap={6}>
      {/* Badge + title */}
      <Stack gap={2}>
        {badge && <BadgePill label={badge} />}
        <Text variant="h2">{title}</Text>
      </Stack>

      {/* Price */}
      {price && (
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
          {price}
        </p>
      )}

      {/* Description */}
      {description && (
        <Text variant="body" color="muted" className="leading-relaxed">
          {description}
        </Text>
      )}

      {/* CTAs */}
      {(cta || secondaryCta) && (
        <div className="flex flex-wrap gap-3">
          {cta && (
            <Button
              as="a"
              href={cta.href}
              variant={cta.variant ?? "primary"}
              size="lg"
            >
              {cta.label}
            </Button>
          )}
          {secondaryCta && (
            <Button
              as="a"
              href={secondaryCta.href}
              variant={secondaryCta.variant ?? "outline"}
              size="lg"
            >
              {secondaryCta.label}
            </Button>
          )}
        </div>
      )}

      {/* Specs */}
      {specs && specs.length > 0 && (
        <Stack gap={3}>
          <Text
            variant="body-sm"
            className="uppercase tracking-wider font-semibold"
            color="muted"
          >
            Specifications
          </Text>
          <SpecsTable specs={specs} />
        </Stack>
      )}
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProductDetailBlockProps {
  data:     ProductDetailBlockData;
  variant?: string;
}

export function ProductDetailBlock({ data, variant }: ProductDetailBlockProps) {
  const { relatedProducts } = data;
  const resolved = variant ?? "product_detail_default";
  const gallery  = data.gallery ?? [];

  // ── product_detail_full variant (stacked, full-width) ─────────────────────

  if (resolved === "product_detail_full") {
    return (
      <Section spacing="lg">
        <Container size="md">
          <Stack gap={12}>
            {gallery.length > 0 && (
              <div className="max-w-lg mx-auto w-full">
                <GalleryPanel images={gallery} title={data.title} />
              </div>
            )}
            <CopyPanel data={data} />
            {relatedProducts && relatedProducts.length > 0 && (
              <Stack gap={6}>
                <Text variant="h3">Related Products</Text>
                <Grid cols={3} gap="md">
                  {relatedProducts.map((p) => (
                    <RelatedProductCard key={p.title} product={p} />
                  ))}
                </Grid>
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── product_detail_default (gallery left / copy right 2-col split) ────────

  return (
    <Section spacing="lg">
      <Container size="lg">
        <Stack gap={14}>
          {/* 2-col split */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Gallery */}
            <GalleryPanel images={gallery} title={data.title} />
            {/* Copy */}
            <CopyPanel data={data} />
          </div>

          {/* Related products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <Stack gap={6}>
              <Text variant="h3">Related Products</Text>
              <Grid cols={3} gap="md">
                {relatedProducts.map((p) => (
                  <RelatedProductCard key={p.title} product={p} />
                ))}
              </Grid>
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
