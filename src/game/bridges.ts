import type { ActionDef, Target } from './actions';
import { isDone, progressOf, type Bill } from './building';
import { takeUnit, toHand } from './buildstock';
import type { Game } from './game';
import { greenNow } from './greening';
import { lacks } from './ranks';
import { itemDef } from './items';
import { fill } from './words';
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

export type BridgeKind = 'rope' | 'wood' | 'stone' | 'aqueduct' | 'draw';

/**
 * gates: how near the middle of one of its two end tiles a body stands to
 * pull a bridge down, in tiles. The island's `bridge_pull_reach`, which the
 * parity test holds to this.
 */
export const PULL_REACH = 4.5;

export interface BridgeDef {
  id: BridgeKind;
  name: string;
  /** What one tile of deck takes. */
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
  note: string;
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
  wood: {
    id: 'wood',
    name: 'Wooden bridge',
    bill: [['timber', 12], ['plank', 24], ['nail', 24]],
    span: 10,
    tool: 'mallet',
    skill: 'carpentry',
    difficulty: 30,
    carts: true,
    note: 'Longest span: {span} tiles. Carts may cross.',
  },
  stone: {
    id: 'stone',
    name: 'Stone arch',
    bill: [['stone_brick', 40], ['mortar', 20], ['stone_slab', 6]],
    span: 8,
    tool: 'trowel',
    skill: 'masonry',
    difficulty: 44,
    carts: true,
    note: 'Longest span: {span} tiles. Carts may cross.',
  },
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

/**
 * What an aqueduct's channel adds to a span of stone arch: the slabs it is
 * lined with and the mortar they are bedded in. Its span, its trade and how
 * hard it is are the stone arch's own.
 */
export const CHANNEL_LINING: Array<[string, number]> = [['mortar', 10], ['stone_slab', 4]];
{
  const a = BRIDGES.aqueduct;
  const s = BRIDGES.stone;
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
  /** One entry per tile of deck between the ends, in order. */
  spans: BridgeSpan[];
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

/** One tile of deck, unbuilt: the first also takes a drawbridge's winch. */
export const spanBill = (kind: BridgeKind, first = false): Bill => {
  const needed: Record<string, number> = {};
  for (const [id, n] of BRIDGES[kind].bill) needed[id] = n;
  if (first) for (const [id, n] of BRIDGES[kind].winch ?? []) needed[id] = (needed[id] ?? 0) + n;
  return { needed, total: { ...needed } };
};

/** How much under a deck counts as a gap worth bridging. */
export const CLEARANCE = 3;
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
  return `Ends ${apart.toFixed(0)} apart in height${ends}. Max rise ${RAMP_SLOPE}/tile: needs ${rampTiles(apart)} tiles of deck; has ${n}.`;
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
  const slope = rise ? `, deck ${rise > 0 ? 'rising' : 'falling'} ${Math.abs(rise)} toward the far end` : '';
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
  for (const [id, n] of Object.entries(s.needed)) if (n > 0) parts.push(`${n} ${itemDef(id).name.toLowerCase()}`);
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
      return g.bridgeReason(kind, ax, ay, t.x, t.y);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const kind = (t.material ?? 'rope') as BridgeKind;
      const [ax, ay] = [g.player.tileX, g.player.tileY];
      if (g.bridgeReason(kind, ax, ay, t.x, t.y)) return;
      /*
       * The height the deck is carried at, off whatever each end lands on:
       * bank, poured slab, or the floor of a storey. `centerHeight` was the
       * ground under the tile, which is the one thing a bridge to a second
       * storey is not carried at.
       */
      const ends = [g.topDeck(ax, ay), g.topDeck(t.x, t.y)];
      const height = Math.round((ends[0].height + ends[1].height) / 2);
      // And past `END_SLOP` between them, a ramp: its deck rises from one end to the other (`rampRise`).
      const b = g.addBridge(kind, ax, ay, t.x, t.y, height, kind === 'stone' ? undefined : 'Oak', ends[0].level, ends[1].level,
        rampRise(ends[0].height, ends[1].height));
      const def = BRIDGES[kind];
      g.gainSkill(def.skill, 0.4);
      g.note('planned_bridge');
      g.logMsg(
        `Planned: ${def.name.toLowerCase()}, ${b.spans.length} span${b.spans.length > 1 ? 's' : ''}${setOutWords(b)}. Per span: ${def.bill.map(([id, n]) => `${n} ${itemDef(id).name.toLowerCase()}`).join(', ')}. ${def.note}`,
        'system',
      );
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
          g.logMsg(`Last span decked: ${bridgeName(b).toLowerCase()} open. ${def.carts ? 'Carts may cross.' : 'Foot traffic only.'}`, 'system');
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
