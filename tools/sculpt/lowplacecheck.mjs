// The forearms and hands against the rest of the body and what is worn over it, in the game's own figure path (lowScene: the
// bake and the bones the GPU draws with, skinned here as the shader skins them, as tools/sculpt/lowgarmentcheck.mjs does),
// in the idle clip (its whole loop) and in a stood clip played as the placeholder (src/sculpt/anim/index.ts PLACEHOLDER: an
// emote plays it), both bodies, each outfit.
//
//   node tools/sculpt/lowplacecheck.mjs [--clip sixseven] [--sets outfit1,hood,plate,leather,bare] [--n 24]
//     per body and outfit, for the idle and the clip: the most triangle pairs crossing in a frame, and the frames with any.
//     A pair: a triangle of a forearm or hand (every corner most weighted to the lower arm, its twists, the wrist, the hand,
//     the knuckles, the thumb or the fingers), and one of anything else but that arm (no corner most weighted to its upper
//     arm, shoulder, elbow or below): the body, the garments, the other arm.
//   Exits 1 when the clip crosses more than the idle in any body and outfit (most in a frame, or frames with any).
import { build } from 'esbuild';
import { crossPairs } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const clipName = opt('clip', 'sixseven'), sets = opt('sets', 'outfit1,hood,plate,leather,bare').split(','), N = +opt('n', '24');
const ROOT = new URL('../..', import.meta.url).pathname;
const OUTFITS = {
  outfit1: {},
  hood: { hood: true },
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  leather: { leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  bare: { shawl: false, trousers: false, boots: false, tunic: false, hood: false },
};
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS, CLIP_OF } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const clip = TS.CLIPS[clipName];
if (!clip) throw new Error(`no clip ${clipName}`);
// (the clip played as an emote: its state's clip set to it for this check)
TS.CLIP_OF.emote = clipName;

const FORE = /^(lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;
const ARM = /^(shoulder|upperarm|upperarm_twist|elbow|lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;

/** The pairs crossing for a pose, and the skinned points. */
function crossings(pose) {
  const s = TS.lowScene(pose), V = s.baked.verts, Bn = s.bones, SH = s.baked.shapes, sw = s.shapes, names = s.baked.bones, P = [], dom = [];
  for (let i = 0; i < s.baked.nVerts; i++) {
    const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
    const c = SH && sw ? i - SH.from : -1;
    if (c >= 0 && c < SH.count) sw.forEach((w, k) => { if (w > 0) for (let j = 0; j < 3; j++) p[j] += w * SH.data[(c * SH.shapes + k) * 8 + j]; });
    let best = -1, bw = -1;
    for (let j = 0; j < 4; j++) {
      const w = V[o + 11 + j]; if (w <= 0) continue;
      const m = V[o + 7 + j] * 12;
      if (w > bw) { bw = w; best = V[o + 7 + j]; }
      for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]);
    }
    P.push(q); dom.push(names[best] ?? '');
  }
  const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
  let n = 0;
  for (const side of ['l', 'r']) {
    const fore = T.filter((t) => t.v.every((i) => FORE.exec(dom[i])?.[2] === side));
    const rest = T.filter((t) => !t.v.some((i) => ARM.exec(dom[i])?.[2] === side));
    n += crossPairs(P, fore, P, rest).length;
  }
  return n;
}

let fail = false;
const report = {};
for (const set of sets) for (const gender of ['man', 'woman']) {
  const look = { ...TS.DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' }, base = { moving: false, facing: 0, swimming: false, working: false, look, outfit: OUTFITS[set] };
  const r = { idle: { most: 0, frames: 0 }, [clipName]: { most: 0, frames: 0, worstAt: null } };
  for (let k = 0; k < N; k++) {
    const x = crossings({ ...base, phase: (k / N) * 6 * TS.CLIPS.idle.length });
    r.idle.most = Math.max(r.idle.most, x); if (x) r.idle.frames++;
  }
  for (let k = 0; k < N; k++) {
    const t = (k / N) * clip.length, x = crossings({ ...base, phase: t * 6, emote: 'wave' });
    const c = r[clipName];
    if (x > c.most) c.worstAt = +t.toFixed(3);
    c.most = Math.max(c.most, x); if (x) c.frames++;
  }
  const c = r[clipName];
  if (c.most > r.idle.most || c.frames / N > r.idle.frames / N) fail = true;
  report[`${set} ${gender}`] = r;
  console.log(`${set.padEnd(8)} ${gender.padEnd(6)} idle: ≤${r.idle.most} a frame (${r.idle.frames}/${N} frames)   ${clipName}: ≤${c.most} a frame (${c.frames}/${N} frames${c.worstAt !== null ? `, worst at ${c.worstAt}s` : ''})`);
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
