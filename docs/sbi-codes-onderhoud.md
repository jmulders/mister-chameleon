# SBI-codes onderhoud (industrie-lookup)

## Wat
`data/sbi-2025.json` mapt KvK SBI-codes → industrie-naam (NL + EN). Gebruikt om uit
Leadinfo's `leadinfoBranchCode` een leesbare industrie af te leiden (webhook-velden
companyIndustryNl / companyIndustryEn).

## Bron
KvK Standaard Bedrijfsindeling (SBI):
https://www.kvk.nl/over-het-handelsregister/overzicht-standaard-bedrijfsindeling-sbi-codes-voor-activiteiten/
Huidige versie: SBI 2025 (update 2026). Laatst bijgewerkt: 2026-08-27.

## Wanneer bijwerken
KvK publiceert ~jaarlijks een nieuwe SBI-versie. Bijwerken zodra er een nieuwe Excel op
de KvK-pagina staat. Achterlopen is niet kritiek: onbekende codes → geen industrie-tekst
(null), de rauwe SBI-code komt altijd mee in de webhook.

## Stappen bij een update
1. Download de nieuwste SBI-Excel van de KvK-pagina (kolommen: SBI-code, Titel NL,
   Titles EN).
2. Draai: `node scripts/regen-sbi <pad-naar-excel>` → schrijft data/sbi-2025.json.
3. Controleer de diff — spot-check bv. 73110 → "Activiteiten van reclamebureaus" /
   "Activities of advertising agencies".
4. Werk versie + datum bij in de header van dit doc (het databestand is een platte
   `{ "<code>": {nl,en} }`-map zonder header; versie/datum staan hier).
5. Commit + PR (geen migratie, pure datawijziging).

## Notities
- Match op de SBI-code (`leadinfoBranchCode`, bv. "73110"), NIET op SIC-87 (7311 is een
  ander, Amerikaans systeem en staat niet in deze tabel).
- Codes zijn strings met leading zeros ("0001").
- Onbekende code → null (geen crash).
