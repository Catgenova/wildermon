/**
 * Drop dirt and Change tile, two jobs.
 *
 * Reported: "This tile is completely exposed iron but reads as Dirt due to a
 * player clicking Change Tile here. Change Tile shouldn't be an option on rocks
 * or ores or seams. Make Drop Dirt and Change Tile two completely different
 * functions. CHANGE TILE will no longer change any elevations."
 *
 * Asks of both sides, in the same words:
 *   * Change tile (`change_tile`, a tile) lays clay, sand or dirt as chosen,
 *     every corner's height and soil as they were; not offered on rock, an ore,
 *     a seam or packed dirt; refused under a building; offered only for a
 *     spoil that is not the tile's own.
 *   * Drop dirt (`drop_dirt` on a corner, `drop_dirt_here` at your feet)
 *     raises the corner one step and lays no tile.
 *
 * Then asked: "Dirt should be able to be dropped on rock/seam/vein and it will
 * create a toplayer again as normal. That dirt tile could then be Change
 * Tile-d." Drop dirt at a corner of an iron vein or a coal seam: allowed, the
 * tile dirt; its soil dug off, the vein again; dropped again, Change tile on
 * that dirt.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { STONE_GUARDED } from '../../src/game/runestones';
import { ROCK_VARIANTS, TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/*
 * One row of ground, the same on both sides, at offsets from (X, Y):
 *   0 dirt → clay, 2 dirt → sand, 4 clay → dirt (the first to hand that is not clay),
 *   6 plain rock, 8 an iron vein (bare, iron under it), 10 a coal seam, 12 packed dirt, 14 dirt under a building,
 *   16 clay (asked with clay alone in the pack), 20 a corner of dirt for Drop dirt,
 *   24 grass under your feet for Drop dirt at your feet.
 */
const IRON = ROCK_VARIANTS.findIndex((r) => r.name === 'Iron vein');
const COAL = ROCK_VARIANTS.findIndex((r) => r.name === 'Coal seam');
const ROCKS: Array<[string, number, number]> = [['plain rock', 6, 0], ['an iron vein', 8, IRON], ['a coal seam', 10, COAL]];

/* ---- on the island --------------------------------------------------------------- */

const ODA = '6e1b0000-0000-4000-8000-0000000000c7';
const X0 = 10, Y0 = 10;
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.corners(w uuid, x int, y int) returns text language sql stable as $f$
  select string_agg(land_height(w, c.cx, c.cy) || '/' || land_dirt(w, c.cx, c.cy), ' ' order by c.ord) from tile_corners(x, y) c
$f$;
create function pg_temp.types(w uuid, cx int, cy int) returns text language sql stable as $f$
  select string_agg(land_tile(w, x, y) || ':' || land_data(w, x, y), ' ' order by y, x)
    from generate_series(cx - 1, cx) x cross join generate_series(cy - 1, cy) y
$f$;
do $t$
declare w uuid; u uuid := '${ODA}'; bx int := ${X0}; by_ int := ${Y0}; clay bigint; sand bigint; was text; r record;
        tgt jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Tiles', 169, 64, 5, 5, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Oda');
  for i in bx - 4..bx + 30 loop for j in by_ - 4..by_ + 4 loop
    perform land_set_height(w, i, j, 20); perform land_set_dirt(w, i, j, 5);
    perform land_set_tile(w, i, j, ${TileType.Dirt}); perform land_set_data(w, i, j, 0);
  end loop; end loop;
  perform land_set_tile(w, bx + 4, by_, ${TileType.Clay});
  ${ROCKS.map(([, dx, kind]) => `perform land_set_tile(w, bx + ${dx}, by_, ${TileType.Rock}); perform land_set_data(w, bx + ${dx}, by_, ${kind});`).join('\n  ')}
  -- The vein bare and iron under it, as an exposed vein is.
  perform land_set_rock(w, bx + 8, by_, ${IRON});
  perform land_set_dirt(w, bx + 8, by_, 0); perform land_set_dirt(w, bx + 9, by_, 0);
  perform land_set_dirt(w, bx + 9, by_ + 1, 0); perform land_set_dirt(w, bx + 8, by_ + 1, 0);
  perform land_set_tile(w, bx + 12, by_, ${TileType.PackedDirt});
  insert into building (world_id, id, name, planned_by) values (w, 1, 'Shed', u);
  insert into building_tile (world_id, building, x, y) values (w, 1, bx + 14, by_);
  perform land_set_tile(w, bx + 16, by_, ${TileType.Clay});
  perform land_set_tile(w, bx + 24, by_, ${TileType.Grass});
  update player set body_at = now(), x = bx + 0.5, y = by_ + 0.5, stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  perform give(w, u, 'dirt', 3, 20);
  perform give(w, u, 'clay', 3, 20);
  perform give(w, u, 'sand', 3, 20);
  select id into clay from item where world_id = w and holder_uid = u and def = 'clay' limit 1;
  select id into sand from item where world_id = w and holder_uid = u and def = 'sand' limit 1;
  insert into said values ('LABELS', (select string_agg(id || ':' || label, ',' order by id) from action_def where id in ('drop_dirt', 'drop_dirt_here', 'change_tile')));
  insert into said values ('CORNER', (select corner::text from action_def where id = 'change_tile'));
  insert into said values ('GUARDED', shapes_ground('change_tile') || ',' || stone_guarded('change_tile') || ',' || ground_action('change_tile') || ',' || act_ported('change_tile'));

  -- Change tile: clay, then sand, then whatever is first to hand on clay.
  for r in select * from (values ('CLAY', 0, clay), ('SAND', 2, sand), ('AUTO', 4, null::bigint)) v(k, dx, item) loop
    update player set x = bx + r.dx + 0.5, y = by_ + 0.5 where world_id = w and uid = u;
    tgt := jsonb_build_object('kind', 'tile', 'x', bx + r.dx, 'y', by_) || coalesce(jsonb_build_object('itemUid', r.item), '{}'::jsonb);
    was := pg_temp.corners(w, bx + r.dx, by_);
    insert into said values (r.k || '_ASK', coalesce(act_refusal(w, u, 'change_tile', tgt), 'none'));
    perform act_perform(w, u, 'change_tile', tgt);
    insert into said values (r.k, land_tile(w, bx + r.dx, by_)::text);
    insert into said values (r.k || '_CORNERS', (pg_temp.corners(w, bx + r.dx, by_) = was)::text || ' ' || pg_temp.corners(w, bx + r.dx, by_));
  end loop;
  insert into said values ('SAID', (select text from event where uid = u and kind = 'event' order by n desc limit 1));
  insert into said values ('LEFT', (select string_agg(def || count, ',' order by def) from item where world_id = w and holder_uid = u and def in ('dirt', 'clay', 'sand')));

  -- Refused: rock of every kind, packed dirt, a building.
  for r in select * from (values ('ROCK0', 6), ('ROCK1', 8), ('ROCK2', 10), ('PACKED', 12), ('BUILDING', 14)) v(k, dx) loop
    update player set x = bx + r.dx - 0.5, y = by_ + 0.5 where world_id = w and uid = u;
    insert into said values (r.k, coalesce(act_refusal(w, u, 'change_tile', jsonb_build_object('kind', 'tile', 'x', bx + r.dx, 'y', by_)), 'none'));
  end loop;

  -- Drop dirt on a corner of dirt, and at your feet on grass.
  update player set x = bx + 19.5, y = by_ + 0.5 where world_id = w and uid = u;
  was := pg_temp.types(w, bx + 20, by_);
  insert into said values ('DROP_H0', land_height(w, bx + 20, by_) || '/' || land_dirt(w, bx + 20, by_));
  tgt := jsonb_build_object('kind', 'tile', 'x', bx + 20, 'y', by_, 'cx', bx + 20, 'cy', by_);
  insert into said values ('DROP_ASK', coalesce(act_refusal(w, u, 'drop_dirt', tgt), 'none'));
  perform act_perform(w, u, 'drop_dirt', tgt);
  insert into said values ('DROP_H1', land_height(w, bx + 20, by_) || '/' || land_dirt(w, bx + 20, by_));
  insert into said values ('DROP_TYPES', (pg_temp.types(w, bx + 20, by_) = was)::text || ' ' || pg_temp.types(w, bx + 20, by_));
  update player set x = bx + 24.3, y = by_ + 0.3 where world_id = w and uid = u;
  was := pg_temp.types(w, bx + 24, by_);
  insert into said values ('HERE_H0', land_height(w, bx + 24, by_) || '/' || land_dirt(w, bx + 24, by_));
  tgt := jsonb_build_object('kind', 'item', 'uid', sand);
  insert into said values ('HERE_ASK', coalesce(act_refusal(w, u, 'drop_dirt_here', tgt), 'none'));
  perform act_perform(w, u, 'drop_dirt_here', tgt);
  insert into said values ('HERE_H1', land_height(w, bx + 24, by_) || '/' || land_dirt(w, bx + 24, by_));
  insert into said values ('HERE_TYPES', (pg_temp.types(w, bx + 24, by_) = was)::text || ' ' || pg_temp.types(w, bx + 24, by_));

  -- Drop dirt at a corner of the iron vein: a top layer, the tile dirt; its soil dug off, the vein again. Dropped
  -- again, and Change tile on that dirt, with sand. And Drop dirt at your feet beside the coal seam.
  -- A spadeful of dirt for each drop, so the clay is left for what is asked of it below.
  perform give(w, u, 'dirt', 2, 20);
  update player set x = bx + 7.5, y = by_ + 0.5 where world_id = w and uid = u;
  tgt := jsonb_build_object('kind', 'tile', 'x', bx + 8, 'y', by_, 'cx', bx + 8, 'cy', by_);
  insert into said values ('ORE_ASK', coalesce(act_refusal(w, u, 'drop_dirt', tgt), 'none'));
  perform act_perform(w, u, 'drop_dirt', tgt);
  insert into said values ('ORE', land_tile(w, bx + 8, by_) || ' ' || land_height(w, bx + 8, by_) || '/' || land_dirt(w, bx + 8, by_));
  perform land_set_dirt(w, bx + 8, by_, 0);
  perform reconcile_around(w, bx + 8, by_);
  insert into said values ('ORE_BARE', land_tile(w, bx + 8, by_) || ':' || land_data(w, bx + 8, by_));
  tgt := jsonb_build_object('kind', 'tile', 'x', bx + 8, 'y', by_, 'cx', bx + 8, 'cy', by_);
  perform act_perform(w, u, 'drop_dirt', tgt);
  update player set x = bx + 8.5, y = by_ + 0.5 where world_id = w and uid = u;
  tgt := jsonb_build_object('kind', 'tile', 'x', bx + 8, 'y', by_, 'itemUid', sand);
  insert into said values ('ORE_CHANGE_ASK', coalesce(act_refusal(w, u, 'change_tile', tgt), 'none'));
  perform act_perform(w, u, 'change_tile', tgt);
  insert into said values ('ORE_CHANGED', land_tile(w, bx + 8, by_)::text);
  update player set x = bx + 10.3, y = by_ + 0.3 where world_id = w and uid = u;
  insert into said values ('SEAM_HERE', coalesce(act_refusal(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', clay)), 'none'));
  perform act_perform(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', clay));
  insert into said values ('SEAM', land_tile(w, bx + 10, by_)::text);

  -- Clay alone in the pack, on clay: nothing to lay; and clay named.
  update player set x = bx + 16.5, y = by_ + 0.5 where world_id = w and uid = u;
  delete from item where world_id = w and holder_uid = u and def in ('dirt', 'sand');
  insert into said values ('ONLY_CLAY', coalesce(act_refusal(w, u, 'change_tile', jsonb_build_object('kind', 'tile', 'x', bx + 16, 'y', by_)), 'none'));
  insert into said values ('SAME', coalesce(act_refusal(w, u, 'change_tile', jsonb_build_object('kind', 'tile', 'x', bx + 16, 'y', by_, 'itemUid', clay)), 'none'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island: Drop dirt, Drop dirt and Change tile', at('LABELS') === 'change_tile:Change tile,drop_dirt:Drop dirt,drop_dirt_here:Drop dirt', at('LABELS'));
check('Change tile aims at a tile, not a corner', at('CORNER') === 'false', at('CORNER'));
check('a settlement\'s border and a Runestone speak for it, through the ground\'s door', at('GUARDED') === 'true,true,true,true', at('GUARDED'));
for (const [k, what, tile] of [['CLAY', 'clay named, on dirt', TileType.Clay], ['SAND', 'sand named, on dirt', TileType.Sand], ['AUTO', 'nothing named, on clay', TileType.Dirt]] as const) {
  check(`Change tile, ${what}: allowed`, at(`${k}_ASK`) === 'none', at(`${k}_ASK`));
  check(`and lays ${TileType.Clay === tile ? 'clay' : tile === TileType.Sand ? 'sand' : 'dirt'}`, at(k) === String(tile), at(k));
  check('every corner\'s height and soil as they were', at(`${k}_CORNERS`).startsWith('true'), at(`${k}_CORNERS`));
}
check('said: Changed to dirt.', at('SAID') === 'Changed to dirt.', at('SAID'));
check('one spadeful each spent', at('LEFT') === 'clay2,dirt2,sand2', at('LEFT'));
for (const [i, [what]] of ROCKS.entries()) check(`Change tile refused on ${what}`, at(`ROCK${i}`) === 'Not on rock.', at(`ROCK${i}`));
check('and on packed dirt', at('PACKED') === 'Not on packed dirt.', at('PACKED'));
check('and under a building', at('BUILDING') === 'Not inside a building.', at('BUILDING'));
check('Drop dirt on a corner of dirt: allowed', at('DROP_ASK') === 'none', at('DROP_ASK'));
check('raises the corner one step, height and soil', at('DROP_H0') === '20/5' && at('DROP_H1') === '21/6', `${at('DROP_H0')} → ${at('DROP_H1')}`);
check('and every tile round it as it was', at('DROP_TYPES').startsWith('true'), at('DROP_TYPES'));
check('Drop dirt at your feet on grass: allowed', at('HERE_ASK') === 'none', at('HERE_ASK'));
check('raises the corner one step', at('HERE_H0') === '20/5' && at('HERE_H1') === '21/6', `${at('HERE_H0')} → ${at('HERE_H1')}`);
check('and the grass is grass, every tile round it as it was', at('HERE_TYPES').startsWith('true'), at('HERE_TYPES'));
check('Drop dirt at a corner of an iron vein: allowed', at('ORE_ASK') === 'none', at('ORE_ASK'));
check('the corner one step up with a spadeful of soil, the vein dirt', at('ORE') === `${TileType.Dirt} 21/1`, at('ORE'));
check('its soil dug off: the iron vein again', at('ORE_BARE') === `${TileType.Rock}:${IRON}`, at('ORE_BARE'));
check('dropped again, Change tile on that dirt: allowed', at('ORE_CHANGE_ASK') === 'none', at('ORE_CHANGE_ASK'));
check('and lays sand', at('ORE_CHANGED') === String(TileType.Sand), at('ORE_CHANGED'));
check('Drop dirt at your feet beside a coal seam: allowed', at('SEAM_HERE') === 'none', at('SEAM_HERE'));
check('and the seam, soil on its corners, dirt', at('SEAM') === String(TileType.Dirt), at('SEAM'));
check('Change tile on clay with clay alone to hand: nothing to lay', at('ONLY_CLAY') === 'Need dirt, clay or sand, in the pack or a container beside you.', at('ONLY_CLAY'));
check('and with clay named: refused', at('SAME') === 'Already clay.', at('SAME'));

/* ---- in the browser ---------------------------------------------------------------- */

const game = Game.create(4247);
const [X, Y] = [60, 60];
const w = game.world;
for (let x = X - 4; x <= X + 30; x++) for (let y = Y - 4; y <= Y + 4; y++) { w.setHeight(x, y, 20); w.setDirt(x, y, 5); w.setTile(x, y, TileType.Dirt); }
w.setTile(X + 4, Y, TileType.Clay);
for (const [, dx, kind] of ROCKS) w.setTile(X + dx, Y, TileType.Rock, kind);
w.setRockKind(X + 8, Y, IRON);
for (const [cx, cy] of [[X + 8, Y], [X + 9, Y], [X + 9, Y + 1], [X + 8, Y + 1]]) w.setDirt(cx, cy, 0);
w.setTile(X + 12, Y, TileType.PackedDirt);
game.buildings.create('Shed', X + 14, Y);
w.setTile(X + 16, Y, TileType.Clay);
w.setTile(X + 24, Y, TileType.Grass);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
for (const c of [...game.crates.values()]) game.crates.delete(c.id);
for (const it of [...game.inventory.items]) if (['dirt', 'clay', 'sand'].includes(it.id)) game.inventory.remove(it.uid, it.count);
const put = (x: number, y: number): void => { game.player.x = x; game.player.y = y; };
const dirt = game.inventory.add('dirt', { ql: 20 });
const clay = game.inventory.add('clay', { ql: 20 });
const sand = game.inventory.add('sand', { ql: 20 });
for (const id of ['dirt', 'clay', 'sand']) for (let n = 0; n < 2; n++) game.inventory.add(id, { ql: 20 });
const change = ACTION_BY_ID.get('change_tile')!;
const onCorner = ACTION_BY_ID.get('drop_dirt')!;
const here = ACTION_BY_ID.get('drop_dirt_here')!;
check('in the browser: Drop dirt, Drop dirt and Change tile', onCorner.label === 'Drop dirt' && here.label === 'Drop dirt' && change.label === 'Change tile',
  `${onCorner.label} / ${here.label} / ${change.label}`);
check('Change tile aims at a tile, not a corner', !change.corner);
check('a Runestone speaks for it', STONE_GUARDED.has('change_tile'));
const corners = (x: number, y: number): string => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([cx, cy]) => `${w.getHeight(cx, cy)}/${w.getDirt(cx, cy)}`).join(' ');
const types = (cx: number, cy: number): string => [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]].map(([x, y]) => `${w.getTile(x, y)}:${w.getData(x, y)}`).join(' ');
const tileAt = (x: number, itemUid?: number): Target => ({ kind: 'tile', x, y: Y, cx: x, cy: Y, ...(itemUid !== undefined ? { itemUid } : {}) } as Target);
const ask = (def: typeof change, t: Target): string => def.check?.(t, game) ?? 'none';
const mine: Record<string, string> = {};

for (const [what, dx, uid, tile] of [['clay named, on dirt', 0, clay.uid, TileType.Clay], ['sand named, on dirt', 2, sand.uid, TileType.Sand], ['nothing named, on clay', 4, undefined, TileType.Dirt]] as const) {
  put(X + dx + 0.5, Y + 0.5);
  const t = tileAt(X + dx, uid);
  const was = corners(X + dx, Y);
  check(`Change tile, ${what}: offered and allowed`, change.applies(t, game) && ask(change, t) === 'none', ask(change, t));
  change.perform(t, game);
  check(`and lays ${tile === TileType.Clay ? 'clay' : tile === TileType.Sand ? 'sand' : 'dirt'}`, w.getTile(X + dx, Y) === tile, String(w.getTile(X + dx, Y)));
  check('every corner\'s height and soil as they were', corners(X + dx, Y) === was, `${was} → ${corners(X + dx, Y)}`);
}
const left = ['clay', 'dirt', 'sand'].map((id) => `${id}${game.inventory.count(id)}`).join(',');
check('one spadeful each spent', left === 'clay2,dirt2,sand2', left);
for (const [i, [what, dx]] of ROCKS.entries()) {
  put(X + dx - 0.5, Y + 0.5);
  check(`Change tile not offered on ${what}`, !change.applies(tileAt(X + dx), game));
  mine[`ROCK${i}`] = ask(change, tileAt(X + dx));
}
put(X + 11.5, Y + 0.5);
check('nor on packed dirt', !change.applies(tileAt(X + 12), game));
mine.PACKED = ask(change, tileAt(X + 12));
put(X + 13.5, Y + 0.5);
mine.BUILDING = ask(change, tileAt(X + 14));
check('and refused under a building', mine.BUILDING === 'Not inside a building.', mine.BUILDING);

put(X + 19.5, Y + 0.5);
const dropAt = tileAt(X + 20);
let was = types(X + 20, Y);
const h0 = `${w.getHeight(X + 20, Y)}/${w.getDirt(X + 20, Y)}`;
check('Drop dirt on a corner of dirt: allowed', ask(onCorner, dropAt) === 'none', ask(onCorner, dropAt));
onCorner.perform(dropAt, game);
check('raises the corner one step, height and soil', h0 === '20/5' && `${w.getHeight(X + 20, Y)}/${w.getDirt(X + 20, Y)}` === '21/6', `${h0} → ${w.getHeight(X + 20, Y)}/${w.getDirt(X + 20, Y)}`);
check('and every tile round it as it was', types(X + 20, Y) === was, `${was} → ${types(X + 20, Y)}`);
put(X + 24.3, Y + 0.3);
was = types(X + 24, Y);
const feet: Target = { kind: 'item', uid: sand.uid };
check('Drop dirt at your feet on grass: allowed', ask(here, feet) === 'none', ask(here, feet));
here.perform(feet, game);
check('raises the corner one step', `${w.getHeight(X + 24, Y)}/${w.getDirt(X + 24, Y)}` === '21/6', `${w.getHeight(X + 24, Y)}/${w.getDirt(X + 24, Y)}`);
check('and the grass is grass, every tile round it as it was', types(X + 24, Y) === was && w.getTile(X + 24, Y) === TileType.Grass, `${was} → ${types(X + 24, Y)}`);

// A spadeful of dirt for each drop, so the clay is left for what is asked of it below.
for (let n = 0; n < 2; n++) game.inventory.add('dirt', { ql: 20 });
put(X + 7.5, Y + 0.5);
mine.ORE_ASK = ask(onCorner, tileAt(X + 8));
check('Drop dirt at a corner of an iron vein: allowed', mine.ORE_ASK === 'none', mine.ORE_ASK);
onCorner.perform(tileAt(X + 8), game);
const ore = `${w.getTile(X + 8, Y)} ${w.getHeight(X + 8, Y)}/${w.getDirt(X + 8, Y)}`;
check('the corner one step up with a spadeful of soil, the vein dirt', ore === `${TileType.Dirt} 21/1`, ore);
w.setDirt(X + 8, Y, 0);
w.reconcileAround(X + 8, Y);
check('its soil dug off: the iron vein again', w.getTile(X + 8, Y) === TileType.Rock && w.getData(X + 8, Y) === IRON, `${w.getTile(X + 8, Y)}:${w.getData(X + 8, Y)}`);
onCorner.perform(tileAt(X + 8), game);
put(X + 8.5, Y + 0.5);
mine.ORE_CHANGE_ASK = ask(change, tileAt(X + 8, sand.uid));
check('dropped again, Change tile on that dirt: offered and allowed', change.applies(tileAt(X + 8, sand.uid), game) && mine.ORE_CHANGE_ASK === 'none', mine.ORE_CHANGE_ASK);
change.perform(tileAt(X + 8, sand.uid), game);
check('and lays sand', w.getTile(X + 8, Y) === TileType.Sand, String(w.getTile(X + 8, Y)));
put(X + 10.3, Y + 0.3);
mine.SEAM_HERE = ask(here, { kind: 'item', uid: clay.uid });
check('Drop dirt at your feet beside a coal seam: allowed', mine.SEAM_HERE === 'none', mine.SEAM_HERE);
here.perform({ kind: 'item', uid: clay.uid }, game);
check('and the seam, soil on its corners, dirt', w.getTile(X + 10, Y) === TileType.Dirt, String(w.getTile(X + 10, Y)));

put(X + 16.5, Y + 0.5);
for (const it of [...game.inventory.items]) if (it.id === 'dirt' || it.id === 'sand') game.inventory.remove(it.uid, it.count);
check('Change tile not offered on clay with clay alone to hand', !change.applies(tileAt(X + 16), game));
mine.ONLY_CLAY = ask(change, tileAt(X + 16));
mine.SAME = ask(change, tileAt(X + 16, clay.uid));
check('and refused with clay named', mine.SAME === 'Already clay.', mine.SAME);
void dirt;

/* ---- the same words ---------------------------------------------------------------- */

for (const [k, v] of Object.entries(mine)) check(`said the same on both sides: ${k}`, v === at(k), `browser "${v}", island "${at(k)}"`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ndrop dirt and change tile — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
