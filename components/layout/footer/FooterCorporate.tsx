/**
 * FooterCorporate — Multi-column footer (editorial-classic, corporate-clean)
 *
 * Layout structure (Brons-style):
 *
 *   ┌─ Brand row ─────────────────────────────────────────────────────────┐
 *   │  Logo (left)                     Social icons (right)               │
 *   ├─ Main content ──────────────────────────────────────────────────────┤
 *   │  Address / contact   │ Column 1  │ Column 2  │ Column 3  │ ...     │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * When `footerColumns` is absent or empty, falls back to a flat brand + nav
 * layout (legacy mode).
 *
 * Social icons: built-in SVG icons for common platforms; falls back to the
 * platform label text for unknown platforms.
 *
 * ─── Visual tokens ────────────────────────────────────────────────────────────
 *
 *   --footer-bg       Background colour
 *   --footer-fg       Text and link foreground
 *   --footer-border   Divider line colour
 */

import Link from "next/link";
import { Container } from "@/components/primitives";
import type { NavigationItemData, FooterColumnData, SocialLinkData, AddressData } from "@/cms/types";

// ── Platform SVG icons ────────────────────────────────────────────────────────
// Simple, accessible inline SVGs for the most common social platforms.
// viewBox 0 0 24 24, fill="currentColor".

function SocialIcon({ platform }: { platform: string }) {
  // Defensive: CMS data may occasionally deliver a non-string (e.g. an
  // augmented { value, label } object) — never let that crash the footer.
  const key = typeof platform === "string"
    ? platform
    : String((platform as { value?: string })?.value ?? "");
  switch (key.toLowerCase()) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/>
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
          <rect x="2" y="9" width="4" height="12"/>
          <circle cx="4" cy="4" r="2"/>
        </svg>
      );
    case "twitter":
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20.06 12 20.06 12 20.06s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
          <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.17a8.16 8.16 0 0 0 4.77 1.52V7.25a4.85 4.85 0 0 1-1-.56z"/>
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.63 11.17-.1-.94-.2-2.38.04-3.4.22-.91 1.47-6.22 1.47-6.22s-.38-.76-.38-1.87c0-1.75 1.02-3.07 2.28-3.07 1.08 0 1.6.81 1.6 1.78 0 1.08-.69 2.7-1.05 4.2-.3 1.26.62 2.28 1.85 2.28 2.22 0 3.93-2.34 3.93-5.72 0-2.99-2.15-5.08-5.22-5.08-3.55 0-5.64 2.66-5.64 5.42 0 1.07.41 2.22.93 2.85.1.12.11.23.08.35-.09.39-.3 1.26-.34 1.43-.05.22-.18.27-.4.16-1.5-.7-2.44-2.91-2.44-4.68 0-3.8 2.76-7.3 7.96-7.3 4.18 0 7.43 2.98 7.43 6.96 0 4.14-2.61 7.48-6.24 7.48-1.22 0-2.37-.63-2.76-1.38l-.75 2.8c-.27 1.05-1 2.36-1.5 3.16C10.78 23.93 11.38 24 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
        </svg>
      );
    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface FooterCorporateProps {
  siteTitle:      string;
  logoUrl:        string | null;
  logoAlt:        string;
  footerNav:      NavigationItemData[];
  footerColumns?: FooterColumnData[];
  contactEmail?:  string | null;
  contactPhone?:  string | null;
  address?:       AddressData | null;
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
  address,
  socialLinks,
  year,
  density,
}: FooterCorporateProps) {
  const hasColumns = footerColumns && footerColumns.length > 0;
  const outerPy    = density === "compact" ? "py-8" : density === "spacious" ? "py-12" : "py-10";
  const bottomPt   = density === "compact" ? "pt-5" : "pt-7";

  // Filter to only enabled social links
  const activeSocial = (socialLinks ?? []).filter((s) => s.enabled !== false && !!s.url);

  // Effective contact info: prefer address fields if present
  const effectivePhone = address?.phone ?? contactPhone ?? null;
  const effectiveEmail = address?.email ?? contactEmail ?? null;
  const hasAddress = !!(address?.street || address?.city || address?.zipCode);

  // ── Brand link ─────────────────────────────────────────────────────────────
  const BrandMark = (
    <Link
      href="/"
      aria-label={`${siteTitle} — go to homepage`}
      className="inline-block shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4"
    >
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-8 w-auto object-contain opacity-90"
        />
      ) : (
        <span className="text-sm font-semibold" style={{ color: "var(--footer-fg)" }}>
          {siteTitle}
        </span>
      )}
    </Link>
  );

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
            <div className="space-y-8">

              {/* ── Brand row: logo left, social icons right ─────────────────── */}
              <div className="flex items-center justify-between gap-4">
                {BrandMark}

                {activeSocial.length > 0 && (
                  <div className="flex items-center gap-4 shrink-0">
                    {activeSocial.map((s, i) => {
                      const icon = s.platform ? <SocialIcon platform={s.platform} /> : null;
                      return (
                        <a
                          key={`${s.url}-${i}`}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={s.label || s.platform || s.url}
                          title={s.label}
                          className="opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                          style={{ color: "var(--footer-fg)" }}
                        >
                          {icon ?? (
                            <span className="text-xs font-medium">{s.label}</span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Main content row: address + columns ───────────────────────── */}
              {(() => {
                // Total number of grid cells = optional address block + columns
                const hasContact = !!(hasAddress || effectivePhone || effectiveEmail);
                const totalCols  = footerColumns!.length + (hasContact ? 1 : 0);

                // Map total cell count → Tailwind lg: grid class.
                // All class strings are written as literals so Tailwind's scanner
                // includes them in the CSS bundle — never use string interpolation.
                const lgClass: Record<number, string> = {
                  1: "lg:grid-cols-1",
                  2: "lg:grid-cols-2",
                  3: "lg:grid-cols-3",
                  4: "lg:grid-cols-4",
                  5: "lg:grid-cols-5",
                  6: "lg:grid-cols-6",
                };
                const gridClass = [
                  "grid gap-8",
                  totalCols > 1 ? "sm:grid-cols-2" : "grid-cols-1",
                  lgClass[Math.min(totalCols, 6)] ?? "lg:grid-cols-6",
                ].join(" ");

                return (
              <div className={gridClass}>

                {/* Address / contact block */}
                {(hasAddress || effectiveEmail || effectivePhone) && (
                  <div className="space-y-4">
                    {hasAddress && (
                      <div>
                        {address?.street && (
                          <p className="text-sm" style={{ color: "var(--footer-fg)" }}>
                            {address.street}
                          </p>
                        )}
                        {(address?.zipCode || address?.city) && (
                          <p className="text-sm" style={{ color: "var(--footer-fg)" }}>
                            {[address.zipCode, address.city].filter(Boolean).join(" ")}
                          </p>
                        )}
                        {address?.country && (
                          <p className="text-sm" style={{ color: "var(--footer-fg)" }}>
                            {address.country}
                          </p>
                        )}
                      </div>
                    )}

                    {(effectivePhone || effectiveEmail) && (
                      <div className="space-y-1">
                        {effectivePhone && (
                          <p>
                            <a
                              href={`tel:${effectivePhone}`}
                              className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                              style={{ color: "var(--footer-fg)" }}
                            >
                              {effectivePhone}
                            </a>
                          </p>
                        )}
                        {effectiveEmail && (
                          <p>
                            <a
                              href={`mailto:${effectiveEmail}`}
                              className="text-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                              style={{ color: "var(--footer-fg)" }}
                            >
                              {effectiveEmail}
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer columns */}
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
              </div>
                );
              })()}
            </div>
          ) : (
            /* -- Legacy flat layout ------------------------------------------- */
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              {BrandMark}

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

              {activeSocial.length > 0 && (
                <div className="flex flex-wrap gap-3 shrink-0">
                  {activeSocial.map((s, i) => {
                    const icon = s.platform ? <SocialIcon platform={s.platform} /> : null;
                    return (
                      <a
                        key={`${s.url}-${i}`}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label || s.platform || s.url}
                        title={s.label}
                        className="opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                        style={{ color: "var(--footer-fg)" }}
                      >
                        {icon ?? <span className="text-xs">{s.label}</span>}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Bottom bar: legal links only — only rendered when links exist.
               Copyright is handled by FooterBottomStrip to avoid a double border. */}
          {footerNav.length > 0 && hasColumns && (
            <div
              className={`mt-8 border-t ${bottomPt} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
              style={{ borderTopColor: "var(--footer-border)" }}
            >
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
            </div>
          )}

        </div>
      </Container>
    </footer>
  );
}
