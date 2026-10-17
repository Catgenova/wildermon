import { ARMOURY_SWORDS } from '../runecut-frames';
import { clamp01, glow, rnd, type Ctx, type LifePiece } from './kit';

/**
 * Light running down the swords crossed over the Equipment window's frame
 * (`armoury` in runecut-frames.ts), by day: every so often a bright band
 * slides from one blade's guard to its point and a small star blooms at the
 * tip; some rounds it is the other blade, and some neither.
 *
 * Time is cut into rounds of `ROUND` seconds, each planned from its own
 * number, so it is wherever it would be at that moment however often it is
 * drawn, and nothing is kept between frames.
 */

/** Seconds in one round, and how long the light takes down a blade. */
const ROUND = 7;
const RUN = 0.9;

export function sheen(g: Ctx, p: LifePiece, t: number): void {
  const { w, F } = p;
  if (w <= F * 9) return;
  const n = Math.floor(t / ROUND);
  const pick = rnd(n, p.seed);
  // About a round in three stays dark.
  if (pick < 0.33) return;
  const dir = pick < 0.66 ? -1 : 1;
  const u = (t - n * ROUND - rnd(n, p.seed + 1) * (ROUND - RUN - 0.6)) / RUN;
  if (u < 0 || u > 1.5) return;
  const { cy, blade, tilt } = ARMOURY_SWORDS;
  const L = F * blade, a = Math.PI + dir * tilt;
  g.save();
  g.translate(w / 2, F * cy);
  g.rotate(a);
  // The band of light, from the guard (-0.15 L) to the point (0.78 L), clipped to the blade.
  g.beginPath();
  g.moveTo(-F * 0.13, -L * 0.15);
  g.lineTo(F * 0.13, -L * 0.15);
  g.lineTo(F * 0.13, L * 0.62);
  g.lineTo(0, L * 0.78);
  g.lineTo(-F * 0.13, L * 0.62);
  g.closePath();
  g.clip();
  const y = -L * 0.15 + clamp01(u) * L * 0.93;
  const band = g.createLinearGradient(0, y - F * 0.5, 0, y + F * 0.5);
  band.addColorStop(0, 'rgba(255, 255, 255, 0)');
  band.addColorStop(0.5, `rgba(255, 255, 255, ${0.85 * (1 - clamp01(u - 1) * 2)})`);
  band.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = band;
  g.fillRect(-F, y - F * 0.5, F * 2, F);
  g.restore();
  // And a star at the point as the light reaches it.
  const k = u - 0.9;
  if (k > 0 && k < 0.6) {
    const a = Math.sin((k / 0.6) * Math.PI);
    const tx = w / 2 - Math.sin(a) * L * 0.78, ty = F * cy + Math.cos(a) * L * 0.78;
    glow(g, tx, ty, F * 0.5 * a, '255, 250, 230', 0.7 * a);
    g.strokeStyle = `rgba(255, 252, 240, ${0.9 * a})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(tx - F * 0.45 * a, ty);
    g.lineTo(tx + F * 0.45 * a, ty);
    g.moveTo(tx, ty - F * 0.45 * a);
    g.lineTo(tx, ty + F * 0.45 * a);
    g.stroke();
  }
}
