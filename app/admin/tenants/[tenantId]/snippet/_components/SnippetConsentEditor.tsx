"use client";

/**
 * SnippetConsentEditor
 *
 * Per-tenant consent handling for snippet blocks. The snippet reads the host
 * page's consent from its CMP (publisher signal, IAB TCF, Google Consent Mode,
 * GPC/DNT) and forwards it. This control only decides what happens when the host
 * sends NO signal at all: deny by default ("auto", privacy-first) or grant by
 * default ("always", for hosts that gate loading behind their own banner).
 *
 * An explicit host signal (including GPC/DNT, which always denies) is honoured in
 * both modes; the tenant privacy ceiling (Settings -> Privacy) applies on top.
 */

import { useState, useTransition } from "react";
import { saveSnippetConsentSourceAction } from "../actions";

type ConsentSource = "auto" | "always";

interface Props {
  tenantId:      string;
  initialSource: ConsentSource;
}

const OPTIONS: Array<{ value: ConsentSource; title: string; hint: string }> = [
  {
    value: "auto",
    title: "Auto (deny by default)",
    hint:  "Privacy-first. Enrichment, behavioural personalization and analytics stay off until the host CMP grants consent. Recommended for new sites.",
  },
  {
    value: "always",
    title: "Always (grant by default)",
    hint:  "For hosts that only load the snippet after their own consent banner. Enrichment/personalization/analytics run unless the host explicitly denies (or GPC/DNT is set).",
  },
];

export function SnippetConsentEditor({ tenantId, initialSource }: Props) {
  const [source, setSource] = useState<ConsentSource>(initialSource);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSnippetConsentSourceAction(tenantId, source);
      if (result.ok) setSaved(true);
      else if ("error" in result) setError(result.error as string);
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Consent</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          The snippet reads the host page&apos;s consent from its CMP (publisher signal,
          IAB TCF, Google Consent Mode) and from GPC/DNT. This setting only controls the
          default when the host sends no signal at all.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="space-y-3">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors ${
                source === o.value ? "border-indigo-300 bg-indigo-50/50" : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="consent-source"
                value={o.value}
                checked={source === o.value}
                onChange={() => { setSource(o.value); setSaved(false); }}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-medium text-neutral-900">{o.title}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-green-600">Saved</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save consent setting"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <ul className="space-y-2 pt-1 text-xs text-neutral-500">
          <li className="flex gap-2"><span className="text-indigo-400">•</span> Categories: analytics (GA4/events), personalization (behaviour + journey), enrichment (IP-to-company / Leadinfo).</li>
          <li className="flex gap-2"><span className="text-indigo-400">•</span> The tenant privacy ceiling (Settings -&gt; Privacy) can only further restrict, never expand.</li>
          <li className="flex gap-2"><span className="text-indigo-400">•</span> Publisher setup instructions are in the guide: docs/publisher-consent-handleiding.md.</li>
        </ul>
      </div>
    </section>
  );
}
