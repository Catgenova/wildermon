/**
 * How an obsidian piece (`obsidian.ts`) is drawn: the one number its bake is
 * kept under (`obsidianTrim`), off what the island keeps of it and the island
 * clock. An obsidian bust's citizen is a stone bust's (`fittingTrim`); an
 * obsidian chime is a wind chime's (`gardenTrim`); a dragon-glass fountain is
 * drawn in its layers round its water as a tiered fountain is (`Renderer`).
 */
import type { PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import { posyFresh } from '../game/furnish';
import { blackLanternBurning, obeliskGlint } from '../game/obsidian';
import { BLACK_LANTERN, EMBER_ORB, LAVA_LAMP, OBSIDIAN_OBELISK, OBSIDIAN_THRONE, OBSIDIAN_VASE, SHARD_GARDEN, SHARD_PATH } from '../game/obsidiandefs';
import { blackLanternTrim, LANTERNS_LIT, OBSIDIAN_FX } from './kit/obsidian';
import { vaseTrim } from './kit/furnish';

/** The obsidian pieces drawn with something over their bake each frame: what the renderer hands the piece's id to (`airOf`). */
export const OBSIDIAN_LIVE: readonly string[] = [BLACK_LANTERN, OBSIDIAN_OBELISK, LAVA_LAMP, SHARD_PATH, EMBER_ORB];

/** An obsidian piece's trim, or undefined for a piece that is none of them. */
export function obsidianTrim(f: PlacedFurniture, game: Game): number | undefined {
  switch (f.kind) {
    case BLACK_LANTERN: {
      const lit = blackLanternBurning(f);
      if (lit) LANTERNS_LIT.add(f.id); else LANTERNS_LIT.delete(f.id);
      return blackLanternTrim(lit);
    }
    case OBSIDIAN_OBELISK:
      // Its glint by the island clock, the same for every obelisk this frame.
      OBSIDIAN_FX.glint = obeliskGlint(game.hourOfDay());
      return 0;
    case OBSIDIAN_VASE: {
      const p = f.furnish?.vase;
      return vaseTrim(p?.n ?? 0, !!p && !posyFresh(p, game.wallNow()));
    }
    case OBSIDIAN_THRONE: case SHARD_GARDEN: case LAVA_LAMP: case SHARD_PATH: case EMBER_ORB: return 0;
    default: return undefined;
  }
}
