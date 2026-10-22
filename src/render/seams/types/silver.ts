import { channel, css, footShadow, glow, hex, mix, palOf, periodic, ribbon, sparkle, wrap, CREAM, TAU } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Silver: native wire silver. A bright white wire runs along a thin dark
 * matrix, and fern-like dendrites of it branch out sideways into the stone,
 * the whole lit with a cold blue shine; where the dendrites gather, a curl
 * of wire stands up off the face and glints. Branching where every other
 * kind is beads or crystals, and the brightest white in the set.
 */
const L = 4;
const BED = palOf('#6b7099', { dark: 0.5, rim: 0.6 });
const ORE = palOf('#eef3fc', { rim: 0.8 });
ORE.dark = hex('#aab6d2');
ORE.body = hex('#dde6f6');
ORE.lit = hex('#f6f9ff');
ORE.shine = hex('#ffffff');
const ICE = hex('#cfe2ff');
/** The cold shine round it: bluer than the ice, so it shows on pale stone. */
const COLD = hex('#a8c6ff');

/** A run of wire: corner pairs, and its width at each corner. */
interface Wire {
  pts: number[];
  w: number[];
}

/**
 * Wire in the kit's way, every run in one pass at a time so they join up: an
 * ink line round all of it (with a cold blur off it), the cold shade, the
 * white body along the upper side, and a bright thread of light on top.
 * `shift` lists the copies of each run to draw (a strip repeats).
 */
function wires(g: Ctx, list: Wire[], line: number, blur: number, shift: (w: Wire) => number[], band?: { mid: (t: number) => number; w: (t: number) => number }): void {
  if (blur) {
    // The cold shine: every run as one path, stroked once with a blur off it.
    const p = new Path2D();
    for (const r of list) for (const sx of shift(r)) {
      p.moveTo(r.pts[0] + sx, r.pts[1]);
      for (let i = 2; i < r.pts.length; i += 2) p.lineTo(r.pts[i] + sx, r.pts[i + 1]);
    }
    if (band) {
      p.moveTo(-0.3, band.mid(-0.3));
      for (let t = -0.25; t <= L + 0.3; t += 0.05) p.lineTo(t, band.mid(t));
    }
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = css(COLD, 0.26);
    g.lineWidth = blur * 2.2;
    g.stroke(p);
    g.strokeStyle = css(COLD, 0.45);
    g.lineWidth = blur * 1.2;
    g.stroke(p);
    g.restore();
  }
  // Each pass batched by width, a run cut into pieces of two segments that
  // taper step by step, so a strip of a hundred runs is a few dozen strokes.
  const pass = (style: string, k: number, add: number, dy: number): void => {
    const by = new Map<number, Path2D>();
    for (const r of list) {
      const n = r.pts.length / 2;
      for (const sx of shift(r)) {
        for (let i = 0; i < n - 1; i += 2) {
          const e = Math.min(n - 1, i + 2);
          const w = Math.round(Math.max(0.001, ((r.w[i] + r.w[e]) / 2) * k + add) * 250);
          let p = by.get(w);
          if (!p) by.set(w, (p = new Path2D()));
          p.moveTo(r.pts[i * 2] + sx, r.pts[i * 2 + 1] + dy * r.w[i]);
          for (let j = i + 1; j <= e; j++) p.lineTo(r.pts[j * 2] + sx, r.pts[j * 2 + 1] + dy * r.w[j]);
        }
      }
    }
    g.save();
    g.strokeStyle = style;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [w, p] of by) {
      g.lineWidth = w / 250;
      g.stroke(p);
    }
    if (band) {
      // The main wire, as one ribbon a pass: its width the same rule as a run's.
      g.fillStyle = style;
      g.fill(ribbon(L, (t) => band.mid(t) + dy * band.w(t), (t) => (band.w(t) * k + add) / 2, 0.05));
    }
    g.restore();
  };
  pass(css(ORE.rim), 1, line * 2, 0);
  pass(css(ORE.dark), 1, 0, 0);
  pass(css(ORE.body), 0.7, 0, -0.15);
  pass(css(ORE.shine), 0.32, 0, -0.26);
}

/**
 * A dendrite: a stem leaving the wire at `ang`, bending as it goes, with
 * twigs off it to alternate sides, each shorter toward the tip -- a frond of
 * native silver. Points are relative to its root.
 */
function frond(R: () => number, ang: number, len: number, w0: number): Wire[] {
  const out: Wire[] = [];
  const n = 5;
  const bend = (R() - 0.5) * 0.5;
  const stem: Wire = { pts: [0, 0], w: [w0] };
  let x = 0, y = 0, a = ang;
  const knots: Array<[number, number, number, number]> = [];
  for (let i = 1; i <= n; i++) {
    a += bend / n;
    x += (Math.cos(a) * len) / n;
    y += (Math.sin(a) * len) / n;
    stem.pts.push(x, y);
    stem.w.push(w0 * (1 - (i / n) * 0.62));
    if (i < n) knots.push([x, y, a, i / n]);
  }
  out.push(stem);
  let side = R() < 0.5 ? 1 : -1;
  for (const [kx, ky, ka, f] of knots) {
    if (R() < 0.1) continue;
    const tl = len * (0.62 - f * 0.38) * (0.8 + R() * 0.4);
    const ta = ka + side * (0.7 + R() * 0.3);
    const tw = w0 * (0.62 - f * 0.25);
    const mx = kx + Math.cos(ta) * tl * 0.55, my = ky + Math.sin(ta) * tl * 0.55;
    const ta2 = ta - side * 0.2;
    out.push({ pts: [kx, ky, mx, my, mx + Math.cos(ta2) * tl * 0.45, my + Math.sin(ta2) * tl * 0.45], w: [tw, tw * 0.75, tw * 0.45] });
    side = -side;
  }
  return out;
}

export const silver: SeamLook = {
  name: 'Silver vein',
  wash: hex('#c8d0e2'),
  pitch: 1.8,
  drift: 0.4,
  half: 0.32,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [5, 0.12]]);
    const wob = periodic(R, L, 0.018, [[2, 0.6], [5, 0.4]]);
    const thick = periodic(R, L, 0.006, [[3, 0.6], [7, 0.4]]);
    const bw = (t: number): number => 0.055 + wob(t);
    const bed = ribbon(L, mid, bw);
    const line = Math.max(1.1 / px, 0.009);

    // The dendrites: their roots spread along the wire, leaning one way down
    // the strip as fronds do, out to either side. All drawn before any wrap.
    const fronds: Array<{ t: number; parts: Wire[] }> = [];
    const n = 18;
    const lean = R() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5 + (R() - 0.5) * 0.7) / n) * L;
      const side = i % 2 ? 1 : -1;
      const ang = side * (0.6 + R() * 0.3);
      const a = lean > 0 ? ang : Math.PI - ang;
      const len = 0.15 + R() * 0.07;
      const parts = frond(R, a, len, 0.032 + R() * 0.006);
      for (const p of parts) for (let j = 0; j < p.pts.length; j += 2) (p.pts[j] += t), (p.pts[j + 1] += mid(t));
      fronds.push({ t, parts });
    }
    const studs: Stud[] = [];
    for (let i = 2; i < n; i += 5) studs.push({ t: fronds[i].t + 0.02, n: 0, kind: i === 7 ? 1 : 0 });
    // Flakes: a bright plate here and there on the wire.
    const flakes = Array.from({ length: 7 }, () => ({ t: R() * L, r: 0.03 + R() * 0.018, a: R() * TAU }));
    const glints = Array.from({ length: 6 }, () => ({ t: R() * L, r: 0.06 + R() * 0.035 }));

    // The cold shine off the vein, then its dark matrix.
    channel(g, bed, 0.022, 0.3);
    g.fillStyle = css(BED.dark);
    g.fill(bed);
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(bed);

    const all: Wire[] = [];
    const reach = new Map<Wire, number>();
    for (const f of fronds) for (const p of f.parts) {
      all.push(p);
      reach.set(p, f.t);
    }
    wires(g, all, line, 0.05, (r) => {
      const t = reach.get(r);
      if (t === undefined) return [0];
      const out: number[] = [];
      wrap(L, t, 0.26, (x) => out.push(x - t));
      return out;
    }, { mid, w: (t) => 0.042 + thick(t) });
    for (const f of flakes) {
      wrap(L, f.t, 0.06, (x) => {
        const y = mid(x);
        g.save();
        g.translate(x, y);
        g.rotate(f.a);
        g.beginPath();
        for (let k = 0; k < 6; k++) g.lineTo(Math.cos((k / 6) * TAU) * f.r, Math.sin((k / 6) * TAU) * f.r * 0.6);
        g.closePath();
        g.lineWidth = line * 1.4;
        g.strokeStyle = css(ORE.rim);
        g.stroke();
        g.fillStyle = css(ORE.lit);
        g.fill();
        g.fillStyle = css(ORE.shine);
        g.beginPath();
        g.ellipse(-f.r * 0.15, -f.r * 0.12, f.r * 0.5, f.r * 0.24, 0, 0, TAU);
        g.fill();
        g.restore();
      });
    }
    for (const s of glints) wrap(L, s.t, s.r, (x) => sparkle(g, x, mid(x) - 0.01, s.r, mix(ICE, CREAM, 0.5), 0.95));
    return studs;
  },
  studs: {
    w: 0.52,
    h: 0.62,
    ax: 0.5,
    ay: 0.8,
    kinds: 2,
    from: 0.9,
    twinkle: 0.3,
    draw(g, kind) {
      footShadow(g, 0, 0, 0.08, 0.3);
      glow(g, 0, -0.14, 0.22, COLD, 0.6);
      const line = 0.02;
      const parts: Wire[] = [];
      if (kind === 0) {
        // A tuft of wire silver: three wires up from one foot, each curling over at its end.
        const curl = (lean: number, h: number, turn: number, r0: number, w0: number): Wire => {
          const c: Wire = { pts: [], w: [] };
          const steps = 18;
          let x = 0, y = 0, a = -Math.PI / 2 + lean;
          const seg = h / 8;
          for (let i = 0; i <= steps; i++) {
            c.pts.push(x, y);
            c.w.push(w0 * (1 - (i / steps) * 0.6));
            const u = i / steps;
            const step = u < 0.45 ? seg : r0 * (1.2 - u);
            a += u < 0.45 ? lean * 0.08 : turn;
            x += Math.cos(a) * step;
            y += Math.sin(a) * step;
          }
          return c;
        };
        parts.push(curl(-0.2, 0.2, -0.5, 0.05, 0.036));
        parts.push(curl(0.24, 0.17, 0.52, 0.045, 0.036));
        parts.push(curl(0.02, 0.3, 0.46, 0.06, 0.046));
      } else {
        // A little upright dendrite: a stem with fronds off it either side.
        parts.push({ pts: [0, 0, 0.01, -0.12, -0.005, -0.24, 0.01, -0.32], w: [0.048, 0.038, 0.028, 0.016] });
        const side: Array<[number, number, number]> = [[-0.06, 1, -1], [-0.13, 0.85, 1], [-0.19, 0.7, -1], [-0.25, 0.5, 1]];
        for (const [y, s, d] of side) {
          const l = 0.1 * s;
          parts.push({ pts: [0.005, y, d * l * 0.6, y - l * 0.45, d * l, y - l * 0.95], w: [0.028 * s, 0.02 * s, 0.012] });
        }
      }
      wires(g, parts, line, 0, () => [0]);
      const tip = kind === 0 ? [0.03, -0.36] : [0.01, -0.33];
      sparkle(g, tip[0], tip[1], 0.13, CREAM, 0.95);
      sparkle(g, tip[0], tip[1], 0.06, ICE, 1);
    },
  },
};
