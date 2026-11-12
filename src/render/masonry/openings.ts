import { TH, TW } from './draw';
import type { Ctx } from './types';

/**
 * Where the openings are cut in a section, as fractions of it and in its pixels: archway,
 * window, bay, doorway, cart gate, and a garden wall's gate.
 */

/**
 * Where an archway is cut, as fractions of a wall section.
 *
 * `t0` and `t1` are how far along the wall the jambs stand and `spring` how
 * far up it the curve starts. The rise is not here because it is not a free
 * number: a true semicircle rises by exactly the half span, and the renderer
 * works that out from these two in the units it already has.
 *
 * One statement, read by the texture that cuts the hole and by the renderer
 * that clips to it, because a hole in a picture and a hole in a wall that do
 * not agree is a wall with a seam of daylight round its doorway.
 *
 * Two numbers set by looking at it rather than by arithmetic.
 *
 * The head has to come down inside the wall: at half the storey the crown of
 * a 1.9 m opening stood 2.5 m up a 3 m wall, which leaves half a metre for
 * the ring that holds it and the course over that, so the ring ran off the
 * top of the section.
 *
 * And the straight part has to be longer than the curve is wide, or the
 * opening is a headstone. A semicircle on jambs its own radius long is the
 * shape of a grave marker and the eye says so before it says doorway. These
 * spans put the jamb at half again the radius: 1.7 m wide, 2.1 m to the
 * crown, and a course of field stone over the ring before the band.
 */
export const ARCH = { t0: 0.29, t1: 0.71, spring: 0.42 } as const;

/**
 * And where a window is cut, in the same fractions.
 *
 * Taller than the old one and a little narrower, for the reason a window in
 * rubble is always taller than it is wide: everything over it has to stand on
 * what is either side of it. The head comes down to 2.1 m so there is room
 * between it and the band for the lintel and the course of small wedges over
 * that, which is how a wall like this gets a metre and a third of nothing to
 * stay up.
 */
export const WINDOW = { t0: 0.33, t1: 0.67, k0: 0.3, k1: 0.7 } as const;

/**
 * And where a doorway is cut. It starts at the ground, so it has no `k0`.
 *
 * The numbers are the ones every other material's door has always used. A
 * doorway is the one opening whose size is settled by the man walking through
 * it rather than by what will stand up over it: 1.3 m by 2.2 m.
 */
export const DOOR = { t0: 0.34, t1: 0.66, k1: 0.74 } as const;

/**
 * And a cart gate, which is the same doorway twice as wide.
 *
 * Its head is a little lower than the single one's, and for a reason worth
 * saying: two and a half metres is further than the oak over it will go
 * unaided, so there is a corbel under each end of the beam and a corbel wants
 * a course to sit in. A gate is wide, not tall -- you drive a cart through it,
 * and a cart is not two and a quarter metres high.
 */
export const DOUBLE = { t0: 0.2, t1: 0.8, k1: 0.7 } as const;

/**
 * And a bay, which is a window that does not stay in the wall.
 *
 * Narrower than the old one, and for a reason the picture cares about and the
 * flat colours did not: the jambs of an opening this wide are drawn stones,
 * and at 0.18 they reached into the courses that straddle the section's seam
 * and cut them in half. At 0.24 there is a stone's width of ordinary field
 * between the jamb and the seam, so a bay butts its neighbours like anything
 * else. The head comes down for the same reason the window's did -- the
 * lintel and the wedges over it have to fit under the band.
 */
export const BAY = { t0: 0.24, t1: 0.76, k0: 0.33, k1: 0.72 } as const;

/**
 * And where a gate goes in a field wall.
 *
 * There is no wall over it to hold up, so the gap runs clear to the top and
 * the two piers either side of it carry nothing but themselves. That is what
 * a gate in a dry wall is: a hole, and a squarer bit of walling at each edge
 * of it so the hole keeps its shape when a cart clips it.
 */
export const FENCE_GAP = { t0: 0.2, t1: 0.8 } as const;

/* ---- the archway ------------------------------------------------------- */
/*
 * A rough cobbled archway whose shape is not rough at all.
 *
 * That is the whole of the idea. A novice can lay a true arch without being
 * able to cut a stone: he strikes the curve off a centre, props a former
 * under it, and jams whatever he has against it until it stands. The line of
 * the opening is therefore exact and everything touching it is not -- wedges
 * of no two depths, joints that are not quite radial, and a ragged pocket of
 * mortar where the field stones were broken away to make room.
 *
 * It is drawn in that order and cut last. Every stone of the ring is laid
 * generously, overhanging into the opening, and then the hole is taken out
 * of the lot of them in one pass -- so the intrados is a circle struck by a
 * compass, and the stone either side of it was shaped by somebody with a
 * hammer and no great hurry.
 */
export const A_CX = TW * (ARCH.t0 + ARCH.t1) / 2;

/*
 * The half span, and the rise, which are the same number.
 *
 * A section is four metres across and three high at 128 px to the metre both
 * ways, so a circle in the world is a circle in the picture and one radius
 * does for both. The renderer works the rise out from the same two spans and
 * arrives at the same place, which is what lets its clip and this hole agree.
 */
export const A_R = TW * (ARCH.t1 - ARCH.t0) / 2;

export const A_CY = TH * (1 - ARCH.spring);

/** The opening: two jambs and a true semicircular head. */
export function openingPath(g: Ctx): void {
  g.beginPath();
  g.moveTo(A_CX - A_R, TH);
  g.lineTo(A_CX - A_R, A_CY);
  g.arc(A_CX, A_CY, A_R, Math.PI, Math.PI * 2);
  g.lineTo(A_CX + A_R, TH);
  g.closePath();
}

/** How far every stone of the opening is laid into it, to be cut off again. */
export const OVER = 10;

/** How deep the impost is, which is also where the jamb starts. */
export const IMPOST_H = 20;

/* ---- the window --------------------------------------------------------- */
/*
 * A hole with something over it.
 *
 * An archway carries itself: the ring is the thing that stands up. A window
 * does not, and a novice's answer to that is always the same one -- a lintel
 * big enough to bridge the gap, and over the lintel a course of small wedges
 * on a flat curve to take the weight of the wall off it. That relieving arch
 * is the whole character of the asset: it is the piece of the wall that
 * exists only because he knew the lintel would crack if he did not put it
 * there, and it is set with the same hammer and the same want of skill as
 * everything else.
 *
 * Drawn in the order it was built and cut last, like the arch: sill, jambs,
 * lintel, relieving arch, then the rectangle taken out of the lot of them.
 * The opening is square to a hair and nothing round it is.
 */
export const W_X0 = TW * WINDOW.t0, W_X1 = TW * WINDOW.t1;

export const W_HEAD = TH * (1 - WINDOW.k1), W_SILL = TH * (1 - WINDOW.k0);

export const Y_X0 = TW * BAY.t0, Y_X1 = TW * BAY.t1;

export const Y_HEAD = TH * (1 - BAY.k1), Y_SILL = TH * (1 - BAY.k0);

/** How deep the lintel is. */
export const LINTEL = 22;

/** Where the top of it sits under a given head. */
export const lintelTop = (head: number): number => head - LINTEL + 3;

/* ---- the doorway -------------------------------------------------------- */
/*
 * The one opening he did not solve with stone.
 *
 * A window gets a lintel and a course of wedges over it because a window is
 * small. An archway gets a ring because a ring is the thing that stands up.
 * A doorway is a metre and a third across with two and a quarter metres of
 * wall over it, and a man who cannot cut a voussoir is not going to find and
 * dress a stone four feet long either. So he lays a baulk of oak across it
 * and builds on top of that, and the only piece of the wall that is not
 * stone is the piece holding up the most of it.
 *
 * Under the ends of it, where the load comes down, the jamb goes long and
 * short about -- an upright the height of two courses, then a flat one, then
 * an upright -- which is what a rough mason does when he wants a corner to
 * stay where he put it and cannot cut a quoin.
 */
export const D_X0 = TW * DOOR.t0, D_X1 = TW * DOOR.t1;

export const D_HEAD = TH * (1 - DOOR.k1);

export const V_X0 = TW * DOUBLE.t0, V_X1 = TW * DOUBLE.t1;

export const V_HEAD = TH * (1 - DOUBLE.k1);

/** How deep the beam over a doorway is, and how deep the one over a gate. */
export const BEAM = 25, GATE_BEAM = 30;

/** How far a corbel reaches in under the end of a gate's beam. */
export const CORBEL = 42, CORBEL_H = 22;
