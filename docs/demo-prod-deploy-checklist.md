# Demo live zetten op prod (statamic-tenant) — afvinklijst

Drie sporen: database, CMS-content, app-code. Alle drie moeten er staan.

## 1. Database (prod) — GEDAAN

De rol-regels + segmenten zijn op prod gezet via `docs/demo-prod-statamic.sql`.
Verificatie gaf de drie regels met prioriteit 0/1/2. Niets meer te doen hier.

Als je het ooit opnieuw moet doen: draai `docs/demo-prod-statamic.sql` op de
prod-database (Supabase project `kdhfpvjeriszteqhpgll`).

## 2. CMS-content (mister-chameleon-cms → Laravel Cloud)

Hier zit de rol-copy én alle aangevulde fallback-varianten. Zonder dit krijgt prod
de "missing fallback → statische noodervaring" en wisselt de hero niet.

```bash
cd <pad>/mister-chameleon-cms-app        # de Statamic-repo (origin: mister-chameleon-cms)
git status                               # check: 4 commits ahead of origin/main, niets uncommitted
git push origin main
```

Deploy: de CMS draait op Laravel Cloud (`STATAMIC_API_URL=...laravel.cloud`). Die
deployt doorgaans automatisch op een push naar de gekoppelde branch. Zo niet: trigger
de deploy in het Laravel Cloud-dashboard. Controleer daarna dat `home.md` live is
(de nieuwe proof/hero/cta-keys moeten via de API terugkomen).

De 4 commits die mee moeten:
- rol-copy per rol (hero/cta) + ontbrekende keys hero_consideration, cta_guide, cta_platform
- rol-copy aanspreekvorm je/jij
- proof_platform (eerste ontbrekende fallback)
- alle overige platform-default fallbacks (proof_cases/vision/reassurance, hero_intent_direct/customer_onboarding, cta_onboarding/expansion)

## 3. App-code (mister-chameleon → Vercel)

De kern van de demo staat al op `origin/main` (switcher + panelen, presets,
bypass-gating). Nog niet op main staan 3 commits op je branch
`fix/statamic-form-slot-fieldset`:
- rol-highlight volgt de scenario-state (blijft kloppen na tijdschuif)
- inklapbare demo-chrome (× klapt in, 🎭 Demo-handle klapt uit) + `demo-ui-store.ts`
- de prod-SQL doc (alleen documentatie)

```bash
cd <pad>/mister-chameleon
git push origin fix/statamic-form-slot-fieldset
```

Merge die branch daarna naar `main` via je normale PR-flow (let op: op deze branch
staat ook los form-slot-werk — check de diff voor je merget). Vercel deployt op merge
naar main.

Puur voor de demo-werking is dit spoor optioneel: de rolwissel zelf werkt met wat al
op main staat. Deze 3 commits voegen alleen de inklap-knop en de nettere highlight toe.

## 4. Na de deploy — controle

1. Open de prod-site als de statamic-tenant met de scenario-modus aan
   (`?scenario=true`, of zet `NEXT_PUBLIC_SHOW_SCENARIO_PANEL=1` in de prod-env).
2. Wissel tussen Marketer / Agency owner / Technical lead — de hero moet meebewegen.
3. Check de logs: geen "static emergency experience" en geen "applying fallback plan".
   Zie je die wel, dan mist er een variant in de live-CMS (spoor 2 nog niet af).
