# Product Boundary Reference

**Version:** 1.0.0
**Last reviewed:** 2026-03-15
**Owner:** Product
**Audience:** Sales (AMs), Delivery, Product

---

## What this document is

This is the authoritative reference for what the Mister Chameleon platform supports, what is planned, and what it will never do.

Use it to qualify client requirements before signing, to scope deliveries accurately, and to resolve "can the platform do X?" questions without guessing.

**The four boundary states used throughout this document:**

| Status | Meaning |
|--------|---------|
| `supported` | Works today. Deliver without extra conditions or negotiation. |
| `planned` | On the roadmap. Architecture is designed but not yet delivered. Do not promise to clients without a committed date. |
| `conditional` | Works only under defined conditions (specific tier, specific config). Outside those conditions, it does not work. |
| `unsupported` | Hard boundary. Will not be built in any configuration. If a client's requirements depend on this, resolve before signing. |

---

## CMS Providers

The platform abstracts content delivery behind a provider interface. All content rendered by adaptive pages flows through the `CMSProvider` abstraction — the decision engine never talks to a CMS directly. This means the provider can change without touching the decision or rendering layers.

### Sanity — `supported`

The reference CMS for the platform. Block schemas are designed to align with Sanity document types, making it the lowest-friction provider to onboard.

**Required environment variables:** `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`

**Schema alignment:** Native — no custom mapper required.

**Known limitations:**
- Live preview requires Sanity's Presentation tool, which is not included in standard onboarding.
- Only published documents are served to adaptive pages; drafts are not visible.
- Image CDN URLs from Sanity require the `@sanity/image-url` package at build time.
- Multi-dataset setups (e.g. one dataset per locale) are not supported within a single tenant config.

**Delivery note:** Define block document types (`hero_block`, `proof_block`, `cta_block`) with a string `variant_key` field. The mock provider's schema matches this pattern exactly — use it as the Sanity studio schema specification.

---

### Storyblok — `supported`

Supported via a mapper layer that translates Storyblok component fields to the platform's block types. Clients who already use Storyblok can connect their existing stories after a field-mapping session during onboarding.

**Required environment variables:** `STORYBLOK_ACCESS_TOKEN`

**Schema alignment:** Mapped — a mapper must be configured during onboarding.

**Known limitations:**
- Storyblok's visual editor and live preview are not connected to the adaptive pipeline.
- The mapper layer is not zero-configuration — allow one day of onboarding time for field mapping and smoke testing.
- Only published Storyblok stories are served; draft/version management is bypassed.
- Nested Storyblok components beyond one level deep are not supported inside adaptive blocks.

---

### Statamic — `supported`

Supported via the Statamic REST API, with a mapper layer translating Statamic entry fields to platform block types. Suitable for clients on the Laravel/PHP stack with existing Statamic installations.

**Required environment variables:** `STATAMIC_API_URL`, `STATAMIC_API_KEY`

**Schema alignment:** Mapped — a mapper must be configured during onboarding.

**Known limitations:**
- REST API only — the Statamic GraphQL API is not used.
- Live preview is not connected to the adaptive pipeline.
- Statamic's Bard and Replicator field types are not supported in adaptive blocks; plain text fields only.
- Multi-site Statamic setups require a separate tenant config per site.

---

### CMS providers that are NOT supported

The platform will not integrate with CMS providers that deliver content as raw HTML blobs (e.g. WordPress classic editor output, Contentful rich text, Drupal body fields). The block model requires structured fields (`title`, `subtitle`, `cta.label`, `cta.href`). HTML parsers are not part of the platform's architecture.

**If a client uses a non-supported CMS:** They have two options — migrate the relevant content to Sanity, Storyblok, or Statamic before onboarding begins, or use the mock provider during an extended onboarding while migration is planned. The mock provider must never be used in production.

---

## Page Types

The adaptive platform today operates on the **homepage only**. All other page types are either on the roadmap or outside scope.

### Homepage — `supported` (all tiers)

The homepage adaptive pipeline is the flagship delivery in every package tier. The decision engine selects hero, proof, and CTA variants independently on every request. The `TenantPageConfig.homepage` flag is `true` by default in all tenant configs.

### Campaign Landing Pages — `planned` (Growth+)

The decisioning and rendering infrastructure is fully capable of serving adaptive landing pages today. What is missing is the campaign landing page route, campaign-specific variant key types in `decision/types.ts`, and CMS schemas for those keys. This is on the roadmap — do not promise it to clients without a confirmed delivery date.

### Product / Service Pages — `planned` (Growth+)

The same infrastructure gap as campaign landing pages. A product-page route and product-page variant key type are needed. No structural blocker exists. Treat as planned until a specific client engagement triggers the build.

### Page types that will NOT be adapted

The following page types are outside the platform's scope. These are deliberate boundaries, not oversights:

| Page Type | Reason |
|-----------|--------|
| Pricing Page | Personalising pricing creates legal and regulatory risk, inconsistent pricing surfaces, and trust erosion if visitors compare notes. |
| Blog Posts / Articles | The hero × proof × cta block model does not apply to editorial long-form content. |
| Case Study Pages | Case studies carry fixed editorial content. A well-chosen CTA variant linking to the right case study is the correct pattern — not adapting the case study itself. |
| About / Team Pages | Static brand and trust content. Personalisation provides little conversion value here and risks undermining authenticity. |

---

## Decision Providers

The decision engine selects the experience plan (which hero, proof, and CTA variant to show) on every request. Two providers are available.

### Rules-Based Provider — `supported` (all tiers)

An ordered rule set evaluated on every request. Zero AI cost. Zero added latency. Active from day one on all tiers.

**Signals the rules engine can act on:**
- Traffic source: `linkedin`, `google`, `direct`, `unknown`
- Device class: `mobile`, `desktop`
- Visit type: `new`, `returning`
- UTM parameters: `utmSource`, `utmMedium`, `utmCampaign`
- Referrer domain
- First-party visitor history: page views, CTA clicks, session count, last variant seen, conversion flag

**What the rules engine cannot do:**
- Act on real-time firmographic data (company name, industry, employee count) — there is no third-party enrichment API.
- Resolve IP-to-company — this is a deliberate privacy boundary; no reverse IP lookup.
- Read LinkedIn profile data — there is no LinkedIn API integration.
- Query CRM contact status in real time (e.g. "is this person already a customer?").
- Consume a predictive lead score from an external model.

---

### AI-Augmented Provider — `conditional` (Growth+)

An LLM evaluates the full `DecisionInput` when the rules engine confidence is below the configured threshold. Falls back to rules when AI is unavailable or when latency exceeds the policy limit.

**Conditions required to activate:**
1. Growth or Scale commercial tier.
2. `aiDecisionProvider: true` in the tenant's `TenantConfig.features`.
3. An `AiDecisionProvider` subclass wired into the page route.
4. Confidence policy configured in `decision/ai-confidence-policy.ts`.
5. Rules provider present as the fallback — AI cannot be deployed without it.

**What AI adds over rules:** Natural language interpretation of ambiguous UTM combinations; pattern inference for visitor histories where rule predicates are underspecified.

**What AI still cannot do:** Real-time external data lookups during evaluation; fine-tuned client-specific training; deterministic reproducible output.

---

## Adaptive Content Blocks

Every adaptive page is composed of three independently variant-keyed blocks. Each block has a fixed standard variant count and a defined scope of what is and isn't variable.

### Hero Block — `supported`

**Standard variant count:** 3 (e.g. `hero_google_problem`, `hero_linkedin_vision`, `hero_direct_brand`)
**Content editable by:** Client via their CMS

**What is adaptive (variable per variant):**
- `title` — primary headline
- `subtitle` — supporting paragraph
- `cta.label` — CTA button label
- `cta.href` — CTA destination URL
- `tag` — optional eyebrow badge above the headline

**What is NOT variable between variants:**
- Block layout and section structure (single-column above-the-fold)
- Number of CTAs (one primary CTA per variant)
- Media area (no hero image or video in standard product)
- Animation and entrance effects
- Typography scale

**Out of scope for this block:**
- Hero image or video background
- Secondary CTA button
- Animated copy or typewriter effects
- Multi-column hero layout
- Countdown timer or urgency widget
- Embedded contact form in the hero

---

### Proof Block — `supported`

**Standard variant count:** 3 (e.g. `proof_cases`, `proof_vision`, `proof_platform`)
**Content editable by:** Client via their CMS

**What is adaptive:**
- `title` — section heading
- `items[].title` — short bold label per proof point (stat, quote attribution, badge label)
- `items[].text` — one-to-two sentence supporting copy per proof point

**What is NOT variable:**
- Number of proof items per variant (standardised at 3)
- Proof item layout (horizontal card row)
- No logo grid in standard product

**Out of scope:**
- Client logo grid / logo strip
- Star ratings or G2 / Trustpilot widgets
- Testimonial carousel or slider
- Video testimonials
- Live animated stat counters
- Per-item CTA links

---

### CTA Block — `supported`

**Standard variant count:** 3 (e.g. `cta_guide`, `cta_platform`, `cta_meeting`)
**Content editable by:** Client via their CMS

**What is adaptive:**
- `title` — large display headline
- `text` — supporting paragraph
- `cta.label` — CTA button label
- `cta.href` — CTA destination URL

**What is NOT variable:**
- Layout (full-width, centred content)
- Number of CTAs (one primary)
- Background colour (uses `bgInverse` from tenant theme — dark section)

**Out of scope:**
- Inline contact form as the CTA
- Calendly or booking widget embed (link to an external booking URL instead)
- Secondary CTA
- Countdown timer
- Background image or per-variant gradient
- Block-level conditional logic (variant selection is done by the decision engine, not block markup)

---

## Brand Theming

The platform ships one design system. Brand customisation is delivered through a `TenantTheme` config that injects CSS custom properties at request time. All components inherit from this cascade — no component code changes when the theme changes.

### What theming covers

| Property | CSS Variable | What it affects |
|----------|--------------|-----------------|
| Primary brand colour | `--color-brand-primary` | Buttons, links, interactive states, focus rings |
| Brand hover colour | `--color-brand-primary-hover` | Button and link hover states |
| Brand active colour | `--color-brand-primary-active` | Button pressed states |
| Subtle brand tint | `--color-brand-primary-subtle` | Badges, highlights, lightly tinted areas |
| Brand text colour | `--color-brand-text-brand` | Inline brand-coloured text labels |
| Primary text | `--color-text-text` | Main body copy and headings |
| Muted text | `--color-text-text-muted` | Secondary labels, captions |
| Page background | `--color-background-bg` | Main page background |
| Subtle background | `--color-background-bg-subtle` | Recessed panels, inset areas |
| Inverse background | `--color-background-bg-inverse` | Dark sections (CTA block background) |
| Border | `--color-border-border` | Component borders, dividers, input outlines |
| Strong border | `--color-border-border-strong` | Emphasised borders, focus outlines |
| Corner radius | `--radius-*` | All component corner radii. Three personalities: `sharp` (0px), `balanced` (8px/16px), `rounded` (12px/24px) |

Theming applies at **tenant level** — one theme config governs the entire deployment. All pages and all sections inherit the same CSS custom property set.

### What theming does NOT cover

- **Custom typography or web fonts** — system font stack only; no font loading in the standard theme
- **Per-page or per-section colour overrides** — one theme, all pages
- **Per-variant visual styling** — all variants of a block share the same theme
- **Dark mode custom palette per tenant** — a single system media-query dark mode exists globally; tenants cannot provide a custom dark palette
- **Custom icon sets** — Lucide React is the platform icon system
- **Custom illustration or image assets via theme config** — images are managed in the CMS
- **Component-level CSS overrides** — all components derive from the CSS custom property cascade
- **Animation or motion preferences** — no motion theming
- **Full design system replacement** — the platform ships one design system; replacing it is custom work

---

## Unsupported Architectural Extensions

The following patterns will not be added to the platform under any circumstances. These are not roadmap items. A client requirement that maps to any of these entries is a qualification blocker.

---

### Client-Side Personalisation

**Why unsupported:** The platform's adaptive rendering is server-side by design. Client-side personalisation (reading cookies or localStorage in the browser, then swapping content) produces layout shift, is blocked by ad blockers, and defeats the purpose of the server-side architecture.

**Alternative:** All personalisation is server-side via the decision engine. Browser-side preference state belongs in the client application layer, outside the adaptive pipeline.

---

### Cross-Site or Cross-Session Identity Stitching

**Why unsupported:** The platform uses a first-party session cookie (`mc_session_id`) scoped to the current site. It does not stitch identities across domains, fingerprint devices, or use third-party identity graphs. Adding cross-site tracking would undermine the platform's privacy positioning and GDPR alignment.

**Alternative:** If cross-domain identity resolution is needed, the client should use a purpose-built CDP. The platform can receive a resolved identity token as a UTM or cookie value if the client implements this themselves.

---

### PII Storage in the Platform Database

**Why unsupported:** The platform database (events, sessions, served_variants, experiments) stores no personally identifiable information. Session IDs are opaque random identifiers. Storing PII would require a full GDPR compliance review, data processing agreements, and retention policies that are outside the platform's scope.

**Alternative:** PII flows through n8n to the client's CRM. The CRM holds PII; the platform holds anonymous behavioural signals.

---

### Third-Party Cookie Dependency

**Why unsupported:** Third-party cookies are deprecated in Chrome and blocked by default in Firefox and Safari. Building a dependency on them would make the platform non-functional for a large portion of the client's visitors.

**Alternative:** All signals are first-party — referrer header, UTM parameters, first-party session cookie, and first-party event history. These work without third-party cookies.

---

### External ML Model Integration for Decision Selection

**Why unsupported:** Custom ML models (TensorFlow, client data science scoring APIs) are not supported decision providers. Integrating an arbitrary external model introduces unpredictable latency, requires custom error handling, and breaks the confidence policy and fallback model.

**Alternative:** If a client has a lead scoring model, they can use n8n to post-process enriched contact submissions and append a score to their CRM record. The platform does not consume external scores as decision inputs.

---

### Real-Time Bidirectional CRM Sync

**Why unsupported:** The CRM integration is one-way and event-driven — contact submissions dispatch an enriched payload to n8n, which routes to the client's CRM. Two-way sync (reading CRM status to inform personalisation in real time) is outside the integration model.

**Alternative:** One-way enriched dispatch via n8n is in-product. Real-time CRM-driven personalisation can be explored as custom work under a separate SOW.

---

### Full Frontend Redesign / Custom Design System

**Why unsupported:** The platform ships one design system. Brand theming via CSS custom properties covers colours, radius, and metadata. Replacing the component library with client-provided React components converts the platform from a product into a custom build.

**Alternative:** The theming system covers brand-level visual identity. If specific design requirements go beyond this, MC can scope a custom frontend engagement as a separate SOW — but this is custom work, not product.

---

### On-Premise or Self-Hosted Deployment

**Why unsupported:** The platform is a cloud-native Next.js application designed for edge deployment (Vercel, Cloudflare). It depends on edge runtime APIs and CDN-level caching that are not available in a typical on-premise environment.

**Alternative:** Deployment to Vercel (recommended) or compatible edge platforms. If a client has strict data residency requirements, discuss Vercel's EU/regional deployment options.

---

### Shared Database Across Client Tenants

**Why unsupported:** Each client deployment has its own isolated database. Tenant data is never stored alongside other clients' data. A shared multi-tenant database schema is not supported.

**Alternative:** Each client gets their own Supabase project. The tenant config points to that client's database.

---

### Third-Party Marketing Pixel Injection

**Why unsupported:** Third-party pixels (Facebook Pixel, LinkedIn Insight Tag, TikTok Pixel, etc.) introduce uncontrolled third-party requests, conflict with the first-party data posture, and require a consent management layer that is outside scope.

**Alternative:** Clients who need tracking pixels should add them via their own Google Tag Manager container or by editing the base layout outside MC's configuration layer. This is outside MC's delivery scope.

---

### Hardcoded HTML as CMS Content

**Why unsupported:** The platform CMS layer expects structured data with typed fields (`title`, `subtitle`, `cta.label`, `cta.href`). CMS providers that output raw HTML blobs are incompatible with the mapper pattern. HTML parsers are not part of the platform architecture.

**Alternative:** Migrate the relevant content to a supported structured CMS (Sanity, Storyblok, or Statamic), or use the mock provider during an extended onboarding while migration is planned.

---

## Using These Boundaries in a Sales Conversation

When a client names a requirement during discovery:

1. Match it to an entry in this document.
2. If the status is **`supported`** — proceed. No extra qualification needed.
3. If the status is **`planned`** — acknowledge it's on the roadmap, but do not include it in the current engagement scope unless a committed date exists.
4. If the status is **`conditional`** — confirm the conditions are met (right tier, right config). If they're not, explain what's needed.
5. If the status is **`unsupported`** — this is a blocker. Provide the alternative path, and if the client's core requirement depends on an unsupported pattern, resolve this before advancing to contract.

**The machine-readable version of this document lives in `product/boundaries.ts`.** The `checkRequirements()` helper accepts a list of requirement IDs and returns a structured breakdown of blockers, conditionals, planned items, and supported items — suitable for embedding in a proposal generation workflow.

---

## Keeping These Boundaries Current

This document and `product/boundaries.ts` must be updated together whenever:

- A new CMS provider is added
- A page type moves from `planned` to `supported`
- A decision provider changes tier or conditions
- A new unsupported extension is agreed by the product team
- An existing unsupported extension is reconsidered (requires explicit product sign-off)

Increment `ProductBoundaries.version` (minor for additions, major for status changes) and update `lastReviewedAt` with the review date.
