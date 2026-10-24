import { ashlarPaint, byRole, keyRune, runeLine, settPaint, voussoirPaint } from './core';
import { stoneBase } from './base';

/** Clay bricks: brick walls and voussoirs, a brick parapet. */
export const clay_bricks = stoneBase('clay_bricks', {
  parapet: 'brick',
  rune: 'kenaz',
  paint: byRole({ wall: ashlarPaint(1.4, 4.2, 0.12), pier: ashlarPaint(1.4, 4.2, 0.12), parapet: ashlarPaint(1.4, 4.2, 0.12), ring: voussoirPaint(1.2), key: keyRune('kenaz'), cap: runeLine('kenaz'), deck: settPaint(4.2, 2), tread: settPaint(4.2, 2) }),
});
