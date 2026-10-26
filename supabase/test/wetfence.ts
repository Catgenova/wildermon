/**
 * A fence on a shore or a waterway's edge, the same on both sides.
 *
 * Reported: on a cobblestone path 0.1 m above the water, beside a waterway,
 * "Plan fence (west)" was refused "Not in water." -- "it is greyed out even
 * though the border is above water". A fence was refused whenever either tile
 * beside the border had any water on it, so none stood on any shore. Now only
 * a corner of the border itself under the water refuses it (`fenceBorderWet`,
 * `fence_border_wet`): below the sea's nothing, or below a pond on a tile
 * beside it; 'No room for posts.' asks only the dry side.
 *
 *   * the reported border: a path tile wet by one low corner of its own, the
 *     sea on the other side, both corners of the border 0.1 m up: planned;
 *   * a corner of the border at the sea's level: planned; one under it,
 *     refused; a border out in the sea, refused;
 *   * a pond: a border beside it above its level, and one at it, planned; one
 *     with a corner under it, refused;
 *   * the wet side a tree: planned; the dry side a tree: 'No room for posts.';
 *     a border all on land: planned, as before;
 *   * the reported fence planned and built to the end on both sides, and once
 *     finished it stops a step across it either way, from the water too.
 *
 * Runs against the database the suite leaves behind (Hoarding), in a
 * transaction it rolls back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { isDone, wallBill, type Side } from '../../src/game/building';
import { WaterField } from '../../src/world/springs';
import { TileType } from '../../src/world/tiles';

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

/* ---- the scene ----------------------------------------------------------------
 *
 * Corners 20 to 32 each way, grass at 30. A sea channel down corners x 22 and
 * 23 at minus 50; the corners at x 24 a tenth of a metre up (1), but (24, 21)
 * at the sea's level and (24, 27) a tenth under it; the corners at x 25 at 1,
 * but (25, 25) a tenth under, so the cobblestone path at (24, 24) is wet by a
 * corner of its own while its west border is dry. A tree out in the channel at
 * (23, 22), and one on land at (26, 20). A pond at level 25 on the tiles round
 * corner (29, 25), which is down at 20; corners (28, 26) and (29, 26) at 25.
 */
const BOX = { x0: 20, y0: 20, x1: 32, y1: 32 };
const POND = 25;
const height = (x: number, y: number): number => {
  if (x === 22 || x === 23) return -50;
  if (x === 24) return y === 21 ? 0 : y === 27 ? -1 : 1;
  if (x === 25) return y === 25 ? -1 : 1;
  if (x === 29 && y === 25) return 20;
  if (y === 26 && (x === 28 || x === 29)) return POND;
  return 30;
};
const PATH = { x: 24, y: 24 };
const TREES: Array<[number, number]> = [[23, 22], [26, 20]];
const tileOf = (x: number, y: number): TileType =>
  x === PATH.x && y === PATH.y ? TileType.Cobblestone : TREES.some(([a, b]) => a === x && b === y) ? TileType.Tree : TileType.Grass;
/** The pond's one corner under its water, and the tiles round it it lies on (`pondTiles`). */
const POND_CORNER: [number, number] = [29, 25];
const POND_TILES: Array<[number, number]> = [[28, 24], [29, 24], [28, 25], [29, 25]];

const UID = 'f3e70000-0001-4000-8000-0000000000e1';
const MAT = 'log';
const t = (x: number, y: number, side: Side): Target =>
  ({ kind: 'tile', x, y, cx: x, cy: y, side, wallType: 'fence', material: MAT } as unknown as Target);
const tj = (target: Target): string => JSON.stringify(target).replace(/'/g, "''");

/** Every border asked, and what both sides must say of it. */
const CASES: Array<{ what: string; x: number; y: number; side: Side; want: string | null }> = [
  { what: 'the reported border: a path wet by a low corner of its own, the sea beyond, both corners of the border 0.1 m up', x: 24, y: 24, side: 'w', want: null },
  { what: 'the same path\'s south border, its own low corner on it', x: 24, y: 24, side: 's', want: 'Not in water.' },
  { what: 'a corner of the border at the sea\'s level', x: 24, y: 20, side: 'w', want: null },
  { what: 'a corner of the border 0.1 m under the sea', x: 24, y: 26, side: 'w', want: 'Not in water.' },
  { what: 'a border out in the sea', x: 23, y: 24, side: 'w', want: 'Not in water.' },
  { what: 'a tree on the wet side: no posts there, none needed', x: 24, y: 22, side: 'w', want: null },
  { what: 'a tree on the dry side', x: 26, y: 21, side: 'n', want: 'No room for posts.' },
  { what: 'a border all on land, as before', x: 27, y: 22, side: 'n', want: null },
  { what: 'beside a pond, the border\'s corners above its level', x: 27, y: 24, side: 'e', want: null },
  { what: 'beside a pond, the border\'s corners at its level', x: 28, y: 25, side: 's', want: null },
  { what: 'beside a pond, a corner of the border under it', x: 28, y: 24, side: 'e', want: 'Not in water.' },
];

/* ---- the browser ---- */
const browser = (): Game => {
  const g = Game.create(4242);
  for (let x = BOX.x0; x <= BOX.x1; x++) for (let y = BOX.y0; y <= BOX.y1; y++) g.world.setHeight(x, y, height(x, y));
  for (let x = BOX.x0; x < BOX.x1; x++) for (let y = BOX.y0; y < BOX.y1; y++) g.world.setTile(x, y, tileOf(x, y));
  const field = new WaterField(g.world.w, g.world.h);
  field.set([{
    spring: 1, index: 0, level: POND, floor: 20, wet: new Set([POND_CORNER[1] * (g.world.w + 1) + POND_CORNER[0]]),
    lip: POND_CORNER, over: POND_CORNER, from: POND, since: 0,
  }], []);
  g.world.water = field;
  g.inventory.add('mallet', { ql: 40 });
  return g;
};
const PLAN = ACTION_BY_ID.get('plan_fence');
const BUILD = ACTION_BY_ID.get('build_wall');
if (!PLAN?.check || !BUILD?.check) throw new Error('there is no plan_fence or build_wall any more');
const g = browser();
check('the browser\'s pond lies where the island\'s does',
  POND_TILES.every(([x, y]) => g.world.surfaceAt(x, y) === POND) && g.world.surfaceAt(27, 24) === 0 && g.world.surfaceAt(28, 26) === 0,
  POND_TILES.map(([x, y]) => g.world.surfaceAt(x, y)).join(','));
check('the reported path counts as wet by its own low corner, and so does the sea beside it: what refused it before',
  g.world.hasWater(PATH.x, PATH.y) && g.world.hasWater(PATH.x - 1, PATH.y) && g.world.isPassable(PATH.x, PATH.y));
const mine = CASES.map((c) => PLAN.check?.(t(c.x, c.y, c.side), g) ?? null);

/* ---- the island ---- */
const LOGS = wallBill(MAT, 'fence').needed.log ?? 0;
const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; gx int; gy int; v_spring bigint; v_target jsonb; i int;
begin
  select id into w from world where name = 'Hoarding';
  delete from wall where world_id = w and x between ${BOX.x0} and ${BOX.x1} and y between ${BOX.y0} and ${BOX.y1};
  insert into player (world_id, uid, name, x, y, stats) values
    (w, '${UID}', 'Wren', ${PATH.x + 0.5}, ${PATH.y + 0.5}, '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb);
  perform give(w, '${UID}', 'mallet', 1, 40);
  ${(() => {
    const rows: string[] = [];
    for (let x = BOX.x0; x <= BOX.x1; x++) for (let y = BOX.y0; y <= BOX.y1; y++) rows.push(`perform land_set_height(w, ${x}, ${y}, ${height(x, y)});`);
    for (let x = BOX.x0; x < BOX.x1; x++) for (let y = BOX.y0; y < BOX.y1; y++) rows.push(`perform land_set_tile(w, ${x}, ${y}, ${tileOf(x, y)});`);
    return rows.join('\n  ');
  })()}
  insert into spring (world_id, x, y, cx, cy) values (w, ${POND_CORNER[0]}, ${POND_CORNER[1]}, ${POND_CORNER[0]}, ${POND_CORNER[1]}) returning id into v_spring;
  insert into spring_tile (world_id, x, y, spring_id, pond, level) values
    ${POND_TILES.map(([x, y]) => `(w, ${x}, ${y}, v_spring, 0, ${POND})`).join(', ')};
  ${CASES.map((c, i) => `insert into said values ('case${i}', coalesce(build_refusal(w, '${UID}', 'plan_fence', '${tj(t(c.x, c.y, c.side))}'::jsonb), 'null'));`).join('\n  ')}
  -- The reported fence, planned and built, standing on the path.
  v_target := '${tj(t(PATH.x, PATH.y, 'w'))}'::jsonb;
  update player set body_at = now(), x = ${PATH.x + 0.5}, y = ${PATH.y + 0.5}, level = 0 where world_id = w and uid = '${UID}';
  insert into said values ('ask', coalesce(act_refusal(w, '${UID}', 'plan_fence', v_target), 'null'));
  perform act_perform(w, '${UID}', 'plan_fence', v_target);
  insert into said values ('planned', coalesce((select type || ' ' || material || ' ' || needed::text from wall
    where world_id = w and level = 0 and dir = 'v' and x = ${PATH.x} and y = ${PATH.y}), 'none'));
  perform give(w, '${UID}', 'log', ${LOGS + 2}, 30);
  insert into said values ('build', coalesce(act_refusal(w, '${UID}', 'build_wall', v_target), 'null'));
  for i in 1..${LOGS + 5} loop
    exit when bill_done((wall_at(w, ${PATH.x}, ${PATH.y}, 'w')).needed);
    exit when act_refusal(w, '${UID}', 'build_wall', v_target) is not null;
    perform act_perform(w, '${UID}', 'build_wall', v_target);
  end loop;
  insert into said values ('built', coalesce(bill_done((wall_at(w, ${PATH.x}, ${PATH.y}, 'w')).needed)::text, 'none'));
end $$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;`);
const island = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';

CASES.forEach((c, i) => {
  const here = mine[i] ?? 'null';
  const there = island(`case${i}`);
  check(`${c.what} (${c.x}, ${c.y}, ${c.side}): ${c.want ?? 'planned'}, on both sides`, here === there && here === (c.want ?? 'null'),
    `browser "${here}", island "${there}"`);
});

/* ---- the reported fence, planned and built ---- */
check('on the island, standing on the path, Plan fence (west) is asked and allowed', island('ask') === 'null', island('ask'));
check('and it leaves a log fence on the path\'s west border', island('planned').startsWith(`fence ${MAT} `), island('planned'));
check('and with the logs in the pack it is built, to the end', island('build') === 'null' && island('built') === 'true', `${island('build')} / ${island('built')}`);

const target = t(PATH.x, PATH.y, 'w');
PLAN.perform(target, g);
const wall = g.buildings.wallOnBorder(0, { x: PATH.x, y: PATH.y, dir: 'v' });
check('in the browser it is planned on the same border', !!wall && wall.type === 'fence' && wall.material === MAT);
check('and until it is finished it stops nobody', !g.buildings.blocksAt(0, PATH.x, PATH.y, PATH.x - 1, PATH.y));
check('so a step off the path into the water, and back out onto it, is still taken while it is a plan',
  g.stepRule(PATH.x, PATH.y, 0, PATH.x - 1, PATH.y) === 0 && g.stepRule(PATH.x - 1, PATH.y, 0, PATH.x, PATH.y) === 0);
g.inventory.add('log', { count: LOGS + 2, ql: 30 });
const build = BUILD.check(target, g);
for (let i = 0; i < LOGS + 5 && wall && !isDone(wall) && !BUILD.check(target, g); i++) BUILD.perform(target, g);
check('and it is built, to the end, as on the island', build === null && !!wall && isDone(wall), String(build));
check('finished, it stops a step across it from the path into the water and from the water onto the path, for a body and a beast',
  g.buildings.blocksAt(0, PATH.x, PATH.y, PATH.x - 1, PATH.y) && g.buildings.blocksAt(0, PATH.x - 1, PATH.y, PATH.x, PATH.y)
  && g.buildings.blocksAt(0, PATH.x - 1, PATH.y, PATH.x, PATH.y, true));
check('so nobody walks or swims across it either way', g.stepRule(PATH.x, PATH.y, 0, PATH.x - 1, PATH.y) === null && g.stepRule(PATH.x - 1, PATH.y, 0, PATH.x, PATH.y) === null);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a fence stands on a shore where its border is above the water — ${ok.length} of ${ok.length}`);
