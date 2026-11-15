/**
 * The day's lava on Volcano Isle, drawn (`game/lava.ts` says where it lies).
 *
 * A tile of lava is laid over its ground as it is drawn: molten orange that
 * brightens and dims in slow, broad waves running across the slope, a vein of
 * yellow heat that runs on from tile to tile and wavers as it flows, a crust
 * of dark slag along every edge where the lava stops, and a few flecks of
 * crust riding on it. After dark the tiles drawn are stamped again over the
 * night (`glowLava`), so the lava burns through it; the light it throws on
 * what is round it is the game's (`lavaLights`).
 *
 * With animations off or less motion nothing moves; without a graphics card
 * (`low`) a tile is one flat fill and its crust, nothing more. Remembered
 * ground, not in sight, is drawn as it was last seen: dull, and still.
 * Everything is a handful of fills and strokes on the tile's own four corners,
 * placed in the world's own terms so a vein meets itself on the next tile
 * whichever way the view is turned: no gradient is made in a frame.
 */

/** Radians a second the waves run at, and how broad they are, across the tiles. */
const FLOW = 0.7;
const WAVE_X = 0.42;
const WAVE_Y = 0.27;
/** The molten tones: the deep and the bright the waves move between, the vein, the crust and its flecks. */
const DEEP: readonly [number, number, number] = [204, 64, 16];
const BRIGHT: readonly [number, number, number] = [255, 146, 38];
const VEIN = 'rgba(255, 226, 120, ';
const CRUST = 'rgba(46, 22, 12, 0.92)';
const FLECK = 'rgba(64, 32, 18, 0.8)';
const MEMORY = 'rgb(112, 46, 22)';
const LOW = 'rgb(232, 98, 28)';
/** The crust's width and the vein's, as shares of a tile's edge on screen. */
const CRUST_W = 0.12;
const VEIN_W = 0.07;

/** 0..1, steady for a tile and a salt. */
const roll = (x: number, y: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const mix = (k: number): string =>
  `rgb(${Math.round(DEEP[0] + (BRIGHT[0] - DEEP[0]) * k)}, ${Math.round(DEEP[1] + (BRIGHT[1] - DEEP[1]) * k)}, ${Math.round(DEEP[2] + (BRIGHT[2] - DEEP[2]) * k)})`;

/** The broad wave at a tile, 0..1. */
const waveAt = (x: number, y: number, t: number): number => 0.5 + 0.5 * Math.sin(x * WAVE_X + y * WAVE_Y - t * FLOW);

/** Where the vein crosses the line between two tiles, as a share down it: the same from either side. */
const veinAt = (x: number, y: number): number => 0.3 + 0.4 * roll(x, y, 7);

/**
 * A point of the tile at (`fx`, `fy`) of the way across and down it in the world, on screen: its four corners `p`,
 * which corner of the world each is (`co`, the view's `corners`).
 */
const at = (p: ArrayLike<number>, co: ReadonlyArray<readonly [number, number]>, fx: number, fy: number, out: [number, number]): [number, number] => {
  let sx = 0, sy = 0;
  for (let k = 0; k < 4; k++) {
    const w = (co[k][0] ? fx : 1 - fx) * (co[k][1] ? fy : 1 - fy);
    sx += w * p[k * 2];
    sy += w * p[k * 2 + 1];
  }
  out[0] = sx;
  out[1] = sy;
  return out;
};
const pt: [number, number] = [0, 0];

/**
 * One tile of lava over its ground: `p` its four corners on screen, `co` the world corner each is, `open` a bit for
 * each edge `k` (from corner `k` to the next) with no lava past it, `t` the drawing clock (held while animations are
 * off), `still` for less motion.
 */
export function drawLava(ctx: CanvasRenderingContext2D, p: ArrayLike<number>, co: ReadonlyArray<readonly [number, number]>, open: number,
  x: number, y: number, t: number, lit: boolean, low: boolean, still: boolean): void {
  const clock = still ? 0 : t;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.lineTo(p[4], p[5]);
  ctx.lineTo(p[6], p[7]);
  ctx.closePath();
  ctx.fillStyle = !lit ? MEMORY : low ? LOW : mix(0.3 + 0.7 * waveAt(x, y, clock));
  ctx.fill();
  // Its own colour round its edge too, to close the hairline smoothing leaves between two tiles of it.
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1;
  ctx.stroke();
  const edge = Math.hypot(p[2] - p[0], p[3] - p[1]);
  if (lit && !low) {
    // The vein of heat, across from the west to the east, wavering at its middle as it flows.
    const a = veinAt(x, y), b = veinAt(x + 1, y);
    const m = (a + b) / 2 + 0.14 * Math.sin(roll(x, y, 13) * 6.28 + clock * 0.8);
    const glow = 0.35 + 0.45 * waveAt(x + 2, y + 1, clock * 1.3);
    ctx.strokeStyle = `${VEIN}${glow.toFixed(3)})`;
    ctx.lineWidth = Math.max(1, edge * VEIN_W);
    ctx.lineCap = 'round';
    ctx.beginPath();
    at(p, co, 0, a, pt);
    ctx.moveTo(pt[0], pt[1]);
    at(p, co, 0.5, m, pt);
    ctx.lineTo(pt[0], pt[1]);
    at(p, co, 1, b, pt);
    ctx.lineTo(pt[0], pt[1]);
    ctx.stroke();
    // Two flecks of crust riding across it.
    ctx.fillStyle = FLECK;
    for (let i = 0; i < 2; i++) {
      const drift = still ? 0 : (t * 0.03 + roll(x, y, 31 + i)) % 1;
      at(p, co, (0.1 + 0.8 * roll(x, y, 11 + i) + drift) % 1, 0.15 + 0.7 * roll(x, y, 21 + i), pt);
      const r = edge * (0.035 + 0.03 * roll(x, y, 41 + i));
      ctx.beginPath();
      ctx.ellipse(pt[0], pt[1], r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (open) {
    // The crust where the lava stops: a band inside the tile along each such edge, so nothing drawn after covers it.
    ctx.fillStyle = CRUST;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      if (!(open & (1 << k))) continue;
      const n = (k + 1) & 3, pk = (k + 3) & 3, nn = (n + 1) & 3;
      ctx.moveTo(p[k * 2], p[k * 2 + 1]);
      ctx.lineTo(p[n * 2], p[n * 2 + 1]);
      ctx.lineTo(p[n * 2] + (p[nn * 2] - p[n * 2]) * CRUST_W, p[n * 2 + 1] + (p[nn * 2 + 1] - p[n * 2 + 1]) * CRUST_W);
      ctx.lineTo(p[k * 2] + (p[pk * 2] - p[k * 2]) * CRUST_W, p[k * 2 + 1] + (p[pk * 2 + 1] - p[k * 2 + 1]) * CRUST_W);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
}

/**
 * The lava drawn this frame, stamped again over the night: ten numbers a tile in `seen` (its four corners on screen,
 * then the tile), `n` of them. It burns through the dark as much as the dark is there.
 */
export function glowLava(ctx: CanvasRenderingContext2D, seen: readonly number[], n: number, dark: number, t: number, still: boolean): void {
  if (n <= 0 || dark <= 0.02) return;
  const clock = still ? 0 : t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    const wave = waveAt(seen[o + 8], seen[o + 9], clock);
    ctx.globalAlpha = dark * (0.38 + 0.22 * wave);
    ctx.fillStyle = mix(0.35 + 0.65 * wave);
    ctx.beginPath();
    ctx.moveTo(seen[o], seen[o + 1]);
    ctx.lineTo(seen[o + 2], seen[o + 3]);
    ctx.lineTo(seen[o + 4], seen[o + 5]);
    ctx.lineTo(seen[o + 6], seen[o + 7]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
