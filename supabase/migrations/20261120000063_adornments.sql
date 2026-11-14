/*
 * The adornments (`src/game/adorn.ts`, `src/game/adorndefs.ts`): a lily pond,
 * an ivy wall panel, a garden obelisk, a herb spiral, a buoy, a cauldron
 * hearth, a cheese rack, a pelt rug, a plush wildermon, a game table, a gem
 * lamp, a pedigree board and a worker nameplate; and the garden footbridge.
 *
 * The definitions carried every piece, its recipe and its item, the jobs
 * (`adorn_action`), a game table's seats, a cauldron's hearth, every number
 * (`pond_lilies`, `ivy_cuttings`, `ivy_panel_days`, `spiral_slots`,
 * `spiral_pick`, `spiral_ripe`, `rack_holds`, `stones_goal`, `stones_sides`),
 * the kinds, the seeds a spiral takes (`spiral_seeds`), the sweet peas'
 * colours (`pea_colours`), cheese's ageing (`age_rate`, `age_cap`), every
 * sentence (`adorn_said`, `adorn_done`, `plush_said`), the pot dishes made
 * four at a time at a cauldron (`cauldron_*` recipes, station
 * `cauldron_hearth`) and the garden footbridge (`bridge_def`, a bridge kind of
 * its own, whose deck every rule of bridges already walks). What is here is
 * the doing.
 *
 *   * `placed.garden` keeps an adornment's state, sent to every browser with
 *     the ground read and carried into the pack with the piece: `lilies`,
 *     `pea`, `herbs` (`[crop, sown]` a slot), `cheese` (`[ql, at]` a cheese),
 *     `plush`, `round` and `wins` (a game table's), `tree` (a pedigree
 *     board's) and `plate` (a nameplate's QL, on a wildermon bed).
 *   * Botanizing by a lily pond rolls the water's-edge table (`pond_near`: `perform_gather`).
 *   * An ivy wall panel greens the wall it hangs on (the browser's `wallGreen`),
 *     and a scrubbing worker passes that wall by (`wall_paneled`: `green_on_tile`,
 *     `scrub_tile`); Clear the ivy gives `ivy_cuttings` a wall (`perform_green`).
 *   * A buoy goes on a water tile (`piece_fixed_refusal`), is named as a cairn
 *     is, and shows on the map of whoever set it down and of the citizens of
 *     the settlement it floats on (`cairns_of`).
 *   * A cauldron hearth is a hearth; lit, it is the `cauldron_hearth` station (`at_station`).
 *   * Cheese on a rack ages by the wine rule (`age_gain('cheese', ...)`); a
 *     rack with cheese on it is not picked up (`fire_refusal`).
 *   * Fur carries the kind it came off (`perform_fight`, butchering), which a
 *     pelt rug takes as its material.
 *   * A plush is of a kind its maker has tamed, chosen at the needle
 *     (`plush_refusal`: `craft_ran_out`; `perform_craft`).
 *   * The jobs (`adorn_refusal`, `perform_adorn`), dispatched at the end of
 *     the line (`last_action`, `last_refusal`, `perform_last`).
 *
 * `supabase/test/adorn.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/* ---- a lily pond: the water's edge for botanizing ------------------------------------------------ */

/** Whether a lily pond stands on tile (x, y) or a tile beside it, on the ground (`pondNear`). */
create or replace function pond_near(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $fn$
  select exists (select 1 from placed pl, (values (0, 0), (0, -1), (-1, 0), (1, 0), (0, 1)) v(dx, dy)
                  where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = lily_pond_kind() and coalesce(pl.level, 0) = 0
                    and pl.x = p_x + v.dx and pl.y = p_y + v.dy)
$fn$;

select pg_temp.patch_fn('perform_gather(uuid, uuid, text, jsonb)',
  $o$got := roll_table(case when p_action = 'botanize' and water_edge(p_world, tx, ty) then 'botanize_water'$o$,
  $n$got := roll_table(case when p_action = 'botanize' and (water_edge(p_world, tx, ty) or pond_near(p_world, tx, ty)) then 'botanize_water'$n$);

/* ---- an ivy wall panel ------------------------------------------------------------------------- */

/** Whether an ivy wall panel hangs on a wall: on either tile beside it, facing it, on its storey (`panelOn`). */
create or replace function wall_paneled(p_world uuid, wl wall) returns boolean language sql stable as $fn$
  select exists (select 1 from placed pc cross join lateral border_of(pc.x, pc.y, pc.facing) b
                  where pc.world_id = p_world and pc.kind = 'furniture' and pc.sub = ivy_panel_kind()
                    and coalesce(pc.level, 0) = wl.level and b.x = wl.x and b.y = wl.y and b.dir = wl.dir)
$fn$;

select pg_temp.patch_fn('green_on_tile(uuid, uuid, integer, integer)',
  $o$where bill_done(wl.needed)$o$,
  $n$where bill_done(wl.needed) and not wall_paneled(p_world, wl)$n$);
select pg_temp.patch_fn('scrub_tile(uuid, uuid, integer, integer)',
  $o$where bill_done(wl.needed)$o$,
  $n$where bill_done(wl.needed) and not wall_paneled(p_world, wl)$n$);

-- Clear the ivy: `ivy_cuttings` a wall cleared, at the clearer's forestry.
select pg_temp.patch_fn('perform_green(uuid, uuid, text, jsonb)',
  $o$    perform tell(p_world, p_uid, 'Ivy cleared: ' || side_name(v_side) || ' wall. ' || green_again(), 'event');$o$,
  $n$    perform tell(p_world, p_uid, 'Ivy cleared: ' || side_name(v_side) || ' wall. ' || green_again(), 'event');
    -- Its cuttings, for an ivy wall panel (`adorn.ts`).
    if exists (select 1 from border_of(tx, ty, v_side) bo
                 join wall wl on wl.world_id = p_world and wl.dir = bo.dir and wl.x = bo.x and wl.y = bo.y
                 join build_material_def m on m.id = wl.material and m.kind = 'stone'
                where bill_done(wl.needed)) then
      perform give(p_world, p_uid, ivy_cutting_item(),
        ivy_cuttings() * (select count(*)::int from border_of(tx, ty, v_side) bo
                           join wall wl on wl.world_id = p_world and wl.dir = bo.dir and wl.x = bo.x and wl.y = bo.y
                           join build_material_def m on m.id = wl.material and m.kind = 'stone'
                          where bill_done(wl.needed)),
        product_ql(skill_of(p_world, p_uid, 'forestry'), 0));
    end if;$n$);

/* ---- a buoy ------------------------------------------------------------------------------------ */

select pg_temp.patch_fn('piece_fixed_refusal(uuid, uuid, text, integer, integer, text, integer)',
  $o$              when f.id = mooring_post_kind() then$o$,
  $n$              -- A buoy on a water tile (`adorn.ts`).
              when f.id = buoy_kind() then case when has_water(p_world, p_x, p_y) then null else adorn_said('notWater', null, null, null) end
              when f.id = mooring_post_kind() then$n$);

/**
 * The cairns on the settlements of yours, founded or joined, named, for the
 * map (`rpc_settlements`); and the buoys on them, and every buoy you set down
 * wherever it floats (`adorn.ts`).
 */
create or replace function cairns_of(p_world uuid, p_uid uuid) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pl.engraving, ''), 'x', pl.x, 'y', pl.y) order by pl.id), '[]'::jsonb)
    from placed pl
   where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub in (cairn_kind(), buoy_kind()) and coalesce(pl.level, 0) >= 0
     and ((pl.sub = buoy_kind() and pl.made_by = p_uid)
          or exists (select 1 from deed d where d.world_id = p_world and deed_covers(d, pl.x, pl.y)
                       and (d.founded_by = p_uid or exists (select 1 from deed_member m where m.world_id = p_world
                                                              and m.uid = p_uid and m.founder = d.founded_by))))
$fn$;

/* ---- a cauldron hearth: the station ------------------------------------------------------------ */

select pg_temp.patch_fn('at_station(uuid, uuid, text)',
  $o$    when 'smelter' then$o$,
  $n$    -- A cauldron hearth, alight (`adorn.ts`).
    when 'cauldron_hearth' then
      exists (select 1 from placed_near(p_world, p_uid, 'furniture', cauldron_hearth_kind(), 2.6) p where placed_lit(p))
    when 'smelter' then$n$);

/* ---- a cheese rack: the wine rule ------------------------------------------------------------- */

select pg_temp.patch_fn('age_gain(text, double precision, boolean)',
  $o$  if not coalesce(brew_ages(p_liquid), false) or p_age is null$o$,
  $n$  if not (coalesce(brew_ages(p_liquid), false) or p_liquid = cheese_item()) or p_age is null$n$);

select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$      if coalesce(jsonb_array_length(p.garden->'jars'), 0) > 0 or coalesce((p.garden->>'stuck')::int, 0) > 0 then$o$,
  $n$      if coalesce(jsonb_array_length(p.garden->'jars'), 0) > 0 or coalesce((p.garden->>'stuck')::int, 0) > 0
         -- And cheese on a rack (`adorn.ts`).
         or coalesce(jsonb_array_length(p.garden->'cheese'), 0) > 0 then$n$);

/* ---- fur: the kind it came off ----------------------------------------------------------------- */

select pg_temp.patch_fn('perform_fight(uuid, uuid, text, jsonb)',
  $o$      perform gather(p_world, p_uid, r.item, v_n,
        least(100, greatest(1, least(100, made_ql)) * pk(p_world, p_uid, 'ql:' || r.item, 1)));$o$,
  $n$      -- Fur labelled with the kind it came off, for a pelt rug (`adorn.ts`).
      perform gather(p_world, p_uid, r.item, v_n,
        least(100, greatest(1, least(100, made_ql)) * pk(p_world, p_uid, 'ql:' || r.item, 1)),
        case when r.part = 'fur' then sp.name end);$n$);

/* ---- a plush: a kind tamed, chosen at the needle ---------------------------------------------- */

/** Why a plush of a kind will not be sewn: none chosen, or one its maker has not tamed (`plushRefusal`). */
create or replace function plush_refusal(p_world uuid, p_uid uuid, p_kind text) returns text language sql stable as $fn$
  select case when coalesce(p_kind, '') = '' then plush_said('pick')
              when not exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = p_kind and g.tamed)
                then plush_said('untamed') end
$fn$;

select pg_temp.patch_fn('craft_ran_out(uuid, uuid, text, jsonb)',
  $o$  if jsonb_typeof(o) is distinct from 'object'$o$,
  $n$  -- And a plush of a kind its maker has tamed, chosen at the needle (`adorn.ts`).
  if p_recipe = 'make_' || plush_kind() and plush_refusal(p_world, p_uid, p_target->>'species') is not null then
    return plush_refusal(p_world, p_uid, p_target->>'species');
  end if;
  if jsonb_typeof(o) is distinct from 'object'$n$);

select pg_temp.patch_fn('perform_craft(uuid, uuid, text, jsonb)',
  $o$    if r.result = carved_figure_kind() then$o$,
  $n$    -- A plush, sewn as the kind chosen at the needle (`adorn.ts`).
    if r.result = plush_kind() then
      update item set garden = jsonb_build_object('plush', p_target->>'species') where id = v_made;
    end if;
    if r.result = carved_figure_kind() then$n$);

/* ---- a herb spiral ---------------------------------------------------------------------------- */

/** Whether a spiral's slot of `p_crop`, sown at `p_sown` (epoch seconds), is ripe: its stages to ripe on the field clock (`slotRipe`). */
create or replace function slot_ripe(p_crop text, p_sown double precision, p_now timestamptz default now()) returns boolean language sql stable as $fn$
  select field_clock(p_now) - field_clock(to_timestamp(p_sown))
         >= spiral_ripe() * (select c.stage_seconds from crop_def c where c.id = p_crop)
$fn$;

/* ---- a pedigree board ------------------------------------------------------------------------- */

/**
 * A wildermon and its line, `p_depth` generations up, as a board shows it
 * (`Lineage`): its name and kind, and its dam (`d`) and sire (`s`) off its
 * pedigree -- each one's own line where it still stands on the island under
 * that id and name, and otherwise its name, and its kind where breeding made
 * it the same as its young's (anything but a hybrid).
 */
create or replace function lineage(p_world uuid, c creature, p_depth int) returns jsonb language plpgsql stable as $fn$
declare v jsonb; p jsonb; r creature; side text;
begin
  v := jsonb_build_object('n', c.name, 'k', c.species);
  if p_depth <= 0 or c.pedigree is null then return v; end if;
  foreach side in array array['dam', 'sire'] loop
    p := c.pedigree->side;
    continue when p is null or p->>'name' is null;
    select * into r from creature where world_id = p_world and id = (p->>'id')::int and name = p->>'name';
    if r.id is not null then
      v := v || jsonb_build_object(left(side, 1), lineage(p_world, r, p_depth - 1));
    else
      v := v || jsonb_build_object(left(side, 1), jsonb_strip_nulls(jsonb_build_object('n', p->>'name',
        'k', case when not exists (select 1 from species_def sd where sd.id = c.species and sd.hybrid_a is not null) then c.species end)));
    end if;
  end loop;
  return v;
end $fn$;

/** One wildermon of a line, as the board says it: "Snow (wolfling)", or "unknown" (`lineWords`). */
create or replace function lineage_words(j jsonb) returns text language sql stable as $fn$
  select case when j is null or j->>'n' is null then 'unknown'
              else (j->>'n') || coalesce(' (' || lower((select sd.name from species_def sd where sd.id = j->>'k')) || ')', '') end
$fn$;

/* ---- the jobs ---------------------------------------------------------------------------------- */

/**
 * Why a job at an adornment cannot be done now, or null: the browser's
 * `adornRefusal`, question for question -- there, in reach, whose, and then
 * the piece.
 */
create or replace function adorn_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; g jsonb; v_name text; v_why text; it item; v_slot int; v_text text; r jsonb; v_me text; v_other uuid; c creature; h jsonb;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
     and case when p_action = 'pond_lily' then sub = lily_pond_kind()
              when p_action like 'pea\_%' then sub = garden_obelisk_kind()
              when p_action = 'spiral_sow' or p_action like 'spiral\_pick\_%' then sub = herb_spiral_kind()
              when p_action = 'name_buoy' then sub = buoy_kind()
              when p_action in ('cheese_put', 'cheese_take') then sub = cheese_rack_kind()
              when p_action = 'throw_stones' then sub = game_table_kind()
              when p_action in ('set_lineage', 'read_lineage') then sub = pedigree_board_kind()
              when p_action in ('hang_plate', 'take_plate') then exists (select 1 from furniture_def fd where fd.id = sub and fd.den is not null)
              else false end;
  if not found then return 'It is gone.'; end if;
  v_name := lower((select f.name from furniture_def f where f.id = pl.sub));
  g := coalesce(pl.garden, '{}'::jsonb);
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(v_name); end if;
  if p_action = 'pond_lily' then
    if coalesce((g->>'lilies')::int, 0) >= pond_lilies() then return adorn_said('pondFull', null, null, null); end if;
    return case when exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                                and i.def = 'lily_root' and not i.locked) then null else adorn_said('noLily', null, null, null) end;
  elsif p_action = 'pea_season' then
    return case when g->>'pea' is null then adorn_said('samePea', null, null, 'by season') end;
  elsif p_action like 'pea\_%' then
    if substr(p_action, 5) <> all (pea_colours()) then return 'It is gone.'; end if;
    return case when g->>'pea' = substr(p_action, 5) then adorn_said('samePea', null, null, substr(p_action, 5)) end;
  elsif p_action = 'spiral_sow' then
    v_slot := case when coalesce(p_target->>'slot', '') ~ '^[0-9]+$' then (p_target->>'slot')::int end;
    if v_slot is null or v_slot >= spiral_slots() then return adorn_said('noSlot', null, null, null); end if;
    if jsonb_typeof(g->'herbs'->v_slot) = 'array' then return adorn_said('slotSown', null, v_slot + 1, null); end if;
    if nullif(p_target->>'itemUid', '') is not null then
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.id = (p_target->>'itemUid')::bigint;
    else
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
         and i.def = any (spiral_seeds()) and not i.locked order by i.id limit 1;
    end if;
    if it.id is null then return adorn_said('noSeed', null, null, null); end if;
    return case when it.def = any (spiral_seeds()) and not it.locked then null else adorn_said('notSeed', null, null, null) end;
  elsif p_action like 'spiral\_pick\_%' then
    v_slot := substr(p_action, 13)::int;
    h := g->'herbs'->v_slot;
    if jsonb_typeof(h) is distinct from 'array' then return adorn_said('slotEmpty', null, v_slot + 1, null); end if;
    return case when slot_ripe(h->>0, (h->>1)::double precision) then null else adorn_said('notRipe', null, v_slot + 1, null) end;
  elsif p_action = 'name_buoy' then
    if not may_engrave(p_world, p_uid, pl) then return furnish_said('cairnNotYours', null, null, null); end if;
    v_why := private.muted_why(p_world, p_uid);
    if v_why is not null then return v_why; end if;
    if p_target->>'name' is null then return null; end if;
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    if v_text = '' then return furnish_said('noName', null, null, null); end if;
    return case when v_text = pl.engraving then furnish_said('sameName', null, null, null) end;
  elsif p_action in ('cheese_put', 'cheese_take') then
    if pl.made_by is distinct from p_uid then return adorn_said('notYours', v_name, null, null); end if;
    if p_action = 'cheese_take' then
      return case when coalesce(jsonb_array_length(g->'cheese'), 0) > 0 then null else adorn_said('rackEmpty', null, null, null) end;
    end if;
    if coalesce(jsonb_array_length(g->'cheese'), 0) >= rack_holds() then return adorn_said('rackFull', null, null, null); end if;
    if nullif(p_target->>'itemUid', '') is not null then
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.id = (p_target->>'itemUid')::bigint;
    else
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
         and i.def = cheese_item() and not i.locked order by i.id limit 1;
    end if;
    if it.id is null then return adorn_said('noCheese', null, null, null); end if;
    return case when it.def = cheese_item() and not it.locked then null else adorn_said('notCheese', null, null, null) end;
  elsif p_action = 'throw_stones' then
    r := g->'round';
    if r->>'b' is not null and p_uid::text not in (r->>'a', r->>'b') then
      return adorn_said('roundOn', null, null, (r->>'an') || ' and ' || (r->>'bn'));
    end if;
    if r->>'last' = p_uid::text then
      return adorn_said('notTurn', null, null, case when r->>'b' is null then 'another player' when r->>'last' = r->>'a' then r->>'bn' else r->>'an' end);
    end if;
    -- The other player, seated at it or beside it: the round's, or anybody at all for its first throw.
    v_other := case when r->>'b' is not null then (case when r->>'a' = p_uid::text then r->>'b' else r->>'a' end)::uuid
                    when r->>'a' is not null and r->>'a' <> p_uid::text then (r->>'a')::uuid end;
    if v_other is not null then
      return case when placed_in_reach(p_world, v_other, pl.id) then null else adorn_said('noOpponent', null, null, null) end;
    end if;
    return case when exists (select 1 from player o where o.world_id = p_world and o.uid <> p_uid and placed_in_reach(p_world, o.uid, pl.id))
                then null else adorn_said('noOpponent', null, null, null) end;
  elsif p_action = 'set_lineage' then
    if pl.made_by is distinct from p_uid then return adorn_said('boardNotYours', null, null, null); end if;
    if coalesce(p_target->>'creature', '') !~ '^[0-9]+$' then return adorn_said('pickCreature', null, null, null); end if;
    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    if c.id is null or c.keeper is distinct from p_uid then return adorn_said('notKept', null, null, null); end if;
    return case when (g->'tree'->>'id')::int = c.id then adorn_said('sameCreature', null, null, g->'tree'->>'n') end;
  elsif p_action = 'read_lineage' then
    return case when g->'tree' is null then adorn_said('noLine', null, null, null) end;
  elsif p_action = 'hang_plate' then
    if pl.made_by is distinct from p_uid then return adorn_said('notYours', v_name, null, null); end if;
    if g->'plate' is not null then return adorn_said('plateOn', null, null, null); end if;
    return case when exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                                and i.def = nameplate_item() and not i.locked) then null else adorn_said('noPlate', null, null, null) end;
  elsif p_action = 'take_plate' then
    if pl.made_by is distinct from p_uid then return adorn_said('notYours', v_name, null, null); end if;
    return case when g->'plate' is null then adorn_said('noPlateOn', null, null, null) end;
  end if;
  return null;
end $fn$;

/** A game table's tally with one more win for `p_uid`, under the name they won under (`winsOf`). */
create or replace function stones_won(p_wins jsonb, p_uid uuid, p_name text) returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(w), '[]'::jsonb) from (
    select case when e->>0 = p_uid::text then jsonb_build_array(e->>0, p_name, (e->>2)::int + 1) else e end as w, o
      from jsonb_array_elements(coalesce(p_wins, '[]'::jsonb)) with ordinality x(e, o)
    union all
    select jsonb_build_array(p_uid::text, p_name, 1), 1e9
     where not exists (select 1 from jsonb_array_elements(coalesce(p_wins, '[]'::jsonb)) e where e->>0 = p_uid::text)
    order by o) t
$fn$;

/**
 * The jobs done: a lily planted; an obelisk's sweet peas chosen; a spiral's
 * slot sown and picked, `spiral_pick` herbs and growing again; a buoy named;
 * cheese put on a rack and taken off, aged by the wine rule; stones thrown,
 * the winner named and tallied; a lineage set on a board and read; a
 * nameplate hung on a bed and taken down.
 */
create or replace function perform_adorn(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; g jsonb; it item; v_n int; v_slot int; v_crop text; v_ql double precision; v_text text; r jsonb; me player;
        v_mine int; v_theirs int; v_other uuid; v_said text; e jsonb; v_qls text[] := '{}'; c creature; h jsonb; v_herbs jsonb;
begin
  if adorn_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action = 'pond_lily' then
    select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'lily_root' and not i.locked order by i.id limit 1;
    if not consume(p_world, p_uid, 'lily_root', 1, it.id) then return; end if;
    g := g || jsonb_build_object('lilies', coalesce((g->>'lilies')::int, 0) + 1);
    perform tell(p_world, p_uid, adorn_done('lily', null, null, ((g->>'lilies')::int)::text, pond_lilies()), 'event');
  elsif p_action = 'pea_season' then
    g := g - 'pea';
    perform tell(p_world, p_uid, adorn_done('peaSeason', null, null, null, null), 'event');
  elsif p_action like 'pea\_%' then
    g := g || jsonb_build_object('pea', substr(p_action, 5));
    perform tell(p_world, p_uid, adorn_done('pea', substr(p_action, 5), null, null, null), 'event');
  elsif p_action = 'spiral_sow' then
    v_slot := (p_target->>'slot')::int;
    if nullif(p_target->>'itemUid', '') is not null then
      select * into it from item i where i.id = (p_target->>'itemUid')::bigint;
    else
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
         and i.def = any (spiral_seeds()) and not i.locked order by i.id limit 1;
    end if;
    if not consume(p_world, p_uid, it.def, 1, it.id) then return; end if;
    select cd.id into v_crop from crop_def cd where cd.seed = it.def;
    v_herbs := coalesce(g->'herbs', '[]'::jsonb);
    while jsonb_array_length(v_herbs) < spiral_slots() loop v_herbs := v_herbs || 'null'::jsonb; end loop;
    v_herbs := jsonb_set(v_herbs, array[v_slot::text], jsonb_build_array(v_crop, extract(epoch from now())::double precision));
    g := g || jsonb_build_object('herbs', v_herbs);
    perform tell(p_world, p_uid, adorn_done('sown', lower((select cd.name from crop_def cd where cd.id = v_crop)), v_slot + 1, null, null), 'event');
  elsif p_action like 'spiral\_pick\_%' then
    v_slot := substr(p_action, 13)::int;
    h := g->'herbs'->v_slot;
    v_ql := least(100, greatest(1, product_ql(skill_of(p_world, p_uid, 'farming'), 0)));
    perform give(p_world, p_uid, (select cd.produce from crop_def cd where cd.id = h->>0), spiral_pick(), v_ql);
    g := jsonb_set(g, array['herbs', v_slot::text], jsonb_build_array(h->>0, extract(epoch from now())::double precision));
    perform tell(p_world, p_uid, adorn_done('picked', lower((select cd.name from crop_def cd where cd.id = h->>0)), spiral_pick(),
      round(v_ql::numeric, 1)::text, v_slot + 1), 'event');
  elsif p_action = 'name_buoy' then
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    update placed set engraving = v_text where id = pl.id;
    perform tell(p_world, p_uid, adorn_done('named', v_text, null, null, null), 'event');
    perform land_announce(p_world, pl.x, pl.y);
    return;
  elsif p_action = 'cheese_put' then
    if nullif(p_target->>'itemUid', '') is not null then
      select * into it from item i where i.id = (p_target->>'itemUid')::bigint;
    else
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
         and i.def = cheese_item() and not i.locked order by i.id limit 1;
    end if;
    v_n := least(it.count, rack_holds() - coalesce(jsonb_array_length(g->'cheese'), 0));
    if not consume(p_world, p_uid, cheese_item(), v_n, it.id) then return; end if;
    g := g || jsonb_build_object('cheese', coalesce(g->'cheese', '[]'::jsonb)
      || (select jsonb_agg(jsonb_build_array(it.ql, extract(epoch from now())::double precision)) from generate_series(1, v_n)));
    perform tell(p_world, p_uid, adorn_done('racked', null, v_n, jsonb_array_length(g->'cheese')::text, rack_holds()), 'event');
  elsif p_action = 'cheese_take' then
    for e in select x from jsonb_array_elements(g->'cheese') x loop
      v_ql := least(100, (e->>0)::double precision
        + age_gain(cheese_item(), extract(epoch from now()) - (e->>1)::double precision, coalesce(pl.level, 0) < 0));
      perform give(p_world, p_uid, cheese_item(), 1, v_ql);
      v_qls := v_qls || round(v_ql::numeric, 1)::text;
    end loop;
    perform tell(p_world, p_uid, adorn_done('unracked', array_to_string(v_qls, ', '), jsonb_array_length(g->'cheese'), null, null), 'event');
    g := g - 'cheese';
  elsif p_action = 'throw_stones' then
    select * into me from player where world_id = p_world and uid = p_uid;
    r := coalesce(g->'round', '{}'::jsonb);
    v_n := stones_least() + floor(random() * (stones_sides() - stones_least() + 1))::int;
    if r->>'a' is null then
      r := jsonb_build_object('a', p_uid::text, 'an', me.name, 'as', v_n, 'last', p_uid::text);
    elsif r->>'a' = p_uid::text then
      r := r || jsonb_build_object('as', (r->>'as')::int + v_n, 'last', p_uid::text);
    else
      r := r || jsonb_build_object('b', p_uid::text, 'bn', me.name, 'bs', coalesce((r->>'bs')::int, 0) + v_n, 'last', p_uid::text);
    end if;
    v_mine := case when r->>'a' = p_uid::text then (r->>'as')::int else (r->>'bs')::int end;
    v_theirs := case when r->>'a' = p_uid::text then coalesce((r->>'bs')::int, 0) else (r->>'as')::int end;
    v_other := case when r->>'a' = p_uid::text then (r->>'b')::uuid else (r->>'a')::uuid end;
    v_said := adorn_done('threw', me.name, v_n, v_mine::text, stones_goal());
    perform tell(p_world, p_uid, v_said, 'event');
    if v_other is not null then perform tell(p_world, v_other, v_said, 'event'); end if;
    if v_mine >= stones_goal() then
      g := g || jsonb_build_object('wins', stones_won(g->'wins', p_uid, me.name));
      v_said := adorn_done('won', me.name, v_mine, v_theirs::text,
        (select (w->>2)::int from jsonb_array_elements(g->'wins') w where w->>0 = p_uid::text));
      perform tell(p_world, p_uid, v_said, 'event');
      if v_other is not null then perform tell(p_world, v_other, v_said, 'event'); end if;
      g := g - 'round';
    else
      g := g || jsonb_build_object('round', r);
    end if;
  elsif p_action = 'set_lineage' then
    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    g := g || jsonb_build_object('tree', lineage(p_world, c, 2) || jsonb_build_object('id', c.id));
    perform tell(p_world, p_uid, adorn_done('lineage', lineage_words(g->'tree'), null, null, null), 'event');
  elsif p_action = 'read_lineage' then
    perform tell(p_world, p_uid, lineage_words(g->'tree'), 'event');
    perform tell(p_world, p_uid, 'Dam: ' || lineage_words(g->'tree'->'d') || '; sire: ' || lineage_words(g->'tree'->'s'), 'event');
    perform tell(p_world, p_uid, 'Dam''s dam: ' || lineage_words(g->'tree'->'d'->'d') || '; dam''s sire: ' || lineage_words(g->'tree'->'d'->'s'), 'event');
    perform tell(p_world, p_uid, 'Sire''s dam: ' || lineage_words(g->'tree'->'s'->'d') || '; sire''s sire: ' || lineage_words(g->'tree'->'s'->'s'), 'event');
    return;
  elsif p_action = 'hang_plate' then
    select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = nameplate_item() and not i.locked
     order by i.id limit 1;
    if not consume(p_world, p_uid, nameplate_item(), 1, it.id) then return; end if;
    g := g || jsonb_build_object('plate', it.ql);
    perform tell(p_world, p_uid, adorn_done('hung', null, null, null, null), 'event');
  elsif p_action = 'take_plate' then
    perform give(p_world, p_uid, nameplate_item(), 1, (g->>'plate')::double precision);
    g := g - 'plate';
    perform tell(p_world, p_uid, adorn_done('unhung', null, null, null, null), 'event');
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

select pg_temp.patch_fn('last_action(text)',
  $o$      or fitting_action(p_action)
$o$,
  $n$      or fitting_action(p_action)
      -- The adornments' jobs: a pond, an obelisk, a spiral, a buoy, a rack, a table, a board, a nameplate (`adorn.ts`).
      or adorn_action(p_action)
$n$);
select pg_temp.patch_fn('last_refusal(uuid, uuid, text, jsonb)',
  $o$  if fitting_action(p_action) then
    return fitting_refusal(p_world, p_uid, p_action, p_target);
  end if;$o$,
  $n$  if fitting_action(p_action) then
    return fitting_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The adornments' jobs (`adorn.ts`).
  if adorn_action(p_action) then
    return adorn_refusal(p_world, p_uid, p_action, p_target);
  end if;$n$);
select pg_temp.patch_fn('perform_last(uuid, uuid, text, jsonb)',
  $o$  if fitting_action(p_action) then
    perform perform_fitting(p_world, p_uid, p_action, p_target);
    return;
  end if;$o$,
  $n$  if fitting_action(p_action) then
    perform perform_fitting(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The adornments' jobs (`adorn.ts`).
  if adorn_action(p_action) then
    perform perform_adorn(p_world, p_uid, p_action, p_target);
    return;
  end if;$n$);

select private.lock_doors();
