/**
 * What a worker makes in place, on its work log.
 *
 * Reported: "Dowse does not appear to be making nails or giving an error." A dowse at its anvil beat iron lumps into
 * nails and put them in the stores, and its card's log for the island day read one cycle and nothing handled: a go
 * at an errand counted only what left the worker's arms, and a trade worked in place carries nothing.
 *
 * Asked of both sides: after a go, the log's handled counts what the go put into the stores -- a dowse's nails, a
 * smithing's worth (`smithPer`); an ulva's yarn; a rippa's planks; a simma's cooking; a glimmip's glass lumps -- and onto its lifetime with it
 * (`work_stats`); and a load carried back into the stores -- a cobbe's with no work for it, a dippa's full buckets --
 * is counted once at most, as what left its arms, and not again as made.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { smithMakes, smithPer, SPIN_RECIPES, type Creature } from '../../src/game/creatures';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { TileType } from '../../src/world/tiles';
import { article } from '../../src/game/words';

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

type Station = 'spindle' | 'anvil' | 'campfire' | 'smelter' | null;
const recipeMakes = (id: string): Record<string, number> => ({ [RECIPE_BY_ID.get(id)!.result]: RECIPE_BY_ID.get(id)!.count ?? 1 });
/** Each worker, what its stores are given, the station it works at, and what its log should say it handled. */
const CASES: Array<{ id: string; items: Array<[string, number]>; at: Station; made: Record<string, number> }> = [
  { id: 'dowse', items: [['iron_lump', 1]], at: 'anvil', made: { [smithMakes('nail')]: smithPer('nail') } },
  { id: 'ulva', items: [['wool', 2], ['cotton', 2], ['wemp', 2]], at: 'spindle', made: { yarn: SPIN_RECIPES.reduce((n, r) => n + (RECIPE_BY_ID.get(r)!.count ?? 1), 0) } },
  { id: 'rippa', items: [['log', 1]], at: null, made: recipeMakes('make_planks') },
  { id: 'simma', items: [['blueberry', 3]], at: 'campfire', made: recipeMakes('make_compote') },
  { id: 'glimmip', items: [['sand', 3]], at: 'smelter', made: recipeMakes('make_glass') },
];
/** A cobbe holding planks no work wants, and how many. */
const HOD_HELD = 3;
/** Empty buckets a dippa is given to fill. */
const BUCKETS = 2;
/** Equal as data, whatever order the keys came in: jsonb keeps its own. */
const sameMade = (a: Record<string, number> | null | undefined, b: Record<string, number>): boolean => {
  const ka = Object.keys(a ?? {}).sort();
  const kb = Object.keys(b).sort();
  return ka.join() === kb.join() && kb.every((k) => a![k] === b[k]);
};
const says = (m: unknown): string => JSON.stringify(m ?? null);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000d4';
const put = (items: Array<[string, number]>): string =>
  items.length ? `insert into item (world_id, holder, crate, def, ql, count) values ${items.map(([id, n]) => `(w, 'crate', 7402, '${id}', 30, ${n})`).join(', ')};` : '';
const station = (at: Station): string =>
  at === 'spindle'
    ? `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'spindle', 19, 16, 0, 0, 19.25, 16.25, 30, u) returning id into v_p;`
    : at === 'anvil'
      ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'anvil', 19, 16, 0, 0, 19.5, 16.5, 30, u) returning id into v_p;`
      : at === 'campfire'
        ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by) values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, 3000, 0, true, now(), u) returning id into v_p;`
        : at === 'smelter'
          ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by) values (w, 'smelter', 19, 16, 0, 0, 19.75, 16.5, 30, 100000, true, now(), '{"jobs": [], "output": []}'::jsonb, u) returning id into v_p;`
          : '';
const work = (species: string, carrying = 'null'): string => `
  select id into v_id from hand where species = '${species}';
  update creature set mode = 'deed', carrying = ${carrying}, ledger = null, work_stats = null, until = now() - interval '600 seconds',
         settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);`;
const said = (k: string): string => `
  insert into said select '${k}', coalesce((select (ledger->'now'->'made')::text || '|' || coalesce((work_stats->'made')::text, 'null')
    from creature where world_id = w and id = v_id), '-');`;
const done = `
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7402;
  delete from placed where world_id = w;`;
const SPECIES_IDS = [...CASES.map((c) => c.id), 'cobbe', 'dippa'];

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table hand (species text, id int);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id int; v_p bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('MadeLog', 193, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Logsend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7402, 'plank', 17, 16, 0, 0, true, u);
  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '60 days', u)
    from unnest(array[${SPECIES_IDS.map((id) => `'${id}'`).join(', ')}]) s;
  update creature set mode = 'stored', stance = 'passive', hunger = 1, skills = '{}'::jsonb, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(),
         from_x = to_x, from_y = to_y
   where world_id = w and id in (select id from hand);
${CASES.map(({ id, items, at }) => `
  -- ${id}: its makings${at ? ` and a ${at}` : ''}.
  ${put(items)}
  ${station(at)}${work(id)}${said(`MADE:${id}`)}${done}`).join('\n')}

  -- A cobbe holding planks no work wants: back into the stores.
  ${work('cobbe', `'{"def": "plank", "count": ${HOD_HELD}, "ql": 30}'::jsonb`)}${said('HOD')}
  insert into said select 'HODSTORES', coalesce((select sum(count)::text from item where world_id = w and holder = 'crate' and crate = 7402 and def = 'plank'), '0');${done}

  -- A dippa with empty buckets in the stores and a well on the settlement: filled and put away.
  ${put([['bucket', BUCKETS]])}
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, liquid, litres, since, made_by)
    values (w, 'furniture', 'well', 19, 18, 0, 0, 20, 19, 30, 'water', 100, now(), u) returning id into v_p;${work('dippa')}${said('FILL')}
  insert into said select 'FILLSTORES', coalesce((select sum(count)::text from item where world_id = w and holder = 'crate' and crate = 7402 and def = 'water_bucket'), '0');${done}

  -- Nothing noted once the go is counted, and a put outside one notes nothing.
  insert into said select 'OFF', '[' || coalesce(current_setting('wurm.made', true), '') || ']';
  perform worker_put(w, (select c2 from creature c2 where c2.world_id = w and c2.id = v_id), 'plank', 1, 30, 17, 16);
  insert into said select 'OFFPUT', '[' || coalesce(current_setting('wurm.made', true), '') || ']';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
/** The log's handled and the lifetime's, as the island said them. */
const isleMade = (k: string): [Record<string, number> | null, Record<string, number> | null] => {
  const [a, b] = at(k).split('|');
  try {
    return [JSON.parse(a) as Record<string, number> | null, JSON.parse(b) as Record<string, number> | null];
  } catch {
    return [null, null];
  }
};

for (const { id, at: st, made } of CASES) {
  const [day, life] = isleMade(`MADE:${id}`);
  check(`on the island, ${article(id)} ${id}${st ? ` at ${article(st)} ${st}` : ''}'s log for the day handled ${says(made)}`, sameMade(day, made), at(`MADE:${id}`));
  check(`and the ${id}'s lifetime with it`, sameMade(life, made), at(`MADE:${id}`));
}
{
  const [day] = isleMade('HOD');
  check(`on the island, a cobbe putting back ${HOD_HELD} planks no work wants counts them once`,
    sameMade(day, { plank: HOD_HELD }) && at('HODSTORES') === String(HOD_HELD), `${at('HOD')} stores ${at('HODSTORES')}`);
  const [fill] = isleMade('FILL');
  check(`on the island, a dippa's ${BUCKETS} full buckets put away are counted once at most, as carried, not again as made`,
    !!fill && (fill.water_bucket ?? 0) <= BUCKETS && at('FILLSTORES') === String(BUCKETS), `${at('FILL')} stores ${at('FILLSTORES')}`);
}

check('on the island, nothing is noted as made once a go is counted, nor by a put outside one',
  at('OFF') === '[]' && at('OFFPUT') === '[]', `${at('OFF')} ${at('OFFPUT')}`);

/* ---- in the browser -------------------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4257);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Logsend', x: 20, y: 20, radius: 6, level: 2 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  return g;
};
const worker = (g: Game, species: string): Creature => {
  const c = g.creatures.spawn(species, 20.5, 21.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  c.skills = {};
  return c;
};
const run = (g: Game, secs: number): void => {
  for (let i = 0; i < secs * 10; i++) {
    g.time += 0.1;
    g.creatures.update(0.1, g);
  }
};
const stock = (g: Game, items: Array<[string, number]>): ReturnType<Game['addCrate']> =>
  g.addCrate('plank', 21, 20, 0, 0, items.map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count })), true);
const place = (g: Game, st: Station): void => {
  if (st === 'spindle') g.addFurniture('spindle', 23, 21, 0, 0, 30);
  else if (st === 'anvil') g.addAnvil(23, 21, 0, 0, 'iron', 30);
  else if (st === 'campfire') g.addCampfire(23, 21, 0, 0, 3000, true);
  else if (st === 'smelter') Object.assign(g.addSmelter(23, 21, 0, 0, 30), { lit: true, fuel: 100000 });
};
const count = (crate: ReturnType<Game['addCrate']>, id: string): number => crate.items.filter((i) => i.id === id).reduce((n, i) => n + i.count, 0);

for (const { id, items, at: st, made } of CASES) {
  const g = body();
  stock(g, items);
  place(g, st);
  const c = worker(g, id);
  run(g, 120);
  check(`in the browser, ${article(id)} ${id}${st ? ` at ${article(st)} ${st}` : ''}'s log for the day handled ${says(made)}`, sameMade(c.ledger?.now.made, made), says(c.ledger?.now.made));
  check(`and the ${id}'s lifetime with it`, sameMade(c.work?.made, made), says(c.work?.made));
}
{
  const g = body();
  const crate = stock(g, []);
  const c = worker(g, 'cobbe');
  c.carrying = { uid: g.inventory.nextUid++, id: 'plank', ql: 30, dmg: 0, count: HOD_HELD };
  run(g, 60);
  check(`in the browser, a cobbe putting back ${HOD_HELD} planks no work wants counts them once`,
    sameMade(c.ledger?.now.made, { plank: HOD_HELD }) && count(crate, 'plank') === HOD_HELD, `${says(c.ledger?.now.made)} stores ${count(crate, 'plank')}`);
}
{
  const g = body();
  const crate = stock(g, [['bucket', BUCKETS]]);
  const well = g.addFurniture('well', 23, 22, 0, 0, 30);
  well.liquid = 'water';
  well.litres = 100;
  const c = worker(g, 'dippa');
  run(g, 120);
  check(`in the browser, a dippa's ${BUCKETS} full buckets put away are counted once at most, as carried, not again as made`,
    !!c.ledger && (c.ledger.now.made.water_bucket ?? 0) <= BUCKETS && count(crate, 'water_bucket') === BUCKETS, `${says(c.ledger?.now.made)} stores ${count(crate, 'water_bucket')}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nmade on the log — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
