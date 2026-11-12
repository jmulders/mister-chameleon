-- Koppen voor de pagina's van misterchameleon.nl (tenant 'statamic').
--
-- Deel 1 maakt per pagina een eigen kop aan. De pagina in Statamic verwijst
-- ernaar met een sleutel die begint met hero_page_. Draai je dit twee keer, dan
-- wordt de tekst bijgewerkt en komt er niets dubbel.
--
-- Deel 2 werkt de drie standaardblokken van de homepage bij. Alleen de tekst en
-- de knoppen veranderen. Je video's, beelden en opmaak blijven staan.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

-- ── Deel 1: een kop per pagina ───────────────────────────────────────────────

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_hoe_het_werkt', 'statamic', 'Pagina Hoe het werkt', true, $mc${"title": "Hoe website personalisatie werkt", "subtitle": "Je site blijft je site. Mister Chameleon beslist per bezoek welke versie van een blok hij laat zien. Dat gebeurt in een fractie van een seconde. Je bezoeker merkt er niets van, behalve dat het verhaal klopt.", "tag": "Hoe het werkt", "ctas": [{"label": "Plan een demo", "href": "/demo", "variant": "primary"}], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_functies', 'statamic', 'Pagina Functies', true, $mc${"title": "Website personalisatie software voor B2B-teams", "subtitle": "Alles om je site per bezoeker te laten kloppen. Zonder nieuwe website en zonder developer.", "tag": "Functies", "ctas": [{"label": "Plan een demo", "href": "/demo", "variant": "primary"}, {"label": "Bekijk de prijzen", "href": "/prijzen", "variant": "secondary"}], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_integraties', 'statamic', 'Pagina Integraties', true, $mc${"title": "Website personalisatie koppelen aan je site", "subtitle": "Mister Chameleon werkt met de site die je al hebt. Kies de manier die bij je past.", "tag": "Integraties", "ctas": [{"label": "Plan een demo", "href": "/demo", "variant": "primary"}], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_cases', 'statamic', 'Pagina Cases', true, $mc${"title": "Voorbeelden van website personalisatie", "subtitle": "Zo gebruiken B2B-teams Mister Chameleon. Per verhaal lees je wat ze aanpasten en wat het deed.", "tag": "Cases", "ctas": [], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_kennisbank', 'statamic', 'Pagina Kennisbank', true, $mc${"title": "Kennisbank over website personalisatie", "subtitle": "Praktische artikelen over personalisatie, A/B-testen en account based marketing voor B2B.", "tag": "Kennisbank", "ctas": [], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_over_ons', 'statamic', 'Pagina Over ons', true, $mc${"title": "Over Mister Chameleon", "subtitle": "Wie we zijn en waarom we een platform bouwen dat websites per bezoeker laat kloppen.", "tag": "Over ons", "ctas": [], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_team', 'statamic', 'Pagina Team', true, $mc${"title": "Het team", "subtitle": "Maak kennis met de mensen achter Mister Chameleon.", "tag": "Team", "ctas": [], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_page_werken_bij', 'statamic', 'Pagina Werken bij', true, $mc${"title": "Werken bij Mister Chameleon", "subtitle": "Bekijk onze vacatures. Klein team, veel eigenaarschap.", "tag": "Werken bij", "ctas": [], "layoutVariant": "hero_page_banner", "contentAlign": "left"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

-- ── Deel 2: de homepage ──────────────────────────────────────────────────────

update adaptive_blocks
   set default_variant = default_variant || $mc${"tag": "Voor marketingteams in B2B", "title": "Website personalisatie voor B2B. Elke bezoeker ziet wat bij hem past.", "subtitle": "Een marketeer uit de zorg zoekt iets anders dan een inkoper uit de logistiek. Toch zien ze dezelfde homepage. Mister Chameleon past je kop, je bewijs en je knop aan op wie er kijkt. Op de site die je al hebt.", "ctas": [{"label": "Plan een demo", "href": "/demo", "variant": "primary"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt", "variant": "secondary"}]}$mc$::jsonb, updated_at = now()
 where tenant_id = 'statamic' and key = 'hero_default';

update adaptive_blocks
   set default_variant = default_variant || $mc${"tag": "Demo", "title": "Zie het werken op je eigen site", "subtitle": "In een demo van dertig minuten laten we zien hoe jouw homepage eruitziet voor drie verschillende bezoekers. Je kunt ook zelf beginnen. De eerste veertien dagen zijn gratis.", "ctas": [{"label": "Plan een demo", "href": "/demo", "variant": "primary"}, {"label": "Probeer 14 dagen gratis", "href": "/prijzen", "variant": "secondary"}]}$mc$::jsonb, updated_at = now()
 where tenant_id = 'statamic' and key = 'cta_default';

-- De drie kaarten houden hun beeld of video. Alleen titel en tekst wijzigen.
update adaptive_blocks
   set default_variant = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(default_variant || $mc${"tag": "Meten gaat boven geloven", "title": "Je hoeft ons niet te geloven. Je meet het.", "subtitle": "Elke aanpassing draait tegen een controlegroep die de gewone site ziet. Het verschil tussen de twee groepen is je resultaat."}$mc$::jsonb,
         '{items,0,title}', to_jsonb($mc$Altijd een controlegroep$mc$::text)),
         '{items,0,text}', to_jsonb($mc$Een deel van je bezoekers krijgt altijd de gewone site. Zo weet je wat de aanpassing toevoegde, en ook of ze iets toevoegde.$mc$::text)),
         '{items,1,title}', to_jsonb($mc$Werkt zonder cookies$mc$::text)),
         '{items,1,text}', to_jsonb($mc$De basis werkt zonder cookies en bouwt geen profiel op. De rest staat achter instellingen die je zelf bepaalt.$mc$::text)),
         '{items,2,title}', to_jsonb($mc$Zonder developer$mc$::text)),
         '{items,2,text}', to_jsonb($mc$Een plugin, een add-on of één regel code. Je hebt er geen IT-traject voor nodig.$mc$::text)),
       updated_at = now()
 where tenant_id = 'statamic' and key = 'proof_default'
   and jsonb_array_length(default_variant->'items') >= 3;

commit;

-- ── Controle ─────────────────────────────────────────────────────────────────
select key, default_variant->>'title' as kop
  from adaptive_blocks
 where tenant_id = 'statamic'
   and (key like 'hero\_page\_%' or key in ('hero_default', 'proof_default', 'cta_default'))
 order by key;
