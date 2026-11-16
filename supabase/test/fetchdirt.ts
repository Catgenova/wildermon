/**
 * Dirt dropped on dug ground: a Hoardback picks it up from the tile beside it.
 *
 * Reported: "Hoardback will not pick up dirt on the settlement ground to bring to raw material bin named Dirt". Dirt is
 * dropped where its digger stands, at the dig: ground steeper than a worker stands on, or under the water. A fetcher
 * asked whether it could stand on the tile the dirt lay on and passed it over (`20261120000120_fetch_from_beside.sql`).
 * Asked of the island and of the browser, the same settlement, once with a raw material bin named "Dirt" and once with
 * it unnamed:
 *
 *   * dirt on flat ground, on a tile with a corner `STEEP` up (over `MAX_STAND`) and on a tile with a corner under the
 *     water, all carried to the bin;
 *   * dirt on a tile with nowhere beside it to stand left lying;
 *   * idle after, the same reason on both sides;
 *   * and the same loads on both sides, in the order each side's search finds them.
 *
 * The island half makes its own islands and rolls them back.
 */
import { Game } from '../../src/game/game';
import { type Creature } from '../../src/game/creatures';
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { type Item } from '../../src/game/items';
import { MAX_STAND } from '../../src/game/player';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000b01';
const DEED = 'Dirtstead';
const BIN = [T - 4, T] as const;
// Where the dirt lies, and how many.
const FLAT = [T + 3, T + 2, 5] as const;
const STEEP_AT = [T + 5, T - 3, 4] as const;
const WET = [T - 3, T + 5, 2] as const;
const SUNK = [T + 6, T + 6, 1] as const;
const STEEP = MAX_STAND + 30;
const DEEP = -20;
const CARRIED = FLAT[2] + STEEP_AT[2] + WET[2];

/* ---- the browser ------------------------------------------------------------- */

type Side = { SEQ: string; BIN: string; GROUND: string; IDLE: string };

const browserRun = (name: string | null): Side => {
  const g = Game.create(259, 512);
  const w = g.world;
  w.water = null;
  w.heights.fill(0);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  // A corner up past what a worker stands on; a corner under the water; a tile with every corner under it.
  w.setHeight(STEEP_AT[0], STEEP_AT[1], STEEP);
  w.setHeight(WET[0], WET[1], DEEP);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.setHeight(SUNK[0] + dx, SUNK[1] + dy, DEEP);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: DEED, x: T, y: T, radius: 10, level: 5 };
  let uid = 1;
  const it = (id: string, count: number): Item => ({ uid: uid++, id, ql: 30, dmg: 0, count });
  const bin = g.addFurniture('bulk_bin', BIN[0], BIN[1], 0, 0, 50, []);
  if (name !== null) bin.name = name;
  for (const [x, y, n] of [FLAT, STEEP_AT, WET, SUNK]) g.dropOnGround(x, y, it('dirt', n));
  const magga = g.creatures.spawn('magga', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
  magga.traits = [];
  const step = (c: Creature): void =>
    (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
  const seq: string[] = [];
  let last = '';
  for (let t = 0; t < 900; t += 0.25) {
    g.time += 0.25;
    magga.hunger = 1;
    step(magga);
    const now = magga.carrying ? `${magga.carrying.id}:${magga.carrying.count}` : '';
    if (now !== last && now) seq.push(now);
    last = now;
  }
  const n = (f: PlacedFurniture): number => f.items.filter((x) => x.id === 'dirt').reduce((k, x) => k + x.count, 0);
  const ground: string[] = [];
  for (const [x, y] of [FLAT, STEEP_AT, WET, SUNK]) for (const i of g.groundAt(x, y)) ground.push(`${i.id}:${i.count}@${x},${y}`);
  return { SEQ: seq.join(','), BIN: String(n(bin)), GROUND: ground.join(' '), IDLE: magga.idle?.why ?? '' };
};

const browser = { named: browserRun('Dirt'), unnamed: browserRun(null) };

/* ---- the island ---------------------------------------------------------------- */

const binCentre = (() => {
  const g = Game.create(259, 512);
  return furnitureCentre(g.addFurniture('bulk_bin', BIN[0], BIN[1], 0, 0, 50, [])).join(', ');
})();

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.settle(w uuid, m int, n int) returns text language plpgsql as $f$
declare i int; seq text := ''; v_now text; v_last text := '';
begin
  for i in 1..n loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
    select coalesce((carrying->>'def') || ':' || coalesce(carrying->>'count', '1'), '') into v_now from creature where world_id = w and id = m;
    if v_now <> v_last and v_now <> '' then seq := seq || case when seq = '' then '' else ',' end || v_now; end if;
    v_last := v_now;
  end loop;
  return seq;
end $f$;
create function pg_temp.run(p_k text, p_name text) returns void language plpgsql as $f$
declare w uuid; u uuid := '${U}'; m int; v_bin bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fetchdirt ' || p_k, 259, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform land_set_height(w, ${STEEP_AT[0]}, ${STEEP_AT[1]}, ${STEEP});
  perform land_set_height(w, ${WET[0]}, ${WET[1]}, ${DEEP});
  perform land_set_height(w, ${SUNK[0]} + dx, ${SUNK[1]} + dy, ${DEEP}) from (values (0, 0), (1, 0), (0, 1), (1, 1)) v(dx, dy);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Digger');
  delete from deed where founded_by = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, '${DEED}', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 1.5, y = ${T} + 9.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'bulk_bin', ${BIN[0]}, ${BIN[1]}, 0, 0, ${binCentre}, 50, u, p_name) returning id into v_bin;
  perform drop_on_ground(w, g.x, g.y, 'dirt', 30, null, g.n)
     from (values (${FLAT.join(', ')}, 1), (${STEEP_AT.join(', ')}, 2), (${WET.join(', ')}, 3), (${SUNK.join(', ')}, 4)) g(x, y, n, o)
    order by g.o;
  insert into said select p_k || ':STAND', string_agg(creature_tile_ok(w, g.x, g.y)::text, ',' order by g.o)
     from (values (${FLAT[0]}, ${FLAT[1]}, 1), (${STEEP_AT[0]}, ${STEEP_AT[1]}, 2), (${WET[0]}, ${WET[1]}, 3), (${SUNK[0]}, ${SUNK[1]}, 4)) g(x, y, o);
  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = null, post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;
  insert into said values (p_k || ':SEQ', pg_temp.settle(w, m, 120));
  insert into said select p_k || ':BIN', coalesce(sum(count), 0)::text from item where placed = v_bin and def = 'dirt';
  insert into said select p_k || ':GROUND', coalesce(string_agg(def || ':' || count || '@' || gx || ',' || gy, ' ' order by id), '')
    from item where world_id = w and holder = 'ground';
  insert into said select p_k || ':IDLE', coalesce(idle_why, '') from creature where world_id = w and id = m;
end $f$;
select pg_temp.run('named', 'Dirt');
select pg_temp.run('unnamed', null);
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- the two side by side ---------------------------------------------------- */

check('the ground: flat stood on; a corner up past what a worker stands on, a corner under the water and every corner under it not',
  isle.get('named:STAND') === 'true,false,false,false', isle.get('named:STAND'));
const LEFT = `dirt:${SUNK[2]}@${SUNK[0]},${SUNK[1]}`;
for (const [k, says] of [['named', 'a raw material bin named "Dirt"'], ['unnamed', 'an unnamed raw material bin']] as const) {
  const b = browser[k];
  check(`${says}: all ${CARRIED} dirt off flat, steep and wet ground carried into it, on both sides`,
    isle.get(`${k}:BIN`) === String(CARRIED) && b.BIN === String(CARRIED), `${isle.get(`${k}:BIN`)} / ${b.BIN}`);
  check(`${says}: the dirt with nowhere beside it to stand left lying, on both sides`,
    isle.get(`${k}:GROUND`) === LEFT && b.GROUND === LEFT, `${isle.get(`${k}:GROUND`)} / ${b.GROUND}`);
  // The order is the search's: nearest first in the browser, a ring at a time in a random order on the island.
  const loads = (seq: string | undefined): string => (seq ?? '').split(',').filter(Boolean).sort().join(',');
  check(`${says}: the same loads on both sides`, loads(isle.get(`${k}:SEQ`)) === loads(b.SEQ) && b.SEQ !== '',
    `${isle.get(`${k}:SEQ`)} / ${b.SEQ}`);
  check(`${says}: idle after for the same reason on both sides`, isle.get(`${k}:IDLE`) === b.IDLE && b.IDLE !== '',
    `${isle.get(`${k}:IDLE`)} / ${b.IDLE}`);
}

finish('dirt dropped on dug ground');
