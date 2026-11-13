// The work clip's arms and tools against the body and what is worn over it (src/sculpt/anim/clips/work.ts), in the game's own
// figure path (lowScene: the bake, the bones the GPU draws with, skinned here as the shader skins them, as
// tools/sculpt/lowplacecheck.mjs does), both bodies, each outfit, right-handed (facing 0) and left-handed (facing 3, the
// mirror), at a job the clip plays for (a hammer's).
//
//   node tools/sculpt/lowworkcheck.mjs [--sets outfit1,hood,plate,leather,bare] [--n 40] [--job fit_hammer_head] [--facings 0,3]
//     per body, outfit and hand, over the loop: the most triangle pairs crossing in a frame, and the frames with any, of
//       body: either forearm and hand with the tool in it (every corner most weighted to the lower arm, its twists, the
//         wrist, the hand, the knuckles, the thumb or the fingers) against everything not on an arm (the trunk, the legs,
//         the head, the garments over them), and either upper arm (its shoulder, upper arm and elbow) against the head,
//         the neck and what is worn on them;
//       seen: of those, the ones the camera can see (a ray from where the two meet toward it, from any of its eight
//         facings, meets nothing else: as tools/sculpt/lowleathersetcross.mjs --visible counts them);
//       brim: of those, the pairs with the hat's brim (worn on the head, lower than the crown's band), which are let be;
//       hands: the striking hand and its tool against the other hand and its tool (the mallet's face on the chisel's top at
//         the blow, and nothing else);
//     and the idle's forearms and hands against the rest, for comparing.
//   --detail: each frame's crossings by the bones most weighting the two triangles.
//   Exits 1 when any outfit's body crossings (the brim's apart) are more than its idle's, most in a frame or frames with any.
import { build } from 'esbuild';
import { crossPairs } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const sets = opt('sets', 'outfit1,hood,plate,leather,bare').split(','), N = +opt('n', '40'), job = opt('job', 'fit_hammer_head');
const facings = opt('facings', '0,3').split(',').map(Number), detail = args.includes('--detail');
const ROOT = new URL('../..', import.meta.url).pathname;
const OUTFITS = {
  outfit1: {},
  hood: { hood: true },
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  leather: { leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  bare: { shawl: false, trousers: false, boots: false, tunic: false, hood: false },
};
const b = await build({
  stdin: { contents: `export { lowScene, lowToolMats } from './src/sculpt/lowpoly'; export { CLIPS, clipFor, toolsIn } from './src/sculpt/anim'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));

const FORE = /^(lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;
const UPPER = /^(shoulder|upperarm|upperarm_twist|elbow)_([lr])$/;
const ARM = /^(clavicle|shoulder|upperarm|upperarm_twist|elbow|lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_([lr])$/;
const HEAD = /^(head|jaw|neck_0\d)$/;

/* ---- what the camera can see (as tools/sculpt/lowleathersetcross.mjs --visible): a crossing is seen when a ray from
   where the two triangles meet toward the camera, from any of its eight facings (looking down VIEW_DOWN degrees), meets
   nothing else before it is clear. The figure's frame here: z up. */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const VIEW_DOWN = Math.atan((2 * (24 / 40)) / 2.25 / Math.SQRT2) * 180 / Math.PI;
const EYES = Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4, e = VIEW_DOWN * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; });
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
function sightGrids(T, cell = 0.15) {
  return EYES.map((d) => {
    const u = Math.abs(d[2]) < 0.9 ? [d[1], -d[0], 0] : [1, 0, 0], ul = Math.hypot(...u), U = mul(u, 1 / ul), V = cross(d, U), grid = new Map();
    T.forEach((t, k) => {
      const xs = t.map((p) => dot(p, U)), ys = t.map((p) => dot(p, V));
      for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) { const key = x * 100003 + y; (grid.get(key) ?? grid.set(key, []).get(key)).push(k); }
    });
    return { d, U, V, grid, cell };
  });
}
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

/** The pairs crossing for a pose, by kind. */
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
      for (let c2 = 0; c2 < 3; c2++) q[c2] += w * (Bn[m + c2 * 4] * p[0] + Bn[m + c2 * 4 + 1] * p[1] + Bn[m + c2 * 4 + 2] * p[2] + Bn[m + c2 * 4 + 3]);
    }
    P.push(q); dom.push(names[best] ?? '');
  }
  // (the tools' own triangles named for the hand's tool in the breakdown: by their materials' places, lowpoly.ts placesOf)
  const held = TS.toolsIn(pose)?.tools ?? {}, [r0, nr] = TS.lowToolMats('r', undefined, held), [l0, nl] = TS.lowToolMats('l', undefined, held), tag = (i) => { const m = V[i * 17 + 6]; return m >= l0 && m < l0 + nl ? 'tool_l' : m >= r0 && m < r0 + nr ? 'tool_r' : dom[i]; };
  const T = Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] }));
  const side = (re, sd) => (t) => t.v.every((i) => re.exec(dom[i])?.[2] === sd);
  const offArms = T.filter((t) => !t.v.some((i) => ARM.test(dom[i])));
  const head = offArms.filter((t) => t.v.every((i) => HEAD.test(dom[i])));
  // the hat's brim: on the head, below the crown's band (the lowest tenth of what is worn on the head and wider than it)
  const hy = head.flatMap((t) => t.v.map((i) => P[i][1])), lo = Math.min(...hy), hi = Math.max(...hy);
  const brimSet = new Set(pose.outfit?.leatherHat ? head.filter((t) => t.v.every((i) => P[i][1] < lo + 0.42 * (hi - lo))) : []);
  let body = 0, brim = 0, shown = 0;
  const parts = {}, idx = new Map(T.map((t, k) => [t, k])), TP = T.map((t) => t.v.map((i) => P[i]));
  let grids = null;
  const fore = {}, upper = {};
  for (const sd of ['l', 'r']) {
    fore[sd] = T.filter(side(FORE, sd)); upper[sd] = T.filter(side(UPPER, sd));
    for (const [a, rest] of [[fore[sd], offArms], [upper[sd], head]]) for (const [i, j] of crossPairs(P, a, P, rest)) {
      if (brimSet.has(rest[j])) { brim++; continue; }
      body++;
      grids ??= sightGrids(TP);
      if (seen(meetOf(TP[idx.get(a[i])], TP[idx.get(rest[j])]), TP, grids, new Set([idx.get(a[i]), idx.get(rest[j])]))) shown++;
      const k = `${tag(a[i].v[0])}×${dom[rest[j].v[0]]}`; parts[k] = (parts[k] ?? 0) + 1;
    }
  }
  const hands = crossPairs(P, fore.r, P, fore.l).length;
  return { body, brim, hands, parts, seen: shown };
}
/** The idle's forearms and hands against the rest, as lowplacecheck.mjs counts them. */
function idleX(pose) { return crossings({ ...pose, working: false }).body; }

let fail = false;
const pad = (s, n) => String(s).padEnd(n);
for (const set of sets) for (const gender of ['man', 'woman']) {
  const look = { ...TS.DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' };
  const idle = { most: 0, frames: 0 };
  for (let k = 0; k < Math.min(N, 24); k++) { const x = idleX({ moving: false, facing: 0, swimming: false, look, outfit: OUTFITS[set], phase: (k / Math.min(N, 24)) * 6 * TS.CLIPS.idle.length }); idle.most = Math.max(idle.most, x); if (x) idle.frames++; }
  const idleShare = idle.frames / Math.min(N, 24);
  for (const facing of facings) {
    const r = { body: [0, 0, null], brim: [0, 0], hands: [0, 0, []], seen: [0, 0, null] };
    const clip = TS.clipFor({ moving: false, facing, swimming: false, working: true, job, look, phase: 0, act: { t: 0, length: 1 } }).clip;
    for (let k = 0; k < N; k++) {
      const t = (k / N) * clip.length;
      const x = crossings({ moving: false, facing, swimming: false, working: true, job, act: { t, length: clip.length }, look, outfit: OUTFITS[set], phase: t * 6 });
      if (x.body > r.body[0]) r.body[2] = +t.toFixed(3);
      r.body[0] = Math.max(r.body[0], x.body); if (x.body) r.body[1]++;
      if (x.seen > r.seen[0]) r.seen[2] = +t.toFixed(3);
      r.seen[0] = Math.max(r.seen[0], x.seen); if (x.seen) r.seen[1]++;
      r.brim[0] = Math.max(r.brim[0], x.brim); if (x.brim) r.brim[1]++;
      if (detail && x.body) console.log(`   ${set} ${gender} t ${t.toFixed(2)}: ${Object.entries(x.parts).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      r.hands[0] = Math.max(r.hands[0], x.hands); if (x.hands) { r.hands[1]++; r.hands[2].push(+t.toFixed(3)); }
    }
    const bad = r.body[0] > idle.most || r.body[1] / N > idleShare;
    if (bad) fail = true;
    console.log(`${pad(set, 8)} ${pad(gender, 6)} ${pad(clip.name, 9)} body ≤${r.body[0]} a frame (${r.body[1]}/${N} frames${r.body[2] !== null ? `, worst at ${r.body[2]}s` : ''})  seen ≤${r.seen[0]} (${r.seen[1]}/${N}${r.seen[2] !== null ? `, worst at ${r.seen[2]}s` : ''})  brim ≤${r.brim[0]} (${r.brim[1]}/${N})  hands ≤${r.hands[0]} (${r.hands[1]}/${N}${r.hands[2].length ? ` at ${r.hands[2].join(' ')}` : ''})  idle ≤${idle.most} (${idle.frames}/${Math.min(N, 24)})${bad ? '  MORE THAN IDLE' : ''}`);
  }
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
