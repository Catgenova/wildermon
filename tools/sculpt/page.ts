/**
 * The sculpt studio: the page `tools/sculpt/shot.mjs` drives through
 * `window.SCULPT` to look a sculpted body over -- at the reference's seven
 * heads and the island's five, beside the reference sheet and beside the 2D
 * figure of the same look -- at eight facings, through idle, walk, work and
 * wave, at the game's zooms and close, by day and night, and in the debug
 * views (wireframe, normals, materials, bones, edges), with the bake's
 * numbers and the cost of a crowd.
 */
import { drawFigure, sculptedFigures, type FigurePose } from '../../src/render/figure';
import type { Look } from '../../src/game/look';
import { bandOf, CELL } from '../../src/sculpt/bake';
import { HEIGHT_SCALE } from '../../src/render/iso';
import { built, bakedAt, drawSculpt, heightOf, humanProportions, levelView, sculptScene, FIVE, SEVEN, type Debug, type Kind, type Wear } from '../../src/sculpt/index';
import { GARMENT_FILE } from '../../src/sculpt/cloth';
import { HUMAN_HEIGHT } from '../../src/sculpt/human';
import { at } from '../../src/sculpt/rig';
import type { HandShape, View } from '../../src/render/figure';
import type { Proportions } from '../../src/sculpt/rig';
import type { V3 } from '../../src/sculpt/sdf';
import { glContext } from '../../src/sculpt/gl';

const DPR = window.devicePixelRatio || 1;
const GRASS = '#7d9b5e';
const PROPS: Record<string, Proportions> = { male: humanProportions(0), female: humanProportions(1), neither: humanProportions(0.5), seven: SEVEN, five: FIVE };
const MALE = PROPS.male;
/** The island's five and the reference's seven are the distance-field body; the rest the human base. */
const kindOf = (who: string): Kind => (who === 'seven' || who === 'five' ? 'sdf' : 'human');
const REF8 = (window as unknown as { REF8?: string }).REF8;
const REF9 = (window as unknown as { REF9?: string }).REF9;
const REF10 = (window as unknown as { REF10?: string }).REF10;
// The design sheet's colours: a warm tan and a dark plum-blue, named outright.
const LOOK = { gender: 'man', skin: '#c98a5a', hair: (window as unknown as { HAIR?: string }).HAIR ?? 'tousled', hairColour: '#2e2440', eyes: 'dark', beard: 'none', shirt: 'teal', trousers: 'brown' } as unknown as Look;
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

type Who = 'male' | 'female' | 'neither' | 'seven' | 'five' | 'figure';
/** The studio's look in the body's own gender. */
const lookOf = (who: Who): Look => ({ ...LOOK, gender: who === 'female' ? 'woman' : who === 'neither' ? 'neither' : 'man' });
function drawOne(c: Cell, zoom: number, who: Who, pose: FigurePose, o: { night?: number; debug?: Debug; flat?: boolean; wear?: Wear; stance?: 'ref' | 'straight'; view?: View; hands?: HandShape } = {}): void {
  try {
    if (who === 'figure') {
      drawFigure(c.g, c.fx, c.fy, zoom, pose);
      if (o.night) { c.g.fillStyle = `rgba(12, 20, 44, ${0.68 * o.night})`; c.g.fillRect(0, 0, c.w, c.h); }
      return;
    }
    const { INK: ink, PITCH: pitch } = window as unknown as { INK?: number; PITCH?: number };
    if (!drawSculpt(c.g, c.fx, c.fy, zoom, { ...pose, look: lookOf(who) }, { P: PROPS[who], kind: kindOf(who), dpr: DPR, now: 1, ...(ink === undefined ? {} : { ink }), ...(pitch === undefined ? {} : { pitch }), ...o })) drawFigure(c.g, c.fx, c.fy, zoom, pose);
  } catch (e) {
    c.g.fillStyle = 'red'; c.g.font = '10px sans-serif';
    c.g.fillText(String(e).slice(0, 80), 2, 12);
    console.log('ERR', String(e), (e as Error).stack);
  }
}

/** Where a drawing's lowest pixel and the middle of its width fall in a cell, in the cell's device pixels. */
function footprint(c: Cell): [number, number] {
  const W = c.cv.width, Hh = c.cv.height, d = c.g.getImageData(0, 0, W, Hh).data;
  const grass = [0x7d, 0x9b, 0x5e];
  let bottom = 0, left = W, right = 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (Math.abs(d[o] - grass[0]) + Math.abs(d[o + 1] - grass[1]) + Math.abs(d[o + 2] - grass[2]) < 24) continue;
    bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
  }
  return [bottom, (left + right) / 2];
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
  /**
   * The body beside the island's design sheet (docs/aesthetic/10): the sheet's front and back figures with ours at the same
   * height in the game's clothes, then the sheet's face and profile beside our head at the same size.
   */
  async design(who: Who = 'male'): Promise<void> {
    if (!REF10) return;
    const im = new Image(); im.src = REF10; await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight;
    // Where the sheet's figures and heads are, as fractions of the sheet.
    const front = { x0: 0.04, x1: 0.28, y0: 0.02, y1: 0.985 }, back = { x0: 0.3, x1: 0.56, y0: 0.02, y1: 0.985 };
    const face = { x0: 0.61, x1: 0.92, y0: 0.01, y1: 0.56 }, profile = { x0: 0.6, x1: 0.78, y0: 0.56, y1: 0.82 }, nape = { x0: 0.78, x1: 0.94, y0: 0.56, y1: 0.82 };
    const crop = (r: { x0: number; x1: number; y0: number; y1: number }, h: number): HTMLCanvasElement => {
      const sw = (r.x1 - r.x0) * W, sh = (r.y1 - r.y0) * H, w = Math.round((sw * h) / sh);
      const cv = document.createElement('canvas'); cv.width = w * DPR; cv.height = h * DPR; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      cv.getContext('2d')!.drawImage(im, r.x0 * W, r.y0 * H, sw, sh, 0, 0, w * DPR, h * DPR);
      return cv;
    };
    heading(`${who} beside the design sheet (10): the sheet's front and back | ours, front and back, level view, in the game's clothes | the sheet's face, profile and nape | ours`);
    const zoom = 6.5, bodyPx = heightOf(PROPS[who]) * 2.25 * zoom;
    // The sheet's figures stand about 93% of their crop's height (the hair's top to the sandals).
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [{ cv: crop(front, Math.round(bodyPx / 0.93)), label: 'sheet, front' }, { cv: crop(back, Math.round(bodyPx / 0.93)), label: 'sheet, back' }];
    for (const [name, f, deg] of [['front', 0, 0], ['back', 4, 180], ['side', 2, 90]] as Array<[string, number, number]>) {
      const c = cell(zoom, [-41, 3], [-11, 11]);
      drawOne(c, zoom, who, poseOf(f, 'idle:0'), { stance: 'ref', view: levelView((deg * Math.PI) / 180) });
      cells.push({ cv: c.cv, label: `ours, ${name}` });
    }
    row(cells);
    // The heads: the sheet's face is about 2.3 of our units from crown to chin; ours drawn at the zoom that makes them the same.
    const hz = 20, headPx = 2.4 * 2.25 * hz;
    const heads: Array<{ cv: HTMLCanvasElement; label: string }> = [{ cv: crop(face, Math.round(headPx / 0.7)), label: 'sheet, face' }];
    for (const [name, f, deg] of [['front', 0, 0], ['3/4', 7, -40]] as Array<[string, number, number]>) {
      const c = cell(hz, [-40.5, -28], [-7, 7]);
      drawOne(c, hz, who, poseOf(f, 'idle:0'), { stance: 'ref', view: levelView((deg * Math.PI) / 180) });
      heads.push({ cv: c.cv, label: `ours, ${name}` });
    }
    heads.push({ cv: crop(profile, Math.round(headPx / 0.8)), label: 'sheet, profile' });
    { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, poseOf(2, 'idle:0'), { stance: 'ref', view: levelView(Math.PI / 2) }); heads.push({ cv: c.cv, label: 'ours, profile' }); }
    heads.push({ cv: crop(nape, Math.round(headPx / 0.8)), label: 'sheet, nape' });
    { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, poseOf(4, 'idle:0'), { stance: 'ref', view: levelView(Math.PI) }); heads.push({ cv: c.cv, label: 'ours, nape' }); }
    row(heads);
  },
  /**
   * How well our silhouette covers the reference's, at the picture's own size: the picture's two figures masked out of its
   * background, ours drawn over each at the same height, feet and middle, and the overlap over the union -- for the whole,
   * and by region (bands of the height, and the arms as what stands out from the middle).
   */
  async iou(who: Who = 'male'): Promise<Record<string, number>> {
    const female = who === 'female';
    const src = female ? REF9 : REF8;
    if (!src) return {};
    const im = new Image(); im.src = src; await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight;
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const pg = pc.getContext('2d', { willReadFrequently: true })!; pg.drawImage(im, 0, 0);
    const px = pg.getImageData(0, 0, W, H).data;
    const ref = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], v = Math.max(r, g, b);
      const skin = r > 60 && r > g + 8 && g >= b - 6 && r - b > 18;
      const dark = v > 22 && v < 105 && v - Math.min(r, g, b) < 24;
      ref[i] = female ? (v > 24 ? 1 : 0) : (skin || dark ? 1 : 0);
    }
    const out: Record<string, number> = {};
    const views: Array<[string, number, number, number, number]> = [['front', 0, W / 2, -45, 7], ['back', W / 2, W, 135, 3]];
    let inter = 0, union = 0;
    for (const [name, x0, x1, deg, facing] of views) {
      // Opened by a pixel (eroded, then grown back), so the checker's thin edges fall away from the figure.
      const er = new Uint8Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = Math.max(1, x0); x < Math.min(W - 1, x1); x++) { const i = y * W + x; er[i] = ref[i] && ref[i - 1] && ref[i + 1] && ref[i - W] && ref[i + W] ? 1 : 0; }
      for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; ref[i] = er[i] || (x > x0 && er[i - 1]) || (x < x1 - 1 && er[i + 1]) || (y > 0 && er[i - W]) || (y < H - 1 && er[i + W]) ? 1 : 0; }
      // The figure is the largest connected blob of its half; the speckles round the checker are not it.
      const seen = new Int32Array(W * H).fill(-1);
      let best = -1, bestN = 0, label = 0;
      for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
        const i0 = y * W + x; if (!ref[i0] || seen[i0] >= 0) continue;
        const stack = [i0]; seen[i0] = label; let n = 0;
        while (stack.length) {
          const i = stack.pop()!; n++;
          const xx = i % W, yy = (i - xx) / W;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = xx + dx, ny = yy + dy; if (nx < x0 || nx >= x1 || ny < 0 || ny >= H) continue; const j = ny * W + nx; if (ref[j] && seen[j] < 0) { seen[j] = label; stack.push(j); } }
        }
        if (n > bestN) { bestN = n; best = label; }
        label++;
      }
      for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (ref[y * W + x] && seen[y * W + x] !== best) ref[y * W + x] = 0;
      let top = H, bot = -1, left = W, right = -1;
      for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (ref[y * W + x]) { if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x; }
      if (bot < 0) continue;
      const hh = bot - top + 1;
      // The body's middle is the head's: the arms hang to one side of the picture.
      let sx = 0, sn = 0;
      for (let y = top; y < top + hh * 0.1; y++) for (let x = x0; x < x1; x++) if (ref[y * W + x]) { sx += x; sn++; }
      const cx = sn ? sx / sn : (left + right) / 2;
      const zoom = hh / (heightOf(PROPS[who]) * 2.25);
      const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
      const og = oc.getContext('2d', { willReadFrequently: true })!;
      og.fillStyle = '#ff00ff'; og.fillRect(0, 0, W, H);
      const p = { ...poseOf(facing, 'idle:0'), look: lookOf(who) };
      drawSculpt(og, cx, bot + 1, zoom, p, { P: PROPS[who], kind: kindOf(who), dpr: 1, now: 1, wear: 'shorts', stance: 'ref', view: levelView((deg * Math.PI) / 180), ink: 0.5 });
      const ox = og.getImageData(0, 0, W, H).data;
      const ours = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) ours[i] = ox[i * 4] > 240 && ox[i * 4 + 1] < 20 && ox[i * 4 + 2] > 240 ? 0 : 1;
      // Where ours landed against the picture's figure: crown, sole and the head's middle, in the picture's pixels.
      { let oTop = H, oBot = -1, osx = 0, osn = 0;
        for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (ours[y * W + x]) { if (y < oTop) oTop = y; if (y > oBot) oBot = y; }
        for (let y = oTop; y < oTop + (oBot - oTop) * 0.1; y++) for (let x = x0; x < x1; x++) if (ours[y * W + x]) { osx += x; osn++; }
        out[`${name} crown dy`] = oTop - top; out[`${name} sole dy`] = oBot - bot; out[`${name} head dx`] = (osn ? osx / osn : 0) - cx; }
      const score = (test: (x: number, y: number) => boolean): number => {
        let a = 0, u = 0;
        for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { if (!test(x, y)) continue; const r = ref[y * W + x], o = ours[y * W + x]; if (r && o) a++; if (r || o) u++; }
        if (name === 'front' && test === all) { inter += a; union += u; }
        return u ? a / u : 1;
      };
      const all = (): boolean => true;
      const band = (f0: number, f1: number) => (_x: number, y: number): boolean => y >= top + hh * f0 && y < top + hh * f1;
      out[`${name}`] = score(all);
      out[`${name} head`] = score(band(0, 0.13));
      out[`${name} shoulders`] = score(band(0.13, 0.34));
      out[`${name} waist`] = score(band(0.34, 0.56));
      out[`${name} thighs`] = score(band(0.56, 0.78));
      out[`${name} shins`] = score(band(0.78, 0.94));
      out[`${name} feet`] = score(band(0.94, 1.0));
      out[`${name} arms`] = score((x, y) => y >= top + hh * 0.22 && y < top + hh * 0.62 && Math.abs(x - cx) > hh * 0.11);
      // The overlay itself, for the eye: ours in green over the picture.
      const c = cell(1, [-1, 1], [-1, 1]); c.cv.width = W; c.cv.height = H; c.cv.style.width = `${W}px`; c.cv.style.height = `${H}px`;
      const g = c.cv.getContext('2d')!; g.drawImage(pc, 0, 0);
      g.globalAlpha = 0.45; g.globalCompositeOperation = 'source-over';
      const tint = document.createElement('canvas'); tint.width = W; tint.height = H;
      const tg = tint.getContext('2d')!; const td = tg.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { if (ours[i] || ref[i]) { td.data[i * 4] = ref[i] ? 230 : 40; td.data[i * 4 + 1] = ours[i] ? 230 : 40; td.data[i * 4 + 2] = 60; td.data[i * 4 + 3] = 255; } }
      tg.putImageData(td, 0, 0); g.drawImage(tint, 0, 0);
      row([{ cv: c.cv, label: `${name}: ours (green) over the picture, overlap ${(out[name] * 100).toFixed(1)}%` }]);
    }
    for (const k of Object.keys(out)) out[k] = +out[k].toFixed(3);
    return out;
  },
  /**
   * The body against the male reference (docs/aesthetic/08): the picture, then our sculpt bare in the sheet's stance at the
   * picture's two views, at one height; then the picture laid half over our two bodies for the silhouettes; then at game zoom.
   */
  async compare(who: Who = 'male', zoom = 6.5): Promise<void> {
    const female = who === 'female';
    heading(`${who} against the ${female ? 'female' : 'male'} reference at zoom ${zoom}, level view: picture | ours front 3/4, back 3/4, front, side | picture over ours | game zoom 2 (the island's view)`);
    const bodyPx = heightOf(PROPS[who] ?? MALE) * 2.25 * zoom;
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    // The picture's figures stand about 94% of its height (93% in the woman's), feet at 95.5% (96.3%), at 27.5% and 72% across (28%, 73%).
    const [ref, stand, feet, xs, refName] = female ? [REF9, 0.93, 0.963, [0.28, 0.73], '09'] : [REF8, 0.94, 0.955, [0.275, 0.72], '08'];
    const pic = ref ? await img(ref, Math.round(bodyPx / stand)) : null;
    if (pic) cells.push({ cv: pic, label: `reference ${refName}` });
    // The picture's figures are turned about 35 degrees from the viewer, front and back.
    const turns: Array<[string, number, number]> = [['front 3/4', 7, -35], ['back 3/4', 3, 145], ['front', 0, 0], ['side', 2, 90]];
    for (const [name, f, deg] of turns) {
      const c = cell(zoom, [-41, 3], [-11, 11]);
      drawOne(c, zoom, who, poseOf(f, 'idle:0'), { wear: 'shorts', stance: 'ref', view: levelView((deg * Math.PI) / 180) });
      cells.push({ cv: c.cv, label: `ours ${name}` });
    }
    if (pic) {
      // The picture over our front and back views, each stood where the picture's figure stands.
      const over = document.createElement('canvas');
      over.width = pic.width; over.height = pic.height;
      over.style.width = pic.style.width; over.style.height = pic.style.height;
      const g = over.getContext('2d')!;
      g.fillStyle = GRASS; g.fillRect(0, 0, over.width, over.height);
      g.scale(DPR, DPR);
      const w = pic.width / DPR, h = pic.height / DPR;
      const feetY = h * feet;
      for (const [f, x, deg] of [[7, xs[0], -35], [3, xs[1], 145]] as Array<[number, number, number]>) {
        const p = { ...poseOf(f, 'idle:0'), look: lookOf(who) };
        if (!drawSculpt(g, w * x, feetY, zoom, p, { P: PROPS[who] ?? MALE, kind: kindOf(who), dpr: DPR, now: 1, wear: 'shorts', stance: 'ref', view: levelView((deg * Math.PI) / 180) })) drawFigure(g, w * x, feetY, zoom, p);
      }
      g.globalAlpha = 0.5;
      g.drawImage(pic, 0, 0, w, h);
      cells.push({ cv: over, label: 'picture over ours (50%)' });
    }
    row(cells);
    const game: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    for (const f of [7, 1, 3, 5]) {
      const c = cell(2, [-41, 3], [-11, 11]);
      drawOne(c, 2, who, poseOf(f, 'idle:0'), { wear: 'shorts', stance: 'ref' });
      game.push({ cv: c.cv, label: `game zoom 2 f${f}` });
    }
    for (const f of [7, 3]) {
      const c = cell(2, [-41, 3], [-11, 11]);
      drawOne(c, 2, who, poseOf(f, 'idle:0'));
      game.push({ cv: c.cv, label: `game zoom 2 f${f}, clothed, at ease` });
    }
    row(game);
  },
  /**
   * The garment pipeline's sheet: the design sheet's front and back with the garments' traced edges drawn over them (each
   * piece's polyline about its own axis, where our rig at rest puts that axis), ours dressed by the same tracing in the
   * level view, ours with the print library's demonstrations on, and the dressed body at the eight facings.
   */
  async garment(who: Who = 'male'): Promise<void> {
    if (!REF10) return;
    const im = new Image(); im.src = REF10; await im.decode();
    const W = im.naturalWidth, Hh = im.naturalHeight;
    const front = { x0: 0.04, x1: 0.28, y0: 0.02, y1: 0.985 }, back = { x0: 0.3, x1: 0.56, y0: 0.02, y1: 0.985 };
    const zoom = 6.5, bodyPx = HUMAN_HEIGHT * 2.25 * zoom, cropH = Math.round(bodyPx / 0.93);
    const rest = built(PROPS[who], lookOf(who), 'base').rest;
    const traced = (r: { x0: number; x1: number; y0: number; y1: number }, view: 'front' | 'back'): HTMLCanvasElement => {
      const sw = (r.x1 - r.x0) * W, sh = (r.y1 - r.y0) * Hh, w = Math.round((sw * cropH) / sh);
      const cv = document.createElement('canvas'); cv.width = w * DPR; cv.height = cropH * DPR; cv.style.width = `${w}px`; cv.style.height = `${cropH}px`;
      const g = cv.getContext('2d')!;
      g.drawImage(im, r.x0 * W, r.y0 * Hh, sw, sh, 0, 0, w * DPR, cropH * DPR);
      g.scale(DPR, DPR);
      const sv = GARMENT_FILE.sheet[view], figPx = (sv.sole - sv.crown) * cropH, cx = sv.x * w, soleY = sv.sole * cropH;
      const px = (x: number, z: number): [number, number] => [cx + x * figPx, soleY - z * figPx];
      g.lineWidth = 1.5; g.strokeStyle = '#ff2a2a'; g.fillStyle = 'rgba(255,42,42,0.12)';
      for (const gar of Object.values(GARMENT_FILE.garments)) for (const piece of gar.pieces) {
        if (!piece.front) continue;
        for (const k of piece.mirror ? [0, 1] : [0]) {
          const e = piece.chain[0], name = typeof e === 'string' ? e : e[0];
          // The piece's axis across the figure, from our rig at rest, mirrored for the back view.
          let ax = at(rest, piece.mirror ? `${name}${k}` : name)[0] / HUMAN_HEIGHT;
          if (view === 'back') ax = -ax;
          for (const s of [-1, 1]) {
            g.beginPath();
            piece.front.forEach(([x, z], i) => { const [px0, py0] = px(ax + s * x, z); if (i) g.lineTo(px0, py0); else g.moveTo(px0, py0); });
            g.stroke();
          }
        }
      }
      // The figure's crown and sole as the file places them.
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.setLineDash([3, 3]);
      for (const z of [0, 1]) { const [, y] = px(0, z); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.setLineDash([]);
      return cv;
    };
    heading(`${who} garments: the sheet's front and back with the traced edges (red) about our axes | ours dressed by the tracing, level view | ours with the print demonstrations | the eight facings dressed`);
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [{ cv: traced(front, 'front'), label: 'sheet front, traced' }, { cv: traced(back, 'back'), label: 'sheet back, traced' }];
    for (const [name, f, deg] of [['front', 0, 0], ['back', 4, 180], ['side', 2, 90]] as Array<[string, number, number]>) {
      const c = cell(zoom, [-41, 3], [-11, 11]);
      drawOne(c, zoom, who, poseOf(f, 'idle:0'), { stance: 'ref', view: levelView((deg * Math.PI) / 180) });
      cells.push({ cv: c.cv, label: `ours, ${name}` });
    }
    for (const [name, f, deg] of [['front', 0, 0], ['back', 4, 180]] as Array<[string, number, number]>) {
      const c = cell(zoom, [-41, 3], [-11, 11]);
      drawOne(c, zoom, who, poseOf(f, 'idle:0'), { stance: 'ref', view: levelView((deg * Math.PI) / 180), wear: 'prints' });
      cells.push({ cv: c.cv, label: `prints, ${name}` });
    }
    { const c = cell(zoom, [-41, 3], [-11, 11]); drawOne(c, zoom, who, poseOf(0, 'idle:0'), { stance: 'ref', view: levelView(0), debug: 'wire' }); cells.push({ cv: c.cv, label: 'ours, wire' }); }
    row(cells);
    this.facings(who, 'idle:0', 4);
    this.facings(who, 'walk:0.3', 4);
  },
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
  /**
   * Placement against the flat figure: at each zoom and facing, the figure, the sculpt, and the two laid over each other
   * (the sculpt half seen), all with their feet at the same point; and the numbers -- where each one's lowest pixel and
   * the middle of its width fall, and the difference between the two, in screen pixels.
   */
  overlay(who: Who = 'male', zooms: number[] = [1, 2, 4]): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const zoom of zooms) {
      heading(`${who} placement against the flat figure at zoom ${zoom}: figure | sculpt | both (sculpt half seen), feet at one point; dy = sculpt's lowest pixel below the figure's, dx = its middle right of the figure's, screen px`);
      const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
      for (const f of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const a = cell(zoom), b = cell(zoom), c = cell(zoom);
        const pose = poseOf(f, 'idle:0');
        drawFigure(a.g, a.fx, a.fy, zoom, pose);
        drawOne(b, zoom, who, pose);
        drawFigure(c.g, c.fx, c.fy, zoom, pose);
        c.g.globalAlpha = 0.55;
        drawOne(c, zoom, who, pose);
        c.g.globalAlpha = 1;
        const [ab, ax] = footprint(a), [bb, bx] = footprint(b);
        const dy = +((bb - ab) / DPR).toFixed(1), dx = +((bx - ax) / DPR).toFixed(1);
        out[`z${zoom} f${f}`] = [dy, dx];
        cells.push({ cv: a.cv, label: `f${f} figure` }, { cv: b.cv, label: `f${f} sculpt` }, { cv: c.cv, label: `f${f} both dy ${dy} dx ${dx}` });
      }
      row(cells);
    }
    return out;
  },
  /**
   * The island's own path: the figure drawn by `drawFigure` with the "Sculpted figures" switch on, with ids, so it goes
   * through the kept pictures (stills, the idle loop, the stride), and the sculpt lands once its bake is made in idle time.
   * Drawn `frames` times with a wait between, as the island would; the last frame is what is shown.
   */
  async live(who: Who = 'male', zoom = 2, frames = 12): Promise<{ memory: unknown; sculpted: boolean }> {
    const look = lookOf(who);
    sculptedFigures(true);
    const facings = [0, 1, 2, 3, 4, 5, 6, 7];
    const what = ['idle:0', 'walk:0.3', 'idle:0.5', 'walk:0.7'];
    let cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    for (let n = 0; n < frames; n++) {
      cells = [];
      for (const w of what) for (const f of facings) {
        const c = cell(zoom);
        const p = { ...poseOf(f, w), look, id: `live-${w}-${f}`, phase: w.startsWith('walk') ? Number(w.split(':')[1]) * Math.PI * 2 + n * 0.4 : n * 0.3 };
        drawFigure(c.g, c.fx, c.fy, zoom, p);
        cells.push({ cv: c.cv, label: `${w} f${f}` });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    const m = await import('../../src/sculpt/sculpted');
    heading(`${who} through the island's own path (drawFigure, switch on, kept pictures) at zoom ${zoom} after ${frames} frames: ${JSON.stringify(m.sculptMemory())}`);
    row(cells.slice(0, 16));
    row(cells.slice(16));
    return { memory: m.sculptMemory(), sculpted: m.sculptMemory().bakes > 0 };
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
    // A blink: the clock's window lands on an id of thirty-four letters at the sheet's time.
    { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, { ...poseOf(0, 'idle:0'), id: 'studio-blink-xxxxxxxxxxxxxxxxxxxxx' }); heads.push({ cv: c.cv, label: 'head f0 blink' }); }
    { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, poseOf(0, 'idle:0'), { flat: true }); heads.push({ cv: c.cv, label: 'head f0 flat' }); }
    for (const d of ['wire', 'mats', 'bones'] as Debug[]) { const c = cell(hz, [-40.5, -28], [-7, 7]); drawOne(c, hz, who, poseOf(0, 'idle:0'), { debug: d }); heads.push({ cv: c.cv, label: `head f0 ${d}` }); }
    row(heads);
    const hands = [1, 3].flatMap((f) => ['idle:0', 'wave:0.5', 'work:0.5'].map((w) => { const c = cell(hz * 0.6, [-38, -4], [-14, 14]); drawOne(c, hz * 0.6, who, poseOf(f, w)); return { cv: c.cv, label: `hands f${f} ${w}` }; }));
    row(hands);
  },
  /** The hands close: each pose the mitt takes, each hand cropped round where the rig has it. */
  hands(who: Who, zoom = 20): void {
    heading(`${who} hands, zoom ${zoom}: hanging relaxed (idle) and loose (walk), open (wave), a fist (work), pointing, a pinch (claw), cupped; bare-armed where the sleeve would hide them; each hand of the pair`);
    const cells: Array<{ cv: HTMLCanvasElement; label: string }> = [];
    const shots: Array<[number, string, { wear?: Wear; hands?: HandShape }?]> = [
      [1, 'idle:0'], [7, 'idle:0'], [1, 'walk:0.25'], [5, 'walk:0.25'], [1, 'wave:0.5'], [7, 'wave:0.5'],
      [3, 'work:0.5', { wear: 'shorts' }], [1, 'work:0.5', { wear: 'shorts' }],
      [1, 'idle:0', { wear: 'shorts', hands: { point: 1 } }], [7, 'idle:0', { wear: 'shorts', hands: { point: 1 } }],
      [1, 'idle:0', { wear: 'shorts', hands: { claw: 1 } }], [7, 'idle:0', { wear: 'shorts', hands: { cup: 1 } }],
    ];
    const half = 3.2;
    for (const [f, what, o] of shots) {
      const pose = poseOf(f, what);
      const c = cell(zoom);
      drawOne(c, zoom, who, pose, o ?? {});
      // Where each hand is on the cell: the wrist and the knuckles, posed, projected as the renderer projects them.
      const look = lookOf(who), P = PROPS[who];
      const scene = sculptScene({ ...pose, look }, zoom, P, 1, undefined, { wear: o?.wear, hands: o?.hands, kind: kindOf(who) });
      const b = built(P, look, o?.wear ?? 'base', kindOf(who));
      const posed = (name: string): [number, number, number] => { const i = b.order.indexOf(name) * 12, m = scene.bones, t = b.rest[name].t; return [m[i] * t[0] + m[i + 1] * t[1] + m[i + 2] * t[2] + m[i + 3], m[i + 4] * t[0] + m[i + 5] * t[1] + m[i + 6] * t[2] + m[i + 7], m[i + 8] * t[0] + m[i + 9] * t[1] + m[i + 10] * t[2] + m[i + 11]]; };
      for (const k of [0, 1]) {
        const w = posed(`wrist${k}`), kn = posed(`fing${k}`), p = [(w[0] + kn[0]) / 2, (w[1] + kn[1]) / 2, (w[2] + kn[2]) / 2];
        const v = scene.view;
        const sx = c.fx + zoom * (p[0] * v.ex[0] + p[1] * v.ey[0]), sy = c.fy + zoom * (p[0] * v.ex[1] + p[1] * v.ey[1] - p[2] * HEIGHT_SCALE);
        const size = Math.round(half * 2 * zoom);
        const cv = document.createElement('canvas');
        cv.width = size * DPR; cv.height = size * DPR; cv.style.width = `${size}px`; cv.style.height = `${size}px`;
        const g = cv.getContext('2d')!;
        g.fillStyle = GRASS; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(c.cv, (sx - half * zoom) * DPR, (sy - half * zoom) * DPR, size * DPR, size * DPR, 0, 0, size * DPR, size * DPR);
        cells.push({ cv, label: `f${f} ${what}${o?.hands ? ' ' + Object.keys(o.hands).join('') : ''}${o?.wear ? ' bare' : ''} ${k ? 'R' : 'L'}` });
      }
    }
    row(cells);
  },
  /**
   * The bald head alone, bare, level, turned `turn` degrees to screen right, at `px` pixels chin to crown: for the sheets
   * that hold it against the pictures. Returns the chin's and the crown's places on the cell, in CSS pixels.
   */
  headShot(who: Who, turn = 0, px = 520): { chin: [number, number]; crown: [number, number]; w: number; h: number } {
    const look = { ...lookOf(who), hair: 'bald' } as Look, P = PROPS[who];
    const chinOff = P.chin ?? [0, 0, -P.head * 0.9], crownOff = P.crown ?? [0, 0, P.head];
    const zoom = px / ((crownOff[2] - chinOff[2]) * HEIGHT_SCALE);
    const view = levelView((turn * Math.PI) / 180);
    const pose: FigurePose = { ...poseOf(0, 'idle:0'), look };
    const scene = sculptScene(pose, zoom, P, 1, undefined, { wear: 'shorts', stance: 'straight', view, kind: kindOf(who) });
    const b = built(P, look, 'shorts', kindOf(who));
    const posed = (name: string, off: V3): V3 => { const i = b.order.indexOf(name) * 12, m = scene.bones, r = b.rest[name], t: V3 = [r.t[0] + r.m[0] * off[0] + r.m[1] * off[1] + r.m[2] * off[2], r.t[1] + r.m[3] * off[0] + r.m[4] * off[1] + r.m[5] * off[2], r.t[2] + r.m[6] * off[0] + r.m[7] * off[1] + r.m[8] * off[2]]; return [m[i] * t[0] + m[i + 1] * t[1] + m[i + 2] * t[2] + m[i + 3], m[i + 4] * t[0] + m[i + 5] * t[1] + m[i + 6] * t[2] + m[i + 7], m[i + 8] * t[0] + m[i + 9] * t[1] + m[i + 10] * t[2] + m[i + 11]]; };
    const screen = (p: V3): [number, number] => [zoom * (p[0] * view.ex[0] + p[1] * view.ey[0]), zoom * (p[0] * view.ex[1] + p[1] * view.ey[1] - p[2] * HEIGHT_SCALE)];
    const chin = screen(posed('head', chinOff)), crown = screen(posed('head', crownOff));
    const w = Math.ceil(px * 1.3), h = Math.ceil(px * 1.35);
    const c = cell(zoom, [0, h / zoom], [0, w / zoom]);
    // The feet at the point that puts the chin at the cell's lower third, centred.
    const fx = w / 2 - chin[0], fy = h - px * 0.12 - chin[1];
    c.g.fillStyle = GRASS; c.g.fillRect(0, 0, w, h);
    // No ink: the pictures' silhouettes have none, and the overlay measures the body's own edge.
    if (!drawSculpt(c.g, fx, fy, zoom, pose, { P, kind: kindOf(who), dpr: DPR, now: 1, wear: 'shorts', stance: 'straight', view, ink: 0 })) drawFigure(c.g, fx, fy, zoom, pose);
    heading(`${who} head, turned ${turn}, ${px}px chin to crown`);
    row([{ cv: c.cv, label: `head ${turn}` }]);
    return { chin: [fx + chin[0], fy + chin[1]], crown: [fx + crown[0], fy + crown[1]], w, h };
  },
  /** The right hand alone, open and flat, its back to the viewer, `px` pixels from the wrist to the middle fingertip. */
  handShot(who: Who, px = 250): { wrist: [number, number]; tip: [number, number]; w: number; h: number } {
    const look = { ...lookOf(who), hair: 'bald' } as Look, P = PROPS[who];
    const zoom = px / ((P.palm + P.finger) * HEIGHT_SCALE);
    const view = levelView(0);
    const pose: FigurePose = { ...poseOf(0, 'idle:0'), look };
    const hands: HandShape = { flat: 1 };
    const scene = sculptScene(pose, zoom, P, 1, undefined, { wear: 'shorts', stance: 'straight', view, kind: kindOf(who), hands });
    const b = built(P, look, 'shorts', kindOf(who));
    const posed = (name: string, off: V3): V3 => { const i = b.order.indexOf(name) * 12, m = scene.bones, r = b.rest[name], t: V3 = [r.t[0] + r.m[0] * off[0] + r.m[1] * off[1] + r.m[2] * off[2], r.t[1] + r.m[3] * off[0] + r.m[4] * off[1] + r.m[5] * off[2], r.t[2] + r.m[6] * off[0] + r.m[7] * off[1] + r.m[8] * off[2]]; return [m[i] * t[0] + m[i + 1] * t[1] + m[i + 2] * t[2] + m[i + 3], m[i + 4] * t[0] + m[i + 5] * t[1] + m[i + 6] * t[2] + m[i + 7], m[i + 8] * t[0] + m[i + 9] * t[1] + m[i + 10] * t[2] + m[i + 11]]; };
    const screen = (p: V3): [number, number] => [zoom * (p[0] * view.ex[0] + p[1] * view.ey[0]), zoom * (p[0] * view.ex[1] + p[1] * view.ey[1] - p[2] * HEIGHT_SCALE)];
    const wrist = screen(posed('wrist1', [0, 0, 0])), tip = screen(posed('fing1', [0, 0, -P.finger]));
    const w = Math.ceil(px * 1.4), h = Math.ceil(px * 1.6);
    const c = cell(zoom, [0, h / zoom], [0, w / zoom]);
    const fx = w / 2 - wrist[0], fy = h * 0.3 - wrist[1];
    c.g.fillStyle = GRASS; c.g.fillRect(0, 0, w, h);
    if (!drawSculpt(c.g, fx, fy, zoom, pose, { P, kind: kindOf(who), dpr: DPR, now: 1, wear: 'shorts', stance: 'straight', view, hands, ink: 0 })) drawFigure(c.g, fx, fy, zoom, pose);
    heading(`${who} right hand, open, from the back, ${px}px wrist to tip`);
    row([{ cv: c.cv, label: 'hand' }]);
    return { wrist: [fx + wrist[0], fy + wrist[1]], tip: [fx + tip[0], fy + tip[1]], w, h };
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
  stats(who: Who): Record<string, unknown> {
    const b = built(PROPS[who], LOOK, 'base', kindOf(who));
    const out: Record<string, unknown> = { prims: b.model ? b.model.prims.length : 0, bones: b.order.length, boneNames: b.order.join(' ') };
    for (const band of [0, 1, 2] as const) {
      const k = bakedAt(b, band);
      out[`band${band}`] = { cell: CELL[band], grid: k.grid.join('×'), verts: k.nVerts, tris: k.nTris, bakeMs: Math.round(k.ms) };
    }
    return out;
  },
  bench(who: Who, n = 20, frames = 10, zoom = 1): { msPerFrame: number; msPerBody: number; band: number } {
    const c = cell(zoom);
    const poses = Array.from({ length: n }, (_, i) => poseOf(i % 8, i % 2 ? 'walk:0.3' : 'idle:0.2'));
    for (const p of poses) drawSculpt(c.g, c.fx, c.fy, zoom, p, { P: PROPS[who], kind: kindOf(who), dpr: DPR });
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) for (const p of poses) { p.phase += 0.05; drawSculpt(c.g, c.fx, c.fy, zoom, p, { P: PROPS[who], kind: kindOf(who), dpr: DPR, now: f * 0.1 }); }
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
