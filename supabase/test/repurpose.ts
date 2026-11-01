/**
 * Twelve kinds take up a new settlement task.
 *
 * Asked for, as a plan: a dulla cuts moss, a rootle plants vines, a spitta plants water lilies and lotus, a crakka
 * mixes concrete, a glossa mortar, a carra saws timbers, an awla carves shafts, a scorcha mixes alloys at a lit
 * smelter, a leecha makes bandages, covers and salves, a frosta presses cheese, a whirla churns butter and a brittla
 * distils. Each does what your own hands do, out of the settlement stores and back into them: the same inputs, amounts
 * and outputs as the player's own rule, no tool, levelling the skill that rule trains. No worker glazes or butchers any
 * more. The ten of them that kept watch no longer do, and have no ability or fighting style. And the ten guards that
 * were not revamped are gone: an owned one becomes one of these, by fit (`REMOVED_KINDS`), and keeps everything but
 * its kind; a wild one is gone; none stands up wild or is bred again.
 *
 * Asked of both sides: each kind's trade, skill, words and learning pace are the same; set to work, each takes what
 * its recipe takes out of the stores and puts what it makes (and hands back) in, as the recipe says, only where its
 * station is (a butter churn, a lit smelter, a lit campfire), and says why it stands idle where it is not; an alloy
 * comes out at its lumps' quality as your own hands' does; moss is cut and carried home; a grape cutting is planted at
 * a trellis with no vine on soil, and no other; a water lily root and lotus seeds are planted in still water deep
 * enough; a carcass and a bare pot are left as they are. And a Spiralphant, an awla at its third stage, carves its line's
 * one more shaft from each log (`STAGE_PERKS`), on both sides.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import {
  ALLOY_QL, EVOLVE_AT, GATHER_DO, perkN, stageLoads, STAGE_PERKS, GATHER_SKILL, HANDS_TRADES, kindNow, LEARN_PACE, LOAD_TRADES, REMOVED_KINDS, sparsAsGuard, SPECIES, TEND_JOBS, tradeRecipes, WILD_SPECIES,
  workerSkipsTools, type Creature, type GatherKind,
} from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { corpseSpecies } from '../../src/game/butcher';
import { readFileSync } from 'node:fs';
import { ACTION_BY_ID } from '../../src/game/actions';
import { itemDef } from '../../src/game/items';
import { MOSS_PER_CUT } from '../../src/game/limits';
import { BUTTER_CHURN, CHURN_BUTTER } from '../../src/game/dairy';
import { GRAPE_CUTTING, PLANT_VINE, TRELLIS } from '../../src/game/vineyard';
import { WATER_PLANTS } from '../../src/world/waterplants';
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

/** Each kind, its new trade, and the action your own hands do it by (for the skill it trains). */
const KINDS: Array<[id: string, trade: GatherKind]> = [
  ['dulla', 'moss'], ['rootle', 'vine'], ['spitta', 'lily'], ['crakka', 'concrete'], ['glossa', 'mortar'], ['carra', 'timber'],
  ['awla', 'shaft'], ['scorcha', 'alloy'], ['leecha', 'bandage'], ['frosta', 'cheese'], ['whirla', 'churn'], ['brittla', 'distil'],
];
/** The ten that kept watch until now. */
const WERE_GUARDS = ['dulla', 'rootle', 'spitta', 'crakka', 'awla', 'scorcha', 'leecha', 'frosta', 'whirla', 'brittla'];
/** The ten guards taken out of the game, and the kind an owned one becomes, as asked. */
const GONE: Array<[id: string, becomes: string]> = [
  ['testa', 'crakka'], ['skulka', 'spitta'], ['gasha', 'carra'], ['hamma', 'awla'], ['bashka', 'glossa'],
  ['executa', 'carra'], ['shova', 'whirla'], ['howla', 'frosta'], ['marka', 'scorcha'], ['wardo', 'leecha'],
];
const GONE_LIST = GONE.map(([id]) => `'${id}'`).join(', ');
/** The action each tile trade does as your own hands do it. */
const OWN_ACTION: Partial<Record<GatherKind, string>> = { moss: 'cut_moss', vine: PLANT_VINE, lily: `plant_${WATER_PLANTS[0].id}` };
const RECIPE_TRADES: GatherKind[] = ['concrete', 'mortar', 'timber', 'shaft', 'alloy', 'bandage', 'cheese', 'churn', 'distil'];

/* ---- the recipe cases ------------------------------------------------------------- */

/** Where a case's worker works: no station, a butter churn, a smelter lit or not, a campfire lit or not. */
type Station = 'none' | 'churn' | 'smelter' | 'unlit' | 'campfire' | 'cold';
/** Each case: who, what is put in the stores, the station it stands by, and why it stands idle where it does. */
type Case = { k: string; id: string; put: Array<[string, number]>; at?: Station; why?: string };
const CASES: Case[] = [
  { k: 'CONCRETE', id: 'crakka', put: [['mortar', 3], ['ash', 2]] },
  { k: 'MORTAR', id: 'glossa', put: [['clay', 2], ['sand', 1]] },
  { k: 'TIMBER', id: 'carra', put: [['log', 2]] },
  { k: 'SHAFT', id: 'awla', put: [['log', 1]] },
  { k: 'BANDAGE', id: 'leecha', put: [['cloth', 1], ['thyme', 2], ['cotton', 1], ['basil', 2], ['wax', 1]] },
  { k: 'CHEESE', id: 'frosta', put: [['milk_bucket', 2]] },
  { k: 'CHURN', id: 'whirla', put: [['milk_bucket', 1]], at: 'churn' },
  { k: 'NOCHURN', id: 'whirla', put: [['milk_bucket', 1]], why: 'range' },
  { k: 'ALLOY', id: 'scorcha', put: [['copper_lump', 3], ['tin_lump', 1], ['zinc_lump', 1]], at: 'smelter' },
  { k: 'UNLIT', id: 'scorcha', put: [['copper_lump', 3], ['tin_lump', 1]], at: 'unlit', why: 'range' },
  { k: 'DISTIL', id: 'brittla', put: [['ale_bucket', 3], ['mead_bucket', 2]], at: 'campfire' },
  { k: 'COLD', id: 'brittla', put: [['ale_bucket', 3]], at: 'cold', why: 'range' },
  { k: 'NOSTOCK', id: 'crakka', put: [['mortar', 1]], why: 'stock' },
  // No worker butchers or glazes: a carra and a glossa leave a carcass, a bare pot and the ash for its glaze alone.
  { k: 'NOBUTCHER', id: 'carra', put: [['corpse', 1]], why: 'stock' },
  { k: 'NOGLAZE', id: 'glossa', put: [['clay_pot', 1], ['ash', 1]], why: 'stock' },
];
const tradeOf = (id: string): GatherKind => SPECIES[id].gathers!;
/** What a stack is called in the stores: its id, and what is stamped on it ("cover/Thyme"). */
const key = (id: string, extra?: string | null): string => (extra ? `${id}/${extra}` : id);
const listed = (m: Map<string, number>): string => [...m].filter(([, n]) => n > 0).map(([id, n]) => `${id} ${n}`).sort().join(',') || '-';
/**
 * The stores after a worker of this trade has worked every batch they hold the makings of, by the player's own rule:
 * the first of its recipes whose inputs are all there, each input's count out, what it makes (and what it stamps on
 * it) and what it hands back in, until none is.
 */
function worked(kind: GatherKind, put: Array<[string, number]>): string {
  const s = new Map<string, number>(put.map(([id, n]) => [id, n]));
  const add = (id: string, n: number): void => { s.set(id, (s.get(id) ?? 0) + n); };
  for (let i = 0; i < 50; i++) {
    const r = tradeRecipes(kind).map((id) => RECIPE_BY_ID.get(id)!).find((x) => x.inputs.every((inp) => (s.get(inp.item) ?? 0) >= (inp.count ?? 1)));
    if (!r) break;
    for (const inp of r.inputs) add(inp.item, -(inp.count ?? 1));
    add(key(r.result, r.extra), r.count ?? 1);
    for (const [id, n] of r.returns ?? []) add(id, n);
  }
  return listed(s);
}
const want = (c: Case): string => (c.why ? listed(new Map(c.put)) : worked(tradeOf(c.id), c.put));
/** One alloy batch's quality, by the player's rule, out of lumps all of this quality, at this smelting. */
const alloyQl = (lumps: number, skill: number): number => Math.max(1, Math.min(100, lumps * (ALLOY_QL[0] + skill / ALLOY_QL[1])));
const LUMP_QL = 30;

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f5';
const CRATE = 7601;
const stationAt = (at: Station | undefined): string => {
  if (at === 'churn') return `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', '${BUTTER_CHURN}', 19, 16, 0, 0, 19.25, 16.25, 30, u);`;
  if (at === 'smelter' || at === 'unlit') {
    return `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
      values (w, 'smelter', 19, 16, 0, 0, 19.75, 16.5, 50, 100000, ${at === 'smelter'}, now(), jsonb_build_object('jobs', '[]'::jsonb, 'output', '[]'::jsonb), u);`;
  }
  if (at === 'campfire' || at === 'cold') {
    return `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by)
      values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, ${at === 'campfire' ? 3000 : 0}, 0, ${at === 'campfire'}, now(), u);`;
  }
  return '';
};
const stocked = (put: Array<[string, number]>): string => put.map(([id, n]) => (itemDef(id).stackable
  ? `insert into item (world_id, holder, crate, def, ql, count${id === 'corpse' ? ', extra' : ''}) values (w, 'crate', ${CRATE}, '${id}', ${LUMP_QL}, ${n}${id === 'corpse' ? ", 'Rabba'" : ''});`
  : `insert into item (world_id, holder, crate, def, ql, count${id === 'corpse' ? ', extra' : ''}) select w, 'crate', ${CRATE}, '${id}', ${LUMP_QL}, 1${id === 'corpse' ? ", 'Rabba'" : ''} from generate_series(1, ${n});`)).join('\n  ');
const held = `coalesce((select string_agg(k || ' ' || n, ',' order by k) from (select def || coalesce('/' || extra, '') as k, sum(count) as n
  from item where world_id = w and holder = 'crate' and crate = ${CRATE} and def <> 'corpse' group by 1
  union all select 'corpse', sum(count) from item where world_id = w and holder = 'crate' and crate = ${CRATE} and def = 'corpse' having sum(count) > 0) q), '-')`;
const ready = (who: string): string => `
  update creature set mode = 'deed', carrying = null, skills = '{}'::jsonb, traits = '{}'::text[], stance = 'passive', hunger = 1,
         until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle', idle_why = null,
         work_x = null, work_y = null, from_x = 16.6, from_y = 16.6, to_x = 16.6, to_y = 16.6
   where world_id = w and id = (select id from hand where species = '${who}');
  perform worker_settle(w, (select id from hand where species = '${who}'));`;
const after = (who: string): string => `update creature set mode = 'stored' where world_id = w and id = (select id from hand where species = '${who}');
  delete from item where world_id = w and holder = 'crate' and crate = ${CRATE};
  delete from placed where world_id = w;
  delete from water_plant where world_id = w;`;
const all = KINDS.map(([id]) => id);

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table hand (species text, id int);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Twelvefold', 405, 48, 16, 16, true) returning id into w;
  perform land_blank(w, 48);
  perform land_set_height(w, x, y, 4) from generate_series(0, 48) x, generate_series(0, 48) y;
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 47) x, generate_series(0, 47) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Twelvefold', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, ${CRATE}, 'plank', 17, 16, 0, 0, true, u);

  -- Each kind's trade and how the island takes it, and its words.
  insert into said select 'TRADE:' || s.id, coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-')) || '|' || tend_job(coalesce(s.gathers, '-'))
      || '|' || hands_trade(coalesce(s.gathers, '-')) || '|' || load_trade(coalesce(s.gathers, '-')) || '|' || coalesce(s.ability, '-') || '|' || coalesce(s.style, '-')
      || '|' || s.description
    from species_def s where s.id in (${all.map((id) => `'${id}'`).join(', ')});
  insert into said select 'SKILL:' || g.id, g.skill || '|' || g.plain from gather_def g where g.id in (${KINDS.map(([, t]) => `'${t}'`).join(', ')});
  insert into said select 'PACE:' || p.id, p.pace::text from learn_pace_def p where p.id in (${KINDS.map(([, t]) => `'${t}'`).join(', ')});
  insert into said select 'RECIPES:' || k, array_to_string(tend_recipes(k), ',') from unnest(array[${RECIPE_TRADES.map((t) => `'${t}'`).join(', ')}]) k;
  insert into said select 'RECIPE:' || r.id, r.result || ' ' || r.count || coalesce('/' || r.extra, '') || '|' || r.skill || '|' || coalesce(r.station, '-') || '|'
      || (select string_agg(ri.item || ' ' || ri.count, ',' order by ri.ord) from recipe_input ri where ri.recipe = r.id) || '|'
      || coalesce((select string_agg(g.item || ' ' || g.count, ',' order by g.item) from recipe_gives g where g.recipe = r.id and g.kind = 'return'), '-')
    from recipe r where r.id in (select unnest(tend_recipes(k)) from unnest(array[${RECIPE_TRADES.map((t) => `'${t}'`).join(', ')}]) k);
  -- The ten guards that are gone: nowhere in the definitions, and none on the island.
  insert into said select 'GONE', (select count(*) from species_def where id in (${GONE_LIST})) || '|' || (select count(*) from wild_table where species in (${GONE_LIST}))
      || '|' || (select count(*) from species_butcher where species in (${GONE_LIST})) || '|' || (select count(*) from species_diet where species in (${GONE_LIST}))
      || '|' || (select count(*) from creature where species in (${GONE_LIST})) || '|' || (select count(*) from guide where species in (${GONE_LIST}))
      || '|' || (select count(*) from bred_record where species in (${GONE_LIST}));
  insert into said select 'KINDNOW', string_agg(k || ':' || coalesce(private.kind_now(k), '-'), ',' order by k) from unnest(array[${GONE_LIST}, 'crakka']) k;
  -- No glazing and no butchering left anywhere a worker could be set to.
  insert into said select 'NOGLAZE', (select count(*) from species_def where gathers in ('glaze', 'butcher') or 'glaze' = any(coalesce(trades, '{}')) or 'butcher' = any(coalesce(trades, '{}')))
      || '|' || (select count(*) from gather_def where id in ('glaze', 'butcher')) || '|' || (select count(*) from learn_pace_def where id in ('glaze', 'butcher'))
      || '|' || (tend_job('glaze') or tend_job('butcher') or hands_trade('glaze') or hands_trade('butcher') or worker_job_ported('glaze') or worker_job_ported('butcher'))
      || '|' || (select bool_or(p.prosrc ~ 'kind = ''(glaze|butcher)''') from pg_proc p where p.proname in ('errand_step', 'errand_do'));

  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '60 days', u) from unnest(array[${all.map((id) => `'${id}'`).join(', ')}]) s;
  insert into said select 'ASK:' || h.species, coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', h.id)), 'none') from hand h;
  update creature set mode = 'deed', stance = 'passive', hunger = 1, from_x = to_x, from_y = to_y, skills = '{}'::jsonb where world_id = w and id in (select id from hand);
  insert into said select 'LINE:' || h.species, deed_job_line(c2) from hand h join creature c2 on c2.world_id = w and c2.id = h.id;
  -- A Sparra of yours spars with a guard of yours on the settlement: never with one of these, as with a testa.
  insert into hand values ('sparra', creature_spawn(w, 'sparra', 16.6, 16.6, 'active', now() - interval '60 days', u)),
                          ('thumpa', creature_spawn(w, 'thumpa', 16.6, 16.6, 'active', now() - interval '60 days', u));
  update creature set mode = 'deed', stance = 'passive', hunger = 1, from_x = to_x, from_y = to_y where world_id = w and id in (select id from hand where species in ('sparra', 'thumpa'));
  insert into said select 'SPAR:' || h.species, spar_may(w, g2, s2, 16, 16)::text
    from hand h join creature g2 on g2.world_id = w and g2.id = h.id, creature s2
   where s2.world_id = w and s2.id = (select id from hand where species = 'sparra') and h.species in (${[...WERE_GUARDS, 'thumpa'].map((id) => `'${id}'`).join(', ')});
  update creature set mode = 'stored' where world_id = w and id in (select id from hand);
${CASES.map((c) => `
  -- ${c.k}.
  ${stocked(c.put)}
  ${stationAt(c.at)}
  ${ready(c.id)}
  insert into said select 'MADE:${c.k}', ${held} || '|' || coalesce((select idle_why from creature where world_id = w and id = (select id from hand where species = '${c.id}')), '-')
      || '|' || coalesce((select skills->>'${GATHER_SKILL[tradeOf(c.id)]}' from creature where world_id = w and id = (select id from hand where species = '${c.id}')), '-')
      || '|' || coalesce((select round(min(ql)::numeric, 3)::text || ',' || round(max(ql)::numeric, 3)::text from item where world_id = w and holder = 'crate' and crate = ${CRATE} and def = 'bronze_lump'), '-');
  ${after(c.id)}`).join('\n')}

  -- MOSS: two moss tiles among the grass, cut and carried home; the grass left as it is.
  perform land_set_tile(w, 19, 18, tile_id('Moss')), land_set_tile(w, 20, 18, tile_id('Moss'));
  ${ready('dulla')}
  insert into said select 'MOSS', ${held} || '|' || is_foraged(w, 19, 18, 'moss') || ',' || is_foraged(w, 20, 18, 'moss') || '|'
      || coalesce((select skills->>'${GATHER_SKILL.moss}' from creature where world_id = w and id = (select id from hand where species = 'dulla')), '-');
  ${after('dulla')}

  -- SPIRALPHANT: an awla at its third stage carves its line's more shafts from each log, two logs in one go.
  ${stocked([['log', 2]])}
  ${ready('awla').replace("skills = '{}'::jsonb", `skills = '{"${GATHER_SKILL.shaft}": ${EVOLVE_AT[1] + 5}}'::jsonb`)}
  insert into said select 'SPIRALPHANT', ${held} || '|' || (select stage_of(c2) from creature c2 where c2.world_id = w and c2.id = (select id from hand where species = 'awla'));
  ${after('awla')}

  -- VINE: a trellis on grass with no vine, one with a vine already, one on sand; three cuttings.
  perform land_set_tile(w, 21, 14, tile_id('Sand'));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, material) values
    (w, 'furniture', '${TRELLIS}', 19, 14, 0, 0, 19.5, 14.1, 30, u, 'n', 'Oak'),
    (w, 'furniture', '${TRELLIS}', 20, 14, 0, 0, 20.5, 14.1, 30, u, 'n', 'Oak'),
    (w, 'furniture', '${TRELLIS}', 21, 14, 0, 0, 21.5, 14.1, 30, u, 'n', 'Oak');
  update placed set vine_at = 1000 where world_id = w and x = 20 and y = 14;
  ${stocked([[GRAPE_CUTTING, 3]])}
  ${ready('rootle')}
  insert into said select 'VINE', ${held} || '|' || (select string_agg(x || ':' || coalesce((vine_at = 1000)::text, 'none'), ',' order by x) from placed where world_id = w and sub = '${TRELLIS}')
      || '|' || coalesce((select skills->>'${GATHER_SKILL.vine}' from creature where world_id = w and id = (select id from hand where species = 'rootle')), '-');
  ${after('rootle')}

  -- LILY: a pool of sea five deep, tiles 20..22 by 18..20 whole, its rim shallow; a lily root and lotus seeds.
  perform land_set_height(w, x, y, -5) from generate_series(20, 23) x, generate_series(18, 21) y;
  ${stocked(WATER_PLANTS.map((d) => [d.from, 1] as [string, number]))}
  ${ready('spitta')}
  insert into said select 'LILY', ${held} || '|' || coalesce((select string_agg(x || ',' || y, ' ' order by y, x) from water_plant where world_id = w), '-')
      || '|' || coalesce((select string_agg(kind, ',' order by kind) from water_plant where world_id = w), '-')
      || '|' || coalesce((select bool_and(planted_by = u)::text from water_plant where world_id = w), '-')
      || '|' || coalesce((select skills->>'${GATHER_SKILL.lily}' from creature where world_id = w and id = (select id from hand where species = 'spitta')), '-');
  ${after('spitta')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const words = (s: string): string => s.replace(/\d+(\.\d+)?/g, 'N');

/* ---- the kinds, their trades and their words ---------------------------------------- */

for (const [id, trade] of KINDS) {
  const d = SPECIES[id];
  const recipe = RECIPE_TRADES.includes(trade);
  const [gathers, ported, tend, hands, load, ability, style, description] = at(`TRADE:${id}`).split('|');
  check(`a ${d.name}'s trade is ${trade} on both sides, and the island works it`, d.gathers === trade && gathers === trade && ported === 'true', at(`TRADE:${id}`));
  check(`a ${d.name} works at the stores or at your own (${trade === 'moss' ? 'no: it walks out' : 'yes'}), its stage's ${recipe ? 'batches a go' : 'loads a trip'}, on both sides`,
    TEND_JOBS.has(trade) === (trade !== 'moss') && tend === String(trade !== 'moss') && HANDS_TRADES.has(trade) === recipe && hands === String(recipe)
      && LOAD_TRADES.has(trade) === !recipe && load === String(!recipe), at(`TRADE:${id}`));
  check(`a ${d.name} has no ability and no fighting style, and does not guard, on both sides`,
    !d.ability && !d.style && ability === '-' && style === '-' && d.gathers !== 'guard' && !sparsAsGuard({ species: id, trade: null }), at(`TRADE:${id}`));
  check(`a ${d.name}'s words are its task's, the same on both sides, filled in`,
    description === d.description && d.description.includes('Settlement task: ') && !/[{}]|undefined|NaN/.test(d.description), d.description);
  check(`a ${d.name} may be set to work a settlement`, at(`ASK:${id}`) === 'none', at(`ASK:${id}`));
  check(`a ${d.name}'s trade levels ${GATHER_SKILL[trade]}, its words the same on both sides`, at(`SKILL:${trade}`) === `${GATHER_SKILL[trade]}|${GATHER_DO[trade]}`, at(`SKILL:${trade}`));
  check(`its learning pace is the same on both sides: ${LEARN_PACE[trade]}`, Number(at(`PACE:${trade}`)) === LEARN_PACE[trade], at(`PACE:${trade}`));
  check('the help names it among the settlement\'s hands', helpText().includes(`<b>${d.name}</b> (taming ${d.tameLevel}): ${GATHER_DO[trade]}`));
  const own = OWN_ACTION[trade];
  if (own) check(`its skill is what your own hands train at it: ${ACTION_BY_ID.get(own)?.skill}`, ACTION_BY_ID.get(own)?.skill === GATHER_SKILL[trade]);
}
for (const id of WERE_GUARDS) check(`on the island, a ${SPECIES[id].name} is not a guard a Sparra may spar with`, at(`SPAR:${id}`) === 'false', at(`SPAR:${id}`));
check('and a thumpa still is', at('SPAR:thumpa') === 'true', at('SPAR:thumpa'));
const g0 = Game.create(4405);
for (const [id] of KINDS) {
  const c = g0.creatures.spawn(id, g0.player.x + 1, g0.player.y, 'active', g0.rand, g0.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.skills = {};
  check(`a ${SPECIES[id].name} says what it will do in the island's words`, words(deedJobLine(c)) === words(at(`LINE:${id}`)), `${deedJobLine(c)} / ${at(`LINE:${id}`)}`);
}

/* ---- the recipes: the player's own ------------------------------------------------- */

for (const trade of RECIPE_TRADES) {
  const ids = tradeRecipes(trade);
  check(`a ${trade} trade works the same recipes on both sides, in the same order: ${ids.join(', ')}`, at(`RECIPES:${trade}`) === ids.join(','), at(`RECIPES:${trade}`));
  for (const rid of ids) {
    const r = RECIPE_BY_ID.get(rid)!;
    const mine = `${r.result} ${r.count ?? 1}${r.extra ? `/${r.extra}` : ''}|${r.skill}|${r.station ?? '-'}|${r.inputs.map((i) => `${i.item} ${i.count ?? 1}`).join(',')}|`
      + `${(r.returns ?? []).map(([i, n]) => `${i} ${n}`).sort().join(',') || '-'}`;
    check(`${rid} is the player's own recipe on both sides, and trains ${GATHER_SKILL[trade]}`, at(`RECIPE:${rid}`) === mine && r.skill === GATHER_SKILL[trade], `${at(`RECIPE:${rid}`)} / ${mine}`);
  }
}
check('the recipes are the player\'s: concrete, mortar, timbers, shafts, the five alloys, bandages, covers and salves, cheese, butter and every distilling',
  tradeRecipes('concrete').join() === 'mix_concrete' && tradeRecipes('mortar').join() === 'make_mortar' && tradeRecipes('timber').join() === 'make_timbers'
    && tradeRecipes('shaft').join() === 'make_shafts' && tradeRecipes('alloy').join() === 'make_bronze,make_brass,make_steel,make_pewter,make_electrum'
    && tradeRecipes('cheese').join() === 'make_cheese' && tradeRecipes('churn').join() === CHURN_BUTTER
    && tradeRecipes('bandage')[0] === 'make_bandage' && tradeRecipes('bandage').filter((r) => r.startsWith('make_cover_')).length === 5
    && tradeRecipes('bandage').filter((r) => r.startsWith('make_salve_')).length === 5
    && tradeRecipes('distil').join() === 'distil_ale,distil_cider,distil_mead,distil_wine,distil_grape_wine');
check('stations: a butter churn for butter, a smelter for the alloys, a campfire for distilling, none for the rest',
  RECIPE_BY_ID.get(CHURN_BUTTER)?.station === BUTTER_CHURN && tradeRecipes('alloy').every((r) => RECIPE_BY_ID.get(r)?.station === 'smelter')
    && tradeRecipes('distil').every((r) => RECIPE_BY_ID.get(r)?.station === 'campfire')
    && (['concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese'] as GatherKind[]).every((t) => tradeRecipes(t).every((r) => !RECIPE_BY_ID.get(r)?.station)));
check('no tool for any of them: the saw, the carving knife, the clay bowl and the clay pot are among what no worker needs',
  ['saw', 'carving_knife', 'clay_bowl', 'clay_pot'].every((t) => workerSkipsTools().includes(itemDef(t).name.toLowerCase())), workerSkipsTools().join(', '));

/* ---- no glazing, no butchering, and the guards ----------------------------------------- */

check('no worker glazes or butchers, on either side', !Object.values(SPECIES).some((d) => (d.gathers as string) === 'glaze' || (d.gathers as string) === 'butcher'
    || (d.trades ?? []).some((t) => (t as string) === 'glaze' || (t as string) === 'butcher'))
  && !('glaze' in GATHER_SKILL) && !('butcher' in GATHER_SKILL) && at('NOGLAZE') === '0|0|0|false|false', at('NOGLAZE'));
check('the ten guards are gone from both sides: no kind, no wild weight, no carcass, no bait, none on the island, nothing in a guide or the stud book',
  GONE.every(([id]) => !SPECIES[id] && !WILD_SPECIES.some(([w]) => w === id)) && at('GONE') === '0|0|0|0|0|0|0', at('GONE'));
check('each owned one becomes the kind asked, on both sides', GONE.every(([id, to]) => REMOVED_KINDS[id]?.becomes === to && kindNow(id) === to && !!SPECIES[to])
  && at('KINDNOW') === [...GONE.map(([id, to]) => `${id}:${to}`), 'crakka:-'].sort().join(','), at('KINDNOW'));
check('an old carcass of one is a carcass of the kind it became, in the browser',
  GONE.every(([id, to]) => corpseSpecies({ uid: 1, id: 'corpse', ql: 30, dmg: 0, count: 1, extra: REMOVED_KINDS[id].name })?.id === to));

/* ---- what each does, on the island ------------------------------------------------------ */

for (const c of CASES) {
  const [stores, idle, skill, ql] = at(`MADE:${c.k}`).split('|');
  check(`on the island, ${c.k.toLowerCase()}: the stores hold ${want(c)}${c.why ? `, idle: ${c.why}` : ''}`, stores === want(c) && (!c.why || idle === c.why), at(`MADE:${c.k}`));
  if (!c.why) check(`on the island, ${c.k.toLowerCase()}: it learns ${GATHER_SKILL[tradeOf(c.id)]}`, Number(skill) > 1, skill);
  if (c.k === 'ALLOY') {
    const [lo, hi] = ql.split(',').map(Number);
    check(`on the island, the bronze comes out at its lumps' quality as your own hands' does: ${alloyQl(LUMP_QL, 1).toFixed(3)}`,
      Math.abs(lo - alloyQl(LUMP_QL, 1)) < 0.01 && Math.abs(hi - alloyQl(LUMP_QL, 1)) < 0.01, ql);
  }
}
{
  const [stores, cut, skill] = at('MOSS').split('|');
  check(`on the island, a dulla cuts both moss tiles, ${MOSS_PER_CUT} a tile, and carries it home; no grass`,
    stores === `moss ${2 * MOSS_PER_CUT}` && cut === 'true,true' && Number(skill) > 1, at('MOSS'));
}
{
  // Two logs, both carved in the one go at its stage's batches, each its recipe's shafts and its line's one more.
  const each = RECIPE_BY_ID.get('make_shafts')!.count! + STAGE_PERKS.awla.n;
  const [stores, stage] = at('SPIRALPHANT').split('|');
  check(`on the island, a ${SPECIES.awla.stages![1].name} carves ${each} shafts from a log (its recipe's ${RECIPE_BY_ID.get('make_shafts')!.count} and ${STAGE_PERKS.awla.n} more)`,
    STAGE_PERKS.awla.kind === 'more' && stores === `shaft ${2 * each}` && stage === '2', at('SPIRALPHANT'));
}
{
  const [stores, vines] = at('VINE').split('|');
  check('on the island, a rootle plants a cutting at the trellis on grass with no vine, and none at the one with a vine or the one on sand',
    stores === `${GRAPE_CUTTING} 2` && vines === '19:false,20:true,21:none', at('VINE'));
}
const LILY_SPOTS = '20,18 20,19';
{
  const [stores, spots, kinds, mine] = at('LILY').split('|');
  check(`on the island, a spitta plants the lily root and the lotus seeds in the deep water, ring by ring from the totem: ${LILY_SPOTS}`,
    stores === '-' && spots === LILY_SPOTS && kinds === WATER_PLANTS.map((d) => d.id).sort().join(',') && mine === 'true', at('LILY'));
}

/* ---- the conversion, on the island ---------------------------------------------------- */

/*
 * The migration that takes them out, run again on a world that holds them: an owned one of each of the ten, named and
 * levelled, with an ability's rest on it; a wild gasha that a crakka of yours is fighting; a Testa carcass; a guide
 * that has seen a testa and tamed a gasha; stud book records for a testa and for a gasha and an executa, which both
 * become carras. Run twice, as a deploy might: the second time finds nothing to do.
 */
const MIGRATION = readFileSync('supabase/migrations/20261101100001_the_ten_guards_are_gone.sql', 'utf8');
const MARA = '7e5b0000-0000-4000-8000-0000000000f6';
const conv = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table kept (was text, id int);
create temp table wld (w uuid, u uuid, wild int, fighter int);
do $t$
declare w uuid; u uuid := '${MARA}'; v_id int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Tenfold', 406, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mara');
${GONE.map(([id]) => `  v_id := creature_spawn(w, 'crakka', 16.6, 16.6, 'active', now() - interval '60 days', u);
  update creature set species = '${id}', name = 'My ${id}', skills = '{"body_strength": 31.5, "fighting": 7}'::jsonb, traits = '{hardy}', health = 17
   where world_id = w and id = v_id;
  insert into kept values ('${id}', v_id);
  insert into class_mark (world_id, creature_id, kind, val, until) values (w, v_id, 'ability', 1, now() + interval '1 hour');`).join('\n')}
  insert into wld select w, u, creature_spawn(w, 'carra', 20.5, 20.5, 'wild', now() - interval '60 days', null),
                         creature_spawn(w, 'crakka', 19.5, 20.5, 'active', now() - interval '60 days', u);
  update creature set species = 'gasha' where world_id = w and id = (select wild from wld);
  update creature set enemy = (select wild from wld) where world_id = w and id = (select fighter from wld);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7602, 'plank', 17, 16, 0, 0, false, u);
  insert into item (world_id, holder, crate, def, ql, count, extra) values (w, 'crate', 7602, 'corpse', 30, 1, 'Testa');
  insert into guide (world_id, uid, species, tamed) values (w, u, 'testa', false), (w, u, 'gasha', true), (w, u, 'carra', false);
  insert into bred_record (world_id, species, stat, value, creature_id, name, breeder, born_at) values
    (w, 'testa', 'hardy', 3, 1, 'Old Testa', u, now()), (w, 'gasha', 'tough', 2, 2, 'Gash', u, now()), (w, 'executa', 'tough', 5, 3, 'Exe', u, now());
end $t$;
${MIGRATION}
${MIGRATION}
do $t$
declare w uuid := (select wld.w from wld); u uuid := (select wld.u from wld);
begin
  insert into said select 'TURNED:' || k.was, c.species || '|' || c.name || '|' || (c.keeper = u) || '|' || (c.skills->>'body_strength') || '|' || (c.skills->>'fighting')
      || '|' || coalesce(c.skills->>(select g.skill from gather_def g join species_def sd on sd.gathers = g.id where sd.id = c.species), '-')
      || '|' || array_to_string(c.traits, ',') || '|' || c.health || '|' || creature_level(c.skills)
      || '|' || (select count(*) from class_mark m where m.world_id = w and m.creature_id = c.id)
    from kept k join creature c on c.world_id = w and c.id = k.id;
  insert into said select 'WILD', (select count(*) from creature where world_id = w and id = (select wild from wld)) || '|'
      || coalesce((select enemy::text from creature where world_id = w and id = (select fighter from wld)), '-');
  insert into said select 'CORPSE', string_agg(extra, ',') from item where world_id = w and def = 'corpse';
  insert into said select 'GUIDE', string_agg(species || ':' || tamed, ',' order by species) from guide where world_id = w and uid = u;
  insert into said select 'STUD', string_agg(species || ':' || stat || ':' || value || ':' || name, ',' order by species, stat) from bred_record where world_id = w;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const conved = new Map(conv.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const cv = (k: string): string => conved.get(k) ?? '(not said)';
for (const [id, to] of GONE) {
  const [kind, name, mine, body, fighting, trade, traits, health, level, marks] = cv(`TURNED:${id}`).split('|');
  check(`an owned ${REMOVED_KINDS[id].name} becomes a ${SPECIES[to].name}, its name, keeper, skills, traits, health and level kept, its level in its new trade's skill, its ability's rest gone`,
    kind === to && name === `My ${id}` && mine === 'true' && body === '31.5' && fighting === '7' && trade === '31.5' && traits === 'hardy'
      && health === '17' && level === '31' && marks === '0', cv(`TURNED:${id}`));
}
check('a wild one is gone, and the crakka fighting it fights nothing', cv('WILD') === '0|-', cv('WILD'));
check('a Testa carcass is a Crakka carcass', cv('CORPSE') === SPECIES.crakka.name, cv('CORPSE'));
check('the guide has seen a crakka and a carra and tamed a carra, and nothing of a testa or a gasha', cv('GUIDE') === 'carra:true,crakka:false', cv('GUIDE'));
check('the stud book holds the testa\'s record as a crakka\'s, and the better of the gasha\'s and the executa\'s as a carra\'s',
  cv('STUD') === 'carra:tough:5:Exe,crakka:hardy:3:Old Testa', cv('STUD'));

/* ---- idle words ------------------------------------------------------------------------- */

check('with no butter churn it says so', idleSays({ why: 'range', n: 7 }, 'churn') === 'Idle: no butter churn of yours within 7 tiles of the totem.', idleSays({ why: 'range', n: 7 }, 'churn'));
check('with no makings it says what it wants, off the recipe',
  idleSays({ why: 'stock', n: 0 }, 'concrete').startsWith('Idle: nothing in your settlement stores to mix into concrete (needs ')
    && idleSays({ why: 'stock', n: 0 }, 'concrete').includes(itemDef('mortar').name.toLowerCase()), idleSays({ why: 'stock', n: 0 }, 'concrete'));

/* ---- in the browser --------------------------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4407);
  const w = g.world;
  for (let y = 4; y <= 30; y++) for (let x = 4; x <= 30; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 4; y <= 29; y++) for (let x = 4; x <= 29; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 16.5;
  g.player.y = 16.5;
  g.deed = { name: 'Twelvefold', x: 16, y: 16, radius: 8, level: 3 };
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
  for (const i of crate.items) {
    const k = i.id === 'corpse' ? 'corpse' : key(i.id, i.extra);
    n.set(k, (n.get(k) ?? 0) + i.count);
  }
  return listed(n);
};
const stock = (g: Game, put: Array<[string, number]>): ReturnType<Game['addCrate']> => g.addCrate('plank', 17, 16, 0, 0,
  put.flatMap(([id, n]) => (itemDef(id).stackable ? [[id, n]] : Array.from({ length: n }, () => [id, 1])) as Array<[string, number]>)
    .map(([id, n]) => ({ uid: g.inventory.nextUid++, id, ql: LUMP_QL, dmg: 0, count: n, ...(id === 'corpse' ? { extra: 'Rabba' } : {}) })), true);
const worker = (g: Game, id: string): Creature => {
  const c = g.creatures.spawn(id, 16.6, 16.6, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  c.skills = {};
  c.traits = [];
  return c;
};
for (const k of CASES) {
  const g = body();
  const crate = stock(g, k.put);
  if (k.at === 'churn') g.addFurniture(BUTTER_CHURN, 19, 16, 0, 0, 30);
  if (k.at === 'smelter' || k.at === 'unlit') {
    const s = g.addSmelter(19, 16, 0, 0, 50);
    s.lit = k.at === 'smelter';
    s.fuel = 100000;
  }
  if (k.at === 'campfire' || k.at === 'cold') g.addCampfire(19, 16, 0, 0, k.at === 'campfire' ? 3000 : 0, k.at === 'campfire');
  const c = worker(g, k.id);
  run(g, 120);
  check(`in the browser, ${k.k.toLowerCase()}: the stores hold ${want(k)}${k.why ? `, idle: ${k.why}` : ''}`, inCrate(crate) === want(k) && (!k.why || c.idle?.why === k.why),
    `${inCrate(crate)} ${c.idle?.why}`);
  if (!k.why) check(`in the browser, ${k.k.toLowerCase()}: it learns ${GATHER_SKILL[tradeOf(k.id)]}`, (c.skills[GATHER_SKILL[tradeOf(k.id)]] ?? 0) > 1);
  if (k.k === 'ALLOY') {
    const qls = crate.items.filter((i) => i.id === 'bronze_lump').map((i) => i.ql);
    check(`in the browser, the bronze comes out at its lumps' quality as your own hands' does: ${alloyQl(LUMP_QL, 1).toFixed(3)}`,
      qls.length > 0 && qls.every((q) => Math.abs(q - alloyQl(LUMP_QL, 1)) < 0.01), qls.join(','));
  }
}
{
  const g = body();
  g.world.setTile(19, 18, TileType.Moss, 0);
  g.world.setTile(20, 18, TileType.Moss, 0);
  const crate = stock(g, []);
  const c = worker(g, 'dulla');
  run(g, 180);
  check(`in the browser, a dulla cuts both moss tiles, ${MOSS_PER_CUT} a tile, and carries it home; no grass`,
    inCrate(crate) === `moss ${2 * MOSS_PER_CUT}` && g.isForaged(19, 18, 'moss') && g.isForaged(20, 18, 'moss') && (c.skills[GATHER_SKILL.moss] ?? 0) > 1, inCrate(crate));
}
{
  const g = body();
  const crate = stock(g, [['log', 2]]);
  const c = worker(g, 'awla');
  c.skills = { [GATHER_SKILL.shaft]: EVOLVE_AT[1] + 5 };
  run(g, 120);
  const each = RECIPE_BY_ID.get('make_shafts')!.count! + STAGE_PERKS.awla.n;
  check(`in the browser, a ${SPECIES.awla.stages![1].name} carves ${each} shafts from a log, both logs in one go`,
    perkN(c, 'more') === STAGE_PERKS.awla.n && stageLoads(c) >= 2 && inCrate(crate) === `shaft ${2 * each}`, inCrate(crate));
}
{
  const g = body();
  g.world.setTile(21, 14, TileType.Sand, 0);
  const t = [19, 20, 21].map((x) => g.addFurniture(TRELLIS, x, 14, 0, 0, 30, [], 'Oak', 'n'));
  t[1].vineAt = 1000;
  const crate = stock(g, [[GRAPE_CUTTING, 3]]);
  worker(g, 'rootle');
  run(g, 120);
  check('in the browser, a rootle plants a cutting at the trellis on grass with no vine, and none at the one with a vine or the one on sand',
    inCrate(crate) === `${GRAPE_CUTTING} 2` && t[0].vineAt !== undefined && t[0].vineAt !== 1000 && t[1].vineAt === 1000 && t[2].vineAt === undefined,
    `${inCrate(crate)} ${t.map((f) => f.vineAt).join(',')}`);
}
{
  const g = body();
  for (let y = 18; y <= 21; y++) for (let x = 20; x <= 23; x++) g.world.setHeight(x, y, -5);
  const crate = stock(g, WATER_PLANTS.map((d) => [d.from, 1] as [string, number]));
  worker(g, 'spitta');
  run(g, 180);
  const planted: string[] = [];
  const kinds: string[] = [];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const p = g.waterPlantAt(x, y);
    if (p) { planted.push(`${x},${y}`); kinds.push(p.kind); }
  }
  check(`in the browser, a spitta plants the lily root and the lotus seeds in the deep water, ring by ring from the totem: ${LILY_SPOTS}`,
    inCrate(crate) === '-' && planted.join(' ') === LILY_SPOTS && kinds.sort().join(',') === WATER_PLANTS.map((d) => d.id).sort().join(','), `${inCrate(crate)} ${planted.join(' ')}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nrepurpose — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
