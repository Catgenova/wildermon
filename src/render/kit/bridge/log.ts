import { css, hex, mix, proj, TAU, type Tone } from '../core';
import { U, byRole, turned, type BridgePainter, type Kit, type L, type Part3 } from './core';
import { timberBase } from './base';
import { bar, carpentry, clothPaint, finfo, lay, ownNear, pennant, ringsPaint, rnd, roundRune, tone, type Carpentry, type Fc, type RailSpec } from './plank';

/**
 * Log: a trestle of round logs (posts, cap logs, stringers and braces all in
 * the round, their cut ends showing their rings), a deck of split poles laid
 * across, and rope rails hung between round posts. Its runes are cut in log
 * roundels pegged to the outer stringers, one a bay.
 */

const LOG = {
  bark: tone('#bc9c7e', '#463850'),
  beam: tone('#c4a282', '#4c3e54'),
  end: tone('#f2dcb0', '#a68e86'),
  deck: tone('#d8b88c', '#7e6870'),
  post: tone('#9c7e66', '#4c3e56'),
  rope: tone('#efdcae', '#8c7468'),
  roundel: tone('#9a7660', '#4e3c4c'),
};

/**
 * Split poles across the deck, flat side down: each its own width, rounded
 * -- a dark gap, its shaded flank, its lit crown, its other flank -- with a
 * knot here and there and the bark left on its edges.
 */
const polesPaint: BridgePainter = (g, k, f) => {
  const y0 = Math.min(f.y0, f.y1) - 1, y1 = Math.max(f.y0, f.y1) + 1, h = y1 - y0;
  const gap = new Path2D(), flank = new Path2D(), crown = new Path2D(), bark = new Path2D(), knots = new Path2D();
  // Widths off where the pole is along the bridge, so the run carries on from slice to slice.
  const W = (i: number): number => 3.2 + ((i * 2654435761) % 7) * 0.3;
  let x = Math.floor(Math.min(f.x0, f.x1) / 40) * 40, i = Math.round(x / 40) * 16;
  for (; x < Math.max(f.x0, f.x1); i++) {
    const w = W(i & 1023);
    gap.rect(x, y0, 0.45, h);
    flank.rect(x + 0.45, y0, w * 0.22, h);
    flank.rect(x + w * 0.78, y0, w * 0.22, h);
    crown.rect(x + w * 0.36, y0, w * 0.2, h);
    // Bark left along a pole's edge in patches.
    for (let y = y0 + ((i * 37) % 11); y < y1; y += 13 + (i % 5) * 3) bark.rect(x + 0.45, y, w * 0.14, 3 + (i % 3));
    if ((i * 7) % 5 === 0) { const ky = y0 + h * (((i * 37) % 10) / 10); knots.moveTo(x + w * 0.5 + 0.45, ky); knots.ellipse(x + w * 0.5, ky, 0.45, 0.3, 0, 0, TAU); }
    x += w;
  }
  g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.22), 0.6);
  g.fill(flank);
  g.fillStyle = css(mix(k.fill, [255, 248, 230], 0.35), 0.75);
  g.fill(crown);
  g.fillStyle = css(mix(k.fill, hex('#5a4450'), 0.45), 0.6);
  g.fill(bark);
  g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.6), 0.9);
  g.fill(gap);
  g.fill(knots);
};

/** The poles' cut ends along the deck's edge, in a row. */
const poleEndsPaint: BridgePainter = (g, k, f) => {
  const w = 2.6;
  const h = Math.abs(f.y1 - f.y0);
  const r = Math.min(w, h) * 0.46;
  const ends = new Path2D(), rings = new Path2D();
  for (let x = Math.floor(Math.min(f.x0, f.x1) / w) * w + w / 2; x < Math.max(f.x0, f.x1) + w; x += w) {
    ends.moveTo(x + w * 0.47, h / 2);
    ends.ellipse(x, h / 2, w * 0.47, r, 0, 0, TAU);
    rings.moveTo(x + r * 0.4, h / 2);
    rings.arc(x, h / 2, r * 0.4, 0, TAU);
  }
  g.fillStyle = css(mix(hex('#f2dcb0'), k.fill, 0.35), 0.95);
  g.fill(ends);
  g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.5), 0.8);
  g.lineWidth = 0.2;
  g.stroke(ends);
  g.strokeStyle = css(mix(k.fill, hex('#7a5a48'), 0.35), 0.5);
  g.lineWidth = 0.12;
  g.stroke(rings);
};

/** Bark: deep fissures down a log, and plates between them a step paler. */
const barkPaint: BridgePainter = (g, k, f) => {
  const len = Math.abs(f.x1 - f.x0), h = Math.abs(f.y1 - f.y0);
  const x0 = Math.min(f.x0, f.x1);
  const fis = new Path2D(), plate = new Path2D();
  let q = f.seed * 13;
  for (let y = 0.5; y < h; y += 1.6) {
    for (let x = x0 + ((q * 7) % 5); x < x0 + len; x += 6 + (q % 5)) {
      q = (q * 1103515245 + 12345) & 0x7fffffff;
      const l = 2 + (q % 5);
      fis.moveTo(x, y); fis.lineTo(x + l, y + ((q >> 4) % 3 - 1) * 0.15);
      if (q % 3 === 0) plate.rect(x + 0.3, y + 0.2, l * 0.7, 0.5);
    }
  }
  g.fillStyle = css(mix(k.fill, [255, 246, 232], 0.25), 0.4);
  g.fill(plate);
  g.strokeStyle = css(mix(k.fill, hex('#3e2c38'), 0.5), 0.6);
  g.lineWidth = 0.22;
  g.stroke(fis);
};

/** The ropes hung between posts: each span from one post to the next, sagging, lashed round the post at each end; all of them one drawing. */
function ropes(k: Kit, part: Part3, spans: Array<[L, L]>, zs: number[], sag: number): void {
  if (!spans.length) return;
  const reach: L[] = spans.flatMap(([a, b]): L[] => [[a[0], a[1], a[2] + Math.max(...zs) + 1], [b[0], b[1], b[2] + Math.min(...zs) - sag - 1]]);
  k.loose(part, (g, e) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const line = new Path2D(), lash = new Path2D();
    for (const [a, b] of spans) {
      for (const zo of zs) {
        for (let q = 0; q <= 8; q++) {
          const f = q / 8;
          const [x, y] = proj(e, k.m([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + zo - sag * 4 * f * (1 - f)]));
          if (q) line.lineTo(x, y); else line.moveTo(x, y);
        }
        for (const p of [a, b]) {
          const [x, y] = proj(e, k.m([p[0], p[1], p[2] + zo]));
          lash.moveTo(x - 1.5, y - 0.4); lash.lineTo(x + 1.5, y + 0.4);
        }
      }
    }
    const dark = css(hex('#6a5048')), lit = css(LOG.rope.lit);
    g.strokeStyle = dark; g.lineWidth = 1.9; g.stroke(line);
    g.strokeStyle = lit; g.lineWidth = 0.9; g.stroke(line);
    g.strokeStyle = dark; g.lineWidth = 2.6; g.stroke(lash);
    g.strokeStyle = lit; g.lineWidth = 1.5; g.stroke(lash);
  }, reach, 2.6);
}

const logRail: RailSpec = {
  H: 8.5,
  spacing: 0.5,
  inset: 0.13,
  // A round post, its top cut to a blunt point.
  post: (s, t, z) => [...bar([s, t, z], [s, t, z + 8.4], rnd(1.5, 5), LOG.post), ...cone(s, t, z + 8.4, 1.5, 1.4, 5, LOG.post)],
  run: (k, part, _order, a, b, posts) => {
    const spans: Array<[L, L]> = [];
    for (let i = 0; i + 1 < posts.length; i++) {
      const pa: L = lerp(a, b, posts[i]), pb: L = lerp(a, b, posts[i + 1]);
      if (ownNear(k, Math.min(pa[0], pb[0]), Math.max(pa[0], pb[0]))) spans.push([pa, pb]);
    }
    ropes(k, part, spans, [7.6, 4.3], 1.5);
    // The glow runs along both ropes, sagging with them.
    for (const [pa, pb] of spans) for (const zo of [7.6, 4.3]) {
      const line: ReturnType<Kit['m']>[] = [];
      for (let q = 0; q <= 6; q++) {
        const f = q / 6;
        line.push(k.m([pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f, pa[2] + (pb[2] - pa[2]) * f + zo - 1.5 * 4 * f * (1 - f)]));
      }
      k.glow.lines.push(line);
    }
  },
};

/** A cone `n` sides round, `r` units at its foot at height `z`, rising `h`. */
function cone(s: number, t: number, z: number, r: number, h: number, n: number, tn: Tone): Fc[] {
  const ring = rnd(r, n).map(([x, y]): L => [s + x / U, t + y / U, z]);
  const apex: L = [s, t, z + h];
  return ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    return { pts: [a, b, apex], out: [(a[0] + b[0]) / 2 - s, (a[1] + b[1]) / 2 - t, 0.02], tone: tn };
  });
}

const lerp = (a: L, b: L, f: number): L => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/** A log roundel pegged on, its face toward `edge`. */
function roundel(k: Kit, part: Part3, order: number, s: number, t: number, z: number, edge: number, glow: boolean, glyph: string): void {
  const r = 4;
  const faces: Fc[] = bar([s, t - edge * 0.01, z], [s, t + edge * 0.012, z], rnd(r, 10), LOG.roundel, { caps: [false, true], capPaint: 'key', capTone: LOG.roundel });
  // The roundel's axis runs across the bridge: its face's frame turned so the rune stands upright.
  const cap = faces[faces.length - 1];
  cap.info = finfo('key', -r, r, -r, r, Math.round(s * 10));
  cap.frame = { o: [s, t + edge * 0.012, z], a: [edge > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] };
  for (const f of faces.slice(0, -1)) f.tone = LOG.bark;
  lay(k, part, order, faces, 's');
  const n = edge * (k.P[0] * k.e.toward[0] + k.P[1] * k.e.toward[1]);
  if (glow && n > 0) k.glow.runes.push({ at: k.m([s, t + edge * 0.012, z]), s: r * 0.5, glyph });
}

const logCarpentry: Carpentry = {
  round: true,
  post: 3.3,
  stringer: 3.1,
  stringerW: 3.1,
  cap: 3.1,
  brace: 2.1,
  braces: 'a',
  // Two tiers shored as one: a single pair of long shores the bent's height.
  tallX: true,
  // The stringers in the deck's shade, their bark left unpainted.
  stringerRole: null,
  noGirts: true,
  // On a ramp, a round log raking up each edge over the treads' ends, its rings at the bridge's ends.
  rampStringer: (k, edge, te) => {
    const { plan, sl } = k;
    const r = 3.2, tc = te - edge * (r / U - 0.01);
    const z = (s: number): number => plan.deck(s) + 0.8;
    lay(k, k.ord(edge, 1) < 0 ? 'front' : edge === sl.near ? 'rail' : 'front', k.ord(edge, 1), bar([sl.s0, tc, z(sl.s0)], [sl.s1, tc, z(sl.s1)], rnd(r, 7), LOG.bark,
      { caps: [sl.s0 <= 1e-6, sl.s1 >= plan.n - 1e-6], paint: 'beam', capTone: LOG.end, capPaint: 'plinth', seed: sl.i * 3 + edge }), '');
  },
  postTone: () => LOG.bark,
  beamTone: () => LOG.beam,
  endTone: LOG.end,
  rail: logRail,
  newel: (k, part, s, t, z) => {
    turned(k, part, s, t, z, [[0, 0.07], [12.5, 0.066], [13.2, 0.056], [14.2, 0.064], [16.6, 0]], 8, LOG.bark, 3);
    for (const zo of [7.4, 4.1]) turned(k, part, s, t, z + zo - 0.8, [[0, 0.074], [1.6, 0.074], [1.6, 0]], 8, LOG.rope, 3.05);
  },
  plaque: (k, part, order, s, t, z, edge, glow) => roundel(k, part, order, s, t - edge * 0.01, z - 0.6, edge, glow, 'thurisaz'),
  deckEdge: (k, edge, te) => {
    const { plan, sl } = k;
    const top = plan.deck;
    const len = (sl.s1 - sl.s0) * U;
    const to = te + edge * 0.008;
    const z0 = (s: number): number => top(s) - plan.thick, z1 = top;
    lay(k, 'front', 1, [{ pts: [[sl.s0, to, z0(sl.s0)], [sl.s1, to, z0(sl.s1)], [sl.s1, to, z1(sl.s1)], [sl.s0, to, z1(sl.s0)]], out: [0, edge, 0], tone: LOG.deck,
      info: finfo('cornice', sl.s0 * U, sl.s0 * U + len, 0, plan.thick, sl.i), frame: { o: [sl.s0, to, z0(sl.s0)], a: [1 / U, 0, 0], b: [0, 0, 1] } }], '');
    // A curb log along the edge on the poles, the rope posts lashed inside it, its cut ends at the bridge's.
    const r = 2.4, tc = te - edge * (r / U + 0.004);
    lay(k, edge === sl.near ? 'rail' : 'front', 1.2, bar([sl.s0, tc, top(sl.s0) + r * 0.9], [sl.s1, tc, top(sl.s1) + r * 0.9], rnd(r, 6), LOG.bark,
      { caps: [sl.s0 <= 1e-6, sl.s1 >= plan.n - 1e-6], paint: 'beam', capTone: LOG.end, capPaint: 'plinth', seed: sl.i * 3 + edge }), '');
  },
  banner: (k, part, s, t, z) => pennant(k, part, s, t, z, LOG.bark, tone('#cfe0b4', '#6f7f74'), tone('#ffe7a4', '#e9b468')),
};

export const log = timberBase('log', {
  parapet: 'rope',
  rune: 'thurisaz',
  post: LOG.bark,
  rail: LOG.rope,
  ring: LOG.beam,
  trim: LOG.end,
  deck: LOG.deck,
  paint: byRole({
    deck: polesPaint,
    tread: polesPaint,
    cornice: poleEndsPaint,
    beam: barkPaint,
    post: barkPaint,
    plinth: ringsPaint,
    key: roundRune('thurisaz', 4),
    lamp: clothPaint('thurisaz'),
  }),
  build: carpentry(logCarpentry),
});
