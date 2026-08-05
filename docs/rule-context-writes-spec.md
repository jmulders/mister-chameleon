# Spec — regels die context schrijven (context-writes + override-laag)

Doel: een regel kan, naast een variant kiezen, ook **contextvariabelen zetten**.
Die kunnen nieuw zijn (eigen vlaggen zoals `gericht-binnengekomen`) of een
**bestaande afgeleide variabele overschrijven** (bijv. `funnelStage`). Een schrijf
kan **sticky** zijn (blijft de sessie staan) zodat een latere paginaweergave/regel
hem leest.

Dit is de ontbrekende primitief onder het twee-regel-ontwerp voor "hoge intentie
bij binnenkomst" (AI-verkeer detecteren via gedrag i.p.v. kanaal).

---

## 1. Uitgangspunt (huidige engine)

- `RulesDecisionProvider.evaluateRules()` — **single-pass, first-match-by-priority**,
  geeft één `StoredPlan` terug en stopt (`decision/providers/rules-decision-provider.ts`).
- Condities matchen tegen `RuleEvaluationContext` via een **vaste allowlist** van
  velden met resolvers (`decision/rules/field-registry.ts`, `FIELD_REGISTRY`).
- Een plan draagt alleen variant-keys + presentatie-flags (`StoredPlan` in
  `decision/rules/stored-rule.ts`). Geen "zet context"-effect.
- Sessie-persistentie bestaat al: `visitor_behavior_state` (JourneyState) met
  monotone vlaggen `hasVisitedPricing/Cases/Contact`. Context zelf wordt élke
  request opnieuw afgeleid; niets schrijft regel-output terug de context in.

Kern-inzicht: het twee-regel-ontwerp is **cross-paginaweergave** (regel 1 op
weergave 1 zet een vlag, regel 2 op weergave 2 leest hem). Daarom is de eenvoudige,
robuuste oplossing **persisteren en de volgende request lezen**, niet multi-pass.
Voor gebruik binnen dezelfde request voegen we een lichte 2-fasen-evaluatie toe.

---

## 2. Datamodel (migratie)

Nieuwe kolom op `visitor_behavior_state`, per sessie:

```sql
ALTER TABLE public.visitor_behavior_state
  ADD COLUMN IF NOT EXISTS rule_context jsonb NOT NULL DEFAULT '{}'::jsonb;
```

`rule_context` = `{ "<key>": <string|number|boolean>, ... }`. Bevat zowel eigen
vlaggen als overrides van afgeleide velden. Alleen **sticky** schrijfacties landen
hier; niet-sticky schrijfacties leven alleen binnen de request.

Migratie draaien op dev (`xqaeqbqjymeyxbvmhseg`) en prod (`kdhfpvjeriszteqhpgll`).
Idempotent; fail-open lezen (ontbrekende kolom → `{}`).

---

## 3. Types

`decision/rules/stored-rule.ts`

```ts
export interface RuleContextWrite {
  key:    string;                         // vlagnaam of registry-veldkey (override)
  value:  string | number | boolean;
  sticky?: boolean;                       // default true — blijft de sessie staan
}
```

Uitbreiding `StoredPlan`:

```ts
setContext?: RuleContextWrite[];          // optioneel effect naast variantkeuze
```

Nieuwe conditie-node (naast Field/Named/Context/ContextLibrary/Group):

```ts
export interface FlagCondition {
  type:      "flag";
  name:      string;                      // leest ctx.ruleContext[name]
  operator?: FieldOperator;               // default "equals"; ook exists/not_exists
  value?:    string | number | boolean;
}
export type RuleCondition =
  | FieldCondition | NamedCondition | ContextCondition
  | ContextLibraryCondition | FlagCondition | GroupCondition;
```

Uitbreiding `RuleEvaluationContext` (`field-registry.ts`):

```ts
ruleContext?: Record<string, string | number | boolean> | null;  // overlay
entryPath?:   string | null;             // landingspagina (sticky, 1e weergave)
isBot?:       boolean | null;            // crawler/bot-detectie
```

Runtime `ExperiencePlan` (`decision/types.ts`) krijgt hetzelfde `setContext?`-veld,
zodat het effect door de compose-laag reist.

---

## 4. Override-laag (afgeleide vars overschrijven)

`rule_context` wordt als **overlay** over de afgeleide context gelegd, ná de
afleiding en vóór de regel-evaluatie. Twee leesroutes:

1. **Eigen vlaggen** → gelezen door `FlagCondition` uit `ctx.ruleContext`.
2. **Registry-velden** (bijv. `funnelStage`, `intentScore`) → de resolver in
   `FIELD_REGISTRY` checkt eerst `ctx.ruleContext[fieldKey]`; staat daar een
   override, dan wint die, anders de normale afleiding.

Regels: overrides zijn **niet-recursief** (een override triggert geen her-afleiding)
en worden bewust gemarkeerd in de admin als "geavanceerd", omdat ze de afleidings-
logica omzeilen. Type-veiligheid: override-waarde wordt gevalideerd tegen de `kind`
en `allowedValues` van dat registry-veld (net als een FieldCondition-waarde).

---

## 5. Evaluatie (2-fasen)

`RulesDecisionProvider.evaluateRules(ctx)`:

1. **Laad** persisted `rule_context` (uit JourneyState) → `ctx.ruleContext`.
2. **Fase A — schrijven.** Loop regels in prioriteitsvolgorde; voor elke regel die
   matcht én een `setContext` heeft: pas de writes toe op `ctx.ruleContext`
   (overlay muteert direct, zodat latere regels in dezelfde pass ze zien). Markeer
   sticky writes voor persistentie. Deze regels **stoppen de evaluatie niet**.
3. **Fase B — kiezen.** Normale first-match-by-priority voor de variantkeuze over
   de bijgewerkte `ctx`. Eerste match → plan, stop.
4. **Persisteer** de verzamelde sticky writes na de response (fire-and-forget) naar
   `visitor_behavior_state.rule_context` (merge, monotoon waar gevraagd).

Een regel mag zowel `setContext` als een variant-plan hebben. Een pure
"tag-only"-regel heeft `setContext` en geen betekenisvolle variant (kiest de
default) — precies wat de meet-eerst-stap nodig heeft.

Prioriteit: context-schrijvende regels staan doorgaans hoog (vroeg), variant-regels
eronder, alles onder de campagneregels.

---

## 6. Nieuwe leesvelden + bot-uitsluiting

`field-registry.ts` + context-builder (`decision/context/build-decision-context.ts`):

- `entryPath` — landingspagina. Op de 1e weergave = `pathname`; wordt sticky
  weggeschreven (`rule_context.__entryPath`) zodat latere weergaven "kwam binnen op
  een dieptepagina" kunnen lezen. (Alternatief voor een aparte kolom.)
- `isBot` — crawler/bot. UA-heuristiek + `enrichment.isCloudProvider` als proxy.
- `hasCampaignParam` — boolean uit de utm-velden (of blijf `utmCampaign not_exists`
  gebruiken; expliciet veld is leesbaarder in de editor).

Bot-uitsluiting: bots worden uitgesloten van variant-serving én van de
scoreverdeling/regel-vuring-metingen (anders vervuilen ze meting en verdeling).

---

## 7. Admin-UI

`app/dashboard/rules/_components/RulesEditor.tsx`:

- Conditie-editor: `FlagCondition` als nieuw conditietype (naam + operator + waarde).
  Nieuwe registry-velden (`entryPath`, `isBot`, `hasCampaignParam`) verschijnen
  automatisch in de veldkiezer.
- Plan-editor: nieuwe sectie **"Context zetten"** — rijen van (key, waarde, sticky).
  Key-kiezer toont eigen-vlag-invoer én een lijst van override-bare registry-velden,
  met een waarschuwingslabel bij overrides.
- Validatie: `validatePlan()` valideert `setContext`; `validateFieldCondition`-broer
  valideert `FlagCondition`.

---

## 8. De twee regels in dit model

**Regel 1 — bij binnenkomst.** Prioriteit onder campagneregels. Tag-only.

```
ALS  entryPath != "/"                     (of pathname != "/" op 1e weergave)
EN   utmCampaign not_exists
EN   channelGroup in ["organic-search","direct"]
EN   isBot = false
DAN  setContext: gericht_binnengekomen = true (sticky)
```

**Regel 2 — tijdens de sessie.** Hogere prioriteit dan regel 1's variant-effect.

```
ALS  flag gericht_binnengekomen = true
EN   pageViewCount = 2
EN   contentInterestCategory in ["pricing","cases","contact"]  (beslispagina)
EN   isBot = false
DAN  variant proof = "bewijs-eerst", cta = "aanbod-eerst"
     (optioneel setContext: hoge_intentie = true, sticky)
```

Blokken: hangt aan **proof + cta** (dieptepagina's hebben meestal geen hero). Het
echte werk is zorgen dát die blokken op die pagina's staan.

---

## 9. Uitrol (meet-eerst)

1. Migratie dev + prod.
2. Regel 1 als **tag-only** live, geen variant. Teller op `gericht_binnengekomen`.
3. Enkele weken meten hoeveel sessies invallen. Te weinig → stop, niet bouwen.
4. Voldoende → varianten "bewijs-eerst"/"aanbod-eerst" schrijven en regel 2 aanzetten.

---

## 10. Bouwvolgorde (commits)

1. Migratie + `rule_context` lezen/schrijven (JourneyState-laag).
2. Types: `RuleContextWrite`, `StoredPlan.setContext`, `FlagCondition`,
   `RuleEvaluationContext.ruleContext/entryPath/isBot`, `ExperiencePlan.setContext`.
3. Field-registry: overlay-aware resolvers + nieuwe leesvelden + FlagCondition-matcher
   + validatie.
4. Context-builder: entryPath (sticky), isBot, overlay laden.
5. Engine: 2-fasen-evaluatie + sticky-persistentie.
6. Admin-UI: FlagCondition + "Context zetten"-sectie + validatie.
7. Bot-uitsluiting in meting/scoreverdeling.
8. Tests + typecheck + eslint.
```
