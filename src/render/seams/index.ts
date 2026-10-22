import { ROCK_VARIANTS } from '../../world/tiles';
import { paintSeam } from './paint';
import type { RGB, SeamLook } from './types';
import { slate } from './types/slate';
import { marble } from './types/marble';
import { sandstone } from './types/sandstone';
import { copper } from './types/copper';
import { coal } from './types/coal';
import { tin } from './types/tin';
import { zinc } from './types/zinc';
import { lead } from './types/lead';
import { silver } from './types/silver';
import { gold } from './types/gold';
import { adamantine } from './types/adamantine';
import { glimmersteel } from './types/glimmersteel';
import { mithril } from './types/mithril';
import { seryll } from './types/seryll';
import { iron } from './types/iron';

export { SEAM_FROM, forgetSeams } from './paint';
export type { SeamLook } from './types';

/**
 * Each kind of rock's look, by its place in `ROCK_VARIANTS` -- which is
 * storage and never reordered, so neither is this. Plain rock has none: it is
 * drawn as the stone it is.
 */
export const SEAM_LOOKS: ReadonlyArray<SeamLook | null> = [
  null, slate, marble, sandstone, copper, coal, tin, zinc, lead, silver, gold, adamantine, glimmersteel, mithril, seryll, iron,
];

/** The colour a whole tile of kind `kind` is washed toward (`oreWash`): its look's, or the table's for plain rock. */
export function seamWash(kind: number): readonly number[] {
  const look = SEAM_LOOKS[kind];
  return look ? (look.wash as RGB) : ROCK_VARIANTS[kind]?.color ?? ROCK_VARIANTS[0].color;
}

/**
 * The seam on one tile of rock of kind `kind`, over the stone already drawn
 * there: see `paint.ts`. `pts` is the tile's four screen corners, `rot` which
 * of them is its own (0, 0), and `dpr` the screen's pixels per canvas pixel,
 * which the pictures are painted at. Plain rock draws nothing.
 */
export function seam(g: CanvasRenderingContext2D, x: number, y: number, kind: number, pts: ArrayLike<number>, rot: number, zoom: number, dpr: number): void {
  const look = SEAM_LOOKS[kind];
  if (look) paintSeam(g, kind, look, x, y, pts, rot, zoom, dpr);
}
