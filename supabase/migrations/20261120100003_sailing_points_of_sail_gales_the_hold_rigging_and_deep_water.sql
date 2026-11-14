-- Sailing: what the helm makes of a hull past the pace it already gave (`sailing.ts`, `sailActions.ts`).
--
-- Asked for, with the numbers:
--   * the closest a hull sails to the wind, 60° at Sailing 1 to 35° at 100, and a reach ×1 to ×1.15 at 100: the points
--     of sail are the browser's to sail, as the wind always was (`boatSpeed`), and the island holds her to the top of
--     them: a sailing hull's top speed is ×`beam_pace` of the helm's Sailing (`travel_speed`);
--   * rough water: wind over 0.7 is a gale; below Sailing 30 a hull takes 1 damage per 10 tiles sailed in one
--     (`sail_gale_damage`, in `rpc_move`); a rowing boat does not put out in one (`ride_refusal`, `gale_row_said`);
--   * the hold of the boat at your helm × (1 + 0.25 × Sailing/100), the share more in whole things (`cargo_room`, in
--     `furniture_capacity`);
--   * a rigging set fitted to a sailing boat or a caravel: speed +10% and 10° closer to the wind (`fit_rigging`,
--     `rig_mark` in her mark); her sails' QL, the QL of the sailcloth they were made of, +10% speed at 100 and in
--     proportion below (`sail_ql_pace`, `sails_mark`, put into her mark as she is built in `perform_craft`);
--   * work from a boat: a line from a boat over water deeper than 4 m brings up deep-water fish only, each cast's
--     chance a fish stays on ×1.3 (`catch_deep_fish`); a net cast from a boat there hauls ×1.5; deep-water fish come
--     from nowhere else (`fish_here`); Sound the depth reads the water within 5 tiles and trains Sailing;
--   * a tile sailed in a gale teaches ×2, one sailed close-hauled ×1.5 (`sail_learn_mul`), both ×3.

set local lock_timeout = '3s';

-- The wind on this island now: what `windAt` gives the browser off the same seed and clock.
create or replace function world_wind(p_world uuid, out dir double precision, out force double precision) language plpgsql stable as $fn$
declare w record;
begin
  select * into w from wind_at((select seed from world where id = p_world), world_time(p_world));
  dir := w.dir; force := w.force;
end $fn$;

create or replace function no_go_degrees(p_skill double precision, p_rigged boolean default false) returns double precision
language sql immutable as $fn$
  select no_go_at_one() - (no_go_at_one() - no_go_at_top()) * (greatest(1, least(sail_top_at(), p_skill)) - 1) / (sail_top_at() - 1)
       - case when p_rigged then rigging_closer() else 0 end
$fn$;
create or replace function beam_pace(p_skill double precision) returns double precision language sql immutable as $fn$
  select 1 + beam_top() * greatest(0, least(sail_top_at(), p_skill)) / sail_top_at()
$fn$;
create or replace function cargo_room(p_skill double precision) returns double precision language sql immutable as $fn$
  select 1 + cargo_top() * greatest(0, least(sail_top_at(), p_skill)) / sail_top_at()
$fn$;
create or replace function sail_ql_pace(p_ql double precision) returns double precision language sql immutable as $fn$
  select 1 + sail_ql_top() * greatest(0, least(100, p_ql)) / 100
$fn$;
create or replace function is_gale(p_force double precision) returns boolean language sql immutable as $fn$
  select p_force > gale()
$fn$;
create or replace function hull_rigged(p placed) returns boolean language sql immutable as $fn$
  select coalesce(p.mark ? rig_mark(), false)
$fn$;

-- Whether a heading from one point to another is close-hauled in the wind now: off the wind's eye by less than
-- `wind_close` and no closer than she sails (`sailWord`).
create or replace function close_hauled(p_world uuid, p_x0 double precision, p_y0 double precision, p_x1 double precision,
                                        p_y1 double precision, p_skill double precision, p_rigged boolean) returns boolean
language plpgsql stable as $fn$
declare w record; h double precision; wr double precision; up double precision; tau double precision := 2 * pi();
begin
  if p_x1 = p_x0 and p_y1 = p_y0 then return false; end if;
  w := world_wind(p_world);
  h := atan2(p_y1 - p_y0, p_x1 - p_x0);
  wr := h - w.dir;
  wr := wr - tau * floor(wr / tau);
  wr := wr + pi() * 3;
  wr := wr - tau * floor(wr / tau) - pi();
  up := pi() - abs(wr);
  return up < wind_close() and up >= radians(no_go_degrees(p_skill, p_rigged));
end $fn$;

-- What a tile sailed or rowed teaches, as a share of a plain one: ×2 in a gale, ×1.5 close-hauled under sail.
create or replace function sail_learn_mul(p_world uuid, p_uid uuid, p_cart placed, p_x0 double precision, p_y0 double precision,
                                          p_x1 double precision, p_y1 double precision) returns double precision
language plpgsql stable as $fn$
declare v double precision := 1;
begin
  if is_gale((world_wind(p_world)).force) then v := v * gale_learn(); end if;
  if coalesce((select b.sail from boat_def b where b.id = p_cart.sub), false)
     and close_hauled(p_world, p_x0, p_y0, p_x1, p_y1, skill_of(p_world, p_uid, sailing_skill()), hull_rigged(p_cart)) then
    v := v * close_learn();
  end if;
  return v;
end $fn$;

-- A hull under a helm below Sailing 30 in a gale: a point of damage for every 10 tiles she goes, said as it mounts.
create or replace function sail_gale_damage(p_world uuid, p_uid uuid, p_boat bigint, p_tiles int) returns void language plpgsql as $fn$
declare v_was real; v_now real;
begin
  if p_tiles <= 0 or not is_gale((world_wind(p_world)).force)
     or skill_of(p_world, p_uid, sailing_skill()) >= gale_safe_at() then return; end if;
  update placed set dmg = least(100, dmg + p_tiles / gale_tiles_per_damage())
   where world_id = p_world and id = p_boat
   returning dmg - p_tiles / gale_tiles_per_damage(), dmg into v_was, v_now;
  if floor(v_now) > floor(v_was) then
    perform tell(p_world, p_uid, 'Gale: hull damage ' || floor(v_now)::int || '.', 'event');
  end if;
end $fn$;

-- The boat a body is in, at her helm or aboard her; null ashore.
create or replace function afloat_in(p_world uuid, p_uid uuid) returns placed language plpgsql stable as $fn$
declare r placed;
begin
  r := driving(p_world, p_uid);
  if r.id is not null and is_boat(r) then return r; end if;
  select p.* into r from placed p join player pl on pl.world_id = p.world_id and pl.aboard = p.id
   where pl.world_id = p_world and pl.uid = p_uid;
  if r.id is null then return null; end if;
  return r;
end $fn$;

-- A cast from a boat over water deeper than `deep_water`.
create or replace function afloat_deep(p_world uuid, p_uid uuid, p_depth double precision) returns boolean language sql stable as $fn$
  select p_depth > deep_water() and (afloat_in(p_world, p_uid)).id is not null
$fn$;

create or replace function deep_fish_here(p_depth double precision, p_skill double precision) returns setof fish_def
language sql stable as $fn$
  select * from fish_def where deep and p_depth >= depth and p_skill >= level
$fn$;
create or replace function pick_deep_fish(p_depth double precision, p_skill double precision, p_bait text, p_roll double precision,
                                          p_mul jsonb default null) returns text language sql stable as $fn$
  select id from (
    select f.id, sum(w) over (order by w desc, f.id) upto, sum(w) over () total
    from deep_fish_here(p_depth, p_skill) f
    cross join lateral (select bite_weight(f.id, f.weight, p_bait, p_mul) as w) q
  ) r where upto >= p_roll * total order by upto limit 1
$fn$;
create or replace function catch_deep_fish(p_depth double precision, p_skill double precision, p_rod_ql double precision, p_bait text,
                                           p_mul jsonb default null) returns text language sql as $fn$
  select case
    when not exists (select 1 from deep_fish_here(p_depth, p_skill)) then null
    when random() > least(1, stays_on(p_skill, p_rod_ql, p_bait is not null, pk(p_mul, 'hook:fish', 0)) * deep_catch()) then null
    else pick_deep_fish(p_depth, p_skill, p_bait, random(), p_mul)
    end
$fn$;
-- A deep-water fish comes from a boat only.
create or replace function fish_here(p_depth double precision, p_skill double precision) returns setof fish_def language sql stable as $fn$
  select * from fish_def where not deep and p_depth >= depth and p_skill >= level
$fn$;

-- The hold of a boat at somebody's helm: her own, and the share more of it the Sailing at her helm makes (`cargo_room`),
-- in whole things, so that a helm at the Sailing everybody starts at adds none.
create or replace function furniture_capacity(p placed) returns integer language plpgsql stable as $fn$
declare v int;
begin
  v := room_for(coalesce((select coalesce(capacity, hive, pond, 0) from furniture_def where id = p.sub), 0)
    * mat_hold(p.material) * mark_of(p.mark, 'hold') * room_mul(p.enchant), p.rare);
  if p.driver is not null and is_boat(p) then
    v := v + floor(v * (cargo_room(skill_of(p.world_id, p.driver, sailing_skill())) - 1))::int;
  end if;
  return v;
end $fn$;

/* ---- the two jobs: sounding the depth, and fitting a rigging set ---------------------------------------------------- */

create or replace function sail_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare p placed; v_in placed;
begin
  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint and kind = 'furniture';
  v_in := afloat_in(p_world, p_uid);
  if p_action = sound_depth_action() then
    if p.id is null or not is_boat(p) or v_in.id is distinct from p.id then return sail_said_not_afloat(); end if;
    return null;
  end if;
  -- Fitting a rigging set.
  if p.id is null or not coalesce((select b.sail from boat_def b where b.id = p.sub), false) then return sail_said_no_sail(); end if;
  if hull_rigged(p) then return sail_said_rigged(); end if;
  if pack_count(p_world, p_uid, rigging_set_item()) < 1 then return sail_said_no_set(); end if;
  if v_in.id is distinct from p.id and not near_piece(p_world, p_uid, p) then return sail_said_far(); end if;
  return null;
end $fn$;

create or replace function perform_sail(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void language plpgsql as $fn$
declare p placed; pl player; v_n int := 0; v_lo double precision; v_hi double precision; dx int; dy int; d double precision;
        r int := sound_reach()::int;
begin
  if sail_refusal(p_world, p_uid, p_action, p_target) is not null then
    perform tell(p_world, p_uid, sail_refusal(p_world, p_uid, p_action, p_target), 'error');
    return;
  end if;
  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if p_action = sound_depth_action() then
    select * into pl from player where world_id = p_world and uid = p_uid;
    for dy in -r .. r loop
      for dx in -r .. r loop
        continue when sqrt((dx * dx + dy * dy)::double precision) > r;
        continue when floor(pl.x)::int + dx < 0 or floor(pl.y)::int + dy < 0
                   or floor(pl.x)::int + dx >= (select size from world where id = p_world)
                   or floor(pl.y)::int + dy >= (select size from world where id = p_world);
        d := water_depth(p_world, floor(pl.x)::int + dx, floor(pl.y)::int + dy);
        continue when d <= 0;
        v_n := v_n + 1;
        v_lo := least(coalesce(v_lo, d), d);
        v_hi := greatest(coalesce(v_hi, d), d);
      end loop;
    end loop;
    perform skill_raise(p_world, p_uid, sailing_skill(), sound_learn());
    perform tell(p_world, p_uid, case when v_n = 0 then 'Sounded: no water within ' || r || ' tiles.'
      else 'Sounded: ' || v_n || ' tiles of water within ' || r || ', ' || metres(v_lo) || ' m to ' || metres(v_hi) || ' m deep. Marked on your map.' end,
      'event');
    return;
  end if;
  -- A rigging set, used up into her rigging, which stays with her through being picked up and set down (her mark).
  if not consume(p_world, p_uid, rigging_set_item(), 1) then return; end if;
  update placed set mark = coalesce(mark, '{}'::jsonb) || jsonb_build_object(rig_mark(), 1) where id = p.id;
  perform skill_raise(p_world, p_uid, sailing_skill(), 1);
  perform land_announce(p_world, p.x, p.y);
  perform tell(p_world, p_uid, 'Rigging fitted: ' || lower(placed_name(p)) || '.', 'event');
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The jobs, on the island.
    ('public', 'act_ported', 1,
     $$      or swirl_action(p_action)$$,
     $$      or swirl_action(p_action)
      -- Sounding the depth and fitting a rigging set (`sailActions.ts`).
      or sail_action(p_action)$$),
    ('public', 'act_refusal_rules', 1,
     $$  if p_action in ('fish', 'drag_net') then
    return fish_refusal(p_world, p_uid, p_action, p_target);$$,
     $$  if sail_action(p_action) then
    return sail_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if p_action in ('fish', 'drag_net') then
    return fish_refusal(p_world, p_uid, p_action, p_target);$$),
    ('public', 'act_perform', 1,
     $$  if last_action(p_action) then$$,
     $$  if sail_action(p_action) then
    perform perform_sail(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if last_action(p_action) then$$),
    -- Her top speed: a reach as the helm sails it, her rigging and her sails.
    ('public', 'travel_speed', 1,
     $$           * sailing_pace(skill_of(p_world, p_uid, sailing_skill())) * (1 + placed_enchant(p, 'sail'));$$,
     $$           * sailing_pace(skill_of(p_world, p_uid, sailing_skill())) * (1 + placed_enchant(p, 'sail'))
           -- Under sail: a reach as the helm sails it, her rigging and her sails' QL (`sailing.ts`).
           * case when coalesce((select b.sail from boat_def b where b.id = p.sub), false)
                  then beam_pace(skill_of(p_world, p_uid, sailing_skill()))
                       * case when hull_rigged(p) then 1 + rigging_pace() else 1 end * mark_of(p.mark, sails_mark())
                  else 1 end;$$),
    -- What a tile teaches, and what a gale does to a hull.
    ('public', 'rpc_move', 1,
     $$                            case when is_boat(cart) then sailing_learn() else driving_learn() end);
      end loop;$$,
     $$                            case when is_boat(cart) then sailing_learn() * sail_learn_mul(p_world, me, cart, p.x, p.y, p_x, p_y)
                                 else driving_learn() end);
      end loop;
      -- And a hull below Sailing 30 takes damage in a gale (`sail_gale_damage`).
      if is_boat(cart) then perform sail_gale_damage(p_world, me, cart.id, v_tiles); end if;$$),
    -- A rowing boat does not put out in a gale.
    ('public', 'ride_refusal', 1,
     $$    -- A hull asks nothing but that she is still floating.
    if is_boat(p) then
$$,
     $$    -- A rowing boat does not put out in a gale (`sailing.ts`).
    if is_boat(p) and not coalesce((select b.sail from boat_def b where b.id = p.sub), false)
       and is_gale((world_wind(p_world)).force) then
      return gale_row_said();
    end if;
    -- A hull asks nothing but that she is still floating.
    if is_boat(p) then
$$),
    -- Her sails: the QL of the sailcloth she was built with.
    ('public', 'perform_craft', 1,
     $$        v_rope double precision;$$,
     $$        v_rope double precision; v_sail double precision;$$),
    ('public', 'perform_craft', 1,
     $$  if coalesce(r.rope_share, 0) > 0 then v_rope := rope_ql(p_world, p_uid, p_recipe, prefer, mat); end if;$$,
     $$  if coalesce(r.rope_share, 0) > 0 then v_rope := rope_ql(p_world, p_uid, p_recipe, prefer, mat); end if;
  -- And a hull's sailcloth, for her sails' pace (`sail_ql_pace`).
  if exists (select 1 from boat_def b where b.id = r.result)
     and exists (select 1 from recipe_input ri where ri.recipe = p_recipe and ri.item = 'sailcloth') then
    select st.ql into v_sail from craft_stock(p_world, p_uid, prefer) st
     where st.def = 'sailcloth' order by (st.id = prefer) desc, st.draw limit 1;
  end if;$$),
    ('public', 'perform_craft', 1,
     $$  v_mark := nullif(v_mark, '{}'::jsonb);$$,
     $$  if v_sail is not null then v_mark := coalesce(v_mark, '{}'::jsonb) || jsonb_build_object(sails_mark(), sail_ql_pace(v_sail)); end if;
  v_mark := nullif(v_mark, '{}'::jsonb);$$),
    -- Fishing from a boat over deep water.
    ('public', 'perform_fish', 1,
     $$    got := catch_fish(spot.depth, skill, rod_ql, bait, v_mul);$$,
     $$    -- From a boat over deep water: deep-water fish only, each staying on `deep_catch` times as well (`sailing.ts`).
    got := case when afloat_deep(p_world, p_uid, spot.depth) then catch_deep_fish(spot.depth, skill, rod_ql, bait, v_mul)
                else catch_fish(spot.depth, skill, rod_ql, bait, v_mul) end;$$),
    ('public', 'perform_fish', 1,
     $$    for i in 1..haul loop$$,
     $$    -- And a net cast from a boat over deep water hauls `deep_net` times as much, the share over a whole fish a chance at one more.
    if afloat_deep(p_world, p_uid, spot.depth) then
      v_more := haul * deep_net();
      haul := floor(v_more)::int + case when random() < v_more - floor(v_more) then 1 else 0 end;
    end if;
    for i in 1..haul loop$$),
    ('public', 'fish_refusal', 1,
     $$    if not exists (select 1 from fish_here(spot.depth, skill)) then
      return 'No fish here at your fishing skill.';$$,
     $$    if (case when afloat_deep(p_world, p_uid, spot.depth) then not exists (select 1 from deep_fish_here(spot.depth, skill))
             else not exists (select 1 from fish_here(spot.depth, skill)) end) then
      return 'No fish here at your fishing skill.';$$)
  ) as t(sch, fn, times, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
