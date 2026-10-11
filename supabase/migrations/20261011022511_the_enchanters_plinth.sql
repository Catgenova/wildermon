/*
 * The enchanter's plinth (`enchant.ts`, `furniture.ts`, `plinth.ts`): Enchant,
 * putting a scroll into a thing, is done standing at one, as papyrus is
 * pressed standing at a paper press -- within the reach every station set
 * down has, 2.4 tiles of its middle on the same storey (`at_station`, the
 * browser's `STATION_REACH`) -- and refused anywhere else in the words the
 * browser says (`enchant_said('plinth')`). Writing a scroll wants none.
 *
 * The defs just before this carry the piece (masonry with a trowel: 32 stone
 * bricks, 12 mortar, 2 stone slabs, a light mote and a dark mote; it greens
 * over as a statue does), its item and recipe, the station's name and the
 * refusal.
 *
 * Rewritten here, from the newest migration that defines it:
 *   enchant_setting -- 20261011011941_six_more_for_a_melee_weapon.sql
 * Nothing else is: whether you are at the plinth is asked the way every
 * station is asked.
 */

/** Why this scroll will not go into this thing, or the three of them when it will (`enchantSetting`). */
create or replace function enchant_setting(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_item item, out o_id text)
  language plpgsql stable as $fn$
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if p_target->>'kind' is distinct from 'item' or o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  -- Done standing at an enchanter's plinth, and nowhere else.
  if not at_station(p_world, p_uid, 'enchanters_plinth') then o_why := enchant_said('plinth'); return; end if;
  select * into o_item from item i where i.world_id = p_world and i.id = target_item(p_target)
    and i.holder = 'player' and i.holder_uid = p_uid;
  if o_item.id is null then o_why := enchant_said('weapon'); return; end if;
  -- Each goes on its own kind of thing, and the refusal names it.
  if not enchant_fits(enchant_on(o_id), o_item.def) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_item.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_item.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_item.enchant->>'id'), o_item.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_item.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

notify pgrst, 'reload schema';
select private.lock_doors();
