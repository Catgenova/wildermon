import {
  add, band, boards, centre, cross, css, deeper, grain, hex, IRON, mix, mul, nail, paler, prism, seam, slab, sub, unit, woodTone,
  type Ctx, type Face, type KitPart, type PaintCtx, type Side, type Tint, type Tone, type V3,
} from './core';
import { YOKE_SPOTS } from '../../game/furniture';
import { UNITS_PER_TILE } from '../iso';

/**
 * The wheeled pieces in the kit: the small cart, the large cart and the wagon,
 * as solids (`KitPart`) for the old builder's scene (`MODELS` in
 * furniture.ts), which keeps what the kit has no stage for -- wheels baked
 * round and turned a step at a time (`bakeRound`), the driver sat between the
 * box's sides. Each is built along its length, the way it goes, `x` toward the
 * shafts or the pole, `y` across to its right, `z` up, from the middle of its
 * footprint; the wheels come back as where they stand, for the scene to turn.
 *
 * Wood by what it was built of (`woodTone`); dyed, the box and the bench are
 * painted in the dye and the running gear -- wheels, axles, sills, pole and
 * yokes -- is left the bare wood, the iron bare.
 */

/** The box of a large cart and of a wagon: ends back and front in from the footprint, sides in from it, its floor, how high its sides rise over that, and the bench's top. */
export const BOX_MEASURES = {
  large_cart: { back: 1, front: 6, side: 3, floor: 6.7, rise: 3.4, bench: 9.4 },
  wagon: { back: 1, front: 8, side: 5, floor: 8.4, rise: 3.8, bench: 11.2 },
};
/** How thick a box's boards are. */
export const BOX_BOARD = { large_cart: 0.6, wagon: 0.7 };
export type BoxKind = keyof typeof BOX_MEASURES;
/** A box's ends along it (`L0` at the back, `L1` at the front), its half-width, its floor, the top of its sides and the top of the bench. */
export function boxOf(kind: BoxKind, hw: number, hd: number): { L0: number; L1: number; W: number; floor: number; top: number; bench: number } {
  const m = BOX_MEASURES[kind];
  return { L0: -hw + m.back, L1: hw - m.front, W: hd - m.side, floor: m.floor, top: m.floor + m.rise, bench: m.bench };
}

/** A wheel as the scene draws it: its middle, radius, how thick, how many spokes, and whether it carries the strake that comes round once a turn. */
export interface WheelAt { c: V3; r: number; thick: number; spokes: number; mark: boolean; front: boolean }
/** A wheeled piece built: its solids, the wheels for the scene to put in and turn, and the floor it shades. */
export interface CartBuilt { parts: KitPart[]; wheels: WheelAt[]; shade: Array<[number, number, number, number]> }

/** How far round a wheel's hub stands out past its face, in units: what its box is grown by, so nothing of it is drawn past the box the piece declares. */
export const HUB_OUT = 0.45;
/** The yokes' height, in units: across the necks of a team in them (`YOKE_SPOTS`). */
const YOKE_Z = 11.5;
/** A yoke's bow round a neck: half as wide as it is, and how far down from the yoke it hangs. */
const BOW_R = 2.1, BOW_DEEP = 3.4;
/** How far out past the front of the box a pole let down meets the ground, in units: it goes down, not out along it. */
const POLE_DOWN = 11;

/* ---- a beam between two points --------------------------------------------------------- */

/**
 * A squared beam from `a` to `b`, `w` across and `h` deep either side of its
 * line, its far end capped: a shaft, a pole, an axle, an evener. Its sides
 * paint along it (`x` from `a`, `y` across), with a faint grain unless told.
 */
function beam(a: V3, b: V3, w: number, h: number, tone: Tone, paint?: ((g: Ctx, k: PaintCtx, s: Side) => void) | null): Face[] {
  const d = unit(sub(b, a));
  let u = cross(d, [0, 0, 1]);
  if (Math.hypot(...u) < 1e-6) u = [1, 0, 0];
  u = unit(u);
  const v = unit(cross(u, d));
  const ringAt = (p: V3): V3[] => [add(add(p, mul(u, -w)), mul(v, -h)), add(add(p, mul(u, w)), mul(v, -h)), add(add(p, mul(u, w)), mul(v, h)), add(add(p, mul(u, -w)), mul(v, h))];
  const ra = ringAt(a), rb = ringAt(b);
  const seed = Math.round(Math.abs(a[0] * 13 + a[1] * 7 + b[2] * 3));
  // `null`: left plain, for what is seen only in glimpses (under the floor, in a bow): painting costs its bake a clip a face.
  const dress = (_k: number, _i: number, s: Side): Partial<Face> => ({ crease: 0.36, ...(paint === null ? {} : { paint: (g: Ctx, k: PaintCtx) => (paint ? paint(g, k, s) : grain(g, k.fill, s.w, s.h, seed, 'x', 0.6)) }) });
  const faces = prism([ra, rb], tone, dress, { crease: 0.3 });
  // The near end, which `prism` leaves open.
  const cap = ra.slice().reverse();
  faces.push({ pts: cap, n: mul(d, -1), tone, crease: 0.3 });
  return faces;
}

/** A beam's sides painted with grain along it and an iron band round it at `at` (shares of its length). */
const banded = (seed: number, at: number[]) => (g: Ctx, k: PaintCtx, s: Side): void => {
  grain(g, k.fill, s.w, s.h, seed, 'x', 0.6);
  for (const t of at) band(g, k, s.w * t - 0.35, s.w * t + 0.35, -0.1, s.h + 0.1, 1, true);
};

/** A top painted with boards run along the piece, from the slab's middle frame. */
const deckOf = (n: number, seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  boards(g, k.fill, s.w, s.h, n, seed);
  g.restore();
};

/** A side of the box: its boards, an iron band under the rim and along the foot, and its nails where the stakes hold it. */
const boardedSide = (n: number, seed: number, stakes: number[], foot: boolean) => (g: Ctx, k: PaintCtx, s: Side): void => {
  boards(g, k.fill, s.w, s.h, n, seed);
  band(g, k, -0.1, s.w + 0.1, s.h - 0.75, s.h - 0.25, Math.max(2, Math.round(s.w / 3.5)), false);
  if (foot) band(g, k, -0.1, s.w + 0.1, 0.15, 0.6, Math.max(2, Math.round(s.w / 4)), false);
  for (const x of stakes) {
    const at = x * s.w;
    for (let j = 0; j < n; j++) nail(g, k.fill, at, ((j + 0.5) / n) * s.h, 0.14);
  }
};

/** A stake up a boarded side, standing proud of its boards: a step deeper, grained up it, a seam each side and a hair of light up its left. */
function stakeUp(g: Ctx, k: PaintCtx, x0: number, x1: number, h: number): void {
  const fill = mix(k.fill, hex('#5a4458'), 0.16);
  g.fillStyle = css(fill);
  g.fillRect(x0, 0, x1 - x0, h);
  grain(g, fill, x1 - x0, h, Math.round(x0 * 7 + 3), 'y', 0.5);
  seam(g, k.fill, x0, 0, x0, h, 0.14);
  seam(g, k.fill, x1, 0, x1, h, 0.14);
  g.fillStyle = css(mix(fill, [255, 248, 232], 0.4), 0.6);
  g.fillRect(x0 + 0.08, 0, 0.12, h);
  nail(g, fill, (x0 + x1) / 2, h * 0.25, 0.14);
  nail(g, fill, (x0 + x1) / 2, h * 0.7, 0.14);
}

/* ---- the three of them ------------------------------------------------------------------- */

/**
 * The small cart: a boarded tray on two wheels, a pair of shafts out ahead
 * of it to take hold of, resting on their ends, and a prop under its tail so
 * it stands level when it is let down.
 */
function smallCart(hw: number, hd: number, body: Tone, gear: Tone): CartBuilt {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => { const p: KitPart = { faces, ...more }; parts.push(p); return p; };
  const L0 = -hw + 1.2, L1 = hw - 5.2, W = hd - 1.6, z0 = 3.6, zb = 4.3, zt = 7.2, t = 0.55;
  const r = 3.3, ax = -2.4, wy = W + 0.75, thick = 0.6;
  const DEEP = deeper(body, 0.2), RIM = paler(body, 0.1), GEAR = gear;
  // The axle under it, the bed laid over the axle on two sills, the tray's floor over them.
  add(beam([ax, -wy + thick / 2 + HUB_OUT, r], [ax, wy - thick / 2 - HUB_OUT, r], 0.32, 0.32, IRON, null));
  for (const s of [-1, 1]) add(slab(L0 + 0.6, L1 - 0.4, s * (W - 1.2) - 0.45, s * (W - 1.2) + 0.45, r + 0.32, z0, GEAR));
  add(slab(L0, L1, -W, W, z0, zb, DEEP, { paint: { top: deckOf(3, 7) } }));
  // Its sides: two boards and an iron band, the ends a step lower so it can be tipped.
  const side = (seed: number) => boardedSide(2, seed, [0.25, 0.75], false);
  add(slab(L0, L1, -W, -W + t, zb, zt, body, { paint: { back: side(11), front: side(12), top: (g, k, s) => grain(g, k.fill, s.w, s.h, 13, 'x', 0.6) } }), { edges: true });
  add(slab(L0, L1, W - t, W, zb, zt, body, { paint: { front: side(14), back: side(15), top: (g, k, s) => grain(g, k.fill, s.w, s.h, 16, 'x', 0.6) } }), { edges: true });
  add(slab(L0, L0 + t, -W + t, W - t, zb, zt - 0.8, RIM, { paint: { left: boardedSide(2, 17, [], false), right: boardedSide(2, 18, [], false) } }), { edges: true });
  add(slab(L1 - t, L1, -W + t, W - t, zb, zt - 0.8, RIM, { paint: { right: boardedSide(2, 19, [], false), left: boardedSide(2, 20, [], false) } }), { edges: true });
  // The prop under its tail.
  add(slab(L0 + 0.9, L0 + 1.5, -0.4, 0.4, 0, z0, GEAR, { paint: { left: (g, k, s) => grain(g, k.fill, s.w, s.h, 21, 'y', 0.5), right: (g, k, s) => grain(g, k.fill, s.w, s.h, 22, 'y', 0.5) } }));
  // The shafts, from under the sills out past its front, down to their ends on the ground, and the bar across them.
  const shaftY = W - 1.2, tip = hw - 0.5;
  for (const s of [-1, 1]) add(beam([L1 - 1.5, s * shaftY, z0 - 0.4], [tip, s * (shaftY - 0.5), 0.7], 0.22, 0.27, GEAR, banded(30 + s, [0.82])));
  const barX = L1 + 2.2, barZ = z0 - 0.4 + ((0.7 - (z0 - 0.4)) * (barX - (L1 - 1.5))) / (tip - (L1 - 1.5));
  add(beam([barX, -shaftY + 0.1, barZ + 0.1], [barX, shaftY - 0.1, barZ + 0.1], 0.2, 0.2, GEAR));
  return { parts, wheels: [-1, 1].map((s) => ({ c: [ax, s * wy, r] as V3, r, thick, spokes: 8, mark: true, front: false })), shade: [[L0, L1, -W - 1, W + 1]] };
}

/**
 * The large cart and the wagon: a staked box body over a pair of sills, a
 * bench across it over the axle, a pole out ahead of it to an evener at its
 * end, and a yoke across the end of that for each pair of the team -- the
 * large cart's one, the wagon's two. The wagon is longer, and stands on four
 * wheels, the front pair smaller and under a turntable and the pole.
 */
function boxCart(kind: BoxKind, hw: number, hd: number, body: Tone, gear: Tone, wheels: { r: number; spokes: number; front?: number }, yoked: boolean): CartBuilt {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => { const p: KitPart = { faces, ...more }; parts.push(p); return p; };
  const { L0, L1, W, floor, top, bench } = boxOf(kind, hw, hd), t = BOX_BOARD[kind];
  const wagon = kind === 'wagon';
  const DEEP = deeper(body, 0.2), RIM = paler(body, 0.1), SEAT = paler(body, 0.14), GEAR = gear, GEAR_DEEP = deeper(gear, 0.15);
  const big = wheels.r, small = big / (wheels.front ?? 1), thick = wagon ? 1 : 0.9, wy = W + (wagon ? 1.25 : 1.2);
  const axles: Array<{ x: number; r: number; front: boolean }> = wagon ? [{ x: -12, r: big, front: false }, { x: 6, r: small, front: true }] : [{ x: -2, r: big, front: false }];
  // The running gear: an axle under each pair, a bolster up from it to the sills, and the sills along under the floor.
  const sill = floor - 0.8, sillY = W - (wagon ? 2.2 : 1.8);
  for (const a of axles) {
    add(beam([a.x, -wy + thick / 2 + HUB_OUT, a.r], [a.x, wy - thick / 2 - HUB_OUT, a.r], 0.42, 0.42, IRON, null));
    add(slab(a.x - 0.75, a.x + 0.75, -sillY - 0.9, sillY + 0.9, a.r + 0.42, sill - 1.1, GEAR_DEEP, { bevel: 0.15 }));
  }
  for (const s of [-1, 1]) add(slab(L0 + 1, L1 - 1, s * sillY - 0.55, s * sillY + 0.55, sill - 1.1, sill, GEAR));
  // The floor, its boards run along it, and the box's four sides.
  add(slab(L0, L1, -W, W, sill, floor, DEEP, { paint: { top: deckOf(wagon ? 6 : 5, 25) } }));
  const n = 3;
  const stakesAt = (len: number): number[] => {
    const m = Math.max(2, Math.round(len / (wagon ? 7 : 6)));
    return Array.from({ length: m + 1 }, (_, i) => i / m);
  };
  const along = stakesAt(L1 - L0);
  // Outside, the stakes that hold it up its face, painted over its boards (a solid apiece would be laid in and out of it).
  const longSide = (seed: number, mirror: boolean) => {
    const stakes = along.map((u) => (mirror ? 1 - u : u));
    return (g: Ctx, k: PaintCtx, sd: Side): void => {
      boardedSide(n, seed, [], wagon)(g, k, sd);
      for (const u of stakes) {
        const x = Math.max(stake, Math.min(sd.w - stake, u * sd.w));
        stakeUp(g, k, x - stake, x + stake, sd.h);
      }
    };
  };
  const inner = (seed: number) => boardedSide(n, seed, [], false);
  const end = (seed: number) => boardedSide(n, seed, [], wagon);
  add(slab(L0, L1, -W, -W + t, floor, top, body, { paint: { back: longSide(31, true), front: inner(32), top: (g, k, s) => grain(g, k.fill, s.w, s.h, 33, 'x', 0.6) } }), { edges: true });
  add(slab(L0, L1, W - t, W, floor, top, body, { paint: { front: longSide(34, false), back: inner(35), top: (g, k, s) => grain(g, k.fill, s.w, s.h, 36, 'x', 0.6) } }), { edges: true });
  add(slab(L0, L0 + t, -W + t, W - t, floor, top, RIM, { paint: { left: end(37), right: end(38) } }), { edges: true });
  add(slab(L1 - t, L1, -W + t, W - t, floor, top, RIM, { paint: { right: end(39), left: end(40) } }), { edges: true });
  // Each stake's head, a hand proud of the rim: on the side it holds, so it is laid over it from wherever it is seen.
  const stake = 0.38;
  for (const s of [-1, 1]) {
    for (const u of along) {
      const x = Math.max(L0 + stake, Math.min(L1 - stake, L0 + (L1 - L0) * u));
      const y0 = s < 0 ? -W : W - t, y1 = s < 0 ? -W + t : W;
      add(slab(x - stake, x + stake, y0, y1, top, top + 0.55, GEAR, { bevel: 0.12 }));
    }
  }
  // The bench across it over the axle, on a block each side.
  for (const s of [-1, 1]) add(slab(-0.65, 0.65, s * (W - (wagon ? 2 : 1.6)) - 0.55, s * (W - (wagon ? 2 : 1.6)) + 0.55, floor, bench - 0.6, GEAR_DEEP));
  add(slab(-1.3, 1.3, -W + t, W - t, bench - 0.6, bench, SEAT, { bevel: 0.2, paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 2, 41, 'y'); g.restore(); } } }), { edges: true });
  const wheelsAt = (): WheelAt[] => axles.flatMap((a) => [-1, 1].map((s) => ({ c: [a.x, s * wy, a.r] as V3, r: a.r, thick, spokes: wheels.spokes, mark: !a.front, front: a.front })));
  const shade: Array<[number, number, number, number]> = [[L0, L1, -W - 1.4, W + 1.4]];
  /*
   * The pole: from the front axle's bolster (the cart's sills) up to the yoke of the pair at it, and on to the leaders'
   * where there are leaders; a yoke across it for each pair, at the height of their necks, where the team is put
   * (`YOKE_SPOTS`), a bow down from it round each neck.
   */
  const front = axles[axles.length - 1];
  const p0: V3 = wagon ? [front.x + 0.8, 0, front.r] : [L1 - 2.5, 0, sill - 1.6];
  const spots = YOKE_SPOTS[kind] ?? [];
  const rows = [...new Set(spots.map((q) => q[0]))].sort((a, b) => a - b).map((r) => r * UNITS_PER_TILE);
  /*
   * It runs level under the floor to the front of the box, so it is laid under the floor from wherever it is seen, and
   * from there out and up to the first yoke, its top a hair under the yoke's underside there (through its slope), so
   * the yoke is laid on it; and on to the leaders' at their necks' height.
   */
  const knee: V3 = [L1 + 0.5, 0, p0[2]];
  add(beam(p0, knee, 0.42, 0.42, GEAR, banded(59, [0.5])));
  const x1 = rows[0] ?? hw, rise = Math.hypot(1, (YOKE_Z - 0.9 - knee[2]) / (x1 - knee[0]));
  const zAt1 = YOKE_Z - 0.42 - 0.08 - 0.42 * rise;
  // With no team in it, its pole is let down to the ground, its end on it, and its yokes are off it.
  if (!yoked) {
    add(beam(knee, [L1 + POLE_DOWN, 0, 0.45], 0.42, 0.42, GEAR, banded(60, [0.45, 0.9])));
    return { parts, wheels: wheelsAt(), shade };
  }
  add(beam(knee, [x1, 0, zAt1], 0.42, 0.42, GEAR, banded(60, [0.35, 0.7, 0.97])));
  const last = rows[rows.length - 1] ?? x1;
  if (last > x1) add(beam([x1 + 0.12, 0, zAt1], [last, 0, YOKE_Z - 0.42 - 0.08 - 0.32], 0.3, 0.32, GEAR_DEEP, banded(61, [0.5, 0.97])));
  for (const yx of rows) {
    const reach = Math.max(...spots.filter((q) => Math.abs(q[0] * UNITS_PER_TILE - yx) < 1e-6).map((q) => Math.abs(q[1]))) * UNITS_PER_TILE;
    const yc = YOKE_Z;
    add(beam([yx, -reach - BOW_R - 1, yc], [yx, reach + BOW_R + 1, yc], 0.42, 0.42, paler(GEAR, 0.08), banded(70 + Math.round(yx), [0.5])), { edges: true });
    // A bow under the yoke for each beast, the yoke's two arms down round its neck, from just under it.
    const yz = yc - 0.42 - 0.23;
    for (const s of [-1, 1]) {
      const cy = s * reach, bow: Face[] = [];
      const pts = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 6) * Math.PI;
        return [yx, cy + Math.cos(a) * BOW_R, yz - Math.sin(a) * BOW_DEEP] as V3;
      });
      for (let i = 0; i + 1 < pts.length; i++) bow.push(...beam(pts[i], pts[i + 1], 0.24, 0.24, GEAR_DEEP, null));
      add(bow);
    }
  }
  return { parts, wheels: wheelsAt(), shade };
}

/** A cart, a large cart or a wagon in the kit, of `material`, its box and bench painted in the dye; `yoked`, a team in its yokes. */
export function cartBuilt(kind: string, hw: number, hd: number, material: string | undefined, tint: Tint | undefined, wheels?: { r: number; spokes: number; front?: number }, yoked = true): CartBuilt {
  const body = woodTone(material, tint, 0.75), gear = woodTone(material);
  if (kind === 'cart') return smallCart(hw, hd, body, gear);
  return boxCart(kind as BoxKind, hw, hd, body, gear, wheels ?? { r: 4.8, spokes: 10 }, yoked);
}

/** The box round a kit part, in its own units: what the scene sorts it by. */
export function partBox(p: KitPart): [number, number, number, number, number, number] {
  const pts = [...(p.faces ?? []).flatMap((f) => f.pts), ...(p.reach ?? [])];
  if (!pts.length) return [0, 0, 0, 0, 0, 0];
  const c = centre(pts);
  let b: [number, number, number, number, number, number] = [c[0], c[0], c[1], c[1], c[2], c[2]];
  for (const q of pts) b = [Math.min(b[0], q[0]), Math.max(b[1], q[0]), Math.min(b[2], q[1]), Math.max(b[3], q[1]), Math.min(b[4], q[2]), Math.max(b[5], q[2])];
  return b;
}
