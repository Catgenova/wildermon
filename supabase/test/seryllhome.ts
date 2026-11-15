/**
 * Seryll lies in the heart of Volcano Isle's labyrinth of lava and nowhere else, on the generator and on an island
 * founded before it once the ground is moved (`seryllHome`, `tools/move-ground.ts`).
 *
 * Asked for: "Make it so seryll only spawns within that interior safe area of the labyrinth." Asked of the generator
 * at the live island's size on two seeds, and of an island of 1024 founded with the old ground: seryll scattered over
 * Volcano Isle and none in the heart, one of those tiles dug about since (in `tile_change`). After the move:
 *
 *   * the generator lays no seryll outside the heart and a sensible amount in it (`SERYLL_HEART` of its dry ground);
 *   * the island holds no seryll outside the heart but on the tile somebody changed, and in the heart exactly the
 *     seams the generator lays there; nothing else moves; the move is written down, and a second run changes nothing.
 *
 * The island is made for the test and deleted after it.
 */
import { ok, bad, check } from './harness';
process.env.MOVE_GROUND_TEST = '1';
process.env.PGHOST ??= '/var/run/postgresql';
process.env.PGPORT ??= '5433';
process.env.PGUSER ??= 'wildermon';

import { generateAtlasWindow, regionAt } from '../../src/world/atlas-world';
import { REGIONS } from '../../src/world/regions';
import { ROCK_VARIANTS, TileType } from '../../src/world/tiles';
import { inLavaHeart, lavaGeometry, SERYLL_HEART } from '../../src/world/lavaland';
import { readAtlas } from '../../tools/atlas-node';

const { SERYLL_MOVE, seryllHome, psql } = await import('../../tools/move-ground');

const sql = psql([process.env.PGDATABASE ?? 'postgres']);
const one = (text: string): string => sql(text)[0]?.[0] ?? '';
const atlas = readAtlas();
const SERYLL = ROCK_VARIANTS.findIndex((r) => r.yields === 'seryll_ore');
const IRON = ROCK_VARIANTS.findIndex((r) => r.yields === 'iron_ore');
const VOLCANO = REGIONS.findIndex((R) => R.key === 'Volcano');

/* ---- the generator, at the live island's size -------------------------------------------------------------------- */

for (const seed of [7, 4242]) {
  const S = 4096;
  const g = lavaGeometry(S);
  const x0 = 1000, y0 = 0, w = 2200, h = 1300;
  const win = generateAtlasWindow(seed, atlas, x0, y0, w, h, S);
  let inside = 0, outside = 0, dry = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const heart = inLavaHeart(x0 + x, y0 + y, S);
      if (heart && win.heights[y * (w + 1) + x] > 0) dry++;
      if (win.rock[y * w + x] !== SERYLL) continue;
      if (heart) inside++;
      else outside++;
    }
  }
  check(`seed ${seed}, 4096: no seryll outside the heart (${g.heart} tiles round ${g.cx}, ${g.cy})`, outside === 0, String(outside));
  check(`seed ${seed}, 4096: ${inside} seryll seams in the heart, about ${SERYLL_HEART * 100}% of its ${dry} dry tiles`, inside > dry * SERYLL_HEART * 0.6 && inside < dry * SERYLL_HEART * 1.6,
    `${inside} of ${dry}`);
}

/* ---- an island founded on the old ground ----------------------------------------------------------------------------- */

const SIZE = 1024;
const SEED = 4242;
const gen = generateAtlasWindow(SEED, atlas, 0, 0, SIZE, SIZE, SIZE);
const rock = Uint8Array.from(gen.rock);
// The old ground: no seryll in the heart (iron), and seryll on every 400th dry tile of Volcano Isle outside it.
const scattered: number[] = [];
for (let i = 0; i < SIZE * SIZE; i++) {
  const x = i % SIZE, y = (i - x) / SIZE;
  if (rock[i] === SERYLL) rock[i] = IRON;
  else if (i % 400 === 0 && regionAt(atlas, x, y, SIZE) === VOLCANO && !inLavaHeart(x, y, SIZE) && gen.heights[y * (SIZE + 1) + x] > 0) {
    rock[i] = SERYLL;
    scattered.push(i);
  }
}
const heartSeams = [...gen.rock.keys()].filter((i) => gen.rock[i] === SERYLL);
check('the generator lays seryll in the heart at this size too, and the old ground scattered it', heartSeams.length > 0 && scattered.length > 20, `${heartSeams.length} / ${scattered.length}`);
const dug = scattered[0];

const hex = (b: Uint8Array, y: number): string => Buffer.from(b.subarray(y * SIZE, (y + 1) * SIZE)).toString('hex');
const world = one(`insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Seryll home', ${SEED}, ${SIZE}, 10, 10, false) returning id;`);
try {
  sql(`select land_blank('${world}', ${SIZE});`);
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) rows.push(`update land_tile set rock = decode('${hex(rock, y)}', 'hex') where world_id = '${world}' and y = ${y};`);
  sql(rows.join('\n'));
  sql(`insert into tile_change (world_id, x, y, tile, data, corners) values ('${world}', ${dug % SIZE}, ${Math.floor(dug / SIZE)}, ${TileType.Rock}, 0, array[0,0,0,0]);`);
  const w = { id: world, name: 'Seryll home', seed: SEED, size: SIZE };
  const said = seryllHome(sql, w);
  const after = new Uint8Array(SIZE * SIZE);
  for (const [y, r] of sql(`select y, encode(rock, 'hex') from land_tile where world_id = '${world}' order by y;`)) after.set(Buffer.from(r, 'hex'), Number(y) * SIZE);
  let outside = 0, inside = 0, others = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE, y = (i - x) / SIZE;
    if (after[i] === SERYLL) {
      if (inLavaHeart(x, y, SIZE)) inside++;
      else if (i !== dug) outside++;
    }
    if (after[i] !== rock[i] && !scattered.includes(i) && gen.rock[i] !== SERYLL) others++;
  }
  check('the island holds no seryll outside the heart once moved', outside === 0, `${outside}: ${said}`);
  check('and in the heart exactly the seams the generator lays there', inside === heartSeams.length && heartSeams.every((i) => after[i] === SERYLL), `${inside} / ${heartSeams.length}`);
  check('the seams moved off became what the ground lays there now', scattered.filter((i) => i !== dug).every((i) => after[i] === gen.rock[i]));
  check('a tile in tile_change is left as it is', after[dug] === SERYLL);
  check('nothing else on the island changes', others === 0, String(others));
  check('the move is written down', one(`select rock from land_move where world_id = '${world}' and move = '${SERYLL_MOVE}';`) === String(scattered.length - 1 + heartSeams.length));
  const again = seryllHome(sql, w);
  check('a second run changes nothing', again.includes(': 0 ') && again.includes(', 0 laid'), again);
} finally {
  sql(`delete from world where id = '${world}';`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`${ok.length} ok, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
