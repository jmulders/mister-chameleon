# Operator setup & checklist

Alles wat een operator moet instellen om het volledige lead-/retargeting-systeem
live te krijgen: secrets & env-vars, de retargeting-koppeling per ad-platform
(Google, Meta, LinkedIn), conversie-feedback, suppressie, en de openstaande
beveiligings-to-do's. Bedoeld als naslag — vink af wat gedaan is.

Detail-instructies per platform (OAuth-stappen etc.) staan in
`lib/ad-sync/README.md`; dit document is het overzicht + de connect-flow.

---

## 1. Secrets & environment variables

| Waar | Variabele | Waarvoor | Status |
|------|-----------|----------|--------|
| Vercel | `CRON_SECRET` | Gate voor de nachtelijke ad-sync-cron (`/api/cron/ad-sync`, 03:30) | verplicht |
| Vercel | `STATAMIC_API_KEY` | Statamic API-key; ook gedeeld geheim voor de CMS-schrijfroute | verplicht |
| Vercel | `LEAD_SUPPRESSION_SECRET` | Auth voor de suppressie-webhook (`/api/webhooks/suppression`) | verplicht voor #3 |
| Vercel | `HUBSPOT_COMPANY_PLAN_TIER_PROP` | HubSpot company-property-handle voor plan-tier (optioneel) | optioneel |
| Vercel | `HUBSPOT_COMPANY_DEAL_STAGE_PROP` | HubSpot company-property-handle voor deal-stage (optioneel) | optioneel |
| Vercel | `HUBSPOT_COMPANY_CONTRACT_VALUE_PROP` | HubSpot company-property voor contractwaarde (optioneel) | optioneel |
| Ploi (CMS) | `MISTER_CHAMELEON_CMS_WRITE_TOKEN` | Moet gelijk zijn aan `STATAMIC_API_KEY`; beveiligt de schrijfroute | verplicht voor blueprint-pagina's |
| Ploi (CMS) | `MISTER_CHAMELEON_API_URL` | Platform-URL voor de EntrySaved-webhook-listener | verplicht |
| Ploi (CMS) | `MISTER_CHAMELEON_WEBHOOK_SECRET` | Gedeeld geheim voor de cache-flush-webhook | verplicht |

De ad-platform-credentials (tokens, OAuth) worden **niet** als env-var gezet —
die vul je per tenant in de admin in (zie §3).

## 2. Database

Alle migraties zijn al toegepast op de prod-database (143–147: ad_sync,
audience-members, attributie, conversies, suppressie). Je hoeft hier niets voor
te doen. Let op: `supabase db push` werkt niet door een history-mismatch — draai
losse migraties via de Supabase SQL-editor of laat ze via de connector lopen.

## 3. Retargeting koppelen per platform

Ga naar **Admin → Tenants → [tenant] → Doelgroepen → Retargeting**. Per platform
vul je de credentials + het doel (audience) in en klik je **Test verbinding**,
daarna **Opslaan**. Zet daarna bovenaan **Dagelijkse audience-sync** aan.

### Google Ads (Customer Match via Data Manager API)
Sinds april 2026 loopt Customer Match via de Data Manager API (geen developer
token nodig).
1. Cloud Console → **Data Manager API** aanzetten.
2. OAuth-client (Web) maken → **client id + secret**.
3. Refresh token genereren met scope `https://www.googleapis.com/auth/datamanager`
   (bijv. via de OAuth Playground).
4. **Customer id** (10 cijfers) + evt. **login customer id** (MCC).
5. Google Ads → Audience manager → **Customer list** aanmaken → **user list id**.
6. Invullen in de Google-kaart → Test verbinding → Opslaan.

### Meta (Custom Audiences via CAPI)
1. Business Manager + ad-account.
2. Een **app** in je Business-portfolio (developers.facebook.com), use case
   "Marketing API".
3. **System user** → ad-account toewijzen (Manage) → **access token** met
   `ads_management`.
4. Ads Manager → Audiences → **Custom Audience (Customer list)** → **audience id**
   (accepteer eenmalig de Custom Audience-voorwaarden).
5. Invullen in de Meta-kaart (access token, ad account id, audience id).

### LinkedIn (Matched Audiences via DMP Segments)
1. LinkedIn Marketing Developer Platform-toegang aanvragen (`rw_dmp_segments`,
   `r_ads`) — dit heeft doorlooptijd, dus vroeg indienen.
2. OAuth-**access token** met die scopes.
3. Campaign Manager → **DMP-segment** aanmaken → **segment id** (numeriek) +
   **ad account id**.
4. Invullen in de LinkedIn-kaart.

> Geen spend nodig om audiences aan te maken en te uploaden. Je betaalt pas als
> je advertenties écht laat vertonen. Minimum audience-grootte om te targeten:
> ~1.000 (Meta), 300 (LinkedIn); Google-eligibility groeit met account-historie.

## 4. Conversie-feedback (offline conversions / CAPI)

Onderin het Retargeting-scherm, sectie **Conversie-feedback**. Zet aan en vul per
platform het conversie-doel in (hergebruikt de credentials van §3):
- **Google:** een Google Ads conversieactie van type **UPLOAD_CLICKS** → id.
- **Meta:** je **pixel id**.
- **LinkedIn:** je **conversion id** (numeriek).
Plus event-naam (bijv. "Lead"), standaardwaarde en valuta. Vanaf dan stuurt elke
formulier-conversie een server-side event terug zodat biedingen op echte leads
optimaliseren.

## 5. Suppressie / opt-outs

- Env `LEAD_SUPPRESSION_SECRET` zetten (§1).
- ESP-unsubscribe-webhook laten POST-en naar
  `https://<jouw-domein>/api/webhooks/suppression?tenant=<tenantId>` met header
  `x-mc-secret: <secret>`. Body: JSON `{ "email": "..." }` of ESP-form (Mailchimp
  `data[email]`).
- Handmatig beheren kan onder **Doelgroepen → Suppressie**.

## 6. E-mail & fysieke post opvolging

Via de bestaande outbound-webhook → Zapier/Make/n8n. Zie
`docs/lead-activation-recipes.md` voor kant-en-klare recepten (Mailchimp,
Stannp/Lob voor post).

## 7. Beveiliging — openstaande to-do's

- [ ] **Rotate de eerder gelekte GitHub PAT** (revoke + vervang in de Ploi
      build-command).
- [ ] **Rotate het eerder gelekte R2-secret**.
- [ ] **CMS-schrijfroute deployen** (`routes/web.php` in de deploy-repo
      `mister-chameleon-cms-another-statamic`) én `MISTER_CHAMELEON_CMS_WRITE_TOKEN`
      = `STATAMIC_API_KEY` zetten in Ploi (anders 503/401 op writes).
- [ ] Optioneel: de Google OAuth client secret resetten (was eerder in een
      screenshot zichtbaar).

## 8. Testen

- Google audience-sync: getest (1 member gepusht). ✓
- Meta/LinkedIn: testen zodra de accounts gekoppeld zijn.
- Conversie-feedback: één formulier insturen en de run/foutmelding checken.
- Suppressie: een curl zonder `x-mc-secret` moet 401 geven; met secret suppressie.
