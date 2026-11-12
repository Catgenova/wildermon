import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { furnitureCentre, furnitureDef, type PlacedFurniture } from './furniture';
import type { Item } from './items';
import { worldRate } from './pace';
import { WELL_CEILING, wellCap } from './wells';
import { SOUL_GAIN, tryGain } from './learn';
import { statueName, statuePatron, type PatronDef } from './patronlist';

/**
 * An altar, and what it is worth to have one.
 *
 * There is no god on this island with a name, and nobody here would claim to
 * know one. There is a stone table, there is the hour before the sun is
 * properly up, and there is the plain fact that a thing knelt over at dawn
 * comes out better than a thing that was not. Whether that is anybody's doing
 * is not a question the work answers.
 *
 * What a prayer banks is **favour**, and favour is spent on a handful of
 * things none of which can be had any other way: a tool that works better
 * than it was made, a wound closed in a breath, a fair wind, a field brought
 * on a week in a moment.
 */

export const FAITH = 'prayer';
/**
 * The skill a prayer is said with, which sets how much favour it banks.
 * Faith (`FAITH`, whose id is `prayer` from before the two were told apart)
 * sets how much favour you can hold and what you can call on with it.
 */
export const PRAYER = 'praying';

/**
 * Favour comes back on its own, slowly, up to what your faith carries.
 *
 * A rate rather than a duration, so it is *divided* by the world's pace: leave
 * it alone and the well fills just as fast as it always did, and nothing has
 * been slowed at all. The one place a multiplication would have been exactly
 * backwards.
 */
export const FAVOUR_TRICKLE = worldRate(0.004);
/** What a prayer at an altar is worth, before the hour and the stone are counted. */
export const PRAYER_FAVOUR = 22;
/** How long between prayers that are worth anything: thirty minutes on the clock on the wall, whatever the island's hour. */
export const PRAYER_REST = 30 * 60;
/**
 * What a prayer trains faith by: the base of the skill's own gain, as an
 * ordinary job of work's is `ORDINARY_GAIN`. Prayer, the skill it is said
 * with, learns what any go that comes off teaches its own skill (`tryGain`).
 */
export const PRAYER_GAIN = 1.4;
/** Why a prayer is not heard yet: `rest` seconds of the wait left. The island's `faith_refusal` says the same. */
export const prayerRestWords = (rest: number): string =>
  `Prayer cooldown: ${PRAYER_REST / 60} min. ${Math.ceil(rest / 60)} min left.`;
/** The most favour anybody holds, whatever their faith. */
export const FAVOUR_CEILING = WELL_CEILING;

/** How much favour this much faith will carry at once: the curve Calm is held to as well (`wells.ts`). */
export const favourCap = (faith: number): number => wellCap(faith);

/**
 * The two hours of the clock a prayer is worth most at, how many hours either
 * side it tapers over, what it is worth well away from both, and what the
 * best of them adds. The island's `pray` keeps the same two hours.
 */
export const PRAYER_PEAKS = [6, 20] as const;
export const PRAYER_TAPER = 3;
export const PRAYER_BASE = 0.55;
export const PRAYER_LIFT = 0.75;

/** What the hour does to a prayer. */
export const prayerHour = (hour: number): number =>
  PRAYER_BASE + Math.max(...PRAYER_PEAKS.map((p) => Math.max(0, 1 - Math.abs(hour - p) / PRAYER_TAPER))) * PRAYER_LIFT;

/**
 * What one prayer banks: more at a better altar, at those two hours than at
 * noon, and the more Prayer it is said with. The island's `prayer_worth` is
 * the same sum.
 */
export const prayerWorth = (altarQl: number, hour: number, prayer: number): number =>
  PRAYER_FAVOUR * prayerHour(hour) * (0.6 + altarQl / 200) * (0.7 + prayer / 220);

/** The most times one tool will take the circle. */
export const BLESS_CAP = 3;
/** What each blessing is worth to the working quality of a tool, in per cent. */
export const BLESS_STEP = 9;
/** What the blessings on a thing are worth, as a multiplier on what it is worth working. */
export const blessBonus = (n: number | undefined): number => 1 + Math.min(BLESS_CAP, n ?? 0) * (BLESS_STEP / 100);

const isAltar = (f: PlacedFurniture): boolean => !!furnitureDef(f.kind).altar;
const pieceOf = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get(t.id) : undefined);
const nearPiece = (g: Game, f: PlacedFurniture): boolean => {
  const [cx, cy] = furnitureCentre(f);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= 2.4;
};

/** The altar within reach, if there is one. */
export function altarNear(g: Game): PlacedFurniture | undefined {
  for (const f of g.furniture.values()) {
    if (!isAltar(f)) continue;
    const [cx, cy] = furnitureCentre(f);
    if (Math.hypot(cx - g.player.x, cy - g.player.y) <= 2.4) return f;
  }
  return undefined;
}

const itemOf = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a prayer is not heard yet, or null: the wait since the last one, at an altar and with a statue alike. */
const prayerRest = (g: Game): string | null => {
  const rest = g.player.prayedAt + PRAYER_REST - g.time;
  return rest > 0 ? prayerRestWords(rest) : null;
};

/**
 * Why a patron's statue is not prayed with by you: anybody but a follower of
 * its patron, no patron at all included. The island's `statue_followers`, word
 * for word: "Statue of Chaos: followers of Chaos only."
 */
export const statueFollowers = (p: PatronDef): string => `${statueName(p)}: followers of ${p.name} only.`;

/** Why this statue in the pack will not be prayed with now, or null. The island's `faith_refusal`, word for word. */
export function statuePrayRefusal(g: Game, t: Target): string | null {
  const it = itemOf(g, t);
  const p = it && statuePatron(it.id);
  if (!it || !p) return 'It is gone.';
  if (g.player.patron !== p.id) return statueFollowers(p);
  return prayerRest(g);
}

/**
 * One prayer heard, at an altar or with a statue of that QL: favour banked by
 * `prayerWorth` at the hour and your Prayer, the wait started, faith trained.
 * The island's `perform_faith`, for `pray` and `pray_statue` alike.
 */
function prayed(g: Game, ql: number): void {
  const hour = g.hourOfDay();
  // And more for a Favoured worn, and for soul strength (`perform_faith`).
  const gained = prayerWorth(ql, hour, g.skills.get(PRAYER)) * (1 + g.wornEnchant('favour')) * g.soulMul();
  const cap = favourCap(g.skills.get(FAITH));
  const before = g.player.favour;
  g.player.favour = Math.min(cap, before + gained);
  g.player.prayedAt = g.time;
  g.gainSkill(FAITH, PRAYER_GAIN);
  g.note('prayed');
  const dawn = Math.abs(hour - 6) < 2 || Math.abs(hour - 20) < 2;
  g.logMsg(
    `Prayed${dawn ? ' (dawn or dusk bonus)' : ''}. Favour ${Math.floor(g.player.favour)}/${Math.floor(cap)}.`,
    'event',
  );
  // And soul strength, as every one of its sources teaches it (`SOUL_GAIN`).
  g.gainSkill('soul_strength', tryGain(true, SOUL_GAIN));
}

/** A prayer's go: seconds at Prayer 1, and wind; at an altar and with a statue alike. */
export const PRAY_TIME = 14;
export const PRAY_WIND = 0.02;

export const FAITH_ACTIONS: ActionDef[] = [
  {
    id: 'pray',
    label: 'Pray',
    verb: 'praying',
    // Said with Prayer, which the go trains as every job trains its own skill; faith is trained in `perform`.
    skill: PRAYER,
    stamina: PRAY_WIND,
    baseTime: PRAY_TIME,
    applies: (t, g) => {
      const f = pieceOf(g, t);
      return !!f && isAltar(f);
    },
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return 'It is gone.';
      if (!nearPiece(g, f)) return 'Stand at the altar.';
      return prayerRest(g);
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return;
      prayed(g, f.ql);
    },
  },
  {
    /*
     * A patron's statue in the pack, prayed with anywhere by a follower of its
     * patron: an altar's prayer at the statue's QL, the same wait, favour,
     * training and hour (`prayed`). Asked for: "The restored statue can be
     * Enchanted using one of each mote to be statue of x diety and can be used
     * for mobile prayer instead of needing to be at an altar".
     */
    id: 'pray_statue',
    label: 'Pray',
    verb: 'praying',
    skill: PRAYER,
    stamina: PRAY_WIND,
    baseTime: PRAY_TIME,
    applies: (t, g) => {
      const it = itemOf(g, t);
      return !!it && !!statuePatron(it.id);
    },
    check: (t, g) => statuePrayRefusal(g, t),
    perform: (t, g) => {
      if (statuePrayRefusal(g, t)) return;
      const it = itemOf(g, t);
      if (it) prayed(g, it.ql);
    },
  },
];
