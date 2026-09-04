# Statamic (statamic-tenant) — live-preview & /locatie-test ops

Twee problemen op de externe Statamic-CMS (`mister-chameleon-cms`, Ploi-gehost, met
git-push-back vanuit het CP), met per stuk: oorzaak, code-fix (indien van toepassing),
en de exacte live-CMS-checklist voor Jasper.

## A. Live-preview toont de homepage i.p.v. de bewerkte pagina

**Oorzaak = CMS-state, GÉÉN platform-regressie.** De batch #363–#369 heeft de
preview-/slug-resolutie niet aangeraakt (laatste wijziging aan
`app/(site)/mc-preview/page.tsx` + de draft-provider was #322). Het platform rendert
in draft-mode de **draft-blocks zelf** (`_draftPageBlocks`) — ongeacht de slug. De
`slug || "home"`-fallback slaat alleen aan als het CP-endpoint
`GET {statamicBaseUrl}/mc-live-preview-data?token=…` **geen/lege `slug`** teruggeeft;
dan haalt het platform de homepage-entry als metadata en zie je de homepage. Dat de
slug leeg terugkomt (en dat git-gemergde content is teruggedraaid) wijst op
**working-tree-drift op Ploi**: de git-push-back heeft de platform-managed `resources/`
(fieldsets) + content teruggezet, waardoor de addon die `mc-live-preview-data` serveert
uit sync is met de blueprint.

**Reset-checklist (Ploi, het `deploy.sh`-pad) — Jasper:**

```bash
# in de mister-chameleon-cms app-root op Ploi:
git checkout -- resources/      # gooi de gedrifte platform-managed fieldsets weg
php please mc:sync              # her-genereer de platform-blueprint/fieldsets uit het manifest
php please stache:refresh       # herbouw de Stache (content-index)
php please cache:clear          # leeg de app-cache
```

Herlaad daarna de Live Preview. De preview-target moet `/mc-live-preview` zijn
(refresh:true) — controleer in `resources/blueprints`/collection-config dat de
`preview_targets`-URL niet naar `/` (homepage) wijst.

## B. /locatie-test rendert het formulier niet + push-back draait content terug

### B1. Code-kant (platform) — GEFIXT
- **FormDefinition `locatie-test`** (postcode + huisnummer) staat geregistreerd (#363,
  `d38d9eab` in main).
- **Form-link → formKey.** Het `form_section`-blok resolvet het CP `form`-veld nu robuust
  naar de handle via `resolveFormHandle` (`cms/mappers/statamic/statamic-mappers.ts`):
  string, array (`["locatie-test"]`), én een augmented **Link-Item** (`{value|handle|id|slug}`),
  met legacy `form_key` als fallback. Zo matcht een **in het CP geauthorde** form-link op
  `getFormDefinition("locatie-test")` — niet alleen de flat-file `form: locatie-test`.
  (Vóór de fix las de mapper alleen `{handle}`, dus een `{value}`-Link-Item leverde geen
  handle → geen formulier.)
- **Snake_case ↔ kebab-case.** Statamic genereert handles in snake_case (`locatie_test`),
  terwijl de code-`FormDefinition`s kebab-case keys gebruiken (`locatie-test`). `resolveFormKey`
  (`forms/registry.ts`) normaliseert dit: exacte match → `_`↔`-`-swap → case-insensitief tegen
  de registry (geen fuzzy matching, dus geen valse hits). Toegepast in `FormSectionBlock`
  (render + de submit-URL via de canonieke key) én in `POST /api/forms/[formKey]`. Zo matcht
  een CP-form met handle `locatie_test` gewoon op `locatie-test` — niemand hoeft de handle te
  forceren.

### B2. Push-back-conflict — robuuste route: **auteur in het CP**
Het CP is de git-**schrijver** (push-back naar `main`). Een via git gemergde content-PR
(zoals cms#1) wordt daarom bij de volgende CP-push overschreven door de werkboom van het
CP — dat is waarom `6599328` uit `main` verdween. **De robuuste route is dus: maak de
content in het CP aan** (dan pusht het CP 'm zelf naar `main` en blijft hij staan). Git-
mergen van content naar `main` is hier het anti-patroon.

**Eenmalige CP-authoring — Jasper:**
1. **Forms → Create form**, handle **`locatie-test`** (of Statamic's snake_case `locatie_test` — beide matchen nu, zie B1) (titel bv. "Locatie-test").
   Velden mogen leeg blijven — de platform-`FormDefinition` levert postcode+huisnummer;
   het CP-form is alleen de relatie waar het blok naar wijst. Sla op.
2. **Collections → Pages → Create** (of open de bestaande) **Locatie-test**, slug
   `locatie-test`. Voeg een **Form Section**-blok toe en kies bij `form` de zojuist
   gemaakte form **locatie-test**. Zet als het kan `robots: noindex`. Publiceer.
3. Het CP pusht entry + form naar `main`; ze overleven nu de push-back.

**Structureel alternatief (optioneel, groter):** laat het CP push-back naar een aparte
branch (bv. `cms-content`) i.p.v. `main` (`config/statamic/git.php` → push-branch), en
merge die via PR naar `main`. Dan overschrijft de CP-push `main` niet en kunnen git-
merges en CP-content naast elkaar. Alleen doen als je git-gemergde CMS-content wilt
laten overleven; voor nu volstaat "auteur in het CP".

### B3. End-to-end-verificatie (na B2 + een Ploi-deploy)
1. Open `https://<statamic-tenant>/locatie-test` — het toont **postcode + huisnummer +
   submit** (de platform-`FormDefinition`, opgehaald op handle `locatie-test`).
2. Vul `3011AD` / `1` in en verzend → de platform-route `/api/forms/[formKey]` zet de
   **`mc_loc`-cookie** (via `formLocationFromValues` op de veld-keys postcode/huisnummer).
3. Herlaad de pagina (of ga naar een andere pagina) → de enrichment-pass draait op het
   form-postcode-pad: **CBS (buurt), BAG (per adres), netbeheer (PC6), EP-Online (label)**.
   Zichtbaar in de scenario/demo-readout of het `/demo`-debug (afhankelijk van welke keys
   op prod aanstaan: `BAG_API_KEY`, `NETBEHEER_ENERGY_ENABLED`, `EPONLINE_API_KEY`).
