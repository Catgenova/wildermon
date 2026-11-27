/**
 * The night's cold wash: the colour laid over the whole island after dark,
 * and how strong it is at the dead of night (`skyWash` in renderer.ts lays it
 * at the darkness's share of that). On its own so that what is not the
 * renderer -- Runecut's stone after dark (`src/ui/runecut-art.ts`) -- can be
 * put under the same night without taking the renderer with it.
 */
export const NIGHT_WASH = { colour: '12, 20, 44', alpha: 0.68 } as const;
