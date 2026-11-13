// The dreads (tools/sculpt/lowdreads.mjs) through the game's own clips (src/sculpt/anim/clips: every clip there is),
// played as the game plays them (src/sculpt/anim/player clipLocal) on each low-poly body: per clip the frames where the
// hair's faces cross the body's (the face, the ears, the neck, the chest and shoulders; the scalp it covers left out),
// and the most in one frame. After tools/sculpt/lowbobanim.mjs.
//
//   node tools/sculpt/lowdreadsanim.mjs [--who female,male] [--frames 24] [--write 8 [--dense idle:48]]
//     --write n: each clip's poses at n times written to tools/sculpt/hairs/dreads-poses-<who>.json (each control
//     bone's turn, as tools/sculpt/lowrig.mjs posed takes it), for tools/sculpt/lowdreads.mjs clearBody to keep the
//     locks off the body in them; --dense: a clip's own count (the idle's slow sway, 48 by default)
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { dreadsOf, crossReport } from './lowdreads.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '24');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.dreadsanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
const W = +opt('write', '0'), DENSE = Object.fromEntries(opt('dense', 'idle:48').split(',').filter(Boolean).map((d) => [d.split(':')[0], +d.split(':')[1]]));
const only = opt('clips', '').split(',').filter(Boolean);
const clips = Object.entries(AN.CLIPS).filter(([n]) => !only.length || only.includes(n));
for (const who of opt('who', 'female,male').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body);
  if (W) {
    const out = [];
    for (const [name, clip] of clips) for (let k = 0, n = DENSE[name] ?? W; k < n; k++) {
      const pose = poseAt(rig, sk, clip, (k / n) * clip.length, clip.grip ? AN.lowHeld(body) : undefined);
      out.push(Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (x) => +x.toFixed(5))])));
      out.at(-1).$clip = `${name} ${k}`;
    }
    writeFileSync(new URL(`./hairs/dreads-poses-${who}.json`, import.meta.url), JSON.stringify(out) + '\n');
    console.log(who, 'wrote', out.length, 'poses');
    continue;
  }
  const hair = dreadsOf(rig);
  const rows = [];
  let bad = 0;
  for (const [name, clip] of clips) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0 };
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
    }
    if (frames) bad++;
    rows.push(`${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso})` : ''}`);
  }
  console.log(who, `${clips.length} clips, ${bad} with a crossing`, '\n  ' + rows.join('\n  '));
}
