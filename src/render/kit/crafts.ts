import {
  clothTone, css, deeper, faceColour, grain, hex, inlay, IRON, lathe, mix, paler, proj, sheen, slab, TAU, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';
import { KILN_STONE, rod, spun, stroke, WET_CLAY, wheel, WILLOW } from './turnery';

/**
 * The craft stations, in the kit: the potter's wheel, the spindle (a great
 * wheel), the loom, the paper press and the butter churn. Each is the wood it
 * was built of, and dyed, its wood is painted in the dye and its iron, stone,
 * clay and yarn are left as they are -- but the loom, whose cloth takes the
 * dye and whose wood stays plain.
 *
 * - The potter's wheel (`potters_wheel`): a stone kick wheel on the floor in a
 *   plank frame on four legs, an iron shaft up from it to the wheel head, a
 *   pot half thrown on the head, and the potter's seat behind.
 * - The spindle (`spindle`): a bench on three splayed legs, the great wheel
 *   on its post at one end, the maiden at the other with the spindle and a
 *   cop of yarn on it, the drive band between, and a basket of fleece.
 * - The loom (`loom`): a floor loom -- a frame of six posts, the castle over
 *   the middle pair with a small gold rune let into its front, the warp from
 *   the warp beam at the back through the heddles and the reed to the fell,
 *   the cloth woven over the breast beam and wound on the cloth beam, the
 *   treadles under it and the weaver's bench in front.
 * - The paper press (`paper_press`): a screw press -- a bed box, a stack of
 *   sheets and felts under the platen, two uprights and a head beam, and the
 *   threaded wooden screw down through the beam with the bar through its head.
 * - The butter churn (`butter_churn`): a tall staved tub, wider at its foot,
 *   hooped in iron, its lid, and the dasher's staff up through it with a
 *   crosspiece to work it by.
 */

/* ---- shared --------------------------------------------------------------------------- */

/** Wood's grain along a side, up it or along it. */
const woodSide = (seed: number, along: 'x' | 'y', k = 0.7) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);
/** Grain on every side of a post or a rail, up it or along it. */
const allSides = (seed: number, along: 'x' | 'y') => ({ front: woodSide(seed, along), back: woodSide(seed + 1, along), left: woodSide(seed + 2, along), right: woodSide(seed + 3, along) });
/** Grain on a top, its frame from its middle. */
const topGrain = (seed: number, along: 'x' | 'y' = 'x') => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  grain(g, k.fill, s.w, s.h, seed, along, 0.6);
  g.restore();
};

/** A builder that keeps the parts it makes. */
function parts(): [KitPart[], (faces: Face[], more?: Partial<KitPart>) => KitPart] {
  const list: KitPart[] = [];
  return [list, (faces, more = {}) => {
    const p: KitPart = { faces, ...more };
    list.push(p);
    return p;
  }];
}

/** A dark round seen on a level face at `c` (a pot's mouth, a hole): `r` across, ringed in a lit lip. */
function mouth(c: V3, r: number, tone: Tone): KitPart {
  const ring = (rr: number): V3[] => Array.from({ length: 16 }, (_, i) => [c[0] + Math.cos((i / 16) * TAU) * rr, c[1] + Math.sin((i / 16) * TAU) * rr, c[2]] as V3);
  const path = (g: Ctx, e: Parameters<NonNullable<KitPart['draw']>>[1], rr: number): void => {
    g.beginPath();
    ring(rr).forEach((p, i) => { const [x, y] = proj(e, p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
  };
  return {
    reach: ring(r),
    draw: (g, e) => {
      path(g, e, r);
      g.fillStyle = css(mix(tone.shade, hex('#3e3040'), 0.55));
      g.fill();
      path(g, e, r * 0.62);
      g.fillStyle = css(mix(tone.shade, hex('#2e2436'), 0.75));
      g.fill();
    },
  };
}

/* ---- the potter's wheel ------------------------------------------------------------------ */

function pottersWheelOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.1);
  const END = deeper(WOOD, 0.14);
  const [list, add] = parts();
  const cy = 1;

  // The frame: four legs, a rail along each side over them, a stretcher low across the front.
  for (const [i, [x, y]] of ([[-3.4, -1.4], [3.4, -1.4], [-3.4, 3.4], [3.4, 3.4]] as Array<[number, number]>).entries()) {
    add(slab(x - 0.4, x + 0.4, y - 0.4, y + 0.4, 0, 5.2, WOOD, { corner: 0.12, taper: 0.05, paint: allSides(11 + i * 4, 'y') }));
  }
  for (const [i, x] of [-3.4, 3.4].entries()) add(slab(x - 0.46, x + 0.46, -1.9, 3.9, 5.2, 5.75, TOP, { bevel: 0.12, paint: { top: topGrain(31 + i, 'y'), left: woodSide(33 + i, 'x'), right: woodSide(35 + i, 'x') } }), { edges: true });
  add(slab(-2.98, 2.98, 3.15, 3.65, 1.6, 2.1, END, { paint: { front: woodSide(37, 'x'), back: woodSide(38, 'x') } }));

  // The kick wheel: a stone round on the floor, a groove round its rim.
  add(lathe(0, cy, [[0.08, 2.5], [0.3, 2.75], [0.68, 2.75], [0.76, 2.62], [0.84, 2.75], [1.22, 2.75], [1.42, 2.5]], 16, KILN_STONE, 0.5, (k) => (k === 2 ? { crease: 0.4 } : undefined)), { edges: true });
  // The shaft, iron, up to the head.
  add(rod([0, cy, 1.42], [0, cy, 6.3], 0.28, IRON, 8));
  // The head: a turned disc of wood.
  add(lathe(0, cy, [[6.3, 2.0], [6.5, 2.42], [6.9, 2.42], [7.02, 2.25]], 16, TOP), { edges: true });
  // The pot on it, half thrown: a belly drawn up to a neck and a lip, rings left by the fingers round it.
  const clay = add(lathe(0, cy, [[7.02, 1.05], [7.6, 1.38], [8.25, 1.22], [8.75, 0.8], [8.95, 0.82], [9.1, 0.88]], 12, WET_CLAY, 0.5, (_k, _i, s) => ({
    paint: (g: Ctx, k: PaintCtx) => {
      for (let y = 0.18; y < s.h; y += 0.3) stroke(g, css(mix(k.fill, hex('#6a5468'), 0.35), 0.45), 0.08, [[-0.2, y], [s.w + 0.2, y]]);
    },
  })), { edges: true });
  list.push({ ...mouth([0, cy, 9.1], 0.64, WET_CLAY), after: [clay] });

  // The seat behind, on two legs.
  for (const x of [-1.8, 1.8]) add(slab(x - 0.32, x + 0.32, -4.25, -3.6, 0, 3.4, WOOD, { corner: 0.08, paint: allSides(41, 'y') }));
  add(slab(-2.35, 2.35, -4.7, -3.15, 3.4, 3.95, TOP, { bevel: 0.14, corner: 0.2, paint: { top: topGrain(45), back: woodSide(46, 'x'), front: woodSide(47, 'x') } }), { edges: true });
  return { parts: list, shade: [[-3.9, -4.7, 0], [3.9, -4.7, 0], [3.9, 3.9, 0], [-3.9, 3.9, 0]] };
}

/* ---- the spindle (a great wheel) --------------------------------------------------------- */

function spindleOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.1);
  const YARN = clothTone();
  const BAND = deeper(clothTone(), 0.45);
  const [list, add] = parts();

  // The legs, splayed, round, and the bench on them.
  for (const [a, b] of [[[-4.05, -2.0, 0], [-3.4, -0.62, 4.4]], [[-4.05, 2.0, 0], [-3.4, 0.62, 4.4]], [[4.3, 0, 0], [3.6, 0, 4.4]]] as Array<[V3, V3]>) add(rod(a, b, 0.4, WOOD, 8));
  add(slab(-4.6, 4.6, -1.1, 1.1, 4.4, 5.2, TOP, { bevel: 0.16, corner: 0.2, paint: { top: topGrain(51), front: woodSide(52, 'x'), back: woodSide(53, 'x'), left: woodSide(54, 'x'), right: woodSide(55, 'x') } }), { edges: true });

  // The wheel on its post, its axle from the post to the hub.
  add(slab(-2.42, -1.58, -0.42, 0.42, 5.2, 9.95, WOOD, { corner: 0.12, bevel: 0.12, paint: allSides(61, 'y') }), { edges: true });
  add(rod([-2, 0.42, 9.4], [-2, 0.6, 9.4], 0.26, IRON, 6));
  const wh = add(wheel([-2, 1, 9.4], 'y', 3.72, 0.56, 0.52, 8, WOOD, 0.52, 0.8, 0.2, 20));

  // The maiden at the other end, its arm out to the spindle; the spindle, its whorl and a cop of yarn on it.
  add(slab(3.0, 3.8, -0.4, 0.4, 5.2, 8.0, WOOD, { corner: 0.12, bevel: 0.12, paint: allSides(71, 'y') }), { edges: true });
  add(slab(3.1, 3.7, 0.4, 0.84, 7.05, 7.75, WOOD, { corner: 0.06 }));
  const sp: V3 = [2.5, 1, 7.4];
  add([
    ...rod(sp, [4.95, 1, 7.4], 0.11, IRON, 6),
    ...spun([2.62, 1, 7.4], [1, 0, 0], [[0, 0.3], [0.08, 0.36], [0.22, 0.36], [0.3, 0.3]], 8, TOP),
    ...spun([3.75, 1, 7.4], [1, 0, 0], [[0, 0.18], [0.2, 0.46], [0.55, 0.56], [0.8, 0.4], [0.95, 0.15]], 8, YARN),
  ]);

  // The drive band, from round the rim to the whorl: leaving the rim where it runs off it straight to the whorl's top and foot.
  const whorl: V3 = [2.77, 1, 7.4];
  const WC: [number, number] = [-2, 9.4], WR = 3.72 + 0.2;
  const off = (dz: number): V3 => {
    const px = whorl[0] - WC[0], pz = whorl[2] + dz - WC[1];
    const d = Math.hypot(px, pz), th = Math.atan2(pz, px), al = Math.acos(WR / d) * Math.sign(dz);
    return [WC[0] + Math.cos(th + al) * WR, 1, WC[1] + Math.sin(th + al) * WR];
  };
  const runs: Array<[V3, V3]> = [[off(0.32), [whorl[0], 1, whorl[2] + 0.32]], [off(-0.32), [whorl[0], 1, whorl[2] - 0.32]]];
  list.push({
    reach: runs.flat(),
    after: [wh],
    draw: (g, e) => {
      for (const [from, to] of runs) {
        const [ax, ay] = proj(e, from), [bx, by] = proj(e, to);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
        g.strokeStyle = css(mix(BAND.shade, hex('#3e3040'), 0.3), 0.95);
        g.lineWidth = 0.6;
        g.stroke();
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
        g.strokeStyle = css(BAND.lit, 0.8);
        g.lineWidth = 0.22;
        g.stroke();
      }
    },
  });

  // The basket of fleece on the floor.
  add(lathe(2.3, -2.65, [[0, 1.15], [0.2, 1.3], [1.3, 1.5], [1.45, 1.52]], 12, WILLOW, 0.5, (k, _i, s) => (k === 1 ? {
    paint: (g: Ctx, kk: PaintCtx) => {
      const dark = css(mix(kk.fill, hex('#5a4458'), 0.4), 0.55);
      for (let y = 0.2; y < s.h; y += 0.36) stroke(g, dark, 0.09, [[-0.2, y], [s.w + 0.2, y]]);
      for (let x = 0.25; x < s.w; x += 0.55) stroke(g, css(mix(kk.fill, [255, 248, 232], 0.4), 0.5), 0.08, [[x, 0.1], [x, s.h - 0.1]]);
    },
  } : undefined)));
  add(lathe(2.3, -2.65, [[1.45, 1.38], [1.85, 1.3], [2.2, 0.95], [2.42, 0.45], [2.48, 0.05]], 10, paler(YARN, 0.3)), { solid: false });
  return { parts: list, shade: [[-4.6, -4.0, 0], [4.6, -4.0, 0], [4.6, 2.2, 0], [-4.6, 2.2, 0]] };
}

/* ---- the loom ---------------------------------------------------------------------------- */

/** The loom's posts: how far out, where along it, how tall. */
const LX = 8.6, LYS = [-7.6, -1.2, 5.4], LTOPS = [12.6, 15.2, 8.4];
/** The warp's half width; the heddles, the reed, the fell and the breast beam along it. */
const WX = 7.0, Y_HED = -1.2, Y_REED = 0.4, Y_FELL = 1.8, Y_BREAST = 4.9;
/** The warp's height at the warp beam, at the heddles and at the fell. */
const Z_BEAM = 9.75, Z_HED = 9.0, Z_FELL = 8.45;

function loomOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP = paler(WOOD, 0.1);
  const END = deeper(WOOD, 0.14);
  const WARP = paler(clothTone(), 0.25);
  const CLOTH = look.tint ? clothTone(look.tint) : deeper(clothTone(), 0.32);
  const [list, add] = parts();

  // The six posts.
  LYS.forEach((y, i) => {
    for (const [j, x] of [-LX, LX].entries()) add(slab(x - 0.5, x + 0.5, y - 0.5, y + 0.5, 0, LTOPS[i], WOOD, { corner: 0.14, bevel: 0.12, paint: allSides(101 + i * 8 + j * 4, 'y') }), { edges: true });
  });
  // The side rails between them, high and low.
  for (const x of [-LX, LX]) {
    for (let i = 0; i < 2; i++) {
      for (const [z0, z1] of [[7.4, 8.2], [1.0, 1.8]]) add(slab(x - 0.4, x + 0.4, LYS[i] + 0.5, LYS[i + 1] - 0.5, z0, z1, END, { paint: { left: woodSide(121 + i, 'x'), right: woodSide(123 + i, 'x') } }), { edges: true });
    }
  }
  // The beam over the back posts, and the castle's cap over the middle pair, a small gold rune let into its front.
  add(slab(-LX - 0.55, LX + 0.55, LYS[0] - 0.5, LYS[0] + 0.5, LTOPS[0], LTOPS[0] + 0.7, TOP, { bevel: 0.14, paint: { front: woodSide(131, 'x'), back: woodSide(132, 'x'), top: topGrain(133) } }), { edges: true });
  add(slab(-LX - 0.6, LX + 0.6, Y_HED - 0.58, Y_HED + 0.58, LTOPS[1], LTOPS[1] + 0.85, TOP, {
    bevel: 0.16,
    paint: {
      front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 134, 'x', 0.6); inlay(g, k.fill, 'dagaz', s.w / 2, s.h / 2, 0.3, 0.12); },
      back: woodSide(135, 'x'), top: topGrain(136),
    },
  }), { edges: true });

  // The warp beam at the back, wound with warp.
  add(spun([-LX + 0.5, -6.8, Z_BEAM - 0.7], [1, 0, 0], [[0, 0.45], [0.6, 0.45], [0.62, 0.72], [LX * 2 - 1.62, 0.72], [LX * 2 - 1.6, 0.45], [LX * 2 - 1, 0.45]], 10, WARP));
  // The warp, a sheet of threads in two runs: beam to heddles, heddles to fell.
  const sheet = (y0: number, y1: number, z0: number, z1: number): Face[] => warped(slab(-WX, WX, y0, y1, 0, 0.12, WARP, {
    paint: {
      top: (g, k, s) => {
        for (let x = -s.w / 2 + 0.2, i = 0; x < s.w / 2; x += 0.42, i++) {
          stroke(g, css(i % 2 ? mix(k.fill, hex('#5a4458'), 0.45) : mix(k.fill, [255, 252, 244], 0.5), 0.85), i % 2 ? 0.11 : 0.16, [[x, -s.h / 2], [x, s.h / 2]]);
        }
      },
    },
  }), (p) => [p[0], p[1], p[2] + z0 + ((z1 - z0) * (p[1] - y0)) / (y1 - y0)]);
  add(sheet(-6.8, Y_HED - 0.28, Z_BEAM, Z_HED));
  add(sheet(Y_HED + 0.28, Y_FELL, Z_HED, Z_FELL));

  // The heddles: two shafts, their wires above and below the warp, and the cords up to the castle.
  add(slab(-WX - 0.4, WX + 0.4, Y_HED - 0.25, Y_HED + 0.25, 10.85, 11.4, END, { paint: { front: woodSide(151, 'x'), back: woodSide(152, 'x') } }));
  add(slab(-WX - 0.4, WX + 0.4, Y_HED - 0.25, Y_HED + 0.25, 6.6, 7.15, END, { paint: { front: woodSide(153, 'x'), back: woodSide(154, 'x') } }));
  const wires = (z0: number, z1: number): KitPart => {
    const pts: V3[] = [[-WX, Y_HED, z0], [WX, Y_HED, z1]];
    return {
      reach: pts,
      draw: (g, e) => {
        g.lineCap = 'butt';
        for (let x = -WX + 0.3, i = 0; x < WX; x += 0.42, i++) {
          const [ax, ay] = proj(e, [x, Y_HED, z0]), [bx, by] = proj(e, [x, Y_HED, z1]);
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
          g.strokeStyle = css(i % 2 ? IRON.shade : IRON.lit, 0.75);
          g.lineWidth = 0.32;
          g.stroke();
        }
      },
    };
  };
  list.push(wires(Z_HED + 0.25, 10.85), wires(7.15, Z_HED - 0.2));
  const cords: V3[] = [[-4, Y_HED, 11.4], [4, Y_HED, LTOPS[1]]];
  list.push({
    reach: cords,
    draw: (g, e) => {
      for (const x of [-4, 4]) {
        const [ax, ay] = proj(e, [x, Y_HED, 11.4]), [bx, by] = proj(e, [x, Y_HED, LTOPS[1]]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
        g.strokeStyle = css(mix(WARP.shade, hex('#4a3640'), 0.4), 0.9);
        g.lineWidth = 0.45;
        g.stroke();
      }
    },
  });

  // The beater: its swords hanging either side of the warp, a cap across their heads, the reed between its battens.
  for (const s of [-1, 1]) add(slab(s * 7.2 - (s > 0 ? 0 : 0.5), s * 7.2 + (s > 0 ? 0.5 : 0), Y_REED - 0.25, Y_REED + 0.25, 7.5, 14.6, WOOD, { corner: 0.08, paint: allSides(161, 'y') }));
  add(slab(-7.75, 7.75, Y_REED - 0.28, Y_REED + 0.28, 14.6, 15.1, TOP, { bevel: 0.1 }), { edges: true });
  add(slab(-7.2, 7.2, Y_REED - 0.42, Y_REED + 0.42, 7.75, 8.35, WOOD, { bevel: 0.12, paint: { front: woodSide(165, 'x'), back: woodSide(166, 'x') } }), { edges: true });
  const dents = (g: Ctx, k: PaintCtx, s: Side): void => {
    for (let x = 0.15; x < s.w; x += 0.3) stroke(g, css(mix(k.fill, hex('#3e3040'), 0.5), 0.7), 0.1, [[x, 0], [x, s.h]]);
    sheen(g, k.fill, s.w, s.h, 167);
  };
  add(slab(-7.2, 7.2, Y_REED - 0.12, Y_REED + 0.12, 9.0, 10.6, END, { paint: { front: dents, back: dents } }));
  add(slab(-7.2, 7.2, Y_REED - 0.3, Y_REED + 0.3, 10.6, 11.1, WOOD, { bevel: 0.1, paint: { front: woodSide(169, 'x'), back: woodSide(170, 'x') } }), { edges: true });

  // The cloth woven so far, from the fell to the breast beam, its weft across it and a band or two in it.
  add(slab(-WX, WX, Y_FELL, Y_BREAST, Z_FELL - 0.2, Z_FELL, CLOTH, {
    crease: 0.25,
    paint: {
      top: (g, k, s) => {
        for (let y = -s.h / 2 + 0.15; y < s.h / 2; y += 0.3) stroke(g, css(mix(k.fill, hex('#6a5468'), 0.25), 0.4), 0.08, [[-s.w / 2, y], [s.w / 2, y]]);
        for (const y of [-s.h / 2 + 0.9, -s.h / 2 + 1.25, s.h / 2 - 0.7]) { g.fillStyle = css(mix(k.fill, [255, 248, 236], 0.55), 0.75); g.fillRect(-s.w / 2, y, s.w, 0.18); }
        // The fell: where the weaving stops, a lit line.
        stroke(g, css(mix(k.fill, [255, 252, 244], 0.6), 0.8), 0.12, [[-s.w / 2, -s.h / 2 + 0.08], [s.w / 2, -s.h / 2 + 0.08]]);
      },
    },
  }));
  add(slab(-LX + 0.5, LX - 0.5, Y_BREAST, Y_BREAST + 0.9, 7.55, Z_FELL - 0.02, TOP, { bevel: 0.14, paint: { front: woodSide(171, 'x'), back: woodSide(172, 'x'), top: topGrain(173) } }), { edges: true });
  // The cloth beam under it, the cloth wound on.
  add(spun([-WX - 0.4, 4.2, 3.6], [1, 0, 0], [[0, 0.5], [0.4, 0.5], [0.42, 0.88], [WX * 2 - 0.42, 0.88], [WX * 2 - 0.4, 0.5], [WX * 2 + 0.8, 0.5]], 10, CLOTH));

  // The treadles, on the floor under the front.
  for (const [i, x] of [-1.8, -0.6, 0.6, 1.8].entries()) add(slab(x - 0.3, x + 0.3, 0.6, 6.7, 0.15, 0.7, END, { bevel: 0.1, paint: { top: topGrain(181 + i, 'y') } }), { edges: true });
  // The bench in front.
  for (const [x, y] of [[-4.2, 7.25], [4.2, 7.25], [-4.2, 8.75], [4.2, 8.75]]) add(slab(x - 0.35, x + 0.35, y - 0.35, y + 0.35, 0, 4.0, WOOD, { corner: 0.08, paint: allSides(191, 'y') }));
  add(slab(-5, 5, 6.75, 9.25, 4.0, 4.6, TOP, { bevel: 0.14, corner: 0.2, paint: { top: topGrain(195), front: woodSide(196, 'x'), back: woodSide(197, 'x') } }), { edges: true });
  return { parts: list, shade: [[-LX - 0.6, -8.2, 0], [LX + 0.6, -8.2, 0], [LX + 0.6, 9.3, 0], [-LX - 0.6, 9.3, 0]] };
}

/* ---- the paper press --------------------------------------------------------------------- */

function paperPressOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.1);
  const END = deeper(WOOD, 0.14);
  const PAPER = paler(clothTone(), 0.3);
  const FELT = deeper(clothTone(), 0.3);
  const [list, add] = parts();

  // The bed box.
  add(slab(-4.2, 4.2, -2.6, 2.6, 0, 3.2, END, {
    corner: 0.2, bevel: 0.18,
    paint: {
      front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 201, 'x', 0.8); stroke(g, css(mix(k.fill, hex('#4a3640'), 0.45), 0.8), 0.14, [[0, s.h * 0.5], [s.w, s.h * 0.5]]); },
      back: woodSide(202, 'x'), left: woodSide(203, 'x'), right: woodSide(204, 'x'), top: topGrain(205),
    },
  }), { edges: true });
  // The stack: sheets between felts.
  const layers = (g: Ctx, k: PaintCtx, s: Side): void => {
    for (let y = 0.22, i = 0; y < s.h; y += 0.26, i++) stroke(g, css(i % 2 ? faceColour(FELT, k.L) : mix(k.fill, hex('#6a5468'), 0.25), 0.85), i % 2 ? 0.12 : 0.06, [[0, y], [s.w, y]]);
  };
  add(slab(-2.6, 2.6, -1.8, 1.8, 3.2, 4.5, PAPER, { corner: 0.1, paint: { front: layers, back: layers, left: layers, right: layers } }));
  // The platen pressing down on it.
  add(slab(-3.0, 3.0, -2.1, 2.1, 4.5, 5.3, WOOD, { bevel: 0.14, corner: 0.15, paint: { top: topGrain(211), front: woodSide(212, 'x'), back: woodSide(213, 'x'), left: woodSide(214, 'x'), right: woodSide(215, 'x') } }), { edges: true });
  // The uprights and the head beam over them.
  for (const [i, x] of [-3.7, 3.7].entries()) add(slab(x - 0.5, x + 0.5, -0.62, 0.62, 3.2, 11.8, WOOD, { corner: 0.12, paint: allSides(221 + i * 4, 'y') }));
  add(slab(-4.6, 4.6, -0.85, 0.85, 11.8, 13.4, TOP, { bevel: 0.18, corner: 0.15, paint: { front: woodSide(231, 'x'), back: woodSide(232, 'x'), top: topGrain(233), left: woodSide(234, 'y'), right: woodSide(235, 'y') } }), { edges: true });
  // The screw: a collar on the platen, the threaded shaft up to the beam, and over the beam its head with the bar through it.
  add(lathe(0, 0, [[5.3, 0.95], [5.75, 0.9], [5.85, 0.75]], 10, END));
  const thread = (_k: number, _i: number, s: Side): Partial<Face> => ({
    paint: (g: Ctx, k: PaintCtx) => {
      for (let y = -1; y < s.h + 1; y += 0.42) {
        stroke(g, css(mix(k.fill, hex('#4a3640'), 0.6), 0.85), 0.14, [[0, y], [s.w, y + 0.22]]);
        stroke(g, css(mix(k.fill, [255, 250, 238], 0.5), 0.7), 0.08, [[0, y + 0.15], [s.w, y + 0.37]]);
      }
    },
  });
  add(rod([0, 0, 5.85], [0, 0, 11.8], 0.7, TOP, 10, thread));
  add(rod([0, 0, 13.4], [0, 0, 14.3], 0.7, TOP, 10, thread));
  add([...lathe(0, 0, [[14.3, 0.82], [14.45, 1.0], [15.3, 1.0], [15.5, 0.75]], 10, WOOD), ...rod([-3.7, 0, 14.9], [3.7, 0, 14.9], 0.26, TOP, 6)], { edges: true });
  return { parts: list, shade: [[-4.6, -2.8, 0], [4.6, -2.8, 0], [4.6, 2.8, 0], [-4.6, 2.8, 0]] };
}

/* ---- the butter churn -------------------------------------------------------------------- */

/** An iron hoop across a stave `w` wide from `z0` to `z1` up it: one band round the tub, so no rim at the stave's sides. */
function hoop(g: Ctx, k: PaintCtx, w: number, z0: number, z1: number): void {
  const fill = faceColour(IRON, k.L);
  g.fillStyle = css(fill);
  g.fillRect(-0.5, z0, w + 1, z1 - z0);
  g.fillStyle = css(mix(fill, hex('#2e2a3c'), 0.6), 0.95);
  g.fillRect(-0.5, z0 - 0.1, w + 1, 0.16);
  g.fillRect(-0.5, z1 - 0.06, w + 1, 0.16);
  g.fillStyle = css(mix(fill, [255, 255, 255], 0.45), 0.6);
  g.fillRect(-0.5, z1 - 0.2, w + 1, 0.1);
}

function butterChurnOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.12);
  const LID = deeper(WOOD, 0.1);
  const [list, add] = parts();
  const H = 10;

  // The tub: twelve staves, wider at its foot, three iron hoops round it.
  add(lathe(0, 0, [[0, 3.3], [H, 2.45]], 12, WOOD, 0.5, (_k, i, s) => ({
    crease: 0.16,
    paint: (g: Ctx, k: PaintCtx) => {
      grain(g, k.fill, s.w, s.h, 241 + i, 'y', 0.6);
      // A lit edge down the stave's left, where it meets the next.
      g.fillStyle = css(mix(k.fill, [255, 248, 232], 0.35), 0.45);
      g.fillRect(0, 0, 0.14, s.h);
      for (const [z0, z1] of [[0.9, 1.55], [5.0, 5.6], [8.7, 9.3]]) hoop(g, k, s.w, z0, z1);
    },
  })), { edges: true });
  // The lid, a little proud of its rim.
  add(lathe(0, 0, [[H, 2.62], [H + 0.42, 2.62], [H + 0.6, 2.36]], 12, LID), { edges: true });
  // The dasher's staff up through it, and the crosspiece.
  add([...rod([0, 0, H + 0.6], [0, 0, 15.1], 0.3, TOP, 8), ...rod([-1.8, 0, 14.6], [1.8, 0, 14.6], 0.24, TOP, 6)]);
  return { parts: list, shade: [[-3.3, -3.3, 0], [3.3, -3.3, 0], [3.3, 3.3, 0], [-3.3, 3.3, 0]] };
}

export const POTTERS_WHEEL: KitPiece = { model: (look) => pottersWheelOf(look), uses: { tint: true, material: true } };
export const SPINDLE: KitPiece = { model: (look) => spindleOf(look), uses: { tint: true, material: true } };
export const LOOM: KitPiece = { model: (look) => loomOf(look), uses: { tint: true, material: true } };
export const PAPER_PRESS: KitPiece = { model: (look) => paperPressOf(look), uses: { tint: true, material: true } };
export const BUTTER_CHURN: KitPiece = { model: (look) => butterChurnOf(look), uses: { tint: true, material: true } };
