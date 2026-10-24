import type { ActionDef, Target } from './actions';
import { isDone, progressOf, type Bill } from './building';
import { takeUnit, toHand } from './buildstock';
import type { Game } from './game';
import { greenNow } from './greening';
import { lacks } from './ranks';
import { itemDef } from './items';
import { fill } from './words';
import { metres } from '../world/tiles';
import { MATERIAL_BY_ID, WALL_HEIGHT, type Side } from './building';
import { AQUEDUCT_FLOW, CHANNEL_WIDE, TILE_METRES } from '../world/aqueducts';

/**
 * Bridges.
 *
 * Water and ravines have been walls until now: the map is full of places you
 * can see across and cannot get to. A bridge is a run of deck between two
 * pieces of solid ground at much the same height, standing over whatever is
 * in between, and once it is finished it is simply ground — you walk it, you
 * ride it, and depending on what it is made of you drive a cart over it.
 *
 * Three kinds. A **rope bridge** is two hawsers and a plank walkway: cheap,
 * quick, long, and nothing with wheels is going over it. A **wooden bridge**
 * is a proper trestle and carries a cart. A **stone arch** is the work of a
 * season and carries anything at all, further than either.
 */

/**
 * The wall materials a bridge is built of, one kind each: their storeys and
 * heft say how long, how far between piers and how high (`materialBridge`).
 * Not stained glass, nor the two ornate stones.
 */
export const BRIDGE_MATERIALS = ['log', 'plank', 'timbercraft', 'cobblestone', 'slate', 'marble', 'sandstone', 'stone_brick', 'clay_adobe', 'clay_bricks'] as const;
export type MaterialBridgeKind = (typeof BRIDGE_MATERIALS)[number];
export type BridgeKind = 'rope' | 'aqueduct' | 'draw' | MaterialBridgeKind;
export const isMaterialBridge = (kind: string): kind is MaterialBridgeKind => (BRIDGE_MATERIALS as readonly string[]).includes(kind);

/** A material bridge's longest run of deck past its material's storeys, in tiles: the island's `bridge_def.span`. */
export const BRIDGE_REACH = 4;
/** And a bay (one arch, or one beam between two piers) past its heft, in tiles. */
export const BAY_PAST_HEFT = 1;
/** How many lanes wide a material bridge may be planned, and from how many wagons and furniture go on it. */
export const WIDEST = 3;
export const WAGON_WIDTH = 2;
export const STALL_WIDTH = 3;
/** The work a material bridge asks of its trade: a timber one's, and a step harder each grade of heft past timber. */
const BRIDGE_DIFFICULTY = 30;
const DIFFICULTY_PER_HEFT = 7;

/**
 * gates: how near the middle of one of its two end tiles a body stands to
 * pull a bridge down, in tiles. The island's `bridge_pull_reach`, which the
 * parity test holds to this.
 */
export const PULL_REACH = 4.5;

export interface BridgeDef {
  id: BridgeKind;
  name: string;
  /** What one tile of deck takes, a lane: a material bridge's is a solid wall's of its material. */
  bill: Array<[string, number]>;
  /** The longest gap it will span, in tiles of deck. */
  span: number;
  /** Tool and trade it is built with. */
  tool: 'mallet' | 'trowel';
  skill: 'carpentry' | 'masonry';
  difficulty: number;
  /** Wheels may cross it. */
  carts: boolean;
  /**
   * What the first tile of deck takes over the rest: a drawbridge's hinges,
   * and the gallows, winch and chains that raise it, all at the end it is set
   * out from (`gates.ts`).
   */
  winch?: Array<[string, number]>;
  /** Both ends on the ground: a drawbridge, which lands on no storey. */
  grounded?: boolean;
  /** A material bridge's wall material (`MATERIALS`), and of that: */
  material?: MaterialBridgeKind;
  /** a bay, in tiles: one arch, or one beam between two piers; */
  bay?: number;
  /** the deepest drop from its deck to the ground under it, in height units; */
  deepest?: number;
  /** its material's storeys, which that is; and whether it is stone (`MaterialDef.kind`): mossed, and a Mason's. */
  storeys?: number;
  stone?: boolean;
  note: string;
}

/**
 * A stone arch as it was before bridges were built by material: what an
 * aqueduct's span is still built as (`CHANNEL_LINING` on top), and its name
 * in what the past said.
 */
export const STONE_ARCH = {
  name: 'Stone arch',
  bill: [['stone_brick', 40], ['mortar', 20], ['stone_slab', 6]] as Array<[string, number]>,
  span: 8,
  tool: 'trowel' as const,
  skill: 'masonry' as const,
  difficulty: 44,
};

/** A material bridge, off its wall material: every number in it is the material's. */
function materialBridge(id: MaterialBridgeKind): BridgeDef {
  const m = MATERIAL_BY_ID.get(id)!;
  const span = m.storeys + BRIDGE_REACH;
  const bay = m.heft + BAY_PAST_HEFT;
  const deepest = m.storeys * WALL_HEIGHT;
  return {
    id,
    name: `${m.name} bridge`,
    bill: m.bill.map(([item, n]) => [item, n]),
    span,
    tool: m.tool,
    skill: m.skill,
    difficulty: BRIDGE_DIFFICULTY + DIFFICULTY_PER_HEFT * (m.heft - 1),
    carts: true,
    material: id,
    bay,
    deepest,
    storeys: m.storeys,
    stone: m.kind === 'stone',
    note: `Max length: ${span} tiles. Bay: ${bay} tiles. Max drop: ${metres(deepest)} m (${m.storeys} storeys). `
      + `Per pier: a lane's bill per storey of drop. Carts cross; wagons from ${WAGON_WIDTH} lanes; furniture on the outer lanes at ${STALL_WIDTH}.`,
  };
}

export const BRIDGES: Record<BridgeKind, BridgeDef> = {
  rope: {
    id: 'rope',
    name: 'Rope bridge',
    bill: [['thick_rope', 6], ['plank', 12], ['nail', 8]],
    span: 14,
    tool: 'mallet',
    skill: 'carpentry',
    difficulty: 18,
    carts: false,
    note: 'Longest span: {span} tiles. Foot traffic only.',
  },
  ...(Object.fromEntries(BRIDGE_MATERIALS.map((id) => [id, materialBridge(id)])) as Record<MaterialBridgeKind, BridgeDef>),
  /*
   * A stone arch whose deck is a water channel (`./aqueducts`). Set out from
   * the basin it pours into rather than thrown from a bank, so it is not
   * among what "Throw a bridge across" offers; nobody walks it.
   */
  aqueduct: {
    id: 'aqueduct',
    name: 'Aqueduct',
    bill: [],
    span: 8,
    tool: 'trowel',
    skill: 'masonry',
    difficulty: 44,
    carts: false,
    note: '',
  },
  /*
   * A plank deck hinged at the end it is set out from, where a gallows and a
   * winch stand to haul it up on two chains (`gates.ts`). Down, it is a
   * bridge; up, it stands on end over its hinge and nothing crosses.
   */
  draw: {
    id: 'draw',
    name: 'Drawbridge',
    bill: [['plank', 24], ['timber', 8], ['nail', 24]],
    span: 2,
    tool: 'mallet',
    skill: 'carpentry',
    difficulty: 34,
    carts: true,
    winch: [['timber', 6], ['hinge', 4], ['ribbon', 8]],
    grounded: true,
    note: 'First span also needs {winch.timber} timbers, {winch.hinge} hinges and {winch.ribbon} metal ribbons. Both ends outdoors on open ground, at most {span} tiles of deck. Raised or lowered from the end it was set out from, by anyone its padlock admits (anyone, unlocked); pulled down by the same within {reach} tiles of either end, on a settlement by its builders only. Raised: blocks crossing and sight over its hinge. Lowered: carts may cross.',
  },
};

/** The kinds "Throw a bridge across" offers, in the order it offers them: rope, the materials, the drawbridge. */
export const THROWN: BridgeKind[] = ['rope', ...BRIDGE_MATERIALS, 'draw'];

/**
 * What an aqueduct's channel adds to a span of stone arch: the slabs it is
 * lined with and the mortar they are bedded in. Its span, its trade and how
 * hard it is are the stone arch's own.
 */
export const CHANNEL_LINING: Array<[string, number]> = [['mortar', 10], ['stone_slab', 4]];
{
  const a = BRIDGES.aqueduct;
  const s = STONE_ARCH;
  const bill = new Map(s.bill);
  for (const [id, n] of CHANNEL_LINING) bill.set(id, (bill.get(id) ?? 0) + n);
  // Named in the order the island names them, so a span says what it wants the same way on both sides.
  a.bill = [...bill.entries()].sort(([x], [y]) => (x < y ? -1 : 1));
  a.span = s.span;
  a.tool = s.tool;
  a.skill = s.skill;
  a.difficulty = s.difficulty;
  a.note = `Channel ${CHANNEL_WIDE * TILE_METRES} m wide: ${AQUEDUCT_FLOW} litres/min of spring water from the pond or pool at its head to the basin at its foot. Not walkable.`;
}

// A bridge's note counts what it is made of off its own bill: `{bill.thick_rope:W}`, and a drawbridge's winch off its own.
for (const b of Object.values(BRIDGES)) b.note = fill(b.note, { ...b, bill: Object.fromEntries(b.bill), winch: Object.fromEntries(b.winch ?? []), reach: PULL_REACH });

/* ---- bays and piers ------------------------------------------------------------------- */

/**
 * The bays a material bridge's deck is carried in, in tiles, end a's first:
 * as many as a bay of its material takes to cover the deck, all the same
 * length, which need not be whole tiles (three tiles at a bay of two are two
 * bays of one and a half). One bay for anything else. The island's
 * `bridge_bays`.
 */
export function bridgeBays(n: number, bay: number | undefined): number[] {
  if (!bay || n <= 0) return n > 0 ? [n] : [];
  const k = Math.ceil(n / bay);
  return new Array<number>(k).fill(n / k);
}

/**
 * The tiles of deck, counted from nought at end a, that carry a pier: one
 * between every two bays, at `j * n / k` tiles along, on the tile that point
 * is in -- and on a point between two tiles, the tile before it. The
 * island's `bridge_piers`.
 */
export function pierSpans(n: number, bay: number | undefined): number[] {
  if (!bay || n <= 0) return [];
  const k = Math.ceil(n / bay);
  const out: number[] = [];
  // ceil(j * n / k) - 1, in whole numbers.
  for (let j = 1; j < k; j++) out.push(Math.floor((j * n - 1) / k));
  return out;
}

/** How many storeys of drop a pier stands down, off its deck's drop: what it is billed by. The island's `pier_storeys`. */
export const pierStoreys = (drop: number): number => Math.max(1, Math.ceil(drop / WALL_HEIGHT));

/* ---- lanes ------------------------------------------------------------------------------ */

/** How many lanes wide a bridge is. */
export const bridgeWidth = (b: { width?: number }): number => b.width ?? 1;

/**
 * The lanes of a bridge, as how far each is off the line it was set out
 * along, across it: that line alone at one; it and the next on the side it
 * was given (`side`, toward the east or the south for one, the west or the
 * north for less) at two; it and one either side at three. The island's
 * `bridge_lanes`.
 */
export function laneOffsets(width = 1, side = 1): number[] {
  if (width >= 3) return [-1, 0, 1];
  if (width === 2) return [0, side < 0 ? -1 : 1];
  return [0];
}

/** Across a bridge's run, a step: south for one running east and west, east for one running north and south. */
export const across = (ax: number, ay: number): ((bx: number, by: number) => [number, number]) => (bx, by) => (ay === by && ax !== bx ? [0, 1] : [1, 0]);
export const laneStep = (b: { ax: number; ay: number; bx: number; by: number }): [number, number] => across(b.ax, b.ay)(b.bx, b.by);

/** Which side a second lane is laid on, as a compass side: what the planning menu offers. */
export const laneSide = (ax: number, ay: number, bx: number, by: number, side: number): Side => {
  const [px] = across(ax, ay)(bx, by);
  return px ? (side < 0 ? 'w' : 'e') : side < 0 ? 'n' : 's';
};
/** And back: a compass side to the step it is, nought for one not across the run. */
export const sideStep = (ax: number, ay: number, bx: number, by: number, side: Side | undefined): number => {
  const [px] = across(ax, ay)(bx, by);
  if (px) return side === 'w' ? -1 : side === 'e' ? 1 : 0;
  return side === 'n' ? -1 : side === 's' ? 1 : 0;
};

/** Every tile of a bridge's deck, every lane: where it is, its lane's offset and how far along it is from end a (nought the first). */
export function deckTiles(b: Bridge): Array<{ x: number; y: number; o: number; i: number }> {
  const [px, py] = laneStep(b);
  const out: Array<{ x: number; y: number; o: number; i: number }> = [];
  for (const o of laneOffsets(bridgeWidth(b), b.side)) b.spans.forEach((s, i) => out.push({ x: s.x + o * px, y: s.y + o * py, o, i }));
  return out;
}

/** Every end tile of a bridge, every lane's: which end (nought for a, one for b) and its lane's offset. */
export function endTiles(b: Pick<Bridge, 'ax' | 'ay' | 'bx' | 'by' | 'width' | 'side'>): Array<{ x: number; y: number; end: 0 | 1; o: number }> {
  const [px, py] = laneStep(b);
  const out: Array<{ x: number; y: number; end: 0 | 1; o: number }> = [];
  for (const o of laneOffsets(bridgeWidth(b), b.side)) {
    out.push({ x: b.ax + o * px, y: b.ay + o * py, end: 0, o }, { x: b.bx + o * px, y: b.by + o * py, end: 1, o });
  }
  return out;
}

/** The lane a tile of a bridge's deck or ends is in, as its offset, or null where it is not on it. */
export function laneOf(b: Bridge, x: number, y: number): number | null {
  const [px, py] = laneStep(b);
  for (const o of laneOffsets(bridgeWidth(b), b.side)) {
    const cx = x - o * px, cy = y - o * py;
    if ((cx === b.ax && cy === b.ay) || (cx === b.bx && cy === b.by) || b.spans.some((s) => s.x === cx && s.y === cy)) return o;
  }
  return null;
}

/** Whether wheels of this kind may cross a bridge: a cart where carts cross, a wagon only from `WAGON_WIDTH` lanes. The island's `deck_wheels`. */
export const bridgeWheels = (b: Bridge, vehicle: string): boolean =>
  !!BRIDGES[b.kind]?.carts && (vehicle !== 'wagon' || bridgeWidth(b) >= WAGON_WIDTH);

/**
 * Whether a piece set down on this tile of a bridge's deck goes on the deck:
 * on either outer lane of a material bridge `STALL_WIDTH` lanes wide.
 * Anywhere else under a deck it goes on the ground under it.
 */
export function deckLane(b: Bridge, x: number, y: number): boolean {
  if (!isMaterialBridge(b.kind) || bridgeWidth(b) < STALL_WIDTH) return false;
  const o = laneOf(b, x, y);
  return o !== null && o !== 0;
}

/**
 * Why a piece of furniture may not be set down on this tile of a bridge's
 * deck, or under it, or null where it may: on the deck of an outer lane of a
 * finished material bridge `STALL_WIDTH` lanes wide (`deckLane`); anywhere
 * else on the ground under the deck, `over` over it there, at `HEAD_ROOM`
 * or more. The island's `bridge_furniture_refusal`.
 */
export function deckFurnitureRefusal(b: Bridge, x: number, y: number, over: number): string | null {
  if (deckLane(b, x, y)) return bridgeDone(b) ? null : 'Bridge deck not finished.';
  if (over >= HEAD_ROOM) return null;
  return `Under a bridge deck: needs ${metres(HEAD_ROOM)} m clearance.`;
}

export interface BridgeSpan extends Bill {
  x: number;
  y: number;
}

export interface Bridge {
  id: number;
  kind: BridgeKind;
  /** The two ends, on solid ground. Axis aligned: one of the pairs matches. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Height the deck is carried at: on a ramp, at the middle of its length (`deckHeight`). */
  height: number;
  /**
   * A ramp's: how much higher its deck is at end b than at end a, rising
   * evenly along its length (`deckHeight`). Nought or none for a level deck.
   */
  rise?: number;
  /** The storey end b lands on, where it is not end a's (`level`): a ramp from one storey to another. */
  levelB?: number | null;
  /**
   * The storey its two ends meet, and the storey you walk it on.
   *
   * Nought for a bridge between two banks, which is every bridge there was.
   * A bridge may land on a finished floor instead, and then both ends are that
   * storey of their buildings and the deck is walked at that storey — which is
   * how two towers get a walkway between them rather than a staircase down,
   * a path across the yard and a staircase up.
   */
  level?: number;
  material?: string;
  /** One entry per tile of deck between the ends, in order: the line it was set out along, whatever its width. */
  spans: BridgeSpan[];
  /** How many lanes wide (`laneOffsets`): one when unsaid. */
  width?: number;
  /** At two lanes, which side of the line it was set out along the second is laid: 1 toward the east or the south, -1 the west or the north. */
  side?: number;
  /**
   * When the moss on a stone arch began, in real seconds: when its last span
   * was decked or it was last scrubbed. See `greening.ts`.
   */
  greenSince?: number;
  /** A drawbridge drawn up on its hinge: no deck to cross, and its hinge shut (`gates.ts`). */
  raised?: boolean;
  /** The padlock on a drawbridge's winch, by the number it shares with its key (`locks.ts`). */
  lock?: number;
}

export const bridgeDef = (b: Bridge): BridgeDef => BRIDGES[b.kind] ?? BRIDGES.rope;
export const bridgeName = (b: Bridge): string =>
  b.material ? `${bridgeDef(b).name} (${b.material.toLowerCase()})` : bridgeDef(b).name;
/** Finished when every tile of deck is. */
export const bridgeDone = (b: Bridge): boolean => b.spans.every(isDone);

/** The span of a bridge or an aqueduct that is worked: the first still open, as a builder works it from one end. The island's `bridge_span` lowest `n` not `span_done`. */
export const openSpan = (b: Bridge): BridgeSpan | undefined => b.spans.find((x) => !isDone(x));

/**
 * One piece of `id` into a bridge's open span, as a go of "Work on the bridge"
 * fits it, without the builder's skill, tool or words: the bill comes down by
 * one, and the last span decked starts the moss on it (`greening.ts`). A hod
 * carrier's piece goes in the same way (`Game.fitPiece`). An aqueduct's is
 * `fitIntoChannel` (`./aqueducts`).
 */
export function fitIntoSpan(g: Game, b: Bridge, s: BridgeSpan, id: string): void {
  s.needed[id] = Math.max(0, (s.needed[id] ?? 0) - 1);
  // Open, and bare: the moss on a stone arch starts from here (`greening.ts`).
  if (bridgeDone(b)) b.greenSince = greenNow();
  g.events.emit('world', s.x, s.y);
}
export const bridgeProgress = (b: Bridge): number =>
  b.spans.length ? b.spans.reduce((n, s) => n + progressOf(s), 0) / b.spans.length : 1;

/** The tiles a bridge's deck covers, ends excluded. */
export function spanTiles(ax: number, ay: number, bx: number, by: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const dx = Math.sign(bx - ax);
  const dy = Math.sign(by - ay);
  if (dx !== 0 && dy !== 0) return out;
  let x = ax + dx;
  let y = ay + dy;
  while (x !== bx || y !== by) {
    out.push([x, y]);
    x += dx;
    y += dy;
  }
  return out;
}

/**
 * One tile of deck, unbuilt: its bill once a lane, the first also a
 * drawbridge's winch, and one that carries a pier its bill again for every
 * storey that pier stands down (`pierStoreys`). The island's `span_bill`.
 */
export const spanBill = (kind: BridgeKind, first = false, width = 1, pier = 0): Bill => {
  const needed: Record<string, number> = {};
  for (const [id, n] of BRIDGES[kind].bill) needed[id] = n * (width + pier);
  if (first) for (const [id, n] of BRIDGES[kind].winch ?? []) needed[id] = (needed[id] ?? 0) + n;
  return { needed, total: { ...needed } };
};

/** How much under a deck counts as a gap worth bridging. */
export const CLEARANCE = 3;
/** How high a deck must stand over the ground for a body, or a piece of furniture, to stand under it: 2 m. The island's `head_room`. */
export const HEAD_ROOM = 20;
/**
 * How far apart the two ends may be in height and still carry one deck. Two
 * natural banks are rarely level, so there is some give in it; past this the
 * deck would meet one end and hang over the other.
 */
export const END_SLOP = 12;

/**
 * Ramps. Past `END_SLOP` between its ends a deck is not carried level: it
 * rises evenly from one end to the other, so long as it rises no more than
 * this many height units for every tile of deck between them. That is how a
 * bridge links a storey to the storey above or below it. A drawbridge, whose
 * deck stands on end over its hinge, is carried level. The island's
 * `ramp_slope`.
 */
export const RAMP_SLOPE = 15;

/** How many tiles of deck a climb of `apart` height units wants, at `RAMP_SLOPE` a tile. */
export const rampTiles = (apart: number): number => Math.ceil(Math.abs(apart) / RAMP_SLOPE);

/** The rise of a deck between ends at these heights: nought within `END_SLOP`, where it is carried level. The island's `ramp_rise`. */
export const rampRise = (ha: number, hb: number): number => (Math.abs(hb - ha) > END_SLOP ? Math.round(hb - ha) : 0);

/**
 * The height of a deck `s` tiles along it from the edge of end a's tile, of
 * `n` tiles of deck carried at `height` in its middle and rising `rise` from
 * end a's edge to end b's. The island's `ramp_deck`.
 */
export const rampDeck = (height: number, rise: number, n: number, s: number): number =>
  rise ? height + rise * (Math.min(1, Math.max(0, s / n)) - 0.5) : height;

/** The storeys a bridge's two ends land on, end a's first. */
export const bridgeLevels = (b: Bridge): [number, number] => [b.level ?? 0, b.levelB ?? b.level ?? 0];

/** The height of a bridge's deck at a point over it: its `height` all the way across a level one, and up its slope on a ramp. */
export function deckHeight(b: Bridge, x: number, y: number): number {
  if (!b.rise) return b.height;
  const s = b.ay === b.by ? (b.bx > b.ax ? x - (b.ax + 1) : b.ax - x) : (b.by > b.ay ? y - (b.ay + 1) : b.ay - y);
  return rampDeck(b.height, b.rise, b.spans.length, s);
}

/** What a body's storey is called in what is said of a bridge's ends. */
const storeyNamed = (level: number): string => (level ? `storey ${level + 1}` : 'the ground');

/**
 * Why a ramp may not climb from one end to the other over so few tiles: how
 * far apart they are, how many tiles that wants at `RAMP_SLOPE`, and how many
 * it has. The island's `ramp_refusal`.
 */
export function rampRefusal(la: number, lb: number, apart: number, n: number): string {
  const ends = la !== lb ? ` (${storeyNamed(la)} to ${storeyNamed(lb)})` : '';
  return `Ends ${metres(apart)} m apart in height${ends}. Max rise ${metres(RAMP_SLOPE)} m/tile: needs ${rampTiles(apart)} tiles of deck; has ${n}.`;
}

/**
 * Where a bridge set out goes, as it is said when it is: the storeys its ends
 * land on, if either is off the ground, and a ramp's rise from the end it was
 * set out from. The island's `bridge_set_out`.
 */
export function setOutWords(b: Bridge): string {
  const [la, lb] = bridgeLevels(b);
  const storeys = la || lb ? `, ${storeyNamed(la)} to ${storeyNamed(lb)}` : '';
  const rise = b.rise ?? 0;
  const slope = rise ? `, deck ${rise > 0 ? 'rising' : 'falling'} ${metres(Math.abs(rise))} m toward the far end` : '';
  return `${storeys}${slope}`;
}

export const bridgeState = (b: Bridge): string => {
  const n = b.spans.length;
  // An aqueduct is counted in spans, as its own menu counts it.
  const size = b.kind === 'aqueduct' ? `${n} span${n === 1 ? '' : 's'}` : `${n} tiles`;
  if (bridgeDone(b)) return `${size} · finished`;
  const left = b.spans.filter((s) => !isDone(s)).length;
  return `${size} · ${Math.round(bridgeProgress(b) * 100)}% · ${left} open`;
};

/** What one tile of deck still wants, written out. */
export function spanWants(s: BridgeSpan): string {
  const parts: string[] = [];
  // By id, as the island's `span_wants` names them.
  for (const [id, n] of Object.entries(s.needed).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) if (n > 0) parts.push(`${n} ${itemDef(id).name.toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

type BridgeTarget = Extract<Target, { kind: 'bridge' }>;
const bridgeOf = (g: Game, t: Target): Bridge | undefined => (t.kind === 'bridge' ? g.bridges.get((t as BridgeTarget).id) : undefined);

/**
 * gates: why a bridge -- an aqueduct too -- is not this body's to pull down,
 * or null. Where either end stands on a settlement, only that settlement's
 * builders may, as only they may take down a building's wall there
 * (`may_shape`); anywhere else, anybody may. Asked of each end in turn, and
 * named as the island names it (`last_refusal`, `aqueduct_refusal`), by the
 * job's own label: "That is part of Annhold. Only its builders may pull it
 * down there."
 */
export function pullDownRefusal(g: Game, b: Bridge, job = BRIDGE_ACTIONS.find((a) => a.id === 'demolish_bridge')?.label): string | null {
  const label = job?.toLowerCase();
  for (const [x, y] of [[b.ax, b.ay], [b.bx, b.by]] as Array<[number, number]>) {
    const mine = g.deedOfMineAt(x, y);
    // On a settlement of yours, your rank (`lacks`); on anybody else's, whose it is.
    const rank = mine ? lacks(mine, 'shape') : null;
    if (rank) return rank;
    const d = mine ? null : g.deedAt(x, y);
    if (d) return `Part of ${d.name}: only builders may ${label} there.`;
  }
  return null;
}

/**
 * What is said of a bridge set out, after its spans: its lanes past one,
 * where it goes (`setOutWords`), what a span takes, and its piers and what
 * they take all told. The island's `bridge_planned`.
 */
export function plannedWords(b: Bridge): string {
  const def = bridgeDef(b);
  const w = bridgeWidth(b);
  const lanes = w > 1 ? `, ${w} lanes` : '';
  const span = spanBill(b.kind, false, w);
  const piers = isMaterialBridge(b.kind) ? pierSpans(b.spans.length, def.bay).map((i) => b.spans[i]) : [];
  const pierBill: Record<string, number> = {};
  for (const s of piers) for (const [id, n] of Object.entries(s.total)) pierBill[id] = (pierBill[id] ?? 0) + n - (span.total[id] ?? 0);
  const pierWords = piers.length ? `. Piers: ${piers.length}, ${spanWants({ x: 0, y: 0, needed: pierBill, total: pierBill })}` : '';
  return `${lanes}${setOutWords(b)}. Per span: ${spanWants({ x: 0, y: 0, ...span })}${pierWords}`;
}

/** What may cross a bridge, as its last span decked says: by its kind and its width. The island's `bridge_crosses`. */
export function crossWords(b: Bridge): string {
  if (!bridgeDef(b).carts) return 'Foot traffic only.';
  const w = bridgeWidth(b);
  if (w < WAGON_WIDTH) return 'Carts may cross.';
  return w < STALL_WIDTH ? 'Carts and wagons may cross.' : 'Carts and wagons may cross. Furniture on the outer lanes.';
}

export const BRIDGE_ACTIONS: ActionDef[] = [
  {
    id: 'plan_bridge',
    label: 'Throw a bridge across',
    verb: 'setting out a bridge',
    hidden: true,
    // You set a bridge out from where you are standing, so nothing may walk
    // you to the other side first: the reach covers the longest span there is.
    range: 18,
    stamina: 0.04,
    baseTime: 5,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile') return 'Choose the far side.';
      const kind = (t.material ?? 'rope') as BridgeKind;
      if (!BRIDGES[kind]) return 'Choose a material.';
      const [ax, ay] = [g.player.tileX, g.player.tileY];
      return g.bridgeReason(kind, ax, ay, t.x, t.y, t.width ?? 1, sideStep(ax, ay, t.x, t.y, t.side) || 1);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const kind = (t.material ?? 'rope') as BridgeKind;
      const [ax, ay] = [g.player.tileX, g.player.tileY];
      const width = t.width ?? 1;
      const side = sideStep(ax, ay, t.x, t.y, t.side) || 1;
      if (g.bridgeReason(kind, ax, ay, t.x, t.y, width, side)) return;
      /*
       * The height the deck is carried at, off whatever each end lands on:
       * bank, poured slab, or the floor of a storey. `centerHeight` was the
       * ground under the tile, which is the one thing a bridge to a second
       * storey is not carried at.
       */
      const ends = [g.topDeck(ax, ay), g.topDeck(t.x, t.y)];
      const height = Math.round((ends[0].height + ends[1].height) / 2);
      // And past `END_SLOP` between them, a ramp: its deck rises from one end to the other (`rampRise`).
      const b = g.addBridge(kind, ax, ay, t.x, t.y, height, isMaterialBridge(kind) ? undefined : 'Oak', ends[0].level, ends[1].level,
        rampRise(ends[0].height, ends[1].height), width, side);
      const def = BRIDGES[kind];
      g.gainSkill(def.skill, 0.4);
      g.note('planned_bridge');
      g.logMsg(`Planned: ${def.name.toLowerCase()}, ${b.spans.length} span${b.spans.length > 1 ? 's' : ''}${plannedWords(b)}. ${def.note}`, 'system');
      for (const sp of b.spans) g.events.emit('world', sp.x, sp.y);
    },
  },
  {
    id: 'build_bridge',
    label: 'Work on the bridge',
    verb: 'building the bridge',
    stamina: 0.06,
    baseTime: 9,
    repeat: true,
    // An aqueduct is worked as one (`./aqueducts`).
    applies: (t, g) => bridgeOf(g, t) !== undefined && bridgeOf(g, t)!.kind !== 'aqueduct',
    labelFor: (t, g) => {
      const b = bridgeOf(g, t);
      const s = b && b.spans.find((x) => !isDone(x));
      return s ? `Work on the bridge (needs ${spanWants(s)})` : 'Work on the bridge';
    },
    check: (t, g) => {
      const b = bridgeOf(g, t);
      if (!b) return 'It is gone.';
      const def = bridgeDef(b);
      const s = b.spans.find((x) => !isDone(x));
      if (!s) return 'Finished.';
      if (!g.inventory.has(def.tool)) return `Need a ${itemDef(def.tool).name.toLowerCase()}.`;
      if (Math.hypot(s.x + 0.5 - g.player.x, s.y + 0.5 - g.player.y) > 4.5) return 'Stand by the open span.';
      // What it wants comes out of the pack, a crate on the span or the stores within reach, as a wall's does (`toHand`).
      const short = Object.keys(s.needed).sort().filter((id) => s.needed[id] > 0 && toHand(g, id, undefined, s) < 1);
      if (short.length) return `Span needs ${spanWants(s)}; no ${itemDef(short[0]).name.toLowerCase()} to hand.`;
      return null;
    },
    perform: (t, g) => {
      const b = bridgeOf(g, t);
      if (!b) return;
      const def = bridgeDef(b);
      const s = b.spans.find((x) => !isDone(x));
      if (!s) return;
      // One unit of one thing per go, as with a wall, and from where a wall's comes: the first by name to hand.
      const id = Object.keys(s.needed).sort().find((k) => s.needed[k] > 0 && toHand(g, k, undefined, s) > 0);
      if (!id || !takeUnit(g, id, undefined, s)) return;
      fitIntoSpan(g, b, s, id);
      g.gainSkill(def.skill, 0.5);
      g.wearTool(def.tool, 0.4);
      if (isDone(s)) {
        const left = b.spans.filter((x) => !isDone(x)).length;
        if (left) g.logMsg(`Span decked. ${left} open.`, 'event');
        else {
          g.note('bridged');
          // And which kind, for the journal's drawbridge (the island's the same).
          g.note(`bridged:${b.kind}`);
          g.logMsg(`Last span decked: ${bridgeName(b).toLowerCase()} open. ${crossWords(b)}`, 'system');
        }
      } else {
        g.logMsg(`Added: ${itemDef(id).name.toLowerCase()}. Span needs ${spanWants(s)}.`, 'event');
      }
      return !!b.spans.find((x) => !isDone(x));
    },
  },
  {
    id: 'demolish_bridge',
    label: 'Pull it down',
    verb: 'pulling the bridge down',
    stamina: 0.08,
    baseTime: 12,
    applies: (t, g) => bridgeOf(g, t) !== undefined && bridgeOf(g, t)!.kind !== 'aqueduct',
    check: (t, g) => {
      const b = bridgeOf(g, t);
      if (!b) return 'It is gone.';
      // gates: the reach, in the one place it is written (`PULL_REACH`).
      if (Math.hypot(b.ax + 0.5 - g.player.x, b.ay + 0.5 - g.player.y) > PULL_REACH && Math.hypot(b.bx + 0.5 - g.player.x, b.by + 0.5 - g.player.y) > PULL_REACH) {
        return 'Stand at one end of it.';
      }
      // gates: on a settlement, only its builders pull a bridge down (`pullDownRefusal`); and a padlock on a
      // drawbridge's winch keeps it from being pulled down as from being worked (`gates.ts`).
      return pullDownRefusal(g, b) ?? g.lockRefusal({ lock: b.lock, x: b.ax, y: b.ay });
    },
    perform: (t, g) => {
      const b = bridgeOf(g, t);
      if (!b) return;
      // Half of what went into it comes back, which is what pulling a thing
      // down is worth anywhere else in the world.
      const back = new Map<string, number>();
      for (const s of b.spans) {
        for (const [id, total] of Object.entries(s.total)) {
          const used = total - (s.needed[id] ?? 0);
          if (used > 0) back.set(id, (back.get(id) ?? 0) + used);
        }
      }
      const parts: string[] = [];
      for (const [id, n] of back) {
        const half = Math.floor(n / 2);
        if (half > 0) {
          g.inventory.add(id, { count: half, ql: 20 });
          parts.push(`${half} ${itemDef(id).name.toLowerCase()}`);
        }
      }
      g.removeBridge(b.id);
      g.logMsg(parts.length ? `Removed: ${bridgeName(b).toLowerCase()}. Salvaged: ${parts.join(', ')}.` : `Removed: ${bridgeName(b).toLowerCase()}.`, 'event');
    },
  },
];
