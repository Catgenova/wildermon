/**
 * The settlements' devices, carried on banners and flags: by the old models'
 * cloth (furniture.ts) and the kit's (`kit/banners.ts`) alike.
 */
type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The settlements' devices: six figures a settlement's banners and flags
 * carry, each a closed outline in a square two across, y down. Which one a
 * settlement has is its name's (`deviceOf`), so it is the same for everybody.
 */
export const DEVICES: Array<Array<[number, number]>> = [
  // A fleur-de-lis.
  [[0, -1], [0.22, -0.62], [0.2, -0.22], [0.38, -0.46], [0.66, -0.52], [0.84, -0.3], [0.78, -0.02], [0.5, 0.1], [0.3, 0.12],
    [0.26, 0.26], [0.48, 0.26], [0.48, 0.42], [0.2, 0.42], [0.3, 1], [0, 0.72], [-0.3, 1], [-0.2, 0.42], [-0.48, 0.42], [-0.48, 0.26],
    [-0.26, 0.26], [-0.3, 0.12], [-0.5, 0.1], [-0.78, -0.02], [-0.84, -0.3], [-0.66, -0.52], [-0.38, -0.46], [-0.2, -0.22], [-0.22, -0.62]],
  // A five-pointed star.
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.4 : 0.98;
    return [Math.cos(a) * r, Math.sin(a) * r + 0.06] as [number, number];
  }),
  // A cross.
  [[-0.22, -0.9], [0.22, -0.9], [0.22, -0.28], [0.84, -0.28], [0.84, 0.16], [0.22, 0.16], [0.22, 0.9], [-0.22, 0.9], [-0.22, 0.16], [-0.84, 0.16], [-0.84, -0.28], [-0.22, -0.28]],
  // A crescent.
  [...Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * 0.2 + (i / 12) * Math.PI * 1.6;
    return [Math.cos(a) * 0.9, Math.sin(a) * 0.9] as [number, number];
  }), ...Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * 1.72 - (i / 12) * Math.PI * 1.44;
    return [0.34 + Math.cos(a) * 0.66, Math.sin(a) * 0.66] as [number, number];
  })],
  // A chevron.
  [[-0.9, 0.62], [0, -0.42], [0.9, 0.62], [0.9, 0.98], [0, -0.06], [-0.9, 0.98]],
  // A tree.
  [[0, -0.95], [0.5, -0.3], [0.28, -0.3], [0.7, 0.28], [0.14, 0.28], [0.14, 0.92], [-0.14, 0.92], [-0.14, 0.28], [-0.7, 0.28], [-0.28, -0.3], [-0.5, -0.3]],
];
/** How many devices there are for a settlement to carry. */
export const DEVICE_COUNT = DEVICES.length;
/** Which device a settlement carries on its banners and flags: one of the six, by its name, the same wherever it is drawn. */
export function deviceOf(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return (h >>> 0) % DEVICES.length;
}
/** The device's colour on a cloth: pale gold on anything dark, and the cloth's own dark on anything pale. */
export const deviceInk = (cloth: RGB): RGB => (0.299 * cloth[0] + 0.587 * cloth[1] + 0.114 * cloth[2] < 150 ? hex('#f1d488') : mix(cloth, [52, 40, 60], 0.62));
