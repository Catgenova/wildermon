/**
 * The fittings (`fitting.ts`, `fittingdefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, with real
 * recipes (the trade, the tool, the time, the bill); the jobs and every
 * sentence. Then on the island, each piece built through its own recipe and
 * set down:
 *
 *   * a paper lantern pole: `POLE_LANTERNS` candles put in at once, burning
 *     `poleBurn` of its QL, lit off a flame and put out, lighting
 *     `POLE_REACH` tiles; its lanterns dyed a colour a dyeing, no more than it has;
 *   * a moss boulder: green over `BOULDER_MOSS_DAYS` by the moss rule,
 *     scrubbed back, and kept mossy by its owner so that a scrubbing worker
 *     passes it by;
 *   * a tree bench: on a grown tree's tile only, the tree not cut down under
 *     it, seating `TREE_BENCH_SEATS`;
 *   * a spice shelf: on a solid wall, herbs to `SHELF_HOLDS`, taken off a
 *     kind at a time, its owner's, not lifted with herbs on it;
 *   * a window seat: in a window, from inside only; seats `WINDOW_SEATS`;
 *   * a training dummy: a swing with a melee weapon only, timed, costed and
 *     slowed as a fight's, teaching the weapon's skill `PRACTICE_GAIN` of a
 *     fight's; an archery target the same with a bow, arrows stuck in it to
 *     `TARGET_HOLDS` and pulled, one in `ARROW_BREAK_IN` broken;
 *   * a mooring post: at the water's edge; a boat tied up only by whoever may
 *     move it; tied, nobody else takes her helm or lifts her; untied;
 *   * a stone bust: carved as a citizen of the settlement it stands on and no
 *     one else, with their look.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/fittings.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/fittings.mjs && node node_modules/.cache/fittings.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureDef } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  BOULDER_AGAIN, BOULDER_NOTHING_YET, CARVE_BUST, FITTING_DONE, FITTING_JOBS, FITTING_SAID, fittingDone, fittingSaid, KEEP_MOSS, MOOR_BOAT, pieceGreenDays, POLE_CANDLES,
  POLE_DOUSE, POLE_LIGHT, poleBurn, poleColours, PRACTISE, PULL_ARROWS, SHELF_HERBS, SHELF_PUT, SHELF_TAKE, SHOOT_TARGET, UNMOOR_BOAT, type FittingDone, type FittingSaid,
} from '../../src/game/fitting';
import {
  ARCHERY_TARGET, ARROW_BREAK_IN, BOULDER_MOSS_DAYS, LANTERN_POLE, MOORING_POST, MOSS_BOULDER, POLE_LANTERNS, POLE_REACH, PRACTICE_GAIN, practiceAs, SHELF_HOLDS,
  SPICE_SHELF, STONE_BUST, TARGET_HOLDS, TRAINING_DUMMY, TREE_BENCH, TREE_BENCH_SEATS, WINDOW_SEAT, WINDOW_SEATS,
} from '../../src/game/fittingdefs';
import { GARDEN_SAID, MOUNT_SAID } from '../../src/game/garden';
import { DYEABLE_ITEMS } from '../../src/game/dyes';
import { dyeText, pureDye, type DyeLiquid } from '../../src/game/dyestuffs';
import { GREEN_DAY, GREEN_DAYS } from '../../src/game/greening';
import { SHOT_ARCHERY, SWING_ARM } from '../../src/game/creatureActions';
import { STROKE_BY_ID } from '../../src/audio/strokes';
import { TileType, TREE_AGES } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const PIECES = [LANTERN_POLE, MOSS_BOULDER, TREE_BENCH, SPICE_SHELF, WINDOW_SEAT, TRAINING_DUMMY, ARCHERY_TARGET, MOORING_POST, STONE_BUST];
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
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(mount, '-'), coalesce(seats, 0), mossy::text) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.mount ?? '-', f?.seats ?? 0, !!f?.mossy].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{'), desc);
}
check('a pole by papyrusmaking with a shaft and its candles; a shelf by carpentry with clay jars; a post with a log and rope; a bust by stonecutting; a boulder by masonry',
  RECIPE_BY_ID.get(`make_${LANTERN_POLE}`)?.skill === 'papyrusmaking' && !!RECIPE_BY_ID.get(`make_${LANTERN_POLE}`)?.inputs.some((x) => x.item === 'candle' && x.count === POLE_LANTERNS)
  && !!RECIPE_BY_ID.get(`make_${LANTERN_POLE}`)?.inputs.some((x) => x.item === 'shaft')
  && RECIPE_BY_ID.get(`make_${SPICE_SHELF}`)?.skill === 'carpentry' && !!RECIPE_BY_ID.get(`make_${SPICE_SHELF}`)?.inputs.some((x) => x.item === 'clay_jar')
  && !!RECIPE_BY_ID.get(`make_${MOORING_POST}`)?.inputs.some((x) => x.item === 'log') && !!RECIPE_BY_ID.get(`make_${MOORING_POST}`)?.inputs.some((x) => x.item === 'rope')
  && RECIPE_BY_ID.get(`make_${STONE_BUST}`)?.skill === 'stonecutting' && RECIPE_BY_ID.get(`make_${MOSS_BOULDER}`)?.skill === 'masonry'
  && [TRAINING_DUMMY, ARCHERY_TARGET].every((id) => RECIPE_BY_ID.get(`make_${id}`)?.inputs.some((x) => x.item === 'thatch')));
check('a pole and a window seat take a dye, on the island too', DYEABLE_ITEMS.has(LANTERN_POLE) && DYEABLE_ITEMS.has(WINDOW_SEAT)
  && psql(`select count(*) from dyeable_item where id in ('${LANTERN_POLE}', '${WINDOW_SEAT}')`) === '2');
check(`a tree bench seats ${TREE_BENCH_SEATS}, a window seat ${WINDOW_SEATS}, on the island too`,
  psql(`select seats_of('${TREE_BENCH}') || '|' || seats_of('${WINDOW_SEAT}')`) === `${TREE_BENCH_SEATS}|${WINDOW_SEATS}`);
check('the herbs a shelf takes are what botanizing finds that is eaten, the same on the island', SHELF_HERBS.length >= 5
  && psql(`select array_to_string(shelf_herbs(), ',')`) === SHELF_HERBS.join(','));

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time || ':' || stamina, '|' order by id)
  from action_def where id = any (array[${FITTING_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...FITTING_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}:${a.stamina}`;
}).join('|');
check(`its ${FITTING_JOBS.length} jobs are the same rows on both sides`, jobsIsle === jobsHere, jobsIsle);
check('and every one of them is a fitting\'s job on the island', psql(`select bool_and(fitting_action(id)) from unnest(array[${FITTING_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
check('every timed job has a sound', FITTING_JOBS.every((id) => (ACTION_BY_ID.get(id)?.instant ?? false) || !!STROKE_BY_ID[id]),
  FITTING_JOBS.filter((id) => !ACTION_BY_ID.get(id)?.instant && !STROKE_BY_ID[id]).join(','));
check('a practice swing is timed as a fight\'s swing and a practice shot as a draw, on both sides',
  practiceAs(PRACTISE) === 'attack_creature' && practiceAs(SHOOT_TARGET) === 'shoot_creature'
  && psql(`select practice_as('${PRACTISE}') || '|' || practice_as('${SHOOT_TARGET}') || '|' || practice_as('dig')`) === 'attack_creature|shoot_creature|dig');
{
  const keys = Object.keys(FITTING_SAID) as FittingSaid[];
  const isle = psql(`select string_agg(fitting_said(k, 'spice shelf', 'Home'), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => fittingSaid(k, { name: 'spice shelf', what: 'Home' })).join('#'), isle);
  const done = Object.keys(FITTING_DONE) as FittingDone[];
  const dIsle = psql(`select string_agg(fitting_done(k, 'sage', 2, 5, 12), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => fittingDone(k, { what: 'sage', n: 2, held: 5, of: 12 })).join('#'), dIsle);
  const qls = [1, 30, 50, 99];
  check('a pole\'s candles burn as long on both sides', psql(`select string_agg(pole_burn(q)::text, ',' order by q) from unnest(array[${qls.join(',')}]::double precision[]) q`)
    === qls.map(poleBurn).join(','));
  const secs = [0, GREEN_DAY - 1, GREEN_DAY, 2.5 * GREEN_DAY, 4.99 * GREEN_DAY, 5 * GREEN_DAY, 30 * GREEN_DAY];
  const gIsle = psql(`select string_agg(piece_green_days('${MOSS_BOULDER}', now() - make_interval(secs => s)) || ':' || piece_green_days('statue', now() - make_interval(secs => s)), ',' order by o)
    from unnest(array[${secs.join(',')}]::double precision[]) with ordinality u(s, o)`);
  check(`a boulder greens over ${BOULDER_MOSS_DAYS} days by the moss rule, a statue over ${GREEN_DAYS}, the same on both sides`,
    gIsle === secs.map((s) => `${pieceGreenDays(MOSS_BOULDER, s)}:${pieceGreenDays('statue', s)}`).join(',')
    && pieceGreenDays(MOSS_BOULDER, BOULDER_MOSS_DAYS * GREEN_DAY) === GREEN_DAYS && pieceGreenDays('statue', BOULDER_MOSS_DAYS * GREEN_DAY) === BOULDER_MOSS_DAYS, gIsle);
  check('and says so', psql('select boulder_again() || \'|\' || boulder_nothing_yet()') === `${BOULDER_AGAIN}|${BOULDER_NOTHING_YET}`);
}

/* ---- 2. on the island ---------------------------------------------------------------------------- */

const MIRA = 'f1771a00-0000-4000-8000-0000000000f1';
const OTTO = 'f1771a00-0000-4000-8000-0000000000f2';
const T = (id: string, more = ''): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${more})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 0, sy = 0): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string, who = 'u'): string => `perform act_perform(w, ${who}, '${action}', ${target});`;
const build = (id: string): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const gives = (r?.inputs ?? []).map((i) => `perform give(w, u, '${i.item}', ${i.count}, 40${['plank', 'shaft', 'timber', 'log'].includes(i.item) ? ", 'Oak'" : ''});`).join('\n  ');
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1)));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;`;
};
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now(), level = 0 where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${ask(`${key}:ask`, 'place_furniture', target)}
  ${act('place_furniture', target)}
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;
const piece = (key: string, id: string, x: number, y: number, facing = 's', sx = 0, sy = 0): string => `${at(x, y)}
  ${build(id)}
  ${place(key, TILE('v_it', x, y, facing, sx, sy))}`;
const bucket = (l: DyeLiquid): string => `v_b := give(w, u, 'dye_bucket', 1, 50); update item set dye = ${sq(dyeText(l, 10))} where id = v_b;`;
const RED = pureDye('red', 50), BLUE = pureDye('blue', 50), YELLOW = pureDye('yellow', 50);
const MATURE = TREE_AGES.find((a) => a.name === 'Mature')?.id ?? 1;
const YOUNG = TREE_AGES.find((a) => a.name === 'Young')?.id ?? 0;
const LOOK = { gender: 'woman', hair: 'bald', skin: 0.3, hairColour: 0.7, hairBright: 0.4 };

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table raised (skill text, base double precision);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wildermon.dice'), ',');
        n int := coalesce(nullif(current_setting('wildermon.dice_n', true), ''), '0')::int;
begin
  perform set_config('wildermon.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
-- What a go raised, and by how much a base, rather than the roll it then makes.
create function dice.skill_raise(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision language plpgsql as $f$
begin
  insert into raised values (p_id, p_base);
  return 0;
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
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_a bigint; v_b bigint; v_g jsonb;
        v_pole bigint; v_boulder bigint; v_bench bigint; v_shelf bigint; v_seat bigint; v_dummy bigint; v_target bigint; v_post bigint; v_bust bigint; v_boat bigint;
        v_statue bigint; v_far bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Brightwater', 173, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  update player set look = '${JSON.stringify(LOOK)}'::jsonb where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) select w, x.uid, s.id, 60 from (values (u), (o)) x(uid),
    unnest(array['papyrusmaking', 'carpentry', 'masonry', 'stonecutting', 'alchemy', 'swords', 'archery', 'fighting']) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  -- Mira's settlement over the yard; a house with a window at x 10 and a solid wall at 11 on its north side; water to the east.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 12, 8, 1, u);
  perform deed_ranks_seed(w, u);
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 92, 'Cottage', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 92, 10, 12), (w, 92, 11, 12);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 0, 'h', 10, 12, 92, 'window', 'plank', '{"plank":0}', '{"plank":18}', u),
    (w, 0, 'h', 11, 12, 92, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u);
  for v_a in 40..44 loop for v_b in 30..34 loop perform land_set_height(w, v_a::int, v_b::int, -30); end loop; end loop;

  -- 1. A paper lantern pole: candles, a flame, light; its lanterns dyed one a dyeing.
  ${at(4, 4)}
  ${build(LANTERN_POLE)}
  ${bucket(RED)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  delete from item where world_id = w and holder_uid = u and def = 'dye_bucket';
  ${bucket(BLUE)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  delete from item where world_id = w and holder_uid = u and def = 'dye_bucket';
  ${bucket(YELLOW)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  ${ask('POLE:fourth', 'dye_item', "jsonb_build_object('kind', 'item', 'uid', v_it)")}
  ${place('POLE', TILE('v_it', 4, 4, 's'))}
  v_pole := v_pl;
  insert into said select 'POLE:colours', coalesce(pl.dye, '-') || '|' || coalesce((pl.garden->'tints')::text, '-') from placed pl where pl.id = v_pole;
  ${ask('POLE:nocandles', POLE_CANDLES, T('v_pole'))}
  perform give(w, u, 'candle', ${POLE_LANTERNS}, 40);
  ${act(POLE_CANDLES, T('v_pole'))}
  insert into said select 'POLE:candles', ${lastSaid()} || '|' || pl.fuel::text || '|' || pl.ql::text || '|' || ${count('candle')}::text from placed pl where pl.id = v_pole;
  perform give(w, u, 'candle', ${POLE_LANTERNS}, 40);
  ${ask('POLE:still', POLE_CANDLES, T('v_pole'))}
  ${ask('POLE:noflame', POLE_LIGHT, T('v_pole'))}
  ${ask('POLE:notlit', POLE_DOUSE, T('v_pole'))}
  v_a := give(w, u, 'lantern', 1, 50);
  update item set lit = true, charges = 600 where id = v_a;
  ${act(POLE_LIGHT, T('v_pole'))}
  insert into said select 'POLE:lit', ${lastSaid()} || '|' || placed_lit(pl)::text from placed pl where pl.id = v_pole;
  ${ask('POLE:already', POLE_LIGHT, T('v_pole'))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_POLE', v_g::text);
  insert into said values ('POLE:id', v_pole::text);
  ${ask('POLE:lift', 'pick_up_furniture', T('v_pole'))}
  ${act(POLE_DOUSE, T('v_pole'))}
  insert into said select 'POLE:out', placed_lit(pl)::text from placed pl where pl.id = v_pole;

  -- 2. A moss boulder and a statue's moss beside it; its owner keeps the moss, a worker's scrub passes it by.
  ${piece('BOULDER', MOSS_BOULDER, 14, 14)}
  v_boulder := v_pl;
  perform give(w, u, 'brush', 1, 50);
  ${ask('BOULDER:bare', 'scrub_moss', T('v_boulder'))}
  update world set green_from = now() - interval '30 days' where id = w;
  update placed set made_at = now() - interval '${BOULDER_MOSS_DAYS} days' where id = v_boulder;
  insert into said values ('BOULDER:green', green_on_tile(w, u, 14, 14)::text);
  update player set x = 14.5, y = 14.5 where world_id = w and uid = o;
  ${ask('BOULDER:otto', KEEP_MOSS, T('v_boulder'), 'o')}
  ${act(KEEP_MOSS, T('v_boulder'))}
  insert into said values ('BOULDER:kept', ${lastSaid()} || '|' || green_on_tile(w, u, 14, 14)::text);
  perform scrub_tile(w, u, 14, 14);
  ${act(KEEP_MOSS, T('v_boulder'))}
  insert into said values ('BOULDER:unkept', ${lastSaid()} || '|' || green_on_tile(w, u, 14, 14)::text);
  ${act('scrub_moss', T('v_boulder'))}
  insert into said values ('BOULDER:scrubbed', ${lastSaid()} || '|' || green_on_tile(w, u, 14, 14)::text);

  -- 3. A tree bench: on grass refused, on a young tree refused, round a mature one; the tree not felled under it; six seats.
  ${at(16, 6)}
  ${build(TREE_BENCH)}
  ${ask('BENCH:grass', 'place_furniture', TILE('v_it', 16, 6, 's'))}
  perform land_set_tile(w, 16, 6, tile_id('Tree'));
  perform land_set_data(w, 16, 6, ${YOUNG} << 4);
  ${ask('BENCH:young', 'place_furniture', TILE('v_it', 16, 6, 's'))}
  perform land_set_data(w, 16, 6, ${MATURE} << 4);
  ${place('BENCH', TILE('v_it', 16, 6, 's'))}
  v_bench := v_pl;
  perform give(w, u, 'hatchet', 1, 50);
  ${ask('BENCH:fell', 'cut_down', "jsonb_build_object('kind', 'tile', 'x', 16, 'y', 6)")}
  ${ask('BENCH:sit', 'sit_seat', T('v_bench'))}

  -- 4. A spice shelf on the solid wall, inside: herbs to its room, a kind taken off, not lifted with herbs on it, not Otto's.
  ${at(11, 12)}
  ${build(SPICE_SHELF)}
  ${place('SHELF', TILE('v_it', 11, 12, 'n'))}
  v_shelf := v_pl;
  delete from item where world_id = w and holder_uid = u and def = any (shelf_herbs());
  ${ask('SHELF:none', SHELF_PUT, T('v_shelf'))}
  v_a := give(w, u, '${SHELF_HERBS[0]}', ${SHELF_HOLDS - 2}, 30);
  v_b := give(w, u, '${SHELF_HERBS[1]}', 5, 30);
  v_far := give(w, u, 'plank', 1, 30, 'Oak');
  ${ask('SHELF:plank', SHELF_PUT, T('v_shelf', ", 'itemUid', v_far"))}
  ${act(SHELF_PUT, T('v_shelf', ", 'itemUid', v_a"))}
  ${act(SHELF_PUT, T('v_shelf', ", 'itemUid', v_b"))}
  insert into said values ('SHELF:put', ${lastSaid()} || '|' || ${count(SHELF_HERBS[1])}::text);
  ${ask('SHELF:full', SHELF_PUT, T('v_shelf', ", 'itemUid', v_b"))}
  insert into said select 'SHELF:jars', (pl.garden->'jars')::text from placed pl where pl.id = v_shelf;
  ${ask('SHELF:lift', 'pick_up_furniture', T('v_shelf'))}
  update player set x = 11.5, y = 12.5 where world_id = w and uid = o;
  ${ask('SHELF:otto', SHELF_TAKE(SHELF_HERBS[0]), T('v_shelf'), 'o')}
  ${ask('SHELF:nojar', SHELF_TAKE(SHELF_HERBS[2]), T('v_shelf'))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_SHELF', v_g::text);
  insert into said values ('SHELF:id', v_shelf::text);
  ${act(SHELF_TAKE(SHELF_HERBS[0]), T('v_shelf'))}
  insert into said values ('SHELF:took', ${lastSaid()} || '|' || ${count(SHELF_HERBS[0])}::text || '|' || coalesce((select (pl.garden->'jars')::text from placed pl where pl.id = v_shelf), '-'));

  -- 5. A window seat: not outside, not on the solid wall, in the window from inside.
  ${at(10, 12)}
  ${build(WINDOW_SEAT)}
  ${ask('SEAT:outside', 'place_furniture', TILE('v_it', 10, 11, 's'))}
  ${ask('SEAT:wall', 'place_furniture', TILE('v_it', 11, 12, 'n', 0, 1))}
  ${place('SEAT', TILE('v_it', 10, 12, 'n'))}
  v_seat := v_pl;
  ${ask('SEAT:sit', 'sit_seat', T('v_seat'))}

  -- 6. A training dummy: a melee weapon only; a swing timed and costed as a fight's; half a fight's gain to the weapon's skill.
  ${piece('DUMMY', TRAINING_DUMMY, 20, 20)}
  v_dummy := v_pl;
  ${ask('DUMMY:noweapon', PRACTISE, T('v_dummy'))}
  v_a := give(w, u, 'short_bow', 1, 50);
  update player set equipped = jsonb_build_object('weapon', v_a) where world_id = w and uid = u;
  ${ask('DUMMY:bow', PRACTISE, T('v_dummy'))}
  v_a := give(w, u, 'sword', 1, 50, 'Iron');
  update player set equipped = jsonb_build_object('weapon', v_a) where world_id = w and uid = u;
  ${ask('DUMMY:sword', PRACTISE, T('v_dummy'))}
  insert into said values ('DUMMY:base', act_base(w, u, '${PRACTISE}', 2.5)::text || '|' || act_base(w, u, 'attack_creature', 2.5)::text);
  insert into said values ('DUMMY:wind', act_wind(w, u, '${PRACTISE}', 0.07)::text || '|' || act_wind(w, u, 'attack_creature', 0.07)::text);
  insert into said values ('DUMMY:secs', go_secs('${PRACTISE}', 2.4, 60, 0, 1, 1.1)::text || '|' || go_secs('attack_creature', 2.4, 60, 0, 1, 1.1)::text
    || '|' || swing_burden(w, u, '${PRACTISE}')::text || '|' || swing_burden(w, u, 'attack_creature')::text);
  delete from raised;
  perform pg_temp.dice('0.5');
  ${act(PRACTISE, T('v_dummy'))}
  perform pg_temp.nodice();
  insert into said select 'DUMMY:raised', coalesce(string_agg(skill || ':' || base::text, ','), '-') from raised;
  insert into said values ('DUMMY:said', ${lastSaid()});

  -- 7. An archery target: a bow and arrows, in range; shot to its room; arrows pulled, one in four broken.
  ${piece('TARGET', ARCHERY_TARGET, 24, 20)}
  v_target := v_pl;
  ${ask('TARGET:nobow', SHOOT_TARGET, T('v_target'))}
  v_a := give(w, u, 'short_bow', 1, 50);
  update player set equipped = jsonb_build_object('weapon', v_a) where world_id = w and uid = u;
  ${ask('TARGET:noarrows', SHOOT_TARGET, T('v_target'))}
  perform give(w, u, 'arrow', 10, 40);
  ${at(24, 50)}
  ${ask('TARGET:far', SHOOT_TARGET, T('v_target'))}
  ${at(24, 23)}
  insert into said values ('TARGET:base', act_base(w, u, '${SHOOT_TARGET}', 2.6)::text || '|' || act_base(w, u, 'shoot_creature', 2.6)::text
    || '|' || act_wind(w, u, '${SHOOT_TARGET}', 0.05)::text || '|' || act_wind(w, u, 'shoot_creature', 0.05)::text);
  delete from raised;
  perform pg_temp.dice('0.5');
  ${act(SHOOT_TARGET, T('v_target'))}
  ${act(SHOOT_TARGET, T('v_target'))}
  ${act(SHOOT_TARGET, T('v_target'))}
  ${act(SHOOT_TARGET, T('v_target'))}
  perform pg_temp.nodice();
  insert into said select 'TARGET:raised', coalesce(string_agg(skill || ':' || base::text, ','), '-') from raised;
  insert into said select 'TARGET:shot', ${lastSaid()} || '|' || ${count('arrow')}::text || '|' || (pl.garden->>'stuck') from placed pl where pl.id = v_target;
  ${at(24, 21)}
  ${ask('TARGET:lift', 'pick_up_furniture', T('v_target'))}
  insert into item (world_id, holder, placed, def, ql, count) select w, 'stand', v_target, 'arrow', 40, 1 from generate_series(1, ${TARGET_HOLDS - 4});
  ${ask('TARGET:full', SHOOT_TARGET, T('v_target'))}
  delete from item where holder = 'stand' and placed = v_target and id not in (select id from item where holder = 'stand' and placed = v_target order by id limit 4);
  ${at(24, 21)}
  perform pg_temp.dice('0.1,0.9,0.9,0.9');
  ${act(PULL_ARROWS, T('v_target'))}
  perform pg_temp.nodice();
  insert into said select 'TARGET:pulled', ${lastSaid()} || '|' || ${count('arrow')}::text || '|' || coalesce(pl.garden::text, '-') from placed pl where pl.id = v_target;
  ${ask('TARGET:empty', PULL_ARROWS, T('v_target'))}

  -- 8. A mooring post: inland refused, at the water's edge; Mira's boat beside it; tied, Otto takes no helm and lifts nothing; untied.
  ${at(30, 30)}
  ${build(MOORING_POST)}
  ${ask('POST:inland', 'place_furniture', TILE('v_it', 30, 30, 's'))}
  ${at(39, 31)}
  ${place('POST', TILE('v_it', 39, 31, 's'))}
  v_post := v_pl;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, made_by) values (w, 'furniture', 'rowing_boat', 40, 31, 40.5, 31.5, 50, u) returning id into v_boat;
  ${ask('POST:none', UNMOOR_BOAT, T('v_post'))}
  update player set x = 39.5, y = 31.5 where world_id = w and uid = o;
  ${ask('POST:otto', MOOR_BOAT, T('v_post'), 'o')}
  ${ask('POST:free', 'board_vehicle', T('v_boat'), 'o')}
  ${act(MOOR_BOAT, T('v_post'))}
  insert into said select 'POST:tied', ${lastSaid()} || '|' || (pl.garden->>'tied' = v_boat::text)::text from placed pl where pl.id = v_post;
  ${ask('POST:again', MOOR_BOAT, T('v_post'))}
  ${ask('POST:helm', 'board_vehicle', T('v_boat'), 'o')}
  ${ask('POST:lift', 'pick_up_furniture', T('v_boat'), 'o')}
  ${ask('POST:mine', 'board_vehicle', T('v_boat'))}
  ${ask('POST:untie_otto', UNMOOR_BOAT, T('v_post'), 'o')}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_POST', v_g::text);
  insert into said values ('POST:ids', v_post::text || ',' || v_boat::text);
  -- Rowed off out of reach, the tie holds nothing.
  update placed set x = 43, cx = 43.5 where id = v_boat;
  ${ask('POST:away', 'board_vehicle', T('v_boat'), 'o')}
  update placed set x = 40, cx = 40.5 where id = v_boat;
  ${act(UNMOOR_BOAT, T('v_post'))}
  insert into said select 'POST:untied', ${lastSaid()} || '|' || coalesce(pl.garden::text, '-') from placed pl where pl.id = v_post;
  ${ask('POST:helm2', 'board_vehicle', T('v_boat'), 'o')}

  -- 9. A stone bust on Mira's settlement: carved as Mira, with her look; not as Otto until he is a citizen; off a settlement, nobody.
  ${piece('BUST', STONE_BUST, 13, 9)}
  v_bust := v_pl;
  ${ask('BUST:nobody', CARVE_BUST, T('v_bust'))}
  ${ask('BUST:otto', CARVE_BUST, T('v_bust', `, 'who', '${OTTO}'`))}
  update player set x = 13.5, y = 9.5 where world_id = w and uid = o;
  ${ask('BUST:byotto', CARVE_BUST, T('v_bust', `, 'who', '${MIRA}'`), 'o')}
  ${act(CARVE_BUST, T('v_bust', `, 'who', '${MIRA}'`))}
  insert into said select 'BUST:carved', ${lastSaid()} || '|' || (pl.garden->'bust'->>'name') || '|' || (pl.garden->'bust'->'look'->>'gender') from placed pl where pl.id = v_bust;
  ${ask('BUST:same', CARVE_BUST, T('v_bust', `, 'who', '${MIRA}'`))}
  insert into deed_member (world_id, founder, uid, role, rank_id)
    values (w, u, o, 'citizen', (select id from deed_rank_def where world_id = w and founder = u order by id desc limit 1));
  ${ask('BUST:citizen', CARVE_BUST, T('v_bust', `, 'who', '${OTTO}'`))}
  v_g := rpc_ground(w, 40, true);
  insert into said values ('GROUND_BUST', v_g::text);
  insert into said values ('BUST:id', v_bust::text);
  ${piece('BUST2', STONE_BUST, 50, 50)}
  ${ask('BUST:nodeed', CARVE_BUST, T('v_pl', `, 'who', '${MIRA}'`))}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

for (const k of ['POLE', 'BOULDER', 'BENCH', 'SHELF', 'SEAT', 'DUMMY', 'TARGET', 'POST', 'BUST', 'BUST2']) is(`${k}:ask`, 'none', `${k}: built and set down`);
/* 1. */
is('POLE:fourth', FITTING_SAID.poleColours, `a pole's lanterns take ${POLE_LANTERNS} colours and no more`);
check('and stand dyed, each lantern its own', /^#[0-9a-f]{6}\|\["#[0-9a-f]{6}", "#[0-9a-f]{6}"\]$/.test(said('POLE:colours')), said('POLE:colours'));
is('POLE:nocandles', FITTING_SAID.noCandles, `candles go in ${POLE_LANTERNS} at once`);
{
  const [line, fuel, ql, left] = said('POLE:candles').split('|');
  check(`put in, ${POLE_LANTERNS} spent, burning a candle's time in a lantern of its QL`, Number(fuel) === poleBurn(Number(ql)) && left === '0'
    && line === fittingDone('candles', { what: psql(`select time_words(${poleBurn(Number(ql))})`) }), said('POLE:candles'));
}
is('POLE:still', FITTING_SAID.candlesIn, 'and no more while they last');
check('lit off a flame and none without', said('POLE:noflame') !== 'none' && said('POLE:noflame') === psql('select no_flame_said()'), said('POLE:noflame'));
is('POLE:notlit', FITTING_SAID.notLit, 'not put out before it is lit');
check('lit from the lantern in hand', said('POLE:lit') === `${fittingDone('lit', { what: 'lantern' })}|true`, said('POLE:lit'));
is('POLE:already', FITTING_SAID.lit, 'and not twice');
is('POLE:lift', 'Put it out first.', 'not lifted alight');
is('POLE:out', 'false', 'put out');
/* 2. */
is('BOULDER:bare', BOULDER_NOTHING_YET, 'a bare boulder has nothing to scrub, in its own days');
is('BOULDER:green', String(GREEN_DAYS), `${BOULDER_MOSS_DAYS} days on, a boulder is as green as the moss rule goes`);
is('BOULDER:otto', FITTING_SAID.keepNotYours, 'only whoever set it down keeps its moss');
is('BOULDER:kept', `${fittingDone('keep')}|0`, 'kept, a scrubbing worker passes it by');
is('BOULDER:unkept', `${fittingDone('unkeep')}|${GREEN_DAYS}`, 'and it was not scrubbed; let go, a worker would');
is('BOULDER:scrubbed', `Moss scrubbed: the moss boulder. ${BOULDER_AGAIN}|0`, 'scrubbed back by hand, in its own days');
/* 3. */
is('BENCH:grass', FITTING_SAID.noTree, 'a tree bench not on grass');
is('BENCH:young', FITTING_SAID.noTree, 'nor round a young tree');
is('BENCH:fell', FITTING_SAID.benchRound, 'and the tree under it not cut down');
is('BENCH:sit', 'none', `sat on, ${TREE_BENCH_SEATS} seats`);
/* 4. */
is('SHELF:none', FITTING_SAID.noHerb, 'a shelf with no herb in the pack');
is('SHELF:plank', FITTING_SAID.notHerb, 'herbs only');
check(`herbs to its room, ${SHELF_HOLDS}, the rest left`, said('SHELF:put') === `${fittingDone('shelfPut', { what: SHELF_HERBS[1], n: 2, held: SHELF_HOLDS, of: SHELF_HOLDS })}|3`, said('SHELF:put'));
is('SHELF:full', FITTING_SAID.shelfFull, 'then full');
is('SHELF:jars', `[["${SHELF_HERBS[0]}", ${SHELF_HOLDS - 2}], ["${SHELF_HERBS[1]}", 2]]`, 'jars told as drawn');
is('SHELF:lift', GARDEN_SAID.showing, 'not lifted with herbs on it');
is('SHELF:otto', fittingSaid('notYours', { name: 'spice shelf' }), 'not somebody else\'s');
is('SHELF:nojar', FITTING_SAID.noJar, 'and no herb taken that is not there');
is('SHELF:took', `${fittingDone('shelfTake', { what: SHELF_HERBS[0], n: SHELF_HOLDS - 2 })}|${SHELF_HOLDS - 2}|[["${SHELF_HERBS[1]}", 2]]`, 'a kind taken off, back to the pack');
/* 5. */
is('SEAT:outside', MOUNT_SAID.outside, 'a window seat not outside a building');
is('SEAT:wall', MOUNT_SAID.noWindow, 'nor on a solid wall');
is('SEAT:sit', 'none', `sat in, ${WINDOW_SEATS} seats`);
/* 6. */
is('DUMMY:noweapon', FITTING_SAID.noWeapon, 'a dummy with nothing in hand');
is('DUMMY:bow', FITTING_SAID.noWeapon, 'nor a bow');
is('DUMMY:sword', 'none', 'a sword');
{
  const [a, b] = said('DUMMY:base').split('|').map(Number);
  const [c, d] = said('DUMMY:wind').split('|').map(Number);
  const [e, f, g2, h] = said('DUMMY:secs').split('|').map(Number);
  check('a practice swing takes a fight\'s swing, costs its stamina and is slowed as one', a === b && c === d && e === f && g2 === h && a > 0 && c > 0,
    `${said('DUMMY:base')} ${said('DUMMY:wind')} ${said('DUMMY:secs')}`);
}
is('DUMMY:raised', `swords:${SWING_ARM * PRACTICE_GAIN}`, `and teaches the sword's skill alone, ×${PRACTICE_GAIN} a landed blow's`);
is('DUMMY:said', fittingDone('practised', { what: 'sword' }), 'said');
/* 7. */
is('TARGET:nobow', FITTING_SAID.noBow, 'a target with no bow in hand');
is('TARGET:noarrows', FITTING_SAID.noArrows, 'nor without arrows');
is('TARGET:far', FITTING_SAID.outOfRange, 'nor out of the bow\'s range');
{
  const [a, b, c, d] = said('TARGET:base').split('|').map(Number);
  check('a practice shot takes a fight\'s draw and costs its stamina', a === b && c === d && a > 0, said('TARGET:base'));
}
is('TARGET:raised', Array(4).fill(`archery:${SHOT_ARCHERY * PRACTICE_GAIN}`).join(','), `each shot teaches archery ×${PRACTICE_GAIN} a landed shot's`);
is('TARGET:shot', `${fittingDone('shot', { what: 'arrows', held: 4, of: TARGET_HOLDS })}|6|4`, 'an arrow a shot, stuck in it');
is('TARGET:lift', GARDEN_SAID.showing, 'not lifted with arrows in it');
is('TARGET:full', FITTING_SAID.targetFull, `no more than ${TARGET_HOLDS}`);
is('TARGET:pulled', `${fittingDone('pulled', { n: 3, held: 1 })}|9|-`, `pulled: one in ${ARROW_BREAK_IN} broken, the rest back`);
is('TARGET:empty', FITTING_SAID.noStuck, 'and none left in it');
/* 8. */
is('POST:inland', FITTING_SAID.notShore, 'a mooring post not inland');
is('POST:none', FITTING_SAID.noTied, 'nothing to untie');
is('POST:otto', fittingSaid('boatNotYours', { what: 'rowing boat' }), 'a boat tied up by whoever may move it, not anybody');
check('untied, the boat rules alone: anybody may have her helm', said('POST:free') !== FITTING_SAID.moored, said('POST:free'));
is('POST:tied', `${fittingDone('tied', { what: 'rowing boat' })}|true`, 'tied by her owner');
is('POST:again', FITTING_SAID.hasBoat, 'one boat to a post');
is('POST:helm', FITTING_SAID.moored, 'tied, nobody else takes her helm');
is('POST:lift', FITTING_SAID.moored, 'or lifts her');
check('her owner still may', said('POST:mine') !== FITTING_SAID.moored, said('POST:mine'));
is('POST:untie_otto', fittingSaid('boatNotYours', { what: 'rowing boat' }), 'and nobody else unties her');
check('rowed out of reach, the tie holds nothing', said('POST:away') !== FITTING_SAID.moored, said('POST:away'));
is('POST:untied', `${fittingDone('untied', { what: 'rowing boat' })}|-`, 'untied');
check('and then the boat rules alone again', said('POST:helm2') !== FITTING_SAID.moored, said('POST:helm2'));
/* 9. */
is('BUST:nobody', FITTING_SAID.pickCitizen, 'a bust is carved as somebody');
is('BUST:otto', fittingSaid('notCitizen', { what: 'Home' }), 'as a citizen of its settlement only');
is('BUST:byotto', FITTING_SAID.bustNotYours, 'by whoever set it down or a citizen');
is('BUST:carved', `${fittingDone('carved', { what: 'Mira' })}|Mira|${LOOK.gender}`, 'carved, with their look');
is('BUST:same', fittingSaid('sameCitizen', { what: 'Mira' }), 'and not as the same again');
is('BUST:citizen', 'none', 'a citizen once on the roll');
is('BUST:nodeed', FITTING_SAID.noDeed, 'and off a settlement, nobody');

/* ---- 3. what every browser reads, and says the same of ------------------------------------------------- */

const looker = (ground: string): Game => {
  const g = Game.create(173, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(JSON.parse(ground) as IslandGround);
  return g;
};
{
  const seen = looker(said('GROUND_POLE'));
  const f = seen.furniture.get(Number(said('POLE:id')));
  check('the browser reads a pole\'s three colours', !!f && poleColours({ dye: f.dye, fitting: f.fitting }).length === POLE_LANTERNS, JSON.stringify(f?.fitting));
  seen.islandClock = () => 0;
  check(`and lights ${POLE_REACH} tiles while it burns`, !!f?.lit && seen.lights().some((s) => s.radius === POLE_REACH));
  seen.putBody(4.5, 4.5, 0);
  check('and refuses more candles in the island\'s words', ACTION_BY_ID.get(POLE_CANDLES)?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === FITTING_SAID.candlesIn);
}
{
  const seen = looker(said('GROUND_SHELF'));
  const f = seen.furniture.get(Number(said('SHELF:id')));
  check('the browser reads a shelf\'s jars', JSON.stringify(f?.fitting?.jars) === JSON.stringify([[SHELF_HERBS[0], SHELF_HOLDS - 2], [SHELF_HERBS[1], 2]]), JSON.stringify(f?.fitting));
  seen.putBody(11.5, 12.5, 0);
  seen.inventory.items.length = 0;
  const herb = seen.inventory.add(SHELF_HERBS[2], { ql: 30 });
  check('and refuses more in the island\'s words', ACTION_BY_ID.get(SHELF_PUT)?.check?.({ kind: 'furniture', id: f?.id, itemUid: herb.uid } as never, seen) === FITTING_SAID.shelfFull);
  check('and offers each kind on it to take', ACTION_BY_ID.get(SHELF_TAKE(SHELF_HERBS[0]))?.labelFor?.({ kind: 'furniture', id: f?.id } as never, seen) === `Take ${SHELF_HERBS[0]} ×${SHELF_HOLDS - 2}`);
}
{
  const seen = looker(said('GROUND_POST'));
  const [post, boat] = said('POST:ids').split(',').map(Number);
  const b = seen.furniture.get(boat);
  check('the browser reads the boat a post holds', seen.furniture.get(post)?.fitting?.tied === boat);
  check('and, her owner, takes her helm past the tie', !!b && ACTION_BY_ID.get('board_vehicle')?.check?.({ kind: 'furniture', id: boat } as never, seen) !== FITTING_SAID.moored);
  if (b) b.mine = false;
  seen.putBody(39.5, 31.5, 0);
  check('and, not her owner, is refused her helm in the island\'s words', ACTION_BY_ID.get('board_vehicle')?.check?.({ kind: 'furniture', id: boat } as never, seen) === FITTING_SAID.moored);
}
{
  const seen = looker(said('GROUND_BUST'));
  const f = seen.furniture.get(Number(said('BUST:id')));
  check('the browser reads who a bust is, and their look', f?.fitting?.bust?.name === 'Mira' && f.fitting.bust.look.gender === LOOK.gender, JSON.stringify(f?.fitting));
  seen.putBody(13.5, 9.5, 0);
  const why = ACTION_BY_ID.get(CARVE_BUST)?.check?.({ kind: 'furniture', id: f?.id, who: MIRA } as never, seen);
  check('and refuses the same again in the island\'s words', why === fittingSaid('sameCitizen', { what: 'Mira' }), String(why));
}
{
  // A tree bench where the browser places it.
  const g = Game.create(173, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.putBody(6.5, 6.5, 0);
  check('the browser refuses a tree bench on grass in the island\'s words', g.furniturePlaceReason(TREE_BENCH, 6, 6, 0, 0, 's') === FITTING_SAID.noTree);
  g.world.setTile(6, 6, TileType.Tree, (MATURE << 4));
  check('and sets one round a mature tree', g.furniturePlaceReason(TREE_BENCH, 6, 6, 0, 0, 's') === null, String(g.furniturePlaceReason(TREE_BENCH, 6, 6, 0, 0, 's')));
  check('and refuses a mooring post inland', g.furniturePlaceReason(MOORING_POST, 6, 8, 0, 0, 's') === FITTING_SAID.notShore);
}
check(`a boulder's moss shows full after ${BOULDER_MOSS_DAYS} days in the browser`, pieceGreenDays(MOSS_BOULDER, BOULDER_MOSS_DAYS * GREEN_DAY) === GREEN_DAYS
  && furnitureDef(MOSS_BOULDER).mossy === true);

finish('fittings');
