import { clamp01, rnd, type Ctx, type LifePiece } from './kit';

/**
 * Sparks and curls of shaving off the bench's foot beam while something is
 * being made. The work comes in phrases of strokes, two phrases to a place on
 * the beam: a hammer's light taps then one hard blow after a longer gap, or a
 * saw's even strokes, each throwing its sparks and one shaving the way the
 * blade went. A stroke lights a pool on the beam where it lands; its sparks
 * burst out, slow, drift up with a wobble and cool white to red as they fade.
 * About one in four curls aside, and a hard blow drops a few over the foot.
 */
/** The most sparks off one stroke: a hammer's hardest. */
export const EMBERS = 8;

/** How long one phrase of work is, its rest included, in seconds. */
const PHRASE = 1.8;
/** How fast a spark's first burst is lost to the air, per second. */
const DRAG = 5.2;
/** The longest anything off one stroke lasts, its pool's glow included, in seconds. */
const LAST = 1.6;

/** A spark's colours from out (red) to just struck (white). */
const HEAT: Array<[number, number, number]> = [
  [196, 52, 30],
  [240, 106, 38],
  [255, 168, 60],
  [255, 222, 128],
  [255, 250, 226],
];
/** A spark's colour at `heat`, 1 just struck to 0 out, as "r, g, b". */
function heatRgb(heat: number): string {
  const s = clamp01(heat) * (HEAT.length - 1), i = Math.min(HEAT.length - 2, Math.floor(s)), f = s - i;
  const a = HEAT[i], b = HEAT[i + 1];
  return `${Math.round(a[0] + (b[0] - a[0]) * f)}, ${Math.round(a[1] + (b[1] - a[1]) * f)}, ${Math.round(a[2] + (b[2] - a[2]) * f)}`;
}

/**
 * One particle's place `tau` seconds after its stroke: a burst at (vx, vy)
 * lost to drag towards a steady drift (dx, dy), a wobble on the warm air and,
 * for a curler, a widening turn to one side. All of it starts at (0, 0).
 */
function flight(tau: number, vx: number, vy: number, dx: number, dy: number, wob: number, wobW: number, curl: number, curlW: number): [number, number] {
  const e = (1 - Math.exp(-DRAG * tau)) / DRAG;
  let x = dx * tau + (vx - dx) * e + wob * Math.sin(wobW * tau) * clamp01(tau * 3);
  let y = dy * tau + (vy - dy) * e;
  if (curl !== 0) {
    const c = curl * (1 - Math.exp(-2.5 * tau)), a = curlW * tau;
    x += c * Math.sin(a);
    y += Math.abs(c) * (Math.cos(a) - 1);
  }
  return [x, y];
}

/** The sparks off the work on this bench at `t`. */
export function embers(g: Ctx, p: LifePiece, t: number): void {
  const { w, h, F, R } = p;
  if (w < F * 5) return;
  const top = h - F, foot = h + R + 6, y0 = h - F * 0.24;
  const s0 = rnd(p.seed % 10007, 0.37) * 500, tt = t + s0, k0 = Math.floor(tt / PHRASE);
  g.save();
  g.lineCap = 'round';
  for (let k = k0 - 1; k <= k0; k++) {
    const q = k + s0, m = Math.floor(k / 2) + s0;
    const into = tt - k * PHRASE;
    // Two phrases to a spell at one place on the beam, hammer and saw by turns, the hammer now and then twice running.
    const saw = Math.floor(k / 2) % 2 === 1 && rnd(m, 9) > 0.25;
    const spot = F * 2.4 + (w - F * 4.8) * clamp01(rnd(m, 3) + (rnd(q, 3) - 0.5) * 0.08);
    const n = saw ? 3 + Math.floor(rnd(q, 4) * 2) : 1 + Math.floor(rnd(q, 4) * 3);
    const sawGap = 0.3 + 0.1 * rnd(q, 5);
    let at = 0.05 + 0.2 * rnd(q, 6);
    for (let j = 0; j < n; j++) {
      // A saw's strokes come even; a hammer's taps come quick, and the last, hardest one after a longer gap.
      if (j > 0) at += saw ? sawGap * (0.92 + 0.16 * rnd(q, 10 + j)) : j === n - 1 ? 0.55 + 0.2 * rnd(q, 10 + j) : 0.3 + 0.12 * rnd(q, 10 + j);
      const tau0 = into - at;
      if (tau0 < 0 || tau0 > LAST) continue;
      const hard = saw ? 0.55 + 0.15 * rnd(q, 20 + j) - (j === n - 1 ? 0.12 : 0) : j === n - 1 ? 1 : 0.4 + 0.15 * rnd(q, 20 + j);
      const side = saw ? ((j + Math.floor(rnd(q, 7) * 2)) % 2 ? 1 : -1) : 0;
      const sx = spot + side * F * 0.25 + (rnd(q, 30 + j) - 0.5) * F * 0.3;
      pool(g, sx, y0, F, tau0, hard);
      if (!saw && hard > 0.9 && tau0 < 0.18) star(g, sx, y0 - 1, tau0 / 0.18);
      const count = saw ? 3 + Math.floor(rnd(q, 40 + j) * 2) : Math.round(2 + (EMBERS - 2) * hard * (0.8 + 0.2 * rnd(q, 40 + j)));
      for (let i = 0; i < count; i++) {
        const r = (c: number): number => rnd(q * 1.37 + j * 7.9 + i * 0.61, c);
        const shaving = saw && i === 0;
        const faller = !saw && hard > 0.9 && r(1) < 0.3;
        const life = shaving ? 1.1 + 0.4 * r(2) : faller ? 1.1 + 0.3 * r(2) : (0.55 + 0.6 * r(2)) * (0.7 + 0.3 * hard);
        const tau = tau0 - r(3) * 0.03;
        if (tau <= 0 || tau >= life) continue;
        // Out to one side and up: a saw throws the way its blade went, a hammer to either side.
        const out = saw ? side : r(4) < 0.5 ? -1 : 1;
        const vx = out * F * (faller ? 2.2 + 1.4 * r(5) : shaving ? 0.8 + 0.8 * r(5) : saw ? 1 + 2 * r(5) : 0.2 + 3.2 * r(5) * r(5)) * (0.7 + 0.3 * hard);
        const vy = -F * (faller ? 1.6 + 0.6 * r(6) : shaving ? 0.6 + 0.4 * r(6) : saw ? 0.7 + 0.8 * r(6) : 0.8 + 1.9 * r(6)) * (0.75 + 0.25 * hard);
        const dx = F * (0.12 * (r(7) - 0.5) + side * 0.1);
        const dy = faller ? F * 2.6 : shaving ? F * 0.45 : -F * (0.06 + 0.1 * r(8));
        const wob = shaving ? 2.4 : 0.6 + 1.2 * r(9), wobW = (shaving ? 4 : 6) + 6 * r(10);
        const curl = !faller && !shaving && r(11) < 0.25 ? (r(12) < 0.5 ? -1 : 1) * F * 0.28 : 0;
        const curlW = 3 + 2 * r(13);
        const x1 = sx + (r(14) - 0.5) * 3;
        const [ax, ay] = flight(tau, vx, vy, dx, dy, wob, wobW, curl, curlW);
        const u = tau / life, x = x1 + ax, y = y0 + ay;
        let a = clamp01(tau / 0.02) * (u > 0.65 ? (1 - u) / 0.35 : 1) * clamp01((y - top - 1) / (F * 0.3)) * clamp01((foot - y) / 8);
        if (a <= 0.02) continue;
        if (shaving) {
          const spin = r(15) * 6.3 + side * (8 * (1 - Math.exp(-2 * tau)) + 2 * tau);
          curlOfLight(g, x, y, 1.2 + 0.5 * r(16), spin, 1 - u, a * (0.65 + 0.35 * Math.cos(spin * 2)));
          continue;
        }
        if (u > 0.25) a *= 0.55 + 0.45 * Math.abs(Math.sin(tau * (14 + 10 * r(17)) + r(18) * 6.3));
        const [bx, by] = flight(Math.max(0, tau - 0.035), vx, vy, dx, dy, wob, wobW, curl, curlW);
        const heat = (1 - u) * (faller ? 0.9 : 1) * (0.8 + 0.2 * hard);
        const size = (0.85 + 0.55 * r(19)) * (0.55 + 0.45 * (1 - u)) * (saw ? 0.85 : 1);
        if (heat > 0.4) streak(g, x1 + bx, y0 + by, x, y, size * 4.4, heatRgb(heat - 0.25), a * 0.32 * clamp01((heat - 0.4) / 0.2));
        streak(g, x1 + bx, y0 + by, x, y, size * 1.9, heatRgb(heat), a);
      }
    }
  }
  g.restore();
}

/** A line from (ax, ay) to (x, y) `width` thick in `rgb` at `a`: a spark and the blur of its going. */
function streak(g: Ctx, ax: number, ay: number, x: number, y: number, width: number, rgb: string, a: number): void {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(x + 0.01, y);
  g.strokeStyle = `rgba(${rgb}, ${a})`;
  g.lineWidth = width;
  g.stroke();
}

/** A curl of shaving lit gold at (x, y), `r` round, turned to `spin`, `heat` 1 bright to 0 amber. */
function curlOfLight(g: Ctx, x: number, y: number, r: number, spin: number, heat: number, a: number): void {
  const rgb = heatRgb(0.55 + heat * 0.45);
  g.beginPath();
  g.arc(x, y, r, spin, spin + 2.8);
  g.strokeStyle = `rgba(${heatRgb(0.45)}, ${a * 0.3})`;
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = `rgba(${rgb}, ${a})`;
  g.lineWidth = 1.1;
  g.stroke();
}

/** The warm pool a stroke lights on the beam at (x, y), `tau` seconds after it lands, `hard` 0..1: a flash, then a smoulder. */
function pool(g: Ctx, x: number, y: number, F: number, tau: number, hard: number): void {
  const a = hard * (0.4 * Math.exp(-tau * 10) + 0.12 * Math.exp(-tau * 2.2));
  if (a < 0.015) return;
  const r = F * (0.55 + 0.35 * hard);
  g.save();
  g.translate(x, y);
  g.scale(1, 0.55);
  const f = g.createRadialGradient(0, 0, 0, 0, 0, r);
  f.addColorStop(0, `rgba(255, 214, 120, ${a})`);
  f.addColorStop(0.4, `rgba(255, 160, 70, ${a * 0.5})`);
  f.addColorStop(1, 'rgba(255, 140, 60, 0)');
  g.fillStyle = f;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
}

/** The four-point glint a hard blow strikes at (x, y), `u` 0..1 through its life: it opens fast and shrinks away. */
function star(g: Ctx, x: number, y: number, u: number): void {
  const l = (1.5 + 3 * Math.sin(Math.min(1, u * 2.5) * Math.PI * 0.5)) * (1 - u * 0.5), a = 1 - u * u;
  for (const [wd, rgb, k] of [[2.4, '255, 200, 110', 0.35], [0.9, '255, 250, 230', 1]] as Array<[number, string, number]>) {
    g.strokeStyle = `rgba(${rgb}, ${a * k})`;
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(x - l, y);
    g.lineTo(x + l, y);
    g.moveTo(x, y - l * 0.6);
    g.lineTo(x, y + l * 0.6);
    g.stroke();
  }
}
