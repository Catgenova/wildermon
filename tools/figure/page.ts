/**
 * The figure studio: the page `tools/figure/shot.mjs` opens to look over the
 * player's body under each way of painting it (`FIGURE_STYLE` in
 * `src/render/figure.ts`), beside the island's own and the reference sheets.
 *
 * Driven through `window.figure`:
 *   * `sheet(spec)`: for each style named in `spec.modes`, the body at the
 *     game's zoom from all eight ways round standing and walking, at twice
 *     that, and close up from four; by day and, if asked, by night;
 *   * `refs()`: the reference pictures handed in (`window.REFS`), at a size
 *     to set beside the close-ups;
 *   * `bench(mode, n, frames)`: the cost of a crowd of `n` drawn through the
 *     mesh every frame, and as the island puts them down (kept pictures).
 *
 * A style is a preset by name (`PRESETS`), or any `a=b,c=d` string of the
 * style's own fields over the island's own.
 */
import { drawFigure, FIGURE_STYLE, setFigureStyle, type FigurePose, type FigureStyle, type GearLook } from '../../src/render/figure';
import { DEFAULT_LOOK, type Look } from '../../src/game/look';
import { NIGHT_WASH } from '../../src/render/nightwash';

const DEV = window.devicePixelRatio || 1;
const GRASS = '#7d9b5e';

/** The island's own, which every preset is laid over. */
const OWN: FigureStyle = { shade: 'flat', grain: 0, warm: false, occlude: false, ink: 'own', finish: 'none', steps: 6, face: false };
/** Each way of painting a body, and the hair the reference's figure is given with it. */
const PRESETS: Record<string, { style: Partial<FigureStyle>; hair?: string }> = {
  current: { style: {} },
  smooth: { style: { shade: 'smooth' } },
  warm: { style: { warm: true, occlude: true } },
  grain: { style: { grain: 0.1 } },
  ink_even: { style: { ink: 'even' } },
  ink_weighted: { style: { ink: 'weighted' } },
  pixel: { style: { finish: 'pixel', steps: 6 } },
  face: { style: { face: true }, hair: 'tufts' },
  // Ligne claire: flat local colour, one shadow shape and one highlight shape a surface in a shifted hue, one clean line, a faint grain.
  claire: { style: { shade: 'claire', warm: true, occlude: true, ink: 'even', grain: 0.025 } },
  best: { style: { shade: 'claire', warm: true, occlude: true, ink: 'even', grain: 0.025, face: true }, hair: 'tufts' },
  best_pixel: { style: { shade: 'claire', warm: true, occlude: true, ink: 'even', grain: 0.025, finish: 'pixel', steps: 10, face: true }, hair: 'tufts' },
  best_soft: { style: { shade: 'smooth', warm: true, occlude: true, ink: 'weighted', face: true }, hair: 'tufts' },
};

function styleOf(mode: string): { style: FigureStyle; hair?: string } {
  const p = PRESETS[mode];
  if (p) return { style: { ...OWN, ...p.style }, hair: p.hair };
  const s: Record<string, unknown> = { ...OWN };
  for (const kv of mode.split(',')) {
    const [k, v] = kv.split('=');
    s[k] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(Number(v)) ? Number(v) : v;
  }
  return { style: s as unknown as FigureStyle };
}

/** The reference's figure: a man, olive skin, chestnut hair, amber eyes, in a teal jerkin over an unbleached shirt and dark trousers. */
const REF_LOOK: Look = { gender: 'man', skin: 'olive', hair: 'short', hairColour: 'chestnut', eyes: 'amber', beard: 'none', shirt: 'unbleached', trousers: 'bark' };
const REF_GEAR: GearLook = {
  chest: { id: 'leather_jerkin', dye: '#4fb6b0' },
  legs: { id: 'cloth_trousers', dye: '#5a3e2c' },
  belt: { id: 'toolbelt' },
};

interface Spec {
  modes: string[];
  look?: Partial<Look>;
  gear?: GearLook | null;
  night?: boolean;
  /** Just the close-ups and the game row, for a quick look. */
  brief?: boolean;
}

const still = (facing: number, t: number, look: Look, gear?: GearLook): FigurePose => ({ phase: t, moving: false, facing, swimming: false, working: false, look, gear });
const walk = (facing: number, u: number, look: Look, gear?: GearLook): FigurePose => ({ phase: u, moving: true, gait: 0, facing, swimming: false, working: false, look, gear });

function canvasOf(w: number, h: number, bg = GRASS): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DEV);
  cv.height = Math.round(h * DEV);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.setTransform(DEV, 0, 0, DEV, 0, 0);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  return { cv, g };
}

function night(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.save();
  g.setTransform(DEV, 0, 0, DEV, 0, 0);
  g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

const root = document.getElementById('root')!;
function heading(text: string, big = false): void {
  const d = document.createElement('div');
  d.style.cssText = `font:${big ? 'bold 20px' : 'bold 13px'} system-ui,sans-serif;color:${big ? '#f4ecd8' : '#d8cfbc'};margin:${big ? '10px 8px 2px' : '10px 8px 3px'}`;
  d.textContent = text;
  root.append(d);
}
function note(text: string): void {
  const d = document.createElement('div');
  d.style.cssText = 'font:12px system-ui,sans-serif;color:#b8b0a0;margin:0 8px 6px;max-width:1700px';
  d.textContent = text;
  root.append(d);
}
function row(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:6px;align-items:flex-end;margin:0 8px 4px;flex-wrap:wrap';
  root.append(d);
  return d;
}
function label(text: string, w: number): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `font:10px system-ui,sans-serif;color:#c8c0b0;width:${w}px;text-align:center`;
  d.textContent = text;
  return d;
}
function cell(cv: HTMLCanvasElement, text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.append(cv, label(text, Number.parseFloat(cv.style.width)));
  return d;
}

/** A body drawn with its feet at (x, y) at `zoom`, with the style on. */
function body(g: CanvasRenderingContext2D, x: number, y: number, zoom: number, pose: FigurePose): void {
  drawFigure(g, x, y, zoom, pose);
}

function sheetOf(mode: string, spec: Spec): void {
  const { style, hair } = styleOf(mode);
  setFigureStyle(style);
  const look: Look = { ...REF_LOOK, ...(hair ? { hair } : {}), ...(spec.look ?? {}) };
  const gear = spec.gear === null ? undefined : spec.gear ?? REF_GEAR;
  const days: boolean[] = spec.night ? [false, true] : [false];
  heading(`${mode}: ${JSON.stringify(style)}${hair ? ` hair=${hair}` : ''}`, true);
  for (const dark of days) {
    // The game's zoom, one: eight ways round standing, and walking at four points of the stride.
    for (const zoom of spec.brief ? [1] : [1, 2]) {
      const r = row();
      const w = 52 * zoom, h = 72 * zoom;
      for (let f = 0; f < 8; f++) {
        const { cv, g } = canvasOf(w, h);
        body(g, w / 2, h - 12 * zoom, zoom, still(f, 0.4, look, gear));
        if (dark) night(g, w, h);
        r.append(cell(cv, `z${zoom} f${f} stand`));
      }
      for (const [f, u] of [[1, 0], [1, 0.25], [1, 0.5], [1, 0.75], [3, 0.25], [5, 0.25], [7, 0.25]] as Array<[number, number]>) {
        const { cv, g } = canvasOf(w, h);
        body(g, w / 2, h - 12 * zoom, zoom, walk(f, u, look, gear));
        if (dark) night(g, w, h);
        r.append(cell(cv, `z${zoom} f${f} walk ${u}`));
      }
      note(`zoom ${zoom}${dark ? ', night' : ''}: a tile is ${96 * zoom} by ${48 * zoom}; a body about ${36 * zoom} px tall.`);
    }
    // Close up: as the Runecut mirror or a creator shows a body, from four ways.
    const r = row();
    const zoom = 8, w = 50 * zoom, h = 58 * zoom;
    for (const f of [1, 0, 3, 5]) {
      const { cv, g } = canvasOf(w, h, '#f2ece2');
      body(g, w / 2, h - 10 * zoom, zoom, still(f, 0.4, look, gear));
      if (dark) night(g, w, h);
      r.append(cell(cv, `close z${zoom} f${f}`));
    }
    for (const u of [0.25, 0.6]) {
      const { cv, g } = canvasOf(w, h, '#f2ece2');
      body(g, w / 2, h - 10 * zoom, zoom, walk(1, u, look, gear));
      if (dark) night(g, w, h);
      r.append(cell(cv, `close z${zoom} walk ${u}`));
    }
  }
}

function refs(): void {
  const list = ((window as unknown as { REFS?: Array<{ name: string; url: string }> }).REFS) ?? [];
  if (!list.length) return;
  heading('references', true);
  const r = row();
  for (const { name, url } of list) {
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'height:464px;width:auto';
    const d = document.createElement('div');
    d.append(img, label(name, 300));
    r.append(d);
  }
}

async function sheet(spec: Spec): Promise<void> {
  for (const m of spec.modes) sheetOf(m, spec);
  refs();
  await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  (window as unknown as { DONE: boolean }).DONE = true;
}

/** The cost of `n` bodies a frame over `frames` frames: drawn afresh through the mesh, and as the island keeps them. */
function bench(mode: string, n: number, frames: number, zoom = 1): { parts: string; fresh: number; game: number } {
  const { style, hair } = styleOf(mode);
  setFigureStyle(style);
  const look: Look = { ...REF_LOOK, ...(hair ? { hair } : {}) };
  const { g } = canvasOf(1200, 700);
  const poses = Array.from({ length: n }, (_, i): FigurePose => (i % 2 ? walk(i % 8, (i * 0.13) % 1, look, REF_GEAR) : still(i % 8, 0.3 + i * 0.1, look, REF_GEAR)));
  // Warm every cache first.
  for (let i = 0; i < n; i++) body(g, 60 + (i % 12) * 90, 150 + Math.floor(i / 12) * 160, zoom, poses[i]);
  let t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < n; i++) {
      const p = poses[i];
      body(g, 60 + (i % 12) * 90, 150 + Math.floor(i / 12) * 160, zoom, p.moving ? { ...p, phase: (p.phase + f * 0.06) % 1 } : { ...p, phase: p.phase + f * 0.05 });
    }
  }
  const fresh = (performance.now() - t0) / frames;
  // As the island does it: a body with an id is kept as a picture and drawn again a dozen to thirty times a second.
  const ids = poses.map((p, i) => ({ ...p, id: `bench${i}` }));
  for (let i = 0; i < n; i++) body(g, 60 + (i % 12) * 90, 150 + Math.floor(i / 12) * 160, zoom, ids[i]);
  t0 = performance.now();
  const start = performance.now();
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < n; i++) {
      const p = ids[i];
      body(g, 60 + (i % 12) * 90, 150 + Math.floor(i / 12) * 160, zoom, p.moving ? { ...p, phase: (p.phase + f * 0.06) % 1 } : { ...p, phase: p.phase + f * 0.05 });
    }
    // A frame at sixty a second: so the kept pictures are drawn again at their own rates, not every pass.
    while (performance.now() - start < (f + 1) * 16.6) { /* wait */ }
  }
  const game = (performance.now() - t0) / frames - 16.6;
  return { parts: mode, fresh, game: Math.max(0, game) };
}

(window as unknown as { figure: unknown }).figure = { sheet, bench, refs, styleOf, FIGURE_STYLE, DEFAULT_LOOK };
(window as unknown as { READY: boolean }).READY = true;
