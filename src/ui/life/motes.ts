import { clamp01, ease, rnd, type Ctx, type LifePiece } from './kit';

/** Motes off the altar's sea glass: this many with no favour, and up to this many more at a full store. */
export const MOTES_LEAST = 3;

export const MOTES_MORE = 9;

/** Where a mote buds and how it goes: up off the top, up a side of the band, or a short glint on the foot. */
type Way = 'top' | 'side' | 'foot';

/** A place on the frame a mote buds from, and whether it is sea glass or a pearl. */
interface Bud {
  x: number;
  y: number;
  glass: boolean;
  way: Way;
}

/** Halo colours, as `r, g, b`: favour's gold, sea glass aqua and a pearl's rose. Each deep enough to ring a mote on white marble. */
const GOLD = '238, 172, 52', AQUA = '58, 186, 196', ROSE = '226, 142, 186';
/** The core of each, near white with a breath of its colour. */
const CORE: Record<string, string> = { [GOLD]: '255, 248, 214', [AQUA]: '236, 255, 252', [ROSE]: '255, 240, 248' };
/** The rim round each core: its colour a shade deeper, never dark. */
const DEEP: Record<string, string> = { [GOLD]: '214, 138, 30', [AQUA]: '30, 150, 166', [ROSE]: '200, 104, 158' };

/**
 * The buds of the altar frame, in the window's own px, from the geometry `PAINTERS.altar` draws:
 * a point along the top's waves, the top's middle pearl and corner pearls, the bottom corners'
 * pearls (whose motes climb the side band), the side waves on a tall window, and the foot's
 * pearls and waves. `s` (0..1) picks among them, weighted toward the top, where they rise free.
 */
function bud(w: number, h: number, F: number, s: number, v: number): Bud {
  const mid = F * 0.52, amp = F * 0.2, len = Math.min(F * 5.5, w * 0.24);
  /** A point `v` along one of a side's two middle waves, as `PAINTERS.altar` lays them. */
  const wave = (v: number): [number, number] => {
    const dir = v < 0.5 ? -1 : 1, q = (v < 0.5 ? v : v - 0.5) * 2 * 0.85 + 0.05;
    return [w / 2 + dir * (F * 1.2 + len * q), mid + amp * Math.sin(q * Math.PI * 2.2 + 0.4)];
  };
  if (s < 0.4) { const [x, y] = wave(v); return { x, y, glass: true, way: 'top' }; }
  if (s < 0.52) return { x: w / 2 + (v - 0.5) * 3, y: F * 0.32, glass: false, way: 'top' };
  if (s < 0.64) return { x: v < 0.5 ? F * 0.42 : w - F * 0.42, y: F * 0.42, glass: false, way: 'top' };
  if (s < 0.84) {
    const left = v < 0.5;
    // A tall window has waves up its sides from each corner: some buds come off those instead.
    if (h > F * 14 && (v * 4) % 1 > 0.5) {
      const q = (v * 2) % 1, L = Math.min(F * 3.6, h * 0.14);
      const y = h - F * 3.2 - L * q;
      return { x: left ? mid : w - mid, y, glass: true, way: 'side' };
    }
    return { x: left ? F * 0.42 : w - F * 0.42, y: h - F * 0.42, glass: false, way: 'side' };
  }
  const [x, y] = wave(v);
  return { x, y: h - y, glass: true, way: 'foot' };
}

/**
 * Holy motes rising off the altar frame's sea glass and pearls: each buds from its point in a
 * ring of light opening round it, swells in, climbs a widening spiral (brighter on the near turn), twinkles with a
 * star's cross now and then, and fades as it slows near the top; some trail falling specks.
 * Off the top they rise into the open air; from the bottom corners they climb the side band;
 * on the foot they only glint up and go, so nothing rises into the window. `MOTES_LEAST` with
 * no favour and up to `MOTES_MORE` more as `favour` (0..1) fills, the last fading in by the
 * fraction; a fuller store makes them brighter and the rare great mote likelier.
 */
export function motes(g: Ctx, p: LifePiece, t: number, favour: number): void {
  const f = clamp01(favour), more = f * MOTES_MORE;
  const n = MOTES_LEAST + Math.ceil(more - 1e-6);
  const { w, h, F } = p;
  for (let i = 0; i < n; i++) {
    // The last of the extra motes is as strong as favour reaches past the one before.
    const share = i < MOTES_LEAST ? 1 : clamp01(more - (i - MOTES_LEAST));
    const C = 4.6 + rnd(i, p.seed % 997 + 2) * 1.8, tt = t + ((i * 0.618 + rnd(p.seed % 997, 1)) % 1) * C, k = Math.floor(tt / C);
    const key = i * 7.31 + (p.seed % 997) * 0.37;
    const b = bud(w, h, F, rnd(key, k), rnd(key, k + 0.5));
    const great = b.way !== 'foot' && rnd(key, k + 0.9) < 0.05 + 0.12 * f;
    const life = Math.min(C - 0.4, (b.way === 'foot' ? 1.5 + rnd(key, k + 0.2) * 0.8 : b.way === 'side' ? 4.4 + rnd(key, k + 0.2) * 1.6 : 2.8 + rnd(key, k + 0.2) * 1.5) * (great ? 1.2 : 1));
    const u = (tt - k * C) / life;
    if (u >= 1) continue;
    const rgb = b.glass ? (rnd(key, k + 0.3) < 0.65 ? AQUA : GOLD) : rnd(key, k + 0.3) < 0.62 ? GOLD : ROSE;
    // The path: up `H` on a spiral `A` wide that opens as it climbs, `turns` round, drifting `drift` aside.
    const H = b.way === 'foot' ? Math.max(3, b.y - (h - F) - 3) : b.way === 'side' ? Math.min(96, h * 0.32) * (0.7 + rnd(key, k + 0.4) * 0.3) : 30 + rnd(key, k + 0.4) * 22;
    const A = b.way === 'foot' ? 2 : b.way === 'side' ? 3.2 : 3.5 + rnd(key, k + 0.6) * 3;
    const turns = (0.7 + rnd(key, k + 0.7) * 0.9) * (rnd(key, k + 0.8) < 0.5 ? -1 : 1);
    const drift = b.way === 'top' ? (rnd(key, k + 0.1) - 0.5) * 14 : 0;
    const ph0 = rnd(key, k + 0.15) * Math.PI * 2;
    /** Where it is `v` of the way through its life, and how near (−1 far, 1 near) on its turn. */
    const at = (v: number): [number, number, number] => {
      const rise = ease(Math.pow(v, 0.6)), ph = ph0 + turns * Math.PI * 2 * v, a = A * Math.min(1, v * 2.2);
      return [b.x + Math.cos(ph) * a + drift * v * v, b.y - H * rise, Math.sin(ph)];
    };
    const [x, y, near] = at(u);
    const grow = u < 0.14 ? swell(u / 0.14) : 1, fade = 1 - ease(clamp01((u - 0.62) / 0.38));
    const bright = share * (0.84 + 0.16 * f) * fade * Math.min(1, u / 0.05);
    const twinkle = 0.82 + 0.18 * Math.sin(t * (6 + rnd(key, 3) * 4) + i * 1.7);
    const r = (great ? 4 : 2.5 + rnd(key, k + 0.35) * 0.8) * grow * (1 - 0.35 * (1 - fade)) * (1 + 0.14 * near);
    const a = bright * twinkle * (0.85 + 0.15 * near);
    // The bud: a ring that opens from its point while the mote swells in it.
    if (u < 0.2) {
      const q = u / 0.2, o = Math.min(1, q * 6) * (1 - q) * share;
      g.beginPath();
      g.arc(b.x, b.y, 2 + 7 * (1 - (1 - q) * (1 - q)), 0, Math.PI * 2);
      g.strokeStyle = `rgba(${rgb}, ${0.85 * o})`;
      g.lineWidth = 0.9 * (1 - q * 0.5);
      g.stroke();
    }
    // Falling specks behind a third of them and every great one, twinkling in turn.
    if (great || rnd(key, k + 0.45) < 0.35) {
      for (let j = 1; j <= 3; j++) {
        const v = u - j * 0.06;
        if (v <= 0.04) break;
        const [sx, sy0] = at(v), sy = sy0 + j * 1.6;
        const sa = a * (1 - j / 4.5) * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 8 + j * 2.1 + i), 2));
        if (sa < 0.05) continue;
        g.fillStyle = `rgba(${rgb}, ${sa})`;
        g.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2);
      }
    }
    if (a < 0.02 || r < 0.1) continue;
    // The mote: a halo of its colour, deep enough to ring it on marble, and a bright core.
    light(g, x, y, r * (great ? 5 : 4.2), rgb, a);
    g.beginPath();
    g.arc(x, y, r * 0.62, 0, Math.PI * 2);
    // A thin ring of its deeper colour round the core, so it keeps an edge on white marble.
    g.strokeStyle = `rgba(${DEEP[rgb]}, ${0.45 * a})`;
    g.lineWidth = 0.6;
    g.stroke();
    // Now and then a star's cross on it: a sharp peak twice or so a life, held a breath on a great one.
    const flare = great ? 0.55 + 0.45 * Math.sin(t * 2.4 + i) : Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (u * (1.5 + rnd(key, k + 0.55)) + rnd(key, k + 0.65)))), 10);
    if (flare > 0.05) {
      // A great one's cross stands upright, swaying a little, with a shorter one on the diagonals.
      const L = r * (great ? 3.4 : 2.8) * (0.6 + 0.4 * flare), turn = great ? Math.sin(t * 0.9 + i) * 0.25 : 0;
      g.save();
      g.translate(x, y);
      g.rotate(turn);
      g.strokeStyle = `rgba(${CORE[rgb]}, ${a * flare})`;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(-L, 0); g.lineTo(L, 0);
      g.moveTo(0, -L); g.lineTo(0, L);
      if (great) {
        const d = L * 0.42;
        g.moveTo(-d, -d); g.lineTo(d, d);
        g.moveTo(-d, d); g.lineTo(d, -d);
      }
      g.stroke();
      g.restore();
    }
  }
}

/** 0 to 1 with a little overshoot past 1 before it settles: a mote swelling into being. */
function swell(u: number): number {
  const c = 1.9, v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

/**
 * A mote's light in one gradient, `r` to its last glimmer: its near-white core, then its
 * colour full round that, then a faint wide bloom of it.
 */
function light(g: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const f = g.createRadialGradient(x, y, 0, x, y, r);
  f.addColorStop(0, `rgba(${CORE[rgb]}, ${a})`);
  f.addColorStop(0.12, `rgba(${CORE[rgb]}, ${a * 0.95})`);
  f.addColorStop(0.3, `rgba(${rgb}, ${a * 0.8})`);
  f.addColorStop(0.55, `rgba(${rgb}, ${a * 0.26})`);
  f.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = f;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}
