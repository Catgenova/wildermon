// The placeholder hand tools of the work clip (src/sculpt/anim/clips/work.ts) for the low-poly bodies (tools/sculpt/lowgear.mjs):
// a wooden mallet for the striking hand and a chisel for the other, each a few eight-sided prisms, until each job's own tool
// model is drawn. Both are built here; run on its own, this writes src/sculpt/assets/mallet.json and chisel.json.
//
//   buildMallet() / buildChisel() -> { G (meshOf), MATS, L, grip, tris, all, contact (the point that meets the work, its own
//   frame), ends }
//
// Game units (the man 16.5 tall, 1.8 m: a unit is 10.9 cm). Each prop's frame as the long sword's: y along its handle toward
// the thumb of the fist that holds it, x along the hand toward the knuckles (the way the blow goes: a mallet's face looks
// down x), z = x × y.
//   Drawn a little over life size, as the game's props are, so they read at its zoom.
//   The mallet: a haft 3.4 long (37 cm), radius 0.15, the fist's middle 0.6 from its butt; a round head (eight-sided) 1.5
//   long along x and 0.84 across, its middle 3.45 up the haft. Its face (+x) is 2.95 from the fist's middle: the clip's reach.
//   The chisel: from its cutting edge (y 0) to its striking top (2.4, 26 cm): a flat steel blade to 0.7, a round shank to
//   1.06, a bolster, a wooden handle (radius 0.19) to the top's ring. The fist's middle on the handle 1.42 up, its top 0.98
//   above the fist.
import { meshOf, trisOf } from '../lowgear.mjs';
import { buildRig } from '../lowrig.mjs';

export const MALLET_MATS = {
  wood: { c: '#cba68c', vary: 0.03 },
  wood2: { c: '#b08b75', vary: 0.03 },
  face: { c: '#d9bfa6', vary: 0.02 },
  end: { c: '#a5806a' },
};
export const CHISEL_MATS = {
  wood: { c: '#cba68c', vary: 0.03 },
  wood2: { c: '#b08b75', vary: 0.03 },
  steel: { c: '#c9c3cc', vary: 0.03 },
  steelD: { c: '#a9a2b0', vary: 0.02 },
  edge: { c: '#e4e0e8' },
  ring: { c: '#d49a4f' },
};

/** An eight-sided ring's points round an axis: centre c, its axis `ax` ('x' or 'y'), half-widths a (across) and b (deep). */
const ring = (G, c, ax, a, b) => Array.from({ length: 8 }, (_, j) => {
  const t = (j + 0.5) * Math.PI / 4, u = Math.cos(t) * a / Math.cos(Math.PI / 8), v = Math.sin(t) * b / Math.cos(Math.PI / 8);
  return G.p(ax === 'y' ? [c[0] + u, c[1], c[2] + v] : [c[0], c[1] + u, c[2] + v]);
});
/** Rings joined into a tube, each band its own material; the ends capped. */
function tube(G, rings, mats, caps = [null, null]) {
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
    const a = rings[i], b = rings[i + 1], m = typeof mats === 'function' ? mats(i, j) : mats;
    const axisMid = [0, 1, 2].map((k) => (a.reduce((s, q) => s + G.V[q][k], 0) + b.reduce((s, q) => s + G.V[q][k], 0)) / 16);
    G.f([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], m, { from: axisMid });
  }
  const mid = (r) => [0, 1, 2].map((k) => r.reduce((s, q) => s + G.V[q][k], 0) / 8);
  // a cap faces away from the ring next to it
  const end = (r, m, next) => { const c = mid(r), o = mid(next); G.f([...r], m, [c[0] - o[0], c[1] - o[1], c[2] - o[2]]); };
  if (caps[0]) end(rings[0], caps[0], rings[1]);
  if (caps[1]) end(rings[rings.length - 1], caps[1], rings[rings.length - 2]);
}

export const MALLET = { L: 3.87, haft: 3.4, r: 0.15, lead: 0.6, head: { y: 3.45, half: 0.75, r: 0.42 } };
export function buildMallet() {
  const G = meshOf(), M = MALLET;
  // the haft: swelling a little at the butt, into the head
  const hy = [0, 0.08, 0.5, 1.8, M.head.y - 0.3, M.head.y + 0.3], hr = [0.165, 0.175, 0.15, 0.14, 0.13, 0.13];
  tube(G, hy.map((y, i) => ring(G, [0, y, 0], 'y', hr[i], hr[i])), (i, j) => (i === 0 ? 'end' : j % 2 ? 'wood2' : 'wood'), ['end', null]);
  // the head: across the haft's top along x, chamfered at each face
  const { y, half, r } = M.head;
  const hx = [-half, -half + 0.1, half - 0.1, half], rr = [r * 0.82, r, r, r * 0.82];
  tube(G, hx.map((x, i) => ring(G, [x, y, 0], 'x', rr[i], rr[i])), (i, j) => (i === 1 ? (j % 2 ? 'wood2' : 'wood') : 'face'), ['face', 'face']);
  return { G, MATS: MALLET_MATS, L: M.L, tris: trisOf(G).length, all: trisOf(G).length, grip: { axis: [0, 1, 0], lead: [0, M.lead, 0], second: [0, M.lead, 0], radius: M.r, from: 0.1, to: 1.4 }, fit: { backMax: 0.3, tilt: 35 }, contact: [half, y, 0], ends: [[half, y, 0], [-half, y, 0]] };
}

export const CHISEL = { L: 2.4, lead: 1.42, r: 0.19 };
export function buildChisel() {
  const G = meshOf(), C = CHISEL;
  // the blade: flat, wider at the edge, a bevel to it
  const blade = [[0, 0.24, 0.014], [0.1, 0.24, 0.06], [0.7, 0.15, 0.07], [0.78, 0.085, 0.085]];
  const rings = blade.map(([y, a, b]) => ring(G, [0, y, 0], 'y', a, b));
  tube(G, rings, (i) => (i === 0 ? 'edge' : i === 1 ? 'steel' : 'steelD'), ['edge', null]);
  // the shank, the bolster, the handle and the top's ring
  const sh = [[0.78, 0.085], [1.06, 0.085], [1.07, 0.15], [1.17, 0.15], [1.18, 0.17], [1.28, C.r], [2.02, C.r], [2.14, 0.17], [2.16, 0.175], [2.26, 0.175], [2.28, 0.15], [C.L, 0.13]];
  tube(G, sh.map(([y, a]) => ring(G, [0, y, 0], 'y', a, a)), (i) => (i <= 2 ? 'steelD' : i === 3 ? 'steel' : i >= 7 && i <= 9 ? 'ring' : i % 2 ? 'wood2' : 'wood'), [null, 'wood2']);
  return { G, MATS: CHISEL_MATS, L: C.L, tris: trisOf(G).length, all: trisOf(G).length, grip: { axis: [0, 1, 0], lead: [0, C.lead, 0], second: [0, C.lead, 0], radius: C.r, from: 1.2, to: 2.1 }, fit: { backMax: 0.3 }, contact: [0, C.L, 0], ends: [[0, 0, 0]] };
}

/* ---- the game's copies: node tools/sculpt/gear/mallet.mjs (src/sculpt/assets/mallet.json and chisel.json) ---------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { gearAsset } = await import('../lowgear.mjs');
  const rigs = { male: buildRig('male'), female: buildRig('female') };
  for (const [id, build] of [['mallet', buildMallet], ['chisel', buildChisel]]) {
    const p = build(), a = await gearAsset(id, p, p, rigs);
    a.built = 'node tools/sculpt/gear/mallet.mjs (tools/sculpt/lowgear.mjs gearAsset)';
    a.units = "game units; its own frame: y along its handle toward the thumb of the fist that holds it, x the way its blow goes (along the hand toward the knuckles), z = x × y";
    // the point that meets the work: the mallet's face, the chisel's top
    a.contact = p.contact.map((x) => +x.toFixed(5));
    const out = new URL(`../../../src/sculpt/assets/${id}.json`, import.meta.url).pathname;
    writeFileSync(out, JSON.stringify(a));
    console.log(`wrote ${out}: ${a.counts.tris} triangles, ${p.L} game units, contact ${a.contact}`);
  }
}
