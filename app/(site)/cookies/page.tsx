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
import { CookieDeclaration } from "@/components/tracking/CookieDeclaration";

export const metadata: Metadata = {
  title:       "Cookie policy",
  description: "Which cookies this website sets, why, and how to manage your consent.",
  robots:      { index: true, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Cookie policy</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Below is every cookie this website may place, grouped by purpose. For each
          cookie you can see who sets it, what it&apos;s for, how long it&apos;s kept
          (lifetime), its type and domain. You can change your choices at any time —
          they take effect immediately and are remembered.
        </p>
      </header>

      <CookieDeclaration />

      <p className="mt-8 text-xs text-neutral-400">
        Integration cookies (Google Analytics, Leadinfo) are only set when that
        integration is enabled for this site. Strictly-necessary cookies are always
        active because the site cannot function without them.
      </p>
    </main>
  );
}
