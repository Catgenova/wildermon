import { KILN_GLOW, KILN_GLOW_FIRING, KILN_VENT_BACK, KILN_VENT_UP } from '../game/kiln';
import { SMELTER_STACK_BACK, SMELTER_STACK_UP } from '../game/smelter';
import { UNITS_PER_TILE } from './iso';
import { hashOf, rand } from './ivy';
import {
  add, at, bakeRune, breath, canvasOf, glowMasks, CREASE_INK, css, cut, dot, drawFaces, drawPads, eyeOf, flowerClump, glyphPath, grassTuft,
  hex, lichen, mix, mul, newell, noise2, panelArch, proj, RUNE_GOLD, RUNE_WHITE, scaleFor, STONE_INK, sub, TAU, toneOf, unit,
  type Ctx, type Eye, type Face, type Glow, type Pad, type PaintCtx, type NightHole, type NightMask, type NightSource, type Pt, type RGB, type Tone, type V3,
} from './runestone';

/**
 * The smith's two pieces -- the smelter (the furnace) and the anvil -- and
 * the potter's kiln, drawn as the runestones are (`runestone.ts`), from their kit: small models
 * of faceted solids in tenths of a metre, put on the screen through the
 * camera's turn, baked for each way they are seen and each scale, and what
 * moves laid over the bake.
 *
 * The smelter fills its three by two subtiles: a squat body of dressed
 * stone in courses on a hearth slab, its corners quoined, under a band of
 * runes and a hipped stone shoulder, and out of that a tapering stack with a
 * lipped cap. In its front an arched firemouth, its voussoirs round a dark
 * mouth, under a stone lintel with the torch rune cut in it, the face over it
 * sooted. Cold, that is all it is. Alight, the mouth is a bed of embers lit
 * from gold at its heart to ember orange at its jambs, breathing; the runes
 * round the band and on the lintel are lit the same; the flue glows; and the
 * hearth in front takes the light. Working a charge, all of that is brighter
 * and sparks go up the stack. Its smoke is the island's (`smoke.ts`), out of
 * the stack (`Game.fires`), and its light on the ground the game's
 * (`Game.lights`), which is what takes the night off it after dark. Then its
 * stone keeps some of the night, the mouth lights its own front, and the
 * runes and the heat at the mouth and flue are added as light. It does not
 * take the night off itself in its runes' shapes as a runestone does
 * (`RunestoneNight`): its own light has already done that, and the keeping
 * would cost every frame a box of whatever is drawn after it.
 *
 * The anvil stands on a block of dressed stone on its two by two subtiles:
 * a broad foot, a waisted neck, the body with its flat face, a heel with the
 * hardy and the pritchel holes through it, and the horn tapering off the
 * other end to a point -- in the metal it was cast from (`face`, `shade`),
 * taken toward the island's pale steel so that every metal sits with the
 * stone. Its block has a rune cut in its front, lit gold as a runestone's
 * are, and a little moss and grass at its foot; it lights no night.
 *
 * The kiln fills its two by two subtiles, drawn a little over them
 * (`KILN_K`) as the anvil is: a round drum of dressed stone on a mossy
 * plinth, a band of runes round its head rimmed in gold, and over that a
 * beehive dome of brick laid in courses closing to a short vent with a lipped
 * cap. A stoke porch under a barrel vault stands out of its front, an arched
 * mouth in dressed voussoirs with a gold keystone; sun panels are sunk in the
 * drum, a draught port low in its back and four spy holes in its dome, and
 * fired pots stand on the plinth. Cold, that is all it is. Lit, the mouth,
 * vent and port are a bed of embers breathing slowly and its runes and spy
 * holes warm; firing a load, the pots are gone into it and show against the
 * fire in the mouth, all of it is bright, its heart white-hot and its runes
 * gold even by day, and a flare, a tongue of flame and a few embers come out
 * of its vent. Its smoke comes out of the head of its vent (`KILN_VENT_UP`,
 * `KILN_VENT_BACK`, `Game.fires`) and its light from the middle of its block
 * (`Game.lights`); after dark it is laid as the smelter's is (`drawKilnNight`).
 */

/* ---- the kit's pieces ------------------------------------------------------- */

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const centre = (pts: readonly V3[]): V3 => mul(pts.reduce<V3>((m, p) => add(m, p), [0, 0, 0]), 1 / pts.length);
/** A ring of four corners round (cx, cy) at height z, `hx` across and `hy` deep either side. */
const rect = (cx: number, cy: number, hx: number, hy: number, z: number): V3[] => [[cx - hx, cy - hy, z], [cx + hx, cy - hy, z], [cx + hx, cy + hy, z], [cx - hx, cy + hy, z]];

/**
 * One side of a solid as it is painted: its corner at the left of its foot as
 * it is seen from outside, the way across it, the way up it with a unit of
 * that a unit of height, how wide and how tall it is, and which way it faces.
 */
interface Side { o: V3; a: V3; b: V3; w: number; h: number; n: V3; poly: V3[] }

/**
 * A solid of rings, one over the next from its foot to its top, each side
 * between two rings a face, and the last ring its top: a dressed block, a
 * tapering stack, a chamfer round a lip. `dress` says what is painted on
 * each side (band `k`, side `i` from the ring's first corner), and `top` on
 * its top.
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
      // Across it as it is read from outside, the way the island's projection has it (`plate`'s front).
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
  // Out of the solid: away from the ring before it.
  if (dot(n, sub(centre(last), centre(rings[rings.length - 2]))) < 0) n = mul(n, -1);
  const a = unit(sub(last[1], last[0]));
  faces.push({ pts: last.slice(), n, tone, crease: 0.45, frame: { o: centre(last), a, b: cross(n, a) }, ...(top ?? {}) });
  return faces;
}

/** The frame a side is painted in, for laying anything else in it later: its corner, across, up. */
const sideM = (e: Eye, s: { o: V3; a: V3; b: V3 }): DOMMatrix => {
  const [ox, oy] = proj(e, s.o), [ax, ay] = proj(e, s.a), [bx, by] = proj(e, s.b);
  return new DOMMatrix([ax, ay, bx, by, ox, oy]);
};

/** A solid in the model: its faces, the order it is laid in (more is later), and whether it is the piece itself (shaded after dark, clicked by). */
interface Part {
  faces?: Face[];
  draw?: (g: Ctx, e: Eye) => void;
  /** Where it stands, for laying flowers and grass in order round the solids. */
  x: number;
  y: number;
  /** Laid before everything: the ground it stands on. */
  first?: boolean;
  solid?: boolean;
  /** Laid in the order of the stack, foot first: a solid's place among the solids, whichever way it is seen. */
  tier?: number;
  /** Laid later or earlier than its tier says, as the eye sees it. */
  order?: (e: Eye) => number;
  reach?: V3[];
}

/** The parts in the order they are laid: the ground, then flora behind, the solids foot first, flora in front. */
function laid(parts: readonly Part[], e: Eye): Part[] {
  const ground = parts.filter((p) => p.first);
  const solids = parts.filter((p) => !p.first && p.tier !== undefined).sort((a, b) => (a.order?.(e) ?? a.tier ?? 0) - (b.order?.(e) ?? b.tier ?? 0));
  const near0 = (p: Part): number => p.x * e.toward[0] + p.y * e.toward[1];
  const loose = parts.filter((p) => !p.first && p.tier === undefined);
  return [...ground, ...loose.filter((p) => near0(p) < 0), ...solids, ...loose.filter((p) => near0(p) >= 0)];
}

/** What a model covers on the screen from its footprint's middle, in pixels at zoom one: every corner, the flora's heads, and room round it. */
function measure(parts: readonly Part[], e: Eye, extra: readonly V3[], pad: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p: V3): void => {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const p of parts) {
    for (const f of p.faces ?? []) for (const q of f.pts) take(q);
    for (const q of p.reach ?? []) take(q);
  }
  for (const q of extra) take(q);
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

/** The box round the solids alone, in pixels at zoom one, a pixel or two out: what it is clicked by. */
function hitOf(parts: readonly Part[], e: Eye): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) if (p.solid) for (const f of p.faces ?? []) for (const q of f.pts) {
    const [x, y] = proj(e, [q[0], q[1], Math.max(0, q[2])]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [Math.floor(x0 - 2), Math.floor(y0 - 2), Math.ceil(x1 + 2), Math.ceil(y1 + 2)];
}

/** A face's outline on the screen, as a path. */
const polyPath = (g: Ctx, e: Eye, pts: readonly V3[]): void => {
  g.beginPath();
  pts.forEach((p, i) => { const [x, y] = proj(e, p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
};
const seenFaces = (e: Eye, p: Part): Face[] => (p.faces ?? []).filter((f) => dot(f.n, e.toward) > 1e-6).map((f) => ({ ...f, pts: f.pts.map((q) => [q[0], q[1], Math.max(0, q[2])] as V3) }));

/**
 * The stone's skin on a side `w` across and `h` up, in its frame: flat
 * patches a step paler and a step greyer, grit thicker toward the foot, and a
 * few pits with a lit lip -- the runestones' skin at this size.
 */
function skin(g: Ctx, fill: RGB, w: number, h: number, seed: number, k = 1): void {
  const T = rand(seed);
  for (let i = 0; i < Math.round(w * h * 0.22 * k) + 2; i++) {
    g.beginPath();
    g.ellipse(T() * w, T() * h, 0.5 + T() * 1.4, 0.3 + T() * 0.8, (T() - 0.5) * 0.8, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.38) : css(mix(fill, hex('#9c94a4'), 0.32), 0.28);
    g.fill();
  }
  g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.32);
  for (let i = 0; i < Math.round(w * h * 0.6 * k); i++) {
    const z = Math.pow(T(), 1.5) * h, x = T() * w;
    g.fillRect(x, z, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
  }
  for (let i = 0; i < 2; i++) {
    const x = 0.5 + T() * Math.max(0.1, w - 1), z = 0.4 + T() * Math.max(0.1, h - 0.8), r = 0.1 + T() * 0.12;
    g.beginPath();
    g.ellipse(x, z, r * 1.3, r, 0, 0, TAU);
    g.fillStyle = css(mix(fill, hex('#5d5464'), 0.4), 0.5);
    g.fill();
  }
}

/**
 * Dressed stone laid in courses up a side: each course its own height, each
 * stone its own length and a hair its own tint, the joints cut in, and the
 * stones at each end a long and a short by turns, as quoins are.
 */
function ashlar(g: Ctx, fill: RGB, s: Side, seed: number, course: number, skip?: (x0: number, x1: number, z0: number, z1: number) => boolean): void {
  const T = rand(seed);
  let z = 0, row = 0;
  while (z < s.h - 0.25) {
    const h = Math.min(s.h - z, course * (0.86 + 0.28 * T()));
    // The width of the side at this height: a tapered one is narrower up it.
    let x = 0;
    const quoin = row % 2 ? 1.6 + 0.4 * T() : 3.0 + 0.5 * T();
    const stones: Array<[number, number]> = [[0, quoin]];
    x = quoin;
    while (x < s.w - 1.6) {
      const len = Math.min(s.w - x, 2.6 + T() * 3.2);
      stones.push([x, x + len]);
      x += len;
    }
    if (x < s.w) stones[stones.length - 1][1] = s.w + 1;
    stones.forEach(([a0, a1], j) => {
      if (skip?.(a0, a1, z, z + h)) return;
      const end = j === 0 || j === stones.length - 1;
      g.fillStyle = end ? css(mix(fill, [255, 250, 240], 0.2), 0.6)
        : T() < 0.5 ? css(mix(fill, [255, 250, 240], 0.1 + 0.12 * T()), 0.5) : css(mix(fill, hex('#9a8ea4'), 0.08 + 0.12 * T()), 0.45);
      g.fillRect(a0 + 0.14, z + 0.14, a1 - a0 - 0.28, h - 0.28);
      if (j > 0) cut(g, fill, 0.15, () => { g.beginPath(); g.moveTo(a0, z + 0.12); g.lineTo(a0, z + h - 0.12); });
    });
    z += h;
    row++;
    if (z < s.h - 0.2) cut(g, fill, 0.17, () => { g.beginPath(); g.moveTo(-1, z); g.lineTo(s.w + 1, z); });
  }
}

/**
 * Moss creeping up a side from its two corners, as it does up the rune
 * lantern's shaft (\`footMoss\` there): cushions run together, thickest at the
 * foot of each arris and thinning up it, `amount` of the way on, nought to one.
 */
function cornerMoss(g: Ctx, k: PaintCtx, s: Side, seed: number, amount: number): void {
  if (amount <= 0.05) return;
  const T = rand(seed);
  const tr = g.getTransform(), inv = k.base.inverse();
  const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
  const ps: Pad[] = [];
  for (const end of [0, 1]) {
    const x0 = end ? s.w : 0, dir = end ? -1 : 1;
    for (let j = 0; j < Math.round(4 + 6 * amount); j++) {
      const up = Math.pow(T(), 1.5);
      const x = x0 + dir * (0.2 + T() * (0.6 + 2.6 * amount) * (1 - 0.6 * up)), z = up * (s.h + 0.6) * Math.min(1, 0.5 + amount);
      const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x, z)));
      const r = (0.42 + 0.38 * T()) * (1 - 0.45 * up);
      ps.push([q.x, q.y, r * across, r * across * 0.8]);
    }
  }
  g.save();
  g.setTransform(k.base);
  drawPads(g, ps);
  g.restore();
}

/** A rune's groove cut, with a channel never too narrow on the screen to show dark either side of its gold. */
function cutRune(g: Ctx, fill: RGB, glyph: string, x: number, z: number, s: number, w: number): void {
  const tr = g.getTransform();
  const px = Math.max(1e-6, Math.min(Math.hypot(tr.a, tr.b), Math.hypot(tr.c, tr.d)));
  cut(g, fill, Math.max(w, 2.2 / px), () => glyphPath(g, glyph, x, z, s));
}

/** The ink round the solids, in pixels at zoom one, and its colour: as the rune lantern's. */
const INK = 0.75;
const INK_COLOUR = mix(STONE_INK, CREASE_INK, 0.4);

/** The light caught along the near arrises of a top (`litEdges` in `runelantern.ts`): a hair of pale stone, broken. */
function litEdges(g: Ctx, e: Eye, faces: readonly Face[], seed: number, colour = 'rgba(250, 242, 224, 0.55)'): void {
  const T = rand(seed);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = colour;
  for (const f of faces) {
    if (f.n[2] < 0.8 || dot(f.n, e.toward) <= 1e-6 || f.pts.length < 3) continue;
    const m0 = dot(centre(f.pts), e.toward);
    const scr = f.pts.map((q) => proj(e, q));
    g.save();
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    for (let i = 0; i < f.pts.length; i++) {
      const j = (i + 1) % f.pts.length;
      if (dot(mul(add(f.pts[i], f.pts[j]), 0.5), e.toward) <= m0 + 0.05) continue;
      const [ax, ay] = scr[i], [bx, by] = scr[j];
      for (let u = T() * 0.1; u < 1;) {
        const v = Math.min(1, u + 0.2 + 0.35 * T());
        g.lineWidth = 0.7 + 0.5 * T();
        g.beginPath();
        g.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
        g.lineTo(ax + (bx - ax) * v, ay + (by - ay) * v);
        g.stroke();
        u = v + 0.05 + 0.12 * T();
      }
    }
    g.restore();
  }
  g.restore();
}

/** Lay the parts, in order, onto a bake. */
function layParts(g: Ctx, e: Eye, order: readonly Part[], lit: ReadonlySet<Part>, edge?: string): void {
  for (const p of order) {
    if (p.draw) p.draw(g, e);
    else if (p.faces) {
      drawFaces(g, e, p.faces, INK, INK_COLOUR);
      if (lit.has(p)) litEdges(g, e, p.faces, p.faces.length * 7 + Math.round(p.x * 13 + (p.tier ?? 0) * 5), edge);
    }
  }
}

/** A picture the size of a bake, its transform set to the bake's. */
const sheetOf = (w: number, h: number, M: DOMMatrix): [HTMLCanvasElement, Ctx] => {
  const [c, g] = canvasOf(w, h);
  g.setTransform(M);
  return [c, g];
};

/** Take off a picture whatever of the parts drawn after `from` covers it: the solids in front of what it is laid on. */
function lessInFront(g: Ctx, e: Eye, order: readonly Part[], from: Part | null): void {
  let past = from === null;
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

/** A lit thing's light, as a picture laid where `box` says on the screen in pixels at zoom one from the footprint's middle. */
interface Lamp { canvas: HTMLCanvasElement; box: [number, number, number, number] }

/** A picture laid on the screen at a zoom, by its box. */
const lay = (ctx: Ctx, l: Lamp, sx: number, sy: number, zoom: number): void => {
  const [x, y, w, h] = l.box;
  ctx.drawImage(l.canvas, sx + x * zoom, sy + y * zoom, w * zoom, h * zoom);
};

/** A small picture over a box of the screen in pixels at zoom one, drawn in the bake's frame (`draw` in pixels at zoom one from the footprint's middle). */
function lamp(box: readonly [number, number, number, number], scale: number, draw: (h: Ctx) => void): Lamp {
  const [a, b, c, d] = [Math.floor(box[0] - 1), Math.floor(box[1] - 1), Math.ceil(box[2] + 1), Math.ceil(box[3] + 1)];
  const [cv, h] = canvasOf((c - a) * scale, (d - b) * scale);
  h.setTransform(scale, 0, 0, scale, -a * scale, -b * scale);
  draw(h);
  return { canvas: cv, box: [a, b, c - a, d - b] };
}

/** The box a set of model points covers on the screen, in pixels at zoom one. */
function boxOf(e: Eye, pts: readonly V3[], pad = 0): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/**
 * Several baked pictures laid into one, each at its own strength, so a frame
 * lays them with one draw: the fire, the runes and the flue of a smelter all
 * breathe together, so they are one picture.
 */
function composed(items: ReadonlyArray<{ c: HTMLCanvasElement; box: readonly number[]; a: number; op?: GlobalCompositeOperation }>, scale: number): Lamp | null {
  const live = items.filter((it) => it.a > 0.001);
  if (!live.length) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const { box } of live) { l = Math.min(l, box[0]); t = Math.min(t, box[1]); r = Math.max(r, box[0] + box[2]); b = Math.max(b, box[1] + box[3]); }
  const a0 = Math.floor(l), b0 = Math.floor(t), w = Math.ceil(r) - a0, h = Math.ceil(b) - b0;
  const [cv, g] = canvasOf(w * scale, h * scale);
  for (const it of live) {
    g.globalCompositeOperation = it.op ?? 'source-over';
    // Added light more than once over where it is stronger than one picture of it (\`GLOW_GAIN\`).
    for (let a = it.a; a > 0.001; a -= 1) {
      g.globalAlpha = Math.min(1, a);
      g.drawImage(it.c, (it.box[0] - a0) * scale, (it.box[1] - b0) * scale, it.box[2] * scale, it.box[3] * scale);
    }
  }
  return { canvas: cv, box: [a0, b0, w, h] };
}

/**
 * How much stronger than they are laid the glows after dark are baked: they
 * are laid in their own place among what is drawn, under the night's wash,
 * and turned up by as much as the wash will take off them there
 * (\`drawSmelterNight\`), which a picture laid at full strength could not be.
 */
const GLOW_GAIN = 2;
/** How much a glow is turned up to come out of a wash that takes \`over\` of it, nought to one: as far as it can go. */
const underWash = (over: number): number => Math.min(3, 1 / Math.max(1e-3, 1 - Math.max(0, over)));

/** How the bakes are kept: so many pixels of them, the least lately drawn let go first. */
const BAKED_BUDGET = 8e6;
class Bakes<B extends { canvas: HTMLCanvasElement; area: number }> {
  private kept = new Map<string, B>();
  private area = 0;
  get(key: string, make: () => B): B {
    let b = this.kept.get(key);
    if (b) {
      this.kept.delete(key);
      this.kept.set(key, b);
      return b;
    }
    b = make();
    this.kept.set(key, b);
    this.area += b.area;
    for (const [k, old] of this.kept) {
      if (this.area <= BAKED_BUDGET || k === key) break;
      this.kept.delete(k);
      this.area -= old.area;
    }
    return b;
  }
}

/**
 * Its shade on the ground, thrown away from the light toward the bottom right
 * of the screen as every piece's is: its footprint pushed that way, soft at
 * its edge in two passes.
 */
function groundShade(g: Ctx, e: Eye, foot: readonly V3[], dx: number, dy: number, soft = false): void {
  for (const [k, a] of (soft ? [[1.16, 0.05], [1.08, 0.06], [1.01, 0.07]] : [[1.12, 0.08], [1, 0.12]]) as Array<[number, number]>) {
    g.beginPath();
    foot.forEach((q, i) => { const [x, y] = proj(e, [q[0] * k, q[1] * k, 0]); if (i) g.lineTo(x + dx, y + dy); else g.moveTo(x + dx, y + dy); });
    g.closePath();
    g.fillStyle = `rgba(44, 74, 78, ${a})`;
    g.fill();
  }
}

/** The colour of night on stone that keeps some of it whatever light falls there, and the ink after dark (`runelantern.ts`). */
const NIGHT_STONE = 'rgb(46, 44, 72)';

/* ---- the smelter ------------------------------------------------------------ */

/** The furnace's stone: the runestones' cream taken a step warmer and rosier, as stone that has stood in heat; its shade a warm mauve-grey. */
const KILN_STONE: Tone = toneOf('#ecd6c0', '#a68f94');
/** The hearth slab under it a step cooler and darker, and the shoulder and stack a step dustier with the soot of it. */
const HEARTH: Tone = toneOf('#d9c8b5', '#978690');
const SHOULDER: Tone = toneOf('#d9c2ae', '#8e7a85');
/** The shoulder's front and back slopes a step lighter than its sides, so the hip reads as one roof and not two panels. */
const SHOULDER_END: Tone = toneOf('#eedecb', '#ab979e');
/** The band of runes a step cooler, as stone set back out of the sun is (the rune lantern's band). */
const RUNE_BAND: Tone = toneOf('#d8c5b2', '#968481');
/** The voussoirs round the mouth and the lintel over them: paler, finer stone, as the dressings round an opening are. */
const DRESSING: Tone = toneOf('#f3e2cc', '#b29da0');

/** Where its solids stand, in units: the hearth slab, the body, the band of runes, the shoulder, the stack and its cap. */
const SLAB_H = 1.7;
const BODY_TOP = 10.2;
const BAND_TOP = 12.9;
const SHOULDER_TOP = 15.3;
const STACK_TOP = 24.0;
const CAP_TOP = SMELTER_STACK_UP;
/** The body stands back from the middle of its footprint, the hearth in front of its mouth; the stack back from that again. */
const BODY_Y = -1.3;
/**
 * The plinth under the body, in line with it: the same margin out round it
 * on every side, the mouth's hearth on its front one -- its middle, and how
 * far it runs either way.
 */
const PLINTH_Y = BODY_Y;
const PLINTH_HX = 13.4;
const PLINTH_HY = 8.7;
/** Where the hearth before the mouth is on the plinth's top, toward its front from its middle. */
const HEARTH_AT = 7.8;
const STACK_Y = -SMELTER_STACK_BACK * UNITS_PER_TILE;
/** The mouth: half as wide as it is, how high its jambs stand before the arch springs, and how deep its ring of voussoirs. */
const MOUTH_W = 3.6;
const MOUTH_SPRING = 0.9;
/** How high the arch rises over its springing against how wide it is: a segmental arch, lower than round. */
const MOUTH_RISE = 0.72;
const RING = 1.55;
/** The bellows' port low in its back: how big, and how high up. */
const PORT_R = 0.95;
const PORT_Z = 2.3;
/**
 * The runes round its band, one to a side's half, in order round it, front
 * first; the one on the lintel over the mouth; and the sun in the panel sunk
 * in each of its sides. Staves and stars with no long slant to them, so a
 * lit one is never taken for a crack in hot stone.
 */
const BAND_RUNES = [['algiz', 'tiwaz'], ['dagaz'], ['star6', 'ingwaz'], ['diamondDot']];
const LINTEL_RUNE = 'ingwaz';
const PANEL_RUNE = 'sunDot';
/** How big a rune on the band is, in units from its middle to its top, and how wide its groove; one on the lintel; one in a side's panel. */
const RUNE_S = 1.2;
const RUNE_W = 0.42;
const LINTEL_S = 0.72;
const PANEL_S = 1.4;
/** The panel sunk in each side: half as wide as it is, its foot and the springing of its pointed head, how high the head rises, and the rune's height up it. */
const PANEL_HW = 2.2;
const PANEL_Z0 = 1.3;
const PANEL_Z1 = 5.6;
const PANEL_ARCH = 1.7;
const PANEL_RUNE_Z = 4.0;

/** A rune's lit groove: the runestones' gold and white, in the channel cut for it (the rune lantern's). */
const RUNE_INNER = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6));
const RUNE_MID = RUNE_GOLD;
const RUNE_CHANNEL = 'rgba(112, 84, 74, 0.9)';

/** How the mouth's fire is coloured from its heart out to its jambs, and what an ember in its bed is. */
const FIRE: Array<[number, string]> = [[0, '#fff7d6'], [0.22, '#ffdc86'], [0.5, '#ffa252'], [0.8, '#e0663c'], [1, '#97384a']];

/** How a smelter is drawn: alight or not, and working a charge. */
export interface SmelterLook {
  lit: boolean;
  working: boolean;
}

interface SmelterModel {
  parts: Part[];
  body: Part;
  /** The body's front, the hearth slab's top and front, and the lintel: where the mouth's light falls on its own stone. */
  front: Side;
  /** Its back, where the bellows' port is. */
  back: Side;
  warmOn: Face[];
  /** The band's four sides, as runes are laid in them: each its frame, its outline and its runes. */
  band: Array<{ s: Side; runes: Array<{ glyph: string; x: number; z: number }> }>;
  bandPart: Part;
  /** The panels sunk in its sides, each with its sun. */
  panels: Side[];
  lintel: { s: Side; part: Part };
  /** The flue on top of the cap, as an outline in the model. */
  flue: V3[];
  cap: Part;
  turf: V3[];
}

let smelterModel: SmelterModel | null = null;

/** The mouth's outline in its side's frame, drawn out by `d` all round: jambs up from its foot and a round arch over. */
function mouthPath(g: Ctx, cx: number, d: number, foot = -0.6): void {
  const r = MOUTH_W + d;
  g.beginPath();
  g.moveTo(cx - r, foot);
  g.lineTo(cx - r, MOUTH_SPRING);
  g.ellipse(cx, MOUTH_SPRING, r, MOUTH_W * MOUTH_RISE + d, 0, Math.PI, 0, true);
  g.lineTo(cx + r, foot);
  g.closePath();
}
/** The crown of the mouth's arch, up its side, and a point round its ring at angle `a` (nought at its right springing), `d` out from the mouth. */
const MOUTH_TOP = MOUTH_SPRING + MOUTH_W * MOUTH_RISE;
const archAt = (cx: number, a: number, d: number): Pt => [cx + Math.cos(a) * (MOUTH_W + d), MOUTH_SPRING + Math.sin(a) * (MOUTH_W * MOUTH_RISE + d)];

function smelterOf(): SmelterModel {
  if (smelterModel) return smelterModel;
  const seed = 7717;
  const parts: Part[] = [];

  /* -- the plinth it stands on, in line under the body, its corners mossed, the hearth before the mouth scorched and strewn with cinders -- */
  const slab = prism([rect(0, PLINTH_Y, PLINTH_HX, PLINTH_HY, -0.5), rect(0, PLINTH_Y, PLINTH_HX, PLINTH_HY, SLAB_H - 0.4), rect(0, PLINTH_Y, PLINTH_HX - 0.5, PLINTH_HY - 0.5, SLAB_H)], HEARTH,
    (k, i, s) => (k !== 0 ? { crease: 0.45 } : {
      paint: (g, kk) => {
        skin(g, kk.fill, s.w, s.h + 0.5, seed + 3 + i);
        // The moss creeping up its corners, most at the back and its shady left, least by the mouth.
        cornerMoss(g, kk, s, seed + 5 + i, [1, 0.75, 0.35, 0.95][i]);
      },
    }),
    {
      paint: (g, k) => {
        // Flagged: joints across it, cut; frame (0, 0) its middle, x across, y toward its front.
        const T = rand(seed + 11);
        for (const x of [-6.8, 6.9]) cut(g, k.fill, 0.18, () => { g.beginPath(); g.moveTo(x + (T() - 0.5), -PLINTH_HY); g.lineTo(x + (T() - 0.5), PLINTH_HY); });
        skin(g, k.fill, 26, 18, seed + 13, 0.6);
        // A scorch before the mouth, and ash and cinders raked out over it.
        const gr = g.createRadialGradient(0, HEARTH_AT - 0.3, 0, 0, HEARTH_AT - 0.3, 5.0);
        gr.addColorStop(0, 'rgba(92, 78, 92, 0.45)');
        gr.addColorStop(1, 'rgba(120, 104, 116, 0)');
        g.fillStyle = gr;
        g.fillRect(-6, HEARTH_AT - 2, 12, 4);
        for (let i = 0; i < 22; i++) {
          const x = (T() - 0.5) * 8.6, y = HEARTH_AT - 0.45 + T() * 0.8, r = 0.12 + T() * 0.18;
          g.fillStyle = T() < 0.6 ? 'rgba(168, 158, 166, 0.75)' : 'rgba(64, 54, 66, 0.8)';
          g.beginPath();
          g.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
          g.fill();
        }
      },
    });
  const slabPart: Part = { x: 0, y: PLINTH_Y, faces: slab, solid: true, tier: 0 };
  parts.push(slabPart);

  /* -- the body: dressed stone in courses, tapering a hair, the mouth in its front -- */
  let front: Side | null = null;
  let back: Side | null = null;
  const panels: Side[] = [];
  const bodyRings = [rect(0, BODY_Y, 12.2, 7.4, SLAB_H), rect(0, BODY_Y, 11.2, 6.6, BODY_TOP)];
  const mouthFoot = 0.0;
  const body = prism(bodyRings, KILN_STONE, (_k, i, s) => {
    if (i === 0) {
      back = s;
      // At its back, low, the round port the bellows blow through, in a ring of dressed stones.
      return {
        paint: (g, k) => {
          const fill = k.fill, px = s.w / 2;
          skin(g, fill, s.w, s.h, seed + 20);
          ashlar(g, fill, s, seed + 30, 2.25, (x0, x1, z0) => x1 > px - PORT_R - 1.6 && x0 < px + PORT_R + 1.6 && z0 < PORT_Z + PORT_R + 1.2);
          const dress = mix(fill, hex('#fbf0e2'), 0.62);
          g.beginPath();
          g.arc(px, PORT_Z, PORT_R + 1.25, 0, TAU);
          g.fillStyle = css(dress);
          g.fill();
          g.strokeStyle = css(mix(fill, STONE_INK, 0.55), 0.75);
          g.lineWidth = 0.2;
          g.stroke();
          for (let j = 0; j < 6; j++) {
            const a = (j / 6) * TAU + 0.3;
            cut(g, dress, 0.13, () => { g.beginPath(); g.moveTo(px + Math.cos(a) * PORT_R, PORT_Z + Math.sin(a) * PORT_R); g.lineTo(px + Math.cos(a) * (PORT_R + 1.25), PORT_Z + Math.sin(a) * (PORT_R + 1.25)); });
          }
          g.beginPath();
          g.arc(px, PORT_Z, PORT_R, 0, TAU);
          g.fillStyle = '#2a2230';
          g.fill();
          const sg = g.createRadialGradient(px, PORT_Z + 2.4, 0.3, px, PORT_Z + 2.4, 3.6);
          sg.addColorStop(0, 'rgba(86, 72, 90, 0.3)');
          sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
          g.fillStyle = sg;
          g.fillRect(px - 4, PORT_Z, 8, 7);
        },
      };
    }
    if (i !== 2) {
      // Each side a pointed panel sunk in it, the sun cut in that, so an end seen square on is no blank wall.
      panels.push(s);
      const px = s.w / 2;
      return {
        paint: (g, k) => {
          const fill = k.fill;
          skin(g, fill, s.w, s.h, seed + 20 + i);
          ashlar(g, fill, s, seed + 30 + i, 2.25, (x0, x1, z0) => x1 > px - PANEL_HW - 0.5 && x0 < px + PANEL_HW + 0.5 && z0 < PANEL_Z1 + PANEL_ARCH);
          panelArch(g, px, px, PANEL_HW + 0.45, PANEL_Z0 - 0.45, PANEL_Z1, PANEL_ARCH + 0.4, 0);
          g.fillStyle = css(mix(fill, hex('#fbf0e2'), 0.45));
          g.fill();
          panelArch(g, px, px, PANEL_HW, PANEL_Z0, PANEL_Z1, PANEL_ARCH, 0);
          g.fillStyle = css(mix(fill, hex('#9a90a6'), 0.34), 0.75);
          g.fill();
          cut(g, fill, 0.18, () => panelArch(g, px, px, PANEL_HW, PANEL_Z0, PANEL_Z1, PANEL_ARCH, 0));
          cutRune(g, mix(fill, hex('#9a90a6'), 0.34), PANEL_RUNE, px, PANEL_RUNE_Z, PANEL_S, 0.44);
        },
      };
    }
    front = s;
    const cx = s.w / 2;
    return {
      paint: (g, k) => {
        const fill = k.fill;
        skin(g, fill, s.w, s.h, seed + 22);
        // The courses, but not through the voussoirs and jambs round the mouth.
        ashlar(g, fill, s, seed + 32, 2.25, (x0, x1, z0) => x1 > cx - MOUTH_W - RING - 0.1 && x0 < cx + MOUTH_W + RING + 0.1 && z0 < MOUTH_TOP + RING - 0.2);
        // Soot up the face over the mouth.
        const sg = g.createRadialGradient(cx, MOUTH_TOP + 2.0, 0.5, cx, MOUTH_TOP + 2.0, 6.5);
        sg.addColorStop(0, 'rgba(86, 72, 90, 0.38)');
        sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
        g.fillStyle = sg;
        g.fillRect(cx - 8, MOUTH_SPRING, 16, 12);
        // The dressings: jamb stones and voussoirs, paler, round the mouth.
        const dress = mix(fill, hex('#fbf0e2'), 0.62);
        mouthPath(g, cx, RING, mouthFoot);
        g.fillStyle = css(dress);
        g.fill();
        g.strokeStyle = css(mix(fill, STONE_INK, 0.55), 0.75);
        g.lineWidth = 0.2;
        g.stroke();
        // The keystone, standing a little proud of the ring.
        const kz = MOUTH_TOP;
        g.beginPath();
        g.moveTo(cx - 0.62, kz - 0.1);
        g.lineTo(cx - 0.9, kz + RING + 0.3);
        g.lineTo(cx + 0.9, kz + RING + 0.3);
        g.lineTo(cx + 0.62, kz - 0.1);
        g.closePath();
        g.fillStyle = css(mix(dress, [255, 250, 240], 0.25));
        g.fill();
        g.strokeStyle = css(mix(fill, CREASE_INK, 0.55), 0.7);
        g.stroke();
        // The joints between the voussoirs, and between the jamb stones.
        for (let j = 1; j < 9; j++) {
          const a = Math.PI - (j / 9) * Math.PI;
          if (Math.abs(a - Math.PI / 2) < 0.2) continue;
          const [ax0, az0] = archAt(cx, a, 0), [ax1, az1] = archAt(cx, a, RING);
          cut(g, dress, 0.13, () => { g.beginPath(); g.moveTo(ax0, az0); g.lineTo(ax1, az1); });
        }
        for (const side of [-1, 1]) for (const [z, wide] of [[MOUTH_SPRING * 0.5, 1], [MOUTH_SPRING, 0]] as Array<[number, number]>) {
          cut(g, dress, 0.13, () => { g.beginPath(); g.moveTo(cx + side * MOUTH_W, z); g.lineTo(cx + side * (MOUTH_W + RING + (wide ? 0.5 : 0)), z); });
        }
        // The jambs' long stones run out into the courses a little, as quoins.
        for (const side of [-1, 1]) for (const [z0, z1] of [[mouthFoot, MOUTH_SPRING * 0.5]]) {
          g.fillStyle = css(dress);
          const x0 = cx + side * (MOUTH_W + RING), x1 = x0 + side * 0.5;
          g.fillRect(Math.min(x0, x1), z0 + 0.06, 0.5, z1 - z0 - 0.12);
          cut(g, dress, 0.12, () => { g.beginPath(); g.moveTo(x1, z0 + 0.05); g.lineTo(x1, z1 - 0.05); });
        }
        // The mouth itself: dark, the floor of it a bed of ash, and the jamb the eye sees into a step lighter.
        mouthPath(g, cx, 0, mouthFoot);
        const ig = g.createLinearGradient(0, mouthFoot, 0, MOUTH_TOP);
        ig.addColorStop(0, '#4a3f4c');
        ig.addColorStop(1, '#251e2c');
        g.fillStyle = ig;
        g.fill();
        g.save();
        mouthPath(g, cx, 0, mouthFoot);
        g.clip();
        const look = dot(k.e.toward, s.a) / Math.max(1e-6, Math.hypot(k.e.toward[0], k.e.toward[1]));
        const jx = look >= 0 ? cx - MOUTH_W : cx + MOUTH_W, dir = look >= 0 ? 1 : -1;
        g.beginPath();
        g.moveTo(jx, mouthFoot - 1);
        g.lineTo(jx, MOUTH_TOP);
        g.lineTo(jx + dir * 0.9 * Math.abs(look), MOUTH_TOP);
        g.lineTo(jx + dir * 0.9 * Math.abs(look), mouthFoot - 1);
        g.closePath();
        g.fillStyle = css(mix(fill, hex('#5a4e5e'), 0.62), 0.9);
        g.fill();
        g.fillStyle = 'rgba(132, 120, 128, 0.85)';
        g.fillRect(cx - MOUTH_W, mouthFoot - 1, 2 * MOUTH_W, 1.55);
        const A = rand(seed + 41);
        for (let j = 0; j < 9; j++) {
          g.fillStyle = A() < 0.5 ? 'rgba(66, 56, 66, 0.8)' : 'rgba(176, 166, 170, 0.8)';
          g.beginPath();
          g.ellipse(cx + (A() - 0.5) * 2 * (MOUTH_W - 0.5), 0.15 + A() * 0.35, 0.3 + A() * 0.3, 0.16, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      },
    };
  });
  const bodyPart: Part = { x: 0, y: BODY_Y, faces: body, solid: true, tier: 1 };
  parts.push(bodyPart);
  const frontSide = front as unknown as Side;

  /* -- the lintel over the mouth: a stone laid flush on the face and standing out of it, the torch cut in it -- */
  const yAt = (z: number): number => BODY_Y + 7.4 - ((z - SLAB_H) / (BODY_TOP - SLAB_H)) * 0.8;
  const l0 = SLAB_H + MOUTH_TOP + RING + 0.35, l1 = l0 + 1.75, LH = 5.6, OUT = 0.6;
  const lring = (z: number, hx: number, out: number): V3[] => [[-hx, yAt(z), z], [hx, yAt(z), z], [hx, yAt(z) + out, z], [-hx, yAt(z) + out, z]];
  let lintelSide: Side | null = null;
  const lintel = prism([lring(l0, LH, OUT), lring(l1 - 0.3, LH, OUT), lring(l1, LH - 0.25, OUT - 0.3)], DRESSING, (k, i, s) => {
    if (k !== 0 || i !== 2) return { crease: 0.5 };
    lintelSide = s;
    return {
      crease: 0.5,
      paint: (g, kk) => {
        skin(g, kk.fill, s.w, s.h, seed + 51, 1.4);
        // A margin drafted round it, the torch in the middle, a drilled dot either side.
        cut(g, kk.fill, 0.12, () => { g.beginPath(); g.rect(0.45, 0.32, s.w - 0.9, s.h - 0.62); });
        cutRune(g, kk.fill, LINTEL_RUNE, s.w / 2, s.h / 2, LINTEL_S, 0.36);
        for (const x of [s.w / 2 - 2.1, s.w / 2 + 2.1]) cut(g, kk.fill, 0.24, () => { g.beginPath(); g.moveTo(x, s.h / 2 + 0.03); g.lineTo(x, s.h / 2 - 0.03); });
        // Sooted from under.
        const sg = g.createLinearGradient(0, 0, 0, s.h);
        sg.addColorStop(0, 'rgba(86, 72, 90, 0.3)');
        sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
        g.fillStyle = sg;
        g.fillRect(0, 0, s.w, s.h);
      },
    };
  });
  const lintelPart: Part = {
    x: 0, y: yAt(l0) + OUT, faces: lintel, solid: true, tier: 1.5,
    // Over the body where its front is seen; under it, and hidden by it, where not.
    order: (e) => (dot(frontSide.n, e.toward) > 0 ? 1.5 : 0.5),
  };
  parts.push(lintelPart);

  /* -- the band of runes: a course standing a little proud, runes round all four sides -- */
  const bandSides: Array<{ s: Side; runes: Array<{ glyph: string; x: number; z: number }> }> = [];
  const bandOf = (i: number): number => [2, 1, 0, 3].indexOf(i);
  const band = prism([rect(0, BODY_Y, 11.6, 7.0, BODY_TOP), rect(0, BODY_Y, 11.6, 7.0, BAND_TOP - 0.35), rect(0, BODY_Y, 11.2, 6.6, BAND_TOP)], RUNE_BAND, (k, i, s) => {
    if (k !== 0) return { crease: 0.5 };
    // Runes in order round it: front, right, back, left.
    const which = bandOf(i);
    const glyphs = BAND_RUNES[which];
    const runes = glyphs.map((glyph, j) => ({ glyph, x: glyphs.length === 1 ? s.w / 2 : s.w * (j === 0 ? 0.24 : 0.76), z: s.h / 2 }));
    bandSides[which] = { s, runes };
    return {
      paint: (g, kk) => {
        const fill = kk.fill;
        skin(g, fill, s.w, s.h, seed + 60 + i);
        // A rule cut along its foot and its head, and a drilled dot either side of each rune.
        for (const z of [0.42, s.h - 0.38]) cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(0.3, z); g.lineTo(s.w - 0.3, z); });
        for (const r of runes) {
          cutRune(g, fill, r.glyph, r.x, r.z, RUNE_S, RUNE_W);
          for (const dx of [-1.55, 1.55]) cut(g, fill, 0.24, () => { g.beginPath(); g.moveTo(r.x + dx, r.z + 0.03); g.lineTo(r.x + dx, r.z - 0.03); });
        }
        // The shoulder's shadow across its head.
        g.fillStyle = 'rgba(90, 82, 102, 0.16)';
        g.fillRect(-1, s.h - 0.7, s.w + 2, 1);
      },
    };
  });
  const bandPart: Part = { x: 0, y: BODY_Y, faces: band, solid: true, tier: 2 };
  parts.push(bandPart);

  /* -- the shoulder: hipped stone up from the band to the foot of the stack, sooted toward it -- */
  // Up to the stack's own foot, so the four slopes meet it along their hips and leave no ledge.
  const shoulder = prism([rect(0, BODY_Y, 11.0, 6.4, BAND_TOP), rect(0, STACK_Y, 5.2, 4.2, SHOULDER_TOP)], SHOULDER, (_k, i, s) => ({
    crease: 0.7,
    tone: i === 0 || i === 2 ? SHOULDER_END : SHOULDER,
    paint: (g, k) => {
      skin(g, k.fill, s.w, s.h * 4, seed + 70 + i);
      // Laid in two long courses up the slope, their joints cut fine, so it reads as one roof and not as walling.
      const T = rand(seed + 75 + i);
      cut(g, k.fill, 0.1, () => { g.beginPath(); g.moveTo(-2, s.h * 0.48); g.lineTo(s.w + 2, s.h * 0.48); });
      for (let j = 0; j < 4; j++) {
        const x = 2 + T() * (s.w - 4), z = T() < 0.5 ? 0 : s.h * 0.48;
        cut(g, k.fill, 0.1, () => { g.beginPath(); g.moveTo(x, z + 0.05); g.lineTo(x + 0.2, z + s.h * 0.46); });
      }
      const sg = g.createLinearGradient(0, 0, 0, s.h);
      sg.addColorStop(0, 'rgba(86, 72, 90, 0)');
      sg.addColorStop(1, 'rgba(86, 72, 90, 0.3)');
      g.fillStyle = sg;
      g.fillRect(-2, 0, s.w + 4, s.h);
    },
  }), { crease: 0.4 });
  const shoulderPart: Part = { x: 0, y: STACK_Y, faces: shoulder, solid: true, tier: 3 };
  parts.push(shoulderPart);

  /* -- the stack: tapering, laid in shorter courses, darker with soot toward its head -- */
  const stack = prism([rect(0, STACK_Y, 5.2, 4.2, SHOULDER_TOP), rect(0, STACK_Y, 4.0, 3.3, STACK_TOP)], KILN_STONE, (_k, i, s) => ({
    paint: (g, k) => {
      skin(g, k.fill, s.w, s.h, seed + 80 + i, 1.3);
      ashlar(g, k.fill, s, seed + 85 + i, 1.65);
      const sg = g.createLinearGradient(0, 0, 0, s.h);
      sg.addColorStop(0, 'rgba(86, 72, 90, 0)');
      sg.addColorStop(0.55, 'rgba(86, 72, 90, 0.08)');
      sg.addColorStop(1, 'rgba(70, 58, 78, 0.42)');
      g.fillStyle = sg;
      g.fillRect(-1, 0, s.w + 2, s.h);
    },
  }));
  const stackPart: Part = { x: 0, y: STACK_Y, faces: stack, solid: true, tier: 4 };
  parts.push(stackPart);

  /* -- the cap: a lip round the head of the stack, the flue open in its top -- */
  const flueHx = 2.2, flueHy = 1.75;
  const flue = rect(0, STACK_Y, flueHx, flueHy, CAP_TOP);
  const cap = prism([rect(0, STACK_Y, 4.7, 4.0, STACK_TOP - 0.2), rect(0, STACK_Y, 4.7, 4.0, CAP_TOP - 0.4), rect(0, STACK_Y, 4.3, 3.6, CAP_TOP)], DRESSING, (_k, i, s) => ({
    crease: 0.5,
    paint: (g, k) => {
      const sg = g.createLinearGradient(0, 0, 0, s.h);
      sg.addColorStop(0, 'rgba(70, 58, 78, 0.3)');
      sg.addColorStop(1, 'rgba(70, 58, 78, 0.12)');
      g.fillStyle = sg;
      g.fillRect(-1, 0, s.w + 2, s.h);
      skin(g, k.fill, s.w, s.h, seed + 90 + i, 2);
    },
  }), {
    paint: (g, k) => {
      // The flue: its dark open in the top, a lit lip round its near edge, and the soot about it.
      g.fillStyle = 'rgba(70, 58, 78, 0.28)';
      g.fillRect(-flueHx - 0.9, -flueHy - 0.9, 2 * flueHx + 1.8, 2 * flueHy + 1.8);
      g.fillStyle = '#2a2230';
      g.fillRect(-flueHx, -flueHy, 2 * flueHx, 2 * flueHy);
      g.strokeStyle = css(mix(k.fill, CREASE_INK, 0.7));
      g.lineWidth = 0.18;
      g.strokeRect(-flueHx, -flueHy, 2 * flueHx, 2 * flueHy);
    },
  });
  const capPart: Part = { x: 0, y: STACK_Y, faces: cap, solid: true, tier: 5 };
  parts.push(capPart);

  /* -- a few tufts of grass at the slab's corners, kept back from its heat -- */
  for (const [x, y, sd] of [[-15.2, 6.8, 1], [15.0, 7.6, 2], [-15.0, -10.4, 3], [12.6, -11.0, 4], [8.0, 9.6, 5], [-8.4, 9.2, 6]] as Array<[number, number, number]>) {
    parts.push({ x, y, reach: [[x, y, 4]], draw: (g, e) => { const [px, py] = proj(e, [x, y, 0]); grassTuft(g, px, py, seed + sd * 31, 0.5); } });
  }

  const turf: V3[] = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU, r = 1 + 0.06 * Math.sin(i * 2.7);
    return [Math.cos(a) * 17.0 * r, BODY_Y * 0.5 + Math.sin(a) * 12.2 * r, 0] as V3;
  });
  const lintelS = lintelSide as unknown as Side;
  const warmOn = [...slab.filter((f) => f.n[2] > 0.5 || f.n[1] > 0.5), ...body.filter((f) => f.n[1] > 0.5), ...lintel];
  smelterModel = { parts, body: bodyPart, front: frontSide, back: back as unknown as Side, warmOn, band: bandSides, bandPart, panels, lintel: { s: lintelS, part: lintelPart }, flue, cap: capPart, turf };
  return smelterModel;
}

/** The light in a smelter's mouth and flue, its runes', and its own front's after dark: everything that is laid over its bake as it burns. */
interface SmelterBake {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  bounds: [number, number, number, number];
  hit: [number, number, number, number];
  /** The fire in the mouth, the flue and the bellows' port, laid in one: they breathe together. */
  fire: Lamp | null;
  /** The runes' lit grooves, in one: soft while it is banked, all lit while it works. */
  runes: Lamp | null;
  /** The warmth of it on its own stone -- the mouth's light on its hearth and dressings, the runes' glow round them -- as colour by day and light after dark. */
  warm: Lamp | null;
  /** The heart of the fire, and a white-gold flare at the flue's mouth, laid on as light while it works. */
  heart: Lamp | null;
  flare: Lamp;
  /** After dark, over the night: the runes, the mouth and the flue and a bloom of heat round them, added as light (\`drawSmelterNight\`). */
  glow: Lamp | null;
  /** Its stone in the night's colour, laid over it after dark so its own light does not lift it to white. */
  shade: HTMLCanvasElement;
  /** The middle of the flue, on the screen at zoom one from the footprint's middle. */
  flueAt: Pt;
  /** Pixels it keeps, all its pictures together. */
  area: number;
}

const smelterBakes = new Bakes<SmelterBake>();

/** How square on the eye must see a side for its runes' light to be laid, and how much more for all of it (`runelantern.ts`). */
const GLOW_SEEN = 0.3;
const GLOW_FULL = 0.3;

function bakeSmelter(rotation: number, scale: number): SmelterBake {
  const m = smelterOf();
  const e = eyeOf(0, rotation);
  const [x0, y0, x1, y1] = measure(m.parts, e, m.turf, 6);
  const W = (x1 - x0) * scale, H = (y1 - y0) * scale;
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  const [canvas, g] = sheetOf(W, H, M0);
  const order = laid(m.parts, e);

  /* -- its shadow and the beaten ground round its slab -- */
  {
    polyPath(g, e, m.turf);
    g.fillStyle = 'rgba(150, 138, 120, 0.12)';
    g.fill();
    // Close under its plinth, soft, and only a little way off toward the bottom right: no slab of shade beside it.
    groundShade(g, e, rect(0, PLINTH_Y, PLINTH_HX, PLINTH_HY, 0), 2, 1, true);
  }
  layParts(g, e, order, new Set([m.parts[0], m.bandPart, m.cap, m.lintel.part]));

  /* -- the night it keeps: its solids whole in the night's colour, less what grows in front -- */
  const [shade, sg] = sheetOf(W, H, M0);
  sg.lineJoin = 'round';
  for (const p of order) {
    if (p.solid) {
      sg.globalCompositeOperation = 'source-over';
      sg.fillStyle = sg.strokeStyle = NIGHT_STONE;
      sg.lineWidth = INK * 2;
      for (const f of seenFaces(e, p)) { polyPath(sg, e, f.pts); sg.fill(); sg.stroke(); }
    } else if (p.draw) {
      sg.globalCompositeOperation = 'destination-out';
      p.draw(sg, e);
    }
  }
  sg.globalCompositeOperation = 'source-over';

  /* -- the mouth alight: the fire in it, its heart, and its light on its own hearth and dressings -- */
  const fs = m.front;
  // Not seen all but edge on, where the fire would be a sliver down the body's corner.
  const seesFront = dot(fs.n, e.toward) / Math.hypot(...e.toward) > 0.12;
  let mouth: Lamp | null = null, heart: Lamp | null = null, spill: Lamp | null = null, mouthAt: Pt | null = null;
  if (seesFront) {
    const M = sideM(e, fs);
    const cx = fs.w / 2;
    const corners: V3[] = [];
    for (const [x, z] of [[cx - MOUTH_W, 0], [cx + MOUTH_W, 0], [cx + MOUTH_W, MOUTH_TOP], [cx - MOUTH_W, MOUTH_TOP]]) corners.push(at(fs.o, [x, fs.a], [z, fs.b]));
    const box = boxOf(e, corners, 1);
    const inMouth = (h: Ctx): void => {
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      mouthPath(h, cx, 0, 0);
      h.clip();
    };
    mouth = lamp(box, scale, (h) => {
      h.save();
      inMouth(h);
      // The fire: lit from its heart low in the mouth out to ember at the jambs and the crown of the arch.
      const gr = h.createRadialGradient(cx, 0.4, 0.2, cx, 0.9, MOUTH_W * 1.05);
      for (const [k, c] of FIRE) gr.addColorStop(k, c);
      h.fillStyle = gr;
      h.fillRect(cx - MOUTH_W - 1, -1, 2 * MOUTH_W + 2, MOUTH_TOP + 2);
      // Tongues of flame up out of the bed, and the bed of embers.
      const T = rand(911);
      for (let j = 0; j < 4; j++) {
        const fx = cx + (j - 1.5) * 1.6 + (T() - 0.5) * 0.4, top = 1.7 + T() * 1.3, wd = 0.62 + T() * 0.35;
        h.beginPath();
        h.moveTo(fx - wd, 0.4);
        h.quadraticCurveTo(fx - wd * 0.9, top * 0.55, fx + (T() - 0.5) * 0.6, top);
        h.quadraticCurveTo(fx + wd * 0.9, top * 0.55, fx + wd, 0.4);
        h.closePath();
        h.fillStyle = 'rgba(255, 236, 170, 0.55)';
        h.fill();
      }
      for (let j = 0; j < 14; j++) {
        h.beginPath();
        h.ellipse(cx + (T() - 0.5) * 2 * (MOUTH_W - 0.4), 0.25 + T() * 0.55, 0.28 + T() * 0.3, 0.17, 0, 0, TAU);
        h.fillStyle = T() < 0.5 ? 'rgba(255, 244, 196, 0.95)' : 'rgba(234, 110, 60, 0.95)';
        h.fill();
      }
      h.restore();
    });
    heart = lamp(box, scale, (h) => {
      h.save();
      inMouth(h);
      const gr = h.createRadialGradient(cx, 0.8, 0, cx, 0.8, MOUTH_W * 1.25);
      gr.addColorStop(0, 'rgba(255, 236, 190, 0.9)');
      gr.addColorStop(0.5, 'rgba(255, 170, 90, 0.4)');
      gr.addColorStop(1, 'rgba(255, 140, 70, 0)');
      h.fillStyle = gr;
      h.fillRect(cx - MOUTH_W - 1, -1, 2 * MOUTH_W + 2, MOUTH_TOP + 2);
      h.restore();
    });
    // Its light out over its own hearth and up its dressings and lintel, warmest at the mouth.
    const foot = at(fs.o, [cx, fs.a], [0.4, fs.b]);
    mouthAt = proj(e, foot);
    const reach = 13;
    const sbox = boxOf(e, [...m.warmOn.flatMap((f) => f.pts)], 1);
    spill = lamp([Math.max(sbox[0], mouthAt[0] - reach * 1.6), Math.max(sbox[1], mouthAt[1] - reach * 1.4), Math.min(sbox[2], mouthAt[0] + reach * 1.6), Math.min(sbox[3], mouthAt[1] + reach * 0.9)], scale, (h) => {
      h.save();
      h.beginPath();
      for (const f of m.warmOn) {
        if (dot(f.n, e.toward) <= 1e-6) continue;
        const pts = f.pts.map((q) => proj(e, [q[0], q[1], Math.max(0, q[2])]));
        pts.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
        h.closePath();
      }
      h.clip();
      h.translate(mouthAt![0], mouthAt![1]);
      h.scale(1.45, 1);
      const gr = h.createRadialGradient(0, 0, 0, 0, 0, reach);
      gr.addColorStop(0, 'rgba(255, 196, 120, 0.85)');
      gr.addColorStop(0.35, 'rgba(255, 160, 96, 0.42)');
      gr.addColorStop(1, 'rgba(255, 150, 90, 0)');
      h.fillStyle = gr;
      h.fillRect(-reach, -reach, 2 * reach, 2 * reach);
      h.restore();
      // Not in the mouth itself, which is lit on its own, nor on anything standing in front of it.
      h.save();
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      mouthPath(h, cx, 0, 0);
      h.globalCompositeOperation = 'destination-out';
      h.fill();
      h.restore();
    });
    for (const l of [mouth, heart, spill]) {
      const lg = l.canvas.getContext('2d') as Ctx;
      lg.setTransform(scale, 0, 0, scale, -l.box[0] * scale, -l.box[1] * scale);
      lessInFront(lg, e, order, m.lintel.part.order!(e) > 1 ? m.lintel.part : m.body);
    }
  }

  /* -- the bellows' port alight, where the back is seen -- */
  let port: Lamp | null = null;
  if (dot(m.back.n, e.toward) > 1e-6) {
    const bs = m.back, M = sideM(e, bs), px = bs.w / 2;
    const corners: V3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at(bs.o, [px + u * PORT_R, bs.a], [PORT_Z + v * PORT_R, bs.b]));
    port = lamp(boxOf(e, corners, 1), scale, (h) => {
      h.save();
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      h.beginPath();
      h.arc(px, PORT_Z, PORT_R, 0, TAU);
      const gr = h.createRadialGradient(px, PORT_Z - 0.2, 0, px, PORT_Z, PORT_R);
      gr.addColorStop(0, '#fff0c0');
      gr.addColorStop(0.45, '#ffb860');
      gr.addColorStop(1, '#c4503e');
      h.fillStyle = gr;
      h.fill();
      h.restore();
    });
    const lg = port.canvas.getContext('2d') as Ctx;
    lg.setTransform(scale, 0, 0, scale, -port.box[0] * scale, -port.box[1] * scale);
    lessInFront(lg, e, order, m.body);
  }

  /* -- the flue alight -- */
  const flueBox = boxOf(e, m.flue, 2);
  const flue = lamp(flueBox, scale, (h) => {
    polyPath(h, e, m.flue);
    const [fx, fy] = proj(e, centre(m.flue));
    const gr = h.createRadialGradient(fx, fy, 0, fx, fy, Math.max(flueBox[2] - flueBox[0], flueBox[3] - flueBox[1]) * 0.55);
    gr.addColorStop(0, '#fff2c6');
    gr.addColorStop(0.4, '#ffbd6a');
    gr.addColorStop(1, '#c4503e');
    h.fillStyle = gr;
    h.fill();
  });
  const flueAt = proj(e, centre(m.flue));

  /* -- the runes' light, on the sides of the band and the panels the eye sees, and the rune on the lintel -- */
  const runes: Array<{ gl: Glow; seen: number }> = [];
  const keepTo = (c: HTMLCanvasElement, box: readonly number[], face: readonly V3[], from: Part): void => {
    const h = c.getContext('2d') as Ctx;
    h.setTransform(scale, 0, 0, scale, -box[0] * scale, -box[1] * scale);
    h.globalCompositeOperation = 'destination-in';
    polyPath(h, e, face);
    h.fill();
    h.globalCompositeOperation = 'source-over';
    lessInFront(h, e, order, from);
  };
  const lay3 = (s: Side, rs: Array<{ glyph: string; x: number; z: number }>, size: number, w: number, from: Part, i0: number): void => {
    const cos = dot(s.n, e.toward) / Math.hypot(...e.toward);
    if (cos < GLOW_SEEN) return;
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const ease = fade * fade * (3 - 2 * fade);
    const M = sideM(e, s);
    rs.forEach((r, j) => {
      const spec = { glyph: r.glyph, x: r.x, z: r.z, s: size, i: i0 + j, w: Math.max(w, 1.45 / scale) };
      const gl = bakeRune(M, { ...spec, inner: RUNE_INNER, mid: RUNE_MID, edge: RUNE_CHANNEL }, scale);
      for (const c of [gl.core, gl.halo, gl.dusk]) keepTo(c, gl.box, s.poly, from);
      runes.push({ gl, seen: ease });
    });
  };
  m.band.forEach((b, j) => lay3(b.s, b.runes, RUNE_S, RUNE_W, m.bandPart, j * 2));
  if (m.lintel.part.order!(e) > 1) lay3(m.lintel.s, [{ glyph: LINTEL_RUNE, x: m.lintel.s.w / 2, z: m.lintel.s.h / 2 }], LINTEL_S, 0.38, m.lintel.part, 9);
  m.panels.forEach((ps, j) => lay3(ps, [{ glyph: PANEL_RUNE, x: ps.w / 2, z: PANEL_RUNE_Z }], PANEL_S, 0.44, m.body, 10 + j));

  /* -- a bloom of heat round the mouth and the flue, and a flare at the flue's mouth -- */
  const bloom = (at: Pt, r: number, c0: string, c1: string): Lamp => lamp([at[0] - r, at[1] - r, at[0] + r, at[1] + r], scale, (h) => {
    const gr = h.createRadialGradient(at[0], at[1], 0, at[0], at[1], r);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.45, c1);
    gr.addColorStop(1, 'rgba(255, 150, 80, 0)');
    h.fillStyle = gr;
    h.fillRect(at[0] - r, at[1] - r, 2 * r, 2 * r);
  });
  const blooms = [bloom([flueAt[0], flueAt[1] - 2], 10, 'rgba(255, 196, 120, 1)', 'rgba(255, 150, 80, 0.35)'), ...(mouthAt ? [bloom([mouthAt[0], mouthAt[1] - 5], 15, 'rgba(255, 196, 120, 1)', 'rgba(255, 150, 80, 0.35)')] : [])];
  const flare = bloom([flueAt[0], flueAt[1] - 2], 9, 'rgba(255, 252, 232, 1)', 'rgba(255, 214, 140, 0.55)');

  /* -- laid together, each set as a frame lays it -- */
  const lit = [mouth, flue, port].filter((l): l is Lamp => !!l);
  const fire = composed(lit.map((l) => ({ c: l.canvas, box: l.box, a: 1 })), scale);
  const runeLamp = composed(runes.map(({ gl, seen }) => ({ c: gl.core, box: gl.box, a: seen })), scale);
  const warm = composed([...(spill ? [{ c: spill.canvas, box: spill.box, a: 1 }] : []), ...runes.map(({ gl, seen }) => ({ c: gl.halo, box: gl.box, a: seen * gl.square * 0.35 }))], scale);
  const glow = composed([
    // The runes in their lit grooves alone, no haze round them, so each keeps its shape against the dark.
    ...blooms.map((l) => ({ c: l.canvas, box: l.box, a: 0.3 * GLOW_GAIN, op: 'lighter' as const })),
    ...lit.map((l) => ({ c: l.canvas, box: l.box, a: 0.55 * GLOW_GAIN, op: 'lighter' as const })),
    ...runes.map(({ gl, seen }) => ({ c: gl.core, box: gl.box, a: seen * 0.35 * GLOW_GAIN, op: 'lighter' as const })),
  ], scale);

  return {
    canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hit: hitOf(m.parts, e),
    fire, runes: runeLamp, warm, heart, flare, glow, shade, flueAt,
    area: [canvas, shade, fire?.canvas, runeLamp?.canvas, warm?.canvas, heart?.canvas, flare.canvas, glow?.canvas].reduce((n, c) => n + (c ? c.width * c.height : 0), 0),
  };
}

function smelterBaked(rotation: number, zoom: number): SmelterBake {
  const scale = scaleFor(zoom);
  const rot = ((rotation % 8) + 8) % 8;
  return smelterBakes.get(`${rot}|${scale}`, () => bakeSmelter(rot, scale));
}

/** How hot it is drawn: nothing cold, more working a charge than banked and burning. */
const heatOf = (look: SmelterLook): number => (look.lit ? (look.working ? 1 : 0.6) : 0);
/**
 * How far into its breath the fire is at \`t\`, nought to one, with a flicker
 * over it: a slow breath banked, twice as quick working a charge, and the
 * flicker quicker and deeper with it.
 */
const fireBreath = (t: number, working: boolean): number => {
  const p = 0.5 + 0.5 * Math.sin((t / (working ? 1.1 : 2.6)) * TAU);
  const f = 0.5 + 0.5 * (0.6 * Math.sin(t * (working ? 15.1 : 11.3)) + 0.4 * Math.sin(t * 6.7 + 1.3));
  return Math.max(0, Math.min(1, (working ? 0.6 : 0.75) * p + (working ? 0.4 : 0.25) * f));
};

/**
 * Draw a smelter whose footprint's middle is at (sx, sy) on the screen, from
 * viewpoint \`rotation\`, at \`t\` seconds, under a night \`night\` dark: its bake,
 * and alight the fire in its mouth and flue, its runes and its light on its
 * own stone; and unless \`live\` is false, its flare and sparks over that
 * (\`drawSmelterLive\`). Its glow over the night is laid after the night
 * (\`drawSmelterNight\`). Returns what it covers from (sx, sy) in screen
 * pixels: left, top, right, bottom.
 */
export function drawSmelter(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: SmelterLook, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = smelterBaked(rotation, zoom);
  const k = zoom / b.scale;
  const X = sx - b.ox * k, Y = sy - b.oy * k, Wd = b.canvas.width * k, Ht = b.canvas.height * k;
  ctx.drawImage(b.canvas, X, Y, Wd, Ht);
  const heat = heatOf(look);
  if (heat > 0) {
    const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
    const p = fireBreath(t, look.working);
    if (night > 0.02) {
      ctx.globalAlpha = wasA * night * 0.42;
      ctx.drawImage(b.shade, X, Y, Wd, Ht);
    }
    if (b.warm) {
      // By day a warm colour on its hearth and dressings and round its runes; after dark light, stronger.
      ctx.globalAlpha = wasA * heat * heat * ((1 - night) * (0.4 + 0.2 * p) + night * (0.8 + 0.2 * p));
      lay(ctx, b.warm, sx, sy, zoom);
    }
    if (b.fire) {
      // Banked, a bed of embers a little dulled; working a charge, the whole of it.
      ctx.globalAlpha = wasA * Math.min(1, (look.working ? 0.9 : 0.68) + 0.12 * p);
      lay(ctx, b.fire, sx, sy, zoom);
    }
    if (b.runes) {
      // Banked, its runes only warm in their grooves; working, every one of them lit.
      ctx.globalAlpha = wasA * (look.working ? 0.88 + 0.12 * p : 0.32 + 0.12 * p);
      lay(ctx, b.runes, sx, sy, zoom);
    }
    if (b.heart && look.working) {
      // And its heart white-hot over that.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = wasA * (0.45 + 0.45 * p);
      lay(ctx, b.heart, sx, sy, zoom);
    }
    ctx.globalAlpha = wasA;
    ctx.globalCompositeOperation = was;
  }
  if (live) drawSmelterLive(ctx, sx, sy, zoom, rotation, look, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** Sparks up out of the flue while it works a charge: how many, the seconds each takes to rise and go out, and how high it gets in pixels at zoom one. */
const SPARKS = 11;
const SPARK_RISE = 1.2;
const SPARK_HIGH = 40;

/**
 * What of a smelter moves over its bake, outside the pointer's ring: working
 * a charge, a white-gold flare at the flue's mouth and sparks streaming up
 * out of it. Banked, nothing: its fire and runes breathe under the ring.
 */
export function drawSmelterLive(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: SmelterLook, night = 0, t = performance.now() / 1000): void {
  void night;
  if (!look.lit || !look.working) return;
  const b = smelterBaked(rotation, zoom);
  const p = fireBreath(t, true);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalAlpha = wasA * (0.6 + 0.4 * p);
  lay(ctx, b.flare, sx, sy, zoom);
  // Sparks up out of the flue, each on its own clock: a fat streak, white-gold going to ember, drifting and going out.
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  const w = Math.max(1.9, 1.1 * zoom ** 0.8);
  for (let i = 0; i < SPARKS; i++) {
    const u = ((t / (SPARK_RISE + (i % 3) * 0.2) + i * 0.381) % 1 + 1) % 1;
    const sway = Math.sin(u * 5.2 + i * 2.1) * (2 + 3 * u) + (((i * 0.618) % 1) - 0.5) * 6 * u;
    const x = sx + (b.flueAt[0] + sway) * zoom, y = sy + (b.flueAt[1] - 2 - u * SPARK_HIGH) * zoom;
    const len = (1.8 + 2.2 * (1 - u)) * zoom, lean = Math.cos(u * 5.2 + i * 2.1) * 0.35;
    ctx.globalAlpha = wasA * Math.pow(1 - u, 1.1) * Math.min(1, u * 10);
    ctx.lineWidth = w * (1 - 0.35 * u);
    ctx.strokeStyle = u < 0.35 ? 'rgb(255, 246, 214)' : i % 3 ? 'rgb(255, 196, 104)' : 'rgb(255, 160, 84)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - lean * len, y + len);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * A smelter alight after dark: its runes, mouth and flue and the bloom of
 * heat round them added as light, laid straight after it in its own place
 * among what is drawn, so whatever stands in front of it is drawn over it
 * and takes none of it. The night's wash goes over it after, and takes \`over\`
 * of it, nought to one, where it is laid (\`Renderer.nightOver\`): it is turned
 * up by as much, so the runes show through the dark as a rune lantern's do.
 * One picture, and nothing by day.
 */
export function drawSmelterNight(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: SmelterLook, night: number, t = performance.now() / 1000, over = 0): void {
  const heat = heatOf(look);
  if (heat <= 0 || night <= 0.02) return;
  const b = smelterBaked(rotation, zoom);
  if (!b.glow) return;
  const p = fireBreath(t, look.working);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, wasA * night * (look.working ? 0.85 + 0.15 * p : 0.5 + 0.12 * p) * underWash(over) / GLOW_GAIN);
  lay(ctx, b.glow, sx, sy, zoom);
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

export function smelterHit(rotation: number, zoom = 1): [number, number, number, number] {
  return smelterBaked(rotation, zoom).hit;
}

/** What it is drawn over, from its footprint's middle, in pixels at zoom one: left, top, right, bottom. */
export function smelterBounds(rotation: number, zoom = 1): [number, number, number, number] {
  return smelterBaked(rotation, zoom).bounds;
}

/* ---- the kiln --------------------------------------------------------------- */

/** How a kiln is drawn: alight or not, and firing a load. */
export interface KilnLook {
  lit: boolean;
  firing: boolean;
}

/** The dome's brick: the smelter's roof's cream in the light (`SHOULDER_END`), and in shade the runestones' lilac (`runestone.ts`), so its shaded side reads as the kit's. */
const DOME_STONE: Tone = toneOf('#eedecb', '#aa9eac');

/** Fired ware, bisque: the dressings' cream taken a third of the way to the embers' peach, so it reads as clay and not as stone. */
const POT_STONE: Tone = { lit: mix(hex('#f3e2cc'), hex('#e8945e'), 0.33), shade: mix(hex('#b29da0'), hex('#a3685a'), 0.33) };

/** How many sides its round solids are laid in -- the drum of its firebox, its band of runes, its dome -- and its vent. */
const K_SIDES = 16;
const VENT_SIDES = 8;
/**
 * How much bigger than it is laid out below it is drawn, as an anvil is
 * (`ANVIL_K`): its plinth a hair over its two by two subtiles, so its dome
 * reads at zoom one beside a smelter's three by two.
 */
const KILN_K = 1.22;
/** Where its solids stand, in units before `KILN_K`: the plinth, the drum, the band of runes, the dome to its crown, the vent and its cap. */
const K_SLAB_H = 1.6;
const DRUM_TOP = 5.3;
const K_BAND_TOP = 8.1;
const DOME_CROWN = 12.6;
const VENT_TOP = 14.3;
const K_CAP_TOP = KILN_VENT_UP / KILN_K;
/** The chamber's middle, back from the middle of its footprint, its stoke porch in front of it; its vent over that. */
const K_Y = (-KILN_VENT_BACK * UNITS_PER_TILE) / KILN_K;
/** How wide its round solids are, from their middle: the drum at its foot, the band, the dome at its foot and its crown, the vent, the vent's cap and its flue. */
const DRUM_R = 7.0;
const K_BAND_R = 7.35;
const DOME_R = 6.8;
const CROWN_R = 2.2;
const VENT_R = 2.35;
const VENT_CAP_R = 3.0;
const FLUE_R = 1.65;
/** How the dome rises, from its foot (nought) to its crown (one): the rings it is laid in, and how far each is drawn in -- a beehive's, steep and then closing. */
const DOME_RINGS = [0, 0.14, 0.29, 0.44, 0.58, 0.71, 0.82, 0.92, 1];
const domeR = (u: number): number => CROWN_R + (DOME_R - CROWN_R) * Math.pow(1 - Math.pow(u, 1.85), 0.72);
/** The dome's courses, laid an even width up its curve and so closer in height as it closes over: the heights of their beds. */
const DOME_COURSE = 2.35;
const DOME_BEDS: number[] = (() => {
  const out = [K_BAND_TOP - 0.05];
  let px = domeR(0), pz = K_BAND_TOP - 0.05, run = 0;
  for (let i = 1; i <= 400; i++) {
    const u = i / 400, x = domeR(u), z = K_BAND_TOP - 0.05 + (DOME_CROWN - K_BAND_TOP) * u;
    run += Math.hypot(x - px, z - pz);
    if (run >= DOME_COURSE) { out.push(z); run = 0; }
    px = x; pz = z;
  }
  out.push(DOME_CROWN + 1);
  return out;
})();
/** The plinth under it: its middle, and how far it runs every way. */
const K_PLINTH_Y = -0.6;
const K_PLINTH_H = 8.9;
/** The stoke porch standing out of the drum's front: half as wide as it is, how far out of the drum, and the top of its walls. */
const PORCH_HX = 3.0;
const PORCH_OUT = 3.1;
const PORCH_TOP = 4.45;
/** The barrel vault over it, how high it rises over the porch's walls. */
const VAULT_RISE = 1.05;
/** The stoke mouth in it: half as wide as it is, how high its jambs stand, how high the arch rises against how wide it is, and its ring of voussoirs. */
const K_MOUTH_W = 2.05;
const K_MOUTH_SPRING = 0.35;
const K_MOUTH_RISE = 0.82;
const K_RING = 0.75;
const K_MOUTH_TOP = K_MOUTH_SPRING + K_MOUTH_W * K_MOUTH_RISE;
/** Where the hearth before the mouth is on the plinth's top, toward its front from its middle. */
const K_HEARTH_AT = 8.0;
/** The draught port low in the drum's back, and the spy holes in the dome: how big, how high up their side, and which sides (counted round from the front). */
const K_PORT_R = 0.72;
const K_PORT_Z = 1.7;
const SPY_R = 0.5;
const SPY_RING = 1;
const SPY_SIDES = [2, 14, 6, 10];
/**
 * The runes round its band, every other side of it, in order round from the
 * front -- the sun over the stoke mouth first -- staves and stars with no long
 * slant to them, as a smelter's (`BAND_RUNES`); the sides between carry a
 * drilled dot.
 */
const KILN_RUNES = ['sunDot', 'algiz', 'star6', 'tiwaz', 'diamondDot', 'ingwaz', 'dagaz', 'ring'];
/** How big a rune on the band is, in units from its middle to its top, and how wide its groove. */
const K_RUNE_S = 1.12;
const K_RUNE_W = 0.42;
/** The pointed panels sunk in the drum either side of its front and of its back, a sun cut in each, as a smelter's sides have (`PANEL_RUNE`): which sides, and the panel's half-width, foot, springing, head and the sun's height and size. */
const K_PANEL_SIDES = [3, 6, 10, 13];
/** How far the moss climbs the drum's sides, by side counted round from the front: its shady left and back. */
const DRUM_MOSS: Record<number, number> = { 4: 0.6, 7: 0.7, 11: 0.5 };
const K_PANEL_HW = 0.95;
const K_PANEL_Z0 = 0.7;
const K_PANEL_Z1 = 2.2;
const K_PANEL_ARCH = 0.8;
const K_PANEL_RUNE_Z = 1.75;
const K_PANEL_S = 0.62;

/** A ring of `n` corners round the chamber's middle at height z, `r` out, its first side facing the front. */
const ringOf = (r: number, z: number, n = K_SIDES): V3[] => Array.from({ length: n }, (_, i) => {
  const a = Math.PI / 2 - Math.PI / n + (i * TAU) / n;
  return [Math.cos(a) * r, K_Y + Math.sin(a) * r, z] as V3;
});

/**
 * Stone or brick in courses round a round solid, on one of its sides (`s`,
 * `topW` across at its head): every course at the same height all the way
 * round, one course a stone to a side and the next a stone across each arris,
 * as a running bond; the joints cut in and each stone a hair its own tint.
 */
function coursed(g: Ctx, fill: RGB, s: Side, seed: number, course: number, topW: number, joint = 0.15, tint = 1, uneven = 0, beds?: readonly number[], soft = false): void {
  const T = rand(seed);
  const z0 = s.o[2];
  // The bed joints, the same all the way round: given, or every `course` up, each a hair off true by its course's number (`uneven` of a course at most).
  const hash = (n: number): number => Math.abs(Math.sin(n * 12.9898 + 0.7) * 43758.5453) % 1;
  const B: number[] = beds ? [...beds] : [];
  if (!beds) for (let n = Math.floor(z0 / course) - 1; n * course < z0 + s.h + course; n++) B.push(n * course + uneven * course * (hash(n) - 0.5));
  const wAt = (z: number): number => s.w + (topW - s.w) * Math.max(0, Math.min(1, z / Math.max(1e-6, s.h)));
  const xAt = (f: number, z: number): number => (s.w - wAt(z)) / 2 + f * wAt(z);
  for (let n = 0; n + 1 < B.length; n++) {
    const a = Math.max(0, B[n] - z0), b = Math.min(s.h, B[n + 1] - z0);
    if (b - a < 0.08) continue;
    const zm = (a + b) / 2;
    // One course a stone to a side, the next a stone across each arris; laid uneven, each course's joints set off by its own number, so no two line up.
    const odd = n % 2 === 1;
    let cuts: number[];
    // Laid uneven, a course is a ring of long bricks: a head joint in some of its sides and not others, set off by its number, so none line up.
    if (uneven > 0) cuts = hash(n * 13 + seed * 0.37) < 0.45 ? [0, 0.2 + 0.6 * hash(n * 7 + 3), 1] : [0, 1];
    else cuts = odd ? [0, 0.5, 1] : [0, 1];
    for (let j = 0; j + 1 < cuts.length; j++) {
      const x0 = xAt(cuts[j], zm), x1 = xAt(cuts[j + 1], zm);
      const r = T();
      g.fillStyle = r < 0.12 * uneven * 2 ? css(mix(fill, hex('#9a8ea4'), 0.38), 0.6)
        : r < 0.5 ? css(mix(fill, [255, 250, 240], 0.08 + 0.14 * T()), 0.5) : css(mix(fill, hex('#9a8ea4'), (0.06 + 0.12 * T()) * tint), 0.45);
      g.fillRect(x0 + 0.12, a + 0.12, x1 - x0 - 0.24, b - a - 0.24);
    }
    // Soft, the joints a single line a step into the stone's shade, with no lit lip: a brick wall's mortar, not cut stone.
    const line = (path: () => void, w: number, deep = false): void => {
      if (!soft) { cut(g, fill, w, path); return; }
      path();
      g.strokeStyle = css(mix(fill, hex('#9a90a6'), deep ? 0.9 : 0.5), deep ? 0.85 : 0.42);
      g.lineWidth = w;
      g.stroke();
    };
    // Every third bed a step deeper, so the courses carry at a distance.
    if (b < s.h - 0.05) line(() => { g.beginPath(); g.moveTo(-1, b); g.lineTo(s.w + 1, b); }, joint, n % 3 === 2);
    const heads = uneven > 0 ? cuts.slice(1, -1) : odd ? [0.5] : [0, 1];
    for (const f of heads) line(() => { g.beginPath(); g.moveTo(xAt(f, a), a + 0.08); g.lineTo(xAt(f, b), b - 0.08); }, joint * 0.9);
  }
}

/** A round solid's side turned from the light washed in the kit's lilac (the runestones' shade), as the smelter's shaded faces are, so its round turns. */
function lilacShade(g: Ctx, L: number, s: Side): void {
  const away = Math.max(0, Math.min(1, (0.97 - L) / 0.2));
  if (away <= 0.02) return;
  g.fillStyle = css(hex('#aa9eac'), 0.32 * away);
  g.fillRect(-1, -1, s.w + 2, s.h + 2);
}

/**
 * Moss along the foot of a side, run together into one low cushion, thickest
 * where it meets the plinth and a little way up it, `amount` of the way on,
 * nought to one: a round solid's sides have no arrises for it to climb
 * (`cornerMoss`).
 */
function footMoss(g: Ctx, k: PaintCtx, s: Side, seed: number, amount: number): void {
  if (amount <= 0.05) return;
  const T = rand(seed);
  const tr = g.getTransform(), inv = k.base.inverse();
  const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
  const ps: Pad[] = [];
  // Gathered into one clump on the side, not strewn along it.
  const at0 = 0.25 * s.w + T() * 0.5 * s.w;
  for (let j = 0; j < Math.round(6 + 6 * amount); j++) {
    const x = at0 + (T() - 0.5) * (1.0 + 1.4 * amount), z = Math.pow(T(), 2.2) * (0.4 + 1.0 * amount);
    const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x, z)));
    const r = (0.65 + 0.5 * T()) * (1 - 0.4 * Math.min(1, z / 1.4));
    ps.push([q.x, q.y, r * across, r * across * 0.75]);
  }
  g.save();
  g.setTransform(k.base);
  drawPads(g, ps);
  g.restore();
}

/** The stoke mouth's outline in the porch's front, drawn out by `d` all round: jambs up from its foot and an arch over. */
function kilnMouthPath(g: Ctx, cx: number, d: number, foot = -0.6): void {
  const r = K_MOUTH_W + d;
  g.beginPath();
  g.moveTo(cx - r, foot);
  g.lineTo(cx - r, K_MOUTH_SPRING);
  g.ellipse(cx, K_MOUTH_SPRING, r, K_MOUTH_W * K_MOUTH_RISE + d, 0, Math.PI, 0, true);
  g.lineTo(cx + r, foot);
  g.closePath();
}
const kilnArchAt = (cx: number, a: number, d: number): Pt => [cx + Math.cos(a) * (K_MOUTH_W + d), K_MOUTH_SPRING + Math.sin(a) * (K_MOUTH_W * K_MOUTH_RISE + d)];

interface KilnModel {
  parts: Part[];
  slab: Part;
  drum: Part;
  band: Part;
  dome: Part;
  porch: Part;
  coping: Part;
  /** The porch's front, where the mouth is, and the rune over it. */
  front: Side;
  /** The drum's back, where the draught port is. */
  back: Side;
  /** The band's sides with a rune on them, each with its rune. */
  runes: Array<{ s: Side; glyph: string }>;
  /** The dome's sides with a spy hole in them, and the drum's with a sun panel. */
  spies: Side[];
  panels: Side[];
  /** Where the mouth's light falls on its own stone: the plinth's top and front, and the porch's front and coping. */
  warmPlinth: Face[];
  warmPorch: Face[];
  /** The ware on the plinth, drawn only while the kiln is not firing it; and the drum's and band's fronts, where the mouth's light falls too. */
  pots: Part[];
  warmDrum: Face[];
  warmBand: Face[];
  /** The flue in the vent's cap, as an outline in the model. */
  flue: V3[];
  turf: V3[];
}

let kilnModel: KilnModel | null = null;

function kilnOf(): KilnModel {
  if (kilnModel) return kilnModel;
  const seed = 5113;
  const parts: Part[] = [];
  const side = (s: Side): number => (Math.round(Math.atan2(s.n[1], s.n[0]) / (TAU / K_SIDES) - K_SIDES / 4) % K_SIDES + K_SIDES) % K_SIDES;
  const topW = (s: Side): number => Math.hypot(s.poly[2][0] - s.poly[3][0], s.poly[2][1] - s.poly[3][1]);

  /* -- the plinth: square in line under it, its corners mossed, the hearth before the mouth scorched and strewn with cinders -- */
  const slab = prism([rect(0, K_PLINTH_Y, K_PLINTH_H, K_PLINTH_H, -0.5), rect(0, K_PLINTH_Y, K_PLINTH_H, K_PLINTH_H, K_SLAB_H - 0.4), rect(0, K_PLINTH_Y, K_PLINTH_H - 0.5, K_PLINTH_H - 0.5, K_SLAB_H)], HEARTH,
    (k, i, s) => (k !== 0 ? { crease: 0.45 } : {
      paint: (g, kk) => {
        skin(g, kk.fill, s.w, s.h + 0.5, seed + 3 + i);
        cornerMoss(g, kk, s, seed + 5 + i, [1, 0.95, 1, 1][i]);
      },
    }),
    {
      paint: (g, k) => {
        const T = rand(seed + 11);
        // Flagged: a joint across it each way, cut.
        cut(g, k.fill, 0.18, () => { g.beginPath(); g.moveTo(0.4 * (T() - 0.5), -K_PLINTH_H); g.lineTo(0.4 * (T() - 0.5), K_PLINTH_H); });
        cut(g, k.fill, 0.18, () => { g.beginPath(); g.moveTo(-K_PLINTH_H, -1.2); g.lineTo(K_PLINTH_H, -1.4); });
        // And the flags laid across those, their joints staggered.
        for (const [x0, y0, x1, y1] of [[-K_PLINTH_H, 4.2, 0, 4.0], [0, 3.1, K_PLINTH_H, 3.3], [-4.6, -1.2, -4.4, 4.1], [4.8, -1.4, 4.6, 3.2], [-K_PLINTH_H, -5.6, 0, -5.4], [-5.2, -1.2, -5.0, -K_PLINTH_H]] as Array<[number, number, number, number]>) {
          cut(g, k.fill, 0.14, () => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); });
        }
        skin(g, k.fill, 18, 18, seed + 13, 0.6);
        // A scorch before the mouth, and ash and cinders raked out over it.
        const at0 = K_HEARTH_AT - K_PLINTH_Y;
        const gr = g.createRadialGradient(0, at0 - 0.4, 0, 0, at0 - 0.4, 3.8);
        gr.addColorStop(0, 'rgba(92, 78, 92, 0.45)');
        gr.addColorStop(1, 'rgba(120, 104, 116, 0)');
        g.fillStyle = gr;
        g.fillRect(-5, at0 - 3, 10, 5);
        for (let i = 0; i < 16; i++) {
          const x = (T() - 0.5) * 5.6, y = at0 - 0.5 + T() * 0.9, r = 0.12 + T() * 0.16;
          g.fillStyle = T() < 0.6 ? 'rgba(168, 158, 166, 0.75)' : 'rgba(64, 54, 66, 0.8)';
          g.beginPath();
          g.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
          g.fill();
        }
      },
    });
  const slabPart: Part = { x: 0, y: K_PLINTH_Y, faces: slab, solid: true, tier: 0 };
  parts.push(slabPart);

  /* -- the drum of the firebox: dressed stone in courses round it, the draught port low in its back -- */
  let back: Side | null = null;
  const panels: Side[] = [];
  const drum = prism([ringOf(DRUM_R, K_SLAB_H), ringOf(DRUM_R - 0.25, DRUM_TOP)], KILN_STONE, (_k, i, s) => {
    const j = side(s);
    if (K_PANEL_SIDES.includes(j)) {
      panels.push(s);
      const px = s.w / 2;
      return {
        crease: 0.16,
        paint: (g, k) => {
          const fill = k.fill;
          skin(g, fill, s.w, s.h, seed + 20 + i);
          coursed(g, fill, s, seed + 30 + i, 1.55, topW(s), 0.15, 0.5);
          lilacShade(g, k.L, s);
          panelArch(g, px, px, K_PANEL_HW + 0.3, K_PANEL_Z0 - 0.3, K_PANEL_Z1, K_PANEL_ARCH + 0.28, 0);
          g.fillStyle = css(mix(fill, hex('#fbf0e2'), 0.5));
          g.fill();
          panelArch(g, px, px, K_PANEL_HW, K_PANEL_Z0, K_PANEL_Z1, K_PANEL_ARCH, 0);
          g.fillStyle = css(mix(fill, hex('#9a90a6'), 0.34), 0.75);
          g.fill();
          cut(g, fill, 0.14, () => panelArch(g, px, px, K_PANEL_HW, K_PANEL_Z0, K_PANEL_Z1, K_PANEL_ARCH, 0));
          // A gold line just inside it, as round the band's runes.
          panelArch(g, px, px, K_PANEL_HW, K_PANEL_Z0, K_PANEL_Z1, K_PANEL_ARCH, 0.2);
          g.strokeStyle = css(hex(RUNE_GOLD), 0.7);
          g.lineWidth = 0.09;
          g.stroke();
          cutRune(g, mix(fill, hex('#9a90a6'), 0.34), PANEL_RUNE, px, K_PANEL_RUNE_Z, K_PANEL_S, 0.36);
        },
      };
    }
    if (j !== K_SIDES / 2) {
      return {
        crease: 0.16,
        paint: (g, k) => {
          skin(g, k.fill, s.w, s.h, seed + 20 + i);
          coursed(g, k.fill, s, seed + 30 + i, 1.55, topW(s), 0.15, 0.5);
          lilacShade(g, k.L, s);
          // Moss up its foot on the shady side, back and left, as up the plinth's corners.
          footMoss(g, k, s, seed + 140 + i, DRUM_MOSS[j] ?? 0);
        },
      };
    }
    back = s;
    return {
      crease: 0.16,
      paint: (g, k) => {
        const fill = k.fill, px = s.w / 2;
        skin(g, fill, s.w, s.h, seed + 20 + i);
        coursed(g, fill, s, seed + 30 + i, 1.55, topW(s), 0.15, 0.5);
          lilacShade(g, k.L, s);
        // The draught port, in a ring of dressed stones.
        const dress = mix(fill, hex('#fbf0e2'), 0.62);
        g.beginPath();
        g.arc(px, K_PORT_Z, K_PORT_R + 0.7, 0, TAU);
        g.fillStyle = css(dress);
        g.fill();
        g.strokeStyle = css(mix(fill, STONE_INK, 0.55), 0.75);
        g.lineWidth = 0.18;
        g.stroke();
        for (let j2 = 0; j2 < 5; j2++) {
          const a = (j2 / 5) * TAU + 0.3;
          cut(g, dress, 0.12, () => { g.beginPath(); g.moveTo(px + Math.cos(a) * K_PORT_R, K_PORT_Z + Math.sin(a) * K_PORT_R); g.lineTo(px + Math.cos(a) * (K_PORT_R + 0.7), K_PORT_Z + Math.sin(a) * (K_PORT_R + 0.7)); });
        }
        g.beginPath();
        g.arc(px, K_PORT_Z, K_PORT_R, 0, TAU);
        g.fillStyle = '#2a2230';
        g.fill();
        const sg = g.createRadialGradient(px, K_PORT_Z + 1.8, 0.2, px, K_PORT_Z + 1.8, 2.6);
        sg.addColorStop(0, 'rgba(86, 72, 90, 0.3)');
        sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
        g.fillStyle = sg;
        g.fillRect(px - 3, K_PORT_Z, 6, 5);
      },
    };
  });
  const drumPart: Part = { x: 0, y: K_Y, faces: drum, solid: true, tier: 1 };
  parts.push(drumPart);

  /* -- the band of runes round the foot of the dome: a course standing proud, a rune on every other side and a drilled dot between -- */
  const runes: Array<{ s: Side; glyph: string }> = [];
  const band = prism([ringOf(K_BAND_R, DRUM_TOP), ringOf(K_BAND_R, K_BAND_TOP - 0.2), ringOf(K_BAND_R - 0.3, K_BAND_TOP)], RUNE_BAND, (k, i, s) => {
    if (k !== 0) return { crease: 0.3 };
    const j = side(s);
    const glyph = j % 2 ? null : KILN_RUNES[j / 2];
    if (glyph) runes.push({ s, glyph });
    return {
      crease: 0.42,
      paint: (g, kk) => {
        const fill = kk.fill;
        for (const z of [0.36, s.h - 0.32]) cut(g, fill, 0.13, () => { g.beginPath(); g.moveTo(-1, z); g.lineTo(s.w + 1, z); });
        // A pale rim along its foot and its head, the light caught on its arrises, as on the vent's cap.
        g.strokeStyle = 'rgba(255, 250, 238, 0.8)';
        g.lineWidth = 0.12;
        g.beginPath(); g.moveTo(-1, 0.1); g.lineTo(s.w + 1, 0.1); g.stroke();
        // Its head rimmed in the runes' gold, where the dome sits on it, so the gold shows on it cold.
        g.strokeStyle = css(hex(RUNE_GOLD), 0.85);
        g.lineWidth = 0.24;
        g.beginPath(); g.moveTo(-1, s.h - 0.1); g.lineTo(s.w + 1, s.h - 0.1); g.stroke();
        if (glyph) cutRune(g, fill, glyph, s.w / 2, s.h / 2, K_RUNE_S, K_RUNE_W);
        // Over the stoke porch, the band sooted from the fire under it.
        if (j === 0 || j === 1 || j === K_SIDES - 1) {
          const sg = g.createLinearGradient(0, 0, 0, s.h);
          sg.addColorStop(0, `rgba(96, 80, 100, ${j === 0 ? 0.3 : 0.16})`);
          sg.addColorStop(1, 'rgba(96, 80, 100, 0)');
          g.fillStyle = sg;
          g.fillRect(-1, -1, s.w + 2, s.h + 2);
        }
        else cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(s.w / 2, s.h / 2 + 0.03); g.lineTo(s.w / 2, s.h / 2 - 0.03); });
        // The dome's shadow across its head, so dome and drum read apart.
        g.fillStyle = 'rgba(90, 82, 102, 0.26)';
        g.fillRect(-1, s.h - 0.6, s.w + 2, 1);
      },
    };
  });
  const bandPart: Part = { x: 0, y: K_Y, faces: band, solid: true, tier: 2 };
  parts.push(bandPart);

  /* -- the dome: brick in courses, closing in to its crown, sooted toward it; the spy holes in it -- */
  const spies: Side[] = [];
  const domeRings = DOME_RINGS.map((u) => ringOf(domeR(u), K_BAND_TOP - 0.05 + (DOME_CROWN - K_BAND_TOP) * u));
  const dome = prism(domeRings, DOME_STONE, (k, i, s) => {
    const spy = k === 1 && SPY_SIDES.includes(side(s));
    if (spy) spies.push(s);
    const zf = s.o[2];
    return {
      crease: 0.14,
      paint: (g, kk) => {
        const fill = kk.fill;
        // Its bricks alone, no skin of pits and grit: on so many small sides that would muddy it.
        // Its joints fainter the more of the light it catches, so the dome reads as one pale mass.
        g.globalAlpha = 1 - 0.65 * Math.max(0, Math.min(1, kk.L));
        coursed(g, fill, s, seed + 300 + k * 17 + i, DOME_COURSE, topW(s), 0.1, 0.3, 0.5, DOME_BEDS, true);
        g.globalAlpha = 1;
        // The side of it turned from the light washed in the kit's lilac, as the smelter's shaded faces are.
        const away = Math.max(0, Math.min(1, (0.97 - kk.L) / 0.2));
        if (away > 0.02) {
          g.fillStyle = css(hex('#aa9eac'), 0.32 * away);
          g.fillRect(-1, -1, s.w + 2, s.h + 2);
          // Light thrown back up onto its shaded foot off the plinth, so the dome holds its round.
          if (k <= 1) {
            const bg = g.createLinearGradient(0, -zf + K_BAND_TOP, 0, -zf + K_BAND_TOP + 2.2);
            bg.addColorStop(0, css([255, 244, 228], 0.2 * away));
            bg.addColorStop(1, css([255, 244, 228], 0));
            g.fillStyle = bg;
            g.fillRect(-1, -1, s.w + 2, s.h + 2);
          }
        }
        // The lit side a step paler, as a glaze of light, and the foot of it dark where it sits back on the band.
        if (kk.L > 0.97) {
          g.fillStyle = css([255, 250, 240], 0.16 * Math.min(1, (kk.L - 0.97) / 0.03));
          g.fillRect(-1, -1, s.w + 2, s.h + 2);
        }
        // One course of paler brick round it partway up, a string course as the smelter's band is.
        const sc = DOME_BEDS[3] - zf, sc1 = DOME_BEDS[4] - zf;
        if (sc1 > 0 && sc < s.h) {
          g.fillStyle = css([255, 248, 236], 0.28);
          g.fillRect(-1, sc, s.w + 2, sc1 - sc);
        }
        if (k === 0) {
          g.fillStyle = 'rgba(86, 72, 98, 0.32)';
          g.fillRect(-1, -0.2, s.w + 2, 0.55);
        }
        // Sooted toward the crown, where the heat comes through: only round the vent, so the dome reads as pale stone.
        const sg = g.createLinearGradient(0, DOME_CROWN - 2.4 - zf, 0, DOME_CROWN - zf);
        sg.addColorStop(0, 'rgba(86, 72, 90, 0)');
        sg.addColorStop(0.7, 'rgba(70, 58, 78, 0.16)');
        sg.addColorStop(1, 'rgba(62, 48, 70, 0.4)');
        g.fillStyle = sg;
        g.fillRect(-1, -0.5, s.w + 2, s.h + 1);
        if (spy) {
          const px = s.w / 2, pz = s.h / 2;
          g.beginPath();
          g.ellipse(px, pz, SPY_R + 0.45, SPY_R + 0.38, 0, 0, TAU);
          g.fillStyle = css(mix(fill, hex('#fbf0e2'), 0.6));
          g.fill();
          g.strokeStyle = css(mix(fill, STONE_INK, 0.65), 0.85);
          g.lineWidth = 0.2;
          g.stroke();
          g.beginPath();
          g.ellipse(px, pz, SPY_R, SPY_R * 0.86, 0, 0, TAU);
          g.fillStyle = '#2a2230';
          g.fill();
        }
      },
    };
  }, { crease: 0.3 });
  const domePart: Part = { x: 0, y: K_Y, faces: dome, solid: true, tier: 3 };
  parts.push(domePart);

  /* -- the vent: a short collar of stone out of the crown, sooted, under a lipped cap with the flue open in it -- */
  const vent = prism([ringOf(VENT_R, DOME_CROWN - 0.6, VENT_SIDES), ringOf(VENT_R - 0.25, VENT_TOP, VENT_SIDES)], KILN_STONE, (_k, i, s) => ({
    crease: 0.3,
    paint: (g, k) => {
      skin(g, k.fill, s.w, s.h, seed + 80 + i, 1.4);
      coursed(g, k.fill, s, seed + 85 + i, 0.95, topW(s), 0.12);
      const sg = g.createLinearGradient(0, 0, 0, s.h);
      sg.addColorStop(0, 'rgba(86, 72, 90, 0.12)');
      sg.addColorStop(1, 'rgba(70, 58, 78, 0.42)');
      g.fillStyle = sg;
      g.fillRect(-1, 0, s.w + 2, s.h);
      // A dark line where it stands out of the dome, so the collar keeps its shape against it at a distance.
      g.fillStyle = 'rgba(80, 62, 84, 0.55)';
      g.fillRect(-1, 0.5, s.w + 2, 0.32);
    },
  }));
  const ventPart: Part = { x: 0, y: K_Y, faces: vent, solid: true, tier: 4 };
  parts.push(ventPart);
  const flue = ringOf(FLUE_R, K_CAP_TOP, 12);
  const cap = prism([ringOf(VENT_CAP_R, VENT_TOP - 0.2, VENT_SIDES), ringOf(VENT_CAP_R, K_CAP_TOP - 0.4, VENT_SIDES), ringOf(VENT_CAP_R - 0.3, K_CAP_TOP, VENT_SIDES)], DRESSING, (_k, i, s) => ({
    crease: 0.5,
    paint: (g, k) => {
      const sg = g.createLinearGradient(0, 0, 0, s.h);
      sg.addColorStop(0, 'rgba(70, 58, 78, 0.3)');
      sg.addColorStop(1, 'rgba(70, 58, 78, 0.12)');
      g.fillStyle = sg;
      g.fillRect(-1, 0, s.w + 2, s.h);
      skin(g, k.fill, s.w, s.h, seed + 90 + i, 2);
      // A pale rule round the head of its lip, the light caught along its arris.
      g.strokeStyle = 'rgba(255, 250, 238, 0.85)';
      g.lineWidth = 0.13;
      g.beginPath();
      g.moveTo(-1, s.h - 0.12);
      g.lineTo(s.w + 1, s.h - 0.12);
      g.stroke();
    },
  }), {
    paint: (g, k) => {
      // The flue: its dark open in the top, ringed, and the soot about it.
      g.beginPath();
      g.arc(0, 0, FLUE_R + 0.85, 0, TAU);
      g.fillStyle = 'rgba(70, 58, 78, 0.36)';
      g.fill();
      // A pale ring round the head of the cap.
      g.beginPath();
      g.arc(0, 0, VENT_CAP_R - 0.5, 0, TAU);
      g.strokeStyle = 'rgba(255, 250, 238, 0.85)';
      g.lineWidth = 0.14;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, FLUE_R, 0, TAU);
      g.fillStyle = '#2a2230';
      g.fill();
      g.strokeStyle = css(mix(k.fill, CREASE_INK, 0.7));
      g.lineWidth = 0.18;
      g.stroke();
    },
  });
  const capPart: Part = { x: 0, y: K_Y, faces: cap, solid: true, tier: 5 };
  parts.push(capPart);

  /* -- the stoke porch out of the drum's front: dressed jambs and voussoirs round the mouth, the sun cut over it, a coping on top -- */
  // From where the band overhangs the drum at its corners, so none of it is inside the band to be drawn over it.
  const py0 = K_Y + Math.sqrt(K_BAND_R ** 2 - PORCH_HX ** 2) + 0.05, py1 = K_Y + DRUM_R + PORCH_OUT;
  const pMid = (py0 + py1) / 2, pH = (py1 - py0) / 2;
  let front: Side | null = null;
  const porch = prism([rect(0, pMid, PORCH_HX, pH, K_SLAB_H), rect(0, pMid, PORCH_HX, pH, PORCH_TOP)], KILN_STONE, (_k, i, s) => {
    if (i !== 2) {
      return {
        crease: 0.4,
        paint: (g, k) => {
          skin(g, k.fill, s.w, s.h, seed + 40 + i);
          // Coursed as the drum is, at the drum's heights, so it reads as built out of it; a long stone at its outer end, a quoin.
          coursed(g, k.fill, s, seed + 45 + i, 1.55, s.w);
          footMoss(g, k, s, seed + 48 + i, 0.5);
          // A draught slot low in its side, in a dressed surround.
          const sx0 = s.w * 0.55, sz0 = 0.75;
          g.fillStyle = css(mix(k.fill, hex('#fbf0e2'), 0.55));
          g.fillRect(sx0 - 0.62, sz0 - 0.32, 1.24, 0.64);
          g.fillStyle = '#3c2e3e';
          g.fillRect(sx0 - 0.42, sz0 - 0.14, 0.84, 0.28);
          cut(g, k.fill, 0.08, () => { g.beginPath(); g.rect(sx0 - 0.62, sz0 - 0.32, 1.24, 0.64); });
          // Where it runs into the drum, the joint a shade deep.
          const lx = dot(s.a, [0, 1, 0]) > 0 ? 0 : s.w;
          g.fillStyle = 'rgba(86, 72, 90, 0.2)';
          g.fillRect(lx - 0.35, -1, 0.7, s.h + 2);
          const sg = g.createLinearGradient(0, s.h, 0, s.h - 1.2);
          sg.addColorStop(0, 'rgba(86, 72, 90, 0.22)');
          sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
          g.fillStyle = sg;
          g.fillRect(-1, s.h - 1.2, s.w + 2, 1.4);
        },
      };
    }
    front = s;
    const cx = s.w / 2;
    return {
      crease: 0.4,
      paint: (g, k) => {
        const fill = k.fill;
        skin(g, fill, s.w, s.h, seed + 42);
        ashlar(g, fill, s, seed + 47, 1.3, (x0, x1, z0) => x1 > cx - K_MOUTH_W - K_RING - 0.1 && x0 < cx + K_MOUTH_W + K_RING + 0.1 && z0 < K_MOUTH_TOP + K_RING - 0.2);
        // Soot up the face over the mouth.
        const sg = g.createRadialGradient(cx, K_MOUTH_TOP + 1.4, 0.4, cx, K_MOUTH_TOP + 1.4, 4.2);
        sg.addColorStop(0, 'rgba(86, 72, 90, 0.34)');
        sg.addColorStop(1, 'rgba(86, 72, 90, 0)');
        g.fillStyle = sg;
        g.fillRect(cx - 5, K_MOUTH_SPRING, 10, 8);
        // The dressings: jamb stones and voussoirs, paler, round the mouth, and the keystone proud of them.
        const dress = mix(fill, hex('#fbf0e2'), 0.62);
        kilnMouthPath(g, cx, K_RING, 0);
        g.fillStyle = css(dress);
        g.fill();
        g.strokeStyle = css(mix(fill, STONE_INK, 0.55), 0.75);
        g.lineWidth = 0.18;
        g.stroke();
        // A gold line round the head of the voussoirs, as round the smelter's mouth, so the stoke mouth is the piece's focus.
        kilnMouthPath(g, cx, K_RING - 0.16, 0);
        g.strokeStyle = css(hex(RUNE_GOLD), 0.8);
        g.lineWidth = 0.12;
        g.stroke();
        const kz = K_MOUTH_TOP;
        g.beginPath();
        g.moveTo(cx - 0.48, kz - 0.08);
        g.lineTo(cx - 0.7, kz + K_RING + 0.25);
        g.lineTo(cx + 0.7, kz + K_RING + 0.25);
        g.lineTo(cx + 0.48, kz - 0.08);
        g.closePath();
        g.fillStyle = css(mix(dress, [255, 250, 240], 0.25));
        g.fill();
        g.strokeStyle = css(mix(fill, CREASE_INK, 0.55), 0.7);
        g.stroke();
        // A gold diamond inlaid in the keystone, as the runestones' gold, so the gold shows on it cold.
        const kc = kz + (K_RING + 0.25) / 2;
        g.beginPath();
        g.moveTo(cx, kc + 0.5);
        g.lineTo(cx + 0.34, kc);
        g.lineTo(cx, kc - 0.5);
        g.lineTo(cx - 0.34, kc);
        g.closePath();
        g.fillStyle = RUNE_GOLD;
        g.fill();
        g.strokeStyle = RUNE_CHANNEL;
        g.lineWidth = 0.09;
        g.stroke();
        for (let j = 1; j < 7; j++) {
          const a = Math.PI - (j / 7) * Math.PI;
          if (Math.abs(a - Math.PI / 2) < 0.25) continue;
          const [ax0, az0] = kilnArchAt(cx, a, 0), [ax1, az1] = kilnArchAt(cx, a, K_RING);
          cut(g, dress, 0.12, () => { g.beginPath(); g.moveTo(ax0, az0); g.lineTo(ax1, az1); });
        }
        for (const sd of [-1, 1]) cut(g, dress, 0.12, () => { g.beginPath(); g.moveTo(cx + sd * K_MOUTH_W, K_MOUTH_SPRING); g.lineTo(cx + sd * (K_MOUTH_W + K_RING), K_MOUTH_SPRING); });
        // A pale lip round the opening, so cold it still reads as a mouth and not a smudge.
        kilnMouthPath(g, cx, 0.12, 0);
        g.strokeStyle = css(mix(fill, [255, 250, 240], 0.7), 0.95);
        g.lineWidth = 0.26;
        g.stroke();
        // The mouth: dark, a bed of ash on its floor, the jamb the eye sees into a step lighter.
        kilnMouthPath(g, cx, 0, 0);
        const ig = g.createLinearGradient(0, 0, 0, K_MOUTH_TOP);
        ig.addColorStop(0, '#523e4c');
        ig.addColorStop(1, '#30242f');
        g.fillStyle = ig;
        g.fill();
        g.save();
        kilnMouthPath(g, cx, 0, 0);
        g.clip();
        const look = dot(k.e.toward, s.a) / Math.max(1e-6, Math.hypot(k.e.toward[0], k.e.toward[1]));
        const jx = look >= 0 ? cx - K_MOUTH_W : cx + K_MOUTH_W, dir = look >= 0 ? 1 : -1;
        g.fillStyle = css(mix(fill, hex('#5a4e5e'), 0.62), 0.9);
        g.fillRect(Math.min(jx, jx + dir * 0.7 * Math.abs(look)), -1, 0.7 * Math.abs(look), K_MOUTH_TOP + 1);
        g.fillStyle = 'rgba(132, 120, 128, 0.85)';
        g.fillRect(cx - K_MOUTH_W, -1, 2 * K_MOUTH_W, 1.4);
        const A = rand(seed + 41);
        for (let j = 0; j < 6; j++) {
          g.fillStyle = A() < 0.5 ? 'rgba(66, 56, 66, 0.8)' : 'rgba(176, 166, 170, 0.8)';
          g.beginPath();
          g.ellipse(cx + (A() - 0.5) * 2 * (K_MOUTH_W - 0.4), 0.12 + A() * 0.28, 0.24 + A() * 0.22, 0.13, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      },
    };
  });
  const frontSide = front as unknown as Side;
  // Over the drum and the dome where its front is seen; under them, and hidden by them, where not.
  const porchPart: Part = { x: 0, y: py1, faces: porch, solid: true, tier: 6, order: (e) => (dot(frontSide.n, e.toward) > 0 ? 6 : 0.5) };
  parts.push(porchPart);
  /*
   * Its roof a barrel vault of the dressings' stone, running back into the
   * drum: a half-round laid along it, a hair proud of its walls, its front
   * end a lunette with a gold keystone at its crown.
   */
  const vhx = PORCH_HX + 0.12;
  const vault = (y: number): V3[] => [
    [-vhx, y, PORCH_TOP], [vhx, y, PORCH_TOP],
    ...Array.from({ length: 7 }, (_, j) => {
      const th = ((j + 1) / 8) * Math.PI;
      return [Math.cos(th) * vhx, y, PORCH_TOP + Math.sin(th) * VAULT_RISE] as V3;
    }),
  ];
  const coping = prism([vault(py0), vault(py1 + 0.14)], HEARTH, (_k, _i, s) => ({
    crease: 0.3,
    paint: (g, k) => {
      skin(g, k.fill, s.w, Math.max(0.5, s.h), seed + 150 + _i, 0.8);
      // Its stones' joints along it.
      cut(g, k.fill, 0.1, () => { g.beginPath(); g.moveTo(s.w * 0.5, -1); g.lineTo(s.w * 0.5, s.h + 1); });
    },
  }), {
    crease: 0.55,
    paint: (g, k) => {
      // The lunette: a rim of voussoirs round its arch, a gold keystone at the crown, frame (0, 0) its middle, x across, y down.
      // The frame's middle is the mean of the lunette's corners: so far up the rise.
      const zc = -(PORCH_TOP + (VAULT_RISE * Array.from({ length: 7 }, (_, j) => Math.sin(((j + 1) / 8) * Math.PI)).reduce((m, v) => m + v, 0)) / 9);
      g.save();
      g.beginPath();
      g.ellipse(0, -(PORCH_TOP) - zc, vhx - 0.25, VAULT_RISE - 0.22, 0, Math.PI, TAU);
      g.strokeStyle = css(mix(k.fill, [255, 250, 238], 0.55), 0.9);
      g.lineWidth = 0.14;
      g.stroke();
      g.restore();
      const ky = -(PORCH_TOP + VAULT_RISE - 0.32) - zc;
      g.beginPath();
      g.moveTo(0, ky - 0.44);
      g.lineTo(0.34, ky);
      g.lineTo(0, ky + 0.44);
      g.lineTo(-0.34, ky);
      g.closePath();
      g.fillStyle = RUNE_GOLD;
      g.fill();
      g.strokeStyle = RUNE_CHANNEL;
      g.lineWidth = 0.08;
      g.stroke();
    },
  });
  // A base course along the porch's foot, as the plinth's edge and the drum's foot have, tying it to them.
  {
    // Laid before the porch and kept behind its front, so only its strips along the porch's sides show and never across the mouth.
    const plinthCourse = prism([rect(0, pMid - 0.08, PORCH_HX + 0.16, pH - 0.08, K_SLAB_H), rect(0, pMid - 0.08, PORCH_HX + 0.16, pH - 0.08, K_SLAB_H + 0.42), rect(0, pMid - 0.08, PORCH_HX + 0.04, pH - 0.12, K_SLAB_H + 0.55)], HEARTH, () => ({ crease: 0.45 }));
    parts.push({ x: 0, y: py1, faces: plinthCourse, solid: true, tier: 5.95, order: (e) => (dot(frontSide.n, e.toward) > 0 ? 5.95 : 0.52) });
  }
  // A cheek stone either side where it runs into the drum, standing a little proud of its sides, bonding it in.
  for (const sd of [-1, 1]) {
    const cx0 = sd * (PORCH_HX + 0.22), cy0 = py0 + 0.55;
    const cheek = prism([rect(cx0, cy0, 0.3, 0.75, K_SLAB_H), rect(cx0, cy0, 0.3, 0.75, PORCH_TOP + 0.55), rect(cx0, cy0 - 0.05, 0.18, 0.6, PORCH_TOP + 0.8)], HEARTH, () => ({ crease: 0.45 }));
    parts.push({ x: cx0, y: cy0, faces: cheek, solid: true, tier: 5.9, order: (e) => (dot(frontSide.n, e.toward) > 0 ? 5.9 : 0.55) });
  }
  const copingPart: Part = { x: 0, y: py1, faces: coping, solid: true, tier: 6.1, order: (e) => (dot(frontSide.n, e.toward) > 0 ? 6.1 : 0.6) };
  parts.push(copingPart);

  /* -- fired ware cooling on the plinth's side, away from the mouth: two pots and a bowl, bisque-pale; gone into the kiln while it fires a load -- */
  const pots: Part[] = [];
  const zp = K_SLAB_H;
  for (const [x, y, k0, bowl] of [[6.4, 4.0, 1, false], [7.6, 1.6, 0.82, false], [7.9, 3.65, 0.7, true]] as Array<[number, number, number, boolean]>) {
    const prof: Array<[number, number]> = bowl
      ? [[0.45, 0], [0.95, 0.42], [1.05, 0.62]]
      : [[0.5, 0], [0.92, 0.62], [0.8, 1.3], [0.4, 1.66], [0.52, 1.86]];
    const n = 10;
    const ringAt = (r: number, z: number): V3[] => Array.from({ length: n }, (_, j) => {
      const a = (j / n) * TAU + 0.2;
      return [x + Math.cos(a) * r * k0, y + Math.sin(a) * r * k0, zp + z * k0] as V3;
    });
    const top = prof[prof.length - 1];
    const pot = prism(prof.map(([r, z]) => ringAt(r, z)), POT_STONE, () => ({ crease: 0.7 }), {
      crease: 0.5,
      paint: (g) => {
        // Its mouth: the dark inside, the rim round it.
        g.beginPath();
        g.arc(0, 0, top[0] * k0 * 0.78, 0, TAU);
        g.fillStyle = 'rgba(92, 70, 86, 0.85)';
        g.fill();
      },
    });
    // In front of the drum where the eye is on that side of it, behind it where not.
    const dx = x, dy = y - K_Y;
    const potPart: Part = { x, y, faces: pot, solid: true, tier: 7, order: (e) => (dx * e.toward[0] + dy * e.toward[1] > 0 ? 7 : 0.45) };
    parts.push(potPart);
    pots.push(potPart);
  }

  /* -- a few tufts of grass round the plinth's corners, and a flower at its back, kept back from its heat -- */
  for (const [x0, y0, sd] of [[-10.0, 6.2, 1], [9.9, 7.0, 2], [-9.8, -9.8, 3], [9.3, -10.3, 4], [5.0, 9.3, 5], [-5.8, 9.1, 6], [-9.7, -2.2, 7]] as Array<[number, number, number]>) {
    const x = x0 * KILN_K, y = y0 * KILN_K;
    parts.push({ x, y, reach: [[x, y, 4]], draw: (g, e) => { const [px, py] = proj(e, [x, y, 0]); grassTuft(g, px, py, seed + sd * 31, 0.5); } });
  }
  for (const [x0, y0, sd, colour] of [[-8.6, -10.2, 8, 'cream'], [10.4, -4.0, 9, 'cream']] as Array<[number, number, number, string]>) {
    const x = x0 * KILN_K, y = y0 * KILN_K;
    parts.push({ x, y, reach: [[x, y, 4]], draw: (g, e) => { const [px, py] = proj(e, [x, y, 0.1]); flowerClump(g, px, py, colour, seed + sd * 31, 0.34); } });
  }

  // Cushions of moss on the plinth's front corner and its shady back one, as on the smelter's.
  for (const [mx0, my0] of [[-7.4, 7.0], [-7.6, -8.4]]) {
    const mx = mx0 * KILN_K, my = my0 * KILN_K;
    parts.push({
      x: mx, y: my, reach: [[mx, my, K_SLAB_H * KILN_K + 1]],
      draw: (g, e) => {
        const T = rand(seed * 9 + 2);
        const across = Math.hypot(e.ux, e.uy);
        const ps: Pad[] = [];
        for (let j = 0; j < 10; j++) {
          const [px, py] = proj(e, [mx + (T() - 0.5) * 2.8, my + (T() - 0.5) * 1.8, K_SLAB_H * KILN_K + 0.05 + T() * 0.15]);
          const r = 0.38 + 0.32 * T();
          ps.push([px, py, r * across, r * across * 0.6]);
        }
        drawPads(g, ps);
      },
    });
  }
  const turf: V3[] = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU, r = 1 + 0.06 * Math.sin(i * 2.7);
    return [Math.cos(a) * 12.4 * KILN_K * r, K_PLINTH_Y * 0.5 * KILN_K + Math.sin(a) * 12.2 * KILN_K * r, 0] as V3;
  });
  const warmPlinth = slab.filter((f) => f.n[2] > 0.5 || f.n[1] > 0.5);
  const warmPorch = [...porch.filter((f) => f.n[1] > 0.5), ...coping.filter((f) => f.n[1] > 0.5 || f.n[2] > 0.5)];
  // The solids drawn up from the ground by `KILN_K`, frames and all, as an anvil's are, so what is painted on them grows with them.
  const big = (q: V3): V3 => mul(q, KILN_K);
  for (const p of parts) {
    if (p.faces) for (const f of p.faces) {
      f.pts = f.pts.map(big);
      if (f.frame) f.frame = { o: big(f.frame.o), a: big(f.frame.a), b: big(f.frame.b) };
    }
    if (p.solid) { p.x *= KILN_K; p.y *= KILN_K; }
  }
  const grown = (s: Side): Side => ({ ...s, o: big(s.o), a: big(s.a), b: big(s.b), poly: s.poly.map(big) });
  kilnModel = {
    parts, slab: slabPart, drum: drumPart, band: bandPart, dome: domePart, porch: porchPart, coping: copingPart,
    front: grown(frontSide), back: grown(back as unknown as Side), runes: runes.map((r) => ({ ...r, s: grown(r.s) })), spies: spies.map(grown), panels: panels.map(grown), warmPlinth, warmPorch, pots, warmDrum: drum.filter((f) => f.n[1] > 0.35), warmBand: band.filter((f) => f.n[1] > 0.35), flue: flue.map(big), turf,
  };
  return kilnModel;
}

/** The light in a kiln's mouth, vent, port and spy holes, its runes', and its own stone's after dark: everything that is laid over its bake as it burns. */
interface KilnBake {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  bounds: [number, number, number, number];
  hit: [number, number, number, number];
  /** The fire in the mouth, the flue and the draught port, in one: they breathe together. */
  fire: Lamp | null;
  /** The runes' lit grooves and the spy holes, in one: soft while it is only lit, all lit while it fires; and at the smallest scale the runes in a deeper gold. */
  runeGold?: Lamp | null;
  runes: Lamp | null;
  /** The mouth's light on its plinth and porch and the runes' glow round them, as colour by day and light after dark. */
  warm: Lamp | null;
  /** The heart of the fire in the mouth, laid on as light while it fires, and the load of pots in it, against that. */
  heart: Lamp | null;
  ware: Lamp | null;
  /** A white-gold flare at the flue and a tongue of flame out of it, while it fires. */
  flare: Lamp;
  tongue: Lamp;
  /** After dark, over the night: the runes, the mouth, the vent, the port and the spy holes, and a bloom of heat round the mouth and vent, added as light. */
  glow: Lamp | null;
  glowRunes: Lamp | null;
  /** Its stone in the night's colour, laid over it after dark so its own light does not lift it to white. */
  shade: HTMLCanvasElement;
  /** The same two with no ware on its plinth, as it is drawn while it fires (the ware is in it). */
  bare: HTMLCanvasElement;
  bareShade: HTMLCanvasElement;
  /** The middle of the flue, on the screen at zoom one from the footprint's middle. */
  flueAt: Pt;
  area: number;
}

const kilnBakes = new Bakes<KilnBake>();

function bakeKiln(rotation: number, scale: number): KilnBake {
  const m = kilnOf();
  const e = eyeOf(0, rotation);
  const [x0, y0, x1, y1] = measure(m.parts, e, m.turf, 6);
  const W = (x1 - x0) * scale, H = (y1 - y0) * scale;
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  const withWare = laid(m.parts, e);
  // Its lights are kept off what stands in front of them as it fires, with the ware inside.
  const order = withWare.filter((p) => !m.pots.includes(p));
  const base = (ord: readonly Part[]): [HTMLCanvasElement, HTMLCanvasElement] => {
    const [canvas, g] = sheetOf(W, H, M0);
    /* -- its shadow and the beaten ground round its plinth -- */
    polyPath(g, e, m.turf);
    g.fillStyle = 'rgba(150, 138, 120, 0.12)';
    g.fill();
    groundShade(g, e, rect(0, K_PLINTH_Y * KILN_K, K_PLINTH_H * KILN_K, K_PLINTH_H * KILN_K, 0), 2, 1, true);
    layParts(g, e, ord, new Set([m.slab, m.band, m.coping, m.parts.find((p) => p.tier === 5)!, ...m.pots]));
    /* -- the night it keeps: its solids whole in the night's colour, less what grows in front -- */
    const [shade, sg] = sheetOf(W, H, M0);
    sg.lineJoin = 'round';
    for (const p of ord) {
      if (p.solid) {
        sg.globalCompositeOperation = 'source-over';
        sg.fillStyle = sg.strokeStyle = NIGHT_STONE;
        sg.lineWidth = INK * 2;
        for (const f of seenFaces(e, p)) { polyPath(sg, e, f.pts); sg.fill(); sg.stroke(); }
      } else if (p.draw) {
        sg.globalCompositeOperation = 'destination-out';
        p.draw(sg, e);
      }
    }
    sg.globalCompositeOperation = 'source-over';
    return [canvas, shade];
  };
  const [canvas, shade] = base(withWare);
  const [bare, bareShade] = base(order);

  /* -- the mouth alight: the fire in it, its heart, and its light on its own plinth and porch -- */
  const fs = m.front;
  const seesFront = dot(fs.n, e.toward) / Math.hypot(...e.toward) > 0.12;
  const keep = (l: Lamp, from: Part | null): void => {
    const lg = l.canvas.getContext('2d') as Ctx;
    lg.setTransform(scale, 0, 0, scale, -l.box[0] * scale, -l.box[1] * scale);
    lessInFront(lg, e, order, from);
  };
  let mouth: Lamp | null = null, heart: Lamp | null = null, ware: Lamp | null = null, mouthAt: Pt | null = null, mouthTop: Pt | null = null, mouthHalf = 0;
  const spills: Lamp[] = [], spillW: number[] = [];
  if (seesFront) {
    const M = sideM(e, fs);
    const cx = fs.w / 2;
    const corners: V3[] = [[cx - K_MOUTH_W, 0], [cx + K_MOUTH_W, 0], [cx + K_MOUTH_W, K_MOUTH_TOP], [cx - K_MOUTH_W, K_MOUTH_TOP]].map(([x, z]) => at(fs.o, [x, fs.a], [z, fs.b]));
    const box = boxOf(e, corners, 1);
    const inMouth = (h: Ctx): void => {
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      kilnMouthPath(h, cx, 0, 0);
      h.clip();
    };
    mouth = lamp(box, scale, (h) => {
      h.save();
      inMouth(h);
      const gr = h.createRadialGradient(cx, 0.3, 0.15, cx, 0.7, K_MOUTH_W * 1.1);
      for (const [k, c] of FIRE) gr.addColorStop(k, c);
      h.fillStyle = gr;
      h.fillRect(cx - K_MOUTH_W - 1, -1, 2 * K_MOUTH_W + 2, K_MOUTH_TOP + 2);
      const T = rand(913);
      for (let j = 0; j < 3; j++) {
        const fx = cx + (j - 1) * 1.15 + (T() - 0.5) * 0.3, top = 1.2 + T() * 1.0, wd = 0.5 + T() * 0.25;
        h.beginPath();
        h.moveTo(fx - wd, 0.3);
        h.quadraticCurveTo(fx - wd * 0.9, top * 0.55, fx + (T() - 0.5) * 0.4, top);
        h.quadraticCurveTo(fx + wd * 0.9, top * 0.55, fx + wd, 0.3);
        h.closePath();
        h.fillStyle = 'rgba(255, 236, 170, 0.55)';
        h.fill();
      }
      for (let j = 0; j < 9; j++) {
        h.beginPath();
        h.ellipse(cx + (T() - 0.5) * 2 * (K_MOUTH_W - 0.3), 0.2 + T() * 0.4, 0.22 + T() * 0.22, 0.14, 0, 0, TAU);
        h.fillStyle = T() < 0.5 ? 'rgba(255, 244, 196, 0.95)' : 'rgba(234, 110, 60, 0.95)';
        h.fill();
      }
      // A dark lip round the inside of the arch, so the fire keeps its shape against the lit porch.
      kilnMouthPath(h, cx, 0, 0);
      h.strokeStyle = 'rgba(92, 52, 64, 0.8)';
      h.lineWidth = 0.32;
      h.stroke();
      h.restore();
    });
    heart = lamp(box, scale, (h) => {
      h.save();
      inMouth(h);
      // A white-hot core low in the mouth, falling off before the jambs so the orange of the fire still rings it.
      const gr = h.createRadialGradient(cx, 0.6, 0, cx, 0.6, K_MOUTH_W * 0.95);
      gr.addColorStop(0, 'rgba(255, 250, 230, 1)');
      gr.addColorStop(0.45, 'rgba(255, 214, 150, 0.55)');
      gr.addColorStop(1, 'rgba(255, 140, 70, 0)');
      h.fillStyle = gr;
      h.fillRect(cx - K_MOUTH_W - 1, -1, 2 * K_MOUTH_W + 2, K_MOUTH_TOP + 2);
      h.restore();
    });
    // The load: pots stood on the floor of the chamber, dark against the fire behind them and lit along their rims.
    // Not at the smallest scale, where its few pixels would muddy the fire into a cool pink instead of showing a load.
    ware = scale <= 1 ? null : lamp(box, scale, (h) => {
      h.save();
      inMouth(h);
      for (const [dx, ht, wd] of [[-1.15, 1.05, 0.48], [0.1, 1.35, 0.6], [1.2, 0.95, 0.44]] as Array<[number, number, number]>) {
        const x = cx + dx;
        // Belly, shoulder, a short neck and a flared rim.
        const pot = (): void => {
          h.beginPath();
          h.moveTo(x - wd * 0.5, 0);
          h.bezierCurveTo(x - wd * 1.2, ht * 0.25, x - wd * 1.15, ht * 0.62, x - wd * 0.42, ht * 0.78);
          h.lineTo(x - wd * 0.36, ht * 0.9);
          h.lineTo(x - wd * 0.58, ht);
          h.lineTo(x + wd * 0.58, ht);
          h.lineTo(x + wd * 0.36, ht * 0.9);
          h.lineTo(x + wd * 0.42, ht * 0.78);
          h.bezierCurveTo(x + wd * 1.15, ht * 0.62, x + wd * 1.2, ht * 0.25, x + wd * 0.5, 0);
          h.closePath();
        };
        pot();
        h.fillStyle = 'rgba(64, 38, 54, 0.95)';
        h.fill();
        // The fire behind it catching its outline.
        h.strokeStyle = 'rgba(255, 226, 160, 0.95)';
        h.lineWidth = 0.13;
        h.stroke();
      }
      h.restore();
    });
    keep(mouth, m.porch);
    keep(heart, m.porch);
    if (ware) keep(ware, m.porch);
    mouthAt = proj(e, at(fs.o, [cx, fs.a], [0.3, fs.b]));
    mouthTop = proj(e, at(fs.o, [cx, fs.a], [K_MOUTH_TOP, fs.b]));
    mouthHalf = Math.hypot(...proj(e, mul(fs.a, K_MOUTH_W)));
    // Its light out over the hearth on its plinth, and up the porch's dressings, warmest at the mouth; each kept off what stands in front of it.
    const reach = 14;
    for (const [faces, from, wgt] of [[m.warmPlinth, m.slab, 1], [m.warmDrum, m.drum, 0.75], [m.warmBand, m.band, 0.6], [m.warmPorch, m.coping, 0.2]] as Array<[Face[], Part, number]>) {
      const sbox = boxOf(e, faces.flatMap((f) => f.pts), 1);
      const at0 = mouthAt;
      const l = lamp([Math.max(sbox[0], at0[0] - reach * 1.6), Math.max(sbox[1], at0[1] - reach * 1.4), Math.min(sbox[2], at0[0] + reach * 1.6), Math.min(sbox[3], at0[1] + reach * 0.9)], scale, (h) => {
        h.save();
        h.beginPath();
        for (const f of faces) {
          if (dot(f.n, e.toward) <= 1e-6) continue;
          f.pts.map((q) => proj(e, [q[0], q[1], Math.max(0, q[2])])).forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
          h.closePath();
        }
        h.clip();
        h.translate(at0[0], at0[1]);
        h.scale(1.45, 1);
        const gr = h.createRadialGradient(0, 0, 0, 0, 0, reach);
        gr.addColorStop(0, 'rgba(255, 196, 120, 0.85)');
        gr.addColorStop(0.22, 'rgba(255, 160, 96, 0.4)');
        gr.addColorStop(0.6, 'rgba(255, 150, 90, 0.1)');
        gr.addColorStop(1, 'rgba(255, 150, 90, 0)');
        h.fillStyle = gr;
        h.fillRect(-reach, -reach, 2 * reach, 2 * reach);
        h.restore();
        h.save();
        h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
        kilnMouthPath(h, cx, 0, 0);
        h.globalCompositeOperation = 'destination-out';
        h.fill();
        h.restore();
      });
      keep(l, from);
      spills.push(l);
      spillW.push(wgt);
    }
  } else {
    // The mouth turned away, its light still out over the hearth in front of it, kept off what stands before that.
    const hearth = proj(e, at(fs.o, [fs.w / 2, fs.a], [0.3, fs.b], [1.6 * KILN_K, [0, 1, 0]]));
    const reach = 12;
    const sbox = boxOf(e, m.warmPlinth.flatMap((f) => f.pts), 1);
    const l = lamp([Math.max(sbox[0], hearth[0] - reach * 1.6), Math.max(sbox[1], hearth[1] - reach), Math.min(sbox[2], hearth[0] + reach * 1.6), Math.min(sbox[3], hearth[1] + reach * 0.9)], scale, (h) => {
      h.save();
      h.beginPath();
      for (const f of m.warmPlinth) {
        if (dot(f.n, e.toward) <= 1e-6) continue;
        f.pts.map((q) => proj(e, [q[0], q[1], Math.max(0, q[2])])).forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
        h.closePath();
      }
      h.clip();
      h.translate(hearth[0], hearth[1]);
      h.scale(1.45, 1);
      const gr = h.createRadialGradient(0, 0, 0, 0, 0, reach);
      gr.addColorStop(0, 'rgba(255, 186, 110, 0.7)');
      gr.addColorStop(0.3, 'rgba(255, 160, 96, 0.3)');
      gr.addColorStop(1, 'rgba(255, 150, 90, 0)');
      h.fillStyle = gr;
      h.fillRect(-reach, -reach, 2 * reach, 2 * reach);
      h.restore();
    });
    keep(l, m.slab);
    spills.push(l);
    spillW.push(1);
  }

  /* -- the draught port alight, where the back is seen -- */
  let port: Lamp | null = null;
  if (dot(m.back.n, e.toward) > 1e-6) {
    const bs = m.back, M = sideM(e, bs), px = bs.w / 2;
    const corners: V3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at(bs.o, [px + u * K_PORT_R, bs.a], [K_PORT_Z + v * K_PORT_R, bs.b]));
    port = lamp(boxOf(e, corners, 1), scale, (h) => {
      h.save();
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      h.beginPath();
      h.arc(px, K_PORT_Z, K_PORT_R, 0, TAU);
      const gr = h.createRadialGradient(px, K_PORT_Z - 0.15, 0, px, K_PORT_Z, K_PORT_R);
      gr.addColorStop(0, '#fff0c0');
      gr.addColorStop(0.45, '#ffc678');
      gr.addColorStop(1, '#e8945e');
      h.fillStyle = gr;
      h.fill();
      h.restore();
    });
    keep(port, m.drum);
  }

  /* -- the spy holes alight, where their sides are seen -- */
  const spyLamps: Lamp[] = [];
  for (const ss of m.spies) {
    // Not seen all but edge on, where its light would be a sliver at the dome's rim.
    if (dot(ss.n, e.toward) / Math.hypot(...e.toward) < 0.3) continue;
    const M = sideM(e, ss), px = ss.w / 2, pz = ss.h / 2;
    const corners: V3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at(ss.o, [px + u * SPY_R * SPY_RING, ss.a], [pz + v * SPY_R, ss.b]));
    const l = lamp(boxOf(e, corners, 1), scale, (h) => {
      h.save();
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      h.beginPath();
      h.ellipse(px, pz, SPY_R, SPY_R * 0.86, 0, 0, TAU);
      const gr = h.createRadialGradient(px, pz, 0, px, pz, SPY_R);
      gr.addColorStop(0, '#fff4cc');
      gr.addColorStop(0.5, '#ffc070');
      gr.addColorStop(1, '#e8945e');
      h.fillStyle = gr;
      h.fill();
      h.restore();
    });
    keep(l, m.dome);
    spyLamps.push(l);
  }

  /* -- the flue alight -- */
  const flueBox = boxOf(e, m.flue, 3);
  const flue = lamp(flueBox, scale, (h) => {
    polyPath(h, e, m.flue);
    const [fx, fy] = proj(e, centre(m.flue));
    const gr = h.createRadialGradient(fx, fy, 0, fx, fy, Math.max(flueBox[2] - flueBox[0], flueBox[3] - flueBox[1]) * 0.55);
    gr.addColorStop(0, '#ffe2a8');
    gr.addColorStop(0.4, '#ffa95e');
    gr.addColorStop(1, '#c4503e');
    h.fillStyle = gr;
    h.fill();
    // The inner wall of the flue a dark ring inside its lip, so it reads as fire down a hole.
    polyPath(h, e, m.flue);
    h.strokeStyle = 'rgba(110, 52, 58, 0.7)';
    h.lineWidth = 0.9;
    h.stroke();
    // And a warm ring round it on the rim, so a lit vent shows at zoom one.
    const c0 = centre(m.flue);
    polyPath(h, e, m.flue.map((q) => add(c0, mul(sub(q, c0), (FLUE_R + 0.3) / FLUE_R))));
    h.strokeStyle = 'rgba(255, 188, 104, 0.95)';
    h.lineWidth = 1.5;
    h.stroke();
  });
  /*
   * The flue as it is added to the night: redder, as light added over the
   * night's blue-green comes up yellow-green from a yellow, and its inner wall
   * dark round it, so it reads as fire down a hole and not as a lemon lid.
   */
  const flueNight = lamp(flueBox, scale, (h) => {
    polyPath(h, e, m.flue);
    const [fx, fy] = proj(e, centre(m.flue));
    const gr = h.createRadialGradient(fx, fy, 0, fx, fy, Math.max(flueBox[2] - flueBox[0], flueBox[3] - flueBox[1]) * 0.5);
    gr.addColorStop(0, 'rgb(255, 170, 110)');
    gr.addColorStop(0.5, 'rgb(236, 104, 60)');
    gr.addColorStop(1, 'rgb(120, 40, 40)');
    h.fillStyle = gr;
    h.fill();
  });
  const flueAt = proj(e, centre(m.flue));
  // The heat of it on the dome round the vent, laid with the mouth's light on its stone.
  {
    const reach = 11;
    const domeSeen = seenFaces(e, m.dome);
    const l = lamp([flueAt[0] - reach * 1.4, flueAt[1] - 2, flueAt[0] + reach * 1.4, flueAt[1] + reach * 1.2], scale, (h) => {
      h.save();
      h.beginPath();
      for (const f of domeSeen) f.pts.forEach((q, i) => { const [x, y] = proj(e, q); if (i) h.lineTo(x, y); else h.moveTo(x, y); });
      h.clip('nonzero');
      h.translate(flueAt[0], flueAt[1] + 3);
      h.scale(1.4, 1);
      const gr = h.createRadialGradient(0, 0, 0, 0, 0, reach);
      gr.addColorStop(0, 'rgba(255, 190, 120, 0.55)');
      gr.addColorStop(0.45, 'rgba(255, 170, 110, 0.18)');
      gr.addColorStop(1, 'rgba(255, 160, 100, 0)');
      h.fillStyle = gr;
      h.fillRect(-reach, -reach, 2 * reach, 2 * reach);
      h.restore();
    });
    keep(l, m.dome);
    spills.push(l);
    spillW.push(1.2);
  }

  /* -- the runes' light, on the sides of the band the eye sees, and the sun over the mouth -- */
  const runes: Array<{ gl: Glow; seen: number }> = [];
  // Kept to the solid it is cut in as a whole, not to its one side: a side of it is narrower than a rune's glow, and would square it off.
  const keepTo = (c: HTMLCanvasElement, box: readonly number[], from: Part): void => {
    const h = c.getContext('2d') as Ctx;
    h.setTransform(scale, 0, 0, scale, -box[0] * scale, -box[1] * scale);
    h.globalCompositeOperation = 'destination-in';
    h.beginPath();
    for (const f of seenFaces(e, from)) f.pts.forEach((q, i) => { const [x, y] = proj(e, q); if (i) h.lineTo(x, y); else h.moveTo(x, y); });
    h.fill('nonzero');
    h.globalCompositeOperation = 'source-over';
    lessInFront(h, e, order, from);
  };
  const layRune = (s: Side, glyph: string, x: number, z: number, size: number, w: number, from: Part, i: number): void => {
    const cos = dot(s.n, e.toward) / Math.hypot(...e.toward);
    if (cos < GLOW_SEEN) return;
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const gl = bakeRune(sideM(e, s), { glyph, x, z, s: size, i, w: Math.max(w, 1.1 / scale), inner: RUNE_INNER, mid: RUNE_MID, edge: RUNE_CHANNEL }, scale);
    for (const c of [gl.core, gl.halo, gl.dusk]) keepTo(c, gl.box, from);
    runes.push({ gl, seen: fade * fade * (3 - 2 * fade) });
  };
  m.runes.forEach((r, j) => layRune(r.s, r.glyph, r.s.w / 2, r.s.h / 2, K_RUNE_S, K_RUNE_W, m.band, j));
  m.panels.forEach((ps, j) => layRune(ps, PANEL_RUNE, ps.w / 2, K_PANEL_RUNE_Z, K_PANEL_S, 0.36, m.drum, 10 + j));

  /* -- a bloom of heat round the mouth and the vent, a flare at the flue, and a tongue of flame out of it -- */
  const bloom = (p: Pt, r: number, c0: string, c1: string): Lamp => lamp([p[0] - r, p[1] - r, p[0] + r, p[1] + r], scale, (h) => {
    const gr = h.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.45, c1);
    gr.addColorStop(1, 'rgba(255, 150, 80, 0)');
    h.fillStyle = gr;
    h.fillRect(p[0] - r, p[1] - r, 2 * r, 2 * r);
  });
  // A tongue of flame rising from `p`, `w` either side and `ht` high, in pixels at zoom one.
  function lick(p: Pt, w: number, ht: number): Lamp {
    return lamp([p[0] - w - 1, p[1] - ht - 1, p[0] + w + 1, p[1] + 1.5], scale, (h) => {
      for (const [dx, k, top] of [[0, 1, ht], [-w * 0.45, 0.55, ht * 0.7], [w * 0.5, 0.5, ht * 0.6]] as Array<[number, number, number]>) {
        const x = p[0] + dx, ww = w * k;
        h.beginPath();
        h.moveTo(x - ww, p[1] + 0.8);
        h.bezierCurveTo(x - ww * 1.05, p[1] - top * 0.45, x - ww * 0.4, p[1] - top * 0.85, x, p[1] - top);
        h.bezierCurveTo(x + ww * 0.4, p[1] - top * 0.85, x + ww * 1.05, p[1] - top * 0.45, x + ww, p[1] + 0.8);
        h.closePath();
        const gr = h.createLinearGradient(0, p[1] + 0.8, 0, p[1] - top);
        gr.addColorStop(0, 'rgba(255, 244, 206, 0.85)');
        gr.addColorStop(0.5, 'rgba(255, 186, 96, 0.7)');
        gr.addColorStop(1, 'rgba(240, 120, 70, 0)');
        h.fillStyle = gr;
        h.fill();
      }
    });
  }
  const blooms = [bloom([flueAt[0], flueAt[1] - 2], 9, 'rgba(255, 196, 120, 1)', 'rgba(255, 150, 80, 0.35)'), ...(mouthAt ? [bloom([mouthAt[0], mouthAt[1] - 3], 12, 'rgba(255, 196, 120, 1)', 'rgba(255, 150, 80, 0.35)')] : [])];
  // And a flare at the mouth with it, firing.
  const flare = composed([
    { c: bloom([flueAt[0], flueAt[1] - 2], 13, 'rgba(255, 252, 232, 1)', 'rgba(255, 214, 140, 0.6)'), a: 1 },
    // And white at the lip of the collar itself.
    { c: bloom([flueAt[0], flueAt[1] - 1], 4, 'rgba(255, 255, 250, 1)', 'rgba(255, 250, 230, 0.95)'), a: 1 },
    ...(mouthAt ? [{ c: bloom([mouthAt[0], mouthAt[1] - 2.5], 6, 'rgba(255, 236, 190, 1)', 'rgba(255, 170, 100, 0.45)'), a: 0.35 }] : []),
    // And flame licking out of the head of the mouth, up the porch's face.
    ...(mouthTop && scale > 1 ? [{ c: lick(mouthTop, mouthHalf * 0.5, 5), a: 0.45 }] : []),
  ].map(({ c, a }) => ({ c: c.canvas, box: c.box, a })), scale)!;
  // The tongue: as wide as the flue's mouth, two soft lobes rising to a rounded crown, gold at its root.
  const fw = (flueBox[2] - flueBox[0] - 4) * 0.5, TH = 7;
  const tongue = lamp([flueAt[0] - fw - 1, flueAt[1] - TH - 1, flueAt[0] + fw + 1, flueAt[1] + 1.5], scale, (h) => {
    const [fx, fy] = flueAt;
    const lobe = (x: number, w: number, top: number, a: number): void => {
      h.beginPath();
      h.moveTo(x - w, fy + 0.6);
      h.bezierCurveTo(x - w * 1.05, fy - top * 0.45, x - w * 0.45, fy - top * 0.85, x, fy - top);
      h.bezierCurveTo(x + w * 0.45, fy - top * 0.85, x + w * 1.05, fy - top * 0.45, x + w, fy + 0.6);
      h.closePath();
      const gr = h.createLinearGradient(0, fy + 0.6, 0, fy - top);
      gr.addColorStop(0, `rgba(255, 246, 214, ${a})`);
      gr.addColorStop(0.5, `rgba(255, 196, 104, ${a * 0.85})`);
      gr.addColorStop(1, 'rgba(240, 120, 70, 0)');
      h.fillStyle = gr;
      h.fill();
    };
    lobe(fx, fw, TH, 0.75);
    lobe(fx - fw * 0.3, fw * 0.55, TH * 0.8, 0.8);
    lobe(fx + fw * 0.32, fw * 0.5, TH * 0.65, 0.8);
  });

  /* -- laid together, each set as a frame lays it -- */
  const lit = [mouth, flue, port].filter((l): l is Lamp => !!l);
  const fire = composed(lit.map((l) => ({ c: l.canvas, box: l.box, a: 1 })), scale);
  const runeLamp = composed([...runes.map(({ gl, seen }) => ({ c: gl.core, box: gl.box, a: seen })), ...spyLamps.map((l) => ({ c: l.canvas, box: l.box, a: 1 }))], scale);
  /*
   * At the smallest scale, the same in a deeper gold all through: there a
   * rune's white heart and gold edge run together into cream on cream, and a
   * lit rune by day must read as gold.
   */
  let runeGold: Lamp | null = null;
  if (scale <= 1) {
    runeGold = composed(runes.map(({ gl, seen }) => ({ c: gl.core, box: gl.box, a: seen })), scale);
    if (runeGold) {
      const h = runeGold.canvas.getContext('2d') as Ctx;
      h.globalCompositeOperation = 'source-in';
      h.fillStyle = '#f2b450';
      h.fillRect(0, 0, runeGold.canvas.width, runeGold.canvas.height);
    }
  }
  const warm = composed([...spills.map((l, j) => ({ c: l.canvas, box: l.box, a: spillW[j] })), ...runes.map(({ gl, seen }) => ({ c: gl.halo, box: gl.box, a: seen * gl.square * 0.35 }))], scale);
  const glow = composed([
    // The vent's bloom a little under the mouth's, so the two read as one fire.
    ...blooms.map((l, j) => ({ c: l.canvas, box: l.box, a: (j === 0 ? 0.22 : 0.3) * GLOW_GAIN, op: 'lighter' as const })),
    // The mouth a little less than the vent and port, so at night it keeps its arch and its fire's colours and does not go to white.
    ...lit.map((l) => (l === flue ? flueNight : l)).map((l) => ({ c: l.canvas, box: l.box, a: (l === mouth ? 0.36 : 0.55) * GLOW_GAIN, op: 'lighter' as const })),
  ], scale);
  // The runes and spy holes after dark apart from the fire, so that only lit they can stay dim while the mouth and vent burn.
  const glowRunes = composed([
    ...spyLamps.map((l) => ({ c: l.canvas, box: l.box, a: 0.55 * GLOW_GAIN, op: 'lighter' as const })),
    ...runes.map(({ gl, seen }) => ({ c: gl.core, box: gl.box, a: seen * 0.35 * GLOW_GAIN, op: 'lighter' as const })),
  ], scale);
  return {
    canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hit: kilnHitOf(m.parts, e),
    fire, runes: runeLamp, runeGold, warm, heart, ware, flare, tongue, glow, glowRunes, shade, bare, bareShade, flueAt,
    area: [canvas, shade, bare, bareShade, fire?.canvas, runeLamp?.canvas, runeGold?.canvas, warm?.canvas, heart?.canvas, ware?.canvas, flare.canvas, tongue.canvas, glow?.canvas, glowRunes?.canvas].reduce((n, c) => n + (c ? c.width * c.height : 0), 0),
  };
}

/** What it is clicked by: the box round its solids, as a smelter's, and round the grass and flowers at its plinth's foot, so it takes everything drawn of it. */
function kilnHitOf(parts: readonly Part[], e: Eye): [number, number, number, number] {
  const [l, t, r, bt] = hitOf(parts, e);
  const flora = parts.filter((p) => !p.solid && p.reach).flatMap((p) => p.reach!.flatMap((q) => [q, [q[0], q[1], 0] as V3]));
  const [fl, ft, fr, fb] = boxOf(e, flora, 2);
  return [Math.floor(Math.min(l, fl)), Math.floor(Math.min(t, ft)), Math.ceil(Math.max(r, fr)), Math.ceil(Math.max(bt, fb))];
}

function kilnBaked(rotation: number, zoom: number): KilnBake {
  const scale = scaleFor(zoom);
  const rot = ((rotation % 8) + 8) % 8;
  return kilnBakes.get(`${rot}|${scale}`, () => bakeKiln(rot, scale));
}

/** How hot it is drawn: nothing cold, more firing a load than only lit. */
const kilnHeat = (look: KilnLook): number => (look.lit ? (look.firing ? 1 : 0.75) : 0);
/**
 * How far into its breath its fire is at `t`, nought to one, with a flicker
 * over it: slower than a smelter's (`fireBreath`), a kiln being a slow fire,
 * and twice as quick firing a load.
 */
const kilnBreath = (t: number, firing: boolean): number => {
  const p = 0.5 + 0.5 * Math.sin((t / (firing ? 1.4 : 3.2)) * TAU + 0.9);
  const f = 0.5 + 0.5 * (0.6 * Math.sin(t * (firing ? 13.7 : 9.1) + 0.4) + 0.4 * Math.sin(t * 5.3 + 2.1));
  return Math.max(0, Math.min(1, (firing ? 0.6 : 0.75) * p + (firing ? 0.4 : 0.25) * f));
};

/**
 * Draw a kiln whose footprint's middle is at (sx, sy) on the screen, from
 * viewpoint `rotation`, at `t` seconds, under a night `night` dark: its
 * bake, and alight the fire in its mouth, vent and port, its runes and spy
 * holes and its light on its own stone; and unless `live` is false, the flare
 * and the tongue of flame at its vent while it fires (`drawKilnLive`). Its
 * glow over the night is laid after (`drawKilnNight`). Returns what it covers
 * from (sx, sy) in screen pixels: left, top, right, bottom.
 */
export function drawKiln(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: KilnLook, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = kilnBaked(rotation, zoom);
  const k = zoom / b.scale;
  const X = sx - b.ox * k, Y = sy - b.oy * k, Wd = b.canvas.width * k, Ht = b.canvas.height * k;
  ctx.drawImage(look.lit && look.firing ? b.bare : b.canvas, X, Y, Wd, Ht);
  const heat = kilnHeat(look);
  if (heat <= 0 && b.runes) {
    // Cold, the gold still in its runes' grooves, faint, as a runestone's by day.
    const wasA = ctx.globalAlpha;
    ctx.globalAlpha = wasA * 0.4;
    lay(ctx, b.runes, sx, sy, zoom);
    ctx.globalAlpha = wasA;
  }
  if (heat > 0) {
    const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
    const p = kilnBreath(t, look.firing);
    if (night > 0.02) {
      // As much of the night kept as its own light takes off: less while it is only lit and its light is low (`KILN_GLOW`).
      ctx.globalAlpha = wasA * night * 0.42 * (look.firing ? 1 : KILN_GLOW / KILN_GLOW_FIRING) ** 2;
      ctx.drawImage(look.firing ? b.bareShade : b.shade, X, Y, Wd, Ht);
    }
    if (b.warm) {
      ctx.globalAlpha = wasA * heat * heat * ((1 - night) * ((look.firing ? 0.72 : 0.4) + 0.2 * p) + night * (0.8 + 0.2 * p));
      lay(ctx, b.warm, sx, sy, zoom);
    }
    if (b.fire) {
      // Only lit, a bed of embers a little dulled; firing a load, the whole of it.
      ctx.globalAlpha = wasA * Math.min(1, (look.firing ? 0.92 : 0.94) + 0.08 * p);
      lay(ctx, b.fire, sx, sy, zoom);
    }
    if (b.ware && look.firing) {
      ctx.globalAlpha = wasA;
      lay(ctx, b.ware, sx, sy, zoom);
    }
    if (b.runes) {
      // Only lit, its runes and spy holes warm in their grooves; firing, every one of them lit.
      ctx.globalAlpha = wasA * (look.firing ? 0.92 + 0.08 * p : 0.38 + 0.08 * p);
      lay(ctx, b.runes, sx, sy, zoom);
    }
    if (b.fire && b.scale <= 1 && look.firing) {
      // At the smallest scale its fire laid again as light, hotter and yellower, not whitened: a few pixels of white read pale.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = wasA * (0.7 + 0.2 * p);
      lay(ctx, b.fire, sx, sy, zoom);
    }
    if (b.heart && (b.scale > 1 || !look.firing)) {
      // Its heart: a glow at the bed while only lit, white-hot firing.
      ctx.globalCompositeOperation = 'lighter';
      // At the smallest scale the mouth is a few pixels: its core kept to a spark in it, so the orange of the fire still shows round it.
      ctx.globalAlpha = wasA * (look.firing ? 0.8 + 0.2 * p : 0.5 + 0.1 * p) * (1 - 0.45 * night) * (b.scale > 1 ? 1 : 0.5);
      lay(ctx, b.heart, sx, sy, zoom);
    }
    if (look.firing) {
      // Firing, its runes lit as light over their gold, so they burn even by day.
      ctx.globalCompositeOperation = 'lighter';
      // Not at the smallest scale, where it would run a rune's strokes together into a block of light.
      if (b.runes && b.scale > 1) {
        ctx.globalAlpha = wasA * (0.18 + 0.08 * p);
        lay(ctx, b.runes, sx, sy, zoom);
      } else if (b.runeGold) {
        // There its runes laid again in a deeper gold, so three or four show as gold pixels by day, not cream.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = wasA * (0.75 - 0.5 * night);
        lay(ctx, b.runeGold, sx, sy, zoom);
      }
    }
    ctx.globalAlpha = wasA;
    ctx.globalCompositeOperation = was;
  }
  if (live) drawKilnLive(ctx, sx, sy, zoom, rotation, look, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** Embers up out of the vent while it fires: how many, the seconds each takes to rise and go out, and how high it gets in pixels at zoom one. */
const EMBERS = 7;
const EMBER_RISE = 1.6;
const EMBER_HIGH = 32;

/**
 * What of a kiln moves over its bake, outside the pointer's ring: firing a
 * load, a white-gold flare at its flue, a tongue of flame licking up out of
 * it, and a few embers. Only lit, nothing: its fire and runes breathe under
 * the ring.
 */
export function drawKilnLive(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: KilnLook, night = 0, t = performance.now() / 1000): void {
  void night;
  if (!look.lit || !look.firing) return;
  const b = kilnBaked(rotation, zoom);
  const p = kilnBreath(t, true);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalAlpha = wasA * (0.6 + 0.4 * p);
  lay(ctx, b.flare, sx, sy, zoom);
  // The tongue: as tall as the fire is drawing, from the flue's mouth up.
  const [tx, ty, tw, th] = b.tongue.box;
  const lick = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 9.3) * Math.sin(t * 4.1 + 1));
  const base = sy + (ty + th) * zoom;
  ctx.globalAlpha = wasA * (0.7 + 0.3 * p);
  ctx.drawImage(b.tongue.canvas, sx + tx * zoom, base - th * lick * zoom, tw * zoom, th * lick * zoom);
  ctx.lineCap = 'round';
  const w = Math.max(2, 1.15 * zoom ** 0.8);
  for (let i = 0; i < EMBERS; i++) {
    const u = ((t / (EMBER_RISE + (i % 2) * 0.3) + i * 0.437) % 1 + 1) % 1;
    // Each from its own place across the flue's mouth, already over the tongue.
    const sway = (((i * 0.618) % 1) - 0.5) * tw * 0.7 + Math.sin(u * 4.6 + i * 2.3) * (1.5 + 2.5 * u);
    const x = sx + (b.flueAt[0] + sway) * zoom, y = sy + (b.flueAt[1] - 6 - u * EMBER_HIGH) * zoom;
    const len = (0.5 + 0.9 * (1 - u)) * zoom;
    ctx.globalAlpha = wasA * Math.pow(1 - u, 1.2) * Math.min(1, u * 8);
    ctx.lineWidth = w * (1 - 0.35 * u);
    ctx.strokeStyle = u < 0.3 ? 'rgb(255, 246, 214)' : 'rgb(255, 180, 96)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * A kiln alight after dark: its runes, mouth, vent, port and spy holes and the
 * bloom of heat round its mouth and vent added as light, laid straight after
 * it in its own place among what is drawn, as a smelter's (`drawSmelterNight`),
 * turned up by `over`, what the night's wash will take off it there.
 */
export function drawKilnNight(ctx: Ctx, sx: number, sy: number, zoom: number, rotation: number, look: KilnLook, night: number, t = performance.now() / 1000, over = 0): void {
  const heat = kilnHeat(look);
  if (heat <= 0 || night <= 0.02) return;
  const b = kilnBaked(rotation, zoom);
  const p = kilnBreath(t, look.firing);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  const k = wasA * night * underWash(over) / GLOW_GAIN;
  if (b.glow) {
    ctx.globalAlpha = Math.min(1, k * (look.firing ? 0.85 + 0.15 * p : 0.46 + 0.08 * p));
    lay(ctx, b.glow, sx, sy, zoom);
  }
  // Only lit, its runes and spy holes a glimmer; firing a load, all lit.
  if (b.glowRunes) {
    ctx.globalAlpha = Math.min(1, k * (look.firing ? 0.85 + 0.15 * p : 0.2 + 0.05 * p));
    lay(ctx, b.glowRunes, sx, sy, zoom);
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** What it is clicked by, from its footprint's middle, in pixels at zoom one: the box round its solids. */
export function kilnHit(rotation: number, zoom = 1): [number, number, number, number] {
  return kilnBaked(rotation, zoom).hit;
}

/** What it is drawn over, from its footprint's middle, in pixels at zoom one: left, top, right, bottom. */
export function kilnBounds(rotation: number, zoom = 1): [number, number, number, number] {
  return kilnBaked(rotation, zoom).bounds;
}

/* ---- the anvil -------------------------------------------------------------- */

/** The block it stands on: the rune lantern's cream stone; and the rune cut in its front. */
const BLOCK: Tone = toneOf('#eadbc2', '#a89794');
const BLOCK_RUNE = 'thurisaz';
/**
 * Each metal an anvil is cast from, as the colour of a face full in the light
 * and one turned away from it: every one its own hue, kept in the island's
 * pastels so it sits with the stone, and far enough from the next that an
 * anvil says what it is made of from across a deed.
 */
export const ANVIL_METALS: Readonly<Record<string, readonly [string, string]>> = {
  iron: ['#a6b2c6', '#535d78'],
  steel: ['#c6ccd8', '#5e6476'],
  copper: ['#eba48a', '#8c4c4a'],
  bronze: ['#d8a878', '#7a5440'],
  brass: ['#e6cf86', '#87703c'],
  gold: ['#f6dc7a', '#a07a2e'],
  electrum: ['#ece4a6', '#88814e'],
  tin: ['#d2c6ac', '#7a6f5c'],
  pewter: ['#bcb8ae', '#6c6862'],
  zinc: ['#b6c8c2', '#5d716c'],
  lead: ['#9894aa', '#4c4862'],
  silver: ['#eaeef6', '#8a94ac'],
  adamantine: ['#8cc0a6', '#3c6a5c'],
  glimmersteel: ['#ace8ee', '#4a8c9e'],
  mithril: ['#b6cbf4', '#566ca6'],
  seryll: ['#d2baee', '#6c5894'],
};
/** The face and shade an anvil of a metal is drawn in, where that metal has its own (\`ANVIL_METALS\`). */
export const anvilTone = (metal: string): readonly [string, string] | undefined => ANVIL_METALS[metal];
/**
 * How much bigger than its tenths of a metre the anvil and its block are
 * drawn: a hair over life, so that at the furthest zoom it still reads as an
 * anvil beside a body and not a grey speck.
 */
const ANVIL_K = 1.18;
/** How many ways round one may stand, so a smithy's anvils are not all set down alike: by where it stands. */
export const ANVIL_VARIANTS = 4;

/** Where its solids stand, in units: the block, then the anvil's foot, its waist, and its body's underside and face. */
const BLOCK_H = 5.0;
const FOOT_TOP = BLOCK_H + 1.2;
const WAIST_TOP = BLOCK_H + 2.9;
const FACE_Z = BLOCK_H + 5.4;

interface AnvilModel {
  parts: Part[];
  blockFront: Side;
  blockPart: Part;
  turf: V3[];
}

const anvilModels = new Map<string, AnvilModel>();

/** The colour a CSS 'rgb(r,g,b)' or '#rrggbb' says. */
const rgbOf = (c: string): RGB => {
  if (c.startsWith('#')) return hex(c);
  const n = c.match(/[\d.]+/g)?.map(Number) ?? [150, 150, 156];
  return [n[0] ?? 150, n[1] ?? 150, n[2] ?? 156];
};

function anvilOf(face: string, shade: string, variant: number): AnvilModel {
  const key = `${face}|${shade}|${variant}`;
  const had = anvilModels.get(key);
  if (had) return had;
  const seed = 5303 + variant * 71;
  const R = rand(seed);
  const parts: Part[] = [];
  const fc = rgbOf(face), sc = rgbOf(shade);
  /*
   * The metal in its own colours (\`ANVIL_METALS\`), and the polished face a
   * step paler still, so whatever it was cast from it is metal and not stone.
   */
  const METAL: Tone = { lit: fc, shade: sc };
  const POLISH: Tone = { lit: mix(METAL.lit, [255, 255, 255], 0.3), shade: mix(METAL.shade, METAL.lit, 0.25) };
  const sheen = (g: Ctx, k: PaintCtx, w: number, h: number, salt: number): void => {
    // Hammer-scale and a little dark at the foot of each side, and a cool light along its head.
    const T = rand(salt);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(40, 36, 52, 0.22)');
    gr.addColorStop(0.5, 'rgba(40, 36, 52, 0)');
    gr.addColorStop(0.85, 'rgba(240, 242, 255, 0)');
    gr.addColorStop(1, 'rgba(240, 242, 255, 0.28)');
    g.fillStyle = gr;
    g.fillRect(-1, 0, w + 2, h);
    g.fillStyle = css(mix(k.fill, hex('#3c3848'), 0.4), 0.35);
    for (let i = 0; i < Math.round(w * h * 0.6); i++) g.fillRect(T() * w, T() * h, 0.12 + 0.1 * T(), 0.12 + 0.1 * T());
  };

  /* -- the block: dressed stone, chamfered round its head, a margin drafted round each side and the rune in its front -- */
  let blockFront: Side | null = null;
  const block = prism([rect(0, 0, 5.4, 4.4, -0.4), rect(0, 0, 5.0, 4.0, BLOCK_H - 0.4), rect(0, 0, 4.6, 3.6, BLOCK_H)], BLOCK, (k, i, s) => {
    if (k !== 0) return { crease: 0.5 };
    if (i === 2) blockFront = s;
    return {
      paint: (g, kk) => {
        const fill = kk.fill;
        skin(g, fill, s.w, s.h, seed + i * 7, 1.2);
        cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(0.75, 0.6); g.lineTo(0.85, s.h - 0.55); g.lineTo(s.w - 0.85, s.h - 0.55); g.lineTo(s.w - 0.75, 0.6); });
        if (i === 2) {
          cutRune(g, fill, BLOCK_RUNE, s.w / 2, s.h / 2 + 0.1, 1.35, 0.44);
          for (const dx of [-2.1, 2.1]) cut(g, fill, 0.24, () => { g.beginPath(); g.moveTo(s.w / 2 + dx, s.h / 2 + 0.13); g.lineTo(s.w / 2 + dx, s.h / 2 + 0.07); });
        } else if (i === 0 || i === 3) {
          // Lichen on its shady sides, and the damp up out of the ground.
          const L = rand(seed + 31 + i);
          lichen(g, L, 1.4 + L() * (s.w - 2.8), 0.9 + L() * 1.6, 0.42 + L() * 0.18, ['#cdd2b0', '#bcc6aa']);
          g.beginPath();
          g.moveTo(-1, -1);
          for (let x = -1; x <= s.w + 1; x += 0.6) g.lineTo(x, 0.75 + 0.8 * noise2(x / 1.6, 0.5, seed + i));
          g.lineTo(s.w + 1, -1);
          g.closePath();
          g.fillStyle = css(mix(fill, hex('#7f8486'), 0.35), 0.4);
          g.fill();
        }
        // A scatter of scale knocked off the work, dark on its head.
        const S = rand(seed + 50 + i);
        g.fillStyle = 'rgba(70, 62, 80, 0.5)';
        for (let j = 0; j < 4; j++) g.fillRect(S() * s.w, s.h - 0.3 - S() * 0.6, 0.18, 0.12);
      },
    };
  }, {
    paint: (g, k) => {
      skin(g, k.fill, 9, 7, seed + 9, 0.8);
    },
  });
  const blockPart: Part = { x: 0, y: 0, faces: block, solid: true, tier: 0 };
  parts.push(blockPart);

  /* -- the anvil, its horn along its length (x), its heel at the other end -- */
  const AX = 0.6;
  // Its foot: broad, splayed to four feet at the corners and drawn in over them.
  const foot = prism([
    [[AX - 4.4, -2.8, BLOCK_H], [AX + 4.4, -2.8, BLOCK_H], [AX + 4.4, 2.8, BLOCK_H], [AX - 4.4, 2.8, BLOCK_H]],
    [[AX - 4.1, -2.5, BLOCK_H + 0.45], [AX + 4.1, -2.5, BLOCK_H + 0.45], [AX + 4.1, 2.5, BLOCK_H + 0.45], [AX - 4.1, 2.5, BLOCK_H + 0.45]],
    rect(AX, 0, 2.6, 1.9, FOOT_TOP),
  ], METAL, (_k, i, s) => ({ crease: 0.45, paint: (g, k) => sheen(g, k, s.w, s.h, seed + 60 + i) }));
  parts.push({ x: AX, y: 0, faces: foot, solid: true, tier: 1 });
  // Its waist: drawn in, and out again to the body.
  const waist = prism([rect(AX, 0, 2.6, 1.9, FOOT_TOP), rect(AX, 0, 1.75, 1.35, BLOCK_H + 2.1), rect(AX, 0, 2.5, 1.6, WAIST_TOP)], METAL,
    (_k, i, s) => ({ crease: 0.4, paint: (g, k) => sheen(g, k, s.w, s.h, seed + 70 + i) }));
  parts.push({ x: AX, y: 0, faces: waist, solid: true, tier: 2 });
  // Its body and heel: the face flat on top, the heel's underside sloping up to its end.
  const HEEL = AX - 7.0, ROOT = AX + 3.6, HW = 1.85;
  const bodyRing = (z: number, x0: number, x1: number, hw: number): V3[] => [[x0, -hw, z], [x1, -hw, z], [x1, hw, z], [x0, hw, z]];
  const body = prism([bodyRing(WAIST_TOP, AX - 3.2, ROOT, HW), bodyRing(WAIST_TOP + 1.0, HEEL, ROOT, HW), bodyRing(FACE_Z - 0.3, HEEL, ROOT, HW), bodyRing(FACE_Z, HEEL + 0.25, ROOT - 0.05, HW - 0.28)], METAL,
    (_k, i, s) => ({ crease: 0.4, paint: (g, k) => sheen(g, k, s.w, s.h, seed + 80 + i) }),
    {
      tone: POLISH,
      paint: (g, k) => {
        // The face, worn bright down its middle; the hardy hole square through the heel and the pritchel round beside it.
        // Frame: (0, 0) its middle, x along it toward the horn, y across.
        const len = ROOT - HEEL;
        const gr = g.createLinearGradient(0, -HW, 0, HW);
        gr.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gr.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
        gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = gr;
        g.fillRect(-len / 2 + 1.2, -HW, len - 2.4, 2 * HW);
        const hx = -len / 2 + 1.5;
        g.fillStyle = css(mix(k.fill, hex('#24222e'), 0.8));
        g.fillRect(hx - 0.42, -0.42, 0.84, 0.84);
        g.beginPath();
        g.arc(hx + 1.4, 0, 0.3, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.5)';
        g.fillRect(hx - 0.42, 0.42, 0.84, 0.12);
      },
    });
  // The face's top is painted in its own frame: from its middle, x along the anvil.
  parts.push({ x: AX, y: 0, faces: body, solid: true, tier: 3 });
  /*
   * The horn: rings across it from its root at the body to a blunt point,
   * each smaller and a little higher, its top dropping a step below the face
   * at the root (the table) and its underside sweeping up to the point.
   */
  const hornRing = (x: number, zc: number, hz: number, hy: number): V3[] => {
    const out: V3[] = [];
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU + TAU / 16;
      out.push([x, Math.cos(a) * hy, zc + Math.sin(a) * hz]);
    }
    return out;
  };
  const hornAt: Array<[number, number, number, number]> = [
    [ROOT - 0.05, FACE_Z - 1.15, 1.05, HW - 0.05],
    [ROOT + 2.4, FACE_Z - 0.98, 0.78, 1.3],
    [ROOT + 4.6, FACE_Z - 0.7, 0.42, 0.66],
    [ROOT + 5.9, FACE_Z - 0.5, 0.14, 0.2],
  ];
  const HORN_TOP: Tone = { lit: mix(METAL.lit, POLISH.lit, 0.5), shade: METAL.shade };
  const horn = prism(hornAt.map(([x, zc, hz, hy]) => hornRing(x, zc, hz, hy)), METAL, (_k, i) => {
    // The rings run along the horn: its sides are facets round it, lit as they turn, the top of it worn brighter.
    const upper = Math.sin((i / 8) * TAU + TAU / 8) > 0.5;
    return { crease: 0.1, tone: upper ? HORN_TOP : METAL };
  });
  // Its point: the last ring closed off.
  horn[horn.length - 1].crease = 0.3;
  parts.push({ x: ROOT + 2, y: 0, faces: horn, solid: true, tier: 3, order: (e) => 3 + (e.toward[0] > 0 ? 0.5 : -0.5) });

  /* -- what grows and lies round the block's foot: grass, two flowers, moss on its shady corner -- */
  const colours = ['yellow', 'rose', 'cream'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R() * 0.5, d = 6.8 + R() * 2.0;
    const x = Math.cos(a) * d * ANVIL_K, y = Math.sin(a) * d * 0.9 * ANVIL_K;
    const s0 = seed * 7 + i, flower = i === 2 || i === 5;
    const colour = colours[(i + variant) % colours.length];
    parts.push({ x, y, reach: [[x, y, 4]], draw: (g, e) => { const [px, py] = proj(e, [x, y, 0.1]); if (flower) flowerClump(g, px, py, colour, s0, 0.36); else grassTuft(g, px, py, s0, 0.5); } });
  }
  {
    const mx = -4.9 * ANVIL_K, my = -3.9 * ANVIL_K;
    parts.push({
      x: mx * 1.1, y: my * 1.1, reach: [[mx, my, 2]],
      draw: (g, e) => {
        const T = rand(seed * 3 + 1);
        const across = Math.hypot(e.ux, e.uy);
        const ps: Pad[] = [];
        for (let j = 0; j < 5; j++) {
          const [px, py] = proj(e, [mx + (T() - 0.5) * 3.4, my + (T() - 0.5) * 2.0, 0.2 + T() * 0.5]);
          const r = 0.8 + 0.6 * T();
          ps.push([px, py, r * across, r * across * 0.75]);
        }
        drawPads(g, ps);
      },
    });
  }
  const turf: V3[] = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * TAU, r = (8.2 + R() * 1.2) * ANVIL_K;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.9, 0] as V3;
  });
  // The solids drawn up from the ground by \`ANVIL_K\`, frames and all, so what is painted on them grows with them.
  const big = (q: V3): V3 => mul(q, ANVIL_K);
  for (const p of parts) {
    if (p.faces) for (const f of p.faces) {
      f.pts = f.pts.map(big);
      if (f.frame) f.frame = { o: big(f.frame.o), a: big(f.frame.a), b: big(f.frame.b) };
    }
    if (p.solid) { p.x *= ANVIL_K; p.y *= ANVIL_K; }
  }
  const bf = blockFront as unknown as Side;
  const front: Side = { ...bf, o: big(bf.o), a: big(bf.a), b: big(bf.b), poly: bf.poly.map(big) };
  const model: AnvilModel = { parts, blockFront: front, blockPart, turf };
  anvilModels.set(key, model);
  return model;
}

interface AnvilBake {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  bounds: [number, number, number, number];
  hit: [number, number, number, number];
  glows: Glow[];
  seen: number[];
  /** Its rune's light after dark, added over the night (\`drawAnvilNight\`). */
  glow: Lamp | null;
  /** Pixels it keeps, all its pictures together. */
  area: number;
}

const anvilBakes = new Bakes<AnvilBake>();
/** Which way round each of its variants stands: a quarter turn apart, and each a hair off square, as the runestones are. */
const anvilYaw = (variant: number): number => (((variant % ANVIL_VARIANTS) + ANVIL_VARIANTS) % ANVIL_VARIANTS) * (Math.PI / 2) + Math.PI / 14;

function bakeAnvil(face: string, shade: string, variant: number, rotation: number, scale: number): AnvilBake {
  const m = anvilOf(face, shade, variant);
  const e = eyeOf(anvilYaw(variant), rotation);
  const [x0, y0, x1, y1] = measure(m.parts, e, m.turf, 6);
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  const [canvas, g] = sheetOf((x1 - x0) * scale, (y1 - y0) * scale, M0);
  const order = laid(m.parts, e);
  {
    // The turf round its foot and its shade thrown away from the light, as a rune lantern's.
    polyPath(g, e, m.turf.map((q) => mul(q, 0.85)));
    g.fillStyle = 'rgba(118, 156, 122, 0.36)';
    g.fill();
    groundShade(g, e, rect(0, 0, 5.6, 4.6, 0), 3, 1.5);
  }
  layParts(g, e, order, new Set(m.parts.filter((p) => p.solid && p.tier !== 3 || p === m.parts[3])), 'rgba(250, 246, 236, 0.6)');

  /* -- its rune's light, where its side is seen -- */
  const glows: Glow[] = [];
  const seen: number[] = [];
  const s = m.blockFront;
  const cos = dot(s.n, e.toward) / Math.hypot(...e.toward);
  if (cos >= GLOW_SEEN) {
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const M = sideM(e, s);
    const gl = bakeRune(M, { glyph: BLOCK_RUNE, x: s.w / 2, z: s.h / 2 + 0.1, s: 1.35, i: variant, w: Math.max(0.44, 1.45 / scale), inner: css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6)), mid: RUNE_GOLD, edge: 'rgba(112, 84, 74, 0.9)' }, scale);
    for (const c of [gl.core, gl.halo, gl.dusk, gl.mask]) {
      const h = c.getContext('2d') as Ctx;
      h.setTransform(scale, 0, 0, scale, -gl.box[0] * scale, -gl.box[1] * scale);
      h.globalCompositeOperation = 'destination-in';
      polyPath(h, e, s.poly);
      h.fill();
      h.globalCompositeOperation = 'source-over';
      lessInFront(h, e, order, m.blockPart);
    }
    // By day the groove alone, gold in its channel, with no haze round it (`runelantern.ts`).
    (gl.halo.getContext('2d') as Ctx).clearRect(0, 0, gl.halo.width, gl.halo.height);
    glows.push(gl);
    seen.push(fade * fade * (3 - 2 * fade));
  }
  const glow = composed(glows.flatMap((gl, i) => [
    { c: gl.dusk, box: gl.box, a: seen[i] * 0.25 * GLOW_GAIN, op: 'lighter' as const },
    { c: gl.core, box: gl.box, a: seen[i] * 0.5 * GLOW_GAIN, op: 'lighter' as const },
  ]), scale);
  const area = canvas.width * canvas.height + glows.reduce((n, gl) => n + 4 * gl.core.width * gl.core.height, 0) + (glow ? glow.canvas.width * glow.canvas.height : 0);
  return { canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hit: hitOf(m.parts, e), glows, seen, glow, area };
}

function anvilBaked(face: string, shade: string, variant: number, rotation: number, zoom: number): AnvilBake {
  const scale = scaleFor(zoom);
  const rot = ((rotation % 8) + 8) % 8, v = ((variant % ANVIL_VARIANTS) + ANVIL_VARIANTS) % ANVIL_VARIANTS;
  return anvilBakes.get(`${face}|${shade}|${v}|${rot}|${scale}`, () => bakeAnvil(face, shade, v, rot, scale));
}

/**
 * Draw an anvil on its block whose footprint's middle is at (sx, sy) on the
 * screen, in the metal whose colour is `face` with `shade` its shadow, stood
 * the `variant`th way round, from viewpoint `rotation` under a night `night`
 * dark: its bake, and unless `live` is false its rune's light over it
 * (`drawAnvilLive`). Returns what it covers from (sx, sy) in screen pixels.
 */
export function drawAnvil(ctx: Ctx, sx: number, sy: number, zoom: number, face: string, shade: string, rotation = 0, variant = 0, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = anvilBaked(face, shade, variant, rotation, zoom);
  const k = zoom / b.scale;
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  if (live) drawAnvilLive(ctx, sx, sy, zoom, face, shade, rotation, variant, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** The rune on an anvil's block, lit gold and breathing as a runestone's, over its bake. */
export function drawAnvilLive(ctx: Ctx, sx: number, sy: number, zoom: number, face: string, shade: string, rotation = 0, variant = 0, night = 0, t = performance.now() / 1000): void {
  const b = anvilBaked(face, shade, variant, rotation, zoom);
  if (!b.glows.length) return;
  // Its lit groove breathing as a runestone's does, with no haze by day (\`runelantern.ts\`); after dark its glow goes over the night (\`drawAnvilNight\`).
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  b.glows.forEach((gl, i) => {
    const p = breath(gl, t);
    const [x, y, w, h] = gl.box;
    const X = sx + x * zoom, Y = sy + y * zoom, Wd = w * zoom, Ht = h * zoom;
    ctx.globalAlpha = wasA * Math.min(1, 0.55 + 0.25 * night + 0.35 * p) * b.seen[i];
    ctx.drawImage(gl.core, X, Y, Wd, Ht);
  });
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * An anvil's rune after dark: its groove and a little gold round it added as
 * light, breathing, laid straight after it in its own place among what is
 * drawn and turned up by as much as the night's wash over it will take off
 * (\`over\`, as \`drawSmelterNight\`).
 */
export function drawAnvilNight(ctx: Ctx, sx: number, sy: number, zoom: number, face: string, shade: string, rotation: number, variant: number, night: number, t = performance.now() / 1000, over = 0): void {
  if (night <= 0.02) return;
  const b = anvilBaked(face, shade, variant, rotation, zoom);
  if (!b.glow || !b.glows.length) return;
  const p = breath(b.glows[0], t);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, wasA * night * (0.55 + 0.45 * p) * underWash(over) / GLOW_GAIN);
  lay(ctx, b.glow, sx, sy, zoom);
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * How an anvil's rune takes the night off itself, for the runestones'
 * keeping (\`RunestoneNight.source\`): in its own shape, a little light round
 * it, and kept off whatever stands in front. An anvil throws no light of its
 * own, so without this its rune could come up through the wash no brighter
 * than a third of itself; its box is the rune's, a few pixels, so little
 * falls on it and the keeping costs next to nothing.
 */
export function anvilNight(face: string, shade: string, variant: number, rotation: number, zoom: number): NightSource {
  const b = anvilBaked(face, shade, variant, rotation, zoom);
  return {
    glows: b.glows,
    rise: 0,
    holes: (sx, sy, z, t): NightHole[] => b.glows.map((gl, i) => ({ x: sx + gl.cx * z, y: sy + gl.cy * z, r: gl.r * 1.2 * z, a: (0.08 + 0.04 * breath(gl, t)) * b.seen[i] })),
    masks: (sx, sy, z, t): NightMask[] => glowMasks(b.glows, sx, sy, z, t).map((mk, i) => ({ ...mk, a: mk.a * b.seen[i] })),
  };
}

/** What an anvil is clicked by, from its footprint's middle, in pixels at zoom one: its block and the anvil on it. */
export function anvilHit(face: string, shade: string, variant: number, rotation: number, zoom = 1): [number, number, number, number] {
  return anvilBaked(face, shade, variant, rotation, zoom).hit;
}

/** What it is drawn over, from its footprint's middle, in pixels at zoom one. */
export function anvilBounds(face: string, shade: string, variant: number, rotation: number, zoom = 1): [number, number, number, number] {
  return anvilBaked(face, shade, variant, rotation, zoom).bounds;
}

/** Which way round an anvil standing at subtile (sx, sy) of tile (x, y) is set down. */
export const anvilVariant = (x: number, y: number, sx: number, sy: number): number =>
  Math.floor(hashOf(x * 4 + sx, y * 4 + sy, 3, 2917) * ANVIL_VARIANTS) % ANVIL_VARIANTS;
