import { css, STONE_INK } from './runestone';
import { IRON_PAINT, METAL_TONE, WOOD_TONE } from './materials';

/**
 * The trade and class icons before a player's name (`src/game/badges.ts`):
 * one emblem per trade and per class, each cut on a badge -- the trades on a
 * round runestone, the classes on a heater shield -- in the island's own
 * colours and edged in the stones' ink (`STONE_INK`); and the New sprout,
 * on no badge, the same way.
 *
 * Written once, as paths in a 24-unit square, and drawn two ways from the
 * same paths: an inline SVG in the windows (`emblemSvg`) and on the canvas
 * over people's heads (`drawEmblem`), so the two cannot differ and both are
 * sharp at any size.
 */

/** A path as commands: a letter and its numbers (`M`, `L`, `Q`, `C`, `Z`). */
type Cmd = [string, ...number[]];
type Shape = Cmd[];

/** One piece of an icon: its shape, its fill, and how it is edged. */
export interface EmblemPart {
  d: string;
  /** Its fill; null for a line. */
  fill: string | null;
  /** The edge: ink by default, or a colour of its own for a line. */
  stroke: string;
  /** Edge width in the 24-unit square. */
  w: number;
  /** A line drawn in two, ink under colour, so it reads on any ground: the colour's width. */
  cased?: number;
  evenodd?: boolean;
}

export const EMBLEM_BOX = 24;

const INK = css(STONE_INK);
const rgb = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v)).join(', ')})`;

/* ---- the palette ---------------------------------------------------------------------------- */

const STEEL = rgb(METAL_TONE.steel);
const IRON = rgb(METAL_TONE.iron);
const DARK_IRON = IRON_PAINT.body;
const GOLD = rgb(METAL_TONE.gold);
const OAK = WOOD_TONE.oak;
const PINE = WOOD_TONE.pine;
const CHERRY = WOOD_TONE.cherry;
const LEAF = '#9cc47a';
/** The New sprout's stem and its larger leaf, a step lighter than the forester's fir. */
const SPROUT_STEM = '#7fae5e';
const SPROUT_LEAF = '#b6d98f';
const SEA = '#8fb8d8';
const FLAME = '#f2a35e';
const FLAME_HI = '#ffd98c';
const THREAD = '#e0806f';
const GEM = '#c7a6e6';
const GEM_HI = '#efe4fb';
const MEND = '#e58a7c';
const PAW = '#b08462';
const BIND = '#b59ce0';
const WARD = '#86b7e6';
const BLOCK = '#cbbfae';
const BLOCK_HI = '#ddd3c4';

/** The trades' stone: a warm lit face a step deeper than a window's, and the rune gate's lilac shade. */
const TRADE_FACE = '#f7e2b8';
const TRADE_SIDE = '#aa9fac';
/** The classes' shield: a rose stone, so the two badges are told apart by colour as well as shape. */
const CLASS_FACE = '#f0dde6';
const CLASS_SIDE = '#a68b9f';

/* ---- shapes --------------------------------------------------------------------------------- */

const K = 0.5523;
/** An ellipse, as four curves so that it turns with the rest. */
const ellipse = (cx: number, cy: number, rx: number, ry = rx): Shape => [
  ['M', cx - rx, cy],
  ['C', cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry],
  ['C', cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy],
  ['C', cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry],
  ['C', cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy],
  ['Z'],
];
const poly = (...pts: number[]): Shape => {
  const out: Shape = [['M', pts[0], pts[1]]];
  for (let i = 2; i < pts.length; i += 2) out.push(['L', pts[i], pts[i + 1]]);
  out.push(['Z']);
  return out;
};
const rect = (x: number, y: number, w: number, h: number): Shape => poly(x, y, x + w, y, x + w, y + h, x, y + h);
/** A path written as SVG, letters and numbers. */
const path = (d: string): Shape => {
  const out: Shape = [];
  for (const m of d.matchAll(/([MLQCZHV])([^MLQCZHV]*)/g)) {
    const n = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    out.push([m[1], ...n]);
  }
  return absolute(out);
};
/** H and V as L, so every point has two numbers. */
function absolute(s: Shape): Shape {
  let x = 0, y = 0;
  return s.map((c) => {
    const [k, ...n] = c;
    if (k === 'H') return ['L', (x = n[0]), y] as Cmd;
    if (k === 'V') return ['L', x, (y = n[0])] as Cmd;
    if (n.length >= 2) [x, y] = [n[n.length - 2], n[n.length - 1]];
    return c;
  });
}

/** Turned `deg` round (cx, cy), scaled `s` about it and moved (dx, dy). */
function xf(s: Shape, deg = 0, cx = 12, cy = 12, k = 1, dx = 0, dy = 0): Shape {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  return s.map(([c, ...n]) => {
    const out: number[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = n[i] - cx, y = n[i + 1] - cy;
      out.push(cx + (x * co - y * si) * k + dx, cy + (x * si + y * co) * k + dy);
    }
    return [c, ...out] as Cmd;
  });
}

const svgOf = (s: Shape): string =>
  s.map(([c, ...n]) => c + n.map((v) => String(Math.round(v * 100) / 100)).join(' ')).join('');

/** A part as it is written: a shape, its fill, and anything else about it. */
interface Piece {
  s: Shape;
  fill?: string | null;
  stroke?: string;
  w?: number;
  cased?: number;
  evenodd?: boolean;
}
const fill = (s: Shape, f: string, w = 1.1): Piece => ({ s, fill: f, w });
/** The ink either side of a line in colour, both sides together. */
const CASING = 1.6;
const line = (s: Shape, colour: string, width: number): Piece => ({ s, fill: null, stroke: colour, w: width + CASING, cased: width });
const inkLine = (s: Shape, w = 0.8): Piece => ({ s, fill: null, w });

/* ---- the emblems, each in the 24 square, about its middle ------------------------------------ */

const bar = (x1: number, y1: number, x2: number, y2: number, w: number): Shape => {
  const l = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / l) * (w / 2), ny = ((x2 - x1) / l) * (w / 2);
  return poly(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny);
};
const turned = (ps: Piece[], deg: number, cx = 12, cy = 12): Piece[] => ps.map((p) => ({ ...p, s: xf(p.s, deg, cx, cy) }));

/** A spade: digging. */
const spade = (): Piece[] => turned([
  fill(rect(11.1, 6, 1.8, 7), OAK),
  fill(rect(8.6, 3.4, 6.8, 2.2), OAK),
  fill(path('M7.6 12.6H16.4V16.4Q16.4 20.4 12 21.4Q7.6 20.4 7.6 16.4Z'), STEEL),
], -32);

/** A pickaxe: mining. */
const pick = (): Piece[] => turned([
  fill(rect(11.1, 7, 1.8, 14.5), OAK),
  fill(path('M3.4 10.4Q12 1.6 20.6 10.4Q12 5.6 3.4 10.4Z'), STEEL),
], 38, 12, 12.5);

/** Three dressed blocks: masonry. */
const blocks = (): Piece[] => [
  fill(rect(3.6, 13, 8.2, 6.2), BLOCK),
  fill(rect(12.2, 13, 8.2, 6.2), BLOCK),
  fill(rect(7.9, 6.4, 8.2, 6.2), BLOCK_HI),
];

/** A saw: carpentry. */
const saw = (): Piece[] => {
  const teeth: number[] = [];
  for (let i = 0; i <= 8; i++) teeth.push(16 - i * 1.3, i % 2 ? 15.4 : 14);
  return turned([
    fill(poly(3, 10.4, 16, 8.4, ...teeth, 3, 13.2), STEEL),
    fill(path('M15.4 7.4H19Q21.2 7.4 21.2 9.6V13.2Q21.2 15.4 19 15.4H15.4Z'), CHERRY),
    fill(ellipse(18.3, 11.4, 1, 1.6), TRADE_FACE, 0.9),
  ], -18);
};

/** A hammer over an anvil: smithing. */
const anvil = (): Piece[] => [
  fill(path('M2.8 12.8Q5 15.2 8.4 15.2H9.2L9.8 17.4L7.6 20.2H16.8L14.6 17.4L15.2 15.2H21.2V12.8Z'), DARK_IRON),
  ...turned([
    fill(rect(11.2, 7.6, 1.6, 6.6), OAK),
    fill(rect(8, 3.6, 8, 4), STEEL),
  ], 32, 12, 8),
];

/** A fir: forestry. */
const fir = (): Piece[] => [
  fill(rect(10.9, 16.4, 2.2, 4.6), OAK),
  fill(poly(12, 2.6, 16.6, 8.6, 14.8, 8.6, 18.2, 12.8, 16.2, 12.8, 19.6, 17, 4.4, 17, 7.8, 12.8, 5.8, 12.8, 9.2, 8.6, 7.4, 8.6), LEAF),
];

/** A sickle: farming. */
const sickle = (): Piece[] => [
  fill(bar(8.6, 15, 4.4, 20.6, 2.4), OAK),
  fill(path('M9 16C19.6 16.4 20.6 4.6 10.4 4C16.8 6.6 16.6 13.8 9 13.8Z'), STEEL),
];

/** A pot on the fire's steam: cooking. */
const pot = (): Piece[] => [
  inkLine(path('M9.6 7.4C8.4 6 10.8 4.8 9.6 3.2'), 1),
  inkLine(path('M14.4 7.4C13.2 6 15.6 4.8 14.4 3.2'), 1),
  fill(path('M5.2 10.6H18.8V11.8C18.8 17.4 15.8 20.4 12 20.4C8.2 20.4 5.2 17.4 5.2 11.8Z'), DARK_IRON),
  fill(rect(3.6, 8.6, 16.8, 2.4), IRON),
];

/** A needle and its thread: tailoring. */
const needle = (): Piece[] => turned([
  line(path('M12 6.6C18.4 4 21 12.4 14.6 14.2C9.6 15.6 7.4 18.6 9.8 21'), THREAD, 0.9),
  { s: [...path('M12 21.6L13.5 7.2Q13.5 3 12 3Q10.5 3 10.5 7.2Z'), ...ellipse(12, 6.4, 0.45, 1.3)], fill: STEEL, w: 1, evenodd: true },
], 38);

/** A shepherd's crook: husbandry. */
const crook = (): Piece[] => [
  line(path('M9.4 21.4L9.4 9.4C9.4 3.6 17.4 3.2 17.4 8.4C17.4 10.8 15.2 11.4 14.4 10'), OAK, 2.2),
];

/** A leaf: foraging and botany. */
const leaf = (): Piece[] => [
  inkLine(path('M5.6 18.4L3.8 20.4'), 1.2),
  fill(path('M5.6 18.4C5.4 9.6 10.4 4.4 20 3.8C20.2 13.4 14.6 18.8 5.6 18.4Z'), LEAF),
  inkLine(path('M5.6 18.4L16 8'), 0.8),
  inkLine(path('M9.4 14.6L9.2 10.6M12.4 11.6L12.6 7.6M9.4 14.6L13.4 14.8M12.4 11.6L16.4 11.8'), 0.6),
];

/** A fish: fishing. */
const fish = (): Piece[] => [
  fill(poly(16.2, 12, 21, 7.6, 21, 16.4), SEA),
  fill(path('M3 12C6.8 6.4 13.6 6.4 17.4 12C13.6 17.6 6.8 17.6 3 12Z'), SEA),
  fill(ellipse(7, 11.2, 0.9), INK, 0.2),
  inkLine(path('M10.8 9.4Q12.2 12 10.8 14.6'), 0.7),
];

/** A spanner: mending. */
const spanner = (): Piece[] => turned([
  fill(path('M10.6 20.2L10.6 10.8C9.8 10.8 7.4 9.6 7.4 6L9.6 3.2L10.2 7H13.8L14.4 3.2L16.6 6C16.6 9.6 14.2 10.8 13.4 10.8L13.4 20.2C13.4 22 10.6 22 10.6 20.2Z'), STEEL),
], 40);

/** A cut gem: jewellery and the fine crafts. */
const gem = (): Piece[] => [
  fill(poly(4.6, 9, 8.2, 4.4, 15.8, 4.4, 19.4, 9, 12, 20.6), GEM),
  fill(poly(8.2, 4.4, 10.2, 9, 4.6, 9), GEM_HI, 0.6),
  inkLine(path('M4.6 9H19.4M8.2 4.4L10.2 9L12 20.6M15.8 4.4L13.8 9L12 20.6'), 0.7),
];

/** A sword, upright: the Sworn Blade. */
const sword = (): Piece[] => [
  fill(path('M10.8 4L12 1.8L13.2 4V14.6H10.8Z'), STEEL),
  fill(rect(11.1, 16.2, 1.8, 4), CHERRY),
  fill(rect(6.6, 14.4, 10.8, 2), GOLD),
  fill(ellipse(12, 21, 1.4), GOLD),
];

/** A double-bitted axe: the Berserker. */
const axe = (): Piece[] => [
  fill(path('M11.2 6.6C8 4.6 4.2 5.6 3.2 11C4.2 16.4 8 17.4 11.2 15.4Z'), STEEL),
  fill(path('M12.8 6.6C16 4.6 19.8 5.6 20.8 11C19.8 16.4 16 17.4 12.8 15.4Z'), STEEL),
  fill(rect(10.9, 2.4, 2.2, 19.6), OAK),
];

/** A halberd: the Pikeman. */
const halberd = (): Piece[] => turned([
  fill(rect(11.1, 9, 1.8, 13.4), OAK),
  fill(path('M12.9 10.4C16.6 9.8 18.8 11.8 18.8 14.6C16.8 13.6 15 13.8 12.9 14.4Z'), STEEL),
  fill(path('M12 1.4C14.2 4.4 14.4 7 12 9.8C9.6 7 9.8 4.4 12 1.4Z'), STEEL),
  fill(rect(9.4, 9.4, 5.2, 1.6), IRON),
], 24);

/** A bow and its arrow: the Archer. */
const bow = (): Piece[] => [
  inkLine(path('M7 3.2L7 20.8'), 0.7),
  line(path('M7 3.2C13.2 7.6 13.2 16.4 7 20.8'), OAK, 2),
  line(path('M5 12H17'), PINE, 1.1),
  fill(poly(16.4, 9.6, 21.2, 12, 16.4, 14.4), STEEL, 1),
  fill(poly(3.2, 9.6, 6.4, 12, 3.2, 14.4, 4.4, 12), THREAD, 0.8),
];

/** Two throwing knives, crossed: the Skirmisher. */
const knives = (): Piece[] => {
  const knife: Piece[] = [
    fill(rect(11, 14.6, 2, 6), CHERRY),
    fill(path('M12 2.4C13.8 4.6 13.8 9 13.3 13.2H10.7C10.2 9 10.2 4.6 12 2.4Z'), STEEL),
    fill(rect(9.4, 13, 5.2, 1.6), IRON),
  ];
  return [...turned(knife, -34), ...turned(knife, 34)];
};

/** A cross: the Chirurgeon. */
const cross = (): Piece[] => [
  fill(poly(9.4, 3.6, 14.6, 3.6, 14.6, 9.4, 20.4, 9.4, 20.4, 14.6, 14.6, 14.6, 14.6, 20.4, 9.4, 20.4, 9.4, 14.6, 3.6, 14.6, 3.6, 9.4, 9.4, 9.4), MEND),
];

/** A paw: the Beastmaster. */
const paw = (): Piece[] => [
  fill(path('M6.8 15.6C6.8 12 9.6 10.4 12 10.4C14.4 10.4 17.2 12 17.2 15.6C17.2 18.4 15 19.8 12 18.8C9 19.8 6.8 18.4 6.8 15.6Z'), PAW),
  fill(xf(ellipse(5.4, 9.8, 1.8, 2.4), -24, 5.4, 9.8), PAW),
  fill(xf(ellipse(9.4, 6, 1.8, 2.4), -8, 9.4, 6), PAW),
  fill(xf(ellipse(14.6, 6, 1.8, 2.4), 8, 14.6, 6), PAW),
  fill(xf(ellipse(18.6, 9.8, 1.8, 2.4), 24, 18.6, 9.8), PAW),
];

/** A flame: the Kindler. */
const flame = (): Piece[] => [
  fill(path('M12 2C14.2 5.8 18.8 8.4 18.8 14C18.8 18.6 15.6 21.8 12 21.8C8.4 21.8 5.2 18.6 5.2 14C5.2 10.4 7.6 8.8 8.2 6.2C9.8 7.8 10.4 9.4 10.4 11C11.6 8.8 12.6 5.6 12 2Z'), FLAME),
  fill(path('M12 11C13.6 13 15.4 14.6 15.4 17C15.4 19 13.8 20.4 12 20.4C10.2 20.4 8.6 19 8.6 17C8.6 15.2 10.4 13.8 12 11Z'), FLAME_HI, 0.8),
];

/** Two links of a chain: the Binder. */
const chain = (): Piece[] => [
  line(xf(ellipse(9, 9, 5.2, 3), 45, 9, 9), BIND, 2),
  line(xf(ellipse(15, 15, 5.2, 3), 45, 15, 15), BIND, 2),
];

/** Algiz, the warding rune: the Warder. */
const algiz = (): Piece[] => [
  line(path('M12 21.4L12 3M12 12.4L5.4 4.6M12 12.4L18.6 4.6'), WARD, 2.4),
];

/** A sprout out of a mound of earth: New (`NEW_BADGE`), cut on no badge. */
const sprout = (): Piece[] => [
  fill(path('M5.4 21.8Q12 16.4 18.6 21.8Z'), OAK),
  line(path('M12 20L12 11.6'), SPROUT_STEM, 1.7),
  fill(path('M12 14.2C8.4 15 4.2 13 3.4 8.2C8 7.6 11.4 9.8 12 14.2Z'), LEAF),
  fill(path('M12 11.8C12.4 6.6 16.2 3.2 21 3.4C21.2 8.6 17.2 12 12 11.8Z'), SPROUT_LEAF),
  inkLine(path('M12 11.8L17.4 6.6'), 0.6),
  inkLine(path('M12 14.2L6.6 10.6'), 0.6),
];

/** The icons cut on no badge, by id: the New sprout. */
const BARE_ART: Record<string, () => Piece[]> = { new: sprout };

/** Each trade's and class's emblem, by its id in `classes.ts`. */
const EMBLEM_ART: Record<string, () => Piece[]> = {
  terraformer: spade, miner: pick, mason: blocks, carpenter: saw, smith: anvil, forester: fir, farmer: sickle,
  cook: pot, tailor: needle, herdsman: crook, naturalist: leaf, fisher: fish, mender: spanner, artisan: gem,
  blade: sword, berserker: axe, pikeman: halberd, archer: bow, skirmisher: knives, chirurgeon: cross,
  beastmaster: paw, kindler: flame, binder: chain, warder: algiz,
};

/** What each emblem shows, by id: the picture, in a word or two (the sheet and the tests name them by it). */
export const EMBLEM_NAMES: Record<string, string> = {
  terraformer: 'spade', miner: 'pickaxe', mason: 'dressed blocks', carpenter: 'saw', smith: 'hammer and anvil',
  forester: 'fir', farmer: 'sickle', cook: 'pot', tailor: 'needle and thread', herdsman: 'crook',
  naturalist: 'leaf', fisher: 'fish', mender: 'spanner', artisan: 'cut gem',
  blade: 'sword', berserker: 'double axe', pikeman: 'halberd', archer: 'bow and arrow',
  skirmisher: 'crossed knives', chirurgeon: 'cross', beastmaster: 'paw', kindler: 'flame', binder: 'chain', warder: 'algiz rune',
  new: 'sprout',
};

/* ---- the badges ------------------------------------------------------------------------------ */

const shield = (k = 1, dx = 0, dy = 0): Shape =>
  xf(path('M2.6 2.2H21.4V10.6C21.4 16.4 17 20.6 12 22.8C7 20.6 2.6 16.4 2.6 10.6Z'), 0, 12, 12, k, dx, dy);

/** The round stone a trade is cut on: its side, its lit face, and the emblem made smaller to sit in it. */
const TRADE_BADGE: Piece[] = [
  { s: ellipse(12, 12, 11.2), fill: TRADE_SIDE, w: 1.3 },
  { s: ellipse(11.6, 11.6, 10.3), fill: TRADE_FACE, w: 0 },
];
/** The shield a class is cut on, the same way. */
const CLASS_BADGE: Piece[] = [
  { s: shield(), fill: CLASS_SIDE, w: 1.3 },
  { s: shield(0.9, -0.4, -0.6), fill: CLASS_FACE, w: 0 },
];

/** Every id with an emblem. */
export const EMBLEM_IDS: readonly string[] = Object.keys(EMBLEM_ART);

/** Which badge an id is cut on; `bare`, none: the New sprout (`badgeShape` in `src/game/badges.ts`). */
export type BadgeShape = 'stone' | 'shield' | 'bare';

const built = new Map<string, EmblemPart[]>();

/** An icon whole, badge and emblem, as parts to draw in order; empty for an id with no emblem. */
export function emblemParts(id: string, badge: BadgeShape): EmblemPart[] {
  const key = `${badge}:${id}`;
  let got = built.get(key);
  if (got) return got;
  const art = badge === 'bare' ? BARE_ART[id] : EMBLEM_ART[id];
  if (!art) return [];
  // The emblem made small enough to sit inside the face, its middle on the face's.
  const inner = badge === 'stone' ? { k: 0.8, dx: -0.4, dy: -0.4 } : { k: 0.74, dx: -0.4, dy: -1 };
  // Its edges stay the badge's weight; a line's own width, which is its shape, is made small with it.
  const small = (p: Piece): Piece => {
    const s = xf(p.s, 0, 12, 12, inner.k, inner.dx, inner.dy);
    return p.cased === undefined ? { ...p, s } : { ...p, s, cased: p.cased * inner.k, w: p.cased * inner.k + CASING };
  };
  // One on no badge is drawn the whole square.
  const pieces = badge === 'bare' ? art() : [...(badge === 'stone' ? TRADE_BADGE : CLASS_BADGE), ...art().map(small)];
  got = pieces.map((p) => ({
    d: svgOf(p.s),
    fill: p.fill ?? null,
    stroke: p.cased !== undefined ? (p.stroke ?? INK) : INK,
    w: p.w ?? 1.1,
    ...(p.cased !== undefined ? { cased: p.cased } : {}),
    ...(p.evenodd ? { evenodd: true } : {}),
  }));
  built.set(key, got);
  return got;
}

/* ---- in a window ---------------------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
const templates = new Map<string, SVGSVGElement>();

/** The icon as an SVG element, the 24 square scaled to whatever box it is put in. */
export function emblemSvg(id: string, badge: BadgeShape): SVGSVGElement {
  const key = `${badge}:${id}`;
  let t = templates.get(key);
  if (!t) {
    t = document.createElementNS(SVG_NS, 'svg');
    t.setAttribute('viewBox', `0 0 ${EMBLEM_BOX} ${EMBLEM_BOX}`);
    t.setAttribute('aria-hidden', 'true');
    t.setAttribute('focusable', 'false');
    for (const p of emblemParts(id, badge)) {
      const add = (stroke: string, w: number, f: string | null): void => {
        const el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', p.d);
        el.setAttribute('fill', f ?? 'none');
        if (p.evenodd) el.setAttribute('fill-rule', 'evenodd');
        if (w > 0) {
          el.setAttribute('stroke', stroke);
          el.setAttribute('stroke-width', String(w));
          el.setAttribute('stroke-linejoin', 'round');
          el.setAttribute('stroke-linecap', 'round');
        }
        t!.append(el);
      };
      if (p.cased !== undefined) {
        add(INK, p.w, null);
        add(p.stroke, p.cased, null);
      } else {
        add(p.stroke, p.w, p.fill);
      }
    }
    templates.set(key, t);
  }
  return t.cloneNode(true) as SVGSVGElement;
}

/* ---- on the canvas -------------------------------------------------------------------------- */

const paths = new Map<string, Path2D>();
const path2d = (d: string): Path2D => {
  let p = paths.get(d);
  if (!p) paths.set(d, (p = new Path2D(d)));
  return p;
};

/** The icon drawn straight onto `g`, `size` CSS pixels square with its top left at (x, y). */
export function paintEmblem(g: CanvasRenderingContext2D, id: string, badge: BadgeShape, x: number, y: number, size: number): void {
  const parts = emblemParts(id, badge);
  if (!parts.length) return;
  g.save();
  g.translate(x, y);
  g.scale(size / EMBLEM_BOX, size / EMBLEM_BOX);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const p of parts) {
    const d = path2d(p.d);
    if (p.cased !== undefined) {
      g.strokeStyle = INK;
      g.lineWidth = p.w;
      g.stroke(d);
      g.strokeStyle = p.stroke;
      g.lineWidth = p.cased;
      g.stroke(d);
      continue;
    }
    if (p.fill) {
      g.fillStyle = p.fill;
      g.fill(d, p.evenodd ? 'evenodd' : 'nonzero');
    }
    if (p.w > 0) {
      g.strokeStyle = p.stroke;
      g.lineWidth = p.w;
      g.stroke(d);
    }
  }
  g.restore();
}

/**
 * Each icon painted once at the size it is drawn in device pixels, and laid
 * from then on: the names over heads are drawn every frame.
 */
const baked = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

/**
 * The icon over somebody's head: `size` CSS pixels square, top left at (x, y),
 * laid on whole device pixels from a copy painted at that size, so it is as
 * sharp as the writing beside it at every zoom and on every screen.
 */
export function drawEmblem(g: CanvasRenderingContext2D, id: string, badge: BadgeShape, x: number, y: number, size: number): void {
  const m = g.getTransform();
  const k = Math.hypot(m.a, m.b) || 1;
  const px = Math.max(1, Math.round(size * k));
  const key = `${badge}:${id}:${px}`;
  let c = baked.get(key);
  if (!c) {
    c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(px, px) : Object.assign(document.createElement('canvas'), { width: px, height: px });
    const cg = c.getContext('2d') as CanvasRenderingContext2D | null;
    if (!cg) return;
    paintEmblem(cg, id, badge, 0, 0, px);
    if (baked.size > 400) baked.clear();
    baked.set(key, c);
  }
  // On whole device pixels, so the copy is laid one to one.
  const sx = Math.round(x * k) / k, sy = Math.round(y * k) / k;
  g.drawImage(c, sx, sy, px / k, px / k);
}

/** The colours an icon is drawn in, for the tests: every fill and edge. */
export const emblemInks = (id: string, badge: BadgeShape): string[] =>
  [...new Set(emblemParts(id, badge).flatMap((p) => [p.fill, p.stroke].filter((x): x is string => !!x)))];

/** The palette's ink, which every icon is edged in. */
export const EMBLEM_INK = INK;
