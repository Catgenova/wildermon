// The low-poly bald head (male and female) for the modeling reference sheets in tools/sculpt/HEAD_SPEC.md and
// tools/sculpt/HEAD_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs:
//
//   node tools/sculpt/lowhead.mjs --who male|female        # prints the triangle counts per part
//
// One mesh per head: the head (a ring lattice of 12 columns, mirrored, plus the ears, nose, brows, eyes, lids and lips
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

// The columns, seven a side: c0 the front's centre line, c1 the eye's column, c2 the face's front corner, c3 the side,
// c4 and c5 the back's two, c6 the back's centre line. Ellipse rows place the front ones at these fractions of the half
// width, the back ones at these.
const FRONT_F = [0, 0.45, 0.8, 1];
const BACK_F = [0.8, 0.42, 0];
const U = 7, N = 2 * (U - 1);
const EXP = 2.3;
const arc = (f) => Math.pow(Math.max(0, 1 - Math.pow(f, EXP)), 1 / EXP);
const SIDE_T = [0, 0.06, 0.25, 0.5, 0.74, 0.92, 1];

/** A row from an ellipse: half width W, front depth F, back depth D about z0, its height yf at the front, yb at the back. */
function ellRow({ yf, yb = yf, W, F, D, z0 = 0, sideZ = 0, f: front = FRONT_F, b: back = BACK_F }) {
  const pts = [];
  front.forEach((f, i) => pts.push([W * f, yf + (yb - yf) * SIDE_T[i], i === 3 ? z0 + sideZ : z0 + F * arc(f)]));
  back.forEach((f, i) => pts.push([W * f, yf + (yb - yf) * SIDE_T[4 + i], z0 - D * arc(f)]));
  return pts;
}
/** A face row: c0..c3 as given, the back three from the ellipse. */
function faceRow(front, back) {
  const e = ellRow({ yf: back.yb, yb: back.yb, W: back.W, F: 0, D: back.D, z0: back.z0 ?? 0 });
  return [...front, e[4], e[5], e[6]];
}
const rowOf = (r) => (Array.isArray(r) ? r : ellRow(r));

/* ---- the two heads ---------------------------------------------------------------------------------------------- */
export const PRESETS = {
  male: {
    crown: [0, 2.08, 0.04],
    skull: [
      { yf: 2.0, yb: 1.97, W: 0.31, F: 0.36, D: 0.36, z0: 0.06, f: [0, 0.5, 0.86, 1], b: [0.86, 0.5, 0] },
      { yf: 1.84, yb: 1.8, W: 0.52, F: 0.68, D: 0.65, z0: 0.07, f: [0, 0.3, 0.66, 1], b: [0.7, 0.3, 0] },
      { yf: 1.52, yb: 1.48, W: 0.69, F: 0.84, D: 0.78, z0: 0.08, sideZ: 0.02 },
    ],
    face: [
      // brow ridge
      { front: [[0, 1.2, 0.97], [0.32, 1.2, 0.91], [0.56, 1.17, 0.7], [0.68, 1.16, 0.12]], back: { yb: 1.2, W: 0.68, D: 0.8, z0: 0.08 } },
      // eyes
      { front: [[0, 1.0, 0.9], [0.32, 0.98, 0.79], [0.51, 0.97, 0.63], [0.67, 0.97, 0.1]], back: { yb: 1.0, W: 0.66, D: 0.75, z0: 0.08 } },
      // cheekbones; the back's shelf under the skull
      { front: [[0, 0.72, 0.95], [0.32, 0.75, 0.8], [0.57, 0.77, 0.57], [0.65, 0.8, 0.07]], back: { yb: 0.76, W: 0.6, D: 0.63, z0: 0.07 } },
      // the mouth's line
      { front: [[0, 0.3, 0.87], [0.26, 0.33, 0.72], [0.46, 0.45, 0.4], [0.57, 0.6, -0.04]], back: { yb: 0.54, W: 0.53, D: 0.56, z0: 0.05 } },
      // the jawline: the chin's flat underside's front edge, back to the jaw's angle and the nape
      { front: [[0, 0.0, 0.8], [0.18, 0.02, 0.75], [0.4, 0.3, 0.28], [0.52, 0.46, -0.08]], back: { yb: 0.44, W: 0.48, D: 0.53, z0: 0.03 } },
    ],
    // the neck's rings: the first under the jaw (the chin's underside between), the last hidden in the shoulders
    neck: [
      [[0, 0.08, 0.42], [0.3, 0.12, 0.33], [0.44, 0.22, 0.03], [0.46, 0.3, -0.16], [0.4, 0.33, -0.33], [0.22, 0.35, -0.44], [0, 0.36, -0.47]],
      { yf: -0.2, yb: 0.0, W: 0.47, F: 0.42, D: 0.45, z0: -0.04, sideZ: -0.06 },
      { yf: -0.5, yb: -0.35, W: 0.48, F: 0.44, D: 0.46, z0: -0.04, sideZ: -0.06 },
    ],
    // the shoulder stub: the collar inside the neck, the shoulders' line, the cut
    stub: [
      { yf: -0.26, yb: -0.06, W: 0.44, F: 0.39, D: 0.42, z0: -0.04, sideZ: -0.06 },
      [[0, -0.64, 0.52], [0.45, -0.52, 0.46], [0.82, -0.43, 0.26], [0.91, -0.44, -0.06], [0.8, -0.43, -0.42], [0.42, -0.42, -0.66], [0, -0.5, -0.72]],
      [[0, -0.92, 0.6], [0.42, -0.92, 0.5], [0.62, -0.92, 0.28], [0.66, -0.92, -0.06], [0.6, -0.92, -0.36], [0.36, -0.92, -0.5], [0, -0.92, -0.54]],
    ],
    ear: { c: [0.6, 0.83, -0.02], s: 1.03, gap: 0.08, flare: 0.18, lift: 0.18, thick: 0.14 },
    nose: { top: 1.13, tip: 0.6, under: 0.54, wTop: 0.07, wBridge: 0.1, wWing: 0.13, out: 0.1, tipOut: 0.14 },
    brow: { x: [0.12, 0.33, 0.56], yb: [1.1, 1.12, 1.11], h: [0.08, 0.08, 0.05], out: 0.05 },
    eye: { x: 0.31, y: 1.0, w: 0.1, h: 0.085, lid: 0.03, almond: 0 },
    lips: null,
    mouth: { y: 0.27, w: 0.15, d: 0.012 },
  },
};

/** The female head: the male's system with her proportions. */
PRESETS.female = {
  // Her head 1.91 tall from her chin (y 0.15) to her crown, her neck the longer for it.
  crown: [0, 2.06, 0.02],
  skull: [
    { yf: 2.0, yb: 1.97, W: 0.28, F: 0.32, D: 0.36, z0: 0.04, f: [0, 0.5, 0.86, 1], b: [0.86, 0.5, 0] },
    { yf: 1.87, yb: 1.83, W: 0.5, F: 0.64, D: 0.67, z0: 0.05, f: [0, 0.3, 0.66, 1], b: [0.7, 0.3, 0] },
    { yf: 1.58, yb: 1.54, W: 0.68, F: 0.82, D: 0.82, z0: 0.06, sideZ: 0.02 },
  ],
  face: [
    { front: [[0, 1.22, 0.9], [0.3, 1.22, 0.85], [0.5, 1.2, 0.67], [0.62, 1.2, 0.1]], back: { yb: 1.24, W: 0.66, D: 0.82, z0: 0.06 } },
    { front: [[0, 0.98, 0.86], [0.3, 0.96, 0.77], [0.47, 0.95, 0.62], [0.54, 0.95, 0.08]], back: { yb: 1.04, W: 0.6, D: 0.78, z0: 0.06 } },
    { front: [[0, 0.72, 0.9], [0.28, 0.75, 0.77], [0.47, 0.8, 0.55], [0.53, 0.84, 0.05]], back: { yb: 0.84, W: 0.53, D: 0.66, z0: 0.05 } },
    { front: [[0, 0.4, 0.83], [0.2, 0.42, 0.68], [0.35, 0.53, 0.43], [0.47, 0.66, -0.04]], back: { yb: 0.66, W: 0.48, D: 0.58, z0: 0.04 } },
    { front: [[0, 0.15, 0.8], [0.07, 0.16, 0.77], [0.27, 0.32, 0.4], [0.43, 0.5, -0.08]], back: { yb: 0.56, W: 0.44, D: 0.54, z0: 0.03 } },
  ],
  neck: [
    [[0, 0.08, 0.28], [0.2, 0.12, 0.22], [0.3, 0.24, 0.0], [0.32, 0.34, -0.15], [0.28, 0.38, -0.3], [0.15, 0.4, -0.39], [0, 0.41, -0.42]],
    { yf: -0.2, yb: -0.05, W: 0.32, F: 0.3, D: 0.36, z0: -0.06, sideZ: -0.05 },
    { yf: -0.5, yb: -0.4, W: 0.33, F: 0.31, D: 0.37, z0: -0.05, sideZ: -0.05 },
  ],
  stub: [
    { yf: -0.3, yb: -0.17, W: 0.3, F: 0.28, D: 0.34, z0: -0.05, sideZ: -0.05 },
    [[0, -0.74, 0.4], [0.4, -0.66, 0.36], [0.74, -0.62, 0.2], [0.83, -0.64, -0.06], [0.72, -0.62, -0.36], [0.38, -0.58, -0.6], [0, -0.62, -0.7]],
    [[0, -0.98, 0.52], [0.34, -0.98, 0.44], [0.52, -0.98, 0.24], [0.55, -0.98, -0.06], [0.5, -0.98, -0.3], [0.3, -0.98, -0.42], [0, -0.98, -0.46]],
  ],
  ear: { c: [0.52, 0.76, -0.03], s: 0.76, gap: 0.035, flare: 0.18, lift: 0.16, thick: 0.12 },
  nose: { top: 1.06, tip: 0.6, under: 0.55, wTop: 0.045, wBridge: 0.065, wWing: 0.095, out: 0.09, tipOut: 0.12 },
  brow: { x: [0.11, 0.31, 0.48], yb: [1.17, 1.21, 1.13], h: [0.04, 0.038, 0.024], out: 0.04 },
  eye: { x: 0.29, y: 0.985, w: 0.12, h: 0.1, lid: 0.03, almond: 1 },
  lips: { y: 0.38, w: 0.145, upper: 0.055, lower: 0.06 },
};

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowHead(who = 'male') {
  const P = PRESETS[who];
  if (!P) throw new Error(`no head ${who}`);
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const poly = (v, part, region, mat = 'skin') => polys.push({ v, part, region, mat });

  /** A ring of N from the U points c0..c6 (x >= 0): c0, c1..c5, c6, c5'..c1'. */
  const ring = (pts) => {
    const idx = new Array(N);
    idx[0] = vert(pts[0]); idx[U - 1] = vert(pts[U - 1]);
    for (let i = 1; i < U - 1; i++) { idx[i] = vert(pts[i]); idx[N - i] = vert(mx(pts[i])); }
    return idx;
  };
  const colOf = (k) => (k < U ? k : N - k);
  const band = (a, b, part, regionOf) => {
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      poly([a[k], a[k2], b[k2], b[k]], part, regionOf(colOf(k), colOf(k2)));
    }
  };
  const fan = (r, apex, part, region, reverse) => {
    for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; poly(reverse ? [r[k2], r[k], apex] : [r[k], r[k2], apex], part, region); }
  };

  // The head's lattice; the face region the front columns from the brow down.
  const rows = [...P.skull.map(ellRow), ...P.face.map((r) => faceRow(r.front, r.back))];
  const rings = rows.map(ring);
  const nSkull = P.skull.length;
  fan(rings[0], vert(P.crown), 'head', 'skull', true);
  for (let r = 0; r + 1 < rings.length; r++) band(rings[r], rings[r + 1], 'head', (c, c2) => (r >= nSkull && Math.max(c, c2) <= 3 ? 'face' : 'skull'));
  // The neck: the chin's underside (counted as head), then the neck's tube, closed at its foot.
  const neckRows = P.neck.map(rowOf);
  const neckRings = neckRows.map(ring);
  band(rings[rings.length - 1], neckRings[0], 'head', (c, c2) => (Math.max(c, c2) <= 2 ? 'face' : 'neck'));
  for (let r = 0; r + 1 < neckRings.length; r++) band(neckRings[r], neckRings[r + 1], 'neck', () => 'neck');
  const foot = neckRows[neckRows.length - 1];
  fan(neckRings[neckRings.length - 1], vert([0, foot.reduce((s, p) => s + p[1], 0) / U, (foot[0][2] + foot[U - 1][2]) / 2]), 'neck', 'neck', false);

  // The shoulder stub: its own closed piece, the collar inside the neck.
  const stubRows = P.stub.map(rowOf);
  const stubRings = stubRows.map(ring);
  for (let r = 0; r + 1 < stubRings.length; r++) band(stubRings[r], stubRings[r + 1], 'shoulders', () => 'neck');
  const cut = stubRows[stubRows.length - 1];
  fan(stubRings[stubRings.length - 1], vert([0, cut[0][1], (cut[0][2] + cut[U - 1][2]) / 2]), 'shoulders', 'neck', false);

  // Where the face's surface is at (x, y): the front-most hit of a ray along -z on the head's lattice.
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
      facePoly([on(x0, y0, 0.022), on(x1, y0, 0.022), on(x1, y1, 0.022), on(x0, y1, 0.022)], s, "pupil");
      // The lid: a strip along the pupil's top edge, from past its inner corner to past its outer one; the almond lid
      // thins to a wing that flicks up and out.
      const a = e.almond;
      const xs = a ? [x0 - 0.02, e.x, x1 + 0.015, x1 + 0.075] : [x0 - 0.035, e.x, x1 + 0.035];
      const yb = a ? [y1 - 0.025, y1 - 0.004, y1 - 0.004, y1 + 0.035] : [y1 - 0.004, y1, y1 - 0.006];
      const hh = a ? [0.012, 0.024, 0.022, 0.006] : [0.03, 0.034, 0.026];
      const sec = xs.map((x, i) => [on(x, yb[i], e.lid), on(x, yb[i] + hh[i], e.lid * 0.5), on(x, yb[i] + hh[i], -0.03), on(x, yb[i], -0.03)]);
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

  // The ears: a bevelled slab off the head's side, its outline a rounded tall octagon, tilted out at the top and the
  // back; its outer face flat with a shallow sunk bowl, the bevel round it, a back that meets the head.
  {
    const E = P.ear;
    const outline = [[0.1, 0.24], [0.02, 0.3], [-0.1, 0.29], [-0.17, 0.18], [-0.185, 0.0], [-0.14, -0.18], [-0.05, -0.28], [0.06, -0.24]];
    both((s) => {
      const rim = outline.map(([dz, dy]) => {
        const z = dz * E.s, y = dy * E.s;
        const out = E.gap + (0.1 * E.s - z) * E.flare + (y + 0.3 * E.s) * E.lift;
        return [E.c[0] + out, E.c[1] + y, E.c[2] + z];
      });
      const c = mul(rim.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / rim.length);
      let n = [0, 0, 0];
      for (let i = 0; i < rim.length; i++) n = add(n, cross(rim[i], rim[(i + 1) % rim.length]));
      n = unit(n);
      if (n[0] < 0) n = mul(n, -1); // the outer face looks out
      const face = rim.map((p) => add(lerp(c, p, 0.84), mul(n, 0.035 * E.s)));
      const bowl = rim.map((p, i) => add(lerp(c, p, 0.5), add(mul(n, 0.012 * E.s), [0, 0, 0.03 * E.s])));
      const back = rim.map((p) => add(lerp(c, p, 0.9), mul(n, -E.thick * E.s)));
      const R = rim.map((p) => vert(flip(p, s))), F = face.map((p) => vert(flip(p, s))), I = bowl.map((p) => vert(flip(p, s))), Bk = back.map((p) => vert(flip(p, s)));
      const o = (v) => poly(s > 0 ? v : [...v].reverse(), 'head', 'skull');
      const N = rim.length;
      // wind every face so its normal looks out along n (the outer face) or away from the slab's middle
      const wind = dot(cross(sub(rim[1], rim[0]), sub(rim[2], rim[0])), n) > 0;
      const w = (v) => (wind ? v : [...v].reverse());
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        o(w([R[i], R[j], F[j], F[i]]));   // the bevel
        o(w([Bk[i], Bk[j], R[j], R[i]]));  // the side
        o(w([F[i], F[j], I[j], I[i]]));   // the face round the bowl
      }
      o(w([...I]));
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
