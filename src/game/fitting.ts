/**
 * The fittings (`fittingdefs.ts` holds their numbers): a paper lantern pole,
 * a moss boulder, a tree bench, a spice shelf, a window seat, a training
 * dummy, an archery target, a mooring post and a stone bust. The island does
 * every job (`fitting_refusal`, `perform_fitting`); what is here says the
 * same refusals in the same order, names the menus, and reads what the
 * island keeps.
 *
 * What the island keeps of a piece is in `placed.garden` (and `item.garden`
 * in the pack), sent to every browser with the ground read:
 *
 *   tints   a pole's second and third lanterns' colours (its first is its dye), dyed as a woven rug is;
 *   keep    a moss boulder its owner keeps mossy: a scrubbing worker passes it by;
 *   jars    the herbs on a spice shelf: `[def, n]` each, as every browser draws them;
 *   stuck   arrows in an archery target;
 *   tied    the boat a mooring post holds, by its id;
 *   bust    the citizen a bust is carved as: `uid`, `name` and their `look`.
 *
 * A pole's candles are the piece's `fuel` and whether they burn its `lit`, as
 * a lantern post's are (`placed_fuel`, `placed_lit`). The herbs on a shelf and
 * the arrows in a target are items of their own on the island
 * (`item.holder = 'stand'`, `item.placed` the piece), as a side table's things.
 * A tree bench and a window seat are seats (`furnish.ts`, `sit_seat`).
 */
import type { ActionDef, Target } from './actions';
import {
  ARCHERY_TARGET, ARROW_BREAK_IN, BOULDER_MOSS_DAYS, CARVE_TIME, FIT_TIME, LANTERN_POLE, MOOR_REACH, MOOR_TIME, MOORING_POST, MOSS_BOULDER, POLE_LANTERNS, POLE_REACH,
  POLE_COLOURS_SAID, PRACTICE_GAIN, PRACTISE, PULL_TIME, SHELF_HOLDS, SHOOT_TARGET, SPICE_SHELF, STONE_BUST, TARGET_HOLDS, TRAINING_DUMMY, TREE_BENCH, WINDOW_SEAT,
} from './fittingdefs';
import { furnitureCentre, furnitureDef, isBoat, LIFT_REFUSALS, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { lampTooFar, LAMP_CAST, LAMP_CAST_ALPHA, LAMP_STRENGTH } from './lamps';
import { candleBurn, type LightSource } from './light';
import { flameNear, noFlameLine } from './lantern';
import { STATE_TAILS } from './pieceTails';
import { lacks } from './ranks';
import { capital, listed, listedOr, timeWords } from './words';
import { isHex } from './dyestuffs';
import { BOTANIZE_TABLE } from './forage';
import { WEAPON_BY_ID } from './gear';
import { SKILL_BY_ID } from './skills';
import { cleanLook, type Look } from './look';
import { TREE_AGES } from '../world/tiles';
import { SHOT_ARCHERY, SWING_ARM } from './creatureActions';
import { bowReach, nockedArrow } from './fight';

const wordOf = (id: string): string => (itemDef(id)?.name ?? id).toLowerCase();
const nameOf = (kind: string): string => furnitureDef(kind).name.toLowerCase();
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---- what the island keeps --------------------------------------------------------------- */

/** The citizen a bust is carved as. */
export interface Bust { uid: string; name: string; look: Look }

/** What a fitting holds and how it stands (`placed.garden`). */
export interface FittingState {
  tints?: string[];
  keep?: boolean;
  jars?: Array<[string, number]>;
  stuck?: number;
  tied?: number;
  bust?: Bust;
}

/** The island's `garden` as this side keeps it for the fittings, or undefined for none: only what is well formed. */
export function fittingFrom(raw: unknown): FittingState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: FittingState = {};
  if (Array.isArray(r.tints)) out.tints = r.tints.filter(isHex).slice(0, POLE_LANTERNS - 1);
  if (r.keep === true) out.keep = true;
  if (Array.isArray(r.jars)) {
    out.jars = r.jars.filter((j): j is unknown[] => Array.isArray(j) && isStr(j[0]) && isNum(j[1]) && j[1] > 0).map((j) => [j[0] as string, j[1] as number]);
  }
  if (isNum(r.stuck) && r.stuck > 0) out.stuck = r.stuck;
  if (isNum(r.tied)) out.tied = r.tied;
  const b = r.bust as Record<string, unknown> | undefined;
  if (b && typeof b === 'object' && isStr(b.uid) && isStr(b.name)) out.bust = { uid: b.uid, name: b.name, look: cleanLook(b.look) };
  return Object.keys(out).length ? out : undefined;
}

/* ---- a paper lantern pole ------------------------------------------------------------------ */

/** Its lanterns' colours, first to last: its dye, then its tints; a lantern not dyed is plain paper. */
export const poleColours = (thing: { dye?: string | null; fitting?: FittingState; tints?: string[] }): string[] =>
  [thing.dye, ...(thing.fitting?.tints ?? thing.tints ?? [])].filter(isHex);
/** Seconds the candles put in a pole burn: a candle's in a lantern of the pole's QL, the three alight at once. The island's `pole_burn`. */
export const poleBurn = (ql: number): number => Math.round(candleBurn(ql));
/** Whether its candles burn now. */
export const poleBurning = (f: PlacedFurniture): boolean => f.kind === LANTERN_POLE && !!f.lit && (f.fuel ?? 0) > 0;
/** Its light, from the middle of its lanterns: `POLE_REACH` tiles, steady, at a lantern's warmth. */
export function poleLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: POLE_REACH, strength: LAMP_STRENGTH, steady: true, cast: LAMP_CAST, castAlpha: LAMP_CAST_ALPHA };
}

/* ---- a moss boulder ------------------------------------------------------------------------ */

// The moss rule's days for a boulder, and what a scrub of one says, live with the rule (`greening.ts`).
export { BOULDER_AGAIN, BOULDER_NOTHING_YET, pieceGreenDays } from './greening';
/** Whether a scrubbing worker passes a piece by: a moss boulder its owner keeps mossy. */
export const mossKept = (f: PlacedFurniture): boolean => f.kind === MOSS_BOULDER && !!f.fitting?.keep;

/* ---- a tree bench -------------------------------------------------------------------------- */

/** The ages of a tree a bench goes round: grown and bearing (`TreeAge.bears`). */
export const BENCH_TREE_AGES = TREE_AGES.filter((a) => a.bears && a.alive);
export const benchTreeWords = (): string => listedOr(BENCH_TREE_AGES.map((a) => a.name.toLowerCase()));

/* ---- a spice shelf ------------------------------------------------------------------------- */

/** The herbs a shelf holds: what botanizing finds that is eaten. */
export const SHELF_HERBS: readonly string[] = BOTANIZE_TABLE.map(([id]) => id).filter((id) => itemDef(id)?.category === 'plant' && (itemDef(id)?.food ?? 0) > 0);
/** Herbs on a shelf. */
export const jarsHeld = (f: { fitting?: FittingState }): number => (f.fitting?.jars ?? []).reduce((n, [, k]) => n + k, 0);
/** The herb stack in the pack a Put on shelf would take from: the one named, or the first herb. */
export function toShelf(g: Game, t: Target): Item | undefined {
  const uid = (t as { itemUid?: number }).itemUid;
  if (uid !== undefined) return g.inventory.get(uid);
  return g.inventory.items.find((it) => SHELF_HERBS.includes(it.id) && !it.locked);
}

/* ---- a training dummy and an archery target -------------------------------------------------- */

/** A melee weapon in hand, for a dummy: not a bow, not bare hands. */
export function practiceWeapon(g: Game): Item | undefined {
  const held = g.worn('weapon');
  const w = held && WEAPON_BY_ID.get(held.id);
  return w && !w.ammo ? held : undefined;
}
/** A practice swing's gain to the weapon's skill, and a practice shot's to archery: a real fight's × `PRACTICE_GAIN`. */
export const practiceSwing = (): number => SWING_ARM * PRACTICE_GAIN;
export const practiceShot = (): number => SHOT_ARCHERY * PRACTICE_GAIN;

/* ---- a mooring post -------------------------------------------------------------------------- */

/** Whether a boat lies within `MOOR_REACH` tiles of a post: its tile against the post's. */
const inMoorReach = (post: PlacedFurniture, boat: PlacedFurniture): boolean =>
  Math.max(Math.abs(boat.x - post.x), Math.abs(boat.y - post.y)) <= MOOR_REACH;
/** The boat a Tie up would tie: the nearest within reach of the post, tied to no other post. */
export function boatToMoor(g: Game, post: PlacedFurniture): PlacedFurniture | undefined {
  return [...g.furniture.values()].filter((b) => isBoat(b) && inMoorReach(post, b) && !postOf(g, b))
    .sort((a, b) => Math.hypot(a.x - post.x, a.y - post.y) - Math.hypot(b.x - post.x, b.y - post.y) || a.id - b.id)[0];
}
/** The post a boat is tied to: one holding it, and it still within reach. */
export function postOf(g: Game, boat: PlacedFurniture): PlacedFurniture | undefined {
  for (const f of g.furniture.values()) if (f.kind === MOORING_POST && f.fitting?.tied === boat.id && inMoorReach(f, boat)) return f;
  return undefined;
}
/** Whether a boat is yours to move under a tie: whoever set it down, or a key to its padlock (the boat rules' own). The island's `may_moor`. */
export const mayMoor = (g: Game, boat: PlacedFurniture): boolean => boat.mine !== false || (boat.lock !== undefined && g.lockRefusal(boat) === null);
/** Why a tied boat is not yours to take the helm of or lift, or null. The island's `moored_refusal`. */
export const mooredRefusal = (g: Game, boat: PlacedFurniture): string | null =>
  (isBoat(boat) && postOf(g, boat) && !mayMoor(g, boat) ? FITTING_SAID.moored : null);
// Asked of a piece being lifted, after its padlock (`LIFT_REFUSALS`, the island's `fire_refusal`).
LIFT_REFUSALS.push(mooredRefusal);

/* ---- a stone bust ---------------------------------------------------------------------------- */

/** What a bust is labelled: "Bust of Mira". */
export const bustLabel = (b: Bust | undefined): string => (b ? `Bust of ${b.name}` : 'uncarved');

/* ---- the words --------------------------------------------------------------------------- */

/** Every refusal, in the island's words (`fitting_said`): `{name}` the piece's name, `{what}` a thing. */
export const FITTING_SAID = {
  candlesIn: 'Candles still in it.',
  noCandles: `Need ${POLE_LANTERNS} candles.`,
  noCandle: 'No candle in it.',
  lit: 'Already lit.',
  notLit: 'Not lit.',
  poleColours: POLE_COLOURS_SAID,
  keepNotYours: 'Only whoever set it down may mark it.',
  get noTree(): string { return `Needs a ${benchTreeWords()} tree on the tile.`; },
  benchRound: 'Tree bench round it: pick the bench up first.',
  notYours: 'Not yours: {name}.',
  shelfFull: `Spice shelf: full, ${SHELF_HOLDS} herbs.`,
  get noHerb(): string { return `Need a herb: ${listedOr(SHELF_HERBS.map(wordOf))}.`; },
  notHerb: 'Spice shelf: herbs only.',
  noJar: 'None on the shelf.',
  noWeapon: 'Wield a melee weapon.',
  noBow: 'You have no bow in your hands.',
  noArrows: 'Out of arrows.',
  outOfRange: 'Out of your bow\'s range.',
  targetFull: `Archery target: full, ${TARGET_HOLDS} arrows. Pull arrows first.`,
  noStuck: 'No arrows in it.',
  get notShore(): string { return 'At the water\'s edge only: water on its tile or beside it.'; },
  hasBoat: 'Already holds a boat: untie it first.',
  noBoat: `No boat within ${MOOR_REACH} tile.`,
  boatNotYours: 'Not yours to tie: {what}.',
  noTied: 'Nothing tied to it.',
  moored: 'Tied to a mooring post: whoever set it down, or its key.',
  bustNotYours: 'Only whoever set it down, or a citizen of its settlement, may carve it.',
  noDeed: 'Not on a settlement.',
  pickCitizen: 'Choose a citizen.',
  notCitizen: 'Not a citizen of {what}.',
  sameCitizen: 'Already {what}.',
};
export type FittingSaid = keyof typeof FITTING_SAID;
export const fittingSaid = (key: FittingSaid, f: { name?: string; what?: string } = {}): string =>
  FITTING_SAID[key].replaceAll('{name}', capital(f.name ?? '')).replaceAll('{what}', f.what ?? '');

/** What each job says done, in the island's words (`fitting_done`): `{what}` a thing, `{n}`, `{held}` and `{of}` counts. */
export const FITTING_DONE = {
  candles: `Candles in: ${POLE_LANTERNS}. Burns {what}.`,
  lit: `Lit from the {what}: light ${POLE_REACH} tiles at night.`,
  out: 'Put out. Candle left: {what}.',
  keep: 'Keep moss: on. Worker scrubs skip it.',
  unkeep: 'Keep moss: off.',
  shelfPut: 'On the shelf: {what} ×{n}. Shelf: {held} of {of}.',
  shelfTake: 'Off the shelf: {what} ×{n}.',
  practised: `Practised: {what}, skill gain ×${PRACTICE_GAIN} a fight's.`,
  shot: `Shot: {what}, archery gain ×${PRACTICE_GAIN} a fight's. Target: {held} of {of}.`,
  pulled: 'Pulled: arrows ×{n}; broken ×{held}.',
  tied: 'Tied up: {what}.',
  untied: 'Untied: {what}.',
  carved: 'Carved: bust of {what}.',
};
export type FittingDone = keyof typeof FITTING_DONE;
export const fittingDone = (key: FittingDone, f: { what?: string; n?: number; held?: number; of?: number } = {}): string =>
  FITTING_DONE[key].replace('{what}', f.what ?? '').replace('{n}', String(f.n ?? '')).replace('{held}', String(f.held ?? '')).replace('{of}', String(f.of ?? ''));

/* ---- the line under a piece's name ----------------------------------------------------------- */

/** What follows a fitting's quality on the line under its name. */
export function fittingTail(f: PlacedFurniture): string {
  const d = f.fitting;
  const out: string[] = [];
  const seats = furnitureDef(f.kind).seats ?? 0;
  if (seats) out.push(`seats ${seats}`);
  switch (f.kind) {
    case LANTERN_POLE: {
      const left = Math.max(0, f.fuel ?? 0);
      out.push(left <= 0 ? 'no candles' : `${timeWords(left)} of candle${poleBurning(f) ? `, lit: light ${POLE_REACH} tiles at night` : ', unlit'}`);
      break;
    }
    case MOSS_BOULDER: out.push(d?.keep ? 'moss kept' : 'moss scrubbed by workers'); break;
    case SPICE_SHELF: out.push(`${jarsHeld(f)} of ${SHELF_HOLDS} herbs${d?.jars?.length ? `: ${d.jars.map(([id, n]) => `${wordOf(id)} ×${n}`).join(', ')}` : ''}`); break;
    case ARCHERY_TARGET: out.push(`${d?.stuck ?? 0} of ${TARGET_HOLDS} arrows`); break;
    case MOORING_POST: out.push(d?.tied !== undefined ? 'a boat tied' : 'no boat'); break;
    case STONE_BUST: out.push(bustLabel(d?.bust)); break;
    default: break;
  }
  return out.length ? ` · ${out.join(' · ')}` : '';
}
export const FITTING_PIECES: readonly string[] = [
  LANTERN_POLE, MOSS_BOULDER, TREE_BENCH, SPICE_SHELF, WINDOW_SEAT, TRAINING_DUMMY, ARCHERY_TARGET, MOORING_POST, STONE_BUST,
];
STATE_TAILS.push((f) => (FITTING_PIECES.includes(f.kind) ? fittingTail(f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const POLE_CANDLES = 'pole_candles';
export const POLE_LIGHT = 'pole_light';
export const POLE_DOUSE = 'pole_douse';
export const KEEP_MOSS = 'keep_moss';
export const SHELF_PUT = 'shelf_put';
export const SHELF_TAKE = (herb: string): string => `shelf_take_${herb}`;
export { PRACTISE, SHOOT_TARGET };
export const PULL_ARROWS = 'pull_arrows';
export const MOOR_BOAT = 'moor_boat';
export const UNMOOR_BOAT = 'unmoor_boat';
export const CARVE_BUST = 'carve_bust';
/** Every job at a fitting, by id: the island's `fitting_action`. */
export const FITTING_JOBS: readonly string[] = [
  POLE_CANDLES, POLE_LIGHT, POLE_DOUSE, KEEP_MOSS, SHELF_PUT, ...SHELF_HERBS.map(SHELF_TAKE), PRACTISE, SHOOT_TARGET, PULL_ARROWS, MOOR_BOAT, UNMOOR_BOAT, CARVE_BUST,
];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, kind: string): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && f.kind === kind ? f : undefined;
};
/** The piece each job is done at, by its kind. */
const KIND_OF: Record<string, string> = {
  [POLE_CANDLES]: LANTERN_POLE, [POLE_LIGHT]: LANTERN_POLE, [POLE_DOUSE]: LANTERN_POLE, [KEEP_MOSS]: MOSS_BOULDER, [SHELF_PUT]: SPICE_SHELF,
  [PRACTISE]: TRAINING_DUMMY, [SHOOT_TARGET]: ARCHERY_TARGET, [PULL_ARROWS]: ARCHERY_TARGET, [MOOR_BOAT]: MOORING_POST, [UNMOOR_BOAT]: MOORING_POST, [CARVE_BUST]: STONE_BUST,
  ...Object.fromEntries(SHELF_HERBS.map((h) => [SHELF_TAKE(h), SPICE_SHELF])),
};

/** The bow in hand and its range, for a target. */
function bowInHand(g: Game): { item: Item; range: number } | undefined {
  const held = g.worn('weapon');
  const w = held && WEAPON_BY_ID.get(held.id);
  return held && w?.ammo ? { item: held, range: bowReach(g, w, held) } : undefined;
}

/**
 * Why a job at a fitting cannot be done now, or null: in the island's order
 * -- there, in reach, whose, and then the piece (`fitting_refusal`).
 */
export function fittingRefusal(g: Game, id: string, t: Target): string | null {
  const f = pieceOf(g, t, KIND_OF[id] ?? '');
  if (!f) return 'It is gone.';
  const d = f.fitting ?? {};
  // A target is shot at from anywhere in the bow's range; every other job beside the piece.
  if (id === SHOOT_TARGET) {
    const bow = bowInHand(g);
    if (!bow) return FITTING_SAID.noBow;
    const [cx, cy] = furnitureCentre(f);
    if (Math.hypot(cx - g.player.x, cy - g.player.y) > bow.range) return FITTING_SAID.outOfRange;
    if (!nockedArrow(g, (t as { arrow?: string }).arrow)) return FITTING_SAID.noArrows;
    return (d.stuck ?? 0) >= TARGET_HOLDS ? FITTING_SAID.targetFull : null;
  }
  if (!g.besidePiece(f)) return lampTooFar(nameOf(f.kind));
  switch (id) {
    case POLE_CANDLES:
      if ((f.fuel ?? 0) > 0) return FITTING_SAID.candlesIn;
      return g.inventory.count('candle') >= POLE_LANTERNS ? null : FITTING_SAID.noCandles;
    case POLE_LIGHT:
      if ((f.fuel ?? 0) <= 0) return FITTING_SAID.noCandle;
      if (f.lit) return FITTING_SAID.lit;
      return flameNear(g) ? null : noFlameLine();
    case POLE_DOUSE: return poleBurning(f) ? null : FITTING_SAID.notLit;
    case KEEP_MOSS: return f.mine === false ? FITTING_SAID.keepNotYours : null;
    case PRACTISE: return practiceWeapon(g) ? null : FITTING_SAID.noWeapon;
    case PULL_ARROWS: return (d.stuck ?? 0) > 0 ? null : FITTING_SAID.noStuck;
    case MOOR_BOAT: {
      if (d.tied !== undefined) {
        const tied = g.furniture.get(d.tied);
        if (tied && postOf(g, tied)?.id === f.id) return FITTING_SAID.hasBoat;
      }
      const boat = boatToMoor(g, f);
      if (!boat) return FITTING_SAID.noBoat;
      return mayMoor(g, boat) ? null : fittingSaid('boatNotYours', { what: nameOf(boat.kind) });
    }
    case UNMOOR_BOAT: {
      if (d.tied === undefined) return FITTING_SAID.noTied;
      const boat = g.furniture.get(d.tied);
      return f.mine !== false || !boat || mayMoor(g, boat) ? null : fittingSaid('boatNotYours', { what: nameOf(boat.kind) });
    }
    case CARVE_BUST: {
      if (f.mine === false && !g.onDeed(f.x, f.y)) return FITTING_SAID.bustNotYours;
      if (!g.deedOfMineAt(f.x, f.y) && !g.deedAt(f.x, f.y)) return FITTING_SAID.noDeed;
      const who = (t as { who?: string }).who;
      if (!who) return FITTING_SAID.pickCitizen;
      // Whether they are a citizen of it is the island's to know (`fitting_refusal`).
      return d.bust?.uid === who ? fittingSaid('sameCitizen', { what: d.bust.name }) : null;
    }
    default: break;
  }
  if (f.kind === SPICE_SHELF) {
    const mine = f.mine !== false || g.storesOpenAt(f.x, f.y) ? null : lacks(g.deedOfMineAt(f.x, f.y), 'stores') ?? fittingSaid('notYours', { name: nameOf(f.kind) });
    if (mine) return mine;
    if (id === SHELF_PUT) {
      if (jarsHeld(f) >= SHELF_HOLDS) return FITTING_SAID.shelfFull;
      const it = toShelf(g, t);
      if (!it) return FITTING_SAID.noHerb;
      return SHELF_HERBS.includes(it.id) && !it.locked ? null : FITTING_SAID.notHerb;
    }
    const herb = SHELF_HERBS.find((h) => id === SHELF_TAKE(h));
    if (herb) return (d.jars ?? []).some(([h]) => h === herb) ? null : FITTING_SAID.noJar;
  }
  return null;
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.01,
  ...o,
  check: (t, g) => fittingRefusal(g, o.id, t),
  // The island's (`perform_fitting`).
  perform: () => undefined,
});
const at = (kind: string) => (t: Target, g: Game): boolean => !!pieceOf(g, t, kind);

export const FITTING_ACTIONS: ActionDef[] = [
  job({ id: POLE_CANDLES, label: 'Put in candles', verb: 'setting candles', baseTime: FIT_TIME, applies: at(LANTERN_POLE) }),
  job({
    id: POLE_LIGHT, label: 'Strike a light', verb: 'lighting the lanterns', instant: true, baseTime: 0, stamina: 0,
    applies: (t, g) => { const f = pieceOf(g, t, LANTERN_POLE); return !!f && !f.lit && (f.fuel ?? 0) > 0; },
  }),
  job({ id: POLE_DOUSE, label: 'Put it out', verb: 'putting the lanterns out', instant: true, baseTime: 0, stamina: 0, applies: (t, g) => !!pieceOf(g, t, LANTERN_POLE)?.lit }),
  job({
    id: KEEP_MOSS, label: 'Keep moss', verb: 'marking the boulder', instant: true, baseTime: 0, stamina: 0,
    labelFor: (t, g) => (pieceOf(g, t, MOSS_BOULDER)?.fitting?.keep ? 'Let workers scrub it' : 'Keep moss'),
    applies: at(MOSS_BOULDER),
  }),
  job({
    // The menu offers it, a herb in the pack to a line (`Put on the shelf`).
    id: SHELF_PUT, label: 'Put on the shelf', verb: 'filling the spice shelf', baseTime: FIT_TIME, hidden: true, applies: at(SPICE_SHELF),
  }),
  ...SHELF_HERBS.map((h) => job({
    id: SHELF_TAKE(h), label: `Take ${wordOf(h)}`, verb: 'taking herbs off the shelf', baseTime: FIT_TIME,
    labelFor: (t, g) => {
      const n = pieceOf(g, t, SPICE_SHELF)?.fitting?.jars?.find(([id]) => id === h)?.[1] ?? 0;
      return `Take ${wordOf(h)} ×${n}`;
    },
    applies: (t, g) => !!pieceOf(g, t, SPICE_SHELF)?.fitting?.jars?.some(([id]) => id === h),
  })),
  job({ id: PRACTISE, label: 'Practise', verb: 'practising', skill: 'fighting', baseTime: 2.5, stamina: 0.07, applies: at(TRAINING_DUMMY) }),
  job({ id: SHOOT_TARGET, label: 'Shoot', verb: 'shooting at the target', skill: 'archery', baseTime: 2.6, stamina: 0.05, applies: at(ARCHERY_TARGET) }),
  job({ id: PULL_ARROWS, label: 'Pull arrows', verb: 'pulling arrows', baseTime: PULL_TIME, applies: (t, g) => !!pieceOf(g, t, ARCHERY_TARGET)?.fitting?.stuck }),
  job({
    id: MOOR_BOAT, label: 'Tie up', verb: 'tying up a boat', baseTime: MOOR_TIME, stamina: 0.02,
    labelFor: (t, g) => { const f = pieceOf(g, t, MOORING_POST); const b = f && boatToMoor(g, f); return b ? `Tie up ${nameOf(b.kind)}` : 'Tie up'; },
    applies: (t, g) => { const f = pieceOf(g, t, MOORING_POST); return !!f && f.fitting?.tied === undefined; },
  }),
  job({ id: UNMOOR_BOAT, label: 'Untie', verb: 'untying a boat', baseTime: MOOR_TIME, applies: (t, g) => pieceOf(g, t, MOORING_POST)?.fitting?.tied !== undefined }),
  job({
    // The menu offers it, a citizen to a line (`Carve`).
    id: CARVE_BUST, label: 'Carve', verb: 'carving a bust', skill: 'stonecutting', baseTime: CARVE_TIME, stamina: 0.03, hidden: true, applies: at(STONE_BUST),
  }),
];

/* ---- descriptions ------------------------------------------------------------------------ */

const seatWords = (kind: string): string => `Seats ${furnitureDef(kind).seats ?? 0}: Sit.`;
describeFrom(LANTERN_POLE, { n: POLE_LANTERNS, reach: POLE_REACH, burn: timeWords(poleBurn(50)), ql: 50 });
describeFrom(MOSS_BOULDER, { days: BOULDER_MOSS_DAYS });
describeFrom(TREE_BENCH, { seat: seatWords(TREE_BENCH), ages: benchTreeWords() });
describeFrom(SPICE_SHELF, { holds: SHELF_HOLDS, herbs: listed(SHELF_HERBS.map(wordOf)) });
describeFrom(WINDOW_SEAT, { seat: seatWords(WINDOW_SEAT) });
describeFrom(TRAINING_DUMMY, { gain: PRACTICE_GAIN });
describeFrom(ARCHERY_TARGET, { gain: PRACTICE_GAIN, holds: TARGET_HOLDS, breaks: ARROW_BREAK_IN });
describeFrom(MOORING_POST, { reach: plural(MOOR_REACH, 'tile', 'tiles') });
/** The skill a weapon's practice teaches, by name, for the help: its family's. */
export const practiceSkillWords = (): string => listed([...new Set([...WEAPON_BY_ID.values()].filter((w) => !w.ammo).map((w) => (SKILL_BY_ID.get(w.kind)?.name ?? w.kind).toLowerCase()))]);
