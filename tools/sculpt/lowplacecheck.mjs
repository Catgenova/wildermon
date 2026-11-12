// The forearms and hands against the rest of the body and what is worn over it, in the game's own figure path (lowScene: the
// bake and the bones the GPU draws with, skinned here as the shader skins them, as tools/sculpt/lowgarmentcheck.mjs does),
// in the idle clip (its whole loop) and in a stood clip played as the placeholder (src/sculpt/anim/index.ts PLACEHOLDER: an
// emote plays it), both bodies, each outfit.
//
//   node tools/sculpt/lowplacecheck.mjs [--clip sixseven] [--sets outfit1,hood,plate,leather,bare] [--n 24] [--job <id>] [--all]
//     --job: the clip played as the game plays it for that job at work (a go a run of the clip long), not as an emote.
//     --all: also every triangle of the figure against every other (the body and all it wears, no two sharing a corner):
//       a skirt through a thigh, a shawl through a chest, as well as the arms; counted as the pairs crossing in a frame of
//       the clip that cross in no frame of the idle (`new`), with the bones they hang from most; and of those, the ones the
//       game's camera can see (`seen`: from where the two triangles meet, a ray toward any of its eight facings meets
//       nothing else of the figure, as tools/sculpt/lowleathersetcross.mjs --visible counts them), most a frame by region:
//       the head (a pair with the head, the jaw or the neck in it), the legs (the pelvis, a thigh or a calf: a skirt through
//       a thigh), the arms (an arm's bone from the shoulder down), the trunk (the rest).
//     per body and outfit, for the idle and the clip: the most triangle pairs crossing in a frame, and the frames with any;
//     and the most in a frame of the whole arm's (the shoulder down) against everything not on that arm (`whole arm`).
//     A pair: a triangle of a forearm or hand (every corner most weighted to the lower arm, its twists, the wrist, the hand,
//     the knuckles, the thumb or the fingers), and one of anything else but that arm (no corner most weighted to its upper
//     arm, shoulder, elbow or below): the body, the garments, the other arm.
//   Exits 1 when the clip crosses more than the idle in any body and outfit (most in a frame, or frames with any).
import { build } from 'esbuild';
import { crossPairs, sub, add, mul, dot, cross } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const job = opt('job', ''), ALL = args.includes('--all');
const clipName = opt('clip', 'sixseven'), sets = opt('sets', 'outfit1,hood,plate,leather,bare').split(','), N = +opt('n', '24');
const ROOT = new URL('../..', import.meta.url).pathname;
const OUTFITS = {
  outfit1: {},
  hood: { hood: true },
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  leather: { leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  leatherset: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  bare: { shawl: false, trousers: false, boots: false, tunic: false, hood: false },
};
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS, CLIP_OF, workClipOf } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const clip = TS.CLIPS[clipName];
if (!clip) throw new Error(`no clip ${clipName}`);
// (the clip played as an emote: its state's clip set to it for this check; with --job, as the game plays that job)
if (!job) TS.CLIP_OF.emote = clipName;
else if (TS.workClipOf(job) !== clipName) throw new Error(`${job} plays ${TS.workClipOf(job)}, not ${clipName}`);

const FORE = /^(lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;
const ARM = /^(shoulder|upperarm|upperarm_twist|elbow|lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;

/** The pairs crossing for a pose (with --all, also every pair in the figure, as `all`). */
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
  let n = 0, arm = 0;
  for (const side of ['l', 'r']) {
    // (and the whole arm, the shoulder down, against everything not on it: the measure the approved clips are held to)
    arm += crossPairs(P, T.filter((t) => t.v.every((i) => ARM.exec(dom[i])?.[2] === side)), P, T.filter((t) => !t.v.some((i) => ARM.exec(dom[i])?.[2] === side))).length;
    const fore = T.filter((t) => t.v.every((i) => FORE.exec(dom[i])?.[2] === side));
    const rest = T.filter((t) => !t.v.some((i) => ARM.exec(dom[i])?.[2] === side));
    n += crossPairs(P, fore, P, rest).length;
  }
  return ALL ? { n, arm, P, T, all: crossPairs(P, T).map(([i, j]) => ({ i, j, key: i * 1e6 + j, bones: [i, j].map((t) => dom[T[t].v[0]]) })) } : { n, arm, all: [] };
}

/** How far the game's camera looks down (src/render/figure.ts viewOf), in degrees, and its eight eyes round the figure (its frame here: z up). */
const VIEW_DOWN = Math.atan((2 * (24 / 40)) / 2.25 / Math.SQRT2) * 180 / Math.PI;
const EYES = Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4, e = VIEW_DOWN * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; });
/** Where two crossing triangles meet: the mean of the points where an edge of either passes through the other. */
function meetOf(A, B) {
  const pts = [];
  const seg = (p, q, T) => {
    const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), d = sub(q, p), h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-12) return;
    const f = 1 / a, s0 = sub(p, T[0]), u = f * dot(s0, h); if (u < 0 || u > 1) return;
    const qv = cross(s0, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) return;
    const t = f * dot(e2, qv); if (t > 0 && t < 1) pts.push(add(p, mul(d, t)));
  };
  for (let k = 0; k < 3; k++) { seg(A[k], A[(k + 1) % 3], B); seg(B[k], B[(k + 1) % 3], A); }
  return pts.length ? mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length) : A[0];
}
/** For each eye, the triangles binned by where they fall across its line of sight. */
function sightGrids(T, cell = 0.15) {
  return EYES.map((d) => {
    const u = Math.abs(d[1]) < 0.9 ? [d[2], 0, -d[0]] : [1, 0, 0], ul = Math.hypot(...u), U = mul(u, 1 / ul), V = cross(d, U), grid = new Map();
    T.forEach((t, k) => {
      const xs = t.map((p) => dot(p, U)), ys = t.map((p) => dot(p, V));
      for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) { const key = x * 100003 + y; (grid.get(key) ?? grid.set(key, []).get(key)).push(k); }
    });
    return { d, U, V, grid, cell };
  });
}
/** Whether p can be seen from any eye: the ray toward it meets none of T (but the triangles `skip`) past `eps`. */
function seen(p, T, grids, skip, eps = 0.015) {
  for (const { d, U, V, grid, cell } of grids) {
    const key = Math.floor(dot(p, U) / cell) * 100003 + Math.floor(dot(p, V) / cell);
    let hit = false;
    for (const k of grid.get(key) ?? []) {
      if (skip.has(k)) continue;
      const [a, b, c] = T[k], e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s0 = sub(p, a), u = f * dot(s0, h); if (u < 0 || u > 1) continue;
      const q = cross(s0, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
      if (f * dot(e2, q) > eps) { hit = true; break; }
    }
    if (!hit) return true;
  }
  return false;
}

/** The region a crossing pair is counted in, by the bones its triangles hang from most. */
const regionOf = (bones) => (bones.some((b) => /^(head|jaw|neck_0\d)/.test(b)) ? 'head' : bones.some((b) => /^(pelvis|thigh|calf)/.test(b)) ? 'legs' : bones.some((b) => ARM.test(b) || /^clavicle/.test(b)) ? 'arms' : 'trunk');

let fail = false;
const report = {};
for (const set of sets) for (const gender of ['man', 'woman']) {
  const look = { ...TS.DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' }, base = { moving: false, facing: 0, swimming: false, working: false, look, outfit: OUTFITS[set] };
  const r = { idle: { most: 0, frames: 0, arm: 0 }, [clipName]: { most: 0, frames: 0, worstAt: null, new: 0, newAt: null, newFrames: 0, newBones: {}, seen: 0, seenAt: null, seenFrames: 0, seenBones: {}, region: { head: 0, legs: 0, arms: 0, trunk: 0 }, arm: 0 } };
  const idleAll = new Set();
  for (let k = 0; k < N; k++) {
    const { n: x, all, arm } = crossings({ ...base, phase: (k / N) * 6 * TS.CLIPS.idle.length });
    r.idle.arm = Math.max(r.idle.arm, arm);
    r.idle.most = Math.max(r.idle.most, x); if (x) r.idle.frames++;
    for (const x of all) idleAll.add(x.key);
  }
  for (let k = 0; k < N; k++) {
    const t = (k / N) * clip.length, doing = job ? { working: true, job, act: { t, length: clip.length } } : { emote: 'wave' };
    const { n: x, all, P, T, arm } = crossings({ ...base, phase: t * 6, ...doing });
    const c = r[clipName];
    c.arm = Math.max(c.arm, arm);
    if (x > c.most) c.worstAt = +t.toFixed(3);
    c.most = Math.max(c.most, x); if (x) c.frames++;
    const fresh = all.filter((p) => !idleAll.has(p.key));
    if (fresh.length > c.new) { c.new = fresh.length; c.newAt = +t.toFixed(3); }
    if (fresh.length) c.newFrames++;
    for (const p of fresh) { const b = p.bones.slice().sort().join('×'); c.newBones[b] = (c.newBones[b] ?? 0) + 1; }
    if (fresh.length) {
      const TP = T.map((tr) => tr.v.map((i) => P[i])), grids = sightGrids(TP);
      const vis = fresh.filter((p) => seen(meetOf(TP[p.i], TP[p.j]), TP, grids, new Set([p.i, p.j])));
      if (vis.length > c.seen) { c.seen = vis.length; c.seenAt = +t.toFixed(3); }
      if (vis.length) c.seenFrames++;
      for (const p of vis) { const b = p.bones.slice().sort().join('×'); c.seenBones[b] = (c.seenBones[b] ?? 0) + 1; }
      const by = { head: 0, legs: 0, arms: 0, trunk: 0 };
      for (const p of vis) by[regionOf(p.bones)]++;
      for (const k of Object.keys(by)) c.region[k] = Math.max(c.region[k], by[k]);
    }
  }
  const c = r[clipName];
  if (c.most > r.idle.most || c.frames / N > r.idle.frames / N || c.seen > 0) fail = true;
  report[`${set} ${gender}`] = r;
  console.log(`${set.padEnd(8)} ${gender.padEnd(6)} idle: ≤${r.idle.most} a frame (${r.idle.frames}/${N} frames; whole arm ≤${r.idle.arm})   ${clipName}: ≤${c.most} a frame (${c.frames}/${N} frames${c.worstAt !== null ? `, worst at ${c.worstAt}s` : ''}; whole arm ≤${c.arm})${ALL ? `   new in the figure: ≤${c.new} a frame (${c.newFrames}/${N} frames${c.newAt !== null ? `, worst at ${c.newAt}s` : ''})${c.new ? ' ' + Object.entries(c.newBones).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ') : ''}; seen ≤${c.seen} (head ${c.region.head}, legs ${c.region.legs}, arms ${c.region.arms}, trunk ${c.region.trunk}; ${c.seenFrames}/${N} frames${c.seenAt !== null ? `, worst at ${c.seenAt}s` : ''})${c.seen ? ' ' + Object.entries(c.seenBones).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ') : ''}` : ''}`);
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
