"use client";

import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form,   setForm  ] = useState({ name: "", email: "", company: "", message: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-3xl mb-3">🎉</div>
        <h3 className="font-semibold text-emerald-900">Je bericht is verstuurd</h3>
        <p className="mt-2 text-sm text-emerald-700">
          Je krijgt binnen één werkdag antwoord.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[color:var(--text)] mb-1">
            Naam
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jan de Vries"
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--text)]"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[color:var(--text)] mb-1">
            Zakelijk e-mailadres
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jan@bedrijf.nl"
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--text)]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="company" className="block text-sm font-medium text-[color:var(--text)] mb-1">
          Bedrijf
        </label>
        <input
          id="company"
          type="text"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Acme B.V."
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--text)]"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[color:var(--text)] mb-1">
          Je vraag
        </label>
        <textarea
          id="message"
          rows={4}
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Waar kunnen we je mee helpen?"
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--text)] resize-none"
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-[color:color-mix(in_srgb,#dc2626_50%,var(--text))]">
          Versturen is niet gelukt. Mail ons dan op info@misterchameleon.nl.
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-[var(--bg-inverse)] px-6 py-3 text-sm font-semibold text-[color:var(--text-inverse)] hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {status === "sending" ? "Bezig met versturen…" : "Verstuur"}
      </button>
    </form>
  );
}
