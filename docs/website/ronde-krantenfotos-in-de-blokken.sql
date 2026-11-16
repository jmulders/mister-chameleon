-- Ronde krantenfoto's in de adaptieve blokken van misterchameleon.nl
--
-- De eigenaar op 15-11-2026: foto's zijn altijd zwart-wit en staan altijd in een
-- cirkel, ook in het hoofdbeeld. Deze opdrachten vervangen de kleurenvideo, de
-- kleurenfoto en het bewegende plaatje door een ronde krantenfoto.
--
-- PAS DRAAIEN als de drie bestanden op de CMS staan (CMS-PR 22):
--   https://cms.misterchameleon.nl/assets/mc-rond-kameleon-tak.svg
--   https://cms.misterchameleon.nl/assets/mc-rond-kameleon-tak-breed.svg
--   https://cms.misterchameleon.nl/assets/mc-rond-kameleon-zand-2.svg
-- en als platform-PR 464 live is. Elke opdracht raakt alleen een blok dat nog
-- het oude beeld heeft, dus twee keer draaien kan geen kwaad.

-- 1. Vier hoofdbeelden: van video als achtergrond naar tekst links, foto rechts.
update adaptive_blocks
set default_variant = jsonb_set(
      jsonb_set(default_variant, '{layoutVariant}', '"hero_split"'),
      '{media}',
      '{"kind":"image","url":"https://cms.misterchameleon.nl/assets/mc-rond-kameleon-tak.svg","alt":""}'::jsonb)
where tenant_id = 'statamic'
  and key in ('hero_default', 'hero_google_problem', 'hero_intent_direct', 'hero_careers_high_intent')
  and default_variant->'media'->>'kind' = 'video';

-- 2. Het hoofdbeeld "Vergelijk en kies de aanpak die bij je past".
update adaptive_blocks
set default_variant = jsonb_set(
      default_variant, '{media,url}',
      '"https://cms.misterchameleon.nl/assets/mc-rond-kameleon-zand-2.svg"')
where tenant_id = 'statamic'
  and key = 'hero_consideration'
  and default_variant->'media'->>'url' like '%/tenant-assets/statamic/%';

-- 3. Het blok onderaan de homepage.
update adaptive_blocks
set default_variant = jsonb_set(
      default_variant, '{media}',
      '{"kind":"image","url":"https://cms.misterchameleon.nl/assets/mc-rond-kameleon-tak-breed.svg","alt":""}'::jsonb)
where tenant_id = 'statamic'
  and key = 'cta_default'
  and default_variant->'media'->>'kind' = 'video';

-- 4. De twee meldingen.
update adaptive_blocks
set default_variant = jsonb_set(
      default_variant, '{media,url}',
      '"https://cms.misterchameleon.nl/assets/mc-rond-kameleon-tak-breed.svg"')
where tenant_id = 'statamic'
  and key in ('notification_default', 'notification_returning')
  and default_variant->'media'->>'url' like '%/tenant-assets/statamic/%';

-- Controle: zeven blokken met mc-rond, geen enkel blok meer met een video.
select key, default_variant->>'layoutVariant' as layout, default_variant->'media'->>'kind' as kind,
       coalesce(default_variant->'media'->>'url', default_variant->'media'->'video'->>'url') as url
from adaptive_blocks
where tenant_id = 'statamic' and default_variant->'media' is not null and default_variant->>'media' <> 'null'
order by key;

-- Terugdraaien van het hoofdbeeld van de homepage, mocht dat nodig zijn:
-- update adaptive_blocks
-- set default_variant = jsonb_set(jsonb_set(default_variant, '{layoutVariant}', '"hero_background"'), '{media}',
--   '{"kind":"video","video":{"url":"https://kdhfpvjeriszteqhpgll.supabase.co/storage/v1/object/public/tenant-assets/statamic/affb2c4c-f86a-4a2e-805b-43f0341fa4fc.mp4","loop":true,"muted":true,"poster":"https://kdhfpvjeriszteqhpgll.supabase.co/storage/v1/object/public/tenant-assets/statamic/49e8b1f5-eb70-4517-93df-4ae3eeb56b46.jpg","source":"upload","autoplay":true,"controls":false,"objectPosition":"center top"}}'::jsonb)
-- where tenant_id = 'statamic' and key = 'hero_default';


-- ── 16-11-2026, tweede ronde ────────────────────────────────────────────────
-- De eigenaar koos voor de doorzichtige foto. Het blok onderaan de homepage en
-- de drie onderdelen van het bewijsblok staan op de paginakleur en krijgen een
-- mc-open-beeld. De hoofdbeelden en de meldingen houden hun beeld op papier.
-- PAS DRAAIEN als CMS-PR 25 en de platform-PR voor de donkere pagina live zijn.

update adaptive_blocks
set default_variant = jsonb_set(
      default_variant, '{media,url}',
      '"https://cms.misterchameleon.nl/assets/mc-open-kameleon-tak-cta.svg"')
where tenant_id = 'statamic'
  and key = 'cta_default'
  and default_variant->'media'->>'url' like '%/mc-rond-kameleon-tak-breed.svg';

update adaptive_blocks
set default_variant = jsonb_set(jsonb_set(jsonb_set(default_variant,
      '{items,0,media,url}', '"https://cms.misterchameleon.nl/assets/mc-open-weegschaal-breed.svg"'),
      '{items,1,media,url}', '"https://cms.misterchameleon.nl/assets/mc-open-bord-breed.svg"'),
      '{items,2,media,url}', '"https://cms.misterchameleon.nl/assets/mc-open-stekker-breed.svg"')
where tenant_id = 'statamic'
  and key = 'proof_default'
  and default_variant->'items'->0->'media'->>'url' like '%/mc-rond-weegschaal-breed.svg'
  and default_variant->'items'->1->'media'->>'url' like '%/mc-rond-bord-breed.svg'
  and default_variant->'items'->2->'media'->>'url' like '%/mc-rond-stekker-breed.svg';
