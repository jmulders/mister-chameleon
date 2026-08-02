# Bezwaren en antwoorden

Overzicht van de bezwaarpunten die de meelezer heeft aangedragen, met per punt
hoe we het pareren of hebben opgelost. Bijgewerkt: 2 augustus 2026.

Legenda status: **Opgelost** = in code/documenten afgehandeld · **Gepareerd** =
antwoord staat, geen bouwwerk nodig · **Open** = keuze of meting bij Jasper.

---

## Product en positionering

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 1 | AI is op de *beslissing* gericht — te vroeg, geen moat | AI omgericht op het **schrijven van varianten**, niet op de keuze. `copy-generator` teruggedraaid; `variant-generator` (hero/proof/cta-copy) blijft. | Opgelost |
| 2 | Self-serve vs. agency — je kiest self-serve op basis van niets | AI-copy (feedce79) geparkeerd, niet uitgebreid; adaptieve bevestiging (d1e937b1) is route-neutraal en live. **Maar parkeren is geen routekeuze** — het criterium is de vraag die een koper terugstelt, en die gesprekken zijn er nog niet geweest. Als dit als "opgelost" staat, is de keuze alsnog aan het toetsenbord gemaakt. | **Open** |
| 3 | "Productierijp" is een overclaim | Rijpheidskaart met **falsifieerbaar criterium** (echte productiedata + tijd + faalsignaal); interne lens i.p.v. externe claim; observability als eerste reparatieregel. | Opgelost |

## Betrouwbaarheid en faalgedrag

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 4 | Wat gebeurt er als de beslissing faalt? | Per kanaal uitgewerkt: snippet/WP wisselen client-side, default staat in de HTML, onthullen na **700 ms**, afbreken na 1500 ms → traag/fout/weg eindigen allemaal op de veilige default. Voor server-render een harde timeout `withDecisionBudget` gebouwd. | Opgelost |
| 4b | **Waarneembaarheid ontbreekt** — faalgeval 4 (geldig-maar-fout), en het stille falen van formulieropslag, mailverzending en decide. Dit stond als reparatiepunt 1 bovenaan de rijpheidskaart. | **Nog niet opgelost.** #14 raakt de *diagnose* (scoreverdeling gebouwd, regel-vuringen open), maar het **faalsignaal** op opslag/mail/decide is een aparte laag die er nog niet is. Dit is de eerste ontbrekende categorie, niet cosmetica. | **Open** |
| 5 | "Server-side + geen flikkering" klopt niet op 2/3 kanalen | Positionering gecorrigeerd naar **"server-side beslissing, geen sprong, veilige default"**. | Opgelost |
| 6 | Onthul-timing te traag (1500 ms) | Teruggebracht naar **700 ms**, met min-height/CLS-afhandeling tegen springen. | Opgelost |
| 15 | Hoe makkelijk kan een klant stoppen zonder dat de site breekt? | **Stoppen = een storing**, en die eindigt veilig: snippet eruit of platform stil → de CMS-/redacteurscontent blijft staan (progressive enhancement met `data-mc-slot`). Geen lege blokken, niets terug te bouwen. | Gepareerd |

## Schaal, kosten en cache

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 7 | Decide-endpoint is een schaal- en kostenoppervlak; is een beslissing cachebaar? | **Rules-config-cache** gebouwd (leest DB-config van de hot path af, invalideate bij opslaan). De eindbeslissing bewust **niet** gecachet — dat zou de holdout/experiment-split breken. | Opgelost |
| 11 | Kostensom: Vercel meet ook **aanroepen + bandbreedte** apart; 2M aanroepen is een eigen factuurregel | Correctie erkend (ik had het mis). Exact tarief **$0,60/M** aanroepen; herrekend: CPU ~$0,41 + aanroepen ~$0,60–1,20 + geheugen/bandbreedte ~$0,30 = **~$1,50–2 per klant/maand** tegen €749 omzet. | Opgelost |
| 9 | Welk Vercel-plan? | **Pro (~€20/mnd)** bij eerste klant live; nu op Hobby blijven. | Gepareerd |
| 10 | **Gedeelde cache in multi-tenant = de ergste bug** (klant A ziet regels van klant B), stil, geen foutmelding; test moet twee tenants raken | Cache was al per tenant gesleuteld; **ownership-guard** toegevoegd: de cache draagt de eigen `key` mee en die wordt vóór teruggave gecontroleerd — mismatch → veilige `null` + luide log. Twee-tenant-test als bewijslast benoemd. | Opgelost |

## Blast radius en herstel

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 12a | Kun je per tenant uitrollen of gaat alles in één keer? | Eén platform → **atomaire deploy, iedereen tegelijk**. Staging/preview is normale hygiëne, **geen beheersmaatregel voor blast radius** — de echte demping zit in de kill-switch (12b) en instant rollback (12c). | Gepareerd |
| 12b | Is er een schakelaar die één klant per direct terugzet op de standaard zonder deploy? | **Ja** — `rulesEnabled=false` → default plan, `revalidateTag` maakt het direct actief zonder deploy. UI-tekst aangescherpt tot expliciete nood-schakelaar. | Opgelost |
| 12c | Hoe lang duurt terugdraaien om 22.00 uur? | **Seconden** — Vercel Instant Rollback (onveranderlijke deploys, pointer-wissel). Per-klant-probleem: de kill-switch hierboven. | Gepareerd |

## Privacy en verrijking

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 13a | IP-verrijking is niet "onpersoonlijk"; IP = persoonsgegeven; geen cookies helpt ePrivacy niet AVG; server-side verandert niets | Onderbouwd in `docs/legal/grondslag-verrijking.md`. Verrijking is **consent-gated** (firmografie alleen bij `enrichment`-toestemming). **Nuance:** toestemming is niet automatisch strenger dan gerechtvaardigd belang — het heeft eigen eisen, moet intrekbaar zijn mét verwijdering als gevolg, en het **IP wordt al vóór de toestemmingsvraag verwerkt**, wat óók een grondslag nodig heeft. Verdedigbaar, niet triviaal. | Opgelost (te toetsen) |
| 13b | Rol: verwerker vs. **gezamenlijke verantwoordelijkheid** bij verrijking | Expliciet benoemd in de DPB (art. 8). Beheersmaatregel: de klant zet verrijking **per tenant zelf aan** en kiest per bron → ondersteunt de verwerker-rol. Rest-risico juridisch te toetsen. | Opgelost (te toetsen) |
| 13c | Lever een DPB, subverwerkerslijst, waar staat de data, bewaartermijn, grondslag | Alle vier gemaakt in `docs/legal/`. Bewaartermijn: **90 dagen rollend**, auto-purge. Data staat in de **EER — Supabase West-Europa (Ierland, eu-west-1)**, bevestigd. | Opgelost |
| 16b | Wat gebeurt er met persoonsgegevens na opzegging, binnen welke termijn? (verplichting) | **Gebouwd:** default **30 dagen**, per tenant instelbaar met een startdatum (Tenant → Settings → "Data retention after termination"); DPB verwijst ernaar. Profielen verlopen sowieso rollend na 90 dagen. | Opgelost |

## Portabiliteit en diagnose

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 16a | De opgebouwde waarde (varianten, regels, profielen, interessegeschiedenis) blijft bij jou = lock-in; een exportknop is ook een verkoopargument | **Exportknop gebouwd**: één JSON-download met regels/segmentatie, varianten en bezoekersprofielen (incl. interesses), volledig client-side. Zit in de rules-toolbar. | Opgelost |
| 14 | Filteren op scores diagnosticeert niets; je hebt de **verdeling van scores over echte sessies** nodig + per regel hoe vaak hij vuurde | **Scoreverdeling-paneel gebouwd** (per as over echte sessies, met flag als een as niet discrimineert of bijna geen signaal heeft). **Regel-vuringen** nog open: die worden nergens bewaard → vergen een schrijf op de hot path (async insert of dagelijkse rollup), een ontwerpkeuze. | Deels (paneel klaar, vuringen open) |

---

## Nog open — met de reden waarom

- **Routekeuze self-serve vs. agency (#2) — het zwaarste punt.** Open omdat het criterium een *koper* is, niet een commit. Parkeren van feedce79 is geen keuze; die valt pas als een klant de vraag terugstelt. Kan niet aan het toetsenbord opgelost worden — vereist het eerste gesprek (Olyslager).
- **Waarneembaarheid / faalsignaal (#4b) — reparatiepunt 1.** Open omdat er nog geen laag is die het stille falen van formulieropslag, mailverzending en decide zichtbaar maakt. De diagnose-kant (scoreverdeling) staat; het faalsignaal is een aparte bouw.
- **Regel-vuringen (#14, tweede helft).** Open omdat tellen een schrijf op de hot path vraagt (async insert of dagelijkse rollup) — een ontwerpkeuze met een kostenkant, geen "even aanzetten". Wacht op jouw keuze van de bewaarwijze.
- **Productie-p95 op echt verkeer (#10).** De *compute*-p95 is gemeten (0,086 ms, `npm run bench:decide`, 0 lekken). Open blijft de p95 mét netwerk op de live site — dat kan alleen op echt verkeer.
- **Juridische toetsing (#13).** Open omdat de conceptdocumenten in `docs/legal/` per definitie langs een privacyjurist moeten vóór gebruik.
