// The low-poly bald head (male and female) for the modeling reference sheets in tools/sculpt/HEAD_SPEC.md and
// tools/sculpt/HEAD_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs:
//
//   node tools/sculpt/lowhead.mjs --who male|female        # prints the triangle counts per part
//
// One mesh per head: the head (hand-authored after the references' wireframes, mirrored, plus the ears, brows, eyes, lids and the male's mouth line
// as closed pieces set into it), the neck, and a shoulder stub. Units: the head two tall from the chin's underside
// (y 0) to the crown (y 2), z forward, x the head's left (the viewer's right in the front view), the ear's centre near
// z 0. Every polygon keeps its own normal when drawn (flat shading); `polys` keeps the quads for the wireframe.
//
// Parts: head (counted against the 350-700 triangle budget), neck, shoulders (the stub; left out of the top and the
// bottom views). Regions, for the proportion diagram: skull, face, neck. Materials: skin, brow, pupil, lid.

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
// and the nose's base; m the mouth with j the jaw's corner; ch the chin with jl the jaw line; u the chin's flat
// underside; g the neck's top under the jaw; n6 the nape; tb tc the nose's tip edge; nm and nf the neck (nf inside the shoulders).
export const FACES = [
  // the crown: a flat cap of three facets a side on the top ring a, then a band down to the ring t
  ['c', 'a0', 'a1'], ['c', 'a1', 'a2'], ['c', 'a2', 'a3'],
  ['a0', 'a1', 't1', 't0'], ['a1', 'a2', 't2', 't1'], ['a2', 'a3', 't3', 't2'],
  // the temple
  ['t1', 'f2', 'b3', 'b2'], ['t1', 't2', 'f3', 'f2'], ['f2', 'b4', 'b3'], ['f2', 'f3', 'b5', 'b4'],
  // the skull's side and back
  ['t2', 't3', 'f4', 'f3'], ['f3', 'f4', 'o6', 'e5', 'b5'],
  // the brow down to under the eyes: the nose's root, the eye's socket (inner, outer), the temple, the side, the back
  ['b1', 'b2', 'e2', 'e1'], ['b2', 'b3', 'e3', 'e2'], ['b3', 'b4', 'e4', 'e3'], ['b4', 'b5', 'e5', 'e4'],
  // the nose, as the references draw it: its bridge one flat plane from the brow ridge (b0 b1) straight down to the tip's
  // edge (tc tb), a side plane each side back into the cheek, and one underside (the cliff) from that edge back to the
  // face; nothing else at the tip
  ['b0', 'b1', 'tb', 'tc'], ['b1', 'tb', 'k1', 'e1'], ['tc', 'tb', 'k1', 'k0'],
  // under the eyes down to the cheekbones: the nose, the cheek under the eye, the cheekbone's top, the side, the back
  ['e1', 'e2', 'k2', 'k1'], ['e2', 'e3', 'k3', 'k2'], ['e3', 'e4', 'k4', 'k3'], ['e4', 'e5', 'k5', 'k4'], ['e5', 'o6', 'n6', 'k5'],
  // the cheekbones down to the mouth: the upper lip, the front of the cheek, the cheek's big plane to the jaw's corner
  ['k0', 'k1', 'm1', 'm0'], ['k1', 'k2', 'm2', 'm1'], ['k2', 'k3', 'j', 'm2'], ['k3', 'k4', 'j'], ['k4', 'k5', 'm5', 'j'],
  // the mouth down to the chin
  ['m0', 'm1', 'ch1', 'ch0'], ['m1', 'm2', 'jl', 'ch1'], ['m2', 'j', 'jl'],
  // the chin's flat underside and the jaw's underside back to the neck
  ['ch0', 'ch1', 'u1', 'u0'], ['u0', 'u1', 'g1', 'g0'], ['u1', 'ch1', 'jl', 'g1'], ['jl', 'j', 'g2', 'g1'], ['j', 'm5', 'g3', 'g2'], ['m5', 'k5', 'n6', 'g3'],
];
// The back of the skull: large facets that span the centre line (no seam down the middle), fanning round the back's
// bump bk from the crown to the nape; emitted once, a name with ' the other side's vertex.
export const SPAN_FACES = [
  // the forehead: one plane across the centre line, from the skull's top ring to the brow
  ['t0', 't1', 'b2', 'b1', 'b0', "b1'", "b2'", "t1'"],
  ['a3', "t3'", 't3'],
  ['bk', 't3', "t3'"], ['bk', "t3'", "f4'"], ['bk', "f4'", "o6'"], ['bk', "o6'", 'o6'], ['bk', 'o6', 'f4'], ['bk', 'f4', 't3'],
  ['o6', "o6'", "n6'", 'n6'],
];
export const SPAN_NECK_FACES = [["n6'", 'n6', 'nm4', 'nm5', "nm4'"]];
export const NECK_FACES = [
  ['g0', 'g1', 'nm1', 'nm0'], ['g1', 'g2', 'nm2', 'nm1'], ['g2', 'g3', 'nm3', 'nm2'], ['g3', 'n6', 'nm4', 'nm3'],
  ['nm0', 'nm1', 'nf1', 'nf0'], ['nm1', 'nm2', 'nf2', 'nf1'], ['nm2', 'nm3', 'nf3', 'nf2'], ['nm3', 'nm4', 'nf4', 'nf3'], ['nm4', 'nm5', 'nf5', 'nf4'],
  ['nf0', 'nf1', 'nfc'], ['nf1', 'nf2', 'nfc'], ['nf2', 'nf3', 'nfc'], ['nf3', 'nf4', 'nfc'], ['nf4', 'nf5', 'nfc'],
];

// The shoulder stub, its own closed piece: the collar sc inside the neck (rising at the back, where the trapezius climbs
// toward the nape), the shoulders' line ss, the cut sb; eight round, so its planes stay as large as the reference's.
export const STUB_FACES = [
  ['sc0', 'sc1', 'ss1', 'ss0'], ['sc1', 'sc2', 'ss2', 'ss1'], ['sc2', 'sc3', 'ss3', 'ss2'], ['sc3', 'sc4', 'ss4', 'ss3'],
  ['ss0', 'ss1', 'sb1', 'sb0'], ['ss1', 'ss2', 'sb2', 'sb1'], ['ss2', 'ss3', 'sb3', 'sb2'], ['ss3', 'ss4', 'sb4', 'sb3'],
  ['sb0', 'sb1', 'sbc'], ['sb1', 'sb2', 'sbc'], ['sb2', 'sb3', 'sbc'], ['sb3', 'sb4', 'sbc'],
];

export const PRESETS = {
  male: {
    V: {
      c: [0, 2.09, 0.1], bk: [0, 1.38, -0.75],
      a0: [0, 2.03, 0.4], a1: [0.23, 2.01, 0.23], a2: [0.21, 2.01, -0.15], a3: [0, 2.03, -0.27],
      t0: [0, 1.86, 0.72], t1: [0.35, 1.85, 0.7], t2: [0.58, 1.88, -0.05], t3: [0.3, 1.88, -0.41],
      f2: [0.52, 1.5, 0.56], f3: [0.73, 1.47, -0.1], f4: [0.39, 1.5, -0.51],
      b0: [0, 1.22, 0.97], b1: [0.075, 1.22, 0.965], b2: [0.42, 1.22, 0.95], b3: [0.56, 1.2, 0.74], b4: [0.68, 1.18, 0.22], b5: [0.73, 1.16, -0.2],
      e1: [0.13, 0.97, 0.86], e2: [0.32, 0.93, 0.78], e3: [0.52, 0.95, 0.66], e4: [0.67, 0.95, 0.25], e5: [0.69, 0.92, -0.25], o6: [0.48, 0.98, -0.68],
      tc: [0, 0.615, 1.105], tb: [0.15, 0.615, 1.095],
      k0: [0, 0.53, 0.95], k1: [0.14, 0.565, 0.92], k2: [0.33, 0.66, 0.82], k3: [0.6, 0.74, 0.55], k4: [0.64, 0.7, 0.2], k5: [0.6, 0.66, -0.25], n6: [0.45, 0.65, -0.52],
      m0: [0, 0.3, 0.89], m1: [0.16, 0.3, 0.85], m2: [0.4, 0.36, 0.68], j: [0.56, 0.44, 0.25], m5: [0.55, 0.5, -0.15],
      ch0: [0, 0, 0.84], ch1: [0.18, 0, 0.8], jl: [0.4, 0.18, 0.55],
      u0: [0, -0.01, 0.62], u1: [0.19, -0.01, 0.6],
      g0: [0, -0.02, 0.38], g1: [0.33, 0.03, 0.3], g2: [0.524, 0.28, 0.05], g3: [0.536, 0.42, -0.28],
      nm0: [0, -0.15, 0.43], nm1: [0.365, -0.12, 0.34], nm2: [0.547, -0.08, 0.02], nm3: [0.524, -0.02, -0.3], nm4: [0.365, 0.02, -0.48], nm5: [0, 0.04, -0.52],
      nf0: [0, -0.5, 0.42], nf1: [0.342, -0.48, 0.33], nf2: [0.513, -0.45, 0.01], nf3: [0.49, -0.42, -0.28], nf4: [0.342, -0.4, -0.45], nf5: [0, -0.4, -0.49], nfc: [0, -0.46, -0.03],
      sc0: [0, -0.18, 0.34], sc1: [0.342, -0.13, 0.25], sc2: [0.479, -0.08, -0.1], sc3: [0.376, -0.1, -0.4], sc4: [0, -0.1, -0.48],
      ss0: [0, -0.66, 0.52], ss1: [0.6, -0.55, 0.4], ss2: [0.92, -0.44, -0.1], ss3: [0.62, -0.42, -0.68], ss4: [0, -0.48, -0.86],
      sb0: [0, -0.92, 0.6], sb1: [0.55, -0.92, 0.42], sb2: [0.66, -0.92, -0.06], sb3: [0.52, -0.92, -0.48], sb4: [0, -0.92, -0.56], sbc: [0, -0.92, 0],
    },
    ear: { c: [0.6, 0.84, -0.03], zs: 1.35, tilt: 0.2, s: 1.05, gap: 0.03, flare: 0.33, lift: 0.18, thick: 0.14 },
    brow: { x: [0.17, 0.32, 0.46, 0.56], yb: [1.155, 1.165, 1.16, 1.15], h: [0.085, 0.085, 0.075, 0.06], out: 0.055 },
    eye: { x: 0.31, y: 1.0, w: 0.11, h: 0.09, lid: 0.03, almond: 0 },
    mouth: { y: 0.27, w: 0.15, d: 0.008 },
  },
};

/** The female head: the same vertices and faces, moved to her proportions. */
PRESETS.female = {
  V: {
    c: [0, 2.07, 0.06], bk: [0, 1.38, -0.81],
    a0: [0, 2.02, 0.3], a1: [0.18, 2.0, 0.14], a2: [0.16, 2.0, -0.16], a3: [0, 2.02, -0.26],
    t0: [0, 1.86, 0.65], t1: [0.31, 1.85, 0.63], t2: [0.52, 1.88, -0.08], t3: [0.27, 1.88, -0.41],
    f2: [0.49, 1.5, 0.51], f3: [0.69, 1.47, -0.14], f4: [0.36, 1.5, -0.58],
    b0: [0, 1.07, 0.915], b1: [0.045, 1.07, 0.91], b2: [0.2, 1.17, 0.87], b3: [0.5, 1.2, 0.7], b4: [0.6, 1.16, 0.2], b5: [0.67, 1.15, -0.24],
    e1: [0.12, 0.96, 0.83], e2: [0.31, 0.93, 0.82], e3: [0.48, 0.95, 0.67], e4: [0.575, 0.93, 0.26], e5: [0.6, 0.9, -0.28], o6: [0.43, 0.98, -0.75],
    tc: [0, 0.6, 1.06], tb: [0.105, 0.6, 1.048],
    k0: [0, 0.535, 0.9], k1: [0.11, 0.57, 0.86], k2: [0.3, 0.67, 0.82], k3: [0.47, 0.74, 0.6], k4: [0.545, 0.72, 0.2], k5: [0.5, 0.66, -0.22], n6: [0.36, 0.62, -0.47],
    m0: [0.0, 0.4, 0.863], m1: [0.098, 0.4, 0.84], m2: [0.32, 0.45, 0.74], j: [0.42, 0.56, 0.38], m5: [0.48, 0.57, -0.15],
    ch0: [0, 0.15, 0.8], ch1: [0.08, 0.15, 0.78], jl: [0.25, 0.29, 0.7],
    u0: [0, 0.14, 0.66], u1: [0.09, 0.14, 0.64],
    g0: [0, 0.15, 0.26], g1: [0.19, 0.19, 0.21], g2: [0.31, 0.3, 0.02], g3: [0.33, 0.42, -0.24],
    nm0: [0, -0.2, 0.28], nm1: [0.21, -0.18, 0.22], nm2: [0.32, -0.14, 0], nm3: [0.31, -0.08, -0.26], nm4: [0.22, -0.04, -0.38], nm5: [0, -0.02, -0.42],
    nf0: [0, -0.55, 0.26], nf1: [0.2, -0.53, 0.2], nf2: [0.3, -0.5, 0], nf3: [0.29, -0.47, -0.24], nf4: [0.2, -0.45, -0.35], nf5: [0, -0.45, -0.39], nfc: [0, -0.5, -0.06],
    sc0: [0, -0.32, 0.22], sc1: [0.2, -0.29, 0.17], sc2: [0.29, -0.25, -0.06], sc3: [0.21, -0.2, -0.29], sc4: [0, -0.12, -0.36],
    ss0: [0, -0.76, 0.4], ss1: [0.52, -0.66, 0.3], ss2: [0.83, -0.64, -0.08], ss3: [0.52, -0.62, -0.52], ss4: [0, -0.64, -0.7],
    sb0: [0, -0.98, 0.52], sb1: [0.44, -0.98, 0.38], sb2: [0.55, -0.98, -0.06], sb3: [0.42, -0.98, -0.38], sb4: [0, -0.98, -0.46], sbc: [0, -0.98, 0],
  },
  ear: { c: [0.56, 0.77, -0.03], zs: 1.3, tilt: 0.18, s: 0.88, gap: 0.025, flare: 0.3, lift: 0.16, thick: 0.12 },
  // measured off her reference's front view: thick and blunt at the inner end, the top nearly level to its peak near
  // the outer third, the underside rising, the outer end a point angled down
  brow: { x: [0.2, 0.36, 0.5, 0.57, 0.62], yb: [1.162, 1.192, 1.226, 1.23, 1.2], h: [0.115, 0.09, 0.058, 0.045, 0.01], out: 0.04 },
  eye: { x: 0.345, y: 0.975, w: 0.14, h: 0.13, lid: 0.035, almond: 1 },
};

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowHead(who = 'male') {
  const P = PRESETS[who];
  if (!P) throw new Error(`no head ${who}`);
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const poly = (v, part, region, mat = 'skin') => polys.push({ v, part, region, mat });

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
  for (const s of [1, -1]) {
    for (const f of FACES) { const v = outward(f.map((n) => ids[s][n])); poly(v, 'head', regionOf(v)); }
    for (const f of NECK_FACES) poly(outward(f.map((n) => ids[s][n])), 'neck', 'neck');
    for (const f of STUB_FACES) poly(outward(f.map((n) => ids[s][n])), 'shoulders', 'neck');
  }
  const span = (n) => (n.endsWith("'") ? ids[-1][n.slice(0, -1)] : ids[1][n]);
  for (const f of SPAN_FACES) { const v = outward(f.map(span)); poly(v, 'head', 'skull'); }
  for (const f of SPAN_NECK_FACES) poly(outward(f.map(span)), 'neck', 'neck');

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
      facePoly([on(x0, y0, 0.022), on(x1, y0, 0.022), on(x1, y1, 0.022), on(x0, y1, 0.022)], s, "pupil");
      // The lid: a strip along the pupil's top edge, from past its inner corner to past its outer one; the almond lid
      // thins to a wing that flicks up and out.
      const a = e.almond;
      const xs = a ? [x0 - 0.035, e.x, x1 + 0.05, x1 + 0.17] : [x0 - 0.035, e.x, x1 + 0.035];
      const yb = a ? [y1 - 0.03, y1 - 0.012, y1 - 0.0, y1 + 0.065] : [y1 - 0.004, y1, y1 - 0.006];
      const hh = a ? [0.03, 0.05, 0.045, 0.012] : [0.03, 0.034, 0.026];
      // each section stands off the skin along the head's outward direction there, so the wing clears the side of the face
      const off = (x, y, d) => { const p = on(x, y, 0); const o = unit([p[0], 0, p[2] - 0.1]); return add(p, mul(o, d)); };
      const sec = xs.map((x, i) => [off(x, yb[i], e.lid), off(x, yb[i] + hh[i], e.lid * 0.5), off(x, yb[i] + hh[i], -0.03), off(x, yb[i], -0.03)]);
      const ids = sec.map((q) => q.map((p) => vert(flip(p, s))));
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'lid');
      for (let i = 0; i + 1 < ids.length; i++) {
        const A = ids[i], B = ids[i + 1];
        o([A[0], B[0], B[1], A[1]]);
        o([A[1], B[1], B[2], A[2]]);
        o([A[3], B[3], B[0], A[0]]);
      }
      o([...ids[0]].reverse()); o(ids[ids.length - 1]);
    });
  }

  // The mouth (the male head): no lips, only a low ledge across the upper lip whose underside makes the mouth's line.
  if (P.mouth) {
    const M = P.mouth;
    const xs = [0, M.w * 0.55, M.w];
    const T = xs.map((x, i) => on(x, M.y + 0.03 - i * 0.004, 0.0));
    const F = xs.map((x, i) => on(x, M.y - i * 0.006, i === 2 ? 0.002 : M.d * (i === 0 ? 1 : 0.8)));
    const B = xs.map((x, i) => on(x, M.y - 0.012 - i * 0.004, -0.002));
    both((s) => {
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face');
      const t = T.map((p) => vert(flip(p, s))), f = F.map((p) => vert(flip(p, s))), b = B.map((p) => vert(flip(p, s)));
      for (let i = 0; i < 2; i++) { o([t[i], f[i], f[i + 1], t[i + 1]]); o([f[i], b[i], b[i + 1], f[i + 1]]); }
    });
  }

  // The ears: a bevelled slab off the head's side, its outline a rounded C (a round top, a narrower lobe), tilted
  // back; on its outer face the helix's rim, the antihelix's fold standing inside it, the concha sunk in the middle
  // and opening forward, a back that meets the head.
  {
    const E = P.ear;
    const outline = [[0.1, 0.22], [0.04, 0.29], [-0.05, 0.315], [-0.13, 0.28], [-0.18, 0.18], [-0.19, 0.04], [-0.16, -0.1], [-0.11, -0.22], [-0.04, -0.29], [0.05, -0.25]];
    both((s) => {
      const rim = outline.map(([dz, dy]) => {
        const z = (dz * (E.zs ?? 1) - dy * (E.tilt ?? 0)) * E.s, y = dy * E.s;
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
      const fold = rim.map((p) => add(lerp(cf, p, 0.6), mul(n, 0.028 * E.s)));
      const concha = rim.map((p) => add(lerp(cf, p, 0.36), mul(n, 0.0)));
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
