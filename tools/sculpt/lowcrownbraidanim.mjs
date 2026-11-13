// The crown braid (tools/sculpt/lowcrownbraid.mjs) through the game's own clips (src/sculpt/anim/clips: every clip
// there is, the head-down ones among them), played as the game plays them (src/sculpt/anim/player clipLocal) on each
// low-poly body: per clip the frames where the hair's faces cross the body's (the face, the ears, the neck, the chest
// and shoulders; the scalp it covers left out), and the most in one frame. As tools/sculpt/lowtopknotanim.mjs does.
//
//   node tools/sculpt/lowcrownbraidanim.mjs [--who male,female] [--frames 12]
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { crossReport } from './lowbob.mjs';
import { buildCrownbraid } from './lowcrownbraid.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '12');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.crownbraidanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
let total = 0, clips = 0;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body), hair = buildCrownbraid(rig);
  for (const [name, clip] of Object.entries(AN.CLIPS)) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0 };
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
    }
    total += frames; clips++;
    if (frames || args.includes('--all')) console.log(`${who} ${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso})` : ''}`);
  }
}
console.log(`clips checked (both bodies): ${clips}; frames with a crossing: ${total}`);
