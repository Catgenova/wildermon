/**
 * Sheets of the dragon proposals (`src/render/wild-dragon-runecut.ts`) beside
 * the live dragon (`src/render/wild-dragon.ts`), for choosing between them.
 *
 *   node tools/dragon/shot.mjs --out <dir>            # every sheet: dragon-A.png .. dragon-lineup.png, the close-ups
 *   node tools/dragon/shot.mjs --out <dir> --only A   # one proposal's sheet and close-up
 *   node tools/dragon/shot.mjs --bench                # milliseconds to draw a picture of each, live dragon first
 *
 * Every body is drawn the way the island draws it (`drawBeast` in
 * `src/render/beasts.ts`): a picture at the nearest of the island's scales,
 * with the island's outline width at that scale, stretched to the camera's
 * zoom; a strike's picture cut to the box the kind reaches, as the island's
 * is. Night is the island's wash with the dragon's own light (`glow`, five
 * tiles at seven tenths) taken out of it round its feet.
 */
import { drawKind, extentOf, kitOf, paletteFor, type Anim, type Kind } from '../../src/render/beasts';
import { loadWildermon, wildermonKind } from '../../src/render/wildermon';
import { DRAGON } from '../../src/render/wild-dragon';
import { DRAGON_PROPOSALS } from '../../src/render/wild-dragon-runecut';
import { SPECIES } from '../../src/game/creatures';
import { HALF_W } from '../../src/render/iso';
import { NIGHT_WASH } from '../../src/render/nightwash';

interface Cell {
  who: string; facing?: number; pose?: string; zoom?: number; night?: boolean; w?: number; h?: number; label?: string; variant?: number;
  /** Several bodies side by side, for a lineup: each its own `who`, at one zoom, spaced by its own width. */
  row?: string[];
}
interface Cfg { rows?: Array<{ title?: string; cells: Cell[] }>; bench?: boolean }
const cfg = (window as unknown as { CFG: Cfg }).CFG;

const STEPS = Array.from({ length: 21 }, (_, q) => 0.5 * 2 ** (q / 4));
const inkAt = (step: number, size = 1): number => Math.max(1.1, (0.7 * step) / size) / step;

/** The body a name stands for: the live dragon, a proposal, or a wildermon at a stage (`cobbe@2`). */
function bodyOf(who: string): { key: string; kind: Kind; species: string } {
  if (who === 'live') return { key: 'dragon', kind: DRAGON, species: 'dragon' };
  const p = DRAGON_PROPOSALS[who];
  if (p) return { key: `dragon~${who}`, kind: p, species: 'dragon' };
  const [species, stage] = who.split('@');
  const m = wildermonKind(species, Number(stage ?? 0));
  if (!m) throw new Error(`no body for ${who}`);
  return { key: m.key, kind: m.kind, species };
}

function animOf(pose = 'stand:0'): Anim {
  const [k, v] = pose.split(':');
  const x = Number(v ?? 0);
  const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.37 };
  if (k === 'stand') { a.t = x; a.breath = 0.5 + 0.5 * Math.sin((x * Math.PI * 2 * 7) / 24); }
  else if (k === 'walk') Object.assign(a, { go: 1, gait: 0, u: x });
  else if (k === 'run') Object.assign(a, { go: 1, gait: 1, u: x });
  else a.act = { kind: k as 'strike', t: x };
  return a;
}

/** The box a kind reaches at every facing standing and going (`reachOf` in beasts.ts), which a strike's picture is cut to. */
const reaches = new Map<string, { left: number; right: number; top: number; bottom: number }>();
function reachOf(key: string, kind: Kind): { left: number; right: number; top: number; bottom: number } {
  let r = reaches.get(key);
  if (r) return r;
  const kit = kitOf(key, kind, 0);
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  const a = animOf();
  for (let f = 0; f < 8; f++) {
    for (const [go, u, gz, g] of [[0, 0, 0, 0], [1, 0.25, 0, 0], [1, 0.75, 0, 0], [1, 0.4, 0, 1], [1, 0.9, 0, 1], [0, 0, 1, 0]]) {
      const e = extentOf(kind, kit, f, { ...a, go, u, gait: g, graze: gz });
      x0 = Math.min(x0, e.x0); x1 = Math.max(x1, e.x1); y0 = Math.min(y0, e.y0); y1 = Math.max(y1, e.y1);
    }
  }
  const pad = 3 + (x1 - x0) * 0.1;
  r = { left: x0 - pad, right: x1 + pad, top: y0 - pad * 1.5, bottom: Math.max(y1, 0) + pad };
  reaches.set(key, r);
  return r;
}

/** One body drawn as the island draws it, feet at (x, y) in CSS pixels on `ctx` (whose own scale is the device's). */
function drawAsIsland(ctx: CanvasRenderingContext2D, x: number, y: number, who: string, facing: number, pose: string, camZoom: number, variant = 0): void {
  const { key, kind, species } = bodyOf(who);
  const dev = ctx.getTransform().a;
  const zoom = camZoom * (kind.size ?? 1);
  const step = STEPS.find((z) => z >= zoom * 0.98) ?? STEPS[STEPS.length - 1];
  const k = step * dev;
  const a = animOf(pose);
  const r = reachOf(key, kind);
  const w = Math.ceil((r.right - r.left) * k), h = Math.ceil((r.bottom - r.top) * k);
  const pic = document.createElement('canvas');
  pic.width = w;
  pic.height = h;
  const g = pic.getContext('2d')!;
  g.setTransform(k, 0, 0, k, -r.left * k, -r.top * k);
  const colors = SPECIES[species].variants[variant] as [string, string];
  drawKind(g, kind, kitOf(key, kind, step < 1.5 ? 0 : 1), paletteFor(key, kind, colors), facing, a, inkAt(step, kind.size), 1 / step);
  const s = zoom / k;
  ctx.drawImage(pic, x + r.left * zoom, y + r.top * zoom, w * s, h * s);
}

/** The grass, a diamond of the island's tiles under it to show its size. */
function ground(g: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, zoom: number): void {
  g.fillStyle = '#86a463';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,90,50,0.22)';
  g.lineWidth = 1;
  const hw = HALF_W * zoom, hh = hw / 2;
  for (let i = -12; i <= 12; i++) {
    g.beginPath();
    g.moveTo(cx + i * hw - 12 * hw, cy + i * hh + 12 * hh);
    g.lineTo(cx + i * hw + 12 * hw, cy + i * hh - 12 * hh);
    g.moveTo(cx + i * hw - 12 * hw, cy - i * hh - 12 * hh);
    g.lineTo(cx + i * hw + 12 * hw, cy - i * hh + 12 * hh);
    g.stroke();
  }
}

/** The night's wash, less the dragon's own light round (lx, ly): five tiles, at seven tenths (`lightsNow` in game.ts). */
function night(g: CanvasRenderingContext2D, w: number, h: number, lights: Array<[number, number]>, zoom: number): void {
  const pad = document.createElement('canvas');
  const dev = g.getTransform().a;
  pad.width = w * dev;
  pad.height = h * dev;
  const p = pad.getContext('2d')!;
  p.scale(dev, dev);
  p.fillStyle = `rgba(${NIGHT_WASH.colour},${NIGHT_WASH.alpha})`;
  p.fillRect(0, 0, w, h);
  p.globalCompositeOperation = 'destination-out';
  for (const [lx, ly] of lights) {
    const R = 5 * HALF_W * zoom, s = 0.7;
    const grad = p.createRadialGradient(lx, ly, 0, lx, ly, R);
    grad.addColorStop(0, `rgba(0,0,0,${s})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${s * 0.55})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    p.fillStyle = grad;
    p.fillRect(lx - R, ly - R, R * 2, R * 2);
  }
  g.drawImage(pad, 0, 0, w, h);
}

/** Where to put a body's feet so its standing box is in the middle of a cell. */
function feetIn(who: string, facing: number, zoom: number, w: number, h: number): [number, number] {
  const { key, kind } = bodyOf(who);
  const e = extentOf(kind, kitOf(key, kind, 0), facing, animOf());
  const s = zoom * (kind.size ?? 1);
  const bx = (e.x0 + e.x1) / 2 * s, top = e.y0 * s, bot = Math.max(e.y1, 0) * s;
  return [w / 2 - bx, h / 2 - (top + bot) / 2 + 6];
}

function drawCell(cell: Cell): HTMLElement {
  const w = cell.w ?? 420, h = cell.h ?? 320, zoom = cell.zoom ?? 1;
  const cv = document.createElement('canvas');
  const dev = window.devicePixelRatio || 1;
  cv.width = w * dev;
  cv.height = h * dev;
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.scale(dev, dev);
  const lights: Array<[number, number]> = [];
  try {
    if (cell.row) {
      // A lineup: each body standing, facing a little toward the viewer, its feet on one line, spaced by its own width.
      const facing = cell.facing ?? 1;
      const boxes = cell.row.map((who) => {
        const { key, kind } = bodyOf(who);
        const e = extentOf(kind, kitOf(key, kind, 0), facing, animOf());
        const s = zoom * (kind.size ?? 1);
        // Each given room for its name under it, however small it is.
        const pad = Math.max(0, 110 - (e.x1 - e.x0) * s) / 2;
        return { who, x0: e.x0 * s - pad, x1: e.x1 * s + pad };
      });
      const total = boxes.reduce((t, b) => t + (b.x1 - b.x0), 0) + 24 * (boxes.length - 1);
      let x = (w - total) / 2;
      const base = h * 0.8;
      ground(g, w, h, w / 2, base, zoom);
      for (const b of boxes) {
        drawAsIsland(g, x - b.x0, base, b.who, facing, 'stand:0', zoom);
        g.fillStyle = 'rgba(30,30,30,0.85)';
        g.font = '12px sans-serif';
        g.textAlign = 'center';
        g.fillText(labelOf(b.who), x + (b.x1 - b.x0) / 2, h - 10);
        x += b.x1 - b.x0 + 24;
      }
    } else {
      const facing = cell.facing ?? 1;
      const [fx, fy] = feetIn(cell.who, facing, zoom, w, h);
      ground(g, w, h, fx, fy, zoom);
      drawAsIsland(g, fx, fy, cell.who, facing, cell.pose ?? 'stand:0', zoom, cell.variant ?? 0);
      lights.push([fx, fy]);
      if (cell.night) night(g, w, h, lights, zoom);
    }
  } catch (e) {
    g.fillStyle = 'red';
    g.font = '12px monospace';
    g.fillText(String((e as Error).stack ?? e).slice(0, 200), 4, 20);
    console.log('ERR', String((e as Error).stack ?? e));
  }
  const box = document.createElement('div');
  box.style.cssText = 'display:inline-block;margin:3px;font:12px sans-serif;text-align:center;color:#ddd;vertical-align:top';
  box.append(cv, document.createElement('br'), cell.label ?? `${cell.who} f${cell.facing ?? 1} ${cell.pose ?? 'stand'}${cell.night ? ' night' : ''} z${zoom}`);
  return box;
}

const NAMES: Record<string, string> = { live: 'Live dragon', A: 'A Runewing', B: 'B Runestone Drake', C: 'C Stormcoil', 'cobbe@2': 'Bastiondrake', 'embra@2': 'Slugferno', 'whispet@2': 'Hallowmire' };
const labelOf = (who: string): string => NAMES[who] ?? who;

/** Milliseconds to draw one picture of each body at the island's scale for zoom one, over a spread of poses. */
function bench(): void {
  const out: string[] = [];
  for (const who of ['live', 'A', 'B', 'C']) {
    const { key, kind } = bodyOf(who);
    const pic = document.createElement('canvas');
    pic.width = 900;
    pic.height = 700;
    const g = pic.getContext('2d')!;
    const pal = paletteFor(key, kind, SPECIES.dragon.variants[0] as [string, string]);
    const poses = ['stand:0', 'stand:3', 'stand:7', 'stand:12', 'walk:0.1', 'walk:0.6', 'run:0.3', 'run:0.8', 'strike:0.3', 'strike:0.6'];
    for (const lod of [1]) {
      const kit = kitOf(key, kind, lod);
      const times: Record<string, number[]> = {};
      for (let rep = 0; rep < 6; rep++) {
        for (const pose of poses) {
          for (let f = 0; f < 8; f++) {
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, 900, 700);
            g.setTransform(32, 0, 0, 32, 450, 500);
            const t0 = performance.now();
            drawKind(g, kind, kit, pal, f, animOf(pose), inkAt(16, kind.size), 1 / 16);
            g.getImageData(0, 0, 1, 1);
            const dt = performance.now() - t0;
            if (rep) (times[pose.split(':')[0]] ??= []).push(dt);
          }
        }
      }
      const med = (xs: number[]): number => { const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
      const all = Object.values(times).flat();
      const faces = kit.reduce((n, p) => n + p.mesh.f.length, 0);
      out.push(`${who.padEnd(5)} lod${lod} faces ${String(faces).padStart(5)}  median ${med(all).toFixed(2)} ms  mean ${(all.reduce((p, q) => p + q, 0) / all.length).toFixed(2)} ms  ` +
        Object.entries(times).map(([k, v]) => `${k} ${med(v).toFixed(2)}`).join('  '));
    }
  }
  (window as unknown as { BENCH: string }).BENCH = out.join('\n');
}

void Promise.all(['cobbe', 'embra', 'whispet', 'stona', 'cindra', 'dragon'].map(loadWildermon)).then(() => {
  if (cfg.bench) {
    bench();
  } else {
    const root = document.getElementById('root')!;
    for (const row of cfg.rows ?? []) {
      if (row.title) {
        const t = document.createElement('div');
        t.style.cssText = 'font:bold 15px sans-serif;color:#eee;margin:10px 4px 2px';
        t.textContent = row.title;
        root.append(t);
      }
      const line = document.createElement('div');
      line.style.whiteSpace = 'nowrap';
      for (const cell of row.cells) line.append(drawCell(cell));
      root.append(line);
    }
  }
  (window as unknown as { DONE: boolean }).DONE = true;
});
