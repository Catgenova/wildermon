// The Runecut hand tools (tools/sculpt/gear/hammer.mjs, mallet.mjs, chisel.mjs, hatchet.mjs, butchering_knife.mjs) looked
// over in the review renderer (tools/sculpt/lowgear.mjs shoot), beside the long sword, the Runestone Warhammer and the
// Runestone Pickaxe at the same scale.
//
//   node tools/sculpt/lowtoolsheet.mjs --out <dir> [--only block,views,wire,grip] [--tools hammer,mallet,...]
//     block: block.png, the line stood up together at one scale (the sword, the maul, the pick, the five tools), then each
//       tool front, side and top at three times that scale, plain over enchanted;
//     views: views-<id>.png, a turnaround of each, plain and enchanted, close;
//     wire: wire.png, each tool's triangles over its facets, with its counts;
//     grip: grip.png, each tool's fist point (green), contact (red) and, for the chisel, its cutting edge (blue), and the
//       reach from the fist to the contact.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { shoot, closeBrowser, gearDrawable, triEdgesOf } from './lowgear.mjs';
import { buildPickaxe, pickaxeLength } from './gear/pickaxe.mjs';
import { buildWarhammer, warhammerLength } from './gear/warhammer.mjs';
import { buildHammer } from './gear/hammer.mjs';
import { buildMallet } from './gear/mallet.mjs';
import { buildChisel } from './gear/chisel.mjs';
import { buildHatchet } from './gear/hatchet.mjs';
import { buildCleaver } from './gear/butchering_knife.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowtools'));
mkdirSync(out, { recursive: true });
const only = opt('only', 'block,views,wire,grip').split(',');

/** The tools: their builders and the yaw they are seen from in front (their medallion's or the blade's flat face). */
export const TOOLS = [
  { id: 'hammer', name: 'Hammer', build: buildHammer, front: 180 },
  { id: 'mallet', name: 'Mallet', build: buildMallet, front: 180 },
  { id: 'chisel', name: 'Chisel', build: buildChisel, front: 90 },
  { id: 'hatchet', name: 'Hatchet', build: buildHatchet, front: 180 },
  { id: 'butchering_knife', name: 'Cleaver', build: buildCleaver, front: 180 },
];
const pick = opt('tools', '').split(',').filter(Boolean);
const tools = TOOLS.filter((t) => !pick.length || pick.includes(t.id));
const BG = [0.27, 0.235, 0.245], DARK = [0.16, 0.15, 0.17];
const D = (p, dx = 0, dy = 0) => gearDrawable(p.G, p.G.V.map((q) => [q[0] + dx, q[1] + dy, q[2]]), p.MATS);
const built = tools.map((t) => ({ ...t, plain: t.build({}), lit: t.build({ enchanted: true }) }));

if (only.includes('block')) {
  const { buildLongSword, swordLength } = await import('./gear/long_sword.mjs');
  const line = [];
  { const L = await swordLength(); line.push(['Long sword', buildLongSword({ length: L })]); }
  line.push(['Maul', buildWarhammer({ length: await warhammerLength() })], ['Pickaxe', buildPickaxe({ length: await pickaxeLength() })]);
  // one scale: s px a game unit; the lineup across the top, each stood on its foot
  const s = 34, gap = 1.0, W = 2000, H1 = 640;
  const cells = [];
  let x = 1.5;
  const items = [];
  const labels = [];
  // (--with <finetools.mjs>: the other five of the set beside them, from their builder)
  const other = [];
  if (opt('with', '')) { const B = await import(resolve(opt('with', ''))); for (const [id, t] of Object.entries(B.TOOLS)) other.push([t.name, B.build(id, {})]); }
  for (const [name, p] of [...line, ...built.map((b) => [b.name, b.plain]), ...other]) {
    let x0 = Infinity, x1 = -Infinity; for (const q of p.G.V) { x0 = Math.min(x0, -q[0]); x1 = Math.max(x1, -q[0]); }
    // seen from -z (yaw 180): its x reversed on the page
    items.push(D(p, x0 - x, 0));
    labels.push({ cls: 'lab', css: `left:${Math.round((x + (x1 - x0) / 2) * s - 30)}px;top:${H1 - 26}px`, html: name });
    x += (x1 - x0) + gap;
  }
  cells.push({ items, cam: { yaw: 180, pitch: 0, s, c: [-(W / s / 2), (H1 - 40) / s / 2 - 0.3, 0] }, box: [0, 0, W, H1], bg: BG, ink: 1, label: `The line at one scale (${s} px a game unit; the man is 16.5): the long sword, the maul, the pickaxe and the hand tools` });
  // each tool front, side and top at four times the scale, plain over enchanted
  const s2 = s * 3, cw = 200, ch = 490;
  built.forEach((t, k) => {
    const c = [-t.plain.contact[0] * 0 + 0.05, t.plain.L / 2, 0];
    [['front', t.front, 0], ['side', t.front + 90, 0], ['top', t.front, 89.9]].forEach(([v, yaw, pitch], j) => [t.plain, t.lit].forEach((p, r) => {
      const bx = k * cw * 3 + j * cw, by = H1 + r * ch;
      const cc = pitch ? [0.05, 0, 0] : c;
      cells.push({ items: [pitch ? gearDrawable(p.G, p.G.V.map((q) => [q[0], q[1] - p.contact[1], q[2]]), p.MATS) : D(p)], cam: { yaw, pitch, s: s2, c: cc }, box: [bx, by, cw, ch], bg: r ? DARK : BG, ink: 1, label: j === 0 ? `${t.name}${r ? ' enchanted' : ''}` : '', note: `${v}` });
    }));
  });
  await shoot(Math.max(W, built.length * cw * 3), H1 + 2 * ch, cells, join(out, 'block.png'), labels);
}

if (only.includes('views')) for (const t of built) {
  const cw = 300, ch = 400, s = 80, c = [0.05, t.plain.L / 2, 0], cells = [];
  [t.plain, t.lit].forEach((p, r) => [0, 45, 90, 135, 180, 270].forEach((d, i) => cells.push({ items: [D(p)], cam: { yaw: t.front + d, pitch: 14, s, c }, box: [i * cw, r * ch, cw, ch], bg: r ? DARK : BG, ink: 1, label: `${t.name} ${r ? 'enchanted' : 'plain'} ${d}°` })));
  await shoot(6 * cw, 2 * ch, cells, join(out, `views-${t.id}.png`));
}

if (only.includes('wire')) {
  const cw = 300, ch = 420, s = 82;
  const cells = built.flatMap((t, k) => [0, 90].map((d, j) => ({ items: [D(t.plain)], cam: { yaw: t.front + d, pitch: 10, s, c: [0.05, t.plain.L / 2, 0] }, box: [(k * 2 + j) * cw, 0, cw, ch], bg: BG, label: j ? '' : `${t.name}: ${t.plain.tris} tris (+${t.lit.all - t.plain.tris} glow)`, edges: [{ lines: triEdgesOf(t.plain.G, t.plain.G.V), c: [0.15, 0.1, 0.1] }] })));
  await shoot(built.length * 2 * cw, ch, cells, join(out, 'wire.png'));
}

if (only.includes('grip')) {
  const cw = 320, ch = 420, s = 82;
  const mark = (p, c, r = 0.05) => ({ lines: [[-r, 0, 0], [r, 0, 0], [0, -r, 0], [0, r, 0], [0, 0, -r], [0, 0, r]].flatMap((d, i) => (i % 2 ? [] : [p[0] + d[0], p[1] + d[1], p[2] + d[2], p[0] - d[0], p[1] - d[1], p[2] - d[2]])), c, over: true });
  const cells = built.map((t, k) => {
    const p = t.plain, lead = p.grip.lead;
    const edges = [mark(lead, [0.2, 1, 0.3]), mark(p.contact, [1, 0.25, 0.2]), { lines: [...lead, ...p.contact], c: [1, 0.9, 0.3], over: true }];
    if (p.cut) edges.push(mark(p.cut, [0.3, 0.5, 1]));
    const d = p.contact.map((v, i) => v - lead[i]);
    return { items: [D(p)], cam: { yaw: t.front, pitch: 0, s, c: [0.05, p.L / 2, 0] }, box: [k * cw, 0, cw, ch], bg: BG, label: t.name, note: `fist ${lead[1].toFixed(2)}\ncontact ${p.contact.map((v) => v.toFixed(2)).join(', ')}\nd ${d.map((v) => v.toFixed(3)).join(', ')}\nreach ${Math.hypot(...d).toFixed(3)}`, edges };
  });
  await shoot(built.length * cw, ch, cells, join(out, 'grip.png'));
}
await closeBrowser();
