// The long sword (tools/sculpt/gear/long_sword.mjs) looked over: against both bodies at the game's scale, in the
// reference sheet's views beside the sheet (plain and enchanted), its facets and wire, held and carried by both bodies,
// and at the game's zoom.
//
//   node tools/sculpt/lowgearshot.mjs --out <dir> [--only block,sheet,wire,engrave,held,game]
//     block: the sword stood beside the man and the woman at the game's scale (her height its length);
//     sheet: front, side, back, side and the hero three-quarter, plain and enchanted (sheet-model.png; tools/sculpt/
//       lowgearsheet.py sets the reference sheet's row beside it);
//     wire: the facets by material and the triangles;
//     engrave: the blade's panel close, plain and enchanted;
//     held: in the right hand, in both hands, carried on the right shoulder, on both bodies, front and three-quarter;
//     game: the whole body at the game's zoom 5 and 10 (px per unit: zoom x HEIGHT_SCALE), held and carried.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRig, posed, skin, ground, mm, mv, tr, add, sub, mul, unit, cross, dot, axisAngle } from './lowrig.mjs';
import { shoot, closeBrowser, gearDrawable, bodyDrawable, edgesOf, triEdgesOf, gameScale, socketOf, socketAt, fistOn, reach, placed, cols, colOf, trisOf } from './lowgear.mjs';
import { buildLongSword, swordLength } from './gear/long_sword.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowgear'));
mkdirSync(out, { recursive: true });
const only = opt('only', 'block,sheet,wire,engrave,held,game').split(',');

const L = await swordLength();
const plain = buildLongSword({ length: L }), lit = buildLongSword({ length: L, enchanted: true });
console.log(`long sword: ${L.toFixed(4)} game units; ${plain.tris} triangles (enchanted: ${lit.all} with the glow)`);
const BG = [0.51, 0.6, 0.533];
const rigs = { male: buildRig('male'), female: buildRig('female') };
const sc = { male: await gameScale(rigs.male), female: await gameScale(rigs.female) };
for (const w of ['male', 'female']) console.log(`${w}: ${sc[w].mesh.toFixed(3)} mesh units tall, ${sc[w].height.toFixed(3)} in game, scale ${sc[w].scale.toFixed(5)}; the sword ${(L / sc[w].scale).toFixed(3)} mesh units`);
const S = (sw) => sw.G.V;
const swordD = (sw, P = S(sw)) => gearDrawable(sw.G, P, sw.MATS);
/** A body at rest (or posed) in game units, the floor at 0. */
const bodyGame = (who, P) => P.map((p) => [p[0] * sc[who].scale, (p[1] - rigs[who].J.floor) * sc[who].scale, p[2] * sc[who].scale]);

/* ---- block: the length against both bodies ----------------------------------------------------------------------- */
if (only.includes('block')) {
  const restM = skin(rigs.male, posed(rigs.male, {})), restF = skin(rigs.female, posed(rigs.female, {}));
  const items = [
    bodyDrawable(rigs.male, bodyGame('male', restM).map((p) => [p[0] - 7.5, p[1], p[2]])),
    bodyDrawable(rigs.female, bodyGame('female', restF).map((p) => [p[0] + 7.5, p[1], p[2]])),
    swordD(plain, S(plain).map((p) => [p[0], p[1], p[2]])),
  ];
  const lines = [];
  for (const y of [L, sc.male.height]) lines.push(-12, y, 0, 12, y, 0);
  const H = 900, W = 1100, s = H * 0.93 / sc.male.height;
  await shoot(W, H, [
    { items, cam: { yaw: 0, pitch: 0, s, c: [0, sc.male.height / 2 + 0.3, 0] }, box: [0, 0, W, H], bg: BG, label: `Blockout: the long sword ${L.toFixed(2)} game units, her height (${sc.female.height.toFixed(2)}); him ${sc.male.height.toFixed(2)}`, edges: [{ lines, c: [0.95, 0.9, 0.6], over: true }] },
  ], `${out}/block.png`);
}

/* ---- sheet: the sheet's views ------------------------------------------------------------------------------------ */
const VIEWS = [{ id: 'front', yaw: 0 }, { id: 'side', yaw: 90 }, { id: 'back', yaw: 180 }, { id: 'side', yaw: -90 }];
if (only.includes('sheet')) {
  // the four views a row a state, each 150 x 560, the sword 521 px long (sheet-views.png); the hero (the sheet's big front
  // view) a column a state, 400 x 1100 (sheet-hero.png); tools/sculpt/lowgearsheet.py sets the sheet beside them
  const cw = 150, ch = 560, s = 521 / L, c = [0, L / 2, 0];
  const cells = [];
  [plain, lit].forEach((sw, r) => VIEWS.forEach((v, i) => cells.push({ items: [swordD(sw)], cam: { yaw: v.yaw, pitch: 0, s, c }, box: [i * cw, r * ch, cw, ch], bg: BG, ink: 1 })));
  await shoot(4 * cw, 2 * ch, cells, `${out}/sheet-views.png`);
  const hw = 400, hh = 1100, hs = 1040 / L;
  await shoot(2 * hw, hh, [plain, lit].map((sw, i) => ({ items: [swordD(sw)], cam: { yaw: 0, pitch: 0, s: hs, c }, box: [i * hw, 0, hw, hh], bg: BG, ink: 1.5 })), `${out}/sheet-hero.png`);
}

/* ---- wire: facets and triangles --------------------------------------------------------------------------------- */
if (only.includes('wire')) {
  // the front and the back with every triangle; the blade's point and the hilt close at three-quarters, flat and with the
  // faces' edges; a count a material
  const count = {}; for (const t of trisOf(plain.G)) { const m = plain.G.F[t.face].mat; count[m] = (count[m] ?? 0) + 1; }
  const note = Object.entries(count).map(([m, n]) => `${m} ${n}`).join('\n');
  const cw = 300, ch = 900, s = ch * 0.95 / L, ink = [0.15, 0.12, 0.2];
  const hiltS = ch / (L * 0.42), hiltC = [0, L * 0.25, 0], tipS = ch / 2 / (L * 0.3), tipC = [0, L * 0.87, 0];
  const cells = [
    { items: [swordD(plain)], cam: { yaw: 0, pitch: 0, s, c: [0, L / 2, 0] }, box: [0, 0, cw, ch], bg: BG, label: `Front: ${plain.tris} triangles`, note, edges: [{ lines: triEdgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 180, pitch: 0, s, c: [0, L / 2, 0] }, box: [cw, 0, cw, ch], bg: BG, label: 'Back', edges: [{ lines: triEdgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 35, pitch: 12, s: tipS, c: tipC }, box: [2 * cw, 0, cw, ch / 2], bg: BG, label: 'Point, three-quarter', ink: 1 },
    { items: [swordD(plain)], cam: { yaw: 215, pitch: 12, s: tipS, c: tipC }, box: [2 * cw, ch / 2, cw, ch / 2], bg: BG, label: 'Back, three-quarter', ink: 1 },
    { items: [swordD(plain)], cam: { yaw: 30, pitch: 10, s: hiltS, c: hiltC }, box: [3 * cw, 0, cw, ch], bg: BG, label: 'Hilt: the faces', edges: [{ lines: edgesOf(plain.G, S(plain)), c: ink }] },
    { items: [swordD(plain)], cam: { yaw: 30, pitch: 10, s: hiltS, c: hiltC }, box: [4 * cw, 0, cw, ch], bg: BG, label: 'Hilt: flat', ink: 1 },
  ];
  await shoot(5 * cw, ch, cells, `${out}/wire.png`);
}

/* ---- engrave: the panel close ---------------------------------------------------------------------------------------- */
if (only.includes('engrave')) {
  const cw = 300, ch = 900, s = ch / (L * 0.62), c = [0, L * 0.69, 0];
  const cells = [plain, lit].map((sw, i) => ({ items: [swordD(sw)], cam: { yaw: 0, pitch: 0, s, c }, box: [i * cw, 0, cw, ch], bg: BG, label: i ? 'Enchanted' : 'Plain (line engraving)' }));
  cells.push({ items: [swordD(lit)], cam: { yaw: 25, pitch: 8, s: s * 0.62, c: [0, L * 0.5, 0] }, box: [2 * cw, 0, cw * 1.3, ch], bg: [0.2, 0.22, 0.24], label: 'Enchanted, three-quarter, dark ground' });
  await shoot(Math.round(3.3 * cw), ch, cells, `${out}/engrave.png`);
}

await closeBrowser();
writeFileSync(`${out}/sword.json`, JSON.stringify({ length: L, tris: plain.tris, trisEnchanted: lit.all, mesh: { male: L / sc.male.scale, female: L / sc.female.scale }, scale: { male: sc.male.scale, female: sc.female.scale } }, null, 1));
