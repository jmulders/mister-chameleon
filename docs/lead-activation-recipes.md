# Lead-activatie via de webhook — Zapier / n8n recepten

Follow-up van gekwalificeerde leads via **e-mail** (Mailchimp e.d.) en **fysieke
post** (Stannp / Lob), zonder extra platform-code. Alles hangt aan de bestaande
uitgaande **`lead.qualified`-webhook** van de Lead Base.

Geen deploy nodig — dit zijn configuratie-recepten.

---

## 1. De webhook aanzetten

De Lead Base vuurt één webhook-POST zodra een lead **kwalificeert** (wordt
`known`/`customer`, of bereikt `mql`/`sql`/`customer`). Normale pageviews vuren
niks — alleen de opwaartse transitie.

Instellen in het admin: **Tenant → Doelgroepen → Target accounts / Leads →
Webhook-instellingen**:

1. **Webhook URL** — plak hier de "Catch Hook"-URL uit Zapier of n8n.
2. **Webhook secret** — genereer er één (knop) of laat leeg. Met een secret
   worden de POSTs HMAC-gesigneerd (zie §4).

> Eén webhook-URL per tenant. Wil je meerdere acties (Mailchimp **én** een
> brief), splits dan ín Zapier/n8n na de trigger — niet meerdere webhook-URLs.

---

## 2. De payload (velden om te mappen)

Elke POST is `Content-Type: application/json` met deze body:

```json
{
  "event": "lead.qualified",
  "tenantId": "statamic",
  "occurredAt": "2026-07-10T09:20:00.000Z",
  "transition": {
    "fromLevel": "recognised", "toLevel": "known",
    "fromStatus": "engaged",   "toStatus": "mql"
  },
  "person": {
    "fullName": "Mike Smith",
    "firstName": "Mike",
    "lastName": "Smith",
    "email": "mike@acme.com",
    "jobTitle": "Head of Marketing",
    "linkedinUrl": "https://linkedin.com/in/…"
  },
  "profile": {
    "visitorKey": "…",
    "identityLevel": "known",
    "status": "mql",
    "companyName": "Acme BV",
    "companyDomain": "acme.com",
    "companySize": "51-200",
    "companyIndustry": "Software",
    "geoCountry": "NL",
    "geoRegion": "Noord-Holland",
    "intentScore": 72,
    "funnelStage": "consideration",
    "segmentIds": ["hot-leads"],
    "consentState": "granted",
    "abmLeadId": "…"
  }
}
```

Let op:

- **`person`** is gevuld voor named ABM-leads en **`null`** voor puur op de funnel
  gekwalificeerde bezoekers. E-mail voor Mailchimp komt uit `person.email` — is
  `person` null, dan heb je geen e-mailadres (filter die eruit in Zapier).
- Er zit **geen postadres** in de payload — belangrijk voor fysieke post (§5).

---

## 3. Recept — Mailchimp (e-mail)

**Doel:** gekwalificeerde lead → toevoegen/updaten als Mailchimp-subscriber (of
tag zetten die een automation triggert).

Zapier:

1. **Trigger:** *Webhooks by Zapier → Catch Hook*. Kopieer de gegeven URL naar
   het webhook-veld in het admin. Stuur een test (zie §6) zodat Zapier de velden
   leert.
2. **(Aanbevolen) Filter:** *Only continue if…* `person__email` **Exists** — zo
   sla je de leads zonder e-mail over.
3. **(Optioneel) Filter:** `profile__consentState` **(Text) Exactly matches**
   `granted` — alleen leads met marketing-toestemming. **Belangrijk voor AVG.**
4. **Actie:** *Mailchimp → Add/Update Subscriber*:
   - Audience: je lijst
   - Subscriber Email: `person__email`
   - Status: `subscribed` (of `pending` voor double opt-in)
   - Merge fields: FNAME ← `person__firstName`, LNAME ← `person__lastName`,
     COMPANY ← `profile__companyName`
   - Tags: bijv. `lead-{{profile__status}}` of `mc-retarget`

Wil je i.p.v. direct mailen een **automation/journey** starten: zet in stap 4
alleen een **tag**; laat Mailchimp's automation op die tag triggeren.

n8n-equivalent: **Webhook**-node → **IF**-node (email bestaat) → **Mailchimp**-node
(*Member → Create/Update*).

---

## 4. De handtekening verifiëren (optioneel maar aan te raden)

Als je een secret hebt ingesteld, stuurt de webhook twee headers mee:

- `x-mc-timestamp`: unix-seconden
- `x-mc-signature`: `sha256=<hex>` van `HMAC_SHA256(secret, "{timestamp}.{ruwe body}")`

In Zapier: gebruik *Catch **Raw** Hook* + een *Code by Zapier (JavaScript)*-stap
die de HMAC herberekent en vergelijkt vóór je verder gaat. Kun je de bron
afschermen (bijv. n8n achter eigen auth), dan mag je dit overslaan. Zonder
verificatie: houd de webhook-URL geheim.

Voorbeeld (Code by Zapier, JS):

```js
const crypto = require('crypto');
const secret = 'PLAK_JE_SECRET';
const ts = inputData.x_mc_timestamp;
const raw = inputData.raw_body;
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex');
if (expected !== inputData.x_mc_signature) throw new Error('Bad signature');
return { ok: true };
```

---

## 5. Recept — fysieke post (Stannp / Lob)

**Doel:** gekwalificeerde lead → automatisch een brief/kaart laten drukken en
posten.

Aanbevolen provider voor NL/EU: **Stannp** (goedkoop, EU-post, API + Zapier).
Alternatief: **Lob** (beste DX, vooral VS/Canada) of **PostGrid** (compliance).
Voor een handgeschreven touch: **Scribeless**.

> **Belangrijke beperking — adres.** De webhook bevat **geen postadres**. Je hebt
> voor elke brief een geldig adres nodig. Praktische opties:
>
> - **Adres-lookup in Zapier**: na de trigger een stap die op `person__email` of
>   `profile__companyDomain` het adres ophaalt uit jouw bron — een *Google Sheet*
>   (kolom e-mail → adres), je CRM, of een enrichment-app.
> - **Alleen named ABM-leads** waar je het adres al van hebt (via je Sales
>   Navigator-import of CRM).
>
> Zonder adresbron kun je fysieke post niet betrouwbaar automatiseren.

Zapier:

1. **Trigger:** *Catch Hook* (dezelfde webhook; splits ná de trigger).
2. **Filter:** alleen hete leads, bijv. `profile__status` = `sql`, of
   `profile__intentScore` **(Number) Greater than** `70` — post is duur, dus
   selecteer streng.
3. **Adres-stap:** *Lookup Spreadsheet Row* (Google Sheets) op `person__email`,
   of een enrichment-app → levert straat/postcode/plaats.
4. **Actie:** *Stannp → Create/Send Letter* (of *Lob → Create Letter*):
   - Recipient: naam ← `person__fullName`, adres ← velden uit stap 3
   - Template: je vooraf ontworpen brief; personaliseer met `person__firstName`,
     `profile__companyName`
   - Post-type/verzending: naar wens

n8n-equivalent: **Webhook** → **IF** (hot) → **Google Sheets** (lookup) →
**HTTP Request**-node naar de Stannp/Lob API (`create letter`).

**Handgeschreven (Scribeless):** zelfde flow, maar in stap 4 de Scribeless-API/
Zapier-actie *Create handwritten letter/card*. Duurder, maar hogere respons voor
top-accounts.

---

## 6. Testen

1. Zet de Catch-Hook-URL in het webhook-veld en sla op.
2. Trigger een echte kwalificatie (of gebruik in het admin de **replay**-knop op
   een eerdere webhook-delivery om dezelfde payload opnieuw te sturen).
3. In Zapier: *Zap history* toont de binnenkomende payload en of Mailchimp/Stannp
   de actie uitvoerde. In het platform: de **webhook-deliveries**-tabel toont
   status + retries.

---

## Samenvatting

| Kanaal | Route | Nieuwe code? | Let op |
|--------|-------|--------------|--------|
| E-mail (Mailchimp/ESP) | webhook → Zapier/n8n → *Add subscriber / tag* | Nee | consent-filter (AVG); `person.email` kan null zijn |
| Fysieke post (Stannp/Lob) | webhook → Zapier/n8n → adres-lookup → *Create letter* | Nee | payload heeft **geen adres** — adresbron vereist |
| Handgeschreven (Scribeless) | idem, Scribeless-actie | Nee | duurder; voor top-accounts |

Wil je later tóch een echte segment-synchronisatie (toevoegen **én** verwijderen,
zoals de ad-sync) naar Mailchimp/ESP i.p.v. event-gedreven — dan bouwen we de
ad-sync-architectuur uit met ESP-destinations. Voor nu dekt de webhook + Zapier
de follow-up af.
