# Adaptive email — design

Third personalisation channel next to contextual website (own + snippet) and
adaptive ads. Same core idea: **what you know about the recipient → the content
you show.** One personalisation core, two entry points (batch/ABM list + event
triggers). Personalisation is *reuse*, not rebuild — the new work is identity
resolution and delivery, not the decision logic.

## 1. The shared core

```
renderAdaptiveEmail(recipientContext, templateKey) → { subject, html }
```

Steps, all built from existing pieces:

1. **Resolve context for a known recipient.** Reuse `buildDecisionContext` +
   `injectKnownLeadContext` / `resolveActiveKnownLead` (`lib/abm/apply-known-lead`)
   + `evaluateAudienceSegments` + the firmographic snapshot on `visitor_profiles`.
   Unlike web/ads, identity is known up front, so context is rich immediately.
2. **Pick block variants** with the existing rules/decision engine (per email
   "slot" in the template). A rule like "funnel=intent AND industry=software →
   case-study block" works identically to the web.
3. **Render blocks** with `renderBlockHtml` — it already emits self-contained,
   inline-styled blocks (built for the ad snippet on foreign sites), which is
   exactly what email needs (mail clients strip `<style>`/JS). Apply the tenant
   theme tokens the same way ads do.
4. **Assemble** header + chosen blocks + footer into one email HTML, plus a
   subject line (also rule-selectable).

The core is channel-agnostic: it takes a resolved context and a template, and
returns email HTML. Both entry points below call this identical function.

## 2. Two entry points (the "combi")

**A. Batch / ABM campaign.** A recipient list (a CRM/ABM segment or known-lead
set). For each recipient → resolve context → core → send. Use case: an ABM
campaign to target accounts, each mail tailored to that account's firmographics
and funnel stage.

**B. Event trigger.** An event carries *who + what*: a form submit, a job
application (sollicitatie), a demo request. The event often gives you *extra*
context (the form fields, the vacancy applied for) on top of the known-lead
profile. Event → resolve context → core → send (or enqueue). Use case: an
instant, tailored follow-up — e.g. an applicant gets a confirmation mail themed
to the role/vacancy and their profile.

Same core, same block library, same renderer — only the trigger differs.

## 3. Data model (new)

- **Recipient ↔ identity.** Reuse `visitor_profiles` / known leads keyed by
  **email** (add an email lookup/index). A recipient = `{ email, leadId?,
  tenantId, contextOverrides? }` where overrides carry event-specific data
  (e.g. `{ vacancy: "Frontend dev" }`).
- **`email_templates`** — per tenant: `templateKey` → which block keys + subject
  rule. MVP: a couple of built-in templates (`abm_intro`, `application_followup`).
- **`email_sends`** — one row per `(tenant, template, recipient, dedupe_key)` for
  idempotency + audit + reporting. Prevents double-sends on retries.
- **Suppression.** Reuse the existing suppression store so a suppressed /
  unsubscribed address is never mailed.

## 4. Sending

- **ESP: Resend** (already wired at platform level — `getPlatformEmailSettings`,
  Integrations → Email). Batch iterates + rate-limits; triggered sends one.
- **Guardrails (important):** always **preview / dry-run first**; respect
  suppression + email opt-in (email consent is its own regime — CAN-SPAM/GDPR,
  distinct from the web snippet consent); never blast a batch without an explicit
  confirm step. Actual send is a deliberate, gated action.

## 5. Deliverability & compliance

Per-recipient variation is fine, but keep a stable template skeleton; authenticate
the sending domain (SPF/DKIM/DMARC via the Resend domain); honour unsubscribe /
suppression on every send; treat email consent separately from web consent.

## 6. Phasing

1. **Core + preview (safe, no send).** `renderAdaptiveEmail` + an admin surface
   "preview this template for a given lead/email". Reuses the whole engine; fully
   testable without touching anyone's inbox. ← recommended first slice.
2. **One trigger end-to-end** (form-submit *or* application) → Resend to a **test
   address**, behind a flag.
3. **Batch/ABM campaign**: pick a segment → preview → send with confirm + progress.
4. **Template management UI** + subject rules + reporting (opens/clicks via Resend).

## 7. Open questions (decide before building beyond slice 1)

- **ESP**: confirm Resend (platform) is the target, or a per-tenant ESP later?
- **Identity key**: email everywhere, or map email → existing `visitor_id` so the
  web + email histories converge on one profile? (Recommended: converge.)
- **First trigger to wire** in slice 2: form-submit or application/sollicitatie?
