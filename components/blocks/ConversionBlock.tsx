"use client";

/**
 * ConversionBlock
 *
 * Renders the adaptive conversion section that sits at the bottom of the
 * homepage (after-content position).  Three modes:
 *
 *   formKey === "book-demo"   — Embeds the full BookDemoClient calendar inline
 *                               (date → time → details → confirmation).
 *   formKey === "contact"     — Standard headline + CTA buttons (links to /contact).
 *   formKey === undefined     — Standard headline + CTA buttons.
 *
 * Data comes from the ConversionBlockData resolved by the decision engine.
 */

import type { ConversionBlockData } from "@/cms/types";
import { BookDemoClient }           from "@/app/(site)/book-demo/_components/BookDemoClient";
import { getBookDemoTranslations }  from "@/app/(site)/book-demo/_components/translations";
import Link                         from "next/link";

// ─────────────────────────────────────────────────────────────────────────────

interface ConversionBlockProps {
  data: ConversionBlockData;
  /**
   * Admin preview mode (default false). When true the book-demo variant renders
   * a lightweight static placeholder instead of the full BookDemoClient calendar
   * (which fetches live availability). CTA / contact variants render identically
   * to the live site. Has no effect on the live site (callers never set it there).
   */
  preview?: boolean;
}

export function ConversionBlock({ data, preview = false }: ConversionBlockProps) {
  if (data.formKey === "book-demo") {
    return preview ? <BookingPlaceholder data={data} /> : <BookingEmbed data={data} />;
  }
  return <StandardConversion data={data} />;
}

// ── Booking embed ─────────────────────────────────────────────────────────────

function BookingEmbed({ data }: { data: ConversionBlockData }) {
  const t = getBookDemoTranslations("en");

  return (
    <section className="py-20 px-4 bg-[var(--muted)]">
      <div className="mx-auto max-w-2xl mb-10 text-center">
        <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight mb-3">
          {data.title}
        </h2>
        <p className="text-lg text-[var(--muted-foreground)] leading-relaxed">{data.text}</p>
        {data.urgencyLabel && (
          <p className="mt-2 text-sm font-medium text-[var(--primary)]">
            {data.urgencyLabel}
          </p>
        )}
      </div>

      <BookDemoClient t={t} />
    </section>
  );
}

// ── Booking placeholder (admin preview only) ──────────────────────────────────
//
// The live book-demo variant embeds BookDemoClient, a heavy multi-step widget
// that fetches availability from /api/demo/availability. In the admin preview we
// skip that entirely and show a static stand-in with the same header, so the
// drawer preview stays fast and makes no network calls.

function BookingPlaceholder({ data }: { data: ConversionBlockData }) {
  return (
    <section className="py-20 px-4 bg-[var(--muted)]">
      <div className="mx-auto max-w-2xl mb-8 text-center">
        <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight mb-3">
          {data.title}
        </h2>
        <p className="text-lg text-[var(--muted-foreground)] leading-relaxed">{data.text}</p>
        {data.urgencyLabel && (
          <p className="mt-2 text-sm font-medium text-[var(--primary)]">
            {data.urgencyLabel}
          </p>
        )}
      </div>

      <div className="mx-auto max-w-md rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-8 text-center">
        {/* Schematic calendar (static, non-interactive). */}
        <div className="mx-auto mb-5 grid w-40 grid-cols-4 gap-1.5" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`h-6 rounded ${i === 5 ? "bg-[var(--primary)]" : "bg-[var(--muted)]"}`}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Booking calendar shown live on the page
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          The interactive date and time picker loads for visitors. It is omitted
          from this preview so no availability is fetched.
        </p>
      </div>
    </section>
  );
}

// ── Standard headline + CTAs ──────────────────────────────────────────────────

function StandardConversion({ data }: { data: ConversionBlockData }) {
  return (
    <section className="py-20 px-4 bg-[var(--foreground)] text-[var(--background)]">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">{data.title}</h2>
        <p className="text-lg text-[var(--background)]/70 leading-relaxed mb-8">{data.text}</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {data.ctas.map((cta, i) => (
            <Link
              key={i}
              href={cta.href}
              className={
                i === 0
                  ? "rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  : "rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              }
            >
              {cta.label}
            </Link>
          ))}
        </div>

        {data.urgencyLabel && (
          <p className="mt-4 text-sm text-white/50">{data.urgencyLabel}</p>
        )}
      </div>
    </section>
  );
}
