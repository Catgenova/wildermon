-- Volcano Isle's labyrinth of lava, one of ten laid each dawn, and the heat of being up there.
--
-- Asked for: a labyrinth of lava on Volcano Isle, "radius 500, with only 3 true paths from exterior to interior. 10
-- designs, one of which chosen randomly daily", and a heat meter to prepare for (`src/game/lava.ts` says the same rules
-- in the browser's words and numbers; `src/world/lavaland.ts` the ground's half).
--
-- Round the caldera (`lava_centre`), out to `lava_radius` tiles on Volcano Isle's land kept in from the water
-- (`lava_chart_rows`, off the survey chart), the ground is cut into blocks of `lava_cell` tiles: rooms, walls between
-- them and pillars where walls meet. Each design's three rays (`lava_rays`) part the labyrinth into wedges; each wedge's
-- rooms are joined into trees by Kruskal's rule over walls weighed by `hash_tile(wall, lava_wall_salt + design)`, and
-- one room of each opened to the heart (`lava_heart` round the centre, never lava) and one, in its tree, to the land
-- outside: three ways in, each the only way through. A design is the same for every world of a size, worked out once
-- (`lava_design_make`) and kept a row of blocks at a time (`lava_design`); the world's seed and the day pick which lies
-- (`lava_design_of`), never the same two days running, kept a day at a time in `lava_day` (`lava_ready`, on the clock,
-- today's and tomorrow's). So `lava_at` is a lookup: the day's design, one row's byte, and what spares the tile.
--
-- A block holding a lair's piece or a seryll seam, inside a wedge, opens into its own tree (`lava_must_reach`). A tile is
-- never lava on water, a settlement, a road or laid path, a building, a foundation or anything set down (`lava_spared`).
-- On it: `lava_burn` of your health a second (`body_settle`), nothing dug, built, set down or founded
-- (`lava_ground_refusal`), and no creature steps onto it (`creature_tile_ok`).
--
-- The heat, held on the player (`stats.heat`) and settled with the body: filling at `heat_fill` a second in the heat
-- (`lava_heat_on`: the labyrinth's reach, Volcano Isle at `lava_foot` and up), `heat_near` times that beside lava,
-- `heat_burn` of your health a second when full, draining at `heat_drain` below; slowed by every dragon-scale piece and
-- ice infusion worn and by a cooling draught (`heat_mul`), which also takes `draught_drop` off as it goes down.
--
-- Seryll lies in the labyrinth's heart and nowhere else now (`rockKindFor`); an island founded before that is moved by
-- `tools/move-ground.ts` (`seryllHome`).

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

/* ---- Where it lies --------------------------------------------------------------------------------------------- */

/** The day the labyrinth is laid for at a moment: whole days since the first dawn of 1970 (`lavaDay`). */
create or replace function lava_day_of(p_at timestamptz) returns int language sql immutable as $$
  select floor((extract(epoch from p_at) - tree_dawn_utc() * 3600) / 86400)::int
$$;

/** The centre, the reach and the heart on a world this size, in tiles (`lavaGeometry`). */
create or replace function lava_geometry(p_size int, out cx int, out cy int, out radius int, out heart int) language sql immutable as $$
  select (lava_centre())[1] * p_size / 10000, (lava_centre())[2] * p_size / 10000,
         (2 * lava_radius() * p_size + lava_size()) / (2 * lava_size()), (2 * lava_heart() * p_size + lava_size()) / (2 * lava_size())
$$;

/** The blocks the labyrinth is laid over on a world this size: the first, and how many across and down (`lavaBoxOf`). */
create or replace function lava_box(p_size int, out bxa int, out bya int, out nbx int, out nby int) language sql immutable as $$
  select a.x0, a.y0,
         case when (a.x1 + 3 - a.x0) % 2 = 1 then a.x1 + 3 - a.x0 else a.x1 + 4 - a.x0 end,
         case when (a.y1 + 3 - a.y0) % 2 = 1 then a.y1 + 3 - a.y0 else a.y1 + 4 - a.y0 end
    from (select e.x0 - ((e.x0 % 2) + 2) % 2 as x0, e.y0 - ((e.y0 % 2) + 2) % 2 as y0, e.x1, e.y1
            from (select floor((g.cx - g.radius)::numeric / lava_cell())::int - 2 as x0, floor((g.cy - g.radius)::numeric / lava_cell())::int - 2 as y0,
                         floor((g.cx + g.radius)::numeric / lava_cell())::int as x1, floor((g.cy + g.radius)::numeric / lava_cell())::int as y1
                    from lava_geometry(p_size) g) e) a
$$;

/** Whether a tile is in the labyrinth's box (`lavaInBox`). */
create or replace function lava_in_box(p_size int, p_x int, p_y int) returns boolean language sql immutable as $$
  select p_x >= b.bxa * lava_cell() and p_y >= b.bya * lava_cell() and p_x < (b.bxa + b.nbx) * lava_cell() and p_y < (b.bya + b.nby) * lava_cell()
    from lava_box(p_size) b
$$;

/** A number written in base 36. */
create or replace function lava_b36(p text) returns int language sql immutable as $$
  select coalesce(sum((strpos('0123456789abcdefghijklmnopqrstuvwxyz', substr(p, i, 1)) - 1) * power(36, length(p) - i))::int, 0)
    from generate_series(1, length(p)) i
$$;

/** Whether a tile is within the labyrinth's reach: its radius and `lava_reach_past` more, past which no lava lies (`lavaInReach`). */
create or replace function lava_in_reach(p_size int, p_x int, p_y int) returns boolean language sql immutable as $$
  select (p_x - g.cx)::bigint * (p_x - g.cx) + (p_y - g.cy)::bigint * (p_y - g.cy) <= (g.radius + lava_reach_past())::bigint * (g.radius + lava_reach_past())
    from lava_geometry(p_size) g
$$;

/** The chart's table unpacked: a byte a texel, row by row (`lavaChartAt`'s). */
create or replace function lava_chart_cells() returns bytea language plpgsql immutable as $$
declare v_row text; v_run text; v_out text[] := '{}'; v_line text;
begin
  foreach v_row in array lava_chart_rows() loop
    v_line := '';
    foreach v_run in array string_to_array(v_row, '.') loop
      v_line := v_line || repeat('0' || left(v_run, 1), lava_b36(substr(v_run, 2)));
    end loop;
    v_out := v_out || v_line;
  end loop;
  return decode(array_to_string(v_out, ''), 'hex');
end $$;

/** The day's maze of each island: which design lies (`lava_design_of`), kept by `lava_ready`. */
create table if not exists lava_day (
  world_id uuid not null references world on delete cascade,
  day int not null,
  design int not null,
  primary key (world_id, day)
);
alter table lava_day enable row level security;

/** Each design laid over a world of a size, a row of its blocks at a time: a byte a block (`LB_*`). */
create table if not exists lava_design (
  size int not null,
  design int not null,
  by int not null,
  bytes bytea not null,
  primary key (size, design, by)
);
/** And each design's ways in and out, wedge by wedge, as wall blocks: for the suite and anybody asking. */
create table if not exists lava_design_way (
  size int not null,
  design int not null,
  wedge int not null,
  entrance int[] not null,
  exit int[] not null,
  primary key (size, design, wedge)
);

/**
 * A design laid over a world this size, worked out and kept (`lavaDesign`): rooms sorted and put in wedges, the
 * outside land found from the box's edge, Kruskal's trees within each wedge, each wedge's way out to the heart and in
 * from the land, and every block's byte.
 */
create or replace function lava_design_make(p_size int, p_design int) returns int language plpgsql as $$
declare g record; b record; nrx int; nry int; n int; i int; j int; r int; s int; k int; q int; tx int; ty int; dx bigint; dy bigint;
        v_chart bytea := lava_chart_cells(); f int[] := lava_chart_frame(); v_c int;
        room int[]; wedge int[]; px bigint[]; py bigint[]; outside int[]; up int[]; pass int[]; stack int[]; top int;
        rays int[] := lava_rays(p_design); mids int[] := lava_mids(p_design); ax bigint; ay bigint; cx2 bigint; cy2 bigint;
        walls int[] := '{}'; weights bigint[] := '{}'; a int; bb int; ra int; rb int; v_rec record;
        opened int[] := '{}'; first_in int[]; ex int; en int; u int; v int; bytes int[]; way int; v_n int := 0;
        o1 int; o2 int; o3 int; o4 int; hx bigint; hy bigint;
begin
  if exists (select 1 from lava_design d where d.size = p_size and d.design = p_design) then return 0; end if;
  select * into g from lava_geometry(p_size);
  select * into b from lava_box(p_size);
  nrx := (b.nbx + 1) / 2; nry := (b.nby + 1) / 2; n := nrx * nry;
  room := array_fill(0, array[n]); wedge := array_fill(-1, array[n]); px := array_fill(0::bigint, array[n]); py := array_fill(0::bigint, array[n]);
  -- Each room: off the island, the island's land, the heart, the labyrinth; and its wedge.
  for j in 0 .. nry - 1 loop
    for i in 0 .. nrx - 1 loop
      r := j * nrx + i + 1;
      tx := (b.bxa + 2 * i) * lava_cell() + 1; ty := (b.bya + 2 * j) * lava_cell() + 1;
      dx := tx - g.cx; dy := ty - g.cy;
      px[r] := dx; py[r] := dy;
      a := floor((tx::bigint * f[1])::numeric / p_size)::int - f[2];
      bb := floor((ty::bigint * f[1])::numeric / p_size)::int - f[3];
      v_c := case when a < 0 or bb < 0 or a >= f[4] or bb >= f[5] then 0 else get_byte(v_chart, bb * f[4] + a) end;
      -- The heart's rooms: those the heart reaches into, or into a wall or a pillar round them, so none of it is lava.
      hx := least(greatest(g.cx, tx - 1 - lava_cell()), tx - 2 + 2 * lava_cell()) - g.cx;
      hy := least(greatest(g.cy, ty - 1 - lava_cell()), ty - 2 + 2 * lava_cell()) - g.cy;
      room[r] := case when hx * hx + hy * hy < g.heart * g.heart then 2
                      when v_c = 2 and dx * dx + dy * dy <= g.radius * g.radius then 3
                      when v_c >= 1 then 1 else 0 end;
      continue when room[r] <> 3;
      for k in 0 .. lava_paths() - 1 loop
        ax := rays[2 * k + 1]; ay := rays[2 * k + 2];
        cx2 := rays[2 * ((k + 1) % lava_paths()) + 1]; cy2 := rays[2 * ((k + 1) % lava_paths()) + 2];
        if ax * dy - ay * dx >= 0 and cx2 * dy - cy2 * dx < 0 then wedge[r] := k; end if;
      end loop;
    end loop;
  end loop;
  -- The land outside, joined to the box's edge.
  outside := array_fill(0, array[n]); stack := '{}';
  for r in 1 .. n loop
    i := (r - 1) % nrx; j := (r - 1) / nrx;
    if (i = 0 or j = 0 or i = nrx - 1 or j = nry - 1) and room[r] < 2 then outside[r] := 1; stack := stack || r; end if;
  end loop;
  top := cardinality(stack);
  while top > 0 loop
    r := stack[top]; top := top - 1;
    i := (r - 1) % nrx;
    foreach s in array array[case when i + 1 < nrx then r + 1 else 0 end, case when i > 0 then r - 1 else 0 end,
                             case when r + nrx <= n then r + nrx else 0 end, case when r - nrx >= 1 then r - nrx else 0 end] loop
      continue when s = 0 or outside[s] = 1 or room[s] >= 2;
      outside[s] := 1;
      top := top + 1;
      if top > cardinality(stack) then stack := stack || s; else stack[top] := s; end if;
    end loop;
  end loop;
  -- Kruskal's trees over the walls within a wedge, lightest first.
  for j in 0 .. nry - 1 loop
    for i in 0 .. nrx - 1 loop
      r := j * nrx + i + 1;
      continue when room[r] <> 3;
      if i + 1 < nrx and room[r + 1] = 3 and wedge[r + 1] = wedge[r] then
        walls := walls || (2 * (r - 1));
        weights := weights || floor(hash_tile(b.bxa + 2 * i + 1, b.bya + 2 * j, (lava_wall_salt() + p_design)::bigint) * 4294967296)::bigint;
      end if;
      if j + 1 < nry and room[r + nrx] = 3 and wedge[r + nrx] = wedge[r] then
        walls := walls || (2 * (r - 1) + 1);
        weights := weights || floor(hash_tile(b.bxa + 2 * i, b.bya + 2 * j + 1, (lava_wall_salt() + p_design)::bigint) * 4294967296)::bigint;
      end if;
    end loop;
  end loop;
  up := array(select generate_series(0, n - 1)); pass := array_fill(0, array[n]);
  for k in select w.e from unnest(walls, weights) w(e, wt) order by w.wt, w.e loop
    a := k / 2; bb := case when k % 2 = 0 then a + 1 else a + nrx end;
    ra := a; while up[ra + 1] <> ra loop up[ra + 1] := up[up[ra + 1] + 1]; ra := up[ra + 1]; end loop;
    rb := bb; while up[rb + 1] <> rb loop up[rb + 1] := up[up[rb + 1] + 1]; rb := up[rb + 1]; end loop;
    continue when ra = rb;
    up[ra + 1] := rb;
    pass[a + 1] := pass[a + 1] | case when k % 2 = 0 then 1 else 2 end;
  end loop;
  -- Each wedge's way out to the heart and in from the land outside, in one tree, nearest its middle line.
  for k in 0 .. lava_paths() - 1 loop
    ax := mids[2 * k + 1]; ay := mids[2 * k + 2];
    first_in := array_fill(-1, array[n]);
    for v_rec in
      select t.r from (
        select rr as r, abs(ax * py[rr] - ay * px[rr]) as off, px[rr] * px[rr] + py[rr] * py[rr] as d2
          from generate_series(1, n) rr
         where room[rr] = 3 and wedge[rr] = k and ax * px[rr] + ay * py[rr] > 0
           and lava_beside_room(rr - 1, nrx, nry, room, outside, 1) >= 0) t
       order by t.off, t.d2 desc, t.r
    loop
      ra := v_rec.r - 1; while up[ra + 1] <> ra loop ra := up[ra + 1]; end loop;
      if first_in[ra + 1] < 0 then first_in[ra + 1] := v_rec.r - 1; end if;
    end loop;
    for v_rec in
      select t.r from (
        select rr as r, abs(ax * py[rr] - ay * px[rr]) as off, px[rr] * px[rr] + py[rr] * py[rr] as d2
          from generate_series(1, n) rr
         where room[rr] = 3 and wedge[rr] = k and ax * px[rr] + ay * py[rr] > 0
           and lava_beside_room(rr - 1, nrx, nry, room, outside, 2) >= 0) t
       order by t.off, t.d2, t.r
    loop
      ra := v_rec.r - 1; while up[ra + 1] <> ra loop ra := up[ra + 1]; end loop;
      continue when first_in[ra + 1] < 0;
      ex := v_rec.r - 1; en := first_in[ra + 1];
      s := lava_beside_room(ex, nrx, nry, room, outside, 2);
      o1 := b.bxa + 2 * (ex % nrx) + case s when 0 then 1 when 2 then -1 else 0 end;
      o2 := b.bya + 2 * (ex / nrx) + case s when 1 then 1 when 3 then -1 else 0 end;
      s := lava_beside_room(en, nrx, nry, room, outside, 1);
      o3 := b.bxa + 2 * (en % nrx) + case s when 0 then 1 when 2 then -1 else 0 end;
      o4 := b.bya + 2 * (en / nrx) + case s when 1 then 1 when 3 then -1 else 0 end;
      opened := opened || ((o2 - b.bya) * b.nbx + (o1 - b.bxa)) || ((o4 - b.bya) * b.nbx + (o3 - b.bxa));
      insert into lava_design_way (size, design, wedge, entrance, exit) values (p_size, p_design, k, array[o3, o4], array[o1, o2])
        on conflict do nothing;
      exit;
    end loop;
  end loop;
  -- Every block's byte, a row at a time.
  for v in 0 .. b.nby - 1 loop
    bytes := array_fill(0, array[b.nbx]);
    for u in 0 .. b.nbx - 1 loop
      continue when u % 2 = 0 and v % 2 = 0;
      i := u / 2; j := v / 2; r := j * nrx + i + 1;
      if u % 2 = 1 and v % 2 = 0 then
        bytes[u + 1] := lava_wall_byte(room[r], room[r + 1], wedge[r], wedge[r + 1], pass[r] & 1 <> 0, (v * b.nbx + u) = any (opened));
      elsif u % 2 = 0 then
        bytes[u + 1] := lava_wall_byte(room[r], room[r + nrx], wedge[r], wedge[r + nrx], pass[r] & 2 <> 0, (v * b.nbx + u) = any (opened));
      else
        continue when room[r] <> 3 and room[r + 1] <> 3 and room[r + nrx] <> 3 and room[r + nrx + 1] <> 3;
        way := case when room[r + 1] = 3 and room[r + nrx + 1] = 3 and wedge[r + 1] = wedge[r + nrx + 1] then 0
                    when room[r + nrx] = 3 and room[r + nrx + 1] = 3 and wedge[r + nrx] = wedge[r + nrx + 1] then 1
                    when room[r] = 3 and room[r + nrx] = 3 and wedge[r] = wedge[r + nrx] then 2
                    when room[r] = 3 and room[r + 1] = 3 and wedge[r] = wedge[r + 1] then 3 end;
        bytes[u + 1] := lb_lava() | case when way is null then 0 else lb_way() | (way << 2) end;
      end if;
    end loop;
    insert into lava_design (size, design, by, bytes)
      values (p_size, p_design, b.bya + v, decode(array_to_string(array(select lpad(to_hex(x.c), 2, '0') from unnest(bytes) with ordinality x(c, o) order by x.o), ''), 'hex'))
      on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

/** Which way from a room (0-based) lies a room of a sort, E S W N, or -1; land only where it is outside (`beside`). */
create or replace function lava_beside_room(p_r int, p_nrx int, p_nry int, p_room int[], p_outside int[], p_sort int) returns int
language plpgsql immutable as $$
declare i int := p_r % p_nrx; j int := p_r / p_nrx; s int; a int; c int; q int;
begin
  for s in 0 .. 3 loop
    a := i + case s when 0 then 1 when 2 then -1 else 0 end;
    c := j + case s when 1 then 1 when 3 then -1 else 0 end;
    continue when a < 0 or c < 0 or a >= p_nrx or c >= p_nry;
    q := c * p_nrx + a + 1;
    if p_room[q] = p_sort and (p_sort <> 1 or p_outside[q] = 1) then return s; end if;
  end loop;
  return -1;
end $$;

/** A wall's byte between two rooms: nought unless the labyrinth's is beside it; lava unless its tree or a way goes through. */
create or replace function lava_wall_byte(p_a int, p_b int, p_wa int, p_wb int, p_tree boolean, p_opened boolean) returns int
language sql immutable as $$
  select case when p_a <> 3 and p_b <> 3 then 0
              when (p_a = 3 and p_b = 3 and p_wa = p_wb and p_tree) or p_opened then 0
              else lb_lava() | case when p_a = 3 and p_b = 3 and p_wa = p_wb then lb_opens() else 0 end end
$$;

/** A world's seed as the hash takes it, nought up to 2^31 (`lavaSalt`). */
create or replace function lava_salt(p_seed bigint) returns bigint language sql immutable as $$
  select ((p_seed % 2147483648) + 2147483648) % 2147483648
$$;

/** The design a world lays on a day (`lavaDesignOf`): one by its seed on the first day, then moved on by one to nine each day. */
create or replace function lava_design_of(p_seed bigint, p_day int) returns int language sql immutable as $$
  select ((floor(hash_tile(least(p_day, a.f), 0, a.s) * 4294967296)::bigint % lava_designs())
          + coalesce((select sum(1 + floor(hash_tile(k, 1, a.s) * 4294967296)::bigint % (lava_designs() - 1))
                        from generate_series(a.f + 1, p_day) k), 0))::int % lava_designs()
    from (select lava_salt(p_seed) as s, lava_from_day() as f) a
$$;

/** Today's design and tomorrow's for an island, kept and made once each; the days before yesterday let go. */
create or replace function lava_ready(p_world uuid) returns int language plpgsql as $$
declare v_day int := lava_day_of(now()); w world; v_n int := 0; d int; v_design int;
begin
  select * into w from world where id = p_world;
  if not found then return 0; end if;
  for d in v_day .. v_day + 1 loop
    select ld.design into v_design from lava_day ld where ld.world_id = p_world and ld.day = d;
    if v_design is null then
      v_design := lava_design_of(w.seed, d);
      insert into lava_day (world_id, day, design) values (p_world, d, v_design) on conflict do nothing;
    end if;
    if not exists (select 1 from lava_design ld where ld.size = w.size and ld.design = v_design) then
      perform pg_advisory_xact_lock(hashtext('lava_design:' || w.size || ':' || v_design)::bigint);
      v_n := v_n + lava_design_make(w.size, v_design);
    end if;
    v_design := null;
  end loop;
  delete from lava_day ld where ld.world_id = p_world and ld.day < v_day - 1;
  return v_n;
end $$;

-- On the clock that comes round every island: before its lairs.
select pg_temp.patch_fn('lair_tick(uuid)',
  $o$declare k record; v_l record; v_stood int := 0;
begin
$o$,
  $n$declare k record; v_l record; v_stood int := 0;
begin
  -- Today's and tomorrow's lava kept (`lava_ready`).
  perform lava_ready(p_world);
$n$);

/** The design an island lays on a day: kept, or worked out. */
create or replace function lava_design_on(p_world uuid, p_day int) returns int language sql stable as $$
  select coalesce((select ld.design from lava_day ld where ld.world_id = p_world and ld.day = p_day),
                  (select lava_design_of(w.seed, p_day) from world w where w.id = p_world))
$$;

/** A block's byte in a design on a world this size; nought off its box, and nought for a design not yet made. */
create or replace function lava_byte(p_size int, p_design int, p_bx int, p_by int) returns int language sql stable as $$
  select coalesce((select case when p_bx - b.bxa >= 0 and p_bx - b.bxa < b.nbx then get_byte(d.bytes, p_bx - b.bxa) else 0 end
                     from lava_box(p_size) b join lava_design d on d.size = p_size and d.design = p_design and d.by = p_by), 0)
$$;

/** A tile's middle height four times over, the sum of its corners; null off the island. */
create or replace function lava_sum4(p_world uuid, p_x int, p_y int) returns int language sql stable as $$
  select b_i16(h0.heights, p_x) + b_i16(h0.heights, p_x + 1) + b_i16(h1.heights, p_x + 1) + b_i16(h1.heights, p_x)
    from land_corner h0 join land_corner h1 on h1.world_id = h0.world_id and h1.y = p_y + 1
   where h0.world_id = p_world and h0.y = p_y
$$;

/** Whether a tile is in the heat: in the labyrinth's reach, Volcano Isle at the band's foot or above (`inHeat`). */
create or replace function lava_heat_on(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce((select lava_in_reach(w.size, p_x, p_y) from world w where w.id = p_world), false)
     and coalesce(region_at(p_world, p_x + 0.5, p_y + 0.5) = lava_isle() and lava_sum4(p_world, p_x, p_y) >= 4 * lava_foot(), false)
$$;

/** Whether a block holds what must be reached: a lair's piece or a seryll seam (`lavaMustReach`). */
create or replace function lava_must_reach(p_world uuid, p_bx int, p_by int) returns boolean language sql stable as $$
  select exists (select 1 from land_tile t cross join generate_series(p_bx * lava_cell(), p_bx * lava_cell() + lava_cell() - 1) x
                  where t.world_id = p_world and t.y between p_by * lava_cell() and p_by * lava_cell() + lava_cell() - 1
                    and x >= 0 and x < length(t.rock) and get_byte(t.rock, x) = lava_seam())
      or exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture'
                  and pl.sub in (select k.id from lair_kinds() k)
                  and pl.x between p_bx * lava_cell() and p_bx * lava_cell() + lava_cell() - 1
                  and pl.y between p_by * lava_cell() and p_by * lava_cell() + lava_cell() - 1)
$$;

/** Whether a whole block is lava in a design, but for what spares tiles: its byte, opened for what must be reached (`lavaBlockIn`). */
create or replace function lava_block(p_world uuid, p_size int, p_design int, p_bx int, p_by int) returns boolean
language plpgsql stable as $$
declare v int := lava_byte(p_size, p_design, p_bx, p_by); b record; q int;
begin
  if v & lb_lava() = 0 then return false; end if;
  if v & lb_way() <> 0 then return not lava_must_reach(p_world, p_bx, p_by); end if;
  if v & lb_opens() = 0 then return true; end if;
  if lava_must_reach(p_world, p_bx, p_by) then return false; end if;
  select * into b from lava_box(p_size);
  -- A pillar beside it whose way out it is.
  if (p_bx - b.bxa) % 2 = 1 then
    q := lava_byte(p_size, p_design, p_bx, p_by - 1);
    if q & lb_way() <> 0 and (q >> 2) % 4 = 1 and lava_must_reach(p_world, p_bx, p_by - 1) then return false; end if;
    q := lava_byte(p_size, p_design, p_bx, p_by + 1);
    if q & lb_way() <> 0 and (q >> 2) % 4 = 3 and lava_must_reach(p_world, p_bx, p_by + 1) then return false; end if;
  else
    q := lava_byte(p_size, p_design, p_bx - 1, p_by);
    if q & lb_way() <> 0 and (q >> 2) % 4 = 0 and lava_must_reach(p_world, p_bx - 1, p_by) then return false; end if;
    q := lava_byte(p_size, p_design, p_bx + 1, p_by);
    if q & lb_way() <> 0 and (q >> 2) % 4 = 2 and lava_must_reach(p_world, p_bx + 1, p_by) then return false; end if;
  end if;
  return true;
end $$;

/** Whether lava spares a tile: a road or laid path, a settlement, a building, a foundation, anything set down (`gameLava`). */
create or replace function lava_spared(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce(land_tile(p_world, p_x, p_y) = any (lava_spared_tiles()), false)
      or on_deed(p_world, p_x, p_y)
      or exists (select 1 from building_tile b where b.world_id = p_world and b.x = p_x and b.y = p_y)
      or exists (select 1 from foundation f where f.world_id = p_world and f.x = p_x and f.y = p_y)
      or exists (select 1 from placed pl where pl.world_id = p_world and pl.x = p_x and pl.y = p_y
                   and pl.kind in ('crate', 'campfire', 'smelter', 'kiln', 'furniture', 'anvil', 'post', 'trap'))
$$;

/**
 * Whether a tile of a world this size is lava on a day, today unless told (`lavaAt`). Asked of every tile a creature
 * steps to, so in its own arithmetic: off the labyrinth's reach at once, then the day's design and one row's byte, and
 * only then what opens a block or spares a tile.
 */
create or replace function lava_on(p_world uuid, p_size int, p_x int, p_y int, p_day int default null) returns boolean
language plpgsql stable as $$
declare c int := lava_cell(); cx int := (lava_centre())[1] * p_size / 10000; cy int := (lava_centre())[2] * p_size / 10000;
        rad int := (2 * lava_radius() * p_size + lava_size()) / (2 * lava_size());
        v_design int; v_bxa int; v_bya int; v_bytes bytea; v_byte int; u int; v_day int;
begin
  if p_x < 0 or p_y < 0 or p_x >= p_size or p_y >= p_size
     or (p_x - cx)::bigint * (p_x - cx) + (p_y - cy)::bigint * (p_y - cy) > (rad + lava_reach_past())::bigint * (rad + lava_reach_past()) then
    return false;
  end if;
  v_day := coalesce(p_day, lava_day_of(now()));
  select ld.design into v_design from lava_day ld where ld.world_id = p_world and ld.day = v_day;
  if v_design is null then v_design := lava_design_on(p_world, v_day); end if;
  v_bxa := floor((cx - rad)::float8 / c)::int - 2;
  v_bxa := v_bxa - ((v_bxa % 2) + 2) % 2;
  select d.bytes into v_bytes from lava_design d where d.size = p_size and d.design = v_design and d.by = p_y / c;
  u := p_x / c - v_bxa;
  if v_bytes is null or u < 0 or u >= length(v_bytes) then return false; end if;
  v_byte := get_byte(v_bytes, u);
  if v_byte & lb_lava() = 0 then return false; end if;
  if v_byte & (lb_opens() | lb_way()) <> 0 and not lava_block(p_world, p_size, v_design, p_x / c, p_y / c) then return false; end if;
  if coalesce(lava_sum4(p_world, p_x, p_y), -1) < 0 then return false; end if;
  return not lava_spared(p_world, p_x, p_y);
end $$;

/** Whether a tile is lava today. */
create or replace function lava_at(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce((select lava_on(p_world, w.size, p_x, p_y) from world w where w.id = p_world), false)
$$;

/** Whether lava is on a tile or one of the eight round it (`lavaBeside`). */
create or replace function lava_near(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select exists (select 1 from generate_series(-1, 1) dx cross join generate_series(-1, 1) dy
                  where lava_at(p_world, p_x + dx, p_y + dy))
$$;

/* ---- What it refuses ------------------------------------------------------------------------------------------- */

/** Why a job will not be done on lava, or null: asked of the tiles a stone's ground is (`lavaGroundRefusal`). */
create or replace function lava_ground_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $$
begin
  if not lava_guarded(p_action) then return null; end if;
  if exists (select 1 from stone_job_tiles(p_world, p_uid, p_action, p_target) t where lava_at(p_world, t.x, t.y)) then
    return lava_said();
  end if;
  return null;
end $$;

select pg_temp.patch_fn('act_refusal_rules(uuid, uuid, text, jsonb)',
  $o$  aimed := stone_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;$o$,
  $n$  aimed := stone_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;
  -- And the day's lava on Volcano Isle, which nothing digs, builds, sets down or founds on (`lava_ground_refusal`).
  aimed := lava_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;$n$);

-- No creature steps onto it.
select pg_temp.patch_fn('creature_tile_ok(uuid, integer, integer)',
  $o$     and runestone_on(q.size, p_x, p_y) is null$o$,
  $n$     and runestone_on(q.size, p_x, p_y) is null
     -- Nor onto the day's lava (`lava_on`).
     and not lava_on(p_world, q.size, p_x, p_y)$n$);

/* ---- The heat -------------------------------------------------------------------------------------------------- */

/**
 * The meter and health after a stretch (`heatStep`): filling in the heat, `heat_near` times beside lava, health off
 * for the part of the stretch it was full; draining below; and lava's own burn on top.
 */
create or replace function heat_step(p_heat double precision, p_health double precision, p_secs double precision,
  p_up boolean, p_near boolean, p_on boolean, p_mul double precision,
  out heat double precision, out health double precision, out at_full boolean) language plpgsql immutable as $$
declare s double precision := greatest(0, p_secs); v_lava double precision; v_rate double precision; v_to double precision;
begin
  v_lava := case when p_on then s * lava_burn() else 0 end;
  if not p_up then
    heat := greatest(0, p_heat - s * heat_drain()); health := greatest(0, p_health - v_lava); at_full := false;
    return;
  end if;
  v_rate := heat_fill() * case when p_near then heat_near() else 1 end * p_mul;
  v_to := case when v_rate > 0 then greatest(0, (1 - p_heat) / v_rate) else 'infinity'::double precision end;
  heat := least(1, p_heat + v_rate * s);
  health := greatest(0, p_health - greatest(0, s - v_to) * heat_burn() - v_lava);
  at_full := s > v_to;
end $$;

/** The fill's multiplier for what is worn and drunk: dragon-scale pieces, ice infusions, a draught until `p_cool` (`heatMul`). */
create or replace function heat_mul(p_world uuid, p_uid uuid, p_cool double precision) returns double precision language sql stable as $$
  select power(1 - heat_scale(), count(*) filter (where i.def = any (heat_scale_pieces())))
       * exp(coalesce(sum(ln(1 - heat_ice() * infuse_on(i.infuse, 'ice'))) filter (where infuse_on(i.infuse, 'ice') > 0), 0))
       * case when p_cool > extract(epoch from now()) then draught_fill() else 1 end
    from player p cross join lateral jsonb_each_text(coalesce(p.equipped, '{}'::jsonb)) e
    join item i on i.world_id = p.world_id and i.holder = 'player' and i.holder_uid = p.uid
                and e.value ~ '^[0-9]+$' and i.id = e.value::bigint
   where p.world_id = p_world and p.uid = p_uid
$$;

select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$        v_upkeep double precision; v_free double precision; v_drain double precision;$o$,
  $n$        v_upkeep double precision; v_free double precision; v_drain double precision;
        v_heat double precision; v_hsaid double precision; v_hs record; v_tx int; v_ty int; v_on boolean;$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$  -- Nothing knits while you are trying not to drown.$o$,
  $n$  /*
   * Volcano Isle's heat and lava (`lava.ts`): the meter fills in the heat, beside lava the faster, and takes health
   * once full; it drains below; lava underfoot burns. Nothing of it for a body away.
   */
  v_heat := coalesce((p.stats->>'heat')::double precision, 0);
  v_hsaid := (p.stats->>'heatSaid')::double precision;
  v_tx := floor(p.x)::int; v_ty := floor(p.y)::int;
  if not p.away and (v_heat > 0 or lava_heat_on(p_world, v_tx, v_ty)) then
    v_on := coalesce(p.level, 0) = 0 and p.aboard is null and lava_at(p_world, v_tx, v_ty);
    select * into v_hs from heat_step(v_heat, hp, secs, lava_heat_on(p_world, v_tx, v_ty),
      v_on or (coalesce(p.level, 0) = 0 and p.aboard is null and lava_near(p_world, v_tx, v_ty)), v_on,
      heat_mul(p_world, p_uid, (p.stats->>'cool')::double precision));
    v_heat := v_hs.heat;
    hp := v_hs.health;
    if (v_on or v_hs.at_full) and (v_hsaid is null or extract(epoch from now()) - v_hsaid > heat_warn()) then
      perform tell(p_world, p_uid, case when v_on then heat_lava_said() else heat_full_said() end, 'error');
      v_hsaid := extract(epoch from now());
    end if;
  end if;

  -- Nothing knits while you are trying not to drown.$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$      '{stamina}', to_jsonb(w)), '{health}', to_jsonb(hp))$o$,
  $n$      '{stamina}', to_jsonb(w)), '{health}', to_jsonb(hp))
      -- And the heat (`lava.ts`), and when its warning was last said.
      || jsonb_build_object('heat', v_heat) || case when v_hsaid is null then '{}'::jsonb else jsonb_build_object('heatSaid', v_hsaid) end$n$);

/* ---- The cooling draught --------------------------------------------------------------------------------------- */

create or replace function item_action(p_action text) returns boolean language sql immutable as $$
  select p_action in ('improve_item', 'repair_item', 'patch_item', 'eat', 'drink', 'drink_skin', 'quench_item',
                      'drink_tea', 'take_tincture', 'apply_salve', 'mend_kit', 'seal_item', 'set_in_circlet', 'glaze_item',
                      -- A cooling draught (`lava.ts`).
                      'drink_draught')
$$;

select pg_temp.patch_fn('item_refusal(uuid, uuid, text, jsonb)',
  $o$  elsif p_action = 'take_tincture' then
    if v_it.def <> 'tincture' then return 'That is not a tincture.'; end if;$o$,
  $n$  -- A cooling draught (`lava.ts`), which anybody may drink.
  elsif p_action = 'drink_draught' then
    if v_it.def <> cooling_draught() then return draught_not_said(); end if;
    return null;

  elsif p_action = 'take_tincture' then
    if v_it.def <> 'tincture' then return 'That is not a tincture.'; end if;$n$);

select pg_temp.patch_fn('perform_item(uuid, uuid, text, jsonb)',
  $o$  -- A tincture is taken no more: it gave a meal boost, and only a dish off a shut recipe gives one.
  elsif p_action = 'take_tincture' then$o$,
  $n$  -- A cooling draught (`lava.ts`): the heat down by `draught_drop`, and its fill ×`draught_fill` for `draught_secs`.
  elsif p_action = 'drink_draught' then
    if not consume(p_world, p_uid, v_it.def, 1, v_it.id) then return; end if;
    update player set stats = coalesce(stats, '{}'::jsonb)
        || jsonb_build_object('heat', greatest(0, coalesce((v_p.stats->>'heat')::double precision, 0) - draught_drop()),
                              'cool', extract(epoch from now()) + draught_secs())
      where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, draught_said(), 'event');

  -- A tincture is taken no more: it gave a meal boost, and only a dish off a shut recipe gives one.
  elsif p_action = 'take_tincture' then$n$);

select private.lock_doors();
