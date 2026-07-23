# Ad-network — setup & test

How to turn a tenant into an advertiser, create an ad, approve a publisher, and
test the whole flow. See `docs/design/ad-network-plan.md` for the design.

> Prerequisite: the `feat/ad-network-mvp` migration is applied
> (`supabase db push`) and the code is live.

## 1. Creative shapes (per slot type)

An ad's `creative` JSON must match what `renderBlockHtml` expects, or the block
renders empty. These shapes are locked by `tests/ads/creative-render.test.ts`.
The primary CTA's `href` is overwritten at serve time with the click-tracking
redirect, so any placeholder is fine.

```jsonc
// hero
{ "tag": "Sponsored", "title": "…", "subtitle": "…",
  "ctas": [{ "label": "Try it free", "href": "https://advertiser.example" }] }

// cta
{ "title": "…", "text": "…",
  "cta": { "label": "Get started", "href": "https://advertiser.example" } }

// notification
{ "message": "…", "severity": "info",
  "ctaLabel": "See more", "ctaHref": "https://advertiser.example" }

// proof
{ "title": "…", "items": [{ "title": "5,000+", "text": "teams" }] }

// feature
{ "title": "…", "subtitle": "…",
  "items": [{ "title": "Fast", "body": "Live in a day." }] }

// conversion
{ "urgencyLabel": "Limited", "title": "…", "text": "…",
  "ctas": [{ "label": "Claim offer", "href": "https://advertiser.example" }] }
```

## 2. Make a tenant an advertiser

`tenantRole`/`billingMode` live in `tenant_settings.settings` (jsonb):

```sql
update tenant_settings
set settings = settings
  || '{"tenantRole":"advertiser","billingMode":"usage_ads"}'::jsonb
where tenant_id = 'acme-ads';
```

The advertiser's own siteKey (settings.snippet.siteKey) is the key publishers
embed. Leave `settings.snippet.allowedSnippetOrigins` empty — publisher access
is controlled by `ad_publishers`, not the origin allowlist.

## 3. Fund the wallet

Serving stops when the balance hits 0 (the serve-time gate). Top up in cents
(1 credit = €0.01):

```sql
-- €50 budget
select credit_wallet('acme-ads', 5000, 'top_up_manual', 'manual', null, 'ad budget', 'topup');
```

## 4. Approve a publisher

Only approved domains may serve the advertiser's ads:

```sql
insert into ad_publishers (ad_tenant_id, publisher_domain, status, revshare_pct, approved_at)
values ('acme-ads', 'publisher-site.nl', 'approved', 0, now());
```

## 5. Create an ad

```sql
insert into ads (ad_tenant_id, name, slot_type, creative, click_url,
                 pricing_model, rate_cents, budget_cents, weight, status, start_at)
values (
  'acme-ads', 'Acme hero – launch', 'hero',
  '{"tag":"Sponsored","title":"Ship faster with Acme","subtitle":"The all-in-one toolkit.","ctas":[{"label":"Try it free","href":"https://acme.example"}]}'::jsonb,
  'https://acme.example/?utm_source=misterchameleon',
  'cpm', 500,        -- €5.00 per 1000 impressions
  5000,              -- €50 campaign cap (0 = unlimited)
  1, 'active', now()
);
```

For CPC: `pricing_model = 'cpc'`, `rate_cents = 50` (€0.50 per click).

## 6. Test end-to-end

On a page of the approved publisher site, embed the advertiser's siteKey and a
block container:

```html
<div data-mc-block="hero"></div>
<script src="https://www.misterchameleon.nl/api/snippet.js"
        data-site-key="sk_live_ACME_ADVERTISER_KEY" async></script>
```

Load the page → the ad renders in the block. Then verify:

```sql
-- impressions/clicks land here (deduped per visitor+ad+minute)
select event_type, count(*) from ad_events where ad_tenant_id='acme-ads' group by 1;

-- click: clicking the ad's CTA hits /api/ad/click → 302 to click_url, logs a click.

-- billing: runs via the daily cron (/api/cron/ad-billing) or run it manually.
select * from ad_stats_daily where ad_tenant_id='acme-ads';
```

## Gates recap (why an ad might NOT show)

1. Tenant is not `tenantRole:"advertiser"`.
2. Request Origin/Referer host is not an `approved` `ad_publishers` row.
3. Wallet missing / not active / balance 0.
4. No active, in-flight, in-budget ad for that slot type.
5. Creative renders empty (wrong shape — see §1).
