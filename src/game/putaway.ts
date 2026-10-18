import { ACTION_BY_ID, type Target } from './actions';
import { crateCentre, crateKindOfItem, crateName, STORE_REACH } from './crates';
import { furnitureCentre, furnitureDef, furnitureHolds, furnitureName, isFurniture } from './furniture';
import type { Game } from './game';
import { isGrave } from './graves';
import type { Item } from './items';

/**
 * Put away: every loose stack in the pack goes into a store within reach that
 * already holds that kind of thing. The open-store window's "Put in what it
 * holds" does this for the one store open; this is it over every store you
 * can reach without moving, so a pack is emptied into the crates and chests
 * round a workshop in one go.
 *
 * Each stack goes through the store's own job (`store_in_crate`,
 * `store_in_furniture`), asked of the island when there is one, so whatever
 * the store will and will not take is the job's to say: full, padlocked, a
 * settlement store your rank may not use. A store is only offered one when
 * it is within `STORE_REACH`, because a job aimed at one further off walks to
 * the nearest instead. Somebody else's chest or cart that is not a settlement
 * store is left alone, though the job would take it.
 */
export interface PutAway {
  item: Item;
  /** Where it goes: the store's id, its kind, and what it is called. */
  into: { kind: 'crate' | 'furniture'; id: number; name: string };
}

/** The stores within reach that will take a thing, as the jobs would. */
function storesFor(g: Game, item: Item): PutAway['into'][] {
  const { x, y } = g.player;
  const near = ([cx, cy]: [number, number]): boolean => Math.hypot(cx - x, cy - y) <= STORE_REACH;
  const out: Array<PutAway['into'] & { d: number }> = [];
  const crateJob = ACTION_BY_ID.get('store_in_crate');
  const pieceJob = ACTION_BY_ID.get('store_in_furniture');
  const ask = (job: typeof crateJob, id: number): boolean => {
    const t: Target = { kind: 'item', uid: item.uid, count: item.count, into: id };
    return !!job && job.applies(t, g) && !job.check?.(t, g);
  };
  if (!crateKindOfItem(item.id)) {
    for (const c of g.crates.values()) {
      if (!c.items.some((it) => it.id === item.id) || !g.onMySide(c.level, c.x, c.y)) continue;
      const at = crateCentre(c);
      if (near(at) && ask(crateJob, c.id)) out.push({ kind: 'crate', id: c.id, name: crateName(c).toLowerCase(), d: Math.hypot(at[0] - x, at[1] - y) });
    }
  }
  if (!isFurniture(item.id)) {
    for (const f of g.furnitureWithin(Math.ceil(STORE_REACH))) {
      if (!furnitureHolds(f) || isGrave(f) || f.kind === 'mailbox' || furnitureDef(f.kind).trash || furnitureDef(f.kind).stall) continue;
      if (f.mine === false && !f.storeOf) continue;
      if (!f.items.some((it) => it.id === item.id)) continue;
      const at = furnitureCentre(f);
      if (near(at) && ask(pieceJob, f.id)) out.push({ kind: 'furniture', id: f.id, name: furnitureName(f).toLowerCase(), d: Math.hypot(at[0] - x, at[1] - y) });
    }
  }
  return out.sort((a, b) => a.d - b.d).map(({ kind, id, name }) => ({ kind, id, name }));
}

/** What would go where: every loose stack that some store within reach already holds the like of, to the nearest of them. */
export function putAwayPlan(g: Game): PutAway[] {
  const plan: PutAway[] = [];
  for (const item of g.inventory.items) {
    if (item.locked || item.creature !== undefined || g.isEquipped(item.uid)) continue;
    const into = storesFor(g, item)[0];
    if (into) plan.push({ item, into });
  }
  return plan;
}

/** Seconds between two asks of the island, so a full pack does not go up as one burst (`too_fast`). */
export const PUT_AWAY_SPACING = 0.15;

/**
 * Put it all away. Alone each job is done at once and says where each stack
 * went; on an island the asks go up one after another, each answered by the
 * island. Says so when there is nothing to put anywhere.
 */
export function putAway(g: Game, later: (fn: () => void, ms: number) => void = (fn, ms) => setTimeout(fn, ms)): number {
  const plan = putAwayPlan(g);
  if (!plan.length) {
    g.logMsg('Nothing in your pack goes in a store within reach: a store takes what it already holds the like of.', 'error');
    return 0;
  }
  plan.forEach((p, i) => {
    const job = ACTION_BY_ID.get(p.into.kind === 'crate' ? 'store_in_crate' : 'store_in_furniture');
    if (!job) return;
    const go = (): void => {
      // Still in the pack, and as many as are left of it.
      const item = g.inventory.get(p.item.uid);
      if (item) g.requestAction(job, { kind: 'item', uid: item.uid, count: item.count, into: p.into.id });
    };
    if (g.ask && i > 0) later(go, i * PUT_AWAY_SPACING * 1000);
    else go();
  });
  return plan.length;
}
