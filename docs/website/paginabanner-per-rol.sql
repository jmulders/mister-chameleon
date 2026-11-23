-- De paginabanner van vijf pagina's krijgt per demorol een eigen intro.
--
-- Wie in Scenario Control een rol kiest, zag alleen de homepage veranderen. De
-- pagina's Functies, Hoe het werkt, Integraties, Toepassingen en Kennisbank
-- houden hun eigen titel. Onder die titel staat nu per rol een eigen label en
-- een eigen intro, soms met een eigen knop. Een bezoeker zonder rol ziet wat
-- hij altijd zag.
--
-- Elke versie staat in het blok van de pagina zelf, onder de bannersleutel van
-- de rol (hero_role_marketeer, hero_role_bureau, hero_role_technisch). Beeld en
-- opmaak neemt hij over van de gewone versie. Twee keer draaien kan geen kwaad.
--
-- Eerst moet de platformversie live zijn die een pagina een versie van haar
-- eigen banner laat kiezen. Daarvoor doet dit niets, ook geen kwaad.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

update adaptive_blocks
set adaptive_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(adaptive_variants) v
      where v->>'variantKey' not in ('hero_role_marketeer', 'hero_role_bureau', 'hero_role_technisch')), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('variantKey', 'hero_role_marketeer', 'label', 'Rol Marketeer',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor marketeers", "subtitle": "Alles wat je als marketeer zelf instelt. Regels met keuzelijsten, A/B-testen en meten met een controlegroep. Zonder developer."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_bureau', 'label', 'Rol Bureau',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor bureaus", "subtitle": "Alles wat je voor je klanten inzet. In het pakket Pro beheer je hun sites vanuit één omgeving, elk met eigen regels en cijfers.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/cases/klantsites-in-een-omgeving", "label": "Lees de toepassing", "variant": "secondary"}]}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_technisch', 'label', 'Rol Technisch',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor developers", "subtitle": "Wat het platform doet en wat jij ervoor koppelt. De regels klikt marketing daarna zelf bij elkaar, zonder code.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/integraties", "label": "Bekijk de integraties", "variant": "secondary"}]}'::jsonb)),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_page_functies';

update adaptive_blocks
set adaptive_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(adaptive_variants) v
      where v->>'variantKey' not in ('hero_role_marketeer', 'hero_role_bureau', 'hero_role_technisch')), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('variantKey', 'hero_role_marketeer', 'label', 'Rol Marketeer',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor marketeers", "subtitle": "Je site blijft je site. Bij elk bezoek kiest Mister Chameleon welke versie van je pagina past bij de campagne en de bezoeker. Jij bepaalt de regels."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_bureau', 'label', 'Rol Bureau',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor bureaus", "subtitle": "De site van je klant blijft zoals hij is. Bij elk bezoek kiest Mister Chameleon welke versie de bezoeker ziet. Jij stelt per klant de regels in.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/cases/klantsites-in-een-omgeving", "label": "Lees de toepassing", "variant": "secondary"}]}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_technisch', 'label', 'Rol Technisch',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor developers", "subtitle": "Je site blijft je site. Je voegt één koppeling toe en wijst aan welke plekken per doelgroep mogen verschillen. De rest regelt het platform.", "ctas": [{"href": "/demo", "label": "Plan een demo", "variant": "primary"}, {"href": "/integraties", "label": "Bekijk de integraties", "variant": "secondary"}]}'::jsonb)),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_page_hoe_het_werkt';

update adaptive_blocks
set adaptive_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(adaptive_variants) v
      where v->>'variantKey' not in ('hero_role_marketeer', 'hero_role_bureau', 'hero_role_technisch')), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('variantKey', 'hero_role_marketeer', 'label', 'Rol Marketeer',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor marketeers", "subtitle": "Mister Chameleon werkt op de site die je al hebt. De koppeling zet je één keer neer. Daarna beheer je de regels zelf."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_bureau', 'label', 'Rol Bureau',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor bureaus", "subtitle": "Het werkt op de sites die je klanten al hebben. Statamic, WordPress of elk ander CMS. Je hoeft geen site opnieuw te bouwen."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_technisch', 'label', 'Rol Technisch',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor developers", "subtitle": "Een add-on voor Statamic, een plugin voor WordPress of één regel code. Kies de koppeling van jouw CMS en volg de drie stappen."}'::jsonb)),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_page_integraties';

update adaptive_blocks
set adaptive_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(adaptive_variants) v
      where v->>'variantKey' not in ('hero_role_marketeer', 'hero_role_bureau', 'hero_role_technisch')), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('variantKey', 'hero_role_marketeer', 'label', 'Rol Marketeer',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor marketeers", "subtitle": "Drie manieren waarop teams Mister Chameleon gebruiken. Begin bij drie titels voor drie doelgroepen, of bij testen zonder developer."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_bureau', 'label', 'Rol Bureau',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor bureaus", "subtitle": "Drie manieren waarop teams Mister Chameleon gebruiken. Voor bureaus is er een eigen toepassing over alle klantsites in één omgeving.", "ctas": [{"href": "/cases/klantsites-in-een-omgeving", "label": "Lees de toepassing", "variant": "primary"}]}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_technisch', 'label', 'Rol Technisch',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor developers", "subtitle": "Drie manieren waarop teams Mister Chameleon gebruiken. Bij elke toepassing staat wat je aanpast en wat je ervoor nodig hebt."}'::jsonb)),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_page_cases';

update adaptive_blocks
set adaptive_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(adaptive_variants) v
      where v->>'variantKey' not in ('hero_role_marketeer', 'hero_role_bureau', 'hero_role_technisch')), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('variantKey', 'hero_role_marketeer', 'label', 'Rol Marketeer',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor marketeers", "subtitle": "Praktische artikelen voor marketeers. Over meten met een controlegroep, retargeting op echte aanvragen en account based marketing."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_bureau', 'label', 'Rol Bureau',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor bureaus", "subtitle": "Praktische artikelen over personalisatie, A/B-testen en account based marketing voor B2B. Ook handig om met je klanten te delen."}'::jsonb),
      jsonb_build_object('variantKey', 'hero_role_technisch', 'label', 'Rol Technisch',
        'content', (default_variant - 'decisionMeta') || '{"tag": "Voor developers", "subtitle": "Praktische artikelen over personalisatie. Ook over de technische kant, zoals dataverrijking en personaliseren zonder cookietoestemming."}'::jsonb)),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_page_kennisbank';

commit;
