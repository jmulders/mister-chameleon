# Sanity Content Setup

This document covers everything needed to connect Mister Chameleon to a live Sanity CMS: schema registration, required document types, the nine variant documents that must exist before going live, and seed import instructions.

---

## Overview

By default the app runs with `MockCMSProvider` — built-in content that requires no Sanity setup. To use real CMS-managed content in production, set `SANITY_PROJECT_ID` in your environment. The app will then use `SanityProvider`, which fetches content via GROQ from your Sanity CDN.

The switch is automatic: `createCMSProvider()` reads `SANITY_PROJECT_ID` at startup and selects the correct provider. No code changes needed.

---

## Prerequisites

- A Sanity account and project ([sanity.io](https://www.sanity.io))
- A Sanity Studio project (v3) with schema access
- `SANITY_PROJECT_ID`, `SANITY_DATASET`, and `SANITY_API_VERSION` set in your environment

---

## Step 1: Register the schemas in Sanity Studio

The schemas are pre-written in `src/sanity/schemas/`. Copy them into your Studio project:

```
src/sanity/schemas/
  heroVariant.ts     →  your-studio/schemaTypes/heroVariant.ts
  proofVariant.ts    →  your-studio/schemaTypes/proofVariant.ts
  ctaVariant.ts      →  your-studio/schemaTypes/ctaVariant.ts
```

Then register them in your Studio's `schemaTypes/index.ts`:

```typescript
import heroVariant from './heroVariant';
import proofVariant from './proofVariant';
import ctaVariant from './ctaVariant';

export const schemaTypes = [heroVariant, proofVariant, ctaVariant];
```

Deploy your Studio after making this change.

---

## Step 2: Create the nine content documents

The app requires exactly **nine documents** — three per block type. Each document is identified by its `key` field, which must match a variant key from the decision engine exactly.

If any expected key is missing from Sanity, the composer activates its fallback cascade and serves the fallback plan instead. All nine documents must be active (`isActive: true`) for the full adaptive experience to work correctly.

### Required hero variant keys

| Key | Used for | Audience intent |
|---|---|---|
| `hero_google_problem` | Google organic traffic | Problem-aware, searching for a solution |
| `hero_linkedin_vision` | LinkedIn social traffic | Thought-leadership, vision-oriented |
| `hero_direct_brand` | Direct / fallback | Brand clarity, safe for any visitor |

### Required proof variant keys

| Key | Used for | Proof angle |
|---|---|---|
| `proof_cases` | Google traffic | Concrete ROI numbers and case studies |
| `proof_vision` | LinkedIn traffic | Industry recognition, analyst perspectives |
| `proof_platform` | Direct / fallback | Technical reliability and platform scale |

### Required CTA variant keys

| Key | Used for | CTA intent |
|---|---|---|
| `cta_guide` | Google traffic | Lead nurture — free guide download |
| `cta_platform` | LinkedIn traffic | Product-led — create account |
| `cta_meeting` | Direct / fallback | Sales-led — book a demo |

---

## Step 3: Populate the documents

### Option A — Import seed data (recommended)

The seed file at `src/sanity/seed/homepage-variants.ts` contains all nine documents with production-ready copy.

**Generate an NDJSON file:**

```bash
npx tsx src/sanity/seed/homepage-variants.ts > seed.ndjson
```

**Import using the Sanity CLI:**

```bash
npm install -g @sanity/cli
sanity dataset import seed.ndjson production
```

This creates all nine documents as published (not drafts). Run from your Studio project directory or pass `--project` and `--dataset` flags.

**Import via the Sanity HTTP API (for CI/CD):**

```bash
curl -X POST \
  "https://$SANITY_PROJECT_ID.api.sanity.io/v$SANITY_API_VERSION/data/mutate/$SANITY_DATASET" \
  -H "Authorization: Bearer $SANITY_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mutations": [
      { "create": { "_type": "heroVariant", "_id": "hero-google-problem", ... } },
      ...
    ]
  }'
```

### Option B — Manual Studio entry

Create each document manually in the Sanity Studio UI. Use the `key` slug values from the tables above exactly — the GROQ queries match on `key.current == $key`.

---

## Field reference

### heroVariant

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | Slug | ✅ | Must match a `HeroVariantKey`. Use the slug generator. |
| `title` | String | ✅ | Primary headline. Max 120 chars. Target ≤80 for visual fit. |
| `subtitle` | Text | ✅ | Supporting paragraph. 1–2 sentences. Max 300 chars. |
| `ctaLabel` | String | ✅ | CTA button text. Max 60 chars. |
| `ctaHref` | String | ✅ | CTA destination. Relative (`#signup`) or absolute. |
| `tag` | String | optional | Eyebrow badge above the headline. Max 80 chars. |
| `sourceTags` | Array | optional | Informational — does not affect routing. |
| `stageTags` | Array | optional | Informational — does not affect routing. |
| `isActive` | Boolean | ✅ | Only active documents are returned by GROQ queries. Default: `true`. |

### proofVariant

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | Slug | ✅ | Must match a `ProofVariantKey`. |
| `title` | String | ✅ | Section heading above the proof items. Max 120 chars. |
| `items` | Array of `proofItem` | ✅ | 3 items recommended. Each item has `title` and `text`. |
| `sourceTags` | Array | optional | Informational. |
| `isActive` | Boolean | ✅ | Default: `true`. |

**proofItem fields:**

| Field | Type | Notes |
|---|---|---|
| `title` | String | Short bold label. e.g. "3.2× more leads". Max 80 chars. |
| `text` | Text | 1–2 sentences of supporting copy. Max 300 chars. |

### ctaVariant

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | Slug | ✅ | Must match a `CTAVariantKey`. |
| `title` | String | ✅ | Large display headline. Max 120 chars. |
| `text` | Text | ✅ | Supporting paragraph. 1–2 sentences. Max 300 chars. |
| `ctaLabel` | String | ✅ | Button text. Max 60 chars. |
| `ctaHref` | String | ✅ | CTA destination. |
| `sourceTags` | Array | optional | Informational. |
| `isActive` | Boolean | ✅ | Default: `true`. |

---

## GROQ queries

The app fetches content using three parameterised GROQ queries, each filtered to active documents only. You can run these in the Sanity Vision tool to verify your documents are set up correctly.

**Hero:**
```groq
*[_type == "heroVariant" && key.current == $key && isActive == true][0] {
  _id,
  "key": key.current,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  tag
}
```

**Proof:**
```groq
*[_type == "proofVariant" && key.current == $key && isActive == true][0] {
  _id,
  "key": key.current,
  title,
  items[] {
    _key,
    title,
    text
  }
}
```

**CTA:**
```groq
*[_type == "ctaVariant" && key.current == $key && isActive == true][0] {
  _id,
  "key": key.current,
  title,
  text,
  ctaLabel,
  ctaHref
}
```

To test a specific key in the Sanity Vision tool, set the parameter `$key = "hero_google_problem"` (or any other key).

---

## Caching and revalidation

`SanityProvider` uses Next.js ISR. All CMS fetches are tagged with `"sanity"` and revalidate every **60 seconds** automatically.

For on-demand revalidation when content is published (recommended for production):

1. Create a `POST /api/revalidate` route handler that calls `revalidateTag("sanity")`.
2. In your Sanity project, add an HTTP webhook pointing to that route, triggered on document `publish` events.
3. Sanity will call the webhook immediately when you publish a variant — the CDN cache clears within seconds.

The revalidation route is a phase 2 item; the 60-second TTL is acceptable for the MVP.

---

## Adding a new variant key

To add a new content variant (e.g. a fourth hero for email traffic):

1. **Add the key to the TypeScript type** in `src/decision/types.ts`:
   ```typescript
   export type HeroVariantKey =
     | "hero_google_problem"
     | "hero_linkedin_vision"
     | "hero_direct_brand"
     | "hero_email_nurture";  // new
   ```

2. **Create a rule** in `src/decision/rules/homepage-rules.ts` that selects the new key when appropriate.

3. **Create the Sanity document** with `key.current === "hero_email_nurture"` and `isActive: true`.

4. **Deploy.** The new variant is live.

No mapper or provider changes are needed for new variants that use the existing field shapes.

---

## Verifying the integration

Once your environment variables are set and Sanity documents are published, verify end-to-end:

```bash
# Check that the correct provider is selected
curl -s http://localhost:3000/api/debug/content | jq

# Check full experience composition (should show Sanity-sourced content)
curl -s http://localhost:3000/api/debug/experience | jq

# Verify a specific key resolves
curl -s "http://localhost:3000/api/debug/homepage-experience?source=google" | jq
```

The debug panel at `/debug` also shows `usedFallback: false` when all Sanity keys resolve correctly.

---

## Seed content reference

The seed data in `src/sanity/seed/homepage-variants.ts` contains the full copy for all nine variants. Here is a summary:

### Hero variants

**`hero_google_problem`**
> *"Your website speaks to no one. Fix that in minutes."*
> Speaks directly to the conversion problem. CTA: "See how it works" → `#how-it-works`

**`hero_linkedin_vision`**
> *"Your website, ever-adapting."*
> Speaks to vision and the future of personalisation. CTA: "Explore the platform" → `#platform`

**`hero_direct_brand`**
> *"Your website, tailored to every visitor."*
> Brand-led clarity. Works for any unattributed visitor. CTA: "Start for free" → `#signup`

### Proof variants

**`proof_cases`** — "Conversion lifts that speak for themselves"
Three proof points: 3.2× leads lift, <5 minutes to first experience, 12 visitor signals evaluated.

**`proof_vision`** — "What the industry is saying"
Three proof points: Product Hunt recognition, built for the next decade, zero-engineer personalisation.

**`proof_platform`** — "Infrastructure you can trust"
Three proof points: Edge-native decision engine, 99.99% uptime SLA, GDPR & CCPA compliant.

### CTA variants

**`cta_guide`** — "Get the Adaptive Website Playbook"
Free guide, no email gate. Button: "Download the playbook"

**`cta_platform`** — "Start building for free"
Free account, no credit card. Button: "Create your free account"

**`cta_meeting`** — "See Mister Chameleon in action"
20-minute live demo. Button: "Book a demo"
