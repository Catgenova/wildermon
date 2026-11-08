// The game's copy of a garment held to the tools': src/sculpt/lowpoly.ts (bundled for Node) against tools/sculpt/lowgarment.mjs.
//
//   node tools/sculpt/lowgarmentcheck.mjs
//     1. the 'lift' drive: lowpoly.ts liftOf against lowgarment.mjs liftOf, each cape bone's settings, on random turns of
//        its source bone (and on the test poses' upper arms): the largest difference of the 3x3 rotations;
//     2. the garment's bones: lowpoly.ts garmentFrames from the game's copy (src/sculpt/assets/lowshawl-<who>.json beside
//        low<who>.json) against lowgarment.mjs garmentFrames from the rig, on the same body frames (the test poses, the
//        game's walk and idle as fromGame takes them): the largest difference of the world rotations and heads; the
//        asset's bones named and ordered as the rig's, its weights the garment's;
//     3. the game's own figure path (lowScene: the bake and the bones the GPU draws with), skinned here as the shader
//        skins it: the shawl's triangles crossing the body's in the game's walk and idle, every facing, both bodies;
//     4. the trousers (src/sculpt/assets/lowtrousers-<who>.json, tools/sculpt/garments/trousers.mjs): the asset's weights
//        and the body polygons it hides as the tools build them, no bones of their own; in the game's path (the bake
//        with the body's covered polygons left out) the trousers' triangles crossing the body's and the shawl's, and
//        their own, in the same walk and idle;
//     5. the tunic (src/sculpt/assets/lowtunic-<who>.json, tools/sculpt/garments/tunic.mjs, fitted over the trousers and
//        under the shawl by garments/outfit1.mjs): the asset's weights, triangles and hidden polygons as the tools build
//        them, no bones of its own; in the game's path its triangles crossing the body's (less what the trousers and the
//        tunic hide), the trousers', the shawl's and its own, in the walk and the idle (the idle sampled over its whole
//        loop: 24 phases), every facing.
//   Exits 1 when a difference passes its tolerance or a crossing is found.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { buildRig, posed, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { liftOf, garmentFrames, crossPairs, bonesWith } from './lowgarment.mjs';
import { buildOutfit } from './garments/outfit1.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { liftOf, garmentFrames, lowScene } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' },
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
  // (the outfit as the game wears it: the trousers, the tunic over them, the shawl over the tunic)
  const rig = buildRig(who), O = buildOutfit(rig), G = O.shawl;
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

  // 3. the game's own path: lowScene's bake and bones, skinned as the shader skins them
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'bald', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  const cross = { walk: 0, idle: 0, checked: 0 };
  // (the trousers: their asset against the tools', then their triangles in the same bake)
  const Tg = O.trousers;
  const trousers = json(`src/sculpt/assets/lowtrousers-${who}.json`), hides = O.hides.trousers;
  r.trousers = {
    bones: trousers.bones.length, base: trousers.base, tris: trousers.tris.length / 4, hides: trousers.hides.length,
    weights: Math.max(...Tg.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (trousers.weights[i][2 * j] === bi ? Math.abs(trousers.weights[i][2 * j + 1] - w) : 1))))),
    walk: { body: 0, shawl: 0, self: 0 }, idle: { body: 0, shawl: 0, self: 0 },
  };
  if (trousers.bones.length || trousers.base !== rig.bones.length || r.trousers.weights > 1e-5 || hides.join() !== trousers.hides.join() || Tg.tris.length !== r.trousers.tris) { console.log(who, 'trousers asset differs'); fail = true; }
  // (the tunic: its asset against the tools')
  const Ug = O.tunic, tunic = json(`src/sculpt/assets/lowtunic-${who}.json`);
  r.tunic = {
    bones: tunic.bones.length, base: tunic.base, tris: tunic.tris.length / 4, hides: tunic.hides.length,
    weights: Math.max(...Ug.vw.map((l, i) => Math.max(...l.map(([bi, w], j) => (tunic.weights[i][2 * j] === bi ? Math.abs(tunic.weights[i][2 * j + 1] - w) : 1))))),
    walk: { body: 0, trousers: 0, shawl: 0, self: 0 }, idle: { body: 0, trousers: 0, shawl: 0, self: 0 },
  };
  if (tunic.bones.length || tunic.base !== rig.bones.length || r.tunic.weights > 1e-5 || O.hides.tunic.join() !== tunic.hides.join() || Ug.tris.length !== r.tunic.tris) { console.log(who, 'tunic asset differs'); fail = true; }
  const hidden = new Set([...trousers.hides, ...tunic.hides]), nShawlTris = shawl.tris.length / 4, nTrousersTris = trousers.tris.length / 4;
  const bodyTris = body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length;
  let s0 = null;
  for (const [kind, moving, n] of [['walk', true, 16], ['idle', false, 24]]) for (let facing = 0; facing < 8; facing++) for (let k = 0; k < n; k++) {
    // (the idle's loop: relaxedIdle breathes at 1.9 a unit of phase / 6, about 20 of phase round)
    const phase = moving ? (k / n) * Math.PI * 2 : (k / n) * (12 * Math.PI / 1.9);
    const s = TS.lowScene({ phase, moving, facing, swimming: false, working: false, look });
    s0 ??= s;
    const V = s.baked.verts, Bn = s.bones, P = [];
    for (let i = 0; i < s.baked.nVerts; i++) {
      const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
      for (let j = 0; j < 4; j++) {
        const w = V[o + 11 + j]; if (w <= 0) continue;
        const m = V[o + 7 + j] * 12;
        for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]);
      }
      P.push(q);
    }
    const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
    // (the bake: the body's triangles less the hidden, the shawl's, the trousers', the tunic's)
    const tB = T.slice(0, bodyTris), tS = T.slice(bodyTris, bodyTris + nShawlTris), tT = T.slice(bodyTris + nShawlTris, bodyTris + nShawlTris + nTrousersTris), tU = T.slice(bodyTris + nShawlTris + nTrousersTris);
    const u = r.tunic[kind];
    u.body += crossPairs(P, tU, P, tB).length; u.trousers += crossPairs(P, tU, P, tT).length; u.shawl += crossPairs(P, tU, P, tS).length; u.self += crossPairs(P, tU).length;
    cross[kind] += crossPairs(P, tS, P, tB).length;
    const t = r.trousers[kind];
    t.body += crossPairs(P, tT, P, tB).length; t.shawl += crossPairs(P, tT, P, tS).length; t.self += crossPairs(P, tT).length;
    cross.checked++;
  }
  r.crossings = cross;
  if (cross.walk || cross.idle) fail = true;
  for (const k of ['walk', 'idle']) if (r.trousers[k].body || r.trousers[k].shawl || r.trousers[k].self) fail = true;
  for (const k of ['walk', 'idle']) if (r.tunic[k].body || r.tunic[k].trousers || r.tunic[k].shawl) fail = true;
  if (s0.baked.nTris !== bodyTris + nShawlTris + r.trousers.tris + r.tunic.tris) { console.log(who, 'the bake is not the body less the hidden, the shawl, the trousers and the tunic'); fail = true; }
  console.log(who, JSON.stringify(r));
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
