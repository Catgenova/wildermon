// The cornrows (tools/sculpt/lowcornrows.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk,
// the swing with the long sword, every other clip there is), played as the game plays them (src/sculpt/anim/player
// clipLocal) on each low-poly body, after tools/sculpt/lowbobanim.mjs: per clip the frames where the hair's faces (the
// links and the cap) cross the body's that are not the scalp they lie on (the face, the ears, the neck, the chest and
// shoulders), and the most in one frame. The scalp under the rows is left out whether or not it is rigid on the head:
// the hair is weighted as the skin under it, so it moves with it.
//
//   node tools/sculpt/lowcornrowsanim.mjs [--who female,male] [--frames 24]
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { cornrowsOf, skinCrossings as report } from './lowcornrows.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '24');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.cornrowsanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body), hair = cornrowsOf(rig);
    const rows = [`rest: ${JSON.stringify(report(rig, hair, rig.B.verts, hair.verts))}`];
    for (const [name, clip] of Object.entries(AN.CLIPS)) {
      const held = clip.grip ? AN.lowHeld(body) : undefined;
      let frames = 0, most = 0, worst = null;
      const sum = { face: 0, ear: 0, neck: 0, torso: 0, other: 0 };
      for (let k = 0; k < F; k++) {
        const t = (k / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = report(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = Object.values(x).reduce((a, b) => a + b, 0);
        for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
        if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
      }
      rows.push(`${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (most in a frame: ${JSON.stringify(sum)})` : ''}`);
    }
    console.log(who, '\n  ' + rows.join('\n  '));
  }
}
