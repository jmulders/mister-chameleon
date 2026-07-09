# Ad-audience sync (Retargeting)

Pushes Lead Base segments into ad-platform retargeting audiences — a self-hosted
replacement for HubSpot's "ads audience sync", so you don't need a Marketing Hub
tier. Supports **Google Ads Customer Match**, **Meta Custom Audiences** and
**LinkedIn Matched Audiences** through one shared engine.

## How it works

```
visitor_profiles (lead level)  ──join on abm_lead_id──►  abm_leads.profile (email)
        │                                                          │
        └────────────── segment.ts (filter by level/score) ───────┘
                                   │
                                   ▼
                   hash.ts  (SHA-256 email/phone/name — server-side)
                                   │
        ┌──────────────────┬───────┴────────┬────────────────────┐
        ▼                  ▼                ▼                     ▼
  google-ads-client   meta-client     linkedin-client     ad_sync_audience_members
  (Customer Match)   (Custom Audience) (DMP Segment)       (what we've pushed)
```

- **Segment** — leads are selected by lead level (identity level, status, intent,
  computed hot score) and must carry a first-party email. Configured per tenant.
- **Hashing** — email/phone/name are normalized and SHA-256 hashed in-process.
  Only hashes leave the server; raw PII is never sent or logged.
- **Incremental reconcile** — the daily cron (`/api/cron/ad-sync`, 03:30) diffs
  the current segment against `ad_sync_audience_members` and applies only the
  delta: new/qualifying leads are **added**, leads that dropped below the
  threshold / changed status are **removed**. This is what makes it a true list
  sync rather than an append-only push.
- **Erasure** — deleting a lead in the Lead Base (`deleteLeadProfilesAction`)
  also removes that person from every configured audience.
- **Consent** — with "alleen leads met toestemming" on (default), only leads
  whose `consent_state` is `granted`, or who are first-party self-identified ABM
  leads (legitimate interest), are included.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | shared config + member + result types |
| `hash.ts` | normalize + SHA-256 email/phone/name/country |
| `segment.ts` | resolve tenant segment → matchable members; erasure email lookup |
| `ad-sync-store.ts` | per-tenant config, run log, audience snapshot |
| `google-ads-client.ts` / `meta-client.ts` / `linkedin-client.ts` | add + remove per platform |
| `sync-engine.ts` | orchestrator (diff → add/remove), erasure helper |
| `app/api/cron/ad-sync/route.ts` | daily reconcile cron |
| `app/admin/tenants/[tenantId]/ad-sync/*` | admin UI |

## Migrations

Apply before use:

- `20240101000143_ad_sync.sql` — `ad_sync_settings`, `ad_sync_runs`
- `20240101000144_ad_sync_audience_members.sql` — audience snapshot + `members_removed`

## Per-platform setup

All credentials are entered in **Admin → Tenants → [tenant] → Doelgroepen →
Retargeting**. There are no env vars (besides the shared `CRON_SECRET`).

### Google Ads — Customer Match

Requirements: a Google Ads account eligible for Customer Match, API access, and
an OAuth client.

1. **Developer token** — Google Ads → Tools → API Center. (Basic access is fine
   for Customer Match once approved.)
2. **OAuth client** — Google Cloud Console → APIs & Services → Credentials →
   create an OAuth 2.0 Client (Desktop or Web). Note the **client id** + **secret**.
3. **Refresh token** — run the OAuth consent once for a user with access to the
   account, requesting scope `https://www.googleapis.com/auth/adwords` with
   `access_type=offline`. Store the resulting **refresh token**.
4. **Customer id** — the target account id (10 digits, no dashes).
5. **Login customer id** — your MCC/manager id if the account sits under one.
6. **User list** — create a *Customer list* audience in the Ads UI (Tools →
   Audience manager → Segments → +). Copy its **user list id**.

Fill all six fields, click **Test verbinding**, then **Opslaan**.

### Meta — Custom Audiences

Requirements: a Business Manager, an ad account, and a system-user token.

1. **System-user access token** — Business Settings → Users → System users →
   create a system user, assign the ad account with the `ads_management`
   permission, then Generate token (long-lived). Copy the **access token**.
2. **Ad account id** — `act_XXXXXXXXX` (the number is enough).
3. **Custom Audience** — Ads Manager → Audiences → Create → Custom Audience →
   Customer list. Copy its **audience id**.
4. Accept Meta's Custom Audience Terms once in the Ads Manager.

Fill the three fields, **Test verbinding**, **Opslaan**.

### LinkedIn — Matched Audiences (DMP Segments)

Requirements: LinkedIn Marketing Developer Platform access (approval required)
and a Campaign Manager ad account.

1. **App + access** — create an app on the LinkedIn Developer Portal and request
   Marketing Developer Platform access (needs `rw_dmp_segments`, `r_ads`).
2. **Access token** — run the 3-legged OAuth flow for a user with access to the
   ad account, requesting `rw_dmp_segments`. Copy the **access token**. (Tokens
   expire — refresh periodically; this MVP stores a token, not a refresh flow.)
3. **Ad account id** — the sponsored account id (digits).
4. **DMP segment** — Campaign Manager → Plan → Audiences → Create → Upload a
   list (a "matched audience"), or create the DMP segment via the API. Copy its
   **DMP segment id** (numeric).

Fill the three fields, **Test verbinding**, **Opslaan**.

## Notes / limits

- **API versions** are pinned as a constant at the top of each client
  (`API_VERSION` / `LINKEDIN_VERSION`). Bump them when a platform deprecates a
  version.
- **Match rate** — you only reach leads with an email, and each platform drops
  the ones it can't match. Audiences also have a minimum size before they're
  usable for targeting (hundreds to ~1000); verify current thresholds.
- **Reconcile cap** — the segment resolver caps at 50k members; audiences larger
  than that aren't fully reconciled for removals.
- **AVG/GDPR** — sharing identifiers with ad platforms is a separate processing
  activity that needs a lawful basis and a processor agreement with each
  platform. Keep the consent restriction on unless your DPO confirms otherwise.
