/**
 * Mounts up wide staircases, on both sides.
 *
 * Asked for: "Mounts and carts can go up staircases, but not single
 * staircases". A mount goes where wheels go (`Game.rideRule`, after
 * `driveRule`): indoors on the ground floor through an arch, a double door or
 * a gate (not an iron-bound one, which swings for a person only), up a
 * finished wide staircase from its foot, along the finished floors of the
 * storey over it and back down off its foot; never up a single staircase or
 * a ladder, onto a hatch or over a staircase's rails.
 *
 * Asked of both:
 *   * the browser's rule, step by step, and a ride found from the ground
 *     outside up the wide staircase and along storey 2's floor, which the
 *     island takes a step at a time through `rpc_move` without holding it
 *     back, the mount under its rider up there (`drag_along`);
 *   * the edge of storey 2's floor stops the ride on both sides
 *     (`frame_footing`);
 *   * a single staircase and a ladder refused: no ride found up either, and
 *     a mounted walk to the storey they lead to says so (`MOUNT_STAIRS_SAID`);
 *   * the storey the mount is on sent with it (`rpc_creatures` `storey`), so
 *     somebody else's browser draws it, and its rider, up there
 *     (`Game.creatureStorey`), pinned on that storey too;
 *   * no getting down a storey up and no mounting from one, in the same words
 *     on both sides (`MOUNT_STOREY_SAID`, `ride_refusal`);
 *   * and back down to the ground, where getting down is allowed again.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding, Dane and Hunger on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { TOP_LEVELS, type Side, type WallType } from '../../src/game/building';
import { MOUNT_STAIRS_SAID, MOUNT_STOREY_SAID, mountGroundSaid, type IslandCreature } from '../../src/game/creatures';
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

/*
 * On Hoarding: ground flat at 30 from corner (50, 40) to (62, 50), packed
 * dirt, and a house of five tiles in a row at y 44, two storeys high. On
 * storey 2: a wide plank staircase on (54, 44) climbed from the west, its
 * foot out on the ground at (53, 44); finished floor on (55, 44) and
 * (56, 44); a single staircase on (57, 44) and a ladder on (58, 44), both
 * climbed from the south.
 */
const H = 30;
const HOUSE = { id: 9311, name: 'Riding house' };
const TILES: Array<[number, number]> = [[54, 44], [55, 44], [56, 44], [57, 44], [58, 44]];
const MAT = 'plank';
type Kind = 'floor' | 'stairs' | 'ladder';
const FLOORS: Array<{ x: number; kind: Kind; facing?: Side; hand?: 'l' }> = [
  { x: 54, kind: 'stairs', facing: 'w' },
  { x: 55, kind: 'floor' },
  { x: 56, kind: 'floor' },
  { x: 57, kind: 'stairs', facing: 's', hand: 'l' },
  { x: 58, kind: 'ladder', facing: 's' },
];

/* ---- the browser ---------------------------------------------------------------- */

const g = Game.create(9311, 64);
for (let y = 40; y <= 50; y++) for (let x = 50; x <= 62; x++) g.world.setHeight(x, y, H);
for (let y = 40; y < 50; y++) for (let x = 50; x < 62; x++) g.world.setTile(x, y, TileType.PackedDirt, 0);
const house = g.buildings.create(HOUSE.name, TILES[0][0], TILES[0][1]);
for (const [x, y] of TILES.slice(1)) g.buildings.addTile(house, x, y);
house.levels = 2;
house.workLevel = 1;
const done = (f: { needed: Record<string, number> }): void => { for (const k of Object.keys(f.needed)) f.needed[k] = 0; };
const rows: Array<{ x: number; kind: Kind; facing?: Side; hand?: 'l'; needed: string; total: string }> = [];
for (const f of FLOORS) {
  const t = g.buildings.setFloor(house, 1, f.x, 44, MAT, f.kind, f.facing, f.hand);
  done(t);
  rows.push({ ...f, needed: JSON.stringify(t.needed), total: JSON.stringify(t.total) });
}
const BORN = g.time - 3600 * 24 * 60;
const greyfell = g.creatures.spawn('orse', 52.5, 44.5, 'active', g.rand, BORN);
greyfell.name = 'Greyfell';
greyfell.tacked = true;
greyfell.hunger = 1;
const brindle = g.creatures.spawn('orse', 56.5, 45.5, 'active', g.rand, BORN);
brindle.name = 'Brindle';
brindle.tacked = true;
brindle.hunger = 1;
g.player.x = 52.5;
g.player.y = 44.5;
g.player.level = 0;
check('a Thistlekit, grown and saddled, is mounted on the ground', g.mount(greyfell) && g.mounted() === greyfell);
check('mounted, a walk crosses storeys as a drive does', g.movement().levels === TOP_LEVELS, `${g.movement().levels}`);

const ride = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => g.rideRule(x0, y0, level, x1, y1);
check('up a wide staircase from its foot, onto storey 2', ride(53, 44, 0, 54, 44) === 1, `${ride(53, 44, 0, 54, 44)}`);
check('not onto it over its rails', ride(54, 45, 0, 54, 44) === null && ride(54, 43, 0, 54, 44) === null,
  `${ride(54, 45, 0, 54, 44)}, ${ride(54, 43, 0, 54, 44)}`);
check('off its head along storey 2\'s floor, and back down off its foot',
  ride(54, 44, 1, 55, 44) === 1 && ride(55, 44, 1, 56, 44) === 1 && ride(56, 44, 1, 55, 44) === 1 && ride(54, 44, 1, 53, 44) === 0,
  `${ride(54, 44, 1, 55, 44)}, ${ride(55, 44, 1, 56, 44)}, ${ride(56, 44, 1, 55, 44)}, ${ride(54, 44, 1, 53, 44)}`);
check('nor off the edge of what is floored up there', ride(56, 44, 1, 56, 45) === null && ride(55, 44, 1, 55, 43) === null,
  `${ride(56, 44, 1, 56, 45)}, ${ride(55, 44, 1, 55, 43)}`);
check('up no single staircase, from its foot or along the storey, though a walker climbs it',
  ride(57, 45, 0, 57, 44) === null && ride(56, 44, 1, 57, 44) === null && g.stepRule(57, 45, 0, 57, 44) === 1,
  `${ride(57, 45, 0, 57, 44)}, ${ride(56, 44, 1, 57, 44)}, walking ${g.stepRule(57, 45, 0, 57, 44)}`);
check('and up no ladder, though a walker climbs it',
  ride(58, 45, 0, 58, 44) === null && g.stepRule(58, 45, 0, 58, 44) === 1,
  `${ride(58, 45, 0, 58, 44)}, walking ${g.stepRule(58, 45, 0, 58, 44)}`);
check('and under neither on the ground: a staircase or ladder up from a tile is no way for a mount',
  ride(56, 45, 0, 57, 45) === 0 && ride(57, 45, 0, 58, 45) === 0 && ride(59, 44, 0, 58, 44) === null,
  `${ride(56, 45, 0, 57, 45)}, ${ride(57, 45, 0, 58, 45)}, ${ride(59, 44, 0, 58, 44)}`);

const doorway = (level: number, x: number, y: number, side: Side, types: WallType[], step: () => number | null): string => {
  const w = g.buildings.setWall(house, level, x, y, side, 'solid', MAT);
  done(w);
  const out = types.map((t) => {
    w.type = t;
    return `${t} ${step()}`;
  }).join(', ');
  g.buildings.removeWall(level, x, y, side);
  return out;
};
const DOORS: WallType[] = ['solid', 'door', 'iron_gate', 'double_door'];
const foot = doorway(0, 54, 44, 'w', DOORS, () => ride(53, 44, 0, 54, 44));
check('up from its foot only through a doorway wide enough, as wheels go, and no iron-bound gate',
  foot === 'solid null, door null, iron_gate null, double_door 1', foot);
const indoors = doorway(0, 55, 44, 's', DOORS, () => ride(55, 45, 0, 55, 44));
check('and indoors on the ground floor the same way', indoors === 'solid null, door null, iron_gate null, double_door 0', indoors);
const upstairs = doorway(1, 55, 44, 'e', DOORS, () => ride(55, 44, 1, 56, 44));
check('and through the doorways of storey 2 the same way', upstairs === 'solid null, door null, iron_gate null, double_door 1', upstairs);

const route = findPath(g.world, 51, 44, 0, 56, 44, { ...pathOptions(g.world, g.rideRule, TOP_LEVELS), goalLevel: 1 }) ?? [];
check('a ride is found from the ground outside, up the wide staircase and along storey 2 to its far floor',
  route.length > 0 && route[route.length - 1].level === 1 && route.some((p) => p.x === 54 && p.y === 44 && p.level === 1)
    && route[route.length - 1].x === 56,
  route.map((p) => `${p.x},${p.y}@${p.level}`).join(' ') || 'no way');
const back = findPath(g.world, 56, 44, 1, 51, 44, { ...pathOptions(g.world, g.rideRule, TOP_LEVELS), goalLevel: 0 }) ?? [];
check('and one back down the way it came', back.length > 0 && back[back.length - 1].level === 0 && back.some((p) => p.x === 53 && p.level === 0),
  back.map((p) => `${p.x},${p.y}@${p.level}`).join(' ') || 'no way');

g.settings.viewLevel = 1;
check('pinned on storey 2, a mounted walk to its far floor sets off and ends there', g.moveTo(56, 44, false, true, 1)
  && g.player.path?.[g.player.path.length - 1]?.level === 1, (g.player.path ?? []).map((p) => `${p.x},${p.y}@${p.level}`).join(' '));
g.player.path = null;
g.log.length = 0;
const hatch = g.moveTo(58, 44, false, false, 1);
const hatchSaid = g.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
check('a mounted walk to the hatch of the ladder, reached on foot only by the ladder or the single staircase, is refused and says so',
  !hatch && hatchSaid === MOUNT_STAIRS_SAID, `${hatch}, "${hatchSaid}"`);
g.settings.viewLevel = null;

/* ---- up there, in the browser ----------------------------------------------------- */
const mountT = (id: number): Target => ({ kind: 'creature', id } as Target);
const askMount = (id: number): string => ACTION_BY_ID.get('mount_creature')?.check?.(mountT(id), g) ?? 'ALLOWED';
const askDismount = (id: number): string => ACTION_BY_ID.get('dismount_creature')?.check?.(mountT(id), g) ?? 'ALLOWED';
g.player.x = 56.5;
g.player.y = 44.5;
g.player.level = 1;
greyfell.x = 56.5;
greyfell.y = 44.5;
const mine = { dismount: askDismount(greyfell.id), mount: askMount(brindle.id), storey: g.creatureStorey(greyfell) };
g.player.x = 52.5;
g.player.y = 44.5;
g.player.level = 0;
greyfell.x = 52.5;
greyfell.y = 44.5;
brindle.x = 52.5;
brindle.y = 45.5;
const mineDown = { dismount: askDismount(greyfell.id), mount: askMount(brindle.id), storey: g.creatureStorey(greyfell) };
check('in the browser a mount ridden up there stands on storey 2, and on the ground again after', mine.storey === 1 && mineDown.storey === 0,
  `${mine.storey}, ${mineDown.storey}`);

/* ---- the island ------------------------------------------------------------------- */
const steps = (path: Array<{ x: number; y: number; level: number }>, tag: string): string => path.slice(1).map((p, i) => `
  update player set moved_at = now() - interval '10 seconds', away = false where world_id = w and uid = me;
  v_a := rpc_move(w, ${p.x + 0.5}, ${p.y + 0.5}, ${p.level});
  if (v_a->>'blocked')::boolean or floor((v_a->>'x')::double precision) <> ${p.x} or floor((v_a->>'y')::double precision) <> ${p.y}
     or (v_a->>'level')::int <> ${p.level} then
    v_held := coalesce(v_held || ' ', '') || '${tag}${i}:' || (v_a->>'x') || ',' || (v_a->>'y') || '@' || (v_a->>'level');
  end if;`).join('');
const isle = answers(psql(`begin;
create temp table said (k text, v text) on commit drop;
do $b$
declare w uuid; me uuid; other uuid; gx int; gy int; v_grey int; v_brin int; v_a jsonb; v_held text;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into other from player where world_id = w and name = 'Hunger';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  delete from building b where b.world_id = w and (b.id = ${HOUSE.id} or exists (select 1 from building_tile bt
    where bt.world_id = w and bt.building = b.id and bt.x between 50 and 62 and bt.y between 40 and 50));
  delete from placed where world_id = w and x between 50 and 62 and y between 40 and 50;
  for gx in 50..62 loop for gy in 40..50 loop
    perform land_set_height(w, gx, gy, ${H});
    if gx < 62 and gy < 50 then perform land_set_tile(w, gx, gy, tile_id('Packed dirt')); end if;
  end loop; end loop;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${HOUSE.id}, '${HOUSE.name}', 2, 1, me);
  insert into building_tile (world_id, building, x, y) values ${TILES.map(([x, y]) => `(w, ${HOUSE.id}, ${x}, ${y})`).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, hand, needed, total) values
    ${rows.map((f) => `(w, 1, ${f.x}, 44, ${HOUSE.id}, '${MAT}', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, ${f.hand ? `'${f.hand}'` : 'null'}, '${f.needed}', '${f.total}')`).join(',\n    ')};
  update creature set rider = null where world_id = w and rider = me;
  delete from placed where world_id = w and (driver = me or puller = me);
  update player set body_at = now(), x = 52.5, y = 44.5, level = 0, level_h = null, act = null, act_queue = '[]'::jsonb, aboard = null,
         away = false, moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
  update player set body_at = now(), x = 54.5, y = 47.5, level = 0, aboard = null, away = false where world_id = w and uid = other;
  v_grey := creature_spawn(w, 'orse', 52.5, 44.5, 'active', now() - interval '60 days', me);
  v_brin := creature_spawn(w, 'orse', 56.5, 45.5, 'active', now() - interval '60 days', me);
  update creature set keeper = me, hunger = 1, tacked = true, name = 'Greyfell' where world_id = w and id = v_grey;
  update creature set keeper = me, hunger = 1, tacked = true, name = 'Brindle' where world_id = w and id = v_brin;
  insert into said values ('mountGround', coalesce(ride_refusal(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_grey)), 'ALLOWED'));
  perform perform_ride(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_grey));
  insert into said select 'rider', (rider = me)::text from creature where world_id = w and id = v_grey;

  -- Up the wide staircase and along storey 2, a step at a time, as the browser found it.
  ${steps(route, 'up')}
  insert into said values ('heldUp', coalesce(v_held, 'none'));
  insert into said select 'up', x || ',' || y || '@' || level from player where world_id = w and uid = me;
  insert into said select 'mountUp', from_x || ',' || from_y || '|' || to_x || ',' || to_y || '|' || coalesce(rider = me, false)
    from creature where world_id = w and id = v_grey;
  insert into said select 'sentMine', coalesce(x->>'storey', 'unsent') || '|' || (x->>'ridden')
    from jsonb_array_elements(rpc_creatures(w, 40)) x where (x->>'id')::int = v_grey;

  -- Off the edge of the floor up there.
  update player set moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
  v_a := rpc_move(w, 56.5, 45.5, 1);
  insert into said values ('edge', (v_a->>'blocked') || '|' || floor((v_a->>'x')::double precision) || ',' || floor((v_a->>'y')::double precision) || '@' || (v_a->>'level'));

  insert into said values ('dismountUp', coalesce(ride_refusal(w, me, 'dismount_creature', jsonb_build_object('kind', 'creature', 'id', v_grey)), 'ALLOWED'));
  insert into said values ('mountUp2', coalesce(ride_refusal(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_brin)), 'ALLOWED'));

  -- And as somebody else on the ground sees it.
  perform set_config('request.jwt.claims', json_build_object('sub', other)::text, true);
  insert into said select 'sentOther', x::text from jsonb_array_elements(rpc_creatures(w, 40)) x where (x->>'id')::int = v_grey;
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);

  -- Back down the way it came.
  v_held := null;
  ${steps(back, 'down')}
  insert into said values ('heldDown', coalesce(v_held, 'none'));
  insert into said select 'down', x || ',' || y || '@' || level from player where world_id = w and uid = me;
  insert into said select 'sentDown', coalesce(x->>'storey', 'unsent')
    from jsonb_array_elements(rpc_creatures(w, 40)) x where (x->>'id')::int = v_grey;
  update creature set from_x = 52.5, from_y = 45.5, to_x = 52.5, to_y = 45.5, leg_at = now(), leg_ends = now() where world_id = w and id = v_brin;
  insert into said values ('dismountDown', coalesce(ride_refusal(w, me, 'dismount_creature', jsonb_build_object('kind', 'creature', 'id', v_grey)), 'ALLOWED'));
  insert into said values ('mountDown', coalesce(ride_refusal(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_brin)), 'ALLOWED'));
end $b$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n~~\\n' order by k) from said;
rollback;`));
const say = (k: string): string => isle.get(k) ?? 'unsaid';

check('on the island it is mounted on the ground, as in the browser', say('mountGround') === 'ALLOWED' && say('rider') === 'true',
  `${say('mountGround')}, rider ${say('rider')}`);
check('replayed a step at a time through rpc_move, the island holds the ride up the staircase back at no step', say('heldUp') === 'none', say('heldUp'));
check('and has the rider on storey 2 on the far floor', say('up') === '56.5,44.5@1', say('up'));
check('the mount under them up there (drag_along)', say('mountUp') === '56.5,44.5|56.5,44.5|true', say('mountUp'));
check('and the storey sent with it to its rider', say('sentMine') === '1|true', say('sentMine'));
check('off the edge of storey 2\'s floor it is held back, as in the browser', say('edge').startsWith('true|56,44@1'), say('edge'));
check('no getting down a storey up, in the same words on both sides',
  mine.dismount === MOUNT_STOREY_SAID && say('dismountUp') === MOUNT_STOREY_SAID, `browser "${mine.dismount}", island "${say('dismountUp')}"`);
check('and no mounting from a storey up, in the same words on both sides',
  mine.mount === mountGroundSaid('You', 1) && say('mountUp2') === 'Mount: ground floor only. You: storey 2.', `browser "${mine.mount}", island "${say('mountUp2')}"`);

// Somebody else's browser, from what the island sends them.
{
  const row = JSON.parse(say('sentOther') === 'unsaid' ? '{}' : say('sentOther')) as IslandCreature & { storey?: number };
  const theirs = Game.create(9312, 64);
  theirs.creatures.sawAll([row]);
  const seen = theirs.creatures.list.get(row.id);
  check('to somebody else it is sent ridden by its rider, on storey 2', row.ridden === false && !!row.rider && row.storey === 1,
    `ridden ${row.ridden}, rider ${row.rider ? 'sent' : 'unsent'}, storey ${row.storey}`);
  check('and their browser stands it on storey 2, where storey 2 pinned shows it with its rider on it (creatureStorey)',
    !!seen && theirs.creatureStorey(seen) === 1, `${seen ? theirs.creatureStorey(seen) : 'not seen'}`);
}

check('back down the way it came, the island holds it back at no step', say('heldDown') === 'none', say('heldDown'));
check('and has the rider on the ground outside', say('down') === '51.5,44.5@0', say('down'));
check('and sends it on the ground floor again', say('sentDown') === '0', say('sentDown'));
check('on the ground getting down and mounting are allowed again on both sides',
  mineDown.dismount === 'ALLOWED' && say('dismountDown') === 'ALLOWED' && mineDown.mount === 'ALLOWED' && say('mountDown') === 'ALLOWED',
  `browser ${mineDown.dismount}/${mineDown.mount}, island ${say('dismountDown')}/${say('mountDown')}`);

console.log(`${good} ok, ${bad} failed`);
if (bad) process.exit(1);
