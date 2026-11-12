/**
 * The stocking clock, cheaper and the same: `stock_tick` stops at one question when nothing is owed, and `near_tile`
 * reads each line it looks at once (20261101320100).
 *
 * Asked of an island of its own, 1024 a side, its ground made up here line by line from a formula (every tile kind
 * the stocking asks about, hills, and water under nought), with a spring and a pool in a foundation on it:
 *
 *   * `near_tile` gives the answer it gave before, for every kind it is asked about, at every point of a sample that
 *     takes in the island's edges and corners, the spring and the pool;
 *   * ninety minutes of island time, a turn of the clock a minute, six bodies walking about and one stepping into a
 *     block on the island's edge: the clock as it was and the clock as it is put out the same blocks on the same
 *     turns, the same wildlife in the same places, and leave every block and island stamped the same.
 *
 * The clock as it was is put back inside a transaction, run, and rolled back; both runs start from the same seed.
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

const W = '00000000-0000-4000-8000-00000005707c';
const SIZE = 1024;

/** The island, made the same way every time: nothing in it is random. */
const ISLAND = `
update player set away = true where not away;
insert into world (id, name, seed, size, spawn_x, spawn_y, ready) values ('${W}', 'Stockyard', 1, ${SIZE}, 512, 512, true);
-- A tile kind for every hash band: grass, trees, clay, sand, rock, tar, peat, marsh, steppe, moss.
insert into land_tile (world_id, y, tiles, data, rock)
select '${W}', y,
       decode(string_agg(lpad(to_hex(case
         when h < 300 then 0 when h < 420 then 16 when h < 470 then 8 when h < 540 then 3 when h < 620 then 4
         when h < 650 then 10 when h < 680 then 9 when h < 720 then 7 when h < 800 then 5 when h < 860 then 11
         else 0 end), 2, '0'), '' order by x), 'hex'),
       decode(repeat('00', ${SIZE}), 'hex'), decode(repeat('00', ${SIZE}), 'hex')
  from (select x, y, ((x::bigint * 73856093) # (y::bigint * 19349663)) & 1023 as h
          from generate_series(0, ${SIZE - 1}) x, generate_series(0, ${SIZE - 1}) y) t
 group by y;
-- Hills and hollows, a third of them under water.
insert into land_corner (world_id, y, heights, dirt)
select '${W}', y,
       decode(string_agg(lpad(to_hex(v & 255), 2, '0') || lpad(to_hex((v >> 8) & 255), 2, '0'), '' order by x), 'hex'),
       decode(repeat('00', ${SIZE + 1}), 'hex')
  from (select x, y, (round(60 * sin(x / 37.0) + 50 * cos(y / 23.0) + 20 * sin((x + y) / 11.0)) - 20)::int as v
          from generate_series(0, ${SIZE}) x, generate_series(0, ${SIZE}) y) c
 group by y;
-- A spring on high ground and a pool poured in a foundation, both well clear of the water.
insert into spring (id, world_id, x, y, cx, cy) values (990000001, '${W}', 700, 300, 700, 300);
insert into spring_tile (world_id, x, y, spring_id, pond, level) values ('${W}', 700, 300, 990000001, 0, 1);
insert into foundation (world_id, id, x, y, top, needed, total, pool) values ('${W}', 990000002, 300, 700, 0, '{}', '{}', true);
`;

const NEAR_WAS = `
create function pg_temp.near_tile_was(p_world uuid, p_x integer, p_y integer, p_what text, p_range integer default 4)
returns boolean language sql stable as $fn$
  select exists (
    select 1 from generate_series(p_x - p_range, p_x + p_range) gx,
                  generate_series(p_y - p_range, p_y + p_range) gy
    where in_bounds(p_world, gx, gy)
      and case p_what
        when 'water' then has_water(p_world, gx, gy)
        when 'clay'  then land_tile(p_world, gx, gy) = tile_id('Clay')
        when 'trees' then land_tile(p_world, gx, gy) = tile_id('Tree')
        when 'tar'   then land_tile(p_world, gx, gy) in (tile_id('Tar'), tile_id('Peat'), tile_id('Marsh'))
        else false end)
$fn$;
`;

/* ---- near_tile, point for point ----------------------------------------- */
const near = psql(`
begin;
${ISLAND}
${NEAR_WAS}
create temp table pts (x int, y int);
-- The edges, the corners, just off the island, the spring and the pool, and a scatter over the rest.
insert into pts select x, y from unnest(array[-5, -1, 0, 1, 3, 4, 5, 511, 512, ${SIZE - 5}, ${SIZE - 4}, ${SIZE - 1}, ${SIZE}, ${SIZE + 4}]) x,
                                 unnest(array[-5, -1, 0, 1, 3, 4, 5, 511, 512, ${SIZE - 5}, ${SIZE - 4}, ${SIZE - 1}, ${SIZE}, ${SIZE + 4}]) y;
insert into pts select 700 + dx, 300 + dy from generate_series(-6, 6) dx, generate_series(-6, 6) dy;
insert into pts select 300 + dx, 700 + dy from generate_series(-6, 6) dx, generate_series(-6, 6) dy;
insert into pts select (g * 7919) % ${SIZE}, (g * 104729) % ${SIZE} from generate_series(1, 1500) g;
select count(*) || '|' || count(*) filter (where was is distinct from now_) || '|'
    || count(*) filter (where now_) || '|' || coalesce(string_agg(distinct what, ',') filter (where now_), '') || '|'
    || coalesce(string_agg(distinct what, ',') filter (where not now_), '') || '|'
    || coalesce(min(format('%s %s,%s was %s now %s', what, x, y, was, now_)) filter (where was is distinct from now_), '-')
  from (select p.x, p.y, k.what, pg_temp.near_tile_was('${W}', p.x, p.y, k.what) as was, near_tile('${W}', p.x, p.y, k.what) as now_
          from pts p cross join unnest(array['water', 'trees', 'clay', 'tar', 'nothing']) k(what)) q;
-- And the spring and the pool on their own: high and dry but for them.
select 'SPRING|' || near_tile('${W}', 700, 300, 'water', 0) || '|' || pg_temp.near_tile_was('${W}', 700, 300, 'water', 0)
    || '|' || near_tile('${W}', 300, 700, 'water', 0) || '|' || pg_temp.near_tile_was('${W}', 300, 700, 'water', 0)
    || '|' || has_water('${W}', 701, 300);
rollback;`).split('\n');
const [asked, differ, yes, kindsYes, kindsNo, first] = near[0].split('|');
check('near_tile says what it said before, at every point and for every kind asked',
  differ === '0' && Number(asked) > 8000, `${differ} of ${asked} differ${differ === '0' ? '' : `: ${first}`}`);
check('and the sample asks both ways for every kind there is: some near, some not',
  kindsYes === 'clay,tar,trees,water' && kindsNo === 'clay,nothing,tar,trees,water', `near: ${kindsYes}; not: ${kindsNo}; ${yes} near`);
check('a spring and a pool in a foundation are water, on ground that is not', near[1] === 'SPRING|true|true|true|true|false', near[1]);

/* ---- the clock, as it was and as it is ---------------------------------- */
const STOCK_WAS = `
create or replace function stock_tick() returns jsonb language plpgsql as $fn$
declare w record; p record; v_put int := 0; v_worlds int := 0;
begin
  if not pg_try_advisory_lock(hashtext('stock_tick')::bigint) then
    return jsonb_build_object('worlds', 0, 'busy', true);
  end if;
  for w in
    select id from world where ready and exists (
      select 1 from player
      where player.world_id = world.id and not player.away
        and player.seen_at > now() - make_interval(secs => idle_logout()))
    order by stocked_at limit tick_worlds()
  loop
    v_worlds := v_worlds + 1;
    update world set stocked_at = now() where id = w.id;
    for p in select distinct floor(x) as x, floor(y) as y from player
      where world_id = w.id and not away
        and seen_at > now() - make_interval(secs => idle_logout())
      order by 1, 2 limit tick_players()
    loop
      exit when v_put >= stock_a_round();
      v_put := v_put + creature_stock_ahead(w.id, p.x, p.y, stock_a_round() - v_put);
    end loop;
    exit when v_put >= stock_a_round();
  end loop;
  perform pg_advisory_unlock(hashtext('stock_tick')::bigint);
  return jsonb_build_object('worlds', v_worlds, 'blocks', v_put);
end $fn$;
${NEAR_WAS.replace('create function pg_temp.near_tile_was', 'create or replace function near_tile')}
`;

const STEPS = 90;
const replay = (was: boolean): { lines: string[]; ms: number } => {
  const t0 = Date.now();
  const out = psql(`
begin;
${ISLAND}
${was ? STOCK_WAS : ''}
create temp table turn (i int, said text, wild int, ms double precision);
select setseed(0.25);
do $$
declare w uuid := '${W}'; i int; v_j int; r jsonb; t timestamptz;
begin
  for v_j in 1 .. 6 loop
    insert into player (world_id, uid, name, x, y)
    values (w, ('00000000-0000-4000-8000-0000000000' || lpad(v_j::text, 2, '0'))::uuid, 'Walker ' || v_j, 300 + v_j * 50 + 0.5, 300 + v_j * 40 + 0.5);
  end loop;
  for i in 1 .. ${STEPS} loop
    -- A minute of island time: everything stocked is a minute older.
    update world_stocked set at = at - interval '1 minute' where world_id = w;
    -- They walk inside the inner blocks, where every block round them is on the island; the sixth stands
    -- for ten minutes in a block on the island's western edge.
    update player p set x = case when j = 6 and i between 70 and 80 then 100.5
                                 else 290 + ((i * 7 * j + j * 31) % 420) + 0.5 end,
                        y = 290 + ((i * 3 + j * 53) % 420) + 0.5
      from (select uid, right(name, 1)::int as j from player where world_id = w) q
     where p.world_id = w and p.uid = q.uid and (i % 9 = 0 or i = 1 or i = 70 or i = 81);
    t := clock_timestamp();
    r := stock_tick();
    insert into turn values (i, r::text, (select count(*) from creature where world_id = w and mode = 'wild'),
                             extract(epoch from clock_timestamp() - t) * 1000);
  end loop;
end $$;
select 'TURN|' || i || '|' || said || '|' || wild || '|' || round(ms::numeric, 2) from turn order by i;
select 'STOCKED|' || coalesce(string_agg(bx || ',' || by || '@' || extract(epoch from now() - at)::int, ' ' order by bx, by), '')
  from world_stocked where world_id = '${W}';
select 'STAMP|' || (stocked_at = now()) from world where id = '${W}';
select 'WILD|' || count(*) || '|' || md5(coalesce(string_agg(r, '' order by r), '')) from (
  select (select jsonb_object_agg(k, case when jsonb_typeof(v) = 'string' and v #>> '{}' ~ '^\\d{4}-\\d\\d-\\d\\dT'
                                          then to_jsonb(extract(epoch from (v #>> '{}')::timestamptz - now()))
                                          else v end)
            from jsonb_each(to_jsonb(c) - 'id') e(k, v))::text as r
    from creature c where c.world_id = '${W}') q;
rollback;`);
  return { lines: out.split('\n'), ms: Date.now() - t0 };
};

const before = replay(true);
const after = replay(false);
const pick = (lines: string[], key: string): string[] => lines.filter((l) => l.startsWith(`${key}|`));
const turns = (lines: string[]): string[] => pick(lines, 'TURN').map((l) => l.split('|').slice(0, 4).join('|'));
const ms = (lines: string[]): number[] => pick(lines, 'TURN').map((l) => Number(l.split('|')[4]));

const tb = turns(before.lines);
const ta = turns(after.lines);
const firstDiff = tb.findIndex((l, i) => l !== ta[i]);
check(`${STEPS} turns of the clock put out the same blocks on the same turns, with the same head of wildlife after each`,
  tb.length === STEPS && ta.length === STEPS && firstDiff < 0,
  firstDiff < 0 ? `${tb.length} turns alike` : `turn ${firstDiff + 1}: ${tb[firstDiff]} against ${ta[firstDiff]}`);
const put = tb.filter((l) => l.includes('"blocks": 1')).length;
const idle = tb.filter((l) => l.includes('"blocks": 0')).length;
check('and the span takes in turns that put a block out and turns with nothing owed', put >= 16 && idle >= 30,
  `${put} turns put a block out, ${idle} had nothing owed`);
check('every block is stamped the same', pick(before.lines, 'STOCKED')[0] === pick(after.lines, 'STOCKED')[0]
  && pick(after.lines, 'STOCKED')[0].split(' ').length >= 16, pick(after.lines, 'STOCKED')[0]?.slice(0, 80));
check('and the island', pick(before.lines, 'STAMP')[0] === pick(after.lines, 'STAMP')[0]
  && pick(after.lines, 'STAMP')[0] === 'STAMP|true', pick(after.lines, 'STAMP')[0]);
check('the same wildlife, in the same places, of the same ages', pick(before.lines, 'WILD')[0] === pick(after.lines, 'WILD')[0]
  && Number(pick(after.lines, 'WILD')[0]?.split('|')[1]) > 0, `${pick(before.lines, 'WILD')[0]} against ${pick(after.lines, 'WILD')[0]}`);

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const quiet = (lines: string[]): number[] => ms(lines).filter((_, i) => turns(lines)[i].includes('"blocks": 0'));
const busy = (lines: string[]): number[] => ms(lines).filter((_, i) => turns(lines)[i].includes('"blocks": 1'));
console.log(`  a turn with nothing owed: ${(sum(quiet(before.lines)) / Math.max(1, quiet(before.lines).length)).toFixed(2)} ms before, `
  + `${(sum(quiet(after.lines)) / Math.max(1, quiet(after.lines).length)).toFixed(2)} ms after`);
console.log(`  a turn that puts a block out: ${(sum(busy(before.lines)) / Math.max(1, busy(before.lines).length)).toFixed(0)} ms before, `
  + `${(sum(busy(after.lines)) / Math.max(1, busy(after.lines).length)).toFixed(0)} ms after`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`the stocking clock, cheaper and the same — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
