import { boss, channel, css, footShadow, glow, halo, hex, nugget, palOf, periodic, ribbon, seeded, sparkle, wrap, CREAM } from '../kit';
import type { SeamLook, Stud } from '../types';

/**
 * Gold: a vein of milky quartz threaded with stringers of gold and swollen
 * with pockets of fat butter-gold nuggets, a warm light off the whole of
 * it; at the richest pockets a heap of nuggets stands proud of the face and
 * glints. The one every miner is looking for.
 */
const L = 4;
const QUARTZ = palOf('#f5f0e8', { rim: 0.42, dark: 0.12 });
const ORE = palOf('#f9cd58', { lit: 0.5, rim: 0.55 });
ORE.rim = hex('#9c6227');
ORE.dark = hex('#e39c3c');
ORE.shine = hex('#fffbe8');
const GLINT = hex('#fff2b8');
/** The warm light round it. */
const WARM = hex('#ffd36e');

export const gold: SeamLook = {
  name: 'Gold vein',
  wash: hex('#e8cf88'),
  pitch: 1.85,
  drift: 0.4,
  half: 0.32,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.15]]);
    const wob = periodic(R, L, 0.035, [[2, 0.6], [3, 0.3], [7, 0.12]]);
    const w = (t: number): number => 0.105 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.2 / px, 0.013);
    // Two stringers of gold through the quartz, pinching out and picking up.
    const strings = [0, 1].map((k) => {
      const off = periodic(R, L, 0.35, [[1, 0.5], [3, 0.5]]);
      const th = periodic(R, L, 1, [[2, 0.6], [5, 0.4]]);
      return ribbon(L, (t) => mid(t) + (k ? 0.3 : -0.3) * w(t) + off(t) * w(t) * 0.3, (t) => 0.004 + th(t) * 0.013);
    });
    // Cleavage in the quartz: short straight cracks, all drawn before any wrap.
    const cracks = Array.from({ length: 16 }, () => ({ t: R() * L, a: (R() - 0.5) * 1.6, l: 0.04 + R() * 0.05, d: (R() - 0.5) * 0.9 }));
    // The pockets: a fat nugget and a smaller one or two crowded against it.
    const studs: Stud[] = [];
    const pockets: Array<{ t: number; dy: number; parts: Array<[number, number, number, number]>; shine: boolean }> = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5 + (R() - 0.5) * 0.6) / n) * L;
      const ww = w(t);
      const big = i % 2 === 1;
      const dy = (R() - 0.5) * ww * 0.5;
      const parts: Array<[number, number, number, number]> = [];
      const r0 = big ? 0.07 : 0.075 + R() * 0.03;
      const m = big ? 1 : 1 + Math.floor(R() * 2.4);
      for (let k = 0; k < m; k++) {
        const a = R() * Math.PI * 2;
        parts.push([Math.cos(a) * r0 * 0.95, Math.sin(a) * r0 * 0.6, r0 * (0.45 + R() * 0.2), R() * 1e9]);
      }
      parts.push([0, 0, r0, R() * 1e9]);
      if (big) studs.push({ t, n: dy, kind: Math.floor(R() * 3) });
      pockets.push({ t, dy, parts, shine: !big && R() < 0.5 });
    }
    const flecks = Array.from({ length: 30 }, () => ({ t: R() * L, d: (R() - 0.5) * 1.5, r: 0.8 + R() * 0.8, c: R() < 0.55 }));

    // The warm light off the vein, its bed, and the quartz.
    halo(g, body, WARM, 0.085, 0.75, px);
    channel(g, body, 0.026, 0.3);
    g.fillStyle = css(QUARTZ.body);
    g.fill(body);
    g.save();
    g.clip(body);
    // Shade along the lower edge, a milky light along the upper.
    g.lineCap = 'round';
    g.strokeStyle = css(QUARTZ.dark);
    g.lineWidth = 0.06;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, mid(x) + w(x));
    g.stroke();
    g.strokeStyle = css(CREAM, 0.9);
    g.lineWidth = 0.035;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, mid(x) - w(x) * 0.55);
    g.stroke();
    g.strokeStyle = css(QUARTZ.rim, 0.32);
    g.lineWidth = line * 0.9;
    for (const c of cracks) wrap(L, c.t, c.l, (x) => {
      const y = mid(x) + c.d * w(x);
      g.beginPath();
      g.moveTo(x - Math.cos(c.a) * c.l * 0.5, y - Math.sin(c.a) * c.l * 0.5);
      g.lineTo(x + Math.cos(c.a) * c.l * 0.5, y + Math.sin(c.a) * c.l * 0.5);
      g.stroke();
    });
    for (const s of strings) {
      g.fillStyle = css(ORE.rim, 0.8);
      g.save();
      g.translate(0, line * 0.6);
      g.fill(s);
      g.restore();
      g.fillStyle = css(ORE.body);
      g.fill(s);
    }
    g.restore();
    g.strokeStyle = css(QUARTZ.rim, 0.85);
    g.lineWidth = line;
    g.stroke(body);

    for (const p of pockets) {
      wrap(L, p.t, 0.2, (x) => {
        const y = mid(x) + p.dy;
        for (const [ox, oy, r, s] of p.parts) nugget(g, x + ox, y + oy, r, ORE, seeded(s), { line: 0.3 });
      });
    }
    for (const f of flecks) {
      wrap(L, f.t, 0.02, (x) => {
        g.fillStyle = css(f.c ? ORE.body : GLINT);
        g.beginPath();
        g.arc(x, mid(x) + f.d * w(x), line * f.r, 0, Math.PI * 2);
        g.fill();
      });
    }
    for (const p of pockets) if (p.shine) wrap(L, p.t, 0.1, (x) => sparkle(g, x - 0.025, mid(x) + p.dy - 0.04, 0.065, CREAM, 0.95));
    return studs;
  },
  studs: {
    w: 0.62,
    h: 0.62,
    ax: 0.5,
    ay: 0.74,
    kinds: 3,
    from: 0.9,
    twinkle: 0.3,
    draw(g, kind) {
      const R = seeded(kind * 977 + 31);
      g.save();
      g.translate(0, -0.1);
      g.scale(1, 0.8);
      glow(g, 0, 0, 0.27, WARM, 0.55);
      g.restore();
      footShadow(g, 0, 0, 0.2, 0.32);
      // A heap: the smaller ones behind, the big one in front of them.
      const side = kind === 1 ? -1 : 1;
      boss(g, side * 0.1, -0.02, 0.085, ORE, R, 0.024);
      if (kind !== 2) boss(g, -side * 0.11, 0.0, 0.07, ORE, R, 0.024);
      boss(g, -side * 0.01, 0.015, 0.14 + kind * 0.01, ORE, R, 0.026);
      sparkle(g, -side * 0.06, -0.2 - kind * 0.01, 0.13, CREAM, 0.98);
      sparkle(g, -side * 0.06, -0.2 - kind * 0.01, 0.06, GLINT, 1);
    },
  },
};
