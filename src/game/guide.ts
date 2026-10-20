/**
 * The field guide: a page for every kind of creature on the island, and which
 * of them you have seen, tamed and bred.
 *
 * Asked for: a field guide of the wildermon, one page per species, marking
 * whether you have seen, tamed and bred it, and where it lives.
 *
 * Three marks, each set by the thing it names and by nothing else:
 *
 *   seen   a creature of that kind stood where you could see it: out of a
 *          crate, on a tile in sight now, which is what the drawing means by
 *          it (`Vision.isWatched`) and so what decides whether it is drawn;
 *   tamed  you won one over, by hand or out of a trap, which is the other
 *          door to keeping one and asks the same taming;
 *   bred   a young one was born to a dam you keep.
 *
 * A kind tamed or bred has been seen, so either mark sets `seen` as well: no
 * page is ticked for taming and still drawn as a stranger.
 *
 * Alone, the book is this side's and goes in the save. On an island it is the
 * island's: a taming and a birth are written down where they happen, a
 * sighting is handed over and checked against what is standing near you, and
 * the window reads the whole book as it opens. What this side holds there is
 * what the island has said.
 *
 * Everything a page says about a kind is read off its definition and the rules
 * that definition drives, and never written out, so a page cannot promise a
 * thing the rules do not do. A kind nobody has seen yet is its shape and
 * nothing else.
 */
import { TILE_DEFS, TileType } from '../world/tiles';
import { BUTCHER_PARTS, HOARD_LUMPS, HOARD_MORE } from './butcher';
import { TACK } from './creatureActions';
import { MILK_PART, milkLitres } from './dairy';
import { BUCKET_LITRES } from './furniture';
import {
  favouriteSays, GATHER_DO, GATHER_SKILL, WILD_STAGE_CHANCE, WILD_STAGE_ODDS, WILD_STAGE_TAME, HERD_REACH, HUNT_SIGHT, MONSTER_CAP, MONSTER_KEEP_OFF, MONSTER_SHARE, MONSTERS,
  HAUL_SKILL, LEARNS_SAYS, PULL_DEFAULT, RANGE_PER_STEP, seasonSays, SKILL_STEP, SPECIES, tracesSkill, WATER_RANGE, WILD_RANGE, WILD_SPECIES, type SpeciesDef, LEARN_PACE,
} from './creatures';
import { BANE_BONUS } from './gear';
import { HOARD_METALS, itemDef } from './items';
import { PEACE_REACH } from './keep';
import { defaultKey } from './keybinds';
import { MATERIALS } from './materials';
import { SKILL_BY_ID } from './skills';
import { HUNTER_TRAPPED, TIMID_TRAPPED } from './traps';
import { COMPANION_SIGHT as KEPT_EYES } from './vision';
import { WOUND_KINDS } from './wounds';
import { article, capital, listed, percent, timeWords } from './words';
import { lairOf, REGIONS } from '../world/regions';

export type GuideMark = 'seen' | 'tamed' | 'bred';
export const GUIDE_MARKS: GuideMark[] = ['seen', 'tamed', 'bred'];
/** How each mark reads on a page and on the counts over the index. */
export const MARK_NAMES: Record<GuideMark, string> = { seen: 'Seen', tamed: 'Tamed', bred: 'Bred' };

/** The book as it is kept: the kinds under each mark, by species id. */
export interface GuideBook {
  seen: string[];
  tamed: string[];
  bred: string[];
}

/**
 * How often what is in view is looked over for a kind the book has not got,
 * in seconds. A page is not a thing that has to be turned the instant a rabba
 * steps out of the trees, and a look is one pass over the creatures near you.
 */
export const GUIDE_LOOK = 1;

/** Every kind there is a page for, in the book's order, which is the order the definitions are written in. */
export const guidePages = (): SpeciesDef[] => Object.values(SPECIES);
/** Whether a kind can be tamed and bred at all: everything but a monster. */
export const keepable = (def: SpeciesDef): boolean => !def.monster;

export class FieldGuide {
  readonly seen = new Set<string>();
  readonly tamed = new Set<string>();
  readonly bred = new Set<string>();

  /**
   * Mark a kind, and say which marks are new. Taming or breeding one marks it
   * seen as well, so the answer can hold two.
   */
  mark(species: string, what: GuideMark): GuideMark[] {
    const fresh: GuideMark[] = [];
    for (const m of what === 'seen' ? (['seen'] as const) : (['seen', what] as const)) {
      if (this[m].has(species)) continue;
      this[m].add(species);
      fresh.push(m);
    }
    return fresh;
  }

  has(species: string, what: GuideMark): boolean {
    return this[what].has(species);
  }

  /**
   * Everything another telling of the book has, added to this one.
   *
   * Added rather than put in its place: a mark is never taken off, and a
   * sighting the island answered for while the window's read was on its way
   * back is as true as anything the read says. A kind this browser has no
   * page for is left out, since there is no page to put it on.
   */
  take(book: Partial<GuideBook> | null | undefined): void {
    for (const m of GUIDE_MARKS) {
      const kinds = book?.[m];
      if (!Array.isArray(kinds)) continue;
      for (const id of kinds) if (typeof id === 'string' && SPECIES[id]) this.mark(id, m);
    }
  }

  toJSON(): GuideBook {
    return { seen: [...this.seen].sort(), tamed: [...this.tamed].sort(), bred: [...this.bred].sort() };
  }

  static fromJSON(book: Partial<GuideBook> | null | undefined): FieldGuide {
    const guide = new FieldGuide();
    guide.take(book);
    return guide;
  }
}

/** How much of the book is filled in: each mark counted over the kinds it can be set on. */
export interface GuideCounts {
  seen: number;
  tamed: number;
  bred: number;
  /** Every kind there is a page for. */
  kinds: number;
  /** And the ones that can be tamed and bred, which the monsters are not. */
  keepable: number;
}

export function guideCounts(guide: FieldGuide): GuideCounts {
  const pages = guidePages();
  const kept = pages.filter(keepable);
  return {
    seen: pages.filter((d) => guide.seen.has(d.id)).length,
    tamed: kept.filter((d) => guide.tamed.has(d.id)).length,
    bred: kept.filter((d) => guide.bred.has(d.id)).length,
    kinds: pages.length,
    keepable: kept.length,
  };
}

/** The line over the index: "Seen 12 of 40 · Tamed 3 of 36 · Bred 1 of 36". */
export function countsLine(guide: FieldGuide): string {
  const n = guideCounts(guide);
  return `${MARK_NAMES.seen} ${n.seen} of ${n.kinds} · ${MARK_NAMES.tamed} ${n.tamed} of ${n.keepable} · ${MARK_NAMES.bred} ${n.bred} of ${n.keepable}`;
}

/** What the log says the first time a kind is seen, on either side. */
export function seenLine(def: SpeciesDef, guide: FieldGuide): string {
  const n = guideCounts(guide);
  return `First ${def.name.toLowerCase()} seen: ${n.seen}/${n.kinds} kinds. (Field guide, ${defaultKey('win_guide')})`;
}

/* ---- What a page says ------------------------------------------------------ */

/** "a, b or c", for a choice rather than a list. */
const either = (xs: readonly string[]): string =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
const tileName = (t: TileType): string => TILE_DEFS[t].name.toLowerCase();
const itemName = (id: string): string => itemDef(id).name.toLowerCase();
const skillName = (id: string): string => (SKILL_BY_ID.get(id)?.name ?? id).toLowerCase();

/**
 * How often the wild's roll comes out as this kind, as a share of one: its
 * weight in the table, over the share of rolls that are wildermon at all; or,
 * for a monster, its weight among the monsters over the share that are
 * monsters. Nothing for a kind the wild never puts down.
 */
export function wildShare(def: SpeciesDef): number {
  const wild = WILD_SPECIES.find(([id]) => id === def.id)?.[1];
  if (wild !== undefined) return (wild / WILD_SPECIES.reduce((n, [, w]) => n + w, 0)) * (1 - MONSTER_SHARE);
  const bad = MONSTERS.find(([id]) => id === def.id)?.[1];
  return bad !== undefined ? (bad / MONSTERS.reduce((n, [, w]) => n + w, 0)) * MONSTER_SHARE : 0;
}

/**
 * Where a kind lives, read off the rules that put it down and keep it there:
 * the ground `Creatures.suits` asks for, what it wants within `WATER_RANGE`,
 * the hour, the home ground every wild thing keeps to, the herd a grazer
 * throws in with, how often the wild's roll is this kind, and, for a monster,
 * how far it keeps from a settlement and how many may be about at once.
 *
 * `onIsland` adds the one rule only an island has: no monster is put down on
 * the quiet beach where everybody comes ashore (`at_peace`).
 */
export function whereItLives(def: SpeciesDef, onIsland = false): string[] {
  const lines: string[] = [];
  if (def.onOre) lines.push('Spawns on: a vein or coal seam, bare or buried');
  else if (def.onSand) lines.push(`Spawns on: ${tileName(TileType.Sand)}`);
  else if (def.onStone) lines.push(`Spawns on: bare ${tileName(TileType.Rock)}, no vein or seam`);
  else lines.push(`Spawns on: ${either(Object.values(TILE_DEFS).filter((t) => t.forage).map((t) => t.name.toLowerCase()))}`);
  const near: string[] = [];
  if (def.nearWater) near.push('water');
  if (def.nearTrees) near.push(`a ${tileName(TileType.Tree)}`);
  if (def.nearClay) near.push(tileName(TileType.Clay));
  if (def.nearTar) near.push(either([TileType.Tar, TileType.Peat, TileType.Marsh].map(tileName)));
  if (near.length) lines.push(`Within ${WATER_RANGE} tiles of: ${listed(near)}`);
  if (def.nocturnal) lines.push('Spawns only at night');
  if (def.season) lines.push(`Wild only ${seasonSays(def.season)} (UTC); gone from the wild on other days`);
  if (def.monster) {
    lines.push(`Never within ${MONSTER_KEEP_OFF[def.id] ?? 0} tiles of a settlement token`);
    if (onIsland) lines.push(`Never within ${PEACE_REACH} tiles of the landing beach`);
  }
  lines.push(`Home range: ${WILD_RANGE} tiles`);
  lines.push(def.hunter
    ? 'Solitary: a home ground of its own'
    : `Herds: one spawned within ${HERD_REACH} tiles of another's home shares that home`);
  const share = wildShare(def);
  if (share > 0) lines.push(`Spawn share: 1 in ${Math.round(1 / share)}`);
  if (def.monster) {
    lines.push(`Island cap: ${MONSTER_CAP[def.id] ?? 1} at once`);
    const lair = lairOf(def.id);
    if (lair) lines.push(`Only on ${lair.name}`);
    for (const R of REGIONS) if (R.monsters && (lair ?? R) === R) lines.push(`Up to ${(MONSTER_CAP[def.id] ?? 1) * R.monsters} more on ${R.name}, where no other wild creature spawns`);
  }
  return lines;
}

/** One heading of a page and what is under it. */
export interface GuideSection {
  head: string;
  lines: string[];
}

/** Winning one over: what it asks, what it takes from the hand, and how it takes to a trap. */
function taming(def: SpeciesDef): string[] {
  if (def.monster) return ['Cannot be tamed, trapped, bred or kept'];
  const lines = [
    `Taming ${def.tameLevel}, base chance ${percent(def.tameChance)} per offering`,
  ];
  // One that comes in already past its first stage asks more (`wildStageRoll`, `tameNeeds`).
  if (def.stages) {
    lines.push(def.stages.map((st, i) => `1 in ${WILD_STAGE_ODDS[i]} wild: ${st.name}, `
      + `taming ${def.tameLevel + WILD_STAGE_TAME * (i + 1)}, base chance ${percent(def.tameChance * WILD_STAGE_CHANCE ** (i + 1))}`).join('; '));
  }
  lines.push(`Offerings: ${either(def.diet.map(itemName))}`);
  // And what its favourite is worth to one of yours (`fedOn`).
  if (favouriteSays(def)) lines.push(favouriteSays(def));
  if (def.timid) lines.push(`Trap chance ×${TIMID_TRAPPED}`);
  else if (def.hunter) lines.push(`Trap chance ×${HUNTER_TRAPPED}`);
  return lines;
}

/** What one is for once it is yours: its trade, what it gives, what it carries and pulls, and what it sees. */
function keeping(def: SpeciesDef): string[] {
  const lines: string[] = [];
  if (def.gathers) {
    const skill = skillName(GATHER_SKILL[def.gathers]);
    lines.push(`Deed job: ${GATHER_DO[def.gathers]}. Learns ${skill}`
      // At its trade's own pace, which evens out every trade's time to level (`LEARN_PACE`).
      + (LEARN_PACE[def.gathers] !== 1 ? `, learning pace ${percent(LEARN_PACE[def.gathers])}` : ''));
    for (const other of def.trades ?? []) {
      if (other !== def.gathers) lines.push(`Or, chosen by name: ${GATHER_DO[other]}. Learns ${skillName(GATHER_SKILL[other])}`);
    }
    lines.push(`Range: ${def.workRange} tiles from its orders, +${def.rangePerStep ?? RANGE_PER_STEP} `
      + `per ${SKILL_STEP} levels of ${skill}`);
  } else lines.push('No trade');
  if (def.fleece) {
    const yields = def.shearYield ?? 'wool';
    lines.push(`${yields === 'feather' ? 'Pluck' : 'Shear'} with a ${itemName('carving_knife')}: ${itemName(yields)}`);
  }
  if (def.milk) {
    const litres = milkLitres(def.id);
    lines.push(litres >= BUCKET_LITRES ? `Milk a female into an empty ${itemName('bucket')}: ${itemName('milk_bucket')}`
      : `Milk a female into an empty ${itemName('bucket')} or a ${itemName(MILK_PART)}: ${litres} litres a milking, `
        + `${BUCKET_LITRES} litres to a ${itemName('milk_bucket')}`);
  }
  if (def.fleece) {
    const grown = itemName(def.shearYield ?? 'wool');
    const what = def.milk ? `${capital(grown)} and milk` : capital(grown);
    lines.push(`${what} regrowth, grown: ${timeWords(1 / def.fleece)}`);
  }
  if (def.mount) lines.push(`Mount: needs ${listed(TACK.map((id) => `${article(itemName(id))} ${itemName(id)}`))}`);
  if (def.pitch) lines.push(`Under a rider: climbing counts ×${def.pitch} toward the steepest step`);
  if (def.swims) lines.push('Mount: crosses deep water');
  if (def.draught) {
    // A kind that learns its own skill by pulling has that skill in the traces where the rest have climbing (`tracesSkill`).
    const traces = tracesSkill(def);
    lines.push(`Traces: team pull +${percent(def.pull ?? PULL_DEFAULT)}`
      + `${def.pull !== undefined && def.pull !== PULL_DEFAULT ? ` (most: +${percent(PULL_DEFAULT)})` : ''}`
      + (traces === HAUL_SKILL ? '; learns climbing pulling'
        : `; its ${SKILL_BY_ID.get(traces)?.name.toLowerCase() ?? traces} counts as climbing for team pace and the steepest step`));
  }
  if (def.sight) lines.push(`Sight for you: ${def.sight} tiles (most: ${KEPT_EYES})`);
  if (def.learns) {
    // And at its own pace, which evens out every trade's time to level (`LEARN_PACE`); pulling says its own.
    const pace = LEARN_PACE[def.learns.by];
    lines.push(`Level: ${SKILL_BY_ID.get(def.learns.skill)?.name.toLowerCase() ?? def.learns.skill}, learned ${LEARNS_SAYS[def.learns.by]}`
      + (pace !== 1 && def.learns.by !== 'pull' ? `, learning pace ${percent(pace)}` : ''));
  }
  return lines;
}

/** What it is like to meet: its body, what it does when struck, what its blows leave, and what bites it hardest. */
function fighting(def: SpeciesDef): string[] {
  const lines = [`Grown: ${def.health} health, blow ${def.attack}, speed ${def.speed} ${def.speed === 1 ? 'tile' : 'tiles'} a second`];
  if (def.hunter) lines.push(`${def.monster ? 'Attacks' : 'Wild: attacks'} on sight from ${def.notice ?? HUNT_SIGHT} tiles`);
  if (def.timid) lines.push('Wild: flees when struck');
  if (def.defensive) lines.push('Strikes back every time');
  lines.push(`Wound: ${WOUND_KINDS[def.wound ?? 'bite'].name}`);
  // A light of its own, wild or kept, and the one metal that bites what carries one.
  if (def.glow) {
    lines.push(`Lights ${def.glow} tiles round itself at any hour`);
    const bane = MATERIALS.filter((m) => m.bane).map((m) => m.name.toLowerCase());
    lines.push(`${capital(either(bane))} edge: damage ×${BANE_BONUS}`);
  }
  return lines;
}

/** What a whole carcass gives, part by part, and the one hoard on the island. */
function carcass(def: SpeciesDef): string[] {
  // Counted as the butcher's own line counts them: "3 × meat".
  const parts = BUTCHER_PARTS.filter(([p]) => (def.butcher[p] ?? 0) > 0).map(([p, id]) => `${def.butcher[p]} \u00d7 ${itemName(id)}`);
  const lines = parts.length ? [`Butchered whole, grown: up to ${listed(parts)}`] : [];
  if (def.butcher.hoard) {
    lines.push(`Hoard: ${HOARD_LUMPS}–${HOARD_LUMPS + HOARD_MORE} lumps by how much of the carcass is kept, each `
      + either(HOARD_METALS.map((id) => `${article(itemName(id))} ${itemName(id)}`)));
  }
  return lines;
}

/** A kind's whole page, under its headings, for a kind that has been seen. */
export function guidePage(def: SpeciesDef, onIsland = false): GuideSection[] {
  return [
    { head: 'Habitat', lines: whereItLives(def, onIsland) },
    { head: def.monster ? 'Not a wildermon' : 'Taming', lines: taming(def) },
    ...(def.monster ? [] : [{ head: 'Kept', lines: keeping(def) }]),
    { head: 'Combat', lines: fighting(def) },
    { head: 'Butchered', lines: carcass(def) },
  ].filter((s) => s.lines.length);
}
