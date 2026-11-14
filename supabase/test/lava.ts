/**
 * Volcano Isle's lava and heat (`src/game/lava.ts`, `20261120000065_volcano_lava.sql`), on both sides.
 *
 * Asked for: "a shifting labyrinth pattern daily of lava" on the upper slopes of Volcano Isle, deterministic off the
 * seed and the day, with always a way through, and a heat meter with three ways to manage it. Asked of an island of
 * its own made for the purpose (a cone on Volcano Isle's place on the chart, 1024 a side), and of the browser's rules
 * over the same ground:
 *
 *   * the day's maze (every room's open walls) the same on both sides for sixty days running, and every tile of the
 *     box the same lava on both sides today and tomorrow, and tomorrow's not today's;
 *   * a way with no lava on it from the foot of the band to the caldera, the summit's lair, a second lair's piece in
 *     the band and every seryll seam, on sixty days running (and on the live island's generated volcano, for a few);
 *   * no lava on a settlement, a road, a building, a piece set down or a lair's piece, though its block is lava;
 *   * health off a second on lava, nothing planted, dug or set down on it in the same words both sides, and no
 *     creature on it: never a tile of it that `creature_tile_ok` allows, and none ends a leg of an hour's wandering on it;
 *   * the heat filling in the band, twice as fast beside lava, taking health once full (only for the part of the
 *     stretch it was full) and draining below; each cooling way slowing it by its stated amount, and a cooling draught
 *     brewed, drunk and refused;
 *   * and what it costs: the maze made and a tile asked, on both sides.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { World } from '../../src/world/world';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { chartRegion } from '../../src/world/chart';
import { generateAtlasWindow } from '../../src/world/atlas-world';
import { readAtlas } from '../../tools/atlas-node';
import { ROCK_VARIANTS, TileType } from '../../src/world/tiles';
import {
  DRAUGHT_DROP, DRAUGHT_FILL, DRAUGHT_NOT, DRAUGHT_SECS, draughtSaid, HEAT_BURN, HEAT_DRAIN, HEAT_FILL, HEAT_ICE, HEAT_NEAR, HEAT_SAID,
  HEAT_SCALE, heatMul, heatStep, LAVA_BAND, LAVA_BOX, LAVA_BURN, LAVA_CELL, LAVA_ISLE, LAVA_SAID, LAVA_SEAM, LAVA_SPARED_TILES, lavaAt, lavaBand,
  lavaBlock, lavaDay, lavaGrid, lavaInBox, type LavaLand, lavaPart, lavaPasses, lavaSalt,
} from '../../src/game/lava';
import { psql, check, finish } from './harness';

const SIZE = 1024;
const SEED = 4242;
/** The cone's summit: on Volcano Isle's place on the chart, in the middle of the box. */
const PX = 520;
const PY = 105;
/** Rows of corners laid; below them the ground is nought on both sides. */
const ROWS = 200;
const U = '1a7a0000-0000-4000-8000-0000000000a1';

/** The cone: a hundred up, rising four a tile to the summit. */
const H = (cx: number, cy: number): number => (cy > ROWS ? 0 : 100 + Math.max(0, 560 - Math.floor(4 * Math.sqrt((cx - PX) ** 2 + (cy - PY) ** 2))));

/* ---- the ground, on the browser's side ----------------------------------------------------------------------------- */

const heights = new Int16Array((SIZE + 1) * (SIZE + 1));
for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) heights[y * (SIZE + 1) + x] = H(x, y);
const tiles = new Uint8Array(SIZE * SIZE);
const rock = new Uint8Array(SIZE * SIZE);
const key = (x: number, y: number): number => y * SIZE + x;
const spared = new Set<number>();
const lairs = new Set<number>();
const land: LavaLand = {
  size: SIZE,
  seed: SEED,
  height: (cx, cy) => heights[Math.min(SIZE, Math.max(0, cy)) * (SIZE + 1) + Math.min(SIZE, Math.max(0, cx))],
  rock: (x, y) => rock[key(x, y)],
  tile: (x, y) => tiles[key(x, y)],
  spared: (x, y) => spared.has(key(x, y)) || lairs.has(key(x, y)),
  lair: (x, y) => lairs.has(key(x, y)),
};

const g = lavaGrid(SIZE);
const X0 = g.bx0 * LAVA_CELL, Y0 = g.by0 * LAVA_CELL;
const X1 = (g.bx0 + 2 * g.cols - 1) * LAVA_CELL, Y1 = (g.by0 + 2 * g.rows - 1) * LAVA_CELL;
const TODAY = lavaDay(Date.now() / 1000);
const blocks = (want: (bx: number, by: number) => boolean): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let by = g.by0; by < g.by0 + 2 * g.rows - 1; by++) for (let bx = g.bx0; bx < g.bx0 + 2 * g.cols - 1; bx++) if (want(bx, by)) out.push([bx, by]);
  return out;
};
const mid = ([bx, by]: [number, number]): [number, number] => [bx * LAVA_CELL + 1, by * LAVA_CELL + 1];
const taken = new Set<string>();
const take = (list: Array<[number, number]>, avoid: (b: [number, number]) => boolean = () => false): [number, number] => {
  const b = list.find((b) => !taken.has(`${b[0]},${b[1]}`) && !avoid(b));
  if (!b) throw new Error('no block left to choose');
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) taken.add(`${b[0] + dx},${b[1] + dy}`);
  return b;
};

// What must be reached: a seam in a pillar of the band, a seam in a closed wall, a second lair's piece in a pillar.
const bandPillars = blocks((bx, by) => lavaPart(SIZE, bx, by).part === 'pillar' && lavaBand(land, bx, by));
const seamPillar = take(bandPillars);
const seamWall = take(blocks((bx, by) => lavaPart(SIZE, bx, by).part === 'east' && lavaBlock(land, TODAY, bx, by)));
const lairPillar = take(bandPillars);
const SEAMS: Array<[number, number]> = [[seamPillar[0] * LAVA_CELL + 2, seamPillar[1] * LAVA_CELL], [seamWall[0] * LAVA_CELL + 1, seamWall[1] * LAVA_CELL + 2]];
for (const [x, y] of SEAMS) rock[key(x, y)] = LAVA_SEAM;
const OGRE: [number, number] = [lairPillar[0] * LAVA_CELL, lairPillar[1] * LAVA_CELL + 1];
lairs.add(key(OGRE[0], OGRE[1]));
lairs.add(key(PX, PY));
// Blocks lava today, for what lava spares and for a body to stand on; and a room in the band.
const lavaToday = blocks((bx, by) => lavaPart(SIZE, bx, by).part !== 'room' && lavaBlock(land, TODAY, bx, by));
const [ROAD, HUT, CHEST, DEED, HOT, DUG] = [0, 1, 2, 3, 4, 5].map(() => mid(take(lavaToday)));
const ROOM = mid(take(blocks((bx, by) => lavaPart(SIZE, bx, by).part === 'room' && lavaBand(land, bx, by))));
tiles[key(ROAD[0], ROAD[1])] = TileType.Cobblestone;
for (const t of [HUT, CHEST]) spared.add(key(t[0], t[1]));
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) spared.add(key(DEED[0] + dx, DEED[1] + dy));
const FOOT: [number, number] = [X0, Y0];
check('the summit is caldera ground on Volcano Isle, and the box corner below the band', chartRegion(PX + 0.5, PY + 0.5, SIZE) === LAVA_ISLE
  && H(PX, PY) >= LAVA_BAND.caldera && H(FOOT[0], FOOT[1]) < LAVA_BAND.foot, `${H(PX, PY)} ${H(FOOT[0], FOOT[1])}`);

/* ---- the island ------------------------------------------------------------------------------------------------------ */

const hex16 = (v: number): string => (v & 255).toString(16).padStart(2, '0') + ((v >> 8) & 255).toString(16).padStart(2, '0');
const rowsSql = Array.from({ length: ROWS + 1 }, (_, y) => {
  let s = '';
  for (let x = 0; x <= SIZE; x++) s += hex16(H(x, y));
  return `(${y}, '${s}')`;
}).join(',\n');
const tileSql = (x: number, y: number, col: 'tiles' | 'rock', v: number): string =>
  `update land_tile set ${col} = set_byte(${col}, ${x}, ${v}) where world_id = w and y = ${y};`;
const DAYS = 60;
const boxBits = (day: string): string =>
  `string_agg(case when lava_on(w, ${SIZE}, x, y, ${day}) then '1' else '0' end, '' order by y, x) from generate_series(${Y0}, ${Y1 - 1}) y, generate_series(${X0}, ${X1 - 1}) x`;
const stand = (t: [number, number], heat: number, secs: number, extra = ''): string =>
  `update player set x = ${t[0]}.5, y = ${t[1]}.5, level = 0, away = false, body_at = now() - interval '${secs} seconds',
     stats = '{"health": 1, "stamina": 1, "hunger": 0, "thirst": 0, "heat": ${heat}${extra}}'::jsonb where world_id = w and uid = '${U}';
   perform body_settle(w, '${U}');`;
const statsOf = `(select (stats->>'health') || ':' || (stats->>'heat') from player where world_id = w and uid = '${U}')`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table rows_in (y int, hex text);
insert into rows_in values
${rowsSql};
do $t$
declare w uuid; v_t timestamptz; v_n int; v_id bigint; v_ids bigint[]; c record; i int; v_day int := lava_day_of(now());
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Lava', ${SEED}, ${SIZE}, ${ROOM[0]}, ${ROOM[1]}, true) returning id into w;
  perform land_blank(w, ${SIZE});
  update land_corner c set heights = decode(r.hex, 'hex') from rows_in r where c.world_id = w and c.y = r.y;
  ${SEAMS.map(([x, y]) => tileSql(x, y, 'rock', LAVA_SEAM)).join('\n  ')}
  ${tileSql(ROAD[0], ROAD[1], 'tiles', TileType.Cobblestone)}
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ash', ${DEED[0]}, ${DEED[1]}, 1, 1, '${U}');
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hut', 1, '${U}');
  insert into building_tile (world_id, building, x, y) values (w, 1, ${HUT[0]}, ${HUT[1]});
  insert into placed (world_id, kind, sub, x, y, cx, cy) values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, ${CHEST[0]}.5, ${CHEST[1]}.5);
  perform lair_piece(w, 'dragon_roost', ${PX}, ${PY});
  perform lair_piece(w, 'ogre_cave', ${OGRE[0]}, ${OGRE[1]});
  insert into said values ('DAY', v_day::text);

  -- Both sides' numbers.
  insert into said values ('NUMS', lava_cell() || '|' || lava_foot() || '|' || lava_caldera() || '|' || array_to_string(lava_box(), ',') || '|' || lava_isle() || '|'
    || lava_seam() || '|' || lava_burn() || '|' || array_to_string(lava_spared_tiles(), ',') || '|' || heat_fill() || '|' || heat_near() || '|' || heat_drain() || '|'
    || heat_burn() || '|' || heat_scale() || '|' || heat_ice() || '|' || draught_fill() || '|' || draught_secs() || '|' || draught_drop());
  insert into said select 'GRID', bx0 || '|' || by0 || '|' || cols || '|' || rows from lava_grid(${SIZE});
  insert into said values ('SALT', lava_salt(${SEED}) || '|' || lava_salt(-5) || '|' || lava_salt(9876543210));
  insert into said values ('WORDS', lava_said() || '|' || draught_said() || '|' || draught_not_said() || '|' || heat_full_said() || '|' || heat_lava_said());

  -- ---- The maze, sixty days, and the box today and tomorrow -------------------------------------------------------
  insert into said select 'PASSES', d || '|' || encode(lava_passes_make(${SEED}, ${SIZE}, d), 'hex') from generate_series(v_day, v_day + ${DAYS - 1}) d;
  insert into said select 'READY', lava_ready(w) || '|' || lava_ready(w) || '|' || (select string_agg(day::text, ',' order by day) from lava_day where world_id = w);
  insert into said select 'BOX0', ${boxBits('v_day')};
  insert into said select 'BOX1', ${boxBits('v_day + 1')};
  insert into said select 'OFFBOX', count(*) filter (where lava_on(w, ${SIZE}, x, y)) from generate_series(0, ${SIZE - 1}, 7) x, generate_series(0, ${SIZE - 1}, 7) y
   where not lava_in_box(${SIZE}, x, y);
  insert into said values ('SPARED', ${[ROAD, HUT, CHEST, DEED, OGRE, [PX, PY]].map(([x, y]) => `lava_at(w, ${x}, ${y})::text || ':' || lava_block(w, ${SIZE}, ${Math.floor(x / LAVA_CELL)}, ${Math.floor(y / LAVA_CELL)}, v_day)::text`).join(` || '|' || `)});

  -- ---- Creatures ------------------------------------------------------------------------------------------------------
  insert into said select 'CREATURE', string_agg(case when creature_tile_ok(w, x, y) then '1' else '0' end, '' order by y, x)
    from generate_series(${Y0}, ${Y1 - 1}) y, generate_series(${X0}, ${X1 - 1}) x;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex) values
    (w, 9801, 'roxxen', 'A', 'wild', ${ROOM[0]}.5, ${ROOM[1]}.5, ${ROOM[0]}.5, ${ROOM[1]}.5, 90, 'female'),
    (w, 9802, 'roxxen', 'B', 'wild', ${ROOM[0]}.5, ${ROOM[1]}.5, ${ROOM[0]}.5, ${ROOM[1]}.5, 90, 'male'),
    (w, 9803, 'roxxen', 'C', 'wild', ${ROOM[0]}.5, ${ROOM[1]}.5, ${ROOM[0]}.5, ${ROOM[1]}.5, 90, 'female');
  for i in 1 .. 40 loop
    update creature set until = now() - interval '90 seconds', settled_at = now() - interval '90 seconds', leg_ends = now() - interval '90 seconds',
        leg_at = now() - interval '91 seconds', hunting = null where world_id = w and id between 9801 and 9803;
    for c in select id from creature where world_id = w and id between 9801 and 9803 loop perform creature_settle(w, c.id); end loop;
    insert into said select 'LEG', floor(from_x)::int || ',' || floor(from_y)::int || ',' || floor(to_x)::int || ',' || floor(to_y)::int
      from creature where world_id = w and id between 9801 and 9803;
  end loop;

  -- ---- A body ---------------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', '${U}')::text, true);
  perform rpc_join(w, 'Ember');
  update player set aboard = null where world_id = w and uid = '${U}';
  -- On lava, ten seconds: its burn, and the meter filling twice as fast.
  ${stand(HOT, 0, 10)}
  insert into said select 'ONLAVA', ${statsOf} || '|' || coalesce((select string_agg(text, '/') from event where world_id = w and uid = '${U}' and text = heat_lava_said()), '-');
  -- A room of the band, nothing beside it: filling at the rate.
  ${stand(ROOM, 0, 60)}
  insert into said select 'BAND', ${statsOf};
  -- Full there: health off.
  ${stand(ROOM, 1, 10)}
  insert into said select 'FULL', ${statsOf} || '|' || coalesce((select string_agg(text, '/') from event where world_id = w and uid = '${U}' and text = heat_full_said()), '-');
  -- Filling to full part of the way through a minute: health off only for the rest.
  ${stand(ROOM, 0.9, 60)}
  insert into said select 'TOFULL', ${statsOf};
  -- Below the band: draining.
  ${stand(FOOT, 1, 30)}
  insert into said select 'DRAIN', ${statsOf};

  -- ---- What cools it ---------------------------------------------------------------------------------------------------
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', '${U}', 'scale_helm', 50) returning id into v_id; v_ids := array[v_id];
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', '${U}', 'scale_cuirass', 50) returning id into v_id; v_ids := v_ids || v_id;
  insert into item (world_id, holder, holder_uid, def, ql, infuse) values (w, 'player', '${U}', 'leather_boots', 50,
    jsonb_build_object('el', 'ice', 'str', 1, 'until', extract(epoch from now()) + 3600)) returning id into v_id; v_ids := v_ids || v_id;
  insert into item (world_id, holder, holder_uid, def, ql, infuse) values (w, 'player', '${U}', 'leather_trousers', 50,
    jsonb_build_object('el', 'ice', 'str', 0.6, 'until', extract(epoch from now()) + 3600)) returning id into v_id; v_ids := v_ids || v_id;
  update player set equipped = '{}'::jsonb where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'none|' || heat_mul(w, '${U}', null);
  update player set equipped = jsonb_build_object('head', v_ids[1]) where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'scale1|' || heat_mul(w, '${U}', null);
  update player set equipped = jsonb_build_object('head', v_ids[1], 'chest', v_ids[2]) where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'scale2|' || heat_mul(w, '${U}', null);
  update player set equipped = jsonb_build_object('feet', v_ids[3]) where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'ice1|' || heat_mul(w, '${U}', null);
  update player set equipped = jsonb_build_object('legs', v_ids[4]) where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'ice06|' || heat_mul(w, '${U}', null);
  update player set equipped = '{}'::jsonb where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'draught|' || heat_mul(w, '${U}', extract(epoch from now()) + 60);
  insert into said select 'MUL', 'spent|' || heat_mul(w, '${U}', extract(epoch from now()) - 60);
  update player set equipped = jsonb_build_object('head', v_ids[1], 'chest', v_ids[2], 'feet', v_ids[3], 'legs', v_ids[4]) where world_id = w and uid = '${U}';
  insert into said select 'MUL', 'all|' || heat_mul(w, '${U}', extract(epoch from now()) + 60);
  -- And a minute in the band in two scale pieces: the fill at its share.
  update player set equipped = jsonb_build_object('head', v_ids[1], 'chest', v_ids[2]) where world_id = w and uid = '${U}';
  ${stand(ROOM, 0, 60)}
  insert into said select 'COOLED', ${statsOf};
  update player set equipped = '{}'::jsonb where world_id = w and uid = '${U}';

  -- ---- The draught: brewed, drunk, refused -----------------------------------------------------------------------------
  insert into said select 'RECIPE', r.result || '|' || r.count || '|' || r.skill || '|'
    || (select string_agg(ri.item || ':' || coalesce(ri.count, 1) || ':' || coalesce(ri.litres::text, '-'), ',' order by ri.item) from recipe_input ri where ri.recipe = r.id)
    from recipe r where r.id = 'brew_cooling_draught';
  update player set x = ${ROOM[0]}.5, y = ${ROOM[1]}.5 where world_id = w and uid = '${U}';
  perform give(w, '${U}', 'mint', 2, 60);
  perform give(w, '${U}', 'water_bucket', 1, 60);
  perform give(w, '${U}', 'ice_mote', 1, 60);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0', true);
  perform perform_craft(w, '${U}', 'brew_cooling_draught', '{}'::jsonb);
  perform set_config('search_path', 'public, pg_catalog', true);
  insert into said select 'BREWED', coalesce(sum(count), 0) || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = '${U}' and def in ('mint', 'ice_mote'))
    from item where world_id = w and holder = 'player' and holder_uid = '${U}' and def = 'cooling_draught';
  select id into v_id from item where world_id = w and holder = 'player' and holder_uid = '${U}' and def = 'cooling_draught' limit 1;
  update player set stats = stats || '{"heat": 0.8}'::jsonb where world_id = w and uid = '${U}';
  insert into said values ('NOTONE', coalesce(item_refusal(w, '${U}', 'drink_draught', jsonb_build_object('kind', 'item', 'uid',
    (select id from item where world_id = w and holder = 'player' and holder_uid = '${U}' and def = 'water_bucket' limit 1))), '-'));
  insert into said values ('ASK', coalesce(act_refusal(w, '${U}', 'drink_draught', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ok'));
  perform perform_item(w, '${U}', 'drink_draught', jsonb_build_object('kind', 'item', 'uid', v_id));
  insert into said select 'DRUNK', (stats->>'heat') || '|' || round(((stats->>'cool')::double precision - extract(epoch from now()))::numeric) || '|'
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = '${U}' and def = 'cooling_draught') || '|'
    || coalesce((select text from event where world_id = w and uid = '${U}' and text = draught_said() limit 1), '-')
    from player where world_id = w and uid = '${U}';
  -- Drunk, a minute in the band fills at half.
  update player set body_at = now() - interval '60 seconds', x = ${ROOM[0]}.5, y = ${ROOM[1]}.5, stats = stats || '{"heat": 0, "hunger": 0, "thirst": 0, "health": 1}'::jsonb
   where world_id = w and uid = '${U}';
  perform body_settle(w, '${U}');
  insert into said select 'DRAUGHT', ${statsOf};

  -- ---- Refused on lava -----------------------------------------------------------------------------------------------------
  update player set x = ${HOT[0] - 1}.5, y = ${HOT[1]}.5 where world_id = w and uid = '${U}';
  insert into said values ('REFUSE', coalesce(act_refusal(w, '${U}', 'plant', jsonb_build_object('kind', 'tile', 'x', ${HOT[0]}, 'y', ${HOT[1]})), '-')
    || '|' || coalesce(act_refusal(w, '${U}', 'place_furniture', jsonb_build_object('kind', 'tile', 'x', ${HOT[0]}, 'y', ${HOT[1]})), '-')
    || '|' || coalesce(act_refusal(w, '${U}', 'found_settlement', jsonb_build_object('kind', 'tile', 'x', ${HOT[0]}, 'y', ${HOT[1]})), '-'));
  update player set x = ${DUG[0] - 1}.5, y = ${DUG[1]}.5 where world_id = w and uid = '${U}';
  insert into said values ('DIG', coalesce(act_refusal(w, '${U}', 'dig', jsonb_build_object('kind', 'tile', 'x', ${DUG[0]}, 'y', ${DUG[1]}, 'cx', ${DUG[0]}, 'cy', ${DUG[1]})), '-'));
  update player set x = ${ROOM[0]}.5, y = ${ROOM[1]}.5 where world_id = w and uid = '${U}';
  insert into said values ('ROOMOK', coalesce(lava_ground_refusal(w, '${U}', 'plant', jsonb_build_object('kind', 'tile', 'x', ${ROOM[0]}, 'y', ${ROOM[1]})), 'ok'));

  -- ---- What it costs --------------------------------------------------------------------------------------------------------
  v_t := clock_timestamp();
  perform lava_passes_make(${SEED}, 4096, v_day);
  insert into said values ('T_MAKE', round(extract(epoch from clock_timestamp() - v_t)::numeric * 1000, 1)::text);
  v_t := clock_timestamp();
  select count(*) filter (where lava_on(w, ${SIZE}, x, y)) into v_n from generate_series(${Y0}, ${Y1 - 1}) y, generate_series(${X0}, ${X1 - 1}) x;
  insert into said values ('T_BOX', round((extract(epoch from clock_timestamp() - v_t) * 1e6 / ${(X1 - X0) * (Y1 - Y0)})::numeric, 1)::text);
  v_t := clock_timestamp();
  select count(*) filter (where lava_on(w, ${SIZE}, x, y)) into v_n from generate_series(700, 899) y, generate_series(700, 799) x;
  insert into said values ('T_OFF', round((extract(epoch from clock_timestamp() - v_t) * 1e6 / 20000)::numeric, 2)::text);
  v_t := clock_timestamp();
  for i in 1 .. 200 loop perform body_settle(w, '${U}'); end loop;
  insert into said values ('T_SETTLE', round((extract(epoch from clock_timestamp() - v_t) * 1000 / 200)::numeric, 3)::text);
end $t$;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => said(k)[0] ?? '';
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

/* ---- both sides' numbers ------------------------------------------------------------------------------------------- */

console.log('--- numbers');
check('every number the same on both sides', one('NUMS') === [LAVA_CELL, LAVA_BAND.foot, LAVA_BAND.caldera, LAVA_BOX.join(','), LAVA_ISLE, LAVA_SEAM, LAVA_BURN,
  LAVA_SPARED_TILES.join(','), HEAT_FILL, HEAT_NEAR, HEAT_DRAIN, HEAT_BURN, HEAT_SCALE, HEAT_ICE, DRAUGHT_FILL, DRAUGHT_SECS, DRAUGHT_DROP].join('|'), one('NUMS'));
check('the seam is seryll, the island Volcano Isle', ROCK_VARIANTS[LAVA_SEAM]?.yields === 'seryll_ore' && LAVA_ISLE >= 0);
check('the grid the same on both sides', one('GRID') === [g.bx0, g.by0, g.cols, g.rows].join('|'), `${one('GRID')} / ${[g.bx0, g.by0, g.cols, g.rows].join('|')}`);
check('the salt the same on both sides, a negative seed and a long one too', one('SALT') === [lavaSalt(SEED), lavaSalt(-5), lavaSalt(9876543210)].join('|'), one('SALT'));
check('every word the same on both sides', one('WORDS') === [LAVA_SAID, draughtSaid, DRAUGHT_NOT, HEAT_SAID.full, HEAT_SAID.lava].join('|'), one('WORDS'));
const DAY = Number(one('DAY'));
check(`the day the same on both sides (${DAY})`, DAY === TODAY, `${DAY} / ${TODAY}`);

/* ---- the maze ------------------------------------------------------------------------------------------------------- */

console.log('--- the maze');
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const passes = said('PASSES').map((s) => s.split('|'));
const differ = passes.filter(([d, h]) => hex(lavaPasses(SIZE, SEED, Number(d))) !== h);
check(`the day's maze the same on both sides, ${DAYS} days running (${g.cols} × ${g.rows} rooms)`, passes.length === DAYS && !differ.length, differ.map(([d]) => d).join(','));
{
  const p = lavaPasses(SIZE, SEED, DAY);
  let open = 0;
  for (const b of p) open += (b & 1) + ((b >> 1) & 1);
  check('a spanning tree: rooms − 1 walls open', open === g.cols * g.rows - 1, `${open} of ${g.cols * g.rows}`);
  const next = lavaPasses(SIZE, SEED, DAY + 1);
  let same = 0;
  for (let i = 0; i < p.length; i++) if (p[i] === next[i]) same++;
  check('the next day a different maze', hex(p) !== hex(next), `${same} of ${p.length} rooms the same`);
}
check('today and tomorrow kept, each once', one('READY') === `2|0|${DAY},${DAY + 1}`, one('READY'));
const boxTs = (day: number): string => {
  let s = '';
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) s += lavaAt(land, day, x, y) ? '1' : '0';
  return s;
};
const box0 = boxTs(DAY);
const box1 = boxTs(DAY + 1);
const firstDiff = (a: string, b: string): string => {
  const i = [...a].findIndex((c, k) => c !== b[k]);
  return i < 0 ? '' : `at ${X0 + (i % (X1 - X0))},${Y0 + Math.floor(i / (X1 - X0))}: island ${a[i]} browser ${b[i]}`;
};
check(`every tile of the box the same lava on both sides today (${(X1 - X0) * (Y1 - Y0)} tiles)`, one('BOX0') === box0, firstDiff(one('BOX0'), box0));
check('and tomorrow', one('BOX1') === box1, firstDiff(one('BOX1'), box1));
check('tomorrow\'s lava is not today\'s', box0 !== box1);
{
  let band = 0, hot = 0;
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const bx = Math.floor(x / LAVA_CELL), by = Math.floor(y / LAVA_CELL);
      if (!lavaBand(land, bx, by)) continue;
      band++;
      if (box0[(y - Y0) * (X1 - X0) + (x - X0)] === '1') hot++;
    }
  }
  check('the band a maze of it: between a third and two thirds of its tiles lava', hot > band / 3 && hot < (2 * band) / 3, `${hot} of ${band}`);
  console.log(`  lava today: ${hot} of the band's ${band} tiles`);
}
check('no lava off the box', one('OFFBOX') === '0', one('OFFBOX'));

/* ---- always a way through --------------------------------------------------------------------------------------------- */

console.log('--- a way through, sixty days');
/** Every tile reachable from `from` over tiles with no lava, inside a box and four ways. */
const reach = (L: LavaLand, day: number, from: [number, number], box: [number, number, number, number]): Set<number> => {
  const [bx0, by0, bx1, by1] = box;
  const seen = new Set<number>([from[1] * L.size + from[0]]);
  const q: number[] = [from[1] * L.size + from[0]];
  while (q.length) {
    const k = q.pop()!;
    const x = k % L.size, y = Math.floor(k / L.size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
      const nk = ny * L.size + nx;
      if (seen.has(nk) || lavaAt(L, day, nx, ny)) continue;
      seen.add(nk);
      q.push(nk);
    }
  }
  return seen;
};
const goals: Array<[string, [number, number]]> = [['caldera', [PX + 20, PY]], ['summit lair', [PX, PY]], ['lair in the band', OGRE], ...SEAMS.map((s, i): [string, [number, number]] => [`seam ${i + 1}`, s])];
{
  const missed: string[] = [];
  for (let d = DAY; d < DAY + DAYS; d++) {
    const r = reach(land, d, FOOT, [X0 - 1, Y0 - 1, X1, Y1]);
    for (const [name, [x, y]] of goals) if (!r.has(y * SIZE + x)) missed.push(`${d}:${name}`);
  }
  check(`from the foot to the caldera, the summit lair, the lair in the band and both seams, ${DAYS} days running`, !missed.length, missed.slice(0, 8).join(', '));
  check('the caldera is caldera ground', H(PX + 20, PY) >= LAVA_BAND.caldera, String(H(PX + 20, PY)));
}

/* ---- what lava spares ------------------------------------------------------------------------------------------------- */

console.log('--- spared');
{
  const s = one('SPARED').split('|');
  const names = ['a road', 'a building', 'a piece set down', 'a settlement', 'the lair in the band', 'the summit lair'];
  names.forEach((n, i) => {
    const [at, block] = s[i]?.split(':') ?? [];
    const t = [ROAD, HUT, CHEST, DEED, OGRE, [PX, PY] as [number, number]][i];
    const ts = lavaAt(land, DAY, t[0], t[1]);
    check(`no lava on ${n}${i < 4 ? ', its block lava' : ', its block open'}`, at === 'false' && !ts && block === (i < 4 ? 'true' : 'false'), s[i]);
  });
}

/* ---- creatures ------------------------------------------------------------------------------------------------------------ */

console.log('--- creatures');
{
  const ok = one('CREATURE');
  let bad = 0, room = 0;
  for (let i = 0; i < box0.length; i++) {
    if (box0[i] === '1' && ok[i] === '1') bad++;
    if (box0[i] === '0' && ok[i] === '1') room++;
  }
  check('no tile of lava a creature may step on', ok.length === box0.length && bad === 0, `${bad}`);
  check('and the ground beside it walkable', room > 1000, String(room));
  const legs = said('LEG').map((l) => l.split(',').map(Number));
  const onLava = legs.filter(([fx, fy, tx, ty]) => lavaAt(land, DAY, fx, fy) || lavaAt(land, DAY, tx, ty));
  const moved = legs.filter(([fx, fy, tx, ty]) => fx !== tx || fy !== ty).length;
  check(`no leg of forty rounds of wandering in the band ends or starts on lava (${legs.length} legs, ${moved} moved)`, legs.length === 120 && !onLava.length && moved > 0,
    onLava.slice(0, 3).map((l) => l.join(',')).join(' '));
}

/* ---- the heat ---------------------------------------------------------------------------------------------------------------- */

console.log('--- heat');
const hs = (k: string): [number, number] => {
  const [h, t] = one(k).split('|')[0].split(':').map(Number);
  return [h, t];
};
{
  const [h, t] = hs('ONLAVA');
  const want = heatStep(0, 1, 10, { up: true, near: true, on: true, mul: 1 });
  check(`on lava ten seconds: health −${10 * LAVA_BURN}, heat ×${HEAT_NEAR} the fill`, near(h, want.health) && near(t, want.heat) && near(h, 1 - 10 * LAVA_BURN) && near(t, 10 * HEAT_FILL * HEAT_NEAR),
    `${h} ${t}`);
  check('and told', one('ONLAVA').split('|')[1] === HEAT_SAID.lava, one('ONLAVA'));
}
{
  const [h, t] = hs('BAND');
  check(`a minute in the band beside no lava: heat +${60 * HEAT_FILL}, health whole`, near(h, 1) && near(t, 60 * HEAT_FILL), `${h} ${t}`);
}
{
  const [h, t] = hs('FULL');
  check(`full, ten seconds in the band: health −${10 * HEAT_BURN}`, near(h, 1 - 10 * HEAT_BURN) && near(t, 1), `${h} ${t}`);
  check('and told', one('FULL').split('|')[1] === HEAT_SAID.full, one('FULL'));
}
{
  const [h, t] = hs('TOFULL');
  const want = heatStep(0.9, 1, 60, { up: true, near: false, on: false, mul: 1 });
  check(`full part of the way through a minute: health off only for the rest (${want.health.toFixed(3)})`, near(h, want.health) && near(t, 1)
    && near(want.health, 1 - (60 - 0.1 / HEAT_FILL) * HEAT_BURN), `${h} ${t}`);
}
{
  const [h, t] = hs('DRAIN');
  check(`below the band half a minute: heat −${30 * HEAT_DRAIN}`, near(h, 1) && near(t, 1 - 30 * HEAT_DRAIN), `${h} ${t}`);
}

console.log('--- cooling');
{
  const mul = new Map(said('MUL').map((l) => l.split('|') as [string, string]));
  const want: Array<[string, number]> = [
    ['none', heatMul(0, [], false)], ['scale1', heatMul(1, [], false)], ['scale2', heatMul(2, [], false)], ['ice1', heatMul(0, [1], false)],
    ['ice06', heatMul(0, [0.6], false)], ['draught', heatMul(0, [], true)], ['spent', heatMul(0, [], false)], ['all', heatMul(2, [1, 0.6], true)],
  ];
  for (const [k, v] of want) check(`fill ×${v.toFixed(4)}: ${k}, the same on both sides`, near(Number(mul.get(k)), v, 1e-9), String(mul.get(k)));
  check('each way by its stated amount', near(heatMul(1, [], false), 1 - HEAT_SCALE) && near(heatMul(0, [1], false), 1 - HEAT_ICE) && near(heatMul(0, [0.6], false), 1 - HEAT_ICE * 0.6)
    && near(heatMul(0, [], true), DRAUGHT_FILL) && near(heatMul(2, [], false), (1 - HEAT_SCALE) ** 2));
  const [h, t] = hs('COOLED');
  check('a minute in the band in two scale pieces: the fill at its share', near(h, 1) && near(t, 60 * HEAT_FILL * (1 - HEAT_SCALE) ** 2), `${h} ${t}`);
}

console.log('--- the draught');
{
  const r = RECIPE_BY_ID.get('brew_cooling_draught');
  const ts = r ? `${r.result}|${r.count ?? 1}|${r.skill}|${[...r.inputs].sort((a, b) => a.item.localeCompare(b.item)).map((i) => `${i.item}:${i.count ?? 1}:${i.litres ?? '-'}`).join(',')}` : '-';
  check('the recipe the same on both sides: mint, water and an ice mote', one('RECIPE') === ts && ts.includes('mint:2') && ts.includes('ice_mote:1') && ts.includes('water_bucket:1:1'),
    `${one('RECIPE')} / ${ts}`);
  check('brewed: two draughts, the mint and the mote used', one('BREWED') === `${r?.count ?? 0}|0`, one('BREWED'));
  check('refused for what is not a draught, in the browser\'s words', one('NOTONE') === DRAUGHT_NOT, one('NOTONE'));
  check('a draught may be drunk', one('ASK') === 'ok', one('ASK'));
  const [heat, cool, left, told] = one('DRUNK').split('|');
  check(`drunk: heat −${DRAUGHT_DROP}, cooled ${DRAUGHT_SECS} s, one gone, told`, near(Number(heat), 0.8 - DRAUGHT_DROP) && Math.abs(Number(cool) - DRAUGHT_SECS) <= 1
    && left === String((r?.count ?? 0) - 1) && told === draughtSaid, one('DRUNK'));
  const [h, t] = hs('DRAUGHT');
  check(`a minute in the band, drunk: the fill ×${DRAUGHT_FILL}`, near(h, 1) && near(t, 60 * HEAT_FILL * DRAUGHT_FILL), `${h} ${t}`);
}

/* ---- refused on lava, both sides ---------------------------------------------------------------------------------------------- */

console.log('--- refused');
{
  const [plant, place, found] = one('REFUSE').split('|');
  check('planting, setting down and founding on lava refused, in the browser\'s words', plant === LAVA_SAID && place === LAVA_SAID && found === LAVA_SAID, one('REFUSE'));
  check('digging a corner of lava refused', one('DIG') === LAVA_SAID, one('DIG'));
  check('a room of the band is not lava', one('ROOMOK') === 'ok', one('ROOMOK'));
  // The browser's game, over the same ground (lairs and spares aside, which its own lists hold).
  const world = new World(SIZE, SIZE, heights, tiles, new Uint8Array(SIZE * SIZE), new Uint8Array((SIZE + 1) * (SIZE + 1)).fill(20), rock);
  world.seed = SEED;
  const game = new Game({ seed: SEED, world, spawn: { x: ROOM[0], y: ROOM[1] } });
  const bare: LavaLand = { ...land, spared: () => false, lair: () => false, tile: (x, y) => world.getTile(x, y) };
  let differ = 0;
  for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) if (game.lavaAt(x, y) !== lavaAt(bare, DAY, x, y)) differ++;
  check('the browser\'s game asks the same lava of its own ground', differ === 0, String(differ));
  const t = { kind: 'tile' as const, x: HOT[0], y: HOT[1], cx: HOT[0], cy: HOT[1] };
  check('the browser refuses planting and setting down on lava in the same words', ACTION_BY_ID.get('plant')?.check?.(t, game) === LAVA_SAID
    && ACTION_BY_ID.get('place_furniture')?.check?.(t, game) === LAVA_SAID);
  check('and no creature of its steps there', !game.creatures.tileOk(game, HOT[0], HOT[1]) && game.creatures.tileOk(game, ROOM[0], ROOM[1]));
}

/* ---- the live island's volcano ------------------------------------------------------------------------------------------------- */

console.log('--- the live island\'s volcano, seed 7, 4096 (the browser\'s rules)');
{
  const BIG = 4096;
  const atlas = readAtlas();
  const gb = lavaGrid(BIG);
  // Volcano Isle's whole box on the chart, and a little more.
  const wx0 = 1100, wy0 = 0, ww = 2000, wh = 1250;
  const t0 = performance.now();
  const win = generateAtlasWindow(7, atlas, wx0, wy0, ww, wh, BIG);
  const gen = performance.now() - t0;
  const hAt = (cx: number, cy: number): number => win.heights[(Math.min(wh, Math.max(0, cy - wy0))) * (ww + 1) + Math.min(ww, Math.max(0, cx - wx0))];
  const big: LavaLand = {
    size: BIG, seed: 7, height: hAt, rock: (x, y) => win.rock[(y - wy0) * ww + (x - wx0)] ?? 0, tile: (x, y) => win.tiles[(y - wy0) * ww + (x - wx0)] ?? 0,
    spared: () => false, lair: () => false,
  };
  let outside = 0, high = { h: -1e9, x: 0, y: 0 };
  for (let y = wy0; y < wy0 + wh; y++) {
    for (let x = wx0; x < wx0 + ww; x++) {
      if (chartRegion(x + 0.5, y + 0.5, BIG) !== LAVA_ISLE) continue;
      const s = hAt(x, y) + hAt(x + 1, y) + hAt(x + 1, y + 1) + hAt(x, y + 1);
      if (s > high.h) high = { h: s, x, y };
      if (s >= 4 * LAVA_BAND.foot && !lavaInBox(BIG, x, y)) outside++;
    }
  }
  check('every tile of Volcano Isle at the foot and up is inside the box', outside === 0, String(outside));
  const bx0 = gb.bx0 * LAVA_CELL, by0 = gb.by0 * LAVA_CELL, bx1 = (gb.bx0 + 2 * gb.cols - 1) * LAVA_CELL, by1 = (gb.by0 + 2 * gb.rows - 1) * LAVA_CELL;
  const seams: Array<[number, number]> = [];
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) if (big.rock(x, y) === LAVA_SEAM && inBand4(big, x, y)) seams.push([x, y]);
  big.lair = (x, y) => x === high.x && y === high.y;
  const t1 = performance.now();
  lavaPasses(BIG, 7, DAY);
  const made = performance.now() - t1;
  const t2 = performance.now();
  let lava = 0;
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) if (lavaAt(big, DAY, x, y)) lava++;
  const per = ((performance.now() - t2) * 1000) / ((bx1 - bx0) * (by1 - by0));
  const missed: string[] = [];
  for (let d = DAY; d < DAY + 3; d++) {
    const r = reach(big, d, [bx0, by0], [bx0 - 1, by0 - 1, bx1, by1]);
    if (!r.has(high.y * BIG + high.x)) missed.push(`${d}: summit`);
    for (const [x, y] of seams) if (!r.has(y * BIG + x)) missed.push(`${d}: seam ${x},${y}`);
  }
  check(`from the foot to the summit (${high.x}, ${high.y}) and the band's ${seams.length} seryll seams, three days`, !missed.length, missed.slice(0, 5).join(', '));
  check('lava lies on it', lava > 10000, String(lava));
  console.log(`  ground worked out in ${gen.toFixed(0)} ms; box ${bx1 - bx0} × ${by1 - by0} tiles, ${gb.cols} × ${gb.rows} rooms; ${lava} tiles of lava today`);
  console.log(`  timings, the browser: the maze made (4096) ${made.toFixed(1)} ms; a tile asked ${per.toFixed(2)} µs (the day's maze kept)`);
}
function inBand4(L: LavaLand, x: number, y: number): boolean {
  return lavaBand(L, Math.floor(x / LAVA_CELL), Math.floor(y / LAVA_CELL));
}

console.log(`  timings, the island: the maze made (4096) ${one('T_MAKE')} ms; a tile of the box asked ${one('T_BOX')} µs; a tile off it ${one('T_OFF')} µs; a body settled ${one('T_SETTLE')} ms`);
check('the island asks a tile off the box in under 50 µs', Number(one('T_OFF')) < 50, one('T_OFF'));

finish('Lava and heat on Volcano Isle');
