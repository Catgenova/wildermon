/**
 * Sand, clay, peat and tar workers Collect off the bed, the same on both sides.
 *
 * Asked for: "wildermon that gather peat sand clay etc should be doing the Collect action not the Dig action". A Mudlet
 * dug a corner of its clay down a step and wanted soil left on a corner above the water to do it (`sandCorner` in the
 * browser, `land_dirt` on the island), so clay beside a pond kept it idle. Now it collects off the top as a player's
 * Collect does: the ground left as it was.
 *
 * Reported: "Sandpip should be collecting sand which should have no timer. It is tripping the investigation timer on
 * the sand." A go marked the tile 'dig', Investigate's mark, and the bed waited out the forage cooldown. Now a bed has
 * no timer for a worker, as it has none for a player's Collect, and leaves no mark.
 *
 * So this asks, on both sides, of a clay tile at water level with no soil left on it:
 *
 *   * a Mudlet would work it;
 *   * a go at it gives a lump of clay and leaves every corner's height and soil as they were;
 *   * it leaves no mark, and is worked again straight after;
 *   * and ground a player has investigated is collected all the same.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { FORAGE_COOLDOWN, Game } from '../../src/game/game';
import { idleSays } from '../../src/game/workerlog';
import type { Creature } from '../../src/game/creatures';
import type { Item } from '../../src/game/items';
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
const lines = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));

const W = `(select id from world where name = 'Faraway')`;
const IVAR = `(select uid from player where world_id = ${W} and name = 'Ivar')`;
const SEED = Number(psql(`select seed from world where name = 'Faraway'`));
const X = 30;
const Y = 60;
const CORNERS: [number, number][] = [[X, Y], [X + 1, Y], [X, Y + 1], [X + 1, Y + 1]];

/* ---- the island ------------------------------------------------------------ */

const island = lines(psql(`begin;
delete from building_tile where world_id = ${W} and x between ${X - 1} and ${X + 1} and y between ${Y - 1} and ${Y + 1};
select land_set_tile(${W}, ${X}, ${Y}, tile_id('Clay'));
${CORNERS.map(([cx, cy]) => `select land_set_height(${W}, ${cx}, ${cy}, 0); select land_set_dirt(${W}, ${cx}, ${cy}, 0);`).join('\n')}
delete from foraged where world_id = ${W} and x = ${X} and y = ${Y};
select creature_spawn(${W}, 'noot', ${X + 0.5}, ${Y + 1.5}, 'deed', now() - interval '10 days', ${IVAR}) as digger \\gset
select 'WOULD|' || worker_gatherable(${W}, ${X}, ${Y}, 'clay', (select c from creature c where c.world_id = ${W} and c.id = :'digger'));
update creature set work_x = ${X}, work_y = ${Y}, job = 'clay' where world_id = ${W} and id = :'digger';
select 'GOT|' || coalesce((worker_do(${W}, :'digger'))->>'def', '-');
select 'GROUND|' || string_agg(land_height(${W}, cx, cy) || '/' || land_dirt(${W}, cx, cy), ' ' order by k)
  from unnest(array[${CORNERS.map(([cx]) => cx).join(', ')}], array[${CORNERS.map(([, cy]) => cy).join(', ')}]) with ordinality u(cx, cy, k);
select 'MARKED|' || exists (select 1 from foraged where world_id = ${W} and x = ${X} and y = ${Y});
select 'AGAIN|' || worker_gatherable(${W}, ${X}, ${Y}, 'clay', (select c from creature c where c.world_id = ${W} and c.id = :'digger'));
insert into foraged (world_id, x, y, kind, at) values (${W}, ${X}, ${Y}, 'dig', now());
select 'INVESTIGATED|' || worker_gatherable(${W}, ${X}, ${Y}, 'clay', (select c from creature c where c.world_id = ${W} and c.id = :'digger'));
select 'WAIT|' || coalesce(ceil(worker_wait_left(${W}, ${X}, ${Y}, 2, 'clay'))::text, 'none');
select 'WAITSAND|' || coalesce(ceil(worker_wait_left(${W}, ${X}, ${Y}, 2, 'sand'))::text, 'none');
rollback;`));
const get = (k: string): string => island.get(k) ?? 'MISSING';

/* ---- the browser ----------------------------------------------------------- */

const g = Game.create(SEED);
g.world.setTile(X, Y, TileType.Clay, 0);
for (const [cx, cy] of CORNERS) {
  g.world.setHeight(cx, cy, 0);
  g.world.setDirt(cx, cy, 0);
}
const c = g.creatures.spawn('noot', X + 0.5, Y + 1.5, 'deed');
const would = g.creatures.gatherable(g, X, Y, 'clay', c);
c.workX = X;
c.workY = Y;
const finish = (g.creatures as unknown as { finishCollect(game: Game, c: Creature, y: 'clay'): Item | null }).finishCollect.bind(g.creatures);
const got = finish(g, c, 'clay');
const ground = CORNERS.map(([cx, cy]) => `${g.world.getHeight(cx, cy)}/${g.world.getDirt(cx, cy)}`).join(' ');
const marked = g.isForaged(X, Y, 'dig');
const again = g.creatures.gatherable(g, X, Y, 'clay', c);
g.markForaged(X, Y, 'dig');
const investigated = g.creatures.gatherable(g, X, Y, 'clay', c);

check('a Mudlet would work clay at water level with no soil left, on both sides', would && get('WOULD') === 'true', `island ${get('WOULD')}, browser ${would}`);
check('a go at it gives a lump of clay, on both sides', got?.id === 'clay' && get('GOT') === 'clay', `island ${get('GOT')}, browser ${got?.id}`);
check('and leaves every corner\'s height and soil as they were (collected, not dug), on both sides',
  ground === '0/0 0/0 0/0 0/0' && get('GROUND') === ground, `island ${get('GROUND')}, browser ${ground}`);
check('it leaves no mark on the tile, on both sides', !marked && get('MARKED') === 'false', `island ${get('MARKED')}, browser ${marked}`);
check('and it is worked again straight after: no timer on a bed, on both sides', again && get('AGAIN') === 'true', `island ${get('AGAIN')}, browser ${again}`);
check('and ground a player has just investigated is collected all the same, on both sides',
  investigated && get('INVESTIGATED') === 'true', `island ${get('INVESTIGATED')}, browser ${investigated}`);
check('and the island never has a bed worker waiting on one, clay or sand', get('WAIT') === 'none' && get('WAITSAND') === 'none',
  `clay ${get('WAIT')}, sand ${get('WAITSAND')}`);
// A reed bed still has its cooldown: the wait till it is back, and the card says so (`worker_wait_left`, `idleSays` 'waiting').
check('and a worker waiting on a reed bed says when it is back', idleSays({ why: 'waiting', n: FORAGE_COOLDOWN }, 'reed') === `Idle: all in reach worked; next reed bed in ${FORAGE_COOLDOWN} s.`,
  idleSays({ why: 'waiting', n: FORAGE_COOLDOWN }, 'reed'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`sand, clay, peat and tar workers collect, the same on both sides — ${ok.length} of ${ok.length}`);
