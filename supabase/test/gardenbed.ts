/**
 * Garden beds, the same on both sides.
 *
 * Asked for: "Create a floor type called Garden Bed. It requires timber and
 * iron ribbons and dirt. It functions like an indoor tilled tile as long as
 * there is no roof or a glass roof (glasshouse)".
 *
 * Asks of both sides, in the same words:
 *   * the bill: a tile `GARDEN_BED_TIMBER` timber, `GARDEN_BED_RIBBONS` iron
 *     metal ribbons and `GARDEN_BED_DIRT` dirt, through `floorBill`, and the
 *     ribbons iron ones: a builder with copper ribbons alone is told so;
 *   * laid as a floor and nothing else: no wall, fence, column, stair, ladder
 *     or roof;
 *   * a finished bed sown, tended and harvested, on the ground and on storey 2,
 *     from the storey you stand on; open to the sky it grows on the glass clock
 *     in a winter, and under a glass roof the same;
 *   * covered by a floor or a roof that is not glass: sowing refused, and a crop
 *     already in it stands still on the still clock, as far into its stage as
 *     it had grown, until it is uncovered, when it grows on from there; a glass
 *     roof over it does not stop it;
 *   * a tile keeps one crop whatever storey it is on; the bed taken up takes its
 *     crop with it; a farm worker sows a bed on storey 2 up the stairs and reaps
 *     it, the tile's ground as it was;
 *   * and a glasshouse's field and a planter go on as they did.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import {
  describeNeeds, floorBill, GARDEN_BED, GARDEN_BED_DIRT, GARDEN_BED_RIBBONS, GARDEN_BED_TIMBER, GARDEN_BED_METAL, onlyRefusal, onlySaid,
} from '../../src/game/building';
import { materialName } from '../../src/game/buildActions';
import { BED_STILL, CROPS, cropWhen, describeCrop, sownSaid, STAGE_NAMES } from '../../src/game/farming';
import { BED, BED_COVERED, BED_NAME, BED_NO_DECK, BED_ONE_CROP, bedOpen } from '../../src/game/gardenbed';
import { Game, type IslandGround } from '../../src/game/game';
import { GLASSHOUSE_GROWTH, STILL_CLOCK } from '../../src/game/growth';
import { glassPlanRefusal, glassResync } from '../../src/game/glasshouse';
import { METAL_BY_ID } from '../../src/game/metal';
import { REAP_TOOL, TEND_TOOL } from '../../src/game/jobtools';
import { TileType } from '../../src/world/tiles';

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

/*
 * The ground, the same on both sides:
 *   a yard, one storey and no roof, on (10, 10) and (11, 10): a finished bed on the first, one planned on the second;
 *   a house of two storeys on (14..16, 10): a bed under a plank floor on (14, 10), plank on the ground under the rest,
 *     a bed open to the sky on storey 2 at (15, 10), a staircase up to it at (16, 10), and a jetty bed on storey 2
 *     out over a field at (13, 10);
 *   a glasshouse on (20, 10) and (21, 10): a bed on the first, a field on the second, walls all round, roofed in glass;
 *   a field in the open at (25, 10), and a planter at (27, 10).
 */
const ODA = '6e1b0000-0000-4000-8000-0000000000d1';
const IRON = METAL_BY_ID.get(GARDEN_BED_METAL)!.name;
const BILL = floorBill(BED);
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const WALL_TYPES = ['solid', 'window', 'fence'];
const KINDS = ['floor', 'stairs', 'ladder', 'roof'];
const tile = (x: number, y: number, extra: Record<string, unknown> = {}): string => q(JSON.stringify({ kind: 'tile', x, y, cx: x, cy: y, ...extra }));
const PER = CROPS.wheat.stageSeconds;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every skill check passes, and a pair of hands turns out forty: a go must show the rule.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select true';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select 40::double precision';
create or replace function harvest_seeds(p_chance double precision default seed_chance()) returns integer language sql volatile as $pin$ select 0 $pin$;
create function pg_temp.said(w uuid, u uuid, p text) returns text language sql as $f$
  select e.text from event e where e.world_id = w and e.uid = u and e.text like p order by e.n desc limit 1
$f$;
create function pg_temp.crop(p_w uuid, p_x int, p_y int) returns text language sql stable as $f$
  select coalesce((select c.id || ':' || c.stage || ':' || coalesce(c.level::text, '-') || ':' || c.glass || ':' || c.still
                     from crop c where c.world_id = p_w and c.x = p_x and c.y = p_y), 'none')
$f$;
create function pg_temp.at(p_w uuid, p_u uuid, p_x int, p_y int, p_l int) returns void language sql as $f$
  update player set body_at = now(), x = p_x + 0.5, y = p_y + 0.5, level = p_l, act = null, act_queue = '[]' where world_id = p_w and uid = p_u
$f$;
create function pg_temp.floor(w uuid, b int, l int, x int, y int, m text, k text default 'floor') returns void language sql as $f$
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
  values (w, l, x, y, b, m, k, '{}', floor_bill(m, k, 'hip'))
$f$;
do $t$
declare w uuid; u uuid := '${ODA}'; v_seed bigint; v_n int; v_g double precision; v_why text; v_c int; v_j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Beds', 171, 64, 5, 5, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Oda');
  for i in 6 .. 30 loop for j in 6 .. 14 loop
    perform land_set_height(w, i, j, 20); perform land_set_dirt(w, i, j, 5);
    perform land_set_tile(w, i, j, ${TileType.Grass});
  end loop; end loop;
  update player set stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'farming', 50), (w, u, 'carpentry', 50), (w, u, 'paving', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, u, 'mallet', 1, 40); perform give(w, u, '${TEND_TOOL}', 1, 40); perform give(w, u, '${REAP_TOOL}', 1, 40);
  perform give(w, u, 'wheat_seed', 20, 50);

  -- The yard.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 1, 'Yard', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, 10, 10), (w, 1, 11, 10);
  perform land_set_tile(w, 10, 10, ${TileType.PackedDirt}); perform land_set_tile(w, 11, 10, ${TileType.PackedDirt});
  perform pg_temp.floor(w, 1, 0, 10, 10, '${BED}');
  -- The house.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 2, 'House', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values (w, 2, 14, 10), (w, 2, 15, 10), (w, 2, 16, 10);
  for i in 14 .. 16 loop perform land_set_tile(w, i, 10, ${TileType.PackedDirt}); end loop;
  perform pg_temp.floor(w, 2, 0, 14, 10, '${BED}');
  perform pg_temp.floor(w, 2, 0, 15, 10, 'plank'); perform pg_temp.floor(w, 2, 0, 16, 10, 'plank');
  perform pg_temp.floor(w, 2, 1, 14, 10, 'plank'); perform pg_temp.floor(w, 2, 1, 15, 10, '${BED}');
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total)
    values (w, 1, 16, 10, 2, 'plank', 'stairs', 's', '{}', floor_bill('plank', 'stairs', 'hip'));
  perform land_set_tile(w, 13, 10, ${TileType.Field});
  perform pg_temp.floor(w, 2, 1, 13, 10, '${BED}');
  -- The glasshouse.
  insert into building (world_id, id, name, levels, work_level, planned_by, roof) values (w, 3, 'Glasshouse', 1, 0, u, 'hip');
  insert into building_tile (world_id, building, x, y) values (w, 3, 20, 10), (w, 3, 21, 10);
  perform land_set_tile(w, 20, 10, ${TileType.PackedDirt}); perform land_set_tile(w, 21, 10, ${TileType.Field});
  perform pg_temp.floor(w, 3, 0, 20, 10, '${BED}');
  perform pg_temp.floor(w, 3, 1, 20, 10, 'glass', 'roof'); perform pg_temp.floor(w, 3, 1, 21, 10, 'glass', 'roof');
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
    (w, 0, 'h', 20, 10, 3, 'solid', 'plank', '{}', '{}'), (w, 0, 'h', 21, 10, 3, 'solid', 'plank', '{}', '{}'),
    (w, 0, 'h', 20, 11, 3, 'solid', 'plank', '{}', '{}'), (w, 0, 'h', 21, 11, 3, 'solid', 'plank', '{}', '{}'),
    (w, 0, 'v', 20, 10, 3, 'solid', 'plank', '{}', '{}'), (w, 0, 'v', 22, 10, 3, 'solid', 'plank', '{}', '{}');
  perform land_set_tile(w, 25, 10, ${TileType.Field});

  /* ---- The bill, and laid as a floor and nothing else ---- */
  insert into said values ('BILL', floor_bill('${BED}', 'floor', 'hip')::text || '|' || bill_text('${BED}', floor_bill('${BED}', 'floor', 'hip')));
  ${WALL_TYPES.map((t) => `insert into said values ('ONLY_${t}', coalesce(material_only_refusal('${BED}', '${t}', null), 'none'));`).join('\n  ')}
  insert into said values ('ONLY_column', coalesce(material_only_refusal('${BED}', 'column', null), 'none'));
  ${KINDS.map((k) => `insert into said values ('ONLY_${k}', coalesce(material_only_refusal('${BED}', null, '${k}'), 'none'));`).join('\n  ')}
  -- No deck on piers.
  insert into building (world_id, id, name, levels, work_level, planned_by, deck) values (w, 4, 'Jetty', 1, 0, u, 25);
  insert into building_tile (world_id, building, x, y, pier) values (w, 4, 8, 13, true);
  insert into said values ('NODECK', coalesce(glass_refusal(w, u, 'plan_floor', ${tile(8, 13, { material: BED, floorKind: 'floor' })}), 'none')
    || '|' || coalesce(glass_refusal(w, u, 'plan_floor', ${tile(8, 13, { material: 'plank', floorKind: 'floor' })}), 'none'));
  perform pg_temp.at(w, u, 11, 10, 0);
  insert into said values ('PLANROOF', coalesce(act_refusal(w, u, 'plan_floor', ${tile(11, 10, { material: BED, floorKind: 'roof' })}), 'none'));
  insert into said values ('PLANWALL', coalesce(act_refusal(w, u, 'plan_wall', ${tile(11, 10, { side: 's', wallType: 'solid', material: BED })}), 'none'));
  insert into said values ('PLANFLOOR', coalesce(act_refusal(w, u, 'plan_floor', ${tile(11, 10, { material: BED, floorKind: 'floor' })}), 'none'));
  perform act_perform(w, u, 'plan_floor', ${tile(11, 10, { material: BED, floorKind: 'floor' })});
  insert into said values ('PLANNED', coalesce((select f.needed::text from floor_tile f where f.world_id = w and f.level = 0 and f.x = 11 and f.y = 10), 'none'));

  /* ---- Built: copper ribbons will not do, iron ones will ---- */
  perform give(w, u, 'timber', ${BILL.total.timber}, 30);
  perform give(w, u, 'dirt', ${BILL.total.dirt}, 30);
  perform give(w, u, 'ribbon', ${BILL.total.ribbon}, 30, 'Copper');
  v_n := 0;
  while act_refusal(w, u, 'build_floor', ${tile(11, 10)}) is null and v_n < 40 loop
    perform act_perform(w, u, 'build_floor', ${tile(11, 10)});
    v_n := v_n + 1;
  end loop;
  insert into said values ('COPPER', coalesce(act_refusal(w, u, 'build_floor', ${tile(11, 10)}), 'none') || '|' || v_n || '|'
    || pack_count(w, u, 'ribbon', 'Copper'));
  perform give(w, u, 'ribbon', ${BILL.total.ribbon}, 30, '${IRON}');
  while act_refusal(w, u, 'build_floor', ${tile(11, 10)}) is null and v_n < 40 loop
    perform act_perform(w, u, 'build_floor', ${tile(11, 10)});
    v_n := v_n + 1;
  end loop;
  insert into said values ('BUILT', v_n || '|' || bed_at(w, 0, 11, 10) || '|' || pack_count(w, u, 'ribbon', 'Copper') || '|' || pack_count(w, u, 'ribbon', '${IRON}')
    || '|' || coalesce(pg_temp.said(w, u, 'Built: %'), 'unsaid'));

  /* ---- Open to the sky on the ground: sown, tended, grown in a winter, harvested ---- */
  v_seed := (select i.id from item i where i.world_id = w and i.holder_uid = u and i.def = 'wheat_seed' order by i.id limit 1);
  perform pg_temp.at(w, u, 10, 10, 0);
  insert into said values ('OPEN', bed_open(w, 0, 10, 10) || ':' || bed_open(w, 0, 14, 10) || ':' || bed_open(w, 1, 15, 10) || ':' || bed_open(w, 0, 20, 10));
  insert into said values ('SOWASK', coalesce(act_refusal(w, u, 'plant_seed', ${tile(10, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  perform act_perform(w, u, 'plant_seed', ${tile(10, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  insert into said values ('SOWN', pg_temp.crop(w, 10, 10) || '|' || coalesce(pg_temp.said(w, u, 'Sown: %'), 'unsaid'));
  perform act_perform(w, u, 'tend_crop', ${tile(10, 10)});
  insert into said values ('TENDED', (select c.tended || ':' || c.tended_now from crop c where c.world_id = w and c.x = 10 and c.y = 10));
  perform set_config('wurm.season', 'winter', true);
  insert into crop (world_id, x, y, id, stage, stage_at, ql) values (w, 25, 10, 'wheat', 0, now() - make_interval(secs => ${PER} + 1), 40);
  update crop set stage_at = now() - make_interval(secs => ${PER} / glasshouse_growth() + 1) where world_id = w and x = 10 and y = 10;
  perform crops_settle(w, 15.5, 10.5, 12);
  insert into said values ('WINTER', pg_temp.crop(w, 10, 10) || '|' || pg_temp.crop(w, 25, 10));
  perform set_config('wurm.season', '', true);
  update crop set stage = ${STAGE_NAMES.length - 1}, stage_at = now() where world_id = w and x = 10 and y = 10;
  delete from item where world_id = w and holder_uid = u and def = 'wheat';
  insert into said values ('REAPASK', coalesce(act_refusal(w, u, 'harvest_crop', ${tile(10, 10)}), 'none'));
  perform act_perform(w, u, 'harvest_crop', ${tile(10, 10)});
  insert into said values ('REAPED', pg_temp.crop(w, 10, 10) || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder_uid = u and def = 'wheat')
    || '|' || coalesce(pg_temp.said(w, u, 'Harvested: %'), 'unsaid') || '|' || land_tile(w, 10, 10));

  /* ---- On storey 2, from storey 2 ---- */
  perform pg_temp.at(w, u, 15, 10, 1);
  insert into said values ('UPASK', coalesce(act_refusal(w, u, 'plant_seed', ${tile(15, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  perform act_perform(w, u, 'plant_seed', ${tile(15, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  perform act_perform(w, u, 'tend_crop', ${tile(15, 10)});
  insert into said values ('UP', pg_temp.crop(w, 15, 10) || '|' || (select c.tended from crop c where c.world_id = w and c.x = 15 and c.y = 10));
  update crop set stage = ${STAGE_NAMES.length - 1}, stage_at = now() where world_id = w and x = 15 and y = 10;
  perform pg_temp.at(w, u, 15, 10, 0);
  insert into said values ('UPFROMBELOW', coalesce(act_refusal(w, u, 'harvest_crop', ${tile(15, 10)}), 'none'));
  perform pg_temp.at(w, u, 15, 10, 1);
  perform act_perform(w, u, 'harvest_crop', ${tile(15, 10)});
  insert into said values ('UPREAPED', pg_temp.crop(w, 15, 10) || '|' || coalesce(pg_temp.said(w, u, 'Harvested: %'), 'unsaid'));

  /* ---- Covered by a plank floor: not sown ---- */
  perform pg_temp.at(w, u, 14, 10, 0);
  insert into said values ('COVEREDASK', coalesce(act_refusal(w, u, 'plant_seed', ${tile(14, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));

  /* ---- Under glass: sown, and grown in a winter; a wall off the glasshouse takes its field off the glass clock, not its bed ---- */
  perform pg_temp.at(w, u, 20, 10, 0);
  perform act_perform(w, u, 'plant_seed', ${tile(20, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  perform pg_temp.at(w, u, 21, 10, 0);
  perform act_perform(w, u, 'plant_seed', ${tile(21, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  insert into said values ('GLASS', pg_temp.crop(w, 20, 10) || '|' || pg_temp.crop(w, 21, 10) || '|' || glasshouse(w, 3));
  perform set_config('wurm.season', 'winter', true);
  update crop set stage_at = now() - make_interval(secs => ${PER} / glasshouse_growth() + 1) where world_id = w and x in (20, 21) and y = 10;
  perform crops_settle(w, 20.5, 10.5, 3);
  insert into said values ('GLASSWINTER', pg_temp.crop(w, 20, 10) || '|' || pg_temp.crop(w, 21, 10));
  perform set_config('wurm.season', '', true);
  delete from wall where world_id = w and level = 0 and dir = 'v' and x = 22 and y = 10;
  insert into said values ('WALLOFF', pg_temp.crop(w, 20, 10) || '|' || pg_temp.crop(w, 21, 10) || '|' || glasshouse(w, 3));

  /* ---- A growing crop covered and uncovered: a plank floor over it, then a plank roof, then a glass one ---- */
  perform pg_temp.at(w, u, 11, 10, 0);
  perform act_perform(w, u, 'plant_seed', ${tile(11, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  update crop set stage_at = now() - interval '100 seconds' where world_id = w and x = 11 and y = 10;
  -- Planned over it, unfinished: open still.
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    values (w, 1, 11, 10, 1, 'plank', 'floor', floor_bill('plank', 'floor', 'hip'), floor_bill('plank', 'floor', 'hip'));
  insert into said values ('PLANNEDOVER', pg_temp.crop(w, 11, 10));
  update floor_tile set needed = '{}' where world_id = w and level = 1 and x = 11 and y = 10;
  insert into said values ('FLOORED', pg_temp.crop(w, 11, 10) || '|' || round(still_grown((select stage_at from crop where world_id = w and x = 11 and y = 10))::numeric, 3));
  v_g := (select extract(epoch from stage_at) from crop where world_id = w and x = 11 and y = 10);
  update crop set stage = stage where world_id = w and x = 11 and y = 10;
  perform crops_settle(w, 11.5, 10.5, 0);
  perform hasten_crops(w, u);
  perform sleep_forward(w, u, 600);
  insert into said values ('HELD', pg_temp.crop(w, 11, 10) || '|' || ((select extract(epoch from stage_at) from crop where world_id = w and x = 11 and y = 10) = v_g)
    || '|' || coalesce(act_refusal(w, u, 'plant_seed', ${tile(11, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  delete from floor_tile where world_id = w and level = 1 and x = 11 and y = 10;
  insert into said values ('UNFLOORED', pg_temp.crop(w, 11, 10) || '|'
    || round((crop_clock_on('glass', now()) - crop_clock_on('glass', (select stage_at from crop where world_id = w and x = 11 and y = 10)))::numeric, 3));
  perform pg_temp.floor(w, 1, 1, 11, 10, 'plank', 'roof');
  insert into said values ('ROOFED', pg_temp.crop(w, 11, 10));
  update floor_tile set material = 'glass', needed = '{}' where world_id = w and level = 1 and x = 11 and y = 10;
  insert into said values ('GLAZED', pg_temp.crop(w, 11, 10) || '|'
    || round((crop_clock_on('glass', now()) - crop_clock_on('glass', (select stage_at from crop where world_id = w and x = 11 and y = 10)))::numeric, 3));

  /* ---- One crop a tile: a field under the jetty bed, sown from the ground ---- */
  perform pg_temp.at(w, u, 13, 10, 0);
  perform act_perform(w, u, 'plant_seed', ${tile(13, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  insert into said values ('FIELDUNDER', pg_temp.crop(w, 13, 10));
  perform pg_temp.at(w, u, 13, 10, 1);
  insert into said values ('ONECROP', coalesce(act_refusal(w, u, 'plant_seed', ${tile(13, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  insert into said values ('NOTMINE', coalesce(act_refusal(w, u, 'tend_crop', ${tile(13, 10)}), 'none'));
  perform pg_temp.at(w, u, 13, 10, 0);
  insert into said values ('MINE', coalesce(act_refusal(w, u, 'tend_crop', ${tile(13, 10)}), 'none'));

  /* ---- The bed taken up takes its crop ---- */
  perform pg_temp.at(w, u, 20, 10, 0);
  perform act_perform(w, u, 'remove_floor', ${tile(20, 10, { floorKind: 'floor' })});
  insert into said values ('UPROOTED', pg_temp.crop(w, 20, 10) || '|' || pg_temp.crop(w, 21, 10));

  /* ---- A planter, as it was ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'planter', 27, 10, 0, 0, 27.25, 10.25, 30, u) returning id into v_c;
  perform pg_temp.at(w, u, 27, 11, 0);
  perform act_perform(w, u, 'plant_seed', jsonb_build_object('kind', 'furniture', 'id', v_c, 'itemUid', v_seed));
  insert into said values ('PLANTER', coalesce((select pc.id || ':' || pc.stage from planter_crop pc where pc.placed = v_c), 'none') || '|' || pg_temp.crop(w, 27, 10));

  /* ---- A farm worker on storey 2, up the stairs ---- */
  perform drop_on_ground(w, 15, 10, 'wheat_seed', 30);
  insert into creature (world_id, id, species, name, from_x, from_y, to_x, to_y, health, sex, mode, job, work_x, work_y, keeper)
    select w, coalesce(max(id), 0) + 1, 'seavic', 'Sower', 15.5, 10.5, 15.5, 10.5, 20, 'female', 'deed', 'farm', 15, 10, u
    from creature where world_id = w returning id into v_c;
  insert into said values ('WORKASK', worker_gatherable(w, 15, 10, 'farm', (select c from creature c where c.world_id = w and c.id = v_c))
    || '|' || farm_work_level(w, 15, 10) || '|' || worker_gatherable(w, 14, 10, 'farm', (select c from creature c where c.world_id = w and c.id = v_c)));
  v_j := worker_do(w, v_c);
  insert into said values ('WORKSOWN', pg_temp.crop(w, 15, 10) || '|' || farm_work_level(w, 15, 10));
  update crop set stage = ${STAGE_NAMES.length - 1}, stage_at = now() where world_id = w and x = 15 and y = 10;
  v_j := worker_do(w, v_c);
  insert into said values ('WORKREAPED', coalesce(v_j->>'def', '-') || '|' || pg_temp.crop(w, 15, 10) || '|' || land_tile(w, 15, 10));
  -- No stairs, no work up there.
  update floor_tile set needed = floor_bill('plank', 'stairs', 'hip') where world_id = w and level = 1 and x = 16 and y = 10;
  insert into said values ('NOSTAIRS', worker_gatherable(w, 15, 10, 'farm', (select c from creature c where c.world_id = w and c.id = v_c)) || '|'
    || coalesce(worker_bed(w, 15, 10)::text, 'none'));

  /* ---- And the ground read ---- */
  update player set x = 12.5, y = 10.5 where world_id = w and uid = u;
  update floor_tile set material = 'plank' where world_id = w and level = 1 and x = 11 and y = 10;
  delete from caller where uid = u;
  v_j := rpc_ground(w, 40, true);
  insert into said select 'GROUND', coalesce(string_agg((r->>'x') || ':' || coalesce(r->>'level', '-') || ':' || coalesce(r->>'still', '-') || ':'
      || round((r->>'grown')::numeric, 3), ',' order by (r->>'x')::int), 'none')
    from jsonb_array_elements(v_j->'crops') r where (r->>'x')::int in (11, 13);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the island ------------------------------------------------------------------------- */

const billSaid = describeNeeds(BILL, materialName, BED);
check(`a tile costs ${GARDEN_BED_TIMBER} timber, ${GARDEN_BED_RIBBONS} iron metal ribbons and ${GARDEN_BED_DIRT} dirt, on both sides, and says so: "${billSaid}"`,
  BILL.total.timber === GARDEN_BED_TIMBER && BILL.total.ribbon === GARDEN_BED_RIBBONS && BILL.total.dirt === GARDEN_BED_DIRT
    && at('BILL') === `${JSON.stringify({ dirt: GARDEN_BED_DIRT, ribbon: GARDEN_BED_RIBBONS, timber: GARDEN_BED_TIMBER }).replace(/,/g, ', ').replace(/:/g, ': ')}|${billSaid}`,
  at('BILL'));
const only = onlySaid(GARDEN_BED);
for (const t of WALL_TYPES) check(`not laid as a ${t}: "${only}" on both sides`, at(`ONLY_${t}`) === only && onlyRefusal(BED, { wall: t }) === only, at(`ONLY_${t}`));
check('nor as a column', at('ONLY_column') === only && onlyRefusal(BED, { column: true }) === only, at('ONLY_column'));
for (const k of KINDS) {
  const mine = onlyRefusal(BED, { floor: k }) ?? 'none';
  check(`as ${k === 'floor' ? 'a floor: laid' : `${k}: not laid`}, on both sides`, at(`ONLY_${k}`) === mine && (k === 'floor') === (mine === 'none'), `${at(`ONLY_${k}`)} / ${mine}`);
}
check('through the door: a roof and a wall of it refused, a floor of it planned with its bill', at('PLANROOF') === only && at('PLANWALL') === only && at('PLANFLOOR') === 'none'
  && at('PLANNED') === JSON.stringify({ dirt: GARDEN_BED_DIRT, ribbon: GARDEN_BED_RIBBONS, timber: GARDEN_BED_TIMBER }).replace(/,/g, ', ').replace(/:/g, ': '),
  `${at('PLANROOF')} / ${at('PLANWALL')} / ${at('PLANFLOOR')} / ${at('PLANNED')}`);
const copperSaid = `Need ${describeNeeds({ needed: { ribbon: GARDEN_BED_RIBBONS }, total: {} }, materialName, BED)}.`;
check(`copper ribbons will not do: the timber and dirt go in a unit a go and then "${copperSaid}", the copper left in the pack`,
  at('COPPER') === `${copperSaid}|${GARDEN_BED_TIMBER + GARDEN_BED_DIRT}|${GARDEN_BED_RIBBONS}`, at('COPPER'));
check('iron ones finish it, the copper still in the pack', at('BUILT') === `${GARDEN_BED_TIMBER + GARDEN_BED_DIRT + GARDEN_BED_RIBBONS}|true|${GARDEN_BED_RIBBONS}|0|Built: garden bed floor.`, at('BUILT'));
check('open to the sky on the ground and on storey 2, covered under a plank floor, open under glass', at('OPEN') === 'true:false:true:true', at('OPEN'));
const sprouting = sownSaid('Wheat', 'glass', cropWhen(STAGE_NAMES[1], PER, 'glass', 0), true);
check(`a finished bed open to the sky is sown, on the glass clock, in the browser's line: "${sprouting}"`,
  at('SOWASK') === 'none' && at('SOWN') === `wheat:0:0:true:false|${sprouting}`, `${at('SOWASK')} / ${at('SOWN')}`);
check('and tended', at('TENDED') === '1:true', at('TENDED'));
check(`in a winter it comes on a stage at ${GLASSHOUSE_GROWTH} of its pace, where a field in the open stands still`,
  at('WINTER') === 'wheat:1:0:true:false|wheat:0:-:false:false', at('WINTER'));
check(`harvested as a field is, and said so: "… ${BED_NAME} ready to sow.", its tile's ground as it was`,
  at('REAPASK') === 'none' && at('REAPED').startsWith('none|') && Number(at('REAPED').split('|')[1]) > 0
    && at('REAPED').split('|')[2].endsWith(`. ${BED_NAME} ready to sow.`) && at('REAPED').split('|')[3] === String(TileType.PackedDirt), at('REAPED'));
check('on storey 2, from storey 2: sown and tended there, its crop on storey 2', at('UPASK') === 'none' && at('UP') === 'wheat:0:1:true:false|1', `${at('UPASK')} / ${at('UP')}`);
check('not harvested from the ground floor under it, which has no crop', at('UPFROMBELOW') === 'No crop there.', at('UPFROMBELOW'));
check('and harvested from storey 2', at('UPREAPED').startsWith('none|') && at('UPREAPED').endsWith(`. ${BED_NAME} ready to sow.`), at('UPREAPED'));
check(`covered by a plank floor: "${BED_COVERED}"`, at('COVEREDASK') === BED_COVERED, at('COVEREDASK'));
check('under a glass roof: sown on the glass clock, beside a glasshouse field on it', at('GLASS') === 'wheat:0:0:true:false|wheat:0:-:true:false|true', at('GLASS'));
check('both come on in a winter', at('GLASSWINTER') === 'wheat:1:0:true:false|wheat:1:-:true:false', at('GLASSWINTER'));
check('a wall taken down: the field goes onto the field clock as it did, the bed under the glass does not', at('WALLOFF') === 'wheat:1:0:true:false|wheat:1:-:false:false|false', at('WALLOFF'));
check('a floor planned over a growing crop and not finished: still growing', at('PLANNEDOVER') === 'wheat:0:0:true:false', at('PLANNEDOVER'));
check('finished: onto the still clock, its 100 seconds kept', at('FLOORED') === 'wheat:0:0:true:true|100.000', at('FLOORED'));
check(`and it stands still through a settling, Bounty and a night's sleep, and is not sown: "${BED_COVERED}"`,
  at('HELD') === `wheat:0:0:true:true|true|${BED_COVERED}`, at('HELD'));
check('the floor taken up: back on the glass clock, 100 seconds into its stage', at('UNFLOORED') === 'wheat:0:0:true:false|100.000', at('UNFLOORED'));
check('a plank roof over it stops it; relaid in glass, it grows on, 100 seconds in', at('ROOFED') === 'wheat:0:0:true:true' && at('GLAZED') === 'wheat:0:0:true:false|100.000',
  `${at('ROOFED')} / ${at('GLAZED')}`);
check(`one crop a tile: a field under a jetty bed sown, and the bed over it refused, "${BED_ONE_CROP}"`,
  at('FIELDUNDER') === 'wheat:0:-:false:false' && at('ONECROP') === BED_ONE_CROP, `${at('FIELDUNDER')} / ${at('ONECROP')}`);
check('the field\'s crop is not the bed\'s to tend from storey 2, and is the field\'s from the ground', at('NOTMINE') === 'No crop there.' && at('MINE') === 'none',
  `${at('NOTMINE')} / ${at('MINE')}`);
check('the bed taken up takes its crop; the field beside it keeps its own', at('UPROOTED') === 'none|wheat:1:-:false:false', at('UPROOTED'));
check('a planter sows into its own row, as it did', at('PLANTER') === 'wheat:0|none', at('PLANTER'));
check('a farm worker finds the bed on storey 2 up the stairs, works it on storey 2, and not the covered one', at('WORKASK') === 'true|1|false', at('WORKASK'));
check('sows it from the seed lying there, on storey 2 and the glass clock', at('WORKSOWN') === 'wheat:0:1:true:false|1', at('WORKSOWN'));
check('and reaps it, the tile\'s ground packed earth as it was', at('WORKREAPED') === `wheat|none|${TileType.PackedDirt}`, at('WORKREAPED'));
check('with the stairs unfinished, it does not go up', at('NOSTAIRS') === 'false|none', at('NOSTAIRS'));
const [groundBed, groundField] = at('GROUND').split(',');
check('the ground read carries a covered bed\'s crop with its storey, standing still, its growth on the still clock; a field\'s with neither',
  groundBed?.startsWith('11:0:true:100.') && groundField?.startsWith('13:-:-:'), at('GROUND'));

/* ---- in the browser ---------------------------------------------------------------------- */

const game = Game.create(4251);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
game.creatures.fromIsland = true;
const w = game.world;
for (let x = 6; x <= 30; x++) for (let y = 6; y <= 14; y++) { w.setHeight(x, y, 20); w.setTile(x, y, TileType.Grass); }
const bld = game.buildings;
const done = <T extends { needed: Record<string, number> }>(f: T): T => { for (const k of Object.keys(f.needed)) f.needed[k] = 0; return f; };
const yard = bld.create('Yard', 10, 10);
bld.addTile(yard, 11, 10);
done(bld.setFloor(yard, 0, 10, 10, BED));
const house = bld.create('House', 14, 10);
bld.addTile(house, 15, 10);
bld.addTile(house, 16, 10);
house.levels = 2;
done(bld.setFloor(house, 0, 14, 10, BED));
done(bld.setFloor(house, 0, 15, 10, 'plank'));
done(bld.setFloor(house, 1, 14, 10, 'plank'));
done(bld.setFloor(house, 1, 15, 10, BED));
w.setTile(13, 10, TileType.Field);
done(bld.setFloor(house, 1, 13, 10, BED));
const gh = bld.create('Glasshouse', 20, 10);
bld.addTile(gh, 21, 10);
gh.roof = 'hip';
done(bld.setFloor(gh, 0, 20, 10, BED));
done(bld.setFloor(gh, 1, 20, 10, 'glass', 'roof'));
done(bld.setFloor(gh, 1, 21, 10, 'glass', 'roof'));
bld.changed();
for (const t of [REAP_TOOL, TEND_TOOL, 'mallet']) if (!game.inventory.has(t)) game.inventory.add(t, { ql: 40 });
const seed = game.inventory.add('wheat_seed', { count: 10, ql: 50 });
const tgt = (x: number, y: number, extra: Record<string, unknown> = {}): Target => ({ kind: 'tile', x, y, cx: x, cy: y, ...extra } as Target);
const ask = (id: string, t: Target): string => ACTION_BY_ID.get(id)!.check?.(t, game) ?? 'none';
const offered = (id: string, t: Target): boolean => ACTION_BY_ID.get(id)!.applies(t, game);
const stand = (x: number, y: number, level: number): void => { game.player.x = x + 0.5; game.player.y = y + 0.5; game.player.level = level; };
const mine: Record<string, string> = {};

const jetty = bld.create('Jetty', 8, 13, 25);
const deckAsk = (m: string): string => glassPlanRefusal(game, tgt(8, 13, { material: m, floorKind: 'floor' }) as Extract<Target, { kind: 'tile' }>, 'plan_floor') ?? 'none';
mine.NODECK = `${deckAsk(BED)}|${deckAsk('plank')}`;
check(`not a deck on piers: "${BED_NO_DECK}", any other material as it was`, mine.NODECK === `${BED_NO_DECK}|none` && jetty.deck === 25, mine.NODECK);
const opens = [bedOpen(bld, 0, 10, 10), bedOpen(bld, 0, 14, 10), bedOpen(bld, 1, 15, 10), bedOpen(bld, 0, 20, 10)].join(':');
check('the browser finds the same beds open and covered', opens === at('OPEN'), opens);
stand(10, 10, 0);
check('Sow is offered on a finished bed open to the sky, and allowed', offered('plant_seed', tgt(10, 10, { itemUid: seed.uid })) && ask('plant_seed', tgt(10, 10, { itemUid: seed.uid })) === at('SOWASK'),
  ask('plant_seed', tgt(10, 10, { itemUid: seed.uid })));
stand(14, 10, 0);
mine.COVEREDASK = ask('plant_seed', tgt(14, 10, { itemUid: seed.uid }));
check('and offered on a covered one, and refused', offered('plant_seed', tgt(14, 10, { itemUid: seed.uid })) && mine.COVEREDASK === BED_COVERED, mine.COVEREDASK);
stand(15, 10, 1);
mine.UPASK = ask('plant_seed', tgt(15, 10, { itemUid: seed.uid }));
check('on storey 2, from storey 2: offered and allowed', offered('plant_seed', tgt(15, 10, { itemUid: seed.uid })) && mine.UPASK === 'none', mine.UPASK);
stand(15, 10, 0);
check('from the ground floor under it, it is the plank floor there, and Sow is not offered', !offered('plant_seed', tgt(15, 10, { itemUid: seed.uid })));
// A field under the jetty bed, sown; from storey 2 the bed over it refused, and its crop not the bed's.
w.setTile(13, 10, TileType.Field);
game.plantCrop(13, 10, 'wheat', 40);
stand(13, 10, 1);
mine.ONECROP = ask('plant_seed', tgt(13, 10, { itemUid: seed.uid }));
const tendUp = offered('tend_crop', tgt(13, 10));
mine.NOTMINE = ask('tend_crop', tgt(13, 10));
stand(13, 10, 0);
mine.MINE = ask('tend_crop', tgt(13, 10));
check('one crop a tile in the browser too; Tend not offered from storey 2 on the field\'s crop under the bed, and offered from the ground',
  mine.ONECROP === BED_ONE_CROP && !tendUp && offered('tend_crop', tgt(13, 10)), mine.ONECROP);
// Copper ribbons will not do.
const planned = bld.setFloor(yard, 0, 11, 10, BED);
planned.needed.timber = 0;
planned.needed.dirt = 0;
game.inventory.add('ribbon', { count: GARDEN_BED_RIBBONS, ql: 30, extra: 'Copper' });
stand(11, 10, 0);
mine.COPPER = ask('build_floor', tgt(11, 10));
check(`the browser refuses copper ribbons in the island's words: "${mine.COPPER}"`, mine.COPPER === at('COPPER').split('|')[0], mine.COPPER);
game.inventory.add('ribbon', { count: GARDEN_BED_RIBBONS, ql: 30, extra: IRON });
check('and takes iron ones', ask('build_floor', tgt(11, 10)) === 'none', ask('build_floor', tgt(11, 10)));

// A crop on a bed, read as the island hands it over: one covered, standing still at 100 seconds in; one open.
game.islandClock = () => 2e9;
game.sawGround({
  placed: [], crates: [], lying: [], now: 2e9,
  crops: [
    { x: 11, y: 10, id: 'wheat', stage: 0, grown: 100, tended: 0, tendedNow: false, ql: 40, glass: true, level: 0, still: true },
    { x: 10, y: 10, id: 'wheat', stage: 0, grown: 100, tended: 0, tendedNow: false, ql: 40, glass: true, level: 0 },
  ],
} as unknown as IslandGround, undefined, 'me');
const still = game.cropAt(11, 10)!;
const open = game.cropAt(10, 10)!;
check('the browser keeps a covered bed\'s crop on the still clock, 100 seconds below it, and an open one on the glass clock',
  still.still === true && still.level === 0 && still.stageAt === STILL_CLOCK - 100 && game.growNow(still) === STILL_CLOCK
    && Math.abs(game.growNow(open) - open.stageAt - 100) < 0.5, `${still.stageAt} / ${game.growNow(open) - open.stageAt}`);
const look = describeCrop(still, game.cropPer(still), game.growNow(still), game.wallNow());
check(`and Look says so: "${look}"`, look.startsWith(`Wheat in a ${BED_NAME.toLowerCase()}, sown · ${BED_STILL}`) && describeCrop(open, game.cropPer(open), game.growNow(open), game.wallNow()).startsWith(`Wheat in a ${BED_NAME.toLowerCase()}, sown · sprouting in `), look);
glassResync(game);
check('a glasshouse\'s resync leaves a bed\'s crop on its own clock', game.cropAt(10, 10)?.glass === true && game.cropAt(11, 10)?.still === true);

/* ---- the same words ------------------------------------------------------------------------ */

for (const [k, v] of Object.entries(mine)) check(`said the same on both sides: ${k}`, v === (k === 'NODECK' ? at(k) : at(k).split('|')[0]), `browser "${v}", island "${at(k)}"`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ngarden beds — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
