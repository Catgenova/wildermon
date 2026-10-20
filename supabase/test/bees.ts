/**
 * Bees: the skep (`bees.ts`), on both sides.
 *
 * The piece, its recipe, its item and its two jobs, the same on both sides;
 * the clumps of wildflowers in reach counted the same, season by season; what
 * a skep makes between two moments, the same, and at the rate the rule says
 * for the flowers in reach -- a stretch of spring, of summer, across the turn
 * into autumn and out of winter into spring; nothing in winter, whatever the
 * flowers; nothing with no flowers in reach; never more than it holds; every
 * sentence it says; and Take honey -- its refusals in the same words, the
 * honey and beeswax it gives at the quality it gives them, the trade it
 * trains, and the moment it starts again from, carried to the browser by the
 * ground read and kept through a save.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/bees.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/bees.mjs && node node_modules/.cache/bees.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game, type IslandGround } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import {
  HOUR, LOOK_SKEP, SKEP, SKEP_CLUMP_HOURS, SKEP_HOLDS, SKEP_IDLE, SKEP_REACH, SKEP_SAID, SKEP_SKILL, SKEP_WAX_EVERY, skepFlowers, skepMadeBetween,
  skepRate, skepRateSaid, skepSays, skepTookSaid, skepWax, TAKE_HONEY,
} from '../../src/game/bees';
import { FURNITURE_BY_ID } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { lampTooFar } from '../../src/game/lamps';
import { DAY_SECONDS } from '../../src/game/pace';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { SEASON_DAYS, SEASONS, seasonAt, YEAR_DAYS, YEAR_FROM, type Season } from '../../src/world/calendar';
import { FLOWERS_PICKED, TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/* ---- the browser's island, made first: where the flowers are --------------------------------- */

const SEED = 2718;
const SIZE = 64;
const g = Game.create(SEED, SIZE);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.settings.fromStores = false;
g.skills.values.set(SKEP_SKILL, 30);
g.skills.values.set('ropemaking', 40);

/** The start of the island's second year, and a season's length, in epoch seconds. */
const SEASON = SEASON_DAYS * DAY_SECONDS;
const YEAR = YEAR_FROM + YEAR_DAYS * DAY_SECONDS;
const at = (season: Season, hours = 0): number => YEAR + SEASONS.indexOf(season) * SEASON + hours * HOUR;
check('the moments the test uses fall in the seasons it says', SEASONS.every((s) => seasonAt(at(s, 1)).season === s && seasonAt(at(s, 29)).season === s));

// The tile in the interior whose reach is fullest in summer, and one well away from it that flowers too, to be picked bare.
const flowersAt = (x: number, y: number, s: Season): number => skepFlowers(g, x, y, at(s, 1));
let rich = { x: 0, y: 0, n: -1 };
for (let y = 8; y < SIZE - 8; y++) for (let x = 8; x < SIZE - 8; x++) {
  const n = flowersAt(x, y, 'summer');
  if (n > rich.n && flowersAt(x, y, 'spring') > 0) rich = { x, y, n };
}
let bare = { x: 0, y: 0, n: -1 };
for (let y = 8; y < SIZE - 8; y++) for (let x = 8; x < SIZE - 8; x++) {
  if (Math.max(Math.abs(x - rich.x), Math.abs(y - rich.y)) <= 2 * SKEP_REACH + 2) continue;
  const n = flowersAt(x, y, 'summer');
  if (n > bare.n) bare = { x, y, n };
}
const R = { x: rich.x, y: rich.y };
const B = { x: bare.x, y: bare.y };
const N_SU = flowersAt(R.x, R.y, 'summer');
const N_SP = flowersAt(R.x, R.y, 'spring');
check(`a skep at ${R.x},${R.y} has ${N_SU} clumps in reach in summer and ${N_SP} in spring, enough to fill it in a season`,
  N_SU * (SEASON / HOUR) / SKEP_CLUMP_HOURS >= SKEP_HOLDS && N_SP > 0, `${N_SU} ${N_SP}`);
check(`and none in autumn or winter, when nothing flowers`, flowersAt(R.x, R.y, 'autumn') === 0 && flowersAt(R.x, R.y, 'winter') === 0);
// Every tile in reach of the bare one picked this year, on both sides.
const reachOf = (p: { x: number; y: number }): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let y = p.y - SKEP_REACH; y <= p.y + SKEP_REACH; y++) for (let x = p.x - SKEP_REACH; x <= p.x + SKEP_REACH; x++) out.push([x, y]);
  return out;
};
const bareSeasons = (['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => flowersAt(B.x, B.y, s));
const bareBefore = bareSeasons[1];
for (const [x, y] of reachOf(B)) w.setTile(x, y, TileType.Grass, w.getData(x, y) | FLOWERS_PICKED);
check(`the tiles round ${B.x},${B.y} had ${bareBefore} clumps in summer, and picked they have none`, bareBefore > 0 && flowersAt(B.x, B.y, 'summer') === 0);

/** The stretches what a skep makes is asked over, and what the rule says each makes at the rich tile. */
const SPANS: Array<{ k: string; p: { x: number; y: number }; from: number; to: number; want: number; what: string }> = [
  { k: 'SU1', p: R, from: at('summer', 5), to: at('summer', 6), want: Math.min(SKEP_HOLDS, skepRate(N_SU, 'summer')), what: 'an hour of summer' },
  { k: 'SP3', p: R, from: at('spring', 1), to: at('spring', 4), want: Math.min(SKEP_HOLDS, 3 * skepRate(N_SP, 'spring')), what: 'three hours of spring' },
  { k: 'SUAU', p: R, from: at('autumn', -5), to: at('autumn', 5), want: Math.min(SKEP_HOLDS, 5 * skepRate(N_SU, 'summer')), what: 'five hours of summer and five of autumn' },
  { k: 'WISP', p: R, from: at('winter', 25), to: YEAR + 4 * SEASON + 2 * HOUR, want: Math.min(SKEP_HOLDS, 2 * skepRate(N_SP, 'spring')), what: 'five hours of winter and two of the next spring' },
  { k: 'WI', p: R, from: at('winter', 1), to: at('winter', 20), want: 0, what: 'nineteen hours of winter' },
  { k: 'BARE', p: B, from: at('summer', 0), to: at('summer', 10), want: 0, what: 'ten hours of summer with every flower in reach picked' },
  { k: 'YEAR', p: R, from: at('spring', 0), to: YEAR + 4 * SEASON, want: SKEP_HOLDS, what: 'a whole year' },
];
const RATES = [0, 1, 3, 7, 10, 13, 20, 33, 49];
const SAYS: Array<[number, Season, number]> = [[7, 'summer', 5.5], [1, 'spring', 0], [0, 'autumn', 12], [9, 'winter', 3], [20, 'summer', 11.99], [0, 'summer', 0.4]];

/* ---- on the island ----------------------------------------------------------------------------- */

const MIRA = 'b0e5c4a1-0000-4000-8000-0000000000b1';
const OTTO = 'b0e5c4a1-0000-4000-8000-0000000000b2';
const T = (id: string): string => `jsonb_build_object('kind', 'furniture', 'id', ${id})`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${def}'), 0)`;
const refusal = (key: string, who: string, action: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${T('v_pl')}), 'none'));`;
const ts = (t: number): string => `to_timestamp(${t})`;

const out = psql(`
set wurm.season = '';
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_x bigint; v_st bigint; v_pl bigint; v_skill double precision; v_at double precision;
        v_g jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Bees', ${SEED}, ${SIZE}, 10, 10, true) returning id into w;
  perform land_blank(w, ${SIZE});
  ${[...reachOf(R), ...reachOf(B)].map(([x, y]) => `perform land_set_tile(w, ${x}, ${y}, tile_id('Grass'));`).join('\n  ')}
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = ${R.x + 0.5}, y = ${R.y + 0.5}, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, '${SKEP_SKILL}', 30), (w, o, '${SKEP_SKILL}', 30), (w, u, 'ropemaking', 40)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- 1. The flowers in reach, season by season, and what is made over each stretch.
  insert into said select 'FL:' || s || ':' || p, skep_flowers(w, x, y, to_timestamp(t))::text
    from (values ${(['spring', 'summer', 'autumn', 'winter'] as Season[]).flatMap((s) => [['R', R], ['B', B]].map(([p, q]) => `('${s}', '${p}', ${(q as typeof R).x}, ${(q as typeof R).y}, ${at(s, 1)})`)).join(', ')}) v(s, p, x, y, t);
  ${reachOf(B).map(([x, y]) => `perform land_set_data(w, ${x}, ${y}, land_data(w, ${x}, ${y}) | flowers_picked()::int);`).join('\n  ')}
  insert into said select 'FL:picked', skep_flowers(w, ${B.x}, ${B.y}, ${ts(at('summer', 1))})::text;
  ${SPANS.map((s) => `insert into said values ('MADE:${s.k}', skep_made_between(w, ${s.p.x}, ${s.p.y}, ${s.from}, ${s.to})::text);`).join('\n  ')}
  insert into said select 'RATE', string_agg(skep_rate_said(n, s), ',' order by s, n)
    from unnest(array[${RATES.join(', ')}]) n cross join unnest(array['spring', 'summer', 'autumn', 'winter']) s;
  insert into said select 'SAYS:' || so, skep_says(sf, ss, sm) from (values ${SAYS.map(([f, s, m], i) => `(${i}, ${f}, '${s}', ${m}::double precision)`).join(', ')}) v(so, sf, ss, sm);
  insert into said values ('TOOK', skep_took_said(12, 3) || '#' || skep_took_said(3, 0));
  insert into said values ('WORDS', skep_said('notYours') || '#' || skep_said('empty') || '#' || lamp_too_far_said('skep'));

  -- 2. Woven and set down: it starts filling from the moment it goes in.
  perform give(w, u, 'carving_knife', 1, 50);
  v_x := give(w, u, 'thatch', 6, 40);
  perform give(w, u, 'reed', 4, 40);
  insert into said values ('BUILDASK', coalesce(act_refusal(w, u, 'make_${SKEP}', jsonb_build_object('kind', 'item', 'uid', v_x)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${SKEP}', jsonb_build_object('kind', 'item', 'uid', v_x));
  perform pg_temp.nodice();
  insert into said values ('BUILT', ${count(SKEP)} || '|' || ${count('thatch')} || '|' || ${count('reed')});
  select id into v_st from item where world_id = w and holder_uid = u and def = '${SKEP}';
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_st, 'x', ${R.x}, 'y', ${R.y}, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_pl from placed where world_id = w and kind = 'furniture' and sub = '${SKEP}';
  insert into said select 'PLACED', coalesce(v_pl::text, 'none') || '|' || ${count(SKEP)} || '|'
    || (abs((pl.state->>'skep_at')::double precision - extract(epoch from now())::double precision) < 0.001)::text from placed pl where pl.id = v_pl;

  -- 3. Refusals: just set down, there is nothing in it; then a year's worth.
  ${refusal('R:empty', 'u', TAKE_HONEY)}
  ${refusal('R:look', 'u', LOOK_SKEP)}
  update placed set state = state || jsonb_build_object('skep_at', extract(epoch from now())::double precision - ${YEAR_DAYS * DAY_SECONDS}) where id = v_pl;
  insert into said select 'FULL', skep_made(w, pl)::text from placed pl where pl.id = v_pl;
  ${refusal('R:none', 'u', TAKE_HONEY)}
  update player set x = ${R.x + 10.5}, y = ${R.y + 0.5} where world_id = w and uid = u;
  ${refusal('R:far', 'u', TAKE_HONEY)}
  update player set x = ${R.x + 0.5}, y = ${R.y + 0.5} where world_id = w and uid = u;
  insert into said values ('R:gone', coalesce(act_refusal(w, u, '${TAKE_HONEY}', ${T('987654')}), 'none'));
  ${refusal('R:other', 'o', TAKE_HONEY)}
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hivesend', ${R.x}, ${R.y}, 3, 1, u);
  insert into deed_member (world_id, founder, uid, role) values (w, u, o, 'builder');
  ${refusal('R:citizen', 'o', TAKE_HONEY)}
  delete from deed_member where world_id = w;
  delete from deed where world_id = w;

  -- 4. Examine, then Take honey: every whole honey and its beeswax, at the trade with the skep as the tool, and it starts again.
  perform act_perform(w, u, '${LOOK_SKEP}', ${T('v_pl')});
  insert into said select 'LOOK', ${lastSaid()} || '#' || skep_flowers(w, ${R.x}, ${R.y}) || '#' || season_at();
  select value into v_skill from skill where world_id = w and uid = u and id = '${SKEP_SKILL}';
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, '${TAKE_HONEY}', ${T('v_pl')});
  perform pg_temp.nodice();
  insert into said select 'TAKEN', ${count('honey')} || '|' || ${count('wax')} || '|' || ${lastSaid()} || '|'
      || ((select value from skill where world_id = w and uid = u and id = '${SKEP_SKILL}') > v_skill)::text || '|'
      || (select round(ql::numeric, 4) from item where world_id = w and holder_uid = u and def = 'honey') || '|'
      || (select round(ql::numeric, 4) from item where world_id = w and holder_uid = u and def = 'wax') || '|'
      || (abs((pl.state->>'skep_at')::double precision - extract(epoch from now())::double precision) < 0.001)::text
    from placed pl where pl.id = v_pl;
  ${refusal('R:after', 'u', TAKE_HONEY)}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('PIECEID', v_pl::text);
  insert into said select 'SKEPAT', (pl.state->>'skep_at') from placed pl where pl.id = v_pl;
  insert into said values ('GROUND', v_g::text);
end $t$;
select k || '=' || replace(v, E'\\n', ' ') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- the piece, its recipe, its item and its jobs, on both sides ------------------------------------------ */

const piece = FURNITURE_BY_ID.get(SKEP);
const recipe = RECIPE_BY_ID.get(`make_${SKEP}`);
const item = ITEM_DEFS[SKEP];
const recipeIsle = psql(`select r.tool || '|' || r.skill || '|' || r.base_time || '|' || r.difficulty || '|'
  || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
  from recipe r where r.id = 'make_${SKEP}'`);
const recipeHere = recipe ? `${recipe.tool}|${recipe.skill}|${recipe.baseTime}|${recipe.difficulty}|${recipe.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : '';
check(`a skep is woven the same on both sides: ${recipeHere}`, !!piece?.skep && recipeIsle === recipeHere && recipe?.skill === 'ropemaking', recipeIsle);
const itemIsle = psql(`select d.name || '|' || d.weight || '|' || d.decay || '|' || d.description || '|' || f.w || 'x' || f.h
  from item_def d join furniture_def f on f.id = d.id where d.id = '${SKEP}'`);
check('its item and its footprint are the same on both sides',
  itemIsle === `${item?.name}|${item?.weight}|${item?.decay}|${item?.description}|${piece?.w}x${piece?.h}`, itemIsle);
check('the item says its rate, its reach, its beeswax, what it holds and its idle season off the rule',
  !!item?.description?.includes(`one honey every ${SKEP_CLUMP_HOURS} hours per wildflower clump within ${SKEP_REACH} tiles`)
    && !!item?.description?.includes(`up to ${SKEP_HOLDS} honey. Nothing in ${SKEP_IDLE}`) && !item?.description?.includes('{'), item?.description);
const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time || ':' || instant, '|' order by id)
  from action_def where id in ('${TAKE_HONEY}', '${LOOK_SKEP}')`);
const jobsHere = [TAKE_HONEY, LOOK_SKEP].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}:${!!a.instant}`;
}).join('|');
check(`its two jobs are the same rows on both sides: ${jobsHere}`, jobsIsle === jobsHere && jobsHere.includes(`${TAKE_HONEY}:Take honey:${SKEP_SKILL}`), jobsIsle);
check('the constants cross as the rule has them', psql(`select concat_ws('|', skep_reach(), skep_clump_hours(), skep_hour(), skep_holds(), skep_wax_every(), skep_idle(), skep_skill(), skep_kind())`)
  === [SKEP_REACH, SKEP_CLUMP_HOURS, HOUR, SKEP_HOLDS, SKEP_WAX_EVERY, SKEP_IDLE, SKEP_SKILL, SKEP].join('|'));

/* ---- the flowers in reach, and what they make ------------------------------------------------------------------- */

const flIsle = (['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => `${isle.get(`FL:${s}:R`)}/${isle.get(`FL:${s}:B`)}`).join(' ');
// The bare tile as it was before it was picked: the island counted it before picking it.
const flHere = (['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s, i) => `${flowersAt(R.x, R.y, s)}/${bareSeasons[i]}`).join(' ');
check(`the clumps in reach are the same count on both sides, season by season (spring summer autumn winter): ${flHere}`, flIsle === flHere, flIsle);
check('and picked, the tiles in reach count none on both sides', isle.get('FL:picked') === '0' && flowersAt(B.x, B.y, 'summer') === 0, isle.get('FL:picked'));
for (const s of SPANS) {
  const here = skepMadeBetween(g, s.p.x, s.p.y, s.from, s.to);
  const there = Number(isle.get(`MADE:${s.k}`));
  check(`over ${s.what} a skep makes ${here} honey on both sides, as the rule says (${s.want})`, near(here, there) && near(here, s.want), `island ${isle.get(`MADE:${s.k}`)}`);
}
check(`the rate is a honey every ${SKEP_CLUMP_HOURS} hours a clump: ${N_SU} clumps make ${skepRateSaid(N_SU, 'summer')} an hour`,
  near(skepRate(N_SU, 'summer'), N_SU / SKEP_CLUMP_HOURS) && near(skepRate(20, 'spring'), 20 / SKEP_CLUMP_HOURS));
check(`nothing in ${SKEP_IDLE}, whatever is in flower: the rule says nothing for any number of clumps`,
  RATES.every((n) => skepRate(n, SKEP_IDLE) === 0) && Number(isle.get('MADE:WI')) === 0);
check('nothing with no flowers in reach', skepRate(0, 'summer') === 0 && Number(isle.get('MADE:BARE')) === 0);
check(`never more than it holds, ${SKEP_HOLDS} honey`, Number(isle.get('MADE:YEAR')) === SKEP_HOLDS
  && skepMadeBetween(g, R.x, R.y, at('spring', 0), YEAR + 40 * SEASON) === SKEP_HOLDS);
const rateHere = (['autumn', 'spring', 'summer', 'winter'] as Season[]).flatMap((s) => [...RATES].sort((a, b) => a - b).map((n) => skepRateSaid(n, s))).join(',');
check('the rate an hour is said the same on both sides', isle.get('RATE') === rateHere, `${isle.get('RATE')} / ${rateHere}`);
SAYS.forEach(([f, s, m], i) => {
  check(`Examine says the same on both sides: ${skepSays(f, s, m)}`, isle.get(`SAYS:${i}`) === skepSays(f, s, m), isle.get(`SAYS:${i}`));
});
check(`taking says the same on both sides: ${skepTookSaid(12, 3)}`, isle.get('TOOK') === `${skepTookSaid(12, 3)}#${skepTookSaid(3, 0)}`, isle.get('TOOK'));
check('and so does every refusal', isle.get('WORDS') === `${SKEP_SAID.notYours}#${SKEP_SAID.empty}#${lampTooFar('skep')}`, isle.get('WORDS'));

/* ---- woven, set down and emptied, in the browser and on the island -------------------------------------------- */

const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said[said.length - 1] ?? '';
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, count = 1): Item => g.gather(id, { count, ql });
const ask = (id: string, t: Target): string => act(id).check?.(t, g) ?? 'none';
const tgt = (id: number): Target => ({ kind: 'furniture', id } as Target);
let NOW = at('summer', 12);
g.wallClock = () => NOW;
g.putBody(R.x + 0.5, R.y + 0.5, 0);

thing('carving_knife', 50);
const thatch = thing('thatch', 40, 6);
thing('reed', 40, 4);
const buildAsk = ask(`make_${SKEP}`, { kind: 'item', uid: thatch.uid });
dice(0.01);
act(`make_${SKEP}`).perform({ kind: 'item', uid: thatch.uid }, g);
check(`it is woven from ${recipe?.inputs.map((i) => `${i.count} ${i.item}`).join(' and ')}, the same on both sides`,
  isle.get('BUILDASK') === 'none' && buildAsk === 'none' && isle.get('BUILT') === '1|0|0' && held(SKEP) === 1 && held('thatch') === 0 && held('reed') === 0,
  `${isle.get('BUILDASK')} ${isle.get('BUILT')} / ${buildAsk} ${held(SKEP)}`);
const skep = g.inventory.items.find((it) => it.id === SKEP) as Item;
act('place_furniture').perform({ kind: 'tile', x: R.x, y: R.y, sx: 1, sy: 1, itemUid: skep.uid, facing: 's' } as Target, g);
const f = [...g.furniture.values()].find((p) => p.kind === SKEP);
check('set down, it starts filling from that moment on both sides', part('PLACED', 0) !== 'none' && part('PLACED', 1) === '0' && part('PLACED', 2) === 'true'
  && !!f && f.skepAt === NOW && held(SKEP) === 0, `${isle.get('PLACED')} / ${f?.skepAt}`);
const id = f?.id ?? -1;

const Rf: Record<string, string> = {};
Rf['R:empty'] = ask(TAKE_HONEY, tgt(id));
Rf['R:look'] = ask(LOOK_SKEP, tgt(id));
if (f) f.skepAt = NOW - YEAR_DAYS * DAY_SECONDS;
Rf['R:none'] = ask(TAKE_HONEY, tgt(id));
g.putBody(R.x + 10.5, R.y + 0.5, 0);
Rf['R:far'] = ask(TAKE_HONEY, tgt(id));
g.putBody(R.x + 0.5, R.y + 0.5, 0);
Rf['R:gone'] = ask(TAKE_HONEY, tgt(987654));
if (f) f.mine = false;
Rf['R:other'] = ask(TAKE_HONEY, tgt(id));
g.deed = { name: 'Hivesend', x: R.x, y: R.y, radius: 3, level: 1, mine: true } as never;
Rf['R:citizen'] = ask(TAKE_HONEY, tgt(id));
g.deed = null;
if (f) f.mine = true;
const WANT: Record<string, string> = {
  'R:empty': SKEP_SAID.empty, 'R:look': 'none', 'R:none': 'none', 'R:far': lampTooFar('skep'), 'R:gone': 'It is gone.',
  'R:other': SKEP_SAID.notYours, 'R:citizen': 'none',
};
for (const [k, want] of Object.entries(WANT)) {
  check(`Take honey ${k.slice(2)}: ${want}`, isle.get(k) === want && Rf[k] === want, `island ${isle.get(k)} / browser ${Rf[k]}`);
}
check(`a year's worth fills it to what it holds, ${SKEP_HOLDS}, on the island`, Number(isle.get('FULL')) === SKEP_HOLDS, isle.get('FULL'));

// Examine at the island's own now, which the browser reads at its own: the same season, the same flowers.
{
  const [text, n, season] = (isle.get('LOOK') ?? '').split('#');
  NOW = Date.now() / 1000;
  if (f) f.skepAt = NOW - YEAR_DAYS * DAY_SECONDS;
  act(LOOK_SKEP).perform(tgt(id), g);
  check(`Examine says the flowers in reach now, their rate, what is in it and what it holds, the same on both sides: ${lastHere()}`,
    text === lastHere() && text === skepSays(Number(n), season as Season, SKEP_HOLDS) && seasonAt(NOW).season === season, `${text}`);
}
NOW = at('summer', 12);
if (f) f.skepAt = NOW - YEAR_DAYS * DAY_SECONDS;
const skillBefore = g.skills.get(SKEP_SKILL);
dice(0.01);
act(TAKE_HONEY).perform(tgt(id), g);
const honeyQl = g.inventory.items.find((it) => it.id === 'honey')?.ql ?? -1;
const waxQl = g.inventory.items.find((it) => it.id === 'wax')?.ql ?? -1;
const honeyN = SKEP_HOLDS;
const waxN = skepWax(SKEP_HOLDS);
check(`Take honey gives ${honeyN} honey and ${waxN} beeswax, a beeswax for every ${SKEP_WAX_EVERY} honey, on both sides: ${lastHere()}`,
  part('TAKEN', 0) === String(honeyN) && part('TAKEN', 1) === String(waxN) && held('honey') === honeyN && held('wax') === waxN
    && part('TAKEN', 2) === lastHere() && lastHere() === skepTookSaid(honeyN, waxN), `${isle.get('TAKEN')} / ${held('honey')} ${held('wax')}`);
check(`at the taker's ${SKEP_SKILL} where the roll comes inside the skep's quality, the same on both sides`,
  Number(part('TAKEN', 4)) === Number(honeyQl.toFixed(4)) && Number(part('TAKEN', 5)) === Number(waxQl.toFixed(4)) && near(honeyQl, 30),
  `${part('TAKEN', 4)} ${part('TAKEN', 5)} / ${honeyQl} ${waxQl} (skill ${skillBefore})`);
check(`it trains ${SKEP_SKILL} on the island`, part('TAKEN', 3) === 'true', isle.get('TAKEN'));
check('and the skep starts again from that moment, empty, on both sides', part('TAKEN', 6) === 'true' && f?.skepAt === NOW
  && isle.get('R:after') === SKEP_SAID.empty && ask(TAKE_HONEY, tgt(id)) === SKEP_SAID.empty, `${isle.get('R:after')}`);
{
  const seen = Game.create(SEED, 64);
  seen.sawGround(JSON.parse(isle.get('GROUND') ?? '{}') as IslandGround);
  const read = seen.furniture.get(Number(isle.get('PIECEID')));
  check('the ground read brings the moment it fills from to every browser that sees it',
    read?.kind === SKEP && read.skepAt !== undefined && near(read.skepAt, Number(isle.get('SKEPAT'))), `${read?.skepAt} / ${isle.get('SKEPAT')}`);
}
{
  const land = await packLand(g);
  const back = await unpack(land, JSON.parse(JSON.stringify(packWorld(g))));
  const kept = [...(back?.furniture.values() ?? [])].find((p) => p.kind === SKEP);
  check('and the browser keeps it through a save and a load', kept?.skepAt === NOW, JSON.stringify(kept?.skepAt));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`bees — ${ok.length} of ${ok.length}`);
