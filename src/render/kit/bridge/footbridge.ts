import { BRIDGES } from '../../../game/bridges';
import { byRole, U, type BridgePainter, type BridgeStyle, type Builders, type Kit, type L } from './core';
import { grainPaint } from './base';
import { bar, finfo, lay, pyramid, sq, tone, type Fc } from './plank';
import { edgesAt, ownsPost, rest, sweep } from './rope';
import { css, hex, mix } from '../core';

/**
 * The garden footbridge (`BRIDGES.footbridge`): one tile of deck arched over
 * a ditch or a stream (`deckArch`), its boards laid edge to edge across two
 * arched stringers, a lacquered post at each corner with a gilded cap, and a
 * top rail and a low rail between each two, arched with the deck. Its top
 * rails glow at night.
 *
 * As many boards as its bill has planks and as many posts as it has shafts:
 * built, the stringers from the first; the boards laid from end a's side as
 * the planks go in; the posts stood as the shafts do; the rails last.
 *
 * The boards' tops are the deck (`Plan.deck`, its arch included), where a
 * body walking it stands (`deckWalk`).
 */

const FB = {
  board: tone('#e8cea6', '#84707c'),
  beam: tone('#e8cca6', '#76606e'),
  lacquer: tone('#f4d0c2', '#9a6c76'),
  cap: tone('#ffd890', '#a4745a'),
};

const bill = new Map(BRIDGES.footbridge.bill);
/** Boards across its deck, one a plank of its bill; posts, one a shaft. */
const BOARDS = bill.get('plank') ?? 10;
const POSTS = bill.get('shaft') ?? 4;
const BOARD_T = 1.0;
/** How far in from an outer edge the boards end, and the stringers run, in tiles. */
const BOARD_IN = 0.085;
const STRINGER_IN = 0.13;
const STRINGER_W = 1.1;
/** The posts: how far in from each end and each outer edge in tiles, their half width in units, how high over the deck. */
const POST_END = 0.065;
const POST_IN = 0.042;
const POST_W = 1.25;
const POST_H = 8.6;
/** The rails: the top one's top and the low one's, over the deck, their depths and half widths in units. */
const TOP_RAIL = 7.4;
const TOP_D = 1.1;
const LOW_RAIL = 3.4;
const LOW_D = 0.8;
const RAIL_W = 0.55;
const EPS = 1e-6;

/** Of a tile being built, how many boards are laid and how many posts stood, off how much of its planks and shafts are in. */
const share = (f: Record<string, number>, id: string): number => Math.max(0, Math.min(1, f[id] ?? 0));
const laid = (f: Record<string, number>): number => Math.floor(share(f, 'plank') * BOARDS + 1e-9);
const stood = (f: Record<string, number>): number => Math.floor(share(f, 'shaft') * POSTS + 1e-9);

/** The outer edges a slice has: where its posts and rails stand across the bridge, which piece they go in and their order there (`edgesAt`). */
const edgesOf = (k: Kit): ReturnType<typeof edgesAt> => edgesAt(k, POST_IN);

/** The two arched stringers under the boards, deepest where they rest on the banks, resting on the ground where it comes up to them. */
function stringers(k: Kit): void {
  const { plan, sl } = k;
  const W = STRINGER_W / U;
  for (const t of [plan.tLo + STRINGER_IN, plan.tHi - STRINGER_IN, ...plan.lanes.slice(0, -1).map((o) => o + 0.5)]) {
    if (t + W < sl.t0 - EPS || t - W > sl.t1 + EPS) continue;
    const top = (s: number): number => plan.deck(s) - BOARD_T;
    const bot = rest(k, t, (s) => top(s) - 2.2 - 1.6 * (1 - Math.sin(Math.PI * Math.min(1, s / plan.n))), top);
    sweep(k, 'front', -1.5, sl.s0, sl.s1, t - W, t + W, top, bot, FB.beam, 'beam', 1 / 16);
  }
}

/**
 * The first `m` boards from end a's side, laid edge to edge: one solid arched with the deck, a facet a board, a
 * seam painted between each two (`seamPaint`).
 */
function boards(k: Kit, m: number): void {
  const { plan, sl } = k;
  if (m <= 0) return;
  const xs = Array.from({ length: m + 1 }, (_, q) => sl.i + q / BOARDS);
  const top = plan.deck, ta = plan.tLo + BOARD_IN, tb = plan.tHi - BOARD_IN;
  const faces: Fc[] = xs.slice(0, -1).map((a, q) => {
    const b = xs[q + 1];
    return {
      pts: [[a, ta, top(a)], [b, ta, top(b)], [b, tb, top(b)], [a, tb, top(a)]] as L[], out: [0, 0, 1] as L, tone: FB.board,
      info: finfo('deck', 0, (tb - ta) * U, 0, (b - a) * U, sl.i * BOARDS + q), frame: { o: [a, ta, top(a)] as L, a: [0, 1 / U, 0] as L, b: [1 / U, 0, (top(b) - top(a)) / U] as L },
    };
  });
  const rev = xs.slice().reverse();
  for (const [t, out] of [[tb, 1], [ta, -1]] as Array<[number, number]>) faces.push({ pts: [...xs.map((x): L => [x, t, top(x) - BOARD_T]), ...rev.map((x): L => [x, t, top(x)])], out: [0, out, 0], tone: FB.board });
  for (const [x, out] of [[xs[0], -1], [xs[m], 1]] as Array<[number, number]>) faces.push({ pts: [[x, ta, top(x) - BOARD_T], [x, tb, top(x) - BOARD_T], [x, tb, top(x)], [x, ta, top(x)]], out: [out, 0, 0], tone: FB.board });
  lay(k, 'front', 0.5, faces, 'st');
}

/** A board's grain along it, and the seam at its edge toward end a: the gap to the board before it. */
const seamPaint: BridgePainter = (g, k, f, st) => {
  grainPaint(g, k, f, st);
  const w = Math.abs(f.x1 - f.x0);
  g.strokeStyle = css(mix(k.fill, hex('#5a4048'), 0.55), 0.85);
  g.lineWidth = 0.35;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.stroke();
};

/** Where the corner posts stand along the bridge, end a's first. */
const postS = (n: number): number[] => [POST_END, n - POST_END];

/** The first `stood` of the corner posts, end a's two first; each down beside its stringer, a cap and a gilded knob on it. */
function posts(k: Kit, stood: number): void {
  const { plan } = k;
  const W = POST_W / U;
  let q = 0;
  for (const s of postS(plan.n)) {
    for (const edge of [-1, 1]) {
      if (q++ >= stood) continue;
      const it = edgesOf(k).find((x) => x.edge === edge);
      if (!it || !ownsPost(k, it.part, s - W, s + W)) continue;
      const d = plan.deck(s);
      const z0 = Math.max(d - BOARD_T - 3, Math.min(d - BOARD_T, plan.ground(s, it.t)));
      const o = it.order;
      lay(k, it.part, o, bar([s, it.t, z0], [s, it.t, d + POST_H], sq(POST_W), FB.lacquer, { paint: 'post' }), '');
      lay(k, it.part, o + 0.001, [...bar([s, it.t, d + POST_H], [s, it.t, d + POST_H + 0.7], sq(POST_W + 0.35), FB.lacquer), ...pyramid(s, it.t, d + POST_H + 0.7, POST_W + 0.35, 1.5, FB.cap)], '');
    }
  }
}

/** The rails between each edge's two posts, from one post's face to the other's, arched with the deck; the top one glowing. */
function rails(k: Kit): void {
  const { plan } = k;
  const [pa, pb] = postS(plan.n);
  const W = POST_W / U;
  const sa = pa + W, sb = pb - W;
  const R = RAIL_W / U;
  for (const { t, part, edge, order: o } of edgesOf(k)) {
    sweep(k, part, o, sa, sb, t - R, t + R, (s) => plan.deck(s) + TOP_RAIL, (s) => plan.deck(s) + TOP_RAIL - TOP_D, FB.lacquer, 'rail', 1 / 16);
    sweep(k, part, o, sa, sb, t - R * 0.8, t + R * 0.8, (s) => plan.deck(s) + LOW_RAIL, (s) => plan.deck(s) + LOW_RAIL - LOW_D, FB.lacquer, 'rail', 1 / 16);
    const line: L[] = [];
    for (let q = 0; q <= 12; q++) { const s = sa + ((sb - sa) * q) / 12; line.push([s, t + (edge * R), plan.deck(s) + TOP_RAIL - 0.4]); }
    k.glow.lines.push(line.map((p) => k.m(p)));
  }
}

/** Lacquer: smooth, a soft sheen down the middle of each face. */
const lacquerPaint: BridgePainter = (g, k, f) => {
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1), y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  g.fillStyle = css(mix(k.fill, [255, 246, 236], 0.28), 0.45);
  g.fillRect(x0 + (x1 - x0) * 0.35, y0, (x1 - x0) * 0.18, y1 - y0);
  g.strokeStyle = css(mix(k.fill, hex('#5a3040'), 0.3), 0.3);
  g.lineWidth = 0.12;
  g.strokeRect(x0 + 0.15, y0 + 0.15, Math.max(0, x1 - x0 - 0.3), Math.max(0, y1 - y0 - 0.3));
};

const build: Partial<Builders> = {
  deck(k) { stringers(k); boards(k, BOARDS); },
  trestle() {},
  parapet(k, edge) {
    if (edge !== k.sl.edges[0]) return;
    posts(k, POSTS);
    rails(k);
  },
  ends() {},
  refuges() {},
  /** As its bill goes in: the stringers; boards as the planks go in; posts as the shafts do. */
  unfinished(k) {
    const f = k.plan.fitted[k.sl.i] ?? {};
    stringers(k);
    boards(k, laid(f));
    posts(k, stood(f));
  },
};

export const footbridge: BridgeStyle = {
  family: 'timber',
  stone: FB.beam,
  ring: FB.beam,
  trim: FB.beam,
  deck: FB.board,
  post: FB.lacquer,
  rail: FB.lacquer,
  parapet: 'rail',
  rune: 'wave',
  glow: '#ffd9a0',
  paint: byRole({ deck: seamPaint, beam: grainPaint, post: lacquerPaint, rail: lacquerPaint }),
  build,
  stage: (f) => `${laid(f)}|${stood(f)}`,
};
