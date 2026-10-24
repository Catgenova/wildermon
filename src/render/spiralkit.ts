import { WALL_HEIGHT } from '../game/building';
import { SPIRAL_OUT, SPIRAL_POST, SPIRAL_START, SPIRAL_TREADS, SPIRAL_WALK, SPIRAL_WIND } from '../game/spiral';
import { dyeTint } from '../game/dyestuffs';
import { kitEyeOfTurn } from './bridgekit';
import { UNITS_PER_TILE } from './iso';
import { kitBaked, kitIsSync, kitMayBake } from './kitpieces';
import { centre, lathe, prism, seam, slab, type Side } from './kit/core';
import { stairStyle } from './stairing';
import {
  BAKE_STEPS, canvasOf, css, cut, dot, drawFaces, newell, glyphPath, hex, mix, mul, proj, RUNE_GOLD, RUNE_WHITE, scaleFor, STONE_INK, sub, unit,
  type Ctx, type Eye, type Face, type PaintCtx, type RGB, type Tone, type V3,
} from './runestone';

/**
 * A spiral staircase in the runestones' kit: a post up the middle of its tile,
 * wedge treads wound once round it a storey (`SPIRAL_TREADS` of them, from
 * `SPIRAL_START`, round the way `SPIRAL_WIND` says: `game/spiral.ts`), and a
 * handrail on balusters spiralling up their outer ends, in the colours its
 * material builds a flight in (`stairStyle`): a masonry's treads and post in
 * its stone, the carpentry's in timber. The top of a stair -- the storey with
 * no spiral over it -- ends in a cap on the post, a rune cut in each face and
 * laid with gold. Spirals stacked on one tile run on into each other, rail and
 * post and treads, as one tower.
 *
 * A flight is laid in pieces sorted with whatever stands on its line, as a
 * material bridge is (`bridgekit.ts`): each tread, each tread's stretch of
 * rail with its baluster, the post and the cap, each with a key of its own --
 * where its middle is on the screen at the tile's foot, so the pieces of the
 * near side of the turn go on after anybody climbing the far side, and the far
 * side's before (`spiralKey`); a storey up a hair after the storey under it.
 *
 * Built in the island's units -- forty to a tile across, `WALL_HEIGHT` a
 * storey -- from the middle of the tile at the flight's foot, baked once for
 * each piece, turn of the view and scale, and drawn with one `drawImage`.
 */

/* ---- the shape ------------------------------------------------------------------------- */

const U = UNITS_PER_TILE;
const N = SPIRAL_TREADS;
const H = WALL_HEIGHT;
const RISE = H / N;
const R_IN = SPIRAL_POST * U;
const R_OUT = SPIRAL_OUT * U;
/** The rail: how far in from the treads' outer ends, how high over the nosings, and its section. */
const RAIL_IN = 1.5;
const RAIL_R = R_OUT - RAIL_IN;
const RAIL_H = 9;
const RAIL_W = 1.3;
const RAIL_T = 1.1;
/** Treads left unrailed where the stair is stepped onto at its foot and off at its head, at the bottom and the top of a stack. */
const OPEN = 3;
/** How far the post stands up over the head of the top storey, and its cap. */
const POST_UP = 9;
const CAP_W = 3.4;
const CAP_H = 3.6;

/** The angle at a share of a storey round the stair (`spiral.ts`), the stair turned `turn` from `SPIRAL_START`. */
const angleAt = (share: number, turn: number): number => SPIRAL_START + turn + SPIRAL_WIND * Math.PI * 2 * share;
const polar = (r: number, a: number, z: number): V3 => [Math.cos(a) * r, Math.sin(a) * r, z];
/** The rail's height over the flight's foot at a share of the storey round, rising with the nosings. */
const railZ = (share: number): number => RAIL_H + RISE + H * share;

/* ---- what it is built of ---------------------------------------------------------------- */

interface Look {
  key: string;
  family: 'stone' | 'timber';
  tread: Tone;
  edge: Tone;
  post: Tone;
  rail: Tone;
  baluster: Tone;
  cap: Tone;
  rune: string;
}

/** A colour as the kit tones it: toward cream in the light, toward the island's lilac dusk in shade. */
const pastel = (c: readonly number[], lift = 0.2, dusk = 0.5): Tone => {
  const rgb: RGB = [c[0], c[1], c[2]];
  return { lit: mix(rgb, [255, 246, 232], lift), shade: mix(mix(rgb, hex('#6a6080'), dusk), [0, 0, 0], 0.04) };
};
const IRON_TONE: Tone = { lit: mix(hex('#a6b2c6'), hex('#5f6982'), 0.5), shade: hex('#3f4660') };

const looks = new Map<string, Look>();
/** What a spiral of `material`, painted `dye` or not, is built of. */
export function spiralLook(material: string, dye?: string): Look {
  const key = `${material}|${dye ?? ''}`;
  let l = looks.get(key);
  if (l) return l;
  const st = stairStyle(material);
  const timber = st.build === 'string' || st.build === 'closed' || st.build === 'log';
  const tint = dye ? dyeTint(dye) : undefined;
  // Painted, it is the paint all over, each part a step lighter or darker in it as it was in the bare material.
  const paint = (c: readonly number[]): readonly number[] => (tint ? mix(hex(tint.colour), [c[0], c[1], c[2]], 0.35) : c);
  const tread = pastel(paint(st.tread), 0.18);
  // The risers and the treads' ends a step deeper than their tops, toward the dusk, so each tread reads against the next.
  const edge0 = pastel(paint(timber ? st.string : st.riser), 0.08, 0.55);
  // On a pale stone -- marble, sandstone, adobe -- a good step deeper again, so a white step reads against the white one over it.
  const lum = (c: readonly number[]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const pale = !timber && lum(tread.lit) > 205;
  const edge: Tone = {
    lit: mix(edge0.lit, hex(pale ? '#8e87a8' : '#a9a3bd'), timber ? 0.12 : pale ? 0.5 : 0.3),
    shade: mix(edge0.shade, hex('#3e3752'), pale ? 0.45 : 0.25),
  };
  const post = pastel(paint(timber ? st.post : st.string), timber ? 0.12 : 0.2);
  const railTone = st.rail === 'iron' ? IRON_TONE : pastel(paint(st.rail === 'stone' ? st.post : st.bar), 0.15);
  const baluster = st.rail === 'iron' ? IRON_TONE : pastel(paint(st.post), 0.15);
  l = {
    key, family: timber ? 'timber' : 'stone', tread, edge, post, rail: railTone, baluster,
    cap: { lit: mix(post.lit, [255, 250, 240], 0.2), shade: mix(post.shade, post.lit, 0.12) },
    rune: ['algiz', 'tiwaz', 'ingwaz', 'dagaz', 'sowilo', 'othala'][Math.abs(hashOf(material)) % 6],
  };
  looks.set(key, l);
  return l;
}
const hashOf = (s: string): number => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

/* ---- the pieces ------------------------------------------------------------------------- */

/** Which piece: a tread, its stretch of rail with its baluster, the post a storey up, or the cap on the top of it. */
export type SpiralPart = 'tread' | 'rail' | 'post' | 'cap';

/** A flight's place in its stack: a spiral on the tile under it, and over it. */
export interface SpiralStack { below: boolean; above: boolean }

/** Whether tread `i`'s stretch of rail stands: not over the treads a stack is stepped onto at its foot and off at its head. */
const railed = (i: number, s: SpiralStack): boolean => (s.below || i >= OPEN) && (s.above || i <= N - 1 - OPEN);

/** A tread's top, painted: a lit nosing along its leading edge, and on timber the boards' seams. */
function treadPaint(look: Look, r0: number, r1: number, w: number, span: number): (g: Ctx, k: PaintCtx) => void {
  return (g, k) => {
    // `x` out along the nosing from the post, `y` round from it toward the tread's back edge, which runs out from the post at `span`.
    // The shade the tread over it throws on its back: a band in from the back edge, deepest under the nosing over it.
    const c = Math.cos(span), sn = Math.sin(span);
    for (const [k2, a] of [[0.42, 0.1], [0.26, 0.12], [0.12, 0.14]] as Array<[number, number]>) {
      const c2 = Math.cos(span * (1 - k2)), s2 = Math.sin(span * (1 - k2));
      g.beginPath();
      g.moveTo(r0 * c, r0 * sn); g.lineTo(r1 * c, r1 * sn); g.lineTo(r1 * c2, r1 * s2); g.lineTo(r0 * c2, r0 * s2);
      g.closePath();
      g.fillStyle = css(hex('#4a4262'), a);
      g.fill();
    }
    // The nosing, caught in the light.
    g.strokeStyle = css(mix(k.fill, [255, 253, 247], 0.8), 0.95);
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(r0, 0.3); g.lineTo(r1, 0.3); g.stroke();
    if (look.family === 'timber') {
      for (const f of [0.36, 0.68]) seam(g, k.fill, r0 + 0.5, w * f * 0.55, r1 - 0.3, w * f);
    } else {
      g.strokeStyle = css(mix(k.fill, hex('#5a4e5e'), 0.25), 0.4);
      g.lineWidth = 0.18;
      g.beginPath(); g.moveTo(r0 + (r1 - r0) * 0.55, 0.6); g.lineTo(r0 + (r1 - r0) * 0.62, w * 0.85); g.stroke();
    }
  };
}

/** Tread `i`: a wedge from the post to its outer end, its top `i + 1` risers up, a nosing proud; stone thick enough to rest on the one under it. */
function treadFaces(look: Look, i: number, turn: number): Face[] {
  const a0 = angleAt(i / N, turn), a1 = angleAt((i + 1) / N, turn);
  const z1 = (i + 1) * RISE;
  const zb = z1 - (look.family === 'stone' ? RISE * 1.7 : 1.4);
  const ARC = 3;
  const ring = (z: number): V3[] => {
    const pts: V3[] = [polar(R_IN, a0, z)];
    for (let k = 0; k <= ARC; k++) pts.push(polar(R_OUT, a0 + ((a1 - a0) * k) / ARC, z));
    pts.push(polar(R_IN, a1, z));
    return pts;
  };
  const o = polar(0, a0, z1);
  const radial: V3 = [Math.cos(a0), Math.sin(a0), 0];
  // Round the way it climbs: from the nosing toward the back edge.
  const round = unit(sub(polar(1, a1, 0), polar(1, a0, 0)));
  const across: V3 = sub(round, mul(radial, round[0] * radial[0] + round[1] * radial[1]));
  const w = R_OUT * Math.abs(a1 - a0);
  return prism([ring(zb), ring(z1)], look.edge, () => ({ crease: 0.35 }),
    { tone: look.tread, crease: 0.5, frame: { o, a: radial, b: unit(across) }, paint: treadPaint(look, R_IN, R_OUT, w, Math.abs(a1 - a0)) });
}

/** A stretch of the rail from `s0` to `s1` of the storey round, a section `RAIL_W` by `RAIL_T` swept along the helix; its end at `s1` capped where the rail ends there. */
function railFaces(look: Look, s0: number, s1: number, ends: boolean, turn: number): Face[] {
  const STEPS = 3;
  const rings: V3[][] = [];
  for (let k = 0; k <= STEPS; k++) {
    const s = s0 + ((s1 - s0) * k) / STEPS, a = angleAt(s, turn), z = railZ(s);
    rings.push([polar(RAIL_R - RAIL_W / 2, a, z - RAIL_T), polar(RAIL_R + RAIL_W / 2, a, z - RAIL_T), polar(RAIL_R + RAIL_W / 2, a, z), polar(RAIL_R - RAIL_W / 2, a, z)]);
  }
  const faces = prism(rings, look.rail, () => ({ crease: 0.25 }));
  // `prism` caps the last ring; the first is capped too, so a stretch seen end on, where the rail turns toward the eye, is solid.
  const first = rings[0];
  let n = newell(first);
  if (dot(n, sub(centre(first), centre(rings[1]))) < 0) n = mul(n, -1);
  faces.push({ pts: first.slice(), n, tone: look.rail, crease: ends ? 0.3 : 0 });
  return faces;
}

/** A baluster up from tread `i`'s outer end to the rail; a newel post at an end of the rail, from the tread to over the rail. */
function balusterFaces(look: Look, share: number, z0: number, post: boolean, turn: number): Face[] {
  const a = angleAt(share, turn), c = polar(RAIL_R, a, 0);
  const top = railZ(share) - RAIL_T * 0.5;
  if (post) {
    const r = 1.25;
    return [
      ...slab(c[0] - r, c[0] + r, c[1] - r, c[1] + r, z0, top + 1.6, look.post, { bevel: 0.5 }),
      ...lathe(c[0], c[1], [[top + 1.6, 0.9], [top + 2.6, 1.1], [top + 3.3, 0.5]], 8, look.cap),
    ];
  }
  const r = look.family === 'stone' && look.baluster !== IRON_TONE ? 0.55 : 0.32;
  return lathe(c[0], c[1], [[z0, r], [top, r]], 6, look.baluster);
}

/** The post a storey up: a turned column of the stone or a post of timber, a plinth at its foot at the bottom of a stack, and on up past the head at its top. */
function postFaces(look: Look, s: SpiralStack): Face[] {
  const top = s.above ? H : H + POST_UP;
  const r = R_IN;
  const sides = look.family === 'stone' ? 12 : 8;
  const faces = lathe(0, 0, s.above ? [[0, r], [top, r]] : [[0, r], [top - 1.2, r], [top, r * 1.18]], sides, look.post, 0.5);
  // A run that goes on into the post of the storey over it has no top of its own.
  const shaft = s.above ? faces.slice(0, faces.length - 1) : faces;
  if (s.below) return shaft;
  const p = r + 1.4;
  return [...slab(-p, p, -p, p, 0, 2.2, look.cap, { bevel: 0.7, corner: 0.6 }), ...shaft];
}

/** A rune in gold, cut into a face of the cap. */
function runePaint(look: Look): (g: Ctx, k: PaintCtx, s: Side) => void {
  return (g, k, s) => {
    const x = s.w / 2, y = s.h / 2, size = Math.min(s.w, s.h) * 0.36;
    cut(g, k.fill, size * 0.3, () => glyphPath(g, look.rune, x, y, size));
    glyphPath(g, look.rune, x, y, size);
    g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.15));
    g.lineWidth = size * 0.2;
    g.stroke();
  };
}

/** The cap on the top of the post: a block with a rune cut in each face, under a low pyramid with a gold knop. */
function capFaces(look: Look): Face[] {
  const z0 = H + POST_UP, c = CAP_W / 2;
  const rune = runePaint(look);
  return [
    ...slab(-c, c, -c, c, z0, z0 + CAP_H, look.cap, { bevel: 0.45, paint: { back: rune, right: rune, front: rune, left: rune } }),
    ...prism([[[-c + 0.3, -c + 0.3, z0 + CAP_H], [c - 0.3, -c + 0.3, z0 + CAP_H], [c - 0.3, c - 0.3, z0 + CAP_H], [-c + 0.3, c - 0.3, z0 + CAP_H]],
      [[-0.35, -0.35, z0 + CAP_H + 1.6], [0.35, -0.35, z0 + CAP_H + 1.6], [0.35, 0.35, z0 + CAP_H + 1.6], [-0.35, 0.35, z0 + CAP_H + 1.6]]], look.cap),
    ...lathe(0, 0, [[z0 + CAP_H + 1.6, 0.55], [z0 + CAP_H + 2.3, 0.75], [z0 + CAP_H + 2.9, 0.2]], 8, { lit: hex('#ffe7a8'), shade: hex('#b48c4c') }),
  ];
}

const modelKey = (look: Look, part: SpiralPart, i: number, s: SpiralStack, turn: number): string =>
  `${look.key}|${part}|${i}|${part === 'tread' || part === 'cap' ? '' : `${s.below ? 1 : 0}${s.above ? 1 : 0}`}|${turn.toFixed(3)}`;

const models = new Map<string, Face[]>();
function modelOf(look: Look, part: SpiralPart, i: number, s: SpiralStack, turn: number): Face[] {
  const key = modelKey(look, part, i, s, turn);
  let m = models.get(key);
  if (m) return m;
  if (part === 'tread') m = treadFaces(look, i, turn);
  else if (part === 'post') m = postFaces(look, s);
  else if (part === 'cap') m = capFaces(look);
  else {
    m = [];
    const z0 = (i + 1) * RISE;
    if (railed(i, s)) {
      // Over its own tread; a run starts and ends on a post at the middle of its first and last.
      const first = !s.below && i === OPEN, last = !s.above && i === N - 1 - OPEN;
      m.push(...railFaces(look, (i + (first ? 0.5 : 0)) / N, (i + (last ? 0.5 : 1)) / N, last, turn));
      m.push(...balusterFaces(look, (i + 0.5) / N, z0, first || last, turn));
    }
  }
  if (models.size > 4000) models.clear();
  models.set(key, m);
  return m;
}

/* ---- where they go ------------------------------------------------------------------------- */

/** A spiral staircase on a tile, as it is drawn: what of it, its foot's height, and its place in its stack. */
export interface SpiralFlight {
  material: string;
  dye?: string;
  x: number;
  y: number;
  /** Its storey (the floor slot it fills): a storey's foot is the one under it. */
  level: number;
  /** The height of its foot: the floor of the storey under it. */
  foot: number;
  stack: SpiralStack;
  /** How far round it is turned from `SPIRAL_START` (`spiralTurn`). */
  turn: number;
  /** Only its head: the treads under the floor of the storey it climbs to (a storey pinned over it). */
  headOnly?: boolean;
}

/** What the renderer gives: its camera, turned and zoomed. */
export interface SpiralFrame {
  rotation: number;
  sx: (wx: number, wy: number) => number;
  sy: (wx: number, wy: number, h: number) => number;
}

/** A piece of a flight on the screen. */
export interface SpiralPieceAt {
  fl: SpiralFlight;
  part: SpiralPart;
  i: number;
  /** Where the tile's middle is on the screen at the flight's foot. */
  sx: number;
  sy: number;
  /** What it sorts by among what stands on its line (`spiralKey`). */
  key: number;
}

/** A hair a storey: a storey's pieces after the storey's under them at the same spot. */
const STOREY_KEY = 0.01;

/**
 * What a spot `(wx, wy)` on a spiral staircase's tile sorts by on storey
 * `level`: its place on the screen at the height `h` of the tile's foot,
 * nearer the eye the more, and a hair more a storey up.
 */
export function spiralKey(f: SpiralFrame, wx: number, wy: number, h: number, level: number): number {
  return f.sy(wx, wy, h) + level * STOREY_KEY;
}

/** Where a piece's middle is, round the tile, in tiles from its middle. */
function pieceSpot(part: SpiralPart, i: number, turn: number): [number, number] {
  if (part === 'post' || part === 'cap') return [0, 0];
  const a = angleAt((i + 0.5) / N, turn);
  const r = part === 'rail' ? RAIL_R / U : SPIRAL_WALK;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** The pieces of a flight, each with its key. `h` is the height its keys are taken at, the same for every storey of the stack. */
export function spiralPieces(fl: SpiralFlight, f: SpiralFrame, h: number): SpiralPieceAt[] {
  const cx = fl.x + 0.5, cy = fl.y + 0.5;
  const sx = f.sx(cx, cy), sy = f.sy(cx, cy, fl.foot);
  const out: SpiralPieceAt[] = [];
  const add2 = (part: SpiralPart, i: number, after = 0): void => {
    const [dx, dy] = pieceSpot(part, i, fl.turn);
    out.push({ fl, part, i, sx, sy, key: spiralKey(f, cx + dx, cy + dy, h, fl.level) + after });
  };
  const from = fl.headOnly ? N - 4 : 0;
  for (let i = from; i < N; i++) {
    add2('tread', i, -0.002);
    if (railed(i, fl.stack)) add2('rail', i);
  }
  if (!fl.headOnly) add2('post', 0, -0.001);
  if (!fl.stack.above) add2('cap', 0, 0.001);
  return out;
}

/* ---- baking -------------------------------------------------------------------------------- */

interface Sheet { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }
const kept = new Map<string, Sheet>();
let keptArea = 0;
const BUDGET = 8e6;
const area = (s: Sheet): number => s.canvas.width * s.canvas.height;
function keep(key: string, s: Sheet): void {
  kept.set(key, s);
  keptArea += area(s);
  for (const [k, old] of kept) {
    if (keptArea <= BUDGET) break;
    if (k === key) continue;
    kept.delete(k);
    keptArea -= area(old);
  }
}

/** The ink every piece is ruled round in: the kit's warm grey-brown, a step browner for timber. */
const INK_STONE: RGB = mix(STONE_INK, hex('#5a3a30'), 0.25);
const INK_TIMBER: RGB = mix(STONE_INK, hex('#5a3a30'), 0.55);

function bake(faces: readonly Face[], e: Eye, scale: number, ink: RGB): Sheet {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) for (const q of f.pts) {
    const [x, y] = proj(e, q);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x0 === Infinity) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
  x0 = Math.floor(x0 - 2); y0 = Math.floor(y0 - 2); x1 = Math.ceil(x1 + 2); y1 = Math.ceil(y1 + 2);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  drawFaces(g, e, faces, 0.6, ink);
  return { canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Bake statistics, for a harness. */
export const spiralBakes = { count: 0, ms: 0 };

/** Draw a piece at its place: its picture at this scale, made now if the frame has time for it, else another scale's while it waits. */
export function drawSpiralPiece(ctx: CanvasRenderingContext2D, p: SpiralPieceAt, zoom: number, rotation: number): void {
  const look = spiralLook(p.fl.material, p.fl.dye);
  const { e, key: vk } = kitEyeOfTurn(rotation);
  const scale = scaleFor(zoom);
  const base = `${modelKey(look, p.part, p.i, p.fl.stack, p.fl.turn)}|${vk}`;
  const key = `${base}|${scale}`;
  let sh = kept.get(key);
  if (sh) { kept.delete(key); kept.set(key, sh); }
  else if (kitIsSync() || kitMayBake()) {
    const t0 = performance.now();
    sh = bake(modelOf(look, p.part, p.i, p.fl.stack, p.fl.turn), e, scale, look.family === 'timber' ? INK_TIMBER : INK_STONE);
    keep(key, sh);
    const ms = performance.now() - t0;
    spiralBakes.count++;
    spiralBakes.ms += ms;
    kitBaked(ms);
  } else {
    for (const s2 of BAKE_STEPS) {
      const other = kept.get(`${base}|${s2}`);
      if (other) { sh = other; break; }
    }
    if (!sh) {
      sh = bake(modelOf(look, p.part, p.i, p.fl.stack, p.fl.turn), e, scale, look.family === 'timber' ? INK_TIMBER : INK_STONE);
      keep(key, sh);
    }
  }
  ctx.drawImage(sh.canvas, p.sx + sh.x * zoom, p.sy + sh.y * zoom, sh.w * zoom, sh.h * zoom);
}

/** Where the cap's runes are on the screen, for their light at night: the middle of the cap, and how big it is drawn. */
export function spiralCapGlow(p: SpiralPieceAt, zoom: number, rotation: number): { x: number; y: number; r: number } | null {
  if (p.part !== 'cap') return null;
  const { e } = kitEyeOfTurn(rotation);
  const [x, y] = proj(e, [0, 0, H + POST_UP + CAP_H / 2]);
  return { x: p.sx + x * zoom, y: p.sy + y * zoom, r: CAP_W * 2.6 * zoom };
}

/** A whole flight at once, its pieces in their order: where nothing stands among them (a ghost, a way down seen from up top). */
export function drawSpiralWhole(ctx: CanvasRenderingContext2D, fl: SpiralFlight, f: SpiralFrame, zoom: number): void {
  const ps = spiralPieces(fl, f, fl.foot).sort((a, b) => a.key - b.key);
  for (const p of ps) drawSpiralPiece(ctx, p, zoom, f.rotation);
}

/** The ring round its head a planned one is marked out by, on the screen: points round the outer ends of its treads at the storey it climbs to. */
export function spiralOutline(fl: SpiralFlight, f: SpiralFrame): Array<[number, number]> {
  const cx = fl.x + 0.5, cy = fl.y + 0.5, h = fl.foot + H;
  return Array.from({ length: 24 }, (_, k) => {
    const a = (k / 24) * Math.PI * 2;
    const wx = cx + Math.cos(a) * SPIRAL_OUT, wy = cy + Math.sin(a) * SPIRAL_OUT;
    return [f.sx(wx, wy), f.sy(wx, wy, h)] as [number, number];
  });
}

/** The soft shade a stack throws on the floor round its foot: rings out to the treads' ends, toward the bottom right of the screen as every piece's is. */
export function spiralShade(ctx: CanvasRenderingContext2D, fl: SpiralFlight, f: SpiralFrame, zoom: number): void {
  const cx = fl.x + 0.5, cy = fl.y + 0.5;
  for (const [k, a] of [[1.08, 0.05], [0.95, 0.07], [0.75, 0.08]] as Array<[number, number]>) {
    ctx.beginPath();
    for (let j = 0; j <= 24; j++) {
      const ang = (j / 24) * Math.PI * 2;
      const wx = cx + Math.cos(ang) * SPIRAL_OUT * k, wy = cy + Math.sin(ang) * SPIRAL_OUT * k;
      const x = f.sx(wx, wy) + 1.6 * zoom, y = f.sy(wx, wy, fl.foot) + 0.8 * zoom;
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(44, 74, 78, ${a})`;
    ctx.fill();
  }
}

/** Let go of every picture: for a harness timing them cold. */
export function forgetSpiralBakes(): void {
  kept.clear();
  keptArea = 0;
  models.clear();
}

