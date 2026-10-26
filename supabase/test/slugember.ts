/**
 * A stoker burns tar first, never overfills, and from its second stage works the smelters.
 *
 * Asked for: "Slugember needs to prioritize tar, peat, and coal for fueling fires and shelters etc. Slugember should
 * also load raw ore into smelters and Take What Is Done." And: "Make sure that slugember isnt loading more fuel than is
 * required."
 *
 * Asked of both sides:
 *
 *   * tar is a fuel, worth the same seconds on both, and the fuel order and the stage the smelter work comes in at are
 *     the island's as the browser's;
 *   * a stoker fetches tar before peat before coal before any other, out of whichever store holds it, and of what a
 *     whole piece fits only;
 *   * it takes no more pieces than fit in the hearth (and its stage carries), feeds only whole pieces that fit, and
 *     takes what is left back to the stores;
 *   * a hearth another worker is carrying fuel to is left alone;
 *   * it fuels ovens, lit, and braziers, left to light themselves;
 *   * a Sluglow leaves a smelter alone; a Slugember empties it into the stores and charges it with the ore, also when a
 *     hearth wants fuel and there is none;
 *   * and says why it stands about.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { FUEL_SAID, FUEL_VALUES, FIRE_CAPACITY } from '../../src/game/campfire';
import { EVOLVE_AT, HEARTH_FULL, stageLoads, stageOf, STOKE_FIRST, STOKE_SMELTS_AT, SPECIES, type Creature } from '../../src/game/creatures';
import { hearthCapacity } from '../../src/game/furniture';
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

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A Sluglow, a Slugember and a Slugferno: their smelting at the level each stage comes in at. */
const LOW = 1;
const EMBER = EVOLVE_AT[0];
const FERNO = EVOLVE_AT[1];
/**
 * A hearth just under its full mark: room for so many whole pieces of coal and no more, by each side's capacity of a
 * campfire (the island's `fire_capacity`, the browser's `FIRE_CAPACITY`, which are not the same number).
 */
const NEAR_FULL = HEARTH_FULL - 10;
const ISLE_FIRE = Number(psql('select fire_capacity()'));
const COAL_FITS = Math.floor((ISLE_FIRE - NEAR_FULL) / FUEL_VALUES.coal);
const BROWSER_FITS = Math.floor((FIRE_CAPACITY - NEAR_FULL) / FUEL_VALUES.coal);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000e7';
type Stock = Array<[string, number]>;
const put = (crate: number, items: Stock): string =>
  items.length ? `insert into item (world_id, holder, crate, def, ql, count) values ${items.map(([id, n]) => `(w, 'crate', ${crate}, '${id}', 30, ${n})`).join(', ')};` : '';
const held = (crate: number): string =>
  `coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = ${crate}), '-')`;
const fire = (fuel: number, lit = false): string =>
  `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by) values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, ${fuel}, 0, ${lit}, now(), u) returning id into v_p;`;
const smelter = `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
    values (w, 'smelter', 19, 18, 0, 0, 19.75, 18.5, 50, 3000, false, now(),
            jsonb_build_object('jobs', '[]'::jsonb, 'output', jsonb_build_array(jsonb_build_object('def', 'copper_lump', 'count', 2, 'ql', 30))), u)
    returning id into v_q;`;
const piece = (sub: string): string =>
  `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by) values (w, 'furniture', '${sub}', 19, 13, 0, 0, 19.5, 19.5, 30, 0, 0, false, now(), u) returning id into v_p;`;
/** A stoker of this level put to work, its afternoon replayed. */
const stoker = (level: number): string => `
  v_id := creature_spawn(w, 'embra', 16.6, 16.6, 'active', now() - interval '60 days', u);
  update creature set mode = 'deed', stance = 'passive', hunger = 1, traits = '{}', gear = null, carrying = null, phase = 'idle',
         skills = jsonb_build_object('smelting', ${level}), until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds',
         leg_at = now() - interval '600 seconds', leg_ends = now() - interval '600 seconds', from_x = 16.6, from_y = 16.6, to_x = 16.6, to_y = 16.6
   where world_id = w and id = v_id;`;
const settle = 'perform worker_settle(w, v_id);';
const why = `coalesce((select idle_why from creature where world_id = w and id = v_id), '-')`;
const step = `(select coalesce(s.want, '-') || '|' || coalesce(s.wx::text, '-') || '|' || coalesce(s.why, '-') from errand_step(w, v_id) s)`;
const done = `
  delete from creature where world_id = w and keeper = u;
  delete from item where world_id = w and holder = 'crate';
  delete from placed where world_id = w;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id int; v_o int; v_p bigint; v_q bigint; c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stokers', 193, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Embersend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7501, 'plank', 17, 16, 0, 0, true, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7502, 'plank', 12, 16, 0, 0, true, u);

  insert into said values ('DEFS', fuel_value('tar') || '|' || (select string_agg(f, ',' order by stoke_rank(f), f) from unnest(array['coal', 'log', 'peat', 'tar']) f)
    || '|' || stoke_rank('log') || '|' || stoke_smelts_at() || '|' || fuel_said());

  -- Fuel order: logs and coal in the near store, tar in the far one; then logs and peat; then logs and coal.
  ${put(7501, [['log', 5], ['coal', 5]])}${put(7502, [['tar', 5]])}
  ${fire(0)}${stoker(LOW)}
  insert into said values ('ORDER:tar', ${step});${done}
  ${put(7501, [['log', 5], ['peat', 5]])}
  ${fire(0)}${stoker(LOW)}
  insert into said values ('ORDER:peat', ${step});${done}
  ${put(7501, [['log', 5], ['coal', 5]])}
  ${fire(0)}${stoker(LOW)}
  insert into said values ('ORDER:coal', ${step});${done}

  -- Only a fuel a whole piece of fits: room for 250 seconds, 100, 50.
  ${put(7501, [['tar', 1], ['peat', 1], ['plank', 1], ['thatch', 1]])}${stoker(LOW)}
  select * into c from creature where world_id = w and id = v_id;
  insert into said select 'FITS', string_agg(coalesce((select f.def from stoke_fuel(w, c, r, 16.6, 16.6) f), '-'), ',' order by r desc) from unnest(array[250, 100, 50]) r;${done}

  -- A Sluglow with a piece of tar and a cold campfire: fed it and lit it, then nothing in stock.
  ${put(7501, [['tar', 1]])}
  ${fire(0)}${stoker(LOW)}${settle}
  insert into said select 'TAR', ${held(7501)} || '|' || placed_fuel(p) || '|' || p.lit || '|' || ${why} from placed p where p.id = v_p;${done}

  -- A Slugferno and a campfire just under its full mark: only the whole pieces of coal that fit.
  ${put(7501, [['coal', 10]])}
  ${fire(NEAR_FULL)}${stoker(FERNO)}
  select * into c from creature where world_id = w and id = v_id;
  insert into said values ('LOADS', stage_loads(c)::text);
  ${settle}
  insert into said select 'FITTED', ${held(7501)} || '|' || placed_fuel(p) from placed p where p.id = v_p;${done}

  -- Holding more coal than fits: the pieces that fit go in, the rest back to the stores.
  ${fire(NEAR_FULL)}${stoker(FERNO)}
  update creature set carrying = '{"def": "coal", "count": ${COAL_FITS + 1}, "ql": 30}'::jsonb, work_x = 19, work_y = 16, to_x = 19.25, to_y = 16.25
   where world_id = w and id = v_id;
  perform errand_do(w, v_id);
  insert into said select 'PART', placed_fuel(p) || '|' || coalesce((select carrying->>'def' || ' ' || (carrying->>'count') from creature where world_id = w and id = v_id), '-')
    from placed p where p.id = v_p;
  update creature set phase = 'idle', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds' where world_id = w and id = v_id;
  ${settle}
  insert into said select 'BACK', ${held(7501)} || '|' || coalesce((select carrying::text from creature where world_id = w and id = v_id), '-');${done}

  -- A cold campfire another worker is carrying coal to: left to that one.
  ${put(7501, [['coal', 5]])}
  ${fire(0)}${stoker(LOW)}
  v_o := v_id;
  update creature set carrying = '{"def": "coal", "count": 1, "ql": 30}'::jsonb, work_x = 19, work_y = 16 where world_id = w and id = v_o;
  ${stoker(LOW)}
  insert into said values ('CLAIMED', ${step});${done}

  -- An oven and a brazier, each cold: fed a log; the oven lit, the brazier left to light itself.
  ${put(7501, [['log', 1]])}
  ${piece('oven')}${stoker(LOW)}${settle}
  insert into said select 'OVEN', ${held(7501)} || '|' || placed_fuel(p) || '|' || p.lit || '|' || (stoke_room(p) = oven_capacity()) from placed p where p.id = v_p;${done}
  ${put(7501, [['log', 1]])}
  ${piece('brazier')}${stoker(LOW)}${settle}
  insert into said select 'BRAZIER', ${held(7501)} || '|' || placed_fuel(p) || '|' || p.lit || '|' || (stoke_room(p) = brazier_capacity()) from placed p where p.id = v_p;${done}

  -- A smelter with two lumps made, fuel enough, and three ore in the stores: a Sluglow, then a Slugember.
  ${put(7501, [['copper_ore', 3]])}
  ${smelter}${stoker(LOW)}${settle}
  insert into said select 'SMELT:low', ${held(7501)} || '|' || jsonb_array_length(furnace_jobs(p)) || '|' || jsonb_array_length(furnace_output(p)) || '|' || ${why}
    from placed p where p.id = v_q;${done}
  ${put(7501, [['copper_ore', 3]])}
  ${smelter}${stoker(EMBER)}${settle}
  insert into said select 'SMELT:ember', ${held(7501)} || '|' || jsonb_array_length(furnace_jobs(p)) || '|' || jsonb_array_length(furnace_output(p))
    from placed p where p.id = v_q;${done}
  -- And with a cold campfire and no fuel for it.
  ${put(7501, [['copper_ore', 3]])}
  ${fire(0)}${smelter}${stoker(EMBER)}${settle}
  insert into said select 'SMELT:nofuel', ${held(7501)} || '|' || jsonb_array_length(furnace_jobs(p)) || '|' || jsonb_array_length(furnace_output(p))
    from placed p where p.id = v_q;${done}

  -- Why it stands about: a Sluglow with a cold campfire and no fuel; a Slugember with nothing to fuel and no smelter.
  ${fire(0)}${stoker(LOW)}${settle}
  insert into said values ('WHY:stock', ${why});${done}
  ${stoker(EMBER)}${settle}
  insert into said values ('WHY:range', ${why});${done}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the rules, on both sides ------------------------------------------------------- */

const order = [...STOKE_FIRST, 'log'];
check(`tar is a fuel, ${FUEL_VALUES.tar} seconds a piece, between peat and coal; the fuel order and the smelter stage are the island's`,
  FUEL_VALUES.tar > FUEL_VALUES.peat && FUEL_VALUES.tar < FUEL_VALUES.coal
  && at('DEFS') === `${FUEL_VALUES.tar}|${order.join(',')}|${STOKE_FIRST.length}|${STOKE_SMELTS_AT}|${FUEL_SAID}`, at('DEFS'));
check('the stage the smelter work comes in at is a Slugember\'s', STOKE_SMELTS_AT === 1 && SPECIES.embra.stages![0].name === 'Slugember');
check('the stages that work the smelters say so, and the first does not',
  SPECIES.embra.stages!.every((s) => /smelters/.test(s.description) && /Fuel order: tar, peat, coal/.test(s.description))
  && !/empties your smelters/.test(SPECIES.embra.description), SPECIES.embra.stages![0].description);

/* ---- on the island ----------------------------------------------------------------- */

check('on the island, a stoker fetches tar from the far store before the logs and coal in the near one', at('ORDER:tar') === 'tar|12|-', at('ORDER:tar'));
check('on the island, peat before logs', at('ORDER:peat') === 'peat|17|-', at('ORDER:peat'));
check('on the island, coal before logs', at('ORDER:coal') === 'coal|17|-', at('ORDER:coal'));
check('on the island, only a fuel a whole piece of fits: peat in 250 seconds of room, thatch in 100, none in 50', at('FITS') === 'peat,thatch,-', at('FITS'));
check(`on the island, a Sluglow feeds a cold campfire a piece of tar, ${FUEL_VALUES.tar} seconds, and lights it; then has no fuel`,
  at('TAR') === `-|${FUEL_VALUES.tar}|true|stock`, at('TAR'));
check(`on the island, a Slugferno carries ${COAL_FITS} coal to a campfire at ${NEAR_FULL} seconds, not its ${at('LOADS')} loads`,
  Number(at('LOADS')) > COAL_FITS && at('FITTED') === `coal ${10 - COAL_FITS}|${NEAR_FULL + COAL_FITS * FUEL_VALUES.coal}`, `${at('LOADS')} ${at('FITTED')}`);
check(`on the island, holding ${COAL_FITS + 1} coal at that campfire it feeds ${COAL_FITS} and keeps 1`,
  at('PART') === `${NEAR_FULL + COAL_FITS * FUEL_VALUES.coal}|coal 1`, at('PART'));
check('on the island, and takes that one back to the stores', at('BACK') === 'coal 1|-', at('BACK'));
check('on the island, a campfire another worker is carrying fuel to is left to it', at('CLAIMED') === '-|-|range', at('CLAIMED'));
check('on the island, an oven is fed a log and lit, to its own capacity', at('OVEN') === `-|${FUEL_VALUES.log}|true|true`, at('OVEN'));
check('on the island, a brazier is fed a log and left to light itself after dark, to its own capacity', at('BRAZIER') === `-|${FUEL_VALUES.log}|false|true`, at('BRAZIER'));
check('on the island, a Sluglow leaves a smelter alone, and says nothing is in range', at('SMELT:low') === 'copper_ore 3|0|1|range', at('SMELT:low'));
check('on the island, a Slugember takes the lumps out of a smelter into the stores and charges it with the ore', at('SMELT:ember') === 'copper_lump 2|3|0', at('SMELT:ember'));
check('on the island, and so with a cold campfire and no fuel for it', at('SMELT:nofuel') === 'copper_lump 2|3|0', at('SMELT:nofuel'));
check('on the island, a Sluglow with a cold campfire and no fuel says the stores hold none; a Slugember with nothing to do, nothing in range',
  at('WHY:stock') === 'stock' && at('WHY:range') === 'range', `${at('WHY:stock')} ${at('WHY:range')}`);

/* ---- in the browser ----------------------------------------------------------------- */

function body(): Game {
  const g = Game.create(4261);
  const w = g.world;
  for (let y = 12; y <= 28; y++) for (let x = 12; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 12; y <= 27; y++) for (let x = 12; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Embersend', x: 20, y: 20, radius: 8, level: 3 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  return g;
}
const worker = (g: Game, level: number): Creature => {
  const c = g.creatures.spawn('embra', 20.5, 20.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  c.traits = [];
  c.skills = { smelting: level };
  return c;
};
const run = (g: Game, secs: number): void => {
  for (let i = 0; i < secs * 10; i++) {
    g.time += 0.1;
    g.creatures.update(0.1, g);
  }
};
type Crate = ReturnType<Game['addCrate']>;
const stock = (g: Game, x: number, items: Stock): Crate =>
  g.addCrate('plank', x, 20, 0, 0, items.map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count })), true);
const inCrate = (crate: Crate): string => {
  const n = new Map<string, number>();
  for (const i of crate.items) n.set(i.id, (n.get(i.id) ?? 0) + i.count);
  return [...n].filter(([, k]) => k > 0).map(([id, k]) => `${id} ${k}`).sort().join(',') || '-';
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inner = (g: Game): any => g.creatures;

for (const [want, near, far] of [
  ['tar', [['log', 5], ['coal', 5]], [['tar', 5]]],
  ['peat', [['log', 5], ['peat', 5]], []],
  ['coal', [['log', 5], ['coal', 5]], []],
] as Array<[string, Stock, Stock]>) {
  const g = body();
  stock(g, 21, near);
  const farCrate = stock(g, 15, far);
  const f = g.addCampfire(23, 20, 0, 0, 0, false);
  const c = worker(g, LOW);
  run(g, 30);
  check(`in the browser, a stoker takes ${want} first${want === 'tar' ? ', from the far store' : ''}`,
    f.fuel === FUEL_VALUES[want] && (want !== 'tar' || inCrate(farCrate) === 'tar 4'), `${f.fuel} ${inCrate(farCrate)} ${c.idle?.why}`);
}
{
  const g = body();
  stock(g, 21, [['tar', 1], ['peat', 1], ['plank', 1], ['thatch', 1]]);
  const c = worker(g, LOW);
  const got = [250, 100, 50].map((r) => inner(g).stokeFuel(g, c, r)?.item.id ?? '-').join(',');
  check('in the browser, only a fuel a whole piece of fits: peat in 250 seconds of room, thatch in 100, none in 50', got === 'peat,thatch,-', got);
}
{
  const g = body();
  const crate = stock(g, 21, [['tar', 1]]);
  const f = g.addCampfire(23, 20, 0, 0, 0, false);
  const c = worker(g, LOW);
  run(g, 60);
  check(`in the browser, a Sluglow feeds a cold campfire a piece of tar, ${FUEL_VALUES.tar} seconds, and lights it; then has no fuel`,
    inCrate(crate) === '-' && f.fuel === FUEL_VALUES.tar && f.lit && c.idle?.why === 'stock', `${inCrate(crate)} ${f.fuel} ${f.lit} ${c.idle?.why}`);
}
{
  const g = body();
  const crate = stock(g, 21, [['coal', 10]]);
  const f = g.addCampfire(23, 20, 0, 0, NEAR_FULL, false);
  const c = worker(g, FERNO);
  const loads = stageLoads(c);
  const n = Math.min(loads, BROWSER_FITS);
  run(g, 60);
  check(`in the browser, a Slugferno carries its ${loads} loads of coal, or the ${BROWSER_FITS} that fit in a campfire at ${NEAR_FULL} seconds if fewer`,
    stageOf(c) === 2 && loads === Number(at('LOADS')) && inCrate(crate) === `coal ${10 - n}` && f.fuel === NEAR_FULL + n * FUEL_VALUES.coal,
    `${loads} ${inCrate(crate)} ${f.fuel}`);
}
{
  const g = body();
  const crate = stock(g, 21, []);
  const f = g.addCampfire(23, 20, 0, 0, NEAR_FULL, false);
  const c = worker(g, FERNO);
  const [fx, fy] = [Math.floor(f.x + (f.sx + 1) / 2), Math.floor(f.y + (f.sy + 1) / 2)];
  c.x = fx + 0.5;
  c.y = fy + 0.5;
  c.carrying = { uid: g.inventory.nextUid++, id: 'coal', ql: 30, dmg: 0, count: BROWSER_FITS + 1 };
  c.job = 'campfire';
  c.workX = fx;
  c.workY = fy;
  run(g, 1);
  const part = `${f.fuel}|${c.carrying ? `${(c.carrying as { id: string }).id} ${(c.carrying as { count: number }).count}` : '-'}`;
  check(`in the browser, holding ${BROWSER_FITS + 1} coal at that campfire it feeds ${BROWSER_FITS} and keeps 1`, part === `${NEAR_FULL + BROWSER_FITS * FUEL_VALUES.coal}|coal 1`, part);
  run(g, 60);
  check('in the browser, and takes that one back to the stores', inCrate(crate) === 'coal 1' && !c.carrying, `${inCrate(crate)} ${c.carrying?.id}`);
}
{
  const g = body();
  stock(g, 21, [['coal', 5]]);
  const f = g.addCampfire(23, 20, 0, 0, 0, false);
  const [fx, fy] = [Math.floor(f.x + (f.sx + 1) / 2), Math.floor(f.y + (f.sy + 1) / 2)];
  const o = worker(g, LOW);
  o.carrying = { uid: g.inventory.nextUid++, id: 'coal', ql: 30, dmg: 0, count: 1 };
  o.job = 'campfire';
  o.workX = fx;
  o.workY = fy;
  const c = worker(g, LOW);
  check('in the browser, a campfire another worker is carrying fuel to is left to it',
    inner(g).coldHearth(g, c, 10, null) === null && inner(g).coldHearth(g, o, 10, null)?.kind === 'campfire');
}
for (const kind of ['oven', 'brazier']) {
  const g = body();
  const crate = stock(g, 21, [['log', 1]]);
  const p = g.addFurniture(kind, 23, 18, 0, 0, 30);
  p.fuel = 0;
  p.lit = false;
  worker(g, LOW);
  run(g, 60);
  const lit = kind === 'oven';
  check(`in the browser, ${kind === 'oven' ? 'an oven is fed a log and lit' : 'a brazier is fed a log and left to light itself after dark'}, as on the island`,
    `${inCrate(crate)}|${p.fuel}|${!!p.lit}|${hearthCapacity(p) > HEARTH_FULL}` === at(kind.toUpperCase()) && !!p.lit === lit, `${inCrate(crate)} ${p.fuel} ${p.lit}`);
}
for (const [level, name, campfire] of [[LOW, 'low', false], [EMBER, 'ember', false], [EMBER, 'nofuel', true]] as Array<[number, string, boolean]>) {
  const g = body();
  const crate = stock(g, 21, [['copper_ore', 3]]);
  const s = g.addSmelter(23, 22, 0, 0, 50);
  s.fuel = 3000;
  s.output.push({ uid: g.inventory.nextUid++, id: 'copper_lump', ql: 30, dmg: 0, count: 2 });
  if (campfire) g.addCampfire(23, 18, 0, 0, 0, false);
  const c = worker(g, level);
  run(g, 120);
  const got = `${inCrate(crate)}|${s.jobs.length}|${s.output.length}${name === 'low' ? `|${c.idle?.why}` : ''}`;
  check(`in the browser, ${name === 'low' ? 'a Sluglow leaves a smelter alone' : name === 'ember' ? 'a Slugember empties a smelter into the stores and charges it with the ore'
    : 'and so with a cold campfire and no fuel for it'}, as on the island`, got === at(`SMELT:${name}`), got);
}
{
  const g = body();
  stock(g, 21, []);
  g.addCampfire(23, 20, 0, 0, 0, false);
  const low = worker(g, LOW);
  run(g, 10);
  const g2 = body();
  stock(g2, 21, []);
  const ember = worker(g2, EMBER);
  run(g2, 10);
  check('in the browser, a Sluglow with a cold campfire and no fuel says the stores hold none; a Slugember with nothing to do, nothing in range',
    low.idle?.why === 'stock' && ember.idle?.why === 'range', `${low.idle?.why} ${ember.idle?.why}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nstokers — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
