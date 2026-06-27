# ABM Personalized URLs (PURLs) — Build Sketch

Account-Based Marketing personalization: refer a named lead (e.g. from LinkedIn
Sales Navigator) to a personalized link; the platform instantly redirects them to
the real page while loading their profile, so the decision engine personalizes
for a *known* person instead of an inferred one.

> Example: lead Jasper is sent to `/go/ax93` (or a vanity `/aanbodvoorjasper`).
> The platform recognises the identifier, stamps Jasper's identity into the
> session, redirects to the target page, and the hero/proof/CTA personalize for
> Jasper's company + role from the first paint.

## 1. Why it fits this platform

The hard part already exists: a context-driven decision engine (rules + AI) that
personalizes per visitor from a `DecisionContext`. Today the platform **infers**
identity (IP→company via the company enricher, behaviour→interests via interest
profiles). A PURL adds a **deterministic identity layer**: the lead link tells the
engine *exactly* who the visitor is, with the highest possible confidence — the
richest signal it can receive. We reuse ~90% of what's built; we add an identity
source and a redirect.

## 2. URL scheme (decision)

Two options, with a trade-off:

| Option | Pro | Con |
| --- | --- | --- |
| **Opaque token** — `/go/ax93z` or `?ld=ax93z` (recommended) | No collision with real routes; the token is not itself personal data; safe if leaked | Less "pretty" in outreach |
| **Vanity path** — `/aanbodvoorjasper` | Natural in outreach | Must be caught *before* the 404; collision risk with real pages; the path itself is personal data |

**Recommendation:** opaque token (short, unguessable), shown with a friendly label
in your outreach copy. Support an optional vanity alias per lead for the cases
where the natural URL matters.

## 3. Data model

New per-tenant Supabase table `abm_leads` (migration in `supabase/migrations/`):

```
abm_leads
  id              uuid pk
  tenant_id       text         -- FK-by-convention, like tenant_settings
  identifier      text         -- the opaque token (unique per tenant)
  vanity_path     text null    -- optional natural path alias
  target_path     text         -- where to redirect (e.g. "/pricing")
  profile         jsonb        -- { name, company, role, linkedinUrl, industry, companySize, ...customFields }
  segment_hint    text null    -- optional audience-segment key to force
  status          text         -- active | paused | expired
  expires_at      timestamptz null
  first_seen_at   timestamptz null
  visit_count     int default 0
  created_at / updated_at
  unique (tenant_id, identifier)
```

No raw secrets here, but it IS personal data → see §7.

## 4. Runtime flow

```
Request  ──▶  middleware.ts (NEW)
                 │  resolve tenant by host (reuse resolve-tenant)
                 │  if path/param matches an active abm_leads.identifier:
                 │     • set signed cookie  mc_lead = <leadId>   (httpOnly, SameSite=Lax)
                 │     • 307 redirect → target_path
                 │     • increment visit_count (fire-and-forget)
                 ▼
            Normal page render
                 │
            buildDecisionContext()
                 │  NEW AbmLeadEnricher: read mc_lead cookie → fetch lead profile
                 │  → inject deterministic identity into context:
                 │       knownLead = { name, company, role, industry, ... , confidence: "exact" }
                 │       (optionally force segment_hint)
                 ▼
            Decision engine (rules + AI) personalizes on the KNOWN lead
                 │  identity persists via the cookie → every later page stays personalized
                 ▼
            Journey / interest tracking now keyed to a known identity
```

Sub-100ms redirect: the identifier→lead lookup is cached (reuse the
`tenant_host_resolution_cache` pattern: a short-TTL in-memory/edge cache keyed by
`tenant:identifier`).

## 5. Integration points (concrete)

1. **`middleware.ts`** (new, repo root): the only piece that intercepts *before*
   routing. Resolve tenant (host), match identifier, set cookie, redirect. Keep it
   tiny and fail-open (unknown id → `NextResponse.next()`, never a 404).
2. **`enrichment/providers/abm-lead.ts`** (new): an enricher in the same family as
   `providers/company` / `providers/crm`. Reads the `mc_lead` cookie + the lead
   store, returns an `EnrichmentOutput` with deterministic company/role/identity.
   Plugged into the staged pipeline in `build-decision-context.ts`.
3. **Decision context**: extend the context with a `knownLead` block (name,
   company, role, confidence). Rules (`decision/rules/field-registry.ts`) and the
   AI prompt (`ai/prompt-builder.ts`) gain access to it — the AI's `intendedAudience`
   matching becomes trivial when the audience is *named*.
4. **Audience segments**: a lead with `segment_hint` maps directly onto an existing
   audience segment → reuse the whole segment→variant path with zero new engine work.
5. **Admin** (`app/admin/tenants/[tenantId]/abm/`): manage leads, generate PURLs,
   set target pages, import from Sales Navigator, view visits.
6. **Lead store** (`lib/abm/abm-store.ts`): CRUD + identifier lookup (cached).

## 6. Phased build

**Phase 1 — core loop (smallest end-to-end slice).**
Migration + lead store + `middleware.ts` redirect + `mc_lead` cookie + the
`AbmLeadEnricher` injecting `company`/`role`. One hard-coded test lead (no UI yet).
Outcome: a PURL redirects and the page personalizes for a known company. Verifiable.

**Phase 2 — authoring.**
Admin ABM page: CRUD leads, auto-generate identifiers, set target + vanity, copy
the outreach link. Sales Navigator CSV import (map columns → profile fields).

**Phase 3 — personalization depth.**
`segment_hint` → force an audience segment; expose `knownLead` to the AI prompt
(named-audience reasoning); optional per-lead landing overrides; ABM analytics
(visits, time-to-first-visit, conversion per lead/campaign).

**Phase 4 — privacy & ops.**
Expiry + auto-pause; opt-out endpoint; audit log; rate-limit/abuse guard on the
redirect; DPIA notes; "leaked link" safe-degrade verified.

## 7. Privacy guardrails (non-negotiable, given the "privacy-first" pitch)

- **Lawful basis:** named-person tracking, often pre-consent. B2B legitimate
  interest is usually defensible but needs a documented assessment + a clear
  opt-out. Loop in your privacy owner before Phase 2.
- **The link is personal data + can leak.** Anyone with the URL lands as that
  lead. So: keep personalization business-appropriate, **never render sensitive
  personal data** on the page, prefer opaque tokens, support expiry.
- **Fail open, fail silent.** Unknown/expired/paused identifier → fall through to
  the normal page. Never a 404, error, or anything that reveals the mechanism.
- **Minimise:** store only what you personalize on; allow per-tenant retention +
  purge.

## 8. Locked decisions

1. **URL scheme — both.** Opaque token is the primary identifier; an optional
   per-lead `vanity_path` alias is supported for outreach where a natural URL
   matters. Both resolve to the same lead.
2. **Profile fields — full set.** company, role, industry, company size, and a
   named greeting (first name). Stored in `profile` jsonb; the Sales Navigator
   import maps columns onto these.
3. **Segment + AI — both.** A lead may carry a `segment_hint` that forces an
   existing audience segment (reuses the whole segment→variant path) AND the
   `knownLead` block is exposed to the AI prompt as a named-audience signal. They
   compose: the segment narrows the candidate set, the AI reasons within it.
4. **Edge middleware (fast path) + Node enrichment (rich path).**
   - Edge `middleware.ts` does only the cheap work: match `identifier` →
     `{ leadId, targetPath }` (short-TTL cached map / Supabase REST), set the
     signed `mc_lead` cookie, 307 redirect. Razendsnel, fail-open.
   - The full profile → `DecisionContext` injection stays in Node, in the
     `AbmLeadEnricher` (reuses `getDb()` + the existing enrichment pipeline).
   This keeps the redirect at the edge while the heavy lookup stays on the
   familiar Node/DB stack.
```
