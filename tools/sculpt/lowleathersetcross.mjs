// The leather set worn whole (chest & arms, leggings, boots, shawl and hat: the game's own assets in src/sculpt/assets,
// as src/sculpt/lowpoly.ts wears them together: the leggings' hip flaps off and their waistband dropped, from `dropFrom`
// on, under the chest), each piece skinned to the rig in the game's clips, and the triangles crossing between them:
// each pair of pieces, and each piece against the body (the body's polygons every worn piece hides left out).
//
//   node tools/sculpt/lowleathersetcross.mjs [--out <file.json>] [--flaps] [--waist]
//     prints per body and group of poses (rest, idle, walk, swing) the most crossings of each pair in any pose of the
//     group (and for the shawl's, `outside`: those through its outside, not its dark underside and collar's inside); --flaps wears the hip flaps too, --waist keeps the waistband (both as without the chest's rule);
//     --plain-shawl wears the shawl's plain copy (as without the chest) rather than its copy over the chest, and the
//     chest whole.
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildRig, posed, skin, ground } from './lowrig.mjs';
import { skinGarment, crossPairs } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const DIR = new URL('.', import.meta.url).pathname, ROOT = new URL('../..', import.meta.url).pathname;
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const modFile = join(DIR, `.set-anim-${process.pid}.mjs`);
writeFileSync(modFile, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
const AN = await import(pathToFileURL(modFile).href);
rmSync(modFile);

/** A game asset (lowgarment.mjs garmentAsset) back as a garment the rig skins: its own bones as garmentBone's. */
function garmentOf(rig, name, keepPoly = () => true) {
  const A = JSON.parse(readFileSync(join(ROOT, `src/sculpt/assets/${name}-${rig.who}.json`), 'utf8'));
  const verts = []; for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const tris = []; for (let i = 0; i < A.tris.length; i += 4) if (keepPoly(A.tris[i + 3], A)) tris.push({ v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]], poly: A.tris[i + 3] });
  const vw = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
  const bones = (A.bones ?? []).map(({ name: n, p, kind, head, R, from, drive, ...set }) => ({ name: n, parent: rig.bones[p].name, kind, head, R, driver: { from: rig.bones[from].name, kind: drive, ...set } }));
  // (a polygon of the dark leather: the shawl's underside and its collar's inside, under its outside)
  const dark = A.polys.map(([, m]) => A.mats[m] === 'dark');
  return { name, verts, tris, vw, bones, hides: A.hides ?? [], dark };
}
function clipPose(rig, body, name, t) {
  const clip = AN.CLIPS[name], sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = { $move: [0, 0, 0] };
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
const keyT = (name, key) => AN.CLIPS[name].poses.find((p) => p.name === key).t;

const report = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), body = who === 'male' ? 'man' : 'woman';
  const P = {
    // (its polygons under the shawl left out, as the game leaves them out under it)
    chest: garmentOf(rig, 'lowleatherchest', (pi, A) => args.includes('--plain-shawl') || A.dropFrom === undefined || pi < A.dropFrom),
    legs: garmentOf(rig, 'lowleatherlegs', (pi, A) => args.includes('--waist') || A.dropFrom === undefined || pi < A.dropFrom),
    ...(args.includes('--flaps') ? { flaps: garmentOf(rig, 'lowleatherlegsflaps') } : {}),
    boots: garmentOf(rig, 'lowleatherboots'),
    shawl: garmentOf(rig, args.includes('--plain-shawl') ? 'lowleathershawl' : 'lowleathershawlover'),
    hat: garmentOf(rig, 'lowhat'),
  };
  const hidden = new Set(Object.values(P).flatMap((g) => g.hides)), shown = rig.B.tris.filter((t) => !hidden.has(t.poly));
  const names = Object.keys(P), pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
  const poses = [
    { g: 'rest', pose: {} },
    ...Array.from({ length: 12 }, (_, k) => ({ g: 'idle', pose: clipPose(rig, body, 'idle', (k / 12) * AN.CLIPS.idle.length) })),
    ...Array.from({ length: 8 }, (_, k) => ({ g: 'walk', pose: clipPose(rig, body, 'walk', (k / 8) * AN.CLIPS.walk.length) })),
    ...['rest', 'drag', 'heave', 'top', 'strike', 'impact', 'follow-through'].map((n) => ({ g: 'swing', pose: clipPose(rig, body, 'swing', keyT('swing', n) + 1e-4) })),
  ];
  const R = (report[who] = {});
  for (const { g, pose } of poses) {
    const f = posed(rig, pose), P0 = skin(rig, f), PB = ground(rig, P0), dy = PB[0][1] - P0[0][1];
    const X = Object.fromEntries(names.map((n) => [n, skinGarment(rig, f, P[n]).map((p) => [p[0], p[1] + dy, p[2]])]));
    const r = (R[g] ??= {});
    const put = (k, v) => { r[k] = Math.max(r[k] ?? 0, v); };
    for (const n of names) put(`${n}×body`, crossPairs(X[n], P[n].tris, PB, shown).length);
    for (const [a, b] of pairs) {
      const x = crossPairs(X[a], P[a].tris, X[b], P[b].tris);
      put(`${a}×${b}`, x.length);
      // (against the shawl: those through its outside, apart from those into its dark underside within the leather)
      if (b === 'shawl' || a === 'shawl') put(`${a}×${b} outside`, x.filter(([i, j]) => !(b === 'shawl' ? P[b].dark[P[b].tris[j].poly] : P[a].dark[P[a].tris[i].poly])).length);
    }
  }
  for (const [g, r] of Object.entries(R)) console.log(who, g.padEnd(5), Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
}
if (opt('out', '')) writeFileSync(opt('out', ''), JSON.stringify(report, null, 1));
