import { merge, orbAlong, smile, tube } from './beasts';
import { type Mat, type Mesh, type V3 } from './figure';

/**
 * What the settlement's own hands shared, and other kinds still draw with:
 * a small round snout, and a tail of links. The hands themselves are each a
 * line of their own now (the brambo the Bramblet, `./wild-deer`; the salva the
 * Herbpup, `./wild-herbpup`; the kemma the Whispling, `./wild-owl`; the sheela
 * the Shearling, `./wild-shear`; the tanna the Peltling, `./wild-pelt`; the
 * carra the Lognib, `./wild-log`).
 */

/** A small round muzzle out in front of the eyes with a nose on it and a mouth under. */
export function snout(at: number, z: number, r: V3, nose: number, n: number, k: number, mat: Mat = 'muzzle'): Mesh {
  const c: V3 = [0, at, z];
  return merge(
    orbAlong(c, [0, 1, -0.1], r, n, k, mat),
    orbAlong([0, at + r[2] * 0.9, z + r[1] * 0.35], [0, 1, 0.2], [nose, nose * 0.7, nose * 0.75], 6, 3, 'nose'),
    smile([0, at + r[2] * 0.75, z - r[1] * 0.55], [0, 1, -0.6], r[0] * 0.5),
  );
}

/** A tail of links, each a short tube, the tip of the last pointing back along -y. */
export function links(r: readonly number[], len: number, n: number, mat: Mat | ((ring: number, j: number) => Mat)): Mesh[] {
  return r.slice(0, -1).map((r0, q) => tube([[0, 0.1, 0], [0, 0, 0], [0, -len, 0]], [r0, r0, r[q + 1]], [r0, r0, r[q + 1]], n, mat, { seam: q === r.length - 2 ? 'start' : 'both' }));
}
