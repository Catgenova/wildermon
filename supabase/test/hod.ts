/**
 * A hod carrier brings a planned wall what the settlement's stores hold.
 *
 * Asked about: "Cibbe at level 1 isnt bringing marble bricks and mortar to planned solid marble wall 7 tiles away".
 * A level 1 cobbe on a settlement, a solid marble wall planned seven tiles from the token, its marble brick and mortar
 * kept in a chest (not a crate), and nearer the token a log wall nobody has brought logs for. Asked of both sides:
 *
 *   * it brings the marble wall brick and mortar out of the chest and fits them, whichever is furthest behind its
 *     bill first, and leaves the log wall alone rather than standing idle over what it cannot have;
 *   * what goes into the wall comes out of the chest, one for one.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';
import { SPECIES, workRangeOf } from '../../src/game/creatures';
import type { Item } from '../../src/game/items';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

/** The token, and the two walls: the marble one seven tiles off, the log one nearer. */
const TOKEN = [16, 16] as const;
const MARBLE = [TOKEN[0] + 7, TOKEN[1]] as const;
const LOGS = [TOKEN[0] + 1, TOKEN[1] + 2] as const;
const CHEST = [TOKEN[0] + 2, TOKEN[1]] as const;
const BRICKS = 32, MORTAR = 16;

/* ---- the island ---------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-000000000d01';
const isle = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_id int; v_chest bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodwork', 181, 40, ${TOKEN[0]}, ${TOKEN[1]}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  update player set x = ${TOKEN[0]} + 0.5, y = ${TOKEN[1]} + 0.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodstead', ${TOKEN[0]}, ${TOKEN[1]}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count)
    values (w, 'furniture', v_chest, 'marble_brick', 30, ${BRICKS}), (w, 'furniture', v_chest, 'mortar', 30, ${MORTAR});
  insert into building (world_id, id, name, planned_by) values (w, 1, 'Hall', u), (w, 2, 'Shed', u);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 0, 'h', ${MARBLE[0]}, ${MARBLE[1]}, 1, 'solid', 'marble', wall_bill('marble', 'solid'), wall_bill('marble', 'solid'), u),
    (w, 0, 'h', ${LOGS[0]}, ${LOGS[1]}, 2, 'solid', 'log', wall_bill('log', 'solid'), wall_bill('log', 'solid'), u);
  v_id := creature_spawn(w, 'cobbe', ${TOKEN[0]} + 0.6, ${TOKEN[1]} + 0.6, 'active', now() - interval '60 days', u);
  insert into said select 'LEVEL', creature_level(c.skills) || '|' || work_range(c) from creature c where c.world_id = w and c.id = v_id;
  -- An hour of it, played back.
  update creature set mode = 'deed', stance = 'passive', hunger = 1, phase = 'idle', from_x = to_x, from_y = to_y,
         until = now() - interval '3600 seconds', settled_at = now() - interval '3600 seconds', leg_at = now() - interval '3600 seconds',
         leg_ends = now() - interval '3600 seconds'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'MARBLE', (needed->>'marble_brick') || '|' || (needed->>'mortar') from wall
   where world_id = w and level = 0 and x = ${MARBLE[0]} and y = ${MARBLE[1]};
  insert into said select 'LOG', (needed->>'log') || '|' || (total->>'log') from wall where world_id = w and level = 0 and x = ${LOGS[0]} and y = ${LOGS[1]};
  insert into said select 'CHEST', coalesce((select count from item where world_id = w and placed = v_chest and def = 'marble_brick'), 0)
    || '|' || coalesce((select count from item where world_id = w and placed = v_chest and def = 'mortar'), 0);
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(isle.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
const [mb, mm] = (said.get('MARBLE') ?? '').split('|').map(Number);
const [cb, cm] = (said.get('CHEST') ?? '').split('|').map(Number);
const [logNeed, logTotal] = (said.get('LOG') ?? '').split('|');
const bill = [BRICKS, MORTAR];
check('on the island: a level 1 cobbe reaches past seven tiles from the token', (() => { const [lv, rng] = (said.get('LEVEL') ?? '').split('|').map(Number); return lv === 1 && rng >= 7; })(), said.get('LEVEL'));
check('it brings the marble wall brick and mortar out of the chest and fits them',
  mb < bill[0] && mm < bill[1], `still wanted ${said.get('MARBLE')}`);
check('what went into the wall came out of the chest, one for one, give or take one in hand',
  BRICKS - cb >= bill[0] - mb && MORTAR - cm >= bill[1] - mm && (BRICKS - cb) + (MORTAR - cm) - (bill[0] - mb) - (bill[1] - mm) <= 1,
  `chest ${said.get('CHEST')}, wall ${said.get('MARBLE')}`);
check('and the log wall nobody brought logs for is left as it was', logNeed === logTotal, said.get('LOG'));

/* ---- the browser --------------------------------------------------------- */

const g = Game.create(4242);
// A patch of flat grass round the token, so nothing but the job decides where it goes.
const [tx, ty] = [64, 64];
for (let y = ty - 4; y <= ty + 6; y++) for (let x = tx - 4; x <= tx + 11; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.player.x = tx + 0.5;
g.player.y = ty + 0.5;
g.deed = { name: 'Hodstead', x: tx, y: ty, radius: 10, level: 1 };
const stack = (id: string, count: number): Item => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count });
const chest = g.addFurniture('chest', tx + 2, ty, 0, 0, 40, [stack('marble_brick', BRICKS), stack('mortar', MORTAR)]);
const marble = g.buildings.setFence(tx + 7, ty, 'n', 'solid', 'marble');
const logs = g.buildings.setFence(tx + 1, ty + 2, 'n', 'solid', 'log');
const marbleBill = { ...marble.needed }, logBill = { ...logs.needed };
const cobbe = g.creatures.spawn('cobbe', tx + 3.5, ty + 1.5, 'deed');
check('in the browser: a level 1 cobbe reaches past seven tiles from the token', workRangeOf(cobbe, SPECIES.cobbe) >= 7, String(workRangeOf(cobbe, SPECIES.cobbe)));
for (let i = 0; i < 72000; i++) {
  g.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g.update(0.05);
}
const left = (id: string): number => chest.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const fitB = marbleBill.marble_brick - marble.needed.marble_brick, fitM = marbleBill.mortar - marble.needed.mortar;
check('it brings the marble wall brick and mortar out of the chest and fits them', fitB > 0 && fitM > 0,
  `fitted ${fitB} brick and ${fitM} mortar`);
check('what went into the wall came out of the chest, one for one, give or take one in hand',
  BRICKS - left('marble_brick') >= fitB && MORTAR - left('mortar') >= fitM && (BRICKS - left('marble_brick')) + (MORTAR - left('mortar')) - fitB - fitM <= 1,
  `chest ${left('marble_brick')}|${left('mortar')}`);
check('and the log wall nobody brought logs for is left as it was', JSON.stringify(logs.needed) === JSON.stringify(logBill), JSON.stringify(logs.needed));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na hod carrier brings what the stores hold — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
