# Verwerkersovereenkomst (DPA) — Mister Chameleon

**Status: concept. Niet ondertekenen of meesturen vóór juridische toetsing.**
Dit is een werkdocument, opgesteld op basis van de feitelijke werking van het
platform (zie verwijzingen naar de code). Het is geen juridisch advies. Laat dit
nakijken door een privacyjurist voordat je het aan een klant stuurt, in het
bijzonder de rolverdeling (verwerker vs. gezamenlijke verwerkingsverantwoordelijke)
bij verrijking en de doorgifte buiten de EER.

Laatst bijgewerkt: 2 augustus 2026

---

## Partijen

Deze verwerkersovereenkomst ("Overeenkomst") hoort bij de hoofdovereenkomst tussen:

- **[Naam Mister Chameleon B.V.]**, hierna "Verwerker" of "Mister Chameleon"; en
- **[Naam klant]**, hierna "Verwerkingsverantwoordelijke" of "Klant".

De Klant bepaalt het doel en de middelen van de verwerking van persoonsgegevens
van bezoekers van de website(s) van de Klant. Mister Chameleon verwerkt die
gegevens uitsluitend in opdracht van de Klant, behoudens het bepaalde in
artikel 8 (Verrijking en rolverdeling).

---

## 1. Onderwerp en duur

1.1 Mister Chameleon levert een SaaS-platform voor contextuele personalisatie:
per bezoeker wordt bepaald welke inhoud, formuliervarianten en e-mailvarianten
worden getoond, op basis van signalen (gedrag, tijd, herkomst en — indien
ingeschakeld — firmografische verrijking).

1.2 Deze Overeenkomst geldt zolang Mister Chameleon persoonsgegevens verwerkt
voor de Klant, en eindigt met de verwijdering van die gegevens conform Annex I.

---

## 2. Aard en doel van de verwerking

2.1 De verwerking omvat: het ontvangen van bezoekersverzoeken, het opbouwen en
bewaren van een bezoekersprofiel per website-bezoeker, het toepassen van de door
de Klant ingestelde regels, het opslaan van formulierinzendingen, en het
versturen van transactionele/adaptieve e-mail namens de Klant.

2.2 Het doel is uitsluitend het leveren van de dienst aan de Klant. Mister
Chameleon verwerkt de gegevens niet voor eigen doeleinden en verkoopt geen
gegevens.

---

## 3. Categorieën betrokkenen en persoonsgegevens

3.1 **Betrokkenen:** bezoekers van de website(s) van de Klant en personen die
formulieren invullen (leads).

3.2 **Persoonsgegevens (afhankelijk van toestemming, zie artikel 7):**

- **Altijd (essentieel/pseudonieme laag):** een pseudonieme bezoekerssleutel
  (`visitor_key`), aantal bezoeken, eerste/laatste bezoekmoment.
- **IP-adres:** verwerkt bij het afhandelen van het verzoek en — indien
  verrijking aanstaat — als invoer voor geo- en bedrijfsverrijking. *Een
  IP-adres geldt in de EU doorgaans als persoonsgegeven, ook wanneer de
  uitkomst een bedrijfsnaam is.*
- **Gedragssignalen (alleen bij `personalization`-toestemming):** bekeken
  pagina's, interesse-scores, funnelfase, segmenten.
- **Firmografische gegevens (alleen bij `enrichment`-toestemming):**
  bedrijfsnaam, domein, bedrijfsgrootte, sector, geoland/-regio.
- **Attributie (alleen bij `analytics`/`personalization`-toestemming):**
  UTM-parameters, referrer, eerste kanaal.
- **Formulierinzendingen:** de door de bezoeker ingevulde velden (bv. naam,
  e-mailadres) en het e-mailadres van de ontvanger van een bevestigingsmail.

3.3 Er worden geen bijzondere categorieën persoonsgegevens (art. 9 AVG) beoogd.
De Klant verplicht zich geen formuliervelden in te richten die dergelijke
gegevens uitvragen zonder passende grondslag.

---

## 4. Verplichtingen van de Verwerker

Mister Chameleon:

a. verwerkt uitsluitend op gedocumenteerde instructie van de Klant (deze
   Overeenkomst, de platforminstellingen die de Klant kiest, en aanvullende
   schriftelijke opdrachten);

b. waarborgt dat personen met toegang tot de gegevens tot geheimhouding zijn
   gehouden;

c. treft de passende technische en organisatorische maatregelen uit Annex III;

d. schakelt subverwerkers uitsluitend in conform artikel 5;

e. helpt de Klant, voor zover redelijkerwijs mogelijk, bij verzoeken van
   betrokkenen (inzage, verwijdering, bezwaar) en bij DPIA's en
   voorafgaande raadplegingen;

f. meldt een datalek zonder onredelijke vertraging en uiterlijk binnen 48 uur
   nadat het bekend is geworden bij Mister Chameleon (zie artikel 6);

g. verwijdert of retourneert na afloop alle persoonsgegevens conform Annex I;

h. stelt de Klant de informatie ter beschikking die nodig is om naleving aan te
   tonen, en maakt audits mogelijk conform artikel 9.

---

## 5. Subverwerkers

5.1 De Klant geeft algemene toestemming voor het inschakelen van subverwerkers.
De actuele lijst staat in **`docs/legal/subverwerkers.md`** (Annex II) en wordt
op verzoek verstrekt.

5.2 Mister Chameleon informeert de Klant vooraf over voorgenomen wijzigingen in
de subverwerkers, zodat de Klant bezwaar kan maken.

5.3 Mister Chameleon legt elke subverwerker dezelfde verplichtingen op als in
deze Overeenkomst en blijft jegens de Klant aansprakelijk voor hun handelen.

5.4 **Verrijkingssubverwerkers worden alleen ingeschakeld wanneer (a) de Klant
de verrijking voor zijn tenant heeft aangezet en (b) de betrokken bezoeker de
bijbehorende toestemming heeft gegeven.** Zie artikel 7 en 8.

---

## 6. Datalekken

6.1 Mister Chameleon meldt een inbreuk in verband met persoonsgegevens aan de
Klant zonder onredelijke vertraging en uiterlijk binnen 48 uur na ontdekking,
met de aard van de inbreuk, de (categorieën) betrokkenen en gegevens, de
waarschijnlijke gevolgen en de getroffen/voorgestelde maatregelen.

6.2 De Klant is verantwoordelijk voor een eventuele melding aan de Autoriteit
Persoonsgegevens en aan betrokkenen. Mister Chameleon ondersteunt daarbij.

---

## 7. Grondslag en toestemming

7.1 De Klant is verantwoordelijk voor een geldige grondslag en voor de
informatie aan betrokkenen (privacyverklaring, cookie-/consentbanner).

7.2 Het platform hanteert een consent-gestuurd model (zie
`docs/legal/grondslag-verrijking.md`). De pseudonieme, essentiële laag draait op
grondslag *gerechtvaardigd belang*; gedragsprofilering vereist
`personalization`-toestemming; firmografische verrijking vereist
`enrichment`-toestemming. Zonder toestemming ontvangt de bezoeker de
standaardervaring en wordt geen profiel met bijzondere velden opgebouwd.

7.3 De Klant neemt de verrijking en de ingeschakelde subverwerkers op in zijn
eigen privacyverklaring.

---

## 8. Verrijking en rolverdeling (aandachtspunt)

8.1 Voor de kernverwerking (profielopslag, regeltoepassing, formulieropslag,
e-mailverzending) treedt Mister Chameleon op als **verwerker** in opdracht van
de Klant.

8.2 **Aandachtspunt gezamenlijke verantwoordelijkheid.** Doordat Mister
Chameleon de verrijkingsbronnen selecteert en de verrijkingslogica bepaalt, kan
voor dát onderdeel een gezamenlijke verwerkingsverantwoordelijkheid (art. 26
AVG) ontstaan. Het platform beperkt dit risico doordat de verrijking **per
tenant door de Klant wordt aan- of uitgezet** en de Klant per bron kiest — de
Klant instrueert dus welke verrijking plaatsvindt. Partijen komen overeen deze
rolverdeling expliciet vast te leggen en, waar nodig, een
art.26-regeling te treffen. *Dit punt vereist juridische toetsing.*

---

## 9. Audit

9.1 Mister Chameleon stelt jaarlijks, en op redelijk verzoek, informatie
beschikbaar om naleving aan te tonen (deze Overeenkomst, Annex II en III,
relevante certificeringen van subverwerkers).

9.2 Fysieke audits vinden plaats na redelijke aankondiging, tijdens
kantooruren, met inachtneming van de vertrouwelijkheid van andere klanten in de
multi-tenant omgeving.

---

## 10. Doorgifte buiten de EER

10.1 De primaire opslag en verwerking vinden plaats binnen de EER (zie Annex I).

10.2 Enkele subverwerkers zijn buiten de EER gevestigd (zie Annex II). Voor die
doorgiften baseert Mister Chameleon zich op een adequaatheidsbesluit of op de
EU-modelcontractbepalingen (SCC's), met aanvullende maatregelen waar nodig. *Te
verifiëren per subverwerker.*

---

## Annex I — Verwerkingsdetails, locatie en bewaartermijn

**Locatie van de gegevens**

- **Compute (applicatie):** Vercel, EER-regio (aanbevolen: Frankfurt `fra1`).
- **Database en opslag:** Supabase (PostgreSQL), EER-regio. *Bevestig de
  projectregio in het Supabase-dashboard vóór ondertekening.*
- **E-mail:** Resend (transactioneel). *Verifieer verwerkingsregio.*
- **Verrijking en CRM:** diverse, deels buiten de EER — zie Annex II.

**Bewaartermijn (feitelijk, uit de code)**

- **Bezoekersprofielen (`visitor_profiles`):** rollend **90 dagen** vanaf het
  laatste bezoek (`DEFAULT_RETENTION_DAYS = 90` in `lib/lead-base/profile-gate.ts`);
  `expires_at` wordt bij elk bezoek ververst en verlopen rijen worden
  automatisch verwijderd (`purge` in `lib/lead-base/visitor-profiles-store.ts`).
- **Bezoekersgebeurtenissen (`visitor_events`):** 90 dagen.
- **Webhook-logs:** 30 dagen.
- **Formulierinzendingen / ABM-leads:** bewaard volgens de afspraak met de Klant;
  ABM-leads kennen een eigen `expires_at`.

Na beëindiging worden de persoonsgegevens van de Klant binnen [30] dagen
verwijderd of geretourneerd, tenzij een wettelijke bewaarplicht anders vereist.

## Annex II — Subverwerkers

Zie **`docs/legal/subverwerkers.md`**.

## Annex III — Technische en organisatorische maatregelen (samenvatting)

- Toegang tot de database via service-role, server-side; geen directe
  clienttoegang tot profielgegevens.
- Encryptie in transit (TLS) en at rest (Supabase-opslag).
- Formulierinzendingen worden versleuteld opgeslagen (encryptie-pipeline, zie
  runbook).
- Consent-gating vóór opslag: gegevens waarvoor geen toestemming is, worden niet
  weggeschreven (`profile-gate.ts`).
- Per-tenant isolatie van configuratie en cache (tenant-gescheiden cachesleutel
  met ownership-guard).
- Per-tenant noodschakelaar om personalisatie direct terug te zetten naar de
  standaardervaring zonder deploy.
- Logging en herstel: onmiddellijke rollback naar de vorige deploy mogelijk.

---

*Einde concept. Alle met [ ] gemarkeerde velden invullen; alle met "verifiëren"
gemarkeerde punten controleren; juridisch laten toetsen vóór gebruik.*
