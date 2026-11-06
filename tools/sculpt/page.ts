/**
 * The sculpt studio: the page `tools/sculpt/shot.mjs` drives through
 * `window.SCULPT` to look a sculpted body over -- at the reference's seven
 * heads and the island's five, beside the reference sheet and beside the 2D
 * figure of the same look -- at eight facings, through idle, walk, work and
 * wave, at the game's zooms and close, by day and night, and in the debug
 * views (wireframe, normals, materials, bones, edges), with the bake's
 * numbers and the cost of a crowd.
 */
import { drawFigure, type FigurePose } from '../../src/render/figure';
import type { Look } from '../../src/game/look';
import { bandOf, CELL } from '../../src/sculpt/bake';
import { built, bakedAt, drawSculpt, sculptScene, FIVE, SEVEN, type Debug } from '../../src/sculpt/index';
import type { Proportions } from '../../src/sculpt/rig';
import { glContext } from '../../src/sculpt/gl';

const DPR = window.devicePixelRatio || 1;
const GRASS = '#7d9b5e';
const PROPS: Record<string, Proportions> = { seven: SEVEN, five: FIVE };
const LOOK: Look = { gender: 'man', skin: 'light', hair: 'tousled', hairColour: 'chestnut', eyes: 'brown', beard: 'none', shirt: 'teal', trousers: 'brown' };
const REF = (window as unknown as { REF?: string }).REF;

function poseOf(facing: number, what: string): FigurePose {
  const [k, v] = what.split(':');
  const u = Number(v ?? 0);
  const p: FigurePose = { phase: 0, moving: false, facing, swimming: false, working: false, look: LOOK, id: 'studio' };
  if (k === 'walk') { p.moving = true; p.phase = u * Math.PI * 2; }
  if (k === 'run') { p.moving = true; p.gait = 1; p.phase = u * Math.PI * 2; }
  if (k === 'idle') p.phase = u * 6;
  if (k === 'work') { p.working = true; p.phase = u; }
  if (k === 'wave') { p.emote = 'wave'; p.emoteT = u; }
  if (k === 'talk') { p.emote = 'talk'; p.emoteT = u; }
  delete p.id;
  return p;
}

interface Cell { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; fx: number; fy: number; w: number; h: number }
/** A cell the body's box fits in at `zoom`, or a crop of it: `crop` as [top, bottom] in box units. */
function cell(zoom: number, crop?: [number, number], wide?: [number, number]): Cell {
  const top = crop ? crop[0] : -43, bottom = crop ? crop[1] : 5;
  const left = wide ? wide[0] : -17, right = wide ? wide[1] : 17;
  const w = Math.ceil((right - left) * zoom), h = Math.ceil((bottom - top) * zoom);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.scale(DPR, DPR);
  g.fillStyle = GRASS;
  g.fillRect(0, 0, w, h);
  return { cv, g, fx: -left * zoom, fy: -top * zoom, w, h };
}

const root = document.getElementById('root')!;
function heading(text: string): void {
  const h = document.createElement('div');
  h.style.cssText = 'font:13px sans-serif;color:#eee;margin:6px 2px 2px';
  h.textContent = text;
  root.append(h);
}
function row(cells: Array<{ cv: HTMLCanvasElement; label: string }>): void {
  const line = document.createElement('div');
  line.style.cssText = 'white-space:normal;max-width:3300px;margin:1px 0';
  for (const c of cells) {
    const box = document.createElement('div');
    box.style.cssText = 'display:inline-block;margin:1px;font:10px sans-serif;text-align:center;color:#ddd;vertical-align:top';
    box.append(c.cv, document.createElement('br'), c.label);
    line.append(box);
  }
  root.append(line);
}

type Who = 'seven' | 'five' | 'figure';
function drawOne(c: Cell, zoom: number, who: Who, pose: FigurePose, o: { night?: number; debug?: Debug; flat?: boolean } = {}): void {
  try {
    if (who === 'figure') {
      drawFigure(c.g, c.fx, c.fy, zoom, pose);
      if (o.night) { c.g.fillStyle = `rgba(12, 20, 44, ${0.68 * o.night})`; c.g.fillRect(0, 0, c.w, c.h); }
      return;
    }
    if (!drawSculpt(c.g, c.fx, c.fy, zoom, pose, { P: PROPS[who], dpr: DPR, now: 1, ...o })) drawFigure(c.g, c.fx, c.fy, zoom, pose);
  } catch (e) {
    c.g.fillStyle = 'red'; c.g.font = '10px sans-serif';
    c.g.fillText(String(e).slice(0, 80), 2, 12);
    console.log('ERR', String(e), (e as Error).stack);
  }
}

const img = (src: string, h: number): Promise<HTMLCanvasElement> => new Promise((res) => {
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement('canvas');
    const w = Math.round((im.width * h) / im.height);
    cv.width = w * DPR; cv.height = h * DPR; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    cv.getContext('2d')!.drawImage(im, 0, 0, w * DPR, h * DPR);
    res(cv);
  };
  im.src = src;
});

const api = {
  clear(): void { root.innerHTML = ''; },
  /** The lineup: the reference, the seven-head sculpt, the five-head sculpt and the 2D figure, all at one height. */
  async lineup(zoom = 6, what = 'idle:0'): Promise<void> {
    heading(`lineup at zoom ${zoom}: reference | sculpt seven heads | sculpt five heads | the 2D figure today (${what})`);
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    const bodyPx = 16.5 * 2.25 * zoom;
    if (REF) cells.push({ cv: await img(REF, Math.round(bodyPx * 1.14)), label: 'reference 07' });
    for (const who of ['seven', 'five', 'figure'] as Who[]) for (const f of [1, 0, 3]) {
      const c = cell(zoom);
      drawOne(c, zoom, who, poseOf(f, what));
      cells.push({ cv: c.cv, label: `${who} f${f}` });
    }
    row(cells);
  },
  /** Eight facings of one body in one pose. */
  facings(who: Who, what: string, zoom: number, o: { night?: number; debug?: Debug } = {}): void {
    heading(`${who} ${what} zoom ${zoom}${o.night ? ' night' : ''}${o.debug ? ` ${o.debug}` : ''}`);
    const cells = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => { const c = cell(zoom); drawOne(c, zoom, who, poseOf(f, what), o); return { cv: c.cv, label: `f${f}` }; });
    row(cells);
  },
  /** A motion strip: frames of a walk, a run, work and a wave, at one facing. */
  strip(who: Who, facing: number, zoom: number): void {
    const frames = [
      ...[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((u) => `walk:${u}`),
      ...[0, 0.25, 0.5, 0.75].map((u) => `run:${u}`),
      ...[0, 0.33, 0.66, 1].map((u) => `idle:${u}`),
      ...[0.1, 0.3, 0.5, 0.7].map((u) => `work:${u}`),
      ...[0.2, 0.4, 0.6, 0.8].map((u) => `wave:${u}`),
    ];
    heading(`${who} motion, facing ${facing}, zoom ${zoom}: walk ×8, run ×4, idle ×4, work ×4, wave ×4`);
    row(frames.map((w) => { const c = cell(zoom); drawOne(c, zoom, who, poseOf(facing, w)); return { cv: c.cv, label: w }; }));
  },
  /** Close-ups: the whole body big, then the head and a hand bigger. */
  close(who: Who, zoom = 9): void {
    heading(`${who} close, zoom ${zoom}: idle at four facings; then the head at ${zoom * 2.2} and the hands at ${zoom * 2}`);
    row([0, 1, 3, 5].map((f) => { const c = cell(zoom); drawOne(c, zoom, who, poseOf(f, 'idle:0')); return { cv: c.cv, label: `f${f}` }; }));
    const hz = zoom * 2.2;
    const heads = [0, 1, 2, 3, 5, 7].map((f) => { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, poseOf(f, f === 7 ? 'talk:0.3' : 'idle:0')); return { cv: c.cv, label: `head f${f}${f === 7 ? ' talk' : ''}` }; });
    row(heads);
    const hands = [1, 3].flatMap((f) => ['idle:0', 'wave:0.5', 'work:0.5'].map((w) => { const c = cell(hz * 0.6, [-38, -4], [-14, 14]); drawOne(c, hz * 0.6, who, poseOf(f, w)); return { cv: c.cv, label: `hands f${f} ${w}` }; }));
    row(hands);
  },
  /** The debug views, one facing big. */
  debug(who: Who, zoom = 6, facing = 1, what = 'walk:0.25'): void {
    heading(`${who} debug, zoom ${zoom}, facing ${facing}, ${what}: shaded | flat | wire | normals | materials | bones | edges`);
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    for (const [label, o] of [['shaded', {}], ['flat', { flat: true }], ['wire', { debug: 'wire' }], ['normals', { debug: 'normals' }], ['materials', { debug: 'mats' }], ['bones', { debug: 'bones' }], ['edges', { debug: 'edges' }]] as Array<[string, { debug?: Debug; flat?: boolean }]>) {
      const c = cell(zoom);
      drawOne(c, zoom, who, poseOf(facing, what), o);
      cells.push({ cv: c.cv, label });
    }
    row(cells);
  },
  /** The bake's numbers per band, and the draw's cost. */
  stats(who: 'seven' | 'five'): Record<string, unknown> {
    const b = built(PROPS[who], LOOK);
    const out: Record<string, unknown> = { prims: b.model.prims.length, bones: b.order.length, boneNames: b.order.join(' ') };
    for (const band of [0, 1, 2] as const) {
      const k = bakedAt(b, band);
      out[`band${band}`] = { cell: CELL[band], grid: k.grid.join('×'), verts: k.nVerts, tris: k.nTris, bakeMs: Math.round(k.ms) };
    }
    return out;
  },
  bench(who: 'seven' | 'five', n = 20, frames = 10, zoom = 1): { msPerFrame: number; msPerBody: number; band: number } {
    const c = cell(zoom);
    const poses = Array.from({ length: n }, (_, i) => poseOf(i % 8, i % 2 ? 'walk:0.3' : 'idle:0.2'));
    for (const p of poses) drawSculpt(c.g, c.fx, c.fy, zoom, p, { P: PROPS[who], dpr: DPR });
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) for (const p of poses) { p.phase += 0.05; drawSculpt(c.g, c.fx, c.fy, zoom, p, { P: PROPS[who], dpr: DPR, now: f * 0.1 }); }
    const ms = (performance.now() - t0) / frames;
    return { msPerFrame: ms, msPerBody: ms / n, band: bandOf(zoom) };
  },
  benchFigure(n = 20, frames = 10, zoom = 1): { msPerFrame: number; msPerBody: number } {
    const c = cell(zoom);
    const poses = Array.from({ length: n }, (_, i) => poseOf(i % 8, i % 2 ? 'walk:0.3' : 'idle:0.2'));
    for (const p of poses) drawFigure(c.g, c.fx, c.fy, zoom, p);
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) for (const p of poses) { p.phase += 0.05; drawFigure(c.g, c.fx, c.fy, zoom, p); }
    const ms = (performance.now() - t0) / frames;
    return { msPerFrame: ms, msPerBody: ms / n };
  },
  glInfo(): string {
    const C = glContext();
    if (!C) return 'no webgl2';
    const d = C.gl.getExtension('WEBGL_debug_renderer_info');
    return d ? String(C.gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'webgl2';
  },
  scene: sculptScene,
};
(window as unknown as { SCULPT: typeof api }).SCULPT = api;
(window as unknown as { READY: boolean }).READY = true;
