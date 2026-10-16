import { FRAMES } from './runecut-frames';
import { type Ctx, type LifePiece, type LifeWorld } from './life/kit';
import { bee } from './life/bee';
import { butterflies } from './life/butterflies';
import { dragonfly } from './life/dragonfly';
import { EMBERS, embers } from './life/embers';
import { FIREFLIES, fireflies } from './life/fireflies';
import { glints } from './life/glints';
import { hedgehog } from './life/hedgehog';
import { ladybird } from './life/ladybird';
import { MOTES_LEAST, MOTES_MORE, motes } from './life/motes';
import { moth } from './life/moth';
import { mouse } from './life/mouse';
import { snail } from './life/snail';
import { FLAKES, snow } from './life/snow';
import { songbird } from './life/songbird';
import { spider } from './life/spider';
import { sunbeam } from './life/sunbeam';
import { wisp } from './life/wisp';

export type { LifePiece, LifeWorld } from './life/kit';
export { EMBERS, FIREFLIES, FLAKES, MOTES_LEAST, MOTES_MORE };

/**
 * Small life on Runecut's frames: animals and lights that go about each
 * frame's band, drawn over the windows on one canvas (`RunecutArt`), with
 * nothing kept between frames. Every one is a function of the clock and the
 * window's seed, so it is wherever it would be at that moment however often
 * it is drawn, and a window opened late joins in where the rest are.
 *
 * Kept to the band and what stands past it, never over what is inside a
 * window; taking no clicks; not drawn at all on a phone's screen, with Fast
 * graphics, with the setting off, or when the system asks for less motion.
 *
 * Each animal or light is a file of its own in `src/ui/life/`, drawn from here.
 */

/** What lives on which frame, and when: for the setting's words, under the frames' own names. */
export const LIFE: Array<{ kind: string | null; what: string }> = [
  { kind: 'wicker', what: 'two butterflies by day' },
  { kind: 'linen', what: 'a hedgehog asleep on the foot, out and about more after dark' },
  { kind: 'turf', what: `${FIREFLIES} fireflies after dark` },
  { kind: 'bench', what: 'a moth round the lantern after dark, and sparks while something is being made' },
  { kind: 'stall', what: 'a bee by day' },
  { kind: 'palisade', what: 'a ladybird on the foot beam' },
  { kind: 'burlap', what: 'a mouse looking out over the top' },
  { kind: 'crate', what: 'a spider on its thread' },
  { kind: 'runestone', what: 'a snail climbing a pillar' },
  { kind: 'letter', what: 'a songbird by day' },
  { kind: 'parchment', what: 'a dragonfly by day' },
  { kind: 'altar', what: `${MOTES_LEAST} motes, and up to ${MOTES_MORE} more as your favour fills` },
  { kind: 'treasure', what: 'a wisp, brighter and quicker while a treasure map is in your pack, and stopping over the frame\'s X\'s and compasses' },
  { kind: 'book', what: 'dust in a sunbeam by day' },
  { kind: 'strap', what: 'glints on the crystals after dark' },
  { kind: 'toolbelt', what: 'glints on the crystals after dark' },
  { kind: null, what: 'snow on every window in the island\'s winter' },
];

/** The life on each frame in words: "pale wood and wildflowers, two butterflies by day; …". */
export function lifeWords(): string {
  return LIFE.map((l) => (l.kind ? `${FRAMES.find((f) => f.kind === l.kind)?.label.toLowerCase() ?? l.kind}, ${l.what}` : l.what)).join('; ');
}

/** Whatever lives on this piece's frame now, drawn in the piece's own place. */
export function paintLife(g: Ctx, p: LifePiece, t: number, world: LifeWorld): void {
  g.save();
  g.translate(p.x, p.y);
  const day = !world.night;
  switch (p.kind) {
    case 'wicker':
      if (day) butterflies(g, p, t);
      break;
    case 'linen':
      hedgehog(g, p, t, world.night);
      break;
    case 'turf':
      if (!day) fireflies(g, p, t);
      break;
    case 'bench':
      if (!day) moth(g, p, t);
      if (world.crafting) embers(g, p, t);
      break;
    case 'stall':
      if (day) bee(g, p, t);
      break;
    case 'palisade':
      ladybird(g, p, t, world.night);
      break;
    case 'burlap':
      mouse(g, p, t, world.night);
      break;
    case 'crate':
      spider(g, p, t, world.night);
      break;
    case 'runestone':
      snail(g, p, t, world.night);
      break;
    case 'letter':
      if (day) songbird(g, p, t);
      break;
    case 'parchment':
      if (day) dragonfly(g, p, t);
      break;
    case 'altar':
      motes(g, p, t, world.favour);
      break;
    case 'treasure':
      wisp(g, p, t, world.map);
      break;
    case 'book':
      if (day) sunbeam(g, p, t);
      break;
    case 'strap':
    case 'toolbelt':
      if (!day) glints(g, p, t);
      break;
  }
  if (world.winter) snow(g, p, t, world.night);
  g.restore();
}
