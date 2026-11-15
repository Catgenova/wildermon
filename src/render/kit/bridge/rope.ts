import { rand } from '../../ivy';
import { css, hex, mix, proj, type Tone } from '../core';
import { BRIDGE_INK, byRole, ownerOf, U, type BridgePainter, type BridgeStyle, type Builders, type Kit, type L, type Part3, type Role } from './core';
import { grainPaint } from './base';
import { finfo, lay, ownFar, plankPlaque, plaquePaint, rnd, tone, type Fc } from './plank';

/**
 * The rope bridge: plank slats across two stringers, a bearer under each
 * post, posts along its two outer edges at every tile's end, and two hand
 * ropes hung between them, sagging, knotted round each post and tied down to
 * the slats' ends by cords. A plaque on each end post carries its rune, which
 * glows at night: the bridge's only light, so a long one costs the night no
 * more than a short one.
 *
 * Built a tile of deck at a time as its bill goes in (`Plan.fitted`): the
 * posts, bearers and stringers from the first; the slats laid from end a's
 * side as the planks go in; the hand ropes strung as the rope goes in.
 *
 * The slats' tops are the deck (`Plan.deck`), where a body walking it stands
 * (`deckWalk`); nothing is laid over them.
 *
 * And what the garden footbridge (`footbridge.ts`) is built with too: a
 * member swept along the bridge under a curve (`sweep`) resting on the ground
 * where it comes up to it (`rest`), and where an outer edge's posts stand,
 * which piece they go in and which slice draws one on a cut (`edgesAt`,
 * `ownsPost`).
 */

const ROPE = {
  slat: tone('#e6c99c', '#7e6676'),
  beam: tone('#cfab84', '#58465c'),
  post: tone('#c4a07a', '#50425a'),
  rope: tone('#f4e2b6', '#927a6a'),
  plaque: tone('#dcbc90', '#6e5866'),
};

/** Slats a tile, how wide each is along the bridge in tiles, and how thick in units. */
const SLATS = 9;
const SLAT_W = 0.08;
const SLAT_T = 1.2;
/** How far in from an outer edge the slats end, in tiles. */
const SLAT_IN = 0.1;
/** The posts: how far in from an outer edge, their radius and an end post's, in units, and how high each stands over the deck. */
const POST_IN = 0.045;
const POST_R = 1.3;
const END_R = 1.7;
const POST_H = 10.5;
const END_H = 14;
/** The hand ropes: how high over the deck each is tied, and how far it sags at the middle of a tile. */
const ROPES: ReadonlyArray<{ z: number; sag: number }> = [{ z: 9.4, sag: 1.5 }, { z: 5.2, sag: 1.1 }];
/** The stringers: how far in from an outer edge, their half width and depth in units; a bearer's depth. */
const STRINGER_IN = 0.15;
const STRINGER_W = 1.1;
const STRINGER_H = 2.4;
const BEARER_H = 1.8;
/** How far a lashing stands proud of its post, in units. */
const KNOT = 0.45;
/** Tie cords a tile, from the top rope down to the slats' ends. */
const CORDS = 4;
const EPS = 1e-6;

/* ---- members ------------------------------------------------------------------------------------ */

/**
 * A member running along the bridge from `sa` to `sb`, across from `t0` to
 * `t1`, between `bot(s)` and `top(s)`, sampled every `step` tiles on a grid
 * from the bridge's start so its run is the same in every slice: two side
 * faces, its top, and its ends where it ends.
 */
export function sweep(k: Kit, part: Part3, order: number, sa: number, sb: number, t0: number, t1: number, top: (s: number) => number, bot: (s: number) => number,
  tn: Tone, role: Role, step = 0.125): void {
  const xs: number[] = [sa];
  for (let s = Math.floor(sa / step + 1 + EPS) * step; s < sb - EPS; s += step) xs.push(s);
  xs.push(sb);
  const rev = xs.slice().reverse();
  const faces: Fc[] = [];
  const len = (sb - sa) * U;
  for (const [t, out] of [[t1, 1], [t0, -1]] as Array<[number, number]>) {
    faces.push({
      pts: [...xs.map((s): L => [s, t, bot(s)]), ...rev.map((s): L => [s, t, top(s)])], out: [0, out, 0], tone: tn,
      info: finfo(role, 0, len, Math.min(...xs.map(bot)), Math.max(...xs.map(top)), Math.round(sa * 17 + t * 31)), frame: { o: [sa, t, 0], a: [1 / U, 0, 0], b: [0, 0, 1] },
    });
  }
  faces.push({ pts: [...xs.map((s): L => [s, t0, top(s)]), ...rev.map((s): L => [s, t1, top(s)])], out: [0, 0, 1], tone: tn });
  faces.push({ pts: [[sa, t0, bot(sa)], [sa, t1, bot(sa)], [sa, t1, top(sa)], [sa, t0, top(sa)]], out: [-1, 0, 0], tone: tn });
  faces.push({ pts: [[sb, t0, bot(sb)], [sb, t1, bot(sb)], [sb, t1, top(sb)], [sb, t0, top(sb)]], out: [1, 0, 0], tone: tn });
  lay(k, part, order, faces, 'st');
}

/** A board across the bridge from `ta` to `tb`, from `sa` to `sb` along it, its top on the deck's line (`top`) and `thick` deep. */
function board(k: Kit, part: Part3, order: number, sa: number, sb: number, ta: number, tb: number, top: (s: number) => number, thick: number, tn: Tone, seed: number): void {
  const za = top(sa), zb = top(sb);
  const faces: Fc[] = [
    {
      pts: [[sa, ta, za], [sb, ta, zb], [sb, tb, zb], [sa, tb, za]], out: [0, 0, 1], tone: tn,
      info: finfo('deck', 0, (tb - ta) * U, 0, (sb - sa) * U, seed), frame: { o: [sa, ta, za], a: [0, 1 / U, 0], b: [1 / U, 0, (zb - za) / U] },
    },
    { pts: [[sa, ta, za - thick], [sa, tb, za - thick], [sa, tb, za], [sa, ta, za]], out: [-1, 0, 0], tone: tn },
    { pts: [[sb, ta, zb - thick], [sb, tb, zb - thick], [sb, tb, zb], [sb, ta, zb]], out: [1, 0, 0], tone: tn },
    { pts: [[sa, ta, za - thick], [sb, ta, zb - thick], [sb, ta, zb], [sa, ta, za]], out: [0, -1, 0], tone: tn },
    { pts: [[sa, tb, za - thick], [sb, tb, zb - thick], [sb, tb, zb], [sa, tb, za]], out: [0, 1, 0], tone: tn },
  ];
  lay(k, part, order, faces, 'st');
}

/**
 * A round post at (s, t) from `z0` to `z1`, `r` units round, its top a low cone: in lengths between the lashings
 * round it (`bands`, low to high), so none of it stands inside one.
 */
function post(k: Kit, part: Part3, order: number, s: number, t: number, z0: number, z1: number, r: number, tn: Tone, bands: ReadonlyArray<[number, number]> = []): void {
  const ring = rnd(r, 7).map(([x, y]): [number, number] => [s + x / U, t + y / U]);
  const cuts = [z0, ...bands.flat(), z1];
  for (let c = 0; c + 1 < cuts.length; c += 2) {
    const a = cuts[c], b = cuts[c + 1];
    if (b - a < 1e-3) continue;
    const faces: Fc[] = ring.map(([x, y], i) => {
      const [x2, y2] = ring[(i + 1) % ring.length];
      const w = Math.hypot(x2 - x, y2 - y) * U;
      return {
        pts: [[x, y, a], [x2, y2, a], [x2, y2, b], [x, y, b]] as L[], out: [(x + x2) / 2 - s, (y + y2) / 2 - t, 0] as L, tone: tn,
        info: finfo('post', 0, w, z0, z1, Math.round(s * 13 + t * 7) + i), frame: { o: [x, y, 0] as L, a: [(x2 - x) / (w * U), (y2 - y) / (w * U), 0] as L, b: [0, 0, 1] as L },
      };
    });
    if (c + 2 === cuts.length) {
      const apex: L = [s, t, z1 + r * 0.8];
      ring.forEach(([x, y], i) => {
        const [x2, y2] = ring[(i + 1) % ring.length];
        faces.push({ pts: [[x, y, z1], [x2, y2, z1], apex], out: [(x + x2) / 2 - s, (y + y2) / 2 - t, 0.04], tone: tn });
      });
    }
    lay(k, part, order, faces, '');
  }
}

/** The lashing round a post at (s, t), `r` units round the post, from `z0` to `z1`: a band of rope turns. */
function knot(k: Kit, part: Part3, order: number, s: number, t: number, z0: number, z1: number, r: number, tn: Tone): void {
  const ring = rnd(r, 7).map(([x, y]): [number, number] => [s + x / U, t + y / U]);
  const faces: Fc[] = ring.map(([x, y], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    const w = Math.hypot(x2 - x, y2 - y) * U;
    return {
      pts: [[x, y, z0], [x2, y2, z0], [x2, y2, z1], [x, y, z1]] as L[], out: [(x + x2) / 2 - s, (y + y2) / 2 - t, 0] as L, tone: tn,
      info: finfo('plinth', 0, w, z0, z1, i), frame: { o: [x, y, z0] as L, a: [(x2 - x) / (w * U), (y2 - y) / (w * U), 0] as L, b: [0, 0, 1] as L },
    };
  });
  faces.push({ pts: ring.map(([x, y]): L => [x, y, z1]), out: [0, 0, 1], tone: tn });
  lay(k, part, order, faces, '');
}

/** Rope turns round a lashing: close diagonal strokes, a dark groove and a lit twist each. */
const lashPaint: BridgePainter = (g, k, f) => {
  const w = Math.abs(f.x1 - f.x0), y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  const groove = new Path2D(), twist = new Path2D();
  for (let y = y0 - w; y < y1 + w; y += 0.55) {
    groove.moveTo(0, y); groove.lineTo(w, y + w * 0.5);
    twist.moveTo(0, y + 0.22); twist.lineTo(w, y + 0.22 + w * 0.5);
  }
  g.lineWidth = 0.16;
  g.strokeStyle = css(mix(k.fill, hex('#5a4048'), 0.5), 0.7);
  g.stroke(groove);
  g.lineWidth = 0.12;
  g.strokeStyle = css(mix(k.fill, [255, 248, 230], 0.45), 0.6);
  g.stroke(twist);
};

/** The plank's grain across a slat, and on about half of them a weathered edge. */
const slatPaint: BridgePainter = (g, k, f, st) => {
  grainPaint(g, k, f, st);
  const T = rand(f.seed * 7 + 3);
  g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.35), 0.35);
  if (T() < 0.5) g.fillRect(f.x0, f.y0, f.x1 - f.x0, 0.25);
};

/* ---- where things are --------------------------------------------------------------------------- */

/**
 * The outer edges a slice has: where its posts stand across the bridge, the piece what stands on it goes in, and its
 * order there -- the near edge's in the near parapet's piece, after the deck and anybody on it; the far edge's
 * before the deck, which hides it, and seen side on, where the tiles along the bridge stand side by side and either
 * may be laid first, in the piece behind everything under the deck, so the deck of every tile beside it is laid over
 * it; and seen end on, where neither edge is near, with the deck, after the slats, among each other by nearness.
 */
export const edgesAt = (k: Kit, inset: number): Array<{ edge: number; t: number; part: Part3; order: number }> => {
  const endOn = Math.abs(k.P[0] * k.e.toward[0] + k.P[1] * k.e.toward[1]) < 1e-6;
  const sideOn = Math.abs(k.A[0] * k.e.toward[0] + k.A[1] * k.e.toward[1]) < 1e-6;
  return k.sl.edges.map((edge) => {
    const t = edge > 0 ? k.plan.tHi - inset : k.plan.tLo + inset;
    if (edge === k.sl.near) return { edge, t, part: 'rail', order: 1.5 };
    if (endOn) return { edge, t, part: 'front', order: 0.6 };
    return sideOn ? { edge, t, part: 'back', order: 1.5 } : { edge, t, part: 'front', order: -2.5 };
  });
};
const edgesOf = (k: Kit): ReturnType<typeof edgesAt> => edgesAt(k, POST_IN);

/**
 * Whether this slice draws a post on an edge from `a` to `b` along the bridge, where it stands on a cut: on the near
 * edge the slice nearer the eye, after the deck under it; on a far edge the one further, so the nearer tile's deck is
 * laid over it.
 */
export const ownsPost = (k: Kit, part: Part3, a: number, b: number): boolean =>
  part === 'rail' ? ownerOf(k, Math.max(0, a), Math.min(k.plan.n, b)) !== null : ownFar(k, Math.max(0, a), Math.min(k.plan.n, b));

/** Where post `j` stands along the bridge (an end post inside its end's edge), and how thick it is. */
function postAt(n: number, j: number): { s: number; r: number; h: number; end: boolean } {
  if (j === 0) return { s: END_R / U + 0.004, r: END_R, h: END_H, end: true };
  if (j === n) return { s: n - END_R / U - 0.004, r: END_R, h: END_H, end: true };
  return { s: j, r: POST_R, h: POST_H, end: false };
}

/* ---- the builders -------------------------------------------------------------------------------- */

/** A member's underside `bot` resting on the ground at `t` where the ground comes up into it, never thinner than half a unit under its `top`. */
export const rest = (k: Kit, t: number, bot: (s: number) => number, top: (s: number) => number) => (s: number): number =>
  Math.min(top(s) - 0.5, Math.max(bot(s), k.plan.ground(s, t)));

/** The stringers along the deck, under the slats, on every outer edge and between every two lanes; a bearer across under each post. */
function frame(k: Kit): void {
  const { plan, sl } = k;
  const top = (s: number): number => plan.deck(s) - SLAT_T;
  const ts = [plan.tLo + STRINGER_IN, plan.tHi - STRINGER_IN, ...plan.lanes.slice(0, -1).map((o) => o + 0.5)];
  const W = STRINGER_W / U;
  for (const t of ts) {
    if (t + W < sl.t0 - EPS || t - W > sl.t1 + EPS) continue;
    sweep(k, 'front', -1.5, sl.s0, sl.s1, t - W, t + W, top, rest(k, t, (s) => top(s) - STRINGER_H, top), ROPE.beam, 'beam', 1);
  }
  // A bearer under each post, across the bridge between its two posts' inner faces.
  for (let j = 0; j <= plan.n; j++) {
    const p = postAt(plan.n, j);
    const w = 0.026;
    if (p.s + w < sl.s0 - EPS || p.s - w > sl.s1 + EPS) continue;
    const ta = plan.tLo + POST_IN + p.r / U, tb = plan.tHi - POST_IN - p.r / U;
    const z = (s: number): number => top(s) - STRINGER_H;
    if (z(p.s) - 0.4 < plan.ground(p.s, (ta + tb) / 2)) continue;
    sweep(k, 'front', -1.6, Math.max(0, p.s - w), Math.min(plan.n, p.s + w), ta, tb, z, rest(k, (ta + tb) / 2, (s) => z(s) - BEARER_H, z), ROPE.beam, 'beam', 1);
  }
}

/** The first `m` slats of the tile, from end a's side: the deck. */
function slats(k: Kit, m = SLATS): void {
  const { plan, sl } = k;
  for (let q = 0; q < m; q++) {
    const j = sl.i * SLATS + q;
    const T = rand(j * 2654435 + 977);
    const sc = sl.i + (q + 0.5) / SLATS + (T() - 0.5) * 0.008;
    const ta = plan.tLo + SLAT_IN + (T() - 0.5) * 0.014, tb = plan.tHi - SLAT_IN + (T() - 0.5) * 0.014;
    if (tb < sl.t0 - EPS || ta > sl.t1 + EPS) continue;
    board(k, 'front', 0.5, sc - SLAT_W / 2, sc + SLAT_W / 2, ta, tb, plan.deck, SLAT_T, ROPE.slat, j);
  }
}

/** The posts this slice draws on its outer edges (`ownsPost`), the lashings of the top `strung` ropes round them, and a plaque on each end post. */
function posts(k: Kit, strung: number): void {
  const { plan } = k;
  for (const { edge, t, part, order: o } of edgesOf(k)) {
    for (let j = 0; j <= plan.n; j++) {
      const p = postAt(plan.n, j);
      const w = p.r / U;
      if (!ownsPost(k, part, p.s - w, p.s + w)) continue;
      const d = plan.deck(p.s);
      const under = d - SLAT_T - STRINGER_H - BEARER_H;
      // An end post down into the bank where the bank is near, else down to its bearer.
      const g = p.end ? plan.ground(p.s, t) - 0.3 : Infinity;
      const z0 = g < under && g > under - 30 ? g : under;
      const bands = ROPES.slice(0, strung).map((r): [number, number] => [d + r.z - 0.9, d + r.z + 0.9]).sort((x, y) => x[0] - y[0]);
      post(k, part, o, p.s, t, z0, d + p.h, p.r, ROPE.post, bands);
      for (const [b0, b1] of bands) knot(k, part, o, p.s, t, b0, b1, p.r + KNOT, ROPE.rope);
      // On the post's outer face: after it where that looks toward the eye, before it where it looks away.
      const out = edge * (k.P[0] * k.e.toward[0] + k.P[1] * k.e.toward[1]) > 0 ? 0.01 : -0.01;
      if (p.end) plankPlaque(k, part, o + out, p.s, t + edge * (p.r / U), d + 12, edge, true, ROPE.plaque, RUNE, 1.5, 1.25);
    }
  }
}

/** The hand ropes of the tile, post to post on each outer edge, the top `strung` of them; and, finished, the cords tying the top one down. */
function ropes(k: Kit, strung: number, cords: boolean): void {
  const { plan, sl } = k;
  if (!strung) return;
  const a = postAt(plan.n, sl.i), b = postAt(plan.n, sl.i + 1);
  // From the lashing round one post to the lashing round the next.
  const sa = a.s + (a.r + KNOT + 0.4) / U, sb = b.s - (b.r + KNOT + 0.4) / U;
  const hung = ROPES.slice(0, strung);
  for (const { edge, t, part, order } of edgesOf(k)) {
    const at = (r: { z: number; sag: number }, f: number): L => {
      const s = sa + (sb - sa) * f;
      return [s, t, plan.deck(sa) + (plan.deck(sb) - plan.deck(sa)) * f + r.z - r.sag * 4 * f * (1 - f)];
    };
    const line = (r: { z: number; sag: number }): L[] => Array.from({ length: 13 }, (_, q) => at(r, q / 12));
    // The cords come down to the slats' ends.
    const tc = edge > 0 ? plan.tHi - SLAT_IN + 0.012 : plan.tLo + SLAT_IN - 0.012;
    const foot = (f: number): L => { const s = sa + (sb - sa) * f; return [s, tc, plan.deck(s) - SLAT_T * 0.5]; };
    const reach: L[] = [...hung.flatMap((r) => [at(r, 0), at(r, 0.5), at(r, 1)]), ...(cords ? [foot(0.2), foot(0.8)] : [])];
    k.loose(part, (g, e) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const rope = new Path2D(), cord = new Path2D();
      for (const r of hung) line(r).forEach((p, q) => { const [x, y] = proj(e, k.m(p)); if (q) rope.lineTo(x, y); else rope.moveTo(x, y); });
      if (cords) {
        for (let c = 1; c <= CORDS; c++) {
          const f = c / (CORDS + 1);
          const [x0, y0] = proj(e, k.m(at(ROPES[0], f)));
          const [x1, y1] = proj(e, k.m(foot(f)));
          cord.moveTo(x0, y0); cord.lineTo(x1, y1);
        }
      }
      // Inked as every edge of the kit is (`BRIDGE_INK`), the rope's own colour laid along it.
      const dark = css(BRIDGE_INK), lit = css(ROPE.rope.lit);
      g.strokeStyle = dark; g.lineWidth = 1.1; g.stroke(cord);
      g.strokeStyle = css(mix(ROPE.rope.lit, ROPE.rope.shade, 0.25)); g.lineWidth = 0.4; g.stroke(cord);
      g.strokeStyle = dark; g.lineWidth = 2.0; g.stroke(rope);
      g.strokeStyle = lit; g.lineWidth = 0.85; g.stroke(rope);
    }, reach, order);
  }
}

const RUNE = 'algiz';

const build: Partial<Builders> = {
  deck(k) { frame(k); slats(k); },
  trestle() {},
  parapet(k, edge) {
    // Both edges at once, on the first: posts and their ropes are laid round each other.
    if (edge !== k.sl.edges[0]) return;
    posts(k, ROPES.length);
    ropes(k, ROPES.length, true);
  },
  ends() {},
  refuges() {},
  /** A tile still to be built, as its bill goes in: posts, bearers and stringers; then slats as the planks go in; then the hand ropes as the rope does. */
  unfinished(k) {
    frame(k);
    const f = k.plan.fitted[k.sl.i] ?? {};
    slats(k, laid(f));
    posts(k, strung(f));
    ropes(k, strung(f), false);
  },
};

/** Of a tile being built, how many slats are laid and how many hand ropes strung, off how much of its planks and its rope are in. */
const share = (f: Record<string, number>, id: string): number => Math.max(0, Math.min(1, f[id] ?? 0));
const laid = (f: Record<string, number>): number => Math.floor(share(f, 'plank') * SLATS + 1e-9);
const strung = (f: Record<string, number>): number => Math.floor(share(f, 'thick_rope') * ROPES.length + 1e-9);

export const rope: BridgeStyle = {
  family: 'timber',
  stone: ROPE.beam,
  ring: ROPE.beam,
  trim: ROPE.beam,
  deck: ROPE.slat,
  post: ROPE.post,
  rail: ROPE.rope,
  parapet: 'rope',
  rune: RUNE,
  glow: '#ffd9a0',
  paint: byRole({
    deck: slatPaint,
    beam: grainPaint,
    post: grainPaint,
    plinth: lashPaint,
    key: plaquePaint(RUNE, 1.5, 1.25),
  }),
  build,
  stage: (f) => `${laid(f)}|${strung(f)}`,
};
