# Ad-network — the built MVP

A summary of what's shipped (branch `feat/ad-network-mvp`). Design rationale is in
`ad-network-plan.md`; hands-on setup in `ad-network-setup.md`.

## The pitch

**Contextual, per-visitor ads without the privacy debt of adtech.** Publishers
drop one snippet + an empty block; the platform serves an advertiser's ad, chosen
on the visitor's *first-party, per-site* context (interest, funnel stage, UTM,
device) — **no third-party cookies, no cross-site tracking**. Advertisers pay per
impression (CPM) or click (CPC) from a prepaid wallet.

## What's built

- **Advertiser tenants.** Any tenant can be flipped to an "ad account"
  (`tenantRole=advertiser`, `billingMode=usage_ads`). Its siteKey is what
  publishers embed.
- **Publisher approval gate.** Only domains on the advertiser's approved list
  (`ad_publishers`) may serve its ads — the abuse/billing control point.
- **Ads = self-styling blocks.** An ad is a block-variant creative (hero / cta /
  notification / …) with targeting, budget, flight dates and CPM/CPC pricing.
  Rendered to inline-styled HTML on demand — the publisher only places an empty
  `data-mc-block`.
- **Serving pipeline** (in `/api/snippet/decide`, gated to advertiser tenants):
  publisher-approved → wallet has balance → pick an eligible ad (active, in
  flight, in budget, weighted) → record a deduped impression → render with a
  click-tracking CTA.
- **Click tracking + integrity.** `/api/ad/click` logs the click and 302s to the
  advertiser URL (destination read from our DB — never an open redirect). A click
  is only *billed* when the visitor had a recent impression, so the click URL
  can't be hammered to drain a CPC budget.
- **Metered billing.** An async rollup (`/api/cron/ad-billing`) meters unbilled
  events against the advertiser's wallet: CPM per impression, CPC per click. The
  serve-time wallet gate stops serving when the balance runs out.
- **Admin UI** (`/admin/tenants/<id>/ads`): enable advertiser mode, approve
  publishers, create/pause ads (with a guardrail that rejects a creative that
  wouldn't render), and a 30-day performance panel (impressions/clicks/CTR/spend
  + per-day chart).
- **Tested:** 25 unit tests (selection, pricing, CPM/CPC billing maths, creative
  render contract).

## How the money flows (MVP)

Single-sided: the **advertiser pays the platform**. They prepay a wallet
(`tenant_wallets`, 1 credit = €0.01); the rollup debits per impression/click.
Publisher relationships/payouts stay off-platform for now (revshare is stored per
publisher but not yet settled).

Pricing: **CPM is the default** (price per 1000 impressions — the unit we already
meter); **CPC is available per campaign**. No auctions/CPA in the MVP.

## The commercial differentiator

- **First-party, per-site context** — the visitor id (`mc_vid`) lives in the
  publisher's own storage; nothing is joined across sites. This is the selling
  point in a post-cookie / GDPR world: relevant, adaptive ads *without* behavioural
  cross-site tracking.
- **Zero publisher integration friction** — one snippet tag + an empty block. Same
  runtime as the personalisation product, so an existing customer can host ads and
  personalise from one install.

## Not in the MVP (deliberately)

- Two-sided marketplace: publisher onboarding UI + revshare payouts.
- Targeting UI (targeting works via the rules-condition JSON on an ad; no editor).
- Frequency capping, viewability, and fraud detection beyond the click-integrity check.
- Auctions / CPA / dynamic pricing.
