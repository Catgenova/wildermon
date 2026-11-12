/**
 * A day in the woods in parts, the same day (20261101320200).
 *
 * `tree_tick` gives a day `tree_part_secs()` a go and commits; `tree_day_part` carries on from where the last part
 * stopped (`private.tree_run`). Asked of an island of its own, 256 a side, made up here from a formula: trees of
 * every kind at every age (the shrivelled die today and seed), stumps, grass with a cutting count and grass with its
 * flowers picked, rock, cuts in some trees, and somebody about in one corner:
 *
 *   * the day as it was (the old `tree_day`, put back here), the day in the smallest parts there are (one line, one
 *     band, one batch of rolls or one line of saplings a go), and the day in one go (`tree_day` now), all from the
 *     same seed, leave the same ground byte for byte, the same record of changes in the same order, no cuts, no
 *     chunks, the island stamped, and nothing of the run behind;
 *   * the parts go through every stage of the day;
 *   * a spot turned to rock between its picking and its planting takes no sapling;
 *   * the tick carries on a day under way, a part a go, before it starts another island's.
 *
 * Everything is rolled back.
 */
import { execFileSync } from 'node:child_process';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = '00000000-0000-4000-8000-0000000d00d5';
const SIZE = 256;

/** The island, the same every time: nothing in it is random. */
const ISLAND = `
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, trees_at)
values ('${W}', 'Woodparts', 1, ${SIZE}, 128, 128, true, tree_last_dawn() - interval '1 minute');
insert into land_tile (world_id, y, tiles, data, rock)
select '${W}', y,
       decode(string_agg(lpad(to_hex(case when h < 450 then 16 when h < 500 then tile_id('Stump') when h < 640 and h >= 600 then 4
                                          else 0 end), 2, '0'), '' order by x), 'hex'),
       decode(string_agg(lpad(to_hex(case when h < 450 then tree_pack((h % 17)::int, ((h / 17) % 6)::int)
                                          when h < 500 then 0
                                          when h < 560 then 4 | (h % 3)
                                          when h < 600 then 8
                                          else 0 end), 2, '0'), '' order by x), 'hex'),
       decode(repeat('00', ${SIZE}), 'hex')
  from (select x, y, ((x::bigint * 73856093) # (y::bigint * 19349663)) & 1023 as h
          from generate_series(0, ${SIZE - 1}) x, generate_series(0, ${SIZE - 1}) y) t
 group by y;
insert into land_corner (world_id, y, heights, dirt)
select '${W}', y, decode(repeat('0500', ${SIZE + 1}), 'hex'), decode(repeat('00', ${SIZE + 1}), 'hex')
  from generate_series(0, ${SIZE}) y;
insert into tree_notch (world_id, x, y, cuts)
select '${W}', x, y, 1 from generate_series(3, ${SIZE - 1}, 17) x, generate_series(5, ${SIZE - 1}, 23) y;
insert into player (world_id, uid, name, x, y) values ('${W}', '00000000-0000-4000-8000-0000000d00d6', 'Forester', 40.5, 40.5);
`;

const DUMP = `
select 'LAND|' || md5(string_agg(md5(tiles) || md5(data), '' order by y)) from land_tile where world_id = '${W}';
select 'TREES|' || sum((select count(*) from generate_series(0, ${SIZE - 1}) g where get_byte(tiles, g) = 16))
    || '|' || sum((select count(*) from generate_series(0, ${SIZE - 1}) g where get_byte(tiles, g) = tile_id('Lawn')))
  from land_tile where world_id = '${W}';
select 'RECORD|' || count(*) || '|' || count(*) filter (where tile = 16) || '|'
    || md5(coalesce(string_agg(format('%s,%s,%s,%s,%s,%s,%s', x, y, region, tile, data, corners, soil), ';' order by n), ''))
  from tile_change where world_id = '${W}';
select 'LEFT|' || (select count(*) from tree_notch where world_id = '${W}') || '|' || (select count(*) from land_chunk where world_id = '${W}')
    || '|' || (select trees_at >= tree_last_dawn() from world where id = '${W}')
    || '|' || (select count(*) from private.tree_run where world_id = '${W}')
    || '|' || (select count(*) from private.tree_run_dead where world_id = '${W}')
    || '|' || (select count(*) from private.tree_run_pick where world_id = '${W}');
`;

const TREE_DAY_WAS = `
create function pg_temp.tree_day_was(p_world uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare w record; v_y int; v_tiles bytea; v_data bytea; v_row record; v_stump int := tile_id('Stump'); v_grass int := tile_id('Grass'); v_lawn int := tile_id('Lawn');
        v_next int[]; v_kind int[]; v_first int := tree_first(); v_reach int := tree_seed_reach()::int;
        v_moved int := 0; i int; k int; v_a int; v_b int; v_n int;
        v_sx int[] := '{}'; v_sy int[] := '{}'; v_ss int[] := '{}';
        v_gx int[] := '{}'; v_gy int[] := '{}'; v_gs int[] := '{}';
        v_tx int[]; v_ty int[]; v_ts int[]; v_touched boolean := false;
        v_px int[]; v_py int[]; v_near boolean; v_told int[];
        v_h0 bytea; v_h1 bytea; v_d0 bytea; v_d1 bytea;
        v_band int := 16; v_w0 int; v_w1 int; v_ground bytea; v_plant boolean[]; v_deeds deed[]; v_pick record;
        v_c0 int; v_c1 int;
        v_aqx int[]; v_aqy int[];
        v_new_year boolean; v_picked int := flowers_picked()::int;
begin
  select * into w from world where id = p_world;
  if not found or not w.ready then return 0; end if;
  v_new_year := w.trees_at is null or year_of(now()) <> year_of(w.trees_at);

  select array_agg(coalesce(next, -1) order by id) into v_next from tree_age_def;
  select array_agg(tree_species(b) order by b) into v_kind from generate_series(0, 255) b;
  select array_agg(floor(p.x)::int), array_agg(floor(p.y)::int) into v_px, v_py
    from player p where p.world_id = p_world and not p.away
      and p.seen_at > now() - make_interval(secs => idle_logout());

  for v_y in 0 .. w.size - 1 loop
        select t.tiles || ''::bytea, t.data || ''::bytea into v_tiles, v_data
      from land_tile t where t.world_id = p_world and t.y = v_y;
    if not found then continue; end if;
    if position('\\x10'::bytea in v_tiles) = 0 and position(set_byte('\\x00'::bytea, 0, v_stump) in v_tiles) = 0
       and not any_byte_between(v_data, 1, 7)
       and not any_byte_between(v_data, case when v_new_year then 8 else 9 end, 15) then continue; end if;

        select
      string_agg(set_byte('\\x00'::bytea, 0, case
        when g.t = 16 and g.n < 0 then v_grass
        when g.t = v_stump then 0
        when g.t = v_grass and (g.d & 4) <> 0 and (g.d & 3) + 1 >= 3 then v_lawn
        else g.t end), ''::bytea order by g.gi) as tiles,
      string_agg(set_byte('\\x00'::bytea, 0, case
        when g.t = v_stump then 0
        when g.t = v_grass and (g.d & 4) <> 0 then case when (g.d & 3) + 1 >= 3 then 0
          else ((g.d & 3) + 1) | case when v_new_year then 0 else g.d & v_picked end end
        when g.t = v_grass then case when v_new_year then 0 else g.d & v_picked end
        when g.t <> 16 then g.d
        when g.n < 0 then 0
        else (g.d & 143) | (g.n << 4) end), ''::bytea order by g.gi) as data,
      count(*) filter (where g.t = 16) as here,
      array_agg(g.gi) filter (where (g.t = 16 and (g.n < 0 or g.n <> g.a)) or g.t = v_stump
                                 or (g.t = v_grass and ((g.d & 7) <> 0 or (v_new_year and (g.d & v_picked) <> 0)))) as stirred,
      array_agg(g.gi) filter (where (g.t = 16 and g.n < 0) or g.t = v_stump
                                 or (g.t = v_grass and (g.d & 4) <> 0 and (g.d & 3) + 1 >= 3)
                                 or (g.t = v_grass and v_new_year and (g.d & v_picked) <> 0)) as faced,
      array_agg(g.gi) filter (where g.t = 16 and g.n < 0) as dead
      into v_row
      from (select q.gi, q.t, q.d, q.a, coalesce(v_next[q.a + 1], q.a) as n
              from (select gi, get_byte(v_tiles, gi) as t, get_byte(v_data, gi) as d,
                           tree_age(get_byte(v_data, gi)) as a
                      from generate_series(0, w.size - 1) gi) q) g;
    if v_row.here = 0 and v_row.stirred is null then continue; end if;
    v_moved := v_moved + v_row.here;
    v_touched := true;

    update land_tile t set tiles = v_row.tiles, data = v_row.data
      where t.world_id = p_world and t.y = v_y;

        v_near := false;
    if v_px is not null then
      for k in 1 .. array_length(v_px, 1) loop
        if abs(v_py[k] - v_y) <= tree_tell_reach() then v_near := true; exit; end if;
      end loop;
    end if;
    v_told := case when v_near then v_row.stirred else v_row.faced end;
    if v_told is not null then
      select c.heights || ''::bytea, c.dirt || ''::bytea into v_h0, v_d0
        from land_corner c where c.world_id = p_world and c.y = v_y;
      select c.heights || ''::bytea, c.dirt || ''::bytea into v_h1, v_d1
        from land_corner c where c.world_id = p_world and c.y = v_y + 1;
      if found and v_h0 is not null then
        insert into tile_change (world_id, x, y, region, tile, data, corners, soil)
        select p_world, u.gi, v_y, region_of(u.gi, v_y),
               get_byte(v_row.tiles, u.gi), get_byte(v_row.data, u.gi),
               array[b_i16(v_h0, u.gi), b_i16(v_h0, u.gi + 1),
                     b_i16(v_h1, u.gi + 1), b_i16(v_h1, u.gi)],
               array[get_byte(v_d0, u.gi), get_byte(v_d0, u.gi + 1),
                     get_byte(v_d1, u.gi + 1), get_byte(v_d1, u.gi)]
          from unnest(v_told) as u(gi);
      end if;
    end if;

    if v_row.dead is not null then
      foreach i in array v_row.dead loop
        v_sx := v_sx || i;
        v_sy := v_sy || v_y;
        v_ss := v_ss || v_kind[get_byte(v_data, i) + 1];
      end loop;
    end if;
  end loop;

  delete from tree_notch where world_id = p_world;

    select array_agg(exists (select 1 from plantable p where p.tile = b) order by b) into v_plant
    from generate_series(0, 255) b;
  select array_agg(d) into v_deeds from deed d where d.world_id = p_world;
  select array_agg(s.x), array_agg(s.y) into v_aqx, v_aqy
    from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
   where s.world_id = p_world and b.kind = 'aqueduct';
  v_n := coalesce(array_length(v_sx, 1), 0);
  v_a := 1;
  while v_a <= v_n loop
    v_b := v_a;
    while v_b < v_n and v_sy[v_b + 1] < v_sy[v_a] + v_band loop v_b := v_b + 1; end loop;
    v_w0 := greatest(0, v_sy[v_a] - v_reach);
    v_w1 := least(w.size - 1, v_sy[v_b] + v_reach);
    select string_agg(t.tiles, ''::bytea order by t.y) into v_ground
      from land_tile t where t.world_id = p_world and t.y between v_w0 and v_w1;
    v_c0 := v_a;
    while v_c0 > 1 and v_sy[v_c0 - 1] >= v_w0 loop v_c0 := v_c0 - 1; end loop;
    v_c1 := v_b;
    while v_c1 < v_n and v_sy[v_c1 + 1] <= v_w1 loop v_c1 := v_c1 + 1; end loop;

    for v_pick in
      with dead as (
        select d.x, d.y, d.sp, random() as roll
          from unnest(v_sx[v_a:v_b], v_sy[v_a:v_b], v_ss[v_a:v_b]) as d(x, y, sp)
         where not coalesce(region_treeless(region_at(p_world, d.x, d.y)), false)
      ), cand as (
        select d.x, d.y, d.sp, d.roll, d.x + q.dx as gx, d.y + q.dy as gy
        from dead d cross join (
          select dx, dy from generate_series(-v_reach, v_reach) dx,
                             generate_series(-v_reach, v_reach) dy
          where not (dx = 0 and dy = 0)) q
        where d.roll >= tree_seed_none()
          and d.x + q.dx between 0 and w.size - 1 and d.y + q.dy between 0 and w.size - 1
      ), cleared as (
        select k.x, k.y from unnest(v_sx[v_c0:v_c1], v_sy[v_c0:v_c1]) as k(x, y)
      ), free as (
        select c.gx, c.gy, c.sp, c.roll,
               row_number() over (partition by c.x, c.y order by random()) as rn,
               count(*) over (partition by c.x, c.y) as room
        from cand c
        where v_plant[get_byte(v_ground, (c.gy - v_w0) * w.size + c.gx) + 1]
          and not exists (select 1 from cleared k where k.x = c.gx and k.y = c.gy)
          and (v_deeds is null or not exists (select 1 from unnest(v_deeds) d where deed_covers(d, c.gx, c.gy)))
          and (v_aqx is null or not exists (select 1 from unnest(v_aqx, v_aqy) a(x, y) where a.x = c.gx and a.y = c.gy))
      ), want as (
                select f.gx, f.gy, f.sp, f.rn, least(
          case when f.roll < tree_seed_none() then 0
               when f.roll < 1 - tree_seed_both() then 1 else tree_seeds()::int end,
          case when f.room >= tree_room_two() then tree_seeds()::int
               when f.room >= tree_room_one() then 1 else 0 end) as take
        from free f
      )
      select gx, gy, sp from want where rn <= take
    loop
      v_gx := v_gx || v_pick.gx;
      v_gy := v_gy || v_pick.gy;
      v_gs := v_gs || v_pick.sp;
    end loop;
    v_a := v_b + 1;
  end loop;

  if array_length(v_gx, 1) > 0 then
    select array_agg(gx order by gy, gx), array_agg(gy order by gy, gx), array_agg(sp order by gy, gx)
      into v_tx, v_ty, v_ts
      from (select distinct on (gx, gy) gx, gy, sp
              from unnest(v_gx, v_gy, v_gs) as p(gx, gy, sp)
             order by gx, gy, random()) took;
  end if;

    v_n := coalesce(array_length(v_tx, 1), 0);
  v_a := 1;
  while v_a <= v_n loop
    v_y := v_ty[v_a];
    v_b := v_a;
    while v_b < v_n and v_ty[v_b + 1] = v_y loop v_b := v_b + 1; end loop;

    select t.tiles || ''::bytea, t.data || ''::bytea into v_tiles, v_data
      from land_tile t where t.world_id = p_world and t.y = v_y;
    for k in v_a .. v_b loop
      v_tiles := set_byte(v_tiles, v_tx[k], 16);
      v_data := set_byte(v_data, v_tx[k], tree_pack(v_ts[k], v_first));
    end loop;
    update land_tile t set tiles = v_tiles, data = v_data
      where t.world_id = p_world and t.y = v_y;

    select c.heights || ''::bytea, c.dirt || ''::bytea into v_h0, v_d0
      from land_corner c where c.world_id = p_world and c.y = v_y;
    select c.heights || ''::bytea, c.dirt || ''::bytea into v_h1, v_d1
      from land_corner c where c.world_id = p_world and c.y = v_y + 1;
    if found and v_h0 is not null then
      insert into tile_change (world_id, x, y, region, tile, data, corners, soil)
      select p_world, u.gx, v_y, region_of(u.gx, v_y),
             16, tree_pack(u.sp, v_first),
             array[b_i16(v_h0, u.gx), b_i16(v_h0, u.gx + 1),
                   b_i16(v_h1, u.gx + 1), b_i16(v_h1, u.gx)],
             array[get_byte(v_d0, u.gx), get_byte(v_d0, u.gx + 1),
                   get_byte(v_d1, u.gx + 1), get_byte(v_d1, u.gx)]
        from unnest(v_tx[v_a:v_b], v_ts[v_a:v_b]) as u(gx, sp);
    end if;
    v_touched := true;
    v_a := v_b + 1;
  end loop;

      if trail_day(p_world) then v_touched := true; end if;

  if v_touched then delete from land_chunk where world_id = p_world; end if;
  update world set trees_at = now() where id = p_world;
  return v_moved;
end $function$;
`;

const said = (out: string, key: string): string =>
  out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? 'MISSING';

/* ---- the same day three ways -------------------------------------------- */
const was = psql(`
begin;
${ISLAND}
${TREE_DAY_WAS}
select setseed(0.5);
select 'GREW|' || pg_temp.tree_day_was('${W}');
${DUMP}
rollback;`);

const parts = psql(`
begin;
${ISLAND}
select setseed(0.5);
create temp table part (n int, phase int);
do $$
declare n int := 0; r int; ph int;
begin
  loop
    r := tree_day_part('${W}', '-infinity');
    n := n + 1;
    select phase into ph from private.tree_run where world_id = '${W}';
    insert into part values (n, ph);
    exit when r is not null or n > 100000;
  end loop;
  insert into part values (0, r);
end $$;
select 'GREW|' || phase from part where n = 0;
select 'PARTS|' || count(*) filter (where n > 0) || '|' || string_agg(distinct phase::text, ',') filter (where n > 0 and phase is not null) from part;
${DUMP}
rollback;`);

const once = psql(`
begin;
${ISLAND}
select setseed(0.5);
select 'GREW|' || tree_day('${W}');
${DUMP}
rollback;`);

for (const key of ['GREW', 'LAND', 'TREES', 'RECORD', 'LEFT']) {
  check(`in the smallest parts, ${key.toLowerCase()} as the day as it was`, said(parts, key) === said(was, key),
    `${said(parts, key)} against ${said(was, key)}`);
  check(`in one go, ${key.toLowerCase()} as the day as it was`, said(once, key) === said(was, key),
    `${said(once, key)} against ${said(was, key)}`);
}
const [records, saplings] = said(was, 'RECORD').split('|');
const [, lawn] = said(was, 'TREES').split('|');
check('and the day is a day of everything: trees dying and seeding, lawn, and the record of it',
  Number(saplings) > 100 && Number(lawn) > 100 && Number(records) > Number(saplings),
  `${records} changes written down, ${saplings} of them saplings; ${lawn} lawn`);
check('with nothing left: no cuts, no chunks, the island stamped, no run, no dead, no picks',
  said(was, 'LEFT') === '0|0|true|0|0|0' && said(parts, 'LEFT') === '0|0|true|0|0|0', said(parts, 'LEFT'));
const [nParts, phases] = said(parts, 'PARTS').split('|');
check('the parts go through every stage of the day: lines, seeding, rolls, planting, the rest',
  phases === '1,2,3,4,5' && Number(nParts) > SIZE, `${nParts} parts through stages ${phases}`);

/* ---- a spot built on between picking and planting ----------------------- */
const rock = psql(`
begin;
${ISLAND}
select setseed(0.5);
create temp table spot (gx int, gy int, n int);
do $$
declare r int; n int := 0; s record;
begin
  loop
    r := tree_day_part('${W}', '-infinity');
    n := n + 1;
    exit when r is not null or n > 100000
      or exists (select 1 from private.tree_run where world_id = '${W}' and phase = 4);
  end loop;
  select p.gx, p.gy into s from private.tree_run_pick p where p.world_id = '${W}' order by p.gy, p.gx limit 1;
  insert into spot values (s.gx, s.gy, (select count(*) from private.tree_run_pick p where p.world_id = '${W}' and p.gx = s.gx and p.gy = s.gy));
  update land_tile set tiles = set_byte(tiles, s.gx, 4) where world_id = '${W}' and y = s.gy;
  loop
    r := tree_day_part('${W}', '-infinity');
    exit when r is not null;
  end loop;
end $$;
select 'ROCK|' || (select count(*) from spot) || '|' || land_tile('${W}', s.gx, s.gy)
    || '|' || (select count(*) from tile_change c where c.world_id = '${W}' and c.x = s.gx and c.y = s.gy and c.tile = 16)
  from spot s;
select 'SAPLINGS|' || count(*) from tile_change where world_id = '${W}' and tile = 16;
rollback;`);
const [spots, tile, planted] = said(rock, 'ROCK').split('|');
check('a spot turned to rock between its picking and its planting stays rock, with no sapling written down',
  spots === '1' && tile === '4' && planted === '0', said(rock, 'ROCK'));
check('and every other sapling is planted', Number(said(rock, 'SAPLINGS')) === Number(saplings) - 1,
  `${said(rock, 'SAPLINGS')} of ${saplings}`);

/* ---- the tick ------------------------------------------------------------ */
const tick = psql(`
begin;
${ISLAND}
-- Another island owed as well, after this island's day has started.
update world set trees_at = now() where id <> '${W}';
update world set trees_at = tree_last_dawn() - interval '1 minute'
 where id = (select id from world where ready and id <> '${W}' and size <= 128 order by name limit 1);
select tree_day_part('${W}', '-infinity');
create temp table ticked (k text, v text);
do $$
declare t jsonb; n int := 0; v_other uuid; v_early boolean := false;
begin
  select id into v_other from world where ready and id <> '${W}' and trees_at < tree_last_dawn();
  loop
    t := tree_tick();
    n := n + 1;
    if (select trees_at >= tree_last_dawn() from world where id = v_other) then v_early := true; end if;
    exit when (select trees_at >= tree_last_dawn() from world where id = '${W}') or n >= 100;
  end loop;
  insert into ticked values ('MINE', n || '|' || (t->>'done') || '|' || v_early);
  t := tree_tick();
  insert into ticked values ('OTHER', (t->>'isles') || '|' || (t->>'done') || '|'
    || (select count(*) from world where ready and trees_at < tree_last_dawn()));
  t := tree_tick();
  insert into ticked values ('NONE', t->>'isles');
end $$;
select k || '|' || v from ticked;
rollback;`);
const [goes, done, early] = said(tick, 'MINE').split('|');
check('the tick carries on the day under way, a part a go, before the other island owed',
  Number(goes) >= 1 && Number(goes) < 100 && done === 'true' && early === 'false',
  `${goes} go(es), done ${done}, the other turned first: ${early}`);
check('then the other island in a go, then nothing', said(tick, 'OTHER') === '1|true|0' && said(tick, 'NONE') === '0',
  `${said(tick, 'OTHER')}; ${said(tick, 'NONE')}`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a day in the woods in parts, the same day — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
