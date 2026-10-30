/**
 * Building tools: plans over an area, their totals, the last plan undone, and a roof pinned as its own storey.
 *
 * Asked for: "previews for multi-tile plans (ghost of the whole plan before committing), cost totals before you
 * commit (sum of every material across the plan, against what you carry/store), undo for a misplaced plan
 * (cancel/remove a plan just placed, refunding anything already delivered per the island's existing rules), and
 * extend the storey mode we added (pinned storey shows/picks/walks/builds only that storey) to roofs."
 *
 * On the island, as Dane on Hoarding, with a tower of three tiles by two, one storey, floored and bare:
 *
 *   * the browser's walls all round (`areaPieces`) are the ten outside sides, each passing the browser's check
 *     and the island's `act_refusal` alike; `rpc_plan_area` plans all ten in one call, as Dane's, on the storey
 *     asked, says one line for the lot and none of the ten single ones, and keeps them as Dane's last plan;
 *   * the totals are the bill of one wall times ten, against the pack;
 *   * `rpc_plan_undo` takes all ten down by Remove wall -- one with stone already delivered too, which gives back
 *     what Remove wall gives back (nothing, with no Mason's Salvage) -- says one line, and has nothing left to
 *     undo after; a plan kept past `plan_undo_seconds()` is not undone;
 *   * a single plan done the way a queued job is (`act_perform`) is the last plan, undone the same way;
 *   * a plan over an area asked for from out of reach of all of it is refused whole; a piece refused is left out
 *     and counted; a list that is empty, too long or not of tiles is a bad request;
 *   * a footprint dragged out over a rectangle is a building of those tiles, Dane's, undone tile by tile;
 *   * a whole roof planned over the tower is a roof tile on each, in the shape asked;
 *   * the browser's numbers are the island's: `PLAN_AREA_MOST`, `PLAN_UNDO_SECONDS`.
 *
 * And drawn in Chromium (`plantools-page.ts`), at desktop and phone width: the ghost of a storey's walls all
 * round, every piece passing; the bar with its totals, inside the screen; Plan asking for every piece on the
 * storey shown, and Undo offered after; pinned on a shed's roof, its menu is the roof's (Plan roof: every tile)
 * with no storey work, the storey under a roof offers no roof work, a planned pitched roof is picked on its
 * slope and is no place to walk; a footprint's ghost follows the cursor. Needs a Chromium as `storeyview.ts`
 * does; without one the drawing is skipped, unless `STOREY_STRICT` is set.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it. The tower is building 9401 at
 * four tiles from the middle of Dane's settlement, taken down after, the ground put back and Dane put back where he was.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ACTION_BY_ID } from '../../src/game/actions';
import { wallBill, type Side } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { areaAsk, areaPieces, areaTotals, passing, PLAN_AREA_MOST, PLAN_UNDO_SECONDS } from '../../src/game/planarea';
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
const lit = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ID = 9401;
/**
 * Dane's settlement, Latecomer: staked in island.sql over a hoard buried where the suite's rolls put it, so read here
 * rather than written in: anything rolled before it moves it.
 */
const [DX, DY] = psql(`select x || ',' || y from deed where name = 'Latecomer'
  and world_id = (select id from world where name = 'Hoarding');`).split(',').map(Number);
/** On it, clear of its totem: four tiles up and to the west of its middle. */
const [TX, TY] = [DX - 4, DY - 4];
const TOWER: Array<[number, number]> = [[TX, TY], [TX + 1, TY], [TX + 2, TY], [TX, TY + 1], [TX + 1, TY + 1], [TX + 2, TY + 1]];
/** The rectangle a footprint is dragged over: south of the tower, a tile's gap between. */
const [FX, FY] = [TX, TY + 3];
const AREA: Array<[number, number]> = [[FX, FY], [FX + 1, FY], [FX, FY + 1], [FX + 1, FY + 1]];
const X0 = TX - 1, X1 = TX + 3, Y0 = TY - 1, Y1 = FY + 2;

const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
/** A door asked as Dane, its answer. */
const asDane = (call: string): Record<string, unknown> => {
  const out = psql(`select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select (${call})::text;`).split('\n').pop() ?? '{}';
  // The pack and the stores said with an answer (`held_now`) are the browser's to lay down, not this test's to read.
  const { pack: _pack, crates: _crates, ...said } = JSON.parse(out) as Record<string, unknown>;
  return said;
};
/** A door asked as Dane, refused: the error it raised, or 'NOT REFUSED'. */
const refusedAsDane = (call: string): string => {
  try {
    execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
      input: `select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
        select (${call})::text;`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
        PGPORT: process.env.PGPORT ?? '5433',
        PGUSER: process.env.PGUSER ?? 'wurm',
        PGDATABASE: process.env.PGDATABASE ?? 'postgres',
      },
    });
    return 'NOT REFUSED';
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e).split('\n').find((l) => l.includes('ERROR')) ?? String(e);
  }
};
const lines = (): string[] => psql(`select text from event where world_id = ${W} and uid = ${DANE} order by n;`).split('\n').filter(Boolean);
const quiet = (): void => psql(`delete from event where world_id = ${W} and uid = ${DANE};`) as unknown as void;
/** The rate limit and the once keys left as a fresh body's, so a run of doors here is never held back for its pace. */
const rested = (): void => {
  psql(`do $$ begin
    if to_regclass('private.pace_bucket') is not null then execute 'delete from private.pace_bucket'; end if;
  end $$;
  update player set stats = jsonb_set(stats, '{stamina}', '1') where world_id = ${W} and name = 'Dane';`);
};

const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);
const groundWas = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0) || ',' || land_tile(${W}, gx, gy)
    || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const BASE = Number(psql(`select coalesce(land_height(${W}, ${TX}, ${TY}), 10);`)) || 10;

/* ---- the tower, on both sides ------------------------------------------------ */
const game = Game.create(4242);
const bld = game.buildings;
const world = game.world;
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.PackedDirt, 0);
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: DX, y: DY, radius: 5, level: 1, mine: true };
game.player.x = TX + 1.5;
game.player.y = TY + 2.5;
game.player.level = 0;
game.inventory.add('mallet', { ql: 40 });
game.inventory.add('log', { count: 30, ql: 30 });
bld.nextId = ID;
const tower = bld.create('Tower', TX, TY);
for (const [x, y] of TOWER.slice(1)) bld.addTile(tower, x, y);
const finish = (bill: { needed: Record<string, number> }): void => { for (const k of Object.keys(bill.needed)) bill.needed[k] = 0; };
for (const [x, y] of TOWER) finish(bld.setFloor(tower, 0, x, y, 'plank'));

const dirOf = (side: Side): string => (side === 'n' || side === 's' ? 'h' : 'v');
const bx = (x: number, side: Side): number => (side === 'e' ? x + 1 : x);
const by = (y: number, side: Side): number => (side === 's' ? y + 1 : y);
const clear = (): void => sql(`
  delete from no_plan_side where world_id = w and building in (select id from building where world_id = w and id >= ${ID});
  delete from wall where world_id = w and (building >= ${ID} or (x between ${X0} and ${X1 + 1} and y between ${Y0} and ${Y1 + 1}));
  delete from floor_tile where world_id = w and (building >= ${ID} or (x between ${X0} and ${X1} and y between ${Y0} and ${Y1}));
  delete from building_tile where world_id = w and (building >= ${ID} or (x between ${X0} and ${X1} and y between ${Y0} and ${Y1}));
  delete from building where world_id = w and (id >= ${ID} or not exists (select 1 from building_tile t where t.world_id = w and t.building = building.id));
  delete from private.plan_undo where world_id = w and uid = u;`);
clear();
sql(`
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop perform land_set_tile(w, gx, gy, tile_id('Packed dirt')); perform land_set_data(w, gx, gy, 0); end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'mallet';
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1);
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${ID}, 'Tower', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values ${TOWER.map(([x, y]) => `(w, ${ID}, ${x}, ${y})`).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
    ${TOWER.map(([x, y]) => `(w, 0, ${x}, ${y}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')`).join(', ')};
  update player set body_at = now(), x = ${TX + 1.5}, y = ${TY + 2.5}, level = 0 where world_id = w and uid = u;`.replace('begin', 'begin'));
const settledLand = psql(`select land_tile(${W}, ${TX}, ${TY}) = tile_id('Packed dirt');`);
check('the tower stands on packed dirt on the island', settledLand === 't', settledLand);

/* ---- the numbers are the island's ------------------------------------------- */
check('the most pieces a plan over an area asks for is the island\'s', Number(psql('select plan_area_most();')) === PLAN_AREA_MOST,
  `${psql('select plan_area_most();')} / ${PLAN_AREA_MOST}`);
check('and how long a plan is kept to undo', Number(psql('select plan_undo_seconds();')) === PLAN_UNDO_SECONDS,
  `${psql('select plan_undo_seconds();')} / ${PLAN_UNDO_SECONDS}`);

/* ---- walls all round: the ghost, the totals, the plan -------------------------- */
const wallsPlan = { kind: 'walls' as const, buildingId: ID, level: 0, wallType: 'solid' as const, material: 'log', anchor: { x: TX, y: TY } };
const pieces = areaPieces(game, wallsPlan);
const asks = areaAsk(pieces);
check('walls all round are the tower\'s ten outside sides, every one passing the browser\'s check', pieces.length === 10 && passing(pieces).length === 10,
  pieces.map((p) => `${p.target.x},${p.target.y}${p.target.side}:${p.why ?? 'ok'}`).join(' '));
{
  const theirs = asks.map((a) => psql(`select coalesce(act_refusal(${W}, ${DANE}, '${a.action}', ${lit(a.target)}), 'ALLOWED');`));
  // The reach of all but the nearest is the plan's: asked one by one, from where Dane stands, as a single click would be.
  const nearOnes = asks.filter((a) => Math.max(Math.abs(a.target.x - (TX + 1)), Math.abs(a.target.y - (TY + 2))) <= 1).length;
  const allowed = theirs.filter((t) => t === 'ALLOWED').length;
  const far = theirs.filter((t) => t === 'You are too far away from that.').length;
  check('the island allows each the browser does, but for its reach from where Dane stands', allowed === nearOnes && allowed + far === 10,
    theirs.join(' | '));
}
const totals = areaTotals(game, pieces);
{
  const one = wallBill('log', 'solid').needed.log;
  const log = totals.find((t) => t.id === 'log');
  check('the totals are one wall\'s bill ten times, against the pack', totals.length === 1 && log?.need === one * 10 && log.carried === 30,
    JSON.stringify(totals));
}
rested();
quiet();
const planned = asDane(`rpc_plan_area(${W}, ${lit(asks)})`);
check('rpc_plan_area plans all ten in one call', planned.planned === 10 && planned.refused === 0, JSON.stringify(planned));
{
  const rows = psql(`select count(*) || ',' || count(*) filter (where planned_by = ${DANE}) || ',' || count(*) filter (where level = 0)
    || ',' || count(*) filter (where type = 'solid' and material = 'log') from wall where world_id = ${W} and building = ${ID};`);
  check('ten walls on the island, Dane\'s, on the ground storey, solid log', rows === '10,10,10,10', rows);
  const where = asks.every((a) => psql(`select count(*) from wall where world_id = ${W} and level = 0 and dir = '${dirOf(a.target.side as Side)}'
    and x = ${bx(a.target.x, a.target.side as Side)} and y = ${by(a.target.y, a.target.side as Side)};`) === '1');
  check('each on the side the browser laid it on', where);
  const said = lines();
  check('said once for the lot, and none of the ten single lines', said.includes('Planned: 10 walls.') && !said.some((l) => l.startsWith('You plan')),
    said.join(' / '));
  const kept = psql(`select jsonb_array_length(pieces) from private.plan_undo where world_id = ${W} and uid = ${DANE};`);
  check('and kept as Dane\'s last plan', kept === '10', kept);
}

/* ---- undone: the ten walls taken down, delivered stone as Remove wall gives it ----- */
{
  // Stone already in one of them: four logs fitted.
  const a = asks[0];
  sql(`update wall set needed = jsonb_set(needed, '{log}', to_jsonb((needed->>'log')::int - 4)) where world_id = w and level = 0
    and dir = '${dirOf(a.target.side as Side)}' and x = ${bx(a.target.x, a.target.side as Side)} and y = ${by(a.target.y, a.target.side as Side)};`);
  const logsWere = Number(psql(`select coalesce(sum(count), 0) from item where world_id = ${W} and holder = 'player' and holder_uid = ${DANE} and def = 'log';`));
  rested();
  quiet();
  const undone = asDane(`rpc_plan_undo(${W})`);
  const left = psql(`select count(*) from wall where world_id = ${W} and building = ${ID};`);
  check('rpc_plan_undo takes all ten down', undone.removed === 10 && left === '0', `${JSON.stringify(undone)}; ${left} left`);
  const logs = Number(psql(`select coalesce(sum(count), 0) from item where world_id = ${W} and holder = 'player' and holder_uid = ${DANE} and def = 'log';`));
  const salvage = Number(psql(`select pk(${W}, ${DANE}, 'salvage:build_wood', 0);`));
  check('the logs fitted come back as Remove wall gives them back: its Salvage share, none without it', logs - logsWere === Math.floor(4 * salvage),
    `${logsWere} → ${logs}, salvage ${salvage}`);
  const said = lines();
  check('said once for the lot', said.includes('Undone: 10 walls.') && !said.some((l) => l.startsWith('You take down')), said.join(' / '));
  rested();
  const again = asDane(`rpc_plan_undo(${W})`);
  check('and nothing is left to undo after', again.removed === 0 && again.why === 'No plan to undo.', JSON.stringify(again));
}

/* ---- a single plan, done as a queued job is, is the last plan ------------------ */
{
  const t = { kind: 'tile', x: TX, y: TY, cx: TX, cy: TY, side: 'n', wallType: 'solid', material: 'log', level: 0 };
  sql(`perform act_perform(w, u, 'plan_wall', ${lit(t)});`);
  const kept = psql(`select jsonb_array_length(pieces) || ',' || (pieces->0->>'action') from private.plan_undo where world_id = ${W} and uid = ${DANE};`);
  check('a single plan done is kept as the last plan', kept === '1,plan_wall', kept);
  rested();
  const undone = asDane(`rpc_plan_undo(${W})`);
  check('and undone by itself', undone.removed === 1 && psql(`select count(*) from wall where world_id = ${W} and building = ${ID};`) === '0', JSON.stringify(undone));
  sql(`perform act_perform(w, u, 'plan_wall', ${lit(t)});
    update private.plan_undo set at = now() - make_interval(secs => plan_undo_seconds() + 1) where world_id = w and uid = u;`);
  rested();
  const late = asDane(`rpc_plan_undo(${W})`);
  check(`a plan kept past ${PLAN_UNDO_SECONDS} s is not undone`, late.removed === 0 && psql(`select count(*) from wall where world_id = ${W} and building = ${ID};`) === '1',
    JSON.stringify(late));
  sql(`delete from wall where world_id = w and building = ${ID}; delete from private.plan_undo where world_id = w and uid = u;`);
}

/* ---- refused: out of reach, a piece left out, a bad list ----------------------- */
{
  sql(`update player set x = ${TX + 1.5}, y = ${TY + 6.5} where world_id = w and uid = u;`);
  rested();
  const far = asDane(`rpc_plan_area(${W}, ${lit(asks)})`);
  check('asked from out of reach of every piece, refused whole', far.planned === 0 && far.why === 'You are too far away from that.'
    && psql(`select count(*) from wall where world_id = ${W} and building = ${ID};`) === '0', JSON.stringify(far));
  sql(`update player set x = ${TX + 1.5}, y = ${TY + 2.5} where world_id = w and uid = u;`);
  // A floor where there is one already, among two where there are none.
  sql(`delete from floor_tile where world_id = w and building = ${ID} and level = 0 and (x, y) in ((${TX + 1}, ${TY + 1}), (${TX + 2}, ${TY + 1}));`);
  const floorAsks = [[TX, TY + 1], [TX + 1, TY + 1], [TX + 2, TY + 1]].map(([x, y]) => ({ action: 'plan_floor', target: { kind: 'tile', x, y, cx: x, cy: y, material: 'plank', floorKind: 'floor', level: 0 } }));
  rested();
  quiet();
  const some = asDane(`rpc_plan_area(${W}, ${lit(floorAsks)})`);
  check('a piece refused is left out and counted, the rest planned', some.planned === 2 && some.refused === 1, JSON.stringify(some));
  check('and said so with the reason', lines().includes('Planned: 2 floor tiles. Refused 1: Floor already planned here.'), lines().join(' / '));
  rested();
  asDane(`rpc_plan_undo(${W})`);
  sql(`insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
    (w, 0, ${TX + 1}, ${TY + 1}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}'), (w, 0, ${TX + 2}, ${TY + 1}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')
    on conflict do nothing;`);
  for (const [what, list] of [
    ['an empty list', []],
    [`a list past ${PLAN_AREA_MOST}`, Array.from({ length: PLAN_AREA_MOST + 1 }, () => asks[0])],
    ['a job that is no plan', [{ action: 'remove_wall', target: asks[0].target }]],
    ['a target that is no tile', [{ action: 'plan_wall', target: { kind: 'crate', id: 1 } }]],
  ] as Array<[string, unknown[]]>) {
    rested();
    const why = refusedAsDane(`rpc_plan_area(${W}, ${lit(list)})`);
    check(`${what} is a bad request`, why.includes('Bad request: rpc_plan_area'), why);
  }
}

/* ---- a footprint dragged over a rectangle, and undone ------------------------- */
{
  const fp = areaPieces(game, { kind: 'footprint', level: 0, anchor: { x: FX, y: FY }, corner: { x: FX + 1, y: FY + 1 }, name: 'Annex' });
  const fpAsks = areaAsk(fp);
  check('the browser lays the rectangle out as a new building and three tiles added to it',
    fpAsks.length === 4 && fpAsks[0].action === 'plan_building' && fpAsks.slice(1).every((a) => a.action === 'add_to_building'),
    fp.map((p) => `${p.action}@${p.target.x},${p.target.y}:${p.why ?? 'ok'}`).join(' '));
  sql(`update player set x = ${FX + 0.5}, y = ${FY + 2.5} where world_id = w and uid = u;`);
  rested();
  quiet();
  const made = asDane(`rpc_plan_area(${W}, ${lit(fpAsks)})`);
  const b = psql(`select b.name || ',' || (b.planned_by = ${DANE}) || ',' || count(t.*) from building b join building_tile t on t.world_id = b.world_id and t.building = b.id
    where b.world_id = ${W} and (t.x, t.y) in (${AREA.map(([x, y]) => `(${x}, ${y})`).join(', ')}) group by b.name, b.planned_by;`);
  check('the island plans it as one building of the four tiles, Dane\'s', made.planned === 4 && b === 'Annex,true,4', `${JSON.stringify(made)}; ${b}`);
  check('said once', lines().includes('Planned: 4 tiles.'), lines().join(' / '));
  rested();
  const undone = asDane(`rpc_plan_undo(${W})`);
  const left = psql(`select count(*) from building_tile where world_id = ${W} and (x, y) in (${AREA.map(([x, y]) => `(${x}, ${y})`).join(', ')});`);
  check('and undone tile by tile, the building with its last tile', undone.removed === 4 && left === '0'
    && psql(`select count(*) from building where world_id = ${W} and name = 'Annex';`) === '0', `${JSON.stringify(undone)}; ${left} left`);
  sql(`update player set x = ${TX + 1.5}, y = ${TY + 2.5} where world_id = w and uid = u;`);
}

/* ---- a whole roof ------------------------------------------------------------ */
{
  // Walls all round first, finished, on both sides: a roof goes over a storey closed in.
  for (const a of asks) finish(bld.setWall(tower, 0, a.target.x, a.target.y, a.target.side as Side, 'solid', 'log'));
  sql(`insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
    ${asks.map((a) => `(w, 0, '${dirOf(a.target.side as Side)}', ${bx(a.target.x, a.target.side as Side)}, ${by(a.target.y, a.target.side as Side)}, ${ID}, 'solid', 'log', '{"log": 0}', '{"log": 16}')`).join(', ')};`);
  const roof = areaPieces(game, { kind: 'roof', buildingId: ID, level: 0, material: 'log', roofShape: 'gable', anchor: { x: TX, y: TY } });
  check('the browser lays a roof tile on each of the six, every one passing', roof.length === 6 && passing(roof).length === 6,
    roof.map((p) => `${p.target.x},${p.target.y}:${p.why ?? 'ok'}`).join(' '));
  rested();
  quiet();
  const made = asDane(`rpc_plan_area(${W}, ${lit(areaAsk(roof))})`);
  const rows = psql(`select count(*) || ',' || min(kind) || ',' || min(level) from floor_tile where world_id = ${W} and building = ${ID} and kind = 'roof';`);
  const shape = psql(`select roof from building where world_id = ${W} and id = ${ID};`);
  check('the island lays six roof tiles over the storey, gabled', made.planned === 6 && rows === '6,roof,1' && shape === 'gable', `${JSON.stringify(made)}; ${rows}; ${shape}`);
  check('said once', lines().includes('Planned: 6 roof tiles.'), lines().join(' / '));
}

/* ---- put the ground back -------------------------------------------------------- */
{
  clear();
  const ground = groundWas.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`${ground.map(([x, y, h, t, d]) => `perform land_set_height(w, ${x}, ${y}, ${h}); perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;`);
  void ACTION_BY_ID;
}

/* ---- drawn ------------------------------------------------------------------- */
/** A Chromium to drive, as `crowd.ts` finds one, or null. */
function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}
type State = { placing: string | null; ghost: string[]; bar: string; undo: boolean };
type Menu = { title: string; rows: string[]; pick: { x: number; y: number; level?: number } | null };
const options = browserOptions();
if (!options) {
  console.log('plantools: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/plantools-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  try {
    for (const phone of [false, true]) {
      const width = phone ? 390 : 1280;
      const ctx = await browser.newContext(phone
        ? { viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
        : { viewport: { width, height: 800 }, deviceScaleFactor: 1 });
      const tab = await ctx.newPage();
      const thrown: string[] = [];
      tab.on('pageerror', (e) => thrown.push(e.message));
      await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
      await tab.addStyleTag({ content: css });
      await tab.addScriptTag({ content: bundled.outputFiles[0].text });
      const run = <T>(fn: string): Promise<T> => tab.evaluate(`(async () => { const p = window.plantools; ${fn} })()`) as Promise<T>;
      const at = phone ? 'phone' : 'desktop';

      // A storey's walls all round, from storey 2 of the hall, pinned.
      const menu = await run<Menu>('return p.menu(1, p.hx + 1, p.hy + 1, 1, false);');
      check(`${at}: storey 2's menu offers its walls all round and its floor is whole`, menu.rows.some((r) => r.startsWith('Plan walls all round (storey 2)'))
        && !menu.rows.some((r) => r.startsWith('Plan floor: every tile')), menu.rows.filter((r) => !r.includes(' > ')).join(' / '));
      check(`${at}: and the storey under the roof offers no roof work while pinned`, !menu.rows.some((r) => r.startsWith('Plan roof')), menu.rows.filter((r) => !r.includes(' > ')).join(' / '));
      await run('p.choose(1, p.hx + 1, p.hy + 1, 1, ["Plan walls all round", "Solid", "Log"]); p.frame(1);');
      const laid = await run<State>('return p.state();');
      check(`${at}: laid out, the ghost is the hall's fourteen sides on storey 2, every one passing`,
        laid.placing === 'area' && laid.ghost.length === 14 && laid.ghost.every((g) => g.startsWith('wall:') && g.endsWith(':1:ok')), laid.ghost.join(' '));
      check(`${at}: and the bar sums it`, laid.bar.startsWith('Plan: 14 walls · Solid, log · storey 2') && laid.bar.includes('Log224200204'), laid.bar);
      const box = await tab.evaluate(() => { const r = document.querySelector('.plan-bar')!.getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; });
      check(`${at}: the bar is inside the screen`, box[0] >= 0 && box[1] <= width && box[2] <= width, box.join(', '));
      await run('p.asks.length = 0; p.game.planArea = async (a) => { p.asked = a; return { planned: a.length }; }; p.game.undoPlan = async () => ({ removed: 14 }); await p.ui.commitPlanArea(); p.frame(1);');
      const sent = await run<Array<{ action: string; target: { level?: number } }>>('return p.asked ?? [];');
      const after = await run<State>('return p.state();');
      check(`${at}: Plan asks the island for all fourteen on storey 2, in one call`, sent.length === 14 && sent.every((a) => a.action === 'plan_wall' && a.target.level === 1),
        `${sent.length}: ${JSON.stringify(sent[0] ?? null)}`);
      check(`${at}: and Undo is offered after, the ghost gone`, after.undo && after.placing === null && after.ghost.length === 0 && after.bar.startsWith('Planned: 14 walls'), JSON.stringify(after));
      const undoRow = await run<Menu>('return p.menu(null, p.hx + 1, p.hy + 1, 0, false);');
      check(`${at}: a building's menu offers Undo last plan`, undoRow.rows.includes('Undo last plan'), undoRow.rows.filter((r) => !r.includes(' > ')).join(' / '));
      await run('p.ui.planBar.hide();');

      // A roof pinned as its own storey: the shed's.
      const roofMenu = await run<Menu>('p.look.x = p.sx + 1; p.look.y = p.sy + 1; return p.menu(1, p.sx, p.sy, 1, false);');
      check(`${at}: pinned on the shed's roof, its menu is the roof's: Plan roof: every tile, no storey work`,
        roofMenu.title.startsWith('Shed · roof') && roofMenu.rows.includes('Plan roof: every tile') && !roofMenu.rows.some((r) => r.startsWith('Plan wall') || r.startsWith('Plan floor')),
        `${roofMenu.title}: ${roofMenu.rows.filter((r) => !r.includes(' > ')).join(' / ')}`);
      await run('p.choose(1, p.sx, p.sy, 1, ["Plan roof: every tile", "Gabled", "Log"]); p.frame(1);');
      const roofLaid = await run<State>('return p.state();');
      check(`${at}: and its ghost is the four roof tiles at the roof's own level`, roofLaid.ghost.length === 4 && roofLaid.ghost.every((g) => g.startsWith('roof:') && g.endsWith(':1:ok')),
        roofLaid.ghost.join(' '));
      await run('p.ui.cancelPlacing();');
      // Planned: a pitched roof, picked on its slope, and no place to walk.
      const roofPick = await run<{ pick: { x: number; y: number; level?: number } | null; pitched: boolean; hover: string }>(`
        p.roofOn();
        p.frame(1); p.frame(1);
        const [sx, sy] = p.ridge();
        const pick = p.renderer.pick(sx, sy);
        return { pick: pick && { x: pick.x, y: pick.y, level: pick.level }, pitched: !!pick && p.pitched(pick.x, pick.y, 1), hover: p.hoverAt(sx, sy) };`);
      check(`${at}: a planned gabled roof is picked on its ridge, a tile of the shed on the roof's level`,
        !!roofPick.pick && roofPick.pick.level === 1 && roofPick.pick.x >= (await run<number>('return p.sx;')) && roofPick.pick.x <= (await run<number>('return p.sx + 1;')),
        JSON.stringify(roofPick));
      check(`${at}: and is no place to walk`, roofPick.pitched, JSON.stringify(roofPick));
      check(`${at}: its hover says the roof`, roofPick.hover.includes('gabled roof'), roofPick.hover);

      // A footprint's ghost follows the cursor.
      const fp = await run<State>(`p.look.x = p.cx - 4; p.look.y = p.cy + 3; p.choose(null, p.cx - 6, p.cy + 3, 0, ['Plan building over an area']);
        p.renderer.hover = p.pickAt(null, p.cx - 3, p.cy + 5, 0); p.frame(null); return p.state();`);
      check(`${at}: a footprint's ghost is the rectangle to the cursor`, fp.ghost.length === 12 && fp.ghost.every((g) => g.startsWith('tile:') && g.endsWith(':ok'))
        && fp.bar.startsWith('Plan: 12 tiles'), `${fp.ghost.length}: ${fp.bar}`);
      await run('p.ui.cancelPlacing();');
      check(`${at}: and the page threw nothing`, thrown.length === 0, thrown.join('; '));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} building tools checks failed`);
  process.exit(1);
}
console.log(`building tools — ${ok.length} of ${ok.length}`);
