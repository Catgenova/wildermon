/**
 * How a home piece (`decor.ts`) is drawn: the one number its bake is kept
 * under (`decorTrim`), off what the island keeps of it and the wall clock;
 * and an armour stand's mannequin, which is the player's own body and gear
 * (`drawFigure`) in the stand's wood, wearing what the stand holds.
 */
import type { PlacedFurniture } from '../game/furniture';
import { COMPOST_BIN, COMPOST_HOLDS, CURTAINS, RUG_PATTERNS, WOVEN_RUG, ARMOUR_STAND } from '../game/decordefs';
import { heapReady, rugColours } from '../game/decor';
import { gearFrom } from '../game/worn';
import { DEFAULT_LOOK, type Look } from '../game/look';
import type { GearLook } from '../contract/gear';
import { drawFigure } from './figure';
import { binTrim, curtainTrim, mannequin, rugTrim } from './kit/decor';

/** What each stand wears, by the piece's id, as the renderer last worked it out (`decorTrim`); the studio's under its own. */
export const STAND_GEAR = new Map<number, GearLook>();

/** A home piece's trim, or undefined for a piece that is none of them (a stone lantern's is its moss, `mossTrim`). */
export function decorTrim(f: PlacedFurniture, now: number): number | undefined {
  const d = f.decor;
  switch (f.kind) {
    case COMPOST_BIN: return d?.heap ? binTrim(d.heap.n, COMPOST_HOLDS, heapReady(d.heap, now)) : binTrim(0, COMPOST_HOLDS, false);
    case WOVEN_RUG: return rugTrim(Math.max(0, RUG_PATTERNS.indexOf(d?.pattern ?? RUG_PATTERNS[0])), rugColours({ dye: f.dye, decor: d }));
    case CURTAINS: return curtainTrim(!!d?.shut);
    case ARMOUR_STAND:
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

/** A mannequin's body: no hair, the island's default proportions; its wood is the figure's (`FigurePose.mannequin`). */
const MANNEQUIN_LOOK: Look = { ...DEFAULT_LOOK, hair: 'bald' };

mannequin.draw = (ctx, sx, sy, zoom, view, seed) => {
  // Faced the way the stand's front looks on the screen, in eighths: nought toward the viewer, two to the right.
  const facing = ((Math.round(Math.atan2(view.vx, view.vy) / (Math.PI / 4)) % 8) + 8) % 8;
  drawFigure(ctx, sx, sy, zoom, {
    phase: 0, moving: false, facing, swimming: false, working: false, look: MANNEQUIN_LOOK, gear: STAND_GEAR.get(seed) ?? {}, mannequin: true,
    ...(MANNEQUIN_KEPT.on ? { id: `stand:${seed}` } : {}),
  });
};
