import { css, footShadow, glow, hex, mix, palOf, periodic, poly, ribbon, seeded, sparkle, wrap, CREAM, INK } from '../kit';
import type { SeamLook, Stud } from '../types';

/**
 * Coal: a thick dark seam, a deep plum-charcoal rather than black, split by
 * its cleat into two courses of glossy faceted blocks, each block cut like a
 * low pyramid so one facet takes the light and one falls into shade, with a
 * peacock sheen of lilac, sea-green and rose on the best of them. Lumps of
 * it stand up off the face. The thick dark band of blocks is the shape that
 * tells it from every vein; the gloss says it is worth the digging.
 */
const L = 4;
const PAL = palOf('#4a4258', { rim: 0.5, dark: 0.32, lit: 0.26, shine: 0.6 });
const EDGE = mix(PAL.rim, hex('#2a2333'), 0.5);
const GLOSS = mix(hex('#c4bde6'), CREAM, 0.35);
/** The peacock sheen: the tarnish that plays over a fresh face of coal. */
const SHEEN = ['#c9b4ff', '#9fe2d8', '#ffbcd9'].map(hex);

export const coal: SeamLook = {
  name: 'Coal seam',
  wash: hex('#6f6878'),
  pitch: 2.2,
  drift: 0.45,
  half: 0.33,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.045, [[1, 0.7], [2, 0.3]]);
    const wob = periodic(R, L, 0.03, [[3, 0.6], [5, 0.4]]);
    const w = (t: number): number => 0.185 + wob(t);
    const split = periodic(R, L, 0.025, [[2, 0.6], [5, 0.4]]);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.2 / px, 0.014);
    // A shadow in the stone along the seam, so it lies in the face.
    g.save();
    g.strokeStyle = css(INK, 0.28);
    g.lineWidth = 0.04;
    g.stroke(body);
    g.restore();
    g.fillStyle = css(EDGE);
    g.fill(body);
    g.save();
    g.clip(body);

    // The blocks: two courses, top and bottom of the cleat line, each cut into
    // lengths that add up to the strip's so the ends meet, laid like brickwork.
    const studs: Stud[] = [];
    // The lower course first, so a block of the upper one that runs the seam's whole depth lies over it.
    for (const row of [1, 0]) {
      const n = 11 + Math.floor(R() * 4);
      const cuts = Array.from({ length: n }, () => 0.45 + R() * 1.3);
      const sum = cuts.reduce((a, b) => a + b, 0);
      let t = row ? R() * 0.15 : 0;
      for (let i = 0; i < n; i++) {
        const len = (cuts[i] / sum) * L;
        const tone = R();
        const e = [R(), R(), R(), R()].map((k) => (k - 0.5) * 0.035);
        const apex = [0.3 + R() * 0.25, 0.3 + R() * 0.2];
        const sheen = R() < 0.4 ? Math.floor(R() * 3) : -1;
        const deep = row === 0 && R() < 0.3;
        const glint = R() < 0.25;
        const cx = t + len / 2;
        if (row === 0 && i % 7 === 3) studs.push({ t: cx, n: mid(cx) - w(cx) * 0.8, kind: studs.length % 3 });
        wrap(L, cx, len, (c) => {
          const x0 = c - len / 2, x1 = c + len / 2 - 0.012;
          const m0 = mid(x0), m1 = mid(x1);
          // Top and bottom of this course at each end of the block, out past the seam's edge (the clip trims it).
          const yt0 = row ? m0 + split(x0) + 0.008 : m0 - w(x0) - 0.03;
          const yt1 = row ? m1 + split(x1) + 0.008 : m1 - w(x1) - 0.03;
          const yb0 = row || deep ? m0 + w(x0) + 0.03 : m0 + split(x0) - 0.008;
          const yb1 = row || deep ? m1 + w(x1) + 0.03 : m1 + split(x1) - 0.008;
          const A = [x0 + e[0], yt0], B = [x1 + e[1], yt1], C = [x1 + e[2], yb1], D = [x0 + e[3], yb0];
          // The apex of the block's low pyramid, toward the light (up and left).
          const ax = x0 + (x1 - x0) * apex[0], ay = (yt0 + yt1) / 2 + ((yb0 + yb1) / 2 - (yt0 + yt1) / 2) * apex[1];
          const base = tone < 0.4 ? PAL.dark : PAL.body;
          g.fillStyle = css(base);
          g.beginPath();
          poly(g, [...A, ...B, ...C, ...D]);
          g.fill();
          // Facets: top in the light, left half-lit, right and bottom in shade.
          g.fillStyle = css(sheen >= 0 ? mix(PAL.lit, SHEEN[sheen], 0.4) : PAL.lit);
          g.beginPath();
          poly(g, [ax, ay, ...A, ...B]);
          g.fill();
          g.fillStyle = css(mix(base, PAL.lit, 0.35));
          g.beginPath();
          poly(g, [ax, ay, ...D, ...A]);
          g.fill();
          g.fillStyle = css(PAL.dark);
          g.beginPath();
          poly(g, [ax, ay, ...B, ...C]);
          g.fill();
          if (sheen >= 0) {
            // The sheen running into the next colour across the lit facet.
            const gr = g.createLinearGradient(A[0], A[1], B[0], B[1]);
            gr.addColorStop(0, css(SHEEN[sheen], 0.7));
            gr.addColorStop(1, css(SHEEN[(sheen + 1) % 3], 0.6));
            g.fillStyle = gr;
            g.beginPath();
            poly(g, [ax, ay, ...A, ...B]);
            g.fill();
          }
          // The gloss: a bright line just under the top edge, the way a glassy face throws back the sky.
          g.strokeStyle = css(GLOSS, 0.85);
          g.lineWidth = line;
          g.beginPath();
          g.moveTo(A[0] + (ax - A[0]) * 0.25 + 0.01, A[1] + (ay - A[1]) * 0.25);
          g.lineTo(B[0] + (ax - B[0]) * 0.25 - 0.01, B[1] + (ay - B[1]) * 0.25);
          g.stroke();
          g.strokeStyle = css(EDGE);
          g.lineWidth = line * 1.2;
          g.beginPath();
          poly(g, [...A, ...B, ...C, ...D]);
          g.stroke();
          if (glint) sparkle(g, ax - 0.01, ay - 0.01, 0.035, CREAM, 0.9);
        });
        t += len;
      }
    }
    g.restore();
    g.strokeStyle = css(EDGE);
    g.lineWidth = line * 1.3;
    g.stroke(body);
    return studs;
  },
  studs: {
    w: 0.44,
    h: 0.42,
    ax: 0.5,
    ay: 0.8,
    kinds: 3,
    from: 0.9,
    draw(g, kind, px) {
      const R = seeded(kind * 433 + 5);
      const line = Math.max(1 / px, 0.014);
      footShadow(g, 0, 0, 0.15, 0.38);
      // A glossy angular lump: a ring of corners round a high point, each facet lit by how much it faces the screen's top.
      const k = 6 + (kind % 2);
      const rx = 0.15 + kind * 0.01, ry = 0.13;
      const cy = -ry * 0.95;
      const pts: number[] = [];
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + (R() - 0.5) * 0.4;
        const r = 0.82 + R() * 0.3;
        pts.push(Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * (Math.sin(a) > 0 ? 0.85 : 1));
      }
      const hx = -rx * 0.1, hy = cy + ry * 0.25;
      g.lineJoin = 'round';
      g.beginPath();
      poly(g, pts);
      g.strokeStyle = css(EDGE);
      g.lineWidth = line * 1.6;
      g.stroke();
      const sheen = SHEEN[kind % 3];
      for (let i = 0; i < k; i++) {
        const j = (i + 1) % k;
        const fx = (pts[i * 2] + pts[j * 2]) / 2 - hx, fy = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2 - hy;
        const lit = -fy * 1.0 - fx * 0.45;
        const col = lit > 0.025 ? mix(mix(PAL.lit, GLOSS, 0.25), sheen, i % 2 ? 0.55 : 0.25) : lit > -0.03 ? mix(PAL.body, PAL.lit, 0.4) : PAL.dark;
        g.fillStyle = css(col);
        g.beginPath();
        poly(g, [hx, hy, pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1]]);
        g.fill();
      }
      // The facet edges, faintly, and the gloss along the top.
      g.strokeStyle = css(EDGE, 0.6);
      g.lineWidth = line * 0.8;
      g.beginPath();
      for (let i = 0; i < k; i++) {
        g.moveTo(hx, hy);
        g.lineTo(pts[i * 2], pts[i * 2 + 1]);
      }
      g.stroke();
      glow(g, hx - 0.01, hy - 0.02, 0.07, GLOSS, 0.55);
      sparkle(g, hx - 0.02, hy - 0.025, 0.07, CREAM, 0.95);
    },
  },
};
