/*
 * The home pieces (`src/game/decor.ts`, `src/game/decordefs.ts`): a sundial,
 * a compost bin, a stone lantern, a woven rug, curtains and an armour stand.
 *
 * The definitions crossed every piece, its recipe and its item, the jobs
 * (`decor_action`), every number (`compost_holds`, `compost_per`,
 * `compost_days`, `compost_boost`, `compost_spoiled`, `spread_cost`,
 * `rug_colours`), the kinds (`compost_takes`, `rug_patterns`, `stand_slots`,
 * `sundial_kind` and the rest), and every sentence (`decor_said`,
 * `decor_done`, `kept_why`). What is here is the doing of it.
 *
 *   * `placed.garden` and `item.garden`, the garden pieces' column, keep a
 *     home piece's state too: `pattern` and `tints` (a woven rug's pattern
 *     and its second and third colours, its first being its dye), `shut`
 *     (curtains drawn), `heap` (a compost bin's: `n`, `ql`, `at`) and `worn`
 *     (what is on an armour stand, slot by slot, as `rpc_worn` sends a
 *     body's gear). It reaches every browser with the ground read and goes
 *     into the pack with the piece (`perform_fire`).
 *   * The jobs (`decor_refusal`, `perform_decor`), dispatched at the end of
 *     the line (`last_action`, `last_refusal`, `perform_last`), every
 *     refusal in the browser's words and order.
 *   * The pieces on an armour stand are items of their own
 *     (`item.holder = 'stand'`, `item.placed` the stand), so each comes off as
 *     it went on; only whoever set it down or a rank that may use the crates
 *     on its settlement changes it (`stand_refusal`); a stand with armour on
 *     it is not picked up (`fire_refusal`).
 *   * Compost spread on a sown field or a planter (`crop.fed`,
 *     `planter_crop.fed`, sent with the ground read) lifts its next harvest
 *     `compost_boost` QL (`reap_what`, through `reap_one` and `reap_planter`).
 *   * A woven rug is woven in the pattern chosen at the loom (`perform_craft`)
 *     and takes a colour a dyeing up to `rug_colours` (`last_refusal`,
 *     `perform_last`); removing its dye removes them all (`perform_last`,
 *     `private.perform_scrub`).
 *   * Curtains go on either face of a finished window on their storey
 *     (`mount_refusal`, mount `pane`), over its middle (`piece_anchor`).
 *
 * The stone lantern is a piece the browser lights by its own rule, as a rune
 * lantern is, and the scurra scrubs its moss as it does a statue's
 * (`furniture_def.mossy`). `supabase/test/decor.ts` holds the two sides to
 * each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;


/* ---- what the island keeps ------------------------------------------------------------------- */

alter table crop add column if not exists fed boolean not null default false;
alter table planter_crop add column if not exists fed boolean not null default false;

/* ---- a compost bin ------------------------------------------------------------------------- */

/** Whether a thing goes in a compost bin: weeds and ash, and food spoiled to `compost_spoiled` (`compostTakes`). */
create or replace function compost_takes_item(p_def text, p_dmg double precision) returns boolean language sql stable as $fn$
  select p_def = any (compost_takes())
      or (coalesce((select d.category from item_def d where d.id = p_def), '') = 'food' and p_dmg >= compost_spoiled())
$fn$;

/** The thing in the pack an Add would put in a bin: the one named, if the bin takes it, or the first it takes (`toCompost`). */
create or replace function compost_pick(p_world uuid, p_uid uuid, p_target jsonb) returns bigint language sql stable as $fn$
  select i.id from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked and compost_takes_item(i.def, i.dmg)
   order by (i.id = nullif(p_target->>'itemUid', '')::bigint) desc, i.id limit 1
$fn$;

/** Whether what is in a bin is compost now: `compost_days` after the last thing went in (`heapReady`). */
create or replace function heap_ready(p_heap jsonb) returns boolean language sql stable as $fn$
  select p_heap is not null and extract(epoch from now()) - coalesce((p_heap->>'at')::double precision, 0) >= compost_days() * day_seconds()
$fn$;

/* ---- an armour stand ------------------------------------------------------------------------ */

/** Why a stand is not yours to change, or null: whoever set it down, or a rank that may use the crates where it stands (`standNotYours`). */
create or replace function stand_refusal(p_world uuid, p_uid uuid, pl placed) returns text language sql stable as $fn$
  select case when coalesce(pl.made_by = p_uid, false) or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) then null
              else coalesce(rank_lacks_at(p_world, p_uid, pl.x, pl.y, 'stores'), decor_said('notYours', null)) end
$fn$;

/** Whether a thing is worn by this body, in any slot. */
create or replace function worn_by(p_world uuid, p_uid uuid, p_id bigint) returns boolean language sql stable as $fn$
  select exists (select 1 from player p, jsonb_each(p.equipped) e
                  where p.world_id = p_world and p.uid = p_uid and jsonb_typeof(e.value) = 'number' and (e.value)::text::bigint = p_id)
$fn$;

/** Why a worn piece stays on in a swap, or null: armour only, nothing locked (`keptWhy`). */
create or replace function stand_kept(it item) returns text language sql stable as $fn$
  select case when not exists (select 1 from armour_def a where a.id = it.def) then 'armour' when it.locked then 'locked' end
$fn$;

/** The thing in the pack a Put on stand would put on: the one named, or the first armour for a free slot, carried before worn (`toStand`). */
create or replace function stand_pick(p_world uuid, p_uid uuid, pl placed, p_target jsonb) returns bigint language sql stable as $fn$
  select case when nullif(p_target->>'itemUid', '') is not null
    then (select i.id from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
             and i.id = (p_target->>'itemUid')::bigint)
    else (select i.id from item i join armour_def a on a.id = i.def
           where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
             and not (coalesce(pl.garden->'worn', '{}'::jsonb) ? a.slot)
           order by worn_by(p_world, p_uid, i.id), i.id limit 1) end
$fn$;

/** What is on a stand, slot by slot, as a body's gear goes over the wire (`rpc_worn`): what every browser draws. */
create or replace function stand_worn(p_placed bigint) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_object_agg(a.slot, jsonb_build_array(i.def,
           case i.rare when 'rare' then 1 when 'supreme' then 2 when 'fantastic' then 3 else 0 end, i.extra, i.dye)), '{}'::jsonb)
    from item i join armour_def a on a.id = i.def
   where i.holder = 'stand' and i.placed = p_placed
$fn$;

/** A swap's slots: each changed where the worn piece fits, or where nothing is worn and the stand holds one (`swapPlan`). */
create or replace function stand_swap_plan(p_world uuid, p_uid uuid, pl placed)
returns table (slot text, worn bigint, held bigint, kept text) language sql stable as $fn$
  select s.slot, w.id, h.id, case when w.id is not null then stand_kept(w) end
    from unnest(stand_slots()) with ordinality s(slot, o)
    cross join (select p.equipped from player p where p.world_id = p_world and p.uid = p_uid) e
    left join item w on w.world_id = p_world and w.holder = 'player' and w.holder_uid = p_uid
                    and jsonb_typeof(e.equipped->s.slot) = 'number' and w.id = (e.equipped->>s.slot)::bigint
    left join lateral (select i.id from item i join armour_def a on a.id = i.def
                        where i.holder = 'stand' and i.placed = pl.id and a.slot = s.slot limit 1) h on true
   order by s.o
$fn$;

/* ---- the jobs ---------------------------------------------------------------------------------- */

/**
 * Why a job at a home piece cannot be done now, or null: the browser's
 * `decorRefusal`, question for question -- there, in reach, whose, and then
 * the piece.
 */
create or replace function decor_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
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
                 when p_action = 'draw_curtains' then curtains_kind() else armour_stand_kind() end;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture' and sub = v_kind;
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
  if v_kind = armour_stand_kind() then
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
end $fn$;

/**
 * The jobs done: a sundial read; a bin filled, a stack up to its room, and
 * emptied of its compost; compost spread on a field or a planter's crop;
 * curtains drawn; a stand dressed, undressed and swapped with what is worn.
 * What a stand holds is told to every browser as its `worn` (`stand_worn`).
 */
create or replace function perform_decor(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
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
  if pl.sub = armour_stand_kind() then
    g := (g - 'worn') || case when stand_worn(pl.id) <> '{}'::jsonb then jsonb_build_object('worn', stand_worn(pl.id)) else '{}'::jsonb end;
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

CREATE OR REPLACE FUNCTION public.mount_refusal(p_world uuid, p_uid uuid, p_mount text, p_x integer, p_y integer, p_facing text, p_level integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare w wall; v_seen text; v_miss text;
begin
  -- Curtains on either face of a finished window, on their storey, as a plaque on a solid wall (`decor.ts`).
  if p_mount in ('wall', 'pane') then
    w := wall_on_side(p_world, p_x, p_y, p_facing, p_level);
    if w.x is null or wall_seen_type(p_world, p_uid, w) <> (case when p_mount = 'pane' then 'window' else 'solid' end) then
      return case when p_mount = 'pane' then mount_said('noWindow') else mount_said('noWall') end;
    end if;
    return case when bill_done(w.needed) then null else mount_said('unfinished') end;
  end if;
  if p_mount = 'hang' and exists (select 1 from placed o where o.world_id = p_world and o.kind = 'furniture'
      and o.sub = any (hang_from()) and o.x = p_x and o.y = p_y and coalesce(o.level, 0) = coalesce(p_level, 0)) then
    return null;
  end if;
  v_miss := case when p_mount = 'window' then mount_said('noWindow') else mount_said('noHook') end;
  if coalesce(p_level, 0) <> 0 then return case when p_mount = 'window' then mount_said('upstairs') else v_miss end; end if;
  if building_at(p_world, p_x, p_y) is not null then return case when p_mount = 'window' then mount_said('inside') else v_miss end; end if;
  w := wall_on_side(p_world, p_x, p_y, p_facing, 0);
  if w.x is null then return v_miss; end if;
  v_seen := wall_seen_type(p_world, p_uid, w);
  if p_mount = 'window' then
    if v_seen <> 'window' then return v_miss; end if;
  elsif not coalesce((select t.trellis from wall_type_def t where t.id = v_seen), false) then
    return v_miss;
  end if;
  return case when bill_done(w.needed) then null else mount_said('unfinished') end;
end $function$;

CREATE OR REPLACE FUNCTION public.piece_anchor(p_sub text, p_facing text, p_sx integer, p_sy integer, p_size integer[])
 RETURNS integer[]
 LANGUAGE plpgsql
 STABLE
AS $function$
declare ax int := least(subtiles() - p_size[1], greatest(0, p_sx));
        ay int := least(subtiles() - p_size[2], greatest(0, p_sy));
begin
  if not piece_along_side(p_sub) then return array[ax, ay]; end if;
  -- A window box under the middle of its window, and curtains over it (`furnitureAnchor`).
  if (select f.mount from furniture_def f where f.id = p_sub) in ('window', 'pane') then
    if p_facing in ('n', 's') then ax := (subtiles() - p_size[1]) / 2; else ay := (subtiles() - p_size[2]) / 2; end if;
  end if;
  return array[case p_facing when 'w' then 0 when 'e' then subtiles() - p_size[1] else ax end,
               case p_facing when 'n' then 0 when 's' then subtiles() - p_size[2] else ay end];
end $function$;

CREATE OR REPLACE FUNCTION public.fire_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare p placed; it item; n int; sub text; sz int[]; v_shut text; v_at int[]; v_face text;
begin
  -- Opening a wildermon crate, which is furniture standing on the ground.
  if p_action in ('crate_follow', 'crate_work') then
    return crate_open_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if p_action = 'build_campfire' then
    if p_target->>'sx' is null or p_target->>'sy' is null then return 'Choose a spot.'; end if;
    if pack_count(p_world, p_uid, 'shaft') < 2 then return 'A campfire takes 2 shafts.'; end if;
    return null;
  end if;

  if p_action in ('place_smelter', 'place_furniture', 'place_kiln') then
    select * into it from item
      where id = target_item(p_target) and world_id = p_world
        and holder = 'player' and holder_uid = p_uid;
    if not found then return 'You are not carrying that.'; end if;
    if p_action = 'place_smelter' and it.def <> 'smelter' then return 'That is not a smelter.'; end if;
    if p_action = 'place_kiln' and it.def <> 'kiln' then return 'That is not a kiln.'; end if;
    if p_action = 'place_furniture' then
      sub := replace(it.def, 'furniture_', '');
      if not exists (select 1 from furniture_def where id = sub) then return 'That is not something you can set down.'; end if;
      if not exists (select 1 from boat_def bd where bd.id = sub) then
        v_shut := bridge_furniture_refusal(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
        if v_shut is not null then return v_shut; end if;
      end if;
      -- A piece built only on a settlement of yours stands only on one: the same flag, off its own recipe.
      if exists (select 1 from recipe where id = 'make_' || sub and deed)
         and not on_my_deed(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int) then
        return 'Set down only on a settlement of yours.';
      end if;
      -- And one altar to a settlement: none set down on one that has its altar.
      if exists (select 1 from furniture_def f where f.id = sub and f.altar)
         and altar_on_deed(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int) then
        return 'Settlement already has an altar; one per settlement.';
      end if;
      -- A trellis against the outer face of a wall, from the ground (`vineyard.ts`, `trellisWallRefusal`).
      if sub = vine_kind() then
        v_shut := trellis_wall_refusal(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int,
          case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end,
          (select r.level from player r where r.world_id = p_world and r.uid = p_uid));
        if v_shut is not null then return v_shut; end if;
      end if;
      -- Fixed to a wall or hung, where it is fixed; a hedge outside, from the ground (`garden.ts`).
      v_shut := piece_fixed_refusal(p_world, p_uid, sub, (p_target->>'x')::int, (p_target->>'y')::int,
        case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end,
        (select r.level from player r where r.world_id = p_world and r.uid = p_uid));
      if v_shut is not null then return v_shut; end if;
    end if;
    -- And the block of spots it would take, which used to be the browser's to refuse alone.
    v_face := case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end;
    sz := placed_size(case p_action when 'place_smelter' then 'smelter' when 'place_kiln' then 'kiln' else 'furniture' end, sub, v_face);
    -- Kept inside the tile, and a trellis in the row along the side it faces (`piece_anchor`).
    v_at := piece_anchor(sub, v_face, coalesce((p_target->>'sx')::int, 0), coalesce((p_target->>'sy')::int, 0), sz);
    -- A trellis shares the corner spot with one at right angles to it (`piece_block_taken`).
    if piece_block_taken(p_world, sub, v_face, (p_target->>'x')::int, (p_target->>'y')::int, v_at[1], v_at[2], sz[1], sz[2]) then
      return 'Something is already standing there.';
    end if;
    -- And a lantern post's arm not into a wall (`lamps.ts`).
    if p_action = 'place_furniture' then
      return lamp_arm_refusal(p_world, sub, (p_target->>'x')::int, (p_target->>'y')::int, v_at[1], v_at[2], v_face);
    end if;
    return null;
  end if;

  p := target_placed(p_world, p_target);
  if p.id is null then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, p.id) then
    return 'Stand next to the ' || coalesce(p.sub, p.kind) || '.';
  end if;
  -- A planter is sown, tended, harvested and pulled up as a field is, and says no as a field does.
  if farm_action(p_action) then
    return planter_refusal(p_world, p_uid, p_action, p, p_target);
  end if;

  if p_action in ('light_campfire', 'light_smelter', 'light_kiln') then
    if placed_lit(p) then return 'Already lit.'; end if;
    if placed_fuel(p) <= 0 then return 'No fuel.'; end if;
  elsif p_action in ('put_out_campfire', 'damp_smelter', 'damp_kiln') then
    if not placed_lit(p) then return 'It is not burning.'; end if;
  elsif p_action in ('fuel_campfire', 'fuel_smelter', 'fuel_kiln') then
    -- From what is at hand: the pack, a bag, or a store within reach.
    select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
      where (s.id = target_item(p_target) or fuel_value(s.def) is not null)
      order by (s.id = target_item(p_target)) desc, s.draw limit 1;
    if not found or fuel_value(it.def) is null then
      return 'Need fuel: ' || fuel_said() || '.';
    end if;
    if placed_fuel(p) >= fire_capacity() then return 'Fuel full.'; end if;
  elsif p_action in ('take_ashes_fire', 'take_ashes_smelter', 'take_ashes_kiln') then
    if floor(placed_ash(p)) < 1 then return 'No ashes yet.'; end if;
  elsif p_action = 'turn_furniture' then
    if p.kind <> 'furniture' then return 'Only furniture turns.'; end if;
    if placed_lit(p) then return 'Put it out first.'; end if;
    if p.puller is not null then return 'Let go of it first.'; end if;
    if p.driver is not null then return 'Get down off it first.'; end if;
    if exists (select 1 from player r where r.world_id = p_world and r.aboard = p.id) then
      return 'Passengers aboard.';
    end if;
    if crates_on_rack(p_world, p.id) > 0 then return 'Take the crates off it first.'; end if;
    -- A trellis goes round to the next side of its tile with a wall it stands against, and stays put with none (`vineyard.ts`).
    if p.sub = vine_kind() then
      v_face := trellis_turns_to(p_world, p_uid, p);
      if v_face is null then return vine_said('turn'); end if;
      sz := placed_size(p.kind, p.sub, v_face);
      v_at := piece_anchor(p.sub, v_face, p.sx, p.sy, sz);
      if piece_block_taken(p_world, p.sub, v_face, p.x, p.y, v_at[1], v_at[2], sz[1], sz[2], p.id) then
        return 'Blocked.';
      end if;
      return null;
    end if;
    -- A piece fixed to a wall or hung goes round to the next side it is fixed on (`garden.ts`).
    if exists (select 1 from furniture_def f where f.id = p.sub and f.mount is not null) then
      v_face := mount_turns_to(p_world, p_uid, p);
      if v_face is null then return mount_said('turn'); end if;
      sz := placed_size(p.kind, p.sub, v_face);
      v_at := piece_anchor(p.sub, v_face, p.sx, p.sy, sz);
      if piece_block_taken(p_world, p.sub, v_face, p.x, p.y, v_at[1], v_at[2], sz[1], sz[2], p.id) then
        return 'Blocked.';
      end if;
      return null;
    end if;
    return furniture_turn_reason(p);
  elsif p_action in ('take_apart_campfire', 'pick_up_smelter', 'pick_up_furniture', 'pick_up_kiln') then
    if placed_lit(p) then return 'Put it out first.'; end if;
    if p_action = 'pick_up_furniture' then
      -- Locked, it stays where it is: lifting a ship or a cart and setting it
      -- down somewhere else is taking it, padlock and all.
      v_shut := lock_refusal(p_world, p_uid, p.lock, p.x, p.y);
      if v_shut is not null then return v_shut; end if;
      -- What is inside it, and what is in front of it.
      if exists (select 1 from item i where i.holder = 'furniture' and i.placed = p.id) then
        return 'Empty it first.';
      end if;
      -- A trophy on a plaque, potted plants on a stand: taken down first (`garden.ts`).
      if coalesce(jsonb_array_length(p.garden->'held'), 0) > 0 then return garden_said('showing', ''); end if;
      -- And armour on a stand (`decor.ts`).
      if coalesce(p.garden->'worn', '{}'::jsonb) <> '{}'::jsonb then return garden_said('showing', ''); end if;
      -- A crop is not carried about in a box of earth: it is harvested, or turned back into the soil.
      if exists (select 1 from planter_crop pc where pc.placed = p.id) then
        return planter_growing_said();
      end if;
      -- A rack holds nothing of its own, so the check above passes however
      -- loaded it is: what stands on it are crates of somebody else's, and
      -- lifting the rack out from under them would leave them in the air.
      if crates_on_rack(p_world, p.id) > 0 then
        return 'Take the ' || case when crates_on_rack(p_world, p.id) = 1 then 'crate'
                                   else crates_on_rack(p_world, p.id) || ' crates' end || ' off it first.';
      end if;
      if placed_litres(p) > 0 then return 'Empty it out first.'; end if;
      -- A crate with somebody else's wildermon in it is theirs to carry off.
      if p.creature is not null and exists (select 1 from creature q where q.world_id = p_world
            and q.id = p.creature and q.mode = 'stored' and q.keeper is distinct from p_uid) then
        return (select q.name from creature q where q.world_id = p_world and q.id = p.creature)
          || ' is not yours to carry off.';
      end if;
      if p.puller is not null then return 'Let go of it first.'; end if;
      if team_size(p_world, p.id) > 0 then return 'Unhitch the team first.'; end if;
      if p.driver is not null then return 'Get down off it first.'; end if;
      if exists (select 1 from player r where r.world_id = p_world and r.aboard = p.id) then
        return 'Passengers aboard.';
      end if;
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.last_action(p_action text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select p_action in ('plan_bridge', 'build_bridge', 'demolish_bridge',
                      'ring_bell', 'sleep', 'set_home', 'pair_creature', 'read_blood',
                      'dye_item', 'strip_dye', 'scrub_dye', 'start_brew', 'set_brew_spring', 'set_bauble', 'sacrifice', 'absorb_soul')
      -- Enchant: a scroll into a melee weapon (`enchanting.ts`).
      or p_action = enchant_action()
      -- A memorial stone's two: cutting a line into it, and reading it (`memorial.ts`).
      or memorial_action(p_action)
      -- A vine's three: a cutting off a thorn bush, planting it on a trellis, and picking it (`vineyard.ts`).
      or vine_action(p_action)
      -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
      or bee_action(p_action)
      -- A dye written down, and boiled again (`dyes.ts`).
      or dye_recipe_action(p_action)
      -- The garden pieces' jobs: wildflowers, a trim, a clip, a prune, what is on show (`garden.ts`).
      or garden_action(p_action)
      -- The home pieces' jobs: a sundial, a compost bin, compost spread, curtains, an armour stand (`decor.ts`).
      or decor_action(p_action)
$function$;

CREATE OR REPLACE FUNCTION public.last_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_rank text; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        it item; dye item; bd brew_def; v_kind text; v_short text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
  -- Scrub off dye: a brush, no lye (`private.scrub_refusal`).
  if p_action = 'scrub_dye' then
    return private.scrub_refusal(p_world, p_uid, p_target);
  end if;
  -- A brewer's spring: a water mote into a barrel (`private.brew_spring_refusal`).
  if p_action = 'set_brew_spring' then
    return private.brew_spring_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'absorb_soul' then
    return absorb_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = enchant_action() then
    return enchant_refusal(p_world, p_uid, p_target);
  end if;
  if memorial_action(p_action) then
    return memorial_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if vine_action(p_action) then
    return vine_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    return skep_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    return dye_recipe_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The garden pieces' jobs (`garden.ts`).
  if garden_action(p_action) then
    return garden_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The home pieces' jobs (`decor.ts`).
  if decor_action(p_action) then
    return decor_refusal(p_world, p_uid, p_action, p_target);
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
      coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1));

  elsif p_action in ('build_bridge', 'demolish_bridge') then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return 'It is gone.'; end if;
    select * into d from bridge_def where id = b.kind;
    if p_action = 'build_bridge' then
      select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
        and not span_done(sp.needed) order by sp.n limit 1;
      if not found then return 'Finished.'; end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then
        return 'Need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';
      end if;
      if sqrt((s.x + 0.5 - p.x) ^ 2 + (s.y + 0.5 - p.y) ^ 2) > 4.5 then
        return 'Stand by the open span.';
      end if;
      select e.key into v_short from jsonb_each(s.needed) e
        where (e.value)::int > 0 and not exists (select 1 from jsonb_each(s.needed) e3
          where (e3.value)::int > 0 and build_to_hand(p_world, p_uid, e3.key, s.x, s.y, null) > 0) order by e.key limit 1;
      -- Piece by piece, as a wall: refused only when nothing it wants is to hand.
      if v_short is not null then
        return 'Span needs ' || span_wants(s.needed) || '; none to hand.';
      end if;
    else
      -- gates: the far end's row, quoted: a record's field named by a reserved word is not found unquoted, so
      -- this refused nothing and raised "record b has no field by" instead, and nobody could pull a bridge down;
      -- and the reach, written once (`bridge_pull_reach`, `PULL_REACH`).
      if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
         and sqrt((b.bx + 0.5 - p.x) ^ 2 + (b."by" + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
        return 'Stand at one end of it.';
      end if;
      -- gates: where either end stands on a settlement, only its builders pull a bridge down, as only they take
      -- down a building's wall there (`may_shape`); anywhere else anybody may (`pullDownRefusal`).
      select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_short, v_rank
        from (values (1, b.ax, b.ay), (2, b.bx, b."by")) v(o, x, y)
        cross join lateral deed_covering(p_world, v.x, v.y) dd
       where not may_shape(p_world, p_uid, v.x, v.y)
       order by v.o, dd.founded_at limit 1;
      if v_short is not null then
        return coalesce(v_rank, 'Part of ' || v_short || ': only builders may '
            || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
      end if;
      -- gates: a padlock on a drawbridge's winch keeps it from being pulled down as from being worked.
      v_short := lock_refusal(p_world, p_uid, b.lock, b.ax, b.ay);
      if v_short is not null then return v_short; end if;
    end if;
    return null;

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not coalesce((select f.bell from furniture_def f where f.id = pc.sub), false) then
      return 'Not a bell.';
    end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if not on_my_deed(p_world, p_uid, pc.x, pc.y) then
      return 'Only on your settlement.';
    end if;
    -- Rung on a bell rope (`ropework.ts`).
    if pack_count(p_world, p_uid, bell_rope_item()) < 1 then return no_bell_rope_said(); end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not is_bed(pc) then return 'Not a bed.'; end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if p_action = 'sleep' then
      if not coalesce(pc.made_by = p_uid, false) and not on_my_deed(p_world, p_uid, pc.x, pc.y) then
        return sleep_not_yours(placed_name_in_line(pc));
      end if;
      if p.act is not null and p.act <> 'sleep' then return sleep_said('busy'); end if;
      if is_fight(p.act) or exists (select 1 from creature cr where cr.world_id = p_world and cr.hunting = p_uid
                                       and cr.mode = 'wild' and cr.health > 0) then
        return sleep_said('fight');
      end if;
      if exists (select 1 from creature cr where cr.world_id = p_world and cr.rider = p_uid) then return sleep_said('mounted'); end if;
    end if;
    if p_action = 'set_home' and p.home_x = pc.x and p.home_y = pc.y then
      return 'Already your home.';
    end if;
    return null;

  elsif p_action in ('pair_creature', 'read_blood') then
    perform creature_settle(p_world, (p_target->>'id')::int);
    perform herd_settle(p_world);
    c := target_creature(p_world, p_target);
    if c.world_id is null then return 'It is gone.'; end if;
    if p_action = 'read_blood' then return null; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'Need a settlement: the young go to its totem.';
    end if;
    if not creature_in_reach(p_world, p_uid, c, 2.4) then return 'Stand next to ' || c.name || '.'; end if;
    if c.due is not null then return c.name || ' is already pregnant.'; end if;
    if hybrid_kind(c.species) then return infertile_said(c.name); end if;
    mate := mate_for(p_world, c);
    if mate.id is null then
      return 'No ' || lower((select name from species_def where id = c.species))
        || ' of the other sex within ' || round(pair_range()) || ' tiles. ' || c.name
        || ' is ' || c.sex || '.';
    end if;
    return coalesce(pair_refuses(p_world, c, mate), cross_refuses(p_world, p_uid, c, mate));

  elsif p_action in ('dye_item', 'strip_dye') then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
    if p_action = 'dye_item' then
      if not found then return 'It is gone.'; end if;
      if not takes_dye(it.def) then return 'Cannot be dyed.'; end if;
      -- A woven rug takes a colour a dyeing, up to `rug_colours`, and not its last again (`decor.ts`).
      if it.def = woven_rug_kind() then
        if (case when it.dye is null then 0 else 1 end) + coalesce(jsonb_array_length(it.garden->'tints'), 0) >= rug_colours() then
          return decor_said('rugFull', null);
        end if;
        return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, coalesce(it.garden->'tints'->>-1, it.dye));
      end if;
      -- Out of the bucket or barrel chosen (`dyeFrom`), or the only one that holds enough (`dyeReason`).
      return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, it.dye);
    else
      if not found or it.dye is null or not takes_dye(it.def) then return 'No colour to remove.'; end if;
      if litres_at_hand(p_world, p_uid, 'lye_bucket', false) < lye_use() then
        return 'Need ' || lye_use() || ' L lye.';
      end if;
    end if;
    return null;

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    if not found then return 'Choose what to brew.'; end if;
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    return brew_reason(p_world, p_uid, pc, bd);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.perform_last(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_took boolean; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        dam creature; sire creature; it item; dye item; bd brew_def; dd dye_def; v_from text;
        v_kind text; v_id bigint; v_h int; v_n int; v_left int; v_want text; v_back jsonb;
        v_parts text[]; v_half int; e record; r record; v_skill double precision;
        v_care double precision; v_one bigint; v_stock item; v_ql double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'scrub_dye' then
    perform private.perform_scrub(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'set_brew_spring' then
    perform private.perform_brew_spring(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'absorb_soul' then
    perform perform_absorb(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = enchant_action() then
    perform perform_enchant(p_world, p_uid, p_target);
    return;
  end if;
  if memorial_action(p_action) then
    perform perform_memorial(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if vine_action(p_action) then
    perform perform_vine(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    perform perform_skep(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    perform perform_dye_recipe(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The garden pieces' jobs (`garden.ts`).
  if garden_action(p_action) then
    perform perform_garden(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The home pieces' jobs (`decor.ts`).
  if decor_action(p_action) then
    perform perform_decor(p_world, p_uid, p_action, p_target);
    return;
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
         coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
         is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    v_h := round((deck_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level, level_b, rise, width, side)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when d.material is not null then null else 'Oak' end, p_uid,
            top_deck(p_world, floor(p.x)::int, floor(p.y)::int),
            nullif(top_deck(p_world, (p_target->>'x')::int, (p_target->>'y')::int),
                   top_deck(p_world, floor(p.x)::int, floor(p.y)::int)),
            ramp_rise(deck_height(p_world, floor(p.x)::int, floor(p.y)::int),
                      deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)),
            bridge_width_asked(p_target),
            coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
    returning * into b;
    v_id := b.id;
    -- gates: the first span, beside the end it is set out from, also takes a drawbridge's winch.
    -- A material bridge's piers, each billed by the storeys it stands down from the deck there (`pier_storeys`).
    select count(*)::int into v_n from span_tiles(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int);
    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, t.bill, t.bill
    from (select st.n, st.x, st.y,
                 span_bill(v_kind, st.n, b.width,
                   case when d.material is not null and st.n = any (bridge_piers(v_n, d.bay))
                        then pier_storeys(ramp_deck(b.height, b.rise, v_n, st.n - 0.5) - surface_height(p_world, st.x, st.y)) else 0 end) as bill
            from span_tiles(floor(p.x)::int, floor(p.y)::int,
                            (p_target->>'x')::int, (p_target->>'y')::int) st) t;
    select count(*)::int into v_n from bridge_span sp where sp.world_id = p_world and sp.bridge = v_id;
    perform journal_note(p_world, p_uid, 'planned_bridge');
    perform skill_raise(p_world, p_uid, d.skill, 0.4);
    perform tell(p_world, p_uid, 'Planned: ' || lower(d.name) || ', ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || bridge_planned(p_world, b) || '. ' || d.note, 'system');

  elsif p_action = 'build_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into d from bridge_def where id = b.kind;
    select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
      and not span_done(sp.needed) order by sp.n limit 1;
    if not found then return; end if;
    -- One unit of one thing per go, as with a wall.
    select e2.key into v_want from jsonb_each(s.needed) e2
      where (e2.value)::int > 0 and build_to_hand(p_world, p_uid, e2.key, s.x, s.y, null) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    -- Out of the pack, a crate on the span or the stores within reach, as a wall's is.
    if not take_material(p_world, p_uid, v_want, s.x, s.y, null) then return; end if;
    update bridge_span sp set needed = jsonb_set(sp.needed, array[v_want],
        to_jsonb(greatest(0, (sp.needed->>v_want)::int - 1)))
      where sp.world_id = p_world and sp.bridge = b.id and sp.n = s.n
      returning * into s;
    perform skill_raise(p_world, p_uid, d.skill, 0.5);
    perform wear_tool((select i.id from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = d.tool
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1), 0.4);
    if span_done(s.needed) then
      v_left := bridge_left(p_world, b.id);
      if v_left > 0 then
        perform tell(p_world, p_uid, 'Span decked. ' || v_left || ' open.', 'event');
      else
        perform journal_note(p_world, p_uid, 'bridged');
        perform journal_note(p_world, p_uid, 'bridged:' || b.kind);
        perform tell(p_world, p_uid, 'Last span decked: ' || lower(bridge_name(b))
          || ' open. ' || bridge_crosses(b), 'system');
      end if;
    else
      perform tell(p_world, p_uid, 'Added: '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || '. Span needs ' || span_wants(s.needed) || '.', 'event');
    end if;

  elsif p_action = 'demolish_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    -- Half of what went into it comes back, which is what pulling a thing down
    -- is worth anywhere else in the world.
    v_parts := '{}';
    for e in
      select k.key as item, sum((k.value)::int - coalesce((sp.needed->>k.key)::int, 0))::int as used
      from bridge_span sp cross join lateral jsonb_each(sp.total) k
      where sp.world_id = p_world and sp.bridge = b.id
      group by k.key order by k.key
    loop
      v_half := floor(e.used / 2.0)::int;
      if v_half > 0 then
        perform give(p_world, p_uid, e.item, v_half, 20);
        v_parts := v_parts || (v_half || ' ' ||
          lower((select coalesce(name, e.item) from item_def where id = e.item)));
      end if;
    end loop;
    delete from bridge_span where world_id = p_world and bridge = b.id;
    delete from bridge where world_id = p_world and id = b.id;
    perform tell(p_world, p_uid, case when array_length(v_parts, 1) > 0
      then 'Removed: ' || lower(bridge_name(b)) || '. Salvaged: '
           || array_to_string(v_parts, ', ') || '.'
      else 'Removed: ' || lower(bridge_name(b)) || '.' end, 'event');

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into p from player where world_id = p_world and uid = p_uid;
    r := deed_at(p_world, pc.x, pc.y);
    if r.world_id is null then return; end if;
    v_n := 0;
    -- Every wildermon working the deed drops what it is doing and walks to
    -- whoever rang: a leg to the ringer, and a while standing there before
    -- the work takes it back.
    for e in select cr.*, coalesce(sp.speed, 1) as pace
             from creature cr join species_def sp on sp.id = cr.species
             where cr.world_id = p_world and cr.mode = 'deed' and cr.hitched_to is null
               -- Within hearing of the bell (`bell_heard_by`).
               and sqrt(power(cr.to_x - pc.cx, 2) + power(cr.to_y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)
               and cr.keeper in (select m.uid from deed_member m
                                 where m.world_id = p_world and m.founder = r.founded_by
                                 union select r.founded_by)
    loop
      v_ql := greatest(0.5, sqrt(power(p.x - e.to_x, 2) + power(p.y - e.to_y, 2)) / greatest(0.4, e.pace));
      update creature set phase = 'idle', work_x = null, work_y = null, enemy = null,
          from_x = e.to_x, from_y = e.to_y, to_x = p.x, to_y = p.y,
          leg_at = now(), leg_ends = now() + make_interval(secs => v_ql),
          until = now() + make_interval(secs => v_ql + 20)
        where world_id = p_world and id = e.id;
      v_n := v_n + 1;
    end loop;
    -- And every citizen hears where it hangs.
    for e in select m.uid from deed_member m where m.world_id = p_world and m.founder = r.founded_by
             union select r.founded_by
    loop
      if e.uid <> p_uid and exists (select 1 from player q where q.world_id = p_world and q.uid = e.uid
                                      and sqrt(power(q.x - pc.cx, 2) + power(q.y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)) then
        perform tell(p_world, e.uid, 'The bell rings out over ' || r.name || ' from ' || pc.x || ', ' || pc.y || '.', 'system');
      end if;
    end loop;
    perform journal_note(p_world, p_uid, 'rang');
    perform tell(p_world, p_uid, 'Rang: ' || lower(placed_name(pc)) || ' at ' || pc.x || ', ' || pc.y || '. Heard within '
      || floor(bell_heard_by(p_world, p_uid) + 0.5)::int || ' tiles. Settlement workers called: '
      || v_n || '. Citizens of ' || r.name || ' in hearing notified.', 'event');

  elsif p_action = 'sleep' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    /*
     * A well-made bed is a better night than a cot with a thin mattress — and
     * a bed under a roof, in a room with walls all round it, is a better night
     * again than the same bed standing in a field in the weather.
     */
    perform journal_note(p_world, p_uid, 'slept');
    -- In a bed you built, for the journal.
    if pc.made_by = p_uid then perform journal_note(p_world, p_uid, 'slept:own'); end if;
    -- Lain down in it and logged off, asleep until the next join (`sleep_fall`, `private.sleep_wake`).
    perform sleep_fall(p_world, p_uid, pc);

  elsif p_action = 'set_home' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    update player set home_x = pc.x, home_y = pc.y where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'Home set: ' || lower(placed_name(pc))
      || '. You respawn here.', 'event');

  elsif p_action = 'pair_creature' then
    c := target_creature(p_world, p_target);
    mate := mate_for(p_world, c);
    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null
       or cross_refuses(p_world, p_uid, c, mate) is not null then return; end if;
    if c.sex = 'female' then dam := c; sire := mate; else dam := mate; sire := c; end if;
    v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
    v_care := (dam.care + sire.care) / 2;
    v_took := random() < pair_chance(v_skill, v_care, cross_of(dam.species, sire.species) is not null);
    perform skill_raise(p_world, p_uid, 'animal_husbandry', try_gain(v_took, breed_gain()));
    if not v_took then
      -- A failed pairing costs both of them a rest, but only half of one.
      -- Half a shorter one for the breeder's Short Rest.
      update creature set bred_at = now() - make_interval(secs => breed_rest() * (1 - pk(p_world, p_uid, 'breed:rest', 1) / 2))
        where world_id = p_world and id in (dam.id, sire.id);
      perform tell(p_world, p_uid, 'Pairing failed: ' || dam.name || ' and ' || sire.name || '.', 'error');
      return;
    end if;
    perform pair_them(p_world, dam.id, sire.id, v_skill, p_uid, p_target->>'sex');
    perform journal_note(p_world, p_uid, 'paired');
    perform wtell(p_world, p_uid, 'Paired: ' || sire.name || ' with ' || dam.name
      || coalesce(' (cross: ' || (select x.name from species_def x where x.id = cross_of(dam.species, sire.species)) || ')', '')
      || '. Due in ' || clock_left(gestation_of(pk(p_world, p_uid, 'breed:gestation', 1), dam))
      || '. Traits between them: '
      || trait_names((select array_agg(distinct t) from unnest(sire.traits || dam.traits) t))
      || '.', 'event');

  elsif p_action = 'read_blood' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    perform wtell(p_world, p_uid, blood_read(p_world, p_uid, c), 'event');

  elsif p_action = 'dye_item' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    -- The litres the thing takes, out of the bucket or barrel chosen (`pickDye`), and exactly its colour.
    v_n := dye_litres_for(it.def);
    v_from := dye_pick(p_world, p_uid, v_n, p_target);
    if v_from is null then return; end if;
    v_want := dye_source_hex(p_world, p_uid, v_from);
    if not dye_spend(v_from, v_n) then return; end if;
    -- A woven rug already dyed takes the colour as its next (`decor.ts`).
    if it.def = woven_rug_kind() and it.dye is not null then
      update item set garden = jsonb_set(coalesce(garden, '{}'::jsonb), '{tints}', coalesce(garden->'tints', '[]'::jsonb) || to_jsonb(v_want))
       where id = it.id;
    -- A stack is split so the rest stays as it was.
    elsif it.count > 1 then
      update item set count = count - 1 where id = it.id;
      insert into item (world_id, holder, holder_uid, def, ql, dmg, count, extra, rare, dye)
      values (p_world, it.holder, it.holder_uid, it.def, it.ql, it.dmg, 1, it.extra, it.rare, v_want);
    else
      update item set dye = v_want where id = it.id;
    end if;
    perform journal_note(p_world, p_uid, 'dyed');
    perform journal_note(p_world, p_uid, 'dyed:' || it.def);
    perform skill_raise(p_world, p_uid, 'alchemy', 0.3);
    perform tell(p_world, p_uid, 'Dyed: ' || colour_word(v_want)
      || ' (' || v_want || '). Dye used: ' || litres_word(v_n) || '.', 'event');

  elsif p_action = 'strip_dye' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    select * into dye from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = 'lye_bucket' order by i.id limit 1;
    if dye.id is null or not take_litres(p_world, p_uid, 'lye_bucket', lye_use(), false) then return; end if;
    -- And a woven rug's further colours with its first (`decor.ts`).
    update item set dye = null, garden = nullif(coalesce(garden, '{}'::jsonb) - 'tints', '{}'::jsonb) where id = it.id;
    perform skill_raise(p_world, p_uid, 'alchemy', 0.2);
    perform tell(p_world, p_uid, 'Dye removed: plain '
      || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if bd.id is null or pc.id is null
       or brew_reason(p_world, p_uid, pc, bd) is not null then return; end if;
    -- What goes in decides most of what comes out; the hand only decides how
    -- much of it survives the working.
    select i.* into v_stock from craft_stock(p_world, p_uid) h join item i on i.id = h.id
      where h.def = bd.input order by h.draw limit 1;
    v_ql := coalesce(v_stock.ql, 20);
    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      v_parts := craft_fail_damage(p_world, p_uid, bd.input, bd.count)
        || fail_litres_said((select l.name from liquid_def l where l.id = 'water'), bd.litres,
                            least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)));
      update placed set litres = placed_litres(pc) - least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, fail_damaged_said('Failed: ' || lower(bd.name) || '.', v_parts), 'event');
      return;
    end if;
    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;
    update placed set litres = bd.litres, liquid = bd.id, ferment = private.brew_seconds(pc, bd), since = now(),
        ql = greatest(1, least(100, (v_ql + skill_of(p_world, p_uid, 'brewing')) / 2)),
        -- Its brewer's hand in it, which goes into every bucket drawn off it (a Cook's Strong Brew).
        knack = nullif(pk(p_world, p_uid, 'brewed:' || bd.id, 1), 1)
      where id = pc.id;
    perform journal_note(p_world, p_uid, 'brew');
    perform journal_note(p_world, p_uid, 'brew:' || bd.id);
    perform skill_raise(p_world, p_uid, 'brewing', try_gain(true, brew_gain()));
    -- Rounded half up, as the browser's `Math.round` does: a wine's 112.5 minutes said 112 here and 113 there.
    perform tell(p_world, p_uid, bd.done || ' Ready in about ' || floor(private.brew_seconds(pc, bd) / 60 + 0.5)::bigint || ' minutes.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.perform_scrub(p_world uuid, p_uid uuid, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare it item; pc placed;
begin
  if private.scrub_refusal(p_world, p_uid, p_target) is not null then return; end if;
  if p_target->>'kind' = 'furniture' then
    pc := target_placed(p_world, p_target);
    -- And a woven rug's further colours with its first (`decor.ts`).
    update placed set dye = null, garden = nullif(coalesce(garden, '{}'::jsonb) - 'tints', '{}'::jsonb) where world_id = p_world and id = pc.id;
    perform tell(p_world, p_uid, 'Dye removed: plain '
      || lower(coalesce((select f.name from furniture_def f where f.id = pc.sub), pc.sub)) || '.', 'event');
    return;
  end if;
  select * into it from item where world_id = p_world and id = target_item(p_target);
  update item set dye = null, garden = nullif(coalesce(garden, '{}'::jsonb) - 'tints', '{}'::jsonb) where id = it.id;
  perform tell(p_world, p_uid, 'Dye removed: plain '
    || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');
end $function$;

CREATE OR REPLACE FUNCTION public.perform_craft(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_scales int := 0; v_hoard int := 0; r recipe; i record; v_n int; prefer bigint; mat text; hard double precision; tq double precision;
        s double precision; made_ql double precision; rare text; total double precision := 0;
        v_made bigint; weight double precision := 0; one double precision; share double precision;
        only_mat boolean; was text; v_base int; spared boolean := false; v_mark jsonb;
        v_parts jsonb := '{}'::jsonb; v_part jsonb; v_own jsonb; v_lye double precision; v_kept boolean := false;
        v_keep double precision; v_spare recipe_input; v_spare_ql double precision;
        v_tool bigint; v_tool_mark jsonb; v_stone boolean := false;
        v_scroll boolean; v_sheet double precision; v_harm text; v_used int[]; v_hurt text[] := '{}';
        v_rope double precision; v_sail double precision;
begin
  select * into r from recipe where id = p_recipe;
  prefer := target_item(p_target);
  -- What the run is aimed at, while it is still there to ask.
  select it.def into was from item it where it.id = prefer and it.world_id = p_world;
  mat := craft_material(p_world, p_uid, p_recipe, prefer);
  s := skill_of(p_world, p_uid, r.skill);
  tq := case when r.tool is null then 0 else tool_ql(p_world, p_uid, r.tool) end;
  /*
   * The tool wears on every go, whether or not the go comes off, as it does in
   * the hand and always has in the browser (`Game.act`). The island's bench
   * never wore anything, so a saw sawed for ever -- and a Carpenter's Saw
   * Care, which is how much less it wears (`wear_tool`), spared nothing.
   */
  if r.tool is not null then
    -- The one it is done with, and what its maker put into it, read before it
    -- is worn: a pot's, a bowl's or a jar's (an Artisan's Deep Pot and Sealed Jar).
    v_tool := held_tool(p_world, p_uid, r.tool);
    select it.mark into v_tool_mark from item it where it.id = v_tool;
    perform wear_tool(v_tool);
  end if;
  -- Oak and the deep metals fight the hands that shape them.
  hard := craft_hardness(p_recipe, mat);
  -- Bars broken into for what loose lumps are short of (a Smith's Ingots),
  -- before anything reads the lumps: what they weigh in the quality, and what
  -- a failed batch throws away.
  for i in select ri.item, ri.count from recipe_input ri join metal_def m on m.lump = ri.item where ri.recipe = p_recipe loop
    perform break_bars(p_world, p_uid, i.item,
      recipe_need(p_world, p_uid, p_recipe, i.count) - craft_count_loose(p_world, p_uid, i.item, null, prefer), prefer);
  end loop;

  -- An enchantment scroll (`enchant.ts`), and the sheet it would be written on, read before anything is spent.
  v_scroll := exists (select 1 from enchantments() e where e.scroll = r.result);
  if v_scroll then
    select st.ql into v_sheet from craft_stock(p_world, p_uid, prefer) st
     where st.def = 'papyrus' order by (st.id = prefer) desc, st.draw limit 1;
  end if;

  -- A Mason's Sure Chisel fails half as often on stonecutting (`fail:` and the recipe).
  if r.difficulty is not null and not perk_pass(skill_check(s, hard, tq), pk(p_world, p_uid, 'fail:' || p_recipe, 1)) then
    -- A scroll that fails loses its motes and damages the sheet it was being written on (`scroll_fails`).
    if v_scroll then
      v_harm := scroll_fails(p_world, p_uid, p_recipe, prefer);
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
      perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
      perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
      perform tell(p_world, p_uid, concat_ws(' ', r.fail, nullif(scroll_harm_said(v_harm), '')), 'event');
      return;
    end if;
    -- Nothing used up: what it would have used is damaged by its own QL, off the stacks it would have
    -- spent and in that order (`craft_fail_damage`, `craft_fail_litres`), and nothing handed back --
    -- but not, now and then, for a perk on the recipe (a Mason's or a Tailor's Nothing Wasted).
    if pk(p_world, p_uid, 'spare:' || p_recipe, 0) > 0 then
      spared := random() < pk(p_world, p_uid, 'spare:' || p_recipe, 0);
    end if;
    -- And the stone spared, whatever else is damaged, for an Artisan's Keep the Stone.
    v_stone := not spared and pk(p_world, p_uid, 'stone:' || p_recipe, 0) > 0
               and exists (select 1 from recipe_input where recipe = p_recipe and item = 'gem');
    if not spared then
      for i in select * from recipe_input where recipe = p_recipe order by ord loop
        continue when v_stone and i.item = 'gem';
        if i.litres is not null then
          v_hurt := v_hurt || craft_fail_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres));
        else
          -- Above Ropemaking 50 a failed lay-up damages half its fibre, the rest untouched (`rope_fail_units`).
          v_hurt := v_hurt || craft_fail_damage(p_world, p_uid, i.item,
            case when rope_lay_up(p_recipe) then rope_fail_units(recipe_need(p_world, p_uid, p_recipe, i.count), s)
                 else recipe_need(p_world, p_uid, p_recipe, i.count) end, prefer, mat);
        end if;
      end loop;
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
    end if;
    perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, fail_damaged_said(
      coalesce(r.fail, 'Failed: ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.'), v_hurt),
      'event');
    if spared then perform tell(p_world, p_uid, 'Nothing Wasted: inputs undamaged.', 'event'); end if;
    if v_stone then perform tell(p_world, p_uid, 'Keep the Stone: gem undamaged.', 'event'); end if;
    return;
  end if;

  -- The rope in it, by mass, for a boat's or a trap's share of its QL (`rope_ql`), read before it is spent.
  if coalesce(r.rope_share, 0) > 0 then v_rope := rope_ql(p_world, p_uid, p_recipe, prefer, mat); end if;
  -- And a hull's sailcloth, for her sails' pace (`sail_ql_pace`).
  if exists (select 1 from boat_def b where b.id = r.result)
     and exists (select 1 from recipe_input ri where ri.recipe = p_recipe and ri.item = 'sailcloth') then
    select st.ql into v_sail from craft_stock(p_world, p_uid, prefer) st
     where st.def = 'sailcloth' order by (st.id = prefer) desc, st.draw limit 1;
  end if;
  -- The quality of what is about to be used up, worked out before it is used
  -- up, since using it up changes the answer: off the stack each input would
  -- be spent from first, which is the clicked one where it is one of them.
  if r.ql_from_inputs then
    for i in select * from recipe_input where recipe = p_recipe order by ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select st.ql into one from craft_stock(p_world, p_uid, prefer) st
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if one is not null then
        -- By mass, not by the count. Two nails weigh two hundredths of a
        -- kilogram between them and do not get to decide what a pickaxe is.
        share := coalesce((select d.weight from item_def d where d.id = i.item), 1) * i.count;
        total := total + one * share;
        weight := weight + share;
      end if;
    end loop;
  end if;

  /*
   * What the parts carry of their makers' marks, off the stack each would be
   * spent from first, before spending them: a Smith's Keen Edge in a sword
   * blade goes into the sword whoever fits it. Only the parts the anvil beats
   * out, which are the only ones that carry a mark into anything, and only for
   * a thing made one at a time, which has a row to carry it; the larger where
   * two say the same, and never a temper, which is for whoever finishes it,
   * nor a seal or a glaze, which is on the part and not on what it goes into.
   */
  if not item_stackable(r.result) then
    for i in select ri.* from recipe_input ri where ri.recipe = p_recipe
               and (exists (select 1 from mould_def md where md.makes = ri.item)
                    -- And a yoke's pace into the cart or wagon it goes on (a Tailor's Saddler).
                    or ri.item in ('yoke')) order by ri.ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select it.mark into v_part from craft_stock(p_world, p_uid, prefer) st join item it on it.id = st.id
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if v_part is not null then
        select v_parts || coalesce(jsonb_object_agg(k.key, greatest(k.value::text::double precision,
                 coalesce((v_parts->>k.key)::double precision, k.value::text::double precision))), '{}'::jsonb)
          into v_parts
          from jsonb_each(v_part - 'temper' - 'seal' - 'glaze') k;
      end if;
    end loop;
  end if;
  /*
   * A Cook's Frugal Cook: one of the first ingredient that is not a vessel
   * back now and then, at the quality of the stack it would be spent from
   * first -- asked before the spending, which changes the answer. Only asked
   * of a recipe the perk is on.
   */
  v_keep := pk(p_world, p_uid, 'keep:' || p_recipe, 0);
  if v_keep > 0 then
    select ri.* into v_spare from recipe_input ri
     where ri.recipe = p_recipe and ri.item <> 'bucket'
       and not exists (select 1 from vessel_def v where v.item = ri.item)
     order by ri.ord limit 1;
    if v_spare.item is not null then
      only_mat := mat is not null and craft_count(p_world, p_uid, v_spare.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, v_spare.count);
      select st.ql into v_spare_ql from craft_stock(p_world, p_uid, prefer) st
        where st.def = v_spare.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
    end if;
  end if;
  -- A Tailor's Lye Saver: now and then the vessel's liquid is not used up,
  -- and the full vessel stays as it was rather than coming back empty.
  v_lye := pk(p_world, p_uid, 'lye:' || p_recipe, 0);
  v_kept := v_lye > 0 and random() < v_lye;
  -- The units used up, by their rarity, for what rare ones put on the chance of a rare one (`rarity_bands`):
  -- what was at hand before the go less what is after it.
  -- The dragon scales at hand before the go, all and hoard (`hoard_scale`), for what it spends of each.
  v_scales := craft_count(p_world, p_uid, 'dragon_scale', null, prefer);
  v_hoard := craft_count(p_world, p_uid, 'dragon_scale', hoard_scale(), prefer);
  v_used := craft_units_held(p_world, p_uid, p_recipe, prefer);
  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    continue when v_kept and exists (select 1 from vessel_def v where v.item = i.item);
    if i.litres is not null then
      if not take_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres)) then return; end if;
      continue;
    end if;
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;
  end loop;
  v_used := rarity_tally_less(v_used, craft_units_held(p_world, p_uid, p_recipe, prefer));
  v_scales := v_scales - craft_count(p_world, p_uid, 'dragon_scale', null, prefer);
  v_hoard := v_hoard - craft_count(p_world, p_uid, 'dragon_scale', hoard_scale(), prefer);
  perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);

  if r.ql_from_inputs then
    made_ql := greatest(1, least(100, (case when weight > 0 then total / weight else 1 end) * (0.78 + s / 460)));
  else
    made_ql := product_ql(case when v_scales > 0 and v_hoard = v_scales then s * hoard_scale_cap() else s end, tq);
  end if;
  -- And the rope's share of it, for a boat or a trap (`ropeBlend`).
  if v_rope is not null then made_ql := made_ql * (1 - r.rope_share) + v_rope * r.rope_share; end if;
  -- And the tree, on the trade the recipe belongs to: the quality of what came
  -- off the bench, however it was arrived at. A hundred is still a hundred.
  made_ql := least(100, made_ql * class_mul(p_world, p_uid, 'fine', r.skill));
  -- And better for a perk on the recipe (a Cook's Fine Fare).
  -- And higher for a Masterwork on the station it is made at (`station_master`).
  -- And better at a rope walk, for a lay-up (`rope_walk_ql`).
  made_ql := least(100, made_ql * pk(p_world, p_uid, 'ql:' || p_recipe, 1) + station_master(p_world, p_uid, r.station)
                        + rope_walk_ql(p_world, p_uid, p_recipe));
  -- And a scroll never better than the sheet it was written on.
  if v_scroll and v_sheet is not null then made_ql := least(made_ql, v_sheet); end if;
  -- A Carpenter's Master Joiner: the first step of rarity at better odds on the joinery (`rare:` and the recipe).
  -- And by the rare things that went into it, each step by its share of the units used (`rarity_roll_from`).
  rare := rarity_roll_from(v_used, press_stamp(p_world, p_uid, pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1))));
  -- More, the go a bauble on the trade comes up in the altar of the settlement you work on.
  -- A Mason's Three from a Shard and Good Mix: more of it at a go (`count:` and what it makes).
  -- A lay-up's count by Ropemaking (`rope_per_lay_up`), before a perk on it.
  v_base := pk(p_world, p_uid, 'count:' || r.result,
               r.count * case when rope_lay_up(p_recipe) then rope_per_lay_up(s) else 1 end)::int;
  -- And a serving more of a dish cooked in a pot or a bowl its maker had Deep Pot for, whoever cooks.
  if is_dish(r.result) then v_base := v_base + floor(coalesce((v_tool_mark->>'serve')::double precision, 0))::int; end if;
  -- But not on a dye boil, which fills the one bucket it is done in (`boiledDye`).
  v_n := case when r.result = 'dye_bucket' then v_base else bauble_yield(p_world, p_uid, r.result, v_base) end;
  /*
   * What the maker's perks put into it, which stays with it whoever has it
   * after (a Carpenter's Deep Drawers, Keel Layer, True Bow; a Cook's Hearty),
   * over what its parts carried (a Smith's Keen Edge). A pile of the same
   * thing marked the same way is one pile, so a thing made by the handful goes
   * into the pack with its mark and stacks by it; a thing made one at a time
   * is a row of its own and takes it after.
   */
  v_own := coalesce(made_mark((select pl.class_mul from player pl
                                where pl.world_id = p_world and pl.uid = p_uid), r.result), '{}'::jsonb);
  v_mark := v_parts || v_own;
  -- A pace is multiplied, since a yoke's and a builder's are two reasons to go
  -- faster; the maker's own stands over the parts' in everything else.
  if v_parts ? 'speed' and v_own ? 'speed' then
    v_mark := jsonb_set(v_mark, '{speed}', to_jsonb((v_parts->>'speed')::double precision * (v_own->>'speed')::double precision));
  end if;
  -- And what is put up in a jar its maker had Sealed Jar for rots the slower for it.
  if v_tool_mark ? 'keeps' then
    v_mark := v_mark || jsonb_build_object('rot', mark_of(v_mark, 'rot') * mark_of(v_tool_mark, 'keeps'));
  end if;
  if v_sail is not null then v_mark := coalesce(v_mark, '{}'::jsonb) || jsonb_build_object(sails_mark(), sail_ql_pace(v_sail)); end if;
  v_mark := nullif(v_mark, '{}'::jsonb);
  -- Set going rather than made: sealed in its vessel, to be opened when ready (`sealFerment`).
  if exists (select 1 from ferment_recipes() f where f.id = p_recipe) then
    if rare_input_said(v_used) is not null then perform tell(p_world, p_uid, rare_input_said(v_used), 'event'); end if;
    v_made := give(p_world, p_uid, sealed_item(), 1, made_ql, (select f.title from ferment_recipes() f where f.id = p_recipe), rare);
    update item set charges = ceil(world_time(p_world) + (select f.seconds from ferment_recipes() f where f.id = p_recipe))::int
     where id = v_made;
    perform skill_raise(p_world, p_uid, r.skill, 1);
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
    perform tell(p_world, p_uid, 'Sealed: ' || lower((select f.title from ferment_recipes() f where f.id = p_recipe))
      || '. Ready in ' || clock_left((select f.seconds from ferment_recipes() f where f.id = p_recipe)) || '.', 'event');
    return;
  end if;
  if item_stackable(r.result) then
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, maker_mark(p_world, p_uid, rare), null, v_mark);
  else
    -- One thing made at the signing QL carries its maker's name, as rare work does (`made_by`).
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, made_by(p_world, p_uid, rare, r.result, made_ql));
    if v_mark is not null then update item set mark = v_mark where id = v_made; end if;
    -- A carved figure, carved as the kind chosen at the bench (`garden.ts`).
    if r.result = carved_figure_kind() then
      update item set garden = jsonb_build_object('figure', p_target->>'species') where id = v_made;
    end if;
    -- A woven rug, in the pattern chosen at the loom, the first when none is (`decor.ts`).
    if r.result = woven_rug_kind() then
      update item set garden = jsonb_build_object('pattern',
        case when p_target->>'pattern' = any (rug_patterns()) then p_target->>'pattern' else (rug_patterns())[1] end) where id = v_made;
    end if;
  end if;
  -- A boil leaves its dye in the bucket it was boiled in (`boiledDye`).
  if r.result = 'dye_bucket' then perform dye_boiled(p_world, p_uid, v_made, p_recipe); end if;
  -- A vessel comes off the bench full: a bucket of juice holds its five drinks.
  update item set charges = d.charges from item_def d
    where item.id = v_made and item.charges is null and d.id = item.def and d.charges is not null;
  -- Into the ledger, which is the only memory this island has of what you have
  -- made. It says so when it is your first of a kind or your best.
  perform journal_made(p_world, p_uid, r.result, made_ql, v_n, rare);
  -- What the rare ingredients put on the chance, said whether or not it came up.
  if rare_input_said(v_used) is not null then perform tell(p_world, p_uid, rare_input_said(v_used), 'event'); end if;
  if rare is not null then
    perform journal_note(p_world, p_uid, rare);
    perform tell(p_world, p_uid, rarity_word(rare), 'skill');
  end if;
  for i in select g.item, g.count from recipe_gives g where g.recipe = p_recipe and g.kind = 'return' loop
    continue when v_kept and exists (select 1 from recipe_input ri join vessel_def v on v.item = ri.item
                                      where ri.recipe = p_recipe and v.empty = i.item);
    perform give(p_world, p_uid, i.item, i.count, 20);
  end loop;
  if v_kept then perform tell(p_world, p_uid, 'Lye Saver: lye kept.', 'event'); end if;
  if v_spare.item is not null and random() < v_keep then
    perform give(p_world, p_uid, v_spare.item, 1, coalesce(v_spare_ql, made_ql));
    perform tell(p_world, p_uid, 'Frugal Cook: '
      || case when lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) ~ '^[aeiou]' then 'an ' else 'a ' end
      || lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) || ' kept.', 'event');
  end if;

  perform skill_raise(p_world, p_uid, r.skill, 1);
  -- Working a thing out with your hands is what sharpens the head.
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
  perform tell(p_world, p_uid, craft_made_said(r.result, v_base, mat, made_ql, r.done), 'event');
end $function$;

CREATE OR REPLACE FUNCTION public.reap_what(p_world uuid, p_uid uuid, p_id text, p_tended integer, p_ql double precision, p_skill double precision, OUT o_produce text, OUT o_got integer, OUT o_seed text, OUT o_seeds integer, OUT o_ql double precision, OUT o_rare text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
declare cd crop_def; yld int[]; v_grass int;
begin
  select * into cd from crop_def where id = p_id;
  if cd.id is null then return; end if;
  yld := crop_yield(p_tended);
  if p_tended >= crop_ripe() then
    yld[2] := yld[2] + floor(pk(p_world, p_uid, 'bumper:harvest_crop', 0))::int;
  end if;
  -- The crop's own quality, lifted by the farmer's skill at harvest.
  o_ql := greatest(1, least(100, (p_ql + product_ql(p_skill, 0)) / 2));
  -- And compost spread on it, while one is being harvested (`reap_one`, `reap_planter`; `decor.ts`).
  o_ql := least(100, o_ql + coalesce(nullif(current_setting('wildermon.reap_boost', true), '')::double precision, 0));
  -- Love's Abundance takes more out of the same ground, a half rounded up as the browser rounds it.
  -- And a herb box's share of a planter's, while one is being harvested (`reap_planter`).
  o_got := greatest(1, floor(yld[2] * path_fx(p_world, p_uid, 'harvest', 1)
             * coalesce(nullif(current_setting('wildermon.reap_share', true), '')::double precision, 1) + 0.5)::int)
         + floor(pk(p_world, p_uid, 'plus:' || cd.produce, 0))::int;
  o_rare := perk_rare(pk(p_world, p_uid, 'rare:harvest_crop', 0));
  o_produce := cd.produce;
  o_seed := cd.seed;
  o_seeds := harvest_seeds(pk(p_world, p_uid, 'seed:harvest_crop', seed_chance()));
  perform gather(p_world, p_uid, cd.produce, o_got, o_ql, null, o_rare);
  if o_seeds > 0 then perform gather(p_world, p_uid, cd.seed, o_seeds, o_ql); end if;
  v_grass := floor(pk(p_world, p_uid, 'fodder:harvest_crop', 0))::int;
  if v_grass > 0 then perform give(p_world, p_uid, 'mixed_grass', v_grass, o_ql); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.reap_one(p_world uuid, p_uid uuid, p_x integer, p_y integer, p_skill double precision, OUT o_produce text, OUT o_got integer, OUT o_seed text, OUT o_seeds integer, OUT o_ql double precision, OUT o_rare text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
declare c crop; r record;
begin
  select * into c from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  if c.id is null then return; end if;
  -- Compost spread on it (`decor.ts`).
  perform set_config('wildermon.reap_boost', case when c.fed then compost_boost()::text else '' end, true);
  select * into r from reap_what(p_world, p_uid, c.id, c.tended, c.ql, p_skill);
  perform set_config('wildermon.reap_boost', '', true);
  o_produce := r.o_produce; o_got := r.o_got; o_seed := r.o_seed; o_seeds := r.o_seeds; o_ql := r.o_ql; o_rare := r.o_rare;
  if c.glass then perform journal_note(p_world, p_uid, 'harvest:glass'); end if;
  perform journal_note(p_world, p_uid, 'harvest:' || r.o_produce);
  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  perform land_announce(p_world, p_x, p_y);
end $function$;

CREATE OR REPLACE FUNCTION public.reap_planter(p_world uuid, p_uid uuid, p_placed bigint, p_skill double precision, OUT o_produce text, OUT o_got integer, OUT o_seed text, OUT o_seeds integer, OUT o_ql double precision, OUT o_rare text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
declare c planter_crop; p placed; r record;
begin
  select * into c from planter_crop where placed = p_placed and world_id = p_world;
  if c.placed is null then return; end if;
  -- A herb box gives its share of a planter's yield (`garden.ts`).
  select * into p from placed where id = p_placed;
  perform set_config('wildermon.reap_share', coalesce((select f.herbs from furniture_def f where f.id = p.sub), 1)::text, true);
  -- And compost spread on it (`decor.ts`).
  perform set_config('wildermon.reap_boost', case when c.fed then compost_boost()::text else '' end, true);
  select * into r from reap_what(p_world, p_uid, c.id, c.tended, c.ql, p_skill);
  perform set_config('wildermon.reap_boost', '', true);
  perform set_config('wildermon.reap_share', '', true);
  o_produce := r.o_produce; o_got := r.o_got; o_seed := r.o_seed; o_seeds := r.o_seeds; o_ql := r.o_ql; o_rare := r.o_rare;
  delete from planter_crop where placed = p_placed;
  select * into p from placed where id = p_placed;
  perform land_announce(p_world, p.x, p.y);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_ground(p_world uuid, p_range double precision DEFAULT 40, p_slow boolean DEFAULT true, p_since text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; v_field double precision; v_box double precision; v_hand double precision;
        -- When greening came to this island (`greening.ts`).
        v_from timestamptz := (select w.green_from from world w where w.id = p_world);
        -- The kinds of furniture that are wells (`is_well`): only theirs is asked how much water is in them.
        v_wells text[] := array(select d.id from furniture_def d where d.well > 0);
        -- What the browser last saw (`since_snap`) and where the body stood then, or null for the whole answer.
        v_snap bigint[]; v_wx double precision; v_wy double precision; m text[];
        -- Pieces whose answer moves without their row being written: a well, a mossy one, a boat (who is aboard).
        v_hot text[];
        -- How many things are in the pieces within reach (`things`) of where the body stands, and stood; and whether
        -- what is in those it stood by has changed since (`v_reach`).
        v_n int; v_was_n int; v_reach boolean;
        v_at text; v_placed jsonb; v_lying jsonb; v_cellar jsonb;
        v_pids bigint[]; v_lids bigint[]; v_cids bigint[]; v_out jsonb; v_crates jsonb; v_ch text; v_had text;
begin
  perform private.pace(auth.uid(), 'look');
  p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  /*
   * On the slow half only, because this writes.
   *
   * The fast read runs about once a second per body — everything burning, what
   * is on the tile under you — and a settle on that path is an update a second
   * per player whether or not anything is due. The crops ride the slow half
   * beside the settlements, and any of your own work forces one of those, so
   * sowing is seen at once and a stage is at worst one reconcile late.
   */
  if p_slow then
    perform crops_settle(p_world, p.x, p.y, p_range);
    perform planters_settle(p_world, p.x, p.y, p_range);
    -- Each clock read once, for every crop on it.
    v_field := crop_clock(false, now());
    v_box := crop_clock(true, now());
    v_hand := hand_clock(now());
  end if;
  /*
   * Only what changed since the cursor the browser hands back (`p_since`, `g1:<x>:<y>:<range>:<n>:<v1 cursor>`):
   * where the body stood, how far it read, how many things were in the pieces within reach of it, and the snapshot it
   * was read in (`since_snap`). Unreadable, too old, or read over another range: the whole answer.
   */
  -- The crates' hash as the last answer had them, ahead of the cursor proper.
  if p_since ~ '^c[0-9a-f]{8}:' then
    v_had := substr(p_since, 2, 8);
    p_since := substr(p_since, 11);
  end if;
  if p_since is not null then
    -- The same pattern as a yes or no; then the four fields between the first colons, and the `v1` cursor after them.
    m := case when p_since ~ '^g1:-?[0-9.]+(?:e[-+]?[0-9]+)?:-?[0-9.]+(?:e[-+]?[0-9]+)?:[0-9.]+(?:e[-+]?[0-9]+)?:[0-9]{1,9}:v1:'
               then (string_to_array(p_since, ':'))[2:5] || array_to_string((string_to_array(p_since, ':'))[6:], ':') end;
    if m is not null and m[3]::double precision = p_range then
      v_snap := private.since_snap(m[5]);
      v_wx := m[1]::double precision;
      v_wy := m[2]::double precision;
    end if;
  end if;
  if v_snap is not null then
    v_hot := array(select d.id from furniture_def d where d.well > 0 or d.mossy union select b.id from boat_def b);
  end if;
  /*
   * The cursor before anything is read: every statement below sees at least what this snapshot saw, so a row is
   * never counted as seen that was not, and one written in between is only sent twice.
   */
  v_at := floor(extract(epoch from now()) * 1000)::bigint || ':' || private.since_text(pg_current_snapshot());
  /*
   * What is in the pieces within reach, which the pieces' own rows do not say: counted where the body stands, for
   * the next cursor, and where it stood, against the count the cursor carries. A thing put in has a row written
   * since; one taken out is one fewer. Either way every piece within reach of either is sent again; otherwise only
   * those come into reach or gone out of it. Counted before the pieces are read, so a thing taken out in between is
   * one fewer next time rather than never.
   */
  if p_since is not null then
    select count(*) into v_n
      from item i join placed pl on pl.world_id = p_world and pl.id = i.placed
     where i.world_id = p_world and i.holder = 'furniture'
       and pl.x between floor(p.x - 6)::int - 1 and floor(p.x + 6)::int + 1
       and pl.y between floor(p.y - 6)::int - 1 and floor(p.y + 6)::int + 1
       and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6;
    v_at := 'g1:' || p.x::text || ':' || p.y::text || ':' || p_range::text || ':' || v_n || ':v1:' || v_at;
  end if;
  if v_snap is not null then
    select count(*), coalesce(bool_or(private.since_new(i.xmin, v_snap)), false) into v_was_n, v_reach
      from item i join placed pl on pl.world_id = p_world and pl.id = i.placed
     where i.world_id = p_world and i.holder = 'furniture'
       and pl.x between floor(v_wx - 6)::int - 1 and floor(v_wx + 6)::int + 1
       and pl.y between floor(v_wy - 6)::int - 1 and floor(v_wy + 6)::int + 1
       and greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6;
    v_reach := v_reach or v_was_n <> m[4]::int;
  end if;
  select coalesce(jsonb_agg(
        (to_jsonb(pl) - 'world_id' - 'made_by' - 'since' - 'made_at' - 'cx' - 'cy' - 'crumbles_at')
        -- How much water is in it is asked only of a well, which is the only one it is not the column's (`placed_litres`).
        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl), 'ferment', ferment_left(pl),
                              'litres', case when pl.sub = any (v_wells) then placed_litres(pl) else pl.litres end,
                              'liquid', case when pl.sub = any (v_wells) then placed_liquid(pl) else pl.liquid end,
                              'lit', placed_lit(pl), 'mine', coalesce(pl.made_by = me, false),
        /*
         * And what is in it, which this never said.
         *
         * Reported as "i opened it and dragged my dirt into it and the dirt
         * vanished". It had not: the island had the dirt in the bin and told
         * nobody. Every chest, bin, larder and cart on an island read as
         * empty over there, so anything put away went out of the pack and was
         * never seen again — the same hole a crate fell down before crates
         * carried their contents, and closed the same way. Within six tiles
         * only: you must be within two and a half to reach into one, so six
         * is generous, and a yard of full chests is not worth a phone's
         * second.
         */
                              'things', case when pl.kind = 'furniture'
                                              and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6
                                              -- A grave's, to whoever lies under it and nobody else.
                                              and (pl.crumbles_at is null or pl.made_by = me)
                                then coalesce((select jsonb_agg(jsonb_build_object(
                                       'id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg,
                                       'count', i.count, 'extra', i.extra,
                                       -- And its rarity, its colour and its enchantment, which a chest's name for it carries (`storedThing`).
                                       'rare', i.rare, 'dye', i.dye, 'enchant', i.enchant, 'creature', i.creature, 'occupant', case when i.creature is not null then occupant_name(i.world_id, i.creature) end, 'price', i.price) order by i.id)
                                     from item i
                                     where i.world_id = p_world and i.holder = 'furniture' and i.placed = pl.id),
                                   '[]'::jsonb)
                                else '[]'::jsonb end)
        /*
         * Whether a helm is as good as empty, its holder gone away, and who is
         * aboard as a passenger and in which place: only for a piece that has
         * either, so nothing else carries two more keys it does not need.
         */
        || case when pl.driver is null then '{}'::jsonb
                else jsonb_build_object('helm_open', coalesce((select r.away from player r
                       where r.world_id = p_world and r.uid = pl.driver), true)) end
        || coalesce((select jsonb_build_object('riders', jsonb_agg(jsonb_build_object('uid', r.uid, 'seat', r.seat)
                       order by r.seat))
                     from player r where r.world_id = p_world and r.aboard = pl.id
                     having count(*) > 0), '{}'::jsonb)
        /*
         * And a grave: whose it is, for what anybody else is told when they
         * try it; the seconds it has left, which a browser counts down on its
         * own clock rather than reading this island's; and, to its owner, how
         * many things are in it, which `things` only says from within reach --
         * the way `units` rides beside a crate's contents.
         */
        || case when pl.crumbles_at is null then '{}'::jsonb
                else jsonb_build_object('grave', jsonb_build_object('name', grave_owner(pl),
                       'left', greatest(0, extract(epoch from (pl.crumbles_at - now()))),
                       'units', case when pl.made_by = me then (select coalesce(sum(i.count), 0) from item i
                                  where i.placed = pl.id and i.holder = 'furniture') end)) end
        /*
         * And for a piece with roses on it, the moment it was set down, which
         * is what its roses grow from (`roses.ts`): the same moment for
         * everybody, and sent for nothing else.
         */
        || case when coalesce((select fd.roses from furniture_def fd where fd.id = pl.sub), false)
                then jsonb_build_object('set', extract(epoch from pl.made_at)) else '{}'::jsonb end
        /*
         * And for a piece that gathers moss -- a statue -- the seconds since
         * the moss on it began: since it was set down or last scrubbed, and
         * never from before greening came in (`greening.ts`). Only for those,
         * so nothing else carries a key it does not need.
         */
        || case when pl.kind = 'furniture' and pl.sub in (select fd.id from furniture_def fd where fd.mossy)
                then jsonb_build_object('green_ago', green_ago(greatest(pl.made_at,
                       (select gs.since from green_since gs where gs.world_id = p_world and gs.thing = 'piece'
                           and gs.x = pl.x and gs.y = pl.y and gs.k = pl.id)), v_from))
                else '{}'::jsonb end
        -- And for a shop counter's store, what is set out on it and for whom (`counters.ts`).
        || case when pl.kind = 'counter' then counter_json(pl, me, p.x, p.y) else '{}'::jsonb end
        order by pl.id) filter (where v_snap is null
          -- One written since, or one not in range of where the body stood then.
          or private.since_new(pl.xmin, v_snap)
          or not (greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= p_range)
          -- And those whose answer moves without their row being written: burning (its fuel, its ash), a grave (its
          -- seconds, what is in it), a shop counter (its wares, its keeper's name), one with somebody at its reins or
          -- helm (whether they are away), a well, a mossy one, a boat (`v_hot`).
          or pl.lit or pl.crumbles_at is not null or pl.kind = 'counter' or pl.driver is not null
          or pl.sub = any (v_hot)
          -- And what is in a piece (`things`, said within six tiles): come into reach or gone out of it, or every one
          -- within reach of where the body stands or stood when what is in them has changed (`v_reach`).
          or (greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6) <> (greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6)
          or (v_reach and (greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6
                           or greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6))), '[]'::jsonb),
         coalesce(array_agg(pl.id order by pl.id), '{}')
    into v_placed, v_pids
      from placed pl
      where pl.world_id = p_world
        -- The box first, in the whole tiles `placed_near` is keyed on, and then
        -- the exact question. A btree cannot look up a function of a column, so
        -- the exact test on its own read every placed thing on the island, on
        -- every ground poll, for every player. `x` is `floor(cx)` and `y` is
        -- `floor(cy)` -- `drag_along` and every placing write both together --
        -- so a tile of slack each way makes the box a superset of the answer
        -- and the line below still decides who is in it.
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range;
  /*
   * And what is lying on the ground, which this never carried.
   *
   * Reported as "killed a roxxa, no corpse dropped to butcher, or at least
   * isn't displaying". The corpse was there: `wound_beast` drops one where
   * the thing fell, and the suite has measured it since kills were ported.
   * This sent the fires, the crates, the crops and the walls, and never a
   * thing lying on the grass — and the browser's map of the ground was only
   * ever written by its own rules, which do not run on an island. So a
   * corpse, a log a worker put down, a hatchet somebody else dropped: all
   * in this table and drawn by nobody.
   *
   * On the fast half, because a corpse is looked for the second the thing
   * goes down; `item_on_ground` serves the box. The whole row, the way the
   * pack is sent, so the browser reads it with the same map.
   */
  -- Sent again: one written since, or one not in the box round where the body stood.
  select coalesce(jsonb_agg(private.lying_row(i) order by i.id)
           filter (where v_snap is null or private.since_new(i.xmin, v_snap)
                   or not (i.gx between floor(v_wx - p_range)::int and floor(v_wx + p_range)::int
                           and i.gy between floor(v_wy - p_range)::int and floor(v_wy + p_range)::int)), '[]'::jsonb),
         coalesce(array_agg(i.id order by i.id), '{}')
    into v_lying, v_lids
      from item i
      where i.world_id = p_world and i.holder = 'ground'
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int;
  select coalesce(jsonb_agg(private.lying_row(i) order by i.id) -- cellar
           filter (where v_snap is null or private.since_new(i.xmin, v_snap)
                   or not (i.gx between floor(v_wx - p_range)::int and floor(v_wx + p_range)::int
                           and i.gy between floor(v_wy - p_range)::int and floor(v_wy + p_range)::int)), '[]'::jsonb),
         coalesce(array_agg(i.id order by i.id), '{}')
    into v_cellar, v_cids
      from item i
      where i.world_id = p_world and i.holder = 'cellar' -- cellar
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int -- cellar
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int; -- cellar
  v_crates := crates_near(p_world, me, p_range);
  v_ch := left(md5(v_crates::text), 8);
  v_out := jsonb_build_object(
    'placed', v_placed,
    'crates', v_crates,
    'lying', v_lying,
    -- cellar: and what is lying on the floors of the cellars in range, the same way (`item_in_cellar` serves the box).
    'cellarLying', v_cellar)
  /*
   * And the half that hardly ever moves.
   *
   * A fire burns down and a kiln works through its load while you stand and
   * watch it, which is why this is asked for every second. A wall is not like
   * that: it goes up when somebody builds it and then it is a wall. Sending
   * both at one pace meant a correlated subquery over `building_tile` per
   * building, a scan of `wall` and one of `floor_tile`, every second for every
   * player, to say that the house is still a house.
   *
   * So the caller says whether it wants them. A browser asks for the lot on
   * its twenty-second reconcile and after any of its own work, and for the
   * burning half the rest of the time. Left out rather than emptied: the
   * browser applies only the keys it is given, so what it holds stands.
   *
   * `p_slow` defaults true, so a page that has not been redeployed gets
   * exactly what it always got.
   */
  ;
  -- (Its own statement: one plan kept for both halves was costed with all of this in it, and so made again each call.)
  if p_slow is not false then v_out := v_out || jsonb_build_object(
    /*
     * And everybody ashore, on the slow half, which is the beat that already
     * carries the settlements. The map draws them; `folk_ashore` decides
     * whether there is anything to draw them at.
     */
    'folk', folk_ashore(p_world, me),
    /*
     * And every grave of yours, however far off: you wake a long way from
     * where you fell, and `placed` above is only what is in range. The map
     * marks them and takes the mark up when one goes. Off the index the
     * sweep uses, which holds nothing but graves.
     */
    -- And every lair you have seen (`lair_seen`), wherever it is: a pin on your map, "found" in your field guide.
    'lairs', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'x', l.x, 'y', l.y) order by l.id)
      from lair_seen s join lair l on l.world_id = s.world_id and l.id = s.lair
      where s.world_id = p_world and s.uid = me), '[]'::jsonb),
    'graves', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'x', g.x, 'y', g.y) order by g.id)
      from placed g
      where g.world_id = p_world and g.crumbles_at is not null and g.made_by = me), '[]'::jsonb),
    /*
     * What is growing here, settled first so the stage reported is the stage
     * it is actually at rather than the stage it was at when somebody last
     * touched it. Everything on this island settles lazily off a timestamp,
     * and for a crop nobody had ever been the one to ask.
     *
     * `grown` rather than `stage_at`: how far into its stage it has grown, in
     * growing seconds on the clock it grows on, which the browser lays on its
     * own reading of the same clock -- a winter between the stage's start and
     * now adds nothing to it. `ago`, the wall seconds, is what a page from
     * before the year reads.
     */
    'crops', coalesce((select jsonb_agg(jsonb_build_object(
        'x', c.x, 'y', c.y, 'id', c.id, 'stage', c.stage,
        'grown', case when c.still then still_grown(c.stage_at)
                      when c.hand and not c.glass then v_hand - hand_clock(c.stage_at) else crop_grown(c.glass, c.stage_at, v_field) end,
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace)
        -- And a crop under glass says so, and `grown` is on the glass clock (`glasshouse.ts`).
        || case when c.glass then '{"glass": true}'::jsonb else '{}'::jsonb end
        -- And one sown with Love's Season's Hand, on its clock (`hand_clock`).
        || case when c.hand then '{"hand": true}'::jsonb else '{}'::jsonb end
        -- And one on a garden bed, by its storey, standing still while it is covered (`gardenbed.ts`).
        || case when c.level is not null then jsonb_build_object('level', c.level) else '{}'::jsonb end
        || case when c.still then '{"still": true}'::jsonb else '{}'::jsonb end
        -- And compost spread on it (`decor.ts`).
        || case when c.fed then '{"fed": true}'::jsonb else '{}'::jsonb end)
      from crop c
      where c.world_id = p_world
        and c.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and c.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    -- And what grows in the planters, by the piece, on the planter's own clock.
    'planted', coalesce((select jsonb_agg(jsonb_build_object(
        'planter', c.placed, 'x', pl.x, 'y', pl.y, 'id', c.id, 'stage', c.stage,
        'grown', v_box - crop_clock(true, c.stage_at),
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace)
        || case when c.fed then '{"fed": true}'::jsonb else '{}'::jsonb end order by c.placed)
      from placed pl join planter_crop c on c.placed = pl.id
      where pl.world_id = p_world
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range), '[]'::jsonb),
    -- And the island's wall clock, which a field's clock is read off, so the browser reads it off the same one.
    'now', extract(epoch from now())::double precision,
    /*
     * The felling notches near you, and how long ago the woods last turned
     * over. Look reads both: "2 of 3 strokes in it", "the woods turn over in
     * 9 hours". A browser on an island keeps no clock of its own for the
     * woods, so this is the only place it hears the hour.
     */
    /*
     * The water lilies and lotus planted near you: when each was planted and
     * last picked, which is all of one. The browser works out the rest from
     * the year, as `water_plant_state` does.
     */
    'waterPlants', water_plants_near(p_world, p.x, p.y, p_range),
    'notches', coalesce((select jsonb_agg(jsonb_build_object('x', n.x, 'y', n.y, 'cuts', n.cuts))
      from tree_notch n
      where n.world_id = p_world
        and n.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and n.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(n.x + 0.5 - p.x), abs(n.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'treesAgo', (select extract(epoch from (now() - w.trees_at)) from world w where w.id = p_world),
    -- The mark the ground is being worked to, which lives on the player row
    -- so that it is the same mark in every browser you open.
    'level', p.level_h,
    -- What you are on each of them, so the browser can say what you may do
    -- rather than finding out by being refused. Your own first one is your
    -- own or one you were asked onto; either way `deed_role` says which.
    'deed', (select jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level, 'mine', true,
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'baubles', deed_baubles_json(p_world, d.founded_by))
      from my_deed(p_world, me) d where d.world_id is not null),
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level,
        -- Land you were asked onto is land you may work, so it is drawn as
        -- yours rather than as a stranger's border you happen to be inside.
        'mine', exists (select 1 from deed_member m where m.world_id = p_world
                          and m.uid = me and m.founder = d.founded_by),
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'holder', account_name(d.founded_by),
        -- And what is in its altar, for the settlements you are a citizen of.
        'baubles', case when exists (select 1 from deed_member m where m.world_id = p_world
                                       and m.uid = me and m.founder = d.founded_by)
                        then deed_baubles_json(p_world, d.founded_by) end) order by d.founded_at)
      from deed d
      where d.world_id = p_world and d.founded_by <> me
        and greatest(abs(d.x + 0.5 - p.x), abs(d.y + 0.5 - p.y)) <= p_range + d.radius),
      '[]'::jsonb),
    /*
     * And what is standing.
     *
     * `building`, `wall` and `floor_tile` have been kept here since buildings
     * were ported and have never been sent to anybody. The rules answered
     * about them, a plan went up in Postgres, and no browser ever drew a wall
     * of it — so on an island a building was invisible to everyone, the person
     * who planned it included.
     *
     * Shaped as the browser's own `BuildingsJSON`, so it is laid straight in.
     * A building comes along whole if any of its tiles is in range: half a
     * house is worse than none, and a house is a handful of rows.
     */
    'buildings', jsonb_build_object(
      -- cellar: what is dug out under the buildings sent (`BuildingsJSON.cellars`).
      'cellars', cellars_near(p_world, p.x, p.y, p_range),
      'nextId', coalesce((select max(b.id) + 1 from building b where b.world_id = p_world), 1),
      'list', coalesce((select jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'levels', b.levels, 'workLevel', b.work_level,
          -- Frame: the shape of its roof, which says whether it is a terrace to rail.
          'roof', b.roof,
          'tiles', (select coalesce(jsonb_agg(bt.x || ',' || bt.y order by bt.y, bt.x), '[]'::jsonb)
                      from building_tile bt
                     where bt.world_id = p_world and bt.building = b.id))
          -- Piers: and its deck and its tiles on piers, if it has any (`piers_json`).
          || piers_json(p_world, b.id, b.deck) order by b.id)
        from building b
        where b.world_id = p_world
          and b.id in (select bt.building from building_tile bt
                       where bt.world_id = p_world
                         and bt.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
                         and bt.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
                         and greatest(abs(bt.x + 0.5 - p.x), abs(bt.y + 0.5 - p.y)) <= p_range)),
        '[]'::jsonb),
      'walls', coalesce((select jsonb_agg(jsonb_build_object(
          'building', w.building, 'level', w.level, 'x', w.x, 'y', w.y, 'dir', w.dir,
          -- gates: a hidden door its padlock does not admit is sent as the solid wall it looks like.
          'type', wall_seen_type(p_world, me, w), 'material', w.material, 'needed', w.needed, 'total', w.total,
          -- And the seconds since the ivy on a finished wall of stone or brick began (`greening.ts`).
          'greenAgo', case when bill_done(w.needed) and m.kind = 'stone' then green_ago(gs.since, v_from) end)
          -- gates: a portcullis let down, and a padlock this body may know of.
          || wall_gear(p_world, me, w)
          order by w.level, w.dir, w.x, w.y)
        from wall w
        left join build_material_def m on m.id = w.material
        left join green_since gs on gs.world_id = p_world and gs.thing = 'wall' and gs.x = w.x and gs.y = w.y
                                and gs.k = green_wall_k(w.level, w.dir)
        where w.world_id = p_world
          and w.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
          and w.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
          and greatest(abs(w.x + 0.5 - p.x), abs(w.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      'floors', coalesce((select jsonb_agg(jsonb_build_object(
          'building', f.building, 'level', f.level, 'x', f.x, 'y', f.y,
          'material', f.material, 'kind', f.kind, 'facing', f.facing, 'hand', f.hand,
          'needed', f.needed, 'total', f.total) order by f.level, f.x, f.y)
        from floor_tile f
        where f.world_id = p_world
          and f.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
          and f.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
          and greatest(abs(f.x + 0.5 - p.x), abs(f.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      -- Frame: the columns on the corners of its storeys.
      'columns', frame_columns_json(p_world, p.x, p.y, p_range),
      -- No plan: the sides drawn with no plan model (`no_plan_json`).
      'noPlan', no_plan_json(p_world, p.x, p.y, p_range)),
    /*
     * And the slabs, which are not buildings and do not go in with them: a
     * foundation is ground somebody poured, and the browser lays it beside the
     * terrain rather than inside a house.
     */
    'foundations', coalesce((select jsonb_agg(jsonb_build_object(
        'id', fo.id, 'x', fo.x, 'y', fo.y, 'top', fo.top, 'pool', fo.pool,
        'needed', fo.needed, 'total', fo.total,
        -- And the seconds since the moss on a poured one began.
        'greenAgo', case when bill_done(fo.needed) then green_ago(gs.since, v_from) end) order by fo.id)
      from foundation fo
      left join green_since gs on gs.world_id = p_world and gs.thing = 'slab' and gs.x = fo.x and gs.y = fo.y and gs.k = 0
      where fo.world_id = p_world
        and fo.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and fo.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(fo.x + 0.5 - p.x), abs(fo.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'nextFoundationId', coalesce((select max(fo.id) + 1 from foundation fo where fo.world_id = p_world), 1),
    /*
     * And the bridges, shaped as the browser's own `Bridge`, spans and all.
     *
     * The island has kept `bridge` and `bridge_span` since bridges were ported
     * and never said a word about one, so on an island a bridge was drawn by
     * nobody and walked by nobody: the browser decides where its feet go, and
     * it had never heard of the deck. One comes whole if either end is in
     * range, and a stone arch with the seconds since the moss on it began.
     */
    'bridges', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'ax', b.ax, 'ay', b.ay, 'bx', b.bx, 'by', b.by,
        'height', b.height, 'level', b.level, 'levelB', b.level_b, 'rise', b.rise, 'material', b.material,
        'spans', (select coalesce(jsonb_agg(jsonb_build_object('x', s.x, 'y', s.y, 'needed', s.needed, 'total', s.total)
                    order by s.n), '[]'::jsonb)
                  from bridge_span s where s.world_id = p_world and s.bridge = b.id),
        'greenAgo', case when bridge_mossy(b.kind) and not exists (select 1 from bridge_span s
                           where s.world_id = p_world and s.bridge = b.id and not span_done(s.needed))
                         then green_ago(gs.since, v_from) end)
        -- gates: a drawbridge drawn up, and the padlock on its winch.
        || bridge_gear(b) order by b.id)
      from bridge b
      left join green_since gs on gs.world_id = p_world and gs.thing = 'bridge' and gs.x = b.ax and gs.y = b.ay and gs.k = b.id
      where b.world_id = p_world
        and (greatest(abs(b.ax + 0.5 - p.x), abs(b.ay + 0.5 - p.y)) <= p_range
             or greatest(abs(b.bx + 0.5 - p.x), abs(b.by + 0.5 - p.y)) <= p_range)), '[]'::jsonb),
    /*
     * And the paving: the seconds since greening came in, which is when every
     * paved tile without a row of its own began, and the tiles in range paved
     * or scrubbed since, off the key's own box.
     */
    'greenFromAgo', extract(epoch from (now() - v_from))::double precision,
    'paving', coalesce((select jsonb_agg(jsonb_build_object('x', gs.x, 'y', gs.y, 'ago', green_ago(gs.since, v_from)))
      from green_since gs
      where gs.world_id = p_world and gs.thing = 'paving'
        and gs.x between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and gs.y between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb));
  end if;
  -- A browser that said no cursor is sent what it always was.
  if p_since is null then return v_out; end if;
  /*
   * The new shape: the cursor, whether this is the whole answer, and, when it is not, every id in each list in
   * range (`ids`), so the browser keeps those and lets the rest go: `placed`, `lying` and `cellarLying` hold only
   * the rows sent again. `crates` and the slow half are whole, as they always were.
   */
  -- The crates as the cursor had them: left out, and the browser keeps the ones it holds (`GroundHeld`).
  if v_snap is not null and v_had = v_ch then v_out := v_out - 'crates'; end if;
  return v_out || jsonb_build_object('at', 'c' || v_ch || ':' || v_at, 'full', v_snap is null)
    || case when v_snap is null then '{}'::jsonb
            else jsonb_build_object('ids', jsonb_build_object('placed', to_jsonb(v_pids), 'lying', to_jsonb(v_lids), 'cellarLying', to_jsonb(v_cids))) end;
end $function$;


select private.lock_doors();
