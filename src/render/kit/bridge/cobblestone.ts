import { byRole, keyRune, runeLine, settPaint, voussoirPaint } from './core';
import { rubblePaint, stoneBase } from './base';

/** Cobblestone: rubble walls and arches, a rough parapet. */
export const cobblestone = stoneBase('cobblestone', {
  parapet: 'rough',
  rune: 'cross',
  paint: byRole({ wall: rubblePaint, pier: rubblePaint, parapet: rubblePaint, ring: voussoirPaint(2), key: keyRune('cross'), cap: runeLine('cross'), deck: settPaint(3, 3), tread: settPaint(3, 3) }),
});
