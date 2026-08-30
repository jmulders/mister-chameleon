# Ontwerp — Config-health + context-intelligence

Status: **backlog / ontwerp** (nog niet gebouwd). Opgesteld 29 aug 2026.

## Kader

Kan AI helpen de contexten/regels te categoriseren en overzicht te scheppen? Ja — maar
alleen op de **juiste plek**: offline, over je eigen configuratie en aggregatiepanelen,
op geaggregeerde data. Geen bezoekersdata, geen latency, geen privacyvraag, niet in het
hete pad. Consistent met hoe AI in dit platform wordt gehouden (uit de beslissing, op
afroep, kostenbewust).

**Harde scheiding — het kernprincipe van dit ontwerp:**
- **Logica waar het kan** (deterministisch, exacte controle).
- **AI waar het over betekenis gaat** (clusteren, in gewone taal uitleggen).

Splits daarom in twee sporen met verschillende timing.

---

## Spoor 1 — Config-health / linter (near-term, deterministisch)

**Waarom nu al, ook met weinig contexten:** dit soort config-fouten heeft het platform al
gebeten. `validateStoredConfig` verwerpt de héle config bij een dubbele priority (eerder de
oorzaak van een demo die niet personaliseerde), en first-match-by-priority laat een
lager-geprioriteerde regel stil onbereikbaar. Een linter die dat zichtbaar maakt, bespaart
direct fouten — geen schaal nodig.

**Wat het detecteert (deterministisch):**
- **Priority-conflicten / dubbele priorities** (voordat `validateStoredConfig` de hele
  config afkeurt — waarschuw vroeg + gericht).
- **Onbereikbare / geschaduwde regels:** een regel wiens conditie altijd al door een
  hoger-geprioriteerde first-match wordt afgevangen.
- **Condities die nooit waar kunnen worden** (tegenstrijdige/lege value-sets, veld dat niet
  bestaat in de FIELD_REGISTRY).
- **Dode varianten:** variantkeys waar geen enkele regel meer naar wijst.
- **Nooit-vurende regels:** koppel aan de rule-fire-statistiek (`rule_fire_daily`) — "deze
  regel vuurde 30 dagen niet" = kandidaat-dood.

**Bouwstenen die er al zijn:** `validateStoredConfig`, `rule_fire_daily` (rule-fire-store),
de FIELD_REGISTRY (voor veld/condition-validatie), de bestaande rules-editor (om de
bevindingen inline te tonen).

**Vorm:** een "config-health"-paneel bij de rules-editor + een pure analyzer-functie
(unit-testbaar, geen AI, geen DB in het hete pad). Exacte controle, geen taalmodel.

---

## Spoor 2 — Context-intelligence (roadmap, AI)

**Waarom later:** met drie contexten per klant heb je overzicht, geen clustering nodig. Dit
wordt pas echt bij **tientallen contexten**, of bij **cross-tenant**-analyse.

**Wat AI hier goed doet (de vage kant):**
- **Contexten clusteren** die in de praktijk hetzelfde publiek beschrijven.
- **Reduceren:** een set van negen terugbrengen tot vier die het grootste deel van het
  verkeer dekt (leun op de rule-fire-/traffic-aandelen).
- **Gewone-taal-uitleg** — het nuttigst: een klant die naar een regelconfiguratie kijkt
  ziet *condities*, maar wil lezen *wie* er op z'n site komt. AI vat de contexten samen in
  mensentaal, klaar voor een kwartaalgesprek.
- **Cross-tenant patronen** (strategisch het interessantst): welke contexten keren terug
  over klanten heen → maakt de **bibliotheek** sterker (sluit aan op de
  "bibliotheek-als-distributie"-route in de backlog).

**Randvoorwaarden:** offline (batch, geen request-pad), geaggregeerd (geen PII), op afroep,
kostenbewust (haakt op de bestaande credit-metering, één call per keer). Adviseert; beslist
niet.

**Wat je hier NIET met AI doet:** overlappende condities, onbereikbare regels, dode
varianten, volgorde die stil beslist — dat is spoor 1 (deterministisch). Een exacte controle
is beter dan een taalmodel dat het meestal goed heeft.

## Fasering
1. **Spoor 1 (config-health/linter)** — near-term, klein, direct nuttig, geen AI.
2. **Spoor 2 (context-intelligence)** — roadmap, als contexten schalen of bij cross-tenant.
