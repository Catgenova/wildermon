// The low-poly bald head (male and female) for the modeling reference sheets in tools/sculpt/HEAD_SPEC.md and
// tools/sculpt/HEAD_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs:
//
//   node tools/sculpt/lowhead.mjs --who male|female        # prints the triangle counts per part
//
// One mesh per head: the head (hand-authored after the references' wireframes, mirrored, plus the ears, brows, eyes and lids as closed pieces
// set into it; no mouth, as the references have none), the neck, and a shoulder stub. Units: the head two tall from the chin's underside
// (y 0) to the crown (y 2), z forward, x the head's left (the viewer's right in the front view), the ear's centre near
// z 0. Every polygon keeps its own normal when drawn (flat shading); `polys` keeps the quads for the wireframe.
//
// Parts: head (counted against the 350-700 triangle budget), neck, shoulders (the stub; left out of the top and the
// bottom views). Regions, for the proportion diagram: skull, face, neck. Materials: skin, brow, pupil, lid.

import { existsSync, readFileSync } from 'node:fs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mx = (p) => [-p[0], p[1], p[2]];

/* ---- the two heads ---------------------------------------------------------------------------------------------- */
// The head is hand-authored after the reference sheets' own front wireframes: one half's vertices by name (x >= 0;
// the centre line at x 0 is shared), and one list of faces both heads use, mirrored for the other half. Rings, top to
// bottom: the crown c; t the skull's top; f the temple and the skull's side and back; b the brow; e under the eyes; k the cheekbones
// and the nose's base; j the jaw's corner and m5 behind it; ch the chin with jl the jaw line; u the chin's flat
// underside; g the neck's top under the jaw; n6 the nape; tb tc the nose's tip edge; nm the neck's foot, where the shoulders begin.
export const FACES = [
  // the crown: a flat cap of three facets a side on the top ring a, then a band down to the ring t
  ['c', 'a0', 'a1'], ['c', 'a1', 'a2'], ['c', 'a2', 'a3'],
  ['a0', 'a1', 't1', 't0'], ['a1', 'a2', 't2', 't1'], ['a2', 'a3', 't3', 't2'],
  // the temple, from the vertical (t1 down to the brow line at the brow's middle, bm) out, as the references' wireframes
  ['t1', 'f2', 'b3', 'bm'], ['t1', 't2', 'f3', 'f2'], ['f2', 'b4', 'b3'], ['f2', 'f3', 'b5', 'b4'],
  // the skull's side and back
  ['t2', 't3', 'f4', 'f3'], ['f3', 'f4', 'o6', 'e5', 'b5'],
  // the brow line (b2 bm b3, along the brows' top, across the face as the references' wireframes draw it) down to under
  // the eyes: the nose's root, the eye's socket, the temple, the side, the back
  ['b1', 'b2', 'e2', 'e1'], ['b2', 'bm', 'e2'], ['bm', 'b3', 'e3', 'e2'], ['b3', 'b4', 'e4', 'e3'], ['b4', 'b5', 'e5', 'e4'],
  // the nose, as the references draw it: its bridge one flat plane from the brow ridge (b0 b1) straight down to the tip's
  // edge (tc tb), a side plane each side back into the cheek, and one underside (the cliff) from that edge back to the
  // face; nothing else at the tip
  ['b0', 'b1', 'tb', 'tc'], ['b1', 'tb', 'k1', 'e1'], ['tc', 'tb', 'k1', 'k0'],
  // under the eyes down to the nose's base: the cheek one plane from the nose to the face's side, as the references
  // draw it; the side plane under the eye; the side; the back
  ['e1', 'e2', 'e3', 'k3', 'k2', 'k1'], ['e3', 'e4', 'k4', 'k3'], ['e4', 'e5', 'k5', 'k4'], ['e5', 'o6', 'n6', 'k5'],
  // the lower face, as the references' wireframes draw it: one strip down the middle from under the nose to the chin,
  // one large cheek plane each side from the cheekbones down to the jaw line, and the side down to the jaw's corner
  ['k0', 'k1', 'ch1', 'ch0'], ['k1', 'k2', 'k3', 'jl', 'ch1'], ['k3', 'j', 'jl'], ['k3', 'k4', 'j'], ['k4', 'k5', 'm5', 'j'],
  // the chin's flat underside and the jaw's underside back to the neck
  ['ch0', 'ch1', 'u1', 'u0'], ['u0', 'u1', 'g1', 'g0'], ['u1', 'ch1', 'jl', 'g1'], ['jl', 'j', 'g2', 'g1'], ['j', 'm5', 'g3', 'g2'], ['m5', 'k5', 'n6', 'g3'],
];
// The back of the skull: large facets that span the centre line (no seam down the middle), from the crown to the nape;
// emitted once, a name with ' the other side's vertex.
export const SPAN_FACES = [
  // the forehead: one plane across the centre line, from the skull's top ring and the verticals (t1 bm) down to the brow line (bm b2 gl b2' bm'); below it,
  // between the brows, the nose's root down to the bridge's top (b1 b0 b1'): a T on the male, a V on the female
  ['t0', 't1', 'bm', 'b2', 'gl', "b2'", "bm'", "t1'"],
  ['gl', 'b2', 'b1', 'b0', "b1'", "b2'"],
  ['a3', "t3'", 't3'],
  // the back of the skull from the skull's top ring (t3 t3') down to the occipital crease (o6 bk o6'), as the
  // references' back views draw it: a middle plane from the occiput (bk) up to the top ring and one plane each side,
  // every face meeting bk (bk stands behind the plane of its neighbours: one seven-sided face clipped from bk's own
  // corner left a fin, o6 bk o6', standing out of the skull)
  ['bk', "o6'", "f4'", "t3'"], ['bk', "t3'", 't3'], ['bk', 't3', 'f4', 'o6'],
  // under the occipital crease (o6 bk o6', at the ears' top, as the references' backs have it) down to the nape: a
  // middle plane and one each side, from bk
  ['bk', "o6'", "n6'"], ['bk', "n6'", 'n6'], ['bk', 'n6', 'o6'],
];
export const SPAN_NECK_FACES = [["n6'", 'n6', 'nm4', 'nm5', "nm4'"]];
export const NECK_FACES = [
  ['g0', 'g1', 'nm1', 'nm0'], ['g1', 'g2', 'nm2', 'nm1'], ['g2', 'g3', 'nm3', 'nm2'], ['g3', 'n6', 'nm4', 'nm3'],
];

// The shoulder stub, one surface with the neck as the references draw it: the neck's foot nm is where the trapezius and
// the chest begin (low at the front, at the notch, high at the back, where the trapezius climbs toward the nape); the
// shoulders' line ss; the cut sb; eight round, so its planes stay as large as the reference's.
export const STUB_FACES = [
  ['nm0', 'nm1', 'ss1', 'ss0'], ['nm1', 'nm2', 'ss2', 'ss1'], ['nm2', 'nm3', 'nm4', 'ss3', 'ss2'], ['nm4', 'nm5', 'ss4', 'ss3'],
  ['ss0', 'ss1', 'sb1', 'sb0'], ['ss1', 'ss2', 'sb2', 'sb1'], ['ss2', 'ss3', 'sb3', 'sb2'], ['ss3', 'ss4', 'sb4', 'sb3'],
  ['sb0', 'sb1', 'sbc'], ['sb1', 'sb2', 'sbc'], ['sb2', 'sb3', 'sbc'], ['sb3', 'sb4', 'sbc'],
];
// The male's stub, as his reference's front wireframe and views draw it: the neck's front strip (nm0 nm1) runs on down
// as the chest's middle plane to the cut; beside it the chest's plane from the strip's foot and the
// neck's side (nm2) out to the shoulder's lower corner (so) and down to the cut; over it the shoulder's top from the neck
// (nm2 nm3) to the shoulder's corner ss2; behind, the trapezius from the nape (nm3 nm4 nm5) to ss3 and ss4; below the
// shoulder the side and the back down to the cut sb2..sb5. Used when the preset names the vertex so.
export const STUB_FACES_CHEST = [
  ['nm0', 'nm1', 'sb1', 'sb0'], ['nm1', 'nm2', 'so', 'sb2', 'sb1'],
  ['nm2', 'nm3', 'ss2', 'so'], ['nm3', 'nm4', 'ss3', 'ss2'], ['nm4', 'nm5', 'ss4', 'ss3'],
  ['so', 'ss2', 'sb3', 'sb2'], ['ss2', 'ss3', 'sb4', 'sb3'], ['ss3', 'ss4', 'sb5', 'sb4'],
  ['sb0', 'sb1', 'sbc'], ['sb1', 'sb2', 'sbc'], ['sb2', 'sb3', 'sbc'], ['sb3', 'sb4', 'sbc'], ['sb4', 'sb5', 'sbc'],
];

export const PRESETS = {
  male: {
    V: {
      c: [0, 2.09, 0.1], bk: [0, 1.38, -0.75],
      a0: [0, 2.03, 0.4], a1: [0.23, 2.01, 0.23], a2: [0.21, 2.01, -0.15], a3: [0, 2.03, -0.27],
      t0: [0, 1.86, 0.72], t1: [0.35, 1.85, 0.7], t2: [0.58, 1.88, -0.05], t3: [0.3, 1.88, -0.41],
      f2: [0.64, 1.5, 0.52], f3: [0.73, 1.47, -0.1], f4: [0.39, 1.5, -0.51],
      gl: [0, 1.225, 0.85], bm: [0.34, 1.24, 0.83], b0: [0, 1.22, 0.97], b1: [0.075, 1.22, 0.965], b2: [0.42, 1.22, 0.95], b3: [0.6, 1.2, 0.74], b4: [0.71, 1.18, 0.18], b5: [0.73, 1.16, -0.2],
      e1: [0.13, 0.97, 0.86], e2: [0.32, 0.93, 0.78], e3: [0.52, 0.95, 0.66], e4: [0.67, 0.95, 0.25], e5: [0.69, 0.92, -0.25], o6: [0.48, 0.98, -0.68],
      tc: [0, 0.615, 1.105], tb: [0.15, 0.615, 1.095],
      k0: [0, 0.53, 0.95], k1: [0.14, 0.565, 0.92], k2: [0.33, 0.66, 0.82], k3: [0.6, 0.74, 0.55], k4: [0.64, 0.7, 0.2], k5: [0.6, 0.66, -0.25], n6: [0.45, 0.65, -0.52],
      j: [0.56, 0.44, 0.25], m5: [0.55, 0.5, -0.15],
      ch0: [0, 0, 0.84], ch1: [0.18, 0, 0.8], jl: [0.4, 0.18, 0.55],
      u0: [0, -0.01, 0.62], u1: [0.19, -0.01, 0.6],
      g0: [0, -0.02, 0.38], g1: [0.33, 0.03, 0.3], g2: [0.524, 0.28, 0.05], g3: [0.536, 0.42, -0.28],
      nm0: [0, -0.15, 0.43], nm1: [0.365, -0.12, 0.34], nm2: [0.547, -0.08, 0.02], nm3: [0.524, -0.02, -0.3], nm4: [0.365, 0.02, -0.48], nm5: [0, 0.04, -0.52],
     
     
      ss0: [0, -0.66, 0.52], ss1: [0.6, -0.55, 0.4], ss2: [0.92, -0.44, -0.1], ss3: [0.62, -0.42, -0.68], ss4: [0, -0.48, -0.86],
      sb0: [0, -0.92, 0.6], sb1: [0.55, -0.92, 0.42], sb2: [0.66, -0.92, -0.06], sb3: [0.52, -0.92, -0.48], sb4: [0, -0.92, -0.56], sbc: [0, -0.92, 0],
    },
    ear: { c: [0.6, 0.84, -0.03], zs: 1.35, tilt: 0.2, s: 1.05, gap: 0.03, flare: 0.33, lift: 0.18, thick: 0.14 },
    brow: { x: [0.17, 0.32, 0.46, 0.56], yb: [1.155, 1.165, 1.16, 1.15], h: [0.085, 0.085, 0.075, 0.06], out: 0.055 },
    // the pupils and the lid's ledge measured off his reference's front view
    eye: { x: 0.317, y: 1.02, w: 0.11, h: 0.1, lid: 0.03, almond: 0,
      ledge: { x: [0.13, 0.22, 0.32, 0.43, 0.53], yb: [1.05, 1.047, 1.047, 1.047, 1.047], yt: [1.12, 1.11, 1.105, 1.105, 1.105], out: 0.05, up: 0.04 } },
  },
};

/** The female head: the same vertices and faces, moved to her proportions. */
PRESETS.female = {
  V: {
    c: [0, 2.07, 0.06], bk: [0, 1.38, -0.81],
    a0: [0, 2.02, 0.3], a1: [0.18, 2.0, 0.14], a2: [0.16, 2.0, -0.16], a3: [0, 2.02, -0.26],
    t0: [0, 1.86, 0.65], t1: [0.31, 1.85, 0.63], t2: [0.52, 1.88, -0.08], t3: [0.27, 1.88, -0.41],
    f2: [0.49, 1.5, 0.51], f3: [0.69, 1.47, -0.14], f4: [0.36, 1.5, -0.58],
    gl: [0, 1.254, 0.835], bm: [0.36, 1.27, 0.78], b0: [0, 1.07, 0.915], b1: [0.045, 1.07, 0.91], b2: [0.2, 1.17, 0.87], b3: [0.5, 1.2, 0.7], b4: [0.6, 1.16, 0.2], b5: [0.67, 1.15, -0.24],
    e1: [0.12, 0.96, 0.83], e2: [0.31, 0.93, 0.82], e3: [0.48, 0.95, 0.67], e4: [0.575, 0.93, 0.26], e5: [0.6, 0.9, -0.28], o6: [0.43, 0.98, -0.75],
    tc: [0, 0.6, 1.06], tb: [0.105, 0.6, 1.048],
    k0: [0, 0.535, 0.9], k1: [0.11, 0.57, 0.86], k2: [0.3, 0.67, 0.82], k3: [0.47, 0.74, 0.6], k4: [0.545, 0.72, 0.2], k5: [0.5, 0.66, -0.22], n6: [0.36, 0.62, -0.47],
    j: [0.52, 0.5, 0.3], m5: [0.52, 0.56, -0.15],
    ch0: [0, 0.15, 0.8], ch1: [0.12, 0.15, 0.78], jl: [0.37, 0.3, 0.6],
    u0: [0, 0.14, 0.66], u1: [0.09, 0.14, 0.64],
    g0: [0, 0.15, 0.26], g1: [0.19, 0.19, 0.21], g2: [0.31, 0.3, 0.02], g3: [0.33, 0.42, -0.24],
    nm0: [0, -0.2, 0.28], nm1: [0.21, -0.18, 0.22], nm2: [0.32, -0.14, 0], nm3: [0.31, -0.08, -0.26], nm4: [0.22, -0.04, -0.38], nm5: [0, -0.02, -0.42],
   
   
    ss0: [0, -0.76, 0.4], ss1: [0.52, -0.66, 0.3], ss2: [0.83, -0.64, -0.08], ss3: [0.52, -0.62, -0.52], ss4: [0, -0.64, -0.7],
    sb0: [0, -0.98, 0.52], sb1: [0.44, -0.98, 0.38], sb2: [0.55, -0.98, -0.06], sb3: [0.42, -0.98, -0.38], sb4: [0, -0.98, -0.46], sbc: [0, -0.98, 0],
  },
  ear: { c: [0.56, 0.77, -0.03], zs: 1.3, tilt: 0.18, s: 0.88, gap: 0.025, flare: 0.3, lift: 0.16, thick: 0.12 },
  // measured off her reference's front view: thick and blunt at the inner end, the top nearly level to its peak near
  // the outer third, the underside rising, the outer end a point angled down
  brow: { x: [0.2, 0.36, 0.5, 0.57, 0.62], yb: [1.162, 1.192, 1.226, 1.23, 1.2], h: [0.115, 0.09, 0.058, 0.045, 0.01], out: 0.04 },
  eye: { x: 0.345, y: 0.975, w: 0.14, h: 0.13, lid: 0.035, almond: 1 },
};

// The fitted vertices (tools/sculpt/lowfit.mjs) over the hand-set ones: tools/sculpt/lowfit-<who>.json, when present.
for (const who of Object.keys(PRESETS)) {
  const file = new URL(`./lowfit-${who}.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const fit = JSON.parse(readFileSync(file, 'utf8'));
  for (const k of ['V', 'ear', 'eye', 'brow']) if (fit[k]) PRESETS[who][k] = { ...PRESETS[who][k], ...fit[k] };
}

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowHead(who = 'male', preset = null) {
  const P = preset ?? PRESETS[who];
  if (!P) throw new Error(`no head ${who}`);
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const poly = (v, part, region, mat = 'skin', name) => polys.push({ v, part, region, mat, ...(name ? { name } : {}) });

  // The head, the neck and the stub from the hand-authored halves: a centre-line vertex once, the others once a side.
  const ids = { 1: {}, [-1]: {} };
  for (const [name, p] of Object.entries(P.V)) {
    if (p[0] === 0) ids[1][name] = ids[-1][name] = vert([...p]);
    else { ids[1][name] = vert([...p]); ids[-1][name] = vert(mx(p)); }
  }
  // Every face wound to look out, away from the head's (or the neck's) axis at its own height.
  const outward = (v) => {
    const pts = v.map((i) => verts[i]);
    const c = mul(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
    const axis = [0, Math.min(1.9, Math.max(-0.5, c[1])), c[1] > 0.5 ? 0.1 : 0.0];
    return dot(n, sub(c, axis)) < 0 ? [...v].reverse() : v;
  };
  const regionOf = (v) => {
    const c = mul(v.map((i) => verts[i]).reduce((a, p) => add(a, p), [0, 0, 0]), 1 / v.length);
    return c[2] > 0.15 && c[1] < 1.25 ? 'face' : 'skull';
  };
  const stub = P.V.so ? STUB_FACES_CHEST : STUB_FACES;
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'R' : 'L';
    for (const f of FACES) { const v = outward(f.map((n) => ids[s][n])); poly(v, 'head', regionOf(v), 'skin', f.join('-') + ':' + sd); }
    for (const f of NECK_FACES) poly(outward(f.map((n) => ids[s][n])), 'neck', 'neck', 'skin', 'neck ' + f.join('-') + ':' + sd);
    for (const f of stub) poly(outward(f.map((n) => ids[s][n])), 'shoulders', 'neck', 'skin', 'stub ' + f.join('-') + ':' + sd);
  }
  const span = (n) => (n.endsWith("'") ? ids[-1][n.slice(0, -1)] : ids[1][n]);
  for (const f of SPAN_FACES) { const v = outward(f.map(span)); poly(v, 'head', 'skull', 'skin', f.join('-')); }
  for (const f of SPAN_NECK_FACES) poly(outward(f.map(span)), 'neck', 'neck', 'skin', 'neck ' + f.join('-'));

  // Where the face's surface is at (x, y): the front-most hit of a ray along -z on the head.
  const lattice = polys.filter((p) => p.part === 'head').flatMap((p) => tris(p.v, verts));
  const surf = (x, y) => {
    let best = -Infinity;
    for (const [a, b, c] of lattice) {
      const A = verts[a], B = verts[b], C = verts[c];
      const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(d) < 1e-9) continue;
      const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
      const l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      best = Math.max(best, l1 * A[2] + l2 * B[2] + l3 * C[2]);
    }
    return best;
  };
  const on = (x, y, out = 0) => [x, y, surf(x, y) + out];
  /** A closed piece from its outer loop and a loop sunk into the head: the cap, the band between, the sunk cap. */
  const both = (fn) => { fn(1); fn(-1); };
  const flip = (p, s) => (s > 0 ? p : mx(p));
  const facePoly = (pts, s, mat, region = 'face') => {
    const ids = pts.map((p) => vert(flip(p, s)));
    poly(s > 0 ? ids : [...ids].reverse(), 'head', region, mat);
    return ids;
  };

  // The brows: a strip along the brow's points, its front and top and underside, the ends closed; it stands off the head
  // along the head's outward direction there, so the outer end wraps round the temple.
  {
    const b = P.brow;
    const off = (x, y, d) => { const p = on(x, y, 0); const o = unit([p[0], 0, p[2] - 0.1]); return add(p, mul(o, d)); };
    both((s) => {
      const sec = b.x.map((x, i) => {
        const y0 = b.yb[i], y1 = b.yb[i] + b.h[i];
        // b.bevel (his): the front face only that share of the height, the top a bevel sloping up and back into the head
        if (b.bevel) return [off(x, y0, b.out), off(x, y0 + (y1 - y0) * b.bevel, b.out), off(x, y1, 0), off(x, y0, -0.04)];
        return [off(x, y0, b.out), off(x, y1, b.out * 0.7), off(x, y1, -0.04), off(x, y0, -0.04)];
      });
      const ids = sec.map((q) => q.map((p) => vert(flip(p, s))));
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'brow');
      for (let i = 0; i + 1 < ids.length; i++) {
        const A = ids[i], B = ids[i + 1];
        o([A[0], B[0], B[1], A[1]]); // front
        o([A[1], B[1], B[2], A[2]]); // top
        o([A[3], B[3], B[0], A[0]]); // underside
      }
      o([...ids[0]].reverse()); o(ids[ids.length - 1]);
    });
  }

  // The eyes: a dark square pupil under an angular lid that juts over it.
  {
    const e = P.eye;
    both((s) => {
      const x0 = e.x - e.w / 2, x1 = e.x + e.w / 2, y0 = e.y - e.h / 2, y1 = e.y + e.h / 2;
      // the pupil a small box standing off the skin along the head's outward direction (e.pop), so the side views see
      // it as the references draw it; its back sunk into the head
      {
        const out = (x, y, d) => { const p = on(x, y, 0); const o = unit([p[0], 0, p[2] - 0.1]); return add(p, mul(o, d)); };
        const pop = e.pop ?? 0.022;
        const F = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        // the face clears the skin everywhere over it, not only at its corners (a ridge in the socket under the pupil
        // would show through it): its stand-off grows by the most the skin rises above the corners' plane
        const zc = F.map(([x, y]) => surf(x, y));
        let rise = 0;
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
          const u = i / 8, v = j / 8;
          const zb = (zc[0] * (1 - u) + zc[1] * u) * (1 - v) + (zc[3] * (1 - u) + zc[2] * u) * v;
          rise = Math.max(rise, surf(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v) - zb);
        }
        // its lower edge stands off less than its upper, so the bottom view sees the pupil's face, not a block
        // the face pushed straight forward, so it stays square from the front
        const fwd = (x, y, d) => { const p = on(x, y, 0); return [p[0], p[1], p[2] + d]; };
        const fr = F.map(([x, y]) => vert(flip(fwd(x, y, rise + (y < e.y ? pop * 0.35 : pop)), s))), bk = F.map(([x, y]) => vert(flip(out(x, y, -0.02), s)));
        const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'pupil');
        o(fr);
        for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; o([bk[i], bk[j], fr[j], fr[i]]); }
      }
      // The lid: a strip along the pupil's top edge, from past its inner corner to past its outer one; the almond lid
      // thins to a wing that flicks up and out.
      const a = e.almond, L = e.ledge;
      // e.ledge (his): the upper lid a ledge across the socket, as his reference draws it: a dark front band from
      // L.x[0] to its last x between the heights L.yb and L.yt, standing L.out off the skin, its top a skin plane sloping
      // up and back into the socket by L.up
      // e.line (hers): the almond lid's sections measured off her reference's front view (x, the underside's height yb,
      // the height h): a point at the inner corner, the band over the pupil, the wing's notch and its tip
      const W = e.line;
      const xs = L ? L.x : W ? W.x : a ? [x0 - 0.01, e.x, x1 + 0.03, x1 + 0.15] : [x0 - 0.035, e.x, x1 + 0.035];
      const yb = L ? L.yb : W ? W.yb : a ? [y1 - 0.028, y1 - 0.026, y1 - 0.018, y1 + 0.045] : [y1 + 0.004, y1 + 0.008, y1 + 0.002];
      const hh = L ? L.yt.map((t, i) => t - L.yb[i]) : W ? W.h : a ? [0.028, 0.042, 0.038, 0.012] : [0.03, 0.034, 0.026];
      // each section stands off the skin along the head's outward direction there, so the wing clears the side of the face
      const off = (x, y, d) => { const p = on(x, y, 0); const o = unit([p[0], 0, p[2] - 0.1]); return add(p, mul(o, d)); };
      const sec = xs.map((x, i) => L
        ? [off(x, yb[i], L.out), off(x, yb[i] + hh[i], L.out * 0.85), off(x, yb[i] + hh[i] + L.up, -0.03), off(x, yb[i], -0.03)]
        : [off(x, yb[i], e.lid), off(x, yb[i] + hh[i], e.lid * 0.5), off(x, yb[i] + hh[i], -0.03), off(x, yb[i], -0.03)]);
      const ids = sec.map((q) => q.map((p) => vert(flip(p, s))));
      const o = (v, mat = 'lid') => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', mat);
      for (let i = 0; i + 1 < ids.length; i++) {
        const A = ids[i], B = ids[i + 1];
        o([A[0], B[0], B[1], A[1]]);
        o([A[1], B[1], B[2], A[2]], L ? 'skin' : 'lid');
        o([A[3], B[3], B[0], A[0]]);
      }
      o([...ids[0]].reverse()); o(ids[ids.length - 1]);
    });
  }

  // The ears: a bevelled slab off the head's side, its outline a rounded C (a round top, a narrower lobe), tilted
  // back; on its outer face the helix's rim, the antihelix's fold standing inside it, the concha sunk in the middle
  // and opening forward, a back that meets the head.
  {
    const E = P.ear;
    const outline = E.outline ?? [[0.1, 0.22], [0.04, 0.29], [-0.05, 0.315], [-0.13, 0.28], [-0.18, 0.18], [-0.19, 0.04], [-0.16, -0.1], [-0.11, -0.22], [-0.04, -0.29], [0.05, -0.25]];
    both((s) => {
      // E.outline: the rim's (forward, up) offsets from E.c in head units, as measured off the reference's profile
      const rim = outline.map(([dz, dy]) => {
        const z = E.outline ? dz : (dz * (E.zs ?? 1) - dy * (E.tilt ?? 0)) * E.s, y = E.outline ? dy : dy * E.s;
        const out = E.gap + (0.1 * E.s - z) * E.flare + (y + 0.3 * E.s) * E.lift;
        return [E.c[0] + out, E.c[1] + y, E.c[2] + z];
      });
      const c = mul(rim.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / rim.length);
      let n = [0, 0, 0];
      for (let i = 0; i < rim.length; i++) n = add(n, cross(rim[i], rim[(i + 1) % rim.length]));
      n = unit(n);
      if (n[0] < 0) n = mul(n, -1); // the outer face looks out
      const cf = add(c, [0, -0.02 * E.s, 0.05 * E.s]); // the concha's centre, toward the front and down: the C opens forward
      const face = rim.map((p) => add(lerp(c, p, 0.86), mul(n, 0.03 * E.s)));
      // E.flat: the outer face one flat plane inside the rim's bevel, no fold and no concha, as the references draw it
      const fold = rim.map((p) => add(lerp(cf, p, 0.6), mul(n, (E.flat ? 0.03 : 0.028) * E.s)));
      const concha = rim.map((p) => add(lerp(cf, p, 0.36), mul(n, E.flat ? 0.03 * E.s : 0.0)));
      const back = rim.map((p) => add(lerp(c, p, 0.9), mul(n, -E.thick * E.s)));
      const V = (arr) => arr.map((p) => vert(flip(p, s)));
      const R = V(rim), F = V(face), A = V(fold), C = V(concha), Bk = V(back);
      const o = (v) => { poly(s > 0 ? v : [...v].reverse(), 'head', 'skull'); polys[polys.length - 1].ear = true; };
      const N = rim.length;
      const wind = dot(cross(sub(rim[1], rim[0]), sub(rim[2], rim[0])), n) > 0;
      const w = (v) => (wind ? v : [...v].reverse());
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        o(w([R[i], R[j], F[j], F[i]]));   // the helix's outer bevel
        o(w([Bk[i], Bk[j], R[j], R[i]]));  // the side
        o(w([F[i], F[j], A[j], A[i]]));   // the helix's inner slope down to the fold
        o(w([A[i], A[j], C[j], C[i]]));   // the fold's wall down into the concha
      }
      o(w([...C]));
      o(w([...Bk].reverse()));
    });
  }

  // Triangles, each polygon fanned along its shorter diagonal (quads) or from its first point.
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts };
}

function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4 && verts) {
    const [a, b, c, d] = v.map((i) => verts[i]);
    // The split that folds outward (a ridge, not a crease): split along a-c when d lies behind the plane of a, b, c.
    const behind = dot(cross(sub(b, a), sub(c, a)), sub(d, a)) < 0;
    return behind ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
  }
  const out = [];
  for (let i = 1; i + 1 < v.length; i++) out.push([v[0], v[i], v[i + 1]]);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--who');
  for (const who of i < 0 ? ['male', 'female'] : [args[i + 1]]) {
    const m = buildLowHead(who);
    console.log(who, JSON.stringify(m.counts), 'verts', m.verts.length);
  }
}
