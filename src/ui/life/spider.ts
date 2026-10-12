import { SIZE, clamp01, ease, glow, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/** Seconds from one visit to the next. */
const CYCLE = 34;
/** Interface px to one unit of the spider's shapes. */
const S = SIZE * 0.95;
/** The body's radius, in shape units. */
const BODY = 3;
/** Depth (px below the corner block's foot) at which every bit of it is out of sight. */
const HIDDEN = -14;
/** Depth at which only its eyes and smile show under the block. */
const PEEK = 1.6;

/** One visit, worked out from its cycle's number: when each beat starts, how deep each drop goes, which tricks it does. */
interface Plan {
  inEnd: number;
  drops: Array<{ at: number; dur: number; from: number; to: number }>;
  low: number;
  gags: Array<{ kind: 0 | 1 | 2; at: number; dur: number }>;
  climbAt: number;
  strides: number;
  strideDur: number;
  topAt: number;
  zipAt: number;
  end: number;
  /** Where its eyes turn to from each moment on: [time, x, y]. */
  looks: Array<[number, number, number]>;
}

/** How long each trick takes: a wave, a spin on the thread, a happy bounce. */
const GAG_DUR = [2.6, 2.4, 2.0];

function plan(k: number, seed: number, reach: number): Plan {
  const r = (n: number): number => rnd(k * 7.31 + n, seed);
  const inEnd = 0.9;
  const looks: Array<[number, number, number]> = [[0, 0, 0.2], [inEnd + 0.2, -0.45, 0.1], [inEnd + 0.9, 0.4, 0.05]];
  let at = inEnd + 1.6 + r(1) * 0.8;
  const n = r(2) < 0.45 ? 2 : 3;
  const total = reach * (0.72 + 0.28 * r(3));
  const ws = [0.7 + r(4), 0.7 + r(5), 0.7 + r(6)].slice(0, n);
  const sum = ws.reduce((a, b) => a + b, 0);
  const drops: Plan['drops'] = [];
  let d = PEEK;
  for (let i = 0; i < n; i++) {
    const to = d + (total - PEEK) * (ws[i] / sum);
    const dur = 0.32 + 0.004 * (to - d);
    looks.push([at - 0.25, 0, 0.45]);
    drops.push({ at, dur, from: d, to });
    // After each drop: a look round, at the window, then at whoever is watching.
    looks.push([at + dur + 0.5, -0.5 + r(20 + i) * 0.3, 0.05], [at + dur + 1.2, 0, 0]);
    d = to;
    at += dur + (i < n - 1 ? 1.5 + r(10 + i) * 1.1 : 1.3);
  }
  const gags: Plan['gags'] = [];
  const first = Math.floor(r(7) * 3) as 0 | 1 | 2;
  gags.push({ kind: first, at, dur: GAG_DUR[first] });
  at += GAG_DUR[first] + 0.9;
  if (r(8) < 0.5) {
    const second = ((first + 1 + Math.floor(r(9) * 2)) % 3) as 0 | 1 | 2;
    gags.push({ kind: second, at, dur: GAG_DUR[second] });
    at += GAG_DUR[second] + 0.9;
  }
  looks.push([at - 0.3, 0, -0.45]);
  const strides = Math.max(2, Math.ceil((d - PEEK) / 7));
  const strideDur = 0.34 + r(12) * 0.08;
  const climbAt = at;
  const topAt = climbAt + strides * strideDur;
  looks.push([topAt + 0.15, 0, 0.05], [topAt + 0.75, 0.35, 0.1]);
  const zipAt = topAt + 1.2 + r(13) * 0.5;
  return { inEnd, drops, low: d, gags, climbAt, strides, strideDur, topAt, zipAt, end: zipAt + 0.3, looks };
}

/** How far below the block's foot its body's middle hangs at `u`, in px. */
function depth(pl: Plan, u: number): number {
  if (u < pl.inEnd) return lerp(HIDDEN, PEEK, 1 - (1 - u / pl.inEnd) ** 3);
  if (u >= pl.zipAt) return lerp(PEEK, HIDDEN, clamp01((u - pl.zipAt) / (pl.end - pl.zipAt)) ** 2);
  if (u >= pl.topAt) return PEEK;
  if (u >= pl.climbAt) {
    const c = (u - pl.climbAt) / pl.strideDur, j = Math.floor(c);
    return lerp(pl.low, PEEK, (j + ease(c - j)) / pl.strides);
  }
  let d = PEEK;
  for (const dr of pl.drops) {
    // A little hitch up before it lets go.
    if (u < dr.at) {
      const a = (u - (dr.at - 0.24)) / 0.24;
      if (a > 0) d -= 1.3 * Math.sin(a * Math.PI);
      break;
    }
    const x = (u - dr.at) / dr.dur;
    if (x < 1) return lerp(dr.from, dr.to, x * x * (3 - 2 * x) * 0.6 + x * x * 0.4);
    // The silk gives and springs back after the drop.
    const s = u - dr.at - dr.dur;
    d = dr.to + (dr.to - dr.from) * 0.16 * Math.exp(-s * 4.2) * Math.sin(s * 13);
  }
  for (const gg of pl.gags) {
    const x = (u - gg.at) / gg.dur;
    // The happy bounce: a kick, up on the silk and down twice.
    if (gg.kind === 2 && x > 0 && x < 1) d -= 3.2 * Math.abs(Math.sin(x * Math.PI * 2)) * (1 - x * 0.45);
  }
  return d;
}

/** Sideways swing of its body at `u`, px: a breeze, a sway after each drop, a rock as each hand pulls. */
function swing(pl: Plan, u: number, ph: number): number {
  const climbing = u > pl.climbAt && u < pl.topAt;
  let x = (climbing ? 0.3 : 0.65) * Math.sin(u * 1.7 + ph) + 0.25 * Math.sin(u * 2.9 + ph * 2);
  pl.drops.forEach((dr, i) => {
    const s = u - dr.at - dr.dur;
    if (s > 0) x += (i % 2 ? -1 : 1) * 1.5 * Math.exp(-s * 0.7) * Math.sin(s * 2.6);
  });
  if (climbing) {
    const c = (u - pl.climbAt) / pl.strideDur, j = Math.floor(c);
    x += (j % 2 ? -1 : 1) * 0.55 * Math.sin((c - j) * Math.PI);
  }
  // Never further in than the band's inner edge allows its legs.
  return Math.max(-2, Math.min(2.6, x));
}

/** Where its eyes are turned at `u`: each new look is reached in a quick, eased glance. */
function look(pl: Plan, u: number): [number, number] {
  let i = 0;
  while (i + 1 < pl.looks.length && pl.looks[i + 1][0] <= u) i++;
  const [t0, x1, y1] = pl.looks[i], prev = pl.looks[Math.max(0, i - 1)];
  const a = ease(clamp01((u - t0) / 0.14));
  return [lerp(prev[1], x1, a), lerp(prev[2], y1, a)];
}

/** The spider's colours, opaque, as #rrggbb (eye glints are always white). */
interface Palette {
  threadShadow: string; thread: string; silkLit: string; glint: string; shadow: string; leg: string; body: string; bodyShade: string;
  rim: string; sheen: string; blush: string; ink: string; eye: string; heart: string;
}

/** By day. */
const DAY: Palette = {
  threadShadow: '#50341e', thread: '#fffcf4', silkLit: '#ffffff', glint: '#fffae1', shadow: '#462c1a', leg: '#3f2c47', body: '#62496b', bodyShade: '#4b3554',
  rim: '#33233a', sheen: '#ffecfa', blush: '#f496a8', ink: '#20161f', eye: '#fffdf6', heart: '#f3dcc0',
};

/** After dark: each colour under the night, as the crate is (`underNight`). */
const NIGHT = Object.fromEntries(Object.entries(DAY).map(([k, v]) => [k, underNight(v)])) as unknown as Palette;

/** A #rrggbb colour as "r, g, b". */
const rgbOf = (hex: string): string => `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

/** A #rrggbb colour at opacity `a`, as css. */
const fade = (hex: string, a: number): string => `rgba(${rgbOf(hex)}, ${a})`;

/**
 * A little round plum spider that lives in the joint under the crate's top
 * right corner block. Every so often it peeks out, lets itself down the right
 * side on its thread in two or three drops, swings and bobs, waves a leg,
 * spins round or bounces on the silk, then climbs back hand over hand, peeks
 * once more and slips back in. Its thread catches the light. After dark its
 * colours sit under the night as its frame's do.
 */
export function spider(g: Ctx, p: LifePiece, t: number, night = false): void {
  const { w, h, F } = p;
  const col = night ? NIGHT : DAY;
  const top = F * 1.14 + 0.1, xt = w - F * 0.56;
  // Its lowest drop stops clear of the bar handle's upper mount, or of the lower corner where there is none.
  const floor = h > F * 7 ? h * 0.56 - F * 1.72 : h - F * 1.6;
  const reach = Math.min(floor - 17 - top, 112);
  if (reach < 12) return;
  const tt = t + rnd(p.seed, 3.7) * CYCLE, k = Math.floor(tt / CYCLE), u = tt - k * CYCLE;
  const pl = plan(k, p.seed, reach);
  if (u >= pl.end) return;
  const ph = rnd(k, p.seed + 1) * 6.28;

  const d = depth(pl, u);
  // Legs trail what the body did a moment ago: that lag is their follow-through.
  const vy = (depth(pl, u - 0.05) - depth(pl, u - 0.11)) / 0.06;
  const L = Math.max(0, d - BODY * S);
  const sway = clamp01(L / 30);
  const sx = swing(pl, u, ph) * sway;
  const vx = (swing(pl, u - 0.06, ph) - swing(pl, u - 0.12, ph)) / 0.06 * sway;

  // What it is doing now.
  let wave = 0, waveAt = 0, spin = 0, flare = 0, happy = false, wobble = 0, pump = 0;
  for (const gg of pl.gags) {
    const x = (u - gg.at) / gg.dur;
    if (x <= 0) continue;
    if (gg.kind === 0 && x < 1) {
      wave = ease(clamp01(x / 0.15)) * ease(clamp01((1 - x) / 0.15));
      waveAt = gg.at;
      happy = x > 0.12 && x < 0.9;
    } else if (gg.kind === 1) {
      const a = clamp01(x / 0.62);
      spin = ease(a) * Math.PI * 2;
      flare = Math.sin(a * Math.PI);
      // A dizzy wobble once round.
      const s = (x - 0.62) * gg.dur;
      if (s > 0) wobble = 0.22 * Math.exp(-s * 2.6) * Math.sin(s * 9);
    } else if (gg.kind === 2 && x < 1) {
      pump = Math.sin(x * Math.PI);
      happy = x > 0.05 && x < 0.95;
    }
  }
  const climbing = u > pl.climbAt && u < pl.topAt;
  const cc = climbing ? (u - pl.climbAt) / pl.strideDur : 0;

  // Blinks, every few seconds, never in step from one visit to the next.
  const bj = Math.floor(u / 2.7), bt = bj * 2.7 + 0.4 + rnd(bj, k + p.seed) * 1.6;
  const shut = clamp01(1 - Math.abs(u - bt - 0.08) / 0.08);
  const [lx, ly] = look(pl, u);

  // A slow breath on the silk while it hangs.
  const cy = top + d + 0.4 * Math.sin(u * 2.3 + ph) * sway, cx = xt + sx;
  // It leans away from the leg it waves, and rocks as it bounces.
  const tilt = Math.atan2(sx, Math.max(8, L + BODY * S)) + wobble - 0.13 * wave + 0.08 * pump * Math.sin(u * 5);
  const ax = cx + Math.sin(tilt) * BODY * S, ay = cy - Math.cos(tilt) * BODY * S;

  g.save();
  // Out from under the corner block's foot: nothing of it above that edge.
  g.beginPath();
  g.rect(xt - F, top, F * 2, h);
  g.clip();

  // The thread, with its faint shadow on the plank, and where it catches the light.
  if (ay > top) {
    g.lineCap = 'round';
    g.strokeStyle = fade(col.threadShadow, 0.2);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(xt + 1.2, top);
    g.lineTo(ax + 1.4, ay + 1.6);
    g.stroke();
    g.strokeStyle = fade(col.thread, 0.9);
    g.lineWidth = 0.75;
    g.beginPath();
    g.moveTo(xt, top);
    g.lineTo(ax, ay);
    g.stroke();
    const f = clamp01(0.5 + 0.38 * Math.sin(u * 0.8 + ph) + sx * 0.06);
    const gx = lerp(xt, ax, f), gy = lerp(top, ay, f);
    const shine = 0.35 + 0.65 * Math.sin(u * 1.3 + ph) ** 2;
    const len = Math.min(5, (ay - top) * 0.3);
    if (len > 0.5) {
      const dx = (ax - xt) / (ay - top);
      g.strokeStyle = fade(col.silkLit, shine);
      g.lineWidth = 1.05;
      g.beginPath();
      g.moveTo(gx - dx * len, gy - len);
      g.lineTo(gx + dx * len, gy + len);
      g.stroke();
      glow(g, gx, gy, 4.5, rgbOf(col.glint), 0.55 * shine);
      // A tiny star when the light is full on it.
      const star = clamp01((shine - 0.85) / 0.15);
      if (star > 0) {
        const sr = 2.6 * star;
        g.strokeStyle = fade(col.silkLit, star * 0.9);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(gx - sr, gy);
        g.lineTo(gx + sr, gy);
        g.moveTo(gx, gy - sr);
        g.lineTo(gx, gy + sr);
        g.stroke();
      }
    }
  }

  // Its shadow on the plank, below and to the right, as the frame's own fall.
  g.fillStyle = fade(col.shadow, 0.18);
  g.beginPath();
  g.ellipse(cx + 1.5, cy + 2, BODY * S, BODY * S * 0.92, 0, 0, Math.PI * 2);
  g.fill();

  g.translate(cx, cy);
  g.rotate(tilt);
  g.scale(S, S);
  // Stretched as it falls, squashed as the silk catches.
  const stretch = Math.max(-0.12, Math.min(0.12, vy / 500));
  const sy = 1 + stretch - pump * 0.05 * Math.sin(u * 20);

  // The legs: four a side, each from hip over a raised knee to its foot.
  const cs = Math.cos(spin);
  const dv = Math.tanh(vy / 70), dx = Math.tanh(vx / 9);
  const paddle = u * 2.6 + ph;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = col.leg;
  g.lineWidth = 0.8;
  g.beginPath();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const ha = -0.72 + i * 0.48;
      const hx = BODY * 0.8 * Math.cos(ha), hy = BODY * 0.8 * Math.sin(ha);
      let fx = [4.3, 5.3, 5.2, 4.1][i], fy = [-2.7, -0.3, 2.2, 4.3][i];
      let bend = 1.55 + 0.2 * Math.sin(paddle + i);
      const wav = Math.sin(paddle + i * 1.1 + (s > 0 ? 0 : 2.3));
      fy += 0.35 * wav;
      fx += 0.15 * wav;
      // Lifted by the air as it falls, hanging as it is drawn up.
      fy -= dv * (1.2 + i * 0.55);
      fx -= Math.abs(dv) * 0.3 * i;
      // Trailing the swing.
      fx -= s * dx * (0.5 + i * 0.25);
      // Kicking in time with the bounce, flung out by the spin.
      fy -= pump * 0.9 * Math.abs(Math.sin(u * 10 + i * 0.8 + (s > 0 ? 0 : 1.6)));
      fx += flare * 0.9;
      fy += flare * (i - 1.5) * 0.35;
      if (climbing && i < 2) {
        const j = Math.floor(cc), a = ease(cc - j), stride = 7 / S;
        const grip = (j % 2 === 0) === (s > 0);
        if (i === 0) {
          fx = 0.55;
          fy = grip ? -BODY - 0.6 - stride * (1 - a) : -BODY - 0.6 - stride * a;
          if (!grip) fx += 2 * Math.sin(a * Math.PI);
          bend = 1.4;
        } else {
          fx = 3.4;
          fy = -2.8 - (grip ? 1 - a : a) * 1.2;
        }
      }
      // The wave: one front leg up high, its foot waggling.
      const wv = s > 0 && i === 0 ? wave : 0;
      if (wv > 0) {
        const wg = Math.sin((u - waveAt) * 12);
        fx = lerp(fx, 2.7 + 1.1 * wg, wv);
        fy = lerp(fy, -6.6 + 0.4 * Math.abs(wg), wv);
        bend = lerp(bend, 1.2, wv);
      }
      // The knee: out from the middle of hip to foot, on the upper side.
      const mx = (hx + fx) / 2, my = (hy + fy) / 2;
      let nx = fy - hy, ny = -(fx - hx);
      const nl = Math.hypot(nx, ny) || 1;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const kx = mx + (nx / nl) * bend * 2, ky = my + (ny / nl) * bend * 2;
      // Turned with the spin: front legs reach a little toward us, back legs away.
      const z = 1.2 - i * 0.8, sn = Math.sin(spin);
      g.moveTo(s * hx * cs + z * 0.4 * sn, hy * sy);
      g.quadraticCurveTo(s * kx * cs + z * 0.8 * sn, ky * sy, s * fx * cs + z * sn, fy * sy);
    }
  }
  g.stroke();

  // The body: a plum ball, inked round, lit from the upper left.
  g.save();
  g.scale(1, sy);
  g.beginPath();
  g.arc(0, 0, BODY, 0, Math.PI * 2);
  g.fillStyle = col.body;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = col.bodyShade;
  g.beginPath();
  g.arc(0.9, 1.1, BODY, 0, Math.PI * 2);
  g.arc(-0.5, -0.5, BODY * 1.02, 0, Math.PI * 2, true);
  g.fill();
  g.restore();
  g.strokeStyle = col.rim;
  g.lineWidth = 0.5;
  g.beginPath();
  g.arc(0, 0, BODY, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = fade(col.sheen, 0.32);
  g.beginPath();
  g.ellipse(-1.15, -1.55, 0.95, 0.55, -0.6, 0, Math.PI * 2);
  g.fill();

  // Its face (and the cream heart on its back), carried round as it spins.
  const R = BODY * 0.92;
  const at = (lon: number): [number, number] => [R * Math.sin(lon + spin), Math.cos(lon + spin)];
  for (const s of [-1, 1]) {
    const [x, c] = at(s * 0.68);
    if (c < 0.05) continue;
    g.fillStyle = fade(col.blush, 0.6);
    g.beginPath();
    g.ellipse(x, 1.05, 0.6 * c, 0.36, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const s of [-1, 1]) {
    const [x, c] = at(s * 0.4);
    if (c < 0.05) continue;
    const ey = -0.35 + ly * 0.25;
    if (happy) {
      g.strokeStyle = col.ink;
      g.lineWidth = 0.45;
      g.beginPath();
      g.moveTo(x - 0.75 * c, ey + 0.35);
      g.quadraticCurveTo(x, ey - 0.75, x + 0.75 * c, ey + 0.35);
      g.stroke();
      continue;
    }
    const open = 1 - shut;
    g.fillStyle = col.eye;
    g.beginPath();
    g.ellipse(x, ey, 1.08 * c, 1.15 * Math.max(0.12, open), 0, 0, Math.PI * 2);
    g.fill();
    if (open < 0.35) {
      g.strokeStyle = col.ink;
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(x - 0.9 * c, ey);
      g.lineTo(x + 0.9 * c, ey);
      g.stroke();
      continue;
    }
    const px = x + lx * 0.4 * c, py = ey + ly * 0.35;
    g.fillStyle = col.ink;
    g.beginPath();
    g.ellipse(px, py, 0.7 * c, 0.74 * open, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(px - 0.25 * c, py - 0.3 * open, 0.27, 0, Math.PI * 2);
    g.arc(px + 0.24 * c, py + 0.26 * open, 0.12, 0, Math.PI * 2);
    g.fill();
  }
  {
    const [x, c] = at(0);
    if (c > 0.1) {
      g.strokeStyle = col.ink;
      g.lineWidth = 0.38;
      g.beginPath();
      if (happy) g.ellipse(x, 1.25, 0.42 * c, 0.32, 0, 0, Math.PI);
      else g.ellipse(x, 1.1, 0.38 * c, 0.28, 0, 0.15, Math.PI - 0.15);
      g.stroke();
    }
  }
  {
    const [x, c] = at(Math.PI);
    if (c > 0.05) {
      g.fillStyle = col.heart;
      g.save();
      g.translate(x, 0.1);
      g.scale(c, 1);
      g.beginPath();
      g.moveTo(0, 1.1);
      g.bezierCurveTo(-1.6, 0, -1, -1.3, 0, -0.5);
      g.bezierCurveTo(1, -1.3, 1.6, 0, 0, 1.1);
      g.fill();
      g.restore();
    }
  }
  g.restore();
  g.restore();
}
