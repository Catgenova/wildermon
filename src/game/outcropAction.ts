/**
 * Mine, at an outcropping (`outcrops.ts`). The rules are the island's
 * (`outcrop_refusal`, `perform_outcrop`): what the browser holds is the piece
 * and its uses left, off `rpc_ground`'s placed rows, for the menu's label and
 * its refusals.
 */
import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { furnitureCentre, type PlacedFurniture } from './furniture';
import { PLACED_REACH } from './limits';
import { MINE_JOB, OUTCROP_BY_ID, OUTCROP_MINE, OUTCROP_QL, OUTCROP_SAID, OUTCROP_USES, usesSaid } from './outcrops';
import { pct, taggedWith } from './yields';

/** The outcropping a target names, if it is one. */
export const outcropOf = (g: Game, t: Target): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get(t.id);
  return f && OUTCROP_BY_ID.has(f.kind) ? f : undefined;
};

/** Why Mine at an outcropping is refused, or null: the island's `outcrop_refusal` for the job, in the same order. */
export function outcropRefusal(g: Game, t: Target): string | null {
  const f = outcropOf(g, t);
  if (!f) return OUTCROP_SAID.gone;
  const [cx, cy] = furnitureCentre(f);
  if (Math.hypot(cx - g.player.x, cy - g.player.y) > PLACED_REACH) return 'You are too far away from that.';
  if (!g.inventory.has(MINE_JOB.tool)) return 'Need a pickaxe.';
  return null;
}

export const OUTCROP_ACTIONS: ActionDef[] = [
  {
    id: OUTCROP_MINE,
    label: 'Mine',
    // Its odds, what it gives and the uses left: "Mine (78%, QL 5, uses left: 14/20)".
    labelFor: (t, g) => {
      const f = outcropOf(g, t);
      return taggedWith(g, MINE_JOB.tool, 'Mine', pct(g.sureChance('mine', MINE_JOB.skill, MINE_JOB.difficulty, g.toolQl(MINE_JOB.tool))),
        `QL ${OUTCROP_QL}`, usesSaid(f?.uses ?? OUTCROP_USES).toLowerCase());
    },
    verb: 'mining',
    ...MINE_JOB,
    applies: (t, g) => !!outcropOf(g, t),
    check: (t, g) => outcropRefusal(g, t),
    // The island's (`perform_outcrop`).
    perform: () => undefined,
  },
];
