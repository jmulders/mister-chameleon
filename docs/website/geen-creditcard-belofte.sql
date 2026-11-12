-- De belofte "geen creditcard" klopt niet: bij het starten van een proefperiode
-- vraagt Stripe om een kaart. Er wordt pas na 14 dagen afgeschreven.
--
-- Vier standaardblokken van het platform noemen die belofte nog. Dit past
-- alleen de ondertitel van die vier aan. De rest van elk blok blijft staan.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}',
         to_jsonb($mc$Maak uw account aan en verken het platform. U betaalt pas na 14 dagen.$mc$::text)),
       updated_at = now()
 where tenant_id is null and key = 'conversion_signup';

update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}',
         to_jsonb($mc$Maak een account aan en verken het platform in uw eigen tempo.$mc$::text)),
       updated_at = now()
 where tenant_id is null and key = 'cta_platform';

update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}',
         to_jsonb($mc$14 dagen volledige toegang en u betaalt pas daarna. Opzeggen kan altijd.$mc$::text)),
       updated_at = now()
 where tenant_id is null and key = 'cta_saas_trial';

update adaptive_blocks
   set default_variant = jsonb_set(default_variant, '{subtitle}',
         to_jsonb($mc$Tijdelijke aanbieding, geldig tot het einde van de maand.$mc$::text)),
       updated_at = now()
 where tenant_id is null and key = 'notification_offer';

commit;

-- Controle: dit moet nul rijen geven.
select coalesce(tenant_id, '(platform)') as tenant, key
  from adaptive_blocks
 where (default_variant::text || adaptive_variants::text) ~* 'creditcard|credit card';
