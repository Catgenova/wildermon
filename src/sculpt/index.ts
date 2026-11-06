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
import { sculptRig, viewOf, type FigurePose } from '../render/figure';
import { bake, bandOf, type Baked } from './bake';
import { drawSculptGL, type DrawOpts, type SculptDraw } from './gl';
import { bodyModel } from './models/body';
import { bonesOf, HAIR_CHAIN, REST_EXTRAS, SEVEN, skinMatrices, type Bones, type Chain, type Extras, type Proportions } from './rig';
import type { Band, Model } from './sdf';

export { SEVEN, FIVE } from './rig';
export { BOX } from './gl';
export type { DrawOpts, Debug } from './gl';
export type { Band } from './sdf';

interface Built { model: Model; rest: Bones; order: string[]; chains: Chain[]; bakes: Map<Band, Baked> }
const BUILT = new Map<string, Built>();

const lookKey = (l: Look): string => `${l.gender}|${l.skin}|${l.hair}|${l.hairColour}|${l.eyes}|${l.beard}`;

/** The model for a look at proportions `P`, built once and kept with its bakes. */
export function built(P: Proportions, look: Look): Built {
  const key = `${P.id}|${lookKey(look)}`;
  let b = BUILT.get(key);
  if (b) return b;
  const { rest } = sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look });
  const chains = [HAIR_CHAIN(P)];
  const restBones = bonesOf(rest, P, chains, REST_EXTRAS);
  const model = bodyModel(P, restBones, look);
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

/** A pose as everything a draw needs, at `zoom`, at proportions `P` (the reference's seven heads unless said). */
export function sculptScene(pose: FigurePose, zoom: number, P: Proportions = SEVEN, now = performance.now() / 1000, band = bandOf(zoom)): SculptScene {
  const look = pose.look ?? DEFAULT_LOOK;
  const b = built(P, look);
  const { rig } = sculptRig(pose);
  const x = extrasOf(pose, now);
  if (rig.blink) x.blink = 1;
  const posed = bonesOf(rig, P, b.chains, x);
  const facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  return { baked: bakedAt(b, band), bones: skinMatrices(posed, b.rest, b.order), materials: b.model.materials, view: viewOf(facing), facing, band, P };
}

/** A body drawn with its feet at (sx, sy): the sculpt by the GPU, or false where there is no GPU to draw it (the caller draws the 2D figure). */
export function drawSculpt(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, o: DrawOpts & { P?: Proportions; band?: Band; now?: number } = {}): boolean {
  const scene = sculptScene(pose, zoom, o.P ?? SEVEN, o.now, o.band);
  return drawSculptGL(ctx, sx, sy, zoom, scene, o);
}
