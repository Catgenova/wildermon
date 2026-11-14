import {
  clothTone, css, deeper, faceColour, grain, hex, lathe, mix, paler, proj, slab, toneOf, warped, woodTone,
  type Ctx, type Eye, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';
import { rod, spun, stroke } from './turnery';

/**
 * Ropemaking's pieces, in the kit (`ropework.ts` in the game).
 *
 * A hammock (`hammock`, three subtiles by one) is a bed of cloth slung on
 * two spreader bars between two stout posts, each bar hung from its post top
 * by a fan of cords run to a ring; the cloth sags in its middle and takes the
 * dye, its edges hemmed with rope.
 *
 * A rope walk (`rope_walk`, one subtile by four, a tile long) is the bench a
 * lay-up is twisted on: at its head a jack -- two posts and a cross head with
 * a crank wheel turning three hooks -- and at its foot a post with a hook;
 * between them three strands stretched taut over two trestles, and a top,
 * the grooved cone the strands are laid behind, partway down them; a coil of
 * finished rope on the ground by the jack.
 */

/** Hemp, as the bell's rope (`kit/bell.ts`). */
const HEMP: Tone = toneOf('#ead2a4', '#9a7e6c');
/** Hemp twisted and handled, a step deeper. */
const CORD: Tone = deeper(HEMP, 0.22);

/** Wood's grain along a side. */
const woodSide = (seed: number, along: 'x' | 'y', k = 0.6) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);

/**
 * A cord drawn loose from `a` to `b`, sagging `sag` units at its middle: a
 * deep line under a lit one, as the tent's guys are drawn. Twisted, it is
 * ticked across every few units as laid rope is.
 */
function cord(a: V3, b: V3, sag: number, w: number, tone: Tone, twisted = false): KitPart {
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - sag];
  return {
    reach: [a, b, mid],
    draw: (g: Ctx, e: Eye) => {
      const [ax, ay] = proj(e, a), [bx, by] = proj(e, b), [mx, my] = proj(e, mid);
      // The control point that puts the curve through the middle.
      const cx = 2 * mx - (ax + bx) / 2, cy = 2 * my - (ay + by) / 2;
      const line = (colour: string, lw: number): void => {
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ax, ay);
        g.quadraticCurveTo(cx, cy, bx, by);
        g.strokeStyle = colour;
        g.lineWidth = lw;
        g.stroke();
      };
      line(css(mix(tone.shade, hex('#4a3640'), 0.4), 0.95), w);
      line(css(mix(tone.lit, [255, 248, 230], 0.1), 0.95), w * 0.45);
      if (!twisted) return;
      // The lay: short ticks slanting across the strand, every so often along it.
      const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 1.6));
      g.strokeStyle = css(mix(tone.shade, hex('#4a3640'), 0.25), 0.7);
      g.lineWidth = w * 0.28;
      for (let i = 1; i < n; i++) {
        const t = i / n, u = 1 - t;
        const px = u * u * ax + 2 * u * t * cx + t * t * bx, py = u * u * ay + 2 * u * t * cy + t * t * by;
        g.beginPath();
        g.moveTo(px - w * 0.35, py - w * 0.45);
        g.lineTo(px + w * 0.35, py + w * 0.45);
        g.stroke();
      }
    },
  };
}

/* ---- the hammock --------------------------------------------------------------------- */

/** The posts: how far out along it, how thick, and their tops. */
const H_POST = 13.2, H_POST_R = 0.85, H_TOP = 12.5;
/** The bed of cloth: half its length and width, the height of its ends and of its lowest point. */
const H_LEN = 9.6, H_WIDE = 3.4, H_END = 8.2, H_LOW = 4.6;

function hammockOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const CLOTH = look.tint ? clothTone(look.tint) : deeper(clothTone(), 0.12);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The posts, each on a squat foot, a cap turned on its head.
  for (const [i, x] of [-H_POST, H_POST].entries()) {
    add(slab(x - 1.6, x + 1.6, -1.6, 1.6, 0, 0.7, deeper(WOOD, 0.14), { corner: 0.3, bevel: 0.15, paint: { front: woodSide(3 + i, 'x'), left: woodSide(5 + i, 'x'), right: woodSide(7 + i, 'x'), back: woodSide(9 + i, 'x') } }), { edges: true });
    add(rod([x, 0, 0.7], [x, 0, H_TOP], H_POST_R, WOOD, 8, (_k, _i, s) => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 11 + i, 'y', 0.45) })));
    add(lathe(x, 0, [[H_TOP, 1.05], [H_TOP + 0.35, 1.12], [H_TOP + 0.7, 0.7], [H_TOP + 0.9, 0.1]], 8, paler(WOOD, 0.1)), { edges: true });
  }
  // The bed: cloth hung from end to end, sagging to its middle, its sides drawn up a little.
  const sag = (p: V3): V3 => {
    const t = p[0] / H_LEN;
    const across = Math.abs(p[1]) / H_WIDE;
    return [p[0], p[1] * (0.86 + 0.14 * t * t), p[2] + H_LOW + (H_END - H_LOW) * t * t + 0.9 * across * across * (1 - t * t)];
  };
  const bedFaces = (x0: number, x1: number): Face[] => warped(slab(x0, x1, -H_WIDE, H_WIDE, 0, 0.32, CLOTH, {
    paint: {
      top: (g, k, s) => {
        // The weave, and a shade pooled in the hollow.
        const gr = g.createLinearGradient(0, -s.h / 2, 0, s.h / 2);
        gr.addColorStop(0, css(mix(k.fill, [255, 250, 240], 0.28), 0.45));
        gr.addColorStop(0.5, css(mix(k.fill, hex('#6a5468'), 0.18), 0.35));
        gr.addColorStop(1, css(mix(k.fill, [255, 250, 240], 0.22), 0.4));
        g.fillStyle = gr;
        g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
        for (let y = -s.h / 2 + 0.9; y < s.h / 2; y += 1.5) stroke(g, css(mix(k.fill, hex('#5a4458'), 0.3), 0.35), 0.1, [[-s.w / 2, y], [s.w / 2, y]]);
      },
    },
  }), sag);
  // In slices along its length, so that the curve reads.
  const SLICES = 6;
  for (let i = 0; i < SLICES; i++) {
    const x0 = -H_LEN + (2 * H_LEN * i) / SLICES, x1 = -H_LEN + (2 * H_LEN * (i + 1)) / SLICES;
    add(bedFaces(x0, x1), { ink: 0.5 });
  }
  // The rope hems along each side.
  for (const s of [-1, 1]) {
    const pts: V3[] = Array.from({ length: 9 }, (_, i) => sag([-H_LEN + (2 * H_LEN * i) / 8, s * H_WIDE, 0.3]));
    for (let i = 0; i < pts.length - 1; i++) parts.push(cord(pts[i], pts[i + 1], 0, 0.55, CORD, true));
  }
  // The spreader bars at its ends, and the fan of cords from each bar to a ring at its post's head.
  for (const sx of [-1, 1]) {
    const bar = sag([sx * H_LEN, 0, 0.3]);
    add(spun([bar[0], -H_WIDE - 0.6, bar[2]], [0, 1, 0], [[0, 0.42], [2 * H_WIDE + 1.2, 0.42]], 8, deeper(WOOD, 0.08)), { edges: true });
    const ring: V3 = [sx * (H_POST - 1), 0, H_TOP - 1.2];
    for (const y of [-H_WIDE, -H_WIDE / 2, 0, H_WIDE / 2, H_WIDE]) parts.push(cord([bar[0], y, bar[2] + 0.2], ring, 0.15, 0.32, HEMP));
    parts.push(cord(ring, [sx * H_POST, 0, H_TOP - 0.8], 0, 0.7, CORD, true));
  }
  return { parts, shade: [[-H_POST - 1.6, -H_WIDE - 0.6, 0], [H_POST + 1.6, -H_WIDE - 0.6, 0], [H_POST + 1.6, H_WIDE + 0.6, 0], [-H_POST - 1.6, H_WIDE + 0.6, 0]] };
}

/* ---- the rope walk -------------------------------------------------------------------- */

/** Along it: the jack at its head and the post at its foot, and the height the strands run at. */
const W_JACK = -17.2, W_FOOT = 17.6, W_STRAND = 7.4;
/** The strands, across it. */
const STRANDS = [-1.25, 0, 1.25];
/** The trestles the strands rest on, along it. */
const TRESTLES = [-5.6, 6.2];

function ropeWalkOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const DARK = deeper(WOOD, 0.18);
  const IRONISH: Tone = toneOf('#a6aec2', '#4f5672');
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const up = (seed: number) => ({ front: woodSide(seed, 'y'), back: woodSide(seed + 1, 'y'), left: woodSide(seed + 2, 'y'), right: woodSide(seed + 3, 'y') });
  const along = (seed: number) => ({ front: woodSide(seed, 'x'), back: woodSide(seed + 1, 'x'), left: woodSide(seed + 2, 'x'), right: woodSide(seed + 3, 'x'), top: woodSide(seed + 4, 'y') });

  // The jack: a sill, two posts, a cross head; the wheel on its face and the three hooks it turns.
  add(slab(-4.2, 4.2, W_JACK - 1.4, W_JACK + 1.4, 0, 0.8, DARK, { corner: 0.2, bevel: 0.12, paint: along(3) }), { edges: true });
  for (const [i, x] of [-3.1, 3.1].entries()) add(slab(x - 0.6, x + 0.6, W_JACK - 0.6, W_JACK + 0.6, 0.8, 10.6, WOOD, { corner: 0.14, paint: up(11 + i * 4) }));
  add(slab(-4.1, 4.1, W_JACK - 0.85, W_JACK + 0.85, 8.4, 10.8, WOOD, { corner: 0.18, bevel: 0.14, paint: along(21) }), { edges: true });
  // The wheel, on the jack's far face, and its crank.
  add(spun([0, W_JACK - 0.85, 9.6], [0, -1, 0], [[0, 0], [0.01, 3.1], [0.7, 3.1], [0.71, 0]], 16, DARK, (_k, _i, s) => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 29, 'x', 0.5) })), { edges: true });
  add(rod([2.2, W_JACK - 1.6, 9.6], [2.2, W_JACK - 3.1, 9.6], 0.32, IRONISH, 6));
  // The hooks, through the head, one to a strand.
  for (const y of STRANDS) {
    add(rod([y * 1.6, W_JACK + 0.85, W_STRAND + 1.8], [y * 1.6, W_JACK + 2.2, W_STRAND + 1.8], 0.22, IRONISH, 6));
  }

  // The foot post, its sill and its hook.
  add(slab(-2.6, 2.6, W_FOOT - 1.3, W_FOOT + 1.3, 0, 0.8, DARK, { corner: 0.2, bevel: 0.12, paint: along(41) }), { edges: true });
  add(slab(-0.8, 0.8, W_FOOT - 0.8, W_FOOT + 0.8, 0.8, W_STRAND + 2.6, WOOD, { corner: 0.18, paint: up(47) }), { edges: true });
  add(rod([0, W_FOOT - 0.8, W_STRAND + 0.6], [0, W_FOOT - 2.0, W_STRAND + 0.6], 0.24, IRONISH, 6));

  // The trestles: two legs splayed and a bar across their heads, notched for the strands.
  for (const [i, y] of TRESTLES.entries()) {
    for (const s of [-1, 1]) add(rod([s * 3.4, y, 0], [s * 2.2, y, W_STRAND - 0.6], 0.38, DARK, 6, (_k, _j, sd) => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, sd.w, sd.h, 61 + i * 2 + s, 'y', 0.4) })));
    add(slab(-2.9, 2.9, y - 0.45, y + 0.45, W_STRAND - 0.7, W_STRAND - 0.15, WOOD, { corner: 0.12, paint: along(71 + i * 5) }), { edges: true });
  }

  // The strands, from the hooks to where they come together behind the top, and the laid rope from the top to the foot.
  const TOP_AT = 8.4;
  const fanned = (y: number, at: number): V3 => [y * 1.6 * (1 - (at - W_JACK - 2.2) / (TOP_AT - W_JACK - 2.2)) + y * 0.18, at, W_STRAND + 1.8 - 1.4 * ((at - W_JACK - 2.2) / (TOP_AT - W_JACK - 2.2))];
  for (const y of STRANDS) parts.push(cord([y * 1.6, W_JACK + 2.2, W_STRAND + 1.8], fanned(y, TOP_AT - 0.9), 0.12, 0.55, HEMP, true));
  parts.push(cord([0, TOP_AT + 1.1, W_STRAND + 0.5], [0, W_FOOT - 2.0, W_STRAND + 0.6], 0.25, 0.95, CORD, true));
  // The top: a short grooved cone, its handle out to the side.
  add(spun([0, TOP_AT - 0.9, W_STRAND + 0.45], [0, 1, 0], [[0, 0.95], [1.1, 0.95], [2.0, 0.42]], 10, paler(WOOD, 0.06), (_k, _i, s) => ({
    paint: (g: Ctx, k: PaintCtx) => { for (const x of [s.w * 0.3, s.w * 0.6]) stroke(g, css(mix(k.fill, hex('#4a3640'), 0.45), 0.6), 0.14, [[x, 0], [x, s.h]]); },
  })), { edges: true });
  add(rod([0.9, TOP_AT + 0.1, W_STRAND + 0.45], [4.6, TOP_AT + 0.1, W_STRAND - 0.4], 0.26, DARK, 6));

  // A coil of finished rope on the ground by the jack.
  const C: V3 = [-2.4, W_JACK + 4.4, 0];
  parts.push({
    reach: [[C[0] - 2.2, C[1] - 2.2, 0], [C[0] + 2.2, C[1] + 2.2, 1.6]],
    draw: (g: Ctx, e: Eye) => {
      for (let r = 0; r < 4; r++) {
        const z = 0.3 + r * 0.32, rad = 1.9 - r * 0.18;
        const pts = Array.from({ length: 25 }, (_, i) => proj(e, [C[0] + Math.cos((i / 24) * Math.PI * 2) * rad, C[1] + Math.sin((i / 24) * Math.PI * 2) * rad, z]));
        for (const [w, colour] of [[0.95, css(mix(CORD.shade, hex('#4a3640'), 0.4), 0.95)], [0.42, css(faceColour(CORD, 0.85), 0.95)]] as Array<[number, string]>) {
          g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.strokeStyle = colour;
          g.lineWidth = w;
          g.stroke();
        }
      }
    },
  });
  return { parts, shade: [[-4.4, W_JACK - 1.6, 0], [4.4, W_JACK - 1.6, 0], [4.4, W_FOOT + 1.4, 0], [-4.4, W_FOOT + 1.4, 0]] };
}

export const HAMMOCK: KitPiece = { model: (look) => hammockOf(look), uses: { tint: true, material: true } };
export const ROPE_WALK_PIECE: KitPiece = { model: (look) => ropeWalkOf(look), uses: { material: true } };
