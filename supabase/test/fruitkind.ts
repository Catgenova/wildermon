/**
 * The fruit trees held to their islands, by kind: on an island whose woods have turned over since it was founded.
 *
 * `fruitHome` looked for founding day's apples and olives where the generator now grows an island's own fruit, and
 * on the live island found 28 for some six thousand founding day had there. A tree lives six days
 * (`TREE_AGES`) and a dead one seeds its own kind round it, so after fifty days nothing stands where the generator
 * put it. `fruitByKind` takes the apples and olives as they stand. Asked of it, against the database the suite leaves
 * behind, on an island laid as founding day's generator laid it and then moved along by three tiles a line:
 *
 *   * `fruitHome` finds next to nothing there, which is the live island's 28;
 *   * `fruitByKind` turns `OWN_FRUIT_SHARE` of the wild apples and olives of each island with fruit of its own into
 *     that fruit, at their own age, lemons on Volcano Isle and nowhere else, and changes nothing else;
 *   * a tree on a settlement's square is left as it is;
 *   * the move is written down in `land_move`, and a second run changes nothing.
 *
 * The island is made for the test and deleted after it.
 */
import { ok, bad, check } from './harness';
process.env.MOVE_GROUND_TEST = '1';
process.env.PGHOST ??= '/var/run/postgresql';
process.env.PGPORT ??= '5433';
process.env.PGUSER ??= 'wildermon';

import { generateAtlasWindow, regionAt } from '../../src/world/atlas-world';
import { OWN_FRUIT_SHARE, REGIONS } from '../../src/world/regions';
import { packTreeData, TileType, TREE_DEFS, treeSpecies, treeVariant } from '../../src/world/tiles';
import { readAtlas } from '../../tools/atlas-node';

const { FRUIT_KIND_MOVE, FOUNDING_FRUIT, OWN_FRUIT, fruitByKind, fruitHome, ownFruitFor, psql } = await import('../../tools/move-ground');

const sql = psql([process.env.PGDATABASE ?? 'postgres']);
const one = (text: string): string => sql(text)[0]?.[0] ?? '';

const SIZE = 1024;
const SEED = 4242;
const SHIFT = 3;
const atlas = readAtlas();
const gen = generateAtlasWindow(SEED, atlas, 0, 0, SIZE, SIZE, SIZE);
const species = (n: string): number => TREE_DEFS.findIndex((t) => t.name === n);
const APPLE = species('Apple');
const OLIVE = species('Olive');
const LEMON = species('Lemon');
const VOLCANO = REGIONS.findIndex((R) => R.key === 'Volcano');
const region = new Uint8Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) region[y * SIZE + x] = regionAt(atlas, x, y, SIZE);

/* ---- founding day's island, and its woods turned over ----------------------- */

const tiles = new Uint8Array(SIZE * SIZE);
const data = new Uint8Array(SIZE * SIZE);
let n = 0;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const from = y * SIZE + x;
    const to = y * SIZE + ((x + SHIFT) % SIZE);
    tiles[to] = gen.tiles[from];
    data[to] = gen.data[from];
    if (gen.tiles[from] === TileType.Tree && OWN_FRUIT[region[from]]?.includes(treeSpecies(gen.data[from]))) {
      data[to] = packTreeData(n++ % 3 ? APPLE : OLIVE, treeVariant(gen.data[from]));
    }
  }
}

// A settlement on Volcano Isle over an apple the move would otherwise take.
let deedAt = -1;
for (let i = 0; i < SIZE * SIZE && deedAt < 0; i++) {
  if (region[i] === VOLCANO && tiles[i] === TileType.Tree && FOUNDING_FRUIT.has(treeSpecies(data[i]))
      && ownFruitFor(SEED, VOLCANO, i % SIZE, Math.floor(i / SIZE)) >= 0) deedAt = i;
}
const DX = deedAt % SIZE, DY = Math.floor(deedAt / SIZE), DR = 6;
const deeded = (i: number): boolean => Math.abs((i % SIZE) - DX) <= DR && Math.abs(Math.floor(i / SIZE) - DY) <= DR;

const hex = (b: Uint8Array, y: number): string => Buffer.from(b.subarray(y * SIZE, (y + 1) * SIZE)).toString('hex');
const world = one(`insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fruit by kind', ${SEED}, ${SIZE}, 10, 10, false)
  returning id;`);
const read = (): { tiles: Uint8Array; data: Uint8Array } => {
  const got = { tiles: new Uint8Array(SIZE * SIZE), data: new Uint8Array(SIZE * SIZE) };
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
    rows.push(`update land_tile set tiles = decode('${hex(tiles, y)}', 'hex'), data = decode('${hex(data, y)}', 'hex')
      where world_id = '${world}' and y = ${y};`);
  }
  sql(rows.join('\n'));
  sql(`insert into deed (world_id, name, x, y, radius, founded_by) values ('${world}', 'Orchard', ${DX}, ${DY}, ${DR}, gen_random_uuid());`);
  check('a settlement stands over an apple on Volcano Isle', deedAt >= 0, `${DX},${DY}`);

  /* ---- by tile: next to nothing ---------------------------------------------- */

  const w = { id: world, name: 'Fruit by kind', seed: SEED, size: SIZE };
  const home = fruitHome(sql, w);
  const byTile = Number(/: (\d+) /.exec(home)?.[1] ?? -1);
  check(`by tile, on woods three tiles along from where they were laid, next to nothing is found (of ${n})`, byTile >= 0 && byTile < n / 10, home);
  const before = read();

  /* ---- by kind ---------------------------------------------------------------- */

  const said = fruitByKind(sql, w);
  const after = read();
  let wild = 0, grown = 0, wrong = 0, others = 0, deedKept = 0, deedTrees = 0, lemonsOn = 0, lemonsOff = 0;
  const kinds = new Set<string>();
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    const isFruit = before.tiles[i] === TileType.Tree && FOUNDING_FRUIT.has(treeSpecies(before.data[i]));
    if (after.tiles[i] === TileType.Tree && treeSpecies(after.data[i]) === LEMON) {
      if (region[i] === VOLCANO) lemonsOn++;
      else lemonsOff++;
    }
    if (isFruit && OWN_FRUIT[region[i]]?.length) {
      if (deeded(i)) {
        deedTrees++;
        if (after.data[i] === before.data[i]) deedKept++;
        continue;
      }
      wild++;
      const now = ownFruitFor(SEED, region[i], x, y);
      if (now < 0) {
        if (after.data[i] !== before.data[i]) wrong++;
        continue;
      }
      if (after.tiles[i] === TileType.Tree && after.data[i] === packTreeData(now, treeVariant(before.data[i]))) {
        grown++;
        kinds.add(TREE_DEFS[now].name);
      } else wrong++;
      continue;
    }
    if (after.tiles[i] !== before.tiles[i] || after.data[i] !== before.data[i]) others++;
  }
  const share = grown / Math.max(1, wild);
  check(`about ${Math.round(OWN_FRUIT_SHARE * 100)}% of the wild apples and olives of each island with fruit of its own become it, at their own age`,
    wrong === 0 && Math.abs(share - OWN_FRUIT_SHARE) < 0.06, `${grown} of ${wild} (${(share * 100).toFixed(1)}%), ${wrong} wrong`);
  check('the move counts what it changed', said.includes(`: ${grown} `), said);
  check('every island\'s own fruit comes up', kinds.size === new Set(OWN_FRUIT.flat()).size, [...kinds].join(', '));
  check('lemons on Volcano Isle, and on no other island', lemonsOn > 0 && lemonsOff === 0, `${lemonsOn} on, ${lemonsOff} off`);
  check('nothing else on the island changes', others === 0, `${others} tiles`);
  check('a tree on a settlement\'s square is left as it is', deedTrees > 0 && deedKept === deedTrees, `${deedKept} of ${deedTrees}`);
  check('the move is written down, with what it changed',
    one(`select trees from land_move where world_id = '${world}' and move = '${FRUIT_KIND_MOVE}';`) === String(grown));
  const again = fruitByKind(sql, w);
  check('a second run changes nothing', again.includes(': 0 '), again);
} finally {
  sql(`delete from world where id = '${world}';`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`${ok.length} ok, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
