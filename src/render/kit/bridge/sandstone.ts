import { hex, type Tone } from '../core';
import { classical, copingPaint, cornicePaint, flagPaint, keystonePaint, panelPaint, plinthPaint, ringPaint, roundelPaint, slabPaint } from './marble';

/**
 * Sandstone: the classical bridge (`marble.ts`) in the house sandstone's
 * honey ashlar dressed in its rose-red (`masonry.ts`): bedded blocks in
 * courses tall and short, voussoirs rose and honey turn about, a carved
 * roundel in every spandrel, a running scroll cut along the cornice, and a
 * solid parapet between dies with ball finials.
 */
const HONEY: Tone = { lit: hex('#e8cda8'), shade: hex('#b0927f') };
const ROSE: Tone = { lit: hex('#dcaa98'), shade: hex('#9d7274') };
const BEDS = hex('#9a7666');
const IRON = hex('#c4865f');

export const sandstone = classical({
  stone: HONEY,
  ring: ROSE,
  trim: ROSE,
  key: { lit: hex('#e5b8a6'), shade: hex('#9c7680') },
  deck: { lit: hex('#e2c7a2'), shade: hex('#a08683') },
  rune: 'sunDot',
  glow: '#ffe2b0',
  ringDepth: 4.2,
  parapetHeight: 10,
  parapet: 'solid',
  finial: 'ball',
  posts: 'trim',
  newelFinial: 'ball',
  roundels: true,
  paint: {
    wall: roundelPaint(slabPaint({ courses: [4.6, 3.2], len: 9, vary: 0.4, tint: 0.1, beds: BEDS, iron: IRON }), ROSE.lit),
    pier: slabPaint({ courses: [4.6, 3.2], len: 8, vary: 0.4, tint: 0.1, beds: BEDS, iron: IRON, salt: 5 }),
    parapet: slabPaint({ courses: [3.4, 2.6], len: 8, vary: 0.4, tint: 0.07, beds: BEDS, salt: 9 }),
    ring: ringPaint(HONEY.lit, 0.55),
    key: keystonePaint('sunDot'),
    cornice: cornicePaint('scroll'),
    cap: copingPaint('sunDot'),
    plinth: plinthPaint,
    post: panelPaint,
    deck: flagPaint(10, 8, 0.08),
    tread: flagPaint(13, 8, 0.08),
  },
});
