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
 * The same holds for a thing enchanted where it stands and for a crate.
 *
 * Rewritten here, from the newest migration that defines each:
 *   enchant_setting        -- 20261011011941_six_more_for_a_melee_weapon.sql
 *   enchant_setting_placed -- 20261011031657_enchanted_where_it_stands.sql
 *   enchant_setting_crate  -- 20261011033349_fair_wind_deep_hold_true_axle_bag_of_holding.sql
 * Whether you are at the plinth is asked the way every station is asked.
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

create or replace function enchant_setting_placed(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_place placed, out o_id text)
  language plpgsql stable as $fn$
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  -- Done standing at an enchanter's plinth, and nowhere else.
  if not at_station(p_world, p_uid, 'enchanters_plinth') then o_why := enchant_said('plinth'); return; end if;
  select * into o_place from placed pl where pl.world_id = p_world and pl.id = nullif(p_target->>'id', '')::bigint
    and pl.kind = p_target->>'kind';
  if o_place.id is null or placed_def(o_place) is null then o_why := enchant_said('gone'); return; end if;
  if not placed_in_reach(p_world, p_uid, o_place.id) then o_why := enchant_said('reach'); return; end if;
  o_why := lock_refusal(p_world, p_uid, o_place.lock, o_place.x, o_place.y);
  if o_why is not null then return; end if;
  if not enchant_fits(enchant_on(o_id), placed_def(o_place)) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_place.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_place.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_place.enchant->>'id'), o_place.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_place.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

create or replace function enchant_setting_crate(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_crate crate, out o_id text)
  language plpgsql stable as $fn$
declare v_p player;
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  -- Done standing at an enchanter's plinth, and nowhere else.
  if not at_station(p_world, p_uid, 'enchanters_plinth') then o_why := enchant_said('plinth'); return; end if;
  o_crate := target_crate(p_world, p_target);
  if o_crate.id is null then o_why := enchant_said('gone'); return; end if;
  select * into v_p from player where world_id = p_world and uid = p_uid;
  if sqrt(power(crate_centre_x(o_crate) - v_p.x, 2) + power(crate_centre_y(o_crate) - v_p.y, 2)) > 2.4 then
    o_why := enchant_said('reach'); return;
  end if;
  o_why := lock_refusal(p_world, p_uid, o_crate.lock, o_crate.x, o_crate.y);
  if o_why is not null then return; end if;
  if not enchant_fits(enchant_on(o_id), (select d.item from crate_def d where d.kind = o_crate.kind)) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_crate.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_crate.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_crate.enchant->>'id'), o_crate.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_crate.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

notify pgrst, 'reload schema';
select private.lock_doors();
