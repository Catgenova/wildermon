// The low-poly bodies' feet looked over (tools/sculpt/lowlegs.mjs `long`, the feet drawn out along their own line):
// each body bare, its rest pose, beside the references, and against an earlier body (a dump of the rig's mesh) when given.
//
//   node tools/sculpt/lowfeetshot.mjs --out <dir> [--tag <name>] [--before <bodies.json>] [--only measure,legs,body]
//     feet-<tag>-measure.png: both bodies' feet side on and three-quarter, the leg sheets' own beside them, the numbers
//       (heel to toe against the head's height H, the body's height and the shin);
//     feet-<tag>-legs-<who>.png: the leg sheet's five views (0, 45, 90, 135, 180) above the body's legs in the same views,
//       then the feet close up; with --before each model row twice, before and after;
//     feet-<tag>-body.png: both bodies whole, front, three-quarter, side, beside their full-body references.
//   --as-before: the --before bodies alone (the model as it was).
//   --dump <file>: writes the bodies as they are now (for a later --before) and stops.
//
// The renderer is tools/sculpt/lowgarmentshot.mjs's (the bodies' flat shading and camera-fixed light).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRig } from './lowrig.mjs';
import { shoot, closeBrowser, SKIN } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const DIR = new URL('.', import.meta.url).pathname;

/** A body as the rig builds it: its rest mesh, joints and measures. */
function bodyOf(who) {
  const { B, J } = buildRig(who);
  return { verts: B.verts, polys: B.polys.map((p) => ({ v: p.nv ?? p.v, mat: p.mat, part: p.part })), tris: B.tris.map((t) => [...t.v, t.poly]), J, names: B.names };
}
const dump = opt('dump', null);
if (dump) {
  writeFileSync(dump, JSON.stringify({ male: bodyOf('male'), female: bodyOf('female') }));
  console.log('wrote', dump);
  process.exit(0);
}
const out = resolve(opt('out', 'tmp/lowfeet'));
const tag = opt('tag', 'x');
const only = opt('only', 'measure,legs,body').split(',');
mkdirSync(out, { recursive: true });
let NOW = { male: bodyOf('male'), female: bodyOf('female') };
let BEFORE = opt('before', null) ? JSON.parse(readFileSync(opt('before'), 'utf8')) : null;
// --as-before: the earlier body alone, as it was
if (args.includes('--as-before')) { NOW = BEFORE; BEFORE = null; }

/** Heel to toe along the foot's own line, the head's height (the chin's underside, y 0, to the crown), the height, the shin. */
export function measures(b) {
  const at = (n) => b.verts[b.names.indexOf(n)];
  const mid = (p, q) => [(at(p)[0] + at(q)[0]) / 2, (at(p)[2] + at(q)[2]) / 2];
  const h = mid('ft3.L', 'ft4.L'), t = mid('ft0.L', 'ft1.L'), l = Math.hypot(t[0] - h[0], t[1] - h[1]), a = [(t[0] - h[0]) / l, (t[1] - h[1]) / l];
  const u = ['ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5'].map((n) => { const p = at(`${n}.L`); return (p[0] - h[0]) * a[0] + (p[2] - h[1]) * a[1]; });
  const foot = Math.max(...u) - Math.min(...u), ball = ((u[2] + u[5]) / 2 - Math.min(...u)) / foot;
  const crown = Math.max(...b.verts.map((p) => p[1])), H = crown, height = crown - b.J.floor;
  const shin = Math.hypot(...b.J.knee.map((v, i) => v - b.J.ankle[i]));
  return { foot, H, height, shin, ball, 'foot/H': foot / H, 'foot/height': foot / height, 'foot/shin': foot / shin };
}
const r2 = (x) => x.toFixed(2), r3 = (x) => x.toFixed(3);
const mesh = (who, b, cut = Infinity, col = SKIN) => {
  // below the cut, the arms and the hands left out (they hang beside the legs)
  const keep = b.polys.map((p) => (cut === Infinity || !['arm', 'hand', 'joint'].includes(p.part)) && p.v.every((i) => b.verts[i][1] < cut));
  return { who, P: b.verts, polys: b.polys.map((p) => p.v), tris: b.tris.filter((t) => keep[t[3]]), col: b.polys.map((p) => (p.mat === 'skin' ? col : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const LEGS = { male: join(DIR, 'ref/legs-lowpoly-male.png'), female: join(DIR, 'ref/legs-lowpoly-female.png') };
const LSIZE = { male: [1536, 1024], female: [1448, 1086] };
// the leg sheets' top row (front, three-quarter, profile, rear three-quarter, back) and the single leg's profile
const LCROP = {
  male: [[70, 40, 210, 335], [300, 40, 210, 335], [530, 40, 170, 335], [710, 40, 230, 335], [935, 40, 200, 335]],
  female: [[70, 60, 175, 310], [280, 60, 185, 310], [500, 60, 150, 310], [665, 60, 205, 310], [880, 60, 185, 310]],
};
const LFEET = {
  male: [[70, 290, 210, 85], [300, 290, 210, 85], [530, 290, 170, 85], [710, 290, 230, 85], [935, 290, 200, 85]],
  female: [[70, 290, 175, 85], [280, 290, 185, 85], [500, 290, 150, 85], [665, 290, 205, 85], [880, 290, 185, 85]],
};
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Profile (90°)'], [-135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];

/* ---- the numbers and the feet side on --------------------------------------------------------------------------- */
if (only.includes('measure')) {
  const cw = 260, ch = 230, top = 40, cells = [], imgs = [], texts = [];
  const LINEUP = join(DIR, 'ref/outfit1-lineup.png'), PLATE = opt('plate', join(tmpdir(), 'plate/plate-lineup.png'));
  const nm = BEFORE ? 2 : 1, W = (4 + 2 * nm) * cw;
  ['male', 'female'].forEach((who, r) => {
    const y0 = top + r * (ch + 110);
    imgs.push({ src: LEGS[who], size: LSIZE[who], crop: who === 'male' ? [540, 210, 160, 165] : [505, 200, 140, 170], box: [0, y0, cw, ch] });
    imgs.push({ src: LEGS[who], size: LSIZE[who], crop: who === 'male' ? [300, 210, 210, 165] : [280, 200, 185, 170], box: [cw, y0, cw, ch] });
    // the lineups' three-quarter figure's near foot (the outfit's and the plate set's)
    imgs.push({ src: LINEUP, size: [1482, 1061], crop: who === 'male' ? [835, 800, 180, 200] : [1180, 820, 150, 180], box: [2 * cw, y0, cw, ch] });
    imgs.push({ src: PLATE, size: [1482, 1061], crop: who === 'male' ? [820, 800, 180, 200] : [1170, 820, 150, 180], box: [3 * cw, y0, cw, ch] });
    const sets = BEFORE ? [['before', BEFORE[who]], ['after', NOW[who]]] : [['now', NOW[who]]];
    sets.forEach(([lab, b], k) => {
      const c = [b.J.ankle[0], b.J.floor + 1.05, 0.2];
      const leg = { ...mesh(who, b, b.J.floor + 2.6) }; leg.tris = leg.tris.filter((t) => [0, 1, 2].every((j) => b.verts[t[j]][0] > 0.15));
      cells.push({ meshes: [leg], cam: { yaw: -90, pitch: -8, s: 92, c }, box: [(4 + k) * cw, y0, cw, ch], label: `${who} ${lab}, profile` });
      cells.push({ meshes: [leg], cam: { yaw: -45, pitch: -8, s: 92, c }, box: [(4 + nm + k) * cw, y0, cw, ch], label: `${who} ${lab}, three-quarter` });
    });
    const line = (lab, b) => { const m = measures(b); return `${lab}: heel to toe ${r2(m.foot)} = <b>${r3(m['foot/H'])} H</b>, <b>${r3(m['foot/height'])}</b> of the height, ${r3(m['foot/shin'])} of the shin; the ball at ${r2(m.ball)} of the foot (H ${r2(m.H)}, height ${r2(m.height)}, shin ${r2(m.shin)})`; };
    texts.push({ cls: 'lab', css: `left:10px;top:${y0 + ch + 6}px;white-space:normal;width:${W - 20}px`, html: `<b>${who}</b>: the leg sheet's profile and three-quarter, the outfit lineup's and the plate lineup's three-quarter foot; the model's. ` + (BEFORE ? line('before', BEFORE[who]) + '<br>' + line('after', NOW[who]) : line('now', NOW[who])) + '<br>' + (opt('target', '') ? `target: ${opt('target')}` : '') });
  });
  texts.push({ css: 'left:10px;top:6px', html: `Feet, ${tag}: heel to toe against the head's height H (chin to crown), the body's height (sole to crown) and the shin (knee to ankle joint)` });
  await shoot(W, top + 2 * (ch + 110), cells, join(out, `feet-${tag}-measure.png`), { texts, imgs });
}

/* ---- the legs in the leg sheet's five views, and the feet close up -------------------------------------------------- */
if (only.includes('legs')) for (const who of ['male', 'female']) {
  const cw = 230, ch = 330, fh = 170, top = 34, cells = [], imgs = [], texts = [];
  const sets = BEFORE ? [['before', BEFORE[who]], ['after', NOW[who]]] : [['now', NOW[who]]];
  const b0 = NOW[who], floor = b0.J.floor, belt = -3.95;
  const s = (ch - 30) / (belt - floor + 0.6), c = [0, (belt + floor) / 2 - 0.15, 0];
  let y = top;
  VIEWS.forEach(([, lab], i) => imgs.push({ src: LEGS[who], size: LSIZE[who], crop: LCROP[who][i], box: [i * cw, y, cw, ch] }));
  texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${y + 10}px`, html: 'the leg sheet' });
  y += ch;
  for (const [lab, b] of sets) {
    VIEWS.forEach(([yaw, vl], i) => cells.push({ meshes: [mesh(who, b, belt)], cam: { yaw, pitch: -6, s, c }, box: [i * cw, y, cw, ch], label: i ? '' : `${who} ${lab}` }));
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${y + 10}px;white-space:normal;width:220px`, html: `<b>${lab}</b><br>heel to toe ${r3(measures(b)['foot/H'])} H, ${r3(measures(b)['foot/height'])} of the height` });
    y += ch;
  }
  VIEWS.forEach(([, lab], i) => imgs.push({ src: LEGS[who], size: LSIZE[who], crop: LFEET[who][i], box: [i * cw, y, cw, fh] }));
  y += fh;
  for (const [lab, b] of sets) {
    const fc = [0, floor + 0.9, 0.25];
    VIEWS.forEach(([yaw], i) => cells.push({ meshes: [mesh(who, b, floor + 2.2)], cam: { yaw, pitch: -10, s: 46, c: fc }, box: [i * cw, y, cw, fh], label: i ? '' : `${lab}, the feet` }));
    y += fh;
  }
  texts.push({ css: 'left:10px;top:6px', html: `Feet, ${tag}, ${who}: the leg sheet (${who === 'male' ? 'legs-lowpoly-male.png' : 'legs-lowpoly-female.png'}) above, the model's legs in its five views` + (BEFORE ? ', before and after' : '') + '; then the feet close up' });
  await shoot(5 * cw + 240, y, cells, join(out, `feet-${tag}-legs-${who}.png`), { texts, imgs });
}

/* ---- both bodies whole --------------------------------------------------------------------------------------------- */
if (only.includes('body')) {
  const cw = 165, ch = 520, top = 34, cells = [], imgs = [], texts = [];
  const V3 = [[0, 'front'], [-45, 'three-quarter'], [-90, 'side'], [-135, 'rear three-quarter'], [180, 'back']];
  let w = 0;
  ['male', 'female'].forEach((who, r) => {
    const y = top + r * ch;
    let x = 0;
    imgs.push({ src: join(DIR, `ref/body-${who}.png`), size: [887, 1774], crop: [0, 0, 887, 1774], box: [x, y, 260, ch] });
    x += 260;
    const sets = BEFORE ? [['before', BEFORE[who]], ['after', NOW[who]]] : [['now', NOW[who]]];
    const b0 = NOW[who], floor = b0.J.floor, crown = Math.max(...b0.verts.map((p) => p[1]));
    const s = (ch - 40) / (crown - floor), c = [0, (crown + floor) / 2, 0];
    V3.forEach(([yaw, vl]) => {
      for (const [lab, b] of sets) { cells.push({ meshes: [mesh(who, b)], cam: { yaw, pitch: -4, s, c }, box: [x, y, cw, ch], label: `${vl === 'rear three-quarter' ? 'rear 3/4' : vl === 'three-quarter' ? '3/4' : vl} ${lab}` }); x += cw; }
    });
    w = Math.max(w, x);
  });
  texts.push({ css: 'left:10px;top:6px', html: `Feet, ${tag}: both bodies whole beside their full-body references` + (BEFORE ? ', each view before and after' : '') });
  await shoot(w, top + 2 * ch, cells, join(out, `feet-${tag}-body.png`), { texts, imgs });
}
await closeBrowser();
