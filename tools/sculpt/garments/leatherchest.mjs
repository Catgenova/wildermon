// The chest & arms of the leather set (the user's chest sheet, tools/sculpt/ref/leather-chest.png; worn in the leather
// lineups): a layered leather cuirass, its chest core crossed by diagonal layered plates with the ring-and-stripes emblem
// on the left breast, side panels laced with X stitches, a back core with a raised panel, a belt round the waist pointed
// at the front and the back, skirt plates over the hips (a tongue at the front and the back, three plates a side in two
// tiers), a high stand collar open at the throat, three-tier pauldrons (a cap with its zig-zag trim and two lames),
// fitted base sleeves to just under the elbow, bracers on the forearms with their rune band, and a band at the wrist. His
// structured, hers fitted. Worn over bare skin (the lineup's): the body's polygons it covers whole are hidden (`hides`).
//
//   buildLeatherChest(rig, design?) → { verts, polys: [{ v, mat, part, tag, piece? }], tris, part, wt, design, hides }
//   leatherChestWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only: the armour has none of its own)
//
//   node tools/sculpt/garments/leatherchest.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowleatherchest-male.json and -female.json
//     (lowgarment.mjs garmentAsset, with `hides` and the `plain` and `enchanted` looks; loaded by src/sculpt/lowpoly.ts)
//
// Every plate is rigid: all its vertices carry one weight list (one bone, or a fixed share of two at a joint), so it never
// stretches; plates at a joint overlap, the upper one outside, so no gap opens as the joint bends. Only the base sleeve (the
// arm's own rings, pushed out) is skinned as the skin under it.
//
// A plate is a grid of points (rows down, columns round) on a section of the body: each point the body's reach in its
// column's direction plus the row's clearance, pushed out over the body and the plates under it (fitOut). Its face is the
// grid; round its border a raised strip (out by `w` and up by `h`: 'trim' in the trim colour, 'bevel' in the plate's own)
// and the plate's edge (down by `t`, the leather's thickness, behind it), or the edge alone, or nothing where the border is
// tucked under another plate. Decals (the emblem, the lacing, the rune band, the zig-zag, rivets) lie on the plates.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { meshOf, orient, trisOf, closestOnTri, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { TORSO_RING } from '../lowarm.mjs';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The leather set's shared materials (every piece of the set uses these names and values, so the game gives each one
 * slot): dark (the darkest leather: the collar's inside), leather (the base sleeves and the collar), light (the plates),
 * trim (the raised trim, the lacing, the rivets), rune (the emblem and the bracers' rune band: the trim's colour plain,
 * glowing enchanted), glow (the glow itself). MATS: each one's colour as the shot tools draw it plain. Read off the
 * chest sheet under the game's light (tools/sculpt/lowleatherchestshot.mjs --only palette).
 */
export const MATS = {
  dark: [0.29, 0.157, 0.129],
  leather: [0.416, 0.224, 0.176],
  light: [0.533, 0.286, 0.22],
  trim: [0.91, 0.518, 0.282],
  rune: [0.91, 0.518, 0.282],
  glow: [0.996, 0.792, 0.427],
};
/** How the set's leather is lit: 2, by the light's brightness only (kind 0, cloth, turned its shadows red-black in the game). */
export const KIND = +(process.env.LEATHER_KIND ?? 2);
/**
 * The two looks: plain, every material lit (kind KIND), the rune the trim's colour; enchanted, the rune unlit at the glow
 * (kind 1, blooming), the rest as plain.
 */
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'glow' ? { c, kind: 1 } : { c, kind: KIND }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'glow' ? { c, kind: 1 } : { c, kind: KIND }])), rune: { c: MATS.glow, kind: 1 } },
};

/**
 * The design per body. Heights are the body's y; az, azimuth round the torso (0 the front, 90 the body's left); θ round a
 * limb (0 forward, 90 out, 180 back); t along a limb's bone from its head. Tables { az, ...lists } are over |az| from the
 * front (0) to the back (180), the piece mirrored. `c` clearances off the body; rim { w, h, t }: the raised strip's width
 * and rise, the leather's thickness. Lines { y0, k } are y = y0 + k x across the chest (x the body's left).
 */
export const DESIGN = {
  male: {
    rim: { w: 0.05, h: 0.035, t: 0.05, in: 0.35 },
    rivet: { r: 0.045, h: 0.03 },
    fit: { trunk: 0.02, belt: 0.025, skirt: 0.05, arm: 0.02, gap: 0.008, stack: 0.03 },
    wedge: 8,
    collar: { reachY: [-0.3, -0.1, 0.05], notch: [12, 1.5], top: { az: [0, 30, 90, 180], top: [-0.16, -0.08, -0.04, 0.0] }, base: [-1.1, -1.0, -0.9], trim: 0.07, c: 0.06, flare: 0.02, wall: 0.06, spread: 0.45, sink: 0.3, shrug: 0.4 },
    core: { az: [0, 14, 28, 40, 43, 62, 80, 96], top: [-0.78, -0.8, -0.86, -0.92, -0.94, -0.95, -1.0, -1.9], bottom: [-3.78, -3.72, -3.64, -3.58, -2.0, -1.95, -1.95, -1.95], rows: [0.0,  0.0833,  0.1667,  0.25,  0.3333,  0.4167,  0.5,  0.5833,  0.6667,  0.75,  0.8333,  0.9167,  1.0], c: 0.02, flat: 14, drape: false },
    back: { az: [96, 112, 116, 130, 150, 165, 180], top: [-1.9, -1.0, -0.85, -0.7, -0.6, -0.56, -0.54], bottom: [-1.95, -1.95, -3.5, -3.55, -3.6, -3.62, -3.64], rows: [0, 0.2, 0.4, 0.6, 0.8, 1], c: 0.02, panel: { top: -0.9, bottom: -2.85, half: 34, tip: -3.15 } },
    side: { az: [38, 60, 80, 100, 120], top: [-1.75, -1.75, -1.8, -1.75, -1.75], bottom: [-3.62, -3.6, -3.58, -3.56, -3.55], rows: [0, 0.33, 0.67, 1], c: 0.018 },
    bands: [{ top: { y0: -1.57, k: 0.21 }, bottom: { y0: -2.13, k: 0.115 }, x: [-1.38, 1.02], lift: 2 }, { top: { y0: -2.13, k: 0.115 }, bottom: { y0: -2.98, k: 0.24 }, x: [-1.3, 0.56], lift: 1 }],
    panels: [{ trace: 'core.low', tag: 'chest', tuck: 4 }, { trace: 'band2', tag: 'band 2', tuck: 4 }, { trace: 'band1', tag: 'band 1', top: 'trim' }],
    emblem: { x: 0.85, y: -1.86, r: 0.27, w: 0.13, stripes: [[-0.07, 0.07], [0.12, 0.2]], bottom: -3.05 },
    lacing: [{ az: -42, y: [-2.05, -3.5], n: 5, w: 0.2 }, { az: 42, y: [-3.05, -3.5], n: 2, w: 0.16 }],
    belt: { az: [0, 30, 60, 90, 120, 150, 180], top: [-3.62, -3.56, -3.5, -3.48, -3.48, -3.5, -3.52], bottom: [-4.26, -4.05, -3.95, -3.92, -3.88, -3.9, -3.98], c: [0.03, 0.04] },
    skirt: {
      top: -3.85, c: 0.04, flare: 0, arm: { az: [58, 122], bottom: -4.3 },
      plates: [
        // (tiers: 'u' over 'l'; columns over |az|; the tongues over the side plates)
        { name: 'skirtL', az: [18, 38, 58], top: -4.55, bottom: [-5.65, -5.7, -5.6], bone: { pelvis: 0.2, thigh_l: 0.8 }, mirror: true },
        { name: 'skirtL', az: [54, 82, 110], top: -4.5, bottom: [-5.55, -5.5, -5.45], bone: { pelvis: 0.45, thigh_l: 0.55 }, mirror: true },
        { name: 'skirtL', az: [106, 135, 164], top: -4.5, bottom: [-5.4, -5.45, -5.4], bone: { pelvis: 0.7, thigh_l: 0.3 }, mirror: true },
        { name: 'skirtU', az: [16, 38, 60], bottom: [-5.05, -5.1, -5.0], bone: { pelvis: 0.35, thigh_l: 0.65 }, mirror: true },
        { name: 'skirtU', az: [56, 84, 112], bottom: [-4.95, -4.9, -4.85], bone: { pelvis: 0.55, thigh_l: 0.45 }, mirror: true },
        { name: 'skirtU', az: [108, 136, 166], bottom: [-4.8, -4.85, -4.8], bone: { pelvis: 0.8, thigh_l: 0.2 }, mirror: true },
        { name: 'skirt.f', az: [-30, -14, 2], bottom: [-5.1, -5.64, -5.1], bone: { pelvis: 0.3, thigh_l: 0.2, thigh_r: 0.5 } },
        { name: 'skirt.f2', az: [0, 16, 32], bottom: [-5.3, -5.33, -5.25], bone: { pelvis: 0.3, thigh_l: 0.5, thigh_r: 0.2 } },
        { name: 'skirt.b', az: [162, 180, 198], bottom: [-5.05, -5.3, -5.05], bone: { pelvis: 0.7, thigh_l: 0.15, thigh_r: 0.15 } },
      ],
    },
    pauldron: {
      lift: 0.1, inset: 0.1, pole: 0.2, near: 1.3, round: 0, inner: 1, cols: 12, phi0: 12, phi: [76, 125, 76, 30], footY: [-1.6, -1.6, -1.6], rows: [0, 0.5, 1], c: [0.05, 0.07, 0.09], cone: 34,
      roof: { from: [0.85, -0.65, -0.05], to: [2.0, -1.8, -0.05], rows: [0, 0.35, 0.7, 1], c: [0.06, 0.1, 0.16, 0.24], th: [-100, 100], cols: 10 },
      strap: { at: [0.22, 0.4], th: [-115, 115], c: 0.17, cols: 10 },
      zig: { f: [0.15, 0.7], n: 3, psi: [-10, 200], cols: [0.0, 0.6] },
      lames: [{ t: [0.42, 0.95], c: [0.14, 0.22], th: [-45, 210] }, { t: [0.8, 1.32], c: [0.1, 0.17], th: [-50, 215] }],
    },
    undershirt: { top: -1.0, az: [0, 60, 120, 180], bottom: [-4.7, -4.7, -5.2, -5.5], belt: -3.7, rows: 9, c: 0.008 },
    sleeve: { rings: [['$torso', 0.02], ['ja', 0.025], ['jb', 0.028], ['ua', 0.028], ['uc', 0.028], ['ue', 0.028], ['el', 0.032], ['fa', 0.032]] },
    bracer: { cols: 8, t: [0.42, 1.48], c: [0.05, 0.035], flare: 0.035, rune: { t: 0.66, r: 0.17, w: 0.05, bar: [0.92, 1.25] } },
    band: { cols: 8, t: [-0.14, 0.06], c: [0.035, 0.045] },
  },
  female: {
    rim: { w: 0.045, h: 0.032, t: 0.045, in: 0.35 },
    rivet: { r: 0.04, h: 0.027 },
    fit: { trunk: 0.018, belt: 0.022, skirt: 0.045, arm: 0.018, gap: 0.007, stack: 0.027 },
    wedge: 8,
    collar: { reachY: [-0.3, -0.1, 0.05], notch: [12, 1.5], top: { az: [0, 30, 90, 180], top: [-0.14, -0.07, -0.03, 0.0] }, base: [-1.05, -0.95, -0.85], trim: 0.06, c: 0.05, flare: 0.018, wall: 0.05, spread: 0.4, sink: 0.27, shrug: 0.35 },
    core: { az: [0, 12, 24, 36, 40, 58, 76, 96], top: [-0.8, -0.81, -0.84, -0.9, -0.92, -0.95, -1.0, -1.85], bottom: [-3.25, -3.2, -3.12, -3.06, -1.95, -1.9, -1.9, -1.9], rows: [0.0,  0.0833,  0.1667,  0.25,  0.3333,  0.4167,  0.5,  0.5833,  0.6667,  0.75,  0.8333,  0.9167,  1.0], c: 0.018, flat: 12, drape: false },
    back: { az: [96, 112, 116, 130, 150, 165, 180], top: [-1.85, -1.0, -0.9, -0.75, -0.66, -0.62, -0.6], bottom: [-1.9, -1.9, -3.0, -3.05, -3.1, -3.12, -3.14], rows: [0, 0.2, 0.4, 0.6, 0.8, 1], c: 0.018, panel: { top: -0.95, bottom: -2.45, half: 34, tip: -2.7 } },
    side: { az: [34, 56, 78, 100, 120], top: [-1.75, -1.75, -1.8, -1.75, -1.75], bottom: [-3.1, -3.08, -3.06, -3.05, -3.04], rows: [0, 0.33, 0.67, 1], c: 0.016 },
    bands: [{ top: { y0: -1.3, k: 0.42 }, bottom: { y0: -1.95, k: 0.45 }, x: [-0.95, 1.15], lift: 2 }, { top: { y0: -1.7, k: 0.45 }, bottom: { y0: -2.7, k: 0.32 }, x: [-0.95, 1.25], lift: 1 }],
    panels: [{ trace: 'core.low', tag: 'chest', tuck: 4 }, { trace: 'band2', tag: 'band 2', tuck: 4 }, { trace: 'band1', tag: 'band 1', top: 'trim' }],
    emblem: { x: 0.5, y: -1.55, r: 0.27, w: 0.07, stripes: [[-0.06, 0.06], [0.1, 0.17]], bottom: -2.6 },
    lacing: [{ az: -38, y: [-1.7, -3.0], n: 5, w: 0.17 }, { az: 38, y: [-2.6, -3.0], n: 2, w: 0.14 }],
    belt: { az: [0, 30, 60, 90, 120, 150, 180], top: [-3.12, -3.06, -3.0, -2.98, -2.98, -3.0, -3.02], bottom: [-3.78, -3.58, -3.48, -3.44, -3.42, -3.45, -3.52], c: [0.025, 0.035] },
    skirt: {
      top: -3.35, c: 0.035, flare: 0, arm: { az: [58, 122], bottom: -3.9 },
      plates: [
        { name: 'skirtL', az: [18, 38, 58], top: -4.0, bottom: [-4.98, -5.02, -4.95], bone: { pelvis: 0.15, thigh_l: 0.85 }, mirror: true },
        { name: 'skirtL', az: [54, 82, 110], top: -3.95, bottom: [-4.9, -4.85, -4.8], bone: { pelvis: 0.4, thigh_l: 0.6 }, mirror: true },
        { name: 'skirtL', az: [106, 135, 164], top: -3.95, bottom: [-4.75, -4.8, -4.75], bone: { pelvis: 0.7, thigh_l: 0.3 }, mirror: true },
        { name: 'skirtU', az: [16, 38, 60], bottom: [-4.45, -4.5, -4.42], bone: { pelvis: 0.3, thigh_l: 0.7 }, mirror: true },
        { name: 'skirtU', az: [56, 84, 112], bottom: [-4.38, -4.34, -4.3], bone: { pelvis: 0.55, thigh_l: 0.45 }, mirror: true },
        { name: 'skirtU', az: [108, 136, 166], bottom: [-4.25, -4.3, -4.25], bone: { pelvis: 0.8, thigh_l: 0.2 }, mirror: true },
        { name: 'skirt.f', az: [-28, -13, 2], bottom: [-4.55, -5.0, -4.55], bone: { pelvis: 0.25, thigh_l: 0.2, thigh_r: 0.55 } },
        { name: 'skirt.f2', az: [0, 15, 30], bottom: [-4.72, -4.75, -4.68], bone: { pelvis: 0.25, thigh_l: 0.55, thigh_r: 0.2 } },
        { name: 'skirt.b', az: [162, 180, 198], bottom: [-4.5, -4.75, -4.5], bone: { pelvis: 0.7, thigh_l: 0.15, thigh_r: 0.15 } },
      ],
    },
    pauldron: {
      lift: 0.08, inset: 0.08, pole: 0.2, near: 1.1, round: 0, inner: 1, cols: 12, phi0: 12, phi: [74, 120, 74, 30], footY: [-1.45, -1.45, -1.45], rows: [0, 0.5, 1], c: [0.04, 0.06, 0.08], cone: 34,
      roof: { from: [0.68, -0.7, -0.12], to: [1.6, -1.8, -0.15], rows: [0, 0.35, 0.7, 1], c: [0.05, 0.08, 0.13, 0.2], th: [-100, 100], cols: 10 },
      strap: { at: [0.22, 0.4], th: [-115, 115], c: 0.14, cols: 10 },
      zig: { f: [0.15, 0.7], n: 3, psi: [-10, 200], cols: [0.0, 0.6] },
      lames: [{ t: [0.36, 0.8], c: [0.11, 0.18], th: [-45, 210] }, { t: [0.68, 1.12], c: [0.08, 0.14], th: [-50, 215] }],
    },
    undershirt: { top: -0.95, az: [0, 60, 120, 180], bottom: [-4.1, -4.1, -4.6, -4.9], belt: -3.2, rows: 9, c: 0.007 },
    sleeve: { rings: [['$torso', 0.018], ['ja', 0.022], ['jb', 0.025], ['ua', 0.025], ['uc', 0.025], ['ue', 0.025], ['el', 0.028], ['fa', 0.028]] },
    bracer: { cols: 8, t: [0.38, 1.36], c: [0.045, 0.03], flare: 0.03, rune: { t: 0.6, r: 0.15, w: 0.045, bar: [0.84, 1.14] } },
    band: { cols: 8, t: [-0.12, 0.05], c: [0.03, 0.04] },
  },
};

/* ---- sections: the convex hull of the body's samples in a slab across an axis ------------------------------------ */
function hull2(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
/** How far from o along d the hull's boundary is (its furthest crossing). */
function rayHull(H, o, d) {
  let best = 0;
  for (let k = 0; k < H.length; k++) {
    const a = H[k], b = H[(k + 1) % H.length], e = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = [a[0] - o[0], a[1] - o[1]], s = (w[0] * e[1] - w[1] * e[0]) / den, t = (w[0] * d[1] - w[1] * d[0]) / den;
    if (s >= 0 && t >= -1e-9 && t <= 1 + 1e-9) best = Math.max(best, s);
  }
  return best;
}
/**
 * A sectioner along an axis: o (a point), a (unit, t along it), e1 (θ 0) and e2 (θ 90), both across a. at(t, θ, c) is
 * the body's reach in the slab |t' - t| < dt in direction θ from the axis (or, `centred`, from the middle of the slab's
 * hull along e1), out by c; the samples S (points).
 */
export function sectioner(S, { o, a, e1, e2, dt = 0.1, centred = false, wedge = 0 }) {
  const proj = S.map((p) => { const d = sub(p, o); return [dot(d, a), dot(d, e1), dot(d, e2)]; });
  const cache = new Map();
  const hull = (t) => {
    const key = Math.round(t * 200);
    if (cache.has(key)) return cache.get(key);
    let pts = [];
    for (let w = dt; pts.length < 6 && w < 1.5; w *= 1.6) pts = proj.filter((q) => Math.abs(q[0] - t) < w).map((q) => [q[1], q[2]]);
    const H = hull2(pts);
    const u0 = centred ? (Math.min(...H.map((q) => q[0])) + Math.max(...H.map((q) => q[0]))) / 2 : 0;
    const out = { H, u0 };
    cache.set(key, out);
    return out;
  };
  const dirOf = (th) => [Math.cos(th * Math.PI / 180), Math.sin(th * Math.PI / 180)];
  // (with `wedge`, the body's own surface: the farthest sample of the slab within `wedge` degrees of the direction, as
  // the tunic reads it, so a plate hugs the body rather than its hull)
  const reachOf = (t, th, u0) => {
    const k = 1 / Math.cos(wedge * Math.PI / 180), ca = Math.cos(wedge * Math.PI / 180), d = dirOf(th);
    let r = 0;
    for (let w = dt; r === 0 && w < 1; w *= 1.6) for (const q of proj) {
      if (Math.abs(q[0] - t) > w) continue;
      const x = q[1] - u0, y = q[2], l = Math.hypot(x, y);
      if (l < 1e-9 || (x * d[0] + y * d[1]) / l < ca) continue;
      r = Math.max(r, l * k);
    }
    return r;
  };
  const at = (t, th, c = 0) => {
    const { H, u0 } = hull(t), d = dirOf(th), r = (wedge ? reachOf(t, th, u0) : rayHull(H, [u0, 0], d)) + c;
    return add(add(o, mul(a, t)), add(mul(e1, u0 + r * d[0]), mul(e2, r * d[1])));
  };
  const axisAt = (t) => { const { u0 } = hull(t); return add(add(o, mul(a, t)), mul(e1, u0)); };
  return { at, axisAt, hull };
}

/**
 * A grid pushed out until no body sample (points S) lies closer than c under its face: for each face triangle, the
 * samples over it (their foot inside it) less than c under it (or above it) move its corners out along its normal by
 * the shortfall; a few passes, each corner moved by the most any of its faces asks.
 */
function fitOut(rows, ring, out, S, c, passes = 4, reach = 0.3) {
  // (S may be layers [[points, clearance], ...]: the body's samples, and the surfaces of the pieces under this one)
  // (the pieces under, after the body: only what lies within `under` in front of a face lifts it, so a piece beside a
  // steep face (a plate's seam over the next one's edge) does not shove the face out)
  if (S.length && Array.isArray(S[0]) && Array.isArray(S[0][0])) { for (let it = 0; it < passes; it++) S.forEach(([P, cc], li) => fitOut(rows, ring, out, P, cc, 1, li === 0 ? reach : Math.min(reach, cc + 0.06))); return; }
  const R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1;
  // (only the samples near the grid: its bounding box grown by the reach and a margin for its moving out)
  { const all = rows.flat(), m = reach + 0.35, lo = [0, 1, 2].map((j) => Math.min(...all.map((p) => p[j])) - m), hi = [0, 1, 2].map((j) => Math.max(...all.map((p) => p[j])) + m);
    S = S.filter((p) => p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1] && p[2] >= lo[2] && p[2] <= hi[2]); }
  // (the samples in cells 0.3 across, so a face looks only at the cells its box touches)
  const CELL = 0.3, cells = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (const p of S) { const k = key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)); (cells.get(k) ?? cells.set(k, []).get(k)).push(p); }
  const near = (lo, hi) => { const o = []; for (let x = Math.floor(lo[0] / CELL); x <= Math.floor(hi[0] / CELL); x++) for (let y = Math.floor(lo[1] / CELL); y <= Math.floor(hi[1] / CELL); y++) for (let z = Math.floor(lo[2] / CELL); z <= Math.floor(hi[2] / CELL); z++) { const l = cells.get(key(x, y, z)); if (l) for (const p of l) o.push(p); } return o; };
  for (let it = 0; it < passes; it++) {
    const need = rows.map((row) => row.map(() => 0)), dir = rows.map((row) => row.map(() => [0, 0, 0]));
    let moved = false;
    for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
      const k1 = (k + 1) % n;
      // (both diagonals of the quad, so the fit holds whichever way it is cut, and the same on either side)
      for (const tri of [[[r, k], [r, k1], [r + 1, k1]], [[r, k], [r + 1, k1], [r + 1, k]], [[r, k], [r, k1], [r + 1, k]], [[r, k1], [r + 1, k1], [r + 1, k]]]) {
        const [a, b, cc] = tri.map(([i, j]) => rows[i][j]);
        let nn = unit(cross(sub(b, a), sub(cc, a)));
        const mid = mul(add(add(a, b), cc), 1 / 3);
        if (dot(nn, out(mid)) < 0) nn = mul(nn, -1);
        const lo = [0, 1, 2].map((j) => Math.min(a[j], b[j], cc[j]) - 0.3), hi = [0, 1, 2].map((j) => Math.max(a[j], b[j], cc[j]) + 0.3);
        for (const p of near(lo, hi)) {
          if (p[0] < lo[0] || p[0] > hi[0] || p[1] < lo[1] || p[1] > hi[1] || p[2] < lo[2] || p[2] > hi[2]) continue;
          const d = dot(sub(p, a), nn);
          if (d < -c || d > reach) continue;
          const [q, w] = closestOnTri(p, a, b, cc);
          if (Math.hypot(...sub(sub(p, q), mul(nn, dot(sub(p, q), nn)))) > 1e-3) continue;
          // (the face lifted at the sample's foot by the shortfall: each corner by its share, the least movement that
          // does it, so a sample near one edge moves that edge's corners)
          const s2 = w[0] * w[0] + w[1] * w[1] + w[2] * w[2], need0 = d + c;
          tri.forEach(([i, j], m) => { const x = (need0 * w[m]) / s2; if (x > need[i][j]) { need[i][j] = x; moved = true; } });
        }
      }
    }
    if (!moved) break;
    // (each corner out along the way out from the body there, by the most any face asked of it)
    rows.forEach((row, i) => row.forEach((p, j) => { if (need[i][j] > 1e-4) row[j] = add(p, mul(unit(out(p)), Math.min(need[i][j], 0.25))); }));
  }
}

/* ---- the plate builder ----------------------------------------------------------------------------------------------- */
/**
 * A plate on G from a grid of points `rows` (R + 1 rows of C + 1 points; `ring`: C points, closed round). Its face the
 * grid's quads (mat(r, c), else `mat`), its border by side (top, bottom, left, right) 'trim' (a raised strip in the trim colour), 'bevel' (in the plate's own colour; either with the
 * edge behind it), 'edge' (the edge alone) or 'open'; every vertex weighted `bone` ({ name: share }). out(p): the way out
 * from the body at p. Returns { faces (its face triangles' points, for laying decals on), N (normals by grid point) }.
 */
function plateOf(G, rows, o) {
  if (o.fit) fitOut(rows, !!o.ring, o.out, o.fit.S, o.fit.c);
  const ring = !!o.ring, R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1, rim = o.rim;
  const tag = o.tag, wt = o.bone, mat = o.mat ?? 'light', faceMat = (r, c) => (o.mat?.call ? o.mat(Math.max(0, Math.min(R - 1, r)), Math.max(0, Math.min(C - 1, c))) : mat);
  // (its weights: `bone` everywhere, or with `boneRow(f)` by row, f 0 at the top to 1 at the foot: leather bends)
  // (or with `boneAt(p)` by the point: down the trunk, the spine's bones in turn)
  const wtOf = (r, p) => (o.boneAt ? o.boneAt(p) : o.boneRow ? o.boneRow(R ? r / R : 0) : wt);
  const V = (p, r = 0) => { const i = G.vert(p, tag); G.wt[i] = wtOf(r, p); return i; };
  const id = rows.map((row, r) => row.map((p) => V(p, r)));
  const P = (r, c) => rows[Math.max(0, Math.min(R, r))][ring ? ((c % n) + n) % n : Math.max(0, Math.min(n - 1, c))];
  const N = rows.map((row, r) => row.map((p, c) => {
    let nn = unit(cross(sub(P(r, c + 1), P(r, c - 1)), sub(P(r + 1, c), P(r - 1, c))));
    if (dot(nn, o.out(p)) < 0) nn = mul(nn, -1);
    return nn;
  }));
  G.tag = tag;
  const faces = [], start = G.polys.length;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const c1 = (c + 1) % n, q = [id[r][c], id[r][c1], id[r + 1][c1], id[r + 1][c]];
    G.poly(q, faceMat(r, c), tag);
    faces.push([rows[r][c], rows[r][c1], rows[r + 1][c1]], [rows[r][c], rows[r + 1][c1], rows[r + 1][c]]);
  }
  // the border: loops of { r, c, sides (of the vertex), seg (the side of the segment from it to the next) }
  const loops = [];
  if (ring) {
    loops.push(Array.from({ length: n }, (_, c) => ({ r: 0, c, sides: ['top'], seg: 'top' })));
    loops.push(Array.from({ length: n }, (_, c) => ({ r: R, c: n - 1 - c, sides: ['bottom'], seg: 'bottom' })));
  } else {
    const L = [];
    for (let c = 0; c < C; c++) L.push({ r: 0, c, sides: c === 0 ? ['top', 'left'] : ['top'], seg: 'top' });
    for (let r = 0; r < R; r++) L.push({ r, c: C, sides: r === 0 ? ['top', 'right'] : ['right'], seg: 'right' });
    for (let c = C; c > 0; c--) L.push({ r: R, c, sides: c === C ? ['bottom', 'right'] : ['bottom'], seg: 'bottom' });
    for (let r = R; r > 0; r--) L.push({ r, c: 0, sides: r === R ? ['bottom', 'left'] : ['left'], seg: 'left' });
    loops.push(L);
  }
  // (a side's kind, or a function of the grid point the segment starts at)
  const kindOf = (s, r, c) => { const k = o.border?.[s] ?? 'trim'; return typeof k === 'function' ? k(r, c) : k; };
  for (const L of loops) {
    const pts = L.map(({ r, c, sides }) => {
      const b = rows[r][c], nn = N[r][c];
      let d = [0, 0, 0];
      for (const s of sides) d = add(d, unit(sub(b, s === 'top' ? P(r + 1, c) : s === 'bottom' ? P(r - 1, c) : s === 'left' ? P(r, c + 1) : P(r, c - 1))));
      d = unit(sub(d, mul(nn, dot(d, nn))));
      const w = rim.w * (o.wScale?.(r, c) ?? 1);
      const up = (k) => k === 'trim' || k === 'bevel';
      const trim = sides.some((s) => up(kindOf(s, r, c)) || (s === 'top' && up(kindOf(s, r, c - 1))) || (s === 'bottom' && up(kindOf(s, r, c + 1))));
      const T = trim ? add(add(b, mul(d, w)), mul(nn, rim.h)) : b;
      // (the edge down behind the face by a share of the leather's thickness, `rim.in`, the rest of it standing above as
      // the raised strip: the plate reads its full thickness at its edge without its back reaching into what is under it)
      const E = add(add(b, mul(d, trim ? w + 0.01 : 0.01)), mul(nn, -rim.t * (rim.in ?? 1)));
      return { b: id[r][c], T, E, r };
    });
    const lazy = (k, key) => { const x = pts[k]; if (x[key + 'i'] == null) x[key + 'i'] = V(x[key], x.r); return x[key + 'i']; };
    for (let k = 0; k < L.length; k++) {
      const j = (k + 1) % L.length, kind = kindOf(L[k].seg, L[k].r, L[k].c);
      if (kind === 'open') continue;
      // (the strip's face in the trim colour or the plate's own, the edge behind it the plate's)
      // (the edge under a plate's foot in the dark leather: the shadow line the sheet draws under each plate)
      const fm = faceMat(L[k].r - (L[k].seg === 'bottom' ? 1 : 0), L[k].c - (L[k].seg === 'right' ? 1 : 0)), em = o.edgeMat ?? (L[k].seg === (o.footSide ?? 'bottom') && o.shadow !== false ? 'dark' : fm);
      if (kind === 'trim' || kind === 'bevel') {
        G.poly([pts[k].b, pts[j].b, lazy(j, 'T'), lazy(k, 'T')], kind === 'trim' ? (o.rimMat ?? 'trim') : fm, tag);
        G.poly([lazy(k, 'T'), lazy(j, 'T'), lazy(j, 'E'), lazy(k, 'E')], em, tag);
      } else {
        G.poly([pts[k].b, pts[j].b, lazy(j, 'E'), lazy(k, 'E')], em, tag);
      }
    }
  }
  piece(G, start, o.out);
  const plate = { faces, N, rows, ring, tag, wt, out: o.out, p0: start, p1: G.polys.length };
  G.plates.push(plate);
  return plate;
}

/** The polygons from `start` on, each connected piece wound consistently and outward (out(centroid), lowgarment.mjs orient). */
const piece = (G, start, out) => orient({ verts: G.verts, polys: G.polys.slice(start) }, out);

/** Points on the polygons from p0 to p1 (their corners and a grid on each triangle about `step` apart). */
function surfOf(G, p0, p1 = G.polys.length, step = 0.07) {
  const out = [];
  for (let k = p0; k < p1; k++) {
    const v = G.polys[k].v;
    for (let j = 1; j + 1 < v.length; j++) {
      const [a, b, c] = [v[0], v[j], v[j + 1]].map((i) => G.verts[i]);
      const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step));
      for (let i = 0; i <= n; i++) for (let jj = 0; jj <= n - i; jj++) { const u = i / n, w = jj / n, x = 1 - u - w; out.push([a[0] * x + b[0] * u + c[0] * w, a[1] * x + b[1] * u + c[1] * w, a[2] * x + b[2] * u + c[2] * w]); }
    }
  }
  return out;
}

/** The closest point on a plate's face to p, and the face's normal there (out). */
function onPlate(pl, p, out) {
  let best = null;
  for (const [a, b, c] of pl.faces) {
    const [q] = closestOnTri(p, a, b, c), d = Math.hypot(...sub(p, q));
    if (!best || d < best.d) { let n = unit(cross(sub(b, a), sub(c, a))); if (dot(n, out) < 0) n = mul(n, -1); best = { d, q, n }; }
  }
  return best;
}
/** A point on a plate's grid at fractional row rf and column cf (bilinear), laid on its face. */
function gridAt(pl, rf, cf) {
  const R = pl.rows.length - 1, n = pl.rows[0].length;
  // (a ring's columns wrap round)
  if (pl.ring) cf = ((cf % n) + n) % n;
  const r0 = Math.max(0, Math.min(R - 1, Math.floor(rf))), c0 = pl.ring ? Math.floor(cf) % n : Math.max(0, Math.min(n - 2, Math.floor(cf))), c1 = pl.ring ? (c0 + 1) % n : c0 + 1;
  const u = rf - r0, v = cf - c0, P = pl.rows;
  const p = lerp(lerp(P[r0][c0], P[r0][c1], v), lerp(P[r0 + 1][c0], P[r0 + 1][c1], v), u);
  const nn = unit(lerp(lerp(pl.N[r0][c0], pl.N[r0][c1], v), lerp(pl.N[r0 + 1][c0], pl.N[r0 + 1][c1], v), u));
  return onPlate(pl, p, nn);
}

/**
 * Rivets on a plate: at each spot [rf, cf] (its rows and columns as fractions, 0 to 1), a stud in the trim's colour:
 * six sides up from its foot (r across) to a flat top (half as wide) h over the face. Weighted wt (a bone share, or a
 * function of the point). D.rivet { r, h } sets the size; none when D.rivet is off.
 */
function rivetsOn(G, D, pl, spots, wt) {
  if (!D.rivet || !pl) return;
  const { r, h } = D.rivet, R = pl.rows.length - 1, n = pl.rows[0].length, C = pl.ring ? n : n - 1;
  for (const [rf, cf] of spots) {
    const at = gridAt(pl, rf * R, cf * C);
    if (!at) continue;
    const nn = at.n, a = unit(cross(nn, Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), b = cross(nn, a), start = G.polys.length;
    const ringAt = (rr, lift) => Array.from({ length: 6 }, (_, k) => { const t = (k / 6) * 2 * Math.PI; const q = add(add(at.q, mul(nn, lift)), add(mul(a, Math.cos(t) * rr), mul(b, Math.sin(t) * rr))); const i = G.vert(q, 'rivet'); G.wt[i] = typeof wt === 'function' ? wt(q) : wt; return i; });
    const foot = ringAt(r, -0.004), top = ringAt(r * 0.55, h);
    G.tag = 'rivet';
    for (let k = 0; k < 6; k++) G.poly([foot[k], foot[(k + 1) % 6], top[(k + 1) % 6], top[k]], 'trim', 'rivet');
    G.poly(top.slice(), 'trim', 'rivet');
    piece(G, start, () => nn);
  }
}
/** An inlay: a strip of width w along points on a plate (each { q, n } from gridAt / onPlate), lifted off its face. */
function inlayOn(G, pl, pts, w, tag, mat = 'rune', lift = 0.022) {
  const V = (q) => { const i = G.vert(q, tag); G.wt[i] = pl.wt; return i; };
  const L = pts.map((h, k) => {
    const tan = unit(sub(pts[Math.min(k + 1, pts.length - 1)].q, pts[Math.max(k - 1, 0)].q)), x = unit(cross(h.n, tan));
    const base = add(h.q, mul(h.n, lift));
    return [V(add(base, mul(x, -w / 2))), V(add(base, mul(x, w / 2)))];
  });
  G.tag = tag;
  const start = G.polys.length;
  for (let k = 0; k + 1 < L.length; k++) G.poly([L[k][0], L[k + 1][0], L[k + 1][1], L[k][1]], mat, tag, true);
  piece(G, start, () => pts[0].n);
}

/** A table's value at azimuth a (its `az` over |a|, 0 the front to 180 the back), linear between its columns. */
export function tabAt(T, key, a) {
  const x = Math.abs(((a + 540) % 360) - 180), A = T.az, V = T[key];
  if (x <= A[0]) return V[0];
  for (let i = 0; i + 1 < A.length; i++) if (x <= A[i + 1]) return V[i] + ((V[i + 1] - V[i]) * (x - A[i])) / (A[i + 1] - A[i]);
  return V[V.length - 1];
}
/* ---- the pieces -------------------------------------------------------------------------------------------------------- */
const AZ = (deg) => deg;
/** A list by column for a symmetric piece ([centre ... side]) laid out from one side through the centre to the other. */
const mirrorCols = (L, neg = (x) => x) => [...L.slice(1).reverse().map(neg), ...L];

/** Where a horizontal ray from o along d (unit, level) meets a grid's face (its furthest crossing), or 0. */
function rayGrid(rows, ring, o, d) {
  const R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1;
  let best = 0;
  for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
    const k1 = (k + 1) % n;
    for (const [a, b, c] of [[rows[r][k], rows[r][k1], rows[r + 1][k1]], [rows[r][k], rows[r + 1][k1], rows[r + 1][k]]]) {
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s0 = sub(o, a), u = f * dot(s0, h); if (u < -1e-6 || u > 1 + 1e-6) continue;
      const q = cross(s0, e1), v = f * dot(d, q); if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = f * dot(e2, q); if (t > best) best = t;
    }
  }
  return best;
}
/**
 * Shingled: each upper plate's foot row pushed out until every plate under it (lower) lies at least `gap` inside it
 * there, down to its rim's edge (`drop` below the foot): the upper plate's edge, turned in by the rim's thickness, then
 * clears the face of the one it overlaps. Radii about the trunk's axis (axisAt).
 */
function shingle(upper, lowers, axisAt, gap, drop) {
  const foot = upper.rows[upper.rows.length - 1];
  foot.forEach((p, j) => {
    const o0 = axisAt(p[1]), d = unit([p[0] - o0[0], 0, p[2] - o0[2]]);
    let need = 0;
    for (const y of [p[1], p[1] - drop / 2, p[1] - drop]) {
      const o = axisAt(y);
      for (const L of lowers) need = Math.max(need, rayGrid(L.rows, L.ring, [o[0], y, o[2]], d) + gap);
    }
    const r = Math.hypot(p[0] - o0[0], p[2] - o0[2]);
    if (need > r) {
      const push = need - r;
      foot[j] = add(p, mul(d, push));
      // (the row above it a share, so the plate keeps its line)
      if (upper.rows.length > 2) { const q = upper.rows[upper.rows.length - 2][j]; upper.rows[upper.rows.length - 2][j] = add(q, mul(d, push * 0.4)); }
    }
  });
}


/* ---- decals: raised strips laid on the outermost plate ---------------------------------------------------------------- */
/** The nearest crossing of a ray (o, d unit) with any of `plates`' faces: { t, pl } or null. */
function rayFirst(plates, o, d) {
  let best = null;
  for (const pl of plates) for (const [a, b, c] of pl.faces) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, s0 = sub(o, a), u = f * dot(s0, h); if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s0, e1), v = f * dot(d, q); if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = f * dot(e2, q);
    if (t > 0 && (!best || t < best.t)) { let n = unit(cross(e1, e2)); if (dot(n, d) > 0) n = mul(n, -1); best = { t, pl, n }; }
  }
  return best;
}
/** A point on the outermost of `plates` seen along d (unit) through p: { q, n, pl }, or null. */
function onTop(plates, p, d) {
  const o = sub(p, mul(d, 6)), h = rayFirst(plates, o, d);
  return h ? { q: add(o, mul(d, h.t)), n: h.n, pl: h.pl } : null;
}
/**
 * A grid laid over plates: each point moved out to the outermost of `plates` along the way in from it (out(p)), out by
 * `gap`, where that lies further out than the point; points over none of them, or already outside, kept.
 */
function layOver(rows, plates, out, gap, smooth = 1) {
  // (each point's lift out along its way out; then each the most of its neighbours' within `smooth` grid steps, so the
  // grid rides over what is under it in one piece rather than stepping down between the plates' edges)
  const lift = rows.map((row) => row.map((p) => {
    const o = unit(out(p)), h = onTop(plates, p, mul(o, -1));
    return h ? Math.max(0, dot(sub(add(h.q, mul(h.n, gap)), p), o)) : 0;
  }));
  rows.forEach((row, r) => row.forEach((p, k) => {
    let m = 0;
    for (let i = Math.max(0, r - smooth); i <= Math.min(rows.length - 1, r + smooth); i++) for (let j = Math.max(0, k - smooth); j <= Math.min(row.length - 1, k + smooth); j++) m = Math.max(m, lift[i][j]);
    if (m > 0) row[k] = add(p, mul(unit(out(p)), m));
  }));
}
/**
 * A raised strip along points (each { q, n } on a surface): its top `h` over the surface, `w` wide (a number or per
 * point), its sides down into the surface; `closed` round. Its vertices weighted `wt`. Returns nothing.
 */
function stripOn(G, pts, w, mat, tag, wt, { h = 0.025, closed = false, sink = 0.012 } = {}) {
  const V = (q) => { const i = G.vert(q, tag); G.wt[i] = typeof wt === 'function' ? wt(q) : wt; return i; };
  const n = pts.length, at = (k) => pts[closed ? (k + n) % n : Math.max(0, Math.min(n - 1, k))];
  const L = pts.map((p, k) => {
    const tan = unit(sub(at(k + 1).q, at(k - 1).q)), x = unit(cross(p.n, tan)), hw = (Array.isArray(w) ? w[k] : w) / 2;
    const top = add(p.q, mul(p.n, h)), bot = add(p.q, mul(p.n, -sink));
    return { tl: V(add(top, mul(x, -hw))), tr: V(add(top, mul(x, hw))), bl: V(add(bot, mul(x, -hw))), br: V(add(bot, mul(x, hw))) };
  });
  G.tag = tag;
  const start = G.polys.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = L[k], b = L[(k + 1) % n];
    G.poly([a.tl, b.tl, b.tr, a.tr], mat, tag);
    G.poly([a.bl, b.bl, b.tl, a.tl], mat, tag);
    G.poly([a.tr, b.tr, b.br, a.br], mat, tag);
  }
  if (!closed) { const a = L[0], b = L[n - 1]; G.poly([a.bl, a.tl, a.tr, a.br], mat, tag); G.poly([b.br, b.tr, b.tl, b.bl], mat, tag); }
  piece(G, start, () => pts[0].n);
}

/* ---- the pieces worn under this one ------------------------------------------------------------------------------- */
/**
 * Points on the leather set's pieces under the chest at rest (their assets beside this builder,
 * tools/sculpt/leather/under/<name>-<who>.json: the leggings, their flaps left out), each triangle sampled about 0.06 apart.
 */
export function underPieces(who, names = ['lowleatherlegs'], cut = null) {
  // (`cut`: the leggings' triangles wholly above it left out too: the waist under the undershirt, switched off with the
  // flaps while the chest is worn, the undershirt the bottom layer there)
  // (the leggings' hip flaps, their `light` panels and the trim round them, left out: they are switched off while the chest is worn, the skirt
  // hanging where they would)
  const SKIP = { lowleatherlegs: ['light'] };
  const out = [];
  for (const n of names) {
    const f = new URL(`../leather/under/${n}-${who}.json`, import.meta.url);
    if (!existsSync(f)) continue;
    const A = JSON.parse(readFileSync(f, 'utf8')), P = [];
    for (let i = 0; i < A.verts.length; i += 3) P.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
    const pts = [], mat = (i) => A.mats[A.polys[A.tris[i + 3]][1]];
    // (the skipped panels' trim with them: trim triangles with a corner on a skipped panel's corner)
    const key = (q) => q.map((x) => x.toFixed(3)).join(','), on = new Set();
    for (let i = 0; i < A.tris.length; i += 4) if ((SKIP[n] ?? []).includes(mat(i))) for (let j = 0; j < 3; j++) on.add(key(P[A.tris[i + j]]));
    for (let i = 0; i < A.tris.length; i += 4) {
      if ((SKIP[n] ?? []).includes(mat(i))) continue;
      const [a, b, c] = [A.tris[i], A.tris[i + 1], A.tris[i + 2]].map((k) => P[k]);
      if (mat(i) === 'trim' && [a, b, c].some((q) => on.has(key(q)))) continue;
      if (cut !== null && n === 'lowleatherlegs' && Math.min(a[1], b[1], c[1]) > cut) continue;
      const m = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / 0.06));
      for (let u = 0; u <= m; u++) for (let v = 0; v <= m - u; v++) { const x = u / m, y = v / m, z = 1 - x - y; pts.push([a[0] * z + b[0] * x + c[0] * y, a[1] * z + b[1] * x + c[1] * y, a[2] * z + b[2] * x + c[2] * y]); }
    }
    out.push(pts);
  }
  return out;
}

/* ---- the sheet's panels: outlines off the approved trace, back onto the body ---------------------------------------- */
/**
 * A traced piece's outline (tools/sculpt/leather/mesh/<who>-<view>.json, sheet pixels) as columns across it, in the
 * body's x and y: the registered front camera (tools/sculpt/lowleatherchestcams.json: u = cx + s sx(y) x, v = cy - s y;
 * the trunk is not posed for the sheet) undone. Each column { x, top, bottom }: where the vertical line through it
 * crosses the outline highest and lowest, `tuck` sheet pixels added above (to reach under the panel over it).
 * Returns null where there is no trace or camera.
 */
export function tracedOutline(who, name, { cols = 10, tuck = 0, view = 'front', across = false } = {}) {
  const tf = new URL(`../leather/mesh/${who}-${view}.json`, import.meta.url), cf = new URL('../lowleatherchestcams.json', import.meta.url);
  if (!existsSync(tf) || !existsSync(cf)) return null;
  const P = JSON.parse(readFileSync(tf, 'utf8')).pieces[name], C = JSON.parse(readFileSync(cf, 'utf8'))[who], V = C?.views?.[view];
  if (!Array.isArray(P) || !V || V.yaw !== 0) return null;
  const pw = (m, y) => { if (!m?.y?.length) return 1; const { y: Y, k } = m; if (y >= Y[0]) return k[0]; for (let i = 0; i + 1 < Y.length; i++) if (y >= Y[i + 1]) return k[i] + ((k[i + 1] - k[i]) * (y - Y[i])) / (Y[i + 1] - Y[i]); return k[k.length - 1]; };
  const toBody = (u, v) => { const y = (C.cy - v) / C.s; return [(u - V.cx) / (C.s * pw(C.sx, y)), y]; };
  if (across) {
    // (rows instead: for an upright piece, each horizontal line through it, its middle and width, { x, y, w })
    const vs = P.map((q) => q[1]), v0 = Math.min(...vs), v1 = Math.max(...vs), o = [];
    for (let r = 0; r <= cols; r++) {
      const v = v0 + 0.6 + ((v1 - v0 - 1.2) * r) / cols, us = [];
      for (let i = 0; i < P.length; i++) { const [a, b] = [P[i], P[(i + 1) % P.length]]; if ((a[1] - v) * (b[1] - v) <= 0 && a[1] !== b[1]) us.push(a[0] + ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1])); }
      if (us.length < 2) continue;
      const [xa, y] = toBody(Math.min(...us), v), [xb] = toBody(Math.max(...us), v);
      o.push({ x: (xa + xb) / 2, y, w: xb - xa });
    }
    return o.length > 1 ? o : null;
  }
  const us = P.map((q) => q[0]), u0 = Math.min(...us), u1 = Math.max(...us), out = [];
  for (let c = 0; c <= cols; c++) {
    const u = u0 + 0.6 + ((u1 - u0 - 1.2) * c) / cols, vs = [];
    for (let i = 0; i < P.length; i++) { const [a, b] = [P[i], P[(i + 1) % P.length]]; if ((a[0] - u) * (b[0] - u) <= 0 && a[0] !== b[0]) vs.push(a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0])); }
    if (vs.length < 2) continue;
    const [x, top] = toBody(u, Math.min(...vs) - tuck), [, bottom] = toBody(u, Math.max(...vs));
    out.push({ x, top, bottom });
  }
  return out.length > 1 ? out : null;
}
/** A traced ellipse's centre and radii (sheet pixels) in the body's x and y, as tracedOutline. */
export function tracedEllipse(who, name, view = 'front') {
  const tf = new URL(`../leather/mesh/${who}-${view}.json`, import.meta.url), cf = new URL('../lowleatherchestcams.json', import.meta.url);
  if (!existsSync(tf) || !existsSync(cf)) return null;
  const E = JSON.parse(readFileSync(tf, 'utf8')).pieces[name]?.ellipse, C = JSON.parse(readFileSync(cf, 'utf8'))[who], V = C?.views?.[view];
  if (!E || !V) return null;
  const pw = (m, y) => { if (!m?.y?.length) return 1; const { y: Y, k } = m; if (y >= Y[0]) return k[0]; for (let i = 0; i + 1 < Y.length; i++) if (y >= Y[i + 1]) return k[i] + ((k[i + 1] - k[i]) * (y - Y[i])) / (Y[i + 1] - Y[i]); return k[k.length - 1]; };
  const y = (C.cy - E[1]) / C.s, sx = pw(C.sx, y);
  return { x: (E[0] - V.cx) / (C.s * sx), y, rx: E[2] / (C.s * sx), ry: E[3] / C.s };
}

/* ---- the trunk ---------------------------------------------------------------------------------------------------------- */
const rad = Math.PI / 180;
/** The az at which the chest's section at height y (out by c) reaches x, between a0 and a1 (x monotone there). */
function azOfX(sec, y, x, c, a0 = -89, a1 = 89) {
  let lo = a0, hi = a1;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (sec.at(y, m, c)[0] < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** A point on a line y = y0 + k x across the chest at az (the section out by c): two passes on x. */
function onLine(sec, L, az, c) {
  let y = L.y0;
  for (let i = 0; i < 4; i++) y = L.y0 + L.k * sec.at(y, az, c)[0];
  return y;
}

/**
 * Weights down the trunk by height: the spine's bones in turn, each blended into the next between their heads (the
 * leather bends with the back as it bows and twists, so a plate's foot stays with the belt and the waistband under it).
 */
export function trunkWt(rig, y) {
  const H = ['spine_03', 'spine_02', 'spine_01', 'pelvis'].map((n) => [n, rig.bones[rig.at.get(n)].head[1]]);
  if (y >= H[0][1]) return { [H[0][0]]: 1 };
  for (let i = 0; i + 1 < H.length; i++) if (y >= H[i + 1][1]) { const t = (H[i][1] - y) / (H[i][1] - H[i + 1][1]); return t < 0.02 ? { [H[i][0]]: 1 } : t > 0.98 ? { [H[i + 1][0]]: 1 } : { [H[i][0]]: 1 - t, [H[i + 1][0]]: t }; }
  return { pelvis: 1 };
}

function torsoPieces(G, rig, D, S) {
  const rim = D.rim, TW = (p) => trunkWt(rig, p[1]);
  const { chest, fsec, fz, parts } = trunkCharts(D, S);
  const outOf = (sec) => (p) => { const a = sec.axisAt(p[1]); return [p[0] - a[0], 0, p[2] - a[2]]; };
  const out = outOf(chest), hipOut = (p) => [p[0], 0, p[2] - fz];
  const trunk = parts(['torso', 'neck', 'pelvis']), hipS = parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > D.skirt.top - 3);
  const gap = rim.t + D.fit.gap, lay = (p0) => surfOf(G, p0);
  const span = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
  /** columns over a table's az (refined so no step is over `step` degrees), mirrored through the front or the back */
  const refine = (A, step) => A.flatMap((a, i) => (i === 0 ? [a] : span(A[i - 1], a, Math.max(1, Math.ceil((a - A[i - 1]) / step))).slice(1)));
  const grid = (az, top, bottom, rows, c) => rows.map((f, r) => az.map((a, k) => chest.at(top(a, k) + (bottom(a, k) - top(a, k)) * f, a, Array.isArray(c) ? c[r] : c)));

  /* the undershirt: the bottom layer, a closed shell from the collar's foot to below the groin (the trunk above
   * `belt`, the hips and the legs together below it), just off the skin; every piece over it */
  if (D.undershirt) {
    const U = D.undershirt, uAz = Array.from({ length: 32 }, (_, k) => (k * 360) / 32);
    const foot = (a) => tabAt({ az: U.az, v: U.bottom }, 'v', a);
    const rows = Array.from({ length: U.rows }, (_, r) => uAz.map((a) => { const y = U.top + ((foot(a) - U.top) * r) / (U.rows - 1); return (y > U.belt ? chest : fsec).at(y, a, U.c); }));
    fitOut(rows, true, (p) => [p[0], 0, p[2] - fz], [[parts(['torso', 'pelvis', 'legs']), U.c]]);
    const u0 = G.polys.length;
    plateOf(G, rows, { tag: 'undershirt', mat: 'dark', boneAt: TW, rim: { ...rim, w: 0, h: 0 }, out: (p) => [p[0], 0, p[2] - fz], ring: true, border: { top: 'open', bottom: 'open' } });
    for (let k = u0; k < G.polys.length; k++) G.polys[k].piece = 'undershirt';
  }

  /* the skirt: plates hanging from under the belt over the hips, out by the clearance and flaring as they fall */
  // (everything on the trunk laid over the leggings, the piece under it, where this branch has their asset:
  // tools/sculpt/leather/under/lowleatherlegs-<who>.json, their waistband and hip flaps cleared by the leather's thickness)
  const Sk = D.skirt, skirts = [], under = [...underPieces(rig.who, undefined, D.undershirt ? Math.max(...[D.undershirt.bottom].flat()) : null)], nLegs = under.length;
  // (over the leggings: the belt's top above their waistband's, so it covers it; the cores' and side panels' feet over
  // the belt, kept above the waistband's top so their backs do not reach into it as the spine bends)
  const legsTop = under.length ? Math.max(...under[0].map((p) => p[1])) : null;
  if (legsTop !== null) {
    D = structuredClone(D);
    D.belt.top = D.belt.top.map((y) => Math.max(y, legsTop + 0.12));
    const foot = (y) => (y < legsTop + 0.6 ? Math.max(y, legsTop + 0.04) : y);
    D.core.bottom = D.core.bottom.map(foot); D.back.bottom = D.back.bottom.map(foot); D.side.bottom = D.side.bottom.map(foot);
  }
  const skirtRows = (az, top, bottom) => {
    const rows = [];
    for (let r = 0; r < 5; r++) rows.push(az.map((a, k) => {
      const y = top + ((bottom[k] - top) * r) / 4;
      let p = fsec.at(y, a, Sk.c + Sk.flare * (top - y) / 2);
      if (r > 0) {
        const prev = rows[r - 1][k], d = [Math.sin(a * rad), 0, Math.cos(a * rad)];
        const rp = dot(sub(prev, [0, prev[1], fz]), d), rc = dot(sub(p, [0, p[1], fz]), d);
        if (rc < rp) p = add([0, y, fz], mul(d, rp));
      }
      return p;
    }));
    return rows;
  };
  // (inside out: the tongues, the lower tier, the upper; within a tier the back-side plate, the side, the front-side)
  const order = ['skirt.f2', 'skirt.f', 'skirt.b', 'skirtL', 'skirtU'];
  // (the arm's lane: our arms hang close by the hip, the hand and the forearm passing there in the idle and the walk;
  // the side plates there end above them (`arm.bottom`), the plates either side of the lane kept out of it)
  const lane = Sk.arm;
  const laneOf = (pl) => {
    if (!lane || !pl.mirror) return pl;
    const [a0, a1] = [pl.az[0], pl.az[pl.az.length - 1]], mid = (a0 + a1) / 2;
    if (mid > lane.az[0] && mid < lane.az[1]) return { ...pl, bottom: pl.bottom.map((y) => Math.max(y, lane.bottom)) };
    if (mid <= lane.az[0] && a1 > lane.az[0]) { const k = (lane.az[0] - a0) / (a1 - a0); return { ...pl, az: pl.az.map((a) => a0 + (a - a0) * k) }; }
    if (mid >= lane.az[1] && a0 < lane.az[1]) { const k = (a1 - lane.az[1]) / (a1 - a0); return { ...pl, az: pl.az.map((a) => a1 - (a1 - a) * k) }; }
    return pl;
  };
  for (const name of order) for (const pl0 of Sk.plates.filter((p) => p.name === name).slice().reverse()) for (const s of pl0.mirror ? [1, -1] : [1]) {
    const pl = laneOf(pl0);
    const az0 = s > 0 ? pl.az : pl.az.slice().reverse().map((a) => -a), bottom0 = s > 0 ? pl.bottom : pl.bottom.slice().reverse();
    const az = refine(az0.map((a, i) => a), 12), bottom = az.map((a) => { for (let i = 0; i + 1 < az0.length; i++) if ((a - az0[i]) * (a - az0[i + 1]) <= 0) { const t = (a - az0[i]) / (az0[i + 1] - az0[i] || 1); return bottom0[i] + (bottom0[i + 1] - bottom0[i]) * t; } return bottom0[0]; });
    const rows = skirtRows(az, pl.top ?? Sk.top, bottom);
    fitOut(rows, false, hipOut, [[hipS, D.fit.skirt], ...under.map((P, i) => [P, i < nLegs ? gap + 0.02 : D.fit.stack ?? gap])]);
    const bone = s > 0 ? pl.bone : Object.fromEntries(Object.entries(pl.bone).map(([b, w]) => [b.replace(/_l$/, '_x').replace(/_r$/, '_l').replace(/_x$/, '_r'), w]));
    const p0 = G.polys.length;
    // (its top with the pelvis, under the belt; its foot with the plate's own shares of the pelvis and the thigh)
    const mix = (f) => { const o = {}; for (const [b, w] of Object.entries(bone)) o[b] = (o[b] ?? 0) + w * f; o.pelvis = (o.pelvis ?? 0) + (1 - f); return o; };
    const pc = plateOf(G, rows, { tag: name, bone, boneRow: mix, rim, out: hipOut, border: { top: 'open', bottom: 'bevel', left: 'bevel', right: 'bevel' } });
    const pieceName = pl.mirror ? `${name}.${s > 0 ? 'l' : 'r'}` : name;
    for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = pieceName;
    skirts.push(pc);
    under.push(lay(p0));
    { const q0 = G.polys.length; rivetsOn(G, D, pc, [[0.78, 0.5]], mix(0.8)); for (let k = q0; k < G.polys.length; k++) G.polys[k].piece = pieceName; }
  }

  /* the belt: a ring round the waist, pointed at the front and the back, trimmed top and foot, over the skirt's tops */
  const Bt = D.belt, ringAz = Array.from({ length: 32 }, (_, k) => (k * 360) / 32);
  const beltRows = [0, 1].map((f) => ringAz.map((a) => { const t = tabAt(Bt, 'top', a), b = tabAt(Bt, 'bottom', a); return chest.at(t + (b - t) * f, a, Bt.c[f]); }));
  // (the points of the V on columns of their own: the front's and the back's)
  layOver(beltRows, skirts, out, gap, 0);
  fitOut(beltRows, true, out, [[trunk, D.fit.belt], ...under.slice(0, nLegs).map((P) => [P, gap])]);
  let p0 = G.polys.length;
  const belt = plateOf(G, beltRows, { tag: 'belt', mat: 'leather', bone: { spine_01: 0.5, pelvis: 0.5 }, rim, out, ring: true, border: { top: 'trim', bottom: 'trim' } });
  rivetsOn(G, D, belt, [2, 6, 10, 22, 26, 30].map((c) => [0.5, c / 32]), { spine_01: 0.5, pelvis: 0.5 });
  for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = 'belt';
  under.push(lay(p0));

  /* the side panels: under the arm from the chest core's side to the back core's, down to the belt */
  const Sd = D.side;
  const sides = [];
  for (const s of [1, -1]) {
    const az = refine(Sd.az, 10).map((a) => s * a), top = (a) => tabAt({ az: Sd.az, v: Sd.top }, 'v', a), bot = (a) => tabAt({ az: Sd.az, v: Sd.bottom }, 'v', a);
    const rows = grid(s > 0 ? az : az.slice().reverse(), top, bot, Sd.rows, Sd.c);
    fitOut(rows, false, out, [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);
    p0 = G.polys.length;
    sides.push(plateOf(G, rows, { tag: 'side', boneAt: TW, rim, out, mat: 'leather', border: { top: 'bevel', bottom: 'open', left: 'edge', right: 'edge' } }));
    for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = `side.${s > 0 ? 'l' : 'r'}`;
    under.push(lay(p0));
  }

  /* the back core: round the back from one side panel to the other, over the shoulders to the collar's foot */
  const Kp = D.back;
  const kAz0 = refine(Kp.az, 9), kAz = [...kAz0, ...kAz0.slice(0, -1).reverse().map((a) => 360 - a)];
  const kTab = { az: Kp.az, top: Kp.top, bottom: Kp.bottom };
  const kRows = grid(kAz, (a) => tabAt(kTab, 'top', a), (a) => tabAt(kTab, 'bottom', a), Kp.rows, Kp.c);
  fitOut(kRows, false, out, [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);
  p0 = G.polys.length;
  const backTop = (r, c) => (Math.abs(180 - kAz[c]) <= 50 && Math.abs(180 - (kAz[c + 1] ?? 999)) <= 50 ? 'open' : 'bevel');
  const back = plateOf(G, kRows, { tag: 'back', mat: 'leather', boneAt: TW, rim, out, border: { left: 'edge', right: 'edge', top: backTop, bottom: 'bevel' } });
  // its raised panel: a pentagon on the upper back, pointed at its foot
  {
    const P = Kp.panel, az = span(180 - P.half, 180 + P.half, 6);
    const bot = (a) => P.bottom + (P.tip - P.bottom) * (1 - Math.abs(a - 180) / P.half);
    const rows = [0, 0.5, 1].map((f) => az.map((a) => chest.at(P.top + (bot(a) - P.top) * f, a, Kp.c)));
    fitOut(rows, false, out, [[trunk, D.fit.trunk], [lay(p0), gap - 0.03]]);
    plateOf(G, rows, { tag: 'back panel', boneAt: TW, rim: { ...rim, w: rim.w * 0.6, t: rim.t * 0.5 }, out, border: { top: 'bevel', bottom: 'bevel', left: 'bevel', right: 'bevel' } });
  }
  for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = 'back';
  under.push(lay(p0));

  /* the chest core: from one side round the front to the other, over the shoulders, its foot over the belt */
  const Cp = D.core;
  // (two plates meeting at the lacing's seam: the front, down to the belt, and either side its wing round under the arm,
  // ending above the side panel; the step in the foot between them a plate's edge rather than quads sheared across it)
  const iStep = Cp.bottom.findIndex((b, i) => i + 1 < Cp.bottom.length && Cp.bottom[i + 1] - b > 0.5);
  const aStep = iStep >= 0 ? Cp.az[iStep] : Cp.az[Cp.az.length - 1];
  const cAz0 = refine(Cp.az.filter((a) => a <= aStep), 7), cAz = [...cAz0.slice(1).reverse().map((a) => -a), ...cAz0];
  const cTab = { az: Cp.az, top: Cp.top, bottom: Cp.bottom };
  const cRows = grid(cAz, (a) => tabAt(cTab, 'top', a), (a) => tabAt(cTab, 'bottom', a), Cp.rows, Cp.c);
  // (drawn straight across between the breasts: the columns within `flat` of the front on the line between the two at
  // `flat`, never further in than the body; the bridged rows no further in than the mean of the rows either side)
  const radOf = (p) => { const a = chest.axisAt(p[1]); return Math.hypot(p[0] - a[0], p[2] - a[2]); };
  const setRad = (p, r) => { const a = chest.axisAt(p[1]), d = unit([p[0] - a[0], 0, p[2] - a[2]]); return [a[0] + d[0] * r, p[1], a[2] + d[2] * r]; };
  cRows.forEach((row, r) => {
    if (r === 0) return;
    const ia = cAz.indexOf(Cp.flat), ib = cAz.indexOf(-Cp.flat);
    if (ia < 0 || ib < 0) return;
    const A = row[ia], Bq = row[ib];
    for (let k = Math.min(ia, ib) + 1; k < Math.max(ia, ib); k++) { const t = (row[k][0] - Bq[0]) / (A[0] - Bq[0]), q = lerp(Bq, A, t); if (radOf(q) > radOf(row[k])) row[k] = setRad(row[k], radOf(q)); }
  });
  for (const r of Cp.bridge ?? []) cRows[r].forEach((p, k) => { const want = (radOf(cRows[r - 1][k]) + radOf(cRows[r + 1][k])) / 2; if (radOf(p) < want) cRows[r][k] = setRad(p, want); });
  // (in profile a plate: down each column from its fullest row to its foot no further in than the straight line between
  // them, so it falls from the chest to the waist in one smooth line, as drawn, rather than following under the bust)
  if (Cp.drape) for (let k = 0; k < cAz.length; k++) {
    const rr = cRows.map((row) => radOf(row[k])), top = rr.indexOf(Math.max(...rr)), R0 = cRows.length - 1;
    for (let r = top + 1; r < R0; r++) { const want = rr[top] + ((rr[R0] - rr[top]) * (r - top)) / (R0 - top); if (rr[r] < want) cRows[r][k] = setRad(cRows[r][k], want); }
  }
  layOver(cRows, [belt, ...sides, ...skirts], out, gap, 0);
  fitOut(cRows, false, out, [[trunk, D.fit.trunk], ...under.slice(0, nLegs).map((P) => [P, gap])]);
  p0 = G.polys.length;
  const coreTop = (r, c) => (Math.abs(cAz[c]) <= 40 && Math.abs(cAz[c + 1] ?? 999) <= 40 ? 'open' : 'bevel');
  const core = plateOf(G, cRows, { tag: 'chest', mat: 'leather', boneAt: TW, rim, out, border: { top: coreTop, bottom: 'bevel', left: 'edge', right: 'edge' } });
  const wings = [];
  if (iStep >= 0) {
    // (from a little in front of the seam, over the front's edge, so no crack opens between them)
    const wTab = { az: [Cp.az[iStep] - (Cp.wingLap ?? 4), ...Cp.az.slice(iStep + 1)], top: [tabAt(cTab, 'top', Cp.az[iStep] - (Cp.wingLap ?? 4)), ...Cp.top.slice(iStep + 1)], bottom: [Cp.bottom[iStep + 1], ...Cp.bottom.slice(iStep + 1)] };
    const wAz0 = refine(wTab.az, 7);
    for (const s of [1, -1]) {
      const az = s > 0 ? wAz0 : wAz0.slice().reverse().map((a) => -a);
      const rows = grid(az, (a) => tabAt(wTab, 'top', a), (a) => tabAt(wTab, 'bottom', a), Cp.rows, Cp.c);
      layOver(rows, [core, belt, ...sides], out, gap, 0);
      fitOut(rows, false, out, [[trunk, D.fit.trunk]]);
      wings.push(plateOf(G, rows, { tag: 'chest', mat: 'leather', boneAt: TW, rim, out, border: { top: 'bevel', bottom: 'bevel', left: 'edge', right: 'edge' } }));
    }
  }

  // the diagonal layered plates over it: each between two lines across the chest, the upper over the lower
  const bandPlates = [];
  let below = [[lay(p0), gap]];
  // (the sheet's own panels, when the design names them: each traced outline back on the body, laid over the chest and
  // the panels before it, in the order given, the last outermost)
  const panels = (D.panels ?? []).map((Pn) => ({ Pn, cols: tracedOutline(rig.who, Pn.trace, { cols: Pn.cols ?? 10, tuck: Pn.tuck ?? 0 }) })).filter((q) => q.cols);
  for (const { Pn, cols } of panels) {
    const lim = D.bandReach ?? 70, nR = Pn.rows ?? 6;
    const rows = Array.from({ length: nR }, (_, r) => cols.map((cl) => {
      const y = cl.top + ((cl.bottom - cl.top) * r) / (nR - 1);
      return chest.at(y, Math.max(-lim, Math.min(lim, azOfX(chest, y, cl.x, Cp.c))), Cp.c);
    }));
    layOver(rows, [core, ...wings, ...sides, belt, ...bandPlates], out, gap);
    fitOut(rows, false, out, [[trunk, D.fit.trunk]]);
    bandPlates.push(plateOf(G, rows, { tag: Pn.tag, boneAt: TW, rim, out, border: { top: Pn.top ?? 'bevel', bottom: Pn.bottom ?? 'bevel', left: 'edge', right: 'edge' } }));
  }
  for (const [bi, Bd] of (panels.length ? [] : [...D.bands.entries()].reverse())) {
    const yMid = (Bd.top.y0 + Bd.bottom.y0) / 2;
    // (its ends no further round than `reach` (degrees) either side, short of the armpit, where the chest turns into the side)
    const lim = D.bandReach ?? 70, a0 = Math.max(-lim, azOfX(chest, yMid, Bd.x[0], Cp.c)), a1 = Math.min(lim, azOfX(chest, yMid, Bd.x[1], Cp.c));
    const az = span(a0, a1, Math.max(4, Math.round((a1 - a0) / 8)));
    const capTop = (a) => tabAt(cTab, 'top', a) - 0.06, capBot = (a) => tabAt(cTab, 'bottom', a) + 0.04;
    const rows = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => az.map((a) => {
      const t = Math.min(capTop(a), onLine(chest, Bd.top, a, Cp.c)), b = Math.max(capBot(a), onLine(chest, Bd.bottom, a, Cp.c));
      return chest.at(t + (b - t) * f, a, Cp.c);
    }));
    // (laid on what is under it: each point on the outermost of the chest's plates and the bands below along the way in
    // from it, out by the leather's thickness; then clear of the body)
    layOver(rows, [core, ...wings, ...sides, belt, ...bandPlates], out, gap);
    fitOut(rows, false, out, [[trunk, D.fit.trunk]]);
    const q0 = G.polys.length;
    bandPlates.push(plateOf(G, rows, { tag: `band ${bi + 1}`, boneAt: TW, rim, out, border: { top: bi === 0 ? 'trim' : 'bevel', bottom: 'bevel', left: 'edge', right: 'edge' } }));
    below = [...below, [lay(q0), gap]];
  }
  for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = 'chest';
  const front = [core, ...wings, ...bandPlates];

  // the emblem on the left breast: a ring and two stripes down from it, on whatever plate is outermost there
  {
    const E = { ...D.emblem }, FWD = [0, 0, -1], q0 = G.polys.length;
    if (panels.length) {
      // (the ring off the traced ring and its hole; the stripes off the traced stripes: their middles and widths, the
      // foot the lowest of them)
      const R = tracedEllipse(rig.who, 'ring'), Hh = tracedEllipse(rig.who, 'ring.hole');
      // (kept round: the sheet's body is narrower than ours, so its circle would come back wide; its height kept)
      if (R) { E.x = R.x; E.y = R.y; E.r = Hh ? (R.ry + Hh.ry) / 2 : R.ry - E.w / 2; if (Hh) E.w = R.ry - Hh.ry; }
      E.traced = ['stripe1', 'stripe2'].map((n) => tracedOutline(rig.who, n, { cols: 6, across: true })).filter(Boolean);
      if (E.traced.length) E.stripes = [];
    }
    // (on the outermost plate there; through a seam, on the chest's own section out by two thicknesses)
    const at = (x, y) => onTop(front, [x, y, 0], FWD) ?? (() => { const q = chest.at(y, azOfX(chest, y, x, Cp.c), Cp.c + 2 * gap); return { q, n: unit(out(q)) }; })();
    // (riding over the plates' edges: each point forward to the most of its neighbours' within two, and over a step
    // between plates by the raised strip's height too, so no edge or rim cuts across it)
    const ride = (pts, closed) => pts.map((p, i) => {
      let m = p.q[2], lo = p.q[2];
      for (let j = -2; j <= 2; j++) { const q = pts[closed ? (i + j + pts.length) % pts.length : Math.max(0, Math.min(pts.length - 1, i + j))]; m = Math.max(m, q.q[2]); lo = Math.min(lo, q.q[2]); }
      return { q: [p.q[0], p.q[1], m + (m - lo > 0.02 ? rim.h : 0)], n: p.n };
    });
    const ring = Array.from({ length: 28 }, (_, k) => { const a = (k / 28) * 2 * Math.PI; return at(E.x + Math.cos(a) * E.r, E.y + Math.sin(a) * E.r); }).filter(Boolean);
    if (ring.length === 28) stripOn(G, ride(ring, true), E.w, 'rune', 'emblem', TW, { closed: true, h: 0.03 });
    for (const T of E.traced ?? []) {
      const pts = T.map((q) => at(q.x, q.y)).filter(Boolean), w = T.reduce((a, q) => a + q.w, 0) / T.length;
      if (pts.length > 1) stripOn(G, ride(pts, false), w, 'rune', 'emblem', TW, { h: 0.03 });
    }
    for (const [x0, x1] of E.stripes) {
      const x = E.x + (x0 + x1) / 2, w = x1 - x0, ys = span(E.y - E.r - E.w * 0.6, E.bottom, 5);
      const pts = ys.map((y) => at(x, y)).filter(Boolean);
      if (pts.length > 1) stripOn(G, pts, w, 'rune', 'emblem', TW, { h: 0.03 });
    }
    for (let k = q0; k < G.polys.length; k++) G.polys[k].piece = 'chest';
  }
  // the lacing: X stitches down the seam between the chest core and the side panel
  {
    const q0 = G.polys.length;
    for (const L of D.lacing) {
      const d = [-Math.sin(L.az * rad), 0, -Math.cos(L.az * rad)];
      const ys = span(L.y[0], L.y[1], L.n), h = (ys[0] - ys[1]) * 0.42;
      for (const yc of ys.slice(0, -1).map((y, i) => (y + ys[i + 1]) / 2)) {
        const pt = (u, v) => { const o = chest.axisAt(yc + v), ax = [Math.cos(L.az * rad), 0, -Math.sin(L.az * rad)], p = add(add(o, mul(ax, u)), mul(d, -2)); return onTop([...front, ...sides], [p[0], yc + v, p[2]], d); };
        for (const [s, lift] of [[1, 0.03], [-1, 0.038]]) {
          const pts = span(-1, 1, 2).map((t) => pt(s * t * L.w / 2, -t * h)).filter(Boolean);
          if (pts.length === 3) stripOn(G, pts, 0.055, 'trim', 'lacing', TW, { h: lift });
        }
      }
    }
    for (let k = q0; k < G.polys.length; k++) G.polys[k].piece = 'chest';
  }

  /* the collar: a high stand round the neck, open at the throat in a V, its top trimmed, dark inside */
  const Cd = D.collar, { nz, r0n } = collarFrame(D, S);
  const hAt = (L, a) => { const x = Math.abs(a) / 180; return x < 0.5 ? L[0] + (L[1] - L[0]) * x * 2 : L[1] + (L[2] - L[1]) * (x - 0.5) * 2; };
  {
    const rTop = r0n + Cd.c, rFoot = rTop + Cd.spread;
    const surfY = (a, at = rFoot) => {
      let y = -Infinity;
      for (const p of trunk) {
        if (p[1] < -1.6) continue;
        const r = Math.hypot(p[0], p[2] - nz), d = Math.abs(((Math.atan2(p[0], p[2] - nz) / rad - a + 540) % 360) - 180);
        if (d < 14 && Math.abs(r - at) < 0.1) y = Math.max(y, p[1]);
      }
      return y;
    };
    const wrap = (a) => ((a + 540) % 360) - 180;
    const N = 24;
    // (each row's columns from the notch's edge round the back to the other edge: the notch `notch[0]` either side at
    // the top, `notch[1]` at the foot)
    const azRow = (f) => { const h = Cd.notch[1] + (Cd.notch[0] - Cd.notch[1]) * f; return span(h, 360 - h, N); };
    const col = azRow(0.5);
    const yb = col.map((a) => Math.min(tabAt(Cd.top, 'top', wrap(a)) - 0.3, Math.max(hAt(Cd.base, wrap(a)), surfY(a) - Cd.sink))), yt = col.map((a) => tabAt(Cd.top, 'top', wrap(a)));
    const P = (a, y, dr, f) => { const t = a * rad, rr = rFoot + (rTop - rFoot) * f + dr; return [Math.sin(t) * rr, y, nz + Math.cos(t) * rr]; };
    const fr = (k, y) => (y - yb[k]) / (yt[k] - yb[k]);
    const row = (f, dr, yOf) => azRow(f).map((a, k) => { const y = yOf(k); return P(a, y, dr, fr(k, y)); });
    const outer = [row(0, 0, (k) => yb[k]), row(1, Cd.flare * 0.8, (k) => yt[k] - Cd.trim), row(1, Cd.flare, (k) => yt[k])];
    const yIn = col.map((a, k) => Math.min(yt[k] - 0.08, Math.max(yb[k] + 0.1, surfY(a, rTop - Cd.wall) + 0.04)));
    const inner = [row(1, Cd.flare - Cd.wall, (k) => yt[k]), row(0.15, -Cd.wall, (k) => yIn[k])];
    const V = (p, k) => { const i = G.vert(p, 'collar'); const front = Math.cos(col[k] * rad); G.wt[i] = front > 0.2 ? { spine_03: 1 - Cd.shrug, [`clavicle_${p[0] > 0 ? 'l' : 'r'}`]: Cd.shrug } : { spine_03: 1 }; return i; };
    const rowsAll = [...outer, ...inner].map((r) => r.map((p, k) => V(p, k))), mats = ['leather', 'trim', 'trim', 'dark'];
    G.tag = 'collar';
    const start = G.polys.length;
    for (let r = 0; r + 1 < rowsAll.length; r++) for (let k = 0; k < N; k++) G.poly([rowsAll[r][k], rowsAll[r][k + 1], rowsAll[r + 1][k + 1], rowsAll[r + 1][k]], mats[r], 'collar');
    // the notch's edges: trimmed, closed from the outside's foot to the inside's foot
    for (const k of [0, N]) G.poly(rowsAll.map((r) => r[k]), 'trim', 'collar');
    piece(G, start, (c) => [c[0], 0, c[2] - nz]);
    for (let k = start; k < G.polys.length; k++) G.polys[k].piece = 'collar';
  }
  return { chest, front, skirts, belt, back, sides };
}

/**
 * The pauldron's frame on the left shoulder: its centre (the shoulder's joint, lifted), the direction at (ψ round the
 * pole, φ from it), the body's reach that way (over a cone, the samples near the shoulder), φ's foot by ψ.
 */
export function pauldronFrame(rig, D, S) {
  const { J } = rig, Pd = D.pauldron, UP = [0, 1, 0], FWD = [0, 0, 1];
  const centre = add(add(J.shoulder, mul(UP, Pd.lift)), [-Pd.inset, 0, 0]);
  const pole = unit(add(mul(UP, 1 - Pd.pole), mul([1, 0, 0], Pd.pole)));
  const q1 = unit(sub(FWD, mul(pole, dot(FWD, pole)))), q2 = cross(pole, q1);
  const near = S.filter((s) => ['joint', 'arm', 'torso', 'neck'].includes(s.part) && Math.hypot(...sub(s.p, centre)) < Pd.near && s.p[0] > J.shoulder[0] * 0.3).map((s) => s.p);
  const reach = (dir) => {
    const cc = Math.cos(Pd.cone * Math.PI / 180);
    let r = 0;
    for (const p of near) { const d = sub(p, centre), l = Math.hypot(...d), cs = dot(d, dir) / (l || 1); if (cs > cc) r = Math.max(r, l * cs); }
    return r;
  };
  // (φ's reach by ψ: [front, out, back, in] blended)
  const phiMax = (psi) => { const t = psi * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Pd.phi; return (c > 0 ? f * c : b * -c) + (s > 0 ? o * s : i * -s) - (Math.abs(c) + Math.abs(s) - 1) * 40; };
  const dirAt = (psi, phi) => { const a = psi * Math.PI / 180, b = phi * Math.PI / 180; return unit(add(mul(pole, Math.cos(b)), mul(add(mul(q1, Math.cos(a)), mul(q2, Math.sin(a))), Math.sin(b)))); };
  // (q2 = pole x q1: with q1 forward, ψ 90 is toward -x; ψ is taken round so that 90 is out)
  const outSign = dot(q2, [1, 0, 0]) >= 0 ? 1 : -1;
  return { centre, pole, dirAt, reach, near, outSign, phiMax };
}

/* ---- the arm (built on the left, mirrored) ----------------------------------------------------------------------------- */

/* ---- the arm (built on the left, mirrored) ----------------------------------------------------------------------------- */
function armPieces(G, rig, D, S) {
  const { B, J } = rig, rim = D.rim;
  const UP = [0, 1, 0], FWD = [0, 0, 1];
  const frameOf = (o, tail) => {
    const a = unit(sub(tail, o)), e1 = unit(sub(FWD, mul(a, dot(FWD, a)))), e2 = cross(e1, a);
    return { o, a, e1, e2: dot(e2, [1, 0, 0]) >= 0 ? e2 : mul(e2, -1), len: Math.hypot(...sub(tail, o)) };
  };
  const armS = S.filter((s) => (s.part === 'arm' || s.part === 'joint') && s.p[0] > 0).map((s) => s.p);
  const up = frameOf(J.shoulder, J.elbow), fo = frameOf(J.elbow, J.wrist);
  const upper = sectioner(armS, { ...up, dt: 0.12 }), fore = sectioner(armS, { ...fo, dt: 0.12 });
  const outOf = (fr) => (p) => { const d = sub(p, fr.o), t = dot(d, fr.a); return sub(d, mul(fr.a, t)); };
  const gap = rim.t + D.fit.gap, lay = (p0) => surfOf(G, p0);
  const setPiece = (p0, name) => { for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = name; };

  // the base sleeve: the arm's own rings from the torso's ring over the armpit to just under the elbow, pushed out along
  // the body's normals there (skinned as those rings), its end turned back into a lip
  const VN = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) VN[i] = add(VN[i], n); }
  const ringPts = (nm) => (nm === '$torso' ? TORSO_RING.map((n) => B.index.get(`${n}.L`)) : Array.from({ length: 8 }, (_, k) => B.index.get(`arm/${nm}${k}.L`)));
  const sl = D.sleeve.rings;
  const rings = sl.map(([nm, c]) => ringPts(nm).map((i) => { const v = G.vert(add(B.verts[i], mul(unit(VN[i]), c)), 'sleeve'); G.wt[v] = { $body: i }; return v; }));
  // (the lip: the last ring again, pulled back up the arm by the leather's thickness and in to the skin)
  const last = ringPts(sl[sl.length - 1][0]);
  const lip = last.map((i) => { const v = G.vert(add(add(B.verts[i], mul(unit(VN[i]), 0.008)), mul(fo.a, -rim.t)), 'sleeve'); G.wt[v] = { $body: i }; return v; });
  G.tag = 'sleeve';
  const sStart = G.polys.length;
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < 8; k++) G.poly([rings[r][k], rings[r][(k + 1) % 8], rings[r + 1][(k + 1) % 8], rings[r + 1][k]], 'dark', 'sleeve');
  for (let k = 0; k < 8; k++) G.poly([rings[rings.length - 1][k], rings[rings.length - 1][(k + 1) % 8], lip[(k + 1) % 8], lip[k]], 'dark', 'sleeve');
  piece(G, sStart, (c) => { const lines = [up, fo].map((fr) => { const d = sub(c, fr.o), t = Math.max(0, Math.min(fr.len, dot(d, fr.a))); return sub(d, mul(fr.a, t)); }); return Math.hypot(...lines[0]) < Math.hypot(...lines[1]) ? lines[0] : lines[1]; });
  setPiece(sStart, 'sleeve.l');
  const sleeveS = lay(sStart);

  // the bracer (the forearm): a tube from mid-forearm to the wrist, its top flared and trimmed, its rune band on the outside
  const Br = D.bracer, bTh = Array.from({ length: Br.cols }, (_, k) => (k * 360) / Br.cols + 360 / Br.cols / 2);
  const bRows = [0, 0.5, 1].map((f) => bTh.map((a) => fore.at(Br.t[0] + (Br.t[1] - Br.t[0]) * f, a, Br.c[0] + (Br.c[1] - Br.c[0]) * f + (f === 0 ? Br.flare : 0))));
  const bStart = G.polys.length;
  const bracer = plateOf(G, bRows, { tag: 'bracer', bone: { lowerarm_l: 0.5, lowerarm_twist_01_l: 0.5 }, rim, out: outOf(fo), ring: true, fit: { S: [[armS, D.fit.arm]] }, border: { top: 'trim', bottom: 'bevel' } });
  // the rune band: a ring and a bar under it, on the outside
  {
    const cOut = bTh.reduce((best, a, k) => (Math.sin(a * Math.PI / 180) > Math.sin(bTh[best] * Math.PI / 180) ? k : best), 0);
    const R = Br.rune, L = Br.t[1] - Br.t[0], rf = (t) => ((t - Br.t[0]) / L) * 2;
    const h0 = gridAt(bracer, rf(R.t), cOut + 0.5), along = unit(fo.a), side = unit(cross(h0.n, along));
    const at = (u, v) => { const p = add(add(h0.q, mul(along, v)), mul(side, u)); const h = onPlate(bracer, p, h0.n); return { q: h.q, n: h.n }; };
    stripOn(G, Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * 2 * Math.PI; return at(Math.cos(a) * R.r, Math.sin(a) * R.r * 1.15); }), R.w, 'rune', 'rune band', bracer.wt, { closed: true, h: 0.022 });
    const t0 = R.bar[0] - R.t, t1 = R.bar[1] - R.t;
    stripOn(G, [0, 0.5, 1].map((f) => at(0, t0 + (t1 - t0) * f)), R.w, 'rune', 'rune band', bracer.wt, { h: 0.022 });
  }
  setPiece(bStart, 'bracer.l');
  const bracerS = lay(bStart);

  // the band at the wrist (the wrist helper: half the hand's turn), over the bracer's foot
  const Bd = D.band, wTh = Array.from({ length: Bd.cols }, (_, k) => (k * 360) / Bd.cols + 360 / Bd.cols / 2);
  const wsec = sectioner(armS.concat(S.filter((s) => s.part === 'hand' && s.p[0] > 0).map((s) => s.p)), { ...fo, o: J.wrist, dt: 0.1 });
  const wStart = G.polys.length;
  plateOf(G, [0, 1].map((f) => wTh.map((a) => wsec.at(Bd.t[0] + (Bd.t[1] - Bd.t[0]) * f, a, Bd.c[f]))), { tag: 'band', bone: { wrist_l: 1 }, rim, out: outOf({ ...fo, o: J.wrist }), ring: true, border: { top: 'trim', bottom: 'trim' }, fit: { S: [[armS, D.fit.arm], [bracerS, gap]] } });
  setPiece(wStart, 'band.l');

  // the pauldron's cap (on the shoulder helper: half the upper arm's turn): a dome over the shoulder round a pole up and
  // out, each point the body's reach that way from the centre (over a cone) out by the clearance
  const Pd = D.pauldron;
  const { centre, dirAt, reach, near, outSign, phiMax } = pauldronFrame(rig, D, S);
  const psiN = Pd.hull ? Pd.hull.psi.length : Pd.cols, psis = Pd.hull ? Pd.hull.psi : Array.from({ length: psiN }, (_, k) => (k * 360) / psiN);
  let capRows;
  if (Pd.hull) {
    const H = Pd.hull;
    capRows = H.f.map((f, r) => H.psi.map((psi, k) => {
      const phi = Pd.phi0 + (H.phi[k] - Pd.phi0) * f, d = dirAt(psi * outSign, phi);
      return add(centre, mul(d, Math.max(H.r[r][k], reach(d) + D.fit.arm + 0.02)));
    }));
  } else {
    // (the foot per column: with `footY` [front, out, back], the φ where the cap comes down to that height, the inside
    // (toward the neck) at its φ of `phi`; else phiMax)
    const footPhi = (psi) => {
      if (!Pd.footY) return phiMax(psi);
      const t = psi * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), [yf, yo, yb] = Pd.footY;
      if (sn < -0.35) return phiMax(psi);
      const want = (c > 0 ? yf * c * c : yb * c * c) + yo * Math.max(0, sn) ** 2 + (sn < 0 ? ((c > 0 ? yf : yb) * sn * sn) : 0);
      let ph = Pd.phi0;
      for (; ph < 150; ph += 1) { const d = dirAt(psi * outSign, ph), p = add(centre, mul(d, reach(d) + Pd.c[2])); if (p[1] <= want) break; }
      // (blended toward phiMax on the inside)
      const w = sn < 0 ? Math.min(1, -sn / 0.35) : 0;
      return Math.min(phiMax(psi), ph * (1 - w) + phiMax(psi) * w);
    };
    capRows = Pd.rows.map((f, r) => psis.map((psi) => {
      const ps = psi * outSign, phi = Pd.phi0 + (footPhi(psi) - Pd.phi0) * f, d = dirAt(ps, phi);
      const o = Math.max(0, Math.sin(psi * Math.PI / 180)), k = Pd.inner + (1 - Pd.inner) * o;
      return add(centre, mul(d, reach(d) + Pd.c[r] * k));
    }));
    const far = Math.max(...capRows.flat().map((p) => Math.hypot(...sub(p, centre))));
    capRows.forEach((row) => row.forEach((p, k) => { const l = Math.hypot(...sub(p, centre)); row[k] = add(centre, mul(sub(p, centre), (l + (far - l) * Pd.round) / l)); }));
    for (const row of capRows) {
      const rr = row.map((p) => Math.hypot(...sub(p, centre)));
      row.forEach((p, k) => { const m = (rr[(k + psiN - 1) % psiN] + 2 * rr[k] + rr[(k + 1) % psiN]) / 4; row[k] = add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[k] * 0.97))); });
    }
  }
  // its lames under it down the upper arm, open toward the body, each over the sleeve and the one under it
  const underArm = [[armS, D.fit.arm], [sleeveS, gap]];
  for (const [li, L] of [...Pd.lames.entries()].reverse()) {
    const ths = [L.th[0], ...[1, 2, 3, 4, 5].map((k) => L.th[0] + ((L.th[1] - L.th[0]) * k) / 6), L.th[1]];
    const p0 = G.polys.length;
    const rows = [0, 1].map((f) => ths.map((a) => upper.at(L.t[0] + (L.t[1] - L.t[0]) * f, a, L.c[f])));
    const lb = li === 0 ? { shoulder_l: 0.5, upperarm_l: 0.5 } : { upperarm_l: 1 };
    const lp = plateOf(G, rows, { tag: `pauldron lame ${li + 1}`, bone: lb, rim, out: outOf(up), fit: { S: underArm }, border: { top: 'open', bottom: 'trim', left: 'bevel', right: 'bevel' } });
    rivetsOn(G, D, lp, [[0.55, 0.12], [0.55, 0.42], [0.55, 0.88]], lb);
    setPiece(p0, `plame${li + 1}.l`);
    underArm.push([lay(p0), gap]);
  }
  const cStart = G.polys.length;
  let cap, capOut = (p) => sub(p, centre), zigCols = null, strap = null;
  if (Pd.roof) {
    // (the cap as a roof: a plate laid along the shoulder's slope from `from` (by the collar's foot) to `to` (past the
    // shoulder's corner), its rows down the slope, its columns over the shoulder from the front (th[0]) to the back
    // (th[1]), each point the body's reach that way from the slope's line out by the row's clearance `c`)
    const Rf = Pd.roof, ax = unit(sub(Rf.to, Rf.from)), len = Math.hypot(...sub(Rf.to, Rf.from));
    const e1 = unit(sub(UP, mul(ax, dot(UP, ax)))), e2 = cross(ax, e1), e2f = dot(e2, FWD) >= 0 ? e2 : mul(e2, -1);
    const shS = S.filter((s2) => ['joint', 'arm', 'torso', 'neck'].includes(s2.part) && s2.p[0] > 0.3).map((s2) => s2.p);
    const sec = sectioner(shS, { o: Rf.from, a: ax, e1, e2: e2f, dt: 0.12 });
    const ths = Array.from({ length: Rf.cols + 1 }, (_, k) => Rf.th[0] + ((Rf.th[1] - Rf.th[0]) * k) / Rf.cols);
    const roofRows = Rf.rows.map((f, r) => ths.map((th) => sec.at(len * f, -th, Rf.c[r])));
    const axisPt = (p) => add(Rf.from, mul(ax, Math.max(0, Math.min(len, dot(sub(p, Rf.from), ax)))));
    capOut = (p) => sub(p, axisPt(p));
    cap = plateOf(G, roofRows, { tag: 'pauldron', bone: { shoulder_l: 1 }, rim, out: capOut, fit: { S: [[shS, D.fit.arm], ...underArm.slice(2)] }, border: { top: 'edge', bottom: 'trim', left: 'trim', right: 'trim' } });
    capRows = roofRows;
    zigCols = Rf.cols;
    if (Pd.strap) {
      // the strap: a band round the shoulder's slope at `at` (fractions along it from `from`), from the front (th[0])
      // over the top to the back (th[1]), over the cap's inner edge (built after the cap's trim, below)
      const St = Pd.strap, sths = Array.from({ length: St.cols + 1 }, (_, k) => St.th[0] + ((St.th[1] - St.th[0]) * k) / St.cols);
      strap = { rows: St.at.map((f) => sths.map((th) => sec.at(len * f, -th, St.c))), out: capOut, S: shS };
    }
  } else {
    cap = plateOf(G, capRows, { tag: 'pauldron', bone: { shoulder_l: 1 }, rim, out: (p) => sub(p, centre), ring: true, fit: { S: [[near, D.fit.arm], ...underArm.slice(2)] }, border: { top: 'open', bottom: 'trim' } });
    { const ids = capRows[0].map((p) => G.verts.findIndex((q) => q === p)); G.tag = 'pauldron'; G.poly(ids.slice().reverse(), 'light', 'pauldron'); }
  }
  // its zig-zag: trim teeth pointing up from the cap's foot, round its outside (front, out and back)
  {
    const Z = Pd.zig, nR = capRows.length - 1, q0 = G.polys.length;
    const teeth = Z.n, ps0 = zigCols ? zigCols * Z.cols[0] : psiN * (Z.psi[0] / 360), ps1 = zigCols ? zigCols * Z.cols[1] : psiN * (Z.psi[1] / 360), dps = (ps1 - ps0) / teeth;
    const at = (rf, cf) => { const h = gridAt(cap, rf * nR, cf); return add(h.q, mul(h.n, 0.022)); };
    const V = (p) => { const i = G.vert(p, 'zigzag'); G.wt[i] = cap.wt; return i; };
    G.tag = 'zigzag';
    for (let k = 0; k < teeth; k++) {
      const c0 = ps0 + k * dps, c1 = c0 + dps;
      // (a tooth: a triangle up from the band, and the band under it down to the cap's foot)
      const b0 = V(at(Z.f[1], c0)), b1 = V(at(Z.f[1], c1));
      G.poly([b0, V(at(Z.f[0], (c0 + c1) / 2)), b1], 'trim', 'zigzag');
      G.poly([V(at(0.97, c0)), V(at(Z.f[1], c0)), V(at(Z.f[1], c1)), V(at(0.97, c1))], 'trim', 'zigzag');
    }
    piece(G, q0, () => [0, 1, 0]);
    for (let k = q0; k < G.polys.length; k++) { const p = G.polys[k]; const c = mul(p.v.reduce((s, i) => add(s, G.verts[i]), [0, 0, 0]), 1 / p.v.length); if (dot(newellOf(G, p.v), capOut(c)) < 0) p.v.reverse(); }
  }
  setPiece(cStart, 'pauldron.l');
  if (strap) {
    const s0 = G.polys.length;
    const sp = plateOf(G, strap.rows, { tag: 'strap', mat: 'leather', bone: { clavicle_l: 1 }, rim, out: strap.out, fit: { S: [[strap.S, D.fit.arm], [lay(cStart), gap]] }, border: { top: 'bevel', bottom: 'bevel', left: 'bevel', right: 'bevel' } });
    rivetsOn(G, D, sp, [[0.5, 0.18], [0.5, 0.82]], { clavicle_l: 1 });
    setPiece(s0, 'strap.l');
  }
}
const newellOf = (G, v) => { let n = [0, 0, 0]; for (let i = 0; i < v.length; i++) { const a = G.verts[v[i]], b = G.verts[v[(i + 1) % v.length]]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); } return n; };

/* ---- the whole piece ---------------------------------------------------------------------------------------------------- */
const mirrorName = (n) => n.replace(/_l$/, '_r');
/** The body's samples, each with its part: its vertices and a grid on each triangle about 0.08 apart. */
export function bodySamples(B) {
  const S = [];
  B.verts.forEach((p, i) => S.push({ p, part: B.part[i] }));
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => B.verts[i]), part = B.part[t.v[0]];
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / 0.08));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; S.push({ p: [a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v], part }); }
  }
  return S;
}
/**
 * The design as built: DESIGN[who] with the sheet's fit over it (tools/sculpt/leather/chest-fit.json, written by
 * tools/sculpt/lowleatherchestsolve.mjs: each plate's outline read off the sheet), key by key.
 */
export function designOf(who) {
  const D = structuredClone(DESIGN[who]);
  const f = new URL('../leather/chest-fit.json', import.meta.url);
  if (!existsSync(f)) return D;
  const F = JSON.parse(readFileSync(f, 'utf8'))[who] ?? {};
  const over = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? over(a[k], v) : v; return a; };
  return over(D, F);
}
/** The collar's frame: the neck's axis (its z) and reach (the furthest of the neck's samples round it). */
export function collarFrame(D, S) {
  const neck = sectioner(S.filter((s) => s.part === 'neck').map((s) => s.p), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12, centred: true });
  const nz = neck.axisAt(-0.45)[2], nr = (a) => Math.max(...(D.collar.reachY ?? [-0.5, -0.3, -0.1, 0.05]).map((y) => { const p = neck.at(y, a, 0); return Math.hypot(p[0], p[2] - nz); }));
  const r0n = Math.max(...[0, 30, 60, 90, 120, 150, 180].map(nr));
  return { nz, r0n, rTop: r0n + D.collar.c };
}
/** The trunk's sections the plates are laid on: the chest's (the torso, neck and pelvis) and the skirt's (the hips). */
export function trunkCharts(D, S) {
  const parts = (names) => S.filter((s) => names.includes(s.part)).map((s) => s.p);
  const chest = sectioner(parts(['torso', 'neck', 'pelvis']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.06, centred: true, wedge: D.wedge });
  const F = D.skirt, fz = chest.axisAt(F.top)[2];
  const fsec = sectioner(parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > F.top - 3.2), { o: [0, 0, fz], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12 });
  // (a skirt plate's face at height y round az: the hips' reach out by the clearance, flaring as it falls)
  const skirtAt = (y, a, top = F.top) => fsec.at(y, a, F.c + F.flare * (top - y) / 2);
  return { chest, fsec, fz, skirtAt, parts };
}

export function buildLeatherChest(rig, design = designOf(rig.who)) {
  const D = design, { B } = rig;
  const G = meshOf();
  G.wt = []; G.plates = [];
  const S = bodySamples(B);
  torsoPieces(G, rig, D, S);
  // the left arm, then mirrored onto the right
  const v0 = G.verts.length, p0 = G.polys.length;
  armPieces(G, rig, D, S);
  const v1 = G.verts.length, p1 = G.polys.length, map = new Map();
  for (let i = v0; i < v1; i++) {
    const p = G.verts[i], j = G.vert([-p[0], p[1], p[2]], G.part[i]);
    const w = G.wt[i];
    G.wt[j] = w.$body !== undefined ? { $body: B.index.get(B.names[w.$body].replace(/\.L$/, '.R')) } : Object.fromEntries(Object.entries(w).map(([b, x]) => [mirrorName(b), x]));
    map.set(i, j);
  }
  for (let k = p0; k < p1; k++) { const p = G.polys[k]; G.polys.push({ ...p, v: p.v.map((i) => map.get(i)).reverse(), ...(p.piece ? { piece: p.piece.replace(/\.l$/, '.r') } : {}) }); }
  G.side = G.verts.map((p) => (p[0] >= 0 ? 'L' : 'R'));
  G.tris = trisOf(G);
  G.design = D;
  G.hides = hiddenPolys(rig, G);
  return G;
}

/** The armour's weights: each plate's own list (the same at every vertex), the sleeve's the body's vertex it was pushed out from. */
export function leatherChestWeights(rig, G) {
  return G.wt.map((w) => {
    if (w.$body !== undefined) return rig.vw[w.$body].map(([b, x]) => [b, x]);
    const l = Object.entries(w).map(([n, x]) => [rig.at.get(n), x]);
    if (l.some(([b]) => b === undefined)) throw new Error(`no bone in ${JSON.stringify(w)}`);
    return l;
  });
}

/**
 * The body's polygons the armour covers whole: a body vertex is covered when a ray out along its normal meets the
 * armour within `reach`, or it is the hand's (under the gauntlet); a polygon is hidden when all its corners are.
 */
export function hiddenPolys(rig, G, { reach = 0.6 } = {}) {
  const { B } = rig;
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const T = G.tris.map((t) => t.v.map((i) => G.verts[i]));
  const hit = (o, d) => {
    for (const [a, b, c] of T) {
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s = sub(o, a), u = f * dot(s, h); if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
      const t = f * dot(e2, q); if (t > 0 && t < reach) return true;
    }
    return false;
  };
  // (the arm and the shoulder's joint above the sleeve's last ring all under the sleeve, the pauldron and its lames)
  const end = G.design.sleeve.rings[G.design.sleeve.rings.length - 1][0];
  const faY = Math.min(...Array.from({ length: 8 }, (_, k) => B.verts[B.index.get(`arm/${end}${k}.L`)][1]));
  const cov = B.verts.map((p, i) => {
    if ((B.part[i] === 'arm' || B.part[i] === 'joint') && p[1] > faY + 0.02) return true;
    if (!['torso', 'arm', 'joint', 'neck', 'pelvis'].includes(B.part[i])) return false;
    return hit(p, unit(N[i]));
  });
  return B.polys.map((p, k) => (p.v.every((i) => cov[i]) ? k : -1)).filter((k) => k >= 0);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildLeatherChest(rig);
    G.vw = leatherChestWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowleatherchest-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/leatherchest.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
