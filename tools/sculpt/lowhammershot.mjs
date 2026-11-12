// The warhammer (tools/sculpt/gear/warhammer.mjs) looked over, as tools/sculpt/lowpickshot.mjs looks over the pickaxe:
// the sheet's orthographic views beside the sheet (plain and enchanted), its close-ups, a turnaround, its facets and
// wire, the fists on its grip, and both bodies swinging it through the overhead swing (src/sculpt/anim/clips/swing.ts,
// the clip the game plays for a fight with a two-handed weapon), measured.
//
//   node tools/sculpt/lowhammershot.mjs --out <dir> [--only block,sheet,details,turn,wire,held,swing,metrics,gif]
//     block: stood beside the man and the woman at the game's scale, the long sword and the pickaxe beside it;
//     sheet: the sheet's front (0°), side (90°), back (180°) and side (270°) views at the sheet's own scale on its
//       ground, plain and enchanted (sheet-views.png), and the masks of each for the outlines' measure;
//       tools/sculpt/lowhammersheet.py sets the sheet beside them and measures each view's outline against the sheet's;
//     details: the sheet's Key Details close-ups (hub, head plate, hammer face, haft, pommel), plain and enchanted;
//     turn: six angles round it, plain and enchanted;
//     wire: the facets by material, the triangles, a count a material;
//     held: the fists on the grip as the swing closes them, both bodies, close;
//     swing: the swing's key frames, both bodies, three-quarter, side, front and back, him plain and her enchanted;
//     metrics: the head's and the haft's triangles crossing the body's, the grip's crossing the fingers', how deep the
//       hands and the body are in the haft, the head's lowest point off the ground through the clip and at the impact;
//     gif: the whole clip, both bodies, front, three-quarter, side and back (swing-<who>.gif; needs Python's PIL).
//   (HAM_DEBUG=1: each frame the haft crosses the body in, with the body's bones it crosses)
//
// The swing is the game's own: the clip and its player bundled from src/sculpt/anim (clipLocal, each body's skeleton from
// src/sculpt/lowpoly.ts), the warhammer held as the game holds it (a Held of its asset: the hand sockets and their curl,
// the lead and second fists, its scale, its striking ends kept off the ground), drawn on the rig's own skin
// (tools/sculpt/lowrig.mjs) by the review renderer (tools/sculpt/lowgear.mjs shoot).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin, ground, mv, add, sub, mul, dot } from './lowrig.mjs';
import { shoot, closeBrowser, gearDrawable, bodyDrawable, edgesOf, triEdgesOf, gameScale, trisOf } from './lowgear.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildWarhammer, warhammerLength } from './gear/warhammer.mjs';
import { buildPickaxe, pickaxeLength } from './gear/pickaxe.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowhammer'));
mkdirSync(out, { recursive: true });
const only = opt('only', 'block,sheet,details,turn,wire,held,swing,metrics,gif').split(',');
const ROOT = new URL('../..', import.meta.url).pathname;
const PY = process.env.PYTHON ?? 'python3';
const SHEET_L = 269;

const L = await warhammerLength();
const plain = buildWarhammer({ length: L }), lit = buildWarhammer({ length: L, enchanted: true });
const count = {}; for (const t of trisOf(plain.G)) { const m = plain.G.F[t.face].mat; count[m] = (count[m] ?? 0) + 1; }
const GLOWMATS = ['rune', 'core', 'star', 'gem'];
const glowParts = GLOWMATS.reduce((n, m) => n + (count[m] ?? 0), 0);
console.log(`warhammer: ${L.toFixed(4)} game units; ${plain.tris} triangles (the lit parts ${glowParts}: ${GLOWMATS.map((m) => `${m} ${count[m] ?? 0}`).join(', ')}); enchanted ${lit.all} with ${lit.all - plain.tris} of glow`);
const BG = [0.51, 0.6, 0.533], SHEET_BG = [39 / 255, 21 / 255, 19 / 255];
const rigs = { male: buildRig('male'), female: buildRig('female') };
const sc = { male: await gameScale(rigs.male), female: await gameScale(rigs.female) };
const hamD = (p, P = p.G.V) => gearDrawable(p.G, P, p.MATS);
const toGame = (who, P) => P.map((q) => [q[0] * sc[who].scale, (q[1] - rigs[who].J.floor) * sc[who].scale, q[2] * sc[who].scale]);
const stats = { length: L, ofHeight: { male: L / sc.male.height, female: L / sc.female.height }, tris: plain.tris, trisByMat: count, litParts: glowParts, glowTris: lit.all - plain.tris, enchantedAll: lit.all };

/* ---- block: against both bodies, the long sword and the pickaxe -------------------------------------------------- */
if (only.includes('block')) {
  const restM = skin(rigs.male, posed(rigs.male, {})), restF = skin(rigs.female, posed(rigs.female, {}));
  const SW = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/long_sword.json'), 'utf8'));
  const swV = []; for (let i = 0; i < SW.verts.length; i += 3) swV.push([SW.verts[i] + 12, SW.verts[i + 1], SW.verts[i + 2]]);
  const swT = []; for (let t = 0; t < SW.tris.length; t += 4) if (SW.tris[t + 3] < SW.glowFrom) swT.push({ v: [SW.tris[t], SW.tris[t + 1], SW.tris[t + 2]] });
  const { drawable } = await import('./lowgear.mjs');
  const swD = drawable(swV, swT, () => [0.8, 0.8, 0.82], () => 0);
  const pk = buildPickaxe({ length: await pickaxeLength() });
  const items = [
    bodyDrawable(rigs.male, toGame('male', restM).map((p) => [p[0] - 7, p[1], p[2]])),
    bodyDrawable(rigs.female, toGame('female', restF).map((p) => [p[0] + 6, p[1], p[2]])),
    hamD(plain, plain.G.V.map((p) => [p[0], p[1], p[2]])),
    swD,
    gearDrawable(pk.G, pk.G.V.map((p) => [p[0] + 17, p[1], p[2]]), pk.MATS),
  ];
  const H = 800, W = 1100, s = H * 0.93 / sc.male.height;
  await shoot(W, H, [{ items, cam: { yaw: 180, pitch: 0, s, c: [2.5, sc.male.height / 2 + 0.3, 0] }, box: [0, 0, W, H], bg: BG, ink: 1, label: `The warhammer ${L.toFixed(2)} game units: ${stats.ofHeight.male.toFixed(2)} of his height (${sc.male.height.toFixed(1)}), ${stats.ofHeight.female.toFixed(2)} of hers; the long sword ${SW.length.toFixed(2)}, the pickaxe ${pk.L.toFixed(2)}` }], `${out}/block.png`);
}

/* ---- sheet: the sheet's views at its scale ------------------------------------------------------------------------- */
// the sheet's views: front (our -z face: yaw 180), side 90° (a face: the sheet's +X face, our -x: yaw -90), back (yaw 0),
// side 270° (yaw 90); a cell 136 x 290 of the sheet's px round the haft's middle (U 134.5), three times over
const SHEET_VIEWS = [{ id: 'front', yaw: 180 }, { id: 'side90', yaw: -90 }, { id: 'back', yaw: 0 }, { id: 'side270', yaw: 90 }];
const F3 = 3, CW = 136 * F3, CH = 290 * F3;
if (only.includes('sheet')) {
  const s = (SHEET_L * F3) / L, c = [0, 134.5 / SHEET_L * L, 0];
  const cells = [];
  [plain, lit].forEach((p, r) => SHEET_VIEWS.forEach((v, i) => cells.push({ items: [hamD(p)], cam: { yaw: v.yaw, pitch: 0, s, c }, box: [i * CW, r * CH, CW, CH], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] })));
  await shoot(4 * CW, 2 * CH, cells, `${out}/sheet-views.png`);
  // each view alone, no ink, for the outlines' measure
  await shoot(4 * CW, CH, SHEET_VIEWS.map((v, i) => ({ items: [hamD(plain)], cam: { yaw: v.yaw, pitch: 0, s, c }, box: [i * CW, 0, CW, CH], bg: SHEET_BG })), `${out}/sheet-masks.png`);
  // the head from above and below (the sheet's top and bottom of the head)
  const hs = 1.42 * F3 * SHEET_L / L, hc = [0, 230.5 / SHEET_L * L, 0];
  await shoot(2 * 180 * F3, 100 * F3, [plain, lit].map((p, i) => ({ items: [hamD(p)], cam: { yaw: 180, pitch: 90, s: hs, c: hc }, box: [i * 180 * F3, 0, 180 * F3, 100 * F3], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] })), `${out}/sheet-top.png`);
}

/* ---- details: the sheet's close-ups (its Key Details panel) ------------------------------------------------------- */
if (only.includes('sheet') || only.includes('details')) {
  const k = L / SHEET_L, at = (X, U, Z = 0) => [-X * k, U * k, -Z * k], cw = 300, ch = 290;
  const D = [
    { cam: { yaw: 180, pitch: 0, roll: 30, s: 4.6 / k, c: at(0, 228) } },
    { cam: { yaw: -128, pitch: 16, roll: -12, s: 3.2 / k, c: at(46, 232) } },
    { cam: { yaw: -112, pitch: -6, roll: 6, s: 3.6 / k, c: at(50, 231) } },
    { cam: { yaw: 196, pitch: 0, roll: -38, s: 5.2 / k, c: at(0, 100) } },
    { cam: { yaw: 196, pitch: 10, roll: -30, s: 5.4 / k, c: at(0, 19) } },
  ];
  await shoot(5 * cw, 2 * ch, [plain, lit].flatMap((p, r) => D.map((d, i) => ({ items: [hamD(p)], cam: d.cam, box: [i * cw, r * ch, cw, ch], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] }))), `${out}/sheet-details.png`);
}

/* ---- turn: six angles ------------------------------------------------------------------------------------------------ */
if (only.includes('turn')) {
  const cw = 380, ch = 500, s = 440 / L, c = [0, L * 0.55, 0], cells = [];
  [plain, lit].forEach((p, r) => [180, 225, 270, 0, 45, 90].forEach((yaw, i) => cells.push({ items: [hamD(p)], cam: { yaw, pitch: 12, s, c }, box: [i * cw, r * ch, cw, ch], bg: r ? [0.2, 0.22, 0.24] : BG, ink: 1, label: `${r ? 'Enchanted' : 'Plain'}, yaw ${yaw}°${yaw === 180 ? ' (the sheet\'s front)' : yaw === 0 ? ' (its back)' : ''}` })));
  await shoot(6 * cw, 2 * ch, cells, `${out}/turnaround.png`);
}

/* ---- wire: facets and triangles ----------------------------------------------------------------------------------- */
if (only.includes('wire')) {
  const note = Object.entries(count).map(([m, n]) => `${m} ${n}`).join('\n');
  const cw = 520, ch = 640, s = 560 / L, ink = [0.15, 0.12, 0.2], c = [0, L * 0.5, 0];
  const headS = 1000 / L, headC = [0, L * 0.86, 0], lowS = 1500 / L, lowC = [0, L * 0.1, 0];
  const cells = [
    { items: [hamD(plain)], cam: { yaw: 180, pitch: 0, s, c }, box: [0, 0, cw, ch], bg: BG, label: `Front: ${plain.tris} triangles`, note, edges: [{ lines: triEdgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [hamD(plain)], cam: { yaw: -90, pitch: 0, s, c }, box: [cw, 0, cw, ch], bg: BG, label: 'Side', edges: [{ lines: triEdgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [hamD(plain)], cam: { yaw: 205, pitch: 18, s: headS, c: headC }, box: [2 * cw, 0, cw, ch / 2], bg: BG, label: 'Head: the faces', edges: [{ lines: edgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [hamD(plain)], cam: { yaw: 205, pitch: 18, s: headS, c: headC }, box: [2 * cw, ch / 2, cw, ch / 2], bg: BG, label: 'Head: flat', ink: 1 },
    { items: [hamD(plain)], cam: { yaw: 150, pitch: 10, s: lowS, c: lowC }, box: [3 * cw, 0, cw / 2, ch], bg: BG, label: 'Pommel', edges: [{ lines: edgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [hamD(plain)], cam: { yaw: 150, pitch: 10, s: lowS, c: lowC }, box: [3.5 * cw, 0, cw / 2, ch], bg: BG, label: 'flat', ink: 1 },
  ];
  await shoot(4 * cw, ch, cells, `${out}/wire.png`);
}

/* ---- the swing: the game's clip and player, in node --------------------------------------------------------------- */
const needSwing = only.some((o) => ['held', 'swing', 'metrics', 'gif'].includes(o));
let AN = null, ASSET = null;
if (needSwing) {
  const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
  const code = (await build({ stdin: { contents: "export { CLIPS } from './src/sculpt/anim';\nexport { clipLocal } from './src/sculpt/anim/player';\nexport { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';", resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
  const f = join(out, `.anim-${process.pid}.mjs`);
  writeFileSync(f, code);
  AN = await import(pathToFileURL(f).href);
  rmSync(f);
  ASSET = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/warhammer.json'), 'utf8'));
}
const BODY = { male: 'man', female: 'woman' };
/** The warhammer held as the game holds a prop in both hands (src/sculpt/anim/skeleton.ts Held), from its asset. */
const heldOf = (who) => ({ sockets: ASSET.sockets[who], lead: ASSET.grip.lead[1], second: secondOn(who), tip: ASSET.length, ends: ASSET.ends, rest: ASSET.rest, scale: ASSET.scale[who] });
/** Where the other fist closes, as src/sculpt/lowpoly.ts secondOn: the grip's second, or a fist's breadth and a tenth below the lead. */
function secondOn(who) {
  const rig = rigs[who], so = ASSET.sockets[who].r, y = [so.R[1], so.R[4], so.R[7]];
  const hand = new Set(['hand_r', 'knuckles_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'fingers_01_r', 'fingers_02_r', 'fingers_mid_r'].map((n) => rig.at.get(n)).filter((i) => i !== undefined));
  let lo = Infinity, hi = -Infinity;
  rig.B.verts.forEach((p, i) => { const w = rig.vw[i].reduce((a, b) => (b[1] > a[1] ? b : a)); if (!hand.has(w[0])) return; const d = dot(sub(p, so.o), y); lo = Math.min(lo, d); hi = Math.max(hi, d); });
  const width = (hi - lo) * ASSET.scale[who] * 1.1;
  return Math.max(ASSET.grip.from ?? 0, Math.min(ASSET.grip.second[1], ASSET.grip.lead[1] - width));
}
// (the enchanted mesh's points: the plain one's, then its glow's)
const HAM = lit.G.V, NPLAIN = plain.G.V.length;
const HELDS = {};
/** One body at clip time t holding the warhammer: its skin P and the warhammer's points Q (mesh units, stood on the ground). */
function swingAt(who, t) {
  const rig = rigs[who], sk = AN.lowSkeleton(BODY[who]), held = (HELDS[who] ??= heldOf(who));
  const r = AN.clipLocal(sk, AN.CLIPS.swing, t, held), pose = { $move: r.move };
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  const frames = posed(rig, pose), P0 = skin(rig, frames), P = ground(rig, P0), dy = P[0][1] - P0[0][1];
  const gg = sk.gripOf(sk.fk(r.local, r.move), held), g = gg[1], lead = ASSET.grip.lead, k = 1 / held.scale;
  const Q = HAM.map((p) => add(add(g.at, mv(g.R, mul(sub(p, lead), k))), [0, dy, 0]));
  return { P, Q, g, l: add(gg[0].at, [0, dy, 0]), at: add(g.at, [0, dy, 0]), held, dy };
}
const KEYS = opt('times', '') ? opt('times').split(',').map((t) => [+t, `t ${t}`]) : [[0.84, 'Wind-up'], [1.1, 'Heave'], [1.34, 'Top'], [1.62, 'Strike'], [1.7, 'Impact'], [1.8, 'Follow-through']];

if (only.includes('held')) {
  const cells = [], cw = 280, ch = 300;
  let col = 0;
  for (const who of ['male', 'female']) for (const [t, lab] of [[1.34, 'top'], [1.7, 'impact']]) {
    const h = swingAt(who, t), p = who === 'female' ? lit : plain, Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
    const mid = mul(add(h.at, h.l), 0.5), loc = (q) => mul(mv(Rt, sub(q, mid)), ASSET.scale[who]);
    const near = (Dd, r) => { const o = []; for (let i = 0; i < Dd.length; i += 33) { let ok = true; for (let kk = 0; kk < 3; kk++) if (Math.hypot(Dd[i + kk * 11], Dd[i + kk * 11 + 1], Dd[i + kk * 11 + 2]) > r) ok = false; if (ok) for (let j = 0; j < 33; j++) o.push(Dd[i + j]); } return o; };
    // (the warhammer from the pommel to the wood's top, whole: the wood is one facet long)
    const low = []; { const Dd = hamD(p, h.Q.map(loc)), Pl = p.G.V; const keep = new Set(); trisOf(p.G).forEach((t, i) => { if (t.v.some((v) => Pl[v][1] / L * SHEET_L < 165)) keep.add(i); }); let i = 0; for (const t of trisOf(p.G)) { if (keep.has(i)) for (let j = 0; j < 33; j++) low.push(Dd[i * 33 + j]); i++; } }
    const items = [near(bodyDrawable(rigs[who], h.P.map(loc)), 1.4), low];
    const name = `${who === 'male' ? 'Him' : 'Her'}, ${lab}`;
    [[0, 0, -90, 'down the haft'], [1, 90, 0, 'from one face'], [2, 180, 0, 'from the emblem\'s side']].forEach(([r, yaw, pitch, v]) => cells.push({ items, cam: { yaw, pitch, s: 90, c: [0, 0, 0] }, box: [col * cw, r * ch, cw, ch], bg: BG, ink: 1, label: `${name}: ${v}` }));
    col++;
  }
  await shoot(col * cw, 3 * ch, cells, `${out}/held-fists.png`);
}

/* ---- the swing's metrics ---------------------------------------------------------------------------------------- */
if (only.includes('metrics') || only.includes('swing')) {
  const A = ASSET, V = HAM;
  const T = []; for (let t = 0; t < A.tris.length; t += 4) if (A.tris[t + 3] < A.glowFrom) T.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]] });
  const U = (i) => V[i][1] / L * SHEET_L;
  // the head (all of it above the upper collar), the grip (the wood), the rest of the haft (the panel, the collars, the pommel)
  const head = T.filter((t) => t.v.every((i) => U(i) > 200));
  const rest = T.filter((t) => !head.includes(t));
  const g0 = A.grip.from / L * SHEET_L - 1, g1 = A.grip.to / L * SHEET_L + 1;
  const grip = rest.filter((t) => t.v.every((i) => U(i) >= g0 && U(i) <= g1)), haft = rest.filter((t) => !grip.includes(t));
  const report = {};
  for (const who of ['male', 'female']) {
    const rig = rigs[who], tris = rig.B.tris.map((t) => ({ v: t.v }));
    const domOf = (i) => rig.bones[rig.vw[i].reduce((a, b) => (b[1] > a[1] ? b : a))[0]].name;
    const handish = (t) => /^(hand|thumb|fingers|knuckles)/.test(domOf(t.v[0]));
    const handT = tris.filter(handish), notHandT = tris.filter((t) => !handish(t));
    const headT = tris.filter((t) => /^(head|neck)/.test(domOf(t.v[0])));
    const fl = rig.J.floor, s = A.scale[who];
    const m = { headX: 0, headXAt: null, headXHead: 0, haftX: 0, haftXAt: null, gripFingersX: 0, handInCm: 0, handInAt: null, bodyInCm: 0, bodyInAt: null, endMin: Infinity, endMinAt: null, lowMin: Infinity, headClearCm: Infinity, headClearAt: null, frames: 0 };
    const isHand = rig.B.verts.map((_, i) => /^(hand|thumb|fingers|knuckles)/.test(domOf(i)));
    const isHead = rig.B.verts.map((_, i) => /^(head|neck)/.test(domOf(i)));
    const HV = [...new Set(head.flatMap((t) => t.v))];
    for (let kk = 0; kk < 100; kk++) {
      const t = (kk / 100) * 2, h = swingAt(who, t);
      const ap = crossPairs(h.Q, head, h.P, tris), bp = crossPairs(h.Q, haft, h.P, notHandT), a = ap.length, b = bp.length, c = crossPairs(h.Q, grip, h.P, handT).length;
      // (the body's bones crossed, by name, at the worst frame)
      const by = (pairs, T2) => { const o = {}; for (const [, j] of pairs) { const n = domOf(T2[j].v[0]); o[n] = (o[n] ?? 0) + 1; } return o; };
      if (a > m.headX) m.headXBones = by(ap, tris);
      if (b > m.haftX) m.haftXBones = by(bp, notHandT);
      const a2 = crossPairs(h.Q, head, h.P, headT).length;
      if (a > m.headX) { m.headX = a; m.headXAt = +t.toFixed(2); }
      m.headXHead = Math.max(m.headXHead, a2);
      if (b > m.haftX) { m.haftX = b; m.haftXAt = +t.toFixed(2); }
      if (b > 0) { m.haftXFrames = (m.haftXFrames ?? 0) + 1; (m.haftXTimes ??= []).push(+t.toFixed(2)); if (process.env.HAM_DEBUG) { const us = bp.map(([i]) => Math.min(...haft[i].v.map(U))); console.log(who, t.toFixed(2), b, JSON.stringify(by(bp, notHandT)), 'U', Math.round(Math.min(...us)), Math.round(Math.max(...us))); } }
      m.gripFingersX = Math.max(m.gripFingersX, c);
      // the warhammer's head off the body's head (nearest points, cm of a 1.8 m man)
      { let best = Infinity; for (const i of HV) for (let j = 0; j < h.P.length; j += 3) if (isHead[j]) best = Math.min(best, Math.hypot(...sub(h.Q[i], h.P[j]))); const cm = best * s * 180 / 16.5; if (cm < m.headClearCm) { m.headClearCm = +cm.toFixed(1); m.headClearAt = +t.toFixed(2); } }
      { const d = sub(h.l, h.at), along = dot(d, h.g.way), off = Math.hypot(...sub(d, mul(h.g.way, along))) * s * 180 / 16.5; if (off > (m.leftOffCm ?? 0)) { m.leftOffCm = +off.toFixed(2); m.leftOffAt = +t.toFixed(2); } }
      const Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
      h.P.forEach((q, i) => {
        const d = plain.haftDepth(add(mul(mv(Rt, sub(q, h.at)), s), A.grip.lead)) * 180 / 16.5;
        if (isHand[i]) { const sd = domOf(i).endsWith('_l') ? 'l' : 'r'; m.handIn = m.handIn ?? { r: 0, l: 0 }; m.handIn[sd] = Math.max(m.handIn[sd], +d.toFixed(2)); if (d > m.handInCm) { m.handInCm = +d.toFixed(2); m.handInAt = +t.toFixed(2); m.handInBone = domOf(i); } }
        else if (d > m.bodyInCm) { m.bodyInCm = +d.toFixed(2); m.bodyInAt = +t.toFixed(2); }
      });
      let li = 0; for (let i = 1; i < NPLAIN; i++) if (h.Q[i][1] < h.Q[li][1]) li = i;
      const low = (h.Q[li][1] - fl) * s;
      if (low < m.endMin) { m.endMin = low; m.endMinAt = +t.toFixed(2); m.endMinAtPx = plain.G.V[li].map((x) => +(x / L * SHEET_L).toFixed(1)); }
      m.frames++;
    }
    {
      const h = swingAt(who, 1.34), Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
      const ext = (side) => { let lo = Infinity, hi2 = -Infinity; h.P.forEach((q, i) => { if (!isHand[i] || !domOf(i).endsWith(`_${side}`)) return; const u = (mv(Rt, sub(q, h.at))[1] * s + A.grip.lead[1]) / L * SHEET_L; lo = Math.min(lo, u); hi2 = Math.max(hi2, u); }); return [+lo.toFixed(1), +hi2.toFixed(1)]; };
      m.fistsU = { right: ext('r'), left: ext('l') };
    }
    {
      const SW = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/long_sword.json'), 'utf8')), sh = AN.lowHeld(BODY[who]), sk = AN.lowSkeleton(BODY[who]);
      let worst = 0, swX = 0;
      // (its hilt out of the hands: the pommel and the guard, crossing the body not the hands, as the haft's measure)
      const SV = []; for (let i = 0; i < SW.verts.length; i += 3) SV.push([SW.verts[i], SW.verts[i + 1], SW.verts[i + 2]]);
      const hilt = []; for (let t = 0; t < SW.tris.length; t += 4) if (SW.tris[t + 3] < SW.glowFrom) { const v = [SW.tris[t], SW.tris[t + 1], SW.tris[t + 2]]; if (v.every((i) => SV[i][1] < SW.grip.from || (SV[i][1] > SW.grip.to && SV[i][1] < SW.grip.to + 1))) hilt.push({ v }); }
      for (let kk = 0; kk < 50; kk++) {
        const t = (kk / 50) * 2, r = AN.clipLocal(sk, AN.CLIPS.swing, t, sh), pose = { $move: r.move };
        r.local.forEach((q, i) => { if (q && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = q; });
        const P = skin(rig, posed(rig, pose)), g = sk.gripOf(sk.fk(r.local, r.move), sh)[1], Rt = [g.R[0], g.R[3], g.R[6], g.R[1], g.R[4], g.R[7], g.R[2], g.R[5], g.R[8]];
        const SQ = SV.map((p) => add(g.at, mv(g.R, mul(sub(p, SW.grip.lead), 1 / sh.scale))));
        swX = Math.max(swX, crossPairs(SQ, hilt, P, notHandT).length);
        P.forEach((q, i) => {
          if (!isHand[i]) return;
          const p = add(mul(mv(Rt, sub(q, g.at)), sh.scale), SW.grip.lead);
          if (p[1] < SW.grip.from || p[1] > SW.grip.to) return;
          const d = (1 - Math.hypot(p[0] / SW.grip.radius, p[2] / (0.8 * SW.grip.radius))) * 0.8 * SW.grip.radius * 180 / 16.5;
          worst = Math.max(worst, d);
        });
      }
      m.swordHandInCm = +worst.toFixed(2); m.swordHiltX = swX;
    }
    const hi = swingAt(who, 1.7 + 1e-4);
    m.lowAtImpact = +((Math.min(...hi.Q.slice(0, NPLAIN).map((q) => q[1])) - fl) * s).toFixed(2);
    m.fistGap = +((A.grip.lead[1] - hi.held.second)).toFixed(3);
    m.endMin = +m.endMin.toFixed(2);
    report[who] = m;
    console.log(`swing ${who}: head x body ≤${m.headX} (at ${m.headXAt}s: ${JSON.stringify(m.headXBones ?? {})}; x the body's head ${m.headXHead}), the head ≥${m.headClearCm} cm off the body's head (at ${m.headClearAt}s); haft x body (not the hands) ≤${m.haftX} (at ${m.haftXAt}s: ${JSON.stringify(m.haftXBones ?? {})}; in ${m.haftXFrames ?? 0} of 100 frames, ${(m.haftXTimes ?? []).join(' ')}), grip x hands ≤${m.gripFingersX}; hands ≤${m.handInCm} cm into the haft (right ${m.handIn.r}, left ${m.handIn.l}; at ${m.handInAt}s, ${m.handInBone}; the long sword's ≤${m.swordHandInCm} cm into its grip, its hilt x body ≤${m.swordHiltX}), body ≤${m.bodyInCm} cm (at ${m.bodyInAt}s); the left fist ≤${m.leftOffCm} cm off the grip's axis (at ${m.leftOffAt}s); lowest point ≥${m.endMin} gu off the ground (at ${m.endMinAt}s, its point ${m.endMinAtPx} sheet px), ${m.lowAtImpact} at the impact; fists ${m.fistGap} gu apart, along the grip (U px): right ${m.fistsU.right}, left ${m.fistsU.left}`);
  }
  stats.swing = report;
}
const VIEWS4 = [[-40, 8, '3/4'], [-90, 4, 'side'], [0, 6, 'front'], [180, 6, 'back']];
if (only.includes('swing')) {
  const cw = 280, ch = 420, cells = [];
  ['male', 'female'].forEach((who, r) => KEYS.forEach(([t, lab], i) => {
    const h = swingAt(who, t), p = who === 'female' ? lit : plain;
    const items = [bodyDrawable(rigs[who], toGame(who, h.P)), hamD(p, toGame(who, h.Q))];
    const s = ch * 0.5 / sc.male.height, c = [0, sc.male.height * 0.62, 1.5];
    VIEWS4.forEach(([yaw, pitch, vl], v) => cells.push({ items, cam: { yaw, pitch, s, c }, box: [i * cw, (r * 4 + v) * ch, cw, ch], bg: BG, ink: 1, label: v === 0 ? `${who === 'male' ? 'Him (plain)' : 'Her (enchanted)'}: ${lab}, t ${t}s` : vl }));
  }));
  await shoot(KEYS.length * cw, 8 * ch, cells, `${out}/swing-keys.png`);
}

if (only.includes('gif')) {
  for (const who of ['male', 'female']) {
    const dir = join(out, `.frames-${who}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const N = 40, cw = 280, ch = 400;
    for (let kk = 0; kk < N; kk++) {
      const t = (kk / N) * 2, h = swingAt(who, t), p = who === 'female' ? lit : plain;
      const items = [bodyDrawable(rigs[who], toGame(who, h.P)), hamD(p, toGame(who, h.Q))];
      const s = ch * 0.5 / sc.male.height, c = [0, sc.male.height * 0.62, 1.5];
      await shoot(4 * cw, ch, VIEWS4.map(([yaw, pitch, vl], i) => ({ items, cam: { yaw, pitch, s, c }, box: [i * cw, 0, cw, ch], bg: BG, ink: 1, label: i === 0 ? `t ${t.toFixed(2)}s ${vl}` : vl })), join(dir, `f-${String(kk).padStart(3, '0')}.png`));
    }
    execFileSync(PY, ['-c', String.raw`
import sys, glob
from PIL import Image, ImageDraw
d, out, t = sys.argv[1], sys.argv[2], sys.argv[3]
fr = []
for f in sorted(glob.glob(d + '/f-*.png')):
  im = Image.open(f).convert('RGB'); o = Image.new('RGB', (im.width, im.height + 18), (47, 41, 43)); o.paste(im, (0, 18))
  ImageDraw.Draw(o).text((4, 3), t, fill=(240, 230, 220)); fr.append(o.quantize(colors=255, method=Image.Quantize.MEDIANCUT))
fr[0].save(out, save_all=True, append_images=fr[1:], duration=50, loop=0)
print('wrote', out)
`, dir, join(out, `swing-${who}.gif`), `The overhead swing: ${who === 'male' ? 'him, plain' : 'her, enchanted'}; three-quarter, side, front, back`], { stdio: 'inherit' });
    rmSync(dir, { recursive: true, force: true });
  }
}

await closeBrowser();
writeFileSync(`${out}/warhammer.json`, JSON.stringify(stats, null, 1));
