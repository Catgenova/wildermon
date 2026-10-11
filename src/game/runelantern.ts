import { furnitureCentre, furnitureDef, type PlacedFurniture } from './furniture';
import { LAMP_CAST_ALPHA, LAMP_STRENGTH } from './lamps';
import { lanternReach, RUNESTONE_CAST, type LightSource } from './light';

/**
 * A rune lantern post: a light that needs nothing.
 *
 * A squat stone pillar, laid by a mason from stone bricks, with a band of
 * runes cut round its head and light motes set into them. It is furniture to
 * every rule there is -- built, set down, turned, lifted, named and
 * padlocked as any piece is -- and it is a lantern to one: at night it
 * lights the ground round it, for everybody, as far as a lantern of the
 * piece's own quality throws (`lanternReach`), five tiles at the roughest
 * and nine at the best, and that ground is in sight from as far off as you
 * can see. It takes no lantern and no candle, burns nothing and never goes
 * out, so there is nothing to fit, light, put out or take down: the five
 * jobs of a lantern post (`lamps.ts`) never apply to it.
 *
 * Nothing about it is the island's to work out: what it throws is drawn and
 * seen by in the browser, off its quality, which a ground read sends with
 * every piece. The island holds the piece, its recipe and where it may go,
 * all off the same definitions (`npm run defs`); `supabase/test/runelantern.ts`
 * holds the two sides together.
 */

/** Whether a piece is one. */
export const isRuneLantern = (f: { kind: string }): boolean => !!furnitureDef(f.kind).runes;

/** How far it throws, in tiles: what a lantern of its quality throws. */
export const runeLanternReach = (f: { ql: number }): number => lanternReach(f.ql);

/**
 * Its light, from the middle of its pillar: a lantern's reach and strength,
 * steady, in the pale gold of the runestones' runes rather than a candle's,
 * at a lantern's warmth (`LAMP_CAST_ALPHA`).
 */
export function runeLanternLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: runeLanternReach(f), strength: LAMP_STRENGTH, steady: true, cast: RUNESTONE_CAST, castAlpha: LAMP_CAST_ALPHA };
}
