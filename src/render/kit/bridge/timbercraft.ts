import { RUNE_GOLD } from '../../runestone';
import { css, faceColour, hex, mix, nail, proj } from '../core';
import { BRIDGE_INK, U, byRole, type BridgePainter, type Kit, type L, type Part3 } from './core';
import { timberBase, grainPaint } from './base';
import { bar, bars, bentOf, carpentry, clothPaint, fascia, finfo, lay, ownNear, pennant, plankPlaque, plaquePaint, sq, tone, type Carpentry, type Fc, type RailSpec } from './plank';

/**
 * Timbercraft: a moon bridge's carving -- over each bay a laminated arch of
 * two curved ribs tied by blocks, spandrel posts up from it to the beam and
 * a rune plaque at its crown -- with painted rails, short balusters between
 * them, and onion caps carved on every post.
 */

const TC = {
  post: tone('#b88e74', '#5e485a'),
  beam: tone('#c9a27e', '#665060'),
  rib: tone('#f0dcb6', '#9c8486'),
  rail: tone('#f4b4a8', '#9a6478'),
  railDeep: tone('#e89c92', '#8a5670'),
  gold: tone('#f6dc98', '#a2805c'),
  plaque: tone('#6f7fa0', '#3a4260'),
  deck: tone('#e8b690', '#8a5e6c'),
};

/**
 * An onion cap carved on a post, its point up: as it is round, the same from
 * every side, so drawn as its outline -- gold, lit down its left, shaded down
 * its right, inked round -- rather than built of faces. Its profile in units: [up, out].
 */
const ONION: ReadonlyArray<[number, number]> = [[0, 1.05], [0.5, 1.2], [1.0, 0.95], [1.9, 1.75], [2.9, 1.4], [3.7, 0.6], [4.6, 0]];
function onion(k: Kit, part: Part3, s: number, t: number, z: number, scale: number, order: number): void {
  const r = 1.8 * scale / U;
  k.loose(part, (g, e) => {
    const rx = Math.hypot(e.ux, e.vx);
    const [cx] = proj(e, k.m([s, t, z]));
    const pts = ONION.map(([h, w]) => [w * scale * rx, proj(e, k.m([s, t, z + h * scale]))[1]] as [number, number]);
    const outline = (): void => {
      g.beginPath();
      pts.forEach(([w, y], i) => (i ? g.lineTo(cx + w, y) : g.moveTo(cx + w, y)));
      for (let i = pts.length - 2; i >= 0; i--) g.lineTo(cx - pts[i][0], pts[i][1]);
      g.closePath();
    };
    g.lineJoin = 'round';
    outline();
    g.strokeStyle = css(BRIDGE_INK);
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = css(faceColour(TC.gold, 0.9));
    g.fill();
    // Its right half in shade, its left lit.
    g.beginPath();
    g.moveTo(cx, pts[0][1]);
    pts.forEach(([w, y]) => g.lineTo(cx + w, y));
    g.closePath();
    g.fillStyle = css(faceColour(TC.gold, 0.72), 0.85);
    g.fill();
    g.beginPath();
    pts.slice(1, -1).forEach(([w, y], i) => (i ? g.lineTo(cx - w * 0.55, y) : g.moveTo(cx - w * 0.55, y)));
    g.strokeStyle = 'rgba(255, 250, 232, 0.8)';
    g.lineWidth = 0.6 * scale;
    g.stroke();
  }, [[s - r, t - r, z], [s + r, t + r, z + 4.8 * scale]], order);
}

const tcRail: RailSpec = {
  H: 9,
  spacing: 0.5,
  inset: 0.035,
  post: (s, t, z) => bar([s, t, z], [s, t, z + 9.6], sq(1.2), TC.railDeep, { caps: [false, true] }),
  top: (k, part, order, s, t, z) => onion(k, part, s, t, z + 9.6, 1, order),
  run: (k, part, order, a, b) => {
    bars(k, part, order, a, b, [
      { z: 8.6, sec: sq(1.15, 0.6), tone: TC.rail, role: 'rail' },
      { z: 5.0, sec: sq(0.5, 0.6), tone: TC.rail },
      { z: 1.1, sec: sq(0.55, 0.5), tone: TC.rail },
    ], 9.1);
    // Short balusters between the bottom rail and the middle.
    const { sl } = k;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 0.16));
    const faces: Fc[] = [];
    for (let j = 1; j < n; j++) {
      const f = j / n;
      const p: L = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      if (p[0] < sl.s0 - 1e-6 || p[0] >= sl.s1 - 1e-6) continue;
      faces.push(...bar([p[0], p[1], p[2] + 1.5], [p[0], p[1], p[2] + 4.5], sq(0.4), TC.railDeep));
    }
    lay(k, part, order - 0.05, faces, '');
  },
};

/**
 * The arch over each bay, on each outer face: two ribs on one centre, the
 * upper meeting the beam at its crown and both dying into the bent posts,
 * blocks between them, spandrel posts from the upper to the beam, and a rune
 * plaque at the crown.
 */
function arches(k: Kit, c: Carpentry): void {
  const { plan, sl } = k;
  const w = c.post / U;
  for (const bay of plan.bays) {
    if (bay.s1 < sl.s0 - 0.01 || bay.s0 > sl.s1 + 0.01) continue;
    const p0 = plan.piers.find((p) => Math.abs(p.s - bay.s0) < 1e-6)!, p1 = plan.piers.find((p) => Math.abs(p.s - bay.s1) < 1e-6)!;
    const sA = bentOf(k, c, p0).s + w, sB = bentOf(k, c, p1).s - w;
    const cA = (sA + sB) / 2, A = ((sB - sA) / 2) * U;
    const base = (s: number): number => plan.deck(s) - plan.thick - 2 * c.stringer - 0.2;
    for (const edge of sl.edges) {
      const te = edge > 0 ? sl.t1 : sl.t0;
      let g = Infinity;
      for (let q = 0; q <= 6; q++) g = Math.min(g, plan.ground(sA + ((sB - sA) * q) / 6, te));
      const rise = Math.min(A * 0.5, base(cA) - g - 3);
      if (rise < 6) continue;
      const R = (A * A + rise * rise) / (2 * rise);
      const zc = base(cA) - R;
      const slope = (base(sB) - base(sA)) / (sB - sA);
      const hw = 1.25 / U;
      const tr = te + edge * 0.02;
      const at = (r: number, th: number, t: number): L => {
        const s = cA + (r * Math.sin(th)) / U;
        return [s, t, zc + r * Math.cos(th) + slope * (s - cA)];
      };
      const ord = k.ord(edge, -1.4);
      // The far face's ribs are seen only from inside: their inner faces.
      const near = edge === sl.near;
      // The far face only its upper rib: the lower one's feet, seen from inside past the near posts, are slivers.
      const ribs: Array<[number, number]> = near ? [[R, R - 2.6], [R - 4.6, R - 7]] : [[R, R - 2.6]];
      for (const [ro, ri] of ribs) {
        const th0 = Math.asin(Math.min(1, A / ri)), th1 = Math.asin(Math.min(1, A / ro));
        const N = 12;
        const faces: Fc[] = [];
        for (let j = 0; j < N; j++) {
          // The outer edge runs to the post at th1, the inner at th0: each a curve of N steps.
          const fa = -1 + (2 * j) / N, fb = -1 + (2 * (j + 1)) / N;
          const oa = at(ro, fa * th1, tr + edge * hw), ob = at(ro, fb * th1, tr + edge * hw), ia = at(ri, fa * th0, tr + edge * hw), ib = at(ri, fb * th0, tr + edge * hw);
          const oa2 = at(ro, fa * th1, tr - edge * hw), ob2 = at(ro, fb * th1, tr - edge * hw), ia2 = at(ri, fa * th0, tr - edge * hw), ib2 = at(ri, fb * th0, tr - edge * hw);
          const segLen = Math.hypot((ob[0] - oa[0]) * U, ob[2] - oa[2]);
          const mm = ((fa + fb) / 2) * (th0 + th1) / 2;
          faces.push({ pts: [oa, ob, ib, ia], out: [0, edge, 0], tone: TC.rib, info: finfo('ring', 0, segLen, 0, ro - ri, j), frame: { o: ia, a: [Math.cos(mm) / U, 0, -Math.sin(mm)], b: [Math.sin(mm) / U, 0, Math.cos(mm)] } });
          faces.push({ pts: [oa2, ob2, ib2, ia2], out: [0, -edge, 0], tone: TC.rib });
          if (!near) continue;
          // Its ends against the posts.
          if (j === 0) faces.push({ pts: [oa, ia, ia2, oa2], out: [-1, 0, 0], tone: TC.rib });
          if (j === N - 1) faces.push({ pts: [ob, ib, ib2, ob2], out: [1, 0, 0], tone: TC.rib });
          const mo = ((fa + fb) / 2) * th1, mi = ((fa + fb) / 2) * th0;
          faces.push({ pts: [oa, ob, ob2, oa2], out: [Math.sin(mo) / U, 0, Math.cos(mo)], tone: TC.rib });
          faces.push({ pts: [ia, ib, ib2, ia2], out: [-Math.sin(mi) / U, 0, -Math.cos(mi)], tone: TC.rib });
        }
        lay(k, 'front', ord, faces, 's');
      }
      // Blocks between the ribs.
      const thB = Math.asin(Math.min(1, A / (R - 2.6)));
      for (const f of near ? [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75] : []) {
        const th = f * thB;
        lay(k, 'front', ord - 0.02, bar(at(R - 2.4, th, tr), at(R - 4.8, th, tr), sq(1.0, 0.9), TC.beam), 's');
      }
      // Spandrel posts from the upper rib to the beam.
      for (const f of [-0.78, -0.5, 0.5, 0.78]) {
        const s = cA + (f * A) / U;
        const x = (s - cA) * U;
        const zr = zc + Math.sqrt(Math.max(0, R * R - x * x)) + slope * (s - cA);
        if (base(s) - zr < 2 || s < sl.s0 - 1e-6 || s >= sl.s1 - 1e-6) continue;
        lay(k, 'front', ord + 0.02, bar([s, tr, zr - 0.5], [s, tr, base(s) + 0.2], sq(0.9), TC.beam, { paint: 'beam' }), '');
      }
      // The crown's plaque, over both ribs.
      if (cA + 0.12 >= sl.s0 && cA - 0.12 <= sl.s1) plankPlaque(k, 'front', ord + 0.1, cA, tr + edge * hw, zc + R - 3.4, edge, ownNear(k, cA - 0.08, cA + 0.08), TC.plaque, 'ingwaz', 3.4, 4.4);
    }
  }
}

/** The rib's face: a carved groove along its middle, gold studs at its joints. */
const ribPaint: BridgePainter = (g, k, f) => {
  const y = (f.y1 - f.y0) / 2;
  g.strokeStyle = css(mix(k.fill, hex('#5a4050'), 0.4), 0.75);
  g.lineWidth = 0.28;
  g.beginPath(); g.moveTo(f.x0, y); g.lineTo(f.x1, y); g.stroke();
  g.strokeStyle = css(mix(k.fill, [255, 250, 236], 0.5), 0.55);
  g.lineWidth = 0.14;
  g.beginPath(); g.moveTo(f.x0, y + 0.35); g.lineTo(f.x1, y + 0.35); g.stroke();
  if (f.seed % 4 === 0) { g.fillStyle = RUNE_GOLD; g.beginPath(); g.arc(0.6, y, 0.42, 0, Math.PI * 2); g.fill(); }
};

/** Painted wood: a soft sheen along it, no grain showing through. */
const paintedPaint: BridgePainter = (g, k, f) => {
  const h = Math.abs(f.y1 - f.y0);
  g.strokeStyle = css(mix(k.fill, [255, 250, 240], 0.35), 0.5);
  g.lineWidth = Math.max(0.12, h * 0.18);
  g.beginPath(); g.moveTo(f.x0, h * 0.72); g.lineTo(f.x1, h * 0.72); g.stroke();
};

/** The painted fascia: a gold line along it and a stud each board. */
const fasciaPaint: BridgePainter = (g, k, f) => {
  const h = Math.abs(f.y1 - f.y0);
  g.strokeStyle = css(hex(RUNE_GOLD), 0.85);
  g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(f.x0 - 1, h * 0.62); g.lineTo(f.x1 + 1, h * 0.62); g.stroke();
  for (let x = Math.ceil(f.x0 / 10) * 10; x < f.x1; x += 10) nail(g, hex('#f6dc98'), x, h * 0.3, 0.3);
};

/** The border boards: two laid along, painted, a gold line inlaid along the inner edge and a gold stud every half tile. */
const borderPaint: BridgePainter = (g, k, f) => {
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1), h = Math.max(Math.abs(f.y0), Math.abs(f.y1));
  g.strokeStyle = css(mix(k.fill, hex('#4a3048'), 0.45), 0.8);
  g.lineWidth = 0.22;
  g.beginPath(); g.moveTo(x0 - 1, h * 0.45); g.lineTo(x1 + 1, h * 0.45); g.stroke();
  g.strokeStyle = css(mix(k.fill, [255, 248, 236], 0.4), 0.55);
  g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(x0 - 1, h * 0.2); g.lineTo(x1 + 1, h * 0.2); g.stroke();
  g.strokeStyle = RUNE_GOLD;
  g.lineWidth = 0.42;
  g.beginPath(); g.moveTo(x0 - 1, h - 0.6); g.lineTo(x1 + 1, h - 0.6); g.stroke();
  for (let x = Math.ceil((x0 - 10) / 20) * 20 + 10; x < x1; x += 20) nail(g, hex('#f6dc98'), x, h * 0.72, 0.42);
};

/**
 * A lacquered herringbone floor: courses along the bridge, the short boards
 * in each laid on the slant one way and in the next the other, a dark joint
 * between courses, and a gloss streak down each.
 */
const herringbone: BridgePainter = (g, k, f) => {
  const B = 8, w = 2.8;
  const x0 = Math.min(f.x0, f.x1) - 1, x1 = Math.max(f.x0, f.x1) + 1;
  const y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  const slant = new Path2D(), course = new Path2D(), gloss = new Path2D();
  for (let yb = Math.floor(y0 / B) * B, q = Math.floor(y0 / B); yb < y1; yb += B, q++) {
    const d = q % 2 ? 1 : -1;
    for (let c = Math.floor((x0 - B) / w) * w; c < x1 + B; c += w) { slant.moveTo(c, yb); slant.lineTo(c + d * B, yb + B); }
    course.moveTo(x0, yb); course.lineTo(x1, yb);
    gloss.moveTo(x0, yb + B * 0.35); gloss.lineTo(x1, yb + B * 0.35);
  }
  g.strokeStyle = css(mix(k.fill, [255, 250, 240], 0.4), 0.35);
  g.lineWidth = 1.6;
  g.stroke(gloss);
  g.strokeStyle = css(mix(k.fill, hex('#5a3a48'), 0.35), 0.6);
  g.lineWidth = 0.16;
  g.stroke(slant);
  g.strokeStyle = css(mix(k.fill, hex('#4a3040'), 0.5), 0.85);
  g.lineWidth = 0.3;
  g.stroke(course);
};

const tcCarpentry: Carpentry = {
  round: false,
  post: 1.7,
  stringer: 2.2,
  stringerW: 1.2,
  cap: 1.4,
  brace: 1.1,
  noKnees: true,
  // Under the arches only tall splayed posts, a tie across the bent where two tiers meet; nothing along the faces.
  braces: 'none',
  noGirts: true,
  border: { w: 0.22, tone: tone('#c47a76', '#784860'), role: 'plinth' },
  postTone: () => TC.post,
  beamTone: () => TC.beam,
  rail: tcRail,
  newel: (k, part, s, t, z) => {
    lay(k, part, 3, bar([s, t, z], [s, t, z + 12], sq(2.1), TC.railDeep, { caps: [false, true], paint: 'rail' }), '');
    lay(k, part, 3.02, bar([s, t, z + 10.4], [s, t, z + 11.2], sq(2.5), TC.gold, { caps: [true, true] }), '');
    onion(k, part, s, t, z + 12, 1.7, 3.1);
  },
  plaque: () => {},
  more: (k) => arches(k, tcCarpentry),
  deckEdge: (k, edge, te) => fascia(k, edge, te, TC.railDeep, 'cornice'),
  banner: (k, part, s, t, z) => pennant(k, part, s, t, z, TC.railDeep, tone('#f8e2b0', '#a08068'), tone('#ffe7a4', '#e9b468')),
};

export const timbercraft = timberBase('timbercraft', {
  parapet: 'painted',
  truss: true,
  rune: 'ingwaz',
  post: TC.post,
  rail: TC.rail,
  ring: TC.beam,
  trim: TC.gold,
  deck: TC.deck,
  paint: byRole({
    deck: herringbone,
    tread: herringbone,
    beam: grainPaint,
    post: grainPaint,
    rail: paintedPaint,
    ring: ribPaint,
    cornice: fasciaPaint,
    plinth: borderPaint,
    key: plaquePaint('ingwaz', 3.4, 4.4),
    lamp: clothPaint('ingwaz'),
  }),
  build: carpentry(tcCarpentry),
});
