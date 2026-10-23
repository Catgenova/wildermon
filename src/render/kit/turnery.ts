import {
  add, cross, css, hex, mix, mul, prism, sub, TAU, toneOf, unit,
  type Ctx, type Face, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * Builders and tones shared by the beds, the tent, the market stall and the
 * craft stations (`beds.ts`, `stall.ts`, `crafts.ts`): round work turned on
 * any axis (a pole lying down, a roll of cloth, a screw), a spoked wheel, a
 * fielded panel painted on a board, and the kit family's own tones for stone,
 * willow and clay taken from where the kit first laid them.
 */

/* ---- tones from the rest of the kit ------------------------------------------------- */

/** The kiln's cream stone (`KILN_STONE` in forge.ts): a potter's flywheel. */
export const KILN_STONE: Tone = toneOf('#ecd6c0', '#a68f94');
/** The wildermon beds' willow (`WILLOW` in dens.ts): a basket. */
export const WILLOW: Tone = toneOf('#d3a473', '#8c6660');
/** Clay: the kiln's bisque (`POT_STONE` in forge.ts) taken a step deeper and wetter, as it is on the wheel. */
export const WET_CLAY: Tone = { lit: mix(mix(hex('#f3e2cc'), hex('#e8945e'), 0.33), hex('#c98a6e'), 0.45), shade: mix(mix(hex('#b29da0'), hex('#a3685a'), 0.33), hex('#6a5468'), 0.25) };
/** Fired ware, bisque, as the kiln's (`POT_STONE`): a crock, a jar. */
export const BISQUE: Tone = { lit: mix(hex('#f3e2cc'), hex('#e8945e'), 0.33), shade: mix(hex('#b29da0'), hex('#a3685a'), 0.33) };

/* ---- round work on any axis ------------------------------------------------------------ */

/**
 * Turned work lying along any line: from `a` along the unit `d`, `profile`
 * [distance along, radius] from its foot, `sides` round, both ends capped
 * (`lathe` stands upright; this lies any way). A pole, an axle, a roll of
 * cloth, a cop of yarn.
 */
export function spun(a: V3, d0: V3, profile: ReadonlyArray<[number, number]>, sides: number, tone: Tone, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined, turn = 0.5): Face[] {
  const d = unit(d0);
  const u = unit(Math.abs(d[2]) < 0.9 ? cross(d, [0, 0, 1]) : cross(d, [1, 0, 0]));
  const w = cross(d, u);
  const rings = profile.map(([t, r]) => Array.from({ length: sides }, (_, i) => {
    const ang = ((i + turn) / sides) * TAU;
    return add(add(a, mul(d, t)), add(mul(u, Math.cos(ang) * r), mul(w, Math.sin(ang) * r)));
  }));
  const faces = prism(rings, tone, (k, i, s) => ({ crease: 0.18, ...(dress?.(k, i, s) ?? {}) }));
  if (profile[0][1] > 0.01) faces.push({ pts: rings[0].slice().reverse(), n: mul(d, -1), tone, crease: 0.45 });
  return faces;
}

/** A round rod from `a` to `b`, `r` thick, capped both ends: a pole, a rail turned round, an axle. */
export function rod(a: V3, b: V3, r: number, tone: Tone, sides = 8, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined): Face[] {
  const v = sub(b, a);
  return spun(a, v, [[0, r], [Math.hypot(...v), r]], sides, tone, dress);
}

/**
 * A spoked wheel standing upright on an axle along `axis` through `c`: a rim
 * `rim` deep round its middle line at radius `R` and `t` thick, `spokes`
 * turned spokes, and a hub `hubR` round and `hubL` long. All one solid, so the
 * ink runs round its outline and round each gap between the spokes.
 */
export function wheel(c: V3, axis: 'x' | 'y', R: number, rim: number, t: number, spokes: number, tone: Tone, hubR: number, hubL: number, spokeR = 0.22, seg = 18): Face[] {
  const A: V3 = axis === 'x' ? [1, 0, 0] : [0, 1, 0];
  const U: V3 = axis === 'x' ? [0, 1, 0] : [1, 0, 0];
  const Z: V3 = [0, 0, 1];
  const P = (ang: number, r: number, s: number): V3 => add(c, add(add(mul(U, Math.cos(ang) * r), mul(Z, Math.sin(ang) * r)), mul(A, s)));
  const ro = R + rim / 2, ri = R - rim / 2, h = t / 2;
  const faces: Face[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU, am = (a0 + a1) / 2;
    const out = add(mul(U, Math.cos(am)), mul(Z, Math.sin(am)));
    faces.push({ pts: [P(a0, ro, -h), P(a1, ro, -h), P(a1, ro, h), P(a0, ro, h)], n: out, tone, crease: 0.12 });
    faces.push({ pts: [P(a0, ri, h), P(a1, ri, h), P(a1, ri, -h), P(a0, ri, -h)], n: mul(out, -1), tone, crease: 0.12 });
    faces.push({ pts: [P(a0, ri, h), P(a0, ro, h), P(a1, ro, h), P(a1, ri, h)], n: A, tone, crease: 0.08 });
    faces.push({ pts: [P(a0, ri, -h), P(a1, ri, -h), P(a1, ro, -h), P(a0, ro, -h)], n: mul(A, -1), tone, crease: 0.08 });
  }
  for (let j = 0; j < spokes; j++) {
    const ang = ((j + 0.5) / spokes) * TAU;
    faces.push(...rod(P(ang, hubR * 0.7, 0), P(ang, ri + 0.05, 0), spokeR, tone, 6));
  }
  faces.push(...spun(sub(c, mul(A, hubL / 2)), A, [[0, hubR * 0.8], [hubL * 0.15, hubR], [hubL * 0.85, hubR], [hubL, hubR * 0.8]], 8, tone));
  return faces;
}

/* ---- painted on a board ------------------------------------------------------------------ */

/**
 * A fielded panel let into a face, in its frame from (x0, y0) to (x1, y1), `y`
 * up: its field a hair paler, in shade along its head and left where the
 * frame stands over it, caught by the light along its foot and right.
 */
export function fielded(g: Ctx, fill: RGB, x0: number, y0: number, x1: number, y1: number, w = 0.24): void {
  g.fillStyle = css(mix(fill, [255, 248, 234], 0.1), 0.7);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = css(mix(fill, hex('#4a3640'), 0.45), 0.75);
  g.fillRect(x0, y1 - w, x1 - x0, w);
  g.fillRect(x0, y0, w, y1 - y0);
  g.fillStyle = css(mix(fill, [255, 248, 232], 0.45), 0.6);
  g.fillRect(x0, y0, x1 - x0, w * 0.7);
  g.fillRect(x1 - w * 0.7, y0, w * 0.7, y1 - y0);
}

/** A soft line on cloth or wood in a face's frame: a fold, a seam, a stitch row. */
export function stroke(g: Ctx, colour: string, w: number, pts: ReadonlyArray<readonly [number, number]>): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = colour;
  g.lineWidth = w;
  g.stroke();
}
