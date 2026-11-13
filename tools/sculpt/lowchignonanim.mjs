// The low chignon (tools/sculpt/lowchignon.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk,
// the swing with the long sword, every other clip there is), played as the game plays them (src/sculpt/anim/player
// clipLocal) on each low-poly body: per clip the frames where the hair's faces cross the body's (the face, the ears,
// the neck, the chest and shoulders; the scalp it covers left out), and the most in one frame. As
// tools/sculpt/lowbobanim.mjs does for the bob.
//
//   node tools/sculpt/lowchignonanim.mjs [--who male,female] [--frames 24] [--clips idle,walk] [--all] [--write]
//     --clips: only these clips (by default every clip there is); --all: every clip's line, not only those with a crossing;
//     --write: each frame with a crossing added to tools/sculpt/hairs/chignon-poses-<who>.json (each control bone's
//     turn, as tools/sculpt/lowrig.mjs posed takes it), for tools/sculpt/lowchignon.mjs clearPoses to keep the hair off
//     the body in it (run again until no frame has one)
import { build } from 'esbuild';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { buildChignon, chignonReport } from './lowchignon.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '24');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.chignonanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
const ONLY = opt('clips', '').split(',').filter(Boolean), ALL = args.includes('--all'), W = args.includes('--write');
let total = 0, clips = 0;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body), hair = buildChignon(rig);
  const file = new URL(`./hairs/chignon-poses-${who}.json`, import.meta.url), add = [];
  for (const [name, clip] of Object.entries(AN.CLIPS).filter(([n]) => !ONLY.length || ONLY.includes(n))) {
    clips++;
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0, through: 0 };
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, pose = poseAt(rig, sk, clip, t, held), f = posed(rig, pose), x = chignonReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso + x.through;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
      if (n && W) add.push({ ...Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (x) => +x.toFixed(5))])), $clip: `${name} ${k}/${F}` });
    }
    total += frames;
    if (frames || ALL) console.log(`${who} ${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso}, skin through the hair ${sum.through})` : ''}`);
  }
  if (W && add.length) {
    const was = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [], seen = new Set(was.map((p) => p.$clip));
    const all = [...was, ...add.filter((p) => !seen.has(p.$clip))];
    writeFileSync(file, JSON.stringify(all) + '\n');
    console.log(who, 'poses to clear', all.length, `(${all.length - was.length} new)`);
  }
}
console.log(`frames with a crossing, ${clips} clips at ${F} frames:`, total);
