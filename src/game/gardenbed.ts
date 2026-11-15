/**
 * Garden beds.
 *
 * A garden bed (`GARDEN_BED` in building.ts) is a floor of soil in a timber
 * frame, laid as a floor and nothing else (`only`, so `onlyRefusal`, the
 * island's `material_only_refusal`), on any storey, at `floorBill`'s floor
 * share of its bill. Finished, it is a field: sown, tended and harvested by the
 * same jobs and the same Farmer's perks and patches, Bounty and a night's
 * sleep included, aimed at it from the storey it is on. What grows in it grows
 * on the glass clock, `GLASSHOUSE_GROWTH` of its pace in every season, winter
 * included, as a glasshouse's field does.
 *
 * Only while it is open to the sky or under glass (`bedOpen`): nothing
 * finished over it on any storey above, or the nearest thing finished over it
 * a roof of glass. Covered by anything else -- a floor, a staircase, a roof of
 * anything but glass -- it is not sown (`BED_COVERED`), and what grows in it
 * stands still (`Crop.still`, the island's `crop.still`): it is carried onto
 * the still clock, which never runs, as far into its stage as it had grown
 * (`rebaseStage`, the island's `crop_rebased`), and back onto the glass clock
 * the same way when it is uncovered. The island does it by triggers on the
 * rows a floor, a roof and a staircase are kept in (`bed_resync`), so no way
 * of covering or uncovering a bed can miss it; and the same triggers take the
 * crop up with the bed when the bed is taken up or relaid in anything else.
 *
 * The island keeps a crop by its tile and its storey (`crop_pkey` on
 * `crop.storey`, its bed's storey or the ground's for a field), so each storey
 * of a tile has a crop of its own: a bed on storey 2 is sown, tended and
 * harvested over a crop on the bed or the field under it, and neither is the
 * other's. A crop on a bed knows its storey (`Crop.level`, the island's
 * `crop.level`); one in a field has none, and stands on the ground's storey.
 *
 * A job on a bed is aimed at the storey it names (`level` on its target, the
 * storey a pinned storey's menu was showing), or else at the one you stand on;
 * it is done from that storey, so the job walks you there first, and the
 * island refuses one asked from another storey (`bedStoreySaid`).
 */
import { floorKind, GARDEN_BED, isDone, TOP_LEVELS, type Buildings, type FloorTile } from './building';
import type { Crop } from './farming';
import type { Game } from './game';
import { GLASS_ROOF } from './building';

/** The material a garden bed is laid in, by its id. */
export const BED = GARDEN_BED.id;
/** Why a garden bed is not sown: covered by something that is not glass. */
export const BED_COVERED = 'Covered: garden beds need open sky or a glass roof.';
/** Why a ground-floor bed is not sown over a field's crop on the same tile: one crop per storey of a tile. */
export const BED_ONE_CROP = 'Crop in the field here: one crop per storey.';
/** Why a job on a bed of one storey is refused from another: it is worked from its own storey. The island's `bed_storey_said`. */
export const bedStoreySaid = (level: number): string => `Garden bed on storey ${level + 1}: stand on storey ${level + 1}.`;
/** Why a garden bed is not planned as the deck of a tile on piers (`piers.ts`): its piers would be soil. */
export const BED_NO_DECK = 'Garden bed: not a deck on piers.';
/** What a harvest or a sowing calls a garden bed. */
export const BED_NAME = 'Garden bed';

/** The finished garden bed on a storey of a tile, if there is one. */
export function bedAt(bld: Buildings, level: number, x: number, y: number): FloorTile | undefined {
  const f = bld.floor(level, x, y);
  return f && f.material === BED && floorKind(f) === 'floor' && isDone(f) ? f : undefined;
}

/**
 * Whether a garden bed on a storey of a tile is open to the sky or under
 * glass: nothing finished over it on any storey above, or the nearest thing
 * finished over it a roof of glass. The island's `bed_open`.
 */
export function bedOpen(bld: Buildings, level: number, x: number, y: number): boolean {
  for (let l = level + 1; l <= TOP_LEVELS + 1; l++) {
    const f = bld.floor(l, x, y);
    if (!f || !isDone(f)) continue;
    return floorKind(f) === 'roof' && f.material === GLASS_ROOF.id;
  }
  return true;
}

/** The storey a farming job on a tile is worked from: the one you stand on, the ground floor from a cellar. */
export const farmLevel = (g: Game): number => Math.max(0, g.player.level);

/** The storey a farming job aimed at a tile is for: the one its target names, else the one you stand on (`farmLevel`). */
export const jobFarmLevel = (g: Game, level?: number): number => (typeof level === 'number' && level >= 0 ? level : farmLevel(g));

/**
 * The storey of the finished garden bed a farming job on a tile is aimed at --
 * on the storey its target names, or else on the one you stand on -- or null
 * for the ground's field. The island's `bed_level_of`.
 */
export function bedLevelOf(g: Game, x: number, y: number, at?: number): number | null {
  const level = jobFarmLevel(g, at);
  return bedAt(g.buildings, level, x, y) ? level : null;
}

/** The crop a job aimed at a tile works: on the garden bed it is aimed at, or in the ground's field; none that grows on another storey. */
export function cropHere(g: Game, x: number, y: number, level: number | null): Crop | undefined {
  const c = g.cropAt(x, y, level ?? 0);
  return c && (c.level ?? null) === level ? c : undefined;
}

/**
 * Why a tile is not sown, as a garden bed or a field, for the bed's storey
 * (null for the field): a bed covered, or a crop growing on that storey of the
 * tile. Null when it may be. The island's `bed_sow_refusal`.
 */
export function bedSowRefusal(g: Game, x: number, y: number, level: number | null): string | null {
  if (level !== null && !bedOpen(g.buildings, level, x, y)) return BED_COVERED;
  const c = g.cropAt(x, y, level ?? 0);
  if (!c) return null;
  return (c.level ?? null) === level ? 'Already growing a crop.' : BED_ONE_CROP;
}

/** Whether a tile on a storey is a bed to sow: finished, open, and nothing growing on that storey of it. */
export const bedSowable = (g: Game, level: number, x: number, y: number): boolean =>
  !!bedAt(g.buildings, level, x, y) && bedOpen(g.buildings, level, x, y) && !g.cropAt(x, y, level);

/** The empty garden beds of a Farmer's patch on a storey: finished, open, and nothing growing on that storey of the tile. */
export const emptyBeds = (g: Game, tiles: ReadonlyArray<[number, number]>, level: number): Array<[number, number]> =>
  tiles.filter(([x, y]) => bedSowable(g, level, x, y));
