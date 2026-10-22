/**
 * The small things every baked picture shares with the trees: the one light,
 * the seeded wobble, the patch of shade a thing stands in, and colour sums
 * done on hex so their results can be fed back into each other.
 *
 * In a module of its own so `../sprites` and the tree painters both read them
 * without importing each other.
 */

export const TAU = Math.PI * 2;

/**
 * Where the light on a baked sprite comes from, in screen space.
 *
 * Over the viewer's left shoulder, and a fixed direction rather than the sun's:
 * a tree is drawn once into its own little canvas and then blitted, so it
 * cannot turn with the day the way the shadow it throws on the ground does.
 * What matters is that everything baked agrees, because a wood lit from two
 * directions is the sort of thing nobody can name and nobody can unsee.
 */
export const LIT = { x: -1, y: -0.78 };

/** Deterministic 0..1 from a seed and an index; for a shape's own wobble. */
export function wob(seed: number, i: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * What a thing standing up puts on the ground right under itself.
 *
 * Not black at any alpha. Black over a colour is that colour with the life
 * taken out of it, and the ground is what this whole look rests on; a cool
 * blue-green laid on thin reads as shade instead of as dirt.
 */
export function contact(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry = rx * 0.34): void {
  // One flat shape at one alpha. Two of them stacked made a soft middle and
  // a soft edge, which is an airbrush, and an airbrush is the one thing a
  // picture made entirely of flat fields cannot have in it.
  ctx.fillStyle = 'rgba(44,74,78,0.17)';
  ctx.beginPath();
  // Thrown away from the light and stretched along the throw, so the ground
  // agrees with the crown about where the sun is.
  ctx.ellipse(x - LIT.x * rx * 0.44, y - LIT.y * ry * 0.5, rx * 1.12, ry * 0.86, -0.5, 0, TAU);
  ctx.fill();
}

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** `a` taken `k` of the way to `b`, both hex. */
export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return hexOf(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

/** A hex colour taken down toward black (`by` below nought) or up toward white, still hex. */
export function tone(hex: string, by: number): string {
  return by < 0 ? mix(hex, '#000000', -by) : mix(hex, '#ffffff', by);
}

/**
 * A colour gone some of the way to dead leaf: `t` of the way, 0 to 1. Below
 * nought it goes the other way, towards pale cut wood, which is what the face
 * of a stump is.
 */
export function dulled(hex: string, t: number): string {
  return t < 0 ? mix(hex, '#e2d6be', -t) : mix(hex, '#8c8a7e', t);
}
