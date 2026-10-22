/**
 * Eight more hands on a settlement.
 *
 * Asked for off a third list of work only a player did. This asks, of both
 * sides, that each of the eight is a species with its trade, may be set to
 * work a settlement and says what it does in the island's words; and that
 * set to work it does it: planks sawn, stone brick chiselled, clay brick
 * shaped, rope laid up and arrows fletched at the stores, papyrus pressed at
 * a paper press, a pot glazed, and an empty bucket filled at a well and put
 * back.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import { GATHER_DO, PAPER_RECIPES, SPECIES, STORE_RECIPES, TEND_JOBS, type Creature, type GatherKind } from '../../src/game/creatures';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { PAPER_PRESS } from '../../src/game/enchant';
import { GLAZE_ASH } from '../../src/game/actions';
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

const HANDS: Array<[string, GatherKind]> = [
  ['rippa', 'saw'], ['chissa', 'chisel'], ['mudda', 'brick'], ['cordra', 'rope'],
  ['flecha', 'fletch'], ['papra', 'paper'], ['glossa', 'glaze'], ['dippa', 'fill'],
];
/** What each of the five at the stores is given, and what the stores hold after. */
const AT_STORES: Array<[string, Array<[string, number]>, string]> = [
  ['rippa', [['log', 1], ['saw', 1]], 'plank 3,saw 1'],
  ['chissa', [['rock_shards', 1], ['chisel', 1]], 'chisel 1,stone_brick 2'],
  ['mudda', [['clay', 1]], 'unfired_clay_brick 1'],
  ['cordra', [['wemp', 4], ['rope_tool', 1]], 'rope 1,rope_tool 1'],
  ['flecha', [['shaft', 1], ['arrow_head', 3], ['feather', 3], ['carving_knife', 1]], 'arrow 3,carving_knife 1'],
];
const PAPER: Array<[string, number]> = [['reed', 4], ['water_bucket', 1]];

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000c8';
const work = (species: string): string => `
  select id into v_id from hand where species = '${species}';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);`;
const put = (items: Array<[string, number]>): string =>
  `insert into item (world_id, holder, crate, def, ql, count) values ${items.map(([id, n]) => `(w, 'crate', 7301, '${id}', 30, ${n})`).join(', ')};`;
const held = `coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7301), '-')`;
const done = (): string => `
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7301;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table hand (species text, id int);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id int; v_p bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hands8', 173, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Eightsend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7301, 'plank', 17, 16, 0, 0, true, u);

  insert into said select 'TRADE:' || s.id, coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-')) || '|' || tend_job(coalesce(s.gathers, '-'))
    from species_def s where s.id in (${HANDS.map(([id]) => `'${id}'`).join(', ')});
  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '30 days', u)
    from unnest(array[${HANDS.map(([id]) => `'${id}'`).join(', ')}]) s;
  insert into said select 'ASK:' || h.species, coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', h.id)), 'none') from hand h;
  update creature set mode = 'deed', stance = 'passive', hunger = 1, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(),
         from_x = to_x, from_y = to_y
   where world_id = w and id in (select id from hand);
  insert into said select 'LINE:' || h.species, deed_job_line(c2) from hand h join creature c2 on c2.world_id = w and c2.id = h.id;
  update creature set mode = 'stored' where world_id = w and id in (select id from hand);
  insert into said select 'RECIPES:' || k, coalesce(array_to_string(tend_recipes(k), ','), '-')
    from unnest(array['tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper']) k;

  -- The five at the stores, each given its makings and its tool.
${AT_STORES.map(([id, items]) => `  ${put(items)}${work(id)}
  insert into said select 'MADE:${id}', ${held};${done()}`).join('\n')}

  -- Papra: the reeds and a bucket of water, with no press and then with one.
  ${put(PAPER)}${work('papra')}
  insert into said select 'NOPRESS', ${held};
  update creature set mode = 'stored' where world_id = w and id = v_id;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'paper_press', 19, 16, 0, 0, 19.25, 16.25, 30, u) returning id into v_p;${work('papra')}
  insert into said select 'PAPER', ${held};${done()}
  delete from placed where id = v_p;

  -- Glossa: two pots, one glazed already, and one ash.
  insert into item (world_id, holder, crate, def, ql, count, mark) values (w, 'crate', 7301, 'clay_pot', 30, 1, null), (w, 'crate', 7301, 'clay_bowl', 30, 1, '{"glaze": 0}');
  ${put([['ash', 1]])}${work('glossa')}
  insert into said select 'GLAZE', ${held} || '|' || (select string_agg(def || ':' || coalesce(mark->>'glaze', 'none'), ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7301 and def like 'clay_%');${done()}

  -- Dippa: an empty bucket, and a well on the settlement.
  ${put([['bucket', 1]])}
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, liquid, litres, since, made_by)
    values (w, 'furniture', 'well', 19, 18, 0, 0, 20, 19, 30, 'water', 100, now(), u) returning id into v_p;${work('dippa')}
  insert into said select 'FILL', ${held} || '|' || (select (placed_litres(p) < 100)::text from placed p where p.id = v_p)
    || '|' || coalesce((select carrying::text from creature where world_id = w and id = v_id), 'empty-handed');${done()}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const words = (s: string): string => s.replace(/\d+/g, 'N');

/* ---- the species and their words ----------------------------------------------------- */

for (const [id, trade] of HANDS) {
  check(`a ${id}'s trade is ${trade} on both sides, worked at the stores or at your own, and the island works it`,
    SPECIES[id]?.gathers === trade && TEND_JOBS.has(trade) && at(`TRADE:${id}`) === `${trade}|true|true`, at(`TRADE:${id}`));
  check(`a ${id} may be set to work a settlement`, at(`ASK:${id}`) === 'none', at(`ASK:${id}`));
  check(`a ${id}'s description is filled in`, !!SPECIES[id] && !/[{}]/.test(SPECIES[id].description), SPECIES[id]?.description);
}
const g0 = Game.create(4248);
for (const [id] of HANDS) {
  const c = g0.creatures.spawn(id, g0.player.x + 1, g0.player.y, 'active', g0.rand, g0.time - 3600 * 24 * 30);
  c.mode = 'deed';
  check(`a ${id} says what it will do in the island's words, and nothing of the crate`,
    words(deedJobLine(c)) === words(at(`LINE:${id}`)) && !deedJobLine(c).endsWith('; output to the crate'), `${deedJobLine(c)} / ${at(`LINE:${id}`)}`);
}
for (const [k, list] of [...Object.entries(STORE_RECIPES), ['paper', PAPER_RECIPES]] as Array<[string, readonly string[]]>) {
  check(`a ${k} trade works the same recipes on both sides: ${list.join(', ')}`, at(`RECIPES:${k}`) === list.join(','), at(`RECIPES:${k}`));
}
const made = (id: string): number => RECIPE_BY_ID.get(id)?.count ?? 1;
const takes = (id: string, item: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.item === item)?.count ?? 1;
check('the words give the numbers the recipes use',
  GATHER_DO.saw.includes(`${made('make_planks')} a log`)
  && GATHER_DO.chisel.includes(`${made('make_stone_brick')} a shard`)
  && GATHER_DO.rope.includes(`${takes('make_rope', 'wemp')} fibres a rope`)
  && GATHER_DO.fletch.includes(`${made('make_arrows')} a shaft, ${takes('make_arrows', 'arrow_head')} heads`)
  && GATHER_DO.paper.includes(`${made('make_papyrus')} sheets per ${takes('make_papyrus', 'reed')} reeds`)
  && GATHER_DO.glaze.includes(`${GLAZE_ASH} ${GLAZE_ASH === 1 ? 'ash' : 'ashes'} each`),
  [GATHER_DO.saw, GATHER_DO.fletch, GATHER_DO.paper].join(' / '));

/* ---- what each does, on the island --------------------------------------------------- */

for (const [id, , after] of AT_STORES) check(`on the island, a ${id} works its makings into what the recipe makes: ${after}`, at(`MADE:${id}`) === after, at(`MADE:${id}`));
check('a papra presses nothing with no paper press on the settlement', at('NOPRESS') === 'reed 4,water_bucket 1', at('NOPRESS'));
check('and at one, presses the reeds into papyrus, its water out of the bucket', at('PAPER') === 'papyrus 3,water_bucket 1', at('PAPER'));
check('a glossa glazes the bare pot with the ash and leaves the glazed bowl as it was', at('GLAZE') === 'clay_bowl 1,clay_pot 1|clay_bowl:0,clay_pot:0', at('GLAZE'));
const [fillStores, wellDrawn, fillHeld] = at('FILL').split('|');
check('a dippa fills the empty bucket at the well and puts it back full', fillStores === 'water_bucket 1' && wellDrawn === 'true' && fillHeld === 'empty-handed', at('FILL'));

/* ---- what each does, in the browser -------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4243);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Eightsend', x: 20, y: 20, radius: 6, level: 2 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  return g;
};
const worker = (g: Game, species: string): Creature => {
  const c = g.creatures.spawn(species, 20.5, 21.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
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
const inCrate = (crate: ReturnType<Game['addCrate']>): string => {
  const n = new Map<string, number>();
  for (const i of crate.items) n.set(i.id, (n.get(i.id) ?? 0) + i.count);
  return [...n].map(([id, k]) => `${id} ${k}`).sort().join(',') || '-';
};

for (const [id, items, after] of AT_STORES) {
  const g = body();
  const crate = stock(g, items);
  worker(g, id);
  run(g, 60);
  check(`in the browser, a ${id} works its makings into what the recipe makes: ${after}`, inCrate(crate) === after, inCrate(crate));
}
{
  const g = body();
  const crate = stock(g, PAPER);
  worker(g, 'papra');
  run(g, 30);
  const before = inCrate(crate);
  g.addFurniture(PAPER_PRESS, 23, 21, 0, 0, 30);
  run(g, 60);
  check('a papra presses nothing with no paper press, and at one presses the reeds into papyrus, its water out of the bucket',
    before === 'reed 4,water_bucket 1' && inCrate(crate) === 'papyrus 3,water_bucket 1', `${before} / ${inCrate(crate)}`);
}
{
  const g = body();
  const crate = stock(g, [['clay_pot', 1], ['clay_bowl', 1], ['ash', 1]]);
  const bowl = crate.items.find((i) => i.id === 'clay_bowl')!;
  bowl.mark = { glaze: 0 };
  worker(g, 'glossa');
  run(g, 60);
  const pot = crate.items.find((i) => i.id === 'clay_pot');
  check('a glossa glazes the bare pot with the ash and leaves the glazed bowl as it was',
    pot?.mark?.glaze === 0 && bowl.mark?.glaze === 0 && inCrate(crate) === 'clay_bowl 1,clay_pot 1', `${inCrate(crate)} ${JSON.stringify(pot?.mark)}`);
}
{
  const g = body();
  const crate = stock(g, [['bucket', 1]]);
  const well = g.addFurniture('well', 23, 22, 0, 0, 30);
  well.liquid = 'water';
  well.litres = 100;
  const c = worker(g, 'dippa');
  run(g, 90);
  check('a dippa fills the empty bucket at the well and puts it back full', inCrate(crate) === 'water_bucket 1' && (well.litres ?? 0) < 100 && !c.carrying,
    `${inCrate(crate)} ${well.litres} ${c.carrying?.id}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\neight more hands — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
