import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { roomMul, type Enchant } from './enchant';
import { describeFrom, itemDef, itemName, rarityOf, roomFor, storedLine, type Item } from './items';
import { matOf } from './materials';
import { furnitureCentre, furnitureDef, furnitureName, pieceShut, rackSpots, type PlacedFurniture } from './furniture';
import { CELLAR_FLOOR, floorOf } from './building';
import { lacks } from './ranks';
import { storeMoveRefusal, storeUse } from './stores';

/**
 * Crates are the first placeable objects. Each tile is a 4 by 4 grid of
 * subtiles; a crate occupies one subtile and snaps to that grid.
 */
export type CrateKind = 'log' | 'plank';

export interface PlacedCrate {
  id: number;
  /** The enchantment set into it where it stands (`enchanting.ts`), which it keeps through being picked up and set down. */
  enchant?: Enchant;
  /** How far gone it is, out of a hundred: a scroll that did not take on it (`enchanting.ts`). Absent is none. */
  dmg?: number;
  /**
   * Whether the island counts it yours: set down by you, from before crates
   * had owners, or standing on a settlement of yours. Absent in the game you
   * play by yourself, where every crate is yours because there is only you.
   */
  mine?: boolean;
  /**
   * How full the island says it is, when `items` is not the whole story.
   *
   * A crate too far off to reach into comes over with its count and no
   * contents, because a label does not need them and they are not free.
   */
  units?: number;
  /** What you have called it, when you have called it anything. */
  name?: string;
  x: number;
  y: number;
  /** Subtile column and row, 0..3. */
  sx: number;
  sy: number;
  kind: CrateKind;
  /**
   * What it was built at.
   *
   * A crate had none at all, and picking one up handed back a QL 20 crate
   * whatever the one you set down had been: `pick_up_crate` wrote the number
   * 20 into the item because there was nothing on the row to read instead.
   * A crate you had worked up to eighty was a crate you could only lose.
   */
  ql: number;
  items: Item[];
  /** The settlement's crate: deed workers deliver here. */
  deed?: boolean;
  /** The storey it stands on: `CELLAR_LEVEL` down in a cellar, absent on the ground. */
  level?: number;
  /** The wood it was built of. */
  material?: string;
  /** 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things. */
  rare?: number;
  /**
   * The padlock fitted to it, by the number it shares with its key.
   *
   * See `locks.ts`. Absent on everything that has never been locked, which
   * is nearly everything: a crate on your own deed is safe because the ground
   * is, and a lock is for a crate standing anywhere else.
   */
  lock?: number;
  /**
   * The founder of the settlement it is a store of, when it is marked one
   * (`stores.ts`): it opens for that settlement's founder and the ranks
   * holding Use the stores, padlock or not, and every take and put is logged.
   */
  storeOf?: string;
}

/**
 * Why a crate shuts against you when you reach into it, or null: a
 * settlement store by its own rule (`storeUse`), in place of whose it is and
 * its padlock; anything else by those two. `tail` is what `crate_refusal`
 * adds to "not yours" for putting things in.
 */
export function crateShut(g: Game, c: PlacedCrate, tail = ''): string | null {
  const use = storeUse(g, c, crateName(c).toLowerCase());
  if (use) return use === 'open' ? null : use;
  return crateNotYours(g, c, tail) ?? g.lockRefusal(c);
}

export interface CrateDef {
  name: string;
  /** Inventory item that becomes this crate when placed. */
  item: string;
  /** Item units it holds. */
  capacity: number;
}

export const CRATE_DEFS: Record<CrateKind, CrateDef> = {
  log: { name: 'Log crate', item: 'crate_log', capacity: 30 },
  plank: { name: 'Plank crate', item: 'crate_plank', capacity: 60 },
};
// What a crate holds is said off the crate: `{capacity}` in its item's text.
for (const c of Object.values(CRATE_DEFS)) describeFrom(c.item, c);

export const SUBTILES = 4;

/** How far from a store's centre you can stand and still put things in or take them out, in tiles. */
export const STORE_REACH = 2.4;

export const crateKindOfItem = (itemId: string): CrateKind | null => (itemId === 'crate_log' ? 'log' : itemId === 'crate_plank' ? 'plank' : null);
/**
 * How full it is.
 *
 * `units` when the island has said so and the contents have not travelled —
 * which is every crate too far off to reach into. Counting `items` alone made
 * every crate on an island read as empty, and the browser's own "the crate is
 * full" was therefore never true: it waved a store through and the island
 * refused it, with nothing said that anybody would connect to the crate.
 */
export const crateUnits = (c: PlacedCrate): number =>
  c.items.length ? c.items.reduce((n, it) => n + it.count, 0) : c.units ?? 0;
/** What it holds: its build, and how strong a wood it was built out of. */
export const crateCapacity = (c: PlacedCrate): number => roomFor(CRATE_DEFS[c.kind].capacity * matOf(c.material).hold * roomMul(c), c);
/** How much more it will take, which is what a put is allowed to be. */
export const crateSpare = (c: PlacedCrate): number => Math.max(0, crateCapacity(c) - crateUnits(c));
export const crateName = (c: PlacedCrate): string => {
  if (c.name) return c.name;
  const wood = c.material ? ` (${c.material.toLowerCase()})` : '';
  const rare = rarityOf(c).name;
  const said = c.deed ? `Settlement crate (${CRATE_DEFS[c.kind].name.toLowerCase()})${wood}` : `${CRATE_DEFS[c.kind].name}${wood}`;
  return rare ? `${rare.charAt(0).toUpperCase()}${rare.slice(1)} ${said.toLowerCase()}` : said;
};
/** World position of a crate's centre. */
export const crateCentre = (c: PlacedCrate): [number, number] => [c.x + (c.sx + 0.5) / SUBTILES, c.y + (c.sy + 0.5) / SUBTILES];

/** Which subtile of tile (x, y) a world point falls in. */
export function subtileOf(x: number, y: number, wx: number, wy: number): [number, number] {
  const sx = Math.max(0, Math.min(SUBTILES - 1, Math.floor((wx - x) * SUBTILES)));
  const sy = Math.max(0, Math.min(SUBTILES - 1, Math.floor((wy - y) * SUBTILES)));
  return [sx, sy];
}

type CrateTarget = Extract<Target, { kind: 'crate' }>;
const crateOf = (g: Game, t: Target): PlacedCrate | undefined => (t.kind === 'crate' ? g.crates.get((t as CrateTarget).id) : undefined);
const nearCrate = (g: Game, c: PlacedCrate): boolean => {
  const [cx, cy] = crateCentre(c);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= STORE_REACH;
};

/**
 * The crate a thing is being put into: the one the ask names, and the nearest
 * when it names none.
 *
 * It was always the nearest, which is fine at a crate standing on its own and
 * wrong everywhere else. Reported from a rack: "trying to place any items in
 * any of the pine crates gives an error that the maple crate is full". Eight
 * crates stand on one tile on a rack; the nearest of the eight was the maple;
 * so every drag into an open pine crate was aimed at the maple, and once the
 * maple was full every one of them was refused in the maple's name. A crate
 * window that says which crate it is has to be able to say so in the ask.
 */
/**
 * Why a crate somebody else made is not yours to use, or null: the island's
 * `crate_yours`, which it sends as `mine`. On a settlement of yours it is your
 * rank that says no (Crates and stores), and is named; anywhere else the
 * crate is simply somebody else's. `tail` is what `crate_refusal` adds for
 * putting things in.
 */
export function crateNotYours(g: Game, c: PlacedCrate, tail = ''): string | null {
  if (c.mine !== false) return null;
  return lacks(g.deedOfMineAt(c.x, c.y), 'stores') ?? `Not yours: ${crateName(c).toLowerCase()}${tail}.`;
}

const crateInto = (g: Game, t: Target): PlacedCrate | undefined => {
  if (t.kind === 'item' && t.into !== undefined) {
    const named = g.crates.get(t.into);
    // Named and within reach: a crate you have walked away from is not the
    // crate you are putting something in, and the island reads it the same way.
    if (named && nearCrate(g, named)) return named;
  }
  return g.nearestCrate();
};

export const CRATE_ACTIONS: ActionDef[] = [
  {
    id: 'place_crate',
    label: 'Place crate',
    verb: 'placing the crate',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile' || t.itemUid === undefined || t.sx === undefined || t.sy === undefined) return 'Choose a crate and a spot.';
      const item = g.inventory.get(t.itemUid);
      const kind = item && crateKindOfItem(item.id);
      if (!item || !kind) return 'Not a crate.';
      /*
       * A rack's deck is a crate spot, and the ground under it is the rack's
       * business rather than the crate's: whoever put the rack there already
       * answered for the footing. So the ground rules below are skipped on a
       * deck and asked on bare earth, which is the only difference between the
       * two — a crate on a rack is an ordinary crate at an ordinary subtile.
       */
      // Down in a cellar, on its floor: dug level and dry, so the ground's questions are not asked of it.
      const level = floorOf(g.player.level);
      if (level < 0 && !g.buildings.sameCellar(g.myCellar(), t.x, t.y)) return CELLAR_FLOOR;
      const rack = g.rackAt(t.x, t.y, t.sx, t.sy, level);
      if (rack) {
        if (kind !== 'plank') return 'Plank crates only on a rack.';
      } else if (level >= 0) {
        // A deck on piers is dry, level floor whatever is under it, and one not built yet is nothing to stand on.
        const deck = g.deckFooting(t.x, t.y);
        if (deck === false || (deck === null && (!g.world.isPassable(t.x, t.y) || g.world.hasWater(t.x, t.y)))) return 'Need dry, open ground.';
        if (deck === null && g.world.slope(t.x, t.y) > 20) return 'Too steep.';
      }
      if (g.crateAt(t.x, t.y, t.sx, t.sy, level)) return 'Spot taken.';
      if (g.isToken(t.x, t.y)) return 'Not on the totem.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile' || t.itemUid === undefined || t.sx === undefined || t.sy === undefined) return;
      const item = g.inventory.get(t.itemUid);
      const kind = item && crateKindOfItem(item.id);
      if (!item || !kind || !g.inventory.remove(item.uid, 1)) return;
      const crate = g.addCrate(kind, t.x, t.y, t.sx, t.sy, [], false, item.extra, item.ql, floorOf(g.player.level));
      // A rare crate holds more, so it has to stay rare once it is standing.
      if (item.rare) crate.rare = item.rare;
      // And its enchantment, which goes down with it and comes up again with it (`enchanting.ts`).
      if (item.enchant) crate.enchant = item.enchant;
      if (item.dmg) crate.dmg = item.dmg;
      g.note('crate');
      g.logMsg(`Set down: ${crateName(crate).toLowerCase()}.`, 'event');
      g.events.emit('world', crate.x, crate.y);
    },
  },
  {
    id: 'pick_up_crate',
    label: 'Pick up crate',
    verb: 'lifting the crate',
    stamina: 0.03,
    baseTime: 2,
    applies: (t) => t.kind === 'crate',
    check: (t, g) => {
      const c = crateOf(g, t);
      if (!c) return 'It is gone.';
      // A settlement store is picked up by whoever set it down and its founder (`storeMoveRefusal`).
      const kept = storeMoveRefusal(g, c, crateName(c).toLowerCase());
      if (kept) return kept;
      const theirs = crateNotYours(g, c);
      if (theirs) return theirs;
      // A crate with a lock on it is not carried off with the lock: a locked
      // thing that could simply be picked up is not locked at all.
      const shut = g.lockRefusal(c);
      if (shut) return shut;
      if (c.items.length) return 'Empty it first.';
      return null;
    },
    perform: (t, g) => {
      const c = crateOf(g, t);
      if (!c || c.items.length) return;
      g.removeCrate(c.id);
      const back = g.inventory.add(CRATE_DEFS[c.kind].item, { ql: c.ql, extra: c.material });
      if (c.rare) back.rare = c.rare;
      if (c.enchant) back.enchant = c.enchant;
      if (c.dmg) back.dmg = c.dmg;
      g.logMsg(`Picked up: ${CRATE_DEFS[c.kind].name.toLowerCase()}.${c.deed ? ' Settlement workers leave their finds by the totem until a settlement crate is set down.' : ''}`, 'event');
      g.events.emit('world', c.x, c.y);
    },
  },
  {
    id: 'crate_take_all',
    label: 'Take everything',
    verb: 'emptying the crate',
    stamina: 0.01,
    baseTime: 1,
    applies: (t) => t.kind === 'crate',
    check: (t, g) => {
      const c = crateOf(g, t);
      if (!c) return 'Crate empty.';
      // A settlement store by its rule, anything else by whose it is and its padlock.
      const shut = crateShut(g, c);
      if (shut) return shut;
      return c.items.length ? null : 'Crate empty.';
    },
    perform: (t, g) => {
      const c = crateOf(g, t);
      if (!c || !c.items.length) return;
      const items = c.items.splice(0, c.items.length);
      for (const it of items) g.inventory.addItem(it);
      g.events.emit('crate');
      const names = items.map((it) => (it.count > 1 ? `${it.count} × ${itemName(it).toLowerCase()}` : itemName(it).toLowerCase()));
      g.logMsg(`Taken from crate: ${names.join(', ')}.`, 'event');
    },
  },
  {
    id: 'store_in_crate',
    label: 'Put in crate',
    verb: 'stowing',
    instant: true,
    quantity: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => t.kind === 'item' && g.crates.size > 0 && !crateKindOfItem(g.inventory.get(t.uid)?.id ?? ''),
    check: (t, g) => {
      const c = crateInto(g, t);
      if (!c || !nearCrate(g, c)) return 'Stand next to a crate.';
      const shut = cratePutShut(g, c);
      if (shut) return shut;
      // Room for some of it is enough: what fits goes in and the rest stays in
      // the pack. Only a crate with no room at all has anything to refuse, and
      // the refusal names the crate you were aiming at.
      if (crateSpare(c) <= 0) return `${crateName(c)} full.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const c = crateInto(g, t);
      if (!c) return;
      const want = t.count ?? 1;
      const item = cratePut(g, c, t.uid, want);
      if (!item) {
        g.logMsg(`${crateName(c)} full.`, 'error');
        return;
      }
      g.logMsg(storedLine(item.count, itemName(item), crateName(c), want - item.count), 'event');
    },
  },
];

/**
 * Why a crate will not have anything put into it by you, or null: a
 * settlement store by its own rule, anything else by whose it is and its
 * padlock. How much room it has is a separate question, asked after.
 *
 * `store_in_crate` asks this of the one crate it is aimed at and `rack_put`
 * of every crate on the rack, so a crate on a rack is shut to a load of the
 * rack exactly when it is shut to a put of its own. The island's
 * `crate_put_shut`.
 */
export const cratePutShut = (g: Game, c: PlacedCrate): string | null => crateShut(g, c, ', nothing goes in');

/**
 * Put up to `want` of a stack in the pack into one crate: as many as it has
 * room for, the rest staying where they are. What went in, or null when
 * nothing did. The island's `crate_put`, which `store_in_crate` and
 * `rack_put` both move things with, so the two cannot come to disagree about
 * what a crate will take.
 */
export function cratePut(g: Game, c: PlacedCrate, uid: number, want: number): Item | null {
  const fits = Math.min(want, crateSpare(c));
  if (fits <= 0) return null;
  const item = g.inventory.take(uid, fits);
  if (!item) return null;
  if (!g.crateAdd(c, item)) {
    g.inventory.addItem(item);
    return null;
  }
  return item;
}

/**
 * What a load of a rack said: how many of how many, into how many crates on
 * it — the crate by name when it was only one — and how many did not fit.
 * The island's `rack_put_line`, word for word.
 */
export const rackPutLine = (put: number, want: number, what: string, crates: number, one: string, rack: string): string =>
  `Stored: ${put === want ? put : `${put} of ${want}`} × ${what.toLowerCase()} in `
  + `${crates === 1 ? one.toLowerCase() : `${crates} crates`} on ${rack.toLowerCase()}.`
  + (want > put ? ` ${want - put} did not fit.` : '');

/** The rack a load is aimed at: the piece `into` names, when it is one whose deck takes crates. */
const rackInto = (g: Game, t: Target): PlacedFurniture | undefined => {
  if (t.kind !== 'item' || t.into === undefined) return undefined;
  const f = g.furniture.get(t.into);
  return f && rackSpots(f) ? f : undefined;
};

/**
 * Loading a rack: a stack let go over a crate shelf goes into the crates
 * standing on it, one after another.
 *
 * Asked for: "Allow dragging inventory to a Crate shelf, where the crates on it
 * will fill one by one according to available space." A rack holds nothing of
 * its own — it is the ground eight crates stand on — so a drop on it had
 * nowhere to go and did nothing; the way to fill one was to open each crate in
 * turn and drag into it, counting what was left over by hand.
 *
 * So the first crate in the rack's own order (`rackDeck`, the order its spots
 * fill and the model draws them) takes as much as it has room for, then the
 * next, and so on until the stack is gone or every crate is full. Each crate
 * is put into by the same rule a put of its own goes by (`cratePutShut`,
 * `cratePut`): a crate shut to you — somebody else's, padlocked, a settlement
 * store your rank cannot use — is passed over, and the rest are filled. What
 * none of them has room for stays in the pack, and one line says how much went
 * where. On an island it is one ask, `rack_put`, and the whole fill is done
 * there in one go.
 */
CRATE_ACTIONS.push({
  id: 'rack_put',
  label: 'Put in the crates on it',
  verb: 'stowing',
  instant: true,
  quantity: true,
  stamina: 0,
  baseTime: 0,
  // Not in the item menu: it is what a drop on a rack means, and a rack is named in the ask.
  hidden: true,
  applies: (t, g) => t.kind === 'item' && !!rackInto(g, t) && !crateKindOfItem(g.inventory.get(t.uid)?.id ?? ''),
  check: (t, g) => {
    if (t.kind !== 'item') return null;
    const item = g.inventory.get(t.uid);
    if (!item) return 'It is gone.';
    if (crateKindOfItem(item.id)) return 'No crates inside crates.';
    const f = rackInto(g, t);
    if (!f) return 'It is gone.';
    const [cx, cy] = furnitureCentre(f);
    if (Math.hypot(cx - g.player.x, cy - g.player.y) > STORE_REACH) return `Stand next to the ${furnitureName(f).toLowerCase()}.`;
    const on = g.cratesOn(f);
    if (!on.length) return `No crates on ${furnitureName(f).toLowerCase()}.`;
    // A thing that stacks goes in as far as there is room; one that does not goes in whole or not at all.
    const need = itemDef(item.id).stackable ? 1 : Math.min(item.count, t.count ?? 1);
    let shut: string | null = null;
    let open = 0;
    for (const c of on) {
      const why = cratePutShut(g, c);
      if (why) shut ??= why;
      else if (crateSpare(c) >= need) return null;
      else open++;
    }
    // Every one of them shut or full: full when none was shut, what shut the
    // first when all were, and both when it was some of each.
    if (!shut) return `All crates on ${furnitureName(f).toLowerCase()} full.`;
    return open ? `${shut} Others full.` : shut;
  },
  perform: (t, g) => {
    if (t.kind !== 'item') return;
    const f = rackInto(g, t);
    const held = g.inventory.get(t.uid);
    if (!f || !held) return;
    const what = itemName(held);
    const want = Math.max(1, Math.min(held.count, t.count ?? 1));
    let put = 0;
    const into: PlacedCrate[] = [];
    for (const c of g.cratesOn(f)) {
      if (put >= want) break;
      if (cratePutShut(g, c)) continue;
      const went = cratePut(g, c, t.uid, want - put);
      if (!went) continue;
      put += went.count;
      into.push(c);
    }
    if (!put) {
      g.logMsg(`All crates on ${furnitureName(f).toLowerCase()} full.`, 'error');
      return;
    }
    g.logMsg(rackPutLine(put, want, what, into.length, crateName(into[0]), furnitureName(f)), 'event');
  },
});

CRATE_ACTIONS.push({
  id: 'take_from_store',
  label: 'Take out',
  verb: 'taking it out',
  instant: true,
  quantity: true,
  stamina: 0,
  baseTime: 0,
  /*
   * Not in the generic item menu: it only means anything about a thing that is
   * already in a crate or a chest, and those are reached through the store
   * window. It exists so that taking one thing out has a door of its own —
   * there has been a way to put a thing in and a way to take everything out,
   * and nothing in between, so the browser did the in-between itself and the
   * island put it straight back.
   */
  hidden: true,
  applies: (t, g) => t.kind === 'item' && !g.inventory.get(t.uid) && !!g.storeWith(t.uid),
  check: (t, g) => {
    if (t.kind !== 'item') return null;
    const where = g.storeWith(t.uid);
    if (!where) return 'It is gone.';
    const dx = where.at[0] - g.player.x;
    const dy = where.at[1] - g.player.y;
    if (Math.hypot(dx, dy) > STORE_REACH) return `Stand next to the ${where.what}.`;
    // One thing out of a padlocked crate is as shut as everything out of it, and a settlement store opens by its rule.
    if (where.crate) return crateShut(g, where.crate);
    // A counter is not a chest: what is on somebody else's stall is bought, not taken.
    if (where.piece && furnitureDef(where.piece.kind).stall && where.piece.mine === false) {
      return "Someone else's stall: buy it at the counter.";
    }
    if (where.piece) return pieceShut(g, where.piece);
    return null;
  },
  perform: (t, g) => {
    if (t.kind !== 'item') return;
    const where = g.storeWith(t.uid);
    if (!where) return;
    const got = where.take(t.uid);
    if (!got) return;
    g.inventory.addItem(got);
    // Honey out of a hive, for the journal (the island's `perform_crate` the same).
    if (got.id === 'honey' && where.piece?.kind === 'hive') g.note('honey');
    g.logMsg(`Taken from ${where.what}: ${got.count > 1 ? `${got.count} × ` : ''}${itemName(got).toLowerCase()}.`, 'event');
  },
});

export const CRATE_ACTION_BY_ID = new Map(CRATE_ACTIONS.map((a) => [a.id, a]));
