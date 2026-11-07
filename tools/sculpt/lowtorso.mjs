// The low-poly torsos (male and female) for the reference sheets in tools/sculpt/TORSO_SPEC.md and
// tools/sculpt/TORSO_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs --torso and fitted by tools/sculpt/lowtfit.mjs:
//
//   node tools/sculpt/lowtorso.mjs [--who male|female]     # prints the triangle counts and checks the mesh is closed
//
// Units are the low-poly head's (tools/sculpt/lowhead.mjs): y up (the chin's underside at 0), z forward, x the body's
// left (the viewer's right in the front view). The torso begins at the head's neck foot, its ring nm0..nm5, taken from
// the head itself, so head plus torso is one continuous body: joined (buildLowBody), the torso replaces the head's
// shoulder stub and the head's neck replaces the torso's own neck. The torso's neck (part 'neck', from that ring up to a
// flat cut) is drawn only when the torso is shown alone, as the sheets show it.
//
// One half authored by name and mirrored. The surface is a grid of rows round the body, top to bottom (tr the
// trapezius and the clavicles; sd the shoulders' widest; da db dc the arm's cut from its top to the armpit, at the front
// the pectorals or the breasts from their top to their lower edge; ra rb rc the ribs and the abs; wa the waist; hi the
// hips' top; hw the hips' widest; bt the bottom cut's edge), each of nine columns from the front's centre line (0) round
// the side (4) to the back's centre line (8): 1 and 2 the front's planes (the abs' edge, the obliques' line), 3 the front's
// corner, 5 the back's corner, 6 and 7 the back's planes (the shoulder blades' and the lats' line, the spine's muscles).
// Cut flat: the neck's top, each arm (one face on rows da db dc, columns 3 to 5, as the sheets draw it), the hips.
// Her breasts: on rows da db dc, columns 0 to 2, a dome of facets round the point db1: its foot on the chest the grid's
// eight points round the patch with points between (P.breastRing), a middle ring br0.. derived from the foot (P.dome).
//
// Parts: torso (counted against the 400-800 triangle budget with the neck), neck. Regions, for the planes panel:
// shoulder, chest, abdomen, pelvis.

import { existsSync, readFileSync } from 'node:fs';
import { PRESETS as HEADS, buildLowHead } from './lowhead.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mx = (p) => [-p[0], p[1], p[2]];

export const ROWS = ['tr', 'sd', 'da', 'db', 'dc', 'ra', 'rb', 'rc', 'wa', 'hi', 'hw', 'bt'];
export const COLS = 9;
/** The head's neck foot, one half: nm0 at the front's centre line round to nm5 at the back's. */
export const NECK_FOOT = ['nm0', 'nm1', 'nm2', 'nm3', 'nm4', 'nm5'];
// Each of the neck foot's points meets the column of tr with this index; the columns between them close in triangles.
const FOOT_COL = [0, 1, 2, 4, 6, 8];
const ARM = { rows: ['da', 'db', 'dc'], cols: [3, 4, 5] };
const BREAST = { rows: ['da', 'db', 'dc'], cols: [0, 1, 2] };
// The grid's points round the breast's patch, in order round its foot; P.breastRing may add points between them.
const BREAST_GRID = ['da0', 'da1', 'da2', 'db2', 'dc2', 'dc1', 'dc0', 'db0'];
const breastRing = (P) => P.breastRing ?? BREAST_GRID;
/** The breast's middle ring: its foot drawn toward the point (P.dome.mu of the way out from it) and moved by P.dome.d, so
 * each facet between the two rings has two parallel sides and stays flat. */
// P.dome.e: an offset more, by how far below the point each foot point lies (in the foot's own height, -1 at its top,
// 1 at its bottom), so the breast's upper slope runs straight to the point and its underside rounds; the facets between
// the rings are then two triangles each.
export function domeRing(P, V) {
  const A = V.db1, { mu, d, e } = P.dome, ring = breastRing(P);
  const ys = ring.map((b) => V[b][1]), half = (Math.max(...ys) - Math.min(...ys)) / 2, mid = (Math.max(...ys) + Math.min(...ys)) / 2;
  return Object.fromEntries(ring.map((b, k) => {
    const s = e ? (mid - V[b][1]) / half : 0;
    return [`br${k}`, [0, 1, 2].map((q) => A[q] + mu * (V[b][q] - A[q]) + d[q] + (e ? e[q] * s : 0))];
  }));
}

/** The faces of one half, by vertex name: { v: names, part, name }. The grid's cells are keyed by their upper row and
 * left column ('da2' the cell from da2 down to db3); the faces from the neck's foot 'nb0'..'nb4' (with 'nb2t' and so
 * on for the triangles closing a column between). P.merge lists the groups of cells (or of those faces) that are one
 * plane in the reference: each becomes one polygon round the group's outline, its inner vertices left out. */
export function halfFaces(P) {
  const breasts = !!P.breasts;
  const F = new Map();
  const f = (key, v, part, name) => F.set(key, { v, part, name: name ?? v.join('-') });
  // the neck, standing alone: from the foot up to the flat cut nt0..nt5
  for (let i = 0; i < 5; i++) f(`nk${i}`, [NECK_FOOT[i], NECK_FOOT[i + 1], `nt${i + 1}`, `nt${i}`], 'neck');
  // from the neck's foot to tr: a quad where the columns meet one to one, else a triangle to the column between and a quad
  for (let i = 0; i < 5; i++) {
    const a = NECK_FOOT[i], b = NECK_FOOT[i + 1], ja = FOOT_COL[i], jb = FOOT_COL[i + 1];
    if (jb - ja === 1) f(`nb${i}`, [a, b, `tr${jb}`, `tr${ja}`], 'torso');
    else { f(`nb${i}t`, [a, `tr${ja + 1}`, `tr${ja}`], 'torso'); f(`nb${i}`, [a, b, `tr${jb}`, `tr${ja + 1}`], 'torso'); }
  }
  const inArm = (r, j) => ARM.rows.indexOf(r) >= 0 && ARM.rows.indexOf(r) < 2 && j >= ARM.cols[0] && j < ARM.cols[2];
  const inBreast = (r, j) => breasts && BREAST.rows.indexOf(r) >= 0 && BREAST.rows.indexOf(r) < 2 && j >= BREAST.cols[0] && j < BREAST.cols[2];
  for (let i = 0; i + 1 < ROWS.length; i++) for (let j = 0; j < COLS - 1; j++) {
    const r = ROWS[i], s = ROWS[i + 1];
    if (inArm(r, j) || inBreast(r, j)) continue;
    const k = `${r}${j}`, A = `${r}${j}`, B = `${r}${j + 1}`, C = `${s}${j + 1}`, D = `${s}${j}`;
    // P.split: a cell the reference cuts on a diagonal, two triangles: 'a' the lower left one, 'b' the upper right
    // (the diagonal from its upper left corner, or with '/' from its upper right)
    const sp = (P.split ?? []).find((x) => x.replace('/', '') === k);
    if (!sp) f(k, [A, B, C, D], 'torso');
    else if (sp.includes('/')) { f(k + 'a', [A, B, D], 'torso'); f(k + 'b', [B, C, D], 'torso'); }
    else { f(k + 'a', [A, C, D], 'torso'); f(k + 'b', [A, B, C], 'torso'); }
  }
  // the arm's cut: one flat face
  f('arm', ['da3', 'da4', 'da5', 'db5', 'dc5', 'dc4', 'dc3', 'db3'], 'torso', 'arm cut');
  if (breasts) {
    // the breast's foot on the chest (BREAST_RING: the grid's eight points round the patch and the extra points between
    // them), a middle ring br0.. one to one with it, the point db1
    const B = breastRing(P), n = B.length;
    // an extra point lies on the edge between the grid points either side of it: the grid's faces there take it too
    const grid = new Set(BREAST_GRID);
    for (let k = 0; k < n; k++) {
      if (!grid.has(B[k]) || grid.has(B[(k + 1) % n])) continue;
      const run = [];
      let e = (k + 1) % n;
      for (; !grid.has(B[e]); e = (e + 1) % n) run.push(B[e]);
      const u = B[k], w = B[e];
      for (const face of F.values()) {
        const m = face.v.length;
        for (let i = 0; i < m; i++) {
          const a = face.v[i], b = face.v[(i + 1) % m];
          if (a === u && b === w) { face.v.splice(i + 1, 0, ...run); break; }
          if (a === w && b === u) { face.v.splice(i + 1, 0, ...[...run].reverse()); break; }
        }
      }
    }
    // P.fan: a cell that takes extra points cut into triangles from one of its corners, { cell: corner }
    for (const [key, at] of Object.entries(P.fan ?? {})) {
      const face = F.get(key), i = face.v.indexOf(at), v = [...face.v.slice(i), ...face.v.slice(0, i)];
      F.delete(key);
      for (let t = 1; t + 1 < v.length; t++) f(`${key}f${t}`, [v[0], v[t], v[t + 1]], face.part);
    }
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      if (P.dome?.e) { f(`bq${k}`, [B[k], B[k1], `br${k1}`], 'torso'); f(`bq${k}u`, [B[k], `br${k1}`, `br${k}`], 'torso'); F.get(`bq${k}u`).region = 'chest'; }
      else f(`bq${k}`, [B[k], B[k1], `br${k1}`, `br${k}`], 'torso');
      f(`bt${k}`, [`br${k}`, `br${k1}`, 'db1'], 'torso');
      F.get(`bq${k}`).region = F.get(`bt${k}`).region = 'chest';
    }
  }
  // P.navel: a notch in the centre line at the vertex 'at', which sinks to its pit, with a point above it ('top'), below it
  // ('bottom') and to each side ('side'); the cells above and below it ('cells') take them in its place
  if (P.navel) {
    const { at, top, bottom, side, cells: [above, below] } = P.navel;
    const swap = (key, put) => { const face = F.get(key), i = face.v.indexOf(at); face.v.splice(i, 1, ...put); };
    swap(above, [side, top]);
    swap(below, [bottom, side]);
    f('navel top', [top, side, at], 'torso');
    f('navel bottom', [side, bottom, at], 'torso');
    F.get('navel top').region = F.get('navel bottom').region = 'abdomen';
  }
  // the reference's single planes: each group's cells one polygon, round the outline of their union
  for (const { name, cells, region } of P.merge ?? []) {
    const edges = new Map();
    for (const c of cells) {
      const face = F.get(c);
      if (!face) throw new Error(`merge ${name}: no cell ${c}`);
      F.delete(c);
      face.v.forEach((u, i) => {
        const w = face.v[(i + 1) % face.v.length];
        if (edges.has(`${w}>${u}`)) edges.delete(`${w}>${u}`); else edges.set(`${u}>${w}`, [u, w]);
      });
    }
    const next = new Map([...edges.values()].map(([u, w]) => [u, w]));
    if (next.size !== edges.size) throw new Error(`merge ${name}: its outline is not one loop`);
    const start = next.keys().next().value, loop = [start];
    for (let u = next.get(start); u !== start; u = next.get(u)) { loop.push(u); if (loop.length > next.size) throw new Error(`merge ${name}: open outline`); }
    if (loop.length !== next.size) throw new Error(`merge ${name}: its outline is more than one loop`);
    F.set(name, { v: loop, part: 'torso', name, region });
  }
  return [...F.values()];
}
/** The faces across the centre line, emitted once; a name with ' is the other side's vertex. */
export function spanFaces() {
  const ring = (p, n) => [...Array.from({ length: n }, (_, i) => `${p}${i}`), ...Array.from({ length: n - 2 }, (_, i) => `${p}${n - 2 - i}'`)];
  return [
    { v: ring('nt', 6), part: 'neck', name: 'neck cut' },
    { v: ring('bt', 9), part: 'torso', name: 'hip cut' },
  ];
}

/** The region of a face, for the planes panel: shoulder, chest, abdomen or pelvis. */
function regionOf(name, who) {
  if (name.startsWith('nt') || name === 'neck cut' || name.startsWith('nm')) return 'shoulder';
  const m = name.match(/^([a-z]{2})(\d)/);
  if (!m) return name === 'hip cut' ? 'pelvis' : name === 'arm cut' ? 'shoulder' : 'chest';
  const r = ROWS.indexOf(m[1]), j = +m[2];
  if (name.startsWith('br') || (who === 'female' && name.startsWith('da') && j < 2)) return 'chest';
  if (r <= 1) return j >= 1 && j <= 1 && r === 1 ? 'chest' : 'shoulder';
  if (r <= 3) return j <= 1 || (j === 2 && r <= 3) ? 'chest' : 'shoulder';
  if (r === 4) return j <= 2 ? 'abdomen' : j >= 6 ? 'abdomen' : 'abdomen';
  if (r >= 8) return 'pelvis';
  return 'abdomen';
}

/* ---- the two torsos --------------------------------------------------------------------------------------------- */
// A row below the arms: half-width W, the front's z F and the back's B at height y; the columns' share of W
// (front and back) and how square the section is (n: 2 an ellipse, higher squarer).
const SHARE = [0, 0.55, 0.8, 0.95, 1, 0.94, 0.7, 0.36, 0];
function ring(row, y, W, F, B, n = 2.6, dy = []) {
  const zc = (F + B) / 2, af = F - zc, ab = zc - B, out = {};
  for (let j = 0; j < COLS; j++) {
    const t = SHARE[j], g = Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
    const z = j < 4 ? zc + af * g : j > 4 ? zc - ab * g : zc;
    out[`${row}${j}`] = [+(t * W).toFixed(3), +(y + (dy[j] ?? 0)).toFixed(3), +z.toFixed(3)];
  }
  return out;
}

export const PRESETS = {
  male: {
    // measured off his reference: x and y of the front-facing points off the front view, of the back-facing off the back
    // view, z off the profile (66 sheet pixels a unit, the pivot [0, -2, 0] at the front view's (163, 239))
    V: {
      nt0: [0, 0.33, 0.4], nt1: [0.3, 0.36, 0.29], nt2: [0.43, 0.4, -0.04], nt3: [0.36, 0.45, -0.36], nt4: [0.2, 0.48, -0.5], nt5: [0, 0.49, -0.54],
      tr0: [0, -0.64, 0.6], tr1: [0.47, -0.6, 0.55], tr2: [0.85, -0.55, 0.52], tr3: [1.17, -0.53, 0.25], tr4: [1.45, -0.53, -0.15], tr5: [1.2, -0.5, -0.55], tr6: [0.91, -0.55, -1.109], tr7: [0.42, -0.56, -1.096], tr8: [0, -0.5, -1.08],
      sd0: [0, -0.9, 0.71], sd1: [0.5, -0.9, 0.7], sd2: [1.27, -1.15, 0.76], sd3: [1.57, -1.18, 0.38], sd4: [1.85, -1.08, -0.15], sd5: [1.55, -1.0, -0.75], sd6: [1.14, -0.73, -1.13], sd7: [0.58, -0.65, -1.108], sd8: [0, -0.65, -1.093],
      da0: [0, -1.15, 0.82], da1: [0.6, -1.15, 0.8], da2: [1.3, -1.22, 0.74], da3: [1.71, -1.57, 0.14], da4: [1.78, -1.52, -0.2], da5: [1.71, -1.57, -0.54], da6: [1.33, -1.1, -0.85], da7: [0.89, -1.02, -1.148], da8: [0, -1.1, -1.131],
      db0: [0, -1.48, 0.97], db1: [0.77, -1.45, 0.9], db2: [1.32, -1.26, 0.72], db3: [1.55, -1.68, 0.28], db5: [1.55, -1.68, -0.68], db6: [1.26, -1.41, -0.85], db7: [0.67, -1.3, -1.166], db8: [0, -1.41, -1.157],
      dc0: [0, -1.56, 0.8], dc1: [0.8, -1.82, 0.78], dc2: [1.17, -1.62, 0.6], dc3: [1.39, -1.79, 0.14], dc4: [1.32, -1.84, -0.2], dc5: [1.39, -1.79, -0.54], dc6: [1.18, -1.62, -0.8], dc7: [0.42, -1.59, -1.184], dc8: [0, -1.68, -1.18],
      ra0: [0, -2.03, 0.9], ra1: [0.56, -2.12, 0.86], ra2: [0.86, -2.24, 0.7], ra3: [1.05, -2.2, 0.42], ra4: [1.13, -2.15, 0], ra5: [1.08, -2.0, -0.5], ra6: [0.85, -2.05, -0.8], ra7: [0.42, -2.03, -0.9], ra8: [0, -2.05, -0.88],
      rb0: [0, -2.38, 0.86], rb1: [0.5, -2.44, 0.83], rb2: [0.78, -2.45, 0.66], rb3: [0.93, -2.45, 0.38], rb4: [0.98, -2.4, 0], rb5: [0.92, -2.38, -0.4], rb6: [0.68, -2.4, -0.68], rb7: [0.3, -2.38, -0.78], rb8: [0, -2.38, -0.78],
      rc0: [0, -2.73, 0.8], rc1: [0.5, -2.76, 0.77], rc2: [0.72, -2.75, 0.6], rc3: [0.85, -2.66, 0.38], rc4: [0.89, -2.61, 0], rc5: [0.85, -2.6, -0.32], rc6: [0.62, -2.68, -0.55], rc7: [0.26, -2.7, -0.64], rc8: [0, -2.72, -0.62],
      wa0: [0, -3.0, 0.77], wa1: [0.5, -3.0, 0.74], wa2: [0.63, -3.0, 0.62], wa3: [0.85, -2.95, 0.4], wa4: [0.92, -2.95, 0], wa5: [0.88, -3.0, -0.3], wa6: [0.62, -3.0, -0.55], wa7: [0.25, -3.0, -0.63], wa8: [0, -3.0, -0.63],
      hi0: [0, -3.3, 0.76], hi1: [0.45, -3.3, 0.73], hi2: [0.8, -3.24, 0.55], hi3: [0.97, -3.3, 0.38], hi4: [1.02, -3.3, 0], hi5: [0.95, -3.3, -0.36], hi6: [0.68, -3.3, -0.62], hi7: [0.28, -3.3, -0.72], hi8: [0, -3.3, -0.72],
      hw0: [0, -3.65, 0.73], hw1: [0.42, -3.67, 0.7], hw2: [0.8, -3.6, 0.5], hw3: [1.0, -3.58, 0.36], hw4: [1.05, -3.56, 0], hw5: [1.0, -3.56, -0.42], hw6: [0.72, -3.58, -0.7], hw7: [0.33, -3.6, -0.8], hw8: [0, -3.6, -0.82],
      bt0: [0, -3.97, 0.66], bt1: [0.22, -3.97, 0.62], bt2: [0.4, -3.97, 0.48], bt3: [0.5, -3.97, 0.32], bt4: [0.55, -3.97, 0], bt5: [0.52, -3.97, -0.3], bt6: [0.4, -3.97, -0.45], bt7: [0.2, -3.97, -0.53], bt8: [0, -3.97, -0.55],
    },
    breasts: false,
    // his reference's single planes (its front view and the topology panel)
    merge: [
      { name: 'collarbone', cells: ['nb0', 'nb1'], region: 'shoulder' },
      { name: 'trapezius front', cells: ['nb2t', 'nb2'], region: 'shoulder' },
      { name: 'pectoral', cells: ['tr0', 'tr1', 'sd0', 'sd1', 'da0', 'da1'], region: 'chest' },
      { name: 'deltoid top', cells: ['tr2', 'tr3'], region: 'shoulder' },
      { name: 'deltoid front', cells: ['sd2', 'sd3', 'da2'], region: 'shoulder' },
      { name: 'lower abs', cells: ['wa0', 'hi0', 'hw0'], region: 'pelvis' },
      // the back: the shoulder blade's plane from under the trapezius to the spine, cut from the plane beside it by a
      // diagonal down and in to the blade's tip (dc7); the lat beside the spine's muscles down to the waist
      { name: 'shoulder blade', cells: ['tr6', 'tr7', 'sd6b', 'sd7', 'da7', 'db7'], region: 'shoulder' },
      { name: 'teres', cells: ['sd6a', 'da6', 'db6'], region: 'shoulder' },
      { name: 'lat', cells: ['dc6', 'ra6', 'rb6', 'rc6'], region: 'abdomen' },
      { name: 'spine', cells: ['dc7', 'ra7', 'rb7', 'rc7'], region: 'abdomen' },
      { name: 'lower back', cells: ['wa6', 'hi6'], region: 'pelvis' },
      { name: 'sacrum', cells: ['wa7', 'hi7'], region: 'pelvis' },
    ],
    split: ['sd6'],
  },
};

/** The female torso: the same rows and columns, moved to her proportions, and her breasts; measured off her reference
 * as his (80 sheet pixels a unit, the pivot at the front view's (161.7, 234)). */
PRESETS.female = {
  V: {
    nt0: [0, -0.18, 0.21], nt1: [0.22, -0.16, 0.15], nt2: [0.31, -0.12, -0.08], nt3: [0.27, -0.08, -0.3], nt4: [0.15, -0.06, -0.42], nt5: [0, -0.06, -0.45],
    tr0: [0, -0.77, 0.3], tr1: [0.45, -0.72, 0.3], tr2: [0.8, -0.66, 0.2], tr3: [1, -0.64, 0.05], tr4: [1.08, -0.64, -0.15], tr5: [1, -0.6, -0.45], tr6: [0.7, -0.55, -0.65], tr7: [0.35, -0.5, -0.68], tr8: [0, -0.5, -0.68],
    sd0: [0, -0.92, 0.38], sd1: [0.4, -0.9, 0.42], sd2: [0.75, -0.88, 0.36], sd3: [1.15, -0.95, 0.15], sd4: [1.35, -1.1, -0.15], sd5: [1.15, -0.95, -0.48], sd6: [0.85, -0.85, -0.72], sd7: [0.4, -0.85, -0.78], sd8: [0, -0.85, -0.76],
    da0: [0, -1.05, 0.45], da1: [0.56, -0.96, 0.5], da2: [0.83, -0.93, 0.3], da3: [1.36, -1.2, -0.14], da4: [1.43, -1.14, -0.3], da5: [1.36, -1.2, -0.46], da6: [0.85, -1.1, -0.78], da7: [0.4, -1.1, -0.82], da8: [0, -1.1, -0.8],
    db0: [0, -1.33, 0.5], db1: [0.52, -1.27, 0.86], db2: [0.9, -1.39, 0.35], db3: [1.2, -1.33, -0.08], db5: [1.2, -1.33, -0.52], db6: [0.85, -1.35, -0.78], db7: [0.42, -1.35, -0.8], db8: [0, -1.35, -0.78],
    dc0: [0, -1.49, 0.5], dc1: [0.48, -1.83, 0.55], dc2: [0.83, -1.58, 0.32], dc3: [1.04, -1.46, -0.14], dc4: [0.97, -1.52, -0.3], dc5: [1.04, -1.46, -0.46], dc6: [0.8, -1.6, -0.72], dc7: [0.42, -1.8, -0.72], dc8: [0, -1.75, -0.7],
    bx0: [0.13, -1, 0.42], bx1: [0.66, -0.95, 0.33], bx2: [0.82, -1.58, 0.32], bx3: [0.2, -1.69, 0.56],
    nv0: [0, -2.76, 0.53], nv1: [0.05, -2.89, 0.52], nv2: [0, -2.93, 0.53],
    ra0: [0, -1.975, 0.6], ra1: [0.413, -1.945, 0.549], ra2: [0.6, -1.895, 0.443], ra3: [0.712, -1.875, 0.281], ra4: [0.75, -1.875, 0.02], ra5: [0.705, -1.975, -0.259], ra6: [0.525, -1.975, -0.458], ra7: [0.27, -1.975, -0.544], ra8: [0, -1.975, -0.56],
    rb0: [0, -2.14, 0.56], rb1: [0.363, -2.14, 0.515], rb2: [0.528, -2.14, 0.421], rb3: [0.627, -2.14, 0.276], rb4: [0.66, -2.14, 0.045], rb5: [0.62, -2.14, -0.202], rb6: [0.462, -2.14, -0.379], rb7: [0.238, -2.14, -0.456], rb8: [0, -2.14, -0.47],
    rc0: [0, -2.35, 0.54], rc1: [0.33, -2.35, 0.498], rc2: [0.48, -2.35, 0.41], rc3: [0.57, -2.35, 0.276], rc4: [0.6, -2.35, 0.06], rc5: [0.564, -2.35, -0.171], rc6: [0.42, -2.35, -0.335], rc7: [0.216, -2.35, -0.407], rc8: [0, -2.35, -0.42],
    wa0: [0, -2.6, 0.52], wa1: [0.363, -2.6, 0.478], wa2: [0.528, -2.6, 0.389], wa3: [0.627, -2.6, 0.253], wa4: [0.66, -2.6, 0.035], wa5: [0.62, -2.6, -0.198], wa6: [0.462, -2.6, -0.365], wa7: [0.238, -2.6, -0.437], wa8: [0, -2.6, -0.45],
    hi0: [0, -2.89, 0.51], hi1: [0.457, -2.89, 0.461], hi2: [0.664, -2.89, 0.357], hi3: [0.788, -2.89, 0.199], hi4: [0.83, -2.89, -0.055], hi5: [0.78, -2.89, -0.326], hi6: [0.581, -2.89, -0.521], hi7: [0.299, -2.89, -0.604], hi8: [0, -2.89, -0.62],
    hw0: [0, -3.39, 0.5], hw1: [0.556, -3.39, 0.442], hw2: [0.808, -3.39, 0.321], hw3: [0.959, -3.39, 0.136], hw4: [1.01, -3.39, -0.16], hw5: [0.949, -3.39, -0.477], hw6: [0.707, -3.39, -0.704], hw7: [0.364, -3.39, -0.802], hw8: [0, -3.39, -0.82],
    bt0: [0, -3.85, 0.45], bt1: [0.38, -3.85, 0.38], bt2: [0.552, -3.85, 0.266], bt3: [0.655, -3.85, 0.115], bt4: [0.69, -3.85, -0.075], bt5: [0.649, -3.85, -0.281], bt6: [0.483, -3.85, -0.473], bt7: [0.248, -3.85, -0.574], bt8: [0, -3.85, -0.6],
  },
  breasts: true,
  // the breast's foot round the patch, the points between the grid's where her reference's outline turns
  breastRing: ['da0', 'bx0', 'da1', 'bx1', 'da2', 'db2', 'bx2', 'dc2', 'dc1', 'bx3', 'dc0', 'db0'],
  dome: { mu: 0.735, d: [0.08, 0.02, 0.09], e: [0, -0.02, 0.05] },
  // beside the breast, its foot's outer point to the armpit: triangles from the armpit's corner
  fan: { db2: 'dc3' },
  // the navel: a notch sunk at hi0, in the centre line between the waist's row and the hips' widest
  navel: { at: 'hi0', top: 'nv0', bottom: 'nv2', side: 'nv1', cells: ['wa0', 'hi0'] },
  // her reference's single planes
  merge: [
    { name: 'collarbone', cells: ['nb0', 'nb1'], region: 'shoulder' },
    { name: 'trapezius front', cells: ['nb2t', 'nb2'], region: 'shoulder' },
    // the shoulder blade's plane down the spine to db8, cut from the plane beside the spine by a diagonal out to its tip (dc7)
    { name: 'shoulder blade', cells: ['tr6', 'tr7', 'sd6b', 'sd7', 'da7', 'db7a'], region: 'shoulder' },
    { name: 'teres', cells: ['sd6a', 'da6', 'db6'], region: 'shoulder' },
    // below the shoulder blades the spine a deep groove down the centre line, the cells either side of it apart
  ],
  // behind the deltoid, under the arm's cut where the side turns in to the armpit, and over the buttocks beside the
  // groove: triangles
  split: ['tr5', 'sd5', 'sd6', 'db7/', 'dc3', 'dc4', 'hi7'],
};

// The fitted vertices (tools/sculpt/lowtfit.mjs) over the hand-set ones: tools/sculpt/lowtfit-<who>.json, when present.
for (const who of Object.keys(PRESETS)) {
  const file = new URL(`./lowtfit-${who}.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const fit = JSON.parse(readFileSync(file, 'utf8'));
  if (fit.V) PRESETS[who].V = { ...PRESETS[who].V, ...fit.V };
  for (const k of ['dome', 'breastRing']) if (fit[k]) PRESETS[who][k] = fit[k];
}

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowTorso(who = 'male', preset = null) {
  const P = preset ?? PRESETS[who];
  if (!P) throw new Error(`no torso ${who}`);
  // the neck's foot is the head's own, exactly
  // (P.foot: the ring as the fitter moves it, tools/sculpt/lowtfit.mjs --foot, before it writes it back into the head's)
  const foot = P.foot ?? HEADS[who].V;
  const V = { ...P.V };
  for (const n of NECK_FOOT) V[n] = [...foot[n]];
  if (P.dome) Object.assign(V, domeRing(P, V));
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const ids = { 1: {}, [-1]: {} };
  for (const [name, p] of Object.entries(V)) {
    if (p[0] === 0) ids[1][name] = ids[-1][name] = vert([...p]);
    else { ids[1][name] = vert([...p]); ids[-1][name] = vert(mx(p)); }
  }
  // Every face wound to look out, away from the body's axis at its own height (the arm's cut away from the shoulder's
  // inside).
  const outward = (v, name) => {
    const pts = v.map((i) => verts[i]);
    const c = mul(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
    let ref;
    if (name === 'neck cut') ref = [0, 1, 0];
    else if (name === 'hip cut') ref = [0, -1, 0];
    else if (name === 'arm cut') ref = [Math.sign(c[0]), -0.6, 0];
    else ref = sub(c, [0, c[1], -0.15]);
    return dot(n, ref) < 0 ? [...v].reverse() : v;
  };
  const poly = (v, part, name, region) => polys.push({ v, part, region, mat: 'skin', name });
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'R' : 'L';
    for (const f of halfFaces(P)) {
      const v = outward(f.v.map((n) => ids[s][n]), f.name);
      poly(v, f.part, f.name + ':' + sd, f.region ?? regionOf(f.name, who));
    }
  }
  const span = (n) => (n.endsWith("'") ? ids[-1][n.slice(0, -1)] : ids[1][n]);
  for (const f of spanFaces()) poly(outward(f.v.map(span), f.name), f.part, f.name, regionOf(f.name, who));

  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts, V, ids };
}

/** Each polygon in triangles: a quad split so it folds outward, a larger polygon ear-clipped in its own plane (a merged
 * plane's outline need not be convex). */
function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4 && verts) {
    const [a, b, c, d] = v.map((i) => verts[i]);
    const behind = dot(cross(sub(b, a), sub(c, a)), sub(d, a)) < 0;
    return behind ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
  }
  const pts = v.map((i) => verts[i]);
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
  const u = Math.abs(n[0]) < 0.9 * Math.hypot(...n) ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]), w = cross(n, u);
  const P2 = pts.map((p) => [dot(p, u), dot(p, w)]);
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let sgn = 0; for (let i = 0; i < P2.length; i++) sgn += area2([0, 0], P2[i], P2[(i + 1) % P2.length]);
  const idx = v.map((_, i) => i), out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 500) {
    let cut = -1;
    for (let k = 0; k < idx.length && cut < 0; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (area2(P2[a], P2[b], P2[c]) * sgn <= 1e-12) continue;
      const inside = idx.some((q) => q !== a && q !== b && q !== c && area2(P2[a], P2[b], P2[q]) * sgn > 0 && area2(P2[b], P2[c], P2[q]) * sgn > 0 && area2(P2[c], P2[a], P2[q]) * sgn > 0);
      if (!inside) cut = k;
    }
    if (cut < 0) cut = 0;
    const a = idx[(cut + idx.length - 1) % idx.length], b = idx[cut], c = idx[(cut + 1) % idx.length];
    out.push([v[a], v[b], v[c]]); idx.splice(cut, 1);
  }
  out.push(idx.map((i) => v[i]));
  return out;
}

/** The edges used by other than two faces (none, for a closed mesh with no T-junctions), and edges with a vertex lying
 * on them (a T-junction). Vertices at the same place are one. */
export function openEdges(mesh) {
  const key = (i) => mesh.verts[i].map((x) => x.toFixed(5)).join(',');
  const count = new Map();
  for (const p of mesh.polys) for (let i = 0; i < p.v.length; i++) {
    const a = key(p.v[i]), b = key(p.v[(i + 1) % p.v.length]);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count].filter(([, n]) => n !== 2);
}

/** Head and torso as one body: the head with its neck and without its shoulder stub, the torso without its own neck;
 * they meet at the neck's foot (nm0..nm5), the same points. */
export function buildLowBody(who = 'male') {
  const head = buildLowHead(who), torso = buildLowTorso(who);
  const verts = [], polys = [], at = new Map();
  const take = (m, keep) => {
    const map = new Map();
    m.polys.forEach((p) => {
      if (!keep(p)) return;
      const v = p.v.map((i) => {
        if (!map.has(i)) {
          const k = m.verts[i].map((x) => x.toFixed(6)).join(',');
          // the neck's foot: one point for the head and the torso
          if (at.has(k)) map.set(i, at.get(k)); else { verts.push([...m.verts[i]]); at.set(k, verts.length - 1); map.set(i, verts.length - 1); }
        }
        return map.get(i);
      });
      polys.push({ ...p, v });
    });
  };
  take(head, (p) => p.part !== 'shoulders');
  take(torso, (p) => p.part !== 'neck');
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  return { verts, polys, tris: triList };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--who');
  for (const who of i < 0 ? ['male', 'female'] : [args[i + 1]]) {
    const m = buildLowTorso(who);
    const n = m.tris.length;
    console.log(who, JSON.stringify(m.counts), 'triangles', n, n >= 400 && n <= 800 ? '(in 400-800)' : '(OUT of 400-800)', 'verts', m.verts.length, 'polys', m.polys.length);
    const open = openEdges(m);
    console.log('  torso alone: edges not shared by exactly two faces', open.length);
    // the joined body: any open edge not already open in the head alone (its brows' and lids' strips stand open in its
    // skin) is a gap at the seam
    const own = new Set(openEdges(buildLowHead(who)).map(([k]) => k));
    const seam = openEdges(buildLowBody(who)).filter(([k]) => !own.has(k));
    console.log('  head + torso: edges at the seam not shared by exactly two faces', seam.length);
  }
}
