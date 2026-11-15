/**
 * How a fitting (`fitting.ts`) is drawn: the one number its bake is kept
 * under (`fittingTrim`), off what the island keeps of it; and a stone bust's
 * citizen, who is their own figure (`drawFigure`) in the stone, head, hair
 * and the top of the shoulders.
 */
import type { PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import { ARCHERY_TARGET, LANTERN_POLE, MOORING_POST, SPICE_SHELF, STONE_BUST, TRAINING_DUMMY, TREE_BENCH, WINDOW_SEAT } from '../game/fittingdefs';
import { poleBurning, poleColours, SHELF_HERBS } from '../game/fitting';
import { OBSIDIAN_BUST } from '../game/obsidiandefs';
import type { Look } from '../game/look';
import { HEIGHT_SCALE } from './iso';
import { drawFigure } from './figure';
import { bust, POLES_LIT, poleTrim, shelfTrim, targetTrim } from './kit/fittings';

/** Who each bust is carved as, by the piece's id, as the renderer last worked it out (`fittingTrim`). */
export const BUST_LOOK = new Map<number, Look>();

/** A fitting's trim, or undefined for a piece that is none of them (a moss boulder's is its moss, `mossTrim`). */
export function fittingTrim(f: PlacedFurniture, game: Game): number | undefined {
  const d = f.fitting;
  switch (f.kind) {
    case LANTERN_POLE: {
      const lit = poleBurning(f);
      if (lit) POLES_LIT.add(f.id); else POLES_LIT.delete(f.id);
      return poleTrim(lit, poleColours({ dye: f.dye, fitting: d }));
    }
    case SPICE_SHELF: {
      const jars: number[] = [];
      for (const [id, n] of d?.jars ?? []) for (let i = 0; i < n; i++) jars.push(SHELF_HERBS.indexOf(id));
      return shelfTrim(jars);
    }
    case ARCHERY_TARGET: return targetTrim(d?.stuck ?? 0);
    case STONE_BUST: case OBSIDIAN_BUST:
      if (d?.bust) BUST_LOOK.set(f.id, d.bust.look); else BUST_LOOK.delete(f.id);
      return d?.bust ? 1 : 0;
    // A post's rope to the boat tied to it is the renderer's (`Renderer.drawMooring`), not its bake's.
    case TREE_BENCH: case WINDOW_SEAT: case TRAINING_DUMMY: case MOORING_POST: return 0;
    default: return undefined;
  }
}

/**
 * Whether a bust is drawn from the pictures kept of bodies (`drawStill`, by the bust's id). Off: a kept picture is
 * a whole body in its own colours, drawn a frame or more late, and a bust is a few heads in stone, cheap drawn afresh.
 */
export const BUST_KEPT = { on: false };
/** How far up a body the bust is cut, in tenths of a metre from the feet: under the collarbones. */
const BUST_CUT = 10.2;

/** The ember along an obsidian bust's edge: a glow round its outline, in pixels at zoom one. */
const GLASS_EDGE = 1.1;

bust.draw = (ctx, sx, sy, zoom, view, seed, glass = false) => {
  const look = BUST_LOOK.get(seed);
  if (!look) return;
  // Faced the way the bust's front looks on the screen, in eighths: nought toward the viewer (the mannequin's).
  const facing = ((Math.round(Math.atan2(view.vx, view.vy) / (Math.PI / 4)) % 8) + 8) % 8;
  ctx.save();
  // Cut off level with the plinth's top: what is under it is still in the stone.
  ctx.beginPath();
  ctx.rect(sx - 40 * zoom, sy - 60 * zoom, 80 * zoom, 60 * zoom);
  ctx.clip();
  // An obsidian bust's glass with an ember edge round it (`obsidian.ts`).
  if (glass) { ctx.shadowColor = 'rgba(255, 112, 70, 0.85)'; ctx.shadowBlur = GLASS_EDGE * zoom; }
  drawFigure(ctx, sx, sy + BUST_CUT * HEIGHT_SCALE * zoom, zoom, {
    phase: 0, moving: false, facing, swimming: false, working: false, look, gear: {}, stone: glass ? 'glass' : true,
    ...(BUST_KEPT.on ? { id: `bust:${glass ? 'glass:' : ''}${seed}:${look.gender}:${look.hair}:${look.skin}:${look.hairColour}:${look.hairBright}` } : {}),
  });
  ctx.restore();
};
