-- Haalt de gedachtestreepjes uit de standaardblokken van het platform.
--
-- Elke " — " wordt een punt, en de letter erna een hoofdletter. Dus
-- "U hoeft ons niet te geloven — u meet het" wordt
-- "U hoeft ons niet te geloven. U meet het".
--
-- Raakt alleen de platformbrede blokken en die van de terugvaltenant
-- mister-chameleon. Blokken van andere klanten blijven zoals ze zijn.
-- Beelden, video's, knoppen en opmaak veranderen niet.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

do $$
declare
  r record;
  d text;
  a text;
  p int;
begin
  for r in
    select id, default_variant::text as d, adaptive_variants::text as a
      from adaptive_blocks
     where (tenant_id is null or tenant_id = 'mister-chameleon')
       and (default_variant::text || adaptive_variants::text) like '% — %'
  loop
    d := r.d;
    a := r.a;
    loop
      p := position(' — ' in d);
      exit when p = 0;
      d := left(d, p - 1) || '. ' || upper(substr(d, p + 3, 1)) || substr(d, p + 4);
    end loop;
    loop
      p := position(' — ' in a);
      exit when p = 0;
      a := left(a, p - 1) || '. ' || upper(substr(a, p + 3, 1)) || substr(a, p + 4);
    end loop;
    update adaptive_blocks
       set default_variant = d::jsonb, adaptive_variants = a::jsonb, updated_at = now()
     where id = r.id;
  end loop;
end $$;

-- Controle: dit moet 0 geven.
select count(*) as nog_met_streepje
  from adaptive_blocks
 where (tenant_id is null or tenant_id = 'mister-chameleon')
   and (default_variant::text || adaptive_variants::text) ~ '—|–';
