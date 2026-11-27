-- The armour stand split in two by body: a Body A mannequin (`mannequin_a`) and a Body B mannequin (`mannequin_b`),
-- each a stand of its own, the mannequin drawn in that body (`STANDS`, `STAND_BODY`). The old armour stand is made no
-- more (its defs went in the definitions before this): every one set down or carried, and every order for one, is a
-- Body A mannequin now, with whatever it held still on it (the pieces are the stand's by its id, `item.placed`). A
-- stand's jobs (`decor_refusal`, `perform_decor`) are at either stand (`stand_kinds()`), and `armour_stand_kind()` goes.

update placed set sub = 'mannequin_a' where kind = 'furniture' and sub = 'armour_stand';
update item set def = 'mannequin_a' where def = 'armour_stand';
update buy_order set def = 'mannequin_a' where def = 'armour_stand';
update deed_work set def = 'mannequin_a' where def = 'armour_stand';

CREATE OR REPLACE FUNCTION public.decor_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare pl placed; d furniture_def; g jsonb; v_kind text; it item; v_slot text; v_why text; v_fed boolean; v_bed int;
begin
  if p_action = 'spread_compost' then
    if p_target->>'kind' = 'furniture' then
      select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture';
      if pl.id is not null and is_planter(pl.sub) and not placed_in_reach(p_world, p_uid, pl.id) then return 'Stand next to the planter.'; end if;
      select pc.fed into v_fed from planter_crop pc where pc.placed = pl.id;
    else
      v_bed := bed_level_of(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int);
      select cr.fed into v_fed from crop cr where cr.world_id = p_world and cr.x = (p_target->>'x')::int and cr.y = (p_target->>'y')::int
        and cr.level is not distinct from v_bed;
    end if;
    if v_fed is null then return decor_said('noCrop', null); end if;
    if pack_count(p_world, p_uid, compost_item()) < spread_cost() then return decor_said('noCompost', null); end if;
    return case when v_fed then decor_said('fed', null) end;
  end if;
  v_kind := case when p_action = 'read_sundial' then sundial_kind()
                 when p_action in ('fill_compost', 'empty_compost') then compost_bin_kind()
                 when p_action = 'draw_curtains' then curtains_kind() end;
  -- A stand's jobs at either stand, whichever body (`stand_kinds`).
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
     and (sub = v_kind or (v_kind is null and sub = any (stand_kinds())));
  if not found then return 'It is gone.'; end if;
  select * into d from furniture_def where id = pl.sub;
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(lower(d.name)); end if;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action = 'fill_compost' then
    if heap_ready(g->'heap') then return decor_said('binReady', null); end if;
    if coalesce((g->'heap'->>'n')::int, 0) >= compost_holds() then return decor_said('binFull', null); end if;
    return case when compost_pick(p_world, p_uid, p_target) is null then decor_said('nothingToCompost', null) end;
  end if;
  if p_action = 'empty_compost' then
    if g->'heap' is null then return decor_said('binEmpty', null); end if;
    return case when heap_ready(g->'heap') then null else decor_said('notReady', null) end;
  end if;
  if pl.sub = any (stand_kinds()) then
    v_why := stand_refusal(p_world, p_uid, pl);
    if v_why is not null then return v_why; end if;
    if p_action = 'stand_put' then
      select * into it from item where id = stand_pick(p_world, p_uid, pl, p_target);
      if it.id is null then return decor_said('noArmour', null); end if;
      if stand_kept(it) is not null then return decor_said('notArmour', null); end if;
      v_slot := slot_of(it.def);
      return case when coalesce(g->'worn', '{}'::jsonb) ? v_slot then decor_said('slotTaken', v_slot) end;
    end if;
    if p_action = 'stand_swap' then
      return case when exists (select 1 from stand_swap_plan(p_world, p_uid, pl) s
                                where (s.worn is not null and s.kept is null) or (s.worn is null and s.held is not null))
                  then null else decor_said('nothingToSwap', null) end;
    end if;
    if p_action like 'stand\_take\_%' then
      return case when coalesce(g->'worn', '{}'::jsonb) ? substr(p_action, 12) then null else decor_said('slotEmpty', null) end;
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.perform_decor(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare pl placed; g jsonb; it item; v_n int; v_held int; v_ql double precision; v_slot text; v_moved text[] := '{}'; v_kept text[] := '{}';
        s record; v_crop text; v_x int; v_y int; v_bed int;
begin
  if decor_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  if p_action = 'spread_compost' then
    if not consume(p_world, p_uid, compost_item(), spread_cost()) then return; end if;
    if p_target->>'kind' = 'furniture' then
      update planter_crop pc set fed = true where pc.placed = (p_target->>'id')::bigint returning pc.id into v_crop;
      select pl2.x, pl2.y into v_x, v_y from placed pl2 where pl2.id = (p_target->>'id')::bigint;
    else
      v_x := (p_target->>'x')::int; v_y := (p_target->>'y')::int;
      v_bed := bed_level_of(p_world, p_uid, v_x, v_y);
      update crop cr set fed = true where cr.world_id = p_world and cr.x = v_x and cr.y = v_y and cr.level is not distinct from v_bed
        returning cr.id into v_crop;
    end if;
    perform skill_raise(p_world, p_uid, spread_skill(), 1);
    perform tell(p_world, p_uid, decor_done('spread', lower((select cd.name from crop_def cd where cd.id = v_crop)), null, null, null), 'event');
    perform land_announce(p_world, v_x, v_y);
    return;
  end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action = 'read_sundial' then
    perform tell(p_world, p_uid, decor_done('sundial', world_clock(p_world) || ', ' || season_at(now()), season_days() - season_day_at(now()), null, null), 'event');
    return;
  elsif p_action = 'fill_compost' then
    select * into it from item where id = compost_pick(p_world, p_uid, p_target);
    v_held := coalesce((g->'heap'->>'n')::int, 0);
    v_n := least(it.count, compost_holds() - v_held);
    v_ql := (v_held * coalesce((g->'heap'->>'ql')::double precision, 0) + v_n * it.ql) / (v_held + v_n);
    if not spend_stack(p_world, p_uid, it.id, v_n) then return; end if;
    g := g || jsonb_build_object('heap', jsonb_build_object('n', v_held + v_n, 'ql', v_ql, 'at', extract(epoch from now())));
    perform tell(p_world, p_uid, decor_done('filled', lower((select x.name from item_def x where x.id = it.def)), v_n, v_held + v_n, compost_holds()), 'event');
  elsif p_action = 'empty_compost' then
    v_n := ceil((g->'heap'->>'n')::numeric / compost_per())::int;
    perform give(p_world, p_uid, compost_item(), v_n, (g->'heap'->>'ql')::double precision);
    g := g - 'heap';
    perform skill_raise(p_world, p_uid, spread_skill(), 1);
    perform tell(p_world, p_uid, decor_done('emptied', null, v_n, null, null), 'event');
  elsif p_action = 'draw_curtains' then
    if coalesce((g->>'shut')::boolean, false) then
      g := g - 'shut';
      perform tell(p_world, p_uid, decor_done('open', null, null, null, null), 'event');
    else
      g := g || '{"shut": true}'::jsonb;
      perform tell(p_world, p_uid, decor_done('shut', null, null, null, null), 'event');
    end if;
  elsif p_action = 'stand_put' then
    select * into it from item where id = stand_pick(p_world, p_uid, pl, p_target);
    v_slot := slot_of(it.def);
    if worn_by(p_world, p_uid, it.id) then
      update player set equipped = equipped - v_slot where world_id = p_world and uid = p_uid;
    end if;
    update item set holder = 'stand', holder_uid = null, placed = pl.id where id = it.id;
    perform tell(p_world, p_uid, decor_done('put', lower((select x.name from item_def x where x.id = it.def)), null, null, null), 'event');
  elsif p_action like 'stand\_take\_%' then
    v_slot := substr(p_action, 12);
    select i.* into it from item i join armour_def a on a.id = i.def where i.holder = 'stand' and i.placed = pl.id and a.slot = v_slot limit 1;
    if it.id is null then return; end if;
    update item set holder = 'player', holder_uid = p_uid, placed = null where id = it.id;
    perform tell(p_world, p_uid, decor_done('taken', lower((select x.name from item_def x where x.id = it.def)), null, null, null), 'event');
  elsif p_action = 'stand_swap' then
    for s in select * from stand_swap_plan(p_world, p_uid, pl) loop
      if s.worn is not null and s.kept is not null then
        v_kept := v_kept || (lower((select x.name from item_def x join item i on i.def = x.id where i.id = s.worn)) || ' (' || kept_why(s.kept) || ')');
        continue;
      end if;
      if s.worn is null and s.held is null then continue; end if;
      if s.worn is not null then
        update item set holder = 'stand', holder_uid = null, placed = pl.id where id = s.worn;
        update player set equipped = equipped - s.slot where world_id = p_world and uid = p_uid;
      end if;
      if s.held is not null then
        update item set holder = 'player', holder_uid = p_uid, placed = null where id = s.held;
        update player set equipped = jsonb_set(equipped, array[s.slot], to_jsonb(s.held)) where world_id = p_world and uid = p_uid;
      end if;
      v_moved := v_moved || s.slot;
    end loop;
    perform tell(p_world, p_uid, decor_done('swapped', array_to_string(v_moved, ', '), null, null, null)
      || case when cardinality(v_kept) > 0 then ' ' || decor_done('kept', array_to_string(v_kept, ', '), null, null, null) else '' end, 'event');
  end if;
  if pl.sub = any (stand_kinds()) then
    g := (g - 'worn') || case when stand_worn(pl.id) <> '{}'::jsonb then jsonb_build_object('worn', stand_worn(pl.id)) else '{}'::jsonb end;
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $function$;

drop function if exists public.armour_stand_kind();

select private.lock_doors();
