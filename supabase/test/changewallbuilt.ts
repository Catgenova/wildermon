/**
 * A wall changed where it stands is built, by hand and by a hod carrier, and the browser shows it as it lands.
 *
 * Asked: "change wall/floor function doesn't seem to work, the wall retains the same type and doesn't allow adding
 * the new materials". `changewall.ts` puts the rules to both sides by calling `perform_building` directly; this goes
 * the way a player's page does:
 *
 *   * by hand, through `rpc_act` and the job's goes (`settle`), on the ground and a storey up, a change of type and a
 *     change of material: the change planned in the island's words and kept with its wall; the ground read's slow half
 *     carries it, and laid in the browser (`Buildings.sawIsland`) the wall has the change on it, the menu's first row
 *     builds it (`changeWallRows`) and Build wall allows it; built, the wall is the new one on the island, in the
 *     slow half and in the browser, and no Build change row is left;
 *   * the browser's `Island` asks the slow half after a go of a building job lands (`BUILDS`), not only as the job is
 *     asked: that read went before the go landed, and the next came `NEAR_WHOLE_EVERY` seconds on, so a change planned
 *     or built showed as the old wall with no row to build it; `BUILDS` is the island's `build_action`, job for job,
 *     floors among them; a job that is not a building job still leaves the next read quick;
 *   * by a hod carrier: a change on a finished wall is work as an open wall is (`hod_work`, `Game.hodNeeding`), on
 *     the ground and a storey up, a type and a material; fitted out of the stores piece for piece in the same order on
 *     both sides, and with the last piece each wall is the new one on both sides;
 *   * and a cobbe at work for an hour, on both sides, finishes a change a storey up out of the chest.
 *
 * The island halves make their own islands and roll them back.
 */
import { Game, type HodTarget } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { isDone, MATERIAL_BY_ID, SIDE_NAMES, wallBill, type Bill, type BuildingsJSON, type Side, type Wall, type WallType } from '../../src/game/building';
import { needsText } from '../../src/game/buildActions';
import { changeLine } from '../../src/game/gates';
import { changeWallRows } from '../../src/ui/frameMenu';
import { BUILDS, Island } from '../../src/net/island';
import { NEAR_WHOLE_EVERY } from '../../src/game/keep';
import { TileType } from '../../src/world/tiles';
import type { Item } from '../../src/game/items';
import { psql, check, finish } from './harness';

const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const said = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const along = (x: number, y: number, side: Side): { bx: number; by: number; dir: 'h' | 'v' } => ({
  bx: side === 'e' ? x + 1 : x, by: side === 's' ? y + 1 : y, dir: side === 'n' || side === 's' ? 'h' : 'v',
});
/** A bill's counts by name, in one order whichever side wrote them. */
const sorted = (b: Record<string, number>): string => JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));
const units = (b: Bill): number => Object.values(b.needed).reduce((n, k) => n + Math.max(0, k), 0);

/* ---- the walls changed: on the ground and a storey up, a type and a material ------------------------------------ */

const T = 40;
const HOUSE = [T + 2, T + 2] as const;
/** The walls the house stands in, every side of both storeys, finished. */
const STANDS = { type: 'solid' as WallType, material: 'plank' };
interface Case { name: string; level: number; side: Side; type: WallType; material: string }
const CASES: Case[] = [
  { name: 'on the ground, to another type', level: 0, side: 'n', type: 'door', material: 'plank' },
  { name: 'on the ground, to another material', level: 0, side: 'e', type: 'solid', material: 'log' },
  { name: 'a storey up, to another type', level: 1, side: 'n', type: 'window', material: 'plank' },
  { name: 'a storey up, to another material', level: 1, side: 'e', type: 'solid', material: 'log' },
];
const TOOLS = ['mallet', 'trowel'];

/* ---- by hand, on the island: asked as a page asks, through `rpc_act` --------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-000000000c71';
const runOut = (action: string, target: Record<string, unknown>, times: number): string => `
  delete from caller where uid = u;
  perform rpc_act(w, '${action}', ${j(target)}, ${times});
  for i in 1 .. 200 loop
    exit when (select act from player where world_id = w and uid = u) is null;
    update player set act_ends = now() - interval '1 second', stats = jsonb_set(stats, '{stamina}', '1') where world_id = w and uid = u;
    perform settle(w, u);
  end loop;`;
const lastSaid = (k: string): string => `insert into said select '${k}', coalesce((select text from event where world_id = w and uid = u
    and kind = 'event' order by n desc limit 1), '');`;
const slowHalf = (k: string): string => `delete from caller where uid = u;
  insert into said select '${k}', (rpc_ground(w, 40, true)->'buildings')::text;`;
const wallRow = (k: string, c: Case): string => {
  const { bx, by, dir } = along(HOUSE[0], HOUSE[1], c.side);
  return `insert into said select '${k}', coalesce((select wl.type || '|' || wl.material || '|' || bill_done(wl.needed) || '|'
      || coalesce((select ch.type || '|' || ch.material || '|' || ch.needed::text from wall_change ch where ch.world_id = w
                     and ch.level = wl.level and ch.dir = wl.dir and ch.x = wl.x and ch.y = wl.y), '-')
    from wall wl where wl.world_id = w and wl.level = ${c.level} and wl.dir = '${dir}' and wl.x = ${bx} and wl.y = ${by}), 'none');`;
};

const finished = (bill: Bill): Record<string, number> => Object.fromEntries(Object.keys(bill.total).map((k) => [k, 0]));
const standing = wallBill(STANDS.material, STANDS.type);
const byHand = said(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Changebuilt', 647, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Builder');
  update player set x = ${HOUSE[0]} + 0.5, y = ${HOUSE[1]} + 0.5, level = 0, body_at = now(), swim_at = now(), act = null, act_queue = '[]'::jsonb,
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Changestead', ${T}, ${T}, 10, 1, u);
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 90), (w, u, 'masonry', 90)
    on conflict (world_id, uid, id) do update set value = 90;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  ${TOOLS.map((t) => `perform give(w, u, '${t}', 1, 50);`).join('\n  ')}
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 1, 'Hall', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, ${HOUSE[0]}, ${HOUSE[1]});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, lv, bd.dir, bd.x, bd.y, 1, '${STANDS.type}', '${STANDS.material}', ${j(finished(standing))}, ${j(standing.total)}, u
    from generate_series(0, 1) lv, (values ('n'), ('s'), ('e'), ('w')) s(sd), border_of(${HOUSE[0]}, ${HOUSE[1]}, s.sd) bd;
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    values (w, 1, ${HOUSE[0]}, ${HOUSE[1]}, 1, 'plank', 'floor', '{"plank": 0}', '{"plank": 4}');
  ${CASES.map((c, i) => {
    const t = { kind: 'tile', x: HOUSE[0], y: HOUSE[1], cx: HOUSE[0], cy: HOUSE[1], side: c.side, level: c.level };
    const bill = wallBill(c.material, c.type);
    return `
  -- ${c.name}: planned, then its bill to hand and built, all of it in one ask.
  ${runOut('change_wall', { ...t, wallType: c.type, material: c.material }, 1)}
  ${lastSaid(`PLANNED${i}`)}
  ${wallRow(`PLAN${i}`, c)}
  ${slowHalf(`SLOW_PLAN${i}`)}
  ${Object.entries(bill.total).map(([id, n]) => `perform give(w, u, '${id}', ${n}, 40);`).join('\n  ')}
  ${runOut('build_wall', t, 100)}
  ${lastSaid(`BUILT${i}`)}
  ${wallRow(`WALL${i}`, c)}
  ${slowHalf(`SLOW_BUILT${i}`)}`;
  }).join('\n')}
end $t$;
select k || '=' || v from said;
rollback;
`));

/* ---- and what the browser shows of it, laid from the slow half --------------------------------------------------- */

const page = Game.create(6470);
for (const c of [...page.creatures.list.values()]) page.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { page.world.setHeight(x, y, 4); page.world.setTile(x, y, TileType.Grass, 0); }
page.deed = { name: 'Changestead', x: T, y: T, radius: 10, level: 1, mine: true } as typeof page.deed;
page.player.x = HOUSE[0] + 0.5;
page.player.y = HOUSE[1] + 0.5;
page.skills.values.set('carpentry', 90);
page.skills.values.set('masonry', 90);
for (const t of TOOLS) page.inventory.add(t, { ql: 50 });
const lay = (json: string | undefined): void => page.buildings.sawIsland(JSON.parse(json || '{}') as BuildingsJSON);
const why = (def: { check?: (t: Target, g: Game) => string | null }, t: Target): string | null => def.check?.(t, page) ?? null;

CASES.forEach((c, i) => {
  const bill = wallBill(c.material, c.type);
  const name = MATERIAL_BY_ID.get(c.material)?.name ?? c.material;
  const side = SIDE_NAMES[c.side];
  const wantPlan = `${changeLine(c.type, name, side)} Needs ${needsText({ ...bill, material: c.material })}.`;
  const plannedSaid = byHand.get(`PLANNED${i}`);
  check(`${c.name}: Change wall through rpc_act plans it, in the browser's words: "${wantPlan}"`, plannedSaid === wantPlan, plannedSaid);
  const plan = byHand.get(`PLAN${i}`) ?? '';
  check(`${c.name}: on the island the wall stands as it was, finished, with the change on it at its whole bill`,
    plan.startsWith(`${STANDS.type}|${STANDS.material}|true|${c.type}|${c.material}|`)
      && sorted(JSON.parse(plan.split('|').slice(5).join('|') || '{}')) === sorted(bill.total),
    plan);

  lay(byHand.get(`SLOW_PLAN${i}`));
  const target = { kind: 'tile' as const, x: HOUSE[0], y: HOUSE[1], cx: HOUSE[0], cy: HOUSE[1], side: c.side, level: c.level };
  const wall = page.buildings.wall(c.level, HOUSE[0], HOUSE[1], c.side);
  check(`${c.name}: the slow half carries the change, and laid in the browser the wall has it`,
    !!wall && wall.type === STANDS.type && wall.material === STANDS.material && wall.change?.type === c.type && wall.change.material === c.material
      && units(wall.change) === units(bill),
    JSON.stringify(wall));
  for (const [id, n] of Object.entries(bill.total)) page.inventory.add(id, { count: n, ql: 40 });
  const rows = wall ? changeWallRows(page, wall, target, why) : [];
  check(`${c.name}: with its bill to hand, the menu's first row builds the change`,
    (rows[0]?.label ?? '').startsWith(`Build change (${side}): `) && !rows[0].disabled,
    rows.map((r) => `${r.label}${r.hint ? ` [${r.hint}]` : ''}`).join(' / '));
  const buildWhy = why(ACTION_BY_ID.get('build_wall')!, target);
  check(`${c.name}: and Build wall allows it in the browser`, buildWhy === null, String(buildWhy));
  for (const [id, n] of Object.entries(bill.total)) {
    for (const it of page.inventory.items.filter((x) => x.id === id)) page.inventory.remove(it.uid, Math.min(n, it.count));
  }

  const built = byHand.get(`BUILT${i}`);
  check(`${c.name}: built by hand, the last go says it is built`, !!built && built.startsWith('Built: '), built);
  check(`${c.name}: and on the island the wall is the new one, finished, with no change left`,
    byHand.get(`WALL${i}`) === `${c.type}|${c.material}|true|-`, byHand.get(`WALL${i}`));
  lay(byHand.get(`SLOW_BUILT${i}`));
  const after = page.buildings.wall(c.level, HOUSE[0], HOUSE[1], c.side);
  check(`${c.name}: the slow half carries the new wall, and laid in the browser the wall is the new one`,
    !!after && after.type === c.type && after.material === c.material && isDone(after) && !after.change, JSON.stringify(after));
  const rowsAfter = after ? changeWallRows(page, after, target, why) : [];
  check(`${c.name}: and no Build change row is left`, rowsAfter.length > 0 && !rowsAfter.some((r) => r.label.startsWith('Build change')),
    rowsAfter.map((r) => r.label).join(' / '));
});

/* ---- the browser's `Island`: the slow half asked after a building job's go lands --------------------------------- */

const isBuild = psql(`select string_agg(id, ',' order by id) from action_def where build_action(id);`).split(',').filter(Boolean);
check('the jobs the browser reads the walls again after are the island\'s building jobs (`build_action`), floors among them',
  isBuild.length > 0 && isBuild.length === BUILDS.size && isBuild.every((id) => BUILDS.has(id)) && BUILDS.has('plan_floor') && BUILDS.has('build_floor'),
  `island ${isBuild.join(',')}; browser ${[...BUILDS].sort().join(',')}`);

const asked: Array<{ door: string; args: Record<string, unknown> }> = [];
let settled = 0;
const answer = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const door = /\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname)?.[1];
  if (!door) return answer(null);
  const args = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  asked.push({ door, args });
  const ground = { placed: [], crates: [], lying: [], cellarLying: [], at: 'g1:100.5:100.5:40:0:v1:1:1:1:', full: true };
  if (door === 'rpc_act') return answer({ started: true, ends: new Date(Date.now() + 2000).toISOString(), seconds: 2 });
  if (door === 'rpc_settle') return answer({ settled, act: null });
  if (door === 'rpc_near') return answer({ creatures: { at: 'v1:1:1:1:', rows: [], gone: [], full: true, cols: ['id'] }, ground });
  if (door === 'rpc_ground') return answer(ground);
  if (door === 'rpc_creatures') return answer({ at: 'v1:1:1:1:', rows: [], gone: [], full: true, cols: ['id'] });
  return answer(null);
}) as typeof fetch;
let clock = 1000;
Object.defineProperty(globalThis.performance, 'now', { configurable: true, value: () => clock * 1000 });
const hooks = new Proxy({}, { get: () => () => undefined });
const island = new Island(hooks as unknown as ConstructorParameters<typeof Island>[0]);
const inside = island as unknown as { info: unknown; armBeat: () => void; pulse: () => Promise<boolean> };
inside.info = { id: '00000000-0000-4000-8000-0000000006a7', size: 4096 };
inside.armBeat = () => undefined;
/** Whether the next ground read asks for the slow half, read off what it sends. */
const nextSlow = async (): Promise<boolean | undefined> => {
  clock += 5;
  asked.length = 0;
  await island.refreshNear(clock);
  const read = asked.find((a) => 'p_slow' in a.args);
  return read ? read.args.p_slow === true : undefined;
};
/** A job asked, its first read, its go landed, and whether the read after that asks for the slow half. */
const afterGo = async (action: string): Promise<[boolean | undefined, boolean | undefined]> => {
  await nextSlow();
  await island.act(action, { kind: 'tile', x: HOUSE[0], y: HOUSE[1], side: 'n', level: 1 }, 1);
  const asAsked = await nextSlow();
  settled = 1;
  clock += 3;
  await inside.pulse();
  settled = 0;
  return [asAsked, await nextSlow()];
};
for (const action of ['change_wall', 'build_wall', 'plan_floor', 'build_floor']) {
  const [asAsked, afterLanded] = await afterGo(action);
  check(`${action}: the read as it is asked takes the slow half, and so does the read after its go lands`, asAsked === true && afterLanded === true,
    `as asked ${asAsked}, after the go ${afterLanded}`);
}
{
  let all = true;
  const missed: string[] = [];
  for (const action of BUILDS) {
    const [, afterLanded] = await afterGo(action);
    if (afterLanded !== true) {
      all = false;
      missed.push(action);
    }
  }
  check(`every building job's go landed is shown at the next read, not ${NEAR_WHOLE_EVERY} s on`, all, missed.join(', '));
}
{
  const [asAsked, afterLanded] = await afterGo('mine');
  check('a job that is not a building job: the slow half as it is asked, and the quick one after its go', asAsked === true && afterLanded === false,
    `as asked ${asAsked}, after the go ${afterLanded}`);
}

/* ---- by a hod carrier: piece for piece, on both sides ------------------------------------------------------------ */

const RANGE = 12;
const g = Game.create(6471);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
g.deed = { name: 'Hodstead', x: T, y: T, radius: 10, level: 1 };
const hall = g.buildings.create('Hall', HOUSE[0], HOUSE[1]);
g.buildings.addTile(hall, HOUSE[0], HOUSE[1] + 1);
hall.levels = 2;
const finish0 = (b: Bill): void => {
  for (const k of Object.keys(b.needed)) b.needed[k] = 0;
};
const allWalls: Wall[] = [];
for (const level of [0, 1]) {
  for (const side of ['n', 'e', 'w'] as Side[]) {
    for (const y of [HOUSE[1], HOUSE[1] + 1]) {
      if (side === 'n' && y !== HOUSE[1]) continue;
      const wl = g.buildings.setWall(hall, level, HOUSE[0], y, side, STANDS.type, STANDS.material);
      finish0(wl);
      allWalls.push(wl);
    }
  }
}
// A floor a storey up over the first tile, and a staircase up to it on the second, from the south (`hod_stand`).
const deck = g.buildings.setFloor(hall, 1, HOUSE[0], HOUSE[1], 'plank', 'floor');
const flight = g.buildings.setFloor(hall, 1, HOUSE[0], HOUSE[1] + 1, 'plank', 'stairs', 's');
finish0(deck);
finish0(flight);
const changes = CASES.map((c) => {
  const wl = g.buildings.wall(c.level, HOUSE[0], HOUSE[1], c.side)!;
  const bill = wallBill(c.material, c.type);
  wl.change = { type: c.type, material: c.material, needed: { ...bill.needed }, total: { ...bill.total } };
  return { c, wl };
});
const stock = new Map<string, number>();
for (const { wl } of changes) for (const [id, n] of Object.entries(wl.change!.needed)) stock.set(id, (stock.get(id) ?? 0) + n);
const CHEST = [T + 1, T] as const;
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 40, [...stock].map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count })));

const setOut = `
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodstead', ${T}, ${T}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${[...stock].map(([id, n]) => `(w, 'furniture', v_chest, '${id}', 30, ${n})`).join(', ')};
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 2, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, ${HOUSE[0]}, ${HOUSE[1]}), (w, 1, ${HOUSE[0]}, ${HOUSE[1] + 1});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${allWalls.map((wl) => `(w, ${wl.level}, '${wl.dir}', ${wl.x}, ${wl.y}, 1, '${wl.type}', '${wl.material}', ${j(wl.needed)}, ${j(wl.total)}, u)`).join(',\n    ')};
  insert into wall_change (world_id, level, dir, x, y, type, material, needed, total, planned_by) values
    ${changes.map(({ wl }) => `(w, ${wl.level}, '${wl.dir}', ${wl.x}, ${wl.y}, '${wl.change!.type}', '${wl.change!.material}', ${j(wl.change!.needed)}, ${j(wl.change!.total)}, u)`).join(',\n    ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${[deck, flight].map((f) => `(w, 1, ${f.x}, ${f.y}, 1, 'plank', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, ${j(f.needed)}, ${j(f.total)}, u)`).join(', ')};
`;
const wallsSaid = `insert into said select 'WALLS', string_agg(wl.level || wl.dir || wl.x || ',' || wl.y || ':' || wl.type || '|' || wl.material || '|' || bill_done(wl.needed)
      || '|' || coalesce((select ch.needed::text from wall_change ch where ch.world_id = w and ch.level = wl.level and ch.dir = wl.dir
                            and ch.x = wl.x and ch.y = wl.y), '-'), ' ' order by wl.level, wl.dir, wl.x, wl.y)
    from wall wl where wl.world_id = w and (${changes.map(({ wl }) => `(wl.level = ${wl.level} and wl.dir = '${wl.dir}' and wl.x = ${wl.x} and wl.y = ${wl.y})`).join(' or ')});`;
const U2 = '7e5b0000-0000-4000-8000-000000000c72';
const isle = said(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table seq (ord serial, v text);
do $t$
declare w uuid; u uuid := '${U2}'; v_chest bigint; r record; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodchange', 648, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  ${setOut}
  for i in 1..2000 loop
    select * into r from hod_needing_stocked(w, u, ${T}, ${T}, ${RANGE});
    exit when r.item is null;
    if take_one_stored(w, u, array[r.item]) is null then raise exception 'nothing to take for %', r.item; end if;
    if not hod_fit(w, r.kind, r.level, r.dir, r.x, r.y, r.ref, r.n, r.item) then raise exception 'it did not go in: %', r; end if;
    insert into seq (v) values (r.kind || '|' || r.level || '|' || r.x || '|' || r.y || '|' || r.item);
  end loop;
  insert into said select 'SEQ', string_agg(s.v, ',' order by s.ord) from seq s;
  ${wallsSaid}
  insert into said select 'CHEST', coalesce(string_agg(def || ':' || count, ',' order by def), '') from item where world_id = w and placed = v_chest;
end $t$;
select k || '=' || v from said;
rollback;
`));

const near = (x: number, y: number): boolean => Math.max(Math.abs(x - T), Math.abs(y - T)) <= RANGE;
const takeable = (it: Item, id: string): boolean => it.id === id && it.count > 0 && !it.locked;
const stocked = (id: string): boolean => g.deedStores().some((st) => st.items.some((it: Item) => takeable(it, id)));
const level = (t: HodTarget): number => (t.kind === 'wall' ? t.wall.level : t.kind === 'floor' ? t.floor.level : 0);
const seqB: string[] = [];
for (let i = 0; i < 2000; i++) {
  const job = g.hodNeeding(near, undefined, { x: T, y: T }, stocked);
  if (!job) break;
  const it = chest.items.find((x) => takeable(x, job.item))!;
  it.count -= 1;
  if (it.count <= 0) chest.items.splice(chest.items.indexOf(it), 1);
  g.fitPiece(job.target, job.item);
  seqB.push(`${job.target.kind}|${level(job.target)}|${job.x}|${job.y}|${job.item}`);
}
const seqI = (isle.get('SEQ') ?? '').split(',').filter(Boolean);
const apart = seqB.findIndex((v, i) => v !== seqI[i]);
const allUnits = changes.reduce((n, { c }) => n + units(wallBill(c.material, c.type)), 0);
check('a hod carrier takes a change planned on a finished wall as work, on both sides', seqB.length > 0 && seqI.length > 0,
  `${seqB.length} pieces in the browser, ${seqI.length} on the island`);
check('piece for piece, the two sides fit the changes in the same order, on the ground and a storey up',
  seqB.length === seqI.length && apart < 0 && seqB.some((v) => v.startsWith('wall|1|')) && seqB.some((v) => v.startsWith('wall|0|')),
  `${seqB.length} | ${seqI.length}${apart >= 0 ? `; first apart at ${apart}: ${seqB[apart]} | ${seqI[apart]}` : ''}`);
check('every piece of every change went in, and nothing else', seqB.length === allUnits, `${seqB.length} of ${allUnits}`);
const wallsB = changes.map(({ wl }) => wl).sort((a, b) => a.level - b.level || (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0) || a.x - b.x || a.y - b.y)
  .map((wl) => `${wl.level}${wl.dir}${wl.x},${wl.y}:${wl.type}|${wl.material}|${isDone(wl)}|${wl.change ? JSON.stringify(wl.change.needed) : '-'}`).join(' ');
const wantB = changes.every(({ c, wl }) => wl.type === c.type && wl.material === c.material && isDone(wl) && !wl.change);
check('with the last piece each wall is the new one, finished, with no change left, the same on both sides',
  wantB && wallsB === isle.get('WALLS'), `browser ${wallsB} | island ${isle.get('WALLS')}`);
const chestB = chest.items.filter((it) => it.count > 0).map((it) => `${it.id}:${it.count}`).sort().join(',');
check('and what went in came out of the chest, one for one, on both sides', chestB === '' && isle.get('CHEST') === '', `${chestB} | ${isle.get('CHEST')}`);

/* ---- a cobbe at it for an hour, on both sides: a change a storey up ------------------------------------------------ */

const UP = CASES[3];
const g2 = Game.create(6472);
for (const c of [...g2.creatures.list.values()]) g2.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g2.world.setHeight(x, y, 4); g2.world.setTile(x, y, TileType.Grass, 0); }
g2.player.x = T + 0.5;
g2.player.y = T + 0.5;
g2.deed = { name: 'Hodstead', x: T, y: T, radius: 10, level: 1 };
const hall2 = g2.buildings.create('Hall', HOUSE[0], HOUSE[1]);
g2.buildings.addTile(hall2, HOUSE[0], HOUSE[1] + 1);
hall2.levels = 2;
const walls2 = allWalls.map((wl) => {
  const side: Side = wl.dir === 'h' ? 'n' : wl.x === HOUSE[0] ? 'w' : 'e';
  const w2 = g2.buildings.setWall(hall2, wl.level, side === 'e' ? wl.x - 1 : wl.x, wl.y, side, STANDS.type, STANDS.material);
  finish0(w2);
  return w2;
});
const deck2 = g2.buildings.setFloor(hall2, 1, HOUSE[0], HOUSE[1], 'plank', 'floor');
const flight2 = g2.buildings.setFloor(hall2, 1, HOUSE[0], HOUSE[1] + 1, 'plank', 'stairs', 's');
finish0(deck2);
finish0(flight2);
const up2 = g2.buildings.wall(UP.level, HOUSE[0], HOUSE[1], UP.side)!;
const upBill = wallBill(UP.material, UP.type);
up2.change = { type: UP.type, material: UP.material, needed: { ...upBill.needed }, total: { ...upBill.total } };
const chest2 = g2.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 40,
  Object.entries(upBill.total).map(([id, count]) => ({ uid: g2.inventory.nextUid++, id, ql: 30, dmg: 0, count })));
const { bx, by, dir } = along(HOUSE[0], HOUSE[1], UP.side);
const U3 = '7e5b0000-0000-4000-8000-000000000c73';
const hour = said(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U3}'; v_id int; v_chest bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodhour', 649, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodstead', ${T}, ${T}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${Object.entries(upBill.total).map(([id, n]) => `(w, 'furniture', v_chest, '${id}', 30, ${n})`).join(', ')};
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 2, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, ${HOUSE[0]}, ${HOUSE[1]}), (w, 1, ${HOUSE[0]}, ${HOUSE[1] + 1});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${walls2.map((wl) => `(w, ${wl.level}, '${wl.dir}', ${wl.x}, ${wl.y}, 1, '${wl.type}', '${wl.material}', ${j(wl.needed)}, ${j(wl.total)}, u)`).join(',\n    ')};
  insert into wall_change (world_id, level, dir, x, y, type, material, needed, total, planned_by)
    values (w, ${UP.level}, '${dir}', ${bx}, ${by}, '${UP.type}', '${UP.material}', ${j(upBill.needed)}, ${j(upBill.total)}, u);
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${[deck2, flight2].map((f) => `(w, 1, ${f.x}, ${f.y}, 1, 'plank', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, ${j(f.needed)}, ${j(f.total)}, u)`).join(', ')};
  v_id := creature_spawn(w, 'cobbe', ${T} + 0.6, ${T} + 0.6, 'active', now() - interval '60 days', u);
  -- No blood of its own, and at the gates of what it fits (craftgates.ts).
  update creature set mode = 'deed', stance = 'passive', hunger = 1, phase = 'idle', from_x = to_x, from_y = to_y, traits = '{}', rare = null,
         skills = skills || '{"carpentry": 50, "masonry": 50}',
         until = now() - interval '3600 seconds', settled_at = now() - interval '3600 seconds', leg_at = now() - interval '3600 seconds',
         leg_ends = now() - interval '3600 seconds'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'WALL', wl.type || '|' || wl.material || '|' || bill_done(wl.needed) || '|'
      || coalesce((select ch.needed::text from wall_change ch where ch.world_id = w and ch.level = wl.level and ch.dir = wl.dir
                     and ch.x = wl.x and ch.y = wl.y), '-')
    from wall wl where wl.world_id = w and wl.level = ${UP.level} and wl.dir = '${dir}' and wl.x = ${bx} and wl.y = ${by};
  insert into said select 'CHEST', coalesce(sum(count), 0)::text from item where world_id = w and placed = v_chest;
end $t$;
select k || '=' || v from said;
rollback;
`));
const cobbe = g2.creatures.spawn('cobbe', T + 0.6, T + 0.6, 'deed');
cobbe.traits = [];
cobbe.skills = { ...cobbe.skills, carpentry: 50, masonry: 50 };
for (let i = 0; i < 72000; i++) {
  g2.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g2.update(0.05);
}
const wantUp = `${UP.type}|${UP.material}|true|-`;
const upB = `${up2.type}|${up2.material}|${isDone(up2)}|${up2.change ? JSON.stringify(up2.change.needed) : '-'}`;
check(`on the island: in an hour a cobbe brings the change a storey up its ${units(upBill)} pieces, and the wall is the new one`,
  hour.get('WALL') === wantUp && hour.get('CHEST') === '0', `${hour.get('WALL')}, ${hour.get('CHEST')} left in the chest`);
check('in the browser: the same', upB === wantUp && chest2.items.every((it) => it.count <= 0), `${upB}, ${chest2.items.map((it) => `${it.id}:${it.count}`).join(',')}`);

finish('a wall changed where it stands, built by hand and by a hod carrier, and shown as it lands');
process.exit(0);
