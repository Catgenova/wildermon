/**
 * Sculpted bodies: a person as the human base (`./human`, MakeHuman's mesh
 * on our rig, a man and a woman blended by the look), or as blended distance
 * fields (`./sdf`, `./models`) baked to a mesh per zoom band (`./bake`) --
 * the stamp and print library -- skinned on the figure's rig at the body's
 * own proportions (`./rig`) and drawn by the GPU in the island's ligne claire
 * (`./gl`). This is the door the game would come through: `sculptScene` for a
 * pose, `drawSculpt` to put it down.
 *
 * Nothing in the game imports this yet.
 */
import { DEFAULT_LOOK, type Look } from '../game/look';
import { HEIGHT_SCALE } from '../render/iso';
import { sculptRig, viewOf, type FigurePose, type HandShape, type View } from '../render/figure';
import { bake, bandOf, type Baked } from './bake';
import { drawSculptGL, type DrawOpts, type SculptDraw } from './gl';
import { clothe, GARMENT_FILE, garmentChains } from './cloth';
import { femOf, HUMAN_HEIGHT, humanBaked, humanProportions } from './human';
import { bodyMaterials, bodyModel } from './models/body';
import { bonesOf, HAIR_CHAIN, referenceStance, relaxedIdle, REST_EXTRAS, skinMatrices, straightStance, type Bones, type Chain, type Extras, type Proportions } from './rig';
import type { Band, Material, Model } from './sdf';

export { SEVEN, FIVE, MALE, FEMALE, NEITHER, heightOf } from './rig';
export { femOf, humanProportions } from './human';
export { BOX } from './gl';
export type { DrawOpts, Debug } from './gl';
export type { Band } from './sdf';

/** What the body is made of: the human base, or the distance-field body. */
export type Kind = 'human' | 'sdf';
/**
 * What the base body wears: the undershirt and trousers the game shows (cloth lofted over the body, `./cloth`), the same
 * with the print library's demonstrations on them, or the reference sheet's shorts (a top too on a woman), for the body alone.
 */
export type Wear = 'base' | 'shorts' | 'prints';

export interface Built { kind: Kind; fem: number; wear: Wear; bald: boolean; model: Model | null; materials: Material[]; rest: Bones; order: string[]; chains: Chain[]; bakes: Map<Band, Baked> }
const BUILT = new Map<string, Built>();

const lookKey = (l: Look): string => `${l.gender}|${l.skin}|${l.hair}|${l.hairColour}|${l.eyes}|${l.beard}`;

/** The proportions a look stands at: the base's man, woman, or halfway between. */
export const proportionsOf = (look: Look): Proportions => humanProportions(femOf(look));

/** The body for a look at proportions `P`, built once and kept with its bakes. */
export function built(P: Proportions, look: Look, wear: Wear = 'base', kind: Kind = 'human'): Built {
  const key = `${kind}|${P.id}|${wear}|${lookKey(look)}`;
  let b = BUILT.get(key);
  if (b) return b;
  const { rest } = sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look });
  // The hair's chain, then the garments' sway chains, which hang where the rig at rest puts their hems.
  const chains = [HAIR_CHAIN(P)];
  if (kind === 'human' && wear !== 'shorts') chains.push(...garmentChains(GARMENT_FILE.garments, bonesOf(rest, P, chains, REST_EXTRAS), HUMAN_HEIGHT));
  const restBones = bonesOf(rest, P, chains, REST_EXTRAS);
  const model = kind === 'sdf' ? bodyModel(P, restBones, look, wear === 'shorts' ? 'shorts' : 'base') : null;
  b = { kind, fem: femOf(look), wear, bald: look.hair === 'bald', model, materials: model ? model.materials : bodyMaterials(look), rest: restBones, order: Object.keys(restBones), chains, bakes: new Map() };
  BUILT.set(key, b);
  return b;
}

/** A built body let go, with its bakes: the next ask builds it again. */
export function forgetBuilt(b: Built): void {
  for (const [k, v] of BUILT) if (v === b) BUILT.delete(k);
  b.bakes.clear();
}

/** The bake of a built body at a band, made on first use. */
export function bakedAt(b: Built, band: Band): Baked {
  let k = b.bakes.get(band);
  if (!k) {
    k = b.model ? bake(b.model, band, b.order) : humanBaked(b.fem, band, b.rest, b.order, b.wear, b.bald);
    if (!b.model && b.wear !== 'shorts') k = clothe(k, GARMENT_FILE.garments, b.rest, b.order, HUMAN_HEIGHT, b.wear === 'prints' ? GARMENT_FILE.demo : undefined);
    b.bakes.set(band, k);
  }
  return k;
}

/** What the clock and the pose do to the face. */
export function extrasOf(pose: FigurePose, now: number): Extras {
  const blink = ((now * 0.37 + (pose.id ? pose.id.length * 0.11 : 0)) % 4.1) < 0.12 ? 1 : 0;
  const talking = pose.emote === 'talk';
  return { blink, jaw: talking ? 0.5 + 0.5 * Math.sin(now * 14) : 0, smile: 0.5, brow: pose.emote === 'wave' ? 0.6 : 0 };
}

/** The head's pitch up at rest on the island, degrees: its view looks down thirty degrees, and the face is read better lifted a little to it. */
export const HEAD_PITCH = 6;

export interface SculptScene extends SculptDraw { facing: number; band: Band; P: Proportions }

/**
 * A level view of the body turned `turn` radians to screen right from facing the viewer, at the island's height scale both
 * ways: the body as it is, for the sheets that hold it against a picture. The island's own view (`viewOf`) looks down at it
 * from thirty degrees and draws heights a third taller than widths.
 */
export function levelView(turn: number): View {
  const th = Math.PI / 4 - turn;
  const R = [-Math.sin(th), Math.cos(th)], F = [Math.cos(th), Math.sin(th)];
  const k = HEIGHT_SCALE / Math.SQRT2;
  const T = [R[0] + R[1], F[0] + F[1], 0], tl = Math.hypot(T[0], T[1]) || 1;
  const lu = -0.55 / Math.SQRT2 + 0.38 / Math.SQRT2, lv = 0.55 / Math.SQRT2 + 0.38 / Math.SQRT2;
  const L = [lu * R[0] + lv * R[1], lu * F[0] + lv * F[1], 0.78], ll = Math.hypot(L[0], L[1], L[2]);
  return { ex: [(R[0] - R[1]) * k, 0], ey: [(F[0] - F[1]) * k, 0], T: [T[0] / tl, T[1] / tl, 0], L: [L[0] / ll, L[1] / ll, L[2] / ll], H: [T[0] / tl, T[1] / tl] };
}

export interface SceneOpts { wear?: Wear; stance?: 'ref' | 'straight'; view?: View; kind?: Kind; /** The bake to draw from, made already, instead of one made now. */ bake?: Baked; /** A hand shape laid on both hands, for the sheets. */ hands?: HandShape; /** The head's pitch up on the island, in place of `HEAD_PITCH`, for the sheets. */ pitch?: number; /** The hands turned about the forearm, degrees (the left the other way), for a sheet that looks at a hand's back. */ handTwist?: number }

/** A pose as everything a draw needs, at `zoom`, at proportions `P` (the look's own unless said). */
export function sculptScene(pose: FigurePose, zoom: number, P?: Proportions, now = performance.now() / 1000, band = bandOf(zoom), o: SceneOpts = {}): SculptScene {
  const look = pose.look ?? DEFAULT_LOOK;
  P ??= proportionsOf(look);
  const b = built(P, look, o.wear ?? 'base', o.kind ?? 'human');
  const figure = sculptRig(pose).rig;
  // Stood doing nothing, the sculpt stands its own way (`relaxedIdle`); every other pose is the figure's, as is.
  const idle = !pose.moving && !pose.working && !pose.swimming && !pose.driving && !pose.emote && !pose.cast;
  const rig = o.stance === 'ref' ? referenceStance(figure) : o.stance === 'straight' ? straightStance(figure) : idle ? relaxedIdle(figure, pose.phase / 6, pose.facing) : figure;
  // Talking: the head nods and tilts a little (the sculpt has no mouth to move).
  if (pose.emote === 'talk') rig.head = [rig.head[0] + 5 * Math.sin(now * 7), rig.head[1] + 2 * Math.sin(now * 3.1), rig.head[2] + 3 * Math.sin(now * 2.3)];
  if (o.hands) rig.shape = [o.hands, o.hands];
  if (o.handTwist) rig.hand = [[rig.hand[0][0], rig.hand[0][1], rig.hand[0][2] - o.handTwist], [rig.hand[1][0], rig.hand[1][1], rig.hand[1][2] + o.handTwist]];
  if (!o.stance && !pose.swimming) rig.head = [rig.head[0] + (o.pitch ?? HEAD_PITCH), rig.head[1], rig.head[2]];
  const x = extrasOf(pose, now);
  if (rig.blink) x.blink = 1;
  const posed = bonesOf(rig, P, b.chains, x);
  const facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  return { baked: o.bake ?? bakedAt(b, band), bones: skinMatrices(posed, b.rest, b.order), materials: b.materials, view: o.view ?? viewOf(facing), facing, band, P, blink: x.blink };
}

/** A body drawn with its feet at (sx, sy): the sculpt by the GPU, or false where there is no GPU to draw it (the caller draws the 2D figure). */
export function drawSculpt(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, o: DrawOpts & SceneOpts & { P?: Proportions; band?: Band; now?: number } = {}): boolean {
  const scene = sculptScene(pose, zoom, o.P, o.now, o.band, { wear: o.wear, stance: o.stance, view: o.view, kind: o.kind, hands: o.hands, pitch: o.pitch, handTwist: o.handTwist });
  return drawSculptGL(ctx, sx, sy, zoom, scene, o);
}
