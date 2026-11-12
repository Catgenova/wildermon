// The scale set's boots (the item scale_boots): a dark-soled leather boot with a scale-plate toe cap and an ankle strap
// edged in gold, its shaft laid over at the front and the sides with courses of dragon scale (the shin guard), under a
// short flared cuff of scale-plate below the knee, its gold strip an engraved line that glows when enchanted.
//
//   buildScaleBoots(rig, { under }) → { verts, polys, tris, vw, hides, soles }
//
//   node tools/sculpt/garments/scaleboots.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowscaleboots-<who>.json (lowgarment.mjs garmentAsset,
//     with `hides` and `soles`, the boots' sole vertices the body stands on; loaded by src/sculpt/lowpoly.ts behind the
//     outfit switch `scaleBoots`)
//
// Built on the plate boots (plateboots.mjs buildPlateBoots: the sole, the foot, the ankle band, the shaft and the cuff,
// fitted to each body over what is worn under them: here the plate and the scale leggings' copies beside the body), its
// rib, side plates and crest left out and the cuff's foot raised so the shaft below it is long enough for the scales;
// weighted as the plate boots (plateBootWeights: the foot on the foot's bones, from the ankle band up rigid on the calf),
// the scales on the calf.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { trisOf, unit, add, mul } from '../lowgarment.mjs';
import { buildPlateBoots, plateBootWeights, underOf, DESIGN as PLATE } from './plateboots.mjs';
import { MATS, LOOKS, scalesOn, polyTris, coursesOf } from './scale.mjs';

/** The scales per body (scale.mjs scalesOn), and the cuff's foot (a share of the way up the shin) and its rise at the sides. */
export const SCALE = {
  male: { course: 0.4, w: 0.34, lift: [0.014, 0.065], ridge: 0.024, thick: 0.034, span: [-112, 112], cuff: { lo: 0.7, rise: 0.04 } },
  female: { course: 0.36, w: 0.3, lift: [0.012, 0.056], ridge: 0.02, thick: 0.03, span: [-112, 112], cuff: { lo: 0.58, rise: 0.03 } },
};
/** The plate boots' parts as the scale set's materials, by tag. */
const MAT_OF = {
  sole: 'under', 'sole edge': 'under', welt: 'leather', wall: 'leather', over: 'leather', cap: 'scale', seam: 'under', instep: 'leather',
  'band gold': 'gold', band: 'leather', 'band top': 'gold', greave: 'leather', 'greave top': 'leather', 'cuff gold': 'rune', cuff: 'scale', rim: 'edge', lip: 'under',
};

export function buildScaleBoots(rig, { under = [] } = {}, SC = SCALE[rig.who]) {
  const D = { ...PLATE[rig.who], rib: null, plates: null, crest: null, cuff: { ...PLATE[rig.who].cuff, ...SC.cuff } };
  const G = buildPlateBoots(rig, D, { under });
  G.vw = plateBootWeights(rig, G);
  for (const p of G.polys) p.mat = MAT_OF[p.tag] ?? p.mat;
  G.wt = [];
  const n0 = G.verts.length, p0 = G.polys.length, calf = new Map();
  for (const side of ['L', 'R']) {
    const L = G.legOf[side], ft = G.foot[side];
    // (the greave's face on this side: the shaft between the ankle band and the cuff)
    const T = [];
    G.polys.forEach((p) => { if ((p.tag === 'greave' || p.tag === 'greave top') && G.side[p.v[0]] === side) for (let j = 1; j + 1 < p.v.length; j++) T.push([G.verts[p.v[0]], G.verts[p.v[j]], G.verts[p.v[j + 1]]]); });
    const k0 = 0, top = L.cuffLo(k0) + 0.06, bot = L.bandHi(k0);
    const { us, h } = coursesOf(-top, -bot - SC.course * 0.1, SC.course);
    const dirOf = (v) => unit(add(mul(ft.a, Math.cos(v * Math.PI / 180)), mul(ft.b, Math.sin(v * Math.PI / 180))));
    const before = G.verts.length;
    scalesOn(G, { tris: T }, { h, us, w: SC.w, v: SC.span, lift: SC.lift, ridge: SC.ridge, thick: SC.thick, cast: (u, v) => [L.axis(-u), dirOf(v)], out: (p) => { const c = L.axis(p[1]); return [p[0] - c[0], 0, p[2] - c[2]]; }, wt: null, tag: 'shin scales' });
    for (let i = before; i < G.verts.length; i++) calf.set(i, side);
  }
  const at = new Map(rig.bones.map((b, i) => [b.name, i]));
  for (let i = n0; i < G.verts.length; i++) { G.vw[i] = [[at.get(`calf_${calf.get(i) === 'L' ? 'l' : 'r'}`), 1]]; G.side[i] = calf.get(i); }
  for (const t of trisOf({ polys: G.polys.slice(p0) })) G.tris.push({ v: t.v, poly: t.poly + p0 });
  return G;
}

/** What the boots are built over: the plate and the scale leggings' copies beside the body, where they are. */
export async function undersOf(who) {
  const { existsSync, readFileSync } = await import('node:fs');
  return ['lowplatelegs', 'lowscalelegs'].map((n) => new URL(`../../../src/sculpt/assets/${n}-${who}.json`, import.meta.url).pathname).filter(existsSync).map((f) => underOf(JSON.parse(readFileSync(f, 'utf8'))));
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildScaleBoots(rig, { under: await undersOf(who) });
    const file = new URL(`../../../src/sculpt/assets/lowscaleboots-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/scaleboots.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides, soles: G.soles };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${G.polys.length} polygons, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
