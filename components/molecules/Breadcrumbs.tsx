/**
 * Breadcrumbs
 *
 * Accessible navigation trail for content and detail pages. Renders a
 * <nav aria-label="Breadcrumb"> with an ordered list of links. The last
 * item is the current page and is rendered as plain text (not a link).
 *
 * Includes JSON-LD BreadcrumbList structured data for SEO.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   items   BreadcrumbItem[]   Ordered trail from root to current page.
 *                              The last item is always treated as the current
 *                              page regardless of whether href is set.
 *   className   string         Optional additional class names.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --text-muted    Item and separator colour
 *   --primary       Hover colour on linked items
 *   --transition-base Link colour transition
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  /** Display text for this breadcrumb level. */
  label: string;
  /** Optional link. Omit for the current-page (last) item. */
  href?:  string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface BreadcrumbsProps {
  items:      readonly BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  const jsonLd = {
    "@context":          "https://schema.org",
    "@type":             "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type":    "ListItem",
      "position": index + 1,
      "name":     item.label,
      ...(item.href ? { "item": item.href } : {}),
    })),
  };

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hover style — CSS-only, no JS event handlers needed */}
      <style>{`.breadcrumb-link:hover{color:var(--primary)}`}</style>

      <nav aria-label="Breadcrumb" className={className}>
        <ol
          className="flex flex-wrap items-center gap-1"
          style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={index} className="flex items-center gap-1">
                {isLast ? (
                  // Current page — plain text, aria-current
                  <span aria-current="page" style={{ color: "var(--text-muted)" }}>
                    {item.label}
                  </span>
                ) : item.href ? (
                  // Linked ancestor
                  <a
                    href={item.href}
                    className="breadcrumb-link"
                    style={{
                      color:          "var(--text-muted)",
                      textDecoration: "none",
                      transition:     "color var(--transition-base)",
                    }}
                  >
                    {item.label}
                  </a>
                ) : (
                  // Unlinked ancestor
                  <span>{item.label}</span>
                )}

                {/* Separator — hidden from assistive tech */}
                {!isLast && (
                  <span aria-hidden="true" style={{ opacity: 0.4, userSelect: "none" }}>
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
