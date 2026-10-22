/**
 * What a kind of rock looks like where it runs through the stone: the
 * contract between the shared drawing (`paint.ts`) and the fifteen looks
 * (`types/<name>.ts`), one file a kind.
 *
 * A look is changed by editing its own file and nothing else. Everything a
 * look decides is in the object it exports; everything that has to agree
 * across kinds -- which way the strata lie, where a band falls, how a strip
 * is laid onto a tile, the zoom steps, the caching -- is `paint.ts`'s, and a
 * look does not reach into it.
 *
 * How a seam is drawn, so the numbers below mean something:
 *
 *   * The ore lies in **bands** along the strata. The strata's direction is
 *     one answer per block of country (`strata` in `paint.ts`), and band `b`
 *     runs along it at `b * pitch` across, give or take `drift`. Every tile
 *     works its bands out from world coordinates, so a band crosses tile joins
 *     unbroken.
 *
 *   * A band is drawn from a **strip**: a picture `length` tiles long and
 *     `2 * half` tiles across, painted once per zoom step by `strip` below and
 *     repeated end to end along the band. Each band takes one of the
 *     `variants` strips and its own start along it, so two bands side by side
 *     do not repeat each other. The strip is laid flat on the ground through
 *     the tile's corners, so it tilts and squashes with the hillside: it is
 *     what is *in* the rock. Only the part of the tile within `half` of the
 *     band's middle is filled, so empty strip costs nothing but a wider band
 *     costs fill.
 *
 *   * **Studs** are upright pictures standing on a band: a nugget catching
 *     the light, a crystal cluster, a glint. They are painted once per zoom
 *     step and stamped at screen scale, not laid flat, so they read as
 *     standing proud of the face. A strip says where its studs are (what
 *     `strip` returns). A stud is drawn whole by the one tile its foot is on,
 *     and only if that foot is inside the tile by `STUD_MARGIN`; keep them
 *     small (`studs.w` well under half a tile) or the tile in front cuts
 *     their lower edge off.
 *
 * Units. In `strip`, one unit is one tile: `x` runs along the band from 0 to
 * `length`, `y` across it from `-half` to `half` with the band's middle at 0.
 * In `studs.draw`, one unit is a tile's edge as it looks flat on the screen
 * (`STUD_UNIT` pixels at zoom one), with the stud's foot at (0, 0) and up the
 * screen negative `y`. Both canvases are already scaled; draw in units.
 *
 * Where things are. `types/<name>.ts` is one kind's look and nothing else
 * imports from it but `index.ts`, which lists them by their place in
 * `ROCK_VARIANTS`. `kit.ts` is the pieces the looks share -- the palette
 * rule, nuggets, gems, prisms, runes, glows, `lode` for the rare four -- and
 * is what keeps fifteen looks one set; a look that wants a piece drawn its own
 * way copies it into its own file rather than changing the kit under the
 * other fourteen. `paint.ts` lays it all on the ground.
 *
 * Cost. A strip is filled once per band per tile per frame whatever is in
 * it, so detail in a strip is free and width is not. A stud is one
 * `drawImage` each; a few a tile is fine, dozens is not. `extra` runs per
 * tile per frame and is where anything that has to move (a glint, a pulse)
 * goes -- it should stay a handful of draws.
 */

export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

/** One stud on a strip: where along it (0..length), where across (-half..half), and which of the look's stud pictures. */
export interface Stud {
  t: number;
  n: number;
  kind: number;
}

/** The upright pictures a look stands on its bands. */
export interface StudSpec {
  /** The picture's box in stud units (see above), and where its foot is as a share of the box. */
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** How many different pictures; `Stud.kind` picks one. */
  kinds: number;
  /** Paint picture `kind` with its foot at (0, 0). `px` is device pixels per unit, for leaving out what would be smaller than a pixel. */
  draw(g: Ctx, kind: number, px: number): void;
  /** Below this zoom they are left out. */
  from?: number;
  /** How far each one's light dips and comes back, nought to one: a twinkle. Costs one alpha change a stud. */
  twinkle?: number;
}

/** What `extra` is handed: the tile, and its ground as a map from the tile's own square to the screen. */
export interface ExtraInfo {
  g: Ctx;
  x: number;
  y: number;
  zoom: number;
  /** Seconds, for anything that moves. */
  now: number;
  /** Where (u, v) in the tile's own square lands on the screen, written into `out`. */
  at(u: number, v: number, out: [number, number]): [number, number];
}

export interface SeamLook {
  /** What the sheet calls it. */
  name: string;
  /**
   * The colour a whole tile of it is washed toward, which is all that says
   * there is ore in a hillside from too far out to draw the bands
   * (`oreWash` in tiles.ts mixes a little of it into the stone).
   */
  wash: RGB;
  /** Tiles between one band and the next, across the strata. */
  pitch: number;
  /** How far a band may sit off its ruled place, in tiles. */
  drift: number;
  /** Half the strip's width, in tiles: everything `strip` paints must lie within it. */
  half: number;
  /** The strip's length along the band, in tiles, before it repeats. */
  length: number;
  /** How many different strips; each band takes one. */
  variants: number;
  /**
   * Paint strip `v` (see the units above). It is repeated end to end, so
   * anything that crosses `x = 0` or `x = length` must be painted at both
   * ends (`wrap` and `periodic` in kit.ts do this). `rand` is seeded by the
   * kind and the variant, so a strip comes out the same every time it is
   * painted. Returns where its studs stand, if it has any.
   */
  strip(g: Ctx, v: number, px: number, rand: () => number): Stud[] | void;
  studs?: StudSpec;
  /** Anything else, per tile per frame, after the bands and studs. */
  extra?(info: ExtraInfo): void;
}
