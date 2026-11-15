import {
  boards, css, deeper, extrude, faceColour, grain, hex, mix, nail, paler, slab, TAU, woodTone,
  type Ctx, type Face, type KitModel, type KitPart, type PaintCtx, type Pt, type RGB, type Side, type Tone,
} from './core';
import { rand } from '../ivy';

/**
 * The crates things are kept in (`PlacedCrate`, one subtile), in the kit, and
 * the crates a crate shelf carries (`shelving.ts`).
 *
 * A plank crate: boarded sides, a batten up each end and a brace across,
 * nailed, a merchant's mark stencilled on, and a boarded lid with a lip all
 * round, battened across. A log crate: courses of round logs, their ends
 * showing at its corners, and a lid of three logs laid across it. Each in the
 * wood it was built of (`PlacedCrate.material`), a step paler than the frame
 * of any rack it stands on.
 */

/** A crate's planks on a rack: planed pale, a step paler than any frame it stands on, so a crate on a rack of the same wood still stands out from it. */
const CRATE_BOARD = hex('#c9a46c');
export const CRATE: Tone = { lit: mix(CRATE_BOARD, hex('#fff2dc'), 0.32), shade: mix(CRATE_BOARD, hex('#6a5468'), 0.5) };

/** A batten from (x0, y0) to (x1, y1), `w` wide, standing proud of the boards: paler, a lit lip along its upper side, its shade on the boards under it. */
function batten(g: Ctx, fill: RGB, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  const strip = (o: number, k: number): void => {
    g.beginPath();
    g.moveTo(x0 + nx * (k + o), y0 + ny * (k + o));
    g.lineTo(x1 + nx * (k + o), y1 + ny * (k + o));
    g.lineTo(x1 - nx * (k - o), y1 - ny * (k - o));
    g.lineTo(x0 - nx * (k - o), y0 - ny * (k - o));
    g.closePath();
  };
  g.save();
  g.translate(0.12, -0.12);
  strip(0, 1);
  g.fillStyle = css(mix(fill, hex('#3e2c38'), 0.55), 0.8);
  g.fill();
  g.restore();
  strip(0, 1);
  g.fillStyle = css(mix(fill, [255, 248, 232], 0.18));
  g.fill();
  strip(0.82, 0.18);
  g.fillStyle = css(mix(fill, [255, 250, 240], 0.5), 0.75);
  g.fill();
}

/** A plank crate's side: three boards, a batten up each end and a brace across, nailed, and a merchant's mark stencilled on it. */
function crateSide(seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 3, seed);
    // The mark: a ring with a bar through it, in paint gone grey.
    g.strokeStyle = css(mix(k.fill, hex('#3e2c38'), 0.6), 0.6);
    g.lineWidth = 0.22;
    g.beginPath();
    g.arc(s.w * 0.3, s.h * 0.7, 0.55, 0, TAU);
    g.moveTo(s.w * 0.3 - 0.8, s.h * 0.7);
    g.lineTo(s.w * 0.3 + 0.8, s.h * 0.7);
    g.stroke();
    batten(g, k.fill, 0.75, 0.45, s.w - 0.75, s.h - 0.45, 0.6);
    batten(g, k.fill, 0.38, 0, 0.38, s.h, 0.76);
    batten(g, k.fill, s.w - 0.38, 0, s.w - 0.38, s.h, 0.76);
    for (const [x, y] of [[0.38, 0.4], [0.38, s.h - 0.4], [s.w - 0.38, 0.4], [s.w - 0.38, s.h - 0.4]]) nail(g, k.fill, x, y, 0.11);
  };
}

/** A boarded top, battened across near each end. */
function crateTop(seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    g.save();
    g.translate(-s.w / 2, -s.h / 2);
    boards(g, k.fill, s.w, s.h, 4, seed, 'x');
    for (const t of [0.75, s.w - 0.75]) batten(g, k.fill, t, 0, t, s.h, 0.8);
    g.restore();
  };
}

/** A plank crate as a rack carries it: one boarded box from (x0, y0, z0) to (x1, y1, z1). */
export function plankCrate(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: Tone = CRATE): Face[] {
  return slab(x0, x1, y0, y1, z0, z1, tone, {
    corner: 0.12, bevel: 0.12,
    paint: { front: crateSide(71), back: crateSide(72), left: crateSide(73), right: crateSide(74), top: crateTop(75) },
  });
}

/* ---- set down on its own ------------------------------------------------------------- */

/** Half its width, and how tall: a plank crate's box under its lid, and the lid's lip and thickness. */
const X = 4.3, BODY = 4.7, LIP = 0.18, LID = 0.55;
/** A log crate: its courses of logs, how round they are, the lid's logs, and the cut of its corners where the log ends show. */
const COURSES = 3, LOG_H = 4.8, LID_R = 0.82, CUT = 0.85;

/** Bark: the wood a step deeper and browner, as the logs of a log crate are. */
function barkOf(wood: Tone): Tone {
  const d = deeper(wood, 0.16);
  return { lit: mix(d.lit, hex('#9a7458'), 0.22), shade: mix(d.shade, hex('#5a4050'), 0.15) };
}

/** A side of courses of round logs: each lit along its top, in shade along its foot, the dark of the seam between, a knot or two. */
function courses(seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const T = rand(seed);
    const h = s.h / COURSES;
    for (let i = 0; i < COURSES; i++) {
      const y0 = i * h;
      grain(g, k.fill, s.w, h, seed + i * 7, 'x', 0.9);
      // Its round: the top third in the light, the foot third turned under.
      g.fillStyle = css(mix(k.fill, [255, 248, 232], 0.32), 0.7);
      g.fillRect(-0.3, y0 + h * 0.66, s.w + 0.6, h * 0.22);
      g.fillStyle = css(mix(k.fill, hex('#4a3448'), 0.4), 0.55);
      g.fillRect(-0.3, y0, s.w + 0.6, h * 0.24);
      if (i) {
        g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.62), 0.9);
        g.fillRect(-0.3, y0 - 0.1, s.w + 0.6, 0.2);
      }
      // A knot.
      const x = s.w * (0.2 + 0.6 * T());
      g.beginPath();
      g.ellipse(x, y0 + h * 0.5, 0.32, 0.18, 0, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#4a3448'), 0.45), 0.7);
      g.fill();
    }
  };
}

/** A sawn log's end, a ring of bark round pale wood, its growth rings and heart, at (x, y), `r` round, in a face's frame. */
function logEnd(g: Ctx, k: PaintCtx, end: Tone, x: number, y: number, r: number): void {
  const fill = faceColour(end, k.L);
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.2));
  g.fill();
  g.beginPath(); g.arc(x, y, r * 0.78, 0, TAU);
  g.fillStyle = css(fill);
  g.fill();
  g.strokeStyle = css(mix(fill, hex('#8a6a58'), 0.45), 0.6);
  g.lineWidth = 0.07;
  g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.stroke();
  g.beginPath(); g.arc(x, y, 0.09, 0, TAU);
  g.fillStyle = css(mix(fill, hex('#6e5060'), 0.5));
  g.fill();
}

/** A corner of the log crate cut back: the ends of its courses, one over the next. */
function corner(end: Tone) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.45));
    g.fillRect(-0.2, 0, s.w + 0.4, s.h);
    const h = s.h / COURSES;
    for (let i = 0; i < COURSES; i++) logEnd(g, k, end, s.w / 2, (i + 0.5) * h, Math.min(s.w * 0.62, h * 0.52));
  };
}

/** A log of the lid lying along x at (y, z) through its middle: bark round it, a sawn end each side. */
function lidLog(y: number, zc: number, tone: Tone, end: Tone, seed: number): Face[] {
  const r = LID_R;
  const ring: Pt[] = Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) / 8) * TAU;
    return [y + Math.cos(a) * r, zc + Math.sin(a) * r] as Pt;
  });
  const endFace = (g: Ctx, k: PaintCtx): void => logEnd(g, k, end, y, zc, r);
  return extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], ring, -X + 0.1, X - 0.1, tone, 0.1, {
    front: endFace, back: endFace,
    // Bark along it: its frame round the log one way, along it the other.
    edge: (i) => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, 2 * r * Math.sin(Math.PI / 8), 2 * X, seed + i, 'y', 0.8), crease: 0.25 }),
  });
}

/** A crate set down: a plank crate or a log crate, in the wood it was built of. */
function storeCrateOf(kind: 'log' | 'plank', material?: string): KitModel {
  const parts: KitPart[] = [];
  const WOOD = paler(woodTone(material, undefined, 0.75), 0.08);
  if (kind === 'plank') {
    // The box, and the lid on it, a lip proud all round.
    parts.push({ faces: plankCrate(-X, X, -X, X, 0, BODY, WOOD), edges: true });
    parts.push({
      faces: slab(-X - LIP, X + LIP, -X - LIP, X + LIP, BODY, BODY + LID, paler(WOOD, 0.06), {
        corner: 0.14, bevel: 0.14,
        paint: { top: crateTop(76), front: (g, k, s) => grain(g, k.fill, s.w, s.h, 77, 'x', 0.6), back: (g, k, s) => grain(g, k.fill, s.w, s.h, 78, 'x', 0.6), left: (g, k, s) => grain(g, k.fill, s.w, s.h, 79, 'x', 0.6), right: (g, k, s) => grain(g, k.fill, s.w, s.h, 80, 'x', 0.6) },
      }),
      edges: true,
    });
  } else {
    const BARK = barkOf(WOOD);
    const END = paler(WOOD, 0.12);
    // The walls: courses of logs up each side, their ends showing at the cut corners.
    parts.push({
      faces: slab(-X, X, -X, X, 0, LOG_H, BARK, {
        corner: CUT,
        paint: { front: courses(31), back: courses(32), left: courses(33), right: courses(34), corner: corner(END), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 35, 'y'); g.restore(); } },
      }),
    });
    // The lid: three logs laid across it, side by side.
    const zc = LOG_H + LID_R * Math.cos(Math.PI / 8);
    for (const [i, y] of [-2 * LID_R + 0.05, 0, 2 * LID_R - 0.05].entries()) {
      parts.push({ faces: lidLog(y * 1.3, zc, BARK, END, 41 + i * 5), edges: true });
    }
  }
  return { parts, shade: [[-X, -X, 0], [X, -X, 0], [X, X, 0], [-X, X, 0]] };
}

const models = new Map<string, KitModel>();
/** A crate's model, by its kind and its wood, built once. */
export function storeCrateModel(kind: 'log' | 'plank', material?: string): KitModel {
  const key = `${kind}|${(material ?? '').toLowerCase()}`;
  let m = models.get(key);
  if (!m) models.set(key, (m = storeCrateOf(kind, material)));
  return m;
}
