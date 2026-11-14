/**
 * The furnishings (`furnishdefs.ts` holds their numbers): a birdbath, a stone
 * bench, a garden swing, a gazebo, a hay bale stack, a water trough, a
 * signpost, a cairn, a fireplace, a four-poster bed, a vase, a side table, a
 * footstool and a trophy fish mount. The island does every job
 * (`furnish_refusal`, `perform_furnish`); what is here says the same refusals
 * in the same order, names the menus, and reads what the island keeps.
 *
 * What the island keeps of a piece is in `placed.garden` (and `item.garden`
 * in the pack), sent to every browser with the ground read:
 *
 *   hay     mixed grass left in a hay bale stack (unsaid: full, `HAY_HOLDS`);
 *   ate     when each wildermon last ate from it, by its id (epoch seconds);
 *   drank   when each wildermon last drank from a water trough, by its id;
 *   arms    a signpost's arms: `t` (`stone` or `deed`), `id`, `name` and the point it names (`x`, `y`);
 *   vase    wildflowers in a vase: `n`, `ql`, and `at` the last went in;
 *   on      what is on a side table, as every browser draws it: `[def, ql, dye]` each;
 *   fish    the fish on a trophy mount: `def`, `kg`, `ql`, `by` (who mounted it).
 *
 * A cairn's name is the placed row's `engraving`, as a memorial stone's line
 * is. The things on a side table are items of their own on the island
 * (`item.holder = 'stand'`, `item.placed` the table), as an armour stand's.
 * Seats are sat in by a timed job (`sit_seat`): while it runs the island gives
 * the stamina back that standing still does (`body_settle`), a garden swing's
 * `SWING_REST` times that.
 */
import type { ActionDef, Target } from './actions';
import {
  BIRDBATH, CAIRN, CAIRN_NAME_MAX, CAIRN_NAME_TIME, FIREPLACE, FIREPLACE_REACH, FISH_KG_STEP, FISH_MOUNT, FISH_SIZE_LEAST, FISH_SIZE_PER, FOOTSTOOL, FOUR_POSTER,
  GARDEN_SWING, GAZEBO, HAY, HAY_A_DAY, HAY_BALE, HAY_FILL_TIME, HAY_HOLDS, HAY_REACH, PUT_TIME, SIDE_TABLE, SIGN_ARMS, SIGNPOST, SIT_TIME,
  STONE_BENCH, SWING_REST, TABLE_HOLDS, TROUGH_CARE, TROUGH_DRINK, TROUGH_HOLDS, TROUGH_REACH, TROUGH_WATER_ONLY, VASE, VASE_FLOWER, VASE_FRESH, VASE_HOLDS, WATER_TROUGH,
} from './furnishdefs';
import { furnitureCentre, furnitureDef, isFurniture, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { lampTooFar } from './lamps';
import { DAY_SECONDS } from './pace';
import { STATE_TAILS } from './pieceTails';
import { lacks } from './ranks';
import { capital, listed, timeWords } from './words';
import { isHex } from './dyestuffs';
import { isFish } from './fishing';
import { SPECIES } from './creatures';
import { cleanLine } from './chat';
import { hasRunestones, RUNESTONES, stonePoint } from './runestones';
import { bearingTo, pointName } from './tracking';
import { BIRDS_AWAY } from './gardendefs';
import { INDOORS_DECAY } from './building';
import { STORE_REACH } from './limits';
import { OBSIDIAN_VASE } from './obsidiandefs';

const DAY = DAY_SECONDS;
const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;
const wordOf = (id: string): string => (itemDef(id)?.name ?? id).toLowerCase();
const nameOf = (kind: string): string => furnitureDef(kind).name.toLowerCase();
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/* ---- what the island keeps --------------------------------------------------------------- */

/** One arm of a signpost: what it names and the point it is measured to. */
export interface Arm { t: 'stone' | 'deed'; id: string; name: string; x: number; y: number }
/** Wildflowers in a vase: how many, their QL, and when the last went in. */
export interface Posy { n: number; ql: number; at: number }
/** The fish on a trophy mount. */
export interface Mounted { def: string; kg: number; ql: number; by: string }

/** What a furnishing holds and how it stands (`placed.garden`). */
export interface FurnishState {
  hay?: number;
  arms?: Arm[];
  vase?: Posy;
  on?: Array<[string, number, string | null]>;
  fish?: Mounted;
}

/** The island's `garden` as this side keeps it for the furnishings, or undefined for none: only what is well formed. */
export function furnishFrom(raw: unknown): FurnishState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: FurnishState = {};
  if (isNum(r.hay)) out.hay = Math.max(0, r.hay);
  if (Array.isArray(r.arms)) {
    out.arms = r.arms.filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .filter((a) => (a.t === 'stone' || a.t === 'deed') && isStr(a.id) && isStr(a.name) && isNum(a.x) && isNum(a.y))
      .slice(0, SIGN_ARMS).map((a) => ({ t: a.t as Arm['t'], id: a.id as string, name: a.name as string, x: a.x as number, y: a.y as number }));
  }
  const v = r.vase as Record<string, unknown> | undefined;
  if (v && typeof v === 'object' && isNum(v.n) && v.n > 0) out.vase = { n: v.n, ql: isNum(v.ql) ? v.ql : 1, at: isNum(v.at) ? v.at : 0 };
  if (Array.isArray(r.on)) {
    out.on = r.on.filter((o): o is unknown[] => Array.isArray(o) && isStr(o[0])).slice(0, TABLE_HOLDS)
      .map((o) => [o[0] as string, isNum(o[1]) ? o[1] : 1, isStr(o[2]) && isHex(o[2]) ? o[2] : null]);
  }
  const f = r.fish as Record<string, unknown> | undefined;
  if (f && typeof f === 'object' && isStr(f.def) && isFish(f.def)) out.fish = { def: f.def, kg: isNum(f.kg) ? f.kg : 0, ql: isNum(f.ql) ? f.ql : 1, by: isStr(f.by) ? f.by : '' };
  return Object.keys(out).length ? out : undefined;
}

/* ---- the rules --------------------------------------------------------------------------- */

/** Bodies a piece seats, or nought for one that is no seat (`FurnitureDef.seats`). */
export const seatsOf = (kind: string): number => furnitureDef(kind).seats ?? 0;
/** Stamina back while sat in it, × standing still's. */
export const seatRest = (kind: string): number => (kind === GARDEN_SWING ? SWING_REST : 1);
/** Mixed grass left in a hay bale stack: unsaid, full. */
export const hayLeft = (f: { furnish?: FurnishState }): number => f.furnish?.hay ?? HAY_HOLDS;
/** Whether a piece is a vase, by the vase's rule: the clay one and an obsidian one (`obsidian.ts`). */
export const isVase = (kind: string): boolean => kind === VASE || kind === OBSIDIAN_VASE;
/**
 * Why a seat is not yours to sit in, asked after its room: rules that live
 * elsewhere put theirs here (an obsidian throne its settlement's founder's:
 * `obsidian.ts`). The island's `furnish_refusal`.
 */
export const SEAT_REFUSALS: Array<(g: Game, f: PlacedFurniture) => string | null> = [];
/** Whether wildflowers in a vase are still fresh. */
export const posyFresh = (p: Posy | undefined, now: number): boolean => !!p && now - p.at < VASE_FRESH * DAY;
/** A fish's weight on a mount, kg, by its kind and QL: the island's `fish_kg`. */
export const fishKg = (def: string, ql: number): number =>
  Math.floor((itemDef(def).weight * (FISH_SIZE_LEAST + ql * FISH_SIZE_PER)) / FISH_KG_STEP + 0.5) * FISH_KG_STEP;
/** A weight as the mount says it. */
export const kgWords = (kg: number): string => `${kg.toFixed(2)} kg`;
/** What a mount's fish is labelled: "Pike, 3.45 kg, by Mira". */
export const fishLabel = (m: Mounted): string => `${capital(wordOf(m.def))}, ${kgWords(m.kg)}, by ${m.by}`;
/** The species that eat mixed grass: what a hay bale stack feeds. */
export const grassEaters = (): string[] => Object.values(SPECIES).filter((s) => s.diet.includes(HAY)).map((s) => s.name);

/** A signpost arm's reading from the post at (px, py): its bearing to the point of the compass and in degrees, and its distance in tiles. */
export function armReading(px: number, py: number, a: Pick<Arm, 'x' | 'y'>): { point: string; deg: number; tiles: number } {
  const b = bearingTo(px, py, a.x, a.y);
  return { point: pointName(8, Math.floor(b / 45 + 0.5) % 8), deg: Math.floor(b + 0.5) % 360, tiles: Math.floor(Math.hypot(a.x - px, a.y - py) + 0.5) };
}
/** An arm as the post says it: "Harrowmark: north-east, 47°, 312 tiles". The island's `arm_words`. */
export const armWords = (name: string, r: { point: string; deg: number; tiles: number }): string => `${name}: ${r.point}, ${r.deg}°, ${r.tiles} tiles`;
/** A post's own point: the middle of its tile. */
export const postAt = (f: { x: number; y: number }): [number, number] => [f.x + 0.5, f.y + 0.5];

/** Where every arm of a post may point, on a world `size` across: the Runestones, and the settlements named. */
export function destinations(size: number, deeds: ReadonlyArray<{ name: string; x: number; y: number }>): Arm[] {
  const stones: Arm[] = hasRunestones(size) ? RUNESTONES.map((s) => ({ t: 'stone', id: s.id, name: s.name, ...stonePoint(s, size) })) : [];
  return [...stones, ...deeds.map((d): Arm => ({ t: 'deed', id: `${d.x},${d.y}`, name: d.name, x: d.x + 0.5, y: d.y + 0.5 }))];
}
/** A destination as the island is asked for it (`Target.dest`). */
export const destKey = (a: Pick<Arm, 't' | 'id'>): string => `${a.t}:${a.id}`;

/* ---- the words --------------------------------------------------------------------------- */

/** Every refusal, in the island's words (`furnish_said`): `{name}` the piece's name, `{n}` a count, `{what}` a thing. */
export const FURNISH_SAID = {
  seatsFull: '{name}: {n} of {n} seats taken.',
  hayFull: `Hay bale stack: full, ${HAY_HOLDS} mixed grass.`,
  get noHay(): string { return `Need ${wordOf(HAY)}.`; },
  troughWater: TROUGH_WATER_ONLY,
  armsFull: `Signpost: ${SIGN_ARMS} arms. Take one down first.`,
  noDest: 'No such settlement or Runestone.',
  armThere: 'An arm already points there.',
  noArm: 'No arm there.',
  noName: 'Name is empty.',
  sameName: 'Already named that.',
  notYours: 'Not yours: {name}.',
  vaseFull: `Vase: full, ${VASE_HOLDS} wildflowers.`,
  wilted: 'Vase: wilted. Take them out first.',
  get noFlowers(): string { return `Need ${wordOf(VASE_FLOWER)}.`; },
  vaseEmpty: 'Vase: empty.',
  tableFull: `Side table: full, ${TABLE_HOLDS} things.`,
  pick: 'Choose a thing from your pack.',
  notOnTable: 'Not on a side table: furniture, worn, locked or holding things.',
  slotEmpty: 'Nothing there.',
  noFish: 'No fish in your pack.',
  otherKind: 'Mount holds {what}: {what} only.',
  notBigger: 'Not bigger: {what} on the mount.',
  mountNotYours: 'Only whoever set it down may change the fish on it.',
  cairnNotYours: 'Only whoever set it down, or a citizen of its settlement, may name it.',
  mountEmptyNotYours: 'Only whoever set it down, or a citizen of its settlement, may mount a fish.',
};
export type FurnishSaid = keyof typeof FURNISH_SAID;
export const furnishSaid = (key: FurnishSaid, f: { name?: string; n?: number; what?: string } = {}): string =>
  FURNISH_SAID[key].replaceAll('{name}', capital(f.name ?? '')).replaceAll('{n}', String(f.n ?? '')).replaceAll('{what}', f.what ?? '');

/** What each job says done, in the island's words (`furnish_done`): `{what}` a thing, `{n}`, `{held}` and `{of}` counts. */
export const FURNISH_DONE = {
  up: 'Got up: {what}.',
  hay: 'Added: mixed grass ×{n}. Stack: {held} of {of}.',
  arm: 'Arm {n}: {what}.',
  armDown: 'Arm taken down: {what}.',
  read: 'Signpost: {what}.',
  bare: 'Signpost: no arms.',
  named: 'Cairn: “{what}”.',
  posy: `Vase: wildflowers ×{held} of {of}, fresh ${days(VASE_FRESH)}.`,
  posyTaken: 'Taken: wildflowers ×{n}.',
  posyGone: 'Wilted, thrown out: wildflowers ×{n}.',
  put: 'On the table: {what}.',
  taken: 'Off the table: {what}.',
  mounted: 'Mounted: {what}.',
};
export type FurnishDone = keyof typeof FURNISH_DONE;
export const furnishDone = (key: FurnishDone, f: { what?: string; n?: number; held?: number; of?: number } = {}): string =>
  FURNISH_DONE[key].replace('{what}', f.what ?? '').replace('{n}', String(f.n ?? '')).replace('{held}', String(f.held ?? '')).replace('{of}', String(f.of ?? ''));

/** What a signpost's Examine says: every arm, read from the post. */
export function signpostSays(f: PlacedFurniture): string {
  const arms = f.furnish?.arms ?? [];
  if (!arms.length) return furnishDone('bare');
  const [px, py] = postAt(f);
  return furnishDone('read', { what: arms.map((a) => armWords(a.name, armReading(px, py, a))).join('; ') });
}

/* ---- the line under a piece's name ----------------------------------------------------------- */

/** What follows a furnishing's quality on the line under its name. */
export function furnishTail(f: PlacedFurniture, now = Date.now() / 1000): string {
  const d = f.furnish;
  const seats = seatsOf(f.kind);
  const out: string[] = [];
  if (seats) out.push(`seats ${seats}${seatRest(f.kind) !== 1 ? `, stamina ×${seatRest(f.kind)}` : ''}`);
  switch (f.kind) {
    case HAY_BALE: out.push(`${hayLeft(f)} of ${HAY_HOLDS} mixed grass`); break;
    case SIGNPOST: {
      const arms = d?.arms ?? [];
      const [px, py] = postAt(f);
      out.push(arms.length ? arms.map((a) => armWords(a.name, armReading(px, py, a))).join('; ') : 'no arms');
      break;
    }
    case CAIRN: out.push(f.engraving ? `“${f.engraving}”` : 'unnamed'); break;
    case VASE: case OBSIDIAN_VASE: {
      const p = d?.vase;
      out.push(!p ? 'empty' : posyFresh(p, now) ? `wildflowers ×${p.n}, fresh` : `wildflowers ×${p.n}, wilted`);
      break;
    }
    case SIDE_TABLE: {
      const on = d?.on ?? [];
      out.push(on.length ? on.map((o) => wordOf(o[0])).join(', ') : 'empty');
      break;
    }
    case FISH_MOUNT: out.push(d?.fish ? fishLabel(d.fish) : 'empty'); break;
    case FIREPLACE: out.push(`lights ${FIREPLACE_REACH} tiles while lit`); break;
    default: break;
  }
  return out.length ? ` · ${out.join(' · ')}` : '';
}
export const FURNISH_PIECES: readonly string[] = [
  BIRDBATH, STONE_BENCH, GARDEN_SWING, GAZEBO, HAY_BALE, WATER_TROUGH, SIGNPOST, CAIRN, FIREPLACE, FOUR_POSTER, VASE, SIDE_TABLE, FOOTSTOOL, FISH_MOUNT,
];
STATE_TAILS.push((f) => (FURNISH_PIECES.includes(f.kind) || f.kind === OBSIDIAN_VASE ? furnishTail(f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const SIT_SEAT = 'sit_seat';
export const FILL_HAY = 'fill_hay';
export const POINT_ARM = 'point_arm';
export const DROP_ARM = (i: number): string => `drop_arm_${i}`;
export const READ_SIGNPOST = 'read_signpost';
export const NAME_CAIRN = 'name_cairn';
export const VASE_PUT = 'vase_put';
export const VASE_TAKE = 'vase_take';
export const TABLE_PUT = 'table_put';
export const TABLE_TAKE = (i: number): string => `table_take_${i}`;
export const MOUNT_FISH = 'mount_fish';
const ARM_SLOTS = Array.from({ length: SIGN_ARMS }, (_, i) => i);
const TABLE_SLOTS = Array.from({ length: TABLE_HOLDS }, (_, i) => i);
/** Every job at a furnishing, by id: the island's `furnish_action`. */
export const FURNISH_JOBS: readonly string[] = [
  SIT_SEAT, FILL_HAY, POINT_ARM, ...ARM_SLOTS.map(DROP_ARM), READ_SIGNPOST, NAME_CAIRN, VASE_PUT, VASE_TAKE, TABLE_PUT, ...TABLE_SLOTS.map(TABLE_TAKE), MOUNT_FISH,
];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, is: (kind: string) => boolean): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && is(f.kind) ? f : undefined;
};
const kindIs = (kind: string) => (k: string): boolean => k === kind;
/** The piece each job is done at, by its kind. */
const KIND_OF: Record<string, (kind: string) => boolean> = {
  [SIT_SEAT]: (k) => seatsOf(k) > 0, [FILL_HAY]: kindIs(HAY_BALE), [POINT_ARM]: kindIs(SIGNPOST), [READ_SIGNPOST]: kindIs(SIGNPOST), [NAME_CAIRN]: kindIs(CAIRN),
  [VASE_PUT]: isVase, [VASE_TAKE]: isVase, [TABLE_PUT]: kindIs(SIDE_TABLE), [MOUNT_FISH]: kindIs(FISH_MOUNT),
  ...Object.fromEntries(ARM_SLOTS.map((i) => [DROP_ARM(i), kindIs(SIGNPOST)])),
  ...Object.fromEntries(TABLE_SLOTS.map((i) => [TABLE_TAKE(i), kindIs(SIDE_TABLE)])),
};

/** Those sat in a seat besides you: anybody beside it sitting (`sit_seat`), as this machine sees them. */
export function sittersBeside(g: Game, f: PlacedFurniture): number {
  const [cx, cy] = furnitureCentre(f);
  return g.roster.list().filter((p) => p.act === SIT_SEAT && Math.hypot(p.x - cx, p.y - cy) <= STORE_REACH).length;
}
/** Whether a table is yours to change: whoever set it down, or a rank on its settlement that may use its crates (the armour stand's rule). */
const tableNotYours = (g: Game, f: PlacedFurniture): string | null =>
  (f.mine !== false || g.storesOpenAt(f.x, f.y) ? null : lacks(g.deedOfMineAt(f.x, f.y), 'stores') ?? furnishSaid('notYours', { name: nameOf(f.kind) }));
/** Whether a thing goes on a side table: carried, not a piece of furniture, not worn, not locked, holding nothing. */
export const onTableOk = (g: Game, it: Item): boolean => !it.locked && !g.isEquipped(it.uid) && !isFurniture(it.id) && !it.inside?.length;
/** The fish in the pack a Mount would put up: the one named, or the heaviest the mount takes. */
export function toMount(g: Game, f: PlacedFurniture, t: Target): Item | undefined {
  const uid = (t as { itemUid?: number }).itemUid;
  if (uid !== undefined) return g.inventory.get(uid);
  const held = f.furnish?.fish;
  return g.inventory.items.filter((it) => isFish(it.id) && !it.locked && (!held || it.id === held.def))
    .sort((a, b) => fishKg(b.id, b.ql) - fishKg(a.id, a.ql) || a.uid - b.uid)[0];
}

/**
 * Why a job at a furnishing cannot be done now, or null: in the island's
 * order -- there, in reach, whose, and then the piece (`furnish_refusal`).
 */
export function furnishRefusal(g: Game, id: string, t: Target): string | null {
  const f = pieceOf(g, t, KIND_OF[id] ?? (() => false));
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(nameOf(f.kind));
  const d = f.furnish ?? {};
  const now = g.wallNow();
  if (id === SIT_SEAT) {
    const n = seatsOf(f.kind);
    if (sittersBeside(g, f) >= n) return furnishSaid('seatsFull', { name: nameOf(f.kind), n });
    for (const why of SEAT_REFUSALS) {
      const no = why(g, f);
      if (no) return no;
    }
    return null;
  }
  if (id === FILL_HAY) {
    if (hayLeft(f) >= HAY_HOLDS) return FURNISH_SAID.hayFull;
    return g.inventory.items.some((it) => it.id === HAY && !it.locked) ? null : FURNISH_SAID.noHay;
  }
  if (id === POINT_ARM) {
    const want = (t as { dest?: string }).dest ?? '';
    const arms = d.arms ?? [];
    if (arms.length >= SIGN_ARMS) return FURNISH_SAID.armsFull;
    if (arms.some((a) => destKey(a) === want)) return FURNISH_SAID.armThere;
    const known = destinations(g.world.w, g.neighbourDeeds);
    // A settlement farther off than the ground read brings is the island's to know: only what this machine has never heard of is refused here.
    return want.startsWith('deed:') || known.some((a) => destKey(a) === want) ? null : FURNISH_SAID.noDest;
  }
  const arm = ARM_SLOTS.find((i) => id === DROP_ARM(i));
  if (arm !== undefined) return (d.arms ?? [])[arm] ? null : FURNISH_SAID.noArm;
  if (id === NAME_CAIRN) {
    if (f.mine === false && !g.onDeed(f.x, f.y)) return FURNISH_SAID.cairnNotYours;
    const asked = (t as { name?: unknown }).name;
    if (typeof asked !== 'string') return null;
    const text = cleanLine(asked, CAIRN_NAME_MAX);
    if (!text) return FURNISH_SAID.noName;
    return text === f.engraving ? FURNISH_SAID.sameName : null;
  }
  if (id === VASE_PUT) {
    if (d.vase && !posyFresh(d.vase, now)) return FURNISH_SAID.wilted;
    if ((d.vase?.n ?? 0) >= VASE_HOLDS) return FURNISH_SAID.vaseFull;
    return g.inventory.items.some((it) => it.id === VASE_FLOWER && !it.locked) ? null : FURNISH_SAID.noFlowers;
  }
  if (id === VASE_TAKE) return d.vase ? null : FURNISH_SAID.vaseEmpty;
  if (f.kind === SIDE_TABLE) {
    const mine = tableNotYours(g, f);
    if (mine) return mine;
    if (id === TABLE_PUT) {
      if ((d.on ?? []).length >= TABLE_HOLDS) return FURNISH_SAID.tableFull;
      const uid = (t as { itemUid?: number }).itemUid;
      const it = uid !== undefined ? g.inventory.get(uid) : undefined;
      if (!it) return FURNISH_SAID.pick;
      return onTableOk(g, it) ? null : FURNISH_SAID.notOnTable;
    }
    const slot = TABLE_SLOTS.find((i) => id === TABLE_TAKE(i));
    if (slot !== undefined) return (d.on ?? [])[slot] ? null : FURNISH_SAID.slotEmpty;
  }
  if (id === MOUNT_FISH) {
    const held = d.fish;
    if (!held && f.mine === false && !g.onDeed(f.x, f.y)) return FURNISH_SAID.mountEmptyNotYours;
    if (held && f.mine === false) return FURNISH_SAID.mountNotYours;
    const it = toMount(g, f, t);
    if (!it || !isFish(it.id)) return FURNISH_SAID.noFish;
    if (held && it.id !== held.def) return furnishSaid('otherKind', { what: wordOf(held.def) });
    if (held && fishKg(it.id, it.ql) <= held.kg) return furnishSaid('notBigger', { what: `${wordOf(held.def)}, ${kgWords(held.kg)}` });
    return null;
  }
  return null;
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.01,
  ...o,
  check: (t, g) => furnishRefusal(g, o.id, t),
  // The island's (`perform_furnish`).
  perform: () => undefined,
});

export const FURNISH_ACTIONS: ActionDef[] = [
  job({
    id: SIT_SEAT, label: 'Sit', verb: 'sitting', baseTime: SIT_TIME, stamina: 0,
    labelFor: (t, g) => {
      const f = pieceOf(g, t, (k) => seatsOf(k) > 0);
      return f ? `Sit (${sittersBeside(g, f)} of ${seatsOf(f.kind)})` : 'Sit';
    },
    applies: (t, g) => !!pieceOf(g, t, (k) => seatsOf(k) > 0),
  }),
  job({
    id: FILL_HAY, label: 'Add mixed grass', verb: 'stacking hay', baseTime: HAY_FILL_TIME, stamina: 0.02,
    applies: (t, g) => !!pieceOf(g, t, kindIs(HAY_BALE)),
  }),
  job({
    // The menu offers it, a destination to a line (`Point an arm`), rather than the generic one.
    id: POINT_ARM, label: 'Point an arm', verb: 'pointing an arm', baseTime: PUT_TIME, hidden: true,
    applies: (t, g) => !!pieceOf(g, t, kindIs(SIGNPOST)),
  }),
  ...ARM_SLOTS.map((i) => job({
    id: DROP_ARM(i), label: `Take down arm ${i + 1}`, verb: 'taking an arm down', baseTime: PUT_TIME,
    labelFor: (t, g) => {
      const a = pieceOf(g, t, kindIs(SIGNPOST))?.furnish?.arms?.[i];
      return a ? `Take down arm: ${a.name}` : `Take down arm ${i + 1}`;
    },
    applies: (t, g) => !!pieceOf(g, t, kindIs(SIGNPOST))?.furnish?.arms?.[i],
  })),
  job({
    id: READ_SIGNPOST, label: 'Examine', verb: 'reading the signpost', instant: true, baseTime: 0, stamina: 0,
    applies: (t, g) => !!pieceOf(g, t, kindIs(SIGNPOST)),
  }),
  {
    ...job({
      id: NAME_CAIRN, label: 'Name', verb: 'naming the cairn', baseTime: CAIRN_NAME_TIME, stamina: 0.02,
      labelFor: (t, g) => (pieceOf(g, t, kindIs(CAIRN))?.engraving ? 'Rename' : 'Name'),
      applies: (t, g) => !!pieceOf(g, t, kindIs(CAIRN)),
    }),
    asks: {
      question: `Cairn name: up to ${CAIRN_NAME_MAX} characters.`,
      fallback: (t, g) => pieceOf(g, t, kindIs(CAIRN))?.engraving ?? '',
      declined: 'Left unchanged.',
      max: CAIRN_NAME_MAX,
    },
  },
  job({
    id: VASE_PUT, label: 'Put in wildflowers', verb: 'arranging flowers', baseTime: PUT_TIME,
    applies: (t, g) => !!pieceOf(g, t, isVase),
  }),
  job({
    id: VASE_TAKE, label: 'Take out wildflowers', verb: 'emptying the vase', baseTime: PUT_TIME,
    labelFor: (t, g) => {
      const f = pieceOf(g, t, isVase);
      return f?.furnish?.vase && !posyFresh(f.furnish.vase, g.wallNow()) ? 'Throw out wilted wildflowers' : 'Take out wildflowers';
    },
    applies: (t, g) => !!pieceOf(g, t, isVase)?.furnish?.vase,
  }),
  job({
    // The menu offers it, a thing in the pack to a line (`Put on the table`).
    id: TABLE_PUT, label: 'Put on the table', verb: 'setting it on the table', baseTime: PUT_TIME, hidden: true,
    applies: (t, g) => !!pieceOf(g, t, kindIs(SIDE_TABLE)),
  }),
  ...TABLE_SLOTS.map((i) => job({
    id: TABLE_TAKE(i), label: `Take off ${i + 1}`, verb: 'taking it off the table', baseTime: PUT_TIME,
    labelFor: (t, g) => {
      const o = pieceOf(g, t, kindIs(SIDE_TABLE))?.furnish?.on?.[i];
      return o ? `Take ${wordOf(o[0])}` : `Take off ${i + 1}`;
    },
    applies: (t, g) => !!pieceOf(g, t, kindIs(SIDE_TABLE))?.furnish?.on?.[i],
  })),
  job({
    id: MOUNT_FISH, label: 'Mount a fish', verb: 'mounting a fish', baseTime: PUT_TIME * 2,
    labelFor: (t, g) => {
      const f = pieceOf(g, t, kindIs(FISH_MOUNT));
      const it = f && toMount(g, f, t);
      return it && isFish(it.id) ? `Mount ${wordOf(it.id)} (${kgWords(fishKg(it.id, it.ql))})` : 'Mount a fish';
    },
    applies: (t, g) => !!pieceOf(g, t, kindIs(FISH_MOUNT)),
  }),
];

/* ---- descriptions ------------------------------------------------------------------------ */

/** A seat's line: how many, and what sitting gives. */
const seatWords = (kind: string): string =>
  `Seats ${seatsOf(kind)}. Sit: ${timeWords(SIT_TIME)}, stamina back ×${seatRest(kind)} standing still's.`;
describeFrom(BIRDBATH, { away: listed([...BIRDS_AWAY]) });
describeFrom(STONE_BENCH, { seat: seatWords(STONE_BENCH) });
describeFrom(GARDEN_SWING, { seat: seatWords(GARDEN_SWING) });
describeFrom(GAZEBO, { seat: seatWords(GAZEBO), decay: INDOORS_DECAY });
describeFrom(FOOTSTOOL, { seat: seatWords(FOOTSTOOL) });
describeFrom(HAY_BALE, { holds: HAY_HOLDS, reach: HAY_REACH, aday: HAY_A_DAY, eaters: listed(grassEaters()) });
describeFrom(WATER_TROUGH, { holds: TROUGH_HOLDS, reach: TROUGH_REACH, drink: TROUGH_DRINK, care: TROUGH_CARE });
describeFrom(SIGNPOST, { arms: SIGN_ARMS });
describeFrom(CAIRN, { max: CAIRN_NAME_MAX });
describeFrom(FIREPLACE, { reach: FIREPLACE_REACH });
describeFrom(VASE, { holds: VASE_HOLDS, fresh: days(VASE_FRESH) });
describeFrom(SIDE_TABLE, { holds: TABLE_HOLDS });
describeFrom(FISH_MOUNT, { least: FISH_SIZE_LEAST, per: FISH_SIZE_PER });
