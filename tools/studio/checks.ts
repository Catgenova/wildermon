/**
 * What a drawing is judged on, read off its pixels: the rules in
 * `docs/aesthetic.md` and `docs/kit-pieces.md` that a picture can be held to.
 * Each check names what it measured, so a failure says which cell and by how
 * much rather than only "no".
 *
 * Two registers (`docs/aesthetic.md`, "The painting"): `line` for figures,
 * creatures and things you use, where the silhouette is inked and facet mottle
 * is a faint grain; `paint` for the world, where there is little or no line and
 * broken colour is wanted. A check that only holds for one register is skipped
 * in the other.
 */
import type { Register } from './families';

export interface Check {
  id: string;
  ok: boolean | null;
  /** What was measured, in a line. */
  said: string;
  /** Which cell it was measured on. */
  cell: string;
}

type RGBA = Uint8ClampedArray;

/** Hue, saturation and lightness of a pixel, 0..1 (hue in degrees). */
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const median = (xs: number[]): number => (xs.length ? xs.slice().sort((a, b) => a - b)[xs.length >> 1] : NaN);
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/** The opaque pixels of a drawing on a clear ground, as what each check reads. */
export interface Read {
  w: number;
  h: number;
  d: RGBA;
  /** Of every solid pixel (a soft shadow's few are left out): index, hue, saturation, lightness, and whether it is on the outside edge. */
  px: Array<{ i: number; h: number; s: number; l: number; edge: boolean }>;
  box: [number, number, number, number] | null;
}

export function read(img: ImageData): Read {
  const { width: w, height: h, data: d } = img;
  const px: Read['px'] = [];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] <= 40) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (d[i + 3] < 200) continue;
      const [hh, s, l] = hsl(d[i], d[i + 1], d[i + 2]);
      const edge = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
      px.push({ i, h: hh, s, l, edge });
    }
  }
  return { w, h, d, px, box: x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1] };
}

/**
 * The checks on one drawing by day: ink, black, white, the base palette, the
 * splash, coloured shadow, tinted highlight, the inked silhouette, the key
 * light from the left, and the facet mottle.
 */
export function judgeDay(r: Read, register: Register, cell: string, expectSplash: boolean, splashy = false): Check[] {
  const out: Check[] = [];
  const n = r.px.length;
  if (!n) return [{ id: 'drawn', ok: false, said: 'nothing drawn', cell }];
  const ls = r.px.map((p) => p.l);
  const sorted = ls.slice().sort((a, b) => a - b);
  // The ink: the darkest few percent, and anything as dark as a line is (a small thing at a small zoom is a lot of line) -- but never more than half of it.
  const inkCut = Math.min(Math.max(sorted[Math.floor(n * 0.04)], 0.22), sorted[Math.floor(n * 0.5)] - 1e-6);
  const ink = r.px.filter((p) => p.l <= inkCut);
  const body = r.px.filter((p) => p.l > inkCut);

  // Pure black and pure white do not appear.
  const black = r.px.filter((p) => r.d[p.i] < 18 && r.d[p.i + 1] < 18 && r.d[p.i + 2] < 18).length / n;
  out.push({ id: 'no-black', ok: black < 0.004, said: `pure black ${pct(black)} of pixels`, cell });
  const white = r.px.filter((p) => r.d[p.i] > 250 && r.d[p.i + 1] > 250 && r.d[p.i + 2] > 250).length / n;
  out.push({ id: 'no-white', ok: white < 0.004, said: `pure white ${pct(white)} of pixels`, cell });

  // Ink: a deep hue of the surface's own colour, never grey or black.
  const inkS = median(ink.map((p) => p.s)), inkL = median(ink.map((p) => p.l));
  out.push({ id: 'ink-own-colour', ok: inkS > 0.08 && inkL > 0.04, said: `darkest 4%: saturation ${inkS.toFixed(2)}, lightness ${inkL.toFixed(2)}`, cell });

  // Base: the kit's pastel. The body's mid-tones in pastel()'s range, nothing darker than slate past the shadows.
  const bodyL = median(body.map((p) => p.l)), bodyS = median(body.map((p) => p.s));
  const slate = body.filter((p) => p.l < 0.3).length / Math.max(1, body.length);
  out.push({ id: 'base-pastel', ok: bodyL >= 0.42 && bodyL <= 0.93 && slate < 0.2, said: `body lightness ${bodyL.toFixed(2)} (pastel 0.48 to 0.93), ${pct(slate)} darker than slate`, cell });
  out.push({ id: 'base-colour', ok: bodyS >= 0.12, said: `body saturation ${bodyS.toFixed(2)} (chalk is above 0.12)`, cell });

  // Splash: fully saturated colour, a tenth of the area or less, and some of it where the family expects one.
  const splash = body.filter((p) => p.s > 0.62 && p.l > 0.3 && p.l < 0.85).length / Math.max(1, body.length);
  out.push({ id: 'splash-bounded', ok: splashy ? null : splash <= 0.15, said: `saturated ${pct(splash)} of the body (a splash is a tenth or less${splashy ? '; this family is the splash' : ''})`, cell });
  if (expectSplash) out.push({ id: 'splash-present', ok: splash > 0.005, said: `saturated ${pct(splash)}: a splash is expected on this family`, cell });

  // Shadows a colour, not grey: the darker third of the body keeps its saturation.
  const dark = body.filter((p) => p.l < bodyL - 0.12);
  const darkS = median(dark.map((p) => p.s));
  out.push({ id: 'shadow-coloured', ok: dark.length < 20 || darkS > 0.12, said: `shadow saturation ${Number.isNaN(darkS) ? '-' : darkS.toFixed(2)} over ${dark.length} px`, cell });
  // Highlights tinted: the brightest tenth is not grey-white.
  const bright = body.filter((p) => p.l > 0.86);
  const brightS = median(bright.map((p) => p.s));
  out.push({ id: 'highlight-tinted', ok: bright.length < 20 || brightS > 0.05, said: `highlight saturation ${Number.isNaN(brightS) ? '-' : brightS.toFixed(2)} over ${bright.length} px`, cell });

  // The silhouette: inked round for the line register; faint or none for paint.
  const edges = r.px.filter((p) => p.edge);
  const inkedEdge = edges.filter((p) => p.l <= inkCut + 0.08).length / Math.max(1, edges.length);
  if (register === 'line') out.push({ id: 'silhouette-inked', ok: inkedEdge >= 0.45, said: `${pct(inkedEdge)} of the outside edge is ink`, cell });
  else out.push({ id: 'silhouette-soft', ok: null, said: `${pct(inkedEdge)} of the outside edge is ink (paint wants little or none)`, cell });

  // The key light from over the viewer's left shoulder: the left of the body paler than the right.
  if (r.box) {
    const [x0, , x1] = r.box, third = (x1 - x0) / 3;
    const left = body.filter((p) => (p.i / 4) % r.w < x0 + third), right = body.filter((p) => (p.i / 4) % r.w > x1 - third);
    const lL = median(left.map((p) => p.l)), rL = median(right.map((p) => p.l));
    out.push({ id: 'lit-from-left', ok: register === 'paint' || left.length < 20 || right.length < 20 ? null : lL >= rL - 0.02, said: `left lightness ${lL.toFixed(2)}, right ${rL.toFixed(2)}${register === 'paint' ? ' (the world is lit by the sun at its hour)' : ''}`, cell });
  }

  return out;
}

/** The night: washed blue-violet, and whatever is emissive still bright in its own colour. */
export function judgeNight(day: Read, night: Read, cell: string, emissive: boolean): Check[] {
  const out: Check[] = [];
  if (!day.px.length || !night.px.length) return out;
  const dL = median(day.px.map((p) => p.l)), nL = median(night.px.map((p) => p.l));
  let rSum = 0, bSum = 0;
  for (const p of night.px) { rSum += night.d[p.i]; bSum += night.d[p.i + 2]; }
  // Darker and bluer under the wash; a thing that throws its own warm light is only asked to be darker.
  out.push({ id: 'night-washed', ok: nL < dL * 0.8 && (emissive || bSum > rSum), said: `lightness ${dL.toFixed(2)} by day, ${nL.toFixed(2)} by night; blue ${bSum > rSum ? 'over' : 'under'} red${emissive ? ' (its own light counted)' : ''}`, cell });
  const glowing = night.px.filter((p) => p.l > 0.62 && p.s > 0.25).length;
  if (emissive) out.push({ id: 'emissive-at-night', ok: glowing > 4, said: `${glowing} px bright and coloured through the wash`, cell });
  else out.push({ id: 'emissive-at-night', ok: null, said: `${glowing} px bright through the wash (nothing declared emissive)`, cell });
  return out;
}

/** A motion: its frames differ. An optional move (one not every kind has) that does not move is no fault. */
export function judgeMotion(a: Read, b: Read, id: string, cell: string, optional = false): Check {
  if (a.w !== b.w || a.h !== b.h) return { id: `motion-${id}`, ok: true, said: 'frames differ in size', cell };
  let diff = 0;
  for (let i = 0; i < a.d.length; i += 4) {
    // The least change a pixel can show: a candle's lean of a fraction of a pixel moves a few by a few steps.
    if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) + Math.abs(a.d[i + 3] - b.d[i + 3]) > 8) diff++;
  }
  const share = diff / Math.max(1, Math.max(a.px.length, b.px.length));
  // A candle's lean is a few pixels of a lamp post: any change at all is a move; none is a still.
  if (optional && diff === 0) return { id: `motion-${id}`, ok: null, said: 'no move of this kind (not every kind has one)', cell };
  return { id: `motion-${id}`, ok: diff > 0, said: `${diff} px (${pct(share)} of the body) change between frames`, cell };
}

/** The declared box holds what was drawn (the clipping tools/bodies.ts catches): nothing past it by more than a pixel or two. */
export function judgeBox(r: Read, declared: [number, number, number, number] | null, cell: string): Check {
  if (!r.box || !declared) return { id: 'box-declared', ok: null, said: declared ? 'nothing drawn' : 'no box declared', cell };
  const slack = 2;
  const [l, t, rr, b] = declared, [x0, y0, x1, y1] = r.box;
  const out = Math.max(l - x0, t - y0, x1 - rr, y1 - b);
  return { id: 'box-declared', ok: out <= slack, said: out <= 0 ? 'inside its box' : `${out.toFixed(0)} px past its declared box`, cell };
}

/** Two drawings of the same thing agree (a kept picture and a fresh draw; two calls with the same clock). */
export function judgeSame(a: Read, b: Read, cell: string): Check {
  if (!a.box || !b.box) return { id: 'kept-matches-drawn', ok: null, said: 'nothing to compare', cell };
  const slip = Math.max(...a.box.map((v, i) => Math.abs(v - b.box![i])));
  const share = b.px.length / Math.max(1, a.px.length);
  return { id: 'kept-matches-drawn', ok: slip <= 1 && share > 0.97 && share < 1.03, said: `edges slip ${slip} px, ink ${pct(share)} of the first`, cell };
}

/**
 * Facet mottle, read close up (zoom 6 or so, where a facet is many pixels
 * across): of the pixels inside a facet (no neighbour across an edge), how
 * many have a neighbour a little different -- broken colour -- rather than
 * the same. Ligne claire wants flat colour with a faint grain; paint wants
 * broken colour.
 */
export function judgeMottle(r: Read, register: Register, cell: string): Check {
  const { w, d } = r;
  const most = (i: number, x: number, y: number): number => {
    let mx = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = ((y + dy) * w + x + dx) * 4;
      if (d[j + 3] < 200) return 999;
      mx = Math.max(mx, Math.abs(d[j] - d[i]) + Math.abs(d[j + 1] - d[i + 1]) + Math.abs(d[j + 2] - d[i + 2]));
    }
    return mx;
  };
  // First the edges between facets and the ink (a big step), then the inside, kept a pixel off any edge so an edge's soft ramp is not read as grain.
  const edge = new Uint8Array(w * r.h);
  for (const p of r.px) {
    const x = (p.i / 4) % w, y = Math.floor(p.i / 4 / w);
    if (x < 1 || y < 1 || x >= w - 1 || y >= r.h - 1 || p.edge) { edge[y * w + x] = 1; continue; }
    if (most(p.i, x, y) >= 48) edge[y * w + x] = 1;
  }
  let flat = 0, grain = 0;
  for (const p of r.px) {
    const x = (p.i / 4) % w, y = Math.floor(p.i / 4 / w);
    if (x < 2 || y < 2 || x >= w - 2 || y >= r.h - 2) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (edge[(y + dy) * w + x + dx]) { near = true; break; }
    if (near) continue;
    if (most(p.i, x, y) <= 12) flat++; else grain++;
  }
  const inside = flat + grain;
  const share = inside ? grain / inside : 0;
  if (inside < 200) return { id: register === 'paint' ? 'mottle-painted' : 'mottle-grain', ok: null, said: 'too small to read its facets', cell };
  if (register === 'paint') return { id: 'mottle-painted', ok: share >= 0.2, said: `${pct(share)} of the inside of its facets is broken colour (paint wants a fifth or more)`, cell };
  return { id: 'mottle-grain', ok: share <= 0.6, said: `${pct(share)} of the inside of its facets is broken colour (ligne claire wants flat colour, a faint grain at most)`, cell };
}
