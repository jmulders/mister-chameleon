-- Drie blokken van misterchameleon.nl (tenant 'statamic') linken nog naar een
-- adres dat is verhuisd of nooit heeft bestaan. Alleen de link verandert.
--
--   hero_consideration      /pricing    wordt /prijzen
--   notification_default    /changelog  wordt /kennisbank  (die pagina bestond niet)
--   notification_returning  /dashboard  wordt /kennisbank  (dat is het beheer, niet voor bezoekers)
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

update adaptive_blocks
   set default_variant   = replace(default_variant::text,   '"href": "/pricing"', '"href": "/prijzen"')::jsonb,
       adaptive_variants = replace(adaptive_variants::text, '"href": "/pricing"', '"href": "/prijzen"')::jsonb,
       updated_at = now()
 where tenant_id = 'statamic' and key = 'hero_consideration';

update adaptive_blocks
   set default_variant   = replace(default_variant::text,   '"href": "/changelog"', '"href": "/kennisbank"')::jsonb,
       adaptive_variants = replace(adaptive_variants::text, '"href": "/changelog"', '"href": "/kennisbank"')::jsonb,
       updated_at = now()
 where tenant_id = 'statamic' and key = 'notification_default';

update adaptive_blocks
   set default_variant   = replace(default_variant::text,   '"href": "/dashboard"', '"href": "/kennisbank"')::jsonb,
       adaptive_variants = replace(adaptive_variants::text, '"href": "/dashboard"', '"href": "/kennisbank"')::jsonb,
       updated_at = now()
 where tenant_id = 'statamic' and key = 'notification_returning';

commit;

-- Controle: dit moet nul rijen geven.
select key
  from adaptive_blocks
 where tenant_id = 'statamic'
   and (default_variant::text || adaptive_variants::text) ~ '"href": "/(pricing|changelog|dashboard|features|about|blog|werkenbij|book-demo|signup)"';
