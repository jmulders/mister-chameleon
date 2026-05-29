"use client";

/**
 * app/(site)/cart/_components/CartPageClient.tsx
 *
 * Client-side cart review page.
 *
 * Shows:
 *   - Selected plan (with features list and price)
 *   - Added credit bundles (with qty controls)
 *   - Order total
 *   - "Proceed to checkout" CTA → /checkout
 *   - "Back to pricing" link
 *   - Empty-cart state with a link back to /pricing
 *
 * Credit bundles that can be added here:
 *   The Hatchling  (5K credits  — €50)
 *   The Climber    (25K credits — €200)
 *   The Dragon     (100K credits — €750)
 */

import Link                   from "next/link";
import { useCart }            from "@/lib/cart/cart-context";
import type { CartCreditBundle } from "@/lib/cart/cart-context";

// ── Static credit catalogue (mirrors pricing page) ────────────────────────────

const AVAILABLE_BUNDLES: Array<Omit<CartCreditBundle, "quantity">> = [
  {
    bundleId:       "hatchling",
    label:          "The Hatchling",
    priceCentsEach: 5_000,
    creditsEach:    5_000,
  },
  {
    bundleId:       "climber",
    label:          "The Climber",
    priceCentsEach: 20_000,
    creditsEach:    25_000,
  },
  {
    bundleId:       "dragon",
    label:          "The Dragon",
    priceCentsEach: 75_000,
    creditsEach:    100_000,
  },
];

// ── Plan feature catalogue ────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "25,000 personalised sessions/month",
    "Rule-based personalisation engine",
    "IP-to-company enrichment",
    "3 content variants per page",
    "Sanity CMS integration",
    "Email support",
  ],
  growth: [
    "150,000 personalised sessions/month",
    "AI-assisted variant decisions",
    "CRM & ABM enrichment (HubSpot, Salesforce)",
    "Custom audience segments",
    "A/B & multivariate testing",
    "Full analytics dashboard",
  ],
  pro: [
    "500,000 personalised sessions/month",
    "Unlimited client sites",
    "White-label interface & custom domain",
    "SLA + Data Processing Agreement",
    "Priority support + onboarding call",
    "Everything in Growth",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEuro(cents: number): string {
  if (cents % 100 === 0) return `€${cents / 100}`;
  return `€${(cents / 100).toFixed(2)}`;
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, color: "#4f46e5" }}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function QtyControl({
  qty,
  onInc,
  onDec,
  onRemove,
}: {
  qty:      number;
  onInc:    () => void;
  onDec:    () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={qty === 1 ? onRemove : onDec}
        style={{
          width: "1.75rem", height: "1.75rem",
          borderRadius: "50%",
          border: "1px solid #d1d5db",
          background: qty === 1 ? "#fef2f2" : "white",
          color: qty === 1 ? "#ef4444" : "#374151",
          fontWeight: 600,
          fontSize: "1rem",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        title={qty === 1 ? "Remove" : "Decrease"}
      >
        {qty === 1 ? "×" : "−"}
      </button>
      <span style={{ minWidth: "1.5rem", textAlign: "center", fontWeight: 600, color: "#111827" }}>{qty}</span>
      <button
        type="button"
        onClick={onInc}
        style={{
          width: "1.75rem", height: "1.75rem",
          borderRadius: "50%",
          border: "1px solid #d1d5db",
          background: "white",
          color: "#374151",
          fontWeight: 600,
          fontSize: "1rem",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        title="Increase"
      >
        +
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CartPageClient() {
  const {
    cart,
    removePlan,
    addCreditBundle,
    updateCreditBundleQty,
    removeCreditBundle,
    totalCents,
  } = useCart();

  const isEmpty = !cart.plan && cart.creditBundles.length === 0;

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div
        style={{
          maxWidth: "480px",
          margin: "6rem auto",
          padding: "0 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🛒</div>
        <h1 style={{ fontWeight: 700, fontSize: "1.75rem", color: "#111827", marginBottom: "0.75rem" }}>
          Your cart is empty
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
          Head back to pricing to pick a plan or add credit bundles.
        </p>
        <Link
          href="/pricing"
          style={{
            display: "inline-block",
            background: "#111827",
            color: "white",
            borderRadius: "0.75rem",
            padding: "0.75rem 1.75rem",
            fontWeight: 600,
            fontSize: "0.9375rem",
            textDecoration: "none",
          }}
        >
          View pricing
        </Link>
      </div>
    );
  }

  // ── Filled cart ─────────────────────────────────────────────────────────────

  const features = cart.plan ? PLAN_FEATURES[cart.plan.planId] ?? [] : [];

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

      {/* Page title */}
      <h1
        style={{
          fontWeight: 700,
          fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
          color: "#111827",
          marginBottom: "2.5rem",
          lineHeight: 1.2,
        }}
      >
        Your order
      </h1>

      <div className="cart-layout">

        {/* ── Left column: line items ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Plan item */}
          {cart.plan && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0.875rem",
                overflow: "hidden",
                background: "white",
              }}
            >
              {/* Plan header */}
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: "0.25rem" }}>
                    Subscription plan — 14-day free trial
                  </p>
                  <h2 style={{ fontWeight: 700, fontSize: "1.125rem", color: "#111827", margin: 0 }}>
                    {cart.plan.name}
                  </h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: "1.5rem", color: "#111827", lineHeight: 1 }}>
                    {fmtEuro(cart.plan.priceCents)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.2rem" }}>
                    {cart.plan.period} after trial
                  </div>
                </div>
              </div>

              {/* Feature list */}
              <div style={{ padding: "1.25rem 1.5rem", background: "#f9fafb" }}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#374151" }}>
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Remove */}
              <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", background: "white" }}>
                <button
                  type="button"
                  onClick={removePlan}
                  style={{ fontSize: "0.8125rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Remove plan
                </button>
              </div>
            </div>
          )}

          {/* Credit bundle items */}
          {cart.creditBundles.map((b) => (
            <div
              key={b.bundleId}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0.875rem",
                padding: "1.25rem 1.5rem",
                background: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: "0.25rem" }}>
                  Credit bundle — {(b.creditsEach).toLocaleString("nl-NL")} credits
                </p>
                <h3 style={{ fontWeight: 600, fontSize: "1rem", color: "#111827", margin: 0 }}>
                  {b.label}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.2rem" }}>
                  {fmtEuro(b.priceCentsEach)} each · credits never expire
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <QtyControl
                  qty={b.quantity}
                  onInc={() => updateCreditBundleQty(b.bundleId, b.quantity + 1)}
                  onDec={() => updateCreditBundleQty(b.bundleId, b.quantity - 1)}
                  onRemove={() => removeCreditBundle(b.bundleId)}
                />
                <div style={{ textAlign: "right", minWidth: "4rem" }}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    {fmtEuro(b.priceCentsEach * b.quantity)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add credits section */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.875rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Add Chameleon Credits (optional)
            </p>
            <div className="bundle-grid">
              {AVAILABLE_BUNDLES.filter(
                (ab) => !cart.creditBundles.some((b) => b.bundleId === ab.bundleId),
              ).map((ab) => (
                <button
                  key={ab.bundleId}
                  type="button"
                  onClick={() => addCreditBundle({ ...ab, quantity: 1 })}
                  style={{
                    border: "1px dashed #d1d5db",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    background: "#f9fafb",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.background  = "#eef2ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.background  = "#f9fafb";
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>{ab.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.2rem" }}>
                    {(ab.creditsEach).toLocaleString("nl-NL")} credits · {fmtEuro(ab.priceCentsEach)}
                  </div>
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#6366f1" }}>
                    + Add to order
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: order summary + CTA ───────────────────────────── */}
        <div>
          <div
            style={{
              position: "sticky",
              top: "6rem",
              border: "1px solid #e5e7eb",
              borderRadius: "0.875rem",
              overflow: "hidden",
              background: "white",
            }}
          >
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ fontWeight: 700, fontSize: "1rem", color: "#111827", margin: 0 }}>Order summary</h2>
            </div>

            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {cart.plan && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#374151" }}>
                  <span>{cart.plan.name} plan</span>
                  <span>{fmtEuro(cart.plan.priceCents)}/mo</span>
                </div>
              )}
              {cart.creditBundles.map((b) => (
                <div key={b.bundleId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#374151" }}>
                  <span>{b.label} ×{b.quantity}</span>
                  <span>{fmtEuro(b.priceCentsEach * b.quantity)}</span>
                </div>
              ))}

              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "0.625rem", marginTop: "0.25rem", display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#111827" }}>
                <span>Due today</span>
                <span style={{ color: "#16a34a" }}>€0</span>
              </div>
              {cart.plan && (
                <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: 0 }}>
                  Plan charges ({fmtEuro(totalCents - cart.creditBundles.reduce((s, b) => s + b.priceCentsEach * b.quantity, 0))}/mo) begin after your 14-day free trial.
                  {cart.creditBundles.length > 0 && " Credit bundles are invoiced separately."}
                </p>
              )}
            </div>

            <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <Link
                href="/checkout"
                style={{
                  display: "block",
                  background: "#111827",
                  color: "white",
                  borderRadius: "0.75rem",
                  padding: "0.875rem 1rem",
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  textDecoration: "none",
                }}
              >
                Proceed to checkout
              </Link>
              <Link
                href="/pricing"
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: "0.8125rem",
                  color: "#6b7280",
                  textDecoration: "none",
                }}
              >
                Back to pricing
              </Link>
            </div>

            {/* Trust signals */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              {[
                "🔒 Secure — 256-bit SSL",
                "💳 No credit card during trial",
                "🚀 Live in under 15 minutes",
                "✖ Cancel any time",
              ].map((t) => (
                <span key={t} style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive grid styles */}
      <style>{`
        .cart-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        .bundle-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.75rem;
        }
        @media (min-width: 768px) {
          .cart-layout {
            grid-template-columns: 1fr 320px;
          }
        }
      `}</style>
    </div>
  );
}
