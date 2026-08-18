# Spec: custom-attributen (generieke domein-attributen in condities)

Status: ontwerp. Aparte branch `feat/custom-attributes-spec`. Nog niet gebouwd.

## 1. Uitgangspunt en motivatie

Tenants hebben domein-attributen die een regel wil kunnen matchen, maar die
tenant-specifiek zijn en dus niet thuishoren in de gedeelde `FIELD_REGISTRY`
(de vaste veld-allowlist). Voorbeeld Cluistra: `massa` (kg), `categorie`
(kipper/transporter/...), `occasion` (true/false) van het model op de pagina.

Het patroon is bewust gelijk aan de context-writes/flags: een generieke map op
de context plus een generieke conditie die die map leest. Het is bewust NIET het
patroon van de benoemde velden (elk veld een key in `RuleFieldKey` +
`FIELD_REGISTRY` + resolver). Zo kan een tenant attributen declareren en
gebruiken zonder codewijziging aan de gedeelde registry.

### Belangrijk verschil met `ruleContext` (flags)

`ruleContext` (gelezen door een `FlagCondition`) is een STICKY overlay: door
regels geschreven, gepersisteerd in `visitor_behavior_state.rule_context`,
monotoon, sessie-breed. Zie `docs/rule-context-writes-spec.md`.

`customAttributes` is het tegenovergestelde qua herkomst:

- Per request, EPHEMEER. Beschrijft wat er nu op de pagina staat (de massa van
  het getoonde model), niet iets dat de bezoeker heeft opgebouwd.
- READ-ONLY voor de engine. Regels schrijven ze niet. Er is geen `setContext`
  voor attributen, geen persistentie, geen sticky/monotone semantiek.
- Aangeleverd door de pagina (snippet-payload of platform-page-props), net zoals
  `path`, `referrer` of `utm_source`.

Kort: `ruleContext` is een GESCHREVEN overlay, `customAttributes` is een INPUT
(zoals de request zelf). De conditie-mechaniek is identiek aan `FlagCondition`;
alleen de bron van de map verschilt.

## 2. Datamodel: het contextveld

Nieuw veld op `RuleEvaluationContext` (`decision/rules/field-registry.ts`, naast
`ruleContext` op regel 194):

```ts
/**
 * Per-request domein-attributen die de pagina aanlevert (snippet-payload of
 * platform-page-props). Read-only input, geen sticky overlay: rules schrijven
 * hier niet, niets wordt gepersisteerd. Gelezen door een AttributeCondition.
 * Alleen door de tenant gedeclareerde namen worden server-side toegelaten.
 */
customAttributes?: Record<string, string | number | boolean> | null;
```

Geen migratie: dit veld leeft alleen op de in-memory context, niet in de DB.

## 3. Snippet: verzamelen en meesturen

De snippet (`lib/snippet/snippet-source.ts`) verzamelt attributen van de huidige
pagina en stuurt ze mee in de decide-payload als `context.customAttributes`.

Bronnen (samengevoegd, latere wint), MVP:

1. `data-mc-attr-<naam>="<waarde>"` op elk element in de DOM. Eerste voorkomen
   per naam wint. `<naam>` is de attribuutnaam, `<waarde>` de string-waarde.
2. `window.mcAttributes` (een plat object `{ naam: waarde }`), zodat een tenant
   het ook via de dataLayer/JS kan zetten.

Saneren en limiteren in de snippet (client is nooit te vertrouwen, maar we
beperken de payload al aan de bron):

- Max 24 attributen (overschot wordt genegeerd).
- Naam: lowercased, `[a-z0-9_-]`, lengte 1..40. Anders overslaan.
- Waarde: string, of numerieke string wordt getild naar number, `"true"/"false"`
  naar boolean. String-lengte gekapt op 128.

Toekomst (niet in MVP): een tenant-config selector-naar-attribuut-map, analoog
aan `selectorMap`. Dat vergt dat de snippet zijn config eerst ophaalt (de huidige
`selectorMap` komt in de decide-RESPONSE en kan de REQUEST dus niet voeden). Voor
nu volstaan `data-mc-attr-*` en `window.mcAttributes`.

## 4. Server-ingname en veiligheid

Zowel het snippet-pad als de platform-pagina bouwen de context via
`buildDecisionContext` (`decision/context/build-decision-context.ts`).

1. Nieuw param `customAttributes?: Record<string, string|number|boolean>` op
   `BuildDecisionContextParams` (regel 110), gezet op de teruggegeven context bij
   het slot-object rond regel 1278 (naast `ruleContext`).
2. Decide-route (`app/api/snippet/decide/route.ts`): `customAttributes` toevoegen
   aan het `DecideRequest.context`-type; server-side opnieuw saneren (nooit de
   client vertrouwen).
3. FILTEREN tegen de tenant-declaratie (zie sectie 5): alleen gedeclareerde namen
   worden behouden; elke waarde wordt naar het gedeclareerde type gecoerced en
   tegen `allowedValues` gevalideerd. Onbekende namen en ongeldige waarden worden
   weggegooid.
4. Platform-pagina's (`lib/pipeline/homepage-pipeline.ts`, regel 556) kunnen
   attributen uit page-props aanleveren (bv. een modelpagina geeft
   `{ massa, categorie, occasion }`); dezelfde filter geldt.

Doordat alleen GEDECLAREERDE attributen worden gehonoreerd, blijft de
editor-lijst gezaghebbend en kan een pagina geen willekeurige, regel-beinvloedende
keys injecteren.

## 5. Tenant-declaratie (admin-config)

Nieuw op `TenantSettings` (`tenant/types.ts`), opgeslagen in
`tenant_settings.settings` (jsonb, geen migratie):

```ts
export interface CustomAttributeDeclaration {
  /** Attribuutnaam, lowercased [a-z0-9_-]. Matcht context.customAttributes[name]. */
  name:           string;
  type:           "string" | "number" | "boolean";
  label?:         string;          // English admin-UI label
  description?:   string;
  /** Optioneel: toegestane waarden (voor string/number). Voedt de editor-dropdown. */
  allowedValues?: (string | number)[];
}

// op TenantSettings:
customAttributes?: CustomAttributeDeclaration[];
```

Admin-UI (Engels): een sectie "Custom attributes" (onder Snippet of onder
Personalization) waar de tenant attributen toevoegt/bewerkt: naam, type,
optionele allowedValues, label, description. De rule-editor toont deze lijst en
valideert waarden ertegen.

## 6. Conditie-type: `AttributeCondition`

Nieuw node-type in `decision/rules/stored-rule.ts`, gemodelleerd naar
`FlagCondition` (regel 300):

```ts
/**
 * Leest een per-request domein-attribuut uit ctx.customAttributes[name].
 * Gemodelleerd naar FlagCondition; verschilt alleen in de gelezen map.
 * Attribuutnamen zijn tenant-gedeclareerd (sectie 5), niet vrij zoals flags.
 */
export interface AttributeCondition {
  type:      "attribute";
  name:      string;
  operator?: FieldOperator;            // default "equals", ook exists/not_exists
  value?:    string | number | boolean;
}
```

- Toevoegen aan de `RuleCondition` union (regel 317).
- Runtime: `evalAttributeCondition(condition, ctx)` leest
  `ctx.customAttributes?.[name]` en hergebruikt `applyOperator` (byte-voor-byte
  gelijk aan `evalFlagCondition`, alleen de map verschilt). Dispatch-regel in
  `evalNode` naast de `"flag"`-case (rond regel 1343).
- Validatie: `validateAttributeCondition` gemodelleerd naar
  `validateFlagCondition` (regel 1066): niet-lege naam, geldige operator, geen
  array-operators (scalar), waarde-type per operator. Plus, wanneer de
  tenant-declaratie aan de validator wordt meegegeven (optioneel extra argument
  van `validateStoredConfig`, net als `extraKeys`): naam moet gedeclareerd zijn en
  de waarde moet bij het gedeclareerde type en `allowedValues` passen. Zonder
  declaratie valt het terug op alleen de vormcheck.
- `formatCondition`: `attr <name> <op> <value>` (naast de flag-tak, regel 1711).

## 7. Editor

`app/dashboard/rules/_components/RulesEditor.tsx`:

- Nieuwe component `AttributeConditionEditor` (kopie van `FlagConditionEditor`,
  regel 1948), maar de naam is een `<select>` uit de tenant-gedeclareerde
  attributen in plaats van een vrij tekstveld met datalist. Operator: dezelfde
  `<select>` over `FLAG_OPERATORS`. Waarde: `ScalarValueInput`, beperkt tot het
  gedeclareerde type en `allowedValues` waar aanwezig.
- `attributeCatalogue: CustomAttributeDeclaration[]` als nieuwe prop op
  `RulesEditorProps` (regel 396), doorgegeven vanaf de admin-pagina
  (`app/admin/tenants/[tenantId]/personalization/rules/page.tsx`, rond regel 96)
  naar `RuleCard` -> `FlatGroupEditor` -> `ConditionRow` -> `AttributeConditionEditor`.
  Alternatief: opvouwen in `VariantCatalogue` (het bestaande tenant-datakanaal).
- Type-picker (regel 1831) krijgt een optie "Attribute condition", alleen
  zichtbaar als de tenant >= 1 attribuut declareert. `handleTypeChange` (regel
  1802) maakt een blanco `{ type: "attribute", name: <eerste gedeclareerde>,
  operator: "equals", value: <default per type> }`.
- `EditorLeaf` union (regel 120) en de child-filter in `toEditorGroup` (regel 162)
  krijgen `attribute` erbij. Non-field leaves openen automatisch het
  Advanced-paneel (`conditionHasNonFieldLeaf`, regel 1071), dus dat werkt gratis.

De editor toont dus de tenant-gedeclareerde attributen (uit de tenant-config),
niet de globale registry.

## 8. Demo

- `ScenarioOverrides` (`components/scenario/scenario-store.ts`, regel 60) krijgt
  `customAttributes?: Record<string, string | number | boolean>`.
- `applyScenarioToDecisionContext` (`lib/scenario/server-scenario.ts`, rond regel
  402) merged deze op `ctx.customAttributes`, zodat een scenario massa/categorie/
  occasion kan flippen op het echte regelpad.
- `DemoStageSection` / `DemoContext` kan `customAttributes` zetten (het bestaande
  `overrides?: ScenarioOverrides` op `DemoContext` draagt dit al).

Let op: de snippet forced-plan bypass (`_demoMode=mirror`) slaat de regels over,
dus een attribuut-gedreven regel demo je op het ECHTE regelpad: het
scenario-paneel op de platform-pagina, of een niet-bypass snippet-modus. De
context-switcher (bypass) en attribuut-condities zijn dus verschillende assen.

## 9. Raakvlakken met bestaande flag/context-writes-code

- Spiegelt `FlagCondition` end-to-end (interface, union, validate, eval, format).
  De attribuut-matcher is identiek aan de flag-matcher, op de gelezen map na
  (`ctx.customAttributes` i.p.v. `ctx.ruleContext`).
- Hergebruikt `applyOperator`, `FIELD_OPERATORS`, `FLAG_OPERATORS`,
  `ScalarValueInput`, `NUMERIC_OPERATORS`/`STRING_ONLY_OPERATORS`/
  `NO_VALUE_OPERATORS`/`ARRAY_VALUE_OPERATORS`.
- Verschil met context-writes: attributen zijn read-only en per-request. Geen
  `setContext` die attributen schrijft, geen `visitor_behavior_state`-persistentie,
  geen sticky/monotone laag. Ze zijn een INPUT-map, ruleContext is een GESCHREVEN
  overlay.

## 10. Non-goals / toekomst

- Selector-naar-attribuut-map in de snippet (vergt een config-round-trip). Later.
- Attribuut-historie/persistentie. Expliciet buiten scope.
- Attributen als variant-keys of in content. Buiten scope; dit gaat puur over
  condities.

## 11. Bouwvolgorde (commit per stap, typecheck + eslint per stap)

1. Types: `AttributeCondition` + `RuleEvaluationContext.customAttributes` +
   `CustomAttributeDeclaration` + `ScenarioOverrides.customAttributes`
   (alleen typecheck).
2. Engine: `evalAttributeCondition` + dispatch + `validateAttributeCondition` +
   `formatCondition`-tak + union (unit tests, gemodelleerd naar de flag-tests).
3. Context-build: `BuildDecisionContextParams.customAttributes` + zetten op de
   context; server-side sanitize-helper (naam/type/lengte).
4. Decide-route + snippet-verzameling + transport + server-filter tegen de
   tenant-declaratie.
5. Tenant-declaratie: settings-type + admin-UI "Custom attributes" (Engels).
6. Editor: `AttributeConditionEditor` + `attributeCatalogue`-plumbing +
   type-picker-optie.
7. Demo: scenario-override + apply + `DemoStageSection`-control.
8. Cluistra: `massa`/`categorie`/`occasion` declareren + een demo-regel +
   deze spec bijwerken naar "gebouwd".

Elke stap is los te mergen: t/m stap 4 is het mechanisme functioneel via de API
(te testen met curl); stap 5-6 maken het bruikbaar in de admin; stap 7-8 maken
het demonstreerbaar.
