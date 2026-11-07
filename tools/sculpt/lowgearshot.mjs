// The long sword (tools/sculpt/gear/long_sword.mjs) looked over: against both bodies at the game's scale, in the
// reference sheet's views beside the sheet (plain and enchanted), its facets and wire, held and carried by both bodies,
// and at the game's zoom.
//
//   node tools/sculpt/lowgearshot.mjs --out <dir> [--only block,sheet,wire,engrave,held,game]
//     block: the sword stood beside the man and the woman at the game's scale (her height its length);
//     sheet: front, side, back, side and the hero three-quarter, plain and enchanted (sheet-model.png; tools/sculpt/
//       lowgearsheet.py sets the reference sheet's row beside it);
//     wire: the facets by material and the triangles;
//     engrave: the blade's panel close, plain and enchanted;
//     held: in the right hand, in both hands, carried on the right shoulder, on both bodies, front and three-quarter;
//     game: the whole body at the game's zoom 5 and 10 (px per unit: zoom x HEIGHT_SCALE), held and carried.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRig, posed, skin, ground, mm, mv, tr, add, sub, mul, unit, cross, dot, axisAngle } from './lowrig.mjs';
import { shoot, closeBrowser, gearDrawable, bodyDrawable, edgesOf, triEdgesOf, gameScale, socketAt, fistOn, fitFist, reach, placed, cols, colOf, trisOf } from './lowgear.mjs';
import { buildLongSword, swordLength } from './gear/long_sword.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowgear'));
mkdirSync(out, { recursive: true });
const only = opt('only', 'block,sheet,wire,engrave,held,game').split(',');
const MAIN = import.meta.url === `file://${process.argv[1]}`;

const L = await swordLength();
const plain = buildLongSword({ length: L }), lit = buildLongSword({ length: L, enchanted: true });
console.log(`long sword: ${L.toFixed(4)} game units; ${plain.tris} triangles (enchanted: ${lit.all} with the glow)`);
const BG = [0.51, 0.6, 0.533];
const rigs = { male: buildRig('male'), female: buildRig('female') };
const sc = { male: await gameScale(rigs.male), female: await gameScale(rigs.female) };
for (const w of ['male', 'female']) console.log(`${w}: ${sc[w].mesh.toFixed(3)} mesh units tall, ${sc[w].height.toFixed(3)} in game, scale ${sc[w].scale.toFixed(5)}; the sword ${(L / sc[w].scale).toFixed(3)} mesh units`);
const S = (sw) => sw.G.V;
const swordD = (sw, P = S(sw)) => gearDrawable(sw.G, P, sw.MATS);
/** A body at rest (or posed) in game units, the floor at 0. */
const bodyGame = (who, P) => P.map((p) => [p[0] * sc[who].scale, (p[1] - rigs[who].J.floor) * sc[who].scale, p[2] * sc[who].scale]);

/* ---- block: the length against both bodies ----------------------------------------------------------------------- */
if (only.includes('block')) {
  const restM = skin(rigs.male, posed(rigs.male, {})), restF = skin(rigs.female, posed(rigs.female, {}));
  const items = [
    bodyDrawable(rigs.male, bodyGame('male', restM).map((p) => [p[0] - 7.5, p[1], p[2]])),
    bodyDrawable(rigs.female, bodyGame('female', restF).map((p) => [p[0] + 7.5, p[1], p[2]])),
    swordD(plain, S(plain).map((p) => [p[0], p[1], p[2]])),
  ];
  const lines = [];
  for (const y of [L, sc.male.height]) lines.push(-12, y, 0, 12, y, 0);
  const H = 900, W = 1100, s = H * 0.93 / sc.male.height;
  await shoot(W, H, [
    { items, cam: { yaw: 0, pitch: 0, s, c: [0, sc.male.height / 2 + 0.3, 0] }, box: [0, 0, W, H], bg: BG, label: `Blockout: the long sword ${L.toFixed(2)} game units, her height (${sc.female.height.toFixed(2)}); him ${sc.male.height.toFixed(2)}`, edges: [{ lines, c: [0.95, 0.9, 0.6], over: true }] },
  ], `${out}/block.png`);
}

/* ---- sheet: the sheet's views ------------------------------------------------------------------------------------ */
const VIEWS = [{ id: 'front', yaw: 0 }, { id: 'side', yaw: 90 }, { id: 'back', yaw: 180 }, { id: 'side', yaw: -90 }];
if (only.includes('sheet')) {
  // the four views a row a state, each 150 x 560, the sword 521 px long (sheet-views.png); the hero (the sheet's big front
  // view) a column a state, 400 x 1100 (sheet-hero.png); tools/sculpt/lowgearsheet.py sets the sheet beside them
  const cw = 150, ch = 560, s = 521 / L, c = [0, L / 2, 0];
  const cells = [];
  [plain, lit].forEach((sw, r) => VIEWS.forEach((v, i) => cells.push({ items: [swordD(sw)], cam: { yaw: v.yaw, pitch: 0, s, c }, box: [i * cw, r * ch, cw, ch], bg: BG, ink: 1 })));
  await shoot(4 * cw, 2 * ch, cells, `${out}/sheet-views.png`);
  const hw = 400, hh = 1100, hs = 1040 / L;
  await shoot(2 * hw, hh, [plain, lit].map((sw, i) => ({ items: [swordD(sw)], cam: { yaw: 0, pitch: 0, s: hs, c }, box: [i * hw, 0, hw, hh], bg: BG, ink: 1.5 })), `${out}/sheet-hero.png`);
}

/* ---- wire: facets and triangles --------------------------------------------------------------------------------- */
if (only.includes('wire')) {
  // the front and the back with every triangle; the blade's point and the hilt close at three-quarters, flat and with the
  // faces' edges; a count a material
  const count = {}; for (const t of trisOf(plain.G)) { const m = plain.G.F[t.face].mat; count[m] = (count[m] ?? 0) + 1; }
  const note = Object.entries(count).map(([m, n]) => `${m} ${n}`).join('\n');
  const cw = 300, ch = 900, s = ch * 0.95 / L, ink = [0.15, 0.12, 0.2];
  const hiltS = ch / (L * 0.42), hiltC = [0, L * 0.25, 0], tipS = ch / 2 / (L * 0.3), tipC = [0, L * 0.87, 0];
  const cells = [
    { items: [swordD(plain)], cam: { yaw: 0, pitch: 0, s, c: [0, L / 2, 0] }, box: [0, 0, cw, ch], bg: BG, label: `Front: ${plain.tris} triangles`, note, edges: [{ lines: triEdgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 180, pitch: 0, s, c: [0, L / 2, 0] }, box: [cw, 0, cw, ch], bg: BG, label: 'Back', edges: [{ lines: triEdgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 35, pitch: 12, s: tipS, c: tipC }, box: [2 * cw, 0, cw, ch / 2], bg: BG, label: 'Point, three-quarter', ink: 1 },
    { items: [swordD(plain)], cam: { yaw: 215, pitch: 12, s: tipS, c: tipC }, box: [2 * cw, ch / 2, cw, ch / 2], bg: BG, label: 'Back, three-quarter', ink: 1 },
    { items: [swordD(plain)], cam: { yaw: 30, pitch: 10, s: hiltS, c: hiltC }, box: [3 * cw, 0, cw, ch], bg: BG, label: 'Hilt: the faces', edges: [{ lines: edgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 30, pitch: 10, s: hiltS, c: hiltC }, box: [4 * cw, 0, cw, ch], bg: BG, label: 'Hilt: flat', ink: 1 },
  ];
  await shoot(5 * cw, ch, cells, `${out}/wire.png`);
}

/* ---- engrave: the panel close ---------------------------------------------------------------------------------------- */
if (only.includes('engrave')) {
  const cw = 300, ch = 900, s = ch / (L * 0.62), c = [0, L * 0.69, 0];
  const cells = [plain, lit].map((sw, i) => ({ items: [swordD(sw)], cam: { yaw: 0, pitch: 0, s, c }, box: [i * cw, 0, cw, ch], bg: BG, label: i ? 'Enchanted' : 'Plain (line engraving)' }));
  cells.push({ items: [swordD(lit)], cam: { yaw: 25, pitch: 8, s: s * 0.62, c: [0, L * 0.5, 0] }, box: [2 * cw, 0, cw * 1.3, ch], bg: [0.2, 0.22, 0.24], label: 'Enchanted, three-quarter, dark ground' });
  await shoot(Math.round(3.3 * cw), ch, cells, `${out}/engrave.png`);
}

/* ---- held: the poses --------------------------------------------------------------------------------------------- */
const deg = Math.PI / 180;
const FIT = {};
const frameOf = (x, y) => { const X = unit(x), Y = unit(sub(y, mul(X, dot(y, X)))); return cols(X, Y, cross(X, Y)); };
/**
 * The sword held by one body: 'one' in the right hand, upright and leant forward in front of the hip; 'two' in both, the
 * right under the guard and the left below it, pointed forward and up at the middle of the body; 'carry' on the right
 * shoulder, the right fist before the chest and the blade back over the shoulder. Returns { pose, P (the body), Q (the
 * sword), errs } in mesh units.
 */
export function heldPose(who, how, sw = plain) {
  const rig = rigs[who], sca = sc[who].scale, r = sw.gripR / sca, J = rig.J;
  const fR = (FIT[`${who}r`] ??= fitFist(rig, 'r', r)), fL = (FIT[`${who}l`] ??= fitFist(rig, 'l', r)), sR = fR.socket, sL = fL.socket;
  const mx = (p) => [-p[0], p[1], p[2]];
  const shR = mx(J.shoulder), gap = (sw.grips.main[1] - sw.grips.off[1]) / sca;
  let pose = {}, errs = {};
  if (how === 'one') {
    const t = 32 * deg, y = [0, Math.cos(t), Math.sin(t)], x = [0, -Math.sin(t), Math.cos(t)];
    const o = [shR[0] - 0.1, J.elbow[1] - 0.35, 1.25];
    const a = reach(rig, {}, sR, { o, R: frameOf(x, y) }, { elbowOut: Math.abs(shR[0]) + 0.25 });
    pose = a.pose; errs.right = a.err;
  } else if (how === 'two') {
    // pointed forward and up at 48 degrees, the point a little out to the right of the face
    const t = 48 * deg, y = unit([-0.28, Math.cos(t), Math.sin(t)]), x = [0, -Math.sin(t), Math.cos(t)];
    const o = [-0.35, J.elbow[1] - 0.2, 1.75];
    const a = reach(rig, {}, sR, { o, R: frameOf(x, y) }, { elbowOut: Math.abs(shR[0]) + 0.1 });
    const b = reach(rig, a.pose, sL, { o: sub(o, mul(y, gap)), R: frameOf(x, y) }, { elbowOut: Math.abs(J.shoulder[0]) + 0.1 });
    pose = b.pose; errs.right = a.err; errs.left = b.err;
  } else {
    // the blade on its edge on the shoulder's top (the body's highest point over the shoulder, cleared by half the blade's
    // width), sloping back and up at 40 degrees, its engraved face out; the fist before the chest on that line, the hand's
    // length square to it, up and forward, so the forearm rises from the elbow by the side
    let top = -Infinity;
    rig.B.verts.forEach((p) => { if (Math.abs(p[0] - shR[0] * 0.9) < 0.25 && Math.abs(p[2] - shR[2]) < 0.5) top = Math.max(top, p[1]); });
    const half = (sw.halfWidth + 0.06) / sca, t = 40 * deg, y = [0, Math.sin(t), -Math.cos(t)];
    const C = [shR[0] * 0.95, top + half, shR[2] - 0.05];
    const o = sub(C, mul(y, 2.45 / sca));
    const x = [0, Math.cos(t), Math.sin(t)];
    const a = reach(rig, {}, sR, { o, R: frameOf(x, y) }, { elbowOut: Math.abs(shR[0]) + 0.15 });
    pose = a.pose; errs.right = a.err;
  }
  // the fingers as fitted to the grip (fitFist), the thumbs closed over it
  const curl = (side, f) => { pose[`fingers_01_${side}`] = [f.curl.fingers_01, 0, 0]; pose[`fingers_02_${side}`] = [f.curl.fingers_02, 0, 0]; };
  curl('r', fR); pose = fistOn(rig, pose, sR, r * 0.55, { thumbOnly: true });
  if (how === 'two') { curl('l', fL); pose = fistOn(rig, pose, sL, r * 0.55, { thumbOnly: true }); }
  const F = posed(rig, pose), P = skin(rig, F), at = socketAt(rig, F, sR);
  const Q = placed(sw.G.V, at, sca, sw.grips.main);
  return { pose, P, Q, errs, F, at };
}
const HOWS = [['one', 'In the right hand'], ['two', 'In both hands'], ['carry', 'Carried on the shoulder']];
const toGame = (who, P) => P.map((p) => [p[0] * sc[who].scale, (p[1] - rigs[who].J.floor) * sc[who].scale, p[2] * sc[who].scale]);
const HELD = {};
const heldOf = (who, how, sw = plain) => (HELD[`${who}${how}${sw === lit}`] ??= heldPose(who, how, sw));

if (only.includes('held')) {
  // a column a pose and a body: front and three-quarter (the right side toward the viewer), game units
  const cw = 260, ch = 600, s = ch * 0.7 / sc.male.height;
  const cells = [], close = [];
  let col = 0;
  for (const who of ['male', 'female']) for (const [how, lab] of HOWS) {
    const h = heldOf(who, how, who === 'female' && how === 'carry' ? lit : plain);
    console.log(who, how, JSON.stringify(h.errs, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
    const items = [bodyDrawable(rigs[who], toGame(who, h.P)), swordD(who === 'female' && how === 'carry' ? lit : plain, toGame(who, h.Q))];
    const c = [0, sc.male.height * 0.62, 0];
    cells.push({ items, cam: { yaw: 0, pitch: 6, s, c }, box: [col * cw, 0, cw, ch], bg: BG, ink: 1, label: `${who === 'male' ? 'Him' : 'Her'}: ${lab}` });
    cells.push({ items, cam: { yaw: -40, pitch: 8, s, c }, box: [col * cw, ch, cw, ch], bg: BG, ink: 1, label: 'Three-quarter' });
    // the right fist close
    const f = toGame(who, [h.at.o])[0];
    close.push({ items, cam: { yaw: -50, pitch: 15, s: 75, c: f }, box: [col * cw, 0, cw, 260], bg: BG, ink: 1, label: `${who === 'male' ? 'Him' : 'Her'}: ${how}, the fists` });
    close.push({ items, cam: { yaw: -100, pitch: -10, s: 75, c: f }, box: [col * cw, 260, cw, 260], bg: BG, ink: 1, label: 'From the right, below' });
    col++;
  }
  await shoot(col * cw, 2 * ch, cells, `${out}/held.png`);
  await shoot(col * cw, 520, close, `${out}/held-close.png`);
  // the right fist alone, seen down the grip from the blade's side and across it: the body's triangles within reach of
  // the socket and the sword's grip, in the socket's frame (y up the grip, x along the hand)
  const fists = [];
  col = 0;
  for (const who of ['male', 'female']) for (const [how] of HOWS) {
    const h = heldOf(who, how, who === 'female' && how === 'carry' ? lit : plain), R = tr(h.at.R), loc = (p) => mv(R, sub(p, h.at.o));
    const near = (D, r) => { const o = []; for (let i = 0; i < D.length; i += 33) { let ok = true; for (let k = 0; k < 3; k++) if (Math.hypot(D[i + k * 11], D[i + k * 11 + 1], D[i + k * 11 + 2]) > r) ok = false; if (ok) for (let j = 0; j < 33; j++) o.push(D[i + j]); } return o; };
    const body = near(bodyDrawable(rigs[who], h.P.map(loc)), 0.75), grip = near(swordD(plain, h.Q.map(loc)), 0.6);
    const lab = `${who === 'male' ? 'Him' : 'Her'}: ${how}`;
    fists.push({ items: [body, grip], cam: { yaw: 0, pitch: -90, s: 170, c: [0, 0, 0] }, box: [col * cw, 0, cw, 260], bg: BG, ink: 1, label: `${lab}, down the grip` });
    fists.push({ items: [body, grip], cam: { yaw: 0, pitch: 0, s: 170, c: [0, 0, 0] }, box: [col * cw, 260, cw, 260], bg: BG, ink: 1, label: 'Across, the back of the hand' });
    fists.push({ items: [body, grip], cam: { yaw: 180, pitch: 0, s: 170, c: [0, 0, 0] }, box: [col * cw, 520, cw, 260], bg: BG, ink: 1, label: 'Across, the palm' });
    const curl = ['fingers_01_r', 'fingers_02_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r'].map((n) => (h.pose[n] ?? [0])[0]).join(' ');
    console.log(who, how, 'curl (fingers 1 2, thumb 1 2 3):', curl);
    col++;
  }
  await shoot(col * cw, 780, fists, `${out}/held-fists.png`);
}

/* ---- game: the whole body at the game's zoom ------------------------------------------------------------------------- */
if (only.includes('game')) {
  // px per game unit up the body: the zoom times the iso's HEIGHT_SCALE (src/render/iso.ts), so a man is 371 px tall at 10;
  // the review renders' pitch (src/sculpt/gl.ts REVIEW_PITCH), the game's ink round the silhouette (gl.ts LOW_INK)
  const HEIGHT_SCALE = 2.25, PITCH = 8, inkAt = (z) => Math.min(2, Math.max(1, 0.8 + 0.2 * z));
  const cells = [];
  let y = 0;
  for (const [zoom, yaw] of [[10, -45], [10, 0], [5, -45], [5, 0]]) {
    const s = zoom * HEIGHT_SCALE, cw = Math.round(12 * s), ch = Math.round(21 * s);
    let x = 0;
    // him plain, her enchanted
    for (const who of ['male', 'female']) for (const [how] of HOWS) {
      const sw = who === 'female' ? lit : plain, h = heldOf(who, how, sw);
      const items = [bodyDrawable(rigs[who], toGame(who, h.P)), swordD(sw, toGame(who, h.Q))];
      cells.push({ items, cam: { yaw, pitch: PITCH, s, c: [0, 10, 0] }, box: [x, y, cw, ch], bg: BG, ink: inkAt(zoom), label: x === 0 ? `Zoom ${zoom}, ${yaw ? 'three-quarter' : 'front'}` : '' });
      x += cw;
    }
    y += ch;
  }
  const W = Math.max(...cells.map((c) => c.box[0] + c.box[2]));
  await shoot(W, y, cells, `${out}/game.png`);
}

await closeBrowser();
writeFileSync(`${out}/sword.json`, JSON.stringify({ length: L, tris: plain.tris, trisEnchanted: lit.all, mesh: { male: L / sc.male.scale, female: L / sc.female.scale }, scale: { male: sc.male.scale, female: sc.female.scale } }, null, 1));
