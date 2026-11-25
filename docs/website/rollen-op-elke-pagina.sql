-- De demorollen op elke pagina: een eigen sectie, een eigen bewijsblok en een eigen slotblok.
--
-- Wie in Scenario Control een rol kiest, kreeg op de homepage een eigen banner en
-- op vijf pagina's een eigen intro. Verder bleef alles gelijk. Dit voegt toe:
--
--   1. Op Functies, Hoe het werkt, Integraties, Toepassingen en Kennisbank een
--      sectie direct onder de banner, met drie kaarten voor die rol. De sectie
--      bestaat alleen voor wie een rol koos: de gewone versie is leeg, en een
--      lege sectie wordt niet getoond.
--   2. Op de homepage per rol een eigen bewijsblok en een eigen slotblok.
--   3. De drie rolregels wijzen naar dat bewijsblok en dat slotblok.
--
-- De secties staan in een blok van de pagina zelf (feature_page_<pagina>), als
-- versie onder de bannersleutel van de rol. Twee keer draaien kan geen kwaad.
--
-- Eerst moet de platformversie live zijn die een pagina een eigen sectie laat
-- houden, en de CMS-versie die de plek voor die sectie op de pagina zet.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

-- 1. Een sectie per rol op vijf pagina's.
insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant, adaptive_variants)
values ('feature_page_functies', 'statamic', 'Pagina Functies, sectie per rol', true,
        '{"title": "", "items": []}'::jsonb,
        '[{"variantKey": "hero_role_marketeer", "label": "Rol Marketeer", "content": {"title": "Hier begin je als marketeer", "items": [{"icon": "sliders", "title": "Regels zonder code", "body": "Je klikt regels bij elkaar met keuzelijsten. Op bron, campagne, apparaat, tijd, gedrag en bedrijf.", "cta": "Lees meer", "ctaHref": "/blog/regels-of-ai-wie-kiest"}, {"icon": "bar-chart", "title": "Meten met een controlegroep", "body": "Een deel van je bezoekers ziet nooit een aanpassing. Daardoor zie je wat een aanpassing echt opleverde.", "cta": "Lees meer", "ctaHref": "/blog/meten-of-personalisatie-werkt"}, {"icon": "target", "title": "Aanvragen terug naar je advertenties", "body": "Een ingevuld formulier melden we als conversie aan Google, LinkedIn en Meta. Je campagnes sturen dan op echte aanvragen.", "cta": "Lees meer", "ctaHref": "/blog/retargeting-op-echte-aanvragen"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_bureau", "label": "Rol Bureau", "content": {"title": "Hier begin je als bureau", "items": [{"icon": "users", "title": "Alle klanten in één omgeving", "body": "Beheer de sites van al je klanten vanuit één omgeving. Elke klant heeft zijn eigen gegevens, regels en cijfers. In Pro.", "cta": "Lees meer", "ctaHref": "/cases/klantsites-in-een-omgeving"}, {"icon": "edit-3", "title": "De huisstijl van je klant", "body": "Blokken nemen de kleuren en lettertypen van de site over. Ze zien eruit alsof ze er altijd al stonden."}, {"icon": "bar-chart", "title": "Meten met een controlegroep", "body": "Een deel van de bezoekers ziet nooit een aanpassing. Daardoor zie je wat een aanpassing echt opleverde.", "cta": "Lees meer", "ctaHref": "/blog/meten-of-personalisatie-werkt"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_technisch", "label": "Rol Technisch", "content": {"title": "Hier begin je als developer", "items": [{"icon": "code", "title": "Eén koppeling", "body": "Een add-on voor Statamic, een plugin voor WordPress of één regel code voor elke andere site.", "cta": "Bekijk de integraties", "ctaHref": "/integraties"}, {"icon": "shield", "title": "Privacy geregeld", "body": "Toestemming, bewaartermijnen en verwijderverzoeken zitten in het product. Jij stelt ze in, wij voeren ze uit.", "cta": "Lees meer", "ctaHref": "/blog/personaliseren-zonder-cookietoestemming"}, {"icon": "search", "title": "Context verrijken", "body": "Wat een bezoek zelf laat zien, vul je aan met wat er al bekend is. Je zet zelf aan wat je gebruikt.", "cta": "Lees meer", "ctaHref": "/blog/dataverrijking-wat-weet-je-van-een-bezoeker"}], "layoutVariant": "feature_grid_cards"}}]'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set adaptive_variants = excluded.adaptive_variants,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant, adaptive_variants)
values ('feature_page_hoe_het_werkt', 'statamic', 'Pagina Hoe het werkt, sectie per rol', true,
        '{"title": "", "items": []}'::jsonb,
        '[{"variantKey": "hero_role_marketeer", "label": "Rol Marketeer", "content": {"title": "Wat jij als marketeer doet", "items": [{"icon": "mouse-pointer", "title": "Kiezen", "body": "Je wijst aan wat er per doelgroep anders mag. Begin met de paginabanner, daar win je het meest."}, {"icon": "layers", "title": "Maken", "body": "Je maakt per doelgroep een versie van elk blok. Daarna zet je de regels aan."}, {"icon": "bar-chart", "title": "Meten", "body": "Na een paar weken zie je in het dashboard wat het opleverde.", "cta": "Lees meer", "ctaHref": "/blog/meten-of-personalisatie-werkt"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_bureau", "label": "Rol Bureau", "content": {"title": "Zo zet je het in voor een klant", "items": [{"icon": "code", "title": "Koppelen", "body": "Je installeert de plugin, de add-on of de regel code op de site van je klant.", "cta": "Bekijk de integraties", "ctaHref": "/integraties"}, {"icon": "layers", "title": "Maken", "body": "Je maakt per doelgroep een versie van elk blok. Blokken nemen de kleuren en lettertypen van de site over."}, {"icon": "bar-chart", "title": "Meten", "body": "Na een paar weken zie je in het dashboard wat het opleverde. Elke klant heeft zijn eigen cijfers.", "cta": "Lees de toepassing", "ctaHref": "/cases/klantsites-in-een-omgeving"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_technisch", "label": "Rol Technisch", "content": {"title": "Wat jij als developer doet", "items": [{"icon": "code", "title": "Koppelen", "body": "Je installeert de plugin, de add-on of de regel code.", "cta": "Bekijk de integraties", "ctaHref": "/integraties"}, {"icon": "layout", "title": "Aanwijzen", "body": "Je wijst aan welke onderdelen van de pagina per doelgroep mogen verschillen."}, {"icon": "check-circle", "title": "Niet trager", "body": "De keuze valt voordat de pagina wordt verstuurd, of in de browser binnen een vaste tijd. Duurt het langer, dan krijgt de bezoeker je gewone pagina."}], "layoutVariant": "feature_grid_cards"}}]'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set adaptive_variants = excluded.adaptive_variants,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant, adaptive_variants)
values ('feature_page_integraties', 'statamic', 'Pagina Integraties, sectie per rol', true,
        '{"title": "", "items": []}'::jsonb,
        '[{"variantKey": "hero_role_marketeer", "label": "Rol Marketeer", "content": {"title": "Wat je er zelf van merkt", "items": [{"icon": "check-circle", "title": "Je site blijft zoals hij is", "body": "De koppeling komt erbij en je redactie werkt door in het CMS dat ze kent."}, {"icon": "sliders", "title": "De regels beheer je zelf", "body": "De koppeling zet je één keer neer. Daarna klik je regels bij elkaar met keuzelijsten.", "cta": "Bekijk de functies", "ctaHref": "/functies"}, {"icon": "target", "title": "Ook je CRM en je advertenties", "body": "HubSpot voor je CRM. Google Analytics 4 voor je cijfers. Google, LinkedIn en Meta voor je advertenties."}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_bureau", "label": "Rol Bureau", "content": {"title": "Past op de sites van je klanten", "items": [{"icon": "users", "title": "Elke klant apart", "body": "Elke klant heeft zijn eigen gegevens, regels en cijfers. In Pro.", "cta": "Lees de toepassing", "ctaHref": "/cases/klantsites-in-een-omgeving"}, {"icon": "check-circle", "title": "Geen verbouwing", "body": "De site van je klant blijft zoals hij is. De koppeling komt erbij en de redactie werkt door in het CMS dat ze kent."}, {"icon": "repeat", "title": "Bijwerken met één klik", "body": "Een nieuwe versie van de WordPress-plugin staat tussen de gewone updates. Eén klik en je bent bij."}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_technisch", "label": "Rol Technisch", "content": {"title": "Wat je als developer wilt weten", "items": [{"icon": "layers", "title": "Statamic op de server", "body": "In Statamic valt de keuze op de server, voordat de pagina wordt verstuurd. Je bezoeker ziet nooit eerst een andere versie."}, {"icon": "code", "title": "Eén regel code", "body": "Op elke andere site plak je één regel code. Die houdt de pagina heel even vast tot de keuze er is."}, {"icon": "shield", "title": "Zonder cookies", "body": "Weigert een bezoeker cookies, dan blijft het bij de basis en bewaren we niets over hem.", "cta": "Lees meer", "ctaHref": "/blog/personaliseren-zonder-cookietoestemming"}], "layoutVariant": "feature_grid_cards"}}]'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set adaptive_variants = excluded.adaptive_variants,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant, adaptive_variants)
values ('feature_page_cases', 'statamic', 'Pagina Toepassingen, sectie per rol', true,
        '{"title": "", "items": []}'::jsonb,
        '[{"variantKey": "hero_role_marketeer", "label": "Rol Marketeer", "content": {"title": "Voor jou als marketeer", "items": [{"icon": "target", "title": "Drie titels voor drie doelgroepen", "body": "Je adverteert bij drie soorten kopers en ze komen alle drie op dezelfde homepage. Zo krijgt elke campagne een eigen titel.", "cta": "Lees de toepassing", "ctaHref": "/cases/drie-titels-voor-drie-doelgroepen"}, {"icon": "repeat", "title": "Testen zonder developer", "body": "Zo zet je als marketeer zelf een variant live en lees je af of hij beter werkt.", "cta": "Lees de toepassing", "ctaHref": "/cases/testen-zonder-developer"}, {"icon": "bar-chart", "title": "Meten met een controlegroep", "body": "Elke aanpassing draait tegen een controlegroep die de gewone site ziet.", "cta": "Lees meer", "ctaHref": "/blog/meten-of-personalisatie-werkt"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_bureau", "label": "Rol Bureau", "content": {"title": "Voor jou als bureau", "items": [{"icon": "users", "title": "Alle klantsites in één omgeving", "body": "Je doet personalisatie voor meer dan één klant. Zo beheer je al die sites vanuit één plek, elk met eigen doelgroepen en eigen cijfers.", "cta": "Lees de toepassing", "ctaHref": "/cases/klantsites-in-een-omgeving"}, {"icon": "target", "title": "Drie titels voor drie doelgroepen", "body": "Elke campagne van je klant krijgt een eigen titel, zonder drie landingspagina''s.", "cta": "Lees de toepassing", "ctaHref": "/cases/drie-titels-voor-drie-doelgroepen"}, {"icon": "repeat", "title": "Testen zonder developer", "body": "Je zet zelf een variant live en leest af of hij beter werkt.", "cta": "Lees de toepassing", "ctaHref": "/cases/testen-zonder-developer"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_technisch", "label": "Rol Technisch", "content": {"title": "Voor jou als developer", "items": [{"icon": "repeat", "title": "Testen zonder developer", "body": "Marketing zet zelf een variant live. Er is niet voor elke test een sprint nodig.", "cta": "Lees de toepassing", "ctaHref": "/cases/testen-zonder-developer"}, {"icon": "code", "title": "Eén keer koppelen", "body": "Je installeert de plugin, de add-on of de regel code. Daarna beheert marketing de regels.", "cta": "Bekijk de integraties", "ctaHref": "/integraties"}, {"icon": "shield", "title": "Privacy geregeld", "body": "Toestemming, bewaartermijnen en verwijderverzoeken zitten in het product.", "cta": "Lees meer", "ctaHref": "/blog/personaliseren-zonder-cookietoestemming"}], "layoutVariant": "feature_grid_cards"}}]'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set adaptive_variants = excluded.adaptive_variants,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant, adaptive_variants)
values ('feature_page_kennisbank', 'statamic', 'Pagina Kennisbank, sectie per rol', true,
        '{"title": "", "items": []}'::jsonb,
        '[{"variantKey": "hero_role_marketeer", "label": "Rol Marketeer", "content": {"title": "Drie artikelen voor marketeers", "items": [{"icon": "target", "title": "Van advertentie naar pagina", "body": "Je advertentie belooft iets, je pagina vertelt iets algemeens. Lees hoe je site per campagne aansluit op de advertentie waar iemand op klikte.", "cta": "Lees meer", "ctaHref": "/blog/van-advertentie-naar-pagina"}, {"icon": "bar-chart", "title": "Meten met een controlegroep", "body": "Meer aanvragen sinds je personaliseert, maar komt het daardoor? Lees hoe een controlegroep laat zien wat een aangepaste pagina echt oplevert.", "cta": "Lees meer", "ctaHref": "/blog/meten-of-personalisatie-werkt"}, {"icon": "repeat", "title": "Retargeting op echte aanvragen", "body": "Retargeting werkt beter als je advertentieplatforms weten wie een aanvraag deed.", "cta": "Lees meer", "ctaHref": "/blog/retargeting-op-echte-aanvragen"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_bureau", "label": "Rol Bureau", "content": {"title": "Drie artikelen voor bureaus", "items": [{"icon": "users", "title": "Beginnen met drie doelgroepen", "body": "Personaliseren hoeft niet groot te beginnen. Lees hoe je drie doelgroepen kiest en wat je per doelgroep schrijft.", "cta": "Lees meer", "ctaHref": "/blog/beginnen-met-drie-doelgroepen"}, {"icon": "building", "title": "Account based marketing", "body": "Je kiest je doelaccounts met zorg. Lees hoe een website daarna per bedrijf een eigen verhaal vertelt.", "cta": "Lees meer", "ctaHref": "/blog/account-based-marketing-op-je-website"}, {"icon": "message-circle", "title": "Van bezoeker naar lead", "body": "Lees hoe elke bezoeker een profiel en een score krijgt en hoe sales een seintje krijgt in Slack, in HubSpot of via een webhook.", "cta": "Lees meer", "ctaHref": "/blog/van-bezoeker-naar-lead"}], "layoutVariant": "feature_grid_cards"}}, {"variantKey": "hero_role_technisch", "label": "Rol Technisch", "content": {"title": "Drie artikelen voor developers", "items": [{"icon": "shield", "title": "Personaliseren zonder cookietoestemming", "body": "Veel bezoekers weigeren cookies. Lees wat je site dan nog over een bezoek weet en waar je wel toestemming voor nodig hebt.", "cta": "Lees meer", "ctaHref": "/blog/personaliseren-zonder-cookietoestemming"}, {"icon": "search", "title": "Dataverrijking", "body": "Lees welke gegevens Mister Chameleon aan een bezoek toevoegt, wat er wordt bewaard en wat pas na toestemming gebeurt.", "cta": "Lees meer", "ctaHref": "/blog/dataverrijking-wat-weet-je-van-een-bezoeker"}, {"icon": "sparkles", "title": "Regels of AI", "body": "Je site kiest met vaste regels wat een bezoeker ziet, of met AI. Lees wat het verschil is en hoe je veilig begint.", "cta": "Lees meer", "ctaHref": "/blog/regels-of-ai-wie-kiest"}], "layoutVariant": "feature_grid_cards"}}]'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set adaptive_variants = excluded.adaptive_variants,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

-- 2. Per rol een bewijsblok en een slotblok voor de homepage.
insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_role_marketeer', 'statamic', 'Demo-rol Marketeer, bewijs', true,
        '{"tag": "Voor marketeers", "title": "Jij aan het stuur, zonder developer", "subtitle": "Je stelt het zelf in, je meet het zelf en je campagnes leren ervan.", "items": [{"title": "Regels zonder code", "text": "Je klikt regels bij elkaar met keuzelijsten. Bij elke regel zie je hoe vaak hij is toegepast."}, {"title": "Altijd een controlegroep", "text": "Een deel van je bezoekers krijgt altijd de gewone site. Zo weet je wat de aanpassing toevoegde."}, {"title": "Sturen op echte aanvragen", "text": "Een ingevuld formulier melden we als conversie aan Google, LinkedIn en Meta."}]}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_role_bureau', 'statamic', 'Demo-rol Bureau, bewijs', true,
        '{"tag": "Voor bureaus", "title": "Eén omgeving voor al je klanten", "subtitle": "Meerdere sites in één omgeving zit in het pakket Pro.", "items": [{"title": "Elke klant apart", "text": "Elke klant heeft zijn eigen gegevens, regels en cijfers."}, {"title": "In de huisstijl van de klant", "text": "Blokken nemen de kleuren en lettertypen van de site over. Ze zien eruit alsof ze er altijd al stonden."}, {"title": "Een resultaat dat je kunt laten zien", "text": "Elke aanpassing draait tegen een controlegroep die de gewone site ziet. Het verschil tussen de twee groepen is het resultaat."}]}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_role_technisch', 'statamic', 'Demo-rol Technisch, bewijs', true,
        '{"tag": "Voor developers", "title": "Eén koppeling, daarna geen werk meer", "subtitle": "Je koppelt één keer. De regels beheert marketing daarna zelf.", "items": [{"title": "Kies je koppeling", "text": "Een add-on voor Statamic, een plugin voor WordPress of één regel code voor elke andere site."}, {"title": "Niet trager", "text": "De keuze valt voordat de pagina wordt verstuurd, of in de browser binnen een vaste tijd. Duurt het langer, dan krijgt de bezoeker je gewone pagina."}, {"title": "Privacy in het product", "text": "Toestemming, bewaartermijnen en verwijderverzoeken zitten in het product."}]}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_role_marketeer', 'statamic', 'Demo-rol Marketeer, slotblok', true,
        '{"tag": "Demo", "title": "Zie je eigen homepage veranderen", "subtitle": "In een demo van dertig minuten laten we zien hoe jouw homepage eruitziet voor drie verschillende bezoekers. Je kunt ook zelf beginnen. De eerste veertien dagen zijn gratis.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/prijzen", "label": "Probeer 14 dagen gratis", "variant": "secondary"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-open-kameleon-tak-cta-2.svg", "kind": "image"}, "mediaSide": "right", "layoutVariant": "cta_media_split"}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_role_bureau', 'statamic', 'Demo-rol Bureau, slotblok', true,
        '{"tag": "Voor bureaus", "title": "Zie het werken voor je klanten", "subtitle": "In een demo van dertig minuten laten we het zien, met een website als voorbeeld. Meerdere sites in één omgeving zit in het pakket Pro.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/prijzen", "label": "Bekijk prijzen", "variant": "secondary"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-open-kameleon-tak-cta-2.svg", "kind": "image"}, "mediaSide": "right", "layoutVariant": "cta_media_split"}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_role_technisch', 'statamic', 'Demo-rol Technisch, slotblok', true,
        '{"tag": "Voor developers", "title": "Bekijk eerst de koppeling", "subtitle": "Lees hoe je koppelt met Statamic, WordPress of één regel code. Liever meekijken? Plan een demo van dertig minuten.", "ctas": [{"href": "/integraties", "label": "Bekijk de integraties", "variant": "primary"}, {"href": "/demo", "label": "Plan een demo", "variant": "secondary"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-open-kameleon-tak-cta-2.svg", "kind": "image"}, "mediaSide": "right", "layoutVariant": "cta_media_split"}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

-- 3. De rolregels. Alleen het bewijs en het slotblok van de drie rolregels veranderen.
update rules_config
set config = jsonb_set(jsonb_set(config, '{rules}', (
      select jsonb_agg(
        case r->>'id'
          when 'demo.role_marketeer' then jsonb_set(r, '{plan}', (r->'plan') || '{"proofKey": "proof_role_marketeer", "ctaKey": "cta_role_marketeer"}'::jsonb)
          when 'demo.role_bureau' then jsonb_set(r, '{plan}', (r->'plan') || '{"proofKey": "proof_role_bureau", "ctaKey": "cta_role_bureau"}'::jsonb)
          when 'demo.role_technisch' then jsonb_set(r, '{plan}', (r->'plan') || '{"proofKey": "proof_role_technisch", "ctaKey": "cta_role_technisch"}'::jsonb)
          else r
        end
        order by ord)
      from jsonb_array_elements(config->'rules') with ordinality as t(r, ord))),
      '{updatedAt}', to_jsonb(now()::text)),
    updated_at = now()
where key = 'homepage_statamic';

commit;
