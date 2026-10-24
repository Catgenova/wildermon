/**
 * A body a storey up with nothing under it, on both sides.
 *
 * Reported from the island: a rider driving a wagon behind a team of four
 * was stored a storey up on the tile at a wide staircase's foot, where there
 * is no floor up there. No path leads off such a tile and nobody gets down
 * there (`MOUNT_STOREY_SAID`), so the rider, the seat and the team were stuck.
 * The word that went up the flight was pulled back to its pace onto the foot,
 * and kept the storey it was going to (`rpc_move`).
 *
 * On a house with a wide staircase on (54, 44) climbed from the west, its
 * foot out on the ground at (53, 44), and a finished floor on (55, 44):
 *
 *   * the browser: a rider driving a wagon, put at the foot on storey 2 (the
 *     stuck state), finds no path anywhere; the next frame lets it down onto
 *     the ground (`Game.footing`), with the wagon, its team and the mount, and
 *     a path is found from there; nobody on the flight or the floor up there
 *     is let down;
 *   * the island: the same body, stored at the foot on storey 2, is let down
 *     onto the ground by the word the browser sends from there, and by an old
 *     word still on storey 2 (`storey_footing`), its wagon with it
 *     (`drag_along`) and its mount sent on the ground (`rpc_creatures`);
 *   * a word up the flight pulled back to its pace onto the foot stays on the
 *     ground, and one down off it claiming storey 2 on the foot does not get
 *     there; a word up the flight its pace allows is not held back.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding, and Dane on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { furnitureCentre } from '../../src/game/furniture';
import { TOP_LEVELS } from '../../src/game/building';
import { pathOptions } from '../../src/game/player';
import { findPath } from '../../src/world/pathfinding';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

let bad = 0;
let good = 0;
const check = (what: string, ok: boolean, detail = ''): void => {
  if (ok) good++;
  else bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const answers = (out: string): Map<string, string> =>
  new Map(out.split('\n~~\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

const H = 30;
const HOUSE = { id: 9411, name: 'Stuck house' };
const MAT = 'plank';
const FOOT = { x: 53, y: 44 };
const STUCK = { x: 53.4, y: 44.5 };

/* ---- the browser ---------------------------------------------------------------- */

const g = Game.create(9411, 64);
for (let y = 40; y <= 50; y++) for (let x = 50; x <= 62; x++) g.world.setHeight(x, y, H);
for (let y = 40; y < 50; y++) for (let x = 50; x < 62; x++) g.world.setTile(x, y, TileType.PackedDirt, 0);
const house = g.buildings.create(HOUSE.name, 54, 44);
g.buildings.addTile(house, 55, 44);
house.levels = 2;
house.workLevel = 1;
const done = (f: { needed: Record<string, number> }): void => { for (const k of Object.keys(f.needed)) f.needed[k] = 0; };
const flight = g.buildings.setFloor(house, 1, 54, 44, MAT, 'stairs', 'w');
done(flight);
const floor = g.buildings.setFloor(house, 1, 55, 44, MAT, 'floor');
done(floor);
const BORN = g.time - 3600 * 24 * 60;
const greyfell = g.creatures.spawn('orse', STUCK.x, STUCK.y, 'active', g.rand, BORN);
greyfell.tacked = true;
greyfell.hunger = 1;
g.player.x = STUCK.x;
g.player.y = STUCK.y;
g.player.level = 0;
check('a grown orse, saddled, is mounted on the ground', g.mount(greyfell) && g.mounted() === greyfell);
const wagon = g.addFurniture('wagon', FOOT.x, FOOT.y, 0, 0, 50, [], undefined, 'w');
wagon.driven = true;
const team = [0, 1, 2, 3].map(() => {
  const c = g.creatures.spawn('orse', FOOT.x - 1.5, FOOT.y + 0.5, 'active', g.rand, BORN);
  c.hitchedTo = wagon.id;
  return c;
});
wagon.team = team.map((c) => c.id);
check('and a wagon is driven behind a team of four', g.driving() === wagon && g.team(wagon).length === 4, `${g.team(wagon).length}`);

// The stuck state: the foot of the flight, on storey 2.
g.player.level = 1;
wagon.level = 1;
const { rule } = g.movement();
const stuckWay = findPath(g.world, FOOT.x, FOOT.y, 1, 51, 44, { ...pathOptions(g.world, rule, TOP_LEVELS), goalLevel: 0 });
check('at the foot of the flight on storey 2 no path leads anywhere', !stuckWay, stuckWay ? stuckWay.map((p) => `${p.x},${p.y}@${p.level}`).join(' ') : 'no way');
check('nothing under it there: let down onto the ground; on the flight and the floor up there, not let down',
  g.footing(FOOT.x, FOOT.y, 1) === 0 && g.footing(54, 44, 1) === 1 && g.footing(55, 44, 1) === 1 && g.footing(55, 44, 2) === 1,
  `foot ${g.footing(FOOT.x, FOOT.y, 1)}, flight ${g.footing(54, 44, 1)}, floor ${g.footing(55, 44, 1)}, over the floor ${g.footing(55, 44, 2)}`);
g.update(0.05);
check('the next frame has the body on the ground', g.player.level === 0, `${g.player.level}`);
check('and the wagon, its team and the mount with it',
  (wagon.level ?? 0) === 0 && team.every((c) => g.creatureStorey(c) === 0) && g.creatureStorey(greyfell) === 0,
  `wagon ${wagon.level ?? 0}, team ${team.map((c) => g.creatureStorey(c)).join(',')}, mount ${g.creatureStorey(greyfell)}`);
const outWay = findPath(g.world, FOOT.x, FOOT.y, 0, 51, 44, { ...pathOptions(g.world, g.movement().rule, TOP_LEVELS), goalLevel: 0 });
check('and a path leads off from there', !!outWay, outWay ? outWay.map((p) => `${p.x},${p.y}@${p.level}`).join(' ') : 'no way');
g.player.x = 54.5;
g.player.level = 1;
g.update(0.05);
check('on the flight up there it stays up there', g.player.level === 1, `${g.player.level}`);

/* ---- the island ------------------------------------------------------------------- */

const [wcx, wcy] = furnitureCentre(wagon);
const SCENE = `
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  delete from building b where b.world_id = w and (b.id = ${HOUSE.id} or exists (select 1 from building_tile bt
    where bt.world_id = w and bt.building = b.id and bt.x between 50 and 62 and bt.y between 40 and 50));
  delete from placed where world_id = w and x between 50 and 62 and y between 40 and 50;
  for gx in 50..62 loop for gy in 40..50 loop
    perform land_set_height(w, gx, gy, ${H});
    if gx < 62 and gy < 50 then perform land_set_tile(w, gx, gy, tile_id('Packed dirt')); end if;
  end loop; end loop;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${HOUSE.id}, '${HOUSE.name}', 2, 1, me);
  insert into building_tile (world_id, building, x, y) values (w, ${HOUSE.id}, 54, 44), (w, ${HOUSE.id}, 55, 44);
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total) values
    (w, 1, 54, 44, ${HOUSE.id}, '${MAT}', 'stairs', 'w', '${JSON.stringify(flight.needed)}', '${JSON.stringify(flight.total)}'),
    (w, 1, 55, 44, ${HOUSE.id}, '${MAT}', 'floor', null, '${JSON.stringify(floor.needed)}', '${JSON.stringify(floor.total)}');
  update creature set rider = null where world_id = w and rider = me;
  delete from placed where world_id = w and (driver = me or puller = me);
  update player set body_at = now(), x = ${STUCK.x}, y = ${STUCK.y}, level = 0, level_h = null, act = null, act_queue = '[]'::jsonb,
         aboard = null, away = false, walk_ahead = 0, moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
  v_mount := creature_spawn(w, 'orse', ${STUCK.x}, ${STUCK.y}, 'active', now() - interval '60 days', me);
  update creature set keeper = me, hunger = 1, tacked = true where world_id = w and id = v_mount;
  perform perform_ride(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_mount));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, driver)
    values (w, 'furniture', 'wagon', ${FOOT.x}, ${FOOT.y}, 0, 0, ${wcx}, ${wcy}, 50, me, 'w', me) returning id into v_wagon;
  for i in 1..4 loop
    v_c := creature_spawn(w, 'orse', ${FOOT.x - 1.5}, ${FOOT.y + 0.5}, 'active', now() - interval '60 days', me);
    update creature set keeper = me, hunger = 1, tacked = true, hitched_to = v_wagon where world_id = w and id = v_c;
  end loop;`;
const STUCK_THERE = `
  update player set x = ${STUCK.x}, y = ${STUCK.y}, level = 1, walk_ahead = 0, moved_at = now() - interval '10 seconds'
    where world_id = w and uid = me;
  update placed set level = 1 where world_id = w and id = v_wagon;`;
const WHERE = (k: string): string => `
  insert into said select '${k}', x || ',' || y || '@' || level from player where world_id = w and uid = me;
  insert into said select '${k}Wagon', x || ',' || y || '@' || level from placed where world_id = w and id = v_wagon;`;
const isle = answers(psql(`begin;
create temp table said (k text, v text) on commit drop;
do $b$
declare w uuid; me uuid; gx int; gy int; i int; v_mount int; v_wagon bigint; v_c int; v_a jsonb;
begin
  ${SCENE}
  insert into said select 'rides', (rider = me)::text from creature where world_id = w and id = v_mount;
  insert into said select 'team', count(*)::text from creature where world_id = w and hitched_to = v_wagon;
  insert into said select 'drives', (driving(w, me)).id::text = v_wagon::text;

  -- The stuck state, and the word the browser sends once it has let the body down.
  ${STUCK_THERE}
  v_a := rpc_move(w, ${STUCK.x}, ${STUCK.y}, 0);
  insert into said values ('outAnswer', (v_a->>'x') || ',' || (v_a->>'y') || '@' || (v_a->>'level') || '|' || (v_a->>'blocked'));
  ${WHERE('out')}
  insert into said select 'outMount', coalesce(x->>'storey', 'unsent') from jsonb_array_elements(rpc_creatures(w, 40)) x
    where (x->>'id')::int = v_mount;

  -- And an old word, still on storey 2.
  ${STUCK_THERE}
  v_a := rpc_move(w, ${STUCK.x}, ${STUCK.y}, 1);
  insert into said values ('oldAnswer', (v_a->>'x') || ',' || (v_a->>'y') || '@' || (v_a->>'level'));
  ${WHERE('old')}

  -- A word up the flight, pulled back to its pace onto the foot.
  update player set x = 53.5, y = 44.5, level = 0, walk_ahead = 100, moved_at = now() where world_id = w and uid = me;
  update placed set level = 0 where world_id = w and id = v_wagon;
  v_a := rpc_move(w, 54.05, 44.5, 1);
  insert into said values ('pulledAnswer', (v_a->>'x') || ',' || (v_a->>'y') || '@' || (v_a->>'level') || '|' || (v_a->>'pulled'));
  ${WHERE('pulled')}

  -- A word down off the flight claiming storey 2 on the foot.
  update player set x = 54.5, y = 44.5, level = 1, walk_ahead = 0, moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
  update placed set level = 1 where world_id = w and id = v_wagon;
  v_a := rpc_move(w, 53.4, 44.5, 1);
  ${WHERE('cut')}

  -- And a word up the flight its pace allows.
  update player set x = 53.5, y = 44.5, level = 0, walk_ahead = 0, moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
  update placed set level = 0 where world_id = w and id = v_wagon;
  v_a := rpc_move(w, 54.5, 44.5, 1);
  ${WHERE('up')}
end $b$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n~~\\n' order by k) from said;
rollback;`));
const say = (k: string): string => isle.get(k) ?? 'unsaid';
const tileOf = (at: string): string => {
  const [xy, level] = at.split('@');
  const [x, y] = xy.split(',').map(Number);
  return `${Math.floor(x)},${Math.floor(y)}@${level}`;
};

check('on the island Dane rides and drives a wagon behind a team of four', say('rides') === 'true' && say('team') === '4' && say('drives') === 'true',
  `rides ${say('rides')}, team ${say('team')}, drives ${say('drives')}`);
check('stuck at the foot on storey 2, the word from the ground there is taken, not held back',
  say('outAnswer') === `${STUCK.x},${STUCK.y}@0|false` && say('out') === `${STUCK.x},${STUCK.y}@0`, `${say('outAnswer')}; stored ${say('out')}`);
check('and the wagon is on the ground with it (drag_along), and the mount sent on the ground',
  tileOf(say('outWagon')) === `${FOOT.x},${FOOT.y}@0` && say('outMount') === '0', `wagon ${say('outWagon')}, mount ${say('outMount')}`);
check('an old word still on storey 2 there is let down onto the ground too, the wagon with it',
  say('oldAnswer').endsWith('@0') && say('old').endsWith('@0') && say('oldWagon').endsWith('@0'),
  `${say('oldAnswer')}; stored ${say('old')}, wagon ${say('oldWagon')}`);
check('a word up the flight pulled back to its pace onto the foot stays on the ground',
  say('pulledAnswer').endsWith('|true') && tileOf(say('pulled')) === `${FOOT.x},${FOOT.y}@0` && say('pulledWagon').endsWith('@0'),
  `${say('pulledAnswer')}; stored ${say('pulled')}, wagon ${say('pulledWagon')}`);
check('a word down off the flight claiming storey 2 on the foot does not leave it there',
  tileOf(say('cut')) !== `${FOOT.x},${FOOT.y}@1` && !say('cutWagon').startsWith(`${FOOT.x},${FOOT.y}@1`), `stored ${say('cut')}, wagon ${say('cutWagon')}`);
check('and a word up the flight its pace allows is taken: on the flight on storey 2, the wagon with it',
  tileOf(say('up')) === '54,44@1' && say('upWagon') === `54,44@1`, `stored ${say('up')}, wagon ${say('upWagon')}`);

console.log(`${good} ok, ${bad} failed`);
if (bad) process.exit(1);
