/**
 * How a home piece (`decor.ts`) is drawn: the one number its bake is kept
 * under (`decorTrim`), off what the island keeps of it and the wall clock;
 * and an armour stand's mannequin, which is one of the two bodies (Body A or
 * Body B, by the stand) and the player's gear (`drawFigure`) in the stand's
 * wood, wearing what the stand holds.
 */
import type { PlacedFurniture } from '../game/furniture';
import { COMPOST_BIN, COMPOST_HOLDS, CURTAINS, RUG_PATTERNS, WOVEN_RUG, MANNEQUIN_A, MANNEQUIN_B, STAND_BODY } from '../game/decordefs';
import { heapReady, rugColours } from '../game/decor';
import { gearFrom } from '../game/worn';
import { DEFAULT_LOOK, type Look } from '../game/look';
import type { GearLook } from '../contract/gear';
import { drawFigure } from './figure';
import { binTrim, curtainTrim, mannequin, rugTrim } from './kit/decor';

/** What each stand wears, by the piece's id, as the renderer last worked it out (`decorTrim`); the studio's under its own. */
export const STAND_GEAR = new Map<number, GearLook>();
/** Which stand each is (`MANNEQUIN_A`, `MANNEQUIN_B`), by the piece's id: the body its mannequin is drawn in. */
export const STAND_LOOK = new Map<number, string>();

/** A home piece's trim, or undefined for a piece that is none of them (a stone lantern's is its moss, `mossTrim`). */
export function decorTrim(f: PlacedFurniture, now: number): number | undefined {
  const d = f.decor;
  switch (f.kind) {
    case COMPOST_BIN: return d?.heap ? binTrim(d.heap.n, COMPOST_HOLDS, heapReady(d.heap, now)) : binTrim(0, COMPOST_HOLDS, false);
    case WOVEN_RUG: return rugTrim(Math.max(0, RUG_PATTERNS.indexOf(d?.pattern ?? RUG_PATTERNS[0])), rugColours({ dye: f.dye, decor: d }));
    case CURTAINS: return curtainTrim(!!d?.shut);
    case MANNEQUIN_A: case MANNEQUIN_B:
      STAND_LOOK.set(f.id, f.kind);
      STAND_GEAR.set(f.id, gearFrom(d?.worn ?? {}) ?? {});
      return 0;
    default: return undefined;
  }
}

/**
 * Whether a mannequin is drawn from the pictures the island keeps of bodies (`drawStill`, by the stand's id), as
 * it is in play; a harness drawing one frame draws it afresh.
 */
export const MANNEQUIN_KEPT = { on: true };

/** A mannequin's body, by the stand's kind: Body A or Body B (`STAND_BODY`), no hair; its wood is the figure's (`FigurePose.mannequin`). */
const MANNEQUIN_LOOK: Record<string, Look> = {
  [MANNEQUIN_A]: { ...DEFAULT_LOOK, gender: STAND_BODY[MANNEQUIN_A], hair: 'bald' },
  [MANNEQUIN_B]: { ...DEFAULT_LOOK, gender: STAND_BODY[MANNEQUIN_B], hair: 'bald' },
};

mannequin.draw = (ctx, sx, sy, zoom, view, seed) => {
  // Faced the way the stand's front looks on the screen, in eighths: nought toward the viewer, two to the right.
  const facing = ((Math.round(Math.atan2(view.vx, view.vy) / (Math.PI / 4)) % 8) + 8) % 8;
  const look = MANNEQUIN_LOOK[STAND_LOOK.get(seed) ?? MANNEQUIN_A] ?? MANNEQUIN_LOOK[MANNEQUIN_A];
  drawFigure(ctx, sx, sy, zoom, {
    phase: 0, moving: false, facing, swimming: false, working: false, look, gear: STAND_GEAR.get(seed) ?? {}, mannequin: true,
    ...(MANNEQUIN_KEPT.on ? { id: `stand:${seed}` } : {}),
  });
};
