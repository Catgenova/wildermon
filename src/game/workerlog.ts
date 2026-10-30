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
import { STORE_RECIPES, LYE_RECIPES, smithLumps, STATION_TRADES } from './creatures';
import { countOf, itemDef } from './items';
import { RECIPE_BY_ID } from './recipes';
import { SKEP_IDLE } from './bees';
import { SEASONS } from '../world/calendar';
import { SKILL_BY_ID } from './skills';
import { article, listed, listedOr } from './words';

/**
 * One code per distinct cause, not one per place in the rules it can come
 * from:
 *
 *   * `range`: nothing of its trade within its range (the number) of the token or its post;
 *   * `stock`: nothing in the stores on the settlement for it to work; for a hod carrier with work within its range
 *     wanting only what the stores do not hold, those things (`what`, the first `IDLE_WANTS` of them, nearest first)
 *     and how many there are (the number);
 *   * `room`: nowhere on the settlement with room for what it brings (a barrel, for water);
 *   * `full`: holding a load with nowhere on the settlement to put it;
 *   * `far`: walking home, so many tiles (the number) from its work;
 *   * `away`: on the island, its keeper is away, so nothing works it;
 *   * `unswept`: on the island, nobody awake is within the number of tiles of it, so nothing works it;
 *   * `nospar`: a Sparra on a settlement with no guard of yours there free to spar with (`sparsAsGuard`);
 *   * `season`: a Vesp at its hive in `SKEP_IDLE`, when nothing is in flower for it (`vespTrip`);
 *   * `flowers`: a Vesp whose hive has no wildflowers within the number of tiles (`SKEP_REACH`) of it;
 *   * `stairs`: its store, station or planned work a storey up, the number that storey counted from 1 for the ground,
 *     with no finished staircase going up to it (`creature_way`, `hod_unreached`).
 *
 * And three that are not idleness but rest, which its card says in the same place (`TIRE_GOES`, `REST_FOR`):
 *
 *   * `rest`: resting where it stands, the number the seconds of it left;
 *   * `bed`: asleep in a wildermon bed (`bed`, the piece's kind), the number the seconds left;
 *   * `tired`: walking to a wildermon bed (`bed`) to rest in it;
 *   * `yielded`: a Sparra or a guard that has yielded a spar, standing until it is above the number in health (`sparBack`).
 */
/**
 * How long a worker takes up or down one flight or round one spiral staircase to the next storey, in tiles of its
 * walk: a flight's head and foot are a tile apart, and a spiral is climbed on its own tile. The island's `worker_way_leg`.
 */
export const FLIGHT_TILES = 1;

export type IdleWhy = 'range' | 'stock' | 'room' | 'full' | 'far' | 'away' | 'unswept' | 'rest' | 'bed' | 'tired' | 'nospar' | 'yielded' | 'season' | 'flowers' | 'stairs' | 'stranded';
export const IDLE_WHYS: readonly IdleWhy[] = ['range', 'stock', 'room', 'full', 'far', 'away', 'unswept', 'rest', 'bed', 'tired', 'nospar', 'yielded', 'season', 'flowers', 'stairs', 'stranded'];

/**
 * Why a worker is idle, as kept on it: the code, its number, and whether it works off a post rather than the token;
 * for a rest in a bed, the bed's kind.
 */
export interface Idle {
  why: IdleWhy;
  n: number;
  post?: boolean;
  bed?: string;
  what?: string[];
}

/** How many of what work in range wants a `stock` reason names (`Idle.what`). The island's `idle_wants`. */
export const IDLE_WANTS = 3;

/**
 * What there is none of within its range, by the trade: the island's
 * `work_words` for the trades that walk out to a tile, and what each errand
 * looks for round the token.
 */
const IDLE_SOURCE: Partial<Record<GatherKind, string>> = {
  forage: 'ground left to forage', botanize: 'ground left to botanize', woodcut: 'trees to fell', prune: 'trees worth pruning',
  fruit: 'fruit on the bough', stump: 'stumps to dig out', mine: 'bare rock with a seam in it', quarry: 'bare rock to cut',
  sand: 'sand to collect', clay: 'clay to collect', peat: 'peat to collect', reed: 'reed bed', fish: 'water worth a rod',
  seek: 'ground worth turning over', farm: 'fields wanting work', hive: 'hive to tend', bush: 'bushes or vines to pick',
  grass: 'grass or moss to cut', pan: 'sand at the water to pan', worm: 'ground to dig for worms',
  sprout: 'trees to pick a sprout off', resin: 'pines to tap', flower: 'wildflowers to pick', scrub: 'moss or ivy on your stone',
  fetch: 'anything lying on the ground', compost: 'anything rotting on the ground', hunt: 'quarry or carcass',
  water: 'shore or well to fill from', fill: 'shore or well to fill a bucket at', prospect: 'unread ground',
  plant: 'cleared ground to plant a sprout in', hod: 'planned building work',
  stoke: 'fire, furnace or kiln burning low', groom: 'wildermon of yours wanting brushing',
  dairy: 'wildermon of yours ready to milk or shear', heal: 'wildermon of yours hurt or bleeding',
  lamp: 'lantern post or pillar of yours wanting a candle, lighting or putting out',
  smelt: 'smelter of yours with room for ore, or with metal to take out',
  kiln: 'kiln of yours with room for pottery, or with pottery to take out', ash: 'ashes to rake out',
  brew: 'barrel of water of yours with nothing working in it', cook: 'lit campfire or oven of yours',
  patch: 'planter of yours wanting work', paper: 'paper press of yours', spin: 'spindle of yours',
  nail: 'anvil of yours', ribbon: 'anvil of yours',
};

/** What it would do with what the stores do not hold: "nothing in your stores on the settlement to mend". */
const IDLE_STOCK: Partial<Record<GatherKind, string>> = {
  mend: 'mend', butcher: 'butcher', tan: 'tan', mill: 'mill', saw: 'saw', chisel: 'chisel', brick: 'shape', rope: 'lay up',
  fletch: 'fletch', paper: 'press', glaze: 'glaze', restore: 'restore', brew: 'brew', cook: 'cook', smelt: 'smelt',
  kiln: 'fire', stoke: 'burn', plant: 'plant', hod: 'build with', fill: 'fill', lamp: 'put in a lantern', patch: 'sow',
  heal: 'dress a hurt with', dairy: 'milk into', ash: 'leach into lye', spin: 'spin', nail: 'smith into nails',
  ribbon: 'smith into ribbons',
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
  hive: ['hive', 'honey'],
};

/**
 * What a trade worked off a recipe at the stores wants there, read off the
 * recipes it tries: "a hide and a lye", or one of several such. A worker needs
 * no tool, so none is named. A smithing trade wants a lump of one of its metals.
 */
function recipeWants(kind: GatherKind): string {
  const lumps = smithLumps(kind);
  if (lumps.length) return listedOr(lumps.map((id) => countOf(id, 1, true)));
  const ids = STORE_RECIPES[kind] ?? STATION_TRADES[kind]?.recipes ?? (kind === 'ash' ? LYE_RECIPES : []);
  const recipes = ids.map((id) => RECIPE_BY_ID.get(id)).filter((r) => !!r);
  const bill = (r: (typeof recipes)[number]): string => listed(r!.inputs.map((i) => countOf(i.item, i.count ?? 1, true)));
  return listedOr(recipes.map(bill));
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
      // A magga with nothing lying about sorts the stores (`sortStack`), off a work post nothing but what lies about.
      if (kind === 'fetch') {
        const bins = `${itemDef('bulk_bin').name.toLowerCase()} or ${itemDef('craft_bin').name.toLowerCase()}`;
        return `Idle: nothing lying on the ground within ${n} tiles of ${idle.post ? 'its work post.' : `the totem; nothing in your settlement stores for a ${bins} with room.`}`;
      }
      return `Idle: no ${(kind && IDLE_SOURCE[kind]) ?? 'work of its task'} within ${n} tiles of ${idle.post ? 'its work post' : 'the totem'}.`;
    case 'stock': {
      // What the work in range wants, by name, and how many more past those: "no marble brick or glass".
      if (idle.what?.length) {
        const names = idle.what.map((id) => itemDef(id).name.toLowerCase());
        if (n > names.length) names.push(`${n - names.length} more`);
        return `Idle: no ${listedOr(names)} in your settlement stores.`;
      }
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
    case 'nospar':
      return 'Idle: no guard of yours on the settlement free to spar.';
    case 'yielded':
      return `Yielded: spars again above ${n} health.`;
    case 'season':
      return `Idle: ${SKEP_IDLE}, no honey until ${SEASONS[(SEASONS.indexOf(SKEP_IDLE) + 1) % SEASONS.length]}.`;
    case 'flowers':
      return `Idle: no wildflowers within ${n} tiles of its hive.`;
    case 'stairs':
      return `Idle: no stairs up to storey ${n}.`;
    case 'stranded':
      return `Idle: no stairs down from storey ${n}.`;
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

/* ---- Work done, in the log --------------------------------------------------- */

/**
 * What one worker finished in one settling of its work, by the item and its count: `stored` is what it put into
 * the settlement's stores (a load put away, honey and beeswax into its hive), `handled` what an errand took from its
 * arms. The same counts as its ledger (`ledger_add`).
 */
export interface WorkDone {
  stored?: Record<string, number>;
  handled?: Record<string, number>;
}

/** Things by the item, in item-id order: "12 × log, 3 × stone". */
const doneList = (things: Record<string, number> | undefined): string =>
  Object.entries(things ?? {}).filter(([, n]) => n > 0).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([id, n]) => `${n} × ${itemDef(id).name.toLowerCase()}`).join(', ');

/**
 * The Wildermon tab's line for a worker's finished work, to its keeper: "Snack: stored 12 × log; handled 4 × brick."
 * Empty for nothing done. The island's `work_done_line`, word for word.
 */
export function workDoneLine(name: string, did: WorkDone): string {
  const parts = [['stored', doneList(did.stored)], ['handled', doneList(did.handled)]].filter(([, s]) => s);
  return parts.length ? `${name}: ${parts.map(([k, s]) => `${k} ${s}`).join('; ')}.` : '';
}
