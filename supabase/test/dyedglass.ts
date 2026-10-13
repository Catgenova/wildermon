/**
 * Dyed glass (`dyes.ts`, `TINTED_PANE`), on both sides.
 *
 * A glass panel takes a dye, at its own litres, the same on both sides; one
 * pane of a pile is dyed and the rest stay clear, a pile of their own, in the
 * same words; and a window glazed with dyed panes keeps their colour on the
 * wall -- `Wall.glass` in the browser, `wall.glass` on the island -- through
 * the ground read into every browser that sees it, while a window glazed with
 * clear panes stays clear, and a bay window takes the colour as a window does.
 *
 * Runs against the database the suite leaves behind; the island half is
 * rolled back.
 *
 *   npx esbuild supabase/test/dyedglass.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/dyedglass.mjs && node node_modules/.cache/dyedglass.mjs
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { WALL_TYPE_BY_ID, type Side, type Wall } from '../../src/game/building';
import { DYEABLE_ITEMS, paneTint, takesDye, TINTED_PANE } from '../../src/game/dyes';
import { colourWord, DYE_PANE_LITRES, dyeHex, dyeLitresFor, dyeText, pureDye } from '../../src/game/dyestuffs';
import { Game, type IslandGround } from '../../src/game/game';
import { itemName, type Item } from '../../src/game/items';
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

/* ---- what takes a dye, and how much ----------------------------------------------- */

check(`the pane a window is glazed with is a ${itemName({ uid: 0, id: TINTED_PANE, ql: 1, dmg: 0, count: 1 }).toLowerCase()}, and it takes a dye`,
  DYEABLE_ITEMS.has(TINTED_PANE) && takesDye(TINTED_PANE) && psql(`select tinted_pane() || '|' || takes_dye(tinted_pane())`) === `${TINTED_PANE}|true`
    && (WALL_TYPE_BY_ID.get('window')?.fittings ?? []).some(([id]) => id === TINTED_PANE));
check(`a pane takes ${DYE_PANE_LITRES} litre of dye, the same on both sides`,
  dyeLitresFor(TINTED_PANE) === DYE_PANE_LITRES && psql(`select dye_litres_for(tinted_pane())`) === String(DYE_PANE_LITRES));

const RED = pureDye('red', 50);
const RED_HEX = dyeHex(RED);
const BLUE = pureDye('blue', 50);
const BLUE_HEX = dyeHex(BLUE);
const RED_BUCKET = dyeText(RED, 10);
const PANES = WALL_TYPE_BY_ID.get('window')?.fittings?.find(([id]) => id === TINTED_PANE)?.[1] ?? 0;
const BAY = WALL_TYPE_BY_ID.get('bay')?.fittings?.find(([id]) => id === TINTED_PANE)?.[1] ?? 0;
const NEED = (n: number): string => `'{"log": 0, "${TINTED_PANE}": ${n}}'::jsonb`;

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000c1';
const T = (x: number, side: Side): string => `'{"x":${x},"y":30,"side":"${side}"}'::jsonb`;
const out = psql(`
set wurm.season = '';
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_g bigint; v_b bigint; n int; v_ground jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stained', 164, 64, 30, 30, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 30.5, y = 30.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;

  -- 1. One pane of a pile dyed red, out of a bucket of red dye; the rest stay clear.
  v_g := give(w, u, tinted_pane(), ${PANES}, 40);
  insert into item (world_id, holder, holder_uid, def, ql, count, dye) values (w, 'player', u, 'dye_bucket', 60, 1, '${RED_BUCKET}')
    returning id into v_b;
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'dye_item', jsonb_build_object('kind', 'item', 'uid', v_g)), 'none'));
  perform act_perform(w, u, 'dye_item', jsonb_build_object('kind', 'item', 'uid', v_g));
  insert into said select 'DYED', string_agg(coalesce(i.dye, 'clear') || 'x' || i.count, ',' order by i.dye nulls first)
    from item i where i.world_id = w and i.holder_uid = u and i.def = tinted_pane();
  insert into said values ('DYESAID', (select e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1));
  insert into said select 'LEFT', i.dye from item i where i.id = v_b;
  insert into said select 'LOOK', examine_item_text(w, u, i) from item i
    where i.world_id = w and i.holder_uid = u and i.def = tinted_pane() and i.dye is not null;

  -- 2. A window, a bay window and a second window, planned with their logs laid and only the glass to go.
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 1, 'Glass house', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, 30, 30), (w, 1, 31, 30);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
    (w, 0, 'h', 30, 30, 1, 'window', 'log', ${NEED(PANES)}, ${NEED(PANES)}),
    (w, 0, 'h', 31, 30, 1, 'bay', 'log', ${NEED(BAY)}, ${NEED(BAY)}),
    (w, 0, 'h', 30, 31, 1, 'window', 'log', ${NEED(PANES)}, ${NEED(PANES)});

  -- Glazed with red panes, one at a go.
  insert into item (world_id, holder, holder_uid, def, ql, count, dye) values (w, 'player', u, tinted_pane(), 40, ${PANES}, '${RED_HEX}');
  for n in 1 .. ${PANES} loop perform perform_building(w, u, 'build_wall', ${T(30, 'n')}); end loop;
  insert into said select 'WINDOW', coalesce(wl.glass, 'clear') || '|' || (wl.needed->>tinted_pane()) from wall wl
    where wl.world_id = w and wl.dir = 'h' and wl.x = 30 and wl.y = 30;
  -- A bay window, in blue.
  insert into item (world_id, holder, holder_uid, def, ql, count, dye) values (w, 'player', u, tinted_pane(), 40, ${BAY}, '${BLUE_HEX}');
  for n in 1 .. ${BAY} loop perform perform_building(w, u, 'build_wall', ${T(31, 'n')}); end loop;
  insert into said select 'BAY', coalesce(wl.glass, 'clear') || '|' || (wl.needed->>tinted_pane()) from wall wl
    where wl.world_id = w and wl.dir = 'h' and wl.x = 31 and wl.y = 30;
  -- And one in clear panes, which stays clear.
  perform give(w, u, tinted_pane(), ${PANES}, 40);
  for n in 1 .. ${PANES} loop perform perform_building(w, u, 'build_wall', ${T(30, 's')}); end loop;
  insert into said select 'CLEAR', coalesce(wl.glass, 'clear') || '|' || (wl.needed->>tinted_pane()) from wall wl
    where wl.world_id = w and wl.dir = 'h' and wl.x = 30 and wl.y = 31;

  -- 3. Said on the ground read, for every browser that sees it.
  v_ground := rpc_ground(w, 40, true);
  insert into said values ('GROUND', v_ground::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(164, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(30.5, 30.5, 0);
g.settings.fromStores = false;
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said[said.length - 1] ?? '';
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;

/* 1. Dyed. */
const pile = g.inventory.add(TINTED_PANE, { ql: 40, count: PANES });
const bucket = g.inventory.add('dye_bucket', { ql: 60 });
bucket.dye = RED_BUCKET;
const dyeAsk = act('dye_item').check?.({ kind: 'item', uid: pile.uid }, g) ?? 'none';
act('dye_item').perform({ kind: 'item', uid: pile.uid }, g);
const panes = g.inventory.items.filter((it) => it.id === TINTED_PANE);
const dyedHere = panes.slice().sort((a, b) => (a.dye ?? '').localeCompare(b.dye ?? '')).map((it) => `${it.dye ?? 'clear'}x${it.count}`).join(',');
check(`one pane of a pile of ${PANES} is dyed red and the rest stay clear, a pile of their own, on both sides`,
  isle.get('ASK') === 'none' && dyeAsk === 'none' && isle.get('DYED') === dyedHere && dyedHere === `clearx${PANES - 1},${RED_HEX}x1`,
  `island ${isle.get('DYED')}, browser ${dyedHere}`);
check(`in the same words: ${lastHere()}`, isle.get('DYESAID') === lastHere() && lastHere().includes(colourWord(RED_HEX)), isle.get('DYESAID'));
check(`and ${DYE_PANE_LITRES} litre comes out of the bucket, on both sides`,
  isle.get('LEFT') === bucket.dye && bucket.dye === dyeText(RED, 10 - DYE_PANE_LITRES), `island ${isle.get('LEFT')}, browser ${bucket.dye}`);
const red = panes.find((it) => it.dye) as Item;
act('examine_item').perform({ kind: 'item', uid: red.uid }, g);
check(`a dyed pane keeps its colour and says it: ${itemName(red)}`, !!isle.get('LOOK')?.startsWith(itemName(red)) && lastHere().startsWith(itemName(red))
  && isle.get('LOOK') === lastHere() && paneTint(red) === RED_HEX, `${isle.get('LOOK')} / ${lastHere()}`);

/* 2. Glazed. */
g.inventory.items.length = 0;
const b = g.buildings.create('Glass house', 30, 30);
const plan = (x: number, y: number, side: Side, type: 'window' | 'bay', n: number): Wall => {
  const wall = g.buildings.setWall(b, 0, x, y, side, type, 'log');
  for (const k of Object.keys(wall.needed)) wall.needed[k] = 0;
  wall.needed[TINTED_PANE] = n;
  return wall;
};
const glaze = (wall: Wall, x: number, y: number, side: Side, n: number): string => {
  for (let i = 0; i < n; i++) act('build_wall').perform({ kind: 'tile', x, y, cx: x, cy: y, side } as Target, g);
  return `${wall.glass ?? 'clear'}|${wall.needed[TINTED_PANE]}`;
};
const win = plan(30, 30, 'n', 'window', PANES);
g.inventory.add(TINTED_PANE, { ql: 40, count: PANES }).dye = RED_HEX;
const winHere = glaze(win, 30, 30, 'n', PANES);
check(`a window glazed with ${PANES} red panes is red, on both sides`, isle.get('WINDOW') === winHere && winHere === `${RED_HEX}|0`,
  `island ${isle.get('WINDOW')}, browser ${winHere}`);
const bay = plan(31, 30, 'n', 'bay', BAY);
g.inventory.add(TINTED_PANE, { ql: 40, count: BAY }).dye = BLUE_HEX;
const bayHere = glaze(bay, 31, 30, 'n', BAY);
check(`a bay window glazed with ${BAY} blue panes is blue, on both sides`, isle.get('BAY') === bayHere && bayHere === `${BLUE_HEX}|0`,
  `island ${isle.get('BAY')}, browser ${bayHere}`);
const clear = plan(30, 30, 's', 'window', PANES);
g.inventory.add(TINTED_PANE, { ql: 40, count: PANES });
const clearHere = glaze(clear, 30, 30, 's', PANES);
check('and a window glazed with clear panes is clear, on both sides', isle.get('CLEAR') === clearHere && clearHere === 'clear|0',
  `island ${isle.get('CLEAR')}, browser ${clearHere}`);

/* 3. Seen. */
{
  const seen = Game.create(164, 64);
  const ground = JSON.parse(isle.get('GROUND') ?? '{}') as IslandGround;
  seen.sawGround(ground);
  const glassAt = (x: number, y: number): string => {
    const found = [...seen.buildings.walls.values()].find((wl) => wl.dir === 'h' && wl.x === x && wl.y === y);
    return found ? found.glass ?? 'clear' : 'none';
  };
  check('the ground read brings each window\'s colour to every browser that sees it',
    glassAt(30, 30) === RED_HEX && glassAt(31, 30) === BLUE_HEX && glassAt(30, 31) === 'clear', `${glassAt(30, 30)} ${glassAt(31, 30)} ${glassAt(30, 31)}`);
}

for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`dyed glass — ${ok.length} of ${ok.length}`);
