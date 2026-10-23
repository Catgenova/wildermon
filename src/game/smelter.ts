import type { ActionDef, Target } from './actions';
import { enchantTail, furnaceBurn, type Enchant } from './enchant';
import { FIRE_CAPACITY, FUEL_SAID, FUEL_VALUES, fuelAtHand, fuelledSaid, hasAshes, rakeAshes } from './campfire';
import { DEED_PLACE } from './furniture';
import { SUBTILES } from './crates';
import type { Game } from './game';
import { itemDef, itemName, markOf, rarityOf, roomFor, type Item } from './items';
import { MELT_HEAT, MELT_KEEP, MELT_SHARE, meltLumps, meltQl, meltRefusal, metalOfItem } from './melt';
import { matOf } from './materials';
import {
  castSeconds, castWhole, INGOT_LUMPS, ingotOf, isMetalStock, isOreItem, lumpsIn, METAL_BY_LUMP, METAL_BY_ORE, metalOfBar, MOULD_BY_ID,
  MOULD_DENT, MOULD_SKILL, mouldLumps, mouldUsesLeft, mouldWear, ORE_PER_LUMP, pourSeconds, smeltSeconds,
} from './metal';

/**
 * A stone smelter: the deed's second building after the campfire. It fills a
 * three by two block of subtiles, burns the same fuel a campfire does, and
 * works away on its own while it has heat in it.
 */
export interface SmeltJob {
  /** What went in. */
  item: Item;
  /** What comes out. */
  makes: string;
  /** Seconds of burning still needed. */
  left: number;
  /** Total it started with, for the bar. */
  total: number;
  /** Quality the piece will carry. */
  ql: number;
  /** What the piece will say it is made of, when it says: the metal's name. */
  extra?: string;
  /** The piece a casting is of, when what comes out is a casting. */
  piece?: string;
}

export interface PlacedSmelter {
  /** The enchantment set into it where it stands (`enchanting.ts`), which it keeps through being picked up and set down. */
  enchant?: Enchant;
  /** How far gone it is, out of a hundred: a scroll that did not take on it (`enchanting.ts`). Absent is none. */
  dmg?: number;
  /** 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things. */
  rare?: number;
  id: number;
  x: number;
  y: number;
  /** Top-left subtile of its three by two block. */
  sx: number;
  sy: number;
  /** Built quality, which decides how fast it works. */
  ql: number;
  fuel: number;
  lit: boolean;
  /** What it is working through, in order. */
  jobs: SmeltJob[];
  /** Finished pieces waiting to be taken out. */
  output: Item[];
  /** Ashes waiting to be raked out. */
  ash?: number;
}

/** A smelter is three subtiles one way and two the other: six in all. */
export const SMELTER_W = 3;
export const SMELTER_H = 2;
export const SMELTER_CAPACITY = 20;
/** What to call it: a plain smelter, or the rarity it was built with. */
export const smelterName = (s: { rare?: number }): string => {
  const rare = rarityOf(s).name;
  return rare ? `${rare.charAt(0).toUpperCase()}${rare.slice(1)} smelter` : 'Smelter';
};
/** How many jobs this one will hold: the plain twenty, and more for a rare furnace. */
export const smelterCapacity = (s: { rare?: number }): number => roomFor(SMELTER_CAPACITY, s);

/**
 * Where its smoke comes out: the head of its stack, so high over the ground
 * in tenths of a metre (`HEIGHT_SCALE` units) and so far back from the middle
 * of its block toward the north, in tiles, as it is drawn (`forge.ts`).
 */
export const SMELTER_STACK_UP = 25.6;
export const SMELTER_STACK_BACK = 0.0325;
/**
 * How a fire's smoke goes up where it is not the island's plain plume
 * (\`Game.fires\`): how far it rises and how big its puffs, against the plain
 * one's, and how pale and warm, nought to one.
 */
export interface Plume { rise: number; size: number; pale: number }
/** A smelter's stack draws well: a short, thin, pale plume, a third the height of a campfire's; paler still while it works a charge. */
export const SMELTER_PLUME: Plume = { rise: 0.34, size: 0.5, pale: 0.8 };
export const SMELTER_PLUME_WORKING: Plume = { rise: 0.3, size: 0.46, pale: 1 };
export const smelterCentre = (s: PlacedSmelter): [number, number] => [s.x + (s.sx + SMELTER_W / 2) / SUBTILES, s.y + (s.sy + SMELTER_H / 2) / SUBTILES];

export function smelterCovers(s: { sx: number; sy: number }, sx: number, sy: number): boolean {
  return sx >= s.sx && sx < s.sx + SMELTER_W && sy >= s.sy && sy < s.sy + SMELTER_H;
}

/** Top-left subtile of the block a smelter would take, kept inside the tile. */
export function smelterAnchor(sx: number, sy: number): [number, number] {
  return [Math.max(0, Math.min(SUBTILES - SMELTER_W, sx)), Math.max(0, Math.min(SUBTILES - SMELTER_H, sy))];
}

/** How long its fuel keeps it hot: longer for an Ember Heart (`furnaceBurn`). */
export const smelterBurnsFor = (s: PlacedSmelter): string => {
  const secs = s.fuel / furnaceBurn(s);
  const m = Math.round(secs / 60);
  return m >= 60 ? `${(m / 60).toFixed(1)} hours` : m >= 1 ? `${m} minutes` : `${Math.round(secs)} seconds`;
};

/** What a job in the furnace is making, said plainly: a shovel head casting, an iron lump, an anvil. */
export const jobName = (job: SmeltJob): string =>
  job.makes === 'casting' && job.piece ? `${itemDef(job.piece).name.toLowerCase()} casting` : itemDef(job.makes).name.toLowerCase();

export function smelterState(s: PlacedSmelter): string {
  const heat = s.lit ? `lit, fuel ${smelterBurnsFor(s)}` : s.fuel > 0 ? `unlit, fuel ${smelterBurnsFor(s)}` : 'unlit, no fuel';
  const work = s.jobs.length ? ` · ${s.jobs.length} smelting` : '';
  const out = s.output.length ? ` · ${s.output.length} ready` : '';
  return `QL ${s.ql.toFixed(0)} · ${heat}${work}${out}${enchantTail(s)}`;
}

type SmelterTarget = Extract<Target, { kind: 'smelter' }>;
const smelterOf = (g: Game, t: Target): PlacedSmelter | undefined => (t.kind === 'smelter' ? g.smelters.get((t as SmelterTarget).id) : undefined);
const nearSmelter = (g: Game, s: PlacedSmelter): boolean => {
  const [cx, cy] = smelterCentre(s);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= 2.6;
};

/** Everything a smelter will take in: ore to smelt, or an anvil mould to cast. */
export function smeltableIn(g: Game, item: Item): { makes: string; seconds: number; ql: number } | null {
  const metal = METAL_BY_ORE.get(item.id);
  if (metal) return { makes: metal.lump, seconds: 0, ql: item.ql };
  return null;
}

export const SMELTER_ACTIONS: ActionDef[] = [
  {
    id: 'place_smelter',
    label: 'Set the smelter down',
    verb: 'setting the smelter down',
    hidden: true,
    stamina: 0.05,
    baseTime: 6,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return 'Choose a spot.';
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('smelter');
      if (!item || item.id !== 'smelter') return 'Need a smelter (crafting window).';
      if (!g.onDeed(t.x, t.y)) return DEED_PLACE;
      return g.smelterPlaceReason(t.x, t.y, t.sx, t.sy);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return;
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('smelter');
      if (!item || item.id !== 'smelter' || !g.inventory.remove(item.uid, 1)) return;
      const s = g.addSmelter(t.x, t.y, t.sx, t.sy, item.ql);
      // A rare furnace bedded in is a rare furnace: it holds a bigger charge.
      if (item.rare) s.rare = item.rare;
      // Its enchantment and its wear go down with it, and come up again with it (`enchanting.ts`).
      if (item.enchant) s.enchant = item.enchant;
      if (item.dmg) s.dmg = item.dmg;
      g.logMsg(`Set down: ${smelterName(s).toLowerCase()}, QL ${s.ql.toFixed(1)}, holds ${smelterCapacity(s)}.`, 'event');
      g.events.emit('world', s.x, s.y);
    },
  },
  {
    id: 'pick_up_smelter',
    label: 'Take it up',
    verb: 'taking the smelter up',
    stamina: 0.05,
    baseTime: 6,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (s.lit) return 'Put it out first.';
      if (s.jobs.length || s.output.length) return 'Empty it first.';
      if (Math.floor(s.ash ?? 0) >= 1) return 'Rake the ashes out first.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || s.lit || s.jobs.length || s.output.length) return;
      g.removeSmelter(s.id);
      const back = g.inventory.add('smelter', { ql: s.ql });
      if (s.rare) back.rare = s.rare;
      if (s.enchant) back.enchant = s.enchant;
      if (s.dmg) back.dmg = s.dmg;
      g.logMsg(`Picked up: ${smelterName(s).toLowerCase()}.`, 'event');
      g.events.emit('world', s.x, s.y);
    },
  },
  {
    id: 'fuel_smelter',
    label: 'Fuel',
    verb: 'feeding the smelter',
    hidden: true,
    quantity: true,
    stamina: 0.01,
    baseTime: 1.5,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      const item = fuelAtHand(g, t.kind === 'smelter' ? t.itemUid : undefined, g.forgeReach())?.item;
      if (!item) return `Need fuel: ${FUEL_SAID}.`;
      if (s.fuel >= FIRE_CAPACITY) return 'Fuel full.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter') return;
      const stack = fuelAtHand(g, t.itemUid, g.forgeReach());
      if (!stack) return;
      const item = stack.item;
      const per = FUEL_VALUES[item.id];
      const fits = Math.max(1, Math.min(Math.min(t.count ?? 1, item.count), Math.ceil(Math.max(0, FIRE_CAPACITY - s.fuel) / per)));
      if (!stack.spend(fits)) return;
      s.fuel = Math.min(FIRE_CAPACITY, s.fuel + per * fits);
      g.events.emit('smelter');
      g.logMsg(fuelledSaid(fits, itemDef(item.id).name, smelterBurnsFor(s)), 'event');
    },
  },
  {
    id: 'light_smelter',
    label: 'Light',
    verb: 'lighting the smelter',
    stamina: 0.04,
    baseTime: 6,
    applies: (t, g) => smelterOf(g, t)?.lit === false,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (s.lit) return 'Already lit.';
      if (s.fuel <= 0) return 'No fuel.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || s.lit) return;
      s.lit = true;
      g.events.emit('smelter');
      g.events.emit('world', s.x, s.y);
      g.logMsg(`Lit: smelter. Fuel: ${smelterBurnsFor(s)}.`, 'event');
    },
  },
  {
    id: 'damp_smelter',
    label: 'Damp it down',
    verb: 'damping the smelter',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => smelterOf(g, t)?.lit === true,
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return;
      s.lit = false;
      g.events.emit('smelter');
      g.events.emit('world', s.x, s.y);
      g.logMsg(`Put out: smelter. Fuel kept: ${smelterBurnsFor(s)}.`, 'event');
    },
  },
  {
    id: 'smelt_ore',
    label: 'Smelt',
    verb: 'charging the smelter',
    skill: 'smelting',
    hidden: true,
    quantity: true,
    instant: true,
    stamina: 0.01,
    baseTime: 0,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      const item = t.kind === 'smelter' && t.itemUid !== undefined ? g.stockEntry(t.itemUid, g.forgeReach())?.item : undefined;
      if (!item || !isOreItem(item.id)) return 'Ore only.';
      // A charge is one ore, which comes out as one lump.
      if (item.count < ORE_PER_LUMP) return `Need ${ORE_PER_LUMP} ore; have ${item.count}.`;
      if (s.jobs.length >= smelterCapacity(s)) return 'Smelter full.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter' || t.itemUid === undefined) return;
      const stack = g.stockEntry(t.itemUid, g.forgeReach());
      const item = stack?.item;
      const metal = item && METAL_BY_ORE.get(item.id);
      if (!stack || !item || !metal) return;
      /*
       * Charges, not ore. One charge is `ORE_PER_LUMP` of it and comes out as
       * one lump; that is one for one now, so "all" of a stack is the whole
       * stack, up to what the furnace will hold.
       */
      const want = Math.max(1, Math.floor((t.count ?? 1) / ORE_PER_LUMP));
      const n = Math.min(want, Math.floor(item.count / ORE_PER_LUMP), smelterCapacity(s) - s.jobs.length);
      if (n < 1) return;
      const taken: Item = { ...item, count: n * ORE_PER_LUMP };
      if (!stack.spend(n * ORE_PER_LUMP)) return;
      const seconds = smeltSeconds(metal.id, taken.ql, s.ql);
      for (let i = 0; i < n; i++) {
        s.jobs.push({ item: { ...taken, count: ORE_PER_LUMP }, makes: metal.lump, left: seconds, total: seconds, ql: taken.ql });
      }
      g.events.emit('smelter');
      // Smelting, for the journal: ore into the fire, which is the job; the lump is the furnace's to hand back later.
      g.note('smelted');
      g.logMsg(`Charged: ${n * ORE_PER_LUMP} × ${itemDef(taken.id).name.toLowerCase()}`
        + `${n > 1 ? `, ${n} charges` : ''}. Per charge: about ${Math.round(seconds)} seconds of heat, one lump.`, 'event');
    },
  },
  {
    id: 'melt_down',
    label: 'Melt down',
    verb: 'charging the smelter',
    skill: 'smelting',
    hidden: true,
    quantity: true,
    instant: true,
    stamina: 0.01,
    baseTime: 0,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      const item = t.kind === 'smelter' && t.itemUid !== undefined ? g.stockEntry(t.itemUid, g.forgeReach())?.item : undefined;
      if (!item) return 'Choose something to melt down.';
      const why = meltRefusal(item);
      if (why) return why;
      const n = Math.min(Math.max(1, (t.kind === 'smelter' ? t.count : undefined) ?? 1), item.count);
      if (s.jobs.length + meltLumps(item, n, g.perk('melt:share', MELT_SHARE)) > smelterCapacity(s)) return 'Smelter full.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter' || t.itemUid === undefined) return;
      const stack = g.stockEntry(t.itemUid, g.forgeReach());
      const item = stack?.item;
      const metal = item && metalOfItem(item);
      if (!stack || !item || !metal || meltRefusal(item)) return;
      const n = Math.min(Math.max(1, t.count ?? 1), item.count);
      // More of it, and better, for a Smith's Reclaimer.
      const lumps = meltLumps(item, n, g.perk('melt:share', MELT_SHARE));
      if (s.jobs.length + lumps > smelterCapacity(s)) return;
      const ql = meltQl(item, g.perk('melt:keep', MELT_KEEP));
      const taken: Item = { ...item, count: n };
      if (!stack.spend(n)) return;
      // Scrap is quicker than ore: it has been through the fire once already.
      const seconds = smeltSeconds(metal.id, item.ql, s.ql) * MELT_HEAT;
      for (let i = 0; i < lumps; i++) {
        s.jobs.push({ item: { ...taken, count: n }, makes: metal.lump, left: seconds, total: seconds, ql });
      }
      g.note('melted');
      g.events.emit('smelter');
      g.logMsg(`Melting: ${n > 1 ? `${n} × ` : ''}${itemDef(item.id).name.toLowerCase()}.`
        + ` Gives ${lumps} × ${metal.name.toLowerCase()} lump, about QL ${Math.round(ql)}.`, 'event');
    },
  },
  {
    id: 'cast_anvil',
    label: 'Cast an anvil',
    verb: 'filling the anvil mould',
    skill: 'blacksmithing',
    hidden: true,
    stamina: 0.04,
    baseTime: 6,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      const mould = g.inventory.find('anvil_mould');
      if (!mould) return 'Need an anvil mould.';
      const def = MOULD_BY_ID.get('anvil_mould');
      const lump = t.kind === 'smelter' && t.itemUid !== undefined ? g.stockEntry(t.itemUid, g.forgeReach())?.item : undefined;
      if (!lump || !isMetalStock(lump.id)) return 'Choose the metal to pour.';
      const metal = metalOfBar(lump.id) as { id: string; name: string };
      const need = def ? mouldLumps(def, metal.id) : 0;
      if (!need) return 'Need an anvil mould.';
      // An ingot counts as its lumps (a Smith's Ingots).
      if (lumpsIn(lump) < need) return `Need ${need} lumps of ${metal.name.toLowerCase()}.`;
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter' || t.itemUid === undefined) return;
      const mould = g.inventory.find('anvil_mould');
      const stack = g.stockEntry(t.itemUid, g.forgeReach());
      const lump = stack?.item;
      const metal = lump && METAL_BY_LUMP.get(lump.id);
      const def = MOULD_BY_ID.get('anvil_mould');
      if (!mould || !stack || !lump || !metal || !def) return;
      const need = mouldLumps(def, metal.id);
      if (lump.count < need || !stack.spend(need)) return;
      // The mould is spent by a piece this size, whatever quality it was.
      g.inventory.remove(mould.uid, 1);
      const ql = Math.max(1, Math.min(100, (lump.ql + mould.ql + g.productQl('blacksmithing')) / 3));
      const seconds = castSeconds(metal.id, ql);
      s.jobs.push({ item: { ...lump, count: need }, makes: 'anvil', left: seconds, total: seconds, ql });
      g.events.emit('smelter');
      g.logMsg(`Poured: ${need} × ${metal.name.toLowerCase()} lump into the anvil mould. Cools in about ${Math.round(seconds)} seconds.`, 'event');
    },
  },
  {
    id: 'pour_mould',
    label: 'Pour a mould',
    verb: 'pouring the mould',
    // Teaches the trade that formed the mould: asked, "pouring moulds should give blacksmithing experience".
    skill: MOULD_SKILL,
    hidden: true,
    stamina: 0.04,
    baseTime: 5,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      const mould = t.kind === 'smelter' && t.mouldUid !== undefined ? g.inventory.get(t.mouldUid) : undefined;
      const def = mould && MOULD_BY_ID.get(mould.id);
      if (!mould || !def) return 'Choose a mould.';
      if (def.makes === 'anvil') return 'Use Cast an anvil.';
      const lump = t.kind === 'smelter' && t.itemUid !== undefined ? g.stockEntry(t.itemUid, g.forgeReach())?.item : undefined;
      const metal = lump && metalOfBar(lump.id);
      if (!lump || !metal) return 'Need metal.';
      // A mould wants a weight of metal, and a lump of the rare six weighs a
      // tenth of what an iron one does, so it takes ten times as many of them.
      // An ingot counts as its lumps (a Smith's Ingots).
      const need = mouldLumps(def, metal.id);
      if (lumpsIn(lump) < need) return `Need ${need} lumps.`;
      if (s.jobs.length >= smelterCapacity(s)) return 'Smelter full.';
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter' || t.mouldUid === undefined || t.itemUid === undefined) return;
      const mould = g.inventory.get(t.mouldUid);
      const def = mould && MOULD_BY_ID.get(mould.id);
      const stack = g.stockEntry(t.itemUid, g.forgeReach());
      const lump = stack?.item;
      const metal = lump && METAL_BY_LUMP.get(lump.id);
      if (!mould || !def || def.makes === 'anvil' || !stack || !lump || !metal || s.jobs.length >= smelterCapacity(s)) return;
      const need = mouldLumps(def, metal.id);
      if (lump.count < need || !stack.spend(need)) return;
      // A worn mould pours worse, by half its damage -- or not at all, for a Smith's Clean Pour.
      const mouldQl = Math.max(1, mould.ql - mould.dmg * g.perk('pour:wear', MOULD_DENT));
      // Every filling wears the mould, and no mould can be mended. A hard
      // metal takes more out of it than a soft one, and a mould its maker
      // marked to last (a Smith's Hard Sand) takes that much less.
      mould.dmg = Math.min(100, mould.dmg + (mouldWear(mould.ql) * (1 + matOf(metal.name).difficulty / 30)) / markOf(mould, 'last'));
      const broke = mould.dmg >= 100;
      if (broke) g.inventory.remove(mould.uid, 1);
      g.events.emit('inventory');
      // The pour is the smelter's work: the metal, the mould and the hands at the furnace.
      const ql = Math.max(1, Math.min(100, (lump.ql + mouldQl + g.productQl('smelting')) / 3));
      const seconds = pourSeconds(def, metal.id, ql);
      const whole = castWhole(def);
      s.jobs.push({
        item: { ...lump, count: need }, makes: whole ? def.makes : 'casting', left: seconds, total: seconds, ql,
        extra: metal.name, piece: whole ? undefined : def.makes,
      });
      g.events.emit('smelter');
      g.logMsg(
        `Poured: ${need} × ${metal.name.toLowerCase()} lump into the ${itemDef(mould.id).name.toLowerCase()}. Cools in about ${Math.round(seconds)} seconds.${
          broke ? ' Mould broken.' : ` Mould: ${mouldUsesLeft(mould.ql, mould.dmg, markOf(mould, 'last'))} fillings left.`
        }`,
        'event',
      );
    },
  },
  {
    /*
     * A Smith's Ingots: lumps of one metal poured into bars at the smelter,
     * one bar a go, at the lumps' quality. A bar weighs `INGOT_WEIGHT` of what
     * its lumps did and counts as `INGOT_LUMPS` of them wherever the smelter,
     * the anvil, a recipe or Improve takes lumps; the island breaks into one
     * for what a job takes and gives the rest back as lumps.
     */
    id: 'pour_ingot',
    label: 'Pour ingots',
    verb: 'pouring ingots',
    skill: 'smelting',
    hidden: true,
    repeat: true,
    stamina: 0.03,
    baseTime: 4,
    applies: (t, g) => smelterOf(g, t) !== undefined && g.perk('ingot', 0) > 0,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      if (!nearSmelter(g, s)) return 'Stand next to the smelter.';
      if (g.perk('ingot', 0) <= 0) return 'Need perk: Ingots (Smith).';
      const lump = t.kind === 'smelter' && t.itemUid !== undefined ? g.stockEntry(t.itemUid, g.forgeReach())?.item : undefined;
      if (!lump || !METAL_BY_LUMP.has(lump.id)) return 'Choose the metal to pour.';
      if (lump.count < INGOT_LUMPS) return `Need ${INGOT_LUMPS} lumps; have ${lump.count}.`;
      return null;
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || t.kind !== 'smelter' || t.itemUid === undefined) return;
      const stack = g.stockEntry(t.itemUid, g.forgeReach());
      const lump = stack?.item;
      const metal = lump && METAL_BY_LUMP.get(lump.id);
      if (!stack || !lump || !metal || lump.count < INGOT_LUMPS) return;
      const { ql, rare, maker } = lump;
      if (!stack.spend(INGOT_LUMPS)) return;
      // Rare lumps pour a rare bar, and it goes on the pile of bars just like it.
      const bar: Item = { uid: g.inventory.nextUid++, id: ingotOf(metal), ql, dmg: 0, count: 1 };
      if (rare) bar.rare = rare;
      if (maker) bar.maker = maker;
      g.inventory.addItem(bar);
      g.events.emit('inventory');
      g.logMsg(`Poured: ${INGOT_LUMPS} × ${metal.name.toLowerCase()} lump into an ingot, QL ${ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'smelter_take_all',
    label: 'Take what is done',
    verb: 'emptying the smelter',
    stamina: 0.01,
    baseTime: 1,
    applies: (t, g) => smelterOf(g, t) !== undefined,
    check: (t, g) => {
      const s = smelterOf(g, t);
      if (!s) return 'It is gone.';
      return s.output.length ? null : 'Nothing finished yet.';
    },
    perform: (t, g) => {
      const s = smelterOf(g, t);
      if (!s || !s.output.length) return;
      const taken = s.output.splice(0, s.output.length);
      for (const it of taken) g.inventory.addItem(it);
      g.events.emit('smelter');
      const names = taken.map((it) => (it.count > 1 ? `${it.count} × ${itemName(it).toLowerCase()}` : itemName(it).toLowerCase()));
      g.logMsg(`Taken from smelter: ${names.join(', ')}.`, 'event');
    },
  },
  {
    id: 'take_ashes_smelter',
    label: 'Rake out the ashes',
    verb: 'raking out ashes',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => {
      const h = smelterOf(g, t);
      return !!h && hasAshes(h);
    },
    check: (t, g) => {
      const h = smelterOf(g, t);
      if (!h) return 'It is gone.';
      if (!nearSmelter(g, h)) return 'Stand next to the smelter.';
      return hasAshes(h) ? null : 'No ashes yet.';
    },
    perform: (t, g) => {
      const h = smelterOf(g, t);
      if (h) rakeAshes(g, h, 'smelter');
    },
  },
];

export const SMELTER_ACTION_BY_ID = new Map(SMELTER_ACTIONS.map((a) => [a.id, a]));
