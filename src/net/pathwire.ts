/**
 * The Path (`src/game/path.ts`) wired to the island: its record taken off every beat, its steps looked over on the
 * journal's clock, the sites for a settlement asked while a step wants them, a tame step's supply claimed the moment
 * it is due, and the window's switch and skips sent as doors.
 */
import type { Game } from '../game/game';
import { currentStep, pathCheck, supplyDue } from '../game/path';
import { pathSitesIn, pathStateIn } from '../game/pathstate';
import type { Island } from './island';

/** Seconds between two asks for the sites, and tiles walked that ask again sooner. */
export const SITES_EVERY = 60;
export const SITES_MOVED = 24;

/** Take the island's record of the Path, as a beat or a door says it. */
export function takePath(game: Game, v: unknown): void {
  const state = pathStateIn(v);
  if (!state && game.thePath === null) return;
  game.thePath = state;
  // A door's answer names the kinds noted in the field guide as well (`thepath_said`); a beat's does not.
  const noted = v && typeof v === 'object' ? (v as { noted?: unknown }).noted : undefined;
  if (Array.isArray(noted)) game.guide.take({ seen: [], tamed: [], bred: [], noted: noted.filter((k): k is string => typeof k === 'string') });
  game.events.emit('path');
}

export function wirePath(game: Game, island: Island): void {
  let sitesAt = -1e9;
  let sitesFrom: { x: number; y: number } | null = null;
  let asking = false;
  const claimed = new Set<string>();

  const answer = async (call: Promise<{ state: unknown; error: string | null }>): Promise<string | null> => {
    const { state, error } = await call;
    if (error) {
      game.logMsg(error, 'error');
      return error;
    }
    takePath(game, state);
    return null;
  };

  game.pathDoor = {
    turn: (on) => answer(island.pathTurn(on)),
    skip: (step, skip) => answer(island.pathSkip(step, skip)),
  };

  game.pathTick = () => {
    pathCheck(game);
    if (!game.thePath?.on) return;
    const s = currentStep(game);
    // The sites, while a step points at them: on the walk out and at the site.
    if (s && (s.id === 'walk' || s.id === 'site') && !asking) {
      const p = game.player;
      const moved = !sitesFrom || Math.hypot(p.x - sitesFrom.x, p.y - sitesFrom.y) >= SITES_MOVED;
      if (moved || game.time - sitesAt >= SITES_EVERY) {
        asking = true;
        sitesAt = game.time;
        sitesFrom = { x: p.x, y: p.y };
        void island.pathSites().then((v) => {
          game.pathSites = pathSitesIn(v);
          game.events.emit('path');
        }).finally(() => {
          asking = false;
        });
      }
    }
    // A tame step with nothing it eats in season: its supply, once.
    const due = supplyDue(game);
    if (due && !claimed.has(due)) {
      claimed.add(due);
      void answer(island.pathSupply(due));
    }
  };
}
