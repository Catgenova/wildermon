import { channel, css, footShadow, glow, hex, mix, palOf, periodic, poly, ribbon, seeded, sparkle, wrap, CREAM } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Lead: galena -- a heavy band of deep indigo slate crowded with chunky
 * cubes of a bright blue-steel metal, seen corner-on as little blocks with a
 * mirror-bright top and two shaded sides, some grown together into steps,
 * and the best standing up off the face as a stack. The cube is the shape
 * that tells it from tin's beads and zinc's blades; it is the darkest bed
 * of the common metals and the brightest, coldest shine.
 */
const L = 4;
const BED = palOf('#4f4f6c', { dark: 0.48, rim: 0.55 });
const ORE = palOf('#9ea3c8', { lit: 0.62, dark: 0.5, shine: 0.92, rim: 0.66 });
/** A galena face is a mirror: its top goes nearly white with a breath of blue. */
ORE.lit = mix(hex('#e0e5ff'), CREAM, 0.12);
ORE.body = hex('#9397b8');
ORE.dark = hex('#4f5179');
const STEEL = hex('#cfd8ff');
/** The top of a cube lying in the face: the mirror light, so each one reads as a cube and not a tile. */
const FACE = mix(hex('#e2e6ff'), CREAM, 0.15);
const FACE_SHADE = mix(FACE, hex('#8f94bd'), 0.42);
/** The sides of a cube lying in the face: darker than a standing one's, as they face down into the bed. */
const SIDE_L = hex('#6d7199');
const SIDE_D = hex('#41436a');

export const lead: SeamLook = {
  name: 'Lead vein',
  wash: hex('#868aa6'),
  pitch: 1.9,
  drift: 0.4,
  half: 0.31,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.05, [[1, 0.6], [3, 0.3]]);
    const wob = periodic(R, L, 0.03, [[2, 0.6], [5, 0.3]]);
    const w = (t: number): number => 0.105 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.012);
    channel(g, body, 0.028, 0.4);
    g.fillStyle = css(BED.dark);
    g.fill(body);
    // Grains of galena in the bed between the cubes.
    g.save();
    g.clip(body);
    for (let i = 0; i < 60; i++) {
      const t = R() * L, dy = (R() - 0.5) * 0.24, s = 0.008 + R() * 0.01;
      const col = css(R() < 0.5 ? ORE.dark : BED.body, 0.9);
      wrap(L, t, s, (x) => {
        g.fillStyle = col;
        g.fillRect(x - s, mid(x) + dy - s, s * 2, s * 2);
      });
    }
    g.restore();
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // The best of it stands up off the face as studs: four a strip, about a
    // tile apart give or take, so any stretch of vein has a couple showing.
    const studs: Stud[] = [];
    const NS = 5;
    for (let k = 0; k < NS; k++) {
      const t = ((k + 0.5 + (R() - 0.5) * 0.5) / NS) * L;
      const y = 0.02 + (R() - 0.5) * 0.03;
      studs.push({ t, n: mid(t) + y, kind: k % 3 });
      // A dark socket under it, so the bed is darkest where the stack stands.
      wrap(L, t, 0.1, (x) => {
        g.fillStyle = css(BED.rim, 0.6);
        g.beginPath();
        g.ellipse(x, mid(x) + y, 0.06, 0.045, 0, 0, Math.PI * 2);
        g.fill();
      });
    }
    const nearStud = (t: number): boolean => studs.some((st) => Math.abs(t - st.t) < 0.1 || Math.abs(t - st.t - L) < 0.1 || Math.abs(t - st.t + L) < 0.1);

    // The cubes lying in the face: clusters of two to four, odd sizes, with
    // gaps of dark bed between, and here and there one turned corner-up.
    let t = R() * 0.1;
    while (t < L) {
      const n = 2 + Math.floor(R() * 3);
      const span = 0.1 + n * 0.07;
      const cubes = Array.from({ length: n }, () => {
        const s = 0.058 + R() * 0.042;
        const up = R() < 0.3;
        return {
          dt: (R() - 0.5) * span,
          // A cube turned corner-up reaches further across, so it is a smaller one.
          s: up ? s * 0.78 : s,
          // Below the middle a little, as each cube is raised toward the top of the band.
          dy: 0.025 + (R() - 0.5) * 0.04,
          turn: up ? Math.PI / 4 + (R() - 0.5) * 0.3 : (R() - 0.5) * 0.5,
          glint: R() < 0.3,
        };
      });
      // Back to front: those higher up the band first, so the lower ones overlap them.
      cubes.sort((p, q) => p.dy - q.dy);
      const at = t + span / 2;
      if (!nearStud(at)) {
        wrap(L, at, span, (x) => {
          for (const c of cubes) {
            const cx = x + c.dt, cy = mid(cx) + c.dy;
            cube(g, cx, cy, c.s, c.turn, line, ORE);
            if (c.glint) sparkle(g, cx - c.s * 0.9, cy - c.s * 1.3, c.s * 0.5, CREAM, 0.95);
          }
        });
      }
      t += span + 0.06 + R() * 0.22;
    }
    return studs;
  },
  studs: {
    w: 0.38,
    h: 0.45,
    ax: 0.5,
    ay: 0.86,
    kinds: 3,
    from: 0.9,
    draw(g, kind, px) {
      const R = seeded(kind * 613 + 11);
      const line = Math.max(1 / px, 0.014);
      footShadow(g, 0, 0, 0.13, 0.4);
      g.save();
      g.translate(0, -0.13);
      g.scale(1, 0.85);
      glow(g, 0, 0, 0.165, STEEL, 0.34);
      g.restore();
      // A stack of cubes standing on the face: a big one, a smaller one on its shoulder, and a third for the biggest.
      const big = 0.105 + kind * 0.008;
      block(g, 0, 0, big, line, ORE);
      const sx = (R() < 0.5 ? -1 : 1) * big * 0.42;
      block(g, sx, -big * 1.55, big * 0.62, line, ORE);
      if (kind === 2) block(g, -sx * 1.1, -big * 0.25, big * 0.5, line, ORE);
      sparkle(g, sx, -big * 2.45, 0.06, mix(STEEL, CREAM, 0.6), 0.95);
    },
  },
};

/**
 * A cube lying in the face, seen from above it: a square top in the mirror
 * light, raised off its foot toward the light so the two sides away from it
 * show, in the kit's body and shade. Laid on the ground through the iso view
 * the square goes to a diamond, which is how the eye expects a cube's top.
 * The cleavage step is cut across the top as a line, and a bright edge runs
 * round its lit corner.
 */
function cube(g: Ctx, x: number, y: number, s: number, turn: number, line: number, pal: Pal): void {
  const c = Math.cos(turn), d = Math.sin(turn);
  const P = (a: number, b: number): [number, number] => [x + (a * c - b * d) * s, y + (a * d + b * c) * s];
  const ex = -0.6 * s, ey = -0.62 * s;
  const base = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
  const top = base.map(([px, py]) => [px + ex, py + ey] as [number, number]);
  g.lineJoin = 'round';
  // Its shadow on the bed, down and away from the light, so it stands off the face.
  g.fillStyle = css(BED.rim, 0.7);
  g.beginPath();
  poly(g, base.map(([px, py]) => [px + s * 0.25, py + s * 0.3]).flat());
  g.fill();
  // The outline of the whole block: the hull of foot and top.
  const sides: Array<{ q: number[]; shade: number }> = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // The outward normal of edge i..j (the corners run clockwise on the canvas).
    const nx = base[j][1] - base[i][1], ny = base[i][0] - base[j][0];
    // A side shows where it faces away from the way the top is raised.
    if (nx * ex + ny * ey < 0) sides.push({ q: [...base[i], ...base[j], ...top[j], ...top[i]], shade: ny - nx * 0.5 });
  }
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line * 1.6;
  for (const sd of sides) {
    g.beginPath();
    poly(g, sd.q);
    g.stroke();
  }
  g.beginPath();
  poly(g, top.flat());
  g.stroke();
  for (const sd of sides) {
    g.fillStyle = css(sd.shade > 0 ? SIDE_D : SIDE_L);
    g.beginPath();
    poly(g, sd.q);
    g.fill();
  }
  // The top: a mirror, bright on the half toward the light and steel on the other, so it reads as metal and not a tile.
  const T = (a: number, b: number): [number, number] => { const p = P(a, b); return [p[0] + ex, p[1] + ey]; };
  g.fillStyle = css(FACE);
  g.beginPath();
  poly(g, top.flat());
  g.fill();
  g.fillStyle = css(FACE_SHADE);
  g.beginPath();
  poly(g, [...T(1, -1), ...T(1, 1), ...T(-1, 1)]);
  g.fill();
  // Galena's stepped face: a square within the square, a step down -- where it is big enough not to blur the cube.
  if (s / line > 7) {
    g.strokeStyle = css(mix(FACE, pal.dark, 0.55));
    g.lineWidth = line * 0.9;
    g.beginPath();
    poly(g, [...T(-0.45, -0.45), ...T(0.45, -0.45), ...T(0.45, 0.45), ...T(-0.45, 0.45)]);
    g.stroke();
  }
  g.strokeStyle = css(CREAM, 0.95);
  g.lineWidth = line;
  g.beginPath();
  g.moveTo(...T(-0.9, 0.85));
  g.lineTo(...T(-0.92, -0.92));
  g.lineTo(...T(0.85, -0.9));
  g.stroke();
}

/** An upright cube for a stud, its foot at (x, y), `s` from its middle to a corner across: the same three faces, lit from the screen's top. */
function block(g: Ctx, x: number, y: number, s: number, line: number, pal: Pal): void {
  const h = s * 1.05;
  const top = [x, y - h - s, x + s, y - h - s * 0.5, x, y - h, x - s, y - h - s * 0.5];
  const left = [x - s, y - h - s * 0.5, x, y - h, x, y, x - s, y - s * 0.5];
  const right = [x, y - h, x + s, y - h - s * 0.5, x + s, y - s * 0.5, x, y];
  g.lineJoin = 'round';
  g.beginPath();
  poly(g, [x, y - h - s, x + s, y - h - s * 0.5, x + s, y - s * 0.5, x, y, x - s, y - s * 0.5, x - s, y - h - s * 0.5]);
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line * 1.6;
  g.stroke();
  for (const [face, col] of [[top, pal.lit], [left, pal.body], [right, pal.dark]] as const) {
    g.fillStyle = css(col);
    g.beginPath();
    poly(g, face);
    g.fill();
  }
  g.strokeStyle = css(CREAM, 0.9);
  g.lineWidth = line;
  g.beginPath();
  g.moveTo(x - s * 0.9, y - h - s * 0.5);
  g.lineTo(x, y - h - s * 0.96);
  g.lineTo(x + s * 0.9, y - h - s * 0.5);
  g.stroke();
  // Light down the front edge.
  g.strokeStyle = css(pal.shine, 0.7);
  g.lineWidth = line * 0.8;
  g.beginPath();
  g.moveTo(x, y - h * 0.9);
  g.lineTo(x, y - h * 0.2);
  g.stroke();
}
