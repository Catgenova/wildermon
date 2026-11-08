// The leather leggings (tools/sculpt/garments/leatherlegs.mjs) on the low-poly bodies, looked over against their sheet
// and in the rig's poses:
//
//   node tools/sculpt/lowleatherlegsshot.mjs --out <dir> [--stage 1..9] [--only sheet,wire,lineup,close,poses,walk,metrics]
//       [--neighbours <dir> --pieces leatherboots,leatherchest] [--enchanted]
//     leatherlegs-sheet-<who>.png: the sheet's five views (0, 45, 90, 135, 180) of that body's leggings above
//       (tools/sculpt/ref/leather-legs.png), the model below;
//     leatherlegs-wire-<who>.png: the same five views with the polygons' outlines, and the triangle counts;
//     leatherlegs-lineup.png: both bodies at the game's heights (she is 0.85 of him), front and three-quarter, the lineup above;
//     leatherlegs-close.png: the waist, the band, the knee and the cuff close up beside the sheet's key details, both bodies;
//     leatherlegs-poses.png: rest, idle, the walk's keys, the swing's guard, top and impact, arms out and forward, a deep
//       stride and knee up, front and side, each with the crossings (pieces / cloth / body);
//     leatherlegs-walk.gif: the game's walk, both bodies, front, three-quarter and side;
//     leatherlegs-metrics.json: the checks at rest and in every pose.
//   --stage: 1 the blockout (one colour), 2 to 3 shaped in one colour, 4 and on coloured.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig, posed, skin, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, crossPairs, bonesWith, offPlane, edgesOf } from './lowgarment.mjs';
import { leatherLegs, MATS, LOOKS as PIECE_LOOKS } from './garments/leatherlegs.mjs';
import { shoot, closeBrowser, LOOKS, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowleatherlegs'));
const stage = +opt('stage', '9');
const only = opt('only', 'sheet,wire,lineup,close,poses,walk,metrics').split(',');
const tag = opt('tag', '');
const NBDIR = opt('neighbours', ''), NEIGHBOURS = NBDIR ? opt('pieces', 'leatherboots,leatherchest').split(',') : [];
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SHEET = join(DIR, 'ref/leather-legs.png'), LINEUP = join(DIR, 'ref/leather-lineup.png');

const SKIN = [0.68, 0.49, 0.41];
// (the colours as drawn: before stage 4 the cloth in leather and the pieces laid on it in light leather)
const colOf = (m, look = 'plain') => (stage < 4 ? MATS.leather : lookColour(PIECE_LOOKS[look][m] ?? { c: MATS[m], kind: 0 }));
const bodyMesh = (rig, P, hide = null) => {
  const tris = rig.B.tris.filter((t) => !hide || !hide.has(t.poly));
  return { who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) };
};
const garMesh = (rig, G, P, edges = false, look = 'plain') => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => (stage < 4 && !['cloth', 'cuff'].includes(p.tag) ? MATS.light : colOf(p.mat, look))), edges });

const M = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  const G = leatherLegs(rig, { stage });
  // (the set's other pieces worn with them, from --neighbours <dir>: their game copies, low<piece>-<who>.json, each
  // skinned to the body's bones as the game skins it; the body's polygons any of them hides left out)
  const NB = NEIGHBOURS.map((n) => { const A = JSON.parse(readFileSync(join(NBDIR, `low${n}-${who}.json`), 'utf8')); return { name: n, A, verts: Array.from({ length: A.verts.length / 3 }, (_, i) => A.verts.slice(i * 3, i * 3 + 3)), tris: Array.from({ length: A.tris.length / 4 }, (_, t) => ({ v: A.tris.slice(t * 4, t * 4 + 3), poly: A.tris[t * 4 + 3] })) }; });
  const hide = new Set([...G.hides, ...NB.flatMap((n) => n.A.hides ?? [])]);
  const body = { ...rig.B, tris: rig.B.tris.filter((t) => !hide.has(t.poly)) };
  M[who] = { rig, G, hide, body, NB };
}
/** A game copy's vertices in a pose (frames from posed()): each its weights' bones' skinning, as the shader does. */
function skinAsset(rig, f, N) {
  return N.verts.map((v, i) => { const w = N.A.weights[i], q = [0, 0, 0]; for (let j = 0; j < w.length; j += 2) { const b = f[w[j]], h = rig.bones[w[j]].head, d = [v[0] - h[0], v[1] - h[1], v[2] - h[2]]; for (let c = 0; c < 3; c++) q[c] += w[j + 1] * (b.S[c * 3] * d[0] + b.S[c * 3 + 1] * d[1] + b.S[c * 3 + 2] * d[2] + b.P[c]); } return q; });
}

/**
 * The checks in a pose: the cloth's triangles crossing the body's (less the hidden), the pieces' (waistband, flaps, bands,
 * rivets) crossing the body's and the cloth's, and the cloth's and the pieces' own crossing each other.
 */
const plateTris = (G) => G.tris.filter((t) => !['cloth', 'cuff'].includes(G.polys[t.poly].tag));
const baseTris = (G) => G.tris.filter((t) => ['cloth', 'cuff'].includes(G.polys[t.poly].tag));
function crossings(who, PB, PG, PN = null) {
  const { G, body } = M[who], T = plateTris(G), Tb = baseTris(G);
  const clothBody = crossPairs(PG, Tb, PB, body.tris), withBody = crossPairs(PG, T, PB, body.tris), withBase = crossPairs(PG, T, PG, Tb);
  const self = crossPairs(PG, T), clothSelf = crossPairs(PG, Tb);
  const parts = {}, inc = (k) => { parts[k] = (parts[k] ?? 0) + 1; };
  for (const [i] of clothBody) inc(`${G.polys[Tb[i].poly].tag}×body`);
  for (const [i] of withBody) inc(`${G.polys[T[i].poly].tag}×body`);
  for (const [i] of withBase) inc(`${G.polys[T[i].poly].tag}×cloth`);
  for (const [i, j] of self) inc([G.polys[T[i].poly].tag, G.polys[T[j].poly].tag].sort().join('×'));
  for (const [i, j] of clothSelf) inc([G.polys[Tb[i].poly].tag, G.polys[Tb[j].poly].tag].sort().join('×') + ' (cloth)');
  const nb = {};
  (PN ?? []).forEach((P, k) => { const N = M[who].NB[k], x = crossPairs(PG, G.tris, P, N.tris); nb[N.name] = x.length; for (const [i, j] of x) inc(`${G.polys[G.tris[i].poly].tag}×${N.name}:${N.A.mats[N.A.polys[N.tris[j].poly][1]]}`); });
  return { body: clothBody.length + withBody.length, base: withBase.length, self: self.length + clothSelf.length, ...(PN ? { neighbours: nb } : {}), parts };
}
function restChecks(who) {
  const { G } = M[who], e = edgesOf(G);
  const byTag = {};
  for (const t of G.tris) { const k = G.polys[t.poly].tag; byTag[k] = (byTag[k] ?? 0) + 1; }
  return { tris: G.tris.length, byTag, offPlane: +Math.max(...G.polys.map((p) => offPlane(G.verts, p.v))).toFixed(4), open: e.open.length, nonManifold: e.nonManifold.length, hidden: M[who].hide.size, bones: bonesWith(M[who].rig, G).length, mats: [...new Set(G.polys.map((p) => p.mat))] };
}

/* ---- poses ---------------------------------------------------------------------------------------------------------- */
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
function testPoses(rig) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? I); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? I); return p; };
  const one = (p, bone, axis, deg) => { p[bone] = mm(W(bone, axis, deg), p[bone] ?? I); return p; };
  const P = [
    { id: 'tpose', label: 'Arms out', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
    { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
    { id: 'stride', label: 'Deep stride', pose: one(one(one(one({}, 'thigh_l', X, 55), 'calf_l', X, -35), 'thigh_r', X, -35), 'calf_r', X, -40) },
    { id: 'kneel', label: 'Knee up 80°', pose: one(one({}, 'thigh_l', X, 80), 'calf_l', X, -90) },
  ];
  if (rig.who === 'female') for (const e of P) e.pose = armsOut(rig, e.pose);
  return P;
}
// the game's clips (src/sculpt/anim) and their player, as the game runs them, bundled for Node: a clip's pose at a share
// u of it, onto the rig's control bones (as tools/sculpt/lowanim.mjs takes them); the swing with the long sword in hand
const AN = await (async () => {
  const { build } = await import('esbuild');
  const ROOT = new URL('../..', import.meta.url).pathname;
  const b = await build({ stdin: { contents: "export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';", resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT, loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' } });
  return import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
})();
const games = {};
async function game(rig) {
  if (games[rig.who]) return games[rig.who];
  const body = rig.who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
  const clipAt = (name, u) => {
    const clip = AN.CLIPS[name], r = AN.clipLocal(sk, clip, u * clip.length, clip.grip ? AN.lowHeld(body) : undefined), pose = { $move: r.move };
    r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
    return pose;
  };
  // (moving: the walk; else the idle, u over its whole loop)
  const at = (moving, u) => clipAt(moving ? 'walk' : 'idle', u);
  return (games[rig.who] = { at, clipAt, swing: AN.CLIPS.swing });
}
/** Body and leggings in a pose, stood on the floor as ground() stands the body. */
function dress(who, pose) {
  const { rig, G } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PN = M[who].NB.map((n) => skinAsset(rig, f, n));
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), PN: PN.map(sh), dy };
}
const nbMesh = (who, N, P, look) => ({ who, P, polys: N.A.polys.map((p) => p[0]), tris: N.tris.map((t) => [...t.v, t.poly]), col: N.A.polys.map((p) => { const L = N.A[look] ?? N.A.plain; return L ? lookColour(L[p[1]]) : N.A.colours[p[1]]; }) });
const scene = (who, d, { edges = false, look = 'plain' } = {}) => [bodyMesh(M[who].rig, d.PB, M[who].hide), garMesh(M[who].rig, M[who].G, d.PG, edges, look), ...(d.PN ?? []).map((P, k) => nbMesh(who, M[who].NB[k], P, look))];

/* ---- the sheet: five views against the reference --------------------------------------------------------------------- */
// (the sheet turns the figure to show its right side: our yaw the other way); its figures' waist tops and cuff feet
const VIEWS = [[0, 'Front (0°)', 123], [-45, 'Three-quarter (45°)', 297], [-90, 'Side (90°)', 444], [-135, 'Rear three-quarter (135°)', 594], [180, 'Back (180°)', 765]];
const SHEET_Y = { male: [103, 316], female: [413, 627] };
async function sheet(who, edges, file) {
  // (the model at the sheet's scale: its waistband's top to its cuff's foot over the sheet's, the waist where the sheet's is)
  const cw = 300, ch = 440, top = 34, d = dress(who, {}), D = M[who].G.design, k = ch / 250;
  const [ys0, ys1] = SHEET_Y[who], y0 = ys0 - 12, s = (ys1 - ys0) * k / (D.waist.top - D.cuff.foot), cy = D.waist.top - (ch / 2 - (ys0 - y0) * k) / s;
  const cells = [], imgs = [];
  const looks = edges ? ['plain'] : LOOKS;
  VIEWS.forEach(([yaw, lab, x], i) => {
    imgs.push({ src: SHEET, size: [1536, 1024], crop: [x - 85, y0, 170, 250], box: [i * cw, top, cw, ch] });
    looks.forEach((look, r) => cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] - d.dy, p[2]]), PG: d.PG.map((p) => [p[0], p[1] - d.dy, p[2]]), PN: d.PN.map((P) => P.map((p) => [p[0], p[1] - d.dy, p[2]])) }, { edges, look }), cam: { yaw, pitch: 0, s, c: [0, cy, 0] }, box: [i * cw, top + (ch + 24) * (r + 1), cw, ch], label: `${lab}${looks.length > 1 ? ', ' + look : ''}` }));
  });
  const c = restChecks(who);
  const texts = [{ css: 'left:10px;top:6px', html: `Leather leggings on the low-poly ${who}${tag ? ' — ' + tag : ''}: the sheet above, the model below; ${c.tris} triangles${edges ? ' (' + Object.entries(c.byTag).map(([k2, v]) => `${k2} ${v}`).join(', ') + ')' : ''}` }];
  await shoot(5 * cw, top + ch + (ch + 24) * looks.length, cells, file, { texts, imgs });
}
if (only.includes('sheet')) for (const who of ['male', 'female']) await sheet(who, false, join(out, `leatherlegs-sheet-${who}.png`));
if (only.includes('wire')) for (const who of ['male', 'female']) await sheet(who, true, join(out, `leatherlegs-wire-${who}.png`));

/* ---- the lineup: both bodies standing, the game's heights ----------------------------------------------------------- */
if (only.includes('lineup')) {
  const H = Math.round(1061 * 0.5), cw = 1482 * 0.5 / 4, top = 34;
  const cells = [], imgs = [{ src: LINEUP, size: [1482, 1061], crop: [0, 0, 1482, 1061], box: [0, top, 4 * cw, H] }];
  const sc = { male: 1, female: 0.85 };
  LOOKS.flatMap((look) => [['male', 0, look], ['female', 0, look], ['male', -40, look], ['female', -40, look]]).forEach(([who, yaw, look], i) => {
    const d = dress(who, {}), k = sc[who];
    const S = (P) => P.map((p) => [p[0] * k, (p[1] - M[who].rig.J.floor) * k, p[2] * k]);
    const s = H / 15.4;
    cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PN: d.PN.map(S) }, { look }), cam: { yaw, pitch: 0, s, c: [0, (H - 26) / 2 / s, 0] }, box: [i * cw, top + H + 20, cw, H], label: `${who} ${yaw ? '3/4' : 'front'}${LOOKS.length > 1 ? ', ' + look : ''}` });
  });
  await shoot(4 * cw * LOOKS.length, top + 2 * H + 20, cells, join(out, 'leatherlegs-lineup.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'The leather leggings on both bodies at the game\'s heights (she is 0.85 of him), the reference lineup above' }] });
}

/* ---- close up: the sheet's key details (waist, band, knee, cuff) beside the model's ---------------------------------- */
if (only.includes('close')) {
  const cw = 300, ch = 300, cells = [], imgs = [];
  const det = [[943, 165, 'Waist / hip', 0], [1101, 150, 'Diagonal band', -60], [943, 300, 'Knee fold', -20], [1101, 300, 'Cuff / ankle', 0]];
  const blockH = ch * (1 + LOOKS.length) + 10;
  ['male', 'female'].forEach((who, r) => {
    const d = dress(who, {}), D = M[who].G.design, kneeY = D.legs.find((q) => q.n === 'K').y;
    const at = [[0, D.waist.top - 0.75, 2.1], [D.band.y + 0.1, 2.4], [kneeY, 2.2], [(D.cuff.top + D.cuff.foot) / 2 - 0.1, 2.0]];
    det.forEach(([x, y, lab, yaw], k) => {
      imgs.push({ src: SHEET, size: [1536, 1024], crop: [x - 72, y - 66, 144, 132], box: [k * cw, 34 + r * blockH, cw, ch] });
      const [cy, span] = k === 0 ? [at[0][1], at[0][2]] : at[k];
      const cx = k === 0 ? 0 : 0.95;
      LOOKS.forEach((look, j) => cells.push({ meshes: scene(who, { PB: d.PB.map((p) => [p[0], p[1] - d.dy, p[2]]), PG: d.PG.map((p) => [p[0], p[1] - d.dy, p[2]]), PN: d.PN.map((P) => P.map((p) => [p[0], p[1] - d.dy, p[2]])) }, { look }), cam: { yaw, pitch: 4, s: ch / span, c: [cx * Math.cos(yaw * Math.PI / 180), cy, -cx * Math.sin(yaw * Math.PI / 180) * 0] }, box: [k * cw, 34 + r * blockH + ch * (j + 1), cw, ch], label: `${who} ${lab}${LOOKS.length > 1 ? ', ' + look : ''}` }));
    });
  });
  await shoot(4 * cw, 34 + 2 * blockH, cells, join(out, 'leatherlegs-close.png'), { imgs, texts: [{ css: 'left:10px;top:6px', html: 'Close up: the sheet\'s key details above each body\'s, the model below (the left leg; the waist from the front)' + (LOOKS.length > 1 ? ', plain then enchanted' : '') }] });
}

/* ---- metrics: every pose ------------------------------------------------------------------------------------------- */
const metrics = { stage, rest: {} };
async function poseList(who) {
  const { rig } = M[who], g = await game(rig);
  return [
    { id: 'rest', label: 'Rest', pose: {} },
    ...Array.from({ length: 8 }, (_, k) => ({ id: `idle-${k}`, label: `Idle ${k}/8`, pose: g.at(false, k / 8) })),
    ...Array.from({ length: 16 }, (_, k) => ({ id: `walk-${k}`, label: `Walk ${k}/16`, pose: g.at(true, k / 16) })),
    ...Array.from({ length: 12 }, (_, k) => ({ id: `swing-${k}`, label: `Swing ${k}/12`, pose: g.clipAt('swing', k / 12) })),
    // (the swing's guard, its top and its impact: the clip's rest, its `top` beat and its `impact` event)
    ...[['guard', 0], ['top', 1.34], ['impact', g.swing.events.find((e) => e.name === 'impact').t]].map(([id, t]) => ({ id, label: `Swing ${id}`, pose: g.clipAt('swing', t / g.swing.length) })),
    ...testPoses(rig),
  ];
}
if (only.includes('metrics') || only.includes('poses')) {
  for (const who of ['male', 'female']) {
    const list = await poseList(who);
    metrics[who] = { poses: {} };
    for (const e of list) { const d = dress(who, e.pose); metrics[who].poses[e.id] = crossings(who, d.PB, d.PG, NEIGHBOURS.length ? d.PN : null); }
    metrics.rest[who] = restChecks(who);
    for (const clip of ['walk', 'idle', 'swing']) {
      const run = Object.entries(metrics[who].poses).filter(([k]) => k.startsWith(clip + '-')), parts = {};
      for (const [, v] of run) for (const [k, n] of Object.entries(v.parts)) parts[k] = (parts[k] ?? 0) + n;
      metrics[who][clip] = { body: run.reduce((s, [, v]) => s + v.body, 0), base: run.reduce((s, [, v]) => s + v.base, 0), self: run.reduce((s, [, v]) => s + v.self, 0), ...Object.fromEntries(NEIGHBOURS.map((n) => [n, run.reduce((s, [, v]) => s + (v.neighbours?.[n] ?? 0), 0)])), parts };
    }
    console.log(who, 'rest', JSON.stringify(metrics.rest[who]));
    console.log(who, Object.entries(metrics[who].poses).map(([k, v]) => `${k}:${v.body}/${v.base}/${v.self}`).join(' '));
    for (const clip of ['walk', 'idle', 'swing']) console.log(who, clip, JSON.stringify(metrics[who][clip]));
  }
  writeFileSync(join(out, 'leatherlegs-metrics.json'), JSON.stringify(metrics, null, 1));
}

if (only.includes('poses')) {
  const cells = [], cw = 200, ch = 380, rows = [];
  for (const who of ['male', 'female']) {
    const all = await poseList(who), pick = ['rest', 'idle-2', 'idle-5', 'walk-0', 'walk-4', 'walk-8', 'walk-12', 'tpose', 'forward', 'guard', 'top', 'impact', 'stride', 'kneel', 'swing-5'];
    rows.push([who, pick.map((id) => all.find((e) => e.id === id))]);
  }
  rows.forEach(([who, list], r) => list.forEach((e, k) => {
    const d = dress(who, e.pose), m = metrics[who].poses[e.id], top = M[who].G.design.waist.top + 0.6, bot = M[who].rig.J.floor;
    for (const [j, yaw] of [[0, 20], [1, -90]]) cells.push({ meshes: scene(who, d), cam: { yaw, pitch: 4, s: ch / (top - bot + 1), c: [0, (top + bot) / 2, 0] }, box: [(k % 5) * cw * 2 + j * cw, 34 + (r * 3 + Math.floor(k / 5)) * ch, cw, ch], label: j ? `${m.body}/${m.base}/${m.self}` : `${who} ${e.label}` });
  }));
  await shoot(5 * cw * 2, 34 + 6 * ch, cells, join(out, 'leatherlegs-poses.png'), { texts: [{ css: 'left:10px;top:6px', html: 'Poses, front-left and side, the game\'s clips (idle, walk, the swing\'s guard, top and impact), arms out and forward, and past them a deep stride and knee up: crossings: cloth and pieces with the body / pieces with the cloth / each other\'s' }] });
}

/* ---- the walk: a GIF of both bodies, front, three-quarter, side ----------------------------------------------------- */
if (only.includes('walk')) {
  const frames = join(out, 'walk-frames');
  mkdirSync(frames, { recursive: true });
  const cw = 200, ch = 420, F = 12;
  for (let k = 0; k < F; k++) {
    const cells = [];
    for (const [j, yaw] of [[0, 0], [1, -40], [2, -90]]) for (const [i, who] of [[0, 'male'], [1, 'female']]) {
      const g = await game(M[who].rig), d = dress(who, g.at(true, k / F)), sc = who === 'female' ? 0.85 : 1;
      const S = (P) => P.map((p) => [p[0] * sc, (p[1] - M[who].rig.J.floor) * sc, p[2] * sc]);
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PN: d.PN.map(S) }), cam: { yaw, pitch: 6, s: 50, c: [0, 4.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 6, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 3 // 4, f.height * 3 // 4)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, 'leatherlegs-walk.gif')]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, 'leatherlegs-walk.gif'));
}
await closeBrowser();
