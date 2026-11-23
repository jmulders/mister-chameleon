-- Adaptive blokken van misterchameleon.nl bijgewerkt naar wat er nu op de site staat.
--
-- Alle 54 blokken van tenant 'statamic' zijn naast de live site gelegd: prijzen,
-- demo, contact, integraties en werken bij. De meeste kloppen. Deze negen niet.
-- Per blok staat erbij wat er mis was. Alleen de genoemde velden veranderen,
-- beeld en opmaak van de rest blijven staan. Twee keer draaien kan geen kwaad.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

-- hero_careers_job_match
-- Belooft vacatures die passen. Op de site staat ook wat je doet als jouw rol er niet bij is.
update adaptive_blocks
set default_variant = jsonb_set(default_variant, '{subtitle}', '"Kijk welke rollen er openstaan. Staat de jouwe er niet bij? Mail ons dan toch."'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_careers_job_match';

-- hero_careers_high_intent
-- Eigen beeld, zodat de banner zichtbaar wisselt ten opzichte van de standaardbanner.
update adaptive_blocks
set default_variant = jsonb_set(default_variant, '{media,url}', '"https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-streep-2.svg"'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_careers_high_intent';

-- cta_careers_apply
-- Noemde een sollicitatieformulier en vijf minuten. De site heeft geen formulier, je reageert met een bericht.
update adaptive_blocks
set default_variant = jsonb_set(jsonb_set(jsonb_set(default_variant, '{title}', '"Stuur ons een bericht"'::jsonb), '{subtitle}', '"Vertel wie je bent en wat je zoekt. We nemen persoonlijk contact met je op."'::jsonb), '{ctas}', '[{"label": "Neem contact op", "href": "/contact"}]'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'cta_careers_apply';

-- proof_careers_default
-- Beloofde groei en tijd om te leren. Nu wat op de pagina Werken bij staat.
update adaptive_blocks
set default_variant = jsonb_set(jsonb_set(jsonb_set(jsonb_set(default_variant, '{title}', '"Werk dat je terugziet bij klanten"'::jsonb), '{subtitle}', '"Een klein team en werk dat ertoe doet."'::jsonb), '{items,1,title}', '"Eigenaarschap"'::jsonb), '{items,1,text}', '"Je bouwt een nieuw soort regel of je schrijft de uitleg bij een koppeling. Kort daarna gebruikt een klant het op zijn eigen site."'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'proof_careers_default';

-- proof_careers_team
-- Verwees naar verhalen van collega's die niet op de site staan.
update adaptive_blocks
set default_variant = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(default_variant, '{title}', '"Klein team, veel eigenaarschap"'::jsonb), '{subtitle}', '"Je werkt in een klein team en je ziet je werk terug bij klanten."'::jsonb), '{items,0,title}', '"Korte lijnen"'::jsonb), '{items,0,text}', '"Je werkt direct samen met de mensen die het platform bouwen."'::jsonb), '{items,1,title}', '"Je hoort het zelf"'::jsonb), '{items,1,text}', '"Je hoort zelf wat goed werkt bij klanten en wat beter kan."'::jsonb), '{items,2,title}', '"Ook zonder open rol"'::jsonb), '{items,2,text}', '"Staat jouw rol er niet bij? Mail ons dan toch."'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'proof_careers_team';

-- proof_default
-- Statamic voor WordPress, zoals op de rest van de site.
update adaptive_blocks
set default_variant = jsonb_set(default_variant, '{items,2,text}', '"Een add-on, een plugin of één regel code. Je hebt er geen IT-traject voor nodig."'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'proof_default';

-- proof_platform
-- Zei dat de keuze altijd op de server valt en dat er nooit een script wacht. Volgens de pagina Integraties geldt dat voor Statamic. De regel code houdt de pagina juist heel even vast.
update adaptive_blocks
set default_variant = jsonb_set(jsonb_set(jsonb_set(jsonb_set(default_variant, '{subtitle}', '"De keuze valt voordat je bezoeker de pagina ziet. Hij ziet nooit eerst een andere versie."'::jsonb), '{items,0,text}', '"Personalisatie die de pagina achteraf verbouwt, laat eerst de gewone versie zien. Hier ziet je bezoeker alleen het eindresultaat."'::jsonb), '{items,1,title}', '"Op de server waar het kan"'::jsonb), '{items,1,text}', '"In Statamic valt de keuze op de server, voordat de pagina wordt verstuurd. Zoekmachines zien een gewone, snelle pagina."'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'proof_platform';

-- hero_google_problem
-- Eigen beeld, zodat de banner zichtbaar wisselt ten opzichte van de standaardbanner.
update adaptive_blocks
set default_variant = jsonb_set(default_variant, '{media,url}', '"https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-jurk-2.svg"'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_google_problem';

-- hero_intent_direct
-- Eigen beeld, zodat de banner zichtbaar wisselt ten opzichte van de standaardbanner.
update adaptive_blocks
set default_variant = jsonb_set(default_variant, '{media,url}', '"https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-vest-2.svg"'::jsonb),
    updated_at = now()
where tenant_id = 'statamic' and key = 'hero_intent_direct';

commit;
