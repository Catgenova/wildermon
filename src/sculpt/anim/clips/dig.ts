/**
 * The digging and field clips: the shovel's stroke (`DIG`), the rake's pull (`RAKE`) and the sickle's cut (`REAP`). The jobs
 * done with each tool play its clip (`../routes.ts` CLIP_OF_TOOL), the tool drawn in a fist (`Clip.tools`), mirrored
 * left-handed from the facings the flat figure works left-handed from (`../index.ts` LEFT_OF).
 *
 * The fists are reached to their places (`Clip.hands`): the tool's hand where the tool's working end is wanted (the shovel
 * blade's tip, the rake's teeth: each body's fist put back up the haft from it by the tool's own reach in that body's
 * heights, her keys `$hand_<side>`), or in the air the same place on both; its haft's way and its face's way
 * (`HandReach.knuckles`) keyed through the stroke; the other hand closed on the haft and slid along it (`Clip.second`);
 * the sickle's other hand reached to the stalks it gathers. The feet planted where the stance stands them, the shovel's
 * right foot keyed up onto the blade's tread and down with it (`Clip.feet`).
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import SHOVEL from '../../assets/shovel.json';
import RAKE_TOOL from '../../assets/rake.json';

/** The base man's height in the game's units (`../../rig.ts` heightOf of the human's proportions), hers 0.85 of his (`../../lowpoly.ts` WOMAN_OF_MAN): a tool's reach in each body's heights. */
const HEIGHT = { man: 16.5, woman: 16.5 * 0.85 };
type Body = keyof typeof HEIGHT;

const unit = (v: Euler): Euler => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: Euler, b: Euler): Euler => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Euler, b: Euler): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * A tool's place at a beat: the point of it that meets the ground (`at`, body heights: across to the left, up, forward, in
 * the frame the feet stand in), or where the fist holding it is (`fist`: in the air, the same place on both bodies); the
 * way its haft runs from the butt toward the working end (`way`) and the way its own x looks (`face`: the shovel blade's
 * back, the rake's teeth's backs; squared to the haft); where along it the other hand holds it (`slide`, game units
 * from the butt); and her fist moved from his where it is the same place (`her`, body heights).
 */
interface ToolAt { at: Euler; way: Euler; face: Euler; fist?: boolean; slide?: number; her?: Euler }
type Tool = { contact: number[]; grip: { lead: number[] } };
/** The fist on a tool at its place, body heights: the tool's point less its reach from the fist (its contact less its lead), turned as it is. */
function fistOf(tool: Tool, p: ToolAt, body: Body): Euler {
  if (p.fist) return p.at;
  const Y = unit(p.way), f = dot(p.face, Y), X = unit([p.face[0] - Y[0] * f, p.face[1] - Y[1] * f, p.face[2] - Y[2] * f]), Z = cross(X, Y), H = HEIGHT[body];
  const d = [tool.contact[0] - tool.grip.lead[0], tool.contact[1] - tool.grip.lead[1], tool.contact[2] - tool.grip.lead[2]];
  return [0, 1, 2].map((i) => p.at[i] - (X[i] * d[0] + Y[i] * d[1] + Z[i] * d[2]) / H) as Euler;
}
/** A beat's tool and how it is reached. */
interface ToolBeat { t: number; tool: ToolAt; ease?: Key<Euler>['ease'] }
/**
 * The tool's hand keyed from the tool's places: his fist, the haft's way and the face's; her fist less his
 * (`$hand_<side>`); and the other hand's place along the haft, as far from the tool's hand in her heights as in his
 * (her own, `$second`, less his).
 */
function handOf(tool: Tool, beats: ToolBeat[]): { at: Array<Key<Euler>>; way: Array<Key<Euler>>; knuckles: Array<Key<Euler>>; hers: Array<Key<Euler>>; slide: Array<Key<Euler>>; herSlide: Array<Key<Euler>> } {
  const k = (b: ToolBeat, v: Euler): Key<Euler> => ({ t: b.t, v, ...(b.ease ? { ease: b.ease } : {}) });
  const lead = tool.grip.lead[1];
  return {
    herSlide: beats.map((b) => k(b, [0, ((b.tool.slide ?? lead) - lead) * (HEIGHT.woman / HEIGHT.man - 1), 0])),
    at: beats.map((b) => k(b, fistOf(tool, b.tool, 'man'))),
    way: beats.map((b) => k(b, unit(b.tool.way))),
    knuckles: beats.map((b) => k(b, unit(b.tool.face))),
    hers: beats.map((b) => { const m = fistOf(tool, b.tool, 'man'), w = fistOf(tool, b.tool, 'woman'), e = b.tool.her ?? [0, 0, 0]; return k(b, [w[0] - m[0] + e[0], w[1] - m[1] + e[1], w[2] - m[2] + e[2]]); }),
    slide: beats.map((b) => k(b, [0, b.tool.slide ?? tool.grip.lead[1], 0])),
  };
}

/** A hand closed round a haft (holding no tool of its own, `Clip.second`). */
const FIST_R: Record<string, Euler> = { fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0] };
const FIST_L: Record<string, Euler> = { fingers_01_l: [70, 0, 0], fingers_02_l: [80, 0, 0] };
/** Feet flat where the stance stands them. */
const FLAT = { z: 0, lift: 0, pitch: 0 };

/* ---- the shovel ----------------------------------------------------------------------------------------------------- */
/**
 * D1, the shovel's stroke: feet apart, the left a little ahead, the blade set in the ground in front of the right foot, the
 * haft leant back toward the body, the left fist on it under the T grip, the right below it. The right foot lifted onto
 * the blade's tread and driven down with it, the weight on it, the body sinking; the foot set back down; the haft pulled
 * back, the blade levered in the ground, the right hand slid down the haft; the knees bent, the load lifted, the body
 * turned right and the blade swung out to the right and turned on its side (the toss); swung back and set in the ground.
 */
const DIG_LENGTH = 2;
/** The blade's line across: in front of the right foot. */
const BX = -0.1;
/** The blade's shoulders (its tread) up the haft from its tip, game units. */
const TREAD = SHOVEL.contact[1] - 8.75;
/** The shovel's places: set, on the tread, driven, levered, lifted, tossed, swung back. */
const SET: ToolAt = { at: [BX, -0.02, 0.32], way: [-0.12, -0.95, 0.28], face: [0, 0.28, 0.95], slide: 2.0 };
const STEP: ToolAt = { ...SET, at: [BX, -0.04, 0.32] };
const DRIVEN: ToolAt = { ...SET, at: [BX, -0.12, 0.33], her: [0, 0.015, 0] };
const LEVERED: ToolAt = { at: [BX, -0.06, 0.42], way: [-0.1, -0.86, 0.5], face: [0, 0.5, 0.86], slide: 2.4 };
const LIFTED: ToolAt = { at: [0.1, 0.45, 0.1], way: [-0.45, -0.3, 0.84], face: [0, -0.94, -0.34], fist: true, slide: 2.6, her: [-0.03, 0, -0.03] };
const TOSSED: ToolAt = { at: [0.06, 0.6, 0.14], way: [-0.85, 0.02, 0.52], face: [0.6, 0.1, 0.8], fist: true, slide: 2.6, her: [-0.03, 0, -0.03] };
const BACK: ToolAt = { at: [BX, 0.06, 0.34], way: [-0.1, -0.92, 0.38], face: [0, 0.38, 0.92], slide: 2.4 };
/** Where the stance stands the right foot's ankle forward, body heights (the tread is reached from there). */
const FOOT_R_Z = -0.03;
/** The right foot on the tread: as high as it is when the blade is where the tool is, its ankle a little behind it. */
const onTread = (p: ToolAt): { z: number; lift: number; pitch: number } => {
  const Y = unit(p.way), H = HEIGHT.man, y = p.at[1] - (Y[1] * TREAD) / H, z = p.at[2] - (Y[2] * TREAD) / H;
  return { z: z - 0.05 - FOOT_R_Z, lift: Math.max(0, y), pitch: 0 };
};

/** The trunk at each key. */
const D_SET: KeyPose = { rot: { pelvis: [10, -10, 0], spine_01: [6, -2, 0], spine_02: [6, -2, 0], spine_03: [4, -1, 0], neck_01: [-4, 0, 0], head: [12, 8, 0], clavicle_r: [0, 0, 6], ...FIST_R }, move: [0, -0.02, 0] };
const D_STEP: KeyPose = merge(D_SET, { rot: { pelvis: [10, -10, -3], spine_01: [6, -2, 2], head: [14, 8, 0] }, move: [0.018, -0.012, 0] });
const D_DRIVE: KeyPose = merge(D_SET, { rot: { pelvis: [16, -6, -2], spine_01: [9, -1, 1], spine_02: [9, -1, 0], spine_03: [7, -1, 0], head: [12, 6, 0], clavicle_r: [0, 0, 12] }, move: [0.006, -0.055, 0.012] });
const D_OFF: KeyPose = merge(D_SET, { rot: { pelvis: [16, -6, 0], spine_01: [9, -1, 0], spine_02: [9, -1, 0], spine_03: [7, -1, 0], clavicle_r: [0, 0, 12] }, move: [0, -0.05, 0.008] });
const D_LEVER: KeyPose = merge(D_SET, { rot: { pelvis: [18, -6, 0], spine_01: [10, -1, 0], spine_02: [10, -1, 0], spine_03: [8, -1, 0], head: [8, 6, 0], clavicle_r: [0, 0, 12] }, move: [0, -0.07, -0.01] });
const D_LIFT: KeyPose = merge(D_SET, { rot: { pelvis: [24, -4, 0], spine_01: [10, -2, 0], spine_02: [10, -2, 0], spine_03: [8, -2, 0], neck_01: [-12, 0, 0], head: [2, 2, 0] }, move: [0, -0.085, 0] });
const D_TOSS: KeyPose = merge(D_SET, { rot: { pelvis: [14, -22, 0], spine_01: [6, -10, 0], spine_02: [5, -10, 0], spine_03: [4, -8, 0], neck_01: [-6, -4, 0], head: [4, -10, 0] }, move: [-0.012, -0.05, 0] });
const D_BACK: KeyPose = merge(D_SET, { rot: { pelvis: [12, -8, 0], spine_01: [7, -3, 0] }, move: [0, -0.03, 0] });

const withFeet = (p: KeyPose, r: { z: number; lift: number; pitch: number }): KeyPose => ({ ...p, feet: { l: FLAT, r } });
const UP_STEP = { z: onTread(STEP).z * 0.6, lift: onTread(STEP).lift + 0.03, pitch: 6 };
export const DIG_BEATS: Beat[] = [
  { t: 0, pose: withFeet(D_SET, FLAT), ease: 'inOut', stage: 'key', name: 'set' },
  { t: 0.16, pose: withFeet(D_STEP, UP_STEP), ease: 'inOut', name: 'foot up' },
  { t: 0.3, pose: withFeet(D_STEP, onTread(STEP)), ease: 'inOut', stage: 'key', name: 'on the tread' },
  { t: 0.62, pose: withFeet(D_DRIVE, onTread(DRIVEN)), ease: 'in', stage: 'key', name: 'driven' },
  { t: 0.84, pose: withFeet(D_OFF, FLAT), ease: 'inOut', name: 'foot down' },
  { t: 1.1, pose: withFeet(D_LEVER, FLAT), ease: 'inOut', stage: 'key', name: 'levered' },
  { t: 1.36, pose: withFeet(D_LIFT, FLAT), ease: 'inOut', stage: 'key', name: 'lifted' },
  { t: 1.6, pose: withFeet(D_TOSS, FLAT), ease: 'out', stage: 'key', name: 'tossed' },
  { t: 1.8, pose: withFeet(D_BACK, FLAT), ease: 'inOut', name: 'swung back' },
];
const DIG_TOOL: ToolBeat[] = [
  { t: 0, tool: SET, ease: 'inOut' }, { t: 0.16, tool: SET, ease: 'inOut' }, { t: 0.3, tool: STEP, ease: 'inOut' }, { t: 0.62, tool: DRIVEN, ease: 'in' }, { t: 0.84, tool: DRIVEN, ease: 'inOut' },
  { t: 1.1, tool: LEVERED, ease: 'inOut' }, { t: 1.36, tool: LIFTED, ease: 'inOut' }, { t: 1.6, tool: TOSSED, ease: 'out' }, { t: 1.8, tool: BACK, ease: 'inOut' },
];
const DIG_KEYS = poseToPose(DIG_BEATS, { length: DIG_LENGTH, loop: true, lag: { head: 0.04, neck_01: 0.02 } });
const DIG_HAND = handOf(SHOVEL, DIG_TOOL);

export const DIG: Clip = {
  name: 'dig',
  loop: true,
  length: DIG_LENGTH,
  mask: 'full',
  // feet apart, the left a little ahead
  plant: { rot: { thigh_l: [6, -3, 7], thigh_r: [-2, 3, -3] } },
  feet: { stride: HEIGHT.man, l: (DIG_KEYS.footKeys as NonNullable<typeof DIG_KEYS.footKeys>).l, r: (DIG_KEYS.footKeys as NonNullable<typeof DIG_KEYS.footKeys>).r },
  tracks: DIG_KEYS.tracks, move: DIG_KEYS.move, poses: DIG_KEYS.poses,
  breath: { count: 1, depth: 0.5 },
  armsFree: true,
  hands: { l: { at: DIG_HAND.at, way: DIG_HAND.way, knuckles: DIG_HAND.knuckles } },
  tools: { l: 'shovel' },
  second: { side: 'r', at: DIG_HAND.slide, way: [0, 1, 0] },
  strike: { side: 'l', t: 0.62 },
  events: [{ t: 0.62, name: 'impact' }],
  // a go fitted to its length by the blade set in the ground and the lever's hold (the drive and the toss keep their speed)
  stretch: [[0, 0.16], [0.84, 1.1]],
  bodies: {
    woman: { tracks: { $hand_l: DIG_HAND.hers, $second: DIG_HAND.herSlide }, feet: { stride: HEIGHT.woman, lift: 1.25 }, add: { thigh_l: [0, 0, -5], thigh_r: [0, 0, 5] } },
  },
};

/* ---- the rake ------------------------------------------------------------------------------------------------------- */
/**
 * R1, the rake's pull: the left foot ahead, the rake's head reached out on the ground, the body leant after it; drawn back
 * toward the feet, the weight going back onto the right foot, the right hand slid up the haft; lifted off the ground and
 * carried out again, set down. The left fist by the haft's butt, the right lower down it; the teeth down into the ground.
 */
const RAKE_LENGTH = 1.6;
/** The teeth's backs: up off the haft (the teeth point down). */
const OUT: ToolAt = { at: [0.0, 0, 0.8], way: [-0.07, -0.66, 0.75], face: [0, 0.75, 0.66], slide: 2.5 };
const DRAWN: ToolAt = { at: [-0.04, 0, 0.55], way: [-0.2, -0.66, 0.72], face: [0, 0.72, 0.66], slide: 1.9 };
const RAISED: ToolAt = { at: [-0.04, 0.07, 0.6], way: [-0.18, -0.62, 0.76], face: [0, 0.76, 0.62], slide: 2.0 };
const CARRIED: ToolAt = { at: [0.0, 0.06, 0.8], way: [-0.07, -0.6, 0.8], face: [0, 0.8, 0.6], slide: 2.7 };
const R_OUT: KeyPose = { rot: { pelvis: [22, 8, 0], spine_01: [9, 3, 0], spine_02: [8, 3, 0], spine_03: [6, 2, 0], neck_01: [-8, 0, 0], head: [6, 6, 0], ...FIST_R }, move: [0, -0.05, 0.03] };
const R_DRAWN: KeyPose = merge(R_OUT, { rot: { pelvis: [12, 2, 0], spine_01: [5, 0, 0], spine_02: [4, 0, 0], spine_03: [3, 0, 0], neck_01: [-2, 0, 0], head: [12, 8, 0] }, move: [-0.004, -0.035, -0.02] });
const R_RAISED: KeyPose = merge(R_DRAWN, { rot: {}, move: [-0.004, -0.032, -0.018] });
const R_CARRIED: KeyPose = merge(R_OUT, { rot: { pelvis: [20, 8, 0] }, move: [0, -0.045, 0.026] });
export const RAKE_BEATS: Beat[] = [
  { t: 0, pose: R_OUT, ease: 'inOut', stage: 'key', name: 'reached out' },
  { t: 0.7, pose: R_DRAWN, ease: 'inOut', stage: 'key', name: 'drawn back' },
  { t: 0.92, pose: R_RAISED, ease: 'out', name: 'lifted' },
  { t: 1.36, pose: R_CARRIED, ease: 'inOut', stage: 'key', name: 'carried out' },
];
const RAKE_TOOLS: ToolBeat[] = [{ t: 0, tool: OUT, ease: 'inOut' }, { t: 0.7, tool: DRAWN, ease: 'inOut' }, { t: 0.92, tool: RAISED, ease: 'out' }, { t: 1.36, tool: CARRIED, ease: 'inOut' }];
const RAKE_KEYS = poseToPose(RAKE_BEATS, { length: RAKE_LENGTH, loop: true, lag: { head: 0.04, neck_01: 0.02 } });
const RAKE_HAND = handOf(RAKE_TOOL, RAKE_TOOLS);

export const RAKE: Clip = {
  name: 'rake',
  loop: true,
  length: RAKE_LENGTH,
  mask: 'full',
  // the left foot ahead, the right back
  plant: { rot: { thigh_l: [12, -3, 6], thigh_r: [-8, 3, -6] } },
  tracks: RAKE_KEYS.tracks, move: RAKE_KEYS.move, poses: RAKE_KEYS.poses,
  breath: { count: 1, depth: 0.5 },
  armsFree: true,
  hands: { l: { at: RAKE_HAND.at, way: RAKE_HAND.way, knuckles: RAKE_HAND.knuckles } },
  tools: { l: 'rake' },
  second: { side: 'r', at: RAKE_HAND.slide, way: [0, 1, 0] },
  strike: { side: 'l', t: 0 },
  // a go fitted to its length by the pull (the lift and the carry keep their speed)
  stretch: [[0, 0.7]],
  bodies: {
    woman: { tracks: { $hand_l: RAKE_HAND.hers, $second: RAKE_HAND.herSlide }, add: { thigh_l: [0, 0, -5], thigh_r: [0, 0, 5] } },
  },
};

/* ---- the sickle ----------------------------------------------------------------------------------------------------- */
/**
 * K1, the sickle's cut: crouched, the knees bent and the trunk bowed over the stalks ahead; the left hand reached out and
 * closed on a bunch of them, the sickle's blade swept under it from the right, at the knees, and drawn back
 * toward the body; the cut bunch lifted and laid aside to the left, the sickle brought back out to the right.
 */
const REAP_LENGTH = 1.6;
/** The stalks gathered: where the left fist closes on them. */
const BUNCH: Euler = [0.05, 0.3, 0.33];
/** The sickle's fist through the cut, body heights up: its blade swept at the knees. */
const R_LOW = 0.24;
/** The sickle's fist (body heights), its handle's way and its blade's way out of the handle (`knuckles`). */
const SICKLE_AT: Record<string, { at: Euler; way: Euler; face: Euler }> = {
  out: { at: [-0.23, 0.3, 0.3], way: [0.2, -0.35, 1], face: [1, 0.15, -0.1] },
  under: { at: [-0.14, R_LOW, 0.36], way: [0.55, -0.45, 0.75], face: [0.85, 0.1, -0.5] },
  cut: { at: [0.0, R_LOW, 0.33], way: [0.85, -0.35, 0.4], face: [0.4, 0.1, -0.9] },
  back: { at: [-0.14, 0.31, 0.24], way: [0.4, -0.2, 0.9], face: [0.9, 0.2, -0.4] },
};
const K_CROUCH: KeyPose = {
  rot: { pelvis: [34, 8, 0], spine_01: [12, 3, 0], spine_02: [10, 3, 0], spine_03: [8, 2, 0], neck_01: [-24, 0, 0], neck_02: [-6, 0, 0], head: [8, 4, 0], fingers_01_l: [20, 0, 0], fingers_02_l: [25, 0, 0] },
  move: [0, -0.17, 0.02],
};
const K_GRAB: KeyPose = merge(K_CROUCH, { rot: { pelvis: [36, 9, 0], spine_02: [11, 4, 0], head: [8, 6, 0], ...FIST_L }, move: [0.006, -0.175, 0.03] });
const K_CUT: KeyPose = merge(K_GRAB, { rot: { pelvis: [36, 10, 0], spine_02: [11, 5, 0], spine_03: [9, 4, 0], head: [8, 2, 0] }, move: [0.004, -0.18, 0.02] });
const K_LAY: KeyPose = merge(K_CROUCH, { rot: { pelvis: [32, 13, 0], spine_02: [9, 6, 0], spine_03: [7, 6, 0], head: [6, 12, 0], ...FIST_L }, move: [0.01, -0.165, 0.01] });
export const REAP_BEATS: Beat[] = [
  { t: 0, pose: K_CROUCH, ease: 'inOut', stage: 'key', name: 'reach' },
  { t: 0.32, pose: K_GRAB, ease: 'inOut', stage: 'key', name: 'gathered' },
  { t: 0.52, pose: K_GRAB, ease: 'in', name: 'sickle under' },
  { t: 0.72, pose: K_CUT, ease: 'out', stage: 'key', name: 'cut' },
  { t: 1.12, pose: K_LAY, ease: 'inOut', stage: 'key', name: 'laid aside' },
];
const REAP_KEYS = poseToPose(REAP_BEATS, { length: REAP_LENGTH, loop: true, lag: { head: 0.04, neck_01: 0.02 } });
const sk = (t: number, k: string, ease: Key<Euler>['ease'] = 'inOut'): { at: Key<Euler>; way: Key<Euler>; face: Key<Euler> } => ({ at: { t, v: SICKLE_AT[k].at, ease }, way: { t, v: unit(SICKLE_AT[k].way), ease }, face: { t, v: unit(SICKLE_AT[k].face), ease } });
const REAP_R = [sk(0, 'out'), sk(0.32, 'out'), sk(0.52, 'under', 'in'), sk(0.72, 'cut', 'out'), sk(1.12, 'back'), sk(1.4, 'out')];
const BUNCH_UP: Euler = [BUNCH[0] + 0.03, BUNCH[1] + 0.08, BUNCH[2] - 0.06];
const LAID: Euler = [0.22, 0.28, 0.22];

export const REAP: Clip = {
  name: 'reap',
  loop: true,
  length: REAP_LENGTH,
  mask: 'full',
  // feet wide, turned out a little
  plant: { rot: { thigh_l: [2, -6, 10], thigh_r: [2, 6, -10] } },
  tracks: REAP_KEYS.tracks, move: REAP_KEYS.move, poses: REAP_KEYS.poses,
  breath: { count: 1, depth: 0.4 },
  armsFree: true,
  hands: {
    r: { at: REAP_R.map((k) => k.at), way: REAP_R.map((k) => k.way), knuckles: REAP_R.map((k) => k.face) },
    l: {
      at: [
        { t: 0, v: [0.1, 0.3, 0.3], ease: 'inOut' }, { t: 0.32, v: BUNCH, ease: 'inOut' }, { t: 0.72, v: BUNCH, ease: 'inOut' },
        { t: 0.86, v: BUNCH_UP, ease: 'out' }, { t: 1.12, v: LAID, ease: 'inOut' }, { t: 1.3, v: LAID, ease: 'inOut' },
      ],
      way: [0, 0.3, 1],
    },
  },
  tools: { r: 'sickle' },
  strike: { side: 'r', t: 0.72 },
  events: [{ t: 0.72, name: 'impact' }],
  // a go fitted to its length by the reach to the next bunch (the cut keeps its speed)
  stretch: [[1.12, REAP_LENGTH]],
  bodies: {
    woman: { add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6], pelvis: [8, 0, 0], spine_02: [4, 0, 0] }, tracks: { $move: [{ t: 0, v: [0, -0.02, 0.02] }] }, hands: { r: [0.03, 0.02, -0.04] } },
  },
};
