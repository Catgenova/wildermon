/**
 * Thirty-six more goals in the crafts, the land and the water (`journal-b.ts`).
 *
 * The island: each count a new goal reads is noted for whoever does the thing,
 * where it is done -- a shearing, a milking, a glaze, a pass that takes a
 * thing past `improved_to` (once a thing), a melting down, green ware packed
 * into a kiln, a glass panel dyed, a crop harvested, fruit picked, reeds cut,
 * wildflowers and a skep's honey by the season, grapes, a map drawn, a
 * masterwork signed, a fish out of the sea and out of a spring's pond and a
 * supreme one; and off a walk (`journal_move`, which `rpc_move` calls), tiles
 * sailed, a hull taken right round the middle of the island and not round
 * anywhere else, a foot ashore on the dragon's island, and a laden cart on a
 * bridge you built and not on somebody else's.
 *
 * The browser: every new goal is not met on a fresh game and is met by the
 * count or the state it says -- a full suit of metal armour, a lit lantern, a
 * compost worker, a full belly, a full larder and a full fish pond among them
 * -- and the island's counts, as it sent them, meet the goals they are for.
 *
 * And the whole journal: every id once, every goal a how-to, nothing left to
 * fill in.
 *
 * Runs against the database the suite leaves behind; the island half is one
 * transaction, rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { ALL_GOALS, JOURNAL } from '../../src/game/journal';
import { CRAFTS_B, LAND_B, WATER_B } from '../../src/game/journal-b';
import '../../src/game/recipes';
import { RECIPES } from '../../src/game/recipes';
import { CROP_LIST } from '../../src/game/farming';
import { FLOWER_SEASONS } from '../../src/world/flowers';
import { SEASONS } from '../../src/world/calendar';
import { SKEP_IDLE } from '../../src/game/bees';
import { ARMOUR } from '../../src/game/gear';
import { MOULD_BY_MAKES } from '../../src/game/metal';
import { IMPROVED_TO } from '../../src/game/improve';
import { furnitureCapacity } from '../../src/game/furniture';
import { NUTRIENTS } from '../../src/game/nutrition';
import { PERKS } from '../../src/game/perks';
import { SPECIES } from '../../src/game/creatures';
import { emptyWork } from '../../src/game/workstats';

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

const MINE = [...CRAFTS_B, ...LAND_B, ...WATER_B];
const goal = (id: string) => {
  const g = MINE.find((x) => x.id === id);
  if (!g) throw new Error(`no goal ${id}`);
  return g;
};

/* ---- the whole journal ----------------------------------------------------- */

const ids = ALL_GOALS.map((g) => g.id);
const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
check(`every goal id is once in the journal (${ids.length})`, twice.length === 0, twice.join(', '));
check(`these ${MINE.length} are in it, in the crafts, the land and the water`,
  MINE.every((g) => ALL_GOALS.includes(g))
  && CRAFTS_B.every((g) => JOURNAL.find((c) => c.name === 'The crafts')?.goals.includes(g))
  && LAND_B.every((g) => JOURNAL.find((c) => c.name === 'The land')?.goals.includes(g))
  && WATER_B.every((g) => JOURNAL.find((c) => c.name === 'The water')?.goals.includes(g)));
const noHow = MINE.filter((g) => !g.how || g.how.length < 20).map((g) => g.id);
check('each has a how-to', noHow.length === 0, noHow.join(', '));
const unfilled = MINE.filter((g) => /\{[\w.]+(:\w+)?\}/.test(`${g.text} ${g.hint ?? ''} ${g.how ?? ''}`)).map((g) => g.id);
check('and nothing in one is left to fill in', unfilled.length === 0, unfilled.join(', '));
// A label, as the journal's are: a capital, no full stop, no sentence after it.
const wordy = MINE.filter((g) => !/^[A-Z]/.test(g.text) || /[.!?]$/.test(g.text) || g.text.includes('. ') || g.text.length > 90).map((g) => g.id);
check('each text is a label', wordy.length === 0, wordy.join(', '));
// The hints and how-tos have no number typed into them (the benefit test reads the source for the same).
const src = readFileSync('src/game/journal-b.ts', 'utf8');
const typed = [...src.matchAll(/(?:hint|how): ['`]([^'`]*)['`]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '').replace(/\{[\w.]+(?::\w+)?\}/g, ''))
  .filter((t) => /\d|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred|thousand|twice|double|half)\b/i.test(t));
check('no hint or how-to has a number typed into it', typed.length === 0, typed.join(' | '));

/* ---- the island ------------------------------------------------------------ */

const BEA = 'b0a1e000-0000-4000-8000-0000000000b2';
const OTTO = 'b0a1e000-0000-4000-8000-0000000000b3';
const GLAZE = PERKS.find((p) => 'glaze_item' in p.fx);
if (!GLAZE) throw new Error('no perk for the glaze');
const FLEECED = Object.values(SPECIES).find((s) => (s.fleece ?? 0) > 0 && s.shearYield !== 'feather');
if (!FLEECED) throw new Error('nothing grows a fleece');
const METAL_PIECE = ARMOUR.find((a) => MOULD_BY_MAKES.has(a.id))!.id;

const out = psql(`
set wurm.season = '';
discard temp;
begin;
create temp table said (k text, v text);
-- A function stood in for, with its own arguments and what it returns, for the length of the transaction.
create function pg_temp.stub(p regprocedure, body text) returns void language plpgsql as $f$
begin
  execute format('create or replace function public.%I(%s) returns %s language sql as %L',
    (select proname from pg_proc where oid = p), pg_get_function_arguments(p), pg_get_function_result(p), body);
end $f$;
-- Every check passes; a fish is a perch, landed where it is asked for and a supreme one; nothing else in the way.
select pg_temp.stub('skill_check(double precision,double precision,double precision,double precision)', 'select true');
select pg_temp.stub('perk_rare(double precision)', $$select 'supreme'::text$$);
select pg_temp.stub('catch_fish(double precision,double precision,double precision,text,jsonb)', $$select 'perch'::text$$);
select pg_temp.stub('cast_at(uuid,uuid,integer,integer,double precision)', 'select $3, $4, 5::double precision');
select pg_temp.stub('flowers_on(uuid,integer,integer,timestamp with time zone)', 'select 2');
select pg_temp.stub('skep_made(uuid,placed,timestamp with time zone)', 'select 3::double precision');
select pg_temp.stub('vine_refusal(uuid,uuid,text,jsonb)', 'select null::text');
select pg_temp.stub('dye_pick(uuid,uuid,integer,jsonb)', $$select 'pot'::text$$);
select pg_temp.stub('dye_source_hex(uuid,uuid,text)', $$select '#aa3311'::text$$);
select pg_temp.stub('dye_spend(text,integer)', 'select true');
select pg_temp.stub('stock_for(uuid,uuid,text,text)', $$select i.* from item i where i.world_id = $1 and i.holder_uid = $2 and i.def = 'plank' order by i.id limit 1$$);
select pg_temp.stub('improve_ceiling(uuid,uuid,text,text)', 'select 99.9::double precision');
select pg_temp.stub('sign_refusal(uuid,uuid,jsonb)', 'select null::text');
select pg_temp.stub('chart_refusal(uuid,uuid,text,jsonb)', 'select null::text');
select pg_temp.stub('vehicle_speed(uuid,bigint)', 'select 1::double precision');
do $t$
declare w uuid; u uuid := '${BEA}'; o uuid := '${OTTO}'; v_c int; v_it bigint; v_pl bigint; v_d int; v_imp text;
        p player; v_boat placed; v_cart placed; v_none placed; v_x double precision; v_y double precision;
        v_px double precision; v_py double precision; i int; v_isle int[]; v_b bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('GoalsB', 3640, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Bea');
  delete from item where world_id = w and holder = 'player';
  update player set body_at = now(), x = 10.5, y = 10.5, tally = '{}'::jsonb, equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Beaholt', 10, 10, 5, 1, u);
  perform give(w, u, 'carving_knife', 1, 50);

  -- A shearing, and a milking of a Cudda.
  select creature_spawn(w, '${FLEECED.id}', 10.5, 9.5, 'deed', now() - interval '10 days', u) into v_c;
  update creature set fleece = 1, mode = 'deed', keeper = u, from_x = 10.5, from_y = 9.5, to_x = 10.5, to_y = 9.5
   where world_id = w and id = v_c;
  perform perform_creature(w, u, 'shear', jsonb_build_object('kind', 'creature', 'id', v_c));
  select creature_spawn(w, 'cudda', 11.5, 10.5, 'deed', now() - interval '10 days', u) into v_c;
  update creature set sex = 'female', fleece = 1, hunger = 1, mode = 'deed', keeper = u,
         from_x = 11.5, from_y = 10.5, to_x = 11.5, to_y = 10.5 where world_id = w and id = v_c;
  perform give(w, u, 'bucket', 1, 30);
  perform perform_creature(w, u, 'milk_creature', jsonb_build_object('kind', 'creature', 'id', v_c));

  -- A glaze, with the Artisan's Glaze held.
  update player set craft_class = '${GLAZE.class}' where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) values (w, u, '${GLAZE.id}');
  perform class_fold(w, u);
  v_it := give(w, u, 'clay_pot', 1, 30);
  perform give(w, u, 'ash', 1, 30);
  perform perform_item(w, u, 'glaze_item', jsonb_build_object('kind', 'item', 'uid', v_it));

  -- Improved past the line: once from under it, not again from over it, and not for a thing made over it.
  select item into v_imp from improvable_def where material = 'wood' order by item limit 1;
  perform give(w, u, 'plank', 10, 30);
  v_it := give(w, u, v_imp, 1, ${IMPROVED_TO} - 0.01);
  perform perform_item(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_it));
  insert into said values ('IMP_QL', (select round(ql::numeric, 2)::text from item where id = v_it));
  perform perform_item(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_it));
  v_it := give(w, u, v_imp, 1, ${IMPROVED_TO} + 5);
  perform perform_item(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_it));

  -- Melted down at a smelter, and clay bricks packed into a kiln: a kilnful, and four more.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 12, 9, 0, 0, 12.375, 9.25, 50, 600, true, '{"jobs": [], "output": []}'::jsonb, u) returning id into v_pl;
  v_it := give(w, u, '${METAL_PIECE}', 1, 50, 'Iron');
  perform act_perform(w, u, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_pl, 'itemUid', v_it, 'count', 1));
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, made_by, state)
    values (w, 'kiln', 9, 9, 0, 0, 9.5, 9.5, 50, u, '{"jobs": [], "output": []}'::jsonb) returning id into v_pl;
  v_it := give(w, u, 'unfired_clay_brick', 20, 30);
  perform perform_firing(w, u, 'load_kiln', jsonb_build_object('kind', 'kiln', 'id', v_pl, 'itemUid', v_it, 'count', 20));
  insert into said values ('KILN1', coalesce((select tally->>'fired:clay_brick' from player where world_id = w and uid = u), '0'));
  update placed set state = '{"jobs": [], "output": []}'::jsonb where id = v_pl;
  perform perform_firing(w, u, 'load_kiln', jsonb_build_object('kind', 'kiln', 'id', v_pl, 'itemUid', v_it, 'count', 20));

  -- A glass panel dyed, one off a pile of two.
  v_it := give(w, u, 'glass', 2, 30);
  perform act_perform(w, u, 'dye_item', jsonb_build_object('kind', 'item', 'uid', v_it));

  -- A ripe field of wheat harvested.
  perform land_set_tile(w, 14, 12, tile_id('Field'));
  insert into crop (world_id, x, y, id, stage, stage_at, tended, tended_now, ql, pace)
    values (w, 14, 12, 'wheat', crop_ripe(), now(), 1, false, 40, 1);
  perform act_perform(w, u, 'harvest_crop', jsonb_build_object('kind', 'tile', 'x', 14, 'y', 12));

  -- An apple tree picked, and a reed bed cut.
  select d into v_d from generate_series(0, 65535) d where tree_species(d) = (select id from tree_def where fruit = 'apple') limit 1;
  perform land_set_tile(w, 13, 13, tile_id('Tree'));
  perform land_set_data(w, 13, 13, v_d);
  perform act_perform(w, u, 'pick_fruit', jsonb_build_object('kind', 'tile', 'x', 13, 'y', 13));
  perform land_set_tile(w, 15, 13, tile_id('Reed'));
  perform act_perform(w, u, 'cut_reeds', jsonb_build_object('kind', 'tile', 'x', 15, 'y', 13));

  -- Wildflowers, a skep's honey and a vine's grapes.
  perform land_set_tile(w, 9, 13, tile_id('Grass'));
  perform act_perform(w, u, 'pick_flowers', jsonb_build_object('kind', 'tile', 'x', 9, 'y', 13));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', skep_kind(), 8, 12, 0, 0, 8.5, 12.5, 40, u) returning id into v_pl;
  perform perform_skep(w, u, take_honey_action(), jsonb_build_object('kind', 'furniture', 'id', v_pl));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', vine_kind(), 8, 8, 0, 0, 8.5, 8.5, 40, u) returning id into v_pl;
  perform perform_vine(w, u, 'pick_grapes', jsonb_build_object('kind', 'furniture', 'id', v_pl));
  insert into said values ('SEASON', season_at(now()));

  -- A map drawn, and a masterwork signed.
  v_it := give(w, u, 'papyrus', 1, 40);
  perform perform_chart(w, u, 'draw_map', jsonb_build_object('kind', 'item', 'uid', v_it));
  v_it := give(w, u, 'mallet', 1, 95);
  perform perform_sign(w, u, jsonb_build_object('kind', 'item', 'uid', v_it, 'name', 'Bea made this'));

  -- A supreme perch out of the sea, and one out of a spring's pond.
  perform give(w, u, 'fishing_rod', 1, 40);
  perform land_set_height(w, 20, 20, -5); perform land_set_height(w, 21, 20, -5);
  perform land_set_height(w, 21, 21, -5); perform land_set_height(w, 20, 21, -5);
  insert into said values ('KINDS', water_kind(w, 20, 20) || ',' || water_kind(w, 25, 25));
  perform perform_fish(w, u, 'fish', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20));
  perform perform_fish(w, u, 'fish', jsonb_build_object('kind', 'tile', 'x', 25, 'y', 25));

  -- The walk: rpc_move hands each walk it lets stand to journal_move.
  insert into said values ('MOVE_CALLS', (pg_get_functiondef('rpc_move'::regproc) like '%perform journal_move(p_world, me, p, p_x, p_y, cart, v_xs, v_ys);%')::text);

  -- A hull under Bea's helm: round a point off the middle of the island first, which is not round the island.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, driver)
    values (w, 'furniture', 'rowing_boat', 44, 32, 0, 0, 44.5, 32.5, 40, u, u) returning id into v_b;
  v_px := 54.5; v_py := 50.5;
  for i in 1 .. 72 loop
    v_x := 50.5 + 4 * cos(i * pi() / 36); v_y := 50.5 + 4 * sin(i * pi() / 36);
    select * into p from player where world_id = w and uid = u;
    p.x := v_px; p.y := v_py;
    select * into v_boat from placed where id = v_b;
    perform journal_move(w, u, p, v_x, v_y, v_boat, array[v_px, v_x], array[v_py, v_y]);
    v_px := v_x; v_py := v_y;
  end loop;
  insert into said values ('SMALL_LOOP', coalesce((select tally->>'circled' from player where world_id = w and uid = u), '0'));
  -- And then right round the middle, three quarters of the way and then the rest.
  v_px := 32.5 + 20; v_py := 32.5;
  for i in 1 .. 72 loop
    v_x := 32.5 + 20 * cos(i * pi() / 36); v_y := 32.5 + 20 * sin(i * pi() / 36);
    select * into p from player where world_id = w and uid = u;
    p.x := v_px; p.y := v_py;
    select * into v_boat from placed where id = v_b;
    perform journal_move(w, u, p, v_x, v_y, v_boat, array[v_px, v_x], array[v_py, v_y]);
    v_px := v_x; v_py := v_y;
    if i = 54 then
      insert into said values ('THREE_QUARTERS', coalesce((select tally->>'circled' from player where world_id = w and uid = u), '0'));
    end if;
  end loop;

  -- Ashore on the dragon's island, off a hull and out of a seat; and not by sailing past it.
  select array[gx, gy] into v_isle from generate_series(0, 63) gx, generate_series(0, 63) gy
   where region_at(w, gx + 0.5, gy + 0.5) = monster_isle('dragon') and not has_water(w, gx, gy) limit 1;
  select * into p from player where world_id = w and uid = u;
  p.x := v_isle[1] + 0.5; p.y := v_isle[2] + 1.5; p.aboard := null;
  select * into v_boat from placed where id = v_b;
  perform journal_move(w, u, p, v_isle[1] + 0.5, v_isle[2] + 0.5, v_boat, array[p.x, v_isle[1] + 0.5], array[p.y, v_isle[2] + 0.5]);
  insert into said values ('ISLE_BY_HULL', coalesce((select tally->>'landed:dragon' from player where world_id = w and uid = u), '0'));
  select * into p from player where world_id = w and uid = u;
  p.x := v_isle[1] + 0.5; p.y := v_isle[2] + 1.5; p.aboard := null;
  perform journal_move(w, u, p, v_isle[1] + 0.5, v_isle[2] + 0.5, v_none, array[p.x, v_isle[1] + 0.5], array[p.y, v_isle[2] + 0.5]);

  -- A laden cart onto Otto's bridge, which is not Bea's; then onto hers.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, driver)
    values (w, 'furniture', 'large_cart', 39, 40, 0, 0, 39.5, 40.5, 40, u, u) returning * into v_cart;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_cart.id, 'log', 30, 3);
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by) values (w, 'wooden', 40, 40, 42, 40, 5, o) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_b, 0, 40, 40, '{}', '{}');
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by) values (w, 'wooden', 40, 44, 42, 44, 5, u) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_b, 0, 40, 44, '{}', '{}');
  select * into p from player where world_id = w and uid = u;
  p.x := 39.5; p.y := 40.5;
  perform journal_move(w, u, p, 40.5, 40.5, v_cart, array[39.5, 40.5], array[40.5, 40.5]);
  insert into said values ('THEIR_BRIDGE', coalesce((select tally->>'cartbridge' from player where world_id = w and uid = u), '0'));
  select * into p from player where world_id = w and uid = u;
  p.x := 39.5; p.y := 44.5;
  perform journal_move(w, u, p, 40.5, 44.5, v_cart, array[39.5, 40.5], array[44.5, 44.5]);

  insert into said select 'BEA', tally::text from player where world_id = w and uid = u;
  insert into said select 'OTTO', coalesce(tally, '{}'::jsonb)::text from player where world_id = w and uid = o;
  insert into said values ('IMPROVED_TO', improved_to()::text);
end $t$;
select k || '=' || v from said;
rollback;`);

const isle = new Map(out.split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const bea = JSON.parse(isle.get('BEA') ?? '{}') as Record<string, number>;
const otto = JSON.parse(isle.get('OTTO') ?? '{}') as Record<string, number>;
const season = isle.get('SEASON') ?? '';
const n = (k: string): number => bea[k] ?? 0;

check('the island\'s line for improving is the browser\'s', Number(isle.get('IMPROVED_TO')) === IMPROVED_TO, isle.get('IMPROVED_TO'));
check('a shearing counts', n('sheared') === 1, isle.get('BEA'));
check('a milking counts, by the kind milked', n('milked:cudda') === 1);
check('a glaze counts', n('glazed') === 1);
check(`a pass past QL ${IMPROVED_TO} counts once a thing, and not for a thing already past it`,
  n('improved70') === 1 && Number(isle.get('IMP_QL')) >= IMPROVED_TO, `${n('improved70')}, QL ${isle.get('IMP_QL')}`);
check('a melting down counts', n('melted') === 1);
check('clay bricks packed into a kiln count by the brick, a kilnful and then the rest',
  Number(isle.get('KILN1')) > 0 && n('fired:clay_brick') === 20, `${isle.get('KILN1')} then ${n('fired:clay_brick')}`);
check('a glass panel dyed counts as one', n('dyed:glass') === 1 && n('dyed') === 1);
check('a crop harvested counts by the crop', n('harvest:wheat') === 1);
check('fruit picked counts by the fruit', n('fruit:apple') === 1);
check('reeds cut count', n('reeds') === 1);
check('wildflowers and a skep\'s honey count by the season', SEASONS.includes(season as never) && n(`flowers:${season}`) === 1 && n(`skep:${season}`) === 1, season);
check('grapes picked count', n('grapes') === 1);
check('a map drawn counts', n('charted') === 1);
check('a masterwork signed counts', n('signed') === 1);
check('the sea and a spring\'s pond are told apart', isle.get('KINDS') === 'sea,pond', isle.get('KINDS'));
check('a fish out of each counts by the water', n('fished:sea') === 1 && n('fished:pond') === 1);
check('and a supreme one counts as a supreme catch', n('catch:supreme') === 2);
check('rpc_move hands its walk to journal_move', isle.get('MOVE_CALLS') === 'true');
check('every tile a hull goes into under your helm counts', n('sailed') > 100, `${n('sailed')}`);
check('round somewhere off the middle of the island is not round the island', isle.get('SMALL_LOOP') === '0');
check('three quarters of the way round is not round it', isle.get('THREE_QUARTERS') === '0');
check('right round it is', n('circled') === 1);
check('sailing onto the dragon\'s island is not landing on it', isle.get('ISLE_BY_HULL') === '0');
check('walking onto it is', n('landed:dragon') === 1);
check('a laden cart on somebody else\'s bridge does not count', isle.get('THEIR_BRIDGE') === '0');
check('on your own it does', n('cartbridge') === 1);
check('and none of it counts for anybody else', Object.keys(otto).length === 0, isle.get('OTTO'));

/* ---- the browser ----------------------------------------------------------- */

const fresh = (): Game => Game.create(3640);
const unmet = MINE.filter((x) => x.met(fresh())).map((x) => x.id);
check('none of them is met on a fresh game', unmet.length === 0, unmet.join(', '));

/** Each goal, and what meets it: the counts the island sends, or a state of your own. */
const DISHES = [...new Set(RECIPES.filter((r) => r.station === 'campfire' && r.category === 'Cooking').map((r) => r.result))];
const tallied: Record<string, Record<string, number>> = {
  bottle: { 'made:bottle': 1 }, tinted: { 'dyed:glass': n('dyed:glass') }, glazed: { glazed: n('glazed') },
  bricks: { 'fired:clay_brick': n('fired:clay_brick') }, signed: { signed: n('signed') }, jewel: { 'made:jewelled_pendant': 1 },
  arrows: { 'made:arrow': 30, 'made:bodkin_arrow': 20 }, rope: { 'made:rope': 1 }, charted: { charted: n('charted') },
  melted: { melted: n('melted') }, tanned: { 'made:leather': 1 }, improve70: { improved70: 10 }, coins: { minted: 1 },
  flour: { 'made:flour': 1 },
  crops: Object.fromEntries(CROP_LIST.map((c) => [`harvest:${c.produce}`, 1])),
  flowers: Object.fromEntries(FLOWER_SEASONS.map((s) => [`flowers:${s}`, 1])),
  skepyear: Object.fromEntries(SEASONS.filter((s) => s !== SKEP_IDLE).map((s) => [`skep:${s}`, 1])),
  grapes: { grapes: n('grapes') }, fruits: { 'fruit:apple': 1, 'fruit:cherry': 1, 'fruit:olive': 1, 'fruit:pear': 1 },
  cheese: { 'made:cheese': 1 }, milked: { 'milked:cudda': n('milked:cudda') }, sheared: { sheared: n('sheared') },
  dishes: Object.fromEntries(DISHES.slice(0, 10).map((d) => [`made:${d}`, 1])),
  roundisle: { circled: n('circled') }, volcano: { 'landed:dragon': n('landed:dragon') }, supremefish: { 'catch:supreme': n('catch:supreme') },
  reeds: { reeds: n('reeds') }, sailed: { sailed: 1000 }, cartbridge: { cartbridge: n('cartbridge') },
  waters: { 'fished:sea': n('fished:sea'), 'fished:pond': n('fished:pond') },
};
const short: Record<string, Record<string, number>> = {
  bricks: { 'fired:clay_brick': 19 }, arrows: { 'made:arrow': 49 }, improve70: { improved70: 9 }, sailed: { sailed: 999 },
  crops: Object.fromEntries(CROP_LIST.slice(1).map((c) => [`harvest:${c.produce}`, 1])),
  flowers: Object.fromEntries(FLOWER_SEASONS.slice(1).map((s) => [`flowers:${s}`, 1])),
  skepyear: { [`skep:${SKEP_IDLE}`]: 1, ...Object.fromEntries(SEASONS.filter((s) => s !== SKEP_IDLE).slice(1).map((s) => [`skep:${s}`, 1])) },
  fruits: { 'fruit:apple': 5, 'fruit:cherry': 1, 'fruit:olive': 1 }, dishes: Object.fromEntries(DISHES.slice(0, 9).map((d) => [`made:${d}`, 1])),
  waters: { 'fished:sea': 3 }, supremefish: { 'catch:rare': 1 },
};
for (const [id, tally] of Object.entries(tallied)) {
  const g = fresh();
  if (short[id]) {
    Object.assign(g.tally, short[id]);
    check(`${id}: not met one short`, !goal(id).met(g), JSON.stringify(short[id]));
  }
  const g2 = fresh();
  Object.assign(g2.tally, tally);
  check(`${id}: met by ${Object.keys(tally).join(', ')}`, goal(id).met(g2), JSON.stringify(tally));
}
const left = MINE.filter((x) => !(x.id in tallied)).map((x) => x.id).sort();
check('the rest read a state of your own', left.join() === 'compost,fishpond,lantern,larder,metalsuit,wellfed', left.join());

{
  // A full suit of metal: leather on the head is not, chain and plate together are.
  const g = fresh();
  const slots = [...new Set(ARMOUR.map((a) => a.slot))];
  for (const slot of slots) {
    const piece = ARMOUR.find((a) => a.slot === slot && MOULD_BY_MAKES.has(a.id) && (slot === 'head' ? a.cls === 'chain' : a.cls === 'plate'))!;
    g.equip(slot, g.inventory.add(piece.id, { ql: 40, extra: 'Iron' }).uid);
  }
  const metal = goal('metalsuit').met(g);
  g.equip('head', g.inventory.add('leather_cap', { ql: 40 }).uid);
  check('metalsuit: chain and plate in every slot is a full suit; leather on the head is not', metal && !goal('metalsuit').met(g));
}
{
  const g = fresh();
  g.tally['made:candle'] = 1;
  const lantern = g.inventory.add('lantern', { ql: 40 });
  lantern.charges = 600;
  const dark = goal('lantern').met(g);
  lantern.lit = true;
  check('lantern: candles drawn and a lantern alight in the pack', !dark && goal('lantern').met(g));
}
{
  const g = fresh();
  const c = g.creatures.spawn('middun', g.player.x + 2, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.work = emptyWork();
  const idle = goal('compost').met(g);
  c.work.made.compost = 3;
  check('compost: a worker of yours that has made compost', !idle && goal('compost').met(g));
  c.mine = false;
  check('compost: and not somebody else\'s', !goal('compost').met(g));
}
{
  const g = fresh();
  for (const k of NUTRIENTS) g.player.nutrition[k] = 1;
  const full = goal('wellfed').met(g);
  g.player.nutrition[NUTRIENTS[0]] = 0.5;
  check('wellfed: every nutrient full, and not with one at half', full && !goal('wellfed').met(g));
}
for (const [id, kind, fill] of [['larder', 'larder', 'bread'], ['fishpond', 'fish_pond', 'perch']] as const) {
  const g = fresh();
  const f = g.addFurniture(kind, Math.floor(g.player.x) + 3, Math.floor(g.player.y) + 3, 0, 0, 40);
  const room = furnitureCapacity(f);
  f.items.push({ uid: g.inventory.nextUid++, id: fill, ql: 30, dmg: 0, count: room - 1 });
  const nearly = goal(id).met(g);
  f.items[0].count = room;
  const full = goal(id).met(g);
  f.mine = false;
  check(`${id}: a ${kind.replace('_', ' ')} of yours full (${room}), not one short, not somebody else's`, !nearly && full && !goal(id).met(g));
}

// And the island's own counts, as it sent them, meet the goals they are for.
{
  const g = fresh();
  Object.assign(g.tally, bea);
  const want = ['tinted', 'glazed', 'signed', 'charted', 'melted', 'grapes', 'milked', 'sheared', 'roundisle', 'volcano', 'supremefish', 'reeds', 'cartbridge', 'waters', 'bricks'];
  const miss = want.filter((id) => !goal(id).met(g));
  check('the island\'s counts as sent meet their goals', miss.length === 0, miss.join(', '));
}

// Every count these goals read is noted somewhere on the island.
const keys = ['sheared', 'milked:', 'glazed', 'improved70', 'melted', 'fired:', 'dyed:', 'harvest:', 'fruit:', 'reeds', 'flowers:', 'skep:', 'grapes',
  'charted', 'signed', 'fished:', 'catch:', 'sailed', 'circled', 'landed:dragon', 'cartbridge', 'made:', 'minted'];
const defs = psql(`select string_agg(pg_get_functiondef(p.oid), ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%journal_note%'`);
const unnoted = keys.filter((k) => !defs.includes(`'${k}'`));
check(`every count these goals read is noted on the island (${keys.length})`, unnoted.length === 0, unnoted.join(', '));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthirty-six goals in the crafts, the land and the water — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
