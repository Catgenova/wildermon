/**
 * Volcano Isle as a place to fight (part one): its monsters, what they leave, what the seryll under it stirs up, and
 * the steel only its smelters temper.
 *
 *   * Three kinds that live nowhere else (`creatures.ts`: the ash wraith, the magma golem and the cinder hound), each
 *     at a vent of its own (`lairs.ts`, site `vent`), kept to the island by `Region.lair`.
 *   * Obsidian off any monster killed on a tile of Volcano Isle, the dragon and the vents' kinds among them: a carcass
 *     killed there carries where it died in its `mark` (`DIED_ON`), and butchering it gives its kind's (`OBSIDIAN_BY_KIND`).
 *   * A go at a seryll vein: `SERYLL_SUMMON` to summon `SUMMON_LEAST`–`SUMMON_MOST` of one of the vents' kinds round
 *     the miner, leashed to the spot and gone after `SUMMON_SECS`; never in the safe ring, a Sanctuary or a
 *     settlement.
 *   * Sulfur: a second part off the vents' kinds, and `SULFUR_SLATE` a go at slate on the island.
 *   * Fire-tempered steel: steel and sulfur at a smelter on the island (`make_fire_steel`), whose weapons and tools
 *     are bettered `FIRE_STEEL_CAP` QL past the skill.
 *
 * A leaf on purpose: no value imports but the regions and the words, so the items, the creatures, the help, the defs
 * dump and the suite can all read it. The island has the rules off these numbers (`volcano_*` in the defs and the
 * migration); `supabase/test/volcano.ts` holds them.
 */
import { REGIONS } from '../world/regions';
import { percent } from './words';

/** The island, by its key in `REGIONS`. */
export const VOLCANO = 'Volcano';
/** Its index in `REGIONS`: what `region_at` and `chartRegion` return for a tile of it. */
export const VOLCANO_ISLE = REGIONS.findIndex((R) => R.key === VOLCANO);
/** Its name. */
export const volcanoName = (): string => REGIONS[VOLCANO_ISLE]?.name ?? 'Volcano Isle';

/** The kinds that live at its vents, in the order the vents are written (`lairs.ts`). */
export const VOLCANO_KINDS: readonly string[] = ['ash_wraith', 'magma_golem', 'cinder_hound'];

/* ---- obsidian ------------------------------------------------------------------------------------------------- */

/** The item. */
export const OBSIDIAN = 'obsidian';
/**
 * Obsidian in the carcass of each monster kind killed on Volcano Isle, before the butchering share: more for the harder
 * kinds, by health and blow. A kind not here gives none. The island's `obsidian_of`.
 */
export const OBSIDIAN_BY_KIND: Readonly<Record<string, number>> = {
  goblin: 1, orc: 2, ogre: 3, cinder_hound: 4, ash_wraith: 5, magma_golem: 6, dragon: 10,
};
/** Obsidian off a carcass of this kind killed on Volcano Isle, before the butchering share. */
export const obsidianOf = (species: string): number => OBSIDIAN_BY_KIND[species] ?? 0;
/** The key of a carcass's `mark` that holds the island it was killed on, by its index in `REGIONS`. */
export const DIED_ON = 'isle';
/** Whether a carcass was killed on Volcano Isle, off its `mark`. */
export const diedOnVolcano = (mark: Readonly<Record<string, unknown>> | null | undefined): boolean =>
  !!mark && Number(mark[DIED_ON]) === VOLCANO_ISLE;

/* ---- a seryll vein's summons ---------------------------------------------------------------------------------- */

/** The ore whose mining summons. */
export const SERYLL_ORE = 'seryll_ore';
/** The chance a go at a seryll vein on Volcano Isle summons. */
export const SERYLL_SUMMON = 0.04;
/** How many it summons: one kind of `VOLCANO_KINDS`, this many to this many. */
export const SUMMON_LEAST = 1;
export const SUMMON_MOST = 3;
/** How far from the miner they stand up, in tiles: this far and up to this much further. */
export const SUMMON_NEAR = 2;
export const SUMMON_SPREAD = 2;
/** Seconds a summoned one stays unless it is killed first. */
export const SUMMON_SECS = 600;

/* ---- sulfur --------------------------------------------------------------------------------------------------- */

export const SULFUR = 'sulfur';
/** The stone whose mining on Volcano Isle may bring sulfur, and the chance a go does. */
export const SULFUR_STONE = 'slate_shards';
export const SULFUR_SLATE = 0.05;

/* ---- fire-tempered steel -------------------------------------------------------------------------------------- */

/** The metal (`metal.ts`). */
export const FIRE_STEEL = 'firesteel';
export const FIRE_STEEL_NAME = 'Fire-tempered steel';
/** The recipe that makes it, at a smelter on Volcano Isle only. */
export const FIRE_STEEL_RECIPE = 'make_fire_steel';
/** QL a weapon or a tool of it may be bettered past the skill (`improve_ceiling`). */
export const FIRE_STEEL_CAP = 5;

/* ---- what the vents' kinds do --------------------------------------------------------------------------------- */

/** An ash wraith's blow that lands: your hit chance times this, */
export const ASH_BLIND_HIT = 0.7;
/** for this many seconds; another starts it again from then. */
export const ASH_BLIND_SECS = 8;
/** A magma golem: the blow of a weapon carrying an ice enchantment times this. */
export const FROST_WEAK = 1.5;
/** The mote an enchantment is written with that counts as ice. */
export const ICE_MOTE = 'ice_mote';

/* ---- in words ------------------------------------------------------------------------------------------------- */

/** "4% a go: 1–3 of one volcano kind". */
export const summonSays = (kindNames: readonly string[]): string =>
  `${percent(SERYLL_SUMMON)} a go: ${SUMMON_LEAST}–${SUMMON_MOST} of one of ${kindNames.join(', ')}, `
  + `${SUMMON_NEAR}–${SUMMON_NEAR + SUMMON_SPREAD} tiles from you, leashed there, gone after ${SUMMON_SECS / 60} minutes; `
  + 'none in a settlement, the safe ring or a Sanctuary';
