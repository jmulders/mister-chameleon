-- Adaptieve blokken van tenant statamic: beeld erbij en drie teksten korter.
--
-- Draaien op productie, met de hand. Eerst CMS #14 samenvoegen en bouwen in
-- Ploi, anders wijzen de drie beelden naast de tekst naar bestanden die er nog
-- niet staan.
--
-- Elke regel werkt alleen als het blok nog is zoals het op 14-11-2026 was. Heb
-- je een blok intussen zelf aangepast in de admin, dan blijft het ongemoeid.
-- Twee keer draaien kan geen kwaad.

begin;

-- 1. Tekst ────────────────────────────────────────────────────────────────────

-- De kop van de homepage: vier zinnen worden er drie.
update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}', to_jsonb(
         'Een marketeer uit de zorg zoekt iets anders dan een inkoper uit de logistiek. Mister Chameleon past je kop, je bewijs en je knop aan op wie er kijkt. Op de site die je al hebt.'::text)),
       updated_at = now()
 where tenant_id = 'statamic' and key = 'hero_default'
   and default_variant->>'subtitle' like 'Een marketeer uit de zorg%Toch zien ze dezelfde homepage.%';

-- De kop van Hoe het werkt: vier zinnen worden er drie.
update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}', to_jsonb(
         'Je site blijft je site. Mister Chameleon beslist per bezoek welke versie van een blok hij laat zien. Je bezoeker merkt er niets van, behalve dat het verhaal klopt.'::text)),
       updated_at = now()
 where tenant_id = 'statamic' and key = 'hero_page_hoe_het_werkt'
   and default_variant->>'subtitle' like 'Je site blijft je site.%Dat gebeurt in een fractie van een seconde.%';

-- Vacatures: de zin zei hetzelfde als de knop eronder.
update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}', to_jsonb(
         'Kijk welke rollen er openstaan.'::text)),
       updated_at = now()
 where tenant_id = 'statamic' and key = 'cta_careers_browse'
   and default_variant->>'subtitle' = 'Bekijk alle vacatures.';

-- 2. Beeld ────────────────────────────────────────────────────────────────────

-- Drie koppen met een beeldvullende achtergrond hadden geen beeld. Ze krijgen
-- de kameleonvideo van de standaardkop, met dezelfde startfoto. Wisselt een
-- regel de kop, dan blijft het beeld staan.
update adaptive_blocks b
   set default_variant = jsonb_set(b.default_variant, '{media}', d.default_variant->'media'),
       updated_at = now()
  from adaptive_blocks d
 where d.tenant_id = 'statamic' and d.key = 'hero_default'
   and d.default_variant->'media'->>'kind' = 'video'
   and b.tenant_id = 'statamic'
   and b.key in ('hero_google_problem', 'hero_intent_direct', 'hero_careers_high_intent')
   and b.default_variant->>'layoutVariant' = 'hero_background'
   and not (b.default_variant ? 'media');

-- Drie koppen met beeld naast de tekst hadden geen beeld. Ze krijgen een foto
-- in de huisstijl (CMS #14).
update adaptive_blocks b
   set default_variant = jsonb_set(b.default_variant, '{media}',
         jsonb_build_object('kind', 'image', 'alt', '', 'url', v.url)),
       updated_at = now()
  from (values
         ('hero_linkedin_vision',   'https://cms.misterchameleon.nl/assets/mc-kop-branche.svg'),
         ('hero_saas_default',      'https://cms.misterchameleon.nl/assets/mc-kop-saas.svg'),
         ('hero_careers_job_match', 'https://cms.misterchameleon.nl/assets/mc-kop-rol.svg')
       ) as v(key, url)
 where b.tenant_id = 'statamic' and b.key = v.key
   and b.default_variant->>'layoutVariant' = 'hero_split'
   and not (b.default_variant ? 'media');

-- 3. Controle ─────────────────────────────────────────────────────────────────
-- Verwacht: negen rijen. Zes met beeld (drie video, drie image) en drie met de
-- nieuwe tekst.
select key,
       default_variant->'media'->>'kind'                              as beeld,
       coalesce(default_variant->'media'->>'url',
                default_variant->'media'->'video'->>'url')            as adres,
       left(default_variant->>'subtitle', 60)                         as ondertitel
  from adaptive_blocks
 where tenant_id = 'statamic'
   and key in ('hero_default', 'hero_page_hoe_het_werkt', 'cta_careers_browse',
               'hero_google_problem', 'hero_intent_direct', 'hero_careers_high_intent',
               'hero_linkedin_vision', 'hero_saas_default', 'hero_careers_job_match')
 order by key;

commit;
