/**
 * Cookie policy  —  app/(site)/cookies/page.tsx
 *
 * Public, standalone cookie declaration (Cookiebot-style). Lists every cookie
 * this site may set — grouped by consent category, with provider, purpose,
 * lifetime, type and domain — and lets the visitor change their consent right
 * here. The interactive declaration (CookieDeclaration) is a client island; the
 * page itself stays a server component.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CookieDeclaration } from "@/components/tracking/CookieDeclaration";
import { consentTexts } from "@/tracking/consent-i18n";

export const metadata: Metadata = {
  title:       "Cookie policy",
  description: "Which cookies this website sets, why, and how to manage your consent.",
  robots:      { index: true, follow: true },
};

export default async function CookiePolicyPage() {
  const locale = (await cookies()).get("mc_locale")?.value;
  const t = consentTexts(locale);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">{t.policyPage.heading}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t.policyPage.intro}</p>
      </header>

      <CookieDeclaration locale={locale} />

      <p className="mt-8 text-xs text-neutral-400">{t.policyPage.note}</p>
    </main>
  );
}
