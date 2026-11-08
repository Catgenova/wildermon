// The sacred plate helm (tools/sculpt/garments/helm.mjs) on the low-poly bodies, looked over against the helm sheet and in
// the rig's poses:
//
//   node tools/sculpt/lowhelmshot.mjs --out <dir> [--only sheet,close,wire,poses,walk,metrics] [--sheet <helm sheet png>]
//        [--tag <name>] [--title <text>] [--head] [--enchanted]
//     helm-sheet<tag>.png: the sheet's five views (0, 45, 90, 135, 180) of each body's helm beside the model's, his above
//       hers (--head: the head drawn too, not hidden; --enchanted: the plain and the enchanted look side by side);
//     helm-close<tag>.png: front, three-quarter and profile at twice the scale, the sheet's beside each (closeback:
//       profile, rear three-quarter and back, helm-closeback<tag>.png);
//     helm-wire<tag>.png: the sheet's views with every polygon's outline, and the triangle counts by piece;
//     helm-poses<tag>.png: the test poses (arms out, forward, overhead, head turned 40 and 70, nodded down and back, the
//       game's walk and the idle's look), each with the helm's triangles crossing the body's;
//     helm-walk<tag>.gif: the game's walk, both bodies, front, three-quarter, side, back;
//     helm-metrics.json: the checks at rest and in every pose, each body: the helm against the body (the head hidden
//       under it left out), itself, and the body's points inside it.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs, garmentAsset, bonesWith } from './lowgarment.mjs';
import { buildHelm, helmWeights, MATS, LOOKS } from './garments/helm.mjs';
import { shoot, closeBrowser, LOOKS as LOOKS_SHOWN, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowhelm'));
const only = opt('only', 'sheet,close,wire,poses,walk,metrics').split(',');
const tag = opt('tag', '');
const SHEET = resolve(opt('sheet', '/tmp/claude-0/-home-user-Wurm/781c435a-4202-5724-9056-b83f4c44c414/scratchpad/plate/helm/helm-sheet.png'));
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
// the two looks' colours by material, as the page draws them (lowgarmentshot.mjs lookColour: an unlit one as its colour + 2)
const LOOK = Object.fromEntries(['plain', 'enchanted'].map((look) => [look, Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, lookColour(LOOKS[look][k] ? (Array.isArray(LOOKS[look][k]) ? { c: LOOKS[look][k], kind: 0 } : LOOKS[look][k]) : { c, kind: 0 })]))]));
const ENCH = LOOKS_SHOWN.length > 1;
const COL = LOOK.plain;
const bodyMesh = (rig, P, hide) => {
  const keep = rig.B.polys.map((_, pi) => !hide?.has(pi));
  return { who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((t) => keep[t.poly]).map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const garMesh = (rig, G, P, mats, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => mats[p.mat]), edges, edgec: [0.2, 0.12, 0.1] });

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildHelm(rig);
  G.vw = helmWeights(rig, G);
  M[who] = { rig, G, hide: new Set(G.hides) };
}

/* ---- checks ----------------------------------------------------------------------------------------------------------- */
function measure(who, d) {
  const { rig, G, hide } = M[who];
  // the body less the head hidden under the helm
  const body = { tris: rig.B.tris.filter((t) => !hide.has(t.poly)), part: rig.B.part };
  const c = checks(G, d.PG, body, d.PB);
  return { tris: c.tris, body: c.body, self: c.self, bodyParts: c.bodyParts, selfParts: c.selfParts, offPlane: c.offPlane, open: c.open, nonManifold: c.nonManifold };
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'overhead', label: 'Arms overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
    { id: 'turn40', label: 'Head turned 40°', pose: { neck_01: [0, 7, 0], neck_02: [0, 7, 0], head: [0, 26, 0] } },
    { id: 'turn40r', label: 'Head turned 40° right', pose: { neck_01: [0, -7, 0], neck_02: [0, -7, 0], head: [0, -26, 0] } },
    { id: 'turn70', label: 'Head turned 70°', pose: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] } },
    { id: 'nod', label: 'Nod down 40°', pose: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } },
    { id: 'nod24', label: 'Nod down 24°', pose: { neck_01: [7, 0, 0], neck_02: [8, 0, 0], head: [9, 0, 0] } },
    { id: 'nodup', label: 'Head back 20°', pose: { neck_01: [-6, 0, 0], neck_02: [-7, 0, 0], head: [-7, 0, 0] } },
    { id: 'turnnod', label: 'Turned 40°, nodded 24°', pose: { neck_01: [8, 7, 0], neck_02: [8, 7, 0], head: [8, 26, 0] } },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const g = await gameRig(rig, join(out, 'game'));
  const at = (moving, u, t) => fromGame(rig, g.bonesOf(g.sculptRig({ phase: moving ? u * Math.PI * 2 : t * 6, moving, facing: 0, swimming: false, working: false, look: g.look }).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest);
  return (games[rig.who] = { at });
}
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), dy, f };
}
const scene = (who, d, o = {}) => {
  const { rig, G, hide } = M[who];
  return [bodyMesh(rig, d.PB, flag('head') ? null : hide), garMesh(rig, G, d.PG, o.look ? LOOK[o.look] : COL, o.edges)];
};

/* ---- the sheet: five views beside the sheet's ------------------------------------------------------------------------- */
// the sheet's views (helm-sheet.png, 1672 x 941): his five centred at these x, hers at these; the bust between y 100 and 290
const VIEWS = [[0, 'Front (0°)'], [45, 'Three-quarter (45°)'], [90, 'Side (90°)'], [135, 'Rear three-quarter (135°)'], [180, 'Back (180°)']];
const SX = { male: [110, 276, 446, 606, 746], female: [945, 1082, 1265, 1425, 1580] };
const SIZE = [1672, 941], CROP = [150, 200], CY = 98;
const rest = (who) => { const d = dress(who, {}); return { PB: d.PB.map((p) => [p[0], p[1] - d.dy, p[2]]), PG: d.PG.map((p) => [p[0], p[1] - d.dy, p[2]]) }; };
async function sheet(file, edges) {
  const cw = 250, ch = 330, top = 34, cells = [], imgs = [], texts = [], R = 1 + LOOKS_SHOWN.length;
  ['male', 'female'].forEach((who, r) => {
    const d0 = rest(who);
    VIEWS.forEach(([yaw, lab], i) => {
      imgs.push({ src: SHEET, size: SIZE, crop: [SX[who][i] - CROP[0] / 2, CY, ...CROP], box: [i * cw, top + r * R * ch, cw, ch] });
      LOOKS_SHOWN.forEach((look, l) => cells.push({ meshes: scene(who, d0, { edges, look }), cam: { yaw, pitch: 0, s: 66, c: [0, 0.5, 0] }, box: [i * cw, top + (r * R + 1 + l) * ch, cw, ch], label: `${who} ${lab}${ENCH ? ` · ${look}` : ''}` }));
    });
    const byTag = {};
    for (const t of M[who].G.tris) { const g = (M[who].G.polys[t.poly].tag ?? '?').replace(/ [LR]$/, ''); byTag[g] = (byTag[g] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + r * R * ch + 10}px`, html: `${who}: the sheet ↑` });
    texts.push({ cls: 'lab', css: `left:${5 * cw + 10}px;top:${top + (r * R + 1) * ch + 10}px`, html: `${who}: the model ↓${ENCH ? ' (plain, then enchanted)' : ''}<br>${M[who].G.tris.length} triangles${edges ? '<br>' + Object.entries(byTag).map(([k, v]) => `${k} ${v}`).join('<br>') : ''}` });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The helm on both low-poly bodies: the sheet\'s five views above each body\'s') });
  await shoot(5 * cw + 220, top + 2 * R * ch, cells, file, { texts, imgs });
}
/** Close: each body's front, three-quarter and profile at twice the sheet's scale, the sheet's beside each (with --enchanted, both looks). */
async function close(file, edges, which = [0, 1, 2]) {
  const cw = 360, ch = 470, top = 34, cells = [], imgs = [], texts = [], K = 1 + LOOKS_SHOWN.length;
  ['male', 'female'].forEach((who, r) => {
    const d0 = rest(who);
    which.forEach((i, n) => {
      const [yaw, lab] = VIEWS[i];
      imgs.push({ src: SHEET, size: SIZE, crop: [SX[who][i] - CROP[0] / 2, CY, ...CROP], box: [n * K * cw, top + r * ch, cw, ch] });
      LOOKS_SHOWN.forEach((look, l) => cells.push({ meshes: scene(who, d0, { edges, look }), cam: { yaw, pitch: 0, s: 116, c: [0, 0.75, 0] }, box: [(n * K + 1 + l) * cw, top + r * ch, cw, ch], label: `${who} ${lab}${ENCH ? ` · ${look}` : ''}` }));
    });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', `The helm close: the sheet's ${which.map((i) => VIEWS[i][1]).join(', ')} beside each body's`) });
  await shoot(K * which.length * cw, top + 2 * ch, cells, file, { texts, imgs });
}
if (only.includes('close')) await close(join(out, `helm-close${tag}.png`), false);
if (only.includes('closeback')) await close(join(out, `helm-closeback${tag}.png`), false, [2, 3, 4]);
if (only.includes('sheet')) await sheet(join(out, `helm-sheet${tag}.png`), false);
if (only.includes('wire')) await sheet(join(out, `helm-wire${tag}.png`), true);

/* ---- poses and metrics ------------------------------------------------------------------------------------------------- */
const metrics = {};
if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who];
    const g = await game(rig);
    const list = [{ id: 'rest', pose: {} }, ...testPoses(rig),
      ...Array.from({ length: 8 }, (_, k) => ({ id: `walk-${k}`, pose: g.at(true, k / 8) })),
      ...Array.from({ length: 16 }, (_, k) => ({ id: `idle-${k}`, pose: g.at(false, 0, k + 0.5) }))];
    metrics[who] = {};
    for (const e of list) { const d = dress(who, e.pose); metrics[who][e.id] = measure(who, d); }
    console.log(who, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.body}/${v.self}`).join(' '));
    metrics[who].bones = { body: rig.bones.length, garment: (G.bones ?? []).length, total: bonesWith(rig, G).length };
    writeFileSync(join(out, `helm-${who}.json`), JSON.stringify(garmentAsset(rig, G, MATS, LOOKS)));
  }
  writeFileSync(join(out, 'helm-metrics.json'), JSON.stringify(metrics, null, 1));
}
if (only.includes('poses')) {
  const cells = [], cw = 230, ch = 300, perRow = 6;
  const rows = [];
  for (const who of ['male', 'female']) {
    const g = await game(M[who].rig);
    rows.push([who, [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(M[who].rig), { id: 'walk-2', label: 'Walk (3/8)', pose: g.at(true, 2 / 8) }, { id: 'idle-9', label: 'Idle look (t 9.5 s)', pose: g.at(false, 0, 9.5) }]]);
  }
  let n = 0;
  for (const [who, list] of rows) for (const e of list) {
    const d = dress(who, e.pose), m = metrics[who][e.id] ?? measure(who, d);
    for (const [j, yaw] of [[0, 0], [1, 60]]) {
      const k = n * 2 + j;
      cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 4, s: 42, c: [0, -0.4 + d.dy, 0] }, box: [(k % (perRow * 2)) * cw, 34 + Math.floor(k / (perRow * 2)) * ch, cw, ch], label: j ? `body ${m.body} self ${m.self}` : `${who} ${e.label}` });
    }
    n++;
  }
  const nr = Math.ceil((n * 2) / (perRow * 2));
  await shoot(perRow * 2 * cw, 34 + nr * ch, cells, join(out, `helm-poses${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: 'Test poses, front and 60°: the helm\'s triangles crossing the body\'s (the head under it hidden), and its own' }] });
}

/* ---- the walk ----------------------------------------------------------------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 200, ch = 420, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    for (const [j, yaw] of [[0, 0], [1, 40], [2, 90], [3, 180]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const g = await game(M[who].rig), d = dress(who, g.at(true, k / F)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG) }), cam: { yaw, pitch: 6, s: 27, c: [0, 7.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 8, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 3 // 4, f.height * 3 // 4)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `helm-walk${tag}.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `helm-walk${tag}.gif`));
}
await closeBrowser();
