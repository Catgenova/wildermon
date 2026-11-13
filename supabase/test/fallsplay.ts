/**
 * The water drawn into a pond's lip runs out past the ends of its sill only
 * where the pond does.
 *
 * Reported: "water can appear clipped over terrain as in my cliff next to the
 * waterfall ... it looks like this might specifically be from the waterfall".
 * A pond going over one corner of a cliff edge, the edge either side of the
 * lip a little lower than the pond's surface: the water drawn into the lip
 * (`drawLip`) was carried two tiles out along the edge both ways, over dry
 * rim, because the ground there was no higher than the surface
 * (`splayOf`). That ground is past the lip, never under the pond. How far
 * the water runs out past each end is held here against where the pond's
 * shore actually crosses the tile behind it, on the ground the rules settle.
 *
 * Reported again: "water still clipping, i think it particularly doesn't like
 * that i have the cliff edge raised up". A pond behind a cliff edge raised
 * above its surface, going over the one notch in it: the water drawn into
 * the lip, two tiles out along the edge either side, was laid once, after
 * the tiles round the lip, over the raised rim in front of the pond and its
 * moss, and past the shore beside the notch. It is laid now with the pond's
 * own water, tile by tile and only over that water (`SpringWater.tongue`),
 * and the lip lays only its mouth. Held here, on that ground and the two
 * above, as the renderer lays it out: every piece of it on its own tile and
 * on the pond's water there; the mouth no further back than `MOUTH_BACK`,
 * narrowing into the pond's water at each end; and the pond's water nowhere
 * over ground higher than its surface.
 */
import { Game } from '../../src/game/game';
import { Camera } from '../../src/engine/camera';
import { MOUTH_BACK, mouthBack, mouthOf, tongueOutline } from '../../src/render/falls';
import { pondWaterOn, splayOf, SpringWater } from '../../src/render/ponds';
import { VIEWS } from '../../src/render/view';
import type { PondWater } from '../../src/world/springs';

let bad = 0;
const say = (ok: boolean, line: string): void => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
};

const SIZE = 24;

/** A pond's water settled from ground `height`, a spring dug at `sx`, `sy`. */
function pondOn(height: (x: number, y: number) => number, sx: number, sy: number): { game: Game; pond: PondWater } {
  const game = Game.create(4242, SIZE);
  const w = game.world;
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, height(x, y));
  game.springs.lay();
  game.springs.dig(sx, sy, null, Date.now() - 3600 * 1000);
  game.update(0.01);
  const pond = w.water?.pondsAt(sx, sy)[0];
  if (!pond) throw new Error(`no pond at ${sx}, ${sy}`);
  return { game, pond };
}

/** How far the water drawn into the lip runs out past each end of a sill of one corner, the lip's own, as `fall` in `ponds.ts` asks. */
function splays(game: Game, pond: PondWater): [number, number] {
  const [ax, ay] = pond.lip;
  const dx = pond.over[0] - ax;
  const dy = pond.over[1] - ay;
  const ex = dx !== 0 ? 0 : 1;
  const ey = dx !== 0 ? 1 : 0;
  const c = dx !== 0 ? ay : ax;
  return [
    splayOf(game.world, pond, c, ax, ay, ex, ey, dx, dy, -1),
    splayOf(game.world, pond, c, ax, ay, ex, ey, dx, dy, 1),
  ];
}

/*
 * The edge: a hollow at 106 in a plateau at 120, narrowing to one corner at
 * its front; that corner's lip at 112 on a cliff edge, the edge either side
 * at 110, and a drop to 40 in front. The pond stands at 112 and goes over
 * the one corner; the edge beside it is lower than that and dry.
 */
{
  const { game, pond } = pondOn((x, y) => {
    if (y >= 9) return 40;
    if (x >= 6 && x <= 9 && y >= 4 && y <= 6) return x === 7 && y === 5 ? 100 : 106;
    if (x === 8 && y === 7) return 106;
    if (y === 8) return x === 8 ? 112 : 110;
    return 120;
  }, 7, 5);
  say(pond.level === 112 && pond.lip[0] === 8 && pond.lip[1] === 8 && pond.over[0] === 8 && pond.over[1] === 9,
    `a pond on a cliff edge stands at 112 and goes over the corner at (8, 8): ${pond.level}, lip ${pond.lip}, over ${pond.over}`);
  const cw = SIZE + 1;
  say(!pond.wet.has(8 * cw + 7) && !pond.wet.has(8 * cw + 9), 'the edge either side of its lip, at 110, is not under it');
  // The shore crosses the back of the tile past each end where the ground there comes up to 112: 6 of the 14 from 106 to 120.
  const shore = 6 / 14;
  const [lo, hi] = splays(game, pond);
  say(Math.abs(lo - shore) < 1e-9 && Math.abs(hi - shore) < 1e-9,
    `the water drawn into its lip runs out past each end as far as its shore does, ${shore.toFixed(3)} of a tile for each tile back, not over the edge: ${lo.toFixed(3)}, ${hi.toFixed(3)}`);
}

/*
 * On along the lip: the same lip, the pond's water reaching along the edge
 * past one end of it (at 108, with a wall at 120 in front) and the rim at
 * 120 past the other.
 */
{
  const { game, pond } = pondOn((x, y) => {
    if (y >= 9) return x === 8 ? 40 : 120;
    if (x >= 6 && x <= 9 && y >= 4 && y <= 7) return x === 7 && y === 5 ? 100 : 106;
    if (y === 8) return x === 8 ? 112 : x === 7 ? 108 : 120;
    return 120;
  }, 7, 5);
  const [lo, hi] = splays(game, pond);
  say(pond.level === 112 && pond.lip[0] === 8 && pond.lip[1] === 8, `a pond with water beside its lip stands at 112 and goes over (8, 8): ${pond.level}, lip ${pond.lip}`);
  say(lo === 2, `where its water runs on along the lip past the end, the water drawn in runs out as far as it is drawn in at all: ${lo}`);
  // Past the other end the rim at 120 rises out of water at 106 behind it: the shore crosses that side 8/14 of a tile back, so 14/8 out for each tile back.
  say(Math.abs(hi - 14 / 8) < 1e-9, `where the rim comes up past the other end, as far as the shore runs out across the side: ${hi.toFixed(3)}`);
}

/** Twice the signed area of a polygon of x, y pairs. */
function area2(p: ArrayLike<number>, n: number): number {
  let a = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a;
}

/** Whether a point is in a convex polygon, or within `eps` of it. */
function inside(p: ArrayLike<number>, n: number, x: number, y: number, eps = 1e-6): boolean {
  const way = area2(p, n) >= 0 ? 1 : -1;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const ex = p[j] - p[i];
    const ey = p[j + 1] - p[i + 1];
    const l = Math.hypot(ex, ey) || 1;
    if ((way * (ex * (y - p[i + 1]) - ey * (x - p[i]))) / l < -eps) return false;
  }
  return true;
}

/**
 * The water drawn into the lip of the fall out of `pond`, as the renderer
 * lays it out (`SpringWater.frame`, from the top of the view): the pieces of
 * it each tile lays with its own water (`tongueOn`), and the mouth the lip
 * lays. Checked, and how much of the whole of it the pieces leave off, which
 * is what lay over dry ground before.
 */
function tongueOf(game: Game, pond: PondWater, label: string): void {
  const w = game.world;
  const cw = w.w + 1;
  const level = pond.level;
  const cam = new Camera();
  cam.setViewport(900, 640);
  cam.focus(pond.lip[0], pond.lip[1], level, null);
  const V = VIEWS[0];
  const sw = new SpringWater();
  sw.frame({
    world: w, cam, view: V, now: Date.now(), t: 20, width: 900, height: 640, dLo: 0, dHi: 2 * SIZE,
    lean: { x: 0, y: 0, force: 0 }, sun: [0.3, 0.3, 0.9], dark: 0, wellAt: () => null,
  }, w.water!);
  const cs = V.corners;
  const water = new Float64Array(16);
  const piece: number[] = [];
  const c = [0, 0, 0, 0];
  let pieces = 0;
  let laid = 0;
  let offTile = 0;
  let offWater = 0;
  let falls = -1;
  // The pond's water on a tile, as `WaterPainter.drawPonds` lays it.
  const waterOn = (x: number, y: number): number => {
    let mask = 0;
    for (let i = 0; i < 4; i++) {
      c[i] = w.getHeight(x + cs[i][0], y + cs[i][1]);
      if (c[i] < level && pond.wet.has((y + cs[i][1]) * cw + x + cs[i][0])) mask |= 1 << i;
    }
    return mask ? pondWaterOn(x, y, c, mask, level, cs, water) : 0;
  };
  let over = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = waterOn(x, y);
      if (n < 6) continue;
      // Every point of the pond's water on the ground no higher than its surface, as the ground runs along the tile's sides.
      for (let k = 0; k < n; k += 2) {
        const gx = water[k];
        const gy = water[k + 1];
        const fx = gx - Math.floor(gx);
        const fy = gy - Math.floor(gy);
        const x0 = Math.min(Math.floor(gx), w.w);
        const y0 = Math.min(Math.floor(gy), w.h);
        const h = fx > 1e-9
          ? w.getHeight(x0, y0) + (w.getHeight(x0 + 1, y0) - w.getHeight(x0, y0)) * fx
          : fy > 1e-9 ? w.getHeight(x0, y0) + (w.getHeight(x0, y0 + 1) - w.getHeight(x0, y0)) * fy : w.getHeight(x0, y0);
        if (h > level + 1e-6) over++;
      }
      for (const i of sw.tonguesOn(x, y)) {
        falls = i;
        const m = sw.tongueOn(i, water, n, piece);
        if (m < 6) continue;
        pieces++;
        laid += Math.abs(area2(piece, m)) / 2;
        for (let k = 0; k < m; k += 2) {
          if (piece[k] < x - 1e-6 || piece[k] > x + 1 + 1e-6 || piece[k + 1] < y - 1e-6 || piece[k + 1] > y + 1 + 1e-6) offTile++;
          if (!inside(water, n, piece[k], piece[k + 1])) offWater++;
        }
      }
    }
  }
  say(over === 0, `${label}: the pond's water is laid nowhere over ground higher than its surface: ${over} points over`);
  say(falls >= 0 && pieces > 0, `${label}: the water drawn into its lip is laid with the pond's own water: ${pieces} pieces, ${laid.toFixed(3)} tiles of it`);
  say(offTile === 0, `${label}: each piece on the tile that lays it, under whatever is laid in front of that tile: ${offTile} points off it`);
  say(offWater === 0, `${label}: and only over the pond's water there: ${offWater} points off it`);

  // The whole of it, as it was laid at once after the tiles round the lip: what the pieces leave off lay over dry ground.
  const s = sw.sheetOf(falls);
  if (!s) throw new Error(`${label}: no fall`);
  const outline: number[] = [];
  const n = tongueOutline(s, outline);
  const world: number[] = [];
  for (let k = 0; k < n; k += 2) {
    const across = s.line - s.way * outline[k + 1];
    world.push(s.axis === 1 ? across : outline[k], s.axis === 1 ? outline[k] : across);
  }
  const whole = Math.abs(area2(world, world.length)) / 2;
  console.log(`     ${label}: of ${whole.toFixed(3)} tiles drawn in, ${(whole - laid).toFixed(3)} left off the pond's water`);

  /*
   * The mouth: as wide as the water leaving the lip there, no more than
   * `MOUTH_BACK` back, and that far back only over the pond's water, its
   * back coming in to the lip at each end of it.
   */
  const [m0, m1] = mouthOf(s);
  let deepest = 0;
  let deepOff = 0;
  for (let q = 0; q <= 40; q++) {
    const u = m0 + ((m1 - m0) * q) / 40;
    const back = mouthBack(s, m0, m1, u);
    deepest = Math.max(deepest, back);
    if (back < MOUTH_BACK - 1e-9) continue;
    const across = s.line - s.way * back;
    const px = s.axis === 1 ? across : u;
    const py = s.axis === 1 ? u : across;
    let wet = false;
    for (let ty = Math.ceil(py) - 1; ty <= Math.floor(py) && !wet; ty++) {
      for (let tx = Math.ceil(px) - 1; tx <= Math.floor(px) && !wet; tx++) {
        const k = waterOn(tx, ty);
        if (k >= 6 && inside(water, k, px, py, 1e-6)) wet = true;
      }
    }
    if (!wet) deepOff++;
  }
  say(deepest <= MOUTH_BACK + 1e-9 && deepOff === 0,
    `${label}: the lip lays only its mouth, ${m0.toFixed(3)} to ${m1.toFixed(3)} along it and ${deepest.toFixed(3)} back, that far back only over the pond's water: ${deepOff} points off it`);
}

/*
 * The rim: the same hollow behind a cliff edge raised above the surface, 117
 * to 124, but for a notch at 112, its lip; a drop to 40 in front.
 */
{
  const RIM: Record<number, number> = { 5: 124, 6: 122, 7: 121, 8: 123, 9: 118, 10: 112, 11: 117, 12: 122 };
  const { game, pond } = pondOn((x, y) => {
    if (y >= 9) return 40;
    if (x >= 6 && x <= 11 && y >= 4 && y <= 7) return x === 8 && y === 5 ? 100 : 106;
    if (y === 8 && RIM[x] !== undefined) return RIM[x];
    return 120;
  }, 8, 5);
  say(pond.level === 112 && pond.lip[0] === 10 && pond.lip[1] === 8 && pond.over[0] === 10 && pond.over[1] === 9,
    `a pond behind a raised cliff edge stands at 112 and goes over its notch at (10, 8): ${pond.level}, lip ${pond.lip}, over ${pond.over}`);
  const [lo, hi] = splays(game, pond);
  // The rim either side, 118 and 117 over water at 106: the shore crosses the side behind 6/12 and 5/11 back, so 2 and 11/5 out for each tile back, no more than 2.
  say(lo === 2 && hi === 2, `past each end, as far as its shore runs out along the rim, no more than 2: ${lo}, ${hi}`);
  tongueOf(game, pond, 'the rim');
}

/* The edge and the lip with water beside it, above, laid the same way. */
{
  const { game, pond } = pondOn((x, y) => {
    if (y >= 9) return 40;
    if (x >= 6 && x <= 9 && y >= 4 && y <= 6) return x === 7 && y === 5 ? 100 : 106;
    if (x === 8 && y === 7) return 106;
    if (y === 8) return x === 8 ? 112 : 110;
    return 120;
  }, 7, 5);
  tongueOf(game, pond, 'the edge');
}
{
  const { game, pond } = pondOn((x, y) => {
    if (y >= 9) return x === 8 ? 40 : 120;
    if (x >= 6 && x <= 9 && y >= 4 && y <= 7) return x === 7 && y === 5 ? 100 : 106;
    if (y === 8) return x === 8 ? 112 : x === 7 ? 108 : 120;
    return 120;
  }, 7, 5);
  tongueOf(game, pond, 'water beside the lip');
}

if (bad) {
  console.log(`\n${bad} failed`);
  process.exit(1);
}
console.log('\nall passed');
