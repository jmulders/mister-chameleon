"use client";

/**
 * NewsletterForm
 *
 * Client component that owns the interactive newsletter email-capture form
 * used by the `cta_newsletter` variant of CtaSectionBlock.
 *
 * Extracted here so CtaSectionBlock can remain a Server Component — the
 * `onSubmit` handler is the only client-side interactivity needed.
 */

export function NewsletterForm() {
  return (
    <form
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-[360px]"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Newsletter signup"
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="Enter your email"
        className="min-w-0 flex-1 rounded-md border px-4 py-2.5 text-sm outline-none focus:ring-2"
        style={{
          background:   "var(--card-bg, #ffffff)",
          borderColor:  "var(--card-border, #e2e8f0)",
          borderRadius: "var(--radius-interactive, 0.5rem)",
          color:        "var(--text)",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore — CSS custom property
          "--tw-ring-color": "var(--primary)",
        }}
      />
      <button
        type="submit"
        className="shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
        style={{
          background:    "var(--primary)",
          borderRadius:  "var(--radius-interactive, 0.5rem)",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          "--tw-ring-color": "var(--primary)",
        }}
      >
        Subscribe
      </button>
    </form>
  );
}
