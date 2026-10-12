import { clamp01, ease, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/*
 * A snail on Runecut's stone pillars (the Skills window). Each climb it shows
 * as a shell at the foot of one pillar, comes out, and climbs the shaft one
 * ripple of its foot at a time: the head stretches forward, then the tail
 * gathers up behind. It stops now and then to look about, to flinch or to
 * hide in its shell a moment, and once to nibble a new leaf on the pillar's
 * ivy; at the top it stretches up to look, then climbs on behind the capital.
 * Its wet trail shines behind it and dries.
 *
 * Drawn for the left pillar; the right one is the same, mirrored.
 */

/** Seconds from one snail showing at the foot of a pillar to the next. */
const CYCLE = 150;
/** Seconds one ripple of the foot takes. */
const STRIDE = 2.1;
/** Seconds after showing that it starts to climb. */
const START = 7.4;
/** The head's and the tail tip's places at rest, px forward of the shell's middle; half the body's width; the shell's radius. */
const HEAD = 13, TAIL = -11, HALF = 3.3, SHELL = 6.8;
/** How long the trail stays wet, in seconds. */
const WET = 40;

/** Its colours by day, each as `#rrggbb` and how strong. */
const COLOURS = {
  leaf: ['#a9d494', 1], leafInk: ['#4a7156', 1],
  shellHi: ['#f6d29a', 1], shellMid: ['#dc9b5c', 1], shellLo: ['#b06d38', 1], shellInk: ['#6a4026', 1],
  whorl: ['#7a4626', 1], band: ['#ffecc8', 0.75], gloss: ['#fffcf0', 0.85], glint: ['#fffdf6', 1],
  wet: ['#76688c', 1], sheen: ['#ffffff', 1], sparkA: ['#ece2ff', 1], sparkB: ['#e2faff', 1],
  shade: ['#463452', 0.2], body: ['#e0bc9f', 1], bodyInk: ['#7f5846', 1], back: ['#fff6ec', 0.6],
  feeler: ['#9a735e', 1], blush: ['#ec8c96', 0.7], stalk: ['#94705b', 1], eye: ['#3a2a2c', 1], shine: ['#ffffff', 1],
} as const;
type Palette = Record<keyof typeof COLOURS, string>;
/** The colours as css, each through `tone`: as they are by day, under the night (`underNight`) after dark, all but the glint in its eyes. */
function palette(tone: (hex: string) => string): Palette {
  const out = {} as Palette;
  for (const [name, [hex, a]] of Object.entries(COLOURS) as Array<[keyof typeof COLOURS, readonly [string, number]]>) {
    const c = name === 'shine' ? hex : tone(hex);
    out[name] = `rgba(${[1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ')}, ${a})`;
  }
  return out;
}
const DAY = palette((c) => c), NIGHT = palette(underNight);
/** A palette colour, its strength times `a`. */
const css = (c: string, a = 1): string => {
  if (a === 1) return c;
  const i = c.lastIndexOf(',');
  return `${c.slice(0, i)}, ${parseFloat(c.slice(i + 1)) * a})`;
};

/** Ease out with a little overshoot: for what pops out. */
const back = (u: number): number => {
  const v = clamp01(u) - 1;
  return 1 + v * v * (2.6 * v + 1.6);
};
/** 0 to 1 and back over a window `a`..`b`, `e` seconds of easing at each end. */
const held = (q: number, a: number, b: number, e: number): number => ease(clamp01((q - a) / e)) * ease(clamp01((b - q) / e));

/** A stop on the way up: after `k` ripples, for `dur` seconds, looking about (0), flinching (1), nibbling the leaf (2), stretching up under the capital (3) or hiding in its shell (4). */
interface Stop {
  k: number;
  dur: number;
  kind: number;
  /** Which way it looks first, ±1. */
  look: number;
}

/** One climb: its pillar, its foot and the length of a ripple there, its stops, and the leaf's height. */
interface Climb {
  right: boolean;
  /** The shaft's middle, and the head's height at rest at the foot. */
  cx: number;
  y0: number;
  /** Ripples to the top, and px each. */
  n: number;
  step: number;
  stops: Stop[];
  /** When it has gone behind the capital, seconds into the cycle; and the capital's underside. */
  top: number;
  cap: number;
  /** The new ivy leaf's stalk, at the tip of the pillar's ivy, or null where the window is too short for ivy. */
  leaf: number | null;
  /** The phase of the wander across the shaft. */
  ph: number;
}

/** Where the new leaf hangs on each pillar, by a strand of its ivy (`PAINTERS.runestone`): on the lower one on the left, from the tip of the upper one on the right. */
const leafY = (p: LifePiece, right: boolean): number | null => (p.h > p.F * 8 ? (right ? p.h * 0.32 + p.F * 0.45 : p.h * 0.56 + p.F * 0.4) : null);
/** Where the tail sits at the foot of each pillar: above the flowers at the left base, above the lavender and the band on the right. */
const footY = (p: LifePiece, right: boolean): number => (right && p.h > p.F * 8 ? Math.min(p.h - p.F * 3.1, p.h * 0.62 - 6) : p.h - p.F * 1.9);

/** Climb number `c` on this window, laid out from its seed. */
function climb(p: LifePiece, c: number): Climb {
  const { F } = p, seed = p.seed % 1000;
  const right = rnd(c, seed) < 0.5;
  // Its head ends far enough past the capital's underside that all of it, shadow and all, is behind it.
  const cap = F * 1.2, cx = F * 0.35 - 1, y0 = footY(p, right) + TAIL - HEAD, yTop = cap + TAIL - HEAD - 3;
  const dist = Math.max(10, y0 - yTop);
  const looks = 2 + (rnd(c, seed + 1) < 0.5 ? 1 : 0);
  const kinds: number[] = [], durs: number[] = [];
  for (let i = 0; i < looks; i++) {
    const r = rnd(c, seed + 30 + i);
    kinds.push(r < 0.3 ? 1 : r < 0.55 ? 4 : 0);
    durs.push(kinds[i] === 4 ? 5.2 : 3.4 + rnd(c, seed + 10 + i) * 2.6);
  }
  const nib = 8.6, peek = 3.6, spare = CYCLE - 16 - START - nib - peek - durs.reduce((a, b) => a + b, 0);
  const n = Math.max(4, Math.min(Math.round(dist / 3.2), Math.floor(spare / STRIDE)));
  const step = dist / n;
  const stops: Stop[] = [];
  const leaf = leafY(p, right);
  const free = (k: number): boolean => k > 2 && k < n - 2 && stops.every((s) => Math.abs(s.k - k) > 5);
  // Stretching up to look, its eyes just under the capital.
  const kPeek = Math.round((y0 - cap - 12) / step);
  if (kPeek > 2 && kPeek <= n) stops.push({ k: kPeek, dur: peek, kind: 3, look: rnd(c, seed + 2) < 0.5 ? -1 : 1 });
  if (leaf !== null) {
    const k = Math.round((y0 - leaf + 0.5) / step);
    if (free(k)) stops.push({ k, dur: nib, kind: 2, look: 1 });
  }
  for (let i = 0; i < looks; i++) {
    const k0 = Math.round(n * (i + 0.5 + (rnd(c, seed + 20 + i) - 0.5) * 0.7) / looks);
    const k = [k0, k0 + 6, k0 - 6].find(free);
    if (k !== undefined) stops.push({ k, dur: durs[i], kind: kinds[i], look: rnd(c, seed + 40 + i) < 0.5 ? -1 : 1 });
  }
  stops.sort((a, b) => a.k - b.k);
  const top = START + n * STRIDE + stops.reduce((a, s) => a + s.dur, 0);
  return { right, cx, y0, n, step, stops, top, cap, leaf, ph: rnd(c, seed + 50) * 6.3 };
}

/** Where the climb is at `u` seconds into its cycle: seconds of crawling done, and the stop it is at, if any, and how far into it. */
function along(cl: Climb, u: number): { s: number; stop: Stop | null; q: number } {
  let s = u - START;
  if (s <= 0) return { s: 0, stop: null, q: 0 };
  for (const st of cl.stops) {
    const at = st.k * STRIDE;
    if (s <= at) break;
    if (s < at + st.dur) return { s: at, stop: st, q: s - at };
    s -= st.dur;
  }
  return { s: Math.min(s, cl.n * STRIDE), stop: null, q: 0 };
}

/** How far the head, the shell and the tail have come after `s` seconds of crawling: the head surges first, the tail gathers after. */
function ripple(cl: Climb, s: number): { head: number; shell: number; tail: number; f: number } {
  const k = Math.floor(s / STRIDE), f = s / STRIDE - k;
  return {
    head: cl.step * (k + ease(clamp01(f / 0.6))),
    shell: cl.step * (k + ease(clamp01((f - 0.15) / 0.7))),
    tail: cl.step * (k + ease(clamp01((f - 0.4) / 0.6))),
    f,
  };
}

/** The shaft's line up which it climbs: x at height y, wandering a little, and wide of the leaf so it passes beside it. */
function lane(cl: Climb, y: number): number {
  const by = cl.leaf === null ? 0 : Math.exp(-(((y - cl.leaf) / 16) ** 2));
  return cl.cx + 1.4 * Math.sin(y / 21 + cl.ph) - 0.8 * by;
}

/** A new ivy leaf on a stalk from (x, y), grown from the strand at `top` px above it; `bite` px bitten from its edge, shaken by `shake` radians. */
function leaf(g: Ctx, pal: Palette, x: number, y: number, top: number, bite: number, shake: number): void {
  const s = 7.4, ang = -0.6 + shake, ox = x + 6.5, oy = y - 1.2, cs = Math.cos(ang), sn = Math.sin(ang);
  // The stalk's points in the leaf's own frame, so that leaf, stalk and midrib are one stroke.
  const at = (px: number, py: number): [number, number] => [(px - ox) * cs + (py - oy) * sn, (py - oy) * cs - (px - ox) * sn];
  g.save();
  g.translate(ox, oy);
  g.rotate(ang);
  if (bite > 0.05) {
    g.beginPath();
    g.rect(-30, -30, 60, 60);
    g.arc(s * 0.62, -s * 0.38, bite, 0, Math.PI * 2);
    g.arc(s * 0.4, -s * 0.42, bite * 0.7, 0, Math.PI * 2);
    g.clip('evenodd');
  }
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(-s * 0.2, -s * 0.62, s * 0.55, -s * 0.72, s, 0);
  g.bezierCurveTo(s * 0.55, s * 0.72, -s * 0.2, s * 0.62, 0, 0);
  g.closePath();
  g.fillStyle = css(pal.leaf);
  g.fill();
  g.moveTo(s * 0.62, 0);
  g.lineTo(0, 0);
  g.quadraticCurveTo(...at(x + 3.5, y + 0.8), ...at(x, y));
  g.quadraticCurveTo(...at(x - 1.5, y - top * 0.4), ...at(x + 1, y - top));
  g.strokeStyle = css(pal.leafInk);
  g.lineWidth = 0.85;
  g.stroke();
  g.restore();
}

/** The shell at the origin, `r` across, turned `rot`; `sx` is the mirror, so its shine stays on the side the light comes from. */
function shell(g: Ctx, pal: Palette, r: number, rot: number, sx: number, squash: number): void {
  g.save();
  g.rotate(rot);
  g.scale(1 + squash * 0.5, 1 - squash);
  const lx = -sx * r * 0.4, ly = -r * 0.45;
  const fill = g.createRadialGradient(lx, ly, r * 0.1, 0, 0, r);
  fill.addColorStop(0, css(pal.shellHi));
  fill.addColorStop(0.55, css(pal.shellMid));
  fill.addColorStop(1, css(pal.shellLo));
  g.beginPath();
  g.ellipse(0, 0, r, r * 1.05, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = css(pal.shellInk);
  g.lineWidth = 0.9;
  g.stroke();
  // The whorl, from the rim in to its eye, with a cream band beside the groove.
  const ox = r * 0.12, oy = r * 0.1, turns = 2.3, a0 = -Math.PI * 0.5;
  for (const [col, wd, inset] of [[pal.whorl, 0.9, 0], [pal.band, 0.7, 0.55]] as const) {
    g.beginPath();
    for (let i = 0; i <= 22; i++) {
      const v = i / 22, a = a0 + v * turns * Math.PI * 2;
      const rr = Math.max(0, (r - 0.9 - inset) * (1 - v * 0.92));
      const x = ox * v + Math.cos(a) * rr, y = oy * v + Math.sin(a) * rr;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.strokeStyle = css(col);
    g.lineWidth = wd;
    g.stroke();
  }
  // The gloss: a bright arc up on the lit side and a point of light.
  g.beginPath();
  g.arc(0, 0, r * 0.74, sx > 0 ? -2.75 : -0.39 - 1.0, sx > 0 ? -1.75 : -0.39);
  g.strokeStyle = css(pal.gloss);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.arc(lx * 0.9, ly * 1.05, 0.65, 0, Math.PI * 2);
  g.fillStyle = css(pal.glint);
  g.fill();
  g.restore();
}

export function snail(g: Ctx, p: LifePiece, t: number, night = false): void {
  const pal = night ? NIGHT : DAY;
  const tt = t + (p.seed % 97) * 1.37, c = Math.floor(tt / CYCLE), u = tt - c * CYCLE;
  const cl = climb(p, c), sx = cl.right ? -1 : 1;
  const fade = ease(clamp01(u / 3));
  g.save();
  if (cl.right) {
    g.translate(p.w, 0);
    g.scale(-1, 1);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // The new leaf on the ivy of both pillars, bitten on this climb's and mending once the snail has gone.
  const pos = along(cl, u);
  const nib = pos.stop?.kind === 2 ? pos.q : 0;
  const chomp = nib > 1.4 && nib < 7 ? Math.max(0, Math.sin(((nib - 1.4) / 0.62) * Math.PI)) ** 2 : 0;
  const nibStop = cl.stops.find((s) => s.kind === 2);
  let bite = 0;
  if (nibStop) {
    const atNib = START + nibStop.k * STRIDE + cl.stops.filter((s) => s.k < nibStop.k).reduce((a, s) => a + s.dur, 0);
    bite = clamp01((u - atNib - 1.4) / 5.6) * 1.6 * clamp01((CYCLE - 2 - u) / 6);
    if (u > atNib && u < atNib + nibStop.dur) bite = Math.max(0.05, bite);
  }
  for (const right of [false, true]) {
    const ly = leafY(p, right);
    if (ly === null) continue;
    const mine = right === cl.right;
    g.save();
    if (right !== cl.right) {
      g.translate(p.w, 0);
      g.scale(-1, 1);
    }
    leaf(g, pal, cl.cx - 1, ly, right ? p.F * 0.45 : 0, mine ? bite : 0, mine ? -0.16 * chomp : 0);
    g.restore();
  }
  if (fade <= 0 || u > CYCLE - 1) {
    g.restore();
    return;
  }
  g.globalAlpha = fade;
  // Nothing of it shows above the capital's underside: it climbs on behind the capital.
  g.beginPath();
  g.rect(-p.R - 20, cl.cap, p.F * 2 + p.R + 20, p.h);
  g.clip();

  // How far it has come, and where it is in this ripple.
  const r = ripple(cl, pos.s);
  const crawling = u > START && u < cl.top && !pos.stop;
  const surge = crawling ? Math.sin(Math.PI * clamp01(r.f / 0.6)) : 0;

  // Out of the shell at the foot: a wriggle, then the body slides out and the stalks unroll.
  let out = back((u - 3.6) / 2.6);
  let rot = Math.sin((u - 2.6) * Math.PI * 4) * 0.08 * held(u, 2.6, 3.7, 0.3) + (crawling ? Math.sin(r.f * Math.PI * 2) * 0.05 : 0);
  let squash = 0;

  // The beats: looking about, flinching, nibbling, stretching up, hiding.
  let yaw = 0, reach = 0, pull = 0, spread = 0;
  const ext = [0, 1].map((i) => back((u - 5.4 - i * 0.28) / 1.1));
  if (pos.stop) {
    const { kind, dur, look } = pos.stop, q = pos.q, env = held(q, 0, dur, 0.8);
    if (kind === 0) {
      yaw = look * 2.4 * Math.sin(q * 1.3) * env;
      reach = 1.1 * env;
      spread = 0.18 * env;
      // One stalk dips and comes back up while it looks.
      ext[look > 0 ? 0 : 1] *= 1 - 0.55 * held(q, 1.3, 2.3, 0.3);
    } else if (kind === 1) {
      const fl = ease(clamp01((q - 0.5) / 0.16)) * (1 - ease(clamp01((q - 1.6) / 1.6)));
      for (let i = 0; i < 2; i++) ext[i] *= 1 - 0.85 * fl;
      pull = 2.2 * fl;
      rot -= 0.05 * fl;
      reach = 0.6 * held(q, 3, dur, 0.6);
    } else if (kind === 2) {
      yaw = 3.6 * env + 0.8 * chomp;
      reach = 0.4 * env + 1.0 * chomp;
      for (let i = 0; i < 2; i++) ext[i] *= 1 - 0.15 * env;
    } else if (kind === 3) {
      reach = 2 * env;
      spread = 0.22 * env;
      yaw = look * 1.3 * Math.sin(q * 1.9) * env;
      for (let i = 0; i < 2; i++) ext[i] *= 1 + 0.14 * held(q, 0.3 + i * 0.15, dur - 0.4, 0.5);
    } else {
      // In with a snap, a wait, a wriggle, and out again.
      out *= q < 2.5 ? 1 - ease(clamp01((q - 0.3) / 0.35)) : back((q - 2.5) / 1.4);
      for (let i = 0; i < 2; i++) ext[i] *= q < 2.5 ? 1 - ease(clamp01((q - 0.25) / 0.2)) : back((q - 3.4 - i * 0.25) / 1);
      rot += Math.sin((q - 1.9) * Math.PI * 4) * 0.09 * held(q, 1.9, 2.6, 0.2);
      squash = 0.1 * Math.sin(clamp01((q - 0.6) / 0.45) * Math.PI);
    }
  }

  // The body along the lane: tail tip to head, thinner as it stretches.
  const yS = cl.y0 + HEAD - r.shell;
  const aHead = (HEAD + r.head - r.shell + reach - pull) * out, aTail = (TAIL + r.tail - r.shell + pull * 0.4) * out;
  const len = Math.max(1, aHead - aTail), thin = Math.sqrt((HEAD - TAIL) / Math.max(HEAD - TAIL, len)) * (1 + 0.04 * Math.sin(t * 2.1));
  const N = 9, pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const v = i / N, a = lerp(aTail, aHead, v), y = yS - a;
    pts.push([lane(cl, y) + yaw * v ** 2.4, y]);
  }
  // Half its width at `v` from tail tip (0) to head (1): a tapering tail, a soft neck, a round head.
  const width = (v: number): number => HALF * thin * (v < 0.35 ? Math.sqrt(v / 0.35) : v > 0.8 ? 1.14 * Math.sqrt(Math.max(0, 1 - ((v - 0.8) / 0.2) ** 2)) : 1 - 0.12 * Math.sin(((v - 0.35) / 0.35) * Math.PI) + 0.14 * clamp01((v - 0.68) / 0.12));
  const norm = (i: number): [number, number] => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(N, i + 1)];
    const d = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / d, (bx - ax) / d];
  };
  const body = new Path2D();
  for (let i = 0; i <= N; i++) {
    const [x, y] = pts[i], [nx, ny] = norm(i), wd = width(i / N);
    if (i) body.lineTo(x + nx * wd, y + ny * wd);
    else body.moveTo(x + nx * wd, y + ny * wd);
  }
  for (let i = N; i >= 0; i--) {
    const [x, y] = pts[i], [nx, ny] = norm(i), wd = width(i / N);
    body.lineTo(x - nx * wd, y - ny * wd);
  }
  body.closePath();

  // The wet trail below the tail, dimming as it dries, with a few glints running in it.
  if (u > START) {
    const trail: Array<[number, number, number]> = [];
    for (let k = 0; k <= 10; k++) {
      const age = k * 4.5, at = Math.max(START, u - age);
      const rr = ripple(cl, along(cl, at).s), y = cl.y0 + HEAD - rr.tail - TAIL - 1.5;
      trail.push([lane(cl, y), y, clamp01(1 - age / WET) ** 1.5 * clamp01((CYCLE - 1 - u) / 10)]);
      if (at <= START) break;
    }
    if (trail.length > 1) {
      const y1 = trail[0][1], y2 = trail[trail.length - 1][1];
      if (y2 - y1 > 0.5) {
        const wet = g.createLinearGradient(0, y1, 0, y2), hi = g.createLinearGradient(0, y1, 0, y2);
        for (let i = 0; i < trail.length; i += i + 2 < trail.length ? 2 : 1) {
          const [, y, a] = trail[i], v = clamp01((y - y1) / (y2 - y1));
          wet.addColorStop(v, css(pal.wet, 0.24 * a));
          hi.addColorStop(v, css(pal.sheen, 0.7 * a));
        }
        g.beginPath();
        trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = wet;
        g.lineWidth = 2.6;
        g.stroke();
        g.save();
        g.translate(-0.5 * sx, 0);
        g.strokeStyle = hi;
        g.lineWidth = 0.7;
        g.stroke();
        g.restore();
        for (let j = 0; j < 4; j++) {
          const v = (j * 0.29 + tt * 0.011 + rnd(c, j) * 0.2) % 1, i = Math.min(trail.length - 2, Math.floor(v * (trail.length - 1)));
          const f = v * (trail.length - 1) - i, [ax, ay, aa] = trail[i], [bx, by, ba] = trail[i + 1];
          const tw = Math.max(0, Math.sin(tt * 1.7 + j * 2.3)) ** 4 * lerp(aa, ba, f);
          if (tw < 0.05) continue;
          const x = lerp(ax, bx, f), y = lerp(ay, by, f), s = 0.6 + tw * 1.1;
          g.globalAlpha = fade * tw;
          g.fillStyle = css(j % 2 ? pal.sparkA : pal.sparkB);
          g.fillRect(x - s, y - 0.3, s * 2, 0.6);
          g.fillRect(x - 0.3, y - s, 0.6, s * 2);
        }
        g.globalAlpha = fade;
      }
    }
  }

  // Gone behind the capital: only its trail is left.
  if (u > cl.top) {
    g.restore();
    return;
  }
  const [hx, hy] = pts[N], [cxS, cyS] = pts[Math.round(N * (-aTail / len))] ?? pts[0];
  const [snx, sny] = norm(Math.round(N * (-aTail / len)));
  const shX = cxS - snx * 2.5, shY = cyS - sny * 2.5 + 0.5;

  // Its shadow on the stone, down and away from the light.
  const shade = new Path2D();
  if (out > 0.02) shade.addPath(body);
  shade.ellipse(shX, shY, SHELL, SHELL * 1.05, 0, 0, Math.PI * 2);
  g.save();
  g.translate(sx * 0.9, 1.4);
  g.fillStyle = css(pal.shade);
  g.fill(shade);
  g.restore();

  // The body: soft putty, a darker rim and a pale line along its back.
  if (out > 0.02) {
    g.fillStyle = css(pal.body);
    g.fill(body);
    g.strokeStyle = css(pal.bodyInk);
    g.lineWidth = 0.8;
    g.stroke(body);
    g.beginPath();
    for (let i = 2; i <= N - 1; i++) (i > 2 ? g.lineTo : g.moveTo).call(g, pts[i][0] - sx * 0.3, pts[i][1]);
    g.strokeStyle = css(pal.back);
    g.lineWidth = 0.8;
    g.stroke();
  }

  // The head: its stalks with an eye on each, the small feelers, and a blush either side.
  if (out > 0.3) {
    const [nx, ny] = norm(N - 1);
    const dir = Math.atan2(hy - pts[N - 2][1], hx - pts[N - 2][0]) || -Math.PI / 2;
    const lean = pos.stop?.kind === 2 ? 0.45 * held(pos.q, 0, pos.stop.dur, 0.8) : 0;
    const feelers = new Path2D(), stalks = new Path2D(), eyes = new Path2D(), shine = new Path2D(), blush = new Path2D();
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      // Feelers, short, low on the face.
      const fa = dir + side * 0.95, fx = hx + nx * side * 0.8, fy = hy + ny * side * 0.8;
      feelers.moveTo(fx, fy);
      feelers.lineTo(fx + Math.cos(fa) * 1.6 * out, fy + Math.sin(fa) * 1.6 * out);
      const [px, py] = pts[N - 1], bw = HALF * thin * 0.55;
      blush.moveTo(px + nx * side * bw + 0.75, py + ny * side * bw);
      blush.arc(px + nx * side * bw, py + ny * side * bw, 0.75, 0, Math.PI * 2);
      // The stalk, curving a little outward, swaying, leaning off the leaf while it eats.
      const e = clamp01(ext[i]) * 0.9 + Math.max(0, ext[i] - 1) * 2;
      if (e < 0.05) continue;
      const bx = hx + nx * side * 1.1 - Math.cos(dir) * 1.3, by = hy + ny * side * 1.1 - Math.sin(dir) * 1.3;
      const a = dir + side * (0.36 + spread + surge * 0.08) + Math.sin(t * 1.6 + i * 1.9) * 0.1 + Math.sin(t * 0.53 + i * 4) * 0.07 - lean;
      const L = 7.8 * e, ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
      stalks.moveTo(bx, by);
      stalks.quadraticCurveTo(bx + Math.cos(a - side * 0.25) * L * 0.55, by + Math.sin(a - side * 0.25) * L * 0.55, ex, ey);
      const er = 0.65 + 0.95 * clamp01(ext[i]), gx = ex - sx * er * 0.35, gy = ey - er * 0.35;
      eyes.moveTo(ex + er, ey);
      eyes.arc(ex, ey, er, 0, Math.PI * 2);
      shine.moveTo(gx + er * 0.38, gy);
      shine.arc(gx, gy, er * 0.38, 0, Math.PI * 2);
    }
    g.strokeStyle = css(pal.feeler);
    g.lineWidth = 1;
    g.stroke(feelers);
    g.fillStyle = css(pal.blush);
    g.fill(blush);
    g.strokeStyle = css(pal.stalk);
    g.lineWidth = 1.4;
    g.stroke(stalks);
    g.fillStyle = css(pal.eye);
    g.fill(eyes);
    g.fillStyle = css(pal.shine);
    g.fill(shine);
  }

  // The shell over its back, a little to the outside, rocking as it goes.
  g.save();
  g.translate(shX, shY);
  shell(g, pal, SHELL, rot + Math.atan2(sny, snx), sx, squash);
  g.restore();
  g.restore();
}
