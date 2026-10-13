/*
 * Fruiting seasons.
 *
 * Asked for: the island's calendar matters for picking. Each fruit tree, each
 * bush a sickle cuts and the seasonal wild forage is had in its own seasons,
 * in one table in the browser (`src/game/fruiting.ts`, `FRUITING`), emitted
 * to the island by the definitions as `fruiting_seasons(item)` -- null for a
 * thing had all year -- with every sentence it says, `fruit_out_said(item,
 * season)` and `fruit_says(item, season)`. Staples keep their rules: a field,
 * and the potatoes, onions and seeds the ground gives up, are not in it.
 *
 *   * `fruit_season(at)`: the season fruiting goes by -- the one a test holds
 *     the island in (`wurm.season`) if any, none before the first spring,
 *     and otherwise `season_at`. The browser's `fruitSeason`.
 *   * `fruits_now(item, at, glass)`: whether a thing is had: always under
 *     glass, always before the first spring, always for a thing not in the
 *     table, and otherwise in its seasons. The browser's `fruitsAt`.
 *   * `fruit_refusal(item, at)`: the refusal out of season, which says when it
 *     next bears, or null. The browser's `fruitRefusal`.
 *
 * And the doors that use them:
 *
 *   * `ground_refusal`: Pick fruit and Harvest on a bush are refused out of
 *     season, after a tree too young or dead and a bush with nothing worth a
 *     sickle, and before one already picked, as the browser asks;
 *   * `roll_table`: every roll on the loot tables -- foraging, botanizing,
 *     at the water's edge, a worker's and a wild creature's -- rolls only on
 *     what is in season, each at the weight it had, so a look finds
 *     something as often in every season;
 *   * `worker_gatherable`: a plucka passes a tree by out of its season;
 *   * `examine_tile_text`: a fruit tree and a bush a sickle cuts say their
 *     seasons and whether they are in season now.
 *
 * The functions the definitions emit are read when these run and not when
 * they are made, so this may go in before the definitions that carry them:
 * everything here is plpgsql.
 */
set local lock_timeout = '3s';

/* The season fruiting goes by at a moment: a held one, none before the first spring, or the year's. The browser's `fruitSeason`. */
create or replace function fruit_season(p_at timestamptz default now()) returns text language plpgsql stable as $fn$
declare v_pin text := season_pinned();
begin
  if v_pin is not null then return v_pin; end if;
  if extract(epoch from p_at)::double precision < year_from() then return null; end if;
  return season_at(p_at);
end $fn$;

/* Whether a thing is had at a moment: under glass always, before the first spring always, out of the table always. The browser's `fruitsAt`. */
create or replace function fruits_now(p_item text, p_at timestamptz default now(), p_glass boolean default false)
returns boolean language plpgsql stable as $fn$
declare v_seasons text[] := fruiting_seasons(p_item); v_season text;
begin
  if p_glass or v_seasons is null then return true; end if;
  v_season := fruit_season(p_at);
  return v_season is null or v_season = any(v_seasons);
end $fn$;

/* Why a thing is not to be had at a moment, in the browser's words (`fruitRefusal`), or null. */
create or replace function fruit_refusal(p_item text, p_at timestamptz default now()) returns text language plpgsql stable as $fn$
begin
  if fruits_now(p_item, p_at) then return null; end if;
  return fruit_out_said(p_item, fruit_season(p_at));
end $fn$;


create or replace function ground_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare tx int; ty int; cx int; cy int; here int; t tile_def; v_data int; v_tree tree_def;
        v_under text; p player; v_spoil text;
begin
  tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
  if tx is null or ty is null or not in_bounds(p_world, tx, ty) then
    return 'There is nothing there.';
  end if;
  here := land_tile(p_world, tx, ty);
  select * into t from tile_def where id = here;
  v_data := land_data(p_world, tx, ty);

  -- A flight of garden steps answers for itself (`steps_refusal`).
  if p_action in ('lay_steps', 'lay_timber_steps', 'take_up_steps') then
    return steps_refusal(p_world, p_uid, p_action, p_target);
  end if;

  if p_action = 'flatten' then
    if t.dig_yield is null then return 'You cannot flatten that.'; end if;
    if pack_count(p_world, p_uid, 'shovel') < 1 then return 'You need a shovel to flatten.'; end if;
    -- Shallows are workable, to the depth a pick works to. `has_water` refuses
    -- a tile with one corner an inch under, which is most of a shoreline.
    if centre_height(p_world, tx, ty) < -pk(p_world, p_uid, 'depth:dig', mine_depth()) then
      return 'The water is too deep here to work in.';
    end if;
    if flatten_target(p_world, p_uid, tx, ty) < -pk(p_world, p_uid, 'depth:dig', mine_depth()) then
      return 'The ground you stand on is too deep to work from.';
    end if;
    v_under := under_building(p_world, tx, ty);
    if v_under is not null then return v_under; end if;
    if not needs_flattening(p_world, p_uid, tx, ty) then return 'That ground is already flat.'; end if;

  elsif p_action = 'drop_dirt' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    v_spoil := spoil_near(p_world, p_uid, target_item(p_target));
    if v_spoil is null then
      return case when target_item(p_target) is not null then 'That is not dirt, clay or sand.'
                  else 'You have no dirt, clay or sand to drop, and nothing beside you is holding any.' end;
    end if;
    v_under := corner_under_building(p_world, cx, cy);
    if v_under is not null then return v_under; end if;
    return coalesce(level_stop(p_world, p_uid, cx, cy, 1),
                    slope_refusal(p_world, p_uid, 'digging', cx, cy, 1));

  elsif p_action = 'raise_rock' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    if pack_count(p_world, p_uid, 'concrete') < 1 then return 'You have no concrete.'; end if;
    -- Concrete goes on bare rock, above the water: the only way to build up
    -- on rock without dirt, which slides off it.
    return rock_raise_refusal(p_world, p_uid, cx, cy, 'Concrete');

  elsif p_action = 'rubble_fill' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    if pk(p_world, p_uid, 'rubble', 0) <= 0 then return 'That wants a Mason who has learned to fill with rubble.'; end if;
    if pack_count(p_world, p_uid, 'rock_shards') < pk(p_world, p_uid, 'rubble', 0) then
      return 'You need ' || number_word(pk(p_world, p_uid, 'rubble', 0)::int) || ' rock shards.';
    end if;
    return rock_raise_refusal(p_world, p_uid, cx, cy, 'Rubble');

  elsif p_action = 'dredge' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    -- Digging from a boat: the bottom comes up a spadeful at a time, to a
    -- depth the shore never reaches. The doors are the digger's, in the
    -- digger's words, with the hull's in front of them.
    if t.dig_yield is null then return 'You cannot dredge that.'; end if;
    if pack_count(p_world, p_uid, 'shovel') < 1 then return 'You need a shovel to dredge with.'; end if;
    if not coalesce(is_boat(driving(p_world, p_uid)), false) then return 'Dredging is done from a boat.'; end if;
    if land_height(p_world, cx, cy) >= 0 then return 'That corner is above the water. Dig it from the shore.'; end if;
    if land_height(p_world, cx, cy) < -pk(p_world, p_uid, 'depth:dredge', dredge_depth()) then return 'The bottom is too deep to reach from a boat.'; end if;
    if land_dirt(p_world, cx, cy) <= 0 then return 'That corner is bare rock down there. A shovel will not bite on it.'; end if;
    v_under := corner_under_building(p_world, cx, cy);
    if v_under is not null then return v_under; end if;
    return slope_refusal(p_world, p_uid, 'digging', cx, cy, -1);

  elsif p_action = 'pave_slabs' then
    v_under := under_building(p_world, tx, ty);
    if v_under is not null then return v_under; end if;
    if here <> 2 then return 'The ground has to be packed flat before anything is laid on it.'; end if;
    if pack_count(p_world, p_uid, 'trowel') < 1 then return 'You need a trowel to bed a slab.'; end if;
    if not exists (select 1 from item i join slab_def s on s.item = i.def
                   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                     and not i.locked) then
      return 'You need a cut slab to pave with.';
    end if;

  elsif p_action = 'remove_paving' then
    if here not in (14, 21) then return 'There is no paving here to break up.'; end if;
    v_under := under_building(p_world, tx, ty);
    if v_under is not null then return v_under; end if;
    if pack_count(p_world, p_uid, 'pickaxe') < 1 then return 'You need a pickaxe to break up paving.'; end if;

  elsif p_action = 'cut_grass' then
    if here not in (0, 5, 6, 20) then return 'There is no grass here to cut.'; end if;
    if is_foraged(p_world, tx, ty, 'grass') then return 'The grass here is still short.'; end if;

  elsif p_action = 'cut_moss' then
    if here <> tile_id('Moss') then return 'There is no moss here to cut.'; end if;
    if is_foraged(p_world, tx, ty, 'moss') then return 'The moss here is still short.'; end if;

  elsif p_action = 'cut_reeds' then
    if here <> 19 then return 'There are no reeds here.'; end if;
    if pack_count(p_world, p_uid, 'carving_knife') < 1 then return 'You need a knife to cut reeds.'; end if;
    if is_foraged(p_world, tx, ty, 'reed') then return 'The reeds here are cut back to the water.'; end if;

  elsif p_action = 'pick_fruit' then
    if here <> 16 then return 'There is no tree here.'; end if;
    select * into v_tree from tree_def where id = tree_species(v_data);
    if v_tree.fruit is null then return 'Nothing grows on this that you would eat.'; end if;
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'Nothing hangs on a dead tree.';
    end if;
    -- A sapling bears nothing; it has to have some years in it first.
    if not coalesce((select bears from tree_age_def where id = tree_age(v_data)), false) then
      return 'The ' || lower(v_tree.name) || ' is too young to bear. Leave it to grow.';
    end if;
    -- Fruiting seasons: nothing hangs on it out of its season (`fruiting.ts`).
    if fruit_refusal(v_tree.fruit) is not null then return fruit_refusal(v_tree.fruit); end if;
    if is_foraged(p_world, tx, ty, 'forage') then
      return 'You have had what this ' || lower(v_tree.name) || ' has on it. Come back later.';
    end if;

  elsif p_action = 'pick_sprout' then
    if here <> 16 then return 'There is no tree here.'; end if;
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'There is no life in it to sprout.';
    end if;

  elsif p_action = 'prune' then
    if here <> 16 then return 'There is no tree here to prune.'; end if;
    select * into v_tree from tree_def where id = tree_species(v_data);
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'There is no pruning a dead tree.';
    end if;
    -- What each stage prunes to is the table's: a stage back for a grown
    -- tree, a shrub for good out of a sapling, and a young tree left to grow.
    -- A stage whose next stage is itself is a shrub already kept.
    if exists (select 1 from tree_age_def where id = tree_age(v_data) and pruned is null and next = id) then
      return 'It is clipped as far as it goes.';
    end if;
    if (select pruned from tree_age_def where id = tree_age(v_data)) is null then
      return 'The ' || lower(v_tree.name) || ' is too young to prune. Let it grow.';
    end if;

  elsif p_action = 'plant' then
    if not exists (select 1 from plantable where tile = here) then
      return 'Nothing will take root in that.';
    end if;
    if pack_count(p_world, p_uid, 'sprout') < 1 then return 'You have no sprout to plant.'; end if;
    -- A grown tile of tree is something you walk round, not through, and the
    -- sprout becomes that tile the moment it goes in.
    select * into p from player where world_id = p_world and uid = p_uid;
    if p.uid is not null and floor(p.x)::int = tx and floor(p.y)::int = ty then
      return 'You would be planting it under your own feet. Step off the tile first.';
    end if;
    -- Piers: nor under a building, where a tile on piers has grass or sand under its deck (`underBuilding`).
    v_under := under_building(p_world, tx, ty);
    if v_under is not null then return v_under; end if;
    -- Frame: and not under a jetty, which it would grow up through (`frame_jetty_over`).
    if frame_jetty_over(p_world, tx, ty) is not null then return frame_jetty_over(p_world, tx, ty); end if;

  elsif p_action = 'graft' then
    if here <> 16 then return 'There is no tree here to graft to.'; end if;
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'There is no life in it to graft to.';
    end if;
    if (select fruit from tree_def where id = tree_species(v_data)) is not null then return 'It bears already.'; end if;
    -- Grafting is the forester's finest work, and a beginner's graft is a
    -- sprout thrown away.
    if skill_of(p_world, p_uid, 'forestry') < graft_skill() then
      return 'You do not know enough of trees to graft one yet. It takes forestry ' || graft_skill() || '.';
    end if;
    -- The sprout named, or any of the three that bear.
    if target_item(p_target) is not null and not exists (
        select 1 from item i join tree_def td on td.name = i.extra and td.fruit is not null
         where i.world_id = p_world and i.id = target_item(p_target) and i.holder = 'player'
           and i.holder_uid = p_uid and i.def = 'sprout') then
      return 'That is not a fruit sprout.';
    end if;
    if not exists (
        select 1 from item i join tree_def td on td.name = i.extra and td.fruit is not null
         where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
           and i.def = 'sprout' and not i.locked) then
      return 'You have no fruit sprout to graft.';
    end if;
    -- Piers: nor under a building (`underBuilding`).
    v_under := under_building(p_world, tx, ty);
    if v_under is not null then return v_under; end if;

  elsif p_action = 'harvest_bush' then
    if here <> 17 then return 'There is no bush here.'; end if;
    if (select yields from bush_def where id = bush_species(v_data)) is null then
      return 'Nothing on a ' || lower((select name from bush_def where id = bush_species(v_data))) || ' is worth a sickle.';
    end if;
    -- Fruiting seasons: nothing to cut out of its season (`fruiting.ts`).
    if fruit_refusal((select yields from bush_def where id = bush_species(v_data))) is not null then
      return fruit_refusal((select yields from bush_def where id = bush_species(v_data)));
    end if;
    if is_foraged(p_world, tx, ty, 'forage') then
      return 'You have had what this ' || lower((select name from bush_def where id = bush_species(v_data))) || ' has on it. Come back later.';
    end if;

  elsif p_action = 'dig_stump' then
    if here <> tile_id('Stump') then return 'There is no stump here.'; end if;

  elsif p_action = 'coppice' then
    if pk(p_world, p_uid, 'coppice', 0) <= 0 then return 'That wants a Forester who has learned to coppice.'; end if;
    if here <> 16 then return 'There is no tree here to coppice.'; end if;
    select * into v_tree from tree_def where id = tree_species(v_data);
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'There is no coppicing a dead tree.';
    end if;
    -- Grown enough to bear: mature and older.
    if not coalesce((select bears from tree_age_def where id = tree_age(v_data)), false) then
      return 'The ' || lower(v_tree.name) || ' is too young to coppice. Let it grow.';
    end if;

  elsif p_action = 'tap_resin' then
    if pk(p_world, p_uid, 'tap_resin', 0) <= 0 then return 'That wants a Forester who has learned to tap resin.'; end if;
    if here <> 16 then return 'There is no tree here to tap.'; end if;
    select * into v_tree from tree_def where id = resin_tree();
    if tree_species(v_data) <> resin_tree() then return 'Only a ' || lower(v_tree.name) || ' gives resin.'; end if;
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'A dead ' || lower(v_tree.name) || ' gives no resin.';
    end if;
    -- Not a sapling, and not one clipped to a shrub: a tree with timber in it.
    if coalesce((select logs from tree_age_def where id = tree_age(v_data)), 0) <= 0 then
      return 'The ' || lower(v_tree.name) || ' is too small to tap. Let it grow.';
    end if;
    -- Once a day for each pine, the day turning at the woods' dawn.
    if exists (select 1 from foraged f where f.world_id = p_world and f.x = tx and f.y = ty
                 and f.kind = 'resin' and f.at >= tree_last_dawn()) then
      return 'This ' || lower(v_tree.name) || ' has given its resin today. It runs again at dawn.';
    end if;

  elsif p_action = 'clear_brush' then
    if pk(p_world, p_uid, 'clear_brush', 0) <= 0 then return 'That wants a Forester who has learned to clear brush.'; end if;
    if here not in (tile_id('Bush'), tile_id('Reed')) then return 'There is no brush here to clear.'; end if;

  elsif p_action = 'dig_worms' then
    if not t.wormy then return 'Nothing lives in that.'; end if;
    if pack_count(p_world, p_uid, 'shovel') < 1 then return 'You need a shovel.'; end if;
    if has_water(p_world, tx, ty) then return 'Not under water.'; end if;

  elsif p_action = 'prospect' then
    if pack_count(p_world, p_uid, 'pickaxe') < 1 then return 'You need a pickaxe to prospect.'; end if;
  end if;
  return null;
end $function$;

create or replace function roll_table(p_table text, p_roll double precision)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select item from (
    select item, sum(weight) over (order by weight desc, item) as upto,
           sum(weight) over () as total
    -- Fruiting seasons: only what is in season, each at the weight it had (`fruiting.ts`).
    from loot_table where id = p_table and fruits_now(item)
  ) q where upto >= p_roll * total order by upto limit 1
$function$;

create or replace function worker_gatherable(p_world uuid, p_x integer, p_y integer, p_kind text, c creature)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
declare here int; t tile_def; rock rock_def; v_crop crop;
begin
  if not in_bounds(p_world, p_x, p_y) or claimed(p_world, p_x, p_y, c.id) then return false; end if;
  here := land_tile(p_world, p_x, p_y);
  select * into t from tile_def where id = here;

  if p_kind = 'woodcut' then
    return here = tile_id('Tree') and exists (select 1 from beside_tile(p_world, p_x, p_y));
  elsif p_kind = 'prune' then
    -- What would otherwise die: a stage that prunes back and whose next stage
    -- has no life in it. Nothing else is touched — a mature tree pruned stops
    -- bearing, and a sapling pruned is a shrub for good.
    return here = tile_id('Tree') and exists (select 1 from beside_tile(p_world, p_x, p_y))
       and exists (select 1 from tree_age_def a join tree_age_def n on n.id = a.next
                    where a.id = tree_age(land_data(p_world, p_x, p_y))
                      and a.pruned is not null and not n.alive);
  elsif p_kind = 'fruit' then
    -- A bearing tree with something on it, and a tile beside it to stand on.
    return here = tile_id('Tree') and exists (select 1 from beside_tile(p_world, p_x, p_y))
       and not is_foraged(p_world, p_x, p_y, 'forage')
       and exists (select 1 from tree_def td, tree_age_def a
                    where td.id = tree_species(land_data(p_world, p_x, p_y))
                      and a.id = tree_age(land_data(p_world, p_x, p_y))
                      and td.fruit is not null and a.bears and a.alive
                      -- Fruiting seasons: out of its season there is nothing to climb for (`fruiting.ts`).
                      and fruits_now(td.fruit));
  elsif p_kind = 'stump' then
    return here = tile_id('Stump') and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'mine' then
    rock := bedrock_at(p_world, p_x, p_y);
    return here = tile_id('Rock') and rock.seam and rock.level <= task_skill(c)
       and rock_height(p_world, p_x, p_y) > -mine_depth() and face_reach(p_world, p_x, p_y);
  elsif p_kind = 'quarry' then
    rock := bedrock_at(p_world, p_x, p_y);
    return here = tile_id('Rock') and not rock.seam and rock_height(p_world, p_x, p_y) > -mine_depth()
       and face_reach(p_world, p_x, p_y);
  elsif p_kind in ('sand', 'clay') then
    return here = tile_id(case p_kind when 'sand' then 'Sand' else 'Clay' end)
       and land_dirt(p_world, p_x, p_y) > 0 and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'peat' then
    return here in (tile_id('Peat'), tile_id('Tar')) and not is_foraged(p_world, p_x, p_y, 'dig')
       and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'reed' then
    return here = tile_id('Reed') and not is_foraged(p_world, p_x, p_y, 'reed');
  elsif p_kind = 'fish' then
    return fishable(p_world, p_x, p_y);
  elsif p_kind = 'seek' then
    -- Ground nobody has been over yet, which is the only ground worth a nose.
    return t.diggable and not has_water(p_world, p_x, p_y)
       and creature_tile_ok(p_world, p_x, p_y)
       and not is_foraged(p_world, p_x, p_y, 'dig');
  elsif p_kind = 'fetch' then
    return on_my_deed(p_world, c.keeper, p_x, p_y) and creature_tile_ok(p_world, p_x, p_y)
       and exists (select 1 from item i where i.world_id = p_world and i.holder = 'ground'
                     and i.gx = p_x and i.gy = p_y);
  elsif p_kind = 'compost' then
    -- A carcass, or anything knocked about past saving.
    return on_my_deed(p_world, c.keeper, p_x, p_y) and creature_tile_ok(p_world, p_x, p_y)
       and exists (select 1 from item i where i.world_id = p_world and i.holder = 'ground'
                     and i.gx = p_x and i.gy = p_y and (i.def = 'corpse' or i.dmg >= 40));
  elsif p_kind = 'farm' then
    -- Growth is brought up to date for the whole search before it starts, in
    -- `worker_settle`: once, rather than once for each tile looked at. And
    -- the crop is read once here rather than three times over below, since
    -- this is asked of every tile of the ground, and most have no crop at all.
    select * into v_crop from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
    if found and (v_crop.stage >= crop_ripe() or not v_crop.tended_now) then return true; end if;
    /*
     * And a field with nothing in it, which was never work at all: the island
     * knew how to weed a crop and how to reap one and not how to sow one, so a
     * seavic walked over bare fields with seed sitting in the crate behind it.
     * Reported exactly so.
     */
    /*
     * And seed lying on a field that is already sown, which this tile has no
     * use for. Reported as "seavics also move seeds to storage if not using
     * them when working deed": a harvest leaves its seed in the furrow, the
     * next sowing takes one of them, and the rest sat there under the growing
     * crop where nobody could see, count or cook them. Picking them up is
     * work, so it is work here.
     */
    if v_crop.x is not null then
      return exists (select 1 from item i join crop_def sd on sd.seed = i.def
                      where i.world_id = p_world and i.holder = 'ground'
                        and i.gx = p_x and i.gy = p_y);
    end if;
    -- `here` is this tile's kind, read at the top.
    return here = tile_id('Field') and (sow_seed(p_world, c, p_x, p_y)).id is not null;
  elsif p_kind = 'forage' then
    return coalesce(t.forage, false) and not is_foraged(p_world, p_x, p_y, 'forage')
       and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'botanize' then
    return coalesce(t.botanize, false) and not is_foraged(p_world, p_x, p_y, 'botanize')
       and creature_tile_ok(p_world, p_x, p_y);
  end if;
  return false;
end $function$;

create or replace function examine_tile_text(p_world uuid, p_x integer, p_y integer, p_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_t int; v_data int; v_out text; v_extra text := ''; b building; v_id int; n int; v_age tree_age_def;
begin
  -- cellar: from down in a cellar, a tile of it is its floor, and not the ground up top (`cellarFloorSaid`).
  v_out := cellar_floor_said(p_world, p_x, p_y); -- cellar
  if v_out is not null then return v_out; end if; -- cellar
  v_t := land_tile(p_world, p_x, p_y);
  v_data := land_data(p_world, p_x, p_y);
  if v_t = 16 then
    select * into v_age from tree_age_def where id = tree_age(v_data);
    v_out := 'You see ' || an(lower(coalesce(v_age.name, 'young'))
      || ' ' || lower((select name from tree_def where id = tree_species(v_data))) || ' tree')
      || ' at (' || p_x || ', ' || p_y || ').';
    -- What is in it, what is coming for it, and what to do about that — the
    -- same words the browser uses, so a tree reads the same on both.
    if tree_cuts(p_world, p_x, p_y) > 0 then
      -- Of as many as the one looking would fell it in (a Forester's Heavy Swing).
      v_out := v_out || ' It has ' || tree_cuts(p_world, p_x, p_y) || ' of ' || tree_hits(p_world, p_uid, v_age.hits)
        || ' strokes in it.';
    end if;
    v_out := v_out || tree_outlook(p_world, v_age);
    -- Fruiting seasons: when a fruit tree bears, and whether it is bearing now (`fruiting.ts`).
    if (select fruit from tree_def where id = tree_species(v_data)) is not null then
      v_out := v_out || fruit_says((select fruit from tree_def where id = tree_species(v_data)), fruit_season());
    end if;
  elsif v_t = 17 then
    v_out := 'You see a ' || lower((select name from bush_def where id = bush_species(v_data)))
      || ' at (' || p_x || ', ' || p_y || ').';
    -- And a bush a sickle cuts, its seasons (`fruiting.ts`).
    if (select yields from bush_def where id = bush_species(v_data)) is not null then
      v_out := v_out || fruit_says((select yields from bush_def where id = bush_species(v_data)), fruit_season());
    end if;
  elsif v_t = tile_id('Stump') then
    v_out := 'You see the stump of ' || an(lower((select name from tree_def where id = tree_species(v_data))))
      || ' at (' || p_x || ', ' || p_y || '). Dig it out, or leave it a day.';
  else
    v_out := 'You see ' || lower((select name from tile_def where id = v_t))
      || ' at (' || p_x || ', ' || p_y || ').';
    if v_t = tile_id('Grass') and (v_data & 7) <> 0 then
      v_out := v_out || ' Kept cut: ' || ((v_data & 3) + case when (v_data & 4) <> 0 then 1 else 0 end) || ' of 3 days towards lawn.';
    end if;
  end if;
  -- What feet have done to it, and what is in flower on it: the browser's words (`groundSays`).
  v_out := v_out || ground_says(p_world, p_x, p_y);
  v_out := v_out || ' Height ' || to_char(centre_height(p_world, p_x, p_y), 'FM990.0')
    || ', slope ' || tile_slope(p_world, p_x, p_y) || '.';
  -- And for a Fisher with a Fishing Journal, what the water holds for them.
  if has_water(p_world, p_x, p_y) then
    v_out := v_out || ' Water laps over it.' || fish_journal(p_world, p_uid, p_x, p_y);
  end if;

  if is_token(p_world, p_x, p_y) then
    v_extra := v_extra || ' The settlement token of '
      || (deed_at(p_world, p_x, p_y)).name || ' stands here.';
  elsif on_deed(p_world, p_x, p_y) then
    v_extra := v_extra || ' This is part of ' || (deed_at(p_world, p_x, p_y)).name || '.';
  end if;
  v_id := building_at(p_world, p_x, p_y);
  if v_id is not null then
    select * into b from building where world_id = p_world and id = v_id;
    if found then
      v_extra := v_extra || ' It belongs to ' || b.name || ', '
        || case when b.levels = 1 then 'a single-storey building'
                else b.levels || ' storeys tall' end || '.';
      -- And a glasshouse says what it is for (`glass_examine`).
      v_extra := v_extra || glass_examine(p_world, b.id);
      -- Piers: and its deck, if the tile stands on piers (`pier_says`).
      v_extra := v_extra || pier_says(p_world, p_x, p_y);
    end if;
    v_extra := v_extra || cellar_said(p_world, p_x, p_y); -- cellar: what is dug out under it, after the glass and the deck
  end if;
  -- Frame: a jetty over it, columns on its corners, a roof on columns (`frame_says`).
  v_extra := v_extra || frame_says(p_world, p_x, p_y);
  select count(*) into n from crate c where c.world_id = p_world
    and p_x between c.x and c.x + c.sx - 1 and p_y between c.y and c.y + c.sy - 1;
  if n = 1 then v_extra := v_extra || ' A crate stands here.';
  elsif n > 1 then v_extra := v_extra || ' ' || n || ' crates stand here.'; end if;
  return v_out || v_extra;
end $function$;

select private.lock_doors();

notify pgrst, 'reload schema';
