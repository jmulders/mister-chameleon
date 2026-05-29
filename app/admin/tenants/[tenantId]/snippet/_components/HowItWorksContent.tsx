/**
 * HowItWorksContent
 *
 * Stateless content panel — explains the end-to-end flow of the snippet.
 * Rendered as the "How it works" tab in SnippetTabs.
 */

export function HowItWorksContent() {
  return (
    <div className="space-y-10 text-sm text-neutral-700">

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5">
        <div className="flex flex-col gap-3">
          {([
            ["1", "bg-indigo-100 text-indigo-700",  "Script tag in <head>",     "Your site loads. The browser fetches the snippet JS from Mister Chameleon, asynchronously — no render blocking."],
            ["2", "bg-amber-100  text-amber-700",   "Page is hidden",            "The snippet sets opacity: 0 on the page immediately, so the visitor never sees a flash of the default content."],
            ["3", "bg-sky-100    text-sky-700",     "Visitor signals collected", "The snippet reads UTM params, the referrer URL, the session cookie, and the locale cookie — all first-party, no tracking pixels."],
            ["4", "bg-violet-100 text-violet-700",  "Decision request",          "A POST to /api/snippet/decide is sent with the site key + visitor signals. The request goes to Mister Chameleon's servers."],
            ["5", "bg-green-100  text-green-700",   "Rules engine runs",         "The server looks up the visitor's history, runs the same rule engine that powers server-rendered pages, and selects the best variant."],
            ["6", "bg-green-100  text-green-700",   "CMS content fetched",       "The winning variant's content is fetched from the CMS. The server returns a flat map of slot names → text values."],
            ["7", "bg-indigo-100 text-indigo-700",  "Content is swapped",        "Back in the browser, the snippet finds every element tagged data-mc-slot and replaces its text with the personalised value."],
            ["8", "bg-neutral-100 text-neutral-600","Page is revealed",          "opacity: 1 is restored. The visitor sees the personalised page — the swap is invisible."],
          ] as const).map(([num, colours, title, desc]) => (
            <div key={num} className="flex items-start gap-4">
              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colours}`}>
                {num}
              </span>
              <div>
                <p className="font-semibold text-neutral-900">{title}</p>
                <p className="mt-0.5 text-neutral-500 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── The four parts ───────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-base font-semibold text-neutral-900">The four moving parts</h2>

        <div className="space-y-5">

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">1 · The script tag</h3>
            <p className="text-xs text-neutral-500 mb-3">One line in your site&apos;s <code className="font-mono bg-neutral-100 px-1 rounded">&lt;head&gt;</code>. Nothing else to install.</p>
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 px-4 py-3 text-xs text-neutral-100 leading-relaxed">
              <code>{`<script
  src="https://app.misterchameleon.com/api/snippet.js"
  data-site-key="sk_live_abc123"
  async
></script>`}</code>
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              The <code className="font-mono bg-neutral-100 px-1 rounded">async</code> attribute is required — it tells the browser not to wait for the script before rendering the rest of the page.
              The <code className="font-mono bg-neutral-100 px-1 rounded">data-site-key</code> is your public identifier, visible to anyone who views source. It is not a secret.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">2 · The snippet script</h3>
            <p className="text-xs text-neutral-500">
              Served from <code className="font-mono bg-neutral-100 px-1 rounded">/api/snippet.js</code>, cached for 1 hour on the CDN.
              The script is tiny — a self-contained IIFE that does exactly four things: hide the page, collect signals, call the decide endpoint, swap content and reveal.
              It has zero dependencies and adds no cookies of its own.
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              If the decide endpoint does not respond within <strong>1.5 seconds</strong>, the script calls off the swap and reveals the page unchanged.
              The visitor always sees something — personalisation is best-effort, never a blocker.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">3 · The decide endpoint</h3>
            <p className="text-xs text-neutral-500 mb-2">
              <code className="font-mono bg-neutral-100 px-1 rounded">POST /api/snippet/decide</code> — the personalisation brain.
            </p>
            <p className="text-xs text-neutral-500">
              Receives the site key and visitor context. Identifies the tenant, loads the visitor&apos;s
              behavioural history from the database, and runs the same rule engine that powers
              server-rendered pages. Selects the best hero/proof/CTA variants, fetches their content
              from the CMS, and returns a flat JSON object:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-950 px-4 py-3 text-xs text-neutral-100 leading-relaxed">
              <code>{`{
  "slots": {
    "hero-title":     "Your website, personalised.",
    "hero-subtitle":  "The right message for every visitor.",
    "hero-cta-label": "Start free trial",
    "hero-cta-href":  "/signup",
    "cta-title":      "Ready to personalise?",
    ...
  }
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">4 · The markup convention</h3>
            <p className="text-xs text-neutral-500 mb-3">
              You mark the elements you want personalised with <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-slot</code>.
              Nothing else changes in your HTML — the slot attribute is the only addition.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 px-4 py-3 text-xs text-neutral-100 leading-relaxed">
              <code>{`<!-- Before: plain HTML -->
<h1>Default headline</h1>
<p>Default copy here.</p>
<a href="/signup">Sign up free</a>

<!-- After: add data-mc-slot attributes -->
<h1   data-mc-slot="hero-title">Default headline</h1>
<p    data-mc-slot="hero-subtitle">Default copy here.</p>
<a    data-mc-slot="hero-cta-label"
      data-mc-slot-href="hero-cta-href"
      href="/signup">Sign up free</a>`}</code>
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              The snippet swaps <code className="font-mono bg-neutral-100 px-1 rounded">textContent</code> by default.
              For elements that need HTML (bold text, links), add <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-html=&quot;true&quot;</code> to use <code className="font-mono bg-neutral-100 px-1 rounded">innerHTML</code> instead.
              Use <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-slot-href</code> on <code className="font-mono bg-neutral-100 px-1 rounded">&lt;a&gt;</code> elements to also swap the <code className="font-mono bg-neutral-100 px-1 rounded">href</code>.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">Common questions</h2>

        {([
          {
            q: "Does the snippet affect page speed?",
            a: "No. The script tag has async so it never blocks rendering. The 1.5 s timeout means the swap either happens quickly or not at all — the page always loads at its normal speed.",
          },
          {
            q: "Is the site key a secret?",
            a: "No. It is embedded in your HTML and visible to anyone who views source. It identifies your tenant so the decide endpoint returns the right content — it does not grant access to any admin or write operations. If a key is misused, regenerate it on the Install tab; the old key stops working immediately.",
          },
          {
            q: "Does it work with React / Next.js / Vue?",
            a: "Yes. The snippet operates on the DOM after the page has rendered, so it works with any framework or static HTML. For server-rendered Next.js apps you may prefer the full server-rendering pipeline instead — it avoids the opacity flash entirely.",
          },
          {
            q: "What happens if a visitor has JavaScript disabled?",
            a: "They see your original default content. The snippet is a progressive enhancement — your site works fine without it.",
          },
          {
            q: "Does it set cookies?",
            a: "No. The snippet reads first-party cookies already set by Mister Chameleon (mc_sid, mc_locale) but does not create any new ones.",
          },
          {
            q: "Can I personalise elements that are not text?",
            a: "Currently the snippet swaps text content (or innerHTML with data-mc-html) and href attributes. Background images, CSS classes, and other attributes are not supported out of the box — reach out if you need a custom implementation.",
          },
        ] as const).map(({ q, a }) => (
          <div key={q} className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="font-semibold text-neutral-900 text-xs mb-1.5">{q}</p>
            <p className="text-xs text-neutral-500 leading-relaxed">{a}</p>
          </div>
        ))}
      </section>

    </div>
  );
}
