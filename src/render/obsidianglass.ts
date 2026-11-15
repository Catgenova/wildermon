/**
 * A solid wall of obsidian glass (`building.ts` OBSIDIAN_GLASS), drawn: one slab of near-black glass the whole
 * thickness and height of a wall, set in mortar in three courses, `opacity` opaque, so whatever is behind it shows
 * through at the rest.
 *
 * Drawn in the wall's own coordinates (`GlassWallGeom`, as `glasswall.ts`): `t` along the border, `k` up the storey, `s`
 * the face toward the camera (1) or the one behind (-1). Only what faces the camera is filled -- the near face, the top
 * and an end in sight, none of them over another -- each once at `opacity`, so the slab hides what is behind it by
 * exactly that much wherever it is looked through. The far face is only its edges, seen through the glass. Over the
 * near face: the sky in the head of it, a reflection streak, the course joints, a lit arris along the top and the
 * joints, an ember glint at the foot of each end; after dark a lamp behind warms it (`glow`).
 */
import type { GlassWallGeom } from './glasswall';

type Ctx = CanvasRenderingContext2D;
type RGB = readonly [number, number, number];
type P3 = [number, number, number];

export interface ObsidianWallLook {
  /** Where the near face stops at each end, the far face, and the top. */
  near: [number, number];
  far: [number, number];
  top: [number, number];
  /** Whether each end is in sight: the run stops there and turns toward the camera. */
  ends: [boolean, boolean];
  /** Whether obsidian glass carries on in line past each end: a joint there. */
  joints: [boolean, boolean];
  /** Whether its top is open to be seen: nothing is drawn standing on it. */
  capped: boolean;
  /** How much light each face takes: the face, its top, an end. */
  lit: number;
  topLit: number;
  endLit: number;
  zoom: number;
  /** A light in the room behind, after dark: 0 to 1. */
  glow: number;
  /** Where the section is, so the streak is not in the same place on every one. */
  seed: number;
  /** How much of what is behind it the slab hides (`MaterialDef.opacity`). */
  opacity: number;
}

/** The glass, the deeper violet-black of it edge-on, the sky it throws back, an ember glint, and a lamp's warmth. */
const GLASS: RGB = [24, 21, 30];
const EDGE: RGB = [44, 38, 54];
const SKY: RGB = [206, 200, 236];
const EMBER: RGB = [222, 96, 58];
const MORTAR: RGB = [58, 30, 32];
const WARM: RGB = [255, 170, 96];
/** The course joints, as shares of the storey. */
const COURSES = [1 / 3, 2 / 3];

const css = (c: RGB, k = 1, a = 1): string =>
  `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

export function drawObsidianWall(ctx: Ctx, g: GlassWallGeom, o: ObsidianWallLook): void {
  const { px, py } = g;
  const [T0, T1] = o.near, [B0, B1] = o.far, [C0, C1] = o.top;
  const A = o.opacity;
  const hair = Math.max(0.6, 0.6 * o.zoom);
  const line = Math.max(1, 0.9 * o.zoom);
  const poly = (pts: P3[]): void => {
    ctx.beginPath();
    pts.forEach(([t, k, s], i) => (i ? ctx.lineTo(px(t, k, s), py(t, k, s)) : ctx.moveTo(px(t, k, s), py(t, k, s))));
    ctx.closePath();
  };
  const quad = (t0: number, t1: number, k0: number, k1: number, s = 1): void => poly([[t0, k0, s], [t1, k0, s], [t1, k1, s], [t0, k1, s]]);
  const seg = (a: P3, b: P3, style: string, w: number): void => {
    ctx.beginPath();
    ctx.moveTo(px(...a), py(...a));
    ctx.lineTo(px(...b), py(...b));
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  /** A gradient from `a` toward `b` whose lines of equal colour run along `a` to `c` (as `glasswall.ts`). */
  const across = (a: P3, b: P3, c: P3): CanvasGradient => {
    const ax = px(...a), ay = py(...a), vx = px(...b) - ax, vy = py(...b) - ay;
    const ex = px(...c) - ax, ey = py(...c) - ay, ee = ex * ex + ey * ey || 1, d = (vx * ex + vy * ey) / ee;
    return ctx.createLinearGradient(ax, ay, ax + vx - ex * d, ay + vy - ey * d);
  };
  const endAt = (i: 0 | 1): number => (i ? T1 : T0);

  /* ---- the far face, seen through: its foot and its head, faint ---- */
  seg([B0, 0, -1], [B1, 0, -1], css(SKY, 0.8, 0.16 * A), hair);
  seg([B0, 1, -1], [B1, 1, -1], css(SKY, 0.8, 0.12 * A), hair);

  /* ---- an end in sight, edge-on: deeper, lit along its arris ---- */
  for (const i of [0, 1] as const) {
    if (!o.ends[i]) continue;
    const t = endAt(i);
    poly([[t, 0, 1], [t, 0, -1], [t, 1, -1], [t, 1, 1]]);
    const e = across([t, 0, 1], [t, 0, -1], [t, 1, 1]);
    e.addColorStop(0, css(EDGE, o.endLit * 1.1, A));
    e.addColorStop(0.5, css(GLASS, o.endLit, A));
    e.addColorStop(1, css(EDGE, o.endLit * 1.05, A));
    ctx.fillStyle = e;
    ctx.fill();
    seg([t, 0, 1], [t, 1, 1], css(SKY, 1, 0.7), line);
    seg([t, 0, -1], [t, 1, -1], css(SKY, 1, 0.25), hair);
    for (const k of COURSES) seg([t, k, 1], [t, k, -1], css(MORTAR, 1, 0.8 * A), hair);
    // The ember glint at its foot.
    seg([t, 0, 1], [t, 0.12, 1], css(EMBER, 1, 0.75), line);
  }

  /* ---- the near face ---- */
  quad(T0, T1, 0, 1);
  ctx.fillStyle = css(GLASS, Math.min(1.15, o.lit), A);
  ctx.fill();
  if (o.glow > 0) {
    ctx.fillStyle = css(WARM, 1, 0.22 * o.glow);
    ctx.fill();
  }
  ctx.save();
  quad(T0, T1, 0, 1);
  ctx.clip();
  // The sky in the head of it, gone by the middle; the glass's own black down to the foot.
  const sheen = across([0, 1, 1], [0, 0, 1], [1, 1, 1]);
  sheen.addColorStop(0, css(SKY, 1, 0.22 * o.lit));
  sheen.addColorStop(0.4, css(SKY, 1, 0.05 * o.lit));
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sheen;
  ctx.fill();
  // A streak of reflection across it, and a thin one beside it: where along goes by the section.
  const r = ((o.seed * 2654435761) >>> 0) / 4294967296;
  const at = 0.12 + 0.55 * r, lean = 0.35;
  const band = (t: number, w: number, a: number): void => {
    poly([[t, 1, 1], [t + w, 1, 1], [t + w - lean, 0, 1], [t - lean, 0, 1]]);
    ctx.fillStyle = css(SKY, 1, a * (0.5 + 0.5 * Math.min(1, o.lit)));
    ctx.fill();
  };
  band(at, 0.1, 0.16);
  band(at + 0.16, 0.03, 0.14);
  // The course joints, and a joint between blocks along each, staggered course to course.
  for (const k of COURSES) {
    seg([T0, k, 1], [T1, k, 1], css(MORTAR, 1, 0.9), line);
    seg([T0, k + 0.008, 1], [T1, k + 0.008, 1], css(SKY, 1, 0.22), hair);
  }
  const blocks = [[0.5], [0.25, 0.75], [0.5]];
  [0, ...COURSES].forEach((k0, c) => {
    const k1 = c < COURSES.length ? COURSES[c] : 1;
    for (const t of blocks[c]) if (t > T0 && t < T1) {
      seg([t, k0, 1], [t, k1, 1], css(MORTAR, 1, 0.85), line);
      seg([t + 0.01, k0, 1], [t + 0.01, k1, 1], css(SKY, 1, 0.2), hair);
    }
  });
  ctx.restore();
  // The edges catch the light: along the foot, the head, and where the next section carries on.
  seg([T0, 0.004, 1], [T1, 0.004, 1], css(SKY, 1, 0.35), hair);
  seg([T0, 1, 1], [T1, 1, 1], css(SKY, Math.min(1.1, o.topLit), 0.75), line);
  for (const i of [0, 1] as const) {
    if (!o.joints[i]) continue;
    const t = endAt(i);
    seg([t, 0, 1], [t, 1, 1], css(MORTAR, 1, 0.9), line);
    seg([t + (i ? -0.01 : 0.01), 0, 1], [t + (i ? -0.01 : 0.01), 1, 1], css(SKY, 1, 0.3), hair);
  }

  /* ---- the top ---- */
  if (o.capped) {
    poly([[C0, 1, 1], [C1, 1, 1], [C1, 1, -1], [C0, 1, -1]]);
    const top = across([0, 1, 1], [0, 1, -1], [1, 1, 1]);
    top.addColorStop(0, css(EDGE, o.topLit * 1.25, A));
    top.addColorStop(1, css(GLASS, o.topLit, A));
    ctx.fillStyle = top;
    ctx.fill();
    seg([C0, 1, -1], [C1, 1, -1], css(SKY, 1, 0.3), hair);
    seg([C0, 1, 0.05], [C1, 1, 0.05], css(EMBER, 1, 0.3), hair);
  }
  ctx.lineWidth = 1;
}
