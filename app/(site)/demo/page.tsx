/**
 * /demo  (Dutch)
 *
 * Where a visitor plans a demo. Every "Plan een demo" button on the site
 * points here. The decision-engine debug page that used to live on this
 * address is now /engine-debug.
 *
 * Other languages:
 *   /book-demo     English
 *   /de/book-demo  German
 */

import type { Metadata } from "next";
import { BookDemoShell } from "../book-demo/_components/BookDemoShell";
import { getBookDemoTranslations } from "../book-demo/_components/translations";

const t = getBookDemoTranslations("nl");

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

export default function DemoPage() {
  return <BookDemoShell t={t} />;
}
