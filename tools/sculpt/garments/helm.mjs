// The sacred plate helm (the plate set's helm sheet: a fortress great helm, its crest from brow to back, a beaked brow
// with a glowing star, a pointed faceplate of two flat halves with vertical slit vents, angular cheek plates, a disc on
// each side, stepped back plates over the nape), fitted to each low-poly body from the one design (DESIGN, per body):
// rigid on the head bone. No bones of its own.
//
//   buildHelm(rig, design) → { verts, polys: [{ v, mat, part, tag }], tris, part, design, hides }
//   helmWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/helm.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowhelm-male.json and lowhelm-female.json
//     (lowgarment.mjs garmentAsset, plus `hides`, the head's polygons the helm covers whole; `plain` and `enchanted`, its
//     two looks; loaded by src/sculpt/lowpoly.ts)
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
//   with their bosses, and the star on the brow.
// Materials: plate (cream), shade (its darker tone, on undersides), gold (trim, rims, crest, bosses), glow (the star,
// unlit), under (the dark under-layer: inside, the eye slit, the vents).
import { meshOf, orient, trisOf, samplesOf, closestOnTri, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';

/**
 * The plate set's shared colours and names (red, green, blue nought to one; the same on every plate piece, so the game
 * shares their slots): plate, shade, gold (the raised trim, metal in both looks), core (the cores: the star and the
 * discs' bosses), under (the dark under-layer: the brow's underside over the eye).
 */
export const MATS = {
  plate: [0.84, 0.71, 0.63],
  shade: [0.72, 0.6, 0.53],
  gold: [0.96, 0.74, 0.4],
  core: [0.86, 0.62, 0.3],
  under: [0.29, 0.22, 0.2],
};
/**
 * The two looks (lowgarment.mjs garmentAsset `looks`): plain, every material metal (kind 2, lit by the light's
 * brightness only, as the long sword), the cores a gold-amber gem; enchanted, the cores glowing #FFE7A6, unlit (kind 1;
 * the plate set's ENCHANT rule). The gold trim is metal in both.
 */
const metal = Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, { c, kind: 2 }]));
export const LOOKS = { plain: metal, enchanted: { ...metal, core: { c: [1, 0.906, 0.651], kind: 1 } } };

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
 */
export const DESIGN = {
  // (his: the sheet's silhouettes at 49.5 px a unit, the faceplate's foot at -0.22, the profile's faceplate at z 1.26 at
  // the cheek's height: tools/sculpt/lowhelmfit.mjs)
  male: {
    z0: 0.1,
    sec: [[-0.3, 0.82, 1.0, 0.8, 2.6], [0.4, 0.85, 1.0, 0.8, 2.6], [0.8, 0.9, 1.0, 0.82, 2.6], [1.1, 0.95, 0.98, 0.88, 2.6], [1.32, 0.97, 0.96, 0.97, 2.6], [1.56, 0.96, 0.94, 0.93, 2.5],
      [1.8, 0.94, 0.88, 0.9, 2.5], [1.92, 0.9, 0.8, 0.82, 2.5], [2.04, 0.85, 0.72, 0.74, 2.4], [2.16, 0.79, 0.64, 0.66, 2.3], [2.29, 0.65, 0.6, 0.58, 2.2], [2.42, 0.44, 0.44, 0.5, 2.1], [2.5, 0.2, 0.2, 0.24, 2.0]],
    top: [0, 2.5, -0.04], rings: [2.36, 2.2, 2.0], domeStep: 0.045,
    band: { top: [[0, 1.82], [22, 1.72], [44, 1.6], [62, 1.55], [180, 1.58]], bot: [[0, 0.83], [22, 1.0], [44, 1.14], [62, 1.2], [82, 1.22], [126, 1.17], [180, 1.17]], out: [[0, 0.32], [22, 0.24], [44, 0.2], [62, 0.12], [82, 0.09], [102, 0.09], [126, 0.12], [180, 0.12]], rim: 0.07, rimOut: 0.035, topRim: [[0, 0.07, 0.035], [62, 0.07, 0.035], [82, 0, 0]] },
    ledge: 0.03,
    back: { out: [[0, 0], [76, 0], [82, 0.1], [180, 0.1]], p1: [[0, 0.6], [82, 1.0], [126, 0.95], [180, 0.93]], step: [[0, 0], [82, 0], [102, 0.04], [126, 0.05], [180, 0.06]], p3: [[0, 0.4], [82, 0.75], [126, 0.68], [180, 0.65]], step2: [[0, 0], [82, 0], [102, 0.04], [126, 0.05], [180, 0.06]], bot: [[0, -0.16], [22, 0.0], [44, 0.14], [62, 0.24], [82, 0.36], [102, 0.4], [126, 0.4], [180, 0.4]], flare: [[0, 0], [102, 0.0], [126, 0.04], [180, 0.05]] },
    face: { yTop: 0.71, yBot: -0.16, zTop: 1.24, zBot: 1.16, ang: 40, xOutTop: 0.82, xOutBot: 0.68, eye: 0.17, botOut: 0.1, seam: 0.05, t: 0.07, vents: [[0.18, 0.27], [0.42, 0.51], [0.66, 0.75]], vt: [0.1, 0.78] },
    gap: 0.01, thick: 0.07, skirtIn: 0.12, window: 82, panels: true,
    crest: { w: 0.48, wt: 0.4, h: 0.26 }, badge: { az: 44, inset: 0.02, t: 0.05 }, star: 0.38,
    disc: { y: 1.17, r: 0.3, boss: 0.18, h: 0.05, stem: 0.08, bh: 0.05, off: 0.045 },
    cheek: { az: [[70, 1.1, 0.07], [90, 1.1, -0.05], [86, 0.4, -0.05], [70, 0.3, 0.07]], t: 0.07 },
  },
  // (hers: 47 px a unit, her faceplate's foot at -0.18, her profile's faceplate at z 1.07 at the cheek's height: her head
  // is longer from the nose back than the sheet's helm allows at his scale)
  female: {
    z0: 0.05,
    sec: [[-0.3, 0.78, 0.95, 0.86, 2.3], [0.4, 0.82, 0.98, 0.86, 2.3], [0.8, 0.88, 0.98, 0.88, 2.3], [1.1, 0.93, 0.96, 0.9, 2.3], [1.37, 0.95, 0.94, 1.0, 2.3], [1.56, 0.94, 0.94, 0.99, 2.3],
      [1.82, 0.91, 0.9, 0.9, 2.3], [1.95, 0.88, 0.8, 0.82, 2.3], [2.08, 0.83, 0.72, 0.72, 2.3], [2.2, 0.76, 0.64, 0.64, 2.3], [2.33, 0.64, 0.58, 0.58, 2.2], [2.46, 0.45, 0.45, 0.5, 2.1], [2.56, 0.2, 0.2, 0.24, 2.0]],
    top: [0, 2.58, -0.06], rings: [2.44, 2.26, 2.06], domeStep: 0.04,
    band: { top: [[0, 1.86], [22, 1.76], [44, 1.64], [62, 1.58], [180, 1.6]], bot: [[0, 0.88], [22, 1.04], [44, 1.18], [62, 1.24], [82, 1.28], [126, 1.22], [180, 1.22]], out: [[0, 0.28], [22, 0.21], [44, 0.17], [62, 0.1], [82, 0.08], [102, 0.08], [126, 0.1], [180, 0.1]], rim: 0.06, rimOut: 0.03, topRim: [[0, 0.06, 0.03], [62, 0.06, 0.03], [82, 0, 0]] },
    ledge: 0.03,
    back: { out: [[0, 0], [76, 0], [82, 0.09], [180, 0.09]], p1: [[0, 0.62], [82, 1.04], [126, 0.99], [180, 0.97]], step: [[0, 0], [82, 0], [102, 0.04], [126, 0.04], [180, 0.05]], p3: [[0, 0.42], [82, 0.79], [126, 0.72], [180, 0.69]], step2: [[0, 0], [82, 0], [102, 0.04], [126, 0.04], [180, 0.05]], bot: [[0, -0.14], [22, 0.02], [44, 0.16], [62, 0.26], [82, 0.4], [102, 0.44], [126, 0.44], [180, 0.44]], flare: [[0, 0], [102, 0.0], [126, 0.04], [180, 0.05]] },
    face: { yTop: 0.76, yBot: -0.14, zTop: 1.15, zBot: 0.97, ang: 36, xOutTop: 0.76, xOutBot: 0.62, eye: 0.17, botOut: 0.1, seam: 0.045, t: 0.06, vents: [[0.18, 0.27], [0.42, 0.51], [0.66, 0.75]], vt: [0.1, 0.78] },
    gap: 0.01, thick: 0.06, skirtIn: 0.1, window: 82, panels: true,
    crest: { w: 0.42, wt: 0.34, h: 0.23 }, badge: { az: 44, inset: 0.02, t: 0.045 }, star: 0.34,
    disc: { y: 1.3, r: 0.28, boss: 0.17, h: 0.05, stem: 0.07, bh: 0.05, off: 0.04 },
    cheek: { az: [[70, 1.16, 0.06], [90, 1.16, -0.05], [86, 0.44, -0.05], [70, 0.34, 0.06]], t: 0.06 },
  },
};
/** The shell's columns: azimuths round the axis (degrees, 0 forward, +90 the body's left), in order round. */
/** The dome's columns drawn a shade darker, between its lighter panels. */
const PANEL = new Set([22, 62, 102, 152]);
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
    const p1 = byAz(BK.p1, az), sp = byAz(BK.step, az), p3 = byAz(BK.p3, az), sp2 = byAz(BK.step2, az), yb = byAz(BK.bot, az), fl = byAz(BK.flare, az);
    const R = (y) => secR(D, az, y);
    // under the band at the front, the faceplate's planes set back by gap (the face's dark), never further out than the section
    // (the back shell below the band stands out by `out` over the visor's rear edge)
    const Rf = (y) => Math.min(R(y), rPlane(az, y, D.gap)) + byAz(BK.out, az);
    const yl = bb - D.ledge;
    const P = [
      ...D.rings.map((y, k) => [`r${k + 1}`, y, R(y)]),
      // (the dome's lower ring stands out from its cap by domeStep)
      ['ds', D.rings[D.rings.length - 1] - 0.005, R(D.rings[D.rings.length - 1]) + D.domeStep],
      ['bt', bt, R(bt)],
      // (over the brow's badge a raised gold rim along its top: topRim [height, out] by azimuth, none round the back)
      ['bto', bt, R(bt) + bo + byAz(B.topRim.map(([a, , o]) => [a, o]), az)],
      ['bt3', bt - byAz(B.topRim.map(([a, h]) => [a, h]), az), R(bt - byAz(B.topRim.map(([a, h]) => [a, h]), az)) + bo + byAz(B.topRim.map(([a, , o]) => [a, o]), az)],
      ['bt4', bt - byAz(B.topRim.map(([a, h]) => [a, h]), az), R(bt - byAz(B.topRim.map(([a, h]) => [a, h]), az)) + bo],
      ['brr', bb + B.rim, R(bb + B.rim) + bo],
      ['brg', bb + B.rim, R(bb + B.rim) + bo + B.rimOut],
      ['blo', bb, R(bb) + bo + B.rimOut],
      ['bli', yl, Rf(yl)],
      ['p1b', p1, Rf(p1)],
      ['p2t', p1, Rf(p1) + sp],
      // (a second tier below the first, as the sheet's back: p3 its top, step2 how far it stands out)
      ['p3b', p3, Rf(p3) + sp],
      ['p4t', p3, Rf(p3) + sp + sp2],
      ['bot', yb, Rf(yb) + sp + sp2 + fl],
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
  // inside the bottom rim: the rim (thick in) and a short skirt up the inside (the plate's inner face)
  const inner = AZ.map((az, j) => {
    const p = G.verts[V[j][KS - 1]], d = unit([p[0], 0, p[2] - z0]), a = add(p, mul(d, -D.thick));
    return [G.vert(a, 'shell'), G.vert(add(a, [0, D.skirtIn, 0]), 'shell')];
  });
  // the window under the band at the front, between the columns at +-WINDOW: open, the faceplate and the visor's sides
  // over it (the face is seen through the vents, the eye slit and the seam)
  const kWin = st[0].findIndex((x) => x[0] === 'bli'), kBand = st[0].findIndex((x) => x[0] === 'bt');
  const inWindow = (j, jn) => Math.abs(AZ[j]) <= D.window && Math.abs(AZ[jn]) <= D.window;
  const front = (az) => Math.abs(az) < 64;
  const matOf = (k, az) => {
    const key = st[0][k][0];
    if (key === 'bt' || key === 'bto' || key === 'bt3') return 'gold'; // the band's top ledge, the badge's top rim
    if (k < kBand && D.panels && PANEL.has(Math.abs(az))) return 'shade'; // the dome's panels
    if (key === 'brr' || key === 'brg') return 'gold'; // the rim's ledge and face
    if (key === 'blo') return Math.abs(az) <= 62 ? 'under' : 'shade'; // the band's underside: over the eye, the dark under-layer
    if (key === 'bli') return 'shade'; // the side and plate 1 under the band
    if (key === 'p1b' || key === 'p3b') return 'gold'; // the tiers' top ledges
    return 'plate';
  };
  G.tag = 'shell';
  for (let j = 0; j < N; j++) {
    const jn = (j + 1) % N, win = inWindow(j, jn);
    // the crown's cap
    G.poly([top, V[j][0], V[jn][0]], 'plate', 'shell');
    G.polys[G.polys.length - 1].piece = 'dome';
    for (let k = 0; k + 1 < KS; k++) {
      if (win && k >= kWin) continue;
      const n0 = G.polys.length, azn = Math.abs(AZ[j]) < Math.abs(AZ[jn]) ? AZ[j] : AZ[jn];
      G.poly([V[j][k], V[jn][k], V[jn][k + 1], V[j][k + 1]], matOf(k, azn), 'shell');
      // (which of the sheet's pieces it is: the dome, the band, the brow's badge, the back shell)
      const key = st[0][k][0], piece = k < kBand ? 'dome' : k < kWin ? (Math.abs(AZ[j]) <= 62 && Math.abs(AZ[jn]) <= 62 ? 'badge' : 'band') : 'back';
      for (let i = n0; i < G.polys.length; i++) G.polys[i].piece = piece;
      void key;
    }
    if (win) continue;
    // (the back shell's front edge, by the window: its thickness, turned in)
    for (const [jj, other] of [[j, jn], [jn, j]]) {
      if (Math.abs(AZ[jj]) > D.window || Math.abs(AZ[other]) <= D.window) continue;
      G.tag = 'rim';
      const ins = (i) => { if (i === V[jj][KS - 1]) return inner[jj][0]; const p = G.verts[i], d = unit([p[0], 0, p[2] - z0]); return (G.ret ??= new Map()).get(i) ?? G.ret.set(i, G.vert(add(p, mul(d, -D.thick)), 'shell')).get(i); };
      for (let k = kWin; k + 1 < KS; k++) if (V[jj][k] !== V[jj][k + 1]) G.poly([V[jj][k], V[jj][k + 1], ins(V[jj][k + 1]), ins(V[jj][k])], 'gold', 'shell');
      G.tag = 'shell';
    }
    // the bottom rim (gold), the plate's inner face above it
    G.tag = 'rim';
    G.poly([V[j][KS - 1], V[jn][KS - 1], inner[jn][0], inner[j][0]], 'gold', 'shell');
    G.poly([inner[j][0], inner[jn][0], inner[jn][1], inner[j][1]], 'shade', 'shell');
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
    const Fo = topPts.map((p, i) => { if (opts.foot?.[i]) return G.vert(opts.foot[i], tag); const s = onShell(p); return G.vert(add(s.q, mul(s.n, D.gap)), tag); });
    for (const f of faces ?? [topPts.map((_, i) => i)]) G.poly(f.map((i) => T[i]), mat, 'helm');
    const n = topPts.length;
    for (let i = 0; i < n; i++) { if (opts.open?.(i)) continue; const k = (i + 1) % n; G.poly([Fo[i], Fo[k], T[k], T[i]], typeof wallMat === 'function' ? wallMat(i) : wallMat, 'helm'); }
    // the underside (closed solid): a fan of the foot
    if (opts.closed) for (const f of faces?.length ? faces : [topPts.map((_, i) => i)]) G.poly(f.map((i) => Fo[i]).reverse(), 'shade', 'helm');
    return { T, Fo };
  };

  /* ---- the crest: along the midline from the brow's top over the crown to the band at the back ---- */
  {
    const C = D.crest, j0 = 0, j180 = AZ.indexOf(180);
    const KEY = st[0].map((x) => x[0]), at0 = (j, key) => G.verts[V[j][KEY.indexOf(key)]];
    const ringKeys = D.rings.map((_, k) => `r${k + 1}`).slice(0, -1);
    // (the front end on the beak's top ledge, back from its edge; over the dome's step at its outer edge; the back end on the band's top)
    const ctr = [lerp(at0(j0, 'bt'), at0(j0, 'bto'), 0.5), at0(j0, 'ds'), ...[...ringKeys].reverse().map((k) => at0(j0, k)), D.top, ...ringKeys.map((k) => at0(j180, k)), at0(j180, 'ds'), at0(j180, 'bto')];
    G.tag = 'crest';
    // (each row square to the midline: its normal in the midline's plane, across the line through its neighbours; the
    // two ends stood straight up from the band's top)
    const rows = ctr.map((p, i) => {
      const x = [1, 0, 0];
      let n = [0, 1, 0];
      if (i > 0 && i < ctr.length - 1) {
        const t = sub(ctr[i + 1], ctr[i - 1]);
        n = unit([0, t[2], -t[1]]);
        if (dot(n, sub(p, [0, 1, z0])) < 0) n = mul(n, -1);
      }
      const base = add(p, mul(n, D.gap));
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
    (G.faceOut ??= {})[sg] = [add(Bq, mul(n, t)), add(Cq, mul(n, t)), Bq, Cq];
    const SS = [0, ...F.vents.flat(), 1], TT = [0, ...F.vt, 1];
    const isVent = (i, k) => k === 1 && i % 2 === 1;
    const tag = `face ${sg > 0 ? 'L' : 'R'}`;
    G.tag = tag;
    const Tg = SS.map((s) => TT.map((u) => G.vert(add(P(s, u), mul(n, t)), tag)));
    const Bg = SS.map((s) => TT.map((u) => G.vert(P(s, u), tag)));
    for (let i = 0; i + 1 < SS.length; i++) for (let k = 0; k + 1 < TT.length; k++) {
      if (isVent(i, k)) {
        // the vent: open through the plate, its walls the plate's thickness
        const c = [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]];
        for (let e = 0; e < 4; e++) { const [a, b] = [c[e], c[(e + 1) % 4]]; G.poly([Tg[a[0]][a[1]], Tg[b[0]][b[1]], Bg[b[0]][b[1]], Bg[a[0]][a[1]]], 'shade', 'helm'); }
        continue;
      }
      G.poly([Tg[i][k], Tg[i + 1][k], Tg[i + 1][k + 1], Tg[i][k + 1]], 'plate', 'helm');
      G.poly([Bg[i][k + 1], Bg[i + 1][k + 1], Bg[i + 1][k], Bg[i][k]], 'shade', 'helm');
    }
    // the outer walls round the frame
    const ring = [...SS.map((_, i) => [i, 0]), ...TT.slice(1).map((_, k) => [SS.length - 1, k + 1]), ...SS.slice(0, -1).map((_, i) => [SS.length - 2 - i, TT.length - 1]), ...TT.slice(1, -1).map((_, k) => [0, TT.length - 2 - k])];
    // (the frame's edges: gold along the outer edge and the bottom, shade under the eye slit and at the seam)
    const edgeMat = (a, b) => ((a[0] === SS.length - 1 && b[0] === SS.length - 1) || (a[1] === TT.length - 1 && b[1] === TT.length - 1) ? 'gold' : 'shade');
    for (let e = 0; e < ring.length; e++) {
      const [a, b] = [ring[e], ring[(e + 1) % ring.length]];
      G.poly([Tg[a[0]][a[1]], Tg[b[0]][b[1]], Bg[b[0]][b[1]], Bg[a[0]][a[1]]], edgeMat(a, b), 'helm');
    }
  }

  /* ---- the visor's sides: from the faceplate's outer edge back to the disc, its rear edge down and forward ---- */
  for (const sg of [1, -1]) {
    const C = D.cheek, [Bt, Ct, Bb, Cb] = G.faceOut[sg];
    // (its points [middle top, rear top, rear bottom, middle bottom], each [azimuth, height, out from the dome's section]:
    // the rear edge under the back shell's front edge)
    const top = C.az.map(([az, y, o]) => at(sg * az, secR(D, sg * az, y) + o, y)), foot = C.az.map(([az, y, o]) => at(sg * az, secR(D, sg * az, y) + o - C.t, y));
    const pts = [Bt, ...top, Ct], feet = [Bb, ...foot, Cb];
    // (its front edge on the faceplate's, its foot there the faceplate's inner face, no wall; its rear edge gold; two
    // faces, front and back of the middle)
    const L = sg > 0, o = (l) => (L ? l : [...l].reverse()), m = (i) => (L ? i : 5 - i);
    plate(`cheek ${L ? 'L' : 'R'}`, o(pts), [[0, 1, 4, 5], [1, 2, 3, 4]].map((f) => f.map(m)), 'plate', (i) => ((L ? [2, 3, 4] : [2, 1, 0]).includes(i) ? 'gold' : 'shade'), { open: (i) => i === 5, foot: o(feet), closed: true });
  }

  /* ---- the side discs: on the band at 90, a boss on each ---- */
  for (const sg of [1, -1]) {
    const C = D.disc, yc = C.y;
    const dr = unit([Math.sin(sg * 89 * Math.PI / 180), 0, Math.cos(89 * Math.PI / 180)]), h = rayShell(add([0, yc, z0], mul(dr, 4)), mul(dr, -1)), n = h.n, c0 = add(h.q, mul(n, C.off + C.h));
    const u = unit(cross([0, 1, 0], n)), w = unit(cross(n, u));
    const oct = (r, h) => Array.from({ length: 8 }, (_, k) => { const a = (k + 0.5) * Math.PI / 4; return add(add(c0, mul(n, h)), add(mul(u, r * Math.cos(a)), mul(w, r * Math.sin(a)))); });
    const tag = `disc ${sg > 0 ? 'L' : 'R'}`;
    const outer = oct(C.r, 0), bossB = oct(C.boss, 0);
    // (a prism standing off the band's face, clear of its rims, over the dome above and the visor below)
    const { T } = plate(tag, outer, [], 'plate', 'shade', { foot: oct(C.r, -C.h), closed: true });
    // (the face: the ring between the rim and the boss; the boss a short round knob standing off it, its side gold, its cap
    // a low eight-sided dome, the core)
    const Bi = bossB.map((p) => G.vert(p, tag)), Bt = oct(C.boss, C.stem).map((p) => G.vert(p, tag)), cT = G.vert(add(c0, mul(n, C.stem + C.bh)), tag);
    for (let k = 0; k < 8; k++) { const k1 = (k + 1) % 8; G.poly([T[k], T[k1], Bi[k1], Bi[k]], 'plate', 'helm'); G.poly([Bi[k], Bi[k1], Bt[k1], Bt[k]], 'gold', 'helm'); G.poly([Bt[k], Bt[k1], cT], 'core', 'helm'); }
  }

  /* ---- the brow's badge: a raised pentagon plate on the band's face between its rims, its edges gold ---- */
  const BADGE = D.badge;
  {
    const cols = AZ.filter((a) => Math.abs(a) <= BADGE.az).sort((a, b) => a - b);
    const KEY = st[0].map((x) => x[0]), onFace = (az, y) => { const j = AZ.indexOf(az), p = st[j]; const r0 = p[KEY.indexOf('bt4')], r1 = p[KEY.indexOf('brr')]; const t = (y - r1[1]) / (r0[1] - r1[1]); return at(az, r1[2] + (r0[2] - r1[2]) * t, y); };
    // (each column's top and foot on the band's face, `inset` inside its rims)
    const rows = cols.map((az) => { const j = AZ.indexOf(az), p = st[j]; const yt = p[KEY.indexOf('bt4')][1] - BADGE.inset, yb = p[KEY.indexOf('brr')][1] + BADGE.inset; return [onFace(az, yt), onFace(az, yb)]; });
    const nOf = (az) => [Math.sin(az * Math.PI / 180), 0, Math.cos(az * Math.PI / 180)];
    const out = rows.map(([a, b], i) => [add(a, mul(nOf(cols[i]), D.gap + BADGE.t)), add(b, mul(nOf(cols[i]), D.gap + BADGE.t))]);
    const foot = rows.map(([a, b], i) => [add(a, mul(nOf(cols[i]), D.gap)), add(b, mul(nOf(cols[i]), D.gap))]);
    const ring = [...out.map((r) => r[0]), ...out.map((r) => r[1]).reverse()], fring = [...foot.map((r) => r[0]), ...foot.map((r) => r[1]).reverse()];
    const n = cols.length, faces = cols.slice(0, -1).map((_, i) => [i, i + 1, 2 * n - 2 - i, 2 * n - 1 - i]);
    plate('badge', ring, faces, 'plate', 'gold', { foot: fring });
    G.badgeT = D.gap + BADGE.t;
  }

  /* ---- the star on the brow: a four-pointed star laid on the badge, seen from the front ---- */
  {
    const yS = (byAz(B.bot, 0) + B.rim + byAz(B.top, 0)) / 2, R = D.star, r = R * 0.26;
    const hit = (x, y) => rayShell([x, y, 6], [0, 0, -1]);
    const pts = Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4, l = k % 2 ? r : R; return [Math.sin(a) * l * 0.78, yS + Math.cos(a) * l]; });
    G.tag = 'star';
    const T = pts.map(([x, y]) => { const h = hit(x, y); return G.vert(add(h.q, mul(h.n, G.badgeT + 2 * D.gap + 0.035)), 'star'); });
    const Fo = pts.map(([x, y]) => { const h = hit(x, y); return G.vert(add(h.q, mul(h.n, G.badgeT + 2 * D.gap)), 'star'); });
    const h0 = hit(0, yS), cT = G.vert(add(h0.q, mul(h0.n, G.badgeT + 2 * D.gap + 0.06)), 'star');
    for (let k = 0; k < 8; k++) { const k1 = (k + 1) % 8; G.poly([cT, T[k], T[k1]], 'core', 'helm'); G.poly([Fo[k], Fo[k1], T[k1], T[k]], 'gold', 'helm'); }
  }

  orient(G, (c) => [c[0], (c[1] - 1) * 0.3, c[2] - z0]);
  for (const p of G.polys) p.piece ??= p.tag === 'rim' ? 'back' : p.tag.startsWith('face') || p.tag.startsWith('cheek') ? 'visor' : p.tag.startsWith('disc') ? 'disc' : p.tag;
  G.tris = trisOf(G);
  // the head's polygons the helm covers whole: left out while it is worn (those seen through an opening kept)
  G.hides = coveredHead(rig, G);
  G.design = D;
  return G;
}

/**
 * The head's polygons the helm covers whole: each polygon whose every look out (rays from its middle and its corners,
 * a little off it, over the directions not below `down` of level) meets the helm. The rest (seen through the vents, the
 * eye slit, the seam, from under the rim) are kept.
 */
export function coveredHead(rig, G, down = -0.35) {
  const B = rig.B, T = G.tris.map((t) => t.v.map((i) => G.verts[i]));
  const dirs = [];
  for (let i = 0; i < 160; i++) { const y = 1 - 2 * (i + 0.5) / 160, r = Math.sqrt(1 - y * y), a = i * 2.39996; if (y >= down) dirs.push([r * Math.cos(a), y, r * Math.sin(a)]); }
  const hits = (o, d) => {
    for (const [a, b, c] of T) {
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, sv = sub(o, a), u = f * dot(sv, h); if (u < 0 || u > 1) continue;
      const q = cross(sv, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
      if (f * dot(e2, q) > 1e-6) return true;
    }
    return false;
  };
  const out = [];
  B.polys.forEach((p, pi) => {
    if (!p.v.every((i) => B.part[i] === 'head')) return;
    const P = p.v.map((i) => B.verts[i]), c = mul(P.reduce((s2, q) => add(s2, q), [0, 0, 0]), 1 / P.length);
    let n = [0, 0, 0];
    for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
    n = unit(n);
    if (dot(n, sub(c, [0, 1, 0])) < 0) n = mul(n, -1);
    const pts = [c, ...P.map((q) => lerp(q, c, 0.15))].map((q) => add(q, mul(n, 0.004)));
    const seen = pts.some((o) => dirs.some((d) => dot(d, n) > 0.05 && !hits(o, d)));
    if (!seen) out.push(pi);
  });
  return out;
}

/** The helm's weights: rigid on the head bone. */
export function helmWeights(rig, G) {
  const head = rig.at.get('head');
  return G.verts.map(() => [[head, 1]]);
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
    const A = { built: 'node tools/sculpt/garments/helm.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
