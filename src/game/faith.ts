import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { furnitureCentre, furnitureDef, type PlacedFurniture } from './furniture';
import { itemName, NOT_RESTORED, unrestored, type Item } from './items';
import { worldRate } from './pace';
import { WELL_CEILING, wellCap } from './wells';
import { SKILL_BY_ID } from './skills';
import { SOUL_GAIN, tryGain } from './learn';

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

export interface CastDef {
  id: string;
  name: string;
  /** Favour it costs. */
  cost: number;
  /** Faith it takes before it will work at all. */
  level: number;
  /** What it wants pointed at: an item in the pack, or nothing. */
  on: 'item' | 'self';
  note: string;
}

/** The most times one tool will take the circle. */
export const BLESS_CAP = 3;
/** What each blessing is worth to the working quality of a tool, in per cent. */
export const BLESS_STEP = 9;
/** How long a fair wind holds behind you, in seconds of the clock. */
export const FAIR_WIND = 6 * 60;

export const CASTS: CastDef[] = [
  {
    id: 'call',
    name: 'Call',
    cost: 12,
    level: 3,
    on: 'self',
    note: 'Your active companion teleports to you.',
  },
  {
    id: 'mend',
    name: 'Mend',
    cost: 18,
    level: 8,
    on: 'item',
    note: 'Removes all damage from an item.',
  },
  {
    id: 'dawnlight',
    name: 'Light of the dawn',
    cost: 26,
    level: 16,
    on: 'self',
    note: 'Heals all your wounds; cures infection.',
  },
  {
    id: 'cunning',
    name: 'Circle of cunning',
    cost: 34,
    level: 24,
    on: 'item',
    note: `Tool works +${BLESS_STEP}% better, permanently. Max ${BLESS_CAP} casts per tool.`,
  },
  {
    id: 'fairwind',
    name: 'Fair wind',
    cost: 30,
    level: 30,
    on: 'self',
    note: `Wind turns to blow from behind you and holds ${FAIR_WIND / 60} min.`,
  },
  {
    id: 'bounty',
    name: 'Bounty',
    cost: 44,
    level: 40,
    on: 'self',
    note: 'Every crop on your settlement grows one growth stage.',
  },
];
export const CAST_BY_ID = new Map(CASTS.map((c) => [c.id, c]));

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

/** Why this cast will not go, or null. */
export function castReason(g: Game, def: CastDef, item?: Item): string | null {
  if (g.skills.get(FAITH) < def.level) return `${def.name} needs ${(SKILL_BY_ID.get(FAITH)?.name ?? FAITH).toLowerCase()} ${def.level}; have ${g.skills.get(FAITH).toFixed(0)}.`;
  if (g.player.favour < def.cost) return `${def.name} costs ${def.cost} favour; have ${Math.floor(g.player.favour)}. Pray at an altar.`;
  if (def.on === 'item' && !item) return 'Choose an item.';
  // Not on a find nobody has restored yet, which nothing mends (`unrestored`).
  if (def.id === 'mend' && item && unrestored(item)) return NOT_RESTORED;
  if (def.id === 'mend' && item && item.dmg <= 0) return `${itemName(item)}: not damaged.`;
  if (def.id === 'cunning' && item) {
    if ((item.bless ?? 0) >= BLESS_CAP) return `${itemName(item)}: max ${BLESS_CAP} casts reached.`;
    if (item.issued) return 'Not on starting-kit tools.';
  }
  if (def.id === 'call' && !g.creatures.active()) return 'No active companion.';
  if (def.id === 'dawnlight' && !g.player.wounds.length) return 'No wounds.';
  if (def.id === 'bounty' && !g.deed) return 'No settlement.';
  return null;
}

/** Work one cast. Returns what it did, for the log. */
export function doCast(g: Game, def: CastDef, item?: Item): string {
  g.player.favour = Math.max(0, g.player.favour - def.cost);
  g.gainSkill(FAITH, 0.6);
  g.note(`cast:${def.id}`);
  switch (def.id) {
    case 'call': {
      const c = g.creatures.active();
      if (c) {
        c.x = g.player.x + 0.6;
        c.y = g.player.y;
        c.state = 'idle';
        c.enemy = null;
        g.events.emit('creature');
        return `${c.name} is beside you.`;
      }
      return 'No companion came.';
    }
    case 'mend': {
      if (!item) return 'Nothing to mend.';
      item.dmg = 0;
      g.events.emit('inventory');
      return `Repaired: ${itemName(item).toLowerCase()}, 0 damage.`;
    }
    case 'dawnlight': {
      const n = g.player.wounds.length;
      g.player.wounds = [];
      g.player.stats.health = Math.min(1, g.player.stats.health + 0.25);
      return `Healed: ${n} ${n === 1 ? 'wound' : 'wounds'}; infection cured.`;
    }
    case 'cunning': {
      if (!item) return 'Nothing to work on.';
      item.bless = Math.min(BLESS_CAP, (item.bless ?? 0) + 1);
      g.events.emit('inventory');
      return `${itemName(item)}: +${Math.round((blessBonus(item.bless) - 1) * 100)}% (${item.bless}/${BLESS_CAP} casts).`;
    }
    case 'fairwind': {
      g.favourWind = g.time + FAIR_WIND;
      return 'Wind turned to behind you.';
    }
    case 'bounty': {
      const n = g.hastenCrops();
      return n ? `Crops grown 1 growth stage: ${n}.` : 'No crops to grow.';
    }
    default:
      return 'No effect.';
  }
}

const itemOf = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Which cast a target is asking for, carried on the target itself. */
const castOf = (t: Target): CastDef | undefined => (t.kind === 'item' || t.kind === 'tile' ? CAST_BY_ID.get((t as { spell?: string }).spell ?? '') : undefined);

export const FAITH_ACTIONS: ActionDef[] = [
  {
    id: 'cast',
    label: 'Call on it',
    verb: 'calling on it',
    hidden: true,
    skill: FAITH,
    stamina: 0.03,
    baseTime: 6,
    applies: () => true,
    labelFor: (t) => castOf(t)?.name ?? 'Call on it',
    check: (t, g) => {
      const def = castOf(t);
      if (!def) return 'Choose what to call for.';
      return castReason(g, def, itemOf(g, t));
    },
    perform: (t, g) => {
      const def = castOf(t);
      if (!def) return;
      const item = itemOf(g, t);
      if (castReason(g, def, item)) return;
      g.logMsg(doCast(g, def, item), 'event');
    },
  },
  {
    id: 'pray',
    label: 'Pray',
    verb: 'praying',
    // Said with Prayer, which the go trains as every job trains its own skill; faith is trained in `perform`.
    skill: PRAYER,
    stamina: 0.02,
    baseTime: 14,
    applies: (t, g) => {
      const f = pieceOf(g, t);
      return !!f && isAltar(f);
    },
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return 'It is gone.';
      if (!nearPiece(g, f)) return 'Stand at the altar.';
      const rest = g.player.prayedAt + PRAYER_REST - g.time;
      if (rest > 0) return prayerRestWords(rest);
      return null;
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return;
      const hour = g.hourOfDay();
      // And more for a Favoured worn, and for soul strength (`perform_faith`).
      const gained = prayerWorth(f.ql, hour, g.skills.get(PRAYER)) * (1 + g.wornEnchant('favour')) * g.soulMul();
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
    },
  },
];
