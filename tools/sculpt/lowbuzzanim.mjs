// The buzz cut (tools/sculpt/lowbuzz.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk, the
// swing with the long sword, every other clip there is), played as the game plays them (src/sculpt/anim/player
// clipLocal) on each low-poly body: per clip the frames where the hair's faces cross the body's (the face, the ears, the
// neck, the chest and shoulders; the scalp it covers left out), and the most in one frame. As tools/sculpt/lowbobanim.mjs
// does for the bob, at frame times between the poses the hair was cleared in.
//
//   node tools/sculpt/lowbuzzanim.mjs [--who female,male] [--frames 24] [--detail]   (--detail: a clip's first frame's
//   crossings, which faces and the hair's weights there)
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { buzzOf, crossReport, fastCrossings, whereOf } from './lowbuzz.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '24');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.buzzanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
for (const who of opt('who', 'female,male').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body);
  const hair = buzzOf(rig);
  const rows = [];
  for (const [name, clip] of Object.entries(AN.CLIPS)) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0 };
    // (the frames half a step off the poses the hair was cleared in, tools/sculpt/hairs/bob-poses-<who>.json)
    for (let k = 0; k < F; k++) {
      const t = ((k + 0.37) / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
      if (n && args.includes('--detail') && k === 0) console.log(name, t.toFixed(2), JSON.stringify(fastCrossings(rig, hair, skin(rig, f), skinHair(rig, hair, f)).filter(([, sp]) => whereOf(rig, hair.centre, sp) !== 'edge').map(([hp, sp, ti]) => [hp, rig.B.polys[sp].name ?? sp, rig.B.polys[sp].v.map((i) => rig.B.names[i]).join(' '), hair.tris[ti].slice(0, 3).map((v) => hair.weights[v].map(([b, w]) => b + ':' + w.toFixed(2)).join('+')).join(' | ')])));
    }
    rows.push(`${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso})` : ''}`);
  }
  console.log(who, '\n  ' + rows.join('\n  '));
}
