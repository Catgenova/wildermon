// The brass set: the clockwork artificer, a gleaming machine-suit of polished brass with copper fittings over an oxblood
// leather coat, built with the plate kit (tools/sculpt/garments/platekit.mjs) and the set's own builders
// (tools/sculpt/garments/kit/brass.mjs: gears, lens ports, gauges, pipes).
//
//   helm    the diving-bell helm: a closed round bell, a copper crest and riveted brow band, two bolted lens ports for
//           the eyes (dark glass with a glint, lit when enchanted), a three-stage telescopic monocle on an arm hinged on
//           a gear at the right temple, a speaking grille, a gauge on the left side, a handwheel valve on the crown, a
//           chimney and two copper air pipes arching behind; under it a bolted corselet flange and neck ring.
//   chest   a brass breastplate cut as a waistcoat (a V over a cream cravat with a gear pin, two points at its foot,
//           copper buttons, a riveted copper hem band), a great window of three meshing gears on dark glass on the left
//           breast, a large pressure gauge on the right (its face lit), copper feed pipes from both to couplings at the
//           straps, a backplate with riveted copper bands; the oxblood leather coat with short fronts and long tails
//           behind, banded in copper and buttoned in brass; copper shoulder cops, brass arm lames, gear couters, banded
//           vambraces each with a piston, studded gauntlet cuffs, fingerless gloves.
//   mantle  the boiler pack: a riveted boiler as wide as the shoulder blades, copper domed and banded, a gear as large
//           as the back on it with the core's amber glass at its hub (lit), cooling fins fanned from its flanks, twin
//           flared stacks diverging to stand above the shoulders, and a copper pipe from each side over the shoulder
//           (a finned radiator on it) down to the breastplate's coupling.
//   legs    dark leather trousers, a brass knee cop riveted in copper, a gear on each knee's outside (its hub lit) driven
//           by a piston on the thigh above and one on the shin below, a riveted brass shin plate.
//   boots   dark leather boots to mid-calf, a brass plate down the front, two buckled straps, a brass instep plate, toe
//           cap and heel counter, a copper gear at the ankle (its hub lit), a row of brass rivets round a thick sole.
//
// Enchanted, five things light and nothing else: the helm's eyes (and the monocle's lens), the chest's gauge face,
// the boiler's core, and the hubs of the knee gears and of the ankle gears.
import { add, sub, mul, cross, len, unit, lerp, clamp, smooth, merge, shell, on } from './metalkit.mjs';
import {
  skinSamples, shareW, boneW, mixOf, mixW, nearSkinW, skinW, wrapAngle, limbWrap, plateOn, patch, solid, tube, band, rowPath, colPath, pathOn, stud,
  studsAlong, domeWrap, along, ellipsoidReach, sweep, smoothWeights, coverHides, roundProfile,
} from './platekit.mjs';
import { PI, TAU, headW, headDome, frameAt, inFrame, torsoMarks, torsoField, TORSO_BONES, gear, port, gauge, pipe, ringIn } from './kit/brass.mjs';

export const BRASS_MATS = {
  // (the brass: a warm, slightly olive yellow, paler and greener than gold; its shade a deep olive brown, its polished
  // rims and strips near white)
  br: { c: '#9e7e30', kind: 3 },
  brM: { c: '#6c5620', kind: 3 },
  brL: { c: '#fff4c8', kind: 3 },
  brS: { c: '#3e300e', kind: 3 },
  brD: { c: '#2a200a', kind: 3 },
  // (copper, the second metal: pipes, banding, rivets, the shoulder cops)
  cu: { c: '#b4643a', kind: 3 },
  cuL: { c: '#f4ab7c', kind: 3 },
  cuS: { c: '#5c2814', kind: 3 },
  // (the glows, lit in the enchantment's colour: the knee and ankle gears' hubs; the lens ports' dark glass and its glint; the
  // boiler's amber core; the chest gauges' faces)
  rune: { c: '#fff0a0', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  lens: { c: '#1b2a30', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  glint: { c: '#ffffff', kind: 3 },
  core: { c: '#9a5216', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  dialLit: { c: '#efe6cc', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the helm's gauge face, unlit; the needles)
  dial: { c: '#efe6cc', kind: 2 },
  crimson: { c: '#a8182e', kind: 0 },
  // (the cravat and its pin's stone)
  silk: { c: '#efe8d6', kind: 0 },
  silkD: { c: '#c8bc9e', kind: 0 },
  ruby: { c: '#b01030', kind: 3 },
  // (the coat's oxblood leather; the trousers', gloves' and boots' dark brown; the trousers' waist under a chest piece)
  ox: { c: '#5c1d1e', kind: 2 },
  leather: { c: '#3e2618', kind: 2 },
  leatherD: { c: '#26160d', kind: 2 },
  leatherW: { c: '#3e2619', kind: 2 },
  sole: { c: '#2a1c12', kind: 2 },
};

const female = (B) => B.who === 'female';
/** (while building: each group's triangles, to keep within the budget; TALLY=1) */
const tally = (label, parts) => { if (process.env.TALLY) console.error(label, parts.reduce((n, P) => n + P.F.reduce((m, f) => m + f.v.length - 2, 0), 0)); return parts; };

/* ---- the helm ----------------------------------------------------------------------------------------------------- */
/**
 * The diving-bell helm: a closed round bell over the whole head, a copper crest from brow to nape and a riveted copper
 * brow band; two bolted lens ports for the eyes (dark glass with a glint, lit), a telescopic monocle on an arm hinged on
 * a gear at the right temple, a speaking grille under them; a gauge on the left; a handwheel valve on the crown; two
 * copper air pipes arching out behind; a chimney behind on the left; a bolted rim. Rigid on the head; under it the
 * corselet (a neck ring and a bolted flange over the shoulders' tops) on the neck and the upper back.
 */
export function brassHelm(B) {
  const A = B.at, fem = female(B), out = [];
  const wH = boneW(B, 'head'), w = () => wH;
  // (a round bell: a sphere about the head's middle down to the jaw, then in over the neck as the skin goes)
  const H = headDome(B, { fit: fem ? 0.18 : 0.2, rows: 36, cols: 48, also: (G) => (d, th) => (G.xw + G.fit + (fem ? 0.14 : 0.18)) * (1 - 0.16 * smooth(1.95, 2.6, th)) }), D = H.D, c = H.c;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // (its foot: under the chin before, over the nape behind)
  const footTh = (ph) => { const f = front(ph); return (fem ? 2.36 : 2.42) + (fem ? 0.16 : 0.2) * smooth(1.2, 2.6, f); };
  const NU = 12, NV = 24;
  const shellG = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => footTh(a) / PI, nu: NU, nv: NV, off: () => 0 });
  // (the field above, its shade toward the foot where the bell turns in from the light)
  out.push(solid(shellG, { sheet: true, w, mat: (i) => (i >= NU - 1 ? 'brS' : i >= NU - 4 ? 'brM' : 'br') }));
  // (a thin polished strip where the dome's curve catches the light)
  for (const fi of [3.2]) out.push(tube(rowPath(shellG, fi, 0, NV, 32, 0.01), { r: 0.018, k: 3, mat: 'brL', w, closed: true }));
  const at = (th, ph, lift = 0) => { const q = D.ta(th / PI, ph); return { p: add(q.p, mul(q.n, lift)), n: q.n }; };
  const along = (th0, th1, ph, n, lift) => [...Array(n + 1).keys()].map((k) => at(th0 + ((th1 - th0) * k) / n, ph, lift));
  // -- the rim: rolled bright, a copper band over it bolted round
  out.push(tube(rowPath(shellG, NU, 0, NV, 24), { r: fem ? 0.05 : 0.06, k: 3, mat: 'brL', w, closed: true }));
  const rimBand = rowPath(shellG, NU - 0.8, 0, NV, 20, 0.01);
  out.push(band(rimBand, { wide: fem ? 0.14 : 0.16, high: 0.03, mat: 'cu', w, closed: true }));
  for (let k = 0; k < 10; k++) { const q = shellG.at(NU - 0.8, ((k + 0.5) / 10) * NV); out.push(stud(add(q.p, mul(q.n, 0.03)), q.n, { r: 0.06, h: 0.05, k: 6, mat: 'brL', w })); }
  // -- the brow band: copper, riveted, round the head over the eyes
  const browT = H.browTh - (fem ? 0.3 : 0.32);
  const brow = [...Array(25).keys()].map((k) => at(browT + 0.05 * smooth(1.2, 2.6, front(-PI + (k / 24) * TAU)), -PI + (k / 24) * TAU, 0.0));
  out.push(band(brow, { wide: fem ? 0.13 : 0.15, high: 0.035, mat: 'cu', w, closed: true }));
  for (let k = 0; k < 12; k++) { const q = brow[2 * k]; out.push(stud(add(q.p, mul(q.n, 0.035)), q.n, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w })); }
  // -- the crest: copper, raised, from the brow over the crown to the nape, a polished line along it
  for (const [ph, th1] of [[0, browT - 0.02], [PI, footTh(PI) - 0.25]]) {
    const path = [...along(0.04, th1, ph, 12, 0.0)];
    out.push(band(path, { wide: fem ? 0.1 : 0.12, high: 0.05, mat: 'cu', w }));
    out.push(tube(path.map((q) => ({ p: add(q.p, mul(q.n, 0.05)), n: q.n })), { r: 0.02, k: 3, mat: 'cuL', w }));
  }
  // (a valve on the crown: a stem and a copper handwheel on it)
  const top = at(0, 0, 0).p, vTop = add(top, [0, fem ? 0.2 : 0.24, 0]);
  out.push(stud(add(top, [0, 0.02, 0]), [0, 1, 0], { r: fem ? 0.13 : 0.15, h: 0.07, k: 8, mat: 'brL', w }));
  out.push(sweep([{ p: top, n: [0, 0, 1] }, { p: vTop, n: [0, 0, 1] }], { closedProfile: true, w, mat: 'brM', profile: roundProfile(0.04, 6) }));
  out.push(gear(vTop, [0, 1, 0], { R: fem ? 0.22 : 0.26, teeth: 8, spokes: 3, thick: 0.035, tooth: 0.001, mat: 'cu', tip: 'cu', edge: 'cuS', hub: 'brL', w, x0: [0, 0, 1] }));
  // -- the eyes: two riveted ports, their glass lit
  const eyeY = fem ? 1.04 : 1.07, eyeX = fem ? 0.37 : 0.4, pR = fem ? 0.29 : 0.33;
  const eyeAt = (sg) => { const d = unit(sub([sg * eyeX, eyeY, H.zf], c)), th = Math.acos(d[1]), ph = Math.atan2(d[0], d[2]); return { th, ph, ...at(th, ph, 0.0) }; };
  const eyes = [1, -1].map(eyeAt);
  for (const e of eyes) out.push(port(add(e.p, mul(e.n, 0.02)), unit(add(e.n, [0, 0, 0.25])), { R: pR, h: 0.15, mat: 'brM', lip: 'brL', edge: 'brS', glass: 'lens', glint: 'glint', rivets: 6, rivet: 'brL', rivetR: 0.07, lipR: 0.05, w, k: 12 }));
  // (the monocle over the right eye: a telescope of three brass rings and a copper one out from the port, its lens lit;
  // held on a hinged arm from the temple)
  const R0 = eyes[1], mo = unit(add(R0.n, [-0.15, 0.05, 0.45])), m0 = add(R0.p, mul(mo, 0.17));
  const segs = [[0, pR * 0.78, 'brM'], [0.24, pR * 0.78, 'brM'], [0.25, pR * 0.64, 'cu'], [0.48, pR * 0.64, 'cu'], [0.49, pR * 0.52, 'br'], [0.7, pR * 0.52, 'br']];
  // (bright rings at each joint of the telescope)
  for (const [d, r] of [[0.0, pR * 0.8], [0.245, pR * 0.8], [0.485, pR * 0.66], [0.7, pR * 0.55]]) out.push(tube(ringIn(frameAt(add(m0, mul(mo, d)), mo), r, 0, 10), { r: 0.03, k: 3, mat: 'brL', w, closed: true }));
  for (let k = 0; k < segs.length; k += 2) {
    const [d0, r, m] = segs[k], d1 = segs[k + 1][0];
    out.push(sweep([{ p: add(m0, mul(mo, d0)), n: [0, 1, 0] }, { p: add(m0, mul(mo, d1)), n: [0, 1, 0] }], { closedProfile: true, w, mat: m, profile: roundProfile(r, 10) }));
  }
  const mF = frameAt(add(m0, mul(mo, 0.71)), mo);
  out.push(solid(patch((u, v) => { const a = v * TAU, r = pR * 0.5 * (1 - u); return { p: inFrame(mF, Math.cos(a) * r, Math.sin(a) * r, 0.03 * Math.sqrt(1 - (1 - u) ** 2)), n: mo }; }, 2, 10, { closed: true }), { sheet: true, w, mat: () => 'lens' }));
  out.push(stud(inFrame(mF, -pR * 0.15, pR * 0.15, 0.03), mo, { r: pR * 0.1, h: 0.02, k: 4, mat: 'glint', w }));
  const temple = at(H.browTh - 0.1, -1.35, 0.03), hingeP = add(temple.p, mul(temple.n, 0.05));
  out.push(gear(hingeP, temple.n, { R: fem ? 0.17 : 0.2, teeth: 10, spokes: 4, thick: 0.04, mat: 'cu', tip: 'cuL', edge: 'cuS', hub: 'brL', w }));
  const armEnd = add(add(m0, mul(mo, 0.36)), [-pR * 0.62, 0, 0]);
  out.push(tube([{ p: hingeP, n: [0, 1, 0] }, { p: add(lerp(hingeP, armEnd, 0.5), mul(temple.n, 0.12)), n: [0, 1, 0] }, { p: armEnd, n: [0, 1, 0] }], { r: 0.04, k: 4, mat: 'brM', w }));
  out.push(stud(armEnd, [-1, 0, 0], { r: 0.06, h: 0.04, k: 5, mat: 'brL', w }));
  // -- the speaking grille under the eyes: a dark oval, copper bars across it
  const gTh = Math.acos(unit(sub([0, fem ? 0.55 : 0.52, H.zf], c))[1]);
  const grille = plateOn(D, { a0: -0.42, a1: 0.42, nu: 3, nv: 8, t0: (a) => (gTh + 0.12 * Math.sqrt(Math.max(0, 1 - (a / 0.42) ** 2))) / PI, t1: (a) => (gTh - 0.12 * Math.sqrt(Math.max(0, 1 - (a / 0.42) ** 2))) / PI, off: () => 0.02 });
  out.push(solid(grille, { sheet: true, w, mat: () => 'brD' }));
  for (const fi of [0.6, 1.5, 2.4]) out.push(tube(rowPath(grille, fi, 0.6, 7.4, 6, 0.03), { r: 0.025, k: 4, mat: 'cu', w }));
  out.push(tube(pathOn(grille, [[0, 0], [0, 8], [3, 8], [3, 0], [0, 0]].flatMap(([i, j], k, L) => (k + 1 < L.length ? [...Array(4).keys()].map((s) => [i + ((L[k + 1][0] - i) * s) / 4, j + ((L[k + 1][1] - j) * s) / 4]) : [[i, j]])), 0.02), { r: 0.03, k: 3, mat: 'brL', w }));
  // -- the gauge on the left side over the ear: a cream dial in a polished bezel
  const gq = at(H.browTh + 0.15, PI / 2 + 0.1, 0.02);
  out.push(gauge(add(gq.p, mul(gq.n, 0.03)), gq.n, { R: fem ? 0.31 : 0.36, face: 'dial', bezel: 'brM', bezel2: 'brL', tick: 'brD', needle: 'crimson', at: 0.9, w, k: 14 }));
  // -- the pipes: two copper pipes from the brow band over the crown and down behind to the nape, standing off it
  for (const sg of [1, -1]) {
    // (out of the crown behind, arching out clear of the bell and back in at the nape)
    const pts = [[0.75, sg * 2.5, 0.0], [0.95, sg * 2.55, 0.28], [1.45, sg * 2.62, 0.42], [1.95, sg * 2.7, 0.3], [footTh(PI) - 0.22, sg * 2.75, 0.0]].map(([th, ph, l]) => at(th, ph, l).p);
    out.push(...pipe(pts, { r: fem ? 0.065 : 0.075, mat: 'cu', coupling: 'brL', w, at: [0.5], steps: 3, k: 6 }));
  }
  // -- the chimney on the crown behind on the left: a stack with a flared cap, dark inside
  const cq = at(0.62, PI - 0.6, 0), cu0 = unit(add(cq.n, [0, 0.8, 0])), cTop = add(cq.p, mul(cu0, fem ? 0.42 : 0.5)), cr = fem ? 0.09 : 0.11;
  out.push(sweep([{ p: add(cq.p, mul(cu0, -0.05)), n: [0, 0, 1] }, { p: cTop, n: [0, 0, 1] }], { closedProfile: true, w, mat: 'br', profile: roundProfile(cr, 8) }));
  out.push(stud(add(cq.p, mul(cu0, 0.02)), cu0, { r: cr * 1.6, h: 0.05, k: 8, mat: 'cu', w }));
  const capF = frameAt(cTop, cu0, [0, 0, 1]);
  out.push(solid(patch((u, v) => { const a = v * TAU, r = cr * (1.0 + 0.6 * u); return { p: inFrame(capF, Math.cos(a) * r, Math.sin(a) * r, 0.1 * u), n: cu0 }; }, 1, 8, { closed: true }), { sheet: true, w, mat: () => 'brL' }));
  out.push(solid(patch((u, v) => { const a = v * TAU, r = cr * 1.5 * (1 - u); return { p: inFrame(capF, Math.cos(a) * r, Math.sin(a) * r, 0.08), n: cu0 }; }, 1, 8, { closed: true }), { sheet: true, w, mat: () => 'brD' }));
  // -- the corselet: a neck ring under the bell and a flange over the shoulders' tops, bolted round, on the torso
  const F = torsoField(B), t = F.tOfY, M = torsoMarks(B), n = A.neck[1];
  const wNeck = mixOf(B, [['neck_01', 0.5], ['spine_03', 0.5]]);
  const Wc = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit, (nm) => ['spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const wF = (p) => mixW([[wNeck, 0.45], [Wc(p), 0.55]]);
  // (the ring: an upright oval round the neck, as wide as the neck and a hand more)
  const nS = skinSamples(B).filter((q) => shareW(B, q.w, 'neck') > 0.8 && Math.abs(q.p[1] - n - 0.15) < 0.12), zN = nS.reduce((a2, q) => a2 + q.p[2], 0) / nS.length;
  const rN = Math.max(...nS.map((q) => Math.hypot(q.p[0], q.p[2] - zN))), rx = rN + (fem ? 0.18 : 0.2), rz = rN * 1.08 + (fem ? 0.18 : 0.2);
  // (its top up inside the bell all round: higher behind, where the bell's foot is higher)
  const footY = (a) => at(footTh(a), a).p[1], ringTop = (a) => Math.max(n + (fem ? 0.4 : 0.45), footY(a) + 0.16);
  const ring = patch((u, v) => { const a = v * TAU, yy = n + 0.05 + u * (ringTop(a) - n - 0.05), fl = 1 + 0.06 * (1 - u); return { p: [Math.sin(a) * rx * fl, yy, zN + Math.cos(a) * rz * fl], n: [Math.sin(a), 0, Math.cos(a)] }; }, 3, 24, { closed: true });
  out.push(solid(ring, { sheet: true, w: () => wNeck, mat: () => 'brM' }));
  out.push(band(rowPath(ring, 1.5, 0, 24, 16, 0.01), { wide: 0.1, high: 0.03, mat: 'cu', w: () => wNeck, closed: true }));
  // (its foot where the body falls away to an oval round the neck: clear of the shoulders, the breastplate and the backplate)
  const rLim = (a) => (fem ? 0.66 : 0.74) * (1 + 0.15 * Math.cos(a) ** 2);
  const fFoot = (a) => { let yy = n - 0.1; for (; yy > M.pit; yy -= 0.02) { const q = F.ta(t(yy), a).p; if (Math.hypot(q[0], q[2] - F.zc(yy)) > rLim(a)) break; } return Math.max(yy, n - 0.75); };
  const FN = 20, flange = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(fFoot(a)), t1: () => t(n - 0.06), nu: 4, nv: FN, maxUp: 0.35, off: (u) => (fem ? 0.16 : 0.18) + 0.08 * (1 - u) });
  out.push(solid(flange, { sheet: true, w: wF, mat: (i) => (i === 0 ? 'brM' : 'br') }));
  out.push(tube(rowPath(flange, 0, 0, FN, 20), { r: fem ? 0.05 : 0.06, k: 3, mat: 'brL', w: wF, closed: true }));
  out.push(band(rowPath(flange, 1.1, 0, FN, 20, 0.01), { wide: 0.12, high: 0.03, mat: 'cu', w: wF, closed: true }));
  out.push(tube(rowPath(flange, 4, 0, FN, 20, 0.01), { r: 0.045, k: 3, mat: 'brL', w: wF, closed: true }));
  for (let k = 0; k < 12; k++) { const q = flange.at(1.1, ((k + 0.5) / 12) * FN); out.push(stud(add(q.p, mul(q.n, 0.03)), q.n, { r: fem ? 0.07 : 0.08, h: 0.07, k: 6, mat: 'brL', w: () => wF(q.p) })); }
  const P = merge(...out);
  coverHides(B, P, 0.5, (pi) => B.A.polys[pi][0].every((i) => B.V[i][1] > M.pit && shareW(B, B.W[i], 'neck', 'torso', 'head') > 0.8));
  // (the head's own polygons inside it left out, and the neck's inside the bell and the ring)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < footTh(ph) + 0.12 || (B.V[i][1] > n - 0.12 && shareW(B, B.W[i], 'neck', 'head') > 0.5); };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}

/* ---- chest & arms --------------------------------------------------------------------------------------------------- */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The coat: oxblood leather over the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function coat(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.waist - 0.4 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.065 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'ox',
  });
}
/** A grid's outline as [row, column] pairs, every `step` along each side (its corners always). */
const outlineOf = (NU, NV, step = 2) => { const L = [], st = (n) => [...Array(Math.ceil(n / step)).keys()].map((k) => Math.min(n, k * step)); for (const j of st(NV)) L.push([0, j]); for (const i of st(NU)) L.push([i, NV]); for (const j of st(NV)) L.push([NU, NV - j]); for (const i of st(NU)) L.push([NU - i, 0]); return L; };
/** A rounded rectangle's edge on a field: its t at angle a, between a0 and a1, `r` in angle and `ry` in t at the corners. */
const roundEdge = (tEdge, a0, a1, ra, rt, sgn) => (a) => {
  const d = Math.min(a - a0, a1 - a), k = clamp(1 - d / ra);
  return tEdge(a) + sgn * rt * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
};
/**
 * The cuirass: a brass breastplate cut as a waistcoat (a deep V at the neck over a cream cravat with a gear pin, two
 * points at its foot, a row of copper buttons down the front), a copper riveted band along its hem; a great round
 * window on the left breast, three gears meshing on dark glass behind a riveted bezel; a large pressure gauge on the
 * right breast, its face lit; copper feed pipes from both up to couplings at the straps, where the boiler pack's pipes
 * come over the shoulders; the backplate with two riveted copper bands down it.
 */
function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, fem = female(B), out = [];
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const side = fem ? 1.0 : 1.05, aV = fem ? 0.42 : 0.46, aS = 0.7, vBot = M.neckF - (fem ? 0.7 : 0.8), yS = M.neckF - (fem ? 0.12 : 0.04);
  const topF = (a) => {
    const ax = Math.abs(a);
    if (ax <= aV) return vBot + (yS - vBot) * (ax / aV) ** 0.9;
    if (ax <= aS) return yS;
    const k = clamp((ax - aS) / (side - aS));
    // (the armhole: down to under the arm in a smooth fall, so no edge of it is drawn long)
    return lerp([0, M.pit - 0.12, 0], [0, yS, 0], 0.5 + 0.5 * Math.cos(PI * k))[1];
  };
  const point = fem ? 0.26 : 0.32;
  const botF = (a) => { const ax = Math.abs(a); return M.waist + 0.02 - point * Math.exp(-(((ax - 0.34) / 0.2) ** 2)) - 0.08 * smooth(0.6, 0, ax) * 0; };
  const chestB = (yy, a) => (fem ? 0.06 : 0.08) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.3)[1]) / 0.8) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const offF = (u, v, tt, a) => 0.15 + chestB(F.yOfT(tt), a) + 0.05 * smooth(0.25, 0, u) + 0.03 * smooth(0.12, 0, u);
  const NU = 10, NV = 24;
  const breast = plateOn(F, { a0: -side, a1: side, t0: (a) => t(botF(a)), t1: (a) => t(topF(a)), nu: NU, nv: NV, off: offF });
  // (the plate darker toward its sides, where it turns from the light)
  out.push(solid(breast, { sheet: true, w: W, mat: (i, j) => (j < 2 || j >= NV - 2 ? 'brM' : 'br') }));
  out.push(tube(rowPath(breast, NU, 0, NV, NV), { r: fem ? 0.045 : 0.05, k: 4, mat: 'brL', w: W }));
  out.push(tube(rowPath(breast, 0, 0, NV, NV), { r: fem ? 0.045 : 0.05, k: 4, mat: 'brL', w: W }));
  // (the copper band along the hem, riveted; the buttons down the front)
  out.push(band(rowPath(breast, 0.9, 0.5, NV - 0.5, NV, 0.01), { wide: 0.12, high: 0.025, mat: 'cu', w: W }));
  out.push(...studsAlong(rowPath(breast, 0.9, 0.5, NV - 0.5, NV, 0.04), 8, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w: W }));
  out.push(tube(colPath(breast, NV / 2, 1.2, NU, NU, 0.005), { r: 0.025, k: 3, mat: 'brS', w: W }));
  for (let k = 0; k < 4; k++) { const fi = 2 + k * ((NU - 3.5 - 2) / 3), q = breast.at(Math.min(fi, NU * (1 - 0.06)), NV / 2 - 0.6); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.06, h: 0.05, k: 6, mat: 'cuL', w: W })); }
  // -- the gear window on the left breast: dark glass behind three brass and copper gears meshing, a riveted copper bezel
  const aW = fem ? 0.5 : 0.52, yW = lerp(A.chest, [0, M.waist, 0], fem ? 0.32 : 0.28)[1], wq = F.ta(t(yW), aW), wn = wq.n;
  const wc = add(wq.p, mul(wn, offF(0.5, 0.5, t(yW), aW) + 0.01)), wF = frameAt(wc, wn), wR = fem ? 0.48 : 0.58;
  out.push(solid(patch((u, v) => { const a = v * TAU, r = wR * (1 - u); return { p: inFrame(wF, Math.cos(a) * r, Math.sin(a) * r, 0.005), n: wn }; }, 1, 16, { closed: true }), { sheet: true, w: W, mat: () => 'brD' }));
  out.push(port(wc, wn, { R: wR * 1.12, h: 0.07, mat: 'cu', lip: 'brL', edge: 'cuS', glass: 'brD', rivets: 8, rivet: 'brL', rivetR: 0.045, lipR: 0.04, w: W, k: 16, dome: -0.05 }));
  for (const [x, yv, R, teeth, m, hub, h] of [[-0.22, 0.12, 0.5, 12, 'brL', 'cu', 0.03], [0.4, -0.3, 0.32, 8, 'cu', 'brL', 0.045], [-0.02, -0.5, 0.24, 6, 'br', 'cuL', 0.04]]) {
    out.push(gear(inFrame(wF, x * wR, yv * wR, h), wn, { R: R * wR, teeth, spokes: teeth > 8 ? 5 : 4, thick: 0.035, tooth: R * wR * 0.2, mat: m, edge: m === 'cu' ? 'cuS' : 'brS', hub, w: W, turn: x * 3 }));
  }
  // -- the gauge on the right breast: a big cream dial in a polished rim, its face lit
  const aG = -(fem ? 0.46 : 0.48), yG = lerp(A.chest, [0, M.waist, 0], fem ? 0.2 : 0.16)[1], gq = F.ta(t(yG), aG), gR = fem ? 0.28 : 0.34;
  const gc = add(gq.p, mul(gq.n, offF(0.5, 0.5, t(yG), aG) + 0.04));
  out.push(gauge(gc, gq.n, { R: gR, face: 'dialLit', bezel: 'brM', bezel2: 'brL', rimR: gR * 0.16, tick: 'brD', needle: 'crimson', at: 0.75, w: W, k: 14 }));
  // -- the feed pipes: copper, from the top of the gauge and of the window up the breast to a coupling at each strap,
  // where the boiler's pipes come over the shoulders
  const couplings = {};
  for (const [sg, from, fn] of [[-1, add(gc, add(mul(gq.n, -0.01), [0, gR * 1.15, 0])), gq.n], [1, add(wc, add(mul(wn, 0.02), [0, wR * 1.18, 0])), wn]]) {
    const ac = sg * 0.62, yc = yS - 0.12, cq = F.ta(t(yc), ac), cp = add(cq.p, mul(cq.n, offF(0.9, 0.5, t(yc), ac) + 0.05));
    const mid = add(lerp(from, cp, 0.5), mul(lerp(fn, cq.n, 0.5), 0.04));
    out.push(...pipe([from, mid, cp], { r: fem ? 0.04 : 0.045, mat: 'cu', coupling: 'brL', w: W, steps: 3, k: 5, cr: fem ? 0.06 : 0.065 }));
    out.push(stud(cp, cq.n, { r: fem ? 0.09 : 0.1, h: 0.06, k: 6, mat: 'brL', w: W }));
    couplings[sg > 0 ? 'l' : 'r'] = { p: cp, n: cq.n };
  }
  // -- the cravat in the V: cream silk bunched under the chin, a gear pin in it
  const cr = plateOn(F, { a0: -aV * 0.85, a1: aV * 0.85, nu: 5, nv: 6, t0: (a) => t(topF(a) - 0.05), t1: () => t(yS + 0.1), off: (u, v) => 0.08 + 0.06 * Math.sin(PI * v) * (0.6 + 0.4 * Math.sin(3 * PI * u)) });
  out.push(solid(cr, { sheet: true, w: W, mat: (i) => (i % 2 ? 'silk' : 'silkD') }));
  const pq = cr.at(2.2, 3);
  out.push(gear(add(pq.p, mul(pq.n, 0.03)), pq.n, { R: fem ? 0.1 : 0.12, teeth: 8, spokes: 3, thick: 0.02, mat: 'brL', edge: 'brM', hub: 'ruby', w: W }));
  // -- the backplate: up to the shoulder blades, two copper bands down it riveted
  const bH = fem ? 0.8 : 0.85, bN = 0.5, topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB - 0.4; if (bx <= bN) return yC; const k = clamp((bx - bN) / (bH - bN)); return lerp([0, M.pit - 0.1, 0], [0, yC, 0], 0.5 + 0.5 * Math.cos(PI * k))[1]; };
  const BV = 20, back = plateOn(F, { a0: PI - bH, a1: PI + bH, t0: () => t(M.waist - 0.02), t1: (a) => t(topB(a)), nu: 10, nv: BV, off: (u) => 0.13 + 0.03 * smooth(0.12, 0, u) });
  out.push(solid(back, { sheet: true, w: W, mat: (i, j) => (j < 3 || j >= BV - 3 ? 'brM' : 'br') }));
  out.push(tube(rowPath(back, 10, 0, BV, BV), { r: 0.05, k: 4, mat: 'brL', w: W }));
  out.push(tube(rowPath(back, 0, 0, BV, BV), { r: 0.05, k: 4, mat: 'brL', w: W }));
  for (const j of [BV / 2 - 3.5, BV / 2 + 3.5]) {
    out.push(band(colPath(back, j, 0.4, 9.6, 8, 0.01), { wide: 0.13, high: 0.025, mat: 'cu', w: W }));
    out.push(...studsAlong(colPath(back, j, 0.8, 9.2, 8, 0.04), 6, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w: W }));
  }
  return { parts: out, W, F, M, breast, back, couplings };
}
/** The coat's skirts: short leather fronts to the hips, long tails behind split down the middle, each hung straight from the waist as cloth falls, piped in brass, a brass button at the back of the waist. Each moves with its thigh. */
function coatSkirts(B, T) {
  const A = B.at, M = T.M, F = T.F, t = F.tOfY, zc = F.zc, fem = female(B), out = [];
  const yTop = M.waist - 0.02;
  // (how far out from the middle line the body reaches at angle a, from height y up to the waist: what hangs there clears)
  const reachDown = (y, a) => { let r = 0; for (let yy = yTop; yy >= y - 1e-6; yy -= 0.08) { const q = F.ta(t(yy), a).p; r = Math.max(r, Math.hypot(q[0], q[2] - zc(yy))); } return r; };
  for (const sg of [1, -1]) for (const back of [false, true]) {
    const s = sg > 0 ? 'l' : 'r', kn = A.knee[s], hp = A.hip[s];
    const lo0 = back ? PI / 2 + 0.2 : 0.14, hi0 = back ? PI - 0.15 : PI / 2 - 0.1;
    const wT = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.15 && along(q.p, hp, kn) < 0.6, (n) => n.endsWith(`_${s}`));
    const wP = boneW(B, 'pelvis');
    const yBot = back ? lerp(hp, kn, fem ? 0.76 : 0.79)[1] : M.hip - (fem ? 0.1 : 0.15);
    // (the tails' outer corners cut back in a curve; the fronts' inner corners cut away)
    const y0 = (v) => (back ? yBot + 0.35 * (v ** 3) : yBot + 0.4 * (1 - v) ** 2);
    const wPan = (p) => { const f = 0.45 + 0.55 * clamp((yTop - p[1]) / (yTop - yBot)); return mixW([[wP, 1 - f], [wT, f]]); };
    const NU = back ? 9 : 5, NV = 5;
    const g = patch((u, v) => {
      const a = sg * (lo0 + (hi0 - lo0) * v), yy = yTop - (yTop - y0(v)) * u, d = [Math.sin(a), 0, Math.cos(a)];
      const r = reachDown(yy, a) + 0.24 + 0.04 * u + 0.05 * Math.exp(-((a / 0.35) ** 2));
      return { p: add([0, yy, zc(yy)], mul(d, r)), n: d };
    }, NU, NV);
    out.push(solid(g, { sheet: true, w: wPan, mat: () => 'ox' }));
    // (its hem banded in copper, its edges piped bright; on the tails a row of three brass buttons down the split)
    out.push(band(rowPath(g, NU - 0.35, 0, NV, NV, 0.005), { wide: 0.1, high: 0.03, mat: 'cu', w: wPan }));
    for (const j of [0, NV]) out.push(tube(colPath(g, j, 0.3, NU, NU, 0.01), { r: 0.035, k: 3, mat: 'brL', w: wPan }));
    if (back) for (const fi of [0.6, NU * 0.4, NU * 0.7]) { const q = g.at(fi, sg > 0 ? NV - 0.8 : 0.8); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.07, h: 0.05, k: 6, mat: 'brL', w: () => wPan(q.p) })); }
  }
  return out;
}
/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/**
 * One arm: a shoulder cop of brass with a copper band, two lames under it down the arm; the gear couter (a toothed brass
 * gear on the elbow's outside over a cup); the vambrace, copper banded, a piston along its outside; the gauntlet's leather
 * cuff studded in brass; the fingerless leather gloves.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], fem = female(B), out = [];
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [-0.1, 1.0], nt: 22, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.5], [`upperarm_${s}`, 0.2], [`clavicle_${s}`, 0.3]]);
  // -- the cop: a dome over the shoulder's ball, rimmed bright, a copper band and rivets round it; two lames below
  const ax = unit([sg * 0.42, 0.91, 0]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.25 && q.p[1] > sh[1] - 0.95;
  const cc = add(sh, [sg * 0.02, -0.12, 0]), near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
  const ex = Math.max(...near.map((v) => v[0] * sg)), ro = ex + (fem ? 0.2 : 0.24), E = [ro * 1.0, ro * 0.62, ro * 0.95];
  const D = domeWrap(B, { c: cc, u: ax, f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 16, cols: 28, thMax: 2.0, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.18, ellipsoidReach(E, d)) });
  const reach = (ph) => { const c = Math.cos(ph), sn = Math.sin(ph); return Math.max(0.55, (Math.abs(c) * 0.95 + Math.max(0, sn) * 0.45 + Math.max(0, -sn) * 1.15) / (Math.abs(c) + Math.abs(sn))); };
  const CV = 16, cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => reach(a) / 2.0, nu: 5, nv: CV, off: (u) => 0.06 * u * u });
  out.push(solid(cop, { sheet: true, w: () => wSh, mat: (i) => (i >= 4 ? 'cuS' : 'cu') }));
  out.push(tube(rowPath(cop, 5, 0, CV, CV), { r: 0.045, k: 4, mat: 'brL', w: () => wSh, closed: true }));
  out.push(band(rowPath(cop, 3.8, 0, CV, CV, 0.01), { wide: 0.1, high: 0.025, mat: 'br', w: () => wSh, closed: true }));
  for (let k = 0; k < 8; k++) { const q = cop.at(3.8, ((k + 0.5) / 8) * CV); out.push(stud(add(q.p, mul(q.n, 0.025)), q.n, { r: 0.04, h: 0.035, k: 4, mat: 'brL', w: () => wSh })); }
  out.push(stud(cop.at(0, 0).p, cop.at(0, 0).n, { r: 0.1, h: 0.07, k: 6, mat: 'brL', w: () => wSh }));
  const wArm = (p) => { const f = smooth(0.15, 0.55, along(p, sh, el)); return mixW([[wSh, 1 - f], [wUp, f]]); };
  for (let k = 0; k < 2; k++) {
    const t0 = 0.32 + 0.11 * k, t1 = t0 + 0.14;
    const g = plateOn(UA, { a0: PI / 2 - 1.7, a1: PI / 2 + 1.7, t0: () => t0, t1: () => t1, nu: 2, nv: 8, off: (u) => 0.14 - 0.02 * k + 0.03 * u });
    out.push(solid(g, { sheet: true, w: wArm, mat: () => 'br' }));
    out.push(tube(rowPath(g, 0, 0, 8, 8), { r: 0.035, k: 3, mat: 'brL', w: wArm }));
  }
  // -- the couter: a cup over the elbow's point, the gear on its outside
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  const c0 = sub(el, mul(upDir, uaLen * 0.22)), c1 = add(el, mul(foreDir, faLen * 0.22));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 1.0, a1: TAU - 1.0, t0: () => 0.05, t1: () => 0.95, nu: 5, nv: 10, off: (u, v) => 0.14 + 0.06 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'br' }));
  out.push(tube(rowPath(cup, 0, 0, 10, 8), { r: 0.035, k: 3, mat: 'brL', w: () => wEl }));
  out.push(tube(rowPath(cup, 5, 0, 10, 8), { r: 0.035, k: 3, mat: 'brL', w: () => wEl }));
  const ec = EL.ta(0.5, PI / 2 + 0.2), eo = unit(add(ec.n, [0, 0, -0.15]));
  out.push(gear(add(ec.p, mul(eo, 0.2)), eo, { R: fem ? 0.22 : 0.26, teeth: 10, spokes: 5, thick: 0.05, mat: 'br', tip: 'brL', edge: 'brS', hub: 'cu', w: () => wEl, x0: upDir }));
  // -- the vambrace: closed round the forearm, copper bands at its ends, a piston along its outside
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.06], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s)), w = () => wFa;
  const VV = 12, vamb = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.2, t1: () => 0.84, nu: 5, nv: VV, off: (u) => 0.09 + 0.03 * Math.sin(PI * u) + 0.04 * u });
  out.push(solid(vamb, { sheet: true, w, mat: (i, j) => (Math.abs(((j + 0.5) / VV) * TAU - PI - PI / 2) < 0.9 ? 'brM' : 'br') }));
  for (const fi of [0, 5]) out.push(tube(rowPath(vamb, fi, 0, VV, VV), { r: 0.035, k: 3, mat: 'brL', w, closed: true }));
  for (const fi of [0.6, 4.4]) out.push(band(rowPath(vamb, fi, 0, VV, VV, 0.005), { wide: 0.1, high: 0.025, mat: 'cu', w, closed: true }));
  const pA = PI / 2 + 0.3, pOff = (tt) => 0.09 + 0.03 * Math.sin(PI * (tt - 0.2) / 0.64) + 0.04 * (tt - 0.2) / 0.64 + 0.1;
  const pAt = (tt) => { const q = FA.ta(tt, pA); return add(q.p, mul(q.n, pOff(tt))); };
  out.push(sweep([{ p: pAt(0.3), n: [0, 1, 0] }, { p: pAt(0.56), n: [0, 1, 0] }], { closedProfile: true, w, mat: 'br', profile: roundProfile(fem ? 0.055 : 0.065, 6) }));
  out.push(sweep([{ p: pAt(0.55), n: [0, 1, 0] }, { p: pAt(0.78), n: [0, 1, 0] }], { closedProfile: true, w, mat: 'brL', profile: roundProfile(0.025, 5) }));
  for (const tt of [0.3, 0.56]) out.push(sweep([{ p: pAt(tt - 0.01), n: [0, 1, 0] }, { p: pAt(tt + 0.01), n: [0, 1, 0] }], { closedProfile: true, w, mat: 'cu', profile: roundProfile(fem ? 0.075 : 0.085, 6) }));
  out.push(stud(pAt(0.79), FA.ta(0.79, pA).n, { r: 0.05, h: 0.04, k: 5, mat: 'cu', w }));
  // -- the gauntlet's cuff: dark leather flared out over the wrist
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.82, t1: () => 0.98, nu: 2, nv: 14, off: (u) => 0.13 + 0.06 * u });
  out.push(solid(cuff, { sheet: true, w: () => wFa, mat: (i) => (i === 0 ? 'leatherD' : 'leather') }));
  out.push(tube(rowPath(cuff, 2, 0, 14, 14), { r: 0.03, k: 3, mat: 'brM', w: () => wFa, closed: true }));
  // (brass studs round the cuff)
  for (let k = 0; k < 6; k++) { const q = cuff.at(1, ((k + 0.5) / 6) * 14); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.035, h: 0.03, k: 4, mat: 'brL', w: () => wFa })); }
  return out;
}
/** The fingerless gloves: dark leather over the hands, the fingers bare from their first joints. */
function gloves(B) {
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => on(B, i, 'hand', 'forearm') > 0.8 && on(B, i, 'hand') > 0.3 && !B.W[i].some(([b, x]) => x > 0.4 && /fingers_0[12]|thumb_0[123]|fingers_mid/.test(B.bones[b].name)),
    off: () => 0.025,
    mat: () => 'leather',
  });
}
export function brassChest(B) {
  const T = cuirass(B);
  return coverHides(B, merge(...tally('coat', [smoothWeights(coat(B), 2, (p) => p[1] < B.at.neck[1] - 0.6)]), ...tally('cuirass', T.parts), ...tally('skirts', coatSkirts(B, T)), ...tally('arm', armOf(B, 'l')), ...armOf(B, 'r'), ...tally('gloves', [gloves(B)])), 0.5);
}

/* ---- the mantle ---------------------------------------------------------------------------------------------------- */
/**
 * The boiler pack: a riveted brass boiler upright between the shoulder blades, copper domed at its ends and banded; on
 * its back a great gear with the core's glass at its hub, lit; cooling fins fanned out from its sides; twin stacks rising
 * from its top behind the shoulders, flared and dark inside; and a copper pipe from each side of it over the shoulder and
 * down the breast, coupled in brass. Rigid on the upper back; the pipes eased onto the collarbones.
 */
export function brassMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, zc = F.zc, fem = female(B), out = [];
  const k = fem ? 0.86 : 1;
  const wB = mixOf(B, [['spine_03', 0.75], ['spine_02', 0.25]]), w = () => wB;
  // -- the boiler: its axis upright behind the back, clear of the backplate and the helm's corselet
  // (as wide as the shoulder blades, from above the waist to the top of the shoulder blades)
  const R = 0.6 * k, y1 = M.neckB - (fem ? 0.32 : 0.35), y0 = M.waist + (fem ? 0.7 : 0.55), ym = (y0 + y1) / 2;
  const backZ = Math.min(...[y0, ym, y1].map((yy) => F.ta(t(yy), PI).p[2]));
  const ax = [0, ym, backZ - 0.3 - R], at = (yy) => [ax[0], yy, ax[2]];
  const ring = (yy, r, kk = 14) => [...Array(kk).keys()].map((j) => { const a = (j / kk) * TAU; return { p: add(at(yy), [Math.sin(a) * r, 0, Math.cos(a) * r]), n: [Math.sin(a), 0, Math.cos(a)] }; });
  out.push(sweep([y0, y1].map((yy) => ({ p: at(yy), n: [0, 0, -1] })), { closedProfile: true, w, mat: 'br', profile: roundProfile(R, 14), caps: false }));
  // (its domed ends, copper)
  for (const [yy, sgn] of [[y1, 1], [y0, -1]]) {
    const dome = patch((u, v) => { const a = v * TAU, th = (PI / 2) * u, r = R * Math.cos(th); return { p: add(at(yy), [Math.sin(a) * r, sgn * R * 0.55 * Math.sin(th), Math.cos(a) * r]), n: [0, sgn, 0] }; }, 3, 14, { closed: true });
    out.push(solid(dome, { sheet: true, w, mat: (i) => (i === 0 ? 'cuS' : 'cu') }));
  }
  // (bands round it, riveted)
  for (const f of [0.08, 0.5, 0.92]) {
    const yy = y0 + (y1 - y0) * f;
    out.push(band(ring(yy, R + 0.005, 16), { wide: 0.1 * k, high: 0.03, mat: f === 0.5 ? 'cu' : 'brM', w, closed: true }));
    if (f !== 0.5) for (let j = 0; j < 8; j++) { const a = ((j + 0.5) / 8) * TAU; out.push(stud(add(at(yy), [Math.sin(a) * (R + 0.035), 0, Math.cos(a) * (R + 0.035)]), [Math.sin(a), 0, Math.cos(a)], { r: 0.035, h: 0.03, k: 4, mat: 'brL', w })); }
  }
  // (a polished seam down its back)
  out.push(tube([y0 + 0.06, y1 - 0.06].map((yy) => ({ p: add(at(yy), [0, 0, -R - 0.01]), n: [0, 0, -1] })), { r: 0.025, k: 3, mat: 'brL', w }));
  // -- the great gear on its back, the core's glass at its hub, lit
  const gc = add(at(ym + 0.05 * k), [0, 0, -R - 0.06]), gR = (fem ? 0.78 : 0.92);
  out.push(gear(gc, [0, 0, -1], { R: gR, teeth: 16, spokes: 6, thick: 0.07, tooth: 0.17 * k, mat: 'br', tip: 'brL', edge: 'brS', hub: 'brM', hubR: gR * 0.42, hubH: 0.01, w, spokeW: 0.12 }));
  out.push(port(add(gc, [0, 0, -0.08]), [0, 0, -1], { R: gR * 0.4, h: 0.1, mat: 'cu', lip: 'brL', edge: 'cuS', glass: 'core', glint: 'glint', rivets: 6, rivet: 'brL', rivetR: 0.045, lipR: 0.04, w, k: 14, dome: 0.06 }));
  // -- the fins: three a side, fanned out from its flanks, thin brass plates rimmed bright
  for (const sg of [1, -1]) for (let f = 0; f < 3; f++) {
    const yy = ym + (f - 1) * 0.36 * k, tilt = (f - 1) * 0.35, base = add(at(yy), [sg * R * 0.95, 0, 0]);
    const out2 = unit([sg, Math.sin(tilt), -0.25]), up2 = unit(cross(out2, [0, 0, 1])), L = 0.4 * k, Hh = 0.26 * k;
    const fin = patch((u, v) => { const x = L * u, h = Hh * (1 - 0.45 * u) * (v - 0.5); return { p: add(add(base, mul(out2, x)), mul(up2, h)), n: [0, 0, -1] }; }, 2, 1);
    out.push(solid(fin, { thick: 0.04, w, mat: () => 'br', inner: 'brM', edge: 'brL' }));
  }
  // -- the stacks: rising from its top behind each shoulder, copper banded, flared and dark at their mouths
  for (const sg of [1, -1]) {
    // (diverging so their mouths stand above the shoulders on either side of the helm, read from before)
    const s0 = add(at(y1 + 0.2 * k), [sg * R * 0.45, 0, -0.1]), s1 = [sg * (fem ? 1.42 : 1.68), (fem ? 0.85 : 1.05), ax[2] - 0.15], sr = 0.13 * k, d = unit(sub(s1, s0));
    out.push(sweep([{ p: add(s0, mul(d, -0.25)), n: [0, 0, -1] }, { p: s1, n: [0, 0, -1] }], { closedProfile: true, w, mat: 'br', profile: roundProfile(sr, 8) }));
    for (const f of [0.15, 0.6]) out.push(sweep([{ p: lerp(s0, s1, f - 0.03), n: [0, 0, -1] }, { p: lerp(s0, s1, f + 0.03), n: [0, 0, -1] }], { closedProfile: true, w, mat: 'cu', profile: roundProfile(sr * 1.3, 8) }));
    const cF = frameAt(s1, d, [0, 0, -1]);
    out.push(solid(patch((u, v) => { const a = v * TAU, r = sr * (1 + 0.8 * u); return { p: inFrame(cF, Math.cos(a) * r, Math.sin(a) * r, 0.14 * u), n: d }; }, 1, 8, { closed: true }), { sheet: true, w, mat: () => 'brL' }));
    out.push(solid(patch((u, v) => { const a = v * TAU, r = sr * 1.7 * (1 - u); return { p: inFrame(cF, Math.cos(a) * r, Math.sin(a) * r, 0.11), n: d }; }, 1, 8, { closed: true }), { sheet: true, w, mat: () => 'brD' }));
  }
  // -- the pipes: from each side of the boiler up over the shoulder (outside the corselet) and down the breast
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.4, (nm) => ['spine_03', 'spine_02', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const surf = (yy, a, off) => { const q = F.ta(t(yy), a); return add(q.p, mul(q.n, off)); };
  const TC = cuirass(B), CP = TC.couplings;
  for (const sg of [1, -1]) {
    const cpl = CP[sg > 0 ? 'l' : 'r'];
    const xs = fem ? 0.98 : 1.18, shTop = Math.max(...skinSamples(B).filter((q) => Math.abs(Math.abs(q.p[0]) - xs) < 0.08 && shareW(B, q.w, 'torso', 'shoulder') > 0.7).map((q) => q.p[1]));
    const zs = mul(skinSamples(B).filter((q) => Math.abs(Math.abs(q.p[0]) - xs) < 0.08 && Math.abs(q.p[1] - shTop) < 0.12).reduce((a2, q) => add(a2, q.p), [0, 0, 0]), 1)[2] / Math.max(1, skinSamples(B).filter((q) => Math.abs(Math.abs(q.p[0]) - xs) < 0.08 && Math.abs(q.p[1] - shTop) < 0.12).length);
    const pts = [
      add(at(y1 - 0.25 * k), [sg * (R + 0.02), 0, 0]),
      add(at(y1 - 0.1), [sg * (R + 0.35), 0, -0.05]),
      [sg * (xs + 0.14), shTop + 0.56, zs - 0.72],
      [sg * xs, shTop + 0.54, zs - 0.18],
      [sg * xs, shTop + 0.5, zs + 0.25],
      surf(M.neckF - 0.05, sg * 0.7, 0.5),
      add(cpl.p, mul(cpl.n, 0.2)),
    ];
    // (on the back the boiler's; over the shoulder the collarbones'; down the breast the breastplate's, so its end stays on its coupling)
    const wP = (p) => { const f1 = smooth(zs - 0.7, zs - 0.2, p[2]), f2 = smooth(zs + 0.1, zs + 0.5, p[2]); return mixW([[wB, 1 - f1], [W(p), f1 * (1 - f2)], [TC.W(p), f1 * f2]]); };
    out.push(...pipe(pts, { r: 0.065 * k, mat: 'cu', coupling: 'brL', w: wP, at: [0.4, 0.75], steps: 4, k: 6 }));
    // (a radiator of brass fins round it over the shoulder: the pack's read from before)
    const rq = lerp(pts[2], pts[3], 0.45), rd = unit(sub(pts[3], pts[2])), rF = frameAt(rq, rd, [0, 1, 0]);
    for (let f = 0; f < 4; f++) {
      const c = add(rq, mul(rd, (f - 1.5) * 0.1)), F2 = { ...rF, o: c }, rr = (fem ? 0.14 : 0.18) * (1 - 0.12 * Math.abs(f - 1.5));
      out.push(solid(patch((u, v) => { const a = v * TAU, r = rr * (0.4 + 0.6 * u); return { p: inFrame(F2, Math.cos(a) * r, Math.sin(a) * r, 0), n: rd }; }, 1, 10, { closed: true }), { thick: 0.025, w: wP, mat: () => (f % 3 ? 'brL' : 'br'), inner: 'brM', edge: 'brL' }));
    }
  }
  return merge(...out);
}

/* ---- legs ------------------------------------------------------------------------------------------------------------ */
/** The trousers: dark leather over the hips and the legs to the ankles, close over the skin, the skin under it left out; its waist (`leatherW`) left out under any chest piece. */
function trousers(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: ({ p }) => 0.05 + 0.02 * smooth(M.hip, M.hip - 1.5, p[1]),
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'leatherW' : 'leather'),
  });
}
/**
 * One leg: a polished brass knee cop riveted in copper; the knee's gear disc on its outside (its hub lit), a piston on
 * the thigh above it and one on the shin below it, each driving a rod to the gear's hub; a riveted brass shin plate
 * down the front of the shin, its edges rolled.
 */
function legOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], fem = female(B), out = [];
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const thPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0.3, 1.0], nt: 10, a: [-PI, PI], closed: true, na: 20, pick: thPick, smooth: 4, shape: (r) => r });
  const cPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 0.7], nt: 12, a: [-PI, PI], closed: true, na: 20, pick: cPick, smooth: 4, shape: (r) => r });
  const wT = skinW(B, (q) => thPick(q) && along(q.p, hp, kn) > 0.3 && along(q.p, hp, kn) < 0.85, legBones);
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.1 && along(q.p, kn, an) < 0.6, legBones);
  // -- the knee cop
  const kPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 20, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`), wk = () => wKn;
  const cop = plateOn(KN, { a0: -1.3, a1: 1.3, t0: () => 0.04, t1: () => 0.96, nu: 6, nv: 10, off: (u, v) => 0.13 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: wk, mat: (i, j) => (j === 0 || j === 9 ? 'brM' : 'br') }));
  out.push(tube(pathOn(cop, outlineOf(6, 10, 2)), { r: 0.035, k: 3, mat: 'brL', w: wk, closed: true }));
  out.push(...studsAlong(rowPath(cop, 3, 0.8, 9.2, 8, 0.03), 4, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w: wk }));
  // -- the knee gear on the outside, its hub lit
  const kc = KN.ta(0.5, 1.3), ko = unit(add(kc.n, [0, 0, 0.1])), gc = add(kc.p, mul(ko, 0.22)), gR = fem ? 0.4 : 0.46;
  out.push(gear(gc, ko, { R: gR, teeth: 12, spokes: 5, thick: 0.06, tooth: gR * 0.2, mat: 'br', tip: 'brL', edge: 'brS', hub: 'rune', hubR: gR * 0.32, hubH: 0.07, w: wk, x0: unit(sub(hp, an)) }));
  // -- the pistons: a cylinder on the thigh's outside above, one on the shin's outside below, a rod from each to the hub
  const pist = (G, tA, tB, wP, off, pa) => {
    const q0 = G.ta(tA, pa), q1 = G.ta(tB, pa), a0 = add(q0.p, mul(q0.n, off)), a1 = add(q1.p, mul(q1.n, off));
    out.push(sweep([{ p: a0, n: [0, 0, 1] }, { p: a1, n: [0, 0, 1] }], { closedProfile: true, w: wP, mat: 'brL', profile: roundProfile(fem ? 0.095 : 0.11, 8) }));
    for (const f of [0.0, 1.0]) out.push(sweep([{ p: lerp(a0, a1, f - 0.07), n: [0, 0, 1] }, { p: lerp(a0, a1, f + 0.07), n: [0, 0, 1] }], { closedProfile: true, w: wP, mat: 'cu', profile: roundProfile(fem ? 0.12 : 0.14, 8) }));
    out.push(sweep([{ p: a1, n: [0, 0, 1] }, { p: lerp(a1, gc, 0.9), n: [0, 0, 1] }], { closedProfile: true, w: wP, mat: 'brD', profile: roundProfile(fem ? 0.04 : 0.045, 5) }));
  };
  pist(TH, 0.38, 0.7, () => wT, 0.2, 0.75);
  pist(SH, 0.5, 0.24, () => wCa, 0.2, 1.45);
  // -- the shin plate: down the front of the shin, rimmed bright, a row of copper rivets down its middle
  const SU = 6, SV = 8, shin = plateOn(SH, { a0: -1.1, a1: 1.1, nu: SU, nv: SV, t0: () => 0.17, t1: () => 0.5, off: (u, v, t, a) => 0.11 + 0.05 * Math.exp(-((a / 0.35) ** 2)) });
  out.push(solid(shin, { sheet: true, w: () => wCa, mat: (i, j) => (j === 0 || j === SV - 1 ? 'brM' : 'br') }));
  out.push(tube(pathOn(shin, outlineOf(SU, SV, 2)), { r: 0.035, k: 3, mat: 'brL', w: () => wCa, closed: true }));
  out.push(...studsAlong(colPath(shin, SV / 2, 0.6, SU - 0.6, 6, 0.04), 4, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w: () => wCa }));
  return out;
}
export function brassLegs(B) {
  return { P: coverHides(B, merge(...tally('trousers', [smoothWeights(trousers(B), 6, (p) => p[1] > B.at.knee.l[1] + 0.6)]), ...tally('leg', legOf(B, 'l')), ...legOf(B, 'r')), 0.5), dropAt: (f) => f.mat === 'leatherW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------------ */
/** The boot's foot: the foot and the ankle, close over the skin, stood on (what the shaft and the plates close onto). */
function bootFoot(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.06 + (n[1] < -0.6 ? 0.16 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leatherD'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
/**
 * One boot: a dark leather shaft to mid-calf over the trousers, a brass plate down its front riveted and rimmed, two
 * buckled straps round it; a brass toe cap and heel counter; the ankle's gear disc on its outside (its hub lit); a
 * thick sole with a row of brass rivets round its edge.
 */
function bootOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s], ball = A.ball[s], fem = female(B), out = [];
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const cPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'calf', 'foot') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0.5, 1.08], nt: 12, a: [-PI, PI], closed: true, na: 20, pick: cPick, smooth: 4, shape: (r) => r });
  const wSh = nearSkinW(B, (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'calf', 'foot') > 0.6, legBones, 0.3);
  const top = 0.56, SV = 14;
  const shOff = (t) => 0.12 + 0.04 * smooth(top + 0.1, top, t);
  const shaft = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 1.06, t1: () => top, nu: 7, nv: SV, off: (u, v, t) => shOff(t) });
  out.push(solid(shaft, { sheet: true, w: wSh, mat: () => 'leatherD' }));
  out.push(tube(rowPath(shaft, 7, 0, SV, SV), { r: 0.045, k: 3, mat: 'brM', w: wSh, closed: true }));
  // (the plate down its front)
  const PU = 5, PV = 6, plate = plateOn(SH, { a0: -0.95, a1: 0.95, nu: PU, nv: PV, t0: () => 0.97, t1: () => top + 0.03, off: (u, v, t) => shOff(t) + 0.04 + 0.03 * Math.sin(PI * v) });
  out.push(solid(plate, { sheet: true, w: wSh, mat: (i, j) => (j === 0 || j === PV - 1 ? 'brM' : 'br') }));
  out.push(tube(pathOn(plate, outlineOf(PU, PV, 1)), { r: 0.03, k: 3, mat: 'brL', w: wSh, closed: true }));
  for (const [i, j] of [[0.6, 0.6], [0.6, PV - 0.6], [PU - 0.6, 0.6], [PU - 0.6, PV - 0.6]]) { const q = plate.at(i, j); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.035, h: 0.03, k: 4, mat: 'cuL', w: () => wSh(q.p) })); }
  // (two straps round it, buckled on the outside)
  for (const tt of [0.68, 0.86]) {
    const ring = [...Array(14).keys()].map((j) => { const a = -PI + (TAU * j) / 14, q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, shOff(tt) + (Math.abs(a) < 0.95 ? 0.09 : 0.03))), n: q.n }; });
    out.push(band(ring, { wide: 0.09, high: 0.025, mat: 'leather', w: wSh, closed: true }));
    const bq = SH.ta(tt, 1.45);
    out.push(stud(add(bq.p, mul(bq.n, shOff(tt) + 0.06)), bq.n, { r: 0.07, h: 0.04, k: 4, mat: 'brL', w: () => wSh(bq.p) }));
  }
  // -- the toe cap: brass over the front of the foot to a round toe, rimmed, a ridge along it
  const fPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick), tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.2, tip[2] + 0.06];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 20, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > 0.86 ? Math.max(0.05, Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.145) ** 2))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  const TU = 6, TV = 10, toe = plateOn(FT, { a0: -1.9, a1: 1.9, t0: () => tBall - 0.1, t1: () => 0.995, nu: TU, nv: TV, off: (u) => 0.05 * (1 - smooth(0.6, 1, u)) + 0.06 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: (i, j) => (j === 0 || j === TV - 1 ? 'brM' : 'br') }));
  out.push(tube(rowPath(toe, 0, 0, TV, TV), { r: 0.04, k: 3, mat: 'brL', w: () => wBall }));
  out.push(tube(colPath(toe, TV / 2, 0.4, TU - 0.3, TU, 0.015), { r: 0.03, k: 3, mat: 'brL', w: () => wBall }));
  // (an instep plate over the foot between the shaft and the cap)
  const inst = plateOn(FT, { a0: -1.6, a1: 1.6, t0: () => 0.18, t1: () => tBall - 0.06, nu: 3, nv: 8, off: (u) => 0.15 + 0.02 * u });
  out.push(solid(inst, { sheet: true, w: () => wFoot, mat: () => 'brM' }));
  out.push(tube(rowPath(inst, 3, 0, 8, 8), { r: 0.035, k: 3, mat: 'brL', w: () => wFoot }));
  // -- the heel counter
  const hPick = (q) => fPick(q) && q.p[2] < an[2] + 0.1 && q.p[1] < an[1] + 0.25;
  const hc = [an[0], an[1] - 0.3, an[2] + 0.1];
  const HD = domeWrap(B, { c: hc, u: [0, -0.2, -1], f: [0, 1, 0], s: [sg, 0, 0], pick: hPick, rows: 8, cols: 16, thMax: 1.5, cone: 0.35, smooth: 3, shape: (r) => r + 0.13 });
  const HU = 3, HV = 14, heel = plateOn(HD, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => 0.42 + 0.08 * Math.max(0, Math.cos(a)), nu: HU, nv: HV, off: () => 0 });
  out.push(solid(heel, { sheet: true, w: () => wFoot, mat: () => 'br' }));
  out.push(tube(rowPath(heel, HU, 0, HV, HV), { r: 0.03, k: 3, mat: 'brL', w: () => wFoot, closed: true }));
  // -- the ankle gear on the outside
  const aq = SH.ta(1.0, PI / 2 + 0.1), ao = aq.n;
  out.push(gear(add(aq.p, mul(ao, shOff(1.0) + 0.06)), ao, { R: fem ? 0.26 : 0.3, teeth: 10, spokes: 4, thick: 0.05, tooth: 0.06, mat: 'cu', tip: 'cuL', edge: 'cuS', hub: 'rune', hubR: fem ? 0.09 : 0.1, hubH: 0.05, w: () => wFoot }));
  // -- the sole's rivets round its edge
  for (let j = 0; j < 5; j++) for (const side of [1, -1]) { const q = FT.ta(0.38 + 0.5 * (j / 4), side * (PI / 2 + 0.7)); out.push(stud(add(q.p, mul(q.n, 0.13)), q.n, { r: 0.045, h: 0.035, k: 4, mat: 'brL', w: () => (0.38 + 0.5 * (j / 4) > tBall ? wBall : wFoot) })); }
  return out;
}
export function brassBoots(B) {
  return coverHides(B, merge(...tally('foot', [bootFoot(B)]), ...tally('boot', bootOf(B, 'l')), ...bootOf(B, 'r')), 0.4);
}

