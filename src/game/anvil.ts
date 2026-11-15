import { tryGain } from './learn';
import { damageDrawn, failDamagedSaid } from './faildamage';
import { swingEnchant, type Enchant } from './enchant';
import type { ActionDef, Target } from './actions';
import { SUBTILES } from './crates';
import type { Game } from './game';
import type { Side } from './building';
import { madeBy } from './signing';
import { pressStamp } from './relicuse';
import { itemDef, makersMark, rareInputSaid, rarityOf, rarityTally, rollRarityFrom, RARITY_ODDS, RARITY_WORD } from './items';
import { matOf, workingQl } from './materials';
import { metalOfItem } from './melt';
import { castingGateRefusal } from './craftgates';
import { isCasting, METAL_BY_ID, MOULD_BY_MAKES, SMITH_TOOL, type MouldDef } from './metal';
import type { CraftStock } from './recipes';

/**
 * An anvil: cast whole in a smelter, set down on four subtiles, and the place
 * every casting is beaten true. What it is made of shows in its colour and in
 * how kindly it treats the work.
 */
export interface PlacedAnvil {
  id: number;
  /** The enchantment set into it where it stands (`enchanting.ts`), which it keeps through being picked up and set down. */
  enchant?: Enchant;
  /** How far gone it is, out of a hundred: a scroll that did not take on it (`enchanting.ts`). Absent is none. */
  dmg?: number;
  /** When `dmg` was last charged for decay, in epoch seconds (the island's `placed.decay_at`, `stationDmg`); absent for none owed. */
  decayAt?: number;
  /** 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things. */
  rare?: number;
  /**
   * Whose this is, on an island. Absent in the game you play by yourself,
   * where everything on the ground is yours because there is only you.
   */
  mine?: boolean;

  x: number;
  y: number;
  /** Top-left subtile of its two by two block. */
  sx: number;
  sy: number;
  /** Which way its horn points, as it was set down; south when unsaid. */
  facing?: Side;
  /** Metal it was cast from. */
  metal: string;
  ql: number;
}

/** An anvil covers two subtiles each way: four in all. */
/** What one go at the anvil teaches, whichever way it comes out. */
export const SMITH_GAIN = 0.5;

export const ANVIL_SUBTILES = 2;

export const anvilCentre = (a: PlacedAnvil): [number, number] => [a.x + (a.sx + 1) / SUBTILES, a.y + (a.sy + 1) / SUBTILES];
export const anvilCovers = (a: { sx: number; sy: number }, sx: number, sy: number): boolean =>
  sx >= a.sx && sx < a.sx + ANVIL_SUBTILES && sy >= a.sy && sy < a.sy + ANVIL_SUBTILES;
export const anvilAnchor = (sx: number, sy: number): [number, number] => [
  Math.max(0, Math.min(SUBTILES - ANVIL_SUBTILES, sx)),
  Math.max(0, Math.min(SUBTILES - ANVIL_SUBTILES, sy)),
];
/** What to call it: the metal it was cast from, and the rarity it was cast with. */
export const anvilName = (a: PlacedAnvil): string => {
  const plain = `${METAL_BY_ID.get(a.metal)?.name ?? 'Iron'} anvil`;
  const rare = rarityOf(a).name;
  return rare ? `${rare.charAt(0).toUpperCase()}${rare.slice(1)} ${plain.toLowerCase()}` : plain;
};

type AnvilTarget = Extract<Target, { kind: 'anvil' }>;
const anvilOf = (g: Game, t: Target): PlacedAnvil | undefined => (t.kind === 'anvil' ? g.anvils.get((t as AnvilTarget).id) : undefined);


/**
 * The casting to beat out: the one the player chose, or the first there is
 * when none was. From the same stock a craft spends -- the pack, a bag on
 * your back, a store within `CRAFT_REACH`, or further for a Smith's Forge
 * Reach -- so castings left in a crate beside the anvil are as good as
 * castings carried.
 */
function castingFor(g: Game, uid?: number): CraftStock | undefined {
  if (uid === undefined) return g.stockOf(isCasting, g.forgeReach())[0];
  const s = g.stockEntry(uid, g.forgeReach());
  return s && isCasting(s.item) ? s : undefined;
}

/** What else a casting's piece takes at the anvil (`MouldDef.also`) at hand, from the same stock as the casting. */
const alsoStock = (g: Game, def: MouldDef): CraftStock[] => (def.also ? g.stockOf((it) => it.id === def.also?.item, g.forgeReach()) : []);
/** Why a casting's piece cannot be beaten out for want of what else it takes (`MouldDef.also`), or null with enough at hand. The island's `forge_refusal`. */
export const mouldAlsoRefusal = (def: MouldDef, have: number): string | null =>
  def.also && have < def.also.count ? `Need ${def.also.count} × ${itemDef(def.also.item).name.toLowerCase()}.` : null;

/** What the anvil is worth to beat on: its quality, and how hard its own metal is. */
export const anvilQl = (a: PlacedAnvil): number => workingQl(a.ql, METAL_BY_ID.get(a.metal)?.name);

/**
 * How good a piece comes out: the smith, the mould, the metal and the anvil
 * all have a say. A casting carries the mould and the metal it was poured
 * from in its one quality, which stands for both here.
 */
export function smithQl(g: Game, def: MouldDef, mouldQl: number, lumpQl: number, anvil: PlacedAnvil): number {
  const skill = g.skills.get(def.skill);
  return Math.max(1, Math.min(100, (g.productQl(def.skill) + mouldQl + lumpQl + anvilQl(anvil)) / 4 + skill / 25));
}

/**
 * A roll at the anvil, with a Smith's Sure Hammer: a failure stands only one
 * time in `fail:` of the job, as `perk_pass` has it on the island. No perk,
 * no second roll, so the dice fall as they always did for everybody else.
 */
function sureHand(g: Game, job: string, ok: boolean): boolean {
  const fail = g.perk(`fail:${job}`, 1);
  return ok || (fail < 1 && g.rand() >= fail);
}

/** What a Smith's Second Heat says when it spares a failed casting its damage. The island says the same. */
export const SECOND_HEAT = 'Second Heat: casting undamaged.';

export const ANVIL_ACTIONS: ActionDef[] = [
  {
    id: 'place_anvil',
    label: 'Set the anvil down',
    verb: 'setting the anvil down',
    hidden: true,
    stamina: 0.05,
    baseTime: 4,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return 'Choose a spot.';
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('anvil');
      if (!item || item.id !== 'anvil') return 'Need an anvil.';
      return g.anvilPlaceReason(t.x, t.y, t.sx, t.sy);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile' || t.sx === undefined || t.sy === undefined) return;
      const item = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.find('anvil');
      if (!item || item.id !== 'anvil' || !g.inventory.remove(item.uid, 1)) return;
      const a = g.addAnvil(t.x, t.y, t.sx, t.sy, item.extra ?? 'copper', item.ql, t.facing);
      // An anvil that was rare on your shoulder is rare on the ground.
      if (item.rare) a.rare = item.rare;
      // Its enchantment and its wear go down with it, and come up again with it (`enchanting.ts`).
      if (item.enchant) a.enchant = item.enchant;
      if (item.dmg) a.dmg = item.dmg;
      g.logMsg(`Set down: ${anvilName(a).toLowerCase()}.`, 'event');
      g.events.emit('world', a.x, a.y);
    },
  },
  {
    id: 'pick_up_anvil',
    label: 'Take the anvil up',
    verb: 'lifting the anvil',
    stamina: 0.08,
    baseTime: 5,
    applies: (t, g) => anvilOf(g, t) !== undefined,
    perform: (t, g) => {
      const a = anvilOf(g, t);
      if (!a) return;
      g.removeAnvil(a.id);
      const back = g.inventory.add('anvil', { ql: a.ql, extra: a.metal });
      if (a.rare) back.rare = a.rare;
      if (a.enchant) back.enchant = a.enchant;
      if (a.dmg) back.dmg = a.dmg;
      g.logMsg(`Picked up: ${anvilName(a).toLowerCase()}.`, 'event');
      g.events.emit('world', a.x, a.y);
    },
  },
  {
    id: 'smith',
    label: 'Smith',
    verb: 'working the metal',
    hidden: true,
    tool: SMITH_TOOL,
    stamina: 0.06,
    baseTime: 9,
    applies: (t, g) => anvilOf(g, t) !== undefined,
    check: (t, g) => {
      const a = anvilOf(g, t);
      if (!a) return 'It is gone.';
      const [cx, cy] = anvilCentre(a);
      if (Math.hypot(cx - g.player.x, cy - g.player.y) > 2.4) return 'Stand at the anvil.';
      if (!g.inventory.has(SMITH_TOOL)) return `Need a ${itemDef(SMITH_TOOL).name.toLowerCase()}.`;
      // A casting poured at the smelter, which is the only thing an anvil takes.
      const named = t.kind === 'anvil' ? t.itemUid : undefined;
      const casting = castingFor(g, named)?.item;
      if (!casting) return named !== undefined ? 'Choose a casting.' : 'Need a casting (pour a mould at a smelter).';
      const def = MOULD_BY_MAKES.get(casting.piece as string);
      if (!def) return 'Choose a casting.';
      // Its metal's gate in the trade it is worked in (`craftgates.ts`, kind `casting`, off `METAL_GATE`): "Tin casting:
      // needs weaponsmithing 10; have 2.3." The island's `casting_gate_refusal`.
      const gated = castingGateRefusal(g, casting);
      if (gated) return gated;
      return mouldAlsoRefusal(def, alsoStock(g, def).reduce((n, s) => n + s.item.count, 0));
    },
    perform: (t, g) => {
      const a = anvilOf(g, t);
      if (!a || t.kind !== 'anvil') return;
      const stack = castingFor(g, t.itemUid);
      const casting = stack?.item;
      const def = casting && MOULD_BY_MAKES.get(casting.piece as string);
      if (!stack || !casting || !def) return;
      const metal = metalOfItem(casting);
      const metalWord = (metal?.name ?? casting.extra ?? 'metal').toLowerCase();
      // The deeper the seam it came out of, the harder it is to beat into shape.
      // The roll comes before the casting is spent, so that a Smith's Second
      // Heat has a casting to keep; the island rolls in the same order.
      const hard = def.difficulty + matOf(casting.extra).difficulty;
      if (!sureHand(g, 'smith', g.skillCheck(def.skill, hard, anvilQl(a), g.mindEase()))) {
        // The casting is not used up: it is damaged by its QL (`faildamage.ts`), and not at all for a Smith's Second Heat.
        const kept = g.perk('spare:smith', 0) > 0 && g.rand() < g.perk('spare:smith', 0);
        const hurt = kept ? [] : damageDrawn([stack], 1);
        g.events.emit('inventory');
        g.gainSkill(def.skill, tryGain(false, SMITH_GAIN));
        const head = `Failed: ${itemDef(def.makes).name.toLowerCase()}.`;
        g.logMsg(kept ? `${head} ${SECOND_HEAT}` : failDamagedSaid(head, hurt), 'event');
        return;
      }
      // The one casting is all that goes into it, for what a rare one puts on
      // the chance of a rare piece (`rarityBands`).
      const used = rarityTally();
      used[casting.rare ?? 0] += 1;
      if (!stack.spend(1)) return;
      // And what else the piece takes (`MouldDef.also`), spent with it.
      let owed = def.also?.count ?? 0;
      for (const s of alsoStock(g, def)) {
        const take = Math.min(owed, s.item.count);
        if (take > 0 && s.spend(take)) owed -= take;
      }
      g.events.emit('inventory');
      // The casting carries the mould and the metal it was poured from, so it
      // stands for both. More for a Smith's Toolsmith on a tool's head or blade.
      const ql = Math.min(100, smithQl(g, def, casting.ql, casting.ql, a) * g.perk(`ql:${def.makes}`, 1) + swingEnchant(a, 'master'));
      g.gainSkill(def.skill, tryGain(true, SMITH_GAIN));
      // More to a filling for a Smith's Nail Maker, as `count:` has it on the island.
      const per = g.perk(`count:${def.makes}`, def.per ?? 1);
      // And what the smith's perks put into it (a Smith's Keen Edge, Mail
      // Maker, Temper Bath), which goes with it into whatever it is fitted to.
      const mark = makersMark((k, d) => g.perk(k, d), def.makes);
      const made = g.inventory.add(def.makes, { ql, extra: casting.extra, count: per, mark });
      // Rarer odds for a Smith's Master's Mark, as `rare:smith` has it on the
      // island, and for a rare casting.
      // And twice the chance of the first step with an ancient stamp carried, which a go comes off (`pressStamp`).
      const rare = rollRarityFrom(g.rand, used, pressStamp(g, g.perk('rare:smith', RARITY_ODDS[0])));
      const rareIn = rareInputSaid(used);
      if (rareIn) g.logMsg(rareIn, 'event');
      // One thing beaten out at the signing QL carries its maker's name as rare work does (`signing.ts`).
      const by = madeBy(g.player.name, def.makes, made.ql);
      if (by) made.maker = by;
      if (rare) {
        made.rare = rare;
        made.maker = g.player.name;
        g.note(['', 'rare', 'supreme', 'fantastic'][rare]);
        g.logMsg(RARITY_WORD[rare], 'skill');
      }
      g.note('smithed');
      g.madeIt(def.makes, made.ql, per, rare);
      if (metal && ['adamantine', 'glimmersteel', 'mithril', 'seryll'].includes(metal.id)) g.note('moonmetal');
      g.logMsg(
        `Smithed: ${per > 1 ? `${per} × ` : ''}${metalWord} ${itemDef(def.makes).name.toLowerCase()}, QL ${made.ql.toFixed(1)}.`,
        'event',
      );
    },
  },
];

export const ANVIL_ACTION_BY_ID = new Map(ANVIL_ACTIONS.map((a) => [a.id, a]));
