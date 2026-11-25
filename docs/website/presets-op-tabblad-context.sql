-- Negen presets op het tabblad Context van Scenario Control, in de volgorde van een klantreis.
--
-- Op het tabblad Context stonden twee presets. Dit worden er negen, met een
-- Nederlandse naam, en elk laat op de site een eigen banner zien:
--
--   Eerste bezoek            Begin morgen al
--   Via LinkedIn             Na de klik gaat het mis
--   Vergelijkt               Vergelijk en kies
--   Bekeek de prijzen        14 dagen gratis
--   Klaar om te starten      Start vandaag
--   Formulier niet afgemaakt Twijfel je nog?
--   Aanvraag gedaan          Aanvraag ontvangen
--   Komt terug               Fijn je weer te zien
--   Nieuwe klant             Welkom aan boord
--
-- De presets zelf zitten in het platform. Dit kiest welke je toont, geeft ze een
-- naam en stelt bij vier presets de nagebootste signalen bij, omdat ze met de
-- regels van deze site anders op dezelfde banner uitkwamen als een ander preset.
-- Elke combinatie is op de live regels nagebootst voordat dit is geschreven.
--
-- Een preset voor een bezoek via Google ontbreekt met opzet: de regel voor een
-- Google-campagne stuurt een melding naar buiten.
--
-- "Nieuwe klant" had nog geen eigen banner. Zo'n bezoeker kreeg de
-- standaardtekst van het platform, in de u-vorm. Dit voegt de banner toe.
--
-- Twee keer draaien kan geen kwaad. Zichtbaar binnen twee minuten.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_customer_onboarding', 'statamic', 'Nieuwe klant', true,
        '{"tag": "Voor klanten", "title": "Welkom aan boord", "subtitle": "Volg de stappen en ga live met je eerste regel. Loop je ergens vast? Stel je vraag, je krijgt binnen één werkdag antwoord.", "ctas": [{"label": "Naar je account", "href": "/admin"}, {"label": "Stel een vraag", "href": "/contact"}], "contentAlign": "center", "layoutVariant": "hero_default"}'::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant, label = excluded.label, is_active = true, updated_at = now();

update tenant_settings
set settings = settings
      || jsonb_build_object(
           'scenarioOverrides', coalesce(settings->'scenarioOverrides', '{}'::jsonb)
             || '{"new_visitor": {"label": "Eerste bezoek"}, "enterprise_prospect": {"label": "Via LinkedIn", "icon": "💼", "overrides": {"visitType": "new", "pageViewCount": 1, "funnelStage": "awareness", "interestConfidence": 0, "hasVisitedAbout": false, "hasVisitedCases": false}}, "consideration": {"label": "Vergelijkt"}, "trial_ready": {"label": "Bekeek de prijzen"}, "high_intent": {"label": "Klaar om te starten"}, "form_dropoff": {"label": "Formulier niet afgemaakt", "overrides": {"funnelStage": "consideration", "intentScore": 45, "hasVisitedPricing": false}}, "post_conversion": {"label": "Aanvraag gedaan", "overrides": {"isCustomer": false, "funnelStage": "high_intent"}}, "returning_visitor": {"label": "Komt terug", "overrides": {"funnelStage": "awareness", "interestConfidence": 0, "intentScore": 20, "hasVisitedPricing": false}}, "customer_onboarding": {"label": "Nieuwe klant"}}'::jsonb,
           'scenarioPanel', coalesce(settings->'scenarioPanel', '{}'::jsonb)
             || '{"presetKeys": ["new_visitor", "enterprise_prospect", "consideration", "trial_ready", "high_intent", "form_dropoff", "post_conversion", "returning_visitor", "customer_onboarding"]}'::jsonb)
where tenant_id = 'statamic';

commit;
