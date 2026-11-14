/**
 * The home pieces (`decor.ts`, `decordefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, with real
 * recipes (the trade, the tool, the station, the time, the bill); the jobs and
 * every sentence. Then on the island, each piece built through its own recipe
 * and set down:
 *
 *   * a sundial: Examine says the island's clock and the days left in the
 *     season, what the browser says off the same clock;
 *   * a compost bin: spoiled food, weeds and ash only, a stack up to its
 *     room, refused full; not emptied before `COMPOST_DAYS`, then one compost
 *     per `COMPOST_PER` things; and compost spread on a field and a planter
 *     lifts the next harvest `COMPOST_BOOST` QL, once, read by every browser;
 *   * a stone lantern: stone that greens with moss, in what a scurra scrubs,
 *     lighting `STONE_LANTERN_REACH` tiles at night;
 *   * a woven rug: woven at a loom in the pattern chosen, dyed a colour a
 *     dyeing up to `RUG_COLOURS` and not its last twice, the colours set down
 *     with it and scrubbed off together;
 *   * curtains: on either face of a finished window only, over its middle;
 *     drawn and opened for everybody;
 *   * an armour stand: a carried or worn piece put on a free slot, armour
 *     only; taken off a slot; swapped with what is worn, slot by slot, what
 *     does not fit kept on in the browser's words; not picked up with armour
 *     on it; changed only by whoever set it down or a rank that may use the
 *     crates on its settlement; and what it holds drawn by every browser.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/decor.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/decor.mjs && node node_modules/.cache/decor.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureAnchor } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  compostOf, DECOR_DONE, DECOR_JOBS, DECOR_SAID, decorDone, decorSaid, DRAW_CURTAINS, EMPTY_COMPOST, FILL_COMPOST, KEPT_WHY, READ_SUNDIAL, SPREAD_COMPOST,
  STAND_PUT, STAND_SLOTS, STAND_SWAP, STAND_TAKE, stoneLanternLight, sundialSays, swapPlan, swapSaid, type DecorSaid,
} from '../../src/game/decor';
import {
  ARMOUR_STAND, COMPOST_BIN, COMPOST_BOOST, COMPOST_DAYS, COMPOST_HOLDS, COMPOST_PER, CURTAINS, RUG_COLOURS, RUG_PATTERNS, STONE_LANTERN, STONE_LANTERN_REACH,
  SUNDIAL, WOVEN_RUG,
} from '../../src/game/decordefs';
import { GARDEN_SAID, MOUNT_SAID } from '../../src/game/garden';
import { DYEABLE_ITEMS, dyedAlready, SCRUB_TOOL } from '../../src/game/dyes';
import { dyeHex, dyeText, pureDye, type DyeLiquid } from '../../src/game/dyestuffs';
import { lacksSaid } from '../../src/game/ranks';
import { ARMOUR_SLOTS } from '../../src/game/gear';
import { STROKE_BY_ID } from '../../src/audio/strokes';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

const PIECES = [SUNDIAL, COMPOST_BIN, STONE_LANTERN, WOVEN_RUG, CURTAINS, ARMOUR_STAND];
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- 1. the pieces, their recipes, their items and their jobs, the same on both sides ---------------- */

check(`${PIECES.length} pieces, each a piece and an item`, PIECES.every((id) => FURNITURE_BY_ID.has(id) && !!ITEM_DEFS[id]));
for (const id of PIECES) {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const here = r ? `${r.skill}|${r.tool}|${r.station ?? '-'}|${r.baseTime}|${r.difficulty}|${r.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : 'none';
  const isle = psql(`select r.skill || '|' || r.tool || '|' || coalesce(r.station, '-') || '|' || r.base_time || '|' || r.difficulty || '|'
    || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
    from recipe r where r.id = 'make_${id}'`);
  check(`${id}: a recipe with its trade, tool, station, time and bill, the same on both sides (${here})`, isle === here && !!r, isle);
  const f = FURNITURE_BY_ID.get(id);
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(mount, '-'), mossy::text) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.mount ?? '-', !!f?.mossy].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{'), desc);
}
check('a sundial is masonry of stone and brass; a stone lantern masonry of stone; a compost bin and an armour stand carpentry, a stand with a post',
  RECIPE_BY_ID.get(`make_${SUNDIAL}`)?.skill === 'masonry' && ['stone_slab', 'brass_lump'].every((i) => !!RECIPE_BY_ID.get(`make_${SUNDIAL}`)?.inputs.some((x) => x.item === i))
  && RECIPE_BY_ID.get(`make_${STONE_LANTERN}`)?.skill === 'masonry' && RECIPE_BY_ID.get(`make_${COMPOST_BIN}`)?.skill === 'carpentry'
  && RECIPE_BY_ID.get(`make_${ARMOUR_STAND}`)?.skill === 'carpentry' && !!RECIPE_BY_ID.get(`make_${ARMOUR_STAND}`)?.inputs.some((x) => x.item === 'timber'));
check('a woven rug is tailoring from yarn at a loom; curtains tailoring from cloth',
  RECIPE_BY_ID.get(`make_${WOVEN_RUG}`)?.station === 'loom' && RECIPE_BY_ID.get(`make_${WOVEN_RUG}`)?.skill === 'tailoring'
  && !!RECIPE_BY_ID.get(`make_${WOVEN_RUG}`)?.inputs.some((x) => x.item === 'yarn')
  && RECIPE_BY_ID.get(`make_${CURTAINS}`)?.skill === 'tailoring' && !!RECIPE_BY_ID.get(`make_${CURTAINS}`)?.inputs.some((x) => x.item === 'cloth'));
check('a woven rug and curtains take a dye, on the island too', DYEABLE_ITEMS.has(WOVEN_RUG) && DYEABLE_ITEMS.has(CURTAINS)
  && psql(`select count(*) from dyeable_item where id in ('${WOVEN_RUG}', '${CURTAINS}')`) === '2');
check(`a stone lantern gathers moss, which is what a scurra scrubs`, psql(`select mossy::text from furniture_def where id = '${STONE_LANTERN}'`) === 'true');
check('an armour stand has a slot for every place armour is worn', STAND_SLOTS.join(',') === ARMOUR_SLOTS.join(',')
  && psql(`select array_to_string(stand_slots(), ',')`) === ARMOUR_SLOTS.join(','));

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time, '|' order by id)
  from action_def where id = any (array[${DECOR_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...DECOR_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}`;
}).join('|');
check(`its ${DECOR_JOBS.length} jobs are the same rows on both sides`, jobsIsle === jobsHere, jobsIsle);
check('and every one of them is a home piece\'s job on the island', psql(`select bool_and(decor_action(id)) from unnest(array[${DECOR_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
check('every timed job has a sound', DECOR_JOBS.every((id) => (ACTION_BY_ID.get(id)?.instant ?? false) || !!STROKE_BY_ID[id]),
  DECOR_JOBS.filter((id) => !ACTION_BY_ID.get(id)?.instant && !STROKE_BY_ID[id]).join(','));
{
  const keys = Object.keys(DECOR_SAID) as DecorSaid[];
  const isle = psql(`select string_agg(decor_said(k, 'legs'), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => decorSaid(k, 'legs')).join('#'), isle);
  const done = Object.keys(DECOR_DONE) as Array<keyof typeof DECOR_DONE>;
  const dIsle = psql(`select string_agg(decor_done(k, 'pink', 2, 5, 20), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => decorDone(k, { what: 'pink', n: 2, held: 5, of: 20 })).join('#'), dIsle);
  const kept = Object.keys(KEPT_WHY) as Array<keyof typeof KEPT_WHY>;
  check('and why a piece stays on in a swap', psql(`select string_agg(kept_why(k), '#' order by o) from unnest(array[${kept.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`)
    === kept.map((k) => KEPT_WHY[k]).join('#'));
}

/* ---- 2. on the island ---------------------------------------------------------------------------- */

const MIRA = 'd3c0a170-0000-4000-8000-0000000000d1';
const OTTO = 'd3c0a170-0000-4000-8000-0000000000d2';
const T = (id: string, more = ''): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${more})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 1, sy = 1): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string, who = 'u'): string => `perform act_perform(w, ${who}, '${action}', ${target});`;
/** Build a piece through its own recipe, at a set roll, and return its item into `v_it`. */
const build = (id: string, more = ''): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const gives = (r?.inputs ?? []).map((i) => `perform give(w, u, '${i.item}', ${i.count}, 40${i.item === 'plank' || i.item === 'shaft' || i.item === 'timber' ? ", 'Oak'" : ''});`).join('\n  ');
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1)${more}));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;`;
};
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now() where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${ask(`${key}:ask`, 'place_furniture', target)}
  ${act('place_furniture', target)}
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;
const bucket = (l: DyeLiquid): string => `v_b := give(w, u, 'dye_bucket', 1, 50); update item set dye = ${sq(dyeText(l, 10))} where id = v_b;`;
const RED = pureDye('red', 50), BLUE = pureDye('blue', 50), YELLOW = pureDye('yellow', 50);

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
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_b bigint; v_sun bigint; v_bin bigint; v_lan bigint; v_rug bigint;
        v_cur bigint; v_std bigint; v_pa bigint; v_pb bigint; v_a bigint; v_c bigint; v_rank bigint; v_g jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Homestead', 167, 64, 10, 10, true) returning id into w;
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
    unnest(array['fine_carpentry', 'carpentry', 'masonry', 'tailoring', 'farming', 'alchemy']) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- A house to the south: its north side a window at x 10, a solid wall at 11; its inside, 10..11 at y 12.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 91, 'Cottage', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 91, 10, 12), (w, 91, 11, 12);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 0, 'h', 10, 12, 91, 'window', 'plank', '{"plank":0}', '{"plank":18}', u),
    (w, 0, 'h', 11, 12, 91, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u);

  -- 1. A sundial: the island's clock, and the days left in the season.
  ${at(8, 9)}
  ${build(SUNDIAL)}
  ${place('SUN', TILE('v_it', 8, 9, 's', 0, 0))}
  v_sun := v_pl;
  ${act(READ_SUNDIAL, T('v_sun'))}
  insert into said values ('SUN:said', ${lastSaid()});
  insert into said values ('SUN:clock', world_clock(w) || '|' || extract(epoch from now())::text);

  -- 2. A compost bin: what it takes, how much, and when it is compost.
  ${at(12, 6)}
  ${build(COMPOST_BIN)}
  ${place('BIN', TILE('v_it', 12, 6, 's', 0, 0))}
  v_bin := v_pl;
  delete from item where world_id = w and holder_uid = u and def not in ('mallet', 'trowel', 'needle');
  v_a := give(w, u, 'bread', 1, 30);
  ${ask('BIN:fresh', FILL_COMPOST, T('v_bin'))}
  update item set dmg = ${40} where id = v_a;
  ${ask('BIN:spoiled', FILL_COMPOST, T('v_bin'))}
  ${act(FILL_COMPOST, T('v_bin'))}
  v_a := give(w, u, 'ash', 3, 20);
  ${act(FILL_COMPOST, T('v_bin', ", 'itemUid', v_a"))}
  insert into said values ('BIN:said', ${lastSaid()});
  v_a := give(w, u, 'mixed_grass', ${COMPOST_HOLDS + 5}, 20);
  ${act(FILL_COMPOST, T('v_bin'))}
  insert into said select 'BIN:heap', (pl.garden->'heap'->>'n') || '|' || ${count('mixed_grass')} from placed pl where pl.id = v_bin;
  ${ask('BIN:full', FILL_COMPOST, T('v_bin'))}
  ${ask('BIN:notready', EMPTY_COMPOST, T('v_bin'))}
  update placed set garden = jsonb_set(garden, '{heap,at}', to_jsonb(extract(epoch from now()) - compost_days() * day_seconds() - 1)) where id = v_bin;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_BIN', v_g::text);
  ${ask('BIN:ready', FILL_COMPOST, T('v_bin'))}
  ${act(EMPTY_COMPOST, T('v_bin'))}
  insert into said values ('BIN:emptied', ${count('compost')}::text || '|' || ${lastSaid()} || '|' || coalesce((select pl.garden::text from placed pl where pl.id = v_bin), '-'));
  ${ask('BIN:empty', EMPTY_COMPOST, T('v_bin'))}

  -- 3. Compost spread on a field and on a planter, and a planter's harvest with and without it.
  perform land_set_tile(w, 4, 4, tile_id('Field'));
  ${at(4, 4)}
  v_a := give(w, u, 'onion_seed', 1, 40);
  ${act('plant_seed', `jsonb_build_object('kind', 'tile', 'x', 4, 'y', 4, 'itemUid', v_a)`)}
  delete from item where world_id = w and holder_uid = u and def = 'compost';
  ${ask('FIELD:nocompost', SPREAD_COMPOST, `jsonb_build_object('kind', 'tile', 'x', 4, 'y', 4)`)}
  ${ask('FIELD:nocrop', SPREAD_COMPOST, `jsonb_build_object('kind', 'tile', 'x', 5, 'y', 4)`)}
  perform give(w, u, 'compost', 3, 40);
  ${ask('FIELD:ok', SPREAD_COMPOST, `jsonb_build_object('kind', 'tile', 'x', 4, 'y', 4)`)}
  ${act(SPREAD_COMPOST, `jsonb_build_object('kind', 'tile', 'x', 4, 'y', 4)`)}
  insert into said values ('FIELD:said', ${lastSaid()} || '|' || ${count('compost')}::text || '|' || (select c.fed::text from crop c where c.world_id = w and c.x = 4 and c.y = 4));
  ${ask('FIELD:fed', SPREAD_COMPOST, `jsonb_build_object('kind', 'tile', 'x', 4, 'y', 4)`)}
  ${at(6, 8)}
  ${build('planter')}
  ${place('PA', TILE('v_it', 6, 8, 's', 0, 0))}
  v_pa := v_pl;
  ${build('planter')}
  ${place('PB', TILE('v_it', 7, 8, 's', 0, 0))}
  v_pb := v_pl;
  perform give(w, u, 'onion_seed', 2, 40);
  ${act('plant_seed', `${T('v_pa')} || jsonb_build_object('itemUid', (select id from item where world_id = w and holder_uid = u and def = 'onion_seed' limit 1))`)}
  ${act('plant_seed', `${T('v_pb')} || jsonb_build_object('itemUid', (select id from item where world_id = w and holder_uid = u and def = 'onion_seed' limit 1))`)}
  ${act(SPREAD_COMPOST, T('v_pa'))}
  update planter_crop set stage = crop_ripe(), tended = 3, ql = 40, stage_at = now() where placed in (v_pa, v_pb);
  v_g := rpc_ground(w, 40, true);
  insert into said values ('GROUND_FED', v_g::text);
  insert into said values ('PLANTERS', v_pa::text || ',' || v_pb::text);
  perform give(w, u, 'sickle', 1, 50);
  delete from item where world_id = w and holder_uid = u and def = 'onion';
  update skill set value = 60 where world_id = w and uid = u and id = 'farming';
  perform pg_temp.dice('0.5');
  ${act('harvest_crop', T('v_pa'))}
  perform pg_temp.nodice();
  insert into said select 'HARV:fed', max(ql)::text from item where world_id = w and holder_uid = u and def = 'onion';
  delete from item where world_id = w and holder_uid = u and def = 'onion';
  update skill set value = 60 where world_id = w and uid = u and id = 'farming';
  perform pg_temp.dice('0.5');
  ${act('harvest_crop', T('v_pb'))}
  perform pg_temp.nodice();
  insert into said select 'HARV:plain', max(ql)::text from item where world_id = w and holder_uid = u and def = 'onion';

  -- 4. A stone lantern: built, set down, mossy; it greens and is scrubbed with what a scurra scrubs.
  ${at(13, 9)}
  ${build(STONE_LANTERN)}
  ${place('LAN', TILE('v_it', 13, 9, 's', 0, 0))}
  v_lan := v_pl;

  -- 5. A woven rug: at a loom, in the pattern chosen; a colour a dyeing; set down with them; scrubbed off together.
  ${at(6, 6)}
  ${build('loom')}
  ${place('LOOM', TILE('v_it', 6, 6, 's', 0, 0))}
  ${build(WOVEN_RUG, ", 'pattern', 'diamond'")}
  v_rug := v_it;
  ${build(WOVEN_RUG)}
  insert into said select 'RUG:patterns', (select i.garden->>'pattern' from item i where i.id = v_rug) || '|' || (select i.garden->>'pattern' from item i where i.id = v_it);
  delete from item where id = v_it;
  ${bucket(RED)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_rug)")}
  ${ask('RUG:same', 'dye_item', "jsonb_build_object('kind', 'item', 'uid', v_rug)")}
  delete from item where world_id = w and holder_uid = u and def = 'dye_bucket';
  ${bucket(BLUE)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_rug)")}
  delete from item where world_id = w and holder_uid = u and def = 'dye_bucket';
  ${bucket(YELLOW)}
  ${act('dye_item', "jsonb_build_object('kind', 'item', 'uid', v_rug)")}
  ${ask('RUG:full', 'dye_item', "jsonb_build_object('kind', 'item', 'uid', v_rug)")}
  insert into said select 'RUG:item', coalesce(i.dye, '-') || '|' || coalesce((i.garden->'tints')::text, '-') from item i where i.id = v_rug;
  ${at(6, 10)}
  ${place('RUG', TILE('v_rug', 6, 10, 's', 0, 0))}
  v_rug := v_pl;
  insert into said select 'RUG:placed', coalesce(pl.dye, '-') || '|' || coalesce((pl.garden->'tints')::text, '-') || '|' || (pl.garden->>'pattern') from placed pl where pl.id = v_rug;

  -- 6. Curtains: either face of a finished window, over its middle; drawn and opened.
  ${at(10, 12)}
  ${build(CURTAINS)}
  v_cur := v_it;
  ${ask('CUR:solid', 'place_furniture', TILE('v_cur', 11, 12, 'n'))}
  ${ask('CUR:nowall', 'place_furniture', TILE('v_cur', 9, 11, 's'))}
  ${place('CUR', TILE('v_cur', 10, 12, 'n', 0, 3))}
  v_cur := v_pl;
  insert into said select 'CUR:at', pl.sx || ',' || pl.sy || ',' || pl.facing from placed pl where pl.id = v_cur;
  ${act(DRAW_CURTAINS, T('v_cur'))}
  insert into said select 'CUR:shut', coalesce(pl.garden->>'shut', '-') || '|' || ${lastSaid()} from placed pl where pl.id = v_cur;

  -- 7. An armour stand.
  ${at(14, 6)}
  ${build(ARMOUR_STAND)}
  ${place('STD', TILE('v_it', 14, 6, 's', 0, 0))}
  v_std := v_pl;
  delete from item where world_id = w and holder_uid = u;
  ${ask('STD:none', STAND_PUT, T('v_std'))}
  ${ask('STD:noswap', STAND_SWAP, T('v_std'))}
  -- Carried: leather trousers and a chain hauberk; worn: a helm and cloth shoes.
  v_a := give(w, u, 'leather_trousers', 1, 40);
  perform give(w, u, 'chain_hauberk', 1, 40, 'Iron');
  v_b := give(w, u, 'helm', 1, 40, 'Iron');
  v_c := give(w, u, 'cloth_shoes', 1, 40);
  update item set dye = '#3366aa' where id = v_c;
  update player set equipped = jsonb_build_object('head', v_b, 'feet', v_c) where world_id = w and uid = u;
  ${ask('STD:put', STAND_PUT, T('v_std'))}
  ${act(STAND_PUT, T('v_std'))}
  insert into said values ('STD:put1', ${lastSaid()});
  ${act(STAND_PUT, T('v_std', ", 'itemUid', (select id from item where world_id = w and holder_uid = u and def = 'chain_hauberk')"))}
  v_it := give(w, u, 'plank', 1, 40);
  ${ask('STD:plank', STAND_PUT, T('v_std', ", 'itemUid', v_it"))}
  v_it := give(w, u, 'leather_trousers', 1, 40);
  ${ask('STD:taken', STAND_PUT, T('v_std', ", 'itemUid', v_it"))}
  delete from item where id = v_it;
  insert into said select 'STD:worn', (select string_agg(k, ',' order by k) from jsonb_object_keys(pl.garden->'worn') k) || '|' || (pl.garden->'worn'->'chest'->>0)
    || '|' || (pl.garden->'worn'->'chest'->>2) || '|' || (select count(*) from item i where i.holder = 'stand' and i.placed = v_std)::text from placed pl where pl.id = v_std;
  ${ask('STD:lift', 'pick_up_furniture', T('v_std'))}
  -- Otto, not of its settlement: not his.
  ${at(14, 6, 'o')}
  perform give(w, o, 'helm', 1, 40, 'Iron');
  ${ask('STD:otto', STAND_PUT, T('v_std'), 'o')}
  -- A settlement of Mira's over it, Otto its guest: a guest may use its crates, and so its stand, until the rank may not.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 8, 6, 1, u);
  perform deed_ranks_seed(w, u);
  select id into v_rank from deed_rank_def where world_id = w and founder = u and name = 'Guest';
  insert into deed_member (world_id, founder, uid, role, rank_id) values (w, u, o, 'guest', v_rank);
  ${ask('STD:guest', STAND_TAKE('legs'), T('v_std'), 'o')}
  -- The stone lantern on Mira's settlement, greened a while: what a scurra of hers scrubs, and scrubbed bare.
  update world set green_from = now() - interval '30 days' where id = w;
  update placed set made_at = now() - interval '20 days' where id = v_lan;
  insert into said values ('LAN:green', green_on_tile(w, u, 13, 9)::text);
  perform scrub_tile(w, u, 13, 9);
  insert into said values ('LAN:scrubbed', green_on_tile(w, u, 13, 9)::text);
  update deed_rank_def set perms = 0 where id = v_rank;
  ${ask('STD:norank', STAND_TAKE('legs'), T('v_std'), 'o')}
  -- Worn for the swap: a circlet on the head (no armour), a locked cloth tunic (kept), cloth shoes (to the stand), and nothing on the legs (the trousers from it).
  v_it := give(w, u, 'circlet', 1, 40);
  v_a := give(w, u, 'cloth_tunic', 1, 40);
  update item set locked = true where id = v_a;
  update player set equipped = jsonb_build_object('head', v_it, 'chest', v_a, 'feet', v_c) where world_id = w and uid = u;
  delete from item where id = v_b;
  insert into said select 'PACK', jsonb_build_object('items', (select jsonb_agg(jsonb_build_object('id', i.id, 'def', i.def, 'locked', i.locked)) from item i
    where i.world_id = w and i.holder = 'player' and i.holder_uid = u), 'equipped', p.equipped)::text from player p where p.world_id = w and p.uid = u;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_PRE', v_g::text);
  ${act(STAND_SWAP, T('v_std'))}
  insert into said values ('STD:swap', ${lastSaid()});
  insert into said select 'STD:after', (select string_agg(k, ',' order by k) from jsonb_object_keys(pl.garden->'worn') k)
    || '|' || (select string_agg(e.key || '=' || (select i.def from item i where i.id = (e.value)::text::bigint), ',' order by e.key) from player p, jsonb_each(p.equipped) e where p.world_id = w and p.uid = u)
    from placed pl where pl.id = v_std;
  ${act(STAND_TAKE('chest'), T('v_std'))}
  insert into said values ('STD:took', ${lastSaid()} || '|' || ${count('chain_hauberk')}::text);
  ${ask('STD:emptyslot', STAND_TAKE('chest'), T('v_std'))}

  -- 8. Every browser told: the rug, the curtains, the stand, the crops.
  ${at(10, 9)}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('IDS', concat_ws(',', v_sun, v_bin, v_lan, v_rug, v_cur, v_std));
  insert into said values ('GROUND', v_g::text);
  -- And the rug's colours scrubbed off together.
  ${at(6, 10)}
  perform give(w, u, '${SCRUB_TOOL}', 1, 50);
  ${act('scrub_dye', T('v_rug'))}
  insert into said select 'RUG:scrubbed', coalesce(pl.dye, '-') || '|' || coalesce(pl.garden::text, '-') from placed pl where pl.id = v_rug;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const part = (k: string, i = 0): string => said(k).split('|')[i] ?? '';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

for (const k of ['SUN', 'BIN', 'PA', 'PB', 'LAN', 'LOOM', 'RUG', 'CUR', 'STD']) is(`${k}:ask`, 'none', `${k}: built and set down`);
/* 1. */
{
  const [clock, now] = said('SUN:clock').split('|');
  check('a sundial says the island\'s clock and the days left in its season, as the browser says it', said('SUN:said') === sundialSays(clock, Number(now)), `${said('SUN:said')} / ${sundialSays(clock, Number(now))}`);
}
/* 2. */
is('BIN:fresh', DECOR_SAID.nothingToCompost, 'a bin takes no food that is not spoiled');
is('BIN:spoiled', 'none', 'and takes it spoiled');
check('it takes ash, a stack, and says how full it is', said('BIN:said') === decorDone('filled', { what: 'ashes', n: 3, held: 4, of: COMPOST_HOLDS }), said('BIN:said'));
check(`and mixed grass to its room, ${COMPOST_HOLDS}, leaving the rest`, said('BIN:heap') === `${COMPOST_HOLDS}|9`, said('BIN:heap'));
is('BIN:full', DECOR_SAID.binFull, 'then refuses more');
is('BIN:notready', DECOR_SAID.notReady, `and is not emptied before ${COMPOST_DAYS} days`);
is('BIN:ready', DECOR_SAID.binReady, 'and takes nothing more once it is compost');
check(`emptied, it gives one compost per ${COMPOST_PER} things, and is empty`,
  part('BIN:emptied', 0) === String(compostOf(COMPOST_HOLDS)) && part('BIN:emptied', 1) === decorDone('emptied', { n: compostOf(COMPOST_HOLDS) }) && part('BIN:emptied', 2) === '-', said('BIN:emptied'));
is('BIN:empty', DECOR_SAID.binEmpty, 'and refuses another emptying');
/* 3. */
is('FIELD:nocompost', DECOR_SAID.noCompost, 'compost is not spread without compost');
is('FIELD:nocrop', DECOR_SAID.noCrop, 'nor where nothing is sown');
is('FIELD:ok', 'none', 'and is spread on a sown field');
check('spread, it is used and kept on the crop', said('FIELD:said') === `${decorDone('spread', { what: 'onion' })}|2|true`, said('FIELD:said'));
is('FIELD:fed', DECOR_SAID.fed, 'and is not spread twice');
check(`a planter with compost on it is harvested ${COMPOST_BOOST} QL over one without`,
  Math.abs(Number(said('HARV:fed')) - Math.min(100, Number(said('HARV:plain')) + COMPOST_BOOST)) < 1e-3 && Number(said('HARV:plain')) > 0, `${said('HARV:fed')} / ${said('HARV:plain')}`);
/* 4. */
check('a stone lantern greens with moss, on the ground a scurra scrubs', Number(said('LAN:green')) > 0, said('LAN:green'));
is('LAN:scrubbed', '0', 'and is scrubbed bare by it');
/* 5. */
check('a rug is woven in the pattern chosen at the loom, the first when none is', said('RUG:patterns') === `diamond|${RUG_PATTERNS[0]}`, said('RUG:patterns'));
is('RUG:same', dyedAlready(dyeHex({ ...RED })), 'a rug refuses the colour it last took');
const [r, b, y] = [RED, BLUE, YELLOW].map((l) => dyeHex(l));
check(`a rug takes ${RUG_COLOURS} colours, a dyeing each`, said('RUG:item') === `${r}|["${b}", "${y}"]`, said('RUG:item'));
is('RUG:full', DECOR_SAID.rugFull, 'and no more');
check('set down, it keeps its colours and its pattern', said('RUG:placed') === `${r}|["${b}", "${y}"]|diamond`, said('RUG:placed'));
check('scrubbed, its colours come off together, its pattern kept', said('RUG:scrubbed') === '-|{"pattern": "diamond"}', said('RUG:scrubbed'));
/* 6. */
is('CUR:solid', MOUNT_SAID.noWindow, 'curtains not on a solid wall');
is('CUR:nowall', MOUNT_SAID.noWindow, 'nor where there is no wall');
check('curtains on the inner face of a window, over its middle', said('CUR:at') === `${furnitureAnchor(CURTAINS, 0, 3, 'n').join(',')},n` && said('CUR:at') === '1,0,n', said('CUR:at'));
check('drawn, for everybody', said('CUR:shut') === `true|${DECOR_DONE.shut}`, said('CUR:shut'));
/* 7. */
is('STD:none', DECOR_SAID.noArmour, 'a stand with no armour in the pack');
is('STD:noswap', DECOR_SAID.nothingToSwap, 'and nothing to swap');
is('STD:put', 'none', 'armour carried goes on');
check('the first carried piece for a free slot, before one worn', said('STD:put1') === decorDone('put', { what: 'leather trousers' }), said('STD:put1'));
is('STD:plank', DECOR_SAID.notArmour, 'armour only');
is('STD:taken', decorSaid('slotTaken', 'legs'), 'one to a slot');
check('what is on it is the stand\'s, told to every browser as worn gear is', said('STD:worn') === 'chest,legs|chain_hauberk|Iron|2', said('STD:worn'));
is('STD:lift', GARDEN_SAID.showing, 'a stand with armour on it is not picked up');
is('STD:otto', DECOR_SAID.notYours, 'somebody else\'s stand, off a settlement of theirs');
is('STD:guest', 'none', 'a rank that may use the crates on its settlement may change it');
is('STD:norank', lacksSaid('Home', 'Guest', 'stores'), 'and one that may not, may not');

/* ---- 3. what every browser reads, and says the same of ------------------------------------------------- */

const ids = said('IDS').split(',').map(Number);
const [, bin, lan, rug, cur, std] = ids;
const looker = (ground: string): Game => {
  const g = Game.create(167, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(JSON.parse(ground) as IslandGround);
  return g;
};
{
  // Before the swap: the stand as the island had it, Mira's pack and what she wore.
  const seen = looker(said('GROUND_PRE'));
  const pack = JSON.parse(said('PACK')) as { items: Array<{ id: number; def: string; locked: boolean }>; equipped: Record<string, number> };
  seen.inventory.items.length = 0;
  for (const it of pack.items) {
    const one = seen.inventory.add(it.def, { ql: 40 });
    one.uid = it.id;
    if (it.locked) one.locked = true;
  }
  for (const [slot, uid] of Object.entries(pack.equipped)) (seen.player.equipped as Record<string, number | null>)[slot] = uid;
  const f = seen.furniture.get(std);
  check('the browser reads what is on the stand', JSON.stringify(Object.keys(f?.decor?.worn ?? {}).sort()) === '["chest","legs"]', JSON.stringify(f?.decor));
  const want = f ? swapSaid(swapPlan(seen, f)) : '';
  check('a swap: what fits changed slot by slot, what does not kept on, in the same words on both sides', said('STD:swap') === want
    && said('STD:swap') === `${decorDone('swapped', { what: 'legs, feet' })} ${decorDone('kept', { what: `circlet (${KEPT_WHY.armour}), cloth tunic (${KEPT_WHY.locked})` })}`,
  `${said('STD:swap')} / ${want}`);
}
check('after it, the trousers worn and the shoes on the stand, the circlet and the tunic kept on',
  said('STD:after') === 'chest,feet|chest=cloth_tunic,head=circlet,legs=leather_trousers', said('STD:after'));
check('a piece taken off comes back to the pack', said('STD:took') === `${decorDone('taken', { what: 'chain hauberk' })}|1`, said('STD:took'));
is('STD:emptyslot', DECOR_SAID.slotEmpty, 'and an empty slot gives nothing');
{
  const seen = looker(said('GROUND'));
  check('the browser reads a rug\'s pattern and colours', seen.furniture.get(rug)?.decor?.pattern === 'diamond'
    && JSON.stringify(seen.furniture.get(rug)?.decor?.tints) === JSON.stringify([b, y]) && seen.furniture.get(rug)?.dye === r, JSON.stringify(seen.furniture.get(rug)));
  check('and curtains drawn', seen.furniture.get(cur)?.decor?.shut === true);
  check('and what is left on the stand', JSON.stringify(Object.keys(seen.furniture.get(std)?.decor?.worn ?? {})) === '["feet"]'
    && seen.furniture.get(std)?.decor?.worn?.feet?.[3] === '#3366aa', JSON.stringify(seen.furniture.get(std)?.decor));
  check('and an emptied bin', !seen.furniture.get(bin)?.decor?.heap);
  const l = seen.furniture.get(lan);
  check(`a stone lantern lights ${STONE_LANTERN_REACH} tiles, whatever its quality`, !!l && stoneLanternLight(l).radius === STONE_LANTERN_REACH);
  seen.islandClock = () => 0;
  check('and does at night', !!l && seen.lights().some((s) => s.radius === STONE_LANTERN_REACH && Math.abs(s.x - stoneLanternLight(l).x) < 1e-9));
  // The browser's refusals off the same pieces, in the same words.
  seen.putBody(14.5, 6.5, 0);
  seen.inventory.items.length = 0;
  const why = (id: string, t: object): string => ACTION_BY_ID.get(id)?.check?.(t as never, seen) ?? 'none';
  check('the browser refuses a stand with no armour in the pack', why(STAND_PUT, { kind: 'furniture', id: std }) === DECOR_SAID.noArmour, why(STAND_PUT, { kind: 'furniture', id: std }));
  check('and an empty slot', why(STAND_TAKE('chest'), { kind: 'furniture', id: std }) === DECOR_SAID.slotEmpty);
  seen.putBody(12.5, 6.5, 0);
  check('and an empty bin', why(EMPTY_COMPOST, { kind: 'furniture', id: bin }) === DECOR_SAID.binEmpty);
  check('and nothing to compost', why(FILL_COMPOST, { kind: 'furniture', id: bin }) === DECOR_SAID.nothingToCompost);
  seen.inventory.add('ash', { ql: 20, count: 2 });
  check('and takes ash', why(FILL_COMPOST, { kind: 'furniture', id: bin }) === 'none');
  check('and draws curtains in reach, whoever', ACTION_BY_ID.get(DRAW_CURTAINS)?.labelFor?.({ kind: 'furniture', id: cur } as never, seen) === 'Open');
}
{
  const seen = looker(said('GROUND_FED'));
  const [pa] = said('PLANTERS').split(',').map(Number);
  check('every browser reads compost spread on a field and a planter', seen.cropAt(4, 4)?.fed === true && seen.planted.get(pa)?.fed === true);
  seen.putBody(6.5, 8.5, 0);
  seen.inventory.items.length = 0;
  seen.inventory.add('compost', { ql: 40 });
  const why = ACTION_BY_ID.get(SPREAD_COMPOST)?.check?.({ kind: 'furniture', id: pa } as never, seen) ?? 'none';
  check('and refuses it twice in the island\'s words', why === DECOR_SAID.fed, why);
}
{
  const seen = looker(said('GROUND_BIN'));
  seen.putBody(12.5, 6.5, 0);
  const why = ACTION_BY_ID.get(EMPTY_COMPOST)?.check?.({ kind: 'furniture', id: bin } as never, seen) ?? 'none';
  check('the browser reads a bin\'s heap and when it is compost', seen.furniture.get(bin)?.decor?.heap?.n === COMPOST_HOLDS && why === 'none', `${JSON.stringify(seen.furniture.get(bin)?.decor)} ${why}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`home pieces — ${ok.length} of ${ok.length}`);
