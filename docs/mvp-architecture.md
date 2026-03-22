# MVP Architecture

This document describes the Mister Chameleon MVP layer by layer — what each layer does, where it lives, how it fits together, and where it can be extended in phase 2.

---

## System overview

Every homepage request passes through the same pipeline:

```
Browser request
      │
      ▼
┌─────────────────────┐
│     Middleware       │  sets mc_session_id + mc_seen cookies; no I/O
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Context Layer     │  detects source, device, visitType from request headers
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Decision Layer     │  maps VisitorContext → ExperiencePlan (variant keys)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     CMS Layer        │  fetches hero/proof/cta block data for each key
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Experience Composer  │  assembles HomepageExperience; applies fallback cascade
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Homepage Renderer   │  RSC passes experience data to block components; streams HTML
└──────────┬──────────┘
           │  response sent
           ▼
┌─────────────────────┐
│    Data Layer        │  after(): writes session, served_variants, page_view event
└─────────────────────┘
```

All of this happens server-side on every request. The client receives fully rendered HTML; no personalisation decisions happen in the browser.

---

## Middleware

**File:** `src/middleware.ts`

Runs at the Edge before every page route (not API routes, not static assets).

Responsibilities:
- Read `mc_session_id` and `mc_seen` from the incoming `Cookie` header.
- If `mc_session_id` is absent, generate a new UUID v4 and inject it into the forwarded request headers so the page Server Component can read it immediately, before the browser sees the `Set-Cookie` response.
- If `mc_seen` is absent (new visitor), queue it to be written onto the response — but **not** forwarded to the page. Its absence is what signals a new visit to the context detector.
- Write any new cookies (`mc_session_id`, `mc_seen`) to the response via `response.cookies.set()`.

The middleware is zero-I/O: it only reads and writes headers and cookie strings. It runs in microseconds.

**Cookie model:**

| Cookie | Value | httpOnly | Purpose |
|---|---|---|---|
| `mc_session_id` | UUID v4 | yes | Identifies the visitor's session (30-day expiry) |
| `mc_seen` | `"1"` | yes | Marks a returning visitor (365-day expiry) |

---

## Context layer

**Barrel:** `@/context`
**Key files:** `src/context/detect-context.ts`, `src/context/helpers.ts`, `src/context/safe-context.ts`

Takes a standard `Request` object and returns a `VisitorContext` — a typed snapshot of every signal extracted from that request.

### Resolved dimensions

These three fields drive the decision engine:

| Field | Type | Source |
|---|---|---|
| `source` | `"linkedin" \| "google" \| "direct" \| "unknown"` | Referrer header + UTM parameters |
| `device` | `"mobile" \| "desktop"` | User-Agent header |
| `visitType` | `"new" \| "returning"` | `mc_seen` cookie presence |

### Raw signal fields

These are preserved for debugging and future rule authoring: `rawReferrer`, `referrerDomain`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `userAgent`, `resolvedAt`.

### Source detection logic

Traffic source is resolved in priority order:

1. UTM parameters: `utm_source=linkedin` → `"linkedin"`, `utm_source=google` → `"google"`
2. Referrer domain: `linkedin.com` variants → `"linkedin"`, `google.*` variants → `"google"`
3. Absence of both UTM and referrer → `"direct"`
4. Anything else → `"unknown"`

### Safe wrapper

`safeDetectVisitorContext()` (in `safe-context.ts`) wraps `detectVisitorContext()` in a try/catch. On any failure it returns `DEFAULT_VISITOR_CONTEXT` — a safe, fully-typed fallback — rather than throwing. This is what the homepage uses so context detection can never cause a 500.

---

## Decision layer

**Barrel:** `@/decision`
**Key files:** `src/decision/rules/homepage-rules.ts`, `src/decision/providers/rules-decision-provider.ts`

Takes a `VisitorContext` and returns an `ExperiencePlan` — three variant keys (one per adaptive block section).

### ExperiencePlan shape

```typescript
interface ExperiencePlan {
  heroKey: HeroVariantKey;    // e.g. "hero_google_problem"
  proofKey: ProofVariantKey;  // e.g. "proof_cases"
  ctaKey: CTAVariantKey;      // e.g. "cta_guide"
  reason: string;             // human-readable, logged + shown in debug panel
}
```

### Rule evaluation

Rules live in `HOMEPAGE_RULES` (an ordered array). The engine iterates rules in array order and returns the plan of the first rule whose `match(context)` returns `true`. If no rule matches, `DEFAULT_HOMEPAGE_PLAN` is returned.

**Current rules (in priority order):**

| ID | Condition | Plan |
|---|---|---|
| `homepage.google` | `source === "google"` | `hero_google_problem` / `proof_cases` / `cta_guide` |
| `homepage.linkedin` | `source === "linkedin"` | `hero_linkedin_vision` / `proof_vision` / `cta_platform` |
| _(default)_ | no match | `hero_direct_brand` / `proof_platform` / `cta_meeting` |

### Provider interface

`DecisionProvider` is an interface with one method: `getHomepagePlan(context): Promise<ExperiencePlan>`. `RulesDecisionProvider` is the only implementation in the MVP. The interface exists so a database-backed, ML-based, or test provider can be swapped in without changing any other code.

---

## CMS layer

**Barrel:** `@/cms`
**Key files:** `src/cms/providers/cms-provider.ts`, `src/cms/providers/sanity-provider.ts`, `src/cms/providers/mock-provider.ts`, `src/cms/providers/create-cms-provider.ts`

Fetches block content for a given variant key. Returns typed block data or `null` (never throws).

### CMSProvider interface

```typescript
interface CMSProvider {
  getHeroVariant(key: string): Promise<HeroBlockData | null>;
  getProofVariant(key: string): Promise<ProofBlockData | null>;
  getCTAVariant(key: string): Promise<CTABlockData | null>;
}
```

### Provider selection

`createCMSProvider()` reads `SANITY_PROJECT_ID` at call time:

- **Present** → returns `SanityProvider` (live Sanity CDN queries with Next.js ISR)
- **Absent** → returns `MockCMSProvider` (in-memory data, zero I/O, works without any CMS setup)

Both providers implement the same interface, so the experience composer never knows or cares which is active.

### SanityProvider

Fetches content via `@sanity/client` using GROQ queries. Each query is parameterised by `$key` and filtered by `isActive == true`. Results participate in Next.js ISR: responses are cached with a `revalidate: 60` tag and can be invalidated on-demand via `revalidateTag("sanity")` from a webhook route.

### Block data types

| Type | Fields |
|---|---|
| `HeroBlockData` | `id`, `title`, `subtitle`, `cta: { label, href }`, `tag?` |
| `ProofBlockData` | `id`, `title`, `items: [{ title, text }]` |
| `CTABlockData` | `id`, `title`, `text`, `cta: { label, href }` |

### Mapper layer

Raw Sanity response shapes (`SanityHeroRaw` etc.) differ slightly from the internal block data types. Mappers in `src/cms/mappers/sanity/` translate between them. This means Sanity schema changes only require a mapper update — the rest of the application is insulated.

---

## Experience composer

**Barrel:** `@/experience`
**Key files:** `src/experience/compose-experience.ts`, `src/experience/safe-compose.ts`, `src/experience/fallback-content.ts`

Orchestrates the decision and CMS layers into a single `HomepageExperience` — the render-ready value the homepage receives.

### Composition steps

1. `decisionProvider.getHomepagePlan(context)` → `ExperiencePlan`
2. Three parallel CMS fetches: `getHeroVariant`, `getProofVariant`, `getCTAVariant`
3. Validate all three results are non-null
4. Return `HomepageExperience` + `ExperienceComposerMeta`

### Four-level fallback cascade

The system is designed so the homepage **always renders** even if every external dependency is down:

```
Level 1  Decision engine fails or throws
         → DEFAULT_HOMEPAGE_PLAN  (brand-led keys, defined in homepage-rules.ts)

Level 2  One or more primary CMS variants return null
         → Re-fetch using FALLBACK_PLAN keys (hero_direct_brand / proof_platform / cta_meeting)
         → All-or-nothing: a mixed experience (one good variant, one fallback) is incoherent

Level 3  Fallback CMS variants also return null (CMS completely down)
         → buildInlineFallbackExperience(): hardcoded content baked into the bundle
         → No network calls. Cannot fail.

Level 4  The entire composer throws (unforeseen error)
         → safeComposeHomepageExperience() outer try/catch
         → Returns inline fallback content
         → Logs at error level for alerting
```

### HomepageExperience shape

```typescript
interface HomepageExperience {
  hero: HeroBlockData;   // always non-null (fallback applied before this type is constructed)
  proof: ProofBlockData;
  cta: CTABlockData;
  plan: ExperiencePlan;  // includes reason string and variant keys
}
```

---

## Data layer

**Barrel:** `@/data`
**Key files:** `src/data/db.ts`, `src/data/session.ts`, `src/data/repositories/`

Handles all Supabase persistence. All repository functions return typed result objects (`{ ok: true, data }` or `{ ok: false, error }`) — never throw.

### Tables

**`sessions`** — one row per unique `mc_session_id` cookie:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | From the `mc_session_id` cookie |
| `created_at` | timestamptz | Auto |
| `source` | text | Traffic source |
| `device` | text | Device class |
| `visit_type` | text | `new` or `returning` |
| `pathname` | text | Page served (always `/` in MVP) |
| `referrer` | text | Raw referrer |
| `utm_source` | text | UTM parameters |
| `utm_medium` | text | |
| `utm_campaign` | text | |

**`served_variants`** — one row per page render:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto |
| `session_id` | uuid | FK → sessions.id |
| `hero_key` | text | Variant key served |
| `proof_key` | text | |
| `cta_key` | text | |
| `reason` | text | Decision rule reason |
| `used_fallback` | boolean | Whether fallback was active |

**`events`** — one row per client-side event:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto |
| `session_id` | uuid | FK → sessions.id |
| `event_type` | text | `page_view`, `cta_click`, `scroll_depth`, `variant_served` |
| `payload` | jsonb | Event-specific data |
| `created_at` | timestamptz | Auto |

### Write timing

All three writes happen in `after()` — a Next.js 15 API that defers async work until after the response has been streamed to the browser. The DB writes never block the render. If they fail, the error is logged but the visitor is unaffected.

### Supabase client

`getDb()` in `src/data/db.ts` returns a singleton `SupabaseClient` using the service-role key (bypasses RLS). The module uses `import "server-only"` so it can never be bundled into client code.

---

## Tracking

**Barrel:** `@/tracking`
**Key files:** `src/tracking/track-event.ts`, `src/tracking/event-types.ts`
**Components:** `src/components/tracking/PageTracker.tsx`, `ScrollDepthTracker.tsx`, `TrackedCTAButton.tsx`

### Server-side tracking

`page_view` and `variant_served` events are written directly from the homepage Server Component via `after()`. These never require client JS.

### Client-side tracking

Three invisible Client Components are rendered at the bottom of the homepage:

| Component | Event fired | When |
|---|---|---|
| `PageTracker` | `page_view` | On mount (covers SPAs / client navigations) |
| `ScrollDepthTracker` | `scroll_depth` | At 25%, 50%, 75% scroll milestones |
| `TrackedCTAButton` | `cta_click` | On CTA button click |

All client-side events are sent to `POST /api/events` via `trackEvent()`. The API route reads the `mc_session_id` cookie to attribute the event to the correct session.

### Event types

Defined in `src/tracking/event-types.ts` as a strict allowlist:

```typescript
"page_view" | "variant_served" | "cta_click" | "scroll_depth"
```

The API route validates `eventType` against this list and rejects unknown values with a 422.

---

## Contact + n8n flow

**Key files:** `src/app/api/contact/route.ts`, `src/contact/validate-contact.ts`, `src/contact/send-to-n8n.ts`

```
Browser → POST /api/contact (JSON body)
              │
              ▼
        validateContactRequest()    — field presence, length, email format
              │
              ▼
         sendToN8n()                — POST to N8N_CONTACT_WEBHOOK_URL
              │
         ┌───┴───────────────────────────────────────────────────┐
         │                                                         │
    webhook not set                                        webhook set
    → ok: true (dev no-op)                                        │
                                                     ┌────────────┴──────────┐
                                                  2xx                     non-2xx
                                               → ok: true            → ok: false → 500
```

**n8n payload:**

```json
{
  "name": "string",
  "email": "string",
  "organization": "string | null",
  "message": "string",
  "submittedAt": "ISO 8601 UTC"
}
```

Contact submissions are not persisted to Supabase in the MVP. n8n is the system of record for leads. A contacts table can be added in phase 2 if an audit trail or CRM sync is needed.

---

## Known limitations

**Decision rules are static.** `HOMEPAGE_RULES` is a TypeScript array compiled into the bundle. Changing a rule requires a code deploy. Phase 2 should move rules to a database table or Sanity document type so non-engineers can manage them.

**Only three variant keys per dimension.** The type system uses strict string literal unions for `HeroVariantKey`, `ProofVariantKey`, and `CTAVariantKey`. Adding a new variant requires a code change to extend those types — you cannot add a new variant purely in Sanity without also updating the types.

**Single page.** The pipeline is built only for `/`. Other routes (blog posts, pricing, etc.) render a generic experience.

**No rate limiting.** `POST /api/contact` and `POST /api/events` are public endpoints with no rate limiting. This is acceptable for MVP load levels but should be addressed before scaling.

**No CSRF protection on contact form.** The contact endpoint relies on same-origin fetch. Explicit CSRF tokens should be added before launch.

**Scroll depth milestones are fixed.** `ScrollDepthTracker` fires at 25%, 50%, 75%. The thresholds are hardcoded.

**Session ID is predictable in format.** `mc_session_id` is a standard UUID v4. It is not a signed token, so in theory any UUID value could be submitted to `/api/events`. This is acceptable for anonymous behavioural analytics but would need hardening for anything sensitive.

**n8n has no fallback queue.** If n8n is down when a contact form is submitted, the submission is lost. An outbox table would address this.

---

## Phase 2 extension points

### Multi-page personalisation

The context + decision + experience pipeline is built to be reusable. To extend it to other pages:

1. Create a new `DecisionProvider` for the new page (or add rules to the homepage provider with a `pathname` condition).
2. Add new block types to the CMS if new content shapes are needed.
3. Create a new `composeXxxExperience()` function following the same pattern as `composeHomepageExperience`.

### CMS-managed decision rules

`RulesDecisionProvider` is a concrete implementation of the `DecisionProvider` interface. A `SanityDecisionProvider` or `DatabaseDecisionProvider` could be added alongside it. `createDecisionProvider()` (analogous to `createCMSProvider()`) would select the right implementation at startup.

### Additional visitor signals

`detectVisitorContext()` currently reads source, device, and visit type. The function signature accepts a standard `Request`, so additional signals (geolocation from Vercel headers, accept-language, custom segment cookies) can be added to `VisitorContext` without touching any downstream code.

### Analytics dashboard

All data is in Supabase. The `served_variants` and `events` tables provide a complete picture of which experiences were shown and how visitors behaved. A read-only dashboard can query these tables directly.

### Cache invalidation webhook

`SanityProvider` tags all fetches with `"sanity"`. A `POST /api/revalidate` route that calls `revalidateTag("sanity")` would give instant cache invalidation when content is published in Sanity, without a full deploy.

### A/B testing infrastructure

The `ExperiencePlan` already carries a `reason` field. A `WeightedDecisionProvider` could assign variant plans probabilistically, record the assignment in `served_variants`, and expose the data for statistical analysis.

### Rate limiting

API routes (`/api/contact`, `/api/events`) are natural places to add Upstash Ratelimit or an edge middleware rule. Both routes already return structured error objects, so adding a 429 case is straightforward.
