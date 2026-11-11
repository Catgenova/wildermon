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
 */
import { Game } from '../../src/game/game';
import { splayOf } from '../../src/render/ponds';
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

if (bad) {
  console.log(`\n${bad} failed`);
  process.exit(1);
}
console.log('\nall passed');
