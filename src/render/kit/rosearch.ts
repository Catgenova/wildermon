import { ROSE_BUD, ROSE_FLOWER, ROSE_LEAFY, type Climber } from '../../game/roses';
import {
  css, deeper, extrude, grain, hex, KIT_INK, mix, paler, proj, slab, TAU, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type RGB, type Side, type V3,
} from './core';
import { ashlar, DRESSED, STONE, stoneSkin, strut } from './outdoor';

/**
 * The rose arches and the lavender arches (`rose_arch`, `stone_rose_arch`,
 * `lavender_arch`, `stone_lavender_arch`, a tile across and a subtile deep,
 * walked through the middle), in the kit, and the roses or the lavender
 * climbing them.
 *
 * The timber one: four square posts of the wood it was built of, a trellis up
 * each side (rails across between the posts, two laths up), two arched rails
 * over the top and slats across them. The stone one: two piers in ashlar,
 * each under an impost a hand wider, and a ring of eleven voussoirs between
 * them, the keystone standing proud. The roses climb both from the foot of
 * each side, front and back, as far as they have grown; lavender the same,
 * in clumps of grey-green, no two alike and unevenly set, with spikes of
 * purple standing up and out of them, grey-green tinged lilac in bud
 * (`climbingLavender`).
 *
 * Their `trim` is the old model's (`roseTrim` in furniture.ts), read the same
 * way: the variety in the thousands, a hundred when it is their season, and
 * the days they have grown in twentieths up to four.
 */

/* ---- the roses -------------------------------------------------------------------------- */

/** The leaves of a climbing rose, lit, mid and deep; its canes; and what each variety flowers in: the petals, their shade and the bud. */
const LEAF: RGB[] = [hex('#b0dca2'), hex('#74ad78'), hex('#4b7a5c')];
const CANE: RGB = hex('#76884e');
const BLOOMS: Array<[RGB, RGB, RGB]> = [
  [hex('#f4a3b8'), hex('#c8607c'), hex('#d4557a')],
  [hex('#e45e70'), hex('#a33a4c'), hex('#b0344a')],
  [hex('#faf4ea'), hex('#d6c3ae'), hex('#f2e2c8')],
  [hex('#f6d372'), hex('#c89f3c'), hex('#e3a634')],
];
const INK = 0.8;
const LEAF_INK: RGB = mix(LEAF[2], KIT_INK, 0.3);

/** The trim of an arch's roses (`roseTrim`): variety, whether it is their season, and the days they have grown. */
export const roseTrim = (variety: number, days: number, blooms: boolean): number =>
  (variety % BLOOMS.length) * 1000 + (blooms ? 100 : 0) + Math.floor(Math.min(4, Math.max(0, days)) * 20);
const roseOf = (trim: number): { variety: number; days: number; blooms: boolean } =>
  ({ variety: Math.floor(trim / 1000) % BLOOMS.length, blooms: trim % 1000 >= 100, days: (trim % 100) / 20 });

/** A number in 0..1 for a place on the arch, the same every time it is drawn. */
const jit = (i: number, k: number): number => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** A leaf: a pointed oval at (x, y) turned to `a`, `L` long. */
function leaf(g: Ctx, x: number, y: number, a: number, L: number, c: RGB): void {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(-L * 0.5, 0);
  g.quadraticCurveTo(0, -L * 0.36, L * 0.5, 0);
  g.quadraticCurveTo(0, L * 0.36, -L * 0.5, 0);
  g.closePath();
  g.fillStyle = css(c);
  g.fill();
  g.restore();
}

/** A rose, open: a ring of petals round a darker heart, a light on its upper left. */
function rose(g: Ctx, x: number, y: number, B: number, petal: RGB, shade: RGB): void {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.4;
    g.beginPath();
    g.arc(x + Math.cos(a) * B * 0.45, y + Math.sin(a) * B * 0.38, B * 0.55, 0, TAU);
    g.fillStyle = css(k === 1 ? mix(petal, [255, 255, 255], 0.08) : petal);
    g.fill();
  }
  g.beginPath();
  g.arc(x, y, B * 0.98, 0, TAU);
  g.strokeStyle = css(shade, 0.45);
  g.lineWidth = INK * 0.5;
  g.stroke();
  g.beginPath();
  g.arc(x + B * 0.05, y + B * 0.04, B * 0.32, 0.3, 5.4);
  g.strokeStyle = css(shade, 0.7);
  g.lineWidth = INK * 0.6;
  g.stroke();
  g.beginPath();
  g.arc(x - B * 0.3, y - B * 0.32, B * 0.2, 0, TAU);
  g.fillStyle = css(mix(petal, [255, 255, 255], 0.55), 0.85);
  g.fill();
}

/** The stems climbing one face of an arch, two to it, as far up as they have got: canes for a rose, woody stems for lavender. */
function canesPart(at: (q: number) => V3, y: number, salt: number, caneTo: number, out: number, stem: RGB): KitPart {
  const steps = 14;
  const canes: V3[][] = [0, 1].map((c) => Array.from({ length: steps + 1 }, (_, k) => {
    const q = (k / steps) * caneTo;
    const [x, , z] = at(q);
    return [x + (c ? 0.9 : -0.9) * Math.sin(q * 9 + c + salt), y * (0.9 + 0.1 * c), z] as V3;
  }));
  return {
    reach: canes.flat().map(([x, , z]) => [x, out * 0.99, z] as V3), solid: true,
    draw: (g, e) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const across = Math.hypot(e.ux, e.vx);
      for (const pass of [0, 1]) for (const cane of canes) {
        const pts = cane.map((p) => proj(e, p));
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.strokeStyle = pass ? css(stem) : css(mix(stem, KIT_INK, 0.5));
        g.lineWidth = 0.38 * across + (pass ? 0 : INK * 1.2);
        g.stroke();
      }
    },
  };
}

/**
 * The climbing roses on an arch, up each side from the foot to the crown
 * (`climbingRoses` in furniture.ts): `side(q)` is where on the left side a
 * share `q` of the way up is, the right the mirror of it, and `face` how far
 * in front of and behind the frame the growth stands. The first day canes,
 * climbing; the second the leaves fill in from the foot up; the third, in
 * their season, the buds; then the flowers. Out of season a grown arch is in
 * leaf. Each mass is a part of its own, laid with the frame by where it
 * stands; `clear` is how far out from the middle a face's growth is laid,
 * clear of the frame, so it goes in front of it from that face's side.
 */
function climbingRoses(side: (q: number) => V3, face: number, trim: number, clear: number): KitPart[] {
  const { variety, days, blooms } = roseOf(trim);
  const leafTo = days < ROSE_LEAFY ? 0 : Math.min(1, 0.25 + (0.75 * (days - ROSE_LEAFY)) / (ROSE_BUD - ROSE_LEAFY));
  const caneTo = Math.min(1, 0.15 + (0.85 * days) / ROSE_LEAFY);
  const buds = blooms && days >= ROSE_BUD ? Math.min(1, 0.3 + (0.7 * (days - ROSE_BUD)) / (ROSE_FLOWER - ROSE_BUD)) : 0;
  const flowers = blooms && days >= ROSE_FLOWER;
  const [petal, shade, bud] = BLOOMS[variety];
  const parts: KitPart[] = [];
  const N = 13;
  for (const m of [1, -1]) {
    const at = (q: number): V3 => {
      const [x, y, z] = side(q);
      return [x * m, y, z];
    };
    for (const y of [face, -face]) {
      const salt = (m > 0 ? 1 : 2) + (y > 0 ? 0 : 4);
      const out = Math.sign(y) * clear;
      parts.push(canesPart(at, y, salt, caneTo, out, CANE));
      // The leaves, in masses from the foot up, the highest still coming; buds, then roses, in their season.
      for (let i = 0; i < N; i++) {
        const q = (i + 0.35 + 0.3 * jit(i, salt)) / N;
        const grow = Math.min(1, (leafTo - q) * N * 0.7 + 1);
        if (grow <= 0.2) continue;
        const [x, , z] = at(q);
        const c: V3 = [x + (jit(i, salt + 11) - 0.5) * 2.2, y + (jit(i, salt + 13) - 0.5) * 0.9, z + (jit(i, salt + 17) - 0.5) * 1.6];
        const r = (1.9 + 1.3 * jit(i, salt + 19)) * grow;
        const nBuds = buds > 0 ? Math.round(buds * (1 + 2 * jit(i, salt + 23))) : 0;
        const nRoses = flowers ? (jit(i, salt + 29) < 0.28 ? 0 : jit(i, salt + 31) < 0.55 ? 1 : 2) : 0;
        const trail = leafTo >= 1 && q > 0.55 && jit(i, salt + 37) < 0.45 ? 2 + 4 * jit(i, salt + 41) : 0;
        const seed = i * 7 + salt;
        const yy = out;
        parts.push({
          reach: [[c[0] - r * 1.5, yy, c[2] - r * 1.5 - trail], [c[0] + r * 1.5, yy, c[2] + r * 1.5]],
          // Round on the screen however the arch is turned: seen end on, it stands out of the line of its reach (laid by that line still).
          pad: r * 1.5 * 1.75,
          solid: true,
          draw: (g, e) => {
            const [px, py] = proj(e, c);
            const R = r * Math.hypot(e.ux, e.vx);
            if (trail) {
              // A strand hanging off the mass, leaves in pairs down it.
              const x0 = px + (jit(seed, 3) - 0.5) * R, y0 = py + R * 0.3, drop = trail * 2.25;
              const sway = (jit(seed, 4) - 0.5) * R * 0.8;
              g.beginPath();
              g.moveTo(x0, y0);
              g.quadraticCurveTo(x0 + sway, y0 + drop * 0.6, x0 + sway * 0.6, y0 + drop);
              g.strokeStyle = css(LEAF[2], 0.9);
              g.lineWidth = INK * 0.7;
              g.stroke();
              for (let k = 1; k <= 4; k++) {
                const f = k / 4, tx = x0 + sway * (1.2 * f - 0.6 * f * f), ty = y0 + drop * f, L = R * (0.7 - 0.08 * k);
                leaf(g, tx - L * 0.32, ty, 2.5, L, LEAF[k % 2 ? 1 : 0]);
                leaf(g, tx + L * 0.32, ty - L * 0.1, 0.6, L, LEAF[k % 2 ? 0 : 1]);
              }
            }
            // The mass: lobes, inked round the outside, lit on top, leaves standing out of its edge.
            const lobes: Array<[number, number, number]> = [[-0.58, 0.12, 0.52], [0.56, 0.08, 0.5], [0, -0.48, 0.58], [-0.34, 0.5, 0.44], [0.36, 0.44, 0.46], [0, 0.02, 0.64]];
            g.beginPath();
            for (const [lx, ly, lr] of lobes) {
              g.moveTo(px + lx * R + lr * R, py + ly * R);
              g.arc(px + lx * R, py + ly * R, lr * R, 0, TAU);
            }
            g.strokeStyle = css(LEAF_INK, 0.9);
            g.lineWidth = INK * 1.6;
            g.stroke();
            g.fillStyle = css(LEAF[1]);
            g.fill();
            for (let k = 0; k < 6; k++) {
              const a = jit(seed, k + 50) * TAU;
              leaf(g, px + Math.cos(a) * R * 0.85, py + Math.sin(a) * R * 0.7, a, R * 0.62, LEAF[k % 3 === 0 ? 2 : 1]);
            }
            for (const [lx, ly, lr] of lobes.slice(0, 4)) {
              g.beginPath();
              g.arc(px + lx * R + lr * R * 0.18, py + ly * R - lr * R * 0.28, lr * R * 0.46, 0, TAU);
              g.fillStyle = css(LEAF[0], 0.85);
              g.fill();
            }
            for (let b = 0; b < nRoses; b++) {
              const a = jit(seed, b + 60) * TAU;
              rose(g, px + Math.cos(a) * R * 0.42, py + Math.sin(a) * R * 0.34 - R * 0.1, R * (0.42 + 0.1 * jit(seed, b + 70)), petal, shade);
            }
            for (let b = 0; b < nBuds && !nRoses; b++) {
              const a = jit(seed, b + 80) * TAU;
              const X = px + Math.cos(a) * R * 0.5, Y = py + Math.sin(a) * R * 0.4;
              const bw = Math.max(1.2, R * 0.2), bh = Math.max(1.8, R * 0.32);
              g.beginPath();
              g.ellipse(X, Y + bh * 0.42, bw * 0.95, bh * 0.36, 0, 0, TAU);
              g.fillStyle = css(LEAF[2]);
              g.fill();
              g.beginPath();
              g.moveTo(X, Y - bh);
              g.quadraticCurveTo(X + bw * 1.25, Y - bh * 0.05, X, Y + bh * 0.45);
              g.quadraticCurveTo(X - bw * 1.25, Y - bh * 0.05, X, Y - bh);
              g.closePath();
              g.fillStyle = css(bud);
              g.fill();
              g.strokeStyle = css(mix(bud, KIT_INK, 0.6), 0.85);
              g.lineWidth = INK * 0.55;
              g.stroke();
              g.beginPath();
              g.ellipse(X + bw * 0.28, Y - bh * 0.3, bw * 0.28, bh * 0.34, 0, 0, TAU);
              g.fillStyle = css(mix(petal, [255, 255, 255], 0.04), 0.9);
              g.fill();
            }
          },
        });
      }
    }
  }
  return parts;
}

/* ---- lavender ----------------------------------------------------------------------------- */

/**
 * Lavender's narrow leaves in four grey-greens, each lit, mid and deep (off
 * the lavender bush's `#7ba589` and `#567963`): sage, a yellower grey, a
 * bluer one and silver. Each clump is one of them.
 */
const LAV_TONES: Array<readonly [RGB, RGB, RGB]> = [
  [hex('#c4d6bf'), hex('#8aa892'), hex('#587462')],
  [hex('#d0d8c2'), hex('#9eac90'), hex('#67765a')],
  [hex('#b9cfc3'), hex('#7d9e90'), hex('#4f6d62')],
  [hex('#ccd6c8'), hex('#98a897'), hex('#617162')],
];
const LAV_STEM: RGB = hex('#8b8466');
/** A clump's reach at its middling size, in units. */
const LAV_R = 2.5;
/**
 * Its flowers, four purples, each with its shade: from the deep violet of a
 * Hidcote to a paler lavender-blue, round the dye's `#8a6fbf`. An arch's
 * variety is the purple most of its spikes are; the rest are the others. A
 * tip not yet open is a grey lilac.
 */
const LAV_PURPLES: Array<readonly [RGB, RGB]> = [
  [hex('#9479d0'), hex('#5c4796')],
  [hex('#7d60c4'), hex('#4a3690')],
  [hex('#9a8fe2'), hex('#5f56aa')],
  [hex('#a97cd6'), hex('#6a4598')],
];
const LAV_UNOPEN: RGB = hex('#b4adc4');
/** In bud a spike is grey-green with a faint lilac to it. */
const LAV_BUD: RGB = mix(hex('#86977c'), hex('#a48fcc'), 0.42);

/** A flower stem, in the arch's frame: from its foot to its tip, how much of it is head, and its colour (a purple, or -1 not yet open). */
interface LavSpike { from: V3; mid: V3; to: V3; head: number; purple: number; }
/** A clump: where it stands, how big, its tone, the way it leans on the screen, and its stems. */
interface LavClump { c: V3; r: number; tone: number; seed: number; spikes: LavSpike[]; reach: number; out: V3; }

/**
 * The lavender on an arch, up each side from the foot to the crown, front
 * and back, by the same `side`, `face` and `clear` as the roses
 * (`climbingRoses`), and grown by the same days. It is not set at even
 * steps: the clumps come in runs and thin out with gaps between where the
 * frame shows, big and bushy at the feet and smaller as it climbs, each a
 * size, a tone and a lean of its own and every one with its own stems. The
 * stems stand up and out from the arch, away from its middle, some taller
 * than the rest and a few long ones arching well out past it; each is topped
 * with whorls of florets in one of the purples, or grey-green touched with
 * lilac in bud.
 */
function climbingLavender(side: (q: number) => V3, face: number, trim: number, clear: number): KitPart[] {
  const { variety, days, blooms } = roseOf(trim);
  const leafTo = days < ROSE_LEAFY ? 0 : Math.min(1, 0.25 + (0.75 * (days - ROSE_LEAFY)) / (ROSE_BUD - ROSE_LEAFY));
  const caneTo = Math.min(1, 0.15 + (0.85 * days) / ROSE_LEAFY);
  const buds = blooms && days >= ROSE_BUD ? Math.min(1, 0.3 + (0.7 * (days - ROSE_BUD)) / (ROSE_FLOWER - ROSE_BUD)) : 0;
  const flowers = blooms && days >= ROSE_FLOWER;
  const parts: KitPart[] = [];
  for (const m of [1, -1]) {
    const at = (q: number): V3 => {
      const [x, y, z] = side(Math.max(0, Math.min(1, q)));
      return [x * m, y, z];
    };
    // Away from the arch's middle at a share `q` up it: sideways up the legs, up and out over the crown.
    const outward = (q: number): V3 => {
      const [x0, , z0] = at(q - 0.01), [x1, , z1] = at(q + 0.01);
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1;
      return [(-dz / l) * m, 0, (dx / l) * m];
    };
    for (const y of [face, -face]) {
      const salt = (m > 0 ? 1 : 2) + (y > 0 ? 0 : 4);
      const out = Math.sign(y) * clear;
      parts.push(canesPart(at, y, salt, caneTo, out, LAV_STEM));
      // Where the clumps stand: in runs, with now and then a gap, closer at the foot.
      const clumps: LavClump[] = [];
      let q = -0.03 + 0.03 * jit(salt, 1);
      for (let i = 0; q < 1.02 && i < 40; i++) {
        const seed = salt * 101 + i * 13;
        const s = jit(seed, 2);
        const foot = q < 0.12;
        // Bigger and bushier low down, smaller as it climbs, and every one its own size.
        const size = Math.max(0.55, Math.min(1.7, (1.3 - 0.55 * q + (foot ? 0.25 : 0)) * (0.6 + 0.8 * s)));
        const grow = Math.min(1, (leafTo - q) * 9 + 1);
        if (grow > 0.2) {
          const [x, , z] = at(q);
          const o = outward(q);
          const c: V3 = [x + (jit(seed, 3) - 0.5) * 2.6 + o[0] * 0.6, y + (jit(seed, 4) - 0.5) * 1.3, z + (jit(seed, 5) - 0.5) * 1.6 + o[2] * 0.4];
          const r = LAV_R * size * grow;
          clumps.push({ c, r, tone: Math.floor(jit(seed, 6) * LAV_TONES.length), seed, spikes: [], reach: r, out: o });
        }
        // The step to the next: overlapping in a run, sometimes a gap where the frame shows.
        const gap = !foot && jit(seed, 7) < 0.16 ? 0.05 + 0.07 * jit(seed, 8) : 0;
        q += (foot ? 0.02 : 0.03) + 0.045 * jit(seed, 9) * (0.6 + 0.4 * size) + gap;
      }
      // Their stems: none out of season, short and grey in bud, in flower a fan of them up and out.
      if (buds > 0 || flowers) {
        for (const [ci, k] of clumps.entries()) {
          const { c, r, seed, out: o } = k;
          const size = r / LAV_R;
          if (jit(seed, 10) < 0.14) continue;
          const many = flowers ? Math.round(size * (1.5 + 4.5 * jit(seed, 11))) : Math.round((0.4 + 0.6 * buds) * size * (1.5 + 4 * jit(seed, 11)));
          const lean = (jit(seed, 12) - 0.5) * 0.7;
          for (let n = 0; n < many; n++) {
            const u = jit(seed, 20 + n), v = jit(seed, 40 + n), w = jit(seed, 60 + n);
            const tall = w < 0.12 ? 1.45 : 1;
            const from: V3 = [c[0] + (u - 0.5) * r * 1.1, c[1] + (v - 0.5) * r * 0.6, c[2] + r * (0.05 + 0.25 * jit(seed, 80 + n))];
            // Up, out from the arch, and leaning this clump's way, each a little its own.
            const spread = (u - 0.5) * 1.2 + lean;
            const lift = 0.35 + 0.8 * jit(seed, 170 + n);
            const d: V3 = [o[0] * lift + spread * 0.65, (v - 0.5) * 0.5, 1 + o[2] * 0.3];
            const dl = Math.hypot(d[0], d[1], d[2]);
            const L = r * (flowers ? 0.8 + 0.6 * jit(seed, 100 + n) : 0.65 + 0.35 * jit(seed, 100 + n)) * tall;
            const to: V3 = [from[0] + (d[0] / dl) * L, from[1] + (d[1] / dl) * L, from[2] + (d[2] / dl) * L];
            const mid: V3 = [(from[0] + to[0]) / 2 + (d[0] / dl) * L * 0.06, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2 - L * 0.04];
            const pick = jit(seed, 120 + n);
            const purple = pick < 0.1 ? -1 : pick < 0.62 ? variety % LAV_PURPLES.length : Math.floor(jit(seed, 140 + n) * LAV_PURPLES.length);
            k.spikes.push({ from, mid, to, head: 0.34 + 0.18 * jit(seed, 160 + n), purple });
            k.reach = Math.max(k.reach, L + r);
          }
          // Now and then a long stem arching right out past the rest.
          if (flowers && ci % 3 === 1 && jit(seed, 13) < 0.5) {
            const L = 3.4 + 2 * jit(seed, 14);
            const sx = (jit(seed, 15) - 0.5) * 0.6;
            const from: V3 = [c[0], c[1], c[2] + r * 0.2];
            const to: V3 = [from[0] + (o[0] * 0.7 + sx) * L, from[1] + (jit(seed, 16) - 0.5) * 1.2, from[2] + (0.75 + o[2] * 0.3) * L];
            const mid: V3 = [from[0] + (o[0] * 0.55 + sx) * L * 0.55, (from[1] + to[1]) / 2, from[2] + (0.35 + o[2] * 0.3) * L * 0.6];
            k.spikes.push({ from, mid, to, head: 0.3, purple: variety % LAV_PURPLES.length });
            k.reach = Math.max(k.reach, L + r);
          }
        }
      }
      // Highest first, so each clump's stems stand up in front of the one above it.
      for (const k of clumps.slice().reverse()) parts.push(lavenderClump(k, out, flowers ? 'flower' : 'bud'));
    }
  }
  return parts;
}

/** A point on a stem a share `t` of the way from its foot to its tip, bent through its middle. */
const bend = (a: Pt, b: Pt, c: Pt, t: number): Pt => {
  const s = 1 - t;
  return [s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]];
};

/**
 * One clump of lavender, as a part laid with the frame by where it stands:
 * a low mound of its grey-green, shadowed under it, bristling with short
 * fine leaves that stand up out of it, lit on top; its stems behind it and
 * in front; and on each stem's head the
 * whorls of florets -- spaced out low on the head and close at the tip --
 * over a faint wash of their colour, so from far off a run of them is a
 * purple haze.
 */
function lavenderClump(k: LavClump, out: number, show: 'flower' | 'bud'): KitPart {
  const { c, r, seed, spikes } = k;
  const [lit, mid, deep] = LAV_TONES[k.tone];
  return {
    reach: [[c[0] - r, out, c[2] - r], [c[0] + r, out, c[2] + r]],
    pad: (k.reach + r) * 2.2,
    solid: true,
    draw: (g, e) => {
      const unit = Math.hypot(e.ux, e.vx);
      const [px, py] = proj(e, c);
      const R = r * unit;
      // Which way is up and out on the screen, for the leaves.
      const [ox, oy] = proj(e, [c[0] + k.out[0] * 0.5, c[1], c[2] + 1 + k.out[2] * 0.3]);
      const up = Math.atan2(oy - py, ox - px) + (jit(seed, 30) - 0.5) * 0.5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const stems = spikes.map((s) => [proj(e, s.from), proj(e, s.mid), proj(e, s.to)] as const);
      const stemW = Math.max(0.4, 0.09 * unit);
      const drawStems = (back: boolean): void => {
        for (const [i, [a, b, t]] of stems.entries()) {
          if ((jit(seed, 200 + i) < 0.4) !== back) continue;
          g.beginPath();
          g.moveTo(a[0], a[1]);
          g.quadraticCurveTo(b[0], b[1], t[0], t[1]);
          g.strokeStyle = css(mix(deep, LAV_STEM, 0.3), 0.95);
          g.lineWidth = stemW;
          g.stroke();
        }
      };
      drawStems(true);
      // The mound: three to five lobes, no two clumps alike, its shadow under it and no hard rule round it.
      const nl = 3 + Math.floor(jit(seed, 31) * 3);
      const lobes: Array<[number, number, number]> = [];
      for (let i = 0; i < nl; i++) {
        const a = jit(seed, 32 + i) * TAU;
        const d = i === 0 ? 0 : 0.22 + 0.28 * jit(seed, 38 + i);
        lobes.push([Math.cos(a) * d * 1.15, Math.sin(a) * d * 0.55 + 0.05, (0.36 + 0.22 * jit(seed, 44 + i)) * (i === 0 ? 1.2 : 1)]);
      }
      const blob = (dy: number, k: number): void => {
        g.beginPath();
        for (const [lx, ly, lr] of lobes) {
          g.moveTo(px + lx * R + lr * R * k, py + ly * R + dy);
          g.arc(px + lx * R, py + ly * R + dy, lr * R * k, 0, TAU);
        }
      };
      blob(R * 0.07, 1.02);
      g.fillStyle = css(deep, 0.85);
      g.fill();
      blob(0, 0.96);
      g.fillStyle = css(mix(mid, deep, 0.5));
      g.fill();
      // Its needles: short, fine, many, standing up out of it, deep low in it and lit on top.
      const nLeaves = Math.round((22 + 18 * jit(seed, 50)) * Math.min(1.6, 0.4 + r / LAV_R));
      const lw = Math.max(0.45, R * 0.075);
      for (let i = 0; i < nLeaves; i++) {
        // Each in one of the lobes, so the whole mound bristles.
        const [lx, ly, lr] = lobes[Math.floor(jit(seed, 240 + i) * lobes.length)];
        const u = jit(seed, 60 + i), v = jit(seed, 120 + i);
        const x0 = px + (lx + (u - 0.5) * lr * 1.7) * R, y0 = py + (ly + (v - 0.55) * lr * 1.6) * R;
        const hi = Math.max(0, Math.min(1, 0.5 - (ly + (v - 0.55) * lr * 1.6) * 0.9));
        const col = hi > 0.6 ? mix(lit, mid, 0.15) : hi > 0.3 ? mix(mid, lit, 0.45) : mid;
        const a = up + (u - 0.5) * 1.3 + (jit(seed, 160 + i) - 0.5) * 0.6;
        const L = R * (0.2 + 0.24 * jit(seed, 200 + i)) * (0.75 + 0.4 * hi);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L);
        g.strokeStyle = css(col, 0.95);
        g.lineWidth = lw;
        g.stroke();
      }
      // Light on the top of the mound.
      g.beginPath();
      g.ellipse(px - R * 0.12, py - R * 0.22, R * 0.3, R * 0.13, -0.2, 0, TAU);
      g.fillStyle = css(lit, 0.3);
      g.fill();
      drawStems(false);
      // The heads: a wash of their colour, then the florets, whorl by whorl, closer toward the tip.
      const fr = Math.max(0.4, 0.15 * unit);
      for (const [i, s] of spikes.entries()) {
        const [a, b, t] = stems[i];
        const bud = show === 'bud';
        const [col, shade] = s.purple < 0 ? [LAV_UNOPEN, mix(LAV_UNOPEN, KIT_INK, 0.35)] : LAV_PURPLES[s.purple];
        const body = bud ? LAV_BUD : col;
        const dark = bud ? mix(LAV_BUD, deep, 0.5) : shade;
        const t0 = 1 - s.head;
        const W = bud ? 4 : 5 + Math.floor(jit(seed, 300 + i) * 3);
        {
          const h0 = bend(a, b, t, t0), h1 = bend(a, b, t, 1);
          g.beginPath();
          g.moveTo(h0[0], h0[1]);
          g.lineTo(h1[0], h1[1]);
          g.strokeStyle = css(body, bud ? 0.22 : 0.32);
          g.lineWidth = fr * 2.6;
          g.stroke();
        }
        for (let j = 0; j < W; j++) {
          // Spaced out at the foot of the head, close at its tip.
          const f = j / (W - 1);
          const tt = t0 + s.head * (1 - (1 - f) * (1 - f) * 0.9 - 0.1 * (1 - f));
          const [x, yy] = bend(a, b, t, Math.min(1, tt));
          const [x2, y2] = bend(a, b, t, Math.min(1, tt + 0.02));
          const dl = Math.hypot(x2 - x, y2 - yy) || 1;
          const nx = -(y2 - yy) / dl, ny = (x2 - x) / dl;
          const wr = fr * (1.35 - 0.55 * f) * (bud ? 0.8 : 1);
          for (const side of [-1, 1, 0]) {
            const X = x + nx * side * wr * 0.8, Y = yy + ny * side * wr * 0.8 - (side === 0 ? wr * 0.2 : 0);
            g.beginPath();
            g.arc(X, Y, wr * (side === 0 ? 0.9 : 0.75), 0, TAU);
            g.fillStyle = css(side === 1 ? dark : side === -1 ? mix(body, [255, 255, 255], 0.14) : body, 0.95);
            g.fill();
          }
        }
      }
    },
  };
}

/** The roses an arch shows when nothing says: grown ten days, in their season, the first variety (as the old model draws it). */
const FULL = roseTrim(0, 10, true);
const STATES = [
  { trim: roseTrim(0, 0.6, true), label: 'canes' },
  { trim: roseTrim(1, 1.6, true), label: 'leafing' },
  { trim: roseTrim(2, 2.5, true), label: 'buds' },
  { trim: roseTrim(3, 4, true), label: 'yellow' },
  { trim: roseTrim(1, 4, false), label: 'out of season' },
];
const LAVENDER_STATES = [
  { trim: roseTrim(0, 0.6, true), label: 'stems' },
  { trim: roseTrim(1, 1.6, true), label: 'leafing' },
  { trim: roseTrim(2, 2.5, true), label: 'buds' },
  { trim: roseTrim(1, 4, true), label: 'deep violet' },
  { trim: roseTrim(2, 4, false), label: 'out of season' },
];

/* ---- the timber arch ----------------------------------------------------------------------- */

/** Its posts' half span, their height, how far the arch rises over them, and how far front and back the posts stand. */
const ARCH_X = 17.4, ARCH_H = 21.5, ARCH_RISE = 8, ARCH_D = 2.8;

function timberArchOf(look: KitLook, plant: Climber): KitModel {
  const WOOD = woodTone(look.material);
  const RAIL = deeper(WOOD, 0.06);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const X = ARCH_X, H = ARCH_H, R = ARCH_RISE, D = ARCH_D;
  const up = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'y', 0.7);
  const along = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'x', 0.5);
  for (const [i, x] of [-X, X].entries()) {
    for (const [j, y] of [-D, D].entries()) add(slab(x - 0.7, x + 0.7, y - 0.7, y + 0.7, 0, H, WOOD, { corner: 0.15, paint: { front: up(i * 8 + j), back: up(i * 8 + j + 2), left: up(i * 8 + j + 4), right: up(i * 8 + j + 6) } }));
    // The trellis up the side: two laths up it, and rails across between the posts laid over them.
    const laths = [-D / 3, D / 3].map((y, j) => add(slab(x - 0.16, x + 0.16, y - 0.22, y + 0.22, 1, H - 0.4, paler(WOOD, 0.08), { paint: { left: up(30 + i * 2 + j), right: up(34 + i * 2 + j) } })));
    for (let k = 0; k < 6; k++) {
      const z = 2.2 + k * 3.6, t = k === 0 || k === 5 ? 0.32 : 0.24;
      add(slab(x - 0.26, x + 0.26, -D + 0.7, D - 0.7, z - t, z + t, RAIL, { paint: { left: along(40 + k), right: along(50 + k) } }), { after: laths });
    }
  }
  // The arched rails over the top, from post head to post head, front and back.
  const SEG = 24, T = 0.55;
  const band: Pt[] = [];
  for (let k = 0; k <= SEG; k++) { const th = Math.PI * (1 - k / SEG); band.push([(X + T) * Math.cos(th), H + (R + T) * Math.sin(th)]); }
  for (let k = SEG; k >= 0; k--) { const th = Math.PI * (1 - k / SEG); band.push([(X - T) * Math.cos(th), H + (R - T) * Math.sin(th)]); }
  const rails = [-D, D].map((y, i) => add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], band, y - 0.32, y + 0.32, WOOD, 0.1, {
    front: (g, k) => { g.save(); g.translate(-X - 1, H); grain(g, k.fill, 2 * X + 2, R + 1, 60 + i, 'x', 0.6); g.restore(); },
    back: (g, k) => { g.save(); g.translate(-X - 1, H); grain(g, k.fill, 2 * X + 2, R + 1, 62 + i, 'x', 0.6); g.restore(); },
  }), { edges: true }));
  // The slats across them, lying on their backs.
  const arc = (th: number): [number, number] => [X * Math.cos(th), H + R * Math.sin(th)];
  for (let k = 2; k <= 8; k++) {
    const th = Math.PI * (1 - k / 10);
    const [x, z] = arc(th);
    const n = [Math.cos(th) / X, Math.sin(th) / R], l = Math.hypot(n[0], n[1]);
    const ox = (n[0] / l) * (T + 0.28), oz = (n[1] / l) * (T + 0.28);
    add(strut([x + ox, -D - 0.75, z + oz], [x + ox, D + 0.75, z + oz], 0.6, 0.5, paler(WOOD, 0.05), along(70 + k), [n[0] / l, 0, n[1] / l]), { after: rails, edges: true });
  }
  parts.push(...(plant === 'lavender' ? climbingLavender : climbingRoses)((q) => {
    if (q < 0.62) return [-X, 0, 1 + ((H - 1) * q) / 0.62];
    const [x, z] = arc(Math.PI - (Math.PI / 2) * ((q - 0.62) / 0.38));
    return [x, 0, z + 0.6];
  }, D + 0.5, look.trim ?? FULL, D + 0.85));
  return { parts, shade: [[-X - 1, -D - 1, 0], [X + 1, -D - 1, 0], [X + 1, D + 1, 0], [-X - 1, D + 1, 0]] };
}

export const ROSE_ARCH: KitPiece = {
  model: (look) => timberArchOf(look, 'rose'),
  uses: { trim: true, material: true },
  states: STATES,
};

export const LAVENDER_ARCH: KitPiece = {
  model: (look) => timberArchOf(look, 'lavender'),
  uses: { trim: true, material: true },
  states: LAVENDER_STATES,
};

/* ---- the stone arch ------------------------------------------------------------------------ */

function stoneArchOf(look: KitLook, plant: Climber): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const P0 = 14.2, P1 = 19.6, D = 3, HP = 18.6;
  const dressed = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => ashlar(g, k.fill, s.w, s.h, 1.7, 3.4, seed);
  for (const [i, sgn] of [-1, 1].entries()) {
    const [a, b] = sgn < 0 ? [-P1, -P0] : [P0, P1];
    add(slab(a, b, -D, D, 0, HP, STONE, { corner: 0.15, paint: { front: dressed(1 + i * 4), back: dressed(2 + i * 4), left: dressed(3 + i * 4), right: dressed(4 + i * 4) } }));
    const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 1.4);
    add(slab(a - 0.45, b + 0.45, -D - 0.45, D + 0.45, HP, HP + 1.3, DRESSED, { corner: 0.15, bevel: 0.2, paint: { front: skin(11 + i), back: skin(13 + i), left: skin(15 + i), right: skin(17 + i) } }), { edges: true });
  }
  // The ring: eleven voussoirs from impost to impost, the middle one the keystone, proud of the rest.
  const z0 = HP + 1.3, ri = P0, ro = P0 + 3, rise = 9.6, riseO = rise + 3;
  const inner = (th: number): Pt => [ri * Math.cos(th), z0 + rise * Math.sin(th)];
  const outer = (th: number): Pt => [ro * Math.cos(th), z0 + riseO * Math.sin(th)];
  const N = 11;
  for (let k = 0; k < N; k++) {
    const t0 = Math.PI * (1 - k / N), t1 = Math.PI * (1 - (k + 1) / N);
    const key = k === (N - 1) / 2;
    const d = key ? D + 0.35 : D, lift = key ? 0.8 : 0;
    const [ox0, oz0] = outer(t0), [ox1, oz1] = outer(t1);
    const outline: Pt[] = [inner(t0), inner(t1), [ox1, oz1 + lift], [ox0, oz0 + lift]];
    const face = (seed: number) => (g: Ctx, kk: PaintCtx): void => {
      g.save();
      g.translate(-ro, z0);
      stoneSkin(g, kk.fill, 2 * ro, riseO + 1, seed, 0.6);
      g.restore();
    };
    add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, -d, d, key ? paler(DRESSED, 0.06) : DRESSED, 0.18, { front: face(30 + k), back: face(50 + k) }), { edges: true });
  }
  parts.push(...(plant === 'lavender' ? climbingLavender : climbingRoses)((q) => {
    if (q < 0.6) return [-(P0 + P1) / 2, 0, 1 + ((HP - 1) * q) / 0.6];
    const th = Math.PI - (Math.PI / 2) * ((q - 0.6) / 0.4);
    return [((ri + ro) / 2) * Math.cos(th), 0, z0 + (rise + 1.5) * Math.sin(th) + 0.4];
  }, D + 0.5, look.trim ?? FULL, D + 0.85));
  return { parts, shade: [[-P1 - 0.5, -D - 0.5, 0], [P1 + 0.5, -D - 0.5, 0], [P1 + 0.5, D + 0.5, 0], [-P1 - 0.5, D + 0.5, 0]] };
}

export const STONE_ROSE_ARCH: KitPiece = {
  model: (look) => stoneArchOf(look, 'rose'),
  uses: { trim: true },
  states: STATES,
};

export const STONE_LAVENDER_ARCH: KitPiece = {
  model: (look) => stoneArchOf(look, 'lavender'),
  uses: { trim: true },
  states: LAVENDER_STATES,
};
