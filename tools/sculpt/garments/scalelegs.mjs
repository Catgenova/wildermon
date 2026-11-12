// The scale set's leggings (the item scale_leggings): padded leather legs (the body's own polygons from the hip down to
// the ankle, recoloured), a dark belt round the hips, a leather thigh guard round each thigh laid over with courses of
// dragon scale, and a scale-plate knee cop with a glowing diamond inset. Below the knee the leather alone: the boots'
// shin guards go over it.
//
//   buildScaleLegs(rig) → { verts, polys, tris, vw, hides } (the weights with it)
//
//   node tools/sculpt/garments/scalelegs.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowscalelegs-<who>.json (lowgarment.mjs garmentAsset,
//     with `hides`, the body's polygons the leather layer takes the place of; loaded by src/sculpt/lowpoly.ts behind the
//     outfit switch `scaleLegs`; from `dropFrom` on, the hip band and the leather the scale cuirass beside the body covers
//     whole, left out while that is worn)
//
// Built on the plate leggings (platelegs.mjs buildWithBase: their base layer, hip band, cuisse and knee guard, fitted to
// each body and weighted there: the cuisse on the skin under it, eased, the knee guard on the knee helper, the band on
// the pelvis); the shin and calf plates left out, the cuisse a leather base with scales over it (scale.mjs scalesOn), each
// scale's vertices weighted as the cuisse's nearest vertex.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { trisOf, sub } from '../lowgarment.mjs';
import { buildWithBase, plateLegsWeights, legField, DESIGN as PLATE } from './platelegs.mjs';
import { MATS, LOOKS, scalesOn, compact, coursesOf, toEnd } from './scale.mjs';

/** The scales per body: the highest a course starts (under the cuirass's skirt), a course's height and a scale's width, the lift, ridge and thickness (scale.mjs scalesOn). */
export const SCALE = {
  male: { top: -5.15, course: 0.42, w: 0.36, lift: [0.014, 0.07], ridge: 0.026, thick: 0.038 },
  female: { top: -4.7, course: 0.36, w: 0.32, lift: [0.012, 0.06], ridge: 0.022, thick: 0.032 },
};
/** The plate leggings' pieces kept, and each one's materials as the scale set's. */
const KEEP = new Set(['base', 'band', 'cuisse', 'knee']);
const RECOLOUR = {
  base: { shade: 'leather' },
  band: { plate: 'under', shade: 'under' },
  cuisse: { plate: 'under', shade: 'leather' },
  knee: { plate: 'scale', shade: 'edge' },
};

const rad = (d) => d * Math.PI / 180;

export function buildScaleLegs(rig, { drop = null } = {}, SC = SCALE[rig.who]) {
  const D = PLATE[rig.who];
  const G = buildWithBase(rig, D);
  G.vw = plateLegsWeights(rig, G);
  // (each polygon of the base layer the body's own it copies, for `drop`)
  G.polys.filter((p) => p.tag === 'base').forEach((p, n) => { p.body = G.hides[n]; });
  compact(G, (p) => KEEP.has(p.tag));
  for (const p of G.polys) p.mat = RECOLOUR[p.tag]?.[p.mat] ?? p.mat;
  // the scales on each thigh guard: rays out from the leg's axis (the right leg's the left's mirrored)
  const F = legField(rig.B);
  G.wt = [];
  const n0 = G.verts.length, p0 = G.polys.length;
  const cuisse = (s) => G.polys.filter((p) => p.tag === 'cuisse' && p.mat === 'under' && Math.sign(G.verts[p.v[0]][0]) === s).flatMap((p) => { const o = []; for (let j = 1; j + 1 < p.v.length; j++) o.push([G.verts[p.v[0]], G.verts[p.v[j]], G.verts[p.v[j + 1]]]); return o; });
  for (const s of [1, -1]) {
    const T = cuisse(s), ys = T.flat().map((p) => p[1]);
    // (from under the band's foot at the hip, or the thigh guard's top, down to its foot)
    const top = Math.min(Math.max(...ys) - 0.05, SC.top), bot = Math.min(...ys);
    const { us, h } = coursesOf(-top, -bot - SC.course * 0.15, SC.course);
    const cast = (u, v) => { const c = F.axis(-u); return [[s * c[0], -u, c[1]], [s * Math.sin(rad(v)), 0, Math.cos(rad(v))]]; };
    scalesOn(G, { tris: T }, { h, us, w: SC.w, v: [-150, 210], lift: SC.lift, ridge: SC.ridge, thick: SC.thick, cast, out: (p) => { const c = F.axis(p[1]); return [p[0] - s * c[0], 0, p[2] - c[1]]; }, wt: null, tag: 'thigh scales' });
  }
  // (each scale's vertex weighted as the thigh guard's nearest vertex on its side)
  const guard = [...new Set(G.polys.filter((p) => p.tag === 'cuisse').flatMap((p) => p.v))];
  for (let i = n0; i < G.verts.length; i++) {
    const p = G.verts[i];
    let best = -1, bd = Infinity;
    for (const j of guard) { const d = Math.hypot(...sub(G.verts[j], p)); if (d < bd && Math.sign(G.verts[j][0]) === Math.sign(p[0])) { bd = d; best = j; } }
    G.vw[i] = G.vw[best].map(([b, w]) => [b, w]);
  }
  G.part = G.verts.map((_, i) => G.part?.[i] ?? 'scales');
  for (const t of trisOf({ polys: G.polys.slice(p0) })) G.tris.push({ v: t.v, poly: t.poly + p0 });
  // (left out under the scale cuirass, from dropFrom on: the band, and the base layer the cuirass covers whole)
  if (drop) G.dropFrom = toEnd(G, (p) => p.tag === 'band' || (p.tag === 'base' && drop.has(p.body)));
  return G;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    // (the body's polygons the scale cuirass beside the body covers whole: the base layer there left out under it)
    const { existsSync, readFileSync } = await import('node:fs');
    const chest = new URL(`../../../src/sculpt/assets/lowscalechest-${who}.json`, import.meta.url).pathname;
    const drop = existsSync(chest) ? new Set(JSON.parse(readFileSync(chest, 'utf8')).hides) : null;
    const rig = buildRig(who), G = buildScaleLegs(rig, { drop });
    const file = new URL(`../../../src/sculpt/assets/lowscalelegs-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/scalelegs.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides, ...(G.dropFrom !== undefined ? { dropFrom: G.dropFrom } : {}) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${G.polys.length} polygons, ${A.hides.length} body polygons hidden: wrote`, file.pathname);
  }
}
