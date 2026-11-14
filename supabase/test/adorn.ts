/**
 * The adornments (`adorn.ts`, `adorndefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, with real
 * recipes (the trade, the tool, the time, the bill); the jobs and every
 * sentence; the pot dishes made four at a time at a cauldron hearth; cheese's
 * ageing by the wine rule; the garden footbridge as a bridge kind. Then on the
 * island, each piece built through its own recipe and set down:
 *
 *   * a lily pond: lily roots planted to `POND_LILIES`; botanizing on a tile
 *     by it rolls the water's-edge table, and away from it the plain one;
 *   * an ivy wall panel: on a finished wall; the scrub of a worker passes its
 *     wall by; Clear the ivy gives `IVY_CUTTINGS` a wall; the browser greens
 *     its wall over `IVY_PANEL_DAYS`, a plank wall as well;
 *   * a garden obelisk: its sweet peas a colour chosen, and back to the season's;
 *   * a garden footbridge: over a one-tile ditch, and no further;
 *   * a herb spiral: a slot sown with a herb seed only, picked when ripe on
 *     the field clock, `SPIRAL_PICK` herbs, growing again;
 *   * a buoy: on water only, named as a cairn, on the map of whoever set it down;
 *   * a cauldron hearth: lit, its station; a pottage made ×`CAULDRON_SERVINGS`;
 *   * a cheese rack: cheese to `RACK_HOLDS`, its owner's, not lifted with
 *     cheese on it, taken off aged by the wine rule;
 *   * fur off a carcass labelled with its kind, and a pelt rug of that kind;
 *   * a plush: a kind chosen at the needle, tamed only;
 *   * a game table: a round of stones between two players at it, in turn,
 *     the winner named to both and tallied;
 *   * a gem lamp of its gem;
 *   * a pedigree board: a wildermon of yours and its line, two generations;
 *   * a worker nameplate on a wildermon bed, hung and taken down.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/adorn.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/adorn.mjs && node node_modules/.cache/adorn.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureDef } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { cauldronOf, POT_DISHES, RECIPE_BY_ID } from '../../src/game/recipes';
import {
  ADORN_DONE, ADORN_JOBS, ADORN_SAID, adornDone, adornSaid, HANG_PLATE, lineageLines, NAME_BUOY, PEA_PICK, PEA_SEASON, peltColours, plateWords,
  plushRefusal, pondNear, POND_LILY, RACK_PUT, RACK_TAKE, rackQl, READ_LINEAGE, SET_LINEAGE, slotRipe, SPIRAL_HERBS, SPIRAL_SOW, SPIRAL_TAKE, TAKE_PLATE, THROW_STONES, type AdornDone, type AdornSaid,
} from '../../src/game/adorn';
import {
  BUOY, CAULDRON_HEARTH, CAULDRON_SERVINGS, CHEESE_AGEING, CHEESE_RACK, GAME_TABLE, GARDEN_OBELISK, GEM_LAMP, HERB_SPIRAL, IVY_CUTTINGS, IVY_PANEL, IVY_PANEL_DAYS, LILY_POND,
  NAMEPLATE, PEDIGREE_BOARD, PELT_RUG, PLUSH, PLUSH_SAID, POND_LILIES, RACK_HOLDS, SPIRAL_PICK, STONES_GOAL, STONES_SIDES, TABLE_SEATS,
} from '../../src/game/adorndefs';
import { BRIDGES, FOOTBRIDGE_SPAN, THROWN } from '../../src/game/bridges';
import { FURNISH_SAID } from '../../src/game/furnish';
import { MOUNT_SAID, GARDEN_SAID } from '../../src/game/garden';
import { DYEABLE_ITEMS } from '../../src/game/dyes';
import { ageGain, CELLAR_AGEING } from '../../src/game/ageing';
import { GREEN_DAY, GREEN_DAYS, panelGreenDays, wallGreen } from '../../src/game/greening';
import { DAY_SECONDS } from '../../src/game/pace';
import { SPECIES } from '../../src/game/creatures';
import { STROKE_BY_ID } from '../../src/audio/strokes';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const PIECES = [LILY_POND, IVY_PANEL, GARDEN_OBELISK, HERB_SPIRAL, BUOY, CAULDRON_HEARTH, CHEESE_RACK, PELT_RUG, PLUSH, GAME_TABLE, GEM_LAMP, PEDIGREE_BOARD];
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const bill = (id: string): string => {
  const r = RECIPE_BY_ID.get(id);
  return r ? `${r.skill}|${r.tool ?? '-'}|${r.station ?? '-'}|${r.baseTime}|${r.difficulty ?? '-'}|${r.count ?? 1}|${r.inputs.map((i) => `${i.item}:${i.litres ?? i.count ?? 1}`).sort().join(',')}` : 'none';
};
const billIsle = (id: string): string => psql(`select r.skill || '|' || coalesce(r.tool, '-') || '|' || coalesce(r.station, '-') || '|' || r.base_time || '|' || coalesce(r.difficulty::text, '-') || '|' || r.count || '|'
    || (select string_agg(i.item || ':' || coalesce(i.litres::text, i.count::text), ',' order by i.item) from recipe_input i where i.recipe = r.id)
    from recipe r where r.id = '${id}'`);

/* ---- 1. the pieces, their recipes, their items and their jobs, the same on both sides ---------------- */

check(`${PIECES.length} pieces, each a piece and an item; a nameplate an item`, PIECES.every((id) => FURNITURE_BY_ID.has(id) && !!ITEM_DEFS[id]) && !!ITEM_DEFS[NAMEPLATE]);
for (const id of [...PIECES.map((p) => `make_${p}`), `make_${NAMEPLATE}`]) {
  const here = bill(id);
  const isle = billIsle(id);
  check(`${id}: a recipe with its trade, tool, time and bill, the same on both sides (${here})`, isle === here && here !== 'none', isle);
}
for (const id of PIECES) {
  const f = FURNITURE_BY_ID.get(id);
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(mount, '-'), coalesce(seats, 0), hearth::text, roses::text) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.mount ?? '-', f?.seats ?? 0, !!f?.hearth, !!(f?.climber || id === IVY_PANEL)].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
}
for (const id of [...PIECES, NAMEPLATE, 'ivy_cutting']) {
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{'), desc);
}
check('a pond by masonry with a shovel; a panel by forestry of ivy cuttings; a cauldron by blacksmithing; a pelt rug by leatherworking of fur; a plush by tailoring; a gem lamp by jewellery of a gem',
  RECIPE_BY_ID.get(`make_${LILY_POND}`)?.skill === 'masonry' && RECIPE_BY_ID.get(`make_${LILY_POND}`)?.tool === 'shovel'
  && RECIPE_BY_ID.get(`make_${IVY_PANEL}`)?.skill === 'forestry' && !!RECIPE_BY_ID.get(`make_${IVY_PANEL}`)?.inputs.some((i) => i.item === 'ivy_cutting')
  && RECIPE_BY_ID.get(`make_${CAULDRON_HEARTH}`)?.skill === 'blacksmithing'
  && RECIPE_BY_ID.get(`make_${PELT_RUG}`)?.skill === 'leatherworking' && RECIPE_BY_ID.get(`make_${PELT_RUG}`)?.inputs[0].item === 'fur' && RECIPE_BY_ID.get(`make_${PELT_RUG}`)?.material === 'pelt'
  && RECIPE_BY_ID.get(`make_${PLUSH}`)?.skill === 'tailoring'
  && RECIPE_BY_ID.get(`make_${GEM_LAMP}`)?.skill === 'jewellery' && RECIPE_BY_ID.get(`make_${GEM_LAMP}`)?.inputs[0].item === 'gem' && RECIPE_BY_ID.get(`make_${GEM_LAMP}`)?.material === 'gem');
check('a pelt rug and a gem lamp take their material on the island too', psql(`select string_agg(material, ',' order by id) from recipe where id in ('make_${GEM_LAMP}', 'make_${PELT_RUG}')`) === 'gem,pelt');
check('a plush takes a dye, on the island too', DYEABLE_ITEMS.has(PLUSH) && psql(`select count(*) from dyeable_item where id = '${PLUSH}'`) === '1');
check(`a game table seats ${TABLE_SEATS}, on the island too`, psql(`select seats_of('${GAME_TABLE}')`) === String(TABLE_SEATS));
check('an obelisk grows sweet peas by the climbers\' rule', furnitureDef(GARDEN_OBELISK).climber === 'sweet_pea');

/* The pot dishes, and the cauldron's of them. */
check('the pot dishes are a stew, a pottage, a porridge, a broth and a compote: what simmers, boils or stews over a fire',
  ['make_stew', 'make_pottage', 'make_porridge', 'make_broth', 'make_compote'].every((id) => POT_DISHES.some((r) => r.id === id)) && !POT_DISHES.some((r) => r.id === 'bake_bread'),
  POT_DISHES.map((r) => r.id).join(','));
for (const r of POT_DISHES) {
  const c = RECIPE_BY_ID.get(cauldronOf(r.id));
  check(`${cauldronOf(r.id)}: ×${CAULDRON_SERVINGS} in and out, one go's time, at a lit cauldron hearth, the same on both sides`,
    !!c && (c.count ?? 1) === (r.count ?? 1) * CAULDRON_SERVINGS && c.baseTime === r.baseTime && c.station === CAULDRON_HEARTH
    && c.inputs.every((i, k) => (i.litres ?? i.count ?? 1) === (r.inputs[k].litres ?? r.inputs[k].count ?? 1) * CAULDRON_SERVINGS)
    && billIsle(c.id) === bill(c.id), billIsle(cauldronOf(r.id)));
}
check('and the station is named on the island', psql(`select station_name('${CAULDRON_HEARTH}')`) === 'lit cauldron hearth');

/* The garden footbridge. */
check(`a garden footbridge: thrown, its own bill, ${FOOTBRIDGE_SPAN} tile of deck, no carts, on the island too`, THROWN.includes('footbridge')
  && psql(`select span || '|' || carts::text || '|' || (select string_agg(item || ':' || count, ',' order by item) from bridge_bill b where b.kind = 'footbridge') from bridge_def where id = 'footbridge'`)
    === `${FOOTBRIDGE_SPAN}|false|${[...BRIDGES.footbridge.bill].sort(([a], [b]) => (a < b ? -1 : 1)).map(([i, n]) => `${i}:${n}`).join(',')}`,
  psql(`select span || '|' || carts::text || '|' || (select string_agg(item || ':' || count, ',' order by item) from bridge_bill b where b.kind = 'footbridge') from bridge_def where id = 'footbridge'`));

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time || ':' || stamina, '|' order by id)
  from action_def where id = any (array[${ADORN_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...ADORN_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}:${a.stamina}`;
}).join('|');
check(`its ${ADORN_JOBS.length} jobs are the same rows on both sides`, jobsIsle === jobsHere, jobsIsle);
check('and every one of them is an adornment\'s job on the island', psql(`select bool_and(adorn_action(id)) from unnest(array[${ADORN_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
check('every timed job has a sound', ADORN_JOBS.every((id) => (ACTION_BY_ID.get(id)?.instant ?? false) || !!STROKE_BY_ID[id]),
  ADORN_JOBS.filter((id) => !ACTION_BY_ID.get(id)?.instant && !STROKE_BY_ID[id]).join(','));
{
  const keys = Object.keys(ADORN_SAID) as AdornSaid[];
  const isle = psql(`select string_agg(adorn_said(k, 'cheese rack', 3, 'Home'), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => adornSaid(k, { name: 'cheese rack', n: 3, what: 'Home' })).join('#'), isle);
  const done = Object.keys(ADORN_DONE) as AdornDone[];
  const dIsle = psql(`select string_agg(adorn_done(k, 'sage', 2, '5', 12), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => adornDone(k, { what: 'sage', n: 2, held: '5', of: 12 })).join('#'), dIsle);
  check('and a plush\'s refusals', psql(`select plush_said('pick') || '|' || plush_said('untamed')`) === `${PLUSH_SAID.pick}|${PLUSH_SAID.untamed}`);
  const secs = [0, DAY_SECONDS / 2, DAY_SECONDS, 3.5 * DAY_SECONDS, 19 * DAY_SECONDS, 40 * DAY_SECONDS];
  const aIsle = psql(`select string_agg(age_gain('cheese', s, false) || ':' || age_gain('cheese', s, true), ',' order by o) from unnest(array[${secs.join(',')}]::double precision[]) with ordinality u(s, o)`);
  check(`cheese ages +${CHEESE_AGEING.rate} QL a day, ×${CELLAR_AGEING} in a cellar, to +${CHEESE_AGEING.cap}, by the wine rule on both sides`,
    aIsle === secs.map((s) => `${ageGain('cheese', s, false)}:${ageGain('cheese', s, true)}`).join(',') && ageGain('cheese', 40 * DAY_SECONDS, false) === CHEESE_AGEING.cap, aIsle);
  check('and wine still ages as it did', psql(`select age_gain('wine', 86400, false)`) === String(ageGain('wine', 86400, false)));
}
check(`a panel's ivy is as green as it goes in ${IVY_PANEL_DAYS} days`, panelGreenDays(IVY_PANEL_DAYS * GREEN_DAY) === GREEN_DAYS && panelGreenDays(0) === 0
  && panelGreenDays((IVY_PANEL_DAYS / 2) * GREEN_DAY) === GREEN_DAYS / 2);

/* ---- 2. on the island ---------------------------------------------------------------------------- */

const MIRA = 'adad1a00-0000-4000-8000-0000000000a1';
const OTTO = 'adad1a00-0000-4000-8000-0000000000a2';
const FURRY = Object.values(SPECIES).find((s) => (s.butcher.fur ?? 0) > 0 && s.id === 'rabba') ?? Object.values(SPECIES).find((s) => (s.butcher.fur ?? 0) > 0)!;
const T = (id: string, more = ''): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${more})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 0, sy = 0): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string, who = 'u'): string => `perform act_perform(w, ${who}, '${action}', ${target});`;
const gives = (id: string, extra: Record<string, string> = {}): string => (RECIPE_BY_ID.get(id)?.inputs ?? []).map((i) => {
  const ex = extra[i.item] ?? (['plank', 'shaft', 'timber', 'log'].includes(i.item) ? 'Oak' : null);
  return `perform give(w, u, '${i.item}', ${i.count ?? 1}, 40${ex ? `, ${sq(ex)}` : ''});`;
}).join('\n  ');
const build = (id: string, extra: Record<string, string> = {}, more = ''): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives(`make_${id}`, extra)}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1)${more}));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;`;
};
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now(), level = 0 where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${ask(`${key}:ask`, 'place_furniture', target)}
  ${act('place_furniture', target)}
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;
const piece = (key: string, id: string, x: number, y: number, facing = 's', sx = 0, sy = 0, extra: Record<string, string> = {}): string => `${at(x, y)}
  ${build(id, extra)}
  ${place(key, TILE('v_it', x, y, facing, sx, sy))}`;
const ROUND_DAYS = 5;

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
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_a bigint; v_b bigint; v_g jsonb; v_n int;
        v_pond bigint; v_panel bigint; v_ob bigint; v_spiral bigint; v_buoy bigint; v_cauldron bigint; v_rack bigint; v_rug bigint; v_plush bigint;
        v_table bigint; v_lamp bigint; v_board bigint; v_den bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Brightwater', 191, 64, 10, 10, true) returning id into w;
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
    unnest(array['masonry', 'carpentry', 'forestry', 'blacksmithing', 'leatherworking', 'tailoring', 'jewellery', 'farming', 'cooking', 'botanizing', 'butchering']) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  -- Mira's settlement over the yard; water to the east.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 12, 8, 1, u);
  perform deed_ranks_seed(w, u);
  for v_a in 40..44 loop for v_b in 30..34 loop perform land_set_height(w, v_a::int, v_b::int, -30); end loop; end loop;

  -- 1. A lily pond: lilies to its room; botanizing beside it rolls the water's edge, away from it not.
  ${piece('POND', LILY_POND, 14, 14)}
  v_pond := v_pl;
  ${ask('POND:noroot', POND_LILY, T('v_pond'))}
  perform give(w, u, 'lily_root', ${POND_LILIES + 1}, 40);
  ${Array.from({ length: POND_LILIES }, () => act(POND_LILY, T('v_pond'))).join('\n  ')}
  insert into said select 'POND:planted', ${lastSaid()} || '|' || (pl.garden->>'lilies') || '|' || ${count('lily_root')}::text from placed pl where pl.id = v_pond;
  ${ask('POND:full', POND_LILY, T('v_pond'))}
  insert into said values ('POND:near', pond_near(w, 15, 14)::text || '|' || pond_near(w, 14, 14)::text || '|' || pond_near(w, 16, 16)::text);
  ${at(15, 14)}
  delete from item where world_id = w and holder_uid = u and def in ('lotus_seed', 'lily_root', 'wemp_seed');
  perform pg_temp.dice('0.5,0.5,0.7');
  ${act('botanize', "jsonb_build_object('kind', 'tile', 'x', 15, 'y', 14)")}
  perform pg_temp.nodice();
  insert into said values ('POND:botanized', (${count('lotus_seed')} > 0)::text || '|' || (${count('wemp_seed')} > 0)::text);
  ${at(20, 20)}
  delete from item where world_id = w and holder_uid = u and def in ('lotus_seed', 'wemp_seed');
  perform pg_temp.dice('0.5,0.5,0.7');
  ${act('botanize', "jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20)")}
  perform pg_temp.nodice();
  insert into said values ('POND:inland', (${count('lotus_seed')} > 0)::text || '|' || (${count('wemp_seed')} > 0)::text);
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_POND', v_g::text);
  insert into said values ('POND:id', v_pond::text);

  -- 2. An ivy wall panel on a stone garden wall: the scrub passes its wall by; Clear the ivy gives cuttings.
  insert into wall (world_id, level, dir, x, y, type, material, needed, total, planned_by) values
    (w, 0, 'h', 13, 20, 'solid', 'stone_brick', '{"stone_brick":0}', '{"stone_brick":24}', u),
    (w, 0, 'h', 15, 20, 'solid', 'stone_brick', '{"stone_brick":0}', '{"stone_brick":24}', u),
    (w, 0, 'h', 17, 20, 'solid', 'plank', '{"plank":0}', '{"plank":24}', u);
  ${at(13, 20)}
  ${build(IVY_PANEL)}
  ${ask('PANEL:nowall', 'place_furniture', TILE('v_it', 12, 20, 'n'))}
  ${place('PANEL', TILE('v_it', 13, 20, 'n'))}
  v_panel := v_pl;
  update world set green_from = now() - interval '30 days' where id = w;
  update green_since set since = now() - interval '30 days' where world_id = w and thing = 'wall';
  insert into said values ('PANEL:paneled', (select wall_paneled(w, wl) from wall wl where wl.world_id = w and wl.x = 13 and wl.y = 20 and wl.dir = 'h')::text
    || '|' || (select wall_paneled(w, wl) from wall wl where wl.world_id = w and wl.x = 15 and wl.y = 20 and wl.dir = 'h')::text);
  insert into said values ('PANEL:green', green_on_tile(w, u, 13, 20)::text || '|' || green_on_tile(w, u, 15, 20)::text);
  perform give(w, u, 'sickle', 1, 50);
  ${at(15, 20)}
  delete from item where world_id = w and holder_uid = u and def = 'ivy_cutting';
  ${act('clear_ivy', "jsonb_build_object('kind', 'tile', 'x', 15, 'y', 20, 'side', 'n')")}
  insert into said values ('PANEL:cuttings', ${count('ivy_cutting')}::text);
  ${at(17, 20)}
  ${build(IVY_PANEL)}
  ${place('PANEL2', TILE('v_it', 17, 20, 'n'))}
  v_g := rpc_ground(w, 40, true);
  insert into said values ('GROUND_PANEL', v_g::text);

  -- 3. A garden obelisk: its sweet peas a colour chosen, then the season's.
  ${piece('OBELISK', GARDEN_OBELISK, 18, 14)}
  v_ob := v_pl;
  ${act(PEA_PICK('red'), T('v_ob'))}
  insert into said select 'OB:red', ${lastSaid()} || '|' || (pl.garden->>'pea') from placed pl where pl.id = v_ob;
  ${ask('OB:again', PEA_PICK('red'), T('v_ob'))}
  ${act(PEA_SEASON, T('v_ob'))}
  insert into said select 'OB:season', ${lastSaid()} || '|' || coalesce(pl.garden->>'pea', '-') from placed pl where pl.id = v_ob;
  ${ask('OB:season2', PEA_SEASON, T('v_ob'))}

  -- 4. A garden footbridge over a ditch a tile wide, and not over two.
  for v_a in 29..34 loop for v_b in 9..12 loop perform land_set_height(w, v_a::int, v_b::int, case when v_a in (31, 32) and v_b in (10, 11) then 0 else 20 end); end loop; end loop;
  insert into said values ('BRIDGE:one', coalesce(bridge_reason(w, u, 'footbridge', 30, 10, 32, 10, 1, 1, null, null), 'none'));
  insert into said values ('BRIDGE:two', coalesce(bridge_reason(w, u, 'footbridge', 30, 10, 33, 10, 1, 1, null, null), 'none'));
  insert into said values ('BRIDGE:wide', coalesce(bridge_reason(w, u, 'footbridge', 30, 10, 32, 10, 2, 1, null, null), 'none'));

  -- 5. A herb spiral: a slot sown with a herb seed only; picked ripe; growing again.
  ${piece('SPIRAL', HERB_SPIRAL, 16, 16)}
  v_spiral := v_pl;
  delete from item where world_id = w and holder_uid = u and def = any (spiral_seeds());
  ${ask('SPIRAL:noslot', SPIRAL_SOW, T('v_spiral'))}
  ${ask('SPIRAL:noseed', SPIRAL_SOW, T('v_spiral', ", 'slot', 0"))}
  v_a := give(w, u, 'plank', 1, 30, 'Oak');
  ${ask('SPIRAL:plank', SPIRAL_SOW, T('v_spiral', ", 'slot', 0, 'itemUid', v_a"))}
  v_a := give(w, u, '${SPIRAL_HERBS[0].seed}', 2, 30);
  ${act(SPIRAL_SOW, T('v_spiral', ", 'slot', 0, 'itemUid', v_a"))}
  insert into said select 'SPIRAL:sown', ${lastSaid()} || '|' || (pl.garden->'herbs'->0->>0) || '|' || jsonb_array_length(pl.garden->'herbs')::text from placed pl where pl.id = v_spiral;
  ${ask('SPIRAL:again', SPIRAL_SOW, T('v_spiral', ", 'slot', 0, 'itemUid', v_a"))}
  ${ask('SPIRAL:green', SPIRAL_TAKE(0), T('v_spiral'))}
  ${ask('SPIRAL:empty', SPIRAL_TAKE(1), T('v_spiral'))}
  update placed set garden = jsonb_set(garden, '{herbs,0,1}', to_jsonb(extract(epoch from now() - interval '400 days')::double precision)) where id = v_spiral;
  delete from item where world_id = w and holder_uid = u and def = '${SPIRAL_HERBS[0].produce}';
  ${act(SPIRAL_TAKE(0), T('v_spiral'))}
  insert into said select 'SPIRAL:picked', ${count(SPIRAL_HERBS[0].produce)}::text || '|' || (extract(epoch from now()) - (pl.garden->'herbs'->0->>1)::double precision < 60)::text
    from placed pl where pl.id = v_spiral;
  insert into said values ('SPIRAL:said', ${lastSaid()});
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_SPIRAL', v_g::text);
  insert into said values ('SPIRAL:id', v_spiral::text);

  -- 6. A buoy: on water only; named; on its maker's map.
  ${at(37, 31)}
  ${build(BUOY)}
  ${ask('BUOY:land', 'place_furniture', TILE('v_it', 36, 31, 's'))}
  ${at(40, 31)}
  ${place('BUOY', TILE('v_it', 41, 31, 's'))}
  v_buoy := v_pl;
  ${act(NAME_BUOY, T('v_buoy', ", 'name', 'Bell Rock'"))}
  insert into said select 'BUOY:named', ${lastSaid()} || '|' || pl.engraving from placed pl where pl.id = v_buoy;
  ${ask('BUOY:same', NAME_BUOY, T('v_buoy', ", 'name', 'Bell Rock'"))}
  insert into said values ('BUOY:map', (select string_agg(c->>'name', ',') from jsonb_array_elements(cairns_of(w, u)) c) || '|' || coalesce((select string_agg(c->>'name', ',') from jsonb_array_elements(cairns_of(w, o)) c), '-'));
  update player set x = 40.5, y = 31.5 where world_id = w and uid = o;
  ${ask('BUOY:otto', NAME_BUOY, T('v_buoy', ", 'name', 'Mine'"), 'o')}

  -- 7. A cauldron hearth: lit, its station; a pottage ×${CAULDRON_SERVINGS}.
  ${piece('CAULDRON', CAULDRON_HEARTH, 20, 14, 's', 1, 1)}
  v_cauldron := v_pl;
  insert into said values ('CAULDRON:unlit', at_station(w, u, '${CAULDRON_HEARTH}')::text);
  update placed set lit = true, fuel = 3600, since = now() where id = v_cauldron;
  insert into said values ('CAULDRON:lit', at_station(w, u, '${CAULDRON_HEARTH}')::text || '|' || at_station(w, u, 'campfire')::text);
  delete from item where world_id = w and holder_uid = u and def = 'pottage';
  ${gives(cauldronOf('make_pottage'))}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, '${cauldronOf('make_pottage')}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'cabbage' limit 1)));
  perform pg_temp.nodice();
  insert into said values ('CAULDRON:pottage', ${count('pottage')}::text || '|' || ${count('cabbage')}::text);

  -- 8. A cheese rack: cheese to its room; its owner's; not lifted with cheese on it; aged by the wine rule.
  ${piece('RACK', CHEESE_RACK, 12, 16)}
  v_rack := v_pl;
  ${ask('RACK:none', RACK_PUT, T('v_rack'))}
  v_a := give(w, u, 'plank', 1, 30, 'Oak');
  ${ask('RACK:plank', RACK_PUT, T('v_rack', ", 'itemUid', v_a"))}
  v_a := give(w, u, 'cheese', ${RACK_HOLDS + 2}, 40);
  ${act(RACK_PUT, T('v_rack', ", 'itemUid', v_a"))}
  insert into said values ('RACK:put', ${lastSaid()} || '|' || ${count('cheese')}::text);
  ${ask('RACK:full', RACK_PUT, T('v_rack', ", 'itemUid', v_a"))}
  ${ask('RACK:lift', 'pick_up_furniture', T('v_rack'))}
  update player set x = 12.5, y = 16.5 where world_id = w and uid = o;
  ${ask('RACK:otto', RACK_TAKE, T('v_rack'), 'o')}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_RACK', v_g::text);
  insert into said values ('RACK:id', v_rack::text);
  update placed set garden = jsonb_set(garden, '{cheese}', (select jsonb_agg(jsonb_build_array(c->0, (c->>1)::double precision - ${ROUND_DAYS} * day_seconds())) from jsonb_array_elements(garden->'cheese') c)) where id = v_rack;
  delete from item where world_id = w and holder_uid = u and def = 'cheese';
  ${act(RACK_TAKE, T('v_rack'))}
  insert into said select 'RACK:took', ${lastSaid()} || '|' || ${count('cheese')}::text || '|' || (select string_agg(distinct round(ql::numeric, 1)::text, ',') from item where world_id = w and holder_uid = u and def = 'cheese')
    || '|' || coalesce(pl.garden::text, '-') from placed pl where pl.id = v_rack;
  ${ask('RACK:empty', RACK_TAKE, T('v_rack'))}

  -- 9. Fur off a carcass, labelled with its kind; a pelt rug of that kind.
  ${at(22, 22)}
  perform give(w, u, 'butchering_knife', 1, 90);
  delete from item where world_id = w and holder_uid = u and def = 'fur';
  perform drop_on_ground(w, 22, 22, 'corpse', 60, '${FURRY.name}');
  perform pg_temp.dice('0.01');
  ${act('butcher', "jsonb_build_object('kind', 'ground', 'x', 22, 'y', 22)")}
  perform pg_temp.nodice();
  insert into said values ('FUR:labelled', coalesce((select string_agg(distinct coalesce(extra, '-'), ',') from item where world_id = w and holder_uid = u and def = 'fur'), 'none'));
  delete from item where world_id = w and holder_uid = u and def = 'fur';
  ${piece('RUG', PELT_RUG, 22, 24, 's', 0, 0, { fur: FURRY.name })}
  v_rug := v_pl;
  insert into said select 'RUG:kind', coalesce(pl.material, '-') from placed pl where pl.id = v_rug;

  -- 10. A plush: a kind chosen at the needle, and one tamed.
  ${at(24, 16)}
  perform give(w, u, 'needle', 1, 50);
  ${gives(`make_${PLUSH}`)}
  ${ask('PLUSH:nokind', `make_${PLUSH}`, "jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'cloth' limit 1))")}
  ${ask('PLUSH:untamed', `make_${PLUSH}`, `jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'cloth' limit 1), 'species', '${FURRY.id}')`)}
  insert into guide (world_id, uid, species, tamed) values (w, u, '${FURRY.id}', true) on conflict (world_id, uid, species) do update set tamed = true;
  ${ask('PLUSH:tamed', `make_${PLUSH}`, `jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'cloth' limit 1), 'species', '${FURRY.id}')`)}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${PLUSH}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'cloth' limit 1), 'species', '${FURRY.id}'));
  perform pg_temp.nodice();
  select id into v_it from item where world_id = w and holder_uid = u and def = '${PLUSH}' order by id desc limit 1;
  insert into said select 'PLUSH:made', coalesce(i.garden->>'plush', '-') from item i where i.id = v_it;
  ${place('PLUSH', TILE('v_it', 24, 16, 's'))}
  v_plush := v_pl;
  insert into said select 'PLUSH:placed', coalesce(pl.garden->>'plush', '-') from placed pl where pl.id = v_plush;

  -- 11. A game table: a round of stones between two at it, in turn, the winner tallied.
  ${piece('TABLE', GAME_TABLE, 26, 18, 's', 1, 1)}
  v_table := v_pl;
  update player set x = 50.5, y = 50.5 where world_id = w and uid = o;
  ${ask('TABLE:alone', THROW_STONES, T('v_table'))}
  update player set x = 27.5, y = 18.5 where world_id = w and uid = o;
  perform pg_temp.dice('0.99');
  ${act(THROW_STONES, T('v_table'))}
  insert into said values ('TABLE:first', ${lastSaid()} || '|' || coalesce(${lastSaid('o')}, '-'));
  ${ask('TABLE:twice', THROW_STONES, T('v_table'))}
  ${act(THROW_STONES, T('v_table'), 'o')}
  insert into said values ('TABLE:otto', ${lastSaid()} || '|' || ${lastSaid('o')});
  ${act(THROW_STONES, T('v_table'))}
  perform pg_temp.nodice();
  insert into said select 'TABLE:won', ${lastSaid()} || '|' || ${lastSaid('o')} || '|' || coalesce(pl.garden->>'round', '-') || '|' || (pl.garden->'wins')::text from placed pl where pl.id = v_table;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_TABLE', v_g::text);
  insert into said values ('TABLE:id', v_table::text);

  -- 12. A gem lamp of its gem.
  ${piece('LAMP', GEM_LAMP, 28, 14, 's', 0, 0, { gem: 'Ruby' })}
  v_lamp := v_pl;
  insert into said select 'LAMP:gem', coalesce(pl.material, '-') from placed pl where pl.id = v_lamp;

  -- 13. A pedigree board: a wildermon of Mira's and its line; not Otto's; not by Otto.
  insert into creature (world_id, id, species, name, mode, keeper, from_x, from_y, to_x, to_y, health, sex, pedigree) values
    (w, 9101, '${FURRY.id}', 'Briar', 'stored', u, 30, 30, 30, 30, 10, 'female', '{"dam": {"id": 9104, "name": "Nell"}, "sire": {"id": 9105, "name": "Rook"}, "from": {}}'),
    (w, 9102, '${FURRY.id}', 'Thistle', 'stored', u, 30, 30, 30, 30, 10, 'male', null),
    (w, 9100, '${FURRY.id}', 'Snow', 'stored', u, 30, 30, 30, 30, 10, 'female', '{"dam": {"id": 9101, "name": "Briar"}, "sire": {"id": 9103, "name": "Horn"}, "from": {}}'),
    (w, 9106, '${FURRY.id}', 'Pip', 'stored', o, 30, 30, 30, 30, 10, 'male', null);
  ${piece('BOARD', PEDIGREE_BOARD, 26, 22)}
  v_board := v_pl;
  ${ask('BOARD:none', SET_LINEAGE, T('v_board'))}
  ${ask('BOARD:otto', SET_LINEAGE, T('v_board', ", 'creature', 9106"))}
  ${ask('BOARD:unread', READ_LINEAGE, T('v_board'))}
  ${act(SET_LINEAGE, T('v_board', ", 'creature', 9100"))}
  insert into said select 'BOARD:set', ${lastSaid()} || '|' || (pl.garden->'tree')::text from placed pl where pl.id = v_board;
  ${ask('BOARD:same', SET_LINEAGE, T('v_board', ", 'creature', 9100"))}
  update player set x = 26.5, y = 22.5 where world_id = w and uid = o;
  ${ask('BOARD:byotto', SET_LINEAGE, T('v_board', ", 'creature', 9106"), 'o')}
  ${act(READ_LINEAGE, T('v_board'))}
  insert into said values ('BOARD:read', (select string_agg(t, '#' order by n) from (select e.text t, e.n from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 4) x));
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_BOARD', v_g::text);
  insert into said values ('BOARD:id', v_board::text);

  -- 14. A worker nameplate on a wildermon bed.
  ${piece('DEN', 'den_small', 28, 22)}
  v_den := v_pl;
  ${ask('DEN:noplate', HANG_PLATE, T('v_den'))}
  ${ask('DEN:none', TAKE_PLATE, T('v_den'))}
  delete from item where world_id = w and holder_uid = u and def = '${NAMEPLATE}';
  ${build(NAMEPLATE)}
  ${act(HANG_PLATE, T('v_den'))}
  insert into said select 'DEN:hung', ${lastSaid()} || '|' || (pl.garden->>'plate' is not null)::text || '|' || ${count(NAMEPLATE)}::text from placed pl where pl.id = v_den;
  perform give(w, u, '${NAMEPLATE}', 1, 30);
  ${ask('DEN:again', HANG_PLATE, T('v_den'))}
  update player set x = 28.5, y = 22.5 where world_id = w and uid = o;
  ${ask('DEN:otto', TAKE_PLATE, T('v_den'), 'o')}
  update placed set sleeper = 9100 where id = v_den;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_DEN', v_g::text);
  insert into said values ('DEN:id', v_den::text);
  delete from item where world_id = w and holder_uid = u and def = '${NAMEPLATE}';
  ${act(TAKE_PLATE, T('v_den'))}
  insert into said select 'DEN:taken', ${lastSaid()} || '|' || coalesce(pl.garden::text, '-') || '|' || ${count(NAMEPLATE)}::text from placed pl where pl.id = v_den;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

for (const k of ['POND', 'PANEL', 'PANEL2', 'OBELISK', 'SPIRAL', 'BUOY', 'CAULDRON', 'RACK', 'RUG', 'PLUSH', 'TABLE', 'LAMP', 'BOARD', 'DEN']) is(`${k}:ask`, 'none', `${k}: built and set down`);
/* 1. */
is('POND:noroot', ADORN_SAID.noLily, 'a pond takes a lily root');
is('POND:planted', `${adornDone('lily', { held: POND_LILIES, of: POND_LILIES })}|${POND_LILIES}|1`, `lilies planted to its room, ${POND_LILIES}`);
is('POND:full', ADORN_SAID.pondFull, 'and no more');
is('POND:near', 'true|true|false', 'by a pond, on its tile or beside it, is the water\'s edge; two tiles off not');
is('POND:botanized', 'true|false', 'botanizing beside a pond rolls the water\'s-edge table: a roll of 0.7 a lotus seed');
is('POND:inland', 'false|true', 'and away from it the plain one: the same roll a wemp seed');
/* 2. */
is('PANEL:nowall', MOUNT_SAID.noWall, 'a panel on a wall only');
is('PANEL:paneled', 'true|false', 'hung on its wall, and not the next');
is('PANEL:green', `0|${GREEN_DAYS}`, 'a worker\'s scrub passes the paneled wall by, and not the next');
is('PANEL:cuttings', String(IVY_CUTTINGS), `Clear the ivy gives ${IVY_CUTTINGS} ivy cutting a wall`);
is('PANEL2:ask', 'none', 'a panel on a plank wall too');
/* 3. */
is('OB:red', `${adornDone('pea', { what: 'red' })}|red`, 'sweet peas chosen red');
is('OB:again', adornSaid('samePea', { what: 'red' }), 'not the same again');
is('OB:season', `${adornDone('peaSeason')}|-`, 'back to the season\'s');
is('OB:season2', adornSaid('samePea', { what: 'by season' }), 'and not twice');
/* 4. */
is('BRIDGE:one', 'none', 'a garden footbridge over a ditch a tile wide');
is('BRIDGE:two', `${BRIDGES.footbridge.name}: max span ${FOOTBRIDGE_SPAN} tiles; this is 2.`, 'and not over two');
is('BRIDGE:wide', `${BRIDGES.footbridge.name}: 1 lane only.`, 'one lane');
/* 5. */
is('SPIRAL:noslot', ADORN_SAID.noSlot, 'a spiral is sown a slot at a time');
is('SPIRAL:noseed', ADORN_SAID.noSeed, 'with a herb seed');
is('SPIRAL:plank', ADORN_SAID.notSeed, 'and nothing else');
is('SPIRAL:sown', `${adornDone('sown', { what: SPIRAL_HERBS[0].name.toLowerCase(), n: 1 })}|${SPIRAL_HERBS[0].id}|4`, 'sown, its slots kept');
is('SPIRAL:again', adornSaid('slotSown', { n: 1 }), 'not over what is sown');
is('SPIRAL:green', adornSaid('notRipe', { n: 1 }), 'not picked green');
is('SPIRAL:empty', adornSaid('slotEmpty', { n: 2 }), 'nor where nothing is sown');
is('SPIRAL:picked', `${SPIRAL_PICK}|true`, `picked ripe, ${SPIRAL_PICK} herbs, and growing again from now`);
check('and says so', said('SPIRAL:said').startsWith(`Picked: ${SPIRAL_HERBS[0].name.toLowerCase()} ×${SPIRAL_PICK}, QL `) && said('SPIRAL:said').endsWith('Slot 1: growing again.'), said('SPIRAL:said'));
/* 6. */
is('BUOY:land', ADORN_SAID.notWater, 'a buoy not on land');
is('BUOY:named', `${adornDone('named', { what: 'Bell Rock' })}|Bell Rock`, 'named');
is('BUOY:same', FURNISH_SAID.sameName, 'not the same again');
is('BUOY:map', 'Bell Rock|-', 'on the map of whoever set it down, off any settlement, and nobody else\'s');
is('BUOY:otto', FURNISH_SAID.cairnNotYours, 'named by whoever set it down, off a settlement');
/* 7. */
is('CAULDRON:unlit', 'false', 'a cauldron hearth unlit is no station');
is('CAULDRON:lit', 'true|true', 'lit, it is its own and a fire');
is('CAULDRON:pottage', `${(RECIPE_BY_ID.get('make_pottage')?.count ?? 1) * CAULDRON_SERVINGS}|0`, `a pottage ×${CAULDRON_SERVINGS}, its inputs ×${CAULDRON_SERVINGS} spent`);
/* 8. */
is('RACK:none', ADORN_SAID.noCheese, 'a rack with no cheese in the pack');
is('RACK:plank', ADORN_SAID.notCheese, 'cheese only');
is('RACK:put', `${adornDone('racked', { n: RACK_HOLDS, held: RACK_HOLDS, of: RACK_HOLDS })}|2`, `cheese to its room, ${RACK_HOLDS}, the rest left`);
is('RACK:full', ADORN_SAID.rackFull, 'then full');
is('RACK:lift', GARDEN_SAID.showing, 'not lifted with cheese on it');
is('RACK:otto', adornSaid('notYours', { name: 'cheese rack' }), 'not somebody else\'s');
{
  const ql = rackQl(40, ROUND_DAYS * DAY_SECONDS, false).toFixed(1);
  is('RACK:took', `${adornDone('unracked', { n: RACK_HOLDS, what: Array(RACK_HOLDS).fill(ql).join(', ') })}|${RACK_HOLDS}|${ql}|-`, `taken off ${ROUND_DAYS} days on, aged by the wine rule`);
}
is('RACK:empty', ADORN_SAID.rackEmpty, 'and none left on it');
/* 9. */
is('FUR:labelled', FURRY.name, 'fur off a carcass carries the kind it came off');
is('RUG:kind', FURRY.name, 'and a pelt rug of it is of that kind');
check('whose colours are its kind\'s coat', JSON.stringify(peltColours(FURRY.name)) === JSON.stringify(FURRY.variants[0]));
/* 10. */
is('PLUSH:nokind', PLUSH_SAID.pick, 'a plush is of a kind chosen');
is('PLUSH:untamed', PLUSH_SAID.untamed, 'one tamed');
is('PLUSH:tamed', 'none', 'tamed, sewn');
is('PLUSH:made', FURRY.id, 'its kind kept on it');
is('PLUSH:placed', FURRY.id, 'and set down with it');
check('the browser refuses an untamed kind in the island\'s words', plushRefusal(() => false, FURRY.id) === PLUSH_SAID.untamed && plushRefusal(() => true, undefined) === PLUSH_SAID.pick);
/* 11. */
is('TABLE:alone', ADORN_SAID.noOpponent, 'stones want a second player at the table');
{
  const top = STONES_SIDES; // the dice at 0.99: the top of a throw
  is('TABLE:first', `${adornDone('threw', { what: 'Mira', n: top, held: top, of: STONES_GOAL })}|-`, 'a first throw, said');
  is('TABLE:twice', adornSaid('notTurn', { what: 'another player' }), 'not twice in a row');
  is('TABLE:otto', `${adornDone('threw', { what: 'Otto', n: top, held: top, of: STONES_GOAL })}|${adornDone('threw', { what: 'Otto', n: top, held: top, of: STONES_GOAL })}`, 'the other throws, said to both');
  const won = adornDone('won', { what: 'Mira', n: 2 * top, held: top, of: 1 });
  is('TABLE:won', `${won}|${won}|-|[["${MIRA}", "Mira", 1]]`, `first to ${STONES_GOAL} wins, named to both, tallied, the round over`);
}
/* 12. */
is('LAMP:gem', 'Ruby', 'a gem lamp of its gem');
/* 13. */
is('BOARD:none', ADORN_SAID.pickCreature, 'a board shows a wildermon chosen');
is('BOARD:otto', ADORN_SAID.notKept, 'one of yours');
is('BOARD:unread', ADORN_SAID.noLine, 'nothing to read before');
check('its line, two generations: what stands on the island under its own name, and what does not by name alone',
  said('BOARD:set').startsWith(adornDone('lineage', { what: `Snow (${FURRY.name.toLowerCase()})` }))
  && /"d": \{"d": \{"k": "[a-z]+", "n": "Nell"\}/.test(said('BOARD:set')) && /"s": \{"k": "[a-z]+", "n": "Horn"\}/.test(said('BOARD:set')), said('BOARD:set'));
is('BOARD:same', adornSaid('sameCreature', { what: 'Snow' }), 'not the same again');
is('BOARD:byotto', ADORN_SAID.boardNotYours, 'chosen by whoever set it down');
/* 14. */
is('DEN:noplate', ADORN_SAID.noPlate, 'a bed takes a nameplate');
is('DEN:none', ADORN_SAID.noPlateOn, 'nothing to take down');
is('DEN:hung', `${adornDone('hung')}|true|0`, 'hung');
is('DEN:again', ADORN_SAID.plateOn, 'one to a bed');
is('DEN:otto', adornSaid('notYours', { name: 'small wildermon bed' }), 'its owner\'s');
is('DEN:taken', `${adornDone('unhung')}|-|1`, 'taken down, back in the pack');

/* ---- 3. what every browser reads, and says the same of ------------------------------------------------- */

const looker = (ground: string): Game => {
  const g = Game.create(191, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(JSON.parse(ground) as IslandGround);
  return g;
};
{
  const seen = looker(said('GROUND_POND'));
  const f = seen.furniture.get(Number(said('POND:id')));
  check('the browser reads a pond\'s lilies', f?.adorn?.lilies === POND_LILIES, JSON.stringify(f?.adorn));
  check('and botanizes by it as at the water\'s edge', pondNear(seen, 15, 14) && pondNear(seen, 14, 14) && !pondNear(seen, 16, 16));
  seen.putBody(14.5, 14.5, 0);
  seen.inventory.add('lily_root', { ql: 30 });
  check('and refuses more in the island\'s words', ACTION_BY_ID.get(POND_LILY)?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === ADORN_SAID.pondFull);
}
{
  const seen = looker(said('GROUND_PANEL'));
  const walls = [...seen.buildings.walls.values()];
  const stone = walls.find((w) => w.x === 13 && w.y === 20), plank = walls.find((w) => w.x === 17 && w.y === 20), bare = walls.find((w) => w.x === 15 && w.y === 20);
  const now = Date.now() / 1000;
  const panel = [...seen.furniture.values()].find((p) => p.kind === IVY_PANEL && p.x === 13);
  check('the browser reads a panel\'s moment', panel?.setAt !== undefined, JSON.stringify(panel));
  const p2 = [...seen.furniture.values()].find((p) => p.kind === IVY_PANEL && p.x === 17);
  const plankAt = (days: number): number | null => { if (p2) p2.setAt = now - days * GREEN_DAY; return plank ? wallGreen(seen, plank, now) : null; };
  check(`and greens its wall by the ivy look, a plank one as well: bare set down, half in ${IVY_PANEL_DAYS / 2} days, full in ${IVY_PANEL_DAYS}; a stone one its own or the panel's, the more; a bare cleared one none`,
    plankAt(0) === 0 && plankAt(IVY_PANEL_DAYS / 2) === GREEN_DAYS / 2 && plankAt(IVY_PANEL_DAYS) === GREEN_DAYS && !!stone && wallGreen(seen, stone, now) === GREEN_DAYS
    && !!bare && wallGreen(seen, bare, now) === 0,
    `${stone && wallGreen(seen, stone, now)} ${plank && wallGreen(seen, plank, now)} ${bare && wallGreen(seen, bare, now)}`);
}
{
  const seen = looker(said('GROUND_SPIRAL'));
  const f = seen.furniture.get(Number(said('SPIRAL:id')));
  const h = f?.adorn?.herbs?.[0];
  check('the browser reads a spiral\'s slots', !!h && h[0] === SPIRAL_HERBS[0].id && f?.adorn?.herbs?.length === 4 && f.adorn.herbs[1] === null, JSON.stringify(f?.adorn));
  check('and its slot, sown again, not ripe; one sown long ago ripe, by the field clock', !!h && !slotRipe(SPIRAL_HERBS[0], h[1], h[1] + 60) && slotRipe(SPIRAL_HERBS[0], h[1] - 400 * DAY_SECONDS, h[1]));
  seen.putBody(16.5, 16.5, 0);
  seen.wallClock = () => (h?.[1] ?? 0) + 60;
  check('and refuses it in the island\'s words', ACTION_BY_ID.get(SPIRAL_TAKE(0))?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === adornSaid('notRipe', { n: 1 }));
}
{
  const seen = looker(said('GROUND_RACK'));
  const f = seen.furniture.get(Number(said('RACK:id')));
  check('the browser reads a rack\'s cheese', f?.adorn?.cheese?.length === RACK_HOLDS && f.adorn.cheese.every(([ql]) => ql === 40), JSON.stringify(f?.adorn));
  seen.putBody(12.5, 16.5, 0);
  seen.inventory.items.length = 0;
  const c = seen.inventory.add('cheese', { ql: 30 });
  check('and refuses more in the island\'s words', ACTION_BY_ID.get(RACK_PUT)?.check?.({ kind: 'furniture', id: f?.id, itemUid: c.uid } as never, seen) === ADORN_SAID.rackFull);
}
{
  const seen = looker(said('GROUND_TABLE'));
  const f = seen.furniture.get(Number(said('TABLE:id')));
  check('the browser reads a table\'s tally', JSON.stringify(f?.adorn?.wins) === JSON.stringify([[MIRA, 'Mira', 1]]) && !f?.adorn?.round, JSON.stringify(f?.adorn));
}
{
  const seen = looker(said('GROUND_BOARD'));
  const f = seen.furniture.get(Number(said('BOARD:id')));
  const lines = lineageLines(f?.adorn?.tree);
  check('the browser reads a board\'s line and says it as the island does', lines.join('#') === said('BOARD:read'), `${lines.join('#')} / ${said('BOARD:read')}`);
  seen.putBody(26.5, 22.5, 0);
  check('and refuses the same again in the island\'s words', ACTION_BY_ID.get(SET_LINEAGE)?.check?.({ kind: 'furniture', id: f?.id, creature: 9100 } as never, seen) === adornSaid('sameCreature', { what: 'Snow' }));
}
{
  const seen = looker(said('GROUND_DEN'));
  const f = seen.furniture.get(Number(said('DEN:id')));
  check('the browser reads a bed\'s nameplate and its sleeper', f?.adorn?.plate !== undefined && f.sleeper === 9100, JSON.stringify(f?.adorn));
  seen.creatures.list.set(9100, { id: 9100, species: FURRY.id, name: 'Snow', skills: {} } as never);
  const words = plateWords(seen.creatures.list.get(9100));
  check('and names its worker: name, kind and level', words.startsWith('Snow · ') && /level \d+$/.test(words), words);
}
{
  // A buoy where the browser places it.
  const g = Game.create(191, 64);
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.putBody(6.5, 6.5, 0);
  check('the browser refuses a buoy on land in the island\'s words', g.furniturePlaceReason(BUOY, 6, 6, 0, 0, 's') === ADORN_SAID.notWater);
  check('and a footbridge over two tiles', g.bridgeReason('footbridge', 4, 6, 7, 6) === `${BRIDGES.footbridge.name}: max span ${FOOTBRIDGE_SPAN} tiles; this is 2.`);
}
check(`a cheese's QL on a rack is the wine rule's: +${CHEESE_AGEING.rate} a day, to +${CHEESE_AGEING.cap}`, rackQl(40, DAY_SECONDS, false) === 40 + CHEESE_AGEING.rate
  && rackQl(40, 100 * DAY_SECONDS, false) === 40 + CHEESE_AGEING.cap && rackQl(95, 100 * DAY_SECONDS, false) === 100);

finish('adorn');
