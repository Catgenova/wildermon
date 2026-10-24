/**
 * Bridges by material and by width, the same on both sides.
 *
 * Asked for: a bridge of each wall material, its length, its bays and its
 * drop off the material's storeys and heft, one to three lanes wide. Put to
 * both (`bridgeReason`, `bridgeBays`, `pierSpans`, `spanBill`,
 * `plannedWords`, `bridgeWheels`, `deckFurnitureRefusal` in the browser;
 * `bridge_reason`, `bridge_bays`, `bridge_piers`, `span_bill`,
 * `bridge_planned`, `deck_wheels`, `bridge_furniture_refusal` on the island):
 *
 *   * every material's longest deck allowed and one tile more refused, in
 *     the same words; its deepest drop allowed and one more refused;
 *   * every material's bays and piers for every length up to its longest;
 *   * set out, a span's bill a lane, and a pier's span its bill again a
 *     storey of drop, one, two and three lanes, and what is said of it;
 *   * a wagon onto a bridge of two lanes and not one; a cart onto either;
 *     and the same from the bridge's end, where it stands already;
 *   * furniture on a three-lane bridge's outer lanes and not its middle one,
 *     nor on a two-lane one;
 *   * no lane's deck wears the ground under it (`wearStep`, `wear_walk`),
 *     and a laden cart on an outer lane of your own bridge counts for the
 *     journal (`journal_move`);
 *   * a wooden bridge and a stone arch of before, made a plank and a stone
 *     brick one by the migration's own lines.
 *
 * Everything on the island side is done in one transaction and rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ACTION_BY_ID } from '../../src/game/actions';
import {
  BRIDGE_MATERIALS, BRIDGES, bridgeBays, CLEARANCE, crossWords, pierSpans, pierStoreys, STALL_WIDTH, WAGON_WIDTH, type Bridge, type BridgeKind,
} from '../../src/game/bridges';
import { WALL_HEIGHT } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { metres, TileType } from '../../src/world/tiles';

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

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const ALLOWED = 'ALLOWED';
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- the ground: corners set the same on both sides --------------------------------- */
const BASE = 400;
const game = Game.create(4246);
const world = game.world;
for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
const corners = new Map<string, number>();
const setCorner = (x: number, y: number, h: number): void => {
  corners.set(`${x},${y}`, h);
  world.setHeight(x, y, h);
};
for (let y = 0; y <= 60; y++) for (let x = 0; x <= 44; x++) setCorner(x, y, BASE);
for (let y = 0; y < 60; y++) for (let x = 0; x < 44; x++) world.setTile(x, y, TileType.Grass, 0);
/** Corners x0..x1 of the two corner rows of tile row y, at h. */
const cornersAt = (x0: number, x1: number, y: number, h: number, rows = 1): void => {
  for (let yy = y; yy <= y + rows; yy++) for (let x = x0; x <= x1; x++) setCorner(x, yy, h);
};

/*
 * A. Length. A row a material, two apart: a bank at x 2, a ravine 2 m deep,
 * and banks at the end of its longest deck and one tile past it.
 */
const KINDS = BRIDGE_MATERIALS as readonly BridgeKind[];
const LEN_Y = (i: number): number => 2 + 2 * i;
KINDS.forEach((k, i) => {
  const span = BRIDGES[k].span;
  cornersAt(4, span + 2, LEN_Y(i), BASE - 20);
});
/*
 * B. Drop. A row a material from y 24: a bridge 2 -> 6 whose middle tile's
 * ground is one unit past the material's deepest drop, and 8 -> 12 at it.
 */
const DROP_Y = (i: number): number => 24 + 2 * i;
KINDS.forEach((k, i) => {
  const deepest = BRIDGES[k].deepest!;
  cornersAt(4, 5, DROP_Y(i), BASE - deepest - 1);
  cornersAt(10, 11, DROP_Y(i), BASE - deepest);
});
/*
 * C. Set out: a ravine from x 24 to 29 corners, 4.5 m under the banks at 22
 * and 30, between y 1 and 20. Marble a lane at y 2; plank two lanes at y 6
 * (its second to the south); stone brick three at y 12; plank a lane at y 17.
 */
const DEEP = 45;
cornersAt(24, 29, 1, BASE - DEEP, 19);
const SET: Array<{ name: string; kind: BridgeKind; y: number; width: number; side?: 's' | 'n' }> = [
  { name: 'MARBLE1', kind: 'marble', y: 2, width: 1 },
  { name: 'PLANK2', kind: 'plank', y: 6, width: 2, side: 's' },
  { name: 'BRICK3', kind: 'stone_brick', y: 12, width: 3 },
  { name: 'PLANK1', kind: 'plank', y: 17, width: 1 },
];
const AX = 22, BX = 30;

const groundSql = [...corners].map(([k, h]) => { const [x, y] = k.split(','); return `(${x},${y},${h})`; }).join(',');

/* ---- the browser ------------------------------------------------------------------------ */
const reasonMine = (kind: BridgeKind, ax: number, ay: number, bx: number, by: number, width = 1, side = 1): string =>
  game.bridgeReason(kind, ax, ay, bx, by, width, side) ?? ALLOWED;

const plans = new Map<string, Bridge>();
const saidMine = new Map<string, string>();
for (const s of SET) {
  game.player.x = AX + 0.5;
  game.player.y = s.y + 0.5;
  game.player.level = 0;
  game.log.length = 0;
  const t = { kind: 'tile', x: BX, y: s.y, cx: BX, cy: s.y, material: s.kind, width: s.width, ...(s.side ? { side: s.side } : {}) };
  const why = ACTION_BY_ID.get('plan_bridge')!.check!(t as never, game);
  ACTION_BY_ID.get('plan_bridge')!.perform(t as never, game);
  saidMine.set(s.name, why ?? game.log.map((l) => l.text).find((x) => x.startsWith('Planned: ')) ?? 'NOTHING SAID');
  const b = [...game.bridges.values()].find((x) => x.ay === s.y && x.ax === AX);
  if (b) plans.set(s.name, b);
}
// Finished, every one.
for (const b of game.bridges.values()) for (const sp of b.spans) for (const k of Object.keys(sp.needed)) sp.needed[k] = 0;
game.reindexDecks();

/* ---- the island, in one transaction ------------------------------------------------------- */
const mig = readFileSync('supabase/migrations/20261024200000_bridges_by_material.sql', 'utf8');
const convert = mig.split('\n').filter((l) => /^update bridge set kind = /.test(l)).join('\n');
check('the migration converts the old kinds in two lines', convert.split('\n').length === 2, convert);

const lenSql = KINDS.map((k, i) => {
  const span = BRIDGES[k].span;
  return `insert into said values ('LEN:${k}:ok', coalesce(bridge_reason(w, u, ${q(k)}, 2, ${LEN_Y(i)}, ${span + 3}, ${LEN_Y(i)}, 1, 1), 'ALLOWED'));
  insert into said values ('LEN:${k}:past', coalesce(bridge_reason(w, u, ${q(k)}, 2, ${LEN_Y(i)}, ${span + 4}, ${LEN_Y(i)}, 1, 1), 'ALLOWED'));`;
}).join('\n');
const dropSql = KINDS.map((k, i) => `
  insert into said values ('DROP:${k}:past', coalesce(bridge_reason(w, u, ${q(k)}, 2, ${DROP_Y(i)}, 6, ${DROP_Y(i)}, 1, 1), 'ALLOWED'));
  insert into said values ('DROP:${k}:ok', coalesce(bridge_reason(w, u, ${q(k)}, 8, ${DROP_Y(i)}, 12, ${DROP_Y(i)}, 1, 1), 'ALLOWED'));`).join('\n');
const baySql = KINDS.map((k) => `
  insert into said values ('BAYS:${k}', (select string_agg(array_to_string(bridge_bays(n, ${BRIDGES[k].bay}), ',') || '/' || array_to_string(bridge_piers(n, ${BRIDGES[k].bay}), ','), ';' order by n)
    from generate_series(1, ${BRIDGES[k].span}) n));`).join('\n');
const setSql = SET.map((s) => {
  const t = JSON.stringify({ kind: 'tile', x: BX, y: s.y, cx: BX, cy: s.y, material: s.kind, width: s.width, ...(s.side ? { side: s.side } : {}) });
  return `
  update player set body_at = now(), x = ${AX + 0.5}, y = ${s.y + 0.5}, level = 0 where world_id = w and uid = u;
  insert into said values ('WHY:${s.name}', coalesce(last_refusal(w, u, 'plan_bridge', ${q(t)}::jsonb), 'ALLOWED'));
  perform perform_last(w, u, 'plan_bridge', ${q(t)}::jsonb);
  insert into said values ('SAID:${s.name}', (select text from event where world_id = w and uid = u and text like 'Planned: %' order by n desc limit 1));
  insert into said values ('SPANS:${s.name}', (select string_agg(sp.total::text, ';' order by sp.n) from bridge_span sp join bridge b on b.world_id = sp.world_id and b.id = sp.bridge
      where b.world_id = w and b.ax = ${AX} and b.ay = ${s.y}));
  insert into said values ('ROW:${s.name}', (select b.kind || '|' || b.width || '|' || b.side || '|' || bridge_gear(b)::text from bridge b where b.world_id = w and b.ax = ${AX} and b.ay = ${s.y}));`;
}).join('\n');

const lanes = (s: (typeof SET)[number]): number[] => (s.width === 3 ? [-1, 0, 1] : s.width === 2 ? [0, 1] : [0]);
const furnSql = SET.flatMap((s) => lanes(s).map((o) => `
  insert into said values ('FURN:${s.name}:${o}', coalesce(fire_refusal(w, u, 'place_furniture',
    jsonb_build_object('kind', 'tile', 'x', 25, 'y', ${s.y + o}, 'cx', 25, 'cy', ${s.y + o}, 'sx', 0, 'sy', 0, 'facing', 's', 'itemUid', v_stool)), 'ALLOWED'));`)).join('\n');
const wheelSql = ['PLANK2', 'PLANK1'].flatMap((n) => {
  const s = SET.find((x) => x.name === n)!;
  return ['wagon', 'large_cart'].map((v) => `
  delete from placed where world_id = w and driver = u;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, made_by, driver)
    values (w, 'furniture', '${v}', ${AX - 1}, ${s.y}, ${AX - 1}.5, ${s.y}.5, 30, u, u);
  insert into said values ('WHEEL:${n}:${v}', (walk_share(w, u, 0, ${AX - 1}.5, ${s.y}.5, ${AX}.5, ${s.y}.5) >= 1)::text);
  -- And standing on its end already: onto the deck, and back off onto the bank.
  update placed set x = ${AX}, cx = ${AX}.5 where world_id = w and driver = u;
  insert into said values ('ENDON:${n}:${v}', (walk_share(w, u, 0, ${AX}.5, ${s.y}.5, ${AX + 1}.5, ${s.y}.5) >= 1)::text);
  insert into said values ('ENDOFF:${n}:${v}', (walk_share(w, u, 0, ${AX}.5, ${s.y}.5, ${AX - 1}.5, ${s.y}.5) >= 1)::text);`);
}).join('\n');

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; c record; v_stool bigint; v_old bigint; v_arch bigint; p player; v_cart placed; v_orse int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  delete from placed where world_id = w;
  delete from wall where world_id = w;
  delete from floor_tile where world_id = w;
  delete from building_column where world_id = w;
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from foundation where world_id = w;
  delete from bridge_span where world_id = w;
  delete from bridge where world_id = w;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  for c in select * from (values ${groundSql}) v(x, y, h) loop perform land_set_height(w, c.x, c.y, c.h); end loop;
  for c in select gx, gy from generate_series(0, 43) gx, generate_series(0, 59) gy loop
    perform land_set_tile(w, c.gx, c.gy, tile_id('Grass')); perform land_set_data(w, c.gx, c.gy, 0);
  end loop;
  ${lenSql}
  ${dropSql}
  ${baySql}
  ${setSql}
  update bridge_span set needed = (select coalesce(jsonb_object_agg(k, 0), '{}'::jsonb) from jsonb_object_keys(needed) k) where world_id = w;
  insert into said values ('OPEN:BRICK3', (select bridge_crosses(b) from bridge b where b.world_id = w and b.ay = 12));
  perform give(w, u, 'stool', 1, 40, null, null, null, null);
  select id into v_stool from item where world_id = w and holder = 'player' and holder_uid = u and def = 'stool' limit 1;
  ${furnSql}
  ${wheelSql}
  -- Feet along the three-lane bridge's outer lane, its middle lane and the ground beside it (wear_walk).
  delete from tile_wear where world_id = w;
  perform wear_walk(w, 24.5, 13.5, 26.5, 13.5, u);
  perform wear_walk(w, 24.5, 12.5, 26.5, 12.5, u);
  perform wear_walk(w, 24.5, 15.5, 26.5, 15.5, u);
  insert into said values ('WEAR', (select coalesce(string_agg(x || ',' || y, ';' order by y, x), '') from tile_wear where world_id = w));
  -- A laden cart onto the outer lane of a bridge Dane built (journal_move).
  delete from placed where world_id = w and driver = u;
  update player set tally = coalesce(tally, '{}'::jsonb) - 'cartbridge' where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, driver)
    values (w, 'furniture', 'large_cart', 24, 13, 0, 0, 24.5, 13.5, 40, u, u) returning * into v_cart;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_cart.id, 'log', 30, 3);
  v_orse := creature_spawn(w, 'orse', 24.5, 13.5, 'deed', now() - interval '60 days', u);
  update creature set hitched_to = v_cart.id, hunger = 1 where world_id = w and id = v_orse;
  select * into p from player where world_id = w and uid = u;
  p.x := 24.5; p.y := 13.5;
  perform journal_move(w, u, p, 25.5, 13.5, v_cart, array[24.5, 25.5], array[13.5, 13.5]);
  insert into said values ('CARTBRIDGE', coalesce((select tally->>'cartbridge' from player where world_id = w and uid = u), '0'));
  -- A wooden bridge and a stone arch of before, and the migration's own lines over them.
  insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level) values (w, 'wood', 2, 50, 6, 50, ${BASE}, 'Oak', u, 0) returning id into v_old;
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level) values (w, 'stone', 2, 52, 6, 52, ${BASE}, u, 0) returning id into v_arch;
  ${convert}
  insert into said values ('OLD', (select string_agg(b.kind || '|' || b.width || '|' || coalesce(b.material, '-') || '|' || bridge_name(b), ';' order by b.id)
    from bridge b where b.world_id = w and b.id in (v_old, v_arch)));
end $$;
select k || '=' || coalesce(v, 'NULL') from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const theirs = (k: string): string => said.get(k) ?? `NOTHING for ${k}`;

/* ---- A. length ------------------------------------------------------------------------------- */
KINDS.forEach((k, i) => {
  const def = BRIDGES[k];
  const mineOk = reasonMine(k, 2, LEN_Y(i), def.span + 3, LEN_Y(i));
  const minePast = reasonMine(k, 2, LEN_Y(i), def.span + 4, LEN_Y(i));
  const want = `${def.name}: max span ${def.span} tiles; this is ${def.span + 1}.`;
  check(`${def.name}: ${def.span} tiles of deck allowed on both sides`, mineOk === ALLOWED && theirs(`LEN:${k}:ok`) === ALLOWED, `browser ${mineOk}; island ${theirs(`LEN:${k}:ok`)}`);
  check(`and ${def.span + 1} refused in the same words`, minePast === want && theirs(`LEN:${k}:past`) === want, `browser ${minePast}; island ${theirs(`LEN:${k}:past`)}`);
});

/* ---- B. drop ---------------------------------------------------------------------------------- */
KINDS.forEach((k, i) => {
  const def = BRIDGES[k];
  const minePast = reasonMine(k, 2, DROP_Y(i), 6, DROP_Y(i));
  const mineOk = reasonMine(k, 8, DROP_Y(i), 12, DROP_Y(i));
  const want = `Drop under the span ${metres(def.deepest! + 1)} m; max ${metres(def.deepest!)} m (${def.storeys} storeys).`;
  check(`${def.name}: a drop of ${metres(def.deepest!)} m allowed on both sides`, mineOk === ALLOWED && theirs(`DROP:${k}:ok`) === ALLOWED, `browser ${mineOk}; island ${theirs(`DROP:${k}:ok`)}`);
  check(`and one unit more refused in the same words`, minePast === want && theirs(`DROP:${k}:past`) === want, `browser ${minePast}; island ${theirs(`DROP:${k}:past`)}`);
});

/* ---- bays and piers ----------------------------------------------------------------------------- */
for (const k of KINDS) {
  const def = BRIDGES[k];
  const mine = Array.from({ length: def.span }, (_, i) => `${bridgeBays(i + 1, def.bay).join(',')}/${pierSpans(i + 1, def.bay).map((n) => n + 1).join(',')}`).join(';');
  const even = Array.from({ length: def.span }, (_, i) => bridgeBays(i + 1, def.bay)).every((b) => Math.max(...b) - Math.min(...b) <= 1 && b.every((n) => n <= def.bay!));
  check(`${def.name}: bays of at most ${def.bay} tiles, even, and their piers, the same on both sides for every length to ${def.span}`,
    mine === theirs(`BAYS:${k}`) && even, `browser ${mine}; island ${theirs(`BAYS:${k}`)}`);
}
{
  const odd = bridgeBays(11, 4);
  check('an odd count of bays has the widest in the middle', odd.length === 3 && odd[1] === Math.max(...odd), odd.join(','));
}

/* ---- C. set out: bills, lanes, what is said ------------------------------------------------------ */
const sortObj = (o: Record<string, number>): string => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
for (const s of SET) {
  const b = plans.get(s.name);
  check(`${s.name}: planned on both sides`, !!b && theirs(`WHY:${s.name}`) === ALLOWED, `browser ${saidMine.get(s.name)}; island ${theirs(`WHY:${s.name}`)}`);
  if (!b) continue;
  const def = BRIDGES[s.kind];
  // What each span should take, worked out here off the scene: a lane's bill, and at a pier the bill a storey of the drop under it.
  const n = b.spans.length;
  const piers = pierSpans(n, def.bay);
  const want = b.spans.map((sp, i) => {
    const drop = BASE - world.centerHeight(sp.x, sp.y);
    const k = s.width + (piers.includes(i) ? Math.ceil(drop / WALL_HEIGHT) : 0);
    return sortObj(Object.fromEntries(def.bill.map(([id, c]) => [id, c * k])));
  });
  const mine = b.spans.map((sp) => sortObj(sp.total));
  const isl = theirs(`SPANS:${s.name}`).split(';').map((j) => sortObj(JSON.parse(j) as Record<string, number>));
  check(`${s.name}: every span's bill a lane times ${s.width}, piers at spans ${piers.map((p) => p + 1).join(', ') || 'none'} that again a storey of drop, on both sides`,
    JSON.stringify(mine) === JSON.stringify(want) && JSON.stringify(isl) === JSON.stringify(want),
    `want ${want.join(' ')}; browser ${mine.join(' ')}; island ${isl.join(' ')}`);
  check(`${s.name}: what is said of it set out is the same on both sides`, saidMine.get(s.name) === theirs(`SAID:${s.name}`),
    `browser "${saidMine.get(s.name)}"; island "${theirs(`SAID:${s.name}`)}"`);
  const gear = JSON.parse(theirs(`ROW:${s.name}`).split('|')[3] ?? '{}') as { width?: number; side?: number };
  check(`${s.name}: the island keeps ${s.width} lane${s.width > 1 ? 's' : ''} and sends them as the browser keeps them`,
    theirs(`ROW:${s.name}`).startsWith(`${s.kind}|${s.width}|`) && gear.width === b.width && gear.side === b.side, `${theirs(`ROW:${s.name}`)}; browser ${b.width} ${b.side}`);
}
{
  const p1 = plans.get('PLANK1')!, p2 = plans.get('PLANK2')!, b3 = plans.get('BRICK3')!;
  check('with a pier and without: a plank bridge of two lanes over this ravine has piers, a marble one of a lane none',
    pierSpans(p2.spans.length, BRIDGES.plank.bay).length > 0 && pierSpans(plans.get('MARBLE1')!.spans.length, BRIDGES.marble.bay).length === 1, '');
  check('a lane every way across the line it was set out along, the second of two to the south',
    game.bridgeAt(25, 7) === p2 && game.bridgeAt(25, 5) === undefined && game.bridgeAt(25, 11) === b3 && game.bridgeAt(25, 13) === b3 && game.bridgeAt(25, 18) === undefined && game.bridgeAt(25, 17) === p1,
    '');
  check('a three-lane bridge open says what crosses it, on both sides', crossWords(b3) === theirs('OPEN:BRICK3'), `${crossWords(b3)} / ${theirs('OPEN:BRICK3')}`);
  // Every lane's deck at the deck's height, its ends the ground they land on.
  check('a body on an outer lane stands on the deck', game.deckHeightAt(25.5, 13.5) === b3.height && game.deckHeightAt(AX + 0.5, 13.5) === null, `${game.deckHeightAt(25.5, 13.5)}`);
  // And stepping along an outer lane, onto it from its end.
  check('an outer lane is walked from its own end', game.stepRule(AX, 13, 0, AX + 1, 13) === 0 && game.stepRule(AX + 1, 13, 0, AX + 2, 13) === 0, '');
}

/* ---- wheels --------------------------------------------------------------------------------------- */
for (const n of ['PLANK2', 'PLANK1']) {
  const s = SET.find((x) => x.name === n)!;
  for (const v of ['wagon', 'large_cart']) {
    const f = game.addFurniture(v, AX - 1, s.y, 0, 0, 30);
    f.driven = true;
    const mine = game.driveRule(AX - 1, s.y, 0, AX, s.y) !== null;
    game.removeFurniture(f.id);
    const want = v !== 'wagon' || s.width >= WAGON_WIDTH;
    check(`a ${v.replace('_', ' ')} ${want ? 'onto' : 'not onto'} a plank bridge of ${s.width} lane${s.width > 1 ? 's' : ''}, on both sides`,
      mine === want && theirs(`WHEEL:${n}:${v}`) === String(want), `browser ${mine}; island ${theirs(`WHEEL:${n}:${v}`)}`);
    // From its end, where it stands already: onto the deck as from the bank, and off it again either way.
    const g = game.addFurniture(v, AX, s.y, 0, 0, 30);
    g.driven = true;
    const on = game.driveRule(AX, s.y, 0, AX + 1, s.y) !== null;
    const off = game.driveRule(AX, s.y, 0, AX - 1, s.y) !== null;
    game.removeFurniture(g.id);
    check(`and from its end: ${want ? 'onto' : 'not onto'} the deck, and back onto the bank, on both sides`,
      on === want && theirs(`ENDON:${n}:${v}`) === String(want) && off && theirs(`ENDOFF:${n}:${v}`) === 'true',
      `browser ${on} ${off}; island ${theirs(`ENDON:${n}:${v}`)} ${theirs(`ENDOFF:${n}:${v}`)}`);
  }
}

/* ---- furniture -------------------------------------------------------------------------------------- */
for (const s of SET) {
  for (const o of lanes(s)) {
    const mine = game.furniturePlaceReason('stool', 25, s.y + o, 0, 0, 's') ?? ALLOWED;
    const want = s.width >= STALL_WIDTH && o !== 0 ? ALLOWED
      : s.width >= STALL_WIDTH ? 'Bridge deck: outer lanes only.' : `Bridge deck: furniture only on a ${STALL_WIDTH}-lane bridge's outer lanes.`;
    check(`a stool on ${s.name}'s lane ${o}: ${want === ALLOWED ? 'set down' : 'refused'} on both sides`,
      mine === want && theirs(`FURN:${s.name}:${o}`) === want, `browser ${mine}; island ${theirs(`FURN:${s.name}:${o}`)}`);
  }
}

/* ---- every lane: worn, driven ---------------------------------------------------------------------- */
{
  world.wear.clear();
  for (const y of [13, 12, 15]) for (const x of [25, 26]) game.wearStep(x, y);
  const mine = [...world.wear.keys()].sort((a, b) => a - b).map((i) => `${i % world.w},${Math.floor(i / world.w)}`).join(';');
  check('no lane of a bridge wears the ground under it, and the ground beside it wears, on both sides',
    mine === '25,15;26,15' && theirs('WEAR') === mine, `browser ${mine}; island ${theirs('WEAR')}`);
  check('a laden cart on the outer lane of a bridge you built counts for the journal', theirs('CARTBRIDGE') === '1', theirs('CARTBRIDGE'));
}

/* ---- the old kinds ------------------------------------------------------------------------------------ */
check('a wooden bridge of before is a plank bridge of a lane, and a stone arch a stone brick one',
  theirs('OLD') === `plank|1|-|${BRIDGES.plank.name};stone_brick|1|-|${BRIDGES.stone_brick.name}`, theirs('OLD'));
check('and pierStoreys rounds a drop up to whole storeys, never under one', pierStoreys(1) === 1 && pierStoreys(WALL_HEIGHT) === 1 && pierStoreys(WALL_HEIGHT + 1) === 2 && CLEARANCE > 0, '');

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`bridges by material and width are the same rules on both sides — ${ok.length} of ${ok.length}`);
