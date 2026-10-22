import { channel, css, glow, hex, mix, palOf, periodic, ribbon, sparkle, wrap, CREAM } from '../kit';
import type { SeamLook, Stud } from '../types';

/**
 * Marble: a creamy slab of it showing through the face, polished: the light
 * lying across it in long slanting streaks, a bevel of white along its upper
 * edge, and its veins -- a bold one in dove grey that wanders from side to
 * side of the slab and forks, finer ones in dusty rose. Now and then the
 * polish catches the sun.
 */
const L = 4;
const PAL = palOf('#ece2d7', { rim: 0.5, dark: 0.14 });
const WHITE = hex('#ffffff');
const GLINT = hex('#ffe6c9');
const BLUSH = hex('#e2cfcb');
const VEIN = hex('#9d97b4');
const ROSE = hex('#c99fb1');

export const marble: SeamLook = {
  name: 'Marble',
  wash: hex('#e6ddd8'),
  pitch: 1.7,
  drift: 0.35,
  half: 0.3,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.035);
    const wob = periodic(R, L, 0.025, [[2, 0.6], [5, 0.3]]);
    const w = (t: number): number => 0.19 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.012);
    channel(g, body, 0.035, 0.3);
    // The slab, cream at its upper edge going to a blush at its lower.
    const grad = g.createLinearGradient(0, -0.22, 0, 0.22);
    grad.addColorStop(0, css(mix(PAL.body, CREAM, 0.5)));
    grad.addColorStop(0.55, css(PAL.body));
    grad.addColorStop(1, css(BLUSH));
    g.fillStyle = grad;
    g.fill(body);
    g.save();
    g.clip(body);

    // A cloud of grey under the main vein, then the vein itself: it swings
    // from one side of the slab to the other three or four times a strip,
    // which on the slab reads as a slant across it.
    const swing = periodic(R, L, 0.12, [[2, 0.55], [3, 0.35], [7, 0.12], [13, 0.05]]);
    const vy = (x: number): number => mid(x) + swing(x);
    const thick = periodic(R, L, 0.4, [[5, 0.6], [7, 0.4]]);
    g.strokeStyle = css(VEIN, 0.16);
    g.lineWidth = 0.07;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.03) g.lineTo(x, vy(x));
    g.stroke();
    // The vein swells and thins: one ribbon round it.
    g.fillStyle = css(VEIN, 0.9);
    g.fill(ribbon(L, vy, (x) => line * (0.7 + 0.6 * (0.5 + thick(x))), 0.03));
    // Forks off it: a short tapering branch, now up the slab, now down.
    const forks = 7;
    for (let i = 0; i < forks; i++) {
      const t = ((i + 0.2 + R() * 0.6) / forks) * L;
      const dir = R() < 0.5 ? -1 : 1;
      const run = 0.18 + R() * 0.2;
      const bend = (R() - 0.5) * 0.06;
      const drop = dir * (0.08 + R() * 0.08);
      wrap(L, t, run + 0.1, (x) => {
        const y = vy(x);
        for (let k = 0; k < 6; k++) {
          const a = k / 6, b = (k + 1) / 6;
          g.strokeStyle = css(VEIN, 0.75);
          g.lineWidth = line * (1.6 - a * 1.2);
          g.beginPath();
          g.moveTo(x + run * a, y + drop * a + bend * Math.sin(a * Math.PI));
          g.lineTo(x + run * b, y + drop * b + bend * Math.sin(b * Math.PI));
          g.stroke();
        }
      });
    }
    // Finer veins in rose and grey, each running the strip's length.
    for (let k = 0; k < 2; k++) {
      const fy = periodic(R, L, 0.07, [[1, 0.5], [3, 0.3], [11, 0.06]]);
      const base = (R() - 0.5) * 0.16;
      g.strokeStyle = css(k === 1 ? VEIN : ROSE, 0.5);
      g.lineWidth = line * 0.9;
      g.beginPath();
      for (let x = -0.3; x <= L + 0.3; x += 0.025) g.lineTo(x, mid(x) + base + fy(x));
      g.stroke();
    }

    // The polish: soft streaks of light slanting across the slab, each a
    // wide faint glow round a brighter core.
    const streaks = 4;
    for (let i = 0; i < streaks; i++) {
      const t = ((i + 0.2 + R() * 0.6) / streaks) * L;
      const wd = 0.035 + R() * 0.03;
      const a = 0.5 + R() * 0.3;
      wrap(L, t, 0.45, (x) => {
        const m = mid(x);
        for (const [k, al] of [[3, 0.12], [1.8, 0.2], [0.7, 0.55]]) {
          const h = wd * k;
          g.fillStyle = css(WHITE, a * al);
          g.beginPath();
          g.moveTo(x - 0.16 - h, m - 0.28);
          g.lineTo(x - 0.16 + h, m - 0.28);
          g.lineTo(x + 0.16 + h, m + 0.28);
          g.lineTo(x + 0.16 - h, m + 0.28);
          g.closePath();
          g.fill();
        }
      });
    }

    // The bevel: cream along the upper edge, a shade along the lower.
    g.strokeStyle = css(mix(PAL.dark, BLUSH, 0.3), 0.9);
    g.lineWidth = 0.05;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, mid(x) + w(x));
    g.stroke();
    g.strokeStyle = css(WHITE, 0.95);
    g.lineWidth = 0.035;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, mid(x) - w(x));
    g.stroke();
    g.restore();
    g.strokeStyle = css(PAL.rim, 0.8);
    g.lineWidth = line;
    g.stroke(body);

    // Where the polish catches the sun.
    const studs: Stud[] = [];
    for (let i = 0; i < 2; i++) studs.push({ t: ((i + 0.25 + R() * 0.5) / 2) * L, n: -0.06 - R() * 0.06, kind: i });
    return studs;
  },
  studs: {
    w: 0.3,
    h: 0.3,
    ax: 0.5,
    ay: 0.5,
    kinds: 2,
    from: 0.9,
    twinkle: 0.8,
    draw(g, kind) {
      glow(g, 0, 0, 0.13, GLINT, 0.75);
      sparkle(g, 0, 0, kind ? 0.12 : 0.095, WHITE, 1);
      sparkle(g, 0, 0, kind ? 0.06 : 0.05, GLINT, 1);
    },
  },
};
