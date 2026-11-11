// The shawl of the first outfit (tools/sculpt/ref/outfit1-shawl.png, worn in tools/sculpt/ref/outfit1-lineup.png): a
// layered cowl round the neck over a short poncho cape, its hem a deep V in front and a shallower one behind, a tan
// border with a row of tan teeth along the hem, and the sheet's emblem (a ring and three stripes, raised) on the chest.
// (The sheet's shirt's split collar is the tunic's.)
// Fitted to each low-poly body from the one design (DESIGN, per body), skinned to its rig.
//
//   buildShawl(rig) → { verts, polys: [{ v, mat, part, tag }], tris, part, cols, rings, apex, design }
//   shawlWeights(rig, G) → per vertex [[bone, weight], ...] (bone indices: the body's, then the cape's own, G.bones)
//   shawlBones(rig, design, cols) → the cape's bones (lowgarment.mjs garmentBone), six: cape_l, cape_front_l,
//   cape_back_l and the right's, driven from the upper arms (59 + 6 = 65 bones, within the renderer's 80)
//
//   node tools/sculpt/garments/shawl.mjs (or garments/outfit1.mjs, which writes the tunic's too)
//     writes the game's copy beside each body, fitted over the tunic (`under`): src/sculpt/assets/lowshawl-male.json and
//     lowshawl-female.json (lowgarment.mjs garmentAsset; loaded by src/sculpt/lowpoly.ts)
//
// The shape, in columns: N columns round a vertical axis through the neck (azimuth 0 the front, 90 the body's left),
// each a closed section in its half-plane (radius r from the axis, height y), the rows of every section joined round:
//   the cape outside, down from under the cowl: T0 (under the cowl's swag), T1 (where the cloth turns over the shoulder
//   or the chest: the drape's corner), T2 T3 (the border's line), T4 (the teeth's points, between columns), T5 (the hem);
//   the hem's edge (bevelled, so it shows from the front) to the underside I5, up the underside I1 (under T1) and IT
//   (under T0);
//   the cowl from IT: up its inside to the rim d, over the upper roll (u1 its top, u2 its outside), into the crease b,
//   over the lower roll (l1 its top, l2 its outside) and back under it to T0.
// One closed surface. The cape's outside is the cloth's drape (lowgarment.mjs drape) over the body grown by the
// clearance OUT; the underside is the outside moved in by THICK, so the body is at least OUT - THICK under it. The
// cowl is two rolls (ellipses in the section) lying on the body's own line down from the neck's foot (the ring
// nm0..nm5): down the chest in front, out over the shoulder at the side, down the back behind (DESIGN.roll), each
// point then pushed out until it clears the body. 20 columns, 14 rings: 600 triangles; the emblem (emblemOn) on them.
// Materials: fabric, trim, pattern (the cream between the teeth), inner (the underside and the cowl's inside), rune (the
// teeth, the line over them and the emblem: the trim's colour plain, glowing enchanted).
import { offPlane, TOL, samplesOf, envelope, drape, reachAt, atRY, dirOf, meshOf, orient, trisOf, transferWeights, garmentBone, skinGarment, garmentFrames, sub, add, mul, dot, cross, unit, lerp, applyRefit } from '../lowgarment.mjs';
import { posed, armsOut, axisAngle, mm, tr } from '../lowrig.mjs';

export const MATS = {
  fabric: [0.72, 0.62, 0.56],
  trim: [0.603, 0.421, 0.294],
  pattern: [0.72, 0.62, 0.56],
  inner: [0.51, 0.356, 0.268],
  rune: [0.603, 0.421, 0.294],
};

/** The glow of an enchanted piece: the leather set's (garments/leatherchest.mjs MATS.glow), so the game gives both one slot. */
export const GLOW = [0.996, 0.792, 0.427];
/**
 * A piece of the first outfit plain and enchanted (lowgarment.mjs garmentAsset `looks`): plain, every material its colour,
 * lit; enchanted, the materials named rune... (the trim lines and patterns: rune the trim's tan, runeStrap the boots'
 * cream straps) unlit at GLOW, the rest as plain.
 */
export const clothLooks = (mats) => ({
  plain: Object.fromEntries(Object.entries(mats).map(([n, c]) => [n, { c, kind: 0 }])),
  enchanted: Object.fromEntries(Object.entries(mats).map(([n, c]) => [n, /^rune/.test(n) ? { c: GLOW, kind: 1 } : { c, kind: 0 }])),
});
/** Plain and enchanted: the teeth, the line over them and the emblem glowing enchanted. */
export const LOOKS = clothLooks(MATS);

/**
 * The design per body: values [front, side, back] blend round the azimuth; heights are the body's y, lengths its units.
 *   z0: the axis; front, back: columns to a quarter round, in front and behind; OUT, IN: the clearance of the cape's outside and of the cowl's inside; THICK: the
 *   cloth's thickness; bevel: how much lower the underside's hem is than the outside's;
 *   hem: the V's point in front, the corners (at the sides), the V's point behind, and how the hem runs between (sin^p);
 *   flare: how far out the hanging cloth leans per unit of drop; soften: how far the shoulder's corner moves toward the
 *   straight line from the cowl to the hem;
 *   lift: the cape's bones (shawlBones), each turned by its upper arm's raise θ as g(θ) = a θ + (b - a) max(0, θ - knee),
 *   at most max (degrees: a share while the arm swings in a walk, catching up as it rises): `side` the one over each
 *   shoulder (hinged at the cape's top at the side, turned by the arm's raise out to the side, and `also` a share of its
 *   swing forward and back, either way, at most its max), `front` and `back` the ones over each side of the chest and
 *   of the back (hinged at the cape's top at azimuth frontAt and backAt, turned by the arm's raise forward and back);
 *   the cape's share on them: the side's (|sin| of the azimuth from `from` up to 1, to the power 1.5), the front's and
 *   the back's (cos of the turn from frontAt, backAt, scaled so it is 0 at `reach` from it), all of it at the
 *   shoulder's corner and below, at the cape's top `top` of the side's and all the front's and back's; `roll`: the
 *   share of it the cowl's lower roll takes (each ring);
 *   border: the strip under the teeth, the teeth, the line over them (from the hem up, along the cloth);
 *   roll: the cowl's two rolls: lean (their line's normal leaned out from the axis), flat (each roll's height off the
 *   line over its radius along it), at (the upper roll's centre, its length down the body's line from the neck's foot),
 *   drop (the lower roll further down, linear in the front view's x: a V), ru, rl (the rolls' radii), gap (the lower
 *   roll's centre this many of the two radii further), crease (how far out from the line between the centres the
 *   crease lies, of their mean radius);
 *   turns: where each ring lies round its roll, degrees in the section (0 out from the axis, 90 up); dip: how far the
 *   crease stays inside the rolls;
 */
export const DESIGN = {
  male: {
    z0: -0.12, front: 5, back: 5, OUT: 0.16, IN: 0.05, THICK: 0.11, bevel: 0.09, flare: [0.4, 0.3, 0.4], soften: 1,
    lift: { side: { a: 0.4, knee: 20, b: 1.3, max: 100, also: { axis: 'x', a: 0.3, max: 12 } }, front: { a: 0.3, knee: 40, b: 2.3, max: 100 }, back: { a: 0.4, knee: 30, b: 1.0, max: 60 }, frontAt: 60, backAt: 140, reach: [40, 40], from: 0.2, top: 0.2, roll: { l2: 0.6, l1: 0.3 } },
    hem: { front: -3.9, corner: -2.2, back: -3.6, p: 1.2 },
    border: [0.08, 0.3, 0.06],
    dip: 0.12,
    roll: { lean: [0.3, 0.2, 0.3], flat: [0.75, 0.95, 1.1], at: [0.6, 0.45, -0.15], drop: [0.1, 0, 0.3], ru: [0.4, 0.27, 0.5], rl: [0.4, 0.2, 0.4], gap: 1.05, crease: 0.45 },
    turns: { d: 165, u1: 95, u2: 15, l1: 50, l2: -25, T0: -115 },
    emblem: { side: 1, az: 23, y: -1.92, r: 0.32, w: 0.155, seg: 14, h: 0.04, lift: 0.015, step: 0.18, stripes: { w: 0.105, gap: 0.25, lean: 10 }, up: { w: 0.105, from: 55, to: 80, len: 1.2, clear: 0.08 } },
  },
  female: {
    z0: -0.14, front: 5, back: 5, OUT: 0.14, IN: 0.045, THICK: 0.095, bevel: 0.08, flare: [0.4, 0.15, 0.4], soften: 0.85,
    lift: { side: { a: 0.45, knee: 20, b: 1.3, max: 100, also: { axis: 'x', a: 0.3, max: 12 } }, front: { a: 0.3, knee: 40, b: 2.3, max: 100 }, back: { a: 0.4, knee: 30, b: 1.0, max: 60 }, frontAt: 60, backAt: 140, reach: [40, 40], from: 0.2, top: 0.2, roll: { l2: 0.6, l1: 0.3 } },
    hem: { front: -3.25, corner: -2.05, back: -3.0, p: 1.2 },
    border: [0.07, 0.26, 0.05],
    dip: 0.1,
    roll: { lean: [0.3, 0.2, 0.3], flat: [0.75, 1.0, 1.1], at: [0.5, 0.25, -0.12], drop: [0.08, 0, 0.25], ru: [0.36, 0.23, 0.42], rl: [0.34, 0.17, 0.34], gap: 1.05, crease: 0.45 },
    turns: { d: 165, u1: 95, u2: 15, l1: 50, l2: -25, T0: -115 },
    emblem: { side: 1, az: 24, y: -1.74, r: 0.25, w: 0.125, seg: 14, h: 0.035, lift: 0.015, step: 0.15, stripes: { w: 0.085, gap: 0.2, lean: 10 }, up: { w: 0.085, from: 55, to: 80, len: 1.0, clear: 0.08 } },
  },
};

/** The cowl's rings from the cape's top up to the rim: the lower roll (l2 its underside's turn, l1 its top), the crease b,
 * the upper roll (u2 its outside, u1 its top); T0 the cape's top tucked under the lower roll. */
export const COWL = ['l2', 'l1', 'b', 'u2', 'u1'];
/** A value round the azimuth from its [front, side, back]: by the cosine, or (v) linearly in the front view's x, a V. */
const blend = ([f, s, b], deg, v = false) => { const c = Math.cos(deg * Math.PI / 180), x = Math.abs(Math.sin(deg * Math.PI / 180)), wf = c > 0 ? (v ? 1 - x : c) : 0, wb = c < 0 ? (v ? 1 - x : -c) : 0; return f * wf + b * wb + s * (1 - wf - wb); };

/** The neck's foot (the body's ring nm0..nm5, both sides) where the half-plane of azimuth deg crosses it: [r, y]. */
function neckFoot(B, z0, deg) {
  const half = ['nm0', 'nm1', 'nm2', 'nm3', 'nm4', 'nm5'];
  const ring = [...half.map((n, k) => (k === 0 || k === 5 ? n : `${n}.L`)), ...half.slice(1, 5).reverse().map((n) => `${n}.R`)].map((n) => B.verts[B.index.get(n)]);
  const d = dirOf(deg);
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    // the ray from the axis along d against the edge a-b, in xz
    const ax = a[0], az = a[2] - z0, bx = b[0], bz = b[2] - z0;
    const ex = bx - ax, ez = bz - az, den = d[0] * ez - d[2] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ez - az * ex) / den, s = (ax * d[2] - az * d[0]) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) return [t, a[1] + (b[1] - a[1]) * s];
  }
  throw new Error('no neck foot at ' + deg);
}

/** The point at arc length s along a polyline of [r, y]. */
function along(L, s) {
  for (let i = 0; i + 1 < L.length; i++) { const l = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); if (s <= l || i + 2 === L.length) { const t = l ? Math.min(1, s / l) : 0; return [L[i][0] + (L[i + 1][0] - L[i][0]) * t, L[i][1] + (L[i + 1][1] - L[i][1]) * t]; } s -= l; }
  return L[L.length - 1];
}
const P2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, k) => [a[0] * k, a[1] * k], len: (a) => Math.hypot(a[0], a[1]) };
/** The outward normal (away from the axis and up) of a segment a→b running downward in (r, y). */
const outN = (a, b) => { const d = P2.sub(b, a), l = P2.len(d) || 1; const n = [-d[1] / l, d[0] / l]; return n[0] < 0 || (n[0] === 0 && n[1] < 0) ? [-n[0], -n[1]] : n; };
/** Push a polyline's segments out (along their normals) until every point of E is at least 0 outside them. */
function clearOf(L, E, fixedFirst = false) {
  for (let it = 0; it < 8; it++) {
    let moved = false;
    for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1], n = outN(a, b), d = P2.sub(b, a), l2 = d[0] * d[0] + d[1] * d[1];
      let worst = 0;
      for (const p of E) {
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l2;
        if (t < 0 || t > 1) continue;
        const h = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
        if (h > worst) worst = h;
      }
      if (worst > 1e-4) {
        moved = true;
        const k = worst + 0.002;
        if (!(fixedFirst && i === 0)) L[i] = P2.add(a, P2.mul(n, k));
        L[i + 1] = P2.add(b, P2.mul(n, fixedFirst && i === 0 ? 2 * k : k));
      }
    }
    if (!moved) break;
  }
  return L;
}

export function buildShawl(rig, design = DESIGN[rig.who], { under = [] } = {}) {
  const { B } = rig, D = design, z0 = D.z0;
  // the columns: `front` to a quarter round the front half (the V's point at 0, the corners at 90), `back` behind
  const angles = [];
  for (let k = 0; k < D.front; k++) angles.push((k * 90) / D.front);
  for (let k = 0; k < 2 * D.back; k++) angles.push(90 + (k * 90) / D.back);
  for (let k = D.front; k > 0; k--) angles.push(360 - (k * 90) / D.front);
  const N = angles.length;
  // (the body's surface, and any garment worn under it at rest, `under` ({ verts, tris }): the shawl clears them all)
  const S = [...samplesOf(B), ...under.flatMap((m) => samplesOf(m))];
  const hemY = (deg) => { const a = Math.abs(((deg + 540) % 360) - 180), s = Math.pow(Math.sin(a * Math.PI / 180), D.hem.p); return a <= 90 ? D.hem.front + (D.hem.corner - D.hem.front) * s : D.hem.back + (D.hem.corner - D.hem.back) * s; };
  const cols = [];
  const cowls = [];
  for (let k = 0; k < N; k++) {
    const deg = angles[k], half = Math.max(((angles[(k + 1) % N] - deg + 360) % 360), ((deg - angles[(k + N - 1) % N] + 360) % 360));
    const F = neckFoot(B, z0, deg);
    const yH = hemY(deg);
    // the cowl's section: two rolls lying on the body's own line down from the neck's foot F (the bare drape: down the
    // chest in front, out over the shoulder at the side, down the back behind; a negative length is up the neck), the
    // upper roll's centre `at` along it, the lower roll's `gap` of the two radii further, each its radius plus OUT off the
    // line (along the line's normal leaned out from the axis by `lean`); the rings at fixed turns round them (D.turns,
    // degrees in the section: 0 out from the axis, 90 up), the crease where the rolls meet, `crease` plus OUT off the
    // line; every point then pushed out from the axis until it clears the body (the rim by IN, the rest by OUT)
    const EI = envelope(S, z0, deg, half, D.IN, -6, 3), EO = envelope(S, z0, deg, half, D.OUT, -6, 3);
    const L0 = drape(envelope(S, z0, deg, half, 0, F[1] - 3, F[1] + 0.01), F, F[1] - 2.5);
    const R = D.roll, at = blend(R.at, deg), ru = blend(R.ru, deg), rl = blend(R.rl, deg), lean = blend(R.lean, deg);
    // (a point `off` plus OUT off the line at length al, and the line's direction there)
    const on = (al, off) => {
      if (al < 0) return { p: [F[0] + D.OUT + off, F[1] - al], t: [0, -1] };
      let s0 = al;
      for (let i = 0; i + 1 < L0.length; i++) {
        const l = Math.hypot(L0[i + 1][0] - L0[i][0], L0[i + 1][1] - L0[i][1]);
        if (s0 <= l || i + 2 === L0.length) { const n0 = outN(L0[i], L0[i + 1]); return { p: P2.add(along([L0[i], L0[i + 1]], s0), P2.mul(unit2([n0[0] + lean, n0[1]]), D.OUT + off)), t: unit2(P2.sub(L0[i + 1], L0[i])) }; }
        s0 -= l;
      }
    };
    // (each roll an ellipse: its radius along the line, `flat` of it off the line)
    const fl = blend(R.flat, deg), cu = on(at, ru * fl), cl = on(at + R.gap * (ru + rl) + blend(R.drop, deg, true), rl * fl);
    // (turns in the section: 0 out from the axis, 90 up; the ellipse `flat` of its radius tall)
    const turn = (c, rho, th) => { const a = th * Math.PI / 180; return P2.add(c.p, [rho * Math.cos(a), rho * fl * Math.sin(a)]); };
    const clear = (p, E) => { const r = reachAt(E, p[1], 0.04); return [Math.max(p[0], r), p[1]]; };
    const Tn = D.turns;
    // (the crease: on the line between the rolls' centres where they meet, `crease` of their mean radius out from it)
    const cc = P2.sub(cl.p, cu.p), cn = outN(cu.p, cl.p), crease = P2.add(P2.add(cu.p, P2.mul(cc, ru / (ru + rl))), P2.mul(cn, R.crease * fl * (ru + rl) / 2));
    const d = clear(turn(cu, ru, Tn.d), EI);
    const q = { u1: clear(turn(cu, ru, Tn.u1), EO), u2: clear(turn(cu, ru, Tn.u2), EO), b: clear(crease, EO), l1: clear(turn(cl, rl, Tn.l1), EO), l2: clear(turn(cl, rl, Tn.l2), EO) };
    const T0 = clear(turn(cl, rl, Tn.T0), EO);
    cowls.push({ deg, half, F, yH, EO, EI, d, T0, ...q });
  }
  // the cowl's points smoothed round the neck (the neck's foot turns sharply behind the shoulders), then cleared again
  for (const key of ['d', ...COWL, 'T0']) {
    const v = cowls.map((q) => q[key]);
    cowls.forEach((q, k) => { const p = v[(k + N - 1) % N], n = v[(k + 1) % N], m = v[k]; q[key] = [0.25 * p[0] + 0.5 * m[0] + 0.25 * n[0], 0.25 * p[1] + 0.5 * m[1] + 0.25 * n[1]]; });
  }
  for (let k = 0; k < N; k++) {
    const { deg, half, F, yH, EO, EI } = cowls[k];
    const clr = (p, E = EO) => { const r = reachAt(E, p[1], 0.04); return [Math.max(p[0], r), p[1]]; };
    let T0 = clr(cowls[k].T0);
    const q = Object.fromEntries(COWL.map((key) => [key, clr(cowls[k][key])]));
    const d = clr(cowls[k].d, EI);
    // the crease stays inside the rolls over and under it (no ridge standing out between them): where the body pushes it
    // out, the rolls go out with it
    const dip = D.dip ?? 0.08;
    // (and off the cowl's inside, the wall from the rim down under the cape's top, by THICK)
    { const n = outN(d, T0), h = (q.b[0] - d[0]) * n[0] + (q.b[1] - d[1]) * n[1], m = D.THICK + 0.04; if (h < m) q.b = P2.add(q.b, P2.mul(n, m - h)); }
    if (q.b[0] > Math.min(q.l1[0], q.u2[0]) - dip) { q.l1 = [Math.max(q.l1[0], q.b[0] + dip), q.l1[1]]; q.u2 = [Math.max(q.u2[0], q.b[0] + dip), q.u2[1]]; }
    // the cape: the drape over the body grown by OUT, from under the swag down to the hem
    const E = envelope(S, z0, deg, half, D.OUT, yH - 0.05, T0[1] + 0.6);
    const L = drape(E, T0, yH);
    // T1: the drape's corner, the point furthest out from the chord T0 to the hem
    const Hm = L[L.length - 1];
    let T1 = L[Math.floor(L.length / 2)], best = -1;
    for (const p of L) { const h = (p[0] - T0[0]) * (Hm[1] - T0[1]) - (p[1] - T0[1]) * (Hm[0] - T0[0]); const dd = Math.abs(h); if (dd > best && p[1] > yH + 0.45 && p[1] < T0[1] - 0.12) { best = dd; T1 = p; } }
    if (best < 0.02) T1 = [T0[0] + (Hm[0] - T0[0]) * 0.3, T0[1] + (Hm[1] - T0[1]) * 0.3];
    let T5 = [Hm[0], yH];
    // the hanging part leans out by the flare
    T5 = [T5[0] + blend(D.flare, deg) * (T1[1] - yH), yH];
    // the corner softened toward the straight line from T0 to the hem (a poncho's sloped shoulder), then pushed back out
    // as far as the body needs
    const mid = P2.add(T0, P2.mul(P2.sub(T5, T0), ((T0[1] - T1[1]) / Math.max(1e-6, T0[1] - T5[1]))));
    T1 = P2.add(T1, P2.mul(P2.sub(mid, T1), D.soften ?? 0));
    const prof = clearOf([T0, T1, T5], E.filter(([, y]) => y <= T0[1]), true);
    [T0, T1, T5] = prof;
    // the border's rows up from the hem along T5→T1
    const up = unit2(P2.sub(T1, T5)), [h4, h3, h2] = D.border;
    const T4 = P2.add(T5, P2.mul(up, h4)), T3 = P2.add(T4, P2.mul(up, h3)), T2 = P2.add(T3, P2.mul(up, h2));
    // the underside: the outside moved in by THICK (its corner where the two moved lines meet)
    const n1 = outN(T0, T1), n2 = outN(T1, T5);
    // (the hem's edge bevelled: the underside's hem lower than the outside's, so the edge shows from the front)
    const I5 = P2.sub(P2.sub(T5, P2.mul(n2, D.THICK)), P2.mul(up, D.bevel));
    const I1 = meet(P2.sub(T0, P2.mul(n1, D.THICK)), P2.sub(T1, P2.mul(n1, D.THICK)), P2.sub(T1, P2.mul(n2, D.THICK)), I5);
    const IT = P2.sub(T0, P2.mul(n1, D.THICK));
    cols.push({ deg, F, d, ...q, T0, T1, T2, T3, T4, T5, I5, I1, IT, yH });
  }
  const G = meshOfShawl(rig, D, cols, S);
  G.bones = shawlBones(rig, D, cols);
  return G;
}

/**
 * The cape's bones, two a side on the clavicle, each square to the body and its head on the cape's top
 * (under the cowl: the cape hinges there): cape_l, cape_r over the shoulders, turned by the arm's raise out to the side;
 * cape_front_l, cape_front_r over the chest, by its raise forward (DESIGN.lift). So the cape lifts over the arms as they
 * rise under it.
 */
export function shawlBones(rig, D, cols) {
  const L = D.lift, out = [];
  const hinge = (deg) => { const c = cols.reduce((m, q) => (Math.abs(((q.deg - deg + 540) % 360) - 180) < Math.abs(((m.deg - deg + 540) % 360) - 180) ? q : m)); return atRY(c.deg, c.T0[0], c.T0[1], D.z0); };
  for (const s of ['l', 'r']) {
    // (the frame square to the body: X across it as the upper arm's bend axis points, Y down, Z = X × Y; the turns are
    // the arm's raise about its own X and Z)
    const U = rig.bones[rig.at.get(`upperarm_${s}`)], m = s === 'l' ? 1 : -1, x = Math.sign(U.R[0]);
    const R = [x, 0, 0, 0, -1, 0, 0, 0, -x];
    out.push(garmentBone(`cape_${s}`, `clavicle_${s}`, hinge(90 * m), R, { from: `upperarm_${s}`, kind: 'lift', axis: 'z', sign: m, ...L.side }));
    out.push(garmentBone(`cape_front_${s}`, `clavicle_${s}`, hinge(L.frontAt * m), R, { from: `upperarm_${s}`, kind: 'lift', axis: 'x', sign: 1, ...L.front }));
    out.push(garmentBone(`cape_back_${s}`, `clavicle_${s}`, hinge(L.backAt * m), R, { from: `upperarm_${s}`, kind: 'lift', axis: 'x', sign: -1, ...L.back }));
  }
  return out;
}
const unit2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
/** Where line p1-p2 meets line p3-p4. */
function meet(p1, p2, p3, p4) {
  const d1 = P2.sub(p2, p1), d2 = P2.sub(p4, p3), den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return p2;
  const t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / den;
  return P2.add(p1, P2.mul(d1, t));
}

function meshOfShawl(rig, D, cols, S) {
  const N = cols.length, z0 = D.z0, G = meshOf();
  const ring = (key, part) => cols.map((c) => G.vert(atRY(c.deg, c[key][0], c[key][1], z0), part));
  const R = {};
  for (const key of ['T5', 'T3', 'T2', 'T1', 'T0']) R[key] = ring(key, 'cape');
  for (const key of [...COWL, 'd']) R[key] = ring(key, 'cowl');
  for (const key of ['IT', 'I1', 'I5']) R[key] = ring(key, 'cape');
  // the teeth's points: between each two columns, on the chord of their T4s
  const apex = cols.map((c, k) => { const c2 = cols[(k + 1) % N]; return G.vert(lerp(atRY(c.deg, c.T4[0], c.T4[1], z0), atRY(c2.deg, c2.T4[0], c2.T4[1], z0), 0.5), 'cape'); });
  // a band of quads round between two rings; a quad off its plane is cut along the diagonal that folds it away from the
  // cloth's other side (out from the axis on the outside, side +1; in toward it on the underside, -1), so the two sides
  // keep their thickness between them
  const band = (A, Bq, mat, part, tag, side = 1) => {
    G.tag = tag;
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, q = [A[k], A[j], Bq[j], Bq[k]];
      if (offPlane(G.verts, q) <= TOL) { G.poly(q, mat, part); continue; }
      const out = (a, b) => { const m = lerp(G.verts[a], G.verts[b], 0.5); return Math.hypot(m[0], m[2] - z0); };
      if (side * (out(q[0], q[2]) - out(q[1], q[3])) >= 0) { G.poly([q[0], q[1], q[2]], mat, part); G.poly([q[0], q[2], q[3]], mat, part); }
      else { G.poly([q[0], q[1], q[3]], mat, part); G.poly([q[1], q[2], q[3]], mat, part); }
    }
  };
  // the border: the teeth (tan, pointing down to the hem) and the cream round them
  G.tag = 'teeth';
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N, A = R.T3, H = R.T5, x = apex[k];
    G.poly([A[k], A[j], x], 'rune', 'cape');
    G.poly([A[k], x, H[k]], 'pattern', 'cape');
    G.poly([x, H[j], H[k]], 'pattern', 'cape');
    G.poly([x, A[j], H[j]], 'pattern', 'cape');
  }
  band(R.T3, R.T2, 'rune', 'cape', 'T3-T2');
  band(R.T2, R.T1, 'fabric', 'cape', 'T2-T1');
  band(R.T1, R.T0, 'fabric', 'cape', 'T1-T0');
  [['T0', ...COWL, 'd']].forEach((L) => L.slice(1).forEach((key, i) => band(R[L[i]], R[key], 'fabric', 'cowl', `${L[i]}-${key}`)));
  band(R.d, R.IT, 'inner', 'cowl', 'd-IT', -1);
  band(R.IT, R.I1, 'inner', 'cape', 'IT-I1', -1);
  band(R.I1, R.I5, 'inner', 'cape', 'I1-I5', -1);
  band(R.I5, R.T5, 'trim', 'cape', 'lip');
  if (D.emblem) emblemOn(G, D);
  const axisOut = (p) => [p[0], 0, p[2] - z0];
  orient(G, axisOut);
  G.tris = trisOf(G);
  G.cols = cols; G.design = D; G.rings = R; G.apex = apex;
  return G;
}

/* ---- the emblem ------------------------------------------------------------------------------------------------------ */
/** Where the ray o + t d (t > 0) first meets triangle abc: [t, [wa, wb, wc]], or null (Möller–Trumbore). */
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return null;
  const f = 1 / det, s = sub(o, a), u = f * dot(s, h);
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const q = cross(s, e1), v = f * dot(d, q);
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const t = f * dot(e2, q);
  return t > 1e-9 ? [t, [1 - u - v, u, v]] : null;
}
/** The cape's outside (the emblem lies on it), the rows below the border's line, and those it may run up into. */
const CAPE_OUT = new Set(['teeth', 'T3-T2', 'T2-T1', 'T1-T0']), BELOW = new Set(['teeth', 'T3-T2']), UP_ON = new Set(['T2-T1', 'T1-T0']);

/**
 * The emblem (DESIGN.emblem) on the cape's outside: a ring and three stripes, each a raised strip (its top and its two
 * walls, open underneath against the cloth) of material rune, tagged 'emblem'. Laid out flat in the plane touching the
 * cape at the ring's centre (u across toward the side, v up), each corner cast onto the cape along that plane's normal and
 * stood `lift` off it along its triangle's normal, the strip's top `h` over that (along the section's normal smoothed
 * along the strip); more sections where a wall would sag into a fold of the cloth, and a foot raised further where an
 * edge still would, so no edge of it dips into the cloth; it stays off the cowl by `up.clear`. The two stripes down end on the border's line (T2), each
 * wall where it meets it; the one up where the cloth goes under the cowl (`clear` short of it) or at its length. Each
 * vertex keeps the cape triangle under it and its place there (G.anchor), for its weights (shawlWeights).
 */
export function emblemOn(G, D) {
  const E = D.emblem, z0 = D.z0, sd = E.side ?? 1, Y = [0, 1, 0];
  const fan = (pi) => { const p = G.polys[pi], o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push({ v: [p.v[0], p.v[k], p.v[k + 1]], tag: p.tag }); return o; };
  const cape = [], cowl = [];
  G.polys.forEach((p, pi) => { if (CAPE_OUT.has(p.tag)) cape.push(...fan(pi)); else if (p.part === 'cowl' && p.tag !== 'd-IT') cowl.push(...fan(pi)); });
  for (const t of cape) {
    const [a, b, c] = t.v.map((i) => G.verts[i]), m = mul(add(add(a, b), c), 1 / 3);
    let n = unit(cross(sub(b, a), sub(c, a)));
    if (dot(n, [m[0], 0, m[2] - z0]) < 0) n = mul(n, -1);
    t.n = n;
  }
  // (the first triangle of a set the ray from o along d meets)
  const cast = (set, o, d) => {
    let best = null;
    for (const t of set) { const h = rayTri(o, d, ...t.v.map((i) => G.verts[i])); if (h && (!best || h[0] < best.t)) best = { t: h[0], w: h[1], tri: t }; }
    return best;
  };
  // (the cape under a point: where the line through it along n meets the cape nearest it, within 1 either way: the point
  // there, its triangle's normal, its tag, its corners' places)
  const under = (p, n) => {
    let h = null;
    for (const t of cape) { const x = rayTri(add(p, mul(n, 1)), mul(n, -1), ...t.v.map((i) => G.verts[i])); if (x && x[0] < 2 && (!h || Math.abs(x[0] - 1) < Math.abs(h.t - 1))) h = { t: x[0], w: x[1], tri: t }; }
    return h && { q: add(p, mul(n, 1 - h.t)), n: h.tri.n, tag: h.tri.tag, v: h.tri.v, w: h.w };
  };
  const toCowl = (q, n) => cast(cowl, q, n)?.t ?? Infinity;
  // the plane at the ring's centre
  const C0 = cast(cape, atRY(E.az * sd, 8, E.y, z0), mul(dirOf(E.az * sd), -1));
  if (!C0) throw new Error('emblem: no cape at the ring\'s centre');
  const O = add(atRY(E.az * sd, 8, E.y, z0), mul(dirOf(E.az * sd), -C0.t)), N0 = C0.tri.n;
  const e1 = mul(unit(cross(Y, N0)), sd), e2 = unit(cross(N0, unit(cross(Y, N0))));
  const at = ([u, v]) => under(add(O, add(mul(e1, u), mul(e2, v))), N0);
  const rep = (G.emblem = { at: O, az: E.az * sd, pieces: [], cowl: Infinity, missing: 0 });
  const need = E.lift + E.h + (E.up?.clear ?? 0.03);
  // (a corner: its cast, the foot's lift above it)
  const corner = (uv) => { const c = at(uv); if (!c) { rep.missing++; return null; } c.up = E.lift; rep.cowl = Math.min(rep.cowl, toCowl(c.q, c.n)); return c; };
  G.anchor ??= new Map();
  // a strip through its sections [[left uv, right uv], ...], closed (the ring) or capped at both ends
  // (the sag under a wall from a to b, each `lift` off the cloth: how far below `lift` its middle comes, at most)
  const sag = (a, b) => Math.max(0, ...[0.25, 0.5, 0.75].map((t) => { const n = unit(lerp(a.n, b.n, t)), m = lerp(add(a.q, mul(a.n, E.lift)), add(b.q, mul(b.n, E.lift)), t), h = under(m, n); return h ? E.lift - dot(sub(m, h.q), n) : 0; }));
  // a strip through its sections sec(t) = [left uv, right uv], t from 0 to 1 (the ring closed: 1 is 0 again; the stripes
  // capped at both ends), n of them, and one more halfway along where a wall would sag into the cloth between two
  const strip = (sec, n, closed, name) => {
    let ts = Array.from({ length: n + 1 }, (_, k) => k / n);
    for (let it = 0; it < 3; it++) {
      const more = [];
      for (let k = 0; k + 1 < ts.length; k++) {
        const A = sec(ts[k]).map(at), B = sec(ts[k + 1]).map(at);
        const long = Math.hypot(...sec(ts[k])[0].map((x, j) => x - sec(ts[k + 1])[0][j])) > 2 * E.lift + 0.05;
        if (long && A.every(Boolean) && B.every(Boolean) && Math.max(sag(A[0], B[0]), sag(A[1], B[1])) > E.lift / 4) more.push((ts[k] + ts[k + 1]) / 2);
      }
      if (!more.length) break;
      ts = [...ts, ...more].sort((a, b) => a - b);
    }
    if (closed) ts.pop();
    const S = ts.map(sec).map(([l, r]) => [corner(l), corner(r)]);
    if (S.some(([l, r]) => !l || !r)) throw new Error(`emblem: ${name} off the cape`);
    // (and clear of the cowl over it)
    if (S.some((sc) => sc.some((c) => toCowl(c.q, c.n) <= need))) throw new Error(`emblem: ${name} under the cowl`);
    // (the foot raised where the cloth folds outward under an edge: across each section and along each wall)
    const edges = [];
    S.forEach(([l, r], k) => { edges.push([l, r]); if (closed || k + 1 < S.length) { const [l2, r2] = S[(k + 1) % S.length]; edges.push([l, l2], [r, r2]); } });
    for (let it = 0; it < 4; it++) for (const [a, b] of edges) for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const n = unit(lerp(a.n, b.n, t)), m = lerp(add(a.q, mul(a.n, a.up)), add(b.q, mul(b.n, b.up)), t), h = under(m, n);
      if (!h) continue;
      const gap = dot(sub(m, h.q), n);
      if (gap < E.lift - 1e-4) { a.up += E.lift - gap; b.up += E.lift - gap; }
    }
    // the vertices: the foot and the top of each corner, each anchored on its triangle; the top over the foot along the
    // section's normal smoothed along the strip (no kink in its top where the cloth folds under it)
    const v0 = G.verts.length, ns = S.map(([l, r]) => unit(add(l.n, r.n)));
    const nsm = ns.map((n, k) => { const a = ns[closed ? (k + ns.length - 1) % ns.length : Math.max(0, k - 1)], b = ns[closed ? (k + 1) % ns.length : Math.min(ns.length - 1, k + 1)]; return unit(add(add(a, b), mul(n, 2))); });
    const V = S.map((sc, k) => sc.map((c) => { const f = add(c.q, mul(c.n, c.up)); return [f, add(f, mul(nsm[k], E.h))].map((p) => { const i = G.vert(p, 'emblem'); G.anchor.set(i, { v: c.v, w: c.w }); return i; }); }));
    G.tag = 'emblem';
    const nv = V.length;
    for (let k = 0; k < (closed ? nv : nv - 1); k++) {
      const [[lf, lt], [rf, rt]] = V[k], [[lf2, lt2], [rf2, rt2]] = V[(k + 1) % nv];
      G.poly([lt, rt, rt2, lt2], 'rune', 'emblem');
      G.poly([lf, lt, lt2, lf2], 'rune', 'emblem');
      G.poly([rt, rf, rf2, rt2], 'rune', 'emblem');
    }
    if (!closed) for (const [[lf, lt], [rf, rt]] of [V[0], V[nv - 1]]) G.poly([lf, rf, rt, lt], 'rune', 'emblem');
    rep.pieces.push({ name, verts: [v0, G.verts.length], sections: nv, foot: +Math.max(...S.flat().map((c) => c.up)).toFixed(4) });
  };
  const P = (u, v) => [u, v], dir = (deg) => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
  const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]], mul2 = (a, k) => [a[0] * k, a[1] * k];
  // (the last t from t0 a test holds, in steps then halved)
  const reach = (ok, t0, t1, dt = 0.01) => { let t = t0; while (t + dt <= t1 && ok(t + dt)) t += dt; let lo = t, hi = Math.min(t1, t + dt); for (let k = 0; k < 12 && hi > lo; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } return lo; };
  // the ring
  const rIn = E.r - E.w / 2, rOut = E.r + E.w / 2, eps = 0.012;
  strip((t) => { const a = dir((t + 0.5 / E.seg) * 360); return [mul2(a, rIn), mul2(a, rOut)]; }, E.seg, true, 'ring');
  // the two stripes down to the border's line
  const St = E.stripes, phi = -90 - St.lean, d2 = dir(phi), p2 = dir(phi + 90);
  for (const o of [-St.gap / 2, St.gap / 2]) {
    const offs = [o - St.w / 2, o + St.w / 2], m = Math.min(...offs.map(Math.abs));
    const t0 = (offs[0] < 0 && offs[1] > 0 ? rOut : Math.sqrt(Math.max(0, rOut * rOut - m * m))) + eps;
    const line = (off) => (t) => add2(mul2(d2, t), mul2(p2, off));
    const ends = offs.map((off) => reach((t) => { const c = at(line(off)(t)); return !!c && !BELOW.has(c.tag); }, t0, 4));
    const n = Math.max(1, Math.ceil(((ends[0] + ends[1]) / 2 - t0) / E.step));
    strip((t) => offs.map((off, j) => line(off)(t0 + (ends[j] - t0) * t)), n, false, `stripe ${o < 0 ? 'in' : 'out'}`);
  }
  // the one up toward the shoulder: its middle line from the ring's edge, turning from `from` to `to`
  const U = E.up, ds = 0.01, mid = [mul2(dir(U.from), rOut + eps)], ang = [U.from];
  for (let s = ds; s <= U.len + 1e-9; s += ds) { const a = U.from + (U.to - U.from) * Math.min(1, s / U.len); ang.push(a); mid.push(add2(mid[mid.length - 1], mul2(dir(a), ds))); }
  const side = (off) => (s) => { const k = Math.min(mid.length - 1, Math.round(s / ds)); return add2(mid[k], mul2(dir(ang[k] + 90), off)); };
  const okUp = (off) => (s) => { const c = at(side(off)(s)); return !!c && UP_ON.has(c.tag) && toCowl(c.q, c.n) > need; };
  const ends = [U.w / 2, -U.w / 2].map((off) => reach(okUp(off), 0, U.len));
  const n = Math.max(1, Math.ceil((ends[0] + ends[1]) / 2 / E.step));
  strip((t) => [U.w / 2, -U.w / 2].map((off, j) => side(off)(ends[j] * t)), n, false, 'stripe up');
  rep.cowl = +rep.cowl.toFixed(3);
  G.tag = undefined;
}

/**
 * The cowl's vertices refitted to the game's idle and walk (lowgarment.mjs applyRefit): per body, the left side's by ring
 * and column azimuth (`u1:18`, G.rings and G.cols); the right side's (360 less the azimuth) mirrored. Found by
 * tools/sculpt/lowrefit.mjs.
 */
export const REFIT = {
  male: {
    'u1:18': [['neck_02', 0.41], ['spine_03', 0.24], ['spine_02', 0.24], ['clavicle_l', 0.11]],
    'u1:36': [['neck_02', 0.39], ['spine_03', 0.23], ['spine_02', 0.23], ['clavicle_l', 0.15]],
  },
  female: {},
};

/**
 * The shawl's weights from the body: the cowl's from the neck and the chest's top (neck_01, neck_02, spine_03); the
 * cape's from the closest skin, its bones mapped to the torso (the clavicles, spine_03: the arms' and the lower spine's
 * taken up to them), then shared with the cape's own bones (DESIGN.lift) over the arms.
 */
export function shawlWeights(rig, G, o = {}) {
  const cowl = { head: 'neck_02', jaw: 'neck_02', neck_02: 'neck_02', neck_01: 'neck_01' };
  const capeMap = (n) => {
    if (/^(spine_0[12]|pelvis|root)$/.test(n)) return 'spine_03';
    if (/^(head|jaw|neck_02)$/.test(n)) return 'neck_01';
    const m = n.match(/_(l|r)$/), s = m ? m[1] : null;
    // the arm under the cape: the cape's own bone takes it (below); the rest hangs from the clavicle
    if (s && /^(upperarm|lowerarm|hand|thumb|fingers|elbow|wrist|knuckles|shoulder)/.test(n)) return `clavicle_${s}`;
    if (s && /^(thigh|calf|foot|ball|hip|knee|ankle|toes)/.test(n)) return 'spine_03';
    return n;
  };
  const map = (n, i) => {
    if (G.part[i] === 'cowl') {
      if (cowl[n]) return cowl[n];
      return 'spine_03';
    }
    return capeMap(n);
  };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 24 });
  // the cloth's thickness moves as one: the underside takes the outside's weights (IT T0, I1 T1, I5 T5), the border's
  // rows theirs along T1-T5 by where they lie, the teeth's points their two columns'
  const R = G.rings, N = R.T0.length;
  const mix = (A, Bw, t) => { const o2 = new Map(); for (const [b, w] of A) o2.set(b, (o2.get(b) ?? 0) + w * (1 - t)); for (const [b, w] of Bw) o2.set(b, (o2.get(b) ?? 0) + w * t); return [...o2].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([b, w], _, l) => [b, w / l.reduce((s2, [, x]) => s2 + x, 0)]); };
  const len = (i, j) => Math.hypot(...sub(G.verts[i], G.verts[j]));
  // the cape on its bones: the side's share over each arm, the front's and the back's over each side of the chest and the
  // back (all together at most all of it), from L.top of it at the cape's top to all of it at the shoulder's corner and below
  const L = G.design.lift, nb = rig.bones.length;
  for (let k = 0; k < N; k++) {
    const deg = G.cols[k].deg, sn = Math.sin(deg * Math.PI / 180), side = sn > 0 ? 0 : 1;
    // (a: degrees from the front; the front's and the back's shares cos of twice the turn from frontAt, backAt, within
    // 45 of it)
    const a = Math.abs(((deg + 540) % 360) - 180), near = (at, r) => (Math.abs(a - at) < r ? Math.cos(90 / r * (a - at) * Math.PI / 180) : 0);
    const W = [Math.max(0, (Math.abs(sn) - L.from) / (1 - L.from)) ** 1.5, near(L.frontAt, L.reach[0]), near(L.backAt, L.reach[1])], t = W[0] + W[1] + W[2];
    if (t <= 0) continue;
    const own = W.map((w, j) => [nb + 3 * side + j, w / t]).filter(([, w]) => w > 0), all = Math.min(1, t);
    vw[R.T0[k]] = mix(vw[R.T0[k]], own, all * (L.top * W[0] + W[1] + W[2]) / t);
    // (the cowl's lower roll over the hinge goes with it, a share)
    for (const [key, f] of Object.entries(L.roll ?? {})) vw[R[key][k]] = mix(vw[R[key][k]], own, f * all);
    vw[R.T1[k]] = mix(vw[R.T1[k]], own, all);
    vw[R.T5[k]] = mix(vw[R.T5[k]], own, all);
  }
  // the refitted vertices (REFIT), before the underside takes the outside's
  const colAt = (deg) => G.cols.findIndex((c) => Math.abs(c.deg - deg) < 1e-6);
  applyRefit(rig, vw, o.refit ?? REFIT[rig.who], (key, mirror) => {
    const [ring, d] = key.split(':'), k = colAt(mirror ? (360 - +d) % 360 : +d);
    return mirror && (+d === 0 || +d === 180) ? undefined : k < 0 ? undefined : R[ring]?.[k];
  });
  for (let k = 0; k < N; k++) {
    vw[R.IT[k]] = vw[R.T0[k]]; vw[R.I1[k]] = vw[R.T1[k]]; vw[R.I5[k]] = vw[R.T5[k]];
    const L = len(R.T5[k], R.T1[k]);
    for (const key of ['T2', 'T3']) vw[R[key][k]] = mix(vw[R.T5[k]], vw[R.T1[k]], len(R.T5[k], R[key][k]) / L);
  }
  for (let k = 0; k < N; k++) vw[G.apex[k]] = mix(vw[R.T5[k]], vw[R.T5[(k + 1) % N]], 0.5);
  if (G.anchor) emblemWeights(rig, G, vw);
  return vw;
}

/**
 * The poses the emblem's weights are fitted over (emblemWeights): both arms forward, back and out by steps, swung
 * opposite as in a walk with the chest turned, raised forward and out together; the chest bent and leaned, the
 * shoulders raised; hers as the game holds her arms (lowrig.mjs armsOut).
 */
export function fitPoses(rig) {
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const turn = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const arm = (p, s, bone, axis, deg) => { const n = `${bone}_${s}`; p[n] = mm(s === 'l' ? turn(n, axis, deg) : turn(n, [-axis[0], axis[1], axis[2]], -deg), p[n] ?? I); return p; };
  const both = (p, bone, axis, deg) => arm(arm(p, 'l', bone, axis, deg), 'r', bone, axis, deg);
  const list = [];
  for (const d of [-84, -60, -40, -20, 20, 35]) list.push(both({}, 'upperarm', X, d));
  for (const d of [20, 45, 74]) list.push(both({}, 'upperarm', Z, d));
  for (const d of [15, 30]) for (const t of [-8, 8]) list.push(arm(arm({ spine_03: turn('spine_03', Y, t) }, 'l', 'upperarm', X, d), 'r', 'upperarm', X, -d), arm(arm({ spine_03: turn('spine_03', Y, t) }, 'l', 'upperarm', X, -d), 'r', 'upperarm', X, d));
  list.push(both(both({}, 'upperarm', X, -50), 'upperarm', Z, 30), both(both(both({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2));
  // (and the chest bent and the shoulders raised, as the idle breathes and sways)
  for (const d of [-6, 6]) list.push({ spine_02: turn('spine_02', X, d), spine_03: turn('spine_03', X, d) }, { spine_03: turn('spine_03', Z, d) }, both({}, 'clavicle', Z, d * 1.5));
  return rig.who === 'female' ? list.map((p) => armsOut(rig, p)) : list;
}
/**
 * The emblem's weights: each vertex's those that keep it where it lies on the cape (its point on the triangle under it,
 * as far off it along the triangle's normal as at rest) over the arm poses (fitPoses), least squares, among the bones of
 * that triangle's corners, at most four; drawn toward the corners' weights blended by its place there (which a weight
 * the poses leave free keeps). Blended weights alone let it sink into the cloth as the cape's bones turn under it.
 */
export function emblemWeights(rig, G, vw, { lambda = 0.005, iters = 6000, normal = 25 } = {}) {
  const blend = (a) => { const o = new Map(); a.v.forEach((j, k) => { for (const [b, w] of vw[j]) o.set(b, (o.get(b) ?? 0) + w * a.w[k]); }); return o; };
  const poses = fitPoses(rig).map((p) => {
    const F = posed(rig, p);
    return { P: skinGarment(rig, F, G, vw), F: garmentFrames(rig, G, F) };
  });
  const bones = [...rig.bones, ...(G.bones ?? [])];
  // (w on the simplex: Duchi's projection)
  const simplex = (w) => { const u = [...w].sort((a, b) => b - a); let c = 0, th = 0; for (let k = 0; k < u.length; k++) { c += u[k]; const t = (c - 1) / (k + 1); if (u[k] - t > 0) th = t; } return w.map((x) => Math.max(0, x - th)); };
  for (const [i, a] of G.anchor) {
    const w0m = blend(a), cand = [...w0m.keys()], p = G.verts[i];
    // (at rest: its height over the triangle; in each pose its place there, and each candidate bone's carry of it)
    const [A0, B0, C0] = a.v.map((j) => G.verts[j]), n0 = unit(cross(sub(B0, A0), sub(C0, A0))), h = dot(n0, sub(p, add(add(mul(A0, a.w[0]), mul(B0, a.w[1])), mul(C0, a.w[2]))));
    const rows = [], rhs = [];
    for (const { P, F } of poses) {
      const [A, B, C] = a.v.map((j) => P[j]), n = unit(cross(sub(B, A), sub(C, A))), x = add(add(add(mul(A, a.w[0]), mul(B, a.w[1])), mul(C, a.w[2])), mul(n, h));
      const Y = cand.map((b) => add(mv3(F[b].S, sub(p, bones[b].head)), F[b].P));
      // (along the triangle's normal `normal` times as much as across it: sinking matters, sliding less)
      const t1 = unit(sub(B, A)), t2 = cross(n, t1);
      for (const [d, k] of [[n, normal], [t1, 1], [t2, 1]]) { rows.push(Y.map((y) => k * dot(y, d))); rhs.push(k * dot(x, d)); }
    }
    const fit = (keep) => {
      const ix = cand.map((_, k) => k).filter((k) => keep.includes(k)), w0 = ix.map((k) => w0m.get(cand[k]));
      let w = simplex(w0.map((x) => x));
      const L = rows.reduce((s2, r) => s2 + ix.reduce((s3, k) => s3 + r[k] * r[k], 0), 0) + lambda * rhs.length;
      for (let it = 0; it < iters; it++) {
        const g = ix.map((_, m) => lambda * rhs.length * (w[m] - w0[m]));
        rows.forEach((r, q) => { const e = ix.reduce((s2, k, m) => s2 + r[k] * w[m], 0) - rhs[q]; ix.forEach((k, m) => { g[m] += r[k] * e; }); });
        w = simplex(w.map((x, m) => x - g[m] / L));
      }
      return ix.map((k, m) => [k, w[m]]);
    };
    let w = fit(cand.map((_, k) => k));
    if (w.filter(([, x]) => x > 1e-4).length > 4) w = fit(w.sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k]) => k));
    const l = w.filter(([, x]) => x > 1e-4), t = l.reduce((s2, [, x]) => s2 + x, 0);
    vw[i] = l.sort((x, y) => y[1] - x[1]).map(([k, x]) => [cand[k], x / t]);
  }
  return vw;
}
const mv3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
// (worn over the tunic: its copy is fitted over it and written by garments/outfit1.mjs)
if (import.meta.url === `file://${process.argv[1]}`) await (await import('./outfit1.mjs')).writeAssets(['shawl']);
