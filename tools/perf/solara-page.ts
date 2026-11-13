/**
 * A large, busy settlement for measuring the renderer: the real Game and Renderer, the island's seams set as
 * `play.ts` sets them, every axis of the settlement a knob (`window.solaraScene`). Bundled by `tools/perf/solara.ts`.
 *
 * Axes: houses (and storeys each), pieces of furniture (some of them lit), crates, things lying on the ground,
 * wildermon at work (walking legs, told again every second as `rpc_near` does), wildermon following, wildermon
 * shut in crates, other people (sculpted bodies, mixed looks and gear, walking, working or standing, told twice a
 * second as Broadcast does), lit lamp posts.
 *
 * And for comparing pictures: `extras` (pitched, gabled and glass roofs, flights, a single flight, a spiral, ladders,
 * a cellar under house 4 with a flight and a ladder down, every other kind of wall on houses 5 and 6, a glass wall,
 * the sea south-east of the totem), `down` (the body in that cellar), `inside` (the body in house n), `at` (the body
 * at [dx, dy] from the totem) and `turn` (the camera turned that many eighths).
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import type { PeerState } from '../../src/net/protocol';
import { Renderer } from '../../src/render/renderer';
import { loadAllWildermon } from '../../src/render/wildermon';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { HAIRSTYLES } from '../../src/game/look';
import { CELLAR_DEPTH } from '../../src/game/building';

interface Driven { tick: (ms: number) => void; realNow: () => number; canvases: () => number }
const driven = (window as unknown as { driven: Driven }).driven;

export interface Scene {
  houses?: number; storeys?: number; pieces?: number; lit?: number; crates?: number; lying?: number; lyingTiles?: number;
  workers?: number; following?: number; stored?: number; peers?: number; lamps?: number; sculpt?: boolean; extras?: boolean; down?: boolean; turn?: number; inside?: number; at?: number[];
}
const S: Required<Scene> = {
  houses: 6, storeys: 2, pieces: 80, lit: 4, crates: 20, lying: 650, lyingTiles: 7, workers: 5, following: 12, stored: 32, peers: 0, lamps: 2, sculpt: true, extras: false, down: false, turn: 0, inside: 0, at: [],
  ...((window as unknown as { solaraScene?: Scene }).solaraScene ?? {}),
};

// No sculpted bodies (the flat figure, as with no WebGL2): WebGL2 refused before anything asks for it.
if (!S.sculpt) {
  const was = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, o?: unknown) {
    return type === 'webgl2' ? null : was.call(this, type as '2d', o as CanvasRenderingContext2DSettings);
  } as typeof was;
}

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 30;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);

let hour = 13;
const day0 = 1000 * DAY_SECONDS;
const opened = performance.now();
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);

// A seeded random, so every run of a scene is the same scene.
let seed = 12345;
const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

let id = 1000;
const placed: IslandPlaced[] = [];
const put = (kind: string, sub: string | null, x: number, y: number, more: Partial<IslandPlaced> = {}): void => {
  placed.push({
    id: id++, kind, sub, x, y, sx: 0, sy: 0, ql: 40, fuel: null, ash: null, lit: null, dmg: null, name: null, material: 'oak',
    litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's', ...more,
  } as IslandPlaced);
};
const taken = new Set<string>();
const free = (x: number, y: number): boolean => !taken.has(`${x},${y}`);
const take = (x: number, y: number): void => { taken.add(`${x},${y}`); };

// Houses on a grid of 8-tile cells north of the totem, each 6 by 5, `storeys` high, walls and a floor on every storey.
const walls: unknown[] = [];
const floors: unknown[] = [];
const list: unknown[] = [];
const insides: Array<[number, number, number]> = [];
const MATS = ['stone_brick', 'plank', 'cobblestone', 'marble', 'clay_bricks'];
// Cells of 9 by 8 tiles over 45 by 40 round the totem, nearest first, the totem's own left as a square.
const cells: Array<[number, number]> = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!(r === 2 && c === 2)) cells.push([cx - 22 + c * 9, cy - 20 + r * 8]);
cells.sort((a, b) => Math.hypot(a[0] + 3 - cx, a[1] + 2 - cy) - Math.hypot(b[0] + 3 - cx, b[1] + 2 - cy));
for (let b = 0; b < S.houses; b++) {
  const bid = b + 1;
  const [x0, y0] = cells[b % cells.length], w = 6, h = 5, mat = MATS[b % MATS.length];
  const tiles: string[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { tiles.push(`${x},${y}`); take(x, y); }
  for (let lv = 0; lv < S.storeys; lv++) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      floors.push({ building: bid, level: lv, x, y, material: mat, needed: {}, total: {} });
      if (lv < S.storeys) insides.push([x, y, lv]);
    }
    for (let x = x0; x < x0 + w; x++) {
      walls.push({ building: bid, level: lv, x, y: y0, dir: 'h', type: x === x0 + 1 ? 'window' : 'solid', material: mat, needed: {}, total: {} });
      walls.push({ building: bid, level: lv, x, y: y0 + h, dir: 'h', type: lv === 0 && x === x0 + 3 ? 'door' : x === x0 + 1 ? 'window' : 'solid', material: mat, needed: {}, total: {} });
    }
    for (let y = y0; y < y0 + h; y++) {
      walls.push({ building: bid, level: lv, x: x0, y, dir: 'v', type: y === y0 + 1 ? 'window' : 'solid', material: mat, needed: {}, total: {} });
      walls.push({ building: bid, level: lv, x: x0 + w, y, dir: 'v', type: 'solid', material: mat, needed: {}, total: {} });
    }
  }
  list.push({ id: bid, name: `House ${bid}`, tiles, levels: S.storeys });
}

const cellars: unknown[] = [];
if (S.extras) {
  const fl = floors as Array<Record<string, unknown>>;
  const wl = walls as Array<Record<string, unknown>>;
  for (const bl of list as Array<{ id: number; tiles: string[]; levels: number; roof?: string }>) {
    const mat = bl.id === 3 ? 'stained_glass' : MATS[(bl.id - 1) % MATS.length];
    if (bl.id % 2 === 0) bl.roof = 'gable';
    for (const t of bl.tiles) { const [x, y] = t.split(',').map(Number); fl.push({ building: bl.id, level: S.storeys, x, y, material: mat, kind: 'roof', needed: {}, total: {} }); }
  }
  const set = (b: number, lv: number, dx: number, dy: number, more: Record<string, unknown>): void => {
    const [x0, y0] = cells[b - 1];
    const t = fl.find((q) => q.building === b && q.level === lv && q.x === x0 + dx && q.y === y0 + dy);
    if (t) Object.assign(t, more);
  };
  set(1, 0, 1, 3, { kind: 'stairs', facing: 's' });
  set(1, 0, 4, 3, { kind: 'stairs', facing: 'e', hand: 'l' });
  set(2, 0, 2, 2, { kind: 'stairs', hand: 's' });
  set(3, 0, 4, 1, { kind: 'ladder', facing: 'w' });
  // A cellar under house 4, and a flight and a ladder down into it.
  {
    const [x0, y0] = cells[3];
    for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 6; x++) cellars.push({ building: 4, x, y, dug: CELLAR_DEPTH });
    set(4, 0, 2, 2, { kind: 'stairs', facing: 'n' });
    set(4, 0, 4, 3, { kind: 'ladder', facing: 'e' });
  }
  // Every other kind of wall on houses 5 and 6, and a glass wall.
  const KIND = ['bay', 'double_door', 'arch', 'half_wall', 'railing', 'counter', 'hidden_door', 'portcullis', 'iron_gate', 'fence', 'fence_gate', 'rune_gate'];
  let k = 0;
  for (const w of wl) if ((w.building === 5 || w.building === 6) && w.type === 'solid') w.type = KIND[k++ % KIND.length];
  for (const w of wl) if (w.building === 3 && w.level === 1 && w.dir === 'v') w.material = 'stained_glass';
  // The sea, south-east of the totem.
  for (let y = cy + 3; y <= cy + 16; y++) for (let x = cx + 2; x <= cx + 18; x++) {
    const d = Math.min(y - cy - 3, x - cx - 2, cx + 18 - x, cy + 16 - y);
    if (d > 0 && free(x, y) && free(x - 1, y) && free(x, y - 1) && free(x - 1, y - 1)) world.setHeight(x, y, -2 - d * 2);
  }
  for (let y = cy + 3; y <= cy + 16; y++) for (let x = cx + 2; x <= cx + 18; x++) take(x, y);
}

// Pieces: inside the houses first (on every storey), then out in the open south of the totem; `lit` of them lamps and braziers alight.
const KINDS = ['chest', 'barrel', 'shelves', 'larder', 'table', 'bed', 'bench', 'wardrobe', 'coffer', 'bookshelf', 'desk', 'cupboard', 'bulk_bin',
  'craft_bin', 'seed_bin', 'firewood_rack', 'stall', 'lectern', 'loom', 'oven', 'statue', 'well', 'hive', 'planter', 'sign', 'crate_shelf', 'banner', 'altar'];
const outdoor = (): [number, number] => {
  for (let i = 0; i < 400; i++) {
    const x = cx - 22 + Math.floor(rnd() * 45), y = cy - 20 + Math.floor(rnd() * 40);
    if (free(x, y) && !(Math.abs(x - cx) < 2 && Math.abs(y - cy) < 2)) { take(x, y); return [x, y]; }
  }
  return [cx, cy + 3];
};
let inside = 0;
for (let i = 0; i < S.pieces; i++) {
  const lit = i < S.lit;
  const sub = lit ? (i % 2 ? 'brazier' : 'lamp_post') : KINDS[i % KINDS.length];
  let x: number, y: number, level = 0;
  if (!lit && inside < insides.length && i % 3 !== 2) [x, y, level] = insides[(inside++ * 7) % insides.length];
  else [x, y] = outdoor();
  put('furniture', sub, x, y, { lit: lit ? true : null, fuel: 9999, level, state: null });
}
for (let i = 0; i < S.lamps; i++) { const [x, y] = outdoor(); put('furniture', 'lamp_post', x, y, { lit: true, fuel: 9999 }); }
// The smiths' row: smelters, anvils, kilns and fires, a share of them lit.
for (const [k, lit] of [['smelter', true], ['smelter', true], ['smelter', true], ['smelter', false], ['anvil', false], ['anvil', false], ['kiln', true], ['kiln', true],
  ['campfire', true], ['campfire', true]] as const) {
  const [x, y] = outdoor();
  put(k, k === 'anvil' ? 'iron' : null, x, y, { lit, fuel: lit ? 9999 : 0 });
}

const mobs: IslandCreature[] = [];
const beast = (species: string, mode: string, x: number, y: number, skill: number, more: Partial<IslandCreature> = {}): number => {
  const cid = id++;
  mobs.push({ id: cid, species, name: `${species} ${cid}`, variant: cid % 3, mode, stance: 'passive', x, y, health: 1, max: 1, mine: true,
    sex: cid % 2 ? 'male' : 'female', traits: [], skills: { haul: skill }, ...more } as IslandCreature);
  return cid;
};
const SPECIES = ['quarra', 'orse', 'seavic', 'mola', 'rabba', 'tinka', 'warda', 'chissa', 'lungra', 'noot', 'leecha', 'woola', 'holla', 'grazza',
  'dowse', 'crawler', 'sheela', 'thumpa', 'ulva', 'simma', 'snedda', 'rippa', 'cobbe', 'roxxen', 'sparra', 'whispet'];
// Crated wildermon on stalls' crates out in the open.
for (let i = 0; i < S.stored; i++) {
  const [x, y] = outdoor();
  put('furniture', 'creature_crate', x, y, { creature: beast(SPECIES[i % SPECIES.length], 'stored', x + 0.5, y + 0.5, 30) });
}
const crates = Array.from({ length: S.crates }, (_, i) => {
  const [x, y] = outdoor();
  return { id: id++, kind: i % 3 ? 'plank' : 'log', x, y, sx: 0, sy: 0, material: 'oak', ql: 30, name: null, deed: true, mine: true, units: (i * 7) % 40 };
});
const lyingAt = Array.from({ length: S.lyingTiles }, () => outdoor());
const DEFS = ['log', 'plank', 'rock_shards', 'iron_lump', 'clay', 'shaft', 'nail', 'brick', 'mortar', 'sand'];
const lying = Array.from({ length: S.lying }, (_, i) => ({
  id: id++, def: DEFS[i % DEFS.length], ql: 30, dmg: 0, count: 1 + (i % 6), extra: null, holder: 'ground', charges: null, locked: false, issued: false,
  rare: null, dye: null, bless: null, maker: null, piece: null, gx: lyingAt[i % lyingAt.length][0], gy: lyingAt[i % lyingAt.length][1],
}));

// Followers round the body; workers walking legs between spots of the settlement, a leg two to five seconds long.
for (let i = 0; i < S.following; i++) beast(SPECIES[(i * 5) % SPECIES.length], 'active', cx + 0.5 + Math.cos(i * 0.7) * 2, cy + 0.5 + Math.sin(i * 0.7) * 2, 30);
interface Walker { cid: number; fx: number; fy: number; tx: number; ty: number; at: number; span: number }
const walkers: Walker[] = [];
const spot = (): [number, number] => [cx - 16 + rnd() * 32, cy - 14 + rnd() * 28];
for (let i = 0; i < S.workers; i++) {
  const [fx, fy] = spot(), [tx, ty] = spot();
  const cid = beast(SPECIES[(i * 3) % SPECIES.length], 'deed', fx, fy, 30);
  walkers.push({ cid, fx, fy, tx, ty, at: 0, span: 2 + rnd() * 3 });
}
const workerRow = (w: Walker, t: number): Partial<IslandCreature> => {
  const left = Math.max(0, w.at + w.span - t), k = 1 - left / w.span;
  return { x: w.fx + (w.tx - w.fx) * k, y: w.fy + (w.ty - w.fy) * k, fromX: w.fx, fromY: w.fy, toX: w.tx, toY: w.ty, legFor: w.span, legLeft: left };
};

// Other people: a man or a woman, a hairstyle, skin and hair of their own, a weapon or none, and walking, working or standing.
const WEAPONS = [undefined, 'long_sword', 'maul', 'pickaxe', 'hatchet', 'spear', undefined];
const DOING = ['walk', 'walk', 'work', 'idle', 'work', 'walk'];
const JOBS = ['mine', 'dig', 'chop', 'smith', 'flatten', 'plant'];
interface Person { st: PeerState; fx: number; fy: number; tx: number; ty: number; at: number; span: number; doing: string }
const people: Person[] = [];
for (let i = 0; i < S.peers; i++) {
  const [fx, fy] = spot(), [tx, ty] = spot();
  const weapon = WEAPONS[i % WEAPONS.length];
  const doing = DOING[i % DOING.length];
  const st: PeerState = {
    id: 5000 + i, uid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Person ${i}`, x: fx, y: fy, dirX: 0, dirY: 1, level: 0,
    moving: doing === 'walk', swimming: false, working: doing === 'work', act: doing === 'work' ? JOBS[i % JOBS.length] : undefined,
    look: { gender: i % 2 ? 'woman' : 'man', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.2 + (i % 5) * 0.15, skin: (i * 0.29) % 1 },
    gear: weapon ? { weapon: { id: weapon, material: i % 3 ? 'iron' : 'steel', enchanted: i % 4 === 0 } } : undefined,
  } as PeerState;
  people.push({ st, fx, fy, tx, ty, at: 0, span: 4 + rnd() * 4, doing });
}

const deed = { name: 'Solara', x: cx, y: cy, radius: 22, level: 5, mine: true, role: 'mayor' };
/** The ground as `rpc_near` hands it over, built once: what `beat` lays again. */
const ground = {
  placed, crates, lying, crops: [], now: Date.now() / 1000,
  buildings: { nextId: S.houses + 1, list, walls, floors, cellars },
  deed, deeds: [{ ...deed, holder: 'me' }],
} as unknown as IslandGround;
game.sawGround(ground, undefined, 'me');
if (S.at.length) game.putBody(cx + S.at[0], cy + S.at[1], 0);
if (S.extras && S.inside) { const [x0, y0] = cells[S.inside - 1]; game.putBody(x0 + 2.5, y0 + 1.5, 0); }
if (S.extras && S.down) { const [x0, y0] = cells[3]; game.putBody(x0 + 1.5, y0 + 1.5, -1); }
const tNow = (): number => performance.now() / 1000;
const creatureRows = (): IslandCreature[] => {
  const t = tNow();
  for (const w of walkers) if (t >= w.at + w.span) { w.fx = w.tx; w.fy = w.ty; [w.tx, w.ty] = spot(); w.at = t; w.span = 2 + rnd() * 3; }
  const byId = new Map(walkers.map((w) => [w.cid, w]));
  return mobs.map((m) => { const w = byId.get(m.id); return w ? { ...m, ...workerRow(w, t) } : m; });
};
const peerRows = (): PeerState[] => {
  const t = tNow();
  return people.map((p) => {
    if (p.doing !== 'walk') return p.st;
    if (t >= p.at + p.span) { p.fx = p.tx; p.fy = p.ty; [p.tx, p.ty] = spot(); p.at = t; p.span = 4 + rnd() * 4; }
    const k = Math.min(1, (t - p.at) / p.span), dx = p.tx - p.fx, dy = p.ty - p.fy, l = Math.hypot(dx, dy) || 1;
    return { ...p.st, x: p.fx + dx * k, y: p.fy + dy * k, dirX: dx / l, dirY: dy / l, moving: k < 1 };
  });
};
game.creatures.sawAll(creatureRows(), game.time);
game.teamsFromCreatures();
game.roster.sawAll(peerRows());

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
if (S.turn) renderer.camera.rotation = S.turn;

/* ---- what is counted ------------------------------------------------------------------------------------------ */

/** Exclusive milliseconds spent in each wrapped renderer method this frame, as `timings.ts` counts its layers. */
const own = new Map<string, number>();
const stack: number[] = [];
const inner: number[] = [];
const names: string[] = [];
/** drawImage calls, their time and the destination pixels they cover, by the wrapped method they were made in. */
const imgs = new Map<string, { n: number; ms: number; px: number; off: number }>();
/** Kept pictures put down, by what they are of (the key's first word) and storey: how many a frame and their pixels. */
const bakedBy = new Map<string, { n: number; px: number }>();
const wrapAs = (target: Record<string, unknown>, name: string, bucket: string): void => {
  const fn = target[name] as ((...a: unknown[]) => unknown) | undefined;
  if (typeof fn !== 'function') return;
  target[name] = function (this: unknown, ...a: unknown[]): unknown {
    const t0 = driven.realNow();
    stack.push(t0); inner.push(0); names.push(bucket);
    try { return fn.apply(this, a); } finally {
      names.pop();
      const took = driven.realNow() - (stack.pop() as number), mine = took - (inner.pop() as number);
      own.set(bucket, (own.get(bucket) ?? 0) + mine);
      if (inner.length) inner[inner.length - 1] += took;
    }
  };
};
const R_ = renderer as unknown as Record<string, unknown>;
for (const [name, bucket] of [
  ['drawEntities', 'entities (sort, pieces, beasts)'], ['paint', 'figures (paint)'], ['drawStructures', 'buildings'], ['drawWallNow', 'walls afresh'],
  ['drawFloorNow', 'floors afresh'], ['groundShadeNow', 'shade afresh'], ['drawPitchedRoof', 'buildings'], ['drawFoundation', 'buildings'],
  ['drawOverlays', 'light/night'], ['drawTree', 'trees'], ['drawHaze', 'haze'], ['drawAir', 'haze'], ['drawFloaters', 'haze'],
  ['drawWater', 'water'], ['drawPonds', 'water'], ['drawSea', 'water'], ['groundFrame', 'ground'], ['drawStationRings', 'rings/labels'],
  ['drawThreats', 'rings/labels'], ['drawDeedBorder', 'deed'], ['drawFight', 'fight'],
] as const) {
  // On the renderer, or on whichever of its painters draws it now (`waterdraw.ts`, `roofdraw.ts`, `walldraw.ts`).
  for (const target of [R_, R_.waters, R_.roofs, R_.walls]) if (target) wrapAs(target as Record<string, unknown>, name, bucket);
}

/** Calls and time on the 2D and GL APIs that matter here: a WebGL canvas put down on a 2D one is a sync with the GL. */
const api = { drawImageGL: 0, drawImageGLms: 0, drawImage: 0, fillText: 0, glDraws: 0, glms: 0, getImageData: 0, measureText: 0 };
{
  const P = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const di = P.drawImage;
  P.drawImage = function (this: CanvasRenderingContext2D, ...a: unknown[]): unknown {
    const src = a[0] as HTMLCanvasElement;
    if (src instanceof HTMLCanvasElement && (src as unknown as { __gl?: boolean }).__gl) {
      const t0 = driven.realNow();
      try { return di.apply(this, a); } finally { api.drawImageGL++; api.drawImageGLms += driven.realNow() - t0; }
    }
    api.drawImage++;
    const t0 = driven.realNow();
    try { return di.apply(this, a); } finally {
      const b = names.length ? names[names.length - 1] : '(outside)';
      const e = imgs.get(b) ?? { n: 0, ms: 0, px: 0, off: 0 };
      const [dx, dy, dw, dh] = a.length >= 9 ? [a[5], a[6], a[7], a[8]] as number[] : a.length >= 5 ? [a[1], a[2], a[3], a[4]] as number[] : [a[1] as number, a[2] as number, src.width || 0, src.height || 0];
      const T = this.getTransform();
      e.n++; e.ms += driven.realNow() - t0; e.px += Math.abs(dw * dh) * Math.abs(T.a * T.d - T.b * T.c);
      if (this.canvas === canvasEl) {
        const x0 = T.a * dx + T.c * dy + T.e, y0 = T.b * dx + T.d * dy + T.f, x1 = x0 + T.a * dw, y1 = y0 + T.d * dh;
        if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > canvasEl.width || Math.max(y0, y1) < 0 || Math.min(y0, y1) > canvasEl.height) e.off++;
      }
      imgs.set(b, e);
    }
  };
  for (const [n, k] of [['fillText', 'fillText'], ['getImageData', 'getImageData'], ['measureText', 'measureText']] as const) {
    const f = P[n];
    P[n] = function (this: unknown, ...a: unknown[]): unknown { api[k]++; return f.apply(this, a); };
  }
  const gcx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, o?: unknown) {
    if (type === 'webgl2' || type === 'webgl') (this as unknown as { __gl?: boolean }).__gl = true;
    return gcx.call(this, type as '2d', o as CanvasRenderingContext2DSettings);
  } as typeof gcx;
  const G = WebGL2RenderingContext.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const n of ['drawElements', 'drawArrays', 'flush', 'uniform4fv', 'bufferData', 'useProgram', 'clear']) {
    const f = G[n];
    G[n] = function (this: unknown, ...a: unknown[]): unknown {
      const t0 = driven.realNow();
      try { return f.apply(this, a); } finally { if (n === 'drawElements') api.glDraws++; api.glms += driven.realNow() - t0; }
    };
  }
}

export interface Measured {
  frame: number; median: number; p90: number; worst: number; update: number; canvases: number; frames: number;
  own: Record<string, number>; api: typeof api; baked: Record<string, unknown>; imgs: Record<string, { n: number; ms: number; kpx: number; off: number }>; beat: { creatures: number; peers: number; ground: number; n: number };
}

let lastCreatureBeat = -1, lastPeerBeat = -1;
const beatMs = { creatures: 0, peers: 0, ground: 0, n: 0 };

/**
 * `n` frames `step` ms of the page's clock apart at `zoom` and `at` o'clock, as the loop draws them, the island's words
 * laid as they come (creatures every second, people every half), the camera panned `pan` tiles a second when asked.
 */
function frames(n: number, step: number, zoom: number, at: number, move: { pan?: number; groundEvery?: number } = {}): Measured {
  hour = at;
  renderer.camera.zoom = zoom;
  const made = driven.canvases();
  own.clear();
  imgs.clear();
  bakedBy.clear();
  for (const k of Object.keys(api) as Array<keyof typeof api>) api[k] = 0;
  beatMs.creatures = beatMs.peers = beatMs.ground = beatMs.n = 0;
  const each: number[] = [];
  let update = 0, ox = 0;
  for (let i = 0; i < n; i++) {
    driven.tick(step);
    const t = tNow();
    const a = driven.realNow();
    // The island's words, timed apart from the frame: what a beat of `rpc_near` and Broadcast costs the page to lay.
    if (Math.floor(t) !== lastCreatureBeat) {
      lastCreatureBeat = Math.floor(t);
      const b0 = driven.realNow();
      game.creatures.sawAll(creatureRows(), game.time);
      beatMs.creatures += driven.realNow() - b0;
      if (move.groundEvery && lastCreatureBeat % move.groundEvery === 0) {
        const g0 = driven.realNow();
        game.sawGround(JSON.parse(JSON.stringify(ground)) as IslandGround, undefined, 'me');
        beatMs.ground += driven.realNow() - g0;
      }
      beatMs.n++;
    }
    if (Math.floor(t * 2) !== lastPeerBeat) {
      lastPeerBeat = Math.floor(t * 2);
      const b0 = driven.realNow();
      game.roster.sawAll(peerRows());
      beatMs.peers += driven.realNow() - b0;
    }
    const a2 = driven.realNow();
    game.update(step / 1000);
    if (move.pan) ox = (move.pan * (i * step) / 1000) % 40 - 20;
    renderer.camera.focus(game.player.x + ox, game.player.y + ox * 0.3, game.playerHeight(), step / 1000);
    const b = driven.realNow();
    renderer.render(step / 1000);
    canvas.ctx.getImageData(0, 0, 1, 1);
    each.push(driven.realNow() - b);
    update += b - a2;
    void a;
  }
  const sorted = [...each].sort((p, q) => p - q);
  const o: Record<string, number> = {};
  for (const [k, v] of own) o[k] = v / n;
  return {
    frame: each.reduce((s, x) => s + x, 0) / n, median: sorted[n >> 1], p90: sorted[Math.floor(n * 0.9)], worst: sorted[n - 1], update: update / n,
    canvases: driven.canvases() - made, frames: n, own: o, api: { ...api },
    baked: Object.fromEntries([...bakedBy].map(([k, v]) => [k, { n: +(v.n / n).toFixed(1), kpx: Math.round(v.px / n / 1000) }])),
    imgs: Object.fromEntries([...imgs].map(([k, v]) => [k, { n: +(v.n / n).toFixed(1), ms: +(v.ms / n).toFixed(2), kpx: Math.round(v.px / n / 1000), off: +(v.off / n).toFixed(1) }])), beat: { ...beatMs },
  };
}

/** The ground answer as JSON, for its size, and the cost to parse and lay it: `n` times. */
function groundBeat(n: number): { bytes: number; parse: number; lay: number } {
  const text = JSON.stringify(ground);
  let parse = 0, lay = 0;
  for (let i = 0; i < n; i++) {
    const a = driven.realNow();
    const g = JSON.parse(text) as IslandGround;
    const b = driven.realNow();
    game.sawGround(g, undefined, 'me');
    lay += driven.realNow() - b;
    parse += b - a;
  }
  return { bytes: text.length, parse: parse / n, lay: lay / n };
}

/** Any JSON text (a real `rpc_near` answer, from the database) parsed and laid as the page lays it, `n` times. */
function layNear(text: string, n: number): { bytes: number; parse: number; ground: number; creatures: number } {
  let parse = 0, gr = 0, cr = 0;
  for (let i = 0; i < n; i++) {
    const a = driven.realNow();
    const j = JSON.parse(text) as { ground?: IslandGround; creatures?: { rows?: IslandCreature[] } | IslandCreature[] };
    const b = driven.realNow();
    if (j.ground) game.sawGround(j.ground, undefined, 'me');
    const c = driven.realNow();
    const rows = Array.isArray(j.creatures) ? j.creatures : j.creatures?.rows;
    if (rows) game.creatures.sawAll(rows, game.time);
    const d = driven.realNow();
    parse += b - a; gr += c - b; cr += d - c;
  }
  return { bytes: text.length, parse: parse / n, ground: gr / n, creatures: cr / n };
}

{
  const fn = R_.baked as (...a: unknown[]) => unknown;
  R_.baked = function (this: unknown, ...a: unknown[]): unknown {
    const key = String(a[0]), box = a[3] as number[];
    const parts = key.split('|');
    const k = `${parts[0].slice(0, 6)}${parts[0] === 's' ? '' : ''}|L${/^\d+$/.test(parts[1] ?? '') ? parts[1] : '?'}`;
    const e = bakedBy.get(k) ?? { n: 0, px: 0 };
    e.n++; e.px += Math.max(0, (box[2] - box[0]) * (box[3] - box[1]));
    bakedBy.set(k, e);
    return fn.apply(this, a);
  };
}
(window as unknown as { bakedBy: unknown }).bakedBy = bakedBy;
/** Every kept wall, floor and shade picture: its canvas's pixels, the box round what is drawn in it, and the pixels drawn at all. */
function bakeStats(): Record<string, { n: number; canvasKpx: number; bboxKpx: number; inkKpx: number }> {
  const out: Record<string, { n: number; canvasKpx: number; bboxKpx: number; inkKpx: number }> = {};
  const bakes = (renderer as unknown as { bakes: Map<string, { cv: HTMLCanvasElement }> }).bakes;
  for (const [key, b] of bakes) {
    const k = key.split('|')[0];
    const e = (out[k] ??= { n: 0, canvasKpx: 0, bboxKpx: 0, inkKpx: 0 });
    const { width: w, height: h } = b.cv;
    if (!w || !h) continue;
    const d = (b.cv.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, ink = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    e.n++; e.canvasKpx += w * h / 1000; e.bboxKpx += x1 >= 0 ? (x1 - x0 + 1) * (y1 - y0 + 1) / 1000 : 0; e.inkKpx += ink / 1000;
  }
  for (const e of Object.values(out)) { e.canvasKpx = Math.round(e.canvasKpx); e.bboxKpx = Math.round(e.bboxKpx); e.inkKpx = Math.round(e.inkKpx); }
  return out;
}

const counts = { placed: placed.length, walls: walls.length, floors: floors.length, lying: lying.length, crates: crates.length, mobs: mobs.length, peers: people.length };
(window as unknown as { solara: unknown }).solara = { bakeStats, frames, groundBeat, layNear, renderer, game, counts, ready: loadAllWildermon() };
