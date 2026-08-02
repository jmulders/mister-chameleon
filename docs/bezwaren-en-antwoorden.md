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
| 2 | Self-serve vs. agency — je kiest self-serve op basis van niets | Route-keuze gemaakt: **agency-led**. AI-copy (feedce79) geparkeerd, niet uitgebreid. Adaptieve bevestiging (d1e937b1) is route-neutraal en live. | Opgelost |
| 3 | "Productierijp" is een overclaim | Rijpheidskaart met **falsifieerbaar criterium** (echte productiedata + tijd + faalsignaal); interne lens i.p.v. externe claim; observability als eerste reparatieregel. | Opgelost |

## Betrouwbaarheid en faalgedrag

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 4 | Wat gebeurt er als de beslissing faalt? | Per kanaal uitgewerkt: snippet/WP wisselen client-side, default staat in de HTML, onthullen na **700 ms**, afbreken na 1500 ms → traag/fout/weg eindigen allemaal op de veilige default. Voor server-render een harde timeout `withDecisionBudget` gebouwd. | Opgelost |
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
| 12a | Kun je per tenant uitrollen of gaat alles in één keer? | Eén platform → **atomaire deploy, iedereen tegelijk**. Mitigatie: staging/preview-check vóór promoten. | Gepareerd |
| 12b | Is er een schakelaar die één klant per direct terugzet op de standaard zonder deploy? | **Ja** — `rulesEnabled=false` → default plan, `revalidateTag` maakt het direct actief zonder deploy. UI-tekst aangescherpt tot expliciete nood-schakelaar. | Opgelost |
| 12c | Hoe lang duurt terugdraaien om 22.00 uur? | **Seconden** — Vercel Instant Rollback (onveranderlijke deploys, pointer-wissel). Per-klant-probleem: de kill-switch hierboven. | Gepareerd |

## Privacy en verrijking

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 13a | IP-verrijking is niet "onpersoonlijk"; IP = persoonsgegeven; geen cookies helpt ePrivacy niet AVG; server-side verandert niets | Onderbouwd in `docs/legal/grondslag-verrijking.md`. Kern: verrijking is bij ons **consent-gated** (firmografie alleen bij `enrichment`-toestemming) — strenger dan gerechtvaardigd belang, en precies het onderscheid t.o.v. de US-platformen. | Opgelost |
| 13b | Rol: verwerker vs. **gezamenlijke verantwoordelijkheid** bij verrijking | Expliciet benoemd in de DPB (art. 8). Beheersmaatregel: de klant zet verrijking **per tenant zelf aan** en kiest per bron → ondersteunt de verwerker-rol. Rest-risico juridisch te toetsen. | Opgelost (te toetsen) |
| 13c | Lever een DPB, subverwerkerslijst, waar staat de data, bewaartermijn, grondslag | Alle vier gemaakt in `docs/legal/`: DPB + subverwerkerslijst + grondslag/LIA. Data: EER (Vercel fra1 / Supabase EER — te bevestigen). Bewaartermijn: **90 dagen rollend**, auto-purge. | Opgelost (verificaties open) |
| 16b | Wat gebeurt er met persoonsgegevens na opzegging, binnen welke termijn? (verplichting) | In de DPB (Annex I): profielen verlopen **rollend na 90 dagen**; na opzegging verwijderd/geretourneerd binnen **[X] dagen** — getal moet jij zetten (advies 30). | Open (getal zetten) |

## Portabiliteit en diagnose

| # | Bezwaar | Antwoord / oplossing | Status |
|---|---|---|---|
| 16a | De opgebouwde waarde (varianten, regels, profielen, interessegeschiedenis) blijft bij jou = lock-in; een exportknop is ook een verkoopargument | **Exportknop gebouwd**: één JSON-download met regels/segmentatie, varianten en bezoekersprofielen (incl. interesses), volledig client-side. Zit in de rules-toolbar. | Opgelost |
| 14 | Filteren op scores diagnosticeert niets; je hebt de **verdeling van scores over echte sessies** nodig + per regel hoe vaak hij vuurde | Feasibility bepaald: de **scoreverdeling** is een goedkope read uit `visitor_profiles` (bouwbaar als paneel). **Regel-vuringen** worden nu nergens bewaard → vergen een schrijf op de hot path (async insert of dagelijkse rollup): ontwerpkeuze, geen "even aanzetten". | Open (keuze + bouw) |

---

## Nog open (keuze of meting bij Jasper)

- **Score-diagnostics** (#14): akkoord op het scoreverdeling-paneel (read-only, veilig) en de bewaarwijze voor regel-vuringen kiezen.
- **Twee-tenant + p95-meting** (#10): de outage-/vertragingstest die twee tenants tegelijk raakt en de p95-latentie + CPU-ms per beslissing vastlegt.
- **Bewaartermijn na opzegging** (#16b): het aantal dagen zetten in de DPB.
- **Juridische toetsing** (#13): de conceptdocumenten in `docs/legal/` langs een privacyjurist.
