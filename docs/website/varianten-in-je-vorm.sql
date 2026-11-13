-- De varianten die de regels van misterchameleon.nl gebruiken, in je-vorm.
--
-- De site kiest per bezoeker een variant van de kop, het bewijs, de knop, de
-- functies, het formulier en de melding. 35 van die varianten haalden hun tekst
-- uit de standaardblokken van het platform. Die staan in u-vorm en bevatten
-- beweringen die niet kloppen met het product: een pakket Enterprise, 30 dagen
-- gratis, nog 3 onboarding-sessies deze week, 40 procent meer aanmeldingen.
--
-- Dit geeft tenant 'statamic' voor elk van die varianten een eigen rij, met de
-- tekst in je-vorm en zonder die beweringen. De standaardblokken van het
-- platform blijven zoals ze zijn, want andere klanten gebruiken ze ook.
--
-- Bestaat er al een eigen rij, dan verandert alleen de tekst. Beeld, video en
-- opmaak blijven staan. Twee keer draaien kan geen kwaad.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('conversion_contact', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'conversion_contact'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'conversion_contact'), '{}'::jsonb)
          || $mc${"tag": "Neem contact op", "title": "Stel je vraag aan ons team", "subtitle": "We beantwoorden je vragen snel en persoonlijk. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Neem contact op", "title": "Stel je vraag aan ons team", "subtitle": "We beantwoorden je vragen snel en persoonlijk. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('conversion_demo', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'conversion_demo'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'conversion_demo'), '{}'::jsonb)
          || $mc${"tag": "Demo aanvragen", "title": "Plan een persoonlijke demo", "subtitle": "We laten live zien hoe Mister Chameleon werkt, met je eigen website als voorbeeld.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Demo aanvragen", "title": "Plan een persoonlijke demo", "subtitle": "We laten live zien hoe Mister Chameleon werkt, met je eigen website als voorbeeld.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('conversion_signup', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'conversion_signup'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'conversion_signup'), '{}'::jsonb)
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Maak je account aan en verken het platform. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Maak je account aan en verken het platform. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_careers_apply', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_careers_apply'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_careers_apply'), '{}'::jsonb)
          || $mc${"tag": "Solliciteer nu", "title": "Solliciteren kost vijf minuten", "subtitle": "Solliciteer via ons formulier. We nemen persoonlijk contact met je op.", "ctas": [{"label": "Solliciteer direct", "href": "/werken-bij"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Solliciteer nu", "title": "Solliciteren kost vijf minuten", "subtitle": "Solliciteer via ons formulier. We nemen persoonlijk contact met je op.", "ctas": [{"label": "Solliciteer direct", "href": "/werken-bij"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_careers_browse', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_careers_browse'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_careers_browse'), '{}'::jsonb)
          || $mc${"tag": "Vacatures", "title": "Vind een rol die bij je past", "subtitle": "Bekijk alle vacatures.", "ctas": [{"label": "Bekijk vacatures", "href": "/werken-bij"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Vacatures", "title": "Vind een rol die bij je past", "subtitle": "Bekijk alle vacatures.", "ctas": [{"label": "Bekijk vacatures", "href": "/werken-bij"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_demo', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_demo'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_demo'), '{}'::jsonb)
          || $mc${"tag": "Demo", "title": "Bekijk een demo op je eigen website", "subtitle": "In dertig minuten laten we zien hoe personalisatie er voor jouw bezoekers uitziet. Gratis en zonder verplichting.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Demo", "title": "Bekijk een demo op je eigen website", "subtitle": "In dertig minuten laten we zien hoe personalisatie er voor jouw bezoekers uitziet. Gratis en zonder verplichting.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_expansion', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_expansion'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_expansion'), '{}'::jsonb)
          || $mc${"tag": "Meer mogelijkheden", "title": "Haal meer uit je pakket", "subtitle": "Meer bezoeken, AI of meerdere sites. Bekijk welk pakket bij je groei past.", "ctas": [{"label": "Bekijk de pakketten", "href": "/prijzen"}, {"label": "Neem contact op", "href": "/contact"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Meer mogelijkheden", "title": "Haal meer uit je pakket", "subtitle": "Meer bezoeken, AI of meerdere sites. Bekijk welk pakket bij je groei past.", "ctas": [{"label": "Bekijk de pakketten", "href": "/prijzen"}, {"label": "Neem contact op", "href": "/contact"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_guide', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_guide'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_guide'), '{}'::jsonb)
          || $mc${"tag": "Kennisbank", "title": "Lees hoe je het aanpakt", "subtitle": "In de kennisbank lees je stap voor stap hoe je je website aanpast op verschillende bezoekers.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Kennisbank", "title": "Lees hoe je het aanpakt", "subtitle": "In de kennisbank lees je stap voor stap hoe je je website aanpast op verschillende bezoekers.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_meeting', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_meeting'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_meeting'), '{}'::jsonb)
          || $mc${"tag": "Demo", "title": "Plan een demo van dertig minuten", "subtitle": "Kijk live hoe Mister Chameleon werkt, met je eigen website als voorbeeld.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Neem contact op", "href": "/contact"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Demo", "title": "Plan een demo van dertig minuten", "subtitle": "Kijk live hoe Mister Chameleon werkt, met je eigen website als voorbeeld.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Neem contact op", "href": "/contact"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_onboarding', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_onboarding'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_onboarding'), '{}'::jsonb)
          || $mc${"tag": "Aan de slag", "title": "Zet je eerste regel aan", "subtitle": "Volg de stappen en ga live met je eerste regel.", "ctas": [{"label": "Naar je account", "href": "/admin"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Aan de slag", "title": "Zet je eerste regel aan", "subtitle": "Volg de stappen en ga live met je eerste regel.", "ctas": [{"label": "Naar je account", "href": "/admin"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_platform', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_platform'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_platform'), '{}'::jsonb)
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Maak een account aan en verken het platform in je eigen tempo. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Maak een account aan en verken het platform in je eigen tempo. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('cta_saas_demo', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'cta_saas_demo'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'cta_saas_demo'), '{}'::jsonb)
          || $mc${"tag": "Demo", "title": "Plan een productdemo voor je SaaS-team", "subtitle": "We laten live zien hoe het aansluit op je proefperiode, je onboarding en het behoud van klanten.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Demo", "title": "Plan een productdemo voor je SaaS-team", "subtitle": "We laten live zien hoe het aansluit op je proefperiode, je onboarding en het behoud van klanten.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('feature_comparison', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'feature_comparison'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'feature_comparison'), '{}'::jsonb)
          || $mc${"tag": "Pakketten", "title": "Kies het pakket dat bij je groei past", "subtitle": "Drie pakketten naast elkaar. De prijzen staan gewoon op de site.", "ctas": [], "items": [{"title": "Starter", "body": "25.000 gepersonaliseerde bezoeken per maand. Onbeperkt regels, doelgroepen en A/B-tests. Om mee te beginnen.", "cta": "Kies Starter", "ctaHref": "/prijzen"}, {"title": "Growth", "body": "150.000 bezoeken per maand. Met AI, bedrijven herkennen en het volledige dashboard.", "cta": "Kies Growth", "ctaHref": "/prijzen"}, {"title": "Pro", "body": "500.000 bezoeken per maand. Meerdere sites in één omgeving en voorrang bij support.", "cta": "Kies Pro", "ctaHref": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Pakketten", "title": "Kies het pakket dat bij je groei past", "subtitle": "Drie pakketten naast elkaar. De prijzen staan gewoon op de site.", "ctas": [], "items": [{"title": "Starter", "body": "25.000 gepersonaliseerde bezoeken per maand. Onbeperkt regels, doelgroepen en A/B-tests. Om mee te beginnen.", "cta": "Kies Starter", "ctaHref": "/prijzen"}, {"title": "Growth", "body": "150.000 bezoeken per maand. Met AI, bedrijven herkennen en het volledige dashboard.", "cta": "Kies Growth", "ctaHref": "/prijzen"}, {"title": "Pro", "body": "500.000 bezoeken per maand. Meerdere sites in één omgeving en voorrang bij support.", "cta": "Kies Pro", "ctaHref": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('feature_grid_primary', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'feature_grid_primary'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'feature_grid_primary'), '{}'::jsonb)
          || $mc${"tag": "Functies", "title": "Alles wat je nodig hebt voor personalisatie", "subtitle": "Van doelgroepen tot versies beheren. Alle functies in één platform.", "ctas": [], "items": [{"title": "Doelgroepen", "body": "Deel elke bezoeker in op bron, gedrag en apparaat. Zonder dat hij hoeft in te loggen.", "cta": "Meer over de functies", "ctaHref": "/functies"}, {"title": "Versies zonder code", "body": "Maak versies van je kop, je bewijs en je knop zonder code. Je hebt er geen developer voor nodig.", "cta": "Bekijk hoe het werkt", "ctaHref": "/hoe-het-werkt"}, {"title": "Koppelingen", "body": "Koppel Mister Chameleon aan je CRM en je statistiek. Gegevens gaan vanzelf heen en weer.", "cta": "Meer over integraties", "ctaHref": "/integraties"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Functies", "title": "Alles wat je nodig hebt voor personalisatie", "subtitle": "Van doelgroepen tot versies beheren. Alle functies in één platform.", "ctas": [], "items": [{"title": "Doelgroepen", "body": "Deel elke bezoeker in op bron, gedrag en apparaat. Zonder dat hij hoeft in te loggen.", "cta": "Meer over de functies", "ctaHref": "/functies"}, {"title": "Versies zonder code", "body": "Maak versies van je kop, je bewijs en je knop zonder code. Je hebt er geen developer voor nodig.", "cta": "Bekijk hoe het werkt", "ctaHref": "/hoe-het-werkt"}, {"title": "Koppelingen", "body": "Koppel Mister Chameleon aan je CRM en je statistiek. Gegevens gaan vanzelf heen en weer.", "cta": "Meer over integraties", "ctaHref": "/integraties"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('feature_highlights', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'feature_highlights'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'feature_highlights'), '{}'::jsonb)
          || $mc${"tag": "Functies", "title": "De functies die het verschil maken", "subtitle": "De belangrijkste functies van Mister Chameleon op een rij.", "ctas": [], "items": [{"title": "Regels zonder code", "body": "Bepaal zelf wanneer welke versie getoond wordt. Van een simpele regel op bron tot een regel op gedrag."}, {"title": "A/B-testen", "body": "Zet twee versies tegen elkaar. In je dashboard zie je per versie wat hij opleverde."}, {"title": "Resultaat per versie", "body": "Zie per versie hoeveel bezoekers hem zagen en hoeveel er een aanvraag deden."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Functies", "title": "De functies die het verschil maken", "subtitle": "De belangrijkste functies van Mister Chameleon op een rij.", "ctas": [], "items": [{"title": "Regels zonder code", "body": "Bepaal zelf wanneer welke versie getoond wordt. Van een simpele regel op bron tot een regel op gedrag."}, {"title": "A/B-testen", "body": "Zet twee versies tegen elkaar. In je dashboard zie je per versie wat hij opleverde."}, {"title": "Resultaat per versie", "body": "Zie per versie hoeveel bezoekers hem zagen en hoeveel er een aanvraag deden."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_careers_high_intent', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_careers_high_intent'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_careers_high_intent'), '{}'::jsonb)
          || $mc${"tag": "Solliciteer nu", "title": "Wij zoeken jou. Solliciteer vandaag", "subtitle": "Jij bent er klaar voor en wij ook. Stuur je cv, dan nemen we contact met je op.", "ctas": [{"label": "Direct solliciteren", "href": "/werken-bij"}, {"label": "Stel een vraag", "href": "/contact"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Solliciteer nu", "title": "Wij zoeken jou. Solliciteer vandaag", "subtitle": "Jij bent er klaar voor en wij ook. Stuur je cv, dan nemen we contact met je op.", "ctas": [{"label": "Direct solliciteren", "href": "/werken-bij"}, {"label": "Stel een vraag", "href": "/contact"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_careers_job_match', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_careers_job_match'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_careers_job_match'), '{}'::jsonb)
          || $mc${"tag": "Vacature voor jou", "title": "Er staat een rol klaar die bij je past", "subtitle": "We hebben vacatures die goed bij je aansluiten. Bekijk ze hieronder.", "ctas": [{"label": "Bekijk vacatures", "href": "/werken-bij"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Vacature voor jou", "title": "Er staat een rol klaar die bij je past", "subtitle": "We hebben vacatures die goed bij je aansluiten. Bekijk ze hieronder.", "ctas": [{"label": "Bekijk vacatures", "href": "/werken-bij"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_consideration', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_consideration'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_consideration'), '{}'::jsonb)
          || $mc${"tag": "Waarom Mister Chameleon?", "title": "Vergelijk en kies de aanpak die bij je past", "subtitle": "Je bent aan het vergelijken. We helpen je met voorbeelden, prijzen en de vragen die anderen stelden.", "ctas": [{"label": "Vergelijk de pakketten", "href": "/prijzen"}, {"label": "Bekijk de voorbeelden", "href": "/cases"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Waarom Mister Chameleon?", "title": "Vergelijk en kies de aanpak die bij je past", "subtitle": "Je bent aan het vergelijken. We helpen je met voorbeelden, prijzen en de vragen die anderen stelden.", "ctas": [{"label": "Vergelijk de pakketten", "href": "/prijzen"}, {"label": "Bekijk de voorbeelden", "href": "/cases"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_direct_brand', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_direct_brand'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_direct_brand'), '{}'::jsonb)
          || $mc${"tag": "Welkom bij Mister Chameleon", "title": "Website personalisatie voor B2B", "subtitle": "Je kent ons al. Kijk hoe je je website per bezoeker laat kloppen, en hoe je morgen kunt beginnen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}, {"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Welkom bij Mister Chameleon", "title": "Website personalisatie voor B2B", "subtitle": "Je kent ons al. Kijk hoe je je website per bezoeker laat kloppen, en hoe je morgen kunt beginnen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}, {"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_google_problem', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_google_problem'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_google_problem'), '{}'::jsonb)
          || $mc${"tag": "Gevonden via Google", "title": "Stop met één boodschap voor iedereen", "subtitle": "De meeste B2B-websites tonen elke bezoeker hetzelfde verhaal. Mister Chameleon laat elke bezoeker zien wat bij hem past.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Gevonden via Google", "title": "Stop met één boodschap voor iedereen", "subtitle": "De meeste B2B-websites tonen elke bezoeker hetzelfde verhaal. Mister Chameleon laat elke bezoeker zien wat bij hem past.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_intent_direct', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_intent_direct'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_intent_direct'), '{}'::jsonb)
          || $mc${"tag": "Klaar om te starten?", "title": "Start vandaag met website personalisatie", "subtitle": "Je weet wat je wilt. Plan een demo, dan laten we zien hoe je begint.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Klaar om te starten?", "title": "Start vandaag met website personalisatie", "subtitle": "Je weet wat je wilt. Plan een demo, dan laten we zien hoe je begint.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_linkedin_vision', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_linkedin_vision'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_linkedin_vision'), '{}'::jsonb)
          || $mc${"tag": "Voor B2B-marketing", "title": "Een website die meegroeit met je doelgroep", "subtitle": "Wie via LinkedIn binnenkomt, verwacht een verhaal dat bij zijn vak past. Laat het verhaal zien dat aansluit op zijn branche.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk de voorbeelden", "href": "/cases"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor B2B-marketing", "title": "Een website die meegroeit met je doelgroep", "subtitle": "Wie via LinkedIn binnenkomt, verwacht een verhaal dat bij zijn vak past. Laat het verhaal zien dat aansluit op zijn branche.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk de voorbeelden", "href": "/cases"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_saas_default', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'hero_saas_default'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'hero_saas_default'), '{}'::jsonb)
          || $mc${"tag": "Voor SaaS", "title": "Laat elke bezoeker van je SaaS-site zien wat bij hem past", "subtitle": "Van het eerste bezoek tot een bestaande klant. Elke bezoeker ziet een verhaal dat bij zijn situatie past.", "ctas": [{"label": "Bekijk de voorbeelden", "href": "/cases"}, {"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor SaaS", "title": "Laat elke bezoeker van je SaaS-site zien wat bij hem past", "subtitle": "Van het eerste bezoek tot een bestaande klant. Elke bezoeker ziet een verhaal dat bij zijn situatie past.", "ctas": [{"label": "Bekijk de voorbeelden", "href": "/cases"}, {"label": "Probeer 14 dagen gratis", "href": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('notification_default', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'notification_default'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'notification_default'), '{}'::jsonb)
          || $mc${"tag": "Nieuw", "title": "Nieuw in de kennisbank", "subtitle": "Praktische artikelen over personalisatie voor B2B.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Nieuw", "title": "Nieuw in de kennisbank", "subtitle": "Praktische artikelen over personalisatie voor B2B.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('notification_offer', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'notification_offer'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'notification_offer'), '{}'::jsonb)
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Je betaalt pas na 14 dagen.", "ctas": [{"label": "Bekijk de pakketten", "href": "/prijzen"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen gratis", "subtitle": "Je betaalt pas na 14 dagen.", "ctas": [{"label": "Bekijk de pakketten", "href": "/prijzen"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('notification_returning', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'notification_returning'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'notification_returning'), '{}'::jsonb)
          || $mc${"tag": "Welkom terug", "title": "Fijn dat je er weer bent", "subtitle": "Er staan nieuwe artikelen in de kennisbank.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Welkom terug", "title": "Fijn dat je er weer bent", "subtitle": "Er staan nieuwe artikelen in de kennisbank.", "ctas": [{"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('notification_urgency', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'notification_urgency'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'notification_urgency'), '{}'::jsonb)
          || $mc${"tag": "Demo", "title": "Hulp nodig bij de start?", "subtitle": "Plan een demo. We laten zien hoe je begint.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Demo", "title": "Hulp nodig bij de start?", "subtitle": "Plan een demo. We laten zien hoe je begint.", "ctas": [{"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_careers_default', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_careers_default'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_careers_default'), '{}'::jsonb)
          || $mc${"tag": "Werken bij ons", "title": "Een bedrijf dat groeit en jou laat meegroeien", "subtitle": "Een klein team, ruimte om te leren en werk dat ertoe doet.", "ctas": [], "items": [{"title": "Klein team", "text": "Korte lijnen. Je werkt direct samen met de mensen die het platform bouwen."}, {"title": "Ruimte om te leren", "text": "Je krijgt tijd om je te ontwikkelen, en collega's die je verder helpen."}, {"title": "Meteen echt werk", "text": "Je werkt vanaf het begin aan het product, voor echte klanten."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Werken bij ons", "title": "Een bedrijf dat groeit en jou laat meegroeien", "subtitle": "Een klein team, ruimte om te leren en werk dat ertoe doet.", "ctas": [], "items": [{"title": "Klein team", "text": "Korte lijnen. Je werkt direct samen met de mensen die het platform bouwen."}, {"title": "Ruimte om te leren", "text": "Je krijgt tijd om je te ontwikkelen, en collega's die je verder helpen."}, {"title": "Meteen echt werk", "text": "Je werkt vanaf het begin aan het product, voor echte klanten."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_careers_team', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_careers_team'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_careers_team'), '{}'::jsonb)
          || $mc${"tag": "Het team", "title": "Collega's die net als jij zijn begonnen", "subtitle": "Lees de verhalen van collega's en wat hen bindt aan Mister Chameleon.", "ctas": [], "items": [{"title": "Groeien op je werk", "text": "Je krijgt verantwoordelijkheid zodra je die aankunt. Zonder politiek."}, {"title": "Verschillende achtergronden", "text": "We komen uit verschillende vakgebieden. Dat maakt het product beter."}, {"title": "Eerlijke verhalen", "text": "Collega's vertellen wat ze fijn vinden, en ook wat beter kan."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Het team", "title": "Collega's die net als jij zijn begonnen", "subtitle": "Lees de verhalen van collega's en wat hen bindt aan Mister Chameleon.", "ctas": [], "items": [{"title": "Groeien op je werk", "text": "Je krijgt verantwoordelijkheid zodra je die aankunt. Zonder politiek."}, {"title": "Verschillende achtergronden", "text": "We komen uit verschillende vakgebieden. Dat maakt het product beter."}, {"title": "Eerlijke verhalen", "text": "Collega's vertellen wat ze fijn vinden, en ook wat beter kan."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_cases', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_cases'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_cases'), '{}'::jsonb)
          || $mc${"tag": "Uit de praktijk", "title": "Hoe anderen het aanpakken", "subtitle": "Wat personalisatie oplevert hangt af van wie er binnenkomt en wat je ze te vertellen hebt. Dit zijn de patronen die we terugzien.", "ctas": [], "items": [{"title": "Beginnen bij de kop", "text": "Eén blok, drie doelgroepen. Daar is het verschil het grootst en het werk het kleinst. Bijna iedereen begint daar."}, {"title": "Herkennen op bedrijfsniveau", "text": "Bij account based marketing telt het bedrijf, niet de persoon. Welk bedrijf zit achter het bezoek, en wat weet je CRM daar al van?"}, {"title": "Meten met de controlegroep", "text": "Zonder controlegroep weet je alleen dat er iets veranderde, niet of het hielp. Daarom staat die standaard aan."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Uit de praktijk", "title": "Hoe anderen het aanpakken", "subtitle": "Wat personalisatie oplevert hangt af van wie er binnenkomt en wat je ze te vertellen hebt. Dit zijn de patronen die we terugzien.", "ctas": [], "items": [{"title": "Beginnen bij de kop", "text": "Eén blok, drie doelgroepen. Daar is het verschil het grootst en het werk het kleinst. Bijna iedereen begint daar."}, {"title": "Herkennen op bedrijfsniveau", "text": "Bij account based marketing telt het bedrijf, niet de persoon. Welk bedrijf zit achter het bezoek, en wat weet je CRM daar al van?"}, {"title": "Meten met de controlegroep", "text": "Zonder controlegroep weet je alleen dat er iets veranderde, niet of het hielp. Daarom staat die standaard aan."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_platform', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_platform'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_platform'), '{}'::jsonb)
          || $mc${"tag": "Zo werkt het", "title": "Je bezoeker merkt er niets van", "subtitle": "De beslissing valt op de server, voordat de pagina wordt verstuurd. Je bezoeker ziet nooit eerst iets anders.", "ctas": [], "items": [{"title": "Geen flikkering", "text": "Personalisatie in de browser toont eerst de gewone pagina en verbouwt die daarna. Hier ziet je bezoeker alleen het eindresultaat."}, {"title": "Geen extra laadtijd", "text": "Er komt geen script bij dat op een beslissing moet wachten. Zoekmachines zien een gewone, snelle pagina."}, {"title": "Netjes met privacy", "text": "De basis werkt zonder cookies en bouwt geen profiel op. Bewaartermijnen en verwijderverzoeken zitten in het product."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Zo werkt het", "title": "Je bezoeker merkt er niets van", "subtitle": "De beslissing valt op de server, voordat de pagina wordt verstuurd. Je bezoeker ziet nooit eerst iets anders.", "ctas": [], "items": [{"title": "Geen flikkering", "text": "Personalisatie in de browser toont eerst de gewone pagina en verbouwt die daarna. Hier ziet je bezoeker alleen het eindresultaat."}, {"title": "Geen extra laadtijd", "text": "Er komt geen script bij dat op een beslissing moet wachten. Zoekmachines zien een gewone, snelle pagina."}, {"title": "Netjes met privacy", "text": "De basis werkt zonder cookies en bouwt geen profiel op. Bewaartermijnen en verwijderverzoeken zitten in het product."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_reassurance', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_reassurance'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_reassurance'), '{}'::jsonb)
          || $mc${"tag": "Geen verrassingen", "title": "Personalisatie die je altijd onder controle houdt", "subtitle": "Jij bepaalt de regels en keurt de content goed. Wij zorgen voor de techniek. Je ziet altijd wat er gebeurt.", "ctas": [], "items": [{"title": "Jij beheert de regels", "text": "Bepaal zelf wanneer welke versie getoond wordt. Je hebt er geen bureau of developer voor nodig."}, {"title": "Alles is terug te vinden", "text": "Je ziet welke versie wanneer aan wie getoond is."}, {"title": "Altijd terug te draaien", "text": "Zet een versie met één klik uit. Je gewone pagina staat er dan meteen weer."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Geen verrassingen", "title": "Personalisatie die je altijd onder controle houdt", "subtitle": "Jij bepaalt de regels en keurt de content goed. Wij zorgen voor de techniek. Je ziet altijd wat er gebeurt.", "ctas": [], "items": [{"title": "Jij beheert de regels", "text": "Bepaal zelf wanneer welke versie getoond wordt. Je hebt er geen bureau of developer voor nodig."}, {"title": "Alles is terug te vinden", "text": "Je ziet welke versie wanneer aan wie getoond is."}, {"title": "Altijd terug te draaien", "text": "Zet een versie met één klik uit. Je gewone pagina staat er dan meteen weer."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_saas_default', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_saas_default'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_saas_default'), '{}'::jsonb)
          || $mc${"tag": "Voor SaaS", "title": "Laat elke bezoeker van je SaaS-site de juiste boodschap zien", "subtitle": "Wie via een vergelijkingssite komt, zoekt iets anders dan wie je naam intypt. Je site sluit daarop aan.", "ctas": [], "items": [{"title": "Aansluiten op de bron", "text": "Stem je kop af op het kanaal waar iemand vandaan komt."}, {"title": "Minder zoeken", "text": "Wie een verhaal ziet dat bij hem past, hoeft minder te zoeken."}, {"title": "Meten wat het doet", "text": "Een controlegroep laat zien wat de aanpassing opleverde."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor SaaS", "title": "Laat elke bezoeker van je SaaS-site de juiste boodschap zien", "subtitle": "Wie via een vergelijkingssite komt, zoekt iets anders dan wie je naam intypt. Je site sluit daarop aan.", "ctas": [], "items": [{"title": "Aansluiten op de bron", "text": "Stem je kop af op het kanaal waar iemand vandaan komt."}, {"title": "Minder zoeken", "text": "Wie een verhaal ziet dat bij hem past, hoeft minder te zoeken."}, {"title": "Meten wat het doet", "text": "Een controlegroep laat zien wat de aanpassing opleverde."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_stats', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_stats'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_stats'), '{}'::jsonb)
          || $mc${"tag": "Wat je gaat meten", "title": "Cijfers uit je eigen site, niet uit een brochure", "subtitle": "Wij zetten hier geen gemiddelden neer die je toch niet kunt narekenen. Dit is wat je vanaf dag één zelf meet.", "ctas": [], "items": [{"title": "Lift ten opzichte van de controlegroep", "text": "Het verschil tussen bezoekers die de aangepaste site zagen en die de gewone site zagen. Dat is je werkelijke opbrengst."}, {"title": "Conversie per doelgroep", "text": "Per bron, per segment, per variant. Zo zie je niet alleen dát het werkt, maar voor wie."}, {"title": "Wat er níét werkte", "text": "Varianten die onder de controlegroep presteren zie je net zo goed. Dat is de helft van de waarde."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Wat je gaat meten", "title": "Cijfers uit je eigen site, niet uit een brochure", "subtitle": "Wij zetten hier geen gemiddelden neer die je toch niet kunt narekenen. Dit is wat je vanaf dag één zelf meet.", "ctas": [], "items": [{"title": "Lift ten opzichte van de controlegroep", "text": "Het verschil tussen bezoekers die de aangepaste site zagen en die de gewone site zagen. Dat is je werkelijke opbrengst."}, {"title": "Conversie per doelgroep", "text": "Per bron, per segment, per variant. Zo zie je niet alleen dát het werkt, maar voor wie."}, {"title": "Wat er níét werkte", "text": "Varianten die onder de controlegroep presteren zie je net zo goed. Dat is de helft van de waarde."}]}$mc$::jsonb,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('proof_vision', 'statamic',
        (select label from adaptive_blocks where tenant_id is null and key = 'proof_vision'), true,
        coalesce((select default_variant from adaptive_blocks where tenant_id is null and key = 'proof_vision'), '{}'::jsonb)
          || $mc${"tag": "Waarom nu wel", "title": "De personalisatielaag die B2B-marketing miste", "subtitle": "Relevanter worden zonder cookies van derden en zonder IT-traject. Dat kon lang niet.", "ctas": [], "items": [{"title": "Werkt zonder cookies", "text": "De basis werkt op de bron van het bezoek, het apparaat en het tijdstip. Daar zijn geen cookies voor nodig."}, {"title": "Geen IT-traject", "text": "Marketeers beheren de regels zelf. De koppeling zet je één keer neer."}, {"title": "Naast wat je al hebt", "text": "Je CMS blijft je CMS en je CRM blijft je CRM. Wij vervangen niets. We bewegen mee met wat er al staat."}]}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Waarom nu wel", "title": "De personalisatielaag die B2B-marketing miste", "subtitle": "Relevanter worden zonder cookies van derden en zonder IT-traject. Dat kon lang niet.", "ctas": [], "items": [{"title": "Werkt zonder cookies", "text": "De basis werkt op de bron van het bezoek, het apparaat en het tijdstip. Daar zijn geen cookies voor nodig."}, {"title": "Geen IT-traject", "text": "Marketeers beheren de regels zelf. De koppeling zet je één keer neer."}, {"title": "Naast wat je al hebt", "text": "Je CMS blijft je CMS en je CRM blijft je CRM. Wij vervangen niets. We bewegen mee met wat er al staat."}]}$mc$::jsonb,
       updated_at = now();

commit;

-- Controle 1: geen eigen rij meer in u-vorm. Dit moet 0 geven.
select count(*) as nog_in_u_vorm
  from adaptive_blocks
 where tenant_id = 'statamic'
   and (default_variant - 'decisionMeta')::text ~ '\m(uw|Uw|u|U)\M';

-- Controle 2: het aantal eigen rijen. Dit moet 46 geven: de 35 van hierboven,
-- de acht koppen per pagina en de drie blokken van de homepage.
select count(*) as eigen_rijen from adaptive_blocks where tenant_id = 'statamic';
