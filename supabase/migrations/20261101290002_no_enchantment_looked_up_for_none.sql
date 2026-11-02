-- The ground and the walk reads, the same answer for less: no enchantment looked up for a thing with none.
--
-- Measured on the live island: `rpc_ground` was 11% of the database's time at 100 ms a call, `rpc_move` 4% at 112 ms,
-- every browser asking the first once a second while it moves or works (`GROUND_EVERY`) and the second as it walks.
-- Profiled per function on a test island sized like the live one:
--
--   * `placed_enchant` and `enchant_of` read the whole table of enchantments (`enchantments()`, forty-odd rows) for
--     a piece set down or a thing carried with no enchantment on it, which is nearly every one: the fast half of the
--     ground asks it of every lit piece in range three times over (`placed_burn_rate`, for its fuel, its ash and
--     whether it is still lit), and a step asks it twice of every thing in the pack (what a pack weighs and carries).
--     Nought now, without looking.
--   * `is_well` looked up the furniture's row for a piece with no `sub` (a campfire, a kiln), twice a piece on every
--     ground read: false now, without looking.
--
-- The same answer from each, for every thing; the clock's sweeps (traps, furnaces) and travel read the first two the
-- same way and save the same.

set local lock_timeout = '3s';

/** What an enchantment of this effect on a placed thing comes to at its quality, or nought (`swingEnchant`). */
create or replace function placed_enchant(p placed, p_effect text) returns double precision language sql immutable as $fn$
  select case when p.enchant is null then 0::double precision
         else coalesce((select greatest(0, least(ql_top(), (p.enchant->>'ql')::double precision)) * e.per_ql
                          from enchantments() e where e.id = p.enchant->>'id' and e.effect = p_effect), 0) end
$fn$;

/** What an enchantment of this effect on a thing comes to at its quality, or nought. */
create or replace function enchant_of(it item, p_effect text) returns double precision language sql immutable as $fn$
  select case when it.enchant is null then 0::double precision
         else coalesce((select greatest(0, least(ql_top(), (it.enchant->>'ql')::double precision)) * e.per_ql
                          from enchantments() e where e.id = it.enchant->>'id' and e.effect = p_effect), 0) end
$fn$;

/** Whether a placed thing is a well (`furniture_def.well`). */
create or replace function is_well(p placed) returns boolean language sql stable as $fn$
  select case when p.sub is null then false
         else coalesce((select well from furniture_def where id = p.sub), 0) > 0 end
$fn$;

select private.lock_doors();
