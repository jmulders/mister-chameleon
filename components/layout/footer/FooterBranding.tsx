/**
 * FooterBranding — Brand-centric footer (bold-marketing family)
 *
 * A centred, brand-forward footer that puts the logo front and centre above
 * footer links.  This reinforces brand recall at the bottom of conversion
 * and campaign pages — the brand mark is the last thing visitors see.
 *
 *   density="spacious" → generous vertical padding, large logo, wide spacing
 *   density="compact"  → tighter padding (not the default for this variant)
 *
 * ─── Rendering ───────────────────────────────────────────────────────────────
 *
 *   Server component — fully static.
 *
 * ─── Visual tokens ────────────────────────────────────────────────────────────
 *
 *   --footer-bg       Background colour
 *   --footer-fg       Text and link foreground
 *   --footer-border   Divider line colour
 *   --primary         Brand accent on the divider swatch
 */

import Link from "next/link";
import { Container } from "@/components/primitives";
import type { NavigationItemData, SocialLinkData } from "@/cms/types";

export interface FooterBrandingProps {
  siteTitle:    string;
  logoUrl:      string | null;
  logoAlt:      string;
  footerNav:    NavigationItemData[];
  socialLinks?: SocialLinkData[];
  year:         number;
  density:      "compact" | "comfortable" | "spacious";
}

export function FooterBranding({
  siteTitle,
  logoUrl,
  logoAlt,
  footerNav,
  socialLinks,
  year,
  density,
}: FooterBrandingProps) {
  const outerPy  = density === "spacious" ? "py-16" : "py-10";
  const logoH    = density === "spacious" ? "h-10"  : "h-7";
  const gap      = density === "spacious" ? "gap-8" : "gap-6";

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
        <div className={`${outerPy} flex flex-col items-center text-center ${gap}`}>

          {/* ── Brand (centred, prominent) ────────────────────────────────── */}
          <Link
            href="/"
            aria-label={`${siteTitle} — go to homepage`}
            className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4"
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={logoAlt}
                className={`${logoH} w-auto object-contain opacity-90`}
              />
            ) : (
              <span
                className="text-xl font-bold tracking-tight"
                style={{ color: "var(--footer-fg)" }}
              >
                {siteTitle}
              </span>
            )}
          </Link>

          {/* ── Brand accent line ─────────────────────────────────────────── */}
          <div
            className="h-0.5 w-12 rounded-full opacity-70"
            style={{ backgroundColor: "var(--primary,#6366f1)" }}
          />

          {/* ── Footer navigation ─────────────────────────────────────────── */}
          {footerNav.length > 0 && (
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2">
                {footerNav.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target={item.openInNewTab ? "_blank" : undefined}
                      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                      className="text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                      style={{ color: "var(--footer-fg)" }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* ── Social links ───────────────────────────────────────────────── */}
          {socialLinks && socialLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {socialLinks.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-xs opacity-50 hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                  style={{ color: "var(--footer-fg)" }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}

          {/* ── Copyright ──────────────────────────────────────────────────── */}
          <p className="text-xs opacity-50">
            © {year} {siteTitle}. All rights reserved.
          </p>

        </div>
      </Container>
    </footer>
  );
}
