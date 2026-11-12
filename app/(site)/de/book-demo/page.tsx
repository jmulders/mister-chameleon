/**
 * /de/book-demo  (German)
 *
 * Other languages:
 *   /demo       Dutch
 *   /book-demo  English
 */

import type { Metadata } from "next";
import { BookDemoShell } from "../../book-demo/_components/BookDemoShell";
import { getBookDemoTranslations } from "../../book-demo/_components/translations";

const t = getBookDemoTranslations("de");

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

export default function BookDemoDePage() {
  return <BookDemoShell t={t} />;
}
