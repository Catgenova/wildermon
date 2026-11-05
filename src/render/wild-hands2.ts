import { pawMesh, type QuadLook } from './beastkit';
import { type Mat, type RGB } from './figure';

/**
 * What the settlement's later hands share: a palette's own colours, a round body of rings, and four paws. The kinds that were
 * here have all gone to lines of their own (the hoppa is the Brewtoad now, `./wild-brewtoad`, the simma the Brothlet,
 * `./wild-broth`, the scurra the Wallkit, `./wild-wall`, the bedda the Sprigkit, `./wild-calico`, the petta the Briarling,
 * `./wild-goat`, the potta the Kilnlet, `./wild-kiln`, the ambra the Saplet, `./wild-maple`, the relka the Kintsu,
 * `./wild-relic`, the sprigga the Lemlet, `./wild-lemur`, and the wurla the Pebblebeak, `./wild-curlew`; the forga is gone,
 * `REMOVED_KINDS`).
 */

export const OWN = (own: Partial<Record<Mat, RGB>>): Partial<Record<Mat, RGB>> => own;

/** A round body of rings, `len` long, `w` wide and `h` deep at its widest, its back rising `rise` toward the shoulders. */
export function barrel(len: number, w: number, h: number, rise = 0.12): QuadLook['body'] {
  const ys = [-0.5, -0.4, -0.2, 0.04, 0.26, 0.42, 0.5].map((f) => f * len);
  const k = [0.25, 0.82, 0.96, 1, 0.95, 0.8, 0.26];
  return { y: ys, z: ys.map((_, q) => 0.08 + rise * (q / 6)), w: k.map((f) => f * w), h: k.map((f) => f * h), belly: true };
}

/** The usual four paws, `r` across, the legs `legs` long and `thick` thick. */
export function paws(n: number, k: number, legs: number, thick: number, r: number, mat: Mat = 'coatLight'): Pick<QuadLook, 'fore' | 'hind'> {
  return {
    fore: { upper: [0.26, -legs * 0.5, thick, thick * 0.86], lower: [0, -legs * 0.46, thick * 0.86, thick * 0.78], foot: pawMesh(r, n, k, mat) },
    hind: { upper: [0.28, -legs * 0.52, thick * 1.1, thick * 0.94], lower: [0, -legs * 0.48, thick * 0.86, thick * 0.78], foot: pawMesh(r, n, k, mat) },
  };
}
