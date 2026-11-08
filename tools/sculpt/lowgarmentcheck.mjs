// The game's copy of a garment held to the tools': src/sculpt/lowpoly.ts (bundled for Node) against tools/sculpt/lowgarment.mjs.
//
//   node tools/sculpt/lowgarmentcheck.mjs
//     1. the 'lift' drive: lowpoly.ts liftOf against lowgarment.mjs liftOf, each cape bone's settings, on random turns of
//        its source bone (and on the test poses' upper arms): the largest difference of the 3x3 rotations;
//     2. the garment's bones: lowpoly.ts garmentFrames from the game's copy (src/sculpt/assets/lowshawl-<who>.json beside
//        low<who>.json) against lowgarment.mjs garmentFrames from the rig, on the same body frames (the test poses, the
//        game's walk and idle as fromGame takes them): the largest difference of the world rotations and heads; the
//        asset's bones named and ordered as the rig's, its weights the garment's;
//     3. the corrective shapes: lowpoly.ts shapeWeights against lowgarment.mjs shapeWeights on the same body frames (and
//        on the swing's), the largest difference; every weight nought at rest, in the test poses but overhead, the walk
//        and the idle; the asset's shapes the garment's;
//     4. the game's own figure path (lowScene: the bake, the bones and the shapes' weights the GPU draws with), skinned
//        here as the shader skins it: the shawl's triangles crossing the body's in the game's walk and idle, every
//        facing, both bodies (none allowed), and in the swing with the long sword (reported, worst frame).
//   Exits 1 when a difference passes its tolerance or a crossing is found in the walk or the idle.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { buildRig, posed, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { liftOf, garmentFrames, crossPairs, bonesWith, shapeWeights } from './lowgarment.mjs';
import { buildShawl, shawlWeights } from './garments/shawl.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { liftOf, garmentFrames, lowScene, shapeWeights, lowSkeleton, lowHeld } from './src/sculpt/lowpoly'; export { clipLocal } from './src/sculpt/anim/player'; export { SWING } from './src/sculpt/anim/clips/swing';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));

const md = (A, B) => Math.max(...A.map((x, k) => Math.abs(x - B[k])));
// a seeded random turn: a uniform axis, an angle up to `deg`
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const randTurn = (deg) => { const u = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), r = Math.sqrt(1 - u * u); return axisAngle([r * Math.cos(t), u, r * Math.sin(t)], deg * rnd()); };

let fail = false;
const report = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildShawl(rig);
  G.vw = shawlWeights(rig, G);
  const body = json(`src/sculpt/assets/low${who}.json`), shawl = json(`src/sculpt/assets/lowshawl-${who}.json`);
  const r = (report[who] = {});

  // the asset's bones are the rig's, in order; its own the garment's; its weights the garment's
  const names = bonesWith(rig, G).map((x) => x.name), asNames = [...body.bones.map((x) => x.name), ...shawl.bones.map((x) => x.name)];
  r.bones = `${shawl.base} + ${shawl.bones.length} = ${asNames.length}`;
  if (names.join() !== asNames.join() || shawl.base !== rig.bones.length) { console.log(who, 'bones differ'); fail = true; }
  r.weights = Math.max(...G.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (shawl.weights[i][2 * j] === bi ? Math.abs(shawl.weights[i][2 * j + 1] - w) : 1)))));
  if (r.weights > 1e-5) fail = true;

  // 1. the lift drive, each cape bone's settings, on random turns of its source
  let lift = 0;
  for (const gb of shawl.bones) for (let k = 0; k < 400; k++) {
    const L = randTurn(k < 200 ? 60 : 180);
    const { from, drive, name, p, kind, head, R, ...set } = gb;
    lift = Math.max(lift, md(TS.liftOf(L, set), liftOf(L, set)));
  }
  r.lift = lift;
  if (lift > 1e-12) fail = true;

  // 2. the garment's bones on the same body frames: the test poses, random poses of the arms, the game's walk and idle
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (q, bone, axis, deg) => { q[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), q[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); q[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), q[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return q; };
  const g = await gameRig(rig, 'tmp/lowgarmentcheck');
  const at = (moving, u) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: u * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  const poses = [
    {}, symW(symW({}, 'upperarm', [0, 0, 1], 74), 'lowerarm', [0, 0, 1], 10), symW(symW(symW({}, 'clavicle', [0, 1, 0], -14), 'upperarm', [1, 0, 0], -84), 'upperarm', [0, 1, 0], -2),
    symW(symW({}, 'clavicle', [0, 0, 1], 22), 'upperarm', [0, 0, 1], 140),
    ...Array.from({ length: 12 }, () => ({ upperarm_l: randTurn(150), upperarm_r: randTurn(150), clavicle_l: randTurn(20), clavicle_r: randTurn(20), spine_03: randTurn(20) })),
    ...Array.from({ length: 8 }, (_, k) => at(true, k / 8)), ...Array.from({ length: 4 }, (_, k) => at(false, k * 0.12)),
  ].map((q) => (who === 'female' ? armsOut(rig, q) : q));
  let dW = 0, dP = 0;
  for (const q of poses) {
    const F = posed(rig, q), mine = garmentFrames(rig, G, F).slice(rig.bones.length);
    const theirs = TS.garmentFrames(body.bones, shawl.bones, F.map((f) => ({ W: f.W, P: f.P, L: f.L })));
    mine.forEach((f, i) => { dW = Math.max(dW, md(f.W, theirs[i].W)); dP = Math.max(dP, md(f.P, theirs[i].P)); });
  }
  r.frames = { poses: poses.length, rotation: +dW.toExponential(2), head: +dP.toExponential(2) };
  // (the asset's heads and frames are written to five decimals)
  if (dW > 1e-4 || dP > 1e-4) fail = true;

  // 3. the corrective shapes: the asset's the garment's; their weights the same both ways; nought where they must be
  const sk = TS.lowSkeleton(who === 'male' ? 'man' : 'woman'), held = TS.lowHeld(who === 'male' ? 'man' : 'woman');
  const swing = Array.from({ length: 31 }, (_, k) => { const c = TS.clipLocal(sk, TS.SWING, k * 0.05, held), q = { $move: c.move }; c.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') q[rig.bones[i].name] = m; }); return q; });
  const shapes = G.shapes ?? [];
  r.shapes = { names: shapes.map((x) => x.name).join(' '), offsets: 0, weights: 0, nought: 0, most: 0 };
  if ((shawl.shapes ?? []).length !== shapes.length) { console.log(who, 'shapes differ'); fail = true; }
  (shawl.shapes ?? []).forEach((x, k) => { const full = shapes[k].d.map(() => [0, 0, 0]); x.at.forEach((i, j) => { full[i] = x.d.slice(j * 3, j * 3 + 3); }); r.shapes.offsets = Math.max(r.shapes.offsets, md(full.flat(), shapes[k].d.flat())); });
  // (written to four decimals)
  if (r.shapes.offsets > 5e-5 + 1e-9) fail = true;
  for (const q of [...poses, ...swing]) {
    const F = posed(rig, q), mine = shapeWeights(rig, F, G), theirs = TS.shapeWeights(body.bones, shawl, F);
    if (mine.length) r.shapes.weights = Math.max(r.shapes.weights, md(mine, theirs));
    r.shapes.most = Math.max(r.shapes.most, ...mine, 0);
  }
  // (nought at rest, arms out and forward, the head turned and nodded, the game's walk and idle: all the poses but the
  // overhead one and the random ones)
  const still = [poses[0], poses[1], poses[2], ...poses.slice(16)];
  const W0 = (who === 'female' ? (q) => armsOut(rig, q) : (q) => q);
  for (const q of [...still, W0({ neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }), W0({ neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] })]) r.shapes.nought = Math.max(r.shapes.nought, ...shapeWeights(rig, posed(rig, q), G), 0);
  // (the asset's heads are written to five decimals)
  if (r.shapes.weights > 1e-4 || r.shapes.nought > 0) fail = true;

  // 4. the game's own path: lowScene's bake, bones and shapes' weights, skinned as the shader skins them
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'bald', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  const nBodyTris = body.tris.length / 4;
  const cross = { walk: 0, idle: 0, checked: 0, swing: 0, swingSelf: 0, swingAt: 0 };
  const frames = [
    ...[['walk', true, 16], ['idle', false, 16]].flatMap(([kind, moving, n]) => Array.from({ length: 8 * n }, (_, j) => ({ kind, pose: { phase: moving ? ((j % n) / n) * Math.PI * 2 : (j % n) * 0.75, moving, facing: Math.floor(j / n), swimming: false, working: false, look } }))),
    ...Array.from({ length: 31 }, (_, k) => ({ kind: 'swing', t: (k / 30) * TS.SWING.length, pose: { phase: 0, moving: false, facing: 0, swimming: false, working: true, job: 'attack_creature', act: { t: (k / 30) * TS.SWING.length, length: TS.SWING.length }, gear: { weapon: { id: 'long_sword' } }, look } })),
  ];
  for (const { kind, pose, t } of frames) {
    const s = TS.lowScene(pose);
    const V = s.baked.verts, Bn = s.bones, P = [], SH = s.baked.shapes, sw = s.shapes;
    if (kind !== 'swing' && sw) { console.log(who, kind, 'shapes weighed', sw); fail = true; }
    for (let i = 0; i < s.baked.nVerts; i++) {
      const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
      // (the shapes added at rest, as the shader adds them)
      const c = SH && sw ? i - SH.from : -1;
      if (c >= 0 && c < SH.count) sw.forEach((w, k) => { if (w > 0) for (let j = 0; j < 3; j++) p[j] += w * SH.data[(c * SH.shapes + k) * 8 + j]; });
      for (let j = 0; j < 4; j++) {
        const w = V[o + 11 + j]; if (w <= 0) continue;
        const m = V[o + 7 + j] * 12;
        for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]);
      }
      P.push(q);
    }
    const T = Array.from({ length: s.baked.nTris }, (_, k) => ({ v: [s.baked.tris[k * 3], s.baked.tris[k * 3 + 1], s.baked.tris[k * 3 + 2]] }));
    const gT = T.slice(nBodyTris, nBodyTris + shawl.tris.length / 4), n = crossPairs(P, gT, P, T.slice(0, nBodyTris)).length;
    if (kind === 'swing') { if (n >= cross.swing) { cross.swing = n; cross.swingAt = +t.toFixed(2); } cross.swingSelf = Math.max(cross.swingSelf, crossPairs(P, gT).length); }
    else cross[kind] += n;
    cross.checked++;
  }
  r.crossings = cross;
  if (cross.walk || cross.idle) fail = true;
  console.log(who, JSON.stringify(r));
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
