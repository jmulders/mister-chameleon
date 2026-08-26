# Configurable rule-webhook payload — consent stance

Status: active. Owner: decision-engine / webhooks.

## What

A rule webhook (independent webhook-only rule, or the inline webhook on a variant
rule) can be configured to include extra lead-base / context fields in its POST
payload: firmographic (company, coarse geo), scoring (intent, funnel, journey),
and — when a named lead is known from an ABM link — person fields.

The **default** payload is unchanged and always sent: `event`, `tenantId`,
`rule`, a non-PII `plan` summary and a non-PII `context` slice. Selected fields
are added under a `fields` object.

## Consent (GDPR/AVG)

Each selectable field is classified and gated exactly like the lead-base write
gate (`lib/lead-base/profile-gate.ts`) and the ad-ID/CAPI split
(`docs/design/advertising-consent-capi.md`):

| Group | Examples | Consent required |
|-------|----------|------------------|
| context | source, device, path, UTM, audience segments | none (anonymous request signals) |
| firmographic | company name/domain/industry/size, country, region | `enrichment` |
| scoring | intent score, funnel stage, visited-pricing/cases/contact | `personalization` |
| person (PII) | name, first name, role, company (named lead) | **strictest: `personalization` AND `enrichment`** |

- The visitor's **effective** consent (cookie choice capped by the tenant privacy
  ceiling) is resolved once per request and passed to the decision provider.
- A selected field whose gate is not satisfied is **silently omitted** from the
  payload — never an error, never a partial leak. This mirrors how the ad click
  identifiers are withheld without the advertising basis.
- When consent is unknown (no consent state available), only `context` fields are
  sent — privacy-first.

## Why person is strictest

Sending a **named** individual's PII to a third-party endpoint is the most
sensitive operation here. It is only done when the visitor has granted both the
identity/behaviour basis (`personalization`) and the enrichment basis
(`enrichment`). A named lead reaching the decision context at all comes from a
first-party ABM link the person themselves clicked, but forwarding that identity
onward to an external system warrants the strongest gate we have short of a
dedicated marketing-consent category.

## Where it is enforced

- Catalog + gate + extractor: `lib/webhooks/payload-fields.ts`
  (`PAYLOAD_FIELD_CATALOG`, `isPayloadFieldConsented`, `extractSelectedPayload`).
- Selection stored per webhook: `RuleWebhook.payloadFields` in `rules_config`
  (validated against the catalog keys in `validateStoredConfig`).
- Assembly + gating at fire time: `RulesDecisionProvider.fireMatchWebhook`, using
  the request's effective consent — off the decision hot path, fire-and-forget.
- Editors: the Webhooks overview (independent webhook rules) and the inline
  "Outbound webhook" field in the Rules editor both expose the grouped selector,
  marking which fields are consent-gated.

## Data minimisation

Only the selected fields are included, only when present in the context, and only
under consent. Nothing is added by default. Removing a field from the selection
stops sending it on the next request (the selection is read per request).
