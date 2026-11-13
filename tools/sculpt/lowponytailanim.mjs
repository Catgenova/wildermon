// The high ponytail (tools/sculpt/lowponytail.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk, the swing
// with the long sword, every other clip there is), played as the game plays them (src/sculpt/anim/player clipLocal) on
// each low-poly body: per clip the frames where the hair's faces cross the body's (the face, the ears, the neck, the
// chest and shoulders, the head's skin at the hairline that moves with the neck; the rigid scalp it covers left out), and
// the most in one frame.
//
//   node tools/sculpt/lowponytailanim.mjs [--who female,male] [--frames 24] [--clips idle,walk] [--write 24 [--dense idle:48]]
//     --clips: only these clips (by default every clip to check; to write, the idle, the walk, the swing, the gesture,
//     and the clips that bend the head down to the chest: ground, drinking from a cup or a skin, brushing the floor)
//     --write n: each clip's poses at n times written to tools/sculpt/hairs/ponytail-poses-<who>.json (each control bone's
//     turn, as tools/sculpt/lowrig.mjs posed takes it), for tools/sculpt/lowponytail.mjs clearBody to keep the hair off the
//     body in them; --dense: a clip's own count (the idle's slow sway, 48 by default)
//     --add: (checking) every frame that crosses added to that file's poses
import { build } from 'esbuild';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair, crossings } from './lowhair.mjs';
import { crossReport } from './lowbob.mjs';
import { ponytailOf } from './lowponytail.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '24');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.ponytailanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
const W = +opt('write', '0'), ONLY = opt('clips', W ? 'idle,walk,swing,sixseven,ground,drink-cup,drink-cup-left,drink-skin,drink-skin-left,brush-floor,brush-floor-left' : '').split(',').filter(Boolean);
const clipsOf = () => Object.entries(AN.CLIPS).filter(([name]) => !ONLY.length || ONLY.includes(name));
const DENSE = Object.fromEntries(opt('dense', 'idle:48').split(',').filter(Boolean).map((d) => [d.split(':')[0], +d.split(':')[1]]));
for (const who of opt('who', 'female,male').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body);
  if (W) {
    const out = [];
    for (const [name, clip] of clipsOf()) for (let k = 0, n = DENSE[name] ?? W; k < n; k++) {
      const pose = poseAt(rig, sk, clip, (k / n) * clip.length, clip.grip ? AN.lowHeld(body) : undefined);
      out.push(Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (x) => +x.toFixed(5))])));
      out.at(-1).$clip = `${name} ${k}`;
    }
    writeFileSync(new URL(`./hairs/ponytail-poses-${who}.json`, import.meta.url), JSON.stringify(out) + '\n');
    console.log(who, 'wrote', out.length, 'poses');
    continue;
  }
  const hair = ponytailOf(rig);
  const rows = [], crossed = [], PIECE = hair.pieces.map((pc) => pc.id);
  for (const [name, clip] of clipsOf()) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0, edge: 0 }, by = {};
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, pose = poseAt(rig, sk, clip, t, held), f = posed(rig, pose), P = skin(rig, f), H = skinHair(rig, hair, f);
      const x = crossReport(rig, hair, P, H), n = x.face + x.ear + x.neck + x.torso + x.edge;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) {
        frames++; if (n > most) { most = n; worst = +t.toFixed(2); }
        for (const [pi] of crossings(rig, hair, P, H).hits) { const id = PIECE[hair.polys[pi].piece]; by[id] = (by[id] ?? 0) + 1; }
        crossed.push({ ...Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (q) => +q.toFixed(5))])), $clip: `${name} ${k}/${F}` });
      }
    }
    rows.push(`${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso}, the scalp's edge ${sum.edge}; by piece ${JSON.stringify(by)})` : ''}`);
  }
  // --add: the frames that cross added to the poses clearBody keeps the hair clear in
  if (args.includes('--add')) {
    const file = new URL(`./hairs/ponytail-poses-${who}.json`, import.meta.url);
    let have = []; try { have = JSON.parse(readFileSync(file, 'utf8')); } catch { /* none yet */ }
    const seen = new Set(have.map((p) => p.$clip)), add = crossed.filter((p) => !seen.has(p.$clip));
    writeFileSync(file, JSON.stringify([...have, ...add]) + '\n');
    console.log(who, 'added', add.length, 'crossing poses to', have.length);
  }
  console.log(who, '\n  ' + rows.join('\n  '));
}
