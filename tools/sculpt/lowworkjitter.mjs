// The work clip's motion through the top's hold (src/sculpt/anim/clips/work.ts), frame by frame, as the game plays it on
// both bodies, right-handed and left-handed (its mirror, `work-left`): each joint's place (the trunk, the head, both
// arms) and the striking tool's head, at `--fps` from `--from` to `--to` seconds, and where any of them turns back on
// itself (its step from one frame to the next pointing against the one before) or speeds up and slows down again more
// than once (a shake rather than one easing in and out).
//
//   node tools/sculpt/lowworkjitter.mjs [--from 0.2] [--to 0.72] [--fps 120] [--min 0.02]
//     per body and hand: each point's turns back (steps of more than --min cm against the one before) and its speed's
//     turning points (cm a frame), and the worst; exits 1 on any turn back but the blow's own (the tool bouncing off the
//     work, the chisel driven down and back: `jolt`, counted apart). --trace prints the points' speeds frame by frame.
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const from = +opt('from', '0.2'), to = +opt('to', '0.72'), fps = +opt('fps', '120'), min = +opt('min', '0.02');
const ROOT = new URL('../..', import.meta.url).pathname, file = join(ROOT, 'tools', `.workjitter-${process.pid}.mjs`);
writeFileSync(file, (await build({
  stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowToolHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
})).outputFiles[0].text);
const T = await import(pathToFileURL(file).href);
rmSync(file);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a);
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const JOINTS = ['pelvis', 'spine_03', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
let bad = false;
for (const name of ['work', 'work-left']) for (const body of ['man', 'woman']) {
  const c = T.CLIPS[name], sk = T.lowSkeleton(body), cm = (180 * (body === 'woman' ? 0.85 : 1)) / sk.height, side = c.strike.side;
  const tools = (id) => T.lowToolHeld(body, id), tool = tools(c.tools[side]);
  const track = {};
  for (let k = 0; k <= Math.round((to - from) * fps); k++) {
    const t = from + k / fps, r = T.clipLocal(sk, c, t, undefined, tools), F = sk.fk(r.local, r.move);
    const g = sk.gripOf(F, tool)[side === 'r' ? 1 : 0], head = [0, 1, 2].map((i) => g.at[i] + mv(g.R, [(tool.contact[0]) / tool.scale, (tool.contact[1] - tool.lead) / tool.scale, tool.contact[2] / tool.scale])[i]);
    const pts = { ...Object.fromEntries(JOINTS.map((j) => [j, F[sk.at.get(j)].P])), tool: head };
    for (const [p, v] of Object.entries(pts)) (track[p] ??= []).push({ t, v });
  }
  const rows = [];
  for (const [p, seq] of Object.entries(track)) {
    const steps = seq.slice(1).map((s, i) => ({ t: s.t, d: sub(s.v, seq[i].v) }));
    const turned = steps.slice(1).filter((s, i) => len(s.d) * cm > min && len(steps[i].d) * cm > min && dot(s.d, steps[i].d) < 0);
    const holding = new RegExp(`_${side === 'r' ? 'l' : 'r'}$`).test(p), struck = c.events.find((e) => e.name === 'impact').t;
    // (the blow lands and the tool bounces off the work, the chisel is driven down and comes back: turns back the blow
    // makes, from its last breakdown to the rebound, counted apart)
    const jolt = turned.filter((s) => (holding && s.t >= struck && s.t <= struck + 0.2) || (s.t > 0.7 && s.t <= struck + 0.09)), back = turned.filter((s) => !jolt.includes(s));
    const sp = steps.map((s) => len(s.d) * cm), turns = sp.slice(1, -1).filter((v, i) => (v - sp[i]) * (sp[i + 2] - v) < 0 && Math.abs(v - sp[i]) > 1e-3).length;
    if (back.length) bad = true;
    rows.push(`${p} ${back.length ? `BACK ${back.length} (${back.slice(0, 4).map((s) => s.t.toFixed(3)).join(' ')})` : 'ok'}${jolt.length ? ` (jolt ${jolt.length})` : ''} speed turns ${turns} max ${Math.max(...sp).toFixed(2)}`);
  }
  console.log(`${name} ${body}: ${rows.join(' | ')}`);
  if (args.includes('--trace')) for (const p of (opt('points', 'tool,hand_r,spine_03,hand_l')).split(',')) { const seq = track[p]; console.log(`  ${p} cm/frame: ${seq.slice(1).map((s, i) => `${s.t.toFixed(3)}:${(len(sub(s.v, seq[i].v)) * cm).toFixed(2)}`).join(' ')}`); }
}
console.log(bad ? 'FAIL' : 'ok');
process.exit(bad ? 1 : 0);
