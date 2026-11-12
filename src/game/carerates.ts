/**
 * What a brushing and a dressing put back, by the hand and the tool: the
 * player's (`husbandry.ts`, `firstaid.ts`) and a worker's at the same trade
 * (`creatures.ts`).
 *
 * A leaf, so the worker can ask without loading the actions, which say them on.
 */

/**
 * What one brushing is worth. A poor brush in an unpractised hand puts a
 * little in; a good brush and a hundred in the skill puts most of a full
 * grooming in at once.
 */
export const groomGain = (skill: number, ql: number): number => 0.18 + (skill / 100) * 0.34 + (Math.min(100, ql) / 100) * 0.22;

/** How much of its health a brushing sees to. */
export const GROOM_HEAL = 0.06;

/** Fraction of a life a single dressing puts back, by the hand and the cloth. */
export const healAmount = (skill: number, ql: number): number => 0.06 + (skill / 100) * 0.24 + (ql / 100) * 0.1;
