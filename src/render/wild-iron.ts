import {
  ACT_SECS, add, beat, clamp, lifted, shadowOf, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, merge, mix, orb, orbAlong, paint, quadBones, quadBonesOf,
  quadPose, scale, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The iron line: the Ironemole, a small round mole with a crest of ore
 * crystals down its back, which grows into the Ferrodrill, longer and
 * stockier with a dense ridge of shards, and then the Oremander, a massive
 * low badger of a thing under a mountain of them. The species is still
 * `mola` underneath, as saves and the database know it.
 *
 * Each is a dark speckled mole with a cream face, a pink nose and big pale
 * digging claws on its fore feet; and on its back faceted crystals of copper
 * and slate, with a few of pale peach, each a pointed prism of two-tone
 * faces. They grow in number and size at each stage, and from the
 * Ferrodrill on out of its shoulders and legs too, and over the Oremander's
 * eyes. All three are built by one set of functions from a description of
 * the stage (`Mole`), so a stage is its numbers.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Mole {
  /** The barrel's rings, rump to chest: where each is along the body and how high, how wide and how deep. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the drop from the ankle to the sole; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How big the fore paws are across, and the hind. */
  paw: number;
  hindPaw: number;
  /** The digging claws on each fore paw: how many, how long and how thick at the root; and the hind paws' claws' length. */
  claw: { n: number; len: number; w: number };
  hindClaw: number;
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /**
   * The head's rings in its own frame, from the back of the skull to the end of the snout, and how far nose-up it is carried
   * (degrees); and, for each band between two rings, how high up its side the cream of the face comes (the sine of the angle
   * from level: past one, all of it).
   */
  head: Rings & { pitch: number; cream: number[] };
  /** How big the pink ball of the nose is. */
  nose: number;
  /** The eyes: how far along the head and how far up its side (radians), how big, how tall against wide, and how far a lid comes down over each. */
  eye: { y: number; up: number; size: number; tall: number; lid: number };
  /** Each ear's length; nought for none showing. */
  ear: number;
  /**
   * The crest down its back, in rows from the shoulders (`from`, along the body) to the rump (`to`): how many rows, how many
   * crystals across a row, how far round the back they spread from the spine (radians), the tallest, how thick, where along it
   * the tallest stand (nought at the shoulders, one at the rump) and how far either side of there they stay tall, and how many
   * of them are slate and how many peach, and how big a slate one is against a copper one (under one, they stay off the
   * spine, which is all copper).
   */
  crest: { from: number; to: number; rows: number; per: number; spread: number; tall: number; r: number; peak: number; width: number; slate: number; peach: number; slateK: number };
  /** Crystals along the crown of the head, leading the crest down onto it: how many, and the longest. */
  crown: [number, number];
  /** Small crystals like pebbles over the back below the crest and down the flanks: how many, how long, and how far down the flank they go (radians from level, up positive). */
  pebbles: [number, number, number];
  /** Crystals out of each shoulder and each haunch: how many, and the longest. */
  shoulder: [number, number];
  /** Crystals out of the outside of each leg: how many, and the longest. */
  limb: [number, number];
  /** Crystal points over each eye: how many, and how long; none for none. */
  brow: [number, number];
  /** How far round its underside the cream of its belly comes (radians); nought for none. */
  belly: number;
  /** Cream tufts of fur on each cheek: how many, and how long. */
  cheek: [number, number];
  /**
   * How it goes: in diagonals even at a walk (a scurry) or a four-beat walk; how much it bobs, rolls from side to side and
   * nods; how far its head swings; how far its legs swing at a walk and a run and for how much of a stride a foot is down; and
   * how much its crystals jiggle as it goes.
   */
  gait: { trot: boolean; bob: number; roll: number; nod: number; sway: number; swing: [number, number]; duty: [number, number]; jiggle: number };
  /** Its strike: a swipe of one paw, a lunging slash of both, or reared up and slammed down. */
  strike: 0 | 1 | 2;
  /** Strokes of its fore claws to a go at its task, the two paws in turn. */
  digs: number;
  size: number;
}

/** An Ironemole: small, low and round, a head too big for it with big glossy eyes, small round ears, and a short crest of copper. */
const IRONEMOLE_LOOK: Mole = {
  body: { y: [-1.22, -1.0, -0.52, 0.04, 0.62, 1.0, 1.16], z: [0.06, 0.04, 0.0, 0.0, 0.0, 0.0, 0.0], w: [0.45, 0.75, 1.1, 1.18, 1.12, 0.94, 0.46], h: [0.3, 0.5, 0.58, 0.6, 0.58, 0.5, 0.28] },
  len: 1.8,
  fore: [0.14, 0.12, 0.1], hind: [0.14, 0.13, 0.09], thick: 0.27,
  paw: 0.27, hindPaw: 0.21,
  claw: { n: 3, len: 0.38, w: 0.13 }, hindClaw: 0.12,
  neck: { at: [0, 0.92, 0.0], len: 0.24, w: 0.6, lean: 82 },
  head: sized(0.86, {
    y: [-0.46, -0.28, 0.0, 0.3, 0.56, 0.76, 0.9, 0.98], z: [0.28, 0.31, 0.27, 0.18, 0.08, 0.0, -0.03, -0.04],
    w: [0.3, 0.66, 0.76, 0.64, 0.42, 0.28, 0.21, 0.15], h: [0.4, 0.64, 0.68, 0.54, 0.37, 0.25, 0.19, 0.14], pitch: -4,
    cream: [-0.4, -0.25, 0.2, 0.35, 0.55, 0.85, 1.2],
  }),
  nose: 0.13,
  eye: { y: 0.3, up: 0.3, size: 0.18, tall: 1.12, lid: 0 },
  ear: 0.18,
  crest: { from: 0.98, to: -1.06, rows: 9, per: 3, spread: 0.42, tall: 0.95, r: 0.3, peak: 0.15, width: 0.16, slate: 0.24, peach: 0.2, slateK: 0.6 },
  crown: [2, 0.42],
  pebbles: [40, 0.2, -0.2],
  shoulder: [0, 0],
  limb: [0, 0],
  brow: [0, 0],
  belly: 0,
  cheek: [0, 0],
  gait: { trot: true, bob: 0.07, roll: 6, nod: 5, sway: 0, swing: [26, 36], duty: [0.55, 0.38], jiggle: 2.6 },
  strike: 0,
  digs: 4,
  size: 2.0,
};

/** A Ferrodrill: longer and stockier, a sleek long snout and narrower eyes, a dense ridge of shards, and crystals out of its shoulders and legs. */
const FERRODRILL_LOOK: Mole = {
  body: { y: [-1.62, -1.44, -0.84, 0, 0.8, 1.32, 1.5], z: [0.02, 0.0, -0.02, -0.02, 0.0, 0.0, 0.02], w: [0.5, 0.94, 1.12, 1.16, 1.14, 0.96, 0.46], h: [0.42, 0.72, 0.86, 0.9, 0.88, 0.76, 0.38] },
  len: 2.6,
  fore: [0.28, 0.24, 0.13], hind: [0.28, 0.26, 0.11], thick: 0.34,
  paw: 0.3, hindPaw: 0.24,
  claw: { n: 3, len: 0.56, w: 0.16 }, hindClaw: 0.18,
  neck: { at: [0, 1.14, 0.04], len: 0.32, w: 0.7, lean: 74 },
  head: sized(1.08, {
    y: [-0.48, -0.3, 0.02, 0.4, 0.78, 1.08, 1.28, 1.38], z: [0.28, 0.3, 0.26, 0.16, 0.06, -0.02, -0.04, -0.05],
    w: [0.3, 0.66, 0.76, 0.62, 0.4, 0.26, 0.2, 0.15], h: [0.38, 0.6, 0.64, 0.5, 0.34, 0.24, 0.19, 0.14], pitch: -4,
    cream: [-0.4, -0.2, 0.1, 0.28, 0.75, 0.9, 1.2],
  }, 1.08),
  nose: 0.13,
  eye: { y: 0.48, up: 0.32, size: 0.16, tall: 0.8, lid: 0.18 },
  ear: 0.16,
  crest: { from: 1.22, to: -1.46, rows: 10, per: 6, spread: 1.0, tall: 1.2, r: 0.36, peak: 0.3, width: 0.18, slate: 0.36, peach: 0.14, slateK: 1 },
  crown: [2, 0.46],
  pebbles: [26, 0.26, 0.12],
  shoulder: [2, 0.8],
  limb: [2, 0.5],
  brow: [0, 0],
  belly: 1.1,
  cheek: [3, 0.26],
  gait: { trot: false, bob: 0.09, roll: 3, nod: 3, sway: 4, swing: [28, 38], duty: [0.62, 0.4], jiggle: 0.8 },
  strike: 1,
  digs: 4,
  size: 1.82,
};

/**
 * An Oremander: massive and low, a bear or a badger, broad in the shoulder with a heavy skull, crystal points over its eyes,
 * and a towering mountain of copper and slate down its back, with crystals out of its shoulders, flanks and legs.
 */
const OREMANDER_LOOK: Mole = {
  body: { y: [-2.3, -2.06, -1.26, -0.1, 1.0, 1.86, 2.14], z: [0.0, 0.0, -0.04, 0.02, 0.06, 0.08, 0.06], w: [0.68, 1.24, 1.52, 1.62, 1.68, 1.46, 0.7], h: [0.54, 1.0, 1.34, 1.44, 1.5, 1.3, 0.6] },
  len: 3.9,
  fore: [0.42, 0.36, 0.18], hind: [0.42, 0.38, 0.16], thick: 0.75,
  paw: 0.5, hindPaw: 0.4,
  claw: { n: 4, len: 0.8, w: 0.2 }, hindClaw: 0.3,
  neck: { at: [0, 1.82, 0.0], len: 0.36, w: 1.1, lean: 80 },
  head: sized(1.5, {
    y: [-0.5, -0.3, 0.05, 0.46, 0.84, 1.12, 1.26, 1.34], z: [0.3, 0.32, 0.26, 0.16, 0.04, -0.06, -0.08, -0.09],
    w: [0.38, 0.96, 1.1, 0.82, 0.54, 0.36, 0.28, 0.22], h: [0.42, 0.74, 0.78, 0.62, 0.44, 0.32, 0.26, 0.2], pitch: -2,
    cream: [-0.4, -0.2, 0.1, 0.25, 0.7, 0.9, 1.2],
  }, 1.1),
  nose: 0.17,
  eye: { y: 0.64, up: 0.32, size: 0.165, tall: 0.75, lid: 0.38 },
  ear: 0,
  crest: { from: 1.86, to: -2.1, rows: 14, per: 7, spread: 1.12, tall: 2.1, r: 0.52, peak: 0.3, width: 0.3, slate: 0.38, peach: 0.2, slateK: 1 },
  crown: [0, 0],
  pebbles: [30, 0.34, 0.03],
  shoulder: [3, 0.9],
  limb: [3, 0.75],
  brow: [3, 0.5],
  belly: 0.85,
  cheek: [4, 0.34],
  gait: { trot: false, bob: 0.12, roll: 4.5, nod: 2, sway: 7, swing: [18, 26], duty: [0.7, 0.5], jiggle: 0.08 },
  strike: 2,
  digs: 2,
  size: 1.95,
};

/** A head's rings, every one of them `k` times the size, and `wide` times as wide again. */
function sized(k: number, H: Rings & { pitch: number; cream: number[] }, wide = 1): Rings & { pitch: number; cream: number[] } {
  const by = (xs: number[], m = 1): number[] => xs.map((x) => x * k * m);
  return { ...H, y: by(H.y), z: by(H.z), w: by(H.w, wide), h: by(H.h) };
}

/** A number of its own for each crystal, nought to one, so a crest is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/* ---- the strike and the task, in time ---------------------------------------------------- */

/** When each stage's blows land, as shares of its strike: the Ironemole's one swipe, the Ferrodrill's two slashes, the Oremander's slam. */
export const IRON_HITS: ReadonlyArray<readonly number[]> = [[0.5], [0.45, 0.62], [0.58]];
/** Strokes of the fore claws to a go at its task, each stage's: the Oremander's are half as many and twice as heavy. */
export const IRON_DIGS: readonly number[] = [IRONEMOLE_LOOK.digs, FERRODRILL_LOOK.digs, OREMANDER_LOOK.digs];
/**
 * A stroke of its claws, as shares of the stroke: the paw reached forward and up until `bite`, when the claws go into the
 * ground; dragged back through it until `fling`, when the earth comes off them and is thrown back; and brought back to
 * rest by the end of it.
 */
export const DIG_STROKE = { bite: 0.3, fling: 0.78 } as const;

/** One stroke of a fore paw digging, `w` of the way through it: its swing, how folded it is, how far off the ground, and how far its claws are dug in. */
function digStroke(w: number, amp: number): { sw: number; fold: number; off: number; drag: number } {
  const { bite, fling } = DIG_STROKE;
  if (w < bite) {
    const u = w / bite;
    return { sw: amp * smooth(u), fold: 0.9 * Math.sin(Math.PI * u), off: Math.sin(Math.PI * u), drag: 0 };
  }
  if (w < fling) {
    const u = (w - bite) / (fling - bite);
    return { sw: lerp(amp, -0.75 * amp, smooth(u)), fold: 0.15 * Math.sin(Math.PI * u), off: 0, drag: Math.sin(Math.PI * Math.min(1, u * 1.2)) };
  }
  const u = (w - fling) / (1 - fling);
  return { sw: lerp(-0.75 * amp, 0, smooth(u)), fold: 0.6 * Math.sin(Math.PI * u), off: 0.7 * Math.sin(Math.PI * u), drag: 0 };
}

/** A go at its task: how far its head is down at the ground (eased in and out of, unless it is already down), and which paw is at which stroke. */
function digOf(s: Mole, t: number, graze: number): { down: number; paw: number; w: number; k: number } {
  const down = Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.9, 1)));
  const k = Math.floor(t * s.digs), w = frac(t * s.digs);
  return { down, paw: k % 2, w, k };
}

/** How far through a strike it has gathered itself, and has it settled again since the last blow: a rebound that dies away. */
function settleOf(t: number, hit: number): number {
  const after = clamp((t - hit) / (1 - hit));
  return t > hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
}

/**
 * How far the whole body is carried forward this moment, in its own units: drawn back and thrown forward as it strikes, and
 * rocked behind each stroke of its digging. Its legs are swung back by as much, so its feet stay where they are.
 */
function surge(s: Mole, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'strike') {
    const t = act.t;
    if (s.strike === 0) return s.len * (0.1 * ramp(t, 0.4, 0.5) * (1 - ramp(t, 0.62, 0.95)) - 0.05 * ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.42, 0.5)));
    if (s.strike === 1) return s.len * (0.24 * ramp(t, 0.28, 0.46) * (1 - ramp(t, 0.68, 1)) - 0.08 * ramp(t, 0, 0.26) * (1 - ramp(t, 0.28, 0.4)));
    return s.len * (0.08 * ramp(t, 0.5, 0.58) * (1 - ramp(t, 0.72, 1)) - 0.06 * ramp(t, 0.06, 0.42) * (1 - ramp(t, 0.48, 0.58)));
  }
  if (act?.kind === 'work') {
    const d = digOf(s, act.t, a.graze);
    return s.len * 0.03 * d.down * Math.sin(d.w * TAU);
  }
  return 0;
}

/* ---- its bones -------------------------------------------------------------------------- */

/** Where each ear is rooted on the head (the right one): high on the side of the skull, behind the eyes. */
function earRoot(s: Mole): V3 {
  const H = s.head, q = onRings(H, lerp(H.y[0], H.y[1], 0.7), 0.7);
  return sub(q.p, scale(q.n, 0.1));
}

/** A stage's body on four short legs (`QuadSpec`): low, the fore legs under the chest and the claws reaching out ahead of them. */
const specOf = (s: Mole): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [s.body.w[4] * 0.52, s.len * 0.44, -s.body.h[4] * 0.5], len: s.fore, rest: [-4, 12, 0], fold: [50, 80], toe: [s.paw * 1.2, s.paw * 0.6] },
  hind: { at: [s.body.w[2] * 0.54, -s.len * 0.4, -s.body.h[2] * 0.45], len: s.hind, rest: [16, -30, 0], fold: [35, 55], toe: [s.hindPaw * 1.2, s.hindPaw * 0.6] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.12, s.body.z[0] + s.body.h[1] * 0.35], links: 1, len: 0.2, lift: 10, curl: 0, sway: 10 },
  ears: s.ear ? { at: earRoot(s), out: 40, back: 20 } : undefined,
  swing: s.gait.swing,
  duty: s.gait.duty,
  graze: 34,
  nose: 18,
  bow: 5,
  rock: 3,
});

/** Where each leg's foot is in a stride at a walk as `quadPose` has it, a four-beat, and in a scurry, the diagonals together. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its gait
 * -- the Ironemole's scurrying waddle, the Ferrodrill's long low stride, the
 * Oremander's heavy plod, its weight rolling from side to side; standing, a
 * twitching nose and now and then a sniff at the ground; and its moves -- the
 * strike, the dig and evolving.
 */
function molePose(s: Mole, spec: QuadSpec, p: QuadPose, a: Anim): void {
  const g = smooth(a.go), G = s.gait;
  if (G.trot && a.go > 0 && a.gait < 0.5) {
    // Scurrying: the diagonals together even at a walk, small quick steps.
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = step(a.u + DIAGONALS[i], duty, amp);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    const w = frac(a.u);
    // A run carries a short body up off the ground less than a long-legged one: a mole does not bound, and the Oremander
    // hardly leaves it. The weight rolled from side to side is the barrel's alone (`sway`), so the feet stay down under it.
    p.lift *= s.strike === 2 ? 0.3 : 0.5;
    p.lift += g * G.bob * Math.max(0, Math.sin(w * TAU * 2));
    // Knees a little bent all the way through a stride, so a leg bearing weight never straightens to a stilt.
    for (const l of p.legs) l[1] += g * 0.22;
    // A paw swinging forward is carried with its claws out ahead rather than curled down through the ground.
    for (let i = 0; i < 4; i++) {
      const c = clamp(p.legs[i][2] * 3);
      if (!c) continue;
      // The curl a lifted foot is given (`quadBones`) taken out again, and on a fore paw, whose claws reach out ahead, the foot
      // kept level as well.
      const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75], [sw, fold] = p.legs[i];
      const flat = -(p.pitch + rest[0] + sw + rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40)));
      p.foot[i] += c * (35 * fold + (i < 2 ? 0.6 * flat : 0));
    }
    p.neck[0] += g * (6 + 4 * a.gait);
    p.neck[1] += g * G.sway * Math.sin(w * TAU - 0.6);
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 4;
    p.tail[1] += g * 16 * Math.sin(w * TAU + 1);
    // The heavy plod: the body let down a little onto each fore foot as it takes the weight.
    if (!G.trot) p.squash += g * 0.03 * Math.max(0, Math.cos(w * TAU * 2)) * (G.sway / 7);
  } else {
    // Standing: the nose working at the air, and now and then down to the ground for a sniff.
    const sniff = beat(a.t, [6.2, 18.4], 1.6) * (1 - a.graze);
    p.neck[0] += 12 * sniff;
    p.head[0] += 2.5 * Math.sin(a.t * TAU * 2.5) * (1 - sniff) - 12 * sniff + 3 * sniff * Math.sin(a.t * 28);
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') {
    const d = digOf(s, act.t, a.graze), amp = s.strike === 2 ? 58 : 52;
    // Digging: the head down and the fore paws in turn reaching out, biting into the ground and dragging back through it, the
    // body rocking onto the digging side and nodding behind each stroke; the hind legs braced.
    const st = digStroke(d.w, amp);
    for (const i of [0, 1]) {
      const me = i === d.paw;
      p.legs[i][0] += d.down * (me ? st.sw : -6);
      p.legs[i][1] = Math.max(p.legs[i][1], d.down * (me ? st.fold : 0));
      p.legs[i][2] = Math.max(p.legs[i][2], d.down * (me ? st.off : 0));
      if (me) p.foot[i] -= d.down * 30 * st.drag;
    }
    p.legs[2][0] -= 8 * d.down;
    p.legs[3][0] -= 8 * d.down;
    const side = d.paw ? 1 : -1;
    p.neck[0] += d.down * (20 + 5 * st.drag);
    // The head turned away from the digging paw as it drags, so the claws are seen at work beside the face.
    p.neck[1] += d.down * (s.strike === 2 ? 12 : 7) * side * st.drag;
    p.head[0] -= d.down * (16 + 6 * st.drag - 4 * st.off);
    p.pitch -= d.down * (4 + 2 * st.drag);
    p.roll += d.down * 4 * side * Math.sin(Math.PI * d.w);
    p.tail[1] += d.down * 20 * Math.sin(act.t * TAU * s.digs);
    if (p.ears[0]) for (const e of p.ears) e[0] += d.down * 20;
  } else if (act?.kind === 'evolve') {
    // Evolving: hunched as the light gathers and the crystals push up out of its back, then at the turn drawn up tall, a shake
    // of the head, and settled.
    const t = act.t, hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.44, 0.52)), up = ramp(t, 0.46, 0.56) * (1 - ramp(t, 0.72, 0.92));
    const shake = hump(t, 0.62, 0.1);
    p.lift -= 0.08 * hunch;
    p.squash += 0.06 * hunch - 0.04 * up;
    p.neck[0] += 18 * hunch - 14 * up;
    p.head[0] += -10 * hunch + 16 * up;
    p.head[2] += 14 * shake * Math.sin(t * 70);
    p.pitch += 6 * up;
    for (const e of p.ears) e[0] += 25 * hunch;
  }
  // However far the body is carried forward, the legs swung back by as much, so the feet stay where they are.
  const d = surge(s, a);
  if (d) {
    for (let i = 0; i < 4; i++) {
      const L = (i < 2 ? spec.fore : spec.hind).len;
      p.legs[i][0] -= Math.asin(clamp(d / (L[0] + L[1]), -0.9, 0.9)) / DEG;
    }
  }
}

/**
 * Each stage's strike. The Ironemole rears onto its left side and swipes its
 * right paw down; the Ferrodrill crouches, lunges and slashes with one fore
 * paw and then the other; the Oremander rears right up on its hind legs, both
 * fore paws high, and slams them down, the whole of it shaking as it lands.
 */
function strikePose(s: Mole, p: QuadPose, t: number): void {
  const raise = (i: number, k: number, down: number, high = 92, fold = 0.55): void => {
    p.legs[i][0] += high * k + 10 * down;
    p.legs[i][1] = Math.max(p.legs[i][1], fold * k);
    p.legs[i][2] = Math.max(p.legs[i][2], k);
  };
  if (s.strike === 0) {
    const up = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.42, 0.5)), down = ramp(t, 0.42, 0.5) * (1 - ramp(t, 0.64, 0.95));
    const st = settleOf(t, IRON_HITS[0][0]);
    // The right paw held high and nearly straight, claws out, then raked down; the head turned away from it on the down
    // stroke so the paw and its claws are clear of the face.
    raise(1, up, down, 110, 0.3);
    p.roll -= 10 * up - 4 * down;
    p.pitch += 24 * up - 6 * down + 2 * st;
    p.legs[2][0] -= 20 * up;
    p.legs[3][0] -= 20 * up;
    p.legs[2][1] += 0.4 * up;
    p.legs[3][1] += 0.4 * up;
    p.neck[1] += -6 * up + 15 * down;
    p.head[0] += -8 * up;
    for (const e of p.ears) e[0] += 30 * up;
    return;
  }
  if (s.strike === 1) {
    const [h1, h2] = IRON_HITS[1];
    const crouch = ramp(t, 0, 0.24) * (1 - ramp(t, 0.28, 0.38));
    const upL = ramp(t, 0.2, 0.36) * (1 - ramp(t, h1 - 0.07, h1)), downL = ramp(t, h1 - 0.07, h1) * (1 - ramp(t, h1 + 0.12, 0.85));
    const upR = ramp(t, 0.3, h2 - 0.1) * (1 - ramp(t, h2 - 0.07, h2)), downR = ramp(t, h2 - 0.07, h2) * (1 - ramp(t, h2 + 0.12, 1));
    const lunge = ramp(t, 0.28, 0.46) * (1 - ramp(t, 0.68, 1));
    raise(0, upL, downL);
    raise(1, upR, downR);
    p.lift -= 0.08 * crouch;
    p.legs[2][1] += 0.4 * crouch;
    p.legs[3][1] += 0.4 * crouch;
    p.pitch += -5 * crouch + 16 * Math.max(upL, upR) - 4 * lunge;
    p.legs[2][0] -= 12 * Math.max(upL, upR);
    p.legs[3][0] -= 12 * Math.max(upL, upR);
    // Rolled onto the striking side with each slash, so the paw is thrown out from under the head.
    p.roll += 8 * (downR - downL) + 4 * (upR - upL);
    p.neck[0] += -12 * crouch + 14 * lunge;
    p.neck[1] += 8 * (downL - downR);
    p.head[0] += -10 * crouch + 6 * lunge;
    p.foot[2] -= 10 * lunge;
    p.foot[3] -= 10 * lunge;
    p.legs[2][1] += 0.25 * lunge;
    p.legs[3][1] += 0.25 * lunge;
    for (const e of p.ears) e[0] += 30 * crouch + 20 * lunge;
    return;
  }
  const hit = IRON_HITS[2][0];
  const rear = ramp(t, 0.06, 0.42) * (1 - ramp(t, hit - 0.1, hit)), slam = ramp(t, hit - 0.08, hit) * (1 - ramp(t, 0.74, 1));
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  // Reared up past forty degrees, its fore legs held out level in front of its chest, so the paws are under its chin.
  raise(0, rear, slam, 62);
  raise(1, rear, slam, 62);
  p.pitch += 38 * rear - 5 * slam;
  p.legs[2][0] -= 32 * rear;
  p.legs[3][0] -= 32 * rear;
  // Its hind legs bent under it as it rears, crouched on its haunches rather than stood up on stilts.
  p.legs[2][1] += 0.5 * rear;
  p.legs[3][1] += 0.5 * rear;
  p.neck[0] += -14 * rear + 10 * slam;
  p.head[0] += -26 * rear - 6 * slam;
  // Landing: the barrel squashed as the weight comes down on the paws, and shaken.
  p.squash += 0.06 * hump(t, hit + 0.03, 0.08) + 0.02 * shake;
  p.roll += 2.5 * shake;
}

/** The bones of a stage: a body on four legs (`quadBonesOf`), carried forward as it strikes and digs. */
function moleBones(s: Mole): (a: Anim) => Bones {
  const spec = specOf(s);
  const grazing = quadBonesOf(spec, (p, a) => molePose(s, spec, p, a));
  /** How far the body is tipped to level it on its four feet standing still: a strike or evolving starts and ends there. */
  let rest: number | undefined;
  const level = (p: QuadPose, b: Bones, feet: readonly number[]): number => {
    const fore = feet.filter((i) => i < 2), hind = feet.filter((i) => i >= 2);
    return fore.length && hind.length ? Math.atan2(lowOf(spec, b, hind) - lowOf(spec, b, fore), spec.fore.at[1] - spec.hind.at[1]) / DEG : 0;
  };
  return (a) => {
    const act = a.act;
    let b: Bones;
    if (a.graze > 0 && a.go < 1 && !act) b = grazing(a);
    else {
      // Striking or digging it is posed from standing, its head brought down to the ground by the dig itself rather than by
      // grazing, which would let its chest down onto its fore legs; whether it was grazing is what says the dig is looping.
      const p = quadPose(spec, act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a);
      molePose(s, spec, p, a);
      const feet = supporting(s, p, a);
      b = quadBones(spec, p);
      // Standing, going or digging, the body levelled between its fore and hind feet bearing weight, so neither pair hangs off the
      // ground: tipped by as much as one pair's soles are over the other's, across the length between shoulder and hip.
      // A strike or evolving pitches the body on purpose, so it keeps only the tip it has standing still, which it begins
      // and ends at.
      if (!act || act.kind === 'work') p.pitch += level(p, b, feet);
      else {
        if (rest === undefined) {
          const q = quadPose(spec, { ...a, act: undefined, t: 0, go: 0, graze: 0 });
          molePose(s, spec, q, { ...a, act: undefined, t: 0, go: 0, graze: 0 });
          rest = level(q, quadBones(spec, q), [0, 1, 2, 3]);
        }
        p.pitch += rest;
      }
      b = quadBones(spec, p);
      b = standOn(spec, b, p, feet);
    }
    const d = surge(s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // The weight shifted from side to side as it goes, onto whichever fore foot is down -- the Ironemole's waddle, the
    // Oremander's heavy roll -- and a rock fore and aft on the plod: the barrel and the crest on it turned over the legs, so
    // the feet stay where they are on the ground.
    if (a.go > 0) {
      const g = smooth(a.go), w = frac(a.u), G = s.gait;
      b.trunk = joint(b.trunk, [0, 0, 0], G.trot ? 0 : g * 1.6 * Math.sin(w * TAU * 2 + 0.5), g * G.roll * Math.sin(w * TAU + 0.4), 0);
    }
    return b;
  };
}

/**
 * Which feet bear its weight this moment: those on the ground, but never the
 * paw digging, whose claws go down into the earth; and while the hind feet
 * are both down, nothing else is needed. A paw curling as it swings, its
 * claws tipped down, is off the ground and does not lift the body.
 */
function supporting(s: Mole, p: QuadPose, a: Anim): number[] {
  const act = a.act;
  const dig = act?.kind === 'work' ? digOf(s, act.t, a.graze) : undefined;
  const down = [0, 1, 2, 3].filter((i) => p.legs[i][2] < 0.05 && !(dig && dig.down > 0.01 && i === dig.paw));
  return down.length ? down : [0, 1, 2, 3];
}

const LEG_KEYS = ['fl', 'fr', 'hl', 'hr'];
/** How low the lowest sole of `feet` is. */
function lowOf(spec: QuadSpec, b: Bones, feet: readonly number[]): number {
  let low = Infinity;
  for (const i of feet) {
    const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
    for (const y of [ahead, -behind]) low = Math.min(low, place(b[`${LEG_KEYS[i]}2`], [0, y, -L.len[2]])[2]);
  }
  return low;
}
/** The body stood on the soles of `feet` (`quadBones` stood it on the lowest of all four), and its shadow under it again. */
function standOn(spec: QuadSpec, b: Bones, p: QuadPose, feet: readonly number[]): Bones {
  const out = lifted(b, p.lift - lowOf(spec, b, feet));
  out.shadow = shadowOf(out.body, p.lift);
  return out;
}

/* ---- crystals ------------------------------------------------------------------------------ */

/** The three kinds of crystal it grows: copper, slate and pale peach; each a light face, a dark face and a bright face at the point. */
type Tone = 'copper' | 'slate' | 'peach';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { copper: ['crystal', 'crystalDark', 'ember'], slate: ['stone', 'stoneDark', 'feather'], peach: ['shell', 'shellDark', 'petal'] };

/** One crystal: rooted at `root`, pointing along `dir`, `len` long and `r` across at its shoulder, `flat` as thick as it is wide. */
interface Gem { root: V3; dir: V3; len: number; r: number; flat: number; tone: Tone; id: number }

/** Each wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/**
 * A crystal: a pointed prism of `sides` faces, narrower where it goes into
 * the body, widest two thirds of the way up and coming to a point a little
 * off its middle; its faces light and dark in turn, and the faces of its
 * point light and bright in turn, so it reads as cut. Every other one has a
 * glint painted on its bright face.
 */
function gemMesh(g: Gem, sides: number): Mesh {
  const z = unit(g.dir);
  let x = cross(z, [0, 0, 1]);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const spin = jitter(g.id + 17) * TAU;
  const ring = (c: V3, rad: number): V3[] => Array.from({ length: sides }, (_, j) => {
    const t = spin + (j / sides) * TAU, k = rad * (0.82 + 0.32 * jitter(g.id * 7 + j));
    return add(c, add(scale(x, Math.cos(t) * k), scale(y, Math.sin(t) * k * g.flat)));
  });
  const base = ring(sub(g.root, scale(z, g.len * 0.1)), g.r * 0.7);
  const mid: V3 = add(g.root, scale(z, g.len * 0.6));
  const shoulder = ring(mid, g.r);
  const tip = add(add(g.root, scale(z, g.len)), scale(x, g.len * 0.1 * (jitter(g.id + 5) - 0.5)));
  const v: V3[] = [...base, ...shoulder, tip];
  const f: Face[] = [], want: V3[] = [];
  const [light, dark, bright] = TONES[g.tone];
  for (let j = 0; j < sides; j++) {
    const j1 = (j + 1) % sides;
    const out = unit(sub(scale(add(shoulder[j], shoulder[j1]), 0.5), mid));
    // The faces going into the body are soft: their open rim, down in the fur, is not inked.
    f.push({ i: [j, j1, sides + j1, sides + j], m: j % 2 ? dark : light, soft: true });
    want.push(out);
    f.push({ i: [sides + j, sides + j1, 2 * sides], m: j % 2 ? light : bright });
    want.push(unit(add(out, scale(z, 0.7))));
  }
  const body = mesh(v, wound(v, f, want));
  if (g.id % 2) return body;
  // A glint on the bright face of its point, a small diamond lit whichever way it is turned.
  const c = scale(add(add(shoulder[0], shoulder[1 % sides]), tip), 1 / 3), n = unit(add(unit(sub(scale(add(shoulder[0], shoulder[1 % sides]), 0.5), mid)), scale(z, 0.7)));
  const at = add(c, scale(n, 0.012));
  return merge(body, paint([disc(add(at, scale(z, g.len * 0.05)), n, g.r * 0.12, g.r * 0.26, 4, 'glint', { up: z, lit: true })]));
}

/** Crystals as one mesh, with for each corner how far up its crystal it is, where its crystal is rooted, how long it is and a phase of its own (its crystal's). */
interface Gems { mesh: Mesh; w: number[]; root: V3[]; len: number[]; ph: number[]; list: Gem[] }
function gemsOf(list: readonly Gem[], sides: number): Gems {
  const w: number[] = [], root: V3[] = [], len: number[] = [], ph: number[] = [];
  const meshes = list.map((g) => {
    const m = gemMesh(g, sides), z = unit(g.dir);
    for (const p of m.v) {
      w.push(clamp(dot(sub(p, g.root), z) / g.len));
      root.push(g.root);
      len.push(g.len);
      ph.push(jitter(g.id + 31) * TAU);
    }
    return m;
  });
  return { mesh: merge(...meshes), w, root, len, ph, list: [...list] };
}

/** The most any crystal is tipped as it jiggles, in radians: a crystal is stone, and is rocked on its root, not bent. */
const JIGGLE_MOST = 0.06;

/**
 * How the crystals move this moment: how far each is rocked on its root
 * (radians) and how fast, and how far grown they are. Rocking as it goes --
 * the Ironemole's crest jiggling, the Oremander's hardly at all -- rattling
 * as a blow lands and at each stroke of its digging, and as it evolves
 * pushing up out of its back from half their size, overshooting at the turn
 * and settling.
 */
function rattle(s: Mole, a: Anim): { jig: number; at: number; grow: number } {
  let jig = 0, at = 0, grow = 1;
  if (a.go > 0) {
    jig = smooth(a.go) * s.gait.jiggle * (0.018 + 0.008 * a.gait);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const hits = IRON_HITS[s.strike];
    for (const h of hits) jig += (0.055 - 0.015 * s.strike) * hump(act.t, h + 0.05, 0.12);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    const d = digOf(s, act.t, a.graze);
    jig += d.down * (0.03 - 0.01 * s.strike) * hump(d.w, DIG_STROKE.bite + 0.05, 0.15);
    at = act.t * 50;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.5 + 0.5 * ramp(t, 0.04, 0.5) + 0.14 * hump(t, 0.54, 0.08);
    jig += 0.04 * hump(t, 0.6, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(JIGGLE_MOST, jig), at, grow };
}

/**
 * A piece of crystals that rattles and grows (`rattle`): each crystal whole,
 * scaled from its root as it grows and rocked on its root, side to side and
 * fore and aft, each a beat of its own.
 */
function rattling(s: Mole, G: Gems, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow } = rattle(s, a);
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i] + phase;
      let [x, y, z] = scale(sub(p, r), grow);
      // Rocked side to side (about the body's length) and fore and aft (about its breadth).
      const side = jig * Math.sin(at + ph), fore = jig * 0.6 * Math.cos(at + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/**
 * The crest down its back, in rows from the shoulders to the rump: the
 * tallest along the spine where the stage says, shorter out to the sides and
 * toward either end, each leaning back toward the tail and out from the
 * spine. Most are copper; slate ones, broader and flatter, lie back further
 * like scales; and there are a few small pale peach ones. Below them, small
 * crystals like pebbles over the rest of the back, and on a grown one
 * crystals out of the shoulders and the haunches.
 */
function crestGems(s: Mole): Gem[] {
  const C = s.crest, out: Gem[] = [];
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y = lerp(C.from, C.to, f);
    const prof = 0.32 + 0.68 * Math.exp(-((f - C.peak) ** 2) / C.width);
    const count = C.per + (r % 2 ? -1 : 0);
    for (let q = 0; q < count; q++) {
      const id = 100 + r * 17 + q;
      const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
      const th = Math.PI / 2 + g * 2 * C.spread * (1 - 0.15 * f) + (jitter(id) - 0.5) * 0.18;
      const at = onRings(s.body, y + (jitter(id + 3) - 0.5) * 0.12, th);
      const pick = jitter(id + 9);
      // The spine copper, the tallest of it nearly all; slate and peach mostly out to the sides; and on the Ironemole, whose
      // slate is small (`slateK`), the spine is all copper.
      const spine = edge < (C.slateK < 1 ? 0.4 : 0.3);
      const tone: Tone = spine && (prof > 0.8 || C.slateK < 1) ? (pick < C.slate * 0.5 && C.slateK >= 1 ? 'slate' : 'copper') : pick < C.peach ? 'peach' : pick < C.peach + C.slate ? 'slate' : 'copper';
      const slate = tone === 'slate', peach = tone === 'peach';
      const len = C.tall * prof * (1 - 0.42 * edge) * (0.78 + 0.4 * jitter(id + 5)) * (slate ? 0.95 * C.slateK : peach ? 0.6 : 1);
      // Leaning back toward the tail, the slate ones more, and out from the spine; the spine's own almost straight up.
      const back = (slate ? 1.0 : 0.38) + 0.25 * f + 0.2 * (jitter(id + 6) - 0.5);
      const dir = unit(add(add(at.n, [0, -back, 0]), [g * 0.9, 0, 0.1]));
      out.push({ root: add(at.p, scale(at.n, -0.04)), dir, len, r: C.r * (slate ? 1.45 * C.slateK : peach ? 0.75 : 1) * (0.85 + 0.3 * jitter(id + 8)) * (0.6 + 0.4 * prof), flat: slate ? 0.4 : 0.8, tone, id });
    }
  }
  // Pebbles: small crystals over the back below the crest and down onto the flanks, both sides alike but not mirrored.
  const [np, pl, low] = s.pebbles;
  for (let q = 0; q < np; q++) {
    const id = 400 + q, sd = q % 2 ? 1 : -1;
    const f = (Math.floor(q / 2) + 0.5 * jitter(id)) / Math.ceil(np / 2);
    const y = lerp(C.from + 0.1, C.to - 0.05, f);
    // From just under the crest down the flank as far as the stage says, smaller the lower they are.
    const down = jitter(id + 2), th0 = lerp(Math.PI / 2 - C.spread * 0.75 - 0.1, low, down);
    const at = onRings(s.body, y, sd > 0 ? th0 : Math.PI - th0);
    const pick = jitter(id + 4);
    const tone: Tone = pick < 0.4 ? 'copper' : pick < 0.72 ? 'slate' : 'peach';
    out.push({ root: add(at.p, scale(at.n, -0.02)), dir: unit(add(at.n, [0, -0.6, 0.2])), len: pl * (0.7 + 0.6 * jitter(id + 5)) * (1 - 0.3 * down), r: pl * 0.55, flat: 0.7, tone, id });
  }
  // Crystals out of each shoulder and each haunch, pointing up, out and back.
  const [ns, sl] = s.shoulder;
  for (const sd of [1, -1]) {
    for (const [y0, k] of [[s.len * 0.42, 1], [-s.len * 0.36, 0.8]] as Array<[number, number]>) {
      for (let q = 0; q < ns; q++) {
        const id = 600 + q * 3 + (sd > 0 ? 0 : 50) + (k < 1 ? 20 : 0);
        const th0 = 0.35 + 0.28 * q + 0.15 * jitter(id);
        const at = onRings(s.body, y0 + (q - (ns - 1) / 2) * 0.22 + 0.1 * (jitter(id + 1) - 0.5), sd > 0 ? th0 : Math.PI - th0);
        // The first on each shoulder the biggest, and copper: what the eye finds there.
        const first = q === 0 && k === 1;
        const tone: Tone = first ? 'copper' : q % 3 === 1 ? 'slate' : jitter(id + 3) < 0.25 ? 'peach' : 'copper';
        out.push({ root: add(at.p, scale(at.n, -0.03)), dir: unit(add(at.n, [0, -0.45, 0.45])), len: sl * k * (first ? 1.1 : 0.75 + 0.4 * jitter(id + 4)) * (1 - 0.15 * q), r: sl * 0.32 * (first ? 1.3 : 1), flat: 0.75, tone, id });
      }
    }
  }
  return out;
}

/** Crystals out of the outside of a leg, on its upper bone, pointing out and back: the left one's mirrored. */
function limbGems(s: Mole, fore: boolean, side: number, seed: number): Gem[] {
  const [n, L] = s.limb, len = (fore ? s.fore : s.hind)[0];
  return Array.from({ length: n }, (_, q): Gem => {
    const id = seed + q;
    const z = -len * (0.35 + 0.4 * q), r = s.thick * (1 - 0.25 * q);
    return { root: [side * r * 0.85, 0.02, z], dir: unit([side * 0.9, fore ? -0.15 : -0.45, 0.55 - 0.2 * q]), len: L * (1 - 0.2 * q) * (0.85 + 0.3 * jitter(id)), r: L * 0.32, flat: 0.75, tone: q % 2 ? 'slate' : 'copper', id };
  });
}

/** Crystal points over the Oremander's eyes, standing up and swept back from the brow. */
function browGems(s: Mole): Gem[] {
  const [n, L] = s.brow, E = s.eye, H = s.head, out: Gem[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < n; q++) {
      // From over the eye back along the side of the crown to the back of the skull, to meet the crest.
      const id = 700 + q + (sd > 0 ? 0 : 10), f = n > 1 ? q / (n - 1) : 0;
      const q0 = onRings(H, lerp(E.y - E.size * 0.4, H.y[0] * 0.4, f), E.up + 0.5 + 0.35 * f), at = sd > 0 ? q0 : left(q0);
      // Laid back along the skull, broad, so they are the crest running on down onto the head.
      out.push({ root: sub(at.p, scale(at.n, 0.03)), dir: unit(add(scale(at.n, 0.35), [0, -1.2, 0.5])), len: L * (0.8 + 0.25 * f), r: L * 0.4, flat: 0.7, tone: q === 1 ? 'slate' : 'copper', id: id * 2 });
    }
  }
  // Along the crown, leading the crest down onto the head: lying back, the one nearest the neck the tallest.
  const [nc, Lc] = s.crown;
  for (let q = 0; q < nc; q++) {
    const f = nc > 1 ? q / (nc - 1) : 0, id = 760 + q;
    const at = onRings(H, lerp(H.y[2] * 0.6, H.y[0] * 0.6, f), Math.PI / 2 + (q % 2 ? 0.18 : -0.18));
    out.push({ root: sub(at.p, scale(at.n, 0.03)), dir: unit(add(at.n, [0, -1.1, 0])), len: Lc * (0.65 + 0.35 * f), r: Lc * 0.34, flat: 0.75, tone: 'copper', id: id * 2 });
  }
  return out;
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line, a lid. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  const n = pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3);
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/**
 * The eyes, open or shut: big, round and glossy on the Ironemole, a dark
 * ball with two glints; narrower on the Ferrodrill and the Oremander, a lid
 * of fur come down over the top of each, slanting in toward the snout, so it
 * looks out calm and fierce at once. All of an eye goes out of sight together
 * behind the skull or the snout.
 */
function eyesOf(s: Mole, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onRings(s.head, E.y, E.up), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.3, 0.04])), p = add(q.p, scale(n, 0.01)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size, tall = E.tall;
    if (shut) {
      out.push(disc(add(p, scale(up, -r * 0.1)), n, r * 1.1, r * 0.26, 8, 'lid', o));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.05)), n, r * 1.16, r * tall * 1.14, 10, 'lid', o));
    if (E.lid) {
      // A warm brown eye with a dark middle, so narrowed it is still an eye and not a dark mark.
      out.push(disc(add(p, scale(n, 0.004)), n, r, r * tall, 12, 'bark', o));
      out.push(disc(add(p, scale(n, 0.008)), n, r * 0.55, r * tall * 0.6, 10, 'eye', o));
    } else {
      out.push(disc(add(p, scale(n, 0.004)), n, r, r * tall, 12, 'eye', o));
      out.push(disc(add(add(p, scale(n, 0.008)), scale(up, -r * tall * 0.3)), n, r * 0.62, r * tall * 0.4, 8, 'hoof', o));
    }
    if (E.lid) {
      // The lid: fur down over the top of the eye, its edge slanting down toward the snout.
      const tilt = -side * 0.35;
      out.push(disc(add(add(p, scale(n, 0.012)), scale(up, r * tall * (1.35 - E.lid * 1.1))), n, r * 1.3, r * tall * 0.75, 10, 'coat', { ...o, spin: tilt }));
    }
    const gy = E.lid ? 0.15 : 0.38;
    out.push(disc(add(add(add(p, scale(n, 0.016)), scale(up, r * tall * gy)), scale(across, side * r * 0.32)), n, r * 0.3, r * 0.3, 6, 'glint', { ...o, lit: true }));
    if (!E.lid) out.push(disc(add(add(add(p, scale(n, 0.016)), scale(up, -r * tall * 0.42)), scale(across, -side * r * 0.3)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }));
  }
  return paint(out);
}

/**
 * The head: built as rings from the back of the skull to the snout
 * (`Mole.head`), dark fur over the crown and down the top of the snout and
 * cream over the face, the cheeks and the chin; a round pink nose on the end
 * with two nostrils; a gentle smile back along each side of the muzzle; and on
 * the older ones, cream tufts of fur swept back off the cheeks and a heavy
 * brow over each eye.
 */
function headOf(s: Mole, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    // Facet `j` is centred `j + 1` steps round from the right side: how far up the side it is, against how far the cream comes.
    const up = Math.sin(((j + 1) / n) * TAU);
    return up > H.cream[Math.min(ring, H.cream.length - 1)] ? 'coat' : 'muzzle';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.25, H.z[last] + 0.01];
  const nose = orbAlong(tipC, [0, 1, 0.15], [s.nose * 1.1, s.nose * 0.85, s.nose * 0.85], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.82, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.38, 0.01, -s.nose * 0.12]), [0, 1, 0.1], s.nose * 0.17, s.nose * 0.26, 6, 'pad')));
  // A chin under the muzzle, cream.
  const chin = orb([0, lerp(H.y[3], H.y[4], 0.6), H.z[4] - H.h[4] * 0.62], [H.w[4] * 0.62, (H.y[5] - H.y[3]) * 0.42, H.h[4] * 0.42], n, k, 'muzzle');
  // The smile: from under the nose back along the side of the muzzle, turned up at its corner.
  // Each side's goes out of sight whole when the snout is between it and the viewer, as an eye does.
  const mouth = paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], lerp(H.y[3], H.y[4], 0.55), f), th = -0.5 - 0.05 * f + 0.32 * f ** 3;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.028, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.06)) };
  }));
  // Cream tufts swept back off each cheek.
  const [nt, tl] = s.cheek;
  const tufts = nt ? merge(...[1, -1].flatMap((sd) => Array.from({ length: nt }, (_, q) => {
    const q0 = onRings(H, lerp(H.y[1], H.y[2], 0.4 + 0.25 * q), -0.55 + 0.32 * q), at = sd > 0 ? q0 : left(q0);
    const dir = unit(add(at.n, [0, -1.4, -0.1 - 0.15 * q]));
    const L = tl * (1 - 0.12 * q);
    return tube(curve(sub(at.p, scale(at.n, 0.05)), add(at.p, scale(dir, L * 0.5)), add(at.p, add(scale(dir, L), [0, 0, -0.03])), 2), [L * 0.34, L * 0.22, 0.01], [L * 0.24, L * 0.16, 0.01], 5, 'muzzle', { seam: 'start' });
  }))) : undefined;
  // A heavy brow over each eye on the older ones: a ridge of fur along the slope of the skull.
  const E = s.eye;
  const brows = E.lid > 0 && merge(...[1, -1].map((sd) => {
    const q0 = onRings(H, E.y - E.size * 0.2, E.up + E.size * 2.4), q = sd > 0 ? q0 : left(q0);
    return orbAlong(sub(q.p, scale(q.n, E.size * 0.6)), [0, 1, -0.3], [E.size * 1.2, E.size * (0.7 + E.lid), E.size * 2], 6, 4, 'coat');
  }));
  // Specks of fur on the crown.
  const specks: Disc[] = [];
  for (let q = 0; q < 6; q++) {
    const at = onRings(H, lerp(H.y[0], H.y[3], jitter(q + 80)), Math.PI / 2 + (jitter(q + 90) - 0.5) * 1.4);
    specks.push(disc(add(at.p, scale(at.n, 0.015)), at.n, H.w[2] * 0.06, H.w[2] * 0.045, 5, q % 2 ? 'coatLight' : 'coatDark', { spin: q }));
  }
  return merge(skull, chin, brows, tufts, nose, nostrils, mouth, paint(specks), eyesOf(s, shut));
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the snout. */
function headSolids(s: Mole): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[6]) / 2, H.z[5]], r: [H.w[5] * 0.9, (H.y[6] - H.y[4]) / 2, H.h[5] * 0.85] },
  ];
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/**
 * A fore paw (the right; the left is its mirror): a broad flat paw of fur
 * and, out of the front of it, the big pale digging claws, each a thick
 * curved blade reaching forward and down to the ground, fanned a little,
 * pale on top and a shade darker underneath. What reads first at the size
 * the island is played at, with the crest.
 */
function forePaw(s: Mole, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2], C = s.claw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.5], [0, 1, 0], [r * 1.05, r * 0.6, r * 1.1], n, k, 'coat');
  const claws = Array.from({ length: C.n }, (_, q) => {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, L = C.len * (1 - 0.25 * Math.abs(f) * 2 * 0.6);
    const root: V3 = [f * r * 1.3, r * 0.85, -d + r * 0.62];
    const pts = curve(root, [f * r * 1.55, root[1] + L * 0.6, -d + r * 0.62 + L * 0.12], [f * r * 1.9, root[1] + L, -d + 0.02], 4);
    const cw = C.w;
    return tube(pts, [cw * 0.78, cw * 0.72, cw * 0.56, cw * 0.32, 0.014], [cw, cw * 0.94, cw * 0.74, cw * 0.44, 0.014], 6, (_ring, j) => (under(6, j, 1.3) ? 'hornDark' : 'claw'), { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A hind paw: smaller, with short pale claws. */
function hindPaw(s: Mole, n: number, k: number): Mesh {
  const r = s.hindPaw, d = s.hind[2], L = s.hindClaw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.5], [0, 1, 0], [r, r * 0.6, r * 1.15], n, k, 'coat');
  const claws = [-1, 0, 1].map((f) => {
    const root: V3 = [f * r * 0.55, r * 1.05, -d + r * 0.45];
    return tube(curve(root, [f * r * 0.65, root[1] + L * 0.6, root[2] + L * 0.05], [f * r * 0.75, root[1] + L, -d + 0.02], 2), [0.05, 0.035, 0.01], [0.07, 0.05, 0.01], 5, 'claw', { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/**
 * A barrel's rings with its ends rounded: between the last ring at either
 * end and the one inside it, another, still most of the way out, so the rump
 * and the chest are domes rather than cut off flat.
 */
function domed(B: Rings): Rings {
  const out: Rings = { y: [], z: [], w: [], h: [] };
  const put = (y: number, z: number, w: number, h: number): void => { out.y.push(y); out.z.push(z); out.w.push(w); out.h.push(h); };
  const between = (a: number, b: number, f: number): void => {
    // `f` of the way from ring `a` (inside) to ring `b` (the end) along it, but only `f` squared of the way in toward its size.
    const g = f * f;
    put(lerp(B.y[a], B.y[b], f), lerp(B.z[a], B.z[b], f), lerp(B.w[a], B.w[b], g), lerp(B.h[a], B.h[b], g));
  };
  const last = B.y.length - 1;
  put(B.y[0], B.z[0], B.w[0], B.h[0]);
  between(1, 0, 0.6);
  for (let k = 1; k < last; k++) put(B.y[k], B.z[k], B.w[k], B.h[k]);
  between(last - 1, last, 0.6);
  put(B.y[last], B.z[last], B.w[last], B.h[last]);
  return out;
}

/** Its speckled fur: flecks lighter and darker than the coat over the flanks, and a few of copper, as if dusted with ore. */
function specks(s: Mole): Mesh {
  const out: Disc[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 16; q++) {
      const id = q * 3 + (sd > 0 ? 0 : 100);
      const y = lerp(s.body.y[1], s.body.y[5], jitter(id));
      const th = -0.35 + 1.15 * jitter(id + 1);
      const { p, n } = onRings(s.body, y, sd > 0 ? th : Math.PI - th);
      const r = s.len * (0.022 + 0.02 * jitter(id + 2));
      out.push(disc(add(p, scale(n, 0.025)), n, r, r * 0.7, 5, q % 5 === 0 ? 'flame' : q % 2 ? 'coatLight' : 'coatDark', { spin: jitter(id + 3) * 3 }));
    }
  }
  return paint(out);
}

/** A stage's pieces: a body on four short legs (`quadPieces`) with its own head, paws and claws, and its crystals. */
function moleBuild(s: Mole, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), sides = cut(lod, 4, 5);
  const B = s.body, skull = headSolids(s)[0];
  const R = domed(B);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, n,
    (ring, j) => (s.belly && ring > 1 && ring < R.y.length - 3 && under(n, j, s.belly) ? 'belly' : 'coat'));
  // Its underside tucked in toward the belly, so seen from behind it is a dome on its legs rather than a box.
  const body = mesh(barrel.v.map((p, i) => {
    const k = Math.min(R.y.length - 1, Math.floor(i / n)), t = clamp((R.z[k] - p[2]) / R.h[k]);
    return [p[0] * (1 - 0.24 * t * t), p[1], p[2]] as V3;
  }), barrel.f);
  // A cream bib on the chest under the head, on the older ones.
  const bib = s.belly ? orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.42], [0, 1, -0.5], [B.w[5] * 0.7, B.h[5] * 0.55, B.h[5] * 0.36], n, k, 'belly') : undefined;
  const crest = gemsOf(crestGems(s), sides);
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = fore ? s.fore : s.hind, w = s.thick;
    return { upper: [0.04, -L[0], w * 1.2, w * 1.05], lower: [0, -L[1], w, w * 0.8], foot: fore ? forePaw(s, n, k) : hindPaw(s, n, k) };
  };
  const extras: Piece[] = [
    { key: 'crest', mesh: crest.mesh, bone: 'trunk', bias: 0.1, after: ['body'], sheen: 'spot', bent: rattling(s, crest, 0) },
  ];
  if (s.brow[0] || s.crown[0]) {
    const brow = gemsOf(browGems(s), sides);
    extras.push({ key: 'brow', mesh: brow.mesh, bone: 'head', bias: 0.24, after: ['head'], hide: [skull], sheen: 'spot', bent: rattling(s, brow, 1) });
  }
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    // Flatter than it is wide: on a body this low a round neck would reach the ground under the chin.
    neck: { w: s.neck.w, h: s.neck.w * 0.72, len: s.neck.len },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: s.ear ? earMesh(s.ear, s.ear * 0.85, n) : undefined,
    earTurn: -30,
    tail: [tube(curve([0, 0.04, 0], [0, -0.1, 0.03], [0, -0.18, -0.02], 2), [0.1, 0.08, 0.03], [0.09, 0.07, 0.03], 5, 'coat', { seam: 'start' })],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras,
  });
  // Crystals out of the outside of each leg, over the leg and drawn with it.
  if (s.limb[0]) {
    for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
      const G = gemsOf(limbGems(s, fore, side, key.charCodeAt(0) * 7 + key.charCodeAt(1)), sides);
      pieces.push({ key: `${key}gem`, mesh: G.mesh, bone: `${key}0`, bias: 0.04, after: [`${key}0`, `${key}1`, 'body'], front: [side, fore ? 0.4 : -0.4, 0], sheen: 'spot', bent: rattling(s, G, 2) });
    }
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib, specks(s)) };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const COPPER: RGB = [214, 116, 66];
const SLATE: RGB = [120, 126, 138];
const PEACH: RGB = [246, 212, 182];
const EARTH: RGB = [116, 86, 64];
/** Earth turned up dry, paler: thrown, it is seen against dark fur as well as against grass. */
const LOAM: RGB = [168, 128, 88];
/** Earth dug up from under it, dark, with a pale rim so it is seen against fur and grass alike. */
const SOIL: RGB = [92, 64, 46];
const RIM: RGB = [196, 164, 124];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const TONE_RGB: Record<Tone, RGB> = { copper: COPPER, slate: SLATE, peach: PEACH };

/** A shard of crystal in the air, `len` long, turned `ang`: a diamond, light over its upper half and dark under, with a pale edge. */
function shard(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  if (al <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.08, -len * 0.24);
  g.lineTo(len / 2, 0);
  g.lineTo(len * 0.04, len * 0.2);
  g.closePath();
  g.fillStyle = css(mix(c, [40, 30, 34], 0.25), al);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [40, 30, 34], 0.5), al);
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.08, -len * 0.24);
  g.lineTo(len / 2, 0);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 246, 230], 0.3), al);
  g.fill();
  g.restore();
}

/** A glint: a small four-pointed star of light, added to what is under it. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, c: RGB = [255, 248, 228]): void {
  if (al <= 0.01 || r <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 0.9);
  halo.addColorStop(0, css(c, al * 0.6));
  halo.addColorStop(1, css(c, 0));
  g.fillStyle = halo;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = css(c, al);
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
  g.restore();
}

/** A clod of earth in the air: a lumpy dark pebble. */
function clod(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number, c: RGB = EARTH, rim?: RGB): void {
  if (al <= 0) return;
  g.beginPath();
  for (let q = 0; q < 6; q++) {
    const t = ang + (q / 6) * TAU, k = r * (0.8 + 0.25 * Math.sin(q * 2.3 + ang));
    if (q) g.lineTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
    else g.moveTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = r * 0.25;
  g.strokeStyle = css(rim ?? mix(c, [40, 28, 24], 0.45), al);
  g.stroke();
}

/** A soft puff of dust on the ground at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0) return;
  const [x, y] = onScreen(view, at);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([168, 140, 112], al));
  grad.addColorStop(1, css([168, 140, 112], 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.58, 0, 0, TAU);
  g.fill();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Ferrodrill's: less than in proportion on the small one, so they still read. */
const bigness = (s: Mole): number => 0.35 + 0.65 * (s.len / 2.6);
/** Where a fore paw's middle claw reaches to, in the foot's frame. */
const clawTip = (s: Mole): V3 => [0, s.paw * 0.95 + s.claw.len * 0.9, -s.fore[2] + 0.05];

/**
 * Three claw streaks slashed through the air, from up and behind the paw to
 * down and ahead of it: drawn in on `sweep` (nought to one) and gone by `al`.
 * Each is a crescent, thick in its middle and coming to a point at either
 * end, white over a warm glow, the middle one longest. `turn` tips the slash
 * across the screen: one way for one paw, the other for the other.
 */
function streaks(g: CanvasRenderingContext2D, view: View, at: V3, fwd: V3, size: number, sweep: number, al: number, turn: number): void {
  if (al <= 0.01 || sweep <= 0) return;
  const [x, y] = onScreen(view, at), [fx0] = onScreen(view, add(at, fwd));
  // Ahead on the screen: which way the body faces, left or right; seen nose or tail on, the way `turn` says.
  const ahead = Math.abs(fx0 - x) > 0.15 ? Math.sign(fx0 - x) : Math.sign(turn || 1);
  const dx = ahead * 0.55 + turn * 0.25, dy = 1;
  const dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl, px = -uy, py = ux;
  const bend = Math.sign(ahead) || 1;
  g.save();
  for (const pass of [0, 1]) {
    if (pass === 0) g.globalCompositeOperation = 'lighter';
    else g.globalCompositeOperation = 'source-over';
    for (let q = -1; q <= 1; q++) {
      const L = size * (q ? 0.82 : 1), off = q * size * 0.2, th = size * (q ? 0.05 : 0.065) * (pass ? 1 : 2.4);
      const ax = x - ux * L * 0.55 + px * off, ay = y - uy * L * 0.55 + py * off;
      const bx = ax + ux * L * sweep, by = ay + uy * L * sweep;
      const mx = (ax + bx) / 2 + px * L * 0.16 * bend * sweep, my = (ay + by) / 2 + py * L * 0.16 * bend * sweep;
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo(mx + px * th * bend, my + py * th * bend, bx, by);
      g.quadraticCurveTo(mx - px * th * bend, my - py * th * bend, ax, ay);
      g.fillStyle = pass ? css([255, 250, 238], al) : css([255, 170, 110], al * 0.45);
      g.fill();
      // A thin warm rim, so a streak crossing the cream of the face is still seen.
      if (pass) {
        g.lineWidth = size * 0.022;
        g.strokeStyle = css([150, 60, 30], al * 0.9);
        g.stroke();
      }
    }
  }
  g.restore();
}

/**
 * The strike: claw streaks slashed through the air where each blow lands,
 * and crystal sparks thrown off the claws -- one slash for the Ironemole, two
 * crossed for the Ferrodrill's two paws; and for the Oremander's slam, two
 * streaks driven down, a ring of dust going out over the ground, the ground
 * cracked, and rock and crystal thrown up. Sorted in front of the body or
 * behind it, as each thing is.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Mole, b: Bones, hits: Bones[], t: number, front: boolean): void {
  const big = bigness(s), hs = IRON_HITS[s.strike];
  hs.forEach((h, q) => {
    const since = (t - h) * ACT_SECS.strike;
    if (since < -0.05) return;
    const at = hits[q];
    const paws = s.strike === 0 ? ['fr2'] : s.strike === 1 ? [q ? 'fr2' : 'fl2'] : ['fl2', 'fr2'];
    for (const key of paws) {
      const tip = place(at[key], clawTip(s)), mid = place(at[key], [0, 0, 0]);
      const P = scale(add(tip, mid), 0.5);
      const fwd = unit(sub(place(at.body, [0, 1, 0]), at.body.t));
      // The streaks, drawn over everything: they are in the air in front of the paw. Seen from behind, the paw is on the far
      // side of the body and the streaks would be drawn over its crest, so then there are none (the sparks and the flash do).
      const away = dot(fwd, view.T) < -0.35;
      const sb = Math.max(0.9, big);
      if (front && !away && s.strike < 2) {
        const sweep = ramp(since, -0.025, 0.035), al = 1 - ramp(since, 0.08, 0.24);
        streaks(g, view, add(add(P, scale(fwd, 1.5 * sb)), [0, 0, 0.5 * sb]), fwd, (s.strike ? 3.4 : 4.5) * sb, sweep, al, key === 'fl2' ? -1 : 1);
      }
      if (front && !away && s.strike === 2) {
        const sweep = ramp(since, -0.025, 0.035), al = 1 - ramp(since, 0.06, 0.2);
        streaks(g, view, add(add(P, scale(fwd, 1.3 * big)), [0, 0, 1 * big]), fwd, 3.2 * big, sweep, al, key === 'fl2' ? -0.6 : 0.6);
      }
      // Seen from behind, a flash over the shoulder on the striking side as the blow lands: the paw is hidden beyond the body.
      if (front && away && since > -0.02 && since < 0.2) {
        const side = key === 'fl2' ? -1 : 1, top = place(at.body, [side * s.body.w[4] * 0.45, s.len * 0.5, s.body.h[4] + s.crest.tall * 0.35]);
        const [x, y] = onScreen(view, top);
        glint(g, x, y, 1.1 * sb * (1 - since / 0.2), 1 - smooth(since / 0.2));
      }
      // Sparks off the claws: small bright crystal chips flying out and falling, each with a glint.
      if (since > 0 && since < 0.45) {
        const fade = 1 - smooth(since / 0.45), count = 5 + 3 * s.strike;
        for (let c = 0; c < count; c++) {
          const id = c * 7 + q * 31 + (key === 'fl2' ? 13 : 0);
          const th = (c / count) * TAU + jitter(id) * 0.8;
          const v: V3 = [Math.cos(th) * (1.6 + 2 * jitter(id + 1)), 1 + Math.sin(th) * 2 + 1.5 * jitter(id + 2), 2.4 + 2.4 * jitter(id + 3)];
          // What flies the viewer's way is thrown higher, so seen from behind it clears the crest.
          if (dot(v, view.T) > 0) v[2] += 2;
          const p = thrown(tip, scale(v, 0.9 + 0.25 * s.strike), since, 8);
          if (nearSide(p, b.body.t, view) !== front) continue;
          const [x, y] = onScreen(view, p);
          const tone: Tone = c % 3 === 0 ? 'slate' : c % 3 === 1 ? 'copper' : 'peach';
          shard(g, x, y, (0.42 + 0.22 * jitter(id + 4)) * big, id + since * 14, TONE_RGB[tone], fade);
          if (c % 2 === 0) glint(g, x, y, 0.45 * big * fade, fade);
        }
      }
    }
    if (s.strike !== 2 || since < 0) return;
    // The slam: where the paws come down, a crack in the ground, a ring of dust going out, and rock and crystal thrown up.
    const ground = scale(add(place(at.fl2, clawTip(s)), place(at.fr2, clawTip(s))), 0.5);
    ground[2] = 0.02;
    const [gx, gy] = onScreen(view, ground);
    if (!front) {
      const al = 1 - ramp(since, 0.25, 0.42);
      g.save();
      g.strokeStyle = css([56, 40, 34], 0.85 * al);
      g.lineWidth = 0.16 * big;
      g.lineCap = 'round';
      for (let c = 0; c < 8; c++) {
        const th = (c / 8) * TAU + jitter(c + 50) * 0.6, L = (0.9 + 0.8 * jitter(c + 51)) * big * ramp(since, 0, 0.05);
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + Math.cos(th) * L * 0.5 + 0.1 * big, gy + Math.sin(th) * L * 0.28);
        g.lineTo(gx + Math.cos(th) * L, gy + Math.sin(th) * L * 0.52);
        g.stroke();
      }
      g.restore();
      const out = ramp(since, 0, 0.3), rx = big * (1.2 + 2.6 * out);
      g.lineWidth = 0.14 * big * (1 - out);
      g.strokeStyle = css([226, 206, 176], 0.7 * (1 - out));
      g.beginPath();
      g.ellipse(gx, gy, rx, rx * 0.45, 0, 0, TAU);
      g.stroke();
    }
    // The dust over the body only where it is on the viewer's side of it; from behind, under it.
    if (nearSide(ground, b.body.t, view) === front) dust(g, view, ground, big * (1.4 + 3 * ramp(since, 0, 0.35)), 0.5 * (1 - ramp(since, 0.1, 0.42)));
    if (since < 0.5) {
      const fade = 1 - smooth(since / 0.5);
      for (let c = 0; c < 10; c++) {
        const id = 200 + c;
        const th = (c / 10) * TAU + jitter(id) * 0.5;
        const v: V3 = [Math.cos(th) * (2 + 1.5 * jitter(id + 1)), Math.sin(th) * (2 + 1.5 * jitter(id + 2)), 3 + 2.5 * jitter(id + 3)];
        const p = thrown(ground, v, since, 10);
        if (nearSide(p, b.body.t, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        if (c % 3 === 0) shard(g, x, y, 0.5 * big, id + since * 10, COPPER, fade);
        else clod(g, x, y, (0.18 + 0.12 * jitter(id + 4)) * big, id, fade, c % 2 ? EARTH : [104, 100, 104]);
      }
    }
  });
}

/**
 * Digging: under the paws a patch of dug earth with copper and slate showing
 * in it; at each stroke, as the claws bite in, a glint of metal there; and as
 * they come out of the ground, earth and chips of ore flung back under and
 * past the body, tumbling and coming down behind it, with a puff of dust; and
 * once a go a chunk of copper ore tossed back high over its shoulder,
 * glinting as it turns. A go played once throws nothing until its first
 * stroke.
 */
function digSpray(g: CanvasRenderingContext2D, view: View, s: Mole, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), d = digOf(s, t, a.graze);
  // The seam: where the claws go in, ahead of the fore paws.
  const tips = [place(b.fl2, clawTip(s)), place(b.fr2, clawTip(s))];
  const spot: V3 = [0, Math.max(tips[0][1], tips[1][1]) - 0.1 * big, 0.02];
  spot[0] = (tips[0][0] + tips[1][0]) / 2;
  if (!front) {
    const [x, y] = onScreen(view, spot);
    g.fillStyle = css(mix(EARTH, [56, 40, 34], 0.45), 0.75 * d.down);
    g.beginPath();
    g.ellipse(x, y, 2 * big, 0.85 * big, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 5; q++) {
      const ox = (jitter(q + 60) - 0.5) * 2.2 * big, oy = (jitter(q + 61) - 0.5) * 0.7 * big;
      if (q < 3) clod(g, x + ox, y + oy, 0.28 * big, q * 2.1, d.down);
      else shard(g, x + ox, y + oy, 0.55 * big, q, q === 3 ? COPPER : SLATE, d.down);
    }
  }
  const { bite, fling } = DIG_STROKE;
  for (let k = 0; k < s.digs; k++) {
    // The glint as the claws bite into the seam.
    const tb = (k + bite) / s.digs;
    const sinceBite = frac(t - tb) * ACT_SECS.work;
    if (front && (t >= tb || a.graze >= 0.5) && sinceBite < 0.18) {
      const paw = tips[k % 2], [x, y] = onScreen(view, [paw[0], paw[1], 0.15]);
      glint(g, x, y, (0.7 + 0.15 * s.strike) * big * (1 - sinceBite / 0.18), 1 - sinceBite / 0.18);
    }
    const t0 = (k + fling - 0.08) / s.digs;
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.95) continue;
    // Held whole for a third of a second, then gone by six tenths.
    const fade = 1 - smooth((since - 0.35) / 0.25);
    const from: V3 = [tips[k % 2][0], tips[k % 2][1] - 0.4 * big, 0.2];
    const many = 11 + 3 * s.strike, sd = k % 2 ? 1 : -1;
    for (let q = 0; q < many && since < 0.6; q++) {
      const id = q * 5 + k * 23;
      // Thrown back and out past its flank on the digging side, some low and some high, a few a moment after the rest; and
      // some to the other side, so it is seen thrown whichever side of it is turned to the viewer. What comes the viewer's
      // way is thrown higher, to clear the crest seen from behind.
      const late = q % 3 === 2 ? 0.06 : 0;
      if (since < late) continue;
      const side = sd * (q % 3 === 1 ? -0.8 : 1);
      const v: V3 = [side * (3.5 + 2.5 * jitter(id)), -(2.2 + 2.6 * jitter(id + 1)), 5 + 3 * jitter(id + 2)];
      if (dot([side, 0, 0], view.T) > 0) v[2] += 2;
      // Over the Oremander's mountain of a crest it has to go higher still to be seen.
      if (s.strike === 2) v[2] += 3;
      // Thrown from beside the shoulder on the side it goes to, back past the flank, so none of it crosses the face.
      const start = place(b.trunk, [Math.sign(side) * s.body.w[4] * 0.85, s.len * 0.42, 0]);
      const p = thrown([start[0], start[1], 0.3], scale(v, 0.85 + 0.15 * big), since - late);
      if (nearSide(p, b.body.t, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 4 === 3) {
        shard(g, x, y, 0.55 * big, id + since * 12, q % 8 === 3 ? COPPER : SLATE, fade);
        if (q % 8 === 3) glint(g, x, y, 0.55 * big * fade, 0.8 * fade);
      } else clod(g, x, y, (0.35 + 0.25 * jitter(id + 3)) * big * (s.strike === 2 ? 1.3 : 1), id, fade, q % 2 ? LOAM : SOIL, RIM);
    }
    if (front && since < 0.6) {
      dust(g, view, from, (1 + 2.4 * since) * big, 0.45 * fade);
      // And a puff where the earth comes down, out past the haunch on the digging side.
      const lands = place(b.trunk, [sd * s.body.w[2] * 1.5, s.body.y[1], 0]);
      dust(g, view, [lands[0], lands[1], 0.05], (0.9 + 2 * since) * big, 0.4 * hump(since, 0.4, 0.2));
    }
    // Once a go, a chunk of ore tossed back over its shoulder; it comes down behind the haunch, lies there a moment, glinting,
    // and is gone.
    if (k === 0) {
      const p = thrown([from[0], from[1], 0.4], [1.2, -2.4 - 0.4 * big, 3.6], since, 12);
      const lie = 1 - smooth((since - 0.75) / 0.2);
      if (nearSide(p, b.body.t, view) === front) {
        const [x, y] = onScreen(view, p);
        const down = p[2] <= 0.03;
        shard(g, x, y, 0.9 * big, down ? 0.3 : since * 9, COPPER, lie);
        glint(g, x - 0.1 * big, y - 0.1 * big, 0.8 * big * (0.5 + 0.5 * Math.sin(since * 40)), lie);
      }
    }
  }
}

/**
 * Evolving: at the start a burst of crystal shards out of its back, which
 * covers the moment it changes into its new body; then shards shooting up off
 * the crest as its crystals push up out of its back, and a shimmer of metal
 * running along the crest from its shoulders to its rump and back, each
 * crystal's point glinting as it passes, brightest at the turn.
 */
function evolveCrystals(g: CanvasRenderingContext2D, view: View, s: Mole, b: Bones, gems: readonly Gem[], t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.1, 0.28)), grow = 0.5 + 0.5 * ramp(t, 0, 0.05);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 30; q++) {
      const th = (q / 30) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.3, s.body.y[3] + Math.sin(th) * s.len * 0.25, s.body.h[3] * 0.7]);
      const v: V3 = [Math.cos(th) * (2.4 + 2.4 * jitter(q + 3)), Math.sin(th) * (2.4 + 2.4 * jitter(q + 5)), 3 + 3.5 * jitter(q + 7)];
      const p = thrown(from, v, since, 5);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const tone: Tone = q % 3 === 0 ? 'slate' : q % 3 === 1 ? 'copper' : 'peach';
      shard(g, x, y, 1.2 * big * grow, q * 1.3 + since * 8, TONE_RGB[tone], burst);
      if (q % 4 === 0) glint(g, x, y, 0.6 * big * grow, burst);
    }
  }
  // Shards shooting up off the crest, each from a crystal's point, quick and fading as they go.
  const spout = ramp(t, 0.08, 0.16) * (1 - ramp(t, 0.5, 0.62));
  if (spout > 0) {
    for (let q = 0; q < 14; q++) {
      const gm = gems[(q * 7) % gems.length];
      const rise = frac(t * 2.2 + jitter(q + 20));
      const from = place(b.trunk, add(gm.root, scale(gm.dir, gm.len)));
      const p: V3 = [from[0] + (jitter(q + 21) - 0.5) * big, from[1] + (jitter(q + 22) - 0.5) * big, from[2] + rise * 3.2 * big];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const al = spout * Math.sin(rise * Math.PI);
      shard(g, x, y, 0.55 * big, -Math.PI / 2 + (jitter(q + 23) - 0.5) * 0.5, TONE_RGB[gm.tone], al);
    }
  }
  // The shimmer: a wave of light along the crest, there and back, each point glinting as it passes.
  if (!front) return;
  const sweep = ramp(t, 0.22, 0.85);
  if (sweep <= 0 || sweep >= 1) return;
  const pos = 1 - Math.abs(1 - 2 * sweep), C = s.crest;
  for (let q = 0; q < gems.length; q += 2) {
    const gm = gems[q];
    const along = clamp((C.from - gm.root[1]) / (C.from - C.to));
    const near = hump(along, pos, 0.18) * (0.6 + 0.4 * hump(t, 0.5, 0.12));
    if (near <= 0) continue;
    const [x, y] = onScreen(view, place(b.trunk, add(gm.root, scale(gm.dir, gm.len * 0.85))));
    glint(g, x, y, (0.35 + 0.35 * near) * big, near, q % 3 ? [255, 236, 210] : [255, 255, 246]);
  }
}

/** Light: a warm flash at the claws as each blow lands; the slam's flash on the ground; and a copper glow over the crest as it evolves. */
function moleGlow(s: Mole, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act, big = bigness(s);
  if (act?.kind === 'strike') {
    const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
    IRON_HITS[s.strike].forEach((h, q) => {
      const k = hump(act.t, h + 0.02, 0.1);
      if (k <= 0) return;
      const key = s.strike === 1 ? (q ? 'fr2' : 'fl2') : 'fr2';
      out.push({ p: place(b[key], clawTip(s)), r: (0.9 + 0.4 * s.strike) * big, c: [255, 222, 180], a: 0.4 * k });
      if (s.strike === 2) out.push({ p: place(b.fl2, clawTip(s)), r: 1.3 * big, c: [255, 222, 180], a: 0.4 * k });
    });
    return out;
  }
  if (act?.kind === 'evolve') {
    const C = s.crest, out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
    // A flash of copper light over the whole of it as it begins, which covers the moment it changes into its new body.
    const open = 1 - ramp(act.t, 0.02, 0.09);
    if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [255, 176, 112], a: 0.6 * open });
    const k = 0.25 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
    if (k > 0) out.push({ p: place(b.trunk, [0, (C.from + C.to) / 2, s.body.h[3] + C.tall * 0.5]), r: (C.from - C.to) * 0.7, c: [255, 190, 130], a: k });
    return out;
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** Its fur: the variant's coat taken darker than the island's pastels, a dark umber or charcoal under a cream face, but never black. */
const furOf = (c: RGB): RGB => [44 + c[0] * 0.82, 40 + c[1] * 0.82, 40 + c[2] * 0.82];
/** A colour pushed further from its own grey, a fifth again: copper red-orange rather than salmon. */
const richer = (c: RGB): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * 1.25, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, digs and evolves. */
function moleKind(s: Mole): Kind {
  const bones = moleBones(s);
  // Where everything is at the moment each blow lands, for the streaks and sparks to be drawn from.
  const atHits = (a: Anim): Bones[] => IRON_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  const gems = crestGems(s);
  return {
    bones,
    build: (lod) => moleBuild(s, lod),
    // The variant's coat for its fur, darker than most; its markings for the warm crystals, copper or gold or rust, with slate
    // and peach crystals beside them on every variant; and a cream face, claws and belly, and a pink nose.
    palette: (coat, mark) => {
      // The warm crystals the marking's colour, brought a little toward copper and made as rich as it goes.
      const fur = furOf(coat), warm = richer(mix(mark, [214, 112, 64], 0.15));
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [30, 24, 26], 0.32),
        coatLight: mix(fur, [236, 220, 196], 0.28),
        lid: mix(fur, [24, 18, 20], 0.55),
        muzzle: [242, 228, 206],
        belly: [234, 216, 190],
        nose: [232, 148, 156],
        pad: [150, 78, 90],
        inner: [228, 156, 164],
        eye: [34, 26, 32],
        bark: [128, 76, 50],
        // The glossy dark of the Ironemole's eye, a little warm low in it.
        hoof: [84, 56, 50],
        claw: [244, 234, 212],
        hornDark: [204, 186, 158],
        crystal: warm,
        crystalDark: mix(warm, [80, 24, 16], 0.45),
        ember: mix(warm, [255, 210, 170], 0.4),
        stone: [104, 108, 120],
        stoneDark: [66, 70, 82],
        feather: [146, 152, 164],
        shell: [244, 212, 184],
        shellDark: [212, 164, 132],
        petal: [252, 234, 214],
        flame: mix(warm, [255, 220, 180], 0.2),
        spot: [246, 196, 156],
      }, 24);
    },
    shadow: [s.len * 0.8, s.body.w[4] * 1.0],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are copper and pale peach, its crystals' colours, rather than its dark fur's.
    motes: [[226, 112, 58], [252, 206, 160]],
    glow: (b, a) => moleGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHits(a), act.t, front);
      else if (act.kind === 'work') digSpray(g, view, s, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveCrystals(g, view, s, b, gems, act.t, front);
    },
  };
}

export const IRONEMOLE = moleKind(IRONEMOLE_LOOK);
export const FERRODRILL = moleKind(FERRODRILL_LOOK);
export const OREMANDER = moleKind(OREMANDER_LOOK);
