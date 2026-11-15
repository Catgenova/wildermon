/**
 * Iron and rock outcroppings: boulders the island sets down on grass inside
 * the safe ring round the spawn and each Runestone (`SAFE_RING`), mined with a
 * pickaxe a set number of times and then gone.
 *
 * Asked for: "iron and rock outcropping models. These will spawn randomly
 * within the runestone safe zones on grass daily and can be mined 20 times
 * before breaking and going away until next daily reset spawns more." And:
 * every swing at one gives QL `OUTCROP_QL`, whatever the skill or the pickaxe.
 *
 * Each is a placed piece of the island's (`placed`, kind furniture, sub its
 * kind's id) with the swings it has left in `state -> uses`. At each daily
 * reset the island takes every one away and sets `perRing` of each kind down
 * round each centre of the safe ring (`outcrop_day`), on grass and nowhere
 * else: never on water, a settlement, a building, a road, a Runestone, beside
 * another piece or within `OUTCROP_CLEAR` tiles of the ring's centre. Mine
 * (`mine_outcrop`) is a go at mining: its skill, time, wind, sound and tool;
 * a swing that comes off gives one of its kind's yield at `OUTCROP_QL` and
 * takes a use; at none it breaks and is gone.
 *
 * A leaf: no value imports but words, so the defs dump, the help, What's new,
 * the renderer and the suite can read it. The island has the rules off these
 * numbers (`outcrop_kinds` and the scalars in the defs; `outcrop_day`,
 * `outcrop_refusal`, `perform_outcrop` in the migration);
 * `supabase/test/outcrops.ts` holds them.
 */
import { DAILY_RESET } from '../world/tiles';

export interface OutcropKind {
  /** Its id, which is also the furniture kind it is drawn as. */
  id: string;
  name: string;
  /** What a swing that comes off gives, by item id. */
  yields: string;
  /** How many of it the island sets down round each centre of the safe ring at each daily reset. */
  perRing: number;
}

export const OUTCROP_KINDS: readonly OutcropKind[] = [
  { id: 'iron_outcrop', name: 'Iron outcropping', yields: 'iron_ore', perRing: 3 },
  { id: 'rock_outcrop', name: 'Rock outcropping', yields: 'rock_shards', perRing: 5 },
];
export const OUTCROP_BY_ID: ReadonlyMap<string, OutcropKind> = new Map(OUTCROP_KINDS.map((k) => [k.id, k]));
export const isOutcropKind = (kind: string): boolean => OUTCROP_BY_ID.has(kind);

/** The job: Mine, on an outcropping. Its skill, tool, time, wind and odds are mining's (`MINE_JOB`). */
export const OUTCROP_MINE = 'mine_outcrop';
/** Mining's skill, tool, wind, time and difficulty: Mine at a face (`mine` in `actions.ts`) and at an outcropping alike. */
export const MINE_JOB = { skill: 'mining', tool: 'pickaxe', stamina: 0.06, baseTime: 8, difficulty: 12 } as const;
/** Swings that come off before an outcropping breaks. */
export const OUTCROP_USES = 20;
/** The QL of everything mined off one, whatever the skill or the pickaxe. */
export const OUTCROP_QL = 5;
/** Outcroppings round each centre of the safe ring after a daily reset, every kind together. */
export const OUTCROPS_A_RING = OUTCROP_KINDS.reduce((n, k) => n + k.perRing, 0);
/** No outcropping within this many tiles (each way) of a ring's centre: the stone, its start ring and its landing. */
export const OUTCROP_CLEAR = 8;
/** Tiles drawn at random for each outcropping still wanted round a centre, before that centre is given up on. */
export const OUTCROP_DRAWS = 40;

/** How far an outcropping is drawn worn down, nought (whole) to `OUTCROP_STAGES` (one use left). */
export const OUTCROP_STAGES = 3;
/** Its stage at `uses` left: whole at `OUTCROP_USES`, a stage more worn each further share used. */
export const outcropStage = (uses: number | undefined): number =>
  Math.max(0, Math.min(OUTCROP_STAGES, Math.floor(((OUTCROP_USES - Math.max(1, Math.min(OUTCROP_USES, uses ?? OUTCROP_USES))) * (OUTCROP_STAGES + 1)) / OUTCROP_USES)));

/** "Uses left: 14/20". The island's `outcrop_uses_said`. */
export const usesSaid = (uses: number): string => `Uses left: ${uses}/${OUTCROP_USES}`;

/** What Examine and the menu say of one: " Iron outcropping. Uses left: 14/20. Mine: iron ore, QL 5." The island's `outcrop_says`. */
export const outcropSays = (k: OutcropKind, uses: number, yieldName: string): string =>
  ` ${k.name}. ${usesSaid(uses)}. Mine: ${yieldName.toLowerCase()}, QL ${OUTCROP_QL}.`;

/** What a swing that comes off says: "Mined: iron ore, QL 5. Uses left: 19/20." The island's `perform_outcrop`. */
export const outcropMinedSays = (yieldName: string, uses: number): string =>
  `Mined: ${yieldName.toLowerCase()}, QL ${OUTCROP_QL}. ${usesSaid(uses)}.`;

/** What its last swing says: "Iron outcropping: broken. New outcroppings at the daily reset (13:00 UTC)." The island's `perform_outcrop`. */
export const outcropBrokeSays = (k: OutcropKind): string => `${k.name}: broken. New outcroppings at the ${DAILY_RESET}.`;

/** Refusals: the island's `outcrop_refusal`, word for word. */
export const OUTCROP_SAID = {
  gone: 'Outcropping gone.',
  only: 'Mine only.',
} as const;
