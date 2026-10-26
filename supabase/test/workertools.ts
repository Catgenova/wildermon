/**
 * A spinner, a nail smith and a ribbon smith, and no worker needs a tool.
 *
 * Asked for: an ulva spins wool, cotton and wemp from the settlement stores into yarn at a spindle of yours, and no
 * longer guards or hunts on sight; a dowse beats iron lumps into nails at an anvil of yours, and no longer prospects;
 * a siffa beats lumps of any metal but the rare ones into metal ribbons there, and no longer pans. And no wildermon
 * needs or uses a tool: every crafting worker works with none in the stores, and a tool that is in them is not worn.
 *
 * Asked of both sides: each of the three is a species with its trade, may be set to work a settlement and says what
 * it does in the island's words; the recipes, moulds and metals are the same on both; set to work, each does it at its
 * station and not without one; and every worker that works a recipe with a tool in your own hands makes what the
 * recipe makes with no tool in the stores, and leaves a tool that is there as it was.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import {
  GATHER_DO, HANDS_TRADES, SMITH_TRADES, smithLumps, smithMakes, smithPer, SPECIES, SPIN_RECIPES, TEND_JOBS, type Creature, type GatherKind,
} from '../../src/game/creatures';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { MOULD_BY_ID, RARE_METALS } from '../../src/game/metal';
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

const NEW: Array<[string, GatherKind]> = [['ulva', 'spin'], ['dowse', 'nail'], ['siffa', 'ribbon']];
type Station = 'spindle' | 'anvil' | 'campfire' | null;
/** What a recipe makes, as the stores say it: "plank 3". */
const makes = (id: string): string => `${RECIPE_BY_ID.get(id)!.result} ${RECIPE_BY_ID.get(id)!.count ?? 1}`;
/**
 * Each worker, what its stores are given (and no tool), the station it works at, what the stores hold after, and the
 * tool its recipe wants in your own hands, if any.
 */
const CASES: Array<{ id: string; items: Array<[string, number]>; at: Station; after: string; tool?: string }> = [
  { id: 'ulva', items: [['wool', 2], ['cotton', 2], ['wemp', 2]], at: 'spindle', after: `yarn ${SPIN_RECIPES.reduce((n, r) => n + (RECIPE_BY_ID.get(r)!.count ?? 1), 0)}` },
  { id: 'dowse', items: [['iron_lump', 1], ['copper_lump', 1]], at: 'anvil', after: `copper_lump 1,${smithMakes('nail')} ${smithPer('nail')}` },
  { id: 'siffa', items: [['copper_lump', 1], ['gold_lump', 1]], at: 'anvil', after: `gold_lump 1,${smithMakes('ribbon')} ${smithPer('ribbon')}` },
  { id: 'rippa', items: [['log', 1]], at: null, after: makes('make_planks'), tool: RECIPE_BY_ID.get('make_planks')!.tool },
  { id: 'chissa', items: [['rock_shards', 1]], at: null, after: makes('make_stone_brick'), tool: RECIPE_BY_ID.get('make_stone_brick')!.tool },
  { id: 'cordra', items: [['wemp', 4]], at: null, after: makes('make_rope'), tool: RECIPE_BY_ID.get('make_rope')!.tool },
  { id: 'flecha', items: [['shaft', 1], ['arrow_head', 3], ['feather', 3]], at: null, after: makes('make_arrows'), tool: RECIPE_BY_ID.get('make_arrows')!.tool },
  { id: 'tanna', items: [['hide', 1], ['lye_bucket', 1]], at: null, after: `${makes('tan_hide')},lye_bucket 1`, tool: RECIPE_BY_ID.get('tan_hide')!.tool },
  { id: 'grista', items: [['wheat', 2]], at: null, after: makes('make_flour'), tool: RECIPE_BY_ID.get('make_flour')!.tool },
  { id: 'simma', items: [['blueberry', 3]], at: 'campfire', after: makes('make_compote'), tool: RECIPE_BY_ID.get('make_compote')!.tool },
];
/** "a 1,b 2" with the tool counted in, in the order the stores are read. */
const withTool = (after: string, tool: string): string => [...after.split(','), `${tool} 1`].sort().join(',');
const SPECIES_IDS = [...new Set(CASES.map((c) => c.id))];

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000d3';
const put = (items: Array<[string, number]>): string =>
  items.length ? `insert into item (world_id, holder, crate, def, ql, count) values ${items.map(([id, n]) => `(w, 'crate', 7401, '${id}', 30, ${n})`).join(', ')};` : '';
const held = `coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7401), '-')`;
const station = (at: Station): string =>
  at === 'spindle'
    ? `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'spindle', 19, 16, 0, 0, 19.25, 16.25, 30, u) returning id into v_p;`
    : at === 'anvil'
      ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'anvil', 19, 16, 0, 0, 19.5, 16.5, 30, u) returning id into v_p;`
      : at === 'campfire'
        ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by) values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, 3000, 0, true, now(), u) returning id into v_p;`
        : '';
const work = (species: string): string => `
  select id into v_id from hand where species = '${species}';
  update creature set mode = 'deed', carrying = null, until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);`;
const done = `
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7401;
  delete from placed where world_id = w;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table hand (species text, id int);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id int; v_p bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('NoTools', 191, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Toolsend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7401, 'plank', 17, 16, 0, 0, true, u);

  insert into said select 'TRADE:' || s.id, coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-')) || '|' || tend_job(coalesce(s.gathers, '-'))
      || '|' || hands_trade(coalesce(s.gathers, '-')) || '|' || coalesce(s.hunter, false)
    from species_def s where s.id in (${NEW.map(([id]) => `'${id}'`).join(', ')});
  insert into said values ('SPIN', array_to_string(tend_recipes('spin'), ','));
  insert into said select 'SMITH:' || k, coalesce(smith_mould(k), '-') || '|' || coalesce(array_to_string(smith_lumps(k), ','), '-')
      || '|' || coalesce((select m.makes || ' ' || m.per from mould_def m where m.id = smith_mould(k)), '-')
    from unnest(array['nail', 'ribbon']) k;
  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '60 days', u)
    from unnest(array[${SPECIES_IDS.map((id) => `'${id}'`).join(', ')}]) s;
  insert into said select 'ASK:' || h.species, coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', h.id)), 'none') from hand h;
  update creature set mode = 'deed', stance = 'passive', hunger = 1, skills = '{}'::jsonb, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(),
         from_x = to_x, from_y = to_y
   where world_id = w and id in (select id from hand);
  insert into said select 'LINE:' || h.species, deed_job_line(c2) from hand h join creature c2 on c2.world_id = w and c2.id = h.id;
  update creature set mode = 'stored' where world_id = w and id in (select id from hand);

${CASES.map(({ id, items, at, tool }) => `
  -- ${id}: its makings and no tool${at ? `, with no ${at} and then with one` : ''}.
  ${put(items)}${at && at !== 'campfire' ? `${work(id)}
  insert into said select 'BARE:${id}', ${held} || '|' || coalesce((select idle_why from creature where world_id = w and id = v_id), '-');
  update creature set mode = 'stored' where world_id = w and id = v_id;` : ''}
  ${station(at)}${work(id)}
  insert into said select 'MADE:${id}', ${held};
  insert into said select 'EXTRA:${id}', coalesce((select string_agg(def || ':' || coalesce(extra, '-'), ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7401 and def in ('nail', 'ribbon')), '-');${done}${tool ? `
  -- And again with the tool in the stores, at 10 damage: it is neither needed nor worn.
  ${put(items)}
  insert into item (world_id, holder, crate, def, ql, count, dmg) values (w, 'crate', 7401, '${tool}', 30, 1, 10);
  ${station(at)}${work(id)}
  insert into said select 'TOOL:${id}', ${held} || '|' || (select string_agg(dmg::text, ',') from item where world_id = w and holder = 'crate' and crate = 7401 and def = '${tool}');${done}` : ''}`).join('\n')}

  -- Nothing to work and a station: why it stands about.
  ${station('anvil')}${work('dowse')}
  insert into said select 'NOSTOCK:dowse', coalesce((select idle_why from creature where world_id = w and id = v_id), '-');${done}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const words = (s: string): string => s.replace(/\d+/g, 'N');

/* ---- the species and their words ----------------------------------------------------- */

for (const [id, trade] of NEW) {
  check(`a ${id}'s trade is ${trade} on both sides, at your own, a stage's number a go, and the island works it; it does not hunt on sight`,
    SPECIES[id]?.gathers === trade && TEND_JOBS.has(trade) && HANDS_TRADES.has(trade) && !SPECIES[id].hunter && at(`TRADE:${id}`) === `${trade}|true|true|true|false`,
    at(`TRADE:${id}`));
  check(`a ${id} may be set to work a settlement`, at(`ASK:${id}`) === 'none', at(`ASK:${id}`));
  check(`a ${id}'s description is filled in and says its task`, !/[{}]/.test(SPECIES[id].description) && SPECIES[id].description.includes('Settlement task: '),
    SPECIES[id].description);
}
check('an ulva no longer guards, a dowse no longer prospects and a siffa no longer pans',
  !NEW.some(([id]) => ['guard', 'prospect', 'pan'].includes(SPECIES[id].gathers!)) && !/guard|prospect|pan sand/.test(NEW.map(([id]) => SPECIES[id].description).join(' ')));
check('an ulva spins the recipes your own hands spin at a spindle, in the same order on both sides',
  at('SPIN') === SPIN_RECIPES.join(',') && SPIN_RECIPES.every((r) => RECIPE_BY_ID.get(r)?.station === 'spindle' && RECIPE_BY_ID.get(r)?.result === 'yarn'), at('SPIN'));
for (const kind of ['nail', 'ribbon'] as const) {
  const t = SMITH_TRADES[kind]!;
  const m = MOULD_BY_ID.get(t.mould)!;
  check(`a ${kind} smith's mould, metals and pieces a lump are the same on both sides: ${t.mould}, ${smithLumps(kind).length} metals, ${m.makes} ${m.per ?? 1}`,
    at(`SMITH:${kind}`) === `${t.mould}|${smithLumps(kind).join(',')}|${m.makes} ${m.per ?? 1}`, at(`SMITH:${kind}`));
}
check('a dowse smiths iron only; a siffa any metal but the rare ones, a lump a filling',
  SMITH_TRADES.nail!.metals.join(',') === 'iron' && !SMITH_TRADES.ribbon!.metals.some((m) => RARE_METALS.has(m)) && MOULD_BY_ID.get(SMITH_TRADES.ribbon!.mould)!.lumps === 1);
const g0 = Game.create(4251);
for (const id of SPECIES_IDS) {
  const c = g0.creatures.spawn(id, g0.player.x + 1, g0.player.y, 'active', g0.rand, g0.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.skills = {};
  check(`a ${id} says what it will do in the island's words`, words(deedJobLine(c)) === words(at(`LINE:${id}`)), `${deedJobLine(c)} / ${at(`LINE:${id}`)}`);
}
const TOOLS = /needs an? |saw gets|chisel gets|with any bowl|in your settlement stores; needs/;
check('no worker\'s words ask for a tool', !Object.values(SPECIES).some((d) => d.gathers && TOOLS.test(d.description))
  && !(Object.keys(GATHER_DO) as GatherKind[]).some((k) => TOOLS.test(GATHER_DO[k])),
  Object.values(SPECIES).filter((d) => d.gathers && TOOLS.test(d.description)).map((d) => d.id).join(', '));
check('each worker whose recipe wants a tool in your hands says it needs none',
  CASES.filter((c) => c.tool).every((c) => / needed\./.test(SPECIES[c.id].description)), CASES.filter((c) => c.tool && !/ needed\./.test(SPECIES[c.id].description)).map((c) => c.id).join(', '));

/* ---- what each does, on the island --------------------------------------------------- */

for (const { id, at: st, after, tool } of CASES) {
  if (st && st !== 'campfire') {
    check(`on the island, a ${id} with no ${st} works nothing, and says it has no ${st} in reach`,
      at(`BARE:${id}`) === `${CASES.find((c) => c.id === id)!.items.map(([i, n]) => `${i} ${n}`).sort().join(',')}|range`, at(`BARE:${id}`));
  }
  check(`on the island, a ${id} with no tool in the stores${st ? ` at a ${st}` : ''} makes ${after}`, at(`MADE:${id}`) === after, at(`MADE:${id}`));
  if (tool) check(`and with a ${tool} in the stores, leaves it as it was: 10 damage`, at(`TOOL:${id}`) === `${withTool(after, tool)}|10`, at(`TOOL:${id}`));
}
check('on the island, the nails are iron and the ribbons copper', at('EXTRA:dowse') === 'nail:Iron' && at('EXTRA:siffa') === 'ribbon:Copper', `${at('EXTRA:dowse')} ${at('EXTRA:siffa')}`);
check('on the island, a dowse at an anvil with no iron says the stores hold none', at('NOSTOCK:dowse') === 'stock', at('NOSTOCK:dowse'));

/* ---- what each does, in the browser -------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4253);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Toolsend', x: 20, y: 20, radius: 6, level: 2 };
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
const stock = (g: Game, items: Array<[string, number]>, dmg = 0): ReturnType<Game['addCrate']> =>
  g.addCrate('plank', 21, 20, 0, 0, items.map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg, count })), true);
const inCrate = (crate: ReturnType<Game['addCrate']>): string => {
  const n = new Map<string, number>();
  for (const i of crate.items) n.set(i.id, (n.get(i.id) ?? 0) + i.count);
  return [...n].map(([id, k]) => `${id} ${k}`).sort().join(',') || '-';
};
const place = (g: Game, st: Station): void => {
  if (st === 'spindle') g.addFurniture('spindle', 23, 21, 0, 0, 30);
  else if (st === 'anvil') g.addAnvil(23, 21, 0, 0, 'iron', 30);
  else if (st === 'campfire') g.addCampfire(23, 21, 0, 0, 3000, true);
};

for (const { id, items, at: st, after, tool } of CASES) {
  if (st && st !== 'campfire') {
    const g = body();
    const crate = stock(g, items);
    const c = worker(g, id);
    run(g, 60);
    check(`in the browser, a ${id} with no ${st} works nothing, and says it has no ${st} in reach`,
      inCrate(crate) === items.map(([i, n]) => `${i} ${n}`).sort().join(',') && c.idle?.why === 'range', `${inCrate(crate)} ${c.idle?.why}`);
  }
  {
    const g = body();
    const crate = stock(g, items);
    place(g, st);
    worker(g, id);
    run(g, 120);
    check(`in the browser, a ${id} with no tool in the stores${st ? ` at a ${st}` : ''} makes ${after}`, inCrate(crate) === after, inCrate(crate));
    if (id === 'dowse' || id === 'siffa') {
      const piece = crate.items.find((i) => i.id === (id === 'dowse' ? 'nail' : 'ribbon'));
      check(`and the ${piece?.id ?? 'piece'} is of the metal it was beaten from`, piece?.extra === (id === 'dowse' ? 'Iron' : 'Copper'), piece?.extra);
    }
  }
  if (tool) {
    const g = body();
    const crate = stock(g, items);
    crate.items.push({ uid: g.inventory.nextUid++, id: tool, ql: 30, dmg: 10, count: 1 });
    place(g, st);
    worker(g, id);
    run(g, 120);
    const kept = crate.items.find((i) => i.id === tool);
    check(`in the browser, and with a ${tool} in the stores, leaves it as it was: 10 damage`, inCrate(crate) === withTool(after, tool) && kept?.dmg === 10,
      `${inCrate(crate)} ${kept?.dmg}`);
  }
}
{
  const g = body();
  stock(g, []);
  place(g, 'anvil');
  const c = worker(g, 'dowse');
  run(g, 30);
  check('in the browser, a dowse at an anvil with no iron says the stores hold none', c.idle?.why === 'stock', c.idle?.why);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nno tools — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
