// The scale set's cuirass & sleeves (the items scale_cuirass and scale_sleeves, one garment worn for either): a leather
// cuirass laid over with courses of dragon scale, under a standing collar of scale-plate; a dark belt with a core for a
// buckle; a skirt of scaled leather panels over the upper thigh; scaled shoulder caps, a scale sleeve to the elbow
// (two lapped rings, open toward the body), leather bracers with a glowing diamond and an engraved line, the hands bare;
// a dark padded under-layer at the armpit and the inner elbow. His broad, hers fitted. Worn over bare skin: the body's
// polygons it covers whole are hidden (`hides`).
//
//   buildScaleChest(rig, design?) → { verts, polys: [{ v, mat, part, tag }], tris, part, wt, design, hides }
//   (its weights: platechest.mjs plateChestWeights, each piece rigid on its bone or bones, as the plate chest's; the front
//   and the back with their scales taking the clavicles' share of the skin under them, followSkin; the trunk's skin they
//   leave bare, round the collar and over the trapezius, under a layer of the cuirass's leather, underTrunk)
//
//   node tools/sculpt/garments/scalechest.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowscalechest-male.json and lowscalechest-female.json
//     (lowgarment.mjs garmentAsset, with `hides` and the `plain` and `enchanted` looks; loaded by src/sculpt/lowpoly.ts)
//
// Built on the plate chest's layout (platechest.mjs: its design per body, read off the plate sheet, and its sections of
// the body), each piece a base plate (plateOf: a grid on the body's hull, fitted over the body and the pieces under it)
// in leather, then its scales (scale.mjs scalesOn) in courses across it; laid from the inside out, so each piece is
// fitted over the scales of the pieces under it. Where the plate chest has a gauntlet and a wrist cuff, the scale
// sleeve stops at the elbow and the bracer at the wrist.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { meshOf, trisOf, sub, add, mul, dot, cross, unit } from '../lowgarment.mjs';
import { TORSO_RING } from '../lowarm.mjs';
import { designOf, fitOut, plateOf, surfOf, gridAt, coreOn, inlayOn, mirrorCols, pauldronFrame, armCharts, bodySamples, collarFrame, trunkCharts, plateChestWeights, piece, tabAt, followSkin, underTrunk } from './platechest.mjs';
import { MATS, LOOKS, scalesOn, polyTris, coursesOf } from './scale.mjs';

/**
 * The scale design per body, over the plate chest's (platechest.mjs designOf): `course` a course's height on the trunk,
 * `w` a scale's width there; `arm` the same on the sleeves and the caps (in the limb's units: along the bone); `lift`
 * [top, point] off the base, `ridge`, `thick`; the trunk's scales from `from` (a height) down; the sleeve's two rings
 * (t along the upper arm from the shoulder, its share of the shoulder helper), the cap's courses (φ from the pole,
 * degrees), the collar lowered by `collarDrop`.
 */
export const SCALE = {
  male: {
    course: 0.44, w: 0.44, from: -1.02, lift: [0.014, 0.075], ridge: 0.028, thick: 0.04,
    arm: { course: 0.36, w: 0.36 }, capFrom: 44, capCourse: 20, capN: 10,
    sleeve: [{ t: [0.45, 1.2], th: [-25, 205], c: [0.07, 0.1], bone: { shoulder_l: 0.5, upperarm_l: 0.5 } }, { t: [1.12, 1.66], th: [-30, 210], c: [0.04, 0.05], bone: { upperarm_l: 1 } }],
    collarDrop: 0.08,
  },
  female: {
    course: 0.38, w: 0.38, from: -1.05, lift: [0.012, 0.065], ridge: 0.024, thick: 0.034,
    arm: { course: 0.3, w: 0.3 }, capFrom: 44, capCourse: 20, capN: 9,
    sleeve: [{ t: [0.38, 0.95], th: [-25, 205], c: [0.06, 0.09], bone: { shoulder_l: 0.5, upperarm_l: 0.5 } }, { t: [0.88, 1.36], th: [-30, 210], c: [0.035, 0.045], bone: { upperarm_l: 1 } }],
    collarDrop: 0.06,
  },
};

const rad = (d) => d * Math.PI / 180;
/** A horizontal direction at azimuth a (0 the front, 90 the body's left). */
const azDir = (a) => [Math.sin(rad(a)), 0, Math.cos(rad(a))];
/** Scales a course across `span` degrees at radius r, each about w wide. */
const across = (span, r, w) => Math.max(1, Math.round((rad(span) * r) / w));

function torsoPieces(G, rig, D, S, SC) {
  const { B } = rig, rim = D.rim;
  const { chest, fsec, fz, parts } = trunkCharts(D, S);
  const outOf = (sec) => (p) => { const a = sec.axisAt(p[1]); return [p[0] - a[0], 0, p[2] - a[2]]; };
  const trunk = parts(['torso', 'neck', 'pelvis']), hipS = parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > D.faulds.top - 3);
  // (the trunk's scales: a ray from the chest's axis at height -u out at azimuth v)
  const trunkCast = (u, v) => [chest.axisAt(-u), azDir(v)];
  const sc = { h: SC.course, lift: SC.lift, ridge: SC.ridge, thick: SC.thick };
  const radius = (y) => { const a = chest.axisAt(y), p = chest.at(y, 0, 0), q = chest.at(y, 90, 0); return (Math.hypot(p[0] - a[0], p[2] - a[2]) + Math.hypot(q[0] - a[0], q[2] - a[2])) / 2; };
  // the set's leggings under the belt and the skirt (as the plate chest's, D.legs)
  let legS = null;
  if (D.legs) {
    const Lg = D.legs, hx = rig.J.hip[0], hz = rig.J.hip[2];
    const cl = (y) => { const f = (Lg.top - y) / (Lg.top - Lg.bottom) * (Lg.c.length - 1); if (f <= 0) return Lg.c[0]; if (f >= Lg.c.length - 1) return Lg.c[Lg.c.length - 1]; const i = Math.floor(f); return Lg.c[i] + (Lg.c[i + 1] - Lg.c[i]) * (f - i); };
    legS = S.filter((s0) => ['pelvis', 'legs'].includes(s0.part) && s0.p[1] < Lg.top + 0.05 && s0.p[1] > Lg.bottom - 2.2).map(({ p, part }) => {
      const o = part === 'legs' ? [Math.sign(p[0]) * hx, hz] : [0, hz], d = unit([p[0] - o[0], 0, p[2] - o[1]]);
      return add(p, mul(d, cl(p[1])));
    });
  }
  const grid = (sec, az, top, bottom, rows, c, extra = () => 0) => rows.map((f, r) => az.map((a, k) => {
    const y = top[k] + (bottom[k] - top[k]) * f;
    return sec.at(y, a, (Array.isArray(c) ? c[r] : c) + extra(r, k, a));
  }));

  const Cd = D.collar;
  // the cuirass's front (spine_03): the plate chest's breastplate, from the right side through the front to the left
  const Bp = D.breast;
  const bAz = mirrorCols(Bp.az, (x) => -x), bTop = mirrorCols(Bp.top), bBot = mirrorCols(Bp.bottom);
  const sideOut = (a, a0 = 66, a1 = 90) => (D.sideC ?? 0) * Math.max(0, Math.min(1, (Math.abs(a) - a0) / (a1 - a0)));
  const bExtra = (r, k, a) => sideOut(a) + (r <= 1 ? (D.shrugC ?? 0) * (r === 0 ? 1 : 0.6) * Math.max(0, Math.min(1, (Math.abs(a) - 35) / 25)) : 0);
  const bRows = grid(chest, bAz, bTop, bBot, Bp.rows, Bp.c, bExtra);
  const rad0 = (p) => { const a = chest.axisAt(p[1]); return Math.hypot(p[0] - a[0], p[2] - a[2]); };
  const setRad = (p, r) => { const a = chest.axisAt(p[1]), d = unit([p[0] - a[0], 0, p[2] - a[2]]); return [a[0] + d[0] * r, p[1], a[2] + d[2] * r]; };
  bRows.forEach((row, r) => {
    if (r === 0) return;
    const ia = bAz.indexOf(Bp.flat), ib = bAz.indexOf(-Bp.flat);
    if (ia < 0 || ib < 0) return;
    const A = row[ia], Bq = row[ib];
    for (let k = Math.min(ia, ib) + 1; k < Math.max(ia, ib); k++) {
      const t = (row[k][0] - Bq[0]) / (A[0] - Bq[0]), q = add(Bq, mul(sub(A, Bq), t));
      if (rad0(q) > rad0(row[k])) row[k] = setRad(row[k], rad0(q));
    }
  });
  fitOut(bRows, false, outOf(chest), trunk, D.fit.trunk);
  // the back (spine_03), its sides under the front's
  const Kp = D.back;
  const kAzL = [...Kp.az, ...Kp.az.slice(0, -1).reverse().map((a) => 360 - a)];
  const kTop = [...Kp.top, ...Kp.top.slice(0, -1).reverse()], kBot = [...Kp.bottom, ...Kp.bottom.slice(0, -1).reverse()];
  const midK = Kp.az.length - 1;
  const kRows = grid(chest, kAzL, kTop, kBot, Kp.rows, Kp.c, (r, k, a) => (k === midK ? Kp.ridge * 0.4 : k === 0 || k === kAzL.length - 1 ? -Kp.side : 0) + sideOut(180 - Math.abs(((a + 540) % 360) - 180), 66, 90));
  fitOut(kRows, false, outOf(chest), trunk, D.fit.trunk);
  // the waist ring and the belt
  const K = D.lames.some((L) => L.edge) ? 24 : D.lameCols, ringAz = Array.from({ length: K }, (_, k) => (k * 360) / K);
  const lames = D.lames.map((L) => {
    const rows = [0, 1].map((f) => ringAz.map((a) => {
      const yb = L.edge ? tabAt(L.edge, 'bottom', a) : L.bottom - L.v * Math.max(0, Math.cos(a * Math.PI / 180)) ** 2;
      const y = (L.edge ? tabAt(L.edge, 'top', a) : L.top) + (yb - (L.edge ? tabAt(L.edge, 'top', a) : L.top)) * f;
      return chest.at(y, a, L.c[f]);
    }));
    fitOut(rows, true, outOf(chest), trunk, D.fit.lame);
    return { rows, ring: true, L };
  });
  // the skirt: the plate chest's faulds, scaled
  const F = D.faulds;
  const fauldRows = [];
  for (const pl of F.plates) for (const s of pl.mirror ? [1, -1] : [1]) {
    const az = (s > 0 ? pl.az : pl.az.slice().reverse().map((a) => -a));
    const bottom = s > 0 ? pl.bottom : pl.bottom.slice().reverse();
    const rows = [];
    for (let r = 0; r < 2; r++) rows.push(az.map((a, k) => {
      const t0 = F.top - (pl.mirror ? F.sideDrop ?? 0 : 0), y = t0 + (bottom[k] - t0) * r;
      let p = fsec.at(y, a, F.c + F.flare * (F.top - y) / 2 + (r === 0 && pl.mirror ? F.sideTop ?? 0 : 0));
      if (r > 0) {
        const prev = rows[r - 1][k], d = azDir(a);
        const rp = dot(sub(prev, [0, prev[1], fz]), d), rc = dot(sub(p, [0, p[1], fz]), d);
        if (rc < rp) p = add([0, y, fz], mul(d, rp));
      }
      return p;
    }));
    fitOut(rows, false, (p) => [p[0], 0, p[2] - fz], legS ? [[hipS, D.fit.fauld], [legS, rim.t + D.fit.gap]] : hipS, D.fit.fauld);
    const bone = s > 0 ? pl.bone : Object.fromEntries(Object.entries(pl.bone).map(([b, w]) => [b.replace(/_l$/, '_x').replace(/_r$/, '_l').replace(/_x$/, '_r'), w]));
    fauldRows.push({ rows, az, bone, bottom, name: pl.mirror ? (s > 0 ? 'skirt.l' : 'skirt.r') : Math.abs(az[(az.length - 1) / 2]) > 90 ? 'skirt.b' : 'skirt.f' });
  }
  const gap = rim.t + D.fit.gap, under = legS ? [legS] : [];
  fauldRows.sort((a, b) => /[lr]$/.test(a.name) - /[lr]$/.test(b.name));
  const fauldSurf = [];
  const beltBottom = D.lames[D.lames.length - 1].bottom, skirt0 = G.polys.length;
  for (const { rows, az, bone, bottom, name } of fauldRows) {
    if (/[lr]$/.test(name)) fitOut(rows, false, (p) => [p[0], 0, p[2] - fz], [[hipS, D.fit.fauld], ...(legS ? [[legS, gap]] : []), ...fauldSurf.map((P) => [P, gap])]);
    const f0 = G.polys.length;
    plateOf(G, rows, { tag: 'skirt', bone, rim, out: (p) => [p[0], 0, p[2] - fz], border: { top: 'open', left: 'edge', right: 'edge', bottom: 'edge' }, mat: 'under', edgeMat: 'leather' });
    // (its scales from under the belt down past its foot: a hem of points)
    const span = Math.abs(az[az.length - 1] - az[0]), r = Math.hypot(...sub(rows[1][(az.length - 1) / 2], [0, rows[1][0][1], fz]));
    const { us, h } = coursesOf(Math.max(-(beltBottom + 0.06), -Math.min(...rows[0].map((p) => p[1])) + 0.03), -(bottom.reduce((a, b) => a + b, 0) / bottom.length) + SC.course * 0.2, SC.course);
    scalesOn(G, { tris: polyTris(G, f0) }, { ...sc, h, us, v: [Math.min(az[0], az[az.length - 1]), Math.max(az[0], az[az.length - 1])], w: SC.w, cast: (u, v) => [[0, -u, fz], azDir(v)], out: (p) => [p[0], 0, p[2] - fz], wt: bone, tag: 'skirt scales' });
    for (let k = f0; k < G.polys.length; k++) G.polys[k].piece = name;
    if (!/[lr]$/.test(name)) fauldSurf.push(surfOf(G, f0));
  }
  under.push(surfOf(G, skirt0));
  // the belt (dark, a core for its buckle) over the skirt's top, the waist ring (scaled) over the belt's top
  for (let li = lames.length - 1; li >= 0; li--) {
    const { rows, L } = lames[li], p0 = G.polys.length;
    fitOut(rows, true, outOf(chest), [[trunk, D.fit.lame], ...under.map((P) => [P, gap])]);
    const belt = L.piece === 'belt';
    const pl = plateOf(G, rows, { tag: belt ? 'belt' : 'waist', bone: L.bone, rim, out: outOf(chest), ring: true, border: { top: belt ? 'trim' : 'open', bottom: belt ? 'trim' : 'edge' }, mat: belt ? 'leather' : 'under', edgeMat: belt ? 'gold' : 'leather' });
    if (belt) {
      coreOn(G, pl, gridAt(pl, 0.5, 0).q, { dir: [0, 1, 0], out: [0, 0, 1] }, (L.top - L.bottom) * 0.42, 6, 'buckle');
    } else {
      const { us, h } = coursesOf(-L.top + 0.04, -L.bottom - L.v + SC.course * 0.25, SC.course * 0.8);
      scalesOn(G, { tris: polyTris(G, p0) }, { ...sc, h, us, ring: true, n: across(360, radius((L.top + L.bottom) / 2), SC.w), cast: trunkCast, out: outOf(chest), wt: L.bone, tag: 'waist scales' });
    }
    for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = belt ? 'belt' : 'waist';
    under.push(surfOf(G, p0));
  }
  fitOut(kRows, false, outOf(chest), [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);
  fitOut(bRows, false, outOf(chest), [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);

  G.trunkStart = G.polys.length;
  // the back first, then the front over its sides
  const backTop = (r, c) => (Math.abs(180 - kAzL[c]) <= 45 && Math.abs(180 - (kAzL[c + 1] ?? 999)) <= 45 ? 'open' : 'trim');
  const kq0 = G.polys.length;
  plateOf(G, kRows, { tag: 'back', bone: { spine_03: 1 }, rim, out: outOf(chest), border: { left: 'edge', right: 'edge', top: backTop, bottom: 'edge' }, mat: 'under', edgeMat: 'leather' });
  {
    const y0 = Math.max(SC.from, Math.max(...kTop) - 0.1), y1 = Math.min(...kBot);
    const { us, h } = coursesOf(-y0, -y1 + SC.course * 0.2, SC.course);
    scalesOn(G, { tris: polyTris(G, kq0) }, { ...sc, h, us, v: [kAzL[0] + 4, kAzL[kAzL.length - 1] - 4], w: SC.w, cast: trunkCast, out: outOf(chest), wt: { spine_03: 1 }, tag: 'back scales' });
  }
  const bq0 = G.polys.length;
  plateOf(G, bRows, { tag: 'front', bone: { spine_03: 1 }, rim, out: outOf(chest), border: { top: (r, c) => (Math.abs(bAz[c]) <= Cd.open && Math.abs(bAz[c + 1] ?? 999) <= Cd.open ? 'open' : 'trim'), left: 'edge', right: 'edge', bottom: 'edge' }, mat: 'under', edgeMat: 'leather' });
  {
    const y1 = Math.min(...bBot);
    const { us, h } = coursesOf(-SC.from, -y1 + SC.course * 0.2, SC.course);
    scalesOn(G, { tris: polyTris(G, bq0) }, { ...sc, h, us, v: [bAz[0] + 2, bAz[bAz.length - 1] - 2], w: SC.w, cast: trunkCast, out: outOf(chest), wt: { spine_03: 1 }, tag: 'front scales' });
  }
  G.trunkEnd = G.polys.length;

  // the collar: the plate chest's, lowered, its wall scale-plate with a gold top and a dark inside
  const { nz, r0n } = collarFrame(D, S, B);
  const lipCap = (a, y) => { if (!Cd.lip) return y; const x = Math.abs(((a + 540) % 360) - 180), [az, ly] = Cd.lip; return x <= az ? Math.min(y, ly) : x >= az + 20 ? y : Math.min(y, ly + ((y - ly) * (x - az)) / 20); };
  const hAt0 = (L, a) => { const x = Math.abs(a) / 180; return x < 0.5 ? L[0] + (L[1] - L[0]) * x * 2 : L[1] + (L[2] - L[1]) * (x - 0.5) * 2; };
  const hAt = (L, a) => { if (L === Cd.top && Cd.topTab) return lipCap(a, tabAt(Cd.topTab, 'top', a)) - SC.collarDrop; if (L === Cd.top) return lipCap(a, hAt0(L, a)) - SC.collarDrop; return hAt0(L, a); };
  const span = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => +(a + ((b - a) * k) / n).toFixed(2));
  const cols = Cd.seg ? [span(Cd.seg.a0, Cd.seg.a1, Math.max(2, Math.round((Cd.seg.a1 - Cd.seg.a0) / 12))), span(Cd.seg.a1 + Cd.seg.gap, 180, Math.max(2, Math.round((180 - Cd.seg.a1 - Cd.seg.gap) / 12)))] : Cd.cols;
  const segs = [{ cols: cols[0], s: 1, front: true }, { cols: cols[0], s: -1, front: true }, { cols: [...cols[1], ...cols[1].slice(0, -1).reverse().map((a) => 360 - a)], s: 1 }];
  for (const sg of segs) {
    const az = sg.s > 0 ? sg.cols : sg.cols.slice().reverse().map((a) => -a);
    const rTop = r0n + Cd.c, rFoot = () => rTop + Cd.spread;
    const surfY = (a, at = rFoot()) => {
      let y = -Infinity;
      for (const p of trunk) {
        if (p[1] < -1.6) continue;
        const r = Math.hypot(p[0], p[2] - nz), d = Math.abs(((Math.atan2(p[0], p[2] - nz) * 180 / Math.PI - a + 540) % 360) - 180);
        if (d < 14 && Math.abs(r - at) < 0.1) y = Math.max(y, p[1]);
      }
      return y;
    };
    const P = (a, y, dr, f = 1, yb = y) => { const t = a * Math.PI / 180, rr = rFoot(a, yb) + (rTop - rFoot(a, yb)) * f + dr; return [Math.sin(t) * rr, y, nz + Math.cos(t) * rr]; };
    const wrap = (a) => ((a + 540) % 360) - 180;
    const surfMax = (a) => Math.max(surfY(a), surfY(a, (rFoot() + rTop) / 2), surfY(a, rTop + Cd.flare));
    const yb = az.map((a) => Math.min(hAt(Cd.top, wrap(a)) - 0.16, Math.max(hAt(Cd.base, wrap(a)), surfMax(a) - Cd.sink))), yt = az.map((a) => hAt(Cd.top, wrap(a)));
    const fr = (k, y) => (y - yb[k]) / (yt[k] - yb[k]);
    const outer = [az.map((a, k) => P(a, yb[k], 0, 0, yb[k])), az.map((a, k) => P(a, yt[k] - Cd.trim, Cd.flare * 0.8, fr(k, yt[k] - Cd.trim), yb[k])), az.map((a, k) => P(a, yt[k], Cd.flare, 1, yb[k]))];
    const yIn = az.map((a, k) => (Cd.lipIn ? Math.max(yb[k] + 0.06, yt[k] - Cd.lipIn) : Math.min(yt[k] - 0.08, Math.max(yb[k] + 0.1, surfY(a, rTop - Cd.wall) + 0.04))));
    const inner = [az.map((a, k) => P(a, yt[k], Cd.flare - Cd.wall, 1, yb[k])), az.map((a, k) => P(a, yIn[k], -Cd.wall, fr(k, yIn[k]), yb[k]))];
    const cw = sg.front ? { spine_03: 1 - Cd.shrug, [`clavicle_${sg.s > 0 ? 'l' : 'r'}`]: Cd.shrug } : { spine_03: 1 };
    const V = (p) => { const i = G.vert(p, 'collar'); G.wt[i] = cw; return i; };
    const io = outer.map((row) => row.map(V)), ii = inner.map((row) => row.map(V));
    const rowsAll = [...io, ...ii], mats = ['scale', 'gold', 'gold', 'under'];
    G.tag = 'collar';
    const start = G.polys.length;
    for (let r = 0; r + 1 < rowsAll.length; r++) for (let k = 0; k + 1 < az.length; k++) G.poly([rowsAll[r][k], rowsAll[r][k + 1], rowsAll[r + 1][k + 1], rowsAll[r + 1][k]], mats[r], 'collar');
    for (const k of [0, az.length - 1]) G.poly(rowsAll.map((row) => row[k]), 'gold', 'collar');
    piece(G, start, (c) => [c[0], 0, c[2] - nz]);
    for (let k = start; k < G.polys.length; k++) G.polys[k].piece = sg.front ? (sg.s > 0 ? 'collar.l' : 'collar.r') : 'collar.back';
  }
}

/* ---- the arm (built on the left, mirrored) ----------------------------------------------------------------------------- */
function armPieces(G, rig, D, S, SC) {
  const { B } = rig, rim = D.rim;
  const { armS, up, fo, upper, fore } = armCharts(rig, S);
  const outOf = (fr) => (p) => { const d = sub(p, fr.o), t = dot(d, fr.a); return sub(d, mul(fr.a, t)); };
  const sc = { lift: SC.lift.map((x) => x * 0.85), ridge: SC.ridge * 0.8, thick: SC.thick * 0.85 };
  const Pd = D.pauldron;
  const { centre, pole, dirAt, reach, near, outSign, phiMax } = pauldronFrame(rig, D, S);
  const psiN = Pd.hull ? Pd.hull.psi.length : Pd.cols, psis = Pd.hull ? Pd.hull.psi : Array.from({ length: psiN }, (_, k) => (k * 360) / psiN);
  // the shoulder cap: the plate chest's pauldron dome
  let capRows;
  if (Pd.hull) {
    const H = Pd.hull;
    capRows = H.f.map((f, r) => H.psi.map((psi, k) => {
      const phi = Pd.phi0 + (H.phi[k] - Pd.phi0) * f, d = dirAt(psi * outSign, phi);
      const r0 = reach(d), cMax = Pd.cap ? Pd.cap.rest + (Pd.cap.out - Pd.cap.rest) * Math.max(0, Math.sin(psi * Math.PI / 180)) ** 2 : Infinity;
      return add(centre, mul(d, Math.max(Math.min(H.r[r][k], r0 + cMax), r0 + D.fit.arm + 0.02)));
    }));
    for (let it = 0; it < 3; it++) {
      const rr = capRows.map((row) => row.map((p) => Math.hypot(...sub(p, centre))));
      capRows = capRows.map((row, r) => row.map((p, k) => {
        const n = row.length, m = (rr[r][(k + n - 1) % n] + 2 * rr[r][k] + rr[r][(k + 1) % n] + rr[Math.max(0, r - 1)][k] + rr[Math.min(rr.length - 1, r + 1)][k]) / 6;
        return add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[r][k])));
      }));
    }
  } else {
    capRows = Pd.rows.map((f, r) => psis.map((psi) => {
      const ps = psi * outSign, phi = Pd.phi0 + (phiMax(psi) - Pd.phi0) * f, d = dirAt(ps, phi);
      const out = Math.max(0, Math.sin(psi * Math.PI / 180)), k = Pd.inner + (1 - Pd.inner) * out;
      return add(centre, mul(d, reach(d) + Pd.c[r] * k));
    }));
    const far = Math.max(...capRows.flat().map((p) => Math.hypot(...sub(p, centre))));
    capRows.forEach((row) => row.forEach((p, k) => { const l = Math.hypot(...sub(p, centre)); row[k] = add(centre, mul(sub(p, centre), (l + (far - l) * Pd.round) / l)); }));
    for (const row of capRows) {
      const rr = row.map((p) => Math.hypot(...sub(p, centre)));
      row.forEach((p, k) => { const m = (rr[(k + psiN - 1) % psiN] + 2 * rr[k] + rr[(k + 1) % psiN]) / 4; row[k] = add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[k] * 0.97))); });
    }
  }
  const gap = rim.t + D.fit.gap, lay = (p0) => surfOf(G, p0);
  // the under-layer: a padded sleeve of the arm's own rings, pushed out (skinned as those rings), from the torso's ring
  // over the armpit to the forearm inside the bracer
  const VN = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) VN[i] = add(VN[i], n); }
  const ringPts = (nm) => (nm === '$torso' ? TORSO_RING.map((n) => B.index.get(`${n}.L`)) : Array.from({ length: 8 }, (_, k) => B.index.get(`arm/${nm}${k}.L`)));
  const rings = D.sleeve.rings.map(([nm, c]) => ringPts(nm).map((i) => { const v = G.vert(add(B.verts[i], mul(unit(VN[i]), c)), 'sleeve'); G.wt[v] = { $body: i }; return v; }));
  G.tag = 'sleeve';
  const sStart = G.polys.length;
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < 8; k++) G.poly([rings[r][k], rings[r][(k + 1) % 8], rings[r + 1][(k + 1) % 8], rings[r + 1][k]], 'under', 'sleeve');
  piece(G, sStart, (c) => { const lines = [up, fo].map((fr) => { const d = sub(c, fr.o), t = Math.max(0, Math.min(fr.len, dot(d, fr.a))); return sub(d, mul(fr.a, t)); }); return Math.hypot(...lines[0]) < Math.hypot(...lines[1]) ? lines[0] : lines[1]; });
  const sleeveS = lay(sStart);
  // the bracer (the forearm): the plate chest's vambrace in leather, its foot edged at the wrist
  const Vb = D.vambrace, vTh = Array.from({ length: Vb.cols }, (_, k) => (k * 360) / Vb.cols + (Vb.ridge ? 0 : 360 / Vb.cols / 2));
  const vR = (a) => (Vb.ridge ?? 0) * 0.5 * Math.max(0, Math.cos(((a - 90) * Math.PI) / 180)) ** 4;
  const tTop = (a) => { const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Vb.top; return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s); };
  const vRows = [
    vTh.map((a) => fore.at(tTop(a), a, Vb.c[0] + Vb.flare + vR(a))),
    vTh.map((a) => fore.at(Vb.mid, a, Vb.c[1] + vR(a))),
    vTh.map((a) => fore.at(Vb.bottom, a, Vb.c[2] + vR(a) * 0.6)),
  ];
  const vam = plateOf(G, vRows, { tag: 'bracer', bone: { lowerarm_l: 0.5, lowerarm_twist_01_l: 0.5 }, rim, out: outOf(fo), ring: true, fit: { S: [[armS, D.fit.arm], [sleeveS, gap]] }, border: { bottom: 'trim' }, mat: (r, c) => (Math.cos(vTh[c] * Math.PI / 180) < -0.3 && Math.sin(vTh[c] * Math.PI / 180) < 0.3 ? 'under' : 'leather') });
  // its diamond on the outside (glowing, in a gold frame) and an engraved line down from it
  {
    const cOut = vTh.reduce((best, a, k) => (Math.sin(a * Math.PI / 180) > Math.sin(vTh[best] * Math.PI / 180) ? k : best), 0);
    const cD = Vb.ridge ? cOut : cOut + 0.5, h = gridAt(vam, 1.3, cD);
    const along = unit(fo.a), n = h.n, x = unit(cross(n, along)), r = Vb.diamond.r;
    const V = (q) => { const i = G.vert(q, 'diamond'); G.wt[i] = vam.wt; return i; };
    const c0 = add(h.q, mul(n, 0.015));
    const outer = [mul(along, -r * 1.5), mul(x, r), mul(along, r * 1.5), mul(x, -r)].map((d) => V(add(c0, d)));
    const innerP = [mul(along, -r * 0.9), mul(x, r * 0.55), mul(along, r * 0.9), mul(x, -r * 0.55)].map((d) => V(add(add(c0, d), mul(n, 0.035))));
    G.tag = 'diamond';
    for (let k = 0; k < 4; k++) G.poly([outer[k], outer[(k + 1) % 4], innerP[(k + 1) % 4], innerP[k]], 'gold', 'diamond', true);
    G.poly(innerP, 'core', 'diamond', true);
    inlayOn(G, vam, [0.2, 0.85].map((rf) => gridAt(vam, rf, cD)), 0.035, 'bracer inlay', 'rune', 0.022);
  }
  // the scale sleeve: two rings round the upper arm, open toward the body, the upper over the lower's top
  const underArm = [[armS, D.fit.arm], [sleeveS, gap]];
  const armCast = (u, v) => [add(up.o, mul(up.a, u)), unit(add(mul(up.e1, Math.cos(rad(v))), mul(up.e2, Math.sin(rad(v)))))];
  for (const [li, Sl] of [...SC.sleeve.entries()].reverse()) {
    const cols = 6, ths = Array.from({ length: cols }, (_, k) => Sl.th[0] + ((Sl.th[1] - Sl.th[0]) * k) / (cols - 1));
    const p0 = G.polys.length;
    const rows = [0, 1].map((f) => ths.map((a) => upper.at(Sl.t[0] + (Sl.t[1] - Sl.t[0]) * f, a, Sl.c[f])));
    plateOf(G, rows, { tag: `sleeve ${li + 1}`, bone: Sl.bone, rim, out: outOf(up), fit: { S: underArm }, border: { top: 'open', bottom: li === 0 ? 'edge' : 'trim', left: 'edge', right: 'edge' }, mat: 'under', edgeMat: 'leather' });
    const r = Math.hypot(...outOf(up)(rows[1][2]));
    const { us, h } = coursesOf(Sl.t[0] + (li === 0 ? 0.02 : 0.08), Sl.t[1] + SC.arm.course * 0.15, SC.arm.course);
    scalesOn(G, { tris: polyTris(G, p0) }, { ...sc, h, us, v: [Sl.th[0] + 6, Sl.th[1] - 6], w: SC.arm.w, cast: armCast, out: outOf(up), wt: Sl.bone, tag: `sleeve ${li + 1} scales` });
    underArm.push([lay(p0), gap]);
  }
  // the cap over the sleeve's top and the front and back, its crown scale-plate, scaled below
  const trunkSurf = surfOf(G, G.trunkStart, G.trunkEnd).filter((p) => p[0] > 0);
  const capFit = [[near, D.fit.arm], [trunkSurf, gap], ...underArm.slice(2)];
  if (Pd.cap) {
    const before = capRows.map((row) => row.map((p) => p.slice()));
    fitOut(capRows, true, (p) => sub(p, centre), capFit, 0);
    const r0 = before.map((row) => row.map((p) => Math.hypot(...sub(p, centre))));
    const rr = capRows.map((row, r) => row.map((p, k) => Math.min(Math.hypot(...sub(p, centre)), r0[r][k] + Pd.cap.push)));
    capRows = capRows.map((row, r) => row.map((p, k) => { const n = row.length, m = (rr[r][(k + n - 1) % n] + 2 * rr[r][k] + rr[r][(k + 1) % n]) / 4; return add(centre, mul(unit(sub(p, centre)), Math.max(m, r0[r][k]))); }));
  }
  const cq0 = G.polys.length;
  plateOf(G, capRows, { tag: 'cap', bone: { shoulder_l: 1 }, rim, out: (p) => sub(p, centre), ring: true, fit: Pd.cap ? null : { S: capFit }, border: { top: 'open', bottom: 'edge' }, mat: (r) => (r === 0 ? 'scale' : 'under'), edgeMat: 'leather' });
  // (its crown closed by a low cone to a point up the pole: a faceted boss)
  {
    const ids = capRows[0].map((p) => G.verts.findIndex((q) => q === p)), mid = mul(capRows[0].reduce((a, p) => add(a, p), [0, 0, 0]), 1 / capRows[0].length);
    const apex = G.vert(add(mid, mul(pole, 0.07)), 'cap'); G.wt[apex] = { shoulder_l: 1 };
    G.tag = 'cap';
    const c0 = G.polys.length;
    ids.forEach((a, k) => G.poly([a, ids[(k + 1) % ids.length], apex], 'scale', 'cap'));
    piece(G, c0, (p) => sub(p, centre));
  }
  // (its scales in courses round the pole, from below the crown down past its foot)
  const capFoot = Math.max(...psis.map((psi) => (Pd.hull ? Pd.hull.phi[psis.indexOf(psi)] : phiMax(psi))));
  const { us, h } = coursesOf(SC.capFrom, capFoot + 4, SC.capCourse);
  scalesOn(G, { tris: polyTris(G, cq0) }, { lift: sc.lift, ridge: sc.ridge, thick: sc.thick, h, us, ring: true, n: SC.capN, cast: (u, v) => [centre, dirAt(v * outSign, u)], out: (p) => sub(p, centre), wt: { shoulder_l: 1 }, tag: 'cap scales' });
}

/* ---- the whole piece ---------------------------------------------------------------------------------------------------- */
const mirrorName = (n) => n.replace(/_l$/, '_r');
export function buildScaleChest(rig, design = designOf(rig.who), SC = SCALE[rig.who]) {
  const D = design, { B } = rig;
  const G = meshOf();
  G.wt = [];
  G.plates = [];
  const S = bodySamples(B);
  torsoPieces(G, rig, D, S, SC);
  const v0 = G.verts.length, p0 = G.polys.length;
  armPieces(G, rig, D, S, SC);
  const v1 = G.verts.length, p1 = G.polys.length, map = new Map();
  for (let i = v0; i < v1; i++) {
    const p = G.verts[i], j = G.vert([-p[0], p[1], p[2]], G.part[i]);
    const w = G.wt[i];
    G.wt[j] = w.$body !== undefined ? { $body: B.index.get(B.names[w.$body].replace(/\.L$/, '.R')) } : Object.fromEntries(Object.entries(w).map(([b, x]) => [mirrorName(b), x]));
    map.set(i, j);
  }
  for (let k = p0; k < p1; k++) { const p = G.polys[k]; G.polys.push({ ...p, v: p.v.map((i) => map.get(i)).reverse() }); }
  // (the front and the back, their scales: following the skin under them over the clavicles, as the plate chest's;
  // and the trunk's skin they leave bare under the cuirass's leather, platechest.mjs followSkin and underTrunk)
  const TRUNK = new Set(['front', 'back', 'front scales', 'back scales']);
  followSkin(rig, G, (i) => TRUNK.has(G.part[i]) && G.wt[i].spine_03 === 1, D.follow);
  const under = D.under ? underTrunk(rig, G, { ...D.under, mat: 'leather' }) : [];
  G.side = G.verts.map((p) => (p[0] >= 0 ? 'L' : 'R'));
  G.tris = trisOf(G);
  G.design = D;
  G.hides = [...new Set([...hiddenPolys(rig, G), ...under])].sort((a, b) => a - b);
  return G;
}

/**
 * The body's polygons the cuirass covers whole: a body vertex is covered when a ray out along its normal meets the
 * garment within `reach`; the arm and the shoulder's joint above the forearm's top ring are all under the padded
 * sleeve. The hands are bare.
 */
export function hiddenPolys(rig, G, { reach = 0.75 } = {}) {
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
  const faY = Math.min(...Array.from({ length: 8 }, (_, k) => B.verts[B.index.get(`arm/fa${k}.L`)][1]));
  const cov = B.verts.map((p, i) => {
    if ((B.part[i] === 'arm' || B.part[i] === 'joint') && p[1] > faY) return true;
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
    const rig = buildRig(who), G = buildScaleChest(rig);
    G.vw = plateChestWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowscalechest-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/scalechest.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${G.polys.length} polygons, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
