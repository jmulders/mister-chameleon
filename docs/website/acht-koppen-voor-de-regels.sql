-- Acht koppen die de regels van misterchameleon.nl kiezen, maar die nergens bestonden.
--
-- Acht regels wijzen elk naar een eigen kop. Voor die koppen was geen tekst. Een
-- bezoeker voor wie zo'n regel afging, kreeg daardoor de standaardkop te zien.
-- Dit geeft tenant 'statamic' de acht koppen, in je-vorm.
--
-- Bestaat de rij al, dan verandert alleen de tekst. Beeld, video en opmaak
-- blijven staan. Twee keer draaien kan geen kwaad.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_returning', 'statamic', true,
        $mc${"tag": "Welkom terug", "title": "Fijn dat je er weer bent", "subtitle": "Je was hier al eerder. Bekijk de voorbeelden, of plan een demo als je het op je eigen site wilt zien.", "ctas": [{"label": "Bekijk de voorbeelden", "href": "/cases"}, {"label": "Plan een demo", "href": "/demo"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Welkom terug", "title": "Fijn dat je er weer bent", "subtitle": "Je was hier al eerder. Bekijk de voorbeelden, of plan een demo als je het op je eigen site wilt zien.", "ctas": [{"label": "Bekijk de voorbeelden", "href": "/cases"}, {"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_trial_ready', 'statamic', true,
        $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen op je eigen site", "subtitle": "Je hebt de pakketten gezien. Maak een account aan en zet je eerste regel aan. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}, {"label": "Plan een demo", "href": "/demo"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Proefperiode", "title": "Probeer het 14 dagen op je eigen site", "subtitle": "Je hebt de pakketten gezien. Maak een account aan en zet je eerste regel aan. Je betaalt pas na 14 dagen.", "ctas": [{"label": "Probeer 14 dagen gratis", "href": "/prijzen"}, {"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_enterprise', 'statamic', true,
        $mc${"tag": "Voor grotere organisaties", "title": "Eén website, voor elke doelgroep het juiste verhaal", "subtitle": "Heb je veel soorten bezoekers? Elke groep ziet zijn eigen kop, bewijs en knop. Je beheert nog steeds één site.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor grotere organisaties", "title": "Eén website, voor elke doelgroep het juiste verhaal", "subtitle": "Heb je veel soorten bezoekers? Elke groep ziet zijn eigen kop, bewijs en knop. Je beheert nog steeds één site.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_form_dropoff', 'statamic', true,
        $mc${"tag": "Nog vragen?", "title": "Twijfel je nog? Stel eerst je vraag", "subtitle": "Een vraag stellen verplicht je tot niets. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Plan een demo", "href": "/demo"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Nog vragen?", "title": "Twijfel je nog? Stel eerst je vraag", "subtitle": "Een vraag stellen verplicht je tot niets. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Plan een demo", "href": "/demo"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_customer_expansion', 'statamic', true,
        $mc${"tag": "Voor klanten", "title": "Haal meer uit je site", "subtitle": "Je kijkt naar de pakketten. Vergelijk Starter, Growth en Pro en zie wat een stap omhoog je geeft.", "ctas": [{"label": "Vergelijk de pakketten", "href": "/prijzen"}, {"label": "Stuur een bericht", "href": "/contact"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor klanten", "title": "Haal meer uit je site", "subtitle": "Je kijkt naar de pakketten. Vergelijk Starter, Growth en Pro en zie wat een stap omhoog je geeft.", "ctas": [{"label": "Vergelijk de pakketten", "href": "/prijzen"}, {"label": "Stuur een bericht", "href": "/contact"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_post_conversion', 'statamic', true,
        $mc${"tag": "Bedankt", "title": "Bedankt, je aanvraag is binnen", "subtitle": "Je krijgt binnen één werkdag antwoord. Lees in de tussentijd hoe het werkt.", "ctas": [{"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}, {"label": "Naar de kennisbank", "href": "/kennisbank"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Bedankt", "title": "Bedankt, je aanvraag is binnen", "subtitle": "Je krijgt binnen één werkdag antwoord. Lees in de tussentijd hoe het werkt.", "ctas": [{"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}, {"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_high_friction', 'statamic', true,
        $mc${"tag": "Even vastgelopen?", "title": "Vind je niet wat je zoekt?", "subtitle": "Zeg wat je zoekt, dan wijzen we je de weg. Of lees stap voor stap hoe het werkt.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Even vastgelopen?", "title": "Vind je niet wat je zoekt?", "subtitle": "Zeg wat je zoekt, dan wijzen we je de weg. Of lees stap voor stap hoe het werkt.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Bekijk hoe het werkt", "href": "/hoe-het-werkt"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, is_active, default_variant)
values ('hero_churn_risk', 'statamic', true,
        $mc${"tag": "Voor klanten", "title": "Loopt het niet zoals je wilt?", "subtitle": "Vertel ons waar je tegenaan loopt. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Naar de kennisbank", "href": "/kennisbank"}], "layoutVariant": "hero_default", "contentAlign": "center"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = adaptive_blocks.default_variant
          || $mc${"tag": "Voor klanten", "title": "Loopt het niet zoals je wilt?", "subtitle": "Vertel ons waar je tegenaan loopt. Je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Stuur een bericht", "href": "/contact"}, {"label": "Naar de kennisbank", "href": "/kennisbank"}]}$mc$::jsonb,
       is_active  = true,
       updated_at = now();

commit;
