/*
 * A stoker burns tar first, never overfills, and from its second stage works the smelters.
 *
 * Asked for: "Slugember needs to prioritize tar, peat, and coal for fueling fires and shelters etc. Slugember should
 * also load raw ore into smelters and Take What Is Done." And: "Make sure that slugember isnt loading more fuel than is
 * required."
 *
 *   * Tar is a fuel (`FUELS`, so `fuel_value` and `fuel_said` in the definitions beside this): every fire, smelter,
 *     kiln, oven and brazier takes it, from a person as from a stoker.
 *   * A stoker fetches the best fuel there is out of all your settlement stores, crates and furniture alike
 *     (`stoke_fuel`): tar, then peat, then coal, then any other (`stoke_rank`), from the store nearest it holding that.
 *     It used to take whatever lay first in the first crate.
 *   * It tends ovens and braziers as well as campfires, smelters and kilns (`stoke_hearth`), each to its own capacity
 *     (`stoke_room`); a brazier is fed and left to light itself after dark (`brazier_sweep`).
 *   * No more than fits: a hearth is tended only under its full mark (`hearth_full`), the fuel fetched is the best a
 *     whole piece of fits, as many whole pieces as fit and its stage carries (`errand_fetch_n`), and only whole pieces
 *     that fit go in (`errand_do`). What is left in its arms goes on to the next hearth with room for it, or back to
 *     the stores (`errand_step`). It was at least one piece, fed up to the fire's capacity and the rest lost; and fuel
 *     with no cold hearth left to take it stood in its arms for good.
 *   * A hearth another of your workers is carrying fuel to is left to that one.
 *   * From `stoke_smelts_at()` (its second stage: a Slugember, a Slugferno), with no hearth to fuel or no fuel for
 *     it, it does a smelter worker's work: what your smelters have made, out into the stores, and then ore out of the
 *     stores into them. That is the smelter worker's own step and go, asked for by name: `errand_step` and `errand_do`
 *     take the trade to work as (`p_kind`), and default to the species' own as before.
 *
 * The browser's `stokeStep`, `stokeFuel`, `coldHearth`, `feedFire` and `stokeSmelt` (`creatures.ts`).
 */
set local lock_timeout = '3s';

/** What a hearth holds of fuel, for a stoker: an oven's or a brazier's own (`hearth_capacity`), else a fire's. */
create or replace function stoke_room(p placed) returns double precision language sql stable as $fn$
  select case when is_oven(p) then hearth_capacity(p) else fire_capacity() end
$fn$;

/**
 * The hearth a stoker tends: a campfire, smelter, kiln, oven or brazier within `p_range` of (`p_cx`, `p_cy`), under
 * `hearth_full()`, nearest first; with `p_def`, only one with room for a whole piece of it; with `p_others`, not one
 * another of the keeper's workers is carrying fuel to. The browser's `coldHearth`.
 */
create or replace function stoke_hearth(p_world uuid, c creature, p_def text, p_cx int, p_cy int, p_range int, p_others boolean default true)
returns placed language sql stable as $fn$
  select p.* from placed p
   where p.world_id = p_world
     and p.x between p_cx - p_range and p_cx + p_range and p.y between p_cy - p_range and p_cy + p_range
     and (p.kind in ('campfire', 'smelter', 'kiln') or is_oven(p))
     and placed_fuel(p) < hearth_full()
     and (p_def is null or stoke_room(p) - placed_fuel(p) >= fuel_value(p_def))
     and not (p_others and exists (
       select 1 from creature o
        where o.world_id = p_world and o.keeper = c.keeper and o.id <> c.id and o.mode = 'deed'
          and o.work_x = p.x and o.work_y = p.y and fuel_value(o.carrying->>'def') is not null))
   order by (p.x - p_cx) ^ 2 + (p.y - p_cy) ^ 2, p.id limit 1
$fn$;

/**
 * The fuel a stoker fetches for a hearth with `p_room` seconds of room: the best by `stoke_rank` a whole piece of
 * fits, out of whichever of the keeper's settlement stores holds it nearest (`p_x`, `p_y`). The browser's `stokeFuel`.
 */
create or replace function stoke_fuel(p_world uuid, c creature, p_room double precision, p_x double precision, p_y double precision)
returns table(def text, kind text, sid bigint, x int, y int, cx double precision, cy double precision) language sql stable as $fn$
  select (s.it).def, s.kind, s.sid, s.x, s.y, s.cx, s.cy from deed_store_items(p_world, c.keeper) s
   where fuel_value((s.it).def) <= p_room and (s.it).count > 0 and not coalesce((s.it).locked, false)
   order by stoke_rank((s.it).def), (s.cx - p_x) ^ 2 + (s.cy - p_y) ^ 2, s.sid, (s.it).id limit 1
$fn$;

do $do$
declare r record; f record; v_def text; v_n int;
begin
  for f in select * from (values
    (1, 'errand_step', 'errand_step(uuid,integer)'),
    (2, 'errand_do', 'errand_do(uuid,integer,boolean)'),
    (3, 'errand_fetch_n', null)
  ) as t(ord, fn, old_sig) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = f.fn;
    if v_def is null then raise exception '% is not on this island', f.fn; end if;
    for r in select * from (values
      -- The trade to work as, asked for by name: a stoker's smelter work is the smelter worker's step.
      (1, 'errand_step', 'errand_step(p_world uuid, p_id integer)',
          'errand_step(p_world uuid, p_id integer, p_kind text DEFAULT NULL::text)', 1),
      (2, 'errand_step', $$  kind := d.gathers;
  rng := work_range(c);$$, $$  kind := coalesce(p_kind, d.gathers);
  rng := work_range(c);$$, 1),
      (3, 'errand_step', $$  elsif kind = 'stoke' then
    v_hearth := cold_hearth(p_world, dd.x, dd.y, rng);
    if v_hearth.id is null then why := 'range'; why_n := rng; return next; return; end if;
    if c.carrying is null then
      v_store := fuel_in_stores(p_world, c.keeper);
      if v_store.id is null then why := 'stock'; why_n := null; return next; return; end if;
      select * into v_crate from crate where world_id = p_world and id = v_store.crate;
      gx := crate_centre_x(v_crate); gy := crate_centre_y(v_crate);
      want := v_store.def; wx := v_crate.x; wy := v_crate.y;
    else
      gx := v_hearth.cx; gy := v_hearth.cy;
      want := null; wx := v_hearth.x; wy := v_hearth.y;
    end if;
    return next;
    return;
$$, $$  elsif kind = 'stoke' then
    if c.carrying is not null then
      -- Ore, at a stage that charges smelters: the smelter worker's step, into a smelter with room or back to the stores.
      if fuel_value(c.carrying->>'def') is null and stage_of(c) >= stoke_smelts_at() then
        return query select * from errand_step(p_world, p_id, 'smelt');
        return;
      end if;
      -- Fuel: to the nearest hearth with room for a whole piece of it; none, back to the nearest store with room.
      v_hearth := stoke_hearth(p_world, c, c.carrying->>'def', dd.x, dd.y, rng);
      if v_hearth.id is null then
        select * into v_spot from worker_store(p_world, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
        if v_spot.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_spot.cx; gy := v_spot.cy; want := null; wx := floor(v_spot.cx)::int; wy := floor(v_spot.cy)::int;
      else
        gx := v_hearth.cx; gy := v_hearth.cy; want := null; wx := v_hearth.x; wy := v_hearth.y;
      end if;
      return next;
      return;
    end if;
    -- Empty-handed: the best fuel a whole piece of fits, for the nearest hearth under its full mark (`stoke_fuel`).
    v_hearth := stoke_hearth(p_world, c, null, dd.x, dd.y, rng);
    select * into v_spot from stoke_fuel(p_world, c, case when v_hearth.id is null then -1 else stoke_room(v_hearth) - placed_fuel(v_hearth) end,
                                         c.to_x, c.to_y);
    if v_hearth.id is null or v_spot.def is null then
      -- From its second stage, the smelter worker's step; with no hearth wanting fuel, its reason for none too.
      if stage_of(c) >= stoke_smelts_at() then
        select * into v_wet from errand_step(p_world, p_id, 'smelt');
        if v_wet.gx is not null or v_hearth.id is null then
          gx := v_wet.gx; gy := v_wet.gy; want := v_wet.want; wx := v_wet.wx; wy := v_wet.wy;
          why := v_wet.why; why_n := v_wet.why_n; why_what := v_wet.why_what;
          return next;
          return;
        end if;
      end if;
      if v_hearth.id is null then why := 'range'; why_n := rng; else why := 'stock'; why_n := null; end if;
      return next;
      return;
    end if;
    gx := v_spot.cx; gy := v_spot.cy; want := v_spot.def; wx := v_spot.x; wy := v_spot.y;
    return next;
    return;
$$, 1),
      (4, 'errand_do', 'errand_do(p_world uuid, p_id integer, p_again boolean DEFAULT false)',
          'errand_do(p_world uuid, p_id integer, p_again boolean DEFAULT false, p_kind text DEFAULT NULL::text)', 1),
      (5, 'errand_do', $$  kind := d.gathers;
  select g.skill into skill_id$$, $$  kind := coalesce(p_kind, d.gathers);
  select g.skill into skill_id$$, 1),
      (6, 'errand_do', $$  elsif kind = 'stoke' then
    if c.carrying is null then return false; end if;
    v_hearth := cold_hearth(p_world, c.work_x, c.work_y, 0);
    if v_hearth.id is null then return false; end if;
    perform placed_settle(v_hearth.id);
    v_per := fuel_value(c.carrying->>'def');
    if v_per is null then
      update creature set carrying = null where world_id = p_world and id = p_id;
      return false;
    end if;
    -- Fed, and lit if it had gone out: a stoker's whole job is that nothing
    -- on the deed is ever cold when somebody comes back to it.
    update placed set fuel = least(fire_capacity(), placed_fuel(placed) + v_per * coalesce((c.carrying->>'count')::int, 1)),
        ash = placed_ash(placed), lit = true, since = now()
      where id = v_hearth.id;
    update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$  elsif kind = 'stoke' then
    -- Empty-handed or holding ore, at a stage that charges smelters: the smelter worker's go.
    if c.carrying is null or fuel_value(c.carrying->>'def') is null then
      if stage_of(c) >= stoke_smelts_at() then return errand_do(p_world, p_id, p_again, 'smelt'); end if;
      if c.carrying is null then return false; end if;
    end if;
    v_per := fuel_value(c.carrying->>'def');
    v_hearth := stoke_hearth(p_world, c, c.carrying->>'def', c.work_x, c.work_y, 0, false);
    if v_hearth.id is null or v_per is null then
      -- No hearth here with room for a piece of it: into the store it walked to, or the nearest with room. A load
      -- carried back, not made (`private.worker_put_back`).
      perform private.worker_put_back(p_world, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1),
                         coalesce((c.carrying->>'ql')::double precision, 20), c.work_x, c.work_y, c.carrying->>'extra');
      update creature set carrying = null where world_id = p_world and id = p_id;
      return true;
    end if;
    perform placed_settle(v_hearth.id);
    select * into v_hearth from placed where id = v_hearth.id;
    -- Whole pieces that fit, and no more; the rest stay in its arms for the next hearth or the stores (`errand_step`).
    v_k := least(coalesce((c.carrying->>'count')::int, 1), floor((stoke_room(v_hearth) - placed_fuel(v_hearth)) / v_per)::int);
    if v_k < 1 then return false; end if;
    -- Fed, and lit if it had gone out; a brazier lights itself after dark (`brazier_sweep`).
    update placed set fuel = placed_fuel(placed) + v_per * v_k,
        ash = placed_ash(placed), lit = lit or not is_brazier(placed), since = now()
      where id = v_hearth.id;
    update creature set carrying = load_less(carrying, v_k) where world_id = p_world and id = p_id;
$$, 1),
      (7, 'errand_fetch_n', $$    v_h := cold_hearth(p_world, dd.x, dd.y, work_range(c));
    if v_h.id is null or coalesce(fuel_value(c.fetching), 0) <= 0 then return 1; end if;
    return greatest(1, least(n, floor((fire_capacity() - placed_fuel(v_h)) / fuel_value(c.fetching))::int));$$,
          $$    v_h := stoke_hearth(p_world, c, c.fetching, dd.x, dd.y, work_range(c));
    if v_h.id is null or coalesce(fuel_value(c.fetching), 0) <= 0 then return 1; end if;
    return greatest(1, least(n, floor((stoke_room(v_h) - placed_fuel(v_h)) / fuel_value(c.fetching))::int));$$, 1)
    ) as t(ord, fn, old, new, n) where t.fn = f.fn order by ord loop
      v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
      if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
      v_def := replace(v_def, r.old, r.new);
    end loop;
    -- A new argument is a new function: the old one goes, or every call to it would be ambiguous.
    if f.old_sig is not null then execute 'drop function ' || f.old_sig; end if;
    execute v_def;
  end loop;
end $do$;

-- Nothing calls these now: `stoke_hearth` and `stoke_fuel` do what they did.
drop function if exists cold_hearth(uuid, integer, integer, integer);
drop function if exists fuel_in_stores(uuid, uuid);

select private.lock_doors();
