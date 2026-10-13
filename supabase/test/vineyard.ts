/**
 * Vineyards and wine that ages (`vineyard.ts`, `ageing.ts`), on both sides.
 *
 * The trellis, the grape, the cutting, grape wine and its brew, and every
 * number and sentence, the same on both sides; a cutting off a thorn bush
 * with a sickle, once; a cutting planted on a trellis on soil and refused
 * off it; the vine too young to bear, then picked in autumn for the grapes
 * its picker's forestry gives, resting a day and picked again, and refused
 * in every other season with when it fruits -- at the same moments, in the
 * same words; a trellis set down only on the ground outside a building
 * against the outer face of a finished solid wall or window, facing it, in
 * the row of subtiles along that side -- refused with no wall, on a wall's
 * inside, on another building's tile, upstairs, against an unfinished wall,
 * a door, a bay or a hidden door its padlock admits you through, in the
 * same words -- turned round to its tile's next such wall or refused, and
 * left standing, vine and all, when its wall is taken down; grape wine set going from its grapes, its ageing stamped as it
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
import { ageGain, ageingRule, brewQl, CELLAR_AGEING, fixedTo, WINE_AGE_CAP, WINE_AGE_RATE, wineAgeSays } from '../../src/game/ageing';
import { boonTime } from '../../src/game/boons';
import { BREW_BY_ID, BREWS, GRAPE_WINE_GRAPES, WINE_AGEING } from '../../src/game/brewing';
import { cellarOutdoor } from '../../src/game/cellar';
import { FURNITURE_BY_ID, furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { lampTooFar } from '../../src/game/lamps';
import { DAY_SECONDS } from '../../src/game/pace';
import { vesselSays } from '../../src/game/placeables';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  CUT_VINE, cutVineSaid, GRAPE, GRAPE_CUTTING, GRAPE_SEASON, GRAPES_A_PICK, GRAPES_BASE, GRAPES_SPAN, grapesFor, grapesSaid, PICK_GRAPES, PLANT_VINE,
  settleTrellises, TRELLIS, TRELLIS_WALLS, trellisAgainstSaid, trellisFacing, trellisReturnedSaid, untilGrapes, VINE_BEARS, VINE_REST, VINE_SAID, VINE_SKILL, VINE_SOIL, vinePlantedSaid, vineSeasonSaid, vineStage, WILD_VINE,
} from '../../src/game/vineyard';
import { SUBTILES } from '../../src/game/crates';
import { WALL_TYPES, type Building, type Side, type WallType } from '../../src/game/building';
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
const trellisDef = FURNITURE_BY_ID.get(TRELLIS);
check(`it runs the width of its tile on both sides: ${trellisDef?.w} subtiles by ${trellisDef?.h}`,
  trellisDef?.w === SUBTILES && trellisDef.h === 1 && psql(`select w || 'x' || h from furniture_def where id = '${TRELLIS}'`) === `${SUBTILES}x1`);
check(`it is set against the same wall types on both sides, off their table: ${TRELLIS_WALLS.join(', ')}`,
  psql(`select string_agg(id, ',' order by id) from wall_type_def where trellis`) === [...TRELLIS_WALLS].sort().join(',')
    && [...TRELLIS_WALLS].sort().join(',') === 'solid,window' && WALL_TYPES.filter((t) => t.trellis).every((t) => !t.passable && !t.low));
const itemsIsle = psql(`select string_agg(d.id || ':' || d.name || ':' || d.description, '#' order by d.id) from item_def d
  where d.id in ('${GRAPE}', '${GRAPE_CUTTING}', '${TRELLIS}', 'grape_wine_bucket')`);
check('the grape, the cutting, the trellis and the bucket of grape wine are the same things on both sides, with nothing left to fill in',
  itemsIsle === [GRAPE, GRAPE_CUTTING, 'grape_wine_bucket', TRELLIS].sort().map((id) => `${id}:${ITEM_DEFS[id].name}:${ITEM_DEFS[id].description}`).join('#')
    && !itemsIsle.includes('{'), itemsIsle.slice(0, 200));
check('the bucket of wine says how it ages, off the rule', ITEM_DEFS.wine_bucket.description?.includes(ageingRule(WINE_AGEING)) === true
  && ITEM_DEFS.grape_wine_bucket.description?.includes(`${WINE_AGE_RATE} QL a day`) === true);
const numbersIsle = psql(`select concat_ws('|', grape_season(), vine_bears(), vine_rest(), grapes_a_pick(), grapes_base(), grapes_span(), vine_skill(),
  wild_vine(), age_rate('grape_wine'), age_cap('grape_wine'), cellar_ageing(), day_seconds(),
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
const KEYS = ['none', 'young', 'picked', 'has', 'soil', 'noCutting', 'noWild', 'cut', 'noTool', 'wall', 'turn', 'upstairs', 'inside', 'noWall', 'unfinished'] as const;
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
const gainIsle = psql(`select string_agg(age_gain('grape_wine', a, false)::text || '/' || age_gain('grape_wine', a, true)::text, ',' order by o)
  from unnest(array[${AGES.join(', ')}]::double precision[]) with ordinality u(a, o)`);
const wineGain = (age: number, cellar: boolean): number => ageGain('grape_wine', age, cellar);
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

/*
 * Where a trellis stands. An L-shaped house of three tiles -- (21, 21), (22, 21)
 * and (21, 22) -- with a house of one on the foot of the L at (21, 23), and a
 * house of one at (26, 21) whose way in is a hidden door. Its walls, by the
 * border they stand on (`h`: a tile's north border, `v` its west):
 */
const HIDDEN_LOCK = 4242;
const WALLS: Array<{ dir: 'h' | 'v'; x: number; y: number; b: number; type: WallType; done: boolean; lock?: number }> = [
  { dir: 'h', x: 21, y: 21, b: 96, type: 'solid', done: true }, // the L's north wall: outside it (21, 20), inside it (21, 21)
  { dir: 'h', x: 22, y: 21, b: 96, type: 'door', done: true }, // a door, outside it (22, 20)
  { dir: 'v', x: 23, y: 21, b: 96, type: 'solid', done: false }, // the east wall, still going up: outside it (23, 21)
  { dir: 'v', x: 21, y: 21, b: 96, type: 'window', done: true }, // a window on the west: outside it (20, 21)
  { dir: 'h', x: 22, y: 22, b: 96, type: 'solid', done: true }, // the inner corner of the L, (22, 22): a wall north
  { dir: 'v', x: 22, y: 22, b: 96, type: 'solid', done: true }, // and a wall west
  { dir: 'v', x: 21, y: 22, b: 96, type: 'bay', done: true }, // a bay window on the west of the foot: outside it (20, 22)
  { dir: 'h', x: 21, y: 23, b: 96, type: 'solid', done: true }, // the L's south wall, whose other face is the house next door's inside
  { dir: 'h', x: 26, y: 21, b: 98, type: 'hidden_door', done: true, lock: HIDDEN_LOCK }, // a hidden door, outside it (26, 20)
];
/**
 * Trellises from before one took a whole row of a tile, as they were left:
 * at (40, 40) three facing south, the middle one with a vine, and one facing
 * east sharing the corner; at (42, 40) two facing north, a chest in their row;
 * at (44, 40) two facing west, the newer one somebody else's who has left.
 */
const SETTLE: Array<{ kind: string; x: number; y: number; sx: number; sy: number; f: Side; ql: number; vine?: boolean; owner: boolean }> = [
  { kind: TRELLIS, x: 40, y: 40, sx: 0, sy: 1, f: 's', ql: 31, owner: true },
  { kind: TRELLIS, x: 40, y: 40, sx: 2, sy: 2, f: 's', ql: 32, vine: true, owner: true },
  { kind: TRELLIS, x: 40, y: 40, sx: 3, sy: 0, f: 's', ql: 33, owner: true },
  { kind: TRELLIS, x: 40, y: 40, sx: 1, sy: 1, f: 'e', ql: 34, owner: true },
  { kind: 'chest', x: 42, y: 40, sx: 2, sy: 0, f: 's', ql: 40, owner: true },
  { kind: TRELLIS, x: 42, y: 40, sx: 0, sy: 2, f: 'n', ql: 35, vine: true, owner: true },
  { kind: TRELLIS, x: 42, y: 40, sx: 1, sy: 1, f: 'n', ql: 36, owner: true },
  { kind: TRELLIS, x: 44, y: 40, sx: 2, sy: 2, f: 'w', ql: 37, owner: true },
  { kind: TRELLIS, x: 44, y: 40, sx: 1, sy: 3, f: 'w', ql: 38, owner: false },
];
/**
 * And settled with the definitions still a spot across: at (50, 40) a trellis
 * facing south with a chest at the far end of its row, which goes back; and
 * one alone facing south, east and west, each kept with its centre in the
 * middle of its row.
 */
const FOOT: Array<{ kind: string; x: number; y: number; sx: number; sy: number; f: Side }> = [
  { kind: TRELLIS, x: 50, y: 40, sx: 0, sy: 1, f: 's' },
  { kind: 'chest', x: 50, y: 40, sx: 2, sy: 3, f: 's' },
  { kind: TRELLIS, x: 52, y: 40, sx: 1, sy: 1, f: 's' },
  { kind: TRELLIS, x: 54, y: 40, sx: 1, sy: 1, f: 'e' },
  { kind: TRELLIS, x: 56, y: 40, sx: 1, sy: 1, f: 'w' },
];
/** What each place says, asked from the tile it is asked of, on the ground but where `level` says. */
type Want = 'ok' | 'upstairs' | 'inside' | 'noWall' | 'unfinished' | WallType;
const ASKS: Array<{ k: string; x: number; y: number; f: Side; level?: number; want: Want }> = [
  { k: 'out', x: 21, y: 20, f: 's', want: 'ok' },
  { k: 'inside', x: 21, y: 21, f: 'n', want: 'inside' },
  { k: 'nowall', x: 24, y: 20, f: 's', want: 'noWall' },
  { k: 'door', x: 22, y: 20, f: 's', want: 'door' },
  { k: 'bay', x: 20, y: 22, f: 'e', want: 'bay' },
  { k: 'unfinished', x: 23, y: 21, f: 'w', want: 'unfinished' },
  { k: 'window', x: 20, y: 21, f: 'e', want: 'ok' },
  { k: 'nextdoor', x: 21, y: 23, f: 'n', want: 'inside' },
  { k: 'cornerN', x: 22, y: 22, f: 'n', want: 'ok' },
  { k: 'cornerW', x: 22, y: 22, f: 'w', want: 'ok' },
  { k: 'cornerS', x: 22, y: 22, f: 's', want: 'noWall' },
  { k: 'hidden', x: 26, y: 20, f: 's', want: 'ok' },
  { k: 'upstairs', x: 21, y: 20, f: 's', level: 1, want: 'upstairs' },
];

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
create function pg_temp.stand(p_w uuid, p_u uuid, p_x int, p_y int, p_lv int) returns void language sql as $f$
  update player set x = p_x + 0.5, y = p_y + 0.5, level = p_lv where world_id = p_w and uid = p_u
$f$;
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

  -- 2. A trellis built and set down on grass, and another on sand, against the north wall of a house to the south.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 95, 'Press house', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 95, 9, 12), (w, 95, 10, 12);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 0, 'h', 9, 12, 95, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u), (w, 0, 'h', 10, 12, 95, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u);
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
  ${askIsle('PLACE:ok', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 10, 'y', 11, 'sx', 1, 'sy', 1, 'facing', 's')`)}
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

  -- 9. Where a trellis stands: an L-shaped house of three tiles, a house of one on the foot of the L, and a house behind a hidden door.
  insert into building (world_id, id, name, levels, work_level, planned_by)
    values (w, 96, 'Wine house', 1, 0, u), (w, 97, 'Next door', 1, 0, u), (w, 98, 'Hidden house', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 96, 21, 21), (w, 96, 22, 21), (w, 96, 21, 22), (w, 97, 21, 23), (w, 98, 26, 21);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by, lock)
    select w, 0, d, wx, wy, b, t, 'plank', case when done then '{"plank":0}' else '{"plank":24}' end::jsonb, '{"plank":24}'::jsonb, u, k
      from (values ${WALLS.map((x) => `('${x.dir}', ${x.x}, ${x.y}, ${x.b}, '${x.type}', ${x.done}, ${x.lock ?? 'null'}::bigint)`).join(', ')}) v(d, wx, wy, b, t, done, k);
  v_it := give(w, u, '${TRELLIS}', 1, 40);
  ${ASKS.map((a) => `perform pg_temp.stand(w, u, ${a.x}, ${a.y}, ${a.level ?? 0});
  ${askIsle(`W:${a.k}`, 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', ${a.x}, 'y', ${a.y}, 'sx', 1, 'sy', 1, 'facing', '${a.f}')`)}`).join('\n  ')}
  -- With the key to the hidden door it is a door to her, and refused.
  insert into item (world_id, holder, holder_uid, def, ql, count, keyed) values (w, 'player', u, 'key', 30, 1, ${HIDDEN_LOCK});
  perform pg_temp.stand(w, u, 26, 20, 0);
  ${askIsle('W:hiddenKey', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 26, 'y', 20, 'sx', 1, 'sy', 1, 'facing', 's')`)}
  delete from item where world_id = w and holder_uid = u and def = 'key';
  -- The unfinished wall finished.
  update wall set needed = '{"plank":0}' where world_id = w and dir = 'v' and x = 23 and y = 21;
  perform pg_temp.stand(w, u, 23, 21, 0);
  ${askIsle('W:finished', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 23, 'y', 21, 'sx', 1, 'sy', 1, 'facing', 'w')`)}
  -- Set down outside the north wall, asked for in the middle of the tile: facing it, in the row along it.
  perform pg_temp.stand(w, u, 21, 20, 0);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 21, 'y', 20, 'sx', 2, 'sy', 1, 'facing', 's'));
  select id into v_tr from placed where world_id = w and kind = 'furniture' and sub = '${TRELLIS}' and x = 21 and y = 20;
  insert into said select 'W:placed', pl.facing || '|' || pl.sx || '|' || pl.sy || '|' || pl.cx || '|' || pl.cy from placed pl where pl.id = v_tr;
  -- And in the inner corner of the L, facing north; turned, it goes round past east and south to the west wall.
  v_it := give(w, u, '${TRELLIS}', 1, 40);
  perform pg_temp.stand(w, u, 22, 22, 0);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 22, 'y', 22, 'sx', 3, 'sy', 2, 'facing', 'n'));
  select id into v_tr2 from placed where world_id = w and kind = 'furniture' and sub = '${TRELLIS}' and x = 22 and y = 22;
  insert into said select 'W:corner', pl.facing || '|' || pl.sx || '|' || pl.sy from placed pl where pl.id = v_tr2;
  ${askIsle('W:turnOk', 'turn_furniture', T('v_tr2'))}
  perform act_perform(w, u, 'turn_furniture', ${T('v_tr2')});
  insert into said select 'W:turned', pl.facing || '|' || pl.sx || '|' || pl.sy || '|' || ${lastSaid} from placed pl where pl.id = v_tr2;
  -- And a second in the same corner, against the north wall: the two share the corner spot.
  v_it := give(w, u, '${TRELLIS}', 1, 40);
  ${askIsle('W:cornerTwo', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 22, 'y', 22, 'sx', 1, 'sy', 1, 'facing', 'n')`)}
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 22, 'y', 22, 'sx', 1, 'sy', 1, 'facing', 'n'));
  insert into said select 'W:corners', string_agg(pl.facing || ':' || pl.sx || ',' || pl.sy, ' ' order by pl.facing) from placed pl
    where pl.world_id = w and pl.kind = 'furniture' and pl.sub = '${TRELLIS}' and pl.x = 22 and pl.y = 22;
  -- But not a chest in that corner spot, nor a third trellis along the same wall.
  v_it := give(w, u, 'chest', 1, 40);
  ${askIsle('W:cornerChest', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 22, 'y', 22, 'sx', 0, 'sy', 0, 'facing', 's')`)}
  v_it := give(w, u, '${TRELLIS}', 1, 40);
  ${askIsle('W:cornerThird', 'place_furniture', `jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', 22, 'y', 22, 'sx', 1, 'sy', 1, 'facing', 'n')`)}
  delete from item where id = v_it;
  -- The one against the north wall has no other wall on its tile to turn to.
  perform pg_temp.stand(w, u, 21, 20, 0);
  ${askIsle('W:turnNone', 'turn_furniture', T('v_tr'))}
  -- Its wall taken down: that is not refused, and the trellis stays, a vine planted on it and picked as anywhere.
  ${askIsle('W:remove', 'remove_wall', `jsonb_build_object('kind', 'tile', 'x', 21, 'y', 20, 'side', 's')`)}
  perform act_perform(w, u, 'remove_wall', jsonb_build_object('kind', 'tile', 'x', 21, 'y', 20, 'side', 's'));
  insert into said select 'W:gone', count(*)::text || '|' || (select count(*) from placed pl where pl.id = v_tr)::text
    from wall where world_id = w and level = 0 and dir = 'h' and x = 21 and y = 21;
  perform give(w, u, '${GRAPE_CUTTING}', 1, 40);
  ${askIsle('W:plant', PLANT_VINE, T('v_tr'))}
  ${askIsle('W:turnGone', 'turn_furniture', T('v_tr'))}

  -- 10. Trellises from before a trellis took a whole row, several to a tile, settled one to a row (\`trellis_settle\`).
  delete from item where world_id = w and holder_uid = u and def in ('${TRELLIS}', '${GRAPE_CUTTING}');
  delete from event where world_id = w and uid = u;
  ${SETTLE.map((r) => `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, material, vine_at, rare)
    values (w, 'furniture', '${r.kind}', ${r.x}, ${r.y}, ${r.sx}, ${r.sy}, ${r.x} + 0.5, ${r.y} + 0.5, ${r.ql}, ${r.owner ? 'u' : 'null'}, '${r.f}', 'Oak', ${r.vine ? T_PLANT : 'null'}, ${r.owner ? 'null' : "'rare'"});`).join('\n  ')}
  insert into said values ('S:n', trellis_settle(w)::text);
  insert into said select 'S:left', string_agg(pl.x || ',' || pl.y || ',' || pl.facing || ',' || pl.sx || ',' || pl.sy || ',' || pl.ql || ',' || (pl.vine_at is not null), ' ' order by pl.x, pl.y, pl.facing)
    from placed pl where pl.world_id = w and pl.kind = 'furniture' and pl.sub = '${TRELLIS}' and pl.x >= 40;
  insert into said values ('S:pack', ${count(TRELLIS)} || '|' || ${count(GRAPE_CUTTING)});
  insert into said select 'S:ground', coalesce(string_agg(i.def || '@' || i.gx || ',' || i.gy || ':' || coalesce(i.rare, '-'), ' ' order by i.def), '') from item i where i.world_id = w and i.holder = 'ground' and i.gx >= 40;
  insert into said select 'S:told', string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind = 'event';

  -- 11. Settled while the definitions still have a trellis a single spot across, as on a deploy where they land after.
  update furniture_def set w = 1, h = 1 where id = '${TRELLIS}';
  delete from item where world_id = w and holder_uid = u and def = '${TRELLIS}';
  ${FOOT.map((r) => `insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, material)
    values (w, 'furniture', '${r.kind}', ${r.x}, ${r.y}, ${r.sx}, ${r.sy}, ${r.x} + 0.125, ${r.y} + 0.125, 40, u, '${r.f}', 'Oak');`).join('\n  ')}
  perform trellis_settle(w);
  insert into said select 'F:left', string_agg(pl.x || ',' || pl.y || ',' || pl.facing || ',' || pl.sx || ',' || pl.sy || ',' || pl.cx || ',' || pl.cy, ' ' order by pl.x)
    from placed pl where pl.world_id = w and pl.kind = 'furniture' and pl.sub = '${TRELLIS}' and pl.x >= 50;
  insert into said values ('F:back', ${count(TRELLIS)}::text);
  update furniture_def set w = ${SUBTILES}, h = 1 where id = '${TRELLIS}';
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
/** What a place in `ASKS` is to say: nothing, or which way it misses the wall. */
const wantSaid = (w: Want): string => (w === 'ok' ? 'none' : w === 'upstairs' || w === 'inside' || w === 'noWall' || w === 'unfinished' ? VINE_SAID[w] : trellisAgainstSaid(w));
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
/** A wall raised whole: planned on a side of a tile, and its bill paid. */
const raise = (b: Building | null, x: number, y: number, side: Side, type: WallType, done = true): void => {
  const wall = b ? g.buildings.setWall(b, 0, x, y, side, type, 'plank') : g.buildings.setFence(x, y, side, type, 'plank');
  if (done) for (const k of Object.keys(wall.needed)) wall.needed[k] = 0;
};
const press = g.buildings.create('Press house', 9, 12);
g.buildings.addTile(press, 10, 12);
raise(press, 9, 12, 'n', 'solid');
raise(press, 10, 12, 'n', 'solid');
same('PLACE:ok', act('place_furniture').check?.({ kind: 'tile', x: 10, y: 11, sx: 1, sy: 1, itemUid: (g.inventory.items.find((i) => i.id === TRELLIS) as Item).uid, facing: 's' } as Target, g) ?? 'none', 'none');
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

/* 9. Where a trellis stands. */
{
  g.wallClock = null;
  const houses = new Map<number, Building>();
  const houseOf = (id: number, x: number, y: number): Building => {
    const had = houses.get(id);
    if (had) {
      g.buildings.addTile(had, x, y);
      return had;
    }
    const b = g.buildings.create(`House ${id}`, x, y);
    houses.set(id, b);
    return b;
  };
  for (const [id, x, y] of [[96, 21, 21], [96, 22, 21], [96, 21, 22], [97, 21, 23], [98, 26, 21]] as Array<[number, number, number]>) houseOf(id, x, y);
  for (const wl of WALLS) {
    // A border by the tile it is the north or the west side of.
    const wall = g.buildings.setWall(houses.get(wl.b) as Building, 0, wl.x, wl.y, wl.dir === 'h' ? 'n' : 'w', wl.type, 'plank');
    if (wl.done) for (const k of Object.keys(wall.needed)) wall.needed[k] = 0;
    if (wl.lock) wall.lock = wl.lock;
  }
  const item = thing(TRELLIS, 40);
  const stand = (x: number, y: number, level = 0): void => {
    g.putBody(x + 0.5, y + 0.5, 0);
    g.player.level = level;
  };
  const askPlace = (x: number, y: number, facing: Side, sx = 1, sy = 1): string =>
    act('place_furniture').check?.({ kind: 'tile', x, y, sx, sy, itemUid: item.uid, facing } as Target, g) ?? 'none';
  for (const a of ASKS) {
    stand(a.x, a.y, a.level ?? 0);
    same(`W:${a.k}`, askPlace(a.x, a.y, a.f), wantSaid(a.want));
  }
  stand(21, 20);
  const key = g.inventory.add('key', { ql: 30 });
  key.keyed = HIDDEN_LOCK;
  stand(26, 20);
  same('W:hiddenKey', askPlace(26, 20, 's'), trellisAgainstSaid('hidden_door'));
  g.inventory.remove(key.uid, 1);
  const unfinished = g.buildings.wall(0, 23, 21, 'w');
  for (const k of Object.keys(unfinished?.needed ?? {})) if (unfinished) unfinished.needed[k] = 0;
  stand(23, 21);
  same('W:finished', askPlace(23, 21, 'w'), 'none');

  // Which side a trellis goes against, set down at a point of a tile with two: the nearer, and north where they are as near;
  // on a tile with one, that one wherever on the tile; with none, the nearest side, shown refused.
  const fac = (fx: number, fy: number): Side => trellisFacing(g, 22, 22, fx, fy, 0);
  check(`in the inner corner of the L it goes against the wall nearer where it is set down: ${fac(0.5, 0.1)}, ${fac(0.1, 0.5)}, ${fac(0.5, 0.5)}, ${fac(0.9, 0.9)}`,
    fac(0.5, 0.1) === 'n' && fac(0.1, 0.5) === 'w' && fac(0.5, 0.5) === 'n' && fac(0.2, 0.3) === 'w' && fac(0.3, 0.2) === 'n' && fac(0.9, 0.9) === 'n'
      && trellisFacing(g, 24, 20, 0.9, 0.6, 0) === 'e' && trellisFacing(g, 21, 20, 0.1, 0.1, 0) === 's');

  stand(21, 20);
  act('place_furniture').perform({ kind: 'tile', x: 21, y: 20, sx: 2, sy: 1, itemUid: item.uid, facing: 's' } as Target, g);
  const out = [...g.furniture.values()].find((f) => f.kind === TRELLIS && f.x === 21 && f.y === 20) as PlacedFurniture;
  const [ocx, ocy] = [21 + 0.5, 20 + (SUBTILES - 0.5) / SUBTILES];
  check(`set down outside the north wall it faces it, in the row of subtiles along it, on both sides: ${out?.facing} at ${out?.sx}, ${out?.sy}`,
    out?.facing === 's' && out.sx === 0 && out.sy === SUBTILES - 1 && isle.get('W:placed') === `s|0|${SUBTILES - 1}|${ocx}|${ocy}`, isle.get('W:placed'));
  const item2 = thing(TRELLIS, 40);
  stand(22, 22);
  act('place_furniture').perform({ kind: 'tile', x: 22, y: 22, sx: 3, sy: 2, itemUid: item2.uid, facing: 'n' } as Target, g);
  const corner = [...g.furniture.values()].find((f) => f.kind === TRELLIS && f.x === 22 && f.y === 22) as PlacedFurniture;
  check(`and in the inner corner facing north, along its north side: ${corner?.facing} at ${corner?.sx}, ${corner?.sy}`,
    corner?.facing === 'n' && corner.sx === 0 && corner.sy === 0 && isle.get('W:corner') === 'n|0|0', isle.get('W:corner'));
  same('W:turnOk', act('turn_furniture').check?.(piece(corner.id), g) ?? 'none', 'none');
  act('turn_furniture').perform(piece(corner.id), g);
  check(`turned, it goes round past east and south, which have no wall, to the west wall, along it: ${corner.facing} at ${corner.sx}, ${corner.sy}, “${lastHere()}”`,
    corner.facing === 'w' && corner.sx === 0 && corner.sy === 0 && isle.get('W:turned') === `w|0|0|${lastHere()}`, isle.get('W:turned'));
  const item3 = thing(TRELLIS, 40);
  same('W:cornerTwo', act('place_furniture').check?.({ kind: 'tile', x: 22, y: 22, sx: 1, sy: 1, itemUid: item3.uid, facing: 'n' } as Target, g) ?? 'none', 'none');
  act('place_furniture').perform({ kind: 'tile', x: 22, y: 22, sx: 1, sy: 1, itemUid: item3.uid, facing: 'n' } as Target, g);
  const corners = [...g.furniture.values()].filter((f) => f.kind === TRELLIS && f.x === 22 && f.y === 22).sort((a, b) => (a.facing ?? 's').localeCompare(b.facing ?? 's'));
  const cornersHere = corners.map((f) => `${f.facing}:${f.sx},${f.sy}`).join(' ');
  check(`an inner corner takes a trellis on each wall, sharing the corner spot, on both sides: ${cornersHere}`,
    cornersHere === 'n:0,0 w:0,0' && isle.get('W:corners') === cornersHere, isle.get('W:corners'));
  const chest = thing('chest', 40);
  same('W:cornerChest', act('place_furniture').check?.({ kind: 'tile', x: 22, y: 22, sx: 0, sy: 0, itemUid: chest.uid, facing: 's' } as Target, g) ?? 'none',
    'Something is already standing there.');
  g.inventory.remove(chest.uid, 1);
  const item4 = thing(TRELLIS, 40);
  same('W:cornerThird', act('place_furniture').check?.({ kind: 'tile', x: 22, y: 22, sx: 1, sy: 1, itemUid: item4.uid, facing: 'n' } as Target, g) ?? 'none',
    'Something is already standing there.');
  g.inventory.remove(item4.uid, 1);
  stand(21, 20);
  same('W:turnNone', act('turn_furniture').check?.(piece(out.id), g) ?? 'none', VINE_SAID.turn);
  const down = { kind: 'tile', x: 21, y: 20, side: 's' } as Target;
  same('W:remove', act('remove_wall').check?.(down, g) ?? 'none', 'none');
  act('remove_wall').perform(down, g);
  check('its wall taken down, the trellis stays standing, on both sides', !g.buildings.wall(0, 21, 20, 's') && g.furniture.has(out.id) && isle.get('W:gone') === '0|1', isle.get('W:gone'));
  thing(GRAPE_CUTTING, 40);
  same('W:plant', ask(PLANT_VINE, piece(out.id)), 'none');
  same('W:turnGone', act('turn_furniture').check?.(piece(out.id), g) ?? 'none', VINE_SAID.turn);
}

/* 10. Settled one to a row. */
{
  g.inventory.items = g.inventory.items.filter((it) => it.id !== TRELLIS && it.id !== GRAPE_CUTTING);
  said.length = 0;
  for (const r of SETTLE) {
    const f = g.addFurniture(r.kind, r.x, r.y, 0, 0, r.ql, [], 'Oak', r.f);
    // As it was left, before a trellis took a row: where it stood, not where it would go now.
    f.sx = r.sx;
    f.sy = r.sy;
    if (r.vine) f.vineAt = T_PLANT;
  }
  settleTrellises(g);
  const left = [...g.furniture.values()].filter((f) => f.kind === TRELLIS && f.x >= 40)
    .sort((a, b) => a.x - b.x || a.y - b.y || (a.facing ?? 's').localeCompare(b.facing ?? 's'))
    .map((f) => `${f.x},${f.y},${f.facing},${f.sx},${f.sy},${f.ql},${f.vineAt !== undefined}`).join(' ');
  check(`one trellis is kept to a row, the one with a vine first, and none where a chest stands in its row, on both sides: ${left}`,
    left === isle.get('S:left') && left === `40,40,e,${SUBTILES - 1},0,34,false 40,40,s,0,${SUBTILES - 1},32,true 44,40,w,0,0,37,false`, isle.get('S:left'));
  // In the browser a game has one owner, so the one the island leaves on the ground goes to the pack here.
  check(`the rest go back to whoever set them down, a vine as a cutting -- ${isle.get('S:n')} on the island, one of them left on the ground of its tile, rare as it was, by one who has left`,
    isle.get('S:n') === '5' && isle.get('S:pack') === '4|1' && isle.get('S:ground') === `${TRELLIS}@44,40:rare`
      && held(TRELLIS) === 5 && held(GRAPE_CUTTING) === 1, `${isle.get('S:pack')} ${isle.get('S:ground')} / ${held(TRELLIS)} ${held(GRAPE_CUTTING)}`);
  const toldHere = said.filter((m) => m.startsWith('Your ') && !m.includes(' at 44, 40 ')).join('#');
  check(`and are told why, in the same words: “${trellisReturnedSaid(42, 40, true)}”`,
    toldHere === isle.get('S:told') && toldHere.split('#').length === 4 && toldHere.includes(trellisReturnedSaid(42, 40, true)), `${isle.get('S:told')} / ${toldHere}`);
}

{
  // 11. And with the definitions a spot across: the island's settling goes by the trellis's own footprint.
  g.inventory.items = g.inventory.items.filter((it) => it.id !== TRELLIS);
  for (const r of FOOT) {
    const f = g.addFurniture(r.kind, r.x, r.y, 0, 0, 40, [], 'Oak', r.f);
    f.sx = r.sx;
    f.sy = r.sy;
  }
  settleTrellises(g);
  const footHere = [...g.furniture.values()].filter((f) => f.kind === TRELLIS && f.x >= 50).sort((a, b) => a.x - b.x)
    .map((f) => `${f.x},${f.y},${f.facing},${f.sx},${f.sy},${furnitureCentre(f).join(',')}`).join(' ');
  const end = (SUBTILES - 0.5) / SUBTILES, start = 0.5 / SUBTILES;
  check(`settled before the definitions land, each kept trellis's centre is the middle of its row and a row taken at its far end goes back, on both sides: ${footHere}`,
    footHere === isle.get('F:left') && footHere === `52,40,s,0,${SUBTILES - 1},52.5,${40 + end} 54,40,e,${SUBTILES - 1},0,${54 + end},40.5 56,40,w,0,0,${56 + start},40.5`
      && isle.get('F:back') === '1' && held(TRELLIS) === 1, `${isle.get('F:left')} ${isle.get('F:back')} / ${footHere} ${held(TRELLIS)}`);
}
{
  // And a single-player save from before, loaded: settled as it comes in (`Game`'s constructor).
  const kept = (sx: number, sy: number, id: number, vine?: number): PlacedFurniture =>
    ({ id, x: 50, y: 50, sx, sy, kind: TRELLIS, ql: 44, items: [], material: 'Oak', facing: 's', ...(vine ? { vineAt: vine } : {}) });
  const loaded = new Game({ seed: 177, world: w, spawn: { x: 10, y: 10 }, furniture: [kept(0, 0, 1), kept(2, 2, 2, T_PLANT)] });
  const stands = [...loaded.furniture.values()].filter((f) => f.kind === TRELLIS);
  check('a save from before is settled as it is loaded: the trellis with the vine kept, along the row, the other back in the pack',
    stands.length === 1 && stands[0].id === 2 && stands[0].sx === 0 && stands[0].sy === SUBTILES - 1
      && loaded.inventory.items.filter((it) => it.id === TRELLIS).length === 1, JSON.stringify(stands.map((f) => [f.id, f.sx, f.sy])));
}

/* ---- what was found ------------------------------------------------------------------------------- */

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nvineyards — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
