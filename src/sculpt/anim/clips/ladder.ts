/**
 * L1, climbing a ladder (`FigurePose.climb`): faced to it, the hands on its rungs over the head and the feet on its
 * rungs under the body, a hand and the foot on the other side going up together while the other two hold, then the
 * other two; the body leant in with the ladder (`../../../render/ladderbody.ts` LADDER_LEAN), the head up.
 *
 * Played over the height the feet have gone up the ladder, not the clock (`climbTime`): a run of the clip to each
 * `CLIMB_RUN` game units (two rungs, `RUNG`), so a hand or a foot on a rung stays on it, going up or coming down (the
 * clip played backward), and held where the body stops. Each hand and foot goes up two rungs at a time, the feet a
 * rung apart, the hands a rung apart.
 *
 * Keyed where they go rather than turned: the body is drawn from a point `LADDER_STAND` short of the ladder at the
 * height of its feet (`../../../render/ladderbody.ts`), and put where the clip puts it (not stood on its lowest sole:
 * `putAsKeyed`), so the rungs are at known places from it: each foot's ball on a rung (`Clip.feet`, from the idle's
 * stance), each fist closed on one (`Clip.hands`), the knees and elbows bent to reach. Worked out for each body in the
 * game's units and keyed in its own heights (his the clip's, hers its corrections).
 */
import type { Clip, Correction, FootKeys, HandReach, Key } from '../clip';
import type { Euler } from '../math';
import { putAsKeyed } from '../down';
import { CLIMB_RUN, LADDER_LEAN, LADDER_STAND, RUNG } from '../../../game/ladderclimb';

/** Keys a run, each hand and foot keyed where it is at every one. */
const N = 24;
/** The clip's length, a run (its time is the climb's height, `climbTime`). */
const LENGTH = 1;

/** Each body's height in the game's units (`../lowpoly.ts`: his `heightOf(humanProportions(0))`, hers `WOMAN_OF_MAN` of it). */
const HEIGHT = { man: 16.5, woman: 14.025 } as const;
/**
 * By body, game units from the feet's point: the hands' rungs while they hold (the higher, from which each is let down a
 * rung before it goes up two); the hands apart across the ladder; the ball of the foot ahead of the ankle; how far up the
 * hips are held and how far in toward the ladder.
 */
const FIT = {
  man: { hand: 15, across: 2.5, ball: 1.0, hips: 0.5, hipsIn: 1.6 },
  woman: { hand: 12, across: 2.2, ball: 0.85, hips: 0.4, hipsIn: 1.4 },
} as const;
/** How far a hand or a foot is taken back off the ladder on its way up to the next rung, and lifted over it: game units. */
const OFF = 1.1, OVER = 0.9;

/** The rung it is on, or on its way up two (`w` of the way, `0` still on the lower), game units up from the feet's point, at a share of the run. */
function limb(u: number, at: number, lead: number): { y: number; off: number } {
  // held over its half of the run, let down a rung as the body goes up a rung; then up two rungs (one on the body) over the other half
  const k = (((u - lead) % 1) + 1) % 1;
  if (k < 0.5) return { y: at - CLIMB_RUN * k, off: 0 };
  const w = (k - 0.5) / 0.5, e = w * w * (3 - 2 * w), arc = Math.sin(Math.PI * w);
  return { y: at - RUNG + RUNG * e + OVER * arc, off: OFF * arc };
}
/** Where the ladder is, forward of the feet's point, at a height over it (game units). */
const ladderAt = (y: number): number => LADDER_STAND + LADDER_LEAN * y;

/** A body's feet, hands and hips over a run, keyed. */
function keyed(body: 'man' | 'woman'): { feet: { l: FootKeys; r: FootKeys }; hands: Record<'l' | 'r', Array<Key<Euler>>>; move: Array<Key<Euler>> } {
  const H = HEIGHT[body], fit = FIT[body];
  const feet = { l: { z: [], lift: [], pitch: [] }, r: { z: [], lift: [], pitch: [] } } as { l: FootKeys; r: FootKeys };
  const hands: Record<'l' | 'r', Array<Key<Euler>>> = { l: [], r: [] };
  const move: Array<Key<Euler>> = [];
  for (let i = 0; i < N; i++) {
    const u = i / N, t = +(u * LENGTH).toFixed(4);
    // the left foot holds over the first half (from a rung up), the right over the second; each hand goes up with the other foot
    const fl = limb(u, RUNG, 0), fr = limb(u, RUNG, 0.5);
    const lift = { l: fl.y / H, r: fr.y / H }, low = Math.min(lift.l, lift.r);
    for (const [s, f] of [['l', fl], ['r', fr]] as const) {
      feet[s].lift.push({ t, v: +(f.y / H).toFixed(5), ease: 'linear' });
      feet[s].z.push({ t, v: +(ladderAt(f.y) - fit.ball - f.off).toFixed(4), ease: 'linear' });
      feet[s].pitch.push({ t, v: 0, ease: 'linear' });
    }
    const hl = limb(u, fit.hand, 0.5), hr = limb(u, fit.hand, 0);
    for (const [s, h, x] of [['l', hl, fit.across], ['r', hr, -fit.across]] as const) {
      // (in the frame the feet stand in: up from the lower foot, `../skeleton.ts` finish)
      hands[s].push({ t, v: [+(x / H).toFixed(5), +(h.y / H - low).toFixed(5), +((ladderAt(h.y) - h.off) / H).toFixed(5)], ease: 'linear' });
    }
    // the hips held a little up over the feet and in toward the ladder, risen as each foot pushes off and settled as it lands
    const bob = 0.25 * Math.cos(4 * Math.PI * u);
    move.push({ t, v: [0, +((fit.hips - bob) / H).toFixed(5), +(fit.hipsIn / H).toFixed(5)], ease: 'linear' });
  }
  return { feet, hands, move };
}

const HIS = keyed('man'), HERS = keyed('woman');
/** Hers less his, key for key: her corrections (`Correction.tracks`). */
const less = (a: Array<Key<Euler>>, b: Array<Key<Euler>>): Array<Key<Euler>> => a.map((k, i) => ({ ...k, v: [k.v[0] - b[i].v[0], k.v[1] - b[i].v[1], k.v[2] - b[i].v[2]] as Euler }));
const still = (e: Euler): Array<Key<Euler>> => [{ t: 0, v: e }];

/** Leant in with the ladder: the hips tipped toward it, the back straightened over them, the head up to the hands. */
const LEAN: Record<string, Euler> = {
  pelvis: [12, 0, 0], spine_01: [-2, 0, 0], spine_02: [-3, 0, 0], spine_03: [-2, 0, 0], neck_01: [-6, 0, 0], neck_02: [-4, 0, 0], head: [-10, 0, 0],
  fingers_01_l: [40, 0, 0], fingers_01_r: [40, 0, 0], fingers_02_l: [50, 0, 0], fingers_02_r: [50, 0, 0],
};

const hand = (s: 'l' | 'r'): HandReach => ({ at: HIS.hands[s], way: s === 'l' ? [-1, 0, 0] : [1, 0, 0] });
const herFix: Correction = {
  feet: { lift: HEIGHT.man / HEIGHT.woman },
  tracks: { $hand_l: less(HERS.hands.l, HIS.hands.l), $hand_r: less(HERS.hands.r, HIS.hands.r), $move: less(HERS.move, HIS.move) },
};

export const CLIMB: Clip = {
  name: 'climb', loop: true, length: LENGTH, mask: 'full',
  tracks: Object.fromEntries(Object.entries(LEAN).map(([b, e]) => [b, still(e)])),
  move: HIS.move,
  // from the idle's stance, a game unit a stride: the keyed z is in game units
  plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
  feet: { stride: 1, ...HIS.feet },
  hands: { l: hand('l'), r: hand('r') },
  armsFree: true,
  bodies: { woman: herFix },
};
putAsKeyed(CLIMB.name);

/** The climb's time for feet `h` game units up a ladder: a run to each `CLIMB_RUN` (`./index.ts` clipFor). */
export const climbTime = (h: number, _body: 'man' | 'woman'): number => ((((h / CLIMB_RUN) % 1) + 1) % 1) * LENGTH;
