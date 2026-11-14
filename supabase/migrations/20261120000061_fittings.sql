/*
 * The fittings (`src/game/fitting.ts`, `src/game/fittingdefs.ts`): a paper
 * lantern pole, a moss boulder, a tree bench, a spice shelf, a window seat, a
 * training dummy, an archery target, a mooring post and a stone bust.
 *
 * The definitions carried every piece, its recipe and its item, the jobs
 * (`fitting_action`), a seat's bodies (`furniture_def.seats`), a boulder's
 * moss (`furniture_def.mossy`), every number (`pole_lanterns`, `pole_reach`,
 * `boulder_moss_days`, `shelf_holds`, `practice_gain`, `target_holds`,
 * `arrow_break_in`, `moor_reach`), the kinds, the herbs a shelf takes
 * (`shelf_herbs`), the fight a practice job is timed as (`practice_as`) and
 * every sentence (`fitting_said`, `fitting_done`). What is here is the doing.
 *
 *   * `placed.garden` keeps a fitting's state, sent to every browser with the
 *     ground read and carried into the pack with the piece: `tints` (a pole's
 *     second and third lanterns), `keep` (a boulder kept mossy), `jars` (a
 *     shelf's herbs, as drawn), `stuck` (arrows in a target), `tied` (the boat
 *     a mooring post holds) and `bust` (the citizen a bust is carved as).
 *   * A pole's candles are its `fuel`, burning while it is `lit`, as a lantern
 *     post's (`placed_fuel`, `placed_lit`); its lanterns are dyed a colour a
 *     dyeing, as a woven rug's (`last_refusal`, `perform_last`).
 *   * A boulder greens over `boulder_moss_days` by the moss rule
 *     (`piece_green_days`: `green_refusal`, `green_on_tile`, `perform_green`);
 *     one kept mossy a scrubbing worker passes by (`moss_kept`: `green_on_tile`,
 *     `scrub_tile`).
 *   * A tree bench goes on the tile of a grown tree (`tree_bench_refusal`,
 *     `piece_fixed_refusal`), which is not cut down while it stands
 *     (`gather_refusal`); a mooring post at the water's edge.
 *   * A window seat in a window, from inside (`mount_refusal`, mount `sill`).
 *   * Herbs on a shelf and arrows in a target are items of their own
 *     (`item.holder = 'stand'`), and neither piece is picked up holding them
 *     (`fire_refusal`).
 *   * A practice swing and shot are timed, costed and slowed as a fight's
 *     (`practice_as`: `act_base`, `act_wind`, `go_secs`, `swing_burden`).
 *   * A boat tied to a post has its helm taken and is lifted only by whoever
 *     set it down or holds its key (`moored_refusal`: `ride_refusal`, `fire_refusal`).
 *   * The jobs (`fitting_refusal`, `perform_fitting`), dispatched at the end
 *     of the line (`last_action`, `last_refusal`, `perform_last`).
 *
 * `supabase/test/fittings.ts` holds the two sides to each other.
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

/* ---- a paper lantern pole ---------------------------------------------------------------------- */

/** Seconds the candles put in a pole burn: a candle's in a lantern of its QL, all three at once (`poleBurn`). */
create or replace function pole_burn(p_ql double precision) returns double precision language sql stable as $fn$
  select round(candle_burn(p_ql))::double precision
$fn$;

-- Its lanterns dyed a colour a dyeing, up to `pole_lanterns`, and not its last again, as a woven rug (`dyes.ts`).
select pg_temp.patch_fn('last_refusal(uuid, uuid, text, jsonb)',
  $o$      if it.def = woven_rug_kind() then
        if (case when it.dye is null then 0 else 1 end) + coalesce(jsonb_array_length(it.garden->'tints'), 0) >= rug_colours() then$o$,
  $n$      -- And a paper lantern pole, a lantern a dyeing, up to `pole_lanterns` (`fitting.ts`).
      if it.def = lantern_pole_kind() then
        if (case when it.dye is null then 0 else 1 end) + coalesce(jsonb_array_length(it.garden->'tints'), 0) >= pole_lanterns() then
          return fitting_said('poleColours', null, null);
        end if;
        return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, coalesce(it.garden->'tints'->>-1, it.dye));
      end if;
      if it.def = woven_rug_kind() then
        if (case when it.dye is null then 0 else 1 end) + coalesce(jsonb_array_length(it.garden->'tints'), 0) >= rug_colours() then$n$);
select pg_temp.patch_fn('perform_last(uuid, uuid, text, jsonb)',
  $o$    if it.def = woven_rug_kind() and it.dye is not null then$o$,
  $n$    if it.def in (woven_rug_kind(), lantern_pole_kind()) and it.dye is not null then$n$);

/* ---- a moss boulder ---------------------------------------------------------------------------- */

/**
 * The moss rule's days for a piece greening since `p_since` (`pieceGreenDays`):
 * a boulder's over `boulder_moss_days`, every other piece's over the rule's own.
 */
create or replace function piece_green_days(p_sub text, p_since timestamptz, p_now timestamptz default now()) returns int language sql stable as $fn$
  select case when p_sub = moss_boulder_kind()
              then greatest(0, least(green_span(), floor(extract(epoch from (p_now - p_since)) * green_span() / (boulder_moss_days() * green_day()))))::int
              else green_days(p_since, p_now) end
$fn$;

/** Whether a scrubbing worker passes a piece by: a moss boulder its owner keeps mossy (`mossKept`). */
create or replace function moss_kept(pc placed) returns boolean language sql immutable as $fn$
  select pc.sub = moss_boulder_kind() and coalesce((pc.garden->>'keep')::boolean, false)
$fn$;

select pg_temp.patch_fn('green_refusal(uuid, uuid, text, jsonb)',
  $o$    v_days := green_days(green_start(greatest(pc.made_at,$o$,
  $n$    v_days := piece_green_days(pc.sub, green_start(greatest(pc.made_at,$n$);
select pg_temp.patch_fn('green_refusal(uuid, uuid, text, jsonb)',
  $o$  if v_days <= 0 then return green_nothing_yet(); end if;$o$,
  $n$  if v_days <= 0 then return case when pc.sub = moss_boulder_kind() then boulder_nothing_yet() else green_nothing_yet() end; end if;$n$);
select pg_temp.patch_fn('green_on_tile(uuid, uuid, integer, integer)',
  $o$(select max(green_days(green_start(greatest(pc.made_at,$o$,
  $n$(select max(piece_green_days(pc.sub, green_start(greatest(pc.made_at,$n$);
select pg_temp.patch_fn('green_on_tile(uuid, uuid, integer, integer)',
  $o$join furniture_def f on f.id = pc.sub and f.mossy$o$,
  $n$join furniture_def f on f.id = pc.sub and f.mossy and not moss_kept(pc)$n$);
select pg_temp.patch_fn('scrub_tile(uuid, uuid, integer, integer)',
  $o$join furniture_def f on f.id = pc.sub and f.mossy$o$,
  $n$join furniture_def f on f.id = pc.sub and f.mossy and not moss_kept(pc)$n$);
select pg_temp.patch_fn('perform_green(uuid, uuid, text, jsonb)',
  $o$where f.id = pc.sub)) || '. ' || green_again(), 'event');$o$,
  $n$where f.id = pc.sub)) || '. ' || case when pc.sub = moss_boulder_kind() then boulder_again() else green_again() end, 'event');$n$);

/* ---- a tree bench and a mooring post: where they stand ------------------------------------------- */

/** Why a tree bench will not go on tile (x, y), or null: a grown, living tree there (`BENCH_TREE_AGES`). */
create or replace function tree_bench_refusal(p_world uuid, p_x int, p_y int) returns text language sql stable as $fn$
  select case when land_tile(p_world, p_x, p_y) = tile_id('Tree')
               and coalesce((select a.bears and a.alive from tree_age_def a where a.id = tree_age(land_data(p_world, p_x, p_y))), false)
              then null else fitting_said('noTree', null, null) end
$fn$;

select pg_temp.patch_fn('piece_fixed_refusal(uuid, uuid, text, integer, integer, text, integer)',
  $o$when f.hedge then hedge_refusal(p_world, p_x, p_y, p_level) end$o$,
  $n$when f.hedge then hedge_refusal(p_world, p_x, p_y, p_level)
              -- A tree bench round a grown tree; a mooring post at the water's edge (`fitting.ts`).
              when f.id = tree_bench_kind() then tree_bench_refusal(p_world, p_x, p_y)
              when f.id = mooring_post_kind() then case when water_edge(p_world, p_x, p_y) then null else fitting_said('notShore', null, null) end end$n$);

select pg_temp.patch_fn('gather_refusal(uuid, uuid, text, jsonb)',
  $o$    if here not in (tile_id('Tree'), tile_id('Bush')) then return 'No tree or bush here.'; end if;$o$,
  $n$    if here not in (tile_id('Tree'), tile_id('Bush')) then return 'No tree or bush here.'; end if;
    -- Not with a tree bench round it (`fitting.ts`).
    if exists (select 1 from placed b where b.world_id = p_world and b.kind = 'furniture' and b.sub = tree_bench_kind() and b.x = tx and b.y = ty) then
      return fitting_said('benchRound', null, null);
    end if;$n$);

/* ---- a window seat ----------------------------------------------------------------------------- */

select pg_temp.patch_fn('mount_refusal(uuid, uuid, text, integer, integer, text, integer)',
  $o$  if p_mount in ('wall', 'pane') then$o$,
  $n$  -- A window seat as curtains, from inside a building (`fitting.ts`).
  if p_mount = 'sill' then
    if building_at(p_world, p_x, p_y) is null then return mount_said('outside'); end if;
    p_mount := 'pane';
  end if;
  if p_mount in ('wall', 'pane') then$n$);

/* ---- practice: a swing and a shot timed, costed and slowed as a fight's --------------------------- */

select pg_temp.patch_fn('act_base(uuid, uuid, text, double precision)',
  $o$begin
  if not is_fight(p_action) then return p_base; end if;$o$,
  $n$begin
  -- A swing at a training dummy is a swing, a shot at an archery target a draw (`fitting.ts`).
  p_action := practice_as(p_action);
  if not is_fight(p_action) then return p_base; end if;$n$);
select pg_temp.patch_fn('act_wind(uuid, uuid, text, double precision)',
  $o$begin
  if not is_fight(p_action) then return p_cost; end if;$o$,
  $n$begin
  -- And costs what the fight's would (`fitting.ts`).
  p_action := practice_as(p_action);
  if not is_fight(p_action) then return p_cost; end if;$n$);
select pg_temp.patch_fn('swing_burden(uuid, uuid, text)',
  $o$  if not is_fight(p_action) then return 1; end if;$o$,
  $n$  if not is_fight(practice_as(p_action)) then return 1; end if;$n$);
select pg_temp.patch_fn('go_secs(text, double precision, double precision, double precision, double precision, double precision)',
  $o$select case when is_fight(p_action)$o$,
  $n$select case when is_fight(practice_as(p_action))$n$);

/* ---- a spice shelf and an archery target: what they hold ----------------------------------------- */

/** The herbs on a shelf, as every browser draws them: `[def, n]` a kind, in the order they went up. */
create or replace function shelf_jars(p_placed bigint) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_array(j.def, j.n) order by j.first), '[]'::jsonb)
    from (select i.def, sum(i.count)::int as n, min(i.id) as first from item i
           where i.holder = 'stand' and i.placed = p_placed group by i.def) j
$fn$;

/** Arrows in a target. */
create or replace function target_stuck(p_placed bigint) returns int language sql stable as $fn$
  select coalesce(sum(i.count), 0)::int from item i where i.holder = 'stand' and i.placed = p_placed
$fn$;

/* ---- a mooring post ---------------------------------------------------------------------------- */

/** Whether a boat is yours to move under a tie: whoever set it down, or a key to its padlock (`mayMoor`). */
create or replace function may_moor(p_world uuid, p_uid uuid, b placed) returns boolean language sql stable as $fn$
  select coalesce(b.made_by = p_uid, false) or (b.lock is not null and lock_refusal(p_world, p_uid, b.lock, b.x, b.y) is null)
$fn$;

/** The post a boat is tied to: one holding it, and it still within `moor_reach` (`postOf`). */
create or replace function moored_post(p_world uuid, b placed) returns placed language sql stable as $fn$
  select pl.* from placed pl
   where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = mooring_post_kind()
     and nullif(pl.garden->>'tied', '')::bigint = b.id and greatest(abs(b.x - pl.x), abs(b.y - pl.y)) <= moor_reach()
   order by pl.id limit 1
$fn$;

/** The boat a Tie up ties: the nearest within reach of the post, tied to no other (`boatToMoor`). */
create or replace function boat_to_moor(p_world uuid, post placed) returns placed language sql stable as $fn$
  select b.* from placed b
   where b.world_id = p_world and b.kind = 'furniture' and exists (select 1 from boat_def bd where bd.id = b.sub)
     and greatest(abs(b.x - post.x), abs(b.y - post.y)) <= moor_reach() and (moored_post(p_world, b)).id is null
   order by (b.x - post.x) ^ 2 + (b.y - post.y) ^ 2, b.id limit 1
$fn$;

/** Why a tied boat is not yours to take the helm of or lift, or null (`mooredRefusal`). */
create or replace function moored_refusal(p_world uuid, p_uid uuid, b placed) returns text language sql stable as $fn$
  select case when exists (select 1 from boat_def bd where bd.id = b.sub) and (moored_post(p_world, b)).id is not null
               and not may_moor(p_world, p_uid, b) then fitting_said('moored', null, null) end
$fn$;

select pg_temp.patch_fn('ride_refusal(uuid, uuid, text, jsonb)',
  $o$    if v_shut is not null then return v_shut; end if;
    -- A rowing boat does not put out in a gale (`sailing.ts`).$o$,
  $n$    if v_shut is not null then return v_shut; end if;
    -- And a tie to a mooring post keeps it to whoever set her down, or her key (`fitting.ts`).
    v_shut := moored_refusal(p_world, p_uid, p);
    if v_shut is not null then return v_shut; end if;
    -- A rowing boat does not put out in a gale (`sailing.ts`).$n$);

select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$      if v_shut is not null then return v_shut; end if;
      -- What is inside it, and what is in front of it.$o$,
  $n$      if v_shut is not null then return v_shut; end if;
      -- A boat tied to a mooring post, by whoever may move it (`fitting.ts`).
      v_shut := moored_refusal(p_world, p_uid, p);
      if v_shut is not null then return v_shut; end if;
      -- What is inside it, and what is in front of it.$n$);
select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$      if coalesce(jsonb_array_length(p.garden->'on'), 0) > 0 then return garden_said('showing', ''); end if;$o$,
  $n$      if coalesce(jsonb_array_length(p.garden->'on'), 0) > 0 then return garden_said('showing', ''); end if;
      -- And herbs on a spice shelf, arrows in a target (`fitting.ts`).
      if coalesce(jsonb_array_length(p.garden->'jars'), 0) > 0 or coalesce((p.garden->>'stuck')::int, 0) > 0 then
        return garden_said('showing', '');
      end if;$n$);

/* ---- a stone bust ------------------------------------------------------------------------------ */

/** The settlement a bust on tile (x, y) stands on whose citizen `p_who` is, founder or on its roll; null for none. */
create or replace function bust_deed(p_world uuid, p_x int, p_y int, p_who uuid) returns text language sql stable as $fn$
  select d.name from deed_covering(p_world, p_x, p_y) d
   where d.founded_by = p_who
      or exists (select 1 from deed_member m where m.world_id = p_world and m.uid = p_who and m.founder = d.founded_by)
   limit 1
$fn$;

/* ---- the jobs ---------------------------------------------------------------------------------- */

/**
 * Why a job at a fitting cannot be done now, or null: the browser's
 * `fittingRefusal`, question for question -- there, in reach (a target from
 * anywhere in the bow's range), whose, and then the piece.
 */
create or replace function fitting_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; g jsonb; v_name text; v_why text; it item; held item; bow weapon_def; b placed; v_who uuid; me player;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
     and sub = case when p_action in ('pole_candles', 'pole_light', 'pole_douse') then lantern_pole_kind()
                    when p_action = 'keep_moss' then moss_boulder_kind()
                    when p_action = 'shelf_put' or p_action like 'shelf\_take\_%' then spice_shelf_kind()
                    when p_action = 'practise_dummy' then training_dummy_kind()
                    when p_action in ('shoot_target', 'pull_arrows') then archery_target_kind()
                    when p_action in ('moor_boat', 'unmoor_boat') then mooring_post_kind()
                    when p_action = 'carve_bust' then stone_bust_kind() end;
  if not found then return 'It is gone.'; end if;
  v_name := lower((select f.name from furniture_def f where f.id = pl.sub));
  g := coalesce(pl.garden, '{}'::jsonb);
  -- A target is shot at from anywhere in the bow's range.
  if p_action = 'shoot_target' then
    held := worn(p_world, p_uid, 'weapon');
    select bw.* into bow from weapon_def bw where bw.id = held.def and bw.ammo is not null;
    if bow.id is null then return fitting_said('noBow', null, null); end if;
    select * into me from player where world_id = p_world and uid = p_uid;
    if sqrt((pl.cx - me.x) ^ 2 + (pl.cy - me.y) ^ 2) > bow_range(p_world, p_uid, bow, held) then return fitting_said('outOfRange', null, null); end if;
    if not exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and arrow_head_of(i.def) is not null) then
      return fitting_said('noArrows', null, null);
    end if;
    return case when target_stuck(pl.id) >= target_holds() then fitting_said('targetFull', null, null) end;
  end if;
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(v_name); end if;
  if p_action = 'pole_candles' then
    if placed_fuel(pl) > 0 then return fitting_said('candlesIn', null, null); end if;
    return case when pack_count(p_world, p_uid, 'candle') >= pole_lanterns() then null else fitting_said('noCandles', null, null) end;
  elsif p_action = 'pole_light' then
    if placed_fuel(pl) <= 0 then return fitting_said('noCandle', null, null); end if;
    if placed_lit(pl) then return fitting_said('lit', null, null); end if;
    return case when flame_near(p_world, p_uid) is null then no_flame_said() end;
  elsif p_action = 'pole_douse' then
    return case when placed_lit(pl) then null else fitting_said('notLit', null, null) end;
  elsif p_action = 'keep_moss' then
    return case when coalesce(pl.made_by = p_uid, false) then null else fitting_said('keepNotYours', null, null) end;
  elsif p_action = 'practise_dummy' then
    return case when exists (select 1 from weapon_def w where w.id = (worn(p_world, p_uid, 'weapon')).def and w.ammo is null) then null
                else fitting_said('noWeapon', null, null) end;
  elsif p_action = 'pull_arrows' then
    return case when target_stuck(pl.id) > 0 then null else fitting_said('noStuck', null, null) end;
  elsif p_action = 'moor_boat' then
    if nullif(g->>'tied', '') is not null then
      select * into b from placed where world_id = p_world and id = (g->>'tied')::bigint;
      if b.id is not null and (moored_post(p_world, b)).id = pl.id then return fitting_said('hasBoat', null, null); end if;
    end if;
    b := boat_to_moor(p_world, pl);
    if b.id is null then return fitting_said('noBoat', null, null); end if;
    return case when may_moor(p_world, p_uid, b) then null
                else fitting_said('boatNotYours', null, lower((select f.name from furniture_def f where f.id = b.sub))) end;
  elsif p_action = 'unmoor_boat' then
    if nullif(g->>'tied', '') is null then return fitting_said('noTied', null, null); end if;
    select * into b from placed where world_id = p_world and id = (g->>'tied')::bigint;
    return case when coalesce(pl.made_by = p_uid, false) or b.id is null or may_moor(p_world, p_uid, b) then null
                else fitting_said('boatNotYours', null, lower((select f.name from furniture_def f where f.id = b.sub))) end;
  elsif p_action = 'carve_bust' then
    if not may_engrave(p_world, p_uid, pl) then return fitting_said('bustNotYours', null, null); end if;
    if not exists (select 1 from deed_covering(p_world, pl.x, pl.y)) then return fitting_said('noDeed', null, null); end if;
    v_who := case when coalesce(p_target->>'who', '') ~ '^[0-9a-f-]{36}$' then (p_target->>'who')::uuid end;
    if v_who is null then return fitting_said('pickCitizen', null, null); end if;
    if g->'bust'->>'uid' = v_who::text then return fitting_said('sameCitizen', null, g->'bust'->>'name'); end if;
    if bust_deed(p_world, pl.x, pl.y, v_who) is null then
      return fitting_said('notCitizen', null, (select d.name from deed_covering(p_world, pl.x, pl.y) d limit 1));
    end if;
    return null;
  end if;
  -- A spice shelf: its owner's, or a rank's that may use the crates (a side table's rule).
  if pl.sub = spice_shelf_kind() then
    v_why := case when coalesce(pl.made_by = p_uid, false) or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) then null
                  else coalesce(rank_lacks_at(p_world, p_uid, pl.x, pl.y, 'stores'), fitting_said('notYours', v_name, null)) end;
    if v_why is not null then return v_why; end if;
    if p_action = 'shelf_put' then
      if coalesce((select sum(i.count) from item i where i.holder = 'stand' and i.placed = pl.id), 0) >= shelf_holds() then
        return fitting_said('shelfFull', null, null);
      end if;
      if nullif(p_target->>'itemUid', '') is not null then
        select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.id = (p_target->>'itemUid')::bigint;
      else
        select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
           and i.def = any (shelf_herbs()) and not i.locked order by i.id limit 1;
      end if;
      if it.id is null then return fitting_said('noHerb', null, null); end if;
      return case when it.def = any (shelf_herbs()) and not it.locked then null else fitting_said('notHerb', null, null) end;
    end if;
    return case when exists (select 1 from item i where i.holder = 'stand' and i.placed = pl.id and i.def = substr(p_action, 12)) then null
                else fitting_said('noJar', null, null) end;
  end if;
  return null;
end $fn$;

/**
 * The jobs done: a pole's candles put in, lit and put out; a boulder's moss
 * kept or let go; herbs put on a shelf and taken off; a swing at a dummy and
 * a shot at a target, each teaching `practice_gain` of a fight's; arrows
 * pulled, one in `arrow_break_in` broken; a boat tied and untied; a bust
 * carved as a citizen, with their look.
 */
create or replace function perform_fitting(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; g jsonb; it item; b placed; v_n int; v_held int; v_left double precision; v_from text; w weapon_def; held item;
        v_kept int := 0; v_broke int := 0; r record; who player;
begin
  if fitting_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action = 'pole_candles' then
    if not consume(p_world, p_uid, 'candle', pole_lanterns()) then return; end if;
    v_left := pole_burn(pl.ql);
    update placed set fuel = v_left, lit = false, since = now() where id = pl.id;
    perform tell(p_world, p_uid, fitting_done('candles', time_words(v_left), null, null, null), 'event');
  elsif p_action = 'pole_light' then
    v_from := coalesce(flame_near(p_world, p_uid), 'fire');
    update placed set fuel = placed_fuel(pl), lit = true, since = now() where id = pl.id;
    perform tell(p_world, p_uid, fitting_done('lit', v_from, null, null, null), 'event');
  elsif p_action = 'pole_douse' then
    v_left := placed_fuel(pl);
    update placed set fuel = v_left, lit = false, since = now() where id = pl.id;
    perform tell(p_world, p_uid, fitting_done('out', time_words(greatest(0, v_left)), null, null, null), 'event');
  elsif p_action = 'keep_moss' then
    g := case when coalesce((g->>'keep')::boolean, false) then g - 'keep' else g || '{"keep": true}'::jsonb end;
    perform tell(p_world, p_uid, fitting_done(case when g ? 'keep' then 'keep' else 'unkeep' end, null, null, null, null), 'event');
  elsif p_action = 'shelf_put' then
    if nullif(p_target->>'itemUid', '') is not null then
      select * into it from item i where i.id = (p_target->>'itemUid')::bigint;
    else
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
         and i.def = any (shelf_herbs()) and not i.locked order by i.id limit 1;
    end if;
    v_held := coalesce((select sum(i.count) from item i where i.holder = 'stand' and i.placed = pl.id), 0)::int;
    v_n := least(it.count, shelf_holds() - v_held);
    if v_n = it.count then
      update item set holder = 'stand', holder_uid = null, placed = pl.id where id = it.id;
    else
      update item set count = count - v_n where id = it.id;
      insert into item (world_id, holder, placed, def, ql, dmg, count, extra, rare)
      values (p_world, 'stand', pl.id, it.def, it.ql, it.dmg, v_n, it.extra, it.rare);
    end if;
    perform tell(p_world, p_uid, fitting_done('shelfPut', lower((select d.name from item_def d where d.id = it.def)), v_n, v_held + v_n, shelf_holds()), 'event');
  elsif p_action like 'shelf\_take\_%' then
    select coalesce(sum(i.count), 0)::int into v_n from item i where i.holder = 'stand' and i.placed = pl.id and i.def = substr(p_action, 12);
    update item set holder = 'player', holder_uid = p_uid, placed = null where holder = 'stand' and placed = pl.id and def = substr(p_action, 12);
    perform tell(p_world, p_uid, fitting_done('shelfTake', lower((select d.name from item_def d where d.id = substr(p_action, 12))), v_n, null, null), 'event');
  elsif p_action = 'practise_dummy' then
    held := worn(p_world, p_uid, 'weapon');
    select * into w from weapon_def where id = held.def;
    perform skill_raise(p_world, p_uid, w.kind, try_gain(true, swing_arm()) * practice_gain());
    perform tell(p_world, p_uid, fitting_done('practised', lower((select d.name from item_def d where d.id = held.def)), null, null, null), 'event');
    return;
  elsif p_action = 'shoot_target' then
    -- The arrows asked for, else plain ones, else any (`nockedArrow`), as at a creature.
    select i.* into it from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and arrow_head_of(i.def) is not null
      order by (i.def = coalesce(p_target->>'arrow', 'arrow')) desc, (i.def = 'arrow') desc, i.ql desc limit 1;
    if it.id is null or not consume(p_world, p_uid, it.def, 1, it.id) then return; end if;
    insert into item (world_id, holder, placed, def, ql, dmg, count, extra, rare) values (p_world, 'stand', pl.id, it.def, it.ql, it.dmg, 1, it.extra, it.rare);
    perform skill_raise(p_world, p_uid, 'archery', try_gain(true, shot_archery()) * practice_gain());
    perform tell(p_world, p_uid, fitting_done('shot', lower((select d.name from item_def d where d.id = it.def)), null, target_stuck(pl.id), target_holds()), 'event');
  elsif p_action = 'pull_arrows' then
    -- One in `arrow_break_in` broken, the rest back in the pack.
    for r in select i.* from item i where i.holder = 'stand' and i.placed = pl.id order by i.id loop
      for v_n in 1 .. r.count loop
        if random() < 1.0 / arrow_break_in() then v_broke := v_broke + 1;
        else v_kept := v_kept + 1; perform give(p_world, p_uid, r.def, 1, r.ql, r.extra); end if;
      end loop;
    end loop;
    delete from item where holder = 'stand' and placed = pl.id;
    perform tell(p_world, p_uid, fitting_done('pulled', null, v_kept, v_broke, null), 'event');
  elsif p_action = 'moor_boat' then
    b := boat_to_moor(p_world, pl);
    g := g || jsonb_build_object('tied', b.id);
    perform tell(p_world, p_uid, fitting_done('tied', lower((select f.name from furniture_def f where f.id = b.sub)), null, null, null), 'event');
    perform land_announce(p_world, b.x, b.y);
  elsif p_action = 'unmoor_boat' then
    select * into b from placed where world_id = p_world and id = (g->>'tied')::bigint;
    g := g - 'tied';
    perform tell(p_world, p_uid, fitting_done('untied', coalesce(lower((select f.name from furniture_def f where f.id = b.sub)), 'boat'), null, null, null), 'event');
  elsif p_action = 'carve_bust' then
    select * into who from player where world_id = p_world and uid = (p_target->>'who')::uuid;
    g := g || jsonb_build_object('bust', jsonb_build_object('uid', who.uid, 'name', who.name, 'look', who.look));
    perform tell(p_world, p_uid, fitting_done('carved', who.name, null, null, null), 'event');
  end if;
  -- What every browser draws of a shelf and a target.
  if pl.sub = spice_shelf_kind() then
    g := (g - 'jars') || case when shelf_jars(pl.id) <> '[]'::jsonb then jsonb_build_object('jars', shelf_jars(pl.id)) else '{}'::jsonb end;
  elsif pl.sub = archery_target_kind() then
    g := (g - 'stuck') || case when target_stuck(pl.id) > 0 then jsonb_build_object('stuck', target_stuck(pl.id)) else '{}'::jsonb end;
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

select pg_temp.patch_fn('last_action(text)',
  $o$      or furnish_action(p_action)
$o$,
  $n$      or furnish_action(p_action)
      -- The fittings' jobs: a pole, a boulder, a shelf, a dummy, a target, a mooring post, a bust (`fitting.ts`).
      or fitting_action(p_action)
$n$);
select pg_temp.patch_fn('last_refusal(uuid, uuid, text, jsonb)',
  $o$  if furnish_action(p_action) then
    return furnish_refusal(p_world, p_uid, p_action, p_target);
  end if;$o$,
  $n$  if furnish_action(p_action) then
    return furnish_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The fittings' jobs (`fitting.ts`).
  if fitting_action(p_action) then
    return fitting_refusal(p_world, p_uid, p_action, p_target);
  end if;$n$);
select pg_temp.patch_fn('perform_last(uuid, uuid, text, jsonb)',
  $o$  if furnish_action(p_action) then
    perform perform_furnish(p_world, p_uid, p_action, p_target);
    return;
  end if;$o$,
  $n$  if furnish_action(p_action) then
    perform perform_furnish(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The fittings' jobs (`fitting.ts`).
  if fitting_action(p_action) then
    perform perform_fitting(p_world, p_uid, p_action, p_target);
    return;
  end if;$n$);

select private.lock_doors();
