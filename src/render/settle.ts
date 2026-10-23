/**
 * How many dear pictures may still be made this frame for the zoom alone:
 * none until the zoom has held still for `ZOOM_SETTLE` (in the renderer), and
 * one a frame after that. Set by the renderer once a frame.
 *
 * A piece baked at a few sizes (a settlement's token, a kiln, a smelter, an
 * anvil) is made again where the zoom crosses from one to the next, at a
 * tenth of a second or more for the token, in the frame it crosses: on a wheel
 * through a settlement, a frame of that for every kind of piece in it at
 * every step. While the zoom moves the bake it last had stands in, drawn at
 * the size wanted; once it has settled, `left` of them are made a frame.
 */
export const zoomHeld = { left: Infinity };

/** Bakes of a piece at a size kept by the size, with the last made of each piece less its size to stand in for it. */
export function standIn<B>(kept: ReadonlyMap<string, B>, last: Map<string, string>, piece: string, key: string): B | undefined {
  const was = last.get(piece);
  last.set(piece, key);
  if (was === undefined || was === key) return undefined;
  const other = kept.get(was);
  if (!other) return undefined;
  if (zoomHeld.left > 0) {
    zoomHeld.left--;
    return undefined;
  }
  last.set(piece, was);
  return other;
}
