-- A Vesp works its hive as bees work a skep.
--
-- Asked: "Implement that Vesp work hives like bees for their deed trade, producing honey". A Vesp set to work a
-- settlement went to a hive and stood there, and the hive filled at a flat rate of comb a second for every swarm on
-- the settlement (`hive_sweep`), whatever was in flower. Now, trip by trip, as `vespTrip` in the browser:
--
--   * it takes the nearest hive with room within its range of the token, and of the tiles within `skep_reach` of the
--     hive that are in flower (`flowers_on`, as a skep counts them), the next in its turn: in rows from the corner,
--     its goes today (its ledger's) on from the first (`vesp_trip`);
--   * it flies out to that tile, works the flower a go (learning as any go, the go and its stamina on its ledger),
--     and flies back with what it gathered, at the quality of its skill (`worker_do`);
--   * into the hive goes what a skep there would have made over the trip, set off to set off again: `skep_clump_hours`
--     hours a honey for each clump within `skep_reach` of the hive, nothing in `skep_idle`, and a beeswax with every
--     `skep_wax_every`th honey (`vesp_put`); the whole honey and beeswax it makes on its ledger;
--   * with nothing to do it says why: no hive in range (`range`), every hive in range full (`room`), `skep_idle`
--     (`season`), or no wildflowers within `skep_reach` of a hive with room (`flowers`).
--
-- A Vesp following you fills no hive now: at a flat comb a second it made a hundred times what one at work does. So
-- `hive_sweep` goes, with its constants. And a picker of wildflowers leaves a hive's flowers to it, as a skep's.
set local lock_timeout = '3s';

/* ---- where it goes ----------------------------------------------------------------------------------------- */

-- Where a Vesp at `p_cx, p_cy` goes next, working a site at `p_x, p_y` to `p_radius` tiles, on its `p_turn`th go of
-- the day, at `p_at`: the hive's tile and the flower's; or why it goes nowhere, with its number (`vespTrip`).
create or replace function vesp_trip(p_world uuid, p_cx double precision, p_cy double precision, p_x int, p_y int,
                                     p_radius int, p_turn int, p_at timestamptz)
  returns table (hx int, hy int, fx int, fy int, why text, n int) language plpgsql stable as $fn$
declare h placed; v_room boolean := false; v_r int := skep_reach(); v_xs int[]; v_ys int[]; tx int; ty int; v_k int;
begin
  if not exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = 'hive'
                   and pl.crumbles_at is null and greatest(abs(pl.x - p_x), abs(pl.y - p_y)) <= p_radius) then
    return query select null::int, null::int, null::int, null::int, 'range'::text, p_radius;
    return;
  end if;
  if season_at(p_at) = skep_idle() then
    return query select null::int, null::int, null::int, null::int, 'season'::text, 0;
    return;
  end if;
  for h in select pl.* from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = 'hive'
             and pl.crumbles_at is null and greatest(abs(pl.x - p_x), abs(pl.y - p_y)) <= p_radius
           order by (pl.cx - p_cx) ^ 2 + (pl.cy - p_cy) ^ 2, pl.id
  loop
    continue when furniture_capacity(h) - furniture_units(h) <= 0;
    v_room := true;
    v_xs := '{}'; v_ys := '{}';
    for ty in h.y - v_r .. h.y + v_r loop
      for tx in h.x - v_r .. h.x + v_r loop
        if in_bounds(p_world, tx, ty) and coalesce(flowers_on(p_world, tx, ty, p_at), 0) > 0 then
          v_xs := v_xs || tx;
          v_ys := v_ys || ty;
        end if;
      end loop;
    end loop;
    if cardinality(v_xs) > 0 then
      v_k := p_turn % cardinality(v_xs) + 1;
      return query select h.x, h.y, v_xs[v_k], v_ys[v_k], null::text, null::int;
      return;
    end if;
  end loop;
  return query select null::int, null::int, null::int, null::int,
    case when v_room then 'flowers' else 'room' end, case when v_room then v_r else 0 end;
end $fn$;

/* ---- what it brings ---------------------------------------------------------------------------------------- */

-- Honey off a trip of `p_secs` seconds with so many clumps in reach of the hive in a season: a skep's (`vespHoney`).
create or replace function vesp_honey(p_flowers int, p_season text, p_secs double precision) returns double precision
  language sql immutable as $fn$
  select case when p_season = skep_idle() then 0 else p_flowers / skep_clump_hours() end * p_secs / skep_hour()
$fn$;

-- What a Vesp brought, into its hive (`hiveTakes`, `Game.hivePut`): onto the honey it has toward its next whole one,
-- at the quality of all of it together; every whole honey while it has room, and a beeswax with every
-- `skep_wax_every`th it has made; what is left waits for the next trip, no more than a honey of it while the hive is
-- full. The whole honey and beeswax made, in that order.
create or replace function vesp_put(p_world uuid, p_hive bigint, p_honey double precision, p_ql double precision)
  returns int[] language plpgsql as $fn$
declare h placed; v_was double precision; v_part double precision; v_q double precision; v_room int; v_honeys int;
        v_made int := 0; v_wax int := 0; v_def text; v_n int; v_id bigint; fresh item;
begin
  select * into h from placed where world_id = p_world and id = p_hive for update;
  if not found then return array[0, 0]; end if;
  v_was := coalesce((h.state->>'nectar')::double precision, 0);
  v_part := v_was + p_honey;
  v_q := case when v_part > 0 then (coalesce((h.state->>'nectar_ql')::double precision, p_ql) * v_was + p_ql * p_honey) / v_part
              else p_ql end;
  v_room := furniture_capacity(h) - furniture_units(h);
  v_honeys := coalesce((h.state->>'honeys')::int, 0);
  while v_part >= 1 and v_room > 0 loop
    v_part := v_part - 1;
    v_made := v_made + 1;
    v_room := v_room - 1;
    v_honeys := v_honeys + 1;
    if v_honeys % skep_wax_every() = 0 and v_room > 0 then
      v_wax := v_wax + 1;
      v_room := v_room - 1;
    end if;
  end loop;
  -- Onto a pile of the same in the hive, as anything put in is.
  foreach v_def in array array['honey', 'wax'] loop
    v_n := case v_def when 'honey' then v_made else v_wax end;
    continue when v_n = 0;
    fresh.def := v_def; fresh.extra := null; fresh.rare := null; fresh.maker := null; fresh.piece := null;
    fresh.locked := false; fresh.lit := false; fresh.issued := false;
    v_id := null;
    select i.id into v_id from item i
     where i.world_id = p_world and i.holder = 'furniture' and i.placed = h.id and i.def = v_def
       and stack_key(i) = stack_key(fresh)
     order by i.id limit 1;
    if v_id is not null then
      update item set ql = (ql * count + least(100, greatest(1, v_q)) * v_n) / (count + v_n), count = count + v_n where id = v_id;
    else
      insert into item (world_id, holder, placed, def, ql, count) values (p_world, 'furniture', h.id, v_def, least(100, greatest(1, v_q)), v_n);
    end if;
  end loop;
  update placed set state = coalesce(state, '{}'::jsonb)
      || jsonb_build_object('nectar', least(v_part, 1), 'nectar_ql', v_q, 'honeys', v_honeys)
    where id = h.id;
  return array[v_made, v_wax];
end $fn$;

/* ---- its day --------------------------------------------------------------------------------------------------- */

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- Its go at the flower: what it flies back with, at the quality of its skill, as any gathered load (`finishNectar`).
    (1, 'worker_do', array[$a$  perform worker_learn(p_world, p_id, skill_id, 0.225);
  if kind = 'hive' then return null; end if;
  made_ql := least(100, greatest(1, skill * (0.6 + random() * 0.8) + 1) * careful);
$a$], array[$a$  perform worker_learn(p_world, p_id, skill_id, 0.225);
  made_ql := least(100, greatest(1, skill * (0.6 + random() * 0.8) + 1) * careful);
  -- A Vesp's go at a flower: honey in its arms for its hive, how much the trip's (`vesp_put`).
  if kind = 'hive' then return jsonb_build_object('def', 'honey', 'count', 0, 'ql', made_ql); end if;
$a$], array[1]),
    -- A picker of wildflowers leaves a hive's to it, as a skep's.
    (2, 'worker_gatherable', array[$a$and pl.sub = 'skep'
                         and greatest(abs(pl.x - p_x), abs(pl.y - p_y)) <= skep_reach());$a$],
       array[$a$and pl.sub in ('skep', 'hive')
                         and greatest(abs(pl.x - p_x), abs(pl.y - p_y)) <= skep_reach());$a$], array[1]),
    (3, 'worker_settle', array[
      -- Its hive and its trip.
      $a$v_bed placed; v_sort record; v_spar creature;$a$,
      -- Idle: out to the next flower in reach of its hive (`vesp_trip`), or why not.
      $a$      select * into spot from find_work_tile(p_world, v_site.x, v_site.y, v_site.radius, kind, c);
$a$,
      -- At the flower: when it set off, the go's start less its flight out.
      $a$    elsif c.phase = 'work' then
      update creature set from_x = cx, from_y = cy, to_x = cx, to_y = cy,$a$,
      -- The go done: back to its hive with what it gathered.
      $a$      c.idle_why := null; c.idle_n := null;
      -- Into its arms with what it has gathered already this trip;$a$,
      -- At its hive.
      $a$    elsif c.phase = 'home' then
$a$],
    array[
      $a$v_bed placed; v_sort record; v_spar creature; v_hive placed; v_trip record; v_made int[];$a$,
      $a$      -- A Vesp: out from the nearest hive in its range with room to the next flower in reach of it, or why not
      -- (`vesp_trip`). Nothing to do is said, an hour of no hive is told, and it waits, as any worker with none.
      if kind = 'hive' then
        select * into v_trip from vesp_trip(p_world, cx, cy, v_site.x, v_site.y, v_site.radius,
          coalesce((ledger_roll(c.ledger, v_day)->'now'->>'goes')::int, 0), c.until);
        if v_trip.why is null then
          c.work_x := v_trip.hx; c.work_y := v_trip.hy;
          c.idle_since := null; c.idle_why := null; c.idle_n := null;
          ax := v_trip.fx + 0.5; ay := v_trip.fy + 0.5;
          dist := sqrt((ax - cx) ^ 2 + (ay - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := ax; c.to_y := ay;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'out';
          continue;
        end if;
        c.idle_since := coalesce(c.idle_since, now()); c.idle_why := v_trip.why; c.idle_n := v_trip.n;
        if v_trip.why = 'range' then
          perform worker_idle(p_world, c, kind, v_site.x, v_site.y, v_site.radius, v_site.post);
        end if;
        c.from_x := cx; c.from_y := cy;
        c.to_x := v_site.x + 0.5 + (hash_tile(p_id, guard, 601) * 2 - 1) * 3;
        c.to_y := v_site.y + 0.5 + (hash_tile(p_id, guard, 701) * 2 - 1) * 3;
        if not creature_tile_ok(p_world, floor(c.to_x)::int, floor(c.to_y)::int) then
          c.to_x := cx; c.to_y := cy;
        end if;
        dist := sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2);
        c.leg_at := now();
        c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
        c.until := c.leg_ends + worker_rest(c.idle_since);
        exit;
      end if;
      select * into spot from find_work_tile(p_world, v_site.x, v_site.y, v_site.radius, kind, c);
$a$,
      $a$    elsif c.phase = 'work' then
      -- A Vesp at a flower: the moment it set off from its hive, the go's start less its flight out (`tripAt`).
      if kind = 'hive' then
        secs := extract(epoch from c.leg_at) - greatest(0.2, sqrt((cx - c.from_x) ^ 2 + (cy - c.from_y) ^ 2) / greatest(0.1, pace));
      end if;
      update creature set from_x = cx, from_y = cy, to_x = cx, to_y = cy,$a$,
      $a$      c.idle_why := null; c.idle_n := null;
      -- A Vesp flies back to its hive with what it gathered, and when it set off; its hive gone, that is lost.
      if kind = 'hive' then
        select * into v_hive from placed h where h.world_id = p_world and h.kind = 'furniture' and h.sub = 'hive'
           and h.x = c.work_x and h.y = c.work_y and h.crumbles_at is null order by h.id limit 1;
        if load is null or v_hive.id is null then
          c.carrying := null;
          c.phase := 'idle';
          c.leg_at := c.until; c.leg_ends := c.until;
          c.until := c.until + make_interval(secs => vesp_rest());
        else
          c.carrying := load || jsonb_build_object('since', secs);
          dist := sqrt((v_hive.cx - cx) ^ 2 + (v_hive.cy - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := v_hive.cx; c.to_y := v_hive.cy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'home';
        end if;
        continue;
      end if;
      -- Into its arms with what it has gathered already this trip;$a$,
      $a$    elsif c.phase = 'home' and kind = 'hive' then
      /*
       * A Vesp at its hive with what it gathered (`vespHome`): as much honey as a skep there would have made from
       * when it set off to when it sets off again, `vesp_rest` after this, into the hive (`vesp_put`); the whole
       * honey and beeswax that made, on its ledger. Its hive gone, what it gathered is lost.
       */
      select * into v_hive from placed h where h.world_id = p_world and h.kind = 'furniture' and h.sub = 'hive'
         and h.x = c.work_x and h.y = c.work_y and h.crumbles_at is null order by h.id limit 1;
      if v_hive.id is not null and c.carrying ? 'since' then
        if sqrt((v_hive.cx - cx) ^ 2 + (v_hive.cy - cy) ^ 2) > 1.6 then
          dist := sqrt((v_hive.cx - cx) ^ 2 + (v_hive.cy - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := v_hive.cx; c.to_y := v_hive.cy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          continue;
        end if;
        v_made := vesp_put(p_world, v_hive.id,
          vesp_honey(skep_flowers(p_world, v_hive.x, v_hive.y, c.until), season_at(c.until),
                     extract(epoch from c.until) - (c.carrying->>'since')::double precision + vesp_rest()),
          (c.carrying->>'ql')::double precision);
        if v_made[1] > 0 then
          perform away_count(p_world, c.keeper, 'haul', 'honey', v_made[1]::bigint);
          c.ledger := ledger_add(c.ledger, v_day, 0, 0, 'honey', v_made[1]);
        end if;
        if v_made[2] > 0 then
          perform away_count(p_world, c.keeper, 'haul', 'wax', v_made[2]::bigint);
          c.ledger := ledger_add(c.ledger, v_day, 0, 0, 'wax', v_made[2]);
        end if;
      end if;
      c.carrying := null;
      c.phase := 'idle';
      c.leg_at := c.until; c.leg_ends := c.until;
      c.until := c.until + make_interval(secs => vesp_rest());

    elsif c.phase = 'home' then
$a$],
    array[1, 1, 1, 1, 1]),
    -- A Vesp following you fills no hive: the flat comb a second is gone.
    (4, 'world_tick', array[$a$        -- And the hives, filling with honey and wax for the swarms kept by them.
        perform hive_sweep(w.id);
$a$], array[''], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of change %.%, not %', r.fn, v_n, r.ord, i, r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

drop function if exists hive_sweep(uuid);
drop function if exists hive_rate(double precision);
drop function if exists hive_base();
drop function if exists hive_per_ql();
drop function if exists hive_swarms();
drop function if exists hive_wax();

revoke all on function vesp_trip(uuid, double precision, double precision, int, int, int, int, timestamptz) from public, anon, authenticated;
revoke all on function vesp_honey(int, text, double precision) from public, anon, authenticated;
revoke all on function vesp_put(uuid, bigint, double precision, double precision) from public, anon, authenticated;

select private.lock_doors();
