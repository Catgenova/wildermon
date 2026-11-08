// The plate helm (src/sculpt/assets/lowhelm-<who>.json, tools/sculpt/garments/helm.mjs) in the game's clips, through the
// game's own figure path (src/sculpt/lowpoly.ts lowScene: the bake and the bones the GPU draws with, skinned here as the
// shader skins them), both bodies:
//   the idle (its whole loop), the walk, the swing (src/sculpt/anim/clips: the two-handed swing with the long sword in
//   hand, over its whole length and at its guard, top, strike and impact), each worn with the plate set alone and over
//   the first outfit: the helm's triangles crossing the body's (less what the worn garments hide), the first outfit's
//   and the long sword's; and the helm's own (rigid on the head: the same in every pose, counted once on the tools' mesh);
//   the head turned and nodded (not a clip: the tools' skinning, lowrig.mjs posed, at rest and on the idle's and the
//   walk's figure poses as fromGame takes them), the helm against the body.
//   --with <root>: another checkout's src (e.g. `git archive origin/sculpt-plate-chest src package.json`, node_modules
//   linked) whose plate chest (outfit.plateChest, assets/lowplatechest-<who>.json) is drawn in the same poses through its
//   own game path: the helm's triangles crossing the chest's, in the clips and the head turns.
//
//   node tools/sculpt/lowhelmcheck.mjs [--with <root>] [--json <file>]
//   DIAG=1: per clip, the helm's pieces (garments/helm.mjs `piece`) each crossing is on
//   Exits 1 when the helm crosses the body, the outfit, the sword or itself.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig } from './lowrig.mjs';
import { crossPairs, skinGarment } from './lowgarment.mjs';
import { buildHelm, helmWeights } from './garments/helm.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, WITH = opt('with', null);

async function bundle(root) {
  const b = await build({
    stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: root,
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  return import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
}
const TS = await bundle(ROOT), TW = WITH ? await bundle(WITH) : null;
const json = (root, f) => JSON.parse(readFileSync(join(root, f), 'utf8'));

/** A bake's vertices skinned by the scene's bones as the shader does (game units). */
function skinned(s) {
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
  return P;
}
const trisOf = (s, a, b) => Array.from({ length: b - a }, (_, k) => { const t = a + k; return { v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }; });

const SWORD = json(ROOT, 'src/sculpt/assets/long_sword.json'), nSword = SWORD.tris.filter((x, k) => k % 4 === 3 && x < SWORD.glowFrom).length;
const LEN = TS.CLIPS.swing.length, IDLE = TS.CLIPS.idle.length;
const SWING_AT = { guard: 0, gather: 0.14, drag: 0.52, around: 0.84, heave: 1.1, top: 1.34, strike: 1.62, impact: 1.7, follow: 1.8 };
const work = (t) => ({ working: true, job: 'attack_creature', act: { t, length: LEN }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } } });
const CLIPS = {
  idle: Array.from({ length: 48 }, (_, k) => ({ phase: (k / 48) * 6 * IDLE })),
  walk: Array.from({ length: 16 }, (_, k) => ({ phase: (k / 16) * Math.PI * 2, moving: true })),
  swing: [...Array.from({ length: 50 }, (_, k) => (k / 50) * LEN), ...Object.values(SWING_AT)].map((t) => ({ phase: 0, ...work(t) })),
};
// (the plate set alone: the first outfit off; over it: the first outfit as the game wears it by default)
const ALONE = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
const OUTFITS = { alone: ALONE, outfit1: {} };
const OUTFIT1 = ['lowshawl', 'lowtrousers', 'lowboots', 'lowtunic'];

let fail = false;
const report = {};
for (const who of ['male', 'female']) {
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'bald', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  const body = json(ROOT, `src/sculpt/assets/low${who}.json`), helm = json(ROOT, `src/sculpt/assets/lowhelm-${who}.json`), nHelm = helm.tris.length / 4;
  const bodyPolys = body.tris.filter((_, k) => k % 4 === 3);
  const r = (report[who] = { helmTris: nHelm, hides: helm.hides.length });
  const rig = buildRig(who), G = buildHelm(rig), DIAG = !!process.env.DIAG;
  // (the asset's triangles in the tools' order: each one's piece)
  const pieceOf = (k) => G.polys[G.tris[k].poly].piece, tally = (o, pairs) => { for (const [i] of pairs) o[pieceOf(i)] = (o[pieceOf(i)] ?? 0) + 1; };
  for (const [oname, outfit] of Object.entries(OUTFITS)) {
    const hidden = new Set([...helm.hides, ...(oname === 'outfit1' ? OUTFIT1.flatMap((f) => json(ROOT, `src/sculpt/assets/${f}-${who}.json`).hides ?? []) : [])]);
    const nBody = bodyPolys.filter((pi) => !hidden.has(pi)).length;
    for (const [clip, frames] of Object.entries(CLIPS)) {
      const c = (r[`${clip} ${oname}`] = { frames: frames.length, body: 0, outfit: 0, sword: 0, chest: TW && oname === 'alone' ? 0 : undefined, worst: null });
      for (const f of frames) {
        const pose = { facing: 0, swimming: false, working: false, moving: false, look, ...f };
        const s = TS.lowScene({ ...pose, outfit: { ...outfit, plateHelm: true } }), P = skinned(s);
        const nS = pose.working ? nSword : 0, hEnd = s.baked.nTris - nS, hStart = hEnd - nHelm;
        if (hStart < nBody) throw new Error(`${who} ${clip}: the bake's ranges do not add up`);
        const tH = trisOf(s, hStart, hEnd);
        const xb = crossPairs(P, tH, P, trisOf(s, 0, nBody)), xo = crossPairs(P, tH, P, trisOf(s, nBody, hStart)), xs = nS ? crossPairs(P, tH, P, trisOf(s, hEnd, s.baked.nTris)) : [];
        const nb = xb.length, no = xo.length, ns = xs.length;
        if (DIAG) { tally((c.pieces ??= { body: {}, outfit: {}, sword: {}, chest: {} }).body, xb); tally(c.pieces.outfit, xo); tally(c.pieces.sword, xs); }
        c.body += nb; c.outfit += no; c.sword += ns;
        if (nb + no + ns && !c.worst) c.worst = { ...f, gear: undefined, body: nb, outfit: no, sword: ns };
        if (TW && oname === 'alone') {
          // (the other checkout's plate chest in the same pose: its bones the same as ours, its triangles last before the sword)
          const sc = TW.lowScene({ ...pose, outfit: { ...ALONE, plateChest: true } }), PC = skinned(sc);
          const dB = Math.max(...Array.from({ length: Math.min(s.bones.length, sc.bones.length) }, (_, k) => Math.abs(s.bones[k] - sc.bones[k])));
          if (dB > 1e-4) throw new Error(`${who} ${clip}: the two checkouts pose the body differently (${dB})`);
          const nC = json(WITH, `src/sculpt/assets/lowplatechest-${who}.json`).tris.length / 4, cEnd = sc.baked.nTris - nS;
          const xc = crossPairs(P, tH, PC, trisOf(sc, cEnd - nC, cEnd)), nc = xc.length;
          if (DIAG) tally(c.pieces.chest, xc);
          c.chest += nc;
          if (nc) (c.chestAt ??= []).push(pose.working ? `t ${pose.act.t.toFixed(2)}` : `phase ${pose.phase.toFixed(2)}`);
        }
      }
      if (c.body || c.outfit || c.sword) fail = true;
    }
  }

  // the head turned and nodded (the tools' skinning; at rest, and the game's idle and walk under it)
  G.vw = helmWeights(rig, G);
  r.self = crossPairs(G.verts, G.tris).length;
  if (r.self) fail = true;
  const g = await gameRig(rig, join(ROOT, 'tmp/lowhelmcheck'));
  const gameAt = (pose) => fromGame(rig, g.bonesOf(g.sculptRig({ facing: 0, swimming: false, moving: false, working: false, look: g.look, ...pose }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  const HEAD = {
    turn40: { neck_01: [0, 7, 0], neck_02: [0, 7, 0], head: [0, 26, 0] }, turn40r: { neck_01: [0, -7, 0], neck_02: [0, -7, 0], head: [0, -26, 0] },
    turn70: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, nod24: { neck_01: [7, 0, 0], neck_02: [8, 0, 0], head: [9, 0, 0] },
    nod40: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, back20: { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] },
    turnnod: { neck_01: [8, 7, 0], neck_02: [8, 7, 0], head: [8, 26, 0] },
  };
  const hide = new Set(helm.hides), tBody = rig.B.tris.filter((t) => !hide.has(t.poly));
  const chestG = WITH ? (() => { const a = json(WITH, `src/sculpt/assets/lowplatechest-${who}.json`), verts = [], vw = [], tris = []; for (let i = 0; i < a.verts.length; i += 3) verts.push([a.verts[i], a.verts[i + 1], a.verts[i + 2]]); for (const w of a.weights) { const l = []; for (let j = 0; j < w.length; j += 2) l.push([w[j], w[j + 1]]); vw.push(l); } for (let k = 0; k < a.tris.length; k += 4) tris.push({ v: [a.tris[k], a.tris[k + 1], a.tris[k + 2]] }); return { verts, vw, tris, bones: [] }; })() : null;
  const base = { rest: {}, idle: gameAt({ phase: 0 }), walk: gameAt({ phase: Math.PI / 2, moving: true }) };
  r.head = {};
  for (const [bn, b0] of Object.entries(base)) for (const [hn, h] of Object.entries(HEAD)) {
    const pose = { ...b0 };
    // (the turn laid over the clip's: each neck bone's and the head's turned further by its share)
    for (const [bone, e] of Object.entries(h)) pose[bone] = pose[bone] ? addEuler(rig, bone, pose[bone], e) : e;
    const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
    const e = { body: crossPairs(PG, G.tris, PB, tBody).length };
    if (chestG) e.chest = crossPairs(PG, G.tris, skinGarment(rig, f, chestG), chestG.tris).length;
    r.head[`${bn} ${hn}`] = e;
    if (e.body) fail = true;
  }
  console.log(who, JSON.stringify(r));
}
/** A pose's turn for a bone (a matrix or [rx, ry, rz]) with a further [rx, ry, rz] laid over it. */
function addEuler(rig, bone, a, e) {
  const M = (x) => (x.length === 9 ? x : posed(rig, { [bone]: x })[rig.at.get(bone)].L);
  const A = M(a), B = M(e), C = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
}
if (opt('json', null)) writeFileSync(opt('json'), JSON.stringify(report, null, 1));
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
