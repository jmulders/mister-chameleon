/**
 * FooterMinimal — Single-row footer (portfolio-showcase, premium-luxury)
 *
 * A stripped-down footer with brand mark and links on a single horizontal row,
 * copyright at the far right.  Maximum whitespace, zero visual noise — matches
 * the gallery aesthetic of portfolio-showcase and the refined restraint of
 * premium-luxury.
 *
 *   density="compact"  → py-6 — portfolio-showcase (lean, efficient)
 *   density="spacious" → py-10 — premium-luxury (unhurried, generous rhythm)
 *
 * ─── Rendering ───────────────────────────────────────────────────────────────
 *
 *   Server component — fully static.
 *
 * ─── Visual tokens ────────────────────────────────────────────────────────────
 *
 *   --footer-bg       Background colour
 *   --footer-fg       Text and link foreground
 *   --footer-border   Top border colour
 */

import { Container } from "@/components/primitives";
import type { NavigationItemData } from "@/cms/types";

export interface FooterMinimalProps {
  siteTitle: string;
  logoUrl:   string | null;
  logoAlt:   string;
  footerNav: NavigationItemData[];
  year:      number;
  density:   "compact" | "comfortable" | "spacious";
}

export function FooterMinimal({
  siteTitle,
  logoUrl,
  logoAlt,
  footerNav,
  year,
  density,
}: FooterMinimalProps) {
  const py = density === "compact" ? "py-6" : "py-10";

  return (
    <footer
      style={{
        backgroundColor: "var(--footer-bg)",
        color:           "var(--footer-fg)",
        borderTopColor:  "var(--footer-border)",
      }}
      className="border-t"
    >
      <Container>
        <div className={`${py} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>

          {/* ── Brand ─────────────────────────────────────────────────────── */}
          <a
            href="/"
            aria-label={`${siteTitle} — go to homepage`}
            className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4"
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={logoAlt}
                className="h-6 w-auto object-contain opacity-75"
              />
            ) : (
              <span className="text-sm font-medium tracking-wide" style={{ color: "var(--footer-fg)" }}>
                {siteTitle}
              </span>
            )}
          </a>

          {/* ── Footer navigation (centred) ────────────────────────────────── */}
          {footerNav.length > 0 && (
            <nav aria-label="Footer navigation" className="sm:flex-1">
              <ul className="flex flex-wrap gap-x-6 gap-y-1 sm:justify-center">
                {footerNav.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="text-xs transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                      style={{ color: "var(--footer-fg)" }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* ── Copyright ──────────────────────────────────────────────────── */}
          <p className="shrink-0 text-xs opacity-45 sm:text-right">
            © {year} {siteTitle}
          </p>

        </div>
      </Container>
    </footer>
  );
}
