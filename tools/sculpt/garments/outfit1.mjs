// The first outfit worn whole on a low-poly body, each layer fitted over the ones under it: the trousers on the body
// (garments/trousers.mjs), the tunic over the trousers (garments/tunic.mjs, `under`), the shawl over the tunic
// (garments/shawl.mjs, `under`); each skinned to the body's rig, and the body's polygons the trousers and the tunic cover
// whole (their `hides`).
//
//   buildOutfit(rig) → { trousers, tunic, shawl } (each with its weights, vw), hides: { trousers, tunic }
//   buildShawlOver(rig, O, fit) → the shawl worn over armour, in two fits (FITS): `slim` over the hauberk, close over it as
//     the tunic's (lowshawloverslim-<who>.json), `full` over every chest piece, the leather chest's, the plate chest's and
//     the cuirass's pauldrons and collars (lowshawlover-<who>.json), each fitted over the
//     tunic and its chests at once (garments/overarmour.mjs), so it clears whichever of them is worn; the plain shawl's
//     bones (the copies share them in the game), its weights from the closest of the body's and the chests' surfaces
//
//   node tools/sculpt/garments/outfit1.mjs
//     writes the game's copies of the tunic and the shawl beside each body (src/sculpt/assets/lowtunic-<who>.json,
//     lowshawl-<who>.json, lowshawlover-<who>.json; lowgarment.mjs garmentAsset, the tunic's with `hides`); the trousers' are written by
//     garments/trousers.mjs (fitted to the body alone, they are the same either way)
import { buildTrousers, trousersWeights, hiddenPolys as trousersHides } from './trousers.mjs';
import { buildTunic, tunicWeights, hiddenPolys as tunicHides, MATS as TUNIC_MATS, LOOKS as TUNIC_LOOKS } from './tunic.mjs';
import { buildShawl, shawlWeights, DESIGN as SHAWL_DESIGN, MATS as SHAWL_MATS, LOOKS as SHAWL_LOOKS } from './shawl.mjs';
import { armourUnder, overRig } from './overarmour.mjs';

export function buildOutfit(rig) {
  const trousers = buildTrousers(rig);
  trousers.vw = trousersWeights(rig, trousers);
  const tunic = buildTunic(rig, undefined, { under: [trousers] });
  tunic.vw = tunicWeights(rig, tunic);
  const shawl = buildShawl(rig, undefined, { under: [tunic] });
  shawl.vw = shawlWeights(rig, shawl);
  return { trousers, tunic, shawl, hides: { trousers: trousersHides(rig, trousers), tunic: tunicHides(rig, tunic) } };
}

/**
 * The design worn over armour: the plain one's, with OVER's changes (and SHAWL_OVER_ARMOUR's, JSON { male, female }, for
 * trying a change).
 */
export const OVER = {
  male: { OUT: 0.12, IN: 0.06 },
  female: { OUT: 0.11, IN: 0.055 },
};
const deep = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deep(a[k], v) : v; return a; };
export function designOver(who) {
  const D = deep(structuredClone(SHAWL_DESIGN[who]), OVER[who] ?? {});
  if (process.env.SHAWL_OVER_ARMOUR) deep(D, JSON.parse(process.env.SHAWL_OVER_ARMOUR)[who] ?? {});
  return D;
}
/** The chests each fit over armour is built over. */
export const FITS = { slim: ['lowchainchest'], full: ['lowleatherchest', 'lowplatechest', 'lowchainchest', 'lowscalechest'] };
/** The shawl worn over armour (over the tunic and its fit's chest pieces at rest), on the plain shawl's bones. */
export function buildShawlOver(rig, O = buildOutfit(rig), fit = 'full', design = designOver(rig.who)) {
  const chests = armourUnder(rig, FITS[fit]);
  const G = buildShawl(rig, design, { under: [O.tunic, ...chests] });
  if (G.bones.length !== O.shawl.bones.length) throw new Error('the shawl over armour has bones the plain one has not');
  G.bones = O.shawl.bones;
  G.vw = shawlWeights(rig, G, { from: overRig(rig, chests) });
  return G;
}

/** The game's copies of the tunic and the shawl, plain and over armour (the trousers' are garments/trousers.mjs's). */
export async function writeAssets(which = ['tunic', 'shawl', 'shawlover', 'shawloverslim']) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), O = buildOutfit(rig);
    if (which.includes('shawlover')) O.shawlover = buildShawlOver(rig, O, 'full');
    if (which.includes('shawloverslim')) O.shawloverslim = buildShawlOver(rig, O, 'slim');
    for (const what of which) {
      // (the tunic's skirt over every legs piece: garments/overlegs.mjs; after the shawls' fits, which it does not reach)
      if (what === 'tunic') (await import('./overlegs.mjs')).overLegs(rig, O.tunic, 'tunic');
      const G = O[what], file = new URL(`../../../src/sculpt/assets/low${what}-${who}.json`, import.meta.url);
      const A = { built: 'node tools/sculpt/garments/outfit1.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, what === 'tunic' ? TUNIC_MATS : SHAWL_MATS, what === 'tunic' ? TUNIC_LOOKS : SHAWL_LOOKS), ...(what === 'tunic' ? { hides: O.hides.tunic } : {}) };
      writeFileSync(file, JSON.stringify(A));
      console.log(who, what, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones${A.hides ? `, ${A.hides.length} body polygons hidden` : ''}: wrote`, file.pathname);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await writeAssets();
