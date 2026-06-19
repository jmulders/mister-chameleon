# Runbook — Statamic CP werkend maken via database (Laravel Cloud)

**Doel:** de klant kan content beheren via het Control Panel (CP) op Laravel Cloud,
met wijzigingen die blijven bewaard. Dit lukt alleen als content in een **database**
staat i.p.v. platte bestanden (Laravel Cloud heeft een ephemeral filesystem).

**Eigendomsscheiding (blijft intact):**
- Structuur (blueprints, blocks, templates) → blijft platte bestanden in git, via `release.sh`/provisioning.
- Content (pages, cases, teamleden) → verhuist naar de database, klant bewerkt via CP.

**Belangrijk:** je live site op Vercel leest via de REST API en merkt niets van deze
wijziging — content komt straks uit de DB i.p.v. bestanden, de API blijft gelijk.

> Waarom dit niet vooraf is gedaan: elke activerende stap vereist het Laravel Cloud-
> dashboard + lokale PHP/Composer. Voer de stappen in volgorde uit.

---

## Stap 1 — Eloquent-driver installeren (lokaal)

```bash
cd /Users/jaspermulders/mister-chameleon/mister-chameleon-cms/mister-chameleon-cms
composer require statamic/eloquent-driver
```

## Stap 2 — Interactieve installer draaien (lokaal)

```bash
php please install:eloquent-driver
```

De installer vraagt **welke repositories** naar de database gaan. Kies in elk geval:
`collections`, `entries`, `navigations`, `globals`, `taxonomies`, `terms`, `assets`,
`revisions`, `forms`, en **`users`** (cruciaal — CP-logins moeten in de DB anders
verdwijnen ze bij elke deploy).

> Hij vraagt ook "import existing data?" — zeg **nee** hier. We importeren straks
> rechtstreeks in de Laravel Cloud-database (stap 5), niet in je lokale SQLite.

Dit zet automatisch de juiste waarden in `config/statamic/eloquent-driver.php` en
publiceert de migraties.

## Stap 3 — Committen en pushen

```bash
git add -A
git commit -m "Add eloquent-driver: database-backed content for CP persistence"
git push
```

⚠️ **LET OP:** deze push triggert een Laravel Cloud-deploy. Die deploy zal **falen of
de site breken** zolang er nog geen database + migraties zijn (stap 4–5). Doe stap 4
en 5 dus **direct** hierna, in dezelfde sessie. (Of, veiliger: push naar een branch
`feature/eloquent-cp` i.p.v. main, en merge pas naar main ná stap 5.)

## Stap 4 — Postgres-database aanmaken op Laravel Cloud

1. Laravel Cloud → je environment → **Resources** → **Create Database** → Postgres
   (kleinste cluster volstaat), in dezelfde regio (eu-west).
2. Koppel hem aan de app → Laravel Cloud injecteert automatisch `DB_*` env-vars.
3. Zet bij **Environment Variables**: `CP_ENABLED=true` (verwijder of override de
   bestaande `CP_ENABLED=false`).
4. Bij **Deploy Commands** toevoegen: `php artisan migrate --force`
5. **Bewaar** de DB-credentials (View credentials) — die heb je in stap 5 nodig.

## Stap 5 — Bestaande content importeren in de Laravel Cloud-database

Dit doe je **lokaal**, maar gericht op de Laravel Cloud-database (zodat je huidige
flat-file content erin belandt). Maak tijdelijk een `.env.cloud` met de DB-creds uit
stap 4:

```bash
# In de CMS-map. Vervang met de Laravel Cloud Postgres-creds:
DB_CONNECTION=pgsql
DB_HOST=...        # uit "View credentials"
DB_PORT=5432
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...
```

Dan migraties + import draaien tegen die database:

```bash
php artisan migrate --force --env=cloud
php please eloquent:import-collections --env=cloud
php please eloquent:import-entries --env=cloud
php please eloquent:import-navs --env=cloud
php please eloquent:import-globals --env=cloud
php please eloquent:import-taxonomies --env=cloud
php please eloquent:import-assets --env=cloud
php please eloquent:import-forms --env=cloud
php please eloquent:import-users --env=cloud
```

> De exacte commandonamen kunnen per driver-versie iets verschillen. Check met
> `php please list | grep eloquent` welke `import-*` commando's beschikbaar zijn.
> Verwijder `.env.cloud` daarna weer (bevat secrets).

## Stap 6 — Deploy + CP openen

1. Trigger een deploy op Laravel Cloud (of merge je branch naar main).
2. Open `https://mister-chameleon-cms-main-gnipwt.laravel.cloud/cp`
   → het CP moet nu laden en je bestaande content tonen.
3. CP-gebruiker voor de klant aanmaken: `php please make:user` lokaal tegen `.env.cloud`,
   of via het CP zelf als superadmin.

## Stap 7 (optioneel) — Nette CP-URL

Laravel Cloud → environment → **Domains** → `cms.misterchameleon.nl` toevoegen.
DNS bij Strato: CNAME `cms` → de waarde die Laravel Cloud toont. Daarna
`APP_URL=https://cms.misterchameleon.nl` zetten + redeploy. Klant gebruikt dan
`https://cms.misterchameleon.nl/cp`.

---

## Verificatie-checklist

- [ ] `/cp` laadt op de Laravel Cloud-URL en toont bestaande pages/cases/team.
- [ ] Een testwijziging in het CP blijft behouden ná een nieuwe deploy (= DB werkt).
- [ ] De live site op misterchameleon.nl (Vercel) toont nog steeds dezelfde content
      (REST API leest nu uit de DB — moet identiek zijn).
- [ ] `/api/collections/pages/entries` op de Laravel Cloud-URL geeft nog steeds JSON.

## Workflow daarna

- **Klant** bewerkt content in het CP → direct in de DB → live binnen de ISR-window.
- **Jij** bewerkt structuur (blueprints/blocks/templates) lokaal → push CMS-repo →
  `release.sh`/provisioning distribueert de bestanden. Raakt klant-content niet.

## Terugrol-plan

Gaat er iets mis: zet `CP_ENABLED=false` terug en revert de eloquent-commit
(`git revert`). De flat-file content staat nog ongewijzigd in git, dus je valt
veilig terug op de huidige (lees-only) situatie.
