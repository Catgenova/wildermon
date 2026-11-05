/**
 * Winter fur and critter caches (`winter.ts`, `cacheAction.ts`), the same on both sides.
 *
 * Asked for, from a player's winter ideas: "critter caches that you can search for, possibly utilizing tracking"
 * with loot that is not "nuts and roots", and "increased fur gain from butchering could be a nice little perk to
 * winter activity".
 *
 *   * the numbers: the winter fur multiplier, the loot table, the draws, how near a search names the tile, how many
 *     caches an island is laid, the ground and every pick off the table, the island's are the browser's;
 *   * winter fur: a carcass butchered in winter gives `WINTER_FUR` times the fur, and out of winter the plain share;
 *     the Butcher line says the bonus in winter only;
 *   * caches only in winter: none laid in spring, `cachesFor` the island laid in winter and once a winter, all on
 *     cache ground; a search out of winter refused in the browser's words;
 *   * a search finds the nearest within a track's reach, its way and distance as a track reads them, the words the
 *     browser's; none within reach said as the browser says it; near enough, the tile named, and the browser keeps it;
 *   * a dig gives `cacheDraws` draws off the table at your Tracking and takes the cache; a second dig refused in the
 *     same words both sides;
 *   * after winter the cache left is gone, and a dig refused in the browser's words.
 *
 * The season is pinned on each side (`wurm.season`, `wallClock`), so it holds in every real season. Runs against
 * the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { butcherPreview } from '../../src/game/butcher';
import { SPECIES } from '../../src/game/creatures';
import { ITEM_DEFS } from '../../src/game/items';
import { bearingTo, trackDistSays, TRACKING, trackLevel, trackReach, TRACK_BANDS } from '../../src/game/tracking';
import {
  CACHE_DIG, CACHE_GROUND, CACHE_LOOT, CACHE_SAID, CACHE_SEARCH, cacheDraws, cachedSpot, cachePick, cacheSearchSaid, cachesFor, cacheSpotAt,
  WINTER_FUR, WINTER_FUR_PART, winterFurSays,
} from '../../src/game/winter';
import { cacheDigRefusal, cacheSearchRefusal } from '../../src/game/cacheAction';
import { SEASONS, SEASON_DAYS, YEAR_DAYS, YEAR_FROM, yearOf, type Season } from '../../src/world/calendar';
import { DAY_SECONDS } from '../../src/game/pace';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- the numbers ------------------------------------------------------------------------------------------------ */

const LEVELS = [0, 19, 20, 29, 30, 45, 59, 60, 79, 80, 99, 100];
const ROLLS = Array.from({ length: 41 }, (_, i) => i / 40 - (i === 40 ? 1e-9 : 0));
const mineNumbers = [
  `fur ${WINTER_FUR_PART} ${WINTER_FUR}`,
  `loot ${CACHE_LOOT.map((l, i) => `${i}:${l.item}:${l.count}:${l.weight}:${l.at}`).join(',')}`,
  `draws ${LEVELS.map(cacheDraws).join(',')}`,
  `spot ${LEVELS.map(cacheSpotAt).join(',')}`,
  `caches ${[16, 40, 127, 128, 256, 1000, 4096].map(cachesFor).join(',')}`,
  `ground ${Array.from({ length: 26 }, (_, t) => (CACHE_GROUND.includes(t) ? 't' : 'f')).join('')}`,
  `pick ${LEVELS.map((L) => ROLLS.map((r) => CACHE_LOOT.indexOf(cachePick(L, r))).join('.')).join(',')}`,
].join('\n');
const theirNumbers = psql(`
select 'fur ' || winter_fur_part() || ' ' || winter_fur();
select 'loot ' || string_agg(ord || ':' || item || ':' || n || ':' || weight || ':' || at, ',' order by ord) from cache_loot();
select 'draws ' || string_agg(cache_draws(l)::text, ',' order by o) from unnest(array[${LEVELS.join(',')}]) with ordinality u(l, o);
select 'spot ' || string_agg(cache_spot_at(l)::text, ',' order by o) from unnest(array[${LEVELS.join(',')}]) with ordinality u(l, o);
select 'caches ' || string_agg(caches_for(s)::text, ',' order by o) from unnest(array[16, 40, 127, 128, 256, 1000, 4096]) with ordinality u(s, o);
select 'ground ' || string_agg(case when cache_ground(t) then 't' else 'f' end, '' order by t) from generate_series(0, 25) t;
select 'pick ' || string_agg(p, ',' order by o) from (
  select o, string_agg(cache_pick(l, r)::text, '.' order by k) as p
    from unnest(array[${LEVELS.join(',')}]) with ordinality u(l, o),
         unnest(array[${ROLLS.map((r) => `${r}::double precision`).join(',')}]) with ordinality v(r, k)
   group by o) x;`);
check('the winter fur multiplier, the loot table, the draws, the spot, the caches an island is laid, the ground and every pick: the island\'s are the browser\'s',
  theirNumbers === mineNumbers, theirNumbers === mineNumbers ? '' : `\nisland  ${theirNumbers}\nbrowser ${mineNumbers}`);
check('the loot is worth having: no nuts or roots, motes, a relic, a bauble and four rare metals',
  CACHE_LOOT.every((l) => ITEM_DEFS[l.item] && !['nuts', 'acorn', 'lily_root'].includes(l.item)) && CACHE_LOOT.some((l) => l.item === 'seryll_lump'),
  CACHE_LOOT.map((l) => l.item).join(', '));

/* ---- the island ------------------------------------------------------------------------------------------------- */

// A kind that gives fur in an even number, so that its winter share is whole and no remainder is rolled.
const FURRED = Object.values(SPECIES).find((s) => !s.monster && (s.butcher.fur ?? 0) >= 2 && (s.butcher.fur ?? 0) % 2 === 0)!;
const FUR = FURRED.butcher.fur ?? 0;
const SIZE = 256;
/** The finder's Tracking: the last band, and room to learn. */
const SKILL = 99.5;
const U = 'a9c1e000-0000-4000-8000-0000000000c5';
const V = 'a9c1e000-0000-4000-8000-0000000000c6';
// The near cache and the far one, from where the search is made.
const FROM = { x: 50.5, y: 50.5 };
const NEAR = { x: 60, y: 60 };
const FAR = { x: 20, y: 140 };
const tile = (x: number, y: number): string => `jsonb_build_object('kind', 'tile', 'x', ${x}, 'y', ${y}, 'cx', ${x}, 'cy', ${y})`;
const at = (who: string, x: number, y: number): string =>
  `update player set x = ${x}, y = ${y}, level = 0, body_at = now() where world_id = w and uid = ${who};`;
const lastSaid = (who: string, kind: string): string =>
  `coalesce((select text from event where world_id = w and uid = ${who} and kind = '${kind}' and text not like '%increased by%' order by n desc limit 1), '-')`;
const sumOf = (who: string, items: string): string =>
  `(select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = ${who} and def in (${items}))`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v uuid := '${V}'; v_was double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Caches', 1105, ${SIZE}, 128, 128, true) returning id into w;
  -- All grass at sea level: cache ground everywhere.
  perform land_blank(w, ${SIZE});
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Cachefinder');
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  perform rpc_join(w, 'Latecomer');
  delete from item where world_id = w and holder = 'player' and holder_uid in (u, v);
  insert into skill (world_id, uid, id, value) values (w, u, 'butchering', 100), (w, u, tracking_skill(), ${SKILL}), (w, v, tracking_skill(), 0)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  /* Winter fur: the same carcass in spring and in winter, a knife of 100 and Butchering 100, all of it kept. */
  perform give(w, u, 'butchering_knife', 1, 100);
  ${at('u', 9.5, 9.5)}
  perform set_config('wurm.season', 'spring', true);
  perform drop_on_ground(w, 9, 9, 'corpse', 40, ${q(FURRED.name)});
  perform act_perform(w, u, 'butcher', jsonb_build_object('kind', 'ground', 'x', 9, 'y', 9));
  insert into said select 'FUR_SPRING', ${sumOf('u', "'fur'")}::text;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def <> 'butchering_knife';
  perform set_config('wurm.season', 'winter', true);
  perform drop_on_ground(w, 9, 9, 'corpse', 40, ${q(FURRED.name)});
  perform act_perform(w, u, 'butcher', jsonb_build_object('kind', 'ground', 'x', 9, 'y', 9));
  insert into said select 'FUR_WINTER', ${sumOf('u', "'fur'")}::text;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;

  /* Only in winter. */
  perform set_config('wurm.season', 'spring', true);
  insert into said values ('LAID_SPRING', caches_owed(w)::text || ':' || (select count(*) from critter_cache where world_id = w));
  insert into said values ('SEARCH_SPRING', coalesce(act_refusal(w, u, cache_search_action(), ${tile(9, 9)}), 'none'));
  perform set_config('wurm.season', 'winter', true);
  insert into said values ('LAID_WINTER', caches_owed(w)::text);
  update said s set v = s.v || ':' || (select count(*) from critter_cache where world_id = w)
    || ':' || (select count(*) from critter_cache c join land_tile t on t.world_id = c.world_id and t.y = c.y
                where c.world_id = w and cache_ground(get_byte(t.tiles, c.x))) where k = 'LAID_WINTER';
  insert into said values ('LAID_AGAIN', caches_owed(w)::text);
  update said s set v = s.v || ':' || (select count(*) from critter_cache where world_id = w) where k = 'LAID_AGAIN';
  insert into said values ('SEARCH_WINTER', coalesce(act_refusal(w, u, cache_search_action(), ${tile(9, 9)}), 'none'));

  /* The nearest: two of this winter's, one near and one far, and the search from between. */
  delete from critter_cache where world_id = w;
  insert into critter_cache (world_id, x, y, winter) values
    (w, ${NEAR.x}, ${NEAR.y}, cache_winter_now()), (w, ${FAR.x}, ${FAR.y}, cache_winter_now());
  ${at('u', FROM.x, FROM.y)}
  perform act_perform(w, u, cache_search_action(), ${tile(50, 50)});
  insert into said values ('FOUND', ${lastSaid('u', 'event')});
  insert into said values ('ARROW', ${lastSaid('u', 'tracked')});
  insert into said values ('GAINED', (select value from skill where world_id = w and uid = u and id = tracking_skill())::text);

  /* Nothing within reach, at Tracking nought, from the far corner. */
  ${at('v', SIZE - 1.5, 1.5)}
  perform act_perform(w, v, cache_search_action(), ${tile(SIZE - 2, 1)});
  insert into said values ('NONE', ${lastSaid('v', 'event')});

  /* Near enough: the tile named, and handed to the browser. */
  ${at('u', NEAR.x + 2.5, NEAR.y + 0.5)}
  perform act_perform(w, u, cache_search_action(), ${tile(NEAR.x + 2, NEAR.y)});
  insert into said values ('SPOT', ${lastSaid('u', 'event')});
  insert into said values ('SPOT_LINE', ${lastSaid('u', 'cached')});

  /* Dug: the draws, the cache gone, a go of Tracking. */
  ${at('u', NEAR.x + 0.5, NEAR.y + 0.5)}
  v_was := (select value from skill where world_id = w and uid = u and id = tracking_skill());
  insert into said values ('DIG_ASK', coalesce(act_refusal(w, u, cache_dig_action(), ${tile(NEAR.x, NEAR.y)}), 'none'));
  perform act_perform(w, u, cache_dig_action(), ${tile(NEAR.x, NEAR.y)});
  insert into said values ('DUG', ${lastSaid('u', 'event')});
  insert into said values ('DUG_LINE', ${lastSaid('u', 'cached')});
  insert into said select 'GOT', coalesce(string_agg(def || ':' || count || ':' || coalesce(extra, '-') || ':' || round(ql::numeric, 1), ',' order by def, id), '-')
    from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into said values ('LEFT', (select count(*) from critter_cache where world_id = w and x = ${NEAR.x} and y = ${NEAR.y})::text);
  insert into said values ('DUG_GAIN', ((select value from skill where world_id = w and uid = u and id = tracking_skill()) > v_was)::text);

  /* Twice: refused, for the finder and for anybody else. */
  insert into said values ('AGAIN', coalesce(act_refusal(w, u, cache_dig_action(), ${tile(NEAR.x, NEAR.y)}), 'none'));
  ${at('v', NEAR.x + 0.5, NEAR.y + 0.5)}
  insert into said values ('AGAIN_THEM', coalesce(act_refusal(w, v, cache_dig_action(), ${tile(NEAR.x, NEAR.y)}), 'none'));

  /* After winter: the far one gone, and a dig at it refused. */
  perform set_config('wurm.season', 'spring', true);
  ${at('u', FAR.x + 0.5, FAR.y + 0.5)}
  insert into said values ('AFTER_ASK', coalesce(act_refusal(w, u, cache_dig_action(), ${tile(FAR.x, FAR.y)}), 'none'));
  perform caches_owed(w);
  insert into said values ('AFTER', (select count(*) from critter_cache where world_id = w)::text);
  perform set_config('wurm.season', 'winter', true);
  insert into said values ('AFTER_WINTER_ASK', coalesce(act_refusal(w, u, cache_dig_action(), ${tile(FAR.x, FAR.y)}), 'none'));
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- winter fur ---- */
check(`island: a ${FURRED.name} carcass, all of it kept, in spring: ${FUR} fur`, said('FUR_SPRING') === String(FUR), said('FUR_SPRING'));
check(`island: and in winter ×${WINTER_FUR}: ${FUR * WINTER_FUR} fur`, said('FUR_WINTER') === String(FUR * WINTER_FUR), said('FUR_WINTER'));

/* ---- only in winter ---- */
const [laidSpring, inSpring] = said('LAID_SPRING').split(':');
check('island: none laid in spring', laidSpring === '0' && inSpring === '0', said('LAID_SPRING'));
const [laid, held, onGround] = said('LAID_WINTER').split(':');
check(`island: in winter, ${cachesFor(SIZE)} laid on an island of ${SIZE}, every one on cache ground`,
  laid === String(cachesFor(SIZE)) && held === laid && onGround === laid, said('LAID_WINTER'));
check('island: and once a winter', said('LAID_AGAIN') === `0:${cachesFor(SIZE)}`, said('LAID_AGAIN'));
check('island: a search out of winter refused, in winter not', said('SEARCH_SPRING') === CACHE_SAID.season && said('SEARCH_WINTER') === 'none',
  `${said('SEARCH_SPRING')} / ${said('SEARCH_WINTER')}`);

/* ---- the nearest ---- */
const L = trackLevel(SKILL);
const B = TRACK_BANDS[TRACK_BANDS.length - 1];
const trueBearing = bearingTo(FROM.x, FROM.y, NEAR.x + 0.5, NEAR.y + 0.5);
const trueDist = Math.hypot(NEAR.x + 0.5 - FROM.x, NEAR.y + 0.5 - FROM.y);
const arrow = (() => { try { return JSON.parse(said('ARROW')) as { name: string; bearing: number; far: boolean; tiles: number | null }; } catch { return null; } })();
const turnApart = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
check(`island: at Tracking ${L} the search reads the near cache, ${trueBearing.toFixed(0)}° and ${trueDist.toFixed(0)} tiles, not the far one`,
  !!arrow && arrow.name === 'Cache' && turnApart(arrow.bearing, trueBearing) <= 6 && arrow.tiles === Math.max(B.round!, Math.floor(trueDist / B.round! + 0.5) * B.round!),
  said('ARROW'));
const reading = arrow && { band: TRACK_BANDS.length - 1, way: `bearing ${arrow.bearing}°`, bearing: arrow.bearing, far: arrow.far, tiles: arrow.tiles };
check('and says it in the browser\'s words', !!reading && said('FOUND') === cacheSearchSaid(trackReach(L, 0), reading, null), `island "${said('FOUND')}", browser "${reading ? cacheSearchSaid(trackReach(L, 0), reading, null) : '-'}"`);
check('island: a search trains Tracking', Number(said('GAINED')) > SKILL, said('GAINED'));
check('island: none within reach at Tracking 0, in the browser\'s words', said('NONE') === cacheSearchSaid(trackReach(0, 0), null, null), said('NONE'));
check(`island: within ${cacheSpotAt(L)} tiles at Tracking ${L}, the tile named`, said('SPOT') === cacheSearchSaid(trackReach(L, 0), null, NEAR), said('SPOT'));
const spot = cachedSpot(said('SPOT_LINE'));
check('and handed to the browser as a cached line', !!spot && spot.x === NEAR.x && spot.y === NEAR.y, said('SPOT_LINE'));
check('the arrow and the distance read as a track\'s', !!arrow && trackDistSays(arrow) === `about ${arrow.tiles} tiles`, said('ARROW'));

/* ---- dug ---- */
check('island: dug where the search named, not refused', said('DIG_ASK') === 'none', said('DIG_ASK'));
const got = said('GOT') === '-' ? [] : said('GOT').split(',').map((s) => s.split(':'));
const draws = got.reduce((n, [def, count]) => {
  const l = CACHE_LOOT.find((x) => x.item === def);
  return l ? n + Number(count) / l.count : NaN;
}, 0);
check(`island: ${cacheDraws(L)} draws off the table at Tracking ${L}, every one a line of it`, draws === cacheDraws(L), said('GOT'));
check('island: a bauble of a tier, the rest plain', got.every(([def, , extra]) => (def === 'tarnished_bauble' ? extra !== '-' : extra === '-')), said('GOT'));
check('island: all at one quality, of the Tracking', new Set(got.map(([, , , ql]) => ql)).size === 1 && got.every(([, , , ql]) => Number(ql) >= 1 && Number(ql) <= 100), said('GOT'));
check('island: the log line says it', said('DUG').startsWith('Cache dug: ') && /, QL \d+\.\d\.$/.test(said('DUG')), said('DUG'));
check('island: the cache gone', said('LEFT') === '0', said('LEFT'));
check('island: a full go of Tracking', said('DUG_GAIN') === 'true', said('DUG_GAIN'));
check('and the browser told to forget the tile', cachedSpot(said('DUG_LINE')) === null, said('DUG_LINE'));

/* ---- the browser ------------------------------------------------------------------------------------------------ */

const now = Date.now() / 1000;
const momentIn = (s: Season): number => YEAR_FROM + (yearOf(now) * YEAR_DAYS + SEASONS.indexOf(s) * SEASON_DAYS + 2) * DAY_SECONDS + DAY_SECONDS / 2;
const g = Game.create(1105, 256);
g.inventory.items.length = 0;
g.skills.values.set(TRACKING, SKILL);
g.inventory.add('butchering_knife', { ql: 100 });
const corpse = g.inventory.add('corpse', { ql: 40, extra: FURRED.name });
g.wallClock = () => momentIn('spring');
check('browser: no fur bonus on the Butcher line out of winter', !butcherPreview(g, corpse).includes(winterFurSays()), butcherPreview(g, corpse));
const search = ACTION_BY_ID.get(CACHE_SEARCH)!;
const dig = ACTION_BY_ID.get(CACHE_DIG)!;
const here = (x: number, y: number): Target => ({ kind: 'tile', x, y, cx: x, cy: y });
check('browser: no search or dig offered out of winter', !search.applies(here(NEAR.x, NEAR.y), g) && !dig.applies(here(NEAR.x, NEAR.y), g));
check('browser: a search out of winter refused in the island\'s words', cacheSearchRefusal(g, here(50, 50)) === said('SEARCH_SPRING'),
  `island "${said('SEARCH_SPRING')}", browser "${cacheSearchRefusal(g, here(50, 50))}"`);
g.wallClock = () => momentIn('winter');
check(`browser: in winter the Butcher line says ${winterFurSays()}`, butcherPreview(g, corpse).includes(winterFurSays()), butcherPreview(g, corpse));
// A tile of the browser's own land that is cache ground, and one that is not.
const land = (() => {
  for (let y = 1; y < g.world.h - 1; y++) for (let x = 1; x < g.world.w - 1; x++) {
    if (!g.world.hasWater(x, y) && CACHE_GROUND.includes(g.world.getTile(x, y))) return here(x, y);
  }
  return null;
})();
const road = (() => {
  for (let y = 1; y < g.world.h - 1; y++) for (let x = 1; x < g.world.w - 1; x++) {
    if (!g.world.hasWater(x, y) && !CACHE_GROUND.includes(g.world.getTile(x, y))) return here(x, y);
  }
  return null;
})();
check('browser: in winter search and dig offered on cache ground, and a search only off it',
  !!land && search.applies(land, g) && dig.applies(land, g) && !!road && search.applies(road, g) && !dig.applies(road, g),
  `${JSON.stringify(land)} ${JSON.stringify(road)}`);
check('browser: the dig label says the draws', (dig.labelFor?.(here(NEAR.x, NEAR.y), g) ?? '').includes(`${cacheDraws(L)} draws`), dig.labelFor?.(here(NEAR.x, NEAR.y), g));
// The tile the island named, as play.ts keeps it.
g.cacheSpot = spot ?? null;
check('browser: the named tile not refused, the one beside it refused', cacheDigRefusal(g, here(NEAR.x, NEAR.y)) === null
  && cacheDigRefusal(g, here(NEAR.x + 1, NEAR.y)) === CACHE_SAID.none, String(cacheDigRefusal(g, here(NEAR.x, NEAR.y))));
// And forgotten once dug, off the island's line.
const forgot = cachedSpot(said('DUG_LINE'));
if (forgot !== undefined) g.cacheSpot = forgot;
const mine = dig.check?.(here(NEAR.x, NEAR.y), g) ?? 'none';
check('a second dig: refused, the same words both sides, for the finder and anybody else',
  said('AGAIN') === CACHE_SAID.none && said('AGAIN') === mine && said('AGAIN_THEM') === mine, `island "${said('AGAIN')}" / "${said('AGAIN_THEM')}", browser "${mine}"`);
check('after winter: every cache gone', said('AFTER') === '0', said('AFTER'));
check('after winter: a dig refused in the browser\'s words, and with winter back there is none to dig',
  said('AFTER_ASK') === CACHE_SAID.season && said('AFTER_WINTER_ASK') === CACHE_SAID.none, `${said('AFTER_ASK')} / ${said('AFTER_WINTER_ASK')}`);
g.wallClock = () => momentIn('spring');
check('browser: and after winter a dig refused in the same words', cacheDigRefusal(g, here(FAR.x, FAR.y)) === said('AFTER_ASK'), String(cacheDigRefusal(g, here(FAR.x, FAR.y))));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwinter fur and critter caches — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
