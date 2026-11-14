/*
 * The furnishings (`src/game/furnish.ts`, `src/game/furnishdefs.ts`): a
 * birdbath, a stone bench, a garden swing, a gazebo, a hay bale stack, a
 * water trough, a signpost, a cairn, a fireplace, a four-poster bed, a vase,
 * a side table, a footstool and a trophy fish mount.
 *
 * The definitions crossed every piece, its recipe and its item, the jobs
 * (`furnish_action`), a seat's bodies (`furniture_def.seats`), every number
 * (`hay_holds`, `hay_reach`, `trough_reach`, `trough_care`, `swing_rest`,
 * `vase_fresh`, `fish_size_least` and the rest), the kinds, and every sentence
 * (`furnish_said`, `furnish_done`). What is here is the doing of it.
 *
 *   * `placed.garden` keeps a furnishing's state, sent to every browser with
 *     the ground read and carried into the pack with the piece: `hay` (grass
 *     left in a hay bale stack; unsaid, full), `ate` and `drank` (when each
 *     wildermon last ate from a stack or drank from a trough), `arms` (a
 *     signpost's), `vase` (wildflowers in a vase), `on` (what is on a side
 *     table, as it is drawn) and `fish` (a trophy mount's). A cairn's name is
 *     its `engraving`, as a memorial stone's line is.
 *   * The jobs (`furnish_refusal`, `perform_furnish`), dispatched at the end
 *     of the line (`last_action`, `last_refusal`, `perform_last`).
 *   * A seat is sat in by a timed job (`sit_seat`), as many at once as it has
 *     seats (`sitters`); while it runs the wind comes back as standing still
 *     (`body_settle`), a garden swing's `swing_rest` times that.
 *   * A gazebo's tile counts as under a roof (`gazebo_over`, `decay_multiplier`).
 *   * A hay bale stack feeds a kept wildermon that eats mixed grass, within
 *     `hay_reach`, `hay_a_day` a day, before the stores (`hay_feed`, `worker_feed`).
 *   * A water trough is a barrel of water only (`barrel_for`, `brew_reason`,
 *     `brew_target`, `errand_do`, `liquid_refusal`); a kept wildermon within
 *     `trough_reach` drinks `trough_drink` litres a day from it and its care
 *     holds `trough_care` times as long (`trough_visit`, `creature_settle`).
 *   * A fireplace goes against a finished solid wall inside a building
 *     (`mount_refusal`, mount `hearth`).
 *   * Things on a side table are items of their own (`item.holder = 'stand'`,
 *     `item.placed` the table), and a table with things on it is not picked up
 *     (`fire_refusal`).
 *   * The cairns on a settlement of yours come with the settlements for the
 *     map (`cairns_of`, `rpc_settlements`).
 *
 * `supabase/test/furnish.ts` holds the two sides to each other.
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

/* ---- seats ------------------------------------------------------------------------------------- */

/** Bodies a piece seats, nought for none (`seatsOf`). */
create or replace function seats_of(p_sub text) returns int language sql stable as $fn$
  select coalesce((select f.seats from furniture_def f where f.id = p_sub), 0)
$fn$;

/** Stamina back sat in a piece, × standing still's (`seatRest`). */
create or replace function seat_rest(p_sub text) returns double precision language sql stable as $fn$
  select case when p_sub = garden_swing_kind() then swing_rest() else 1 end
$fn$;

/** Bodies besides this one sat in a seat now: those whose sitting there is going. */
create or replace function sitters(p_world uuid, p_uid uuid, p_placed bigint) returns int language sql stable as $fn$
  select count(*)::int from player q
   where q.world_id = p_world and q.uid <> p_uid and q.act = 'sit_seat' and q.act_target->>'id' = p_placed::text
$fn$;

/** A body's stamina back × standing still's: a seat's while it sits in it, one otherwise. */
create or replace function seat_wind(p player) returns double precision language sql stable as $fn$
  select case when p.act = 'sit_seat'
              then coalesce((select seat_rest(pl.sub) from placed pl where pl.id = nullif(p.act_target->>'id', '')::bigint), 1)
              else 1 end
$fn$;

select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$    if p.act is null then$o$,
  $n$    -- Or sat in a seat (`furnish.ts`): as standing still, a garden swing `swing_rest` times that.
    if p.act is null or p.act = 'sit_seat' then$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$then wind_walk() else wind_rest() end)$o$,
  $n$then wind_walk() else wind_rest() * seat_wind(p) end)$n$);

/* ---- a gazebo ---------------------------------------------------------------------------------- */

/** Whether a gazebo stands on the ground of a tile: it counts as under a roof (`Game.underGazebo`). */
create or replace function gazebo_over(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $fn$
  select exists (select 1 from placed p where p.world_id = p_world and p.kind = 'furniture' and p.sub = gazebo_kind()
                  and p.x = p_x and p.y = p_y and coalesce(p.level, 0) = 0)
$fn$;

select pg_temp.patch_fn('decay_multiplier(uuid, integer, integer)',
  $o$sheltered(p_world, 0, p_x, p_y)$o$,
  $n$(sheltered(p_world, 0, p_x, p_y) or gazebo_over(p_world, p_x, p_y))$n$);

/* ---- a hay bale stack -------------------------------------------------------------------------- */

/** Mixed grass left in a stack: unsaid, full (`hayLeft`). */
create or replace function hay_left(pl placed) returns int language sql immutable as $fn$
  select coalesce((pl.garden->>'hay')::int, hay_holds())
$fn$;

/** A keyed map of epoch seconds with what is older than a day of the island's year left out, and `p_key` now. */
create or replace function day_marks(p_marks jsonb, p_key text) returns jsonb language sql stable as $fn$
  select coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(p_marks, '{}'::jsonb)) e
                    where jsonb_typeof(e.value) = 'number' and (e.value)::text::double precision > extract(epoch from now()) - day_seconds()), '{}'::jsonb)
      || jsonb_build_object(p_key, extract(epoch from now()))
$fn$;

/**
 * A kept wildermon that eats mixed grass fed from the nearest stack within
 * `hay_reach` of it with grass left that it has not eaten from in the last
 * day: `hay_a_day` taken, its belly filled and what a meal of the stack's QL
 * is worth to it (`beast_fed`), as `worker_feed` feeds it from the stores.
 */
create or replace function hay_feed(p_world uuid, c creature, p_care double precision) returns boolean language plpgsql as $fn$
declare pl placed; v_x double precision; v_y double precision; v_now double precision := extract(epoch from now());
begin
  if c.mode = 'wild' or not exists (select 1 from species_diet sd where sd.species = c.species and sd.item = hay_item()) then return false; end if;
  v_x := creature_x(c); v_y := creature_y(c);
  select p.* into pl from placed p
   where p.world_id = p_world and p.kind = 'furniture' and p.sub = hay_bale_kind()
     and p.x between floor(v_x - hay_reach())::int - 1 and floor(v_x + hay_reach())::int + 1
     and p.y between floor(v_y - hay_reach())::int - 1 and floor(v_y + hay_reach())::int + 1
     and (p.x + 0.5 - v_x) ^ 2 + (p.y + 0.5 - v_y) ^ 2 <= hay_reach() ^ 2
     and hay_left(p) >= hay_a_day()
     and coalesce((p.garden->'ate'->>c.id::text)::double precision, 0) <= v_now - day_seconds()
   order by (p.x + 0.5 - v_x) ^ 2 + (p.y + 0.5 - v_y) ^ 2, p.id
   limit 1 for update;
  if pl.id is null then return false; end if;
  update placed set garden = coalesce(garden, '{}'::jsonb)
      || jsonb_build_object('hay', hay_left(pl) - hay_a_day(), 'ate', day_marks(pl.garden->'ate', c.id::text))
   where id = pl.id;
  update creature set hunger = least(1, hunger + graze_fill()) where world_id = p_world and id = c.id;
  perform beast_fed(p_world, c.id, hay_item(), pl.ql, p_care);
  perform land_announce(p_world, pl.x, pl.y);
  return true;
end $fn$;

select pg_temp.patch_fn('worker_feed(uuid, integer, double precision)',
  $o$  if not found or c.mode = 'wild' then return null; end if;$o$,
  $n$  if not found or c.mode = 'wild' then return null; end if;
  -- A hay bale stack in reach first, a day's grass for one that eats it (`furnish.ts`).
  if hay_feed(p_world, c, p_care) then return hay_item(); end if;$n$);

/* ---- a water trough ---------------------------------------------------------------------------- */

/**
 * How much longer a kept wildermon's care holds: `trough_care` with a trough
 * within `trough_reach` that it drank from in the last day or that holds
 * `trough_drink` litres of water, which it then drinks; one otherwise
 * (`troughCare`).
 */
create or replace function trough_visit(p_world uuid, c creature) returns double precision language plpgsql as $fn$
declare pl placed; v_x double precision; v_y double precision; v_now double precision := extract(epoch from now());
begin
  if c.mode = 'wild' then return 1; end if;
  v_x := creature_x(c); v_y := creature_y(c);
  select p.* into pl from placed p
   where p.world_id = p_world and p.kind = 'furniture' and p.sub = water_trough_kind()
     and p.x between floor(v_x - trough_reach())::int - 1 and floor(v_x + trough_reach())::int + 1
     and p.y between floor(v_y - trough_reach())::int - 1 and floor(v_y + trough_reach())::int + 1
     and (p.x + 0.5 - v_x) ^ 2 + (p.y + 0.5 - v_y) ^ 2 <= trough_reach() ^ 2
     and (coalesce((p.garden->'drank'->>c.id::text)::double precision, 0) > v_now - day_seconds()
          or (coalesce(p.liquid, 'water') = 'water' and coalesce(p.litres, 0) >= trough_drink()))
   order by coalesce((p.garden->'drank'->>c.id::text)::double precision, 0) > v_now - day_seconds() desc,
            (p.x + 0.5 - v_x) ^ 2 + (p.y + 0.5 - v_y) ^ 2, p.id
   limit 1 for update;
  if pl.id is null then return 1; end if;
  if coalesce((pl.garden->'drank'->>c.id::text)::double precision, 0) <= v_now - day_seconds() then
    update placed set litres = greatest(0, litres - trough_drink()),
                      garden = coalesce(garden, '{}'::jsonb) || jsonb_build_object('drank', day_marks(pl.garden->'drank', c.id::text))
     where id = pl.id;
    perform land_announce(p_world, pl.x, pl.y);
  end if;
  return trough_care();
end $fn$;

select pg_temp.patch_fn('creature_settle(uuid, integer)',
  $o$care_hours()) * 3600));$o$,
  $n$care_hours()) * trough_visit(p_world, c) * 3600));$n$);

-- Water only in one: nothing else poured in, no brew set going, no lye leached in it (`TROUGH_WATER_ONLY`).
select pg_temp.patch_fn('barrel_for(uuid, uuid, text)',
  $o$    and holds_liquid(p) and not is_well(p)$o$,
  $n$    and holds_liquid(p) and not is_well(p) and (p_kind = 'water' or p.sub <> water_trough_kind())$n$);
select pg_temp.patch_fn('brew_reason(uuid, uuid, placed, brew_def)',
  $o$  if is_well(p) then return 'Not a barrel.'; end if;$o$,
  $n$  if is_well(p) then return 'Not a barrel.'; end if;
  if p.sub = water_trough_kind() then return furnish_said('troughWater', null, null, null); end if;$n$);
select pg_temp.patch_fn('brew_target(uuid, creature, brew_def, double precision, double precision)',
  $o$     and holds_liquid(p) and not is_well(p) and not is_working(p)$o$,
  $n$     and holds_liquid(p) and not is_well(p) and not is_working(p) and p.sub <> water_trough_kind()$n$);
select pg_temp.patch_fn('errand_do(uuid, integer, boolean, text)',
  $o$        and holds_liquid(p) and not is_well(p) and not is_working(p) and coalesce(placed_liquid(p), '') = 'water'$o$,
  $n$        and holds_liquid(p) and not is_well(p) and not is_working(p) and coalesce(placed_liquid(p), '') = 'water' and p.sub <> water_trough_kind()$n$);
select pg_temp.patch_fn('liquid_refusal(uuid, uuid, text, jsonb)',
  $o$  elsif p_action = 'leach_lye' then
    if not holds_liquid(p) or is_well(p) then return 'Not a barrel.'; end if;$o$,
  $n$  elsif p_action = 'leach_lye' then
    if not holds_liquid(p) or is_well(p) then return 'Not a barrel.'; end if;
    if p.sub = water_trough_kind() then return furnish_said('troughWater', null, null, null); end if;$n$);

/* ---- a fireplace ------------------------------------------------------------------------------- */

select pg_temp.patch_fn('mount_refusal(uuid, uuid, text, integer, integer, text, integer)',
  $o$  if p_mount in ('wall', 'pane') then$o$,
  $n$  -- A fireplace as a plaque, inside a building (`furnish.ts`).
  if p_mount = 'hearth' then
    if building_at(p_world, p_x, p_y) is null then return mount_said('outside'); end if;
    p_mount := 'wall';
  end if;
  if p_mount in ('wall', 'pane') then$n$);

/* ---- a side table ------------------------------------------------------------------------------ */

/** What is on a table, by item id, as every browser draws it: `[def, ql, dye]` each. */
create or replace function table_on(p_placed bigint) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_array(i.def, i.ql, i.dye) order by i.id), '[]'::jsonb)
    from item i where i.holder = 'stand' and i.placed = p_placed
$fn$;

/** Whether a carried thing goes on a table: not locked, not worn, not a piece of furniture, holding nothing (`onTableOk`). */
create or replace function on_table_ok(p_world uuid, p_uid uuid, it item) returns boolean language sql stable as $fn$
  select not it.locked and not worn_by(p_world, p_uid, it.id)
     and not exists (select 1 from furniture_def f where f.id = it.def)
     and not exists (select 1 from item x where x.inside = it.id)
$fn$;

/** Why a table is not yours to change, or null: the armour stand's rule, in the table's name. */
create or replace function table_refusal(p_world uuid, p_uid uuid, pl placed) returns text language sql stable as $fn$
  select case when coalesce(pl.made_by = p_uid, false) or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) then null
              else coalesce(rank_lacks_at(p_world, p_uid, pl.x, pl.y, 'stores'),
                            furnish_said('notYours', lower((select f.name from furniture_def f where f.id = pl.sub)), null, null)) end
$fn$;

select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$      if coalesce(p.garden->'worn', '{}'::jsonb) <> '{}'::jsonb then return garden_said('showing', ''); end if;$o$,
  $n$      if coalesce(p.garden->'worn', '{}'::jsonb) <> '{}'::jsonb then return garden_said('showing', ''); end if;
      -- And things on a side table (`furnish.ts`).
      if coalesce(jsonb_array_length(p.garden->'on'), 0) > 0 then return garden_said('showing', ''); end if;$n$);

/* ---- a vase ------------------------------------------------------------------------------------ */

/** Whether the wildflowers in a vase are fresh: `vase_fresh` days after the last went in (`posyFresh`). */
create or replace function posy_fresh(p_vase jsonb) returns boolean language sql stable as $fn$
  select p_vase is not null and extract(epoch from now()) - coalesce((p_vase->>'at')::double precision, 0) < vase_fresh() * day_seconds()
$fn$;

/* ---- a trophy fish mount ------------------------------------------------------------------------- */

/** A fish's weight on a mount, kg (`fishKg`): its kind's weight × (`fish_size_least` + QL × `fish_size_per`), to `fish_kg_step`. */
create or replace function fish_kg(p_def text, p_ql double precision) returns double precision language sql stable as $fn$
  select floor((select d.weight::numeric from item_def d where d.id = p_def) * (fish_size_least() + p_ql * fish_size_per())::numeric
               / fish_kg_step()::numeric + 0.5)::double precision * fish_kg_step()
$fn$;

/** A weight as the mount says it (`kgWords`). */
create or replace function kg_words(p_kg double precision) returns text language sql immutable as $fn$
  select to_char(p_kg, 'FM999990.00') || ' kg'
$fn$;

/** What a mount's fish is labelled (`fishLabel`): "Pike, 3.45 kg, by Mira". */
create or replace function fish_label(p_fish jsonb) returns text language sql stable as $fn$
  select initcap_first(lower((select d.name from item_def d where d.id = p_fish->>'def'))) || ', ' || kg_words((p_fish->>'kg')::double precision)
      || ', by ' || coalesce(p_fish->>'by', '')
$fn$;

/** The fish in the pack a Mount would put up: the one named, or the heaviest the mount takes (`toMount`). */
create or replace function fish_pick(p_world uuid, p_uid uuid, pl placed, p_target jsonb) returns bigint language sql stable as $fn$
  select case when nullif(p_target->>'itemUid', '') is not null
    then (select i.id from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
             and i.id = (p_target->>'itemUid')::bigint)
    else (select i.id from item i
           where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
             and exists (select 1 from fish_def f where f.id = i.def)
             and (pl.garden->'fish' is null or i.def = pl.garden->'fish'->>'def')
           order by fish_kg(i.def, i.ql) desc, i.id limit 1) end
$fn$;

/* ---- a signpost -------------------------------------------------------------------------------- */

/** An arm as the post says it (`armWords`): "Harrowmark: north-east, 47°, 312 tiles". */
create or replace function arm_words(p_name text, p_px double precision, p_py double precision, p_x double precision, p_y double precision)
returns text language sql immutable as $fn$
  select p_name || ': ' || track_point(8, floor(track_bearing(p_px, p_py, p_x, p_y) / 45 + 0.5)::int % 8) || ', '
      || (floor(track_bearing(p_px, p_py, p_x, p_y) + 0.5)::int % 360) || '°, '
      || floor(sqrt((p_x - p_px) ^ 2 + (p_y - p_py) ^ 2) + 0.5)::int || ' tiles'
$fn$;

/**
 * Where an arm asked for (`stone:<id>`, `deed:<x>,<y>`) points, read from the
 * island now: a Runestone of this island's, its centre's middle; a
 * settlement, its token's. Null for one there is none of.
 */
create or replace function arm_dest(p_world uuid, p_dest text) returns jsonb language sql stable as $fn$
  select coalesce(
    (select jsonb_build_object('t', 'stone', 'id', r.id, 'name', r.name, 'x', r.x + 0.5, 'y', r.y + 0.5)
       from world w, runestone_centres(w.size) r
      where w.id = p_world and p_dest like 'stone:%' and r.id = substr(p_dest, 7)),
    (select jsonb_build_object('t', 'deed', 'id', d.x || ',' || d.y, 'name', d.name, 'x', d.x + 0.5, 'y', d.y + 0.5)
       from deed d where d.world_id = p_world and p_dest like 'deed:%' and d.x || ',' || d.y = substr(p_dest, 6) limit 1))
$fn$;

/** What a signpost's Examine says: every arm read from the post, a settlement's name as it is now (`signpostSays`). */
create or replace function signpost_says(p_world uuid, pl placed) returns text language sql stable as $fn$
  select case when coalesce(jsonb_array_length(pl.garden->'arms'), 0) = 0 then furnish_done('bare', null, null, null, null)
    else furnish_done('read', (select string_agg(arm_words(coalesce(now_->>'name', a->>'name'), pl.x + 0.5, pl.y + 0.5,
                                                          coalesce(now_->>'x', a->>'x')::double precision, coalesce(now_->>'y', a->>'y')::double precision), '; ' order by o)
                                 from jsonb_array_elements(pl.garden->'arms') with ordinality e(a, o)
                                 left join lateral (select arm_dest(p_world, (a->>'t') || ':' || (a->>'id')) as now_) n on true), null, null, null) end
$fn$;

/* ---- a cairn on the map ----------------------------------------------------------------------- */

/** The cairns on the settlements of yours, founded or joined, named, for the map (`rpc_settlements`). */
create or replace function cairns_of(p_world uuid, p_uid uuid) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pl.engraving, ''), 'x', pl.x, 'y', pl.y) order by pl.id), '[]'::jsonb)
    from placed pl
   where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = cairn_kind() and coalesce(pl.level, 0) >= 0
     and exists (select 1 from deed d where d.world_id = p_world and deed_covers(d, pl.x, pl.y)
                   and (d.founded_by = p_uid or exists (select 1 from deed_member m where m.world_id = p_world
                                                          and m.uid = p_uid and m.founder = d.founded_by)))
$fn$;

select pg_temp.patch_fn('rpc_settlements(uuid)',
  $o$    from deed d where d.world_id = p_world), '[]'::jsonb));$o$,
  $n$    from deed d where d.world_id = p_world), '[]'::jsonb),
    -- And the cairns on the settlements of yours, named (`furnish.ts`).
    'cairns', cairns_of(p_world, me));$n$);

/* ---- the jobs ---------------------------------------------------------------------------------- */

/**
 * Why a job at a furnishing cannot be done now, or null: the browser's
 * `furnishRefusal`, question for question -- there, in reach, whose, and then
 * the piece.
 */
create or replace function furnish_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; g jsonb; v_name text; v_n int; v_text text; v_why text; v_dest text; it item;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
     and case when p_action = 'sit_seat' then seats_of(sub) > 0
              when p_action = 'fill_hay' then sub = hay_bale_kind()
              when p_action in ('point_arm', 'read_signpost') or p_action like 'drop\_arm\_%' then sub = signpost_kind()
              when p_action = 'name_cairn' then sub = cairn_kind()
              when p_action in ('vase_put', 'vase_take') then sub = vase_kind()
              when p_action = 'table_put' or p_action like 'table\_take\_%' then sub = side_table_kind()
              when p_action = 'mount_fish' then sub = fish_mount_kind()
              else false end;
  if not found then return 'It is gone.'; end if;
  v_name := lower((select f.name from furniture_def f where f.id = pl.sub));
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(v_name); end if;
  g := coalesce(pl.garden, '{}'::jsonb);
  if p_action = 'sit_seat' then
    v_n := seats_of(pl.sub);
    return case when sitters(p_world, p_uid, pl.id) >= v_n then furnish_said('seatsFull', v_name, v_n, null) end;
  end if;
  if p_action = 'fill_hay' then
    if hay_left(pl) >= hay_holds() then return furnish_said('hayFull', null, null, null); end if;
    return case when exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                                and i.def = hay_item() and not i.locked) then null else furnish_said('noHay', null, null, null) end;
  end if;
  if p_action = 'point_arm' then
    v_dest := coalesce(p_target->>'dest', '');
    if coalesce(jsonb_array_length(g->'arms'), 0) >= sign_arms() then return furnish_said('armsFull', null, null, null); end if;
    if exists (select 1 from jsonb_array_elements(coalesce(g->'arms', '[]'::jsonb)) a where (a->>'t') || ':' || (a->>'id') = v_dest) then
      return furnish_said('armThere', null, null, null);
    end if;
    return case when arm_dest(p_world, v_dest) is null then furnish_said('noDest', null, null, null) end;
  end if;
  if p_action like 'drop\_arm\_%' then
    return case when g->'arms'->(substr(p_action, 10)::int) is null then furnish_said('noArm', null, null, null) end;
  end if;
  if p_action = 'name_cairn' then
    if not may_engrave(p_world, p_uid, pl) then return furnish_said('cairnNotYours', null, null, null); end if;
    v_why := private.muted_why(p_world, p_uid);
    if v_why is not null then return v_why; end if;
    if p_target->>'name' is null then return null; end if;
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    if v_text = '' then return furnish_said('noName', null, null, null); end if;
    return case when v_text = pl.engraving then furnish_said('sameName', null, null, null) end;
  end if;
  if p_action = 'vase_put' then
    if g->'vase' is not null and not posy_fresh(g->'vase') then return furnish_said('wilted', null, null, null); end if;
    if coalesce((g->'vase'->>'n')::int, 0) >= vase_holds() then return furnish_said('vaseFull', null, null, null); end if;
    return case when exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                                and i.def = vase_flower() and not i.locked) then null else furnish_said('noFlowers', null, null, null) end;
  end if;
  if p_action = 'vase_take' then
    return case when g->'vase' is null then furnish_said('vaseEmpty', null, null, null) end;
  end if;
  if pl.sub = side_table_kind() then
    v_why := table_refusal(p_world, p_uid, pl);
    if v_why is not null then return v_why; end if;
    if p_action = 'table_put' then
      if coalesce(jsonb_array_length(g->'on'), 0) >= table_holds() then return furnish_said('tableFull', null, null, null); end if;
      select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
        and i.id = nullif(p_target->>'itemUid', '')::bigint;
      if it.id is null then return furnish_said('pick', null, null, null); end if;
      return case when on_table_ok(p_world, p_uid, it) then null else furnish_said('notOnTable', null, null, null) end;
    end if;
    return case when g->'on'->(substr(p_action, 12)::int) is null then furnish_said('slotEmpty', null, null, null) end;
  end if;
  if p_action = 'mount_fish' then
    if g->'fish' is null and not may_engrave(p_world, p_uid, pl) then return furnish_said('mountEmptyNotYours', null, null, null); end if;
    if g->'fish' is not null and not coalesce(pl.made_by = p_uid, false) then return furnish_said('mountNotYours', null, null, null); end if;
    select * into it from item where id = fish_pick(p_world, p_uid, pl, p_target);
    if it.id is null or not exists (select 1 from fish_def f where f.id = it.def) then return furnish_said('noFish', null, null, null); end if;
    if g->'fish' is not null and it.def <> g->'fish'->>'def' then
      return furnish_said('otherKind', null, null, lower((select d.name from item_def d where d.id = g->'fish'->>'def')));
    end if;
    if g->'fish' is not null and fish_kg(it.def, it.ql) <= (g->'fish'->>'kg')::double precision then
      return furnish_said('notBigger', null, null, lower((select d.name from item_def d where d.id = g->'fish'->>'def'))
        || ', ' || kg_words((g->'fish'->>'kg')::double precision));
    end if;
    return null;
  end if;
  return null;
end $fn$;

/**
 * The jobs done: a seat got up from; grass added to a stack, a stack's worth
 * up to its room; an arm pointed and taken down, and the post read; a cairn
 * named; wildflowers put in a vase and taken out, or thrown out wilted; a thing
 * set on a table and taken off; a fish mounted. What is on a table is told to
 * every browser as its `on` (`table_on`).
 */
create or replace function perform_furnish(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; g jsonb; it item; v_name text; v_n int; v_held int; v_ql double precision; v_arm jsonb; v_i int; v_text text;
begin
  if furnish_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  g := coalesce(pl.garden, '{}'::jsonb);
  v_name := lower((select f.name from furniture_def f where f.id = pl.sub));
  if p_action = 'sit_seat' then
    perform tell(p_world, p_uid, furnish_done('up', v_name, null, null, null), 'event');
    return;
  elsif p_action = 'read_signpost' then
    perform tell(p_world, p_uid, signpost_says(p_world, pl), 'event');
    return;
  elsif p_action = 'name_cairn' then
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    update placed set engraving = v_text where id = pl.id;
    perform tell(p_world, p_uid, furnish_done('named', v_text, null, null, null), 'event');
    perform land_announce(p_world, pl.x, pl.y);
    return;
  elsif p_action = 'fill_hay' then
    select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = hay_item() and not i.locked
     order by (i.id = nullif(p_target->>'itemUid', '')::bigint) desc nulls last, i.id limit 1;
    v_held := hay_left(pl);
    v_n := least(it.count, hay_holds() - v_held);
    if not spend_stack(p_world, p_uid, it.id, v_n) then return; end if;
    g := g || jsonb_build_object('hay', v_held + v_n);
    perform tell(p_world, p_uid, furnish_done('hay', null, v_n, v_held + v_n, hay_holds()), 'event');
  elsif p_action = 'point_arm' then
    v_arm := arm_dest(p_world, p_target->>'dest');
    g := g || jsonb_build_object('arms', coalesce(g->'arms', '[]'::jsonb) || jsonb_build_array(v_arm));
    perform tell(p_world, p_uid, furnish_done('arm', arm_words(v_arm->>'name', pl.x + 0.5, pl.y + 0.5, (v_arm->>'x')::double precision, (v_arm->>'y')::double precision),
      jsonb_array_length(g->'arms'), null, null), 'event');
  elsif p_action like 'drop\_arm\_%' then
    v_i := substr(p_action, 10)::int;
    v_arm := g->'arms'->v_i;
    g := g || jsonb_build_object('arms', (g->'arms') - v_i);
    if jsonb_array_length(g->'arms') = 0 then g := g - 'arms'; end if;
    perform tell(p_world, p_uid, furnish_done('armDown', v_arm->>'name', null, null, null), 'event');
  elsif p_action = 'vase_put' then
    select * into it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = vase_flower() and not i.locked
     order by (i.id = nullif(p_target->>'itemUid', '')::bigint) desc nulls last, i.id limit 1;
    v_held := coalesce((g->'vase'->>'n')::int, 0);
    v_n := least(it.count, vase_holds() - v_held);
    v_ql := (v_held * coalesce((g->'vase'->>'ql')::double precision, 0) + v_n * it.ql) / (v_held + v_n);
    if not spend_stack(p_world, p_uid, it.id, v_n) then return; end if;
    g := g || jsonb_build_object('vase', jsonb_build_object('n', v_held + v_n, 'ql', v_ql, 'at', extract(epoch from now())));
    perform tell(p_world, p_uid, furnish_done('posy', null, v_n, v_held + v_n, vase_holds()), 'event');
  elsif p_action = 'vase_take' then
    v_n := (g->'vase'->>'n')::int;
    if posy_fresh(g->'vase') then
      perform give(p_world, p_uid, vase_flower(), v_n, (g->'vase'->>'ql')::double precision);
      perform tell(p_world, p_uid, furnish_done('posyTaken', null, v_n, null, null), 'event');
    else
      perform tell(p_world, p_uid, furnish_done('posyGone', null, v_n, null, null), 'event');
    end if;
    g := g - 'vase';
  elsif p_action = 'table_put' then
    select * into it from item where id = (p_target->>'itemUid')::bigint;
    update item set holder = 'stand', holder_uid = null, placed = pl.id where id = it.id;
    perform tell(p_world, p_uid, furnish_done('put', lower((select x.name from item_def x where x.id = it.def)), null, null, null), 'event');
  elsif p_action like 'table\_take\_%' then
    select i.* into it from item i where i.holder = 'stand' and i.placed = pl.id order by i.id offset substr(p_action, 12)::int limit 1;
    if it.id is null then return; end if;
    update item set holder = 'player', holder_uid = p_uid, placed = null where id = it.id;
    perform tell(p_world, p_uid, furnish_done('taken', lower((select x.name from item_def x where x.id = it.def)), null, null, null), 'event');
  elsif p_action = 'mount_fish' then
    select * into it from item where id = fish_pick(p_world, p_uid, pl, p_target);
    if not spend_stack(p_world, p_uid, it.id, 1) then return; end if;
    g := g || jsonb_build_object('fish', jsonb_build_object('def', it.def, 'kg', fish_kg(it.def, it.ql), 'ql', it.ql,
      'by', (select p.name from player p where p.world_id = p_world and p.uid = p_uid)));
    perform tell(p_world, p_uid, furnish_done('mounted', fish_label(g->'fish'), null, null, null), 'event');
  end if;
  if pl.sub = side_table_kind() then
    g := (g - 'on') || case when table_on(pl.id) <> '[]'::jsonb then jsonb_build_object('on', table_on(pl.id)) else '{}'::jsonb end;
  end if;
  update placed set garden = nullif(g, '{}'::jsonb) where id = pl.id;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

select pg_temp.patch_fn('last_action(text)',
  $o$      or decor_action(p_action)
$o$,
  $n$      or decor_action(p_action)
      -- The furnishings' jobs: a seat, a hay stack, a signpost, a cairn, a vase, a side table, a fish mount (`furnish.ts`).
      or furnish_action(p_action)
$n$);
select pg_temp.patch_fn('last_refusal(uuid, uuid, text, jsonb)',
  $o$  if decor_action(p_action) then
    return decor_refusal(p_world, p_uid, p_action, p_target);
  end if;$o$,
  $n$  if decor_action(p_action) then
    return decor_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The furnishings' jobs (`furnish.ts`).
  if furnish_action(p_action) then
    return furnish_refusal(p_world, p_uid, p_action, p_target);
  end if;$n$);
select pg_temp.patch_fn('perform_last(uuid, uuid, text, jsonb)',
  $o$  if decor_action(p_action) then
    perform perform_decor(p_world, p_uid, p_action, p_target);
    return;
  end if;$o$,
  $n$  if decor_action(p_action) then
    perform perform_decor(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The furnishings' jobs (`furnish.ts`).
  if furnish_action(p_action) then
    perform perform_furnish(p_world, p_uid, p_action, p_target);
    return;
  end if;$n$);

select private.lock_doors();
