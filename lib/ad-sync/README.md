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

### Google — Customer Match (via the Data Manager API)

> **Why Data Manager API?** Since **1 April 2026** Google disabled Customer Match
> uploads through the Google Ads API (`OfflineUserDataJobService`) for developer
> tokens that weren't already allowlisted. New integrations must use the Data
> Manager API. This client uses `datamanager.googleapis.com`. **No developer
> token is needed** — auth is OAuth2 with the `datamanager` scope.

Requirements: a Google Ads account eligible for Customer Match and an OAuth client.

1. **Enable the API** — Google Cloud Console → *APIs & Services → Library* →
   enable **"Data Manager API"** in your project.
2. **OAuth client** — *APIs & Services → Credentials* → create an OAuth 2.0
   Client (Web). Add `https://developers.google.com/oauthplayground` as an
   authorized redirect URI if you'll use the playground. Note the **client id**
   + **secret**.
3. **Refresh token** — run the OAuth consent once for a user with access to the
   Ads account, requesting scope **`https://www.googleapis.com/auth/datamanager`**
   with `access_type=offline` (e.g. via the OAuth Playground → gear → "Use your
   own OAuth credentials"). Store the **refresh token**.
4. **Customer id** — the target Ads account id (10 digits, no dashes) →
   becomes `Destination.operatingAccount`.
5. **Login customer id** — your MCC/manager id (digits) if the account sits under
   one; otherwise leave empty → `Destination.loginAccount`.
6. **User list** — create a *Customer list* audience in the Ads UI (Tools →
   Audience manager → Segments → +). Copy its **user list id** →
   `Destination.productDestinationId`. (You can also create it via the Data
   Manager API `userLists:create`, but the UI is simpler.)

Fill the fields, click **Test verbinding** (runs a `validateOnly` ingest — no
data is written), then **Opslaan**. The Customer Match Terms of Service is
accepted automatically per upload (`termsOfService: ACCEPTED`).

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

- **API versions** are pinned as a constant at the top of each client (Google
  uses Data Manager API `v1`; Meta `API_VERSION`; LinkedIn `LINKEDIN_VERSION`).
  Bump them when a platform deprecates a version.
- **Match rate** — you only reach leads with an email, and each platform drops
  the ones it can't match. Audiences also have a minimum size before they're
  usable for targeting (hundreds to ~1000); verify current thresholds.
- **Reconcile cap** — the segment resolver caps at 50k members; audiences larger
  than that aren't fully reconciled for removals.
- **AVG/GDPR** — sharing identifiers with ad platforms is a separate processing
  activity that needs a lawful basis and a processor agreement with each
  platform. Keep the consent restriction on unless your DPO confirms otherwise.
