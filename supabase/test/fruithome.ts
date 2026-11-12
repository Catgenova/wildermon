/**
 * The fruit trees held to their islands, carried onto an island founded before them.
 *
 * Reported: with the fog off, the map drew lemon trees on Volcano Isle, and walking there found none. The live
 * island was founded on 15 September and its land made by that day's generator; on 18 September each island got
 * its own fruit (`speciesFor`, `Region.trees`), and the island's land never did. `tools/move-ground.ts`'s
 * `fruitHome` carries that move onto it. Asked of it, against the database the suite leaves behind:
 *
 *   * an island laid as founding day's generator laid it (apple and olive where an island's own fruit grows now)
 *     comes out with the island's own fruit there, lemons on Volcano Isle and nowhere else;
 *   * every tree it changes keeps its age, and nothing else on the island changes;
 *   * a tile in `tile_change`, and a tree somebody planted of another kind, are left as they are;
 *   * the move is written down in `land_move`, the island's packed windows go, and a second run changes nothing.
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
import { packTreeData, TileType, TREE_DEFS, treeSpecies, treeVariant } from '../../src/world/tiles';
import { readAtlas } from '../../tools/atlas-node';

const { FRUIT_MOVE, FOUNDING_FRUIT, OWN_FRUIT, fruitHome, psql } = await import('../../tools/move-ground');

const sql = psql([process.env.PGDATABASE ?? 'postgres']);
const one = (text: string): string => sql(text)[0]?.[0] ?? '';

const SIZE = 1024;
const SEED = 4242;
const atlas = readAtlas();
const gen = generateAtlasWindow(SEED, atlas, 0, 0, SIZE, SIZE, SIZE);
const species = (n: string): number => TREE_DEFS.findIndex((t) => t.name === n);
const APPLE = species('Apple');
const OLIVE = species('Olive');
const OAK = species('Oak');
const LEMON = species('Lemon');
const VOLCANO = REGIONS.findIndex((R) => R.key === 'Volcano');
const region = new Uint8Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) region[y * SIZE + x] = regionAt(atlas, x, y, SIZE);

/* ---- the island as founding day laid it ----------------------------------- */

// Every tree the generator grows as its island's own fruit was an apple or an olive then, at the age it has now.
const tiles = Uint8Array.from(gen.tiles);
const data = Uint8Array.from(gen.data);
const own: number[] = [];
for (let i = 0; i < SIZE * SIZE; i++) {
  if (tiles[i] !== TileType.Tree || !OWN_FRUIT[region[i]]?.includes(treeSpecies(data[i]))) continue;
  data[i] = packTreeData(own.length % 3 ? APPLE : OLIVE, treeVariant(data[i]));
  own.push(i);
}
const lemons = own.filter((i) => treeSpecies(gen.data[i]) === LEMON);
check('the generator grows lemons on Volcano Isle, and they are among the trees to move', lemons.length > 0, `${lemons.length} of ${own.length}`);

// One of them dug about (in tile_change), and one planted over with an oak.
const dug = lemons[0];
const oak = lemons[1];
data[oak] = packTreeData(OAK, treeVariant(data[oak]));

const hex = (b: Uint8Array, y: number): string => Buffer.from(b.subarray(y * SIZE, (y + 1) * SIZE)).toString('hex');
const world = one(`insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fruit home', ${SEED}, ${SIZE}, 10, 10, false)
  returning id;`);
try {
  sql(`select land_blank('${world}', ${SIZE});`);
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    rows.push(`update land_tile set tiles = decode('${hex(tiles, y)}', 'hex'), data = decode('${hex(data, y)}', 'hex')
      where world_id = '${world}' and y = ${y};`);
  }
  sql(rows.join('\n'));
  sql(`insert into tile_change (world_id, x, y, tile, data, corners)
    values ('${world}', ${dug % SIZE}, ${Math.floor(dug / SIZE)}, ${TileType.Tree}, ${data[dug]}, array[0,0,0,0]);
    insert into land_chunk (world_id, cx, cy, tiles, heights) values ('${world}', 0, 0, '\\x00', '\\x00');`);

  /* ---- the move ------------------------------------------------------------ */

  const w = { id: world, name: 'Fruit home', seed: SEED, size: SIZE };
  const said = fruitHome(sql, w);
  const after = { tiles: new Uint8Array(SIZE * SIZE), data: new Uint8Array(SIZE * SIZE) };
  for (const [y, t, d] of sql(`select y, encode(tiles, 'hex'), encode(data, 'hex') from land_tile where world_id = '${world}' order by y;`)) {
    after.tiles.set(Buffer.from(t, 'hex'), Number(y) * SIZE);
    after.data.set(Buffer.from(d, 'hex'), Number(y) * SIZE);
  }

  const expected = own.length - 2;
  const grown = own.filter((i) => i !== dug && i !== oak && after.data[i] === packTreeData(treeSpecies(gen.data[i]), treeVariant(data[i])));
  check('every apple and olive where the island\'s own fruit grows now is that fruit, at its own age', grown.length === expected,
    `${grown.length} of ${expected}: ${said}`);
  check('the move counts what it changed', said.includes(` ${expected} `), said);

  const moving = new Set(own.filter((i) => i !== dug && i !== oak));
  let lemonsOff = 0;
  let lemonsOn = 0;
  let others = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (after.tiles[i] === TileType.Tree && treeSpecies(after.data[i]) === LEMON) {
      if (region[i] === VOLCANO) lemonsOn++;
      else lemonsOff++;
    }
    if (moving.has(i)) continue;
    if (after.tiles[i] !== tiles[i] || after.data[i] !== data[i]) others++;
  }
  check('lemons on Volcano Isle, and on no other island', lemonsOn === lemons.length - 2 && lemonsOff === 0, `${lemonsOn} on, ${lemonsOff} off`);
  check('nothing else on the island changes', others === 0, `${others} tiles`);
  check('a tile in tile_change is left as it is', after.data[dug] === data[dug] && FOUNDING_FRUIT.has(treeSpecies(after.data[dug])));
  check('an oak planted where a lemon grows now is left as it is', after.data[oak] === data[oak] && treeSpecies(after.data[oak]) === OAK);
  check('the move is written down, with what it changed', one(`select trees from land_move where world_id = '${world}' and move = '${FRUIT_MOVE}';`) === String(expected));
  check('and the packed windows of the old ground are gone', one(`select count(*) from land_chunk where world_id = '${world}';`) === '0');

  const again = fruitHome(sql, w);
  check('a second run changes nothing', again.includes(' 0 '), again);
  check('the island\'s other fruit come up too', [...new Set(grown.map((i) => TREE_DEFS[treeSpecies(after.data[i])].name))].length > 1,
    [...new Set(grown.map((i) => TREE_DEFS[treeSpecies(after.data[i])].name))].join(', '));
} finally {
  sql(`delete from world where id = '${world}';`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`${ok.length} ok, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
