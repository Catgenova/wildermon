-- A wildermon's level is its skill.
--
-- Asked for: "Level should be equal to that skill, since there's only 1 skill per wildermon". A wildermon holds the
-- one skill it was born to -- its job's, or a draught beast's hauling -- and its level is that, to the whole number
-- below, and one for a kind that has none. It was one more than a fifth of it, which topped out at twenty-one. The
-- browser's `creatureLevel`.
create or replace function creature_level(p_skills jsonb) returns integer language sql stable as $fn$
  select greatest(1, floor(coalesce((select max(value::numeric) from jsonb_each_text(p_skills)), 0)))::int
$fn$;

select private.lock_doors();
