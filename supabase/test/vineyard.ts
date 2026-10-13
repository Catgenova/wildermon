/**
 * Vineyards and wine that ages (`vineyard.ts`, `ageing.ts`), on both sides.
 *
 * The trellis, the grape, the cutting, grape wine and its brew, and every
 * number and sentence, the same on both sides; a cutting off a thorn bush
 * with a sickle, once; a cutting planted on a trellis on soil and refused
 * off it; the vine too young to bear, then picked in autumn for the grapes
 * its picker's forestry gives, resting a day and picked again, and refused
 * in every other season with when it fruits -- at the same moments, in the
 * same words; grape wine set going from its grapes, its ageing stamped as it
 * goes; and the QL a barrel of it is at after so many days in a cellar and
 * out of one, worked out on both sides to the last bit, capped at what it
 * gains and at 100, said on Examine and drunk at.
 *
 * Every roll is set and every moment held. Runs against any database the
 * migrations have built; the island half is rolled back.
 *
 *   npx esbuild supabase/test/vineyard.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/vineyard.mjs && node node_modules/.cache/vineyard.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game, type IslandGround } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { AGEING_RULE, brewQl, CELLAR_AGEING, fixedTo, WINE_AGE_CAP, WINE_AGE_RATE, wineAgeSays, wineGain } from '../../src/game/ageing';
import { boonTime } from '../../src/game/boons';
import { BREW_BY_ID, BREWS, GRAPE_WINE_GRAPES } from '../../src/game/brewing';
import { cellarOutdoor } from '../../src/game/cellar';
import { FURNITURE_BY_ID, type PlacedFurniture } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { lampTooFar } from '../../src/game/lamps';
import { DAY_SECONDS } from '../../src/game/pace';
import { vesselSays } from '../../src/game/placeables';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  CUT_VINE, cutVineSaid, GRAPE, GRAPE_CUTTING, GRAPE_SEASON, GRAPES_A_PICK, GRAPES_BASE, GRAPES_SPAN, grapesFor, grapesSaid, PICK_GRAPES, PLANT_VINE,
  TRELLIS, untilGrapes, VINE_BEARS, VINE_REST, VINE_SAID, VINE_SKILL, VINE_SOIL, vinePlantedSaid, vineSeasonSaid, vineStage, WILD_VINE,
} from '../../src/game/vineyard';
import { SEASON_DAYS, seasonAt, YEAR_DAYS, YEAR_FROM } from '../../src/world/calendar';
import { BUSH_DEFS, TileType } from '../../src/world/tiles';

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

/* ---- the moments everything is held at ------------------------------------------------------------- */

const DAY = DAY_SECONDS;
const YEAR = YEAR_DAYS * DAY;
// Three years on from the first spring, so every moment is past and the same on any day the suite runs.
const Y0 = YEAR_FROM + 3 * YEAR;
/** Planted on the sixth day of spring, a little past its dawn. */
const T_PLANT = Y0 + 5 * DAY + 1234.5;
/** A day later: too young. */
const T_YOUNG = T_PLANT + DAY;
/** Grown, and still spring: waiting for its season. */
const T_SPRING = T_PLANT + (VINE_BEARS + 1) * DAY;
/** The third day of autumn: ripe. */
const T_AUTUMN = Y0 + 2 * SEASON_DAYS * DAY + 2 * DAY + 100;
/** Half a day after it is picked: resting. */
const T_RESTING = T_AUTUMN + DAY / 2;
/** A day and a little after: ripe again. */
const T_AGAIN = T_AUTUMN + VINE_REST * DAY + 10;
/** Deep in winter and in summer: waiting. */
const T_WINTER = Y0 + 3 * SEASON_DAYS * DAY + 17 * DAY + 77;
const T_SUMMER = Y0 + SEASON_DAYS * DAY + 29 * DAY + 3599;
const SEASON_MOMENTS = [T_SPRING, T_WINTER, T_SUMMER, Y0 + 3 * SEASON_DAYS * DAY - 30, Y0 + 4 * SEASON_DAYS * DAY + 1];

check(`the moments are where the test means them: ${[T_YOUNG, T_SPRING, T_AUTUMN, T_RESTING, T_AGAIN, T_WINTER, T_SUMMER].map((t) => seasonAt(t).season).join(', ')}`,
  ['spring', 'spring', 'autumn', 'autumn', 'autumn', 'winter', 'summer'].join() === [T_YOUNG, T_SPRING, T_AUTUMN, T_RESTING, T_AGAIN, T_WINTER, T_SUMMER].map((t) => seasonAt(t).season).join()
  && GRAPE_SEASON === 'autumn');

/* ---- the definitions and the words, on both sides --------------------------------------------------- */

const brew = BREW_BY_ID.get('grape_wine');
const brewIsle = psql(`select concat_ws('|', name, input, count, litres, seconds, difficulty, done) from brew_def where id = 'grape_wine'`);
check(`grape wine is a brew of ${GRAPE_WINE_GRAPES} grapes on both sides, beside cherry wine`,
  !!brew && brewIsle === [brew.name, brew.input, brew.count, brew.litres, brew.time, brew.difficulty, brew.done].join('|')
    && brew.input === GRAPE && brew.count === GRAPE_WINE_GRAPES && BREW_BY_ID.get('wine')?.input === 'cherry'
    && psql(`select count(*) from brew_def where id in ('wine', 'grape_wine')`) === '2', brewIsle);
const ages = BREWS.filter((b) => b.ages).map((b) => b.id);
check(`the brews that age are the same on both sides: ${ages.join(', ')}`,
  psql(`select string_agg(id, ',' order by id) from brew_def where brew_ages(id)`) === [...ages].sort().join(',') && ages.includes('grape_wine') && ages.includes('wine'));
const recipe = RECIPE_BY_ID.get(`make_${TRELLIS}`);
const recipeIsle = psql(`select r.tool || '|' || r.skill || '|' || r.base_time || '|' || r.difficulty || '|'
  || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
  from recipe r where r.id = 'make_${TRELLIS}'`);
check(`a trellis is built the same on both sides: ${recipeIsle}`, !!recipe && !!FURNITURE_BY_ID.get(TRELLIS)?.vine
  && recipeIsle === `${recipe.tool}|${recipe.skill}|${recipe.baseTime}|${recipe.difficulty}|${recipe.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}`);
check('and it stays out of a cellar on both sides', cellarOutdoor().includes(TRELLIS) && psql(`select cellar_outdoor('${TRELLIS}')`) === 't');
const itemsIsle = psql(`select string_agg(d.id || ':' || d.name || ':' || d.description, '#' order by d.id) from item_def d
  where d.id in ('${GRAPE}', '${GRAPE_CUTTING}', '${TRELLIS}', 'grape_wine_bucket')`);
check('the grape, the cutting, the trellis and the bucket of grape wine are the same things on both sides, with nothing left to fill in',
  itemsIsle === [GRAPE, GRAPE_CUTTING, 'grape_wine_bucket', TRELLIS].sort().map((id) => `${id}:${ITEM_DEFS[id].name}:${ITEM_DEFS[id].description}`).join('#')
    && !itemsIsle.includes('{'), itemsIsle.slice(0, 200));
check('the bucket of wine says how it ages, off the rule', ITEM_DEFS.wine_bucket.description?.includes(AGEING_RULE()) === true
  && ITEM_DEFS.grape_wine_bucket.description?.includes(`${WINE_AGE_RATE} QL a day`) === true);
const numbersIsle = psql(`select concat_ws('|', grape_season(), vine_bears(), vine_rest(), grapes_a_pick(), grapes_base(), grapes_span(), vine_skill(),
  wild_vine(), wine_age_rate(), wine_age_cap(), cellar_ageing(), day_seconds(),
  (select string_agg(t::text, ',' order by t) from generate_series(0, 30) t where vine_soil(t)))`);
const numbersHere = [GRAPE_SEASON, VINE_BEARS, VINE_REST, GRAPES_A_PICK, GRAPES_BASE, GRAPES_SPAN, VINE_SKILL, WILD_VINE, WINE_AGE_RATE, WINE_AGE_CAP,
  CELLAR_AGEING, DAY_SECONDS, [...VINE_SOIL].sort((a, b) => a - b).join(',')].join('|');
check(`every number is the same on both sides: ${numbersHere}`, numbersIsle === numbersHere, numbersIsle);
const actsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time, '|' order by id)
  from action_def where id in ('${CUT_VINE}', '${PLANT_VINE}', '${PICK_GRAPES}')`);
const actsHere = [CUT_VINE, PICK_GRAPES, PLANT_VINE].map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}`;
}).join('|');
check(`the three jobs are the same rows on both sides: ${actsHere}`, actsIsle === actsHere, actsIsle);
const KEYS = ['none', 'young', 'picked', 'has', 'soil', 'noCutting', 'noWild', 'cut', 'noTool'] as const;
const wordsIsle = psql(`select concat_ws('#', ${KEYS.map((k) => `vine_said('${k}')`).join(', ')}, vine_planted_said(),
  grapes_said(1, 31.25), grapes_said(5, 42.25), grapes_said(8, 99.95), cut_vine_said(33.35), cut_vine_said(7))`);
const wordsHere = [...KEYS.map((k) => VINE_SAID[k]), vinePlantedSaid(), grapesSaid(1, 31.25), grapesSaid(5, 42.25), grapesSaid(8, 99.95),
  cutVineSaid(33.35), cutVineSaid(7)].join('#');
check('every sentence a vine says is the same on both sides', wordsIsle === wordsHere, `${wordsIsle} / ${wordsHere}`);
const SKILLS = [0, 1, 12.5, 32.5, 50, 64.9, 65, 99.99, 100];
const grapesIsle = psql(`select string_agg(grapes_for(s)::text, ',' order by o) from unnest(array[${SKILLS.join(', ')}]::double precision[]) with ordinality u(s, o)`);
check(`a pick gives the same grapes at every forestry on both sides: ${SKILLS.map(grapesFor).join(', ')}`, grapesIsle === SKILLS.map(grapesFor).join(','), grapesIsle);
const seasonIsle = psql(`select string_agg(until_grapes(t)::text || '~' || vine_season_said(t), '#' order by o)
  from unnest(array[${SEASON_MOMENTS.join(', ')}]::double precision[]) with ordinality u(t, o)`);
const seasonHere = SEASON_MOMENTS.map((t) => `${untilGrapes(t)}~${vineSeasonSaid(t)}`).join('#');
check(`out of season, when it fruits is worked out and said the same on both sides: “${vineSeasonSaid(T_SPRING)}”`, seasonIsle === seasonHere, `${seasonIsle} / ${seasonHere}`);

/* ---- the ageing, as numbers: so many days, in a cellar and out ------------------------------------- */

const AGES = [0, 0.25, 0.5, 1, 2.5, 3, 7.3, 10, 13.7, 39.99, 40, 41, 100, 1000].map((d) => d * DAY);
const gainIsle = psql(`select string_agg(wine_gain(a, false)::text || '/' || wine_gain(a, true)::text, ',' order by o)
  from unnest(array[${AGES.join(', ')}]::double precision[]) with ordinality u(a, o)`);
const gainHere = AGES.map((a) => `${wineGain(a, false)}/${wineGain(a, true)}`).join(',');
check(`a wine gains the same QL to the last bit on both sides, so many days in a cellar and out: ${gainHere}`, gainIsle === gainHere, gainIsle);
check(`${WINE_AGE_RATE} a day out of a cellar and ${WINE_AGE_RATE * CELLAR_AGEING} in one, and never more than ${WINE_AGE_CAP}`,
  wineGain(10 * DAY, false) === 10 * WINE_AGE_RATE && wineGain(2 * DAY, true) === 2 * WINE_AGE_RATE * CELLAR_AGEING
    && wineGain(1000 * DAY, false) === WINE_AGE_CAP && wineGain(1000 * DAY, true) === WINE_AGE_CAP && wineGain(0, true) === 0 && wineGain(-5, true) === 0);
const FIX = [0, 0.125, 0.375, 1.005, 2.675, 9.995, 10, 40.5, 99.995];
const fixIsle = psql(`select string_agg(fixed_to(x, 2) || '/' || fixed_to(x, 1), ',' order by o) from unnest(array[${FIX.join(', ')}]::double precision[]) with ordinality u(x, o)`);
check('and a number is put the same way on both sides, ties and all', fixIsle === FIX.map((x) => `${fixedTo(x, 2)}/${fixedTo(x, 1)}`).join(','), fixIsle);

/* ---- on the island ---------------------------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000b1';
const T = (id: string): string => `jsonb_build_object('kind', 'furniture', 'id', ${id})`;
const TILE = (x: number, y: number): string => `jsonb_build_object('kind', 'tile', 'x', ${x}, 'y', ${y})`;
const lastSaid = `(select e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and holder = 'player' and def = '${def}'), 0)`;
const askIsle = (key: string, action: string, target: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, u, '${action}', ${target}), 'none'));`;
const at = (t: number): string => `perform set_config('wurm.vine_now', '${t}', true);`;
const THORN = BUSH_DEFS.findIndex((b) => b.name === WILD_VINE);
const ROSE = BUSH_DEFS.findIndex((b) => b.name !== WILD_VINE);
const BASE = 40.5;
const TOP = 95.25;

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
declare w uuid; u uuid := '${MIRA}'; v_it bigint; v_tr bigint; v_tr2 bigint; v_bar bigint; v_now double precision; p placed;
        v_ages double precision[] := array[${AGES.join(', ')}]::double precision[]; v_i int; v_c int; v_boon double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Vineyard', 177, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 0.2, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, '${VINE_SKILL}', 50), (w, u, 'brewing', 40), (w, u, 'fine_carpentry', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform land_set_tile(w, x, y, ${TileType.Grass}) from generate_series(0, 63) x, generate_series(0, 63) y;
  -- A thorn bush beside where she stands, a rose bush beyond it, and sand under the second trellis.
  perform land_set_tile(w, 11, 10, ${TileType.Bush});
  perform land_set_data(w, 11, 10, ${THORN});
  perform land_set_tile(w, 11, 11, ${TileType.Bush});
  perform land_set_data(w, 11, 11, ${ROSE});
  perform land_set_tile(w, 9, 11, ${TileType.Sand});

  -- 1. A cutting off a thorn bush: refused with no sickle, and on a rose bush; cut once, then refused.
  ${askIsle('C:rose', CUT_VINE, TILE(11, 11))}
  ${askIsle('C:nosickle', CUT_VINE, TILE(11, 10))}
  perform give(w, u, 'sickle', 1, 50);
  ${askIsle('C:none', CUT_VINE, TILE(11, 10))}
  perform pg_temp.dice('0.5');
  perform act_perform(w, u, '${CUT_VINE}', ${TILE(11, 10)});
  perform pg_temp.nodice();
  insert into said values ('C:cut', ${count(GRAPE_CUTTING)} || '|' || ${lastSaid});
  ${askIsle('C:again', CUT_VINE, TILE(11, 10))}

  -- 2. A trellis built and set down on grass, and another on sand.
  perform give(w, u, 'mallet', 1, 50);
  v_it := give(w, u, 'plank', 8, 40);
  perform give(w, u, 'shaft', 12, 40);
  perform give(w, u, 'nail', 24, 40);
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${TRELLIS}', jsonb_build_object('kind', 'item', 'uid', v_it));
  perform perform_craft(w, u, 'make_${TRELLIS}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'plank' limit 1)));
  perform pg_temp.nodice();
  insert into said values ('BUILT', ${count(TRELLIS)}::text);
  select id into v_it from item where world_id = w and holder_uid = u and def = '${TRELLIS}' order by id limit 1;
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 10, 'y', 11, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_tr from placed where world_id = w and kind = 'furniture' and sub = '${TRELLIS}' order by id desc limit 1;
  select id into v_it from item where world_id = w and holder_uid = u and def = '${TRELLIS}' order by id limit 1;
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 9, 'y', 11, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_tr2 from placed where world_id = w and kind = 'furniture' and sub = '${TRELLIS}' and id <> v_tr;
  insert into said values ('PLACED', coalesce(v_tr::text, 'none') || '|' || coalesce(v_tr2::text, 'none'));

  -- 3. Planting: nothing grows on it yet; refused on sand; planted; refused again.
  ${at(T_PLANT)}
  ${askIsle('P:none', PICK_GRAPES, T('v_tr'))}
  ${askIsle('P:sand', PLANT_VINE, T('v_tr2'))}
  ${askIsle('P:gone', PLANT_VINE, T('987654'))}
  update player set x = 20.5, y = 20.5 where world_id = w and uid = u;
  ${askIsle('P:far', PLANT_VINE, T('v_tr'))}
  update player set x = 10.5, y = 10.5 where world_id = w and uid = u;
  ${askIsle('P:ok', PLANT_VINE, T('v_tr'))}
  perform act_perform(w, u, '${PLANT_VINE}', ${T('v_tr')});
  insert into said select 'P:planted', pl.vine_at::text || '|' || ${count(GRAPE_CUTTING)} || '|' || ${lastSaid} from placed pl where pl.id = v_tr;
  ${askIsle('P:has', PLANT_VINE, T('v_tr'))}
  ${askIsle('P:nocutting', PLANT_VINE, T('v_tr2'))}

  -- 4. Picking, through the year.
  ${at(T_YOUNG)}
  ${askIsle('G:young', PICK_GRAPES, T('v_tr'))}
  ${at(T_SPRING)}
  ${askIsle('G:spring', PICK_GRAPES, T('v_tr'))}
  ${at(T_WINTER)}
  ${askIsle('G:winter', PICK_GRAPES, T('v_tr'))}
  ${at(T_SUMMER)}
  ${askIsle('G:summer', PICK_GRAPES, T('v_tr'))}
  ${at(T_AUTUMN)}
  ${askIsle('G:autumn', PICK_GRAPES, T('v_tr'))}
  perform pg_temp.dice('0.5');
  perform act_perform(w, u, '${PICK_GRAPES}', ${T('v_tr')});
  perform pg_temp.nodice();
  insert into said select 'G:picked', ${count(GRAPE)} || '|' || pl.picked_at::text || '|' || ${lastSaid} from placed pl where pl.id = v_tr;
  ${at(T_RESTING)}
  ${askIsle('G:resting', PICK_GRAPES, T('v_tr'))}
  ${at(T_AGAIN)}
  ${askIsle('G:again', PICK_GRAPES, T('v_tr'))}
  perform pg_temp.dice('0.5');
  perform act_perform(w, u, '${PICK_GRAPES}', ${T('v_tr')});
  perform act_perform(w, u, '${PICK_GRAPES}', ${T('v_tr')});
  perform pg_temp.nodice();
  insert into said values ('G:twice', ${count(GRAPE)}::text);
  perform set_config('wurm.vine_now', '', true);

  -- 5. Grape wine: refused a grape short, set going, and its ageing stamped.
  v_it := give(w, u, 'barrel', 1, 30);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 10, 'y', 9, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_bar from placed where world_id = w and kind = 'furniture' and sub = 'barrel';
  update placed set liquid = 'water', litres = 80 where id = v_bar;
  delete from item where world_id = w and holder_uid = u and def = '${GRAPE}';
  perform give(w, u, '${GRAPE}', ${GRAPE_WINE_GRAPES - 1}, 60);
  insert into said values ('B:short', coalesce(act_refusal(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_bar, 'brew', 'grape_wine')), 'none'));
  perform give(w, u, '${GRAPE}', 1, 60);
  insert into said values ('B:ok', coalesce(act_refusal(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_bar, 'brew', 'grape_wine')), 'none'));
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_bar, 'brew', 'grape_wine'));
  perform pg_temp.nodice();
  v_now := extract(epoch from now())::double precision;
  insert into said select 'B:set', pl.liquid || '|' || pl.litres || '|' || ${count(GRAPE)} || '|' || pl.ferment || '|'
      || (pl.aged_from = v_now + pl.ferment)::text || '|' || is_working(pl)::text || '|' || wine_age_says(pl, v_now) || '|' || ${lastSaid}
    from placed pl where pl.id = v_bar;
  insert into said values ('NOW', v_now::text);
  -- What every browser that can see them is handed: the vine's two moments and the wine's.
  insert into said values ('GROUND', rpc_ground(w, 40, false)::text);
  insert into said select 'R:vine', v_tr || '|' || pl.vine_at::text || '|' || pl.picked_at::text from placed pl where pl.id = v_tr;
  insert into said select 'R:wine', v_bar || '|' || pl.aged_from::text from placed pl where pl.id = v_bar;

  -- 6. Aged so many days, out of a cellar and in one, at two QLs: the QL, and what Examine says.
  for v_c in 0..1 loop
    for v_i in 1..array_length(v_ages, 1) loop
      update placed set ql = ${BASE}, level = case when v_c = 1 then -1 else 0 end, litres = 15, ferment = 0,
          aged_from = v_now - v_ages[v_i] where id = v_bar;
      select * into p from placed where id = v_bar;
      insert into said values ('A:' || v_c || ':' || v_i, brew_ql(p, v_now)::text || '|' || vessel_says(p));
      update placed set ql = ${TOP} where id = v_bar;
      select * into p from placed where id = v_bar;
      insert into said values ('A:top:' || v_c || ':' || v_i, brew_ql(p, v_now)::text);
    end loop;
  end loop;

  -- 7. A drink straight from the barrel, ten days in a cellar: the knack is the aged QL's.
  update placed set ql = ${BASE}, level = -1, litres = 15, aged_from = v_now - 10 * day_seconds() where id = v_bar;
  update player set boons = '[]'::jsonb where world_id = w and uid = u;
  perform act_perform(w, u, 'drink_from_vessel', ${T('v_bar')});
  insert into said select 'D:left', pl.litres::text from placed pl where pl.id = v_bar;
  select (boons->0->>'until')::double precision - world_time(w) into v_boon from player where world_id = w and uid = u;
  insert into said values ('D:boon', round(v_boon)::text);

  -- 8. Drawn dry, it forgets its age; water poured in and a brew set going again stamps it anew.
  perform draw_from(v_bar, (select litres from placed where id = v_bar));
  insert into said select 'E:dry', coalesce(pl.liquid, '-') || '|' || coalesce(pl.aged_from::text, '-') from placed pl where pl.id = v_bar;
  update placed set liquid = 'water', litres = 80 where id = v_bar;
  insert into said select 'E:water', coalesce(pl.aged_from::text, '-') from placed pl where pl.id = v_bar;
  update placed set liquid = 'ale', litres = 15, ferment = 900, since = now() where id = v_bar;
  insert into said select 'E:ale', coalesce(pl.aged_from::text, '-') from placed pl where pl.id = v_bar;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------------------------- */

const g = Game.create(177, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.skills.values.set(VINE_SKILL, 50);
g.skills.values.set('brewing', 40);
g.skills.values.set('fine_carpentry', 60);
w.setTile(11, 10, TileType.Bush, THORN);
w.setTile(11, 11, TileType.Bush, ROSE);
w.setTile(9, 11, TileType.Sand);
let now = T_PLANT;
g.wallClock = () => now;
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said.filter((m) => !/^Your .* (rises|improves)|^You feel/.test(m)).slice(-1)[0] ?? '';
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
const ask = (id: string, t: Target): string => act(id).check?.(t, g) ?? 'none';
const piece = (id: number): Target => ({ kind: 'furniture', id } as Target);
const tile = (x: number, y: number): Target => ({ kind: 'tile', x, y } as Target);
const same = (k: string, here: string, want?: string): void => {
  check(`${k}: “${here}”, the same on both sides${want === undefined ? '' : ' and as the rule says'}`, isle.get(k) === here && (want === undefined || here === want),
    `${isle.get(k)} / ${here}${want === undefined ? '' : ` / ${want}`}`);
};

/* 1. The cutting. */
same('C:rose', ask(CUT_VINE, tile(11, 11)), VINE_SAID.noWild);
same('C:nosickle', ask(CUT_VINE, tile(11, 10)), VINE_SAID.noTool);
thing('sickle', 50);
same('C:none', ask(CUT_VINE, tile(11, 10)), 'none');
dice(0.5);
act(CUT_VINE).perform(tile(11, 10), g);
check(`a thorn bush gives one cutting, said the same way on both sides: “${lastHere()}”`,
  part('C:cut', 0) === '1' && held(GRAPE_CUTTING) === 1 && part('C:cut', 1).startsWith(cutVineSaid(0).split('(')[0]) && lastHere().startsWith(cutVineSaid(0).split('(')[0]),
  isle.get('C:cut'));
same('C:again', ask(CUT_VINE, tile(11, 10)), VINE_SAID.cut);

/* 2. Two trellises. */
thing('mallet', 50);
const planks = thing('plank', 40, 8);
thing('shaft', 40, 12);
thing('nail', 40, 24);
dice(0.01);
act(`make_${TRELLIS}`).perform({ kind: 'item', uid: planks.uid }, g);
act(`make_${TRELLIS}`).perform({ kind: 'item', uid: (g.inventory.items.find((it) => it.id === 'plank') as Item).uid }, g);
check('two trellises are built on both sides', isle.get('BUILT') === '2' && held(TRELLIS) === 2, `${isle.get('BUILT')} / ${held(TRELLIS)}`);
const setDown = (x: number, y: number): PlacedFurniture => {
  const it = g.inventory.items.find((i) => i.id === TRELLIS) as Item;
  act('place_furniture').perform({ kind: 'tile', x, y, sx: 1, sy: 1, itemUid: it.uid, facing: 's' } as Target, g);
  return [...g.furniture.values()].filter((p) => p.kind === TRELLIS).sort((a, b) => b.id - a.id)[0];
};
const tr = setDown(10, 11);
const tr2 = setDown(9, 11);
check('and set down, on grass and on sand', part('PLACED', 0) !== 'none' && part('PLACED', 1) !== 'none' && tr.id !== tr2.id && held(TRELLIS) === 0, isle.get('PLACED'));

/* 3. Planting. */
same('P:none', ask(PICK_GRAPES, piece(tr.id)), VINE_SAID.none);
same('P:sand', ask(PLANT_VINE, piece(tr2.id)), VINE_SAID.soil);
same('P:gone', ask(PLANT_VINE, piece(987654)), 'It is gone.');
g.putBody(20.5, 20.5, 0);
same('P:far', ask(PLANT_VINE, piece(tr.id)), lampTooFar('trellis'));
g.putBody(10.5, 10.5, 0);
same('P:ok', ask(PLANT_VINE, piece(tr.id)), 'none');
act(PLANT_VINE).perform(piece(tr.id), g);
check(`planted at the moment it is, the cutting spent, and said the same: “${lastHere()}”`,
  part('P:planted', 0) === String(T_PLANT) && tr.vineAt === T_PLANT && part('P:planted', 1) === '0' && held(GRAPE_CUTTING) === 0
    && part('P:planted', 2) === lastHere() && lastHere() === vinePlantedSaid(), isle.get('P:planted'));
same('P:has', ask(PLANT_VINE, piece(tr.id)), VINE_SAID.has);
same('P:nocutting', ask(PLANT_VINE, piece(tr2.id)), VINE_SAID.soil);

/* 4. Picking through the year. */
now = T_YOUNG;
same('G:young', ask(PICK_GRAPES, piece(tr.id)), VINE_SAID.young);
for (const [k, t] of [['G:spring', T_SPRING], ['G:winter', T_WINTER], ['G:summer', T_SUMMER]] as Array<[string, number]>) {
  now = t;
  same(k, ask(PICK_GRAPES, piece(tr.id)), vineSeasonSaid(t));
  check(`and ${seasonAt(t).season} gives no grapes: the vine is ${vineStage(tr, t)}`, vineStage(tr, t) === 'waiting' && held(GRAPE) === 0);
}
now = T_AUTUMN;
same('G:autumn', ask(PICK_GRAPES, piece(tr.id)), 'none');
dice(0.5);
act(PICK_GRAPES).perform(piece(tr.id), g);
const n50 = grapesFor(50);
check(`picked in ${GRAPE_SEASON}: ${n50} grapes at forestry 50 on both sides, the moment kept, and said the same: “${lastHere()}”`,
  part('G:picked', 0) === String(n50) && held(GRAPE) === n50 && part('G:picked', 1) === String(T_AUTUMN) && tr.pickedAt === T_AUTUMN
    && part('G:picked', 2).replace(/\(QL [\d.]+\)/, '') === lastHere().replace(/\(QL [\d.]+\)/, ''), isle.get('G:picked'));
now = T_RESTING;
same('G:resting', ask(PICK_GRAPES, piece(tr.id)), VINE_SAID.picked);
now = T_AGAIN;
same('G:again', ask(PICK_GRAPES, piece(tr.id)), 'none');
dice(0.5);
act(PICK_GRAPES).perform(piece(tr.id), g);
act(PICK_GRAPES).perform(piece(tr.id), g);
check('and picked again a day on, but not twice running', isle.get('G:twice') === String(2 * n50) && held(GRAPE) === 2 * n50, `${isle.get('G:twice')} / ${held(GRAPE)}`);

/* 5. Grape wine. */
g.wallClock = null;
const barrelItem = thing('barrel', 30);
act('place_furniture').perform({ kind: 'tile', x: 10, y: 9, sx: 1, sy: 1, itemUid: barrelItem.uid, facing: 's' } as Target, g);
const bar = [...g.furniture.values()].find((p) => p.kind === 'barrel') as PlacedFurniture;
bar.liquid = 'water';
bar.litres = 80;
g.inventory.items = g.inventory.items.filter((it) => it.id !== GRAPE);
thing(GRAPE, 60, GRAPE_WINE_GRAPES - 1);
const brewAt = { kind: 'furniture', id: bar.id, brew: 'grape_wine' } as Target;
same('B:short', ask('start_brew', brewAt));
thing(GRAPE, 60, 1);
same('B:ok', ask('start_brew', brewAt), 'none');
dice(0.01);
const before = Date.now() / 1000;
act('start_brew').perform(brewAt, g);
check(`grape wine is set going from ${GRAPE_WINE_GRAPES} grapes on both sides, said the same, and nothing to say of its age while it works`,
  part('B:set', 0) === 'grape_wine' && (bar.liquid as string) === 'grape_wine' && part('B:set', 1) === String(brew?.litres) && bar.litres === brew?.litres
    && part('B:set', 2) === '0' && held(GRAPE) === 0 && part('B:set', 3) === String(brew?.time) && bar.ferment === brew?.time
    && part('B:set', 5) === 'true' && part('B:set', 6) === '' && wineAgeSays(bar, Date.now() / 1000) === '' && part('B:set', 7) === lastHere(),
  `${isle.get('B:set')} / ${lastHere()}`);
check('its ageing is stamped as it is set going: the moment it will stop working, on both sides',
  part('B:set', 4) === 'true' && bar.agedFrom !== undefined && bar.agedFrom >= before + (brew?.time ?? 0) && bar.agedFrom <= Date.now() / 1000 + (brew?.time ?? 0) + 1,
  `${part('B:set', 4)} / ${bar.agedFrom}`);

{
  const seen = Game.create(177, 64);
  seen.sawGround(JSON.parse(isle.get('GROUND') ?? '{}') as IslandGround);
  const vine = seen.furniture.get(Number(part('R:vine', 0)));
  const wine = seen.furniture.get(Number(part('R:wine', 0)));
  check('and the ground read hands every browser the vine\'s two moments and the wine\'s, as the island keeps them',
    vine?.kind === TRELLIS && String(vine.vineAt) === part('R:vine', 1) && String(vine.pickedAt) === part('R:vine', 2)
      && wine?.kind === 'barrel' && String(wine.agedFrom) === part('R:wine', 1) && wine.liquid === 'grape_wine',
    `${isle.get('R:vine')} ${isle.get('R:wine')} / ${vine?.vineAt} ${vine?.pickedAt} ${wine?.agedFrom}`);
}

/* 6. Aged. */
const NOW = Number(isle.get('NOW'));
let qlOk = true;
let saysOk = true;
let capOk = true;
const detail: string[] = [];
for (const c of [0, 1]) {
  AGES.forEach((age, i) => {
    const f: PlacedFurniture = { ...bar, items: [], ql: BASE, level: c ? -1 : undefined, litres: 15, ferment: 0, agedFrom: NOW - age, liquid: 'grape_wine' };
    const ql = brewQl(f, NOW);
    const [qlIsle, saysIsle] = (isle.get(`A:${c}:${i + 1}`) ?? '').split('|');
    if (qlIsle !== String(ql)) { qlOk = false; detail.push(`${c}:${age / DAY}d ${qlIsle} vs ${ql}`); }
    if (saysIsle !== vesselSays(f, NOW)) { saysOk = false; detail.push(`${saysIsle} vs ${vesselSays(f, NOW)}`); }
    const top = brewQl({ ...f, ql: TOP }, NOW);
    if (isle.get(`A:top:${c}:${i + 1}`) !== String(top)) { qlOk = false; detail.push(`top ${c}:${age / DAY}d ${isle.get(`A:top:${c}:${i + 1}`)} vs ${top}`); }
    if (ql > BASE + WINE_AGE_CAP || top > 100 || ql !== Math.min(100, BASE + Math.min(WINE_AGE_CAP, WINE_AGE_RATE * (c ? CELLAR_AGEING : 1) * age / DAY))) capOk = false;
  });
}
check(`a barrel of grape wine at QL ${BASE} is at the same QL to the last bit on both sides after ${AGES.map((a) => a / DAY).join(', ')} days, in a cellar and out`, qlOk, detail.slice(0, 4).join('; '));
const q = (days: number, cellar: boolean, base = BASE): number => brewQl({ ...bar, items: [], ql: base, level: cellar ? -1 : undefined, litres: 15, agedFrom: NOW - days * DAY, liquid: 'grape_wine' }, NOW);
check(`ten days out of a cellar it is QL ${q(10, false)}, ten in one QL ${q(10, true)}; capped at ${BASE + WINE_AGE_CAP}, and at a QL of ${TOP} at 100`, capOk
  && q(10, false) === BASE + 10 * WINE_AGE_RATE && q(10, true) === BASE + WINE_AGE_CAP && q(3, true) === BASE + 3 * WINE_AGE_RATE * CELLAR_AGEING
  && q(1000, false) === BASE + WINE_AGE_CAP && q(1000, true, TOP) === 100 && q(1, false, TOP) === TOP + WINE_AGE_RATE);
const sayTen = vesselSays({ ...bar, items: [], ql: BASE, level: -1, litres: 15, agedFrom: NOW - 7.3 * DAY, liquid: 'grape_wine' }, NOW);
check(`Examine says its age and its gain, with the rate and the cap, the same on both sides: “${sayTen}”`, saysOk
  && sayTen.includes(`${fixedTo(WINE_AGE_RATE * CELLAR_AGEING, 2)} QL a day`) && sayTen.includes(`up to +${fixedTo(WINE_AGE_CAP, 2)}`) && sayTen.includes('Kept 7.3 days in a cellar'),
  detail.slice(0, 2).join('; '));

/* 7. A drink straight from the barrel. */
const aged10 = q(10, true);
const boonWant = boonTime('grape_wine_bucket', aged10);
check(`a drink from the barrel ten days in a cellar leaves a knack at its aged QL ${aged10}: ${boonWant} seconds, not ${boonTime('grape_wine_bucket', BASE)}`,
  Math.abs(Number(isle.get('D:boon')) - boonWant) <= 1 && boonWant !== boonTime('grape_wine_bucket', BASE), isle.get('D:boon'));
bar.ql = BASE;
bar.level = -1;
bar.litres = 15;
bar.ferment = 0;
bar.agedFrom = Date.now() / 1000 - 10 * DAY;
g.player.boons = [];
g.player.stats.thirst = 0.2;
act('drink_from_vessel').perform(piece(bar.id), g);
const boonHere = (g.player.boons[0]?.until ?? 0) - g.time;
check(`and the same in the browser: ${Math.round(boonHere)} seconds`, Math.abs(boonHere - boonWant) <= 1, String(boonHere));

/* 8. Drawn dry and set going again. */
check('drawn dry it forgets its age; water poured in has none; a brew that does not age is stamped with none',
  isle.get('E:dry') === '-|-' && isle.get('E:water') === '-' && isle.get('E:ale') === '-', `${isle.get('E:dry')} ${isle.get('E:water')} ${isle.get('E:ale')}`);

/* ---- what was found ------------------------------------------------------------------------------- */

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nvineyards — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
