/**
 * The six home pieces (`decordefs.ts` holds their numbers): a sundial, a
 * compost bin, a stone lantern, a woven rug, curtains and an armour stand.
 * The island does every job (`decor_refusal`, `perform_decor`); what is here
 * says the same refusals in the same order, names the menus, and reads what
 * the island keeps.
 *
 * What the island keeps of a piece is in `placed.garden` (and `item.garden`
 * in the pack), the garden pieces' column, sent to every browser with the
 * ground read:
 *
 *   pattern   a woven rug's pattern, chosen at the loom;
 *   tints     a woven rug's second and third colours (its first is its dye);
 *   shut      curtains drawn;
 *   heap      what is in a compost bin: `n` things, their `ql`, and `at` the last went in (epoch seconds);
 *   worn      what is on an armour stand, slot by slot, as a body's gear goes over the wire (`WornWire`).
 *
 * The pieces on an armour stand are items of their own on the island
 * (`item.holder = 'stand'`, `item.placed` the stand), so a piece comes back
 * off it as it went on; `worn` is what every browser draws.
 */
import type { ActionDef, Target } from './actions';
import {
  ARMOUR_STAND, COMPOST, COMPOST_BIN, COMPOST_BOOST, COMPOST_DAYS, COMPOST_EMPTY_TIME, COMPOST_FILL_TIME, COMPOST_HOLDS, COMPOST_PER, COMPOST_SPOILED,
  COMPOST_TAKES, CURTAINS, DRESS_TIME, RUG_COLOURS, RUG_PATTERNS, SPREAD_COST, SPREAD_SKILL, SPREAD_TIME, STONE_LANTERN, STONE_LANTERN_REACH, SUNDIAL, SWAP_TIME,
  WOVEN_RUG, type RugPattern,
} from './decordefs';
import { furnitureCentre, furnitureDef, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { ARMOUR_SLOTS, isArmour, slotOf, SLOT_NAMES, type Slot } from './gear';
import { describeFrom, itemDef, type Item } from './items';
import { lampTooFar } from './lamps';
import { LAMP_CAST_ALPHA, LAMP_STRENGTH } from './lamps';
import { RUNESTONE_CAST, type LightSource } from './light';
import { DAY_SECONDS } from './pace';
import { STATE_TAILS } from './pieceTails';
import { lacks } from './ranks';
import { capital, listed, listedOr } from './words';
import { isHex } from './dyestuffs';
import { SEASON_DAYS, seasonAt } from '../world/calendar';
import { cropOf, planterOf } from './farming';
import type { WornWire } from './worn';

const DAY = DAY_SECONDS;
const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;
const wordOf = (id: string): string => (itemDef(id)?.name ?? id).toLowerCase();
const slotWord = (s: Slot): string => SLOT_NAMES[s].toLowerCase();

/* ---- what the island keeps --------------------------------------------------------------- */

/** What is in a compost bin: how many things, their QL, and when the last went in. */
export interface Heap { n: number; ql: number; at: number }

/** What a home piece holds and how it stands (`placed.garden`). */
export interface DecorState {
  pattern?: RugPattern;
  tints?: string[];
  shut?: boolean;
  heap?: Heap;
  worn?: WornWire;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The island's `garden` as this side keeps it for the home pieces, or undefined for none: only what is well formed. */
export function decorFrom(raw: unknown): DecorState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: DecorState = {};
  if ((RUG_PATTERNS as readonly unknown[]).includes(r.pattern)) out.pattern = r.pattern as RugPattern;
  if (Array.isArray(r.tints)) out.tints = r.tints.filter(isHex).slice(0, RUG_COLOURS - 1);
  if (r.shut === true) out.shut = true;
  const h = r.heap as Record<string, unknown> | undefined;
  if (h && typeof h === 'object' && isNum(h.n) && h.n > 0) out.heap = { n: h.n, ql: isNum(h.ql) ? h.ql : 1, at: isNum(h.at) ? h.at : 0 };
  if (r.worn && typeof r.worn === 'object') {
    const worn: WornWire = {};
    for (const slot of ARMOUR_SLOTS) {
      const v = (r.worn as Record<string, unknown>)[slot];
      if (Array.isArray(v) && typeof v[0] === 'string' && slotOf(v[0]) === slot) {
        worn[slot] = [v[0], isNum(v[1]) ? v[1] : 0, typeof v[2] === 'string' ? v[2] : null, typeof v[3] === 'string' ? v[3] : null];
      }
    }
    if (Object.keys(worn).length) out.worn = worn;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A rug's colours, first to last: its dye, then its tints. */
export const rugColours = (thing: { dye?: string | null; decor?: DecorState; tints?: string[] }): string[] =>
  [thing.dye, ...(thing.decor?.tints ?? thing.tints ?? [])].filter(isHex);

/* ---- the words --------------------------------------------------------------------------- */

/** The spoiled food and the rest a bin takes, as said. */
const takesWords = (): string => `food at ${COMPOST_SPOILED}% damage or more, ${listedOr(COMPOST_TAKES.map(wordOf))}`;

/** Every refusal, in the island's words (`decor_said`): `{slot}` is a slot's name, where the sentence wants it. */
export const DECOR_SAID = {
  binFull: `Compost bin: full, ${COMPOST_HOLDS} things.`,
  get nothingToCompost(): string { return `Nothing to compost: ${takesWords()}.`; },
  binReady: 'Compost ready: take it first.',
  binEmpty: 'Compost bin: empty.',
  notReady: `Not ready: compost ${days(COMPOST_DAYS)} after the last thing went in.`,
  noCrop: 'No crop there.',
  noCompost: `Need ${SPREAD_COST} ${wordOf(COMPOST)}.`,
  fed: `Already composted: next harvest QL +${COMPOST_BOOST}.`,
  rugFull: `Woven rug: ${RUG_COLOURS} colours. Remove the dye first.`,
  notYours: 'Not yours: armour stand.',
  noArmour: 'No armour in your pack for a free slot.',
  notArmour: 'Armour stand: armour only.',
  slotTaken: '{slot} slot taken.',
  slotEmpty: 'Nothing on that slot.',
  nothingToSwap: 'Nothing to swap: no armour on the stand or worn.',
};
export type DecorSaid = keyof typeof DECOR_SAID;
export const decorSaid = (key: DecorSaid, slot = ''): string => DECOR_SAID[key].replace('{slot}', capital(slot));

/** Why a worn piece stays on in a swap (`decor_kept`). */
export const KEPT_WHY = { armour: 'armour only', locked: 'locked' } as const;
export type KeptWhy = keyof typeof KEPT_WHY;

/**
 * What each job says done, in the island's words (`decor_done`): `{what}` a
 * thing, a clock, a season, slots; `{n}` and `{of}` counts.
 */
export const DECOR_DONE = {
  sundial: 'Sundial: {what}, {n} days of the season left.',
  filled: `Added: {what} ×{n}. Bin: {held} of {of}; compost ${days(COMPOST_DAYS)} after the last thing in.`,
  emptied: 'Taken: compost ×{n}.',
  spread: `Composted: {what}. Next harvest QL +${COMPOST_BOOST}.`,
  shut: 'Curtains: closed.',
  open: 'Curtains: open.',
  put: 'On the stand: {what}.',
  taken: 'Off the stand: {what}.',
  swapped: 'Swapped: {what}.',
  kept: 'Kept on: {what}.',
};
type DoneKey = keyof typeof DECOR_DONE;
/** A done line with its gaps filled. */
export const decorDone = (key: DoneKey, f: { what?: string; n?: number; held?: number; of?: number } = {}): string =>
  DECOR_DONE[key].replace('{what}', f.what ?? '').replace('{n}', String(f.n ?? '')).replace('{held}', String(f.held ?? '')).replace('{of}', String(f.of ?? ''));

/** What a sundial reads: the island's hour, and the days left in its season. */
export function sundialSays(clock: string, now: number): string {
  const s = seasonAt(now);
  return decorDone('sundial', { what: `${clock}, ${s.season}`, n: SEASON_DAYS - s.day });
}

/* ---- a stone lantern ---------------------------------------------------------------------- */

/** Its light, from the middle of its head: `STONE_LANTERN_REACH` tiles, steady, in the runes' pale gold at a lantern's warmth. */
export function stoneLanternLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: STONE_LANTERN_REACH, strength: LAMP_STRENGTH, steady: true, cast: RUNESTONE_CAST, castAlpha: LAMP_CAST_ALPHA };
}

/* ---- a compost bin ------------------------------------------------------------------------- */

/** Whether a thing goes in a compost bin: spoiled food, weeds, ash. The island's `compost_takes`. */
export const compostTakes = (it: Pick<Item, 'id' | 'dmg'>): boolean =>
  COMPOST_TAKES.includes(it.id) || (itemDef(it.id)?.category === 'food' && it.dmg >= COMPOST_SPOILED);
/** Whether what is in a bin is compost now. */
export const heapReady = (h: Heap | undefined, now: number): boolean => !!h && now - h.at >= COMPOST_DAYS * DAY;
/** Compost a heap of `n` things makes. */
export const compostOf = (n: number): number => Math.ceil(n / COMPOST_PER);

/* ---- an armour stand ------------------------------------------------------------------------ */

/** The slots a stand holds a piece in: one to every place armour is worn on a body (`ARMOUR_SLOTS`). */
export const STAND_SLOTS: readonly Slot[] = ARMOUR_SLOTS;
/** Why a piece would stay on in a swap, or null: armour only, and nothing locked. */
export const keptWhy = (it: Pick<Item, 'id' | 'locked'>): KeptWhy | null => (!isArmour(it.id) ? 'armour' : it.locked ? 'locked' : null);
/** Whether the stand is yours to change: whoever set it down, or a rank on its settlement that may use its crates. */
export const standNotYours = (g: Game, f: PlacedFurniture): string | null =>
  (f.mine !== false || g.storesOpenAt(f.x, f.y) ? null : lacks(g.deedOfMineAt(f.x, f.y), 'stores') ?? DECOR_SAID.notYours);
/** What is in your pack that would go on the stand: the one named, or the first armour piece for a free slot, carried before worn. */
export function toStand(g: Game, f: PlacedFurniture, t: Target): Item | undefined {
  const worn = f.decor?.worn ?? {};
  const uid = (t as { itemUid?: number }).itemUid;
  if (uid !== undefined) return g.inventory.get(uid);
  const free = g.inventory.items.filter((it) => isArmour(it.id) && !it.locked && !worn[slotOf(it.id) as Slot]);
  return free.find((it) => !g.isEquipped(it.uid)) ?? free[0];
}
/** A swap, slot by slot: what is changed, and what worn stays on and why. The island's `perform_decor` the same. */
export function swapPlan(g: Game, f: PlacedFurniture): { moved: Slot[]; kept: Array<{ id: string; why: KeptWhy }> } {
  const worn = f.decor?.worn ?? {};
  const moved: Slot[] = [];
  const kept: Array<{ id: string; why: KeptWhy }> = [];
  for (const slot of STAND_SLOTS) {
    const uid = g.player.equipped[slot];
    const on = uid !== null && uid !== undefined ? g.inventory.get(uid) : undefined;
    const why = on ? keptWhy(on) : null;
    if (on && why) {
      kept.push({ id: on.id, why });
      continue;
    }
    if (on || worn[slot]) moved.push(slot);
  }
  return { moved, kept };
}
/** What a swap says done. */
export const swapSaid = (plan: { moved: Slot[]; kept: Array<{ id: string; why: KeptWhy }> }): string =>
  [decorDone('swapped', { what: plan.moved.map(slotWord).join(', ') }),
    ...(plan.kept.length ? [decorDone('kept', { what: plan.kept.map((k) => `${wordOf(k.id)} (${KEPT_WHY[k.why]})`).join(', ') })] : [])].join(' ');

/* ---- the line under a piece's name ----------------------------------------------------------- */

/** What follows a home piece's quality on the line under its name. */
export function decorTail(f: PlacedFurniture, now = Date.now() / 1000): string {
  const d = f.decor;
  switch (f.kind) {
    case COMPOST_BIN: {
      const h = d?.heap;
      if (!h) return ` · empty (0 of ${COMPOST_HOLDS})`;
      return ` · ${h.n} of ${COMPOST_HOLDS} · ${heapReady(h, now) ? `compost ×${compostOf(h.n)} ready` : `compost ×${compostOf(h.n)} ${days(COMPOST_DAYS)} after the last thing in`}`;
    }
    case STONE_LANTERN: return ` · lights ${STONE_LANTERN_REACH} tiles at night, burns nothing`;
    case WOVEN_RUG: return ` · ${d?.pattern ?? RUG_PATTERNS[0]}`;
    case CURTAINS: return d?.shut ? ' · closed' : ' · open';
    case ARMOUR_STAND: {
      const on = STAND_SLOTS.filter((s) => d?.worn?.[s]).map((s) => wordOf(d?.worn?.[s]?.[0] ?? ''));
      return on.length ? ` · ${on.join(', ')}` : ' · empty';
    }
    default: return '';
  }
}
export const DECOR_PIECES: readonly string[] = [SUNDIAL, COMPOST_BIN, STONE_LANTERN, WOVEN_RUG, CURTAINS, ARMOUR_STAND];
STATE_TAILS.push((f) => (DECOR_PIECES.includes(f.kind) ? decorTail(f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const READ_SUNDIAL = 'read_sundial';
export const FILL_COMPOST = 'fill_compost';
export const EMPTY_COMPOST = 'empty_compost';
export const SPREAD_COMPOST = 'spread_compost';
export const DRAW_CURTAINS = 'draw_curtains';
export const STAND_PUT = 'stand_put';
export const STAND_TAKE = (s: Slot): string => `stand_take_${s}`;
export const STAND_SWAP = 'stand_swap';
/** Every job at a home piece, by id: the island's `decor_action`. */
export const DECOR_JOBS: readonly string[] = [
  READ_SUNDIAL, FILL_COMPOST, EMPTY_COMPOST, SPREAD_COMPOST, DRAW_CURTAINS, STAND_PUT, ...STAND_SLOTS.map(STAND_TAKE), STAND_SWAP,
];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, kind: string): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && f.kind === kind ? f : undefined;
};
const KIND_OF: Record<string, string> = {
  [READ_SUNDIAL]: SUNDIAL, [FILL_COMPOST]: COMPOST_BIN, [EMPTY_COMPOST]: COMPOST_BIN, [DRAW_CURTAINS]: CURTAINS, [STAND_PUT]: ARMOUR_STAND, [STAND_SWAP]: ARMOUR_STAND,
  ...Object.fromEntries(STAND_SLOTS.map((s) => [STAND_TAKE(s), ARMOUR_STAND])),
};
/** The thing in the pack a bin's Add would put in: the one named, if the bin takes it, or the first it takes. */
export function toCompost(g: Game, t: Target): Item | undefined {
  const uid = (t as { itemUid?: number }).itemUid;
  const named = uid !== undefined ? g.inventory.get(uid) : undefined;
  if (named && compostTakes(named) && !named.locked) return named;
  return g.inventory.items.find((it) => compostTakes(it) && !it.locked);
}

/**
 * Why a job at a home piece cannot be done now, or null: in the island's
 * order -- there, in reach, whose, and then the piece (`decor_refusal`).
 */
export function decorRefusal(g: Game, id: string, t: Target): string | null {
  if (id === SPREAD_COMPOST) {
    const box = planterOf(g, t);
    if (box && !g.besidePiece(box)) return 'Stand next to the planter.';
    const c = cropOf(g, t);
    if (!c) return DECOR_SAID.noCrop;
    if (g.inventory.count(COMPOST) < SPREAD_COST) return DECOR_SAID.noCompost;
    return c.fed ? DECOR_SAID.fed : null;
  }
  const f = pieceOf(g, t, KIND_OF[id] ?? '');
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(furnitureDef(f.kind).name.toLowerCase());
  const d = f.decor ?? {};
  const now = g.wallNow();
  if (id === FILL_COMPOST) {
    if (heapReady(d.heap, now)) return DECOR_SAID.binReady;
    if ((d.heap?.n ?? 0) >= COMPOST_HOLDS) return DECOR_SAID.binFull;
    return toCompost(g, t) ? null : DECOR_SAID.nothingToCompost;
  }
  if (id === EMPTY_COMPOST) {
    if (!d.heap) return DECOR_SAID.binEmpty;
    return heapReady(d.heap, now) ? null : DECOR_SAID.notReady;
  }
  if (f.kind === ARMOUR_STAND) {
    const mine = standNotYours(g, f);
    if (mine) return mine;
    if (id === STAND_PUT) {
      const it = toStand(g, f, t);
      if (!it) return DECOR_SAID.noArmour;
      if (keptWhy(it)) return DECOR_SAID.notArmour;
      const slot = slotOf(it.id) as Slot;
      return d.worn?.[slot] ? decorSaid('slotTaken', slotWord(slot)) : null;
    }
    if (id === STAND_SWAP) return swapPlan(g, f).moved.length ? null : DECOR_SAID.nothingToSwap;
    const slot = STAND_SLOTS.find((s) => id === STAND_TAKE(s));
    if (slot) return d.worn?.[slot] ? null : DECOR_SAID.slotEmpty;
  }
  return null;
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.01,
  ...o,
  check: (t, g) => decorRefusal(g, o.id, t),
  // The island's (`perform_decor`).
  perform: () => undefined,
});

export const DECOR_ACTIONS: ActionDef[] = [
  job({
    id: READ_SUNDIAL, label: 'Examine', verb: 'reading the sundial', instant: true, baseTime: 0, stamina: 0,
    applies: (t, g) => !!pieceOf(g, t, SUNDIAL),
  }),
  job({
    id: FILL_COMPOST, label: 'Add to compost', verb: 'filling the compost bin', baseTime: COMPOST_FILL_TIME,
    labelFor: (t, g) => {
      const it = toCompost(g, t);
      return it ? `Add ${wordOf(it.id)} to compost` : 'Add to compost';
    },
    applies: (t, g) => !!pieceOf(g, t, COMPOST_BIN),
  }),
  job({
    id: EMPTY_COMPOST, label: 'Take compost', verb: 'emptying the compost bin', baseTime: COMPOST_EMPTY_TIME, stamina: 0.02,
    applies: (t, g) => !!pieceOf(g, t, COMPOST_BIN)?.decor?.heap,
  }),
  job({
    id: SPREAD_COMPOST, label: 'Spread compost', verb: 'spreading compost', skill: SPREAD_SKILL, baseTime: SPREAD_TIME, stamina: 0.03,
    applies: (t, g) => !!cropOf(g, t) && g.inventory.has(COMPOST),
  }),
  job({
    id: DRAW_CURTAINS, label: 'Open or close', verb: 'drawing the curtains', instant: true, baseTime: 0, stamina: 0,
    labelFor: (t, g) => (pieceOf(g, t, CURTAINS)?.decor?.shut ? 'Open' : 'Close'),
    applies: (t, g) => !!pieceOf(g, t, CURTAINS),
  }),
  job({
    id: STAND_PUT, label: 'Put on stand', verb: 'dressing the stand', baseTime: DRESS_TIME,
    labelFor: (t, g) => {
      const f = pieceOf(g, t, ARMOUR_STAND);
      const it = f && toStand(g, f, t);
      return it ? `Put on stand: ${wordOf(it.id)}` : 'Put on stand';
    },
    applies: (t, g) => !!pieceOf(g, t, ARMOUR_STAND),
  }),
  ...STAND_SLOTS.map((s) => job({
    id: STAND_TAKE(s), label: `Take off ${slotWord(s)}`, verb: 'taking it off the stand', baseTime: DRESS_TIME,
    labelFor: (t, g) => {
      const on = pieceOf(g, t, ARMOUR_STAND)?.decor?.worn?.[s];
      return on ? `Take off ${wordOf(on[0])}` : `Take off ${slotWord(s)}`;
    },
    applies: (t, g) => !!pieceOf(g, t, ARMOUR_STAND)?.decor?.worn?.[s],
  })),
  job({
    id: STAND_SWAP, label: 'Swap with worn', verb: 'changing armour', baseTime: SWAP_TIME, stamina: 0.03,
    applies: (t, g) => !!pieceOf(g, t, ARMOUR_STAND),
  }),
];

/* ---- descriptions ------------------------------------------------------------------------ */

describeFrom(SUNDIAL, { clock: 'the island\'s hour', season: `days of the season left (of ${SEASON_DAYS})` });
describeFrom(COMPOST_BIN, {
  takes: takesWords(), holds: COMPOST_HOLDS, per: COMPOST_PER, days: days(COMPOST_DAYS), boost: COMPOST_BOOST,
});
describeFrom(STONE_LANTERN, { reach: STONE_LANTERN_REACH });
describeFrom(WOVEN_RUG, { patterns: listedOr([...RUG_PATTERNS]), colours: RUG_COLOURS });
describeFrom(ARMOUR_STAND, { slots: listed(STAND_SLOTS.map(slotWord)), n: STAND_SLOTS.length });
describeFrom(COMPOST, { boost: COMPOST_BOOST });
