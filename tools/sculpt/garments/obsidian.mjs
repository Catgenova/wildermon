// The obsidian set (src/game/gear.ts OBSIDIAN_PIECES: helm, cuirass, shawl, leggings, boots) on the low-poly bodies:
// each the scale set's piece (scalehelm.mjs, scalechest.mjs, scaleshawl.mjs, scalelegs.mjs, scaleboots.mjs, read from
// their game copies) with every dragon scale re-cut as a knapped plate of obsidian, and the set in obsidian's colours.
//
//   * a plate: the scale's top kept, its sides squared (its foot set out as wide as its shoulders), its point drawn up
//     into a blunt chevron, and its ridge set off its middle to one side or the other, so the two facets either side of
//     it are not alike and take the light at different angles; its turned-back edge moved with it;
//   * the colours: the plates glossy volcanic glass (drawn lit as metal for their sheen, kind 3: src/sculpt/lowpoly.ts),
//     their turned-back edge a dark ember red, the trim an ember copper, the leather and the under-layer near black, the
//     cores ember (lit when enchanted, with the runes); the shawl's membranes smoked glass.
//
// Every point and polygon is where the scale piece has one and in the same order, so everything the scale set is fitted
// by holds for the obsidian one as it stands: what each hides, the chest over each legs piece (`ChestLegs`), the legs'
// waist left out under the chest (`dropFrom`), the boots' soles, the shawl over every chest.
//
//   node tools/sculpt/garments/obsidian.mjs
//     writes src/sculpt/assets/lowobsidian<piece>-<who>.json for helm, chest, shawl, legs and boots, beside the scale set's.
import { readFileSync, writeFileSync } from 'node:fs';

/** The set's colours, red, green and blue nought to one, and how each is lit (2 by brightness, 3 as metal: glossy, 1 unlit). */
export const MATS = {
  scale: [0.105, 0.094, 0.135],
  edge: [0.3, 0.085, 0.06],
  leather: [0.2, 0.135, 0.12],
  under: [0.13, 0.11, 0.12],
  gold: [0.44, 0.17, 0.12],
  core: [0.93, 0.42, 0.2],
  rune: [0.78, 0.34, 0.2],
  membrane: [0.17, 0.14, 0.2],
};
const KIND = { scale: 3, edge: 2, leather: 2, under: 2, gold: 2, core: 2, rune: 2, membrane: 3 };
/** Enchanted, the cores and the runes unlit at an ember glow. */
const GLOW = [1, 0.58, 0.3];
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;

/** How far a plate's foot is set out each way, as a share of its width there; how far its point is drawn up toward its foot's line; how far its ridge is set off its middle. */
const SQUARE = 0.16, BLUNT = 0.55, OFFSET = 0.22;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const hash = (n) => (((n * 2654435761) >>> 0) % 1000) / 1000;

/** The scale piece `A` (a game copy) with its scales re-cut as obsidian plates and the set's colours. */
export function obsidianOf(A) {
  const O = JSON.parse(JSON.stringify(A));
  const V = [];
  for (let i = 0; i < O.verts.length; i += 3) V.push([O.verts[i], O.verts[i + 1], O.verts[i + 2]]);
  const scale = O.mats.indexOf('scale'), edge = O.mats.indexOf('edge');
  // (each scale: its six faces and its four edges, which share their points with nothing else)
  const of = new Map();
  O.polys.forEach(([v, k], pi) => { if (k === scale || k === edge) for (const x of v) of.set(x, [...(of.get(x) ?? []), pi]); });
  const seen = new Set();
  let cut = 0;
  O.polys.forEach(([, k], p0) => {
    if (k !== scale || seen.has(p0)) return;
    const polys = new Set([p0]), stack = [p0];
    while (stack.length) for (const x of O.polys[stack.pop()][0]) for (const q of of.get(x) ?? []) if (!polys.has(q)) { polys.add(q); stack.push(q); }
    for (const q of polys) seen.add(q);
    const faces = [...polys].filter((q) => O.polys[q][1] === scale), edges = [...polys].filter((q) => O.polys[q][1] === edge);
    if (faces.length !== 6 || edges.length !== 4) return;
    const inFaces = new Map();
    for (const q of faces) for (const x of O.polys[q][0]) inFaces.set(x, [...(inFaces.get(x) ?? []), q]);
    if (inFaces.size !== 9) return;
    const quads = (x) => inFaces.get(x).filter((q) => O.polys[q][0].length === 4).length, tris = (x) => inFaces.get(x).length - quads(x);
    const pts = [...inFaces.keys()];
    const M = pts.find((x) => inFaces.get(x).length === 6);
    const T = pts.find((x) => quads(x) === 2 && tris(x) === 0);
    const tops = pts.filter((x) => quads(x) === 1 && tris(x) === 0), sides = pts.filter((x) => quads(x) === 1 && tris(x) === 1);
    const low = pts.filter((x) => quads(x) === 0 && tris(x) === 2);
    if (M === undefined || T === undefined || tops.length !== 2 || sides.length !== 2 || low.length !== 3) return;
    // (the point: the one of the three low points whose two triangles hold the other two)
    const tip = low.find((x) => low.filter((y) => y !== x).every((y) => inFaces.get(x).some((q) => O.polys[q][0].includes(y))));
    const [LL, RR] = low.filter((x) => x !== tip);
    if (tip === undefined || LL === undefined || RR === undefined) return;
    // (each side point with the shoulder above it, by nearness)
    const near = (a, cands) => cands.reduce((b, c) => (len(sub(V[c], V[a])) < len(sub(V[b], V[a])) ? c : b));
    const L = near(LL, sides), R = sides.find((x) => x !== L);
    // (each turned-back edge point with the face point it was turned back from: the nearest of the outline's)
    const edgeV = new Set(edges.flatMap((q) => O.polys[q][0]).filter((x) => !inFaces.has(x)));
    const partner = new Map([...edgeV].map((e) => [e, near(e, [L, LL, tip, RR, R])]));
    const was = new Map([L, LL, tip, RR, R, M].map((x) => [x, V[x].slice()]));
    // the foot squared, the point drawn up, the ridge set off its middle
    const across = sub(was.get(RR), was.get(LL));
    V[LL] = sub(was.get(LL), mul(across, SQUARE));
    V[RR] = add(was.get(RR), mul(across, SQUARE));
    V[tip] = add(was.get(tip), mul(sub(mul(add(V[LL], V[RR]), 0.5), was.get(tip)), BLUNT));
    V[M] = add(was.get(M), mul(sub(was.get(R), was.get(L)), OFFSET * (hash(cut + M) < 0.5 ? -1 : 1)));
    for (const [e, f] of partner) V[e] = add(V[e], sub(V[f], was.get(f)));
    void T; void tops;
    cut++;
  });
  O.verts = V.flat().map((x) => +x.toFixed(5));
  const look = (lit) => O.mats.map((n) => {
    const c = MATS[n] ?? [0.5, 0.5, 0.5];
    return lit && (n === 'core' || n === 'rune') ? { c: hex(GLOW), kind: 1 } : { c: hex(c), kind: KIND[n] ?? 2 };
  });
  O.plain = look(false);
  O.enchanted = look(true);
  O.colours = O.mats.map((n) => MATS[n] ?? [0.5, 0.5, 0.5]);
  O.built = 'node tools/sculpt/garments/obsidian.mjs (the scale set\'s piece, its scales knapped)';
  return { O, cut };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = new URL('../../../src/sculpt/assets/', import.meta.url);
  for (const piece of ['helm', 'chest', 'shawl', 'legs', 'boots']) for (const who of ['male', 'female']) {
    const { O, cut } = obsidianOf(JSON.parse(readFileSync(new URL(`lowscale${piece}-${who}.json`, dir), 'utf8')));
    writeFileSync(new URL(`lowobsidian${piece}-${who}.json`, dir), JSON.stringify(O));
    console.log(`lowobsidian${piece}-${who}.json: ${cut} plates`);
  }
}
