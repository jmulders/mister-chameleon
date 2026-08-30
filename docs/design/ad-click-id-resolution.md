# Ontwerp — Ad-click-ID-resolutie-enricher

Status: **backlog / ontwerp** (nog niet gebouwd). Opgesteld 29 aug 2026.

## Context

De click-IDs worden al **gevangen** (`context/detect-context.ts`: `gclid`, `fbclid`,
`msclkid`, `ttclid`) en **opgeslagen** in `visitor_profiles` (first-touch, consent-gated).
De bestaande ads-attributie-enricher (`enrichment/providers/ads-attribution.ts`) leidt
`adCampaign`/`adAdGroup`/`adKeyword` echter alleen af uit **UTM-parameters** — hij bevraagt
de ad-platforms niet. Dit ontwerp beschrijft de "advanced provider" die het click-ID tegen
de platform-API resolvet naar rijke ad-data die UTM's niet hebben.

## Belangrijke realiteit: niet elk platform is resolvbaar (geverifieerd)

| Platform | Click-ID | Inbound resolvbaar? | Wat het oplevert |
|---|---|---|---|
| **Google Ads** | `gclid` | **Ja** — via de Google Ads API `click_view`-resource | campagne, ad group, **keyword**, **match type**, device, audience — ad-level data die UTM's missen |
| **Microsoft Ads** | `msclkid` | **Ja** — via de Microsoft Advertising API (analoog) | campagne / ad group / keyword |
| **Meta / Facebook** | `fbclid` | **Nee** — geen publieke lookup | opaak; alleen voor de Conversions API (outbound) + `fbc`-cookie |
| **LinkedIn** | `li_fat_id` | **Nee** — geen publieke lookup | alleen voor de Conversions API (outbound) |
| **TikTok** | `ttclid` | **Nee** — geen publieke lookup | alleen voor de Events API (outbound) |

**Kernconclusie:** een inbound-resolutie-enricher dekt realistisch alleen **Google Ads
(gclid)** en **Microsoft Ads (msclkid)**. Voor Meta/LinkedIn/TikTok kún je het click-ID
niet omzetten naar campagne-details — die click-IDs zijn **outbound-only** (conversies).
Voor die platforms blijven **UTM's** de attributiebron (al gedekt door de default).

## Wat Google Ads (gclid) oplevert + caveats

- Query: `SELECT click_view.gclid, campaign.id, ad_group.id, click_view.keyword,
  click_view.keyword_info.match_type, ... FROM click_view WHERE segments.date = '…'`.
- Alleen via `click_view` (niet via campaign/ad/keyword-resources).
- **Latency ~48u** voordat een gclid volledig resolvet.
- `click_view` is **per dag** en beperkt tot ~90 dagen historie.
- → resolved gclid→campagne-mappings **cachen** (eigen tabel), niet elke request live.

## Auth-model (per tenant, geen open data)

- **Google Ads API:** developer token (platform-niveau) + OAuth-refresh-token + `customer_id`
  van het ad-account van de tenant. Per tenant koppelen.
- **Microsoft Advertising API:** analoog (OAuth + account-id + developer token).
- Dit is dus een **per-tenant credential-integratie**, geen anonieme lookup zoals CBS/BAG.
  Alleen zinvol voor tenants die zelf op Google/Microsoft Ads adverteren en hun account
  koppelen.

## Architectuur (past op de bestaande enricher)

- Implementeer een `GoogleAdsAttributionProvider` (en later `MicrosoftAdsAttributionProvider`)
  achter de bestaande `AdsAttributionProvider`-interface — de enricher-vorm bestaat al
  (ads-attribution.ts noemt dit expliciet als swap-in).
- **Lazy + gecachet:** bij een request met een gclid → lookup in eigen mapping-cache →
  MISS → resolve via Google Ads API (async/uit-band i.v.m. 48u-latency) → cache. De 48u
  betekent dat verrijking vaak pas bij een **latere** visit van dezelfde bezoeker landt.
- Fail-open, per-tenant aan/uit, consent-gated (advertising), klein credit-event.
- UTM-default blijft de fallback voor niet-gekoppelde tenants en voor Meta/LinkedIn/TikTok.

## Fasering

- **Fase 1 — Google Ads (gclid).** Grootste bereik + rijkste data (keyword/match type).
- **Fase 2 — Microsoft Ads (msclkid).** Zelfde patroon.
- **Meta/LinkedIn/TikTok:** géén inbound-resolutie (kan niet); blijf op UTM's.

## Bronnen (verificatie)
- Google Ads API `click_view` (gclid → campaign/keyword/match type; ~48u latency) —
  Google Ads API docs + adwords-api forum.
- Meta `fbclid`: geen campagne-lookup-API; alleen Conversions API / `fbc` — Meta for
  Developers (CAPI fbp/fbc).
