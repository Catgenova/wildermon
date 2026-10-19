/**
 * A ramp bridge, the same on both sides.
 *
 * Asked for: "Is it possible to plan a bridge stretching up from 1st to 3rd
 * floor?" It was not: a bridge's two ends had to be within `END_SLOP` of
 * each other in height and on one storey. Past `END_SLOP` a deck is a ramp
 * now, rising evenly from one end to the other at no more than `RAMP_SLOPE`
 * a tile of deck (`bridgeReason`, `rampRefusal`, `deckHeight` in the
 * browser; `bridge_reason`, `ramp_refusal`, `deck_height_at` on the island).
 * Put to both:
 *
 *   * between two banks, exactly `RAMP_SLOPE` a tile is allowed and one more
 *     is refused, in the same words, which give the numbers;
 *   * from the ground to storey 3, over the tiles that climb wants it is
 *     allowed, and over one fewer refused in the same words;
 *   * set out, the same bridge on both sides: its height, its storeys, its
 *     rise, and what it says, and the bill a span of that kind costs on
 *     every one of its tiles;
 *   * built, a body on it stands at the deck's height at that point, on both
 *     sides, rising evenly from the ground to storey 3's floor;
 *   * walked: onto it from the ground, along it and off its top onto storey
 *     3, and back down, at the storey of the end it was stepped onto from
 *     (`Game.stepRule`, `rpc_move`); and not along it at a storey neither of
 *     its ends is on.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it, and puts the ground and Dane back after.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { WALL_HEIGHT } from '../../src/game/building';
import { BRIDGES, END_SLOP, RAMP_SLOPE, rampRefusal, rampTiles } from '../../src/game/bridges';
import { Game } from '../../src/game/game';
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
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ALLOWED = 'ALLOWED';
const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};

/* ---- the ground, as it was, to be put back ------------------------------- */
const X0 = 22, X1 = 34, Y0 = 26, Y1 = 36;
const heightsWere = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1 + 1}) gx, generate_series(${Y0}, ${Y1 + 1}) gy;`);
const tilesWere = psql(`select string_agg(gx || ',' || gy || ',' || land_tile(${W}, gx, gy) || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);

/* ---- the same ground on both sides: level grass at twenty ------------------ */
const BASE = 20;
const game = Game.create(4244);
const world = game.world;
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.Grass, 0);
for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
game.inventory.add('mallet', { ql: 40 });
psql(`do $$ declare w uuid; u uuid; gx int; gy int; begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  delete from wall where world_id = w;
  delete from floor_tile where world_id = w;
  delete from building_column where world_id = w;
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from bridge_span where world_id = w;
  delete from bridge where world_id = w;
  delete from event where world_id = w and uid = u;
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass')); perform land_set_data(w, gx, gy, 0);
  end loop; end loop;
end $$;`);

const setCorner = (x: number, y: number, h: number): void => {
  world.setHeight(x, y, h);
  sql(`perform land_set_height(w, ${x}, ${y}, ${h});`);
};
/** A tile's four corners, so the middle of it stands at `h`. */
const raiseTile = (x: number, y: number, h: number): void => {
  for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) setCorner(cx, cy, h);
};
const reasons = (kind: string, ax: number, ay: number, bx: number, by: number): [string, string] => [
  game.bridgeReason(kind as never, ax, ay, bx, by) ?? ALLOWED,
  psql(`select coalesce(bridge_reason(${W}, ${DANE}, '${kind}', ${ax}, ${ay}, ${bx}, ${by}), '${ALLOWED}');`),
];
const same = (what: string, kind: string, a: [number, number], b: [number, number], want: string): void => {
  const [mine, theirs] = reasons(kind, ...a, ...b);
  check(what, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
};

/* ---- between two banks: RAMP_SLOPE a tile, and one more ---------------------
 *
 *   (24,34) at BASE, two tiles of deck (25,34) and (26,34), and (27,34) raised
 *   so its middle is RAMP_SLOPE a tile over BASE, then one more a tile.
 */
const BANK_A: [number, number] = [24, 34];
const BANK_B: [number, number] = [27, 34];
const BANK_SPANS = BANK_B[0] - BANK_A[0] - 1;
raiseTile(...BANK_B, BASE + RAMP_SLOPE * BANK_SPANS);
same(`between two banks ${RAMP_SLOPE * BANK_SPANS} apart, ${RAMP_SLOPE} a tile over ${BANK_SPANS} tiles of deck is allowed on both sides`,
  'wood', BANK_A, BANK_B, ALLOWED);
raiseTile(...BANK_B, BASE + (RAMP_SLOPE + 1) * BANK_SPANS);
same(`and ${RAMP_SLOPE + 1} a tile is refused in the same words, which say what that climb wants`,
  'wood', BANK_A, BANK_B, rampRefusal(0, 0, (RAMP_SLOPE + 1) * BANK_SPANS, BANK_SPANS));
check('which are the numbers', rampRefusal(0, 0, (RAMP_SLOPE + 1) * BANK_SPANS, BANK_SPANS)
  === `The two ends are ${(RAMP_SLOPE + 1) * BANK_SPANS} apart in height. A deck rises at most ${RAMP_SLOPE} a tile, so that wants ${BANK_SPANS + 1} tiles of deck; this one has ${BANK_SPANS}.`);
same('a drawbridge, whose deck stands on end over its hinge, is still carried level, as it was',
  'draw', BANK_A, BANK_B, `The two ends are ${(RAMP_SLOPE + 1) * BANK_SPANS} apart in height. One deck will not meet both; level one of them.`);
raiseTile(...BANK_B, BASE);
{
  /*
   * Within END_SLOP, a level deck, as it always was: (24,32) to (28,32) over
   * three tiles of deck with a ditch under the middle one, so each tile under
   * the deck is a gap below a deck carried at the mean of the two banks.
   */
  const [a, b]: Array<[number, number]> = [[24, 32], [28, 32]];
  for (const x of [26, 27]) for (const y of [32, 33]) setCorner(x, y, BASE - 20);
  raiseTile(...b, BASE + END_SLOP);
  same(`within ${END_SLOP} it is a level bridge as it always was`, 'wood', a, b, ALLOWED);
  raiseTile(...b, BASE + END_SLOP + 1);
  same(`and ${END_SLOP + 1} apart over three tiles is a ramp, allowed as well`, 'wood', a, b, ALLOWED);
  for (const x of [26, 27]) for (const y of [32, 33]) setCorner(x, y, BASE);
  raiseTile(...b, BASE);
}

/* ---- a tower of three storeys at (30,30) -------------------------------------
 *
 *   Finished floors on storeys 2 and 3, no walls: the ramp comes in at storey
 *   3 over its open west side. The ground end is out west of it.
 */
const TOWER: [number, number] = [30, 30];
const TOP = 2;
{
  const b = game.buildings.create('Tower', ...TOWER);
  b.levels = TOP + 1;
  b.workLevel = TOP;
  for (let l = 1; l <= TOP; l++) {
    const f = game.buildings.setFloor(b, l, ...TOWER, 'plank', 'floor');
    for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  }
  const f = game.buildings.floor(1, ...TOWER)!;
  sql(`insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${b.id}, 'Tower', ${TOP + 1}, ${TOP}, u);
    insert into building_tile (world_id, building, x, y) values (w, ${b.id}, ${TOWER[0]}, ${TOWER[1]});
    ${Array.from({ length: TOP }, (_, i) => `insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
      values (w, ${i + 1}, ${TOWER[0]}, ${TOWER[1]}, ${b.id}, 'plank', 'floor', '${JSON.stringify(f.needed)}', '${JSON.stringify(f.total)}');`).join('\n')}`);
}
const CLIMB = TOP * WALL_HEIGHT;
const NEED = rampTiles(CLIMB);
const FOOT: [number, number] = [TOWER[0] - NEED - 1, TOWER[1]];
const SHORT: [number, number] = [TOWER[0] - NEED, TOWER[1]];
{
  const top = game.topDeck(...TOWER);
  const theirs = psql(`select top_deck(${W}, ${TOWER[0]}, ${TOWER[1]}) || ',' || deck_height(${W}, ${TOWER[0]}, ${TOWER[1]});`);
  check(`storey 3's finished floor is the top deck of the tower's tile on both sides, ${CLIMB} over the ground`,
    top.level === TOP && top.height === BASE + CLIMB && theirs === `${TOP},${BASE + CLIMB}`, `browser ${top.level},${top.height}; island ${theirs}`);
}
same(`from the ground to storey 3, ${CLIMB} up, over the ${NEED} tiles of deck that climb wants at ${RAMP_SLOPE} a tile is allowed on both sides`,
  'wood', FOOT, TOWER, ALLOWED);
same('and planned from the top down as well', 'wood', TOWER, FOOT, ALLOWED);
same(`over ${NEED - 1} it is refused in the same words, which name the storeys and say it wants ${NEED}`,
  'wood', SHORT, TOWER, rampRefusal(0, TOP, CLIMB, NEED - 1));
check('which are the numbers', rampRefusal(0, TOP, CLIMB, NEED - 1)
  === `One end is on the ground and the other on storey ${TOP + 1}, ${CLIMB} apart in height. A deck rises at most ${RAMP_SLOPE} a tile, so that wants ${NEED} tiles of deck; this one has ${NEED - 1}.`);

/* ---- set out, the same on both sides ----------------------------------------- */
game.player.x = FOOT[0] + 0.5;
game.player.y = FOOT[1] + 0.5;
game.player.level = 0;
sql(`update player set x = ${FOOT[0] + 0.5}, y = ${FOOT[1] + 0.5}, level = 0 where world_id = w and uid = u;`);
const TARGET = { kind: 'tile', x: TOWER[0], y: TOWER[1], cx: TOWER[0], cy: TOWER[1], material: 'wood' };
game.log.length = 0;
ACTION_BY_ID.get('plan_bridge')!.perform(TARGET as never, game);
const saidMine = game.log.map((l) => l.text).find((s) => s.startsWith('You set out')) ?? 'NOTHING SAID';
psql(`select perform_last(${W}, ${DANE}, 'plan_bridge', '${JSON.stringify(TARGET)}'::jsonb);`);
const saidTheirs = psql(`select text from event where world_id = ${W} and uid = ${DANE} and text like 'You set out%' order by n desc limit 1;`) || 'NOTHING SAID';
// What each span wants is named in the order each side keeps its bill in, which was so before ramps; the rest is the same.
const upTo = (said: string): string => said.slice(0, said.indexOf(' Each one wants'));
check('set out, both sides say the same, the storeys and the rise among it', upTo(saidMine) === upTo(saidTheirs)
  && saidMine.startsWith(`You set out a wooden bridge of ${NEED} spans across, the ground to storey ${TOP + 1}, its deck rising ${CLIMB} from this end to the far one.`),
  `browser "${saidMine}", island "${saidTheirs}"`);
const ramp = [...game.bridges.values()][0];
{
  const mine = `${ramp.height}|${ramp.level ?? 0}|${ramp.levelB ?? '-'}|${ramp.rise ?? 0}|${ramp.spans.length}`;
  const theirs = psql(`select b.height || '|' || b.level || '|' || coalesce(b.level_b::text, '-') || '|' || b.rise || '|'
      || (select count(*) from bridge_span s where s.world_id = b.world_id and s.bridge = b.id)
    from bridge b where b.world_id = ${W};`);
  const want = `${BASE + CLIMB / 2}|0|${TOP}|${CLIMB}|${NEED}`;
  check('the same bridge on both sides: carried at the middle of the climb, from the ground to storey 3, rising the whole of it, a span a tile',
    mine === want && theirs === want, `browser ${mine}; island ${theirs}; want ${want}`);
}
{
  // What a span of a wooden bridge takes, on every tile of the ramp's deck, as on any bridge's.
  const one = Object.fromEntries(BRIDGES.wood.bill);
  const all = Object.fromEntries(Object.entries(one).map(([id, n]) => [id, n * NEED]).sort());
  const mine: Record<string, number> = {};
  for (const sp of ramp.spans) for (const [id, n] of Object.entries(sp.total)) mine[id] = (mine[id] ?? 0) + n;
  const mineS = JSON.stringify(Object.fromEntries(Object.entries(mine).sort()));
  const theirs = psql(`select jsonb_object_agg(k, n)::text from (select k, sum(v::int) as n
      from bridge_span s cross join lateral jsonb_each_text(s.total) t(k, v) where s.world_id = ${W} group by k order by k) x;`).replace(/ /g, '');
  check(`its bill is a span's on each of its ${NEED} tiles, ${JSON.stringify(one)} each, on both sides`,
    mineS === JSON.stringify(all) && JSON.stringify(JSON.parse(theirs)) === JSON.stringify(all), `browser ${mineS}; island ${theirs}`);
}

/* ---- built: where a body on it stands ----------------------------------------- */
for (const sp of ramp.spans) for (const k of Object.keys(sp.needed)) sp.needed[k] = 0;
game.reindexDecks();
sql(`update bridge_span set needed = (select jsonb_object_agg(k, 0) from jsonb_object_keys(needed) k) where world_id = w;`);
{
  const along = [0.05, 0.5, 1.25, 2, 2.5, 3.75, 3.95].map((s) => FOOT[0] + 1 + s);
  const want = along.map((x) => BASE + (x - (FOOT[0] + 1)) * CLIMB / NEED);
  const mine = along.map((x) => game.deckHeightAt(x, TOWER[1] + 0.5));
  const theirs = psql(`select string_agg(coalesce(deck_height_at(${W}, x, ${TOWER[1] + 0.5})::text, 'null'), ',' order by i)
    from unnest(array[${along.join(',')}]::double precision[]) with ordinality t(x, i);`).split(',').map(Number);
  const near = (a: (number | null)[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v !== null && Math.abs(v - b[i]) < 1e-9);
  check(`a body on it stands at the deck's height there on both sides, rising ${CLIMB / NEED} a tile from the ground's ${BASE} to storey 3's ${BASE + CLIMB}`,
    near(mine, want) && near(theirs, want), `at ${along.join(', ')}: browser ${mine.join(', ')}; island ${theirs.join(', ')}; want ${want.join(', ')}`);
  const off = [game.deckHeightAt(FOOT[0] + 0.5, FOOT[1] + 0.5), psql(`select coalesce(deck_height_at(${W}, ${FOOT[0] + 0.5}, ${FOOT[1] + 0.5})::text, 'null');`)];
  check('and off its ends there is no deck under anybody, on both sides', off[0] === null && off[1] === 'null', `browser ${off[0]}, island ${off[1]}`);
  game.player.x = FOOT[0] + 1 + 2.5;
  game.player.y = TOWER[1] + 0.5;
  check('the browser puts its own body there too', Math.abs(game.playerHeight() - (BASE + 2.5 * CLIMB / NEED)) < 1e-9, `${game.playerHeight()}`);
}

/* ---- walked ------------------------------------------------------------------ */
{
  const [fx, y] = FOOT;
  const tx = TOWER[0];
  const onto = game.stepRule(fx, y, 0, fx + 1, y);
  const up = game.stepRule(fx + 1, y, 0, fx + 2, y);
  const offTop = game.stepRule(tx - 1, y, 0, tx, y);
  const ontoTop = game.stepRule(tx, y, TOP, tx - 1, y);
  const down = game.stepRule(tx - 1, y, TOP, tx - 2, y);
  const offFoot = game.stepRule(fx + 1, y, TOP, fx, y);
  const between = game.stepRule(tx - 1, y, 1, tx - 2, y);
  check('in the browser: onto it from the ground and up it is the ground, off its top is storey 3, onto it from storey 3 and down it is storey 3, off its foot is the ground',
    onto === 0 && up === 0 && offTop === TOP && ontoTop === TOP && down === TOP && offFoot === 0,
    `onto ${onto}, up ${up}, off the top ${offTop}, onto the top ${ontoTop}, down ${down}, off the foot ${offFoot}`);
  check('and nobody walks it at storey 2, which neither end is on', between === null, `${between}`);
}
const move = (x0: number, y0: number, l0: number, x1: number, y1: number, level: number): { x: number; y: number; level: number; blocked: boolean } => {
  psql(`update player set x = ${x0}, y = ${y0}, level = ${l0}, moved_at = now() - interval '10 seconds', away = false
          where world_id = ${W} and uid = ${DANE};`);
  const said = psql(`
    select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select rpc_move(${W}, ${x1}, ${y1}, ${level})::text;`).split('\n').pop() ?? '{}';
  return JSON.parse(said) as { x: number; y: number; level: number; blocked: boolean };
};
{
  const y = TOWER[1] + 0.5;
  const fx = FOOT[0] + 0.5;
  const tx = TOWER[0] + 0.5;
  const at = (m: { x: number; y: number; level: number; blocked: boolean }): string => JSON.stringify([+m.x.toFixed(2), m.level, m.blocked]);
  const a = move(fx, y, 0, fx + 1, y, 0);
  const b = move(fx + 1, y, 0, tx - 1, y, 0);
  const c = move(tx - 1, y, 0, tx, y, TOP);
  const d = move(tx, y, TOP, tx - 1, y, TOP);
  const e = move(tx - 1, y, TOP, fx + 1, y, TOP);
  const f = move(fx + 1, y, TOP, fx, y, 0);
  check('on the island the same walk stands: onto it and up it on the ground, off its top onto storey 3, and down it at storey 3 and off its foot',
    [a, b, c, d, e, f].every((m) => !m.blocked) && c.level === TOP && Math.floor(c.x) === TOWER[0] && d.level === TOP && Math.floor(e.x) === FOOT[0] + 1
      && f.level === 0 && Math.floor(f.x) === FOOT[0],
    [a, b, c, d, e, f].map(at).join(' '));
  const g = move(tx - 1, y, 1, tx - 2, y, 1);
  check('and the island stops a body walking it at storey 2 as well', g.blocked && Math.floor(g.x) === TOWER[0] - 1, at(g));
}

/* ---- put the ground back -------------------------------------------------- */
{
  const heights = heightsWere.split(';').map((r) => r.split(',').map(Number));
  const tiles = tilesWere.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`delete from floor_tile where world_id = w;
    delete from building_tile where world_id = w;
    delete from building where world_id = w;
    delete from bridge_span where world_id = w;
    delete from bridge where world_id = w;
    ${heights.map(([x, y, h]) => `perform land_set_height(w, ${x}, ${y}, ${h});`).join('\n')}
    ${tiles.map(([x, y, t, d]) => `perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`a ramp bridge is the same rules on both sides — ${ok.length} of ${ok.length}`);
