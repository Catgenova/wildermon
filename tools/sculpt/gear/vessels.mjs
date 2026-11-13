// What is eaten and drunk from in one fist for the low-poly bodies (the eat and drink clips, src/sculpt/anim/clips/meal.ts):
// a wooden cup (drinking tea, drinking from a barrel or a well), a waterskin (drinking from a skin) and a bread roll
// (eating). Run on its own (or through tools/sculpt/gear/<id>.mjs), it writes src/sculpt/assets/<id>.json for each
// (lowgear.mjs gearAsset).
//
//   build(id) -> { G (meshOf: V, F with a material each, A: alpha per point), MATS, L, grip, fit, contact, ends, tris, all }
//
// The frame (as the hand tools', tools/sculpt/gear/finetools.mjs: game units, the man 16.5 tall): y along what is held
// from its foot toward the end that goes to the mouth (toward the thumb of the fist that holds it); x along the hand
// toward the knuckles; z = x × y. grip.lead is the fist point, contact the end that meets the mouth: the cup's and the
// skin's lip, the roll's bitten end. Plain wood, leather and crust: nothing on them is lit when enchanted (none are).
// Sized at life size and a little over (a cup a hand high, a skin a forearm long, a roll a hand and a half long), so each reads at
// the island's zoom as a shape of its own colour in the fist.
import { meshOf, trisOf } from '../lowgear.mjs';

export const MATS = {
  wood: { c: '#b07a48', vary: 0.03 },
  woodD: { c: '#8e5c34', vary: 0.03 },
  woodL: { c: '#cf9a62' },
  tea: { c: '#5a3a22' },
  hide: { c: '#9a6a40', vary: 0.03 },
  hideD: { c: '#7a4f2e' },
  cord: { c: '#d8c49a' },
  cork: { c: '#c79a62' },
  crust: { c: '#c98a45', vary: 0.03 },
  crustD: { c: '#a8692e' },
  crumb: { c: '#ecd3a0' },
};
export const IDS = ['cup', 'waterskin', 'bread'];

/** A ring of n points round the y axis at height y, radii rx (along x) and rz (along z). */
function ringOf(G, y, rx, rz, n, off = 0.5) {
  return Array.from({ length: n }, (_, j) => { const a = ((j + off) / n) * Math.PI * 2; return G.p([rx * Math.cos(a), y, rz * Math.sin(a)]); });
}
/** Rings joined into bands, each band its material (mat(i) for band i), faced away from the axis. */
function loft(G, rings, mat) {
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1], n = a.length;
    for (let j = 0; j < n; j++) {
      const q = [a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]];
      const c = q.reduce((s, k) => [s[0] + G.V[k][0] / 4, s[1] + G.V[k][1] / 4, s[2] + G.V[k][2] / 4], [0, 0, 0]);
      G.f(q, typeof mat === 'function' ? mat(i, j) : mat, { from: [0, c[1], 0] });
    }
  }
}
/** A ring closed by a flat cap facing `out`. */
const cap = (G, ring, mat, out) => G.f([...ring], mat, out);

function cup(G) {
  // a turned beaker: a foot, the body widening to the lip, a darker band round it, the tea inside
  const N = 10, H = 1.0;
  const rings = [ringOf(G, 0, 0.3, 0.3, N), ringOf(G, 0.06, 0.34, 0.34, N), ringOf(G, 0.42, 0.36, 0.36, N), ringOf(G, 0.5, 0.37, 0.37, N), ringOf(G, 0.6, 0.38, 0.38, N), ringOf(G, H, 0.41, 0.41, N)];
  loft(G, rings, (i, j) => (i === 2 || i === 3 ? 'woodD' : j % 2 ? 'wood' : 'woodL'));
  cap(G, rings[0], 'woodD', [0, -1, 0]);
  // the lip's inner wall and the tea a little below it
  const inner = ringOf(G, H, 0.35, 0.35, N), tea = ringOf(G, H - 0.12, 0.34, 0.34, N);
  for (let j = 0; j < N; j++) G.f([rings[5][j], rings[5][(j + 1) % N], inner[(j + 1) % N], inner[j]], 'woodL', [0, 1, 0]);
  loft(G, [tea, inner], 'woodD');
  cap(G, tea, 'tea', [0, 1, 0]);
  return { L: H, lead: 0.5, radius: 0.37, contact: [0, H, -0.38], parts: 'foot, body, band, lip, tea' };
}

function waterskin(G) {
  // a hide bag, flattened front to back, its shoulder narrowing to a bound neck and a stopper
  const N = 10, flat = 0.62;
  const prof = [[0, 0.18], [0.08, 0.42], [0.3, 0.58], [0.62, 0.6], [0.92, 0.5], [1.12, 0.34], [1.3, 0.16], [1.42, 0.13]];
  const rings = prof.map(([y, r]) => ringOf(G, y, r, r * flat, N));
  loft(G, rings, (i, j) => (i === 6 ? 'hideD' : (j + i) % 3 === 0 ? 'hideD' : 'hide'));
  cap(G, rings[0], 'hideD', [0, -1, 0]);
  // the cord bound round the neck, and the stopper in it
  const c0 = ringOf(G, 1.3, 0.175, 0.175, N), c1 = ringOf(G, 1.4, 0.175, 0.175, N);
  loft(G, [c0, c1], 'cord');
  cap(G, c1, 'cord', [0, 1, 0]);
  const s0 = ringOf(G, 1.42, 0.1, 0.1, 6), s1 = ringOf(G, 1.62, 0.11, 0.11, 6);
  loft(G, [s0, s1], 'cork');
  cap(G, s1, 'cork', [0, 1, 0]);
  return { L: 1.62, lead: 1.0, radius: 0.36, contact: [0, 1.62, 0], parts: 'bag, neck, cord, stopper' };
}

function bread(G) {
  // a roll: a long round loaf, the crust darker underneath, scored across the top, a pale broken end where it is bitten
  const N = 8;
  const prof = [[0, 0.14], [0.14, 0.36], [0.42, 0.45], [0.85, 0.47], [1.25, 0.43], [1.45, 0.36]];
  const rings = prof.map(([y, r]) => ringOf(G, y, r, r * 0.85, N));
  loft(G, rings, (i, j) => (j >= 4 ? 'crustD' : i === 2 && j === 1 ? 'crumb' : 'crust'));
  cap(G, rings[0], 'crustD', [0, -1, 0]);
  cap(G, rings[5], 'crumb', [0, 1, 0]);
  return { L: 1.45, lead: 0.42, radius: 0.42, contact: [0, 1.45, 0], parts: 'loaf, scored top, broken end' };
}

const BUILD = { cup, waterskin, bread };

export function build(id) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`vessels: no ${id}`);
  const G = meshOf();
  G.A = [];
  const r = fn(G);
  for (let i = 0; i < G.V.length; i++) G.A[i] = 1;
  const tris = trisOf(G).length;
  return {
    id, G, MATS, L: r.L, tris, all: tris, parts: r.parts,
    grip: { axis: [0, 1, 0], lead: [0, r.lead, 0], second: [0, r.lead, 0], radius: r.radius, edge: [1, 0, 0], face: [0, 0, 1], from: 0, to: r.L },
    // the fist closed round it across the finger roots
    fit: { backMax: 0.3 },
    contact: r.contact,
    ends: [r.contact],
  };
}

export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id), lit = build(id);
  const a = await gearAsset(id, plain, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.units = 'game units; its own frame: y from its foot toward the end that goes to the mouth (toward the thumb of the fist that holds it), x along the hand toward the knuckles, z = x × y';
  a.contact = plain.contact.map(r5);
  a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = 0;
  // (no glow: every polygon drawn)
  if (a.glowFrom < 0) a.glowFrom = a.polys.length;
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles, ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}, contact ${a.contact}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
