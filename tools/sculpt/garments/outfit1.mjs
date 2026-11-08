// The first outfit worn whole on a low-poly body, each layer fitted over the ones under it: the trousers on the body
// (garments/trousers.mjs), the tunic over the trousers (garments/tunic.mjs, `under`), the shawl over the tunic
// (garments/shawl.mjs, `under`); each skinned to the body's rig, and the body's polygons the trousers and the tunic cover
// whole (their `hides`).
//
//   buildOutfit(rig) → { trousers, tunic, shawl } (each with its weights, vw), hides: { trousers, tunic }
//
//   node tools/sculpt/garments/outfit1.mjs
//     writes the game's copies of the tunic and the shawl beside each body (src/sculpt/assets/lowtunic-<who>.json,
//     lowshawl-<who>.json; lowgarment.mjs garmentAsset, the tunic's with `hides`); the trousers' are written by
//     garments/trousers.mjs (fitted to the body alone, they are the same either way)
import { buildTrousers, trousersWeights, hiddenPolys as trousersHides } from './trousers.mjs';
import { buildTunic, tunicWeights, hiddenPolys as tunicHides, MATS as TUNIC_MATS, LOOKS as TUNIC_LOOKS } from './tunic.mjs';
import { buildShawl, shawlWeights, MATS as SHAWL_MATS, LOOKS as SHAWL_LOOKS } from './shawl.mjs';

export function buildOutfit(rig) {
  const trousers = buildTrousers(rig);
  trousers.vw = trousersWeights(rig, trousers);
  const tunic = buildTunic(rig, undefined, { under: [trousers] });
  tunic.vw = tunicWeights(rig, tunic);
  const shawl = buildShawl(rig, undefined, { under: [tunic] });
  shawl.vw = shawlWeights(rig, shawl);
  return { trousers, tunic, shawl, hides: { trousers: trousersHides(rig, trousers), tunic: tunicHides(rig, tunic) } };
}

/** The game's copies of the tunic and the shawl (the trousers' are garments/trousers.mjs's). */
export async function writeAssets(which = ['tunic', 'shawl']) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), O = buildOutfit(rig);
    for (const what of which) {
      const G = O[what], file = new URL(`../../../src/sculpt/assets/low${what}-${who}.json`, import.meta.url);
      const A = { built: 'node tools/sculpt/garments/outfit1.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, what === 'tunic' ? TUNIC_MATS : SHAWL_MATS, what === 'tunic' ? TUNIC_LOOKS : SHAWL_LOOKS), ...(what === 'tunic' ? { hides: O.hides.tunic } : {}) };
      writeFileSync(file, JSON.stringify(A));
      console.log(who, what, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones${A.hides ? `, ${A.hides.length} body polygons hidden` : ''}: wrote`, file.pathname);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await writeAssets();
