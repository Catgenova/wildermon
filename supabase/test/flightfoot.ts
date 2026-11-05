/**
 * A worker stands at the foot of a flight a storey up, where the flight below comes off.
 *
 * Reported: "Find out why my bastiondrakes cant go up my stairs now". In Solara Manor a staircase climbs north two
 * storeys in a line: a flight up to storey 2 at 2580, 3024, and the flight on up to storey 3 on the tile after it,
 * 2580, 3025, where the first comes off. A wall planned on storey 2 on the north side of 2580, 3025 is fitted standing
 * on that tile, at the foot of the second flight; the way there (`creature_way`) went on up the second flight every
 * time and never stopped at its foot, so there was no way, and both Bastiondrakes stood with `stairs`, storey 2, with
 * 60 other pieces they could reach.
 *
 * The same in one rolled-back settlement: a flight up to storey 2 at T+1, T+1 climbed northward, the flight up to
 * storey 3 at T+1, T+2, a floor under it, and a wall planned on storey 2 on that tile's north side. The way from the
 * ground to that tile on storey 2 is found and ends there; the way on up to storey 3 still climbs both flights; and a
 * hod carrier with mortar in the stores fits the wall and never says `stairs`.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

const T = 40;
const U = '7e5b0000-0000-4000-8000-00000000f007';
/** The first flight, up to storey 2, climbed northward from its foot at T+1, T. */
const UP1 = [T + 1, T + 1] as const;
/** The second, up to storey 3, on the tile the first comes off onto. */
const UP2 = [T + 1, T + 2] as const;
const FLOOR1 = [[T + 1, T + 2], [T + 2, T + 2], [T + 1, T + 3], [T + 2, T + 3], [T + 2, T + 1]];
const FLOOR2 = [[T + 1, T + 3], [T + 2, T + 3]];
const TOP = [T + 2, T + 3] as const;
const STORE = [T - 3, T - 3] as const;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_hod int; v_store bigint; i int; c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stairfoot', 381, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 12}, ${T + 12}) x, generate_series(${T - 12}, ${T + 12}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Stairfoot');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Stairfoot', ${T}, ${T}, 12, 1, u);
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Manor', 3, u);
  insert into building_tile (world_id, building, x, y)
    select w, 1, x, y from generate_series(${T}, ${T + 3}) x, generate_series(${T}, ${T + 4}) y;
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${FLOOR1.map(([x, y]) => `(w, 1, ${x}, ${y}, 1, 'plank', 'floor', null, '{}', '{}', u)`).join(', ')},
    ${FLOOR2.map(([x, y]) => `(w, 2, ${x}, ${y}, 1, 'plank', 'floor', null, '{}', '{}', u)`).join(', ')},
    (w, 1, ${UP1[0]}, ${UP1[1]}, 1, 'plank', 'stairs', 'n', '{}', '{}', u),
    (w, 2, ${UP2[0]}, ${UP2[1]}, 1, 'plank', 'stairs', 'n', '{}', '{}', u);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 1, 'h', ${UP2[0]}, ${UP2[1]}, 1, 'solid', 'plank', '{"mortar": 2}', '{"mortar": 2}', u);

  insert into said values ('FOOT', coalesce(array_to_string(creature_way(w, ${T - 2}, ${T - 2}, 0, ${UP2[0]}, ${UP2[1]}, 1), ','), 'null'));
  insert into said values ('TOP', coalesce(array_to_string(creature_way(w, ${T - 2}, ${T - 2}, 0, ${TOP[0]}, ${TOP[1]}, 2), ','), 'null'));
  insert into said values ('DOWN', coalesce(array_to_string(creature_way(w, ${UP2[0]}, ${UP2[1]}, 1, ${T - 2}, ${T - 2}, 0), ','), 'null'));
  insert into said select 'STAND', s.x || ',' || s.y || ',' || s.l from hod_stand(w, 'wall', 1, 'h', ${UP2[0]}, ${UP2[1]}) s;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values
    (w, 'furniture', 'chest', ${STORE[0]}, ${STORE[1]}, 0, 0, ${STORE[0]} + 0.375, ${STORE[1]} + 0.375, 40, u) returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'mortar', 30, 6);
  v_hod := creature_spawn(w, 'cobbe', ${T - 2} + 0.5, ${T - 2} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         from_x = to_x, from_y = to_y, until = now() - interval '1 millisecond', leg_at = now() - interval '1 millisecond',
         leg_ends = now() - interval '1 millisecond'
   where world_id = w and id = v_hod;
  for i in 1..80 loop
    update creature set worn = 0, hunger = 1, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_hod;
    perform worker_settle(w, v_hod);
    select * into c from creature where world_id = w and id = v_hod;
    if c.idle_why = 'stairs' then insert into said values ('SAID_STAIRS', i::text); end if;
    if c.storey = 1 and floor(c.to_x) = ${UP2[0]} and floor(c.to_y) = ${UP2[1]} then insert into said values ('AT_FOOT', i::text); end if;
  end loop;
  insert into said select 'WALL', needed::text from wall where world_id = w and level = 1 and dir = 'h' and x = ${UP2[0]} and y = ${UP2[1]};
end $t$;
select k || '=' || v from said;
rollback;`);
const said = new Map<string, string[]>();
for (const l of out.split('\n').filter((s) => s.includes('='))) {
  const k = l.slice(0, l.indexOf('='));
  said.set(k, [...(said.get(k) ?? []), l.slice(l.indexOf('=') + 1)]);
}
const at = (k: string): string => said.get(k)?.[0] ?? '(not said)';
const triples = (s: string): string[] => {
  const n = s.split(',');
  const r: string[] = [];
  for (let i = 0; i + 2 < n.length; i += 3) r.push(`${n[i]},${n[i + 1]},${n[i + 2]}`);
  return r;
};

check('a wall on storey 2 on the north side of the second flight\'s tile is fitted standing on that tile', at('STAND') === `${UP2[0]},${UP2[1]},1`, at('STAND'));
const foot = triples(at('FOOT'));
check('the way from the ground to the foot of the second flight, on storey 2, is found',
  at('FOOT') !== 'null' && foot.at(-1) === `${UP2[0]},${UP2[1]},1`, at('FOOT'));
check('and goes up the first flight to it', foot.includes(`${UP1[0]},${UP1[1]},1`), at('FOOT'));
const top = triples(at('TOP'));
check('the way on up to storey 3 still climbs both flights',
  top.includes(`${UP1[0]},${UP1[1]},1`) && top.includes(`${UP2[0]},${UP2[1]},2`) && top.at(-1) === `${TOP[0]},${TOP[1]},2`, at('TOP'));
check('from the foot of the second flight, a way down to the ground', at('DOWN') !== 'null', at('DOWN'));
check('a hod carrier never says stairs for that wall', !said.has('SAID_STAIRS'), (said.get('SAID_STAIRS') ?? []).join(','));
check('it walks to the foot of the second flight on storey 2', said.has('AT_FOOT'), (said.get('AT_FOOT') ?? []).slice(0, 3).join(','));
check('and fits the wall', at('WALL') === '{"mortar": 0}', at('WALL'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe foot of a flight a storey up — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
