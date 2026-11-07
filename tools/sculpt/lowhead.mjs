// The low-poly bald head (male and female) for the modeling reference sheets in tools/sculpt/HEAD_SPEC.md and
// tools/sculpt/HEAD_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs:
//
//   node tools/sculpt/lowhead.mjs --who male|female        # prints the triangle counts per part
//
// One mesh per head: the head (a ring lattice of 16 columns, mirrored, plus the ears, nose, brows, eyes, lids and lips
// as closed pieces set into it), the neck, and a shoulder stub. Units: the head two tall from the chin's underside
// (y 0) to the crown (y 2), z forward, x the head's left (the viewer's right in the front view), the ear's centre near
// z 0. Every polygon keeps its own normal when drawn (flat shading); `polys` keeps the quads for the wireframe.
//
// Parts: head (counted against the 350-700 triangle budget), neck, shoulders (the stub; left out of the top and the
// bottom views). Regions, for the proportion diagram: skull, face, neck. Materials: skin, brow, pupil, lid, lip.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mx = (p) => [-p[0], p[1], p[2]];

// The columns: c0 the front's centre line, c1..c4 across the face, c5 the side, c6 and c7 the back's two, c8 the back's
// centre line. Skull rows place c0..c4 at these fractions of the half width, the back two at these.
const FRONT_F = [0, 0.22, 0.48, 0.76, 0.93, 1];
const BACK_F = [0.86, 0.5, 0];
const EXP = 2.3;
const arc = (f) => Math.pow(Math.max(0, 1 - Math.pow(f, EXP)), 1 / EXP);
const SIDE_T = [0, 0.02, 0.08, 0.2, 0.35, 0.5, 0.72, 0.9, 1];

/** A row from an ellipse: half width W, front depth F, back depth D about z0, its height yf at the front, yb at the back. */
function ellRow({ yf, yb = yf, W, F, D, z0 = 0, sideZ = 0 }) {
  const pts = [];
  FRONT_F.forEach((f, i) => pts.push([W * f, yf + (yb - yf) * SIDE_T[i], i === 5 ? z0 + sideZ : z0 + F * arc(f)]));
  BACK_F.forEach((f, i) => pts.push([W * f, yf + (yb - yf) * SIDE_T[6 + i], z0 - D * arc(f)]));
  return pts;
}
/** A face row: c0..c5 as given, the back three from the ellipse. */
function faceRow(front, back) {
  const e = ellRow({ yf: back.yb, yb: back.yb, W: back.W, F: 0, D: back.D, z0: back.z0 ?? 0 });
  return [...front, e[6], e[7], e[8]];
}

/* ---- the two heads ---------------------------------------------------------------------------------------------- */
export const PRESETS = {
  male: {
    crown: [0, 2.0, 0.04],
    skull: [
      { yf: 1.92, yb: 1.9, W: 0.3, F: 0.32, D: 0.3, z0: 0.06 },
      { yf: 1.76, yb: 1.72, W: 0.53, F: 0.66, D: 0.6, z0: 0.07 },
      { yf: 1.46, yb: 1.42, W: 0.63, F: 0.83, D: 0.78, z0: 0.08, sideZ: 0.02 },
    ],
    face: [
      // brow ridge
      { front: [[0, 1.2, 0.97], [0.15, 1.2, 0.96], [0.31, 1.2, 0.91], [0.47, 1.18, 0.79], [0.58, 1.16, 0.55], [0.63, 1.16, 0.12]], back: { yb: 1.18, W: 0.62, D: 0.78, z0: 0.08 } },
      // eyes
      { front: [[0, 1.0, 0.9], [0.14, 1.0, 0.86], [0.3, 0.99, 0.8], [0.47, 0.98, 0.71], [0.58, 0.98, 0.49], [0.61, 0.97, 0.1]], back: { yb: 0.98, W: 0.6, D: 0.73, z0: 0.08 } },
      // cheekbones
      { front: [[0, 0.76, 0.95], [0.14, 0.76, 0.9], [0.32, 0.78, 0.84], [0.5, 0.8, 0.68], [0.6, 0.8, 0.42], [0.6, 0.82, 0.07]], back: { yb: 0.8, W: 0.57, D: 0.67, z0: 0.07 } },
      // under the nose, the cheek's hollow
      { front: [[0, 0.53, 0.92], [0.14, 0.53, 0.88], [0.3, 0.55, 0.75], [0.44, 0.57, 0.55], [0.52, 0.61, 0.3], [0.55, 0.66, 0.0]], back: { yb: 0.66, W: 0.52, D: 0.61, z0: 0.06 } },
      // the mouth's line
      { front: [[0, 0.37, 0.875], [0.13, 0.37, 0.86], [0.27, 0.39, 0.73], [0.39, 0.45, 0.52], [0.48, 0.5, 0.27], [0.52, 0.57, -0.03]], back: { yb: 0.56, W: 0.48, D: 0.58, z0: 0.05 } },
      // chin's top
      { front: [[0, 0.24, 0.87], [0.13, 0.24, 0.85], [0.25, 0.27, 0.72], [0.35, 0.34, 0.5], [0.45, 0.42, 0.22], [0.5, 0.5, -0.06]], back: { yb: 0.48, W: 0.45, D: 0.55, z0: 0.04 } },
      // the jawline: the chin's flat underside's front edge, back to the jaw's angle and the nape
      { front: [[0, 0.0, 0.79], [0.13, 0.0, 0.77], [0.2, 0.05, 0.66], [0.3, 0.19, 0.47], [0.42, 0.33, 0.2], [0.47, 0.42, -0.08]], back: { yb: 0.4, W: 0.42, D: 0.52, z0: 0.03 } },
    ],
    // the neck's rings: the first under the jaw (the chin's underside between), the last hidden in the shoulders
    neck: [
      [[0, 0.08, 0.36], [0.13, 0.08, 0.35], [0.24, 0.11, 0.28], [0.32, 0.16, 0.16], [0.36, 0.22, 0.0], [0.37, 0.28, -0.16], [0.32, 0.31, -0.34], [0.18, 0.33, -0.44], [0, 0.34, -0.47]],
      { yf: -0.12, yb: 0.06, W: 0.36, F: 0.34, D: 0.44, z0: -0.06, sideZ: -0.06 },
      { yf: -0.42, yb: -0.3, W: 0.38, F: 0.38, D: 0.44, z0: -0.04, sideZ: -0.06 },
    ],
    // the shoulder stub: the collar inside the neck, the shoulders' line, the cut
    stub: [
      { yf: -0.2, yb: -0.06, W: 0.34, F: 0.32, D: 0.4, z0: -0.05, sideZ: -0.06 },
      { yf: -0.42, yb: -0.36, W: 0.82, F: 0.66, D: 0.62, z0: -0.04, sideZ: -0.08, ySide: -0.5 },
      { yf: -0.92, yb: -0.92, W: 0.92, F: 0.84, D: 0.72, z0: 0.0, sideZ: -0.06 },
    ],
    ear: { c: [0.6, 0.84, -0.03], s: 1.0, flare: 0.95, lift: 0.1, thick: 0.07 },
    nose: { top: 1.13, tip: 0.62, under: 0.55, wTop: 0.065, wBridge: 0.095, wWing: 0.135, out: 0.16, tipOut: 0.2 },
    brow: { x: [0.12, 0.33, 0.55], yb: [1.11, 1.12, 1.1], h: [0.075, 0.07, 0.05], out: 0.045 },
    eye: { x: 0.3, y: 1.0, w: 0.085, h: 0.07, lid: 0.04, almond: 0 },
    lips: null,
  },
};

/** The female head: the male's system with her proportions. */
PRESETS.female = {
  crown: [0, 2.0, 0.02],
  skull: [
    { yf: 1.92, yb: 1.9, W: 0.29, F: 0.32, D: 0.31, z0: 0.04 },
    { yf: 1.76, yb: 1.72, W: 0.51, F: 0.66, D: 0.62, z0: 0.05 },
    { yf: 1.46, yb: 1.42, W: 0.6, F: 0.8, D: 0.8, z0: 0.06, sideZ: 0.02 },
  ],
  face: [
    { front: [[0, 1.22, 0.92], [0.14, 1.22, 0.91], [0.29, 1.22, 0.86], [0.44, 1.2, 0.75], [0.55, 1.18, 0.52], [0.59, 1.17, 0.1]], back: { yb: 1.2, W: 0.59, D: 0.79, z0: 0.06 } },
    { front: [[0, 1.0, 0.86], [0.13, 1.0, 0.83], [0.28, 0.99, 0.78], [0.44, 0.98, 0.69], [0.55, 0.98, 0.47], [0.58, 0.97, 0.08]], back: { yb: 0.98, W: 0.57, D: 0.74, z0: 0.06 } },
    { front: [[0, 0.78, 0.9], [0.13, 0.78, 0.86], [0.3, 0.81, 0.8], [0.46, 0.84, 0.66], [0.56, 0.84, 0.4], [0.57, 0.85, 0.05]], back: { yb: 0.82, W: 0.54, D: 0.68, z0: 0.05 } },
    { front: [[0, 0.56, 0.87], [0.13, 0.56, 0.83], [0.27, 0.58, 0.72], [0.4, 0.61, 0.52], [0.48, 0.65, 0.28], [0.52, 0.69, 0.0]], back: { yb: 0.68, W: 0.5, D: 0.62, z0: 0.04 } },
    { front: [[0, 0.4, 0.84], [0.12, 0.4, 0.82], [0.23, 0.42, 0.69], [0.33, 0.48, 0.49], [0.43, 0.54, 0.24], [0.48, 0.6, -0.04]], back: { yb: 0.58, W: 0.46, D: 0.59, z0: 0.03 } },
    { front: [[0, 0.22, 0.82], [0.1, 0.22, 0.8], [0.19, 0.26, 0.67], [0.28, 0.34, 0.47], [0.38, 0.44, 0.2], [0.45, 0.52, -0.07]], back: { yb: 0.5, W: 0.43, D: 0.56, z0: 0.02 } },
    { front: [[0, 0.0, 0.74], [0.08, 0.0, 0.73], [0.14, 0.05, 0.62], [0.24, 0.19, 0.44], [0.36, 0.34, 0.18], [0.43, 0.44, -0.09]], back: { yb: 0.42, W: 0.4, D: 0.53, z0: 0.02 } },
  ],
  neck: [
    [[0, 0.07, 0.3], [0.1, 0.07, 0.29], [0.19, 0.1, 0.23], [0.26, 0.15, 0.13], [0.29, 0.22, -0.01], [0.3, 0.28, -0.15], [0.26, 0.31, -0.3], [0.15, 0.33, -0.38], [0, 0.34, -0.41]],
    { yf: -0.2, yb: -0.02, W: 0.29, F: 0.29, D: 0.38, z0: -0.06, sideZ: -0.05 },
    { yf: -0.55, yb: -0.42, W: 0.3, F: 0.32, D: 0.38, z0: -0.04, sideZ: -0.05 },
  ],
  stub: [
    { yf: -0.3, yb: -0.16, W: 0.27, F: 0.27, D: 0.35, z0: -0.05, sideZ: -0.05 },
    { yf: -0.55, yb: -0.48, W: 0.76, F: 0.58, D: 0.56, z0: -0.04, sideZ: -0.07, ySide: -0.62 },
    { yf: -0.98, yb: -0.98, W: 0.84, F: 0.72, D: 0.64, z0: 0.0, sideZ: -0.05 },
  ],
  ear: { c: [0.565, 0.86, -0.04], s: 0.82, flare: 0.8, lift: 0.08, thick: 0.06 },
  nose: { top: 1.12, tip: 0.66, under: 0.6, wTop: 0.045, wBridge: 0.07, wWing: 0.1, out: 0.12, tipOut: 0.16 },
  brow: { x: [0.11, 0.3, 0.5], yb: [1.13, 1.17, 1.13], h: [0.035, 0.03, 0.02], out: 0.03 },
  eye: { x: 0.28, y: 1.0, w: 0.085, h: 0.06, lid: 0.035, almond: 1 },
  lips: { y: 0.4, w: 0.15, upper: 0.05, lower: 0.055 },
};

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowHead(who = 'male') {
  const P = PRESETS[who];
  if (!P) throw new Error(`no head ${who}`);
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const poly = (v, part, region, mat = 'skin') => polys.push({ v, part, region, mat });

  /** A ring of 16 from nine points c0..c8 (x >= 0): c0, c1..c7, c8, c7'..c1'. */
  const ring = (pts) => {
    const idx = new Array(16);
    idx[0] = vert(pts[0]); idx[8] = vert(pts[8]);
    for (let i = 1; i < 8; i++) { idx[i] = vert(pts[i]); idx[16 - i] = vert(mx(pts[i])); }
    return idx;
  };
  const colOf = (k) => (k <= 8 ? k : 16 - k);
  const band = (a, b, part, regionOf) => {
    for (let k = 0; k < 16; k++) {
      const k2 = (k + 1) % 16;
      // Mirrored sides wind the other way round, so both halves face out.
      poly([a[k], a[k2], b[k2], b[k]], part, regionOf(colOf(k), colOf(k2)));
    }
  };
  const fan = (r, apex, part, region, reverse) => {
    for (let k = 0; k < 16; k++) { const k2 = (k + 1) % 16; poly(reverse ? [r[k2], r[k], apex] : [r[k], r[k2], apex], part, region); }
  };

  // The head's lattice.
  const rows = [...P.skull.map(ellRow), ...P.face.map((r) => faceRow(r.front, r.back))];
  const rings = rows.map(ring);
  const nSkull = P.skull.length;
  fan(rings[0], vert(P.crown), 'head', 'skull', true);
  for (let r = 0; r + 1 < rings.length; r++) {
    // The face region: the front five columns from the brow down.
    band(rings[r], rings[r + 1], 'head', (c, c2) => (r >= nSkull - 1 && Math.max(c, c2) <= 5 && !(r === nSkull - 1 && false) && r >= nSkull ? 'face' : (r >= nSkull && Math.max(c, c2) <= 5 ? 'face' : 'skull')));
  }
  // The neck: the chin's underside (counted as head), then the neck's tube, closed at its foot.
  const neckRows = P.neck.map((n) => (Array.isArray(n) ? n : ellRow(n)));
  const neckRings = neckRows.map(ring);
  band(rings[rings.length - 1], neckRings[0], 'head', (c, c2) => (Math.max(c, c2) <= 3 ? 'face' : 'neck'));
  for (let r = 0; r + 1 < neckRings.length; r++) band(neckRings[r], neckRings[r + 1], 'neck', () => 'neck');
  const foot = neckRows[neckRows.length - 1];
  const footC = [0, foot.reduce((s, p) => s + p[1], 0) / 9, (foot[0][2] + foot[8][2]) / 2];
  fan(neckRings[neckRings.length - 1], vert(footC), 'neck', 'neck', false);

  // The shoulder stub: its own closed piece, the collar inside the neck.
  const stubRows = P.stub.map((s) => {
    const row = ellRow(s);
    if (s.ySide != null) { row[4][1] = (row[4][1] + s.ySide) / 2; row[5][1] = s.ySide; row[6][1] = (row[6][1] + s.ySide) / 2; }
    return row;
  });
  const stubRings = stubRows.map(ring);
  for (let r = 0; r + 1 < stubRings.length; r++) band(stubRings[r], stubRings[r + 1], 'shoulders', () => 'neck');
  const cut = stubRows[stubRows.length - 1];
  fan(stubRings[stubRings.length - 1], vert([0, cut[0][1], (cut[0][2] + cut[8][2]) / 2]), 'shoulders', 'neck', false);

  // Where the face's surface is at (x, y): the front-most hit of a ray along -z on the head's lattice.
  const lattice = polys.filter((p) => p.part === 'head').flatMap((p) => tris(p.v));
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

  // The nose: a wedge, its bridge one plane, the tip a small point, the underside a flat triangle each side.
  {
    const n = P.nose;
    const top = n.top, tip = n.tip, under = n.under;
    const zt = surf(0, top), zb = surf(0, tip + 0.08);
    const b0 = [n.wTop, top, zt + 0.015], b1 = [n.wBridge, tip + 0.08, zb + n.out];
    const t = [0, tip, zb + n.tipOut];
    const w = [n.wWing, under + 0.04, surf(n.wWing, under + 0.04) - 0.01];
    const s0 = [0, under, surf(0, under) - 0.005];
    const root = [n.wBridge + 0.05, (top + tip) / 2 + 0.06, surf(n.wBridge + 0.05, (top + tip) / 2 + 0.06) - 0.03];
    const B0 = vert(b0), B0m = vert(mx(b0)), B1 = vert(b1), B1m = vert(mx(b1)), T = vert(t);
    poly([B0m, B0, B1, B1m], 'head', 'face');
    poly([B1m, B1, T], 'head', 'face');
    for (const s of [1, -1]) {
      const W = vert(flip(w, s)), R = vert(flip(root, s)), S = vert(s0);
      const bb0 = s > 0 ? B0 : B0m, bb1 = s > 0 ? B1 : B1m;
      const o = (ids) => poly(s > 0 ? ids : [...ids].reverse(), 'head', 'face');
      o([bb0, R, W, bb1]);
      o([bb1, W, T]);
      o([T, W, S]);
    }
  }

  // The brows: a strip along three points, its front and top and underside, the ends closed.
  {
    const b = P.brow;
    both((s) => {
      const sec = b.x.map((x, i) => {
        const y0 = b.yb[i], y1 = b.yb[i] + b.h[i];
        return [on(x, y0, b.out), on(x, y1, b.out * 0.7), on(x, y1, -0.04), on(x, y0, -0.04)];
      });
      const ids = sec.map((q) => q.map((p) => vert(flip(p, s))));
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'brow');
      for (let i = 0; i < 2; i++) {
        const A = ids[i], B = ids[i + 1];
        o([A[0], B[0], B[1], A[1]]); // front
        o([A[1], B[1], B[2], A[2]]); // top
        o([A[3], B[3], B[0], A[0]]); // underside
      }
      o([...ids[0]].reverse()); o(ids[2]);
    });
  }

  // The eyes: a dark square pupil under an angular lid that juts over it.
  {
    const e = P.eye;
    both((s) => {
      const x0 = e.x - e.w / 2, x1 = e.x + e.w / 2, y0 = e.y - e.h / 2, y1 = e.y + e.h / 2;
      facePoly([on(x0, y0, 0.012), on(x1, y0, 0.012), on(x1, y1, 0.012), on(x0, y1, 0.012)], s, 'pupil');
      // The lid: a ledge across the pupil's top, wider than it; the almond lid kicks up and out at its outer end.
      const lx0 = x0 - 0.04, lx1 = x1 + 0.045 + e.almond * 0.03;
      const ly = y1 + 0.005, kick = e.almond * 0.025;
      const L = [on(lx0, ly - 0.012, 0.004), on(e.x, ly + 0.012, 0.004), on(lx1, ly - 0.005 + kick, 0.004)];
      const F = [on(lx0 + 0.02, ly - 0.01, e.lid * 0.6), on(e.x, ly - 0.004, e.lid), on(lx1 - 0.02, ly + kick * 0.6 - 0.006, e.lid * 0.7)];
      const D = [on(lx0 + 0.02, ly - 0.03, 0.01), on(e.x, ly - 0.026, 0.02), on(lx1 - 0.02, ly - 0.024 + kick * 0.5, 0.012)];
      const ids = [L, F, D].map((row) => row.map((p) => vert(flip(p, s))));
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'lid');
      for (let i = 0; i < 2; i++) {
        o([ids[0][i], ids[0][i + 1], ids[1][i + 1], ids[1][i]]); // the lid's top slope
        o([ids[1][i], ids[1][i + 1], ids[2][i + 1], ids[2][i]]); // its underside
      }
      o([ids[0][0], ids[1][0], ids[2][0]]); o([ids[0][2], ids[2][2], ids[1][2]]);
    });
  }

  // The lips (the female head): an upper lip with a cupid's bow, a lower lip, each a low wedge on the face.
  if (P.lips) {
    const L = P.lips;
    const y = L.y, w = L.w;
    // upper: corner, bow peak, centre dip; its lower edge the mouth's line
    const up = [[w, y, 0.0], [w * 0.38, y + L.upper, 0.03], [0, y + L.upper * 0.7, 0.032]];
    const mid = [[w, y, 0.0], [w * 0.4, y, 0.03], [0, y, 0.035]];
    const lo = [[w * 0.75, y - L.lower * 0.6, 0.008], [w * 0.35, y - L.lower, 0.025], [0, y - L.lower, 0.026]];
    const place = (p) => on(p[0], p[1], p[2]);
    const U = up.map(place), M = mid.map(place), Lo = lo.map(place);
    // the mouth's line sunk a touch
    const Mi = M.map((p, i) => [p[0], p[1] - 0.004, p[2] - (i === 0 ? 0 : 0.012)]);
    both((s) => {
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'face', 'lip');
      const u = U.map((p) => vert(flip(p, s))), m = M.map((p) => vert(flip(p, s))), mi = Mi.map((p) => vert(flip(p, s))), l = Lo.map((p) => vert(flip(p, s)));
      // the centre points are shared across the halves: make them once per side (they meet at x 0)
      o([m[1], m[0], u[1]]); o([m[1], u[1], u[2], m[2]]);
      o([l[0], mi[0], mi[1], l[1]]); o([l[1], mi[1], mi[2], l[2]]);
    });
  }

  // The ears: an outline flared out from the head at its back edge, a sunk inner bowl, a rim, a back.
  {
    const E = P.ear;
    const outline = [[0.1, 0.27], [-0.03, 0.31], [-0.14, 0.2], [-0.165, 0.02], [-0.12, -0.17], [-0.03, -0.29], [0.06, -0.22]];
    both((s) => {
      const rim = outline.map(([dz, dy]) => {
        const z = dz * E.s, y = dy * E.s;
        const out = (0.1 * E.s - z) * E.flare + (y + 0.3 * E.s) * E.lift;
        return [E.c[0] + out, E.c[1] + y, E.c[2] + z];
      });
      const c = mul(rim.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / rim.length);
      let n = [0, 0, 0];
      for (let i = 0; i < rim.length; i++) n = add(n, cross(rim[i], rim[(i + 1) % rim.length]));
      n = unit(n);
      if (n[0] < 0) n = mul(n, -1); // the outer face looks out and back
      const inner = rim.map((p) => add(lerp(c, p, 0.55), mul(n, -0.045 * E.s)));
      const back = rim.map((p) => add(lerp(c, p, 0.92), mul(n, -E.thick * E.s)));
      const R = rim.map((p) => vert(flip(p, s))), I = inner.map((p) => vert(flip(p, s))), Bk = back.map((p) => vert(flip(p, s)));
      // the outline runs front-top-back-bottom; which way that winds depends on the side
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'skull');
      const N = rim.length;
      const wind = dot(cross(sub(rim[1], rim[0]), sub(rim[2], rim[0])), n) > 0;
      const w = (v) => (wind ? v : [...v].reverse());
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        o(w([R[i], R[j], I[j], I[i]].reverse()));
        o(w([R[i], Bk[i], Bk[j], R[j]].reverse()));
      }
      const ci = vert(flip(add(c, mul(n, -0.06 * E.s)), s));
      for (let i = 0; i < N; i++) { const j = (i + 1) % N; o(w([I[i], I[j], ci])); }
      o(w([...Bk].reverse()));
    });
  }

  // Triangles, each polygon fanned along its shorter diagonal (quads) or from its first point.
  const triList = [];
  for (const p of polys) for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts };
}

function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4 && verts) {
    const [a, b, c, d] = v.map((i) => verts[i]);
    const ac = Math.hypot(...sub(a, c)), bd = Math.hypot(...sub(b, d));
    return ac <= bd ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
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
