// The ground clip's motion frame by frame (src/sculpt/anim/clips/ground.ts), as the game plays it on both bodies: through
// a go of its job (its holds stretched to the go's length), and through the get-down and the get-up (the long fade from
// the idle and back, src/sculpt/anim/index.ts SETTLE and RELEASE, on a clock of its own). Each joint's place (the hips, the chest, the
// head, both arms, both knees, both feet) at `--fps`, and where any of them turns back on itself (its step from one frame
// to the next pointing against the one before, both more than --min cm) or speeds up and slows down again more than
// its share (a shake rather than one easing in and out); and the knees' and the balls of the feet's drift while they are
// planted.
//
//   node tools/sculpt/lowgroundjitter.mjs [--fps 120] [--min 0.02] [--go 4.2] [--job plant] [--trace hand_r]
//     per body and stretch (the go, the get-down, the get-up): each point's turns back and its speed's turning points,
//     the planted knees' and balls' most drift (cm); exits 1 on any turn back but a hand's own dig landing.
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const fps = +opt('fps', '120'), min = +opt('min', '0.02'), go = +opt('go', '4.2'), job = opt('job', 'plant'), trace = opt('trace', '');
const ROOT = new URL('../..', import.meta.url).pathname, file = join(ROOT, 'tools', `.groundjitter-${process.pid}.mjs`);
writeFileSync(file, (await build({
  stdin: { contents: `export { CLIPS, animate, clipFor } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton } from './src/sculpt/lowpoly'; export { DEFAULT_LOOK } from './src/game/look';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
})).outputFiles[0].text);
const T = await import(pathToFileURL(file).href);
rmSync(file);
let CLOCK = 0;
performance.now = () => CLOCK;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a);
const JOINTS = ['pelvis', 'spine_03', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'];
const PLANTED = ['calf_l', 'calf_r', 'ball_l', 'ball_r'];
let bad = false;
for (const body of ['man', 'woman']) {
  const sk = T.lowSkeleton(body), cm = (180 * (body === 'woman' ? 0.85 : 1)) / sk.height;
  const look = { ...T.DEFAULT_LOOK, gender: body, hair: 'swept', beard: 'none' };
  // a body's frames from `a` to `b` seconds: stood until `down`, at the job until `up` (its go `go` long, restarted each go)
  const run = (id, a, b, down, up) => {
    const track = {};
    for (let k = 0; k <= Math.round((b - a) * fps); k++) {
      const s = a + k / fps; CLOCK = s * 1000;
      const working = s >= down && s < up;
      const pose = { id, moving: false, facing: 0, swimming: false, working, phase: s * 6, look, ...(working ? { job, act: { t: (s - down) % go, length: go } } : {}) };
      const r = T.animate(sk, pose, () => []), F = sk.fk(r.local, r.move);
      // (and the clip as it plays with no fade, for the turns back that are its own)
      const c = T.clipFor(pose, body), own = c ? T.clipLocal(sk, c.clip, c.t) : undefined, G = own && sk.fk(own.local, own.move);
      const ct = working ? c?.t : undefined;
      for (const j of JOINTS) (track[j] ??= []).push({ t: s, ct, v: F[sk.at.get(j)].P, own: G?.[sk.at.get(j)].P });
    }
    return track;
  };
  const stretches = {
    go: { track: run(`${body}-go`, -1, go, -1, Infinity), from: 0, to: go },
    down: { track: run(`${body}-down`, 0, 1.5, 0.3, Infinity), from: 0.3, to: 1.5 },
    up: { track: run(`${body}-up`, 0, 2.1, -2, 0.9), from: 0.6, to: 2.1 },
  };
  for (const [name, st] of Object.entries(stretches)) {
    const rows = [];
    for (const [p, all] of Object.entries(st.track)) {
      const seq = all.filter((s) => s.t >= st.from - 1e-9 && s.t <= st.to + 1e-9);
      const steps = seq.slice(1).map((s, i) => ({ t: s.t, ct: s.ct, d: sub(s.v, seq[i].v), o: s.own && seq[i].own ? sub(s.own, seq[i].own) : undefined }));
      const turned = steps.slice(1).map((s, i) => ({ ...s, was: len(steps[i].d) * cm, now: len(s.d) * cm, dp: dot(s.d, steps[i].d) })).filter((s) => s.now > min && s.was > min && s.dp < 0);
      // (a hand's dig landing: the hand driven into the ground and drawn back, within a frame or two of the dig's key)
      const c = T.CLIPS.ground, digs = (c.poses ?? []).filter((q) => /^dig/.test(q.name)).map((q) => q.t);
      const landing = /^(hand|lowerarm)_/.test(p) ? turned.filter((s) => s.ct !== undefined && digs.some((d) => Math.abs(((s.ct % c.length) + c.length) % c.length - d) < 0.06)) : [];
      // (a turn back that is the clip's own: the clip as it plays turns back at that joint within three frames, and the body
      // goes on the clip's way after it -- the idle's anticipations and pops, which are the idle's)
      const ownTurns = steps.slice(1).map((s, i) => (s.o && steps[i].o && len(s.o) * cm > 1e-4 && len(steps[i].o) * cm > 1e-4 && dot(s.o, steps[i].o) < 0 ? s.t : null)).filter((t) => t !== null);
      const own = turned.filter((s) => s.o && dot(s.d, s.o) > 0 && ownTurns.some((t) => Math.abs(t - s.t) <= 3.5 / fps));
      const back = turned.filter((s) => !landing.includes(s) && !own.includes(s));
      const sp = steps.map((s) => len(s.d) * cm), turns = sp.slice(1, -1).filter((v, i) => (v - sp[i]) * (sp[i + 2] - v) < 0 && Math.abs(v - sp[i]) > 1e-3).length;
      if (back.length) bad = true;
      const drift = PLANTED.includes(p) && name === 'go' ? ` drift ${(Math.max(...seq.map((s) => len(sub(s.v, seq[0].v)))) * cm).toFixed(3)}cm` : '';
      rows.push(`${p} ${back.length ? `BACK ${back.length} (${back.slice(0, 4).map((s) => `${s.t.toFixed(3)} ${s.was.toFixed(2)}>${s.now.toFixed(2)}cm`).join(' ')})` : 'ok'}${landing.length ? ` (landing ${landing.length})` : ''}${own.length ? ` (the clip's own ${own.length})` : ''} speed turns ${turns} max ${Math.max(...sp).toFixed(2)}${drift}`);
      if (trace === p) console.log(`  ${body} ${name} ${p} cm/frame: ${steps.map((s) => `${s.t.toFixed(3)}:${(len(s.d) * cm).toFixed(3)}`).join(' ')}`);
    }
    console.log(`${body} ${name}: ${rows.join(' | ')}`);
  }
}
console.log(bad ? 'FAIL' : 'ok');
process.exit(bad ? 1 : 0);
