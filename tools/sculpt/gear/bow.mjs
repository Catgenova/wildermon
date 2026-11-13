// The bows (src/game/gear.ts WEAPONS, family 'archery': short_bow, medium_bow, long_bow, composite_bow), the quiver carried
// on the back while one is wielded and the arrow drawn from it, low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs),
// in the Runecut line of the long sword, the warhammer and the bench tools: faceted wood in two tones with its grain, gold
// collars and tip caps, a gold-ringed core on the riser, gold runes down the limbs' backs, lit when enchanted.
//
//   buildBow(id, { enchanted }) -> { G (meshOf: V, F with a material each, A: glow alpha per point), MATS, L, grip, draw }
//   buildQuiver({ enchanted }) -> { G, MATS }
//   buildArrow() -> { G }
//
// A bow's frame, game units: y along it from the lower tip (0) to the upper (L), x out of its back (the face away from
// the archer: toward the mark when drawn), z = x × y. Braced, its limbs bend back toward the archer (-x) to the tips,
// where the string is (`draw.tips`); the composite's tips (horn siyahs) curl forward again past a gold band. Held in the
// left fist by the leather grip in its middle (the hand socket's y up the bow, its x toward the mark); the arrow rests on
// its left side (-z) just over the fist (`draw.rest`).
//
// The quiver's frame: y from its foot (0) up to its mouth (QL) and the fletchings over it, x out of its face (the gold
// medallion), z = x × y. The arrow's: y from the nock (0) to the head's point (AL).
//
// One material table for the bow, its string, the arrow and the quiver, so all of them take the prop's place among the
// renderer's materials (src/sculpt/lowpoly.ts PROP_MAT). The wood (wood, wood2, grain) is drawn in the bow's own wood
// (`GearPiece.material`: willow, birch, oak; src/sculpt/lowpoly.ts metalTint, `PropMaterial.wood`).

import { meshOf, trisOf } from '../lowgear.mjs';

/** Each bow's length (game units; the man stands 16.5), its braced depth (tips behind the grip, a share of L) and its kind. */
export const BOWS = {
  short_bow: { L: 10.2, depth: 0.12, limb: 0.92, kind: 'self' },
  medium_bow: { L: 12.6, depth: 0.105, limb: 1, kind: 'self' },
  long_bow: { L: 15.2, depth: 0.095, limb: 1.08, kind: 'self' },
  composite_bow: { L: 10.8, depth: 0.15, limb: 1, kind: 'composite' },
};

export const MATS_PLAIN = {
  wood: { c: '#a8693f', vary: 0.03, wood: true },
  wood2: { c: '#935a36', vary: 0.03, wood: true },
  grain: { c: '#74401f', wood: true },
  gold: { c: '#d9a04f' },
  goldD: { c: '#b98238' },
  leather: { c: '#7d4a39' },
  leather2: { c: '#663b2e' },
  core: { c: '#d8c3a6' },
  star: { c: '#e2cfa4' },
  rune: { c: '#c9944c' },
  string: { c: '#eadfca' },
  horn: { c: '#e6d8bd', vary: 0.03 },
  hornD: { c: '#8f7a64', vary: 0.03 },
  sinew: { c: '#c99a68', vary: 0.03 },
  shaft: { c: '#d0ad84' },
  fletch: { c: '#f2ebe0' },
  head: { c: '#9aa3b2', metal: 'face' },
  glow: { c: '#ff9a35', glow: 1 },
};
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  core: { c: '#ff8d36', emit: true },
  star: { c: '#fff1c4', emit: true },
  rune: { c: '#ff9430', emit: true },
};

const DEG = Math.PI / 180;
/** An octagon round (a, b) of half sizes ha, hb, its corners cut ca, cb; corners from (+a, +b) round (as the warhammer's). */
const oct2 = (a, b, ha, hb, ca, cb) => [[a + ha, b + hb - cb], [a + ha - ca, b + hb], [a - ha + ca, b + hb], [a - ha, b + hb - cb], [a - ha, b - hb + cb], [a - ha + ca, b - hb], [a + ha - ca, b - hb], [a + ha, b - hb + cb]];
/** An octagon's facets in order (corner j to j + 1): 0 back chamfer +z, 1 side +z, 2 belly chamfer +z, 3 belly, 4 belly chamfer -z, 5 side -z, 6 back chamfer -z, 7 back. */
const BACKF = new Set([0, 6, 7]), BELLYF = new Set([2, 3, 4]);

/** A mesh helper: points with a glow alpha, faces kept off degenerate corners and turned to face `out`. */
function mesher() {
  const G = meshOf();
  G.A = [];
  const P = (q, a) => { const i = G.p(q); if (a !== undefined) G.A[i] = a; return i; };
  const F = (v, mat, out) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out); };
  /** A loft of rings (each the same count, corners in order round), a material per (ring, facet). */
  const loft = (rings, mat, centre) => {
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1], n = a.length;
      for (let j = 0; j < n; j++) F([a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]], typeof mat === 'function' ? mat(i, j) : mat, { from: centre(i) });
    }
  };
  return { G, P, F, loft };
}

/** The braced bow's centre line at u (0 at the grip, 1 at a tip): its x (toward the back), its y along the bow from the grip. */
function centreOf(spec, u) {
  const { L, depth, kind } = spec, D = depth * L;
  if (kind !== 'composite') return -D * Math.pow(u, 1.9);
  // the composite: the riser set forward a little, the limbs bent hard back to the band at 0.8, the siyahs curled forward
  const riser = 0.025 * L * Math.max(0, 1 - u / 0.14);
  if (u <= 0.8) return riser - D * Math.pow(u / 0.8, 1.6);
  const v = (u - 0.8) / 0.2;
  return -D + 0.07 * L * (v * v * 0.6 + v * 0.4);
}

/** A bow: its mesh in its own frame and how it is held and drawn. */
export function buildBow(id, { enchanted = false } = {}) {
  const spec = BOWS[id];
  if (!spec) throw new Error(`buildBow: no bow ${id}`);
  const { L, kind } = spec, comp = kind === 'composite';
  const { G, P, F, loft } = mesher();
  const H = L / 2;
  // the grip's half length and where the gold collars stand (u), the limbs' width (z) and thickness (x) along them
  const GU = 0.075 * 15 / L, CU = GU + 0.022 * 15 / L;
  const wAt = (u) => (u <= CU ? 0.36 : (0.34 - 0.17 * Math.pow((u - CU) / (1 - CU), 1.1)) * spec.limb);
  const tAt = (u) => (u <= CU ? 0.33 : (0.27 - 0.13 * Math.pow((u - CU) / (1 - CU), 0.9)) * spec.limb);
  // a ring across the bow at u on either limb (side +1 up, -1 down): its octagon in the plane square to the centre line
  const frameAt = (u, side) => {
    const e = 1e-3, x0 = centreOf(spec, u), x1 = centreOf(spec, Math.min(1, u + e)), y0 = H + side * u * H, y1 = H + side * Math.min(1, u + e) * H;
    let t = [x1 - x0, y1 - y0]; const l = Math.hypot(t[0], t[1]); t = [t[0] / l, t[1] / l];
    // the ring's "back" axis: the centre line's normal toward +x
    let n = [t[1], -t[0]]; if (n[0] < 0) n = [-n[0], -n[1]];
    return { c: [x0, y0], n };
  };
  const ringAt = (u, side, hx, hz, cx, cz) => {
    const { c, n } = frameAt(u, side);
    return oct2(0, 0, hx, hz, cx, cz).map(([a, b]) => P([c[0] + n[0] * a, c[1] + n[1] * a, b]));
  };
  const centreP = (u, side) => { const { c } = frameAt(u, side); return [c[0], c[1], 0]; };

  /* ---- the limbs: lofted octagons from the collar to the tip ---------------------------------------------------- */
  const US = comp ? [CU, 0.16, 0.24, 0.33, 0.43, 0.53, 0.62, 0.7, 0.77, 0.8, 0.8, 0.84, 0.9, 0.95, 0.985] : [CU, 0.16, 0.24, 0.33, 0.43, 0.53, 0.63, 0.73, 0.82, 0.9, 0.96, 0.985];
  const limbsFrom = G.F.length;
  for (const side of [1, -1]) {
    const rings = US.map((u, i) => {
      // (the composite's band at 0.8: a gold ring, a step proud)
      const band = comp && (i === US.indexOf(0.8) || i === US.indexOf(0.8) + 1);
      const k = band ? 1.18 : 1;
      return ringAt(u, side, tAt(u) / 2 * k, wAt(u) / 2 * k, tAt(u) * 0.22 * k, wAt(u) * 0.22 * k);
    });
    loft(rings, (i, j) => {
      const u = US[i];
      if (comp) {
        if (u >= 0.8 && US[i + 1] <= 0.8 + 1e-9) return 'gold';
        if (u >= 0.8) return j % 2 ? 'hornD' : 'horn';
        return BACKF.has(j) ? 'sinew' : BELLYF.has(j) ? 'horn' : j % 2 ? 'wood2' : 'wood';
      }
      return j % 2 ? 'wood2' : 'wood';
    }, (i) => centreP((US[i] + US[i + 1]) / 2, side));
    // the tip cap: a gold cone from the last ring to the point, the string's nock under it
    const last = rings[rings.length - 1], tip = P(centreP(1, side).map((v, k) => (k === 1 ? v + side * 0.05 : v)));
    for (let j = 0; j < 8; j++) F([last[j], last[(j + 1) % 8], tip], 'gold', { from: centreP(0.97, side) });
    // the gold cap's foot: a ring a little proud just before the tip
    const capU = US[US.length - 2], c0 = ringAt(capU, side, tAt(capU) / 2 * 1.2, wAt(capU) / 2 * 1.2, tAt(capU) * 0.26, wAt(capU) * 0.26), c1 = ringAt(capU + 0.012, side, tAt(capU) / 2 * 1.2, wAt(capU) / 2 * 1.2, tAt(capU) * 0.26, wAt(capU) * 0.26);
    loft([c0, c1], (i, j) => (j === 3 ? 'goldD' : 'gold'), () => centreP(capU + 0.006, side));
    for (const [r, ro] of [[c0, rings[US.length - 2]], [c1, rings[US.length - 2]]]) for (let j = 0; j < 8; j++) F([r[j], r[(j + 1) % 8], ro[(j + 1) % 8], ro[j]], 'gold', { from: centreP(capU, side) });
  }

  /* ---- the grip: leather bands between gold collars ------------------------------------------------------------- */
  const GW = 0.42, GT = 0.4;
  const gripRing = (y, hx, hz, c) => oct2(0, 0, hx, hz, c, c).map(([a, b]) => P([centreOf(spec, 0) + a, y, b]));
  const NB = 6, bands = [];
  for (let k = 0; k <= NB; k++) bands.push(gripRing(H - GU * H + (2 * GU * H * k) / NB, GT / 2, GW / 2, 0.06));
  loft(bands, (i, j) => ((i + j) % 2 ? 'leather2' : 'leather'), (i) => [centreOf(spec, 0), H - GU * H + (2 * GU * H * (i + 0.5)) / NB, 0]);
  // the collars at the grip's ends: a gold ring proud of the leather and the limb, stepped down onto each
  for (const side of [1, -1]) {
    const y0 = H + side * GU * H, y1 = H + side * CU * H, hx = Math.max(GT, tAt(CU)) / 2 + 0.06, hz = Math.max(GW, wAt(CU)) / 2 + 0.06;
    const a = gripRing(y0, hx, hz, 0.08), b = gripRing(y1, hx, hz, 0.08);
    loft([a, b], (i, j) => (j === 3 || j === 4 ? 'goldD' : 'gold'), () => [centreOf(spec, 0), (y0 + y1) / 2, 0]);
    const inner = side > 0 ? bands[NB] : bands[0];
    for (let j = 0; j < 8; j++) F([inner[j], inner[(j + 1) % 8], a[(j + 1) % 8], a[j]], 'gold', [0, -side, 0]);
    const limb0 = ringAt(CU, side, tAt(CU) / 2, wAt(CU) / 2, tAt(CU) * 0.22, wAt(CU) * 0.22);
    for (let j = 0; j < 8; j++) F([b[j], b[(j + 1) % 8], limb0[(j + 1) % 8], limb0[j]], 'gold', [0, side, 0]);
  }

  /* ---- on the back (+x): the riser's medallion over the grip, the runes down each limb, the grain ---------------- */
  // (a disc on the limb's back at u: a gold ring round a core, its star; laid on the back face, out along its normal)
  const backAt = (u, side, lift = 0.012) => { const { c, n } = frameAt(u, side); return { o: [c[0] + n[0] * (tAt(u) / 2 + lift), c[1] + n[1] * (tAt(u) / 2 + lift), 0], n: [n[0], n[1], 0], t: [-n[1] * side, n[0] * side, 0] }; };
  const onBack = (b, a, v) => [b.o[0] + b.t[0] * a + b.n[0] * v, b.o[1] + b.t[1] * a + b.n[1] * v, b.o[2] + v * 0 + 0];
  const medU = CU + 0.05 * 15 / L, med = backAt(medU, 1);
  {
    const ro = 0.25, ri = 0.17, n = 10, at = (r, h) => [...Array(n).keys()].map((j) => { const a = (j + 0.5) * 2 * Math.PI / n; const p = onBack(med, r * Math.sin(a), h); p[2] = r * Math.cos(a); return P(p); });
    const ob = at(ro, -0.04), ot = at(ro, 0.05), it = at(ri, 0.05), id2 = at(ri, 0.02);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      F([ob[j], ob[j1], ot[j1], ot[j]], 'gold', { from: med.o.map((v, k) => v - med.n[k] * 0.3) });
      F([ot[j], ot[j1], it[j1], it[j]], 'gold', med.n);
      F([it[j], it[j1], id2[j1], id2[j]], 'goldD', med.n);
    }
    F(id2, 'core', med.n);
    // its four-point star
    const sc = onBack(med, 0, 0.035), c = P(sc), pts = [];
    for (let j = 0; j < 8; j++) { const a = j * 45 * DEG, r = j % 2 ? 0.045 : 0.14; const p = onBack(med, r * Math.sin(a), 0.03); p[2] = r * Math.cos(a); pts.push(P(p)); }
    for (let j = 0; j < 8; j++) F([c, pts[j], pts[(j + 1) % 8]], 'star', med.n);
  }
  // the runes: three gold diamonds down each limb's back, the middle one larger
  const RUNES = comp ? [0.3, 0.42, 0.54] : [0.3, 0.43, 0.56];
  for (const side of [1, -1]) for (const [i, u] of RUNES.entries()) {
    const b = backAt(u, side, 0.015), r = (i === 1 ? 0.2 : 0.14) * spec.limb, w = wAt(u) * 0.32;
    const q = (a, zz) => { const p = onBack(b, a, 0); p[2] = zz; return P(p); };
    F([q(r, 0), q(0, w), q(-r, 0), q(0, -w)], 'rune', b.n);
  }
  // the grain: thin lines along the back of each self bow's limbs
  if (!comp) for (const side of [1, -1]) for (const [zo, u0, u1] of [[0.05, 0.62, 0.9], [-0.06, 0.66, 0.86], [0.02, 0.19, 0.27]]) {
    const pts = [u0, (u0 + u1) / 2, u1].map((u) => backAt(u, side, 0.006));
    for (let j = 0; j < 2; j++) {
      const a = pts[j], b = pts[j + 1], hw = 0.022;
      const pa = (s, zz) => P([s.o[0], s.o[1], zz]);
      F([pa(a, zo - hw), pa(a, zo + hw), pa(b, zo + hw * 0.7), pa(b, zo - hw * 0.7)], 'grain', a.n);
    }
  }
  const woodTo = G.F.length;

  /* ---- the string, braced: tip to tip on the belly's side, a square section ------------------------------------- */
  const SR = 0.09, tips = [1, -1].map((side) => { const p = centreP(0.965, side); return [p[0] - tAt(0.965) * 0.5 - SR, p[1], 0]; });
  const stringFrom = G.F.length;
  {
    const sq = (p) => [[0, SR], [SR, 0], [0, -SR], [-SR, 0]].map(([a, b]) => P([p[0] + a, p[1], p[2] + b]));
    const a = sq(tips[1]), b = sq(tips[0]);
    for (let j = 0; j < 4; j++) F([a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]], 'string', { from: [tips[0][0], H, 0] });
  }
  const stringTo = G.F.length;
  const tris = trisOf(G).length;

  /* ---- the glow, enchanted: round the medallion and the runes ----------------------------------------------------- */
  if (enchanted) {
    const disc = (b, r, a, n = 10) => { const c = P(onBack(b, 0, 0.06), a), rim = [...Array(n).keys()].map((j) => { const t = j * 2 * Math.PI / n, p = onBack(b, r * Math.cos(t), 0.05); p[2] = r * Math.sin(t); return P(p, 0); }); for (let j = 0; j < n; j++) F([c, rim[j], rim[(j + 1) % n]], 'glow', b.n); };
    disc(med, 0.75, 0.6, 12);
    for (const side of [1, -1]) for (const u of RUNES) disc(backAt(u, side), 0.42, 0.42);
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;

  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L, tris, all: trisOf(G).length, limbsFrom, woodTo,
    // the grip (its frame, game units): along y, the fist's middle at the bow's middle, the leather's radius (flat to flat
    // and corner to corner averaged), its span
    grip: { axis: [0, 1, 0], lead: [0, H, 0], second: [0, H, 0], radius: (GT / 2 + GW / 2) / 2 + 0.03, edge: [1, 0, 0], face: [0, 0, 1], from: H - GU * H, to: H + GU * H },
    // drawn (src/sculpt/lowpoly.ts): the braced string's faces left out, a string from each tip to the drawing fist, and
    // the arrow from the fist past the rest on the bow's left side (-z) over the fist
    draw: { tips: tips.map((p) => p.map((v) => +v.toFixed(5))), rest: [+(centreOf(spec, 0) + 0.02).toFixed(5), +(H + GU * H + 0.12).toFixed(5), -(GW / 2 + 0.1)], string: SR, stringFrom, stringTo },
  };
}

/* ---- the arrow ------------------------------------------------------------------------------------------------------ */
/** The arrow's length, game units: a draw's worth and the head past the bow. */
export const ARROW_L = 7.4;
/** An arrow in its own frame (y from the nock to the head's point): a six-sided shaft, three vanes, a gold nock, an iron head. */
export function buildArrow(G0 = null, place = (p) => p, o = {}) {
  const { G, P, F } = G0 ?? mesher();
  const L = o.length ?? ARROW_L, R = o.r ?? 0.07, mats = o.mats ?? {};
  const hex = (y, r) => [...Array(6).keys()].map((j) => { const a = j * 60 * DEG; return P(place([r * Math.cos(a), y, r * Math.sin(a)])); });
  const H0 = L - 0.75;
  const rings = [hex(0, R * 1.25), hex(0.22, R * 1.25), hex(0.24, R), hex(H0, R)];
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 6; j++) F([rings[i][j], rings[i][(j + 1) % 6], rings[i + 1][(j + 1) % 6], rings[i + 1][j]], i < 1 ? mats.nock ?? 'gold' : mats.shaft ?? 'shaft', { from: place([0, (i + 0.5) * 0.3 + (i === 2 ? H0 / 2 : 0), 0]) });
  F([...rings[0]].reverse(), mats.nock ?? 'gold', place([0, -1, 0]));
  // the head: a flat leaf, four facets round a ridge
  const tip = P(place([0, L, 0])), wl = P(place([0.26, H0 + 0.22, 0])), wr = P(place([-0.26, H0 + 0.22, 0])), rf = P(place([0, H0 + 0.25, 0.08])), rb = P(place([0, H0 + 0.25, -0.08])), base = P(place([0, H0 - 0.05, 0]));
  for (const r of [rf, rb]) for (const w of [wl, wr]) { F([tip, w, r], mats.head ?? 'head', { from: place([0, H0 + 0.2, 0]) }); F([base, r, w], mats.head ?? 'head', { from: place([0, H0 + 0.1, 0]) }); }
  // the vanes: three, square to the shaft, a long low trapezium each
  for (let j = 0; j < 3; j++) {
    const a = (j * 120 + 90) * DEG, d = [Math.cos(a), 0, Math.sin(a)], q = (y, r) => P(place([d[0] * r, y, d[2] * r]));
    const v = [q(0.35, R), q(1.55, R), q(1.25, R + 0.3), q(0.42, R + 0.26)];
    F(v, j === 0 ? mats.cock ?? 'fletch' : mats.fletch ?? 'fletch', place([d[2], 0.9, -d[0]]));
    F([...v].reverse(), j === 0 ? mats.cock ?? 'fletch' : mats.fletch ?? 'fletch', place([-d[2], 0.9, d[0]]));
  }
  return { G, L };
}

/* ---- the quiver ------------------------------------------------------------------------------------------------------ */
/** The quiver's length (foot to mouth) and its half sizes across (x out of its face, z across), game units. */
export const QUIVER = { L: 5.4, hx: 0.6, hz: 0.76 };
/** The quiver: a leather case of eight facets, gold rims at its mouth and foot, a gold-ringed core on its face, five arrows. */
export function buildQuiver({ enchanted = false } = {}) {
  const M = mesher(), { G, P, F, loft } = M, { L, hx, hz } = QUIVER;
  const ring = (y, k = 1, c = 0.3) => oct2(0, 0, hx * k, hz * k, hx * k * c, hz * k * c).map(([a, b]) => P([a, y, b]));
  // the case: the foot narrower, swelling a little to the mouth
  const ys = [0.25, 0.55, L * 0.45, L - 0.55, L - 0.25], ks = [0.86, 0.9, 0.97, 1, 1];
  const body = ys.map((y, i) => ring(y, ks[i]));
  loft(body, (i, j) => (i === 0 || i === ys.length - 2 ? 'gold' : j === 3 || j === 2 || j === 4 ? 'leather2' : j % 2 ? 'leather2' : 'leather'), (i) => [0, (ys[i] + ys[i + 1]) / 2, 0]);
  // the foot's cap and the mouth's rim (gold, a step proud)
  const f0 = ring(0, 0.8), f1 = ring(0.25, 0.92);
  loft([f0, f1], 'goldD', () => [0, 0.1, 0]);
  for (let j = 0; j < 8; j++) F([f1[j], f1[(j + 1) % 8], body[0][(j + 1) % 8], body[0][j]], 'gold', [0, -1, 0]);
  F([...f0].reverse(), 'goldD', [0, -1, 0]);
  const m0 = body[body.length - 1], m1 = ring(L, 1.08), m2 = ring(L, 0.9), m3 = ring(L - 0.6, 0.9);
  for (let j = 0; j < 8; j++) { F([m0[j], m0[(j + 1) % 8], m1[(j + 1) % 8], m1[j]], 'gold', { from: [0, L - 0.4, 0] }); F([m1[j], m1[(j + 1) % 8], m2[(j + 1) % 8], m2[j]], 'gold', [0, 1, 0]); F([m2[j], m2[(j + 1) % 8], m3[(j + 1) % 8], m3[j]], 'leather2', { from: [0, L + 2, 0] }); }
  F(m3, 'leather2', [0, 1, 0]);
  // the strap: a band round the case near its foot and near its mouth (leather2, proud)
  for (const y of [1.25, L - 1.6]) { const a = ring(y, 1.04), b = ring(y + 0.36, 1.04); loft([a, b], 'leather2', () => [0, y, 0]); for (const [r, s] of [[a, -1], [b, 1]]) { const inner = ring(y + (s > 0 ? 0.36 : 0), 0.99); for (let j = 0; j < 8; j++) F([r[j], r[(j + 1) % 8], inner[(j + 1) % 8], inner[j]], 'leather2', [0, s, 0]); } }
  // the medallion on its face (+x): a gold ring round the core, its star
  const MY = L * 0.6, X = hx * 0.985;
  {
    const ro = 0.42, ri = 0.29, n = 10, at = (r, h) => [...Array(n).keys()].map((j) => { const a = (j + 0.5) * 2 * Math.PI / n; return P([X + h, MY + r * Math.sin(a), r * Math.cos(a)]); });
    const ob = at(ro, -0.05), ot = at(ro, 0.07), it = at(ri, 0.07), id2 = at(ri, 0.03);
    for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; F([ob[j], ob[j1], ot[j1], ot[j]], 'gold', { from: [0, MY, 0] }); F([ot[j], ot[j1], it[j1], it[j]], 'gold', [1, 0, 0]); F([it[j], it[j1], id2[j1], id2[j]], 'goldD', [1, 0, 0]); }
    F(id2, 'core', [1, 0, 0]);
    const c = P([X + 0.05, MY, 0]), pts = [];
    for (let j = 0; j < 8; j++) { const a = j * 45 * DEG, r = j % 2 ? 0.07 : 0.24; pts.push(P([X + 0.045, MY + r * Math.sin(a), r * Math.cos(a)])); }
    for (let j = 0; j < 8; j++) F([c, pts[j], pts[(j + 1) % 8]], 'star', [1, 0, 0]);
    // two runes above and below it
    for (const y of [MY + 0.95, MY - 0.95]) F([P([X + 0.02, y + 0.2, 0]), P([X + 0.02, y, 0.13]), P([X + 0.02, y - 0.2, 0]), P([X + 0.02, y, -0.13])], 'rune', [1, 0, 0]);
  }
  // the arrows: five, their fletchings over the mouth, fanned a little
  const OUT = 2.1;
  for (const [x, z, lean, tw] of [[0.18, 0.32, [0.04, 0.06], 10], [-0.22, 0.34, [-0.03, 0.08], 50], [0.22, -0.3, [0.05, -0.07], 80], [-0.2, -0.3, [-0.04, -0.06], 30], [0, 0.02, [0, 0], 65]]) {
    const top = [x + lean[0] * 3, L + OUT, z + lean[1] * 3], foot = [x, L + OUT - ARROW_L, z];
    const y = [top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]], l = Math.hypot(...y), Y = y.map((v) => v / l);
    // the arrow's frame: nock up (its y down the quiver), turned `tw` about its shaft
    const t = tw * DEG, X0 = [Math.cos(t), 0, Math.sin(t)], Xp = X0.map((v, k) => v - Y[k] * (X0[0] * Y[0] + X0[1] * Y[1] + X0[2] * Y[2])), xl = Math.hypot(...Xp), XX = Xp.map((v) => v / xl);
    const ZZ = [XX[1] * -Y[2] - XX[2] * -Y[1], XX[2] * -Y[0] - XX[0] * -Y[2], XX[0] * -Y[1] - XX[1] * -Y[0]];
    // (its own y from the nock down into the quiver: only the part over the mouth is drawn, so the shaft's foot is cut)
    buildArrow(M, ([a, b, c]) => [top[0] + XX[0] * a - Y[0] * b + ZZ[0] * c, top[1] + XX[1] * a - Y[1] * b + ZZ[1] * c, top[2] + XX[2] * a - Y[2] * b + ZZ[2] * c], { length: OUT + 0.6, mats: { head: 'leather2' } });
  }
  const tris = trisOf(G).length;
  if (enchanted) {
    const disc = (y, r, a, n = 10) => { const c = P([X + 0.12, y, 0], a), rim = [...Array(n).keys()].map((j) => { const t = j * 2 * Math.PI / n; return P([X + 0.1, y + r * Math.cos(t), r * Math.sin(t)], 0); }); for (let j = 0; j < n; j++) F([c, rim[j], rim[(j + 1) % n]], 'glow', [1, 0, 0]); };
    disc(MY, 1.1, 0.6, 12); disc(MY + 0.95, 0.5, 0.4); disc(MY - 0.95, 0.5, 0.4);
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return { G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L, tris };
}

/* ---- on the back ----------------------------------------------------------------------------------------------------- */
/**
 * The garments a thing on the back is held clear of (src/sculpt/assets low<name>-<who>.json): every one worn from the gear
 * in play (not the creator's fur mantle or leather shawl, which no item puts on).
 */
export const BACK_GARMENTS = ['shawl', 'tunic', 'trousers', 'boots', 'hood', 'helm', 'platechest', 'platelegs', 'plateboots', 'leatherchest', 'leatherlegs', 'leatherlegsflaps', 'leatherboots', 'hat', 'chainchest', 'chaincoif', 'chainlegs', 'chainboots', 'scalechest', 'scalehelm', 'scalelegs', 'scaleboots'];
/**
 * The quiver on the back (lowgear.mjs backSocketOf), its mouth behind the right shoulder (`up`), slanting `lean` down toward
 * the left hip, its face (the medallion) out of the back (`flip`); the bow over the left shoulder blade, slanting the other
 * way, its string toward the back and its back (the riser's medallion) out, clear of the quiver.
 */
export const QUIVER_BACK = {
  male: { up: true, flip: true, lean: 10, guard: [-1.0, -0.55], gap: 0.22, tilts: [-25, 25], wide: 0.12, blade: 0, garments: BACK_GARMENTS },
  female: { up: true, flip: true, lean: 10, guard: [-0.85, -0.6], gap: 0.2, tilts: [-25, 25], wide: 0.12, blade: 0, garments: BACK_GARMENTS },
};
export const BOW_BACK = {
  male: { up: true, flip: false, lean: -12, guard: [1.05, -3.2], gap: 0.25, tilts: [-6, 6], wide: 0.12, blade: 0, garments: BACK_GARMENTS },
  female: { up: true, flip: false, lean: -12, guard: [0.9, -3.2], gap: 0.22, tilts: [-6, 6], wide: 0.12, blade: 0, garments: BACK_GARMENTS },
};

/* ---- the game's copy: node tools/sculpt/gear/bow.mjs [--out src/sculpt/assets] ---------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { buildRig } = await import('../lowrig.mjs');
  const { gearAsset, backSocketOf } = await import('../lowgear.mjs');
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const dir = resolve(at < 0 ? new URL('../../../src/sculpt/assets', import.meta.url).pathname : args[at + 1]);
  const rigs = { male: buildRig('male'), female: buildRig('female') };
  const r5 = (x) => +x.toFixed(5);
  // the quiver and the arrow as the bow's own parts, in its material table (the names the bow's mesh uses first)
  const qPlain = buildQuiver(), qLit = buildQuiver({ enchanted: true }), arrow = buildArrow();
  const part = (G, names, lit = null) => {
    const T = trisOf(G), polys = [], tris = [];
    G.F.forEach((f, fi) => { const ts = T.filter((t) => t.face === fi); const pi = polys.length; polys.push([f.v, names.indexOf(f.mat)]); for (const t of ts) tris.push(...t.v, pi); });
    if (polys.some(([, m]) => m < 0)) throw new Error('a part names a material the bow does not have');
    return { verts: G.V.flat().map(r5), polys, tris, ...(lit !== null ? { glowFrom: lit } : {}) };
  };
  for (const id of Object.keys(BOWS)) {
    const plain = buildBow(id), lit = buildBow(id, { enchanted: true });
    const asset = await gearAsset(id, plain, lit, rigs);
    // one table for the bow, the quiver and the arrow: every material any of them uses, in MATS_PLAIN's order (the glow
    // last), the bow's polygons put onto it
    const used = new Set([...lit.G.F, ...qLit.G.F, ...arrow.G.F].map((f) => f.mat)), names = Object.keys(MATS_PLAIN).filter((n) => used.has(n));
    asset.polys = asset.polys.map(([v, m]) => [v, names.indexOf(asset.mats[m])]);
    asset.mats = names;
    const look = (T) => names.map((n) => ({ c: T[n].c, kind: T[n].glow ? 2 : T[n].emit ? 1 : 0, ...(T[n].metal ? { metal: T[n].metal } : {}), ...(T[n].wood ? { wood: true } : {}) }));
    asset.plain = look(MATS_PLAIN); asset.enchanted = look(MATS_ENCHANTED);
    asset.hand = 'l';
    // drawn (src/sculpt/lowpoly.ts): the braced string (its material's polygons) left out, a string from each tip to the
    // drawing fist, the arrow on that fist
    asset.draw = { tips: plain.draw.tips, rest: plain.draw.rest, string: plain.draw.string, stringMat: names.indexOf('string'), arrow: part(arrow.G, names), arrowLength: arrow.L };
    // the quiver, its glow's polygons from glowFrom on
    asset.quiver = { ...part(qLit.G, names, qPlain.G.F.length), sockets: {} };
    // on the back: the quiver, then the bow clear of it
    for (const who of ['male', 'female']) {
      const q = backSocketOf(who, { verts: qPlain.G.V.flat(), grip: { lead: [0, 0, 0] } }, asset.scale[who], { ...QUIVER_BACK[who], anchor: QUIVER.L * 0.8 });
      asset.quiver.sockets[who] = q.socket;
      // the quiver's points on the body at rest, kept clear of as a garment is
      const k = 1 / asset.scale[who], qs = q.socket, qpts = [];
      for (let i = 0; i < qPlain.G.V.length; i++) { const p = qPlain.G.V[i]; qpts.push([0, 1, 2].map((r) => qs.o[r] + (qs.R[r * 3] * p[0] + qs.R[r * 3 + 1] * p[1] + qs.R[r * 3 + 2] * p[2]) * k)); }
      const b = backSocketOf(who, { verts: plain.G.V.flat(), grip: plain.grip }, asset.scale[who], { ...BOW_BACK[who], anchor: plain.L / 2, extra: qpts });
      asset.sockets[who].back = b.socket;
      console.log(`${id} ${who}: quiver tilt ${q.tilt} gaps ${q.gaps.join(', ')}; bow tilt ${b.tilt} gaps ${b.gaps.join(', ')}`);
    }
    asset.units = "game units; its own frame: y along the bow from the lower tip (0) to the upper, x out of its back (toward the mark), z = x × y (the arrow on -z)";
    const out = join(dir, `${id}.json`);
    writeFileSync(out, JSON.stringify(asset));
    console.log(`wrote ${out}: ${asset.counts.tris} triangles (${asset.counts.glowTris} more of glow), quiver ${asset.quiver.tris.length / 4}, arrow ${asset.draw.arrow.tris.length / 4}, ${names.length} materials`);
  }
}
