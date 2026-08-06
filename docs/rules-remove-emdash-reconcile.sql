-- Reconciliatie: em-dashes uit opgeslagen rule-copy verwijderen
-- ==============================================================
--
-- Context
--   De rule-labels/reasons in de code (preset-conditions, generate-preset-rules,
--   homepage-rules, stored-rule, context-library) bevatten geen em-dashes meer;
--   " — " is vervangen door ", ". Reeds geseede rules staan echter al in de
--   `rules_config`-tabel (JSONB), dus die stored copy moet eenmalig mee-verschoond
--   worden — anders blijven de em-dashes in de admin zichtbaar.
--
-- Wat dit doet
--   Vervangt in elke tenant-rules-config (key `homepage_*`) de tekst " — " door
--   ", ", identiek aan de code-sweep. De vervanging raakt alleen string-waarden
--   (labels/reasons); JSON-structuur bevat nooit " — ". `::jsonb` herparset, dus
--   ongeldige JSON zou de update laten falen (veilig). Vangt ook tenant-eigen
--   rules met em-dashes ("overal eruit").
--
-- Veiligheid
--   - Alleen rijen met " — " worden aangeraakt (idempotent; nogmaals draaien = no-op).
--   - Draai eerst het SELECT-preview, controleer de counts, draai dan de UPDATE.
--   - De rules-config is app-side gecachet (unstable_cache, revalidate 120s), dus
--     de admin toont de nieuwe tekst uiterlijk ~2 min na de write. Wil je direct
--     verversen: sla in de rules-editor één keer op (dat invalideert de cache-tag),
--     of wacht de TTL af.
--
-- Draai dit op PROD (kdhfpvjeriszteqhpgll) zelf; niet automatisch toegepast.

-- 1) Preview: hoeveel em-dashes per config (verwacht > 0 vóór, 0 erna).
select key,
       (length(config::text) - length(replace(config::text, '—', ''))) as emdash_count
from rules_config
where key like 'homepage_%'
order by key;

-- 2) Reconciliatie.
update rules_config
set config = replace(config::text, ' — ', ', ')::jsonb
where key like 'homepage_%'
  and config::text like '% — %'
returning key,
          (length(config::text) - length(replace(config::text, '—', ''))) as remaining_emdash;

-- 3) Verificatie (verwacht 0 rijen).
select key
from rules_config
where key like 'homepage_%'
  and config::text like '%—%';
