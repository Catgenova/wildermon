/**
 * A cheaper stir, with the same island at the end of it.
 *
 * Asked for: "streamline cpu". The clock's search for a worker's next tile (`find_work_tile`), for room in its stores
 * (`worker_store`), for its stations (`cook_target` and the rest), for its meals (`worker_feed`), for a recipe its
 * stores hold (`recipe_in_stores`) and for strays (`worker_sweep`) do less to reach the same answer
 * (20261101300001..300003), and a round settles each creature once (`creature_sweep`, 20261101300004).
 *
 * One island, run twice from the same moment with the same random seed: once as it is, and once with the stir as it
 * was (supabase/test/stirload-before.sql, in a schema `stir_old` put first in the search path; the stations and
 * `worker_feed` put back from their patched lines). On it two people awake five tiles apart, each with a companion; a
 * settlement of the first with nine workers at nine trades (a forager, a woodcutter, a fisher at a pond, a guard, a
 * fetcher with logs lying about, a sawyer, a hod carrier with a wall to fit, a cook with no oven, a reed cutter with no
 * reed), its stores, and other people's furniture off it; a wild one near and one far. Asked:
 *
 *   * a round of the clock (`world_tick`) leaves the island the same, every creature, every item and the wall;
 *   * in it the wild one near is walked and the far one, which nobody can see, is left standing due, both ways;
 *   * as it is, no creature is settled twice in the round; as it was, each companion was settled at least twice;
 *   * an hour of every worker's day leaves the island the same both ways, creature for creature and item for item,
 *     and the work was done: things gathered into the stores, planks sawn, the wall fitted.
 *
 * Runs against the database the suite leaves behind; everything is in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Game } from '../../src/game/game';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const before = readFileSync(resolve('supabase/test/stirload-before.sql'), 'utf8');

// A stone wall's bill, from the browser's own rules.
const g = Game.create(4243);
const wall = g.buildings.setWall(g.buildings.create('Hall', 10, 10), 0, 10, 10, 'n', 'solid', 'stone_brick');
const BILL = JSON.stringify(wall.needed);

const A = '7e5b0000-0000-4000-8000-0000000051a1';
const B = '7e5b0000-0000-4000-8000-0000000051a2';
const T = 24;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table settled (id int);
-- The round's budget, long enough on any machine for both stirs to finish what is near: a slow runner would
-- otherwise run out of time in the old stir and settle less, and the two islands would part for that alone.
create or replace function settle_budget() returns interval language sql immutable as $$ select interval '60 seconds' $$;
create schema stir_old;
create schema stir_log;
${before}
-- The stations and the meals, put back from their patched lines (20261101300002, the other way round).
do $p$
declare v_fn text; v_def text; v_n int; r record;
  v_new text := $$and p.x between dd.x - work_range(c) and dd.x + work_range(c) and p.y between dd.y - work_range(c) and dd.y + work_range(c)
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_home_deed$$;
  v_old text := $$and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_home_deed$$;
begin
  foreach v_fn in array array['anvil_target', 'ash_target', 'brew_target', 'cook_target', 'furnace_target', 'glass_target',
                              'lamp_target', 'planter_target', 'press_target', 'station_target', 'vine_target'] loop
    v_def := replace(pg_get_functiondef(('public.' || v_fn)::regproc), 'FUNCTION public.', 'FUNCTION stir_old.');
    v_n := (length(v_def) - length(replace(v_def, v_new, ''))) / length(v_new);
    if v_n <> 1 then raise exception 'stir_old.%: % of the lines to put back, not 1', v_fn, v_n; end if;
    execute replace(v_def, v_new, v_old);
  end loop;
  v_def := replace(pg_get_functiondef('public.worker_feed'::regproc), 'FUNCTION public.', 'FUNCTION stir_old.');
  for r in select * from (values
    ('public', 'worker_feed',
     $q$       where k.world_id = p_world
         and case when v_post is not null$q$,
     $q$       where k.world_id = p_world
         and case when v_post is not null then k.x between v_px - v_pr and v_px + v_pr and k.y between v_py - v_pr and v_py + v_pr
                  else k.x between v_deed.x - v_deed.radius and v_deed.x + v_deed.radius
                   and k.y between v_deed.y - v_deed.radius and v_deed.y + v_deed.radius end
         and case when v_post is not null$q$),
    ('public', 'worker_feed',
     $q$       where p.world_id = p_world and p.kind = 'furniture'
         and coalesce(fd.capacity, 0) > 0$q$,
     $q$       where p.world_id = p_world and p.kind = 'furniture'
         and case when v_post is not null then p.x between v_px - v_pr and v_px + v_pr and p.y between v_py - v_pr and v_py + v_pr
                  else p.x between v_deed.x - v_deed.radius and v_deed.x + v_deed.radius
                   and p.y between v_deed.y - v_deed.radius and v_deed.y + v_deed.radius end
         and coalesce(fd.capacity, 0) > 0$q$)
  ) as t(sch, fn, old, new) loop
    v_n := (length(v_def) - length(replace(v_def, r.new, ''))) / length(r.new);
    if v_n <> 1 then raise exception 'stir_old.worker_feed: % of the lines to put back, not 1', v_n; end if;
    v_def := replace(v_def, r.new, r.old);
  end loop;
  execute v_def;
end $p$;
-- Every settle, written down.
create function stir_log.creature_settle(p_world uuid, p_id integer) returns boolean language plpgsql as $f$
begin
  insert into pg_temp.settled values (p_id);
  return public.creature_settle(p_world, p_id);
end $f$;

-- What the island is: every creature, every item but its id (ids come off a sequence a rollback does not give back),
-- the wall's bill, what is foraged.
create function pg_temp.snap(w uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'creatures', (select jsonb_agg(to_jsonb(c) order by c.id) from creature c where c.world_id = w),
    -- Ordered to the last column: two people's starting tools (the same thing, held, no place) tied, and came out
    -- in either order, so the two islands parted on a row neither had changed.
    'items', (select jsonb_agg(to_jsonb(i) - 'id' - 'origin' - 'origin_fn' - 'origin_uid'
                               order by i.holder, i.holder_uid, i.creature, i.inside, i.placed, i.crate, i.pannier, i.gx, i.gy, i.def, i.count, i.ql,
                                        (to_jsonb(i) - 'id' - 'origin' - 'origin_fn' - 'origin_uid')::text)
                from item i where i.world_id = w),
    'wall', (select jsonb_agg(needed order by x) from wall where world_id = w),
    'foraged', (select jsonb_agg(jsonb_build_array(x, y, kind) order by x, y, kind) from foraged where world_id = w))
$f$;
create function pg_temp.stored(w uuid, u uuid) returns bigint language sql as $f$
  select coalesce(sum((s.it).count), 0) from deed_store_items(w, u) s
$f$;
-- An hour of every worker's day: its clock put back an hour, and settled until none is due.
create function pg_temp.work_hour(w uuid) returns int language plpgsql as $f$
declare r record; i int; v_any boolean; n int := 0;
begin
  update creature set settled_at = settled_at - interval '3600 seconds', until = until - interval '3600 seconds',
         leg_at = leg_at - interval '3600 seconds', leg_ends = leg_ends - interval '3600 seconds'
   where world_id = w and mode = 'deed';
  for i in 1..400 loop
    v_any := false;
    for r in select id from creature where world_id = w and mode = 'deed' and until <= now() order by id loop
      perform creature_settle(w, r.id); v_any := true; n := n + 1;
    end loop;
    exit when not v_any;
  end loop;
  return n;
end $f$;

do $t$
declare w uuid; v_p bigint; v_near int; v_far int; v_c1 int; v_c2 int; sp text; k int; i int := 0;
        v_path text := current_setting('search_path'); v_round jsonb; v_hour jsonb; v_most int; v_comp int; v_n int;
        v_far_due boolean; v_near_due boolean; v_kept jsonb := '{}'; v_store0 bigint; v_store1 bigint; v_wall0 int; v_wall1 int; v_planks int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stirload', 515, 96, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 96);
  -- A pond to fish, two trees to fell.
  perform land_set_height(w, x, y, -20) from generate_series(${T + 6}, ${T + 12}) x, generate_series(${T + 2}, ${T + 8}) y;
  perform land_set_tile(w, x, ${T + 6}, tile_id('Tree')), land_set_data(w, x, ${T + 6}, tree_pack(0, 3)) from generate_series(${T - 8}, ${T - 7}) x;
  -- Nothing stocked by the round.
  insert into world_stocked (world_id, bx, by) values (w, 0, 0);
  update player set away = true where world_id <> w;
  perform set_config('request.jwt.claims', json_build_object('sub', '${B}')::text, true);
  perform rpc_join(w, 'Neighbour');
  perform set_config('request.jwt.claims', json_build_object('sub', '${A}')::text, true);
  perform rpc_join(w, 'Keeper');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, away = false, seen_at = now() where world_id = w and uid = '${A}';
  update player set x = ${T + 5} + 0.5, y = ${T} + 0.5, away = false, seen_at = now() where world_id = w and uid = '${B}';
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Stirstead', ${T}, ${T}, 12, 5, '${A}');
  -- Its stores.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'larder', ${T + 2}, ${T - 2}, 0, 0, ${T + 2}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_p, 'potato', 30, 20), (w, 'furniture', v_p, 'nuts', 30, 20), (w, 'furniture', v_p, 'bread', 30, 10),
    (w, 'furniture', v_p, 'meat', 30, 10), (w, 'furniture', v_p, 'apple', 30, 10), (w, 'furniture', v_p, 'acorn', 30, 10);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 3}, ${T - 2}, 0, 0, ${T + 3}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_p, 'log', 30, 12);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'craft_bin', ${T + 4}, ${T - 2}, 0, 0, ${T + 4}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_p, 'stone_brick', 30, 30), (w, 'furniture', v_p, 'mortar', 30, 15);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', ${T + 5}, ${T - 2}, 0, 0, ${T + 5}.375, ${T - 2}.375, 40, '${A}');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 2}, ${T - 4}, 0, 0, ${T + 2}.375, ${T - 4}.375, 40, '${A}');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'cupboard', ${T + 3}, ${T - 4}, 0, 0, ${T + 3}.375, ${T - 4}.375, 40, '${A}');
  -- Other people's, off the settlement, with room.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    select w, 'furniture', s, ${T + 20} + j, ${T + 20}, 0, 0, ${T + 20} + j + 0.375, ${T + 20}.375, 40, '${B}'
      from unnest(array['chest', 'bulk_bin', 'craft_bin', 'larder', 'cupboard']) with ordinality u(s, j);
  -- Logs lying about for the fetcher; a wall to fit.
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', ${T - 4}, ${T + 4}, 'log', 20, 3), (w, 'ground', ${T - 5}, ${T + 3}, 'plank', 20, 2);
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 1, '${A}');
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    select w, 0, '${wall.dir}', ${T - 4} + j, ${T - 4}, 1, 'solid', 'stone_brick', '${BILL}'::jsonb, '${BILL}'::jsonb, '${A}' from generate_series(0, 1) j;
  -- Nine workers at nine trades.
  foreach sp in array array['rabba', 'bevere', 'wadd', 'whispet', 'magga', 'rippa', 'cobbe', 'simma', 'sedra'] loop
    i := i + 1;
    k := creature_spawn(w, sp, ${T} + 0.5 + (i % 3) - 1, ${T} + 0.5 + (i / 3) - 1, 'active', now() - interval '60 days', '${A}');
    update creature set mode = 'deed', traits = '{}', settled_at = now(), until = now() where world_id = w and id = k;
  end loop;
  -- A companion each, and a wild one near and one far.
  v_c1 := creature_spawn(w, 'rabba', ${T} + 1.5, ${T} + 0.5, 'active', now() - interval '30 days', '${A}');
  v_c2 := creature_spawn(w, 'rabba', ${T + 6} + 0.5, ${T} + 0.5, 'active', now() - interval '30 days', '${B}');
  update creature set traits = '{}' where world_id = w and id in (v_c1, v_c2);
  v_near := creature_spawn(w, 'rabba', ${T + 3} + 0.5, ${T + 14} + 0.5, 'wild', now() - interval '30 days', null);
  v_far := creature_spawn(w, 'rabba', 88.5, 88.5, 'wild', now() - interval '30 days', null);
  update creature set until = now() - interval '1 second', settled_at = now() - interval '5 seconds' where world_id = w and mode = 'wild';
  v_store0 := pg_temp.stored(w, '${A}');
  select sum((needed->>'stone_brick')::int) into v_wall0 from wall where world_id = w;

  /* ---- a round of the clock, as it is and as it was ---- */
  begin
    perform set_config('search_path', 'stir_log, ' || v_path, true);
    perform setseed(0.37);
    perform world_tick();
    v_round := pg_temp.snap(w);
    select max(n) into v_most from (select count(*) n from pg_temp.settled s join creature c on c.world_id = w and c.id = s.id group by s.id) q;
    select count(*) into v_comp from pg_temp.settled where id in (v_c1, v_c2);
    select until <= now() into v_far_due from creature where world_id = w and id = v_far;
    select until <= now() into v_near_due from creature where world_id = w and id = v_near;
    -- Kept in a variable: what the block writes goes with it.
    v_kept := v_kept || jsonb_build_object('NOWMOST', v_most, 'NOWCOMP', v_comp, 'NOWFAR', v_far_due, 'NOWNEAR', v_near_due);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('ROUNDNOW', v_round::text);
  begin
    perform set_config('search_path', 'stir_log, stir_old, ' || v_path, true);
    perform setseed(0.37);
    perform world_tick();
    v_round := pg_temp.snap(w);
    select count(*) into v_comp from pg_temp.settled where id in (v_c1, v_c2);
    select until <= now() into v_far_due from creature where world_id = w and id = v_far;
    select until <= now() into v_near_due from creature where world_id = w and id = v_near;
    v_kept := v_kept || jsonb_build_object('WASCOMP', v_comp, 'WASFAR', v_far_due, 'WASNEAR', v_near_due);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('ROUNDWAS', v_round::text);

  /* ---- an hour of work, as it is and as it was ---- */
  begin
    perform set_config('search_path', v_path, true);
    perform setseed(0.61);
    v_n := pg_temp.work_hour(w);
    v_hour := pg_temp.snap(w);
    v_store1 := pg_temp.stored(w, '${A}');
    select sum((needed->>'stone_brick')::int) into v_wall1 from wall where world_id = w;
    select coalesce(sum((s.it).count), 0) into v_planks from deed_store_items(w, '${A}') s where (s.it).def = 'plank';
    v_kept := v_kept || jsonb_build_object('SETTLES', v_n, 'STORED', v_store0 || '|' || v_store1, 'WALL', v_wall0 || '|' || v_wall1,
      'PLANKS', v_planks,
      'OFFDEED', (select count(*) from item i join placed p on p.id = i.placed where p.world_id = w and p.made_by = '${B}'));
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('HOURNOW', v_hour::text);
  begin
    perform set_config('search_path', 'stir_old, ' || v_path, true);
    perform setseed(0.61);
    perform pg_temp.work_hour(w);
    v_hour := pg_temp.snap(w);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('HOURWAS', v_hour::text);
  perform set_config('search_path', v_path, true);
  insert into said select key, value #>> '{}' from jsonb_each(v_kept);
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const get = (k: string): string => said.get(k) ?? '';

/** Where two snapshots first part, for the failure line. */
const apart = (a: string, b: string): string => {
  if (a === b) return '';
  const x = JSON.parse(a || 'null') as Record<string, unknown[]> | null;
  const y = JSON.parse(b || 'null') as Record<string, unknown[]> | null;
  for (const key of Object.keys(x ?? {})) {
    const xa = (x?.[key] ?? []) as unknown[];
    const ya = (y?.[key] ?? []) as unknown[];
    for (let i = 0; i < Math.max(xa.length, ya.length); i++) {
      if (JSON.stringify(xa[i]) !== JSON.stringify(ya[i])) return `${key}[${i}]: ${JSON.stringify(xa[i]).slice(0, 400)} | ${JSON.stringify(ya[i]).slice(0, 400)}`;
    }
  }
  return 'apart';
};

check('a round of the clock leaves the island the same as the stir as it was: every creature, item and the wall',
  get('ROUNDNOW') !== '' && get('ROUNDNOW') === get('ROUNDWAS'), apart(get('ROUNDNOW'), get('ROUNDWAS')));
check('the wild one near is walked, both ways', get('NOWNEAR') === 'false' && get('WASNEAR') === 'false', `${get('NOWNEAR')}, ${get('WASNEAR')}`);
check('and the far one nobody can see is left standing due, both ways', get('NOWFAR') === 'true' && get('WASFAR') === 'true', `${get('NOWFAR')}, ${get('WASFAR')}`);
check('no creature is settled twice in a round', Number(get('NOWMOST')) === 1, `at most ${get('NOWMOST')}`);
check('and each companion once', Number(get('NOWCOMP')) === 2, `${get('NOWCOMP')} settles of two companions`);
check('where as it was each companion was settled at least twice', Number(get('WASCOMP')) >= 4, `${get('WASCOMP')} settles of two companions`);
check('an hour of every worker\'s day leaves the island the same as the stir as it was, creature for creature and item for item',
  get('HOURNOW') !== '' && get('HOURNOW') === get('HOURWAS'), apart(get('HOURNOW'), get('HOURWAS')));
const [s0, s1] = get('STORED').split('|').map(Number);
const [w0, w1] = get('WALL').split('|').map(Number);
check('and the work was done: more in the stores', s1 > s0, `${s0} before, ${s1} after, in ${get('SETTLES')} settles`);
check('planks sawn from the logs', Number(get('PLANKS')) > 0, `${get('PLANKS')} planks`);
check('the wall fitted', w1 < w0, `${w0} stone bricks wanted before, ${w1} after`);
check('and nothing put away in anybody else\'s furniture off the settlement', get('OFFDEED') === '0', get('OFFDEED'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a cheaper stir, the same island — ${ok.length} of ${ok.length}`);
