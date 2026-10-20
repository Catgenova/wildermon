import type { ActionDef } from './actions';
import type { Game } from './game';
import { DAY_SECONDS, world } from './pace';
import { wellCap } from './wells';
import { windAt, windFrom, windWord } from './wind';
import { listed, listedOr, percent, timeWords } from './words';
import { durationSaid } from './boons';
import { COMPANION_LEASH, GUARD_RANGE, HEAVY_HIT } from './fight';
import { HAND_WINTER, SPRING_GROWTH } from './growth';
import { lastDawn, TREE_AGES, TREE_DAWN_UTC } from '../world/tiles';
import { metres } from './piers';

/** The daily reset as the hud's clock shows it: "13:00" (`TREE_DAWN_UTC`). */
const resetHour = (): string =>
  `${String(Math.floor(TREE_DAWN_UTC)).padStart(2, '0')}:${String(Math.round((TREE_DAWN_UTC % 1) * 60)).padStart(2, '0')}`;

import { runestoneWithin } from './runestones';

/**
 * Meditation, and the three paths.
 *
 * Sitting still on a rug and thinking about nothing is not obviously work,
 * and it is the slowest thing anybody does here. What comes of it is a
 * **path**: one of three ways of looking at the island, chosen once at
 * `CHOOSE_AT` meditation and never changed, and **Calm**, banked by every
 * sitting and spent on what the path teaches.
 *
 * **Love** is the living island's path -- companions, taming, breeding and
 * growing -- **Knowledge** the reader's, of senses and information, and
 * **Power** the body's own: endurance, carrying, moving and shrugging things
 * off.
 *
 * ## Two shapes of path
 *
 * A path is either still on its old **steps** -- five things, each opened by
 * the meditation it takes, that simply come to whoever walks it -- or it has
 * **moved** onto tiers (`PathDef.moved`), the way a trade moved off its tree
 * onto perks one at a time (`MOVED_TO_PERKS`). A moved path keeps no steps and
 * no old abilities. It offers, at each of `PATH_TIER_AT`, one **technique**
 * and two **disciplines** (`PATH_PICKS`), and its walker takes one of the
 * three at each tier, for good:
 *
 *   - a technique goes in the spell bar's one path slot (`SPELL_BAR`), is
 *     cast through the same door a faith spell is (`rpc_cast_spell`), costs
 *     Calm and rests;
 *   - a discipline is simply true from then on.
 *
 * All three have moved: Knowledge first, then Love and Power. The shape of a
 * path on its steps is kept for a path that might be added on them, and
 * nothing walks one now.
 *
 * The island keeps the path, the picks, Calm and the marks a technique leaves
 * (`path_def`, `path_pick`, `path_taken`, `player.calm`), and tells the browser
 * all of it on the beat (`rpc_settle`'s `path`) and in the Faith window's
 * answer (`faith_said`'s `path`). Playing by yourself, the browser keeps the
 * same things in its own save. What a path *offers* is the same for everybody
 * and is written here, which is what the island's rows are generated from.
 */

export const MEDITATION = 'meditation';

export type PathId = 'love' | 'knowledge' | 'power';

export interface PathStep {
  /** Meditation it takes. */
  at: number;
  name: string;
  note: string;
  /** An ability that is called on, rather than something that is simply true. */
  ability?: { id: string; rest: number; note: string };
}

export interface PathDef {
  id: PathId;
  name: string;
  note: string;
  /**
   * Moved onto tiers: its walker takes one of `PATH_PICKS` at each of
   * `PATH_TIER_AT`, and its old steps are gone. False, it keeps its steps.
   */
  moved: boolean;
  steps: PathStep[];
}

export const PATHS: Record<PathId, PathDef> = {
  love: {
    id: 'love',
    name: 'Love',
    note: 'Companions, taming, breeding, growing.',
    moved: true,
    steps: [],
  },
  knowledge: {
    id: 'knowledge',
    name: 'Knowledge',
    note: 'Senses and information.',
    moved: true,
    steps: [],
  },
  power: {
    id: 'power',
    name: 'Power',
    note: 'Endurance, carrying, movement, resistance.',
    moved: true,
    steps: [],
  },
};

export const PATH_LIST = Object.values(PATHS);
/**
 * The meditation each tier of a moved path opens at: the same five numbers as
 * a patron's tiers of faith (`FAITH_TIER_AT` is this list).
 */
export const PATH_TIER_AT = [20, 40, 60, 80, 99] as const;
/** The path may be chosen once this much meditation is behind you, which is also where its first tier opens. */
export const CHOOSE_AT = PATH_TIER_AT[0];
/** How many picks a tier offers, of which one is taken: one technique and two disciplines. */
export const PICKS_PER_TIER = 3;
/** How long between sittings that are worth anything. */
export const SIT_REST = world(12 * 60);

/** How many steps of their path somebody has behind them: none on a path that has moved onto tiers. */
export function stepsOf(path: PathId | null, meditation: number): number {
  if (!path || PATHS[path].moved) return 0;
  return PATHS[path].steps.filter((s) => meditation >= s.at).length;
}

/** Whether a particular step is behind them, by its one-based number. */
export const hasStep = (path: PathId | null, meditation: number, n: number): boolean => stepsOf(path, meditation) >= n;

/** The next step and what it wants, for the rug's menu. */
export function nextStep(path: PathId | null, meditation: number): PathStep | null {
  if (!path || PATHS[path].moved) return null;
  return PATHS[path].steps.find((s) => meditation < s.at) ?? null;
}

/** Every ability the walker of this path may call on: none on a path that has moved. */
export function abilitiesOf(path: PathId | null, meditation: number): PathStep[] {
  if (!path || PATHS[path].moved) return [];
  return PATHS[path].steps.filter((s) => s.ability && meditation >= s.at);
}

/* ---- Calm ---------------------------------------------------------------- */

/**
 * Calm a sitting banks, before where it was sat is counted: the place
 * multiplier the sitting's meditation is worked out with (`sitPlace`) times
 * this.
 */
export const SIT_CALM = 10;
/** What a sitting trains meditation by, before where it was sat is counted. */
export const SIT_GAIN = 1.5;

/**
 * The most Calm this much meditation holds: favour's curve off faith
 * (`wellCap`), and `deep` times that for a Deep Calm.
 */
export const calmCap = (meditation: number, deep = 1): number => wellCap(meditation) * deep;

/** Why a technique cannot be paid for: `cost` Calm wanted and `held` banked. The island's `spell_cast_refusal` says the same. */
export const calmRefusal = (name: string, cost: number, held: number): string =>
  `${name}: need ${cost} calm (have ${Math.floor(held)}).`;

/* ---- Where a sitting is worth most ------------------------------------------- */

/**
 * What where you sit multiplies a sitting by, both the meditation it trains
 * and the Calm it banks. The help reads these, so the rug and the page cannot
 * say different things.
 */
export const SIT_WORTH = {
  /** Your own yard, off everything else. */
  yard: 0.7,
  /** Ground above `highAt`, off a settlement; and above `thinAt`, anywhere. */
  high: 1.25,
  highAt: 25,
  thin: 1.6,
  thinAt: 60,
  /** Your feet in the water. */
  water: 1.3,
  /** A mote swirl within `swirlReach` tiles. */
  swirl: 1.25,
  swirlReach: 3,
  /** Within `staleReach` tiles of anywhere you have sat since the woods last turned. */
  stale: 0.5,
  staleReach: 2,
  /** A Runestone within `stoneReach` tiles: of its nearest tile, centre to centre (`runestoneWithin`). */
  stone: 2,
  stoneReach: 5,
};

/** What is true of a spot, for what a sitting there is worth. */
export interface SitFacts {
  onDeed: boolean;
  /** The ground's height at the middle of the tile. */
  height: number;
  water: boolean;
  /** A mote swirl within `SIT_WORTH.swirlReach` tiles. */
  swirl: boolean;
  /** Sat within `SIT_WORTH.staleReach` tiles of here since the woods last turned. */
  stale: boolean;
  /** A Runestone within `SIT_WORTH.stoneReach` tiles. */
  stone: boolean;
}

/**
 * What a spot multiplies a sitting by, and what sitting there says: every
 * multiplier in one place, so a new one goes in here and nowhere else.
 * Somewhere quiet and out of the way is worth more than the middle of your
 * own yard. Every multiplier that applies multiplies the others: a sitting
 * beside a Runestone with your feet in the water is worth `SIT_WORTH.stone`
 * times `SIT_WORTH.water`. The island's `sit_place` is the same sum in the
 * same order, and says the same words.
 */
export function sitPlace(f: SitFacts): { place: number; where: string } {
  let place = 1;
  // Every multiplier that applies, by name and number, in the order they multiply.
  const by: string[] = [];
  if (f.onDeed) {
    place *= SIT_WORTH.yard;
    by.push(SIT_YARD_SAID);
  }
  // High, wild ground is what the paths are walked on.
  if (f.height > SIT_WORTH.thinAt) {
    place *= SIT_WORTH.thin;
    by.push(SIT_THIN_SAID);
  } else if (f.height > SIT_WORTH.highAt && !f.onDeed) {
    place *= SIT_WORTH.high;
    by.push(SIT_HIGH_SAID);
  }
  if (f.water) {
    place *= SIT_WORTH.water;
    by.push(SIT_WATER_SAID);
  }
  if (f.swirl) {
    place *= SIT_WORTH.swirl;
    by.push(SIT_SWIRL_SAID);
  }
  if (f.stone) {
    place *= SIT_WORTH.stone;
    by.push(SIT_STONE_SAID);
  }
  if (f.stale) {
    place *= SIT_WORTH.stale;
    by.push(SIT_STALE_SAID);
  }
  return { place, where: `Meditation and Calm gained: ${by.length ? by.join(', ') : 'no place modifier'}.` };
}

/** Each place multiplier as a sitting names it: the island's `sit_place`. */
export const SIT_YARD_SAID = `own yard ×${SIT_WORTH.yard}`;
export const SIT_THIN_SAID = `over ${metres(SIT_WORTH.thinAt)} m high ×${SIT_WORTH.thin}`;
export const SIT_HIGH_SAID = `over ${metres(SIT_WORTH.highAt)} m high, off your settlement ×${SIT_WORTH.high}`;
export const SIT_WATER_SAID = `feet in water ×${SIT_WORTH.water}`;
/** A swirl within reach. The island's `sit_swirl_said`. */
export const SIT_SWIRL_SAID = `mote swirl within ${SIT_WORTH.swirlReach} tiles ×${SIT_WORTH.swirl}`;
/** And a Runestone. The island's `sit_stone_said`. */
export const SIT_STONE_SAID = `Runestone within ${SIT_WORTH.stoneReach} tiles ×${SIT_WORTH.stone}`;
/** And near where you have sat today. The island's `sit_stale_said`. */
export const SIT_STALE_SAID = `sat within ${SIT_WORTH.staleReach} tiles since the daily reset (${resetHour()} UTC) ×${SIT_WORTH.stale}`;

/**
 * Every place multiplier in one line, in `sitPlace`'s order, for the Faith
 * window's Path tab.
 */
export const SIT_PLACES_SAID = 'Sitting multipliers, on meditation and Calm gained; all that apply multiply: '
  + `${SIT_YARD_SAID}; ${SIT_HIGH_SAID}, or ${SIT_THIN_SAID} anywhere instead; ${SIT_WATER_SAID}; `
  + `${SIT_SWIRL_SAID}; ${SIT_STONE_SAID}; ${SIT_STALE_SAID}.`;

/** Whether a spot is within `SIT_WORTH.staleReach` of any of these. */
export const satNear = (spots: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean =>
  spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) <= SIT_WORTH.staleReach);

/** The spots sat at since the woods last turned: none, once they have turned since (`satDawn`). */
export const satSince = (spots: ReadonlyArray<readonly [number, number]>, satDawn: number, dawn: number): ReadonlyArray<readonly [number, number]> =>
  (satDawn === dawn ? spots : []);

/** The facts of the spot you stand on. */
export function sitFacts(g: Game): SitFacts {
  const x = g.player.tileX;
  const y = g.player.tileY;
  const r = SIT_WORTH.swirlReach;
  let swirl = false;
  for (let dy = -r; dy <= r && !swirl; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) <= r && g.swirlAt(x + dx, y + dy)) {
        swirl = true;
        break;
      }
    }
  }
  return {
    onDeed: g.onDeed(x, y),
    height: g.world.centerHeight(x, y),
    water: g.world.hasWater(x, y),
    swirl,
    stone: !!runestoneWithin(x, y, g.world.w, SIT_WORTH.stoneReach),
    stale: satNear(satSince(g.player.satSpots, g.player.satDawn, lastDawn(Date.now() / 1000)), x, y),
  };
}

/** What a sitting where you stand is worth: the meditation it trains and the Calm it banks. */
export function sittingWorth(g: Game): { gain: number; calm: number; place: number; where: string } {
  const { place, where } = sitPlace(sitFacts(g));
  // And more Calm banked for a Stillwater worn (`sitting_worth`).
  return { gain: SIT_GAIN * place, calm: SIT_CALM * place * (1 + g.wornEnchant('calm')), place, where };
}

/** What a sitting says when a blow lands in the middle of it (`stillness`). The island's `sitting_struck` says the same. */
export const STRUCK_SAID = 'Sitting interrupted: struck. No gain.';

/* ---- What a moved path offers -------------------------------------------- */

export type PickKind = 'technique' | 'discipline';

export interface PathPickDef {
  /** `<path>_<name>`, which is what the island keeps. */
  id: string;
  path: PathId;
  /** One to `PATH_TIER_AT.length`. */
  tier: number;
  kind: PickKind;
  name: string;
  /** What it does, in the game's numbers. */
  note: string;
  /** Calm a technique costs; nought for a discipline. */
  cost: number;
  /** Seconds before a technique can be called again; nought for a discipline. */
  rest: number;
  /** The numbers behind what it does, by name, which the island reads off its row and the note is written from. */
  fx: Readonly<Record<string, number>>;
}

/** What calling a technique trains meditation by, as calling an ability of a path on its steps does. */
export const TECHNIQUE_GAIN = 0.2;

/** A game-hour: a twenty-fourth of the island's day. */
export const GAME_HOUR = DAY_SECONDS / 24;

const pickOf = (path: PathId) => (
  tier: number, kind: PickKind, id: string, name: string, cost: number, rest: number,
  fx: Record<string, number>, note: (fx: Record<string, number>) => string,
): PathPickDef => ({ id: `${path}_${id}`, path, tier, kind, name, cost, rest, fx, note: note(fx) });
const knowledge = pickOf('knowledge');
const love = pickOf('love');
const power = pickOf('power');

/**
 * The stages a tree is grown on by, in the order a tree grows: each living
 * stage to the next, so long as the next is alive and not the same stage over
 * again -- nothing is grown into dying, and a clipped tree stays clipped.
 * Bless the Land grows a tree by these (`patrons.ts`), and so does Love's
 * Bloom.
 */
export const LAND_GROWS: ReadonlyArray<readonly [number, number]> = (() => {
  const by = new Map(TREE_AGES.map((a) => [a.id, a]));
  const grows = (id: number): boolean => {
    const a = by.get(id);
    const n = a?.next ?? null;
    return !!a && a.alive && n !== null && n !== id && !!by.get(n)?.alive;
  };
  const into = new Set(TREE_AGES.filter((a) => grows(a.id)).map((a) => a.next as number));
  const out: Array<readonly [number, number]> = [];
  for (let at = TREE_AGES.find((a) => grows(a.id) && !into.has(a.id))?.id ?? -1; at >= 0 && grows(at);) {
    const next = by.get(at)?.next as number;
    out.push([at, next]);
    at = next;
  }
  return out;
})();
const ageName = (id: number): string => (TREE_AGES.find((a) => a.id === id)?.name ?? '').toLowerCase();
/** "sapling to young, young to mature, ...": the stages a tree is grown on by, as a note says them. */
export const LAND_GROWS_SAID = listed(LAND_GROWS.map(([a, b]) => `${ageName(a)} to ${ageName(b)}`));

/**
 * Every pick a moved path offers, tier by tier: at each, the technique first
 * and the two disciplines after it.
 *
 * Knowledge's are senses and information. Its techniques find a mote swirl,
 * read the wind ahead, find a buried hoard, make the next few goes certain and
 * sharpen everything learned for a while; its disciplines are more out of
 * every gain, the blood of any wildermon at a glance, further sight, a deeper
 * well of Calm, a day's first gain doubled, another mote a swirl, a map that
 * remembers further, a prospector's reach, sight that the dark leaves alone,
 * and knacks the oftener.
 *
 * Cartographer is the browser's alone, because the map you remember is: the
 * browser keeps it and tells the island what it has seen (`rpc_fog`), and
 * nothing on the island reads it. Keen Sight and Night Eyes are the browser's
 * too, which is where sight is worked out; the island keeps all three as
 * picks and sends them, and reads none.
 */
export const PATH_PICKS: PathPickDef[] = [
  knowledge(1, 'technique', 'seek', 'Seek', 10, 5 * 60, { reach: 200 },
    (fx) => `Marks the nearest mote swirl within ${fx.reach} tiles on your map and minimap until collected.`),
  knowledge(1, 'discipline', 'attentive', 'Attentive', 0, 0, { learn: 0.05 },
    (fx) => `Skill gain +${percent(fx.learn)}, added to other bonuses (not multiplied).`),
  knowledge(1, 'discipline', 'reader', 'Reader', 0, 0, { blood: 1 },
    () => 'Read every trait in a wildermon’s blood at a glance, at any husbandry.'),

  knowledge(2, 'technique', 'sky', 'Read the Sky', 10, 10 * 60, { hours: 3 },
    (fx) => `Wind direction and strength (as sails take it) for each of the next ${fx.hours} island-clock hours. One island-clock hour: ${durationSaid(GAME_HOUR)}.`),
  knowledge(2, 'discipline', 'keen', 'Keen Sight', 0, 0, { sight: 1.25 },
    (fx) => `Sight range +${percent(fx.sight - 1)}; max sight range +${percent(fx.sight - 1)} for you.`),
  knowledge(2, 'discipline', 'deep_calm', 'Deep Calm', 0, 0, { calm: 1.25 },
    (fx) => `Max Calm +${percent(fx.calm - 1)}: ${Math.floor(calmCap(PATH_TIER_AT[PATH_TIER_AT.length - 1], fx.calm))} at meditation ${PATH_TIER_AT[PATH_TIER_AT.length - 1]} (base ${Math.floor(calmCap(PATH_TIER_AT[PATH_TIER_AT.length - 1]))}).`),

  knowledge(3, 'technique', 'trace', 'Trace', 25, 30 * 60, { reach: 40 },
    (fx) => `Marks the nearest hoard of a treasure map in your pack, within ${fx.reach} tiles, on your map and minimap until dug up.`),
  knowledge(3, 'discipline', 'quick_study', 'Quick Study', 0, 0, { first: 2 },
    (fx) => `First gain in each skill each island-clock day ×${fx.first}. One island-clock day: ${durationSaid(DAY_SECONDS)}.`),
  knowledge(3, 'discipline', 'lore', 'Elemental Lore', 0, 0, { motes: 1 },
    (fx) => `Collect motes: +${fx.motes} mote.`),

  knowledge(4, 'technique', 'foreknow', 'Foreknow', 40, 40 * 60, { goes: 5 },
    (fx) => `Your next ${fx.goes} actions with a success check succeed.`),
  knowledge(4, 'discipline', 'cartographer', 'Cartographer', 0, 0, { reveal: 2 },
    (fx) => `Map reveal radius ×${fx.reveal} your sight range, as you walk.`),
  knowledge(4, 'discipline', 'deep_reading', 'Deep Reading', 0, 0, { further: 3 },
    (fx) => `Prospecting range +${fx.further} tiles.`),

  knowledge(5, 'technique', 'clarity', 'Clarity', 60, 4 * 3600, { more: 0.5, secs: 600 },
    (fx) => `Skill gain +${percent(fx.more)} for ${durationSaid(fx.secs)}, added to other bonuses (not multiplied).`),
  knowledge(5, 'discipline', 'night_eyes', 'Night Eyes', 0, 0, { dark: 0 },
    () => 'Darkness does not reduce sight range.'),
  knowledge(5, 'discipline', 'polymath', 'Polymath', 0, 0, { knack: 1.5 },
    (fx) => `Knack chance per action ×${fx.knack}.`),

  /*
   * Love's are the living island: what follows you and what you keep, what
   * you tame and breed, and what grows. Its techniques see to hunger and
   * thirst, mend a companion, bring your wildermon to you, lull what is after
   * you and harden a companion for a fight; its disciplines quicken what is
   * sown, tame, age and breed better, fill a harvest, hold a companion to its
   * fight, make a knack last, grow a field through winter, make a tame of a
   * kind already tamed certain and grow the trees round a sitting.
   */
  love(1, 'technique', 'refresh', 'Refresh', 15, 20 * 60, {},
    () => 'Hunger and thirst full at once.'),
  love(1, 'discipline', 'green_thumb', 'Green Thumb', 0, 0, { grow: 0.8 },
    (fx) => `Crop growth stage time on your settlement −${percent(1 - fx.grow)}.`),
  love(1, 'discipline', 'gentle_hand', 'Gentle Hand', 0, 0, { tame: 1.25 },
    (fx) => `Tame chance ×${fx.tame}.`),

  love(2, 'technique', 'bond', 'Bond', 20, 10 * 60, { reach: 10, heal: 0.4 },
    (fx) => `Companion within ${fx.reach} tiles: health +${percent(fx.heal)}.`),
  love(2, 'discipline', 'kin', 'Kin', 0, 0, { 'kept:age': 0.75 },
    (fx) => `Ageing of wildermon you keep −${percent(1 - fx['kept:age'])}: young and grown ages last +${percent(1 / fx['kept:age'] - 1)}.`),
  love(2, 'discipline', 'abundance', 'Abundance', 0, 0, { harvest: 1.25 },
    (fx) => `Harvest from fields and planters, and fruit picked from trees, +${percent(fx.harvest - 1)}.`),

  love(3, 'technique', 'gather', 'Gather', 15, 5 * 60, { reach: 30 },
    (fx) => `Every wildermon of yours within ${fx.reach} tiles (following or working your settlement) comes to your side, as a call does. Workers return to work after.`),
  love(3, 'discipline', 'steady_herd', 'Steady Herd', 0, 0, { steady: 1 },
    () => `Your companion never breaks off a fight for distance from you (base: ${COMPANION_LEASH} tiles, ${GUARD_RANGE} when guarding).`),
  love(3, 'discipline', 'long_table', 'Long Table', 0, 0, { table: 1.25 },
    (fx) => `Meal and drink boost duration +${percent(fx.table - 1)}.`),

  love(4, 'technique', 'lull', 'Lull', 40, 30 * 60, { reach: 8, secs: 60 },
    (fx) => `Every creature within ${fx.reach} tiles hunting you stops; no new hunt for ${fx.secs} s unless you strike it.`),
  love(4, 'discipline', 'good_stock', 'Good Stock', 0, 0, { up: 0.1 },
    (fx) => `Young you breed: chance each trait comes out one rarity higher +${Math.round(fx.up * 100)} percentage points.`),
  love(4, 'discipline', 'seasons_hand', 'Season’s Hand', 0, 0, { winter: HAND_WINTER },
    (fx) => `Fields you sow grow in winter at ${percent(fx.winter / SPRING_GROWTH)} of spring speed (base: no growth until spring).`),

  love(5, 'technique', 'herd_heart', 'Heart of the Herd', 60, 3600, { secs: 600, reach: 10, cut: 0.3, more: 0.2 },
    (fx) => `For ${durationSaid(fx.secs)}, companion within ${fx.reach} tiles of you: damage taken −${percent(fx.cut)}, damage dealt +${percent(fx.more)}.`),
  love(5, 'discipline', 'old_friend', 'Old Friend', 0, 0, { sure: 1 },
    () => 'Taming a kind of wildermon you have tamed before never fails: first offering accepted.'),
  love(5, 'discipline', 'bloom', 'Bloom', 0, 0, { bloom: 5 },
    (fx) => `Once per island-clock day, your first finished sitting grows every tree within ${fx.bloom} tiles one age: ${LAND_GROWS_SAID}. Not into dying, not clipped trees. One island-clock day: ${durationSaid(DAY_SECONDS)}.`),

  /*
   * Power's are the body itself. Its techniques bring the wind back, make
   * deep water free, stop what is running out of you, put a turn of speed on
   * you and make wind free; its disciplines lighten a burden, lengthen a
   * stride, climb steeper and swim longer, turn more of a blow and more of a
   * heavy one, carry more, live through a killing blow, step down any drop
   * and keep hunger and thirst off longer. No damage: that is a fighting
   * trade's.
   */
  power(1, 'technique', 'second_wind', 'Second Wind', 15, 12 * 60, {},
    () => 'Stamina full at once.'),
  power(1, 'discipline', 'strong_back', 'Strong Back', 0, 0, { burden: 0.8 },
    (fx) => `Burden from armour and overload −${percent(1 - fx.burden)}.`),
  power(1, 'discipline', 'long_stride', 'Long Stride', 0, 0, { stride: 1.05 },
    (fx) => `Walk speed on foot +${percent(fx.stride - 1)}.`),

  power(2, 'technique', 'deep_lungs', 'Deep Lungs', 20, 20 * 60, { secs: 300 },
    (fx) => `Swimming costs no stamina for ${durationSaid(fx.secs)}.`),
  power(2, 'discipline', 'sure_feet', 'Sure Feet', 0, 0, { climb: 1.25 },
    (fx) => `Max step between tiles on foot, up or down, +${percent(fx.climb - 1)}, at any climbing.`),
  power(2, 'discipline', 'hard_breath', 'Hard Breath', 0, 0, { swim: 0.7 },
    (fx) => `Swimming stamina −${percent(1 - fx.swim)}.`),

  power(3, 'technique', 'shrug', 'Shrug', 25, 15 * 60, {},
    () => 'Every wound stops bleeding, burns stop weeping, venom removed. Wounds stay open until treated.'),
  power(3, 'discipline', 'ironhide', 'Ironhide', 0, 0, { hide: 1.1 },
    (fx) => `Damage stopped by what you wear +${percent(fx.hide - 1)}.`),
  power(3, 'discipline', 'unshaken', 'Unshaken', 0, 0, { heavy: 0.5 },
    (fx) => `Creature heavy blows on you: extra damage ×${fx.heavy}, ×${1 + (HEAVY_HIT - 1) * fx.heavy} an ordinary blow (base ×${HEAVY_HIT}).`),

  power(4, 'technique', 'surge', 'Surge', 40, 30 * 60, { secs: 60, pace: 1.3 },
    (fx) => `For ${durationSaid(fx.secs)}: walk speed on foot +${percent(fx.pace - 1)}; ignores slowing from load, ground, slope, leg wounds and low stamina.`),
  power(4, 'discipline', 'pack_mule', 'Pack Mule', 0, 0, { mule: 15 },
    (fx) => `Carry weight +${fx.mule} kg.`),
  power(4, 'discipline', 'hard_to_kill', 'Hard to Kill', 0, 0, { kill: 0.1, every: 3600 },
    (fx) => `A killing blow leaves you at ${percent(fx.kill)} health instead; once per ${durationSaid(fx.every)}.`),

  power(5, 'technique', 'unbroken', 'Unbroken', 60, 3600, { secs: 300 },
    (fx) => `For ${durationSaid(fx.secs)}: nothing costs stamina (work, fighting, swimming, fighting class spells).`),
  power(5, 'discipline', 'sure_fall', 'Sure Fall', 0, 0, { drop: 1 },
    () => 'On foot, step down any drop. Steps up still limited by climbing.'),
  power(5, 'discipline', 'enduring', 'Enduring', 0, 0, { upkeep: 0.75 },
    (fx) => `Hunger and thirst rate −${percent(1 - fx.upkeep)}.`),
];
export const PATH_PICK_BY_ID = new Map(PATH_PICKS.map((p) => [p.id, p]));
export const picksOf = (path: PathId, tier: number): PathPickDef[] => PATH_PICKS.filter((p) => p.path === path && p.tier === tier);
/** The techniques, which are what the path slot of the spell bar takes. */
export const TECHNIQUES = PATH_PICKS.filter((p) => p.kind === 'technique');

/** The meditation a tier opens at. */
export const pathTierAt = (tier: number): number => PATH_TIER_AT[tier - 1];

/**
 * Why a pick cannot be taken, or nothing: the same as the island's
 * `path_pick_refusal`, in the same order and words. No path, another path's,
 * a path still on its steps, already yours, another taken at that tier, or the
 * tier not open yet. `picks` is every pick there is, which the suite hands its
 * own.
 */
export function pathPickRefusal(
  p: PathPickDef, way: PathId | null, taken: readonly string[], meditation: number, picks: readonly PathPickDef[] = PATH_PICKS,
): string | null {
  if (!way) return `Choose a path first (opens at meditation ${CHOOSE_AT}).`;
  if (p.path !== way) return `Not your path: ${PATHS[p.path].name} (yours: ${PATHS[way].name}).`;
  if (!PATHS[way].moved) return `${PATHS[way].name}: still on steps, not path tiers.`;
  if (taken.includes(p.id)) return 'Already taken.';
  const other = picks.find((o) => o.path === p.path && o.tier === p.tier && taken.includes(o.id));
  if (other) return `Path tier already taken: ${other.name}.`;
  const at = pathTierAt(p.tier);
  if (meditation < at) return `Path tier opens at meditation ${at} (have ${Math.floor(meditation)}).`;
  return null;
}

/** What a pick, once taken, says. The island's `rpc_take_path_pick` says the same. */
export const tookSaid = (p: PathPickDef): string => `${p.name}. ${p.note}`;

/** What reaching a tier says, at the rug. */
export const tierSaid = (path: PathId, tier: number): string =>
  `${PATHS[path].name}: path tier ${tier} open. Pick one: ${listedOr(picksOf(path, tier).map((p) => p.name))} (Faith window).`;

/* ---- What the techniques say ---------------------------------------------------------- */

/** Seek, finding one. */
export const seekSaid = (element: string, dist: number): string =>
  `Nearest mote swirl: ${element}, ${dist} tiles. Marked on your map.`;
/** And finding none, which costs nothing. */
export const seekNone = (reach: number): string => `No mote swirl within ${reach} tiles.`;
/** Trace, finding one. */
export const traceSaid = (dist: number): string => `Hoard of a map in your pack: ${dist} tiles. Marked on your map.`;
/** And finding none, which costs nothing. */
export const traceNone = (reach: number): string => `No hoard of a map in your pack within ${reach} tiles.`;
/** Foreknow. */
export const foreknowSaid = (goes: number): string => `Next ${goes} actions with a success check: success.`;
/** Clarity. */
export const claritySaid = (secs: number, more: number): string => `Skill gain +${percent(more)} for ${timeWords(secs)}.`;

/*
 * Love's and Power's, each said the same by the island's
 * `path_technique_cast`. A technique that finds nothing to work on is refused
 * and costs nothing, as a Seek that finds no swirl is.
 */
/** Refresh. */
export const REFRESH_SAID = 'Hunger and thirst full.';
/** Bond, mending a companion. */
export const bondSaid = (name: string, heal: number): string => `${name}: health +${percent(heal)}.`;
/** And with none near, or one that is whole. */
export const bondNone = (reach: number): string => `No companion within ${reach} tiles.`;
export const bondWhole = (name: string): string => `${name}: not hurt.`;
/** How far from you Gather sets your wildermon down, round you in a ring. */
export const GATHER_RING = 0.8;
/** Where the `i`th of `n` wildermon a Gather brings stands, round (`x`, `y`): the island's `gather_spot`. */
export const gatherSpot = (x: number, y: number, i: number, n: number): [number, number] =>
  [x + Math.cos((2 * Math.PI * i) / n) * GATHER_RING, y + Math.sin((2 * Math.PI * i) / n) * GATHER_RING];
/** Gather. */
export const gatherSaid = (n: number, name: string): string =>
  (n === 1 ? `Gathered: ${name}.` : `Gathered: ${n} wildermon.`);
export const gatherNone = (reach: number): string => `No wildermon of yours within ${reach} tiles.`;
/** Lull. */
export const lullSaid = (n: number, secs: number): string =>
  `Lulled: ${n} ${n === 1 ? 'creature' : 'creatures'}. No new hunt for ${secs} s unless struck.`;
export const lullNone = (reach: number): string => `Nothing within ${reach} tiles is hunting you.`;
/** Heart of the Herd. */
export const herdSaid = (name: string, secs: number, cut: number, more: number, reach: number): string =>
  `${name}, for ${timeWords(secs)} within ${reach} tiles of you: damage taken −${percent(cut)}, damage dealt +${percent(more)}.`;
export const HERD_NONE = 'No companion following you.';
/** Second Wind. */
export const SECOND_WIND_SAID = 'Stamina full.';
/** Deep Lungs. */
export const deepLungsSaid = (secs: number): string => `Swimming costs no stamina for ${timeWords(secs)}.`;
/** Shrug, and with nothing to shrug off. */
export const SHRUG_SAID = 'Bleeding, weeping and venom stopped.';
export const SHRUG_NONE = 'No bleeding, weeping or venom.';
/** Surge. */
export const surgeSaid = (secs: number, pace: number): string => `Walk speed +${percent(pace - 1)} for ${secs} s, no slowing.`;
/** Unbroken. */
export const unbrokenSaid = (secs: number): string => `No stamina cost for ${timeWords(secs)}.`;
/** Hard to Kill, taking a killing blow. */
export const hardToKillSaid = (heal: number): string => `Hard to Kill: killing blow survived at ${percent(heal)} health.`;
/** Bloom, after a sitting. */
export const bloomSaid = (n: number): string => `Bloom: ${n} ${n === 1 ? 'tree' : 'trees'} grew one age.`;

/**
 * Read the Sky: the wind at each of the next `hours` game-hours from `time`,
 * as `windAt` will make it then, from where it comes and how hard as a share
 * of a gale, which is what a sail is worked out from. The island's `sky_said`.
 */
export function skySaid(seed: number, time: number, hours: number): string {
  const parts: string[] = [];
  for (let h = 1; h <= hours; h++) {
    const w = windAt(seed, time + h * GAME_HOUR);
    parts.push(`Wind in ${h} h: from the ${windFrom(w)}, ${windWord(w.force)}, ${Math.round(w.force * 100)}% of a gale.`);
  }
  return parts.join(' ');
}

/**
 * Your path as the Faith window draws it: the island's answer (`faith_said`'s
 * `path`), or the same worked out here when you play by yourself (`pathSaid`).
 */
export interface PathSaid {
  way: PathId | null;
  meditation: number;
  calm: number;
  cap: number;
  /** Picks taken, in the order they were. */
  taken: string[];
  /** Why each pick of your path cannot be taken; null where it can. */
  picks: Record<string, string | null>;
}

/**
 * Your path as the island says it on the beat (`rpc_settle`'s `path`), for
 * the rules the browser works out itself -- sight, the map, a wildermon's
 * blood -- and the marks a technique left.
 */
export interface PathBeat {
  way?: PathId | null;
  picks?: string[];
  calm?: number;
  /** A Foreknow's goes left. */
  foreknow?: number;
  /** A Clarity's seconds left. */
  clarity?: number;
  /** Where you have sat since the woods last turned. */
  sat?: Array<[number, number]>;
  /** The day of the island's clock each skill last had its Quick Study gain. */
  studied?: Record<string, number>;
  seek?: { x: number; y: number } | null;
  trace?: { x: number; y: number } | null;
  /** Seconds left of a Heart of the Herd, a Deep Lungs, a Surge and an Unbroken. */
  herd?: number;
  lungs?: number;
  surge?: number;
  unbroken?: number;
  /** Seconds before a Hard to Kill is ready again; nought when it is. */
  hardToKill?: number;
}

/* ---- The rug ------------------------------------------------------------------ */

const rugDown = (g: Game): boolean => g.inventory.has('rug');

export const MEDITATION_ACTIONS: ActionDef[] = [
  {
    id: 'meditate',
    label: 'Meditate',
    verb: 'sitting',
    skill: MEDITATION,
    stamina: 0,
    baseTime: 25,
    applies: (t, g) => t.kind === 'tile' && rugDown(g),
    check: (t, g) => {
      if (!rugDown(g)) return 'Need a rug.';
      const rest = g.player.satAt + SIT_REST - g.time;
      if (rest > 0) return `Sat already: next sitting in ${Math.ceil(rest / 60)} min.`;
      return null;
    },
    perform: (t, g) => {
      const { gain, calm, where } = sittingWorth(g);
      const before = g.skills.get(MEDITATION);
      g.player.satAt = g.time;
      g.satHere();
      g.gainSkill(MEDITATION, gain);
      g.note('sat');
      const now = g.skills.get(MEDITATION);
      const cap = g.calmCap();
      g.player.calm = Math.min(cap, g.player.calm + calm);
      g.logMsg(`${where} Calm ${Math.floor(g.player.calm)}/${Math.floor(cap)}.`, 'event');
      // And the trees round you, once a day, for Love's Bloom.
      const bloomed = g.bloomSitting();
      if (bloomed) g.logMsg(bloomSaid(bloomed), 'event');
      if (!g.player.way && now >= CHOOSE_AT && before < CHOOSE_AT) {
        g.logMsg(`Paths open: choose one of ${PATH_LIST.length} from the rug.`, 'system');
      }
      const path = g.player.way;
      if (path && PATHS[path].moved) {
        PATH_TIER_AT.forEach((at, i) => {
          if (before < at && now >= at) {
            g.note('path');
            g.logMsg(tierSaid(path, i + 1), 'system');
          }
        });
      } else if (path) {
        for (const s of PATHS[path].steps) {
          if (before < s.at && now >= s.at) {
            g.note('path');
            g.logMsg(`${PATHS[path].name}: ${s.name}. ${s.note}`, 'system');
          }
        }
      }
    },
  },
  {
    id: 'choose_path',
    label: 'Choose a path',
    verb: 'choosing',
    hidden: true,
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => !g.player.way && g.skills.get(MEDITATION) >= CHOOSE_AT,
    check: (t, g) => {
      if (g.player.way) return 'Path already chosen.';
      if (g.skills.get(MEDITATION) < CHOOSE_AT) return `Need meditation ${CHOOSE_AT}.`;
      const id = t.kind === 'tile' ? (t.material as PathId | undefined) : undefined;
      if (!id || !PATHS[id]) return 'Choose a path.';
      return null;
    },
    perform: (t, g) => {
      const id = t.kind === 'tile' ? (t.material as PathId | undefined) : undefined;
      if (!id || !PATHS[id] || g.player.way) return;
      g.player.way = id;
      g.note('path');
      g.logMsg(`Path taken: ${PATHS[id].name}. ${PATHS[id].note}`, 'system');
    },
  },
  {
    id: 'use_ability',
    label: 'Use path ability',
    verb: 'using it',
    hidden: true,
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => abilitiesOf(g.player.way, g.skills.get(MEDITATION)).length > 0,
    labelFor: (t, g) => {
      const id = t.kind === 'tile' ? t.material : undefined;
      const step = abilitiesOf(g.player.way, g.skills.get(MEDITATION)).find((s) => s.ability?.id === id);
      return step ? step.name : 'Use path ability';
    },
    check: (t, g) => {
      const id = t.kind === 'tile' ? t.material : undefined;
      const step = abilitiesOf(g.player.way, g.skills.get(MEDITATION)).find((s) => s.ability?.id === id);
      if (!step?.ability) return 'Not known.';
      const rest = (g.player.usedAt[step.ability.id] ?? -1e9) + step.ability.rest - g.time;
      if (rest > 0) return `${step.name}: ready in ${Math.ceil(rest / 60)} min.`;
      return null;
    },
    perform: (t, g) => {
      const id = t.kind === 'tile' ? t.material : undefined;
      const step = abilitiesOf(g.player.way, g.skills.get(MEDITATION)).find((s) => s.ability?.id === id);
      if (!step?.ability) return;
      g.player.usedAt[step.ability.id] = g.time;
      g.gainSkill(MEDITATION, TECHNIQUE_GAIN);
      g.note(`used:${step.ability.id}`);
      g.logMsg(g.workAbility(step.ability.id), 'event');
    },
  },
];
