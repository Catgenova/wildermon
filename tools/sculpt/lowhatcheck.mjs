// The leather set's feathered cap (src/sculpt/assets/lowhat-<who>.json, tools/sculpt/garments/hat.mjs) in the game's clips,
// through the game's own figure path (src/sculpt/lowpoly.ts lowScene: the bake and the bones the GPU draws with, skinned
// here as the shader skins them), both bodies, the swept-back hair drawn pressed under it (look.hair 'swept', the game's
// 'swept:hat', garments/hat.mjs hatHair):
//   the idle (its whole loop), the walk, the swing (src/sculpt/anim/clips: the two-handed swing with the long sword in
//   hand, over its whole length and at its guard, top, strike and impact), each worn alone and over the first outfit:
//   the hat's triangles crossing the body's, the hair's, the outfit's and the long sword's; its own (rigid on the head:
//   the same in every pose, counted once on the tools' mesh);
//   arms out and forward, and the head turned and nodded (not clips: the tools' skinning, lowrig.mjs posed, at rest
//   and on the idle's and the walk's figure poses as fromGame takes them), the hat against the body and the hair.
//   --with <root>[,<root>...] <switch>[,<switch>...]: other checkouts' src (each `git archive <branch> src package.json`,
//   node_modules linked) whose garment (outfit.<switch>, e.g. leatherShawl, leatherChest) is drawn in the same poses
//   through its own game path: the hat's triangles crossing that garment's, in the clips and the head turns.
//
//   node tools/sculpt/lowhatcheck.mjs [--with <roots> <switches>] [--json <file>]
//   DIAG=1: per clip, the hat's pieces (garments/hat.mjs `piece`) each crossing is on.
//   Exits 1 when the hat crosses the body, the hair or itself in the idle or the walk, or the body or the hair in the
//   head turns (the swing, the arms and the neighbours are reported).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, axisAngle, mm, tr, armsOut } from './lowrig.mjs';
import { crossPairs, skinGarment } from './lowgarment.mjs';
import { buildHat, hatWeights, hatHair } from './garments/hat.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname;
const wi = args.indexOf('--with'), WITH = wi < 0 ? [] : args[wi + 1].split(',').map((r, k) => ({ root: r, sw: args[wi + 2].split(',')[k] }));

async function bundle(root) {
  const b = await build({
    stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: root,
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  return import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
}
const TS = await bundle(ROOT);
for (const w of WITH) w.TS = await bundle(w.root);
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
const trisOf = (s, a, b) => Array.from({ length: Math.max(0, b - a) }, (_, k) => { const t = a + k; return { v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }; });

const SWORD = json(ROOT, 'src/sculpt/assets/long_sword.json'), nSword = SWORD.tris.filter((x, k) => k % 4 === 3 && x < SWORD.glowFrom).length;
const LEN = TS.CLIPS.swing.length, IDLE = TS.CLIPS.idle.length;
const SWING_AT = { guard: 0, gather: 0.14, drag: 0.52, around: 0.84, heave: 1.1, top: 1.34, strike: 1.62, impact: 1.7, follow: 1.8 };
const work = (t) => ({ working: true, job: 'attack_creature', act: { t, length: LEN }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: false } } });
const CLIPS = {
  idle: Array.from({ length: 48 }, (_, k) => ({ phase: (k / 48) * 6 * IDLE })),
  walk: Array.from({ length: 16 }, (_, k) => ({ phase: (k / 16) * Math.PI * 2, moving: true })),
  swing: [...Array.from({ length: 50 }, (_, k) => (k / 50) * LEN), ...Object.values(SWING_AT)].map((t) => ({ phase: 0, ...work(t) })),
};
// (the hat alone: the first outfit off; over it: the first outfit as the game wears it by default, the hood down)
const ALONE = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
const OUTFITS = { alone: ALONE, outfit1: {} };
const OUTFIT1 = ['lowshawl', 'lowtrousers', 'lowboots', 'lowtunic'];

let fail = false;
const report = {};
for (const who of ['male', 'female']) {
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'swept', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  const body = json(ROOT, `src/sculpt/assets/low${who}.json`), hat = json(ROOT, `src/sculpt/assets/lowhat-${who}.json`), nHat = hat.tris.length / 4;
  const nHairT = json(ROOT, 'src/sculpt/assets/lowhair.json')[who].swept.tris.length / 4;
  const bodyPolys = body.tris.filter((_, k) => k % 4 === 3);
  const r = (report[who] = { hatTris: nHat });
  const rig = buildRig(who), G = buildHat(rig), DIAG = !!process.env.DIAG;
  const pieceOf = (k) => G.polys[G.tris[k].poly].piece, tally = (o, pairs) => { for (const [i] of pairs) o[pieceOf(i)] = (o[pieceOf(i)] ?? 0) + 1; };
  for (const [oname, outfit] of Object.entries(OUTFITS)) {
    const hidden = new Set(oname === 'outfit1' ? OUTFIT1.flatMap((f) => json(ROOT, `src/sculpt/assets/${f}-${who}.json`).hides ?? []) : []);
    const nBody = bodyPolys.filter((pi) => !hidden.has(pi)).length;
    for (const [clip, frames] of Object.entries(CLIPS)) {
      const c = (r[`${clip} ${oname}`] = { frames: frames.length, body: 0, hair: 0, outfit: 0, sword: 0, ...(oname === 'alone' ? Object.fromEntries(WITH.map((w) => [w.sw, 0])) : {}), worst: null });
      for (const f of frames) {
        const pose = { facing: 0, swimming: false, working: false, moving: false, look, ...f };
        const s = TS.lowScene({ ...pose, outfit: { ...outfit, leatherHat: true } }), P = skinned(s);
        const nS = pose.working ? nSword : 0, hEnd = s.baked.nTris - nS, hStart = hEnd - nHat;
        if (hStart < nBody + nHairT) throw new Error(`${who} ${clip}: the bake's ranges do not add up`);
        const tH = trisOf(s, hStart, hEnd);
        const xb = crossPairs(P, tH, P, trisOf(s, 0, nBody)), xh = crossPairs(P, tH, P, trisOf(s, nBody, nBody + nHairT));
        const xo = crossPairs(P, tH, P, trisOf(s, nBody + nHairT, hStart)), xs = nS ? crossPairs(P, tH, P, trisOf(s, hEnd, s.baked.nTris)) : [];
        if (DIAG) { const d = (c.pieces ??= { body: {}, hair: {}, outfit: {}, sword: {} }); tally(d.body, xb); tally(d.hair, xh); tally(d.outfit, xo); tally(d.sword, xs); }
        c.body += xb.length; c.hair += xh.length; c.outfit += xo.length; c.sword += xs.length;
        const at = pose.working ? `t ${pose.act.t.toFixed(2)}` : `phase ${pose.phase.toFixed(2)}`;
        if (xb.length + xh.length + xo.length + xs.length) (c.at ??= []).push(`${at}: ${xb.length}/${xh.length}/${xo.length}/${xs.length}`);
        if (oname === 'alone') for (const w of WITH) {
          // (the other checkout's garment in the same pose, its own game path: its bones the same as ours, its
          // triangles the last of its garments, before the sword)
          const sc = w.TS.lowScene({ ...pose, outfit: { ...ALONE, [w.sw]: true } }), PC = skinned(sc);
          const dB = Math.max(...Array.from({ length: Math.min(s.bones.length, sc.bones.length) }, (_, k) => Math.abs(s.bones[k] - sc.bones[k])));
          if (dB > 1e-4) throw new Error(`${who} ${clip}: the checkouts pose the body differently (${dB})`);
          const file = { leatherShawl: 'lowleathershawl', leatherChest: 'lowleatherchest' }[w.sw] ?? w.sw;
          const ca = json(w.root, `src/sculpt/assets/${file}-${who}.json`), nC = ca.tris.filter((x, k) => k % 4 === 3 && (ca.glowFrom === undefined || x < ca.glowFrom)).length, cEnd = sc.baked.nTris - nS;
          const xc = crossPairs(P, tH, PC, trisOf(sc, cEnd - nC, cEnd));
          c[w.sw] += xc.length;
          if (xc.length) (c[`${w.sw}At`] ??= []).push(`${at}: ${xc.length}`);
          if (DIAG) tally((c.pieces[w.sw] ??= {}), xc);
        }
      }
      if ((clip === 'idle' || clip === 'walk') && (c.body || c.hair)) fail = true;
      if (c.at?.length > 12) c.at = [...c.at.slice(0, 12), `… ${c.at.length - 12} more`];
    }
  }

  // the arms and the head (the tools' skinning; at rest, and the game's idle and walk under it)
  G.vw = hatWeights(rig, G);
  r.self = crossPairs(G.verts, G.tris).length;
  if (r.self) fail = true;
  const H = hatHair(rig, G), head = rig.at.get('head'), hairG = { verts: H.verts, vw: H.verts.map(() => [[head, 1]]), bones: [] };
  const g = await gameRig(rig, join(ROOT, 'tmp/lowhatcheck'));
  const gameAt = (pose) => fromGame(rig, g.bonesOf(g.sculptRig({ facing: 0, swimming: false, moving: false, working: false, look: g.look, ...pose }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const ARMS = {
    armsOut: symW(symW({}, 'upperarm', [0, 0, 1], 74), 'lowerarm', [0, 0, 1], 10),
    armsForward: symW(symW(symW({}, 'clavicle', [0, 1, 0], -14), 'upperarm', [1, 0, 0], -84), 'upperarm', [0, 1, 0], -2),
  };
  const HEAD = {
    turn40: { neck_01: [0, 7, 0], neck_02: [0, 7, 0], head: [0, 26, 0] }, turn40r: { neck_01: [0, -7, 0], neck_02: [0, -7, 0], head: [0, -26, 0] },
    turn70: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, turn70r: { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] },
    nod24: { neck_01: [7, 0, 0], neck_02: [8, 0, 0], head: [9, 0, 0] }, nod40: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] },
    back20: { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] }, turnnod: { neck_01: [8, 7, 0], neck_02: [8, 7, 0], head: [8, 26, 0] },
  };
  const base = { rest: {}, idle: gameAt({ phase: 0 }), walk: gameAt({ phase: Math.PI / 2, moving: true }) };
  const withG = WITH.map((w) => {
    const file = { leatherShawl: 'lowleathershawl', leatherChest: 'lowleatherchest' }[w.sw] ?? w.sw;
    const a = json(w.root, `src/sculpt/assets/${file}-${who}.json`), verts = [], vw = [], tris = [];
    for (let i = 0; i < a.verts.length; i += 3) verts.push([a.verts[i], a.verts[i + 1], a.verts[i + 2]]);
    for (const wt of a.weights) { const l = []; for (let j = 0; j < wt.length; j += 2) l.push([wt[j], wt[j + 1]]); vw.push(l); }
    for (let k = 0; k < a.tris.length; k += 4) if (a.glowFrom === undefined || a.tris[k + 3] < a.glowFrom) tris.push({ v: [a.tris[k], a.tris[k + 1], a.tris[k + 2]] });
    // (its own bones, if any, as the game drives them: lowgarment.mjs garmentFrames from their drivers)
    const bones = (a.bones ?? []).map((b) => ({ name: b.name, parent: rig.bones[b.p].name, head: b.head, R: b.R, kind: 'helper', driver: { from: rig.bones[b.from].name, kind: b.drive, ...Object.fromEntries(Object.entries(b).filter(([k]) => !['name', 'p', 'kind', 'head', 'R', 'from', 'drive'].includes(k))) } }));
    return { sw: w.sw, G: { verts, vw, tris, bones } };
  });
  const measure = (pose) => {
    const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PH = skinGarment(rig, f, hairG);
    const e = { body: crossPairs(PG, G.tris, PB, rig.B.tris).length, hair: crossPairs(PG, G.tris, PH, H.tris).length };
    for (const w of withG) e[w.sw] = crossPairs(PG, G.tris, skinGarment(rig, f, w.G), w.G.tris).length;
    return e;
  };
  r.arms = {};
  for (const [an, p] of Object.entries(ARMS)) r.arms[an] = measure(who === 'female' ? armsOut(rig, p) : p);
  r.head = {};
  for (const [bn, b0] of Object.entries(base)) for (const [hn, h] of Object.entries(HEAD)) {
    const pose = { ...b0 };
    for (const [bone, e] of Object.entries(h)) pose[bone] = pose[bone] ? addEuler(rig, bone, pose[bone], e) : e;
    const e = measure(pose);
    r.head[`${bn} ${hn}`] = e;
    if (e.body || e.hair) fail = true;
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
