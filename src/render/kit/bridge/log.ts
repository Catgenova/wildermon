import { css, hex, mix, proj, TAU, type Tone } from '../core';
import { U, byRole, turned, type BridgePainter, type Kit, type L, type Part3 } from './core';
import { timberBase, grainPaint } from './base';
import { bar, carpentry, clothPaint, finfo, lay, ownNear, pennant, ringsPaint, rnd, roundRune, tone, type Carpentry, type Fc, type RailSpec } from './plank';

/**
 * Log: a trestle of round logs (posts, cap logs, stringers and braces all in
 * the round, their cut ends showing their rings), a deck of split poles laid
 * across, and rope rails hung between round posts. Its runes are cut in log
 * roundels pegged to the outer stringers, one a bay.
 */

const LOG = {
  bark: tone('#b89270', '#5e4a5c'),
  beam: tone('#c49c74', '#64505e'),
  end: tone('#f2dcb0', '#a68e86'),
  deck: tone('#d8b88c', '#7e6870'),
  post: tone('#a8825e', '#56445a'),
  rope: tone('#efdcae', '#8c7468'),
  roundel: tone('#9a7660', '#4e3c4c'),
};

/** Split poles across the deck: each its own round, lit along one side and shaded along the other. */
const polesPaint: BridgePainter = (g, k, f) => {
  const w = 2.6;
  const y0 = Math.min(f.y0, f.y1) - 1, y1 = Math.max(f.y0, f.y1) + 1;
  const lite = css(mix(k.fill, [255, 248, 230], 0.28), 0.7), dark = css(mix(k.fill, hex('#4a3640'), 0.5), 0.85), mid = css(mix(k.fill, hex('#6e5060'), 0.16), 0.5);
  let i = 0;
  for (let x = Math.floor(Math.min(f.x0, f.x1) / w) * w; x < Math.max(f.x0, f.x1); x += w, i++) {
    g.fillStyle = mid;
    g.fillRect(x + w * 0.62, y0, w * 0.38, y1 - y0);
    g.fillStyle = lite;
    g.fillRect(x + w * 0.12, y0, w * 0.22, y1 - y0);
    g.strokeStyle = dark;
    g.lineWidth = 0.24;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    if ((i * 7 + f.seed) % 5 === 0) { g.fillStyle = dark; g.beginPath(); g.ellipse(x + w * 0.5, y0 + (y1 - y0) * (((i * 37 + f.seed) % 10) / 10), 0.4, 0.25, 0, 0, TAU); g.fill(); }
  }
};

/** The poles' cut ends along the deck's edge, in a row. */
const poleEndsPaint: BridgePainter = (g, k, f) => {
  const w = 2.6;
  const h = Math.abs(f.y1 - f.y0);
  const r = Math.min(w, h) * 0.46;
  for (let x = Math.floor(Math.min(f.x0, f.x1) / w) * w + w / 2; x < Math.max(f.x0, f.x1) + w; x += w) {
    g.beginPath();
    g.ellipse(x, h / 2, w * 0.47, r, 0, 0, TAU);
    g.fillStyle = css(mix(hex('#f2dcb0'), k.fill, 0.35), 0.95);
    g.fill();
    g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.5), 0.8);
    g.lineWidth = 0.2;
    g.stroke();
    g.beginPath(); g.arc(x, h / 2, r * 0.4, 0, TAU);
    g.strokeStyle = css(mix(k.fill, hex('#7a5a48'), 0.35), 0.5);
    g.lineWidth = 0.12;
    g.stroke();
  }
};

/** Bark: long streaks down a log, and a knot now and then. */
const barkPaint: BridgePainter = (g, k, f, st) => grainPaint(g, k, f, st);

/** The rope from one post to the next, hanging. */
function rope(k: Kit, part: Part3, a: L, b: L, zs: number[], sag: number): void {
  const reach: L[] = [[a[0], a[1], a[2] + Math.max(...zs) + 1], [b[0], b[1], b[2] + Math.min(...zs) - sag - 1]];
  k.loose(part, (g, e) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const zo of zs) {
      g.beginPath();
      for (let q = 0; q <= 8; q++) {
        const f = q / 8;
        const p: L = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + zo - sag * 4 * f * (1 - f)];
        const [x, y] = proj(e, k.m(p));
        if (q) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.strokeStyle = css(hex('#6a5048'));
      g.lineWidth = 1.9;
      g.stroke();
      g.strokeStyle = css(LOG.rope.lit);
      g.lineWidth = 0.9;
      g.stroke();
      // Its lashing round the post at each end.
      for (const p of [a, b]) {
        const [x, y] = proj(e, k.m([p[0], p[1], p[2] + zo]));
        g.beginPath(); g.moveTo(x - 1.5, y - 0.4); g.lineTo(x + 1.5, y + 0.4);
        g.strokeStyle = css(hex('#6a5048'));
        g.lineWidth = 2.6;
        g.stroke();
        g.strokeStyle = css(LOG.rope.lit);
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  }, reach, 2.6);
}

const logRail: RailSpec = {
  H: 8.5,
  spacing: 0.5,
  inset: 0.045,
  // A round post, its top cut to a blunt point.
  post: (s, t, z) => [...bar([s, t, z], [s, t, z + 8.4], rnd(1.4, 6), LOG.post), ...cone(s, t, z + 8.4, 1.4, 1.3, 6, LOG.post)],
  run: (k, part, _order, a, b, posts) => {
    for (let i = 0; i + 1 < posts.length; i++) {
      const pa: L = lerp(a, b, posts[i]), pb: L = lerp(a, b, posts[i + 1]);
      if (!ownNear(k, Math.min(pa[0], pb[0]), Math.max(pa[0], pb[0]))) continue;
      rope(k, part, pa, pb, [7.6, 4.3], 1.5);
    }
    // The glow runs along the upper rope, as straight as the eye allows at night.
    const { sl } = k;
    const lo = Math.max(Math.min(a[0], b[0]), sl.s0), hi = Math.min(Math.max(a[0], b[0]), sl.s1);
    if (Math.abs(b[0] - a[0]) < 1e-6) { if (a[0] >= sl.s0 && a[0] <= sl.s1) k.glow.lines.push([k.m([a[0], a[1], a[2] + 7.2]), k.m([b[0], b[1], b[2] + 7.2])]); }
    else if (hi > lo) {
      const at = (s: number): L => { const f = (s - a[0]) / (b[0] - a[0]); return [s, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + 7.0]; };
      k.glow.lines.push([k.m(at(lo)), k.m(at(hi))]);
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
  post: 2.1,
  stringer: 2.6,
  stringerW: 2.6,
  cap: 2.2,
  brace: 1.0,
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
    key: roundRune('thurisaz'),
    lamp: clothPaint('thurisaz'),
  }),
  build: carpentry(logCarpentry),
});
