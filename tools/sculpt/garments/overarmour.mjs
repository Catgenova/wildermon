// What a shawl worn "over armour" is fitted over: every chest piece a body can wear under a shawl, at rest, read from the
// game's own copies (src/sculpt/assets/low<chest>-<who>.json: the leather chest, the plate chest, the hauberk and the
// scale cuirass, the tunic under them all), so one fit clears whichever is worn. Each is { verts, tris, polys, vw } in
// the rig's frame (lowgarment.mjs's garment form), its weights the body's bones.
//
//   armourUnder(rig, names?) → [{ name, verts, tris: [{ v, poly }], polys: [{ v, mat }], vw }]
//   overRig(rig, chests, keep?) → the rig with those surfaces beside the body's (transferWeights: a shawl's cape takes
//     the weights of the closest of the body's and the chests' surfaces, so it moves as what it lies on moves)
import { readFileSync } from 'node:fs';

/** The chest pieces worn under a shawl, by their game copy's name. */
export const ARMOUR_CHESTS = ['lowleatherchest', 'lowplatechest', 'lowchainchest', 'lowscalechest'];

/** A garment's game copy (`garmentAsset`) back in the tools' form. */
export function assetGarment(who, name) {
  const A = JSON.parse(readFileSync(new URL(`../../../src/sculpt/assets/${name}-${who}.json`, import.meta.url), 'utf8'));
  const verts = [];
  for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const tris = [];
  for (let i = 0; i < A.tris.length; i += 4) tris.push({ v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]], poly: A.tris[i + 3] });
  const polys = A.polys.map(([v, m]) => ({ v, mat: A.mats[m] }));
  const vw = A.weights.map((l) => { const o = []; for (let j = 0; j < l.length; j += 2) o.push([l[j], l[j + 1]]); return o; });
  if (A.bones?.length) throw new Error(`${name}-${who} has bones of its own: not a chest a shawl is fitted over`);
  return { name, verts, tris, polys, vw };
}

/** The chests a shawl worn over armour clears, at rest (above `below`, in the body's units: the skirts and hems left out). */
export function armourUnder(rig, names = ARMOUR_CHESTS, { below = rig.who === 'female' ? -3.9 : -4.6 } = {}) {
  return names.map((n) => {
    const C = assetGarment(rig.who, n);
    return { ...C, tris: C.tris.filter((t) => t.v.some((i) => C.verts[i][1] > below)) };
  });
}

/** The rig with the chests' surfaces beside the body's (their vertices and weights after the body's). */
export function overRig(rig, chests, keep = () => true) {
  let n = rig.B.verts.length;
  const verts = [...rig.B.verts], tris = [...rig.B.tris], vw = [...rig.vw];
  for (const C of chests) {
    for (const t of C.tris) if (keep(C, t)) tris.push({ ...t, v: t.v.map((i) => i + n) });
    verts.push(...C.verts);
    vw.push(...C.vw);
    n += C.verts.length;
  }
  return { ...rig, B: { ...rig.B, verts, tris }, vw };
}
