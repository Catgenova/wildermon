import { ashlarPaint, byRole, keyRune, runeLine, settPaint, voussoirPaint } from './core';
import { stoneBase } from './base';

/** Slate: thin coursed slate, a slate-capped parapet. */
export const slate = stoneBase('slate', {
  parapet: 'capped',
  rune: 'laguz',
  paint: byRole({ wall: ashlarPaint(1.2, 8), pier: ashlarPaint(1.2, 7), parapet: ashlarPaint(1.2, 7), ring: voussoirPaint(1.6), key: keyRune('laguz'), cap: runeLine('laguz'), deck: settPaint(8, 5), tread: settPaint(8, 5) }),
});
