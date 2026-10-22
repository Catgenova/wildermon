import { HEIGHT_SCALE } from './iso';
import { hashOf, rand } from './ivy';
import { woodHex } from './furniture';
import {
  add, bakeRune, boulder, breath, canvasOf, CREASE_INK, css, cut, dot, drawFaces, drawPads, eyeOf, flowerClump, glowMasks, glyphPath, grassTuft,
  hex, lichen, mix, mul, newell, noise2, proj, RUNE_GOLD, RUNE_WHITE, scaleFor, STONE_INK, sub, TAU, toneOf, unit,
  type Ctx, type Eye, type Face, type Glow, type NightHole, type NightMask, type NightSource, type Pad, type PaintCtx, type Pt, type RGB, type Tone, type V3,
} from './runestone';

/**
 * A work post (`game/posts.ts`), drawn as the smith's pieces are
 * (`forge.ts`), from the runestones' kit (`runestone.ts`): a small model of
 * faceted solids in tenths of a metre, put on the screen through the camera's
 * turn, baked for each way it is seen, each scale, each wood, each step of
 * its wear and worked or not, and what moves laid over the bake.
 *
 * What it is made of is what it is built from (`make_work_post`): a squared
 * post with its arrises chamfered, driven through a low mossy mound with
 * packing stones round its foot; a crossbar of plank through it, nailed, a
 * nail either side of the post front and back, and under each arm a brace of
 * shaft; a carved head over that with a rune cut in its front and its back,
 * a pyramid cap, and out of the cap an iron rod with the metal ribbon on it.
 * The wood is the wood it was built of (`woodHex`, as furniture is).
 *
 * Unworked, the ribbon is wound round its rod and its rune is a dark groove.
 * Worked, the ribbon flies off the rod down the wind and moves in it, and
 * the rune is lit gold, breathing as a runestone's does; after dark its
 * light goes over the night in its own place (`drawWorkPostNight`), and out
 * of any light it takes the night off itself in its own shape
 * (`workPostNight`), as an anvil's rune does.
 *
 * It wears as its life runs out (`postLeft` against `postLife`): it leans
 * further, its wood goes grey and checks, moss climbs it from the mound and
 * lichen comes on its head; near the end one arm of its crossbar has dropped,
 * a gap has opened in the mound behind its foot and it stands well over.
 */

/* ---- the kit's pieces ---------------------------------------------------------- */

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const centre = (pts: readonly V3[]): V3 => mul(pts.reduce<V3>((m, p) => add(m, p), [0, 0, 0]), 1 / pts.length);
/** A ring of corners round (0, 0) at height z, `hx` across and `hy` deep either side, its corners cut `c` back. */
const ring = (hx: number, hy: number, z: number, c = 0): V3[] => c > 0
  ? [[-hx + c, -hy, z], [hx - c, -hy, z], [hx, -hy + c, z], [hx, hy - c, z], [hx - c, hy, z], [-hx + c, hy, z], [-hx, hy - c, z], [-hx, -hy + c, z]]
  : [[-hx, -hy, z], [hx, -hy, z], [hx, hy, z], [-hx, hy, z]];

/** One side of a solid as it is painted: its corner at the left of its foot as seen from outside, across it, up it (a unit of height a unit), how wide and tall, and which way it faces. */
interface Side { o: V3; a: V3; b: V3; w: number; h: number; n: V3; poly: V3[] }

/**
 * A solid of rings, one over the next from its foot to its top, each side
 * between two rings a face and the last ring its top, as the smith's pieces
 * are built (`prism` in `forge.ts`). `dress` says what is painted on each
 * side (band `k`, side `i` from the ring's first corner).
 */
function prism(rings: V3[][], tone: Tone, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined, top?: Partial<Face>): Face[] {
  const faces: Face[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const lo = rings[k], hi = rings[k + 1];
    const mid = mul(add(centre(lo), centre(hi)), 0.5);
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      const pts = [lo[i], lo[j], hi[j], hi[i]];
      let n = newell(pts);
      if (dot(n, sub(centre(pts), mid)) < 0) n = mul(n, -1);
      const nh = Math.hypot(n[0], n[1]);
      const a: V3 = nh > 1e-6 ? [n[1] / nh, -n[0] / nh, 0] : [1, 0, 0];
      const [l, r] = dot(lo[i], a) <= dot(lo[j], a) ? [lo[i], lo[j]] : [lo[j], lo[i]];
      let b = unit(cross(a, n));
      if (b[2] < 0) b = mul(b, -1);
      if (b[2] > 0.05) b = mul(b, 1 / b[2]);
      const zs = pts.map((p) => p[2]);
      const s: Side = { o: l, a, b, w: Math.hypot(r[0] - l[0], r[1] - l[1], r[2] - l[2]), h: Math.max(...zs) - Math.min(...zs), n, poly: pts };
      faces.push({ pts, n, tone, crease: 0.4, frame: { o: l, a, b }, ...(dress?.(k, i, s) ?? {}) });
    }
  }
  const last = rings[rings.length - 1];
  let n = newell(last);
  if (dot(n, sub(centre(last), centre(rings[rings.length - 2]))) < 0) n = mul(n, -1);
  const a = unit(sub(last[1], last[0]));
  faces.push({ pts: last.slice(), n, tone, crease: 0.45, frame: { o: centre(last), a, b: cross(n, a) }, ...(top ?? {}) });
  return faces;
}

/**
 * A beam from `p0` to `p1`, `hw` either side of its middle across and `hh`
 * up and down, its `up` as near `up0` as it can be: its four sides painted
 * along it (`along`, in units from `p0`, across from one arris), and its far
 * end's grain (`end`). Its near end is in whatever it is fixed to.
 */
function beam(p0: V3, p1: V3, up0: V3, hw: number, hh: number, tone: Tone, along?: (g: Ctx, k: PaintCtx, len: number, wid: number, i: number) => void, end?: (g: Ctx, k: PaintCtx) => void): Face[] {
  const d = unit(sub(p1, p0)), len = Math.hypot(...sub(p1, p0));
  const side = unit(cross(d, up0)), up = cross(side, d);
  const c = (p: V3, s: number, u: number): V3 => add(add(p, mul(side, s * hw)), mul(up, u * hh));
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const mid = mul(add(p0, p1), 0.5);
  const faces: Face[] = [];
  for (let i = 0; i < 4; i++) {
    const [s0, u0] = corners[i], [s1, u1] = corners[(i + 1) % 4];
    const pts = [c(p0, s0, u0), c(p0, s1, u1), c(p1, s1, u1), c(p1, s0, u0)];
    let n = newell(pts);
    if (dot(n, sub(centre(pts), mid)) < 0) n = mul(n, -1);
    const across = unit(sub(pts[1], pts[0])), wid = Math.hypot(...sub(pts[1], pts[0]));
    faces.push({ pts, n, tone, crease: 0.42, frame: { o: pts[0], a: d, b: across }, paint: along ? (g, k) => along(g, k, len, wid, i) : undefined });
  }
  const cap = corners.map(([s, u]) => c(p1, s, u));
  faces.push({ pts: cap, n: d, tone, crease: 0.5, frame: { o: p1, a: side, b: up }, paint: end });
  return faces;
}

/** The frame a side is painted in on the screen, at zoom one: its corner, across, up. */
const sideM = (e: Eye, s: { o: V3; a: V3; b: V3 }): DOMMatrix => {
  const [ox, oy] = proj(e, s.o), [ax, ay] = proj(e, s.a), [bx, by] = proj(e, s.b);
  return new DOMMatrix([ax, ay, bx, by, ox, oy]);
};

/** A solid in the model, or what grows round it: its faces or its drawing, where it stands, and its place among the solids. */
interface Part {
  faces?: Face[];
  draw?: (g: Ctx, e: Eye) => void;
  x: number;
  y: number;
  first?: boolean;
  solid?: boolean;
  tier?: number;
  order?: (e: Eye) => number;
  reach?: V3[];
  /** Its near arrises catch the light (`litEdges`). */
  lit?: boolean;
}

/** The parts in the order they are laid: the ground, flora behind, the solids by their order, flora in front. */
function laid(parts: readonly Part[], e: Eye): Part[] {
  const ground = parts.filter((p) => p.first);
  const solids = parts.filter((p) => !p.first && p.tier !== undefined).sort((a, b) => (a.order?.(e) ?? a.tier ?? 0) - (b.order?.(e) ?? b.tier ?? 0));
  const near0 = (p: Part): number => p.x * e.toward[0] + p.y * e.toward[1];
  const loose = parts.filter((p) => !p.first && p.tier === undefined);
  return [...ground, ...loose.filter((p) => near0(p) < 0), ...solids, ...loose.filter((p) => near0(p) >= 0)];
}

/** The box a set of model points covers on the screen, in pixels at zoom one: left, top, right, bottom. */
function boxOf(e: Eye, pts: Iterable<V3>, pad = 0): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const [x, y] = proj(e, [p[0], p[1], Math.max(p[2], -0.2)]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
function* pointsOf(parts: readonly Part[], solidOnly = false): Generator<V3> {
  for (const p of parts) {
    if (solidOnly && !p.solid) continue;
    for (const f of p.faces ?? []) yield* f.pts;
    if (!solidOnly) yield* p.reach ?? [];
  }
}

const polyPath = (g: Ctx, e: Eye, pts: readonly V3[]): void => {
  g.beginPath();
  pts.forEach((p, i) => { const [x, y] = proj(e, p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
};
const seenFaces = (e: Eye, p: Part): Face[] => (p.faces ?? []).filter((f) => dot(f.n, e.toward) > 1e-6);

/** The ink round the solids, in pixels at zoom one, and its colour: a warm grey-brown a step browner than the stones', for wood. */
const INK = 0.75;
const INK_COLOUR = mix(mix(STONE_INK, CREASE_INK, 0.3), hex('#6a4c3e'), 0.3);

/** The light caught along the near arrises of a top: a hair of pale wood, broken (`litEdges` in `runelantern.ts`). */
function litEdges(g: Ctx, e: Eye, faces: readonly Face[], seed: number): void {
  const T = rand(seed);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(252, 244, 226, 0.6)';
  for (const f of faces) {
    if (f.n[2] < 0.55 || dot(f.n, e.toward) <= 1e-6 || f.pts.length < 3) continue;
    const m0 = dot(centre(f.pts), e.toward);
    const scr = f.pts.map((q) => proj(e, q));
    g.save();
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    for (let i = 0; i < f.pts.length; i++) {
      const j = (i + 1) % f.pts.length;
      if (dot(mul(add(f.pts[i], f.pts[j]), 0.5), e.toward) <= m0 + 0.02) continue;
      const [ax, ay] = scr[i], [bx, by] = scr[j];
      for (let u = T() * 0.1; u < 1;) {
        const v = Math.min(1, u + 0.25 + 0.4 * T());
        g.lineWidth = 0.6 + 0.4 * T();
        g.beginPath();
        g.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
        g.lineTo(ax + (bx - ax) * v, ay + (by - ay) * v);
        g.stroke();
        u = v + 0.06 + 0.12 * T();
      }
    }
    g.restore();
  }
  g.restore();
}

/** Take off a picture whatever of the parts laid after `from` covers it. */
function lessInFront(g: Ctx, e: Eye, order: readonly Part[], from: Part): void {
  let past = false;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const p of order) {
    if (p === from) { past = true; continue; }
    if (!past || p.first) continue;
    if (p.draw) p.draw(g, e);
    else for (const f of seenFaces(e, p)) { polyPath(g, e, f.pts); g.fill(); }
  }
  g.restore();
}

/* ---- the wood -------------------------------------------------------------------- */

/** Wood in the light as the island's pastels have it: the board's own colour (`woodHex`) a step paler. */
const PALE: RGB = [255, 246, 230];
/** And in shade: the board's colour taken down and toward the runestones' lilac, so its two faces read as two. */
const SHADE_DOWN: RGB = [60, 44, 52];
const LILAC: RGB = hex('#8a7d92');
/** What old wood weathers to out of doors: a silver grey, in the light and in shade. */
const GREY_LIT: RGB = hex('#d2cdc3');
const GREY_SHADE: RGB = hex('#8b8892');
/** How far toward that grey it has gone at the end of its life. */
const GREYING = 0.62;

/** The tones a post of a wood is drawn in, `w` of the way through its life: the post, its plank, its shafts and its cap. */
function woodTones(wood: string, w: number): { post: Tone; plank: Tone; brace: Tone; cap: Tone } {
  const W = hex(wood);
  const grey = GREYING * Math.pow(w, 1.25);
  const of = (lit: RGB, shade: RGB): Tone => ({ lit: mix(lit, GREY_LIT, grey), shade: mix(shade, GREY_SHADE, grey * 0.8) });
  const lit = mix(W, PALE, 0.16), shade = mix(mix(W, SHADE_DOWN, 0.42), LILAC, 0.3);
  return {
    post: of(lit, shade),
    // The sawn plank a step paler than the post, the shafts a step darker, the cap darker again so the head stands out under it.
    plank: of(mix(lit, PALE, 0.12), mix(shade, PALE, 0.06)),
    brace: of(mix(lit, shade, 0.1), shade),
    cap: of(mix(lit, SHADE_DOWN, 0.16), mix(shade, SHADE_DOWN, 0.18)),
  };
}

/** The packing stones and the mound: the rune lantern's outcrop stone. */
const ROCK: Tone = toneOf('#dccbb5', '#9e8f8d');
/** The iron of its rod. */
const IRON: Tone = toneOf('#a6b2c6', '#535d78');

/**
 * The wood's skin on a face `w` across and `h` along its grain, in the face's
 * frame (grain along its second axis when `along` is false, its first when
 * true): flat fields a step paler and a step darker, the grain in fine lines,
 * a knot now and then, the damp up out of the ground from `damp` up a post's
 * foot, and as
 * it wears (`wear`, nought to one) the checks old timber splits in along its
 * grain.
 */
function grain(g: Ctx, fill: RGB, w: number, h: number, seed: number, wear: number, along = false, damp?: number): void {
  const T = rand(seed);
  g.save();
  // Laid as if the grain ran up: a beam's runs along it.
  if (along) g.transform(0, 1, 1, 0, 0, 0);
  const W = along ? h : w, H = along ? w : h;
  for (let i = 0; i < Math.round(W * H * 0.12) + 2; i++) {
    g.beginPath();
    g.ellipse(T() * W, T() * H, 0.3 + T() * 0.6, 0.9 + T() * 2.2, (T() - 0.5) * 0.1, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(fill, PALE, 0.4), 0.32) : css(mix(fill, hex('#7c6460'), 0.28), 0.24);
    g.fill();
  }
  // The grain: fine lines up it, each wandering a little, a step darker.
  g.lineCap = 'round';
  g.strokeStyle = css(mix(fill, hex('#5e4640'), 0.45), 0.34);
  g.lineWidth = 0.09;
  g.beginPath();
  for (let x = 0.25 + T() * 0.3; x < W - 0.15; x += 0.42 + T() * 0.36) {
    let px = x;
    g.moveTo(px, -0.2);
    for (let z = 0; z < H + 0.4; z += 0.8) {
      px += (noise2(x * 3, z / 2.5, seed) - 0.5) * 0.18;
      g.lineTo(px, z);
    }
  }
  g.stroke();
  // A knot, and the grain bending round it.
  if (H > 3 && T() < 0.8) {
    const kx = 0.4 + T() * Math.max(0.1, W - 0.8), kz = 0.8 + T() * (H - 1.6);
    g.beginPath();
    g.ellipse(kx, kz, 0.22, 0.34, 0, 0, TAU);
    g.fillStyle = css(mix(fill, hex('#4e3a36'), 0.5), 0.6);
    g.fill();
    g.beginPath();
    g.ellipse(kx, kz, 0.42, 0.7, 0, 0, TAU);
    g.strokeStyle = css(mix(fill, hex('#5e4640'), 0.4), 0.4);
    g.lineWidth = 0.08;
    g.stroke();
  }
  if (damp !== undefined) {
    g.beginPath();
    g.moveTo(-1, -1);
    for (let x = -1; x <= W + 1; x += 0.5) g.lineTo(x, damp + 0.4 + 0.8 * noise2(x / 1.4, 0.5, seed) + 0.8 * wear);
    g.lineTo(W + 1, -1);
    g.closePath();
    g.fillStyle = css(mix(fill, hex('#6e6a6c'), 0.4), 0.42);
    g.fill();
  }
  // Checks: splits along the grain, more and longer as it wears, each cut with its lit lip.
  const checks = Math.floor(wear * 3.2 + (T() < wear ? 1 : 0));
  for (let i = 0; i < checks && W > 0.9; i++) {
    const x = 0.35 + T() * (W - 0.7), z0 = T() * H * 0.5, len = H * (0.3 + 0.5 * wear) * (0.6 + 0.4 * T());
    cut(g, fill, 0.13 + 0.07 * wear, () => {
      g.beginPath();
      let px = x;
      g.moveTo(px, z0);
      for (let z = z0; z < Math.min(H - 0.2, z0 + len); z += 0.5) { px += (T() - 0.5) * 0.14; g.lineTo(px, z); }
    });
  }
  g.restore();
}

/** Moss climbing a face from `z0` up its frame as it wears, cushions run together (`cornerMoss` in `forge.ts`): up to `rise` units, `amount` of the way on. */
function footMoss(g: Ctx, k: PaintCtx, w: number, seed: number, amount: number, rise: number, z0 = 0): void {
  if (amount <= 0.04) return;
  const T = rand(seed);
  const tr = g.getTransform(), inv = k.base.inverse();
  const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
  const ps: Pad[] = [];
  for (let x = 0.15; x < w - 0.1; x += 0.38 + 0.2 * T()) {
    const top = (0.25 + rise * amount) * Math.max(0.1, 0.25 + 1.1 * noise2(x / 0.8, 0, seed));
    for (let z = 0.1 + 0.3 * T(); z < top; z += 0.42 + 0.2 * T()) {
      const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x + (T() - 0.5) * 0.25, z0 + z)));
      const r = (0.32 + 0.28 * T()) * (z + 0.5 > top ? 0.8 : 1);
      ps.push([q.x, q.y, r * across, r * across * 0.85]);
    }
  }
  g.save();
  g.setTransform(k.base);
  drawPads(g, ps);
  g.restore();
}

/* ---- the model ------------------------------------------------------------------- */

/** How many steps of its wear it is baked at, from new to falling. */
export const WEAR_STEPS = 8;
/** How many ways round one may stand, by where it stands; and how many ways it may lean. */
export const WORK_POST_VARIANTS = 4;

/** Where its solids stand, in units: the mound, the post to the foot of its head, the crossbar, the head, its cap, the rod. */
const MOUND_H = 1.15;
/** How many packing stones are rammed in round its foot. */
const STONES = 6;
/** How far the post goes down into it, below the ground; and where the mound meets it, up the post's own frame. */
const SUNK = 1.2;
const GROUND = SUNK + MOUND_H * 0.8;
const POST_TOP = 9.4;
const POST_HW = 1.58;
const POST_HW_TOP = 1.44;
const CHAMFER = 0.42;
const BAR_Z = 7.55;
const BAR_HH = 0.55;
const BAR_HD = 0.42;
const BAR_REACH = 5.7;
/** Where a brace meets the post, and how far out under its arm it meets that. */
const BRACE_Z = 4.6;
const BRACE_OUT = 3.7;
const HEAD_HW = 2.06;
const HEAD_Z0 = 9.95;
const HEAD_Z1 = 12.5;
const HEAD_TOP = 12.9;
const CAP_HW = 2.3;
const CAP_EAVE = 13.3;
const CAP_TOP = 15.0;
const ROD_HW = 0.2;
const ROD_TOP = 18.2;
/** The ribbon's head and foot up the rod, where it is tied on. */
const RIBBON_TOP = 17.8;
const RIBBON_FOOT = 15.2;
/** The rune in its head's front and back: its middle up the face, how big (middle to top), and how wide its groove. */
const RUNE = 'tiwaz';
const RUNE_Z = 1.25;
const RUNE_S = 0.92;
const RUNE_W = 0.36;
/** Baked smaller than this, its rune is cut and lit as a staff with one bar across. */
const RUNE_SMALL = 1.6;
/** A rune's lit groove, in the channel cut for it, as the rune lantern's. */
const RUNE_INNER = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6));
const RUNE_CHANNEL = 'rgba(112, 84, 74, 0.9)';

/** How far it leans at `w` of the way through its life, in radians: a hair new, well over at the end. */
const leanOf = (w: number): number => 0.025 + 0.4 * Math.pow(w, 1.7);
/** The step of its wear a post is drawn at, from how much of its life it has `left` (one new, nought falling). */
const wearStep = (left: number): number => Math.round((1 - Math.max(0, Math.min(1, left))) * (WEAR_STEPS - 1));

interface Model {
  parts: Part[];
  head: Part;
  /** The head's front and back, as runes are laid in them. */
  runeSides: Side[];
  turf: V3[];
  /** Where the ribbon is tied to the rod: its head and its foot. */
  ribbon: { top: V3; foot: V3 };
}

const models = new Map<string, Model>();

function modelOf(wood: string, variant: number, step: number): Model {
  const key = `${wood}|${variant}|${step}`;
  const had = models.get(key);
  if (had) return had;
  const w = step / (WEAR_STEPS - 1);
  const seed = 6101 + variant * 89;
  const R = rand(seed);
  const tones = woodTones(wood, w);
  const parts: Part[] = [];
  const rot: Part[] = [];
  /*
   * How it leans: over toward its right and a little back, about its foot,
   * every solid of it turned together; how far its moss has climbed; its
   * crossbar's left arm dropped from its nails toward the end.
   */
  const lean = leanOf(w);
  const phi = -0.32 + 0.2 * (variant % 2);
  const axis: V3 = [-Math.sin(phi), Math.cos(phi), 0];
  const turn = (p: V3): V3 => {
    // About `axis` through the foot, by `lean` (Rodrigues).
    const c = Math.cos(lean), s = Math.sin(lean);
    const kxv = cross(axis, p), kd = dot(axis, p);
    return add(add(mul(p, c), mul(kxv, s)), mul(axis, kd * (1 - c)));
  };
  const moss = Math.max(0, (w - 0.2) / 0.8);
  const drop = Math.max(0, (w - 0.7) / 0.3) * 0.34;

  /* -- the mound it is driven through, the packing stones round its foot, and the ground opened behind it as it goes over -- */
  parts.push({ x: 0, y: 0, first: true, faces: boulder(0, 0, 3.1, 2.8, MOUND_H, R() * TAU, seed * 3 + 1, ROCK, 0.55 + 0.35 * w) });
  // The packing stones rammed in round its foot, a ring of them, moss on their tops: more of it as it ages.
  for (let i = 0; i < STONES; i++) {
    const a = ((i + 0.2 + R() * 0.5) / STONES) * TAU, d = 2.75 + R() * 0.45;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.94, r = 0.85 + R() * 0.4;
    parts.push({ x, y, faces: boulder(x, y, r, r * (0.72 + R() * 0.2), 1.0 + R() * 0.5, R() * TAU, seed * 7 + i, ROCK, 0.25 + 0.6 * w * (0.4 + 0.6 * R())) });
  }
  if (w > 0.45) {
    // Behind its foot, the side it is pulling away from: a dark crescent where the ground has opened.
    const k = Math.min(1, (w - 0.45) / 0.5);
    const bx = -Math.cos(phi) * (POST_HW + 0.3), by = -Math.sin(phi) * (POST_HW + 0.3);
    parts.push({
      x: 0, y: 0, tier: -1,
      draw: (g, e) => {
        const [px, py] = proj(e, [bx, by, MOUND_H * 0.82]);
        const across = Math.hypot(e.ux, e.uy);
        g.beginPath();
        g.ellipse(px, py, (0.9 + 0.9 * k) * across, (0.45 + 0.4 * k) * across, 0, 0, TAU);
        g.fillStyle = 'rgba(64, 52, 58, 0.75)';
        g.fill();
        g.beginPath();
        g.ellipse(px + 0.3 * across, py + 0.25 * across, (0.7 + 0.6 * k) * across, (0.3 + 0.25 * k) * across, 0, 0, TAU);
        g.fillStyle = 'rgba(122, 104, 96, 0.55)';
        g.fill();
      },
    });
  }

  /* -- the post: squared, its arrises chamfered, tapering a hair, from under the mound to the foot of its head -- */
  const postFaces = prism([ring(POST_HW, POST_HW, -SUNK, CHAMFER), ring(POST_HW_TOP, POST_HW_TOP, POST_TOP, CHAMFER * 0.9)], tones.post, (_k, i, s) => {
    const broad = i % 2 === 0;
    return {
      crease: broad ? 0.42 : 0.3,
      paint: (g, k) => {
        grain(g, k.fill, s.w, s.h, seed + i * 13, broad ? w : w * 0.5, false, GROUND);
        if (broad) {
          // Two rings cut round it under its head, and on its front a tally of notches between them.
          for (const z of [POST_TOP - 1.0, POST_TOP - 0.55]) cut(g, k.fill, 0.13, () => { g.beginPath(); g.moveTo(-0.2, z + SUNK); g.lineTo(s.w + 0.2, z + SUNK); });
          if (i === 4) for (let j = 0; j < 3; j++) cut(g, k.fill, 0.12, () => { g.beginPath(); const x = s.w / 2 - 0.5 + j * 0.5; g.moveTo(x, POST_TOP - 0.9 + SUNK); g.lineTo(x + 0.18, POST_TOP - 0.62 + SUNK); });
        }
        footMoss(g, k, s.w, seed + 40 + i, moss * (i === 4 || i === 6 || i === 5 ? 1 : 0.55), 2.4 + 2.6 * w, GROUND - 0.3);
      },
    };
  });
  const post: Part = { x: 0, y: 0, faces: postFaces, solid: true, tier: 1 };
  parts.push(post);
  rot.push(post);

  /* -- the crossbar: an arm of plank out each side of the post, nailed front and back, a brace of shaft under each -- */
  const plankSkin = (g: Ctx, k: PaintCtx, len: number, wid: number, i: number, salt: number): void => {
    grain(g, k.fill, len, wid, seed + salt + i, w * 0.8, true);
    // The nails by the post on its front and back, two to an arm: iron heads, a glint on each.
    if (i === 1 || i === 3) for (const y of [wid * 0.28, wid * 0.72]) {
      g.beginPath();
      g.arc(0.55, y, 0.2, 0, TAU);
      g.fillStyle = css(mix(hex('#4a4652'), k.fill, 0.15));
      g.fill();
      g.beginPath();
      g.arc(0.5, y - 0.06, 0.08, 0, TAU);
      g.fillStyle = 'rgba(220, 226, 240, 0.7)';
      g.fill();
    }
  };
  const endGrain = (g: Ctx, k: PaintCtx): void => {
    // The sawn end: rings round the heart, a step darker.
    g.strokeStyle = css(mix(k.fill, hex('#6a5048'), 0.4), 0.45);
    g.lineWidth = 0.06;
    for (const r of [0.18, 0.36]) { g.beginPath(); g.ellipse(-0.1, 0.05, r * 1.5, r, 0, 0, TAU); g.stroke(); }
  };
  for (const sideSign of [-1, 1]) {
    const root: V3 = [sideSign * (POST_HW - 0.1), 0, BAR_Z];
    // The left arm drops from its nails toward the end, its tip lower.
    const sag = sideSign < 0 ? drop : 0;
    const tip: V3 = [sideSign * BAR_REACH, 0, BAR_Z - Math.sin(sag) * (BAR_REACH - POST_HW)];
    const arm: Part = {
      x: sideSign * 2.5, y: 0, solid: true, tier: 1,
      order: (e) => 1 + 0.5 * Math.sign(dot([sideSign, 0, 0], e.toward) || 1),
      faces: beam(root, tip, [0, 0, 1], BAR_HD, BAR_HH, tones.plank, (g, k, len, wid, i) => plankSkin(g, k, len, wid, i, sideSign > 0 ? 70 : 80), endGrain),
    };
    parts.push(arm);
    rot.push(arm);
    // The brace under it: a shaft from the post up to the arm's underside.
    const bz = BAR_Z - BAR_HH - Math.sin(sag) * (BRACE_OUT - POST_HW);
    const brace: Part = {
      x: sideSign * 2.0, y: 0, solid: true, tier: 1,
      order: (e) => 1 + 0.45 * Math.sign(dot([sideSign, 0, 0], e.toward) || 1),
      faces: beam([sideSign * (POST_HW - 0.15), 0, BRACE_Z], [sideSign * BRACE_OUT, 0, bz + 0.15], [0, 1, 0], 0.3, 0.3, tones.brace,
        (g, k, len, wid, i) => grain(g, k.fill, len, wid, seed + 90 + i, w * 0.5, true)),
    };
    parts.push(brace);
    rot.push(brace);
  }

  /* -- the head: flared out of the post, a carved block with a rune in its front and back, drilled dots in its sides -- */
  const runeSides: Side[] = [];
  const headFaces = prism([
    ring(POST_HW_TOP, POST_HW_TOP, POST_TOP - 0.05, CHAMFER * 0.9),
    ring(HEAD_HW, HEAD_HW, HEAD_Z0, CHAMFER * 1.1),
    ring(HEAD_HW, HEAD_HW, HEAD_Z1, CHAMFER * 1.1),
    ring(HEAD_HW - 0.34, HEAD_HW - 0.34, HEAD_TOP, CHAMFER * 0.8),
  ], tones.post, (k, i, s) => {
    const broad = i % 2 === 0;
    if (k !== 1) return { crease: 0.5 };
    if (i === 4 || i === 0) runeSides.push(s);
    return {
      crease: broad ? 0.45 : 0.32,
      paint: (g, kk) => {
        const fill = kk.fill;
        grain(g, fill, s.w, s.h, seed + 120 + i, w * 0.7);
        if (!broad) return;
        // A margin drafted round the face, as the rune lantern's band.
        cut(g, fill, 0.12, () => { g.beginPath(); g.rect(0.36, 0.3, s.w - 0.72, s.h - 0.6); });
        if (i === 4 || i === 0) {
          const tr = g.getTransform();
          const px = Math.max(1e-6, Math.min(Math.hypot(tr.a, tr.b), Math.hypot(tr.c, tr.d)));
          // Baked small, a staff with one bar across reads as a cut rune where the rune itself is a speck (`runelantern.ts`).
          cut(g, fill, Math.max(RUNE_W, 2.2 / px), () => glyphPath(g, Math.hypot(kk.base.a, kk.base.b) < RUNE_SMALL ? 'staff' : RUNE, s.w / 2, RUNE_Z, RUNE_S));
        } else {
          for (const dz of [-0.55, 0, 0.55]) cut(g, fill, 0.22, () => { g.beginPath(); g.moveTo(s.w / 2, RUNE_Z + dz + 0.03); g.lineTo(s.w / 2, RUNE_Z + dz - 0.03); });
        }
        // Lichen on its head as it ages.
        if (w > 0.4) {
          const L = rand(seed + 140 + i);
          lichen(g, L, 0.5 + L() * (s.w - 1), s.h * (0.55 + 0.35 * L()), 0.3 + 0.25 * w, ['#cdd2b0', '#bcc6aa']);
        }
      },
    };
  });
  const head: Part = { x: 0, y: 0, faces: headFaces, solid: true, tier: 2, lit: true };
  parts.push(head);
  rot.push(head);

  /* -- the cap: a low pyramid with a short eave, moss on it as it ages -- */
  const capFaces = prism([
    ring(CAP_HW, CAP_HW, HEAD_TOP - 0.05),
    ring(CAP_HW, CAP_HW, CAP_EAVE),
    ring(0.32, 0.32, CAP_TOP),
  ], tones.cap, (k, i, s) => k === 1 ? {
    crease: 0.5,
    paint: (g, kk) => {
      // Its boards down the slope, and as it ages moss on its shady slopes.
      g.strokeStyle = css(mix(kk.fill, hex('#5e4640'), 0.4), 0.4);
      g.lineWidth = 0.1;
      g.beginPath();
      for (let x = 0.7; x < s.w - 0.3; x += 0.75) { g.moveTo(x, 0); g.lineTo(s.w / 2 + (x - s.w / 2) * 0.2, s.h); }
      g.stroke();
      if (i === 0 || i === 3) footMoss(g, kk, s.w, seed + 160 + i, w * 0.9, 0.8);
    },
  } : { crease: 0.45 });
  const cap: Part = { x: 0, y: 0, faces: capFaces, solid: true, tier: 3, lit: true };
  parts.push(cap);
  rot.push(cap);

  /* -- the rod out of its cap, a knob on its head -- */
  const rod: Part = {
    x: 0, y: 0, solid: true, tier: 4,
    faces: [
      ...prism([ring(ROD_HW, ROD_HW, CAP_TOP - 0.3), ring(ROD_HW, ROD_HW, ROD_TOP - 0.3)], IRON),
      ...prism([ring(0.18, 0.18, ROD_TOP - 0.35), ring(0.42, 0.42, ROD_TOP - 0.05), ring(0.12, 0.12, ROD_TOP + 0.35)], IRON),
    ],
  };
  parts.push(rod);
  rot.push(rod);

  // Every solid of it leans together, frames and all, so what is painted on them leans with them.
  for (const p of rot) for (const f of p.faces ?? []) {
    f.pts = f.pts.map(turn);
    f.n = turn(f.n);
    if (f.frame) f.frame = { o: turn(f.frame.o), a: turn(f.frame.a), b: turn(f.frame.b) };
  }
  const sides = runeSides.map((s) => ({ ...s, o: turn(s.o), a: turn(s.a), b: turn(s.b), n: turn(s.n), poly: s.poly.map(turn) }));

  /* -- grass round the mound and a flower or two -- */
  const colours = ['yellow', 'rose', 'cream'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R() * 0.5, d = 4.3 + R() * 1.0;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const s0 = seed * 7 + i, flower = i === 1 || i === 4;
    const colour = colours[(i + variant) % colours.length];
    parts.push({ x, y, reach: [[x, y, 3]], draw: (g, e) => { const [px, py] = proj(e, [x, y, 0.1]); if (flower) flowerClump(g, px, py, colour, s0, 0.3); else grassTuft(g, px, py, s0, 0.36); } });
  }
  const turf: V3[] = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * TAU, r = 5.3 + R() * 0.8;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.9, 0] as V3;
  });
  const model: Model = { parts, head, runeSides: sides, turf, ribbon: { top: turn([0, 0, RIBBON_TOP]), foot: turn([0, 0, RIBBON_FOOT]) } };
  models.set(key, model);
  return model;
}

/* ---- baking ------------------------------------------------------------------------ */

/** How square on the eye must see the head's front for its rune's light to be laid, and how much more for all of it (`runelantern.ts`). */
const GLOW_SEEN = 0.3;
const GLOW_FULL = 0.3;
/** How much stronger than it is laid its rune's light after dark is baked, to be turned up under the wash (`forge.ts`). */
const GLOW_GAIN = 2;
const underWash = (over: number): number => Math.min(3, 1 / Math.max(1e-3, 1 - Math.max(0, over)));

/** The ribbon flying: how long it is, in units, at no wind and at a full one, and how deep at its hoist. */
const FLY_LEN = 8.0;
const FLY_LEN_WIND = 2.0;
const FLY_H = RIBBON_TOP - RIBBON_FOOT;

interface Bake {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What it is drawn over, and what of it is clicked, in pixels at zoom one from its footprint's middle: left, top, right, bottom. */
  bounds: [number, number, number, number];
  hit: [number, number, number, number];
  glows: Glow[];
  seen: number[];
  /** Each rune's lit groove by day, with its warmth round it (`drawWorkPostLive`). */
  dayCores: HTMLCanvasElement[];
  /** Its rune's light after dark, as one picture (`drawWorkPostNight`). */
  glow: { canvas: HTMLCanvasElement; box: [number, number, number, number] } | null;
  /** Where the ribbon is tied on, on the screen at zoom one. */
  top: Pt;
  foot: Pt;
  area: number;
}

const BAKED_BUDGET = 6e6;
const bakes = new Map<string, Bake>();
let bakedArea = 0;
/**
 * Which way round each of its variants stands: its crossbar across the eye's
 * way an eighth of a half turn off square at the camera's first turn, as the
 * runestones are turned, its front or its back to the eye, and half of them a
 * little further round.
 */
const yawOf = (variant: number): number => -Math.PI / 8 + (variant & 1 ? Math.PI : 0) + (variant & 2 ? 0.42 : 0);

function bake(wood: string, variant: number, step: number, worked: boolean, rotation: number, scale: number): Bake {
  const m = modelOf(wood, variant, step);
  const e = eyeOf(yawOf(variant), rotation);
  const order = laid(m.parts, e);
  // Room round it for the ribbon flying any way the wind has it, kept out of the picture: in what it is drawn over and clicked by.
  const fly = FLY_LEN + FLY_LEN_WIND + 1;
  const reach: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    for (const z of [RIBBON_TOP + 0.8, RIBBON_FOOT - 1.6]) reach.push(add(m.ribbon.top, [Math.cos(a) * fly, Math.sin(a) * fly, z - RIBBON_TOP]));
  }
  const turf = m.turf.map((q) => mul(q, 0.85));
  const [x0, y0, x1, y1] = boxOf(e, [...pointsOf(m.parts), ...turf], 3).map((v, i) => (i < 2 ? Math.floor(v) : Math.ceil(v)));
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(M0);
  {
    // The turf round its foot, and its shade thrown away from the light, as an anvil's.
    polyPath(g, e, turf);
    g.fillStyle = 'rgba(118, 156, 122, 0.36)';
    g.fill();
    for (const [k, a] of [[1.12, 0.08], [1, 0.12]] as Array<[number, number]>) {
      polyPath(g, e, ring(3.2 * k, 2.8 * k, 0).map((q, i) => [q[0] + (i % 3 ? 0.4 : 0), q[1], 0] as V3));
      g.save();
      g.translate(3, 1.5);
      g.fillStyle = `rgba(44, 74, 78, ${a})`;
      g.fill();
      g.restore();
    }
  }
  for (const p of order) {
    if (p.draw) p.draw(g, e);
    else if (p.faces) {
      drawFaces(g, e, p.faces, INK, INK_COLOUR);
      if (p.lit) litEdges(g, e, p.faces, p.faces.length * 7 + (p.tier ?? 0) * 5 + step);
    }
  }
  if (!worked) {
    const [tx, ty] = proj(e, m.ribbon.top), [fx, fy] = proj(e, m.ribbon.foot);
    furled(g, tx, ty, fx, fy);
  }

  /* -- its rune's light, on whichever of its head's faces the eye sees -- */
  const glows: Glow[] = [];
  const seen: number[] = [];
  const dayCores: HTMLCanvasElement[] = [];
  for (const s of m.runeSides) {
    const cos = dot(s.n, e.toward) / Math.hypot(...e.toward);
    if (cos < GLOW_SEEN) continue;
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const small = scale < RUNE_SMALL;
    const gl = bakeRune(sideM(e, s), { glyph: small ? 'staff' : RUNE, x: s.w / 2, z: RUNE_Z, s: RUNE_S, i: variant, w: Math.max(RUNE_W, (small ? 1.7 : 1.4) / scale), inner: RUNE_INNER, mid: RUNE_GOLD, edge: RUNE_CHANNEL }, scale);
    for (const c of [gl.core, gl.halo, gl.dusk, gl.mask]) {
      const h = c.getContext('2d') as Ctx;
      h.setTransform(scale, 0, 0, scale, -gl.box[0] * scale, -gl.box[1] * scale);
      h.globalCompositeOperation = 'destination-in';
      polyPath(h, e, s.poly);
      h.fill();
      h.globalCompositeOperation = 'source-over';
      lessInFront(h, e, order, m.head);
    }
    glows.push(gl);
    seen.push(fade * fade * (3 - 2 * fade));
    // And by day its groove with a faint warmth round it laid under, as colour, in one picture: so a worked post's head reads lit from across a field.
    const [dc, dg] = canvasOf(gl.core.width, gl.core.height);
    dg.globalAlpha = 0.45;
    dg.drawImage(gl.halo, 0, 0);
    dg.globalAlpha = 1;
    dg.drawImage(gl.core, 0, 0);
    dayCores.push(dc);
  }
  let glow: Bake['glow'] = null;
  if (glows.length) {
    // Its dusk and its groove together, as light, so a frame lays them with one draw.
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const gl of glows) { l = Math.min(l, gl.box[0]); t = Math.min(t, gl.box[1]); r = Math.max(r, gl.box[0] + gl.box[2]); b = Math.max(b, gl.box[1] + gl.box[3]); }
    const a0 = Math.floor(l), b0 = Math.floor(t), gw = Math.ceil(r) - a0, gh = Math.ceil(b) - b0;
    const [cv, h] = canvasOf(gw * scale, gh * scale);
    h.globalCompositeOperation = 'lighter';
    glows.forEach((gl, i) => {
      for (const [c, a] of [[gl.dusk, 0.3], [gl.core, 0.5]] as Array<[HTMLCanvasElement, number]>) {
        for (let k = seen[i] * a * GLOW_GAIN; k > 0.001; k -= 1) {
          h.globalAlpha = Math.min(1, k);
          h.drawImage(c, (gl.box[0] - a0) * scale, (gl.box[1] - b0) * scale, gl.box[2] * scale, gl.box[3] * scale);
        }
      }
    });
    glow = { canvas: cv, box: [a0, b0, gw, gh] };
  }
  const solid = boxOf(e, pointsOf(m.parts, true), 2);
  const flown = worked ? boxOf(e, reach) : solid;
  const bounds: [number, number, number, number] = [Math.min(x0, Math.floor(flown[0])), Math.min(y0, Math.floor(flown[1])), Math.max(x1, Math.ceil(flown[2])), Math.max(y1, Math.ceil(flown[3]))];
  const hit: [number, number, number, number] = [Math.floor(Math.min(solid[0], flown[0])), Math.floor(Math.min(solid[1], flown[1])), Math.ceil(Math.max(solid[2], flown[2])), Math.ceil(solid[3])];
  const area = canvas.width * canvas.height + glows.reduce((n, gl) => n + 5 * gl.core.width * gl.core.height, 0) + (glow ? glow.canvas.width * glow.canvas.height : 0);
  return { canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds, hit, glows, seen, dayCores, glow, top: proj(e, m.ribbon.top), foot: proj(e, m.ribbon.foot), area };
}

function baked(look: WorkPostLook, rotation: number, zoom: number): Bake {
  const scale = scaleFor(zoom);
  const rot = ((rotation % 8) + 8) % 8, v = ((look.variant % WORK_POST_VARIANTS) + WORK_POST_VARIANTS) % WORK_POST_VARIANTS;
  const wood = woodHex(look.wood), step = wearStep(look.left);
  const key = `${wood}|${v}|${step}|${look.worked ? 1 : 0}|${rot}|${scale}`;
  let b = bakes.get(key);
  if (b) {
    bakes.delete(key);
    bakes.set(key, b);
    return b;
  }
  b = bake(wood, v, step, look.worked, rot, scale);
  bakes.set(key, b);
  bakedArea += b.area;
  for (const [k, old] of bakes) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    bakes.delete(k);
    bakedArea -= old.area;
  }
  return b;
}

/* ---- drawing it -------------------------------------------------------------------- */

/** The wind as a post is drawn in it: which way it blows on the ground (x east, y south) and how hard, nought to one (`game/wind.ts`). */
export interface PostWind { x: number; y: number; force: number }
/** Where none is given: a light air from the west. */
const STILL_AIR: PostWind = { x: 1, y: 0.25, force: 0.35 };

/** How a work post is drawn: the wood it was built of, how much of its life it has left (one new, nought falling), whether a wildermon works from it, which way round it stands, and the wind. */
export interface WorkPostLook {
  wood?: string;
  left: number;
  worked: boolean;
  variant: number;
  /** Its own beat in the wind, so a row of them do not flap together. */
  seed?: number;
  wind?: PostWind;
}

/** The metal ribbon: in the light, in shade, the light along its edge, and its ink; and wound up, dulled. */
const RIBBON_LIT = '#f6d47a';
const RIBBON_SHADE = '#cf9f4e';
const RIBBON_EDGE = 'rgba(255, 248, 214, 0.9)';
const RIBBON_INK = '#7c5e28';
const FURLED_LIT = '#ddd2b2';
const FURLED_SHADE = '#ab9f84';
const FURLED_INK = '#6e6250';

/** The screen's way for a unit along the ground at a turn, as the world is seen: east and south. */
const groundEye = new Map<number, Eye>();
const eyeAt = (rotation: number): Eye => {
  const r = ((rotation % 8) + 8) % 8;
  let e = groundEye.get(r);
  if (!e) { e = eyeOf(0, r); groundEye.set(r, e); }
  return e;
};

/**
 * The ribbon wound round its rod, laid in the bake of a post nobody works
 * from: a band a little wider than the rod between where it is tied on at
 * (tx, ty) and (fx, fy), in pixels at zoom one, the turns across it, and a
 * short tail hanging off its foot.
 */
function furled(g: Ctx, tx: number, ty: number, fx: number, fy: number): void {
  const hw = 1.15, l = Math.hypot(fx - tx, fy - ty) || 1;
  const nx = (fy - ty) / l, ny = -(fx - tx) / l;
  const a = 0.15, z = 0.88;
  const p = (u: number, s: number): Pt => [tx + (fx - tx) * u + nx * hw * s, ty + (fy - ty) * u + ny * hw * s];
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  for (const [u, s] of [[a, -1], [z, -1], [z + 0.08, 0], [z, 1], [a, 1], [a - 0.08, 0]] as Pt[]) { const [x, y] = p(u, s); g.lineTo(x, y); }
  g.closePath();
  g.fillStyle = FURLED_LIT;
  g.fill();
  g.strokeStyle = FURLED_INK;
  g.lineWidth = INK;
  g.stroke();
  g.beginPath();
  for (let u = a + 0.16; u < z - 0.05; u += 0.2) {
    const [x0, y0] = p(u, -1), [x1, y1] = p(u + 0.12, 1);
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
  }
  const [bx, by] = p(z, 1);
  g.moveTo(bx, by);
  g.quadraticCurveTo(bx + 1.4, by + 2.6, bx + 0.9, by + 4.4);
  g.strokeStyle = FURLED_SHADE;
  g.lineWidth = 0.9;
  g.stroke();
}

/**
 * The ribbon flying is laid from pictures made once: so many to a turn of
 * its wave, for so many steps of the wind's force and so many ways round the
 * screen it may stream, at each scale -- every post on the island flies in the
 * one wind, so a frame lays the same few pictures wherever they are.
 */
const RIBBON_FRAMES = 16;
const FORCE_STEPS = 4;
const WIND_SECTORS = 16;
const RIBBON_BUDGET = 1.5e6;
/** How many pieces it is laid in along its length. */
const SEGS = 7;
interface RibbonFrame { canvas: HTMLCanvasElement; ox: number; oy: number; area: number }
const ribbonFrames = new Map<string, RibbonFrame>();
let ribbonArea = 0;
/** How fast its wave runs in a wind of force `f`, in turns of a radian a second. */
const waveSpeed = (f: number): number => 2.4 + 3.0 * f;

/**
 * One picture of the ribbon flying, at `scale`: streaming down a wind that
 * runs at `sector` of `WIND_SECTORS` round the screen, `fstep` of
 * `FORCE_STEPS` strong, `frame` of `RIBBON_FRAMES` through a turn of its wave
 * -- tapering to a swallowtail, its folds turned from the light in shade, the
 * light along its upper edge and the ink round it. Its hoist's middle is at
 * (ox, oy) in the picture's pixels.
 */
function ribbonFrame(scale: number, sector: number, fstep: number, frame: number): RibbonFrame {
  const key = `${scale}|${sector}|${fstep}|${frame}`;
  const had = ribbonFrames.get(key);
  if (had) {
    ribbonFrames.delete(key);
    ribbonFrames.set(key, had);
    return had;
  }
  const a = (sector / WIND_SECTORS) * TAU, f = fstep / FORCE_STEPS;
  const ex = Math.cos(a), ey = Math.sin(a);
  /*
   * Down the wind as the eye sees it, a unit along it on the screen at zoom
   * one: across the screen to whichever side the wind carries it, shorter the
   * more the wind blows toward the eye or away, never so short it is not a
   * flag; and a little down or up the screen as it does.
   */
  const side = ex >= 0 ? 1 : -1;
  const ax = side * (0.6 + 0.62 * Math.abs(ex)), ay = ey * 0.32;
  const L = FLY_LEN + FLY_LEN_WIND * f;
  // It streams out level in a wind and dips toward its tail in a light one; it waves deeper the harder it blows.
  const droop = (1 - f) * 0.1, depth = 0.22 + 0.2 * f;
  const th = (frame / RIBBON_FRAMES) * TAU;
  // How far round each point of it is turned as it waves: its edge seen narrower, and in shade, where it is turned from the eye.
  const turnAt = (u: number): number => Math.cos(u * 0.9 - th);
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= SEGS; i++) {
    const u = (i / SEGS) * L, k = u / L;
    const rise = Math.sin(u * 0.9 - th) * depth * k - droop * u;
    const half = (FLY_H / 2) * (1 - 0.4 * k) * (1 - 0.15 * k * (1 - turnAt(u)));
    const cx = ax * u, cy = ay * u - rise * HEIGHT_SCALE;
    top.push([cx, cy - half * HEIGHT_SCALE]);
    bot.push([cx, cy + half * HEIGHT_SCALE]);
  }
  // Its tail cut in a swallowtail: the notch back along its middle, a little short of its tips.
  const mid = (i: number): Pt => [(top[i][0] + bot[i][0]) / 2, (top[i][1] + bot[i][1]) / 2];
  const [m0, m1] = [mid(SEGS - 1), mid(SEGS)];
  const notch: Pt = [m0[0] + (m1[0] - m0[0]) * 0.35, m0[1] + (m1[1] - m0[1]) * 0.35];
  const all = [...top, notch, ...bot];
  const x0 = Math.floor(Math.min(...all.map((q) => q[0])) - 2), y0 = Math.floor(Math.min(...all.map((q) => q[1])) - 2);
  const x1 = Math.ceil(Math.max(...all.map((q) => q[0])) + 2), y1 = Math.ceil(Math.max(...all.map((q) => q[1])) + 2);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = (): void => {
    g.beginPath();
    top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(notch[0], notch[1]);
    for (let i = SEGS; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath();
  };
  outline();
  g.fillStyle = RIBBON_LIT;
  g.fill();
  g.save();
  g.clip();
  g.beginPath();
  for (let i = 0; i < SEGS; i++) {
    if (turnAt(((i + 0.5) / SEGS) * L) > -0.2) continue;
    g.moveTo(top[i][0], top[i][1]);
    g.lineTo(top[i + 1][0], top[i + 1][1]);
    g.lineTo(bot[i + 1][0], bot[i + 1][1]);
    g.lineTo(bot[i][0], bot[i][1]);
    g.closePath();
  }
  g.fillStyle = RIBBON_SHADE;
  g.fill();
  g.restore();
  g.beginPath();
  g.moveTo(top[0][0], top[0][1] + 0.5);
  for (let i = 1; i < SEGS; i++) g.lineTo(top[i][0], top[i][1] + 0.5);
  g.strokeStyle = RIBBON_EDGE;
  g.lineWidth = 0.6;
  g.stroke();
  outline();
  g.strokeStyle = RIBBON_INK;
  g.lineWidth = INK;
  g.stroke();
  const out: RibbonFrame = { canvas, ox: -x0 * scale, oy: -y0 * scale, area: canvas.width * canvas.height };
  ribbonFrames.set(key, out);
  ribbonArea += out.area;
  for (const [k, old] of ribbonFrames) {
    if (ribbonArea <= RIBBON_BUDGET || k === key) break;
    ribbonFrames.delete(k);
    ribbonArea -= old.area;
  }
  return out;
}

/**
 * A worked post's ribbon flying off its rod, at (sx, sy) on the screen: down
 * the wind as the eye sees it, a picture of it as far through its wave as it
 * is on its own beat (`seed`).
 */
function drawRibbon(ctx: Ctx, b: Bake, sx: number, sy: number, zoom: number, look: WorkPostLook, rotation: number, t: number): void {
  const wind = look.wind ?? STILL_AIR;
  const e = eyeAt(rotation);
  const wl = Math.hypot(wind.x, wind.y) || 1;
  const dx = wind.x / wl, dy = wind.y / wl;
  const ex = dx * e.ux + dy * e.vx, ey = dx * e.uy + dy * e.vy;
  const sector = ((Math.round((Math.atan2(ey, ex) / TAU) * WIND_SECTORS) % WIND_SECTORS) + WIND_SECTORS) % WIND_SECTORS;
  const fstep = Math.round(Math.max(0, Math.min(1, wind.force)) * FORCE_STEPS);
  const turns = (t * waveSpeed(fstep / FORCE_STEPS) - (look.seed ?? look.variant) * 2.399) / TAU;
  const fr = ribbonFrame(b.scale, sector, fstep, Math.floor(((turns % 1) + 1) % 1 * RIBBON_FRAMES) % RIBBON_FRAMES);
  const k = zoom / b.scale;
  const hx = sx + (b.top[0] + b.foot[0]) / 2 * zoom, hy = sy + (b.top[1] + b.foot[1]) / 2 * zoom;
  // Its hoist sheared along the rod, so on a post going over it stays tied on.
  const lean = (b.top[0] - b.foot[0]) / Math.min(-1e-3, b.top[1] - b.foot[1]);
  if (Math.abs(lean) > 0.04) {
    ctx.save();
    ctx.transform(1, 0, lean, 1, -lean * hy, 0);
    ctx.drawImage(fr.canvas, hx - fr.ox * k, hy - fr.oy * k, fr.canvas.width * k, fr.canvas.height * k);
    ctx.restore();
  } else ctx.drawImage(fr.canvas, hx - fr.ox * k, hy - fr.oy * k, fr.canvas.width * k, fr.canvas.height * k);
}

/**
 * Draw a work post whose footprint's middle is at (sx, sy) on the screen,
 * from viewpoint `rotation`, at `t` seconds, under a night `night` dark: its
 * bake and its ribbon, and unless `live` is false its rune's light over it
 * (`drawWorkPostLive`). Returns what it covers from (sx, sy), in screen
 * pixels: left, top, right, bottom.
 */
export function drawWorkPost(ctx: Ctx, sx: number, sy: number, zoom: number, look: WorkPostLook, rotation = 0, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = baked(look, rotation, zoom);
  const k = zoom / b.scale;
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  if (look.worked) drawRibbon(ctx, b, sx, sy, zoom, look, rotation, t);
  if (live) drawWorkPostLive(ctx, sx, sy, zoom, look, rotation, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** How dark it is before a lit rune is laid only as light, after dark (`drawWorkPostNight`). */
const NIGHT_ONLY = 0.6;

/** Its rune, lit gold and breathing softly while a wildermon works from it; a dark groove while none does. */
export function drawWorkPostLive(ctx: Ctx, sx: number, sy: number, zoom: number, look: WorkPostLook, rotation = 0, night = 0, t = performance.now() / 1000): void {
  // From deep dusk its groove is in the light laid over the night (`drawWorkPostNight`), and nothing need be laid under it.
  if (!look.worked || night >= NIGHT_ONLY) return;
  const b = baked(look, rotation, zoom);
  if (!b.glows.length) return;
  const wasA = ctx.globalAlpha;
  b.glows.forEach((gl, i) => {
    const p = breath(gl, t);
    const [x, y, w, h] = gl.box;
    // By day with its warmth round it; from dusk the groove alone, its light then the night's (`drawWorkPostNight`).
    ctx.globalAlpha = wasA * Math.min(1, 0.5 + 0.25 * night + 0.3 * p) * b.seen[i];
    ctx.drawImage(night < 0.3 ? b.dayCores[i] : gl.core, sx + x * zoom, sy + y * zoom, w * zoom, h * zoom);
  });
  ctx.globalAlpha = wasA;
}

/**
 * A worked post's rune after dark: its groove and a little gold round it
 * added as light, breathing, laid straight after it in its own place among
 * what is drawn and turned up by as much as the night's wash over it will
 * take off (`over`), as an anvil's is (`drawAnvilNight`).
 */
export function drawWorkPostNight(ctx: Ctx, sx: number, sy: number, zoom: number, look: WorkPostLook, rotation: number, night: number, t = performance.now() / 1000, over = 0): void {
  if (night <= 0.02 || !look.worked) return;
  const b = baked(look, rotation, zoom);
  if (!b.glow || !b.glows.length) return;
  const p = breath(b.glows[0], t);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, wasA * night * (0.5 + 0.4 * p) * underWash(over) / GLOW_GAIN);
  const [x, y, w, h] = b.glow.box;
  ctx.drawImage(b.glow.canvas, sx + x * zoom, sy + y * zoom, w * zoom, h * zoom);
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * How a worked post's rune takes the night off itself, for the runestones'
 * keeping (`RunestoneNight.source`): in its own shape with a little light
 * round it, kept off whatever stands in front, as an anvil's (`anvilNight`).
 */
export function workPostNight(look: WorkPostLook, rotation: number, zoom: number): NightSource {
  const b = baked(look, rotation, zoom);
  return {
    glows: b.glows,
    rise: 0,
    holes: (sx, sy, z, t): NightHole[] => b.glows.map((gl, i) => ({ x: sx + gl.cx * z, y: sy + gl.cy * z, r: gl.r * 1.2 * z, a: (0.07 + 0.04 * breath(gl, t)) * b.seen[i] })),
    masks: (sx, sy, z, t): NightMask[] => glowMasks(b.glows, sx, sy, z, t).map((mk, i) => ({ ...mk, a: mk.a * b.seen[i] * 0.9 })),
  };
}

/** What a work post is clicked by, from its footprint's middle, in pixels at zoom one: the post and the ribbon's reach, not the mound. */
export function workPostHit(look: WorkPostLook, rotation: number, zoom = 1): [number, number, number, number] {
  return baked(look, rotation, zoom).hit;
}

/** What it is drawn over, ribbon and all, from its footprint's middle, in pixels at zoom one. */
export function workPostBounds(look: WorkPostLook, rotation: number, zoom = 1): [number, number, number, number] {
  return baked(look, rotation, zoom).bounds;
}

/** Which way round a post standing at subtile (sx, sy) of tile (x, y) is driven in. */
export const workPostVariant = (x: number, y: number, sx: number, sy: number): number =>
  Math.floor(hashOf(x * 4 + sx, y * 4 + sy, 7, 3181) * WORK_POST_VARIANTS) % WORK_POST_VARIANTS;
