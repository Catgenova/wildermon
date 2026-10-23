import {
  boards, deeper, halfOf, IRON, nail, paler, sheen, slab, woodTone,
  type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type SlabOpts,
} from './core';
import { grained, topGrain } from './joinery';

/**
 * A wildermon crate (`creature_crate`, two subtiles by two), in the kit: a
 * boarded floor, a post at each corner, and open sides -- a deep rail at the
 * foot, a rail at the head, a slat between and two bars -- so whatever is
 * inside can be seen. Its lid is two slats with the two iron ribbons of its
 * bill strapped across them, and an iron hasp hangs on its front.
 *
 * Drawn in two layers (`layers`): 0 the floor and whatever is on the far
 * side of the beast, 1 whatever is on the near side and the lid, by which way
 * it is seen (`halfOf`); the renderer draws the beast between them, stood on
 * the floor (`CRATE_FLOOR`, 0.7 up), so it is seen inside, behind the slats.
 * Drawn whole while it is empty. The wood is what it was built of; dyed, it
 * is painted and the iron is left bare.
 */

/** Half its width either way, how tall its sides are, half a post, and its floor's top. */
const X = 8, H = 10, P = 0.7, FL = 0.7;
/** The inside of its posts and rails: the floor's edge. */
const IN = X - 2 * P;

function crateOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const RAIL = paler(WOOD, 0.04);
  const FLOOR = deeper(WOOD, 0.2);
  const parts: KitPart[] = [];
  const add = (faces: Face[], layer: KitPart['layer']): KitPart => {
    const p: KitPart = { faces, layer };
    parts.push(p);
    return p;
  };
  const rail = { front: grained(31, 'x'), back: grained(32, 'x'), left: grained(33, 'x'), right: grained(34, 'x'), top: topGrain(35, 'x', 0.5) };
  const bar = { front: grained(41, 'y'), back: grained(42, 'y'), left: grained(43, 'y'), right: grained(44, 'y') };

  // The floor, boarded, between the posts and the deep foot rails.
  add(slab(-IN, IN, -IN, IN, 0, FL, FLOOR, {
    paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 5, 11, 'x'); g.restore(); } },
  }), 0);
  // The posts at its corners.
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * (X - P), b * (X - P)])) {
    add(slab(cx - P, cx + P, cy - P, cy + P, 0, H + 0.3, WOOD, {
      corner: 0.15, bevel: 0.18,
      paint: { front: grained(21, 'y'), back: grained(22, 'y'), left: grained(23, 'y'), right: grained(24, 'y') },
    }), halfOf(cx, cy));
  }
  // The four sides, each in the half of the beast it stands.
  for (const [nx, ny] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const layer = halfOf(nx * X, ny * X);
    const along = nx === 0;
    /** A member along the side from a to b, t deep into it from its outer face, between two heights. */
    const run = (a: number, b: number, t: number, z0: number, z1: number, paint: SlabOpts['paint'], tone = WOOD): Face[] => {
      const o = (along ? ny : nx) * X, i = o - Math.sign(o) * t;
      const [p0, p1] = [Math.min(o, i), Math.max(o, i)];
      return along ? slab(a, b, p0, p1, z0, z1, tone, { corner: 0.06, paint }) : slab(p0, p1, a, b, z0, z1, tone, { corner: 0.06, paint });
    };
    add(run(-IN, IN, 2 * P, 0, FL + 1.1, rail, RAIL), layer);
    add(run(-IN, IN, 0.7, H - 1, H, rail, RAIL), layer);
    const m0 = H * 0.55 - 0.4, m1 = H * 0.55 + 0.4;
    add(run(-IN, IN, 0.6, m0, m1, rail), layer);
    for (const c of [-IN / 3, IN / 3]) {
      add(run(c - 0.26, c + 0.26, 0.45, FL + 1.1, m0, bar), layer);
      add(run(c - 0.26, c + 0.26, 0.45, m1, H - 1, bar), layer);
    }
    // The hasp, on the front: an iron plate hung over the head rail.
    if (ny === 1) {
      add(slab(-0.7, 0.7, X, X + 0.22, H - 2.1, H - 0.3, IRON, {
        corner: 0.08,
        paint: { front: (g, k, s) => { sheen(g, k.fill, s.w, s.h, 5); nail(g, k.fill, s.w / 2, s.h - 0.35, 0.14); nail(g, k.fill, s.w / 2, 0.45, 0.16); } },
      }), layer);
    }
  }
  // The lid: two slats, and the iron ribbons strapped across them.
  for (const y of [-X * 0.42, X * 0.42]) {
    add(slab(-X + 0.3, X - 0.3, y - 1, y + 1, H, H + 0.6, RAIL, { corner: 0.1, bevel: 0.12, paint: { top: topGrain(51, 'x', 0.7), front: grained(52, 'x'), back: grained(53, 'x') } }), 1);
  }
  for (const x of [-X * 0.45, X * 0.45]) {
    add(slab(x - 0.42, x + 0.42, -X + 0.3, X - 0.3, H + 0.6, H + 0.82, IRON, {
      paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); sheen(g, k.fill, s.w, s.h, 7); for (const t of [0.12, 0.5, 0.88]) nail(g, k.fill, s.w / 2, s.h * t, 0.14); g.restore(); } },
    }), 1);
  }
  return { parts, shade: [[-X, -X, 0], [X, -X, 0], [X, X, 0], [-X, X, 0]] };
}

export const CREATURE_CRATE: KitPiece = {
  model: (look) => crateOf(look),
  uses: { tint: true, material: true },
  layers: 2,
};
