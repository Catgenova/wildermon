import { ACTION_BY_ID, REPAIR_FLOOR, repairGo } from './actions';
import type { Game } from './game';
import {
  canImprove, IMPROVE_DAMAGE, IMPROVE_FAIL_LEAST, IMPROVE_FAIL_SPREAD, improvable, improveCeiling, improveStep, lockTakes, stockKinds,
  type StockLock,
} from './improve';
import { unmendable, unrestored, type Item } from './items';
import { matOf } from './materials';
import { WHETSTONE } from './relicuse';

/**
 * Improve and repair, in one window (`src/ui/panels/mend.ts`): what is held and how damaged, Repair all and
 * Hone all, and for one piece every pass the stock at hand allows and a run of improve-and-repair cycles.
 *
 * Asked for: "a single custom UI for Improving and Repairing. One section to queue repairing all held
 * equipment or using held ancient whetstones. For improving item a comprehensive interface to show material
 * needed/held to improve and a way to bulk queue improve&repair cycles".
 *
 * **Held equipment** is what is loose in the pack -- worn and wielded things included, which are in it -- and
 * is equipment: worn, or a thing Improve works on (`canImprove`: tools, weapons, armour, shields, packs,
 * furniture). Not what is stowed in a bag, which Repair does not reach (`Inventory.get`), and not food or
 * materials. The island's `private.held_gear`.
 *
 * Nothing here decides anything: these are the numbers the rules give, for the window to show, and the
 * targets it asks the island for. The island does the work and stops the runs (`private.job_follow`).
 */

/** The most goes one ask is taken for, as the island takes it (`rpc_act`'s `p_times`). */
export const JOB_GOES_MOST = 100;

/** Whether a thing in the pack is equipment: worn, or improvable. */
export const isEquipment = (g: Game, it: Item): boolean => g.isEquipped(it.uid) || canImprove(it.id);

/** Held equipment, in the pack's order. */
export const heldEquipment = (g: Game): Item[] => g.inventory.items.filter((it) => isEquipment(g, it));

/** The order Repair all and Hone all go in: the most damaged first, then the oldest. The island's the same. */
export const byDamage = (a: Item, b: Item): number => b.dmg - a.dmg || a.uid - b.uid;

/** Why Repair will not take this piece now, or null: Repair's own refusal. */
export const repairRefusal = (g: Game, it: Item): string | null =>
  ACTION_BY_ID.get('repair_item')?.check?.({ kind: 'item', uid: it.uid }, g) ?? null;

/** What Repair all goes through, in its order: held equipment Repair takes now. */
export const repairQueue = (g: Game): Item[] => heldEquipment(g).filter((it) => it.dmg > 0 && !repairRefusal(g, it)).sort(byDamage);

/** Whether an ancient whetstone takes this piece, whetstones aside: damaged, restored where it is a find, not restored gear. */
export const honeable = (it: Item): boolean => it.dmg > 0 && it.id !== WHETSTONE && !unrestored(it) && !unmendable(it);

/** Ancient whetstones held: loose in the pack, as a hone draws them. */
export const whetstonesHeld = (g: Game): number => g.inventory.count(WHETSTONE);

/** What Hone all goes through, in its order: held equipment a whetstone takes, one whetstone each, as many as are held. */
export const honeQueue = (g: Game): Item[] => heldEquipment(g).filter(honeable).sort(byDamage).slice(0, whetstonesHeld(g));

/** Damage one go of Repair takes out in these hands: `repairGo`, more for a Mender's Big Mend. */
export const repairHealed = (g: Game): number => repairGo(g.skills.get('repair')).healed * g.perk('mend:repair_item', 1);

/** QL one point of damage repaired costs in these hands: `repairGo`, less for a Mender's Light Touch. */
export const repairQlPerPoint = (g: Game): number => repairGo(g.skills.get('repair')).cost * g.perk('cost:repair_item', 1);

/** Goes of Repair to take this much damage to nought, at most a job's goes. The island's `private.repair_goes`. */
export const repairGoes = (g: Game, dmg: number): number =>
  dmg <= 0 ? 0 : Math.max(1, Math.min(JOB_GOES_MOST, Math.ceil(dmg / repairHealed(g) - 1e-9)));

/** Seconds a go of a job takes in these hands now (`Game.duration`), or nought for a job there is not. */
export const goSecs = (g: Game, action: string): number => {
  const def = ACTION_BY_ID.get(action);
  return def ? g.duration(def) : 0;
};

/** One piece repaired to nought: goes, seconds and the QL it costs (not under `REPAIR_FLOOR`). */
export function repairCost(g: Game, it: Item): { goes: number; secs: number; ql: number } {
  const goes = repairGoes(g, it.dmg);
  return { goes, secs: goes * goSecs(g, 'repair_item'), ql: Math.min(Math.max(0, it.ql - REPAIR_FLOOR), it.dmg * repairQlPerPoint(g)) };
}

/* ---- improving ---------------------------------------------------------------------------------- */

/** Every tool a piece's material asks for, and whether each is in the pack. Kept, not used up. */
export const improveTools = (g: Game, it: Item): Array<{ id: string; held: boolean }> =>
  (improvable(it.id)?.material.tools ?? []).map((id) => ({ id, held: g.inventory.has(id) }));

/** The QL a pass may take this piece to: your skill's ceiling (`improveCeiling`), never past 99.9. */
export const improveTop = (g: Game, it: Item): number => {
  const what = improvable(it.id);
  return what ? Math.min(99.9, improveCeiling(g, what.skill, it)) : it.ql;
};

/** The chance a pass at this QL comes off: `perform_item`'s skill check, at the best of the material's tools. */
export function passChance(g: Game, it: Item, ql = it.ql): number {
  const what = improvable(it.id);
  if (!what) return 0;
  const toolQl = Math.max(0, ...what.material.tools.map((id) => g.toolQl(id)));
  return g.skillChance(what.skill, 12 + ql / 3 + matOf(it.extra).difficulty, toolQl, g.mindEase());
}

/** Stock of one kind at hand for a pass: carried and in the stores within reach. */
export const lockAtHand = (g: Game, lock: StockLock): number =>
  g.stockOf((s) => lockTakes(lock, s)).reduce((n, s) => n + s.item.count, 0);

/** The kind a pass would draw first, which a run is held to unless another is chosen. */
export const firstKind = (g: Game, it: Item): StockLock | undefined => stockKinds(g, it)[0]?.lock;

/** One pass ahead: its QL from and to if it comes off, its chance, and the stock left after it. */
export interface PassRow {
  n: number;
  from: number;
  to: number;
  chance: number;
  left: number;
}

/**
 * The passes ahead, as many as the stock of one kind at hand allows (and no more than a job's goes), each
 * as it would go if every pass before it came off: one of the stock a pass, whether it comes off or not.
 * Stops at the piece's top.
 */
export function passesAhead(g: Game, it: Item, lock: StockLock): PassRow[] {
  const what = improvable(it.id);
  if (!what) return [];
  const top = improveTop(g, it);
  const have = lockAtHand(g, lock);
  const rows: PassRow[] = [];
  let ql = it.ql;
  for (let n = 1; n <= Math.min(have, JOB_GOES_MOST) && ql < top; n++) {
    const to = Math.min(top, ql + improveStep(g, it, what.skill, ql));
    rows.push({ n, from: ql, to, chance: passChance(g, it, ql), left: have - n });
    ql = to;
  }
  return rows;
}

/** Why a run of cycles ends: the count asked for, the stock held to, the QL asked for, or the piece's top. */
export type CycleStop = 'count' | 'stock' | 'target' | 'top';

/** A run of improve-and-repair cycles, as the rules make it on the average. */
export interface CyclePlan {
  /** Passes it is expected to run, each one of the stock. */
  passes: number;
  stop: CycleStop;
  /** What each stop comes to on its own: the count, the stock at hand, and the expected passes to the target and to the top. */
  count: number;
  stock: number;
  toTarget: number | null;
  toTop: number | null;
  /** Repairs between passes: goes, and the QL they cost. */
  repairGoes: number;
  repairQl: number;
  /** The QL it ends at, and the seconds it takes. */
  endQl: number;
  secs: number;
}

/** Damage a failed pass puts on the piece on the average. */
export const FAIL_DAMAGE_MEAN = IMPROVE_FAIL_LEAST + IMPROVE_FAIL_SPREAD / 2;

/**
 * A run of `count` cycles on this piece held to one kind of stock, stopping at `upto` if one is asked for.
 *
 * Each cycle is a pass of Improve: one of the stock, the step on the piece if it comes off (`passChance`),
 * and damage if it fails. When the damage is over `IMPROVE_DAMAGE` the piece is repaired to nought before
 * the next pass, and after the last (`private.job_follow`). On the average, so the passes to a QL and the
 * repairs are expected numbers; the count and the stock are exact.
 */
export function cyclePlan(g: Game, it: Item, lock: StockLock, count: number, upto?: number): CyclePlan {
  const what = improvable(it.id);
  const top = improveTop(g, it);
  const stock = lockAtHand(g, lock);
  const healed = repairHealed(g);
  const perPoint = repairQlPerPoint(g);
  /** The run on the average from where the piece is, pass by pass, until `done` says it is over or the piece is at its top. */
  const run = (done: (k: number, ql: number) => boolean): { k: number; ql: number; repairs: number; lost: number } => {
    let ql = it.ql;
    let dmg = it.dmg;
    let repairs = 0;
    let lost = 0;
    const repair = (): void => {
      repairs += Math.ceil(dmg / healed - 1e-9);
      const cost = Math.min(Math.max(0, ql - REPAIR_FLOOR), dmg * perPoint);
      lost += cost;
      ql -= cost;
      dmg = 0;
    };
    let k = 0;
    for (; what && k < 10000; k++) {
      if (dmg > IMPROVE_DAMAGE) repair();
      if (ql >= top - 1e-9 || done(k, ql)) break;
      const p = passChance(g, it, ql);
      ql = Math.min(top, ql + p * improveStep(g, it, what.skill, ql));
      dmg += (1 - p) * FAIL_DAMAGE_MEAN;
    }
    if (dmg > IMPROVE_DAMAGE) repair();
    return { k, ql, repairs, lost };
  };
  // Each stop on its own: passes to the QL asked for, and to the piece's top, with no count and no stock.
  const free = run(() => false);
  const toTop = free.ql >= top - 1e-9 ? free.k : null;
  const target = upto === undefined ? null : run((_k, ql) => ql >= upto);
  const toTarget = target && upto !== undefined && target.ql >= upto - 1e-9 ? target.k : null;
  // And the run itself: the first of them to come.
  const ends: Array<[CycleStop, number]> = [['count', count], ['stock', stock]];
  if (toTarget !== null) ends.push(['target', toTarget]);
  if (toTop !== null) ends.push(['top', toTop]);
  const [stop, passes] = ends.reduce((a, b) => (b[1] < a[1] ? b : a));
  const done = run((k) => k >= passes);
  return {
    passes,
    stop,
    count,
    stock,
    toTarget,
    toTop,
    repairGoes: done.repairs,
    repairQl: done.lost,
    endQl: done.ql,
    secs: passes * goSecs(g, 'improve_item') + done.repairs * goSecs(g, 'repair_item'),
  };
}
