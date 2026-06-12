/**
 * QuoteBlock
 *
 * Renders a `quote` page section — a pull-quote or block-quote with optional
 * author attribution, role/source, and avatar image.
 *
 * Statamic fieldset mapping:
 *   quote   → data.quote
 *   author  → data.attribution
 *   role    → data.source
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   quote-card    — Card on subtle background with large quotation mark (default)
 *   quote-minimal — Slim inline quote, no background, left-border accent
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg     Section / card background
 *   --primary               Quotation-mark accent colour
 *   --font-heading          Attribution font
 *   --text-muted            Subdued text (role/source)
 */

import type { QuoteBlockData } from "@/page-config";

interface QuoteBlockProps {
  data:     QuoteBlockData;
  variant?: string;
}

export function QuoteBlock({ data, variant }: QuoteBlockProps) {
  const isMinimal = variant === "quote-minimal";

  if (isMinimal) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-3xl px-6">
          <blockquote
            className="border-l-4 pl-6"
            style={{ borderColor: "var(--primary, #18181b)" }}
          >
            <p
              className="text-xl font-medium italic leading-relaxed"
              style={{ color: "var(--section-text, #18181b)" }}
            >
              &ldquo;{data.quote}&rdquo;
            </p>
            {(data.attribution || data.source) && (
              <footer className="mt-4 flex items-center gap-3">
                {data.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.avatarUrl}
                    alt={data.attribution ?? ""}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                )}
                <div>
                  {data.attribution && (
                    <span className="text-sm font-semibold" style={{ color: "var(--section-text, #18181b)" }}>
                      {data.attribution}
                    </span>
                  )}
                  {data.source && (
                    <span className="ml-1 text-sm" style={{ color: "var(--text-muted, #6b7280)" }}>
                      · {data.source}
                    </span>
                  )}
                </div>
              </footer>
            )}
          </blockquote>
        </div>
      </section>
    );
  }

  // ── Default: quote-card ──────────────────────────────────────────────────────
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-6">
        <div
          className="relative rounded-2xl px-8 py-10"
          style={{ background: "var(--section-subtle-bg, #f9fafb)" }}
        >
          {/* Large decorative quotation mark */}
          <span
            className="absolute -top-4 left-6 text-7xl font-serif leading-none select-none"
            style={{ color: "var(--primary, #18181b)", opacity: 0.15 }}
            aria-hidden="true"
          >
            &ldquo;
          </span>

          <blockquote className="relative">
            <p className="text-xl font-medium italic leading-relaxed text-neutral-800">
              &ldquo;{data.quote}&rdquo;
            </p>

            {(data.attribution || data.source) && (
              <footer className="mt-6 flex items-center gap-4">
                {data.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.avatarUrl}
                    alt={data.attribution ?? ""}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div>
                  {data.attribution && (
                    <p className="font-semibold text-neutral-900">{data.attribution}</p>
                  )}
                  {data.source && (
                    <p className="text-sm" style={{ color: "var(--text-muted, #6b7280)" }}>
                      {data.source}
                    </p>
                  )}
                </div>
              </footer>
            )}
          </blockquote>
        </div>
      </div>
    </section>
  );
}
