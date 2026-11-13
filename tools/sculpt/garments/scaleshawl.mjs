// The scale set's shawl, the wing mantle: two folded dragon wings draped over the shoulders, worn over the scale cuirass
// (garments/scalechest.mjs). Each wing's leading edge, a thick bone with a gold rim and a row of scales along it, runs
// from the chest over the shoulder's top to the upper back; at the shoulder's top it rises to the wrist, a gold joint,
// from which the folded finger ribs fan down over the front of the shoulder, the upper arm and the back, each a faceted
// bone with a gold joint half way and a spur past the hem; between them the leather membrane, flat faceted panels, its
// hem scalloped between the ribs' tips. The leading edges' front ends are the claws, two curved gold hooks meeting at
// the sternum: the clasp. Enchanted, the joints and the claws glow (the set's `core`). Teal ribs and scales, gold rim,
// red-brown leather: the set's own colours (garments/scale.mjs), so worn with the cuirass it takes no material of its
// own. Skinned to the body's clavicles, spine_03 and upper arms (garments/mantle.mjs mantleWeights), no bones of its own.
//
//   buildScaleShawl(rig, design?, { chest, unders }) → { verts, polys: [{ v, mat, part, tag }], tris, part, design, cleared }
//   scaleShawlWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/scaleshawl.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowscaleshawl-male.json and lowscaleshawl-female.json
//     (lowgarment.mjs garmentAsset with the plain and enchanted looks; loaded by src/sculpt/lowpoly.ts, worn with
//     outfit.scaleShawl, enchanted with outfit.enchanted.scaleShawl)
//
// The layout, round a vertical axis through the neck (azimuth 0 the front, 90 the body's left), on the body's line down
// from the neck in each azimuth (lowgarment.mjs drape over the body and the cuirass, grown by OUT): a point is its
// azimuth, its length s down that line and how far off it. Each wing (the left; the right its mirror) is a fan of spokes
// from the wrist K: the leading edge's front (to the claw's root), the ribs, the leading edge's back (to its end on the
// upper back); the membrane between each two spokes, rows from near the wrist out to the hem, the hem's middle short of
// the tips by `scallop`. The wrist stands off the line by `up`, falling to the hem.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { readFileSync, existsSync } from 'node:fs';
import { samplesOf, envelope, drape, atRY, meshOf, orient, trisOf, crossPairs, closestOnBody, offPlane, TOL, sub, add, mul, unit, cross, dot } from '../lowgarment.mjs';
import { MATS as SET, LOOKS as SET_LOOKS } from './scale.mjs';
import { mantleWeights } from './mantle.mjs';

/**
 * The wing mantle's materials: the scale set's own (garments/scale.mjs), only those it uses, and the membrane's own deep
 * wine red, darker than the cuirass's leather so the wings stand apart from it (its hem in the set's leather, a lighter
 * edge).
 */
const USED = ['scale', 'edge', 'leather', 'under', 'gold', 'core'];
const MEMBRANE = [0.32, 0.11, 0.12];
export const MATS = { ...Object.fromEntries(USED.map((n) => [n, SET[n]])), membrane: MEMBRANE };
/** Plain, all lit as the set's; enchanted, the joints and the claws (core) unlit at the sets' glow. */
export const LOOKS = Object.fromEntries(['plain', 'enchanted'].map((L) => [L, { ...Object.fromEntries(USED.map((n) => [n, SET_LOOKS[L][n]])), membrane: { c: MEMBRANE, kind: 2 } }]));

/**
 * The design per body:
 *   z0 the axis; yA where the body's line starts (beside the cuirass's collar); depth how far down it is taken; OUT its
 *   clearance over the body and the cuirass; STEP the columns' spacing (degrees);
 *   K the wrist: azimuth, length down the line, how far it stands off it (`up`, falling to the hem as (1 - u)^upP);
 *   claw, end: the leading edge's two ends (azimuth, height y); ribs: the ribs' tips (azimuth, height y); spur: the ribs'
 *   points past the hem (a share of the rib); u0: the membrane's inner edge round the wrist (a share of each spoke);
 *   scallop: the hem's middle between two tips short of them (a share; or one a panel, from the front); cols, rows: each panel's faces across and along,
 *   hemBand: the lighter band along the hem (a share of the way out); bare: the panels left without membrane (the
 *   front's, between the leading edge and the first rib: the chest shows the cuirass);
 *   t: the membrane's thickness; base: its least stand-off; sag: its middle between two ribs let down toward the body;
 *   rib: { w, h } a rib's half width and height at the wrist (tapering by `taper` to the tip); edge: the leading edge's;
 *   scales: along each leading edge from u `from`, each `w` long, reaching `v` of the panel across, thickness `t`;
 *   joints: the wrist's radius and spur (leaning from the way out by `rise` up and `lean` out to the side), the ribs' joints' radius at `at` along them; clasp: the claws' root's radius, its reach
 *   across the middle (x past 0), its rise and hook (y), its stand-off in front of the chest;
 *   clear: the local clearance pass (step, iterations, margin over the chests); weights: mantleWeights's settings, and
 *   frontAz (scaleShawlWeights: the front on the cuirass's own weights).
 */
export const DESIGN = {
  male: {
    z0: -0.12, yA: -0.3, depth: 3.7, OUT: 0.07, STEP: 3,
    K: { az: 96, s: 1.3, up: 0.6, upP: 1.0 },
    claw: { az: 14, y: -1.45 }, end: { az: 172, y: -0.95 },
    ribs: [{ az: 82, y: -1.85 }, { az: 112, y: -2.8 }, { az: 140, y: -3.3 }], bare: 1,
    spur: 0.14, u0: 0.1, scallop: [0, 0.3, 0.3, 0.1], cols: 3, rows: 4, hemBand: 0.06,
    t: 0.035, base: 0.03, sag: 0.06,
    rib: { w: 0.14, h: 0.15 }, edge: { w: 0.15, h: 0.17 }, taper: 0.55,
    scales: { from: 0.2, w: 0.26, v: 0.3, t: 0.03, lift: 0.035 },
    joints: { K: 0.18, spurK: 0.55, rise: 1.2, lean: 0.35, r: 0.09, at: 0.5 },
    clasp: { r: 0.11, across: 0.16, rise: 0.1, hook: 0.24, gap: 0.15, off: 0.06 },
    clear: { step: 0.012, it: 60, margin: 0.02 },
    weights: { smooth: 4, chestNear: 2, chestSurf: 'radial', chestSmooth: 2, frontAz: 45 },
  },
  female: {
    z0: -0.14, yA: -0.3, depth: 3.5, OUT: 0.06, STEP: 3,
    K: { az: 96, s: 1.2, up: 0.54, upP: 1.0 },
    claw: { az: 15, y: -1.5 }, end: { az: 172, y: -0.9 },
    ribs: [{ az: 82, y: -1.8 }, { az: 112, y: -2.65 }, { az: 140, y: -3.1 }], bare: 1,
    spur: 0.14, u0: 0.1, scallop: [0, 0.3, 0.3, 0.1], cols: 3, rows: 4, hemBand: 0.06,
    t: 0.03, base: 0.028, sag: 0.055,
    rib: { w: 0.12, h: 0.13 }, edge: { w: 0.13, h: 0.15 }, taper: 0.55,
    scales: { from: 0.2, w: 0.23, v: 0.3, t: 0.027, lift: 0.03 },
    joints: { K: 0.16, spurK: 0.48, rise: 1.2, lean: 0.35, r: 0.08, at: 0.5 },
    clasp: { r: 0.095, across: 0.14, rise: 0.09, hook: 0.21, gap: 0.13, off: 0.06 },
    clear: { step: 0.012, it: 60, margin: 0.02 },
    weights: { smooth: 4, chestNear: 2, chestSurf: 'radial', chestSmooth: 2, frontAz: 45 },
  },
};

/**
 * A chest piece the wings are worn over, at rest (src/sculpt/assets/<name>-<who>.json, or one in the directory
 * SCALE_CHEST_DIR names): { verts, tris, polys, vw (its weights), hides, plain, enchanted, mats, colours }, or null where
 * it is not there.
 */
export function chestAssetOf(name, who) {
  const dir = process.env.SCALE_CHEST_DIR ?? new URL('../../../src/sculpt/assets/', import.meta.url).pathname, file = `${dir}/${name}-${who}.json`;
  if (!existsSync(file)) return null;
  const A = JSON.parse(readFileSync(file, 'utf8')), verts = [], tris = [];
  for (let i = 0; i < A.verts.length; i += 3) verts.push(A.verts.slice(i, i + 3));
  for (let i = 0; i < A.tris.length; i += 4) tris.push({ v: A.tris.slice(i, i + 3), poly: A.tris[i + 3] });
  const polys = A.polys.map(([v, m]) => ({ v, mat: A.mats[m] })), vw = A.weights.map((w) => { const o = []; for (let k = 0; k < w.length; k += 2) o.push([w[k], w[k + 1]]); return o; });
  return { name, verts, tris, polys, vw, hides: A.hides ?? [], plain: A.plain, enchanted: A.enchanted, mats: A.mats, colours: A.colours };
}
/** The scale cuirass, the chest the wings' weights follow. */
export const scaleChestOf = (who) => chestAssetOf('lowscalechest', who);
/**
 * Every chest piece a shawl is worn over (the game draws a worn shawl over whatever chest is worn, or the tunic with none):
 * the cuirass, the plate breastplate, the hauberk, the leather jerkin and the first outfit's tunic; the wings are fitted
 * over all of them at once.
 */
export const CHESTS = ['lowscalechest', 'lowplatechest', 'lowchainchest', 'lowleatherchest', 'lowtunic'];
export const chestsOf = (who) => CHESTS.map((n) => chestAssetOf(n, who)).filter(Boolean);

const P2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, k) => [a[0] * k, a[1] * k], len: (a) => Math.hypot(a[0], a[1]) };
/** The outward normal (away from the axis, or up) of a segment a→b in (r, y). */
const outN = (a, b) => { const d = P2.sub(b, a), l = P2.len(d) || 1; const n = [-d[1] / l, d[0] / l]; return n[0] < 0 || (Math.abs(n[0]) < 1e-9 && n[1] < 0) ? [-n[0], -n[1]] : n; };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * The body's line down from the neck in every column (STEP degrees round): the drape over the body and the cuirass
 * grown by OUT from beside the collar at yA, `depth` down; and pos(deg, s, off), the point s along it and off it.
 */
export function linesOf(rig, D, unders = []) {
  const { z0, STEP } = D, NC = Math.round(360 / STEP);
  const S = [...samplesOf(rig.B), ...unders.flatMap((u) => samplesOf({ tris: u.tris }, u.verts))];
  const cols = [];
  for (let c = 0; c < NC; c++) {
    const deg = c * STEP, E = envelope(S, z0, deg, STEP, D.OUT, D.yA - D.depth, D.yA + 0.06);
    let r0 = 0;
    for (const [r, y] of E) if (Math.abs(y - D.yA) < 0.06) r0 = Math.max(r0, r);
    const L = drape(E.filter(([, y]) => y < D.yA), [r0, D.yA], D.yA - D.depth);
    const s = [0];
    for (let i = 1; i < L.length; i++) s.push(s[i - 1] + P2.len(P2.sub(L[i], L[i - 1])));
    const segN = L.slice(1).map((p, i) => outN(L[i], p));
    const N = L.map((_, i) => { const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)], m = P2.add(a, b), l = P2.len(m) || 1; return [m[0] / l, m[1] / l]; });
    cols.push({ deg, L, s, N });
  }
  const onLine = (c, sv) => {
    const { L, s, N } = c;
    if (sv <= 0) return { p: P2.add(L[0], P2.mul(lerp2([0, 0], P2.sub(L[1], L[0]), 1 / (s[1] || 1)), sv)), n: N[0] };
    for (let i = 0; i + 1 < L.length; i++) if (sv <= s[i + 1] || i + 2 === L.length) {
      const t = (sv - s[i]) / Math.max(1e-9, s[i + 1] - s[i]), n = P2.add(P2.mul(N[i], 1 - t), P2.mul(N[i + 1], t)), l = P2.len(n);
      return { p: lerp2(L[i], L[i + 1], t), n: [n[0] / l, n[1] / l] };
    }
  };
  const colPair = (deg) => { const x = (((deg % 360) + 360) % 360) / STEP, i = Math.floor(x) % NC, t = x - Math.floor(x); return [cols[i], cols[(i + 1) % NC], t]; };
  /** [r, y] and the normal there, s along the line at azimuth deg, between the two nearest columns. */
  const sec = (deg, sv) => {
    const [a, b, t] = colPair(deg), qa = onLine(a, sv), qb = onLine(b, sv), n = P2.add(P2.mul(qa.n, 1 - t), P2.mul(qb.n, t)), l = P2.len(n);
    return { p: lerp2(qa.p, qb.p, t), n: [n[0] / l, n[1] / l] };
  };
  const pos = (deg, sv, off) => { const q = sec(deg, sv); return atRY(deg, q.p[0] + q.n[0] * off, q.p[1] + q.n[1] * off, z0); };
  /** The length down the line at azimuth deg where it reaches height y (the line falls all the way). */
  const sOfY = (deg, y) => {
    let lo = 0, hi = D.depth + 1;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (sec(deg, m).p[1] > y) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  return { cols, pos, sec, sOfY };
}

/** A closed knob (a double pyramid of `n` sides round c, its axis `ax`): radius r, ends `a` along ax and `b` against it. */
function knob(G, c, ax, r, a, b, n, mat, part) {
  const u = unit(Math.abs(ax[1]) > 0.9 ? cross(ax, [1, 0, 0]) : cross(ax, [0, 1, 0])), v = cross(ax, u);
  const ring = Array.from({ length: n }, (_, j) => { const t = (j / n) * 2 * Math.PI; return G.vert(add(c, add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r))), part); });
  const top = G.vert(add(c, mul(ax, a)), part), bot = G.vert(add(c, mul(ax, -b)), part);
  for (let j = 0; j < n; j++) { const k = (j + 1) % n; G.poly([ring[j], ring[k], top], mat, part); G.poly([ring[k], ring[j], bot], mat, part); }
}

export function buildScaleShawl(rig, D = DESIGN[rig.who], { chest = scaleChestOf(rig.who), unders = chestsOf(rig.who) } = {}) {
  const { pos, sOfY } = linesOf(rig, D, unders);
  const G = meshOf();
  G.nrm = [];   // per vertex: the way out (for the clearance)
  G.grp = [];   // per vertex: its piece (moved whole by the clearance), or -1
  let grp = 0;
  const vert0 = G.vert;
  G.vert = (p, part, n = null, g = -1) => { const i = vert0(p, part); G.nrm[i] = n; G.grp[i] = g; return i; };
  for (const side of [1, -1]) {
    const sd = side > 0 ? 'l' : 'r', AZ = (a) => (side > 0 ? a : 360 - a);
    const K = [D.K.az, D.K.s];
    const tipOf = (t) => [t.az, sOfY(AZ(t.az), t.y)];
    // the spokes in (azimuth, s), each from the wrist: the leading edge's front, the ribs, the leading edge's back
    const spokes = [tipOf(D.claw), ...D.ribs.map(tipOf), tipOf(D.end)];
    const NSP = spokes.length, LE = (i) => i === 0 || i === NSP - 1;
    const sp = (i, u) => lerp2(K, spokes[i], u);
    // (the stand-off along a spoke: the wrist's rise falling to the hem, over the least)
    const lift = (u) => D.base + D.t + D.K.up * Math.pow(Math.max(0, 1 - u), D.K.upP);
    // a point of the membrane: between spokes i and i + 1, u along them, v across, its stand-off less the sag
    const at = (i, u, v, extra = 0) => {
      const q = lerp2(sp(i, u), sp(i + 1, u), v), sag = D.sag * Math.sin(Math.PI * v) * Math.min(1, u / 0.35);
      return { q, off: lift(u) - sag + extra };
    };
    const P = (q, off) => pos(AZ(q[0]), q[1], off);
    const outAt = (q, off) => unit(sub(P(q, off + 0.1), P(q, off)));
    // ---- the membrane: one sheet a wing, columns across all its panels, rows from u0 to the hem
    // (rows: `rows` of the membrane, then its hem's lighter band, `hemBand` of the way)
    const m = D.cols, n = D.rows + 1, B0 = D.bare ?? 0, NCm = (NSP - 1 - B0) * m + 1, fr = (k) => (k < n ? (k / (n - 1)) * (1 - D.hemBand) : 1);
    const colOf = (c) => { const i = B0 + Math.min(NSP - 2 - B0, Math.floor(c / m)); return [i, (c - (i - B0) * m) / m]; };
    const hemU = (i, v) => 1 - (Array.isArray(D.scallop) ? D.scallop[i] : D.scallop) * Math.sin(Math.PI * v);
    // (the outside first; the underside `t` in from it along the outside's own normal there, so it never shows through
    // where the outside folds)
    const TP = [], TO = [];
    for (let c = 0; c < NCm; c++) {
      const [i, v] = colOf(c), uh = hemU(i, v);
      TP.push([]); TO.push([]);
      for (let k = 0; k <= n; k++) {
        const u = D.u0 + (uh - D.u0) * fr(k), { q, off } = at(i, u, v);
        TP[c].push(P(q, off)); TO[c].push(outAt(q, off));
      }
    }
    const top = [], bot = [];
    for (let c = 0; c < NCm; c++) {
      top.push([]); bot.push([]);
      for (let k = 0; k <= n; k++) {
        const a = sub(TP[Math.min(NCm - 1, c + 1)][k], TP[Math.max(0, c - 1)][k]), b = sub(TP[c][Math.min(n, k + 1)], TP[c][Math.max(0, k - 1)]);
        let nm = unit(cross(a, b));
        if (dot(nm, TO[c][k]) < 0) nm = mul(nm, -1);
        top[c].push(G.vert(TP[c][k], `membrane_${sd}`, TO[c][k])); bot[c].push(G.vert(sub(TP[c][k], mul(nm, D.t)), `membrane_${sd}`, TO[c][k]));
      }
    }
    G.tag = `membrane_${sd}`;
    for (let c = 0; c + 1 < NCm; c++) for (let k = 0; k < n; k++) {
      // (a quad off its plane cut the same way outside and under, so the underside never shows through the outside)
      const mt = k === n - 1 ? 'leather' : 'membrane', T4 = [top[c][k], top[c + 1][k], top[c + 1][k + 1], top[c][k + 1]], B4 = [bot[c][k], bot[c + 1][k], bot[c + 1][k + 1], bot[c][k + 1]];
      if (offPlane(G.verts, T4) <= TOL / 3 && offPlane(G.verts, B4) <= TOL / 3) { G.poly(T4, mt, `membrane_${sd}`); G.poly([...B4].reverse(), 'under', `membrane_${sd}`); }
      else {
        const d = Math.hypot(...sub(G.verts[T4[0]], G.verts[T4[2]])) <= Math.hypot(...sub(G.verts[T4[1]], G.verts[T4[3]])) ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
        for (const t of d) { G.poly(t.map((j) => T4[j]), mt, `membrane_${sd}`); G.poly(t.map((j) => B4[j]).reverse(), 'under', `membrane_${sd}`); }
      }
    }
    // (its rim: round the wrist, along the hem, and the two leading edges' outer sides)
    const rim = (a, b, c2, d) => G.poly([a, b, c2, d], 'under', `membrane_${sd}`);
    for (let c = 0; c + 1 < NCm; c++) { rim(top[c][0], bot[c][0], bot[c + 1][0], top[c + 1][0]); rim(top[c + 1][n], bot[c + 1][n], bot[c][n], top[c][n]); }
    for (let k = 0; k < n; k++) { rim(top[0][k + 1], bot[0][k + 1], bot[0][k], top[0][k]); rim(top[NCm - 1][k], bot[NCm - 1][k], bot[NCm - 1][k + 1], top[NCm - 1][k + 1]); }
    // ---- the spokes: a faceted bone each, from the wrist to its spur past the hem, on the membrane's top
    for (let i = 0; i < NSP; i++) {
      const R = LE(i) ? D.edge : D.rib, end = LE(i) ? 1 : 1 + D.spur, NU = n + 3, g = grp++;
      const us = Array.from({ length: NU + 1 }, (_, k) => (end * k) / NU);
      const L = [], Rr = [], T = [];
      for (const u of us) {
        const q = sp(i, u), off = lift(Math.min(u, 1)) + 0.006, c0 = P(q, off), o = outAt(q, off);
        // (across: the way to the next spoke's point at the same u, square to the way out)
        const nb = i + 1 < NSP ? sp(i + 1, u) : sp(i - 1, u), along = sub(P(sp(i, Math.min(end, u + 0.05)), off), P(sp(i, Math.max(0, u - 0.05)), off));
        let ac = unit(cross(o, along));
        if (dot(ac, sub(P(nb, off), c0)) < 0) ac = mul(ac, -1);
        const k = 1 - D.taper * Math.min(1, u / end), w = R.w * k, h = R.h * k;
        L.push(G.vert(add(c0, mul(ac, -w)), `rib_${sd}`, o, g)); Rr.push(G.vert(add(c0, mul(ac, w)), `rib_${sd}`, o, g)); T.push(G.vert(add(c0, mul(o, h)), `rib_${sd}`, o, g));
      }
      const tip = G.vert(P(sp(i, end + (LE(i) ? 0.02 : 0.06)), lift(1) + 0.006 + R.h * 0.2), `rib_${sd}`, outAt(sp(i, end), lift(1)), g);
      G.tag = `rib_${sd}`;
      // the leading edge's side away from the membrane gold: its rim; the rest teal, the underside dark
      const away = i === 0 ? 'L' : 'R';
      for (let k = 0; k < NU; k++) {
        G.poly([L[k], T[k], T[k + 1], L[k + 1]], LE(i) && away === 'L' ? 'gold' : 'scale', `rib_${sd}`);
        G.poly([T[k], Rr[k], Rr[k + 1], T[k + 1]], LE(i) && away === 'R' ? 'gold' : 'scale', `rib_${sd}`);
        G.poly([Rr[k], L[k], L[k + 1], Rr[k + 1]], 'edge', `rib_${sd}`);
      }
      G.poly([L[0], Rr[0], T[0]], 'edge', `rib_${sd}`);
      G.poly([L[NU], T[NU], tip], LE(i) && away === 'L' ? 'gold' : 'scale', `rib_${sd}`); G.poly([T[NU], Rr[NU], tip], LE(i) && away === 'R' ? 'gold' : 'scale', `rib_${sd}`); G.poly([Rr[NU], L[NU], tip], 'edge', `rib_${sd}`);
      // its joint half way
      {
        const ua = D.joints.at, q = sp(i, ua), off = lift(ua) + 0.006 + R.h * (1 - D.taper * ua / end) * 0.4;
        const along = unit(sub(P(sp(i, ua + 0.05), off), P(sp(i, ua - 0.05), off)));
        knob(G, P(q, off), along, D.joints.r * (LE(i) ? 1.15 : 1), D.joints.r * 1.3, D.joints.r * 1.3, 6, 'core', `joint_${sd}${i}`);
      }
    }
    // ---- the wrist: a gold joint over the spokes' root, its spur up and out
    {
      const q = K, off = lift(0) + D.edge.h * 0.5, o = outAt(q, off), c = P(q, off);
      // (its spur: up, leaning out toward the shoulder's side by `lean`)
      const ax = unit(add(add(o, [0, D.joints.rise, 0]), mul(unit([c[0], 0, 0]), D.joints.lean)));
      knob(G, c, ax, D.joints.K, D.joints.spurK + D.edge.h * 0.5, D.joints.K * 0.8, 6, 'core', `wrist_${sd}`);
    }
    // ---- the scales along each leading edge: on the membrane beside the bone, pointing across it
    for (const i of [0, NSP - 1]) {
      const Sd = D.scales, ip = i === 0 ? 0 : NSP - 2, vAt = (v) => (i === 0 ? v : 1 - v);
      // (the spoke's length, to lay scales `w` long)
      let len = 0;
      for (let k = 0; k < 20; k++) len += Math.hypot(...sub(P(sp(i, Sd.from + ((1 - Sd.from) * (k + 1)) / 20), lift(1)), P(sp(i, Sd.from + ((1 - Sd.from) * k) / 20), lift(1))));
      const ns = Math.max(2, Math.round(len / Sd.w));
      for (let j = 0; j < ns; j++) {
        const u0 = Sd.from + ((1 - Sd.from) * j) / ns, u1 = Sd.from + ((1 - Sd.from) * (j + 1)) / ns, um = (u0 + u1) / 2, g = grp++;
        const M = (u, v, e) => { const a = at(ip, u, vAt(v)); return { p: P(a.q, a.off + e), o: outAt(a.q, a.off) }; };
        const sv = Sd.v, mk = (u, v, e) => { const x = M(u, v, e); return G.vert(x.p, `scales_${sd}`, x.o, g); };
        const vEdge = (D.edge.w * 0.6) / Math.max(0.05, len / ns * 3);   // (just under the bone's side)
        const TL = mk(u0, vEdge, Sd.lift * 0.4), TR = mk(u1, vEdge, Sd.lift * 0.4), Lm = mk(u0 + (u1 - u0) * 0.05, sv * 0.55, Sd.lift), Rm = mk(u1 - (u1 - u0) * 0.05, sv * 0.55, Sd.lift);
        const tipv = mk(um, sv, Sd.lift * 0.9), Mr = mk(um, sv * 0.45, Sd.lift + Sd.t * 0.8);
        const Lb = mk(u0 + (u1 - u0) * 0.05, sv * 0.55, Sd.lift - Sd.t), Rb = mk(u1 - (u1 - u0) * 0.05, sv * 0.55, Sd.lift - Sd.t), tb = mk(um, sv, Sd.lift * 0.9 - Sd.t);
        G.tag = `scales_${sd}`;
        const pt = `scales_${sd}`;
        G.poly([TL, TR, Mr], 'scale', pt); G.poly([TR, Rm, Mr], 'scale', pt); G.poly([Rm, tipv, Mr], 'scale', pt); G.poly([tipv, Lm, Mr], 'scale', pt); G.poly([Lm, TL, Mr], 'scale', pt);
        G.poly([Lm, tipv, tb, Lb], 'edge', pt); G.poly([tipv, Rm, Rb, tb], 'edge', pt); G.poly([TL, Lm, Lb], 'edge', pt); G.poly([Rm, TR, Rb], 'edge', pt);
        G.poly([TR, TL, Lb, tb, Rb], 'edge', pt);
      }
    }
    // ---- the claw: from the leading edge's front end, a curved hook across the sternum (the left's over and down, the
    // right's under and up, so the two hook into each other)
    {
      const C = D.clasp, root = spokes[0], q0 = root, off0 = lift(1) + D.edge.h * 0.4, base = P(q0, off0), g = grp++;
      const yb = base[1] + (side > 0 ? 0 : -C.gap);
      // (the chest's front under the claw: the line's points near the middle, and the claw's points off them)
      const r = Math.hypot(base[0], base[2] - D.z0);
      const front = (x, y) => { const az = Math.asin(Math.max(-1, Math.min(1, x / r))) * 180 / Math.PI; return pos(az, sOfY(az, y), off0 + C.off); };
      const NS = 7, pts = [];
      for (let k = 0; k <= NS; k++) {
        const t = k / NS, x = base[0] * (1 - t) + (-side * C.across) * t;
        const y = side > 0 ? yb + C.rise * Math.sin(Math.PI * t) - C.hook * t * t : yb - C.rise * Math.sin(Math.PI * t) + C.hook * t * t;
        const f = front(x, y);
        // (the left's in front of the right's where they cross: the two hooks lap, not through each other)
        const lap = side > 0 ? 2.6 * C.r * Math.min(1, Math.max(0, (t - 0.2) / 0.3)) : 0;
        pts.push([x, y, Math.max(f[2], base[2] * (1 - t) + f[2] * t) + lap]);
      }
      pts[0] = base;
      const rings = pts.map((p, k) => {
        const d = unit(sub(pts[Math.min(NS, k + 1)], pts[Math.max(0, k - 1)])), u = unit(cross(d, [0, 0, 1])), v = cross(u, d), r = C.r * (1 - k / NS * 0.85);
        return [u, v, mul(u, -1), mul(v, -1)].map((e) => G.vert(add(p, mul(e, r)), `claw_${sd}`, [0, 0, 1], g));
      });
      const tipD = unit(sub(pts[NS], pts[NS - 1])), tip = G.vert(add(pts[NS], mul(tipD, C.r * 0.8)), `claw_${sd}`, [0, 0, 1], g);
      G.tag = `claw_${sd}`;
      for (let k = 0; k < NS; k++) for (let j = 0; j < 4; j++) G.poly([rings[k][j], rings[k][(j + 1) % 4], rings[k + 1][(j + 1) % 4], rings[k + 1][j]], 'core', `claw_${sd}`);
      for (let j = 0; j < 4; j++) G.poly([rings[NS][j], rings[NS][(j + 1) % 4], tip], 'core', `claw_${sd}`);
      G.poly([rings[0][3], rings[0][2], rings[0][1], rings[0][0]], 'core', `claw_${sd}`);
    }
  }
  orient(G, (p) => [p[0], 0, p[2] - D.z0]);
  G.cleared = clearLocally(G, unders, D);
  G.tris = trisOf(G);
  G.design = D;
  G.chest = chest;
  return G;
}

/**
 * Where a chest piece worn under (grown by `margin`) passes through the wings, the wings' vertices there pushed out a step
 * at a time along their way out (a piece, a bone, a scale, a joint or a claw, moved whole), until nothing crosses.
 */
function clearLocally(G, unders, D) {
  const C = D.clear, moved = new Float32Array(G.verts.length);
  if (!unders.length) return null;
  const grow = (p) => { const r = Math.hypot(p[0], p[2] - D.z0) || 1; return [p[0] + (p[0] / r) * C.margin, p[1] + C.margin * 0.3, p[2] + ((p[2] - D.z0) / r) * C.margin]; };
  const meshes = unders.flatMap((u) => [[u.verts.map(grow), u.tris], [u.verts, u.tris]]);
  const byGrp = new Map();
  G.grp.forEach((g, i) => { if (g >= 0) (byGrp.get(g) ?? byGrp.set(g, []).get(g)).push(i); });
  const wayOf = (i) => G.nrm[i] ?? unit([G.verts[i][0], 0, G.verts[i][2] - D.z0]);
  let it = 0, left = 0;
  for (; it < C.it; it++) {
    const T = trisOf(G), cp = meshes.flatMap(([V, TT]) => crossPairs(G.verts, T, V, TT));
    left = cp.length;
    if (!cp.length) break;
    const bad = new Set(), groups = new Set();
    for (const [a] of cp) for (const v of T[a].v) { if (G.grp[v] >= 0) groups.add(G.grp[v]); else bad.add(v); }
    // (a membrane vertex pushed carries the bones and scales over it along with it: they are moved whole)
    for (const v of bad) { G.verts[v] = add(G.verts[v], mul(wayOf(v), C.step)); moved[v] += C.step; }
    for (const g of groups) { const ids = byGrp.get(g), d = unit(ids.reduce((s, i) => add(s, wayOf(i)), [0, 0, 0])); for (const i of ids) { G.verts[i] = add(G.verts[i], mul(d, C.step)); moved[i] += C.step; } }
  }
  let most = 0;
  moved.forEach((m) => { most = Math.max(most, m); });
  return { iterations: it, left, most: +most.toFixed(3), count: [...moved].filter((m) => m > 0).length };
}

/**
 * The wings' weights: the plate mantle's (garments/mantle.mjs mantleWeights: the body's at the closest point taken onto
 * spine_03, the clavicles and the upper arms, smoothed, the arms' share capped and falling off toward the front and the
 * back, blended near the cuirass into the cuirass's own; at the front the cuirass's own), each joint, claw and scale
 * rigid on its mean.
 */
export function scaleShawlWeights(rig, G) {
  const D = G.design;
  const parts = [...new Set(G.part)].filter((p) => /^(joint|wrist|claw)_/.test(p));
  const g = { ...G, design: { z0: D.z0, ...D.weights }, clasps: parts.map((part) => ({ part })) };
  const vw = mantleWeights(rig, g, { chest: G.chest, armMax: D.weights.armMax ?? 0.45 });
  // (frontAz: within this many degrees of the front, the leading edge, its scales and the claws lie on the chest: they
  // take the cuirass's own weights at its closest point, fading back to the mantle's over the next `frontFade`)
  const FA = D.weights.frontAz, FF = D.weights.frontFade ?? 15;
  if (FA != null && G.chest) G.verts.forEach((p, i) => {
    const az = Math.abs(Math.atan2(p[0], p[2] - D.z0)) * 180 / Math.PI, t = Math.min(1, Math.max(0, (FA + FF - az) / FF));
    if (t <= 0) return;
    const h = closestOnBody(G.chest.verts, G.chest.tris, p), m = {};
    G.chest.tris[h.tri].v.forEach((j, k) => { for (const [b, x] of G.chest.vw[j]) m[b] = (m[b] ?? 0) + t * h.w[k] * x; });
    for (const [b, x] of vw[i]) m[b] = (m[b] ?? 0) + (1 - t) * x;
    const l = Object.entries(m).map(([b, x]) => [+b, x]).filter(([, x]) => x > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4), tt = l.reduce((a, [, x]) => a + x, 0);
    vw[i] = l.map(([b, x]) => [b, x / tt]);
  });
  // (each scale, joint and claw kept whole: rigid on its mean)
  const byGrp = new Map();
  G.grp.forEach((k, i) => { if (k >= 0 && /^scales_/.test(G.part[i])) (byGrp.get(k) ?? byGrp.set(k, []).get(k)).push(i); });
  G.part.forEach((p, i) => { if (/^(joint|wrist|claw)_/.test(p)) (byGrp.get(p) ?? byGrp.set(p, []).get(p)).push(i); });
  for (const ids of byGrp.values()) {
    const m = {};
    for (const i of ids) for (const [b, x] of vw[i]) m[b] = (m[b] ?? 0) + x / ids.length;
    const l = Object.entries(m).map(([b, x]) => [+b, x]).sort((a, b) => b[1] - a[1]).slice(0, 4), t = l.reduce((a, [, x]) => a + x, 0);
    for (const i of ids) vw[i] = l.map(([b, x]) => [b, x / t]);
  }
  return vw;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildScaleShawl(rig);
    G.vw = scaleShawlWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowscaleshawl-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/scaleshawl.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, cleared ${JSON.stringify(G.cleared)}: wrote`, file.pathname);
  }
}
