"use client";

/**
 * Cookie declaration + preference manager (Cookiebot-style).
 *
 * Lists every cookie this site may set, grouped by consent category, with
 * provider / purpose / retention — and lets the visitor toggle each category and
 * save. Reads and writes the same `mc_consent` cookie the rest of the platform
 * honours (via tracking/consent-store). Drop on a public "/cookies" page or in a
 * consent-settings modal.
 */

import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/tracking/consent-store";
import {
  COOKIE_CATEGORY_ORDER,
  COOKIE_CATEGORY_META,
  cookiesForCategory,
  type CookieCategory,
} from "@/tracking/cookie-registry";

interface Prefs { analytics: boolean; personalization: boolean; enrichment: boolean }

export function CookieDeclaration() {
  const [prefs, setPrefs] = useState<Prefs>({ analytics: false, personalization: false, enrichment: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = getConsent();
    setPrefs({ analytics: c.analytics, personalization: c.personalization, enrichment: c.enrichment });
  }, []);

  const value = (cat: CookieCategory): boolean =>
    cat === "essential" ? true : prefs[cat as keyof Prefs];

  const setValue = (cat: CookieCategory, v: boolean) => {
    if (cat === "essential") return;
    setSaved(false);
    setPrefs((p) => ({ ...p, [cat]: v }));
  };

  function save(next?: Prefs) {
    const s = next ?? prefs;
    setPrefs(s);
    setConsent({ hasResponded: true, ...s });
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => save({ analytics: true, personalization: true, enrichment: true })}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Accept all
        </button>
        <button onClick={() => save({ analytics: false, personalization: false, enrichment: false })}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
          Reject non-essential
        </button>
        <button onClick={() => save()}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
          Save preferences
        </button>
        {saved && <span className="text-xs text-green-600">Preferences saved.</span>}
      </div>

      {COOKIE_CATEGORY_ORDER.map((cat) => {
        const meta    = COOKIE_CATEGORY_META[cat];
        const cookies = cookiesForCategory(cat);
        const on      = value(cat);
        return (
          <section key={cat} className="rounded-lg border border-neutral-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{meta.label}</h3>
                <p className="mt-1 text-xs text-neutral-500">{meta.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={cat === "essential"}
                  onChange={(e) => setValue(cat, e.target.checked)}
                />
                {cat === "essential" ? "Always on" : on ? "Allowed" : "Off"}
              </label>
            </div>

            {cookies.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-neutral-400">
                    <tr>
                      <th className="px-2 py-1 text-left">Cookie</th>
                      <th className="px-2 py-1 text-left">Provider</th>
                      <th className="px-2 py-1 text-left">Purpose</th>
                      <th className="px-2 py-1 text-left">Retention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {cookies.map((c) => (
                      <tr key={c.name}>
                        <td className="px-2 py-1 font-mono text-neutral-800">{c.name}</td>
                        <td className="px-2 py-1 text-neutral-600">{c.provider}</td>
                        <td className="px-2 py-1 text-neutral-600">{c.purpose}</td>
                        <td className="px-2 py-1 text-neutral-500">{c.expiry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
