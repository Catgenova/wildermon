/**
 * The obsidian pieces (`obsidian.ts`, `obsidiandefs.ts`), on both sides.
 *
 * Every piece, its recipe and its item, the same on both sides, each made of
 * obsidian by stonecutting, glassblowing, masonry or jewellery; the jobs and
 * every sentence. Then on the island, each piece built through its own recipe
 * and set down:
 *
 *   * a black glass lantern: `LANTERN_CANDLES` put in, burning a candle's
 *     time in a lantern of its QL, lit off a flame and put out, lighting
 *     `BLACK_LANTERN_REACH` tiles;
 *   * an obsidian throne: sat in by its settlement's founder and nobody else,
 *     a citizen included; Examine reads the settlement's level, citizens and
 *     workers as they are now;
 *   * an obsidian obelisk: named as a cairn, by whoever may;
 *   * a dragon-glass fountain: a fountain to every rule, a well drawing a
 *     tiered fountain's water, and the foot of an aqueduct;
 *   * a shard garden: set down;
 *   * an obsidian vase: wildflowers by the vase's rule, to `VASE_HOLDS`, fresh `VASE_FRESH` days;
 *   * a lava lamp column and an ember orb: their light, the orb by how dark it is;
 *   * an obsidian wind chime: hung as a wind chime; louder the harder the wind;
 *   * an obsidian bust: carved as a citizen by the stone bust's rule;
 *   * a glass shard path: along a side, outside, a side a piece, laid in a row.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/obsidian.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/obsidian.mjs && node node_modules/.cache/obsidian.mjs
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { FURNITURE_BY_ID, FOUNTAINS, isFountain, isWell } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  blackLanternBurn, glassChimeLoud, LANTERN_CANDLE, LANTERN_DOUSE, LANTERN_LIGHT, NAME_OBELISK, OBSIDIAN_DONE, OBSIDIAN_JOBS, OBSIDIAN_SAID, obsidianDone, obeliskGlint,
  orbReach, READ_THRONE, type ObsidianDone, type ObsidianSaid,
} from '../../src/game/obsidian';
import {
  BLACK_LANTERN, BLACK_LANTERN_REACH, DRAGON_FOUNTAIN, EMBER_ORB, GLASS_CHIME_LEAST, LANTERN_CANDLES, LAVA_LAMP, LAVA_LAMP_REACH, OBELISK_GLINT, OBSIDIAN, OBSIDIAN_BUST,
  OBSIDIAN_CHIME, OBSIDIAN_OBELISK, OBSIDIAN_PIECES, OBSIDIAN_THRONE, OBSIDIAN_VASE, ORB_DAY_REACH, ORB_NIGHT_REACH, SHARD_GARDEN, SHARD_PATH, THRONE_SEATS,
} from '../../src/game/obsidiandefs';
import { FURNISH_SAID, furnishDone, VASE_PUT, VASE_TAKE } from '../../src/game/furnish';
import { VASE_FRESH, VASE_HOLDS } from '../../src/game/furnishdefs';
import { CARVE_BUST, FITTING_SAID, fittingDone, fittingSaid } from '../../src/game/fitting';
import { MOUNT_SAID } from '../../src/game/garden';
import { CHIME_STILL } from '../../src/game/gardendefs';
import { DAWN, DUSK } from '../../src/game/pace';
import { SPECIES } from '../../src/game/creatures';
import { STROKE_BY_ID } from '../../src/audio/strokes';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const SKILLS = ['stonecutting', 'glassblowing', 'masonry', 'jewellery'];

/* ---- 1. the pieces, their recipes, their items and their jobs, the same on both sides ---------------- */

check(`${OBSIDIAN_PIECES.length} pieces, each a piece and an item`, OBSIDIAN_PIECES.length === 11 && OBSIDIAN_PIECES.every((id) => FURNITURE_BY_ID.has(id) && !!ITEM_DEFS[id]));
check('obsidian: a raw material, 0.5 kg, stackable, never rots, from monsters killed on Volcano Isle', ITEM_DEFS[OBSIDIAN]?.category === 'material' && ITEM_DEFS[OBSIDIAN].weight === 0.5
  && ITEM_DEFS[OBSIDIAN].stackable === true && ITEM_DEFS[OBSIDIAN].raw === true && ITEM_DEFS[OBSIDIAN].decay === 0
  && ITEM_DEFS[OBSIDIAN].description === 'From monsters killed on Volcano Isle.'
  && psql(`select name || '|' || raw::text || '|' || decay::text from item_def where id = '${OBSIDIAN}'`) === 'Obsidian|true|0');
for (const id of OBSIDIAN_PIECES) {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const here = r ? `${r.skill}|${r.tool ?? '-'}|${r.station ?? '-'}|${r.baseTime}|${r.difficulty}|${r.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : 'none';
  const isle = psql(`select r.skill || '|' || coalesce(r.tool, '-') || '|' || coalesce(r.station, '-') || '|' || r.base_time || '|' || r.difficulty || '|'
    || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
    from recipe r where r.id = 'make_${id}'`);
  check(`${id}: a recipe with its trade, tool or station, time and bill, the same on both sides (${here})`, isle === here && !!r, isle);
  check(`${id}: made of obsidian, by ${r?.skill}`, !!r?.inputs.some((i) => i.item === OBSIDIAN) && SKILLS.includes(r?.skill ?? '') && (r?.inputs.length ?? 0) >= 2);
  const f = FURNITURE_BY_ID.get(id);
  const defIsle = psql(`select concat_ws('|', w, h, coalesce(mount, '-'), coalesce(seats, 0), coalesce(well, 0)) from furniture_def where id = '${id}'`);
  const defHere = [f?.w, f?.h, f?.mount ?? '-', f?.seats ?? 0, f?.well ?? 0].join('|');
  check(`${id}: what it is, the same on the island (${defHere})`, defIsle === defHere, defIsle);
  const desc = ITEM_DEFS[id]?.description ?? '';
  check(`${id}: its item says what it does, with no placeholder left`, desc.length > 0 && !desc.includes('{') && psql(`select description from item_def where id = '${id}'`) === desc, desc);
}
check('blown pieces at a lit smelter take no tool', OBSIDIAN_PIECES.map((id) => RECIPE_BY_ID.get(`make_${id}`)).filter((r) => r?.skill === 'glassblowing')
  .every((r) => r?.station === 'smelter' && r.tool === undefined));
check(`a throne seats ${THRONE_SEATS}, on the island too`, psql(`select seats_of('${OBSIDIAN_THRONE}')`) === String(THRONE_SEATS));
check('the fountains are the same on both sides', psql('select string_agg(f, \',\' order by o) from unnest(array[\'fountain\', \'dragon_glass_fountain\', \'well\']) with ordinality u(f, o) where is_fountain(f)')
  === FOUNTAINS.join(',') && isFountain(DRAGON_FOUNTAIN) && !isFountain('well'));
check('and so are the numbers', psql(`select concat_ws('|', lantern_candles(), black_lantern_reach(), lava_lamp_reach(), orb_night_reach(), orb_day_reach(), obelisk_glint(), glass_chime_least(), throne_seats())`)
  === [LANTERN_CANDLES, BLACK_LANTERN_REACH, LAVA_LAMP_REACH, ORB_NIGHT_REACH, ORB_DAY_REACH, OBELISK_GLINT, GLASS_CHIME_LEAST, THRONE_SEATS].join('|'));

const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time || ':' || stamina, '|' order by id)
  from action_def where id = any (array[${OBSIDIAN_JOBS.map(sq).join(', ')}]::text[])`);
const jobsHere = [...OBSIDIAN_JOBS].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}:${a.stamina}`;
}).join('|');
check(`its ${OBSIDIAN_JOBS.length} jobs are the same rows on both sides`, jobsIsle === jobsHere, jobsIsle);
check('and every one of them is an obsidian piece\'s job on the island', psql(`select bool_and(obsidian_action(id)) from unnest(array[${OBSIDIAN_JOBS.map(sq).join(', ')}]::text[]) id`) === 't');
check('every timed job has a sound', OBSIDIAN_JOBS.every((id) => (ACTION_BY_ID.get(id)?.instant ?? false) || !!STROKE_BY_ID[id]),
  OBSIDIAN_JOBS.filter((id) => !ACTION_BY_ID.get(id)?.instant && !STROKE_BY_ID[id]).join(','));
{
  const keys = Object.keys(OBSIDIAN_SAID) as ObsidianSaid[];
  const isle = psql(`select string_agg(obsidian_said(k), '#' order by o) from unnest(array[${keys.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('every refusal says the same on both sides', isle === keys.map((k) => OBSIDIAN_SAID[k]).join('#'), isle);
  const done = Object.keys(OBSIDIAN_DONE) as ObsidianDone[];
  const dIsle = psql(`select string_agg(obsidian_done(k, 'Home', 2, 5, 3), '#' order by o) from unnest(array[${done.map(sq).join(', ')}]::text[]) with ordinality u(k, o)`);
  check('and what each job says done', dIsle === done.map((k) => obsidianDone(k, { what: 'Home', n: 2, held: 5, of: 3 })).join('#'), dIsle);
  const qls = [1, 30, 50, 99];
  check('a black glass lantern\'s candle burns as long on both sides', psql(`select string_agg(black_lantern_burn(q)::text, ',' order by q) from unnest(array[${qls.join(',')}]::double precision[]) q`)
    === qls.map(blackLanternBurn).join(','));
}
check(`an obelisk glints at dawn and dusk, gone ${OBELISK_GLINT} game hours either side`, obeliskGlint(DAWN) === 1 && obeliskGlint(DUSK) === 1 && obeliskGlint(12) === 0
  && obeliskGlint(DAWN + OBELISK_GLINT) === 0 && obeliskGlint(DUSK - OBELISK_GLINT / 2) === 0.5);
check(`an ember orb lights ${ORB_DAY_REACH} tile by day, ${ORB_NIGHT_REACH} at full night`, orbReach(0) === ORB_DAY_REACH && orbReach(1) === ORB_NIGHT_REACH
  && orbReach(0.5) === (ORB_DAY_REACH + ORB_NIGHT_REACH) / 2);
check(`an obsidian chime: silent under ${CHIME_STILL * 100}% wind, ×${GLASS_CHIME_LEAST} at it, ×1 at full`, glassChimeLoud(CHIME_STILL - 0.01) === 0
  && glassChimeLoud(CHIME_STILL) === GLASS_CHIME_LEAST && glassChimeLoud(1) === 1 && glassChimeLoud(0.6) > glassChimeLoud(0.4));
check('a dragon-glass fountain is a well; a chime hangs; a path lies along a side', isWell({ kind: DRAGON_FOUNTAIN } as never)
  && FURNITURE_BY_ID.get(OBSIDIAN_CHIME)?.mount === 'hang' && FURNITURE_BY_ID.get(OBSIDIAN_CHIME)?.chime === true && FURNITURE_BY_ID.get(SHARD_PATH)?.mount === 'edge');
check('the island reads a dragon-glass fountain as a fountain wherever it reads one', psql(`select count(*) from pg_proc where proname in ('aqueduct_plan', 'aqueduct_unfeed', 'placed_litres', 'settle_spring', 'settle_water')
  and prosrc like '%is_fountain(%' and prosrc not like '%sub = ''fountain''%'`) === '5');

/* ---- 2. on the island ---------------------------------------------------------------------------- */

const MIRA = '0b51d1a0-0000-4000-8000-0000000000a1';
const OTTO = '0b51d1a0-0000-4000-8000-0000000000a2';
const T = (id: string, more = ''): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${more})`;
const TILE = (item: string, x: number, y: number, facing: string, sx = 0, sy = 0): string =>
  `jsonb_build_object('kind', 'tile', 'itemUid', ${item}, 'x', ${x}, 'y', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}')`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string, who = 'u'): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = ${who} and holder = 'player' and def = '${def}'), 0)`;
const ask = (key: string, action: string, target: string, who = 'u'): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string, who = 'u'): string => `perform act_perform(w, ${who}, '${action}', ${target});`;
/** A piece made through its own recipe where the player stands: a lit smelter beside them for the blown ones, taken away after. */
const build = (id: string): string => {
  const r = RECIPE_BY_ID.get(`make_${id}`);
  const gives = (r?.inputs ?? []).map((i) => `perform give(w, u, '${i.item}', ${i.count}, 40);`).join('\n  ');
  const smelter = r?.station === 'smelter';
  return `${r?.tool ? `perform give(w, u, '${r.tool}', 1, 50);` : ''}
  ${gives}
  ${smelter ? `insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    select w, 'smelter', floor(p.x)::int + 1, floor(p.y)::int, 0, 0, floor(p.x) + 1.375, floor(p.y) + 0.25, 50, 600, true, '{"jobs": [], "output": []}'::jsonb, u
      from player p where p.world_id = w and p.uid = u returning id into v_sm;` : ''}
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${id}', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = '${r?.inputs[0].item}' order by id limit 1)));
  perform pg_temp.nodice();
  ${smelter ? 'delete from placed where id = v_sm;' : ''}
  select id into v_it from item where world_id = w and holder_uid = u and def = '${id}' order by id desc limit 1;
  insert into said values ('${id}:made', case when v_it is null then 'no' else 'yes' end);`;
};
const at = (x: number, y: number, who = 'u'): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now(), level = 0 where world_id = w and uid = ${who};`;
const place = (key: string, target: string): string => `${ask(`${key}:ask`, 'place_furniture', target)}
  ${act('place_furniture', target)}
  select id into v_pl from placed where world_id = w and kind = 'furniture' order by id desc limit 1;`;
const piece = (key: string, id: string, x: number, y: number, facing = 's', sx = 0, sy = 0): string => `${at(x, y)}
  ${build(id)}
  ${place(key, TILE('v_it', x, y, facing, sx, sy))}`;
const KIND = Object.keys(SPECIES)[0];
const LOOK = { gender: 'man', hair: 'short', skin: 0.4, hairColour: 0.2, hairBright: 0.5 };

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
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_it bigint; v_pl bigint; v_a bigint; v_sm bigint; v_g jsonb;
        v_lantern bigint; v_throne bigint; v_obelisk bigint; v_fountain bigint; v_tiered bigint; v_garden bigint; v_vase bigint; v_lava bigint; v_chime bigint;
        v_bust bigint; v_path bigint; v_path2 bigint; v_orb bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Blackwater', 181, 64, 10, 10, true) returning id into w;
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
  insert into skill (world_id, uid, id, value) select w, x.uid, s.id, 70 from (values (u), (o)) x(uid),
    unnest(array[${SKILLS.map(sq).join(', ')}]) s(id)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  -- Mira's settlement over the yard, with two workers; a house at (30, 30).
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 12, 8, 2, u);
  perform deed_ranks_seed(w, u);
  insert into creature (world_id, id, species, name, mode, keeper, from_x, from_y, to_x, to_y, health, sex) values
    (w, 9301, '${KIND}', 'Ember', 'deed', u, 12, 12, 12, 12, 10, 'female'),
    (w, 9302, '${KIND}', 'Cinder', 'deed', u, 12, 12, 12, 12, 10, 'male');
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 93, 'Hut', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 93, 30, 30);

  -- 1. A black glass lantern: a candle, a flame, light; not lifted alight; put out.
  ${piece('LANTERN', BLACK_LANTERN, 4, 4)}
  v_lantern := v_pl;
  ${ask('LANTERN:nocandle', LANTERN_CANDLE, T('v_lantern'))}
  ${ask('LANTERN:nofuel', LANTERN_LIGHT, T('v_lantern'))}
  perform give(w, u, 'candle', ${LANTERN_CANDLES}, 40);
  ${act(LANTERN_CANDLE, T('v_lantern'))}
  insert into said select 'LANTERN:candle', ${lastSaid()} || '|' || pl.fuel::text || '|' || pl.ql::text || '|' || ${count('candle')}::text from placed pl where pl.id = v_lantern;
  perform give(w, u, 'candle', 1, 40);
  ${ask('LANTERN:still', LANTERN_CANDLE, T('v_lantern'))}
  ${ask('LANTERN:noflame', LANTERN_LIGHT, T('v_lantern'))}
  ${ask('LANTERN:notlit', LANTERN_DOUSE, T('v_lantern'))}
  v_a := give(w, u, 'lantern', 1, 50);
  update item set lit = true, charges = 600 where id = v_a;
  ${act(LANTERN_LIGHT, T('v_lantern'))}
  insert into said select 'LANTERN:lit', ${lastSaid()} || '|' || placed_lit(pl)::text from placed pl where pl.id = v_lantern;
  ${ask('LANTERN:already', LANTERN_LIGHT, T('v_lantern'))}
  ${ask('LANTERN:lift', 'pick_up_furniture', T('v_lantern'))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_LANTERN', v_g::text);
  insert into said values ('LANTERN:id', v_lantern::text);
  ${act(LANTERN_DOUSE, T('v_lantern'))}
  insert into said select 'LANTERN:out', ${lastSaid()} || '|' || placed_lit(pl)::text from placed pl where pl.id = v_lantern;
  delete from item where world_id = w and holder_uid = u and def = 'lantern';

  -- 2. An obsidian throne on Mira's settlement: Mira sits; Otto, stranger or citizen, does not; Examine reads the settlement now.
  ${piece('THRONE', OBSIDIAN_THRONE, 14, 14)}
  v_throne := v_pl;
  ${ask('THRONE:mira', 'sit_seat', T('v_throne'))}
  ${at(14, 14, 'o')}
  ${ask('THRONE:otto', 'sit_seat', T('v_throne'), 'o')}
  ${act(READ_THRONE, T('v_throne'))}
  insert into said values ('THRONE:read', ${lastSaid()});
  insert into deed_member (world_id, founder, uid, role, rank_id)
    values (w, u, o, 'citizen', (select id from deed_rank_def where world_id = w and founder = u order by id desc limit 1));
  ${ask('THRONE:citizen', 'sit_seat', T('v_throne'), 'o')}
  ${act(READ_THRONE, T('v_throne'), 'o')}
  insert into said values ('THRONE:read2', ${lastSaid('o')});
  v_g := rpc_ground(w, 40, true);
  insert into said values ('GROUND_THRONE', v_g::text);
  insert into said values ('THRONE:id', v_throne::text);
  ${piece('THRONE2', OBSIDIAN_THRONE, 50, 50)}
  ${ask('THRONE:wild', 'sit_seat', T('v_pl'))}
  ${ask('THRONE:wildread', READ_THRONE, T('v_pl'))}

  -- 3. An obsidian obelisk: named as a cairn; not by a stranger off the roll.
  ${piece('OBELISK', OBSIDIAN_OBELISK, 16, 8)}
  v_obelisk := v_pl;
  delete from deed_member where world_id = w and uid = o;
  ${at(16, 8, 'o')}
  ${ask('OBELISK:otto', NAME_OBELISK, T('v_obelisk', ", 'name', 'Mine'"), 'o')}
  ${act(NAME_OBELISK, T('v_obelisk', ", 'name', 'Ash Spire'"))}
  insert into said select 'OBELISK:named', ${lastSaid()} || '|' || pl.engraving from placed pl where pl.id = v_obelisk;
  ${ask('OBELISK:same', NAME_OBELISK, T('v_obelisk', ", 'name', 'Ash Spire'"))}
  ${ask('OBELISK:empty', NAME_OBELISK, T('v_obelisk', ", 'name', '   '"))}

  -- 4. A dragon-glass fountain beside a tiered one: a well drawing what a tiered fountain draws.
  ${piece('FOUNTAIN', DRAGON_FOUNTAIN, 6, 14)}
  v_fountain := v_pl;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, litres, since, made_by) values (w, 'furniture', 'fountain', 6, 18, 6.375, 18.375, 40, 0, now() - interval '60 seconds', u)
    returning id into v_tiered;
  update placed set ql = 40, litres = 0, since = now() - interval '60 seconds' where id = v_fountain;
  insert into said select 'FOUNTAIN:litres', round(placed_litres(a)::numeric, 3)::text || '|' || round(placed_litres(b)::numeric, 3)::text
    from placed a, placed b where a.id = v_fountain and b.id = v_tiered;
  insert into said select 'FOUNTAIN:well', is_well(pl)::text || '|' || liquid_capacity(pl)::text from placed pl where pl.id = v_fountain;

  -- 5. A shard garden.
  ${piece('GARDEN', SHARD_GARDEN, 8, 4)}
  v_garden := v_pl;

  -- 6. An obsidian vase: wildflowers to its room by the vase's rule; taken out; left to wilt.
  ${piece('VASE', OBSIDIAN_VASE, 20, 6)}
  v_vase := v_pl;
  ${ask('VASE:none', VASE_PUT, T('v_vase'))}
  ${ask('VASE:empty', VASE_TAKE, T('v_vase'))}
  perform give(w, u, 'wildflowers', 5, 30);
  ${act(VASE_PUT, T('v_vase'))}
  insert into said values ('VASE:put', ${lastSaid()} || '|' || ${count('wildflowers')}::text);
  ${ask('VASE:full', VASE_PUT, T('v_vase'))}
  v_g := rpc_ground(w, 40, false);
  insert into said values ('GROUND_VASE', v_g::text);
  insert into said values ('VASE:id', v_vase::text);
  ${act(VASE_TAKE, T('v_vase'))}
  insert into said values ('VASE:taken', ${lastSaid()} || '|' || ${count('wildflowers')}::text);
  ${act(VASE_PUT, T('v_vase'))}
  update placed set garden = jsonb_set(garden, '{vase,at}', to_jsonb(extract(epoch from now()) - vase_fresh() * day_seconds() - 1)) where id = v_vase;
  ${ask('VASE:wilted', VASE_PUT, T('v_vase'))}

  -- 7. A lava lamp column and an ember orb.
  ${piece('LAVA', LAVA_LAMP, 22, 14)}
  v_lava := v_pl;
  ${piece('ORB', EMBER_ORB, 24, 14)}
  v_orb := v_pl;

  -- 8. An obsidian wind chime: no hook on bare ground; hung from a lantern post on its tile.
  ${at(26, 4)}
  ${build(OBSIDIAN_CHIME)}
  ${ask('CHIME:nohook', 'place_furniture', TILE('v_it', 26, 4, 's'))}
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'lamp_post', 26, 4, 0, 0, 26.125, 4.125, 40, u);
  ${place('CHIME', TILE('v_it', 26, 4, 'e', 3, 2))}
  v_chime := v_pl;

  -- 9. An obsidian bust on Mira's settlement: carved as Mira, with her look, by the stone bust's rule.
  ${piece('BUST', OBSIDIAN_BUST, 13, 9)}
  v_bust := v_pl;
  ${ask('BUST:nobody', CARVE_BUST, T('v_bust'))}
  ${ask('BUST:otto', CARVE_BUST, T('v_bust', `, 'who', '${OTTO}'`))}
  ${act(CARVE_BUST, T('v_bust', `, 'who', '${MIRA}'`))}
  insert into said select 'BUST:carved', ${lastSaid()} || '|' || (pl.garden->'bust'->>'name') || '|' || (pl.garden->'bust'->'look'->>'gender') from placed pl where pl.id = v_bust;
  ${ask('BUST:same', CARVE_BUST, T('v_bust', `, 'who', '${MIRA}'`))}
  v_g := rpc_ground(w, 40, true);
  insert into said values ('GROUND_BUST', v_g::text);
  insert into said values ('BUST:id', v_bust::text);

  -- 10. A glass shard path: not inside a building; along the north side of a tile, then the next tile's, in a row; not twice on one side.
  ${at(30, 30)}
  ${build(SHARD_PATH)}
  ${ask('PATH:inside', 'place_furniture', TILE('v_it', 30, 30, 'n'))}
  ${at(34, 34)}
  ${place('PATH', TILE('v_it', 34, 34, 'n'))}
  v_path := v_pl;
  ${build(SHARD_PATH)}
  ${place('PATH2', TILE('v_it', 35, 34, 'n'))}
  v_path2 := v_pl;
  ${build(SHARD_PATH)}
  ${ask('PATH:twice', 'place_furniture', TILE('v_it', 34, 34, 'n'))}
  insert into said select 'PATH:row', string_agg(pl.x || ',' || pl.y || ',' || pl.sy || ',' || pl.facing, ';' order by pl.x) from placed pl where pl.id in (v_path, v_path2);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';
const is = (k: string, want: string, what: string): void => check(`${what}: ${want}`, said(k) === want, said(k));

for (const id of OBSIDIAN_PIECES) is(`${id}:made`, 'yes', `${id}: made through its own recipe`);
for (const k of ['LANTERN', 'THRONE', 'THRONE2', 'OBELISK', 'FOUNTAIN', 'GARDEN', 'VASE', 'LAVA', 'ORB', 'CHIME', 'BUST', 'PATH', 'PATH2']) is(`${k}:ask`, 'none', `${k}: set down`);
/* 1. */
is('LANTERN:nocandle', OBSIDIAN_SAID.noCandles, `a candle goes in, ${LANTERN_CANDLES}`);
is('LANTERN:nofuel', OBSIDIAN_SAID.noCandle, 'and nothing lit with none in it');
{
  const [line, fuel, ql, left] = said('LANTERN:candle').split('|');
  check('put in, spent, burning a candle\'s time in a lantern of its QL', Number(fuel) === blackLanternBurn(Number(ql)) && left === '0'
    && line === obsidianDone('candle', { what: psql(`select time_words(${blackLanternBurn(Number(ql))})`) }), said('LANTERN:candle'));
}
is('LANTERN:still', OBSIDIAN_SAID.candleIn, 'and no more while it lasts');
check('lit off a flame and none without', said('LANTERN:noflame') !== 'none' && said('LANTERN:noflame') === psql('select no_flame_said()'), said('LANTERN:noflame'));
is('LANTERN:notlit', OBSIDIAN_SAID.notLit, 'not put out before it is lit');
is('LANTERN:lit', `${obsidianDone('lit', { what: 'lantern' })}|true`, 'lit from the lantern in hand');
is('LANTERN:already', OBSIDIAN_SAID.lit, 'and not twice');
is('LANTERN:lift', 'Put it out first.', 'not lifted alight');
check('put out', said('LANTERN:out').endsWith('|false') && said('LANTERN:out').startsWith('Put out. Candle left: '), said('LANTERN:out'));
/* 2. */
is('THRONE:mira', 'none', 'the founder sits on her throne');
is('THRONE:otto', OBSIDIAN_SAID.founder, 'a stranger does not');
is('THRONE:read', obsidianDone('throne', { what: 'Home', n: 2, held: 1, of: 2 }), 'Examine: the settlement\'s level, citizens and workers');
is('THRONE:citizen', OBSIDIAN_SAID.founder, 'nor a citizen');
is('THRONE:read2', obsidianDone('throne', { what: 'Home', n: 2, held: 2, of: 2 }), 'and read again now: a citizen more');
is('THRONE:wild', OBSIDIAN_SAID.founder, 'off a settlement, nobody sits');
is('THRONE:wildread', OBSIDIAN_SAID.noDeed, 'and there is nothing to read');
/* 3. */
is('OBELISK:otto', FURNISH_SAID.cairnNotYours, 'an obelisk named by whoever set it down or a citizen');
is('OBELISK:named', `${obsidianDone('named', { what: 'Ash Spire' })}|Ash Spire`, 'named');
is('OBELISK:same', FURNISH_SAID.sameName, 'not the same again');
is('OBELISK:empty', FURNISH_SAID.noName, 'nor nothing');
/* 4. */
{
  const [a, b] = said('FOUNTAIN:litres').split('|').map(Number);
  check('a dragon-glass fountain draws what a tiered fountain of its QL draws', a > 0 && a === b, said('FOUNTAIN:litres'));
}
is('FOUNTAIN:well', `true|${FURNITURE_BY_ID.get(DRAGON_FOUNTAIN)?.well}`, 'a well, of a fountain\'s litres');
/* 6. */
is('VASE:none', FURNISH_SAID.noFlowers, 'an obsidian vase with no wildflowers to put in');
is('VASE:empty', FURNISH_SAID.vaseEmpty, 'and nothing to take out');
is('VASE:put', `${furnishDone('posy', { n: VASE_HOLDS, held: VASE_HOLDS, of: VASE_HOLDS })}|${5 - VASE_HOLDS}`, `wildflowers to its room, ${VASE_HOLDS}, fresh ${VASE_FRESH} days`);
is('VASE:full', FURNISH_SAID.vaseFull, 'then full');
is('VASE:taken', `${furnishDone('posyTaken', { n: VASE_HOLDS })}|5`, 'taken out fresh');
is('VASE:wilted', FURNISH_SAID.wilted, `wilted after ${VASE_FRESH} days`);
/* 8. */
is('CHIME:nohook', MOUNT_SAID.noHook, 'an obsidian chime does not stand on bare ground');
/* 9. */
is('BUST:nobody', FITTING_SAID.pickCitizen, 'an obsidian bust is carved as somebody');
is('BUST:otto', fittingSaid('notCitizen', { what: 'Home' }), 'a citizen of its settlement only');
is('BUST:carved', `${fittingDone('carved', { what: 'Mira' })}|Mira|${LOOK.gender}`, 'carved, with their look');
is('BUST:same', fittingSaid('sameCitizen', { what: 'Mira' }), 'and not as the same again');
/* 10. */
is('PATH:inside', MOUNT_SAID.inside, 'a path not inside a building');
is('PATH:row', '34,34,0,n;35,34,0,n', 'along the north sides of two tiles, in a row');
is('PATH:twice', 'Something is already standing there.', 'and one a side');

/* ---- 3. what every browser reads, and says the same of ------------------------------------------------- */

const looker = (ground: string): Game => {
  const g = Game.create(181, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(JSON.parse(ground) as IslandGround);
  return g;
};
{
  const seen = looker(said('GROUND_LANTERN'));
  const f = seen.furniture.get(Number(said('LANTERN:id')));
  seen.islandClock = () => 0;
  check(`the browser reads a lit black glass lantern, ${BLACK_LANTERN_REACH} tiles at night`, !!f?.lit && seen.lights().some((s) => s.radius === BLACK_LANTERN_REACH));
  seen.putBody(4.5, 4.5, 0);
  check('and refuses another candle in the island\'s words', ACTION_BY_ID.get(LANTERN_CANDLE)?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === OBSIDIAN_SAID.candleIn);
  check('and puts it out', ACTION_BY_ID.get(LANTERN_DOUSE)?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === null);
}
{
  const seen = looker(said('GROUND_THRONE'));
  const f = seen.furniture.get(Number(said('THRONE:id')));
  seen.putBody(14.5, 14.5, 0);
  const sit = (): string | null | undefined => ACTION_BY_ID.get('sit_seat')?.check?.({ kind: 'furniture', id: f?.id } as never, seen);
  check('the browser lets the founder sit', !!f && sit() === null, String(sit()));
  if (seen.deed) seen.deed.role = 'citizen';
  check('and refuses anybody else in the island\'s words', sit() === OBSIDIAN_SAID.founder, String(sit()));
  check('and offers Examine', ACTION_BY_ID.get(READ_THRONE)?.applies?.({ kind: 'furniture', id: f?.id } as never, seen) === true);
}
{
  const seen = looker(said('GROUND_VASE'));
  const f = seen.furniture.get(Number(said('VASE:id')));
  seen.putBody(20.5, 6.5, 0);
  check('the browser reads an obsidian vase\'s wildflowers', f?.furnish?.vase?.n === VASE_HOLDS, JSON.stringify(f?.furnish));
  check('and refuses more in the island\'s words', ACTION_BY_ID.get(VASE_PUT)?.check?.({ kind: 'furniture', id: f?.id } as never, seen) === FURNISH_SAID.vaseFull);
}
{
  const seen = looker(said('GROUND_BUST'));
  const f = seen.furniture.get(Number(said('BUST:id')));
  check('the browser reads who an obsidian bust is, and their look', f?.fitting?.bust?.name === 'Mira' && f.fitting.bust.look.gender === LOOK.gender, JSON.stringify(f?.fitting));
  seen.putBody(13.5, 9.5, 0);
  const why = ACTION_BY_ID.get(CARVE_BUST)?.check?.({ kind: 'furniture', id: f?.id, who: MIRA } as never, seen);
  check('and refuses the same again in the island\'s words', why === fittingSaid('sameCitizen', { what: 'Mira' }), String(why));
  seen.islandClock = () => 0;
  const lava = [...seen.furniture.values()].find((p) => p.kind === LAVA_LAMP);
  const orb = [...seen.furniture.values()].find((p) => p.kind === EMBER_ORB);
  seen.putBody(23.5, 14.5, 0);
  const lights = seen.lights();
  check(`a lava lamp column lights ${LAVA_LAMP_REACH} tiles at night, an ember orb ${ORB_NIGHT_REACH}`, !!lava && !!orb
    && lights.some((s) => s.radius === LAVA_LAMP_REACH) && lights.some((s) => s.radius === orbReach(seen.darkness())) && seen.darkness() === 1, JSON.stringify(lights.map((s) => s.radius)));
}
{
  // Where the browser sets a path down, and a chime.
  const g = Game.create(181, 64);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.putBody(6.5, 6.5, 0);
  check('the browser sets a path along a side, outside', g.furniturePlaceReason(SHARD_PATH, 6, 6, 0, 0, 'n') === null, String(g.furniturePlaceReason(SHARD_PATH, 6, 6, 0, 0, 'n')));
  check('and refuses a chime on bare ground in the island\'s words', g.furniturePlaceReason(OBSIDIAN_CHIME, 6, 6, 0, 0, 's') === MOUNT_SAID.noHook);
}

finish('obsidian');
