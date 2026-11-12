// The leather set's feathered cap (tools/sculpt/garments/hat.mjs) on the low-poly bodies over the approved swept-back
// hair, looked over against the hat sheet and in the rig's poses:
//
//   node tools/sculpt/lowhatshot.mjs --out <dir> [--only sheet,wire,close,poses,walk,metrics] [--sheet <hat sheet png>]
//        [--tag <name>] [--title <text>] [--enchanted] [--bare]
//     --sheet: a 1536 x 1024 hat sheet; by default the sheet's equipped view (the reference crop, 1.54 times the sheet's
//       size: its silhouette over leather/hat-masks.json's eqm 92.5%) put back where SHEETV's eqm and eqf expect it;
//     hat-sheet<tag>.png: the sheet's equipped view and its turnaround (front, three-quarter, side, rear three-quarter,
//       back, top) above each body's (--enchanted: the plain and the enchanted look, one row each);
//     hat-wire<tag>.png: the same with every polygon's outline, and the triangle counts by piece;
//     hat-close<tag>.png: each body's equipped view, front and side at twice the scale beside the sheet's;
//     hat-poses-<who><tag>.png: the test poses (arms out, forward, overhead, head turned and nodded, the walk, the idle's look),
//       each with the hat's triangles crossing the body's and the hair's;
//     hat-walk<tag>.gif: the game's walk, both bodies, front, three-quarter, side, back;
//     hat-metrics.json: the checks at rest and in every pose, each body.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRig, posed, skin, fromGame, gameRig, armsOut, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, checks, crossPairs, garmentAsset, bonesWith, trisOf } from './lowgarment.mjs';
import { buildHat, hatWeights, hatHair, MATS, LOOKS } from './garments/hat.mjs';
import { shoot, closeBrowser, LOOKS as LOOKS_SHOWN, lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowhat'));
const only = opt('only', 'sheet,wire,close,poses,walk,metrics').split(',');
const tag = opt('tag', '');
const SHEET = resolve(opt('sheet', join(tmpdir(), 'hat2/ref-sheet.png')));
mkdirSync(out, { recursive: true });

const SKIN = [0.68, 0.49, 0.41];
const LOOK = Object.fromEntries(['plain', 'enchanted'].map((look) => [look, Object.fromEntries(Object.entries(MATS).map(([k, c]) => [k, lookColour(LOOKS[look][k] ?? { c, kind: 0 })]))]));
const ENCH = LOOKS_SHOWN.length > 1;
/** The hair's colours in the review renders: a dark brown (the game draws the look's hair colour), its valleys darker, the buzzed sides lighter. */
const HAIRC = { 3: [0.36, 0.27, 0.23], 4: [0.25, 0.16, 0.12], 5: [0.2, 0.13, 0.1], 6: [0.18, 0.12, 0.09], 7: [0.16, 0.1, 0.08], 8: [0.14, 0.09, 0.07] };

const bodyMesh = (rig, P, shave) => ({ who: rig.who, P, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p, pi) => (shave?.has(pi) ? HAIRC[3] : p.mat === 'skin' ? SKIN : p.mat === 'pupil' ? [0.08, 0.06, 0.06] : [0.22, 0.15, 0.13])) });
const hairOf = (rig, H, P) => ({ who: rig.who, P, polys: H.polys, tris: H.tris.map((t) => [...t.v, t.poly]), col: H.mat.map((m) => HAIRC[m] ?? HAIRC[4]) });
const garMesh = (rig, G, P, mats, edges = false) => ({ who: rig.who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p) => mats[p.mat]), edges, edgec: [0.2, 0.12, 0.1] });

const M = {};
for (const who of ['male', 'female']) {
  // (the hair as the game draws it under the hat: pressed under the crown and the brim, garments/hat.mjs hatHair)
  const rig = buildRig(who), G = buildHat(rig), H = hatHair(rig, G);
  G.vw = hatWeights(rig, G);
  M[who] = { rig, G, H, shave: new Set(H.shave) };
}

/* ---- checks ----------------------------------------------------------------------------------------------------------- */
function measure(who, d) {
  const { rig, G, H } = M[who];
  const c = checks(G, d.PG, { tris: rig.B.tris, part: rig.B.part }, d.PB);
  const hair = crossPairs(d.PG, trisOf(G), d.PH, H.tris).length;
  return { tris: c.tris, body: c.body, hair, self: c.self, bodyParts: c.bodyParts, selfParts: c.selfParts, offPlane: c.offPlane, open: c.open, nonManifold: c.nonManifold };
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
  const { rig, G, H } = M[who];
  const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G);
  const head = rig.at.get('head'), PH = skinGarment(rig, f, { verts: H.verts }, H.verts.map(() => [[head, 1]]));
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const dy = rig.J.floor - Math.min(...so.map((i) => PB[i][1]));
  const sh = (P) => P.map((p) => [p[0], p[1] + dy, p[2]]);
  return { PB: sh(PB), PG: sh(PG), PH: sh(PH), dy, f };
}
const scene = (who, d, o = {}) => {
  const { rig, G, H, shave } = M[who];
  const hat = garMesh(rig, G, d.PG, o.look ? LOOK[o.look] : LOOK.plain, o.edges);
  if (o.hatOnly) return [hat];
  return [bodyMesh(rig, d.PB, shave), hairOf(rig, H, d.PH), hat];
};
const rest = (who) => { const { rig, G, H } = M[who]; return { PB: rig.B.verts, PG: G.verts, PH: H.verts, dy: 0 }; };

/* ---- the sheet ---------------------------------------------------------------------------------------------------------- */
// the hat sheet (1536 x 1024): the equipped views (his, hers) and the turnaround's six (crop centre and size)
const SIZE = [1536, 1024];
export const SHEETV = {
  eqm: { crop: [15, 105, 250, 195], yaw: 28, pitch: 2, label: 'Equipped' },
  eqf: { crop: [258, 105, 250, 195], yaw: 28, pitch: 2, label: 'Equipped' },
  front: { crop: [530, 106, 146, 102], yaw: 0, pitch: -14, label: 'Front (0°)' },
  q45: { crop: [675, 106, 142, 102], yaw: 45, pitch: -14, label: 'Three-quarter (45°)' },
  side: { crop: [815, 106, 142, 102], yaw: 90, pitch: -14, label: 'Side (90°)' },
  rq: { crop: [530, 250, 150, 106], yaw: 135, pitch: -14, label: 'Rear three-quarter (135°)' },
  back: { crop: [675, 250, 142, 106], yaw: 180, pitch: -14, label: 'Back (180°)' },
  top: { crop: [818, 250, 140, 106], yaw: 0, pitch: -90, label: 'Top' },
};
const ORDER = ['eq', 'front', 'q45', 'side', 'rq', 'back', 'top'];
async function sheet(file, edges) {
  const cw = 280, ch = 210, top = 34, cells = [], imgs = [], texts = [], R = 1 + LOOKS_SHOWN.length;
  ['male', 'female'].forEach((who, r) => {
    const d0 = rest(who);
    ORDER.forEach((k, i) => {
      const V = SHEETV[k === 'eq' ? (who === 'male' ? 'eqm' : 'eqf') : k];
      imgs.push({ src: SHEET, size: SIZE, crop: V.crop, box: [i * cw, top + r * R * ch, cw, ch] });
      const eq = k === 'eq';
      LOOKS_SHOWN.forEach((look, l) => cells.push({ meshes: scene(who, d0, { edges, look }), cam: { yaw: V.yaw, pitch: V.pitch, s: eq ? 52 : 50, c: eq ? [0.1, 1.05, 0] : [0, 1.55, 0] }, box: [i * cw, top + (r * R + 1 + l) * ch, cw, ch], label: `${who} ${V.label}${ENCH ? ` · ${look}` : ''}` }));
    });
    const byTag = {};
    for (const t of M[who].G.tris) { const g = (M[who].G.polys[t.poly].piece ?? '?'); byTag[g] = (byTag[g] ?? 0) + 1; }
    texts.push({ cls: 'lab', css: `left:${7 * cw + 10}px;top:${top + r * R * ch + 10}px`, html: `${who}: the sheet ↑` });
    texts.push({ cls: 'lab', css: `left:${7 * cw + 10}px;top:${top + (r * R + 1) * ch + 10}px`, html: `${who}: the model ↓${ENCH ? '<br>(plain, then enchanted)' : ''}<br>${M[who].G.tris.length} triangles${edges ? '<br>' + Object.entries(byTag).map(([k, v]) => `${k} ${v}`).join('<br>') : ''}` });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The feathered cap on both low-poly bodies: the sheet\'s views above each body\'s') });
  await shoot(7 * cw + 200, top + 2 * R * ch, cells, file, { texts, imgs });
}
/** Close: each body's equipped, front and side views at twice the scale, the sheet's beside each. */
async function close(file, edges) {
  const cw = 420, ch = 330, top = 34, cells = [], imgs = [], texts = [], K = 1 + LOOKS_SHOWN.length, which = ['eq', 'front', 'side'];
  ['male', 'female'].forEach((who, r) => {
    const d0 = rest(who);
    which.forEach((k, n) => {
      const V = SHEETV[k === 'eq' ? (who === 'male' ? 'eqm' : 'eqf') : k], eq = k === 'eq';
      imgs.push({ src: SHEET, size: SIZE, crop: V.crop, box: [n * K * cw, top + r * ch, cw, ch] });
      LOOKS_SHOWN.forEach((look, l) => cells.push({ meshes: scene(who, d0, { edges, look }), cam: { yaw: V.yaw, pitch: V.pitch, s: eq ? 80 : 90, c: eq ? [0.1, 1.05, 0] : [0, 1.55, 0] }, box: [(n * K + 1 + l) * cw, top + r * ch, cw, ch], label: `${who} ${V.label}${ENCH ? ` · ${look}` : ''}` }));
    });
  });
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The feathered cap close: the sheet\'s equipped, front and side views beside each body\'s') });
  await shoot(K * which.length * cw, top + 2 * ch, cells, file, { texts, imgs });
}
if (only.includes('sheet')) await sheet(join(out, `hat-sheet${tag}.png`), false);
if (only.includes('wire')) await sheet(join(out, `hat-wire${tag}.png`), true);
if (only.includes('close')) await close(join(out, `hat-close${tag}.png`), false);

/**
 * Fit: per body and view the sheet's view, ours under the sheet's own camera (tools/sculpt/lowhatfit.mjs: the same
 * pixels), and the two silhouettes laid over each other (sheet only red, ours only cyan, both white), each K times the
 * sheet's size, laid out in rows; the overlap and the mean outline distance under each.
 */
if (only.includes('fit')) {
  const { fit, VIEWS, piecesFit } = await import('./lowhatfit.mjs');
  const pieceTiles = [];
  const K = 2, cells = [], imgs = [], texts = [], over = [], top = 34, maxW = 2700, reg = {};
  let x = 0, y = top, rowH = 0;
  for (const who of ['male', 'female']) {
    const { rig, G } = M[who], R = fit(who, G, rig), d0 = rest(who);
    reg[who] = Object.fromEntries(Object.entries(R).map(([v, r]) => [v, { cam: r.cam, iou: r.iou, outline: r.outline }]));
    for (const [v, res] of Object.entries(piecesFit(who, G, rig, R))) pieceTiles.push({ who, view: v, box: R[v].box, w: R[v].w, h: R[v].h, pieces: Object.entries(res).map(([piece, p]) => ({ piece, iou: p.iou, outline: p.outline, S: [...p.S].join(''), O: [...p.O].join('') })) });
    for (const v of VIEWS) {
      const r = R[v], cw = r.w * K, ch = r.h * K, bw = cw * (2 + LOOKS_SHOWN.length);
      if (x + bw > maxW) { x = 0; y += rowH + 24; rowH = 0; }
      imgs.push({ src: SHEET, size: SIZE, crop: [r.box[0], r.box[1], r.w, r.h], box: [x, y, cw, ch] });
      // (the cell's middle as a point in the body's space under the view's camera)
      const c = r.cam, a = c.yaw * Math.PI / 180, b = c.pitch * Math.PI / 180;
      const X = (r.w / 2 - c.cx) / c.s, Yp = (c.cy - r.h / 2) / c.s, Yy = Math.cos(b) * Yp, Z = Math.sin(b) * Yp;
      const piv = [X * Math.cos(a) + Z * Math.sin(a), Yy, -X * Math.sin(a) + Z * Math.cos(a)];
      LOOKS_SHOWN.forEach((look, l) => cells.push({ meshes: scene(who, d0, { look, hatOnly: v !== 'eq' }), cam: { yaw: c.yaw, pitch: c.pitch, s: c.s * K, c: piv }, box: [x + (1 + l) * cw, y, cw, ch], label: l === 0 ? `${who} ${v}` : look }));
      over.push({ box: [x + (1 + LOOKS_SHOWN.length) * cw, y, cw, ch], w: r.w, h: r.h, S: [...r.S].join(''), O: [...r.O].join('') });
      texts.push({ cls: 'lab', css: `left:${x + (1 + LOOKS_SHOWN.length) * cw + 4}px;top:${y + ch + 2}px;font-size:13px`, html: `${(r.iou * 100).toFixed(1)}%, ${r.outline.toFixed(1)} px · yaw ${c.yaw.toFixed(0)} pitch ${c.pitch.toFixed(0)}` });
      x += bw + 8; rowH = Math.max(rowH, ch);
    }
    x = 0; y += rowH + 24; rowH = 0;
  }
  texts.push({ css: 'left:10px;top:6px', html: opt('title', 'The cap under the sheet\'s own cameras: the sheet, ours, and the silhouettes over each other (sheet only red, ours only cyan)') });
  const file = join(out, `hat-fit${tag}.png`);
  await shoot(maxW, y, cells, file, { texts, imgs });
  writeFileSync(join(out, 'hat-fit-over.json'), JSON.stringify({ K, over }));
  writeFileSync(join(out, `hat-reg${tag}.json`), JSON.stringify(reg, null, 1));
  execFileSync('python3', ['-c', `
import sys, json
import numpy as np
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); D = json.load(open(sys.argv[2])); K = D['K']
for o in D['over']:
    w, h = o['w'], o['h']
    S = np.array([c == '1' for c in o['S']]).reshape(h, w); O = np.array([c == '1' for c in o['O']]).reshape(h, w)
    t = np.zeros((h, w, 3), np.uint8) + np.array([54, 42, 46], np.uint8)
    t[S & O] = (235, 235, 235); t[S & ~O] = (230, 60, 60); t[O & ~S] = (60, 200, 230)
    im.paste(Image.fromarray(t).resize((w * K, h * K), Image.NEAREST), (o['box'][0], o['box'][1]))
im.save(sys.argv[1])
`, file, join(out, 'hat-fit-over.json')]);
  rmSync(join(out, 'hat-fit-over.json'));
  // the pieces: on the sheet's own view, each piece's outline from the sheet (dim) and ours (bright), in its own colour
  writeFileSync(join(out, 'hat-fit-pieces.json'), JSON.stringify({ sheet: SHEET, tiles: pieceTiles }));
  execFileSync('python3', ['-c', `
import sys, json
import numpy as np
from PIL import Image, ImageDraw
D = json.load(open(sys.argv[1])); sheet = Image.open(D['sheet']).convert('RGB'); K = 3
COL = {'feathers': (255, 210, 40), 'ring': (255, 80, 220), 'trim': (80, 230, 120)}
def edge(A):
    E = np.zeros_like(A); E[1:-1, 1:-1] = A[1:-1, 1:-1] & ~(A[:-2, 1:-1] & A[2:, 1:-1] & A[1:-1, :-2] & A[1:-1, 2:]); return E
T = []
for t in D['tiles']:
    w, h = t['w'], t['h']; x0, y0 = t['box']
    for only in (('feathers', 'ring'), ('trim',)):
        im = sheet.crop((x0, y0, x0 + w, y0 + h)).resize((w * K, h * K), Image.NEAREST)
        a = np.array(im).astype(float) * 0.45
        for p in t['pieces']:
            if p['piece'] not in only: continue
            c = np.array(COL[p['piece']], float)
            S = np.array([q == '1' for q in p['S']]).reshape(h, w); O = np.array([q == '1' for q in p['O']]).reshape(h, w)
            for M, k in ((S, 0.5), (O, 1.0)):
                a[np.kron(edge(M), np.ones((K, K), bool))] = c * k
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
        d.text((6, 4), t['who'] + ' ' + t['view'], fill=(255, 255, 255))
        for i, p in enumerate([p for p in t['pieces'] if p['piece'] in only]): d.text((6, 18 + 13 * i), '%s %d%% %.1fpx' % (p['piece'], round(p['iou'] * 100), p['outline']), fill=COL[p['piece']])
        T.append(im)
rows = [T[i:i + 6] for i in range(0, len(T), 6)]
W = max(sum(t.width for t in r) for r in rows); H = sum(max(t.height for t in r) for r in rows)
out = Image.new('RGB', (W, H)); y = 0
for r in rows:
    x = 0
    for t in r: out.paste(t, (x, y)); x += t.width
    y += max(t.height for t in r)
out.save(sys.argv[2])
`, join(out, 'hat-fit-pieces.json'), join(out, `hat-pieces${tag}.png`)]);
  rmSync(join(out, 'hat-fit-pieces.json'));
}

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
    console.log(who, Object.entries(metrics[who]).map(([k, v]) => `${k}:${v.body}/${v.hair}/${v.self}`).join(' '));
    metrics[who].bones = { body: rig.bones.length, garment: (G.bones ?? []).length, total: bonesWith(rig, G).length };
  }
  writeFileSync(join(out, 'hat-metrics.json'), JSON.stringify(metrics, null, 1));
}
if (only.includes('poses')) {
  // (one sheet per body, to keep the page small)
  const cw = 230, ch = 300, perRow = 6;
  for (const who of ['male', 'female']) {
    const g = await game(M[who].rig), cells = [];
    const list = [{ id: 'rest', label: 'Rest', pose: {} }, ...testPoses(M[who].rig), { id: 'walk-2', label: 'Walk (3/8)', pose: g.at(true, 2 / 8) }, { id: 'idle-9', label: 'Idle look (t 9.5 s)', pose: g.at(false, 0, 9.5) }];
    list.forEach((e, n) => {
      const d = dress(who, e.pose), m = metrics[who]?.[e.id] ?? measure(who, d);
      for (const [j, yaw] of [[0, 0], [1, 60]]) {
        const k = n * 2 + j;
        cells.push({ meshes: scene(who, d), cam: { yaw, pitch: -4, s: 36, c: [0, -0.8 + d.dy, 0] }, box: [(k % (perRow * 2)) * cw, 34 + Math.floor(k / (perRow * 2)) * ch, cw, ch], label: j ? `body ${m.body} hair ${m.hair} self ${m.self}` : `${who} ${e.label}` });
      }
    });
    const nr = Math.ceil((list.length * 2) / (perRow * 2));
    await shoot(perRow * 2 * cw, 34 + nr * ch, cells, join(out, `hat-poses-${who}${tag}.png`), { texts: [{ css: 'left:10px;top:6px', html: `${who}: test poses, front and 60°: the hat's triangles crossing the body's, the hair's, and its own` }] });
  }
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
      cells.push({ meshes: scene(who, { PB: S(d.PB), PG: S(d.PG), PH: S(d.PH) }), cam: { yaw, pitch: 6, s: 27, c: [0, 7.4, 0] }, box: [(j * 2 + i) * cw, 0, cw, ch] });
    }
    await shoot(cw * 8, ch, cells, join(frames, `f${String(k).padStart(2, '0')}.png`));
  }
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
fr = [f.resize((f.width * 3 // 4, f.height * 3 // 4)) for f in fr]
fr[0].save(sys.argv[2], save_all=True, append_images=fr[1:], duration=90, loop=0)
`, frames, join(out, `hat-walk${tag}.gif`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log('wrote', join(out, `hat-walk${tag}.gif`));
}
await closeBrowser();
