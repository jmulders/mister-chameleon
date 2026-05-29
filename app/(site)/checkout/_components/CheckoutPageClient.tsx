"use client";

/**
 * app/(site)/checkout/_components/CheckoutPageClient.tsx
 *
 * Two-column checkout page:
 *   Left  — account creation form (name, company, email, password)
 *   Right — order summary (plan + credit bundles)
 *
 * On submit:
 *   1. POSTs to /api/trial/checkout-session with { name, email, company, password, planId }
 *   2. On success: redirects browser to the Stripe Checkout URL
 *   3. On error: displays the API error inline
 *
 * Stripe redirects back to /checkout/success?session_id=... on completion.
 * Falls back gracefully when the cart is empty (redirect link to /pricing).
 */

import { useState, type FormEvent } from "react";
import Link                          from "next/link";
import { useCart }                   from "@/lib/cart/cart-context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEuro(cents: number): string {
  if (cents % 100 === 0) return `€${cents / 100}`;
  return `€${(cents / 100).toFixed(2)}`;
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  id, label, type = "text", value, onChange,
  required, placeholder, autoComplete, error,
}: {
  id:           string;
  label:        string;
  type?:        string;
  value:        string;
  onChange:     (v: string) => void;
  required?:    boolean;
  placeholder?: string;
  autoComplete?: string;
  error?:       string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label htmlFor={id} style={{ fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>
        {label}
        {required && <span style={{ color: "#6366f1", marginLeft: "0.2rem" }}>*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          padding: "0.625rem 0.875rem",
          borderRadius: "0.625rem",
          border: error ? "1.5px solid #ef4444" : "1px solid #d1d5db",
          fontSize: "0.9375rem",
          color: "#111827",
          background: "white",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#6366f1";
          e.target.style.boxShadow   = "0 0 0 3px rgba(99,102,241,0.1)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "#ef4444" : "#d1d5db";
          e.target.style.boxShadow   = "none";
        }}
      />
      {error && <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: 0 }}>{error}</p>}
    </div>
  );
}

// ── Password strength bar ─────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { ok: password.length >= 12 },
    { ok: /[A-Z]/.test(password) },
    { ok: /[a-z]/.test(password) },
    { ok: /\d/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const colors = ["#ef4444", "#f59e0b", "#eab308", "#22c55e"];
  const bar    = colors[passed - 1] ?? "#ef4444";
  return (
    <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.375rem" }}>
      {checks.map((_, i) => (
        <div key={i} style={{
          height: "4px", flex: 1, borderRadius: "2px",
          background: i < passed ? bar : "#e5e7eb",
          transition: "background 0.2s",
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CheckoutPageClient() {
  const { cart, clearCart, totalCents } = useCart();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [company,  setCompany]  = useState("");
  const [password, setPassword] = useState("");

  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Redirect if cart is empty ────────────────────────────────────────────────

  if (!cart.plan && cart.creditBundles.length === 0) {
    return (
      <div style={{ maxWidth: "480px", margin: "6rem auto", padding: "0 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🛒</div>
        <h1 style={{ fontWeight: 700, fontSize: "1.5rem", color: "#111827", marginBottom: "0.75rem" }}>
          Nothing to check out yet
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
          Pick a plan or credit bundle on the pricing page first.
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

  // ── Validation ───────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim())                      next.name     = "Full name is required.";
    if (!email.trim())                     next.email    = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email    = "Enter a valid email address.";
    if (!company.trim())                   next.company  = "Company name is required.";
    if (password.length < 12)             next.password = "Password must be at least 12 characters.";
    else if (!/[A-Z]/.test(password))     next.password = "Password needs an uppercase letter.";
    else if (!/[a-z]/.test(password))     next.password = "Password needs a lowercase letter.";
    else if (!/\d/.test(password))        next.password = "Password needs a number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch("/api/trial/checkout-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name,
          email,
          company,
          password,
          planId: cart.plan?.planId ?? "starter",
        }),
      });

      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setApiError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
      } else {
        // Hand off to Stripe Checkout — keep loading=true, page is navigating away.
        // Cart is cleared on the success page after payment is confirmed.
        window.location.href = data.url;
      }
    } catch {
      setApiError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const creditTotal = cart.creditBundles.reduce((s, b) => s + b.priceCentsEach * b.quantity, 0);
  const planPrice   = cart.plan?.priceCents ?? 0;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

      <h1 style={{ fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#111827", marginBottom: "2.5rem" }}>
        Create your account
      </h1>

      <div className="checkout-grid">

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.875rem", overflow: "hidden", background: "white" }}>

            {/* Header */}
            <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", color: "#111827", margin: 0 }}>
                {cart.plan ? `Starting your ${cart.plan.name} trial` : "Account details"}
              </h2>
              {cart.plan && (
                <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.375rem", marginBottom: 0 }}>
                  14-day free trial. You'll add a card now but won't be charged until the trial ends.
                </p>
              )}
            </div>

            {/* Form body */}
            <div style={{ padding: "2rem", background: "#f9fafb" }}>
              <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {apiError && (
                  <div role="alert" style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#b91c1c" }}>
                    {apiError}
                  </div>
                )}

                <div className="form-row">
                  <Field id="co-name"    label="Full name"    value={name}    onChange={setName}    required placeholder="Jane Smith"   autoComplete="name"         error={errors.name}    />
                  <Field id="co-company" label="Company name" value={company} onChange={setCompany} required placeholder="Acme Inc."    autoComplete="organization" error={errors.company} />
                </div>

                <Field id="co-email"    label="Work email" type="email"    value={email}    onChange={setEmail}    required placeholder="you@company.com" autoComplete="email"        error={errors.email}    />
                <Field id="co-password" label="Password"   type="password" value={password} onChange={setPassword} required                               autoComplete="new-password" error={errors.password} />
                <PasswordStrength password={password} />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    background:   loading ? "#e5e7eb" : "#111827",
                    color:        loading ? "#9ca3af" : "white",
                    border:       "none",
                    borderRadius: "0.75rem",
                    padding:      "0.9375rem 1.5rem",
                    fontSize:     "1rem",
                    fontWeight:   600,
                    cursor:       loading ? "not-allowed" : "pointer",
                    width:        "100%",
                    marginTop:    "0.25rem",
                  }}
                >
                  {loading ? "Redirecting to Stripe…" : cart.plan ? "Start free trial" : "Complete order"}
                </button>

                <p style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
                  By creating an account you agree to our{" "}
                  <Link href="/terms"   style={{ color: "#6366f1", textDecoration: "none" }}>Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" style={{ color: "#6366f1", textDecoration: "none" }}>Privacy Policy</Link>.
                </p>
              </form>
            </div>

            {/* Trust signals footer */}
            <div style={{ padding: "1rem 2rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
              {["🔒 256-bit SSL", "💳 Secure Stripe checkout", "✓ 14-day free trial"].map((t) => (
                <span key={t} style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Order summary sidebar ─────────────────────────────────────────── */}
        <div>
          <div style={{ position: "sticky", top: "5rem", border: "1px solid #e5e7eb", borderRadius: "0.875rem", overflow: "hidden", background: "white" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#111827", margin: 0 }}>Order summary</h2>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {cart.plan && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#374151" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{cart.plan.name} plan</div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>14-day free trial</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>{fmtEuro(planPrice)}/mo</div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>after trial</div>
                  </div>
                </div>
              )}

              {cart.creditBundles.map((b) => (
                <div key={b.bundleId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#374151" }}>
                  <span>{b.label} ×{b.quantity}</span>
                  <span>{fmtEuro(b.priceCentsEach * b.quantity)}</span>
                </div>
              ))}

              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.9375rem", color: "#111827" }}>
                  <span>Due today</span>
                  <span style={{ color: "#16a34a" }}>€0</span>
                </div>
                {creditTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.375rem" }}>
                    <span>Credits (invoiced separately)</span>
                    <span>{fmtEuro(creditTotal)}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f3f4f6" }}>
              <Link href="/cart" style={{ fontSize: "0.8125rem", color: "#6b7280", textDecoration: "none" }}>
                ← Edit cart
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .checkout-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (min-width: 640px) {
          .form-row {
            flex-direction: row;
          }
          .form-row > * { flex: 1; }
        }
        @media (min-width: 768px) {
          .checkout-grid {
            grid-template-columns: 1fr 300px;
          }
        }
      `}</style>
    </div>
  );
}
