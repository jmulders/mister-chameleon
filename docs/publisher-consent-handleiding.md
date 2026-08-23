# Hoe geef je jouw cookie-consent door aan Mister Chameleon

Deze handleiding is voor de websitebeheerder die de Mister Chameleon-snippet op
een eigen site gebruikt. De snippet personaliseert content en kan bezoekers
verrijken (bijvoorbeeld bedrijfsherkenning). Dat gebeurt alleen met toestemming
van de bezoeker. Hieronder lees je hoe je jouw bestaande cookie-consent aan ons
doorgeeft.

## De anonieme laag draait altijd

Een anonieme contextlaag draait voor iedere bezoeker, ook zonder toestemming. Die
gebruikt alleen signalen uit het verzoek zelf, zonder persoonsgegevens en zonder
een bezoeker over bezoeken heen te herkennen:

- apparaattype, grove geo (land/regio uit de headers, het IP-adres wordt niet
  opgeslagen), bron/UTM/referrer, en tijd.

Op basis daarvan tonen we al een gepersonaliseerde variant. Er wordt in deze laag
niets persistents opgeslagen: geen bezoekers-id, geen cookie, geen gedragshistorie.

## Wat gebeurt er pas na toestemming?

Toestemming gate't alleen de identificerende/persistente verwerking, in drie
categorieen:

- **analytics**: paginaweergaven en events wegschrijven (bijv. GA4).
- **personalization**: een persistente bezoeker-identiteit + gedrag over bezoeken
  heen onthouden (cross-sessie journey/historie) en daarop personaliseren.
- **enrichment**: IP-naar-bedrijf / Leadinfo / firmografische verrijking.

Zonder toestemming blijft dus de anonieme laag draaien; cross-sessie gedrag,
verrijking en analytics komen er pas ná toestemming bij. Het tenant-plafond
(privacy-instellingen) kan elke categorie verder beperken.

---

## Situatie 1: je gebruikt Google Consent Mode of een IAB TCF-CMP

Gebruik je Cookiebot, OneTrust, Usercentrics, of een andere CMP die Google
Consent Mode of de IAB TCF-standaard ondersteunt? Dan werkt het **automatisch**.
De snippet leest de status uit en stuurt die met elke aanvraag mee. Je hoeft in
principe niets te doen.

Wij vertalen de signalen zo naar onze categorieen:

**Google Consent Mode**

| Consent Mode-signaal | Onze categorie    |
| -------------------- | ----------------- |
| `analytics_storage`  | analytics         |
| `ad_personalization` | personalization   |
| `ad_storage`         | enrichment        |
| `ad_user_data`       | enrichment        |

**IAB TCF (purposes)**

| TCF-purpose(s)                       | Onze categorie    |
| ------------------------------------ | ----------------- |
| 1, 2                                 | enrichment        |
| 3, 4, 5, 6                           | personalization   |
| 7, 8, 9, 10                          | analytics         |

Het enige dat je eventueel instelt is de **consent-modus** in het admin-paneel
(Snippet -> Consent):

- **Auto** (aanbevolen): standaard weigeren totdat je CMP toestemming geeft.
- **Always**: standaard toestaan. Kies dit alleen als je de snippet zelf pas
  laadt nadat de bezoeker in jouw eigen banner akkoord is gegaan.

Een expliciete weigering (ook Global Privacy Control of Do-Not-Track) wordt in
beide modi altijd gerespecteerd.

---

## Situatie 2: je hebt een andere of eigen CMP

Werkt jouw CMP niet met Consent Mode of TCF? Geef de status dan zelf door via de
publisher-signaalroute. Er zijn drie manieren.

### A. Attribuut op de script-tag

Het snelst als je maar een globale ja/nee hebt:

```html
<script
  src="https://app.misterchameleon.com/api/snippet.js"
  data-site-key="sk_live_xxx"
  data-mc-consent="granted"></script>
```

Gebruik `granted` of `denied`.

### B. `window.mcConsent` als boolean of object

Zet dit **voordat** de snippet laadt. Een boolean voor alles-of-niets:

```html
<script>
  window.mcConsent = true; // of false
</script>
```

Of per categorie, als je onderscheid wilt maken:

```html
<script>
  window.mcConsent = {
    analytics: true,
    personalization: true,
    enrichment: false
  };
</script>
```

### C. `window.mcConsent` als functie of Promise (async CMP)

Weet je de status pas later (bijv. je CMP laadt asynchroon)? Geef een functie die
de status teruggeeft, of een Promise. Wij wachten hierop binnen het
tijdsbudget van de aanvraag (`data-mc-call-ms`).

```html
<script>
  // Functie die een object of boolean teruggeeft:
  window.mcConsent = function () {
    return window.myCmp.getConsent(); // { analytics, personalization, enrichment } of true/false
  };
</script>
```

```html
<script>
  // Of een Promise:
  window.mcConsent = new Promise(function (resolve) {
    window.myCmp.onReady(function (state) {
      resolve({
        analytics: state.stats,
        personalization: state.marketing,
        enrichment: state.marketing
      });
    });
  });
</script>
```

---

## Wat gebeurt er bij geen of onbekende consent?

- De **anonieme laag draait altijd** (apparaat, grove geo, bron/UTM, tijd), dus
  ook zonder toestemming zie je een gepersonaliseerde variant.
- Vindt de snippet **geen enkel** signaal, dan geldt jouw ingestelde standaard
  voor de persistente/verrijkings-laag: bij **Auto** blijft die uit (geen
  cross-sessie gedrag, geen verrijking, geen analytics), bij **Always** staat die
  aan.
- **Global Privacy Control** en **Do-Not-Track** in de browser gelden altijd als
  weigering van de persistente laag, ongeacht de modus.
- Bij een weigering slaan we niets persistents op: geen bezoekers-id
  (localStorage/cookie), geen gedragshistorie, geen verrijking.

## Hoe test je het?

1. Open je site met de browser-console open.
2. Zet een testwaarde neer voordat de pagina laadt, bijvoorbeeld
   `window.mcConsent = { analytics:false, personalization:false, enrichment:false }`.
3. Kijk in het tabblad Netwerk naar de aanvraag naar `/api/snippet/decide`. In de
   request-body zie je het veld `consent` met de doorgegeven categorieen.
4. Verander de waarde naar `true` (of laat je CMP toestemming geven) en herlaad.
   Het `consent`-veld moet meebewegen.
5. Test ook de weigering: met alles op `false` blijft de anonieme laag
   personaliseren, maar mag er niets persistents worden opgeslagen (geen
   bezoekers-id, geen gedragshistorie) en geen verrijking of analytics
   plaatsvinden.

Kom je er niet uit? Neem contact op met je Mister Chameleon-contactpersoon.
