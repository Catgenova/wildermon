import { channel, css, footShadow, glow, hex, mix, palOf, periodic, poly, ribbon, seeded, sparkle, wrap, CREAM } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Zinc: a thin sea-green vein that bursts every so often into sprays of
 * bladed crystals -- long flat mint-teal blades fanning out from one root
 * into the stone either side, like a sheaf of knives -- with loose blades
 * lying along it between. The spray (a star of blades) is the shape that
 * tells it from tin's beads, lead's cubes and the rare ores' gems; the
 * teal is the colour. The best sprays stand up off the face.
 */
const L = 4;
const BED = palOf('#5d8f8f', { dark: 0.36 });
const ORE = palOf('#a6e8d6', { lit: 0.55, rim: 0.64, dark: 0.3 });
/** The light in a blade is a cold sea-glass, not quite the kit's cream. */
const GLASS = mix(hex('#dcfff4'), CREAM, 0.4);
/** How far a spray reaches across from its root, in tiles. */
const REACH = 0.12;

/**
 * One blade: a long flat lozenge from its root at (x, y) out along `ang`,
 * split down its length into the half facing up the picture (lit) and the
 * half facing down (shade), with a line of shine along the ridge.
 */
function blade(g: Ctx, x: number, y: number, ang: number, len: number, wd: number, pal: Pal, line: number, shine: boolean): void {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // Its sides: `u` toward the light (the normal that points up the picture), `d` away.
  const sg = ca < 0 ? -1 : 1;
  const ux = sa * sg, uy = -ca * sg;
  const P = (f: number, k: number): [number, number] => [x + ca * len * f + ux * wd * k, y + sa * len * f + uy * wd * k];
  // Straight-sided, narrow at the root, squared off at the end in a chisel: a crystal, not a leaf.
  const out = [P(0, 0.45), P(0.22, 1), P(1, 0.85), P(0.86, -1), P(0.22, -1), P(0, -0.45)];
  g.beginPath();
  poly(g, out.flat());
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line * 1.3;
  g.stroke();
  g.fillStyle = css(pal.dark);
  g.fill();
  g.fillStyle = css(pal.lit);
  g.beginPath();
  poly(g, [...P(0, 0), ...P(0, 0.45), ...P(0.22, 1), ...P(1, 0.85), ...P(0.93, 0)]);
  g.fill();
  // The chisel end catches the light flat on.
  g.fillStyle = css(pal.body);
  g.beginPath();
  poly(g, [...P(0.93, 0), ...P(1, 0.85), ...P(0.86, -1)]);
  g.fill();
  if (shine) {
    g.strokeStyle = css(GLASS, 0.95);
    g.lineWidth = line * 0.9;
    g.beginPath();
    g.moveTo(...P(0.1, 0.35));
    g.lineTo(...P(0.82, 0.45));
    g.stroke();
  }
}

export const zinc: SeamLook = {
  name: 'Zinc vein',
  wash: hex('#9fc4c0'),
  pitch: 1.75,
  drift: 0.4,
  half: 0.32,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.03, [[1, 0.6], [2, 0.3], [5, 0.12]]);
    const wob = periodic(R, L, 0.02, [[3, 0.6], [4, 0.4]]);
    const w = (t: number): number => 0.05 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.1 / px, 0.011);
    channel(g, body, 0.025, 0.3);
    g.fillStyle = css(BED.dark);
    g.fill(body);
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // Where the sprays root: spread evenly along the vein, a few a tile.
    const n = 9;
    const sprays = Array.from({ length: n }, (_, i) => {
      const t = ((i + 0.5 + (R() - 0.5) * 0.5) / n) * L;
      const k = 5 + Math.floor(R() * 3);
      const spin = R() * Math.PI;
      const blades = Array.from({ length: k }, (_, j) => {
        // A star, not a wheel: the blades bunched into two opposed fans.
        const ang = spin + (j % 2 ? Math.PI : 0) + ((Math.floor(j / 2) / Math.max(1, Math.ceil(k / 2) - 1)) - 0.5) * 1.3 + (R() - 0.5) * 0.25;
        const wd = 0.022 + R() * 0.01;
        // Those lying across the vein are cut short, so the spray stays inside REACH of the band's middle:
        // the band fills only as wide as its art, and the fill is what it costs.
        const len = Math.min(0.12 + R() * 0.07, (REACH - wd) / Math.max(0.01, Math.abs(Math.sin(ang))));
        return { ang, len, wd, shine: R() < 0.6 };
      });
      // Shortest first, so the long ones lie over them.
      blades.sort((a, b) => a.len - b.len);
      return { t, dy: (R() - 0.5) * 0.04, blades, stud: i % 3 === 1 };
    });
    // Loose blades lying along the vein between the sprays.
    const loose = Array.from({ length: 22 }, () => ({
      t: R() * L,
      dy: (R() - 0.5) * 0.06,
      ang: (R() - 0.5) * 0.7 + (R() < 0.5 ? 0 : Math.PI),
      len: 0.07 + R() * 0.06,
      wd: 0.016 + R() * 0.008,
    }));
    const flecks = Array.from({ length: 16 }, () => [R() * L, (R() - 0.5) * 0.3, R()]);

    // A sea-green stain in the stone round each spray, under everything.
    for (const s of sprays) wrap(L, s.t, 0.24, (x) => glow(g, x, mid(x) + s.dy, 0.13, hex('#bfeee2'), 0.42));
    for (const b of loose) {
      wrap(L, b.t, b.len + 0.02, (x) => {
        const y = mid(x) + b.dy;
        blade(g, x - (Math.cos(b.ang) * b.len) / 2, y - (Math.sin(b.ang) * b.len) / 2, b.ang, b.len, b.wd, ORE, line, false);
      });
    }
    const studs: Stud[] = [];
    for (const s of sprays) {
      if (s.stud) studs.push({ t: s.t, n: mid(s.t) + s.dy, kind: studs.length % 2 });
      wrap(L, s.t, 0.22, (x) => {
        const y = mid(x) + s.dy;
        // Each blade's own shadow in the stone first, so the spray sits in the face.
        g.save();
        g.globalAlpha = 0.28;
        g.strokeStyle = css(BED.rim);
        g.lineCap = 'round';
        g.lineWidth = 0.06;
        g.beginPath();
        for (const b of s.blades) {
          g.moveTo(x, y + 0.012);
          g.lineTo(x + Math.cos(b.ang) * b.len * 0.9, y + Math.sin(b.ang) * b.len * 0.9 + 0.012);
        }
        g.stroke();
        g.restore();
        for (const b of s.blades) blade(g, x, y, b.ang, b.len, b.wd, ORE, line, b.shine);
        // The root: a knot of the bed where the blades spring from.
        g.fillStyle = css(BED.dark);
        g.beginPath();
        g.arc(x, y, 0.022, 0, Math.PI * 2);
        g.fill();
      });
    }
    for (const [t, dy, k] of flecks) {
      wrap(L, t, 0.03, (x) => {
        g.fillStyle = css(k < 0.5 ? GLASS : ORE.body, 0.9);
        g.beginPath();
        g.arc(x, mid(x) + dy * 0.5, line * (0.7 + k * 0.6), 0, Math.PI * 2);
        g.fill();
      });
    }
    return studs;
  },
  studs: {
    w: 0.5,
    h: 0.5,
    ax: 0.5,
    ay: 0.78,
    kinds: 2,
    from: 0.9,
    draw(g, kind, px) {
      const R = seeded(kind * 389 + 7);
      const line = Math.max(1 / px, 0.012);
      footShadow(g, 0, 0, 0.11, 0.3);
      g.save();
      g.translate(0, -0.14);
      g.scale(1, 0.8);
      glow(g, 0, 0, 0.2, hex('#c8f5ea'), 0.4);
      g.restore();
      // A fan of blades standing out of one root, the outer ones leaning furthest.
      const n = 5;
      const order = [0, 4, 1, 3, 2];
      for (const i of order) {
        const f = i / (n - 1) - 0.5;
        const ang = -Math.PI / 2 + f * (1.5 + kind * 0.2) + (R() - 0.5) * 0.12;
        const len = (0.3 - Math.abs(f) * 0.16) * (0.9 + R() * 0.2);
        blade(g, 0, 0, ang, len, 0.032, ORE, line, true);
      }
      sparkle(g, -0.03 + kind * 0.05, -0.27, 0.08, CREAM, 0.95);
    },
  },
};
