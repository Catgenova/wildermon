/**
 * Why a worker is standing about, and what it did yesterday.
 *
 * Asked for, from a report of a Tinka "sent home to work on the deed from
 * about 300 tiles away, but it didn't move": a wildermon set to work on a
 * settlement often stands idle and nothing says why. Every time a worker's
 * step finds nothing to do it now keeps a short reason, as a code and a
 * number, and its card says it as a sentence. And a ledger of the last
 * island day: "Last island day: cut 140 reeds, carried 38 loads to the
 * crate; gained 2.1 levels."
 *
 * Both are kept the same on both sides. The island stores the code and the
 * number on the creature row (`idle_why`, `idle_n`) and the ledger as one
 * jsonb (`ledger`, `ledger_add`); the browser keeps them on the `Creature`.
 * The sentence is made here, once, from the code, the number and the job,
 * for a worker on either side.
 */

import type { GatherKind } from './creatures';
import { STORE_RECIPES, LYE_RECIPES, PAPER_RECIPES } from './creatures';
import { countOf, itemDef } from './items';
import { RECIPE_BY_ID } from './recipes';
import { SKILL_BY_ID } from './skills';
import { article, listed, listedOr } from './words';

/**
 * One code per distinct cause, not one per place in the rules it can come
 * from:
 *
 *   * `range`: nothing of its trade within its range (the number) of the token or its post;
 *   * `stock`: nothing in the stores on the settlement for it to work;
 *   * `room`: nowhere on the settlement with room for what it brings (a barrel, for water);
 *   * `full`: holding a load with nowhere on the settlement to put it;
 *   * `far`: walking home, so many tiles (the number) from its work;
 *   * `away`: on the island, its keeper is away, so nothing works it;
 *   * `unswept`: on the island, nobody awake is within the number of tiles of it, so nothing works it.
 *
 * And three that are not idleness but rest, which its card says in the same place (`TIRE_GOES`, `REST_FOR`):
 *
 *   * `rest`: resting where it stands, the number the seconds of it left;
 *   * `bed`: asleep in a wildermon bed (`bed`, the piece's kind), the number the seconds left;
 *   * `tired`: walking to a wildermon bed (`bed`) to rest in it.
 */
export type IdleWhy = 'range' | 'stock' | 'room' | 'full' | 'far' | 'away' | 'unswept' | 'rest' | 'bed' | 'tired';
export const IDLE_WHYS: readonly IdleWhy[] = ['range', 'stock', 'room', 'full', 'far', 'away', 'unswept', 'rest', 'bed', 'tired'];

/**
 * Why a worker is idle, as kept on it: the code, its number, and whether it works off a post rather than the token;
 * for a rest in a bed, the bed's kind.
 */
export interface Idle {
  why: IdleWhy;
  n: number;
  post?: boolean;
  bed?: string;
}

/**
 * What there is none of within its range, by the trade: the island's
 * `work_words` for the trades that walk out to a tile, and what each errand
 * looks for round the token.
 */
const IDLE_SOURCE: Partial<Record<GatherKind, string>> = {
  forage: 'ground left to forage', botanize: 'ground left to botanize', woodcut: 'trees to fell', prune: 'trees worth pruning',
  fruit: 'fruit on the bough', stump: 'stumps to dig out', mine: 'bare rock with a seam in it', quarry: 'bare rock to cut',
  sand: 'sand to dig', clay: 'clay to dig', peat: 'peat to cut', reed: 'reed bed', fish: 'water worth a rod',
  seek: 'ground worth turning over', farm: 'fields wanting work', hive: 'hive to tend', bush: 'bushes or vines to pick',
  grass: 'grass or moss to cut', pan: 'sand at the water to pan', worm: 'ground to dig for worms',
  sprout: 'trees to pick a sprout off', resin: 'pines to tap', flower: 'wildflowers to pick', scrub: 'moss or ivy on your stone',
  fetch: 'anything lying on the ground', compost: 'anything rotting on the ground', hunt: 'quarry or carcass',
  water: 'shore or well to fill from', fill: 'shore or well to fill a bucket at', prospect: 'unread ground',
  plant: 'cleared ground to plant a sprout in', hod: 'planned building work wanting something your settlement stores hold',
  stoke: 'fire, furnace or kiln burning low', groom: 'wildermon of yours wanting brushing',
  dairy: 'wildermon of yours ready to milk or shear', heal: 'wildermon of yours hurt or bleeding',
  lamp: 'lantern post or pillar of yours wanting a candle, lighting or putting out',
  smelt: 'smelter of yours with room for ore, or with metal to take out',
  kiln: 'kiln of yours with room for pottery, or with pottery to take out', ash: 'ashes to rake out',
  brew: 'barrel of water of yours with nothing working in it', cook: 'lit campfire or oven of yours',
  patch: 'planter of yours wanting work', paper: 'paper press of yours',
};

/** What it would do with what the stores do not hold: "nothing in your stores on the settlement to mend". */
const IDLE_STOCK: Partial<Record<GatherKind, string>> = {
  mend: 'mend', butcher: 'butcher', tan: 'tan', mill: 'mill', saw: 'saw', chisel: 'chisel', brick: 'shape', rope: 'lay up',
  fletch: 'fletch', paper: 'press', glaze: 'glaze', restore: 'restore', brew: 'brew', cook: 'cook', smelt: 'smelt',
  kiln: 'fire', stoke: 'burn', plant: 'plant', hod: 'build with', fill: 'fill', lamp: 'put in a lantern', patch: 'sow',
  heal: 'dress a hurt with', dairy: 'milk into', ash: 'leach into lye',
};

/**
 * The one thing a trade fetches out of the stores before it can work, where
 * there is one: a sprout, a candle, an empty bucket, seed, a dressing.
 */
const IDLE_STOCK_THING: Partial<Record<GatherKind, string>> = {
  plant: 'a sprout', lamp: 'a candle', fill: 'an empty bucket', dairy: 'an empty bucket', patch: 'seed',
  heal: 'a bandage or a cover', stoke: 'fuel', restore: 'every piece of one relic', glaze: 'a bare pot and the ash for its glaze',
};

/** Where what it brings would go, and what it brings, for a trade whose work ends somewhere other than a store. */
const IDLE_ROOM: Partial<Record<GatherKind, readonly [string, string]>> = {
  water: ['barrel', 'water'],
};

/**
 * What a trade worked off a recipe at the stores wants there, read off the
 * recipes it tries: "a hide and a lye, with a carving knife", or one of
 * several such.
 */
function recipeWants(kind: GatherKind): string {
  const ids = STORE_RECIPES[kind] ?? (kind === 'paper' ? PAPER_RECIPES : kind === 'ash' ? LYE_RECIPES : []);
  const recipes = ids.map((id) => RECIPE_BY_ID.get(id)).filter((r) => !!r);
  const bill = (r: (typeof recipes)[number]): string => listed(r!.inputs.map((i) => countOf(i.item, i.count ?? 1, true)));
  const toolOf = (r: (typeof recipes)[number]): string => (r!.tool ? itemDef(r!.tool).name.toLowerCase() : '');
  const withTool = (what: string, tool: string): string => (tool ? `${what}, with ${article(tool)} ${tool}` : what);
  // One tool for all of them is said once: "2 wheat, 2 corn or 10 olives, with a quern".
  const tools = new Set(recipes.map(toolOf));
  if (tools.size === 1) return withTool(listedOr(recipes.map(bill)), [...tools][0]);
  return listedOr(recipes.map((r) => withTool(bill(r), toolOf(r))));
}

/** Seconds left, whole and never under one: "1 more second", "37 more seconds". */
const secondsMore = (secs: number): string => {
  const n = Math.max(1, Math.ceil(secs));
  return `${n} second${n === 1 ? '' : 's'} left`;
};

/**
 * The sentence for a reason, in the game's own terms and with its number:
 * "Idle: no reed bed within 30 tiles of the token." `kind` is the trade it
 * works; `carrying` the name of what is in its arms, for `full`.
 */
export function idleSays(idle: Idle, kind: GatherKind | null | undefined, carrying?: string | null): string {
  const n = Math.round(idle.n);
  switch (idle.why) {
    case 'range':
      return `Idle: no ${(kind && IDLE_SOURCE[kind]) ?? 'work of its task'} within ${n} tiles of ${idle.post ? 'its work post' : 'the totem'}.`;
    case 'stock': {
      const verb = (kind && IDLE_STOCK[kind]) ?? 'work';
      const wants = kind ? IDLE_STOCK_THING[kind] ?? recipeWants(kind) : '';
      return `Idle: nothing in your settlement stores to ${verb}${wants ? ` (needs ${wants})` : ''}.`;
    }
    case 'room': {
      const [where, what] = (kind && IDLE_ROOM[kind]) ?? ['store', 'what it brings'];
      return `Idle: no ${where} on the settlement has room for ${what}.`;
    }
    case 'full':
      return `Idle: holding ${carrying ? carrying.toLowerCase() : 'a load'}, settlement storage full.`;
    case 'far':
      return `Idle: walking home, ${n} tiles from its work.`;
    case 'away':
      return 'Idle: keeper away.';
    case 'unswept':
      return `Idle: nobody awake within ${n} tiles.`;
    case 'rest':
      return `Resting: ${secondsMore(idle.n)}.`;
    case 'bed': {
      const name = itemDef(idle.bed ?? '').name.toLowerCase();
      return `Asleep in ${article(name)} ${name}: ${secondsMore(idle.n)}.`;
    }
    case 'tired': {
      const name = itemDef(idle.bed ?? '').name.toLowerCase();
      return `Tired: walking to ${article(name)} ${name}.`;
    }
  }
}

/* ---- The ledger ----------------------------------------------------------- */

/**
 * How many different things one day's ledger counts. A worker handles one or
 * two kinds of thing a day as a rule; a ninth kind on the same day is left
 * uncounted, so that the ledger stays the same small size however long it
 * runs. The island's `ledger_items`.
 */
export const LEDGER_ITEMS = 8;
/** How many of them the card says: the most, then by name. */
export const LEDGER_SHOWN = 3;

/** One island day's work: its goes at its task, the skill it gained, and what it handled by the item. */
export interface LedgerDay {
  goes: number;
  skill: number;
  made: Record<string, number>;
}

/**
 * Two days, the one under way and the one before it, by the island day
 * (`islandDay`): rolled over when a day goes by, so it never holds more than
 * two. `last` is the day before `day` only; a day it did nothing is no day.
 */
export interface WorkLedger {
  day: number;
  now: LedgerDay;
  last: LedgerDay | null;
}

const emptyDay = (): LedgerDay => ({ goes: 0, skill: 0, made: {} });

/** The ledger as it stands on `day`: rolled on to it if it was last written on an earlier one. The island's `ledger_roll`. */
export function ledgerRoll(l: WorkLedger | null | undefined, day: number): WorkLedger {
  if (!l) return { day, now: emptyDay(), last: null };
  if (l.day === day) return l;
  return { day, now: emptyDay(), last: l.day === day - 1 ? l.now : null };
}

/**
 * Something counted to today's work: a go, skill gained, or so many of a
 * thing handled. The island's `ledger_add`, to the letter.
 */
export function ledgerAdd(
  l: WorkLedger | null | undefined,
  day: number,
  add: { goes?: number; skill?: number; item?: string | null; n?: number },
): WorkLedger {
  const out = ledgerRoll(l, day);
  const now = out.now;
  now.goes += add.goes ?? 0;
  now.skill += add.skill ?? 0;
  if (add.item && (add.n ?? 0) > 0 && (add.item in now.made || Object.keys(now.made).length < LEDGER_ITEMS)) {
    now.made[add.item] = (now.made[add.item] ?? 0) + (add.n ?? 0);
  }
  return out;
}

/** The two days as they read on `day`: today's so far, and yesterday's. */
export function ledgerDays(l: WorkLedger | null | undefined, day: number): { today: LedgerDay | null; last: LedgerDay | null } {
  if (!l || l.day < day - 1) return { today: null, last: null };
  if (l.day === day - 1) return { today: null, last: l.now };
  return { today: l.now, last: l.last };
}

/**
 * One day as a line: "Last island day: 38 goes; handled 140 reeds and 12
 * seed; +2.10 skill." The things it handled are the `LEDGER_SHOWN` it
 * handled most of. Empty for a day with nothing in it.
 */
export function ledgerSays(label: string, d: LedgerDay | null, skill?: string | null): string {
  if (!d || (d.goes <= 0 && d.skill <= 0 && !Object.keys(d.made).length)) return '';
  const made = Object.entries(d.made).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, LEDGER_SHOWN);
  const parts: string[] = [`${d.goes} cycle${d.goes === 1 ? '' : 's'}`];
  if (made.length) parts.push(`handled ${listed(made.map(([id, n]) => countOf(id, n, true)))}`);
  if (d.skill > 0) parts.push(`+${d.skill.toFixed(2)} ${skill ? (SKILL_BY_ID.get(skill)?.name ?? skill).toLowerCase() : 'skill'}`);
  return `${label}: ${parts.join('; ')}.`;
}

/** Both days, as the card says them: nothing at all for a worker with no work on either. */
export function ledgerLines(l: WorkLedger | null | undefined, day: number, skill?: string | null): string[] {
  const { today, last } = ledgerDays(l, day);
  return [ledgerSays('This island day', today, skill), ledgerSays('Last island day', last, skill)].filter((s) => !!s);
}
