// The leather leggings of the leather set (the sheet: legs-sheet.png, worn in lineup-armor.png and enchanted-glow-ref.png):
// layered fitted trousers, tapered, faceted and articulated, close to the body; a mid-high waistband in the trim colour
// with a V at the centre front and back, four hip flaps under it (front and back a side, light leather, a raised trim
// rim, rivets); one diagonal wrap band a leg (a raised, bevelled strip in the trim colour: its high point at the front of
// the outside, its low at the back of the inside, so it shows as one diagonal in front and one behind); a knee fold (a
// crease above and below a pointed knee); a cuff at the ankle (a step out at its top, a lip in at its foot) that tucks
// into the boots. Fitted to each low-poly body from one design (DESIGN, per body), skinned to its rig with no bones of
// its own. Enchanted, the wrap bands' faces glow (the rune material).
//
//   buildLeatherLegs(rig) → { verts, polys: [{ v, mat, part, tag }], tris, part, rows, design }
//   leatherLegsWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//   hiddenPolys(rig, G) → the body's polygons the cloth covers whole (left out of the body while they are worn)
//
//   piecesOf(G, keep) → the garment cut down to the polygons passing keep (their vertices and weights renumbered)
//
//   node tools/sculpt/garments/leatherlegs.mjs
//     writes the game's copies beside each body (lowgarment.mjs garmentAsset; loaded by src/sculpt/lowpoly.ts behind the
//     outfit switch `leatherLegs`): src/sculpt/assets/lowleatherlegs-<who>.json, all but the hip flaps, with `hides`;
//     src/sculpt/assets/lowleatherlegsflaps-<who>.json, the four flaps with their rims and rivets, worn only without the
//     leather chest (its skirt takes their place over the hip).
//
// The cloth: rings of vertices, as trousers.mjs lays them: the hip's round a vertical axis through (0, ·, z0) (CF, six
// columns a side, CB), each leg's round the leg's centre at that height (ten columns: six outside, four inside, the
// crotch row's inside four on the centre line, shared by both legs). Every other leg ring turned half a column round
// (`s`), so the faces between them fold as the sheet's facets do. Each vertex at the body's reach in its wedge plus the
// clearance and the design's ease there.
// The pieces laid on the cloth (each on rays out from the hip's or the leg's axis to the cloth, then out by its own
// thickness): the waistband and the wrap bands as bevelled strips (a section of six points round, the inside face left
// open against the cloth), the flaps as thick panels (an outer face with a raised trim rim, edges turned in, the
// underside), the rivets as six-sided studs.
import { samplesOf, meshOf, orient, trisOf, transferWeights, closestOnBody, lerp, add, sub, mul, dot, cross } from '../lowgarment.mjs';

/**
 * The set's shared materials (leatherchest.mjs MATS, by name and colour, so the slots dedupe): leather (the cloth), light
 * (the flaps), trim (the waistband, the rims, the bands' edges, the rivets), rune (the bands' face: the trim's colour when
 * plain, the glow when enchanted).
 */
export const MATS = {
  leather: [0.416, 0.224, 0.176],
  light: [0.533, 0.286, 0.22],
  trim: [0.91, 0.518, 0.282],
  rune: [0.91, 0.518, 0.282],
};
const GLOW = [0.996, 0.792, 0.427];
/** How the set's leather is lit: 2, by the light's brightness only (as leatherchest.mjs). */
export const KIND = +(process.env.LEATHER_KIND ?? 2);
/** The two looks: plain, every material lit (KIND), the rune the trim's colour; enchanted, the rune unlit at the glow (kind 1). */
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, { c, kind: KIND }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, { c, kind: KIND }])), rune: { c: GLOW, kind: 1 } },
};

/** The leg's columns: degrees round the leg from its front toward its outside (outside 90, back 180, inside 270). */
export const LEG_AZ = [-20, 25, 70, 110, 155, 200, 235, 260, 290, 320];

/**
 * The design per body (heights the body's y, lengths its units; ease [front, outside, back, inside] round the leg, the
 * hip's [front, side, back] round the hip's axis):
 *   z0 the hip's axis; clear the least distance off the body;
 *   waist: the waistband's top, its depth at the sides, its V at the front (vf, over vw degrees either side) and back
 *   (vb), the top's own dip at the front (vt), its thickness t and bevel;
 *   hips: H1, H2 heights and their ease; crotch: as trousers.mjs;
 *   legs: the rows below the crotch row, each { n, y, e: ease, s: share of a column turned, pt: the knee's point };
 *   cuff: the rows that clear the calf whole (as a wall), the step out at its top and its lip;
 *   band: the wrap band's middle y, its tilt amp and the azimuth phi of its highest point, its width w, thickness t;
 *   flaps: front and back, each its azimuths (inner, outer) at its top and its foot, its foot's heights there (inner,
 *   outer), the gap off the cloth at its top and foot, its thickness t, the rim's width and raise.
 */
export const DESIGN = {
  male: {
    z0: -0.02, clear: 0.04,
    waist: { top: -3.5, depth: 0.34, vf: 0.24, vb: 0.18, vw: 62, vt: 0.06, t: 0.085, bevel: 0.03 },
    hips: [-4.25, -5.0], hipEase: { W1: [0, 0.02, 0.03], H1: [0, 0.04, 0.06], H2: [0, 0.05, 0.1] },
    crotch: { y: -6.2, rise: 0.55, dip: 0.14, front: 0.5, back: 0.55, zf: 0.22, zb: -0.18, ease: [0.02, 0.06, 0.04, 0.06] },
    legs: [
      { n: 'T1', y: -6.5, e: [0.24, 0.13, 0.2, 0.03], s: 0.5 },
      { n: 'T2', y: -6.95, e: [0.3, 0.16, 0.26, 0.05], s: 0 },
      { n: 'K1', y: -7.25, e: [0.16, 0.12, 0.14, 0.04], s: 0 },
      { n: 'K', y: -7.52, e: [0.2, 0.25, 0.14, 0.1], s: 0.5, pt: 0.12 },
      { n: 'K2', y: -7.82, e: [0.08, 0.13, 0.08, 0.06], s: 0 },
      { n: 'N1', y: -8.2, e: [0.13, 0.2, 0.13, 0.09], s: 0.5 },
      { n: 'N2', y: -8.75, e: [0.08, 0.12, 0.09, 0.06], s: 0 },
      { n: 'N3', y: -9.3, e: [0.02, 0.02, 0.02, 0.02], s: 0.5 },
    ],
    cuff: { top: -9.38, foot: -10.18, step: 0.05, lip: 0.1 },
    band: { y: -6.62, amp: 0.46, phi: 58, w: 0.36, t: 0.045, bevel: 0.02 },
    flaps: {
      front: { az: [[14, 86], [34, 95]], foot: [-4.5, -4.95] },
      back: { az: [[99, 166], [101, 144]], foot: [-4.95, -4.55] },
      gap: [0.015, 0.16, 0.36], t: 0.075, rim: 0.07, raise: 0.016,
    },
  },
  female: {
    z0: -0.38, clear: 0.035, flat: ['H2'], seat: 0.45,
    waist: { top: -3.0, depth: 0.3, vf: 0.22, vb: 0.16, vw: 62, vt: 0.05, t: 0.075, bevel: 0.026 },
    hips: [-3.65, -4.15], hipEase: { W1: [0, 0.02, 0.03], H1: [0, 0.04, 0.06], H2: [0, 0.05, 0.09] },
    crotch: { y: -4.55, rise: 0.22, dip: 0.12, front: 0.42, back: 0.5, zf: 0.12, zb: -0.3, ease: [0.02, 0.05, 0.03, 0.05] },
    legs: [
      { n: 'T1', y: -5.15, e: [0.14, 0.12, 0.06, 0.0], s: 0.5 },
      { n: 'T2', y: -5.85, e: [0.2, 0.15, 0.14, 0.03], s: 0 },
      { n: 'K1', y: -6.4, e: [0.12, 0.1, 0.1, 0.03], s: 0 },
      { n: 'K', y: -6.72, e: [0.17, 0.21, 0.12, 0.08], s: 0.5, pt: 0.11 },
      { n: 'K2', y: -7.05, e: [0.07, 0.11, 0.07, 0.05], s: 0 },
      { n: 'N1', y: -7.55, e: [0.12, 0.17, 0.12, 0.08], s: 0.5 },
      { n: 'N2', y: -8.3, e: [0.07, 0.1, 0.08, 0.05], s: 0 },
      { n: 'N3', y: -9.35, e: [0.02, 0.02, 0.02, 0.02], s: 0.5 },
    ],
    cuff: { top: -9.45, foot: -10.32, step: 0.045, lip: 0.1 },
    band: { y: -5.6, amp: 0.56, phi: 58, w: 0.36, t: 0.04, bevel: 0.018, gap: [228, 332] },
    flaps: {
      front: { az: [[16, 86], [34, 95]], foot: [-4.0, -4.5] },
      back: { az: [[99, 164], [101, 144]], foot: [-4.5, -4.05] },
      gap: [0.015, 0.14, 0.3], t: 0.065, rim: 0.065, raise: 0.014,
    },
  },
};

const rad = (d) => d * Math.PI / 180;
/** How far a strip's inside edges stand off the cloth (clear of it: the cloth's sag between the strip's columns). */
const IN = 0.012;
const round4 = ([f, o, b, i], az) => { const c = Math.cos(rad(az)), s = Math.sin(rad(az)); return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s); };
const round3 = ([f, s, b], az) => { const c = Math.cos(rad(az)); return c > 0 ? f * c * c + s * (1 - c * c) : b * c * c + s * (1 - c * c); };

/** The body's surface, torso, pelvis and legs, as points. */
function bodySamples(B) {
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const tris = B.tris.filter((t) => t.v.every((i) => parts.has(B.part[i])));
  const S = samplesOf({ tris }, B.verts, 0.05).slice(B.verts.length);
  for (const t of tris) for (const i of t.v) S.push(B.verts[i]);
  return S;
}
/** trousers.mjs ringRadii: the radii of a ring round c at azimuths az that keep every sample (in its window) inside it. */
function ringRadii(S, c, az, win, keep = null, own = false) {
  const N = az.length, r = new Array(N).fill(0);
  const lo = Math.min(...win.map((w) => w[0])), hi = Math.max(...win.map((w) => w[1]));
  for (const p of S) {
    if (p[1] < lo || p[1] > hi || (keep && !keep(p))) continue;
    const dx = p[0] - c[0], dz = p[2] - c[1], d = Math.hypot(dx, dz);
    if (d < 1e-9) continue;
    const ap = Math.atan2(dx, dz) * 180 / Math.PI;
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, g = ((az[j] - az[k]) % 360 + 360) % 360, a = ((ap - az[k]) % 360 + 360) % 360;
      if (a > g) continue;
      if (p[1] < Math.min(win[k][0], win[j][0]) || p[1] > Math.max(win[k][1], win[j][1])) continue;
      if (own) { if (a <= g / 2) r[k] = Math.max(r[k], d); else r[j] = Math.max(r[j], d); continue; }
      const need = d * Math.cos(rad(a - g / 2)) / Math.cos(rad(g / 2));
      r[k] = Math.max(r[k], need); r[j] = Math.max(r[j], need);
    }
  }
  return r;
}
/** The left leg's centre (x, z) at height y: the middle of the body's section there. */
function legCentre(S, y, dy = 0.12) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of S) if (Math.abs(p[1] - y) <= dy && p[0] > 0.04) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}
/**
 * The furthest reach of a surface (fn(y, a), a radius) over heights ys and over a column's own wedge (half degrees either
 * side, each grown by 1/cos of its offset: a chord between columns that far apart clears it).
 */
const reach = (fn, ys, a, half) => { let r = 0; for (const y of ys) for (const o of [-half, -half / 2, 0, half / 2, half]) r = Math.max(r, fn(y, a + o) / Math.cos(rad(o))); return r; };
/** A ring's azimuths turned a share s of each gap toward the next column. */
const turned = (az, s) => az.map((a, k) => { const b = az[(k + 1) % az.length], g = ((b - a) % 360 + 360) % 360; return a + s * g; });

/** The nearest hit of a ray (origin o, unit direction d) on triangles T (each three points), or null; with far, the furthest. */
function rayHit(T, o, d, far = false) {
  let best = null;
  for (const [a, b, c] of T) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, s = sub(o, a), u = f * dot(s, h); if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
    const t = f * dot(e2, q); if (t > 1e-6 && (best === null || (far ? t > best : t < best))) best = t;
  }
  return best;
}

export function buildLeatherLegs(rig, design = DESIGN[rig.who], { stage = 9 } = {}) {
  const { B } = rig, D = design;
  const S = bodySamples(B), SL = S.filter((p) => p[0] > -0.02);
  const cr = D.crotch, cf = D.cuff;
  // ---- the leg's rows ------------------------------------------------------------------------------------------------
  // (the blockout: the crotch, mid-thigh, knee, calf and the cuff's foot, no turn, no knee point, no step)
  let rows = [...D.legs.map((r) => ({ ...r })), { n: 'U', y: cf.top - 0.06, s: 0.5, cuff: 'step' }, { n: 'Um', y: cf.top - 0.36, s: 0, cuff: 'ridge' }, { n: 'Uf', y: cf.top - 0.5, s: 0, cuff: 'step' }, { n: 'E', y: cf.foot, s: 0.5, cuff: 'foot' }, { n: 'Ei', y: cf.foot + 0.1, s: 0.5, cuff: 'lip' }];
  if (stage <= 1) rows = rows.filter((r) => ['T2', 'K', 'N2', 'E'].includes(r.n)).map((r) => ({ ...r, s: 0, pt: 0, cuff: r.cuff ? 'plain' : undefined }));
  const yC = (az) => cr.y + Math.min(cr.front, cr.back) + cr.rise * Math.max(0, Math.sin(rad(az)));
  const legV = {}, legAz = {}, legC = {};
  // the crotch row (as trousers.mjs)
  {
    const c = legCentre(SL, cr.y - 0.25), win = LEG_AZ.map((az) => [yC(az) - 0.2, yC(az) + 0.2]);
    const r0 = ringRadii(SL, c, LEG_AZ, win, (p) => p[0] > 0.04, true);
    legV.C = LEG_AZ.map((az, k) => { const r = r0[k] + D.clear + round4(cr.ease, az); return [c[0] + Math.sin(rad(az)) * r, yC(az), c[1] + Math.cos(rad(az)) * r]; });
    legAz.C = LEG_AZ; legC.C = c;
  }
  for (const row of rows) {
    const az = turned(LEG_AZ, row.s ?? 0), c = legCentre(SL, row.y);
    const wall = row.cuff ? [cf.foot - 0.05, cf.top + 0.1] : null;
    const win = az.map(() => wall ?? [row.y - 0.2, row.y + 0.2]);
    const r0 = ringRadii(SL, c, az, win, (p) => p[0] > 0.04, !row.cuff);
    legV[row.n] = az.map((a, k) => {
      let e = row.cuff === 'lip' ? 0.02 - cf.step : row.cuff === 'plain' ? 0.04 : row.cuff === 'ridge' ? cf.step + 0.035 : row.cuff ? cf.step : round4(row.e, a);
      if (row.pt && stage > 1) { const d = Math.abs(((a + 180) % 360 + 360) % 360 - 180); e += row.pt * Math.max(0, 1 - d / 50); }
      const r = r0[k] + D.clear + e;
      return [c[0] + Math.sin(rad(a)) * r, row.y, c[1] + Math.cos(rad(a)) * r];
    });
    legAz[row.n] = az; legC[row.n] = c;
  }
  // the cuff's lip in at its foot: the foot ring's own columns, in by the step and up by `lip`
  // the crotch row's inside columns on the centre line (CBc, M2, M1, CFc)
  {
    const C = legV.C, cen = S.filter((p) => Math.abs(p[0]) < 0.12);
    const zAt = (y, front) => { let z = front ? -Infinity : Infinity; for (const p of cen) if (Math.abs(p[1] - y) < 0.15) z = front ? Math.max(z, p[2]) : Math.min(z, p[2]); return z; };
    const yF = cr.y + cr.front, yB = cr.y + cr.back;
    C[9] = [0, yF, zAt(yF, true) + D.clear + cr.ease[0]];
    C[8] = [0, cr.y, cr.zf];
    C[7] = [0, cr.y, cr.zb];
    C[6] = [0, yB, Math.min(zAt(yB, false) - D.clear - cr.ease[2] * 0.6, C[5][2] + cr.dip)];
  }
  // ---- the hip's rings, round the hip's axis, over the crotch row's columns -----------------------------------------
  const C = legV.C, W = D.waist;
  const hipAz = [0, ...LEG_AZ.slice(0, 6).map((_, k) => Math.atan2(C[k][0], C[k][2] - D.z0) * 180 / Math.PI), 180];
  const yHip = {
    // (the seat's row halfway from H2's own height to the crotch row, column by column)
    // (and at least `seat` of the way from the crotch row up to H1, where the crotch row rises high at the outside)
    H2: (k) => { const cy = k === 0 ? C[9][1] : k === 7 ? C[6][1] : C[k - 1][1]; return Math.max((D.hips[1] + cy) / 2, cy + (D.seat ?? 0) * (D.hips[0] - cy)); },
    H1: () => D.hips[0], W1: () => W.top - W.depth - 0.08, W0: () => W.top + 0.01,
  };
  const hipRows = stage <= 1 ? ['H1', 'W0'] : ['H2', 'H1', 'W1', 'W0'];
  const hipV = {};
  for (const row of hipRows) {
    const full = [...hipAz, ...hipAz.slice(1, -1).map((a) => -a).reverse()];
    const ys = full.map((_, k) => yHip[row](k < 8 ? k : 14 - k));
    const r0 = ringRadii(S, [0, D.z0], full, ys.map((y) => [y - 0.22, y + 0.22]), null, row[0] === 'H');
    hipV[row] = hipAz.map((az, k) => {
      const r = Math.max(r0[k], r0[(14 - k) % 14]) + D.clear + (row === 'W0' ? 0 : round3(D.hipEase[row] ?? [0.02, 0.02, 0.02], az));
      return [Math.sin(rad(az)) * r, ys[k], D.z0 + Math.cos(rad(az)) * r];
    });
  }
  // (the seat's row no further in than the line from the hip's row to the crotch row)
  if (hipV.H2) hipV.H2 = hipV.H2.map((p, k) => {
    const a = hipV.H1[k], b = k === 0 ? C[9] : k === 7 ? C[6] : C[k - 1], t = (a[1] - p[1]) / (a[1] - b[1]);
    const q = lerp(a, b, t), rq = Math.hypot(q[0], q[2] - D.z0), rp = Math.hypot(p[0], p[2] - D.z0);
    if (rp >= rq + 0.01) return p;
    const s = (rq + 0.01) / rp; return [p[0] * s, p[1], D.z0 + (p[2] - D.z0) * s];
  });
  // (the front, from the waist to the crotch, flat on the body: no padding over the abdomen)
  const frontZ = (x, y) => { let z = -Infinity; for (const p of S) if (Math.abs(p[0] - x) < 0.15 && Math.abs(p[1] - y) < 0.2) z = Math.max(z, p[2]); return z; };
  const flat = (p) => { if (Math.atan2(p[0], p[2] - D.z0) > rad(60)) return p; const z = frontZ(p[0], p[1]) + D.clear + 0.02; return z < p[2] ? [p[0], p[1], z] : p; };
  for (const row of D.flat ?? ['H1', 'H2']) if (hipV[row]) hipV[row] = hipV[row].map(flat);
  for (const k of [0, 1]) C[k] = flat(C[k]);
  // (a ring between the crotch row and the first thigh row, halfway, out by `t0` from the leg's axis on its outer six
  // columns: smaller faces over the hip's crease, so the band and the flaps above follow the cloth through the walk; its
  // four inside columns `t0In` of the way down, clear of the other leg's across the crotch's centre line)
  if (stage > 1 && legV.T1) {
    const cT = legC.T1, cC = legC.C;
    legV.T0 = C.map((p, k) => {
      const m = lerp(p, legV.T1[k], k >= 6 ? D.t0In ?? 0.7 : 0.5);
      if (k >= 6) return m;
      const c = lerp(cC, cT, 0.5), d = [m[0] - c[0], m[2] - c[1]], l = Math.hypot(...d), r = l + (D.t0 ?? 0.03);
      return [c[0] + d[0] / l * r, m[1], c[1] + d[1] / l * r];
    });
    legC.T0 = lerp(cC, cT, 0.5);
  }

  const G = meshOf();
  const legRows = ['C', ...(legV.T0 ? ['T0'] : []), ...rows.map((r) => r.n)];
  clothMesh(G, D, { legV, hipV, legRows, hipRows });
  G.legV = legV; G.legC = legC; G.hipV = hipV; G.design = D; G.stage = stage;
  // ---- the pieces on the cloth ----------------------------------------------------------------------------------------
  const clothT = G.polys.flatMap((p) => { const out = []; for (let k = 1; k + 1 < p.v.length; k++) out.push([p.v[0], p.v[k], p.v[k + 1]].map((i) => G.verts[i])); return out; });
  const leftT = clothT.filter((t) => t.some((p) => p[0] > 0.02));
  /** The cloth's radius on the ray from the hip's axis at height y, azimuth a (degrees). */
  const hipR = (y, a) => { const o = [0, Math.min(y, D.waist.top - 0.02), D.z0], d = [Math.sin(rad(a)), 0, Math.cos(rad(a))]; return rayHit(a >= 0 ? leftT : clothT, o, d, true) ?? 0; };
  /** The leg's centre at height y (the rings' centres, straight between them) and the cloth's radius out from it at azimuth a. */
  const legRowsY = legRows.map((n) => ({ y: n === 'C' ? cr.y : n === 'T0' ? (cr.y + rows[0].y) / 2 : rows.find((r) => r.n === n).y, c: legC[n] })).sort((a, b) => b.y - a.y);
  const legAxis = (y) => {
    if (y >= legRowsY[0].y) return legRowsY[0].c;
    for (let i = 0; i + 1 < legRowsY.length; i++) { const a = legRowsY[i], b = legRowsY[i + 1]; if (y <= a.y && y >= b.y) { const t = (a.y - y) / (a.y - b.y); return [a.c[0] + (b.c[0] - a.c[0]) * t, a.c[1] + (b.c[1] - a.c[1]) * t]; } }
    return legRowsY.at(-1).c;
  };
  const legR = (y, a) => { const c = legAxis(y), o = [c[0], y, c[1]], d = [Math.sin(rad(a)), 0, Math.cos(rad(a))]; return rayHit(leftT, o, d) ?? 0; };
  G.hipR = hipR; G.legR = legR; G.legAxis = legAxis;

  waistband(G, D, hipR, stage);
  for (const side of [1, -1]) {
    for (const which of ['front', 'back']) flap(G, D, hipR, which, side, stage);
    band(G, D, legR, legAxis, side, stage);
  }
  // each piece faced out: above the crotch from the hip's axis, below it from the leg's axis
  const legOut = (c) => { const ax = legAxis(c[1]), sx = Math.sign(c[0]) || 1; return [c[0] - sx * ax[0], 0, c[2] - ax[1]]; };
  orient(G, (c) => (c[1] > cr.y + cr.front + 0.2 && !(Math.abs(c[0]) > 0.5 && c[1] < D.hips[0] - 0.3) ? [c[0], 0, c[2] - D.z0] : legOut(c)));
  G.tris = trisOf(G);
  return G;
}

/** The cloth from its rings: the left half's vertices, the right's their mirror, the centre line's shared. */
function clothMesh(G, D, { legV, hipV, legRows, hipRows }) {
  const mir = (p) => [-p[0], p[1], p[2]];
  const R = { hip: {}, leg: { l: {}, r: {} } };
  for (const row of hipRows) {
    const V = hipV[row];
    const cf = G.vert([0, V[0][1], V[0][2]], 'hip'), cb = G.vert([0, V[7][1], V[7][2]], 'hip');
    const L = V.slice(1, 7).map((p) => G.vert(p, 'hip')), Rr = V.slice(1, 7).map((p) => G.vert(mir(p), 'hip'));
    R.hip[row] = [cf, ...L, cb, ...Rr.reverse()];
  }
  {
    const V = legV.C;
    const L = V.slice(0, 6).map((p) => G.vert(p, 'hip')), Rr = V.slice(0, 6).map((p) => G.vert(mir(p), 'hip'));
    const ctr = V.slice(6, 10).map((p) => G.vert([0, p[1], p[2]], 'crotch'));
    R.leg.l.C = [...L, ...ctr]; R.leg.r.C = [...Rr, ...ctr];
    R.hip.C = [ctr[3], ...L, ctr[0], ...[...Rr].reverse()];
  }
  for (const row of legRows.slice(1)) {
    R.leg.l[row] = legV[row].map((p) => G.vert(p, 'leg'));
    R.leg.r[row] = legV[row].map((p) => G.vert(mir(p), 'leg'));
  }
  const centreOf = (ix) => { const s = ix.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]); return mul(s, 1 / ix.length); };
  const ring = (A, Bq, mat, part, tag, cx = null) => {
    G.tag = tag;
    const N = A.length, c = cx ?? centreOf([...A, ...Bq]);
    const out = (a, b) => { const m = lerp(G.verts[a], G.verts[b], 0.5); return Math.hypot(m[0] - c[0], m[2] - c[2]); };
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, q = [A[k], A[j], Bq[j], Bq[k]];
      // (each quad cut along the diagonal that folds outward: a facet each side)
      if (out(q[0], q[2]) >= out(q[1], q[3])) { G.poly([q[0], q[1], q[2]], mat, part); G.poly([q[0], q[2], q[3]], mat, part); }
      else { G.poly([q[0], q[1], q[3]], mat, part); G.poly([q[1], q[2], q[3]], mat, part); }
    }
  };
  const H = ['C', ...hipRows], hc = [0, 0, D.z0];
  for (let i = 0; i + 1 < H.length; i++) ring(R.hip[H[i]], R.hip[H[i + 1]], 'leather', 'hip', 'cloth', hc);
  for (const s of ['l', 'r']) for (let i = 0; i + 1 < legRows.length; i++) ring(R.leg[s][legRows[i]], R.leg[s][legRows[i + 1]], 'leather', 'leg', ['U', 'Um', 'Uf', 'E', 'Ei'].includes(legRows[i + 1]) ? 'cuff' : 'cloth');
  G.rows = R; G.rowNames = { leg: legRows, hip: hipRows };
}

/**
 * A strip along a closed or open path: per column k a section of points P[k][j] (j from the inside of its top edge,
 * over its outer face, to the inside of its foot), faces between neighbouring columns, its inside left open; mats[j]
 * the face between points j and j + 1. An open strip's ends closed by its sections.
 */
function strip(G, P, mats, part, tag, closed) {
  G.tag = tag;
  const ix = P.map((sec) => sec.map((p) => G.vert(p, part)));
  const N = P.length, m = P[0].length;
  for (let k = 0; k < (closed ? N : N - 1); k++) {
    const a = ix[k], b = ix[(k + 1) % N];
    for (let j = 0; j + 1 < m; j++) G.poly([a[j], b[j], b[j + 1], a[j + 1]], mats[j], part);
  }
  if (!closed) for (const sec of [ix[0], ix[N - 1]]) G.poly([...sec], mats[Math.floor(m / 2)], part);
  return ix;
}

/** A six-sided stud at point p, facing out along n (unit), radius r, height h. */
function rivet(G, p, n, r, h, part, mat = 'trim') {
  G.tag = 'rivet';
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = (() => { const c = cross(up, n), l = Math.hypot(...c); return mul(c, 1 / l); })(), v = cross(n, u);
  const base = [], top = [];
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
    base.push(G.vert(add(add(p, mul(n, 0.008)), mul(d, r)), part));
    top.push(G.vert(add(add(p, mul(n, h)), mul(d, r * 0.55)), part));
  }
  for (let k = 0; k < 6; k++) { const j = (k + 1) % 6; G.poly([base[k], base[j], top[j], top[k]], mat, part); }
  (G.studs ??= []).push([...base, ...top]);
  G.poly([...top], mat, part, true);
}

/** The waistband: round the hip's axis, its foot in a V at the front and the back, raised off the cloth by t, bevelled. */
function waistband(G, D, hipR, stage) {
  const W = D.waist, N = 40, P = [];
  const vee = (a, depth, at) => { const d = Math.abs(((a - at) % 360 + 540) % 360 - 180); return depth * Math.max(0, 1 - d / W.vw); };
  for (let k = 0; k < N; k++) {
    const a = -180 + k * 360 / N, dir = [Math.sin(rad(a)), 0, Math.cos(rad(a))];
    const yt = W.top - (stage > 1 ? vee(a, W.vt, 0) * 0.6 : 0), yb = W.top - W.depth - (stage > 1 ? vee(a, W.vf, 0) + vee(a, W.vb, 180) : 0);
    const h = 180 / N, rs = [[yt, yt - 0.05], [yt, (yt + yb) / 2, yb], [yb + 0.05, yb]].map((ys) => reach(hipR, ys, a, h)), r = Math.max(...rs), b = stage > 1 ? W.bevel : 0;
    const pt = (rr, y) => [dir[0] * rr, y, D.z0 + dir[2] * rr];
    P.push([pt(rs[0] + IN, yt), pt(r + W.t - b, yt), pt(r + W.t, yt - b), pt(r + W.t, yb + b), pt(r + W.t - b, yb), pt(rs[2] + IN, yb)]);
  }
  const M = stage >= 4 ? 'trim' : 'leather';
  strip(G, P, [M, M, M, M, M], 'waistband', 'waistband', true);
  G.waistP = P;
  // (rivets across the band's face: two a side in front, two behind)
  if (stage >= 5) for (const a of [-150, -122, -58, -26, 26, 58, 122, 150]) {
    // (on the face between two columns, at its middle, along its own normal)
    const k = Math.floor((a + 180) / 360 * N) % N, s0 = P[k], s1 = P[(k + 1) % N], p = lerp(lerp(s0[2], s0[3], 0.5), lerp(s1[2], s1[3], 0.5), 0.5);
    let n = cross(sub(s1[2], s0[2]), sub(s0[3], s0[2])); n = mul(n, 1 / Math.hypot(...n));
    if (dot(n, [p[0], 0, p[2] - D.z0]) < 0) n = mul(n, -1);
    rivet(G, p, n, 0.05, 0.035, 'waistband');
  }
}

/**
 * A hip flap (front or back, the body's left side 1 or right -1): a thick panel hung from under the waistband's foot,
 * its corners at the design's azimuths and heights; each node off the cloth by the gap (more toward its foot) and never
 * nearer than the cloth above it (it hangs); an outer face with a raised rim along its sides and foot, its edges turned
 * in by its thickness, its underside.
 */
function flap(G, D, hipR, which, side, stage) {
  const F = D.flaps, f = F[which], W = D.waist, P = G.waistP;
  const yTop = (a) => { // the waistband's foot at azimuth a (its section's last point), less a little
    const N = P.length, u = ((a + 180) / 360) * N, k = Math.floor(u) % N, t = u - Math.floor(u), j = (k + 1) % N;
    return P[k][5][1] * (1 - t) + P[j][5][1] * t - 0.012;
  };
  const rim = stage >= 2 ? F.rim : 0, raise = stage >= 5 ? F.raise : 0;
  // columns from the inner edge to the outer, rows from the top to the foot; the rim's own column and row inside each edge
  const cs = rim ? [0, rim, 0.33, 0.66, 1 - rim, 1] : [0, 0.5, 1], rs = rim ? [0, 0.35, 0.7, 1 - rim * 1.6, 1] : [0, 0.5, 1];
  const [[ai0, ao0], [ai1, ao1]] = f.az, [yi, yo] = f.foot;
  const node = (i, k) => {
    const u = cs[k], v = rs[i];
    const a = (ai0 + (ao0 - ai0) * u) * (1 - v) + (ai1 + (ao1 - ai1) * u) * v;
    const y0 = yTop(a), y1 = yi + (yo - yi) * u, y = y0 + (y1 - y0) * v;
    return { a, y, y0, u };
  };
  const grid = rs.map((_, i) => cs.map((_, k) => node(i, k)));
  // the radius: the cloth's furthest reach from the flap's top down to this node (it hangs), plus the gap
  for (const row of grid) for (const n of row) {
    let r = 0; for (let s = 0; s <= 4; s++) r = Math.max(r, G.hipR(n.y0 + (n.y - n.y0) * s / 4, n.a));
    const v = (n.y0 - n.y) / Math.max(1e-6, n.y0 - Math.min(yi, yo)), side2 = which === 'front' ? n.u : 1 - n.u;
    n.r = r + F.gap[0] + (F.gap[1] + (F.gap[2] - F.gap[1]) * side2 - F.gap[0]) * Math.min(1, v);
  }
  // (each cell clear of the cloth under it: where its face, its corners blended, falls short of the cloth plus the
  // least gap at a point inside it, its corners go out by the shortfall)
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i + 1 < grid.length; i++) for (let k = 0; k + 1 < grid[0].length; k++) {
    const q = [grid[i][k], grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]];
    let short = 0;
    for (let fu = 0; fu <= 6; fu++) for (let fv = 0; fv <= 6; fv++) {
      const u = fu / 6, v = fv / 6, w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
      const a = w.reduce((s2, x, j) => s2 + x * q[j].a, 0), y = w.reduce((s2, x, j) => s2 + x * q[j].y, 0), r = w.reduce((s2, x, j) => s2 + x * q[j].r, 0);
      // (the face's chord between corners at different azimuths runs in by 1 - cos of half their spread)
      const spread = Math.abs(q[1].a - q[0].a) * (1 - v) + Math.abs(q[2].a - q[3].a) * v, chord = r * Math.cos(rad(spread / 2 * (1 - Math.abs(2 * u - 1)) ));
      short = Math.max(short, G.hipR(y, a) + F.gap[0] + 0.008 - chord);
    }
    if (short > 0) for (const n of q) n.r += short;
  }
  const pt = (n, off) => { const a = side * n.a; return [Math.sin(rad(a)) * (n.r + off), n.y, D.z0 + Math.cos(rad(a)) * (n.r + off)]; };
  const part = `flap`, tag = 'flap';
  G.tag = tag;
  const nr = rs.length, nc = cs.length;
  const isRim = (i, k) => rim && (i === nr - 1 || k === 0 || k === nc - 1);
  const out = grid.map((row, i) => row.map((n, k) => G.vert(pt(n, F.t + (isRim(i, k) ? raise : 0)), part)));
  const inn = grid.map((row) => row.map((n) => G.vert(pt(n, 0), part)));
  const M = stage >= 4 ? 'light' : 'leather', T = stage >= 4 ? 'trim' : 'leather';
  const quad = (q, mat) => (side > 0 ? G.poly(q, mat, part) : G.poly([...q].reverse(), mat, part));
  // (the outer face: a cell is rim when it lies along the sides or the foot)
  const outPolys = [];
  for (let i = 0; i + 1 < nr; i++) for (let k = 0; k + 1 < nc; k++) {
    const r = rim && (i + 1 === nr - 1 || k === 0 || k + 1 === nc - 1), n0 = G.polys.length;
    quad([out[i][k], out[i + 1][k], out[i + 1][k + 1], out[i][k + 1]], r ? T : M);
    for (let j = n0; j < G.polys.length; j++) outPolys.push(j);
  }
  // (the underside, and the edges turned in: the sides and the foot in the rim's colour, the top hidden under the band)
  for (let i = 0; i + 1 < nr; i++) for (let k = 0; k + 1 < nc; k++) quad([inn[i][k], inn[i][k + 1], inn[i + 1][k + 1], inn[i + 1][k]], M);
  for (let i = 0; i + 1 < nr; i++) { quad([out[i][0], inn[i][0], inn[i + 1][0], out[i + 1][0]], T); quad([out[i + 1][nc - 1], inn[i + 1][nc - 1], inn[i][nc - 1], out[i][nc - 1]], T); }
  for (let k = 0; k + 1 < nc; k++) { quad([out[nr - 1][k], inn[nr - 1][k], inn[nr - 1][k + 1], out[nr - 1][k + 1]], T); quad([out[0][k + 1], inn[0][k + 1], inn[0][k], out[0][k]], M); }
  // rivets: a pair along the top, one at each corner of the foot, inside the rim
  if (stage >= 5) {
    // (on the outer face as built: the cell holding (u, v) in the grid's parameters, its corners blended)
    const at = (u, v) => {
      const k = Math.min(nc - 2, cs.findIndex((c, j) => j + 1 < nc && u <= cs[j + 1])), i = Math.min(nr - 2, rs.findIndex((r, j) => j + 1 < nr && v <= rs[j + 1]));
      const fu = (u - cs[k]) / (cs[k + 1] - cs[k]), fv = (v - rs[i]) / (rs[i + 1] - rs[i]), V = (ii, kk) => G.verts[out[ii][kk]];
      const p = lerp(lerp(V(i, k), V(i, k + 1), fu), lerp(V(i + 1, k), V(i + 1, k + 1), fu), fv);
      // (the normal across the cell's diagonals; the stud lifted clear of the cell's fold: by each corner's rise over
      // its plane at the stud's own radius)
      let n = cross(sub(V(i + 1, k + 1), V(i, k)), sub(V(i, k + 1), V(i + 1, k))); n = mul(n, 1 / Math.hypot(...n));
      if (dot(n, [p[0], 0, p[2] - D.z0]) < 0) n = mul(n, -1);
      let lift = 0;
      for (const c of [V(i, k), V(i, k + 1), V(i + 1, k), V(i + 1, k + 1)]) { const d = sub(c, p), h = dot(d, n), t = Math.hypot(...sub(d, mul(n, h))); if (h > 0 && t > 1e-6) lift = Math.max(lift, h * Math.min(1, 0.04 / t)); }
      lift += 0.02;
      // (then onto the face as cut: the ray from the hip's axis through it, onto the cell's own triangles)
      const o = [0, p[1], D.z0], dir = (() => { const d = sub(p, o); return mul(d, 1 / Math.hypot(...d)); })();
      let best = null;
      for (const pi of outPolys) for (let fk = 1; fk + 1 < G.polys[pi].v.length; fk++) {
        const pv = G.polys[pi].v, [a, b, c] = [pv[0], pv[fk], pv[fk + 1]].map((x) => G.verts[x]), e1 = sub(b, a), e2 = sub(c, a), h = cross(dir, e2), det = dot(e1, h);
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det, s2 = sub(o, a), uu = f * dot(s2, h); if (uu < -1e-6 || uu > 1 + 1e-6) continue;
        const q = cross(s2, e1), vv = f * dot(dir, q); if (vv < -1e-6 || uu + vv > 1 + 1e-6) continue;
        const t = f * dot(e2, q); if (best === null || t > best.t) { let nn = cross(e1, e2); nn = mul(nn, 1 / Math.hypot(...nn)); if (dot(nn, dir) < 0) nn = mul(nn, -1); best = { t, nn }; }
      }
      if (best) { const q = add(o, mul(dir, best.t)); return { p: add(q, mul(best.nn, lift)), n: best.nn }; }
      return { p: add(p, mul(n, lift)), n };
    };
    for (const [u, v] of [[0.3, 0.18], [0.7, 0.18], [0.16, 0.78], [0.84, 0.78]]) { const { p, n } = at(u, v); rivet(G, p, n, 0.045, 0.032, part); }
  }
}

/**
 * The wrap band round a leg (side 1 the left, -1 the right): its middle at y + amp cos(az - phi), w deep, bevelled,
 * raised t off the cloth (out along the ray from the leg's axis to the cloth at each column's height).
 */
function band(G, D, legR, legAxis, side, stage) {
  // (with `gap`, [from, to] degrees round the inside of the thigh, the band stops short there, its ends closed: it
  // wraps into the inseam, clear of the other leg as they pass in the walk)
  const Bd = D.band, gap = stage > 1 ? Bd.gap : null, N = gap ? 37 : 40, P = [], b = stage > 1 ? Bd.bevel : 0;
  const span = gap ? 360 - (gap[1] - gap[0]) : 360, a0 = gap ? gap[1] : 0;
  for (let k = 0; k < N; k++) {
    const a = a0 + k * span / (gap ? N - 1 : N), ym = Bd.y + Bd.amp * Math.cos(rad(a - Bd.phi)), yt = ym + Bd.w / 2, yb = ym - Bd.w / 2;
    const pt = (y, off, r0) => { const c = legAxis(y), aa = a; const r = r0 + off, p = [c[0] + Math.sin(rad(aa)) * r, y, c[1] + Math.cos(rad(aa)) * r]; return side > 0 ? p : [-p[0], p[1], p[2]]; };
    // (thinner on the inside of the thigh, where the legs pass each other: a third of its thickness there)
    const tk = gap ? Bd.t : Bd.t * (1 - 0.65 * Math.max(0, Math.cos(rad(a - 270))) ** 2);
    const h = 180 / N, rt = reach(legR, [yt, yt - 0.04], a, h), rb = reach(legR, [yb, yb + 0.04], a, h), r = Math.max(rt, rb, reach(legR, [yt, ym, yb], a, h));
    const bk = Math.min(b, tk * 0.45);
    P.push([pt(yt, IN + 0.01, rt), pt(yt, r - rt + tk - bk, rt), pt(yt - bk, r - rt + tk, rt), pt(yb + bk, r - rb + tk, rb), pt(yb, r - rb + tk - bk, rb), pt(yb, IN + 0.01, rb)]);
  }
  // (its face and bevels the rune, glowing when enchanted; its edges standing off the cloth the trim)
  const M = stage >= 4 ? 'trim' : 'leather', R = stage >= 4 ? 'rune' : 'leather';
  strip(G, side > 0 ? P : [...P].reverse(), [M, R, R, R, M], 'band', 'band', !gap);
  // the stitching: a dash on every other column near each edge of the band's face, light leather, just proud of it
  if (stage >= 5) for (let k = 0; k < (gap ? N - 1 : N); k += 2) {
    const a = P[k], c = P[(k + 1) % N], ax = legAxis(a[2][1]), out = [a[2][0] - side * ax[0], 0, a[2][2] - ax[1]];
    for (const f of [0.17, 0.83]) {
      const pa = lerp(a[2], a[3], f), pb = lerp(c[2], c[3], f), up = sub(a[2], a[3]), h = mul(up, 0.011 / Math.hypot(...up));
      let n = cross(sub(pb, pa), up); n = mul(n, 1 / Math.hypot(...n)); if (dot(n, out) < 0) n = mul(n, -1);
      const lift = mul(n, 0.009), q0 = add(lerp(pa, pb, 0.18), lift), q1 = add(lerp(pa, pb, 0.82), lift);
      G.tag = 'stitch';
      const v = [sub(q0, h), sub(q1, h), add(q1, h), add(q0, h)].map((x) => G.vert(x, 'band'));
      G.poly(v, stage >= 4 ? 'light' : 'leather', 'band', true);
    }
  }
}


/* ---- weights ------------------------------------------------------------------------------------------------------- */
/**
 * The weights from the body's (lowgarment.mjs transferWeights; the feet's bones taken up to the calf, the spine's above
 * the pelvis to spine_01), smoothed along each piece; the crotch's centre line shared between the pelvis and both hips
 * (as trousers.mjs); the cuff on the calf; each piece laid on the cloth (waistband, flaps, bands) the cloth's under it;
 * each rivet the piece's under it.
 */
export function leatherLegsWeights(rig, G, o = {}) {
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const keep = (i) => parts.has(rig.B.part[i]);
  const map = (n) => {
    if (/^(foot|ball|ankle|toes)_/.test(n)) return n.replace(/^(foot|ball|ankle|toes)/, 'calf');
    if (/^spine_0[23]$/.test(n)) return 'spine_01';
    return n;
  };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 3, keep });
  const at = (n) => rig.at.get(n);
  const set = (i, list) => { const s = list.reduce((a, [, w]) => a + w, 0); vw[i] = list.filter(([, w]) => w > 0).map(([n, w]) => [at(n), w / s]); };
  const R = G.rows, ctr = R.leg.l.C.slice(6);
  for (const [i, [p, h]] of [[ctr[0], [0.6, 0.2]], [ctr[3], [0.6, 0.2]], [ctr[1], [0.4, 0.3]], [ctr[2], [0.4, 0.3]]]) set(i, [['pelvis', p], ['hip_l', h], ['hip_r', h]]);
  for (const s of ['l', 'r']) for (const row of ['U', 'Um', 'Uf', 'E', 'Ei']) for (const i of R.leg[s][row] ?? []) set(i, [[`calf_${s}`, 1]]);
  // the pieces laid on the cloth (waistband, flaps, bands): each vertex the cloth's weights at the closest point of the
  // cloth under it (its triangle's corners' blended), so a piece moves with the cloth it lies on and keeps its gap
  const clothTris = G.tris.filter((t) => ['cloth', 'cuff'].includes(G.polys[t.poly].tag));
  for (let i = 0; i < G.verts.length; i++) {
    if (!['waistband', 'flap', 'band'].includes(G.part[i]) || G.rivetV?.has(i)) continue;
    const c = closestOnBody(G.verts, clothTris, G.verts[i]), acc = new Map();
    clothTris[c.tri].v.forEach((vi, k) => { for (const [bi, w] of vw[vi]) acc.set(bi, (acc.get(bi) ?? 0) + w * c.w[k]); });
    const l = [...acc].filter(([, w]) => w > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, 4), t = l.reduce((s2, [, w]) => s2 + w, 0);
    vw[i] = l.map(([bi, w]) => [bi, w / t]);
  }
  // the rivets: each vertex the weights of the piece it sits on at the closest point of it (the stud rides the face)
  for (const ids of G.studs ?? []) {
    const part = G.part[ids[0]], hostT = G.tris.filter((t) => G.polys[t.poly].tag !== 'rivet' && G.part[t.v[0]] === part);
    for (const i of ids) {
      const c = closestOnBody(G.verts, hostT, G.verts[i]), acc = new Map();
      hostT[c.tri].v.forEach((vi, q) => { for (const [bi, w] of vw[vi]) acc.set(bi, (acc.get(bi) ?? 0) + w * c.w[q]); });
      const l = [...acc].filter(([, w]) => w > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, 4), t = l.reduce((s2, [, w]) => s2 + w, 0);
      vw[i] = l.map(([bi, w]) => [bi, w / t]);
    }
  }
  return vw;
}

/**
 * The body's polygons the cloth covers whole at rest: torso, pelvis and legs, each corner below the waistband's top (by
 * `m`) and above the cuff's foot (by `m`).
 */
export function hiddenPolys(rig, G, m = 0.06) {
  const { B } = rig, D = G.design;
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const topY = D.waist.top - D.waist.vt - 0.05, footY = D.cuff.foot + 0.1;
  const covered = (i) => { const p = B.verts[i]; return parts.has(B.part[i]) && p[1] < topY - m && p[1] > footY + m; };
  return B.polys.map((p, k) => (p.v.every(covered) ? k : -1)).filter((k) => k >= 0);
}

/** The leggings whole: built, the rivets' vertices noted, weighted. */
export function leatherLegs(rig, o = {}) {
  const G = buildLeatherLegs(rig, undefined, o);
  G.rivetV = new Set(G.polys.filter((p) => p.tag === 'rivet').flatMap((p) => p.v));
  G.vw = leatherLegsWeights(rig, G);
  G.hides = hiddenPolys(rig, G);
  return G;
}

/** The garment cut down to the polygons passing keep(poly): their vertices (and weights) renumbered, the rest left out. */
export function piecesOf(G, keep) {
  const polys = G.polys.filter(keep), old = [...new Set(polys.flatMap((p) => p.v))].sort((a, b) => a - b), at = new Map(old.map((v, i) => [v, i]));
  const H = { verts: old.map((v) => G.verts[v]), part: old.map((v) => G.part[v]), polys: polys.map((p) => ({ ...p, v: p.v.map((v) => at.get(v)) })), vw: old.map((v) => G.vw[v]) };
  H.tris = trisOf(H);
  return H;
}
/** Whether a polygon is one of the hip flaps' (their panels, rims and rivets). */
export const isFlap = (G) => (p) => p.v.every((v) => G.part[v] === 'flap');

/* ---- the game's copies ---------------------------------------------------------------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  const built = 'node tools/sculpt/garments/leatherlegs.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', looks = { plain: LOOKS.plain, enchanted: LOOKS.enchanted };
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = leatherLegs(rig), flap = isFlap(G);
    const L = piecesOf(G, (p) => !flap(p)), F = piecesOf(G, flap);
    const file = (n) => new URL(`../../../src/sculpt/assets/${n}-${who}.json`, import.meta.url);
    writeFileSync(file('lowleatherlegs'), JSON.stringify({ built, ...garmentAsset(rig, L, MATS, looks), hides: G.hides }));
    writeFileSync(file('lowleatherlegsflaps'), JSON.stringify({ built, ...garmentAsset(rig, F, MATS, looks) }));
    console.log(who, `leggings ${L.verts.length} vertices, ${L.tris.length} triangles; flaps ${F.verts.length} vertices, ${F.tris.length} triangles; ${G.hides.length} body polygons hidden`);
  }
}
