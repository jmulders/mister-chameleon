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
}

export function ConversionBlock({ data }: ConversionBlockProps) {
  if (data.formKey === "book-demo") {
    return <BookingEmbed data={data} />;
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
