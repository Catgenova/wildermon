import { css, footShadow, glow, hex, lode, mix, palOf, seeded, sparkle, CREAM, TAU, type Pal } from '../kit';
import type { Ctx, SeamLook } from '../types';

/**
 * Seryll: a lode of rose-champagne crystal grown in rosettes, blades fanned
 * out from a heart of the runes' gold, and the crescent rune cut beside it;
 * where a rosette stands up off the face it opens like a desert rose and
 * glows. Bladed and fanned where the mythic four stand in upright prisms.
 */
const L = 4;
const BED = palOf('#a07282', { dark: 0.34 });
const ORE = palOf('#f5cbbf', { lit: 0.55, rim: 0.6 });
ORE.dark = hex('#d68b97');
ORE.shine = hex('#fff6e6');
const LIGHT = hex('#ffd98c');
const HEART = hex('#ffc75e');

/**
 * A blade of the crystal: a long kite from its root at (x, y) out along
 * `ang` (0 points up the canvas), `len` long and `wid` across at its
 * shoulder, cut down its ridge into a lit facet and a shaded one by which
 * faces the upper-left light, with a thread of shine up the ridge.
 */
function blade(g: Ctx, x: number, y: number, len: number, wid: number, ang: number, pal: Pal, line: number): void {
  const s = Math.sin(ang), c = -Math.cos(ang);
  const tx = x + s * len, ty = y + c * len;
  const px = -c, py = s;
  const mx = x + s * len * 0.62, my = y + c * len * 0.62;
  const lx = mx + px * wid, ly = my + py * wid;
  const rx = mx - px * wid, ry = my - py * wid;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(lx, ly);
  g.lineTo(tx, ty);
  g.lineTo(rx, ry);
  g.closePath();
  g.lineWidth = line;
  g.lineJoin = 'round';
  g.strokeStyle = css(pal.rim);
  g.stroke();
  // Which facet faces the light: the one whose side points up and to the left.
  const litLeft = py * -0.8 + px * -0.45 > 0;
  g.fillStyle = css(litLeft ? pal.lit : pal.dark);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(lx, ly);
  g.lineTo(tx, ty);
  g.closePath();
  g.fill();
  g.fillStyle = css(litLeft ? pal.body : pal.lit);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(rx, ry);
  g.lineTo(tx, ty);
  g.closePath();
  g.fill();
  g.strokeStyle = css(pal.shine, 0.9);
  g.lineWidth = line * 0.7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + s * len * 0.3, y + c * len * 0.3);
  g.lineTo(x + s * len * 0.9, y + c * len * 0.9);
  g.stroke();
}

/** A rosette lying in the face, seen from above: blades fanned all round a heart of gold. */
function rosette(g: Ctx, x: number, y: number, r: number, R: () => number, line: number): void {
  const k = 5 + Math.floor(R() * 2);
  const a0 = R() * TAU;
  const blades = Array.from({ length: k }, (_, i) => ({ a: a0 + (i / k) * TAU + (R() - 0.5) * 0.4, l: r * (1 + R() * 0.35) }));
  // Those pointing down the canvas first, so the upper blades lie over them.
  blades.sort((p, q) => Math.cos(q.a) - Math.cos(p.a));
  for (const b of blades) blade(g, x, y, b.l, r * 0.36, b.a, ORE, line);
  g.fillStyle = css(HEART, 0.9);
  g.beginPath();
  g.arc(x, y, r * 0.2, 0, TAU);
  g.fill();
  g.fillStyle = css(mix(HEART, CREAM, 0.6));
  g.beginPath();
  g.arc(x - r * 0.03, y - r * 0.03, r * 0.1, 0, TAU);
  g.fill();
}

export const seryll: SeamLook = {
  name: 'Seryll vein',
  wash: hex('#e4c2b6'),
  pitch: 1.9,
  drift: 0.4,
  half: 0.42,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const line = Math.max(1 / px, 0.01);
    return lode(g, R, L, px, {
      bed: BED,
      ore: ORE,
      light: LIGHT,
      glyph: 'crescent',
      halo: 0.7,
      every: 6,
      crystal: (x, y, r, rr) => rosette(g, x, y, r * 0.92, rr, line),
    });
  },
  studs: {
    w: 0.72,
    h: 0.72,
    ax: 0.5,
    ay: 0.76,
    kinds: 3,
    from: 0.9,
    twinkle: 0.3,
    draw(g, kind) {
      const R = seeded(kind * 97 + 13);
      const cy = -0.07;
      g.save();
      g.translate(0, -0.17);
      g.scale(1, 0.85);
      glow(g, 0, 0, 0.32, LIGHT, 0.65);
      g.restore();
      footShadow(g, 0, 0, 0.17, 0.32);
      // A desert rose: a back fan of long blades, then a front fan of short
      // ones, all from one heart, the heart lit gold between them.
      const n = 5 + (kind % 2);
      const tall = 0.31 + kind * 0.025;
      const back = Array.from({ length: n }, (_, i) => ({ a: ((i / (n - 1)) * 2 - 1) * 1.25 + (R() - 0.5) * 0.15, l: tall * (1 - Math.abs((i / (n - 1)) * 2 - 1) * 0.35) * (0.9 + R() * 0.2) }));
      const front = Array.from({ length: 3 }, (_, i) => ({ a: (i - 1) * 0.95 + (R() - 0.5) * 0.2, l: tall * (0.5 + R() * 0.12) }));
      const dark = { ...ORE, lit: ORE.body, body: mix(ORE.body, ORE.dark, 0.45), dark: mix(ORE.dark, BED.body, 0.3) };
      for (const b of back) blade(g, 0, cy, b.l, 0.066, b.a, dark, 0.024);
      glow(g, 0, cy - 0.05, 0.14, HEART, 0.9);
      for (const b of front) blade(g, 0, cy + 0.015, b.l, 0.074, b.a, ORE, 0.024);
      g.fillStyle = css(mix(HEART, CREAM, 0.45));
      g.beginPath();
      g.arc(0, cy, 0.03, 0, TAU);
      g.fill();
      sparkle(g, back[Math.floor(n / 2)].a * 0.1, cy - tall * 0.95, 0.1, CREAM, 0.95);
    },
  },
};
