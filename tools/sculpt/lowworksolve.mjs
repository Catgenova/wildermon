// Solves the work clip's right arm (src/sculpt/anim/clips/work.ts ARMS, WOMAN) for where the mallet is wanted at each key
// (ARM_AT), on the game's own skeleton and player: the key's trunk and stance, the left fist reached to the chisel
// (Clip.hands), then the right upper arm's three turns, the elbow's bend and the hand's three turns found by descent so
// the mallet's face (its asset's `contact`) is at the chisel's top plus ARM_AT's offset and its face and haft look the ways
// asked, the wrist kept in its range.
//
//   node tools/sculpt/lowworksolve.mjs [--keys rest,rise,...] [--body man|woman|both]
//     prints, per body, each key's turns and how far the face is from where it is wanted (cm) and the ways' errors
//     (degrees); then, for the clip as it is, the face's distance from the chisel's top at the impact event, both bodies.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname;
const file = join(ROOT, 'tools', `.worksolve-${process.pid}.mjs`);
writeFileSync(file, (await build({
  stdin: { contents: `export * as W from './src/sculpt/anim/clips/work'; export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowToolHeld } from './src/sculpt/lowpoly'; export { qmat } from './src/sculpt/anim/math';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
})).outputFiles[0].text);
const T = await import(pathToFileURL(file).href);
rmSync(file);
const W = T.W, WORK = T.CLIPS.work;
const asset = (id) => JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets', `${id}.json`), 'utf8'));
const MAL = asset('mallet'), CHI = asset('chisel');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => scl(a, 1 / Math.hypot(...a));
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const col = (m, k) => [m[k], m[3 + k], m[6 + k]];
const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/** A key pose as a one-key clip, as the work clip stands and holds. */
const still = (pose) => ({ ...WORK, name: 'solve', loop: false, length: 1, tracks: Object.fromEntries(Object.entries(pose.rot).map(([b, e]) => [b, [{ t: 0, v: e }]])), move: [{ t: 0, v: pose.move ?? [0, 0, 0] }], accents: undefined, bodies: undefined, breath: undefined, hands: { l: { at: [{ t: 0, v: W.HOLD }], way: W.UPRIGHT } }, bodies: { woman: { hands: WORK.bodies?.woman?.hands, tracks: { $move: WORK.bodies?.woman?.tracks?.$move } } } });
/** Where the mallet's face and ways are and the chisel's top, for local turns on a body. */
function measure(body, sk, local, move) {
  const F = sk.fk(local, move), mal = T.lowToolHeld(body, 'mallet'), chi = T.lowToolHeld(body, 'chisel');
  const gr = sk.gripOf(F, mal)[1], gl = sk.gripOf(F, chi)[0];
  const top = add(gl.at, mv(gl.R, scl(sub(CHI.contact, CHI.grip.lead), 1 / chi.scale)));
  const face = add(gr.at, mv(gr.R, scl(sub(MAL.contact, MAL.grip.lead), 1 / mal.scale)));
  return { face, top, x: col(gr.R, 0), y: col(gr.R, 1), chisel: col(gl.R, 1), fist: gr.at, left: gl.at, elbow: F[sk.at.get('lowerarm_r')].P, shoulder: F[sk.at.get('upperarm_r')].P };
}
const BONES = [['upperarm_r', 0], ['upperarm_r', 1], ['upperarm_r', 2], ['lowerarm_r', 0], ['hand_r', 0], ['hand_r', 1], ['hand_r', 2]];
const LIM = { upperarm_r: [[-60, 150], [-90, 90], [-110, 40]], lowerarm_r: [[0, 150]], hand_r: [[-60, 60], [-150, 150], [-35, 35]] };

function solveKey(body, k, prev) {
  const sk = T.lowSkeleton(body), own = body === 'woman' ? W.WOMAN : {};
  const pose = W.keyOf(k, own), base = T.clipLocal(sk, still(pose), 0, undefined, (id) => T.lowToolHeld(body, id));
  const want = (body === 'woman' && W.ARM_AT_WOMAN?.[k]) || W.ARM_AT[k], h = sk.height, floor = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets', body === 'woman' ? 'lowfemale.json' : 'lowmale.json'), 'utf8')).floor;
  const abs = (p) => p && [p[0] * h, floor + p[1] * h, p[2] * h], fist = abs(want.fist);
  /** How far the elbow is from the side asked (`pole`): its way off the line from the shoulder to the fist against the pole's. */
  const poleOff = (m) => { const n = unit(sub(m.fist, m.shoulder)), e = sub(m.elbow, m.shoulder), perp = sub(e, scl(n, dot(e, n))), q = sub(want.pole, scl(n, dot(want.pole, n))); return 1 - dot(unit(perp), unit(q)); };
  const at = (arm) => {
    const L = [...base.local];
    for (const b of ['upperarm_r', 'lowerarm_r', 'hand_r']) { const i = sk.at.get(b); L[i] = T.qmat(sk.local(i, arm[b])); }
    return measure(body, sk, L, base.move);
  };
  const cost = (arm) => {
    const m = at(arm), d = want.contact ? Math.hypot(...sub(m.face, add(m.top, scl(want.contact, h)))) / h : Math.hypot(...sub(m.fist, fist)) / h;
    const hd = arm.hand_r;
    // her turns kept near his, so her arm moves as his does between the keys
    let near = 0;
    if (body === 'woman' && W.ARMS[k]) for (const [b, j] of BONES) near += (arm[b][j] - W.ARMS[k][b][j]) ** 2;
    // and his kept near the key before, so the arm goes the short way between them
    else if (prev) for (const [b, j] of BONES) near += 0.5 * (arm[b][j] - prev[b][j]) ** 2;
    const de = poleOff(m);
    const wo = want.contact ? 1 : 0.8;
    return 2e-4 * near + 3000 * d * d + 2 * de + wo * (1.2 * (1 - dot(m.x, unit(want.face))) + 0.6 * (1 - dot(m.y, unit(want.way)))) + 1.5e-4 * (hd[0] * hd[0] + hd[2] * hd[2] + 0.03 * hd[1] * hd[1]);
  };
  const starts = (body === 'woman' ? [W.ARMS[k] ?? prev] : [...(prev ? [prev] : []), W.ARMS[k] ?? prev, { upperarm_r: [40, 0, 30], lowerarm_r: [80, 0, 0], hand_r: [0, 0, 0] }, { upperarm_r: [70, -40, 60], lowerarm_r: [110, 0, 0], hand_r: [0, 60, 0] }, { upperarm_r: [20, 40, 40], lowerarm_r: [120, 0, 0], hand_r: [0, -60, 0] }, { upperarm_r: [100, 0, 50], lowerarm_r: [130, 0, 0], hand_r: [0, 0, 0] }, { upperarm_r: [-20, 0, -75], lowerarm_r: [135, 0, 0], hand_r: [0, 0, 0] }, { upperarm_r: [20, 0, -60], lowerarm_r: [120, 0, 0], hand_r: [0, 0, 0] }]).filter(Boolean);
  let best = null;
  for (const s0 of starts) {
    const cur = Object.fromEntries(Object.entries(s0).map(([b, e]) => [b, [...e]]));
    let e = cost(cur);
    for (let step = 24; step >= 0.25; step /= 2) for (let it = 0; it < 40; it++) {
      let moved = false;
      for (const [b, j] of BONES) for (const d of [step, -step]) {
        const [lo, hi] = LIM[b][j], t = { ...cur, [b]: [...cur[b]] };
        t[b][j] = Math.max(lo, Math.min(hi, t[b][j] + d));
        const te = cost(t);
        if (te < e - 1e-10) { e = te; Object.assign(cur, t); moved = true; }
      }
      if (!moved) break;
    }
    if (!best || e < best.e) best = { e, arm: cur };
  }
  const m = at(best.arm), target = want.contact ? add(m.top, scl(want.contact, h)) : add(fist, sub(m.face, m.fist)), cm = (180 * (body === 'woman' ? 0.85 : 1)) / h;
  const r1 = (v) => v.map((x) => Math.round(x));
  const rel = (p) => [p[0] / h, (p[1] - floor) / h, p[2] / h].map((x) => +x.toFixed(3));
  const r3 = (v) => v.map((x) => +x.toFixed(2));
  console.log(`  ${body} ${k}: shoulder ${rel(m.shoulder)} elbow ${rel(m.elbow)} fist ${rel(m.fist)} chisel top ${rel(m.top)} | face ${r3(m.x)} haft ${r3(m.y)} forearm ${r3(unit(sub(m.fist, m.elbow)))}`);
  return { arm: Object.fromEntries(Object.entries(best.arm).map(([b, e]) => [b, r1(e)])), cm: +(Math.hypot(...sub(m.face, target)) * cm).toFixed(1), elbowCm: +(Math.acos(1 - poleOff(m)) * 180 / Math.PI).toFixed(0), face: +deg(dot(m.x, unit(want.face))).toFixed(0), way: +deg(dot(m.y, unit(want.way))).toFixed(0) };
}

const keys = opt('keys', 'impact,rest,rise,top,strike,over,smear').split(','), bodies = opt('body', 'both') === 'both' ? ['man', 'woman'] : [opt('body')];
if (!args.includes('--check')) for (const body of bodies) {
  const out = {};
  // in the clip's order from the blow, each from the one before
  let prev = null;
  for (const k of keys) { const r = solveKey(body, k, prev); prev = r.arm; out[k] = r.arm; console.log(`${body} ${k}: off ${r.cm} cm, elbow ${r.elbowCm}° off its side, face ${r.face}°, haft ${r.way}°`); }
  console.log(`${body} ARMS:`, JSON.stringify(out).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w)/g, ', '));
}
// the clip as it is: the mallet's face from the chisel's top through the blow, both bodies
for (const body of ['man', 'woman']) {
  const sk = T.lowSkeleton(body), cm = (180 * (body === 'woman' ? 0.85 : 1)) / sk.height, row = [];
  for (const t of [W.IMPACT - 0.04, W.IMPACT - 0.02, W.IMPACT, W.IMPACT + 0.02]) {
    const r = T.clipLocal(sk, WORK, t, undefined, (id) => T.lowToolHeld(body, id)), m = measure(body, sk, r.local, r.move);
    // above the top along the chisel (negative: into it), and off its line
    const d = sub(m.face, m.top), along = dot(d, unit(m.chisel)), off = Math.hypot(...sub(d, scl(unit(m.chisel), along)));
    row.push(`t ${t.toFixed(2)}: ${(along * cm).toFixed(1)} above, ${(off * cm).toFixed(1)} off`);
  }
  console.log(`${body} clip, face to the chisel's top (cm): ${row.join('; ')}`);
  // the left fist against where it is wanted (it falls short where the arm cannot reach)
  const floor = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets', body === 'woman' ? 'lowfemale.json' : 'lowmale.json'), 'utf8')).floor;
  const short = [0, 0.2, 0.4, 0.6, 0.8].map((t) => { const r = T.clipLocal(sk, WORK, t, undefined, (id) => T.lowToolHeld(body, id)), m = measure(body, sk, r.local, r.move); const d = WORK.bodies?.[body]?.hands?.l ?? [0, 0, 0]; return (Math.hypot(...sub(m.left, [(W.HOLD[0] + d[0]) * sk.height, floor + (W.HOLD[1] + d[1]) * sk.height, (W.HOLD[2] + d[2]) * sk.height])) * cm).toFixed(1); });
  console.log(`${body} left fist off its place (cm, t 0 0.2 0.4 0.6 0.8): ${short.join(' ')}`);
}
