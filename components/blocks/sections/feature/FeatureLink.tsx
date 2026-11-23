"use client";

/**
 * The link under a feature card: "Lees meer", to the page that explains the
 * feature further.
 *
 * A card says in a few sentences what a feature is. The longer explanation
 * lives elsewhere, in an article or a use case, and this link leads there.
 *
 * A client component for one reason: the fallback text follows the language
 * of the site, which the site keeps in context.
 */

import Link from "next/link";
import { useSiteLocale } from "@/components/site/SiteLocale";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";

export function FeatureLink({ href, label, title }: {
  href:   string;
  /** The editor's own text. Empty: the site's "Lees meer". */
  label?: string;
  /** The title of the card, read out after the link text so eight links named "Lees meer" can be told apart. */
  title:  string;
}) {
  const t    = BLOCK_TEXTS[useSiteLocale()];
  const text = label && label.trim() !== "" ? label.trim() : t.readMore;
  return (
    <Link
      href={href}
      data-part="feature-link"
      className={[
        "inline-flex items-center gap-1 self-start text-sm font-semibold",
        "text-[var(--text-brand,var(--primary))] underline-offset-4 hover:underline",
        "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm",
      ].join(" ")}
    >
      {text}
      <span className="sr-only">: {title}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
