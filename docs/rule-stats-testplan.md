# Testplan — kloppen de rule-stats?

Doel: verifiëren dat het paneel **"Regel-vuringen (laatste 30 dagen)"** onderaan de
Rules-pagina echt telt hoe vaak elke regel vuurt, inclusief regels die nooit vuren.

Locatie in de UI: Admin → Tenant → **Personalization → Rules** → onderste paneel
`RuleFireStatsPanel`. Elke geconfigureerde regel krijgt een balk met aantal +
laatste vuurdatum; regels met 0 krijgen "nooit gevuurd" (amber).

---

## 0. Hoe het onder de motorkap werkt (lees dit eerst)

Dit bepaalt wat je in de test wél en niet zult zien.

**Wat registreert een vuring?** Alleen een decision-provider die met een `tenantId`
wordt aangemaakt. In de code zijn dat drie paden:

- `lib/pipeline/homepage-pipeline.ts` — de platform-gehoste homepage (de statamic-demo).
- `app/api/snippet/decide/route.ts` — de snippet-`decide` (nascita op externe site).
- `app/api/v1/slot/route.ts` — de v1 slot-route.

**Wat registreert NIET:** e-mailvarianten, de experiments-debug/preview-route, en
CMS-pagina's die niet via de homepage-pipeline lopen (`lib/cms-page-decision.ts`
geeft geen tenantId mee). Test dus op de homepage of via de snippet, niet op een
losse subpagina.

**Timing (belangrijk!).** Vuringen worden **in-memory gebufferd** en pas
**één keer per 60 seconden** naar de database geflusht — en die flush wordt
getriggerd door een *volgende* vuring nadat die 60s voorbij zijn
(`FLUSH_INTERVAL_MS = 60_000` in `lib/observability/rule-fire-store.ts`).

Gevolg voor de test:

- Eén losse pageview verschijnt **niet meteen** in het paneel.
- Op serverless (Vercel) leeft de buffer per warme instance. Als de instance
  bevriest/recyclet voordat de volgende vuring binnenkomt, gaan die counts
  verloren. Genereer daarom **verkeer verspreid over minstens ~90 seconden**, niet
  één enkele request.
- Reken op **1–2 minuten** vertraging voordat counts zichtbaar worden.

---

## 1. Vooraf — migratie op prod (BLOKKER)

Gecontroleerd op 2026-08-03:

- **dev** (`xqaeqbqjymeyxbvmhseg`): tabel `rule_fire_daily` + functie
  `increment_rule_fire` aanwezig. ✅
- **prod** (`kdhfpvjeriszteqhpgll`): tabel bestaat **niet**. ❌

Zolang de tabel op prod ontbreekt, registreert prod niets (fail-open: de decide
blijft werken, de counts worden stil weggegooid). **Draai eerst migratie 163 op
prod** (idempotent, bevat ook de tabel uit 162):

```sql
-- supabase/migrations/20240101000163_rule_fire_daily_ensure.sql
DROP TABLE IF EXISTS public.rule_fire_events;

CREATE TABLE IF NOT EXISTS public.rule_fire_daily (
  tenant_id text    NOT NULL,
  rule_id   text    NOT NULL,
  day       date    NOT NULL DEFAULT current_date,
  count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, rule_id, day)
);

CREATE INDEX IF NOT EXISTS rule_fire_daily_tenant_day_idx
  ON public.rule_fire_daily (tenant_id, day);

ALTER TABLE public.rule_fire_daily ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.increment_rule_fire(text, text);

CREATE OR REPLACE FUNCTION public.increment_rule_fire(
  p_tenant_id text,
  p_rule_id   text,
  p_count     integer DEFAULT 1,
  p_day       date    DEFAULT current_date
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.rule_fire_daily (tenant_id, rule_id, day, count)
  VALUES (p_tenant_id, p_rule_id, p_day, p_count)
  ON CONFLICT (tenant_id, rule_id, day)
  DO UPDATE SET count = public.rule_fire_daily.count + EXCLUDED.count;
$$;
```

Verifieer daarna:

```sql
SELECT to_regclass('public.rule_fire_daily') AS table_exists,
       (SELECT count(*) FROM pg_proc WHERE proname='increment_rule_fire') AS fn_count;
-- verwacht: table_exists = rule_fire_daily, fn_count = 1
```

---

## 2. Snelste test — DB-laag (30 sec, bewijst de opslag)

Bewijst dat tabel + increment-functie + aggregatie kloppen, los van verkeer.
Draai op **dev** (of prod ná stap 1):

```sql
-- schrijf 3 test-vuringen weg voor tenant 'statamic'
SELECT increment_rule_fire('statamic', 'test.smoke', 1);
SELECT increment_rule_fire('statamic', 'test.smoke', 1);
SELECT increment_rule_fire('statamic', 'preset.interest_technical', 5);

-- lees terug zoals het paneel dat doet (laatste 30 dagen)
SELECT rule_id, sum(count) AS total, max(day) AS last_day
FROM rule_fire_daily
WHERE tenant_id = 'statamic' AND day >= current_date - 30
GROUP BY rule_id ORDER BY total DESC;
-- verwacht: preset.interest_technical=5, test.smoke=2
```

Ruim daarna op:

```sql
DELETE FROM rule_fire_daily WHERE rule_id = 'test.smoke';
```

Als dit klopt, werkt de opslag- en leeslaag. Wat overblijft is of de *applicatie*
tijdens echt verkeer vuurt (stap 3/4).

---

## 3. End-to-end test lokaal (aanrader — geen 60s-serverless-gedoe)

Lokaal leeft de buffer in één proces, dus flushen is betrouwbaar.

1. Start de app lokaal (`npm run dev`), tenant = statamic:
   `http://localhost:3000/?tenant=statamic`
2. Noteer de begincijfers: open
   `/admin/tenants/statamic/personalization/rules`, scroll naar het onderste
   paneel, onthoud de totalen.
3. Genereer verkeer dat regels laat vuren. Wissel via de **Who are you?**-balk
   tussen Marketer / Agency owner / Technical lead en herlaad steeds. Elke
   render van de homepage roept de homepage-pipeline aan → vuring.
   Doe dit ~10× verspreid over **≥ 90 seconden** (zodat de 60s-flush triggert).
4. Herlaad de Rules-pagina. Verwacht: de totalen zijn opgelopen, en de regels die
   bij de gekozen rollen horen (bv. `preset.interest_technical`) staan bovenaan
   met een recente datum.
5. Controleer een **dode** regel: kies een regel met hoge prioriteit die door een
   lager nummer altijd wordt overschreven, of een onbereikbare drempel. Die moet
   "nooit gevuurd" tonen. Zet zijn prioriteit tijdelijk vóór de winnaar, herhaal
   stap 3, en zie hem oplopen → bewijst dat "first match wins" correct in de tel
   landt.

DB-check parallel (zelfde als stap 2 hierboven maar met echte rule-ids):

```sql
SELECT rule_id, sum(count) total, max(day) last_day
FROM rule_fire_daily
WHERE tenant_id='statamic' AND day >= current_date - 30
GROUP BY rule_id ORDER BY total DESC LIMIT 15;
```

---

## 4. End-to-end test op prod (na stap 1)

**Statamic-demo (homepage-pipeline):**

1. Open de prod-demo een stuk of 10× verspreid over ~2 min, wissel van rol.
2. Wacht 1–2 min (serverless-flush). Herlaad
   `/admin/tenants/statamic/personalization/rules` en check of de counts stijgen.

**Nascita (snippet-decide):**

1. Bezoek `https://nascita.nl/chameleon-demo/` meerdere keren over ~2 min
   (elke pageview doet een `decide`-call → vuring op de matchende regel).
2. Wacht 1–2 min, open `/admin/tenants/nascita/personalization/rules` en check.
   Nascita heeft 6 regels; ten minste de matchende regel(s) moeten oplopen.

DB-check per tenant:

```sql
SELECT tenant_id, sum(count) total, max(day) last_day
FROM rule_fire_daily
WHERE tenant_id IN ('statamic','nascita','mister-chameleon')
  AND day >= current_date - 30
GROUP BY tenant_id ORDER BY total DESC;
```

---

## 5. Wat "goed" betekent (acceptatiecriteria)

- Na verkeer lopen de totalen in het paneel **en** in `rule_fire_daily` gelijk op.
- De regels die horen bij het getoonde gedrag staan bovenaan met **datum = vandaag**.
- Regels die nooit matchen tonen **"nooit gevuurd"** en de amber-waarschuwing
  ("X regels vuurden niet — controleer drempel of prioriteit") klopt met dat aantal.
- Zet je een dode regel op winnende prioriteit, dan gaat hij binnen 1–2 min tellen.

---

## 6. Troubleshooting

| Symptoom | Waarschijnlijke oorzaak | Actie |
|---|---|---|
| Alles blijft 0 op prod | migratie 163 niet gedraaid | stap 1 |
| 0 na één pageview | 60s-buffer nog niet geflusht | meer verkeer over ≥90s, wacht 1–2 min |
| 0 op serverless ondanks verkeer | warme instance recyclet vóór flush | genereer meer, aaneengesloten verkeer |
| Wel counts in DB, niet in paneel | verkeerde tenant of >30 dagen oud | check `tenant_id` en `day >= current_date-30` |
| Subpagina telt niet | die render geeft geen tenantId mee | test op homepage of via snippet |
| E-mailvariant telt niet | e-mailpad registreert bewust niet | verwacht gedrag, niet testen via mail |
| Regel "nooit gevuurd" die zou moeten vuren | lagere prioriteit wint eerst, of drempel onbereikbaar | prioriteit/drempel nakijken |
