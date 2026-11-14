/**
 * How a furnishing (`furnish.ts`) is drawn: the one number its bake is kept
 * under (`furnishTrim`), off what the island keeps of it, who sits in it and
 * the wall clock.
 */
import { ACROSS_OF, facingOf, liquidCapacity, type PlacedFurniture } from '../game/furniture';
import type { Side } from '../game/building';
import type { Game } from '../game/game';
import { itemDef, ITEM_DEFS } from '../game/items';
import { GARDEN_SWING, FISH_MOUNT, HAY_BALE, HAY_HOLDS, SIDE_TABLE, SIGNPOST, VASE, WATER_TROUGH } from '../game/furnishdefs';
import { hayLeft, posyFresh, postAt, SIT_SEAT, sittersBeside } from '../game/furnish';
import { bearingTo } from '../game/tracking';
import { hayTrim, mountTrim, signTrim, swingTrim, SWING_FRAMES, tableTrim, troughTrim, vaseTrim, type TableShape } from './kit/furnish';

/** Which way a piece's front points in the world, as `ACROSS_OF` its width. */
const FRONT_OF: Record<Side, readonly [number, number]> = { s: [0, 1], e: [1, 0], n: [0, -1], w: [-1, 0] };
/** Seconds a swing takes forward and back. */
const SWING_PERIOD = 2.6;

/** What a thing on a side table is drawn as, by what it is: a loaf, a pot, a blade, a book, a stack or a box. */
export function tableShape(def: string): TableShape {
  const d = ITEM_DEFS[def];
  if (!d) return 'box';
  if (/pot|jar|bowl|cup|bucket|vase|skin|flask|bottle/.test(def)) return 'pot';
  if (d.category === 'food') return 'loaf';
  if (/book|paper|papyrus|map|letter|scroll|journal/.test(def)) return 'book';
  if (d.category === 'tool') return 'blade';
  if (d.stackable && d.category === 'material') return 'stack';
  return 'box';
}
/** Its colour on the table: its dye, or its kind's own. */
const CATEGORY_COLOUR: Record<string, string> = { food: '#d8a868', material: '#b8a088', tool: '#9aa4b8', plant: '#8ab878', misc: '#c8b0a0' };
const thingColour = (def: string, dye: string | null): string => dye ?? CATEGORY_COLOUR[itemDef(def)?.category ?? 'misc'] ?? '#c8b0a0';

/** Whether anybody sits in a seat now: you at it, or somebody sitting beside it. */
function sat(game: Game, f: PlacedFurniture): boolean {
  const a = game.action;
  if (a && a.def.id === SIT_SEAT && a.target.kind === 'furniture' && a.target.id === f.id) return true;
  return sittersBeside(game, f) > 0;
}

/** A furnishing's trim, or undefined for a piece that is none of them. */
export function furnishTrim(f: PlacedFurniture, game: Game): number | undefined {
  const d = f.furnish;
  switch (f.kind) {
    case GARDEN_SWING: return sat(game, f) ? swingTrim((Date.now() / 1000 / SWING_PERIOD) * SWING_FRAMES) : swingTrim(null);
    case HAY_BALE: return hayTrim(hayLeft(f), HAY_HOLDS);
    case WATER_TROUGH: return troughTrim(f.litres ?? 0, liquidCapacity(f) || 1);
    case VASE: return vaseTrim(d?.vase?.n ?? 0, !!d?.vase && !posyFresh(d.vase, game.wallNow()));
    case FISH_MOUNT: return mountTrim(d?.fish?.def ?? null);
    case SIDE_TABLE: return tableTrim((d?.on ?? []).map(([def, , dye]) => ({ shape: tableShape(def), colour: thingColour(def, dye) })));
    case SIGNPOST: {
      // Each arm turned into the post's own frame: across its width and toward its front.
      const [px, py] = postAt(f);
      const facing = facingOf(f);
      const [ax, ay] = ACROSS_OF[facing], [fx, fy] = FRONT_OF[facing];
      return signTrim((d?.arms ?? []).map((a) => {
        const b = (bearingTo(px, py, a.x, a.y) * Math.PI) / 180;
        const wx = Math.sin(b), wy = -Math.cos(b);
        return Math.atan2(wx * fx + wy * fy, wx * ax + wy * ay);
      }));
    }
    default: return undefined;
  }
}
