/**
 * A finished bridge between two buildings' storey 4 is walked across at storey 4, and the wall on its end's border is
 * planned, on both sides.
 *
 * Reported on Solara Manor, storey 4 pinned, a stone bridge between the floors of its two buildings:
 *
 *   * "despite the completed bridge, going from one red spot to another paths down the the floor and back up". On
 *     foot a walk went across; mounted it did not: a rider a storey up went on the building's own floors and nothing
 *     else (`Game.rideRule`, `driveStorey`), so from one storey-4 floor to the other it rode down the wide
 *     staircases, across the ground and up again, while the island lets a rider along a deck at its storey as anybody
 *     (`frame_footing`). And the island's own way for a worker (`creature_way`) knew only the buildings' floors.
 *   * "unable to select the wall adjoining the bridge and 4th storey to plan a wall". A click on the deck's side of
 *     that border was the bridge's, or open air's, with nothing of the wall in its menu; and the bridge piece's hit
 *     box reached over the floor's side too (`Renderer.pickTop`). Nothing refused the wall: a pinned storey's menu on
 *     the deck now has the wall of the building's tile across the border (`wallAcross`).
 *
 * So, on a copy of the manor -- two buildings five storeys high, wide staircases up to storey 4, and a marble bridge
 * three lanes wide between their storey-4 floors -- this asks:
 *
 *   * in the browser, from each lane's floor on one side to the other's, on foot and mounted, with storey 4 pinned:
 *     a walk is found, crosses the deck, and is at storey 4 every step (`stepRule`, `rideRule`);
 *   * on the island, each walk's every word to `rpc_move` is answered at storey 4 on its tile, on foot and mounted,
 *     and `creature_way` from one floor to the other is at storey 4 every step and crosses the deck;
 *   * on the deck's side of each lane's end border, the wall across it is the building tile's (`wallAcross`); planned
 *     there, solid marble, the browser's check and the island's `build_refusal` both allow it, and planned on both
 *     sides it says the same, and the island holds the wall.
 *
 * Its own island, rolled back after.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { WALL_HEIGHT, type BuildingsJSON, type Side } from '../../src/game/building';
import type { Bridge } from '../../src/game/bridges';
import { Game } from '../../src/game/game';
import { wallAcross } from '../../src/game/storeyview';
import type { PathPoint } from '../../src/world/pathfinding';
import { TileType } from '../../src/world/tiles';

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

/* ---- the manor -------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-00000b71d9e1';
/** Storey 4, as both sides count storeys: the ground is nought. */
const UP = 3;
const GROUND = 10;
/** The west building's three columns and the east's, three rows each; the bridge between them along the middle row. */
const WX = 30, EX = 38, Y0 = 39, Y = 40;
const AX = WX + 2, BX = EX;
const SPANS = Array.from({ length: BX - AX - 1 }, (_, i) => AX + 1 + i);
const LANES = [Y - 1, Y, Y + 1];
type Floor = { b: number; level: number; x: number; y: number; kind: 'floor' | 'stairs'; facing?: Side };
/**
 * A building's floors, as the manor's: on every storey up to storey 4, a wide staircase up to each, in turn on the
 * north row climbed from the west and on the south row climbed from the east, and floor everywhere else.
 */
const floorsOf = (b: number, x0: number): Floor[] => {
  const out: Floor[] = [];
  const stairs: Record<number, [number, number, Side]> = { 1: [x0 + 1, Y0, 'w'], 2: [x0 + 1, Y0 + 2, 'e'], 3: [x0 + 1, Y0, 'w'] };
  for (let level = 0; level <= UP; level++) {
    for (let y = Y0; y <= Y0 + 2; y++) for (let x = x0; x <= x0 + 2; x++) {
      const s = stairs[level];
      if (s && s[0] === x && s[1] === y) out.push({ b, level, x, y, kind: 'stairs', facing: s[2] });
      else out.push({ b, level, x, y, kind: 'floor' });
    }
  }
  return out;
};
const FLOORS = [...floorsOf(1, WX), ...floorsOf(2, EX)];
const tilesOf = (x0: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let y = Y0; y <= Y0 + 2; y++) for (let x = x0; x <= x0 + 2; x++) out.push([x, y]);
  return out;
};
const HEIGHT = GROUND + UP * WALL_HEIGHT;

/* ---- the browser ------------------------------------------------------------ */

const g = Game.create(4242, 64);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
for (let y = Y0 - 8; y <= Y0 + 10; y++) for (let x = WX - 8; x <= EX + 10; x++) {
  g.world.setHeight(x, y, GROUND);
  if (g.world.inBounds(x, y)) g.world.setTile(x, y, TileType.Grass, 0);
}
const done = { needed: {}, total: {} };
const json: BuildingsJSON = {
  nextId: 10,
  list: [
    { id: 1, name: 'West Manor', levels: 5, workLevel: UP, tiles: tilesOf(WX).map(([x, y]) => `${x},${y}`) },
    { id: 2, name: 'East Manor', levels: 5, workLevel: UP, tiles: tilesOf(EX).map(([x, y]) => `${x},${y}`) },
  ],
  walls: [],
  floors: FLOORS.map((f) => ({ building: f.b, level: f.level, x: f.x, y: f.y, kind: f.kind, ...(f.facing ? { facing: f.facing } : {}), material: 'marble', ...done })),
} as unknown as BuildingsJSON;
g.buildings.sawIsland(json as never);
const plan = {
  id: 1, kind: 'marble', ax: AX, ay: Y, bx: BX, by: Y, height: HEIGHT, level: UP, width: 3, side: 1, rise: 0,
  spans: SPANS.map((x) => ({ x, y: Y, needed: {}, total: {} })),
} as unknown as Bridge;
g.bridges.set(plan.id, plan);
g.reindexDecks();
g.inventory.add('mallet', { ql: 40 });
// Pinned on storey 4, as the player was.
(g as unknown as { pinnedStorey(): number | null }).pinnedStorey = () => UP;

const pathOf = (): PathPoint[] => g.player.path ?? [];
/** The walk the player is given from a tile at storey 4 to another, with storey 4 pinned, and each step replayed through the rule it was found by. */
const walk = (from: { x: number; y: number }, to: { x: number; y: number }): { found: boolean; path: PathPoint[]; replayed: boolean } => {
  g.player.x = from.x + 0.5;
  g.player.y = from.y + 0.5;
  g.player.level = UP;
  g.player.path = null;
  const found = g.moveTo(to.x, to.y, false, true, UP);
  // Read through a call, so the reset just before it does not narrow it away.
  const path = pathOf();
  const { rule } = g.movement();
  let px = from.x, py = from.y, l = UP, replayed = true;
  for (const s of path) {
    if (rule(px, py, l, s.x, s.y) !== s.level) replayed = false;
    px = s.x; py = s.y; l = s.level;
  }
  return { found, path, replayed };
};
const crosses = (path: PathPoint[]): boolean => SPANS.every((x) => path.some((s) => s.x === x && LANES.includes(s.y) && s.level === UP));
const shown = (path: PathPoint[]): string => path.map((s) => `${s.x},${s.y}@${s.level}`).join(' ');
/** From the middle of each lane's row in the west building to the same in the east, and back. */
const PAIRS = LANES.flatMap((y) => [[{ x: WX + 1, y }, { x: EX + 1, y }], [{ x: EX + 1, y }, { x: WX + 1, y }]]);

const footWalks = PAIRS.map(([a, b]) => ({ a, b, ...walk(a, b) }));
check('in the browser, on foot, storey 4 pinned: from each lane\'s floor across to the other building\'s, a walk is found and crosses the deck',
  footWalks.every((w) => w.found && crosses(w.path)), footWalks.filter((w) => !w.found || !crosses(w.path)).map((w) => `${w.a.x},${w.a.y}: ${shown(w.path) || 'none'}`).join(' | '));
check('and is at storey 4 every step, each step the rule\'s (`stepRule`)',
  footWalks.every((w) => w.path.every((s) => s.level === UP) && w.replayed), footWalks.map((w) => [...new Set(w.path.map((s) => s.level))].join('')).join(' '));

// Mounted on a saddled Thistlekit on the ground, then up at storey 4 as a wide staircase takes it.
g.player.x = WX - 1.5;
g.player.y = Y + 0.5;
g.player.level = 0;
const mount = g.creatures.spawn('orse', WX - 1.5, Y + 0.5, 'active', g.rand, g.time - 3600 * 24 * 60);
mount.tacked = true;
mount.hunger = 1;
check('a grown, saddled Thistlekit is mounted', g.mount(mount) && g.mounted() === mount);
const rideWalks = PAIRS.map(([a, b]) => ({ a, b, ...walk(a, b) }));
check('mounted, the same walks are found and cross the deck: no ride down the staircases and back up (`rideRule`)',
  rideWalks.every((w) => w.found && crosses(w.path)), rideWalks.filter((w) => !w.found || !crosses(w.path)).map((w) => `${w.a.x},${w.a.y}: ${shown(w.path) || 'none'}`).join(' | '));
check('and are at storey 4 every step, each step the rider\'s rule\'s',
  rideWalks.every((w) => w.path.every((s) => s.level === UP) && w.replayed), rideWalks.map((w) => [...new Set(w.path.map((s) => s.level))].join('')).join(' '));
// Not a rope bridge: foot traffic only.
plan.kind = 'rope' as never;
const ropeRide = walk({ x: WX + 1, y: Y }, { x: EX + 1, y: Y });
plan.kind = 'marble' as never;
check('mounted, a rope bridge there is not ridden: foot traffic only', !crosses(ropeRide.path), shown(ropeRide.path));
mount.ridden = false;

/** The wall on each lane's end border, picked from the deck's side of it. */
const ENDS: Array<{ deck: { x: number; y: number }; side: Side; want: { x: number; y: number; side: Side; building: number } }> = LANES.flatMap((y) => [
  { deck: { x: AX + 1, y }, side: 'w' as Side, want: { x: AX, y, side: 'e' as Side, building: 1 } },
  { deck: { x: BX - 1, y }, side: 'e' as Side, want: { x: BX, y, side: 'w' as Side, building: 2 } },
]);
const across = ENDS.map((e) => ({ e, at: wallAcross(g, e.deck.x, e.deck.y, e.side, UP) }));
check('on the deck\'s side of each lane\'s end border, the wall across it is the building tile\'s (`wallAcross`)',
  across.every(({ e, at }) => !!at && at.x === e.want.x && at.y === e.want.y && at.side === e.want.side && at.building.id === e.want.building),
  across.map(({ e, at }) => `${e.deck.x},${e.deck.y} ${e.side}: ${at ? `${at.building.name} ${at.x},${at.y} ${at.side}` : 'none'}`).join(' | '));
check('and none on a side of the deck with no building across it',
  wallAcross(g, SPANS[2], Y - 1, 'n', UP) === null && wallAcross(g, SPANS[2], Y, 'n', UP) === null);

const target = (t: { x: number; y: number; side: Side }): Record<string, unknown> =>
  ({ kind: 'tile', x: t.x, y: t.y, cx: t.x, cy: t.y, side: t.side, level: UP, wallType: 'solid', material: 'marble' });
const planWall = ACTION_BY_ID.get('plan_wall');
if (!planWall) throw new Error('there is no plan_wall');
const browserSays = ENDS.map((e) => planWall.check?.(target(e.want) as never, g) ?? 'ALLOWED');
// Planned in the browser on the middle lane's west end, as the island is asked to below.
const MID = ENDS.find((e) => e.want.building === 1 && e.want.y === Y)!;
g.log.length = 0;
planWall.perform(target(MID.want) as never, g);
const browserPlanned = g.log.map((l) => l.text).find((s) => s.startsWith('Planned')) ?? 'NOTHING SAID';
const browserHolds = !!g.buildings.wall(UP, MID.want.x, MID.want.y, MID.want.side);
// A wall planned is not yet a wall: the walk still goes across.
const afterPlan = walk({ x: WX + 1, y: Y }, { x: EX + 1, y: Y });

/* ---- the island ------------------------------------------------------------- */

const tilesSql = (b: number, x0: number): string => tilesOf(x0).map(([x, y]) => `(w, ${b}, ${x}, ${y})`).join(', ');
const moves = (k: string, path: Array<{ x: number; y: number }>, from: { x: number; y: number }): string => `
  update player set x = ${from.x + 0.5}, y = ${from.y + 0.5}, level = ${UP}, body_at = now() - interval '1 minute',
         moved_at = now() - interval '1 minute', act = null, act_queue = '[]'::jsonb where world_id = w and uid = u;`
  + path.map((t, i) => `
  update player set moved_at = now() - interval '1 minute', body_at = now() - interval '1 minute' where world_id = w and uid = u;
  delete from caller where uid = u;
  perform rpc_move(w, ${t.x + 0.5}, ${t.y + 0.5}, ${UP});
  insert into said values ('${k}:${i}', (select level || '@' || floor(x) || ',' || floor(y) from player where world_id = w and uid = u));`).join('');
const out = psql(`begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_b bigint; v_m int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Bridge End', 377, 80, ${WX - 2}, ${Y}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${WX - 8}, ${EX + 10}) x, generate_series(${Y0 - 8}, ${Y0 + 10}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Bridger');
  update player set x = ${WX + 1.5}, y = ${Y + 0.5}, level = ${UP}, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Bridge End', ${(WX + EX) / 2 + 1}, ${Y}, 12, 1, u);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1);
  insert into building (world_id, id, name, levels, work_level, planned_by) values
    (w, 1, 'West Manor', 5, ${UP}, u), (w, 2, 'East Manor', 5, ${UP}, u);
  insert into building_tile (world_id, building, x, y) values ${tilesSql(1, WX)}, ${tilesSql(2, EX)};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${FLOORS.map((f) => `(w, ${f.level}, ${f.x}, ${f.y}, ${f.b}, 'marble', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, '{}', '{}', u)`).join(',\n    ')};
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level, width, side, rise)
    values (w, 'marble', ${AX}, ${Y}, ${BX}, ${Y}, ${HEIGHT}, u, ${UP}, 3, 1, 0) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select w, v_b, i + 1, x, ${Y}, '{}', '{}' from unnest(array[${SPANS.join(', ')}]) with ordinality s(x, i);

  -- The walks the browser found, on foot, word by word.
  ${footWalks.map((wk, k) => moves(`FOOT${k}`, wk.path, wk.a)).join('\n')}
  -- And mounted.
  v_m := creature_spawn(w, 'orse', ${WX - 1.5}, ${Y + 0.5}, 'deed', now() - interval '60 days', u);
  update creature set rider = u, tacked = true, hunger = 1 where world_id = w and id = v_m;
  ${rideWalks.map((wk, k) => moves(`RIDE${k}`, wk.path, wk.a)).join('\n')}
  update creature set rider = null where world_id = w and id = v_m;

  -- The island's own way for a beast, from each lane's floor to the other building's.
  ${PAIRS.map(([a, b], k) => `insert into said values ('WAY${k}', coalesce(array_to_string(creature_way(w, ${a.x}, ${a.y}, ${UP}, ${b.x}, ${b.y}, ${UP}), ','), 'null'));`).join('\n  ')}

  -- The wall on each lane's end border, asked of the building's tile; and planned on the middle lane's west end.
  ${ENDS.map((e, k) => `insert into said values ('ASK${k}', coalesce(build_refusal(w, u, 'plan_wall', '${JSON.stringify(target(e.want))}'::jsonb), 'ALLOWED'));`).join('\n  ')}
  perform perform_building(w, u, 'plan_wall', '${JSON.stringify(target(MID.want))}'::jsonb);
  insert into said select 'PLANNED', coalesce((select text from event where world_id = w and uid = u and text like 'Planned%' order by n desc limit 1), 'NOTHING SAID');
  insert into said select 'HOLDS', exists (select 1 from wall where world_id = w and level = ${UP} and dir = 'v' and x = ${AX + 1} and y = ${Y} and building = 1)::text;
end $t$;
select k || '|' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));
const answered = (k: string, path: PathPoint[]): string[] => path.map((_, i) => said.get(`${k}:${i}`) ?? '-');
const wanted = (path: PathPoint[]): string[] => path.map((s) => `${UP}@${s.x},${s.y}`);
const footAnswers = footWalks.map((wk, k) => answered(`FOOT${k}`, wk.path));
const rideAnswers = rideWalks.map((wk, k) => answered(`RIDE${k}`, wk.path));

check('on the island: each walk on foot is answered at storey 4 on its tile, every word to `rpc_move`',
  footWalks.every((wk, k) => footAnswers[k].join(' ') === wanted(wk.path).join(' ')), footAnswers.map((a) => a.join(' ')).join(' / '));
check('and each mounted, the same', rideWalks.every((wk, k) => rideAnswers[k].join(' ') === wanted(wk.path).join(' ')), rideAnswers.map((a) => a.join(' ')).join(' / '));
const ways = PAIRS.map((_, k) => {
  const v = said.get(`WAY${k}`) ?? 'null';
  if (v === 'null') return null;
  const n = v.split(',').map(Number);
  const out: PathPoint[] = [];
  for (let i = 0; i + 2 < n.length; i += 3) out.push({ x: n[i], y: n[i + 1], level: n[i + 2] });
  return out;
});
check('the island\'s way for a beast between the two floors (`creature_way`) crosses the deck',
  ways.every((p) => !!p && crosses(p)), ways.map((p) => (p ? shown(p) : 'none')).join(' | '));
check('and is at storey 4 every step', ways.every((p) => !!p && p.every((s) => s.level === UP)), ways.map((p) => (p ? [...new Set(p.map((s) => s.level))].join('') : 'none')).join(' '));
check('a solid marble wall on each lane\'s end border is allowed on both sides (`plan_wall`, `build_refusal`)',
  browserSays.every((s) => s === 'ALLOWED') && ENDS.every((_, k) => said.get(`ASK${k}`) === 'ALLOWED'),
  `browser ${browserSays.join(' / ')}; island ${ENDS.map((_, k) => said.get(`ASK${k}`)).join(' / ')}`);
check('planned on both sides, it is said the same', browserPlanned.startsWith('Planned') && browserPlanned === said.get('PLANNED'),
  `browser "${browserPlanned}", island "${said.get('PLANNED')}"`);
check('and both sides hold it', browserHolds && said.get('HOLDS') === 'true', `browser ${browserHolds}, island ${said.get('HOLDS')}`);
check('a wall planned and not built is no wall: the walk still crosses', afterPlan.found && crosses(afterPlan.path) && afterPlan.path.every((s) => s.level === UP),
  shown(afterPlan.path));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a storey-4 bridge between two buildings is walked across at storey 4, and its end's wall planned, on both sides — ${ok.length} of ${ok.length}`);
