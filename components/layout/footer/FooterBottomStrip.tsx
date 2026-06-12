/**
 * FooterBottomStrip
 *
 * An optional slim strip rendered at the very bottom of the page, below the
 * main footer. Typically contains:
 *
 *   Left:   copyright text  ·  legal/utility links
 *   Right:  social icon list  ·  partner / powered-by logo
 *
 * Driven entirely by `FooterBottomData` from site settings — if the CMS
 * `footer_bottom_enabled` toggle is off, the strip is simply not rendered.
 *
 * Visual tokens:
 *   --footer-bottom-bg    Background. Defaults to a slightly darker shade of
 *                         --footer-bg (achieved via opacity overlay).
 *   --footer-bottom-fg    Text / icon colour. Defaults to --footer-fg.
 */

import Link           from "next/link";
import type { FooterBottomData, SocialLinkData } from "@/cms/types";

interface FooterBottomStripProps {
  data:         FooterBottomData;
  socialLinks?: SocialLinkData[];
  year:         number;
}

export function FooterBottomStrip({ data, socialLinks, year }: FooterBottomStripProps) {
  const { copyright, showSocial, links, partnerLogoUrl, partnerLogoAlt, partnerHref } = data;

  const visibleSocial = showSocial !== false && socialLinks && socialLinks.length > 0
    ? socialLinks
    : [];

  const hasCopyright = !!copyright;
  const hasLinks     = links && links.length > 0;
  const hasSocial    = visibleSocial.length > 0;
  const hasPartner   = !!partnerLogoUrl;

  if (!hasCopyright && !hasLinks && !hasSocial && !hasPartner) return null;

  const copyrightText = copyright?.replace("{year}", String(year)) ?? null;

  return (
    <div
      style={{
        backgroundColor: "var(--footer-bottom-bg, var(--footer-bg, var(--bg-subtle)))",
        color:           "var(--footer-bottom-fg, var(--footer-fg))",
        borderTopColor:  "var(--footer-border, var(--border))",
      }}
      className="border-t"
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">

          {/* Left — copyright + legal links */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {hasCopyright && (
              <span className="text-xs opacity-55">
                {copyrightText}
              </span>
            )}
            {hasLinks && (
              <nav aria-label="Legal links">
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {links!.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        target={link.openInNewTab ? "_blank" : undefined}
                        rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                        className="text-xs opacity-55 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm"
                        style={{ color: "var(--footer-bottom-fg, var(--footer-fg))" }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          {/* Right — social icons + partner logo */}
          <div className="flex items-center gap-4">
            {hasSocial && (
              <div className="flex items-center gap-2">
                {visibleSocial.map((s, i) => (
                  <a
                    key={`${s.url}-${i}`}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-xs opacity-55 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                    style={{ color: "var(--footer-bottom-fg, var(--footer-fg))" }}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
            {hasPartner && (
              partnerHref ? (
                <Link
                  href={partnerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded-sm"
                  aria-label={partnerLogoAlt ?? "Partner"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partnerLogoUrl}
                    alt={partnerLogoAlt ?? ""}
                    className="h-5 w-auto object-contain"
                  />
                </Link>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={partnerLogoUrl}
                  alt={partnerLogoAlt ?? ""}
                  className="h-5 w-auto object-contain opacity-60"
                />
              )
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
