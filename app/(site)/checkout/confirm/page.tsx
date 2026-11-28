/**
 * app/(site)/checkout/confirm/page.tsx
 *
 * Where the link in the confirmation mail of a trial signup leads:
 *   /checkout/confirm?token=…
 *
 * A trial asks for no payment details (billing/trial-signup.ts). The form
 * stored a pending signup and mailed this link. Opening it makes the account,
 * once, and this page says what happened.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getDb }             from "@/data/db";
import { getSiteLocale }     from "@/lib/site-texts/server";
import { TRIAL_TEXTS }       from "@/lib/site-texts/trial";
import { confirmTrialSignup, type ConfirmOutcome } from "@/billing/trial-signup";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = TRIAL_TEXTS[await getSiteLocale()];
  // Not "your trial has started": the tab is named before the link is checked.
  return { title: t.confirmPageTitle, robots: { index: false } };
}

export default async function CheckoutConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t     = TRIAL_TEXTS[await getSiteLocale()];
  const token = (await searchParams)["token"];

  let outcome: ConfirmOutcome = { state: "invalid" };
  if (typeof token === "string" && token !== "") {
    try {
      outcome = await confirmTrialSignup(getDb(), token, process.env["ADMIN_SESSION_SECRET"] ?? "");
    } catch (err) {
      console.error("[checkout/confirm] could not confirm the signup", err);
      outcome = { state: "failed", reason: "threw" };
    }
  }
  if (outcome.state === "failed") console.error("[checkout/confirm] signup not provisioned:", outcome.reason);

  const view = {
    created: { title: t.confirmedTitle, body: t.confirmedBody, href: "/admin/login", label: t.logIn },
    already: { title: t.alreadyTitle,   body: t.alreadyBody,   href: "/admin/login", label: t.logIn },
    expired: { title: t.expiredTitle,   body: t.expiredBody,   href: "/prijzen",     label: t.signUpAgain },
    invalid: { title: t.invalidTitle,   body: t.invalidBody,   href: "/prijzen",     label: t.signUpAgain },
    failed:  { title: t.failedTitle,    body: t.failedBody,    href: "/admin/login", label: t.logIn },
  }[outcome.state];

  // Colours come from the theme. The page stands on the site's own background,
  // which is dark in the evening and night themes: fixed dark text could not
  // be read there (seen live on 28 Nov 2026).
  return (
    <div data-part="checkout-confirm" data-state={outcome.state} style={{ maxWidth: "560px", margin: "0 auto", padding: "4rem 1.5rem 5rem" }}>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "var(--text, #111827)", marginBottom: "1rem" }}>
        {view.title}
      </h1>
      <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--text, #374151)", margin: "0 0 1.75rem" }}>
        {view.body}
      </p>
      <Link
        href={view.href}
        style={{ display: "inline-block", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", background: "var(--primary, #111827)", color: "var(--primary-text, #ffffff)", fontWeight: 600, textDecoration: "none" }}
      >
        {view.label}
      </Link>
    </div>
  );
}
