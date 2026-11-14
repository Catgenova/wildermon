/*
 * The garden pieces (`src/game/garden.ts`, `src/game/gardendefs.ts`).
 *
 * The definitions crossed every piece, its recipe and its item, the jobs
 * (`garden_action`), every number (`bloom_cost`, `topiary_grows_out`,
 * `hedge_full`, `bonsai_grown`, `bonsai_steps`, `prune_rest`, the tools and the
 * trades), the kinds (`bloom_kinds`, `topiary_shapes`, `hedge_clips`,
 * `hang_from`, `garden_pots`, `herb_crops`), what each piece is
 * (`furniture_def.bloom`, `mount`, `hedge`, `herbs`, `topiary`, `bonsai`,
 * `shows`, `shows_n`, `figure`; `roses` for every piece that grows from the
 * moment it is set down), `item_def.trophy`, and every sentence
 * (`garden_said`, `garden_done`, `mount_said`, `figure_said`,
 * `herbs_only_said`). What is here is the doing of it.
 *
 *   * `placed.garden` and `item.garden`: what a piece holds and how it was
 *     last shaped -- `bloom` (the wildflower kinds, a slot each), `shape` and
 *     `trim_at` (a topiary shrub), `clip` (a hedge), `prunes` and `prune_at`
 *     (a bonsai), `figure` (a carved figure's kind), `held` (a trophy on a
 *     plaque, potted plants on a stand: def, ql, rare, maker, by). The ground
 *     read and the pack's rows carry every column, so it reaches every
 *     browser as it is. It goes into the pack with the piece and back down
 *     with it (`perform_fire`); a piece with something on show is not picked
 *     up until it is taken down.
 *   * The jobs (`garden_refusal`, `perform_garden`), dispatched with the
 *     others at the end of the line (`last_action`, `last_refusal`,
 *     `perform_last`), every refusal in the browser's words and order.
 *   * Fixed to a wall or hung (`mount_refusal`, `mount_turns_to`), and a hedge
 *     outside, from the ground (`hedge_refusal`): set down and turned in the
 *     row of spots along the side faced (`piece_anchor`), as a trellis is; a
 *     window box under the middle of its window.
 *   * A hedge shuts the border it stands along to a way worked out on the
 *     island (`hedge_between`, in `creature_way`), as a wall does.
 *   * A herb box grows herbs only (`sow_planter`, `planter_refusal`) and is
 *     harvested at its share of a planter's yield (`reap_planter`, through
 *     `reap_what`), and says so when tended (`perform_planter`).
 *   * A lair's trophy carries its slayer's name (`lair_hoard_give`), which a
 *     trophy plaque shows under it.
 *   * A carved figure is carved as a kind its maker has seen in the field
 *     guide, chosen at the bench (`figure_refusal` in `craft_ran_out`, which
 *     is asked of a craft's go before anything else; `perform_craft` stamps it).
 *
 * `supabase/test/garden.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

alter table placed add column if not exists garden jsonb;
alter table item add column if not exists garden jsonb;

/* ---- which piece, and what it is ------------------------------------------------------------ */

/** Whether a piece is fixed along the side of its tile it faces: a trellis, a hedge, anything fixed to a wall or hung (`alongSide`). */
create or replace function piece_along_side(p_sub text) returns boolean language sql stable as $fn$
  select p_sub is not distinct from vine_kind()
      or coalesce((select f.hedge or f.mount is not null from furniture_def f where f.id = p_sub), false)
$fn$;

/* ---- fixed to a wall, hung, and a hedge -------------------------------------------------------- */

/** The wall on side `p_facing` of tile (x, y) at a storey, as the browser's `Buildings.wall` finds it. */
create or replace function wall_on_side(p_world uuid, p_x int, p_y int, p_facing text, p_level int) returns wall
language sql stable as $fn$
  select wl.* from border_of(p_x, p_y, p_facing) bd
    join wall wl on wl.world_id = p_world and wl.level = coalesce(p_level, 0) and wl.dir = bd.dir and wl.x = bd.x and wl.y = bd.y
  limit 1
$fn$;

/**
 * Why a piece fixed in this way will not go on tile (x, y) against its side
 * `p_facing`, from storey `p_level`, or null: the browser's `mountRefusal`,
 * question for question.
 */
create or replace function mount_refusal(p_world uuid, p_uid uuid, p_mount text, p_x int, p_y int, p_facing text, p_level int) returns text
language plpgsql stable as $fn$
declare w wall; v_seen text; v_miss text;
begin
  if p_mount = 'wall' then
    w := wall_on_side(p_world, p_x, p_y, p_facing, p_level);
    if w.x is null or wall_seen_type(p_world, p_uid, w) <> 'solid' then return mount_said('noWall'); end if;
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
end $fn$;

/** Why a hedge will not go on tile (x, y) from storey `p_level`: from the ground, outside a building (`hedgeRefusal`). */
create or replace function hedge_refusal(p_world uuid, p_x int, p_y int, p_level int) returns text language sql stable as $fn$
  select case when coalesce(p_level, 0) <> 0 then mount_said('upstairs')
              when building_at(p_world, p_x, p_y) is not null then mount_said('inside') end
$fn$;

/** Why a piece of this kind will not be fixed there, or null: its mount's, or a hedge's. */
create or replace function piece_fixed_refusal(p_world uuid, p_uid uuid, p_sub text, p_x int, p_y int, p_facing text, p_level int) returns text
language sql stable as $fn$
  select case when f.mount is not null then mount_refusal(p_world, p_uid, f.mount, p_x, p_y, p_facing, p_level)
              when f.hedge then hedge_refusal(p_world, p_x, p_y, p_level) end
    from furniture_def f where f.id = p_sub
$fn$;

/** The side a fixed piece goes round to on a turn: the next to the right it may be fixed on, or null (`mountTurnsTo`). */
create or replace function mount_turns_to(p_world uuid, p_uid uuid, p placed) returns text language plpgsql stable as $fn$
declare v_order text[] := array['s', 'w', 'n', 'e']; v_i int; v_face text; v_mount text;
begin
  select f.mount into v_mount from furniture_def f where f.id = p.sub;
  if v_mount is null then return null; end if;
  v_i := coalesce(array_position(v_order, coalesce(p.facing, 's')), 1);
  for k in 1 .. 3 loop
    v_face := v_order[1 + mod(v_i - 1 + k, 4)];
    if mount_refusal(p_world, p_uid, v_mount, p.x, p.y, v_face, coalesce(p.level, 0)) is null then return v_face; end if;
  end loop;
  return null;
end $fn$;

/** Whether a hedge stands along the border (x, y, dir) on a storey (`Game.reindexBars`). */
create or replace function hedge_between(p_world uuid, p_level int, p_x int, p_y int, p_dir text) returns boolean language sql stable as $fn$
  select exists (select 1 from placed pl join furniture_def f on f.id = pl.sub and f.hedge
                   cross join lateral border_of(pl.x, pl.y, pl.facing) bd
                  where pl.world_id = p_world and pl.kind = 'furniture' and coalesce(pl.level, 0) = coalesce(p_level, 0)
                    and bd.x = p_x and bd.y = p_y and bd.dir = p_dir)
$fn$;

/* ---- a carved figure's kind ------------------------------------------------------------------- */

/** Why a figure of this kind will not be carved by this maker, or null (`figureRefusal`). */
create or replace function figure_refusal(p_world uuid, p_uid uuid, p_kind text) returns text language sql stable as $fn$
  select case when coalesce(p_kind, '') = '' then figure_said('pick')
              when not exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = p_kind)
                then figure_said('unseen') end
$fn$;

/* ---- the jobs --------------------------------------------------------------------------------- */

/**
 * Why a job at a garden piece cannot be done now, or null: the browser's
 * `gardenRefusal`, question for question -- there, in reach, whose for what
 * is on show, the tool, and then the piece.
 */
create or replace function garden_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; d furniture_def; g jsonb; v_name text; v_now double precision := extract(epoch from now()); v_it bigint;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
    and sub = any (garden_pieces());
  if not found then return 'It is gone.'; end if;
  select * into d from furniture_def where id = pl.sub;
  v_name := lower(d.name);
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(v_name); end if;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action like 'plant\_%\_flowers' then
    if coalesce(jsonb_array_length(g->'bloom'), 0) >= coalesce(d.bloom, 0) then return garden_said('full', v_name); end if;
    return case when pack_count(p_world, p_uid, 'wildflowers') >= bloom_cost() then null else garden_said('flowers', v_name) end;
  end if;
  if p_action = 'clear_flowers' then
    return case when coalesce(jsonb_array_length(g->'bloom'), 0) > 0 then null else garden_said('noFlowers', v_name) end;
  end if;
  if p_action like 'trim\_topiary\_%' then
    return case when pack_count(p_world, p_uid, trim_tool()) > 0 then null else garden_said('trimTool', v_name) end;
  end if;
  if p_action like 'clip\_hedge\_%' then
    if pack_count(p_world, p_uid, trim_tool()) <= 0 then return garden_said('trimTool', v_name); end if;
    if v_now - extract(epoch from pl.made_at) < hedge_full() * day_seconds() then return garden_said('hedgeYoung', v_name); end if;
    return case when g->>'clip' = substr(p_action, 12) then garden_said('clipped', v_name) end;
  end if;
  if p_action = 'prune_bonsai' then
    if pack_count(p_world, p_uid, prune_tool()) <= 0 then return garden_said('pruneTool', v_name); end if;
    if coalesce((g->>'prunes')::int, 0) >= bonsai_steps() then return garden_said('shaped', v_name); end if;
    return case when g ? 'prune_at' and v_now - (g->>'prune_at')::double precision < prune_rest() * day_seconds()
                then garden_said('pruned', v_name) end;
  end if;
  if p_action in ('show_on_piece', 'take_from_show') and not may_engrave(p_world, p_uid, pl) then
    return garden_said('notYours', v_name);
  end if;
  if p_action = 'show_on_piece' then
    if coalesce(jsonb_array_length(g->'held'), 0) >= coalesce(d.shows_n, 0) then return garden_said('full', v_name); end if;
    v_it := garden_show_item(p_world, p_uid, d.shows, p_target);
    return case when v_it is not null then null when d.shows = 'trophy' then garden_said('noTrophy', v_name) else garden_said('noPot', v_name) end;
  end if;
  if p_action = 'take_from_show' then
    return case when coalesce(jsonb_array_length(g->'held'), 0) > 0 then null else garden_said('nothingShown', v_name) end;
  end if;
  return null;
end $fn$;

/** Whether a thing is what a piece shows: a trophy (`item_def.trophy`) on a plaque, a potted plant on a stand (`showTakes`). */
create or replace function garden_shows(p_shows text, p_def text) returns boolean language sql stable as $fn$
  select case p_shows when 'trophy' then coalesce((select d.trophy from item_def d where d.id = p_def), false)
                      when 'pot' then p_def = any (garden_pots()) else false end
$fn$;

/** The thing in the pack a Put on show would put up: the one named, if the piece shows it, or the first it shows. */
create or replace function garden_show_item(p_world uuid, p_uid uuid, p_shows text, p_target jsonb) returns bigint language sql stable as $fn$
  select i.id from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked and garden_shows(p_shows, i.def)
   order by (i.id = nullif(p_target->>'itemUid', '')::bigint) desc, i.id limit 1
$fn$;

create or replace function perform_garden(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; d furniture_def; g jsonb; v_kind text; it item; v_one jsonb; v_back bigint; v_n int;
        v_now double precision := extract(epoch from now());
begin
  if garden_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  select * into d from furniture_def where id = pl.sub;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action like 'plant\_%\_flowers' then
    v_kind := substr(p_action, 7, length(p_action) - 14);
    if not (v_kind = any (bloom_kinds())) then return; end if;
    if not consume(p_world, p_uid, 'wildflowers', bloom_cost()) then return; end if;
    g := jsonb_set(g, '{bloom}', coalesce(g->'bloom', '[]'::jsonb) || to_jsonb(v_kind));
    perform skill_raise(p_world, p_uid, bloom_skill(), 1);
    perform tell(p_world, p_uid, garden_done('planted', v_kind, jsonb_array_length(g->'bloom'), d.bloom), 'event');
  elsif p_action = 'clear_flowers' then
    v_n := jsonb_array_length(g->'bloom');
    g := g - 'bloom';
    perform tell(p_world, p_uid, garden_done('cleared', null, v_n, null), 'event');
  elsif p_action like 'trim\_topiary\_%' then
    v_kind := substr(p_action, 14);
    if not (v_kind = any (topiary_shapes())) then return; end if;
    g := g || jsonb_build_object('shape', v_kind, 'trim_at', v_now);
    perform skill_raise(p_world, p_uid, trim_skill(), 1);
    perform tell(p_world, p_uid, garden_done('trimmed', v_kind, null, null), 'event');
  elsif p_action like 'clip\_hedge\_%' then
    v_kind := substr(p_action, 12);
    if not (v_kind = any (hedge_clips())) then return; end if;
    g := g || jsonb_build_object('clip', v_kind);
    perform skill_raise(p_world, p_uid, trim_skill(), 1);
    perform tell(p_world, p_uid, garden_done('clipped', v_kind, null, null), 'event');
  elsif p_action = 'prune_bonsai' then
    v_n := coalesce((g->>'prunes')::int, 0) + 1;
    g := g || jsonb_build_object('prunes', v_n, 'prune_at', v_now);
    perform skill_raise(p_world, p_uid, prune_skill(), 1);
    perform tell(p_world, p_uid, garden_done('pruned', null, v_n, bonsai_steps()), 'event');
  elsif p_action = 'show_on_piece' then
    select * into it from item where id = garden_show_item(p_world, p_uid, d.shows, p_target);
    if it.id is null then return; end if;
    -- What it is, and whose name it carries: its maker's (a trophy's slayer's), else whoever puts it up.
    v_one := jsonb_build_object('def', it.def, 'ql', it.ql)
      || case when it.rare is not null then jsonb_build_object('rare', it.rare) else '{}'::jsonb end
      || case when it.maker is not null then jsonb_build_object('maker', it.maker) else '{}'::jsonb end
      || jsonb_build_object('by', coalesce(it.maker, (select py.name from player py where py.world_id = p_world and py.uid = p_uid)));
    if not spend_stack(p_world, p_uid, it.id, 1) then return; end if;
    g := jsonb_set(g, '{held}', coalesce(g->'held', '[]'::jsonb) || jsonb_build_array(v_one));
    perform tell(p_world, p_uid, garden_done('shown', lower((select x.name from item_def x where x.id = it.def)), null, null), 'event');
  elsif p_action = 'take_from_show' then
    v_one := g->'held'->-1;
    g := jsonb_set(g, '{held}', (g->'held') - (jsonb_array_length(g->'held') - 1));
    v_back := give(p_world, p_uid, v_one->>'def', 1, (v_one->>'ql')::double precision, null, v_one->>'rare', v_one->>'maker');
    perform tell(p_world, p_uid, garden_done('taken', lower((select x.name from item_def x where x.id = v_one->>'def')), null, null), 'event');
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

CREATE OR REPLACE FUNCTION public.piece_anchor(p_sub text, p_facing text, p_sx integer, p_sy integer, p_size integer[])
 RETURNS integer[]
 LANGUAGE plpgsql
 STABLE
AS $function$
declare ax int := least(subtiles() - p_size[1], greatest(0, p_sx));
        ay int := least(subtiles() - p_size[2], greatest(0, p_sy));
begin
  if not piece_along_side(p_sub) then return array[ax, ay]; end if;
  -- A window box under the middle of its window (`furnitureAnchor`).
  if (select f.mount from furniture_def f where f.id = p_sub) = 'window' then
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

CREATE OR REPLACE FUNCTION public.perform_fire(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p placed; it item; sz int[]; ax int; ay int; per double precision; room double precision;
        fits int; whole int; sub text; made bigint; back text; v_at int[];
begin
  if p_action = 'build_campfire' then
    ax := least(subtiles() - 2, greatest(0, (p_target->>'sx')::int));
    ay := least(subtiles() - 2, greatest(0, (p_target->>'sy')::int));
    if not consume(p_world, p_uid, 'shaft', 2) then return; end if;
    insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by)
    values (p_world, 'campfire', (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + 1.0) / subtiles(), (p_target->>'y')::int + (ay + 1.0) / subtiles(),
            120, p_uid);
    perform tell(p_world, p_uid, 'Campfire built: 2 × shaft. Unlit.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  if p_action in ('place_smelter', 'place_furniture', 'place_kiln') then
    select * into it from item where id = target_item(p_target);
    -- A piece stands there as whatever it was in the pack. This read the def
    -- through replace(it.def, 'furniture_', '') for as long as the pick-up put
    -- that prefix on, which meant the two halves disagreed about what an item
    -- is called and only one of them ever said so. Neither does now.
    sub := case when p_action = 'place_furniture' then it.def end;
    -- Which way it faces, which is the browser's to say and south when it says nothing.
    back := case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end;
    sz := placed_size(case p_action when 'place_smelter' then 'smelter'
                                    when 'place_kiln' then 'kiln' else 'furniture' end, sub, back);
    -- Kept inside the tile, and a trellis in the row along the side it faces (`piece_anchor`).
    v_at := piece_anchor(sub, back, coalesce((p_target->>'sx')::int, 0), coalesce((p_target->>'sy')::int, 0), sz);
    ax := v_at[1];
    ay := v_at[2];
    /*
     * The quality, and -- new here -- the rarity and the wood.
     *
     * A piece set down used to reach the ground with nothing but its quality.
     * Its rarity went in the bin, so a rare chest was a rare chest right up
     * until somebody put it in a room and then it was a chest; and its wood
     * went with it, so an oak chest and a pine one were the same chest the
     * moment they were standing. Both are on the item being consumed here,
     * and both come across now.
     */
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, rare, material, creature, mark, dye, enchant, dmg, engraving, infuse, garden)
    values (p_world, case p_action when 'place_smelter' then 'smelter'
                                   when 'place_kiln' then 'kiln' else 'furniture' end, sub,
            (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + sz[1] / 2.0) / subtiles(),
            (p_target->>'y')::int + (ay + sz[2] / 2.0) / subtiles(),
            it.ql, p_uid, back, it.rare, it.extra,
            case when p_action = 'place_furniture' then it.creature end,
            -- And its maker's mark, which it carries wherever it stands.
            it.mark,
            -- And its colour: a banner, a flag or a sail dyed in the pack stands dyed.
            it.dye,
            -- And its enchantment and its wear, which it keeps standing and takes up again (`enchanting.ts`).
            it.enchant, it.dmg,
            -- And a memorial stone's line, which it reads standing as it did in the pack.
            it.engraving, it.infuse,
            -- And a garden piece's flowers, shape or kind, as they were in the pack (`garden.ts`).
            it.garden)
    returning id into made;
    delete from item where id = it.id;
    -- And whoever is shut in it stands where it stands, and is seen in it.
    if p_action = 'place_furniture' and it.creature is not null then
      update creature c set from_x = pl.cx, from_y = pl.cy, to_x = pl.cx, to_y = pl.cy,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from placed pl where pl.id = made and c.world_id = p_world and c.id = it.creature;
    end if;
    perform tell(p_world, p_uid, 'Set down: ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end))
      || coalesce(', with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature), '')
      || '.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  perform placed_settle(nullif(p_target->>'id', '')::bigint);
  p := target_placed(p_world, p_target);
  if p.id is null then return; end if;

  if p_action in ('light_campfire', 'light_smelter', 'light_kiln') then
    update placed set lit = true, since = now() where id = p.id;
    if p_action = 'light_campfire' then perform journal_note(p_world, p_uid, 'fire'); end if;
    perform tell(p_world, p_uid, 'Lit: ' || p.kind || '. Fuel: '
      || burns_for(p.fuel / placed_burn_rate(p)) || '.', 'event');
  elsif p_action in ('put_out_campfire', 'damp_smelter', 'damp_kiln') then
    update placed set lit = false, since = now() where id = p.id;
    perform tell(p_world, p_uid, 'Put out: ' || p.kind
      || '. Fuel kept: ' || burns_for(p.fuel / placed_burn_rate(p)) || '.', 'event');
  elsif p_action in ('fuel_campfire', 'fuel_smelter', 'fuel_kiln') then
    -- From what is at hand: the pack, a bag, or a store within reach.
    select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
      where (s.id = target_item(p_target) or fuel_value(s.def) is not null)
      order by (s.id = target_item(p_target)) desc, s.draw limit 1;
    per := fuel_value(it.def);
    room := greatest(0, fire_capacity() - p.fuel);
    /*
     * How many you asked for, which this never read.
     *
     * Reported as "attempting to feed one coal to a smelter puts four coal
     * in". The menu offers one or all and sends the count either way; this
     * fed as much as would fit whatever it was told, so a firebox with room
     * in it swallowed the whole pile on a single "one". The browser has read
     * the count since fuelling was written.
     */
    fits := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), it.count),
                              ceil(room / per)::int));
    if not spend_stack(p_world, p_uid, it.id, fits) then return; end if;
    update placed set fuel = least(fire_capacity(), p.fuel + per * fits), since = now() where id = p.id;
    perform tell(p_world, p_uid, 'Fuelled: ' || case when fits > 1 then fits || ' × ' else '' end
      || lower((select name from item_def where id = it.def)) || '. Fuel: '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || '.', 'event');
  elsif p_action in ('take_ashes_fire', 'take_ashes_smelter', 'take_ashes_kiln') then
    whole := floor(p.ash)::int;
    update placed set ash = p.ash - whole, since = now() where id = p.id;
    perform give(p_world, p_uid, 'ash', whole, 20);
    perform tell(p_world, p_uid, 'Raked out: ' || whole || ' × ashes, QL 20.', 'event');
  elsif p_action = 'take_apart_campfire' then
    -- Coal burns but is never got back, so a pile of logs cannot be turned
    -- into coal by rebuilding the fire.
    delete from placed where id = p.id;
    perform give(p_world, p_uid, 'shaft', 2, 20);
    perform tell(p_world, p_uid, 'Taken apart: campfire. Recovered: 2 × shaft.', 'event');
    perform land_announce(p_world, p.x, p.y);
  elsif p_action = 'turn_furniture' then
    -- A quarter turn to the right, walked to the nearest spot the turned block fits.
    -- On round past a facing a post's arm would go into a wall (`lamps.ts`); a trellis to the next side with its wall (`vineyard.ts`).
    back := case when p.sub = vine_kind() then coalesce(trellis_turns_to(p_world, p_uid, p), p.facing)
                 -- And a piece fixed to a wall or hung, to the next side it is fixed on (`garden.ts`).
                 when exists (select 1 from furniture_def f where f.id = p.sub and f.mount is not null)
                   then coalesce(mount_turns_to(p_world, p_uid, p), p.facing)
                 else lamp_turns_to(p_world, p) end;
    sz := placed_size(p.kind, p.sub, back);
    v_at := piece_anchor(p.sub, back, p.sx, p.sy, sz);
    ax := v_at[1];
    ay := v_at[2];
    update placed set facing = back, sx = ax, sy = ay,
        cx = p.x + (ax + sz[1] / 2.0) / subtiles(), cy = p.y + (ay + sz[2] / 2.0) / subtiles()
      where id = p.id;
    perform tell(p_world, p_uid, 'Turned: ' || lower(placed_name(p)) || ', facing ' || side_name(back) || '.', 'event');
    perform land_announce(p_world, p.x, p.y);

  elsif p_action in ('pick_up_smelter', 'pick_up_furniture', 'pick_up_kiln') then
    /*
     * What goes back in the pack is the thing's own definition, which for a
     * piece of furniture is its `sub` and nothing else.
     *
     * It used to be 'furniture_' || p.sub. There is no such item: the
     * catalogue calls a wagon a wagon, so picking one up put a row in your
     * pack with a definition nothing has ever heard of. It showed as its own
     * id under OTHER, weighed whatever the fallback weighs, and could not be
     * set down again, because the browser asks `isFurniture` of the id it is
     * holding and the answer was no. The wagon was not lost, but it was not a
     * wagon either.
     *
     * The other half of the pair hid it: `place_furniture` reads its `sub`
     * with replace(it.def, 'furniture_', ''), so it would have accepted the
     * broken id perfectly well and nothing on this side ever complained.
     */
    back := case p.kind when 'smelter' then 'smelter' when 'kiln' then 'kiln'
                        else p.sub end;
    -- And back the same way: what it stood there as is what goes in the pack.
    -- `give` has taken a material and a rarity since the day it was written.
    -- Given before the piece comes up, so a crate's wildermon is never in no crate at all.
    made := give(p_world, p_uid, back, 1, p.ql, p.material, p.rare);
    if p.mark is not null then update item set mark = p.mark where id = made; end if;
    -- And its colour, back on the thing in the pack.
    if p.dye is not null then update item set dye = p.dye where id = made; end if;
    -- And its enchantment and its wear, back on the thing in the pack.
    update item set enchant = p.enchant, dmg = p.dmg, infuse = p.infuse where id = made;
    -- And a memorial stone's line, carried in the pack as it stood.
    if p.engraving is not null then update item set engraving = p.engraving where id = made; end if;
    -- And a garden piece's flowers, shape or kind, carried in the pack as it stood (`garden.ts`).
    if p.garden is not null then update item set garden = p.garden where id = made; end if;
    if p.creature is not null then
      update item set creature = p.creature where id = made;
      update creature c set from_x = py.x, from_y = py.y, to_x = py.x, to_y = py.y,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from player py where py.world_id = p_world and py.uid = p_uid
          and c.world_id = p_world and c.id = p.creature;
    end if;
    delete from placed where id = p.id;
    perform tell(p_world, p_uid, 'Picked up: '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(', with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature), '')
      || '.', 'event');
    perform land_announce(p_world, p.x, p.y);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.creature_way(p_world uuid, p_x0 integer, p_y0 integer, p_l0 integer, p_x1 integer, p_y1 integer, p_l1 integer)
 RETURNS integer[]
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_b int[]; bx0 int; by0 int; bx1 int; by1 int; w int; h int; wh int; top int; n int;
  -- What a cell's floor slot holds: 0 nothing, 1 something to stand on, 2 a finished flight, 3 a finished spiral
  -- staircase, 4 a finished ladder, 5 anything else (a plan, or a roof nobody walks on), 6 a bridge's deck. And a
  -- flight's foot, the side it is climbed from, as a step `d` below: 1 east, 2 west, 3 south, 4 north.
  st int[]; ft int[]; bh boolean[]; bv boolean[]; par int[]; ex int[]; ey int[]; goal boolean[];
  q int[] := '{}'; qh int := 1; qn int := 0; k int; kn int; x int; y int; l int; nx int; ny int; d int;
  dxs int[] := array[1, -1, 0, 0]; dys int[] := array[0, 0, 1, -1]; op int[] := array[2, 1, 4, 3];
  g_seen boolean := false; g_par int := 0; g_x int; g_y int; hit int := 0; v_out int[] := '{}';
  r record; fx int; fy int; blk boolean; ok boolean; hx int; hy int; hk int; lk boolean;
  -- The bridges a storey up (`storey_deck_cells`), those in the search, and per cell: whose deck it is (`dk`), whose
  -- end (`en`), by place in `v_bs`.
  cb bigint[]; cl int[]; cx int[]; cy int[]; cd boolean[]; v_bs bigint[] := '{}'; v_more bigint[]; dk int[]; en int[];
begin
  if p_l0 <= 0 and p_l1 <= 0 then return '{}'; end if;
  select array_agg(distinct f.building) into v_b from floor_tile f
   where f.world_id = p_world and f.level >= 1
     and ((p_l0 > 0 and f.x = p_x0 and f.y = p_y0)
          or (p_l1 > 0 and f.x between p_x1 - 1 and p_x1 + 1 and f.y between p_y1 - 1 and p_y1 + 1));
  -- The bridges a storey up the way starts or ends on, or whose ends land on the floors of a building in it, and the
  -- buildings at their ends in turn.
  select coalesce(array_agg(c.bridge), '{}'), coalesce(array_agg(c.level), '{}'), coalesce(array_agg(c.x), '{}'),
         coalesce(array_agg(c.y), '{}'), coalesce(array_agg(c.deck), '{}')
    into cb, cl, cx, cy, cd from storey_deck_cells(p_world) c;
  for i in 1 .. 8 loop
    exit when cardinality(cb) = 0;
    select coalesce(array_agg(distinct c.bridge), '{}') into v_more
      from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
     where not (c.bridge = any(v_bs))
       and ((c.deck and ((c.level = p_l0 and c.x = p_x0 and c.y = p_y0) or (c.level = p_l1 and c.x = p_x1 and c.y = p_y1)))
            or (not c.deck and exists (select 1 from floor_tile f where f.world_id = p_world and f.level = c.level
                                         and f.x = c.x and f.y = c.y and f.building = any(coalesce(v_b, '{}')))));
    exit when cardinality(v_more) = 0;
    v_bs := v_bs || v_more;
    select array_agg(distinct s.b) into v_b from (
      select unnest(coalesce(v_b, '{}')) as b
      union
      select f.building from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
        join floor_tile f on f.world_id = p_world and f.level = c.level and f.x = c.x and f.y = c.y
       where c.bridge = any(v_more) and not c.deck) s;
  end loop;
  if v_b is null then return null; end if;
  select min(f.x) - 1, min(f.y) - 1, max(f.x) + 1, max(f.y) + 1, max(f.level) into bx0, by0, bx1, by1, top
    from floor_tile f where f.world_id = p_world and f.building = any(v_b) and f.level >= 1;
  -- And over the decks between them.
  select least(bx0, min(c.x) - 1), least(by0, min(c.y) - 1), greatest(bx1, max(c.x) + 1), greatest(by1, max(c.y) + 1)
    into bx0, by0, bx1, by1 from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs);
  w := bx1 - bx0 + 1; h := by1 - by0 + 1; wh := w * h; n := (top + 1) * wh;
  if p_l0 > top or p_l1 > top then return null; end if;
  st := array_fill(0, array[n]); ft := array_fill(0, array[n]); par := array_fill(0, array[n]);
  ex := array_fill(0, array[n]); ey := array_fill(0, array[n]); dk := array_fill(0, array[n]); en := array_fill(0, array[n]);
  bh := array_fill(false, array[n]); bv := array_fill(false, array[n]); goal := array_fill(false, array[n]);

  for r in select f.level, f.x, f.y, f.kind, f.hand, f.facing, bill_done(f.needed) as done,
                  case when f.kind = 'roof' then coalesce((select rs.walkable from building b join roof_shape_def rs on rs.id = coalesce(b.roof, 'hip')
                                                            where b.world_id = p_world and b.id = f.building), false) end as deck
             from floor_tile f
            where f.world_id = p_world and f.building = any(v_b) and f.level between 0 and top loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    st[k] := case
      when not r.done then 5
      when r.kind = 'stairs' and r.hand = 's' then 3
      when r.kind = 'stairs' then 2
      when r.kind = 'ladder' then 4
      when r.kind = 'roof' and not r.deck then 5
      else 1 end;
    ft[k] := case coalesce(r.facing, 's') when 'e' then 1 when 'w' then 2 when 's' then 3 else 4 end;
  end loop;
  -- A bridge's deck a storey up, where no floor is: stood on at its storey (`frame_stands`). Its ends are its floors' tiles.
  for r in select c.* from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs) and c.level <= top loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if not r.deck then en[k] := array_position(v_bs, r.bridge);
    elsif st[k] = 0 then st[k] := 6; dk[k] := array_position(v_bs, r.bridge);
    end if;
  end loop;
  -- The walls a beast does not go through (`blocksAt` with `beast`): `h` on a tile's north side, `v` on its west.
  for r in select wl.level, wl.dir, wl.x, wl.y from wall wl left join wall_type_def t on t.id = wl.type
            where wl.world_id = p_world and wl.level between 0 and top
              and wl.x between bx0 and bx1 and wl.y between by0 and by1 and bill_done(wl.needed)
              and (wl.type = 'hidden_door' or not coalesce(t.passable, false) or coalesce(t.beast_proof, false) or wl.lowered) loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if r.dir = 'h' then bh[k] := true; else bv[k] := true; end if;
  end loop;
  -- And the borders a hedge stands along, on the ground, as a fence's (`hedge_between`, `garden.ts`).
  for r in select 0 as level, bd.dir, bd.x, bd.y from placed pl join furniture_def f on f.id = pl.sub and f.hedge
             cross join lateral border_of(pl.x, pl.y, pl.facing) bd
            where pl.world_id = p_world and pl.kind = 'furniture' and coalesce(pl.level, 0) = 0
              and bd.x between bx0 and bx1 and bd.y between by0 and by1 loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if r.dir = 'h' then bh[k] := true; else bv[k] := true; end if;
  end loop;

  -- Where it is going: the tile, if there is something to stand on there, and otherwise those beside it there are.
  if p_l1 > 0 then
    if p_x1 < bx0 or p_x1 > bx1 or p_y1 < by0 or p_y1 > by1 then return null; end if;
    k := (p_l1 * h + (p_y1 - by0)) * w + (p_x1 - bx0) + 1;
    if st[k] in (1, 2, 3, 6) then
      goal[k] := true;
    else
      for d in 1..4 loop
        nx := p_x1 + dxs[d]; ny := p_y1 + dys[d];
        continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
        kn := (p_l1 * h + (ny - by0)) * w + (nx - bx0) + 1;
        blk := case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
        if st[kn] in (1, 3) and not blk then goal[kn] := true; ok := true; end if;
      end loop;
      if not coalesce(ok, false) then return null; end if;
    end if;
  end if;

  if p_l0 > 0 then
    if p_x0 < bx0 or p_x0 > bx1 or p_y0 < by0 or p_y0 > by1 then return null; end if;
    k := (p_l0 * h + (p_y0 - by0)) * w + (p_x0 - bx0) + 1;
    if goal[k] then return '{}'; end if;
    par[k] := -1;
    qn := 1; q[1] := k;
  end if;

  <<search>>
  loop
    -- The ground, where it starts or once it is down off a flight: on up every flight of storey 2 from its foot.
    if not g_seen and (p_l0 <= 0 or g_par <> 0) then
      g_seen := true;
      if g_par <> 0 and p_l1 <= 0 then exit search; end if;
      for y in by0..by1 loop
        for x in bx0..bx1 loop
          k := (h + (y - by0)) * w + (x - bx0) + 1;
          continue when par[k] <> 0 or st[k] not in (2, 3);
          -- A spiral staircase from its own tile; a flight from its foot.
          fx := x + case when st[k] = 2 then dxs[ft[k]] else 0 end;
          fy := y + case when st[k] = 2 then dys[ft[k]] else 0 end;
          continue when fx < bx0 or fx > bx1 or fy < by0 or fy > by1;
          kn := (fy - by0) * w + (fx - bx0) + 1;
          continue when st[k] = 2 and case ft[k] when 1 then bv[kn] when 2 then bv[k - wh] when 3 then bh[kn] else bh[k - wh] end;
          continue when st[kn] in (2, 4) or (st[k] = 2 and st[kn + wh] in (2, 3, 4)) or not creature_tile_ok(p_world, fx, fy);
          ex[k] := fx; ey[k] := fy; par[k] := -2; qn := qn + 1; q[qn] := k;
          if goal[k] then hit := k; exit search; end if;
        end loop;
      end loop;
    end if;
    exit search when qh > qn;
    k := q[qh]; qh := qh + 1;
    l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
    -- On a flight whose head is the foot of the next flight up, the two climbed the same way: a landing at its head.
    lk := false;
    if st[k] = 2 and l + 1 <= top then
      hx := x + dxs[op[ft[k]]]; hy := y + dys[op[ft[k]]];
      if hx between bx0 and bx1 and hy between by0 and by1 then
        hk := ((l + 1) * h + (hy - by0)) * w + (hx - bx0) + 1;
        lk := st[hk] = 2 and ft[hk] = ft[k];
      end if;
    end if;
    -- Round a spiral staircase, up it from its foot and down it from its head (`Game.liftRule`).
    if l + 1 <= top and st[k + wh] = 3 and par[k + wh] = 0 then
      par[k + wh] := k; qn := qn + 1; q[qn] := k + wh;
      if goal[k + wh] then hit := k + wh; exit search; end if;
    end if;
    if st[k] = 3 then
      if l = 1 then
        if not g_seen and g_par = 0 and st[k - wh] not in (2, 4) and creature_tile_ok(p_world, x, y) then g_par := k; g_x := x; g_y := y; end if;
      elsif st[k - wh] in (1, 2, 3) and par[k - wh] = 0 then
        par[k - wh] := k; qn := qn + 1; q[qn] := k - wh;
        if goal[k - wh] then hit := k - wh; exit search; end if;
      end if;
    end if;
    for d in 1..4 loop
      nx := x + dxs[d]; ny := y + dys[d];
      continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
      kn := (l * h + (ny - by0)) * w + (nx - bx0) + 1;
      if st[k] = 2 and d = ft[k] then
        -- On a flight, off its foot: down onto the storey under it.
        continue when case d when 1 then bv[kn - wh] when 2 then bv[k - wh] when 3 then bh[kn - wh] else bh[k - wh] end;
        if l = 1 then
          if not g_seen and g_par = 0 and st[kn - wh] not in (2, 4) and creature_tile_ok(p_world, nx, ny) then
            g_par := k; g_x := nx; g_y := ny;
          end if;
        -- Or onto the head of the flight under it, climbed the same way: on down that one.
        elsif (st[kn - wh] in (1, 3) or (st[kn - wh] = 2 and ft[kn - wh] = d)) and par[kn - wh] = 0 then
          par[kn - wh] := k; qn := qn + 1; q[qn] := kn - wh;
          if goal[kn - wh] then hit := kn - wh; exit search; end if;
        end if;
        continue;
      end if;
      -- Its rails: off a flight only at its head or its foot, and at a landing (above) off its sides too.
      continue when st[k] = 2 and d <> op[ft[k]] and not lk;
      continue when case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
      -- A bridge's deck: onto it from one of its ends or along it, off it onto one of its ends (`Game.bridgeStepLevel`).
      continue when (st[kn] = 6 and dk[kn] <> dk[k] and en[k] <> dk[kn]) or (st[k] = 6 and st[kn] <> 6 and en[kn] <> dk[k]);
      if l + 1 <= top and st[kn + wh] = 2 and ft[kn + wh] = op[d] and goal[kn] and par[kn] = 0 then
        -- Where it is going: the foot of a flight up from this storey (a wall on that tile's side is fitted from
        -- there, `hod_stand`). It stops there rather than going on up.
        par[kn] := k; hit := kn; exit search;
      end if;
      if l + 1 <= top and st[kn + wh] in (2, 4) then
        -- Onto a flight going up from this storey, from its foot: up it. A ladder: no.
        if st[kn + wh] = 2 and ft[kn + wh] = op[d] and par[kn + wh] = 0 then
          par[kn + wh] := k; qn := qn + 1; q[qn] := kn + wh;
          if goal[kn + wh] then hit := kn + wh; exit search; end if;
        end if;
      elsif st[kn] = 2 then
        -- Onto the head of a flight up to this storey, from the storey's side: on its way down. Onto a landing (above)
        -- from either side too.
        hx := nx + dxs[op[ft[kn]]]; hy := ny + dys[op[ft[kn]]];
        hk := ((l + 1) * h + (hy - by0)) * w + (hx - bx0) + 1;
        if par[kn] = 0 and (ft[kn] = d
            or (d <> op[ft[kn]] and l + 1 <= top and hx between bx0 and bx1 and hy between by0 and by1
                and st[hk] = 2 and ft[hk] = ft[kn])) then
          par[kn] := k; qn := qn + 1; q[qn] := kn;
          if goal[kn] then hit := kn; exit search; end if;
        end if;
      elsif st[kn] in (1, 3, 6) and par[kn] = 0 then
        par[kn] := k; qn := qn + 1; q[qn] := kn;
        if goal[kn] then hit := kn; exit search; end if;
      end if;
    end loop;
  end loop;

  if hit = 0 and not (p_l1 <= 0 and g_par <> 0) then return null; end if;
  -- Back from where it got to, to where it started.
  if hit = 0 then
    v_out := array[g_x, g_y, 0];
    k := g_par;
  else
    k := hit;
  end if;
  loop
    exit when par[k] = -1;
    v_out := array[bx0 + (k - 1) % w, by0 + ((k - 1) / w) % h, (k - 1) / wh] || v_out;
    if par[k] = -2 then
      v_out := array[ex[k], ey[k], 0] || v_out;
      exit when p_l0 <= 0;
      v_out := array[g_x, g_y, 0] || v_out;
      k := g_par;
    else
      k := par[k];
    end if;
  end loop;
  return v_out;
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
    -- A stack is split so the rest stays as it was.
    if it.count > 1 then
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
    update item set dye = null where id = it.id;
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

CREATE OR REPLACE FUNCTION public.sow_planter(p_world uuid, p_uid uuid, p_placed bigint, p_seed bigint)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare it item; cd crop_def; v_kept boolean; p placed;
begin
  select * into p from placed where id = p_placed and world_id = p_world;
  if not found or not is_planter(p.sub) then return null; end if;
  select * into it from item i
    where i.id = p_seed and i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid;
  if not found then return null; end if;
  select * into cd from crop_def where seed = it.def;
  if cd.id is null then return null; end if;
  -- A herb box grows herbs and nothing else (`garden.ts`).
  if (select f.herbs from furniture_def f where f.id = p.sub) is not null and not (cd.id = any (herb_crops())) then return null; end if;
  v_kept := random() < pk(p_world, p_uid, 'keep:plant_seed', 0);
  if not v_kept then
    if not consume(p_world, p_uid, it.def, 1, it.id) then return null; end if;
  end if;
  insert into planter_crop (placed, world_id, id, ql, sown_by, pace)
  values (p_placed, p_world, cd.id, it.ql, p_uid, planter_pace(p_world, p_uid, p_placed, cd.id))
  on conflict (placed) do update set id = excluded.id, stage = 0, stage_at = now(),
    tended = 0, tended_now = false, ql = excluded.ql, sown_by = excluded.sown_by, pace = excluded.pace;
  -- What it was sown with, for the next sowing's Crop Rotation.
  update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('sown', cd.id) where id = p_placed;
  perform land_announce(p_world, p.x, p.y);
  return case when v_kept then 'kept' else 'sown' end;
end $function$;

CREATE OR REPLACE FUNCTION public.planter_refusal(p_world uuid, p_uid uuid, p_action text, p placed, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare c planter_crop; it item; s record; v_stage int; v_tended_now boolean;
begin
  if action_tool(p_action) is not null and need_tool(p_world, p_uid, action_tool(p_action)) is not null then return need_tool(p_world, p_uid, action_tool(p_action)); end if;
  if not is_planter(p.sub) then
    return case when p_action = 'plant_seed' then 'Choose a field.' else 'No crop there.' end;
  end if;
  select * into c from planter_crop where placed = p.id;
  if c.placed is not null then
    select * into s from crop_settled(c.stage, c.stage_at, planter_per(c, p), true);
    v_stage := s.o_stage;
    v_tended_now := c.tended_now and s.o_steps = 0;
  end if;
  if p_action = 'plant_seed' then
    if c.placed is not null then return 'Already growing a crop.'; end if;
    select * into it from item
      where id = target_item(p_target) and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found or not exists (select 1 from crop_def where seed = it.def) then return 'Choose a seed.'; end if;
    -- A herb box grows herbs and nothing else (`garden.ts`).
    if (select f.herbs from furniture_def f where f.id = p.sub) is not null
       and not ((select cd.id from crop_def cd where cd.seed = it.def) = any (herb_crops())) then
      return herbs_only_said();
    end if;
  elsif p_action = 'tend_crop' then
    if c.placed is null then return 'No crop there.'; end if;
    if v_stage >= crop_ripe() then return 'Ripe: harvest it.'; end if;
    if v_tended_now then return 'Already tended at this growth stage.'; end if;
  elsif p_action = 'harvest_crop' then
    if c.placed is null then return 'No crop there.'; end if;
    if v_stage < crop_ripe() then return 'Not ripe: ' || crop_stage_name(v_stage) || '.'; end if;
  elsif p_action = 'clear_field' then
    if c.placed is null then return 'No crop there.'; end if;
  else
    -- Tilling and a Farmer's patches are the ground's, not a box's.
    return 'Choose a field.';
  end if;
  return null;
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
  select * into r from reap_what(p_world, p_uid, c.id, c.tended, c.ql, p_skill);
  perform set_config('wildermon.reap_share', '', true);
  o_produce := r.o_produce; o_got := r.o_got; o_seed := r.o_seed; o_seeds := r.o_seeds; o_ql := r.o_ql; o_rare := r.o_rare;
  delete from planter_crop where placed = p_placed;
  select * into p from placed where id = p_placed;
  perform land_announce(p_world, p.x, p.y);
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

CREATE OR REPLACE FUNCTION public.perform_planter(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p placed; c planter_crop; cd crop_def; it item; yld int[]; s double precision; v_how text; r record;
begin
  select * into p from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint;
  if p.id is null or not is_planter(p.sub) then return; end if;
  s := skill_of(p_world, p_uid, 'farming');
  -- Anything that works a crop works it up to date.
  perform planter_settle(p_world, p.id);
  select * into c from planter_crop where placed = p.id;
  if c.placed is not null then select * into cd from crop_def where id = c.id; end if;

  if p_action = 'plant_seed' then
    if c.placed is not null then return; end if;
    select * into it from item where id = target_item(p_target);
    select * into cd from crop_def where seed = it.def;
    v_how := sow_planter(p_world, p_uid, p.id, it.id);
    if v_how is null then return; end if;
    select * into c from planter_crop where placed = p.id;
    -- When it will be sprouting, in real time, at a planter's share of the crop's pace.
    perform tell(p_world, p_uid, sown_said(cd.name, true, crop_when(crop_stage_name(1), planter_per(c, p), true))
      || case when v_how = 'kept' then ' Seed kept.' else '' end, 'event');

  elsif p_action = 'tend_crop' then
    if c.placed is null or c.stage >= crop_ripe() or c.tended_now then return; end if;
    update planter_crop set tended_now = true, tended = tended + 1,
        ql = (ql * (tended + 1) + product_ql(s, 0)) / (tended + 2)
      where placed = p.id returning * into c;
    yld := crop_yield(c.tended);
    -- What it should give the one tending it, with their own Bumper Crop.
    if c.tended >= crop_ripe() then
      yld[2] := yld[2] + floor(pk(p_world, p_uid, 'bumper:harvest_crop', 0))::int;
    end if;
    -- A herb box's share of it (`garden.ts`).
    yld[2] := greatest(1, floor(yld[2] * coalesce((select f.herbs from furniture_def f where f.id = p.sub), 1) + 0.5)::int);
    perform tell(p_world, p_uid, 'Tended: ' || lower(cd.name) || '. Expected yield: '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ', ' || seed_says() || '.', 'event');
    perform skill_raise(p_world, p_uid, 'farming', 1);

  elsif p_action = 'harvest_crop' then
    if c.placed is null or c.stage < crop_ripe() then return; end if;
    select * into r from reap_planter(p_world, p_uid, p.id, s);
    if r.o_produce is null then return; end if;
    perform tell(p_world, p_uid, 'Harvested: ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ', ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || ', QL ' || to_char(r.o_ql, 'FM990.0') || '. Planter ready to sow.', 'event');
    if r.o_rare is not null then
      perform journal_note(p_world, p_uid, r.o_rare);
      perform tell(p_world, p_uid, rarity_word(r.o_rare), 'skill');
    end if;
    perform skill_raise(p_world, p_uid, 'farming', 1);

  elsif p_action = 'clear_field' then
    if c.placed is null then return; end if;
    delete from planter_crop where placed = p.id;
    perform land_announce(p_world, p.x, p.y);
    perform tell(p_world, p_uid, 'Cleared: ' || lower(cd.name) || '.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.craft_ran_out(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare o jsonb := p_target->'ranOut'; aimed bigint := target_item(p_target); n int;
begin
  -- A carved figure is of a kind its maker has seen in the field guide, chosen at the bench (`garden.ts`).
  if p_recipe = 'make_' || carved_figure_kind() and figure_refusal(p_world, p_uid, p_target->>'species') is not null then
    return figure_refusal(p_world, p_uid, p_target->>'species');
  end if;
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'item') is distinct from 'string'
     or jsonb_typeof(o->'material') is distinct from 'string' or aimed is null
     or exists (select 1 from craft_stock(p_world, p_uid, aimed) s where s.id = aimed) then
    return null;
  end if;
  n := recipe_need(p_world, p_uid, p_recipe,
         coalesce((select ri.count from recipe_input ri where ri.recipe = p_recipe and ri.item = o->>'item'
                    order by ri.ord limit 1), 1));
  return 'Need ' || n || ' ' || plural_of(o->>'item', n) || ' of ' || lower(o->>'material') || '.';
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

CREATE OR REPLACE FUNCTION public.lair_hoard_give(p_world uuid, p_uid uuid, p_lair integer, p_roll jsonb, p_ql double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare l lair; k record; v_said text[] := '{}'; v_book text; v_got text; v_title text; v_out jsonb := '{}'::jsonb;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  if (p_roll->>'map')::boolean and bury_treasure(p_world, p_uid, p_ql, l.x + 0.5, l.y + 0.5) is not null then
    v_said := v_said || 'treasure map'::text;
    v_out := v_out || '{"map": true}';
  end if;
  -- Its slayer's name on it, which a trophy plaque shows under it (`garden.ts`).
  perform give(p_world, p_uid, k.trophy, 1, p_ql, null, null, (select py.name from player py where py.world_id = p_world and py.uid = p_uid));
  v_said := v_said || lower((select d.name from item_def d where d.id = k.trophy));
  v_out := v_out || jsonb_build_object('trophy', k.trophy);
  if k.scales > 0 then
    perform give(p_world, p_uid, 'dragon_scale', k.scales, p_ql, hoard_scale());
    v_said := v_said || (k.scales || ' hoard dragon scales');
    v_out := v_out || jsonb_build_object('scales', k.scales);
  end if;
  if (p_roll->>'book')::boolean then
    v_book := (select bd.book from book_drops() bd where bd.kind = k.species);
    v_got := private.recipe_to_drop(p_world, p_uid, v_book);
    if v_got is not null then
      v_title := (select lr.title from locked_recipes() lr where lr.id = v_got);
      perform give(p_world, p_uid, book_item(v_book), 1, p_ql, v_title);
      v_said := v_said || (lower((select d.name from item_def d where d.id = book_item(v_book))) || ' (' || lower(v_title) || ')');
      v_out := v_out || jsonb_build_object('book', v_got);
    end if;
  end if;
  perform tell(p_world, p_uid, 'Hoard (' || lower(k.name) || '): ' || listed(v_said) || '.', 'event');
  return v_out;
end $function$;

select private.lock_doors();
