/**
 * Sculpted bodies: a person modelled as blended distance fields (`./sdf`,
 * `./models`), baked to a mesh per zoom band (`./bake`), skinned on the
 * figure's rig at the sculpt's own proportions (`./rig`) and drawn by the
 * GPU in the island's ligne claire (`./gl`). This is the door the game would
 * come through: `sculptScene` for a pose, `drawSculpt` to put it down.
 *
 * Nothing in the game imports this yet.
 */
import { DEFAULT_LOOK, type Look } from '../game/look';
import { HEIGHT_SCALE } from '../render/iso';
import { sculptRig, viewOf, type FigurePose, type View } from '../render/figure';
import { bake, bandOf, type Baked } from './bake';
import { drawSculptGL, type DrawOpts, type SculptDraw } from './gl';
import { bodyModel } from './models/body';
import { bonesOf, HAIR_CHAIN, proportionsOf, referenceStance, relaxedIdle, REST_EXTRAS, skinMatrices, type Bones, type Chain, type Extras, type Proportions } from './rig';
import type { Band, Model } from './sdf';

export { SEVEN, FIVE, MALE, FEMALE, NEITHER, proportionsOf, heightOf } from './rig';
export { BOX } from './gl';
export type { DrawOpts, Debug } from './gl';
export type { Band } from './sdf';

interface Built { model: Model; rest: Bones; order: string[]; chains: Chain[]; bakes: Map<Band, Baked> }
const BUILT = new Map<string, Built>();

const lookKey = (l: Look): string => `${l.gender}|${l.skin}|${l.hair}|${l.hairColour}|${l.eyes}|${l.beard}`;

/** What the base body wears: the undershirt and trousers the game shows, or the reference sheet's shorts, for the body alone. */
export type Wear = 'base' | 'shorts';

/** The model for a look at proportions `P`, built once and kept with its bakes. */
export function built(P: Proportions, look: Look, wear: Wear = 'base'): Built {
  const key = `${P.id}|${wear}|${lookKey(look)}`;
  let b = BUILT.get(key);
  if (b) return b;
  const { rest } = sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look });
  const chains = [HAIR_CHAIN(P)];
  const restBones = bonesOf(rest, P, chains, REST_EXTRAS);
  const model = bodyModel(P, restBones, look, wear);
  b = { model, rest: restBones, order: Object.keys(restBones), chains, bakes: new Map() };
  BUILT.set(key, b);
  return b;
}

/** The bake of a built model at a band, made on first use. */
export function bakedAt(b: Built, band: Band): Baked {
  let k = b.bakes.get(band);
  if (!k) { k = bake(b.model, band, b.order); b.bakes.set(band, k); }
  return k;
}

/** What the clock and the pose do to the face. */
export function extrasOf(pose: FigurePose, now: number): Extras {
  const blink = ((now * 0.37 + (pose.id ? pose.id.length * 0.11 : 0)) % 4.1) < 0.12 ? 1 : 0;
  const talking = pose.emote === 'talk';
  return { blink, jaw: talking ? 0.5 + 0.5 * Math.sin(now * 14) : 0, smile: 0.5, brow: pose.emote === 'wave' ? 0.6 : 0 };
}

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

/** A pose as everything a draw needs, at `zoom`, at proportions `P` (the look's own unless said). */
export function sculptScene(pose: FigurePose, zoom: number, P?: Proportions, now = performance.now() / 1000, band = bandOf(zoom), o: { wear?: Wear; stance?: 'ref'; view?: View } = {}): SculptScene {
  const look = pose.look ?? DEFAULT_LOOK;
  P ??= proportionsOf(look);
  const b = built(P, look, o.wear ?? 'base');
  const figure = sculptRig(pose).rig;
  // Stood doing nothing, the sculpt stands its own way (`relaxedIdle`); every other pose is the figure's, as is.
  const idle = !pose.moving && !pose.working && !pose.swimming && !pose.driving && !pose.emote && !pose.cast;
  const rig = o.stance === 'ref' ? referenceStance(figure) : idle ? relaxedIdle(figure, pose.phase / 6, pose.facing) : figure;
  const x = extrasOf(pose, now);
  if (rig.blink) x.blink = 1;
  const posed = bonesOf(rig, P, b.chains, x);
  const facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  return { baked: bakedAt(b, band), bones: skinMatrices(posed, b.rest, b.order), materials: b.model.materials, view: o.view ?? viewOf(facing), facing, band, P, blink: x.blink };
}

/** A body drawn with its feet at (sx, sy): the sculpt by the GPU, or false where there is no GPU to draw it (the caller draws the 2D figure). */
export function drawSculpt(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, o: DrawOpts & { P?: Proportions; band?: Band; now?: number; wear?: Wear; stance?: 'ref'; view?: View } = {}): boolean {
  const scene = sculptScene(pose, zoom, o.P, o.now, o.band, { wear: o.wear, stance: o.stance, view: o.view });
  return drawSculptGL(ctx, sx, sy, zoom, scene, o);
}
