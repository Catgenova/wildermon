import { css, footShadow, glow, halo, hex, mix, palOf, periodic, ribbon, rune, seeded, sparkle, wrap, CREAM } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, RGB, SeamLook, Stud } from '../types';

/**
 * Mithril: a lode of fine bright needles, silver with a breath of periwinkle,
 * in sprays and crossing in a lattice through a blue bed that glows from
 * inside, a star where they cross, and the six-pointed star rune cut beside
 * it. The finest and brightest of the rare four: all line and light, nothing
 * chunky.
 */
const L = 4;
const BED = palOf('#6f80c8', { dark: 0.24 });
const NEEDLE = palOf('#b2c3f8', { lit: 0.55, dark: 0.3, rim: 0.66 });
const LIGHT: RGB = hex('#a9c9ff');
const STAR: RGB = mix(LIGHT, CREAM, 0.55);

/** A needle lying in the face from (x0, y0) to (x1, y1), `w` thick: pointed both ends, lit along its upper side, a bright core. */
function needle(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, pal: Pal, line: number): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w, ny = (dx / len) * w;
  // Which side faces the light (up the strip).
  const s = ny < 0 ? 1 : -1;
  const mx = x0 + dx * 0.45, my = y0 + dy * 0.45;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(mx + nx, my + ny);
  g.lineTo(x1, y1);
  g.lineTo(mx - nx, my - ny);
  g.closePath();
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line;
  g.stroke();
  g.fillStyle = css(pal.body);
  g.fill();
  g.fillStyle = css(pal.lit);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(mx + nx * s, my + ny * s);
  g.lineTo(x1, y1);
  g.closePath();
  g.fill();
  g.strokeStyle = css(pal.shine);
  g.lineWidth = line * 0.7;
  g.beginPath();
  g.moveTo(x0 + dx * 0.15, y0 + dy * 0.15);
  g.lineTo(x0 + dx * 0.8, y0 + dy * 0.8);
  g.stroke();
}

/** An upright needle for a stud, from its root at (x, y) out along `ang` (0 is straight up) for `h`. */
function spike(g: Ctx, x: number, y: number, h: number, w: number, ang: number, line: number): void {
  const sx = Math.sin(ang), cy = -Math.cos(ang);
  const tx = x + sx * h, ty = y + cy * h;
  const nx = -cy * w, ny = sx * w;
  const mx = x + sx * h * 0.3, my = y + cy * h * 0.3;
  g.beginPath();
  g.moveTo(x + nx * 0.5, y + ny * 0.5);
  g.lineTo(mx + nx, my + ny);
  g.lineTo(tx, ty);
  g.lineTo(mx - nx, my - ny);
  g.lineTo(x - nx * 0.5, y - ny * 0.5);
  g.closePath();
  g.strokeStyle = css(NEEDLE.rim);
  g.lineWidth = line;
  g.stroke();
  g.fillStyle = css(NEEDLE.body);
  g.fill();
  // The left half in the light (the side whose normal points left).
  const l = nx < 0 ? 1 : -1;
  g.fillStyle = css(NEEDLE.lit);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + nx * 0.5 * l, y + ny * 0.5 * l);
  g.lineTo(mx + nx * l, my + ny * l);
  g.lineTo(tx, ty);
  g.closePath();
  g.fill();
  g.strokeStyle = css(NEEDLE.shine);
  g.lineWidth = line * 0.75;
  g.beginPath();
  g.moveTo(x + sx * h * 0.2, y + cy * h * 0.2);
  g.lineTo(x + sx * h * 0.92, y + cy * h * 0.92);
  g.stroke();
  g.fillStyle = css(CREAM);
  g.beginPath();
  g.arc(tx, ty, w * 0.55, 0, Math.PI * 2);
  g.fill();
}

export const mithril: SeamLook = {
  name: 'Mithril vein',
  wash: hex('#a8b8e2'),
  pitch: 1.9,
  drift: 0.4,
  half: 0.42,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.12]]);
    const wob = periodic(R, L, 0.03, [[2, 0.6], [3, 0.3], [6, 0.12]]);
    const w = (t: number): number => 0.11 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.011);
    halo(g, body, LIGHT, 0.16, 0.85, px);
    g.strokeStyle = css(BED.rim, 0.3);
    g.lineWidth = 0.05;
    g.stroke(body);
    g.fillStyle = css(BED.dark);
    g.fill(body);
    // The lattice: fine silver lines crossing at sixty degrees through the bed, lit from inside.
    g.save();
    g.clip(body);
    g.fillStyle = css(BED.body, 0.8);
    for (let x = -0.3; x < L + 0.3; x += 0.5) {
      g.beginPath();
      g.ellipse(x + 0.25, mid(x + 0.25), 0.3, 0.06, 0, 0, Math.PI * 2);
      g.fill();
    }
    const n = 64;
    const sp = L / n;
    g.strokeStyle = css(NEEDLE.lit, 0.42);
    g.lineWidth = line * 0.7;
    g.beginPath();
    for (let k = -4; k <= n + 4; k++) {
      const x = k * sp;
      const m = mid(x);
      g.moveTo(x - 0.14, m - 0.24);
      g.lineTo(x + 0.14, m + 0.24);
      g.moveTo(x + 0.14, m - 0.24);
      g.lineTo(x - 0.14, m + 0.24);
    }
    g.stroke();
    g.restore();
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // Sprays of needles along the bed, fanning from a root, crossing one another.
    const studs: Stud[] = [];
    const runeAt = R() * L;
    const runeSide = R() < 0.5 ? -1 : 1;
    const near = (t: number): boolean => Math.min(Math.abs(t - runeAt), Math.abs(t - runeAt - L), Math.abs(t - runeAt + L)) < 0.2;
    const sprays: Array<{ t: number; dy: number; dir: number; arms: number[]; lit: boolean }> = [];
    let t = R() * 0.1;
    let i = 0;
    while (t < L - 0.06) {
      const ww = Math.max(0.04, w(t));
      if (!near(t)) {
        const lit = i % 5 === 1;
        const dir = R() < 0.5 ? 1 : -1;
        const k = 3 + Math.floor(R() * 2);
        const arms: number[] = [];
        for (let a = 0; a < k; a++) arms.push((R() - 0.5) * 0.9, 0.12 + R() * 0.16, 0.014 + R() * 0.01);
        sprays.push({ t, dy: (R() - 0.5) * ww * 0.7, dir, arms, lit });
        if (lit) studs.push({ t, n: 0, kind: Math.floor(R() * 3) });
        i++;
      }
      t += 0.1 + R() * 0.08;
    }
    for (const c of sprays) if (c.lit) wrap(L, c.t, 0.26, (x) => glow(g, x, mid(x), 0.24, LIGHT, 0.6));
    for (const c of sprays) {
      wrap(L, c.t, 0.32, (x) => {
        const y = mid(x) + c.dy;
        for (let a = 0; a < c.arms.length; a += 3) {
          const ang = c.arms[a], len = c.arms[a + 1], wd = c.arms[a + 2];
          const ex = x + Math.cos(ang) * len * c.dir, ey = y + Math.sin(ang) * len * 0.55;
          needle(g, x - Math.cos(ang) * len * 0.15 * c.dir, y - Math.sin(ang) * len * 0.08, ex, ey, wd, NEEDLE, line);
        }
      });
    }
    // A star where the brightest of them cross.
    const st: number[] = [];
    for (let k = 0; k < 10; k++) st.push(R() * L, (R() - 0.5) * 0.14, 0.028 + R() * 0.03);
    for (let k = 0; k < st.length; k += 3) {
      const gt = st[k], gy = st[k + 1], gr = st[k + 2];
      wrap(L, gt, gr, (x) => sparkle(g, x, mid(x) + gy, gr, STAR, 1));
    }
    wrap(L, runeAt, 0.2, (x) => {
      const y = mid(x) + runeSide * (w(x) + 0.085);
      glow(g, x, y, 0.14, LIGHT, 0.5);
      rune(g, 'star6', x, y, 0.07, LIGHT, CREAM, runeSide * 0.15);
    });
    return studs;
  },
  studs: {
    w: 0.62,
    h: 0.66,
    ax: 0.5,
    ay: 0.8,
    kinds: 3,
    from: 0.9,
    twinkle: 0.4,
    draw(g, kind) {
      const R = seeded(kind * 173 + 3);
      g.save();
      g.translate(0, -0.16);
      g.scale(1, 0.85);
      glow(g, 0, 0, 0.32, LIGHT, 0.5);
      g.restore();
      footShadow(g, 0, 0, 0.11, 0.32);
      // A spray of needles out of one root, the side ones first, the tallest last.
      const n = 6 + kind;
      const arms: Array<[number, number, number]> = [];
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * 2 - 1;
        arms.push([f * 0.78 + (R() - 0.5) * 0.12, (0.36 - Math.abs(f) * 0.17) * (0.8 + R() * 0.3), 0.016 + R() * 0.006]);
      }
      arms.sort((a, b) => b[0] * b[0] - a[0] * a[0]);
      for (const [ang, h, wd] of arms) spike(g, (R() - 0.5) * 0.03, 0, h, wd, ang, 0.014);
      const top = arms[arms.length - 1];
      sparkle(g, Math.sin(top[0]) * top[1], -Math.cos(top[0]) * top[1], 0.085, STAR, 1);
    },
  },
};
