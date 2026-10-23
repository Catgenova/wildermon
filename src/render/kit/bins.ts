import {
  band, BRASS, boards, css, deeper, extrude, faceColour, grain, hex, IRON, lathe, metalTone, mix, nail, paler, proj, seam, sheen, slab, TAU, toneOf, turned, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tone, type V3,
} from './core';
import { MOSS, rand } from '../ivy';
import { area2 } from '../runestone';

/**
 * The bins (`bulk_bin`, `craft_bin`, `seed_bin`, `sprout_bin`), in the kit,
 * each kept to what told it from the others at a glance in the old model:
 *
 * - the raw material bin: a big boarded box shut under a battened lid, bound
 *   at its corners and round its middle in iron, an iron hasp at the front;
 * - the craft material bin: the same box open, parted in four, and what has
 *   been sorted into each part -- nails, planks, lumps of metal, coils of
 *   ribbon -- seen over its walls;
 * - the seed bin: a small boarded box under a lid, a wooden scoop with seed
 *   in it lying on the lid;
 * - the sprout bin: the same small box under a damp cloth hanging down its
 *   front, sprouts come up through it.
 *
 * All of the wood they were built of; dyed, the boards are painted and the
 * iron, the cloth and what is in them are left as they are.
 */

/* ---- painting ------------------------------------------------------------------------- */

/** A top of boards, painted from its middle. */
const plankedTop = (n: number, seed: number, along: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  boards(g, k.fill, s.w, s.h, n, seed, along);
  g.restore();
};
/** The grain along a narrow face: a wall's top, a rail, a batten. */
const grained = (seed: number, along: 'x' | 'y' = 'x', centred = false) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  if (centred) g.translate(-s.w / 2, -s.h / 2);
  grain(g, k.fill, s.w, s.h, seed, along, 0.6);
  g.restore();
};

/** The inside of an open box: its boards a step deeper, and darker down in it where the light does not reach. */
const inside = (n: number, seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  boards(g, k.fill, s.w, s.h, n, seed, 'y');
  const gr = g.createLinearGradient(0, 0, 0, s.h);
  gr.addColorStop(0, 'rgba(46, 36, 56, 0.4)');
  gr.addColorStop(1, 'rgba(46, 36, 56, 0)');
  g.fillStyle = gr;
  g.fillRect(-0.5, 0, s.w + 1, s.h);
};

const square = (x: number, y: number): V3[] => [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]];

/* ---- the raw material bin ------------------------------------------------------------------ */

function bulkBinOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const LID = paler(WOOD, 0.06);
  const X = hw - 1, Y = hd - 1, H = 8.6, O = 0.45, LT = 1;
  const parts: KitPart[] = [];

  // The body: boards standing up it, iron up its corners and round its middle.
  const side = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 6, seed, 'y');
    const mid = s.h * 0.42;
    band(g, k, 0, s.w, mid, mid + 0.85, 6, false);
    band(g, k, -0.1, 0.85, 0, s.h, 4, true);
    band(g, k, s.w - 0.85, s.w + 0.1, 0, s.h, 4, true);
  };
  parts.push({ faces: slab(-X, X, -Y, Y, 0, H, WOOD, { corner: 0.2, paint: { front: side(11), back: side(12), left: side(13), right: side(14) } }) });

  // The lid, over the body all round, its boards running front to back, and two battens across it.
  parts.push({
    faces: slab(-X - O, X + O, -Y - O, Y + O, H, H + LT, LID, {
      corner: 0.3, bevel: 0.28,
      paint: { top: plankedTop(6, 21, 'y'), front: grained(22), back: grained(23), left: grained(24), right: grained(25) },
    }),
    edges: true,
  });
  for (const [i, y] of [-(Y + O) * 0.58, (Y + O) * 0.58].entries()) {
    parts.push({
      faces: slab(-X + 0.1, X - 0.1, y - 0.65, y + 0.65, H + LT, H + LT + 0.45, deeper(LID, 0.1), {
        corner: 0.12, bevel: 0.14,
        paint: {
          top: (g, k, s) => {
            grained(31 + i, 'x', true)(g, k, s);
            for (const x of [-s.w / 2 + 0.6, -s.w / 6, s.w / 6, s.w / 2 - 0.6]) nail(g, k.fill, x, 0, 0.16);
          },
          front: grained(33 + i), back: grained(35 + i),
        },
      }),
      edges: true,
    });
  }

  // The hasp: an iron strap down from the lid over the front, a staple through it and the brass ring of a pin through that.
  const hy0 = Y + O, hy1 = Y + O + 0.32;
  parts.push({
    faces: slab(-0.95, 0.95, hy0, hy1, H - 1.7, H + 0.75, IRON, {
      corner: 0.1,
      paint: {
        front: (g, k, s) => {
          sheen(g, k.fill, s.w, s.h, 41);
          g.fillStyle = css(mix(k.fill, [255, 255, 255], 0.45), 0.6);
          g.fillRect(0, 0, 0.14, s.h);
          for (const y of [s.h - 0.35, 0.35]) nail(g, k.fill, s.w / 2, y, 0.15);
          // The slot the staple comes through.
          g.fillStyle = css(mix(k.fill, hex('#2a2030'), 0.8));
          g.fillRect(s.w / 2 - 0.42, 0.8, 0.84, 0.36);
        },
      },
    }),
  });
  // The pin through the staple, its brass ring hanging.
  parts.push({
    faces: lathe(0, hy1 + 0.25, [[H - 1.45, 0.34], [H - 1.25, 0.42], [H - 0.95, 0.42], [H - 0.75, 0.3]], 8, BRASS, 0.5, () => ({ crease: 0.25 })),
  });
  return { parts, shade: square(X + O, Y + O) };
}

/* ---- the craft material bin -------------------------------------------------------------- */

/** What is in each of its four parts, painted over the top of a fill. */
function nails(g: Ctx, k: PaintCtx, s: Side): void {
  const T = rand(5);
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = (T() - 0.5) * (s.w - 0.6), y = (T() - 0.5) * (s.h - 0.6), a = T() * TAU;
    const dx = Math.cos(a) * 0.55, dy = Math.sin(a) * 0.55;
    g.strokeStyle = css(mix(k.fill, hex('#3c3848'), 0.45), 0.85);
    g.lineWidth = 0.16;
    g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke();
    g.fillStyle = css(mix(k.fill, [255, 255, 255], 0.35));
    g.beginPath(); g.arc(x + dx, y + dy, 0.17, 0, TAU); g.fill();
  }
}
function planks(g: Ctx, k: PaintCtx, s: Side): void {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  boards(g, k.fill, s.w, s.h, 4, 71, 'x');
  // The planks' ends a step paler where they were sawn.
  g.fillStyle = css(mix(k.fill, [255, 246, 228], 0.35), 0.8);
  for (let i = 0; i < 4; i++) g.fillRect(s.w - 0.45, (i / 4) * s.h + 0.12, 0.35, s.h / 4 - 0.24);
  g.restore();
}
function lumps(g: Ctx, k: PaintCtx, s: Side): void {
  const metals = ['iron', 'copper', 'tin', 'iron', 'silver', 'copper'];
  metals.forEach((m, i) => {
    const t = metalTone(m), fill = faceColour(t, k.L);
    const x = -s.w / 2 + 0.35 + (i % 3) * (s.w - 0.7) / 3, y = -s.h / 2 + 0.35 + Math.floor(i / 3) * (s.h - 0.7) / 2;
    const w = (s.w - 0.7) / 3 - 0.3, h = (s.h - 0.7) / 2 - 0.35;
    g.fillStyle = css(mix(fill, hex('#3c3848'), 0.45));
    g.beginPath(); g.roundRect(x - 0.08, y - 0.12, w + 0.16, h + 0.2, 0.3); g.fill();
    g.fillStyle = css(fill);
    g.beginPath(); g.roundRect(x, y, w, h, 0.3); g.fill();
    g.fillStyle = css(mix(fill, [255, 255, 255], 0.45), 0.7);
    g.fillRect(x + 0.2, y + h - 0.32, w - 0.4, 0.16);
  });
}
function ribbons(g: Ctx, k: PaintCtx, s: Side): void {
  const metals = ['brass', 'steel', 'copper', 'zinc'];
  metals.forEach((m, i) => {
    const fill = faceColour(metalTone(m), k.L);
    const x = (i % 2 ? 0.25 : -0.25) * s.w, y = (i < 2 ? -0.25 : 0.25) * s.h;
    const r = Math.min(s.w, s.h) * 0.19;
    for (const [rr, c, w] of [[r, css(mix(fill, hex('#3c3848'), 0.5)), 0.5], [r, css(fill), 0.34], [r * 0.6, css(fill), 0.3], [r * 0.6 + 0.08, css(mix(fill, [255, 255, 255], 0.45), 0.7), 0.1]] as Array<[number, string, number]>) {
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.strokeStyle = c;
      g.lineWidth = w;
      g.stroke();
    }
  });
}

function craftBinOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const INNER = deeper(WOOD, 0.35);
  const X = hw - 1, Y = hd - 1, H = 8.6, T = 0.75, P = 0.32;
  const parts: KitPart[] = [];
  const top = grained(51, 'x', true);
  const out = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 6, seed, 'y');
    // Its rim: a rail round the top of the walls.
    seam(g, k.fill, -0.5, s.h - 0.9, s.w + 0.5, s.h - 0.9, 0.18);
  };
  // The walls: front and back across it, the ends between them; their insides a step deeper.
  const wall = (x0: number, x1: number, y0: number, y1: number, outer: 'front' | 'back' | 'left' | 'right', inner: 'front' | 'back' | 'left' | 'right', seed: number): void => {
    const paint: Record<string, (g: Ctx, k: PaintCtx, s: Side) => void> = { top, [outer]: out(seed), [inner]: (g, k, s) => inside(5, seed + 5)(g, { ...k, fill: faceColour(INNER, k.L) }, s) };
    parts.push({ faces: slab(x0, x1, y0, y1, 0, H, WOOD, { corner: outer === 'front' || outer === 'back' ? 0.2 : 0, paint }), edges: true });
  };
  wall(-X, X, -Y, -Y + T, 'back', 'front', 61);
  wall(-X, X, Y - T, Y, 'front', 'back', 62);
  wall(-X, -X + T, -Y + T, Y - T, 'left', 'right', 63);
  wall(X - T, X, -Y + T, Y - T, 'right', 'left', 64);
  // The partitions: one from back to front, and one across either side of it, a hand under the rim.
  const PH = H - 0.5;
  const part = (x0: number, x1: number, y0: number, y1: number, seed: number): void => {
    const face = (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'x', 0.6);
    parts.push({ faces: slab(x0, x1, y0, y1, 0, PH, INNER, { paint: { top, front: face, back: face, left: face, right: face } }), edges: true });
  };
  part(-P, P, -Y + T, Y - T, 71);
  part(-X + T, -P, -P, P, 72);
  part(P, X - T, -P, P, 73);

  // What has been sorted into them, each to its own height.
  const fill = (x0: number, x1: number, y0: number, y1: number, z: number, tone: Tone, paint: (g: Ctx, k: PaintCtx, s: Side) => void): void => {
    parts.push({ faces: slab(x0, x1, y0, y1, 0, z, tone, { paint: { top: paint } }), solid: false });
  };
  fill(-X + T, -P, -Y + T, -P, H - 1.3, deeper(metalTone('iron'), 0.3), nails);
  fill(P, X - T, -Y + T, -P, H - 1.0, woodTone('pine'), planks);
  fill(-X + T, -P, P, Y - T, H - 1.5, INNER, lumps);
  fill(P, X - T, P, Y - T, H - 1.4, INNER, ribbons);
  return { parts, shade: square(X, Y) };
}

/* ---- the seed bin and the sprout bin ------------------------------------------------------- */

/** The small box both stand on: boards laid along it, iron hinges at the back for the lid. */
function smallBox(WOOD: Tone, X: number, Y: number, H: number, hinged: boolean): Face[] {
  const side = (seed: number, hinges: boolean) => (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 3, seed, 'x');
    // Battens up its ends, where the boards are nailed.
    for (const x of [0.12, s.w - 0.62]) {
      g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.16), 0.9);
      g.fillRect(x, 0, 0.5, s.h);
      seam(g, k.fill, x, 0, x, s.h, 0.1);
      seam(g, k.fill, x + 0.5, 0, x + 0.5, s.h, 0.1);
      for (let i = 0; i < 3; i++) nail(g, k.fill, x + 0.25, ((i + 0.5) / 3) * s.h, 0.11);
    }
    if (hinges) for (const x of [s.w * 0.28, s.w * 0.72]) band(g, k, x - 0.5, x + 0.5, s.h - 1.5, s.h + 0.2, 2, true);
  };
  return slab(-X, X, -Y, Y, 0, H, WOOD, { corner: 0.14, paint: { front: side(81, false), back: side(82, hinged), left: side(83, false), right: side(84, false) } });
}

function seedBinOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const LID = paler(WOOD, 0.06);
  const SCOOP = woodTone('birch');
  const SEED = toneOf('#ead7a4', '#9a8270');
  const X = hw - 1.6, Y = hd - 1.6, H = 4.4, O = 0.3, LT = 0.6;
  const parts: KitPart[] = [{ faces: smallBox(WOOD, X, Y, H, true) }];
  const Z = H + LT;
  parts.push({
    faces: slab(-X - O, X + O, -Y - O, Y + O, H, Z, LID, {
      corner: 0.2, bevel: 0.2,
      paint: {
        top: (g, k, s) => {
          plankedTop(2, 91, 'x')(g, k, s);
          // A few seeds spilled where the scoop is dipped.
          const T = rand(9);
          g.fillStyle = css(faceColour(SEED, k.L));
          for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(-1.6 + T() * 2.6, -0.4 + T() * 2.2, 0.17, 0.11, T() * 3, 0, TAU); g.fill(); }
        },
        front: grained(92), back: grained(93), left: grained(94), right: grained(95),
      },
    }),
    edges: true,
  });
  // The scoop: a turned bowl with seed heaped in it, and its handle out to the right and front.
  const bx = -0.85, by = 0.25;
  const bowl = lathe(bx, by, [[Z, 0.85], [Z + 0.35, 1.2], [Z + 0.7, 1.3]], 10, SCOOP, 0.5, () => ({ crease: 0.22 }));
  const rim = bowl[bowl.length - 1];
  bowl[bowl.length - 1] = {
    ...rim,
    paint: (g, k) => {
      g.beginPath(); g.arc(0, 0, 1.0, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.35)); g.fill();
      const T = rand(3), sf = faceColour(SEED, k.L);
      g.beginPath(); g.arc(0.05, 0.05, 0.86, 0, TAU);
      g.fillStyle = css(mix(sf, hex('#6e5060'), 0.15)); g.fill();
      for (let i = 0; i < 14; i++) {
        const a = T() * TAU, r = Math.sqrt(T()) * 0.7;
        g.fillStyle = css(T() < 0.5 ? sf : mix(sf, [255, 252, 240], 0.45));
        g.beginPath(); g.ellipse(Math.cos(a) * r, Math.sin(a) * r, 0.18, 0.12, a, 0, TAU); g.fill();
      }
    },
  };
  parts.push({ faces: bowl, edges: true });
  const ang = Math.atan2(1.0, 2.5);
  const handle = slab(bx + 1.0, bx + 3.9, by - 0.24, by + 0.24, Z, Z + 0.42, SCOOP, { corner: 0.08, bevel: 0.1 });
  parts.push({ faces: turned(handle, [bx, by, Z], [0, 0, 1], ang), edges: true });
  return { parts, shade: square(X + O, Y + O) };
}

/** The damp cloth over a sprout bin: linen gone grey-green with the wet. */
const DAMP: Tone = toneOf('#bccfa8', '#6c7e74');

function sproutBinOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const X = hw - 1.6, Y = hd - 1.6, H = 4.4;
  const body: KitPart = { faces: smallBox(WOOD, X, Y, H, false) };
  const parts: KitPart[] = [body];
  // The cloth, seen end on: laid over the top, a little over the back and sides, and hanging down the front.
  const C = 0.38, D = 1.5, O = 0.22;
  const outline: Pt[] = [[-Y - O, H - 0.1], [Y, H - 0.1], [Y, H - D + 0.1], [Y + C, H - D], [Y + C, H + 0.1], [Y + 0.1, H + C], [-Y - O + 0.1, H + C], [-Y - O, H + C - 0.12]];
  const folds = (g: Ctx, k: PaintCtx, len: number, across: number, seed: number): void => {
    const T = rand(seed);
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.3 + T() * 0.4) / 5) * len;
      g.strokeStyle = css(mix(k.fill, hex('#5c6a62'), 0.3), 0.45);
      g.lineWidth = 0.14;
      g.beginPath(); g.moveTo(x, -across); g.quadraticCurveTo(x + (T() - 0.5) * 0.8, 0, x + (T() - 0.5) * 0.4, across); g.stroke();
      g.strokeStyle = css(mix(k.fill, [255, 255, 250], 0.4), 0.45);
      g.lineWidth = 0.1;
      g.beginPath(); g.moveTo(x + 0.18, -across); g.quadraticCurveTo(x + 0.18 + (T() - 0.5) * 0.8, 0, x + 0.18, across); g.stroke();
    }
    // Wet patches, darker.
    for (let i = 0; i < 3; i++) {
      g.fillStyle = css(mix(k.fill, hex('#6a786e'), 0.25), 0.35);
      g.beginPath(); g.ellipse(T() * len, (T() - 0.5) * across, 0.8 + T() * 0.6, 0.5 + T() * 0.4, 0, 0, TAU); g.fill();
    }
  };
  const cloth: KitPart = {
    faces: extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, -X - O, X + O, DAMP, 0.12, {
      edge: (i) => {
        // The edges as the outline is wound in the end (`extrude` winds it anticlockwise): its top and the fall down the front take the folds.
        const ol = area2(outline) < 0 ? outline.slice().reverse() : outline;
        const p = ol[i], q = ol[(i + 1) % ol.length];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        return len > 1.2 ? { crease: 0.28, paint: (g: Ctx, k: PaintCtx) => folds(g, k, len, X + O, 7 + i) } : { crease: 0.28 };
      },
    }),
    after: [body],
    edges: true,
  };
  parts.push(cloth);
  // The sprouts come up through it: a pale stem, two seed leaves open on it.
  const at: Array<[number, number, number]> = [[-1.6, -1.2, 1.15], [0.6, -1.7, 1], [1.8, 0.4, 1.25], [-0.8, 0.9, 1.05], [0.4, 1.9, 0.95]];
  const foot = H + C;
  parts.push({
    after: [cloth],
    reach: at.flatMap(([x, y, s]) => [[x - 1, y - 1, foot], [x + 1, y + 1, foot + 1.6 * s]] as V3[]),
    draw: (g, e) => {
      const order = at.map((p) => ({ p, d: p[0] * e.toward[0] + p[1] * e.toward[1] })).sort((a, b) => a.d - b.d);
      g.lineCap = 'round';
      for (const { p: [x, y, s] } of order) {
        const [px, py] = proj(e, [x, y, foot]);
        const h = 2.6 * s;
        g.strokeStyle = MOSS.under;
        g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px - 0.5, py - h * 0.5, px, py - h); g.stroke();
        for (const d of [-1, 1]) {
          g.fillStyle = MOSS.line;
          g.beginPath(); g.ellipse(px + d * 1.15 * s, py - h - 0.2 * s + 0.1, 1.15 * s, 0.6 * s, d * 0.45, 0, TAU); g.fill();
          g.fillStyle = d < 0 ? MOSS.lit : MOSS.fill;
          g.beginPath(); g.ellipse(px + d * 1.1 * s, py - h - 0.25 * s, 1.0 * s, 0.48 * s, d * 0.45, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255, 255, 240, 0.55)';
        g.beginPath(); g.ellipse(px - 1.25 * s, py - h - 0.4 * s, 0.4 * s, 0.16 * s, -0.45, 0, TAU); g.fill();
      }
    },
  });
  return { parts, shade: square(X + O, Y + C) };
}

/* ---- the pieces -------------------------------------------------------------------------- */

export const BULK_BIN: KitPiece = { model: (look, { hw, hd }) => bulkBinOf(look, hw, hd), uses: { tint: true, material: true } };
export const CRAFT_BIN: KitPiece = { model: (look, { hw, hd }) => craftBinOf(look, hw, hd), uses: { tint: true, material: true } };
export const SEED_BIN: KitPiece = { model: (look, { hw, hd }) => seedBinOf(look, hw, hd), uses: { tint: true, material: true } };
export const SPROUT_BIN: KitPiece = { model: (look, { hw, hd }) => sproutBinOf(look, hw, hd), uses: { tint: true, material: true } };

