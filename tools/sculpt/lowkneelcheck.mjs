// The body against what is worn over it in a clip, every set, in the game's own figure path (lowScene: the bake and the
// bones the GPU draws with, skinned here as the shader skins them, its corrective shapes added, as
// tools/sculpt/lowplacecheck.mjs does): the knelt ground clip (src/sculpt/anim/clips/ground.ts) above all, the trunk
// bowed over the knees, where a chest garment's back has to follow the bent spine.
//
//   node tools/sculpt/lowkneelcheck.mjs [--clips ground,idle,walk,work,fight] [--sets plate,mantle,leather,...] [--n 28]
//       [--who man,woman] [--json <file>] [--detail]
//     per set, body and clip: the most body × garment triangle pairs crossing in a frame (a triangle of the body's skin,
//     less the polygons the worn pieces hide, through one of a worn piece), the frames with any, and of those the ones the
//     game's camera can see (`seen`: a ray from where the two meet toward any of its eight facings meets nothing else of
//     the figure), most in a frame; and the area of the trunk's bare skin the camera can see (the skin of the pelvis, the
//     spine and the clavicles: a ray from just off a triangle's middle toward any of the eight facings meets nothing else),
//     most in a frame, square game units; --detail adds the body bones the seen pairs hang from most; --self also counts
//     what is worn against itself (worn × worn: a piece through another, an under-layer through the plates over it), most
//     in a frame and of those the seen.
//     Clips: ground (a go of planting, one run of the clip, as the game plays it), idle (its whole loop), walk (one turn
//     of the walk phase), work (a go at the bench with the hammer), fight (the long sword's placeholder: a go of a fight).
//     Sets: plate (helm, chest & arms, leggings, boots: steel), mantle (the plate set and its fur mantle), leather (chest
//     & arms, leggings, boots, shawl, hat), leatherchest (the same less the shawl), chain (coif, hauberk & sleeves,
//     leggings, boots), scale (helm, cuirass & sleeves, leggings, boots), outfit1 (the cloth shawl, tunic, trousers and
//     boots), bare (nothing worn).
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { crossPairs, sub, add, mul, dot, cross } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const N = +opt('n', '28'), DETAIL = args.includes('--detail'), SELF = args.includes('--self');
const clips = opt('clips', 'ground').split(','), sets = opt('sets', 'plate,mantle,leather,leatherchest,chain,scale,outfit1').split(','), whos = opt('who', 'man,woman').split(',');
const ROOT = new URL('../..', import.meta.url).pathname;
const PLATE = { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, metal: { chest: 'steel', legs: 'steel', boots: 'steel', helm: 'steel' } };
const OUTFITS = {
  plate: PLATE,
  mantle: { ...PLATE, plateMantle: true },
  leather: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  leatherchest: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true },
  chain: { chainCoif: true, chainChest: true, chainLegs: true, chainBoots: true },
  scale: { scaleHelm: true, scaleChest: true, scaleLegs: true, scaleBoots: true },
  outfit1: {},
  bare: { shawl: false, trousers: false, boots: false, tunic: false, hood: false },
};
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS, workClipOf } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look'; export { M } from './src/sculpt/models/body';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
if (TS.workClipOf('plant') !== 'ground') throw new Error(`plant plays ${TS.workClipOf('plant')}, not ground`);

/**
 * Where the body's materials end and the worn garments' start (src/sculpt/lowpoly.ts GARMENT_MAT, WORN_MAT): the body's
 * own (`M`), then the prop's and each hand's tool's places (PROP_SLOTS, twenty each), then the garments'.
 */
const GARMENT_MAT = Object.keys(TS.M).length, WORN_MAT = GARMENT_MAT + 20 * 3;

/** The figure's corners skinned (and shaped), and its triangles split: the body's skin and what is worn. */
function sceneOf(pose) {
  const s = TS.lowScene(pose), V = s.baked.verts, Bn = s.bones, SH = s.baked.shapes, sw = s.shapes, names = s.baked.bones, P = [], dom = [], mat = [];
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
    P.push(q); dom.push(names[best] ?? ''); mat.push(V[o + 6]);
  }
  const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
  // (the body's skin: its own materials, the first laid; what is worn: the materials past the props' places)
  const body = [], worn = [];
  T.forEach((t, k) => { const m = mat[t.v[0]]; if (m < GARMENT_MAT) body.push(k); else if (m >= WORN_MAT) worn.push(k); });
  return { P, T, dom, mat, body, worn };
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

/** The trunk's bones: its skin covered by a chest garment (the neck, the head and the arms apart). */
const TRUNK = /^(pelvis|spine_0[123]|clavicle_[lr])$/;
/** The poses a clip is sampled at: n of them over a go, a loop or a stride. */
const POSES = {
  ground: (k, n) => { const L = TS.CLIPS.ground.length; return { working: true, job: 'plant', act: { t: (k / n) * L, length: L }, phase: 0 }; },
  idle: (k, n) => ({ phase: (k / n) * 6 * TS.CLIPS.idle.length }),
  walk: (k, n) => ({ moving: true, phase: (2 * Math.PI * k) / n }),
  work: (k, n) => ({ working: true, job: 'build_wall', tool: { id: 'hammer', material: 'iron' }, act: { t: (k / n) * 3, length: 3 }, phase: 0 }),
  fight: (k, n) => ({ working: true, job: 'attack_creature', gear: { weapon: { id: 'long_sword' } }, act: { t: (k / n) * 2, length: 2 }, phase: 0 }),
};

const report = {};
for (const set of sets) for (const gender of whos) for (const clip of clips) {
  const look = { ...TS.DEFAULT_LOOK, gender, hair: 'none', beard: 'none' };
  const r = { most: 0, frames: 0, seen: 0, seenFrames: 0, worstAt: null, bones: {}, bare: 0, bareAt: null, self: 0, selfSeen: 0 };
  for (let k = 0; k < N; k++) {
    const pose = { moving: false, facing: 0, swimming: false, working: false, look, outfit: OUTFITS[set], ...POSES[clip](k, N) };
    const { P, T, dom, mat, body, worn } = sceneOf(pose);
    const pairs = crossPairs(P, body.map((i) => T[i]), P, worn.map((i) => T[i])).map(([i, j]) => [body[i], worn[j]]);
    if (pairs.length > r.most) { r.most = pairs.length; r.worstAt = +(pose.act?.t ?? pose.phase).toFixed(3); }
    if (pairs.length) r.frames++;
    const TP = T.map((tr) => tr.v.map((i) => P[i])), grids = sightGrids(TP);
    // (the trunk's bare skin the camera can see: each skin triangle of the trunk's bones, from just off its middle)
    let bare = 0;
    for (const k of body) {
      if (mat[T[k].v[0]] !== TS.M.skin || !TRUNK.test(dom[T[k].v[0]])) continue;
      const [a, b2, c] = TP[k], n = cross(sub(b2, a), sub(c, a)), area = Math.hypot(...n) / 2;
      if (area < 1e-9) continue;
      const m = add(mul(add(add(a, b2), c), 1 / 3), mul(n, 0.004 / (2 * area)));
      if (seen(m, TP, grids, new Set([k]), 0.002)) bare += area;
    }
    if (bare > r.bare) { r.bare = +bare.toFixed(4); r.bareAt = +(pose.act?.t ?? pose.phase).toFixed(3); }
    if (SELF) {
      // (what is worn against itself: one piece through another, an under-layer through the plates over it)
      const own = crossPairs(P, worn.map((i) => T[i])).map(([i, j]) => [worn[i], worn[j]]);
      r.self = Math.max(r.self, own.length);
      r.selfSeen = Math.max(r.selfSeen, own.filter(([i, j]) => seen(meetOf(TP[i], TP[j]), TP, grids, new Set([i, j]))).length);
    }
    if (!pairs.length) continue;
    const vis = pairs.filter(([i, j]) => seen(meetOf(TP[i], TP[j]), TP, grids, new Set([i, j])));
    r.seen = Math.max(r.seen, vis.length); if (vis.length) r.seenFrames++;
    for (const [i] of vis) { const bn = dom[T[i].v[0]]; r.bones[bn] = (r.bones[bn] ?? 0) + 1; }
  }
  report[`${set} ${gender} ${clip}`] = r;
  console.log(`${set.padEnd(12)} ${gender.padEnd(6)} ${clip.padEnd(6)} body×worn ≤${r.most} a frame (${r.frames}/${N} frames${r.worstAt !== null ? `, worst at ${r.worstAt}` : ''}); seen ≤${r.seen} (${r.seenFrames}/${N} frames); trunk skin seen ≤${r.bare}${r.bareAt !== null ? ` at ${r.bareAt}` : ''}${SELF ? `; worn×worn ≤${r.self}, seen ≤${r.selfSeen}` : ''}${DETAIL && r.seen ? ' ' + Object.entries(r.bones).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ') : ''}`);
}
if (opt('json', null)) writeFileSync(opt('json'), JSON.stringify(report, null, 1));
