import type { Block, Ctx, Lobe, Pt, Rand } from './types';

/**
 * The section every picture is painted on, and the strokes everything in it is drawn with: a
 * seeded random, a wobbly closed curve, an outline of lobes, two tones and a line, a canvas.
 */

/** A hex colour with its lightness moved by `dl` points, its hue and saturation kept. */
export function lighten(hex: string, dl: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  }
  const L = Math.max(0, Math.min(1, l + dl / 100));
  const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
  const f = (t: number): number => {
    const u = ((t % 1) + 1) % 1;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export const TW = 512;

export const TH = 384;

export const EDGE = 16;                                     // nothing private nearer the seam than this

export const BAND = 48;                                     // the flat course at the top of every storey

export const COURSES = 4, CH = (TH - BAND) / COURSES;       // and four courses of blocks under it

/** The courses whose stone straddles the seam, and how far it reaches either side of it: three of
 *  them, reaching unequally, so the joints near the seam stagger the way a running bond does. */
export const STRADDLE: Record<number, [number, number]> = { 0: [-40, 58], 1: [-52, 68], 3: [-70, 46] };

/** And the tone each straddling stone takes, the same in every variant, so colour reaches the seams too. */
export const STRADDLE_TONE: Record<number, string> = { 0: '', 1: 'brown', 3: 'green' };

export const CAP_H = 64;                                    // the top face's texture, front edge at the bottom

export function rand(seed: number): Rand {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A closed curve through the midpoints of a polygon: nothing is straight, nothing repeats. */
export function shape(g: Ctx, pts: Pt[]): void {
  g.beginPath();
  trace(g, pts);
}

/** The same curve added to whatever path is open, for a hole cut in a shape. */
function trace(g: Ctx, pts: Pt[]): void {
  const n = pts.length, m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  g.closePath();
}

/** Points round a squarish oval (p near 1 is round, near 0.4 is a block with soft corners), jittered
 *  in angle and, inwards only, in radius: nothing drawn through them ever leaves the box, so a stone
 *  never reaches across its joint into the seam or the storey above. */
export function blob(cx: number, cy: number, rx: number, ry: number, n: number, R: Rand, p: number, aj: number, rj: number): Pt[] {
  const pts: Pt[] = [], step = Math.PI * 2 / n;
  for (let i = 0; i < n; i++) {
    const a = i * step + (R() - 0.5) * step * aj * 2, rr = 1 - R() * rj * 2;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([cx + Math.sign(c) * Math.pow(Math.abs(c), p) * rx * rr, cy + Math.sign(s) * Math.pow(Math.abs(s), p) * ry * rr]);
  }
  return pts;
}

/** Two flat tones and a line: shade underneath, lit sitting up-left of it, line on top. */
export function solid(g: Ctx, pts: Pt[], lit: string, shade: string, line: string, lw: number, dx: number, dy: number): void {
  shape(g, pts); g.fillStyle = shade; g.fill();
  g.save(); shape(g, pts); g.clip(); g.translate(dx, dy); shape(g, pts); g.fillStyle = lit; g.fill(); g.restore();
  shape(g, pts); g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
}

/** The outline of a union of circles, shifted and grown. */
export function unionPath(g: Ctx, cs: Lobe[], ox: number, oy: number, grow: number): void {
  g.beginPath();
  for (const [x, y, r] of cs) { const rr = Math.max(1, r + grow); g.moveTo(x + ox + rr, y + oy); g.arc(x + ox, y + oy, rr, 0, 7); }
}

/** A hex colour with an alpha, for the soft edge under a line. */
export const hexA = (hex: string, a: number): string => 'rgba(' + channels(hex).join(',') + ',' + a + ')';

/** A hex colour as three numbers, for anything outside that wants to light it itself. */
export const channels = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** `a` taken `t` of the way to `b`, as a hex colour. */
export const mixHex = (a: string, b: string, t: number): string => {
  const [p, q] = [channels(a), channels(b)];
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

/** What a mass casts on the stones behind it: one flat darkening, down and right. */
export function shadowOf(g: Ctx, cs: Lobe[], ox: number, oy: number): void {
  unionPath(g, cs, ox, oy, 2); g.fillStyle = 'rgba(110,100,80,0.22)'; g.fill();
}

/** A polygon added to the path that is open, shifted by (dx, dy): a torn edge has corners, not curves. */
export function poly(g: Ctx, pts: Pt[], dx = 0, dy = 0): void {
  g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy);
  g.closePath();
}

/** A colour as a hex string, from its three channels. */
export const hexOf = ([r, g, b]: readonly number[]): string =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');

/** A polygon with more corners than it needs, each shoved about: a stone cut by eye. */
export function roughen(poly: Pt[], R: Rand, per: number, jitter: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let k = 0; k < per; k++) {
      const u = k / per;
      out.push([a[0] + (b[0] - a[0]) * u + (R() - 0.5) * jitter * 2,
                a[1] + (b[1] - a[1]) * u + (R() - 0.5) * jitter * 2]);
    }
  }
  return out;
}

export const bbox = (pts: Pt[]): Block => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, course: 0, pts };
};

/** A rectangle with its corners rounded off, added to the path that is open. */
export function softRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

export const rectPts = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export const cnv = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export const ctxOf = (c: HTMLCanvasElement): Ctx => c.getContext('2d') as Ctx;
