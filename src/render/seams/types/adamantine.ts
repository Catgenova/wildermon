import { css, footShadow, glow, halo, hex, mix, palOf, periodic, poly, rune, seeded, sparkle, wrap, CREAM, TAU } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, RGB, SeamLook, Stud } from '../types';

/**
 * Adamantine: a lode of dark indigo octahedra, hard-edged and packed tight in
 * a jagged split in the stone, a cold mint light in the fracture they grew
 * along and on their arrises, and the thorn rune cut beside it. The darkest
 * and hardest-looking of the rare four: every edge straight, nothing round.
 */
const L = 4;
const BED = palOf('#35315a', { dark: 0.25 });
const ORE = palOf('#6b70c8', { lit: 0.38, dark: 0.5, shine: 0.7 });
ORE.shine = hex('#d6fff4');
const MINT: RGB = hex('#8ff0dc');
const EDGE: RGB = mix(MINT, CREAM, 0.35);

/** The split the crystals grew in: a ribbon with straight-cut, jagged edges that comes back to itself after `L`. */
function jagged(R: () => number, mid: (t: number) => number, w: (t: number) => number, n: number): Path2D {
  const top: number[] = [];
  const bot: number[] = [];
  for (let i = 0; i < n; i++) top.push((R() - 0.5) * 0.05), bot.push((R() - 0.5) * 0.05);
  const p = new Path2D();
  const step = L / n;
  const lo = -3, hi = n + 3;
  for (let i = lo; i <= hi; i++) {
    const t = i * step + (i % 2 ? step * 0.3 : 0);
    const k = ((i % n) + n) % n;
    const y = mid(t) - Math.max(0.025, w(t) + top[k]);
    if (i === lo) p.moveTo(t, y);
    else p.lineTo(t, y);
  }
  for (let i = hi; i >= lo; i--) {
    const t = i * step + (i % 2 ? 0 : step * 0.3);
    const k = ((i % n) + n) % n;
    p.lineTo(t, mid(t) + Math.max(0.025, w(t) + bot[k]));
  }
  p.closePath();
  return p;
}

/**
 * An octahedron lying in the face, seen point on: a rhombus cut into four
 * facets from its apex, the upper-left in the light, the lower-right in
 * shade, and its upper arris picked out in mint.
 */
function octa(g: Ctx, x: number, y: number, r: number, ang: number, sq: number, line: number, pal: Pal): void {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (lx: number, ly: number): [number, number] => [x + lx * ca - ly * sq * sa, y + lx * sa + ly * sq * ca];
  const pts = [P(-r, 0), P(0, -r * 0.8), P(r, 0), P(0, r * 0.8)];
  const ap = P(-r * 0.12, -r * 0.1);
  g.beginPath();
  poly(g, pts.flat());
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line * 1.6;
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    const fy = (a[1] + b[1]) / 2 - y, fx = (a[0] + b[0]) / 2 - x;
    const lit = -fy * 0.85 - fx * 0.45;
    g.fillStyle = css(lit > r * 0.15 ? pal.lit : lit < -r * 0.15 ? pal.dark : pal.body);
    g.beginPath();
    g.moveTo(ap[0], ap[1]);
    g.lineTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fill();
  }
  // The arris that faces the light, in mint, and a point of shine at the apex.
  const top = pts[0][1] + pts[1][1] < pts[2][1] + pts[3][1] ? [pts[0], pts[1]] : [pts[2], pts[3]];
  g.strokeStyle = css(EDGE, 0.9);
  g.lineWidth = line;
  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  g.lineTo(top[1][0], top[1][1]);
  g.stroke();
  g.fillStyle = css(pal.shine);
  g.beginPath();
  g.arc(ap[0], ap[1], r * 0.14, 0, TAU);
  g.fill();
}

/**
 * An upright octahedron for a stud, its lower point sunk in the face at
 * (x, y): a bipyramid `w` across and `h` tall, four faces seen, lit from the
 * upper left, the arrises in mint.
 */
function bipyramid(g: Ctx, x: number, y: number, w: number, h: number, lean: number, pal: Pal, line: number): void {
  const eq = y - h * 0.42;
  const top: [number, number] = [x + lean * h, y - h];
  const bot: [number, number] = [x + lean * h * 0.1, y];
  const l: [number, number] = [x - w / 2 + lean * h * 0.42, eq];
  const f: [number, number] = [x + w * 0.1 + lean * h * 0.42, eq + w * 0.14];
  const r: [number, number] = [x + w / 2 + lean * h * 0.42, eq - w * 0.04];
  g.save();
  g.lineJoin = 'miter';
  g.beginPath();
  poly(g, [...bot, ...l, ...top, ...r]);
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line * 2;
  g.stroke();
  const face = (a: number[], c: RGB): void => {
    g.fillStyle = css(c);
    g.beginPath();
    poly(g, a);
    g.fill();
  };
  face([...l, ...top, ...f], pal.lit);
  face([...f, ...top, ...r], pal.body);
  face([...l, ...f, ...bot], pal.body);
  face([...f, ...r, ...bot], pal.dark);
  // A sliver of shine down the lit face and mint on the arrises toward the light.
  face([l[0] + (top[0] - l[0]) * 0.25, l[1] + (top[1] - l[1]) * 0.25, ...top, top[0] - (top[0] - l[0]) * 0.1 + w * 0.06, top[1] + h * 0.3], pal.shine);
  g.lineCap = 'round';
  g.strokeStyle = css(EDGE, 0.95);
  g.lineWidth = line;
  g.beginPath();
  g.moveTo(...l);
  g.lineTo(...top);
  g.lineTo(...f);
  g.lineTo(...bot);
  g.moveTo(...l);
  g.lineTo(...f);
  g.stroke();
  g.restore();
}

export const adamantine: SeamLook = {
  name: 'Adamantine vein',
  wash: hex('#8a90b8'),
  pitch: 1.9,
  drift: 0.4,
  half: 0.42,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.12]]);
    const wob = periodic(R, L, 0.03, [[2, 0.6], [3, 0.3], [5, 0.15]]);
    const w = (t: number): number => 0.115 + wob(t);
    const bed = jagged(R, mid, w, 40);
    const line = Math.max(1.1 / px, 0.012);
    halo(g, bed, MINT, 0.15, 0.62, px);
    // The split: an ink shadow just wider than it, the dark bed, its edge.
    g.save();
    g.strokeStyle = css(BED.rim, 0.38);
    g.lineWidth = 0.06;
    g.lineJoin = 'miter';
    g.stroke(bed);
    g.fillStyle = css(BED.dark);
    g.fill(bed);
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(bed);
    // The fracture they grew along: a zigzag of mint light down the bed.
    const zig: number[] = [];
    const nz = 28;
    for (let i = 0; i < nz; i++) zig.push((R() - 0.5) * 0.11);
    const crack = new Path2D();
    for (let i = -2; i <= nz + 2; i++) {
      const t = (i * L) / nz;
      const k = ((i % nz) + nz) % nz;
      const y = mid(t) + zig[k] * Math.max(0.3, w(t) / 0.115);
      if (i === -2) crack.moveTo(t, y);
      else crack.lineTo(t, y);
    }
    g.clip(bed);
    g.lineCap = 'round';
    g.strokeStyle = css(MINT, 0.3);
    g.lineWidth = 0.05;
    g.stroke(crack);
    g.strokeStyle = css(MINT, 0.85);
    g.lineWidth = line * 1.4;
    g.stroke(crack);
    g.restore();

    // The crystals: octahedra packed point to point down the split, big and small.
    const studs: Stud[] = [];
    const runeAt = R() * L;
    const runeSide = R() < 0.5 ? -1 : 1;
    const near = (t: number): boolean => Math.min(Math.abs(t - runeAt), Math.abs(t - runeAt - L), Math.abs(t - runeAt + L)) < 0.18;
    const xs: Array<{ t: number; dy: number; r: number; ang: number; sq: number; lit: boolean }> = [];
    let t = R() * 0.08;
    let i = 0;
    while (t < L - 0.05) {
      const ww = Math.max(0.04, w(t));
      const big = R() < 0.3;
      const r = (big ? 0.085 + R() * 0.03 : 0.045 + R() * 0.025) * Math.min(1.1, 0.6 + ww * 3.5);
      if (!near(t)) {
        const lit = i % 8 === 3;
        xs.push({ t, dy: (R() - 0.5) * ww * 0.9, r, ang: (R() - 0.5) * 1.1, sq: 0.62 + R() * 0.2, lit });
        if (lit) studs.push({ t, n: 0, kind: Math.floor(R() * 3) });
        i++;
      }
      t += r * (0.95 + R() * 0.45);
    }
    for (const c of xs) if (c.lit) wrap(L, c.t, 0.24, (x) => glow(g, x, mid(x), 0.22, MINT, 0.55));
    // Small ones first, so the big ones lie over them.
    xs.sort((a, b) => a.r - b.r);
    for (const c of xs) wrap(L, c.t, c.r * 1.3, (x) => octa(g, x, mid(x) + c.dy, c.r, c.ang, c.sq, line, ORE));
    // Glints of mint on the best of them.
    const glints: number[] = [];
    for (let k = 0; k < 6; k++) glints.push(R() * L, (R() - 0.5) * 0.12, 0.035 + R() * 0.025);
    for (let k = 0; k < glints.length; k += 3) {
      const gt = glints[k], gy = glints[k + 1], gr = glints[k + 2];
      wrap(L, gt, gr, (x) => sparkle(g, x, mid(x) + gy, gr, mix(MINT, CREAM, 0.5), 0.95));
    }
    wrap(L, runeAt, 0.2, (x) => {
      const y = mid(x) + runeSide * (w(x) + 0.085);
      glow(g, x, y, 0.13, MINT, 0.45);
      rune(g, 'thurisaz', x, y, 0.07, MINT, CREAM, runeSide * 0.15);
    });
    return studs;
  },
  studs: {
    w: 0.62,
    h: 0.7,
    ax: 0.5,
    ay: 0.78,
    kinds: 3,
    from: 0.9,
    twinkle: 0.3,
    draw(g, kind) {
      const R = seeded(kind * 131 + 5);
      g.save();
      g.translate(0, -0.15);
      g.scale(1, 0.85);
      glow(g, 0, 0, 0.29, MINT, 0.38);
      g.restore();
      footShadow(g, 0, 0, 0.15, 0.36);
      const line = 0.018;
      // A shard or two either side, then the big one in front.
      if (kind !== 1) bipyramid(g, -0.1, 0.015, 0.09, 0.15 + R() * 0.03, -0.35, ORE, line);
      if (kind !== 0) bipyramid(g, 0.11, 0.02, 0.1, 0.17 + R() * 0.03, 0.3, ORE, line);
      if (kind === 2) bipyramid(g, 0.03, 0.035, 0.07, 0.11, 0.1, ORE, line);
      bipyramid(g, kind === 1 ? -0.03 : 0.02, 0, 0.19 - kind * 0.015, 0.33 - kind * 0.025, (R() - 0.5) * 0.1, ORE, line);
      sparkle(g, kind === 1 ? -0.03 : 0.02, -0.33 + kind * 0.025, 0.065, EDGE, 0.95);
    },
  },
};
