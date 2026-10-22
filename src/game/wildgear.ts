import type { Item, ItemDef } from './items';
import type { Recipe } from './recipes';
import { DAMAGE_MAX, QL_TOP, wearPerUse, wornShare } from './limits';
import { capital, percent } from './words';

/**
 * Wildermon gear: things you make and fit on a wildermon of yours, one to a
 * slot, from its menu, and take off it the same way. Asked for: "wildermon
 * gear (#17), player-crafted gear fitted on a wildermon, one item per slot":
 *
 *   pack     loads a trip +`PACK_LOADS`, on a trade that carries loads
 *            (`LOAD_TRADES`), over what its stage carries (`stageLoads`);
 *   harness  team pace +`HARNESS_PACE` in the traces of a cart or wagon, its
 *            share of the team, as an ancient bridle's is (`harnessTeam`);
 *   barding  damage taken −`BARDING_CUT` in a fight (`bardingMul`).
 *
 * Each comes in the three sizes the wildermon beds do (`GEAR_SIZES`, by
 * `denClass`) and fits that size only: fitted on one of it, and doing nothing
 * on one that has grown out of it. Its quality puts it between `GEAR_FLOOR` of
 * the full figure at QL 0 and the whole at `QL_TOP`, with its damage dragged
 * down as a tool's is (`wornShare`). A pack's loads are whole, so its quality
 * is in how long it lasts: every piece takes a tool's wear a use
 * (`wearPerUse`) -- a pack a cycle worked at a trade it carries for, a harness a tile pulled, barding a blow
 * taken -- and falls apart at `DAMAGE_MAX`. Taken off, it is an item again,
 * repaired like any other. The island keeps it on the creature (`gear`), the
 * whole item a slot, as a crate keeps the creature in it, and the same
 * numbers: `pack_loads`, `harness_pace`, `barding_cut`, `gear_floor`.
 */
export type GearSlot = 'pack' | 'harness' | 'barding';
export const GEAR_SLOTS: readonly GearSlot[] = ['pack', 'harness', 'barding'];
/** The three sizes, by the bed a wildermon sleeps in (`denClass`): 0, 1 and 2. */
export const GEAR_SIZES = ['small', 'medium', 'large'] as const;
export type GearSize = 0 | 1 | 2;

/** Loads a trip a pack adds, on a trade that carries loads. */
export const PACK_LOADS = 1;
/** Team pace a harness adds at `QL_TOP`, its share of the team. */
export const HARNESS_PACE = 0.1;
/** Damage taken a barding takes off at `QL_TOP`. */
export const BARDING_CUT = 0.2;
/** The share of the full figure a piece of the least QL (`GEAR_QL_LEAST`) gives. */
export const GEAR_FLOOR = 0.5;
/** The QL a piece gives `GEAR_FLOOR` at: none. */
export const GEAR_QL_LEAST = 0;

/** The item a slot and a size make: `wild_pack_small`. */
export const gearId = (slot: GearSlot, size: GearSize): string => `wild_${slot}_${GEAR_SIZES[size]}`;
const GEAR_BY_ID: ReadonlyMap<string, { slot: GearSlot; size: GearSize }> = new Map(
  GEAR_SLOTS.flatMap((slot) => ([0, 1, 2] as const).map((size) => [gearId(slot, size), { slot, size }] as const)),
);
/** Which slot and size an item is, or undefined for anything that is not wildermon gear. */
export const gearOf = (id: string): { slot: GearSlot; size: GearSize } | undefined => GEAR_BY_ID.get(id);

/** What a piece of this quality and damage gives of the full figure: `GEAR_FLOOR` at QL 0, the whole at `QL_TOP`. The island's `gear_share`. */
export const gearShare = (it: Pick<Item, 'ql' | 'dmg'>): number =>
  GEAR_FLOOR + ((1 - GEAR_FLOOR) * Math.max(GEAR_QL_LEAST, Math.min(QL_TOP, it.ql)) * wornShare(it.dmg)) / QL_TOP;

/** What is fitted in a slot and fits the size it is now, or undefined: gear it has grown out of does nothing. The island's `gear_on`. */
export function gearOn(c: { gear?: Partial<Record<GearSlot, Item>> }, slot: GearSlot, size: number): Item | undefined {
  const it = c.gear?.[slot];
  return it && gearOf(it.id)?.size === size ? it : undefined;
}

/** What a piece does, in the game's terms: "loads a trip +1", "team pace +7.5%", "damage taken −15%". The island's `gear_says`. */
export function gearSays(slot: GearSlot, it: Pick<Item, 'ql' | 'dmg'>): string {
  if (slot === 'pack') return `loads a trip +${PACK_LOADS}`;
  if (slot === 'harness') return `team pace +${percent(HARNESS_PACE * gearShare(it))}`;
  return `damage taken −${percent(BARDING_CUT * gearShare(it))}`;
}

/**
 * One use's wear on a piece fitted in a slot: a tool's (`wearPerUse`). Hands
 * back whether it fell apart, at which it is gone off the creature.
 */
export function wearGear(c: { gear?: Partial<Record<GearSlot, Item>> }, slot: GearSlot): boolean {
  const it = c.gear?.[slot];
  if (!it) return false;
  it.dmg = Math.min(DAMAGE_MAX, it.dmg + wearPerUse(it.ql));
  if (it.dmg < DAMAGE_MAX) return false;
  const rest = { ...c.gear };
  delete rest[slot];
  c.gear = Object.keys(rest).length ? rest : undefined;
  return true;
}

/** What its keeper is told when a piece falls apart: "Small wildermon barding on Ash: damage 100, gone." The island's `gear_wear`. */
export const gearGoneSays = (c: { name: string }, it: Pick<Item, 'id'>): string =>
  `${GEAR_ITEMS[it.id]?.name ?? it.id} on ${c.name}: damage ${DAMAGE_MAX}, gone.`;

/** "a " before a slot's name, and nothing before barding, which is never one of. The island's `gear_a`. */
export const gearA = (slot: GearSlot): string => (slot === 'barding' ? '' : 'a ');

/** The slot's name for a line: "Pack", "Harness", "Barding". */
export const slotName = (slot: GearSlot): string => capital(slot);

/*
 * The bills. Each slot's for a small one, and twice and three times it for a
 * medium and a large one (`GEAR_SIZE_BILL`): a pack is leather and rope, a
 * harness leather with metal ribbon and nails for its fittings, and barding
 * leather under metal ribbon plates riveted on. Packs and harnesses are
 * leatherworking at the awl; barding is blacksmithing at the hammer.
 */
export const GEAR_BILL: Readonly<Record<GearSlot, ReadonlyArray<readonly [item: string, count: number]>>> = {
  pack: [['leather', 2], ['rope', 1]],
  harness: [['leather', 2], ['ribbon', 1], ['nail', 2]],
  barding: [['leather', 2], ['ribbon', 2], ['nail', 4]],
};
/** What a size multiplies its slot's bill by. */
export const GEAR_SIZE_BILL = [1, 2, 3] as const;
/** Each slot's skill and tool, its difficulty and time at small, and the weight of a small one in kilograms. */
const GEAR_MAKE: Readonly<Record<GearSlot, { skill: string; tool: string; verb: string; difficulty: number; time: number; weight: number }>> = {
  pack: { skill: 'leatherworking', tool: 'awl', verb: 'stitching a pack', difficulty: 16, time: 10, weight: 2 },
  harness: { skill: 'leatherworking', tool: 'awl', verb: 'stitching a harness', difficulty: 22, time: 12, weight: 2.5 },
  barding: { skill: 'blacksmithing', tool: 'hammer', verb: 'riveting barding', difficulty: 26, time: 16, weight: 4 },
};
/** What a size adds to its slot's difficulty, a step a size up. */
export const GEAR_SIZE_DIFFICULTY = 6;

/** The bill for a slot at a size. */
export const gearBill = (slot: GearSlot, size: GearSize): Array<[string, number]> =>
  GEAR_BILL[slot].map(([item, count]) => [item, count * GEAR_SIZE_BILL[size]]);

/** What each piece does, for its description: off the rule, never written out. */
function gearDoes(slot: GearSlot): string {
  if (slot === 'pack') return `loads a trip +${PACK_LOADS}, on a trade that carries loads. Wears a cycle worked.`;
  if (slot === 'harness') {
    return `team pace in the traces of a cart or wagon +${percent(HARNESS_PACE * GEAR_FLOOR)} at QL ${GEAR_QL_LEAST} to +${percent(HARNESS_PACE)} at QL ${QL_TOP}, `
      + 'its share of the team. Wears a tile pulled.';
  }
  return `damage taken −${percent(BARDING_CUT * GEAR_FLOOR)} at QL ${GEAR_QL_LEAST} to −${percent(BARDING_CUT)} at QL ${QL_TOP}. Wears a blow taken.`;
}

/** Who a size fits, as the beds say it. */
const DEN_FITS: readonly string[] = [
  'first evolution stage, or non-evolving under {den.small} health',
  'second evolution stage, or non-evolving {den.small} to under {den.large} health',
  'third evolution stage, or non-evolving {den.large} health or more',
];

/** The nine pieces, for `ITEM_DEFS`: who each fits is filled in off the beds' rule (`{den.*}`, `creatures.ts`). */
export const GEAR_ITEMS: Record<string, ItemDef> = Object.fromEntries(GEAR_SLOTS.flatMap((slot) => ([0, 1, 2] as const).map((size) => [
  gearId(slot, size),
  {
    name: `${capital(GEAR_SIZES[size])} wildermon ${slot}`,
    category: 'misc',
    weight: GEAR_MAKE[slot].weight * GEAR_SIZE_BILL[size],
    decay: 8,
    description: `Fit on your ${GEAR_SIZES[size]} wildermon (its menu; ${DEN_FITS[size]}): ${gearDoes(slot)} `
      + `Damage ${DAMAGE_MAX}: falls apart. Remove to repair.`,
  } satisfies ItemDef,
])));

/** The nine recipes, in the crafting window under Cloth. */
export const GEAR_RECIPES: Recipe[] = GEAR_SLOTS.flatMap((slot) => ([0, 1, 2] as const).map((size): Recipe => {
  const m = GEAR_MAKE[slot];
  return {
    id: `make_${gearId(slot, size)}`,
    category: 'Cloth',
    result: gearId(slot, size),
    inputs: gearBill(slot, size).map(([item, count]) => ({ item, count })),
    tool: m.tool,
    skill: m.skill,
    label: `Make ${gearA(slot)}${GEAR_SIZES[size]} wildermon ${slot}`,
    verb: m.verb,
    baseTime: m.time * GEAR_SIZE_BILL[size],
    stamina: 0.04,
    difficulty: m.difficulty + GEAR_SIZE_DIFFICULTY * size,
    done: '',
    consumeOnFail: true,
  };
}));
