/**
 * Trees and wildermon on the Northeast Tundra again (14 November).
 *
 * Asked for: "Allow vegetation and wildermon spawning again on the marble island." The tundra was made treeless on
 * 8 October (`Region.treeless`): the generator laid the ground under a tree instead, `tree_day` let nothing seed
 * there, and `tools/move-ground.ts`'s `clearTrees` took the untouched trees off islands already founded. Its wild
 * was monsters only until lairs. Asked of it now, against the database the suite leaves behind:
 *
 *   * the browser's generator lays trees on the tundra by the rules it uses on every island: trees there, some on
 *     tundra ground, none on snow, and none at all with the flag set back;
 *   * `regrowTrees` puts back every tree the generator lays there now on a tile that still holds what the treeless
 *     generator laid, and nothing else: a tile in `tile_change`, a tile somebody changed and a tree somebody
 *     planted stay; the move is written down, the packed windows go, a second run changes nothing;
 *   * no island of the chart is treeless on the island's side, and a tree that dies on the tundra seeds there;
 *   * a block of the tundra is stocked with wildermon, and no monster.
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
import { packTreeData, TileType, TREE_DEFS, treeSpecies } from '../../src/world/tiles';
import { readAtlas } from '../../tools/atlas-node';

const { REGROW, regrowTrees, treelessWindow, psql } = await import('../../tools/move-ground');

const sql = psql([process.env.PGDATABASE ?? 'postgres']);
const one = (text: string): string => sql(text)[0]?.[0] ?? '';

const SIZE = 1024;
const SEED = 4242;
const N = SIZE * SIZE;
const atlas = readAtlas();
const TUNDRA = REGIONS.findIndex((R) => R.key === 'NortheastTundra');
const OAK = TREE_DEFS.findIndex((t) => t.name === 'Oak');
const region = new Uint8Array(N);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) region[y * SIZE + x] = regionAt(atlas, x, y, SIZE);

/* ---- the browser's generator --------------------------------------------- */

const now = generateAtlasWindow(SEED, atlas, 0, 0, SIZE, SIZE, SIZE);
const then = treelessWindow(SEED, atlas, TUNDRA, 0, 0, SIZE, SIZE, SIZE);
check('no island of the chart is treeless', REGIONS.every((R) => !R.treeless), REGIONS.filter((R) => R.treeless).map((R) => R.name).join(', '));

let treesNow = 0, treesThen = 0, onTundra = 0, onSnow = 0;
const kinds = new Set<string>();
for (let i = 0; i < N; i++) {
  if (region[i] !== TUNDRA) continue;
  if (then.tiles[i] === TileType.Tree) treesThen++;
  if (now.tiles[i] !== TileType.Tree) continue;
  treesNow++;
  kinds.add(TREE_DEFS[treeSpecies(now.data[i])].name);
  if (then.tiles[i] === TileType.Tundra) onTundra++;
  if (then.tiles[i] === TileType.Snow) onSnow++;
}
check('the generator lays trees on the Northeast Tundra', treesNow > 0, `${treesNow} trees: ${[...kinds].join(', ')}`);
check('some of them on tundra ground', onTundra > 0, `${onTundra}`);
check('none on snow', onSnow === 0, `${onSnow}`);
check('and none there with the flag set back, as it was from 8 October', treesThen === 0, `${treesThen}`);
let elsewhere = 0;
for (let i = 0; i < N; i++) if (region[i] !== TUNDRA && (now.tiles[i] !== then.tiles[i] || now.data[i] !== then.data[i])) elsewhere++;
check('every other island\'s ground is as it was', elsewhere === 0, `${elsewhere} tiles`);

/* ---- the island as the treeless generator laid it ------------------------- */

const tiles = Uint8Array.from(then.tiles);
const data = Uint8Array.from(then.data);
const back: number[] = [];
for (let i = 0; i < N; i++) if (now.tiles[i] === TileType.Tree && then.tiles[i] !== TileType.Tree) back.push(i);
check('every tree the move is to bring back is on the tundra', back.every((i) => region[i] === TUNDRA), `${back.length}`);
// One dug about (in tile_change), one turned to packed dirt, and an oak planted where none grows now.
const dug = back[0];
const packed = back[1];
tiles[packed] = TileType.PackedDirt;
data[packed] = 0;
let planted = -1;
for (let i = 0; i < N && planted < 0; i++) {
  if (region[i] === TUNDRA && now.tiles[i] === TileType.Grass && then.tiles[i] === TileType.Grass) planted = i;
}
tiles[planted] = TileType.Tree;
data[planted] = packTreeData(OAK, 0);

const hex = (b: Uint8Array, y: number): string => Buffer.from(b.subarray(y * SIZE, (y + 1) * SIZE)).toString('hex');
const corners = (b: Int16Array | Uint8Array, y: number, bytes: number): string =>
  Buffer.from(b.buffer, b.byteOffset + y * (SIZE + 1) * bytes, (SIZE + 1) * bytes).toString('hex');
const world = one(`insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Tundra life', ${SEED}, ${SIZE}, 10, 10, false)
  returning id;`);
const readLand = (): { tiles: Uint8Array; data: Uint8Array } => {
  const got = { tiles: new Uint8Array(N), data: new Uint8Array(N) };
  for (const [y, t, d] of sql(`select y, encode(tiles, 'hex'), encode(data, 'hex') from land_tile where world_id = '${world}' order by y;`)) {
    got.tiles.set(Buffer.from(t, 'hex'), Number(y) * SIZE);
    got.data.set(Buffer.from(d, 'hex'), Number(y) * SIZE);
  }
  return got;
};
try {
  sql(`select land_blank('${world}', ${SIZE});`);
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    rows.push(`update land_tile set tiles = decode('${hex(tiles, y)}', 'hex'), data = decode('${hex(data, y)}', 'hex'),
      rock = decode('${hex(now.rock, y)}', 'hex') where world_id = '${world}' and y = ${y};`);
  }
  for (let y = 0; y <= SIZE; y++) {
    rows.push(`update land_corner set heights = decode('${corners(now.heights, y, 2)}', 'hex'), dirt = decode('${corners(now.dirt, y, 1)}', 'hex')
      where world_id = '${world}' and y = ${y};`);
  }
  sql(rows.join('\n'));
  sql(`insert into tile_change (world_id, x, y, tile, data, corners) values
      ('${world}', ${dug % SIZE}, ${Math.floor(dug / SIZE)}, ${tiles[dug]}, ${data[dug]}, array[0,0,0,0]),
      ('${world}', ${planted % SIZE}, ${Math.floor(planted / SIZE)}, ${tiles[planted]}, ${data[planted]}, array[0,0,0,0]);
    insert into land_chunk (world_id, cx, cy, tiles, heights) values ('${world}', 0, 0, '\\x00', '\\x00');`);

  /* ---- the move ------------------------------------------------------------ */

  const w = { id: world, name: 'Tundra life', seed: SEED, size: SIZE };
  const said = regrowTrees(sql, w);
  const after = readLand();
  const expected = back.length - 2;
  const grown = back.filter((i) => i !== dug && i !== packed && after.tiles[i] === TileType.Tree && after.data[i] === now.data[i]);
  check('every tree the generator lays on the tundra now is back, of its kind and age', grown.length === expected, `${grown.length} of ${expected}: ${said}`);
  check('the move counts what it changed', said.includes(` ${expected} `), said);
  const moving = new Set(grown);
  let others = 0;
  for (let i = 0; i < N; i++) if (!moving.has(i) && (after.tiles[i] !== tiles[i] || after.data[i] !== data[i])) others++;
  check('nothing else on the island changes', others === 0, `${others} tiles`);
  check('a tile in tile_change is left as it is', after.tiles[dug] === tiles[dug] && after.data[dug] === data[dug]);
  check('a tile somebody changed is left as it is', after.tiles[packed] === TileType.PackedDirt);
  check('a tree somebody planted is left as it is', after.tiles[planted] === TileType.Tree && treeSpecies(after.data[planted]) === OAK);
  check('the move is written down, with what it changed', one(`select trees from land_move where world_id = '${world}' and move = '${REGROW}';`) === String(expected));
  check('and the packed windows of the old ground are gone', one(`select count(*) from land_chunk where world_id = '${world}';`) === '0');
  const again = regrowTrees(sql, w);
  check('a second run changes nothing', again.includes(' 0 '), again);

  /* ---- the woods on the island -------------------------------------------- */

  check('the island holds no island of the chart treeless', one('select count(*) from generate_series(0, 255) r where region_treeless(r);') === '0');
  check('the tundra is the tundra on the island\'s side too',
    one(`select region_at('${world}', ${grown[0] % SIZE}, ${Math.floor(grown[0] / SIZE)});`) === String(TUNDRA));
  // Three hundred of the tundra's trees at the end of their days: they die in the next day, and seed round them.
  const dying = grown.filter((_, k) => k % Math.max(1, Math.floor(grown.length / 300)) === 0).slice(0, 300);
  const shrivelled = Number(one(`select id from tree_age_def where next is null and name = 'Shrivelled';`));
  const lines = new Set<number>();
  for (const i of dying) {
    after.data[i] = Number(one(`select tree_pack(${treeSpecies(after.data[i])}, ${shrivelled});`));
    lines.add(Math.floor(i / SIZE));
  }
  sql([...lines].map((y) => `update land_tile set data = decode('${hex(after.data, y)}', 'hex') where world_id = '${world}' and y = ${y};`).join('\n'));
  sql(`update world set ready = true where id = '${world}';`);
  sql(`select tree_day('${world}');`);
  const day = readLand();
  const sapling = Number(one('select tree_first();'));
  const died = dying.filter((i) => day.tiles[i] !== TileType.Tree).length;
  let seeded = 0;
  for (let i = 0; i < N; i++) {
    if (region[i] === TUNDRA && after.tiles[i] !== TileType.Tree && day.tiles[i] === TileType.Tree && (day.data[i] >> 4 & 7) === sapling) seeded++;
  }
  check('a shrivelled tree on the tundra dies in a day', died === dying.length, `${died} of ${dying.length}`);
  check('and the tundra\'s dead seed saplings on the tundra', seeded > 0, `${seeded} saplings`);
  sql(`update world set ready = false where id = '${world}';`);

  /* ---- the wild ------------------------------------------------------------ */

  // The block of the island with the most of the tundra's dry land in it.
  const B = Number(one('select stock_block();'));
  const best = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    if (region[i] !== TUNDRA || day.tiles[i] === TileType.Sand || then.tiles[i] === TileType.Rock) continue;
    const k = `${Math.floor((i % SIZE) / B)},${Math.floor(Math.floor(i / SIZE) / B)}`;
    best.set(k, (best.get(k) ?? 0) + 1);
  }
  const [bx, by] = [...best].sort((p, q) => q[1] - p[1])[0][0].split(',').map(Number);
  const before = Number(one(`select coalesce(max(id), 0) from creature where world_id = '${world}';`));
  const put = Number(one(`select creature_stock_block('${world}', ${bx}, ${by});`));
  const [wild, onIt, monsters, kindsWild] = sql(`select count(*), count(*) filter (where region_at(c.world_id, c.to_x, c.to_y) = ${TUNDRA}),
      count(*) filter (where s.monster), coalesce(string_agg(distinct c.species, ','), '-')
    from creature c join species_def s on s.id = c.species where c.world_id = '${world}' and c.id > ${before} and c.mode = 'wild';`)[0];
  check(`a block of the tundra (${bx}, ${by}) is stocked`, put > 0 && Number(wild) === put, `${put} put, ${wild} wild`);
  check('with wildermon standing on the tundra', Number(onIt) > 0, `${onIt} of ${wild}: ${kindsWild}`);
  check('and no monster', monsters === '0', monsters);
} finally {
  sql(`delete from world where id = '${world}';`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`${ok.length} ok, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
