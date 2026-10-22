import { channel, css, hex, mix, periodic, ribbon, seeded, wrap, CREAM, DUSK, INK } from '../kit';
import type { SeamLook } from '../types';

/**
 * Sandstone: the rock laid down by water and wind in sets of layers, each set
 * a warm sand colour -- peach, apricot, honey, cream -- and inside each set
 * the fine laminae lying aslant, curving down to meet the set's floor and cut
 * off at its roof by the set above: cross-bedding. The roof of every set is
 * a pale ledge in the sun, the stone is worn into small round pits, and it
 * is speckled with grains and the odd glint of quartz.
 */
const L = 4;
/** The sets' colours, a pale one and a deep one by turns. */
const SETS = ['#f6dfbd', '#e6a07f', '#f1cb92', '#e3a68e', '#f7e4c6', '#eab17c'].map(hex);
const RIM = mix(hex('#c98f72'), INK, 0.45);
const QUARTZ = hex('#fffdf6');
/** The laminae's spacing along the band, in tiles: a whole number of them to a strip. */
const STEP = L / 40;

export const sandstone: SeamLook = {
  name: 'Sandstone',
  wash: hex('#dcc2a8'),
  pitch: 1.5,
  drift: 0.3,
  half: 0.29,
  length: L,
  variants: 3,
  strip(g, v, px, R) {
    const mid = periodic(R, L, 0.035, [[1, 0.7], [2, 0.3]]);
    const wob = periodic(R, L, 0.02, [[2, 0.6], [3, 0.4]]);
    const w = (t: number): number => 0.2 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.012);
    channel(g, body, 0.035, 0.3);
    g.fillStyle = css(SETS[(v * 2) % SETS.length]);
    g.fill(body);
    g.save();
    g.clip(body);

    // Where the sets part, from the top of the band down: gently wavy, the
    // way a sand surface is.
    const n = 3;
    const parts = Array.from({ length: n + 1 }, (_, i) => {
      const f = -1.15 + (2.3 * i) / n;
      const wv = i && i < n ? periodic(R, L, 0.018, [[1, 0.6], [2, 0.4]]) : (): number => 0;
      return (t: number): number => mid(t) + f * w(t) + wv(t);
    });
    for (let s = 0; s < n; s++) {
      const base = SETS[(s + v * 2) % SETS.length];
      const dark = mix(base, hex('#a8705e'), 0.55);
      const pale = mix(base, CREAM, 0.55);
      const dir = (s + v) % 2 ? 1 : -1;
      const top = parts[s], bot = parts[s + 1];
      const set = new Path2D();
      for (let x = -0.3; x <= L + 0.3; x += 0.04) set.lineTo(x, top(x));
      for (let x = L + 0.3; x >= -0.3; x -= 0.04) set.lineTo(x, bot(x));
      set.closePath();
      g.fillStyle = css(base);
      g.fill(set);
      // The laminae: each one leaves the roof aslant and bends round to lie
      // along the floor, a fine dark line and a pale one beside it.
      const run = 0.3 + R() * 0.12;
      const salt = Math.floor(R() * 1e6);
      const count = Math.round(L / STEP);
      // Three kinds of lamina, each gathered into one path: a bold dark one,
      // a faint dark one and a pale one.
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let k = -Math.ceil(run / STEP) - 2; k < count + 4; k++) {
        const kk = ((k % count) + count) % count;
        const r = seeded(salt + kk * 7919);
        const tone = r();
        const x0 = k * STEP + (r() - 0.5) * STEP * 0.6;
        const p = paths[tone < 0.25 ? 0 : tone < 0.6 ? 1 : 2];
        // Leaving the roof aslant and lying flat along the floor: a parabola,
        // which is one quadratic curve.
        const x1 = x0 + dir * run;
        p.moveTo(x0, top(x0));
        p.quadraticCurveTo((x0 + x1) / 2, bot(x1), x1, bot(x1));
      }
      g.lineWidth = line * 1.1;
      g.strokeStyle = css(dark, 0.6);
      g.stroke(paths[0]);
      g.lineWidth = line * 0.8;
      g.strokeStyle = css(dark, 0.3);
      g.stroke(paths[1]);
      g.strokeStyle = css(pale, 0.6);
      g.stroke(paths[2]);
      // A shade along the floor of the set, where it is tucked under the next.
      g.strokeStyle = css(dark, 0.35);
      g.lineWidth = 0.03;
      g.beginPath();
      for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, bot(x) - 0.012);
      g.stroke();
      // The set's roof: a fine line of ink and a pale ledge under it.
      if (s) {
        g.strokeStyle = css(RIM, 0.9);
        g.lineWidth = line;
        g.beginPath();
        for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, top(x));
        g.stroke();
      }
      g.strokeStyle = css(mix(base, CREAM, 0.6), 0.85);
      g.lineWidth = line * 1.2;
      g.beginPath();
      for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, top(x) + line * 1.4);
      g.stroke();
    }

    // Weathering: small round pits worn into the stone, a shadow inside each
    // and the light on its lower wall.
    for (let k = 0; k < 9; k++) {
      const t = ((k + 0.2 + R() * 0.6) / 9) * L;
      const dy = (R() - 0.5) * 0.24;
      const rx = 0.022 + R() * 0.022, ry = rx * (0.55 + R() * 0.2);
      wrap(L, t, 0.06, (x) => {
        const y = mid(x) + dy;
        g.fillStyle = css(mix(SETS[1], DUSK, 0.45), 0.55);
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = css(CREAM, 0.8);
        g.lineWidth = line;
        g.beginPath();
        g.ellipse(x, y, rx * 0.85, ry * 0.75, 0, Math.PI * 0.15, Math.PI * 0.85);
        g.stroke();
      });
    }
    // Grains: darker flecks, and the odd glint of quartz.
    for (let k = 0; k < 0; k++) {
      const t = R() * L;
      const dy = (R() - 0.5) * 0.36;
      const r = line * (0.5 + R() * 0.6);
      const q = R() < 0.18;
      wrap(L, t, 0.02, (x) => {
        g.fillStyle = q ? css(QUARTZ, 0.95) : css(mix(SETS[2], INK, 0.35), 0.45);
        g.beginPath();
        g.arc(x, mid(x) + dy, q ? r * 1.2 : r, 0, Math.PI * 2);
        g.fill();
      });
    }
    g.restore();
    g.strokeStyle = css(RIM, 0.85);
    g.lineWidth = line;
    g.stroke(body);
  },
};
