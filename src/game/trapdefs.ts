/**
 * The traps as made: what each is built from, what it holds and how long it
 * stands, and the best its chance of a catch comes to.
 *
 * A leaf, so the recipes and the enchantments can read them without loading
 * the traps' actions (`traps.ts`), which says them on.
 */
import { world } from './pace';

export type TrapKind = 'snare' | 'deadfall' | 'creel' | 'twine_snare';

export interface TrapDef {
  id: TrapKind;
  name: string;
  /** What it is built from. */
  bill: Array<[string, number]>;
  difficulty: number;
  time: number;
  /** The stiffest taming level it will hold. Anything warier walks off with it. */
  holds: number;
  /** How far from it the bait carries, in tiles. */
  reach: number;
  /** Base chance per check that something in reach comes to it. */
  odds: number;
  /** Seconds it stands out in the weather at quality one and at a hundred. */
  lifeMin: number;
  lifeMax: number;
  /** Goes in the water and takes fish rather than standing on land and taking beasts. */
  water?: boolean;
  /** The most fish one of these holds before it stops taking any. */
  hold?: number;
  /** Used up by its first catch: gone once what it holds is taken or let go. The island's `trap_def.once`. */
  once?: boolean;
  note: string;
}

export const TRAPS: Record<TrapKind, TrapDef> = {
  snare: {
    id: 'snare',
    name: 'Snare',
    bill: [['rope', 4], ['shaft', 8]],
    difficulty: 8,
    time: 6,
    holds: 20,
    reach: 7,
    odds: 0.3,
    lifeMin: world(20 * 60),
    lifeMax: world(90 * 60),
    note: 'A noose of rope on a bent shaft. It takes the small and the trusting; anything with weight in it walks off wearing the rope.',
  },
  // Ropemaking's small snare (`ropework.ts`): two twine and a shaft, one catch.
  twine_snare: {
    id: 'twine_snare',
    name: 'Twine snare',
    bill: [['twine', 2], ['shaft', 1]],
    difficulty: 6,
    time: 4,
    holds: 10,
    reach: 5,
    odds: 0.3,
    lifeMin: world(20 * 60),
    lifeMax: world(90 * 60),
    once: true,
    note: '',
  },
  creel: {
    id: 'creel',
    name: 'Creel',
    bill: [['reed', 56], ['rope', 4]],
    difficulty: 16,
    time: 16,
    holds: 0,
    reach: 0,
    odds: 0.34,
    lifeMin: world(40 * 60),
    lifeMax: world(3 * 60 * 60),
    water: true,
    hold: 8,
    note: 'A woven basket with a throat turned inward, so what swims in stays in. It sits in the water and works while you are elsewhere.',
  },
  deadfall: {
    id: 'deadfall',
    name: 'Deadfall',
    bill: [['plank', 12], ['shaft', 8], ['rope', 8], ['nail', 12]],
    difficulty: 26,
    time: 14,
    holds: 60,
    reach: 10,
    odds: 0.22,
    lifeMin: world(45 * 60),
    lifeMax: world(4 * 60 * 60),
    note: 'A weighted board on a trigger, propped over the bait. It will hold very nearly anything that walks, and it is a day’s work to build one.',
  },
};

/** The best a trap's chance of taking a creature ever comes to. */
export const CATCH_MOST = 0.9;
