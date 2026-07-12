# Handleiding: een Statamic-tenant live zetten met de volledige closed loop

Deze handleiding beschrijft alle stappen om een nieuwe tenant met een **Statamic-site**
op te leveren, van eerste aanmaak tot en met de **closed loop**: bezoeker naar
gepersonaliseerde site, formulier naar lead, en conversie teruggemeld aan Google Ads.
Elke stap is in volgorde uit te voeren. Vink af wat gedaan is.

> Notatie: waar "platform" staat bedoelen we de Next.js-app op Vercel. Waar "CMS"
> staat bedoelen we de Statamic-app op Ploi. "Marketing-site-tenant" is de tenant
> waarvan de site de bezoekers en het ad-verkeer ontvangt (bijv. `statamic`).

---

## 0. Architectuur in het kort

Drie systemen werken samen:

1. **Platform** (Next.js op Vercel): serveert het domein, personalisatie, admin,
   alle API-routes en de ad-sync/conversie-logica.
2. **CMS** (Statamic/Laravel op Ploi): de content, redactie in de Control Panel.
3. **Supabase**: de database (leads, profielen, ad-sync-instellingen, conversie-log).

Het domein (`www.jouwsite.nl`) draait via het **platform**; de content komt uit
Statamic. Formulieren en conversies lopen via het platform.

Ad-platform-credentials worden **niet** als env-var gezet, maar per tenant in de
admin ingevuld (zie stap 8).

---

## 1. Tenant aanmaken

1. Ga naar **Admin → Tenants → New Tenant**.
2. Vul naam en tenant-id (slug) in. Dit id gebruik je overal terug (bijv. `statamic`).
3. Rond de wizard af. De tenant verschijnt in de lijst.

## 2. CMS-provider op Statamic zetten

1. Open de tenant → **Settings**.
2. Zet **CMS provider** op **Statamic**.
3. Sla op. Pas nu verschijnen de Statamic-deploy-panelen op de Setup-pagina.

## 3. Statamic-site provisionen en deployen

Er zijn twee routes:

**A. Geautomatiseerd (Ploi):** op **Setup** verschijnt een provisioning-kaart die
een repo + Ploi-app aanmaakt en deployt. Volg die kaart.

**B. Bestaande Statamic-app:** koppel de bestaande Ploi-site. Vul op **Setup → CMS
credentials** de write-token in (zie hieronder) en op **Finalize** de
`statamicBaseUrl` (de API-URL van de Statamic-app, bijv. `https://cms.jouwsite.nl`).

Let op: de **deploy-repo** van de CMS kan een andere zijn dan een lokale werkkopie.
Wijzigingen aan de CMS-app (zoals de listener in stap 9) moeten in de repo waar
**Ploi vanaf deployt**.

## 4. De CMS-schrijfroute beveiligen

Het platform kan pagina's in Statamic aanmaken via een custom schrijfroute. Beveilig
die met een gedeeld geheim.

1. Genereer een geheim: `openssl rand -base64 32`.
2. Zet in **Vercel** de env-var `STATAMIC_API_KEY` op die waarde.
3. Zet in **Ploi** (`.env` van de CMS-app) `MISTER_CHAMELEON_CMS_WRITE_TOKEN` op
   **exact dezelfde** waarde.
4. In de deploy-repo van de CMS staat een auth-check bovenaan de route
   `POST /api/collections/{col}/entries` (503 als de token niet gezet is, 401 bij
   mismatch). Controleer dat die aanwezig is.

Test (verwacht **401** zonder token):

```bash
curl -i -X POST "https://cms.jouwsite.nl/api/collections/pages/entries" \
  -H "Content-Type: application/json" -d '{"slug":"authtest","title":"x"}'
```

## 5. Domein koppelen

1. Open de tenant → **Setup → Custom domains**.
2. Voeg je domein toe. Als de Vercel-integratie aanstaat, worden de DNS-records
   getoond. Zet die bij je DNS-provider.
3. Wacht tot het domein geldig (groen) is.

## 6. Personalisatie-snippet in Statamic plaatsen

De personalisatie werkt via een snippet in de Statamic-templates.

1. Op **Setup → Statamic setup guide** staat het snippet + de site-key.
2. Plaats het head-snippet in je Statamic-layout.
3. Gebruik de context-slot-markers waar je gepersonaliseerde blokken wilt.

## 7. Environment-variabelen

Zet de volgende variabelen. Genereer secrets met `openssl rand -base64 32` en plak
ze zelf in Vercel/Ploi (deel ze niet in chats of screenshots).

| Waar | Variabele | Waarvoor |
|------|-----------|----------|
| Vercel | `CRON_SECRET` | Gate voor de nachtelijke ad-sync-cron (03:30) |
| Vercel | `STATAMIC_API_KEY` | Statamic API-key + gedeeld geheim CMS-schrijfroute |
| Vercel | `LEAD_SUPPRESSION_SECRET` | Auth voor de suppressie-webhook |
| Vercel | `LEAD_INBOUND_SECRET` | Auth voor de inbound-form-brug (zelfde waarde als in Ploi) |
| Vercel | `MARKETING_SITE_TENANT` | (optioneel) tenant-id voor aankoop-conversie-attributie; standaard `statamic` |
| Vercel | `HUBSPOT_COMPANY_*_PROP` | (optioneel) HubSpot-property-handles voor CRM-verrijking |
| Ploi (CMS) | `MISTER_CHAMELEON_CMS_WRITE_TOKEN` | Gelijk aan `STATAMIC_API_KEY` |
| Ploi (CMS) | `MISTER_CHAMELEON_API_URL` | Platform-basis-URL (bijv. `https://www.jouwsite.nl`) |
| Ploi (CMS) | `MISTER_CHAMELEON_WEBHOOK_SECRET` | Gedeeld geheim cache-flush-webhook |
| Ploi (CMS) | `LEAD_INBOUND_SECRET` | Zelfde waarde als op Vercel |
| Ploi (CMS) | `MISTER_CHAMELEON_TENANT` | (optioneel) tenant-id voor de inbound-form-brug; standaard `statamic` |

Supabase- en Stripe-variabelen (indien betalingen gebruikt worden) horen sowieso op
Vercel te staan; die zijn platformbreed.

## 8. Retargeting koppelen (Google Ads via Data Manager API)

Ga naar **Audience → Retargeting**. Sinds april 2026 loopt Customer Match via de
Data Manager API (geen developer-token nodig).

1. Cloud Console: zet de **Data Manager API** aan.
2. Maak een **OAuth-client (Web)**: client id + client secret.
3. Genereer een **refresh token** met scope
   `https://www.googleapis.com/auth/datamanager` (bijv. via de OAuth Playground).
4. Noteer je **Customer id** (10 cijfers) en eventueel **login customer id** (MCC).
5. Google Ads: **Audience manager → Customer list** aanmaken. Noteer het
   **user list id**.
6. Vul alles in op de Google-kaart, klik **Test connection**, dan **Save**.
7. Zet bovenaan **Daily audience sync enabled** aan.

Test met **Preview segment** (aantal leads) en **Sync now** (push). Geen ad-spend
nodig om audiences te vullen; je betaalt pas als je advertenties echt vertoont.

## 9. Conversie-feedback (Google enhanced conversions for leads)

Dit is de kern van de closed loop: een formulierinzending stuurt server-side een
conversie-event terug zodat biedingen op echte leads optimaliseren.

### 9a. Conversie-actie maken in Google Ads

1. **Doelen → Conversies → Nieuwe conversieactie**.
2. Kies **Conversies offline** (import via API/CRM), niet website of telefoon.
3. Kies **Deze stap overslaan en later een gegevensbron instellen** (onze API is de
   bron) en vink **Verbeterde conversies voor leads aanzetten** aan.
4. Categorie: **Gekwalificeerde lead**. Geef de actie een naam.
5. Voltooien. Open daarna de conversie-actie en pak het **`ctId=`**-nummer uit de
   browser-URL. Dat is je conversion-action-id.

### 9b. Enhanced conversions for leads activeren (account-niveau)

Zonder deze stap weigert Google elk event met
`DESTINATION_ACCOUNT_NOT_ENABLED_ENHANCED_CONVERSIONS_FOR_LEADS`.

1. **Doelen → Conversies → Instellingen**.
2. Blok **Verbeterde conversies voor leads**: vink aan, accepteer de
   **klantgegevensvoorwaarden**, kies een methode en sla op.
3. Activatie kan enkele minuten tot circa 24 uur duren.

### 9c. Invullen in het platform

Op **Audience → Retargeting → Conversion feedback**:

1. Zet de sectie **aan**.
2. Vul bij **Google** het `ctId`-nummer in.
3. Event-naam `Lead`, valuta `EUR` (standaardwaarde optioneel).
4. **Save**. Meta/LinkedIn laat je leeg tot die accounts gekoppeld zijn.

## 10. Formulieren en de closed loop

Elk bezoekers-formulier op het platform draait via één gedeelde route
(`reportInboundConversion`): lead-capture in de Lead Base, profiel naar "converted",
en conversie-feedback naar de ad-platforms. Dit geldt automatisch voor:

- Contactformulier (`/api/contact`)
- CMS-/platformformulieren (`/api/forms/[formKey]`)
- Trial-aanmelding (`/api/trial/start`)
- Demo-boeking (`/api/demo/book`)
- Aankoop bij Stripe-betaling (`checkout.session.completed`)

### 10a. Statamic-eigen formulieren (inbound-form-brug)

Formulieren die door **Statamic zelf** worden verwerkt posten naar de CMS, niet naar
het platform. Om die toch mee te nemen is er een brug:

1. Platform-endpoint: `POST /api/webhooks/inbound-form?tenant=<id>`, header
   `x-mc-secret: <LEAD_INBOUND_SECRET>`.
2. In de CMS-deploy-repo, in `app/Providers/AppServiceProvider.php` (methode `boot()`),
   een listener op het `FormSubmitted`-event die elke inzending doorpost naar dat
   endpoint. De listener leest `MISTER_CHAMELEON_API_URL` en `LEAD_INBOUND_SECRET`.
3. Zorg dat Ploi bij de deploy `php artisan config:clear` draait, anders leest
   `env()` de nieuwe variabelen niet.

> Let op: veel "contact"-formulieren op een platform-gerenderde pagina zijn een
> React-component die naar `/api/contact` post. Die zijn al gedekt zonder deze brug.
> De brug is alleen nodig voor formulieren die echt via Statamic's form-controller
> lopen.

## 11. Suppressie en opt-outs

1. Zet `LEAD_SUPPRESSION_SECRET` op Vercel.
2. Laat je e-mailtool (ESP) de unsubscribe-webhook posten naar
   `https://www.jouwsite.nl/api/webhooks/suppression?tenant=<id>` met header
   `x-mc-secret: <secret>` en body `{ "email": "..." }`.
3. Handmatig beheren kan onder **Audience → Suppression**.

Onderdrukte adressen vallen uit de retargeting-audiences en worden meteen bij de
ad-platforms verwijderd.

## 12. Meta en LinkedIn (optioneel)

- **Meta:** Business Manager + ad-account, een app met Marketing API, een system
  user met `ads_management`, en een Custom Audience (Customer list). Vul access
  token, ad account id en audience id in op de Meta-kaart.
- **LinkedIn:** vraag Marketing Developer Platform-toegang aan (`rw_dmp_segments`,
  `r_ads`); dit heeft doorlooptijd, dus dien vroeg in. Maak een DMP-segment aan en
  vul access token, ad account id en segment id in op de LinkedIn-kaart.

## 13. Beveiliging (Vercel firewall + secrets)

- **Firewall-bypass:** zet in Vercel onder **Firewall → Rules** een bypass-regel
  voor pad `/api/webhooks/*` (Starts with). Anders challenget Vercel legitieme
  server-naar-server webhooks (suppressie, inbound-form) met een bot-check.
- **Secrets:** roteer secrets die ooit zichtbaar waren (in een screenshot, terminal
  of chat). Genereer nieuw met `openssl rand -base64 32` en werk beide plekken
  (Vercel + Ploi) tegelijk bij.

## 14. Testen en verificatie

Doe deze checks in volgorde.

### Inbound-form-endpoint (isolatie platform-kant)

```bash
curl -i -X POST "https://www.jouwsite.nl/api/webhooks/inbound-form?tenant=<id>" \
  -H "Content-Type: application/json" \
  -H 'x-mc-secret: <LEAD_INBOUND_SECRET>' \
  -d '{"values":{"email":"test@example.com"}}'
```

Verwacht **200** `{"ok":true,"captured":true}`. Een **401** betekent dat de secret
op Vercel en in de curl (of Ploi) niet gelijk zijn. Een **503** betekent dat
`LEAD_INBOUND_SECRET` niet op Vercel staat.

### Echte inzending

Vul een echt formulier op de site in (met e-mailadres). Controleer in de database:

```sql
-- Lead in de Lead Base
select identifier, (profile->>'email') as email, created_at
from abm_leads
where tenant_id='<id>' and identifier like 'form_%'
order by created_at desc limit 5;

-- Conversie-event (status hoort 'ok' te zijn)
select platform, status, event_name, error, created_at
from ad_conversion_events
where tenant_id='<id>' order by created_at desc limit 5;
```

Een `status = ok` op het Google-event betekent dat de volledige closed loop werkt.
Zie `status = error` met `DESTINATION_ACCOUNT_NOT_ENABLED...`, dan is stap 9b nog
niet actief of nog aan het propageren.

## 15. Veelvoorkomende fouten

| Symptoom | Oorzaak | Oplossing |
|----------|---------|-----------|
| Google-event 400 `event_source` required | Verplicht veld ontbrak | Client stuurt nu `eventSource: "WEB"` mee |
| Google-event 400 `DESTINATION_ACCOUNT_NOT_ENABLED...` | Enhanced conversions for leads staat uit | Stap 9b uitvoeren, daarna wachten |
| Formulier geeft geen lead/conversie | Formulier post naar de verkeerde laag | Controleer of het naar `/api/contact` of via de Statamic-brug loopt |
| Curl krijgt 429 "Vercel Security Checkpoint" | Bot-challenge op de webhook | Firewall-bypass voor `/api/webhooks/*` (stap 13) |
| Listener leest env niet na Ploi-deploy | Config gecachet | `php artisan config:clear` in de deploy-commando's |
| "Save failed" in Retargeting | Ad-sync-tabellen ontbreken in de DB | Migraties toepassen op het juiste Supabase-project |
| Server-fout bij een admin-actie | Ontbrekende import (bijv. `revalidatePath`) | Import toevoegen; `ignoreBuildErrors` verbergt dit in de build |

## 16. Checklist

- [ ] Tenant aangemaakt, CMS-provider op Statamic
- [ ] Statamic-site gedeployd, `statamicBaseUrl` gezet
- [ ] Schrijfroute beveiligd (401-test geslaagd)
- [ ] Domein gekoppeld en geldig
- [ ] Snippet in Statamic geplaatst
- [ ] Alle env-vars gezet (Vercel + Ploi)
- [ ] Google-retargeting gekoppeld, Test connection OK, dagelijkse sync aan
- [ ] Conversie-actie gemaakt + enhanced conversions for leads geactiveerd + ctId ingevuld
- [ ] Inbound-form-brug (indien Statamic-formulieren) + `config:clear`
- [ ] Suppressie-webhook + secret gezet
- [ ] Firewall-bypass voor `/api/webhooks/*`
- [ ] End-to-end getest: lead + conversie-event `ok` in de DB
- [ ] Secrets geroteerd die ooit zichtbaar waren
