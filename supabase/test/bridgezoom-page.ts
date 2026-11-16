/**
 * The page `bridgezoom.ts` opens: a marble bridge three lanes wide and a
 * stone brick ramp one lane wide, each meeting two buildings' storey floors,
 * in a game run as the island runs it and the renderer that draws it, zoomed
 * past `MAX_ZOOM` as with the sculpted bodies loaded. Bundled for the browser
 * by `bridgezoom.ts`, which drives it through `window.bridgezoom`.
 */
import { WALL_HEIGHT, type BuildingsJSON } from '../../src/game/building';
import type { Bridge } from '../../src/game/bridges';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { SCULPTED_MAX_ZOOM } from '../../src/engine/camera';
import { bridgeBakes, bridgeKept, bridgeWatch } from '../../src/render/bridgekit';

const GROUND = 10;
const g = Game.create(4242, 96);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
for (let y = 0; y <= 96; y++) for (let x = 0; x <= 96; x++) {
  g.world.setHeight(x, y, GROUND);
  if (g.world.inBounds(x, y)) g.world.setTile(x, y, TileType.Grass, 0);
}
g.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS;
g.creatures.fromIsland = true;
g.springs.fromIsland = true;
g.bodyFromIsland = true;
g.packFromIsland = true;
g.journalReady = false;
g.tallyFromIsland = true;
g.ask = () => {};
g.settings.fog = false;

/** Each bridge: its kind, lanes, and the storeys of the floors at its two ends (the ground is nought). */
const SCENES = [
  { name: 'marble', kind: 'marble', width: 3, ua: 3, ub: 3 },
  { name: 'stone ramp', kind: 'stone_brick', width: 1, ua: 1, ub: 3 },
];
const floors: unknown[] = [];
const list: unknown[] = [];
const at: Array<{ x: number; y: number; h: number }> = [];
let id = 1;
SCENES.forEach((s, k) => {
  const WX = 40, EX = 49, Y0 = 30 + k * 24, Y = Y0 + 1;
  const tiles = (x0: number): string[] => {
    const out: string[] = [];
    for (let y = Y0; y <= Y0 + 2; y++) for (let x = x0; x <= x0 + 2; x++) out.push(`${x},${y}`);
    return out;
  };
  for (const [x0, up] of [[WX, s.ua], [EX, s.ub]] as const) {
    const b = id++;
    list.push({ id: b, name: `Hall ${b}`, levels: up + 1, workLevel: up, tiles: tiles(x0) });
    for (let level = 0; level <= up; level++) for (let y = Y0; y <= Y0 + 2; y++) for (let x = x0; x <= x0 + 2; x++) {
      floors.push({ building: b, level, x, y, kind: 'floor', material: 'marble', needed: {}, total: {} });
    }
  }
  const ha = GROUND + s.ua * WALL_HEIGHT, hb = GROUND + s.ub * WALL_HEIGHT;
  const AX = WX + 2, BX = EX;
  g.bridges.set(100 + k, {
    id: 100 + k, kind: s.kind, ax: AX, ay: Y, bx: BX, by: Y, height: ha, level: s.ua, width: s.width, side: 1, rise: hb - ha,
    spans: Array.from({ length: BX - AX - 1 }, (_, i) => ({ x: AX + 1 + i, y: Y, needed: {}, total: {} })),
  } as unknown as Bridge);
  // Where the deck meets the far floor: the picture the report was of.
  at.push({ x: BX - 0.5, y: Y + 0.5, h: hb });
});
g.buildings.sawIsland({ nextId: id, list, walls: [], floors } as unknown as BuildingsJSON as never);
g.reindexDecks();
g.putBody(70.5, 70.5, 0);

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const renderer = new Renderer(new FullscreenCanvas(canvasEl), g);
// Past MAX_ZOOM, as once the sculpted bodies have loaded (`Camera.closest`).
(renderer.camera as unknown as { closest: (m: number) => void }).closest = function (this: { maxZoom: number }) { this.maxZoom = SCULPTED_MAX_ZOOM; };

let scene = 0;
let off: [number, number] = [0, 0];
function frame(): void {
  g.update(1 / 60);
  const a = at[scene];
  renderer.camera.focus(a.x + off[0], a.y + off[1], a.h, null);
  renderer.render(1 / 60);
}
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
const rest = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** A frame as the loop draws it, and the browser's idle time after it, where the bridge kit makes what it put off. */
async function tick(): Promise<void> {
  frame();
  await raf();
  await rest(5);
}
/**
 * What the bridge kit drew in a frame: each picture it put down (`bridgeWatch`), by which picture and where, in
 * order. Two frames that drew the same are the same bridge on the screen, whatever else of the ground changes.
 */
const ids = new WeakMap<HTMLCanvasElement, number>();
let nextId = 0;
let drew: string[] = [];
bridgeWatch.drew = (c, x, y, w, h) => {
  let id = ids.get(c);
  if (id === undefined) { id = ++nextId; ids.set(c, id); }
  drew.push(`${id}@${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`);
};
/** A frame, and what the bridge kit drew in it. */
function drawn(): string {
  drew = [];
  frame();
  return drew.join(' ');
}

/** What the still frames at a view showed: in each, what the bridge kit drew, and the pictures it made, stood in and left out. */
export interface Still { drawn: string[]; made: number[]; stood: number[]; missed: number[]; kept: number; budget: number }

/**
 * Let the view settle: the zoom still past `ZOOM_SETTLE`, and what was put off made -- till two frames running draw
 * the same bridge, or `MOST` frames.
 */
const MOST = 150;
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await tick();
  await rest(300);
  let was = '';
  for (let i = 0; i < MOST; i++) {
    const d = drawn();
    await raf();
    await rest(5);
    if (d === was) return;
    was = d;
  }
}

/** Scene `s` at a zoom and a turn, settled, then `n` still frames. */
async function still(s: number, zoom: number, turn: number, n: number): Promise<Still> {
  scene = s;
  off = [0, 0];
  renderer.camera.rotation = turn;
  renderer.camera.zoom = zoom;
  await settle();
  return measure(n);
}

async function measure(n: number): Promise<Still> {
  const out: Still = { drawn: [], made: [], stood: [], missed: [], kept: 0, budget: bridgeKept().budget };
  for (let i = 0; i < n; i++) {
    const c = bridgeBakes.count, st = bridgeBakes.stood, m = bridgeBakes.missed;
    out.drawn.push(drawn());
    out.made.push(bridgeBakes.count - c);
    out.stood.push(bridgeBakes.stood - st);
    out.missed.push(bridgeBakes.missed - m);
    out.kept = Math.max(out.kept, bridgeKept().area);
    await raf();
    await rest(5);
  }
  return out;
}

/** A wheel in from zoom `z0` to `z1` while the view is dragged about, a frame a step; then let settle and `n` still frames. */
async function wander(s: number, z0: number, z1: number, turn: number, steps: number, n: number): Promise<Still & { left: number }> {
  scene = s;
  renderer.camera.rotation = turn;
  let left = 0;
  for (let i = 0; i <= steps; i++) {
    renderer.camera.zoom = z0 + ((z1 - z0) * i) / steps;
    off = [Math.sin(i / 3) * 1.5, Math.cos(i / 4) * 1.2];
    const m = bridgeBakes.missed;
    await tick();
    left += bridgeBakes.missed - m;
  }
  off = [0, 0];
  await settle();
  return { ...(await measure(n)), left };
}

(window as unknown as { bridgezoom: unknown }).bridgezoom = { still, wander, scenes: SCENES.map((s) => s.name) };
