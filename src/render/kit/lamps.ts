import { LAMP_ARM, LAMP_GLASS, LAMP_HANG } from '../../game/lamps';
import { ashlar, DRESSED, FOOTING, glow, speckle, STONE } from './hearthstone';
import {
  css, deeper, extrude, faceColour, grain, hex, IRON, lathe, mix, paler, proj, sheen, slab, TAU, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';

/**
 * The two pieces a lantern is fitted to (`lamps.ts`), in the kit.
 *
 * A lantern post (`lamp_post`): a squared post of the wood it was built of,
 * capped, set in a dressed stone foot, with an iron arm off its head toward
 * its front, a strut under it and a hook off its end. A lantern pillar
 * (`lamp_pillar`): a shaft of coursed stone on a stepped plinth, under a
 * moulded capital with an iron collar in its top.
 *
 * `trim` 1 is a lantern fitted (`Renderer.pieceTrim`): hung off the hook,
 * its middle `LAMP_ARM` out and `LAMP_HANG.arm` up, or standing in the
 * collar, `LAMP_HANG.top` up -- where the renderer blooms its light from
 * (`drawLampBloom`). Lit, its panes are the candle's colour with the flame
 * a bright drop low in them and a halo round the whole, baked: what moves
 * live over a piece is never told whether it is alight.
 */

/* ---- the lantern -------------------------------------------------------------------- */

/** Glass with a candle behind it, and glass in the dark. */
const PANE_LIT: Tone = toneOf('#ffe7a4', '#e9b468');
const PANE_DARK: Tone = toneOf('#b4c8d0', '#6f7c94');

/** How far the top of a lantern's ring stands over its middle, `k` times the post's: what it is hung from. */
const lanternTop = (k: number): number => 1.7 * k + 1.7 * k + 1 * k;

/** A pane in its iron frame: the frame round it, a bar up its middle and one across, and lit, the candle low behind it. */
function pane(lit: boolean, k: number) {
  return (g: Ctx, kk: PaintCtx, s: Side): void => {
    const iron = faceColour(IRON, kk.L);
    if (lit) {
      // The candle's light, brightest round its flame.
      const fx = s.w / 2, fy = s.h * 0.34;
      const gr = g.createRadialGradient(fx, fy, 0, fx, fy, s.h * 0.7);
      gr.addColorStop(0, 'rgba(255, 252, 232, 0.95)');
      gr.addColorStop(0.35, 'rgba(255, 236, 170, 0.55)');
      gr.addColorStop(1, 'rgba(255, 220, 140, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s.w, s.h);
      // The candle under its flame.
      g.fillStyle = css(mix(hex('#fff4dc'), [240, 200, 150], 0.3));
      g.fillRect(fx - 0.22 * k, 0.15 * k, 0.44 * k, fy - 0.45 * k);
      g.beginPath();
      g.ellipse(fx, fy, 0.22 * k, 0.42 * k, 0, 0, TAU);
      g.fillStyle = '#fffbe6';
      g.fill();
    } else {
      // A glint of the sky down the glass.
      g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      g.lineWidth = 0.18 * k;
      g.beginPath();
      g.moveTo(s.w * 0.22, s.h * 0.2);
      g.lineTo(s.w * 0.36, s.h * 0.85);
      g.stroke();
    }
    const bar = 0.2 * k;
    g.fillStyle = css(mix(iron, hex('#2e2a3c'), 0.25));
    g.fillRect(-0.1, -0.1, bar + 0.1, s.h + 0.2);
    g.fillRect(s.w - bar, -0.1, bar + 0.1, s.h + 0.2);
    g.fillRect(-0.1, -0.1, s.w + 0.2, bar);
    g.fillRect(-0.1, s.h - bar, s.w + 0.2, bar + 0.1);
    g.fillStyle = css(iron, lit ? 0.75 : 1);
    g.fillRect(s.w / 2 - bar * 0.4, 0, bar * 0.8, s.h);
    g.fillRect(0, s.h * 0.62 - bar * 0.4, s.w, bar * 0.8);
  };
}

/**
 * A street lantern with its middle at `at`, `k` times the size of the one on
 * a post: an iron plate under a square frame of four panes, a pyramid cap
 * over them overhanging a little, and a ring on its top to hang it by; lit,
 * a halo round the whole, laid before it.
 */
function lantern(parts: KitPart[], at: V3, k: number, lit: boolean): void {
  const [cx, cy, cz] = at;
  const r = 1.2 * k, h = 3.4 * k, z0 = cz - h / 2, z1 = cz + h / 2;
  const capTop = z1 + 1.7 * k, o = r + 0.35 * k;
  const after: KitPart[] = [];
  if (lit) {
    const R = 9 * k;
    const halo: KitPart = {
      reach: [[cx - r, cy - r, z0], [cx + r, cy + r, capTop]],
      draw: (g, e) => {
        const [x, y] = proj(e, at);
        glow(g, x, y, R, 0.5, '255, 206, 130');
      },
    };
    parts.push(halo);
    after.push(halo);
  }
  const plate: KitPart = { faces: slab(cx - r - 0.2, cx + r + 0.2, cy - r - 0.2, cy + r + 0.2, z0 - 0.4 * k, z0, IRON, { corner: 0.12 }), after: after.slice() };
  const paint = pane(lit, k);
  const glass: KitPart = {
    faces: slab(cx - r, cx + r, cy - r, cy + r, z0, z1, lit ? PANE_LIT : PANE_DARK, { crease: 0.3, paint: { front: paint, back: paint, left: paint, right: paint } }),
    after: [...after, plate],
  };
  const R2 = o * Math.SQRT2;
  const cap: KitPart = {
    faces: lathe(cx, cy, [[z1, R2], [z1 + 0.3 * k, R2], [capTop, 0.16 * k]], 4, IRON, 0.5, () => ({
      crease: 0.3,
      paint: (g: Ctx, kk: PaintCtx) => sheen(g, kk.fill, 6, 3, 5),
    })),
    after: [...after, glass], edges: true,
  };
  const ring: KitPart = { faces: lathe(cx, cy, [[capTop - 0.1, 0.28 * k], [capTop + 0.45 * k, 0.4 * k], [capTop + 0.95 * k, 0.12 * k]], 6, IRON), after: [cap] };
  parts.push(plate, glass, cap, ring);
}

/* ---- the post ------------------------------------------------------------------------ */

/** The arm just over the lantern's ring, and the post's head just over the arm: under the eaves of one storey (`LAMP_HANG`). */
const RING_TOP = LAMP_HANG.arm + lanternTop(LAMP_GLASS);
const POST = 0.8, ARM_Z = RING_TOP + 0.3, HEAD = ARM_Z + 0.6, OUT = LAMP_ARM + 0.4;

/** A side of the post, its grain running up it. */
const upGrain = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'y', 0.8);
/** Iron's sheen over a side. */
const ironSide = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => sheen(g, k.fill, s.w, s.h, seed);

function postOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The dressed stone foot it is set in.
  add(slab(-1.7, 1.7, -1.7, 1.7, 0, 1.5, FOOTING, {
    corner: 0.2, bevel: 0.28,
    paint: Object.fromEntries((['front', 'back', 'left', 'right'] as const).map((f, i) => [f, (g: Ctx, k: PaintCtx, s: Side) => speckle(g, k.fill, s.w, s.h, 3 + i)])),
  }), { edges: true });
  // The post, and the cap over its end grain.
  add(slab(-POST, POST, -POST, POST, 1.5, HEAD, WOOD, {
    corner: 0.2, taper: -0.05,
    paint: { front: upGrain(11), back: upGrain(12), left: upGrain(13), right: upGrain(14) },
  }));
  add(slab(-POST - 0.3, POST + 0.3, -POST - 0.3, POST + 0.3, HEAD, HEAD + 0.75, paler(WOOD, 0.08), { corner: 0.2, bevel: 0.3 }), { edges: true });
  // The arm off its head, the strut under it, and the hook off its end.
  add(slab(-0.26, 0.26, POST, OUT, ARM_Z - 0.32, ARM_Z + 0.32, IRON, { corner: 0.08, paint: { left: ironSide(21), right: ironSide(22), top: (g, k, s) => sheen(g, k.fill, s.w, s.h, 23) } }), { edges: true });
  add(slab(-0.32, 0.32, OUT - 0.1, OUT + 0.45, ARM_Z - 0.42, ARM_Z + 0.42, deeper(IRON, 0.1), { corner: 0.1 }));
  add(extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], [[POST, ARM_Z - 3.9], [POST, ARM_Z - 3.1], [4.0, ARM_Z - 0.32], [3.1, ARM_Z - 0.32]], -0.2, 0.2, IRON, 0.05));
  add(slab(-0.18, 0.18, LAMP_ARM - 0.18, LAMP_ARM + 0.18, RING_TOP, ARM_Z - 0.32, IRON));
  if (Math.round(look.trim ?? 0) === 1) lantern(parts, [0, LAMP_ARM, LAMP_HANG.arm], LAMP_GLASS, look.lit);
  return { parts, shade: [[-1.9, -1.9, 0], [1.9, -1.9, 0], [1.9, 1.9, 0], [-1.9, 1.9, 0]] };
}

/* ---- the pillar ------------------------------------------------------------------------ */

/** Its lantern's size against a post's, and the top of the collar it stands in. */
const PILLAR_K = 1.3;
const FOOT = LAMP_HANG.top - (3.4 * PILLAR_K) / 2 - 0.4 * PILLAR_K;

/** A side of coursed stone. */
const coursed = (seed: number, course: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  speckle(g, k.fill, s.w, s.h, seed);
  ashlar(g, k.fill, s.w, s.h, seed + 1, course);
};
const allSides = (f: (i: number) => (g: Ctx, k: PaintCtx, s: Side) => void) =>
  Object.fromEntries((['front', 'back', 'left', 'right'] as const).map((side, i) => [side, f(i)]));

function pillarOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  add(slab(-2.5, 2.5, -2.5, 2.5, 0, 2, FOOTING, { corner: 0.25, bevel: 0.3, paint: allSides((i) => coursed(31 + i * 5, 1)) }), { edges: true });
  add(slab(-2.15, 2.15, -2.15, 2.15, 2, 2.7, DRESSED, { corner: 0.2, bevel: 0.22 }), { edges: true });
  add(slab(-1.7, 1.7, -1.7, 1.7, 2.7, FOOT - 2, STONE, { corner: 0.18, paint: allSides((i) => coursed(51 + i * 5, 1.35)) }));
  add(slab(-2.3, 2.3, -2.3, 2.3, FOOT - 2, FOOT - 1, DRESSED, { corner: 0.22, bevel: 0.3 }), { edges: true });
  add(slab(-1.95, 1.95, -1.95, 1.95, FOOT - 1, FOOT - 0.5, DRESSED, { corner: 0.18, bevel: 0.15 }), { edges: true });
  // The iron collar the lantern stands in.
  add(slab(-1.4, 1.4, -1.4, 1.4, FOOT - 0.5, FOOT, IRON, {
    corner: 0.2,
    paint: { ...allSides((i) => ironSide(61 + i)), top: (g) => { g.fillStyle = 'rgba(40, 36, 52, 0.45)'; g.fillRect(-1, -1, 2, 2); } },
  }), { edges: true });
  if (Math.round(look.trim ?? 0) === 1) lantern(parts, [0, 0, LAMP_HANG.top], PILLAR_K, look.lit);
  return { parts, shade: [[-2.7, -2.7, 0], [2.7, -2.7, 0], [2.7, 2.7, 0], [-2.7, 2.7, 0]] };
}

const STATES = [{ trim: 0, label: 'empty' }, { trim: 1, label: 'lantern' }];

export const LAMP_POST: KitPiece = {
  model: (look) => postOf(look),
  uses: { lit: true, trim: true, material: true },
  states: STATES,
};

export const LAMP_PILLAR: KitPiece = {
  model: (look) => pillarOf(look),
  uses: { lit: true, trim: true },
  states: STATES,
};

