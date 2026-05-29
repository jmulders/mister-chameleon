/**
 * FooterCorporate — Multi-column footer (editorial-classic, corporate-clean)
 *
 * A structured, authority-signalling footer that supports:
 *
 *   1. Column layout (preferred) — when `footerColumns` is populated, renders
 *      2–5 labelled link columns across the available width.  The brand mark
 *      appears above the columns when columns are present.
 *
 *   2. Legacy flat layout — when `footerColumns` is absent or empty, renders
 *      brand left + nav links right (the original layout).
 *
 *   3. Bottom bar — contact info and bottom-row links (Privacy, Terms, etc.)
 *      always appear below both layouts.
 *
 * ─── Density ─────────────────────────────────────────────────────────────────
 *
 *   compact   → tight py-8 / pt-6  (corporate-clean)
 *   spacious  → generous py-12 / pt-8 (editorial-classic)
 *   comfortable → py-10 / pt-6
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
 */

import { Container } from "@/components/primitives";
import type { NavigationItemData, FooterColumnData, SocialLinkData } from "@/cms/types";

export interface FooterCorporateProps {
  siteTitle:      string;
  logoUrl:        string | null;
  logoAlt:        string;
  footerNav:      NavigationItemData[];
  footerColumns?: FooterColumnData[];
  contactEmail?:  string | null;
  contactPhone?:  string | null;
  socialLinks?:   SocialLinkData[];
  year:           number;
  density:        "compact" | "comfortable" | "spacious";
}

export function FooterCorporate({
  siteTitle,
  logoUrl,
  logoAlt,
  footerNav,
  footerColumns,
  contactEmail,
  contactPhone,
  socialLinks,
  year,
  density,
}: FooterCorporateProps) {
  const hasColumns = footerColumns && footerColumns.length > 0;
  const outerPy    = density === "compact" ? "py-8" : density === "spacious" ? "py-12" : "py-10";
  const bottomPt   = density === "compact" ? "pt-5" : "pt-7";

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
        <div className={outerPy}>

          {hasColumns ? (
            /* ── Column layout ─────────────────────────────────────────────── */
            <div className="space-y-8">
              {/* Brand row above columns */}
              <a
                href="/"
                aria-label={`${siteTitle} — go to homepage`}
                className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4"
              >
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt={logoAlt}
                    className="h-7 w-auto object-contain opacity-80"
                  />
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--footer-fg)" }}>
                    {siteTitle}
                  </span>
                )}
              </a>

              {/* Columns */}
              <div className={`grid gap-8 sm:grid-cols-2 ${
                footerColumns!.length >= 4
                  ? "lg:grid-cols-4"
                  : footerColumns!.length === 3
                    ? "lg:grid-cols-3"
                    : "lg:grid-cols-2"
              }`}>
                {footerColumns!.map((col, i) => (
                  <div key={i}>
                    {col.title && (
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">
                        {col.title}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {col.links.map((link, li) => (
                        <li key={`${link.href}-${li}`}>
                          <a
                            href={link.href}
                            target={link.openInNewTab ? "_blank" : undefined}
                            rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                            className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                            style={{ color: "var(--footer-fg)" }}
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Contact / social column */}
                {(contactEmail || contactPhone || (socialLinks && socialLinks.length > 0)) && (
                  <div>
                    {(contactEmail || contactPhone) && (
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">
                        Contact
                      </p>
                    )}
                    <ul className="space-y-2">
                      {contactEmail && (
                        <li>
                          <a
                            href={`mailto:${contactEmail}`}
                            className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                            style={{ color: "var(--footer-fg)" }}
                          >
                            {contactEmail}
                          </a>
                        </li>
                      )}
                      {contactPhone && (
                        <li>
                          <a
                            href={`tel:${contactPhone}`}
                            className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                            style={{ color: "var(--footer-fg)" }}
                          >
                            {contactPhone}
                          </a>
                        </li>
                      )}
                    </ul>
                    {socialLinks && socialLinks.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {socialLinks.map((s, i) => (
                          <a
                            key={`${s.url}-${i}`}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={s.label}
                            className="text-xs opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                            style={{ color: "var(--footer-fg)" }}
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Legacy flat layout ────────────────────────────────────────── */
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

              {/* Brand */}
              <a
                href="/"
                aria-label={`${siteTitle} — go to homepage`}
                className="shrink-0 self-start rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4"
              >
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt={logoAlt}
                    className="h-7 w-auto object-contain opacity-80"
                  />
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--footer-fg)" }}>
                    {siteTitle}
                  </span>
                )}
              </a>

              {/* Navigation links — inline */}
              {footerNav.length > 0 && (
                <nav aria-label="Footer navigation">
                  <ul className="flex flex-wrap gap-x-7 gap-y-2">
                    {footerNav.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          target={item.openInNewTab ? "_blank" : undefined}
                          rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                          className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                          style={{ color: "var(--footer-fg)" }}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
          )}

          {/* ── Bottom bar: bottom-row links + copyright ─────────────────────── */}
          <div
            className={`mt-8 border-t ${bottomPt} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
            style={{ borderTopColor: "var(--footer-border)" }}
          >
            <p className="text-xs opacity-55">
              © {year} {siteTitle}. All rights reserved.
            </p>

            {/* Bottom navigation links (Privacy, Terms, Imprint, etc.) */}
            {footerNav.length > 0 && hasColumns && (
              <nav aria-label="Footer legal links">
                <ul className="flex flex-wrap gap-x-5 gap-y-1">
                  {footerNav.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        target={item.openInNewTab ? "_blank" : undefined}
                        rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                        className="text-xs opacity-55 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                        style={{ color: "var(--footer-fg)" }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

        </div>
      </Container>
    </footer>
  );
}
