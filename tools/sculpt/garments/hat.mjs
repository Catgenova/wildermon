// The leather set's feathered cap (the hat sheet's equipped view: a cavalier's hat, a six-panel faceted crown snug on
// the head and a little wider than it, a wrap band with a ring ornament, a large asymmetric brim with a raised trim edge,
// drooping past the eye line on the body's right and at the front, level with its tip swept up on the body's left under
// the two angled feathers in the trim colour), fitted to each low-poly body from the one design (DESIGN, per body), its
// crown sized to the skull (the head alone, by `clear`) and the swept-back hair, the bob and the buzz cut (src/sculpt/assets/lowhair.json,
// PRESSED) pressed under it (hatHair). Rigid on the head bone; no bones of its own.
//
//   buildHat(rig, design) → { verts, polys: [{ v, mat, part, tag, piece }], tris, part, design }
//   hatWeights(rig, G) → per vertex [[bone, weight], ...] (the head only)
//   hatHair(rig, G, { style }) → a hairstyle pressed under the hat (the game's '<style>:hat', 'swept:hat', 'bob:hat',
//   'buzz:hat')
//
//   node tools/sculpt/garments/hat.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowhat-male.json and lowhat-female.json
//     (lowgarment.mjs garmentAsset with its plain and enchanted looks, and `hair`: the swept-back hair pressed under it;
//     loaded by src/sculpt/lowpoly.ts, which draws that hair in the hair's place while the hat is worn)
//
// The construction, in the hat's own frame: its origin C on the head (the crown's foot, the brim's root), y up the hat's
// axis, the frame tipped back by `pitch` (degrees, the front up) about the body's x; azimuth 0 forward, +90 toward the
// body's left. Columns every 15 degrees (AZ).
//   the crown: stations up the axis (the band's foot, its edge strips, its top step, the wall, the shoulder, the apex),
//   each a hexagonal section (`sec`: six flat panels, a panel's middle forward, their corners at ±30, ±90, ±150) scaled
//   to an oval (`oval`), then pushed out along its column until it clears the head (and with `overHair` the hair) by
//   `clear`; the rings from the wall's top up raised by `slant`, its top slanted;
//   the brim: from the crown's foot out to the outer radius `R` (by azimuth), dropping by `drop` (by azimuth) along the
//   power curve `curve` (a number, or by azimuth) and rising by `up` (by azimuth) along the cube, its tip swept up; the
//   tables by azimuth signed (-180 to 180), its two sides apart; its underside `T` under it; the trim: a raised bead round the outer edge (`trim`), over the edge
//   onto the underside; the sweatband: the underside's root up inside the crown (hidden, the hat's thickness shown at the
//   foot);
//   the ring: a bevelled washer on the band's face at azimuth `ring.az`;
//   the feathers: thin vanes with a raised rib and notched edges, each with its quill, rising behind the ring.
// Materials (the set's shared ones): leather (the crown, the band, the brim), dark (the inside: the sweatband), trim (the
// brim's trim, the seams, the feathers), rune (the ring and the band's edge strips: trim plain, glowing enchanted).
import { meshOf, orient, trisOf, samplesOf, crossPairs, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { readFileSync } from 'node:fs';

/**
 * The leather set's shared materials, exactly as the chest's (tools/sculpt/garments/leatherchest.mjs on
 * sculpt-leather-chest, 30dd1e38; the game gives each one slot): dark (the darkest leather: the hat's inside), leather
 * (the crown, the band, the brim), light (the plates; unused here), trim (the brim's trim, the seams, the feathers), rune
 * (the ring and the band's edge strips: the trim's colour plain, glowing enchanted), glow (the glow itself).
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
export const KIND = 2;
/**
 * The two looks: plain, every material lit (kind KIND), the rune the trim's colour; enchanted, the rune unlit at the glow
 * (kind 1, blooming), the rest as plain.
 */
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'glow' ? { c, kind: 1 } : { c, kind: KIND }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'glow' ? { c, kind: 1 } : { c, kind: KIND }])), rune: { c: MATS.glow, kind: 1 } },
};

const interp = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / Math.max(1e-9, P[i + 1][0] - P[i][0]);
  return P[P.length - 1][1];
};
/**
 * A table by azimuth: symmetric ([[|az|, v]], from 0) or signed ([[az, v]] from -180 to 180: +90 the body's left), the
 * brim's two sides drawn apart.
 */
const byAz = (T, az) => (T[0][0] < 0 ? interp(T, az) : interp(T, Math.abs(az)));

/**
 * The design per body (the body's units: y up, the chin's underside 0; z forward; x the body's left):
 *   C: the hat's origin (the crown's foot on the axis); pitch: the hat tipped back (degrees, the front up);
 *   sec: the crown's stations [h, apothem]: the foot, the band's top, the wall's top, and if given the shoulder and the
 *   top's ring (the sheet's crown: a wall, then six facets to the apex); apex:
 *   the apex's height (each pushed out, the apex raised, until the crown clears the head, and the hair with `overHair`:
 *   off, the hair pressed under it, hatHair); slant: the top's rise [per unit across (x), per unit forward];
 *   oval: the section's scale across (x), forward and back; round: how far a panel bulges toward the circle (0 flat);
 *   band: its height, how far it stands out, its edge strips' height and how far they stand out again;
 *   brim: R (outer radius by azimuth), drop (by azimuth), curve (the drop's power along the brim, by azimuth), up (the
 *   tip's rise by azimuth, along the cube), T (thickness), trim: [width, height, overhang]; each table by azimuth signed,
 *   -180 to 180, +90 the body's left;
 *   ring: az (a flat panel's middle), height on the band (share), outer and inner radius, thickness;
 *   feathers: per feather its plane's offset out from the ring's back (within the ring's thickness), length, half-width, its spine's direction
 *   (the hat's frame), its bow (in its plane, a share of its length), its turn (degrees about its own spine), notches a side;
 *   clear: the crown's clearance outside the head (the pressed hair's room under it).
 */
export const DESIGN = {
  male: {
    C: [0, 1.3, 0.03], pitch: 0, overHair: false,
    sec: [[0, 0.72], [0.24, 0.7], [0.58, 0.63], [0.84, 0.4]], apex: 0.93, slant: [0.08, -0.04],
    oval: [0.88, 1, 0.94], round: 0, panelAz: 30,
    band: {h: 0.24, out: 0.035, edge: 0.04, edgeOut: 0.022},
    brim: {
      R: [[-180, 1.9], [-135, 2.05], [-90, 2.3], [-60, 2.35], [-30, 2.1], [0, 1.95], [30, 2.0], [60, 2.2], [90, 2.35], [120, 2.4], [150, 2.1], [180, 1.9]],
      drop: [[-180, 0.15], [-150, 0.24], [-120, 0.45], [-90, 0.75], [-60, 0.86], [-35, 0.8], [-15, 0.55], [0, 0.28], [20, 0.16], [45, 0.14], [75, 0.18], [105, 0.2], [135, 0.16], [165, 0.14], [180, 0.15]],
      up: [[-180, 0], [-30, 0], [0, 0], [30, 0.06], [60, 0.18], [90, 0.24], [120, 0.2], [150, 0.06], [180, 0]],
      curve: [[-180, 2], [-120, 1.6], [-70, 1.3], [-30, 1.3], [0, 1.8], [30, 2], [180, 2]], T: 0.06, trim: [0.09, 0.045, 0.02],
    },
    ring: {az: 30, at: 1.08, ro: 0.23, ri: 0.095, t: 0.08},
    feathers: [
      {off: 0.05, len: 1.4, w: 0.26, dir: [0.85, 0.5, -0.35], bow: 0.1, turn: 0, notches: 3},
      {off: 0.02, len: 1.05, w: 0.22, dir: [0.55, 0.78, -0.25], bow: 0.1, turn: 0, notches: 3},
    ],
    clear: 0.065,
  },
};
/**
 * Hers: the same design (the sheet: "same design for both genders") at 0.98 of his size, on her head as his sits on his
 * (C, pitch); her crown 0.015 more clearance (the pressed hair's room at her forehead's top, where it would otherwise
 * sink into the scalp), its width then 1.01 of his (her skull longer front to back).
 */
export function scaled(D, k, place) {
  const L = (x) => +(x * k).toFixed(4);
  return {
    ...structuredClone(D), ...place,
    sec: D.sec.map(([h, a]) => [L(h), L(a)]), apex: L(D.apex),
    band: { ...D.band, h: L(D.band.h), out: L(D.band.out), edge: L(D.band.edge), edgeOut: L(D.band.edgeOut) },
    brim: { ...D.brim, R: D.brim.R.map(([a, r]) => [a, L(r)]), drop: D.brim.drop.map(([a, d]) => [a, L(d)]), ...(D.brim.up ? { up: D.brim.up.map(([a, d]) => [a, L(d)]) } : {}), T: L(D.brim.T), trim: D.brim.trim.map(L) },
    ring: { ...D.ring, ro: L(D.ring.ro), ri: L(D.ring.ri), t: L(D.ring.t) },
    feathers: D.feathers.map((f) => ({ ...f, len: L(f.len), w: L(f.w), off: L(f.off) })),
  };
}
DESIGN.female = scaled(DESIGN.male, 0.98, { C: [0, 1.36, 0], pitch: 2, clear: 0.08 });
/** The columns: every 15 degrees, 0 forward, +90 the body's left, in order round. */
export const AZ = Array.from({ length: 24 }, (_, k) => (k <= 12 ? k * 15 : (k - 24) * 15));
/** The crown's panel corners (its seams) among the columns: the panels' middles at panelAz (30) and every 60 from it, a corner at the front and the back as on the sheet's back view. */
export const SEAMS = new Set([0, 60, 120, 180, -60, -120]);

/** The hat's frame: a point in it to the body's space, and back. */
export function frameOf(D) {
  const a = D.pitch * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const toBody = (p) => [p[0] + D.C[0], p[1] * c + p[2] * s + D.C[1], -p[1] * s + p[2] * c + D.C[2]];
  const toHat = (q) => { const x = q[0] - D.C[0], y = q[1] - D.C[1], z = q[2] - D.C[2]; return [x, y * c - z * s, y * s + z * c]; };
  const dirBody = (v) => [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
  return { toBody, toHat, dirBody };
}
const dirOf = (az) => [Math.sin(az * Math.PI / 180), 0, Math.cos(az * Math.PI / 180)];

/** The hexagonal section's radius toward az for apothem a (a panel's middle at 0, ±60, ±120, 180), the oval applied. */
function secR(D, az, a) {
  const rel = (((((az - (D.panelAz ?? 0)) % 60) + 60) % 60) + 30) % 60 - 30, hex = a / Math.cos(rel * Math.PI / 180);
  const r = hex + (a - hex) * D.round, t = az * Math.PI / 180, sx = Math.sin(t), cz = Math.cos(t);
  const [ox, of, ob] = D.oval, oz = cz >= 0 ? of : ob;
  return r * Math.hypot(sx * ox, cz * oz);
}

/** The hairstyles drawn pressed under the hat (the game's '<style>:hat'); the others are drawn as they are. */
const PRESSED = ['swept', 'bob', 'pompadour', 'topknot', 'crew', 'mohawk', 'cornrows', 'buzz', 'afro', 'warrior', 'pixie'];
/** The head's and the hair's points in the hat's frame (the body's head samples, the hair's vertices and samples). */
const HAIR = JSON.parse(readFileSync(new URL('../../../src/sculpt/assets/lowhair.json', import.meta.url), 'utf8'));
export function hairMesh(who, style = 'swept') {
  const h = HAIR[who][style], verts = [];
  for (let i = 0; i < h.verts.length; i += 3) verts.push([h.verts[i], h.verts[i + 1], h.verts[i + 2]]);
  const tris = []; for (let i = 0; i < h.tris.length; i += 4) tris.push({ v: [h.tris[i], h.tris[i + 1], h.tris[i + 2]], poly: h.tris[i + 3] });
  return { verts, tris, polys: h.polys, mat: h.mat, shave: h.shave };
}
function obstacle(rig, D) {
  const F = frameOf(D), B = rig.B;
  const headTris = B.tris.filter((t) => t.v.every((i) => B.part[i] === 'head'));
  // (the head alone when the hair is pressed under the hat, `hatHair`: the crown sized to the skull, the hair's room the
  // crown's clearance)
  const H = D.overHair ? hairMesh(rig.who) : { tris: [], verts: [] };
  const S = [...samplesOf({ tris: headTris }, B.verts, 0.05), ...samplesOf({ tris: H.tris }, H.verts, 0.05)];
  return S.map((p) => F.toHat(p));
}
/**
 * The obstacle's reach (the head's and the hair's) in the hat's frame: per azimuth (every 3 degrees) and height (every
 * 0.02) the greatest radius of its points within `half` degrees, grown by 1/cos(half); reach(az, h) the greatest within
 * dh of h. Cached per body and placement.
 */
const REACH = new Map();
function reachOf(rig, D, half = 9, dh = 0.06) {
  const key = `${rig.who}|${D.C.join(',')}|${D.pitch}|${!!D.overHair}`;
  if (REACH.has(key)) return REACH.get(key);
  const O = obstacle(rig, D), NA = 120, H0 = -0.6, NH = 120, grid = new Float32Array(NA * NH), k = 1 / Math.cos(half * Math.PI / 180);
  for (const p of O) {
    const hi = Math.round((p[1] - H0) / 0.02); if (hi < 0 || hi >= NH) continue;
    const a = Math.atan2(p[0], p[2]) * 180 / Math.PI, r = Math.hypot(p[0], p[2]) * k;
    for (let j = Math.ceil((a - half) / 3); j <= Math.floor((a + half) / 3); j++) { const ai = ((j % NA) + NA) % NA, i = ai * NH + hi; if (r > grid[i]) grid[i] = r; }
  }
  const at = (ai, hi) => (hi < 0 || hi >= NH ? 0 : grid[(((ai % NA) + NA) % NA) * NH + hi]);
  const reach = (az, h) => {
    const a0 = Math.floor(az / 3), t = az / 3 - a0, h0 = Math.ceil((h - dh - H0) / 0.02), h1 = Math.floor((h + dh - H0) / 0.02);
    let r = 0;
    for (let hi = h0; hi <= h1; hi++) r = Math.max(r, at(a0, hi) * (1 - t) + at(a0 + 1, hi) * t, t > 0.5 ? at(a0 + 1, hi) : at(a0, hi));
    return r;
  };
  REACH.set(key, reach);
  return reach;
}

export function buildHat(rig, design = DESIGN[rig.who]) {
  const D = design, F = frameOf(D), G = meshOf(), reach = reachOf(rig, D), N = AZ.length;
  const BAND = D.band, BR = D.brim;
  const A = (h) => interp(D.sec, h);
  // the crown's radius toward az at height h: the section, scaled up as one (its panels kept flat) until it clears the
  // obstacle all round (every 5 degrees)
  const need = (az, h) => { const r = reach(az, h); return r > 0 ? r + D.clear : 0; };
  const AZ5 = Array.from({ length: 72 }, (_, k) => k * 5 - 180), FAC = new Map();
  const facAt = (h) => { const key = h.toFixed(4); if (!FAC.has(key)) FAC.set(key, Math.max(1, ...AZ5.map((az) => need(az, h) / secR(D, az, A(h))))); return FAC.get(key); };
  const rAt = (az, h) => secR(D, az, A(h)) * facAt(h);
  const P = (az, r, h) => { const d = dirOf(az); return [d[0] * r, h, d[2] * r]; };
  const V = (p, part) => G.vert(F.toBody(p), part);

  /* ---- the crown: per column the stations up from the foot ---- */
  const e = BAND.edge, eo = BAND.edgeOut, bo = BAND.out, bh = BAND.h;
  const hw = D.sec[2][0], hs = D.sec[3]?.[0], ht = D.sec[4]?.[0];
  const ST = [
    // [name, h, extra out, material of the face above it]
    ['foot', 0, bo + eo, 'rune'], ['e1', e, bo + eo, 'leather'], ['e1i', e, bo, 'leather'], ['e2i', bh - e, bo, 'rune'], ['e2', bh - e, bo + eo, 'rune'], ['bt', bh, bo + eo, 'leather'],
    ['bti', bh, 0, 'leather'], ['wall', hw, 0, 'leather'], ...(hs ? [['sh', hs, 0, 'leather']] : []), ...(ht ? [['top', ht, 0, 'leather']] : []),
  ];
  // (the crown never wider higher up than its design's taper allows: each station at least the one over it, scaled by
  // the design's own taper, so a push for the hair high up carries down the wall and the band)
  const baseR = AZ.map((az) => { const r = ST.map(([, h]) => rAt(az, h)); for (let s = ST.length - 2; s >= 0; s--) r[s] = Math.max(r[s], r[s + 1] * secR(D, az, A(ST[s][1])) / secR(D, az, A(ST[s + 1][1]))); return r; });
  const crownR = AZ.map((az, k) => ST.map(([, h, out], s) => baseR[k][s] + out));
  // (the crown's surface, less the band, toward any azimuth at any height: the section scaled as the stations are)
  const facS = () => ST.map(([, h], s) => [h, baseR[0][s] / secR(D, AZ[0], A(h))]).filter(([h], i, L) => i === 0 || h > L[i - 1][0]);
  let FS = facS();
  const surfR = (az, h) => secR(D, az, A(h)) * interp(FS, h);
  // (between the stations too: each segment above the band pushed out until every height along it clears the head and
  // the hair; the apex raised until the top's facets clear them)
  const ib = ST.findIndex(([n]) => n === 'bti');
  for (let s = ib; s + 1 < ST.length; s++) {
    const [ha, hb] = [ST[s][1], ST[s + 1][1]], ra = (az) => secR(D, az, A(ha)) * crownR[0][s] / secR(D, AZ[0], A(ha)), rb = (az) => secR(D, az, A(hb)) * crownR[0][s + 1] / secR(D, AZ[0], A(hb));
    let f = 1; for (const az of AZ5) for (let q = 1; q < 8; q++) { const t = q / 8, h = ha + (hb - ha) * t; f = Math.max(f, need(az, h) / (ra(az) * (1 - t) + rb(az) * t)); }
    if (f > 1) for (let k = 0; k < N; k++) { crownR[k][s + 1] *= f; if (s > ib) crownR[k][s] *= f; }
  }
  FS = ST.map(([, h, out], s) => [h, (crownR[0][s] - out) / secR(D, AZ[0], A(h))]).filter(([h], i, L) => i === 0 || h > L[i - 1][0]);
  let apexH = D.apex;
  for (let it = 0; it < 40; it++) {
    const hs0 = ST[ST.length - 1][1];
    const top = (az) => secR(D, az, A(hs0)) * crownR[0][ST.length - 1] / secR(D, AZ[0], A(hs0));
    const ok = AZ5.every((az) => { for (let q = 1; q < 10; q++) { const t = q / 10, h = hs0 + (apexH - hs0) * t; if (top(az) * (1 - t) < need(az, h)) return false; } return true; });
    if (ok) break; apexH += 0.02;
  }
  G.apexH = apexH; G.crownR = crownR; G.ST = ST;
  if (process.env.HATDBG) for (const [n, h] of ST) { const f = AZ5.map((az) => [az, need(az, h) / secR(D, az, A(h))]).sort((a, b) => b[1] - a[1]); console.log(n, h.toFixed(2), f.slice(0, 3).map(([a, v]) => `${a}:${v.toFixed(3)}`).join(" "), "need0", need(0, h).toFixed(3), "need90", need(90, h).toFixed(3), "need180", need(180, h).toFixed(3)); }
  // (the top slanted: from the wall's top up, each ring raised by `slant` [per unit across, per unit forward] of where
  // it lies, the band and the apex as they are)
  const iw = ST.findIndex(([n]) => n === 'wall'), [sx, sz] = D.slant ?? [0, 0];
  const lift = (az, r, s) => (s >= iw ? (sx * Math.sin(az * Math.PI / 180) + sz * Math.cos(az * Math.PI / 180)) * r : 0);
  const crown = AZ.map((az, k) => ST.map(([, h], s) => V(P(az, crownR[k][s], h + lift(az, crownR[k][s], s)), 'crown')));
  const apex = V([0, apexH, 0], 'crown');
  G.tag = 'crown';
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    for (let s = 0; s + 1 < ST.length; s++) {
      const mat = ST[s][3];
      G.tag = s < 6 ? 'band' : 'crown';
      G.poly([crown[k][s], crown[k2][s], crown[k2][s + 1], crown[k][s + 1]], mat, 'crown');
    }
    G.tag = 'crown';
    G.poly([crown[k][ST.length - 1], crown[k2][ST.length - 1], apex], 'leather', 'crown');
  }

  /* ---- the crown's seams: a raised bead along each panel corner, from the band's top to the apex ---- */
  {
    const Pv = (i) => G.verts[i], sw = D.seam?.w ?? 0.018, so = D.seam?.out ?? 0.013;
    const axis = (y) => F.toBody([0, y, 0]);
    AZ.forEach((az, k) => {
      if (!SEAMS.has(az)) return;
      const kl = (k + N - 1) % N, kr = (k + 1) % N, rows = [];
      for (let st = ib; st < ST.length; st++) {
        // (the first row a little over the band's top step)
        const lift = (kk) => (st === ib ? lerp(Pv(crown[kk][st]), Pv(crown[kk][st + 1]), 0.05) : Pv(crown[kk][st]));
        const c = lift(k), dl = unit(sub(lift(kl), c)), dr = unit(sub(lift(kr), c));
        const hb = F.toHat(c), o = unit(sub(c, axis(hb[1])));
        rows.push([V(F.toHat(add(add(c, mul(dl, sw)), mul(o, 0.004))), 'crown'), V(F.toHat(add(c, mul(o, so))), 'crown'), V(F.toHat(add(add(c, mul(dr, sw)), mul(o, 0.004))), 'crown')]);
      }
      // (up the top's facet to just short of the apex)
      const a = Pv(apex), c = Pv(crown[k][ST.length - 1]), tip = add(c, mul(sub(a, c), 0.85)), o = unit(cross(sub(Pv(crown[kr][ST.length - 1]), c), sub(a, c)));
      const oo = dot(o, sub(c, axis(F.toHat(c)[1]))) < 0 ? mul(o, -1) : o;
      rows.push([V(F.toHat(add(tip, mul(oo, 0.004))), 'crown'), V(F.toHat(add(tip, mul(oo, so * 0.7))), 'crown'), V(F.toHat(add(tip, mul(oo, 0.004))), 'crown')]);
      G.tag = 'seam';
      for (let i = 0; i + 1 < rows.length; i++) { G.poly([rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]], 'trim', 'crown'); G.poly([rows[i][1], rows[i + 1][1], rows[i + 1][2], rows[i][2]], 'trim', 'crown'); }
    });
  }

  /* ---- the band's stitch dividers: small raised blocks between its edge strips, every 30 degrees off the ring ---- */
  {
    const dw = BAND.divW ?? 0.035;
    for (const az of AZ.filter((a) => ((a % 30) + 30) % 30 === 15)) {
      if (Math.abs(((az - D.ring.az + 540) % 360) - 180) < (D.ring.ro / 1.0) * 180 / Math.PI + 6) continue;
      const n = dirOf(az), side = cross([0, 1, 0], n), corners = [];
      for (const h of [e + 0.004, bh - e - 0.004]) for (const sg of [-1, 1]) {
        // (on the band's face, along it: its corners at the azimuths dw either side)
        const a2 = az + sg * (dw / (surfR(az, h) + bo)) * 180 / Math.PI, base = P(a2, surfR(a2, h) + bo, h);
        corners.push([V(add(base, mul(n, 0.003)), 'crown'), V(add(base, mul(n, eo * 0.9)), 'crown')]);
      }
      // (corners: [bottom left, bottom right, top left, top right], each [at the band's face, standing out])
      const [bl, br, tl, tr] = corners;
      G.tag = 'divider';
      G.poly([bl[1], br[1], tr[1], tl[1]], 'trim', 'crown');
      G.poly([bl[0], bl[1], tl[1], tl[0]], 'trim', 'crown');
      G.poly([br[0], tr[0], tr[1], br[1]], 'trim', 'crown');
    }
  }

  /* ---- the brim: from the crown's foot out, its trim bead, its underside back to the sweatband ---- */
  const TS = [0, 0.2, 0.42, 0.64, 0.84, 1];
  const [tw, th, tov] = BR.trim;
  const brim = AZ.map((az) => {
    const r0 = crownR[AZ.indexOf(az)][0], R = byAz(BR.R, az), Dd = byAz(BR.drop, az), Up = BR.up ? byAz(BR.up, az) : 0;
    // (the brim's height at radius r: down by `drop` at the edge along the power `curve`, up by `up` at the edge along the
    // cube: a tip that sweeps up)
    const cv = typeof BR.curve === 'number' ? BR.curve : byAz(BR.curve, az), y = (r) => { const q = (r - r0) / (R - r0); return -Dd * Math.pow(q, cv) + Up * q * q * q; };
    const top = TS.map((t) => { const r = r0 + (R - tw - r0) * t; return [r, y(r)]; });
    // the profile's tangent at the edge, and its normal (up)
    const E = [R - tw, y(R - tw)], E2 = [R, y(R)];
    const tau = (() => { const v = [E2[0] - E[0], E2[1] - E[1]], l = Math.hypot(...v); return [v[0] / l, v[1] / l]; })(), nu = [-tau[1], tau[0]];
    const at = (p, a, b) => [p[0] + tau[0] * a + nu[0] * b, p[1] + tau[1] * a + nu[1] * b];
    const T = BR.T;
    const trim = [at(E, 0, th), at(E, tw * 0.8, th), at(E, tw + tov, th * 0.35), at(E, tw + tov, -T - th * 0.2), at(E, tw * 0.8, -T - th * 0.6), at(E, 0, -T - th * 0.6)];
    // the underside: the top moved down by T along each ring's normal (approximately straight down the axis)
    const under = top.slice().reverse().map(([r, h], i, L) => [r, h - T]);
    under[under.length - 1] = [r0 - T * 0.4 - bo - eo, -T];
    const sweat = [[r0 - T * 0.4 - bo - eo, 0.04]];
    return { az, prof: [...top, ...trim, ...under, ...sweat], nTop: top.length, nTrim: trim.length };
  });
  const bv = brim.map(({ az, prof }, k) => prof.map(([r, h], i) => (i === 0 ? crown[k][0] : V(P(az, r, h), 'brim'))));
  const nP = brim[0].prof.length, nT = brim[0].nTop, nR = brim[0].nTrim;
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    for (let i = 0; i + 1 < nP; i++) {
      const mat = i < nT - 1 ? 'leather' : i === nT - 1 ? 'leather' : i < nT + nR - 1 ? 'trim' : i < nP - 2 ? 'leather' : 'dark';
      G.tag = i < nT ? 'brim' : i < nT + nR - 1 ? 'trim' : i < nP - 2 ? 'under' : 'sweat';
      G.poly([bv[k][i], bv[k2][i], bv[k2][i + 1], bv[k][i + 1]], mat, 'brim');
    }
  }

  /* ---- the ring on the band: flush on the band's edge strips, on the middle of a flat panel ---- */
  const R0 = D.ring, ringH = bh * R0.at;
  const ringN = dirOf(R0.az), ringUp = [0, 1, 0], ringSide = cross(ringUp, ringN);
  // (its back on the furthest point of the band under it: a flat panel's edge strips)
  let ringR = 0; for (let d = -20; d <= 20; d += 1) for (const dh of [-R0.ro, 0, R0.ro]) { const h = Math.max(0, Math.min(bh, ringH + dh)); ringR = Math.max(ringR, (surfR(R0.az + d, h) + bo + eo) * Math.cos(d * Math.PI / 180)); }
  ringR += 0.004;
  const ringC = P(R0.az, ringR, ringH);
  {
    const pt = (rad, ang, off) => add(add(ringC, mul(ringN, off)), add(mul(ringSide, rad * Math.cos(ang)), mul(ringUp, rad * Math.sin(ang))));
    const K = 16, ro = R0.ro, ri = R0.ri, t = R0.t;
    // (each spoke: the outer foot, the outer bevel, the face's outer, the face's inner, the inner bevel, the inner foot)
    const prof = [[ro, 0], [ro, t * 0.6], [ro - (ro - ri) * 0.2, t], [ri + (ro - ri) * 0.2, t], [ri, t * 0.6], [ri, 0]];
    // (its feet, outer and inner, back on the surface behind them: the band's strips, or the crown's wall over the band)
    const surf = (rad, ang) => {
      const q = pt(rad, ang, 0), az = Math.atan2(q[0], q[2]) * 180 / Math.PI, h = q[1];
      const r = h <= bh ? surfR(az, Math.max(0, h)) + bo + eo : surfR(az, h);
      return r * Math.cos((az - R0.az) * Math.PI / 180) - ringR + 0.003;
    };
    // (each foot no deeper than its neighbours' and the points between: the chords between the feet clear the band's
    // top step)
    const foot = (rad, j) => Math.max(...[-1, -0.5, 0, 0.5, 1].map((d) => surf(rad, ((j + d) / K) * Math.PI * 2)));
    const rv = Array.from({ length: K }, (_, j) => { const ang = (j / K) * Math.PI * 2; return prof.map(([rad, off], i) => V(pt(rad, ang, i === 0 || i === prof.length - 1 ? foot(rad, j) : off), 'ring')); });
    G.tag = 'ring';
    for (let j = 0; j < K; j++) for (let i = 0; i + 1 < prof.length; i++) G.poly([rv[j][i], rv[(j + 1) % K][i], rv[(j + 1) % K][i + 1], rv[j][i + 1]], 'rune', 'ring');
  }

  /* ---- the feathers ---- */
  D.feathers.forEach((f, fi) => {
    // (its spine out from behind the ring: from the ring's centre `off` out from its back, its root just outside the
    // ring's rim, so the ring hides where it is tucked)
    const n0 = ringN, u = unit(f.dir), ut = Math.hypot(dot(u, ringSide), dot(u, ringUp)) || 1;
    const base = add(add(ringC, mul(ringN, f.off)), mul(u, (R0.ro + 0.012) / ut));
    // the vane's width direction: across the spine, in the plane facing out (turned by `turn` about the spine)
    let wv = unit(cross(n0, u)); const tn = f.turn * Math.PI / 180, nn = unit(cross(u, wv));
    wv = unit(add(mul(wv, Math.cos(tn)), mul(nn, Math.sin(tn))));
    const nrm = unit(cross(u, wv));
    const quill = 0.14 * f.len, L = f.len, th = 0.012, rib = 0.016;
    const spine = (s) => add(base, add(mul(u, s), mul(wv, f.bow * L * ((s / (L + quill)) ** 2))));
    G.tag = `feather ${fi}`;
    // quill: a thin square stick from the band to the vane's root
    {
      const q0 = base, q1 = spine(quill - 0.012), qw = 0.022;
      const ring = (p) => [0, 1, 2, 3].map((j) => V(add(p, add(mul(wv, qw * Math.cos(j * Math.PI / 2 + Math.PI / 4)), mul(nrm, qw * Math.sin(j * Math.PI / 2 + Math.PI / 4)))), 'feather'));
      const a0 = ring(q0), a1 = ring(q1);
      for (let j = 0; j < 4; j++) G.poly([a0[j], a0[(j + 1) % 4], a1[(j + 1) % 4], a1[j]], 'trim', 'feather');
      G.poly([a1[0], a1[1], a1[2], a1[3]], 'trim', 'feather');
    }
    // the vane: stations along the spine, each with its two edges: a leaf (widest at 0.4 of its length, a long point),
    // the upper edge (toward the bow) cut by `notches` slits and the lower by one fewer: each slit three close stations,
    // its floor at 0.45 of the width, a little back toward the quill, as the sheet's barbs part
    const at = (k, from, to) => Array.from({ length: k }, (_, j) => (k === 1 ? (from + to) / 2 : from + (to - from) * j / (k - 1)));
    const cutL = at(f.notches, 0.32, 0.74), cutR = at(Math.max(1, f.notches - 1), 0.42, 0.66), e = 0.02;
    const T = [...Array.from({ length: 11 }, (_, i) => i / 10), ...[...cutL, ...cutR].flatMap((c) => [c - e, c, c + e])].sort((x, y) => x - y).filter((t, i, A) => i === 0 || t - A[i - 1] > 0.004);
    const n = T.length - 1;
    const sv = [];
    for (let i = 0; i <= n; i++) {
      const t = T[i], s = quill + L * t, sp = spine(s);
      const w0 = f.w * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
      const floor = (cs) => cs.some((c) => Math.abs(c - t) < 1e-9);
      const edge = (sg, k, cut) => add(sp, add(mul(wv, sg * w0 * k * (cut ? 0.45 : 1)), mul(u, cut ? -0.4 * e * L : 0)));
      const L_ = edge(1, 1, floor(cutL)), R_ = edge(-1, 0.85, floor(cutR));
      sv.push({ s: [V(add(sp, mul(nrm, th + rib)), 'feather'), V(add(sp, mul(nrm, -th - rib * 0.6)), 'feather')], l: [V(add(L_, mul(nrm, th)), 'feather'), V(add(L_, mul(nrm, -th)), 'feather')], r: [V(add(R_, mul(nrm, th)), 'feather'), V(add(R_, mul(nrm, -th)), 'feather')] });
    }
    for (let i = 0; i < n; i++) {
      const A0 = sv[i], A1 = sv[i + 1];
      for (const side of ['l', 'r']) {
        G.poly([A0.s[0], A1.s[0], A1[side][0], A0[side][0]], 'trim', 'feather');
        G.poly([A0.s[1], A1.s[1], A1[side][1], A0[side][1]], 'trim', 'feather');
        G.poly([A0[side][0], A1[side][0], A1[side][1], A0[side][1]], 'trim', 'feather');
      }
    }
    // (the root's and the tip's ends left open: the vane is no wider than its rib there, the root behind the ring)
  });

  // outward: away from the hat's axis (the brim's underside down, the crown out)
  const ax = F.toBody([0, 0.3, 0]);
  orient(G, (c) => unit(sub(c, ax)));
  G.tris = trisOf(G);
  for (const p of G.polys) p.piece = p.tag?.startsWith('feather') ? 'feather' : p.tag;
  G.design = D;
  return G;
}

/**
 * The hair pressed under the hat (the swept-back hair, src/sculpt/assets/lowhair.json, as the game draws it while the hat
 * is worn): each of its vertices moved along the ray from the skull's middle (the middle of the head's box above the
 * eyes) through it, its height over the scalp h on that ray, where the ray meets the hat (its crown, band and brim: the
 * hat's inside) within `room` = the hat less `gap` less the scalp, pressed to room * tanh(h / room) (no higher than it
 * was, the tufts' ridges and valleys kept in order, the hair out from under the brim as it was; where a pressed triangle
 * would sink into the scalp that the hair's own does not, its corners let up again). Rigid on the head as
 * the hat and the hair are, so pressed once for every pose. Its polygons, materials, triangles, weights and shave as
 * the hair's: { verts, tris, polys, mat, shave, pressed: [vertex, moved by], room: [least, ...] }.
 */
export function hatHair(rig, G, { gap = 0.025, least = 0.02, style = 'swept', pull = 0.008 } = {}) {
  const H = hairMesh(rig.who, style), B = rig.B;
  const headV = B.verts.filter((_, i) => B.part[i] === 'head' && B.verts[i][1] > 1.0);
  const box = [0, 1, 2].map((c) => [Math.min(...headV.map((p) => p[c])), Math.max(...headV.map((p) => p[c]))]);
  const O = box.map(([a, b]) => (a + b) / 2);
  const headT = B.tris.filter((t) => t.v.every((i) => B.part[i] === 'head')).map((t) => t.v.map((i) => B.verts[i]));
  const hatT = G.tris.filter((t) => !['feather', 'ring'].includes(G.polys[t.poly].piece)).map((t) => t.v.map((i) => G.verts[i]));
  // (the nearest hit of the ray from O along d, over a list of triangles: Möller–Trumbore)
  const hit = (d, T) => {
    let best = Infinity;
    for (const [a, b, c] of T) {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const iv = 1 / det, s = sub(O, a), u = dot(s, p) * iv; if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = dot(d, q) * iv; if (v < 0 || u + v > 1) continue;
      const t = dot(e2, q) * iv; if (t > 1e-6 && t < best) best = t;
    }
    return best;
  };
  const rooms = [], ray = H.verts.map((p) => {
    const w = sub(p, O), tv = Math.hypot(...w), d = mul(w, 1 / tv), ts = hit(d, headT), tc = hit(d, hatT), h = tv - ts;
    if (!Number.isFinite(tc) || !Number.isFinite(ts) || h <= 0) return null;
    const room = Math.max(least, tc - gap - ts); rooms.push(room);
    return { d, ts, h, room, cap: Math.min(h, tc - gap / 5 - ts), h2: room * Math.tanh(h / room) };
  });
  const at = (i) => (ray[i] ? add(O, mul(ray[i].d, ray[i].ts + ray[i].h2)) : H.verts[i]);
  let verts = H.verts.map((_, i) => at(i));
  // (where a pressed triangle would sink into the scalp that the hair's own did not: its pressed corners let up 0.01 at
  // a time, toward the hair's height and no nearer the hat than a fifth of the gap, until it clears)
  const headTi = B.tris.filter((t) => t.v.every((i) => B.part[i] === 'head')), hatTi = G.tris.filter((t) => !['feather', 'ring'].includes(G.polys[t.poly].piece));
  const was = new Set(crossPairs(H.verts, H.tris, B.verts, headTi).map(([i]) => i));
  for (let it = 0; it < 40; it++) {
    const sink = crossPairs(verts, H.tris, B.verts, headTi).map(([i]) => i).filter((i) => !was.has(i));
    if (!sink.length) break;
    for (const ti of new Set(sink)) for (const v of H.tris[ti].v) if (ray[v]) ray[v].h2 = Math.min(ray[v].cap, ray[v].h2 + 0.01);
    verts = H.verts.map((_, i) => at(i));
  }
  // (a hairstyle that hangs below the hat, the bob, the shoulder length: a triangle of it still through the hat drawn in under the band, its
  // corners moved level toward the head's upright axis `pull` at a time; a corner that would sink a triangle into the
  // head held where it was)
  for (let it = 0; it < 120; it++) {
    const hits = crossPairs(G.verts, hatTi, verts, H.tris).map(([, j]) => j);
    if (!hits.length) break;
    const before = verts.map((p) => p);
    for (const v of new Set(hits.flatMap((j) => H.tris[j].v))) {
      const d = [verts[v][0] - O[0], 0, verts[v][2] - O[2]], l = Math.hypot(...d);
      if (l > 0.05) verts[v] = add(verts[v], mul(d, -pull / l));
    }
    for (const ti of new Set(crossPairs(verts, H.tris, B.verts, headTi).map(([i]) => i).filter((i) => !was.has(i)))) for (const v of H.tris[ti].v) verts[v] = before[v];
  }
  const pressed = ray.map((r, i) => (r && r.h - r.h2 > 1e-4 ? [i, +(r.h - r.h2).toFixed(4)] : null)).filter(Boolean);
  return { ...H, verts, pressed, room: rooms.length ? Math.min(...rooms) : null, O, hatCross: crossPairs(G.verts, hatTi, verts, H.tris).length };
}

export function hatWeights(rig, G) {
  const head = rig.at.get('head');
  return G.verts.map(() => [[head, 1]]);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildHat(rig);
    G.vw = hatWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowhat-${who}.json`, import.meta.url);
    // (the swept-back hair pressed under the hat, hatHair: the game draws it in the hair's place while the hat is worn,
    // its polygons, materials, triangles, weights and shave the hair's own)
    const hair = {}, said = [];
    for (const style of PRESSED) {
      const H = hatHair(rig, G, { style }), H0 = HAIR[who][style];
      hair[style] = { ...H0, verts: H.verts.flat().map((x) => +x.toFixed(5)) };
      said.push(`${style} ${H.pressed.length} of ${H.verts.length} vertices pressed, least room ${H.room.toFixed(3)}, ${H.hatCross} crossing the hat`);
    }
    const A = { built: 'node tools/sculpt/garments/hat.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hair };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, the hair pressed under it (${said.join('; ')}): wrote`, file.pathname);
  }
}
