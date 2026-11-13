// The chain set's shawl, the petal gorget: a stiff standing collar round the neck, worked in a diamond pattern (iron
// diamonds, each sloping up to a raised brass inset ringed in the dark lining, on iron mail), its top a row of brass rings; and from the collar's foot a ring of
// leaf-shaped mail tabs fanning down over the shoulders, the chest and the back, every other one laid over its two
// neighbours, each edged in brass rings. Enchanted, the diamonds' insets and the tabs' brass edges glow. Worn over the
// hauberk (chainchest.mjs) and clear of the coif (its tippet left out under the collar) and every helm. One design for
// both bodies, each body its own numbers (DESIGN), skinned to the body's own bones (the collar on spine_03, the clavicles
// and a little of neck_01; each tab from the collar's weights at its root to the skin's under it; no bones of its own).
//
//   buildChainShawl(rig, design?, { under }) → { verts, polys: [{ v, mat, part, tag }], tris, part, design, petals }
//   chainShawlWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/chainshawl.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowchainshawl-male.json and -female.json
//     (lowgarment.mjs garmentAsset with the chain set's plain and enchanted looks; loaded by src/sculpt/lowpoly.ts, worn
//     with outfit.chainShawl, its iron in outfit.metal.chainShawl)
//
// The shape, round a vertical axis through the neck (azimuth 0 the front, 90 the body's left):
//   the collar: `collar.n` diamonds round, between three rings (its foot, its middle half a diamond round, its top), each
//   ring's height a blend [front, side, back] of the azimuth's cosine; its wall a straight line from the foot to the top,
//   leaning out by `lean` degrees [front, side, back], its inside `gap` clear of what is worn under it round the neck
//   (the hauberk's collar, the coif's hood); its wall `t` thick, the inside the padded lining, the top's lip brass;
//   the tabs: `petals.n` round from the front, each a leaf (its root `root` of its widest, its widest at `widest` up it,
//   pointed) laid on the body's line from the collar's outside a little over its foot (lowgarment.mjs drape over what is
//   worn under it, grown by `gap`), leaning out below the shoulder's corner and its tip lifted off by `flare`; the even
//   ones under, the odd ones over them by `layer`; each a closed shell `t` thick: its brass edge `rim` wide round a field
//   of mail in courses (iron, alternately lit and shaded), its thickness the dark lining (a dark line under the brass in
//   any metal), its underside iron.
import { readFileSync, existsSync } from 'node:fs';
import { samplesOf, envelope, drape, atRY, meshOf, orient, trisOf, crossPairs, closestOnBody, transferWeights, sub, add, mul, unit, cross, dot } from '../lowgarment.mjs';
import { MATS as CHAIN, LOOKS as CHAIN_LOOKS } from './chainmail.mjs';

/** The chain set's materials it takes (chainmail.mjs MATS, so the game gives the brass, the lining and the runes the set's slots): the mail's face and shade (in the piece's metal), the brass, the lining, the runes (brass plain, glowing enchanted). */
const USED = ['plate', 'shade', 'gold', 'under', 'rune'];
export const MATS = Object.fromEntries(USED.map((n) => [n, CHAIN[n]]));
export const LOOKS = { plain: Object.fromEntries(USED.map((n) => [n, CHAIN_LOOKS.plain[n]])), enchanted: Object.fromEntries(USED.map((n) => [n, CHAIN_LOOKS.enchanted[n]])) };

/**
 * The design per body (the body's units: y up, the chin's underside 0):
 *   gap: what the garment keeps clear of what is under it;
 *   collar: n diamonds; foot, top: the rings' heights [front, side, back]; lean: the wall's lean out from upright
 *   (degrees, [front, side, back]); t: its thickness; inset: the diamonds' insets' share of the diamond; raise: how far
 *   the insets stand out; lip: the brass top's rise over the wall's top;
 *   petals: n tabs; len: their length [front, side, back]; wide: the widest across, a share of the spacing round (over
 *   1: they overlap); root: the root's width a share of the widest; widest: where it is widest, a share up the tab; up:
 *   the roots' height over the collar's foot; t: thickness; rib: the midrib's rise; course, d, links: the mail's courses'
 *   spacing down the tab, their crests' height and the links each side of the midrib; rim: the brass edge's width; layer: the odd tabs' underside
 *   over the even ones' outside; flare: the tip's lift off the line (by the share up the tab squared) [front, side, back]; lean: below the
 *   shoulder's corner the line leans out by this per unit of drop; depth: how far down the line is laid.
 */
export const DESIGN = {
  male: {
    gap: 0.05,
    collar: { n: 14, foot: [-0.72, -0.36, -0.5], top: [-0.08, 0.16, 0.2], lean: [10, -14, -8], t: 0.07, inset: 0.6, raise: 0.035, lip: 0.02 },
    petals: { n: 12, len: [1.1, 1.75, 1.75], wide: 1.55, root: 0.5, widest: 0.42, up: 0, t: 0.06, rib: 0.03, course: 0.2, d: 0.035, links: 3, rim: 0.12, layer: 0.035, flare: [0.22, 0.5, 0.42], lean: 0.12, depth: 2.6 },
  },
  female: {
    gap: 0.045,
    collar: { n: 14, foot: [-0.68, -0.42, -0.52], top: [-0.1, 0.1, 0.14], lean: [10, -10, -6], t: 0.065, inset: 0.6, raise: 0.03, lip: 0.018 },
    petals: { n: 12, len: [0.95, 1.5, 1.5], wide: 1.55, root: 0.5, widest: 0.42, up: 0, t: 0.055, rib: 0.027, course: 0.18, d: 0.032, links: 3, rim: 0.1, layer: 0.03, flare: [0.19, 0.43, 0.36], lean: 0.12, depth: 2.3 },
  },
};

/* ---- helpers --------------------------------------------------------------------------------------------------------- */
/** A value [front, side, back] round the azimuth by its cosine. */
const blend3 = ([f, s, b], deg) => { const c = Math.cos(deg * Math.PI / 180); return c > 0 ? f * c + s * (1 - c) : b * -c + s * (1 + c); };
const wrap = (d) => ((d % 360) + 540) % 360 - 180;
const P2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, k) => [a[0] * k, a[1] * k], len: (a) => Math.hypot(a[0], a[1]) };
/** The outward normal (away from the axis, or up) of a segment a→b in (r, y). */
const outN = (a, b) => { const d = P2.sub(b, a), l = P2.len(d) || 1; const n = [-d[1] / l, d[0] / l]; return n[0] < 0 || (Math.abs(n[0]) < 1e-9 && n[1] < 0) ? [-n[0], -n[1]] : n; };

/** A garment asset of this body (src/sculpt/assets/<name>-<who>.json) as a mesh { verts, tris }, its polygons from `from` to `to` only; null where it is not there. */
export function assetMesh(name, who, { from = 0, to = Infinity } = {}) {
  const file = new URL(`../../../src/sculpt/assets/${name}-${who}.json`, import.meta.url).pathname;
  if (!existsSync(file)) return null;
  const A = JSON.parse(readFileSync(file, 'utf8')), verts = [], tris = [];
  for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const end = Math.min(to === 'drop' ? A.dropFrom ?? Infinity : to, A.polys.length);
  for (let i = 0; i < A.tris.length; i += 4) if (A.tris[i + 3] >= from && A.tris[i + 3] < end) tris.push({ v: A.tris.slice(i, i + 3), poly: A.tris[i + 3] });
  return { verts, tris, asset: A };
}
/**
 * What the shawl is worn over, at rest: the hauberk (chainchest.mjs) and the coif's hood, its tippet left out under the
 * collar (chaincoif.mjs, its polygons before `dropFrom`).
 */
export function underOf(who) {
  return [assetMesh('lowchainchest', who), assetMesh('lowchaincoif', who, { to: 'drop' })].filter(Boolean);
}

/* ---- the shape -------------------------------------------------------------------------------------------------------- */
export function buildChainShawl(rig, D = DESIGN[rig.who], { under = underOf(rig.who), extra = {} } = {}) {
  const { B } = rig, C = D.collar, T = D.petals, gap = D.gap;
  // the neck's axis: the middle of the neck's vertices
  const neck = B.verts.filter((_, i) => B.part[i] === 'neck'), z0 = neck.reduce((s, p) => s + p[2], 0) / neck.length;
  const S = [...samplesOf(B), ...under.flatMap((m) => samplesOf(m, m.verts))];
  const az = (p) => Math.atan2(p[0], p[2] - z0) * 180 / Math.PI, rad = (p) => Math.hypot(p[0], p[2] - z0);
  const SA = S.map((p) => [az(p), rad(p), p[1]]);
  const G = meshOf();
  G.design = { ...D, z0 };
  // ---- the collar: its wall's line per azimuth (foot r and height, top r and height), its inside clear of what is under
  // it within a diamond's width of that azimuth (grown by 1/cos of half that, so a chord between two corners clears it)
  const w = 360 / C.n, kc = 1 / Math.cos((w / 2) * Math.PI / 180);
  const wallAt = (deg) => {
    const yF = blend3(C.foot, deg), yT = blend3(C.top, deg), sl = Math.tan(blend3(C.lean, deg) * Math.PI / 180);
    let rF = 0.3;
    for (const [a, r, y] of SA) {
      if (y < yF + 0.03 || y > yT + 0.12 || Math.abs(wrap(a - deg)) > w / 2) continue;
      const need = r * kc + gap - (Math.min(yT, Math.max(yF, y)) - yF) * sl;
      rF = Math.max(rF, need);
    }
    return { yF, yT, sl, rF };
  };
  // (the wall's inside at each of the rings' corners, then rounded: none far inside its two neighbours)
  const nR = 2 * C.n, wall = Array.from({ length: nR }, (_, j) => wallAt((j * w) / 2));
  for (let it = 0; it < 2; it++) { const r = wall.map((q) => q.rF); wall.forEach((q, j) => { q.rF = Math.max(r[j], (r[(j + nR - 1) % nR] + 2 * r[j] + r[(j + 1) % nR]) / 4); }); }
  for (const q of wall) q.rF += extra.collar ?? 0;
  // (a point on the wall's inside, or out by `o`, at corner j (half diamonds round) and share u up it)
  const wallPt = (j, u, o = 0) => { const q = wall[((j % nR) + nR) % nR], y = q.yF + (q.yT - q.yF) * u; return atRY((j * w) / 2, q.rF + (y - q.yF) * q.sl + o, y, z0); };
  G.tag = 'collar';
  {
    const t = C.t, V = (p) => G.vert(p, 'collar');
    // the outside's rings: the foot and the top at the odd corners (the diamonds' middles), the middle at the even ones
    const F = [], M = [], Tp = [], Fi = [], Ti = [];
    for (let j = 0; j < C.n; j++) {
      F.push(V(wallPt(2 * j + 1, 0, t))); Tp.push(V(wallPt(2 * j + 1, 1, t)));
      M.push(V(wallPt(2 * j, 0.5, t)));
      Fi.push(V(wallPt(2 * j + 1, 0, 0))); Ti.push(V(add(wallPt(2 * j + 1, 1, 0), [0, C.lip, 0])));
    }
    for (let j = 0; j < C.n; j++) {
      const i = (j + 1) % C.n;
      // the diamond j: its foot F[j], its sides M[j] and M[i], its top Tp[j]; its iron sloping up to a raised brass inset (the runes)
      const corners = [F[j], M[i], Tp[j], M[j]], P = corners.map((v) => G.verts[v]), c = mul(P.reduce(add, [0, 0, 0]), 1 / 4);
      const n = unit(cross(sub(P[1], P[3]), sub(P[2], P[0]))), out = dot(n, [c[0], 0, c[2] - z0]) < 0 ? mul(n, -1) : n;
      // (the inset's foot a little outside it, on the iron; from there its sides straight up in the dark lining, a dark line
      // round the brass whatever the mail's metal)
      const base = P.map((p) => V(add(add(c, mul(sub(p, c), C.inset + 0.08)), mul(out, C.raise * 0.25)))), inner = P.map((p) => V(add(add(c, mul(sub(p, c), C.inset)), mul(out, C.raise))));
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        G.poly([corners[k], corners[k2], base[k2], base[k]], k === 1 || k === 2 ? 'plate' : 'shade', 'collar');
        G.poly([base[k], base[k2], inner[k2], inner[k]], 'under', 'collar');
      }
      G.poly(inner, 'rune', 'collar');
      // the iron between two diamonds: below and above the corner they share
      G.poly([F[j], F[i], M[i]], 'plate', 'collar');
      G.poly([M[i], Tp[i], Tp[j]], 'shade', 'collar');
      // the brass top, the lining inside, the foot
      G.poly([Tp[j], Tp[i], Ti[i], Ti[j]], 'gold', 'collar');
      G.poly([Ti[j], Ti[i], Fi[i], Fi[j]], 'under', 'collar');
      G.poly([Fi[j], Fi[i], F[i], F[j]], 'under', 'collar');
    }
    G.collar = { F, M, Tp, Fi, Ti };
  }
  // the collar's outside, for the tabs to lie over
  const collarS = samplesOf({ tris: trisOf(G) }, G.verts, 0.05);
  const S2 = [...S, ...collarS];
  // ---- the tabs' lines: per column (every STEP degrees), from the collar's outside `up` over its foot, the drape over
  // what is under it (grown by `clear`); one set for the under tabs, over what is worn under the shawl, one for the over
  // tabs, over the under tabs too
  const STEP = 3, NC = 360 / STEP;
  const collarOut = (deg, y) => { let m = 0; for (const p of collarS) { if (Math.abs(p[1] - y) > 0.08 || Math.abs(wrap(az(p) - deg)) > 2 * STEP) continue; m = Math.max(m, rad(p)); } return m; };
  const colsOver = (S, clear) => Array.from({ length: NC }, (_, ci) => {
    const deg = ci * STEP, yR = blend3(C.foot, deg) + T.up, A = [collarOut(deg, yR) / Math.cos(STEP * Math.PI / 180) + gap, yR];
    const E = envelope(S, z0, deg, STEP, clear, A[1] - T.depth, A[1] + 0.01).filter(([, y]) => y < A[1] - 1e-4);
    let L = drape(E, A, A[1] - T.depth);
    // (below the shoulder's corner, the first steep step down, leaning out)
    const ci2 = L.findIndex((p, i) => i > 0 && (L[i - 1][1] - p[1]) > 1.2 * (p[0] - L[i - 1][0]));
    if (ci2 > 0) { const yc = L[ci2 - 1][1]; L = L.map((p, i) => (i >= ci2 ? [p[0] + (yc - p[1]) * T.lean, p[1]] : p)); }
    const s = [0];
    for (let i = 1; i < L.length; i++) s.push(s[i - 1] + P2.len(P2.sub(L[i], L[i - 1])));
    const segN = L.slice(1).map((p, i) => outN(L[i], p));
    const N = L.map((_, i) => { const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)], m = P2.add(a, b), l = P2.len(m) || 1; return [m[0] / l, m[1] / l]; });
    return { deg, L, s, N };
  });
  const onLine = ({ L, s, N }, sv, off) => {
    for (let i = 0; i + 1 < L.length; i++) if (sv <= s[i + 1] || i + 2 === L.length) {
      const t = Math.max(0, Math.min(1, (sv - s[i]) / Math.max(1e-9, s[i + 1] - s[i]))), n = P2.add(P2.mul(N[i], 1 - t), P2.mul(N[i + 1], t)), l = P2.len(n);
      return P2.add([L[i][0] + (L[i + 1][0] - L[i][0]) * t, L[i][1] + (L[i + 1][1] - L[i][1]) * t], P2.mul([n[0] / l, n[1] / l], off));
    }
    return L[0];
  };
  // (a point at azimuth deg, s down the lines, `off` off them: between the two nearest columns)
  const sec = (cols, deg, sv, off) => {
    const x = (((deg % 360) + 360) % 360) / STEP, i = Math.floor(x) % NC, t = x - Math.floor(x);
    return P2.add(P2.mul(onLine(cols[i], sv, off), 1 - t), P2.mul(onLine(cols[(i + 1) % NC], sv, off), t));
  };
  const lines = [colsOver(S2, gap)];
  // ---- the tabs, the under ones first: each a leaf on its layer's lines (its outline in s down them and x across, x an
  // arc at the root's radius), a midrib down its middle
  const U = [0, 0.2, T.widest, 0.62, 0.82];
  const shape = (u) => (u <= T.widest ? T.root + (1 - T.root) * Math.sin((Math.PI / 2) * (u / T.widest)) : Math.pow(Math.cos((Math.PI / 2) * ((u - T.widest) / (1 - T.widest))), 0.85));
  G.petals = []; G.u = [];
  const order = [...Array(T.n).keys()].sort((a, b) => (a % 2) - (b % 2) || a - b);
  for (const q of order) {
    const c = (q * 360) / T.n, len = blend3(T.len, c), half = ((T.wide * 360) / T.n / 2) * Math.PI / 180, layer = q % 2;
    if (layer && lines.length === 1) lines.push(colsOver([...S2, ...samplesOf({ tris: trisOf(G).filter((t) => G.polys[t.poly].part !== 'collar') }, G.verts, 0.05)], T.layer));
    const cols = lines[layer], r0 = sec(cols, c, 0, 0)[0], hw = (u) => shape(u) * half * r0;
    const O = [...U.map((u) => [u * len, -hw(u)]), [len, 0], ...U.slice().reverse().map((u) => [u * len, hw(u)])];
    // the brass edge: the outline in by `rim` (each edge moved in, the corners where the moved edges meet)
    const n = O.length, I = O.map((_, k) => {
      const a = O[(k + n - 1) % n], b = O[k], d = O[(k + 1) % n];
      const nIn = (p, q2) => { const e = P2.sub(q2, p), l = P2.len(e); return [-e[1] / l, e[0] / l]; };
      const n1 = nIn(a, b), n2 = nIn(b, d), m = P2.add(n1, n2), ml = P2.len(m), cos = (m[0] * n1[0] + m[1] * n1[1]) / ml;
      return P2.add(b, P2.mul([m[0] / ml, m[1] / ml], T.rim / Math.max(0.35, cos)));
    });
    const lift0 = extra.petal?.[q] ?? 0, flare = blend3(T.flare, c);
    const pos = ([sv, x], o) => { const r = Math.max(0.2, sec(cols, c, Math.max(0, sv), 0)[0]), deg = c + (x / r) * 180 / Math.PI, u = Math.max(0, sv / len); return atRY(deg, ...sec(cols, deg, Math.max(0, sv), lift0 + flare * u * u + o), z0); };
    const part = `petal${q}`, V = (p, sv) => { const v = G.vert(p, part); G.u[v] = Math.max(0, Math.min(1, sv / len)); return v; };
    G.tag = part;
    const h = U.length;   // the outline: left side 0..h-1, the tip h, the right side h+1..2h (from the tip back to the root)
    const L = (k) => k;
    const o = O.map((p) => V(pos(p, T.t), p[0])), b = O.map((p) => V(pos(p, 0), p[0]));
    // the mail inside the brass edge: courses across the tab `course` apart down it, each a ridge (its top on the tab, its
    // crest `d` out, falling to the next course's top), cut across into links, `links` columns each side of the midrib:
    // the crest high at one column and low at the next, every other course the other way, so each course reads as a row of
    // rings (the chain set's mail, chainmail.mjs mailShell); the midrib smooth, a little raised
    const side = [...Array.from({ length: h }, (_, k) => I[L(k)]), I[h]];
    const xIn = (sv) => { if (sv <= side[0][0]) return -side[0][1]; for (let k = 0; k + 1 < side.length; k++) if (sv <= side[k + 1][0]) { const t = (sv - side[k][0]) / (side[k + 1][0] - side[k][0]); return -(side[k][1] + (side[k + 1][1] - side[k][1]) * t); } return 0; };
    const s0 = side[0][0], s1 = I[h][0], K = Math.max(2, Math.round((s1 - s0) / T.course)), Hc = (s1 - s0) / K, NL = T.links;
    const rows = [];
    for (let k = 0; k < K; k++) {
      rows.push({ kind: 'top', s: () => s0 + k * Hc, off: () => T.t });
      rows.push({ kind: 'crest', s: (j) => s0 + k * Hc + (1 - (((j + k) & 1) === 0 ? 0.75 : 0.2)) * Hc, off: () => T.t + T.d });
    }
    const tip = V(pos(I[h], T.t), I[h][0]);
    const grid = rows.map((r) => Array.from({ length: 2 * NL + 1 }, (_, c2) => {
      const j = c2 - NL, sv = r.s(j);
      return j === 0 ? V(pos([sv, 0], T.t + T.rib), sv) : V(pos([sv, (j / NL) * xIn(sv)], r.off(j)), sv);
    }));
    grid.push(Array.from({ length: 2 * NL + 1 }, () => tip));
    for (let r = 0; r + 1 < grid.length; r++) for (let c2 = 0; c2 < 2 * NL; c2++) G.poly([grid[r][c2], grid[r][c2 + 1], grid[r + 1][c2 + 1], grid[r + 1][c2]], rows[r].kind === 'top' ? 'plate' : 'shade', part);
    // the brass edge: the outline's top zipped to the mail's edge (both loops by t: down the left side 0 to 1 at the tip,
    // up the right side to 2, across the root back to 3)
    const outer = O.map((p, k) => [k <= h ? (k === h ? 1 : p[0] / len) : 2 - p[0] / len, o[k]]);
    const inner = [...rows.map((r, ri) => [r.s(-NL) / len, grid[ri][0]]), [1, tip], ...rows.map((r, ri) => [2 - r.s(NL) / len, grid[ri][2 * NL]]).reverse(), ...Array.from({ length: 2 * NL - 1 }, (_, k) => [2 + (k + 1) / (2 * NL), grid[0][2 * NL - 1 - k]])];
    {
      const A = [...outer, [outer[0][0] + 3, outer[0][1]]], B = [...inner, [inner[0][0] + 3, inner[0][1]]];
      let ia = 0, ib = 0;
      while (ia + 1 < A.length || ib + 1 < B.length) {
        if (ib + 1 >= B.length || (ia + 1 < A.length && A[ia + 1][0] <= B[ib + 1][0])) { G.poly([A[ia][1], A[ia + 1][1], B[ib][1]], 'rune', part); ia++; }
        else { G.poly([A[ia][1], B[ib + 1][1], B[ib][1]], 'rune', part); ib++; }
      }
    }
    // its thickness round the outline (the dark lining: a dark line under the brass edge, whatever the mail's metal), and its underside (iron), split down the middle
    const mb = Array.from({ length: h }, (_, k) => V(pos([O[L(k)][0], 0], 0), O[L(k)][0])), RB = (k) => 2 * h - k;
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; G.poly(k === n - 1 ? [o[k2], o[k], b[k], mb[0], b[k2]] : [o[k2], o[k], b[k], b[k2]], 'under', part); }
    for (let k = 0; k + 1 < h; k++) { G.poly([b[RB(k)], b[RB(k + 1)], mb[k + 1], mb[k]], 'shade', part); G.poly([mb[k], mb[k + 1], b[L(k + 1)], b[L(k)]], 'shade', part); }
    G.poly([b[RB(h - 1)], b[h], mb[h - 1]], 'shade', part); G.poly([mb[h - 1], b[h], b[L(h - 1)]], 'shade', part);
    G.petals.push({ q, c, layer, part, root: pos([0, 0], 0), tip: pos([len, 0], 0) });
  }
  orient(G, (p) => [p[0], 0, p[2] - z0]);
  G.tris = trisOf(G);
  return G;
}

/** The parts of the shawl that cross what is under it (`under`, at rest) or one another: { part: count }. */
export function crossings(G, under) {
  const out = {}, T = G.tris;
  for (const m of under) for (const [a] of crossPairs(G.verts, T, m.verts, m.tris)) { const p = G.polys[T[a].poly].part; out[p] = (out[p] ?? 0) + 1; }
  for (const [a, b] of crossPairs(G.verts, T)) {
    const pa = G.polys[T[a].poly].part, pb = G.polys[T[b].poly].part;
    if (pa === pb) continue;
    const k = `${pa}×${pb}`; out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Built clear: the collar out and each tab lifted a step at a time (the odd ones over the even, the collar's crossings
 * the collar's) until nothing at rest crosses what is under it (the body and `under`) or another part.
 */
export function buildClear(rig, D = DESIGN[rig.who], under = underOf(rig.who)) {
  const extra = { collar: 0, petal: {} }, body = { verts: rig.B.verts, tris: rig.B.tris };
  for (let it = 0; it < 40; it++) {
    const G = buildChainShawl(rig, D, { under, extra }), x = crossings(G, [body, ...under]);
    const keys = Object.keys(x);
    if (!keys.length) { G.extra = extra; return G; }
    let moved = false;
    for (const k of keys) {
      const parts = k.split('×'), top = parts.length === 1 ? parts[0] : parts.sort((a, b) => rank(b) - rank(a))[0];
      if (top === 'collar') { extra.collar += 0.01; moved = true; } else { const q = +top.slice(5); extra.petal[q] = (extra.petal[q] ?? 0) + 0.01; moved = true; }
    }
    if (!moved) break;
  }
  const G = buildChainShawl(rig, D, { under, extra });
  G.extra = extra; G.left = crossings(G, [body, ...under]);
  return G;
}
/** Which of two crossing parts gives way: the tab over the collar, the odd tab over the even. */
const rank = (part) => (part === 'collar' ? 0 : 1 + (+part.slice(5) % 2));

/* ---- weights ---------------------------------------------------------------------------------------------------------- */
/** The body's weights at the closest point of its skin to p, by bone name, each taken by `map` (a name, or [[name, share]]). */
function bodyAt(rig, p, map) {
  const { B } = rig, c = closestOnBody(B.verts, B.tris, p), o = {};
  B.tris[c.tri].v.forEach((vi, k) => { for (const [b, w] of rig.vw[vi]) { const m = map(rig.bones[b].name); for (const [n, x] of typeof m === 'string' ? [[m, 1]] : m) o[n] = (o[n] ?? 0) + w * c.w[k] * x; } });
  return o;
}
const mix = (a, b, t) => { const o = {}; for (const [k, x] of Object.entries(a)) o[k] = (o[k] ?? 0) + x * (1 - t); for (const [k, x] of Object.entries(b)) o[k] = (o[k] ?? 0) + x * t; return o; };
const smoothstep = (x) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
/**
 * The collar on the body under its foot (each column's), taken onto spine_03 and the clavicles (an arm's bones onto its
 * clavicle), its top `collarNeck` of the way onto neck_01, so it turns a little with the head. Each tab from its root
 * on the collar's weights there to, past `rootTo` of the way down it, the body's at the closest point of its skin (as
 * the hauberk under it moves: the head and the neck taken onto spine_03), smoothed `smooth` times along its edges.
 */
export function chainShawlWeights(rig, G, { collarNeck = G.design.collarNeck ?? 0.3, rootTo = G.design.rootTo ?? 0.35, smooth = G.design.smooth ?? 4 } = {}) {
  const z0 = G.design.z0, C = G.collar;
  const fin = (w) => { const l = Object.entries(w).filter(([, x]) => x > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4), t = l.reduce((a, [, x]) => a + x, 0); return l.map(([k, x]) => [rig.at.get(k), x / t]); };
  const azOf = (p) => Math.atan2(p[0], p[2] - z0) * 180 / Math.PI;
  // (the collar's weights at azimuth a, every 5 degrees: the body's under the collar's foot nearest it)
  const foot = new Map(), trunk = (nm) => { const s = nm.match(/_(l|r)$/)?.[1]; return /^clavicle_[lr]$/.test(nm) ? nm : s && /^(upperarm|lowerarm|hand|shoulder|elbow|wrist)/.test(nm) ? `clavicle_${s}` : 'spine_03'; };
  const footOf = (deg) => {
    const a = (Math.round(deg / 5) * 5 + 360) % 360;
    if (!foot.has(a)) {
      const v = C.Fi.reduce((best, k) => { const d = Math.abs(((azOf(G.verts[k]) - a + 540) % 360) - 180); return d < best[0] ? [d, k] : best; }, [Infinity, -1])[1], f = G.verts[v];
      foot.set(a, bodyAt(rig, [f[0], f[1] - 0.1, f[2]], trunk));
    }
    return foot.get(a);
  };
  const skinW = transferWeights(rig, G, { map: (nm) => (/^(head|jaw|neck_0[12])$/.test(nm) ? 'spine_03' : nm), smooth, only: (i) => G.part[i] !== 'collar' });
  const ys = G.verts.filter((_, i) => G.part[i] === 'collar').map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return G.verts.map((p, i) => {
    if (G.part[i] === 'collar') return fin(mix(footOf(azOf(p)), { neck_01: 1 }, collarNeck * (p[1] - y0) / (y1 - y0)));
    const own = Object.fromEntries(skinW[i].map(([bn, x]) => [rig.bones[bn].name, x]));
    return fin(mix(footOf(azOf(p)), own, smoothstep(G.u[i] / rootTo)));
  });
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildClear(rig);
    G.vw = chainShawlWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowchainshawl-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/chainshawl.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, lifted ${JSON.stringify(G.extra)}${G.left && Object.keys(G.left).length ? ', still crossing ' + JSON.stringify(G.left) : ''}: wrote`, file.pathname);
  }
}
