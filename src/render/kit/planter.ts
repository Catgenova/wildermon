import { CROP_LIST, CROP_STAGES, type CropDef } from '../../game/farming';
import { cropPlant } from '../crops';
import { rand } from '../ivy';
import {
  boards, css, deeper, grain, hex, mix, nail, paler, proj, slab, TAU, toneOf, woodTone,
  type Ctx, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type V3,
} from './core';

/**
 * The planter (`planter`, two subtiles by one), in the kit: a box of boards
 * of the wood it was built of on four short feet, a capping rail round its
 * top, full of earth. Empty, the earth is bare and raked; sown, a drill runs
 * down its middle with the seed in it; after that a row of the crop grows
 * along it at its stage, the field's own plants at the box's size
 * (`cropPlant`), as the old model drew them. Dyed, its boards are painted.
 *
 * Its `trim` is what it holds (`planterTrim` in furniture.ts): nought for
 * bare earth, otherwise one more than the crop's place in `CROP_LIST` times
 * `CROP_STAGES`, plus the stage. Read back here exactly as `planterHolds`
 * reads it there.
 */

/** How big a crop's plant is drawn in a planter, against one in a field (`PLANTER_PLANT`). */
const PLANT = 0.85;
/** How many plants along the row. */
const ROW = 5;

/** What a planter holds, from its trim: as `planterHolds` (furniture.ts). */
const holds = (trim: number | undefined): { crop: CropDef; stage: number } | null => {
  if (!trim || trim < 1 || !Number.isInteger(trim)) return null;
  const crop = CROP_LIST[Math.floor((trim - 1) / CROP_STAGES)];
  return crop ? { crop, stage: (trim - 1) % CROP_STAGES } : null;
};
/** And the trim of a crop at a stage, for the sheet: as `planterTrim` (furniture.ts). */
const trimOf = (id: string, stage: number): number => 1 + CROP_LIST.findIndex((c) => c.id === id) * CROP_STAGES + stage;

/** The earth: a warm brown, its shade toward the kit's mauve. */
const EARTH = toneOf('#866650', '#4a3844');

/** Half its length and depth, the top of its feet and of its walls, how thick they are, and the earth's top. */
const X = 9.2, Y = 4, FEET = 0.6, H = 4.4, T = 0.6, SOIL = H - 0.25;

/** The earth's top: crumbs darker and paler, the marks of a rake along it; sown, the drill down its middle and the seed in it. */
function earth(sown: boolean) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const R = rand(41);
    for (let i = 0; i < 34; i++) {
      g.fillStyle = i % 2 ? css(mix(k.fill, hex('#3e3040'), 0.35), 0.6) : css(mix(k.fill, [255, 236, 210], 0.25), 0.6);
      g.beginPath();
      g.arc((R() - 0.5) * s.w, (R() - 0.5) * s.h, 0.16 + R() * 0.14, 0, TAU);
      g.fill();
    }
    g.lineCap = 'round';
    for (const y of [-0.3, 0.3]) {
      g.strokeStyle = css(mix(k.fill, hex('#3e3040'), 0.3), 0.5);
      g.lineWidth = 0.14;
      g.beginPath(); g.moveTo(-s.w / 2 + 0.4, y * s.h); g.lineTo(s.w / 2 - 0.4, y * s.h); g.stroke();
      g.strokeStyle = css(mix(k.fill, [255, 236, 210], 0.3), 0.45);
      g.lineWidth = 0.08;
      g.beginPath(); g.moveTo(-s.w / 2 + 0.4, y * s.h - 0.14); g.lineTo(s.w / 2 - 0.4, y * s.h - 0.14); g.stroke();
    }
    if (!sown) return;
    g.strokeStyle = css(mix(k.fill, hex('#2e2430'), 0.55), 0.8);
    g.lineWidth = 0.3;
    g.beginPath(); g.moveTo(-s.w / 2 + 0.6, 0); g.lineTo(s.w / 2 - 0.6, 0); g.stroke();
    g.fillStyle = css(mix(k.fill, [250, 232, 190], 0.65));
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(-s.w / 2 + 1 + ((s.w - 2) * i) / 8, (((i * 37) % 3) - 1) * 0.08, 0.15, 0, TAU);
      g.fill();
    }
  };
}

function planterOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const CAP = paler(WOOD, 0.08);
  const FOOT = deeper(woodTone(look.material), 0.2);
  const has = holds(look.trim);
  const parts: KitPart[] = [];

  // The feet, one under each corner.
  for (const px of [-X + 0.65, X - 0.65]) for (const py of [-Y + 0.65, Y - 0.65]) {
    parts.push({ faces: slab(px - 0.55, px + 0.55, py - 0.55, py + 0.55, 0, FEET, FOOT, { corner: 0.12 }) });
  }
  // The walls: boards laid along them outside, a step deeper inside over the earth, the capping rail's lip at their head.
  const outside = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 3, seed, 'x');
    for (const x of [0.4, s.w - 0.4]) for (const y of [s.h * 0.2, s.h * 0.55]) nail(g, k.fill, x, y, 0.12);
  };
  const inside = (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.3));
    g.fillRect(-0.5, -0.5, s.w + 1, s.h + 1);
    grain(g, k.fill, s.w, s.h, 9, 'x', 0.5);
  };
  const cap = (g: Ctx, k: PaintCtx, s: Side): void => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 13, 'x', 0.5); g.restore(); };
  const wall = (x0: number, x1: number, y0: number, y1: number, outer: 'front' | 'back' | 'left' | 'right', inner: 'front' | 'back' | 'left' | 'right', seed: number): void => {
    parts.push({ faces: slab(x0, x1, y0, y1, FEET, H, WOOD, { corner: outer === 'front' || outer === 'back' ? 0.16 : 0, paint: { [outer]: outside(seed), [inner]: inside } }) });
    // Its capping, a hair proud of the wall, a step paler.
    const o = 0.12;
    parts.push({
      faces: slab(x0 - (outer === 'left' ? o : 0), x1 + (outer === 'right' ? o : 0), y0 - (outer === 'back' ? o : 0), y1 + (outer === 'front' ? o : 0), H, H + 0.4, CAP, { bevel: 0.12, paint: { top: cap } }),
      edges: true,
    });
  };
  wall(-X, X, -Y, -Y + T, 'back', 'front', 21);
  wall(-X, X, Y - T, Y, 'front', 'back', 22);
  wall(-X, -X + T, -Y + T, Y - T, 'left', 'right', 23);
  wall(X - T, X, -Y + T, Y - T, 'right', 'left', 24);

  // The earth.
  parts.push({ faces: slab(-X + T, X - T, -Y + T, Y - T, FEET, SOIL, EARTH, { paint: { top: earth(has?.stage === 0) } }), solid: false });

  // What grows in it: a row along its middle, at its stage, nearest last.
  if (has && has.stage > 0) {
    const [leaf, fruit] = has.crop.colors;
    const at: V3[] = Array.from({ length: ROW }, (_, i) => [-X + T + 1.5 + (i * (2 * (X - T) - 3)) / (ROW - 1), ((((i * 37) % 5) - 2) * 0.16), SOIL]);
    const tall = 3 + has.stage * 2.2;
    parts.push({
      reach: at.flatMap(([x, y, z]) => [[x - 1.4, y - 1.4, z], [x + 1.4, y + 1.4, z + tall]] as V3[]),
      draw: (g, e) => {
        const order = at.map((p, i) => ({ p, i, d: p[0] * e.toward[0] + p[1] * e.toward[1] })).sort((a, b) => a.d - b.d);
        for (const { p, i } of order) {
          const [px, py] = proj(e, p);
          cropPlant(g, px, py, has.crop.look, has.stage, leaf, fruit, i * 0.9, PLANT);
        }
      },
    });
  }
  return { parts, shade: [[-X, -Y, 0], [X, -Y, 0], [X, Y, 0], [-X, Y, 0]] };
}

export const PLANTER: KitPiece = {
  model: (look) => planterOf(look),
  uses: { tint: true, material: true, trim: true },
  states: [
    { trim: 0, label: 'bare' },
    { trim: trimOf('wheat', 0), label: 'wheat sown' },
    { trim: trimOf('carrot', 1), label: 'carrot sprouting' },
    { trim: trimOf('cabbage', 2), label: 'cabbage growing' },
    { trim: trimOf('wheat', 3), label: 'wheat ripe' },
    { trim: trimOf('cotton', 3), label: 'cotton ripe' },
    { trim: trimOf('basil', 3), label: 'basil ripe' },
  ],
};
