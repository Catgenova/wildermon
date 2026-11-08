// The leather set's feathered cap (the hat sheet: a wide-brim adventurer's cap, a six-panel faceted crown of medium
// height, a wrap band with a ring ornament, a wide angled brim with a raised trim edge that drops more at the sides than
// at the front, two angled feathers in the trim colour; it sits above the brow), fitted to each low-poly body from the
// one design (DESIGN, per body), over the approved swept-back hair (src/sculpt/assets/lowhair.json, its crown pushed out
// until it clears the head and the hair). Rigid on the head bone; no bones of its own.
//
//   buildHat(rig, design) → { verts, polys: [{ v, mat, part, tag, piece }], tris, part, design }
//   hatWeights(rig, G) → per vertex [[bone, weight], ...] (the head only)
//
//   node tools/sculpt/garments/hat.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowhat-male.json and lowhat-female.json
//     (lowgarment.mjs garmentAsset with its plain and enchanted looks; loaded by src/sculpt/lowpoly.ts)
//
// The construction, in the hat's own frame: its origin C on the head (the crown's foot, the brim's root), y up the hat's
// axis, the frame tipped back by `pitch` (degrees, the front up) about the body's x; azimuth 0 forward, +90 toward the
// body's left. Columns every 15 degrees (AZ).
//   the crown: stations up the axis (the band's foot, its edge strips, its top step, the wall, the shoulder, the apex),
//   each a hexagonal section (`sec`: six flat panels, a panel's middle forward, their corners at ±30, ±90, ±150) scaled
//   to an oval (`oval`), then pushed out along its column until it clears the head and the hair by `clear`;
//   the brim: from the crown's foot out to the outer radius `R` (by azimuth), dropping by `drop` (by azimuth) along the
//   power curve `curve`, its underside `T` under it; the trim: a raised bead round the outer edge (`trim`), over the edge
//   onto the underside; the sweatband: the underside's root up inside the crown (hidden, the hat's thickness shown at the
//   foot);
//   the ring: a bevelled washer on the band's face at azimuth `ring.az`;
//   the feathers: thin vanes with a raised rib and notched edges, each with its quill, rising behind the ring.
// Materials: leather (the crown, the brim), dark (the band), light (the brim's underside), trim (the brim's trim, the
// seams, the feathers), rune (the ring and the band's edge strips: trim plain, glowing enchanted).
import { meshOf, orient, trisOf, samplesOf, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { readFileSync } from 'node:fs';

/**
 * The leather set's shared colours (the sheet's swatches, sRGB to nought to one; the chest agent's exact values replace
 * these when relayed): dark (81,47,44), leather (112,60,43), light (148,81,54), trim (222,132,79), rune (its plain look
 * the trim; enchanted the glow (254,202,109), unlit).
 */
const s8 = (r, g, b) => [r / 255, g / 255, b / 255];
export const MATS = {
  dark: s8(81, 47, 44),
  leather: s8(112, 60, 43),
  light: s8(148, 81, 54),
  trim: s8(222, 132, 79),
  rune: s8(222, 132, 79),
};
export const GLOW = s8(254, 202, 109);
/** The two looks (lowgarment.mjs garmentAsset `looks`): plain, every material lit (kind 0); enchanted, the rune glowing, unlit. */
export const LOOKS = { plain: {}, enchanted: { rune: { c: GLOW, kind: 1 } } };

const interp = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / Math.max(1e-9, P[i + 1][0] - P[i][0]);
  return P[P.length - 1][1];
};
/** A table by azimuth: symmetric ([[|az|, v]]) or, with `left` and `right` keys, per side. */
const byAz = (T, az) => interp(T, Math.abs(az));

/**
 * The design per body (the body's units: y up, the chin's underside 0; z forward; x the body's left):
 *   C: the hat's origin (the crown's foot on the axis); pitch: the hat tipped back (degrees, the front up);
 *   sec: the crown's stations [h, apothem]: the foot, the band's top, the wall's top, the shoulder; apex: the apex's height;
 *   oval: the section's scale across (x), forward and back; round: how far a panel bulges toward the circle (0 flat);
 *   band: its height, how far it stands out, its edge strips' height and how far they stand out again;
 *   brim: R (outer radius by azimuth), drop (by azimuth), curve (the drop's power along the brim), T (thickness),
 *   trim: [width, height, overhang];
 *   ring: az, height on the band (share), outer and inner radius, thickness;
 *   feathers: per feather its root's azimuth and height over the band's top, length, half-width, its spine's direction
 *   (the hat's frame), its bow (in its plane, a share of its length), its turn (degrees about its own spine), notches a side;
 *   clear: the crown's clearance outside the head and the hair.
 */
export const DESIGN = {
  male: {
    C: [0, 1.5, -0.04], pitch: 4,
    sec: [[0, 0.98], [0.3, 0.97], [0.56, 0.875], [0.88, 0.72]], apex: 1.14,
    oval: [1, 1.09, 1.07], round: 0.15,
    band: {h: 0.32, out: 0.04, edge: 0.045, edgeOut: 0.025},
    brim: {R: [[0, 1.54], [90, 1.95], [180, 1.84]], drop: [[0, 0.34], [30, 0.6], [60, 0.88], [90, 0.7], [135, 0.55], [180, 0.55]], curve: 2.3, T: 0.06, trim: [0.09, 0.045, 0.02]},
    ring: {az: 36, at: 0.5, ro: 0.17, ri: 0.085, t: 0.05},
    feathers: [
      {az: 42, up: -0.1, len: 1.5, w: 0.27, dir: [0.425, 0.45, -0.72], bow: 0.06, turn: 0, notches: 4},
      {az: 38, up: -0.12, len: 1.1, w: 0.24, dir: [0.325, 0.8, -0.575], bow: 0.06, turn: 0, notches: 3},
    ],
    clear: 0.04,
  },
};
/**
 * Hers: the same design (the sheet: "same design for both genders") at 0.98 of his size (the sheet draws her hat as
 * large as his on a head 0.92 as wide: her equipped view's overlap best at 0.98, 77.3% to 76.3% at 0.94), on her head
 * where the sheet's equipped view puts it (C, pitch); the crown's clearance pushes it out where her head and hair need it.
 */
export function scaled(D, k, place) {
  const L = (x) => +(x * k).toFixed(4);
  return {
    ...structuredClone(D), ...place,
    sec: D.sec.map(([h, a]) => [L(h), L(a)]), apex: L(D.apex),
    band: { ...D.band, h: L(D.band.h), out: L(D.band.out), edge: L(D.band.edge), edgeOut: L(D.band.edgeOut) },
    brim: { ...D.brim, R: D.brim.R.map(([a, r]) => [a, L(r)]), drop: D.brim.drop.map(([a, d]) => [a, L(d)]), T: L(D.brim.T), trim: D.brim.trim.map(L) },
    ring: { ...D.ring, ro: L(D.ring.ro), ri: L(D.ring.ri), t: L(D.ring.t) },
    feathers: D.feathers.map((f) => ({ ...f, len: L(f.len), w: L(f.w), up: L(f.up) })),
  };
}
DESIGN.female = scaled(DESIGN.male, 0.98, { C: [0, 1.62, -0.09], pitch: 7 });
/** The columns: every 15 degrees, 0 forward, +90 the body's left, in order round. */
export const AZ = Array.from({ length: 24 }, (_, k) => (k <= 12 ? k * 15 : (k - 24) * 15));
/** The crown's panel corners (its seams) among the columns. */
export const SEAMS = new Set([30, 90, 150, -30, -90, -150]);

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
  const rel = ((((az % 60) + 60) % 60) + 30) % 60 - 30, hex = a / Math.cos(rel * Math.PI / 180);
  const r = hex + (a - hex) * D.round, t = az * Math.PI / 180, sx = Math.sin(t), cz = Math.cos(t);
  const [ox, of, ob] = D.oval, oz = cz >= 0 ? of : ob;
  return r * Math.hypot(sx * ox, cz * oz);
}

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
  const H = hairMesh(rig.who);
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
  const key = `${rig.who}|${D.C.join(',')}|${D.pitch}`;
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
  // per column the crown's radius at height h: the section, pushed out to clear the obstacle
  const need = (az, h) => reach(az, h) + D.clear;
  const rAt = (az, h) => Math.max(secR(D, az, A(h)), need(az, h));
  const P = (az, r, h) => { const d = dirOf(az); return [d[0] * r, h, d[2] * r]; };
  const V = (p, part) => G.vert(F.toBody(p), part);

  /* ---- the crown: per column the stations up from the foot ---- */
  const e = BAND.edge, eo = BAND.edgeOut, bo = BAND.out, bh = BAND.h;
  const hw = D.sec[2][0], hs = D.sec[3][0];
  const ST = [
    // [name, h, extra out, material of the face above it]
    ['foot', 0, bo + eo, 'rune'], ['e1', e, bo + eo, 'dark'], ['e1i', e, bo, 'dark'], ['e2i', bh - e, bo, 'rune'], ['e2', bh - e, bo + eo, 'rune'], ['bt', bh, bo + eo, 'leather'],
    ['bti', bh, 0, 'leather'], ['wall', hw, 0, 'leather'], ['sh', hs, 0, 'leather'],
  ];
  const rBase = AZ.map((az) => rAt(az, 0));
  const crown = AZ.map((az, k) => ST.map(([name, h, out]) => {
    // (the band's stations at the foot's radius at least: the band wraps the crown's foot)
    const r = (h <= bh ? Math.max(rAt(az, h), rBase[k] - 0.02 * h) : rAt(az, h)) + out;
    return V(P(az, r, h), 'crown');
  }));
  const apex = V([0, D.apex, 0], 'crown');
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

  /* ---- the brim: from the crown's foot out, its trim bead, its underside back to the sweatband ---- */
  const TS = [0, 0.2, 0.42, 0.64, 0.84, 1];
  const [tw, th, tov] = BR.trim;
  const brim = AZ.map((az) => {
    const r0 = rAt(az, 0) + bo + eo, R = byAz(BR.R, az), Dd = byAz(BR.drop, az);
    const top = TS.map((t) => [r0 + (R - tw - r0) * t, -Dd * Math.pow((r0 + (R - tw - r0) * t - r0) / (R - r0), BR.curve)]);
    // the profile's tangent at the edge, and its normal (up)
    const E = [R - tw, -Dd * Math.pow((R - tw - r0) / (R - r0), BR.curve)], E2 = [R, -Dd];
    const tau = (() => { const v = [E2[0] - E[0], E2[1] - E[1]], l = Math.hypot(...v); return [v[0] / l, v[1] / l]; })(), nu = [-tau[1], tau[0]];
    const at = (p, a, b) => [p[0] + tau[0] * a + nu[0] * b, p[1] + tau[1] * a + nu[1] * b];
    const T = BR.T;
    const trim = [at(E, 0, th), at(E, tw * 0.8, th), at(E, tw + tov, th * 0.35), at(E, tw + tov, -T - th * 0.2), at(E, tw * 0.8, -T - th * 0.6), at(E, 0, -T - th * 0.6)];
    // the underside: the top moved down by T along each ring's normal (approximately straight down the axis)
    const under = top.slice().reverse().map(([r, h], i, L) => [r, h - T]);
    under[under.length - 1] = [r0 - T * 0.4 - bo - eo, -T];
    const sweat = [[r0 - T * 0.4 - bo - eo, bh * 0.8]];
    return { az, prof: [...top, ...trim, ...under, ...sweat], nTop: top.length, nTrim: trim.length };
  });
  const bv = brim.map(({ az, prof }, k) => prof.map(([r, h], i) => (i === 0 ? crown[k][0] : V(P(az, r, h), 'brim'))));
  const nP = brim[0].prof.length, nT = brim[0].nTop, nR = brim[0].nTrim;
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    for (let i = 0; i + 1 < nP; i++) {
      const mat = i < nT - 1 ? 'leather' : i === nT - 1 ? 'leather' : i < nT + nR - 1 ? 'trim' : i < nP - 2 ? 'light' : 'dark';
      G.tag = i < nT ? 'brim' : i < nT + nR - 1 ? 'trim' : i < nP - 2 ? 'under' : 'sweat';
      G.poly([bv[k][i], bv[k2][i], bv[k2][i + 1], bv[k][i + 1]], mat, 'brim');
    }
  }

  /* ---- the ring on the band ---- */
  {
    const R0 = D.ring, az = R0.az, h = bh * R0.at, r = rAt(az, h) + bo + eo + 0.008;
    const c = P(az, r, h), n = dirOf(az), up = [0, 1, 0], side = cross(up, n);
    const pt = (rad, ang, off) => add(add(c, mul(n, off)), add(mul(side, rad * Math.cos(ang)), mul(up, rad * Math.sin(ang))));
    const K = 12, ro = R0.ro, ri = R0.ri, t = R0.t, mid = (ro + ri) / 2;
    // (each spoke: the outer foot, the outer bevel, the face's outer, the face's inner, the inner bevel, the inner foot)
    const prof = [[ro, 0], [ro, t * 0.55], [ro - (ro - ri) * 0.22, t], [ri + (ro - ri) * 0.22, t], [ri, t * 0.55], [ri, 0]];
    const rv = Array.from({ length: K }, (_, j) => prof.map(([rad, off]) => V(pt(rad, (j / K) * Math.PI * 2, off), 'ring')));
    G.tag = 'ring';
    for (let j = 0; j < K; j++) for (let i = 0; i + 1 < prof.length; i++) G.poly([rv[j][i], rv[(j + 1) % K][i], rv[(j + 1) % K][i + 1], rv[j][i + 1]], 'rune', 'ring');
    void mid;
  }

  /* ---- the feathers ---- */
  D.feathers.forEach((f, fi) => {
    const h0 = bh + f.up, r0 = rAt(f.az, h0) + bo + eo + 0.03, base = P(f.az, r0, h0);
    const n0 = dirOf(f.az), back = dirOf(f.az + 90); // (back: round the side toward the hat's rear)
    // the spine's direction in the hat's frame
    const u = unit(f.dir);
    void back;
    // the vane's width direction: across the spine, in the plane facing out (turned by `turn` about the spine)
    let wv = unit(cross(n0, u)); const tn = f.turn * Math.PI / 180, nn = unit(cross(u, wv));
    wv = unit(add(mul(wv, Math.cos(tn)), mul(nn, Math.sin(tn))));
    const nrm = unit(cross(u, wv));
    const quill = 0.18 * f.len, L = f.len, n = 2 * f.notches + 2, th = 0.018, rib = 0.025;
    const spine = (s) => add(base, add(mul(u, s), mul(wv, f.bow * L * ((s / (L + quill)) ** 2))));
    G.tag = `feather ${fi}`;
    // quill: a thin square stick from inside the band to the vane's root
    {
      const q0 = base, q1 = spine(quill), qw = 0.025;
      const ring = (p) => [0, 1, 2, 3].map((j) => V(add(p, add(mul(wv, qw * Math.cos(j * Math.PI / 2 + Math.PI / 4)), mul(nrm, qw * Math.sin(j * Math.PI / 2 + Math.PI / 4)))), 'feather'));
      const a0 = ring(q0), a1 = ring(q1);
      for (let j = 0; j < 4; j++) G.poly([a0[j], a0[(j + 1) % 4], a1[(j + 1) % 4], a1[j]], 'trim', 'feather');
      G.poly([a1[0], a1[1], a1[2], a1[3]], 'trim', 'feather');
    }
    // the vane: stations along the spine, each with its left and right edge (sawtooth: odd stations notched in)
    const sv = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = quill + L * t;
      let w = f.w * Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.75) * 1.0));
      if (i > 0 && i < n && i % 2 === 0) w *= 0.78; // (the notches)
      const sp = spine(s), lead = (i % 2 === 1 && i < n) ? 0.35 * L / n : 0;
      const L_ = add(sp, add(mul(wv, w), mul(u, lead))), R_ = add(sp, add(mul(wv, -w * 0.82), mul(u, lead)));
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
    // (the root's end closed)
    G.poly([sv[0].l[0], sv[0].s[0], sv[0].r[0], sv[0].r[1], sv[0].s[1], sv[0].l[1]], 'trim', 'feather', true);
    G.poly([sv[n].l[0], sv[n].s[0], sv[n].r[0], sv[n].r[1], sv[n].s[1], sv[n].l[1]], 'trim', 'feather', true);
  });

  // outward: away from the hat's axis (the brim's underside down, the crown out)
  const ax = F.toBody([0, 0.3, 0]);
  orient(G, (c) => unit(sub(c, ax)));
  G.tris = trisOf(G);
  for (const p of G.polys) p.piece = p.tag?.startsWith('feather') ? 'feather' : p.tag;
  G.design = D;
  return G;
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
    const A = { built: 'node tools/sculpt/garments/hat.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones: wrote`, file.pathname);
  }
}
