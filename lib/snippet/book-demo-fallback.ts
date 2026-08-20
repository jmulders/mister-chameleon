/**
 * Book-demo snippet fallback
 *
 * The platform Conversion block renders a full booking widget (BookDemoClient)
 * when formKey === "book-demo". That widget is a heavy first-party React
 * component (not a form), so it has no snippet equivalent. Rather than render
 * nothing on the snippet path, we inject a localized button that links to the
 * hosted /book-demo page, so the snippet still offers a working booking action.
 *
 * An author-supplied CTA always wins: when the conversion block already has a
 * usable CTA, it is left untouched.
 *
 * The label is in the site's language (site copy is localized, not hardcoded
 * English) and the href points at the locale-correct booking page
 * (/book-demo for the default locale, /<locale>/book-demo otherwise).
 */

import type { ConversionBlockData } from "@/cms/types";

// Default locale (no path prefix). Kept as a local constant so this pure helper
// does not import lib/locale (which pulls in next/headers); it mirrors
// lib/locale.ts DEFAULT_LOCALE.
const DEFAULT_LOCALE = "en";

// Matches the /book-demo page cardTitle per locale.
const BOOK_DEMO_LABELS: Record<string, string> = {
  en: "Book a Demo",
  nl: "Boek een demo",
  de: "Demo buchen",
};

/** Localized label for the booking button. Falls back to the default locale. */
export function bookDemoLabel(locale: string): string {
  return BOOK_DEMO_LABELS[locale] ?? BOOK_DEMO_LABELS[DEFAULT_LOCALE];
}

/** Absolute href to the locale-correct hosted booking page. */
export function bookDemoHref(origin: string, locale: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  return `${origin}${prefix}/book-demo`;
}

/**
 * For a book-demo conversion with no author CTA, return a copy of the block with
 * a localized booking CTA injected. Otherwise return the block unchanged.
 */
export function withBookDemoFallback(
  conv: ConversionBlockData,
  locale: string,
  origin: string,
): ConversionBlockData {
  if (conv.formKey !== "book-demo") return conv;
  if ((conv.ctas ?? []).some((c) => c?.label && c?.href)) return conv; // author CTA wins
  return {
    ...conv,
    ctas: [{ label: bookDemoLabel(locale), href: bookDemoHref(origin, locale) }],
  };
}
