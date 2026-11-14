// The props of the reading and the lantern clips (src/sculpt/anim/clips/reach.ts), each held in one fist:
//   book_open     an open book, its spine along the fist's grip (study_book);
//   rune_tablet   a stone tablet held by its edge, runes cut in its face (read_rune_tablet);
//   recipe_sheet  a written sheet held by its edge (read_recipe, read_formula);
//   chart         a drawn map held by its edge, folded once (study_map);
//   lantern       a lantern hung from its ring in the fist (fit_lamp);
//   candle        a candle upright in the fist (candle_lamp);
//   taper         a lit spill upright in the fist (light_lamp).
// Written to src/sculpt/assets/<id>.json (tools/sculpt/lowgear.mjs gearAsset).
//
//   node tools/sculpt/gear/reach.mjs [ids...] [--out <dir>]
//
// The frame (game units, the man 16.5 tall): y along the grip from its butt toward the thumb of the fist on it; x along
// the hand toward the knuckles; z = x × y. The reading clips hold the left fist with its knuckles to the body's right and
// its grip up the page, so z looks back at the eyes: the book, the tablet, the sheet and the map are built for the left
// fist (their written faces toward +z, they spread toward +x, the right hand's side) and written mirrored across z
// (`mirror`: drawn mirrored again in the left fist, `src/sculpt/lowpoly.ts` PropAsset.mirror), so a clip played
// left-handed holds their mirror image in the right. The lantern, the candle and the taper are the same either side.

import { meshOf, trisOf } from '../lowgear.mjs';

export const MATS = {
  // leather boards, the pages and their edges, ink
  board: { c: '#7a3f2e' }, boardD: { c: '#5f3024' }, gilt: { c: '#d49a4f' },
  page: { c: '#f2e6c8' }, pageD: { c: '#e0d0aa' }, edge: { c: '#d8c49a' }, ink: { c: '#5a4636' }, red: { c: '#b2462e' },
  // the tablet's stone and its runes
  stone: { c: '#8f877d' }, stoneD: { c: '#746c63' }, stoneL: { c: '#a59d92' }, rune: { c: '#3f3846' },
  // the map: parchment, its fold, the coast and the sea
  parch: { c: '#ead7aa' }, parchD: { c: '#d3bd8c' }, sea: { c: '#9cc2c4' }, coast: { c: '#6d5a44' },
  // the lantern: iron, its glass, the candle in it
  iron: { c: '#4f4a52' }, ironL: { c: '#6d6770' }, glass: { c: '#c8dbe0' }, glassD: { c: '#93aab4' },
  // wax, the wick, the flame (unlit by the scene's light), the spill's wood
  wax: { c: '#f1e4c4' }, waxD: { c: '#dccb9f' }, wick: { c: '#2e2622' }, flame: { c: '#ffd36a', emit: true }, flameC: { c: '#fff6d2', emit: true },
  wood: { c: '#b98a5a' }, woodD: { c: '#946a42' },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A builder over a mesh: points (z negated when `flip`), faces turned to look out. */
function kit(flip) {
  const G = meshOf();
  const k = flip ? -1 : 1;
  const P = (q) => G.p([q[0], q[1], k * q[2]]);
  const out = (o) => (o && o.from ? { from: [o.from[0], o.from[1], k * o.from[2]] } : o ? [o[0], o[1], k * o[2]] : null);
  const F = (v, mat, o) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out(o)); };
  /**
   * A thin board: the quad a (corner), u, v (its two edges), thickened `t` along its normal (u × v, the face `mat.top`
   * looks along); its rim `mat.rim`.
   */
  const board = (a, u, v, t, mat, hint = [0, 0, 1]) => {
    let n = norm(cross(u, v));
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = mul(n, -1);
    const h = mul(n, t / 2);
    const c = [a, add(a, u), add(add(a, u), v), add(a, v)];
    const top = c.map((p) => P(add(p, h))), bot = c.map((p) => P(sub(p, h)));
    const mid = add(a, mul(add(u, v), 0.5));
    F(top, mat.top, n);
    F(bot, mat.bot ?? mat.top, mul(n, -1));
    for (let j = 0; j < 4; j++) F([top[j], top[(j + 1) % 4], bot[(j + 1) % 4], bot[j]], mat.rim ?? mat.top, { from: mid });
  };
  /** A flat mark on a face (a quad a, u, v), standing off it by d along its normal: ink, a rune. */
  const mark = (a, u, v, d, mat, hint = [0, 0, 1]) => {
    let n = mul(norm(cross(u, v)), d);
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = mul(n, -1);
    const c = [a, add(a, u), add(add(a, u), v), add(a, v)].map((p) => P(add(p, n)));
    F(c, mat, n);
  };
  /** Rings of n sides round the y axis (radius r at height y, centre x0, z0), joined, capped at the ends where asked. */
  const lathe = (rows, mat, n = 8, o = {}) => {
    const rings = rows.map(([y, r, x0 = 0, z0 = 0]) => [...Array(n).keys()].map((j) => { const a = ((j + 0.5) * 2 * Math.PI) / n; return P([x0 + r * Math.cos(a), y, z0 + r * Math.sin(a)]); }));
    for (let i = 0; i + 1 < rings.length; i++) {
      const [ya, , xa = 0, za = 0] = rows[i], [yb, , xb = 0, zb = 0] = rows[i + 1], from = [(xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2];
      for (let j = 0; j < n; j++) F([rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]], typeof mat === 'function' ? mat(i, j) : mat, { from });
    }
    if (o.bottom) F([...rings[0]], o.bottom, [0, -1, 0]);
    if (o.top) F([...rings[rings.length - 1]], o.top, [0, 1, 0]);
    return rings;
  };
  return { G, P, F, board, mark, lathe };
}

/* ---- the open book: its spine up the grip, a little out from the fist toward the eyes; the leaves spread either side,
   rising toward their outer edges; the boards under them ---------------------------------------------------------- */
const BOOK = { y0: -0.2, y1: 2.9, w: 2.0, rise: 0.38, z0: 0.22, block: 0.22 };
function book(K) {
  const { board, mark } = K;
  const { y0, y1, w, rise, z0, block } = BOOK, H = y1 - y0, up = [0, H, 0];
  for (const s of [1, -1]) {
    // the board: from the spine out to the edge, a little wider and taller than the leaves
    board([0, y0 - 0.08, z0 - 0.02], [s * (w + 0.1), 0, rise * 1.05], [0, H + 0.16, 0], 0.09, { top: 'boardD', rim: 'board' });
    // the leaves: a block of pages on the board, its top the page read, its edges the page edges
    board([0, y0, z0 + 0.06 + block / 2], [s * w, 0, rise], up, block, { top: 'page', bot: 'pageD', rim: 'edge' });
    // lines of writing on the page, the first a red rubric
    const top = z0 + 0.06 + block + 0.005;
    for (let k = 0; k < 7; k++) {
      const yy = y1 - 0.45 - k * 0.32, x0 = 0.28, x1 = w - 0.28 - (k === 6 ? 0.6 : 0);
      mark([s * x0, yy, top + (rise * x0) / w], [s * (x1 - x0), 0, (rise * (x1 - x0)) / w], [0, 0.09, 0], 0.006, k === 0 ? 'red' : 'ink');
    }
  }
  // the gilt head band at the spine's top and foot
  mark([-0.06, y1 - 0.02, z0 - 0.05], [0.12, 0, 0], [0, 0, 0.3], 0.01, 'gilt');
  return { L: y1, lead: 0.55, radius: 0.16, contact: [w, (y0 + y1) / 2, z0 + rise + block], mirror: true };
}

/* ---- the rune tablet: a slab of stone held by its near edge, its face toward the eyes, runes cut in it ---------- */
const TABLET = { x0: -0.25, x1: 2.45, y0: -0.4, y1: 2.9, t: 0.32 };
function tablet(K) {
  const { board, mark } = K;
  const { x0, x1, y0, y1, t } = TABLET;
  board([x0, y0, 0], [x1 - x0, 0, 0], [0, y1 - y0, 0], t, { top: 'stone', bot: 'stoneD', rim: 'stoneL' });
  // runes: rows of them cut in the face, each a stem and a branch off it (the branch's slant and side by its place)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = x0 + 0.45 + col * 0.5, cy = y1 - 0.75 - row * 0.6, k = row * 4 + col, w = 0.035;
      mark([cx - w, cy, t / 2], [2 * w, 0, 0], [0, 0.36, 0], 0.008, 'rune');
      const dir = [[0.18, 0.12], [0.18, -0.12], [-0.18, 0.12], [-0.18, -0.12]][k % 4], y = cy + 0.08 + 0.1 * ((k * 7) % 3);
      const n = mul(norm([-dir[1], dir[0], 0]), w);
      mark([cx - n[0], y - n[1], t / 2], [dir[0], dir[1], 0], mul(n, 2), 0.008, 'rune');
    }
  }
  return { L: y1, lead: 0.7, radius: 0.18, contact: [x1, (y0 + y1) / 2, t / 2], mirror: true };
}

/* ---- the written sheet: a leaf held by its near edge, written on its face, the far edge curling a little toward the eyes */
const SHEET = { x1: 2.7, y0: -0.4, y1: 3.0 };
function sheet(K) {
  const { board, mark } = K;
  const { x1, y0, y1 } = SHEET, H = y1 - y0, n = 4;
  const zAt = (x) => 0.12 * (x / x1) ** 2;
  for (let i = 0; i < n; i++) {
    const xa = (i / n) * x1, xb = ((i + 1) / n) * x1;
    board([xa - 0.05, y0, zAt(xa)], [xb - xa + 0.02, 0, zAt(xb) - zAt(xa)], [0, H, 0], 0.035, { top: i % 2 ? 'page' : 'pageD', bot: 'pageD', rim: 'edge' });
  }
  for (let k = 0; k < 8; k++) {
    const yy = y1 - 0.5 - k * 0.34, xa = 0.3, xb = x1 - 0.3 - (k % 3 === 2 ? 0.8 : 0);
    mark([xa, yy, zAt(xa) + 0.02], [xb - xa, 0, zAt(xb) - zAt(xa)], [0, 0.09, 0], 0.006, k === 0 ? 'red' : 'ink');
  }
  return { L: y1, lead: 1.2, radius: 0.12, contact: [x1, 1.2, zAt(x1)], mirror: true };
}

/* ---- the map: a wide sheet held by its near edge, folded down its middle, a coast drawn across it ----------------- */
const CHART = { x1: 5.4, y0: -0.9, y1: 3.1 };
function chart(K) {
  const { board, mark } = K;
  const { x1, y0, y1 } = CHART, H = y1 - y0;
  // two halves, a shallow fold between them toward the eyes
  const fold = x1 / 2, zf = 0.18;
  board([-0.05, y0, 0], [fold + 0.05, 0, zf], [0, H, 0], 0.035, { top: 'parch', bot: 'parchD', rim: 'parchD' });
  board([fold, y0, zf], [x1 - fold, 0, -zf], [0, H, 0], 0.035, { top: 'parchD', bot: 'parchD', rim: 'parchD' });
  const zAt = (x) => (x < fold ? (x / fold) * zf : ((x1 - x) / (x1 - fold)) * zf) + 0.022;
  // the sea along the top and a coast down to it, each a patch on the face
  for (let i = 0; i < 7; i++) {
    const xa = 0.35 + i * 0.68, xb = Math.min(x1 - 0.3, xa + 0.66), ya = y1 - 0.4 - 0.5 * Math.abs(Math.sin(i * 1.3)), h = y1 - 0.25 - ya;
    mark([xa, ya, zAt(xa)], [xb - xa, 0, zAt(Math.min(xb, x1)) - zAt(xa)], [0, h, 0], 0.004, 'sea');
    mark([xa, ya - 0.08, zAt(xa)], [xb - xa, 0, zAt(Math.min(xb, x1)) - zAt(xa)], [0, 0.08, 0], 0.006, 'coast');
  }
  // a road across it and a mark where it goes
  for (let i = 0; i < 6; i++) { const xa = 0.5 + i * 0.75; mark([xa, 0.4 + 0.2 * Math.sin(i), zAt(xa)], [0.5, 0, zAt(xa + 0.5) - zAt(xa)], [0, 0.07, 0], 0.006, 'ink'); }
  mark([x1 - 1.0, 0.45, zAt(x1 - 1.0)], [0.3, 0, 0], [0, 0.3, 0], 0.008, 'red');
  return { L: y1, lead: 1.1, radius: 0.12, contact: [x1, 1.1, 0], mirror: true };
}

/* ---- the lantern: an iron frame of four panes under a pyramid cap and its ring, held up from under its foot: the fist
   closed on the bar under the base plate, the lantern standing on the knuckles along +x (up, as the arm lifts it) ---- */
/** The kit's lantern at a hand's size (src/render/kit/lamps.ts lantern, k 1): its plate, its glass's height and half width, its cap. */
const LANTERN = { foot: 0.3, plate: 0.4, half: 1.2, glass: 3.4, cap: 1.7 };
function lantern(K) {
  const { P, F, lathe } = K;
  const { foot, plate, half, glass, cap } = LANTERN;
  // the bar under the base plate, through the fist
  lathe([[-0.45, 0.08, 0.12, 0], [0.45, 0.08, 0.12, 0]], 'iron', 6);
  // up from the knuckles along +x: the plate, the panes, the cap to its peak, the ring over it
  const c = foot, b = c + plate, a = b + glass, top = a + cap;
  const sq = (x, h) => [[x, -h, -h], [x, h, -h], [x, h, h], [x, -h, h]].map(([xx, yy, zz]) => P([xx, yy, zz]));
  const peak = P([top, 0, 0]), eave = sq(a, half + 0.35), p0 = sq(a, half), p1 = sq(b, half), base = sq(b, half + 0.2), sole = sq(c, half + 0.2);
  for (let j = 0; j < 4; j++) {
    const j1 = (j + 1) % 4;
    F([peak, eave[j], eave[j1]], j % 2 ? 'ironL' : 'iron', { from: [a - 0.1, 0, 0] });
    F([p0[j], p0[j1], p1[j1], p1[j]], j % 2 ? 'glass' : 'glassD', { from: [(a + b) / 2, 0, 0] });
    F([base[j], base[j1], sole[j1], sole[j]], 'iron', { from: [(b + c) / 2, 0, 0] });
  }
  F([...eave], 'iron', [-1, 0, 0]);
  F([...sole], 'iron', [-1, 0, 0]);
  // the bar's ends up to the sole, and the ring on the peak
  for (const y of [-0.42, 0.42]) K.board([0.05, y - 0.04, -0.04], [c - 0.05, 0, 0], [0, 0.08, 0], 0.08, { top: 'iron' });
  K.board([top - 0.1, -0.4, -0.06], [1.05, 0, 0], [0, 0.8, 0], 0.12, { top: 'ironL', rim: 'iron' }, [0, 0, 1]);
  return { L: 0.45, lead: 0, radius: 0.08, contact: [top + 0.95, 0, 0] };
}

/* ---- the candle: upright out of the fist past the thumb, its wick at the top ------------------------------------- */
function candle(K) {
  const { lathe } = K;
  lathe([[-0.25, 0.2], [1.55, 0.2], [1.62, 0.15]], (i, j) => (j % 2 ? 'wax' : 'waxD'), 8, { bottom: 'waxD', top: 'wax' });
  lathe([[1.6, 0.03], [1.85, 0.025]], 'wick', 4, { top: 'wick' });
  return { L: 1.85, lead: 0.35, radius: 0.2, contact: [0, 1.85, 0] };
}

/* ---- the taper: a thin spill of wood upright in the fist, lit at its tip --------------------------------------- */
function taper(K) {
  const { lathe } = K;
  lathe([[-0.3, 0.07], [2.3, 0.05]], (i, j) => (j % 2 ? 'wood' : 'woodD'), 5, { bottom: 'woodD' });
  // the flame: a drop over the tip, its heart paler
  lathe([[2.25, 0.04], [2.42, 0.17], [2.62, 0.13], [2.85, 0.02]], 'flame', 6, { bottom: 'flame', top: 'flame' });
  lathe([[2.33, 0.03], [2.45, 0.09], [2.6, 0.02]], 'flameC', 5, { bottom: 'flameC', top: 'flameC' });
  return { L: 2.85, lead: 0.3, radius: 0.08, contact: [0, 2.45, 0] };
}

const BUILD = { book_open: book, rune_tablet: tablet, recipe_sheet: sheet, chart, lantern, candle, taper };
/** The props built mirrored across z (made for the left fist, drawn mirrored again there: `PropAsset.mirror`). */
const FLIP = new Set(['book_open', 'rune_tablet', 'recipe_sheet', 'chart']);
export const IDS = Object.keys(BUILD);

export function build(id) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`reach: no prop ${id}`);
  const K = kit(FLIP.has(id)), r = fn(K), G = K.G;
  G.A = G.V.map(() => 1);
  const c = FLIP.has(id) ? [r.contact[0], r.contact[1], -r.contact[2]] : r.contact;
  return {
    id, G, MATS, L: r.L, tris: trisOf(G).length, all: trisOf(G).length, mirror: !!r.mirror,
    grip: { axis: [0, 1, 0], lead: [0, r.lead, 0], second: [0, r.lead, 0], radius: r.radius, edge: [1, 0, 0], face: [0, 0, 1], from: r.lead - 0.4, to: r.lead + 0.4 },
    fit: { backMax: 0.4 }, contact: c, ends: [c],
  };
}

export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id);
  const a = await gearAsset(id, plain, plain, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.built = `node tools/sculpt/gear/reach.mjs ${id} (tools/sculpt/lowgear.mjs gearAsset)`;
  a.units = 'game units; its own frame: y along what the fist closes on toward the thumb, x along the hand toward the knuckles, z = x × y';
  a.contact = plain.contact.map(r5);
  a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = 0;
  if (plain.mirror) a.mirror = true;
  if (a.glowFrom < 0) a.glowFrom = a.polys.length;
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles, ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
