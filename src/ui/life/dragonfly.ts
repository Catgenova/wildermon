import { SIZE, clamp01, ease, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * A dragonfly seen from above, visiting the top of the Map window by day: it darts in
 * from one side, hovers, darts on in short straight runs (now and then doubling back),
 * usually lands on the band for a few seconds with its wings flat, then zips off the
 * far side. Drawn at x forward, y to its right, in units of `S` pixels.
 */

/** Its size against the other animals': a dragonfly is long. */
const S = SIZE * 1.15;

/** Seconds between the starts of two visits. */
const C = 26;

/** A place it goes to: where, how long it stays, and whether it lands there. */
interface Stop {
  x: number;
  y: number;
  hold: number;
  perch: boolean;
}

/** How it is at one moment. */
interface Pose {
  x: number;
  y: number;
  /** Heading, radians. */
  h: number;
  /** How hard the wings beat, 0 (held flat) to 1. */
  beat: number;
  alpha: number;
  /** Sat down, 0 to 1. */
  sat: number;
  /** Head turned from the body, radians. */
  look: number;
  /** Tail drawn in (raised) by this share. */
  lift: number;
}

/** The angle from `a` to `b`, the short way round. */
const turn = (a: number, b: number): number => {
  const d = (b - a) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

/** 0 to 1 past 1 and back: the quick snap of a turn. */
const snap = (u: number): number => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;

/** A rise and fall over `d` seconds from `at`, 0 outside it. */
const bump = (u: number, at: number, d: number): number => (u < at || u > at + d ? 0 : Math.sin(Math.PI * (u - at) / d) ** 2);

/** The visit numbered `k`: its stops in order, the first and last off the edges. */
function plan(p: LifePiece, k: number): Stop[] {
  const { w, F, R } = p, s = p.seed * 0.37 + 11;
  const dir = rnd(s, k) < 0.5 ? 1 : -1;
  const a = F * 2, b = w - F * 2;
  const n = Math.max(2, Math.min(6, Math.floor((b - a) / 65))) - (rnd(s + 1, k) < 0.3 ? 1 : 0);
  const side = (x: number): number => (dir > 0 ? x : w - x);
  const stops: Stop[] = [{ x: side(-60), y: -R - 8 - rnd(s + 2, k) * 10, hold: 0, perch: false }];
  const perchAt = rnd(s + 3, k) < 0.8 ? 1 + Math.floor(rnd(s + 4, k) * Math.max(1, n - 1)) : -1;
  const backAt = rnd(s + 5, k) < 0.45 ? Math.floor(rnd(s + 6, k) * n) : -1;
  // The gold stars on the top of the band: it does not sit on them.
  const stars = [w * 0.22, w * 0.7];
  for (let i = 0; i < n; i++) {
    let x = side(a + (b - a) * (i + 0.5 + (rnd(s + 7, k * 7 + i) - 0.5) * 0.5) / n);
    const prev = stops[stops.length - 1];
    if (i === perchAt) {
      for (const sx of stars) if (Math.abs(x - sx) < 20) x = sx + (x < sx ? -20 : 20);
      stops.push({ x, y: F * 0.4, hold: rnd(s + 8, k) * 1.6 + 2.6, perch: true });
    } else {
      const dx = Math.abs(x - prev.x);
      const y = Math.max(prev.y - dx * 0.4, Math.min(prev.y + dx * 0.4, -R - 4 + rnd(s + 9, k * 7 + i) * (R + 4 + F * 0.25)));
      stops.push({ x, y, hold: 0.5 + rnd(s + 10, k * 7 + i) ** 1.5 * 1.5, perch: false });
    }
    if (i === backAt && i !== perchAt) {
      const q = stops[stops.length - 1];
      stops.push({ x: q.x - dir * (25 + rnd(s + 11, k) * 30), y: q.y + (rnd(s + 12, k) - 0.5) * 8, hold: 0.4 + rnd(s + 13, k) * 0.7, perch: false });
    }
  }
  stops.push({ x: side(w + 60), y: -R - 10 - rnd(s + 14, k) * 12, hold: 0, perch: false });
  return stops;
}

/** Seconds a dart from `a` to `b` takes: quick, slower into a landing. */
const dartTime = (a: Stop, b: Stop): number => Math.hypot(b.x - a.x, b.y - a.y) / 650 + (b.perch ? 0.45 : 0.1);

/** The heading of a dart from `a` to `b`, kept within 30 degrees of level. */
const dartHeading = (a: Stop, b: Stop): number => {
  const dx = b.x - a.x;
  return Math.atan2(Math.max(-0.6, Math.min(0.6, (b.y - a.y) / (Math.abs(dx) + 1e-3))) * Math.abs(dx), dx);
};

/** Where the dragonfly is at `tt` (seconds, this window's own clock), or null between visits. */
function pose(p: LifePiece, tt: number): Pose | null {
  const k = Math.floor(tt / C);
  let u = tt - k * C;
  const st = plan(p, k), last = st.length - 1;
  // Pulled back before a dart from a hover, carried past the stop after one.
  const back = (a: Stop): number => (a.perch || a.hold === 0 ? 0 : 1.6);
  const past = (a: Stop, b: Stop): number => (b.perch || b.hold === 0 ? 0 : Math.min(6, Math.hypot(b.x - a.x, b.y - a.y) * 0.06));
  for (let i = 1; i <= last; i++) {
    const a = st[i - 1], b = st[i], D = dartTime(a, b), hd = dartHeading(a, b);
    const cx = Math.cos(hd), sy = Math.sin(hd);
    if (u < D) {
      const v = u / D, sv = b.perch ? ease(v) : ease(v ** 0.75);
      const an = back(a) * (1 - sv), ov = past(a, b) * sv;
      return {
        x: lerp(a.x, b.x, sv) + (ov - an) * cx, y: lerp(a.y, b.y, sv) + (ov - an) * sy, h: hd,
        beat: 1, alpha: i === 1 ? clamp01(u / 0.15) : i === last ? clamp01((D - u) / 0.15) : 1,
        sat: 0, look: 0, lift: 0,
      };
    }
    u -= D;
    if (i === last) return null;
    const H = b.hold;
    if (u < H) {
      const nx = st[i + 1], ho = dartHeading(b, nx);
      const rest = b.perch ? (Math.cos(hd) >= 0 ? 0 : Math.PI) : hd;
      const r1 = turn(hd, rest), r2 = turn(rest, ho);
      const tt2 = 0.08 + 0.12 * Math.abs(r2) / Math.PI, tStart = H - 0.03 - tt2;
      // Now and then, hovering, it swings round to look at something and back.
      const gl = rnd(i + 7, k), glance = !b.perch && gl < 0.4 && H > 1 ? (gl - 0.2) * 3.5 * ease(clamp01(Math.min((u - 0.3) / 0.12, (H - 0.45 - u) / 0.12))) : 0;
      const h = hd + r1 * ease(clamp01(u / 0.35)) + r2 * (u < tStart ? 0 : snap(clamp01((u - tStart) / tt2))) + glance;
      const ov = past(a, b) * (1 - ease(clamp01(u / 0.35)));
      const an = back(b) * ease(clamp01((u - (H - 0.16)) / 0.16));
      const env = b.perch ? 0 : ease(clamp01(u / 0.4)) * ease(clamp01((H - u) / 0.4));
      const ph = rnd(i, k) * 6;
      const x = b.x + ov * cx - an * Math.cos(ho) + env * Math.sin(u * 4.3 + ph);
      let y = b.y + ov * sy - an * Math.sin(ho) + env * 1.5 * Math.sin(u * 3.1 + ph * 2);
      if (!b.perch) return { x, y, h, beat: 1, alpha: 1, sat: 0, look: 0, lift: 0 };
      // Sat down: the wings come to rest, then buzz up again just before it goes.
      const sat = ease(clamp01(u / 0.3)) * ease(clamp01((H - u) / 0.25));
      const tw = rnd(i + 3, k);
      const beat = Math.max(1 - clamp01((u - 0.05) / 0.3), clamp01((u - (H - 0.4)) / 0.3), 0.9 * bump(u, 0.9 + tw * (H - 1.8), 0.3));
      const look = 0.35 * (bump(u, 0.5 + tw * 0.4, 0.9) - bump(u, H * 0.55, 0.8)) * (tw < 0.5 ? 1 : -1);
      const lift = 0.1 * bump(u, H * 0.3 + tw * 0.6, 1);
      // A touchdown dip as the legs take the weight.
      y += 0.6 * bump(u, 0, 0.35);
      return { x, y, h, beat, alpha: 1, sat, look, lift };
    }
    u -= H;
  }
  return null;
}

/** Adds one wing to the path: along +x from its root, the leading edge toward −y, `L` long, `wide` across at its base. */
function wing(g: Ctx, L: number, wide: number): void {
  g.moveTo(0, -0.35);
  g.bezierCurveTo(L * 0.3, -1.25, L * 0.85, -1.35, L, -0.45);
  g.bezierCurveTo(L * 1.06, 0.45, L * 0.75, 1.3, L * 0.45, 1.3);
  g.bezierCurveTo(L * 0.2, 1.3, 0.15, wide, 0, 0.5);
  g.closePath();
}

export function dragonfly(g: Ctx, p: LifePiece, t: number): void {
  const tt = t + rnd(p.seed, 5) * C;
  const o = pose(p, tt);
  if (!o) return;
  const was = pose(p, tt - 0.05);
  const dh = was ? turn(was.h, o.h) : 0;
  const speed = was ? Math.hypot(o.x - was.x, o.y - was.y) / 0.05 : 0;
  const run = clamp01((speed - 80) / 400);
  // Tail swung out against a turn, straightened by speed.
  const curl = Math.max(-0.5, Math.min(0.5, -dh * 0.35)) + o.sat * 0.04 * Math.sin(tt * 1.1);

  g.save();
  g.globalAlpha = o.alpha;

  // The streak a dart leaves.
  if (run > 0.05 && was) {
    const bx = was.x - Math.cos(o.h) * 6, by = was.y - Math.sin(o.h) * 6;
    const nx = -Math.sin(o.h) * 1.2, ny = Math.cos(o.h) * 1.2;
    g.beginPath();
    g.moveTo(o.x + nx, o.y + ny);
    g.lineTo(bx, by);
    g.lineTo(o.x - nx, o.y - ny);
    g.closePath();
    g.fillStyle = `rgba(150, 215, 235, ${0.3 * run})`;
    g.fill();
  }

  // Its shadow on the band: close and sharp when sat, wider and fainter in the air.
  const over = clamp01((o.y + 2) / 6);
  if (over > 0) {
    const alt = 1 - o.sat;
    g.save();
    g.translate(o.x + 1.2 + alt * 3, o.y + 1.6 + alt * 4);
    g.rotate(o.h);
    g.scale(S, S);
    g.fillStyle = `rgba(70, 60, 45, ${over * (0.1 + 0.08 * o.sat)})`;
    g.beginPath();
    g.ellipse(-3.2, 0, 6.4, 0.9, 0, 0, Math.PI * 2);
    g.ellipse(0, 0, 1.6, 6 * (1 - 0.3 * o.beat), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  g.translate(o.x, o.y);
  g.rotate(o.h);
  g.scale(S * (1 + 0.08 * run), S * (1 - 0.04 * run));

  // Wings: fore and hind beat out of step; seen from above each beat shortens them.
  const wg = g.createLinearGradient(0, 0, 6.2, 0);
  const hue = 0.5 + 0.5 * Math.sin(tt * 2.3 + o.x * 0.03);
  wg.addColorStop(0, 'rgba(255, 222, 160, 0.7)');
  wg.addColorStop(0.3, 'rgba(200, 232, 250, 0.5)');
  wg.addColorStop(0.68, `rgba(${Math.round(lerp(140, 215, hue))}, ${Math.round(lerp(225, 180, hue))}, ${Math.round(lerp(235, 250, hue))}, 0.62)`);
  wg.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
  const ph = tt * Math.PI * 2 * 9.7;
  const wings = [-1, 1].flatMap((side) => [true, false].map((fore) => {
    const f = fore ? ph : ph + 1.9 + side * 0.4;
    return {
      side, fore, f, L: fore ? 6.6 : 6.1, wide: fore ? 0.9 : 1.9,
      sweep: (fore ? 0.3 : -0.26) + o.beat * 0.22 * Math.sin(f + 0.8) + o.sat * 0.03 * Math.sin(tt * 1.7 + (fore ? 0 : 1)),
      len: 1 - o.beat * 0.55 * (1 - Math.abs(Math.cos(f))),
    };
  }));
  /** Lays the drawing along one wing, from its root, stretched to `len` of its length. */
  const along = (q: (typeof wings)[number], len: number): void => {
    g.translate(q.fore ? 0.6 : -0.6, q.side * 0.55);
    g.scale(1, q.side);
    g.rotate(Math.PI / 2 - q.sweep);
    g.scale(len, 1);
  };
  // The blur of the beat: each whole wing, faint.
  if (o.beat > 0.05) {
    g.beginPath();
    for (const q of wings) {
      g.save();
      along(q, 1);
      wing(g, q.L, q.wide);
      g.restore();
    }
    g.fillStyle = `rgba(225, 240, 250, ${0.22 * o.beat})`;
    g.fill();
  }
  for (const q of wings) {
    g.save();
    along(q, q.len);
    g.beginPath();
    wing(g, q.L, q.wide);
    g.fillStyle = wg;
    g.fill();
    // A glint where the wing catches the sun: flickering in the beat, a slow pass when held still.
    const glint = o.beat * 0.75 * Math.max(0, Math.sin(q.f * 0.5 + tt * 1.7 + q.side)) ** 6 + (1 - o.beat) * 0.5 * Math.max(0, Math.sin(tt * 0.9 + q.side * 1.3 + (q.fore ? 0 : 0.5))) ** 12;
    if (glint > 0.02) {
      g.fillStyle = `rgba(255, 255, 255, ${glint})`;
      g.fill();
    }
    g.restore();
  }
  // Their edges and leading veins in one stroke, the gold marks near the tips in one fill.
  g.beginPath();
  for (const q of wings) {
    g.save();
    along(q, q.len);
    wing(g, q.L, q.wide);
    g.moveTo(0.2, -0.25);
    g.bezierCurveTo(q.L * 0.35, -0.95, q.L * 0.7, -0.95, q.L * 0.95, -0.55);
    g.restore();
  }
  g.lineWidth = 0.3;
  g.strokeStyle = 'rgba(45, 95, 125, 0.7)';
  g.stroke();
  g.beginPath();
  for (const q of wings) {
    g.save();
    along(q, q.len);
    g.moveTo(q.L * 0.83 + 0.42, -0.68);
    g.ellipse(q.L * 0.83, -0.68, 0.42, 0.2, 0.25, 0, Math.PI * 2);
    g.restore();
  }
  g.fillStyle = '#d6a23a';
  g.fill();

  const ink = '#1d4c63';
  // Which side of the body faces the sun at the top left of the screen: its shine goes there.
  const lit = Math.max(-1, Math.min(1, (0.45 * Math.sin(o.h) - 0.5 * Math.cos(o.h)) * 2));
  // Tail: ten rings tapering back from the thorax, swung by `curl`, drawn in by `lift`.
  const TL = 7.6 * (1 - o.lift);
  const at = (s: number): [number, number] => [-1.1 - s * TL, curl * s * s * 3];
  const half = (s: number): number => 0.8 - 0.36 * s + 0.14 * Math.max(0, s - 0.85) / 0.15;
  g.beginPath();
  for (let j = 0; j <= 10; j++) {
    const s = j / 10, [x, y] = at(s);
    if (j === 0) g.moveTo(x, y - half(s));
    else g.lineTo(x, y - half(s));
  }
  for (let j = 10; j >= 0; j--) {
    const s = j / 10, [x, y] = at(s);
    g.lineTo(x, y + half(s));
  }
  g.closePath();
  g.fillStyle = '#3aa4cc';
  g.fill();
  g.lineWidth = 0.3;
  g.strokeStyle = ink;
  g.stroke();
  // The dark band at the back of each ring.
  g.strokeStyle = 'rgba(25, 70, 100, 0.7)';
  g.lineWidth = 0.3;
  g.beginPath();
  for (let j = 1; j < 8; j++) {
    const s = j / 8 - 0.015, [x, y] = at(s), hw = half(s);
    g.moveTo(x, y - hw);
    g.lineTo(x, y + hw);
  }
  g.stroke();
  // Its shine, along the top of the tail.
  g.beginPath();
  for (let j = 0; j <= 7; j++) {
    const s = 0.04 + j * 0.1, [x, y] = at(s);
    if (j === 0) g.moveTo(x, y + lit * half(s) * 0.35);
    else g.lineTo(x, y + lit * half(s) * 0.35);
  }
  g.strokeStyle = 'rgba(210, 248, 255, 0.75)';
  g.lineWidth = 0.28;
  g.stroke();
  // Two small claspers at its tip.
  const [ex, ey] = at(1);
  g.beginPath();
  g.moveTo(ex, ey - 0.3);
  g.lineTo(ex - 0.8, ey - 0.55);
  g.moveTo(ex, ey + 0.3);
  g.lineTo(ex - 0.8, ey + 0.55);
  g.strokeStyle = ink;
  g.lineWidth = 0.3;
  g.stroke();

  // Legs, gripping the band when sat.
  if (o.sat > 0.05) {
    g.strokeStyle = `rgba(29, 76, 99, ${0.8 * o.sat})`;
    g.lineWidth = 0.28;
    g.beginPath();
    for (const sd of [-1, 1]) {
      g.moveTo(0.6, sd * 0.9);
      g.lineTo(1.3, sd * 1.7);
      g.moveTo(-0.2, sd * 1);
      g.lineTo(-0.4, sd * 1.9);
      g.moveTo(-0.8, sd * 0.9);
      g.lineTo(-1.6, sd * 1.7);
    }
    g.stroke();
  }

  // Thorax.
  g.beginPath();
  g.ellipse(0, 0, 1.8, 1.45, 0, 0, Math.PI * 2);
  g.fillStyle = '#2f9e98';
  g.fill();
  g.lineWidth = 0.3;
  g.strokeStyle = ink;
  g.stroke();
  g.beginPath();
  g.ellipse(-0.1, lit * 0.45, 1.05, 0.45, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(190, 245, 235, 0.55)';
  g.fill();

  // Head: two big round eyes, turned by `look`, lit from the top left of the screen.
  g.translate(1.6, 0);
  g.rotate(o.look);
  const lx = Math.cos(-o.h - o.look) * -0.45 - Math.sin(-o.h - o.look) * -0.5;
  const ly = Math.sin(-o.h - o.look) * -0.45 + Math.cos(-o.h - o.look) * -0.5;
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.arc(1.2, sd * 1.15, 1.5, 0, Math.PI * 2);
    g.fillStyle = '#2d7fb6';
    g.fill();
    g.lineWidth = 0.3;
    g.strokeStyle = ink;
    g.stroke();
  }
  /** Both eyes' circles of radius `r`, at `dx`, `dy` from each eye's middle (`dy` mirrored). */
  const both = (dx: number, dy: number, r: number, fill: string, mirror: boolean): void => {
    g.beginPath();
    for (const sd of [-1, 1]) {
      const y = sd * 1.15 + (mirror ? sd : 1) * dy;
      g.moveTo(1.2 + dx + r, y);
      g.arc(1.2 + dx, y, r, 0, Math.PI * 2);
    }
    g.fillStyle = fill;
    g.fill();
  };
  both(lx * 0.35, ly * 0.35, 1.1, '#5cc0e6', false);
  // The dark pupils looking ahead, and the sun in them.
  both(0.55, 0.1, 0.6, '#163247', true);
  both(lx * 1.1, ly * 1.1, 0.42, 'rgba(255, 255, 255, 0.95)', false);
  g.restore();
}
