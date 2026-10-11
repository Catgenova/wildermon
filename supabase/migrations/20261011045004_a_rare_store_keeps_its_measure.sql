-- A rare store keeps its measure.
--
-- room_for gave a rare thing at least one more of whatever it was asked
-- about, even a measure the thing has none of: a rare larder or a rare raw
-- material bin, which count things, came out with one kilo of heft too, and
-- everything that asks which measure a store uses saw the heft and treated
-- it as a one-kilo bin that would take nothing. Nought stays nought now, on
-- both sides (`roomFor`).
--
-- Rewritten from its newest definition:
--   room_for  20260927032000_a_barrel_holds_what_its_wood_holds.sql

create or replace function room_for(p_base double precision, p_rare text)
 returns integer language sql stable as $fn$
  select case when step = 0 or plain <= 0 then plain
              else plain + greatest(step, floor(plain * rarity_room() * step + 0.5)::int) end
  from (select floor(coalesce(p_base, 0) + 0.5)::int as plain,
               coalesce((select ord from rarity_def where id = p_rare), 0) as step) a
$fn$;

select private.lock_doors();
