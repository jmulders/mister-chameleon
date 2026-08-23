# Host CMP consent alignment (snippet tenants)

Internal reference for how the JS snippet reads the host site's consent and how
the platform applies it. Publisher-facing instructions live in
`docs/publisher-consent-handleiding.md`.

## Goal

A snippet tenant runs on someone else's website. That host site already has a
consent management platform (CMP). We must respect the visitor's choice there:
read it, forward it, and gate our processing (enrichment, personalization,
analytics) accordingly, with a privacy-first default.

## Constraint that shapes the design

`buildSnippetSource(decideUrl)` produces ONE tenant-agnostic script for every
tenant. The tenant is only resolved from the `siteKey` at decide time. So the
snippet cannot be told per-tenant configuration at load time. Therefore:

- The snippet reads every available host source in a FIXED priority order and
  forwards the resulting three categories.
- The tenant's `consentSource` is applied SERVER-SIDE (in the decide route): it
  only decides the default when the host sent no signal, and the tenant privacy
  ceiling is applied on top.

## Sources and priority order

Resolved client-side in `lib/snippet/snippet-source.ts` (`mcResolveConsent`):

1. Publisher signal
   - `data-mc-consent="granted|denied"` on the script tag, or
   - `window.mcConsent` as a boolean, a `{analytics,personalization,enrichment}`
     object, or a function/Promise returning either (async CMPs).
2. IAB TCF v2 (`window.__tcfapi('getTCData', 2, cb)`).
3. Google Consent Mode (signals pushed to `window.dataLayer`).
4. Global Privacy Control / Do-Not-Track -> denied.
5. No signal -> `null` (server applies the tenant default).

The first source that yields a value wins. Resolution is asynchronous but bounded
by `min(data-mc-call-ms, 1500ms)` so it never delays the first decide; on timeout
we fall back to GPC/DNT-or-null.

## Category model

Three categories, matching the platform-wide `ConsentState`
(`tracking/consent-types.ts`):

| Category          | Gates                                                        |
| ----------------- | ----------------------------------------------------------- |
| `analytics`       | GA4 / event writes                                          |
| `personalization` | behavioural history + journey writes + adaptive selection   |
| `enrichment`      | IP-to-company / Leadinfo / firmographic lookup              |

`essential` (tenant resolution, geo header, serving a variant/ad) is always on.

## Purpose / signal -> category mapping tables

These are the PLATFORM DEFAULT mappings applied client-side. Because the snippet
is tenant-agnostic, per-tenant remapping is not wired in this version; a future
enhancement can forward the raw signals and remap server-side.

### Google Consent Mode

| Consent Mode signal   | Category          |
| --------------------- | ----------------- |
| `analytics_storage`   | `analytics`       |
| `ad_personalization`  | `personalization` |
| `ad_storage`          | `enrichment`      |
| `ad_user_data`        | `enrichment`      |

A category is granted when its signal(s) are `"granted"`.

### IAB TCF v2 (purpose consents)

| TCF purpose(s)                                             | Category          |
| --------------------------------------------------------- | ----------------- |
| 1 (store/access info), 2 (basic ads)                      | `enrichment`      |
| 3, 4, 5, 6 (personalised ads / content)                   | `personalization` |
| 7, 8, 9, 10 (measurement, market research, dev)           | `analytics`       |

`gdprApplies === false` is treated as full consent (GDPR not in scope for the
visitor). If `__tcfapi` is present but returns no usable data, we fall through to
the next source.

## Async resolution within the call budget

The snippet keeps the page hidden for `data-mc-reveal-ms` and aborts the decide
after `data-mc-call-ms`. Consent resolution is gated by a separate cap of
`min(data-mc-call-ms, 1500ms)`; whichever of the async sources (publisher
function/Promise, TCF callback) settles first wins, and on cap timeout we proceed
with GPC/DNT-or-null so the first decide is never blocked.

The visitor id stays synchronous: it is minted before consent resolves, and is
ephemeral (never stored) only on an EXPLICIT deny (publisher `denied`, GPC/DNT).
Otherwise it persists as before, so existing tenants keep cross-session continuity.

## Server application

In `app/api/snippet/decide/route.ts`, after the tenant is resolved:

```
consent = computeEffectiveConsent(
  consentFromSnippet(body.consent, tenant.snippet.consentSource),
  tenant.privacy,
)
```

- `consentFromSnippet` (in `lib/consent/server-consent.ts`) turns the payload into
  a `ConsentState`. Object -> categories; boolean -> full/deny (legacy); `null`
  -> tenant default; field absent -> granted (legacy snippet backward compat).
- `computeEffectiveConsent` applies the tenant privacy ceiling
  (`TenantPrivacySettings.allowAnalytics/Personalization/Enrichment`); it can only
  further restrict, never expand.
- Each category then gates its family (see table above). Ads and CMS variants
  still serve geo-only when a category is denied.

## Safe-default matrix

| Payload from snippet        | `consentSource: auto` | `consentSource: always` |
| --------------------------- | --------------------- | ----------------------- |
| category object             | that object           | that object             |
| `true` (legacy)             | full                  | full                    |
| `false` (legacy)            | deny                  | deny                    |
| `null` (no host signal)     | deny (all off)        | grant (all on)          |
| field absent (old snippet)  | grant                 | grant                   |
| explicit deny (GPC/DNT/pub) | deny                  | deny                    |

The tenant privacy ceiling is applied on top of every cell.

## Tenant configuration

- `TenantSnippetSettings.consentSource: "auto" | "always"` (absent -> `"auto"`).
  Edited in Admin -> Snippet -> Consent (`saveSnippetConsentSourceAction`).
- New tenants default to `"auto"` (deny-by-default). Existing snippet-enabled
  tenants are migrated to `"always"` by migration 168 so they do not stop
  enriching/personalising the moment this ships.
- The tenant privacy ceiling is the existing `TenantSettings.privacy.allow*`.

## GDPR assumptions (documented)

- The host CMP is the source of truth for the visitor's choice; we read, never
  ask, and never override a host deny.
- Deny-by-default for CMP-integrated tenants (`auto`): no non-essential
  processing without a positive signal.
- `always` is an explicit, operator-chosen legacy mode for hosts that gate
  loading the snippet behind their own banner (the pre-integration behaviour).
- We store no visitor identifier on an explicit deny.
- The purpose/signal -> category mapping above is our interpretation of the TCF
  purposes and Consent Mode signals; it is the platform default and is documented
  so it can be audited.
