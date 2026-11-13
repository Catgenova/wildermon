// Space buns (tools/sculpt/lowspacebuns.mjs) through the game's own clips (src/sculpt/anim/clips: the idle, the walk, the
// swing with the long sword, every other clip there is, the ones that bend the head down among them), played as the game
// plays them (src/sculpt/anim/player clipLocal) on each low-poly body: per clip the frames where the hair's faces cross
// the body's (the face, the ears, the neck, the chest and shoulders; the scalp it covers left out), and the most in one
// frame; the scalp's edge (the head's skin outside the hair) counted apart. As tools/sculpt/lowwarrioranim.mjs does for
// the shoulder length.
//
//   node tools/sculpt/lowspacebunsanim.mjs [--who male,female] [--frames 12] [--clips idle,walk] [--write 12]
//     --write n: every clip's poses at n times written to tools/sculpt/hairs/spacebuns-poses-<who>.json (each control
//     bone's turn, as tools/sculpt/lowrig.mjs posed takes it), for tools/sculpt/lowspacebuns.mjs --clear to keep the hair
//     off the body in them
import { build } from 'esbuild';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { crossReport } from './lowtopknot.mjs';
import { spacebunsOf } from './lowspacebuns.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname, F = +opt('frames', '12');
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const code = (await build({ stdin: { contents: `
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';
`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;
const mod = join(ROOT, `tools/sculpt/.spacebunsanim-${process.pid}.mjs`);
writeFileSync(mod, code);
const AN = await import(pathToFileURL(mod).href);
rmSync(mod);

/** A clip's pose at time t on a rig: the control bones' turns, as posed() takes them. */
const poseAt = (rig, sk, clip, t, held) => { const r = AN.clipLocal(sk, clip, t, held), pose = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; }); return pose; };
const W = +opt('write', '0'), ONLY = opt('clips', '').split(',').filter(Boolean);
const clipsOf = () => Object.entries(AN.CLIPS).filter(([name]) => !ONLY.length || ONLY.includes(name));
let total = 0, edges = 0;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), body = who === 'female' ? 'woman' : 'man', sk = AN.lowSkeleton(body);
  if (W) {
    const out = [];
    for (const [name, clip] of clipsOf()) for (let k = 0; k < W; k++) {
      const pose = poseAt(rig, sk, clip, (k / W) * clip.length, clip.grip ? AN.lowHeld(body) : undefined);
      out.push(Object.fromEntries(Object.entries(pose).map(([b, m]) => [b, Array.from(m, (x) => +x.toFixed(5))])));
      out.at(-1).$clip = `${name} ${k}`;
    }
    writeFileSync(new URL(`./hairs/spacebuns-poses-${who}.json`, import.meta.url), JSON.stringify(out) + '\n');
    console.log(who, 'wrote', out.length, 'poses');
    continue;
  }
  const hair = spacebunsOf(rig);
  let clips = 0;
  for (const [name, clip] of clipsOf()) {
    const held = clip.grip ? AN.lowHeld(body) : undefined;
    let frames = 0, most = 0, worst = null, edge = 0;
    const sum = { face: 0, ear: 0, neck: 0, torso: 0 };
    for (let k = 0; k < F; k++) {
      const t = (k / F) * clip.length, f = posed(rig, poseAt(rig, sk, clip, t, held)), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), n = x.face + x.ear + x.neck + x.torso;
      for (const key of Object.keys(sum)) sum[key] = Math.max(sum[key], x[key]);
      edge = Math.max(edge, x.edge);
      if (n) { frames++; if (n > most) { most = n; worst = +t.toFixed(2); } }
    }
    clips++; total += frames; edges += edge ? 1 : 0;
    if (frames || edge || args.includes('--all')) console.log(`${who} ${name}: ${frames}/${F} frames${frames ? `, most ${most} at t ${worst} (face ${sum.face}, ear ${sum.ear}, neck ${sum.neck}, chest/shoulders ${sum.torso})` : ''}${edge ? `, the scalp's edge at most ${edge}` : ''}`);
  }
  console.log(who, clips, 'clips at', F, 'frames each');
}
console.log('frames with a crossing, every clip, both bodies:', total, '; clips with the scalp\'s edge through:', edges);
