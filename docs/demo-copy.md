# Demo copy — the three roles (concept)

Concept copy for the misterchameleon.nl demo, one set per role. **First draft — the
merkstrateeg owns the final wording** (the variants *are* the positioning). English,
to match the platform UI; localise to Dutch if the audience calls for it.

**How to use it.** Each role's rule already points at an existing variant key. Paste
the copy below into the CMS (Statamic) for that key, and the demo stops being bare:
switching role in the top switcher swaps the hero + cta to role-tailored copy, while
the rest of the page (proof, sections) stays. Keep every hero the **same length /
shape** so the page doesn't jump when it swaps.

The through-line across all four: **the colour changes, not the animal** — same
promise (one site that adapts per visitor, measurably), a different entry point.

---

## Default — the baseline everyone sees first

*Keys: hero `hero_direct_brand` · cta `cta_guide` · proof `proof_default`*

- **Hero title:** One website. Every visitor.
- **Hero subtitle:** Your site keeps its promise — and adapts its entry point to who's
  reading. Same message, a different way in.
- **CTA:** See how it works
- **Proof line:** Server-side, measurable, and privacy-first — your data stays in Europe.

---

## Marketer (at an end client)

*Keys: hero `hero_consideration` · cta `cta_demo`*

- **Hero title:** Your ads are sharp. Your landing page isn't.
- **Hero subtitle:** You target precisely — then everyone lands on the same page, in the
  same order. We make the landing match the ad, and you measure whether it pays off.
- **CTA:** Book a demo

## Agency owner

*Keys: hero `hero_linkedin_vision` · cta `cta_platform`*

- **Hero title:** A version per visitor — for every client site, without building landing
  pages.
- **Hero subtitle:** One layer over the sites you already manage. Set it up once from the
  positioning, steer it monthly. A new retainer line that's stewardship, not production.
- **CTA:** Explore the platform

## Technical lead

*Keys: hero `hero_google_problem` · cta `cta_meeting`*

- **Hero title:** One line of code. Server-side. No flicker.
- **Hero subtitle:** The decision runs on the server within a 700 ms budget, with a safe
  default — if it ever fails, the visitor simply gets your normal page. No profiles tied
  to a name; data in Europe.
- **CTA:** Talk to us

---

## Notes

- The three role rules keep **proof and the rest of the page on the default** — only
  hero + cta change per role. That's deliberate (the advisor's "alleen hero en cta
  wisselen").
- These keys are **shared** with other rules on the demo tenant. On a demo tenant that's
  fine; on a real customer you'd give each role its **own** variant key so shared
  variants aren't affected.
- The `interestPrimary` shown in the profile panel per role: Marketer → *conversion*,
  Agency owner → *partnership*, Technical lead → *integration*. Adjust to taste.
