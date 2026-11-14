// Where the leant-out strike (src/sculpt/anim/clips/build.ts WORK_OUT) brings the mallet's face down at the impact event,
// on the game's own skeleton and player, each body: the bench strike's (./work.ts) lands on the chisel's top, so the hold
// to put in OUT_HOLD (his) and OUT_HOLD_WOMAN (hers, added to the strike's own correction) is the bench's moved as far as
// the face moved; with how far the face is from the top as the clip stands and how far the left fist is short of its place.
//
//   node tools/sculpt/lowbuildsolve.mjs
//     prints, per body, the face's distance from the chisel's top and the left fist's from its place (cm of a 1.8 m man),
//     and the holds that put the top under the face, body heights.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../..', import.meta.url).pathname;
const file = join(ROOT, 'tools', `.buildsolve-${process.pid}.mjs`);
writeFileSync(file, (await build({
  stdin: { contents: `export * as B from './src/sculpt/anim/clips/build'; export { IMPACT, HOLD } from './src/sculpt/anim/clips/work'; export { CLIPS } from './src/sculpt/anim'; export { handsAt } from './src/sculpt/anim/clip'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowToolHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
})).outputFiles[0].text);
const T = await import(pathToFileURL(file).href);
rmSync(file);
const asset = (id) => JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets', `${id}.json`), 'utf8'));
const MAL = asset('mallet'), CHI = asset('chisel');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const C = T.B.WORK_OUT, W = T.CLIPS.work;
/** The mallet's face and the chisel's top at the impact, and how far the left fist is from its place (body heights). */
function at(body, c) {
  const sk = T.lowSkeleton(body), tools = (id) => T.lowToolHeld(body, id), floor = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets', body === 'woman' ? 'lowfemale.json' : 'lowmale.json'), 'utf8')).floor;
  const r = T.clipLocal(sk, c, T.IMPACT, undefined, tools, { ids: c.tools });
  const F = sk.fk(r.local, r.move), mal = tools('mallet'), chi = tools('chisel');
  const gr = sk.gripOf(F, mal)[1], gl = sk.gripOf(F, chi)[0];
  const top = add(gl.at, mv(gl.R, scl(sub(CHI.contact, CHI.grip.lead), 1 / chi.scale)));
  const up = c.bodies?.[body]?.grip?.r ?? 0, face = add(gr.at, mv(gr.R, scl(sub(MAL.contact, [MAL.grip.lead[0], MAL.grip.lead[1] + up, MAL.grip.lead[2]]), 1 / mal.scale)));
  const h = T.handsAt(c, T.IMPACT, body).l.at, want = [h[0] * sk.height, floor + h[1] * sk.height, h[2] * sk.height];
  return { face: scl(face, 1 / sk.height), top: scl(top, 1 / sk.height), short: Math.hypot(...sub(want, gl.at)) / sk.height };
}
// the skeleton's frame: x the body's left, y up, z forward; body heights. The bench strike lands its face on the top, so
// the leant one's hold is the bench's moved as far as its face moved.
const d = {};
for (const body of ['man', 'woman']) {
  const a = at(body, W), b = at(body, C);
  d[body] = sub(b.face, a.face);
  console.log(body, `face from the top ${(Math.hypot(...sub(b.face, b.top)) * 180).toFixed(1)} cm, left fist short of its place ${(b.short * 180).toFixed(1)} cm; the face moved by the lean`, d[body].map((x) => +x.toFixed(4)));
}
console.log('OUT_HOLD ->', JSON.stringify(add(T.HOLD, d.man).map((x) => +x.toFixed(3))), 'OUT_HOLD_WOMAN ->', JSON.stringify(sub(d.woman, d.man).map((x) => +x.toFixed(3))));
