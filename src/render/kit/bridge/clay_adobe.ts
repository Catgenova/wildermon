import { byRole, keyRune, runeLine, voussoirPaint } from './core';
import { plasterPaint, stoneBase } from './base';

/** Clay adobe: rounded plastered piers, a low curved parapet. */
export const clay_adobe = stoneBase('clay_adobe', {
  parapet: 'curved',
  rune: 'sowilo',
  paint: byRole({ wall: plasterPaint, pier: plasterPaint, parapet: plasterPaint, ring: voussoirPaint(4), key: keyRune('sowilo'), cap: runeLine('sowilo'), deck: plasterPaint, tread: plasterPaint }),
});
