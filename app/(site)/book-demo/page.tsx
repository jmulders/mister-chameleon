/**
 * /book-demo  (English)
 *
 * Calendly-style demo booking page backed by Google Calendar.
 *
 * Other languages:
 *   /demo          Dutch
 *   /de/book-demo  German
 */

import type { Metadata } from "next";
import { BookDemoShell } from "./_components/BookDemoShell";
import { getBookDemoTranslations } from "./_components/translations";

const t = getBookDemoTranslations("en");

export const metadata: Metadata = {
  title:       t.metaTitle,
  description: t.metaDescription,
  openGraph: {
    title:       t.ogTitle,
    description: t.ogDescription,
  },
  alternates: {
    languages: {
      "nl": "/demo",
      "en": "/book-demo",
      "de": "/de/book-demo",
    },
  },
};

export default function BookDemoPage() {
  return <BookDemoShell t={t} />;
}
