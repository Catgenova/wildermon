import { css, footShadow, glow, halo, hex, mix, palOf, periodic, ribbon, rune, seeded, sparkle, wrap, CREAM } from '../kit';
import type { Ctx, RGB, SeamLook, Stud } from '../types';

/**
 * Glimmersteel: a lode of thin pearly sheets, stacked in books like mica and
 * lying every which way in a lilac bed, each one shot through with opal fire
 * -- pink, mint, sky and butter running across it -- glinting, and the sun
 * rune cut beside it. Flat and shimmering where the other rare ores are
 * solid crystal.
 */
const L = 4;
const BED = palOf('#8d82b0', { dark: 0.22 });
const PEARL = palOf('#f3f1fa', { rim: 0.55, dark: 0.2, lit: 0.6 });
const FIRE: RGB[] = ['#f9bfdc', '#bdf2dc', '#bfd6fd', '#fde4b2', '#dcc8fb'].map(hex);
const LIGHT: RGB = hex('#fbe6f6');

/** A gradient of opal fire from (x0, y0) to (x1, y1), starting at colour `k`. */
function fire(g: Ctx, x0: number, y0: number, x1: number, y1: number, k: number, pale = 0.25): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < 4; i++) gr.addColorStop(i / 3, css(mix(FIRE[(k + i) % FIRE.length], CREAM, i === 1 ? 0.55 : pale)));
  return gr;
}

/**
 * A book of sheets lying in the face: two or three thin plates stacked a
 * little askew, the edge of each showing as a sliver under the one above,
 * the top one in opal fire with a white sheen across it.
 */
function book(g: Ctx, x: number, y: number, r: number, R: () => number, line: number): void {
  const ang = (R() - 0.5) * 1.6;
  const k = Math.floor(R() * FIRE.length);
  const leaves = 2 + Math.floor(R() * 2);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // A plate: a long, slanted hexagon, `r` from its middle to its ends.
  const sk = 0.25 + R() * 0.3;
  const shape = [-1, -0.05, -0.55 + sk, -0.5, 0.75 + sk * 0.3, -0.42, 1, 0.05, 0.55 - sk, 0.5, -0.75 - sk * 0.3, 0.42];
  const leaf = (ox: number, oy: number): Path2D => {
    const p = new Path2D();
    for (let i = 0; i < shape.length; i += 2) {
      const lx = shape[i] * r, ly = shape[i + 1] * r * 0.62;
      const px = x + ox + lx * ca - ly * sa, py = y + oy + lx * sa + ly * ca;
      if (i) p.lineTo(px, py);
      else p.moveTo(px, py);
    }
    p.closePath();
    return p;
  };
  for (let j = leaves - 1; j >= 0; j--) {
    const p = leaf(j * r * 0.1, j * r * 0.16);
    g.strokeStyle = css(PEARL.rim);
    g.lineWidth = line * 1.4;
    g.stroke(p);
    if (j) {
      g.fillStyle = css(mix(PEARL.dark, FIRE[(k + j) % FIRE.length], 0.35));
      g.fill(p);
      continue;
    }
    g.fillStyle = fire(g, x - r * ca, y - r * sa, x + r * ca, y + r * sa, k);
    g.fill(p);
    // The sheen: a pale band across the plate, as light lies on a flat face.
    g.save();
    g.clip(p);
    g.fillStyle = css(CREAM, 0.7);
    g.beginPath();
    const bx = x - r * 0.25 * ca, by = y - r * 0.25 * sa;
    g.ellipse(bx, by - r * 0.08, r * 0.2, r * 0.75, ang + 0.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

/**
 * An upright sheet for a stud: a thin blade standing from its foot, wider at
 * the top and cut off on a slant, its face in opal fire, its lit edge white
 * and its thickness a sliver of shade down the other side.
 */
function blade(g: Ctx, x: number, w: number, h: number, lean: number, k: number, line: number): void {
  const dx = lean * h;
  const fl = [x - w * 0.22, 0], fr = [x + w * 0.22, 0];
  const tl = [x + dx - w * 0.5, -h * 0.78], tr = [x + dx + w * 0.5, -h * (0.62 + (k % 2) * 0.1)];
  const tip = [x + dx - w * 0.12, -h];
  const outline = (p: Path2D, th: number): Path2D => {
    p.moveTo(fl[0], fl[1]);
    p.lineTo(tl[0], tl[1]);
    p.lineTo(tip[0], tip[1]);
    p.lineTo(tr[0] - th, tr[1] + th * 0.4);
    p.lineTo(fr[0] - th, fr[1]);
    p.closePath();
    return p;
  };
  const p = outline(new Path2D(), 0);
  g.strokeStyle = css(PEARL.rim);
  g.lineWidth = line;
  g.stroke(p);
  // Its thickness, on the shaded side.
  g.fillStyle = css(mix(PEARL.dark, FIRE[(k + 2) % FIRE.length], 0.35));
  g.fill(p);
  const face = outline(new Path2D(), w * 0.12);
  g.fillStyle = fire(g, x - w * 0.4, 0, x + dx + w * 0.4, -h, k, 0.1);
  g.fill(face);
  g.save();
  g.clip(face);
  g.fillStyle = css(CREAM, 0.6);
  g.beginPath();
  g.ellipse(x + dx * 0.55 - w * 0.1, -h * 0.55, w * 0.13, h * 0.55, lean + 0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = css(CREAM, 0.95);
  g.lineWidth = line * 0.9;
  g.beginPath();
  g.moveTo(fl[0] + w * 0.04, -h * 0.08);
  g.lineTo(tl[0] + w * 0.06, tl[1] + h * 0.02);
  g.lineTo(tip[0], tip[1] + h * 0.03);
  g.stroke();
}

export const glimmersteel: SeamLook = {
  name: 'Glimmersteel vein',
  wash: hex('#d4d0e6'),
  pitch: 1.9,
  drift: 0.4,
  half: 0.42,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.12]]);
    const wob = periodic(R, L, 0.035, [[2, 0.6], [3, 0.3], [6, 0.12]]);
    const w = (t: number): number => 0.115 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.012);
    // A halo of pink fire, and a rim of mint inside it, so the light round it changes colour.
    halo(g, body, FIRE[0], 0.17, 0.6, px);
    g.strokeStyle = css(FIRE[1], 0.5);
    g.lineWidth = 0.09;
    g.stroke(body);
    g.strokeStyle = css(BED.rim, 0.3);
    g.lineWidth = 0.06;
    g.stroke(body);
    g.fillStyle = css(BED.dark);
    g.fill(body);
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    const studs: Stud[] = [];
    const runeAt = R() * L;
    const runeSide = R() < 0.5 ? -1 : 1;
    const near = (t: number): boolean => Math.min(Math.abs(t - runeAt), Math.abs(t - runeAt - L), Math.abs(t - runeAt + L)) < 0.18;
    const books: Array<{ t: number; dy: number; r: number; s: number; lit: boolean }> = [];
    let t = R() * 0.08;
    let i = 0;
    while (t < L - 0.05) {
      const ww = Math.max(0.04, w(t));
      const r = Math.min(0.13, 0.065 + ww * 0.4) * (0.7 + R() * 0.4);
      if (!near(t)) {
        const lit = i % 8 === 2;
        books.push({ t, dy: (R() - 0.5) * ww * 0.8, r, s: R() * 1e9, lit });
        if (lit) studs.push({ t, n: 0, kind: Math.floor(R() * 3) });
        i++;
      }
      t += r * (0.8 + R() * 0.4);
    }
    for (const c of books) if (c.lit) wrap(L, c.t, 0.26, (x) => glow(g, x, mid(x), 0.24, LIGHT, 0.6));
    for (const c of books) wrap(L, c.t, c.r * 1.4, (x) => book(g, x, mid(x) + c.dy, c.r, seeded(c.s), line));
    // Glints off the sheets.
    const gl: number[] = [];
    for (let k = 0; k < 9; k++) gl.push(R() * L, (R() - 0.5) * 0.16, 0.03 + R() * 0.03, Math.floor(R() * FIRE.length));
    for (let k = 0; k < gl.length; k += 4) {
      const gt = gl[k], gy = gl[k + 1], gr = gl[k + 2], c = FIRE[gl[k + 3]];
      wrap(L, gt, gr, (x) => sparkle(g, x, mid(x) + gy, gr, mix(c, CREAM, 0.6), 1));
    }
    wrap(L, runeAt, 0.2, (x) => {
      const y = mid(x) + runeSide * (w(x) + 0.085);
      glow(g, x, y, 0.13, FIRE[0], 0.5);
      rune(g, 'sowilo', x, y, 0.07, FIRE[0], CREAM, runeSide * 0.15);
    });
    return studs;
  },
  studs: {
    w: 0.7,
    h: 0.68,
    ax: 0.5,
    ay: 0.8,
    kinds: 3,
    from: 0.9,
    twinkle: 0.45,
    draw(g, kind) {
      const R = seeded(kind * 211 + 9);
      g.save();
      g.translate(0, -0.15);
      g.scale(1, 0.85);
      glow(g, 0, 0, 0.3, LIGHT, 0.45);
      glow(g, 0.04, 0.03, 0.2, FIRE[(kind + 1) % FIRE.length], 0.35);
      g.restore();
      footShadow(g, 0, 0, 0.14, 0.3);
      // A fan of sheets, the outer ones first.
      const n = 3;
      const order = [0, 2, 1];
      const line = 0.016;
      for (const j of order) {
        const f = (j / (n - 1)) * 2 - 1;
        const h = (0.34 - Math.abs(f) * 0.09 + (kind - 1) * 0.02) * (0.88 + R() * 0.2);
        blade(g, f * 0.075, 0.14 + R() * 0.03, h, f * 0.5 + (R() - 0.5) * 0.12, (kind + j) % FIRE.length, line);
      }
      sparkle(g, -0.05, -0.29, 0.09, CREAM, 1);
      sparkle(g, 0.09, -0.18, 0.05, mix(FIRE[(kind + 2) % FIRE.length], CREAM, 0.5), 1);
    },
  },
};
