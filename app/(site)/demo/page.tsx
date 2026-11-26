/**
 * /demo  (Dutch)
 *
 * Where a visitor plans a demo. Every "Plan een demo" button on the site
 * points here. The decision-engine debug page that used to live on this
 * address is now /engine-debug.
 *
 * Other languages:
 *   /book-demo     English. Not on misterchameleon.nl, where that address
 *                  redirects to this page.
 *   /de/book-demo  German
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { bookDemoLanguages } from "@/lib/seo/book-demo-languages";
import { requestOrigin } from "@/lib/seo/site-identity";
import { BookDemoShell } from "../book-demo/_components/BookDemoShell";
import { getBookDemoTranslations } from "../book-demo/_components/translations";

const t = getBookDemoTranslations("nl");

// The language versions depend on the site: one of them is named only where
// its address answers with a page (lib/seo/book-demo-languages.ts).
export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       t.metaTitle,
    description: t.metaDescription,
    openGraph: {
      title:       t.ogTitle,
      description: t.ogDescription,
    },
    alternates: {
      // Named here because this object replaces the layout's, canonical included.
      canonical: "/demo",
      languages: bookDemoLanguages(requestOrigin(await headers())),
    },
  };
}

export default function DemoPage() {
  return <BookDemoShell t={t} />;
}
