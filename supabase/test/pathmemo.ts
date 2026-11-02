/**
 * The path search asks of each tile whether it is free and what entering it costs once a search (`memoKnown` in
 * src/world/pathfinding.ts), where it used to ask every time it looked at the tile. The same answers, so the same
 * paths: this runs the search as it was before that, kept below, and the search as it is, from the same starts to the
 * same goals, and asks for the same path, tile for tile and storey for storey, and the same partial verdict, every time.
 *
 * Over three islands of 256, 512 and 1024 tiles, each made rougher with trees, rock, bush, marsh, water and stepping
 * stones scattered over it: goals within a click (60 tiles), and further ones that take the search out past the square
 * it remembers (`MEMO_REACH`); starts by the edge of the island; to a tile and to beside it (`near`); walked as far as
 * it gets (`partial`); and searches cut short (`maxNodes`). On foot, with the game's own rule for a step and a storey.
 */
import { Game } from '../../src/game/game';
import { pathOptions } from '../../src/game/player';
import { findPath, GREED, GREEDY_FROM, LIFT_COST, PARTIAL_GAIN, type PathOptions, type PathPoint } from '../../src/world/pathfinding';
import { TileType } from '../../src/world/tiles';
import type { World } from '../../src/world/world';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the search before the memo, as it was ---------------------------------------------------------------------- */

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

interface Buffers {
  cap: number;
  node: Int32Array;
  g: Float64Array;
  parent: Int32Array;
  state: Uint8Array;
  heapIdx: Int32Array;
  heapF: Float64Array;
}
let buffers: Buffers | null = null;
const slots = new Map<number, number>();
function getBuffers(cap: number): Buffers {
  if (!buffers || buffers.cap < cap) {
    buffers = { cap, node: new Int32Array(cap), g: new Float64Array(cap), parent: new Int32Array(cap), state: new Uint8Array(cap),
      heapIdx: new Int32Array(cap * 2), heapF: new Float64Array(cap * 2) };
  }
  return buffers;
}

function findPathBefore(world: World, sx: number, sy: number, sl: number, tx: number, ty: number, opts: PathOptions): PathPoint[] | null {
  if (!world.inBounds(sx, sy) || !world.inBounds(tx, ty)) return null;
  if (!opts.near && !opts.passable(tx, ty)) return null;
  if (sx === tx && sy === ty && (opts.goalLevel === undefined || opts.goalLevel === sl)) return [];
  if (opts.partial) opts.partial.reached = true;
  const w = world.w;
  const layer = w * world.h;
  const levels = Math.max(1, opts.levels ?? 1);
  const below = Math.max(0, opts.below ?? 0);
  const goalAt = opts.goalLevel;
  const maxNodes = opts.maxNodes ?? 30000;
  const b = getBuffers(maxNodes * 10 + 2);
  const OPEN = 1;
  const CLOSED = 2;
  slots.clear();
  let used = 0;
  const slotOf = (idx: number): number => {
    const had = slots.get(idx);
    if (had !== undefined) return had;
    if (used >= b.cap) return -1;
    const slot = used++;
    slots.set(idx, slot);
    b.node[slot] = idx;
    b.state[slot] = 0;
    return slot;
  };
  let heapSize = 0;
  const push = (idx: number, f: number): void => {
    let i = heapSize++;
    if (i >= b.heapIdx.length) return;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (b.heapF[p] <= f) break;
      b.heapF[i] = b.heapF[p];
      b.heapIdx[i] = b.heapIdx[p];
      i = p;
    }
    b.heapF[i] = f;
    b.heapIdx[i] = idx;
  };
  const pop = (): number => {
    const top = b.heapIdx[0];
    heapSize--;
    if (heapSize > 0) {
      const f = b.heapF[heapSize];
      const idx = b.heapIdx[heapSize];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heapSize) break;
        if (c + 1 < heapSize && b.heapF[c + 1] < b.heapF[c]) c++;
        if (b.heapF[c] >= f) break;
        b.heapF[i] = b.heapF[c];
        b.heapIdx[i] = b.heapIdx[c];
        i = c;
      }
      b.heapF[i] = f;
      b.heapIdx[i] = idx;
    }
    return top;
  };
  const distance = (x: number, y: number): number => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const greed = distance(sx, sy) > GREEDY_FROM ? GREED : 1;
  const heuristic = (x: number, y: number): number => greed * distance(x, y);
  const atGoal = (tile: number): boolean => {
    if (tile === goalTile) return true;
    if (!opts.near) return false;
    const x = tile % w, y = (tile - x) / w;
    return Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1;
  };
  const start = slotOf((Math.max(-below, Math.min(levels - 1, sl)) + below) * layer + sy * w + sx);
  const goalTile = ty * w + tx;
  let goal = -1;
  let best = start;
  let bestD = distance(sx, sy);
  b.g[start] = 0;
  b.parent[start] = -1;
  b.state[start] = OPEN;
  push(start, heuristic(sx, sy));
  let expanded = 0;
  while (heapSize > 0) {
    const cur = pop();
    if (b.state[cur] === CLOSED) continue;
    const curIdx = b.node[cur];
    if (atGoal(curIdx % layer) && (goalAt === undefined || Math.floor(curIdx / layer) - below === goalAt)) {
      goal = cur;
      break;
    }
    b.state[cur] = CLOSED;
    if (++expanded > maxNodes) break;
    const filed = Math.floor(curIdx / layer);
    const cl = filed - below;
    const tileIdx = curIdx - filed * layer;
    const cx = tileIdx % w;
    const cy = (tileIdx - cx) / w;
    const d = distance(cx, cy);
    if (d < bestD) {
      best = cur;
      bestD = d;
    }
    for (let k = 0; k < 8; k++) {
      const nx = cx + DIRS[k][0];
      const ny = cy + DIRS[k][1];
      if (!world.inBounds(nx, ny) || !opts.passable(nx, ny)) continue;
      if (k >= 4) {
        if (!opts.passable(cx + DIRS[k][0], cy) || !opts.passable(cx, cy + DIRS[k][1])) continue;
      }
      const nl = opts.step(cx, cy, cl, nx, ny);
      if (nl === null || nl < -below || nl >= levels) continue;
      const n = slotOf((nl + below) * layer + ny * w + nx);
      if (n < 0 || b.state[n] === CLOSED) continue;
      const stepCost = (k >= 4 ? Math.SQRT2 : 1) * opts.cost(nx, ny);
      const ng = b.g[cur] + stepCost;
      if (b.state[n] === OPEN && ng >= b.g[n]) continue;
      b.g[n] = ng;
      b.parent[n] = cur;
      b.state[n] = OPEN;
      push(n, ng + heuristic(nx, ny));
    }
    if (opts.lift) {
      for (const nl of opts.lift(cx, cy, cl)) {
        if (nl === cl || nl < -below || nl >= levels) continue;
        const n = slotOf((nl + below) * layer + tileIdx);
        if (n < 0 || b.state[n] === CLOSED) continue;
        const ng = b.g[cur] + LIFT_COST;
        if (b.state[n] === OPEN && ng >= b.g[n]) continue;
        b.g[n] = ng;
        b.parent[n] = cur;
        b.state[n] = OPEN;
        push(n, ng + heuristic(cx, cy));
      }
    }
  }
  if (goal < 0) {
    if (!opts.partial || bestD > distance(sx, sy) - PARTIAL_GAIN) return null;
    opts.partial.reached = false;
    goal = best;
  }
  const path: PathPoint[] = [];
  let slot = goal;
  while (slot !== -1 && slot !== start) {
    const idx = b.node[slot];
    const filed = Math.floor(idx / layer);
    const t = idx - filed * layer;
    const x = t % w;
    path.push({ x, y: (t - x) / w, level: filed - below });
    slot = b.parent[slot];
  }
  path.reverse();
  return path;
}

/* ---- the same starts and goals, both ways -------------------------------------------------------------------------- */

let seed = 20261102;
const rnd = (): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const ROUGH = [TileType.Tree, TileType.Tree, TileType.Rock, TileType.Bush, TileType.Marsh, TileType.SteppingStones, TileType.Reed];

for (const size of [256, 512, 1024]) {
  const game = Game.create(4242 + size, size);
  const world = game.world;
  world.ensureBox(0, 0, world.w, world.h);
  // Rougher: blots of rough ground, and a few ponds dug below the water.
  for (let i = 0; i < size * size / 120; i++) {
    const x = Math.floor(rnd() * size), y = Math.floor(rnd() * size), t = pick(ROUGH);
    const r = Math.floor(rnd() * 3);
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (world.inBounds(xx, yy) && rnd() < 0.7) world.setTile(xx, yy, t, 0);
  }
  for (let i = 0; i < size / 16; i++) {
    const x = 2 + Math.floor(rnd() * (size - 6)), y = 2 + Math.floor(rnd() * (size - 6));
    for (let yy = y; yy <= y + 3; yy++) for (let xx = x; xx <= x + 3; xx++) world.setHeight(xx, yy, -30);
  }
  const { rule, levels, below, lift } = game.movement();
  let same = 0, partials = 0, found = 0, none = 0, far = 0, edge = 0;
  const differ: string[] = [];
  const runs = size === 1024 ? 160 : 120;
  for (let i = 0; i < runs; i++) {
    const kind = i % 8;
    // By the edge of the island one time in eight, so the square remembered hangs off it.
    let sx: number, sy: number, tries = 0;
    do {
      sx = kind === 0 ? Math.floor(rnd() * 6) : Math.floor(rnd() * size);
      sy = kind === 0 ? Math.floor(rnd() * size) : Math.floor(rnd() * size);
    } while (!world.isPassable(sx, sy) && ++tries < 200);
    if (kind === 0) edge++;
    // Within a click, or one time in eight a long way off, out past `MEMO_REACH`.
    const reach = kind === 1 ? 200 + Math.floor(rnd() * 120) : 60;
    if (kind === 1) far++;
    const tx = Math.max(0, Math.min(size - 1, sx + Math.round((rnd() * 2 - 1) * reach)));
    const ty = Math.max(0, Math.min(size - 1, sy + Math.round((rnd() * 2 - 1) * reach)));
    const free = world.isPassable(tx, ty);
    const how = (): Partial<PathOptions> => ({
      near: kind === 2 ? true : !free,
      partial: kind === 3 ? undefined : { reached: true },
      maxNodes: kind === 4 ? 400 + Math.floor((i * 37) % 2000) : kind === 1 ? 60000 : undefined,
    });
    const a = { ...pathOptions(world, rule, levels, i % 5 === 0 ? 0.6 : 0, i % 7 === 0 ? { [TileType.Bush]: 2 } : undefined), lift, below, ...how() };
    const b = { ...pathOptions(world, rule, levels, i % 5 === 0 ? 0.6 : 0, i % 7 === 0 ? { [TileType.Bush]: 2 } : undefined), lift, below, ...how() };
    const before = findPathBefore(world, sx, sy, 0, tx, ty, a);
    const now = findPath(world, sx, sy, 0, tx, ty, b);
    const was = JSON.stringify([before, a.partial?.reached ?? null]);
    const is = JSON.stringify([now, b.partial?.reached ?? null]);
    if (was === is) same++;
    else if (differ.length < 3) differ.push(`(${sx}, ${sy}) to (${tx}, ${ty}): ${before?.length ?? 'none'} before, ${now?.length ?? 'none'} now`);
    if (before) found++;
    else none++;
    if (a.partial && !a.partial.reached) partials++;
  }
  check(`${size} tiles: ${runs} searches, the same path and the same verdict as before`, same === runs, differ.join('; ') || `${same} of ${runs}`);
  check(`${size} tiles: found and not found, partial, far and by the edge all asked`, found > 0 && none + partials > 0 && far > 0 && edge > 0,
    `${found} found, ${none} none, ${partials} partial, ${far} far, ${edge} by the edge`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the path search remembers what it asked of a tile — ${ok.length} of ${ok.length}`);
