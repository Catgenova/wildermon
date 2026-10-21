import type { ActionDef, Target } from './actions';
import { enchantTail, furnaceBurn, type Enchant } from './enchant';
import { FIRE_CAPACITY, FUEL_SAID, FUEL_VALUES, fuelAtHand, fuelledSaid, hasAshes, rakeAshes } from './campfire';
import { SUBTILES } from './crates';
import type { Game } from './game';
import { itemDef, itemName, rarityOf, roomFor, type Item } from './items';
import { world } from './pace';
import type { CraftStock } from './recipes';
import type { Plume } from './smelter';

/**
 * A kiln: four subtiles of stone brick with a firebox under them. Clay is
 * shaped cold and is only worth anything once it has been through here, so a
 * potter builds one early and keeps it fed.
 */
export interface KilnJob {
  /** The green ware that went in. */
  item: Item;
  /** What comes out of it. */
  makes: string;
  /** Seconds of burning still needed. */
  left: number;
  /** What it started with, for the bar. */
  total: number;
  ql: number;
}

export interface PlacedKiln {
  /** The enchantment set into it where it stands (`enchanting.ts`), which it keeps through being picked up and set down. */
  enchant?: Enchant;
  /** How far gone it is, out of a hundred: a scroll that did not take on it (`enchanting.ts`). Absent is none. */
  dmg?: number;
  /** 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things. */
  rare?: number;
  id: number;
  x: number;
  y: number;
  /** Top-left subtile of its two by two block. */
  sx: number;
  sy: number;
  /** Built quality: a better kiln fires faster and truer. */
  ql: number;
  fuel: number;
  lit: boolean;
  jobs: KilnJob[];
  output: Item[];
  /** Ashes waiting to be raked out. */
  ash?: number;
}

/** A kiln covers two subtiles each way: four in all. */
export const KILN_SUBTILES = 2;
export const KILN_CAPACITY = 16;
/** What to call it: a plain kiln, or the rarity it was built with. */
export const kilnName = (k: { rare?: number }): string => {
  const rare = rarityOf(k).name;
  return rare ? `${rare.charAt(0).toUpperCase()}${rare.slice(1)} kiln` : 'Kiln';
};
/** How much green ware this one will hold: the plain sixteen, and more for a rare kiln. */
export const kilnCapacity = (k: { rare?: number }): number => roomFor(KILN_CAPACITY, k);

/** Green ware, and what it becomes once it has been fired. */
export interface PotteryDef {
  unfired: string;
  fired: string;
  /** Seconds in an ordinary kiln. */
  seconds: number;
}

export const POTTERY: PotteryDef[] = [
  { unfired: 'unfired_clay_brick', fired: 'clay_brick', seconds: world(22) },
  { unfired: 'unfired_clay_bowl', fired: 'clay_bowl', seconds: world(30) },
  { unfired: 'unfired_clay_pot', fired: 'clay_pot', seconds: world(40) },
  { unfired: 'unfired_clay_jar', fired: 'clay_jar', seconds: world(34) },
  // An Artisan's amphora, the biggest thing a kiln takes.
  { unfired: 'unfired_amphora', fired: 'amphora', seconds: world(50) },
];

export const POTTERY_BY_UNFIRED = new Map(POTTERY.map((p) => [p.unfired, p]));
export const isGreenware = (id: string): boolean => POTTERY_BY_UNFIRED.has(id);
/**
 * The unfired clay to pack: the stack named, or the first there is, from the
 * same stock a craft spends -- the pack, a bag on your back, a store within
 * `CRAFT_REACH`.
 */
export function greenwareAtHand(g: Game, uid?: number): CraftStock | undefined {
  if (uid === undefined) return g.stockOf((it) => isGreenware(it.id))[0];
  const s = g.stockEntry(uid);
  return s && isGreenware(s.item.id) ? s : undefined;
}

/** How long a piece takes: its own size, quickened by a well-built kiln. */
export const fireSeconds = (def: PotteryDef, kilnQl: number): number => Math.max(6, def.seconds * (1.4 - kilnQl / 160));

/**
 * What comes out. The potter's hands settle most of it, and a good kiln keeps
 * what they made rather than adding to it.
 */
export const firedQl = (greenQl: number, kilnQl: number): number => Math.max(1, Math.min(100, greenQl * (0.82 + kilnQl / 420)));

/**
 * Where its smoke comes out: the head of the vent on its dome, so high over
 * the ground in tenths of a metre (`HEIGHT_SCALE` units) and so far back from
 * the middle of its block toward the north, in tiles, as it is drawn
 * (`forge.ts`).
 */
export const KILN_VENT_UP = 18.5;
export const KILN_VENT_BACK = 0.07;
/** A kiln's vent draws as a smelter's stack does (`SMELTER_PLUME`): a short, thin, pale plume; fuller, higher and denser while it fires a load. */
export const KILN_PLUME: Plume = { rise: 0.3, size: 0.44, pale: 0.75 };
export const KILN_PLUME_FIRING: Plume = { rise: 0.36, size: 0.48, pale: 0.7 };
/** How strong its light is (`Game.lights`, out to `OVEN_REACH`): banked low while it is only lit, full while it fires a load. */
export const KILN_GLOW = 0.62;
export const KILN_GLOW_FIRING = 0.8;
export const kilnCentre = (k: PlacedKiln): [number, number] => [k.x + (k.sx + 1) / SUBTILES, k.y + (k.sy + 1) / SUBTILES];

export function kilnCovers(k: { sx: number; sy: number }, sx: number, sy: number): boolean {
  return sx >= k.sx && sx < k.sx + KILN_SUBTILES && sy >= k.sy && sy < k.sy + KILN_SUBTILES;
}

/** Top-left subtile of the block a kiln would take, kept inside the tile. */
export function kilnAnchor(sx: number, sy: number): [number, number] {
  return [Math.max(0, Math.min(SUBTILES - KILN_SUBTILES, sx)), Math.max(0, Math.min(SUBTILES - KILN_SUBTILES, sy))];
}

/** How long its fuel keeps it hot: longer for an Ember Heart (`furnaceBurn`). */
export const kilnBurnsFor = (k: PlacedKiln): string => {
  const secs = k.fuel / furnaceBurn(k);
  const m = Math.round(secs / 60);
  return m >= 60 ? `${(m / 60).toFixed(1)} hours` : m >= 1 ? `${m} minutes` : `${Math.round(secs)} seconds`;
};

export function kilnState(k: PlacedKiln): string {
  const heat = k.lit ? `lit, fuel ${kilnBurnsFor(k)}` : k.fuel > 0 ? `unlit, fuel ${kilnBurnsFor(k)}` : 'unlit, no fuel';
  const work = k.jobs.length ? ` · ${k.jobs.length} firing` : '';
  const out = k.output.length ? ` · ${k.output.length} ready` : '';
  return `QL ${k.ql.toFixed(0)} · ${heat}${work}${out}${enchantTail(k)}`;
}

type KilnTarget = Extract<Target, { kind: 'kiln' }>;
const kilnOf = (g: Game, t: Target): PlacedKiln | undefined => (t.kind === 'kiln' ? g.kilns.get((t as KilnTarget).id) : undefined);
const nearKiln = (g: Game, k: PlacedKiln): boolean => {
  const [cx, cy] = kilnCentre(k);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= 2.4;
};

export const KILN_ACTIONS: ActionDef[] = [
  {
    id: 'place_kiln',
    label: 'Set the kiln down',
    verb: 'setting the kiln down',
    hidden: true,
    stamina: 0.04,
    baseTime: 5,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return 'Choose a spot.';
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('kiln');
      if (!item || item.id !== 'kiln') return 'Need a kiln (crafting window).';
      return g.kilnPlaceReason(t.x, t.y, t.sx, t.sy);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return;
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('kiln');
      if (!item || item.id !== 'kiln' || !g.inventory.remove(item.uid, 1)) return;
      const k = g.addKiln(t.x, t.y, t.sx, t.sy, item.ql);
      // A rare kiln set down is a rare kiln: it takes a bigger load.
      if (item.rare) k.rare = item.rare;
      // Its enchantment and its wear go down with it, and come up again with it (`enchanting.ts`).
      if (item.enchant) k.enchant = item.enchant;
      if (item.dmg) k.dmg = item.dmg;
      g.logMsg(`Set down: ${kilnName(k).toLowerCase()}, QL ${k.ql.toFixed(1)}, holds ${kilnCapacity(k)}.`, 'event');
      g.events.emit('world', k.x, k.y);
    },
  },
  {
    id: 'pick_up_kiln',
    label: 'Take it up',
    verb: 'taking the kiln up',
    stamina: 0.04,
    baseTime: 5,
    applies: (t, g) => kilnOf(g, t) !== undefined,
    check: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return 'It is gone.';
      if (k.lit) return 'Put it out first.';
      if (k.jobs.length || k.output.length) return 'Empty it first.';
      if (Math.floor(k.ash ?? 0) >= 1) return 'Rake the ashes out first.';
      return null;
    },
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k || k.lit || k.jobs.length || k.output.length) return;
      g.removeKiln(k.id);
      const back = g.inventory.add('kiln', { ql: k.ql });
      if (k.rare) back.rare = k.rare;
      if (k.enchant) back.enchant = k.enchant;
      if (k.dmg) back.dmg = k.dmg;
      g.logMsg(`Picked up: ${kilnName(k).toLowerCase()}.`, 'event');
      g.events.emit('world', k.x, k.y);
    },
  },
  {
    id: 'fuel_kiln',
    label: 'Fuel',
    verb: 'feeding the kiln',
    hidden: true,
    quantity: true,
    stamina: 0.01,
    baseTime: 1.5,
    applies: (t, g) => kilnOf(g, t) !== undefined,
    check: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return 'It is gone.';
      if (!nearKiln(g, k)) return 'Stand next to the kiln.';
      const item = fuelAtHand(g, t.kind === 'kiln' ? t.itemUid : undefined)?.item;
      if (!item) return `Need fuel: ${FUEL_SAID}.`;
      if (k.fuel >= FIRE_CAPACITY) return 'Fuel full.';
      return null;
    },
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k || t.kind !== 'kiln') return;
      const stack = fuelAtHand(g, t.itemUid);
      if (!stack) return;
      const item = stack.item;
      const per = FUEL_VALUES[item.id];
      const fits = Math.max(1, Math.min(Math.min(t.count ?? 1, item.count), Math.ceil(Math.max(0, FIRE_CAPACITY - k.fuel) / per)));
      if (!stack.spend(fits)) return;
      k.fuel = Math.min(FIRE_CAPACITY, k.fuel + per * fits);
      g.events.emit('smelter');
      g.logMsg(fuelledSaid(fits, itemDef(item.id).name, kilnBurnsFor(k)), 'event');
    },
  },
  {
    id: 'load_kiln',
    label: 'Fire in the kiln',
    verb: 'loading the kiln',
    skill: 'pottery',
    hidden: true,
    quantity: true,
    instant: true,
    stamina: 0.01,
    baseTime: 0,
    applies: (t, g) => kilnOf(g, t) !== undefined,
    check: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return 'It is gone.';
      if (!nearKiln(g, k)) return 'Stand next to the kiln.';
      const item = greenwareAtHand(g, t.kind === 'kiln' ? t.itemUid : undefined)?.item;
      if (!item) return 'Unfired clay only.';
      if (k.jobs.length >= kilnCapacity(k)) return 'Kiln full.';
      return null;
    },
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k || t.kind !== 'kiln') return;
      const stack = greenwareAtHand(g, t.itemUid);
      const item = stack?.item;
      const def = item && POTTERY_BY_UNFIRED.get(item.id);
      if (!stack || !item || !def) return;
      const n = Math.max(1, Math.min(Math.min(t.count ?? 1, item.count), kilnCapacity(k) - k.jobs.length));
      const taken: Item = { ...item, count: n };
      if (!stack.spend(n)) return;
      const seconds = fireSeconds(def, k.ql);
      for (let i = 0; i < n; i++) k.jobs.push({ item: { ...taken, count: 1 }, makes: def.fired, left: seconds, total: seconds, ql: firedQl(taken.ql, k.ql) });
      g.events.emit('smelter');
      g.logMsg(`Packed: ${n > 1 ? `${n} × ` : ''}${itemDef(taken.id).name.toLowerCase()}. About ${Math.round(seconds)} seconds of heat each.`, 'event');
    },
  },
  {
    id: 'light_kiln',
    label: 'Light',
    verb: 'lighting the kiln',
    stamina: 0.04,
    baseTime: 6,
    applies: (t, g) => kilnOf(g, t)?.lit === false,
    check: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return 'It is gone.';
      if (k.lit) return 'Already lit.';
      if (k.fuel <= 0) return 'No fuel.';
      return null;
    },
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k || k.lit) return;
      k.lit = true;
      g.events.emit('smelter');
      g.events.emit('world', k.x, k.y);
      g.logMsg(`Lit: kiln. Fuel: ${kilnBurnsFor(k)}.`, 'event');
    },
  },
  {
    id: 'damp_kiln',
    label: 'Let it cool',
    verb: 'damping the kiln',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => kilnOf(g, t)?.lit === true,
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return;
      k.lit = false;
      g.events.emit('smelter');
      g.events.emit('world', k.x, k.y);
      g.logMsg(`Put out: kiln. Fuel kept: ${kilnBurnsFor(k)}.`, 'event');
    },
  },
  {
    id: 'kiln_take_all',
    label: 'Take what is fired',
    verb: 'unpacking the kiln',
    stamina: 0.01,
    baseTime: 1,
    applies: (t, g) => kilnOf(g, t) !== undefined,
    check: (t, g) => {
      const k = kilnOf(g, t);
      if (!k) return 'It is gone.';
      return k.output.length ? null : 'Nothing fired yet.';
    },
    perform: (t, g) => {
      const k = kilnOf(g, t);
      if (!k || !k.output.length) return;
      const taken = k.output.splice(0, k.output.length);
      for (const it of taken) g.inventory.addItem(it);
      g.events.emit('smelter');
      const names = taken.map((it) => (it.count > 1 ? `${it.count} × ${itemName(it).toLowerCase()}` : itemName(it).toLowerCase()));
      g.logMsg(`Taken from kiln: ${names.join(', ')}.`, 'event');
    },
  },
  {
    id: 'take_ashes_kiln',
    label: 'Rake out the ashes',
    verb: 'raking out ashes',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => {
      const h = kilnOf(g, t);
      return !!h && hasAshes(h);
    },
    check: (t, g) => {
      const h = kilnOf(g, t);
      if (!h) return 'It is gone.';
      if (!nearKiln(g, h)) return 'Stand next to the kiln.';
      return hasAshes(h) ? null : 'No ashes yet.';
    },
    perform: (t, g) => {
      const h = kilnOf(g, t);
      if (h) rakeAshes(g, h, 'kiln');
    },
  },
];

export const KILN_ACTION_BY_ID = new Map(KILN_ACTIONS.map((a) => [a.id, a]));
