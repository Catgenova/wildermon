// The tunic (shirt) of the first outfit (the user's tunic sheet; worn under the shawl in the outfit-1 lineup): a stand
// collar with a centre notch, three-quarter sleeves with banded cuffs, a hem with a V split at the front, trimmed tan at
// the collar, the cuffs and the hem. Hers fitted and tapered (princess seams front and back, the waist taken in, a slight
// flare at the hips); his straight (a centre back seam). Both have shoulder and side seams. Fitted to each low-poly body
// from the one design (DESIGN, per body), skinned to its rig.
//
//   buildTunic(rig, design?) → { verts, polys: [{ v, mat, part, tag }], tris, part, rings, design }
//   tunicWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only: the tunic has none of its own)
//
//   node tools/sculpt/garments/tunic.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowtunic-male.json and lowtunic-female.json
//     (lowgarment.mjs garmentAsset; loaded by src/sculpt/lowpoly.ts), and the shawl over it (garments/shawl.mjs)
//
// The shape:
//   the torso: a grid of columns round a vertical axis (DESIGN.cols, azimuth 0 the front, 90 the body's left; mirrored)
//   and rows down it: N the neckline on the neck's foot, S A1 A2 the armhole's top, middle and foot, then the chest, the
//   waist and the hip (each row at its height round the body, at the body's reach in its column's wedge plus the row's
//   clearance), then the skirt (L, T the hem trim's top, E the hem) hanging from the hip: never further in than the row
//   above, by the flare. The armhole is the body's own ring where the arm meets the torso (lowarm.mjs TORSO_RING), its foot
//   lowered to where the torso's clearance and the arm's meet;
//   the sleeves: rings round the arm (the arm's own rings, each pushed out from its centre by the sleeve's clearance) from
//   the armhole to the cuff, the cuff stepped out and banded (DESIGN.cuff);
//   the collar: a band standing on the neckline (its outside, its rim, its inside down to the neckline's inner edge), open
//   at the front between the columns either side of the centre (the notch), the neckline dipped in a V there;
//   the hem: the skirt's last rows, the V split at the front (the centre column's hem raised to the V's top);
//   the cloth's edges (the neckline, the cuffs, the hem) turned in by the cloth's thickness THICK and a band up inside.
// Every vertex then pushed out until the body is at least THICK + CLEAR inside the outer surface (clearOut), and the
// seams creased in (DESIGN.seams). Materials: linen, panel (linen's tone a step down, every other panel), trim, inner.
import { meshOf, orient, trisOf, transferWeights, closestOnTri, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { TORSO_RING } from '../lowarm.mjs';
import { MATS as SHAWL_MATS } from './shawl.mjs';

/**
 * The materials: fabric, trim and inner are the shawl's own (garments/shawl.mjs MATS, the same names and colours: the
 * game gives them one slot each, the outfit one palette); seam, the stitch lines (the fabric a tone down), the tunic's own.
 */
export const MATS = {
  fabric: SHAWL_MATS.fabric,
  trim: SHAWL_MATS.trim,
  inner: SHAWL_MATS.inner,
  seam: SHAWL_MATS.fabric.map((x) => +(x * 0.84).toFixed(4)),
};

/**
 * The design per body. Heights are the body's y, lengths its units; [front, side, back] blend round the azimuth.
 *   cols: the columns' azimuths on one side, 0 (centre front) to 180 (centre back): `vcol` the V split's corners and the
 *   collar's notch, `arm` the armhole's three (front, side, back), the rest where the seams and the shape want them;
 *   rows: each { key, y, c (clearance), az? (columns moved: { col: azimuth } for this row) } from the armhole's foot down
 *   to the hip; hang: the row the skirt hangs from and the flare (out per unit of drop); skirt: the rows below the hip
 *   (L, then the hem E, the trim T `trim` above it along the cloth);
 *   neck: the neckline's clearance and the V's depth at the front; collar: its height, the linen part's share of it;
 *   arm: the armhole's clearance, how far its foot drops at most; sleeve: the arm's rings it goes round and their
 *   clearance, the cuff (at, a share of the forearm from the elbow to the wrist; bands down from the cuff's top; step, how
 *   far the cuff stands out from the sleeve); vsplit: the V's height; THICK, the cloth's thickness; CLEAR, the least gap
 *   left between the body and the cloth's inside.
 */
export const DESIGN = {
  male: {
    cols: [0, 9, 28, 48, 70, 90, 110, 132, 156, 180], vcol: 9, vwide: 17, arm: [70, 90, 110],
    THICK: 0.06, CLEAR: 0.03,
    neck: { c: 0.12, v: 0.32, lift: 0.02 },
    collar: { h: [0.4, 0.5, 0.55], linen: 0.4, c: 0.15 },
    armhole: { c: 0.09, drop: 0.7, room: 0.03, side: 0.6, below: 0.25, pit: 0.3 },
    rows: [
      { key: 'S', y: [-1.0, -0.69, -0.95], c: [0.12, 0.1, 0.12] },
      { key: 'A1', y: [-1.45, -1.3, -1.4], c: [0.13, 0.12, 0.13] },
      { key: 'A2', y: [-1.95, -1.86, -1.9], c: [0.14, 0.1, 0.14] },
      { key: 'B', y: [-2.45, -2.65, -2.45], c: [0.15, 0.1, 0.15] },
      { key: 'U', y: [-2.95, -3.0, -2.95], c: [0.16, 0.13, 0.16] },
      { key: 'W', y: [-3.45, -3.45, -3.45], c: [0.18, 0.18, 0.18] },
      { key: 'H', y: [-4.1, -4.1, -4.1], c: [0.18, 0.18, 0.18] },
    ],
    hang: { from: 'U', flare: [0.02, 0.06, 0.03] },
    skirt: { L: [-5.0, -4.95, -5.0], E: [-6.05, -5.95, -6.1], trim: 0.26, c: 0.2 },
    vsplit: 0.85,
    sleeve: { rings: [['jb', 0.09], ['ua', 0.12], ['ue', 0.15]], inner: 0.7, under: 0.16, cuff: { at: 0.42, len: 0.3, c: 0.18, step: 0.035, bands: [['trim', 0.55], ['fabric', 0.45]] } },
    seams: [{ at: 90, dir: 1, from: 'N', to: 'S', w: 0.035 }, { at: 90, dir: 1, from: 'B', to: 'LH', w: 0.035 }, { at: 180, dir: -1, from: 'S', to: 'LH', w: 0.018 }],
  },
  female: {
    cols: [0, 9, 26, 42, 72, 90, 108, 136, 158, 180], vcol: 9, vwide: 17, arm: [72, 90, 108],
    THICK: 0.055, CLEAR: 0.025,
    neck: { c: 0.1, v: 0.28, lift: 0.02 },
    collar: { h: [0.34, 0.42, 0.46], linen: 0.4, c: 0.12 },
    armhole: { c: 0.08, drop: 0.7, room: 0.03, side: 0.6, below: 0.22, pit: 0.25 },
    rows: [
      { key: 'S', y: [-1.0, -0.92, -0.95], c: [0.1, 0.08, 0.1] },
      { key: 'A1', y: [-1.4, -1.18, -1.3], c: [0.1, 0.09, 0.1] },
      { key: 'A2', y: [-1.75, -1.52, -1.7], c: [0.1, 0.09, 0.1] },
      { key: 'B', y: [-2.08, -2.2, -2.05], c: [0.1, 0.09, 0.1] },
      { key: 'U', y: [-2.45, -2.5, -2.4], c: [0.1, 0.09, 0.1], bridge: 1.0 },
      { key: 'W', y: [-2.8, -2.8, -2.8], c: [0.12, 0.11, 0.12], bridge: 0.99 },
      { key: 'H', y: [-3.5, -3.5, -3.5], c: [0.14, 0.14, 0.14] },
    ],
    hang: { from: 'H', flare: [0.07, 0.06, 0.07] },
    skirt: { L: [-4.05, -4.0, -4.05], E: [-4.8, -4.65, -4.85], trim: 0.22, c: 0.16 },
    vsplit: 0.62,
    sleeve: { rings: [['jb', 0.05], ['ua', 0.08], ['ue', 0.1]], inner: 0.7, under: 0.14, cuff: { at: 0.45, len: 0.28, c: 0.15, step: 0.03, bands: [['trim', 0.3], ['fabric', 0.2], ['trim', 0.3], ['fabric', 0.2]] } },
    seams: [{ at: 90, dir: 1, from: 'N', to: 'S', w: 0.03 }, { at: 42, dir: 1, from: 'A1', to: 'LH', w: 0.03 }, { at: 136, dir: -1, from: 'A1', to: 'LH', w: 0.03 }, { at: 90, dir: 1, from: 'B', to: 'LH', w: 0.03 }],
  },
};

const blend = ([f, s, b], deg) => { const c = Math.cos(deg * Math.PI / 180); return c >= 0 ? f * c + s * (1 - c) : b * -c + s * (1 + c); };
const wrap = (d) => ((d + 540) % 360) - 180;
const azOf = (p, zc) => Math.atan2(p[0], p[2] - zc) * 180 / Math.PI;
const at = (deg, r, y, zc) => [Math.sin(deg * Math.PI / 180) * r, y, zc + Math.cos(deg * Math.PI / 180) * r];
const mean = (ps) => mul(ps.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ps.length);

/** Points on the body's surface, each with its part: every vertex and a grid on each triangle about `step` apart. */
export function partSamples(B, step = 0.07) {
  const out = [];
  B.verts.forEach((p, i) => out.push({ p, part: B.part[i] }));
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => B.verts[i]), part = B.part[t.v[0]];
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      if ((i === 0 && j === 0) || (i === n && j === 0) || (i === 0 && j === n)) continue;
      const u = i / n, v = j / n, w = 1 - u - v;
      out.push({ p: [a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v], part });
    }
  }
  return out;
}

/** The body's vertex normals (each its triangles' area-weighted normals). */
function vertexNormals(B) {
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  return N.map(unit);
}

/**
 * The garment pushed clear of the body: every body sample of a group at least `need` inside the nearest outer
 * triangle of the faces the group may meet (its outward normal), each offending triangle's corners moved out along their
 * own normals by the shortfall (shared by the point's barycentric weights), repeated until nothing is short. P: the
 * positions (changed in place); quads: [[a, b, c, d], group]; groups: [{ pts, faces: Set of quad groups, need }].
 */
export function clearOut(P, quads, groups, { iters = 40, fixed = new Set(), reach = 0.6, keep = 8, outward = null, most = 0.3 } = {}) {
  const P0 = P.map((p) => [...p]);
  // the quads' triangles (each along its shorter diagonal at the start)
  const T = [];
  for (const [q, g] of quads) {
    const v = q.filter((x, k) => q.indexOf(x) === k);
    if (v.length === 3) T.push([v, g]);
    else if (Math.hypot(...sub(P[v[0]], P[v[2]])) <= Math.hypot(...sub(P[v[1]], P[v[3]]))) T.push([[v[0], v[1], v[2]], g], [[v[0], v[2], v[3]], g]);
    else T.push([[v[0], v[1], v[3]], g], [[v[1], v[2], v[3]], g]);
  }
  // (each turned to face out)
  if (outward) for (const t of T) { const [a, b, c] = t[0].map((i) => P[i]); if (dot(cross(sub(b, a), sub(c, a)), outward(mean([a, b, c]), t[1])) < 0) t[0] = [t[0][0], t[0][2], t[0][1]]; }
  // each sample's candidates: the `keep` nearest triangles it may meet within `reach` (at the start)
  const cell = 0.4, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  T.forEach(([v], k) => {
    const lo = [0, 1, 2].map((j) => Math.min(...v.map((i) => P[i][j])) - reach), hi = [0, 1, 2].map((j) => Math.max(...v.map((i) => P[i][j])) + reach);
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) (grid.get(key(x, y, z)) ?? grid.set(key(x, y, z), []).get(key(x, y, z))).push(k);
  });
  const work = [];
  for (const G of groups) for (const s of G.pts) {
    const c = [];
    for (const k of grid.get(key(Math.floor(s[0] / cell), Math.floor(s[1] / cell), Math.floor(s[2] / cell))) ?? []) {
      if (!G.faces.has(T[k][1])) continue;
      const [a, b, cc] = T[k][0].map((i) => P[i]), [q] = closestOnTri(s, a, b, cc), d = Math.hypot(...sub(s, q));
      if (d <= reach) c.push([d, k]);
    }
    if (c.length) work.push({ s, need: G.need, cand: c.sort((x, y) => x[0] - y[0]).slice(0, keep).map(([, k]) => k) });
  }
  let worst = 0;
  for (let it = 0; it < iters; it++) {
    const tn = T.map(([v]) => unit(cross(sub(P[v[1]], P[v[0]]), sub(P[v[2]], P[v[0]]))));
    const vn = P.map(() => [0, 0, 0]);
    T.forEach(([v], k) => { for (const i of v) vn[i] = add(vn[i], tn[k]); });
    const vnu = vn.map(unit), push = P.map(() => 0);
    worst = 0;
    for (const { s, need, cand } of work) {
      let best = null;
      for (const k of cand) { const [a, b, c] = T[k][0].map((i) => P[i]), [q, w] = closestOnTri(s, a, b, c), d = Math.hypot(...sub(s, q)); if (!best || d < best.d) best = { d, q, w, k }; }
      const short = dot(sub(s, best.q), tn[best.k]) + need;
      if (short <= 1e-4) continue;
      if (short > worst) { worst = short; clearOut.at = { s, g: T[best.k][1], tri: T[best.k][0], it }; }
      const v = T[best.k][0], ww = best.w, s2 = ww.reduce((a, x) => a + x * x, 0);
      v.forEach((i, j) => { push[i] = Math.max(push[i], (short + 0.003) * ww[j] / s2); });
    }
    if (worst <= 1e-4) break;
    P.forEach((p, i) => {
      if (!(push[i] > 0) || fixed.has(i)) return;
      const q = add(p, mul(vnu[i], Math.min(push[i], 0.05))), d = sub(q, P0[i]), l = Math.hypot(...d);
      P[i] = l > most ? add(P0[i], mul(d, most / l)) : q;
    });
  }
  return worst;
}

/* ---- the build ------------------------------------------------------------------------------------------------------ */
export function buildTunic(rig, design = DESIGN[rig.who], opts = {}) {
  const { B, J } = rig, D = design, T = D.THICK;
  const SM = partSamples(B), FINE = partSamples(B, 0.035);
  const torsoPts = SM.filter((s) => s.part === 'torso' || s.part === 'pelvis' || s.part === 'legs').map((s) => s.p);
  const neckPts = SM.filter((s) => s.part === 'neck').map((s) => s.p), collarPts = SM.filter((s) => s.part === 'neck' || s.part === 'head').map((s) => s.p);
  const VN = vertexNormals(B);
  const BV = (n) => B.verts[B.index.get(n)];

  // the columns round: one side's from the front to the back, then the other's back to the front
  const side = D.cols, NC = 2 * side.length - 2;
  const COL = [...side, ...side.slice(1, -1).reverse().map((a) => -a)];
  const mirrorOf = (j) => (j === 0 || j === side.length - 1 ? j : NC - j);
  const half = (j) => Math.max(Math.abs(wrap(COL[(j + 1) % NC] - COL[j])), Math.abs(wrap(COL[j] - COL[(j + NC - 1) % NC]))) * 0.5 + 2;

  /** The torso's centre z at height y: halfway between its front and its back on the centre line. */
  const zcAt = (y) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of torsoPts) if (Math.abs(p[1] - y) < 0.12 && Math.abs(p[0]) < 0.25) { lo = Math.min(lo, p[2]); hi = Math.max(hi, p[2]); }
    return lo < hi ? (lo + hi) / 2 : -0.15;
  };
  /** The body's reach at (azimuth, height) from the centre zc: the farthest sample within the column's wedge and dy. */
  const reach = (pts, deg, y, zc, hw, dy = 0.1) => {
    const k = 1 / Math.cos(hw * Math.PI / 180);
    let r = 0;
    for (const p of pts) { if (Math.abs(p[1] - y) > dy) continue; const a = Math.abs(wrap(azOf(p, zc) - deg)); if (a > hw) continue; r = Math.max(r, Math.hypot(p[0], p[2] - zc) * k); }
    return r;
  };

  /* -- the outer surface's positions, by key -- */
  const P = [], K = new Map(), part = [];
  const put = (key, p, prt) => { K.set(key, P.length); P.push(p); part.push(prt); return P.length - 1; };
  const id = (key) => K.get(key);

  // the armhole: the body's ring where the arm meets the torso, each pushed out along its normal; its foot lowered to
  // where the gap between the arm's inside and the torso's side first leaves room for both clearances (in that gap), the
  // corners either side of it (front and back) partway down, in front of and behind the gap there
  const armRing = (s) => TORSO_RING.map((n) => { const i = B.index.get(`${n}.${s}`); return add(B.verts[i], mul(VN[i], D.armhole.c)); });
  const hole = {};
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const R = armRing(s), body = B.verts[B.index.get(`dc4.${s}`)];
    const near = (p) => p[0] * sg > 0.4 && p[1] < body[1] + 0.4 && p[1] > body[1] - 1.2;
    const armIn = FINE.filter((q) => (q.part === 'arm' || q.part === 'joint') && near(q.p)).map((q) => q.p);
    const tor = FINE.filter((q) => (q.part === 'torso') && near(q.p)).map((q) => q.p);
    // (the closest arm and torso points at height y: the arm's within 0.05 of it, the torso's within 0.25)
    const gapAt = (y) => {
      let best = null;
      for (const a of armIn) { if (Math.abs(a[1] - y) > 0.05) continue; for (const t of tor) { if (Math.abs(t[1] - y) > 0.25) continue; const d = Math.hypot(...sub(a, t)); if (!best || d < best.d) best = { d, a, t }; } }
      return best;
    };
    const room = D.armhole.c * (1 + D.sleeve.inner) + D.armhole.room;
    let yf = body[1], g = gapAt(yf);
    for (let d = 0.02; d <= D.armhole.drop + 1e-9 && (!g || g.d < room); d += 0.02) { yf = body[1] - d; g = gapAt(yf); }
    if (process.env.TUNIC_DEBUG) console.log(s, 'foot', yf.toFixed(2), g.d.toFixed(3), room.toFixed(3), g.a.map((x) => x.toFixed(2)).join(), g.t.map((x) => x.toFixed(2)).join());
    const foot = lerp(g.t, g.a, D.armhole.c / (D.armhole.c * (1 + D.sleeve.inner)));
    const ring = [...R];
    ring[5] = foot;
    // (front and back: the gap partway down, in front of everything near it, behind everything near it)
    for (const [k, way] of [[6, 1], [4, -1]]) {
      const y = lerp(R[k], [0, yf, 0], D.armhole.side)[1], gg = gapAt(y), m = lerp(gg.t, gg.a, 0.5);
      let z = way > 0 ? -Infinity : Infinity;
      for (const p of armIn) if (Math.abs(p[1] - y) < 0.1 && p[0] * sg < m[0] * sg + 0.15) z = way > 0 ? Math.max(z, p[2]) : Math.min(z, p[2]);
      let q = [m[0], y, z + way * D.armhole.c];
      // (and clear of the torso: out from its axis to its reach there and the clearance)
      const zc = zcAt(y), deg = azOf(q, zc), r = reach(torsoPts, deg, y, zc, 6) + D.armhole.c, rq = Math.hypot(q[0], q[2] - zc);
      if (rq < r) q = at(deg, r, y, zc);
      ring[k] = q;
    }
    hole[s] = { ring, drop: body[1] - yf };
  }
  const fixedKey = (key) => armKey('L').includes(key) || armKey('R').includes(key);
  const armKey = (s) => { const [f, m, b] = D.arm, sg = s === 'L' ? 1 : -1; return [['S', f], ['S', m], ['S', b], ['A1', b], ['A2', b], ['A2', m], ['A2', f], ['A1', f]].map(([r, a]) => `${r}:${a * sg}`); };

  // the rows
  const ROWS = [];
  const zN = zcAt(-0.6);
  // N: the neckline on the neck's foot
  {
    const ring = ['nm0', 'nm1.L', 'nm2.L', 'nm3.L', 'nm4.L', 'nm5', 'nm4.R', 'nm3.R', 'nm2.R', 'nm1.R'].map(BV);
    const foot = (deg) => {
      const d = [Math.sin(deg * Math.PI / 180), Math.cos(deg * Math.PI / 180)];
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length], ax = a[0], az = a[2] - zN, ex = b[0] - ax, ez = b[2] - zN - az, den = d[0] * ez - d[1] * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = (ax * ez - az * ex) / den, u = (ax * d[1] - az * d[0]) / den;
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) return [t, a[1] + (b[1] - a[1]) * u];
      }
      throw new Error('no neck foot at ' + deg);
    };
    COL.forEach((deg, j) => {
      const [r, y] = foot(deg);
      const dip = Math.abs(deg) < 1e-9 ? D.neck.v : 0;
      put(`N:${deg}`, at(deg, r + D.neck.c, y + D.neck.lift - dip, zN), 'torso');
    });
    ROWS.push({ key: 'N', zc: zN });
  }
  // the fitted rows
  const hangAt = D.rows.findIndex((r) => r.key === D.hang.from);
  let zHang = null;
  D.rows.forEach((row, ri) => {
    const yc = blend(row.y, 90);
    const zc = ri >= hangAt ? (zHang ??= zcAt(blend(row.y, 0))) : zcAt(yc);
    ROWS.push({ key: row.key, zc });
    COL.forEach((deg, j) => {
      const key = `${row.key}:${deg}`;
      for (const s of ['L', 'R']) { const k = armKey(s).indexOf(key); if (k >= 0) { put(key, hole[s].ring[k], 'torso'); return; } }
      if ((row.key === 'A1') && Math.abs(Math.abs(deg) - D.arm[1]) < 1e-9) return; // inside the armhole
      let y = blend(row.y, deg);
      const c = blend(row.c, deg);
      // (under the armhole, below its foot)
      const a2 = D.rows.findIndex((r) => r.key === 'A2');
      if (ri > a2 && Math.abs(deg) >= D.arm[0] - 1e-9 && Math.abs(deg) <= D.arm[2] + 1e-9) y = Math.min(y, hole.L.ring[5][1] - D.armhole.below * (ri - a2));
      let r = reach(torsoPts, deg, y, zc, half(j)) + c;
      if (ri > hangAt) {
        const prev = P[id(`${D.rows[ri - 1].key}:${deg}`)], rp = Math.hypot(prev[0], prev[2] - zc);
        r = Math.max(r, rp + blend(D.hang.flare, deg) * (prev[1] - y));
      }
      put(key, at(deg, r, y, zc), 'torso');
    });
  });
  // rows bridged (DESIGN row.bridge): no further in than that share of the way between the rows either side (the cloth
  // drawn across under the bust, not into it)
  D.rows.forEach((row, ri) => {
    if (!row.bridge || ri === 0 || ri + 1 >= D.rows.length) return;
    const zc = ROWS[ri + 1].zc;
    COL.forEach((deg) => {
      const i = id(`${row.key}:${deg}`), a = id(`${D.rows[ri - 1].key}:${deg}`), b = id(`${D.rows[ri + 1].key}:${deg}`);
      if (i === undefined || a === undefined || b === undefined || fixedKey(`${row.key}:${deg}`)) return;
      const rr = (p) => Math.hypot(p[0], p[2] - zc), want = row.bridge * (rr(P[a]) + rr(P[b])) / 2, p = P[i];
      if (rr(p) < want) P[i] = at(deg, want, p[1], zc);
    });
  });
  // the skirt: L, then the hem's trim T and the hem E, hanging from the hip
  {
    const H = D.rows[D.rows.length - 1].key, zc = zHang ?? zcAt(-4);
    const vTop = (deg) => blend(D.skirt.E, 0) + D.vsplit;
    for (const key of ['LH', 'E']) {
      COL.forEach((deg, j) => {
        let y = blend(D.skirt[key === 'LH' ? 'L' : key], deg);
        const prevKey = key === 'LH' ? H : 'LH', prev = P[id(`${prevKey}:${deg}`)], rp = Math.hypot(prev[0], prev[2] - zc);
        if (key === 'E' && Math.abs(deg) < 1e-9) y = vTop(deg);
        if (key === 'LH' && Math.abs(deg) < 1e-9) y = Math.max(y, vTop(deg) + D.skirt.trim * 1.8 + 0.15);
        const legs = torsoPts.filter((p) => p[1] > y - 0.1);
        // (the V's corners at the hem wider apart than the collar's notch above them: vwide)
        const az = key === 'E' && Math.abs(Math.abs(deg) - D.vcol) < 1e-9 ? Math.sign(deg) * D.vwide : deg;
        const r = Math.max(reach(legs, az, y, zc, half(j), 0.12) + D.skirt.c, rp + blend(D.hang.flare, deg) * (prev[1] - y));
        put(`${key}:${deg}`, at(az, r, y, zc), 'torso');
      });
    }
    // T: up from the hem along the cloth by the trim's width (at the V's top, square to the V's edge)
    COL.forEach((deg, j) => { const [b, k] = hemUp(P, (d) => id(`E:${d}`), COL, j, zc); put(`T:${deg}`, add(P[id(`E:${deg}`)], mul(b, D.skirt.trim * k)), 'torso'); });
    ROWS.push({ key: 'LH', zc }, { key: 'T', zc }, { key: 'E', zc });
  }
  const rowKeys = ROWS.map((r) => r.key);

  // the collar: on the neckline, open between the notch's columns
  const collarCols = COL.filter((deg) => Math.abs(deg) >= D.vcol - 1e-9);
  for (const deg of collarCols) {
    const n = P[id(`N:${deg}`)], j = COL.indexOf(deg);
    for (const [key, f] of [['K0', D.collar.linen], ['K1', 1]]) {
      const y = n[1] + blend(D.collar.h, deg) * f;
      const r = Math.max(reach(collarPts, deg, y, zN, half(j), 0.08) + D.collar.c, 0);
      // (never further out than the neckline: the collar stands up the neck)
      const rn = Math.hypot(n[0], n[2] - zN);
      put(`${key}:${deg}`, at(deg, Math.min(rn, r), y, zN), 'collar');
      // (the linen's top on the straight line from the neckline to the rim, so the band is one slope)
      if (key === 'K1') { const k1 = P[id(`K1:${deg}`)]; P[id(`K0:${deg}`)] = lerp(n, k1, D.collar.linen); }
    }
  }

  // the sleeves: rings round the arm from the armhole to the cuff's edge
  const SL = D.sleeve, cuff = SL.cuff;
  const sleeveRings = {};
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const ringOf = (r) => Array.from({ length: 8 }, (_, k) => BV(`arm/${r}${k}.${s}`));
    const m = (p) => [p[0] * sg, p[1], p[2]];
    const elbow = m(J.elbow), wrist = m(J.wrist), fore = sub(wrist, elbow), fl = Math.hypot(...fore);
    // the forearm's rings in order down it, for a ring anywhere along it
    const fRings = [...new Set(B.names.filter((n) => /^arm\/f[a-z]0\.L$/.test(n)).map((n) => n.slice(4, 6)))].map((r) => ({ r, pts: ringOf(r) })).map((x) => ({ ...x, t: dot(sub(mean(x.pts), elbow), fore) / (fl * fl) })).sort((a, b) => a.t - b.t);
    const ringAt = (t) => {
      let i = 0;
      while (i + 2 < fRings.length && fRings[i + 1].t < t) i++;
      const a = fRings[i], b = fRings[i + 1], u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      return a.pts.map((p, k) => lerp(p, b.pts[k], u));
    };
    // a ring pushed out from its centre (square to the arm's axis there) by c
    // (less on the arm's inside, toward the torso: SL.inner of it at the inside corner, between at its neighbours)
    const kc = (k) => (k === 5 ? SL.inner : k === 4 || k === 6 ? (1 + SL.inner) / 2 : 1);
    const out = (pts, c, axis) => { const ctr = mean(pts); return pts.map((p, k) => { let d = sub(p, ctr); d = sub(d, mul(axis, dot(d, axis))); return add(add(ctr, d), mul(unit(d), c * kc(k))); }); };
    const list = [];
    const named = SL.rings.map(([r, c]) => ({ pts: ringOf(r), c }));
    const tTop = cuff.at - cuff.len, tEdge = cuff.at;
    const ctrs = [...named.map((x) => mean(x.pts)), mean(ringAt(tTop))];
    named.forEach((x, i) => list.push({ key: `s${i}`, pts: out(x.pts, x.c, unit(sub(ctrs[i + 1], i ? ctrs[i - 1] : mean(hole[s].ring)))) }));
    // the cuff: its top at the sleeve's clearance, stepped out, then its bands down to the edge
    const fax = unit(fore);
    list.push({ key: 'c0', pts: out(ringAt(tTop), cuff.c, fax) });
    list.push({ key: 'c1', pts: out(ringAt(tTop), cuff.c + cuff.step, fax) });
    let acc = 0;
    cuff.bands.forEach(([mat], b) => {
      acc += cuff.bands[b][1];
      const t = tTop + (tEdge - tTop) * acc;
      list.push({ key: `cb${b}`, pts: out(ringAt(t), cuff.c + cuff.step, fax), mat });
    });
    // the sleeve's underside kept below the armhole's foot: each ring's inner corners no higher than the foot less a step
    const footY = hole[s].ring[5][1];
    // (slid down the arm's inside along the line of each corner through the rings below, so they stay on the arm)
    for (const k of [4, 5, 6]) {
      const line = list.map((x) => x.pts[k]);
      list.forEach((x, i) => {
        const lim = hole[s].ring[k][1] - SL.under * (i + 1);
        if (x.pts[k][1] <= lim) return;
        for (let j = i; j + 1 < line.length; j++) { const a = line[j], b = line[j + 1]; if (b[1] <= lim) { x.pts[k] = lerp(a, b, (a[1] - lim) / Math.max(1e-9, a[1] - b[1])); break; } }
      });
    }
    list.forEach((x) => x.pts.forEach((p, k) => put(`${s}:${x.key}:${k}`, p, `sleeve_${s}`)));
    sleeveRings[s] = list;
  }

  /* -- the outer surface's quads -- */
  const quads = [];
  const Q = (keys, grp) => { const v = keys.map(id); if (v.some((x) => x === undefined)) return; quads.push([v, grp]); };
  const inHole = (r1, r2, a, b) => {
    for (const sg of [1, -1]) {
      const cols = D.arm.map((x) => x * sg), rr = ['S', 'A1', 'A2'];
      if (rr.indexOf(r1) >= 0 && rr.indexOf(r2) === rr.indexOf(r1) + 1 && cols.includes(a) && cols.includes(b)) return true;
    }
    return false;
  };
  for (let i = 0; i + 1 < rowKeys.length; i++) for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC], r1 = rowKeys[i], r2 = rowKeys[i + 1];
    if (inHole(r1, r2, a, b)) continue;
    Q([`${r1}:${a}`, `${r1}:${b}`, `${r2}:${b}`, `${r2}:${a}`], i >= rowKeys.indexOf('T') ? 'hem' : 'torso');
  }
  for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC];
    if (!collarCols.includes(a) || !collarCols.includes(b)) continue;
    Q([`N:${a}`, `N:${b}`, `K0:${b}`, `K0:${a}`], 'collar');
    Q([`K0:${a}`, `K0:${b}`, `K1:${b}`, `K1:${a}`], 'collar');
  }
  for (const s of ['L', 'R']) {
    const rings = [armKey(s), ...sleeveRings[s].map((x) => Array.from({ length: 8 }, (_, k) => `${s}:${x.key}:${k}`))];
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < 8; k++) Q([rings[i][k], rings[i][(k + 1) % 8], rings[i + 1][(k + 1) % 8], rings[i + 1][k]], i === 0 ? `cap_${s}` : `sleeve_${s}`);
  }

  /* -- clear of the body -- */
  const need = T + D.CLEAR;
  const hemY = (p) => { let best = null; for (const deg of COL) { const e = P[id(`E:${deg}`)]; const d = Math.abs(wrap(azOf(p, ROWS.at(-1).zc) - deg)); if (!best || d < best.d) best = { d, y: e[1] }; } return best.y; };
  const collarTop = (p) => { let best = null; for (const deg of collarCols) { const d = Math.abs(wrap(azOf(p, zN) - deg)); if (!best || d < best.d) best = { d, y: P[id(`K1:${deg}`)][1] }; } return best.y; };
  const armT = (p, sg) => { const e = [J.elbow[0] * sg, J.elbow[1], J.elbow[2]], w = [J.wrist[0] * sg, J.wrist[1], J.wrist[2]], f = sub(w, e); return dot(sub(p, e), f) / dot(f, f); };
  // (the armpit's skin, between the body's armpit and the armhole's lowered foot, front corner to back corner: under the
  // sleeve's cap, left out, as neither the torso's cloth nor the sleeve's alone must hold it)
  const pit = (p) => {
    const s = p[0] > 0 ? 'L' : 'R', h = hole[s].ring, top = B.verts[B.index.get(`dc4.${s}`)][1] + 0.15;
    return p[1] <= top && p[1] >= h[5][1] - 0.02 && Math.abs(p[0]) >= Math.abs(h[5][0]) - D.armhole.pit && Math.abs(p[0]) <= Math.abs(h[5][0]) + D.armhole.pit && p[2] <= h[6][2] && p[2] >= h[4][2];
  };
  const groups = [
    { pts: SM.filter((s) => (s.part === 'torso' || s.part === 'pelvis' || (s.part === 'legs' && s.p[1] > hemY(s.p) + 0.02)) && !pit(s.p)).map((s) => s.p), faces: new Set(['torso', 'hem', 'cap_L', 'cap_R']), need },
    { pts: SM.filter((s) => (s.part === 'neck' || s.part === 'head') && s.p[1] < collarTop(s.p) - 0.02).map((s) => s.p), faces: new Set(['collar', 'torso']), need },
  ];
  for (const [s, sg] of [['L', 1], ['R', -1]]) groups.push({ pts: SM.filter((q) => (q.part === 'arm' || q.part === 'joint') && q.p[0] * sg > 0 && armT(q.p, sg) < cuff.at - 0.03).map((q) => q.p), faces: new Set([`sleeve_${s}`, `cap_${s}`]), need }); groups.forEach((g, i) => { if (i >= 2) g.pts = g.pts.filter((p) => !pit(p)); });
  const segOut = (p, a, b) => { const d = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d))); return sub(p, add(a, mul(d, t))); };
  const outward = (p, g) => {
    if (!g.startsWith('sleeve') && !g.startsWith('cap')) return [p[0], 0, p[2] - zN];
    const sg = g.endsWith('L') ? 1 : -1, m = (q) => [q[0] * sg, q[1], q[2]], sh = m(J.shoulder), el = m(J.elbow), wr = m(J.wrist);
    const a = segOut(p, sh, el), b = segOut(p, el, wr);
    return Math.hypot(...a) < Math.hypot(...b) ? a : b;
  };
    // (the armhole's foot and its corners, and the sleeve's inner corners near it, stay where they were put)
  const fixed = new Set();
  for (const s of ['L', 'R']) { const ak = armKey(s); for (const k of [4, 5, 6]) { fixed.add(id(ak[k])); for (const r of ['s0', 's1']) fixed.add(id(`${s}:${r}:${k}`)); } }
  let short = opts.noClear ? null : clearOut(P, quads, groups, { outward, fixed });


  // the cuff stands out of the sleeve by its step, each band at least as far out as the one above it (after the push)
  for (const s of ['L', 'R']) {
    const keys = sleeveRings[s].map((x) => x.key), i0 = keys.indexOf('c0');
    for (let i = i0 + 1; i < keys.length; i++) {
      const ring = (key) => Array.from({ length: 8 }, (_, k) => P[id(`${s}:${key}:${k}`)]), up = ring(keys[i - 1]), me = ring(keys[i]);
      const c = mean(me), ax = unit(sub(mean(up), c)), rad = (p) => { const d = sub(p, c); return sub(d, mul(ax, dot(d, ax))); };
      for (let k = 0; k < 8; k++) {
        const want = Math.hypot(...rad(up[k])) + (keys[i] === 'c1' ? cuff.step : 0), d = rad(me[k]), l = Math.hypot(...d);
        if (l < want) P[id(`${s}:${keys[i]}:${k}`)] = add(me[k], mul(unit(d), want - l));
      }
    }
  }
  // symmetric: each left vertex and its mirror on the right made exact mirrors (the left's)
  for (const [key, i] of K) {
    const parts = key.split(':'), sleeve = parts.length === 3;
    const m = sleeve ? (parts[0] === 'L' ? `R:${parts[1]}:${parts[2]}` : null) : +parts[1] > 0 && +parts[1] < 180 ? `${parts[0]}:${-parts[1]}` : null;
    if (!sleeve && (Math.abs(+parts[1]) < 1e-9 || Math.abs(+parts[1] - 180) < 1e-9)) P[i] = [0, P[i][1], P[i][2]];
    if (!m || !K.has(m)) continue;
    const p = P[i]; P[K.get(m)] = [-p[0], p[1], p[2]];
  }

  return meshOfTunic(rig, D, { P, K, part, quads, COL, NC, rowKeys, collarCols, sleeveRings, ROWS, zN, short });
}

/**
 * Into the cloth from the hem at column j: the bisector of the two hem edges' perpendiculars in the cloth (up from a
 * level hem, out of the V along its edges), and the mitre (how much further along it a band of even width reaches).
 */
function hemUp(P, idOf, COL, j, zc) {
  const N = COL.length, e = P[idOf(COL[j])], a = P[idOf(COL[(j + N - 1) % N])], b = P[idOf(COL[(j + 1) % N])];
  const n = unit([e[0], 0, e[2] - zc]);
  const perp = (d) => { const p = unit(cross(n, d)); return p[1] < 0 ? mul(p, -1) : p; };
  const p1 = perp(sub(e, a)), p2 = perp(sub(b, e)), bis = unit(add(p1, p2));
  return [bis, Math.min(1.8, 1 / Math.max(0.1, dot(bis, p1)))];
}

/** The mesh: the outer surface's polygons with their materials, the cloth's edges turned in, the seams creased. */
function meshOfTunic(rig, D, S) {
  const { P, K, part, COL, NC, rowKeys, collarCols, sleeveRings, ROWS, zN } = S, T = D.THICK;
  const G = meshOf();
  P.forEach((p, i) => G.vert(p, part[i]));
  const id = (key) => K.get(key);
  // the outer surface's vertex normals (each its quads' normals, outward: away from the torso's axis or the arm's)
  const vn = P.map(() => [0, 0, 0]);
  for (const [v] of S.quads) { const n = cross(sub(P[v[2]], P[v[0]]), sub(P[v[3]], P[v[1]])); for (const i of v) vn[i] = add(vn[i], n); }
  const zcOf = (key) => ROWS.find((r) => r.key === key.split(':')[0])?.zc ?? zN;
  const outward = (i, key) => {
    const p = P[i];
    let ref;
    if (key.split(':').length === 3) { const s = key[0], x = sleeveRings[s].find((r) => key.split(':')[1] === r.key); ref = sub(p, mean(x.pts)); }
    else ref = [p[0], 0, p[2] - zcOf(key)];
    const n = unit(vn[i]);
    return dot(n, ref) >= 0 ? n : mul(n, -1);
  };
  const poly = (keys, mat, prt, tag) => { G.tag = tag; G.poly(keys.map((k) => (typeof k === 'number' ? k : id(k))), mat, prt); };
  const panelOf = () => 'fabric';
  // the seams' stitch lines: on each seam's column (DESIGN.seams, both sides), from row `from` to row `to`, a strip `w`
  // wide toward the column `dir` of it, its far edge on each row's edge between the two
  const strip = new Map();
  for (const sm of D.seams ?? []) for (const sg of [1, -1]) {
    const a = sm.at * sg === -180 ? 180 : sm.at * sg, ja = COL.indexOf(a), b = COL[(ja + (sm.dir * sg > 0 ? 1 : -1) + NC) % NC];
    const r0 = rowKeys.indexOf(sm.from), r1 = rowKeys.indexOf(sm.to);
    for (let r = r0; r <= r1; r++) {
      const pa = P[id(`${rowKeys[r]}:${a}`)], pb = P[id(`${rowKeys[r]}:${b}`)];
      if (!pa || !pb) continue;
      const t = Math.min(0.4, sm.w / Math.hypot(...sub(pb, pa)));
      strip.set(`${rowKeys[r]}:${a}>${b}`, G.vert(lerp(pa, pb, t), 'torso'));
    }
  }
  const across = (r, a, b) => strip.get(`${r}:${a}>${b}`) ?? strip.get(`${r}:${b}>${a}`);
  const stripAt = (r, a, b) => (strip.has(`${r}:${a}>${b}`) ? 'a' : strip.has(`${r}:${b}>${a}`) ? 'b' : null);
  // the torso and the skirt
  for (let i = 0; i + 1 < rowKeys.length; i++) for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC], r1 = rowKeys[i], r2 = rowKeys[i + 1];
    const keys = [`${r1}:${a}`, `${r1}:${b}`, `${r2}:${b}`, `${r2}:${a}`];
    if (keys.some((k) => id(k) === undefined)) continue;
    const hole = S.quads.find(([v]) => v.join() === keys.map(id).join());
    if (!hole) continue;
    const mat = r1 === 'T' ? 'trim' : panelOf(a, b), u = across(r1, a, b), d = across(r2, a, b);
    if (u !== undefined && d !== undefined) {
      // (the stitch line beside the seam's column, the rest of the panel beyond it)
      const [A1, B1, B2, A2] = keys.map(id), side = stripAt(r1, a, b);
      if (side === 'a') { poly([A1, u, d, A2], 'seam', 'torso', `${r1}-${r2}`); poly([u, B1, B2, d], mat, 'torso', `${r1}-${r2}`); }
      else { poly([A1, u, d, A2], mat, 'torso', `${r1}-${r2}`); poly([u, B1, B2, d], 'seam', 'torso', `${r1}-${r2}`); }
    } else {
      const ks = [id(keys[0]), u, id(keys[1]), id(keys[2]), d, id(keys[3])].filter((x) => x !== undefined);
      poly(ks, mat, 'torso', `${r1}-${r2}`);
    }
  }
  // the collar's outside
  for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC];
    if (!collarCols.includes(a) || !collarCols.includes(b)) continue;
    poly([`N:${a}`, `N:${b}`, `K0:${b}`, `K0:${a}`], 'fabric', 'collar', 'N-K0');
    poly([`K0:${a}`, `K0:${b}`, `K1:${b}`, `K1:${a}`], 'trim', 'collar', 'K0-K1');
  }
  // the sleeves and the cuffs
  for (const s of ['L', 'R']) {
    const [f, m, b] = D.arm, sg = s === 'L' ? 1 : -1;
    const hole = [['S', f], ['S', m], ['S', b], ['A1', b], ['A2', b], ['A2', m], ['A2', f], ['A1', f]].map(([r, a]) => `${r}:${a * sg}`);
    const rings = [{ key: 'arm', keys: hole }, ...sleeveRings[s].map((x) => ({ ...x, keys: Array.from({ length: 8 }, (_, k) => `${s}:${x.key}:${k}`) }))];
    for (let i = 0; i + 1 < rings.length; i++) {
      const nx = rings[i + 1], mat = nx.key === 'c1' ? 'trim' : nx.mat ?? panelOf(0, 0);
      for (let k = 0; k < 8; k++) poly([rings[i].keys[k], rings[i].keys[(k + 1) % 8], nx.keys[(k + 1) % 8], nx.keys[k]], mat, `sleeve_${s}`, `${rings[i].key}-${nx.key}`);
    }
  }

  /* -- the edges turned in -- */
  const inner = (key, d, up = [0, 0, 0], prt) => { const i = id(key); return G.vert(add(add(P[i], mul(outward(i, key), -d)), up), prt ?? part[i]); };
  // the hem: in by the thickness, then up inside
  const Ei = {}, Ei2 = {};
  COL.forEach((deg, j) => {
    const e = `E:${deg}`, [up, k] = hemUp(P, (d) => id(`E:${d}`), COL, j, ROWS.at(-1).zc);
    Ei[deg] = inner(e, T, mul(up, T * 0.4 * k));
    Ei2[deg] = G.verts.push(add(G.verts[Ei[deg]], mul(up, D.skirt.trim * 1.1 * k))) - 1; G.part.push('torso');
  });
  for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC];
    poly([`E:${a}`, `E:${b}`, Ei[b], Ei[a]], 'trim', 'torso', 'E-Ei');
    poly([Ei[a], Ei[b], Ei2[b], Ei2[a]], 'inner', 'torso', 'Ei-Ei2');
  }
  // the cuffs: in by the thickness, then up inside
  for (const s of ['L', 'R']) {
    const last = sleeveRings[s].at(-1), top = sleeveRings[s].find((x) => x.key === 'c1');
    const ci = [], ci2 = [];
    for (let k = 0; k < 8; k++) {
      const key = `${s}:${last.key}:${k}`, up = unit(sub(P[id(`${s}:c0:${k}`)], P[id(key)]));
      ci.push(inner(key, T, mul(up, T * 0.4)));
      ci2.push(G.verts.push(add(G.verts[ci[k]], mul(up, 0.22))) - 1); G.part.push(`sleeve_${s}`);
    }
    void top;
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      poly([`${s}:${last.key}:${k}`, `${s}:${last.key}:${k2}`, ci[k2], ci[k]], 'trim', `sleeve_${s}`, 'cuff-edge');
      poly([ci[k], ci[k2], ci2[k2], ci2[k]], 'inner', `sleeve_${s}`, 'cuff-in');
    }
  }
  // the neckline: in by the thickness all round (the collar's inside comes down to it); the collar's rim and inside; the
  // notch's ends closed
  const Ni = {}, K2 = {};
  // (square in from the collar: toward the neck's axis, level)
  const toAxis = (key) => { const p = P[id(key)]; return mul(unit([p[0], 0, p[2] - zN]), -T); };
  for (const deg of COL) { Ni[deg] = G.vert(add(P[id(`N:${deg}`)], toAxis(`N:${deg}`)), 'collar'); }
  const K0i = {};
  for (const deg of collarCols) { K2[deg] = G.vert(add(add(P[id(`K1:${deg}`)], toAxis(`K1:${deg}`)), [0, -T * 0.3, 0]), 'collar'); K0i[deg] = G.vert(add(P[id(`K0:${deg}`)], toAxis(`K0:${deg}`)), 'collar'); }
  for (let j = 0; j < NC; j++) {
    const a = COL[j], b = COL[(j + 1) % NC];
    if (collarCols.includes(a) && collarCols.includes(b)) {
      poly([`K1:${a}`, `K1:${b}`, K2[b], K2[a]], 'trim', 'collar', 'K1-K2');
      poly([K2[a], K2[b], K0i[b], K0i[a]], 'inner', 'collar', 'K2-K0i');
      poly([K0i[a], K0i[b], Ni[b], Ni[a]], 'inner', 'collar', 'K0i-Ni');
    } else poly([`N:${a}`, `N:${b}`, Ni[b], Ni[a]], 'inner', 'collar', 'N-Ni');
  }
  for (const deg of [D.vcol, -D.vcol]) poly([`N:${deg}`, `K0:${deg}`, `K1:${deg}`, K2[deg], K0i[deg], Ni[deg]], 'fabric', 'collar', 'notch');

  // (a stitch line's far edge on the edge of any other polygon too: the collar's, the sleeve cap's)
  const onEdge = new Map();
  for (const [k, v] of strip) { const [r, ab] = k.split(':'), [a, b] = ab.split('>'); const x = id(`${r}:${a}`), y = id(`${r}:${b}`); onEdge.set(`${Math.min(x, y)},${Math.max(x, y)}`, v); }
  for (const p of G.polys) {
    if (p.v.some((x) => [...onEdge.values()].includes(x))) continue;
    const out = [];
    p.v.forEach((x, k) => { out.push(x); const y = p.v[(k + 1) % p.v.length], m = onEdge.get(`${Math.min(x, y)},${Math.max(x, y)}`); if (m !== undefined) out.push(m); });
    if (out.length !== p.v.length) p.v = out;
  }
  const axisOut = (p) => [p[0], 0, p[2] - zN];
  orient(G, axisOut);
  G.tris = trisOf(G);
  G.design = D; G.keys = K; G.cols = COL; G.rowKeys = rowKeys; G.short = S.short;
  G.lips = { Ei, Ei2, Ni, K2 };
  return G;
}

/**
 * The tunic's weights from the body: each vertex the body's at its closest point, the legs' bones taken half up to the
 * pelvis (the skirt swings with the thighs, not as far), the head's down to the neck; the cloth's turned-in edges the
 * weights of the outer edge they turn in from.
 */
export function tunicWeights(rig, G, o = {}) {
  const k = o.thigh ?? G.design.thigh ?? 0.45;
  const map = (n) => {
    if (/^(head|jaw)$/.test(n)) return 'neck_02';
    const m = n.match(/^(thigh|hip|calf|knee|foot|ankle|ball|toes)_(l|r)$/);
    if (m) return [[m[1] === 'hip' ? `hip_${m[2]}` : `thigh_${m[2]}`, k], ['pelvis', 1 - k]];
    if (/^(hand|thumb|fingers|wrist|knuckles)/.test(n)) return `lowerarm_${n.match(/_(l|r)$/)[1]}`;
    return n;
  };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 3 });
  return vw;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { buildRig } = await import('../lowrig.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildTunic(rig);
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, short ${G.short}`, JSON.stringify(clearOut.at), [...G.keys].filter(([k, i]) => clearOut.at.tri.includes(i)).map(([k]) => k).join(' '));
  }
}
