-- Drop dirt and Change tile, two jobs.
--
-- Reported: an exposed iron vein read as Dirt after somebody used Change tile on it. `drop_dirt` raised a corner and
-- then ran `reconcile_around`, and a Rock tile with soil on any corner is Dirt to `reconcile`; the tile it named was
-- then laid as the spadeful (`buryable`). Asked: Change tile never on rock, ores or seams; Drop dirt and Change tile
-- two different jobs; Change tile changes no heights.
--
--   * `drop_dirt` (a corner) and `drop_dirt_here` (at your feet), labelled Drop dirt by the definitions: one dirt,
--     clay or sand raises the corner one step, height and soil, as before, and lays no tile. Refused at a corner any of
--     whose tiles is a Rock tile (rock, ore, seam): "Rock at this corner." (`corner_rock`), so the reconcile after it
--     can no longer bury rock. Concrete (`raise_rock`) and the Mason's rubble raise rock.
--   * `change_tile` (a tile), new: one dirt, clay or sand lays the tile as it (`spoil_tile`), data cleared as the
--     browser's `setTile` clears it; no height, no soil. Only on `buryable` ground and only with a spoil whose tile is
--     not the tile's own (`change_spoil`); refused under a building (`under_building`). Through `ground_action` to
--     `ground_refusal` and `perform_ground`; a job that shapes the ground (`shapes_ground`) and that a Runestone guards
--     (`stone_guarded`, from the definitions).
--
-- The browser's `drop_dirt`, `drop_dirt_here` and `change_tile` (`src/game/actions.ts`) say the same in the same words.

set local lock_timeout = '3s';

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

-- ---- the two new rules ------------------------------------------------------------------------------------------

-- Drop dirt at a corner of a rock, ore or seam tile: the browser's `rockAtCorner`.
create or replace function public.corner_rock(p_world uuid, p_cx integer, p_cy integer) returns text
  language sql stable as $fn$
  select case when exists (select 1 from generate_series(p_cx - 1, p_cx) x
                             cross join generate_series(p_cy - 1, p_cy) y
                           where in_bounds(p_world, x, y) and land_tile(p_world, x, y) = tile_id('Rock'))
              then 'Rock at this corner.' end
$fn$;

/*
 * The spadeful Change tile lays on (x, y): the one named off the menu, or the first to hand -- the pack, then a crate
 * or a piece of furniture within reach, as `spoil_near` looks -- whose tile is not the one there. The browser's
 * `changeSpoil`.
 */
create or replace function public.change_spoil(p_world uuid, p_uid uuid, p_x integer, p_y integer, p_item bigint) returns text
  language plpgsql stable as $fn$
declare v_def text; v_here int := land_tile(p_world, p_x, p_y);
        v_want text[] := array(select s from unnest(array['dirt', 'clay', 'sand']) with ordinality u(s, n)
                                where spoil_tile(s) is distinct from v_here order by n);
begin
  if p_item is not null then return spoil_in_hand(p_world, p_uid, p_item); end if;
  select i.def into v_def from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
     and i.def = any(v_want)
   order by array_position(v_want, i.def), i.id limit 1;
  if v_def is not null then return v_def; end if;
  select i.def into v_def from item i
    join crate c on c.world_id = i.world_id and c.id = i.crate
   where i.world_id = p_world and i.holder = 'crate' and i.def = any(v_want) and not i.locked
     -- Never a settlement store, whose takes are all logged.
     and c.store_of is null
     and c.id = (select cc.id from nearest_crate(p_world, crate_centre_x(c), crate_centre_y(c),
                                                    pk(p_world, p_uid, 'reach:soil', spoil_reach())) cc limit 1)
   order by array_position(v_want, i.def), i.id limit 1;
  if v_def is not null then return v_def; end if;
  select i.def into v_def from item i
    join placed p on p.world_id = i.world_id and p.id = i.placed
   where i.world_id = p_world and i.holder = 'furniture' and i.def = any(v_want) and not i.locked
     and near_piece(p_world, p_uid, p, pk(p_world, p_uid, 'reach:soil', spoil_reach()))
     -- Not out of a grave, as `spoil_near` asks.
     and p.crumbles_at is null
     -- Nor a settlement store, whose takes are all logged.
     and p.store_of is null
   order by array_position(v_want, i.def), i.id limit 1;
  return v_def;
end $fn$;

-- ---- which door it goes through ---------------------------------------------------------------------------------

create or replace function public.ground_action(p_action text) returns boolean
  language sql immutable as $function$
  select p_action in ('flatten', 'drop_dirt', 'change_tile', 'pave_slabs', 'remove_paving',
                      'cut_grass', 'cut_moss', 'cut_reeds', 'pick_fruit', 'pick_sprout',
                      'plant', 'prune', 'graft', 'harvest_bush', 'dig_stump', 'raise_rock', 'dredge', 'dig_worms', 'prospect',
                      -- The surveyor's level, which is a corner and nothing else.
                      'take_level', 'clear_level',
                      -- A Mason's Rubble Fill.
                      'rubble_fill',
                      -- A Forester's Coppice, Tap Resin and Clear Brush.
                      'coppice', 'tap_resin', 'clear_brush',
                      -- Garden steps, laid and taken up.
                      'lay_steps', 'lay_timber_steps', 'take_up_steps')
$function$;

create or replace function public.shapes_ground(p_action text) returns boolean
  language sql immutable as $function$
  select p_action in ('dig', 'dredge', 'flatten', 'drop_dirt', 'drop_dirt_here', 'change_tile', 'raise_rock',
                      'mine', 'chip_corner', 'pack', 'cultivate', 'pave_cobble',
                      'pave_slabs', 'remove_paving',
                      'plan_foundation', 'pour_foundation', 'strike_foundation',
                      'dig_spring', 'stop_spring', 'dig_pool', 'fill_pool',
                      'lay_steps', 'lay_timber_steps', 'take_up_steps', 'plant_moss', 'plant_grass',
                      -- Stepping stones laid and taken up, and a water lily or a lotus planted or pulled up.
                      'lay_stones', 'lift_stones', 'plant_lily', 'plant_lotus', 'pull_water_plant')
$function$;

-- ---- refusals ---------------------------------------------------------------------------------------------------

select pg_temp.patch_fn('public.ground_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if here = 2 then return t.name || ': cultivate first.'; end if;
    return coalesce(level_stop(p_world, p_uid, cx, cy, 1),
                    slope_refusal(p_world, p_uid, 'digging', cx, cy, 1));
$o$,
  $n$    if here = 2 then return t.name || ': cultivate first.'; end if;
    -- Not at a corner of rock, ore or a seam, which the reconcile after it would bury (`corner_rock`).
    return coalesce(corner_rock(p_world, cx, cy),
                    level_stop(p_world, p_uid, cx, cy, 1),
                    slope_refusal(p_world, p_uid, 'digging', cx, cy, 1));

  elsif p_action = 'change_tile' then
    if not exists (select 1 from buryable b where b.tile = here) then return 'Not on ' || lower(t.name) || '.'; end if;
    v_spoil := change_spoil(p_world, p_uid, tx, ty, target_item(p_target));
    if v_spoil is null then
      return case when target_item(p_target) is not null then 'Not dirt, clay or sand.'
                  else 'Need dirt, clay or sand, in the pack or a container beside you.' end;
    end if;
    if spoil_tile(v_spoil) = here then return 'Already ' || lower(t.name) || '.'; end if;
    return under_building(p_world, tx, ty);
$n$);

select pg_temp.patch_fn('public.terrain_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      return (select name from tile_def where id = 2) || ': cultivate first.';
    end if;
    return slope_refusal(p_world, p_uid, 'digging', cx, cy, 1);$o$,
  $n$      return (select name from tile_def where id = 2) || ': cultivate first.';
    end if;
    return coalesce(corner_rock(p_world, cx, cy), slope_refusal(p_world, p_uid, 'digging', cx, cy, 1));$n$);

-- ---- what each does ---------------------------------------------------------------------------------------------

select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    perform raise_corner(p_world, cx, cy, 1);
    -- What a spadeful covers over becomes what was in it, off the list both
    -- sides read: a clay bank or a beach can be laid now as well as dug.
    if exists (select 1 from buryable b where b.tile = here) then
      perform land_set_tile(p_world, tx, ty, spoil_tile(v_spoil));
    end if;
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'Dropped: ' || lower((select name from item_def where id = v_spoil))
      || ', ' || corner_name(tx, ty, cx, cy) || ' corner raised.', 'event');
$o$,
  $n$    -- The corner and its soil, and no tile laid: that is Change tile.
    perform raise_corner(p_world, cx, cy, 1);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'Dropped: ' || lower((select name from item_def where id = v_spoil))
      || ', ' || corner_name(tx, ty, cx, cy) || ' corner raised.', 'event');

  elsif p_action = 'change_tile' then
    -- The tile laid as the spadeful, its corners and soil as they were.
    v_spoil := change_spoil(p_world, p_uid, tx, ty, target_item(p_target));
    if v_spoil is null or spoil_tile(v_spoil) = here
       or not exists (select 1 from buryable b where b.tile = here)
       or not take_spoil(p_world, p_uid, v_spoil) then return; end if;
    perform land_set_tile(p_world, tx, ty, spoil_tile(v_spoil));
    perform land_set_data(p_world, tx, ty, 0);
    perform land_announce(p_world, tx, ty);
    perform skill_raise(p_world, p_uid, d.skill, 1);
    perform tell(p_world, p_uid, 'Changed to ' || lower((select name from tile_def where id = spoil_tile(v_spoil))) || '.', 'event');
$n$);

select pg_temp.patch_fn('public.perform_terrain(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    perform land_announce_corner(p_world, cx, cy);
    /*
     * And what the spadeful covered, which is the tile you are standing on.
     *
     * The corner this raises is the nearest one, which belongs to as many as
     * four tiles; the ground that took the dirt is the one under your feet.
     * `drop_dirt` at a corner covers the tile it names, and this covers that
     * one — the same spadeful and the same list either way.
     */
    select floor(x)::int, floor(y)::int into tx, ty from player where world_id = p_world and uid = p_uid;
    if exists (select 1 from buryable b where b.tile = land_tile(p_world, tx, ty)) then
      perform land_set_tile(p_world, tx, ty, spoil_tile(v_spoil));
      perform land_announce(p_world, tx, ty);
    end if;
$o$,
  $n$    perform land_announce_corner(p_world, cx, cy);
    -- And no tile laid: that is Change tile (`perform_ground`).
$n$);

select private.lock_doors();
