/**
 * /de/book-demo  (German)
 *
 * German-language version of the demo booking page.
 * Shares BookDemoClient and all logic with the English page — only strings differ.
 *
 * English:  /book-demo
 * Dutch:    /nl/book-demo
 */

import type { Metadata } from "next";
import { BookDemoClient } from "../../book-demo/_components/BookDemoClient";
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
      "en": "/book-demo",
      "nl": "/nl/book-demo",
      "de": "/de/book-demo",
    },
  },
};

export default function BookDemoDePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4">
      {/* Page heading */}
      <div className="mx-auto max-w-2xl mb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-4 py-1.5 mb-4">
          <span className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wide">{t.badge}</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
          {t.pageHeading}
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed">
          {t.pageSubheading}
        </p>
      </div>

      {/* Booking widget */}
      <BookDemoClient t={t} />

      {/* Trust badges */}
      <div className="mx-auto max-w-2xl mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          {t.trustNoCreditCard}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {t.trustCalendarInvite}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
          {t.trustLiveQA}
        </span>
      </div>
    </main>
  );
}
