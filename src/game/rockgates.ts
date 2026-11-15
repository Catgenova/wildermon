/**
 * The gates on rock, by what it yields: seams and plain faces by mining, veins by prospecting. Here rather than in
 * `skillgates.ts` so that the world's rock (`ore.ts`) reads them without loading the item rules; `skillgates.ts` makes
 * them rows of `SKILL_GATES` and says them.
 *
 * A leaf: imports only the rock list.
 */
import { isSeam } from '../world/tiles';
import type { GateLevel } from './skillgates';

/**
 * Seams by mining, by what the seam yields: the levels the rock list held (`ROCK_VARIANTS`), kept. Ore Sense lowers each
 * by its rank (`ore:below`); the Ironemole line mines any (`SpeciesDef.anySeam`).
 */
export const SEAM_GATE: Readonly<Record<string, GateLevel>> = {
  copper_ore: 1,
  coal: 1,
  iron_ore: 5,
  tin_ore: 10,
  zinc_ore: 20,
  lead_ore: 30,
  silver_ore: 40,
  gold_ore: 50,
  adamantine_ore: 60,
  glimmersteel_ore: 70,
  mithril_ore: 80,
  seryll_ore: 90,
};

/**
 * Naming a vein by prospecting: each seam's mining level. Under it the vein is marked and glows as any other, and is
 * "Unidentified metal" (`seenVein`).
 */
export const VEIN_GATE: Readonly<Record<string, GateLevel>> = SEAM_GATE;

/** Quarrying a plain stone face by mining, by what it yields: rock 1, sandstone 10, slate 20, marble 30. */
export const STONE_GATE: Readonly<Record<string, GateLevel>> = {
  rock_shards: 1,
  sandstone_shards: 10,
  slate_shards: 20,
  marble_shards: 30,
};

/** What mining a rock takes, by what it yields: its seam's gate or its plain face's (`rockGate`), 1 for one with none. */
export const rockLevel = (rock: { yields: string }): number =>
  (isSeam(rock) ? SEAM_GATE : STONE_GATE)[rock.yields] ?? 1;
