# Advertising consent and CAPI conversion forwarding

Status: active. Owner: Lead Base / ad-sync.

## What this covers

Forwarding a visitor's ad click identifier (`gclid` for Google, `fbclid` for
Meta) to a third-party conversion API when they later convert (submit a form,
start a trial, book a demo). This lets the ad platform match the offline/late
conversion back to the click that produced it (Google enhanced conversions for
leads, Meta Conversions API).

Capturing and storing those identifiers first-touch on `visitor_profiles` is a
separate, earlier step. It is gated on `analytics OR personalization` consent
(the same basis as UTM parameters) because it is first-party marketing
analytics. That capture is implemented separately; this document is only about
the **forwarding** to a third party.

## Why a dedicated `advertising` consent category

Under the GDPR/AVG, consent must be granular per processing purpose (Art. 6(1)(a),
Art. 7; recital 32 on specific consent). Sending a click identifier to Google or
Meta is a distinct purpose from first-party analytics:

- the recipient is a **third party**, not us;
- the purpose is **advertising measurement and audience building**, not
  understanding our own site;
- the platforms may act as independent or joint controllers for that data.

Bundling this into the existing `analytics` or `personalization` category would
make that consent non-specific, so those categories cannot lawfully carry it. We
therefore add a fourth category, `advertising`, denied by default (privacy-first),
which the visitor grants explicitly in the consent banner.

The alternative the task allowed, reusing the strictest existing category, was
rejected for exactly this reason: none of `analytics` / `personalization` /
`enrichment` describes "share an identifier with an ad platform", so reusing one
would be a purpose mismatch and weaker consent.

## The gate

Forwarding happens only when **effective** advertising consent is true:

```
finalAllowed(advertising) = tenantPrivacy.allowAdvertising !== false
                         && userCookie.advertising === true
```

- The user signal is the `ad` field of the `mc_consent` cookie
  (`tracking/consent-types.ts`).
- The tenant ceiling is `TenantPrivacySettings.allowAdvertising` (default allow,
  set false to disable platform-wide regardless of user consent).
- Resolution is the standard `resolveConsent(cookieHeader, tenantPrivacy)` in
  `lib/consent/server-consent.ts`.

Without an advertising basis the conversion is **still reported** to the ad
platform, but with **no** `gclid`/`fbclid` attached. The email-based match
(hashed, its own configuration) is unchanged; only the click identifier is
withheld.

## Where it is enforced

`reportInboundConversion` (`lib/lead-base/report-inbound-conversion.ts`) is the
single choke point for the on-site form endpoints (contact, trial, demo). It
takes the visitor's `cookieHeader` and resolves advertising consent itself, then
looks up the stored click ids via `getProfileClickIds` only when granted. The
registered-forms route (`app/api/forms/[formKey]/route.ts`) applies the same gate
inline.

Server-to-server callers that have **no visitor cookie** never forward a click
id, by construction:

- the Stripe webhook calls `reportInboundConversion` without a `cookieHeader`, so
  advertising consent resolves to false;
- the inbound-form webhook (external CMS bridge) reports an email-only
  conversion, since the visitor's consent cookie is not available to it.

Snippet-tenant sites (external CMS via the JS snippet) therefore do not yet
forward click ids to a CAPI; wiring host-CMP advertising consent through the
snippet is a future extension and is intentionally out of scope here.

## Data-protection summary

- Legal basis for forwarding: explicit consent (`advertising`), per purpose.
- Default state: denied. No forwarding until the visitor opts in.
- Tenant override: `allowAdvertising: false` disables it platform-wide.
- Withdrawal: clearing or changing the consent choice stops future forwarding
  immediately (the cookie is re-read on each request).
- Data minimisation: only the opaque click token is sent, and only when present;
  it is capped at 512 characters at capture time.
