// The long waves (tools/sculpt/lowwaves.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk, the swing
// with the long sword, every other clip there is), played as the game plays them (src/sculpt/anim/player clipLocal) on
// each low-poly body: per clip the frames where the hair's faces cross the body's (the face, the ears, the neck, the
// chest, shoulders and back, the arms; the scalp it covers left out), and the most in one frame.
//
//   node tools/sculpt/lowwavesanim.mjs [--who female,male] [--frames 12] [--clips idle,walk] [--write 12 [--dense idle:24]]
//     --clips: only these clips (by default every clip, to check or to write)
//     --write n: each clip's poses at n times written to tools/sculpt/hairs/waves-poses-<who>.json (each control bone's
//     turn, as tools/sculpt/lowrig.mjs posed takes it), for tools/sculpt/lowwaves.mjs clearBody to keep the hair off the
//     body in them (written: every clip at 12, the idle at 24); --dense: a clip's own count (the idle's slow sway)
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { crossReport } from './lowwaves.mjs';
import { wavesOf } from './lowwaves.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '12');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.wavesanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
const W = +opt('write', '0'), ONLY = opt('clips', '').split(',').filter(Boolean);
const clipsOf = () => Object.entries(AN.CLIPS).filter(([name]) => !ONLY.length || ONLY.includes(name));
const DENSE = Object.fromEntries(opt('dense', 'idle:24').split(',').filter(Boolean).map((d) => [d.split(':')[0], +d.split(':')[1]]));
for (const who of opt('who', 'female,male').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body);
  if (W) {
    const out = [];
    for (const [name, clip] of clipsOf()) for (let k = 0, n = DENSE[name] ?? W; k < n; k++) {
      const pose = poseAt(rig, sk, clip, (k / n) * clip.length, clip.grip ? AN.lowHeld(body) : undefined);
      out.push(Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (x) => +x.toFixed(5))])));
      out.at(-1).$clip = `${name} ${k}`;
    }
    writeFileSync(new URL(`./hairs/waves-poses-${who}.json`, import.meta.url), JSON.stringify(out) + '\n');
    console.log(who, 'wrote', out.length, 'poses');
    continue;
  }
  const hair = wavesOf(rig); let bad = 0;
  const rows = [];
  for (const [name, clip] of clipsOf()) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0, arm: 0, edge: 0 };
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso + x.arm + x.edge;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) { if (!frames) bad++; frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
    }
    rows.push(`${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders/back ${sum.torso}, arms ${sum.arm}, scalp edge ${sum.edge})` : ''}`);
  }
  console.log(who, '\n  ' + rows.join('\n  ') + `\n  ${who}: ${rows.length} clips, ${bad} with a crossing`);
}
