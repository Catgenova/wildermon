import { boss, channel, css, footShadow, hex, lump, mix, palOf, periodic, ribbon, wrap, seeded, sparkle, CREAM, TAU } from '../kit';
import type { Pal } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Copper: a terracotta vein of cuprite rimmed in mint verdigris, with native
 * copper in it -- branching coral-pink nuggets, two to four domes grown into
 * one lump with a rose-gold shine and patina on their shaded side, strung on
 * a wandering thread of the metal -- and the odd one standing proud of the
 * face in a crust of verdigris. The branching lump and the green round the
 * orange are what tell it from iron's crowded red bubbles.
 */
const L = 4;
const BED = palOf('#b86f5c', { dark: 0.38 });
const ORE = palOf('#f19a72', { lit: 0.5, rim: 0.6 });
ORE.lit = hex('#ffc6a6');
ORE.shine = hex('#fff1e4');
ORE.dark = hex('#d0745a');
const VERD = palOf('#8fd9bf', { rim: 0.5, lit: 0.5 });

/**
 * Native copper: `n` lumps grown into one, along a crooked line from (x, y)
 * at `ang`, under one line, each with its own dome of light. Patina in the
 * crevices on the shaded side.
 */
function native(g: Ctx, x: number, y: number, r: number, R: () => number, ang: number, n: number, line: number, ore: Pal = ORE): void {
  const parts: Array<[number, number, number]> = [[x, y, r]];
  let px = x, py = y, a = ang;
  for (let i = 1; i < n; i++) {
    a += (R() - 0.5) * 1.2;
    const rr = r * (0.5 + R() * 0.25);
    const d = r * 0.55 + rr * 0.75;
    px += Math.cos(a) * d * (i === 1 ? 1 : 0.9);
    py += Math.sin(a) * d * 0.7;
    parts.push([px, py, rr]);
    if (R() < 0.4) {
      px = x;
      py = y;
      a = ang + Math.PI;
    }
  }
  const p = new Path2D();
  for (const [cx, cy, cr] of parts) lump(p, cx, cy, cr, R, 7, 0.3, 0.82, R() * TAU);
  g.save();
  g.lineWidth = line;
  g.strokeStyle = css(ore.rim);
  g.stroke(p);
  g.fillStyle = css(ore.dark);
  g.fill(p);
  g.clip(p);
  // Patina in the low side of the lump, under its domes.
  g.fillStyle = css(VERD.body, 0.9);
  for (const [cx, cy, cr] of parts) {
    if (R() < 0.5) continue;
    g.beginPath();
    g.ellipse(cx + cr * 0.45, cy + cr * 0.7, cr * 0.55, cr * 0.32, -0.3, 0, TAU);
    g.fill();
  }
  for (const [cx, cy, cr] of parts) {
    g.fillStyle = css(ore.body);
    g.beginPath();
    g.ellipse(cx - cr * 0.1, cy - cr * 0.14, cr * 0.8, cr * 0.66, 0, 0, TAU);
    g.fill();
    g.fillStyle = css(ore.lit);
    g.beginPath();
    g.ellipse(cx - cr * 0.22, cy - cr * 0.3, cr * 0.48, cr * 0.32, -0.3, 0, TAU);
    g.fill();
    g.fillStyle = css(ore.shine, 0.95);
    g.beginPath();
    g.ellipse(cx - cr * 0.3, cy - cr * 0.4, cr * 0.2, cr * 0.12, -0.4, 0, TAU);
    g.fill();
  }
  g.restore();
}

export const copper: SeamLook = {
  name: 'Copper vein',
  wash: hex('#d4957a'),
  pitch: 1.8,
  drift: 0.4,
  half: 0.3,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    const mid = periodic(R, L, 0.07, [[1, 0.5], [2, 0.35], [4, 0.2]]);
    const wob = periodic(R, L, 0.045, [[2, 0.6], [3, 0.4], [6, 0.2]]);
    const crust = periodic(R, L, 1, [[3, 0.6], [5, 0.4], [8, 0.3]]);
    const w = (t: number): number => 0.115 + wob(t);
    const body = ribbon(L, mid, w);
    // The cuprite inside the verdigris: narrower where the crust is thick.
    const core = ribbon(L, mid, (t) => w(t) * (0.62 + 0.2 * crust(t)));
    const line = Math.max(1.2 / px, 0.014);

    channel(g, body, 0.028, 0.32);
    g.fillStyle = css(VERD.dark);
    g.fill(body);
    g.fillStyle = css(VERD.body);
    g.save();
    g.clip(body);
    g.lineWidth = 0.03;
    g.strokeStyle = css(VERD.lit);
    g.stroke(core);
    g.restore();
    g.fillStyle = css(BED.dark);
    g.fill(core);
    g.strokeStyle = css(BED.rim, 0.7);
    g.lineWidth = line * 0.8;
    g.stroke(core);
    g.strokeStyle = css(BED.rim);
    g.lineWidth = line;
    g.stroke(body);

    // Grains of cuprite red in the bed.
    for (let i = 0; i < 40; i++) {
      const t = R() * L, y = mid(t) + (R() - 0.5) * w(t) * 1.1;
      g.fillStyle = css(R() < 0.5 ? BED.body : mix(BED.dark, BED.rim, 0.5), 0.9);
      g.beginPath();
      g.arc(t, y, line * (0.7 + R() * 0.8), 0, TAU);
      g.fill();
    }

    // Threads of native copper wandering along the bed, branching off it.
    const wire = periodic(R, L, 0.5, [[3, 0.5], [7, 0.3], [11, 0.2]]);
    const thread = new Path2D();
    for (let x = -0.3; x <= L + 0.3; x += 0.03) {
      const y = mid(x) + wire(x) * w(x) * 0.7;
      if (x === -0.3) thread.moveTo(x, y);
      else thread.lineTo(x, y);
    }
    const twigs = Array.from({ length: 10 }, () => ({ t: R() * L, a: (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len: 0.05 + R() * 0.05 }));
    for (const tw of twigs) {
      wrap(L, tw.t, 0.12, (x) => {
        const y = mid(x) + wire(x) * w(x) * 0.7;
        thread.moveTo(x, y);
        thread.lineTo(x + Math.cos(tw.a) * tw.len * 0.6, y + Math.sin(tw.a) * tw.len);
      });
    }
    g.save();
    g.clip(body);
    g.strokeStyle = css(ORE.rim);
    g.lineWidth = line * 3.2;
    g.stroke(thread);
    g.strokeStyle = css(ORE.dark);
    g.lineWidth = line * 2;
    g.stroke(thread);
    g.strokeStyle = css(ORE.lit, 0.9);
    g.lineWidth = line * 0.8;
    g.stroke(thread);
    g.restore();

    // The nuggets: branching lumps along the vein, the biggest of them also a stud.
    const studs: Stud[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5 + (R() - 0.5) * 0.5) / n) * L;
      const ww = Math.max(0.05, w(t));
      const big = i % 6 === 1;
      const r = big ? 0.085 : Math.min(0.095, 0.05 + ww * 0.3 + R() * 0.03);
      const dy = (R() - 0.5) * ww * 0.8;
      const parts = big ? 2 : 2 + Math.floor(R() * 3);
      const ang = (R() - 0.5) * 0.8 + (R() < 0.5 ? 0 : Math.PI);
      const s = R() * 1e9;
      if (big) studs.push({ t, n: dy, kind: Math.floor(R() * 2) });
      wrap(L, t, 0.3, (x) => native(g, x, mid(x) + dy, r, seeded(s), ang, parts, line * 1.3));
    }
    // Flecks of copper in the bed between them.
    for (let i = 0; i < 18; i++) {
      const t = R() * L, y = mid(t) + (R() - 0.5) * w(t) * 0.9;
      g.fillStyle = css(R() < 0.6 ? ORE.body : ORE.lit);
      g.beginPath();
      g.arc(t, y, line * (0.9 + R() * 0.7), 0, TAU);
      g.fill();
    }
    return studs;
  },
  studs: {
    w: 0.44,
    h: 0.36,
    ax: 0.5,
    ay: 0.72,
    kinds: 2,
    from: 0.9,
    draw(g, kind) {
      const R = seeded(kind * 613 + 5);
      footShadow(g, 0, 0, 0.12, 0.3);
      // A crust of verdigris round its foot, then the nugget sitting in it.
      const crust = new Path2D();
      lump(crust, 0.01, -0.01, 0.15, R, 8, 0.4, 0.4, 0);
      g.fillStyle = css(VERD.rim);
      g.fill(crust);
      g.save();
      g.translate(-0.005, -0.008);
      g.scale(0.88, 0.8);
      g.fillStyle = css(VERD.body);
      g.fill(crust);
      g.translate(-0.02, -0.01);
      g.scale(0.6, 0.6);
      g.fillStyle = css(VERD.lit);
      g.fill(crust);
      g.restore();
      if (kind) {
        boss(g, 0.075, 0.004, 0.06, ORE, R, 0.022);
        boss(g, -0.08, 0.008, 0.05, ORE, R, 0.022);
      } else boss(g, 0.07, 0.01, 0.055, ORE, R, 0.022);
      boss(g, -0.01, 0.014, 0.118, ORE, R, 0.026);
      // The glint on its crown.
      sparkle(g, -0.05, -0.15, 0.06, CREAM, 0.9);
    },
  },
};
