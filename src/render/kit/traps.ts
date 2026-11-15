import { rand } from '../ivy';
import { canvasOf, drawPads, eyeOf, scaleFor, type Eye, type Pad } from '../runestone';
import { layKitModel } from '../kitpieces';
import { lilac, speckle } from './hearthstone';
import { spun } from './turnery';
import {
  add, boards, centre, cross, css, deeper, grain, hex, inlay, mix, mul, nail, prism, proj, slab, sub, TAU, toneOf, turned, unit, woodTone,
  type Ctx, type Face, type KitModel, type KitPart, type PaintCtx, type Side, type Tone, type V3,
} from './core';

/**
 * The traps (`game/trapdefs.ts`), in the kit: set down on a subtile and drawn
 * each frame from a bake kept for each turn of the camera, state and scale,
 * as the campfire is (`kit/campfire.ts`).
 *
 * - **Snare**: a stake with an algiz inlaid in gold, and beside it a spring
 *   pole bent over to a cord running down to a hemp noose pegged open on the
 *   ground. Sprung, the pole stands up and the noose hangs drawn tight off
 *   its tip.
 * - **Twine snare**: the same without the stake, at under three quarters the
 *   size, a whippy pole and a noose of pale twine.
 * - **Deadfall**: a board of three planks weighted with a cut stone, propped
 *   at its front on a stick. Sprung, the board lies flat and the stick lies
 *   knocked over beside it.
 * - **Creel**: a willow basket lying on its side, its throat turned in at the
 *   front, a cord off it to a cork float tipped red. With fish in it, the fish
 *   show through the weave and a tail in the throat.
 *
 * Baited, the bait shows: berries in the noose or under the board, a lump in
 * the creel's throat. Worn (`TRAP_WORN` of its life gone), its wood and
 * willow go grey, moss gets on it and its rope frays and breaks.
 */

/** How far gone a trap is (`PlacedTrap.dmg`, nought to a hundred) when it is drawn worn. */
export const TRAP_WORN = 60;

/** What a trap is drawn as. */
export interface TrapLook { kind: string; baited: boolean; sprung: boolean; worn: boolean }

/* ---- its colours ---------------------------------------------------------------------- */

/** Hemp rope, as the rope walk's; the twine snare's twine, paler and cooler. */
const HEMP: Tone = toneOf('#ead2a4', '#9a7e6c');
const TWINE: Tone = toneOf('#f3e0b8', '#a08a7a');
/** Willow, as the wildermon beds' baskets (`dens.ts`), and the inside of the throat. */
const WILLOW: Tone = toneOf('#d3a473', '#8c6660');
/** The stone a deadfall is weighted with: the campfire ring's. */
const STONE: Tone = toneOf('#ece0d0', '#a48cb2');
/** The float: cork, and its red tip, the trap's splash. */
const FLOAT: Tone = toneOf('#ecd2a2', '#a5847a');
const FLOAT_RED: Tone = toneOf('#ef4a5c', '#a3324e');
/** Bait: berries, saturated, their light tinted; a worm's pink in a creel. */
const BERRY = '#e3264f', BERRY_LIT = '#ffb3c2', BERRY_INK = '#7a1f3c', LEAF = '#5fae4c';
const WORM = '#f07c8c', WORM_INK = '#8a3048';
/** Fish seen through the weave: a silver blue. */
const FISH = '#9fc6dc', FISH_DARK = '#5c7f9c';
/** Ink round a loose drawing: deep plum-brown, never black. */
const INK = '#4a3640';

/** Wood or willow gone grey in the weather, its shade a cool lilac. */
const weathered = (t: Tone): Tone => ({ lit: mix(t.lit, hex('#cfc8c6'), 0.5), shade: mix(t.shade, hex('#77707e'), 0.45) });

/* ---- shared drawing --------------------------------------------------------------------- */

/** Grain along a side, run up it. */
const grainUp = (seed: number, k = 0.5) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, 'y', k);
/** Grain along a side, run across it. */
const grainAcross = (seed: number, k = 0.6) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, 'x', k);

/** Moss in cushions over a face `w` by `h` in its frame (from its corner), as many as `n`. */
function mossOn(g: Ctx, w: number, h: number, n: number, seed: number, centred = false): void {
  const T = rand(seed);
  const pads: Pad[] = [];
  for (let i = 0; i < n; i++) {
    const r = 0.35 + 0.5 * T();
    pads.push([(centred ? -w / 2 : 0) + T() * w, (centred ? -h / 2 : 0) + T() * h, r, r * 0.8]);
  }
  drawPads(g, pads);
}

/** A cord drawn loose through `pts`: a deep line under a lit one, as the rope walk's, ticked across where it is twisted. */
function cordPath(g: Ctx, e: Eye, pts: readonly V3[], w: number, tone: Tone, twisted: boolean): void {
  const scr = pts.map((p) => proj(e, p));
  const line = (colour: string, lw: number): void => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = colour;
    g.lineWidth = lw;
    g.stroke();
  };
  line(css(mix(tone.shade, hex(INK), 0.45), 0.95), w);
  line(css(mix(tone.lit, [255, 248, 230], 0.08), 0.95), w * 0.45);
  if (!twisted) return;
  g.strokeStyle = css(mix(tone.shade, hex(INK), 0.3), 0.65);
  g.lineWidth = w * 0.26;
  let carry = 0;
  for (let i = 1; i < scr.length; i++) {
    const [ax, ay] = scr[i - 1], [bx, by] = scr[i];
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 1.4 - carry; d < len; d += 1.4) {
      const t = d / len, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      g.beginPath();
      g.moveTo(x - w * 0.3, y - w * 0.4);
      g.lineTo(x + w * 0.3, y + w * 0.4);
      g.stroke();
    }
    carry = (carry + len) % 1.4;
  }
}

/** A loose cord through `pts`, as a part. */
const cord = (pts: V3[], w: number, tone: Tone, twisted: boolean, more: Partial<KitPart> = {}): KitPart => ({
  reach: pts, solid: true, draw: (g, e) => cordPath(g, e, pts, w, tone, twisted), ...more,
});

/** Points round a ring about `c`, `r` across, in the plane of `u` and `v`, from `a0` to `a1`. */
const arcPts = (c: V3, u: V3, v: V3, r: number, a0: number, a1: number, n: number): V3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return add(c, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)));
  });

/** Frayed ends: a few short stray fibres off `p` on the screen. */
function fray(g: Ctx, e: Eye, p: V3, tone: Tone, seed: number): void {
  const [x, y] = proj(e, p);
  const T = rand(seed);
  g.strokeStyle = css(mix(tone.lit, tone.shade, 0.35), 0.9);
  g.lineWidth = 0.22;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = T() * TAU;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (0.6 + T() * 0.7), y + Math.sin(a) * (0.4 + T() * 0.5));
    g.stroke();
  }
}

/** Berries, the bait of a land trap: three in a cluster and a leaf, laid on the ground at `c`. */
function berries(c: V3): KitPart {
  return {
    reach: [add(c, [-1, -1, 0]), add(c, [1, 1, 0.8])], solid: true,
    draw: (g, e) => {
      const [x, y] = proj(e, add(c, [0, 0, 0.35]));
      g.beginPath();
      g.ellipse(x + 1.0, y - 0.1, 1.0, 0.45, -0.5, 0, TAU);
      g.fillStyle = LEAF;
      g.fill();
      for (const [dx, dy] of [[-0.75, 0.15], [0.6, 0.25], [-0.05, -0.55]]) {
        g.beginPath();
        g.arc(x + dx, y + dy, 0.82, 0, TAU);
        g.fillStyle = BERRY_INK;
        g.fill();
        g.beginPath();
        g.arc(x + dx, y + dy, 0.6, 0, TAU);
        g.fillStyle = BERRY;
        g.fill();
        g.beginPath();
        g.arc(x + dx - 0.22, y + dy - 0.22, 0.2, 0, TAU);
        g.fillStyle = BERRY_LIT;
        g.fill();
      }
    },
  };
}

/**
 * A tube along the points `path` (a bent pole), `r(t)` thick from its foot
 * (t nought) to its tip (t one), `sides` round: one solid, inked round as one,
 * its tip capped. Its foot is cut level with the ground, so nothing of it
 * goes under.
 */
function tube(path: readonly V3[], r: (t: number) => number, sides: number, tone: Tone, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined): Face[] {
  const rings = path.map((p, i) => {
    const t = unit(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
    const u = unit(cross(t, [0, 1, 0]));
    const w = cross(t, u);
    const rr = r(i / (path.length - 1));
    return Array.from({ length: sides }, (_, j) => {
      const a = ((j + 0.5) / sides) * TAU;
      const q = add(p, add(mul(u, Math.cos(a) * rr), mul(w, Math.sin(a) * rr)));
      return (i === 0 ? [q[0], q[1], 0] : q) as V3;
    });
  });
  return prism(rings, tone, (k, i, s) => ({ crease: 0.2, ...(dress?.(k, i, s) ?? {}) }));
}

/** Points along a quadratic curve from `a` by `c` to `b`. */
const curve = (a: V3, c: V3, b: V3, n: number): V3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return add(add(mul(a, u * u), mul(c, 2 * u * t)), mul(b, t * t));
  });

/* ---- the snares ---------------------------------------------------------------------------- */

/**
 * A snare, or a twine snare (`twine`): measures in tenths of a metre, the
 * twine snare's taken down by `TWINE_SIZE` and its members kept thick enough
 * to read.
 */
const TWINE_SIZE = 0.72;

function snareOf(f: TrapLook): KitModel {
  const twine = f.kind === 'twine_snare';
  const k = twine ? TWINE_SIZE : 1;
  const at = (p: V3): V3 => [p[0] * k, p[1] * k, p[2] * k];
  const wood = f.worn ? weathered(woodTone(twine ? 'birch' : 'maple')) : woodTone(twine ? 'birch' : 'maple');
  const bark = deeper(wood, 0.35);
  const rope = f.worn ? weathered(twine ? TWINE : HEMP) : twine ? TWINE : HEMP;
  const ropeW = twine ? 0.7 : 1.05;
  const parts: KitPart[] = [];

  // The pole: from its foot in the ground, bent over to its tip over the noose; sprung, standing nearly straight.
  const foot = at([-3.4, -0.6, 0]);
  const tip = f.sprung ? at([-1.7, -0.3, 6.4]) : at([2.0, 0.5, 4.0]);
  const bend = f.sprung ? at([-3.5, -0.6, 3.6]) : at([-3.2, -0.5, 7.0]);
  const R = twine ? 0.34 : 0.4;
  const pole = tube(curve(foot, bend, tip, 9), (t) => R * (1 - 0.3 * t), 7, bark, (_k, i, s) => ({
    paint: (g: Ctx, kk: PaintCtx) => {
      grain(g, kk.fill, s.w, s.h, 30 + i, 'y', 0.5);
      if (f.worn && i % 3 === 0) mossOn(g, s.w, Math.min(s.h, 1.4), 2, 50 + i);
    },
  }));
  parts.push({ faces: pole, edges: true });

  // The stake it is lashed to (a snare's, not a twine snare's): a gold algiz inlaid in its face.
  if (!twine) {
    const S: [number, number, number, number] = [-4.85, -3.9, -1.1, -0.15];
    const stake = slab(S[0], S[1], S[2], S[3], 0, 2.7, wood, {
      corner: 0.18, bevel: 0.32, crease: 0.4,
      paint: {
        front: (g, kk, s) => { grain(g, kk.fill, s.w, s.h, 61, 'y', 0.5); inlay(g, kk.fill, 'algiz', s.w / 2, s.h * 0.62, 0.62, 0.2); },
        right: grainUp(62), left: grainUp(63),
        back: (g, kk, s) => { grain(g, kk.fill, s.w, s.h, 64, 'y', 0.5); if (f.worn) mossOn(g, s.w, 1.2, 3, 65); },
        top: (g, kk, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, kk.fill, s.w, s.h, 66, 'x', 0.4); g.restore(); },
      },
    });
    parts.push({ faces: stake, edges: true });
    // The lashing from the stake's head round the pole: a short twist of rope between them.
    const pz = 2.1;
    parts.push(cord([[S[1] + 0.05, -0.62, pz], [-3.4 + (bend[0] - foot[0]) * 0.02 - R * 0.75, -0.62, pz]], 0.7, rope, true));
  }

  // The pegs that hold the noose open, either side of it.
  const N = at([2.0, 0.5, 0]);
  const NR = twine ? 1.9 : 2.5;
  for (const [j, side] of [-1, 1].entries()) {
    const c: V3 = [N[0], N[1] + side * (NR + 0.36), 0];
    const h = twine ? 0.7 : 0.85, w = twine ? 0.24 : 0.27;
    parts.push({ faces: slab(c[0] - w, c[0] + w, c[1] - w, c[1] + w, 0, h, bark, { corner: 0.06, bevel: 0.1, paint: { front: grainUp(70 + j), left: grainUp(72 + j), right: grainUp(74 + j) } }), edges: true });
  }

  if (!f.sprung) {
    // The noose, laid open on the ground between the pegs; worn, broken and frayed.
    const z = 0.22;
    const gap = f.worn ? [1.1, 1.75] : null;
    parts.push({
      first: true, solid: true,
      reach: [add(N, [-NR - 0.4, -NR - 0.4, 0]), add(N, [NR + 0.4, NR + 0.4, 0.4])],
      draw: (g, e) => {
        const c: V3 = [N[0], N[1], z];
        if (gap) {
          const a = arcPts(c, [1, 0, 0], [0, 1, 0], NR, gap[1], gap[0] + TAU, 30);
          cordPath(g, e, a, ropeW, rope, !twine);
          fray(g, e, a[0], rope, 81);
          fray(g, e, a[a.length - 1], rope, 82);
        } else {
          cordPath(g, e, arcPts(c, [1, 0, 0], [0, 1, 0], NR, 0, TAU, 32), ropeW, rope, !twine);
        }
        // The running knot on its near side, where the cord from the pole is tied on.
        const [x, y] = proj(e, [N[0] - NR, N[1], z]);
        g.beginPath();
        g.ellipse(x, y, ropeW * 1.1, ropeW * 0.8, 0, 0, TAU);
        g.fillStyle = css(mix(rope.shade, hex(INK), 0.45));
        g.fill();
        g.beginPath();
        g.ellipse(x - 0.15, y - 0.15, ropeW * 0.6, ropeW * 0.4, 0, 0, TAU);
        g.fillStyle = css(rope.lit);
        g.fill();
      },
    });
    // The cord from the tip of the pole down to the knot.
    parts.push(cord([add(tip, [0, 0, -R * 0.6]), [N[0] - NR * 0.55, N[1], 1.6 * k], [N[0] - NR, N[1], 0.3]], ropeW * 0.8, rope, false));
    if (f.baited) parts.push({ ...berries([N[0], N[1], 0]), first: true });
  } else {
    // Sprung: the cord off the tip and the noose drawn tight under it, hanging.
    const knot: V3 = add(tip, [0.1, 0, -2.0 * k]);
    parts.push(cord([add(tip, [0, 0, -R * 0.6]), knot], ropeW * 0.8, rope, false));
    const loop: V3 = add(knot, [0, 0, -0.75 * k]);
    const pts = arcPts(loop, [1, 0, 0], [0, 0, 1], 0.75 * k, Math.PI / 2, Math.PI / 2 + TAU, 16);
    parts.push(cord(pts, ropeW, rope, !twine));
    if (f.worn) parts.push({ reach: [knot], solid: false, draw: (g, e) => fray(g, e, add(loop, [0, 0, -0.75 * k]), rope, 83) });
  }

  // Worn: moss round the pole's foot.
  if (f.worn) {
    parts.push({
      first: true, solid: false, reach: [add(foot, [-1.6, -1.2, 0]), add(foot, [1.2, 1.2, 0.5])],
      draw: (g, e) => {
        const T = rand(91);
        const ps: Pad[] = [];
        for (let i = 0; i < 6; i++) {
          const [x, y] = proj(e, add(foot, [(T() - 0.6) * 2.4, (T() - 0.5) * 2.2, 0]));
          const r = 0.7 + T() * 0.6;
          ps.push([x, y, r, r * 0.6]);
        }
        drawPads(g, ps);
      },
    });
  }

  // The floor it shades: from the stake (or the pole's foot) to past the noose's far side, across its pegs.
  const back = twine ? -4.0 : -5.2, front = N[0] + NR + 0.3, side = NR + 0.7;
  return { parts, shade: [[back, N[1] - side, 0], [front, N[1] - side, 0], [front, N[1] + side, 0], [back, N[1] + side, 0]] };
}

/* ---- the deadfall -------------------------------------------------------------------------- */

/** The board: half its width and depth, and its thickness; how far it is propped up, and where the prop stands under it. */
const BW = 4.4, BD = 2.8, BT = 0.7, PROP_TILT = 0.38, PROP_Y = 1.2, PROP_R = 0.42;

function deadfallOf(f: TrapLook): KitModel {
  const wood = f.worn ? weathered(woodTone('oak')) : woodTone('oak');
  const dark = deeper(wood, 0.25);
  const stone = f.worn ? { lit: mix(STONE.lit, hex('#d6d4c8'), 0.3), shade: STONE.shade } : STONE;
  const parts: KitPart[] = [];

  // The board, three planks, nailed to two battens under it; the stone on it.
  const boardFaces = slab(-BW, BW, -BD, BD, 0, BT, wood, {
    corner: 0.15, bevel: 0.16,
    paint: {
      top: (g, k, s) => {
        g.save();
        g.translate(-s.w / 2, -s.h / 2);
        boards(g, k.fill, s.w, s.h, 3, 7, 'x');
        for (const x of [0.9, s.w - 0.9]) for (let i = 0; i < 3; i++) nail(g, k.fill, x, ((i + 0.5) / 3) * s.h, 0.14);
        if (f.worn) {
          // A split along the middle plank, and moss in its corners.
          g.strokeStyle = css(mix(k.fill, hex(INK), 0.55), 0.85);
          g.lineWidth = 0.14;
          g.beginPath();
          g.moveTo(s.w * 0.15, s.h * 0.48);
          g.lineTo(s.w * 0.4, s.h * 0.52);
          g.lineTo(s.w * 0.62, s.h * 0.47);
          g.stroke();
          mossOn(g, s.w * 0.3, s.h * 0.35, 5, 23);
          g.translate(s.w * 0.72, s.h * 0.65);
          mossOn(g, s.w * 0.28, s.h * 0.35, 4, 24);
        }
        g.restore();
      },
      front: grainAcross(11), back: grainAcross(12), left: grainUp(13), right: grainUp(14),
    },
  });
  const board: KitPart = { faces: boardFaces, edges: true };
  // The stone: a cut block lying on the board's top, an algiz inlaid in gold in its front.
  const stoneFaces = slab(-1.7, 1.5, -1.9, 0.5, BT, BT + 1.9, stone, {
    corner: 0.4, bevel: 0.38, taper: -0.1, crease: 0.42,
    paint: {
      front: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 31, 0.6); lilac(g, k.L, s.w, s.h); inlay(g, k.fill, 'algiz', s.w / 2, s.h * 0.5, 0.62, 0.22); },
      left: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 32, 0.6); lilac(g, k.L, s.w, s.h); },
      right: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 33, 0.6); lilac(g, k.L, s.w, s.h); },
      back: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 34, 0.6); lilac(g, k.L, s.w, s.h); },
      top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); speckle(g, k.fill, s.w, s.h, 35, 0.6); if (f.worn) mossOn(g, s.w * 0.5, s.h * 0.6, 4, 36); g.restore(); },
    },
  });
  // Propped: the board and its stone tilted up off their back edge, which stays on the ground.
  const pivot: V3 = [0, -BD, 0];
  const tilt = (faces: Face[]): Face[] => (f.sprung ? faces : turned(faces, pivot, [1, 0, 0], PROP_TILT));
  board.faces = tilt(boardFaces);
  parts.push(board);
  parts.push({ faces: tilt(stoneFaces), edges: true, after: [board] });

  if (!f.sprung) {
    // The prop: a stick from the ground to the board's underside, its top cut short of the slope at its back.
    const under = (y: number): number => (y + BD) * Math.tan(PROP_TILT);
    const top = under(PROP_Y - PROP_R) - 0.05;
    parts.push({ faces: spun([0.6, PROP_Y, 0], [0, 0, 1], [[0, PROP_R], [top, PROP_R * 0.9]], 7, dark, (_k, i, s) => ({ paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, s.w, s.h, 40 + i, 'y', 0.5) })), edges: true });
    // The trigger bar from the prop's foot in under the board, lying on the ground.
    parts.push({ faces: spun([0.6 - PROP_R - 0.05, PROP_Y - 0.1, 0.28], [-1, -0.45, 0], [[0, 0.28], [2.6, 0.26]], 6, dark), edges: false });
    if (f.baited) parts.push(berries([-1.8, 0.9, 0]));
  } else {
    // Sprung: the prop knocked over, lying on the ground clear of the board.
    parts.push({ faces: spun([BW + 0.6, BD + 0.9, PROP_R], [1, -0.8, 0], [[0, PROP_R], [2.4, PROP_R * 0.9]], 7, dark), edges: true });
  }
  return { parts, shade: [[-BW - 0.4, -BD - 0.4, 0], [BW + 0.4, -BD - 0.4, 0], [BW + 0.4, BD + (f.sprung ? 0.4 : -0.6), 0], [-BW - 0.4, BD + (f.sprung ? 0.4 : -0.6), 0]] };
}

/* ---- the creel --------------------------------------------------------------------------- */

/** The basket: its length along `x`, from its closed end to its throat, and how fat its belly. */
const CL = 8.2, CR = 2.0;
/** Sides round it, and how high its middle lies so the flat under its hoops sits on the ground. */
const C_SIDES = 10;
/** How far its hoops stand proud of the weave. */
const PROUD = 0.14;
const CZ = (CR + PROUD) * Math.cos(Math.PI / C_SIDES);

function creelOf(f: TrapLook): KitModel {
  const willow = f.worn ? weathered(WILLOW) : WILLOW;
  const band = deeper(willow, 0.3);
  const parts: KitPart[] = [];
  const x0 = -CL / 2 - 0.6;
  /*
   * Its rings from the closed end: a domed end, the belly with a hoop of
   * split willow standing proud round it every so often (rings of its own,
   * so they read as ribs from afar and are inked as creases), and the
   * shoulder in to the throat.
   */
  const profile: Array<[number, number]> = [[0, 0.7], [0.6, 1.55]];
  const hoopBands = new Set<number>();
  const HOOPS = [1.4, 3.1, 4.8, 6.5], HOOP_W = 0.4;
  for (const x of HOOPS) {
    profile.push([x, CR], [x, CR + PROUD]);
    hoopBands.add(profile.length - 1);
    profile.push([x + HOOP_W, CR + PROUD], [x + HOOP_W, CR]);
  }
  profile.push([CL - 0.4, 1.8], [CL, 1.7]);
  // The bands of weave a fish shows through: the belly's, between the first hoops and the last.
  const fishBand = profile.findIndex(([x]) => x === HOOPS[1] + HOOP_W) + 1;
  const fishOn = new Set([3, 4]);

  /** The weave on a side between rings `k`: stakes along it, rows round it, hoops at its ends; fish behind it in a creel with fish in it. */
  const weave = (k: number, i: number, side: Side) => (g: Ctx, kk: PaintCtx): void => {
    const fill = kk.fill;
    // Its length along the basket, from the ring it starts at (a side's own width is round it).
    const s = { w: profile[k + 1][0] - profile[k][0], h: side.h, n: side.n };
    // A side whose frame runs back along the basket is painted mirrored, so it runs from its ring forward as the rest do.
    if (side.a[0] < 0) g.scale(-1, 1);
    /*
     * The weave: withies round it along it, each a deep line, every other
     * one on every other side with a lit lip, where it passes over a stake. Painted along it only (`x`), right across the
     * side: a side's frame up it is in height, which on a side lying nearly
     * flat is long.
     */
    const dark = css(mix(fill, hex('#4a3640'), 0.5), 0.8), lit = css(mix(fill, [255, 246, 226], 0.5), 0.75);
    for (let r = 0, x = 0.25; x < s.w; r++, x += 0.65) {
      g.fillStyle = dark;
      g.fillRect(x, -50, 0.12, 100);
      if ((r + i) % 2) { g.fillStyle = lit; g.fillRect(x + 0.12, -50, 0.12, 100); }
    }
    if (f.sprung && k === fishBand && fishOn.has(i)) {
      // A fish seen through the withies: a body and a tail, silver blue.
      const cx = s.w * (i === 3 ? 0.25 : 0.4), cy = s.h * 0.5;
      g.fillStyle = FISH_DARK;
      g.beginPath(); g.ellipse(cx, cy, 0.85, 0.42, 0.1, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(cx + 0.6, cy); g.lineTo(cx + 1.25, cy + 0.45); g.lineTo(cx + 1.25, cy - 0.4); g.closePath(); g.fill();
      g.fillStyle = FISH;
      g.beginPath(); g.ellipse(cx - 0.05, cy + 0.06, 0.7, 0.28, 0.1, 0, TAU); g.fill();
      // The withies across it.
      g.fillStyle = dark;
      for (let x = cx - 0.6; x < cx + 1.3; x += 0.65) g.fillRect(x, cy - 0.6, 0.12, 1.2);
    }
    // Worn: weed green along its underside, where the water keeps it.
    if (f.worn && s.n[2] < 0.2) {
      g.fillStyle = 'rgba(96, 150, 92, 0.55)';
      g.fillRect(-0.2, -0.2, s.w + 0.4, s.h * 0.55);
    }
  };

  // The throat: the front, a funnel of withies turned in to a dark mouth; bait or a tail in it.
  const throat = (g: Ctx, kk: PaintCtx): void => {
    const fill = kk.fill;
    for (const [r, k] of [[1.75, 0.18], [1.3, 0.34], [0.85, 0.52]] as Array<[number, number]>) {
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#5a4050'), k));
      g.fill();
    }
    g.strokeStyle = css(mix(fill, [255, 246, 226], 0.3), 0.6);
    g.lineWidth = 0.12;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.6);
      g.lineTo(Math.cos(a) * 1.9, Math.sin(a) * 1.9);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 0.55, 0, TAU);
    g.fillStyle = '#3e2c3a';
    g.fill();
    if (f.baited && !f.sprung) {
      g.beginPath();
      g.ellipse(0.05, -0.1, 0.5, 0.32, 0.4, 0, TAU);
      g.fillStyle = WORM;
      g.fill();
      g.strokeStyle = WORM_INK;
      g.lineWidth = 0.08;
      g.stroke();
    }
    if (f.sprung) {
      g.fillStyle = FISH;
      g.beginPath(); g.moveTo(-0.1, 0); g.lineTo(0.55, 0.42); g.lineTo(0.55, -0.42); g.closePath(); g.fill();
    }
  };
  const back = (g: Ctx, kk: PaintCtx): void => {
    g.strokeStyle = css(mix(kk.fill, hex('#4a3640'), 0.35), 0.6);
    g.lineWidth = 0.1;
    for (const r of [0.3, 0.6]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
  };
  const body = spun([x0, 0, CZ], [1, 0, 0], profile, C_SIDES, willow, (k, i, side) => (hoopBands.has(k) ? { tone: band, crease: 0.4 } : profile[k + 1][0] - profile[k][0] > 0.05 ? { paint: weave(k, i, side) } : { tone: band }), 0).map((fc) => {
    const d = fc.n[0] / Math.hypot(...fc.n);
    const at = centre(fc.pts)[0];
    if (d > 0.9 && at > x0 + CL - 0.01) return { ...fc, tone: deeper(willow, 0.1), paint: throat, frame: { o: centre(fc.pts), a: [0, 1, 0] as V3, b: [0, 0, 1] as V3 } };
    if (d < -0.9 && at < x0 + 0.01) return { ...fc, paint: back, frame: { o: centre(fc.pts), a: [0, -1, 0] as V3, b: [0, 0, 1] as V3 } };
    return fc;
  });
  parts.push({ faces: body, edges: false });

  // The float, out on its cord: a cork spindle tipped red, standing in the water beside it.
  const F: V3 = [x0 + CL + 1.2, 3.0, 0];
  const floatFaces = spun(F, [0, 0, 1], [[0, 0.12], [0.3, 0.42], [0.85, 0.46], [1.35, 0.3], [1.7, 0.1]], 8, FLOAT, (k) => (k >= 3 ? { tone: f.worn ? weathered(FLOAT_RED) : FLOAT_RED } : undefined));
  parts.push({ faces: floatFaces, edges: true });
  const rope = f.worn ? weathered(HEMP) : HEMP;
  parts.push(cord([[x0 + CL - 0.2, 0.4, CZ + 1.55], [x0 + CL + 0.7, 1.5, 1.9], [F[0] - 0.15, F[1] - 0.4, 1.2]], 0.55, rope, true));

  // Worn: broken withies sticking out of it.
  if (f.worn) {
    parts.push({
      solid: false, reach: [[x0 + 1, -CR - 0.5, CZ], [x0 + CL - 1, CR + 0.5, CZ + CR + 0.8]],
      draw: (g, e) => {
        for (const [a, b] of [[[x0 + 2.6, -0.3, CZ + CR], [x0 + 3.4, -0.9, CZ + CR + 0.9]], [[x0 + 5.2, 0.4, CZ + CR], [x0 + 5.9, 1.1, CZ + CR + 0.7]]] as Array<[V3, V3]>) {
          cordPath(g, e, [a, b], 0.4, willow, false);
        }
      },
    });
  }
  return { parts, shade: [[x0, -CR, 0], [x0 + CL, -CR, 0], [x0 + CL, CR, 0], [x0, CR, 0]] };
}

/* ---- kept pictures ------------------------------------------------------------------------- */

function modelOf(f: TrapLook): KitModel {
  if (f.kind === 'deadfall') return deadfallOf(f);
  if (f.kind === 'creel') return creelOf(f);
  return snareOf(f.kind === 'twine_snare' ? f : { ...f, kind: 'snare' });
}

interface Bake { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; hit: [number, number, number, number] }
const bakes = new Map<string, Bake>();
const BAKES_KEPT = 96;
const models = new Map<string, KitModel>();

const keyOf = (f: TrapLook): string => `${f.kind}${f.baited ? 1 : 0}${f.sprung ? 1 : 0}${f.worn ? 1 : 0}`;
const eyeAt = (turn: number): Eye => eyeOf(0, ((Math.round(turn) % 8) + 8) % 8);

function bakeOf(f: TrapLook, turn: number, scale: number): Bake {
  const k = keyOf(f);
  const key = `${k}|${turn}|${scale}`;
  let b = bakes.get(key);
  if (b) { bakes.delete(key); bakes.set(key, b); return b; }
  let m = models.get(k);
  if (!m) models.set(k, (m = modelOf(f)));
  const e = eyeAt(turn);
  const { bounds, hit } = layKitModel(null, m, e);
  const [x0, y0, x1, y1] = bounds;
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  layKitModel(g, m, e);
  // Clicked round its solids and its floor shade: the picture less its margin.
  const P = 3 + 0.7 * 2;
  const [h0, h1, h2, h3] = hit;
  b = { canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0, hit: [Math.min(h0, x0 + P), Math.min(h1, y0 + P), Math.max(h2, x1 - P), Math.max(h3, y1 - P)] };
  bakes.set(key, b);
  if (bakes.size > BAKES_KEPT) bakes.delete(bakes.keys().next().value as string);
  return b;
}

/** The model of a trap as it is drawn, for the clipping check (`tools/studio`). */
export const trapModel = (kind: string, baited: boolean, sprung: boolean, worn = false): KitModel => modelOf({ kind, baited, sprung, worn });

/** Which of the eight ways a trap set down is turned, from where it stands, so a row of them is not all one way. */
export const trapTurn = (t: { x: number; y: number; sx: number; sy: number }): number => (t.x * 3 + t.y * 5 + t.sx * 7 + t.sy) & 7;

/**
 * A trap of `kind` whose middle is at (sx, sy), turned `turn` of the eight
 * ways: baited, sprung (something in it) and worn as it is. Its click box in
 * pixels from (sx, sy) -- left, top, right, bottom -- round its solids.
 */
export function drawTrap(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, baited: boolean, sprung: boolean, turn = 0, worn = false): [number, number, number, number] {
  const b = bakeOf({ kind, baited, sprung, worn }, turn, scaleFor(zoom));
  ctx.drawImage(b.canvas, sx + b.x * zoom, sy + b.y * zoom, b.w * zoom, b.h * zoom);
  return b.hit.map((v) => v * zoom) as [number, number, number, number];
}
