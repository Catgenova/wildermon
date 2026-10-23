import { dyeTint } from '../../game/dyestuffs';
import {
  boards, clothTone, css, deeper, extrude, faceColour, grain, hex, lathe, mix, paler, proj, slab, TAU, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tint, type Tone, type V3,
} from './core';
import { BISQUE, KILN_STONE, spun, stroke, WILLOW } from './turnery';

/**
 * A market stall (`stall`, three subtiles by two), in the kit: a boarded
 * counter under a striped awning on four square posts, the back pair taller
 * so the awning runs down to the front, a scalloped valance along its front
 * edge, what is for sale laid out along the counter -- a basket of apples,
 * three loaves, a bolt of cloth, three crocks -- and stock behind it, a crate
 * and a sack. The renderer sends it nothing but its dye and wood: the wares
 * are its own.
 *
 * The awning and the valance are linen striped in the dye; undyed, the
 * stripes are madder, as the island's markets have always been.
 */

/** The counter: its half length, its back and front, its height. */
const CX = 12.9, CY0 = 1.4, CY1 = 7.6, CZ = 7.2, TOP_Z = 7.8;
/** The posts: how far out, back and front, how thick. */
const PX = 13.8, PY = 8.4, POST = 0.9;
/** The awning: its half width, its back and front edge, how high each, how thick. */
const AX = 14.8, AY0 = -9.2, AY1 = 9.75, AZ0 = 18.4, AZ1 = 15.7, AT = 0.32;
const zAt = (y: number): number => AZ0 + ((AZ1 - AZ0) * (y - AY0)) / (AY1 - AY0);
/** The stripes across it. */
const STRIPES = 10;

/** The undyed stripe: madder, the old red dye. */
const MADDER: Tint | undefined = dyeTint('madder') ?? undefined;
/** The bolt of cloth on the counter: woad. */
const WOAD: Tint | undefined = dyeTint('woad') ?? undefined;

const woodSide = (seed: number, along: 'x' | 'y', k = 0.7) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);

function stallOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP = paler(WOOD, 0.1);
  const END = deeper(WOOD, 0.14);
  const LINEN = clothTone();
  const STRIPE = clothTone(look.tint ?? MADDER);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The counter: upright boards round it, a plinth at its foot, and its top overhanging.
  const boarded = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, Math.max(2, Math.round(s.w / 1.6)), seed, 'y');
    g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.3), 0.55);
    g.fillRect(-0.2, 0, s.w + 0.4, 0.55);
  };
  add(slab(-CX, CX, CY0, CY1, 0, CZ, WOOD, { corner: 0.2, paint: { front: boarded(11), back: boarded(12), left: boarded(13), right: boarded(14) } }));
  add(slab(-CX - 0.3, CX + 0.3, CY0 - 0.3, CY1 + 0.35, CZ, TOP_Z, TOP, {
    bevel: 0.16, corner: 0.2,
    paint: {
      top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 15, 'x'); g.restore(); },
      front: woodSide(16, 'x'), back: woodSide(17, 'x'), left: woodSide(18, 'x'), right: woodSide(19, 'x'),
    },
  }), { edges: true });

  // The posts, up to the awning's underside.
  const posts: KitPart[] = [];
  for (const x of [-PX, PX]) {
    for (const y of [-PY, PY]) {
      posts.push(add(slab(x - POST / 2, x + POST / 2, y - POST / 2, y + POST / 2, 0, zAt(y) - 0.05, WOOD, {
        corner: 0.14, paint: { front: woodSide(21, 'y'), back: woodSide(22, 'y'), left: woodSide(23, 'y'), right: woodSide(24, 'y') },
      })));
    }
  }

  // The awning: linen striped in the dye, run down to the front, a hem along its front.
  const stripeW = (AX * 2) / STRIPES;
  add(warped(slab(-AX, AX, AY0, AY1, 0, AT, LINEN, {
    crease: 0.25,
    paint: {
      top: (g, k, s) => {
        const band = faceColour(STRIPE, k.L);
        for (let i = 1; i < STRIPES; i += 2) {
          g.fillStyle = css(band);
          g.fillRect(-s.w / 2 + i * stripeW, -s.h / 2 - 1, stripeW, s.h + 2);
        }
        // A soft fall between the rafters: each stripe a hair darker down its right.
        for (let i = 0; i < STRIPES; i++) {
          g.fillStyle = 'rgba(70, 52, 80, 0.07)';
          g.fillRect(-s.w / 2 + (i + 0.6) * stripeW, -s.h / 2, stripeW * 0.4, s.h);
        }
        stroke(g, css(mix(k.fill, hex('#5a4458'), 0.25), 0.5), 0.14, [[-s.w / 2, s.h / 2 - 0.6], [s.w / 2, s.h / 2 - 0.6]]);
      },
      front: (g, _k, s) => { for (let i = 1; i < STRIPES; i += 2) { g.fillStyle = css(faceColour(STRIPE, 0.84)); g.fillRect(i * stripeW, -0.5, stripeW, s.h + 1); } },
    },
  }), (p) => [p[0], p[1], p[2] + zAt(p[1])]), { after: posts, edges: true });

  // The valance hung along its front edge, scalloped, each scallop the colour of the stripe over it.
  const zf = zAt(AY1);
  const outline: Pt[] = [[-AX, zf + AT], [-AX, zf - 0.7]];
  for (let i = 0; i < STRIPES; i++) {
    const a = -AX + i * stripeW;
    for (let j = 1; j <= 6; j++) outline.push([a + (j / 6) * stripeW, zf - 0.7 - Math.sin((j / 6) * Math.PI) * 0.65]);
  }
  outline.push([AX, zf + AT]);
  // Its frame runs along x on its front and back along -x, so a stripe is laid from whichever end.
  const scallops = (back: boolean) => (g: Ctx, k: PaintCtx): void => {
    g.fillStyle = css(faceColour(STRIPE, k.L));
    for (let i = 1; i < STRIPES; i += 2) g.fillRect(back ? AX - (i + 1) * stripeW : -AX + i * stripeW, zf - 2, stripeW, 3);
    stroke(g, css(mix(k.fill, hex('#5a4458'), 0.25), 0.5), 0.12, [[-AX, zf - 0.35], [AX, zf - 0.35]]);
  };
  add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, AY1 + 0.02, AY1 + 0.24, LINEN, 0.06, { front: scallops(false), back: scallops(true) }));

  // What is for sale, along the counter.
  const W = (x: number, y: number, profile: Array<[number, number]>, tone: Tone, sides = 12): KitPart => add(lathe(x, y, profile.map(([z, r]) => [TOP_Z + z, r] as [number, number]), sides, tone), { edges: true });
  // A basket of apples.
  const basket = add(lathe(-9.4, 4.4, [[TOP_Z, 1.45], [TOP_Z + 1.1, 1.9], [TOP_Z + 1.3, 1.95]], 12, WILLOW, 0.5, (k, _i, s) => (k === 0 ? {
    paint: (g: Ctx, kk: PaintCtx) => {
      for (let y = 0.18; y < s.h; y += 0.3) stroke(g, css(mix(kk.fill, hex('#5a4458'), 0.4), 0.55), 0.08, [[-0.2, y], [s.w + 0.2, y]]);
    },
  } : undefined)), { edges: true });
  // The apples: red in madder's own tone, a green one in the leaves' (`ROSE_LEAF` in furniture.ts).
  const APPLE = faceColour(clothTone(MADDER), 0.95), LEAF = hex('#a6d49a');
  const apples: V3[] = [[-10.2, 4.0], [-9.2, 3.7], [-8.6, 4.6], [-9.6, 5.0], [-10.1, 5.0], [-9.3, 4.4]].map(([x, y], i) => [x, y, TOP_Z + 1.45 + (i === 5 ? 0.35 : 0)] as V3);
  parts.push({
    reach: apples.map((p) => [p[0], p[1], p[2] + 0.5] as V3),
    after: [basket],
    draw: (g, e) => {
      apples.forEach((p, i) => {
        const [x, y] = proj(e, p);
        g.beginPath();
        g.arc(x, y - 0.6, 0.78, 0, TAU);
        g.fillStyle = css(i % 3 === 1 ? LEAF : APPLE);
        g.strokeStyle = css(hex('#7a4c55'));
        g.lineWidth = 0.35;
        g.fill();
        g.stroke();
        g.beginPath();
        g.arc(x - 0.25, y - 0.85, 0.24, 0, TAU);
        g.fillStyle = 'rgba(255, 250, 240, 0.7)';
        g.fill();
      });
    },
  });
  // Three loaves.
  const BREAD: Tone = paler(WILLOW, 0.18);
  for (const [x, y] of [[-5.6, 3.2], [-4.0, 5.4], [-6.3, 6.0]]) W(x, y, [[0, 1.05], [0.55, 1.15], [0.95, 0.9], [1.2, 0.45], [1.28, 0.05]], BREAD, 10);
  // A bolt of cloth lying along the counter.
  add(spun([-0.3, 4.6, TOP_Z + 0.95], [1, 0, 0], [[0, 0.82], [0.12, 0.95], [4.9, 0.95], [5.0, 0.82]], 10, clothTone(WOAD)), { edges: true });
  // Three crocks with their lids.
  for (const [x, y, h] of [[7.6, 3.4, 1.9], [9.6, 4.4, 1.5], [7.9, 6.0, 1.3]]) {
    W(x, y, [[0, 0.82], [h * 0.5, 1.05], [h * 0.9, 0.78], [h, 0.6]], BISQUE);
    W(x, y, [[h, 0.66], [h + 0.15, 0.66], [h + 0.3, 0.35], [h + 0.42, 0.15]], KILN_STONE, 10);
  }

  // Stock behind it: a crate, and a sack of grain.
  add(slab(-12.2, -7.4, -8.6, -4.2, 0, 4.4, END, {
    corner: 0.12, bevel: 0.12,
    paint: {
      front: (g, k, s) => boards(g, k.fill, s.w, s.h, 3, 31), back: (g, k, s) => boards(g, k.fill, s.w, s.h, 3, 32),
      left: (g, k, s) => boards(g, k.fill, s.w, s.h, 3, 33), right: (g, k, s) => boards(g, k.fill, s.w, s.h, 3, 34),
      top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 35, 'y'); g.restore(); },
    },
  }), { edges: true });
  add(lathe(9.6, -5.6, [[0, 1.9], [1.4, 2.35], [3.2, 2.0], [4.1, 1.05], [4.5, 0.45], [4.8, 0.55]], 10, deeper(LINEN, 0.18), 0.5, (k, _i, s) => (k === 3 ? {
    paint: (g: Ctx, kk: PaintCtx) => stroke(g, css(mix(kk.fill, hex('#5a4458'), 0.5), 0.8), 0.18, [[-0.2, s.h * 0.6], [s.w + 0.2, s.h * 0.6]]),
  } : undefined)), { edges: true });
  return { parts, shade: [[-PX - 0.5, -PY - 0.5, 0], [PX + 0.5, -PY - 0.5, 0], [PX + 0.5, PY + 0.8, 0], [-PX - 0.5, PY + 0.8, 0]] };
}

export const STALL: KitPiece = { model: (look) => stallOf(look), uses: { tint: true, material: true } };
