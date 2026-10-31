/**
 * A glimmip makes glass lumps.
 *
 * Asked for: "design the glassblowing wildermon line. Glass lumps from sand at a lit smelter". The Glimmip line
 * (Glimmip, Glascade, Prismetail) melts sand from the settlement stores into glass lumps at a lit smelter of yours in
 * reach, as your own hands do there (`make_glass`), and puts them in the stores; lumps only; it levels glassblowing; a
 * smelter has to be lit and fuelled, as for a player, and may be charged or not; it neither lights nor fuels one. At
 * its third stage each batch makes a lump more.
 *
 * Asked of both sides: the species and its trade, its recipe and its words are the same; set to work, it makes glass
 * only at a lit smelter of yours within its reach, not at an unlit one nor one out of reach, and at a charged one as at
 * an empty one; it takes the recipe's sand out of the stores and puts the recipe's lumps in; with no sand it stands idle
 * and says why, and with no smelter it says that; it learns glassblowing; and its third stage makes a lump more a batch,
 * below it none.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import {
  EVOLVE_AT, GATHER_DO, GATHER_SKILL, GLASS_RECIPES, HANDS_TRADES, LEARN_PACE, perkLine, perkSays, SPECIES, STAGE_LOADS, STAGE_PERKS, TEND_JOBS,
  type Creature,
} from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { helpText } from '../../src/ui/panels/help';
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

const ID = 'glimmip';
const R = RECIPE_BY_ID.get(GLASS_RECIPES[0])!;
const SAND = R.inputs[0].count ?? 1;
const MAKES = R.count ?? 1;
const MORE = STAGE_PERKS[ID].n;
/** The stores after so many batches out of so much sand, each making `per`: "glass_lump 4,sand 3". */
const after = (sand: number, batches: number, per = MAKES): string =>
  [...(batches ? [`glass_lump ${batches * per}`] : []), ...(sand - batches * SAND ? [`sand ${sand - batches * SAND}`] : [])].sort().join(',') || '-';
const words = (s: string): string => s.replace(/\d+/g, 'N');

/** The smelters each case stands by: none, unlit, out of reach, lit and empty, lit and charged. */
type Smelter = 'none' | 'unlit' | 'far' | 'lit' | 'charged';
/** Each case: its smelter, the sand in the stores, its level, and what the stores hold after. */
const CASES: Array<{ k: string; at: Smelter; sand: number; level?: number; after: string; why?: string }> = [
  { k: 'NONE', at: 'none', sand: 2 * SAND, after: after(2 * SAND, 0), why: 'range' },
  { k: 'UNLIT', at: 'unlit', sand: 2 * SAND, after: after(2 * SAND, 0), why: 'range' },
  { k: 'FAR', at: 'far', sand: 2 * SAND, after: after(2 * SAND, 0), why: 'range' },
  { k: 'LIT', at: 'lit', sand: 2 * SAND + 1, after: after(2 * SAND + 1, 2) },
  { k: 'CHARGED', at: 'charged', sand: SAND, after: after(SAND, 1) },
  { k: 'NOSAND', at: 'lit', sand: SAND - 1, after: after(SAND - 1, 0), why: 'stock' },
  { k: 'STAGE2', at: 'lit', sand: SAND, level: EVOLVE_AT[1] - 1, after: after(SAND, 1) },
  { k: 'STAGE3', at: 'lit', sand: SAND, level: EVOLVE_AT[1], after: after(SAND, 1, MAKES + MORE) },
];

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000e7';
const smelterAt = (at: Smelter): string => {
  if (at === 'none') return '';
  const [x, cx] = at === 'far' ? [34, 34.75] : [19, 19.75];
  const lit = at !== 'unlit';
  const jobs = at === 'charged' ? `jsonb_build_array(jsonb_build_object('makes', 'iron_lump', 'left', 600, 'total', 600, 'ql', 30))` : `'[]'::jsonb`;
  return `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
    values (w, 'smelter', ${x}, 16, 0, 0, ${cx}, 16.5, 50, 100000, ${lit}, now(), jsonb_build_object('jobs', ${jobs}, 'output', '[]'::jsonb), u);`;
};
const held = `coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7501), '-')`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Glassend', 193, 48, 16, 16, true) returning id into w;
  perform land_blank(w, 48);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 47) x, generate_series(0, 47) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Glassend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7501, 'plank', 17, 16, 0, 0, true, u);

  insert into said select 'TRADE', coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-')) || '|' || tend_job(coalesce(s.gathers, '-'))
      || '|' || hands_trade(coalesce(s.gathers, '-')) || '|' || coalesce(s.hunter, false) || '|' || s.on_sand || '|' || s.near_water
    from species_def s where s.id = '${ID}';
  insert into said values ('RECIPES', array_to_string(tend_recipes('glass'), ','));
  insert into said select 'RECIPE', r.result || ' ' || r.count || '|' || r.station || '|' || r.skill || '|'
      || (select string_agg(ri.item || ' ' || ri.count, ',' order by ri.ord) from recipe_input ri where ri.recipe = r.id)
    from recipe r where r.id = '${R.id}';
  insert into said select 'SKILL', g.skill || '|' || g.plain from gather_def g where g.id = 'glass';
  insert into said select 'PACE', p.pace::text from learn_pace_def p where p.id = 'glass';
  insert into said select 'PERK', s.perk || '|' || s.perk_n from species_def s where s.id = '${ID}';

  v_id := creature_spawn(w, '${ID}', 16.6, 16.6, 'active', now() - interval '60 days', u);
  insert into said select 'ASK', coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_id)), 'none');
  update creature set stance = 'passive', hunger = 1, from_x = to_x, from_y = to_y where world_id = w and id = v_id;
${CASES.map(({ k, at, sand, level }) => `
  -- ${k}: ${sand} sand, ${at === 'none' ? 'no smelter' : `a smelter ${at}`}${level ? `, at level ${level}` : ''}.
  ${sand ? `insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7501, 'sand', 30, ${sand});` : ''}
  ${smelterAt(at)}
  update creature set mode = 'deed', carrying = null, skills = ${level ? `jsonb_build_object('${GATHER_SKILL.glass}', ${level})` : `'{}'::jsonb`},
         until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle', idle_why = null
   where world_id = w and id = v_id;
  ${k === 'LIT' ? `insert into said select 'LINE', deed_job_line(c2) from creature c2 where c2.world_id = w and c2.id = v_id;` : ''}
  perform worker_settle(w, v_id);
  insert into said select 'MADE:${k}', ${held} || '|' || coalesce((select idle_why from creature where world_id = w and id = v_id), '-')
      || '|' || coalesce((select skills->>'${GATHER_SKILL.glass}' from creature where world_id = w and id = v_id), '-');
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7501;
  delete from placed where world_id = w;`).join('\n')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the kind, its trade and its words --------------------------------------------- */

const d = SPECIES[ID];
check(`a ${d.name}'s trade is glass on both sides, at your own, a stage's number a go, and the island works it; found on sand by water; no hunter`,
  d.gathers === 'glass' && TEND_JOBS.has('glass') && HANDS_TRADES.has('glass') && !d.hunter && !!d.onSand && !!d.nearWater
    && at('TRADE') === 'glass|true|true|true|false|true|true', at('TRADE'));
check(`its stages are ${d.stages!.map((s) => s.name).join(' and ')}`, d.name === 'Glimmip' && d.stages![0].name === 'Glascade' && d.stages![1].name === 'Prismetail');
check(`it may be set to work a settlement`, at('ASK') === 'none', at('ASK'));
check(`it makes what your own hands make at a smelter, on both sides: ${R.id}, ${SAND} sand into ${MAKES} glass lumps, by glassblowing`,
  at('RECIPES') === GLASS_RECIPES.join(',') && GLASS_RECIPES.length === 1 && R.station === 'smelter' && R.result === 'glass_lump' && R.skill === 'glassblowing'
    && R.inputs.length === 1 && R.inputs[0].item === 'sand' && at('RECIPE') === `glass_lump ${MAKES}|smelter|glassblowing|sand ${SAND}`, at('RECIPE'));
check('lumps only: no panel, bottle or stained glass', !GLASS_RECIPES.some((id) => ['make_glass_panel', 'make_bottle', 'make_stained_glass'].includes(id)));
check(`it levels ${GATHER_SKILL.glass}, and its trade's words are the same on both sides`,
  GATHER_SKILL.glass === 'glassblowing' && at('SKILL') === `glassblowing|${GATHER_DO.glass}`, at('SKILL'));
check(`its learning pace is the same on both sides: ${LEARN_PACE.glass}`, Number(at('PACE')) === LEARN_PACE.glass, at('PACE'));
check(`its third-stage skill is the same on both sides: ${perkSays(ID)}`,
  at('PERK') === `more|${MORE}` && STAGE_PERKS[ID].kind === 'more' && perkSays(ID) === `glass lumps per batch +${MORE}`, at('PERK'));
check('its words say its task with the recipe\'s numbers, and that the smelter may be charged',
  !/[{}]/.test(d.description) && d.description.includes(`Settlement task: make glass lumps from sand in your settlement stores at your lit smelters, ${MAKES} per ${SAND} sand.`)
    && d.description.includes('charged or not') && d.description.includes('Does not light or fuel it.'), d.description);
const third = d.stages![1].description;
check('its third stage\'s words give its stage\'s batches and its skill, and the second\'s do not give the skill',
  third.includes(`works ${STAGE_LOADS[2]} batches a cycle`) && third.includes(`${perkLine(ID)}.`) && !d.stages![0].description.includes('skill:'), third);
check('the help names it among the settlement\'s hands', helpText().includes(`<b>${d.name}</b> (taming ${d.tameLevel}): ${GATHER_DO.glass}`));

/* ---- idle words ---------------------------------------------------------------------- */

check('with no lit smelter in reach it says so',
  idleSays({ why: 'range', n: 7 }, 'glass') === 'Idle: no lit smelter of yours within 7 tiles of the totem.', idleSays({ why: 'range', n: 7 }, 'glass'));
check('with no sand it says what it wants, off the recipe',
  idleSays({ why: 'stock', n: 0 }, 'glass') === `Idle: nothing in your settlement stores to melt into glass (needs ${SAND} sand).`, idleSays({ why: 'stock', n: 0 }, 'glass'));

/* ---- on the island ------------------------------------------------------------------- */

const g0 = Game.create(4261);
{
  const c = g0.creatures.spawn(ID, g0.player.x + 1, g0.player.y, 'active', g0.rand, g0.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.skills = {};
  check('it says what it will do in the island\'s words', words(deedJobLine(c)) === words(at('LINE')), `${deedJobLine(c)} / ${at('LINE')}`);
}
for (const { k, after: want, why } of CASES) {
  const [stores, idle, skill] = at(`MADE:${k}`).split('|');
  check(`on the island, ${k.toLowerCase()}: the stores hold ${want}${why ? `, idle: ${why}` : ''}`, stores === want && (!why || idle === why), at(`MADE:${k}`));
  if (k === 'LIT') check('on the island, it learns glassblowing as it works', Number(skill) > 1, skill);
}

/* ---- in the browser ------------------------------------------------------------------ */

const body = (): Game => {
  const g = Game.create(4263);
  const w = g.world;
  for (let y = 10; y <= 34; y++) for (let x = 10; x <= 36; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 10; y <= 33; y++) for (let x = 10; x <= 35; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Glassend', x: 20, y: 20, radius: 6, level: 2 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  return g;
};
const run = (g: Game, secs: number): void => {
  for (let i = 0; i < secs * 10; i++) {
    g.time += 0.1;
    g.creatures.update(0.1, g);
  }
};
const inCrate = (crate: ReturnType<Game['addCrate']>): string => {
  const n = new Map<string, number>();
  for (const i of crate.items) n.set(i.id, (n.get(i.id) ?? 0) + i.count);
  return [...n].filter(([, k]) => k > 0).map(([id, k]) => `${id} ${k}`).sort().join(',') || '-';
};
for (const { k, at: st, sand, level, after: want, why } of CASES) {
  const g = body();
  const crate = g.addCrate('plank', 21, 20, 0, 0, sand ? [{ uid: g.inventory.nextUid++, id: 'sand', ql: 30, dmg: 0, count: sand }] : [], true);
  if (st !== 'none') {
    const s = g.addSmelter(st === 'far' ? 33 : 23, 21, 0, 0, 50);
    s.lit = st !== 'unlit';
    s.fuel = 100000;
    if (st === 'charged') s.jobs.push({ item: { uid: g.inventory.nextUid++, id: 'iron_ore', ql: 30, dmg: 0, count: 1 }, makes: 'iron_lump', left: 600, total: 600, ql: 30 });
  }
  const c: Creature = g.creatures.spawn(ID, 20.5, 21.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  c.skills = level ? { [GATHER_SKILL.glass]: level } : {};
  run(g, 120);
  check(`in the browser, ${k.toLowerCase()}: the stores hold ${want}${why ? `, idle: ${why}` : ''}`, inCrate(crate) === want && (!why || c.idle?.why === why),
    `${inCrate(crate)} ${c.idle?.why}`);
  if (k === 'LIT') check('in the browser, it learns glassblowing as it works', (c.skills[GATHER_SKILL.glass] ?? 0) > 1, String(c.skills[GATHER_SKILL.glass]));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nglassblower — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
