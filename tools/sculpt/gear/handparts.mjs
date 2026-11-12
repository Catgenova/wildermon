// The parts the Runecut hand tools are made of (tools/sculpt/gear/hammer.mjs, mallet.mjs, chisel.mjs, hatchet.mjs,
// butchering_knife.mjs): the same family as the long sword, the Runestone Warhammer and the Runestone Pickaxe, at a
// hand tool's size and budget.
//
//   partsOf(G) -> P (a point, its glow alpha), F (a face, turned to look out), oct / ring (eight-sided sections),
//   tube (rings joined), cap, medallion (a gold ring round a disc and a star), star, diamond, line (a rune stroke),
//   crack (a hairline vein over the stone), grain (a wood grain line), glowDisc (an added glow, its rim's alpha nothing)
//
// Game units, the tool's own frame as tools/sculpt/lowgear.mjs gearAsset writes it: y along the handle from its butt
// toward the head (toward the thumb of the fist on it), x the way the blow goes (a face looks down +x, an edge leads
// along +x), z = x × y. One palette for all five (MATS_PLAIN, MATS_ENCHANTED), the pickaxe's stone and gold and the
// warhammer's wood; the working part's stone in the item's metal (lowgear.mjs metalFaces, metalMats).

import { metalMats } from '../lowgear.mjs';

export const MATS_PLAIN = {
  stone: { c: '#dcc8bd', vary: 0.035 },
  stoneL: { c: '#e6d5ca', vary: 0.03 },
  stoneB: { c: '#d0bbb0', vary: 0.035 },
  bevel: { c: '#c0a59a', vary: 0.03 },
  crack: { c: '#b39588' },
  gold: { c: '#d49a4f' },
  goldD: { c: '#b98238' },
  wood: { c: '#a8693f', vary: 0.03 },
  wood2: { c: '#935a36', vary: 0.03 },
  grain: { c: '#74401f' },
  // the mallet's head: a paler wood across the grain, its ends the end grain
  head: { c: '#cba68c', vary: 0.03 },
  head2: { c: '#b99579', vary: 0.03 },
  endgrain: { c: '#d9bfa6' },
  core: { c: '#c9b28a' },
  star: { c: '#e2cfa4' },
  gem: { c: '#d4b47a' },
  rune: { c: '#9a8c94' },
  glow: { c: '#ff9a35', glow: 1 },
};
/** The working part's stone, drawn in the item's metal (`metalFaces`). */
export const METAL = ['stone', 'stoneL', 'stoneB', 'bevel', 'crack'];
Object.assign(MATS_PLAIN, metalMats(MATS_PLAIN, METAL));
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  rune: { c: '#ffa83a', emit: true },
  core: { c: '#ff9f38', emit: true },
  star: { c: '#fff6d8', emit: true },
  gem: { c: '#ffa847', emit: true },
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** A point of a plane: centre c, its axes u and v, out along n by h. */
const on = (c, u, v, n, a, b, h = 0) => add(add(add(c, mul(u, a)), mul(v, b)), mul(n, h));

export function partsOf(G) {
  G.A ??= [];
  const P = (q, a) => { const i = G.p(q); if (a !== undefined) G.A[i] = a; return i; };
  /** A face (repeated corners dropped), turned to look along `out` (a direction, or { from: a point it looks away from }). */
  const F = (v, mat, out) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out); };
  /** An eight-sided section in a plane (centre c, axes u, v): half-sizes a along u and b along v, its corners cut by k. */
  const oct = (c, u, v, a, b, k) => [[a - k, b], [a, b - k], [a, -b + k], [a - k, -b], [-a + k, -b], [-a, -b + k], [-a, b - k], [-a + k, b]].map(([s, t]) => P(on(c, u, v, [0, 0, 0], s, t)));
  /** A section square across the y axis at height y: half-width s along x, s·zk along z, corners cut by k. */
  const ring = (y, s, k = s * 0.586, zk = 1, x0 = 0, z0 = 0) => oct([x0, y, z0], [1, 0, 0], [0, 0, 1], s, s * zk, k);
  /** Rings joined in order, each band's faces a material by (band, side); each face looks away from the axis point between. */
  const tube = (rings, mat, axis = null) => {
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1], n = a.length;
      const mid = axis ? axis(i) : mul([...a, ...b].reduce((s, q) => add(s, G.V[q]), [0, 0, 0]), 1 / (2 * n));
      for (let j = 0; j < n; j++) F([a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]], typeof mat === 'function' ? mat(i, j) : mat, { from: mid });
    }
  };
  /** A ring closed, looking along `dir`. */
  const cap = (r, mat, dir) => F([...r], mat, dir);
  /**
   * A medallion on a face (centre c, its plane's axes u, v, out along n): a gold frame, eight-sided, from radius ro in to
   * ri, raised by h; inside it a disc (`disc`) and an eight-point star (`starMat`) over it; `starR` [long, short, inner].
   */
  const medallion = (c, u, v, n, ro, ri, h, disc = 'core', starR = null, starMat = 'star', wall = false) => {
    const at = (r, hh, j) => { const t = (j + 0.5) * Math.PI / 4; return P(on(c, u, v, n, r * Math.cos(t), r * Math.sin(t), hh)); };
    const o0 = wall ? [...Array(8).keys()].map((j) => at(ro, 0, j)) : null, o1 = [...Array(8).keys()].map((j) => at(wall ? ro * 0.96 : ro, h, j)), i1 = [...Array(8).keys()].map((j) => at(ri, h, j)), i0 = [...Array(8).keys()].map((j) => at(ri, h * 0.45, j));
    for (let j = 0; j < 8; j++) {
      const j1 = (j + 1) % 8, tt = (j + 1) * Math.PI / 4;
      if (wall) F([o0[j], o0[j1], o1[j1], o1[j]], 'goldD', { from: on(c, u, v, n, 0, 0, -ro) });
      F([o1[j], o1[j1], i1[j1], i1[j]], 'gold', n);
      F([i1[j], i1[j1], i0[j1], i0[j]], 'goldD', { from: on(c, u, v, n, 3 * ri * Math.cos(tt), 3 * ri * Math.sin(tt), h) });
    }
    F(i0, disc, n);
    if (starR) star(on(c, u, v, n, 0, 0, h * 0.45 + 0.004), u, v, n, starR[0], starR[1], starR[2], starMat);
  };
  /** An eight-point star (a fan from its middle, raised a hair): the long points along u and v, the short between. */
  const star = (c, u, v, n, rl, rs, ri, mat = 'star') => {
    const m = P(on(c, u, v, n, 0, 0, 0.004)), pts = [];
    for (let j = 0; j < 16; j++) { const t = j * Math.PI / 8, r = j % 2 ? ri : j % 4 === 0 ? rl : rs; pts.push(P(on(c, u, v, n, r * Math.cos(t), r * Math.sin(t)))); }
    for (let j = 0; j < 16; j++) F([m, pts[j], pts[(j + 1) % 16]], mat, n);
  };
  /** A four-point star (fewer triangles, for the small faces). */
  const star4 = (c, u, v, n, rl, ri, mat = 'star') => {
    const m = P(on(c, u, v, n, 0, 0, 0.004)), pts = [];
    for (let j = 0; j < 8; j++) { const t = j * Math.PI / 4, r = j % 2 ? ri : rl; pts.push(P(on(c, u, v, n, r * Math.cos(t), r * Math.sin(t)))); }
    for (let j = 0; j < 8; j++) F([m, pts[j], pts[(j + 1) % 8]], mat, n);
  };
  /** A diamond: an outline of width w round half-sizes a (along u) and b, and its centre. */
  const diamond = (c, u, v, n, a, b, w, mat = 'rune') => {
    const pt = (s, t, k) => P(on(c, u, v, n, s * k, t * k));
    const out = [[a, 0], [0, b], [-a, 0], [0, -b]], ki = 1 - w / Math.min(a, b);
    const O = out.map(([s, t]) => pt(s, t, 1)), I = out.map(([s, t]) => pt(s, t, ki));
    for (let j = 0; j < 4; j++) F([O[j], O[(j + 1) % 4], I[(j + 1) % 4], I[j]], mat, n);
    F(out.map(([s, t]) => pt(s, t, 0.32)), mat, n);
  };
  /** A rune stroke from (s0, t0) to (s1, t1) in the plane, width w, its ends pointed. */
  const line = (c, u, v, n, s0, t0, s1, t1, w, mat = 'rune') => {
    const ds = s1 - s0, dt = t1 - t0, l = Math.hypot(ds, dt), ns = -dt / l * w / 2, nt = ds / l * w / 2, es = ds / l * w, et = dt / l * w;
    F([P(on(c, u, v, n, s0 - es, t0 - et)), P(on(c, u, v, n, s0 + ns, t0 + nt)), P(on(c, u, v, n, s1 + ns, t1 + nt)), P(on(c, u, v, n, s1 + es, t1 + et)), P(on(c, u, v, n, s1 - ns, t1 - nt)), P(on(c, u, v, n, s0 - ns, t0 - nt))], mat, n);
  };
  /** A hairline vein over the stone through points (s, t) of the plane, width w. */
  const crack = (c, u, v, n, pts, w = 0.012, mat = 'crack') => {
    for (let j = 0; j + 1 < pts.length; j++) {
      const [s0, t0] = pts[j], [s1, t1] = pts[j + 1], l = Math.hypot(s1 - s0, t1 - t0), ns = -(t1 - t0) / l * w / 2, nt = (s1 - s0) / l * w / 2;
      F([P(on(c, u, v, n, s0 - ns, t0 - nt, 0.002)), P(on(c, u, v, n, s0 + ns, t0 + nt, 0.002)), P(on(c, u, v, n, s1 + ns, t1 + nt, 0.002)), P(on(c, u, v, n, s1 - ns, t1 - nt, 0.002))], mat, n);
    }
  };
  /** A glow disc added over a face, bright `a` at its middle, nothing at its rim. */
  const glowDisc = (c, u, v, n, ra, rb, a, k = 10) => {
    const m = P(on(c, u, v, n, 0, 0, 0.006), a), rim = [...Array(k).keys()].map((j) => P(on(c, u, v, n, ra * Math.cos(j * 2 * Math.PI / k), rb * Math.sin(j * 2 * Math.PI / k), 0.006), 0));
    for (let j = 0; j < k; j++) F([m, rim[j], rim[(j + 1) % k]], 'glow', n);
  };
  /**
   * The line's small medallion (the hand tools' and the pommels', as tools-b's awl and file have it): a six-sided gold ring
   * standing off a face (centre c, across it u, up it y, out of it n), its disc inside (`disc`), a four-point star on it.
   */
  const medal = (c, u, n, ro, ri, disc = 'core') => {
    const h = ro * 0.22, pt = (rad, a, off) => [c[0] + u[0] * rad * Math.cos(a) + n[0] * off, c[1] + u[1] * rad * Math.cos(a) + rad * Math.sin(a) + n[1] * off, c[2] + u[2] * rad * Math.cos(a) + n[2] * off];
    const ring6 = (rad, off) => [...Array(6).keys()].map((j) => P(pt(rad, (120 + j * 60) * Math.PI / 180, off)));
    const ob = ring6(ro, -0.01), ot = ring6(ro, h), it = ring6(ri, h), dc = ring6(ri, h * 0.85);
    for (let j = 0; j < 6; j++) {
      const j1 = (j + 1) % 6;
      F([ob[j], ob[j1], ot[j1], ot[j]], 'goldD', { from: c });
      F([ot[j], ot[j1], it[j1], it[j]], 'gold', n);
    }
    F(dc, disc, n);
    star4(pt(0, 0, h * 0.85 + 0.002), u, [0, 1, 0], n, ri * 0.95, ri * 0.32);
    return pt(0, 0, h);
  };
  return { P, F, oct, ring, tube, cap, medallion, medal, star, star4, diamond, line, crack, glowDisc };
}

/**
 * The haft of a hand tool, up the y axis: eight-sided rings from its butt to where it enters the head, with the line's
 * gold collars and a straight-grained wooden grip. `rings`: [y, half-width, material of the band above it]; the wood's
 * bands two tones round, its grain a thin line down the front and back. Returns the rings.
 */
export function haftOf(parts, rings, o = {}) {
  const { ring, tube, cap, F, P } = parts;
  const R = rings.map(([y, s]) => ring(y, s, s * (o.cut ?? 0.586), o.zk ?? 1));
  tube(R, (i, j) => { const m = rings[i][2]; return m === 'wood' ? (j % 2 ? 'wood2' : 'wood') : m; }, (i) => [0, (rings[i][0] + rings[i + 1][0]) / 2, 0]);
  if (o.foot) cap(R[0], o.foot, [0, -1, 0]);
  if (o.top) cap(R[R.length - 1], o.top, [0, 1, 0]);
  // the grain: a thin dark line down the wood's front and back (+z, -z), and its sides
  for (let i = 0; i + 1 < rings.length; i++) {
    if (rings[i][2] !== 'wood' || !o.grain) continue;
    const [y0, s0] = rings[i], [y1, s1] = rings[i + 1], w = 0.012;
    for (const [ax, sd, off] of [['z', 1, 0.3], ['z', -1, -0.25], ['x', 1, -0.2], ['x', -1, 0.35]]) {
      const at = (o2, y, s) => (ax === 'z' ? [o2 * s, y, sd * s * (o.zk ?? 1) + sd * 0.002] : [sd * s + sd * 0.002, y, o2 * s]);
      F([P(at(off - w / s0, y0 + 0.04, s0)), P(at(off + w / s0, y0 + 0.04, s0)), P(at(off * 0.7 + w / s1, y1 - 0.04, s1)), P(at(off * 0.7 - w / s1, y1 - 0.04, s1))], 'grain', ax === 'z' ? [0, 0, sd] : [sd, 0, 0]);
    }
  }
  return R;
}

/**
 * The line's pommel (as the awl's, the file's and the pickaxe's): an eight-sided pale-stone block, bevelled at both ends,
 * a gold-ringed star medallion on each broad face (six-sided, standing off the face: its disc the gem, its star four
 * long points), and over it the gold collar, stepped in to the wood (radius r, its depth r·zkWood). o: { pr (the block's
 * half-width), pt (its height), r, y0 (its foot), dir (1 up the handle from y0, -1 down it: the chisel's struck top),
 * faces ('z' or 'x': which faces are broad and carry the medallions), zk (the block's depth over its width), zkWood }.
 * Returns { wood (the y the wood starts at), glow () (its glow, enchanted: call it after the plain mesh) }.
 */
export function pommelOf(parts, o) {
  const { ring, tube, cap, glowDisc } = parts;
  const pr = o.pr, pt = o.pt, r = o.r, y0 = o.y0 ?? 0, dir = o.dir ?? 1, zk = o.zk ?? 0.9, zw = o.zkWood ?? 1, X = o.faces === 'x';
  // a ring of the block: its broad faces across z (the default) or across x
  const rg = (y, s, k, d = zk) => (X ? parts.oct([0, y, 0], [1, 0, 0], [0, 0, 1], s * d, s, k) : ring(y, s, k, d));
  const at = (h) => y0 + dir * h;
  const rc = r * 1.14;
  const R = [rg(at(0), pr * 0.6, pr * 0.18), rg(at(0.05), pr, pr * 0.3), rg(at(pt - 0.05), pr, pr * 0.3), rg(at(pt - 0.012), rc, rc * 0.34), rg(at(pt + 0.05), rc, rc * 0.34), ring(at(pt + 0.05), r, r * 0.586, zw)];
  // (the broad faces: 3 and 7 across z, 1 and 5 across x; the narrow 1 and 5, or 3 and 7)
  const broad = (j) => (X ? j === 1 || j === 5 : j === 3 || j === 7);
  tube(R.slice(0, 4), (i, j) => (i === 1 ? (broad(j) ? 'stone' : j % 2 ? 'stoneL' : 'stoneB') : 'bevel'));
  tube(R.slice(3), (i) => (i === 0 ? 'gold' : 'goldD'));
  cap(R[0], 'bevel', [0, -dir, 0]);
  // the medallions
  const yc = at(pt / 2), ro = pr * 0.62, ri = pr * 0.46;
  const faces = [1, -1].map((sd) => ({ n: X ? [sd, 0, 0] : [0, 0, sd], u: X ? [0, 0, -sd] : [sd, 0, 0], c: X ? [sd * pr * zk, yc, 0] : [0, yc, sd * pr * zk] }));
  const tops = faces.map(({ n, u, c }) => parts.medal(c, u, n, ro, ri, 'gem'));
  return {
    wood: at(pt + 0.05),
    glow: () => faces.forEach(({ n, u }, k) => glowDisc(tops[k].map((v, i) => v + n[i] * 0.02), u, [0, 1, 0], n, pr * 1.5, pr * 1.5, 0.42, 8)),
  };
}

/**
 * The size the tools are drawn at (the work clip's grip convention, revised so they read at game zoom, as the game's props
 * are drawn a little over life size): each is laid out at its life size, the mallet's reach from the fist to its face
 * 2.15, and scaled whole so that reach is 2.95 (d = contact − lead = [0.75, 2.85, 0]); the chisel so its struck top is
 * 2.4 from its edge.
 */
export const GROW = 2.85 / 2.07, GROW_CHISEL = 2.4 / 1.9;
/** The long striking tools' fists: the haft slanted across the palm, its head end toward the knuckles (lowgear.mjs fitFist). */
export const STRIKE_FIT = { tilt: 35 };
/** A built tool scaled whole by k: its points, its length, its grip, its contact (and the chisel's cutting edge). */
export function grown(t, k) {
  for (const v of t.G.V) for (let i = 0; i < 3; i++) v[i] *= k;
  const g = t.grip, sc = (p) => p && p.map((x) => x * k);
  Object.assign(g, { lead: sc(g.lead), second: sc(g.second), radius: g.radius * k, from: g.from * k, to: g.to * k });
  return { ...t, L: t.L * k, contact: sc(t.contact), ...(t.cut ? { cut: sc(t.cut) } : {}) };
}

/** The tool's own frame and points for the asset (gearAsset), written to src/sculpt/assets/<id>.json. */
export async function writeTool(id, build, extra = () => ({})) {
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const out = resolve(at < 0 ? new URL(`../../../src/sculpt/assets/${id}.json`, import.meta.url).pathname : args[at + 1]);
  const plain = build({}), lit = build({ enchanted: true });
  const asset = await gearAsset(id, plain, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (v) => v.map((x) => +x.toFixed(5));
  asset.units = 'game units; its own frame: y along the handle from its butt (0) toward the head, toward the thumb of the fist on it; x the way the blow goes (the striking face or the edge looks down +x); z = x × y';
  asset.contact = r5(plain.contact);
  asset.reach = +Math.hypot(...plain.contact.map((c, k) => c - plain.grip.lead[k])).toFixed(5);
  Object.assign(asset, extra(plain));
  writeFileSync(out, JSON.stringify(asset));
  console.log(`wrote ${out}: ${asset.counts.tris} triangles (${asset.counts.glowTris} more of glow), ${asset.mats.length} materials, ${plain.L.toFixed(3)} long; lead ${plain.grip.lead[1].toFixed(3)}, contact ${asset.contact.join(', ')} (d ${plain.contact.map((c, k) => (c - plain.grip.lead[k]).toFixed(3)).join(', ')}, reach ${asset.reach})`);
  return asset;
}
