/**
 * /de/book-demo  (German)
 *
 * Other languages:
 *   /demo       Dutch
 *   /book-demo  English
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { bookDemoLanguages } from "@/lib/seo/book-demo-languages";
import { requestOrigin } from "@/lib/seo/site-identity";
import { ownOpenGraph } from "@/lib/seo/page-metadata";
import { BookDemoShell } from "../../book-demo/_components/BookDemoShell";
import { getBookDemoTranslations } from "../../book-demo/_components/translations";

const t = getBookDemoTranslations("de");

// The language versions depend on the site: one of them is named only where
// its address answers with a page (lib/seo/book-demo-languages.ts).
export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       t.metaTitle,
    description: t.metaDescription,
    // Through the helper, because a page's Open Graph object replaces the
    // layout's as a whole: written out by hand it lost the type and the share
    // image, so a shared link to this page showed as bare text.
    ...ownOpenGraph({ ogTitle: t.ogTitle, ogDescription: t.ogDescription }),
    alternates: {
      // Named here because this object replaces the layout's, canonical included.
      canonical: "/de/book-demo",
      languages: bookDemoLanguages(requestOrigin(await headers())),
    },
  };
}

export default function BookDemoDePage() {
  return <BookDemoShell t={t} />;
}
