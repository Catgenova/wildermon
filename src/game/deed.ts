import type { ActionDef } from './actions';
import { deedLevel, deedRadiusAt, deedWorkersAt, MAX_DEED_LEVEL, type Deed, type Game } from './game';
import { isFounder, lacks, permsHeld, rankMay, rankName } from './ranks';

/**
 * Settlement upgrades. Each one pushes the border out two tiles and lets one
 * more wildermon work the deed, and each has to be earned by building the
 * settlement up first.
 *
 * Counted on the settlement being upgraded, which is your own or, for a rank
 * its founder let upgrade, one you are a citizen of.
 */
export interface DeedRequirement {
  label: string;
  met(g: Game, d: Deed): boolean;
}

const inside = (d: Deed, x: number, y: number): boolean => Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius;

const crates = (n: number): DeedRequirement => ({
  label: n === 1 ? 'A crate on the deed' : `${n} crates on the deed`,
  met: (g, d) => [...g.crates.values()].filter((c) => inside(d, c.x, c.y)).length >= n,
});

const campfires = (n: number): DeedRequirement => ({
  label: n === 1 ? 'A campfire on the deed' : `${n} campfires on the deed`,
  met: (g, d) => [...g.campfires.values()].filter((f) => inside(d, f.x, f.y)).length >= n,
});

const buildings = (n: number): DeedRequirement => ({
  label: n === 1 ? 'A building with every ground-floor wall up' : `${n} buildings with every ground-floor wall up`,
  met: (g, d) =>
    [...g.buildings.list.values()].filter((b) => {
      const [bx, by] = (b.tiles[0] ?? '').split(',').map(Number);
      return Number.isFinite(bx) && inside(d, bx, by) && g.buildings.levelComplete(b, 0);
    }).length >= n,
});

const smelters = (n: number): DeedRequirement => ({
  label: n === 1 ? 'A stone smelter on the deed' : `${n} stone smelters on the deed`,
  met: (g, d) => [...g.smelters.values()].filter((s) => inside(d, s.x, s.y)).length >= n,
});

const anvils = (n: number): DeedRequirement => ({
  label: n === 1 ? 'An anvil set down on the deed' : `${n} anvils set down on the deed`,
  met: (g, d) => [...g.anvils.values()].filter((a) => inside(d, a.x, a.y)).length >= n,
});

/**
 * Its founder's wildermon at work on it. Your own, when it is yours; for one
 * you are a citizen of, the ones you can see working inside its border, and
 * the island counts the founder's and has the last word.
 */
const workers = (n: number): DeedRequirement => ({
  label: n === 1 ? 'A wildermon working the deed' : `${n} wildermon working the deed`,
  met: (g, d) => (isFounder(d) ? g.creatures.workers()
    : [...g.creatures.list.values()].filter((c) => c.mode === 'deed' && c.post === null && inside(d, Math.floor(c.x), Math.floor(c.y)))).length >= n,
});

/**
 * What each level beyond the first asks for. Upgrades are taken in order, so
 * each level's own requirement is the new thing the settlement has to show;
 * everything the levels below wanted is already standing.
 */
export const DEED_UPGRADES: Record<number, DeedRequirement[]> = {
  2: [crates(1), campfires(1)],
  3: [smelters(1)],
  4: [anvils(1)],
  5: [buildings(1), workers(3)],
};

export const nextDeedLevel = (d: Deed | null): number | null => (d && deedLevel(d) < MAX_DEED_LEVEL ? deedLevel(d) + 1 : null);

/** Requirements for the next upgrade of a settlement (yours, by default), each marked met or not. */
export function upgradeProgress(g: Game, d: Deed | null = g.deed): Array<{ label: string; met: boolean }> {
  const next = nextDeedLevel(d);
  if (!d || !next) return [];
  return (DEED_UPGRADES[next] ?? []).map((r) => ({ label: r.label, met: r.met(g, d) }));
}

/**
 * Why a settlement (yours, by default) cannot be upgraded right now, or null.
 * The island's `settlement_refusal`, in its order and its words: the rank
 * first, for a citizen whose rank its founder did not let upgrade.
 */
export function upgradeReason(g: Game, d: Deed | null = g.deed): string | null {
  if (!d) return 'No settlement.';
  const rank = lacks(d, 'upgrade');
  if (rank) return rank;
  const next = nextDeedLevel(d);
  if (!next) return `${d.name}: max level.`;
  const missing = upgradeProgress(g, d).filter((r) => !r.met);
  if (missing.length) return `Still needed: ${missing.map((r) => r.label.toLowerCase()).join(', ')}.`;
  return null;
}

/**
 * What you are on a settlement and what that lets you do, in one line: the
 * powers your rank holds, said as the island says them when you are ranked.
 */
export function standingWord(d: Pick<Deed, 'role' | 'rank' | 'perms'> & { name?: string }): string {
  if (isFounder(d)) return 'Founder: every power, locks included.';
  return `Rank: ${rankName({ name: d.name ?? '', ...d })}. You may ${rankMay(permsHeld({ name: d.name ?? '', ...d }))}.`;
}

/**
 * What leaving a settlement you were asked onto costs, asked before it is
 * done. It is `rpc_leave_deed`: off the roll at once, the founder is told, and
 * nothing but a fresh invitation puts you back on it.
 */
export const leaveQuestion = (d: Deed, holder?: string | null): string =>
  `Leave ${d.name}? You leave its roll at once and become a stranger: no shaping, `
  + `and only stores you made still open for you. `
  + `${holder ? `${holder} is` : 'Its founder is'} told; only a new invitation brings you back.`;

/**
 * The settlement a settlement job is aimed at: the one of yours whose token
 * stands on the tile picked, or your own when the tile is not a token of
 * yours -- which is what the island takes (`settlement_aimed`).
 */
export function deedAimed(g: Game, t: { kind: string; x?: number; y?: number }): Deed | null {
  if (t.kind === 'tile') {
    const at = g.myDeeds().find((d) => d.x === t.x && d.y === t.y);
    if (at) return at;
  }
  return g.myDeeds().find((d) => isFounder(d)) ?? null;
}

export const DEED_ACTIONS: ActionDef[] = [
  {
    id: 'upgrade_deed',
    label: 'Upgrade settlement',
    verb: 'marking out the new boundary',
    stamina: 0.05,
    baseTime: 8,
    // Offered on every tile to whoever founded one; to a rank allowed it, on its token.
    applies: (t, g) => !lacks(deedAimed(g, t), 'upgrade') && !!deedAimed(g, t),
    check: (t, g) => upgradeReason(g, deedAimed(g, t)),
    perform: (t, g) => {
      const d = deedAimed(g, t);
      if (!d || upgradeReason(g, d) !== null) return;
      const level = deedLevel(d) + 1;
      d.level = level;
      d.radius = deedRadiusAt(level);
      g.logMsg(
        `${d.name}: level ${level}. Border ${d.radius} tiles from the token; ${deedWorkersAt(level)} wildermon may work here.`,
        'system',
      );
      g.events.emit('world', d.x, d.y);
    },
  },
];

export const DEED_ACTION_BY_ID = new Map(DEED_ACTIONS.map((a) => [a.id, a]));

/**
 * Why you may not ask to join this settlement from where you stand, or null:
 * the island's `rpc_join_ask` asks that you stand on its land (`deed_covers`).
 */
export const joinFromAfar = (g: Game, d: Pick<Deed, 'name' | 'x' | 'y' | 'radius'>): string | null =>
  Math.abs(g.player.tileX - d.x) <= d.radius && Math.abs(g.player.tileY - d.y) <= d.radius ? null : `Stand on ${d.name} to ask.`;
