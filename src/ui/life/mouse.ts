import { rand } from '../../render/ivy';
import { SIZE, clamp01, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/**
 * The field mouse that lives in the burlap sack: every so often it comes up
 * from behind the top of the roll somewhere along it, looks about, sniffs,
 * blinks, sometimes puts its paws up on the edge or runs along behind the
 * roll with only its ear tips showing, and ducks back down.
 *
 * Time is cut into slots of `SLOT` seconds; each slot holds at most one visit,
 * planned afresh off the slot's number (`plan`), so nothing carries over from
 * one to the next and no visit can run into another.
 */

/** Seconds per slot: one visit at most in each. */
const SLOT = 15;

/** Share of the slots it stays down for. */
const SKIP = 0.15;

/** How big it is drawn, against the units its shapes are written in. */
const U = SIZE * 0.9;

/** A keyed value: [seconds into the visit, value, how it moves there from the key before: 0 eased both ends, 1 speeding up, 2 slowing down]. */
type Key = [number, number, number?];

/** What one visit does, channel by channel, over `len` seconds. */
interface Plan {
  len: number;
  /** How far up: 0 out of sight, 0.42 ears over the edge, 0.84 eyes, 1 head, 1.2 shoulders with paws on the edge. */
  rise: Key[];
  /** Which way it looks: -1 left, 1 right. */
  turn: Key[];
  /** Head cocked, in radians. */
  tilt: Key[];
  /** Paws: 0 down, 0.5 up behind the edge, 1 resting on it. */
  paws: Key[];
  /** How hard it sniffs: nose and whiskers twitching, 0 to 1. */
  sniff: Key[];
  /** When it blinks. */
  blinks: number[];
  /** When an ear flicks: [time, which ear]. */
  flicks: Array<[number, number]>;
  /** How far along the edge it has run, behind the roll, as a share of `run`. */
  slide: Key[];
  /** How far it runs along the edge in all, in px, left if less than 0. */
  run: number;
}

/** The value of `keys` at `s`: held before the first and after the last, eased between. */
function at(keys: Key[], s: number): number {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (s < t1) {
      const [t0, v0] = keys[i - 1];
      const u = (s - t0) / (t1 - t0);
      const k = e === 1 ? u * u * u : e === 2 ? 1 - (1 - u) ** 3 : u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * k;
    }
  }
  return keys[keys.length - 1][1];
}

/** Moves a channel to `v` between `t0` and `t1`, holding what it had until `t0`. */
function move(ch: Key[], t0: number, t1: number, v: number, e = 0): void {
  const last = ch[ch.length - 1];
  if (t0 > last[0]) ch.push([t0, last[1]]);
  ch.push([t1, v, e]);
}

/** Visit `id`'s plan: how it comes up, two to four beats of looking about, and how it goes down. */
function plan(id: number): Plan {
  const r = (k: number): number => rnd(id, k);
  const p: Plan = { len: 0, rise: [[0, 0]], turn: [[0, 0]], tilt: [[0, 0]], paws: [[0, 0]], sniff: [[0, 0]], blinks: [], flicks: [], slide: [[0, 0]], run: 0 };
  let dir = r(2) < 0.5 ? -1 : 1;
  let s: number;
  let up = 1;
  if (r(1) < 0.45) {
    // Warily: ears first, a flick, then the eyes over the edge and a look one way, then the head.
    move(p.rise, 0, 0.5, 0.42, 2);
    p.flicks.push([0.62 + r(3) * 0.2, r(4) < 0.5 ? -1 : 1]);
    move(p.rise, 1.15, 1.5, 0.84);
    move(p.sniff, 1.4, 1.55, 0.6);
    move(p.turn, 1.65, 1.82, dir * 0.6);
    p.blinks.push(1.66);
    move(p.turn, 2.3, 2.48, 0);
    move(p.sniff, 2.3, 2.45, 0);
    move(p.rise, 2.45, 2.72, 1, 2);
    dir = -dir;
    s = 2.85;
  } else {
    // Popping up all at once, a little past and back.
    move(p.rise, 0, 0.2, 1.14, 2);
    move(p.rise, 0.2, 0.36, 0.95);
    move(p.rise, 0.36, 0.5, 1);
    p.flicks.push([0.24, -1], [0.29, 1]);
    p.blinks.push(0.62);
    s = 0.62;
  }
  const beats = 2 + Math.floor(r(5) * 3);
  let pawed = false;
  for (let i = 0; i < beats; i++) {
    const b = r(10 + i), hold = 0.5 + r(20 + i) * 0.5;
    if (b < 0.36) {
      // A look to one side, sniffing that way, with a blink as the head turns.
      move(p.turn, s, s + 0.17, dir * (0.6 + r(30 + i) * 0.25));
      move(p.sniff, s, s + 0.12, 0.5 + r(40 + i) * 0.5);
      if (r(50 + i) < 0.6) p.blinks.push(s + 0.03);
      move(p.sniff, s + 0.17 + hold * 0.7, s + 0.17 + hold, 0.15);
      s += 0.17 + hold;
      dir = -dir;
    } else if (b < 0.54 && !pawed) {
      // Paws up on the edge, lifting the shoulders over it.
      move(p.paws, s, s + 0.38, 1, 2);
      move(p.rise, s, s + 0.3, 1.2);
      p.flicks.push([s + 0.32, r(60 + i) < 0.5 ? -1 : 1]);
      up = 1.2;
      pawed = true;
      s += 0.38 + hold * 0.6;
    } else if (b < 0.72 && !pawed && !p.run) {
      // Off along the edge behind the roll, only the tips of its ears showing, and up again further on.
      const go = r(70 + i) < 0.5 ? -1 : 1, dur = 0.45 + r(80 + i) * 0.2;
      p.run = go * (22 + r(90 + i) * 14);
      move(p.turn, s, s + 0.12, go * 0.75);
      move(p.rise, s + 0.06, s + 0.24, 0.34, 1);
      move(p.slide, s + 0.2, s + 0.2 + dur, 1);
      move(p.rise, s + 0.2 + dur - 0.04, s + 0.36 + dur, 1.1, 2);
      move(p.rise, s + 0.36 + dur, s + 0.5 + dur, 1);
      p.flicks.push([s + 0.4 + dur, go]);
      move(p.turn, s + 0.55 + dur, s + 0.72 + dur, -go * 0.6);
      p.blinks.push(s + 0.56 + dur);
      dir = go;
      s += 0.72 + dur + hold * 0.6;
    } else if (b < 0.84) {
      // A good sniff straight ahead: nose up, the whole head lifting with it.
      move(p.turn, s, s + 0.14, 0);
      move(p.sniff, s, s + 0.12, 1);
      move(p.rise, s, s + 0.2, up + 0.07);
      move(p.rise, s + 0.75, s + 0.95, up);
      move(p.sniff, s + 0.75, s + 0.95, 0.1);
      s += 1;
    } else {
      // Head cocked to one side, a slow blink, and back.
      move(p.tilt, s, s + 0.2, dir * 0.24, 2);
      p.blinks.push(s + 0.35, s + 0.62);
      move(p.tilt, s + 0.85, s + 1.05, 0);
      s += 1.05;
    }
  }
  // Down again: a twitch of the ears, paws off, a little lift, then gone, fast.
  p.flicks.push([s - 0.05, -1], [s - 0.02, 1]);
  if (pawed) move(p.paws, s, s + 0.17, 0, 1);
  const top = at(p.rise, s);
  move(p.rise, s + 0.04, s + 0.14, top + 0.06, 2);
  move(p.rise, s + 0.14, s + 0.32, -0.15, 1);
  move(p.turn, s, s + 0.2, at(p.turn, s) * 0.3);
  p.len = s + 0.34;
  return p;
}

/**
 * The top of the roll's ink along the top of the sack, at x: the burlap
 * painter's lumpy outer edge (`lumps` and `lumpyRect` in runecut-frames.ts,
 * made off `rand(seed * 7 + 3)` as `paintFrame` makes it), less half its 2 px
 * of ink, so what is behind the roll is cut off just where the roll begins.
 */
function edgeOf(p: LifePiece): (x: number) => number {
  const R = rand(p.seed * 7 + 3);
  const p1 = R() * Math.PI * 2, p2 = R() * Math.PI * 2;
  const x0 = 0.6 + p.F * 0.85;
  return (x) => {
    const s = x - x0;
    const L = 0.5 + 0.3 * Math.sin((s / 53) * Math.PI * 2 + p1) + 0.2 * Math.sin((s / 21) * Math.PI * 2 + p2);
    return 0.6 - (8.6 * L - 3.2) - 1;
  };
}

/** The mouse's colours, opaque, as #rrggbb. */
interface Palette {
  ink: string; fur: string; furDark: string; furLit: string; furShade: string; cream: string; chestShade: string;
  paw: string; toes: string; earIn: string; earInLit: string; blush: string; nose: string; noseLit: string;
  eye: string; whisker: string; mouth: string;
}

/** By day. */
const DAY: Palette = {
  ink: '#3d2a1c', fur: '#9a8677', furDark: '#7a675b', furLit: '#bba999', furShade: '#6b5a4e', cream: '#efe3d0', chestShade: '#a89684',
  paw: '#e6b5ad', toes: '#a8706a', earIn: '#de8d97', earInLit: '#f6bcc0', blush: '#f0b4b9', nose: '#e0808b', noseLit: '#fff0f2',
  eye: '#1c1311', whisker: '#6b5a50', mouth: '#7a5650',
};

/** After dark: each colour under the night, as the sack is (`underNight`). */
const NIGHT: Palette = Object.fromEntries(Object.entries(DAY).map(([k, v]) => [k, underNight(v)])) as unknown as Palette;

/** A shape outlined in ink: the ink laid wide first and the fill over it, so only its outside shows. */
function inked(g: Ctx, c: Palette, shape: () => void, fill: string | CanvasGradient, ink = 1.1): void {
  shape();
  g.strokeStyle = c.ink;
  g.lineWidth = ink;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

/** A paw at (x, y): a small pink hand with three toes, `sq` flattened where it rests. */
function paw(g: Ctx, c: Palette, x: number, y: number, sq: number): void {
  inked(g, c, () => {
    g.beginPath();
    g.ellipse(x, y, 1.15 + sq * 0.15, 0.85 - sq * 0.12, 0, 0, Math.PI * 2);
  }, c.paw, 0.9);
  g.fillStyle = c.toes;
  g.beginPath();
  for (const d of [-0.5, 0, 0.5]) {
    g.moveTo(x + d + 0.2, y + 0.5);
    g.arc(x + d, y + 0.5, 0.2, 0, Math.PI * 2);
  }
  g.fill();
}

/** An arm from the shoulder at (sx, sy) to the hand at (hx, hy), in fur, ending in its paw. */
function arm(g: Ctx, c: Palette, sx: number, sy: number, hx: number, hy: number, sq: number): void {
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(sx, sy);
  g.quadraticCurveTo((sx + hx) / 2 + (hx - sx) * 0.2, sy, hx, hy - 0.4);
  g.strokeStyle = c.ink;
  g.lineWidth = 2.2;
  g.stroke();
  g.strokeStyle = c.fur;
  g.lineWidth = 1.4;
  g.stroke();
  paw(g, c, hx, hy, sq);
}

/** The mouse at `t` on the burlap piece `p`, if it is up now, in the night's light after dark: nothing drawn while it is down in the sack. */
export function mouse(g: Ctx, p: LifePiece, t: number, night = false): void {
  const tt = t + (p.seed % 1009) * 0.61;
  const n = Math.floor(tt / SLOT), id = n + (p.seed % 997) * 1000;
  if (rnd(id, 91) < SKIP) return;
  const pl = plan(id);
  const c = night ? NIGHT : DAY;
  const start = 1 + rnd(id, 90) * Math.max(0, SLOT - pl.len - 2);
  const s = tt - n * SLOT - start;
  if (s <= 0 || s >= pl.len) return;

  // Somewhere along the top clear of the knot and the gathered corner, with room for any run along it.
  let lo = Math.max(p.w * 0.36, p.F * 3), hi = p.w - p.F * 2.1, run = pl.run;
  if (hi - lo < Math.abs(run)) run = 0;
  lo -= Math.min(0, run);
  hi -= Math.max(0, run);
  const slide = at(pl.slide, s), scurry = Math.abs(slide - at(pl.slide, s - 1 / 30)) * 30;
  const x = (hi > lo ? lerp(lo, hi, rnd(id, 92)) : p.w / 2) + run * slide;
  const edge = edgeOf(p);
  const e0 = edge(x);

  // The channels now, and how fast it is rising, for its stretch and its ears' drag.
  const rise = at(pl.rise, s) + 0.012 * Math.sin(s * 4.5) + Math.min(1, scurry) * 0.035 * Math.sin(s * 40);
  const vel = (at(pl.rise, s) - at(pl.rise, s - 1 / 30)) * 30;
  const turn = at(pl.turn, s) + 0.05 * Math.sin(s * 1.9), tilt = at(pl.tilt, s), paws = at(pl.paws, s), sniff = at(pl.sniff, s);
  const lagTurn = at(pl.turn, s - 0.09) + 0.05 * Math.sin((s - 0.09) * 1.9);
  let blink = 0;
  for (const b of pl.blinks) {
    const d = s - b;
    if (d > 0 && d < 0.17) blink = Math.max(blink, d < 0.05 ? d / 0.05 : d < 0.08 ? 1 : 1 - (d - 0.08) / 0.09);
  }
  const sn = 0.2 + sniff * 0.8;
  const twitch = Math.sin(s * Math.PI * 2 * 7.5) * sn;
  const twitchLag = Math.sin(s * Math.PI * 2 * 7.5 - 1.1) * sn;
  const stretch = 1 + Math.min(0.14, Math.abs(vel) * 0.025);

  // Where the head is: its middle `cy` units over (under, while it is low) the edge at x.
  const cy = 10 - rise * 14;
  const sh = cy + 6.6;

  g.save();
  g.translate(x, e0);
  g.scale(U, U);
  g.lineJoin = 'round';

  // Behind the roll: nothing of it below the top of the roll's ink.
  g.save();
  g.beginPath();
  g.moveTo(-20 / U, -60 / U);
  g.lineTo(20 / U, -60 / U);
  for (let k = 20; k >= -20; k -= 2) g.lineTo(k / U, (edge(x + k) - e0) / U);
  g.closePath();
  g.clip();

  // Its shoulders and chest, in the roll's shade where they go down behind it.
  const body = g.createLinearGradient(0, -3.5, 0, 0.5);
  body.addColorStop(0, c.fur);
  body.addColorStop(1, c.furShade);
  inked(g, c, () => {
    g.beginPath();
    g.ellipse(turn * 0.6, sh, 5.4, 5.8, 0, 0, Math.PI * 2);
  }, body);
  const chest = g.createLinearGradient(0, -3.5, 0, 0.5);
  chest.addColorStop(0, c.cream);
  chest.addColorStop(1, c.chestShade);
  g.fillStyle = chest;
  g.beginPath();
  g.ellipse(turn * 1.4, sh + 1.2, 2.8, 4, 0, 0, Math.PI * 2);
  g.fill();

  // The paws, while they are still coming up behind the edge.
  const handX = (sd: number): number => sd * 2.1 + turn * 0.8;
  const handY = (sd: number): number => (edge(x + handX(sd) * U) - e0) / U;
  if (paws > 0.01 && paws <= 0.5) {
    for (const sd of [-1, 1]) {
      const hx = handX(sd), hy = handY(sd) + lerp(4, -2.1, paws / 0.5);
      arm(g, c, sd * 2.7 + turn * 0.6, sh - 2.6, hx, hy, 0);
    }
  }

  // The head, from its middle, cocked and stretched as it moves.
  g.save();
  g.translate(0, cy);
  g.rotate(tilt + (turn - lagTurn) * 0.15);
  g.scale(1 / Math.sqrt(stretch), stretch);

  // Ears: round and big, trailing the head's turn and its rise, flicking now and then; both laid at once, layer by layer.
  const ears: Array<[number, number, number, number, number]> = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn < 0 ? 1 : 0;
    let ang = sd * (0.32 + Math.sin(s * 1.7 + sd) * 0.03) + (lagTurn - turn) * 0.9 + sd * clamp01(-vel * 0.12) * 0.35;
    for (const [ft, fe] of pl.flicks) {
      const d = s - ft;
      if (fe === sd && d > 0 && d < 0.6) ang += sd * 0.38 * Math.sin(d * Math.PI * 2 * 4.5) * Math.exp(-d * 7);
    }
    const ex = sd * 3.3 - lagTurn * 1.1, ey = -3.3 + clamp01(vel * 0.06) * 0.8 - clamp01(-vel * 0.06) * 0.6;
    ears.push([ex, ey, ang, 3.15 * (1 - far * Math.abs(turn) * 0.12), sd]);
  }
  /** Each ear's ellipse `rx` × `ry` round (a, b) in the ear's own turned frame, added to one path. */
  const earPath = (a: number, b: number, rx: number, ry: number): void => {
    g.beginPath();
    for (const [ex, ey, ang, er, sd] of ears) {
      const c = Math.cos(ang), n = Math.sin(ang), ax = a * sd * er, by = b * er;
      const cx = ex + ax * c - by * n, cy2 = ey + ax * n + by * c;
      g.moveTo(cx + rx * er * c, cy2 + rx * er * n);
      g.ellipse(cx, cy2, rx * er, ry * er, ang, 0, Math.PI * 2);
    }
  };
  inked(g, c, () => earPath(0, -0.75, 1, 1.02), c.furDark);
  earPath(-0.05, -0.68, 0.66, 0.72);
  g.fillStyle = c.earIn;
  g.fill();
  earPath(-0.1, -0.58, 0.44, 0.5);
  g.fillStyle = c.earInLit;
  g.fill();

  // The head: round, with fluffed cheeks and a snout that points the way it looks.
  const sx = turn * 2.6;
  const fur = g.createRadialGradient(-1.6, -2.2, 0.5, 0, 0, 6);
  fur.addColorStop(0, c.furLit);
  fur.addColorStop(1, c.fur);
  inked(g, c, () => {
    g.beginPath();
    g.ellipse(0, 0, 4.7, 4.1, 0, 0, Math.PI * 2);
    g.moveTo(sx + 2.8, 1.4);
    g.ellipse(sx, 1.4, 2.8 - Math.abs(turn) * 0.2, 2.3, 0, 0, Math.PI * 2);
    for (const sd of [-1, 1]) {
      const cx = sd * 4.3 - turn * 0.6;
      g.moveTo(cx + 1.3, 1.5);
      g.ellipse(cx, 1.5, 1.3, 1.1, sd * 0.5, 0, Math.PI * 2);
    }
  }, fur);
  g.fillStyle = c.cream;
  g.beginPath();
  g.ellipse(sx * 0.95, 2.1, 2.5, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c.blush;
  g.globalAlpha = 0.4;
  g.beginPath();
  for (const sd of [-1, 1]) {
    g.moveTo(sd * 2.9 + turn * 1.3 + 1, 1.25);
    g.ellipse(sd * 2.9 + turn * 1.3, 1.25, 1, 0.6, 0, 0, Math.PI * 2);
  }
  g.fill();
  g.globalAlpha = 1;

  // Eyes: big and dark with a glint, the far one narrower as it turns; shut to a line when it blinks.
  const eyes = [-1, 1].map((sd) => {
    const far = sd * turn < 0 ? Math.abs(turn) : 0;
    return [sd * 1.9 + turn * 1.5 - sd * far * 0.3, -0.55, 1.2 * (1 - far * 0.35), 1.3 * (1 - blink * 0.92)];
  });
  g.beginPath();
  if (blink > 0.75) {
    for (const [ex, ey, rx] of eyes) {
      g.moveTo(ex + rx * Math.cos(0.1), ey + 0.45 * Math.sin(0.1));
      g.ellipse(ex, ey, rx, 0.45, 0, 0.1, Math.PI - 0.1);
    }
    g.strokeStyle = c.eye;
    g.lineWidth = 0.45;
    g.stroke();
  } else {
    for (const [ex, ey, rx, ry] of eyes) {
      g.moveTo(ex + rx, ey);
      g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    }
    g.fillStyle = c.eye;
    g.fill();
    if (blink < 0.4) {
      for (const [big, a] of [[1, 1], [0, 0.7]]) {
        g.beginPath();
        for (const [ex, ey, rx, ry] of eyes) {
          const hx = big ? ex - rx * 0.35 + turn * 0.15 : ex + rx * 0.35, hy = big ? ey - ry * 0.38 : ey + ry * 0.38, hr = big ? 0.44 : 0.18;
          g.moveTo(hx + hr, hy);
          g.arc(hx, hy, hr, 0, Math.PI * 2);
        }
        g.fillStyle = `rgba(255, 255, 255, ${a})`;
        g.fill();
      }
    }
  }

  // Nose and whiskers, twitching as it sniffs, the whiskers a beat behind the nose.
  const nx = turn * 4.6, ny = 1.15 - sniff * 0.25 + twitch * 0.22;
  g.strokeStyle = c.whisker;
  g.globalAlpha = 0.75;
  g.lineWidth = 0.32;
  g.lineCap = 'round';
  g.beginPath();
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * 0.28 + 0.08 + twitchLag * 0.1 + Math.sin(s * 2.3 + k) * 0.03;
      const ox = nx + sd * 1.1, oy = ny + 0.7, len = 4.6 - Math.abs(k - 1) * 0.6 - (sd * turn < 0 ? Math.abs(turn) * 1.6 : 0);
      g.moveTo(ox, oy);
      g.quadraticCurveTo(ox + sd * len * 0.5, oy + Math.sin(a) * len * 0.4 - 0.3, ox + sd * Math.cos(a) * len, oy + Math.sin(a) * len);
    }
  }
  g.stroke();
  g.strokeStyle = c.mouth;
  g.lineWidth = 0.3;
  g.beginPath();
  g.moveTo(nx, ny + 0.6);
  g.lineTo(nx, ny + 1.15);
  g.moveTo(nx - 0.6, ny + 1.4);
  g.quadraticCurveTo(nx - 0.3, ny + 1.5, nx, ny + 1.15);
  g.quadraticCurveTo(nx + 0.3, ny + 1.5, nx + 0.6, ny + 1.4);
  g.stroke();
  g.globalAlpha = 1;
  inked(g, c, () => {
    g.beginPath();
    g.ellipse(nx, ny, 0.85 + twitch * 0.08, 0.68 - twitch * 0.05, 0, 0, Math.PI * 2);
  }, c.nose, 0.5);
  g.fillStyle = c.noseLit;
  g.beginPath();
  g.arc(nx - 0.3, ny - 0.25, 0.22, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.restore();

  // The paws once they are up: laid over the roll's lip, a little shadow under each.
  if (paws > 0.5) {
    const u = (paws - 0.5) / 0.5;
    for (const sd of [-1, 1]) {
      const hx = handX(sd) + sd * u * 0.2, top = handY(sd);
      const hy = top + lerp(-2.1, 0.35, u);
      g.fillStyle = `rgba(46, 30, 22, ${(0.32 * u).toFixed(2)})`;
      g.beginPath();
      g.ellipse(hx + 0.2, top + 1.6, 1.6, 0.7, 0, 0, Math.PI * 2);
      g.fill();
      arm(g, c, sd * 2.7 + turn * 0.6, sh - 2.6, hx, hy, u > 0.85 ? (u - 0.85) / 0.15 : 0);
    }
  }
  g.restore();
}
