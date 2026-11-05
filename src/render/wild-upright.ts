import { add, cross, merge, onEgg, paint, scale, sub, TAU, tube, unit, type BipedSpec, type Disc } from './beasts';
import type { Mesh, V3 } from './figure';
import { MONSTER_GROWTH } from './monster-size';

/**
 * What the ones that stand up share: the bad things of the high ground --
 * the goblin, the orc and the ogre -- their glower and the ogre's bones. Each
 * is three subspecies drawn in a module of its own: the goblin's in
 * `./wild-goblin`, the orc's in `./wild-orc`, the ogre's in `./wild-ogre`.
 * (The tinka is the mend line now, `./wild-mend`.)
 */

/* ---- a monster's face -------------------------------------------------------------- */

/** The corners of a flat shape, in the order that makes it face out along `n` (the way `render` tells which way a facet faces). */
function outward(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}

/**
 * The glower the bad things of the high ground have instead of the round
 * eyes every other wildermon looks back with: over eyes made by `eyes` with
 * the same `dir`, `size` and `tall`, a lid on the top of each whose lower edge
 * is a straight line sloping down toward the nose -- `drop` of the eye's
 * height down at its middle, lower by `slope` of it at the inner corner --
 * and above it a heavy brow along the skin, sloping the same way and
 * thickest over the nose. The lids are painted on the head, after its eyes;
 * the brows are a piece of their own, drawn over the head.
 */
export function glower(c: V3, r: V3, dir: V3, size: number, o: { tall?: number; drop?: number; slope?: number; brow?: number } = {}): { lids: Mesh; brows: Mesh } {
  const tall = o.tall ?? 1.15, drop = o.drop ?? 0.4, slope = o.slope ?? 0.3, br = o.brow ?? size * 0.3;
  const A = size * 1.12, B = size * tall * 1.12;
  const lids: Disc[] = [];
  const brows: Mesh[] = [];
  for (const s of [1, -1]) {
    const { p, n } = onEgg(c, r, [dir[0] * s, dir[1], dir[2]]);
    // Across the eye toward the nose, and up it.
    let u = unit(cross([0, 0, 1], n));
    if (u[0] * s > 0) u = scale(u, -1);
    let w = cross(n, u);
    if (w[2] < 0) w = scale(w, -1);
    const at = (a: number, b: number, lift: number): V3 => add(add(p, scale(n, lift)), add(scale(u, a), scale(w, b)));
    // The lid: the top of an ellipse a little bigger than the eye, cut off along the sloping line.
    const edge = (a: number): number => B * (1 - 2 * drop) - (slope * B * a) / A;
    const round: Array<[number, number]> = Array.from({ length: 16 }, (_, q) => [Math.cos((q / 16) * TAU) * A, Math.sin((q / 16) * TAU) * B]);
    const lid: Array<[number, number]> = [];
    round.forEach(([a0, b0], q) => {
      const [a1, b1] = round[(q + 1) % round.length];
      const f0 = b0 - edge(a0), f1 = b1 - edge(a1);
      if (f0 >= 0) lid.push([a0, b0]);
      if (f0 >= 0 !== f1 >= 0) lid.push([a0 + ((a1 - a0) * f0) / (f0 - f1), b0 + ((b1 - b0) * f0) / (f0 - f1)]);
    });
    lids.push({ v: outward(lid.map(([a, b]) => at(a, b, 0.06)), n), m: 'lid' });
    // The brow, a little above the lid, laid on the skin.
    const pts = [-1.15, 0, 1.15].map((f) => {
      const on = onEgg(c, r, sub(at(f * A, B * (1.2 - slope * f * 0.9), 0), c));
      return add(on.p, scale(on.n, br * 0.45));
    });
    brows.push(tube(pts, [br * 0.7, br, br * 1.1], [br * 0.6, br * 0.85, br * 0.95], 5, 'coatDark'));
  }
  return { lids: paint(lids), brows: merge(...brows) };
}

export { MONSTER_GROWTH };

/* ---- the ogre ---------------------------------------------------------------------- */

/**
 * The ogre's bones: a hill of shoulder on short legs, a small head sunk in it.
 * Its three subspecies are built on them in `./wild-ogre`.
 */
export const OGRE_SPEC: BipedSpec = {
  high: 1.4,
  leg: { at: [0.62, 0, -0.1], len: [0.62, 0.62, 0.14], rest: [8, -14] },
  chest: { at: [0, 0, 0.3], lean: 18 },
  neck: { at: [0, 0.55, 1.95], len: 0.2, lean: 30 },
  head: { pitch: -4 },
  arm: { at: [1.62, 0.2, 1.75], len: [1.0, 0.95], rest: [6, 20, 18] },
  swing: [22, 32],
  waddle: 8,
  armSwing: 14,
};
