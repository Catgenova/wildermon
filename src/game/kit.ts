/**
 * The starting kit's quality and the food given with it: read by the Game (`game.ts`, which re-exports them) and by the
 * Guiding Light (`path.ts`), which the Game reads in turn, so they live here and import neither.
 */
import { foodFill } from './items';

/** The quality every tool of the starting kit comes ashore at (`STARTER_KIT`, `game.ts`). */
export const KIT_QL = 20;
/**
 * Food given with the kit on a first coming ashore, beside the stake (`starter_kit`): one full food bar's worth at
 * `KIT_QL`, as many as Eat takes to fill it from empty (`foodFill`). Not issued: eaten, traded, buried like any food,
 * and not given again on coming ashore or waking (the kit's tools are). Cheese: nothing rots in a pack, and on the
 * ground it lasts a day.
 */
export const STARTER_FOOD = 'cheese';
export const STARTER_FOOD_COUNT = Math.ceil(1 / foodFill(STARTER_FOOD, KIT_QL));
