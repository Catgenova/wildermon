/**
 * Sailing's jobs (`sailing.ts`): sounding the depth from a boat, and fitting a
 * rigging set to a sailing boat or a caravel. The island does both
 * (`sail_refusal`, `perform_sail` in the migrations) in the same words; this
 * side offers them and says what they did.
 */
import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { furnitureCentre, furnitureDef, furnitureName, isBoat, type PlacedFurniture } from './furniture';
import { STORE_REACH } from './limits';
import { metres } from './piers';
import { waterDepth } from './fishing';
import { RIG_MARK, RIGGING_SET, SOUND_LEARN, SOUND_REACH, isRigged } from './sailing';
import { SAILING } from './travel';

/** The two jobs, by id. The island's `sail_action`. */
export const SOUND_DEPTH = 'sound_depth';
export const FIT_RIGGING = 'fit_rigging';
export const SAIL_ACTION_IDS: readonly string[] = [SOUND_DEPTH, FIT_RIGGING];

/** What both sides say. */
export const SAIL_SAID = {
  notAfloat: 'Aboard her first.',
  noSail: 'Sailing boats and caravels only.',
  rigged: 'Rigging already fitted.',
  noSet: 'Need a rigging set.',
  far: 'Stand beside her.',
} as const;

/** How a sounding's word starts, for the map to take it up (`Game.write`). */
export const SOUNDED = 'Sounded:';
/** What a sounding says: the shallowest and the deepest water it read, in metres, and how many tiles of it. The island's words too. */
export const soundedSaid = (tiles: number, least: number, most: number): string =>
  (tiles ? `Sounded: ${tiles} tiles of water within ${SOUND_REACH}, ${metres(least)} m to ${metres(most)} m deep. Marked on your map.`
    : `Sounded: no water within ${SOUND_REACH} tiles.`);
/** What fitting says. */
export const riggedSaid = (name: string): string => `Rigging fitted: ${name.toLowerCase()}.`;

const pieceOf = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get(t.id) : undefined);
/** Whether you are in her: at her helm, or aboard her as a passenger. */
const inHer = (g: Game, f: PlacedFurniture): boolean => g.driving()?.id === f.id || g.player.aboard === f.id;

/** The water a sounding reads round you: every tile within `SOUND_REACH` with water on it, and its depth. */
export function soundings(g: Game): Array<{ x: number; y: number; depth: number }> {
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  const out: Array<{ x: number; y: number; depth: number }> = [];
  for (let y = py - SOUND_REACH; y <= py + SOUND_REACH; y++) {
    for (let x = px - SOUND_REACH; x <= px + SOUND_REACH; x++) {
      if (Math.hypot(x - px, y - py) > SOUND_REACH || !g.world.inBounds(x, y)) continue;
      const depth = waterDepth(g, x, y);
      if (depth > 0) out.push({ x, y, depth });
    }
  }
  return out;
}

export const SAIL_ACTIONS: ActionDef[] = [
  {
    id: SOUND_DEPTH,
    label: 'Sound the depth',
    verb: 'sounding',
    skill: SAILING,
    stamina: 0.02,
    baseTime: 5,
    applies: (t, g) => {
      const f = pieceOf(g, t);
      return !!f && isBoat(f) && inHer(g, f);
    },
    check: (t, g) => {
      const f = pieceOf(g, t);
      return f && isBoat(f) && inHer(g, f) ? null : SAIL_SAID.notAfloat;
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f || !inHer(g, f)) return;
      const read = soundings(g);
      g.gainSkill(SAILING, SOUND_LEARN);
      const depths = read.map((r) => r.depth);
      g.logMsg(soundedSaid(read.length, depths.length ? Math.min(...depths) : 0, depths.length ? Math.max(...depths) : 0), 'event');
    },
  },
  {
    id: FIT_RIGGING,
    label: 'Fit the rigging',
    verb: 'fitting the rigging',
    skill: SAILING,
    stamina: 0.06,
    baseTime: 30,
    applies: (t, g) => {
      const f = pieceOf(g, t);
      return !!f && !!furnitureDef(f.kind).boat?.sail && !isRigged(f) && g.inventory.has(RIGGING_SET);
    },
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f || !furnitureDef(f.kind).boat?.sail) return SAIL_SAID.noSail;
      if (isRigged(f)) return SAIL_SAID.rigged;
      if (!g.inventory.has(RIGGING_SET)) return SAIL_SAID.noSet;
      const [cx, cy] = furnitureCentre(f);
      if (!inHer(g, f) && Math.hypot(cx - g.player.x, cy - g.player.y) > STORE_REACH) return SAIL_SAID.far;
      return null;
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f || isRigged(f) || !g.inventory.consume(RIGGING_SET, 1)) return;
      f.mark = { ...(f.mark ?? {}), [RIG_MARK]: 1 } as PlacedFurniture['mark'];
      g.events.emit('world', f.x, f.y);
      g.logMsg(riggedSaid(furnitureName(f)), 'event');
    },
  },
];
