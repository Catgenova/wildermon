// The scale set's helm (the item scale_helm): a cap of dragon scale in courses over a dark leather shell, its crown a
// faceted scale-plate boss, a scale-plate band round the brow edged in gold with a core over the brow, a riveted
// scale-plate cheek guard each side and two curved scale-plate lames over the nape, each with a hard gold-rimmed foot, the
// face open. Rigid on the head bone, no bones of its own.
//
//   buildScaleHelm(rig, design?) → { verts, polys: [{ v, mat, part, tag }], tris, wt, hides }
//
//   node tools/sculpt/garments/scalehelm.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowscalehelm-male.json and lowscalehelm-female.json
//     (lowgarment.mjs garmentAsset, with `hides`, the head's polygons it covers whole; loaded by src/sculpt/lowpoly.ts
//     behind the outfit switch `scaleHelm`, the hair not drawn under it)
//
// The construction, about a centre in the head (C) and a pole straight up: a direction by φ from the pole and its
// azimuth (0 forward, 90 the body's left). The shell: rows from the crown (φ0) down to its lower edge, which runs by
// azimuth (`edge`: over the brow at the front, a little under the band elsewhere), each point the head's reach that way
// (its samples in a cone round the direction) out by the clearance, smoothed round each row, fitted over the head
// (platechest.mjs fitOut) and laid as a plate (plateOf) in the dark leather, its top rows scale-plate and closed by a low
// cone; the scales in courses over it (scale.mjs scalesOn); the guards (plates hung from under the band, the neck's lower
// lame first, the cheeks over the lames' ends, each fitted over what is under it); the band (a plate over them all,
// gold-rimmed) with its core at the front.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { meshOf, trisOf, sub, add, mul, dot, cross, unit } from '../lowgarment.mjs';
import { fitOut, plateOf, coreOn, gridAt, piece, bodySamples, surfOf } from './platechest.mjs';
import { MATS, LOOKS, scalesOn, polyTris, coursesOf, rayTris } from './scale.mjs';

/**
 * The design per body. C: the centre; phi0: the crown boss's foot ring; crown: the rows (shares down) in scale-plate;
 * edge: the shell's lower edge, φ by |azimuth| ([[az, φ], ...], straight between); c: the clearance off the head by φ
 * ([[φ, c], ...]); band: its middle φ by |azimuth|, its half height (degrees), how far it stands off the shell; rim: the
 * band's gold rim (platechest.mjs plateOf); scales: a course's height (degrees of φ), a scale's width, lift, ridge,
 * thickness, from φ; core: its radius; flare: the guards' lean out under the band, per degree of φ;
 * cheek: φ from its top to its foot, its span in |azimuth| at the top and at the foot (front, back), how far it stands off
 * the head, its middle row's bulge, its studs (row, column on its grid); neck: its span in azimuth, its lames (φ top and
 * foot, how far off: the upper further, over the lower's top), the bulge.
 */
export const DESIGN = {
  male: {
    C: [0, 1.15, -0.06], phi0: 14, rows: [0, 0.12, 0.26, 0.42, 0.58, 0.74, 0.88, 1], crown: 1,
    edge: [[0, 80], [40, 84], [60, 94], [110, 98], [180, 104]],
    c: [[0, 0.07], [60, 0.08], [100, 0.1], [140, 0.16]],
    band: { phi: [[0, 70], [60, 76], [100, 88], [180, 100]], half: 7, off: 0.1 },
    rim: { w: 0.07, h: 0.03, t: 0.03 },
    scales: { course: 18, w: 0.4, lift: [0.012, 0.06], ridge: 0.022, thick: 0.03, from: 22 },
    core: 0.15,
    cheek: { phi: [84, 119], top: [56, 124], bottom: [76, 116], off: 0.16, bulge: 0.025, studs: [[0.55, 1.2], [0.55, 2.8], [1.45, 2]] },
    neck: { az: [116, 244], lames: [{ phi: [106, 119], off: 0.05 }, { phi: [95, 109], off: 0.11 }], bulge: 0.02 },
    flare: 0.004,
  },
  female: {
    C: [0, 1.12, -0.06], phi0: 14, rows: [0, 0.12, 0.26, 0.42, 0.58, 0.74, 0.88, 1], crown: 1,
    edge: [[0, 78], [40, 82], [60, 92], [110, 96], [180, 102]],
    c: [[0, 0.06], [60, 0.07], [100, 0.09], [140, 0.14]],
    band: { phi: [[0, 68], [60, 74], [100, 86], [180, 98]], half: 6.5, off: 0.09 },
    rim: { w: 0.06, h: 0.026, t: 0.026 },
    scales: { course: 17, w: 0.36, lift: [0.011, 0.054], ridge: 0.02, thick: 0.027, from: 22 },
    core: 0.13,
    cheek: { phi: [82, 116], top: [56, 124], bottom: [76, 116], off: 0.14, bulge: 0.022, studs: [[0.55, 1.2], [0.55, 2.8], [1.45, 2]] },
    neck: { az: [116, 244], lames: [{ phi: [104, 117], off: 0.045 }, { phi: [93, 107], off: 0.1 }], bulge: 0.018 },
    flare: 0.004,
  },
};

const rad = (d) => d * Math.PI / 180;
const interp = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / (P[i + 1][0] - P[i][0]);
  return P[P.length - 1][1];
};
const byAz = (T, az) => interp(T, Math.abs(((az + 540) % 360) - 180));

export function buildScaleHelm(rig, D = DESIGN[rig.who]) {
  const { B } = rig, G = meshOf();
  G.wt = []; G.plates = [];
  const head = bodySamples(B).filter((s) => s.part === 'head').map((s) => s.p);
  const C = D.C, wt = { head: 1 };
  const dir = (phi, az) => [Math.sin(rad(phi)) * Math.sin(rad(az)), Math.cos(rad(phi)), Math.sin(rad(phi)) * Math.cos(rad(az))];
  const reach = (d, cone = 14) => { const cc = Math.cos(rad(cone)); let r = 0; for (const p of head) { const q = sub(p, C), l = Math.hypot(...q), cs = dot(q, d) / (l || 1); if (cs > cc) r = Math.max(r, l * cs); } return r; };
  const AZ = Array.from({ length: 24 }, (_, k) => k * 15);
  // the shell: rows down from the crown to the lower edge, the head's reach out by the clearance down to the band's
  // height (φ 90); under it the guards fall straight, as far out as the shell is there and flaring by `flare` a degree
  // further down; smoothed round each row, never in from its own
  const r90 = AZ.map((az) => { const d = dir(90, az); return reach(d) + interp(D.c, 90); });
  let rows = D.rows.map((f) => AZ.map((az, k) => {
    const phi = D.phi0 + (byAz(D.edge, az) - D.phi0) * f, d = dir(phi, az);
    if (phi <= 90) return add(C, mul(d, reach(d) + interp(D.c, phi)));
    return add(C, mul(d, (r90[k] + (D.flare ?? 0.004) * (phi - 90)) / Math.sin(rad(phi))));
  }));
  for (let it = 0; it < 3; it++) {
    const rr = rows.map((row) => row.map((p) => Math.hypot(...sub(p, C))));
    rows = rows.map((row, r) => row.map((p, k) => { const n = row.length, m = (rr[r][(k + n - 1) % n] + 2 * rr[r][k] + rr[r][(k + 1) % n]) / 4; return add(C, mul(unit(sub(p, C)), Math.max(m, rr[r][k]))); }));
  }
  fitOut(rows, true, (p) => sub(p, C), head, 0.05);
  const s0 = G.polys.length;
  plateOf(G, rows, { tag: 'shell', bone: wt, rim: D.rim, out: (p) => sub(p, C), ring: true, border: { top: 'open', bottom: 'edge' }, mat: (r) => (r < D.crown ? 'scale' : 'under'), edgeMat: 'leather' });
  const shellTris = polyTris(G, s0, G.polys.length, (m) => m === 'under' || m === 'scale');
  // (the crown closed by a low cone: the boss)
  {
    const top = rows[0], ids = top.map((p) => G.verts.findIndex((q) => q === p)), mid = mul(top.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / top.length);
    const apex = G.vert(add(mid, [0, 0.07, 0]), 'crown'); G.wt[apex] = wt;
    G.tag = 'crown';
    const c0 = G.polys.length;
    ids.forEach((a, k) => G.poly([a, ids[(k + 1) % ids.length], apex], 'scale', 'crown'));
    piece(G, c0, (p) => sub(p, C));
  }
  // the scales: courses down from under the boss, round from the back (the face's opening parts the lower courses in two)
  const Sd = D.scales, maxEdge = Math.max(...D.edge.map(([, e]) => e));
  const { us, h } = coursesOf(Sd.from, maxEdge + Sd.course * 0.1, Sd.course);
  scalesOn(G, { tris: shellTris }, { h, us, w: Sd.w, v: [180, 540], lift: Sd.lift, ridge: Sd.ridge, thick: Sd.thick, cast: (u, v) => [C, dir(u, v)], out: (p) => sub(p, C), wt, tag: 'scales', minRun: 10 });
  const scaleS = [];
  for (const p of G.polys) if (p.tag === 'scales') for (const i of p.v) scaleS.push(G.verts[i]);
  // the guards: solid scale-plates hung under the band, each a plate with a hard foot rimmed in gold. Their faces the
  // head's reach (over the band's height) or straight down from it (under it, flaring by `flare` a degree), out by
  // `off`; fitted over the head, the shell and the cap's scales
  const r90m = new Map();
  const R = (phi, az) => {
    if (phi <= 90) return reach(dir(phi, az)) + interp(D.c, phi);
    const k = Math.round(az * 2) / 2;
    if (!r90m.has(k)) r90m.set(k, reach(dir(90, k)) + interp(D.c, 90));
    return (r90m.get(k) + D.flare * (phi - 90)) / Math.sin(rad(phi));
  };
  const at = (phi, az, extra) => add(C, mul(dir(phi, az), R(phi, az) + extra));
  const sideOut = (p) => [p[0] - C[0], 0, p[2] - C[2]];
  const under = [[head, 0.06], [surfOf(G, s0), 0.03], [scaleS, 0.02]];
  // (a stud: a gold four-sided boss on a plate, its rivet)
  const stud = (pl, rf, cf, r) => {
    const h0 = gridAt(pl, rf, cf), n = h0.n, u = unit(cross(n, [0, 1, 0])), v = cross(u, n);
    const V = (p) => { const i = G.vert(p, 'stud'); G.wt[i] = wt; return i; };
    const base = [u, v, mul(u, -1), mul(v, -1)].map((d) => V(add(add(h0.q, mul(n, 0.008)), mul(d, r)))), top = V(add(h0.q, mul(n, r * 0.9)));
    G.tag = 'stud';
    const c0 = G.polys.length;
    base.forEach((a, k) => G.poly([a, base[(k + 1) % 4], top], 'gold', 'stud'));
    piece(G, c0, () => n);
  };
  // the neck guard: two curved lames across the back, the upper over the lower's top
  const Nk = D.neck, nAz = Array.from({ length: 9 }, (_, k) => Nk.az[0] + ((Nk.az[1] - Nk.az[0]) * k) / 8);
  for (const L of Nk.lames) {
    const rows = [0, 0.5, 1].map((f, r) => nAz.map((az) => at(L.phi[0] + (L.phi[1] - L.phi[0]) * f, az, L.off + (r === 1 ? Nk.bulge : 0))));
    fitOut(rows, false, sideOut, under, 0);
    const p0 = G.polys.length;
    plateOf(G, rows, { tag: 'neck', bone: wt, rim: D.rim, out: sideOut, border: { top: 'open', bottom: 'trim', left: 'edge', right: 'edge' }, mat: (r) => (r === 0 ? 'scale' : 'edge'), edgeMat: 'edge' });
    under.push([surfOf(G, p0), 0.03]);
  }
  // the cheek guards: one plate a side, narrowing to its foot along the jaw, its front edge rimmed in gold, three studs
  const Ck = D.cheek;
  for (const s of [1, -1]) {
    const rows = [0, 0.5, 1].map((f, r) => Array.from({ length: 5 }, (_, k) => {
      const a0 = Ck.top[0] + (Ck.bottom[0] - Ck.top[0]) * f, a1 = Ck.top[1] + (Ck.bottom[1] - Ck.top[1]) * f, az = a0 + ((a1 - a0) * k) / 4;
      return at(Ck.phi[0] + (Ck.phi[1] - Ck.phi[0]) * f, s * az, Ck.off + (r === 1 ? Ck.bulge : 0));
    }));
    fitOut(rows, false, sideOut, under, 0);
    const cheek = plateOf(G, rows, { tag: 'cheek', bone: wt, rim: D.rim, out: sideOut, border: { top: 'open', bottom: 'trim', left: 'trim', right: 'edge' }, mat: (r) => (r === 0 ? 'scale' : 'edge'), edgeMat: 'edge' });
    for (const [rf, cf] of Ck.studs) stud(cheek, rf, cf, D.rim.w * 0.6);
  }
  const guardS = [];
  for (const p of G.polys) if (p.tag === 'neck' || p.tag === 'cheek') for (const i of p.v) guardS.push(G.verts[i]);
  // the band over them all: its rows on the shell, out past the scales and the guards' tops by `off`
  const Bd = D.band;
  const bandRows = [-1, 0, 1].map((f) => AZ.map((az) => {
    const phi = byAz(Bd.phi, az) + f * Bd.half, d = dir(phi, az), s = rayTris(shellTris, C, d) || reach(d) + interp(D.c, phi);
    return add(C, mul(d, s + Bd.off));
  }));
  fitOut(bandRows, true, (p) => sub(p, C), [[head, 0.06], [scaleS, 0.012], [guardS, 0.012]], 0);
  const band = plateOf(G, bandRows, { tag: 'band', bone: wt, rim: D.rim, out: (p) => sub(p, C), ring: true, border: { top: 'trim', bottom: 'trim' }, mat: 'scale', edgeMat: 'edge' });
  coreOn(G, band, gridAt(band, 1, 0).q, { dir: [0, 1, 0], out: [0, 0, 1] }, D.core, 6, 'core');
  G.tris = trisOf(G);
  G.hides = hiddenPolys(rig, G);
  return G;
}

/** The head's polygons the helm covers whole: every corner's ray out along its normal meets the helm within `reach`. */
export function hiddenPolys(rig, G, { reach = 0.5 } = {}) {
  const { B } = rig;
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const T = G.tris.map((t) => t.v.map((i) => G.verts[i]));
  const cov = B.verts.map((p, i) => B.part[i] === 'head' && rayTris(T, p, unit(N[i])) > 0 && rayTris(T, p, unit(N[i])) < reach);
  return B.polys.map((p, k) => (p.v.every((i) => cov[i]) ? k : -1)).filter((k) => k >= 0);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildScaleHelm(rig);
    const head = rig.at.get('head');
    G.vw = G.verts.map(() => [[head, 1]]);
    const file = new URL(`../../../src/sculpt/assets/lowscalehelm-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/scalehelm.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${G.polys.length} polygons, hides ${G.hides.length} head polygons: wrote`, file.pathname);
  }
}
