/**
 * The furnishings (`furnish.ts`, `furnishdefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, with real
 * recipes (the trade, the tool, the time, the bill); the jobs and every
 * sentence. Then on the island, each piece built through its own recipe and
 * set down:
 *
 *   * seats (a stone bench, a garden swing, a gazebo, a footstool): no more
 *     sat in at once than it seats; sat in, the wind comes back as standing
 *     still, a swing's `SWING_REST` times that, and a job's not at all;
 *   * a gazebo: its tile decays as under a roof;
 *   * a hay bale stack: feeds a kept wildermon that eats mixed grass within
 *     `HAY_REACH`, `HAY_A_DAY` a day, before the stores; not one that does
 *     not; filled back with mixed grass to its room;
 *   * a water trough: water only; filled as a barrel, a water carrier's
 *     barrel; a kept wildermon in reach drinks `TROUGH_DRINK` a day and its
 *     care holds `TROUGH_CARE` times as long;
 *   * a signpost: arms to settlements, read live, refused twice or to what is
 *     not there, taken down;
 *   * a cairn: named by whoever may, and on the map of its settlement's
 *     citizens and nobody else's;
 *   * a fireplace: against a solid wall, inside a building only; a hearth;
 *   * a four-poster bed: `FOUR_POSTER_REST` a bed's sleep, dyed;
 *   * a vase: wildflowers to its room, fresh for `VASE_FRESH` days, then
 *     thrown out wilted;
 *   * a side table: what is carried set on it and taken off, shown, its
 *     owner's to change, not picked up with things on it;
 *   * a trophy fish mount: a fish mounted with its weight and who mounted
 *     it, replaced by its owner with a heavier one of its kind only.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/furnish.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/furnish.mjs && node node_modules/.cache/furnish.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureDef } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  armReading, armWords, FILL_HAY, fishKg, fishLabel, FURNISH_DONE, FURNISH_JOBS, FURNISH_SAID, furnishDone, furnishSaid, MOUNT_FISH, NAME_CAIRN, POINT_ARM,
  DROP_ARM, READ_SIGNPOST, SIT_SEAT, signpostSays, TABLE_PUT, TABLE_TAKE, VASE_PUT, VASE_TAKE, type FurnishDone, type FurnishSaid,
} from '../../src/game/furnish';
import {
  BIRDBATH, CAIRN, FIREPLACE, FIREPLACE_REACH, FISH_MOUNT, FOOTSTOOL, FOUR_POSTER, FOUR_POSTER_REST, GARDEN_SWING, GAZEBO, HAY_A_DAY, HAY_BALE, HAY_HOLDS,
  SIDE_TABLE, SIGN_ARMS, SIGNPOST, STONE_BENCH, SWING_REST, TABLE_HOLDS, TROUGH_CARE, TROUGH_DRINK, TROUGH_WATER_ONLY, VASE, VASE_HOLDS, WATER_TROUGH,
} from '../../src/game/furnishdefs';
import { GARDEN_SAID, MOUNT_SAID } from '../../src/game/garden';
import { DYEABLE_ITEMS } from '../../src/game/dyes';
import { dyeText, pureDye } from '../../src/game/dyestuffs';
import { INDOORS_DECAY } from '../../src/game/building';
import { BREWS, brewReason } from '../../src/game/brewing';
import { STROKE_BY_ID } from '../../src/audio/strokes';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const PIECES = [BIRDBATH, STONE_BENCH, GARDEN_SWING, GAZEBO, HAY_BALE, WATER_TROUGH, SIGNPOST, CAIRN, FIREPLACE, FOUR_POSTER, VASE, SIDE_TABLE, FOOTSTOOL, FISH_MOUNT];
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- 1. the pieces, their recipes, their items and their jobs, the same on both sides ---------------- */

check(`${PIECES.length} pieces, each a piece and an item`, PIECES.every((id) => FURNITURE_BY_ID.has(id) && !!ITEM_DEFS[id]));
for (const id of PIECES) {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const here = r ? `${r.skill}|${r.tool}|${r.baseTime}|${r.difficulty}|${r.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : 'none';
  const isle = psql(`select r.skill || '|' || r.tool || '|' || r.base_time || '|' || r.difficulty || '|'
    || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
    from recipe r where r.id = 'make_${id}'`);
  check(`${id}: a recipe with its trade, tool, time and bill, the same on both sides (${here})`, isle === here && !!r, isle);
  const f = FURNITURE_BY_ID.get(id);
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(mount, '-'), coalesce(seats, 0), coalesce(bed, 0), coalesce(liquid, 0), hearth::text) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.mount ?? '-', f?.seats ?? 0, f?.bed ?? 0, f?.liquid ?? 0, !!f?.hearth].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{'), desc);
}
check('a birdbath, a stone bench, a cairn and a fireplace are masonry; a swing, a gazebo, a trough, a signpost, a side table and a footstool carpentry',
  [BIRDBATH, STONE_BENCH, CAIRN, FIREPLACE].every((id) => RECIPE_BY_ID.get(`make_${id}`)?.skill === 'masonry')
  && [GARDEN_SWING, GAZEBO, WATER_TROUGH, SIGNPOST, SIDE_TABLE, FOOTSTOOL].every((id) => RECIPE_BY_ID.get(`make_${id}`)?.skill === 'carpentry'));
check('a swing takes rope; a gazebo thatch; a trough a barrel; a hay bale stack mixed grass by farming; a vase clay by pottery; a four-poster fine carpentry and cloth; a fish mount fishing',
  !!RECIPE_BY_ID.get(`make_${GARDEN_SWING}`)?.inputs.some((x) => x.item === 'rope') && !!RECIPE_BY_ID.get(`make_${GAZEBO}`)?.inputs.some((x) => x.item === 'thatch')
  && !!RECIPE_BY_ID.get(`make_${WATER_TROUGH}`)?.inputs.some((x) => x.item === 'barrel')
  && RECIPE_BY_ID.get(`make_${HAY_BALE}`)?.skill === 'farming' && RECIPE_BY_ID.get(`make_${HAY_BALE}`)?.inputs[0]?.count === HAY_HOLDS
  && RECIPE_BY_ID.get(`make_${VASE}`)?.skill === 'pottery' && RECIPE_BY_ID.get(`make_${FOUR_POSTER}`)?.skill === 'fine_carpentry'
  && !!RECIPE_BY_ID.get(`make_${FOUR_POSTER}`)?.inputs.some((x) => x.item === 'cloth') && RECIPE_BY_ID.get(`make_${FISH_MOUNT}`)?.skill === 'fishing');
check('a four-poster bed and a vase take a dye, on the island too', DYEABLE_ITEMS.has(FOUR_POSTER) && DYEABLE_ITEMS.has(VASE)
  && psql(`select count(*) from dyeable_item where id in ('${FOUR_POSTER}', '${VASE}')`) === '2');
check(`a stone bench does not rot`, ITEM_DEFS[STONE_BENCH]?.decay === 0 && psql(`select decay from item_def where id = '${STONE_BENCH}'`) === '0');
check(`a four-poster bed sleeps ${FOUR_POSTER_REST} a bed's, on the island`,
  Math.abs(Number(psql(`select sleep_rate(${FOUR_POSTER_REST}, 50) / sleep_rate(1, 50)`)) - FOUR_POSTER_REST) < 1e-9
  && Math.abs(Number(psql(`select bed from furniture_def where id = '${FOUR_POSTER}'`)) - FOUR_POSTER_REST) < 1e-6);

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time, '|' order by id)
  from action_def where id = any (array[${FURNISH_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...FURNISH_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}`;
}).join('|');
check(`its ${FURNISH_JOBS.length} jobs are the same rows on both sides`, jobsIsle === jobsHere, jobsIsle);
check('and every one of them is a furnishing\'s job on the island', psql(`select bool_and(furnish_action(id)) from unnest(array[${FURNISH_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
check('every timed job has a sound', FURNISH_JOBS.every((id) => (ACTION_BY_ID.get(id)?.instant ?? false) || !!STROKE_BY_ID[id]),
  FURNISH_JOBS.filter((id) => !ACTION_BY_ID.get(id)?.instant && !STROKE_BY_ID[id]).join(','));
{
  const keys = Object.keys(FURNISH_SAID) as FurnishSaid[];
  const isle = psql(`select string_agg(furnish_said(k, 'stone bench', 2, 'pike'), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => furnishSaid(k, { name: 'stone bench', n: 2, what: 'pike' })).join('#'), isle);
  const done = Object.keys(FURNISH_DONE) as FurnishDone[];
  const dIsle = psql(`select string_agg(furnish_done(k, 'pike', 2, 5, 20), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => furnishDone(k, { what: 'pike', n: 2, held: 5, of: 20 })).join('#'), dIsle);
  const kgs = [['pike', 40], ['perch', 73], ['sturgeon', 99], ['trout', 1], ['bluefin', 55.5]] as const;
  const kIsle = psql(`select string_agg(kg_words(fish_kg(d, q)), '#' order by o) from (values ${kgs.map(([d, q], i) => `(${sq(d)}, ${q}::double precision, ${i})`).join(', ')}) v(d, q, o)`);
  check('a fish weighs the same on both sides', kIsle === kgs.map(([d, q]) => `${fishKg(d, q).toFixed(2)} kg`).join('#'), kIsle);
  const arms = [[10.5, 10.5, 40.5, 50.5], [3.5, 9.5, 3.5, 1.5], [20.5, 20.5, 5.5, 31.5], [7.5, 7.5, 2.5, 2.5]] as const;
  const aIsle = psql(`select string_agg(arm_words('X', a, b, c, d), '#' order by o) from (values ${arms.map((a, i) => `(${a.join(', ')}, ${i})`).join(', ')}) v(a, b, c, d, o)`);
  check('and an arm reads the same', aIsle === arms.map(([a, b, c, d]) => armWords('X', armReading(a, b, { x: c, y: d }))).join('#'), aIsle);
}

/* ---- 2. on the island ---------------------------------------------------------------------------- */

const MIRA = 'f0e15a00-0000-4000-8000-0000000000f1';
const OTTO = 'f0e15a00-0000-4000-8000-0000000000f2';
const T = (id: string, more = ''): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${more})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 0, sy = 0): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string, who = 'u'): string => `perform act_perform(w, ${who}, '${action}', ${target});`;
/** Build a piece through its own recipe, at a set roll, and return its item into `v_it`. */
const build = (id: string): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const gives = (r?.inputs ?? []).map((i) => `perform give(w, u, '${i.item}', ${i.count}, 40${i.item === 'plank' || i.item === 'shaft' || i.item === 'timber' ? ", 'Oak'" : ''});`).join('\n  ');
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1)));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;`;
};
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now(), level = 0 where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${build_ask(key, target)}
  ${act('place_furniture', target)}
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;
const build_ask = (key: string, target: string): string => ask(`${key}:ask`, 'place_furniture', target);
/** Set down a piece built through its recipe on tile (x, y), standing on it. */
const piece = (key: string, id: string, x: number, y: number, facing = 's', sx = 0, sy = 0): string => `${at(x, y)}
  ${build(id)}
  ${place(key, TILE('v_it', x, y, facing, sx, sy))}`;
/** The wind a body gets back over ten seconds standing still, from a fifth. */
const wind = (key: string, actSet: string): string => `update player set stats = stats || '{"stamina": 0.2}'::jsonb, body_at = now() - interval '10 seconds',
    moved_at = now() - interval '1 hour', ${actSet} where world_id = w and uid = u;
  perform body_settle(w, u);
  insert into said select '${key}', ((stats->>'stamina')::double precision - 0.2)::text from player where world_id = w and uid = u;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wildermon.dice'), ',');
        n int := coalesce(nullif(current_setting('wildermon.dice_n', true), ''), '0')::int;
begin
  perform set_config('wildermon.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wildermon.dice', v, true);
  perform set_config('wildermon.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_a bigint; v_b bigint; v_g jsonb; c creature; v_far creature;
        v_bench bigint; v_swing bigint; v_stool bigint; v_gaz bigint; v_hay bigint; v_tr bigint; v_sign bigint; v_cairn bigint; v_fire bigint;
        v_bed bigint; v_vase bigint; v_table bigint; v_mount bigint; v_bath bigint; v_none text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fairhold', 171, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) select w, x.uid, s.id, 60 from (values (u), (o)) x(uid),
    unnest(array['fine_carpentry', 'carpentry', 'masonry', 'farming', 'pottery', 'fishing', 'alchemy']) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  -- Mira's settlement over the yard, and Otto's off to the south-east.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 12, 8, 1, u);
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ford', 40, 50, 3, 1, o);
  perform deed_ranks_seed(w, u);
  -- A house: its north side a window at x 10, a solid wall at 11; its inside, 10..11 at y 12.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 91, 'Cottage', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 91, 10, 12), (w, 91, 11, 12);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 0, 'h', 10, 12, 91, 'window', 'plank', '{"plank":0}', '{"plank":18}', u),
    (w, 0, 'h', 11, 12, 91, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u);

  -- 1. Seats: a footstool for one, a bench for two, a swing; Otto sat on the stool and the bench.
  ${piece('BATH', BIRDBATH, 20, 4)}
  v_bath := v_pl;
  ${piece('BENCH', STONE_BENCH, 26, 26)}
  v_bench := v_pl;
  ${piece('SWING', GARDEN_SWING, 28, 26)}
  v_swing := v_pl;
  ${piece('STOOL', FOOTSTOOL, 26, 27)}
  v_stool := v_pl;
  update player set x = 26.5, y = 27, act = '${SIT_SEAT}', act_target = ${T('v_stool')}, act_ends = now() + interval '60 seconds' where world_id = w and uid = o;
  ${at(26, 27)}
  ${ask('SIT:stoolfull', SIT_SEAT, T('v_stool'))}
  update player set act_target = ${T('v_bench')} where world_id = w and uid = o;
  ${ask('SIT:bench', SIT_SEAT, T('v_bench'))}
  update player set act = null, act_target = null, act_ends = null where world_id = w and uid = o;
  ${ask('SIT:stool', SIT_SEAT, T('v_stool'))}
  ${act(SIT_SEAT, T('v_stool'))}
  insert into said values ('SIT:up', ${lastSaid()});
  ${wind('WIND:still', 'act = null, act_target = null')}
  ${wind('WIND:swing', `act = '${SIT_SEAT}', act_target = ${T('v_swing')}`)}
  ${wind('WIND:bench', `act = '${SIT_SEAT}', act_target = ${T('v_bench')}`)}
  ${wind('WIND:job', "act = 'dig', act_target = '{}'::jsonb")}
  update player set act = null, act_target = null where world_id = w and uid = u;

  -- 2. A gazebo: its tile as under a roof.
  ${piece('GAZ', GAZEBO, 32, 32)}
  v_gaz := v_pl;
  insert into said values ('GAZ:decay', decay_multiplier(w, 32, 32)::text || '|' || decay_multiplier(w, 33, 32)::text);

  -- 3. A hay bale stack and a water trough on the settlement; a grass eater between them, one far off, and one that eats no grass.
  ${piece('HAY', HAY_BALE, 8, 16)}
  v_hay := v_pl;
  ${piece('TR', WATER_TROUGH, 16, 16)}
  v_tr := v_pl;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, leg_at, leg_ends, health, sex, keeper, hunger, care) values
    (w, 9901, 'woola', 'Fleece', 'active', 12.5, 16.5, 12.5, 16.5, now(), now(), 30, 'female', u, 0.1, 1),
    (w, 9902, 'woola', 'Faraway', 'active', 40.5, 40.5, 40.5, 40.5, now(), now(), 30, 'female', u, 0.1, 1),
    (w, 9903, (select id from species_def where id not in (select species from species_diet where item = 'mixed_grass') order by id limit 1),
       'Picky', 'active', 12.5, 17.5, 12.5, 17.5, now(), now(), 30, 'female', u, 0.1, 1);
  v_none := worker_feed(w, 9901);
  insert into said values ('HAY:fed', coalesce(v_none, 'nothing') || '|' || (select pl.garden->>'hay' from placed pl where pl.id = v_hay)
    || '|' || (select (pl.garden->'ate') ? '9901' from placed pl where pl.id = v_hay)::text || '|' || (select round(hunger::numeric, 2) from creature where world_id = w and id = 9901));
  update creature set hunger = 0.1 where world_id = w and id = 9901;
  v_none := worker_feed(w, 9901);
  insert into said values ('HAY:again', coalesce(v_none, 'nothing') || '|' || (select pl.garden->>'hay' from placed pl where pl.id = v_hay));
  insert into said values ('HAY:far', coalesce(worker_feed(w, 9902), 'nothing'));
  v_none := worker_feed(w, 9903);
  insert into said values ('HAY:picky', coalesce(v_none, 'nothing') || '|' || (select pl.garden->>'hay' from placed pl where pl.id = v_hay));
  ${at(8, 16)}
  ${ask('HAY:nograss', FILL_HAY, T('v_hay'))}
  v_a := give(w, u, 'mixed_grass', 5, 30);
  ${act(FILL_HAY, T('v_hay'))}
  insert into said values ('HAY:filled', ${lastSaid()} || '|' || ${count('mixed_grass')}::text);
  ${ask('HAY:full', FILL_HAY, T('v_hay'))}
  -- The trough: water poured in as into a barrel, a water carrier's; nothing else.
  ${at(16, 16)}
  update placed set litres = 10, liquid = 'water' where id = v_tr;
  insert into said values ('TR:carrier', coalesce(((thirsty_vessel(w, u)).id = v_tr)::text, 'none'));
  insert into said values ('TR:pour', coalesce(((barrel_for(w, u, 'water')).id = v_tr)::text, 'none') || '|' || coalesce((barrel_for(w, u, '${BREWS[0].id}')).id::text, 'none'));
  insert into said values ('TR:brew', coalesce(brew_reason(w, u, (select pl from placed pl where pl.id = v_tr), (select b from brew_def b where b.id = '${BREWS[0].id}')), 'none'));
  ${ask('TR:leach', 'leach_lye', T('v_tr'))}
  select * into c from creature where world_id = w and id = 9901;
  select * into v_far from creature where world_id = w and id = 9902;
  v_none := trough_visit(w, c)::text || '|' || trough_visit(w, c)::text || '|' || trough_visit(w, v_far)::text;
  insert into said values ('TR:drink', v_none
    || '|' || (select pl.litres::text from placed pl where pl.id = v_tr) || '|' || (select (pl.garden->'drank') ? '9901' from placed pl where pl.id = v_tr)::text);
  insert into said values ('TR:settle', (position('trough_visit(p_world, c)' in pg_get_functiondef('creature_settle(uuid, integer)'::regprocedure)) > 0)::text);

  -- 4. A signpost: an arm to Otto's settlement, refused twice, to what is not there, and taken down.
  ${piece('SIGN', SIGNPOST, 14, 16)}
  v_sign := v_pl;
  ${ask('SIGN:stone', POINT_ARM, T('v_sign', ", 'dest', 'stone:crownstone'"))}
  ${ask('SIGN:ok', POINT_ARM, T('v_sign', ", 'dest', 'deed:40,50'"))}
  ${act(POINT_ARM, T('v_sign', ", 'dest', 'deed:40,50'"))}
  insert into said values ('SIGN:said', ${lastSaid()});
  ${ask('SIGN:twice', POINT_ARM, T('v_sign', ", 'dest', 'deed:40,50'"))}
  ${act(POINT_ARM, T('v_sign', ", 'dest', 'deed:12,12'"))}
  ${act(READ_SIGNPOST, T('v_sign'))}
  insert into said values ('SIGN:read', ${lastSaid()});
  -- Read live: Otto's settlement renamed, and the post says so.
  update deed set name = 'Fordham' where world_id = w and founded_by = o;
  ${act(READ_SIGNPOST, T('v_sign'))}
  insert into said values ('SIGN:live', ${lastSaid()});
  update deed set name = 'Ford' where world_id = w and founded_by = o;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_SIGN', v_g::text);
  insert into said values ('SIGN:id', v_sign::text);
  ${act(DROP_ARM(0), T('v_sign'))}
  insert into said values ('SIGN:down', ${lastSaid()} || '|' || (select jsonb_array_length(pl.garden->'arms') from placed pl where pl.id = v_sign)::text);
  ${ask('SIGN:noarm', DROP_ARM(1), T('v_sign'))}
  v_g := (select pl.garden->'arms'->0 from placed pl where pl.id = v_sign);
  update placed set garden = jsonb_build_object('arms', (select jsonb_agg(v_g) from generate_series(1, ${SIGN_ARMS}))) where id = v_sign;
  ${ask('SIGN:full', POINT_ARM, T('v_sign', ", 'dest', 'deed:40,50'"))}

  -- 5. A cairn on Mira's settlement: named; on her map, not on Otto's.
  ${piece('CAIRN', CAIRN, 13, 13)}
  v_cairn := v_pl;
  ${ask('CAIRN:empty', NAME_CAIRN, T('v_cairn', ", 'name', '   '"))}
  ${act(NAME_CAIRN, T('v_cairn', ", 'name', 'Old  Ford'"))}
  insert into said values ('CAIRN:said', ${lastSaid()} || '|' || (select pl.engraving from placed pl where pl.id = v_cairn));
  ${ask('CAIRN:same', NAME_CAIRN, T('v_cairn', ", 'name', 'Old Ford'"))}
  update player set x = 13.5, y = 13.5 where world_id = w and uid = o;
  ${ask('CAIRN:otto', NAME_CAIRN, T('v_cairn', ", 'name', 'Mine'"), 'o')}
  insert into said values ('CAIRN:mira', (rpc_settlements(w)->'cairns')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  insert into said values ('CAIRN:otto_map', (rpc_settlements(w)->'cairns')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);

  -- 6. A fireplace: inside, against the solid wall; not outside, not on a window.
  ${at(11, 12)}
  ${build(FIREPLACE)}
  ${ask('FIRE:outside', 'place_furniture', TILE('v_it', 11, 11, 's'))}
  ${ask('FIRE:window', 'place_furniture', TILE('v_it', 10, 12, 'n'))}
  ${place('FIRE', TILE('v_it', 11, 12, 'n'))}
  v_fire := v_pl;

  -- 7. A four-poster bed, its canopy dyed.
  ${at(4, 4)}
  ${build(FOUR_POSTER)}
  v_b := give(w, u, 'dye_bucket', 1, 50);
  update item set dye = ${sq(dyeText(pureDye('red', 50), 10))} where id = v_b;
  ${ask('BED:dye', 'dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  ${place('BED', TILE('v_it', 4, 4, 's'))}
  v_bed := v_pl;

  -- 8. A vase: wildflowers to its room, taken out fresh; then left to wilt and thrown out.
  ${piece('VASE', VASE, 22, 10)}
  v_vase := v_pl;
  ${ask('VASE:none', VASE_PUT, T('v_vase'))}
  ${ask('VASE:empty', VASE_TAKE, T('v_vase'))}
  v_a := give(w, u, 'wildflowers', 5, 30);
  ${act(VASE_PUT, T('v_vase'))}
  insert into said values ('VASE:put', ${lastSaid()} || '|' || ${count('wildflowers')}::text);
  ${ask('VASE:full', VASE_PUT, T('v_vase'))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_VASE', v_g::text);
  ${act(VASE_TAKE, T('v_vase'))}
  insert into said values ('VASE:taken', ${lastSaid()} || '|' || ${count('wildflowers')}::text);
  ${act(VASE_PUT, T('v_vase'))}
  update placed set garden = jsonb_set(garden, '{vase,at}', to_jsonb(extract(epoch from now()) - vase_fresh() * day_seconds() - 1)) where id = v_vase;
  ${ask('VASE:wilted', VASE_PUT, T('v_vase'))}
  ${act(VASE_TAKE, T('v_vase'))}
  insert into said values ('VASE:gone', ${lastSaid()} || '|' || ${count('wildflowers')}::text);

  -- 9. A side table: a thing set on it, a second, refused a third; not picked up; Otto's not to change; one taken off.
  ${piece('TABLE', SIDE_TABLE, 24, 12)}
  v_table := v_pl;
  delete from item where world_id = w and holder_uid = u and def not in ('mallet', 'trowel', 'sickle', 'carving_knife');
  ${ask('TABLE:pick', TABLE_PUT, T('v_table'))}
  v_a := give(w, u, 'bread', 2, 30);
  v_b := give(w, u, 'clay_pot', 1, 30);
  update item set dye = '#3366aa' where id = v_b;
  ${act(TABLE_PUT, T('v_table', ", 'itemUid', v_a"))}
  insert into said values ('TABLE:put', ${lastSaid()});
  ${act(TABLE_PUT, T('v_table', ", 'itemUid', v_b"))}
  v_a := give(w, u, 'plank', 1, 30, 'Oak');
  ${ask('TABLE:full', TABLE_PUT, T('v_table', ", 'itemUid', v_a"))}
  ${ask('TABLE:lift', 'pick_up_furniture', T('v_table'))}
  update player set x = 24.5, y = 12.5 where world_id = w and uid = o;
  ${ask('TABLE:otto', TABLE_TAKE(0), T('v_table'), 'o')}
  insert into said select 'TABLE:on', (pl.garden->'on')::text from placed pl where pl.id = v_table;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_TABLE', v_g::text);
  ${act(TABLE_TAKE(0), T('v_table'))}
  insert into said values ('TABLE:took', ${lastSaid()} || '|' || ${count('bread')}::text || '|' || (select jsonb_array_length(pl.garden->'on') from placed pl where pl.id = v_table)::text);

  -- 10. A trophy fish mount on the outer face of the solid wall: a pike, a smaller one refused, a trout refused, a bigger pike; not Otto's.
  ${at(11, 11)}
  ${build(FISH_MOUNT)}
  ${place('MOUNT', TILE('v_it', 11, 11, 's'))}
  v_mount := v_pl;
  ${ask('MOUNT:nofish', MOUNT_FISH, T('v_mount'))}
  v_a := give(w, u, 'pike', 1, 40);
  ${act(MOUNT_FISH, T('v_mount'))}
  insert into said values ('MOUNT:said', ${lastSaid()} || '|' || ${count('pike')}::text);
  v_a := give(w, u, 'pike', 1, 30);
  ${ask('MOUNT:smaller', MOUNT_FISH, T('v_mount', ", 'itemUid', v_a"))}
  v_b := give(w, u, 'trout', 1, 90);
  ${ask('MOUNT:trout', MOUNT_FISH, T('v_mount', ", 'itemUid', v_b"))}
  update player set x = 11.5, y = 11.5 where world_id = w and uid = o;
  perform give(w, o, 'pike', 1, 95);
  ${ask('MOUNT:otto', MOUNT_FISH, T('v_mount'), 'o')}
  delete from item where world_id = w and holder_uid = u and def in ('pike', 'trout');
  v_a := give(w, u, 'pike', 1, 60);
  ${act(MOUNT_FISH, T('v_mount'))}
  insert into said values ('MOUNT:bigger', ${lastSaid()} || '|' || (select pl.garden->'fish'->>'kg' from placed pl where pl.id = v_mount));

  -- Every browser told.
  ${at(16, 16)}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('IDS', concat_ws(',', v_bench, v_swing, v_stool, v_gaz, v_hay, v_tr, v_sign, v_cairn, v_fire, v_bed, v_vase, v_table, v_mount, v_bath));
  insert into said values ('GROUND', v_g::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

for (const k of ['BATH', 'BENCH', 'SWING', 'STOOL', 'GAZ', 'HAY', 'TR', 'SIGN', 'CAIRN', 'FIRE', 'BED', 'VASE', 'TABLE', 'MOUNT']) is(`${k}:ask`, 'none', `${k}: built and set down`);
/* 1. */
is('SIT:stoolfull', furnishSaid('seatsFull', { name: 'footstool', n: 1 }), 'a footstool seats one, and one is sat on it');
is('SIT:bench', 'none', 'a stone bench seats two');
is('SIT:stool', 'none', 'the stool free again');
is('SIT:up', furnishDone('up', { what: 'footstool' }), 'a sitting ends, said');
{
  const still = Number(said('WIND:still')), swing = Number(said('WIND:swing')), bench = Number(said('WIND:bench')), job = Number(said('WIND:job'));
  check(`sat in a garden swing, the wind comes back ×${SWING_REST} standing still's; on a bench as standing still; at a job not at all`,
    still > 0 && Math.abs(swing / still - SWING_REST) < 1e-6 && Math.abs(bench / still - 1) < 1e-6 && job === 0, `${still} ${swing} ${bench} ${job}`);
}
/* 2. */
check(`a gazebo's tile decays ×${INDOORS_DECAY} its neighbour's`, (() => {
  const [under, next] = said('GAZ:decay').split('|').map(Number);
  return Math.abs(under / next - INDOORS_DECAY) < 1e-9;
})(), said('GAZ:decay'));
/* 3. */
check(`a hay bale stack feeds a grass eater in reach ${HAY_A_DAY} a day, before the stores`, said('HAY:fed').startsWith(`mixed_grass|${HAY_HOLDS - HAY_A_DAY}|true|`), said('HAY:fed'));
is('HAY:again', `nothing|${HAY_HOLDS - HAY_A_DAY}`, 'and not twice in a day');
is('HAY:far', 'nothing', 'nor one out of reach');
is('HAY:picky', `nothing|${HAY_HOLDS - HAY_A_DAY}`, 'nor one that eats no grass');
is('HAY:nograss', FURNISH_SAID.noHay, 'a stack is filled with mixed grass');
check('to its room, the rest left', said('HAY:filled') === `${furnishDone('hay', { n: HAY_A_DAY, held: HAY_HOLDS, of: HAY_HOLDS })}|${5 - HAY_A_DAY}`, said('HAY:filled'));
is('HAY:full', FURNISH_SAID.hayFull, 'and refuses more');
is('TR:carrier', 'true', 'a water trough is a water carrier\'s barrel');
is('TR:pour', 'true|none', 'water is poured into it, nothing else');
is('TR:brew', TROUGH_WATER_ONLY, 'no brew is set going in it');
is('TR:leach', TROUGH_WATER_ONLY, 'no lye leached in it');
is('TR:drink', `${TROUGH_CARE}|${TROUGH_CARE}|1|${10 - TROUGH_DRINK}|true`, `a wildermon in reach drinks ${TROUGH_DRINK} litre a day, and its care holds ×${TROUGH_CARE}`);
is('TR:settle', 'true', 'and the island\'s care fades by it');
/* 4. */
is('SIGN:stone', FURNISH_SAID.noDest, 'no arm to a Runestone this island has not');
is('SIGN:ok', 'none', 'an arm to a settlement');
is('SIGN:twice', FURNISH_SAID.armThere, 'but not two');
is('SIGN:noarm', FURNISH_SAID.noArm, 'no arm to take down');
is('SIGN:full', FURNISH_SAID.armsFull, `and no more than ${SIGN_ARMS}`);
check('an arm says its bearing and distance as the browser works them out', said('SIGN:said') === furnishDone('arm', { n: 1, what: armWords('Ford', armReading(14.5, 16.5, { x: 40.5, y: 50.5 })) }), said('SIGN:said'));
check('read live off the island: a settlement renamed is read by its new name', said('SIGN:live').includes('Fordham:') && !said('SIGN:live').includes('Ford:'), said('SIGN:live'));
check('taken down, said', said('SIGN:down') === `${furnishDone('armDown', { what: 'Ford' })}|1`, said('SIGN:down'));
/* 5. */
is('CAIRN:empty', FURNISH_SAID.noName, 'a cairn is not named nothing');
is('CAIRN:said', `${furnishDone('named', { what: 'Old Ford' })}|Old Ford`, 'it is named, the name cleaned as talk is');
is('CAIRN:same', FURNISH_SAID.sameName, 'and not the same again');
is('CAIRN:otto', FURNISH_SAID.cairnNotYours, 'nor by somebody not of its settlement');
is('CAIRN:mira', '[{"x": 13, "y": 13, "name": "Old Ford"}]', 'it is on the map of its settlement\'s citizens');
is('CAIRN:otto_map', '[]', 'and of nobody else');
/* 6. */
is('FIRE:outside', MOUNT_SAID.outside, 'a fireplace not outside a building');
is('FIRE:window', MOUNT_SAID.noWall, 'nor on a window');
/* 7. */
is('BED:dye', 'none', 'a four-poster bed\'s canopy takes a dye');
/* 8. */
is('VASE:none', FURNISH_SAID.noFlowers, 'a vase with no wildflowers to put in');
is('VASE:empty', FURNISH_SAID.vaseEmpty, 'and nothing to take out');
check(`wildflowers to its room, ${VASE_HOLDS}, the rest left`, said('VASE:put') === `${furnishDone('posy', { n: VASE_HOLDS, held: VASE_HOLDS, of: VASE_HOLDS })}|${5 - VASE_HOLDS}`, said('VASE:put'));
is('VASE:full', FURNISH_SAID.vaseFull, 'then full');
is('VASE:taken', `${furnishDone('posyTaken', { n: VASE_HOLDS })}|5`, 'taken out fresh, every one back');
is('VASE:wilted', FURNISH_SAID.wilted, 'wilted, nothing more goes in');
is('VASE:gone', `${furnishDone('posyGone', { n: VASE_HOLDS })}|${5 - VASE_HOLDS}`, 'and they are thrown out');
/* 9. */
is('TABLE:pick', FURNISH_SAID.pick, 'a side table is given a thing from the pack');
is('TABLE:put', furnishDone('put', { what: 'bread' }), 'a thing set on it');
is('TABLE:full', FURNISH_SAID.tableFull, `and no more than ${TABLE_HOLDS}`);
is('TABLE:lift', GARDEN_SAID.showing, 'not picked up with things on it');
is('TABLE:otto', furnishSaid('notYours', { name: 'side table' }), 'somebody else\'s, off a settlement of theirs');
check('what is on it, told as it is drawn', said('TABLE:on').startsWith('[["bread", 30') && said('TABLE:on').includes('["clay_pot", 30, "#3366aa"]'), said('TABLE:on'));
is('TABLE:took', `${furnishDone('taken', { what: 'bread' })}|2|1`, 'taken off, back to the pack');
/* 10. */
is('MOUNT:nofish', FURNISH_SAID.noFish, 'a mount with no fish in the pack');
check('a fish mounted, its weight and who mounted it', said('MOUNT:said') === `${furnishDone('mounted', { what: fishLabel({ def: 'pike', kg: fishKg('pike', 40), ql: 40, by: 'Mira' }) })}|0`, said('MOUNT:said'));
is('MOUNT:smaller', furnishSaid('notBigger', { what: `pike, ${fishKg('pike', 40).toFixed(2)} kg` }), 'a smaller one of its kind refused');
is('MOUNT:trout', furnishSaid('otherKind', { what: 'pike' }), 'and another kind');
is('MOUNT:otto', FURNISH_SAID.mountNotYours, 'and anybody but whoever set it down');
check('a bigger one replaces it', said('MOUNT:bigger') === `${furnishDone('mounted', { what: fishLabel({ def: 'pike', kg: fishKg('pike', 60), ql: 60, by: 'Mira' }) })}|${fishKg('pike', 60)}`, said('MOUNT:bigger'));

/* ---- 3. what every browser reads, and says the same of ------------------------------------------------- */

const ids = said('IDS').split(',').map(Number);
const [bench, swing, stool, gaz, hay, tr, , cairn, fire, bed, vase, table, mount] = ids;
const looker = (ground: string): Game => {
  const g = Game.create(171, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(JSON.parse(ground) as IslandGround);
  return g;
};
{
  const seen = looker(said('GROUND_SIGN'));
  const f = seen.furniture.get(Number(said('SIGN:id')));
  check('the browser reads a signpost\'s arms and says them as the island reads them', !!f && signpostSays(f) === said('SIGN:read'), `${f ? signpostSays(f) : '-'} / ${said('SIGN:read')}`);
  seen.putBody(14.5, 16.5, 0);
  const why = (id: string, t: object): string => ACTION_BY_ID.get(id)?.check?.(t as never, seen) ?? 'none';
  check('and refuses an arm twice, and to a Runestone this island has not, in the island\'s words',
    why(POINT_ARM, { kind: 'furniture', id: f?.id, dest: 'deed:40,50' }) === FURNISH_SAID.armThere
    && why(POINT_ARM, { kind: 'furniture', id: f?.id, dest: 'stone:crownstone' }) === FURNISH_SAID.noDest);
}
{
  const seen = looker(said('GROUND_VASE'));
  check(`the browser reads a vase's wildflowers`, seen.furniture.get(vase)?.furnish?.vase?.n === VASE_HOLDS, JSON.stringify(seen.furniture.get(vase)?.furnish));
  seen.putBody(22.5, 10.5, 0);
  seen.inventory.items.length = 0;
  seen.inventory.add('wildflowers', { ql: 30 });
  check('and refuses more in the island\'s words', ACTION_BY_ID.get(VASE_PUT)?.check?.({ kind: 'furniture', id: vase } as never, seen) === FURNISH_SAID.vaseFull);
}
{
  const seen = looker(said('GROUND_TABLE'));
  const on = seen.furniture.get(table)?.furnish?.on ?? [];
  check('the browser reads what is on a side table, its dye too', on.length === 2 && on[0][0] === 'bread' && on[1][2] === '#3366aa', JSON.stringify(on));
  seen.putBody(24.5, 12.5, 0);
  check('and refuses a third thing in the island\'s words', ACTION_BY_ID.get(TABLE_PUT)?.check?.({ kind: 'furniture', id: table, itemUid: seen.inventory.add('plank', { ql: 30 }).uid } as never, seen) === FURNISH_SAID.tableFull);
}
{
  const seen = looker(said('GROUND'));
  const f = (id: number) => seen.furniture.get(id);
  check('the browser reads a hay bale stack\'s grass', f(hay)?.furnish?.hay === HAY_HOLDS, JSON.stringify(f(hay)?.furnish));
  check('and a trough\'s water', (f(tr)?.litres ?? 0) === 10 - TROUGH_DRINK && f(tr)?.liquid === 'water', `${f(tr)?.litres}`);
  check('and a cairn\'s name', f(cairn)?.engraving === 'Old Ford');
  check('and a fish on a mount', f(mount)?.furnish?.fish?.def === 'pike' && f(mount)?.furnish?.fish?.kg === fishKg('pike', 60) && f(mount)?.furnish?.fish?.by === 'Mira', JSON.stringify(f(mount)?.furnish));
  check('and a dyed four-poster', !!f(bed)?.dye);
  check(`a gazebo's tile decays as under a roof in the browser too`, Math.abs(seen.decayMultiplier(32, 32) / seen.decayMultiplier(33, 32) - INDOORS_DECAY) < 1e-9);
  const fp = f(fire);
  if (fp) fp.lit = true;
  seen.islandClock = () => 0;
  check(`a fireplace lit lights ${FIREPLACE_REACH} tiles`, seen.lights().some((s) => s.radius === FIREPLACE_REACH));
  check('a fireplace is a hearth: fed, lit and cooked at as an oven', !!furnitureDef(FIREPLACE).hearth && psql(`select hearth::text from furniture_def where id = '${FIREPLACE}'`) === 'true');
  seen.putBody(16.5, 16.5, 0);
  check('the browser refuses a brew in a trough in the island\'s words', brewReason(seen, f(tr), BREWS[0]) === TROUGH_WATER_ONLY);
  seen.putBody(26.5, 27, 0);
  check('the browser offers a seat with its bodies', ACTION_BY_ID.get(SIT_SEAT)?.labelFor?.({ kind: 'furniture', id: stool } as never, seen) === 'Sit (0 of 1)'
    && ACTION_BY_ID.get(SIT_SEAT)?.applies({ kind: 'furniture', id: bench } as never, seen) === true
    && ACTION_BY_ID.get(SIT_SEAT)?.applies({ kind: 'furniture', id: swing } as never, seen) === true
    && ACTION_BY_ID.get(SIT_SEAT)?.applies({ kind: 'furniture', id: gaz } as never, seen) === true);
  seen.putBody(11.5, 11.5, 0);
  seen.inventory.items.length = 0;
  const small = seen.inventory.add('pike', { ql: 30 });
  check('and refuses a smaller fish in the island\'s words', ACTION_BY_ID.get(MOUNT_FISH)?.check?.({ kind: 'furniture', id: mount, itemUid: small.uid } as never, seen)
    === furnishSaid('notBigger', { what: `pike, ${fishKg('pike', 60).toFixed(2)} kg` }));
}

finish('furnishings');
