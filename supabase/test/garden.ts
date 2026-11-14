/**
 * The garden pieces (`garden.ts`, `gardendefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, with real
 * recipes (the trade, the tool, the time, the bill); what each piece is on the
 * island (`furniture_def`) and that the growing ones hand every browser the
 * moment they were set down; the jobs and every sentence. Then on the island:
 *
 *   * a raised flower bed, a window box and a hanging basket: wildflowers
 *     planted a kind to a slot, chosen as each is planted, refused full and
 *     short of wildflowers, stored on the piece and read by every browser;
 *     pulled up; carried into the pack and back down with the piece;
 *   * the wall placement: a window box only under a window, outside, on the
 *     ground; a plaque only on a finished solid wall, either face; a basket
 *     and a chime hung from an eave or a lantern post; each in the row along
 *     the side it faces, a window box under the middle; turned round to the
 *     next side that takes it;
 *   * a herb box: herbs only, harvested at its share of a planter's yield;
 *   * a topiary tub: trimmed to a shape with a sickle, the trim's moment kept,
 *     grown out `TOPIARY_GROWS_OUT` days after;
 *   * a hedge: outside and on the ground; clipped once full and not the same
 *     way twice; shutting the border it stands along, on the island's way and
 *     in the browser;
 *   * a bonsai: a step of shaping a prune, one prune a `PRUNE_REST`, five at
 *     most, by anybody;
 *   * a carved figure: carved only as a kind in the maker's field guide,
 *     chosen at the bench, and kept through the pack and the ground;
 *   * a trophy plaque: takes only a thing flagged a trophy (defined here, in
 *     the test, as none is on main yet), with its slayer's name, by whoever set
 *     it down or a citizen; not picked up with one on it; and a plant stand,
 *     the same with potted plants;
 *   * and the growth of everything that grows, by the moment it was set down
 *     and the season, at fixed moments in each season.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/garden.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/garden.mjs && node node_modules/.cache/garden.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureAnchor } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  bloomStage, bonsaiGrowth, CLEAR_BLOOMS, CLIP_HEDGE, FIGURE_SAID, GARDEN_DONE, GARDEN_JOBS, GARDEN_SAID, gardenSaid, growsFromSet, hedgeGrowth, MOUNT_SAID,
  PLANT_BLOOM, PRUNE_BONSAI, SHOW_THING, TAKE_SHOWN, topiaryOut, topiaryShows, TRIM_TOPIARY, type GardenSaid,
} from '../../src/game/garden';
import {
  ARBOUR_BENCH, BED_SLOTS, BIRDHOUSE, BLOOM_COST, BONSAI, BONSAI_GROWN, BONSAI_STEPS, BOX_SLOTS, CARVED_FIGURE, FLOWER_BED, FLOWER_CART, FOLDING_SCREEN,
  HANGING_BASKET, HEDGE, HEDGE_FULL, HERB_BOX, HERB_SHARE, PLANT_STAND, POTTED_FERN, POTTED_PALM, PRUNE_REST, TOPIARY_GROWS_OUT, TOPIARY_TUB, TROPHY_PLAQUE,
  WIND_CHIME, WINDOW_BOX, WISTERIA_PERGOLA,
} from '../../src/game/gardendefs';
import { HERBS_ONLY } from '../../src/game/farming';
import { roseStage, ROSE_BUD, ROSE_FLOWER, ROSE_LEAFY } from '../../src/game/roses';
import { DAY_SECONDS } from '../../src/game/pace';
import { SEASON_DAYS, seasonAt, SEASONS, YEAR_FROM } from '../../src/world/calendar';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

const DAY = DAY_SECONDS;
const PIECES = [FLOWER_BED, WINDOW_BOX, HANGING_BASKET, HERB_BOX, TOPIARY_TUB, POTTED_FERN, POTTED_PALM, HEDGE, WISTERIA_PERGOLA, BONSAI, FLOWER_CART,
  BIRDHOUSE, ARBOUR_BENCH, CARVED_FIGURE, TROPHY_PLAQUE, FOLDING_SCREEN, PLANT_STAND, WIND_CHIME];
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- 1. the pieces, their recipes, their items and their jobs, the same on both sides ---------------- */

check(`${PIECES.length} pieces, each a piece and an item`, PIECES.length === 18 && PIECES.every((id) => FURNITURE_BY_ID.has(id) && !!ITEM_DEFS[id]));
for (const id of PIECES) {
  const f = FURNITURE_BY_ID.get(id);
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const here = r ? `${r.skill}|${r.tool}|${r.baseTime}|${r.difficulty}|${r.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : 'none';
  const isle = psql(`select r.skill || '|' || r.tool || '|' || r.base_time || '|' || r.difficulty || '|'
    || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
    from recipe r where r.id = 'make_${id}'`);
  check(`${id}: a recipe with its trade, tool, time and bill, the same on both sides (${here})`, isle === here && !!r && r.skill !== '' && !!r.tool, isle);
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(bloom::text, '-'), coalesce(mount, '-'), hedge::text, coalesce(herbs::text, '-'), topiary::text, bonsai::text,
    coalesce(shows, '-'), coalesce(shows_n::text, '-'), figure::text, roses::text) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.bloom ?? '-', f?.mount ?? '-', !!f?.hedge, f?.herbs ?? '-', !!f?.topiary, !!f?.bonsai, f?.shows?.what ?? '-', f?.shows?.n ?? '-',
    !!f?.figure, !!f && growsFromSet(f)].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{'), desc);
}
check('the fine carpentry pieces are made with fine carpentry and the rest with their own trades',
  [FLOWER_BED, WINDOW_BOX, HERB_BOX, TOPIARY_TUB, BONSAI, BIRDHOUSE, CARVED_FIGURE, TROPHY_PLAQUE, FOLDING_SCREEN, PLANT_STAND, WIND_CHIME]
    .every((id) => RECIPE_BY_ID.get(`make_${id}`)?.skill === 'fine_carpentry')
  && RECIPE_BY_ID.get(`make_${HANGING_BASKET}`)?.skill === 'ropemaking' && RECIPE_BY_ID.get(`make_${HEDGE}`)?.skill === 'forestry'
  && RECIPE_BY_ID.get(`make_${POTTED_FERN}`)?.skill === 'pottery' && RECIPE_BY_ID.get(`make_${WISTERIA_PERGOLA}`)?.skill === 'carpentry');
check('a hanging basket is rope and a clay pot; a topiary tub, a bonsai and a hedge take sprouts; a folding screen cloth',
  ['rope', 'clay_pot'].every((i) => !!RECIPE_BY_ID.get(`make_${HANGING_BASKET}`)?.inputs.some((x) => x.item === i))
  && [TOPIARY_TUB, BONSAI].every((p) => !!RECIPE_BY_ID.get(`make_${p}`)?.inputs.some((x) => x.item === 'sprout'))
  && !!RECIPE_BY_ID.get(`make_${HEDGE}`)?.inputs.some((x) => x.item === 'sprout' && x.count === 4)
  && !!RECIPE_BY_ID.get(`make_${FOLDING_SCREEN}`)?.inputs.some((x) => x.item === 'cloth'));
check('a folding screen takes a dye, on the island too', psql(`select count(*) from dyeable_item where id = '${FOLDING_SCREEN}'`) === '1');

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || coalesce(tool, '-') || ':' || base_time, '|' order by id)
  from action_def where id = any (array[${GARDEN_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...GARDEN_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.tool ?? '-'}:${a.baseTime}`;
}).join('|');
check(`its ${GARDEN_JOBS.length} jobs are the same rows on both sides, each with a time`, jobsIsle === jobsHere
  && GARDEN_JOBS.every((id) => (ACTION_BY_ID.get(id)?.baseTime ?? 0) > 0), jobsIsle);
check('and every one of them is a garden job on the island', psql(`select bool_and(garden_action(id)) from unnest(array[${GARDEN_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
{
  const keys = Object.keys(GARDEN_SAID) as GardenSaid[];
  const isle = psql(`select string_agg(garden_said(k, 'window box'), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => gardenSaid(k, 'window box')).join('#'), isle);
  const mk = ['noWindow', 'noWall', 'unfinished', 'inside', 'upstairs', 'noHook', 'turn'] as const;
  const mIsle = psql(`select string_agg(mount_said(k), '#' order by o) from unnest(array[${mk.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and where a fixed piece goes', mIsle === mk.map((k) => MOUNT_SAID[k]).join('#'), mIsle);
  const done = Object.keys(GARDEN_DONE) as Array<keyof typeof GARDEN_DONE>;
  const dIsle = psql(`select string_agg(garden_done(k, 'pink', 2, 4), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => GARDEN_DONE[k].replace('{what}', 'pink').replace('{n}', '2').replace('{of}', '4')).join('#'), dIsle);
  check('and a carved figure\'s refusals, and a herb box\'s', psql(`select figure_said('pick') || '#' || figure_said('unseen') || '#' || herbs_only_said()`)
    === `${FIGURE_SAID.pick}#${FIGURE_SAID.unseen}#${HERBS_ONLY()}`);
}

/* ---- 2. growth, by the moment it was set down and the season ----------------------------------- */

{
  // A moment in the middle of each season, at the wall clock's own reckoning (`seasonAt`).
  const mid = (s: string): number => {
    for (let t = YEAR_FROM; t < YEAR_FROM + 4 * SEASON_DAYS * DAY * 2; t += DAY) if (seasonAt(t).season === s && seasonAt(t + 10 * DAY).season === s) return t + 5 * DAY;
    return NaN;
  };
  const [spring, summer, autumn, winter] = SEASONS.map(mid);
  const stages = (at: number): string => [0.5, ROSE_LEAFY + 0.01, ROSE_BUD + 0.01, ROSE_FLOWER + 0.01].map((d) => bloomStage(at - d * DAY, at).stage).join(',');
  check('a bed\'s flowers grow by the arch\'s rule: bare, in leaf, in bud, in flower, in spring and in summer',
    stages(spring) === 'bare,leafy,bud,flower' && stages(summer) === 'bare,leafy,bud,flower', `${stages(spring)} / ${stages(summer)}`);
  check('and stand in leaf in autumn and winter, the same for everybody looking', stages(autumn) === 'bare,leafy,leafy,leafy' && stages(winter) === 'bare,leafy,leafy,leafy',
    `${stages(autumn)} / ${stages(winter)}`);
  const wis = (at: number): string => [0.5, ROSE_BUD + 0.01, ROSE_FLOWER + 0.01].map((d) => roseStage(at - d * DAY, at, 'wisteria').stage).join(',');
  check('wisteria: hanging flowers in spring, in leaf in summer and autumn, bare in winter',
    wis(spring) === 'bare,bud,flower' && wis(summer) === 'bare,leafy,leafy' && wis(autumn) === 'bare,leafy,leafy' && wis(winter) === 'bare,bare,bare',
    `${wis(spring)} / ${wis(summer)} / ${wis(autumn)} / ${wis(winter)}`);
  const now = summer;
  check(`a hedge is bare when set down and full ${HEDGE_FULL} days after`,
    hedgeGrowth(now, now) === 0 && Math.abs(hedgeGrowth(now - (HEDGE_FULL / 2) * DAY, now) - 0.5) < 1e-9 && hedgeGrowth(now - HEDGE_FULL * DAY, now) === 1);
  check(`a bonsai grows over ${BONSAI_GROWN} days`, bonsaiGrowth(now, now) === 0 && bonsaiGrowth(now - BONSAI_GROWN * DAY, now) === 1 && bonsaiGrowth(now - 15 * DAY, now) === 0.5);
  check(`a topiary shrub keeps its shape for ${TOPIARY_GROWS_OUT} days after its last trim, and is bushy after; never trimmed, bushy`,
    topiaryShows({ shape: 'spiral', trimAt: now - 1 * DAY }, now) === 'spiral' && topiaryShows({ shape: 'spiral', trimAt: now - TOPIARY_GROWS_OUT * DAY }, now) === null
      && topiaryShows(undefined, now) === null && Math.abs(topiaryOut({ shape: 'ball', trimAt: now - 3.5 * DAY }, now) - 0.5) < 1e-9);
}

/* ---- 3. on the island ---------------------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000c1';
const OTTO = 'e1c4a170-0000-4000-8000-0000000000c2';
const T = (id: string): string => `jsonb_build_object('kind', 'furniture', 'id', ${id})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 1, sy = 1): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
/** Build a piece through its own recipe, at a set roll, and return its item into `v_it`. */
const build = (id: string): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const gives = (r?.inputs ?? []).map((i) => `perform give(w, u, '${i.item}', ${i.count}, 40${i.item === 'plank' || i.item === 'shaft' || i.item === 'timber' ? ", 'Oak'" : ''});`).join('\n  ');
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1), 'species', 'rabba'));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;`;
};
/** Mira, and whoever else, stood on a tile. */
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now() where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${ask(`${key}:ask`, 'place_furniture', target)}
  perform act_perform(w, u, 'place_furniture', ${target});
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;

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
-- A trophy, defined here alone: none is on main yet (the lairs' drops carry the flag when they come).
insert into item_def (id, name, category, weight, stackable, decay, charges) values ('test_trophy_ear', 'Test trophy ear', 'misc', 0.2, false, 0, null);
update item_def set trophy = true where id = 'test_trophy_ear';
do $t$
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_bed bigint; v_box bigint; v_hb bigint; v_pt bigint;
        v_top bigint; v_hedge bigint; v_bon bigint; v_fig bigint; v_plq bigint; v_std bigint; v_post bigint; v_chime bigint; v_g jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Garden', 163, 64, 10, 10, true) returning id into w;
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
    unnest(array['fine_carpentry', 'carpentry', 'ropemaking', 'forestry', 'pottery', 'farming']) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- A house to the south: its north side a window at x 10, a solid wall at 11; its inside, 10..11 at y 12.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 91, 'Cottage', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 91, 10, 12), (w, 91, 11, 12);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 0, 'h', 10, 12, 91, 'window', 'plank', '{"plank":0}', '{"plank":18}', u),
    (w, 0, 'h', 11, 12, 91, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u),
    (w, 0, 'h', 12, 12, 91, 'solid', 'plank', '{"plank":3}', '{"plank":24}', u);

  -- 1. A raised flower bed: built, set down, planted a kind a slot, refused full and short.
  ${at(8, 9)}
  ${build(FLOWER_BED)}
  ${place('BED', TILE('v_it', 8, 9, 's'))}
  v_bed := v_pl;
  ${ask('BED:short', PLANT_BLOOM('pink'), T('v_bed'))}
  perform give(w, u, 'wildflowers', ${BLOOM_COST * (BED_SLOTS + BOX_SLOTS + 2)}, 30);
  ${ask('BED:ok', PLANT_BLOOM('pink'), T('v_bed'))}
  perform act_perform(w, u, '${PLANT_BLOOM('pink')}', ${T('v_bed')});
  insert into said values ('BED:said', ${lastSaid()});
  perform act_perform(w, u, '${PLANT_BLOOM('white')}', ${T('v_bed')});
  perform act_perform(w, u, '${PLANT_BLOOM('yellow')}', ${T('v_bed')});
  perform act_perform(w, u, '${PLANT_BLOOM('blue')}', ${T('v_bed')});
  ${ask('BED:full', PLANT_BLOOM('pink'), T('v_bed'))}
  insert into said select 'BED:garden', (pl.garden->'bloom')::text || '|' || ${count('wildflowers')} from placed pl where pl.id = v_bed;
  -- Carried into the pack with its flowers, and set down again with them.
  perform act_perform(w, u, 'pick_up_furniture', ${T('v_bed')});
  select id into v_it from item where world_id = w and holder_uid = u and def = '${FLOWER_BED}';
  insert into said select 'BED:pack', coalesce((i.garden->'bloom')::text, '-') from item i where i.id = v_it;
  ${place('BED2', TILE('v_it', 8, 9, 's'))}
  v_bed := v_pl;
  insert into said select 'BED:again', coalesce((pl.garden->'bloom')::text, '-') from placed pl where pl.id = v_bed;

  -- 2. A window box: only under a window, outside and on the ground; in the middle of the row.
  ${at(10, 11)}
  ${build(WINDOW_BOX)}
  ${ask('WB:nowall', 'place_furniture', TILE('v_it', 9, 11, 's'))}
  ${ask('WB:solid', 'place_furniture', TILE('v_it', 11, 11, 's'))}
  ${ask('WB:inside', 'place_furniture', TILE('v_it', 10, 12, 'n'))}
  ${place('WB', TILE('v_it', 10, 11, 's', 0, 0))}
  v_box := v_pl;
  insert into said select 'WB:at', pl.sx || ',' || pl.sy || ',' || pl.facing from placed pl where pl.id = v_box;
  perform act_perform(w, u, '${PLANT_BLOOM('blue')}', ${T('v_box')});
  perform act_perform(w, u, '${PLANT_BLOOM('blue')}', ${T('v_box')});
  perform act_perform(w, u, '${PLANT_BLOOM('pink')}', ${T('v_box')});
  ${ask('WB:full', PLANT_BLOOM('white'), T('v_box'))}
  insert into said select 'WB:garden', (pl.garden->'bloom')::text from placed pl where pl.id = v_box;
  ${ask('WB:turn', 'turn_furniture', T('v_box'))}
  ${ask('CLR:ok', CLEAR_BLOOMS, T('v_box'))}
  perform act_perform(w, u, '${CLEAR_BLOOMS}', ${T('v_box')});

  -- 3. A hanging basket and a wind chime: hung from an eave, or from a lantern post on the tile.
  ${build(HANGING_BASKET)}
  ${at(14, 14)}
  ${ask('HB:nohook', 'place_furniture', TILE('v_it', 15, 15, 's'))}
  ${at(11, 11)}
  ${place('HB', TILE('v_it', 11, 11, 's'))}
  v_hb := v_pl;
  ${at(14, 14)}
  ${build('lamp_post')}
  perform act_perform(w, u, 'place_furniture', ${TILE('v_it', 15, 15, 's', 0, 0)});
  select id into v_post from placed where world_id = w and sub = 'lamp_post';
  ${build(WIND_CHIME)}
  ${place('WC', TILE('v_it', 15, 15, 'e', 3, 2))}
  v_chime := v_pl;
  insert into said select 'WC:at', coalesce(pl.sub, '-') || ',' || pl.sx || ',' || pl.facing from placed pl where pl.id = v_chime;

  -- 4. A herb box: herbs only; at its share of a planter's yield.
  ${at(6, 6)}
  ${build(HERB_BOX)}
  ${place('HERB', TILE('v_it', 6, 6, 's', 0, 0))}
  v_pt := v_pl;
  perform give(w, u, 'wheat_seed', 1, 30);
  perform give(w, u, 'basil_seed', 1, 30);
  ${ask('HERB:wheat', 'plant_seed', `${T('v_pt')} || jsonb_build_object('itemUid', (select id from item where world_id = w and holder_uid = u and def = 'wheat_seed'))`)}
  perform act_perform(w, u, 'plant_seed', ${T('v_pt')} || jsonb_build_object('itemUid', (select id from item where world_id = w and holder_uid = u and def = 'basil_seed')));
  update planter_crop set stage = crop_ripe(), tended = 3, stage_at = now() where placed = v_pt;
  perform give(w, u, 'sickle', 1, 50);
  perform act_perform(w, u, 'harvest_crop', ${T('v_pt')});
  insert into said values ('HERB:got', ${count('basil')}::text || '|' || (crop_yield(3))[2]::text);

  -- 5. A topiary tub: trimmed to a shape with a sickle; the moment kept.
  ${at(6, 8)}
  ${build(TOPIARY_TUB)}
  ${place('TOP', TILE('v_it', 6, 8, 's', 0, 0))}
  v_top := v_pl;
  delete from item where world_id = w and holder_uid = u and def = 'sickle';
  ${ask('TOP:nosickle', TRIM_TOPIARY('spiral'), T('v_top'))}
  perform give(w, u, 'sickle', 1, 50);
  perform act_perform(w, u, '${TRIM_TOPIARY('spiral')}', ${T('v_top')});
  insert into said select 'TOP:garden', (pl.garden->>'shape') || '|' || (abs((pl.garden->>'trim_at')::double precision - extract(epoch from now())) < 5)::text || '|' || ${lastSaid()}
    from placed pl where pl.id = v_top;

  -- 6. A hedge: outside, on the ground; clipped once full and not twice the same way; shuts its border.
  ${at(10, 11)}
  ${build(HEDGE)}
  ${ask('HEDGE:inside', 'place_furniture', TILE('v_it', 11, 12, 'n'))}
  ${at(4, 10)}
  ${place('HEDGE', TILE('v_it', 4, 10, 'e', 0, 0))}
  v_hedge := v_pl;
  insert into said select 'HEDGE:at', pl.sx || ',' || pl.sy || ',' || pl.facing from placed pl where pl.id = v_hedge;
  ${ask('HEDGE:young', CLIP_HEDGE('flat'), T('v_hedge'))}
  update placed set made_at = now() - make_interval(secs => hedge_full() * day_seconds() + 60) where id = v_hedge;
  ${ask('HEDGE:ok', CLIP_HEDGE('flat'), T('v_hedge'))}
  perform act_perform(w, u, '${CLIP_HEDGE('flat')}', ${T('v_hedge')});
  ${ask('HEDGE:same', CLIP_HEDGE('flat'), T('v_hedge'))}
  insert into said select 'HEDGE:garden', pl.garden->>'clip' from placed pl where pl.id = v_hedge;
  insert into said values ('HEDGE:bars', hedge_between(w, 0, 5, 10, 'v')::text || '|' || hedge_between(w, 0, 4, 10, 'v')::text || '|' || hedge_between(w, 0, 5, 11, 'v')::text);

  -- 7. A bonsai: a step a prune, one prune a day, five at most, by anybody.
  ${at(6, 4)}
  ${build(BONSAI)}
  ${place('BON', TILE('v_it', 6, 4, 's', 0, 0))}
  v_bon := v_pl;
  ${at(6, 4, 'o')}
  ${ask('BON:noknife', PRUNE_BONSAI, T('v_bon'), 'o')}
  perform give(w, o, 'carving_knife', 1, 50);
  ${ask('BON:ok', PRUNE_BONSAI, T('v_bon'), 'o')}
  perform act_perform(w, o, '${PRUNE_BONSAI}', ${T('v_bon')});
  ${ask('BON:rest', PRUNE_BONSAI, T('v_bon'), 'o')}
  for i in 2 .. ${BONSAI_STEPS} loop
    update placed set garden = jsonb_set(garden, '{prune_at}', to_jsonb(extract(epoch from now()) - prune_rest() * day_seconds() - 1)) where id = v_bon;
    perform act_perform(w, o, '${PRUNE_BONSAI}', ${T('v_bon')});
  end loop;
  update placed set garden = jsonb_set(garden, '{prune_at}', to_jsonb(extract(epoch from now()) - prune_rest() * day_seconds() - 1)) where id = v_bon;
  ${ask('BON:shaped', PRUNE_BONSAI, T('v_bon'), 'o')}
  insert into said select 'BON:garden', (pl.garden->>'prunes') from placed pl where pl.id = v_bon;

  -- 8. A carved figure: only as a kind in the maker's field guide, chosen at the bench.
  ${at(7, 7)}
  perform give(w, u, 'carving_knife', 1, 50);
  v_it := give(w, u, 'plank', 2, 40, 'Oak');
  insert into said values ('FIG:pick', coalesce(act_refusal(w, u, 'make_${CARVED_FIGURE}', jsonb_build_object('kind', 'item', 'uid', v_it)), 'none'));
  insert into said values ('FIG:unseen', coalesce(act_refusal(w, u, 'make_${CARVED_FIGURE}', jsonb_build_object('kind', 'item', 'uid', v_it, 'species', 'rabba')), 'none'));
  insert into guide (world_id, uid, species) values (w, u, 'rabba');
  insert into said values ('FIG:seen', coalesce(act_refusal(w, u, 'make_${CARVED_FIGURE}', jsonb_build_object('kind', 'item', 'uid', v_it, 'species', 'rabba')), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${CARVED_FIGURE}', jsonb_build_object('kind', 'item', 'uid', v_it, 'species', 'rabba'));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${CARVED_FIGURE}';
  insert into said select 'FIG:item', coalesce(i.garden->>'figure', '-') || '|' || coalesce(i.extra, '-') from item i where i.id = v_it;
  ${place('FIG', TILE('v_it', 7, 7, 's', 0, 0))}
  v_fig := v_pl;
  insert into said select 'FIG:placed', coalesce(pl.garden->>'figure', '-') from placed pl where pl.id = v_fig;

  -- 9. A trophy plaque: on a finished solid wall, either face; a trophy only; by whoever set it down or a citizen.
  ${at(11, 12)}
  ${build(TROPHY_PLAQUE)}
  ${ask('PLQ:window', 'place_furniture', TILE('v_it', 10, 12, 'n'))}
  ${ask('PLQ:unfinished', 'place_furniture', TILE('v_it', 12, 11, 's'))}
  update player set x = 11.5, y = 12.5, body_at = now() where world_id = w and uid = u;
  ${place('PLQ', TILE('v_it', 11, 12, 'n', 2, 2))}
  v_plq := v_pl;
  insert into said select 'PLQ:at', pl.sx || ',' || pl.sy || ',' || pl.facing from placed pl where pl.id = v_plq;
  ${ask('PLQ:none', SHOW_THING, T('v_plq'))}
  perform give(w, u, 'test_trophy_ear', 1, 70, null, null, 'Hild');
  perform give(w, o, 'test_trophy_ear', 1, 70);
  update player set x = 11.5, y = 12.5, body_at = now() where world_id = w and uid = o;
  ${ask('PLQ:otto', SHOW_THING, T('v_plq'), 'o')}
  ${ask('PLQ:ok', SHOW_THING, T('v_plq'))}
  perform act_perform(w, u, '${SHOW_THING}', ${T('v_plq')});
  insert into said select 'PLQ:held', (pl.garden->'held'->0->>'def') || '|' || (pl.garden->'held'->0->>'by') || '|' || ${count('test_trophy_ear')} || '|' || ${lastSaid()}
    from placed pl where pl.id = v_plq;
  ${ask('PLQ:full', SHOW_THING, T('v_plq'))}
  ${ask('PLQ:lift', 'pick_up_furniture', T('v_plq'))}
  perform act_perform(w, u, '${TAKE_SHOWN}', ${T('v_plq')});
  insert into said select 'PLQ:back', ${count('test_trophy_ear')} || '|' || coalesce((select maker from item where world_id = w and holder_uid = u and def = 'test_trophy_ear'), '-')
    || '|' || coalesce(jsonb_array_length(pl.garden->'held'), 0) from placed pl where pl.id = v_plq;

  -- 10. A plant stand: potted plants only, three of them.
  ${at(9, 7)}
  ${build(PLANT_STAND)}
  ${place('STD', TILE('v_it', 9, 7, 's', 0, 0))}
  v_std := v_pl;
  ${ask('STD:none', SHOW_THING, T('v_std'))}
  ${build(POTTED_FERN)}
  ${build(POTTED_PALM)}
  perform act_perform(w, u, '${SHOW_THING}', ${T('v_std')});
  perform act_perform(w, u, '${SHOW_THING}', ${T('v_std')});
  insert into said select 'STD:held', (select string_agg(h->>'def', ',') from jsonb_array_elements(pl.garden->'held') h) from placed pl where pl.id = v_std;

  -- 11. The rest set down, and the ground read: every piece's garden and its moment set down, to every browser.
  ${build(WISTERIA_PERGOLA)}
  ${at(12, 6)}
  ${place('PERG', TILE('v_it', 12, 6, 's', 0, 0))}
  ${build(ARBOUR_BENCH)}
  ${at(12, 8)}
  ${place('ARB', TILE('v_it', 12, 8, 's', 0, 0))}
  ${build(BIRDHOUSE)}
  ${at(13, 9)}
  ${place('BIRD', TILE('v_it', 13, 9, 's', 0, 0))}
  ${build(FLOWER_CART)}
  ${at(14, 6)}
  ${place('CART', TILE('v_it', 14, 6, 's', 0, 0))}
  ${build(FOLDING_SCREEN)}
  ${at(14, 8)}
  ${place('SCR', TILE('v_it', 14, 8, 's', 0, 0))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('IDS', concat_ws(',', v_bed, v_box, v_hb, v_pt, v_top, v_hedge, v_bon, v_fig, v_plq, v_std, v_chime));
  insert into said values ('GROUND', v_g::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const part = (k: string, i = 0): string => said(k).split('|')[i] ?? '';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

/* Every piece set down through its own recipe. */
for (const k of ['BED', 'BED2', 'WB', 'HB', 'WC', 'HERB', 'TOP', 'HEDGE', 'BON', 'FIG', 'PLQ', 'STD', 'PERG', 'ARB', 'BIRD', 'CART', 'SCR']) {
  is(`${k}:ask`, 'none', `${k}: built and set down`);
}
/* 1. */
check(`a bed refuses a planting short of wildflowers: ${GARDEN_SAID.flowers}`, said('BED:short') === GARDEN_SAID.flowers, said('BED:short'));
is('BED:ok', 'none', 'and plants with them');
check('planting says the kind and the slot', said('BED:said') === GARDEN_DONE.planted.replace('{what}', 'pink').replace('{n}', '1').replace('{of}', String(BED_SLOTS)), said('BED:said'));
check(`four kinds in four slots, then full: ${gardenSaid('full', 'raised flower bed')}`, said('BED:full') === gardenSaid('full', 'raised flower bed')
  && part('BED:garden', 0) === '["pink", "white", "yellow", "blue"]' && part('BED:garden', 1) === String(BLOOM_COST * (BOX_SLOTS + 2)), said('BED:garden'));
check('picked up, the bed carries its flowers in the pack, and sets down with them', said('BED:pack') === '["pink", "white", "yellow", "blue"]' && said('BED:again') === said('BED:pack'),
  `${said('BED:pack')} / ${said('BED:again')}`);
/* 2. */
is('WB:nowall', MOUNT_SAID.noWindow, 'a window box with no wall on that side');
is('WB:solid', MOUNT_SAID.noWindow, 'or against a solid wall');
is('WB:inside', MOUNT_SAID.inside, 'or inside the house');
check('a window box goes in the middle of the row along its window', said('WB:at') === `${furnitureAnchor(WINDOW_BOX, 0, 0, 's').join(',')},s` && said('WB:at') === '1,3,s', said('WB:at'));
check(`three kinds, then full: ${gardenSaid('full', 'window box')}`, said('WB:full') === gardenSaid('full', 'window box') && said('WB:garden') === '["blue", "blue", "pink"]'
  && BOX_SLOTS === 3, said('WB:garden'));
is('WB:turn', MOUNT_SAID.turn, 'a window box with no other window round its tile does not turn');
is('CLR:ok', 'none', 'its flowers can be pulled up');
/* 3. */
is('HB:nohook', MOUNT_SAID.noHook, 'a hanging basket with no eave or post');
is('HB:ask', 'none', 'hung from an eave');
check('a wind chime hung from a lantern post on its tile, in the row along the side it faces', said('WC:at') === `${WIND_CHIME},3,e`, said('WC:at'));
/* 4. */
is('HERB:wheat', HERBS_ONLY(), 'a herb box refuses a seed that is no herb\'s');
check(`a herb box gives ${HERB_SHARE * 100}% of a planter's harvest`, part('HERB:got', 0) === String(Math.max(1, Math.floor(Number(part('HERB:got', 1)) * HERB_SHARE + 0.5))),
  said('HERB:got'));
/* 5. */
is('TOP:nosickle', GARDEN_SAID.trimTool, 'a topiary shrub is trimmed with a sickle');
check('trimmed, its shape and the moment of the trim are kept, and it says how long the shape lasts',
  part('TOP:garden', 0) === 'spiral' && part('TOP:garden', 1) === 'true' && part('TOP:garden', 2) === GARDEN_DONE.trimmed.replace('{what}', 'spiral'), said('TOP:garden'));
/* 6. */
is('HEDGE:inside', MOUNT_SAID.inside, 'a hedge not inside a building');
check('a hedge stands in the row along the side it faces', said('HEDGE:at') === '3,0,e', said('HEDGE:at'));
is('HEDGE:young', GARDEN_SAID.hedgeYoung, 'a hedge not yet full is not clipped');
is('HEDGE:ok', 'none', `and is clipped once full, ${HEDGE_FULL} days after it is set down`);
is('HEDGE:same', GARDEN_SAID.clipped, 'and not the same way twice');
is('HEDGE:garden', 'flat', 'its clip is kept');
check('it shuts the border it stands along on the island\'s way, and no other', said('HEDGE:bars') === 'true|false|false', said('HEDGE:bars'));
/* 7. */
is('BON:noknife', GARDEN_SAID.pruneTool, 'a bonsai is pruned with a carving knife');
is('BON:ok', 'none', 'by anybody, not only whoever set it down');
is('BON:rest', GARDEN_SAID.pruned, `one prune every ${PRUNE_REST} day`);
check(`${BONSAI_STEPS} steps of shaping and no more: ${GARDEN_SAID.shaped}`, said('BON:shaped') === GARDEN_SAID.shaped && said('BON:garden') === String(BONSAI_STEPS), said('BON:garden'));
/* 8. */
is('FIG:pick', FIGURE_SAID.pick, 'a carved figure with no kind chosen');
is('FIG:unseen', FIGURE_SAID.unseen, 'nor one of a kind not in the field guide');
is('FIG:seen', 'none', 'and is carved as one that is');
check('the figure is the kind chosen, of the wood it was carved from', said('FIG:item') === 'rabba|Oak', said('FIG:item'));
is('FIG:placed', 'rabba', 'and is that kind set down');
/* 9. */
is('PLQ:window', MOUNT_SAID.noWall, 'a trophy plaque not on a window');
is('PLQ:unfinished', MOUNT_SAID.unfinished, 'nor on a wall not finished');
check('a plaque on the inner face of a finished solid wall, in the row along it', said('PLQ:at') === '2,0,n', said('PLQ:at'));
is('PLQ:none', GARDEN_SAID.noTrophy, 'a plaque with no trophy in the pack');
is('PLQ:otto', GARDEN_SAID.notYours, 'somebody else\'s plaque, off their settlement');
is('PLQ:ok', 'none', 'its owner hangs a trophy');
check('the trophy hangs with its slayer\'s name, out of the pack', part('PLQ:held', 0) === 'test_trophy_ear' && part('PLQ:held', 1) === 'Hild' && part('PLQ:held', 2) === '0'
  && part('PLQ:held', 3) === GARDEN_DONE.shown.replace('{what}', 'test trophy ear'), said('PLQ:held'));
is('PLQ:full', gardenSaid('full', 'trophy plaque'), 'one trophy to a plaque');
is('PLQ:lift', GARDEN_SAID.showing, 'and a plaque with a trophy on it is not picked up');
check('taken down, the trophy comes back with its slayer\'s name', said('PLQ:back') === '1|Hild|0', said('PLQ:back'));
/* 10. */
is('STD:none', GARDEN_SAID.noPot, 'a plant stand with no potted plant in the pack');
is('STD:held', `${POTTED_FERN},${POTTED_PALM}`, 'a stand takes potted plants on its steps');

/* ---- 4. what every browser reads ------------------------------------------------------------------ */

const ids = said('IDS').split(',').map(Number);
const [bed, box, , , top, hedge, bon, fig, , std] = ids;
const seen = Game.create(163, 64);
const w = seen.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
seen.sawGround(JSON.parse(said('GROUND')) as IslandGround);
const piece = (id: number) => seen.furniture.get(id);
check('the ground read hands every browser a bed\'s flowers and the moment it was set down',
  JSON.stringify(piece(bed)?.garden?.bloom) === JSON.stringify(['pink', 'white', 'yellow', 'blue']) && typeof piece(bed)?.setAt === 'number', JSON.stringify(piece(bed)?.garden));
check('and a window box\'s, pulled up', !piece(box)?.garden?.bloom?.length, JSON.stringify(piece(box)?.garden));
check('and a topiary shrub\'s shape and last trim', piece(top)?.garden?.shape === 'spiral' && typeof piece(top)?.garden?.trimAt === 'number');
check('and a hedge\'s clip, and its moment set down', piece(hedge)?.garden?.clip === 'flat' && typeof piece(hedge)?.setAt === 'number');
check('and a bonsai\'s steps of shaping', piece(bon)?.garden?.prunes === BONSAI_STEPS);
check('and a carved figure\'s kind', piece(fig)?.garden?.figure === 'rabba');
check('and what is on a stand', JSON.stringify(piece(std)?.garden?.held?.map((h) => h.def)) === JSON.stringify([POTTED_FERN, POTTED_PALM]));
check('the hedge shuts its border to whoever walks, in the browser too, and leaves the others open',
  seen.buildings.blocksAt(0, 4, 10, 5, 10) && seen.buildings.blocksAt(0, 4, 10, 5, 10, true) && !seen.buildings.blocksAt(0, 4, 10, 4, 11) && !seen.buildings.blocksAt(0, 3, 10, 4, 10));
{
  // The browser's refusals off the same pieces, in the same words.
  seen.putBody(6.5, 4.5, 0);
  seen.inventory.items.length = 0;
  const why = (id: string, pid: number): string => ACTION_BY_ID.get(id)?.check?.({ kind: 'furniture', id: pid }, seen) ?? 'none';
  check('the browser refuses a bonsai prune without a carving knife in the island\'s words', why(PRUNE_BONSAI, bon) === GARDEN_SAID.pruneTool, why(PRUNE_BONSAI, bon));
  seen.inventory.add('carving_knife', { ql: 50 });
  check('and a bonsai shaped all its steps', why(PRUNE_BONSAI, bon) === GARDEN_SAID.shaped, why(PRUNE_BONSAI, bon));
  seen.putBody(8.5, 9.5, 0);
  check('and a bed short of wildflowers, then full', why(PLANT_BLOOM('pink'), bed) === gardenSaid('full', 'raised flower bed'), why(PLANT_BLOOM('pink'), bed));
  seen.putBody(4.5, 10.5, 0);
  seen.inventory.add('sickle', { ql: 50 });
  check('and a hedge clipped the same way twice', why(CLIP_HEDGE('flat'), hedge) === GARDEN_SAID.clipped && why(CLIP_HEDGE('round'), hedge) === 'none', why(CLIP_HEDGE('flat'), hedge));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`garden pieces — ${ok.length} of ${ok.length}`);
