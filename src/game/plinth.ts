/**
 * An enchanter's plinth at work: whether somebody is enchanting at one now.
 *
 * Enchant is done standing at a plinth (`enchant.ts`), within the reach every
 * station has (`STATION_REACH`). The browser knows what each body is busy at
 * -- its own job, and the action id every other one sends with where it
 * stands (`PeerState.act`) -- so a plinth with an Enchant going on within
 * that reach of its middle, on its own storey, is in use: its runes brighten
 * and it throws more light (`plinthLight`). Drawn only; no rule asks it.
 */
import { furnitureCentre, STATION_REACH, type PlacedFurniture } from './furniture';
import type { Game } from './game';

/**
 * The Enchant job's id (`ENCHANT` in `enchanting.ts`), written here rather
 * than imported: that module reads the creature table as it loads, and the
 * game reads this one before the creature table is there.
 * `supabase/test/plinth.ts` holds the two to each other.
 */
export const ENCHANT_JOB = 'enchant';

/** Whether anybody, you or another, is enchanting at this plinth now. */
export function plinthBusy(g: Game, f: PlacedFurniture): boolean {
  const [cx, cy] = furnitureCentre(f);
  const level = f.level ?? 0;
  const at = (x: number, y: number, l: number): boolean => l === level && Math.hypot(x - cx, y - cy) <= STATION_REACH;
  const a = g.action;
  if (a && a.state === 'performing' && a.def.id === ENCHANT_JOB && at(g.player.x, g.player.y, g.player.level)) return true;
  for (const p of g.roster.list()) if (p.act === ENCHANT_JOB && at(p.x, p.y, p.level)) return true;
  return false;
}
