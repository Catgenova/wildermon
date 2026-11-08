// The plate set's fur mantle (tools/sculpt/garments/mantle.mjs) on the low-poly bodies, looked over against its sheet and
// in the rig's poses:
//
//   node tools/sculpt/lowmantleshot.mjs --out <dir> [--only sheet,wire,poses,metrics] [--sheet <mantle sheet png>]
//        [--tag <name>] [--tunic] [--room]
//     mantle-sheet<tag>.png: the sheet's five worn views (front, three-quarter, side, back, rear three-quarter) of each
//       body beside the model's at the sheet's framing, and the shoulders close up below;
//     mantle-wire<tag>.png: the close-ups with every polygon's outline, the triangle counts by part;
//     mantle-poses<tag>.png: rest, arms out, forward and overhead, the game's walk and idle, each with the mantle's
//       triangles crossing the body's and its own;
//     mantle-metrics.json: the checks at rest and in every pose, each body.
//   --tunic: worn over the first outfit's tunic (garments/outfit1.mjs), fitted over it, the tunic drawn;
//   --room: the fitting room for the chest piece drawn as a grey shell (its collar and pauldrons, garments/mantle.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs } from './lowgarment.mjs';
import { buildMantle, mantleWeights, MATS, GLOW, DESIGN } from './garments/mantle.mjs';
import { shoot, closeBrowser } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowmantle'));
const only = opt('only', 'sheet,wire,metrics').split(',');
const tag = opt('tag', '');
const SHEET = resolve(opt('sheet', '/tmp/claude-0/-home-user-Wurm/781c435a-4202-5724-9056-b83f4c44c414/scratchpad/plate/mantle/mantle-sheet.png'));
const over = JSON.parse(opt('design', '{}'));
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  let under = [], tunic = null;
  if (flag('tunic')) { const { buildOutfit } = await import('./garments/outfit1.mjs'); const O = buildOutfit(rig); tunic = O.tunic; under = [O.tunic]; tunic.hides = O.hides; }
  const G = buildMantle(rig, { ...DESIGN[who], ...over }, { under });
  G.vw = mantleWeights(rig, G);
  M[who] = { rig, G, tunic };
}
const bodyMesh = (rig, P, hidden = new Set()) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const garMesh = (rig, G, P, mats, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (GLOW.includes(p.mat) ? mats[p.mat].map((x) => x + 2) : mats[p.mat])), edges, edgec: [0.25, 0.16, 0.12] });

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'overhead', label: 'Arms overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: u * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[rig.who] = { at });
}
function dress(who, pose) {
  const { rig, G, tunic } = M[who];
  const f = posed(rig, pose);
  return { PB: skin(rig, f), PG: skinGarment(rig, f, G), PT: tunic ? skinGarment(rig, f, tunic) : null };
}
const scene = (who, d, o = {}) => {
  const { rig, G, tunic } = M[who];
  const m = [bodyMesh(rig, d.PB, tunic ? new Set(tunic.hides.tunic) : new Set())];
  if (tunic) m.push(garMesh(rig, tunic, d.PT, { fabric: [0.72, 0.62, 0.56], trim: [0.603, 0.421, 0.294], inner: [0.51, 0.356, 0.268], pattern: [0.72, 0.62, 0.56] }));
  m.push(garMesh(rig, G, d.PG, MATS, o.edges));
  return m;
};
function measure(who, d) {
  const { rig, G, tunic } = M[who];
  const c = checks(G, d.PG, rig.B, d.PB);
  const r = { tris: c.tris, body: c.body, self: c.self, bodyParts: c.bodyParts, selfParts: c.selfParts, open: c.open, nonManifold: c.nonManifold, offPlane: c.offPlane };
  if (tunic) r.tunic = crossPairs(d.PG, G.tris, d.PT, tunic.tris).length;
  return r;
}

/* ---- the sheet: five views beside the sheet's ------------------------------------------------------------------------- */
// the sheet's worn views (mantle-sheet.png, 1536 x 1024): his row at y 95..340, hers at 440..660; in the sheet's order
const VIEWS = [[0, 'Front (0°)'], [-45, 'Three-quarter (45°)'], [-90, 'Side (90°)'], [180, 'Back (180°)'], [-135, 'Rear three-quarter (135°)']];
const CROPS = { male: [[20, 95, 195, 245], [215, 95, 185, 245], [398, 95, 122, 245], [515, 95, 150, 245], [660, 95, 155, 245]], female: [[20, 438, 195, 225], [215, 438, 185, 225], [395, 438, 122, 225], [515, 438, 150, 225], [655, 438, 160, 225]] };
async function sheet(file, edges) {
  const cw = 230, ch = 290, cc = 270, top = 34, cells = [], imgs = [], texts = [];
  let y = top;
  for (const who of ['male', 'female']) {
    const d = dress(who, {}), sc = who === 'male' ? 1 : 0.85;
    VIEWS.forEach(([yaw, lab], i) => {
      if (!edges) imgs.push({ src: SHEET, size: [1536, 1024], crop: CROPS[who][i], box: [i * cw, y, cw, ch] });
      // the sheet's figures are framed by their shoulders (its heads are larger than the bodies'): his deltoids 4.1 units, 177 px
      if (!edges) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 0, s: 34 / sc, c: [0, -2.0, 0] }, box: [i * cw, y + ch, cw, ch], label: `${who} ${lab}` });
      cells.push({ meshes: scene(who, d, { edges }), cam: { yaw, pitch: edges ? 12 : 6, s: 50 / sc, c: [0, -1.0, 0] }, box: [i * cw, y + (edges ? 0 : 2 * ch), cw, cc], label: edges ? `${who} ${lab}` : 'close' });
    });
    const G = M[who].G, parts = {};
    for (const t of G.tris) { const p = G.polys[t.poly].part; parts[p] = (parts[p] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${y + 10}px;white-space:normal;width:200px`, html: `<b>${who}</b><br>${G.tris.length} triangles<br>` + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join('<br>') + (edges ? '' : '<br><br>rows: the sheet, the model at the sheet\'s framing, close up') });
    y += edges ? cc : 2 * ch + cc;
  }
  if (!edges) imgs.push({ src: SHEET, size: [1536, 1024], crop: [828, 92, 400, 345], box: [5 * cw, y - 330, 220, 300] });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', `The fur mantle on both low-poly bodies${flag('tunic') ? ', over the tunic' : ''}: ${edges ? 'the polygons' : 'the sheet\'s five views above the model\'s'} ${tag}`) });
  await shoot(5 * cw + 220, y + 6, cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `mantle-sheet${tag}.png`), false);
if (only.includes('wire')) await sheet(join(out, `mantle-wire${tag}.png`), true);

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
if (only.includes('poses')) {
  const cw = 230, ch = 270, cells = [];
  let row = 0;
  for (const who of ['male', 'female']) {
    const { rig } = M[who], g = await game(rig);
    const list = [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(rig), { id: 'walk', label: 'Walk 1/4', pose: g.at(true, 0.25) }, { id: 'walk2', label: 'Walk 3/4', pose: g.at(true, 0.75) }, { id: 'idle', label: 'Idle', pose: g.at(false, 0.3) }];
    for (const [yi, yaw] of [[0, -30], [1, -150]]) {
      list.forEach((e, k) => {
        const d = dress(who, e.pose), m = measure(who, d);
        cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 8, s: 46, c: [0, e.id === 'overhead' ? -0.4 : -1.2, 0] }, box: [k * cw, 34 + row * ch, cw, ch], label: `${who} ${e.label} · body ${m.body} self ${m.self}${m.tunic != null ? ' tunic ' + m.tunic : ''}` });
      });
      row++;
    }
  }
  await shoot(7 * cw, 34 + row * ch, cells, join(out, `mantle-poses${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The fur mantle in poses ${tag}: the numbers, its triangles crossing the body's and its own` }] });
}

/* ---- metrics -------------------------------------------------------------------------------------------------------- */
if (only.includes('metrics')) {
  const metrics = {};
  for (const who of ['male', 'female']) {
    const { rig } = M[who], g = await game(rig);
    const list = [{ id: 'rest', pose: {} }, ...testPoses(rig), ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 16) })), ...Array.from({ length: 12 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, k / 12) }))];
    metrics[who] = {};
    for (const e of list) metrics[who][e.id] = measure(who, dress(who, e.pose));
    const r = metrics[who].rest;
    console.log(who, `tris ${r.tris} open ${r.open} nonManifold ${r.nonManifold} offPlane ${r.offPlane}`, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.body}/${v.self}${v.tunic != null ? '/' + v.tunic : ''}`).join(' '));
  }
  writeFileSync(join(out, `mantle-metrics${tag}.json`), JSON.stringify(metrics, null, 1));
}
await closeBrowser();
