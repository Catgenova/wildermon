// The low-poly pelvis and legs (male and female) for the reference sheets in tools/sculpt/LEGS_SPEC.md and
// tools/sculpt/LEGS_SPEC_FEMALE.md, drawn by tools/sculpt/lowlshot.mjs and fitted by tools/sculpt/lowlfit.mjs:
//
//   node tools/sculpt/lowlegs.mjs [--who male|female]     # prints the triangle counts and checks the mesh is closed
//
// Units are the low-poly head's (tools/sculpt/lowhead.mjs): y up (the chin's underside at 0), z forward, x the body's
// left. The legs begin at the torso's hip cut, its ring bt0..bt8 (tools/sculpt/lowtorso.mjs), read from the torso itself,
// so torso plus legs is one closed body: the legs are open only there, and joined (buildLowLower) the torso's hip cut
// face is left out.
//
// One half authored by name (the body's left leg, x >= 0) and mirrored, the rows the references' topology panels draw.
// One row round the whole body below the hip cut, gl, nine columns as the torso's rows (0 the front's centre line, 4 the
// side, 8 the back's centre line): at the side the hip line, at the front it runs down the groin to the pubic point (gl0),
// at the back it crosses the buttocks. Then the crotch point cx on the centre line, and each leg's rings of eight, from the
// front (0) round the outside (2) and the back (4) to the inside (6): th the thigh's top (at the inside the crotch, at the
// back the buttock's lower fold), tm the thigh's middle, ka kb kc the knee (its top, the kneecap's crease, its bottom; the
// kneecap two planes), ca the calf's widest, cb the calf's lower ring; an the ankle, six sides (0 front
// inner, 1 front outer, 2 outer, 3 back outer, 4 back inner, 5 inner); fc the block foot's collar under it (the instep's
// crease, the heel's top), six as the ankle's; ft the top of the sole band, six round the foot (0 toe inner, 1 toe outer,
// 2 ball outer, 3 heel outer, 4 heel inner, 5 ball inner), so the sole's edge, flat at the floor.
//
// Parts: pelvis, legs (both counted against the triangle budget). Regions, for the planes panel: pelvis, thigh, knee,
// calf, foot.

import { existsSync, readFileSync } from 'node:fs';
import { PRESETS as TORSOS, buildLowTorso, openEdges } from './lowtorso.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mx = (p) => [-p[0], p[1], p[2]];

/** The torso's hip cut, one half: bt0 at the front's centre line round to bt8 at the back's. */
export const WAIST = Array.from({ length: 9 }, (_, j) => `bt${j}`);
export const BODY_ROWS = ['gl'];
export const LEG_RINGS = ['th', 'tm', 'ka', 'kb', 'kc', 'ca', 'cb'];
const REGION = { th: 'thigh', tm: 'thigh', ka: 'knee', kb: 'knee', kc: 'knee', ca: 'calf', cb: 'calf' };

/** The faces of one half, by vertex name: { v, part, name, region }. A cell of the rings is keyed by its upper ring and
 * left column ('tm3' the cell from tm3 down to ka4). P.merge lists groups of faces that are one plane in the reference:
 * each becomes one polygon round the group's outline, its inner vertices left out. P.split: a cell cut on its diagonal. */
export function halfFaces(P) {
  const F = new Map();
  const f = (key, v, part, region) => F.set(key, { v, part, name: key, region });
  const quad = (key, A, B, C, D, part, region) => {
    const sp = (P.split ?? []).find((x) => x.replace('/', '') === key);
    if (!sp) f(key, [A, B, C, D], part, region);
    else if (sp.includes('/')) { f(key + 'a', [A, B, D], part, region); f(key + 'b', [B, C, D], part, region); }
    else { f(key + 'a', [A, C, D], part, region); f(key + 'b', [A, B, C], part, region); }
  };
  // the pelvis: the hip cut down to gl, nine columns
  const rows = ['bt', ...BODY_ROWS];
  for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j < 8; j++) {
    const r = rows[i], s = rows[i + 1];
    quad(`${r}${j}`, `${r}${j}`, `${r}${j + 1}`, `${s}${j + 1}`, `${s}${j}`, 'pelvis', 'pelvis');
  }
  // gl down to the thigh's top ring and the crotch (the thigh's region in the planes panel, under the hip line's V): the
  // ring's front to gl1, its outside to gl4, its back to gl7, its
  // inside to the crotch cx; gl2 and gl5 close in triangles
  const T = (k) => `th${k}`;
  quad('gr0', 'gl0', 'gl1', T(0), T(7), 'pelvis', 'thigh');
  quad('gr1', 'gl1', 'gl2', T(1), T(0), 'pelvis', 'thigh');
  f('gr2', ['gl2', 'gl3', T(1)], 'pelvis', 'thigh');
  f('gr3', ['gl3', 'gl4', T(2), T(1)], 'pelvis', 'thigh');
  f('gr4', ['gl4', 'gl5', T(3), T(2)], 'pelvis', 'thigh');
  f('gr5', ['gl5', 'gl6', T(3)], 'pelvis', 'thigh');
  f('gr6', ['gl6', 'gl7', T(4), T(3)], 'pelvis', 'thigh');
  f('gr7', ['gl7', 'gl8', T(5), T(4)], 'pelvis', 'thigh');
  f('gr8', ['gl8', 'cx', T(6), T(5)], 'pelvis', 'thigh');
  f('gr9', ['cx', 'gl0', T(7), T(6)], 'pelvis', 'thigh');
  // the leg's rings
  for (let i = 0; i + 1 < LEG_RINGS.length; i++) for (let j = 0; j < 8; j++) {
    const r = LEG_RINGS[i], s = LEG_RINGS[i + 1], j1 = (j + 1) % 8;
    quad(`${r}${j}`, `${r}${j}`, `${r}${j1}`, `${s}${j1}`, `${s}${j}`, 'legs', REGION[r]);
  }
  // the calf's lower ring (eight) down to the ankle (six): its front (0) and back (4) close in triangles
  const C = (k) => `cb${k}`, A = (k) => `an${k}`;
  f('ak0', [C(7), C(0), A(0)], 'legs', 'calf');
  f('ak1', [C(0), C(1), A(1), A(0)], 'legs', 'calf');
  f('ak2', [C(1), C(2), A(2), A(1)], 'legs', 'calf');
  f('ak3', [C(2), C(3), A(3), A(2)], 'legs', 'calf');
  f('ak4', [C(3), C(4), A(3)], 'legs', 'calf');
  f('ak5', [C(4), C(5), A(4), A(3)], 'legs', 'calf');
  f('ak6', [C(5), C(6), A(5), A(4)], 'legs', 'calf');
  f('ak7', [C(6), C(7), A(0), A(5)], 'legs', 'calf');
  // the block foot: the ankle down to its top edge, the edge down to the sole
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; f(`ankle foot${k}`, [A(k), A(k1), `fc${k1}`, `fc${k}`], 'legs', 'foot'); }
  const Cf = (k) => `fc${k}`;
  f('instep', [Cf(0), Cf(1), 'ft1', 'ft0'], 'legs', 'foot');
  f('foot out front', [Cf(1), Cf(2), 'ft2', 'ft1'], 'legs', 'foot');
  f('foot out back', [Cf(2), Cf(3), 'ft3', 'ft2'], 'legs', 'foot');
  f('heel', [Cf(3), Cf(4), 'ft4', 'ft3'], 'legs', 'foot');
  f('foot in back', [Cf(4), Cf(5), 'ft5', 'ft4'], 'legs', 'foot');
  f('foot in front', [Cf(5), Cf(0), 'ft0', 'ft5'], 'legs', 'foot');
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; f(`sole edge${k}`, [`ft${k}`, `ft${k1}`, `so${k1}`, `so${k}`], 'legs', 'foot'); }
  f('sole', ['so0', 'so1', 'so2', 'so3', 'so4', 'so5'], 'legs', 'foot');
  // P.retopo: a preset's own faces where its reference draws more planes than the rows give: the cells in drop left
  // out, the faces in add (by vertex name, extra vertices placed in V) put in their place over the same outline
  for (const { drop = [], add = [] } of P.retopo ?? []) {
    for (const c of drop) { if (!F.has(c)) throw new Error(`retopo: no cell ${c}`); F.delete(c); }
    for (const a of add) f(a.name, a.v, a.part ?? 'pelvis', a.region ?? 'pelvis');
  }
  for (const { name, cells, region } of P.merge ?? []) {
    const edges = new Map();
    let part = 'legs';
    for (const c of cells) {
      const face = F.get(c);
      if (!face) throw new Error(`merge ${name}: no cell ${c}`);
      part = face.part; F.delete(c);
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
    F.set(name, { v: loop, part, name, region: region ?? F.get(cells[0])?.region });
  }
  return [...F.values()];
}

/* ---- the two pelvis-and-legs ------------------------------------------------------------------------------------ */
// A body row: half-width W, the front's z F and the back's B at height y, the columns' share of W as the torso's rows,
// how square the section is (n), and each column's own drop (dy).
const SHARE = [0, 0.55, 0.8, 0.95, 1, 0.94, 0.7, 0.36, 0];
function bodyRow(row, y, W, F, B, n = 2.6, dy = []) {
  const zc = (F + B) / 2, af = F - zc, ab = zc - B, out = {};
  for (let j = 0; j < 9; j++) {
    const t = SHARE[j], g = Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
    const z = j < 4 ? zc + af * g : j > 4 ? zc - ab * g : zc;
    out[`${row}${j}`] = [+(t * W).toFixed(3), +(y + (dy[j] ?? 0)).toFixed(3), +z.toFixed(3)];
  }
  return out;
}
// A leg ring of eight round its centre: x from xi (inside) to xo (outside), z from zb (back) to zf (front); the diagonal
// points at a share a of the way out (an octagon at 0.71); dy each point's own drop.
// tw turns the eight round the ring (radians, the front point toward the outside): the thigh's columns running on the
// diagonal from the hip's outside down onto the kneecap, as the references draw the thigh's front planes.
function legRing(row, y, xi, xo, zb, zf, a = 0.72, dy = [], tw = 0) {
  const cx = (xi + xo) / 2, w = (xo - xi) / 2, cz = (zb + zf) / 2, d = (zf - zb) / 2;
  const P = tw ? Array.from({ length: 8 }, (_, j) => { const t = Math.PI / 2 - (j * Math.PI) / 4 - tw; return [Math.cos(t), Math.sin(t)]; })
    : [[0, 1], [a, a], [1, 0], [a, -a], [0, -1], [-a, -a], [-1, 0], [-a, a]];
  const out = {};
  P.forEach(([u, v], j) => { out[`${row}${j}`] = [+(cx + u * w).toFixed(3), +(y + (dy[j] ?? 0)).toFixed(3), +(cz + v * d).toFixed(3)]; });
  return out;
}
// The ankle's six: a hexagon long from side to side, flat at the front and the back.
function ankle(y, xi, xo, zb, zf) {
  // (the six at one height)
  const cx = (xi + xo) / 2, w = (xo - xi) / 2, cz = (zb + zf) / 2, d = (zf - zb) / 2;
  const P = [[-0.5, 1], [0.5, 1], [1, 0], [0.5, -1], [-0.5, -1], [-1, 0]];
  return Object.fromEntries(P.map(([u, v], j) => [`an${j}`, [+(cx + u * w).toFixed(3), y, +(cz + v * d).toFixed(3)]]));
}
// The block foot: its centre line at x, from the heel's back zh to the toe's front zt, half-widths at the toe, the ball
// and the heel, the edge's height above the floor at the toe and at the heel, turned out by turn degrees about the ankle.
function foot({ x, floor, zh, zt, zb, wt, wb, wh, ht, hh, turn = 0, wc = 0.42, hc = 0.72, hcf = 0.6, zcf = 0.1 }) {
  // the collar (fc): where the block begins under the ankle, the instep's crease at the front, the heel's top at the back
  const zm = (zcf + zh) / 2, hm = (hc + hcf) / 2;
  const pts = {
    fc0: [-0.8 * wc, hcf, zcf], fc1: [0.8 * wc, hcf, zcf], fc2: [wc, hm, zm], fc3: [0.75 * wc, hc, zh], fc4: [-0.75 * wc, hc, zh], fc5: [-wc, hm, zm],
    ft0: [-wt, ht, zt], ft1: [wt, ht, zt], ft2: [wb, hh, zb], ft3: [wh, hh, zh], ft4: [-wh, hh, zh], ft5: [-wb, hh, zb],
  };
  const a = (turn * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), out = {};
  for (const [n, [u, h, z]] of Object.entries(pts)) {
    const X = x + u * c + z * s, Z = -u * s + z * c;
    out[n] = [+X.toFixed(3), +(floor + h).toFixed(3), +Z.toFixed(3)];
    if (n.startsWith('ft')) out[n.replace('ft', 'so')] = [+X.toFixed(3), floor, +Z.toFixed(3)];
  }
  return out;
}

// Each preset: R, the rows as numbers (the fitter's 'rings' stage moves these): gl [y, W, F, B] and its columns' drops
// gD; each leg ring [y, xi, xo, zb, zf] and its points' drops D.<ring>; the ankle [y, xi, xo, zb, zf]; the foot's numbers;
// cx the crotch. V (from lowlfit-<who>.json) places single vertices by hand over what R makes.
// The kneecap as the references' top rows draw it: two planes, the upper one (ka7 ka0 ka1 down to kb1 kb0 kb7, facing
// forward) and the lower one (kb7 kb0 kb1 down to its point kc0, facing down), the crease between them across the knee;
// together the topology panels' hexagon.
const KNEECAP = [{ name: 'kneecap', cells: ['ka7', 'ka0'], region: 'knee' }, { name: 'kneecap low', cells: ['kb7b', 'kb0a'], region: 'knee' }];
export const PRESETS = {
  // measured off his references: x off the full-body front (ref/body-male.png, 118.4 pixels a unit, the chin's underside
  // at y 320), z off the leg sheet's profile; the rows' heights off his topology panel's front, put at the full-body
  // heights (the belt's lower edge at -3.95, the floor at -11.82)
  male: {
    floor: -11.82,
    R: {
      gl: [-4.6, 1.3, 0.8, -0.92], gD: [-0.55, -0.35, -0.1, 0, 0, -0.1, -0.25, -0.3, -0.3],
      cx: [0, -5.77, -0.05],
      th: [-5.6, 0.05, 1.44, -0.75, 0.62], tm: [-6.4, 0.36, 1.38, -0.5, 0.42], ka: [-7.08, 0.5, 1.33, -0.5, 0.45],
      kb: [-7.6, 0.6, 1.42, -0.7, 0.45], kc: [-8.1, 0.58, 1.5, -0.85, 0.22], ca: [-8.7, 0.58, 1.6, -0.9, 0.12],
      cb: [-9.8, 0.85, 1.47, -0.7, 0.03],
      an: [-10.75, 0.92, 1.43, -0.62, 0.0],
      foot: { x: 1.25, zh: -0.76, zt: 0.89, zb: 0.25, wt: 0.36, wb: 0.43, wh: 0.3, ht: 0.32, hh: 0.4, turn: 12 },
    },
    D: { th: [0, 0, 0, -0.4, -0.6, -0.45, -0.17, -0.05], ka: [0, 0, 0, 0, 0, 0, 0, 0], kb: [0.12, 0, 0, 0, 0, 0, 0, 0], kc: [-0.12, 0, 0, 0, 0, 0, 0, 0] },
    // the pelvis' front and back under the loincloth (the sheet's views hide them), from the bare topology panel's
    // profile; the foot's block heights from the same panel; the toe's half-width off the full-body front's toe face;
    // the hip line's height at the side off the topology panels' front (the hip's outer corner, 12% down the leg)
    fixed: ['gl.0', 'gl.2', 'gl.3', 'foot.ht', 'foot.hh', 'foot.hc', 'foot.hcf', 'foot.wt'],
    split: ['kb0/', 'kb7'],
    merge: KNEECAP,
  },
  // measured as his: x off ref/body-female.png (107 pixels a unit, its hips' top at the torso's hip row, y 700), z off
  // her leg sheet's profile at the full-body heights (the belt's lower edge at -3.93, the floor at -12.83)
  female: {
    floor: -12.83,
    R: {
      gl: [-4.7, 1.5, 0.76, -1.1], gD: [-0.6, -0.4, -0.1, 0, 0, -0.1, -0.3, -0.4, -0.4],
      cx: [0, -5.75, -0.1],
      th: [-5.6, 0.05, 1.57, -1.0, 0.68], tm: [-6.4, 0.36, 1.49, -0.91, 0.59], ka: [-7.2, 0.58, 1.36, -0.72, 0.4],
      kb: [-7.6, 0.66, 1.38, -0.64, 0.33], kc: [-8.0, 0.72, 1.5, -0.62, 0.28], ca: [-8.9, 0.68, 1.77, -0.97, 0.06],
      cb: [-9.9, 0.95, 1.71, -0.97, -0.04],
      an: [-10.95, 1.17, 1.69, -0.82, -0.18],
      foot: { x: 1.45, zh: -0.92, zt: 0.76, zb: 0.2, wt: 0.33, wb: 0.4, wh: 0.28, ht: 0.32, hh: 0.5, turn: 12 },
    },
    D: { th: [0, 0, 0, -0.4, -0.65, -0.5, -0.15, -0.05], ka: [0, 0, 0, 0, 0, 0, 0, 0], kb: [0.1, 0, 0, 0, 0, 0, 0, 0], kc: [-0.1, 0, 0, 0, 0, 0, 0, 0] },
    // the thigh's front from the groin's crease in triangles: from the pubic point, and from the crease's upper point
    // down to the thigh's front (the groin's V, as her full-body front draws the thigh's planes)
    // the thigh's middle ring half way between its top and the knee, so the thigh tapers straight into the knee as her
    // full-body front draws it (no step above the knee)
    // the crotch under the loincloth, between the thighs' inner sides (the fit had pushed it out in front of the body)
    fixed: ['gl.0', 'gl.2', 'tm.0', 'cx.1', 'cx.2', 'foot.ht', 'foot.hh', 'foot.hc', 'foot.hcf', 'foot.wt'],
    split: ['kb0/', 'kb7', 'gr0', 'gr1/'],
    merge: KNEECAP,
    // the buttocks as her leg sheet's back view and topology panel draw them: a row across the upper buttock (gm6..gm8,
    // between the hip cut and the hip row, so the profile rounds out from the waist), the hip row the buttock's lower
    // edge, under it the fold's V: from the hip row's side corner (gl5) down to the fold's inner corner (th4), its faces
    // fanned round th4; outside it the thigh's back plane runs up to the hip row's side corner
    retopo: [{
      drop: ['bt5', 'bt6', 'bt7', 'gr5', 'gr6', 'gr7', 'th3'],
      add: [
        { name: 'bt5a', v: ['bt5', 'bt6', 'gm6'] }, { name: 'bt5b', v: ['bt5', 'gm6', 'gl5'] }, { name: 'bt5c', v: ['gm6', 'gl6', 'gl5'] },
        { name: 'bt6', v: ['bt6', 'bt7', 'gm7', 'gm6'] }, { name: 'bt7', v: ['bt7', 'bt8', 'gm8', 'gm7'] },
        { name: 'gm6', v: ['gm6', 'gm7', 'gl7', 'gl6'] }, { name: 'gm7', v: ['gm7', 'gm8', 'gl8', 'gl7'] },
        { name: 'gr5', v: ['gl5', 'gl6', 'th4'], region: 'thigh' }, { name: 'gr6', v: ['gl6', 'gl7', 'th4'], region: 'thigh' },
        { name: 'th3', v: ['gl5', 'th4', 'tm4', 'tm3', 'th3'], part: 'legs', region: 'thigh' },
        { name: 'gr7a', v: ['gl7', 'gl8', 'th4'], region: 'thigh' }, { name: 'gr7b', v: ['gl8', 'th5', 'th4'], region: 'thigh' },
      ],
    }],
  },
};

/** The vertices R makes, before any hand placement. */
export function ringVerts(P) {
  const R = P.R, V = {};
  Object.assign(V, bodyRow('gl', R.gl[0], R.gl[1], R.gl[2], R.gl[3], 2.6, R.gD ?? P.R.gD));
  V.cx = [0, R.cx[1], R.cx[2]];
  for (const r of LEG_RINGS) Object.assign(V, legRing(r, R[r][0], R[r][1], R[r][2], R[r][3], R[r][4], 0.72, P.D?.[r] ?? [], R[r][5] ?? 0));
  Object.assign(V, ankle(...R.an));
  Object.assign(V, foot({ ...R.foot, floor: P.floor }));
  return V;
}

// The fitted vertices (tools/sculpt/lowlfit.mjs) over the hand-set ones: tools/sculpt/lowlfit-<who>.json, when present.
for (const who of Object.keys(PRESETS)) {
  const file = new URL(`./lowlfit-${who}.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const fit = JSON.parse(readFileSync(file, 'utf8'));
  if (fit.R) PRESETS[who].R = { ...PRESETS[who].R, ...fit.R };
  if (fit.D) PRESETS[who].D = { ...PRESETS[who].D, ...fit.D };
  if (fit.V) PRESETS[who].V = fit.V;
}

/** The torso's hip cut ring, one half, as the torso has it now (its fitted vertices over its own). */
export function waistRing(who) {
  const V = TORSOS[who].V;
  return Object.fromEntries(WAIST.map((n) => [n, [...V[n]]]));
}

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowLegs(who = 'male', preset = null) {
  const P = preset ?? PRESETS[who];
  if (!P) throw new Error(`no legs ${who}`);
  const V = { ...ringVerts(P), ...(P.V ?? {}), ...waistRing(who) };
  const faces = halfFaces(P);
  const used = new Set(faces.flatMap((f) => f.v));
  const verts = [], polys = [];
  const ids = { 1: {}, [-1]: {} };
  for (const [name, p] of Object.entries(V)) {
    if (!used.has(name)) continue;
    if (p[0] === 0) { verts.push([...p]); ids[1][name] = ids[-1][name] = verts.length - 1; }
    else { verts.push([...p]); ids[1][name] = verts.length - 1; verts.push(mx(p)); ids[-1][name] = verts.length - 1; }
  }
  // the leg's axis at a height (the mean of its ring there), for turning faces outward
  const ringAt = LEG_RINGS.map((r) => { const pts = Array.from({ length: 8 }, (_, j) => V[`${r}${j}`]); return [pts.reduce((a, q) => a + q[1], 0) / 8, pts.reduce((a, q) => a + q[0], 0) / 8, pts.reduce((a, q) => a + q[2], 0) / 8]; });
  const an = Array.from({ length: 6 }, (_, j) => V[`an${j}`]);
  ringAt.push([an[0][1], an.reduce((a, q) => a + q[0], 0) / 6, an.reduce((a, q) => a + q[2], 0) / 6]);
  const axis = (y) => {
    if (y >= ringAt[0][0]) return ringAt[0];
    for (let i = 0; i + 1 < ringAt.length; i++) if (y >= ringAt[i + 1][0]) { const t = (ringAt[i][0] - y) / (ringAt[i][0] - ringAt[i + 1][0]); return [y, ringAt[i][1] * (1 - t) + ringAt[i + 1][1] * t, ringAt[i][2] * (1 - t) + ringAt[i + 1][2] * t]; }
    return ringAt[ringAt.length - 1];
  };
  const outward = (v, name, part) => {
    const pts = v.map((i) => verts[i]);
    const c = mul(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
    let ref;
    if (name.startsWith('sole') && !name.startsWith('sole edge')) ref = [0, -1, 0];
    else if (part === 'pelvis' && !name.startsWith('gr')) ref = sub(c, [0, c[1], -0.05]);
    else if (name.startsWith('gr8') || name.startsWith('gr9')) ref = [Math.sign(c[0]) * 0.2, -1, 0];
    else if (name === 'instep') ref = [0, 1, 0.6];
    else if (name.startsWith('foot') || name.startsWith('ankle foot') || name === 'heel' || name.startsWith('sole edge')) {
      const fc = mul(['ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5'].map((k) => verts[ids[Math.sign(c[0]) || 1][k]]).reduce((a, p) => add(a, p), [0, 0, 0]), 1 / 6);
      ref = sub(c, [fc[0], c[1] + 0.3, fc[2]]);
    } else { const a = axis(c[1]); ref = sub(c, [Math.sign(c[0]) * a[1], c[1], a[2]]); }
    return dot(n, ref) < 0 ? [...v].reverse() : v;
  };
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'L' : 'R';
    for (const f of faces) {
      const v = outward(f.v.map((n) => ids[s][n]), f.name, f.part);
      polys.push({ v, part: f.part, region: f.region, mat: 'skin', name: f.name + ':' + sd });
    }
  }
  orient(polys, polys.findIndex((p) => p.name === 'tm2:L'));
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts, V, ids };
}

/** One consistent winding: from a seed face (wound outward by the axis rule) each neighbour turned so their shared edge
 * runs the other way, face by face over the whole mesh (the axis rule alone can misjudge a small face at a fold). */
function orient(polys, seed) {
  const owners = new Map();
  polys.forEach((p, pi) => p.v.forEach((a, i) => { const b = p.v[(i + 1) % p.v.length]; const k = a < b ? `${a}-${b}` : `${b}-${a}`; (owners.get(k) ?? owners.set(k, []).get(k)).push(pi); }));
  const done = new Set([seed]), queue = [seed];
  while (queue.length) {
    const pi = queue.shift(), p = polys[pi];
    p.v.forEach((a, i) => {
      const b = p.v[(i + 1) % p.v.length], k = a < b ? `${a}-${b}` : `${b}-${a}`;
      for (const qi of owners.get(k)) {
        if (done.has(qi)) continue;
        const q = polys[qi], j = q.v.indexOf(a);
        if (q.v[(j + 1) % q.v.length] === b) q.v.reverse(); // same direction as p: turn it over
        done.add(qi); queue.push(qi);
      }
    });
  }
}

/** Each polygon in triangles: a quad split so it folds outward, a larger polygon ear-clipped in its own plane. */
export function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4) {
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

/** Torso and legs as one body below the neck: the torso without its neck and its hip cut, the legs; they meet at the
 * hip cut's ring, the same points. */
export function buildLowLower(who = 'male', legs = null) {
  const torso = buildLowTorso(who), lg = legs ?? buildLowLegs(who);
  const verts = [], polys = [], at = new Map();
  const take = (m, keep) => {
    const map = new Map();
    m.polys.forEach((p) => {
      if (!keep(p)) return;
      const v = p.v.map((i) => {
        if (!map.has(i)) {
          const k = m.verts[i].map((x) => x.toFixed(6)).join(',');
          if (at.has(k)) map.set(i, at.get(k)); else { verts.push([...m.verts[i]]); at.set(k, verts.length - 1); map.set(i, verts.length - 1); }
        }
        return map.get(i);
      });
      polys.push({ ...p, v });
    });
  };
  take(torso, (p) => p.part !== 'neck' && p.name !== 'hip cut');
  take(lg, () => true);
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  return { verts, polys, tris: triList };
}

/** Edges whose two faces do not run along them in opposite directions (an outward-wound closed mesh has none). */
export function misWound(mesh) {
  const key = (i) => mesh.verts[i].map((x) => x.toFixed(5)).join(',');
  const dir = new Map();
  for (const p of mesh.polys) for (let i = 0; i < p.v.length; i++) {
    const a = key(p.v[i]), b = key(p.v[(i + 1) % p.v.length]);
    dir.set(`${a}>${b}`, (dir.get(`${a}>${b}`) ?? 0) + 1);
  }
  return [...dir].filter(([k, n]) => { const [a, b] = k.split('>'); return n !== 1 || !dir.has(`${b}>${a}`); }).length;
}

export const BUDGET = { male: [300, 600], female: [320, 650] };

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--who');
  for (const who of i < 0 ? ['male', 'female'] : [args[i + 1]]) {
    const m = buildLowLegs(who);
    const n = m.tris.length, [lo, hi] = BUDGET[who];
    console.log(who, JSON.stringify(m.counts), 'triangles', n, n >= lo && n <= hi ? `(in ${lo}-${hi})` : `(OUT of ${lo}-${hi})`, 'verts', m.verts.length, 'polys', m.polys.length);
    const open = openEdges(m);
    console.log('  legs alone: edges not shared by exactly two faces', open.length, '(the waist ring has 16)');
    // the joined body is open only at the neck's foot (where the head joins): any other open edge is a gap at the seam
    const torso = buildLowTorso(who);
    const neckOnly = { verts: torso.verts, polys: torso.polys.filter((p) => p.part !== 'neck') };
    const own = new Set(openEdges(neckOnly).map(([k]) => k));
    const body = buildLowLower(who, m);
    const seam = openEdges(body).filter(([k]) => !own.has(k));
    // mis-wound edges the legs bring (the torso's own, if any, counted apart)
    const torsoOwn = misWound(neckOnly) - own.size;
    console.log('  torso + legs: edges at the seam not shared by exactly two faces', seam.length, '(the neck foot open for the head:', own.size + ')', ' mis-wound edges from the legs', misWound(body) - own.size - torsoOwn, torsoOwn ? `(the torso's own: ${torsoOwn})` : '');
  }
}
