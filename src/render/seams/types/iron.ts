import { boss, channel, css, footShadow, gem, hex, lump, mix, nugget, palOf, periodic, ribbon, wrap, seeded, sparkle, TAU } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Iron: kidney ore. A dark rust-brown vein crusted with clusters of hematite
 * -- one fat bubble with smaller ones crowded round it, a deep red with a cold
 * steel sheen on each -- the odd angular lump of magnetite among them, and
 * ochre rust crusting the vein's edge and bleeding into the stone. Bubbles in
 * clusters with rust between them is what tells it from copper's branching
 * nuggets; the steel on the red is what tells it from anything else.
 */
const L = 4;
const BED = palOf('#86504c', { dark: 0.36 });
const STEEL = hex('#d3d3e6');
const ORE: Pal = palOf('#985b5c', { lit: 0.3, rim: 0.6 });
ORE.lit = mix(ORE.body, STEEL, 0.55);
ORE.shine = hex('#f2f3fb');
ORE.dark = hex('#6f4256');
const MAG = palOf('#7c7890', { lit: 0.45, dark: 0.35, rim: 0.62 });
const RUST = palOf('#d29e7c', { rim: 0.5, lit: 0.45, dark: 0.25 });
const STAIN = hex('#e0a072');

/** A hematite bubble: the kit's nugget in the ore's tones, with a cold bounce of light round its lower edge. */
function bubble(g: Ctx, x: number, y: number, r: number, s: number, line: number): void {
  nugget(g, x, y, r, ORE, seeded(s), { k: 10, rough: 0.1, sq: 0.9, line: 0.24, ang: 0 });
  if (r > 0.035) {
    g.strokeStyle = css(STEEL, 0.55);
    g.lineWidth = Math.max(line * 0.8, r * 0.1);
    g.beginPath();
    g.arc(x, y, r * 0.72, 0.15 * Math.PI, 0.65 * Math.PI);
    g.stroke();
  }
}

export const iron: SeamLook = {
  name: 'Iron vein',
  wash: hex('#b88880'),
  pitch: 1.8,
  drift: 0.4,
  half: 0.31,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.15]]);
    const wob = periodic(R, L, 0.04, [[2, 0.6], [3, 0.4]]);
    const w = (t: number): number => 0.1 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.2 / px, 0.013);
    // Rust bled into the stone just round the vein.
    g.strokeStyle = css(STAIN, 0.5);
    g.lineWidth = 0.06;
    g.stroke(body);
    channel(g, body, 0.022, 0.3);
    g.fillStyle = css(BED.dark);
    g.fill(body);
    // Rust crusting the edge of the vein in patches.
    const crusts = Array.from({ length: 16 }, () => ({ t: R() * L, side: R() < 0.5 ? -1 : 1, r: 0.06 + R() * 0.06, s: R() * 1e9 }));
    g.save();
    g.clip(body);
    for (const c of crusts) {
      wrap(L, c.t, c.r * 2, (x) => {
        const rr = seeded(c.s);
        const p = new Path2D();
        lump(p, x, mid(x) + c.side * w(x) * 0.8, c.r, rr, 7, 0.5, 0.62, 0);
        g.fillStyle = css(RUST.dark);
        g.fill(p);
        g.fillStyle = css(RUST.body);
        g.save();
        g.translate(0, -c.r * 0.12);
        g.fill(p);
        g.restore();
        g.fillStyle = css(RUST.lit);
        g.beginPath();
        g.ellipse(x - c.r * 0.2, mid(x) + c.side * w(x) * 0.85 - c.r * 0.25, c.r * 0.35, c.r * 0.16, 0, 0, TAU);
        g.fill();
      });
    }
    // Rust crumbs in the bed.
    for (let i = 0; i < 30; i++) {
      const t = R() * L, y = mid(t) + (R() - 0.5) * w(t) * 1.3;
      g.fillStyle = css(R() < 0.5 ? RUST.body : RUST.lit, 0.9);
      g.beginPath();
      g.arc(t, y, line * (0.8 + R() * 0.9), 0, TAU);
      g.fill();
    }
    g.restore();
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // The kidney clusters: a big bubble with small ones crowded round it,
    // the ones behind drawn first; now and then a lump of magnetite instead.
    const studs: Stud[] = [];
    let t = R() * 0.15;
    let i = 0;
    while (t < L - 0.08) {
      const ww = Math.max(0.06, w(t));
      const big = Math.min(0.095, 0.05 + ww * 0.3 + R() * 0.02);
      const dy = (R() - 0.5) * ww * 0.7;
      const mag = i % 5 === 3;
      const stud = i % 5 === 1;
      if (stud) studs.push({ t, n: dy, kind: Math.floor(R() * 2) });
      const kids = Array.from({ length: 3 + Math.floor(R() * 4) }, () => {
        const a = R() * TAU;
        const r = big * (0.35 + R() * 0.3);
        return { dx: Math.cos(a) * (big * 0.9 + r * 0.3), dy: Math.sin(a) * (big * 0.75 + r * 0.2), r, s: R() * 1e9, front: Math.sin(a) > 0.3 };
      });
      const s = R() * 1e9;
      wrap(L, t, big * 2.2, (x) => {
        const y = mid(x) + dy;
        for (const k of kids) if (!k.front) bubble(g, x + k.dx, y + k.dy, k.r, k.s, line);
        if (mag) gem(g, x, y, big * 0.95, MAG, seeded(s), { sides: 5, sq: 0.85, line: 0.22 });
        else bubble(g, x, y, big, s, line);
        for (const k of kids) if (k.front) bubble(g, x + k.dx, y + k.dy, k.r, k.s, line);
      });
      t += big * 2.3 + R() * 0.12;
      i++;
    }
    return studs;
  },
  studs: {
    w: 0.42,
    h: 0.36,
    ax: 0.5,
    ay: 0.72,
    kinds: 2,
    from: 0.9,
    draw(g, kind) {
      const R = seeded(kind * 787 + 3);
      footShadow(g, 0, 0, 0.13, 0.3);
      // Rust round its foot, then the kidney lump: small bubbles behind, the big one in front.
      const crust = new Path2D();
      lump(crust, 0, -0.008, 0.14, R, 8, 0.45, 0.38, 0);
      g.fillStyle = css(RUST.rim);
      g.fill(crust);
      g.save();
      g.translate(0, -0.008);
      g.scale(0.88, 0.78);
      g.fillStyle = css(RUST.body);
      g.fill(crust);
      g.restore();
      boss(g, 0.07, -0.012, 0.055, ORE, R, 0.02);
      boss(g, -0.075, -0.004, 0.05 + kind * 0.01, ORE, R, 0.02);
      if (kind) boss(g, 0.02, -0.06, 0.045, ORE, R, 0.02);
      boss(g, -0.01, 0.012, 0.1, ORE, R, 0.026);
      g.strokeStyle = css(STEEL, 0.6);
      g.lineWidth = 0.012;
      g.beginPath();
      g.arc(-0.01, 0.012 - 0.1 * 0.62, 0.1 * 0.7, 0.2 * Math.PI, 0.7 * Math.PI);
      g.stroke();
      sparkle(g, -0.045, -0.12, 0.05, ORE.shine, 0.85);
    },
  },
};
