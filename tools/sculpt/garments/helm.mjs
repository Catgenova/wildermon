// The sacred plate helm (the plate set's helm sheet: a fortress great helm, its crest from brow to back, a beaked brow
// with a glowing star, a pointed faceplate of two flat halves with vertical slit vents, angular cheek plates, a disc on
// each side, stepped back plates over the nape, a neck guard below), fitted to each low-poly body from the one design
// (DESIGN, per body): rigid on the head bone, the neck guard alone blended toward the neck. No bones of its own.
//
//   buildHelm(rig, design) → { verts, polys: [{ v, mat, part, tag }], tris, part, design, hides }
//   helmWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/helm.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowhelm-male.json and lowhelm-female.json
//     (lowgarment.mjs garmentAsset, plus `hides`, the head's polygons inside the helm; `glow`, the materials drawn unlit;
//     loaded by src/sculpt/lowpoly.ts)
//
// The construction, in the body's units and axes (y up, the chin's underside 0, z forward, x the body's left), about a
// vertical axis through (0, ·, z0); an azimuth 0 forward, +90 toward the body's left:
//   the shell: one closed surface, columns at AZ round the axis, each a profile of stations down from the crown (the dome,
//   the band round the head, its gold rims and the brow's beak over the face, the ledge under it, the back's two stepped
//   plates and the nape's flare, the bottom rim), then the lining up the inside to a dark cap under the face. Each
//   station's radius is the dome's section (a superellipse, `sec`) plus its own offset; under the band at the front the
//   shell is cut by the faceplate's two planes (set back by `gap`, dark: the eye slit, the seam and the vents show it).
//   The plates laid on it (each its own piece, its underside `gap` off the shell, never crossing it): the crest along the
//   midline, the faceplate's two halves (a frame round the vents, `vents` slits a side), the cheek plates, the side discs
//   with their bosses, the star on the brow (unlit), and the neck guard (a ring round the neck inside the bottom rim).
// Materials: plate (cream), shade (its darker tone, on undersides), gold (trim, rims, crest, bosses), glow (the star,
// unlit), under (the dark under-layer: inside, the eye slit, the vents).
import { meshOf, orient, trisOf, samplesOf, closestOnTri, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';

/**
 * The plate set's shared colours (red, green, blue nought to one; the same values and names on every plate piece, so the
 * game shares their slots): plate #E8C7BD (the sheet's lit plate under the review light), shade, gold #D9A85A, glow
 * #FFE7A6 (emissive), under.
 */
export const MATS = {
  plate: [0.91, 0.78, 0.74],
  shade: [0.8, 0.67, 0.63],
  gold: [0.851, 0.659, 0.353],
  glow: [1, 0.906, 0.651],
  under: [0.29, 0.22, 0.2],
};
/** The materials drawn unlit (emissive, always lit). */
export const GLOW = ['glow'];

/** Piecewise linear through [x, y] pairs (sorted by x), held at the ends. */
const interp = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / Math.max(1e-9, P[i + 1][0] - P[i][0]);
  return P[P.length - 1][1];
};
/** A design table by azimuth (|az|, 0 to 180): [[deg, value], ...]. */
const byAz = (T, az) => interp(T, Math.abs(az));

/**
 * The design per body (the body's units):
 *   z0: the axis's z; sec: the dome's horizontal sections by height [y, half-width, front, back, power];
 *   top: the crown's top point; rings: the dome's stations' heights;
 *   band: the band round the head: its top and bottom heights by azimuth, how far it stands out (the brow's beak at the
 *   front), its gold rim's height and how far that stands out again; ledge: the band's underside's drop;
 *   back: the stepped back plates: plate 1's bottom height, how far plate 2 stands out (both by azimuth, nothing at the
 *   front), the bottom rim's height and the nape's flare (by azimuth);
 *   face: the faceplate: the prow's z at the top and at the bottom (heights yTop, yBot), each half's angle back from
 *   the front (degrees), its outer edge's x at the top and the bottom, its top under the brow by `eye`, its bottom at
 *   the prow and at the outer edge, the seam's half-width, its thickness, the vents (s ranges across, t range down);
 *   gap: every plate off what it lies on; thick: the shell's thickness at the bottom rim; lining: the lining's top;
 *   crest: width at its foot and top, height; disc: radius, boss radius, heights; cheek: its corners (azimuth, height);
 *   guard: the neck guard: its top and bottom heights, clearance off the neck, thickness, flare.
 */
export const DESIGN = {
  male: {
    z0: 0.1,
    sec: [[-0.3, 0.84, 1.0, 0.82, 2.6], [0.3, 0.88, 1.06, 0.8, 2.6], [0.6, 0.93, 1.06, 0.84, 2.6], [0.9, 0.97, 1.06, 0.95, 2.6], [1.4, 0.97, 1.0, 1.0, 2.5], [1.9, 0.86, 0.86, 0.92, 2.3], [2.2, 0.62, 0.6, 0.7, 2.1], [2.36, 0.3, 0.28, 0.36, 2.0]],
    top: [0, 2.42, -0.04], rings: [2.26, 2.04, 1.74],
    band: { top: [[0, 1.68], [22, 1.56], [44, 1.46], [62, 1.42], [180, 1.42]], bot: [[0, 0.82], [22, 0.88], [44, 0.94], [62, 0.97], [100, 0.98], [180, 0.98]], out: [[0, 0.34], [22, 0.22], [44, 0.15], [62, 0.13], [100, 0.12], [180, 0.12]], rim: 0.07, rimOut: 0.035 },
    ledge: 0.03,
    back: { p1: [[0, 0.6], [104, 0.6], [126, 0.5], [180, 0.48]], step: [[0, 0], [104, 0], [126, 0.08], [180, 0.1]], bot: [[0, -0.16], [22, 0.0], [44, 0.14], [62, 0.2], [82, 0.18], [126, 0.08], [180, 0.04]], flare: [[0, 0], [82, 0.0], [126, 0.1], [180, 0.14]] },
    face: { yTop: 0.73, yBot: -0.16, zTop: 1.22, zBot: 1.13, ang: 40, xOutTop: 0.8, xOutBot: 0.64, eye: 0.08, botOut: 0.0, seam: 0.05, t: 0.07, vents: [[0.2, 0.3], [0.44, 0.54], [0.68, 0.78]], vt: [0.16, 0.66] },
    gap: 0.01, thick: 0.07, lining: 0.55,
    crest: { w: 0.38, wt: 0.3, h: 0.17 }, star: 0.3,
    disc: { r: 0.34, boss: 0.19, h: 0.07, bh: 0.07 },
    cheek: { az: [[64, 0.9], [100, 0.9], [96, 0.1], [62, 0.08]], t: 0.05 },
    guard: { cz: -0.15, cols: 10, top: 0.2, ring: -0.2, bot: -0.36, clear: 0.05, t: 0.06, flare: 0.03 },
  },
  female: {
    z0: 0.05,
    sec: [[-0.3, 0.74, 0.92, 0.76, 2.4], [0.3, 0.8, 1.0, 0.74, 2.4], [0.6, 0.85, 1.0, 0.8, 2.4], [0.9, 0.9, 1.0, 0.98, 2.4], [1.4, 0.9, 0.96, 1.02, 2.3], [1.9, 0.8, 0.82, 0.94, 2.2], [2.2, 0.58, 0.56, 0.7, 2.0], [2.34, 0.28, 0.26, 0.34, 2.0]],
    top: [0, 2.4, -0.06], rings: [2.24, 2.02, 1.74],
    band: { top: [[0, 1.7], [22, 1.58], [44, 1.48], [62, 1.44], [180, 1.44]], bot: [[0, 0.86], [22, 0.92], [44, 0.98], [62, 1.0], [100, 1.01], [180, 1.01]], out: [[0, 0.3], [22, 0.19], [44, 0.13], [62, 0.11], [100, 0.1], [180, 0.1]], rim: 0.06, rimOut: 0.03 },
    ledge: 0.03,
    back: { p1: [[0, 0.62], [104, 0.62], [126, 0.52], [180, 0.5]], step: [[0, 0], [104, 0], [126, 0.05], [180, 0.07]], bot: [[0, -0.1], [22, 0.05], [44, 0.18], [62, 0.24], [82, 0.22], [126, 0.1], [180, 0.06]], flare: [[0, 0], [82, 0.0], [126, 0.07], [180, 0.1]] },
    face: { yTop: 0.78, yBot: -0.1, zTop: 1.16, zBot: 1.04, ang: 42, xOutTop: 0.72, xOutBot: 0.54, eye: 0.08, botOut: 0.0, seam: 0.045, t: 0.06, vents: [[0.2, 0.3], [0.44, 0.54], [0.68, 0.78]], vt: [0.16, 0.66] },
    gap: 0.01, thick: 0.06, lining: 0.5,
    crest: { w: 0.32, wt: 0.25, h: 0.15 }, star: 0.27,
    disc: { r: 0.3, boss: 0.17, h: 0.06, bh: 0.06 },
    cheek: { az: [[64, 0.94], [100, 0.94], [96, 0.14], [62, 0.12]], t: 0.045 },
    guard: { cz: -0.11, cols: 10, top: 0.16, ring: -0.3, bot: -0.46, clear: 0.04, t: 0.05, flare: 0.03 },
  },
};
/** The shell's columns: azimuths round the axis (degrees, 0 forward, +90 the body's left), in order round. */
export const AZ = [0, 22, 44, 62, 82, 102, 126, 152, 180, -152, -126, -102, -82, -62, -44, -22];

/** The dome's section at height y toward azimuth az: the superellipse's radius. */
function secR(D, az, y) {
  const S = D.sec, at = (k) => interp(S.map((s) => [s[0], s[k]]), y);
  const W = at(1), F = at(2), K = at(3), P = at(4), a = az * Math.PI / 180, sx = Math.abs(Math.sin(a)), cz = Math.cos(a);
  const Z = cz >= 0 ? F : K;
  return Math.pow(Math.pow(sx / W, P) + Math.pow(Math.abs(cz) / Z, P), -1 / P);
}

export function buildHelm(rig, design = DESIGN[rig.who]) {
  const D = design, z0 = D.z0, F = D.face;
  const G = meshOf();
  const at = (az, r, y) => { const a = az * Math.PI / 180; return [Math.sin(a) * r, y, z0 + Math.cos(a) * r]; };
  // the faceplate's planes: the left half z = zp(y) - x tan(ang) (x >= 0), the right its mirror
  const tanA = Math.tan(F.ang * Math.PI / 180);
  const zp = (y) => F.zBot + (F.zTop - F.zBot) * (y - F.yBot) / (F.yTop - F.yBot);
  /** The radius toward az at height y where the plane set back by `back` meets it (Infinity behind the prow's side). */
  const rPlane = (az, y, back = 0) => { const a = Math.abs(az) * Math.PI / 180, den = Math.cos(a) + Math.sin(a) * tanA; return den <= 1e-6 ? Infinity : (zp(y) - back * Math.hypot(1, tanA) - z0) / den; };
  const nPlane = (sg) => unit([sg * tanA, -(F.zTop - F.zBot) / (F.yTop - F.yBot), 1]);

  /* ---- the shell's profile: per column the stations down from the crown ---- */
  const B = D.band, BK = D.back;
  const N = AZ.length;
  const st = AZ.map((az) => {
    const bt = byAz(B.top, az), bb = byAz(B.bot, az), bo = byAz(B.out, az);
    const p1 = byAz(BK.p1, az), sp = byAz(BK.step, az), yb = byAz(BK.bot, az), fl = byAz(BK.flare, az);
    const R = (y) => secR(D, az, y);
    // under the band at the front, the faceplate's planes set back by gap (the face's dark), never further out than the section
    const Rf = (y) => Math.min(R(y), rPlane(az, y, D.gap));
    const yl = bb - D.ledge;
    const P = [
      ...D.rings.map((y, k) => [`r${k + 1}`, y, R(y)]),
      ['bt', bt, R(bt)],
      ['bto', bt, R(bt) + bo],
      ['brr', bb + B.rim, R(bb + B.rim) + bo],
      ['brg', bb + B.rim, R(bb + B.rim) + bo + B.rimOut],
      ['blo', bb, R(bb) + bo + B.rimOut],
      ['bli', yl, Rf(yl)],
      ['p1b', p1, Rf(p1)],
      ['p2t', p1, Rf(p1) + sp],
      ['bot', yb, Rf(yb) + sp + fl],
    ];
    return P;
  });
  const KS = st[0].length;
  // the vertices: a station reusing the one above it where they coincide (no step there)
  const V = st.map((P, j) => {
    const ids = [];
    P.forEach(([key, y, r], k) => {
      const p = at(AZ[j], r, y);
      if (k > 0) { const q = G.verts[ids[k - 1]]; if (Math.hypot(...sub(p, q)) < 1e-6) { ids.push(ids[k - 1]); return; } }
      ids.push(G.vert(p, 'shell'));
    });
    return ids;
  });
  const top = G.vert(D.top, 'shell');
  // the lining: the bottom rim's inside (thick in), up to the lining's top, a dark cap
  const inner = AZ.map((az, j) => {
    const p = G.verts[V[j][KS - 1]], d = unit([p[0], 0, p[2] - z0]);
    const a = add(p, mul(d, -D.thick)), b = [a[0], D.lining, a[2]];
    // (the lining's top kept inside the shell there)
    const rr = Math.min(Math.hypot(a[0], a[2] - z0), secR(D, az, D.lining) - D.thick);
    return [G.vert(a, 'shell'), G.vert(at(az, rr, D.lining), 'shell')];
  });
  const capIn = G.vert([0, D.lining + 0.04, z0], 'shell');
  const front = (az) => Math.abs(az) < 64;
  const matOf = (k, az) => {
    const key = st[0][k][0], nxt = st[0][k + 1]?.[0];
    if (key === 'bt') return 'gold';                 // the band's top ledge
    if (key === 'brr' || key === 'brg') return 'gold'; // the rim's ledge and face
    if (key === 'blo') return front(az) ? 'under' : 'shade'; // the band's underside
    if (key === 'bli') return front(az) ? 'under' : 'plate'; // under the band: the face's dark at the front
    if (key === 'p1b') return 'gold';                // plate 2's top ledge
    if (key === 'p2t') return front(az) ? 'under' : 'plate';
    return 'plate';
  };
  G.tag = 'shell';
  for (let j = 0; j < N; j++) {
    const jn = (j + 1) % N;
    // the crown's cap
    G.poly([top, V[j][0], V[jn][0]], 'plate', 'shell');
    for (let k = 0; k + 1 < KS; k++) {
      const azm = (AZ[j] + (AZ[jn] < AZ[j] && AZ[j] > 0 ? AZ[jn] + 360 : AZ[jn])) / 2;
      const m = matOf(k, Math.abs(AZ[j]) < Math.abs(AZ[jn]) ? AZ[j] : AZ[jn]);
      G.poly([V[j][k], V[jn][k], V[jn][k + 1], V[j][k + 1]], m, 'shell');
    }
    // the bottom rim (gold), the lining (under), its cap
    G.tag = 'lining';
    G.poly([V[j][KS - 1], V[jn][KS - 1], inner[jn][0], inner[j][0]], 'gold', 'shell');
    G.poly([inner[j][0], inner[jn][0], inner[jn][1], inner[j][1]], 'under', 'shell');
    G.poly([inner[j][1], inner[jn][1], capIn], 'under', 'shell');
    G.tag = 'shell';
  }
  G.shellPolys = G.polys.length;

  /* ---- the shell's surface, for laying plates on it ---- */
  const shellTris = () => G.polys.slice(0, G.shellPolys).filter((p) => p.tag === 'shell').flatMap((p) => { const o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push([p.v[0], p.v[k], p.v[k + 1]]); return o; });
  const ST = shellTris();
  /** The closest point of the shell's outside to p: the point and the outward normal there. */
  const onShell = (p) => {
    let best = null;
    for (const t of ST) {
      const [a, b, c] = t.map((i) => G.verts[i]);
      const [q] = closestOnTri(p, a, b, c), d = Math.hypot(...sub(p, q));
      if (!best || d < best.d - 1e-9) best = { d, q, n: unit(cross(sub(b, a), sub(c, a))) };
    }
    // (outward: toward p, or away from the axis where p is on the shell)
    let n = best.n;
    const toward = best.d > 1e-4 ? sub(p, best.q) : [best.q[0], 0, best.q[2] - z0];
    if (dot(n, toward) < 0) n = mul(n, -1);
    return { q: best.q, n };
  };
  /** Where the ray from o along unit d first meets the shell's outside: the point and the normal facing back along d. */
  const rayShell = (o, d) => {
    let best = null;
    for (const t of ST) {
      const [a, b, c] = t.map((i) => G.verts[i]);
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, sv = sub(o, a), u = f * dot(sv, h); if (u < 0 || u > 1) continue;
      const qv = cross(sv, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) continue;
      const tt = f * dot(e2, qv);
      if (tt > 0 && (!best || tt < best.t)) { let n = unit(cross(e1, e2)); if (dot(n, d) > 0) n = mul(n, -1); best = { t: tt, q: add(o, mul(d, tt)), n }; }
    }
    return best;
  };
  /**
   * A plate laid on the shell: its outline `top` (points, in order round, the plate's outer face), its foot each outline
   * point's nearest on the shell `gap` out; the outer face (`faces`: polygons of indices into top, else one polygon), the
   * walls from the foot to the face.
   */
  const plate = (tag, topPts, faces, mat, wallMat = mat, opts = {}) => {
    G.tag = tag;
    const T = topPts.map((p) => G.vert(p, tag));
    const Fo = topPts.map((p) => { const s = onShell(p); return G.vert(add(s.q, mul(s.n, D.gap)), tag); });
    for (const f of faces ?? [topPts.map((_, i) => i)]) G.poly(f.map((i) => T[i]), mat, 'helm');
    const n = topPts.length;
    for (let i = 0; i < n; i++) { if (opts.open?.(i)) continue; const k = (i + 1) % n; G.poly([Fo[i], Fo[k], T[k], T[i]], typeof wallMat === 'function' ? wallMat(i) : wallMat, 'helm'); }
    // the underside (closed solid): a fan of the foot
    if (opts.closed) G.poly([...Fo].reverse(), 'shade', 'helm');
    return { T, Fo };
  };

  /* ---- the crest: along the midline from the brow's top over the crown to the band at the back ---- */
  {
    const C = D.crest, j0 = 0, j180 = AZ.indexOf(180);
    const ctr = [0, ...D.rings.map((_, k) => G.verts[V[j0][D.rings.length - 1 - k]]), D.top, ...D.rings.map((_, k) => G.verts[V[j180][k]]), G.verts[V[j180][D.rings.length]]];
    // (the front end on the beak's top ledge, back from its edge)
    ctr[0] = lerp(G.verts[V[j0][D.rings.length]], G.verts[V[j0][D.rings.length + 1]], 0.5);
    G.tag = 'crest';
    const rows = ctr.map((p, i) => {
      const s = onShell(p), n = s.n, x = [1, 0, 0];
      const base = add(s.q, mul(n, D.gap));
      return [add(base, mul(x, C.w / 2)), add(add(base, mul(x, C.wt / 2)), mul(n, C.h)), add(add(base, mul(x, -C.wt / 2)), mul(n, C.h)), add(base, mul(x, -C.w / 2))].map((q) => G.vert(q, 'crest'));
    });
    for (let i = 0; i + 1 < rows.length; i++) for (let k = 0; k < 3; k++) G.poly([rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]], 'gold', 'helm');
    G.poly([...rows[0]], 'gold', 'helm');
    G.poly([...rows[rows.length - 1]].reverse(), 'gold', 'helm');
  }

  /* ---- the faceplate's halves: a frame round the vents, on the plane ---- */
  for (const sg of [1, -1]) {
    const n = nPlane(sg), t = F.t;
    const onP = (x, y) => [sg * x, y, zp(y) - x * tanA];
    const bbAt = (x) => { const az = Math.atan2(x, zp(F.yTop) - x * tanA - z0) * 180 / Math.PI; return byAz(B.bot, az); };
    const A = onP(F.seam, byAz(B.bot, 0) - F.eye), Bq = onP(F.xOutTop, bbAt(F.xOutTop) - F.eye);
    const Cq = onP(F.xOutBot, byAz(BK.bot, 50) + F.botOut), Dq = onP(F.seam, F.yBot);
    const P = (s, u) => lerp(lerp(A, Bq, s), lerp(Dq, Cq, s), u);
    const SS = [0, ...F.vents.flat(), 1], TT = [0, ...F.vt, 1];
    const isVent = (i, k) => k === 1 && i % 2 === 1;
    const tag = `face ${sg > 0 ? 'L' : 'R'}`;
    G.tag = tag;
    const Tg = SS.map((s) => TT.map((u) => G.vert(add(P(s, u), mul(n, t)), tag)));
    const Bg = SS.map((s) => TT.map((u) => G.vert(P(s, u), tag)));
    for (let i = 0; i + 1 < SS.length; i++) for (let k = 0; k + 1 < TT.length; k++) {
      if (isVent(i, k)) {
        // the vent's walls, dark
        const c = [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]];
        for (let e = 0; e < 4; e++) { const [a, b] = [c[e], c[(e + 1) % 4]]; G.poly([Tg[a[0]][a[1]], Tg[b[0]][b[1]], Bg[b[0]][b[1]], Bg[a[0]][a[1]]], 'under', 'helm'); }
        continue;
      }
      G.poly([Tg[i][k], Tg[i + 1][k], Tg[i + 1][k + 1], Tg[i][k + 1]], 'plate', 'helm');
    }
    // the outer walls round the frame
    const ring = [...SS.map((_, i) => [i, 0]), ...TT.slice(1).map((_, k) => [SS.length - 1, k + 1]), ...SS.slice(0, -1).map((_, i) => [SS.length - 2 - i, TT.length - 1]), ...TT.slice(1, -1).map((_, k) => [0, TT.length - 2 - k])];
    for (let e = 0; e < ring.length; e++) { const [a, b] = [ring[e], ring[(e + 1) % ring.length]]; G.poly([Tg[a[0]][a[1]], Tg[b[0]][b[1]], Bg[b[0]][b[1]], Bg[a[0]][a[1]]], e < SS.length - 1 ? 'shade' : 'plate', 'helm'); }
  }

  /* ---- the cheek plates ---- */
  for (const sg of [1, -1]) {
    const C = D.cheek, pts = C.az.map(([az, y]) => { const s = onShell(at(sg * az, secR(D, sg * az, y) + 0.3, y)); return add(s.q, mul(s.n, D.gap + C.t)); });
    plate(`cheek ${sg > 0 ? 'L' : 'R'}`, sg > 0 ? pts : [...pts].reverse(), null, 'plate', 'shade');
  }

  /* ---- the side discs: on the band at 90, a boss on each ---- */
  for (const sg of [1, -1]) {
    const C = D.disc, yc = (byAz(B.top, 90) + byAz(B.bot, 90)) / 2;
    const dr = unit([Math.sin(sg * 92 * Math.PI / 180), 0, Math.cos(92 * Math.PI / 180)]), h = rayShell(add([0, yc, z0], mul(dr, 4)), mul(dr, -1)), n = h.n, c0 = add(h.q, mul(n, D.gap + C.h));
    const u = unit(cross([0, 1, 0], n)), w = unit(cross(n, u));
    const oct = (r, h) => Array.from({ length: 8 }, (_, k) => { const a = (k + 0.5) * Math.PI / 4; return add(add(c0, mul(n, h)), add(mul(u, r * Math.cos(a)), mul(w, r * Math.sin(a)))); });
    const tag = `disc ${sg > 0 ? 'L' : 'R'}`;
    const outer = oct(C.r, 0), bossB = oct(C.boss, 0), bossT = oct(C.boss * 0.75, C.bh);
    const { T } = plate(tag, outer, [], 'plate', 'shade');
    // (the face: the ring between the rim and the boss, then the boss)
    const Bi = bossB.map((p) => G.vert(p, tag)), Ti = bossT.map((p) => G.vert(p, tag)), cT = G.vert(add(c0, mul(n, C.bh)), tag);
    for (let k = 0; k < 8; k++) { const k1 = (k + 1) % 8; G.poly([T[k], T[k1], Bi[k1], Bi[k]], 'plate', 'helm'); G.poly([Bi[k], Bi[k1], Ti[k1], Ti[k]], 'gold', 'helm'); }
    G.poly(Ti, 'gold', 'helm');
    void cT;
  }

  /* ---- the star on the brow: a four-pointed star laid on the beak, seen from the front ---- */
  {
    const yS = (byAz(B.bot, 0) + B.rim + byAz(B.top, 0)) / 2, R = D.star, r = R * 0.26;
    const hit = (x, y) => rayShell([x, y, 6], [0, 0, -1]);
    const pts = Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4, l = k % 2 ? r : R; return [Math.sin(a) * l, yS + Math.cos(a) * l]; });
    G.tag = 'star';
    const T = pts.map(([x, y]) => { const h = hit(x, y); return G.vert(add(h.q, mul(h.n, D.gap + 0.035)), 'star'); });
    const Fo = pts.map(([x, y]) => { const h = hit(x, y); return G.vert(add(h.q, mul(h.n, D.gap)), 'star'); });
    const h0 = hit(0, yS), cT = G.vert(add(h0.q, mul(h0.n, D.gap + 0.06)), 'star');
    for (let k = 0; k < 8; k++) { const k1 = (k + 1) % 8; G.poly([cT, T[k], T[k1]], 'glow', 'helm'); G.poly([Fo[k], Fo[k1], T[k1], T[k]], 'gold', 'helm'); }
  }

  /* ---- the neck guard: dark round the neck from inside the bottom rim, a collar ring at its foot ---- */
  {
    const NG = D.guard, Bd = rig.B, cz = NG.cz, M = NG.cols;
    const keep = (i) => Bd.part[i] === 'neck' || Bd.part[i] === 'torso';
    const S = samplesOf({ tris: Bd.tris.filter((t) => t.v.every(keep)) }, Bd.verts, 0.04).filter((p) => p[1] > NG.ring - 0.02);
    const reach = (az, y) => { const d = [Math.sin(az * Math.PI / 180), Math.cos(az * Math.PI / 180)]; let r = 0; for (const p of S) { if (Math.abs(p[1] - y) > 0.06) continue; const w = [p[0], p[2] - cz], l = Math.hypot(...w); if (l < 1e-9) continue; if ((w[0] * d[0] + w[1] * d[1]) / l < Math.cos(18 * Math.PI / 180)) continue; r = Math.max(r, l); } return r; };
    // rows: the top (inside the helm), the ring's top, its ledge out, its foot (flared); the lip back in under it
    const rows = [[NG.top, 0], [NG.ring, 0], [NG.ring, NG.t], [NG.bot, NG.t + NG.flare]];
    const az = Array.from({ length: M }, (_, j) => j * 360 / M);
    const base = az.map((a) => { let r = 0; for (let y = NG.ring; y <= NG.top + 1e-9; y += 0.05) r = Math.max(r, reach(a, y)); return r + NG.clear; });
    G.tag = 'guard';
    const ring = (y, off) => az.map((a, j) => G.vert([Math.sin(a * Math.PI / 180) * (base[j] + off), y, cz + Math.cos(a * Math.PI / 180) * (base[j] + off)], 'guard'));
    const R = rows.map(([y, off]) => ring(y, off));
    const lip = ring(NG.bot, 0);
    const mats = ['under', 'gold', 'plate'];
    for (let j = 0; j < M; j++) {
      const j1 = (j + 1) % M;
      for (let k = 0; k + 1 < R.length; k++) G.poly([R[k][j], R[k][j1], R[k + 1][j1], R[k + 1][j]], mats[k], 'guard');
      G.poly([R[3][j], R[3][j1], lip[j1], lip[j]], 'shade', 'guard');
    }
    G.guardRows = [R[0], R[1], R[2], [...R[3], ...lip]];
  }

  orient(G, (c) => [c[0], (c[1] - 1) * 0.3, c[2] - z0]);
  G.tris = trisOf(G);
  // the head's polygons inside the helm: left out while it is worn
  const B0 = rig.B;
  G.hides = B0.polys.map((p, pi) => (p.v.every((i) => B0.part[i] === 'head') ? pi : -1)).filter((pi) => pi >= 0);
  G.design = D;
  return G;
}

/** The helm's weights: the head bone alone, the neck guard's lower rows blended toward the neck. */
export function helmWeights(rig, G) {
  const head = rig.at.get('head'), n2 = rig.at.get('neck_02'), n1 = rig.at.get('neck_01');
  const W = G.verts.map(() => [[head, 1]]);
  // (the guard's rows: its top with the head, the ring's top between, its foot with the neck)
  const share = [[[head, 0.75], [n2, 0.25]], [[n2, 0.6], [head, 0.2], [n1, 0.2]], [[n2, 0.6], [head, 0.2], [n1, 0.2]], [[n1, 0.6], [n2, 0.4]]];
  G.guardRows?.forEach((row, k) => row.forEach((i) => { W[i] = share[k]; }));
  return W;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildHelm(rig);
    G.vw = helmWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowhelm-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/helm.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), hides: G.hides, glow: GLOW };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
