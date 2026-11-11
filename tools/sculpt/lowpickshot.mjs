// The pickaxe (tools/sculpt/gear/pickaxe.mjs) looked over, as tools/sculpt/lowgearshot.mjs looks over the long sword:
// the sheet's orthographic views beside the sheet (plain and enchanted), its hero three-quarter, a turnaround, its facets
// and wire, the fists on its grip, and both bodies swinging it through the overhead swing (src/sculpt/anim/clips/swing.ts,
// the clip the game plays for mining), measured.
//
//   node tools/sculpt/lowpickshot.mjs --out <dir> [--only block,sheet,turn,wire,held,swing,gif]
//     block: stood beside the man and the woman at the game's scale;
//     sheet: the sheet's front (0°), side (90°) and back (180°) views at the sheet's own scale on its ground, plain and
//       enchanted (sheet-views.png), and its hero three-quarter (sheet-hero.png); tools/sculpt/lowpicksheet.py sets the
//       sheet beside them and measures the front view's outline against the sheet's (IoU, edge distance);
//     turn: six angles round it, plain and enchanted;
//     wire: the facets by material, the triangles, a count a material;
//     held: the fists on the grip as the swing closes them (its sockets' curl), both bodies, close;
//     swing: the swing's key frames (wind-up, top, strike, impact, follow-through), both bodies, three-quarter, side and
//       front, the pickaxe plain on him and enchanted on her; and its metrics: the head's and the haft's triangles crossing
//       the body's, the grip's crossing the fingers', the pick's point off the ground through the clip and at the impact;
//     gif: the whole clip, both bodies, three-quarter and side (swing.gif; needs Python's PIL).
//
// The swing is the game's own: the clip and its player bundled from src/sculpt/anim (clipLocal, each body's skeleton from
// src/sculpt/lowpoly.ts), the pickaxe held as the game holds the long sword (a Held of its asset: the hand sockets and their
// curl, the lead and second fists, its scale; its striking ends kept off the ground), drawn on the rig's own skin
// (tools/sculpt/lowrig.mjs) by the review renderer (tools/sculpt/lowgear.mjs shoot).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin, ground, mv, add, sub, mul, dot } from './lowrig.mjs';
import { shoot, closeBrowser, gearDrawable, bodyDrawable, edgesOf, triEdgesOf, gameScale, trisOf } from './lowgear.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildPickaxe, pickaxeLength } from './gear/pickaxe.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowpick'));
mkdirSync(out, { recursive: true });
const only = opt('only', 'block,sheet,turn,wire,held,swing,gif').split(',');
const ROOT = new URL('../..', import.meta.url).pathname;
const PY = process.env.PYTHON ?? 'python3';

const L = await pickaxeLength();
const plain = buildPickaxe({ length: L }), lit = buildPickaxe({ length: L, enchanted: true });
const count = {}; for (const t of trisOf(plain.G)) { const m = plain.G.F[t.face].mat; count[m] = (count[m] ?? 0) + 1; }
const GLOWMATS = ['rune', 'core', 'star', 'gem', 'panel'];
const glowParts = GLOWMATS.reduce((n, m) => n + (count[m] ?? 0), 0);
console.log(`pickaxe: ${L.toFixed(4)} game units; ${plain.tris} triangles (base ${plain.tris - glowParts}, the lit parts ${glowParts}: ${GLOWMATS.map((m) => `${m} ${count[m] ?? 0}`).join(', ')}); enchanted ${lit.all} with ${lit.all - plain.tris} of glow`);
const BG = [0.51, 0.6, 0.533], SHEET_BG = [39 / 255, 21 / 255, 19 / 255];
const rigs = { male: buildRig('male'), female: buildRig('female') };
const sc = { male: await gameScale(rigs.male), female: await gameScale(rigs.female) };
const pickD = (p, P = p.G.V) => gearDrawable(p.G, P, p.MATS);
const toGame = (who, P) => P.map((q) => [q[0] * sc[who].scale, (q[1] - rigs[who].J.floor) * sc[who].scale, q[2] * sc[who].scale]);
const HEAD = (who) => (rigs[who].J.crown[1] - rigs[who].J.chin[1]) * sc[who].scale;
const stats = { length: L, heads: { male: L / HEAD('male'), female: L / HEAD('female') }, tris: plain.tris, trisByMat: count, litParts: glowParts, glowTris: lit.all - plain.tris, enchantedAll: lit.all };

/* ---- block: against both bodies ------------------------------------------------------------------------------------ */
if (only.includes('block')) {
  const restM = skin(rigs.male, posed(rigs.male, {})), restF = skin(rigs.female, posed(rigs.female, {}));
  const items = [
    bodyDrawable(rigs.male, toGame('male', restM).map((p) => [p[0] - 7, p[1], p[2]])),
    bodyDrawable(rigs.female, toGame('female', restF).map((p) => [p[0] + 7, p[1], p[2]])),
    pickD(plain, plain.G.V.map((p) => [p[0], p[1], p[2]])),
  ];
  const H = 800, W = 1000, s = H * 0.93 / sc.male.height;
  const lines = [-12, L, 0, 12, L, 0];
  await shoot(W, H, [{ items, cam: { yaw: 180, pitch: 0, s, c: [0, sc.male.height / 2 + 0.3, 0] }, box: [0, 0, W, H], bg: BG, ink: 1, label: `The pickaxe ${L.toFixed(2)} game units: ${stats.heads.male.toFixed(2)} of his heads (${sc.male.height.toFixed(1)} tall), ${stats.heads.female.toFixed(2)} of hers`, edges: [{ lines, c: [0.95, 0.9, 0.6], over: true }] }], `${out}/block.png`);
}

/* ---- sheet: the sheet's views at its scale ------------------------------------------------------------------------- */
// the sheet's front view: 240 px from the pommel's foot to the cap's top; its views' yaws in our frame (the sheet's front
// is our -z face; its side view looks at the hammer's face)
const SHEET_VIEWS = [{ id: 'front', yaw: 180 }, { id: 'side', yaw: -90 }, { id: 'back', yaw: 0 }];
// a cell 270 x 273 of the sheet's px round X -34, U 120 (y 223 of the sheet), three times over
const F3 = 3, CW = 270 * F3, CH = 273 * F3, CX = -34;
if (only.includes('sheet')) {
  const s = (240 * F3) / L, c = [0, L / 2, 0], cAt = (yaw) => [yaw === 180 ? -CX / 240 * L : yaw === 0 ? -CX / 240 * L : 0, L / 2, 0];
  const cells = [];
  [plain, lit].forEach((p, r) => SHEET_VIEWS.forEach((v, i) => cells.push({ items: [pickD(p)], cam: { yaw: v.yaw, pitch: 0, s, c: cAt(v.yaw) }, box: [i * CW, r * CH, CW, CH], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] })));
  await shoot(3 * CW, 2 * CH, cells, `${out}/sheet-views.png`);
  // the front alone, no ink, for the outline's measure
  await shoot(CW, CH, [{ items: [pickD(plain)], cam: { yaw: 180, pitch: 0, s, c: cAt(180) }, box: [0, 0, CW, CH], bg: SHEET_BG }], `${out}/sheet-front-mask.png`);
  // and inked as the sheet inks its drawing (a line a sheet px wide round it, three here)
  await shoot(CW, CH, [{ items: [pickD(plain)], cam: { yaw: 180, pitch: 0, s, c: cAt(180) }, box: [0, 0, CW, CH], bg: SHEET_BG, ink: F3, inkc: [200, 200, 200] }], `${out}/sheet-front-inked.png`);
  // the hero: the sheet's three-quarter (its top left panel), the head up and to the right; the camera the best of a grid
  // of yaws, pitches and rolls by the outline's match (lowpicksheet.py's hero IoU)
  const hw = 740, hh = 680;
  await shoot(2 * hw, hh, [plain, lit].map((p, i) => ({ items: [pickD(p)], cam: { yaw: 210, pitch: 25, roll: -32, s: 600 / L, c: [L * 0.02, L * 0.5, 0] }, box: [i * hw, 0, hw, hh], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] })), `${out}/sheet-hero.png`);
}

/* ---- details: the sheet's close-ups (its Key Details panel), enchanted ------------------------------------------------- */
// each a cell of 300 x 290: the hub, the pick's blade, the hammer's face, the shaft's channel, the pommel; at the sheet's
// own px (k: game units a sheet px), its X to our -x
if (only.includes('sheet') || only.includes('details')) {
  const k = L / 240, at = (X, U) => [-X * k, U * k, 0], cw = 300, ch = 290;
  const D = [
    { cam: { yaw: 180, pitch: 0, s: 3.4 / k, c: at(0, 201) } },
    { cam: { yaw: 174, pitch: 14, roll: -10, s: 2.7 / k, c: at(-76, 207) } },
    { cam: { yaw: 240, pitch: 8, s: 4.6 / k, c: at(66, 203) } },
    { cam: { yaw: 180, pitch: 0, roll: -38, s: 4.6 / k, c: at(0, 131) } },
    { cam: { yaw: 196, pitch: 10, roll: -25, s: 5.2 / k, c: at(0, 13) } },
  ];
  await shoot(5 * cw, 2 * ch, [plain, lit].flatMap((p, r) => D.map((d, i) => ({ items: [pickD(p)], cam: d.cam, box: [i * cw, r * ch, cw, ch], bg: SHEET_BG, ink: 1.5, inkc: [20, 10, 9] }))), `${out}/sheet-details.png`);
}

/* ---- turn: six angles ------------------------------------------------------------------------------------------------ */
if (only.includes('turn')) {
  const cw = 380, ch = 460, s = 400 / L, c = [-L * 0.02, L * 0.52, 0], cells = [];
  [plain, lit].forEach((p, r) => [180, 225, 270, 0, 45, 90].forEach((yaw, i) => cells.push({ items: [pickD(p)], cam: { yaw, pitch: 10, s, c }, box: [i * cw, r * ch, cw, ch], bg: r ? [0.2, 0.22, 0.24] : BG, ink: 1, label: `${r ? 'Enchanted' : 'Plain'}, yaw ${yaw}°${yaw === 180 ? ' (the sheet\'s front)' : yaw === 0 ? ' (its back)' : ''}` })));
  await shoot(6 * cw, 2 * ch, cells, `${out}/turnaround.png`);
}

/* ---- wire: facets and triangles ----------------------------------------------------------------------------------- */
if (only.includes('wire')) {
  const note = Object.entries(count).map(([m, n]) => `${m} ${n}`).join('\n');
  const cw = 520, ch = 600, s = 500 / L, ink = [0.15, 0.12, 0.2], c = [0, L * 0.5, 0];
  const headS = 1150 / L, headC = [0, L * 0.84, 0], lowS = 1500 / L, lowC = [0, L * 0.22, 0];
  const cells = [
    { items: [pickD(plain)], cam: { yaw: 180, pitch: 0, s, c }, box: [0, 0, cw, ch], bg: BG, label: `Front: ${plain.tris} triangles`, note, edges: [{ lines: triEdgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [pickD(plain)], cam: { yaw: 0, pitch: 0, s, c }, box: [cw, 0, cw, ch], bg: BG, label: 'Back', edges: [{ lines: triEdgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [pickD(plain)], cam: { yaw: 205, pitch: 18, s: headS, c: headC }, box: [2 * cw, 0, cw, ch / 2], bg: BG, label: 'Head: the faces', edges: [{ lines: edgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [pickD(plain)], cam: { yaw: 205, pitch: 18, s: headS, c: headC }, box: [2 * cw, ch / 2, cw, ch / 2], bg: BG, label: 'Head: flat', ink: 1 },
    { items: [pickD(plain)], cam: { yaw: 150, pitch: 10, s: lowS, c: lowC }, box: [3 * cw, 0, cw / 2, ch], bg: BG, label: 'Grip, pommel', edges: [{ lines: edgesOf(plain.G, plain.G.V), c: ink }] },
    { items: [pickD(plain)], cam: { yaw: 150, pitch: 10, s: lowS, c: lowC }, box: [3.5 * cw, 0, cw / 2, ch], bg: BG, label: 'flat', ink: 1 },
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
  ASSET = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/pickaxe.json'), 'utf8'));
}
const BODY = { male: 'man', female: 'woman' };
/** The pickaxe held as the game holds a prop in both hands (src/sculpt/anim/skeleton.ts Held), from its asset. */
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
const PICK = lit.G.V, NPLAIN = plain.G.V.length;
/** One body at clip time t holding the pickaxe: its skin P and the pickaxe's points Q (mesh units, stood on the ground). */
function swingAt(who, t) {
  const rig = rigs[who], sk = AN.lowSkeleton(BODY[who]), held = (HELDS[who] ??= heldOf(who));
  const r = AN.clipLocal(sk, AN.CLIPS.swing, t, held), pose = { $move: r.move };
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  const frames = posed(rig, pose), P0 = skin(rig, frames), P = ground(rig, P0), dy = P[0][1] - P0[0][1];
  const g = sk.gripOf(sk.fk(r.local, r.move), held)[1], lead = ASSET.grip.lead, k = 1 / held.scale;
  const Q = PICK.map((p) => add(add(g.at, mv(g.R, mul(sub(p, lead), k))), [0, dy, 0]));
  const l = sk.gripOf(sk.fk(r.local, r.move), held)[0];
  return { P, Q, g, l: add(l.at, [0, dy, 0]), at: add(g.at, [0, dy, 0]), held };
}
const HELDS = {};
// (--times t1,t2,...: the key sheet at those times instead)
const KEYS = opt('times', '') ? opt('times').split(',').map((t) => [+t, `t ${t}`]) : [[0.84, 'Wind-up (around)'], [1.1, 'Heave'], [1.34, 'Top'], [1.62, 'Strike'], [1.7, 'Impact'], [1.8, 'Follow-through']];

if (only.includes('held')) {
  // both fists on the grip at the top and at the impact, in the grip's own frame (y up the haft toward the head, x toward
  // the pick): only the body's triangles near the fists and the pickaxe's near the grip, seen down the haft from the head,
  // from the pick's side and from the hammer's (as tools/sculpt/lowgearshot.mjs's held-fists)
  const cells = [], cw = 280, ch = 300;
  let col = 0;
  for (const who of ['male', 'female']) for (const [t, lab] of [[1.34, 'top'], [1.7, 'impact']]) {
    const h = swingAt(who, t), p = who === 'female' ? lit : plain, Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
    const mid = mul(add(h.at, h.l), 0.5), loc = (q) => mul(mv(Rt, sub(q, mid)), ASSET.scale[who]);
    const near = (D, r) => { const o = []; for (let i = 0; i < D.length; i += 33) { let ok = true; for (let k = 0; k < 3; k++) if (Math.hypot(D[i + k * 11], D[i + k * 11 + 1], D[i + k * 11 + 2]) > r) ok = false; if (ok) for (let j = 0; j < 33; j++) o.push(D[i + j]); } return o; };
    const items = [near(bodyDrawable(rigs[who], h.P.map(loc)), 1.3), near(pickD(p, h.Q.map(loc)), 1.5)];
    const name = `${who === 'male' ? 'Him' : 'Her'}, ${lab}`;
    [[0, 0, -90, 'down the haft'], [1, 90, 0, 'from the pick\'s side'], [2, -90, 0, 'from the hammer\'s side']].forEach(([r, yaw, pitch, v]) => cells.push({ items, cam: { yaw, pitch, s: 95, c: [0, 0, 0] }, box: [col * cw, r * ch, cw, ch], bg: BG, ink: 1, label: `${name}: ${v}` }));
    col++;
  }
  await shoot(col * cw, 3 * ch, cells, `${out}/held-fists.png`);
}

/* ---- the swing's metrics and key frames ---------------------------------------------------------------------------- */
if (only.includes('swing') || only.includes('metrics')) {
  const A = ASSET, V = PICK;
  const T = []; for (let t = 0; t < A.tris.length; t += 4) if (A.tris[t + 3] < A.glowFrom) T.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]] });
  const U = (i) => V[i][1] / L * 240;
  // the head (all of it above the upper collar), the haft out of the hands (the upper shaft and the cap, the pommel), the grip
  const head = T.filter((t) => t.v.every((i) => U(i) > 178 || Math.abs(V[i][0]) > 0.6)), rest = T.filter((t) => !head.includes(t));
  const g0 = ASSET.grip.from / L * 240 - 1, g1 = ASSET.grip.to / L * 240 + 1;
  const grip = rest.filter((t) => t.v.every((i) => U(i) >= g0 && U(i) <= g1)), haft = rest.filter((t) => !grip.includes(t));
  const report = {};
  for (const who of ['male', 'female']) {
    const rig = rigs[who], tris = rig.B.tris.map((t) => ({ v: t.v }));
    const domOf = (i) => rig.bones[rig.vw[i].reduce((a, b) => (b[1] > a[1] ? b : a))[0]].name;
    const handish = (t) => /^(hand|thumb|fingers|knuckles)/.test(domOf(t.v[0]));
    const handT = tris.filter(handish), notHandT = tris.filter((t) => !handish(t));
    const fl = rig.J.floor, s = A.scale[who];
    const m = { headX: 0, headXAt: null, haftX: 0, haftXAt: null, gripFingersX: 0, handInCm: 0, handInAt: null, bodyInCm: 0, bodyInAt: null, pickMin: Infinity, pickMinAt: null, lowMin: Infinity, frames: 0 };
    const isHand = rig.B.verts.map((_, i) => /^(hand|thumb|fingers|knuckles)/.test(domOf(i)));
    for (let k = 0; k < 100; k++) {
      const t = (k / 100) * 2, h = swingAt(who, t);
      const a = crossPairs(h.Q, head, h.P, tris).length, b = crossPairs(h.Q, haft, h.P, notHandT).length, c = crossPairs(h.Q, grip, h.P, handT).length;
      if (a > m.headX) { m.headX = a; m.headXAt = +t.toFixed(2); }
      if (b > m.haftX) { m.haftX = b; m.haftXAt = +t.toFixed(2); }
      m.gripFingersX = Math.max(m.gripFingersX, c);
      // the left fist's socket off the grip's axis (it is reached onto it at the second's place), cm
      { const d = sub(h.l, h.at), along = dot(d, h.g.way), off = Math.hypot(...sub(d, mul(h.g.way, along))) * s * 180 / 16.5; if (off > (m.leftOffCm ?? 0)) { m.leftOffCm = +off.toFixed(2); m.leftOffAt = +t.toFixed(2); } }
      // how deep the hands and the body are inside the haft, the collars and the pommel (cm of a 1.8 m man: 16.5 game units)
      const Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
      h.P.forEach((q, i) => {
        const d = plain.haftDepth(add(mul(mv(Rt, sub(q, h.at)), s), A.grip.lead)) * 180 / 16.5;
        if (isHand[i]) { const sd = domOf(i).endsWith('_l') ? 'l' : 'r'; m.handIn = m.handIn ?? { r: 0, l: 0 }; m.handIn[sd] = Math.max(m.handIn[sd], +d.toFixed(2)); if (d > m.handInCm) { m.handInCm = +d.toFixed(2); m.handInAt = +t.toFixed(2); m.handInBone = domOf(i); } }
        else if (d > m.bodyInCm) { m.bodyInCm = +d.toFixed(2); m.bodyInAt = +t.toFixed(2); }
      });
      const pk = A.ends.map((p) => add(h.at, mv(h.g.R, mul(sub(p, A.grip.lead), 1 / s))));
      const tipY = (pk[0][1] - fl) * s; if (tipY < m.pickMin) { m.pickMin = tipY; m.pickMinAt = +t.toFixed(2); }
      m.lowMin = Math.min(m.lowMin, (Math.min(...h.Q.slice(0, NPLAIN).map((q) => q[1])) - fl) * s);
      m.frames++;
    }
    {
      // each fist's reach along the grip at the top (the sheet's px, U): its vertices' least and most U in the pickaxe's frame
      const h = swingAt(who, 1.34), Rt = [h.g.R[0], h.g.R[3], h.g.R[6], h.g.R[1], h.g.R[4], h.g.R[7], h.g.R[2], h.g.R[5], h.g.R[8]];
      const ext = (side) => { let lo = Infinity, hi2 = -Infinity; h.P.forEach((q, i) => { if (!isHand[i] || !domOf(i).endsWith(`_${side}`)) return; const u = (mv(Rt, sub(q, h.at))[1] * s + A.grip.lead[1]) / L * 240; lo = Math.min(lo, u); hi2 = Math.max(hi2, u); }); return [+lo.toFixed(1), +hi2.toFixed(1)]; };
      m.fistsU = { right: ext('r'), left: ext('l') };
    }
    {
      // the long sword in the same swing, the same measure: its hands into its grip (a six-sided grip, its depth 0.8 of its
      // width, as tools/sculpt/gear/long_sword.mjs), the standard the pickaxe is held to
      const SW = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/long_sword.json'), 'utf8')), sh = AN.lowHeld(BODY[who]), sk = AN.lowSkeleton(BODY[who]);
      let worst = 0;
      for (let k = 0; k < 50; k++) {
        const t = (k / 50) * 2, r = AN.clipLocal(sk, AN.CLIPS.swing, t, sh), pose = { $move: r.move };
        r.local.forEach((q, i) => { if (q && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = q; });
        const P = skin(rig, posed(rig, pose)), g = sk.gripOf(sk.fk(r.local, r.move), sh)[1], Rt = [g.R[0], g.R[3], g.R[6], g.R[1], g.R[4], g.R[7], g.R[2], g.R[5], g.R[8]];
        P.forEach((q, i) => {
          if (!isHand[i]) return;
          const p = add(mul(mv(Rt, sub(q, g.at)), sh.scale), SW.grip.lead);
          if (p[1] < SW.grip.from || p[1] > SW.grip.to) return;
          const d = (1 - Math.hypot(p[0] / SW.grip.radius, p[2] / (0.8 * SW.grip.radius))) * 0.8 * SW.grip.radius * 180 / 16.5;
          worst = Math.max(worst, d);
        });
      }
      m.swordHandInCm = +worst.toFixed(2);
    }
    const hi = swingAt(who, 1.7 + 1e-4), tip = add(hi.at, mv(hi.g.R, mul(sub(A.ends[0], A.grip.lead), 1 / s)));
    // the pick's way at the impact: its point's direction from the head's centre, against straight down
    const hub = add(hi.at, mv(hi.g.R, mul(sub([0, 201 / 240 * L, 0], A.grip.lead), 1 / s))), d = sub(tip, hub), dl = Math.hypot(...d);
    m.pickAtImpact = +((tip[1] - fl) * s).toFixed(2);
    m.pickDownDeg = +(Math.acos(Math.max(-1, Math.min(1, -d[1] / dl))) * 180 / Math.PI).toFixed(1);
    m.fistGap = +((A.grip.lead[1] - hi.held.second)).toFixed(3);
    m.pickMin = +m.pickMin.toFixed(2); m.lowMin = +m.lowMin.toFixed(2);
    report[who] = m;
    console.log(`swing ${who}: head x body ≤${m.headX} (at ${m.headXAt}s), haft x body (not the hands) ≤${m.haftX} (at ${m.haftXAt}s), grip x hands ≤${m.gripFingersX}; hands ≤${m.handInCm} cm into the haft (right ${m.handIn.r}, left ${m.handIn.l}; at ${m.handInAt}s, ${m.handInBone}; the long sword's ≤${m.swordHandInCm} cm into its grip), body ≤${m.bodyInCm} cm (at ${m.bodyInAt}s); the left fist ≤${m.leftOffCm} cm off the grip's axis (at ${m.leftOffAt}s); the pick's point ≥${m.pickMin} gu off the ground (at ${m.pickMinAt}s), ${m.pickAtImpact} gu at the impact, ${m.pickDownDeg}° off straight down; lowest point ${m.lowMin} gu; fists ${m.fistGap} gu apart, along the grip (U px): right ${m.fistsU.right}, left ${m.fistsU.left}`);
  }
  stats.swing = report;
}
if (only.includes('swing')) {
  // key frames: a row a body, a column a key, three-quarter on top, side under, front under that
  const cw = 300, ch = 420, cells = [];
  ['male', 'female'].forEach((who, r) => KEYS.forEach(([t, lab], i) => {
    const h = swingAt(who, t), p = who === 'female' ? lit : plain;
    const items = [bodyDrawable(rigs[who], toGame(who, h.P)), pickD(p, toGame(who, h.Q))];
    const s = ch * 0.62 / sc.male.height, c = [0, sc.male.height * 0.55, 1.5];
    [[-40, 8], [-90, 4], [0, 6]].forEach(([yaw, pitch], v) => cells.push({ items, cam: { yaw, pitch, s, c }, box: [i * cw, (r * 3 + v) * ch, cw, ch], bg: BG, ink: 1, label: v === 0 ? `${who === 'male' ? 'Him (plain)' : 'Her (enchanted)'}: ${lab}, t ${t}s` : v === 1 ? 'Side' : 'Front' }));
  }));
  await shoot(KEYS.length * cw, 6 * ch, cells, `${out}/swing-keys.png`);
}

if (only.includes('gif')) {
  const dir = join(out, '.frames'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const N = 40, cw = 300, ch = 400;
  for (let k = 0; k < N; k++) {
    const t = (k / N) * 2, cells = [];
    ['male', 'female'].forEach((who, i) => {
      const h = swingAt(who, t), p = who === 'female' ? lit : plain;
      const items = [bodyDrawable(rigs[who], toGame(who, h.P)), pickD(p, toGame(who, h.Q))];
      const s = ch * 0.62 / sc.male.height, c = [0, sc.male.height * 0.55, 1.5];
      cells.push({ items, cam: { yaw: -40, pitch: 8, s, c }, box: [i * 2 * cw, 0, cw, ch], bg: BG, ink: 1, label: i === 0 ? `t ${t.toFixed(2)}s` : '' });
      cells.push({ items, cam: { yaw: -90, pitch: 4, s, c }, box: [(i * 2 + 1) * cw, 0, cw, ch], bg: BG, ink: 1 });
    });
    await shoot(4 * cw, ch, cells, join(dir, `f-${String(k).padStart(3, '0')}.png`));
  }
  execFileSync(PY, ['-c', String.raw`
import sys, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
fr = []
for f in sorted(glob.glob(d + '/f-*.png')):
  im = Image.open(f).convert('RGB'); o = Image.new('RGB', (im.width, im.height + 18), (47, 41, 43)); o.paste(im, (0, 18))
  ImageDraw.Draw(o).text((4, 3), 'The overhead swing (mining): him plain, her enchanted; three-quarter and side', fill=(240, 230, 220)); fr.append(o.quantize(colors=255, method=Image.Quantize.MEDIANCUT))
fr[0].save(out + '/swing.gif', save_all=True, append_images=fr[1:], duration=50, loop=0)
print('wrote', out + '/swing.gif')
`, dir, out], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
}

await closeBrowser();
writeFileSync(`${out}/pickaxe.json`, JSON.stringify(stats, null, 1));
