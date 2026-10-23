import {
  boards, extrude, grain, lathe, slab, stud, warped,
  type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type Pt, type V3,
} from './core';
import { leg, LEG_W, rod, splayed, topBoards, woodSide, woodSides, woodTones } from './woodwork';

/**
 * The stool and the bench (`stool`, one subtile; `bench`, two by one), in
 * the kit, of a set with the chair (`chair.ts`): its seat height and
 * thickness, its legs, its low stretchers a step deeper, its turned knobs
 * and its one gold stud.
 *
 * A stool is a round seat of two boards on three legs splayed out under it,
 * braced low by three rails. A bench is a long seat of two boards on four of
 * the chair's legs with an apron under it, side stretchers and a long one
 * between them, and a back raked as it rises: two posts with knobs, a low
 * rail, and a crest rail arched over its middle with the stud in its front.
 * Of wood alone, so a dye is a paint over all of it.
 */

/** The chair's seat: its underside and top, and the foot of the apron under it. */
const SEAT_Z0 = 3.85, SEAT_Z1 = 4.55, APRON_Z = 3.25;

/* ---- the stool ---------------------------------------------------------------------- */

/** The seat's radius, the legs' heads and feet out from the middle, how thick, and how high the rails between them. */
const STOOL_R = 2.6, HEAD_R = 1.3, FOOT_R = 2.6, STOOL_LEG = 0.85, RAIL_Z = 1.55;
/** One leg straight behind, two in front. */
const STOOL_AT = [-90, 30, 150].map((d) => (d * Math.PI) / 180);

function stoolOf(look: KitLook): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const legAt = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  STOOL_AT.forEach((a, i) => parts.push({ faces: splayed(legAt(a, FOOT_R), legAt(a, HEAD_R), SEAT_Z0, STOOL_LEG, WOOD, 11 + i * 5) }));
  // The rails, from leg to leg at the height they cross it.
  const k = RAIL_Z / SEAT_Z0;
  const railAt = (a: number): V3 => {
    const [fx, fy] = legAt(a, FOOT_R), [hx, hy] = legAt(a, HEAD_R);
    return [fx + (hx - fx) * k, fy + (hy - fy) * k, RAIL_Z];
  };
  for (let i = 0; i < 3; i++) parts.push({ faces: rod(railAt(STOOL_AT[i]), railAt(STOOL_AT[(i + 1) % 3]), 0.24, END, 6) });
  // The seat: round, its edge softened above and below, two boards across it.
  const ring = (z: number, r: number): [number, number] => [z, r];
  parts.push({
    faces: lathe(0, 0, [ring(SEAT_Z0, STOOL_R - 0.2), ring(SEAT_Z0 + 0.18, STOOL_R), ring(SEAT_Z1 - 0.2, STOOL_R), ring(SEAT_Z1, STOOL_R - 0.24)], 14, TOP, 10, (kk, i, s) => ({
      crease: kk === 1 ? 0.18 : 0.22,
      ...(kk === 1 ? { paint: (g, c) => grain(g, c.fill, s.w, s.h, 40 + i, 'x', 0.3) } : {}),
    })).map((f, i, all) => (i === all.length - 1 ? { ...f, crease: 0.4, paint: (g, c) => { g.save(); g.translate(-STOOL_R, -STOOL_R); boards(g, c.fill, STOOL_R * 2, STOOL_R * 2, 2, 33, 'y'); g.restore(); } } : f)),
    edges: true,
  });
  const r = FOOT_R + 0.5;
  return { parts, shade: [[-r, -r, 0], [r, -r, 0], [r, r, 0], [-r, r, 0]] };
}

/* ---- the bench ---------------------------------------------------------------------- */

/** The seat's half length, back and front; the legs out along it, front and back. */
const BENCH_X = 8.5, BENCH_Y0 = -2.3, BENCH_Y1 = 2.45;
const BLEG_X = 7.5, BLEG_FRONT = 1.85, BLEG_BACK = -1.6;
/** The back: its posts' tops, the low rail, the crest rail's foot, shoulders and crown; how far back it leans at its top. */
const BPOST_TOP = 7.75, BRAIL_Z0 = 5.55, BRAIL_Z1 = 6.05, BCREST_Z0 = 6.6, BCREST_Z1 = 7.45, BCREST_CROWN = 7.95, BRAKE = 0.45;
const benchRaked = (p: V3): V3 => [p[0], p[1] - (BRAKE * Math.max(0, p[2] - SEAT_Z1)) / (BPOST_TOP - SEAT_Z1), p[2]];

function benchOf(look: KitLook): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const solid = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The legs; the back two go on over the seat as posts.
  ([[-BLEG_X, BLEG_BACK], [BLEG_X, BLEG_BACK], [BLEG_X, BLEG_FRONT], [-BLEG_X, BLEG_FRONT]] as Pt[]).forEach(([x, y], i) => solid(leg(x, y, 0, SEAT_Z0, WOOD, 11 + i * 4)));
  // The side stretchers low between front and back legs, and the long one between them.
  for (const x of [-BLEG_X, BLEG_X]) solid(slab(x - 0.22, x + 0.22, BLEG_BACK + LEG_W / 2, BLEG_FRONT - LEG_W / 2, 1.15, 1.6, END, { corner: 0.08 }));
  solid(slab(-BLEG_X + 0.22, BLEG_X - 0.22, 0, 0.44, 1.15, 1.6, END, { corner: 0.08, paint: { front: woodSide(5, 'x', 0.5), back: woodSide(6, 'x', 0.5) } }));
  // The apron under the seat, between the legs.
  solid(slab(-BENCH_X + 0.42, BENCH_X - 0.42, BENCH_Y0 + 0.45, BENCH_Y1 - 0.4, APRON_Z, SEAT_Z0, END, { paint: woodSides(51, 'x') }));
  // The seat: two boards along it, its edges softened.
  solid(slab(-BENCH_X, BENCH_X, BENCH_Y0, BENCH_Y1, SEAT_Z0, SEAT_Z1, TOP, {
    corner: 0.42, bevel: 0.2, paint: { top: topBoards(2, 61, 'x'), ...woodSides(62, 'x') },
  }), { edges: true });

  // The back, raked: the posts and their knobs, and the rails between them.
  for (const [i, x] of [-BLEG_X, BLEG_X].entries()) {
    solid(warped(slab(x - LEG_W / 2, x + LEG_W / 2, BLEG_BACK - LEG_W / 2, BLEG_BACK + LEG_W / 2, SEAT_Z1, BPOST_TOP, WOOD, {
      corner: 0.16, bevel: 0.14, paint: woodSides(71 + i * 4, 'y'),
    }), benchRaked));
    solid(warped(lathe(x, BLEG_BACK, [[BPOST_TOP - 0.05, 0.36], [BPOST_TOP + 0.16, 0.46], [BPOST_TOP + 0.38, 0.38], [BPOST_TOP + 0.54, 0.18], [BPOST_TOP + 0.6, 0.02]], 8, TOP), benchRaked), { edges: true });
  }
  const inner = BLEG_X - LEG_W / 2 + 0.05;
  const rail = (outline: Pt[], z0: number, z1: number, thick: number, seed: number, studded: boolean): KitPart => solid(warped(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, BLEG_BACK - thick / 2, BLEG_BACK + thick / 2, WOOD, 0.14, {
    front: (g, k) => {
      g.save(); g.translate(-inner, z0); grain(g, k.fill, inner * 2, z1 - z0, seed, 'x', 0.6); g.restore();
      if (studded) stud(g, 0, (BCREST_Z0 + BCREST_Z1) / 2 + 0.1, 0.42);
    },
    back: (g, k) => { g.save(); g.translate(-inner, z0); grain(g, k.fill, inner * 2, z1 - z0, seed + 1, 'x', 0.6); g.restore(); },
  }), benchRaked), { edges: true });
  rail([[-inner, BRAIL_Z0], [inner, BRAIL_Z0], [inner, BRAIL_Z1], [-inner, BRAIL_Z1]], BRAIL_Z0, BRAIL_Z1, 0.5, 81, false);
  const rise = (k: number): number => BCREST_Z1 + (BCREST_CROWN - BCREST_Z1) * k;
  const crest: Pt[] = [[-inner, BCREST_Z0], [inner, BCREST_Z0], [inner, BCREST_Z1]];
  for (const u of [0.75, 0.45, 0.18, 0, -0.18, -0.45, -0.75]) crest.push([u * inner, rise(1 - u * u)]);
  crest.push([-inner, BCREST_Z1]);
  rail(crest, BCREST_Z0, BCREST_CROWN, 0.62, 91, true);
  return { parts, shade: [[-BENCH_X, BENCH_Y0, 0], [BENCH_X, BENCH_Y0, 0], [BENCH_X, BENCH_Y1, 0], [-BENCH_X, BENCH_Y1, 0]] };
}

export const STOOL: KitPiece = { model: (look) => stoolOf(look), uses: { tint: true, material: true } };
export const BENCH: KitPiece = { model: (look) => benchOf(look), uses: { tint: true, material: true } };
