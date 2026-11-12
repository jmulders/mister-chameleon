"use client";

/**
 * CartSummaryBlock
 *
 * Renders a plan order summary — used both on the CMS-driven /order/[plan]
 * pages and as a block in the block showcase.
 *
 * ─── Cart-awareness ───────────────────────────────────────────────────────────
 *
 *   When rendered inside a <CartProvider> (the site layout), this block reads
 *   the current plan from cart context rather than relying solely on the
 *   CMS-supplied data.planId.
 *
 *   Resolution order:
 *     1. Cart context plan (if CartProvider is present and a plan is selected)
 *     2. data.planId from CMS block data (existing /order/[slug] pages)
 *     3. Graceful "no plan" state
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data.planId               "starter" | "growth" | "pro" (CMS fallback)
 *   data.heading              Section heading
 *   data.checkoutHref         Anchor / page for the checkout CTA
 *   data.continueShoppingHref Back-to-pricing link
 *   data.checkoutLabel        CTA button label
 *   data.continueShoppingLabel Secondary link label
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --text, --text-muted, --primary
 *   --card-bg, --card-border, --card-radius
 *   --bg-subtle
 */

import Link from "next/link";
import { Container }       from "@/components/primitives/Container";
import { Section }         from "@/components/primitives/Section";
import type { CartSummaryBlockData } from "@/page-config";
import { useCartSafe }     from "@/lib/cart/cart-context";
import { useSiteLocale }   from "@/components/site/SiteLocale";
import { SHOP_TEXTS }      from "@/lib/site-texts/shop";

// ─── Static plan catalogue ────────────────────────────────────────────────────
//
// Only what is the same in every language. The words around it (the period,
// the badge, the feature list) come from lib/site-texts/shop.ts.

interface PlanSummary {
  name:       string;
  priceCents: number;
  trialDays:  number;
  popular?:   boolean;
}

const PLAN_CATALOGUE: Record<string, PlanSummary> = {
  starter: { name: "Starter",      priceCents: 14900, trialDays: 14 },
  growth:  { name: "Growth",       priceCents: 34900, trialDays: 14, popular: true },
  pro:     { name: "Pro / Agency", priceCents: 74900, trialDays: 14 },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CartSummaryBlockProps {
  data:     CartSummaryBlockData;
  variant?: string;
}

// ─── Check icon ───────────────────────────────────────────────────────────────

function Check() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, color: "var(--primary, #4f46e5)" }}
    >
      <path
        d="M13.5 4L6.5 11L3 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CartSummaryBlock({ data }: CartSummaryBlockProps) {
  const t = SHOP_TEXTS[useSiteLocale()];

  const {
    heading              = t.yourOrder,
    checkoutHref         = "/checkout",
    continueShoppingHref = "/prijzen",
    checkoutLabel        = t.proceedToCheckout,
    continueShoppingLabel = t.backToPricing,
    planId: dataPlanId,
  } = data;

  // Prefer cart context plan over CMS-supplied planId.
  const cart      = useCartSafe();
  const planId    = cart?.cart.plan?.planId ?? dataPlanId;
  const plan      = planId ? PLAN_CATALOGUE[planId] : undefined;
  const features  = planId ? t.planFeatures[planId] ?? [] : [];

  // Credit bundles from cart (if available).
  const creditBundles = cart?.cart.creditBundles ?? [];

  return (
    <Section spacing="lg">
      <Container size="md">
        {/* Page heading */}
        <h1
          style={{
            fontFamily:   "var(--font-heading, inherit)",
            fontWeight:   700,
            fontSize:     "clamp(1.75rem, 3vw, 2.5rem)",
            color:        "var(--text)",
            marginBottom: "2rem",
            lineHeight:   1.2,
          }}
        >
          {heading}
        </h1>

        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr",
            gap:                 "1.5rem",
          }}
          className="cart-summary-grid"
        >
          {/* ── Plan summary card ─────────────────────────────────────────── */}
          {plan ? (
            <div
              style={{
                border:       "1px solid var(--card-border, #e5e7eb)",
                borderRadius: "var(--card-radius, 0.75rem)",
                overflow:     "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding:         "1.5rem 2rem",
                  borderBottom:    "1px solid var(--card-border, #e5e7eb)",
                  background:      "var(--card-bg, white)",
                  display:         "flex",
                  justifyContent:  "space-between",
                  alignItems:      "flex-start",
                  flexWrap:        "wrap",
                  gap:             "1rem",
                }}
              >
                <div>
                  {plan.popular && (
                    <span
                      style={{
                        display:       "inline-block",
                        padding:       "0.2rem 0.6rem",
                        borderRadius:  "9999px",
                        fontSize:      "0.7rem",
                        fontWeight:    600,
                        background:    "var(--primary, #4f46e5)",
                        color:         "white",
                        marginBottom:  "0.5rem",
                      }}
                    >
                      {t.mostPopular}
                    </span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--text)" }}>
                    {t.planLabel(plan.name)}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #6b7280)", marginTop: "0.2rem" }}>
                    {t.freeTrial14}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading, inherit)",
                      fontWeight: 700,
                      fontSize:   "2rem",
                      color:      "var(--text)",
                      lineHeight: 1,
                    }}
                  >
                    {t.money(plan.priceCents)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted, #6b7280)", marginTop: "0.25rem" }}>
                    {t.perMonthAfterTrial}
                  </div>
                </div>
              </div>

              {/* Feature list */}
              <div style={{ padding: "1.5rem 2rem", background: "var(--bg-subtle, #f9fafb)" }}>
                <p
                  style={{
                    fontSize:      "0.75rem",
                    fontWeight:    600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color:         "var(--text-muted, #6b7280)",
                    marginBottom:  "1rem",
                  }}
                >
                  {t.includedInTrial}
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.9375rem", color: "var(--text)" }}>
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trial terms */}
              <div
                style={{
                  padding:    "1rem 2rem",
                  borderTop:  "1px solid var(--card-border, #e5e7eb)",
                  background: "var(--card-bg, white)",
                  display:    "flex",
                  alignItems: "center",
                  gap:        "0.5rem",
                }}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--primary, #4f46e5)", flexShrink: 0 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8"  y1="2" x2="8"  y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3"  y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #6b7280)", margin: 0 }}>
                  <strong style={{ color: "var(--text)" }}>{t.trialDaysBold(plan.trialDays)}</strong>{" "}
                  {t.noCardCancelAnyTime}
                </p>
              </div>
            </div>
          ) : (
            /* No plan selected — link back to pricing */
            <div style={{ border: "1px solid var(--card-border, #e5e7eb)", borderRadius: "var(--card-radius, 0.75rem)", padding: "2rem", textAlign: "center", background: "var(--card-bg, white)" }}>
              <p style={{ color: "var(--text-muted, #6b7280)" }}>
                {t.noPlanSelected}{" "}
                <Link href="/prijzen" style={{ color: "var(--primary, #4f46e5)" }}>{t.viewPricing}</Link>
              </p>
            </div>
          )}

          {/* Credit bundles (from cart context) */}
          {creditBundles.length > 0 && (
            <div style={{ border: "1px solid var(--card-border, #e5e7eb)", borderRadius: "var(--card-radius, 0.75rem)", overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--card-border, #e5e7eb)", background: "var(--card-bg, white)" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted, #6b7280)", margin: 0 }}>
                  {t.creditBundles}
                </p>
              </div>
              <div style={{ background: "var(--bg-subtle, #f9fafb)" }}>
                {creditBundles.map((b) => (
                  <div
                    key={b.bundleId}
                    style={{
                      padding: "0.875rem 1.5rem",
                      borderBottom: "1px solid var(--card-border, #e5e7eb)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.9375rem" }}>{b.label}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted, #6b7280)" }}>
                        {t.creditsAndQty((b.creditsEach).toLocaleString("nl-NL"), b.quantity)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {t.moneyWhole(b.priceCentsEach * b.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA area ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <a
              href={checkoutHref}
              style={{
                display:        "block",
                background:     "var(--primary, #4f46e5)",
                color:          "white",
                borderRadius:   "var(--card-radius, 0.75rem)",
                padding:        "1rem 1.5rem",
                textAlign:      "center",
                fontWeight:     600,
                fontSize:       "1rem",
                textDecoration: "none",
                transition:     "opacity 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
            >
              {checkoutLabel}
            </a>
            <a
              href={continueShoppingHref}
              style={{
                display:        "block",
                textAlign:      "center",
                color:          "var(--text-muted, #6b7280)",
                fontSize:       "0.875rem",
                textDecoration: "none",
              }}
            >
              {continueShoppingLabel}
            </a>
          </div>

          {/* ── Trust signals ─────────────────────────────────────────────── */}
          <div
            style={{
              display:        "flex",
              flexWrap:       "wrap",
              gap:            "1rem 2rem",
              justifyContent: "center",
              paddingTop:     "0.5rem",
            }}
          >
            {[
              { icon: "🔒", text: t.trustSecureSignup },
              { icon: "💳", text: t.trustNoCard },
              { icon: "🚀", text: t.trustLiveFast },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--text-muted, #6b7280)" }}>
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Responsive: single column on mobile (already the case) */}
        <style>{`
          @media (min-width: 768px) {
            .cart-summary-grid {
              max-width: 560px;
              margin: 0 auto;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
