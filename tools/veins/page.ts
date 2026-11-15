/**
 * The veins page (`tools/veins/shot.mjs`): the game's renderer over a field
 * of bare rock with a two-by-two patch of every kind of rock and seam, the
 * prospected states, and an unidentified seam (`UNIDENTIFIED_FACE`, which
 * only the island sends: here the page stands in for it). `?scene=face` is a
 * hillside quarried into, seams scattered through it and ground round it;
 * `?bench=1` a field that is ore on every tile, for the cost.
 *
 * A tool and nothing else: the game it draws is a local copy of the rules
 * (`Game.create`), as the falls page's is.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { TileType } from '../../src/world/tiles';
import { hash2 } from '../../src/world/noise';
import { seam, UNIDENTIFIED_FACE, VeinNight } from '../../src/render/seams/runecut';
import { drawCost, frameCost } from './bench';

interface Entry { key: string; label: string; kind: number; unknown?: boolean; buried?: boolean; prospect?: boolean }
export const ENTRIES: Entry[] = [
  { key: 'slate', label: 'Slate', kind: 1 },
  { key: 'marble', label: 'Marble', kind: 2 },
  { key: 'sandstone', label: 'Sandstone', kind: 3 },
  { key: 'rock', label: 'Plain rock', kind: 0 },
  { key: 'coal', label: 'Coal', kind: 5 },
  { key: 'copper', label: 'Copper', kind: 4 },
  { key: 'iron', label: 'Iron', kind: 15 },
  { key: 'tin', label: 'Tin', kind: 6 },
  { key: 'zinc', label: 'Zinc', kind: 7 },
  { key: 'lead', label: 'Lead', kind: 8 },
  { key: 'silver', label: 'Silver', kind: 9 },
  { key: 'gold', label: 'Gold', kind: 10 },
  { key: 'adamantine', label: 'Adamantine', kind: 11 },
  { key: 'glimmersteel', label: 'Glimmersteel', kind: 12 },
  { key: 'mithril', label: 'Mithril', kind: 13 },
  { key: 'seryll', label: 'Seryll', kind: 14 },
  { key: 'unknown', label: 'Unidentified metal', kind: 15, unknown: true },
  { key: 'p-gold', label: 'Prospected: gold, bare', kind: 10, prospect: true },
  { key: 'p-iron', label: 'Prospected: iron, bare', kind: 15, prospect: true },
  { key: 'p-adamantine', label: 'Prospected: adamantine, bare', kind: 11, prospect: true },
  { key: 'p-copper-buried', label: 'Prospected: copper, buried', kind: 4, buried: true, prospect: true },
  { key: 'p-mithril-buried', label: 'Prospected: mithril, buried', kind: 13, buried: true, prospect: true },
  { key: 'p-unknown', label: 'Prospected: unidentified, bare', kind: 11, unknown: true, prospect: true },
  { key: 'p-unknown-buried', label: 'Prospected: unidentified, buried', kind: 8, unknown: true, buried: true, prospect: true },
];
const COLS = 6;
const PITCH = 3;
const SIZE = 30;
const at = (i: number): [number, number] => [3 + (i % COLS) * PITCH, 3 + Math.floor(i / COLS) * PITCH];

interface Shot { x: number; y: number; zoom: number; hour: number; t: number; turn?: number; labels?: boolean }
interface VeinsPage { ready: boolean; error: string; entries: Entry[]; at(i: number): [number, number]; shot(s: Shot): Promise<void>; bench(nightOnly?: boolean): Promise<unknown> }
const page: VeinsPage = { ready: false, error: '', entries: ENTRIES, at, shot: async () => {}, bench: async () => null };
(window as unknown as { veins: VeinsPage }).veins = page;

const params = new URLSearchParams(location.search);
const scene = params.get('bench') === '1' ? 'bench' : params.get('scene') ?? 'field';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
let canvasEl = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvasEl) {
  canvasEl = document.createElement('canvas');
  canvasEl.id = 'game';
  document.body.appendChild(canvasEl);
}
const labelBox = document.createElement('div');
labelBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 12px system-ui,sans-serif;';
document.body.appendChild(labelBox);
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

try {
  const size = scene === 'bench' ? 64 : scene === 'face' ? 40 : SIZE;
  const game = Game.create(4242, size);
  let hour = 13;
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  const w = game.world;
  const unknown = new Set<number>();
  const prospected: number[] = [];
  if (scene === 'bench') {
    // Ore on every tile, every kind, for the cost of the worst hillside.
    for (let y = 0; y <= w.h; y++) for (let x = 0; x <= w.w; x++) w.setHeight(x, y, 40 + Math.round(Math.sin(x * 0.3) * 2 + Math.cos(y * 0.25) * 2));
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) { const k = 1 + ((x * 7 + y * 3) % 15); w.setRockKind(x, y, k); w.setTile(x, y, TileType.Rock, k); }
  } else if (scene === 'face') {
    // A hill quarried into: steep rock faces and benches, seams through them, grass over its shoulders.
    const hill = (x: number, y: number): number => {
      const d = Math.hypot(x - 20, y - 18);
      const up = Math.max(0, 26 - d);
      return 30 + Math.round(up * 1.4) + Math.floor(up / 4) * 6 + Math.round(Math.sin(x * 0.9 + y * 0.4) * 2);
    };
    for (let y = 0; y <= w.h; y++) for (let x = 0; x <= w.w; x++) w.setHeight(x, y, hill(x, y));
    const ores = [4, 15, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 1, 2, 3];
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const d = Math.hypot(x + 0.5 - 20, y + 0.5 - 18);
        const r = hash2(x, y, 31);
        const kind = r < 0.3 ? ores[Math.floor(hash2(x >> 1, y >> 1, 37) * ores.length)] : 0;
        w.setRockKind(x, y, kind);
        const rock = d < 20 && hash2(x, y, 41) > 0.12;
        w.setTile(x, y, rock ? TileType.Rock : TileType.Grass, rock ? kind : 0);
        if (rock && kind && hash2(x, y, 43) < 0.06) unknown.add(y * w.w + x);
      }
    }
  } else {
    const height = (x: number, y: number): number => 40 + Math.round(y * 0.6 + Math.sin(x * 0.7) * 1.2);
    for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, height(x, y));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { w.setTile(x, y, TileType.Rock, 0); w.setRockKind(x, y, 0); }
    ENTRIES.forEach((e, i) => {
      const [x0, y0] = at(i);
      for (let y = y0; y < y0 + 2; y++) {
        for (let x = x0; x < x0 + 2; x++) {
          w.setRockKind(x, y, e.kind);
          w.setTile(x, y, e.buried ? TileType.Grass : TileType.Rock, e.buried ? 0 : e.kind);
          if (e.unknown) unknown.add(y * w.w + x);
          if (e.prospect) prospected.push(y * w.w + x);
        }
      }
    });
  }
  game.update(0.01);
  // A seam the island would not name: what it sends for one (`UNIDENTIFIED_FACE`).
  const face = w.rockFace.bind(w);
  w.rockFace = (x: number, y: number): number => (unknown.has(y * w.w + x) ? UNIDENTIFIED_FACE : face(x, y));

  const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
  const cam = renderer.camera;
  cam.follow = false;
  const focus = (x: number, y: number): void => {
    game.player.x = scene === 'field' ? 1.5 : x;
    game.player.y = scene === 'field' ? SIZE - 1.5 : y;
    cam.focus(x, y, w.getHeight(Math.floor(x), Math.floor(y)), null);
  };
  page.shot = async (s) => {
    hour = s.hour;
    cam.zoom = s.zoom;
    cam.rotation = s.turn ?? 0;
    focus(s.x, s.y);
    for (let i = 0; i < 24; i++) {
      game.prospected = prospected.length ? { tiles: new Set(prospected), until: game.time + 1e9 } : null;
      game.update(1 / 60);
      focus(s.x, s.y);
      renderer.time = s.t - 1 + i / 24;
      renderer.render(0);
      await nextFrame();
    }
    renderer.time = s.t;
    renderer.render(0);
    labelBox.innerHTML = '';
    if (s.labels && scene === 'field') {
      ENTRIES.forEach((e, i) => {
        const [x0, y0] = at(i);
        const d = document.createElement('div');
        const sx = cam.worldToScreenX(x0 + 2, y0 + 2), sy = cam.worldToScreenY(x0 + 2, y0 + 2, w.getHeight(x0 + 2, y0 + 2));
        d.textContent = e.label;
        d.style.cssText = `position:absolute;left:${sx}px;top:${sy + 4}px;transform:translateX(-50%);padding:1px 5px;border-radius:4px;background:rgba(40,32,52,0.78);color:#f6efe2;white-space:nowrap;`;
        labelBox.appendChild(d);
      });
    }
    await nextFrame();
  };
  page.bench = async (nightOnly = false) => {
    const set = { hour: (h: number) => { hour = h; }, at: focus };
    const draw = nightOnly ? {} : drawCost(seam, [1, 2, 3], Array.from({ length: 15 }, (_, i) => i + 1));
    const frames = nightOnly ? {} : await frameCost(renderer, game, set, [1, 2]);
    // What the seams' night costs, measured against the same frames with it left out, the two taken in turn.
    const glow = VeinNight.prototype.glow;
    const night: Record<string, number> = {};
    for (const turn of [0, 1]) {
      for (const zoom of [1, 2]) {
        set.hour(23);
        cam.zoom = zoom;
        cam.rotation = turn;
        set.at(30, 30);
        const on: number[] = [], off: number[] = [];
        for (let i = 0; i < 80; i++) {
          VeinNight.prototype.glow = i % 2 ? glow : () => {};
          const t0 = performance.now();
          renderer.render(0);
          canvasEl!.getContext('2d')!.getImageData(0, 0, 1, 1);
          if (i >= 10) (i % 2 ? on : off).push(performance.now() - t0);
          await nextFrame();
        }
        const med = (xs: number[]): number => xs.sort((a, b) => a - b)[xs.length >> 1];
        night[`turn${turn} z${zoom} night: seams' light on`] = med(on);
        night[`turn${turn} z${zoom} night: left out`] = med(off);
        // And the seams' light alone, laid again over the last frame: how many, and the milliseconds for all of them.
        VeinNight.prototype.glow = glow;
        renderer.render(0);
        const vn = (renderer as unknown as { veinNight: { glow: VeinNight['glow']; n: number } }).veinNight;
        const g2 = canvasEl!.getContext('2d')!;
        g2.save();
        g2.setTransform(2, 0, 0, 2, 0, 0);
        const t1 = performance.now();
        for (let k = 0; k < 10; k++) vn.glow(g2, zoom, 2, 1);
        g2.getImageData(0, 0, 1, 1);
        night[`turn${turn} z${zoom} night: seams lit, ms for all`] = (performance.now() - t1) / 10;
        night[`turn${turn} z${zoom} night: seams lit`] = vn.n;
        g2.restore();
      }
    }
    VeinNight.prototype.glow = glow;
    return { draw, frames, night };
  };
  page.ready = true;
} catch (e) {
  page.error = String((e as Error).stack ?? e);
  page.ready = true;
}
