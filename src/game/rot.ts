import type { Game } from './game';
import { groundDecayRate, itemDef, type Item } from './items';
import { DAMAGE_MAX } from './limits';
import { keyX, keyY } from './tileindex';

/**
 * How long a thing lying on the ground has before it rots away.
 *
 * Nothing rots in a pack or a store; on the ground a thing takes damage at
 * its own rate (`groundDecayRate`: its kind, its quality, what it is made of,
 * its rarity and any seal) times what the place is worth (`decayMultiplier`:
 * a settlement, a roof, a cellar), and goes at `DAMAGE_MAX`. The island
 * charges the same rate (`ground_decay_rate`, `decay_multiplier`), in steps
 * of a few minutes, so what this says is right to within one of them.
 */
export function rotSeconds(g: Game, item: Item, x: number, y: number, level = 0): number {
  const perHour = groundDecayRate(item) * g.decayMultiplier(x, y, level);
  if (perHour <= 0) return Infinity;
  return (Math.max(0, DAMAGE_MAX - item.dmg) / perHour) * 3600;
}

/** "8 minutes", "2.3 hours", "4 days", "never". */
export function rotSaid(secs: number): string {
  if (!Number.isFinite(secs)) return 'never';
  const m = Math.round(secs / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = secs / 3600;
  if (h < 48) return `${h.toFixed(1)} hours`;
  return `${Math.round(h / 24)} days`;
}

/** What a thing on the ground says of its time left: "rots in 8 minutes". */
export const rotLine = (g: Game, item: Item, x: number, y: number, level = 0): string =>
  `rots in ${rotSaid(rotSeconds(g, item, x, y, level))}`;

/** Seconds left under which food lying near you is worth a notice. */
export const ROT_SOON = 10 * 60;
/** How far round you, in tiles, food on the ground is looked over for it. */
export const ROT_LOOK = 12;

/** Food lying within `ROT_LOOK` tiles of you that rots within `ROT_SOON`, soonest first. */
export function rottingNear(g: Game): Array<{ item: Item; x: number; y: number; secs: number }> {
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  const out: Array<{ item: Item; x: number; y: number; secs: number }> = [];
  for (const [key, pile] of g.ground) {
    const x = keyX(key), y = keyY(key);
    if (Math.max(Math.abs(x - px), Math.abs(y - py)) > ROT_LOOK) continue;
    for (const item of pile) {
      if (itemDef(item.id).category !== 'food') continue;
      const secs = rotSeconds(g, item, x, y);
      if (secs <= ROT_SOON) out.push({ item, x, y, secs });
    }
  }
  return out.sort((a, b) => a.secs - b.secs);
}
