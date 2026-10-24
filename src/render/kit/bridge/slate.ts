import { css, faceColour, type Tone } from '../core';
import { type BridgePainter, type BridgeStyle, type Kit, type Part3 } from './core';
import { archesKeyed, copingRun, coursed, framed, treadPaint, houseTone, keystone, moulding, newelPost, runsOf, voussoirs, wallRun, type Beds } from './stone_brick';

/**
 * Slate: the island's dark coursed slate, as its houses are laid
 * (`masonry.ts`, `SLATE`): thin beds of indigo, plum and blue slate, dressed
 * in a pale slate; its arches turned in pale and violet voussoirs turn about,
 * a dogtooth course under the deck as the houses have at each floor, and a
 * parapet capped in a heavy slab of the pale slate overhanging both sides.
 */

/** The houses' shade, by channel: a dark stone loses less. */
const DUSK: [number, number, number] = [0.9, 0.89, 0.97];
const PALE_DUSK: [number, number, number] = [0.862, 0.858, 0.893];
const t = (h: string): Tone => houseTone(h, DUSK);
const p = (h: string): Tone => houseTone(h, PALE_DUSK);

const FIELD = t('#4f5369');
const BEDS: Beds = [[FIELD, 5], [t('#544f69'), 1.6], [t('#474b62'), 1.6], [t('#4a4f68'), 1], [t('#585c72'), 1.2], [t('#43465a'), 0.8]];
const JOINT = t('#6a6c84');
const HI = t('#666a84');
/** The pale slate it is dressed in, and the violet of its voussoirs. */
const DRESS = p('#aeb0c4');
const VOUS = p('#7b76a0');
const DRESS_JOINT = p('#7f8198');
const DRESS_HI = p('#c4c6d6');
const BAND = p('#b4b6c8');
/** Its riven floor (`flooring.ts`). */
const FLOOR_BEDS: Beds = [[t('#6b7089'), 3], [t('#646983'), 3], [t('#727792'), 2], [t('#5e637c'), 2], [t('#6a6a86'), 1]];

const RUNE = 'laguz';

const wall = coursed({ rows: [2.1, 1.6, 2.4, 1.8, 2.2], len: 7.5, wander: 0.45, beds: BEDS, joint: JOINT, hi: HI, jointW: 0.4, bevel: 0.3 });
const deck = coursed({ rows: [9, 13, 7.5, 11], len: 15, wander: 0.5, beds: FLOOR_BEDS, joint: t('#34364a'), hi: t('#8f94ad'), jointW: 0.7, bevel: 0.5 });

/** The dogtooth: a row of teeth across the middle of a band, each one face lit and one turned from the light, the dark between them. */
const dogtooth: BridgePainter = (g, k, f) => {
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1), y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  const h = y1 - y0;
  if (h < 2 || h > 9) return;
  const a = y0 + h * 0.3, b = y0 + h * 0.72;
  const w = (b - a) * 1.25;
  g.fillStyle = css(faceColour(t('#303247'), k.L));
  g.fillRect(x0 - 1, a, x1 - x0 + 2, b - a);
  const lit = new Path2D(), shade = new Path2D();
  for (let x = Math.floor(x0 / w) * w; x < x1 + w; x += w) {
    lit.moveTo(x, a); lit.lineTo(x + w / 2, b); lit.lineTo(x + w / 2, a); lit.closePath();
    shade.moveTo(x + w / 2, a); shade.lineTo(x + w / 2, b); shade.lineTo(x + w, a); shade.closePath();
  }
  g.fillStyle = css(faceColour(t('#8d8fa8'), k.L));
  g.fill(lit);
  g.fillStyle = css(faceColour(t('#4b4e64'), k.L));
  g.fill(shade);
  g.strokeStyle = css(faceColour(DRESS_HI, k.L), 0.9);
  g.lineWidth = 0.4;
  g.beginPath(); g.moveTo(x0 - 1, y1 - 0.5); g.lineTo(x1 + 1, y1 - 0.5); g.stroke();
};

/** A slate parapet: coursed slate to a heavy capping slab overhanging it both sides, a drip course under the slab. */
const WALL = 7.6;
const CAP = 2;
function cappedParapet(k: Kit, edge: number, part: Part3): void {
  const { plan, sl, st } = k;
  const T = 0.085;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const tIn = tOut - edge * T;
  const [t0, t1] = edge > 0 ? [tIn, tOut] : [tOut, tIn];
  const deckAt = plan.deck;
  const step = plan.ramp ? 1 / 3 : 1;
  for (const [sa, sb] of runsOf(plan, sl)) {
    wallRun(k, part, sa, sb, { tOut, tIn, edge, foot: deckAt, top: (s) => deckAt(s) + WALL, tone: st.stone, role: 'parapet', order: 1 }, step, false);
    copingRun(k, part, sa, sb, edge, t0, t1, (s) => deckAt(s) + WALL, CAP, 0.034, st.trim, step);
  }
}

/** At each end, on each outer edge: a slate newel, a pale cap, and a pointed slate finial as the roofs carry. */
function slateEnds(k: Kit): void {
  const { plan, sl, st } = k;
  for (const edge of sl.edges) {
    const tt = edge > 0 ? sl.t1 - 0.075 : sl.t0 + 0.075;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    const o = { shaft: WALL + CAP + 3, half: 0.07, tone: st.stone, trim: st.trim, finial: VOUS, profile: [[0, 0.05], [0.9, 0.05], [1.5, 0.036], [6.4, 0]] as Array<[number, number]> };
    if (sl.i === 0) newelPost(k, part, 0.095, tt, plan.deck(0.095), o);
    if (sl.i === plan.n - 1) newelPost(k, part, plan.n - 0.095, tt, plan.deck(plan.n - 0.095), o);
  }
}

export const slate: BridgeStyle = framed({
  family: 'stone',
  stone: FIELD,
  ring: DRESS,
  trim: BAND,
  deck: t('#686d87'),
  parapet: 'capped',
  parapetHeight: WALL + CAP,
  ringDepth: 3.8,
  rune: RUNE,
  glow: '#e4deff',
  paint: {
    wall, pier: wall, parapet: wall, post: wall,
    ring: voussoirs({ width: 3, beds: [[DRESS, 1], [VOUS, 1]], alternate: true, joint: DRESS_JOINT, soffit: coursed({ rows: [3.2], len: 9, beds: BEDS, joint: t('#3b3e51'), jointW: 0.4 }) }),
    key: keystone(RUNE),
    cap: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 11, rune: RUNE }),
    cornice: dogtooth,
    plinth: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 9 }),
    deck, tread: treadPaint(deck, t('#8f94ad'), t('#34364a')),
  },
  build: { parapet: cappedParapet, ends: slateEnds, arches: archesKeyed(0.12, 2.6, 1, VOUS) },
}, { riser: t('#474b61') });
