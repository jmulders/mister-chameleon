"use client";

/**
 * CheckoutBlock
 *
 * Free-trial account creation form.
 *
 * This is a client component that collects name, email, company, and password,
 * POSTs to /api/trial/start, and handles the result states (loading, success,
 * error).  On success the user is presented with a link to their new dashboard.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data.planId     "starter" | "growth" | "pro"
 *   data.heading    Section heading (default: "Create your account")
 *   data.intro      Plan confirmation copy (shown above the form)
 *   data.returnHref Where to send the user after signup (default: "/admin")
 *   data.returnLabel Dashboard CTA label (default: "Go to your dashboard")
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --text, --text-muted, --primary
 *   --card-bg, --card-border, --card-radius
 *   --bg-subtle
 */

import { useState, type FormEvent }  from "react";
import Link                          from "next/link";
import { Container }                  from "@/components/primitives/Container";
import { Section }                    from "@/components/primitives/Section";
import type { CheckoutBlockData }     from "@/page-config";
import { useCartSafe }                from "@/lib/cart/cart-context";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CheckoutBlockProps {
  data:     CheckoutBlockData;
  variant?: string;
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  required,
  placeholder,
  autoComplete,
  hint,
  error,
}: {
  id:           string;
  label:        string;
  type?:        string;
  value:        string;
  onChange:     (v: string) => void;
  required?:    boolean;
  placeholder?: string;
  autoComplete?: string;
  hint?:        string;
  error?:       string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          fontSize:   "0.875rem",
          fontWeight: 500,
          color:      "var(--text)",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--primary, #4f46e5)", marginLeft: "0.2rem" }}>*</span>}
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
          padding:      "0.625rem 0.875rem",
          borderRadius: "var(--card-radius, 0.5rem)",
          border:       error
            ? "1.5px solid #ef4444"
            : "1px solid var(--card-border, #d1d5db)",
          fontSize:     "0.9375rem",
          color:        "var(--text)",
          background:   "var(--card-bg, white)",
          outline:      "none",
          width:        "100%",
          boxSizing:    "border-box",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--primary, #4f46e5)";
          e.target.style.boxShadow   = "0 0 0 3px rgba(79,70,229,0.1)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "#ef4444" : "var(--card-border, #d1d5db)";
          e.target.style.boxShadow   = "none";
        }}
      />
      {hint && !error && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #6b7280)", margin: 0 }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: 0 }}>{error}</p>
      )}
    </div>
  );
}

// ─── Password strength indicator ──────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "12+ characters",         ok: password.length >= 12 },
    { label: "Uppercase letter",       ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",       ok: /[a-z]/.test(password) },
    { label: "Number",                 ok: /\d/.test(password) },
  ];

  const passed  = checks.filter((c) => c.ok).length;
  const pct     = (passed / checks.length) * 100;
  const colors  = ["#ef4444", "#f59e0b", "#eab308", "#22c55e"];
  const barColor = password.length === 0 ? "var(--card-border, #e5e7eb)" : colors[passed - 1] ?? "#ef4444";

  if (password.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "-0.25rem" }}>
      {/* Segmented bar */}
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {checks.map((_, i) => (
          <div
            key={i}
            style={{
              height:       "4px",
              flex:         1,
              borderRadius: "2px",
              background:   i < passed ? barColor : "var(--card-border, #e5e7eb)",
              transition:   "background 0.2s",
            }}
          />
        ))}
      </div>
      {/* Check list */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 1rem" }}>
        {checks.map(({ label, ok }) => (
          <span
            key={label}
            style={{
              fontSize: "0.7rem",
              color:    ok ? "#22c55e" : "var(--text-muted, #9ca3af)",
            }}
          >
            {ok ? "✓" : "○"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessPanel({
  returnHref,
  returnLabel,
  email,
}: {
  returnHref:  string;
  returnLabel: string;
  email:       string;
}) {
  return (
    <div
      style={{
        textAlign:    "center",
        padding:      "3rem 2rem",
        border:       "1px solid var(--card-border, #e5e7eb)",
        borderRadius: "var(--card-radius, 0.75rem)",
        background:   "var(--card-bg, white)",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
      <h2
        style={{
          fontFamily:   "var(--font-heading, inherit)",
          fontWeight:   700,
          fontSize:     "1.5rem",
          color:        "var(--text)",
          marginBottom: "0.75rem",
        }}
      >
        Your account is ready
      </h2>
      <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
        We sent a confirmation email to <strong style={{ color: "var(--text)" }}>{email}</strong>.
      </p>
      <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        Your 14-day free trial has started. You can cancel any time - no credit card needed.
      </p>
      <a
        href={returnHref}
        style={{
          display:        "inline-block",
          background:     "var(--primary, #4f46e5)",
          color:          "white",
          padding:        "0.875rem 2rem",
          borderRadius:   "var(--card-radius, 0.75rem)",
          fontWeight:     600,
          fontSize:       "1rem",
          textDecoration: "none",
        }}
      >
        {returnLabel}
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckoutBlock({ data }: CheckoutBlockProps) {
  const {
    heading     = "Create your account",
    intro,
    returnHref  = "/admin",
    returnLabel = "Go to your dashboard",
    planId: dataPlanId,
  } = data;

  // Prefer cart context planId over the CMS-supplied planId.
  const cartCtx = useCartSafe();
  const planId  = cartCtx?.cart.plan?.planId ?? dataPlanId;

  // Form state
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [company,  setCompany]  = useState("");
  const [password, setPassword] = useState("");

  // Submit state
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!name.trim())                       next.name     = "Full name is required.";
    if (!email.trim())                      next.email    = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email))  next.email    = "Enter a valid email address.";
    if (!company.trim())                    next.company  = "Company name is required.";
    if (password.length < 12)              next.password = "Password must be at least 12 characters.";
    else if (!/[A-Z]/.test(password))      next.password = "Password needs an uppercase letter.";
    else if (!/[a-z]/.test(password))      next.password = "Password needs a lowercase letter.";
    else if (!/\d/.test(password))         next.password = "Password needs a number.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch("/api/trial/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, company, password, planId }),
      });

      const body = await res.json() as { error?: string };

      if (!res.ok) {
        setApiError(body.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        // Scroll to success message
        setTimeout(() => {
          document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Section id="checkout" spacing="lg">
      <Container size="sm">
        {success ? (
          <SuccessPanel returnHref={returnHref} returnLabel={returnLabel} email={email} />
        ) : (
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
                padding:      "2rem 2rem 1.5rem",
                background:   "var(--card-bg, white)",
                borderBottom: "1px solid var(--card-border, #e5e7eb)",
              }}
            >
              <h2
                style={{
                  fontFamily:   "var(--font-heading, inherit)",
                  fontWeight:   700,
                  fontSize:     "1.5rem",
                  color:        "var(--text)",
                  marginBottom: intro ? "0.75rem" : 0,
                  lineHeight:   1.25,
                }}
              >
                {heading}
              </h2>
              {intro && (
                <p
                  style={{
                    fontSize:   "0.9375rem",
                    color:      "var(--text-muted, #6b7280)",
                    lineHeight: 1.6,
                    margin:     0,
                  }}
                >
                  {intro}
                </p>
              )}
            </div>

            {/* Form body */}
            <div
              style={{
                padding:  "2rem",
                background: "var(--bg-subtle, #f9fafb)",
              }}
            >
              <form
                onSubmit={handleSubmit}
                noValidate
                style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
              >
                {/* Global API error */}
                {apiError && (
                  <div
                    role="alert"
                    style={{
                      padding:      "0.75rem 1rem",
                      background:   "#fef2f2",
                      border:       "1px solid #fca5a5",
                      borderRadius: "0.5rem",
                      fontSize:     "0.875rem",
                      color:        "#b91c1c",
                    }}
                  >
                    {apiError}
                  </div>
                )}

                {/* Name + Company in a row on wider screens */}
                <div className="checkout-row" style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
                  <Field
                    id="trial-name"
                    label="Full name"
                    value={name}
                    onChange={setName}
                    required
                    placeholder="Jane Smith"
                    autoComplete="name"
                    error={errors.name}
                  />
                  <Field
                    id="trial-company"
                    label="Company name"
                    value={company}
                    onChange={setCompany}
                    required
                    placeholder="Acme Inc."
                    autoComplete="organization"
                    error={errors.company}
                  />
                </div>

                <Field
                  id="trial-email"
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  error={errors.email}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <Field
                    id="trial-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    required
                    autoComplete="new-password"
                    error={errors.password}
                  />
                  <PasswordStrength password={password} />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    gap:          "0.5rem",
                    background:   loading ? "var(--card-border, #e5e7eb)" : "var(--primary, #4f46e5)",
                    color:        loading ? "var(--text-muted, #9ca3af)" : "white",
                    border:       "none",
                    borderRadius: "var(--card-radius, 0.75rem)",
                    padding:      "0.875rem 1.5rem",
                    fontSize:     "1rem",
                    fontWeight:   600,
                    cursor:       loading ? "not-allowed" : "pointer",
                    transition:   "opacity 0.15s, background 0.15s",
                    width:        "100%",
                  }}
                >
                  {loading ? (
                    <>
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Creating your account…
                    </>
                  ) : (
                    "Start your free trial"
                  )}
                </button>

                {/* Legal note */}
                <p
                  style={{
                    fontSize:  "0.75rem",
                    color:     "var(--text-muted, #9ca3af)",
                    textAlign: "center",
                    margin:    0,
                    lineHeight: 1.5,
                  }}
                >
                  By creating an account you agree to our{" "}
                  <Link href="/terms" style={{ color: "var(--primary, #4f46e5)", textDecoration: "none" }}>Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" style={{ color: "var(--primary, #4f46e5)", textDecoration: "none" }}>Privacy Policy</Link>.
                </p>
              </form>
            </div>

            {/* Footer: trust signals */}
            <div
              style={{
                padding:      "1rem 2rem",
                background:   "var(--card-bg, white)",
                borderTop:    "1px solid var(--card-border, #e5e7eb)",
                display:      "flex",
                justifyContent: "center",
                gap:          "1.5rem",
                flexWrap:     "wrap",
              }}
            >
              {[
                "🔒 256-bit SSL",
                "💳 No credit card",
                "✓ 14-day free trial",
              ].map((label) => (
                <span
                  key={label}
                  style={{ fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Spin animation */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (min-width: 640px) {
            .checkout-row { flex-direction: row !important; }
            .checkout-row > * { flex: 1; }
          }
        `}</style>
      </Container>
    </Section>
  );
}
