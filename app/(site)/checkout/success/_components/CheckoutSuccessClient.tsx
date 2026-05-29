"use client";

/**
 * CheckoutSuccessClient.tsx
 *
 * Shown after Stripe Checkout completes.  Stripe appends ?session_id=cs_...
 * to the URL.  We don't need to call Stripe here — the webhook already
 * handled (or is handling) the account creation.  This page just gives the
 * user a friendly confirmation and points them to the admin dashboard.
 */

import { useEffect, useState } from "react";
import Link                    from "next/link";
import { useCart }             from "@/lib/cart/cart-context";

// ── Animated checkmark ────────────────────────────────────────────────────────

function AnimatedCheck() {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 80, height: 80, marginBottom: "1.5rem" }}
    >
      <circle cx="28" cy="28" r="28" fill="#dcfce7" />
      <path
        d="M16 28.5L23.5 36L40 20"
        stroke="#16a34a"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: "draw 0.5s ease forwards", strokeDasharray: 40, strokeDashoffset: 40 }}
      />
      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps() {
  const steps = [
    { label: "Payment confirmed",     done: true  },
    { label: "Account being created", done: false },
    { label: "Welcome email on its way", done: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", margin: "2rem 0", textAlign: "left", maxWidth: 320, width: "100%" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: s.done ? "#16a34a" : "#e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {s.done
              ? <span style={{ color: "white", fontSize: "0.875rem", fontWeight: 700 }}>✓</span>
              : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af", display: "block" }} />
            }
          </div>
          <span style={{ fontSize: "0.9375rem", color: s.done ? "#111827" : "#6b7280", fontWeight: s.done ? 600 : 400 }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CheckoutSuccessClient() {
  // Give the webhook more time — account creation happens asynchronously
  // after Stripe fires checkout.session.completed. 30s is generous but avoids
  // landing on the login page before the admin_user row exists.
  const [countdown, setCountdown] = useState(30);
  const { clearCart } = useCart();

  // Clear the cart once — payment is confirmed, no need to keep it.
  useEffect(() => { clearCart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-redirect to admin after 30 seconds
  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = "/admin";
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1_000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div style={{
      minHeight: "80vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1.5rem",
    }}>
      <div style={{
        maxWidth: 520,
        width: "100%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <AnimatedCheck />

        <h1 style={{ fontWeight: 800, fontSize: "clamp(1.625rem, 4vw, 2.25rem)", color: "#111827", marginBottom: "0.75rem", lineHeight: 1.2 }}>
          Payment confirmed!
        </h1>

        <p style={{ color: "#6b7280", fontSize: "1rem", lineHeight: 1.6, marginBottom: "0.25rem" }}>
          Thank you — your 14-day free trial has started.
        </p>
        <p style={{ color: "#6b7280", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: 0 }}>
          We're setting up your account now and will send a welcome email
          with login instructions within a few minutes.
        </p>

        <Steps />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: 320 }}>
          <Link
            href="/admin"
            style={{
              display: "block",
              background: "#111827",
              color: "white",
              padding: "0.9375rem 1.5rem",
              borderRadius: "0.75rem",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Go to your dashboard
          </Link>
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af", margin: 0 }}>
            Redirecting automatically in {countdown}s…
          </p>
        </div>

        <div style={{
          marginTop: "2.5rem",
          padding: "1rem 1.5rem",
          background: "#f9fafb",
          borderRadius: "0.75rem",
          border: "1px solid #e5e7eb",
          fontSize: "0.875rem",
          color: "#6b7280",
          lineHeight: 1.6,
          maxWidth: 400,
        }}>
          <strong style={{ color: "#374151" }}>Need help?</strong>{" "}
          If you don't receive a welcome email within 5 minutes, please check your spam folder or{" "}
          <Link href="/contact" style={{ color: "#6366f1", textDecoration: "none" }}>
            contact our support team
          </Link>.
        </div>
      </div>
    </div>
  );
}
