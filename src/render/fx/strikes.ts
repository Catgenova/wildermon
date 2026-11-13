/**
 * Blows struck: the first action effects, which prove the way from a clip's mark to the screen.
 *
 *   - `sparks`: off a weapon swung in one hand as its blow lands (`../../sculpt/anim/clips/fight.ts`), at its head, in
 *     the weapon's metal (`FxMaterials.metal`: a copper blade's are copper, a steel one's pale steel) about a white-hot
 *     few; a glint where it struck, and gold motes off an enchanted one; a small light for a moment after dark. None
 *     off a weapon that is not metal (a club).
 *   - `chips`: off a pick's head as it bites (`../../sculpt/anim/clips/swing.ts`), in the stone of the tile it struck
 *     (an ore's own colour in a seam), or clods of earth where it is not stone, with a puff of its dust; and two sparks
 *     off the pick's metal on stone.
 */
import { isMetalTone } from '../figure';
import { rgbOf, type P3 } from '../spells/kit';
import { mixHex, shadeHex } from './material';
import type { ActionKit } from './kit';
import type { ActionFxFn } from './registry';
import type { FxEvent } from './types';

/** A number from an effect's params, or the default. */
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** Sparks a blow throws, before its level of detail (`ActionKit.share`). */
export const SPARKS = 9;
/** Chips a pick throws, before its level of detail. */
export const CHIPS = 7;
/** Seconds the glint and the light where a blow struck last. */
const GLINT_SECS = 0.12;
/** The earth a pick turns up off ground that is not stone. */
const EARTH = '#7d5d40';
/** An enchanted blade's golds (its slash trail's, `../../sculpt/gl.ts` TRAIL_RGB). */
const GOLD = ['#ffe7a6', '#ffb347'];

/** The way along the ground a point was going (`FxEvent.way`), or none when it was going straight up or down or was still. */
function heading(e: FxEvent): { x: number; y: number } | undefined {
  const w = e.way;
  if (!w) return undefined;
  const l = Math.hypot(w.x, w.y);
  return l > 1e-6 ? { x: w.x / l, y: w.y / l } : undefined;
}
/** Whether a colour is warm enough that added over the grass it would go lime: laid over instead (`BurstOpts.over`). */
const warm = (hex: string): boolean => { const [r, , b] = rgbOf(hex); return r > b + 30; };

/** One step of the body's facing along the ground, tiles (as `FxScene.facingDir`). */
function facingStep(k: ActionKit, e: FxEvent): { x: number; y: number } {
  const th = Math.PI / 4 - (e.body.facing * Math.PI) / 4, u = Math.cos(th), v = Math.sin(th);
  const x = k.eye.unrotateX(u, v), y = k.eye.unrotateY(u, v), l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

const sparks: ActionFxFn = (e, k) => {
  const piece = k.mat.piece(e.pose, e.held);
  if (piece?.material && !isMetalTone(piece.material)) return;
  const m = k.mat.metal(piece), n = num(e.params.n, SPARKS), head = heading(e);
  // the white-hot few, added; then the metal's own, laid over so it keeps its colour
  k.burst(e.at, Math.ceil(n * 0.35), { kind: 'spark', colour: ['#fffaf0', '#fff1c8'], size: 1.1, life: [0.08, 0.16], speed: [0.25, 0.6], up: [4, 14], gravity: 60, drag: 0.15, heading: head, cone: 2.2, jitter: 0.01, jitterZ: 0.3 });
  k.burst(e.at, n, { kind: 'spark', colour: [m.lit, m.blade, m.metal], size: 1.3, life: [0.14, 0.28], speed: [0.15, 0.5], up: [6, 18], gravity: 80, drag: 0.2, heading: head, cone: 2.6, over: true, jitter: 0.01, jitterZ: 0.3 });
  if (m.enchanted) k.burst(e.at, 4, { kind: 'mote', colour: GOLD, size: 1.5, life: [0.3, 0.55], speed: [0.05, 0.18], up: [3, 8], gravity: 4, drag: 0.5, over: true, small: true });
  const turn = k.rand() * Math.PI, light = m.enchanted ? GOLD[1] : m.lit, over = warm(light);
  return {
    secs: GLINT_SECS,
    draw: (kk, u) => {
      kk.flare(e.at, 4.5 * (1 - 0.4 * u), (1 - u) * 0.9, '#ffffff', turn, light, over);
      if (kk.night > 0.2) kk.light(e.at, 0.7, 0.4 * (1 - u) * kk.night, m.enchanted ? GOLD[1] : '#fff1d6');
    },
  };
};

const chips: ActionFxFn = (e, k) => {
  // (a two-handed weapon's blow is the same swing: its effect is a later one's)
  if (e.pose?.job === 'attack_creature') return;
  // the stone it bit: under the head, or half a tile on where the body faces (the face it is working)
  const f = facingStep(k, e), at: P3 = e.at;
  let g = k.mat.ground(at.x, at.y);
  if (!g.stony) { const on = k.mat.ground(at.x + f.x * 0.5, at.y + f.y * 0.5); if (on.stony) g = on; }
  const base = g.stony ? g.colour : mixHex(EARTH, g.colour, 0.25);
  const n = num(e.params.n, CHIPS);
  k.burst(at, n, {
    kind: 'shard', colour: [base, shadeHex(base, 0.78), shadeHex(base, 1.18)], size: 1.2, sizeEnd: 0.9, life: [0.3, 0.45], speed: [0.12, 0.4], up: [8, 18],
    gravity: 75, drag: 0.4, spin: 2.5, jitter: 0.03, jitterZ: 0.2, bias: 2,
  });
  k.burst(at, 3, { kind: 'dust', colour: g.dust, size: 2.2, sizeEnd: 6, life: [0.45, 0.7], speed: [0.05, 0.15], up: [2, 5], gravity: -3, drag: 0.3, small: true });
  if (g.stony) {
    const m = k.mat.metal(k.mat.piece(e.pose, e.held));
    k.burst(at, 2, { kind: 'spark', colour: [m.lit, '#fff1c8'], size: 1.1, life: [0.08, 0.18], speed: [0.2, 0.5], up: [6, 14], gravity: 70, drag: 0.2, over: true, small: true });
  }
};

export const STRIKE_FX: Readonly<Record<string, ActionFxFn>> = { sparks, chips };
