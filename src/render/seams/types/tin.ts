import { channel, css, footShadow, hex, lump, mix, palOf, periodic, poly, prism, ribbon, wrap, seeded, sparkle, CREAM, TAU } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Tin: cassiterite. A pale greisen vein, lilac-white and flecked with mica,
 * studded with squat dark crystals -- four-faced points of a deep cocoa-mauve
 * with a glassy lit face, some twinned at a knee, some the amber of resin tin
 * -- and here and there a stubby crystal standing up off the face. Dark
 * points in pale rock is what tells it from zinc's teal blades, lead's cubes
 * and coal's thick dark seam.
 */
const L = 4;
const BED = palOf('#e3dde8', { dark: 0.14, rim: 0.5 });
const CASS = palOf('#6e5365', { dark: 0.5, lit: 0.58, rim: 0.55 });
CASS.dark = mix(CASS.dark, hex('#3f3346'), 0.35);
CASS.shine = hex('#fffaf2');
const RESIN = palOf('#a8705c', { dark: 0.4, lit: 0.55, rim: 0.6 });
/** The same, for a crystal standing up: the prism lights a whole face with `lit` and a facet of its point with `shine`, so both come down a step. */
const UP: Pal = { ...CASS, lit: mix(CASS.body, CASS.lit, 0.55), shine: CASS.lit };
const UP_RESIN: Pal = { ...RESIN, lit: mix(RESIN.body, RESIN.lit, 0.55), shine: RESIN.lit };
const MICA = hex('#c9c3dc');

/**
 * A cassiterite crystal seen from above its point: a rhombus `r` long and
 * `r * sq` across at `ang`, cut into four faces meeting at the point, the
 * face toward the light lit, the one away dark, with a glint on the point.
 */
function point(g: Ctx, x: number, y: number, r: number, ang: number, sq: number, pal: Pal, line: number): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (a: number, b: number): [number, number] => [x + a * c - b * s, y + a * s + b * c];
  const e = [P(-r, 0), P(0, -r * sq), P(r, 0), P(0, r * sq)];
  // The point sits a little toward the light, so the lit faces are the narrow ones.
  const top: [number, number] = [x - r * 0.12, y - r * 0.14];
  g.beginPath();
  poly(g, e.flat());
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line;
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = e[i], b = e[(i + 1) % 4];
    // Which way the face looks: light from the top left of the strip.
    const fx = (a[0] + b[0]) / 2 - x, fy = (a[1] + b[1]) / 2 - y;
    const lit = -fy * 0.85 - fx * 0.5;
    g.fillStyle = css(lit > r * 0.2 ? pal.lit : lit < -r * 0.2 ? pal.dark : pal.body);
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.lineTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fill();
  }
  g.fillStyle = css(pal.shine);
  g.beginPath();
  g.ellipse(top[0] - r * 0.06, top[1] - r * 0.06, r * 0.16, r * 0.1, ang, 0, TAU);
  g.fill();
}

export const tin: SeamLook = {
  name: 'Tin vein',
  wash: hex('#c4bdb2'),
  pitch: 1.7,
  drift: 0.4,
  half: 0.27,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.06, [[1, 0.6], [3, 0.3]]);
    const wob = periodic(R, L, 0.03, [[2, 0.6], [5, 0.4]]);
    const w = (t: number): number => 0.082 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.012);
    channel(g, body, 0.026, 0.34);
    g.fillStyle = css(BED.body);
    g.fill(body);
    // The greisen's grain: a shade along its lower edge, and mica.
    g.save();
    g.clip(body);
    g.strokeStyle = css(BED.dark);
    g.lineWidth = 0.05;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.04) g.lineTo(x, mid(x) + w(x));
    g.stroke();
    for (let i = 0; i < 46; i++) {
      const t = R() * L, y = mid(t) + (R() - 0.5) * w(t) * 1.6;
      const a = (R() - 0.5) * 1.2, len = line * (1.5 + R() * 1.5);
      g.strokeStyle = css(R() < 0.6 ? MICA : mix(BED.dark, BED.rim, 0.4), 0.9);
      g.lineWidth = line * 0.9;
      g.beginPath();
      g.moveTo(t - Math.cos(a) * len, y - Math.sin(a) * len);
      g.lineTo(t + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // The crystals: in clutches of one to three, singles and knee twins, with pale rock between.
    const studs: Stud[] = [];
    let t = R() * 0.12;
    let i = 0;
    while (t < L - 0.06) {
      const n = 1 + Math.floor(R() * 3);
      const stud = i % 7 === 2;
      const dy0 = (R() - 0.5) * 0.05;
      if (stud) studs.push({ t, n: dy0, kind: Math.floor(R() * 2) });
      const pieces = Array.from({ length: n }, (_, k) => {
        const r = (stud && k === 0 ? 0.068 : 0.048) + R() * 0.032;
        return {
          dt: k === 0 ? 0 : (R() < 0.5 ? -1 : 1) * (0.06 + R() * 0.06),
          dy: k === 0 ? dy0 : (R() - 0.5) * 0.07,
          r,
          ang: (R() - 0.5) * 1.4,
          sq: 0.62 + R() * 0.18,
          twin: R() < 0.3,
          resin: R() < 0.2,
          glint: R() < 0.22,
        };
      });
      wrap(L, t, 0.2, (x) => {
        for (const p of pieces) {
          const pal = p.resin ? RESIN : CASS;
          const px0 = x + p.dt, py0 = mid(px0) + p.dy;
          if (p.twin) {
            // The knee: a second point grown off the first's end at an angle.
            const c = Math.cos(p.ang), s = Math.sin(p.ang);
            point(g, px0 + c * p.r * 0.9, py0 + s * p.r * 0.9, p.r * 0.8, p.ang + 0.95, p.sq, pal, line * 1.3);
          }
          point(g, px0, py0, p.r, p.ang, p.sq, pal, line * 1.3);
          // The glassy lustre: a glint on the odd point.
          if (p.glint) sparkle(g, px0 - p.r * 0.15, py0 - p.r * 0.18, p.r * 0.75, CREAM, 0.95);
        }
      });
      t += 0.16 + R() * 0.18;
      i++;
    }
    return studs;
  },
  studs: {
    w: 0.4,
    h: 0.4,
    ax: 0.5,
    ay: 0.72,
    kinds: 2,
    from: 0.9,
    draw(g, kind) {
      const R = seeded(kind * 433 + 11);
      footShadow(g, 0, 0, 0.11, 0.3);
      // A bed of greisen round the foot, then the crystal: a stubby prism with a pointed end, or two twinned at a knee.
      const crust = new Path2D();
      lump(crust, 0, -0.008, 0.12, R, 8, 0.4, 0.4, 0);
      g.fillStyle = css(BED.rim);
      g.fill(crust);
      g.save();
      g.translate(0, -0.008);
      g.scale(0.88, 0.78);
      g.fillStyle = css(BED.body);
      g.fill(crust);
      g.restore();
      if (kind) {
        prism(g, -0.04, -0.004, 0.075, 0.075, -0.55, UP, 0.022);
        prism(g, 0.035, 0.002, 0.082, 0.088, 0.45, UP, 0.022);
      } else {
        prism(g, 0.055, 0.004, 0.06, 0.045, 0.4, UP_RESIN, 0.02);
        prism(g, -0.01, 0.006, 0.095, 0.095, -0.12, UP, 0.024);
      }
      sparkle(g, -0.035, -0.17, 0.055, CREAM, 0.9);
    },
  },
};
