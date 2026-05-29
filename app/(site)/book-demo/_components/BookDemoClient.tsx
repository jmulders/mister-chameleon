"use client";

/**
 * BookDemoClient
 *
 * A self-contained, multi-step demo booking widget that looks and feels
 * like Calendly — date picker, time slot grid, contact form, confirmation.
 *
 * ─── Step flow ────────────────────────────────────────────────────────────────
 *
 *   1. Date      — month calendar; weekends disabled
 *   2. Time      — 30-minute slots fetched live from /api/demo/availability
 *   3. Details   — name, email, company, phone, message
 *   4. Confirmed — success screen with booking summary
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Slot fetch:  GET /api/demo/availability?date=YYYY-MM-DD
 *   Booking:     POST /api/demo/book { date, time, name, email, ... }
 *
 * ─── i18n ─────────────────────────────────────────────────────────────────────
 *
 *   All user-visible strings are supplied via the `t` prop (BookDemoTranslations).
 *   Pass getBookDemoTranslations("en" | "nl" | "de") from the page server component.
 */

import { useState, useCallback, useEffect } from "react";
import type { BookDemoTranslations } from "./translations";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = "date" | "time" | "details" | "confirmed";

interface BookingState {
  date:    string | null;   // YYYY-MM-DD
  time:    string | null;   // HH:MM
  name:    string;
  email:   string;
  company: string;
  phone:   string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────────────────────────────────────

const TODAY_STR = new Date().toISOString().slice(0, 10);

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Monday … 6 = Sunday (week starts Monday) */
function getFirstDayOfWeek(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  return (jsDay + 6) % 7; // convert so Mon=0
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function formatDisplayDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step, t }: { step: Step; t: BookDemoTranslations }) {
  const steps: { key: Step; label: string }[] = [
    { key: "date",      label: t.stepDate      },
    { key: "time",      label: t.stepTime      },
    { key: "details",   label: t.stepDetails   },
    { key: "confirmed", label: t.stepConfirmed },
  ];
  const current = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-0 mb-8 px-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${i < current
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : i === current
                    ? "border-[var(--primary)] text-[var(--primary)] bg-white"
                    : "border-gray-200 text-gray-400 bg-white"
                }
              `}
            >
              {i < current ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs font-medium ${
                i === current ? "text-[var(--primary)]" : i < current ? "text-emerald-600" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${
                i < current ? "bg-emerald-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Mini calendar ──────────────────────────────────────────────────────────

function MiniCalendar({
  selected,
  onSelect,
  t,
}: {
  selected: string | null;
  onSelect: (date: string) => void;
  t: BookDemoTranslations;
}) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow    = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  // Disable navigation to past months
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-gray-900 text-base">
          {t.months[viewMonth - 1]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {t.dayHeaders.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr    = ymd(viewYear, viewMonth, day);
          const isPast     = dateStr < TODAY_STR;
          const isWeekend_ = isWeekend(dateStr);
          const isToday    = dateStr === TODAY_STR;
          const isSelected = dateStr === selected;
          const disabled   = isPast || isWeekend_;

          return (
            <button
              key={day}
              onClick={() => !disabled && onSelect(dateStr)}
              disabled={disabled}
              className={`
                relative h-9 w-full rounded-lg text-sm font-medium transition-all
                ${isSelected
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-700 hover:bg-[var(--primary)] hover:text-white cursor-pointer"
                }
                ${isToday && !isSelected ? "ring-2 ring-[var(--primary)] ring-offset-1" : ""}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">
        {t.weekendsNote}
      </p>
    </div>
  );
}

// ── Time slots grid ────────────────────────────────────────────────────────

function TimeSlotsGrid({
  date,
  selected,
  onSelect,
  t,
}: {
  date:     string;
  selected: string | null;
  onSelect: (time: string) => void;
  t: BookDemoTranslations;
}) {
  const [slots,   setSlots]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlots([]);

    fetch(`/api/demo/availability?date=${date}`)
      .then((r) => r.json() as Promise<{ ok: boolean; slots?: string[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.slots) {
          setSlots(data.slots);
        } else {
          setError(data.error ?? t.errorLoadSlots);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t.errorConnect);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [date, t.errorLoadSlots, t.errorConnect]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">{t.loadingSlots}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-2 text-xs text-red-500 underline"
        >
          {t.tryAgain}
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-gray-600 font-medium">{t.noSlotsTitle}</p>
        <p className="text-sm text-gray-400 mt-1">{t.noSlotsBody}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        {t.availableTimesPrefix}{formatDisplayDate(date)}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
        {slots.map((slot) => (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            className={`
              py-2.5 rounded-lg text-sm font-medium border transition-all text-center
              ${selected === slot
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-[var(--primary)] hover:text-[var(--primary)]"
              }
            `}
          >
            {formatTime12h(slot)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Form field ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  hint,
}: {
  label:    string;
  required?: boolean;
  children: React.ReactNode;
  hint?:    string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface BookDemoClientProps {
  t: BookDemoTranslations;
}

export function BookDemoClient({ t }: BookDemoClientProps) {
  const [step, setStep] = useState<Step>("date");
  const [booking, setBooking] = useState<BookingState>({
    date: null, time: null,
    name: "", email: "", company: "", phone: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BookingState, string>>>({});

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDateSelect = useCallback((date: string) => {
    setBooking((b) => ({ ...b, date, time: null }));
    setStep("time");
  }, []);

  const handleTimeSelect = useCallback((time: string) => {
    setBooking((b) => ({ ...b, time }));
    setStep("details");
  }, []);

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof BookingState, string>> = {};
    if (!booking.name.trim())  errors.name  = t.errorNameRequired;
    if (!booking.email.trim()) errors.email = t.errorEmailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) {
      errors.email = t.errorEmailInvalid;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/demo/book", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          date:    booking.date,
          time:    booking.time,
          name:    booking.name.trim(),
          email:   booking.email.trim(),
          company: booking.company.trim() || undefined,
          phone:   booking.phone.trim()   || undefined,
          message: booking.message.trim() || undefined,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? t.errorGeneric);
      } else {
        setStep("confirmed");
      }
    } catch {
      setSubmitError(t.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBooking({ date: null, time: null, name: "", email: "", company: "", phone: "", message: "" });
    setFormErrors({});
    setSubmitError(null);
    setStep("date");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Header band */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{t.cardTitle}</h2>
              <p className="text-white/60 text-xs">{t.cardSubtitle}</p>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            {t.cardDescription}
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {step !== "confirmed" && <StepIndicator step={step} t={t} />}

          {/* ── Step 1: Date ────────────────────────────────────────────── */}
          {step === "date" && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-6">{t.chooseDateTitle}</h3>
              <MiniCalendar
                selected={booking.date}
                onSelect={handleDateSelect}
                t={t}
              />
            </div>
          )}

          {/* ── Step 2: Time ────────────────────────────────────────────── */}
          {step === "time" && booking.date && (
            <div>
              <button
                onClick={() => setStep("date")}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t.backToCalendar}
              </button>

              <h3 className="text-base font-semibold text-gray-900 mb-2">{t.chooseTimeTitle}</h3>
              <p className="text-sm text-gray-500 mb-5">
                {formatDisplayDate(booking.date)} · {t.timezone}
              </p>

              <TimeSlotsGrid
                date={booking.date}
                selected={booking.time}
                onSelect={handleTimeSelect}
                t={t}
              />
            </div>
          )}

          {/* ── Step 3: Details ─────────────────────────────────────────── */}
          {step === "details" && booking.date && booking.time && (
            <div>
              {/* Booking summary pill */}
              <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{formatDisplayDate(booking.date)}</p>
                  <p className="text-xs text-gray-500">{formatTime12h(booking.time)} · {t.duration}</p>
                </div>
                <button
                  onClick={() => setStep("time")}
                  className="text-xs text-[var(--primary)] font-medium hover:underline flex-shrink-0"
                >
                  {t.changeSlot}
                </button>
              </div>

              <h3 className="text-base font-semibold text-gray-900 mb-5">{t.yourDetailsTitle}</h3>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t.labelFullName} required>
                    <input
                      type="text"
                      value={booking.name}
                      onChange={(e) => setBooking((b) => ({ ...b, name: e.target.value }))}
                      placeholder={t.placeholderName}
                      className={`${inputClass} ${formErrors.name ? "ring-2 ring-red-300 border-red-300" : ""}`}
                      autoComplete="name"
                    />
                    {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                  </Field>

                  <Field label={t.labelWorkEmail} required>
                    <input
                      type="email"
                      value={booking.email}
                      onChange={(e) => setBooking((b) => ({ ...b, email: e.target.value }))}
                      placeholder={t.placeholderEmail}
                      className={`${inputClass} ${formErrors.email ? "ring-2 ring-red-300 border-red-300" : ""}`}
                      autoComplete="email"
                    />
                    {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t.labelCompany} hint={t.hintCompany}>
                    <input
                      type="text"
                      value={booking.company}
                      onChange={(e) => setBooking((b) => ({ ...b, company: e.target.value }))}
                      placeholder={t.placeholderCompany}
                      className={inputClass}
                      autoComplete="organization"
                    />
                  </Field>

                  <Field label={t.labelPhone} hint={t.hintPhone}>
                    <input
                      type="tel"
                      value={booking.phone}
                      onChange={(e) => setBooking((b) => ({ ...b, phone: e.target.value }))}
                      placeholder={t.placeholderPhone}
                      className={inputClass}
                      autoComplete="tel"
                    />
                  </Field>
                </div>

                <Field label={t.labelMessage} hint={t.hintMessage}>
                  <textarea
                    rows={3}
                    value={booking.message}
                    onChange={(e) => setBooking((b) => ({ ...b, message: e.target.value }))}
                    placeholder={t.placeholderMessage}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                {submitError && (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <p className="text-sm text-red-600">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t.submittingLabel}
                    </>
                  ) : (
                    <>
                      {t.submitLabel}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-400">
                  {t.submitNote}
                </p>
              </form>
            </div>
          )}

          {/* ── Step 4: Confirmed ────────────────────────────────────────── */}
          {step === "confirmed" && booking.date && booking.time && (
            <div className="text-center py-4">
              {/* Success icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center">
                  <svg className="w-9 h-9 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmedTitle}</h3>
              <p className="text-gray-500 text-sm mb-8">
                {t.confirmedBody}{" "}
                <span className="font-medium text-gray-700">{booking.email}</span>.
              </p>

              {/* Booking summary card */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 mb-8 text-left">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">{t.confirmedBookingLabel}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <span className="text-sm text-gray-700 font-medium">{formatDisplayDate(booking.date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-700">{formatTime12h(booking.time)} · {t.duration} · {t.timezone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span className="text-sm text-gray-700">{booking.name}{booking.company ? ` · ${booking.company}` : ""}</span>
                  </div>
                </div>
              </div>

              {/* What to expect */}
              <div className="text-left mb-8">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">{t.confirmedExpectLabel}</p>
                <ul className="space-y-2">
                  {t.confirmedExpectItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={resetBooking}
                className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors"
              >
                {t.bookAnother}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
