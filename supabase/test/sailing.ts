/**
 * Sailing (`sailing.ts`, `sailActions.ts`), on both sides.
 *
 * Asked for: the closest a hull sails to the wind 60° at Sailing 1 to 35° at
 * 100 and a reach ×1 to ×1.15 (the browser sails the points of sail, the
 * island holds a hull to the top of them); a turn through the wind 2 s at
 * ×0.3 at Sailing 1, 0.5 s at 100; wind over 0.7 a gale, a hull below Sailing
 * 30 taking 1 damage per 10 tiles in one, a rowing boat not putting out in one;
 * the hold ×(1 + 0.25 × Sailing/100); a rigging set +10% speed and 10° closer;
 * sails' QL up to +10%; a line from a boat over water deeper than 4 m deep
 * fish only at ×1.3, a net there ×1.5; Sound the depth within 5 tiles; a gale
 * tile teaching ×2 and a close-hauled one ×1.5. Every roll and the wind
 * pinned. Runs against the database the suite leaves behind, rolled back.
 *
 *   npx esbuild supabase/test/sailing.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/sailing.mjs && node node_modules/.cache/sailing.mjs
 */
import {
  beamPace, cargoRoom, CLOSE_LEARN, DEEP_NET, GALE, GALE_LEARN, GALE_ROW_SAID, GALE_TILES_PER_DAMAGE, noGoDegrees, RIGGING_PACE, sailQlPace,
  TACK_SECS_AT_ONE, TACK_SECS_AT_TOP, TACK_PACE, tackSecs, SOUND_LEARN, SOUND_REACH,
} from '../../src/game/sailing';
import { SAIL_SAID, soundedSaid } from '../../src/game/sailActions';
import { pointAt, NO_GO } from '../../src/game/wind';
import { FISH } from '../../src/game/fishing';
import { sailingPace } from '../../src/game/travel';
import { psql, check, finish } from './harness';

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;
const LEVELS = [1, 30, 50, 99, 100, 120];

/* ---- the numbers, on both sides --------------------------------------------------------- */

const nums = psql(`select string_agg(no_go_degrees(v) || '/' || no_go_degrees(v, true) || '/' || beam_pace(v) || '/' || cargo_room(v)
  || '/' || sail_ql_pace(v), ' ' order by v) from unnest(array[${LEVELS.join(', ')}]::double precision[]) v`)
  .split(' ').map((s) => s.split('/').map(Number));
check('the closest to the wind, a reach, the hold and the sails\' QL at every level, the same on both sides',
  nums.length === LEVELS.length
    && LEVELS.every((v, i) => near(nums[i][0], noGoDegrees(v)) && near(nums[i][1], noGoDegrees(v, true)) && near(nums[i][2], beamPace(v))
      && near(nums[i][3], cargoRoom(v)) && near(nums[i][4], sailQlPace(v)))
    && noGoDegrees(1) === 60 && noGoDegrees(100) === 35 && noGoDegrees(100, true) === 25 && near(beamPace(100), 1.15) && near(cargoRoom(100), 1.25),
  JSON.stringify(nums));
check('a turn through the wind: 2 s at Sailing 1, 0.5 s at 100, at ×0.3 speed',
  tackSecs(1) === TACK_SECS_AT_ONE && tackSecs(100) === TACK_SECS_AT_TOP && TACK_PACE === 0.3 && near(tackSecs(50.5), (TACK_SECS_AT_ONE + TACK_SECS_AT_TOP) / 2));
{
  // A hull at Sailing 1 is in irons where a hull at 100 is close-hauled; a reach at 100 goes ×1.15 of one at 0.
  const at = (deg: number): number => (deg * Math.PI) / 180;
  check('the points of sail as the helm sails them: in irons inside its no-go, a reach ×beam',
    pointAt(at(45), at(noGoDegrees(1))) < 0.3 && pointAt(at(45), at(noGoDegrees(100))) >= 0.55
      && near(pointAt(at(110), NO_GO, beamPace(100)) / pointAt(at(110)), beamPace(100)),
    `${pointAt(at(45), at(noGoDegrees(1)))} ${pointAt(at(45), at(noGoDegrees(100)))}`);
}
const deep = psql(`select (select string_agg(id, ',' order by id) from fish_def where deep) || '|' || (select string_agg(id, ',' order by id) from fish_here(1000, 100))
  || '|' || (select string_agg(id, ',' order by id) from deep_fish_here(1000, 100)) || '|' || (select string_agg(id, ',' order by id) from deep_fish_here(50, 100))`);
check('the deep-water fish are the browser\'s, come from no shore line, and want their own depth',
  deep === [FISH.filter((f) => f.deep).map((f) => f.id).sort().join(','), FISH.filter((f) => !f.deep).map((f) => f.id).sort().join(','),
    FISH.filter((f) => f.deep).map((f) => f.id).sort().join(','), FISH.filter((f) => f.deep && f.depth <= 50).map((f) => f.id).sort().join(',')].join('|'),
  deep);

/* ---- on the island -------------------------------------------------------------------- */

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
/** The wind, pinned: blowing toward `dir` (radians), at `force`. */
const wind = (dir: number, force: number): string =>
  `create or replace function world_wind(p_world uuid, out dir double precision, out force double precision) language sql stable
     as 'select ${dir}::double precision, ${force}::double precision'`;
const skill = (id: string, v: number): string =>
  `insert into skill (world_id, uid, id, value) values (w, u, '${id}', ${v}) on conflict (world_id, uid, id) do update set value = excluded.value`;
const said = `coalesce((select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind in ('event', 'error')), '')`;
const NET_LEAST = Number(psql('select net_least()'));

const out = psql(`
begin;
create temp table said (k text, v text);
create temp table raised (id text, base double precision);
-- What is taught, by its base, and nothing moved: the go's own multiplier is all that is read.
create or replace function skill_raise(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision
  language sql as 'insert into raised values (p_id, p_base); select 0::double precision';
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select 40::double precision';
create or replace function rarity_roll_from(p_units int[], p_first double precision) returns text language sql as 'select null::text';
create schema dice;
create function dice.random() returns double precision language sql volatile as 'select 0::double precision';
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
${wind(0, 0.5)};
do $t$
declare w uuid; u uuid; gx int; gy int; v_boat bigint; v_sail bigint; v_ship bigint; a double precision; b double precision; v_it bigint;
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  for gx in 18..34 loop for gy in 15..27 loop
    perform land_set_height(w, gx, gy, 4); perform land_set_tile(w, gx, gy, tile_id('Grass'));
  end loop; end loop;
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and (driver = u or x between 14 and 60 and y between 10 and 30);
  delete from item where world_id = w and holder in ('player', 'bag') and holder_uid = u;
  delete from skill where world_id = w and uid = u and id in (sailing_skill(), 'fishing');
  update player set x = 20.5, y = 21.5, level = 0, aboard = null, away = false, act = null, act_queue = '[]',
         moved_at = now() - interval '10 seconds' where world_id = w and uid = u;
  delete from event where world_id = w and uid = u;

  /* ---- a rowing boat in a gale: refused, and below Sailing 30 damaged a point every ten tiles, each tile taught ×2 ---- */
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'rowing_boat', 20, 21, 20.5, 21.5, 50) returning id into v_boat;
  ${wind(0, 0.9)};
  insert into said values ('ROWGALE', coalesce(ride_refusal(w, u, 'board_vehicle', jsonb_build_object('kind', 'furniture', 'id', v_boat)), 'ALLOWED'));
  ${wind(0, 0.5)};
  insert into said values ('ROWCALM', coalesce(ride_refusal(w, u, 'board_vehicle', jsonb_build_object('kind', 'furniture', 'id', v_boat)), 'ALLOWED'));
  update placed set driver = u where id = v_boat;
  ${wind(0, 0.9)};
  perform rpc_move(w, 23.5, 21.5, 0);
  insert into said select 'GALE', (select dmg from placed where id = v_boat) || '|' || (select string_agg(base::text, ',') from raised where id = sailing_skill())
    || '|' || (select x from player where world_id = w and uid = u);
  delete from raised;
  ${skill('sailing', 30)};
  update player set moved_at = now() - interval '10 seconds' where world_id = w and uid = u;
  perform rpc_move(w, 26.5, 21.5, 0);
  insert into said select 'GALE30', (select dmg from placed where id = v_boat)::text;
  delete from raised;
  ${wind(0, 0.5)};
  delete from placed where id = v_boat;
  delete from skill where world_id = w and uid = u and id = sailing_skill();

  /* ---- a sailing boat: close-hauled teaches ×1.5; her top speed, rigged and sailed; her hold ---- */
  update player set x = 20.5, y = 21.5, moved_at = now() - interval '10 seconds' where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver) values (w, 'furniture', 'sailing_boat', 20, 21, 20.5, 21.5, 50, u) returning id into v_sail;
  ${skill('sailing', 100)};
  -- Heading east, 50 degrees off the wind's eye: the wind blowing toward 230 degrees.
  ${wind((230 * Math.PI) / 180, 0.5)};
  perform rpc_move(w, 23.5, 21.5, 0);
  insert into said select 'CLOSE', string_agg(base::text, ',') from raised where id = sailing_skill();
  delete from raised;
  ${wind(Math.PI, 0.5)};
  update player set moved_at = now() - interval '10 seconds' where world_id = w and uid = u;
  perform rpc_move(w, 26.5, 21.5, 0);
  insert into said select 'RUN', string_agg(base::text, ',') from raised where id = sailing_skill();
  delete from raised;
  a := travel_speed(w, u);
  ${skill('sailing', 1)};
  b := travel_speed(w, u);
  ${skill('sailing', 100)};
  insert into said values ('TOP', a || '|' || b);
  update placed set mark = jsonb_build_object(rig_mark(), 1, sails_mark(), sail_ql_pace(80)) where id = v_sail;
  insert into said values ('RIGGED', travel_speed(w, u) || '|' || a);
  update placed set mark = null where id = v_sail;
  insert into said select 'HOLD', furniture_capacity(p) || '|-' from placed p where p.id = v_sail;
  update placed set driver = null where id = v_sail;
  update said set v = v || '|' || (select furniture_capacity(p) from placed p where p.id = v_sail) where k = 'HOLD';
  update placed set driver = u where id = v_sail;

  /* ---- fitting a rigging set ---- */
  update player set x = 20.5, y = 21.5 where world_id = w and uid = u;
  update placed set driver = null, x = 21, y = 21, cx = 21.5, cy = 21.5 where id = v_sail;
  insert into said values ('NOSET', coalesce(sail_refusal(w, u, fit_rigging_action(), jsonb_build_object('kind', 'furniture', 'id', v_sail)), 'ALLOWED'));
  perform give(w, u, rigging_set_item(), 1, 50);
  insert into said values ('SET', coalesce(sail_refusal(w, u, fit_rigging_action(), jsonb_build_object('kind', 'furniture', 'id', v_sail)), 'ALLOWED'));
  delete from event where world_id = w and uid = u;
  perform perform_sail(w, u, fit_rigging_action(), jsonb_build_object('kind', 'furniture', 'id', v_sail));
  insert into said select 'FITTED', (select mark->>rig_mark() from placed where id = v_sail) || '|' || pack_count(w, u, rigging_set_item()) || '|' || ${said};
  perform give(w, u, rigging_set_item(), 1, 50);
  insert into said values ('AGAIN', coalesce(sail_refusal(w, u, fit_rigging_action(), jsonb_build_object('kind', 'furniture', 'id', v_sail)), 'ALLOWED'));
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'rowing_boat', 22, 21, 22.5, 21.5, 50) returning id into v_boat;
  insert into said values ('ROWRIG', coalesce(sail_refusal(w, u, fit_rigging_action(), jsonb_build_object('kind', 'furniture', 'id', v_boat)), 'ALLOWED'));
  delete from placed where id in (v_sail, v_boat);
  delete from item where world_id = w and holder in ('player', 'bag') and holder_uid = u;

  /* ---- a sailing boat built of sailcloth carries its QL in her sails ---- */
  perform give(w, u, 'mallet', 1, 50);
  perform give(w, u, 'plank', 480, 30, 'Pine');
  perform give(w, u, 'timber', 168, 30, 'Pine');
  perform give(w, u, 'shaft', 6, 30, 'Pine');
  perform give(w, u, 'sailcloth', 72, 80);
  perform give(w, u, 'rope', 24, 40);
  perform give(w, u, 'thick_rope', 6, 40);
  perform give(w, u, 'ribbon', 24, 30, 'Iron');
  perform give(w, u, 'nail', 420, 30);
  ${skill('carpentry', 60)};
  perform perform_craft(w, u, 'make_sailing_boat', jsonb_build_object('kind', 'item', 'uid', null));
  insert into said select 'SAILS', coalesce((select mark->>sails_mark() from item where world_id = w and holder = 'player' and holder_uid = u
    and def = 'sailing_boat' limit 1), 'none');
  delete from item where world_id = w and holder in ('player', 'bag') and holder_uid = u;

  /* ---- deep water: a block sunk 6 m, a boat on it, a line and a net from her and from the bank, and a sounding ---- */
  for gx in 30 .. 48 loop for gy in 12 .. 30 loop
    perform land_set_height(w, gx, gy, -60);
  end loop; end loop;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver) values (w, 'furniture', 'rowing_boat', 39, 21, 39.5, 21.5, 50, u) returning id into v_boat;
  update player set x = 39.5, y = 21.5 where world_id = w and uid = u;
  ${skill('fishing', 100)};
  perform give(w, u, 'fishing_rod', 1, 50);
  perform give(w, u, 'fishing_net', 1, 50);
  insert into said values ('AFLOAT', afloat_deep(w, u, water_depth(w, 40, 21))::text || '|' || afloat_deep(w, u, 30)::text || '|' || water_depth(w, 40, 21));
  ${skill('fishing', 10)};
  insert into said values ('NOFISH', coalesce(fish_refusal(w, u, 'fish', jsonb_build_object('kind', 'tile', 'x', 40, 'y', 21)), 'ALLOWED'));
  ${skill('fishing', 100)};
  -- Every roll nought: a bite always stays on and the first fish of the pool comes up.
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  delete from event where world_id = w and uid = u;
  perform perform_fish(w, u, 'fish', jsonb_build_object('kind', 'tile', 'x', 40, 'y', 21));
  perform perform_fish(w, u, 'drag_net', jsonb_build_object('kind', 'tile', 'x', 40, 'y', 21));
  insert into said select 'BOATFISH', ${said};
  delete from event where world_id = w and uid = u;
  perform set_config('search_path', '"$user", public', true);
  delete from event where world_id = w and uid = u;
  delete from raised;
  perform perform_sail(w, u, sound_depth_action(), jsonb_build_object('kind', 'furniture', 'id', v_boat));
  insert into said select 'SOUNDED', ${said} || '|' || (select string_agg(base::text, ',') from raised where id = sailing_skill());
  delete from raised;
  update placed set driver = null where id = v_boat;
  insert into said values ('ASHORESOUND', coalesce(sail_refusal(w, u, sound_depth_action(), jsonb_build_object('kind', 'furniture', 'id', v_boat)), 'ALLOWED'));
  -- And from the bank, the same water.
  update player set x = 28.5, y = 21.5 where world_id = w and uid = u;
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  delete from event where world_id = w and uid = u;
  perform perform_fish(w, u, 'fish', jsonb_build_object('kind', 'tile', 'x', 30, 'y', 21));
  perform perform_fish(w, u, 'drag_net', jsonb_build_object('kind', 'tile', 'x', 30, 'y', 21));
  insert into said select 'SHOREFISH', ${said};
  perform set_config('search_path', '"$user", public', true);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const get = (k: string): string => isle.get(k) ?? 'unsaid';
const part = (k: string, i: number): string => get(k).split('|')[i] ?? '';
const num = (k: string, i = 0): number => Number(part(k, i));
const learn = Number(psql('select sailing_learn()'));

check('a rowing boat does not put out in a gale, and in a breeze is asked only what she always was', get('ROWGALE') === GALE_ROW_SAID && get('ROWCALM') !== GALE_ROW_SAID,
  `${get('ROWGALE')} / ${get('ROWCALM')}`);
{
  const bases = part('GALE', 1).split(',').map(Number);
  check(`three tiles rowed in a gale at Sailing 1: ${3 / GALE_TILES_PER_DAMAGE} damage, each tile taught ×${GALE_LEARN}`,
    near(num('GALE'), 3 / GALE_TILES_PER_DAMAGE, 1e-4) && bases.length === 3 && bases.every((b) => near(b, learn * GALE_LEARN)) && num('GALE', 2) === 23.5,
    get('GALE'));
  check('at Sailing 30 a gale does a hull no more damage', near(Number(get('GALE30')), 3 / GALE_TILES_PER_DAMAGE, 1e-4), get('GALE30'));
}
{
  const close = get('CLOSE').split(',').map(Number), run = get('RUN').split(',').map(Number);
  check(`a tile sailed close-hauled teaches ×${CLOSE_LEARN}, one running ×1`,
    close.length === 3 && close.every((b) => near(b, learn * CLOSE_LEARN)) && run.length === 3 && run.every((b) => near(b, learn)),
    `${get('CLOSE')} / ${get('RUN')}`);
}
check('a sailing hull\'s top speed at the helm: Sailing\'s pace and a reach as it sails one, as the browser has them',
  num('TOP', 1) > 0 && near(num('TOP') / num('TOP', 1), (sailingPace(100) * beamPace(100)) / (sailingPace(1) * beamPace(1)), 1e-9), get('TOP'));
check(`rigged and sailed at QL 80: ×${1 + RIGGING_PACE} and ×${sailQlPace(80)}`,
  near(num('RIGGED') / num('RIGGED', 1), (1 + RIGGING_PACE) * sailQlPace(80), 1e-9), get('RIGGED'));
check(`the hold of a boat at a helm of Sailing 100 is ×${cargoRoom(100)} of hers with nobody at it`,
  num('HOLD', 2) > 0 && Math.abs(num('HOLD') - num('HOLD', 2) * cargoRoom(100)) <= 1, get('HOLD'));
check('a rigging set: needed, fitted once, used up, to a sailing hull only',
  get('NOSET') === SAIL_SAID.noSet && get('SET') === 'ALLOWED' && part('FITTED', 0) === '1' && part('FITTED', 1) === '0'
    && part('FITTED', 2).includes('Rigging fitted: sailing boat.') && get('AGAIN') === SAIL_SAID.rigged && get('ROWRIG') === SAIL_SAID.noSail,
  `${get('NOSET')} / ${get('SET')} / ${get('FITTED')} / ${get('AGAIN')} / ${get('ROWRIG')}`);
check(`a sailing boat built of sailcloth of QL 80 carries ×${sailQlPace(80)} in her sails`, near(Number(get('SAILS')), sailQlPace(80)), get('SAILS'));
check('a line from a boat over deep water, and only there, is cast over deep water; a deep-water fish wants its skill',
  part('AFLOAT', 0) === 'true' && part('AFLOAT', 1) === 'false' && get('NOFISH') === 'No fish here at your fishing skill.', `${get('AFLOAT')} / ${get('NOFISH')}`);
{
  const boat = get('BOATFISH'), shore = get('SHOREFISH');
  const deepNames = FISH.filter((f) => f.deep).map((f) => f.name.toLowerCase());
  const caught = (s: string): string => /Caught: ([a-z ]+), QL/.exec(s)?.[1] ?? '';
  const netted = (s: string): number => Number(/Netted: (\d+) ×/.exec(s)?.[1] ?? 0);
  const more = NET_LEAST * DEEP_NET;
  check('from the boat a deep-water fish comes up, from the bank none does',
    deepNames.includes(caught(boat)) && caught(shore) !== '' && !deepNames.includes(caught(shore)), `boat: ${boat}\nbank: ${shore}`);
  check(`a net from the boat over deep water hauls ×${DEEP_NET}: ${Math.ceil(more)} where the bank's hauls ${NET_LEAST}`,
    netted(boat) === Math.ceil(more) && netted(shore) === NET_LEAST, `boat ${netted(boat)}, bank ${netted(shore)}`);
}
{
  const [words, bases] = get('SOUNDED').split('|');
  let n = 0;
  for (let dy = -SOUND_REACH; dy <= SOUND_REACH; dy++) for (let dx = -SOUND_REACH; dx <= SOUND_REACH; dx++) if (Math.hypot(dx, dy) <= SOUND_REACH) n++;
  check('a sounding reads the water within its reach, says it as the browser says it, and teaches Sailing',
    (words ?? '').includes(soundedSaid(n, 60, 60)) && near(Number(bases), SOUND_LEARN) && get('ASHORESOUND') === SAIL_SAID.notAfloat,
    `${get('SOUNDED')} / ${get('ASHORESOUND')}`);
}
check(`a gale is wind over ${GALE}`, Number(psql('select gale()')) === GALE && psql('select is_gale(0.71)::text || is_gale(0.7)::text') === 'truefalse');

finish('Sailing');
