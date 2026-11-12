// The awl, the carving knife, the trowel, the file and the whetstone (tools/sculpt/gear/finetools.mjs) beside the long sword,
// the Runestone Warhammer and the Runestone Pickaxe, in the review renderer (tools/sculpt/lowgear.mjs shoot).
//
//   node tools/sculpt/lowtoolsbshot.mjs --out <dir> [--what block,views,details,wire]
//     block: <dir>/tools-b-block.png, the family at one scale (each prop's front), then each tool front, side and top;
//     views: <dir>/tools-b-views.png, each tool plain and enchanted, front, three-quarter, side, back, top, with the fist
//       point (lead) and the contact point marked;
//     details: <dir>/tools-b-details.png, the working parts and the pommels close up, plain and enchanted;
//     wire: <dir>/tools-b-wire.png, each tool's triangles.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { shoot, closeBrowser, gearDrawable, triEdgesOf } from './lowgear.mjs';
import { build, TOOL_IDS, TOOLS } from './gear/finetools.mjs';
import { buildLongSword, swordLength } from './gear/long_sword.mjs';
import { buildWarhammer, warhammerLength } from './gear/warhammer.mjs';
import { buildPickaxe, pickaxeLength } from './gear/pickaxe.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowtoolsb'));
const what = new Set(opt('what', 'block,views,details,wire').split(','));
mkdirSync(out, { recursive: true });
const BG = [0.2, 0.17, 0.18], BGL = [0.16, 0.15, 0.17];
const D = (p) => gearDrawable(p.G, p.G.V, p.MATS);
const plain = Object.fromEntries(TOOL_IDS.map((id) => [id, build(id)]));
const lit = Object.fromEntries(TOOL_IDS.map((id) => [id, build(id, { enchanted: true })]));
/** A cross at a point, for the edges overlay. */
const mark = (p, r) => [p[0] - r, p[1], p[2], p[0] + r, p[1], p[2], p[0], p[1] - r, p[2], p[0], p[1] + r, p[2], p[0], p[1], p[2] - r, p[0], p[1], p[2] + r];
const ink = { ink: 1.2, inkc: [20, 10, 9] };

if (what.has('block')) {
  const [Ls, Lw, Lp] = [await swordLength(), await warhammerLength(), await pickaxeLength()];
  const fam = [['Long sword', buildLongSword({ length: Ls }), 0, Ls], ['Maul (warhammer)', buildWarhammer({ length: Lw }), 180, Lw], ['Pickaxe', buildPickaxe({ length: Lp }), 180, Lp]];
  // one scale for all: the maul fits the row
  const H1 = 760, s = (H1 - 60) / Lw, cells = [];
  let x = 0;
  for (const [name, p, yaw, L] of fam) {
    const w = Math.max(140, Math.round((p.halfWidth ?? 1.4) * 2 * s + 60));
    cells.push({ items: [D(p)], cam: { yaw, pitch: 0, s, c: [0, L / 2, 0] }, box: [x, 0, w, H1], bg: BG, ...ink, label: name, note: `${L.toFixed(2)} long` });
    x += w;
  }
  for (const id of TOOL_IDS) {
    const p = plain[id], w = 110;
    cells.push({ items: [D(p)], cam: { yaw: 0, pitch: 0, s, c: [0, Lw / 2 - 30 / s, 0] }, box: [x, 0, w, H1], bg: BG, ...ink, label: TOOLS[id].name, note: `${p.L.toFixed(2)} long` });
    x += w;
  }
  const W = x;
  // each tool front (its broad face), side (its edge, the blow's way to the left) and top (down the handle), larger
  const S2 = 112, ch = 520, views = [['front', { yaw: 0, pitch: 0 }], ['side', { yaw: 90, pitch: 0 }], ['top', { yaw: 0, pitch: -89.9 }]];
  const cw = Math.floor(W / (TOOL_IDS.length * 3));
  TOOL_IDS.forEach((id, t) => views.forEach(([v, cam], i) => {
    const p = plain[id], top = v === 'top';
    cells.push({ items: [D(p)], cam: { ...cam, s: top ? S2 * 1.6 : S2, c: top ? [0, p.L, 0] : [0, p.L / 2, 0] }, box: [(t * 3 + i) * cw, H1, cw, ch], bg: t % 2 ? BG : BGL, ...ink, label: i === 0 ? TOOLS[id].name : '', note: v });
  }));
  await shoot(W, H1 + ch, cells, `${out}/tools-b-block.png`, [{ cls: 'sm', css: `left:8px;top:${H1 - 40}px`, html: 'One scale: the long sword, the maul and the pickaxe beside the five tools (front). Below: each tool front, side, top, larger.' }]);
}

if (what.has('views')) {
  const cw = 170, ch = 430, s = 104, V = [['front', 0, 0], ['3/4', 35, 10], ['side', 90, 0], ['back', 180, 0], ['top', 0, -89.9]];
  const cells = [];
  [plain, lit].forEach((set, r) => TOOL_IDS.forEach((id, t) => V.forEach(([v, yaw, pitch], i) => {
    const p = set[id], top = v === 'top';
    const lines = [...mark(p.grip.lead, 0.08), ...mark(p.contact, 0.08)];
    cells.push({ items: [D(p)], cam: { yaw, pitch, s: top ? s * 1.3 : s, c: top ? [0, p.L, 0] : [0, p.L / 2, 0] }, box: [(t * V.length + i) * cw / 1, r * ch, cw, ch], bg: r ? [0.12, 0.11, 0.13] : BG, ...ink, label: i === 0 ? `${TOOLS[id].name}${r ? ' (enchanted)' : ''}` : '', note: `${v}${i === 0 ? `\n${p.tris} tris${r ? ` +${p.all - p.tris} glow` : ''}` : ''}`, edges: [{ lines, c: [0.3, 1, 0.9], over: true }] });
  })));
  await shoot(TOOL_IDS.length * V.length * cw, 2 * ch, cells, `${out}/tools-b-views.png`, [{ cls: 'sm', css: 'left:8px;top:2px', html: 'cyan crosses: the fist point (grip.lead) and the contact point' }]);
}

if (what.has('details')) {
  // per tool: the working part close, at a three-quarter; the pommel close
  const cw = 260, ch = 300, cells = [];
  const work = { awl: [0, 2.6, 0, 190], carving_knife: [0, 2.8, 0, 180], trowel: [0, 3.1, -0.34, 150], file: [0, 3.0, 0, 120], whetstone: [0, 2.0, 0, 240] };
  [plain, lit].forEach((set, r) => TOOL_IDS.forEach((id, t) => {
    const p = set[id], [wx, wy, wz, ws] = work[id];
    cells.push({ items: [D(p)], cam: { yaw: 25, pitch: 12, s: ws, c: [wx, wy, wz] }, box: [t * cw, r * 2 * ch, cw, ch], bg: r ? [0.12, 0.11, 0.13] : BG, ...ink, label: `${TOOLS[id].name}${r ? ' (enchanted)' : ''}` });
    cells.push({ items: [D(p)], cam: { yaw: 20, pitch: 15, s: 390, c: [0, id === 'whetstone' ? 2.36 : 0.34, 0] }, box: [t * cw, (r * 2 + 1) * ch, cw, ch], bg: r ? [0.12, 0.11, 0.13] : BG, ...ink, note: id === 'whetstone' ? 'top cap' : 'pommel, collar' });
  }));
  await shoot(TOOL_IDS.length * cw, 4 * ch, cells, `${out}/tools-b-details.png`);
}

if (what.has('wire')) {
  const cw = 220, ch = 440, s = 104, cells = [];
  TOOL_IDS.forEach((id, t) => [[0, 0], [90, 0]].forEach(([yaw, pitch], i) => {
    const p = plain[id];
    cells.push({ items: [D(p)], cam: { yaw, pitch, s, c: [0, p.L / 2, 0] }, box: [(t * 2 + i) * cw, 0, cw, ch], bg: BG, label: i ? '' : `${TOOLS[id].name}: ${p.tris}`, edges: [{ lines: triEdgesOf(p.G, p.G.V), c: [0.25, 0.9, 0.85] }] });
  }));
  await shoot(TOOL_IDS.length * 2 * cw, ch, cells, `${out}/tools-b-wire.png`);
}
await closeBrowser();
