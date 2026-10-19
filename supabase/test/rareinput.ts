/**
 * Rare ingredients make rare work more likely, the same on both sides.
 *
 * Asked for: "When crafting, if an ingredient used to craft is rare+, the
 * chance that the outcome is rare+ is increased by the percentage of total
 * ingredients that rare ingredient represents. E.g. a craft with two
 * ingredients, one of which is supreme, has a +50% chance to be supreme."
 *
 *   * the chance of each step, for a grid of what went in and a perk's first
 *     step, is one number on both sides (`rarityBands`, `rarity_bands`), and
 *     what a go says of it is one sentence (`rareInputSaid`, `rare_input_said`);
 *   * a bench of mortar out of a supreme clay and a plain sand comes out
 *     supreme fifty points more often than the plain odds, over many goes, on
 *     both sides; and out of plain clay at the plain odds as it always did;
 *   * a pot out of two clay, both fantastic, is fantastic every time; one out
 *     of a supreme clay and a plain one says one of two units;
 *   * a bucket of water is not an ingredient, and says nothing however rare;
 *   * at the anvil a rare lump strikes coins at least as rare, and a supreme
 *     casting beats out a piece at least supreme, and says so.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ANVIL_ACTION_BY_ID } from '../../src/game/anvil';
import { RARITIES, RARITY_ODDS, rarityBands, rareInputSaid, rarityStep } from '../../src/game/items';
import { RECIPE_ACTIONS, RECIPE_BY_ID } from '../../src/game/recipes';
import type { Target } from '../../src/game/actions';

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

/**
 * Goes of each kind rolled for the odds, and how far the supreme share may be
 * from the rule's: about four of its standard deviations at a half, so that a
 * run fails on the dice about once in ten thousand. More goes take the island
 * minutes.
 */
const GOES = 600;
const TOLERANCE = 0.08;
const STEP = (name: string): number => RARITIES.findIndex((r) => r.name === name);
const SUPREME = STEP('supreme');
const FANTASTIC = STEP('fantastic');
/** A tally of units by step, from a few counts of named steps. */
const units = (by: Record<string, number>): number[] => RARITIES.map((r) => by[r.name || 'ordinary'] ?? 0);
const pgUnits = (u: number[]): string => `'[0:${u.length - 1}]={${u.join(',')}}'::int[]`;
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** What went in, and a perk's first step, asked of both sides. */
const GRID: Array<[number[], number | null]> = [
  [units({ ordinary: 2 }), null],
  [units({ ordinary: 1, supreme: 1 }), null],
  [units({ ordinary: 3, rare: 1 }), null],
  [units({ ordinary: 5, rare: 1, supreme: 1, fantastic: 1 }), null],
  [units({ fantastic: 2 }), null],
  [units({ rare: 1, fantastic: 1 }), null],
  [units({ ordinary: 1, supreme: 1 }), RARITY_ODDS[0] * 2],
  [units({ ordinary: 7, rare: 2 }), 1],
  [units({ supreme: 3 }), 1],
];

const DOUGH = RECIPE_BY_ID.get('make_dough')!;
const flourFor = DOUGH.inputs.find((i) => i.item === 'flour')?.count ?? 1;
const newest = (def: string): string =>
  `(select i.id from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${def}' order by i.id desc limit 1)`;
const clear = (...defs: string[]): string =>
  `delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (${defs.map(q).join(', ')})`;
const last = (like: string): string =>
  `coalesce((select e.text from event e where e.world_id = w and e.uid = u and e.text like ${q(like)} and e.n > v_mark order by e.n desc limit 1), 'unsaid')`;
const craft = (recipe: string, uid: string): string =>
  `perform perform_craft(w, u, '${recipe}', jsonb_build_object('kind', 'item', 'uid', ${uid}))`;
/** Mortar from a clay of `rare` and a plain sand, `GOES` times, and what each came out as. */
const mortar = (key: string, rare: string): string => `
  for i in 1..${GOES} loop
    v_it := give(w, u, 'clay', 1, 30, null, ${rare});
    perform give(w, u, 'sand', 1, 30);
    ${craft('make_mortar', 'v_it')};
    insert into rolled values (${q(key)}, coalesce((select rare from item where id = ${newest('mortar')}), 'ordinary'));
    ${clear('mortar', 'clay', 'sand')};
  end loop;`;

const out = psql(`
begin;
create temp table said (k text, v text);
create temp table rolled (k text, v text);
${['/* the grid, asked of the island */',
    ...GRID.map(([u, first], n) => `insert into said select 'BANDS${n}', array_to_string(rarity_bands(${pgUnits(u)}, ${first ?? 'null'}), ',');
insert into said select 'SAID${n}', coalesce(rare_input_said(${pgUnits(u)}), 'none');`)].join('\n')}
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select true';

do $$
declare w uuid; u uuid; tx int; ty int; i int; v_it bigint; v_mark bigint; v_anvil bigint; v_cast bigint;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_dirt(w, tx, ty, 20);
    perform land_set_tile(w, tx, ty, tile_id('Dirt')); perform land_set_data(w, tx, ty, 0);
  end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from player_node where world_id = w and uid = u;
  update player set x = 9.5, y = 9.5, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', craft_class = null, combat_class = null,
         class_mul = null, craft_from_stores = false, craft_spare_rare = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into skill (world_id, uid, id, value)
    select w, u, s, 50 from unnest(array['masonry', 'pottery', 'cooking', 'blacksmithing', 'weaponsmithing', 'armour_smithing']) s
    on conflict (world_id, uid, id) do update set value = excluded.value;

  /* ---- the user's own: two ingredients, one supreme; and the same with nothing rare. ---- */
  ${mortar('SUPREME', "'supreme'")}
  ${mortar('PLAIN', 'null')}
  select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
  v_it := give(w, u, 'clay', 1, 30, null, 'supreme');
  perform give(w, u, 'sand', 1, 30);
  ${craft('make_mortar', 'v_it')};
  insert into said values ('MORTARSAID', ${last('Rare ingredients:%')});
  ${clear('mortar', 'clay', 'sand')};
  select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
  v_it := give(w, u, 'clay', 1, 30);
  perform give(w, u, 'sand', 1, 30);
  ${craft('make_mortar', 'v_it')};
  insert into said values ('PLAINSAID', ${last('Rare ingredients:%')});
  ${clear('mortar', 'clay', 'sand')};

  /* ---- a pot of two clay: both fantastic, and one supreme of two stacks. ---- */
  for i in 1..20 loop
    v_it := give(w, u, 'clay', 2, 30, null, 'fantastic');
    ${craft('make_clay_pot', 'v_it')};
    insert into rolled values ('POTFANTASTIC', coalesce((select rare from item where id = ${newest('unfired_clay_pot')}), 'ordinary'));
    ${clear('unfired_clay_pot', 'clay')};
  end loop;
  select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
  v_it := give(w, u, 'clay', 1, 30, null, 'supreme');
  perform give(w, u, 'clay', 1, 30);
  ${craft('make_clay_pot', 'v_it')};
  insert into said values ('POTSAID', ${last('Rare ingredients:%')} || '|' || (select count(*) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'clay'));
  ${clear('unfired_clay_pot', 'clay')};

  /* ---- a fantastic bucket of water is no ingredient. ---- */
  select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
  v_it := give(w, u, 'flour', ${flourFor}, 30);
  perform give(w, u, 'water_bucket', 1, 30, null, 'fantastic');
  ${craft('make_dough', 'v_it')};
  insert into said values ('DOUGH', ${last('Rare ingredients:%')} || '|' || (select count(*) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'dough'));
  ${clear('dough', 'flour', 'water_bucket', 'bucket')};

  /* ---- the anvil: a rare lump's coins and a supreme casting's piece. ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'anvil', 'iron', 9, 10, 0, 0, 9.25, 10.25, 50, u) returning id into v_anvil;
  perform give(w, u, 'coin_die', 1, 100);
  for i in 1..10 loop
    select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
    v_it := give(w, u, 'gold_lump', 1, 100, 'Gold', 'rare');
    perform perform_forge(w, u, 'strike_coins', jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_it));
    insert into rolled values ('COINS', coalesce((select rare from item where id = ${newest('coin')}), 'none'));
    ${clear('coin', 'gold_lump')};
    update item set dmg = 0 where world_id = w and holder = 'player' and holder_uid = u and def = 'coin_die';
  end loop;
  insert into said values ('COINSAID', ${last('Rare ingredients:%')});
  for i in 1..10 loop
    select coalesce(max(n), 0) into v_mark from event where world_id = w and uid = u;
    insert into item (world_id, holder, holder_uid, def, ql, count, extra, piece, rare)
      values (w, 'player', u, 'casting', 50, 1, 'Iron', 'shovel_head', 'supreme') returning id into v_cast;
    perform perform_forge(w, u, 'smith', jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_cast));
    insert into rolled values ('PIECE', coalesce((select rare from item where id = ${newest('shovel_head')}), 'none'));
    ${clear('shovel_head', 'casting')};
  end loop;
  insert into said values ('PIECESAID', ${last('Rare ingredients:%')});
  delete from placed where id = v_anvil;
end $$;
select k || '=' || v from said order by k;
select 'ROLLED:' || k || '=' || string_agg(v || ':' || n, ',' order by v) from (select k, v, count(*) n from rolled group by k, v) t group by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
/** How many of a kind of go came out at each step, off the island. */
const rolledOn = (k: string): Map<string, number> =>
  new Map(at(`ROLLED:${k}`).split(',').filter((p) => p.includes(':')).map((p) => [p.split(':')[0], Number(p.split(':')[1])] as [string, number]));
const shareOf = (m: Map<string, number>, step: string): number =>
  (m.get(step) ?? 0) / [...m.values()].reduce((a, n) => a + n, 0);
const atLeast = (m: Map<string, number>, step: number): boolean =>
  m.size > 0 && [...m.keys()].every((k) => (rarityStep(k) ?? 0) >= step);

/* ---- one rule ------------------------------------------------------------------------- */

const wrongBands = GRID.map(([u, first], n) => {
  const browser = rarityBands(u, first ?? undefined);
  const island = at(`BANDS${n}`).split(',').map(Number);
  // The island keeps the odds as four-byte reals, which is the last few places of them.
  return browser.length === island.length && browser.every((p, i) => Math.abs(p - island[i]) < 1e-6) ? null
    : `${u.join('/')} at ${first}: browser ${browser.join(',')}, island ${island.join(',')}`;
}).filter(Boolean);
check('the chance of each step, for what went in and a perk\'s first step, is one number on both sides', wrongBands.length === 0, wrongBands.slice(0, 3).join('; '));
const wrongSaid = GRID.map(([u], n) => ((rareInputSaid(u) ?? 'none') === at(`SAID${n}`) ? null : `${rareInputSaid(u)} / ${at(`SAID${n}`)}`)).filter(Boolean);
check('and what a go says of it is one sentence', wrongSaid.length === 0, wrongSaid.slice(0, 3).join('; '));

const one = units({ ordinary: 1, supreme: 1 });
const plain = units({ ordinary: 2 });
const more = rarityBands(one)[SUPREME] - rarityBands(plain)[SUPREME];
check('the user\'s example: two units, one of them supreme, are supreme 50 points more often than two plain ones',
  Math.abs(more - 0.5) < 1e-12, String(more));
check('and fantastic and rare at the odds they always had, what is left of a certainty going to ordinary',
  Math.abs(rarityBands(one)[FANTASTIC] - rarityBands(plain)[FANTASTIC]) < 1e-12
    && Math.abs(rarityBands(one).reduce((a, p) => a + p, 0) - 1) < 1e-12, rarityBands(one).join(','));
check('a thing made only of fantastic is fantastic, and one half rare and half fantastic is never ordinary',
  rarityBands(units({ fantastic: 2 }))[FANTASTIC] === 1 && rarityBands(units({ rare: 1, fantastic: 1 }))[0] === 0,
  `${rarityBands(units({ fantastic: 2 })).join(',')} / ${rarityBands(units({ rare: 1, fantastic: 1 })).join(',')}`);
check('and a go says it in numbers', rareInputSaid(one) === 'Rare ingredients: +50% chance of supreme (1 of 2 units used).' && rareInputSaid(plain) === null,
  String(rareInputSaid(one)));

/* ---- on the island ---------------------------------------------------------------------- */

const expectSupreme = rarityBands(one)[SUPREME];
const plainRare = 1 - rarityBands(plain)[0];
const isleSupreme = rolledOn('SUPREME');
const islePlain = rolledOn('PLAIN');
check(`on the island, ${GOES} mortars of a supreme clay and a plain sand come out supreme about ${Math.round(expectSupreme * 100)}% of the time`,
  Math.abs(shareOf(isleSupreme, 'supreme') - expectSupreme) < TOLERANCE, at('ROLLED:SUPREME'));
check(`and of plain clay rare or better about ${Math.round(plainRare * 100)}% of the time, as ever`,
  Math.abs(1 - shareOf(islePlain, 'ordinary') - plainRare) < 0.02 && shareOf(islePlain, 'supreme') < 0.01, at('ROLLED:PLAIN'));
check('the go says what the supreme clay added, and a plain go says nothing',
  at('MORTARSAID') === rareInputSaid(one) && at('PLAINSAID') === 'unsaid', `${at('MORTARSAID')} / ${at('PLAINSAID')}`);
check('a pot of two fantastic clay is fantastic every time', atLeast(rolledOn('POTFANTASTIC'), FANTASTIC), at('ROLLED:POTFANTASTIC'));
check('and one of a supreme clay and a plain one, two stacks, says one of two units and uses both',
  at('POTSAID') === `${rareInputSaid(one)}|0`, at('POTSAID'));
check('a fantastic bucket of water is no ingredient: the dough says nothing of it', at('DOUGH') === 'unsaid|1', at('DOUGH'));
check('at the anvil a rare gold lump strikes coins at least rare, and says so',
  atLeast(rolledOn('COINS'), STEP('rare')) && at('COINSAID') === rareInputSaid(units({ rare: 1 })), `${at('ROLLED:COINS')} / ${at('COINSAID')}`);
check('and a supreme casting beats out a piece at least supreme, and says so',
  atLeast(rolledOn('PIECE'), SUPREME) && at('PIECESAID') === rareInputSaid(units({ supreme: 1 })), `${at('ROLLED:PIECE')} / ${at('PIECESAID')}`);

/* ---- in the browser --------------------------------------------------------------------- */

const g = Game.create(4711);
g.skillCheck = () => true;
g.player.x = 1e6;
const MORTAR = RECIPE_ACTIONS.find((a) => a.id === 'make_mortar')!;
const POT = RECIPE_ACTIONS.find((a) => a.id === 'make_clay_pot')!;
const DOUGH_ACTION = RECIPE_ACTIONS.find((a) => a.id === 'make_dough')!;
const CLEAR = ['clay', 'sand', 'mortar', 'unfired_clay_pot', 'flour', 'water_bucket', 'bucket', 'dough', 'coin', 'gold_lump', 'casting', 'shovel_head'];
const empty = (): void => {
  for (const it of [...g.inventory.items]) if (CLEAR.includes(it.id)) g.inventory.remove(it.uid, it.count);
};
const told = (): string[] => g.log.map((e) => e.text).filter((t) => t.startsWith('Rare ingredients:'));
/** How many stacks of a thing are in the pack, as the island counts its rows. */
const made = (id: string): number => [...g.inventory.items].filter((it) => it.id === id).length;
const stepsOf = (id: string): number[] => [...g.inventory.items].filter((it) => it.id === id).map((it) => it.rare ?? 0);
const go = (def: typeof MORTAR, uid: number): void => {
  def.perform({ kind: 'item', uid } as Target, g);
};
const browserMortar = (rare: number): number[] => {
  const tally = RARITIES.map(() => 0);
  for (let i = 0; i < GOES; i++) {
    empty();
    const clay = g.inventory.add('clay', { count: 1, ql: 30, ...(rare ? { rare } : {}) });
    g.inventory.add('sand', { count: 1, ql: 30 });
    go(MORTAR, clay.uid);
    for (const step of stepsOf('mortar')) tally[step]++;
  }
  return tally;
};
const bSupreme = browserMortar(SUPREME);
const bPlain = browserMortar(0);
const total = (t: number[]): number => t.reduce((a, n) => a + n, 0);
check(`in the browser, ${GOES} mortars of a supreme clay and a plain sand come out supreme about ${Math.round(expectSupreme * 100)}% of the time`,
  total(bSupreme) === GOES && Math.abs(bSupreme[SUPREME] / GOES - expectSupreme) < TOLERANCE, bSupreme.join(','));
check(`and of plain clay rare or better about ${Math.round(plainRare * 100)}% of the time, as ever`,
  total(bPlain) === GOES && Math.abs(1 - bPlain[0] / GOES - plainRare) < 0.02 && bPlain[SUPREME] / GOES < 0.01, bPlain.join(','));
check('and the island and the browser come out supreme as often as each other',
  Math.abs(bSupreme[SUPREME] / GOES - shareOf(isleSupreme, 'supreme')) < 2 * TOLERANCE, `${bSupreme[SUPREME]} / ${at('ROLLED:SUPREME')}`);
g.log.length = 0;
empty();
const sClay = g.inventory.add('clay', { count: 1, ql: 30, rare: SUPREME });
g.inventory.add('sand', { count: 1, ql: 30 });
go(MORTAR, sClay.uid);
check('the browser\'s go says what the supreme clay added, as the island does', told().at(-1) === at('MORTARSAID'), String(told().at(-1)));

let allFantastic = true;
for (let i = 0; i < 20; i++) {
  empty();
  const clay = g.inventory.add('clay', { count: 2, ql: 30, rare: FANTASTIC });
  go(POT, clay.uid);
  allFantastic &&= stepsOf('unfired_clay_pot').length === 1 && stepsOf('unfired_clay_pot')[0] === FANTASTIC;
}
check('a pot of two fantastic clay is fantastic every time in the browser', allFantastic);
empty();
g.log.length = 0;
const halfClay = g.inventory.add('clay', { count: 1, ql: 30, rare: SUPREME });
g.inventory.add('clay', { count: 1, ql: 30 });
go(POT, halfClay.uid);
check('and one of a supreme clay and a plain one says one of two units and uses both, as the island does',
  `${told().at(-1) ?? 'unsaid'}|${made('clay')}` === at('POTSAID'), `${told().at(-1)}|${made('clay')}`);
empty();
g.log.length = 0;
const flour = g.inventory.add('flour', { count: flourFor, ql: 30 });
g.inventory.add('water_bucket', { count: 1, ql: 30, rare: FANTASTIC });
go(DOUGH_ACTION, flour.uid);
check('a fantastic bucket of water is no ingredient in the browser either', `${told().at(-1) ?? 'unsaid'}|${made('dough')}` === at('DOUGH'),
  `${told().at(-1) ?? 'unsaid'}|${made('dough')}`);

empty();
const anvil = g.addAnvil(Math.floor(g.player.x), Math.floor(g.player.y) + 1, 0, 0, 'iron', 50);
const atAnvil = (itemUid: number): Target => ({ kind: 'anvil', id: anvil.id, itemUid } as unknown as Target);
const die = g.inventory.add('coin_die', { count: 1, ql: 100 });
const coinSteps: number[] = [];
for (let i = 0; i < 10; i++) {
  empty();
  die.dmg = 0;
  const lump = g.inventory.add('gold_lump', { count: 1, ql: 100, extra: 'Gold', rare: 1 });
  ANVIL_ACTION_BY_ID.get('strike_coins')!.perform(atAnvil(lump.uid), g);
  coinSteps.push(...stepsOf('coin'));
}
check('at the browser\'s anvil a rare gold lump strikes coins at least rare, and says so as the island does',
  coinSteps.length === 10 && coinSteps.every((s) => s >= 1) && told().at(-1) === at('COINSAID'), `${coinSteps.join(',')} / ${told().at(-1)}`);
const pieceSteps: number[] = [];
for (let i = 0; i < 10; i++) {
  empty();
  const cast = g.inventory.add('casting', { count: 1, ql: 50, extra: 'Iron', rare: SUPREME });
  cast.piece = 'shovel_head';
  ANVIL_ACTION_BY_ID.get('smith')!.perform(atAnvil(cast.uid), g);
  pieceSteps.push(...stepsOf('shovel_head'));
}
check('and a supreme casting beats out a piece at least supreme, and says so as the island does',
  pieceSteps.length === 10 && pieceSteps.every((s) => s >= SUPREME) && told().at(-1) === at('PIECESAID'), `${pieceSteps.join(',')} / ${told().at(-1)}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nrare ingredients — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
