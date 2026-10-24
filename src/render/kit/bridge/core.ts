import { cushions, hashOf, PAVE_STAGES, rand, type Cushion } from '../../ivy';
import { cut, glyphPath, lightOf, newell, proj, RUNE_GOLD, RUNE_WHITE, type Eye, type PaintCtx } from '../../runestone';
import { add, css, dot, faceColour, hex, mix, mul, sub, TAU, type Ctx, type RGB, type Tone, type V3 } from '../core';

/**
 * A bridge of a wall material drawn in the runestones' kit: the shared half.
 *
 * A bridge is drawn a tile of deck and a lane at a time (a *slice*), so that
 * whatever stands under it or on it is laid in the right place among its
 * pieces: each slice is three pieces, sorted on their own (`bridgekit.ts`):
 *
 *   * `back`  -- what is behind anything under the deck: the pier sides
 *     that face into a bay and the underside of the arch;
 *   * `front` -- the deck, the outer walls, arches, piers and cutwaters, and
 *     the far parapet: in front of anything under the deck, behind anything
 *     standing on it;
 *   * `rail`  -- the near parapet, its newel posts and lamps: in front of
 *     anybody on the deck.
 *
 * Everything is built in the bridge's own frame (`L`): `s` along it in tiles
 * from the edge of end a's tile, `t` across it in tiles from the line it was
 * set out along (a lane `o` is `t` from `o - 0.5` to `o + 0.5`), `z` the
 * island's height. A slice's faces are clipped to its tile and its lane; an
 * edge on that cut is never inked, so the slices meet with no seam.
 *
 * What a material looks like is its `BridgeStyle` (`<material>.ts` beside
 * this): its tones, what is painted on its faces, its parapet, and any of the
 * builders below it would rather do its own way (`BridgeStyle.build`).
 */

/* ---- the frame ------------------------------------------------------------------------ */

/** A point in the bridge's frame: tiles along, tiles across, height units up. */
export type L = [number, number, number];
export type Part3 = 'back' | 'front' | 'rail';
export type Family = 'stone' | 'timber';

/** Units of the model a tile: the island's height units, ten to a metre, four metres to a tile. */
export const U = 40;

/* ---- what a material says -------------------------------------------------------------- */

/** What a face is, for its painter. */
export type Role = 'wall' | 'ring' | 'key' | 'pier' | 'cap' | 'deck' | 'tread' | 'parapet' | 'post' | 'beam' | 'rail' | 'plinth' | 'cornice' | 'lamp';

/**
 * A face as its painter is told of it: its role, how far it runs in its own
 * frame (`x` along it, `y` up it, in units, from a point fixed for the whole
 * bridge so courses run on unbroken from slice to slice), and a number off
 * where it is.
 */
export interface FaceInfo {
  role: Role;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  seed: number;
  /** For a deck: whether the boards or the setts run across it (`x` along the bridge). */
  along?: boolean;
}
export type BridgePainter = (g: Ctx, k: PaintCtx, f: FaceInfo, st: BridgeStyle) => void;

/** The kinds of parapet the core can build; a style may build its own (`build.parapet`). */
export type ParapetKind = 'balustrade' | 'solid' | 'crenel' | 'rough' | 'capped' | 'brick' | 'curved' | 'rope' | 'rail' | 'painted';

export interface BridgeStyle {
  family: Family;
  /** The walls, piers and spandrels; the arch ring and dressings; copings, cornice and caps; what is walked on. */
  stone: Tone;
  ring: Tone;
  trim: Tone;
  deck: Tone;
  /** Timber: posts and beams, and its rails. */
  post?: Tone;
  rail?: Tone;
  parapet: ParapetKind;
  /** How high the parapet stands over the deck, in units. */
  parapetHeight?: number;
  /** How deep the arch ring is, in units. */
  ringDepth?: number;
  /** The rune cut in each keystone, and the colour the rune line glows at night. */
  rune: string;
  glow: string;
  /** A timber bridge carried on a curved truss arch over each bay (a moon bridge). */
  truss?: boolean;
  /** What is painted on faces: by role, or the one painter for all. */
  paint?: Partial<Record<Role, BridgePainter>> & { any?: BridgePainter };
  /** Any of the builders, done this material's own way. */
  build?: Partial<Builders>;
}

/* ---- the plan: one bridge's bays, piers and forms ---------------------------------------- */

/** How a bay is carried, off its drop: low, high or very high. */
export type Form = 'low' | 'high' | 'tiers';

export interface Bay {
  s0: number;
  s1: number;
  /** Its middle, and the clear half-span between its piers' faces, in tiles. */
  c: number;
  a: number;
  form: Form;
  /** The underside of the arch (or the beam) at `s`, the height of its crown, and where it springs. */
  arch: (s: number) => number;
  crown: number;
  spring: number;
  /** Two tiers: the lower arch, its crown, where it springs, and the course over it the upper one stands on. */
  lower?: (s: number) => number;
  lowerCrown?: number;
  lowerSpring?: number;
  course?: number;
  /** Two tiers: the lower arch's clear half-span, in tiles, round; the piers under the course are that much thicker. */
  lowerHalf?: number;
}

export interface Pier {
  /** Where its middle is along the bridge, and its half thickness, in tiles. */
  s: number;
  half: number;
  /** An abutment at one end of the bridge, against its bank, rather than a pier between two bays. */
  end?: boolean;
  /** How deep its foot goes, the lowest ground under it. */
  foot: number;
}

export interface Plan {
  n: number;
  /** The lanes, the outer edges, and which way across each looks out: -1 and +1. */
  lanes: number[];
  tLo: number;
  tHi: number;
  /** The deck's top at `s`, its thickness, and the ground at a point of the frame. */
  deck: (s: number) => number;
  thick: number;
  ground: (s: number, t: number) => number;
  /** The lowest ground under any of it, which every piece is drawn up from. */
  base: number;
  bays: Bay[];
  piers: Pier[];
  /** Whether each tile of deck is finished. */
  done: boolean[];
  /** Whether the deck rises (a ramp), and how many treads a tile it climbs in. */
  ramp: boolean;
  width: number;
  /** How far the moss has got, in stages of `PAVE_STAGES` (stone only): laid over whatever the style paints (`mossPaint`). */
  moss: number;
  style: BridgeStyle;
}

/** What a plan is made from: the bridge as the renderer reads it. */
export interface PlanInput {
  n: number;
  lanes: number[];
  deck: (s: number) => number;
  ground: (s: number, t: number) => number;
  bays: number[];
  done: boolean[];
  rise: number;
  width: number;
  moss: number;
  style: BridgeStyle;
}

/** The drop at which a bay goes from low to high, and from high to two tiers, in units: a storey, and two and a half. */
export const FORM_HIGH = 30;
export const FORM_TIERS = 75;
/** How far up from the ground to the upper crown two tiers' string course runs: the lower arcade the taller. */
export const TIER_COURSE = 0.6;

export function planOf(p: PlanInput): Plan {
  const thick = p.style.family === 'stone' ? 3.5 : 2.2;
  const tLo = Math.min(...p.lanes) - 0.5, tHi = Math.max(...p.lanes) + 0.5;
  const minGround = (s0: number, s1: number): number => {
    let m = Infinity;
    for (let k = 0; k <= 4; k++) for (const t of [tLo + 0.05, (tLo + tHi) / 2, tHi - 0.05]) m = Math.min(m, p.ground(s0 + ((s1 - s0) * k) / 4, t));
    return m;
  };
  // Piers between bays, and an abutment at each end.
  const piers: Pier[] = [];
  let at = 0;
  const cuts = [0];
  for (const len of p.bays) { at += len; cuts.push(at); }
  cuts.forEach((s, k) => {
    const end = k === 0 || k === cuts.length - 1;
    const drop = p.deck(s) - minGround(Math.max(0, s - 0.3), Math.min(p.n, s + 0.3));
    // Thicker the taller it stands.
    const half = end ? 0.12 : Math.min(0.2, 0.09 + Math.max(0, drop) * 0.0012);
    piers.push({ s, half, end, foot: minGround(Math.max(0, s - half), Math.min(p.n, s + half)) - 1.5 });
  });
  const ring = p.style.ringDepth ?? 3.2;
  const bays: Bay[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const s0 = cuts[k], s1 = cuts[k + 1];
    const c = (s0 + s1) / 2;
    const a = Math.max(0.15, (s1 - s0) / 2 - (k === 0 ? piers[0].half : piers[k].half));
    const g = minGround(s0, s1);
    const top = p.deck(c) - thick - (p.style.family === 'stone' ? ring + 1.2 : 2.5);
    const drop = p.deck(c) - g;
    const form: Form = drop <= FORM_HIGH ? 'low' : drop <= FORM_TIERS ? 'high' : 'tiers';
    const A = a * U;
    let arch: (s: number) => number;
    let spring: number;
    let tiers: { course: number; lc: number } | null = null;
    const crown = top;
    if (form === 'low') {
      // A segment of a circle, its rise a third of its half-span, never down into the ground.
      const r = Math.max(1, Math.min(A * 0.42, crown - g - 2));
      const R = (A * A + r * r) / (2 * r);
      arch = (s) => crown - R + Math.sqrt(Math.max(0, R * R - ((s - c) * U) ** 2));
      spring = crown - r;
    } else if (form === 'high') {
      // Round, or flattened to an ellipse where a round one would meet the ground.
      const r = Math.max(2, Math.min(A, crown - g - 3));
      arch = (s) => crown - r + r * Math.sqrt(Math.max(0, 1 - ((s - c) / a) ** 2));
      spring = crown - r;
    } else {
      // Two tiers, as an aqueduct: a string course three fifths of the way up; under it a tall arcade of round arches on tall
      // piers, over it a shorter one whose arches spring from just over the course.
      const course = g + (crown - g) * TIER_COURSE;
      const r = Math.max(2, Math.min(A, crown - course - 2));
      arch = (s) => crown - r + r * Math.sqrt(Math.max(0, 1 - ((s - c) / a) ** 2));
      spring = crown - r;
      tiers = { course, lc: course - 1.6 - ring - 0.4 };
    }
    const bay: Bay = { s0, s1, c, a, form, arch, crown, spring };
    if (tiers) {
      const { course, lc } = tiers;
      // Round, springing two fifths of the way up: narrower than the bay where it must be, its piers the thicker for it.
      const al = Math.max(0.15, Math.min(a, (0.6 * (lc - g)) / U));
      const lr = al * U;
      bay.course = course;
      bay.lowerCrown = lc;
      bay.lowerSpring = lc - lr;
      bay.lowerHalf = al;
      bay.lower = (s) => lc - lr + lr * Math.sqrt(Math.max(0, 1 - ((s - c) / al) ** 2));
    }
    bays.push(bay);
  }
  const base = Math.min(...piers.map((q) => q.foot), minGround(0, p.n)) - 2;
  return {
    n: p.n, lanes: p.lanes, tLo, tHi, deck: p.deck, thick, ground: p.ground, base, bays, piers, done: p.done,
    ramp: Math.abs(p.rise) > 0, width: p.width, moss: p.moss, style: p.style,
  };
}

/* ---- a slice, and how its faces are made ---------------------------------------------------- */

/** One face of a slice: lit, filled, painted in its frame, and inked on the edges that are not cuts. */
export interface BFace {
  pts: V3[];
  n: V3;
  tone: Tone;
  frame?: { o: V3; a: V3; b: V3 };
  info?: FaceInfo;
  /** Which of its edges are inked: edge `k` runs from point `k` to the next. */
  ink: boolean[];
}
/** A solid of a piece: its faces, inked as one; or a loose drawing. */
export interface BPart {
  faces: BFace[];
  draw?: (g: Ctx, e: Eye) => void;
  reach?: V3[];
  /** Laid before or after the rest of its piece, else by how near it is. */
  order?: number;
}
/** Where the rune line and the runes glow at night, as screen polylines and glyph spots of the piece. */
export interface Glow { lines: V3[][]; runes: Array<{ at: V3; s: number; glyph: string }>; lamps: V3[] }
export interface PieceModel { parts: BPart[]; glow: Glow }

export interface Slice {
  i: number;
  o: number;
  s0: number;
  s1: number;
  t0: number;
  t1: number;
  /** The outer edges this lane has, -1 for the low one and +1 for the high, and of those which looks toward the eye. */
  edges: number[];
  near: number | null;
}

/** What a builder has to hand: the plan, the slice, the eye, and the means of making faces. */
export interface Kit {
  plan: Plan;
  sl: Slice;
  st: BridgeStyle;
  e: Eye;
  /** The bridge's frame to the model's: tiles and heights to units round the slice's own middle at the plan's base. */
  m: (p: L) => V3;
  /** The world's way across the frame, in the model: which way `+t` and `+s` go. */
  P: V3;
  A: V3;
  /** A face of the frame's points, turned out toward `out` (a direction in the frame), its frame for painting. */
  face: (part: Part3, pts: L[], out: L, tone: Tone, info?: FaceInfo, frame?: { o: L; a: L; b: L }) => void;
  /** A loose drawing in the model. */
  loose: (part: Part3, draw: (g: Ctx, e: Eye) => void, reach: L[], order?: number) => void;
  /** Start a new solid in a piece: the faces after it are inked as one, apart from those before. */
  solid: (part: Part3, order?: number) => void;
  glow: Glow;
  rand: () => number;
  /** The order of a solid on an outer edge: as given on the near one, before the deck on the far one, which the deck hides. */
  ord: (edge: number, o: number) => number;
}

const EPS = 1e-6;

/** Make a slice's pieces. */
export function buildSlice(plan: Plan, sl: Slice, e: Eye, A2: [number, number], P2: [number, number]): Record<Part3, PieceModel> {
  const glow: Glow = { lines: [], runes: [], lamps: [] };
  const out: Record<Part3, PieceModel> = { back: { parts: [], glow: { lines: [], runes: [], lamps: [] } }, front: { parts: [], glow }, rail: { parts: [], glow: { lines: [], runes: [], lamps: [] } } };
  const cs = (sl.s0 + sl.s1) / 2, ct = sl.o;
  const A: V3 = [A2[0], A2[1], 0], P: V3 = [P2[0], P2[1], 0];
  const m = (p: L): V3 => [((p[0] - cs) * A2[0] + (p[1] - ct) * P2[0]) * U, ((p[0] - cs) * A2[1] + (p[1] - ct) * P2[1]) * U, p[2] - plan.base];
  const dir = (d: L): V3 => [(d[0] * A2[0] + d[1] * P2[0]) * U, (d[0] * A2[1] + d[1] * P2[1]) * U, d[2]];
  const cur: Record<Part3, BPart | null> = { back: null, front: null, rail: null };
  const solid = (part: Part3, order?: number): void => {
    const p: BPart = { faces: [], order };
    out[part].parts.push(p);
    cur[part] = p;
  };
  const onCut = (a: L, b: L): boolean =>
    (Math.abs(a[0] - sl.s0) < EPS && Math.abs(b[0] - sl.s0) < EPS && sl.s0 > EPS)
    || (Math.abs(a[0] - sl.s1) < EPS && Math.abs(b[0] - sl.s1) < EPS && sl.s1 < plan.n - EPS)
    || (Math.abs(a[1] - sl.t0) < EPS && Math.abs(b[1] - sl.t0) < EPS && sl.t0 > plan.tLo + EPS)
    || (Math.abs(a[1] - sl.t1) < EPS && Math.abs(b[1] - sl.t1) < EPS && sl.t1 < plan.tHi - EPS);
  const face = (part: Part3, pts: L[], o: L, tone: Tone, info?: FaceInfo, frame?: { o: L; a: L; b: L }): void => {
    if (pts.length < 3) return;
    const mp = pts.map(m);
    let n = newell(mp);
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return;
    n = mul(n, 1 / l);
    if (dot(n, dir(o)) < 0) n = mul(n, -1);
    if (!cur[part]) solid(part);
    const ink = pts.map((p, k) => !onCut(p, pts[(k + 1) % pts.length]));
    const fr = frame ? { o: m(frame.o), a: dir(frame.a), b: dir(frame.b) } : undefined;
    /*
     * And what the painter is told of its run, as the face lies in its own
     * frame: a wall's frame on the low edge runs backwards along the bridge
     * (`wallFrame`), a ring's from its crown, a box's from its corner. Told
     * the same way by a style that tells it so itself.
     */
    if (info && fr) {
      const aa = dot(fr.a, fr.a), bb = dot(fr.b, fr.b);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of mp) {
        const d = sub(q, fr.o);
        const x = dot(d, fr.a) / aa, y = dot(d, fr.b) / bb;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      info = { ...info, x0, x1, y0, y1 };
    }
    cur[part]!.faces.push({ pts: mp, n, tone, ink, info, frame: fr });
  };
  const loose = (part: Part3, draw: (g: Ctx, e: Eye) => void, reach: L[], order?: number): void => {
    out[part].parts.push({ faces: [], draw, reach: reach.map(m), order });
    cur[part] = null;
  };
  const k: Kit = { plan, sl, st: plan.style, e, m, P, A, face, loose, solid, glow, rand: rand(sl.i * 131 + (sl.o + 3) * 17 + 7), ord: (edge, o) => (edge === sl.near ? o : o - 4) };
  const b = { ...BUILDERS, ...(plan.style.build ?? {}) };
  if (!plan.done[sl.i]) {
    b.unfinished(k);
  } else {
    b.deck(k);
    if (plan.style.family === 'stone') b.arches(k);
    else b.trestle(k);
    for (const edge of sl.edges) b.parapet(k, edge, edge === sl.near ? 'rail' : 'front');
    b.ends(k);
    if (plan.width >= 2) b.refuges(k);
  }
  // The near rail's and the far parapet's glow go with their pieces.
  out.rail.glow = glow;
  out.front.glow = glow;
  return out;
}

/* ---- the builders ------------------------------------------------------------------------------- */

export interface Builders {
  deck: (k: Kit) => void;
  arches: (k: Kit) => void;
  trestle: (k: Kit) => void;
  parapet: (k: Kit, edge: number, part: Part3) => void;
  ends: (k: Kit) => void;
  refuges: (k: Kit) => void;
  unfinished: (k: Kit) => void;
}

/** Points along `s` from `a` to `b` taking in every break given, `step` tiles apart at most. */
export function samples(a: number, b: number, breaks: number[], step: number): number[] {
  const xs = new Set<number>([a, b]);
  for (const x of breaks) if (x > a + EPS && x < b - EPS) xs.add(x);
  const sorted = [...xs].sort((p, q) => p - q);
  const outp: number[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const n = Math.max(1, Math.ceil((sorted[i + 1] - sorted[i]) / step - 1e-9));
    for (let j = 0; j < n; j++) outp.push(sorted[i] + ((sorted[i + 1] - sorted[i]) * j) / n);
  }
  outp.push(sorted[sorted.length - 1]);
  return outp;
}

/** The info for a face from (x0, y0) to (x1, y1) in units of its frame. */
const info = (role: Role, x0: number, x1: number, y0: number, y1: number, seed: number, along?: boolean): FaceInfo => ({ role, x0, x1, y0, y1, seed, along });

/** The frame of an outer wall face at edge `t`: `x` along the bridge from its start, `y` up from nought. */
const wallFrame = (t: number, out: number): { o: L; a: L; b: L } => ({ o: [0, t, 0], a: [out > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] });

/** Which bay a point along the bridge is in. */
export const bayAt = (plan: Plan, s: number): Bay => plan.bays.find((b) => s >= b.s0 - EPS && s <= b.s1 + EPS) ?? plan.bays[plan.bays.length - 1];
/** The pier at the start and the end of a bay. */
const piersOf = (plan: Plan, bay: Bay): [Pier, Pier] => [plan.piers.find((p) => Math.abs(p.s - bay.s0) < EPS)!, plan.piers.find((p) => Math.abs(p.s - bay.s1) < EPS)!];

/**
 * The openings of a bay at `s`: the height its wall stands up to from below
 * (the arch's underside), and for two tiers the lower arch and the course,
 * or null in the pier between them.
 */
function opening(plan: Plan, s: number): { top: number; lower?: number; course?: number } | null {
  const bay = bayAt(plan, s);
  const [p0, p1] = piersOf(plan, bay);
  if (s <= p0.s + p0.half + EPS || s >= p1.s - p1.half - EPS) return null;
  return { top: bay.arch(s), lower: bay.lower?.(s), course: bay.course };
}

const DECK: BridgePainter = (g, k, f, st) => (st.paint?.[f.role] ?? st.paint?.any)?.(g, k, f, st);
const painter = (st: BridgeStyle, f: FaceInfo | undefined): BridgePainter | undefined => (f ? st.paint?.[f.role] ?? st.paint?.any : undefined);
export { painter };

export const BUILDERS: Builders = {
  /** The deck of the slice: its top (in treads on a ramp), its outer edges and the cornice under them. */
  deck(k) {
    const { plan, sl, st } = k;
    const top = (s: number): number => plan.deck(s);
    const tone = st.deck;
    k.solid('front', 0);
    if (plan.ramp) {
      // Treads: three a tile, each level at the height its far end reaches.
      const n = 3;
      const up = plan.deck(sl.s1) >= plan.deck(sl.s0);
      for (let j = 0; j < n; j++) {
        const a = sl.s0 + ((sl.s1 - sl.s0) * j) / n, b2 = sl.s0 + ((sl.s1 - sl.s0) * (j + 1)) / n;
        const z = up ? top(b2) : top(a);
        k.face('front', [[a, sl.t0, z], [b2, sl.t0, z], [b2, sl.t1, z], [a, sl.t1, z]], [0, 0, 1], tone,
          info('tread', a * U, b2 * U, sl.t0 * U, sl.t1 * U, sl.i * 7 + j, true), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
        // The riser up to the next.
        // And at the tile's own end, up to the next tile's first tread, a hair inside it so its edges are inked.
        const zr = up ? top(b2) : top(a);
        const len = sl.s1 - sl.s0;
        const zn = up ? top(sl.s0 + (len * (j + 2)) / n) : top(sl.s0 + (len * (j - 1)) / n);
        const sr = up ? (j + 1 < n ? b2 : b2 - 1e-3) : (j > 0 ? a : a + 1e-3);
        if (zn - zr > 1e-3) k.face('front', [[sr, sl.t0, zr], [sr, sl.t1, zr], [sr, sl.t1, zn], [sr, sl.t0, zn]], [up ? -1 : 1, 0, 0], st.trim);
      }
    } else {
      k.face('front', [[sl.s0, sl.t0, top(sl.s0)], [sl.s1, sl.t0, top(sl.s1)], [sl.s1, sl.t1, top(sl.s1)], [sl.s0, sl.t1, top(sl.s0)]], [0, 0, 1], tone,
        info('deck', sl.s0 * U, sl.s1 * U, sl.t0 * U, sl.t1 * U, sl.i * 7 + sl.o, true), { o: [0, 0, top(sl.s0)], a: [1 / U, 0, (top(sl.s1) - top(sl.s0)) / U], b: [0, 1 / U, 0] });
    }
    // The edge of the deck, and a cornice band under it, on each outer edge of this lane.
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const proud = st.family === 'stone' ? 0.025 : 0.015;
      const tt = t + edge * proud;
      const z0 = (s: number): number => top(s) - plan.thick;
      k.solid('front', 1);
      const xs = samples(sl.s0, sl.s1, [], 0.5);
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b2 = xs[j + 1];
        k.face('front', [[a, tt, z0(a) - 1.4], [b2, tt, z0(b2) - 1.4], [b2, tt, top(b2) - 0.6], [a, tt, top(a) - 0.6]], [0, edge, 0], st.trim,
          info('cornice', a * U, b2 * U, z0(a) - 1.4, top(a), sl.i), wallFrame(tt, edge));
        k.face('front', [[a, t, top(a) - 0.6], [b2, t, top(b2) - 0.6], [b2, tt, top(b2) - 0.6], [a, tt, top(a) - 0.6]], [0, 0, 1], st.trim);
        k.face('front', [[a, t, z0(a) - 1.4], [b2, t, z0(b2) - 1.4], [b2, tt, z0(b2) - 1.4], [a, tt, z0(a) - 1.4]], [0, 0, -1], st.trim);
      }
    }
  },

  /**
   * The stone under the deck: on each outer edge the wall from the ground
   * (or the arch) up to the deck, the arch ring proud of it and a keystone at
   * its crown; across the lane the underside of the arch; at a pier the side
   * it shows into the bay; and a cutwater on its outer face.
   */
  arches(k) {
    const { plan, sl, st } = k;
    const breaks: number[] = [];
    for (const p of plan.piers) breaks.push(p.s - p.half, p.s + p.half, p.s);
    for (const bay of plan.bays) breaks.push(bay.c, ...(bay.lowerHalf !== undefined ? [bay.c - bay.lowerHalf, bay.c + bay.lowerHalf] : []));
    const xs = samples(sl.s0, sl.s1, breaks, 0.125);
    const deckBottom = (s: number): number => plan.deck(s) - plan.thick - 1.4;
    const ringD = st.ringDepth ?? 3.2;
    // Where there is no opening, the pier's wall from the ground to the deck.
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      k.solid('front', k.ord(edge, -1));
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b2 = xs[j + 1];
        if (opening(plan, (a + b2) / 2)) continue;
        const ga = plan.ground(a, t) - 0.5, gb = plan.ground(b2, t) - 0.5;
        k.face('front', [[a, t, ga], [b2, t, gb], [b2, t, deckBottom(b2)], [a, t, deckBottom(a)]], [0, edge, 0], st.stone,
          info('pier', a * U, b2 * U, Math.min(ga, gb), deckBottom(a), sl.i), wallFrame(t, edge));
      }
    }
    archFaces(k, xs, deckBottom, ringD);
  },

  trestle(k) { timberTrestle(k); },

  parapet(k, edge, part) { parapetFor(k, edge, part); },

  /** At each end of the bridge, on each outer edge: a newel post, heavier than the parapet's, with a finial. */
  ends(k) {
    const { plan, sl } = k;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 - 0.07 : sl.t0 + 0.07;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      if (sl.i === 0) newel(k, part, 0.07, t, plan.deck(0.07));
      if (sl.i === plan.n - 1) newel(k, part, plan.n - 0.07, t, plan.deck(plan.n - 0.07));
    }
  },

  refuges(k) { refugeFor(k); },

  /** A tile still to be built: two stringers along its edges at the deck's height, and a pier's footing where one will stand. */
  unfinished(k) {
    const { plan, sl } = k;
    const scaffold = { lit: hex('#c9a77c'), shade: hex('#6e5660') } as Tone;
    for (const t of [plan.tLo + 0.12, plan.tHi - 0.12]) {
      if (t < sl.t0 - EPS || t > sl.t1 + EPS) continue;
      box(k, 'front', sl.s0, sl.s1, t - 0.04, t + 0.04, plan.deck(sl.s0) - 3, plan.deck(sl.s0) - 1, scaffold, 'beam');
    }
  },
};

/* ---- boxes -------------------------------------------------------------------------------------- */

/**
 * A box in the frame from (s0, t0, z0) to (s1, t1, z1), clipped to the
 * slice -- across it only at a cut between two lanes, so whatever stands
 * proud of an outer edge keeps its outer face; no bottom; one solid.
 */
export function box(k: Kit, part: Part3, s0: number, s1: number, t0: number, t1: number, z0: number, z1: number, tone: Tone, role: Role = 'post', order?: number): void {
  const { sl, plan } = k;
  const a = Math.max(s0, sl.s0), b = Math.min(s1, sl.s1);
  const c = sl.t0 > plan.tLo + EPS ? Math.max(t0, sl.t0) : t0, d = sl.t1 < plan.tHi - EPS ? Math.min(t1, sl.t1) : t1;
  if (b - a < 1e-4 || d - c < 1e-4 || z1 - z0 < 1e-4) return;
  k.solid(part, order);
  const seed = Math.round(s0 * 97 + t0 * 13);
  k.face(part, [[a, c, z1], [b, c, z1], [b, d, z1], [a, d, z1]], [0, 0, 1], tone, info('cap', a * U, b * U, c * U, d * U, seed), { o: [a, c, z1], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
  if (Math.abs(a - s0) < EPS) k.face(part, [[a, c, z0], [a, d, z0], [a, d, z1], [a, c, z1]], [-1, 0, 0], tone, info(role, 0, (d - c) * U, z0, z1, seed), { o: [a, c, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
  if (Math.abs(b - s1) < EPS) k.face(part, [[b, c, z0], [b, d, z0], [b, d, z1], [b, c, z1]], [1, 0, 0], tone, info(role, 0, (d - c) * U, z0, z1, seed), { o: [b, c, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
  if (Math.abs(c - t0) < EPS) k.face(part, [[a, c, z0], [b, c, z0], [b, c, z1], [a, c, z1]], [0, -1, 0], tone, info(role, 0, (b - a) * U, z0, z1, seed), { o: [a, c, 0], a: [1 / U, 0, 0], b: [0, 0, 1] });
  if (Math.abs(d - t1) < EPS) k.face(part, [[a, d, z0], [b, d, z0], [b, d, z1], [a, d, z1]], [0, 1, 0], tone, info(role, 0, (b - a) * U, z0, z1, seed), { o: [a, d, 0], a: [1 / U, 0, 0], b: [0, 0, 1] });
}

/** A post turned on a lathe at (s, t), its profile [height over `z`, radius in tiles], `sides` round; one solid. */
export function turned(k: Kit, part: Part3, s: number, t: number, z: number, profile: ReadonlyArray<[number, number]>, sides: number, tone: Tone, order?: number): void {
  k.solid(part, order);
  const ring = (h: number, r: number): L[] => Array.from({ length: sides }, (_, i) => {
    const a = ((i + 0.5) / sides) * TAU;
    return [s + Math.cos(a) * r, t + Math.sin(a) * r, z + h] as L;
  });
  const rings = profile.map(([h, r]) => ring(h, r));
  for (let j = 0; j + 1 < rings.length; j++) {
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides;
      const a = ((i + 1) / sides) * TAU;
      const am = a - Math.PI / sides;
      k.face(part, [rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]], [Math.cos(am), Math.sin(am), (profile[j][1] - profile[j + 1][1]) * U * 0.02], tone,
        info('post', 0, 1, profile[j][0], profile[j + 1][0], i));
    }
  }
  const lastRing = rings[rings.length - 1];
  if (profile[profile.length - 1][1] > 1e-4) k.face(part, lastRing, [0, 0, 1], tone);
}

/* ---- the stone arches --------------------------------------------------------------------------- */

function archFaces(k: Kit, xs: number[], deckBottom: (s: number) => number, ringD: number): void {
  const { plan, sl, st } = k;
  // An outer edge turned from the eye: what stands proud of it (rings, keystones, cutwaters) would show through the arches.
  const away = (edge: number): boolean => edge * dot(k.P, k.e.toward) < -EPS;
  // The pier walls laid by the loop in `arches` stand where there is no opening; here, where there is one:
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0;
    const fr = wallFrame(t, edge);
    k.solid('front', k.ord(edge, -1));
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b2 = xs[j + 1], mid = (a + b2) / 2;
      const op = opening(plan, mid);
      if (!op) continue;
      const ta = bayAt(plan, mid).arch(a), tb = bayAt(plan, mid).arch(b2);
      // The spandrel, over the ring.
      k.face('front', [[a, t, ta + ringD], [b2, t, tb + ringD], [b2, t, deckBottom(b2)], [a, t, deckBottom(a)]], [0, edge, 0], st.stone,
        info('wall', a * U, b2 * U, Math.min(ta, tb), deckBottom(mid), sl.i), fr);
      // Two tiers: the wall between the lower arch and the course, and the course itself.
      const bay = bayAt(plan, mid);
      if (bay.lower && bay.course !== undefined) {
        // Over the lower arch; and beside it, where the pier is the thicker under the course, from the ground.
        const inside = Math.abs(mid - bay.c) < (bay.lowerHalf ?? bay.a);
        const la = inside ? bay.lower(a) + ringD : plan.ground(a, t) - 0.5, lb = inside ? bay.lower(b2) + ringD : plan.ground(b2, t) - 0.5;
        k.face('front', [[a, t, la], [b2, t, lb], [b2, t, bay.course], [a, t, bay.course]], [0, edge, 0], st.stone,
          info(inside ? 'wall' : 'pier', a * U, b2 * U, Math.min(la, lb), bay.course, sl.i), fr);
      }
    }
    if (away(edge)) continue;
    // The rings, proud of the wall.
    const proud = 0.012;
    const tr = t + edge * proud;
    for (const which of ['upper', 'lower'] as const) {
      k.solid('front', k.ord(edge, 0.5));
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b2 = xs[j + 1], mid = (a + b2) / 2;
        if (!opening(plan, mid)) continue;
        const bay = bayAt(plan, mid);
        const f = which === 'upper' ? bay.arch : bay.lower;
        if (!f) continue;
        if (which === 'lower' && Math.abs(mid - bay.c) >= (bay.lowerHalf ?? bay.a)) continue;
        const za = f(a), zb = f(b2);
        k.face('front', [[a, tr, za], [b2, tr, zb], [b2, tr, zb + ringD], [a, tr, za + ringD]], [0, edge, 0], st.ring,
          info('ring', (a - bay.c) * U, (b2 - bay.c) * U, za, za + ringD, Math.round(bay.c * 10), true), { ...fr, o: [bay.c, tr, 0] });
        // The ring's soffit edge and its top, between its face and the wall: on the near face, the far one's being hidden by the vault.
        if (edge === sl.near) {
          k.face('front', [[a, t, za], [b2, t, zb], [b2, tr, zb], [a, tr, za]], [0, 0, -1], st.ring);
          k.face('front', [[a, t, za + ringD], [b2, t, zb + ringD], [b2, tr, zb + ringD], [a, tr, za + ringD]], [0, 0, 1], st.ring);
        }
      }
    }
    // A keystone at each crown in this slice, a rune cut in it.
    for (const bay of plan.bays) {
      for (const [f, crown] of [[bay.arch, bay.crown], [bay.lower, bay.lowerCrown]] as Array<[((s: number) => number) | undefined, number | undefined]>) {
        if (!f || crown === undefined) continue;
        const w = 0.07;
        // Wholly in the slice nearer the eye where it straddles a cut.
        const owner = ownerOf(k, bay.c - w, bay.c + w);
        if (owner === null) continue;
        k.solid('front', k.ord(edge, 0.8));
        const tk = t + edge * 0.03;
        const z0 = crown - 0.6, z1 = crown + ringD + 0.8;
        const ks = [bay.c - w, bay.c + w];
        k.face('front', [[ks[0], tk, z0], [ks[1], tk, z0], [ks[1], tk, z1], [ks[0], tk, z1]], [0, edge, 0], st.ring,
          info('key', 0, w * 2 * U, z0, z1, Math.round(bay.c * 10)), { o: [ks[0], tk, z0], a: [edge > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] });
        for (const s of ks) k.face('front', [[s, t, z0], [s, tk, z0], [s, tk, z1], [s, t, z1]], [s < bay.c ? -1 : 1, 0, 0], st.ring);
        k.face('front', [[ks[0], t, z1], [ks[1], t, z1], [ks[1], tk, z1], [ks[0], tk, z1]], [0, 0, 1], st.ring);
        k.glow.runes.push({ at: k.m([bay.c, tk, (z0 + z1) / 2]), s: (z1 - z0) * 0.28, glyph: st.rune });
      }
    }
    cutwaters(k, edge, t);
  }
  // Two tiers: the string course between them, a thin band on each outer face only; the arcades are open between it.
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0, tt = t + edge * 0.02;
    k.solid('front', k.ord(edge, 0.3));
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b2 = xs[j + 1], bay = bayAt(plan, (a + b2) / 2);
      if (bay.course === undefined) continue;
      const z = bay.course;
      k.face('front', [[a, tt, z - 1.6], [b2, tt, z - 1.6], [b2, tt, z + 0.4], [a, tt, z + 0.4]], [0, edge, 0], st.trim, info('cornice', a * U, b2 * U, z - 1.6, z + 0.4, sl.i), wallFrame(tt, edge));
      k.face('front', [[a, t, z + 0.4], [b2, t, z + 0.4], [b2, tt, z + 0.4], [a, tt, z + 0.4]], [0, 0, 1], st.trim);
    }
  }
  // Across the lane: the underside of each arch, and the side of a pier facing into its bay.
  k.solid('back', 0);
  for (let j = 0; j + 1 < xs.length; j++) {
    const a = xs[j], b2 = xs[j + 1], mid = (a + b2) / 2;
    if (!opening(plan, mid)) continue;
    const bay = bayAt(plan, mid);
    for (const f of [bay.arch, bay.lower]) {
      if (!f) continue;
      if (f === bay.lower && Math.abs(mid - bay.c) >= (bay.lowerHalf ?? bay.a)) continue;
      const za = f(a), zb = f(b2);
      const up: L = [(bay.c - mid) * 0.3, 0, -1];
      k.face('back', [[a, sl.t0, za], [b2, sl.t0, zb], [b2, sl.t1, zb], [a, sl.t1, za]], up, st.ring, info('ring', a * U, b2 * U, sl.t0 * U, sl.t1 * U, sl.i, false));
    }
  }
  for (const bay of plan.bays) {
    const [p0, p1] = piersOf(plan, bay);
    for (const [s, dirn] of [[p0.s + p0.half, 1], [p1.s - p1.half, -1]] as Array<[number, number]>) {
      if (s < sl.s0 - EPS || s > sl.s1 + EPS) continue;
      // Against the arch's spring, and for two tiers the lower spring and between the course and the upper spring.
      const g0 = plan.ground(s, sl.t0) - 0.5, g1 = plan.ground(s, sl.t1) - 0.5;
      // Two tiers: the lower side stands at the lower arch's springing, where the pier is the thicker (`lowerHalf`).
      const tops: Array<[number, number, number, number]> = bay.lower
        ? [[bay.course!, bay.course!, bay.arch(s), bay.arch(s)]]
        : [[g0, g1, bay.arch(s), bay.arch(s)]];
      for (const [z0, z0b, z1, z1b] of tops) {
        if (z1 - Math.max(z0, z0b) < 0.1) continue;
        k.solid('back', -1);
        k.face('back', [[s, sl.t0, z0], [s, sl.t1, z0b], [s, sl.t1, z1b], [s, sl.t0, z1]], [dirn, 0, 0], st.stone,
          info('pier', sl.t0 * U, sl.t1 * U, Math.min(z0, z0b), z1, Math.round(s * 10)), { o: [s, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
      }
    }
    // Two tiers: the lower arch's sides, from the ground to its springing, and the top of the thicker pier beside it, at the course.
    if (bay.lower && bay.lowerHalf !== undefined && bay.course !== undefined) {
      for (const [s, dirn] of [[bay.c - bay.lowerHalf, 1], [bay.c + bay.lowerHalf, -1]] as Array<[number, number]>) {
        if (s < sl.s0 - EPS || s > sl.s1 + EPS) continue;
        const g0 = plan.ground(s, sl.t0) - 0.5, g1 = plan.ground(s, sl.t1) - 0.5, z1 = bay.lowerSpring!;
        if (z1 - Math.max(g0, g1) < 0.1) continue;
        k.solid('back', -1);
        k.face('back', [[s, sl.t0, g0], [s, sl.t1, g1], [s, sl.t1, z1], [s, sl.t0, z1]], [dirn, 0, 0], st.stone,
          info('pier', sl.t0 * U, sl.t1 * U, Math.min(g0, g1), z1, Math.round(s * 10)), { o: [s, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
      }
      for (const [x0, x1] of [[p0.s + p0.half, bay.c - bay.lowerHalf], [bay.c + bay.lowerHalf, p1.s - p1.half]]) {
        const a = Math.max(x0, sl.s0), b2 = Math.min(x1, sl.s1);
        if (b2 - a < 1e-3) continue;
        k.solid('back', -0.5);
        k.face('back', [[a, sl.t0, bay.course], [b2, sl.t0, bay.course], [b2, sl.t1, bay.course], [a, sl.t1, bay.course]], [0, 0, 1], st.stone);
      }
    }
  }
}

/** The slice that owns something running along the bridge from `a` to `b`: this one, or null where another nearer the eye does. */
export function ownerOf(k: Kit, a: number, b: number): number | null {
  const { sl } = k;
  if (b < sl.s0 - EPS || a > sl.s1 + EPS) return null;
  if (a >= sl.s0 - EPS && b <= sl.s1 + EPS) return sl.i;
  // Straddling a cut: the slice on the side of it nearer the eye.
  const towardS = dot(k.A, k.e.toward);
  const nearer = towardS >= 0 ? 1 : -1;
  if (a < sl.s0 - EPS) return nearer > 0 ? sl.i : null;
  return nearer < 0 ? sl.i : null;
}

/** A pointed cutwater on a pier's outer face, from its foot to its spring, capped with a sloped top; stone only. */
function cutwaters(k: Kit, edge: number, t: number): void {
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    if (p.s < sl.s0 - p.half - EPS || p.s > sl.s1 + p.half + EPS) continue;
    const bay = bayAt(plan, p.s - 0.01);
    const top = plan.width >= 2 ? plan.deck(p.s) - plan.thick - 1.4 : (bay.lower ? bay.lowerSpring! : bay.spring) + 1;
    const nose = 0.2;
    // Each half, on its own side of the pier's middle, belongs to the slice it is in.
    for (const side of [-1, 1]) {
      const sa = p.s, sb = p.s + side * p.half;
      if ((side < 0 && (p.s <= sl.s0 + EPS)) || (side > 0 && p.s >= sl.s1 - EPS)) continue;
      const tip: L = [sa, t + edge * nose, 0];
      const fb = plan.ground(sb, t) - 0.5, fa = plan.ground(sa, tip[1]) - 0.5;
      k.solid('front', k.ord(edge, 0.2));
      k.face('front', [[sb, t, fb], [sa, tip[1], fa], [sa, tip[1], top], [sb, t, top]], [side * 0.5, edge, 0], st.stone,
        info('pier', 0, p.half * U, Math.min(fa, fb), top, Math.round(p.s * 10)), { o: [sb, t, 0], a: [(sa - sb) / U, edge * nose / U, 0], b: [0, 0, 1] });
      // Its cap: a slope up from the nose to the wall.
      const capTop = top + nose * U * 0.45;
      if (plan.width < 2) k.face('front', [[sb, t, top], [sa, tip[1], top], [sa, t, capTop]], [side * 0.3, edge * 0.6, 1], st.trim);
    }
  }
}

/* ---- parapets ------------------------------------------------------------------------------------- */

/** Where a bridge two lanes wide or more breaks its parapet for the refuge bay over each pier, along it: from and to. */
export function refugeGaps(plan: Plan): Array<[number, number]> {
  if (plan.width < 2) return [];
  return plan.piers.filter((p) => !p.end).map((p) => [p.s - refugeHalf(p), p.s + refugeHalf(p)]);
}

/** The runs of parapet in a slice: the slice less the refuges' gaps. */
function parapetRuns(plan: Plan, sl: Slice): Array<[number, number]> {
  let runs: Array<[number, number]> = [[sl.s0, sl.s1]];
  for (const [g0, g1] of refugeGaps(plan)) {
    runs = runs.flatMap(([a, b]): Array<[number, number]> => {
      if (g1 <= a || g0 >= b) return [[a, b]];
      const out: Array<[number, number]> = [];
      if (g0 > a + 0.02) out.push([a, g0]);
      if (g1 < b - 0.02) out.push([g1, b]);
      return out;
    });
  }
  return runs;
}

function parapetFor(k: Kit, edge: number, part: Part3): void {
  for (const [a, b] of parapetRuns(k.plan, k.sl)) {
    if (k.st.family === 'timber' || ['rope', 'rail', 'painted'].includes(k.st.parapet)) timberRail(k, edge, part, a, b);
    else parapetRun(k, edge, part, a, b);
  }
}

/** A run of stone parapet from `sa` to `sb` along the slice's outer edge `edge`, of the material's kind. */
function parapetRun(k: Kit, edge: number, part: Part3, sa: number, sb: number): void {
  const { plan, sl, st } = k;
  const kind = st.parapet;
  const H = st.parapetHeight ?? 10;
  const T = 0.09;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const tIn = tOut - edge * T;
  const [t0, t1] = edge > 0 ? [tIn, tOut] : [tOut, tIn];
  const deck = plan.deck;
  const xs = samples(sa, sb, [], plan.ramp ? 1 / 3 : 1);
  const coping = 1.6;
  const lineAt = (s: number, z: number): V3 => k.m([s, tOut + edge * 0.004, z]);
  const solidWall = (zTop: (s: number) => number, role: Role = 'parapet'): void => {
    k.solid(part, 1);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      for (const [t, out] of [[tOut, edge], [tIn, -edge]] as Array<[number, number]>) {
        k.face(part, [[a, t, deck(a)], [b, t, deck(b)], [b, t, zTop(b)], [a, t, zTop(a)]], [0, out, 0], st.stone,
          info(role, a * U, b * U, deck(a), zTop(a), sl.i * 3 + (out > 0 ? 1 : 0)), wallFrame(t, out));
      }
    }
    // Its ends where a refuge breaks it.
    for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
      if ((dirn < 0 && sa <= sl.s0 + EPS) || (dirn > 0 && sb >= sl.s1 - EPS)) continue;
      k.face(part, [[s, t0, deck(s)], [s, t1, deck(s)], [s, t1, zTop(s)], [s, t0, zTop(s)]], [dirn, 0, 0], st.stone);
    }
  };
  const copingOn = (zTop: (s: number) => number, over = 0.012): void => {
    k.solid(part, 2);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      const c0 = t0 - over, c1 = t1 + over;
      k.face(part, [[a, c0, zTop(a) + coping], [b, c0, zTop(b) + coping], [b, c1, zTop(b) + coping], [a, c1, zTop(a) + coping]], [0, 0, 1], st.trim,
        info('cap', a * U, b * U, c0 * U, c1 * U, sl.i), { o: [0, 0, zTop(0) + coping], a: [1 / U, 0, (zTop(1) - zTop(0)) / U], b: [0, 1 / U, 0] });
      for (const [t, out] of [[c1, 1], [c0, -1]] as Array<[number, number]>) {
        k.face(part, [[a, t, zTop(a)], [b, t, zTop(b)], [b, t, zTop(b) + coping], [a, t, zTop(a) + coping]], [0, out, 0], st.trim,
          info('cap', a * U, b * U, zTop(a), zTop(a) + coping, sl.i), wallFrame(t, out));
      }
      k.glow.lines.push([lineAt(a, zTop(a) + coping * 0.5), lineAt(b, zTop(b) + coping * 0.5)]);
    }
    for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
      if ((dirn < 0 && sa <= sl.s0 + EPS) || (dirn > 0 && sb >= sl.s1 - EPS)) continue;
      k.face(part, [[s, c0of(t0, over), zTop(s)], [s, c1of(t1, over), zTop(s)], [s, c1of(t1, over), zTop(s) + coping], [s, c0of(t0, over), zTop(s) + coping]], [dirn, 0, 0], st.trim);
    }
  };
  if (kind === 'balustrade') {
    // A plinth, turned balusters between square posts at the run's ends and middle, and a coping over all.
    const plinth = 1.8;
    k.solid(part, 1);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      for (const [t, out] of [[tOut, edge], [tIn, -edge]] as Array<[number, number]>) {
        k.face(part, [[a, t, deck(a)], [b, t, deck(b)], [b, t, deck(b) + plinth], [a, t, deck(a) + plinth]], [0, out, 0], st.trim, info('plinth', a * U, b * U, 0, plinth, sl.i), wallFrame(t, out));
      }
      k.face(part, [[a, t0, deck(a) + plinth], [b, t0, deck(b) + plinth], [b, t1, deck(b) + plinth], [a, t1, deck(a) + plinth]], [0, 0, 1], st.trim);
    }
    const tc = (t0 + t1) / 2;
    const post = 0.05;
    const posts = [sa, (sa + sb) / 2, sb].filter((sp, i, all) => i === 0 || sp - all[i - 1] > 0.2);
    for (const sp of posts) {
      const cut = sp === sl.s0 || sp === sl.s1;
      if (cut && ownerOf(k, sp - post, sp + post) === null) continue;
      if ((sp <= EPS && sl.i === 0) || (sp >= plan.n - EPS)) continue;
      const p0 = cut ? sp - post : sp === sa ? sp : sp === sb ? sp - 2 * post : sp - post;
      box(k, part, p0, p0 + 2 * post, t0 - 0.006, t1 + 0.006, deck(sp), deck(sp) + H - coping, st.trim, 'post', 1.5);
    }
    for (let q = 0; q + 1 < posts.length; q++) {
      const h0 = posts[q] + post, h1 = posts[q + 1] - post;
      const n = Math.max(1, Math.round((h1 - h0) / 0.14));
      for (let j = 0; j < n; j++) {
        const s = h0 + ((h1 - h0) * (j + 0.5)) / n;
        const z = deck(s) + plinth;
        const h = H - coping - plinth;
        const r = Math.min(0.03, T * 0.4);
        turned(k, part, s, tc, z, [[0, r * 0.9], [h * 0.12, r * 0.55], [h * 0.38, r * 1.05], [h * 0.62, r * 0.75], [h * 0.82, r * 0.45], [h, r * 0.9]], 6, st.trim, 1.2);
      }
    }
    copingOn((s) => deck(s) + H - coping);
  } else if (kind === 'crenel') {
    const low = H - 3.5;
    solidWall((s) => deck(s) + low - coping);
    copingOn((s) => deck(s) + low - coping);
    // Merlons, two a tile.
    for (let m0 = Math.ceil((sa - 0.08) * 2) / 2 + 0.08; m0 + 0.26 <= sb + EPS; m0 += 0.5) box(k, part, m0, m0 + 0.26, t0, t1, deck(m0) + low, deck(m0) + H + 1, st.stone, 'parapet', 2.5);
  } else if (kind === 'curved') {
    const zTop = (s: number): number => deck(s) + H * 0.7;
    solidWall(zTop);
    k.solid(part, 2);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      const r = (t1 - t0) / 2, tc = (t0 + t1) / 2;
      const ring = [0, 1, 2, 3, 4].map((q) => [Math.cos((q / 4) * Math.PI), Math.sin((q / 4) * Math.PI)]);
      for (let q = 0; q < 4; q++) {
        const [c0, s0] = ring[q], [c1, s1] = ring[q + 1];
        k.face(part, [[a, tc + c0 * r, zTop(a) + s0 * r * U * 0.5], [b, tc + c0 * r, zTop(b) + s0 * r * U * 0.5], [b, tc + c1 * r, zTop(b) + s1 * r * U * 0.5], [a, tc + c1 * r, zTop(a) + s1 * r * U * 0.5]],
          [0, (c0 + c1) / 2, (s0 + s1) / 2], st.trim, info('cap', a * U, b * U, 0, 1, sl.i));
      }
      k.glow.lines.push([k.m([a, tOut + edge * 0.003, zTop(a)]), k.m([b, tOut + edge * 0.003, zTop(b)])]);
    }
  } else {
    // Solid, rough, brick, capped: a wall and a coping, a capped one's overhanging.
    solidWall((s) => deck(s) + H - coping);
    copingOn((s) => deck(s) + H - coping, kind === 'capped' ? 0.03 : 0.012);
  }
}
const c0of = (t0: number, over: number): number => t0 - over;
const c1of = (t1: number, over: number): number => t1 + over;

export function newel(k: Kit, part: Part3, s: number, t: number, z: number): void {
  const { st } = k;
  if (ownerOf(k, s - 0.07, s + 0.07) === null) return;
  const H = (st.parapetHeight ?? 10) + 3;
  if (st.family === 'stone') {
    box(k, part, s - 0.07, s + 0.07, t - 0.07, t + 0.07, z, z + 2, st.trim, 'plinth', 3);
    box(k, part, s - 0.055, s + 0.055, t - 0.055, t + 0.055, z + 2, z + H - 2, st.stone, 'post', 3.1);
    box(k, part, s - 0.07, s + 0.07, t - 0.07, t + 0.07, z + H - 2, z + H, st.trim, 'cap', 3.2);
    turned(k, part, s, t, z + H, [[0, 0.03], [0.6, 0.045], [2.2, 0.05], [3.6, 0.03], [4.4, 0]], 8, st.ring, 3.3);
  } else {
    const post = st.post ?? st.stone;
    box(k, part, s - 0.045, s + 0.045, t - 0.045, t + 0.045, z, z + H, post, 'post', 3);
    turned(k, part, s, t, z + H, [[0, 0.035], [0.8, 0.045], [2, 0.03], [2.8, 0]], 6, st.ring, 3.3);
  }
}

/* ---- refuges and lamps ---------------------------------------------------------------------------- */

/**
 * Over each pier of a bridge two lanes wide, a refuge: the deck carried out
 * over the cutwater, the parapet broken (`refugeGaps`) and run round it
 * instead; and at three lanes, a lamp in it.
 */
function refugeFor(k: Kit): void {
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const line = refugeOutline(plan, p, edge, t);
      const [g0, g1] = [line[0][0], line[line.length - 1][0]];
      if (g1 < sl.s0 - EPS || g0 > sl.s1 + EPS) continue;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const z = plan.deck(p.s);
      const under = z - plan.thick - 1.4;
      // The slice widened across to take the refuge in; it is cut along the bridge where the slice is.
      const k2: Kit = { ...k, sl: { ...sl, t0: Math.min(sl.t0, t - REFUGE_OUT), t1: Math.max(sl.t1, t + REFUGE_OUT) } };
      const face = (q: Part3, pts: L[], out: L, tone: Tone, inf?: FaceInfo, fr?: { o: L; a: L; b: L }): void => {
        const c = clipToSlice(pts, sl.s0, sl.s1);
        if (c.length >= 3) k2.face(q, c, out, tone, inf, fr);
      };
      // The platform: its top the deck's, its edge the cornice's, on a corbel down onto the cutwater.
      k2.solid('front', k.ord(edge, 0.9));
      face('front', line.map(([s0, t0]) => [s0, t0, z] as L), [0, 0, 1], st.deck);
      const inset = line.map(([s0, t0]): [number, number] => [p.s + (s0 - p.s) * 0.7, t + (t0 - t) * 0.35]);
      for (let q = 0; q + 1 < line.length; q++) {
        const [a, b] = [line[q], line[q + 1]], [ai, bi] = [inset[q], inset[q + 1]];
        const out: L = [(b[1] - a[1]) * edge, -(b[0] - a[0]) * edge, 0];
        face('front', [[a[0], a[1], under], [b[0], b[1], under], [b[0], b[1], z], [a[0], a[1], z]], out, st.trim,
          info('cornice', 0, 1, under, z, Math.round(p.s * 10) + q), segFrame(a, b));
        face('front', [[ai[0], ai[1], under - 4.6], [bi[0], bi[1], under - 4.6], [b[0], b[1], under], [a[0], a[1], under]], [out[0], out[1], -0.6], st.stone,
          info('pier', 0, 1, under - 4.6, under, Math.round(p.s * 10) + q), segFrame(ai, bi));
      }
      // Its parapet, run round it.
      k2.solid(part, 2);
      refugeParapet(k2, part, line, edge, z, face);
      if (plan.width >= 3 && ownerOf(k2, p.s - 0.05, p.s + 0.05) !== null) lamp(k2, part, p.s, t + edge * REFUGE_OUT * 0.45, z);
    }
  }
}

/** How far a refuge steps out from the bridge's outer edge, in tiles. */
export const REFUGE_OUT = 0.24;
/** Half a refuge's run along the bridge where it leaves the edge, in tiles: room for a body to step into, however slim the pier. */
export const refugeHalf = (p: Pier): number => Math.max(p.half + 0.08, 0.3);

/**
 * The outline of the refuge over a pier on outer edge `edge` (at `t`
 * across), as points (s, t) along it from where it leaves the edge to where
 * it comes back: a half-hexagon, its front parallel to the bridge
 * `REFUGE_OUT` out, its two sides splayed, over the gap `refugeGaps` breaks
 * in the parapet. What a style's parapet follows round it.
 */
export function refugeOutline(plan: Plan, p: Pier, edge: number, t: number): Array<[number, number]> {
  const g0 = p.s - refugeHalf(p), g1 = p.s + refugeHalf(p);
  const c = Math.min(REFUGE_OUT, (g1 - g0) * 0.3);
  const tf = t + edge * REFUGE_OUT;
  void plan;
  return [[g0, t], [g0 + c, tf], [g1 - c, tf], [g1, t]];
}

/** A polygon of the frame cut to the slice's run along the bridge. */
function clipToSlice(pts: L[], s0: number, s1: number): L[] {
  let out = pts;
  for (const [lim, lo] of [[s0, true], [s1, false]] as Array<[number, boolean]>) {
    const inp = out;
    out = [];
    const keep = (q: L): boolean => (lo ? q[0] >= lim - EPS : q[0] <= lim + EPS);
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ia = keep(a), ib = keep(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const u = (lim - a[0]) / (b[0] - a[0]);
        out.push([lim, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

/** A face's frame along a segment of the plan from `a` to `b`: `x` a unit along it, `y` up. */
const segFrame = (a: [number, number], b: [number, number]): { o: L; a: L; b: L } => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { o: [a[0], a[1], 0], a: [(b[0] - a[0]) / len / U, (b[1] - a[1]) / len / U, 0], b: [0, 0, 1] };
};

/**
 * A refuge's parapet along its outline, of the material's kind: a wall and a
 * coping (with merlons where crenellated, balusters where balustraded) or,
 * timber, posts at its corners and two rails; the rune line along it.
 */
function refugeParapet(k: Kit, part: Part3, line: Array<[number, number]>, edge: number, z: number,
  face: (q: Part3, pts: L[], out: L, tone: Tone, inf?: FaceInfo, fr?: { o: L; a: L; b: L }) => void): void {
  const { st } = k;
  const timber = st.family === 'timber' || ['rope', 'rail', 'painted'].includes(st.parapet);
  const H = st.parapetHeight ?? (timber ? 9 : 10);
  const T = timber ? 0.03 : 0.08;
  const coping = 1.6;
  // Each segment's outward normal, across the plan, and the point `d` in from a point on it.
  const segs = line.slice(0, -1).map((a, q) => {
    const b = line[q + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: [number, number] = [((b[1] - a[1]) / len) * edge, (-(b[0] - a[0]) / len) * edge];
    return { a, b, n, len };
  });
  const off = (pt: [number, number], n: [number, number], d: number): [number, number] => [pt[0] - n[0] * d, pt[1] - n[1] * d];
  if (timber) {
    const post = st.post ?? st.stone, rail = st.rail ?? st.ring;
    for (const [s0, t0] of line) if (ownerOf(k, s0 - 0.03, s0 + 0.03) !== null) turned(k, part, s0, t0 - edge * 0.03, z, [[0, 0.03], [H, 0.03], [H + 0.8, 0]], 4, post, 1.5);
    for (const { a, b, n } of segs) {
      const [ai, bi] = [off(a, n, 0.03), off(b, n, 0.03)];
      for (const [zo, h] of [[H - 1.4, 1.4], [H * 0.45, 0.9]] as Array<[number, number]>) {
        face(part, [[ai[0], ai[1], z + zo], [bi[0], bi[1], z + zo], [bi[0], bi[1], z + zo + h], [ai[0], ai[1], z + zo + h]], [n[0], n[1], 0], rail,
          info('rail', 0, 1, 0, h, 7), segFrame(ai, bi));
      }
      k.glow.lines.push([k.m([ai[0] + n[0] * 0.016, ai[1] + n[1] * 0.016, z + H - 0.7]), k.m([bi[0] + n[0] * 0.016, bi[1] + n[1] * 0.016, z + H - 0.7])]);
    }
    return;
  }
  const kind = st.parapet;
  const top = kind === 'crenel' ? H - 3.5 - coping : kind === 'curved' ? H * 0.7 : kind === 'balustrade' ? 1.8 : H - coping;
  const wallTone = kind === 'balustrade' ? st.trim : st.stone;
  for (const { a, b, n, len } of segs) {
    const [ai, bi] = [off(a, n, T), off(b, n, T)];
    // The wall's two faces and, for a balustrade, its plinth.
    face(part, [[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], z + top], [a[0], a[1], z + top]], [n[0], n[1], 0], wallTone,
      info(kind === 'balustrade' ? 'plinth' : 'parapet', 0, 1, z, z + top, 11), segFrame(a, b));
    face(part, [[ai[0], ai[1], z], [bi[0], bi[1], z], [bi[0], bi[1], z + top], [ai[0], ai[1], z + top]], [-n[0], -n[1], 0], wallTone,
      info(kind === 'balustrade' ? 'plinth' : 'parapet', 0, 1, z, z + top, 12), segFrame(bi, ai));
    const ztop = kind === 'balustrade' ? H - coping : top;
    if (kind === 'balustrade') {
      // Balusters along its middle, the coping on them.
      const m = Math.max(1, Math.round(len / 0.14));
      for (let j = 0; j < m; j++) {
        const u = (j + 0.5) / m;
        const sx = (a[0] + ai[0]) / 2 + (b[0] - a[0]) * u, tx = (a[1] + ai[1]) / 2 + (b[1] - a[1]) * u;
        if (sx < k.sl.s0 || sx >= k.sl.s1) continue;
        const h = ztop - top, r = 0.028;
        turned(k, part, sx, tx, z + top, [[0, r * 0.9], [h * 0.12, r * 0.55], [h * 0.38, r * 1.05], [h * 0.62, r * 0.75], [h * 0.82, r * 0.45], [h, r * 0.9]], 6, st.trim, 1.2);
      }
    }
    // The coping, a hair over both faces, and the rune line along its outer face.
    const [ao, bo, aj, bj] = [off(a, n, -0.012), off(b, n, -0.012), off(a, n, T + 0.012), off(b, n, T + 0.012)];
    face(part, [[ao[0], ao[1], z + ztop + coping], [bo[0], bo[1], z + ztop + coping], [bj[0], bj[1], z + ztop + coping], [aj[0], aj[1], z + ztop + coping]], [0, 0, 1], st.trim,
      info('cap', 0, 1, 0, 1, 13), { ...segFrame(ao, bo), b: [n[0] / U, n[1] / U, 0], o: [ao[0], ao[1], z + ztop + coping] });
    face(part, [[ao[0], ao[1], z + ztop], [bo[0], bo[1], z + ztop], [bo[0], bo[1], z + ztop + coping], [ao[0], ao[1], z + ztop + coping]], [n[0], n[1], 0], st.trim,
      info('cap', 0, 1, z + ztop, z + ztop + coping, 14), segFrame(ao, bo));
    if (kind !== 'balustrade') {
      // Behind a wall the coping's inner face; a balustrade's shows between the balusters anyway.
      face(part, [[aj[0], aj[1], z + ztop], [bj[0], bj[1], z + ztop], [bj[0], bj[1], z + ztop + coping], [aj[0], aj[1], z + ztop + coping]], [-n[0], -n[1], 0], st.trim);
    }
    k.glow.lines.push([k.m([ao[0] + n[0] * 0.004, ao[1] + n[1] * 0.004, z + ztop + coping * 0.5]), k.m([bo[0] + n[0] * 0.004, bo[1] + n[1] * 0.004, z + ztop + coping * 0.5])]);
    if (kind === 'crenel' && len > 0.18) {
      // A merlon in the middle of each side long enough for one.
      const u0 = 0.5 - 0.11 / len, u1 = 0.5 + 0.11 / len;
      const P = (pt: [number, number], q: [number, number], u: number): [number, number] => [pt[0] + (q[0] - pt[0]) * u, pt[1] + (q[1] - pt[1]) * u];
      const [m0, m1, m2, m3] = [P(a, b, u0), P(a, b, u1), P(ai, bi, u1), P(ai, bi, u0)];
      const zb = z + ztop + coping, zt = z + H + 1;
      face(part, [[m0[0], m0[1], zb], [m1[0], m1[1], zb], [m1[0], m1[1], zt], [m0[0], m0[1], zt]], [n[0], n[1], 0], st.stone, info('parapet', 0, 1, zb, zt, 15), segFrame(m0, m1));
      face(part, [[m3[0], m3[1], zb], [m2[0], m2[1], zb], [m2[0], m2[1], zt], [m3[0], m3[1], zt]], [-n[0], -n[1], 0], st.stone);
      face(part, [[m0[0], m0[1], zt], [m1[0], m1[1], zt], [m2[0], m2[1], zt], [m3[0], m3[1], zt]], [0, 0, 1], st.trim);
      for (const [x, y, sg] of [[m0, m3, -1], [m1, m2, 1]] as Array<[[number, number], [number, number], number]>) {
        face(part, [[x[0], x[1], zb], [y[0], y[1], zb], [y[0], y[1], zt], [x[0], x[1], zt]], [sg * (b[0] - a[0]), sg * (b[1] - a[1]), 0], st.stone);
      }
    }
  }
  // A post at each corner of a balustrade.
  if (kind === 'balustrade') {
    for (const [s0, t0] of line.slice(1, -1)) {
      if (ownerOf(k, s0 - 0.05, s0 + 0.05) !== null) turned(k, part, s0, t0 - edge * T / 2, z, [[0, 0.05], [H - coping, 0.05], [H - coping + 0.01, 0]], 4, st.trim, 1.5);
    }
  }
}

/** A lamp post on a stone bridge, a banner pole on a timber one. */
function lamp(k: Kit, part: Part3, s: number, t: number, z: number): void {
  const { st } = k;
  const H = 26;
  const iron = { lit: hex('#a6b2c6'), shade: hex('#454c66') } as Tone;
  if (st.family === 'stone') {
    box(k, part, s - 0.04, s + 0.04, t - 0.04, t + 0.04, z, z + 3, st.trim, 'plinth', 4);
    turned(k, part, s, t, z + 3, [[0, 0.02], [H - 6, 0.016], [H - 5, 0.025]], 6, iron, 4.1);
    // The lantern: a glass box and a cap.
    box(k, part, s - 0.03, s + 0.03, t - 0.03, t + 0.03, z + H - 2, z + H + 2.5, { lit: hex('#ffe7a4'), shade: hex('#e9b468') }, 'lamp', 4.2);
    turned(k, part, s, t, z + H + 2.5, [[0, 0.04], [1.4, 0]], 4, iron, 4.3);
    k.glow.lamps.push(k.m([s, t, z + H]));
  } else {
    const pole = st.post ?? st.stone;
    turned(k, part, s, t, z, [[0, 0.018], [H + 4, 0.014], [H + 5, 0.022], [H + 5.6, 0]], 6, pole, 4.1);
    const cloth = { lit: mix(st.rail?.lit ?? hex('#f2b8c6'), hex('#ffffff'), 0.1), shade: mix(st.rail?.shade ?? hex('#a07090'), hex('#5a4a6a'), 0.3) } as Tone;
    k.solid(part, 4.2);
    const top = z + H + 3;
    k.face(part, [[s, t, top], [s + 0.16, t, top - 1], [s + 0.14, t, top - 7], [s, t, top - 6]], [0, 1, 0], cloth, info('lamp', 0, 1, 0, 1, 1));
  }
}

/* ---- timber --------------------------------------------------------------------------------------- */

/**
 * A timber bridge's carriage: stringers under each outer edge and between
 * the lanes; at every pier a bent of posts with a cap beam over them, braced
 * across; a trestle's posts splayed out at their feet with ties between, two
 * tiers of it over a deep drop; and over each bay of a truss bridge a curved
 * arch beam on each outer face.
 */
function timberTrestle(k: Kit): void {
  const { plan, sl, st } = k;
  const post = st.post ?? st.stone;
  const beam = st.ring;
  const under = (s: number): number => plan.deck(s) - plan.thick;
  // Stringers: a beam along each outer edge and each lane's edge, under the deck.
  for (const t of [sl.t0 + 0.05, sl.t1 - 0.05]) {
    k.solid('front', -1.5);
    const xs = samples(sl.s0, sl.s1, [], plan.ramp ? 1 / 3 : 1);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      for (const [tt, out] of [[t + 0.04, 1], [t - 0.04, -1]] as Array<[number, number]>) {
        k.face('front', [[a, tt, under(a) - 4], [b, tt, under(b) - 4], [b, tt, under(b)], [a, tt, under(a)]], [0, out, 0], beam,
          info('beam', a * U, b * U, under(a) - 4, under(a), sl.i, true), wallFrame(tt, out));
      }
    }
  }
  // The bents.
  for (const p of plan.piers) {
    if (p.s < sl.s0 - 0.2 || p.s > sl.s1 + 0.2) continue;
    const bay = bayAt(plan, Math.min(plan.n - 0.01, Math.max(0.01, p.s)));
    const form = bay.form;
    const top = under(p.s) - 4;
    const posts = [sl.t0 + 0.08, sl.t1 - 0.08];
    for (const [j, t] of posts.entries()) {
      const outward = j === 0 ? -1 : 1;
      const splay = form === 'low' ? 0 : 0.12;
      const isOuter = (outward < 0 && sl.t0 <= plan.tLo + EPS) || (outward > 0 && sl.t1 >= plan.tHi - EPS);
      const footT = t + (isOuter ? outward * splay : 0);
      const w = 0.04;
      if (ownerOf(k, p.s - w, p.s + w) === null) continue;
      // A post, leaning out to its foot.
      k.solid('front', -2);
      const pts = (ds: number, dt: number): [L, L] => [[p.s + ds, footT + dt, p.foot], [p.s + ds, t + dt, top]];
      const corners: Array<[number, number]> = [[-w, -w], [w, -w], [w, w], [-w, w]];
      for (let c = 0; c < 4; c++) {
        const [ds0, dt0] = corners[c], [ds1, dt1] = corners[(c + 1) % 4];
        const [f0, h0] = pts(ds0, dt0), [f1, h1] = pts(ds1, dt1);
        const outv: L = [(ds0 + ds1) * 10, (dt0 + dt1) * 10, 0];
        k.face('front', [f0, f1, h1, h0], outv, post, info('post', 0, w * 2 * U, p.foot, top, Math.round(p.s * 10 + j)), { o: f0, a: [(ds1 - ds0) / (w * 2) / U, (dt1 - dt0) / (w * 2) / U, 0], b: [0, 0, 1] });
      }
      // Two tiers: a tie at half height.
      if (form !== 'low') {
        const zt = form === 'tiers' ? (p.foot + top) / 2 : p.foot + (top - p.foot) * 0.55;
        if (j === 0) box(k, 'front', p.s - w * 1.1, p.s + w * 1.1, sl.t0, sl.t1, zt - 1.2, zt, beam, 'beam', -1.8);
      }
    }
    // The cap beam across the bent, under the stringers.
    box(k, 'front', p.s - 0.05, p.s + 0.05, sl.t0, sl.t1, top - 2.5, top, beam, 'beam', -1.6);
    // X braces across, between the posts: two thin planks.
    if (ownerOf(k, p.s - 0.03, p.s + 0.03) !== null && top - p.foot > 8) {
      const z0 = p.foot + 2, z1 = top - 3;
      const ta = sl.t0 + 0.1, tb = sl.t1 - 0.1;
      for (const [x0, x1] of [[ta, tb], [tb, ta]]) {
        k.solid('back', 0.2);
        for (const ds of [-0.012, 0.012]) {
          const s = p.s + ds;
          k.face('back', [[s, x0, z0], [s, x0, z0 + 1.6], [s, x1, z1], [s, x1, z1 - 1.6]], [ds > 0 ? 1 : -1, 0, 0], beam, info('beam', 0, 1, 0, 1, 3));
        }
      }
    }
  }
  // A truss arch over each bay, on each outer face.
  if (st.truss) {
    for (const edge of sl.edges) {
      const t = (edge > 0 ? sl.t1 : sl.t0) + edge * 0.01;
      const xs = samples(sl.s0, sl.s1, plan.bays.flatMap((b) => [b.s0, b.c, b.s1]), 0.125);
      k.solid('front', k.ord(edge, -1.4));
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b = xs[j + 1];
        const bay = bayAt(plan, (a + b) / 2);
        const curve = (s: number): number => {
          const r = (s - bay.c) / ((bay.s1 - bay.s0) / 2);
          return under(bay.c) - 5 - (1 - Math.min(1, r * r)) * -0 - Math.min(1, r * r) * Math.min(16, (under(bay.c) - bay.spring) * 0.6);
        };
        k.face('front', [[a, t, curve(a) - 3], [b, t, curve(b) - 3], [b, t, curve(b)], [a, t, curve(a)]], [0, edge, 0], beam, info('beam', a * U, b * U, 0, 3, sl.i, true), wallFrame(t, edge));
      }
    }
  }
}

/** A timber rail from `sa` to `sb`: posts at its ends and middle, a top rail and a mid rail, or sagging ropes, or a painted lattice. */
function timberRail(k: Kit, edge: number, part: Part3, sa: number, sb: number): void {
  const { plan, sl, st } = k;
  const H = st.parapetHeight ?? 9;
  const deck = plan.deck;
  const tOut = edge > 0 ? sl.t1 - 0.03 : sl.t0 + 0.03;
  const post = st.post ?? st.stone, rail = st.rail ?? st.ring;
  const w = 0.03;
  for (const sp of [sa, (sa + sb) / 2, sb]) {
    const cut = sp === sl.s0 || sp === sl.s1;
    if (cut && ownerOf(k, sp - w, sp + w) === null) continue;
    if ((sp <= EPS && sl.i === 0) || sp >= plan.n - EPS) continue;
    const p0 = cut ? sp - w : sp === sa ? sp : sp === sb ? sp - 2 * w : sp - w;
    box(k, part, p0, p0 + 2 * w, tOut - w, tOut + w, deck(sp), deck(sp) + H, post, 'post', 1.5);
  }
  if (st.parapet === 'rope') {
    k.loose(part, (g, e) => {
      g.lineCap = 'round';
      for (const zo of [H - 1, H * 0.5]) {
        g.beginPath();
        for (let q = 0; q <= 8; q++) {
          const s = sa + ((sb - sa) * q) / 8;
          const sag = Math.sin(((q % 4) / 4) * Math.PI) * 1.4;
          const [x, y] = proj(e, k.m([s, tOut, deck(s) + zo - sag]));
          if (q) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = css(mix(rail.shade, rail.lit, 0.3));
        g.lineWidth = 1.4;
        g.stroke();
        g.strokeStyle = css(rail.lit, 0.8);
        g.lineWidth = 0.6;
        g.stroke();
      }
    }, [[sa, tOut, deck(sa) + H], [sb, tOut, deck(sb)]], 2);
    k.glow.lines.push([k.m([sa, tOut, deck(sa) + H - 1]), k.m([sb, tOut, deck(sb) + H - 1])]);
    return;
  }
  const xs = samples(sa, sb, [], plan.ramp ? 1 / 3 : 1);
  for (const [zo, h] of [[H - 1.4, 1.4], [H * 0.45, 0.9]] as Array<[number, number]>) {
    k.solid(part, 2);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1];
      for (const [t, out] of [[tOut + 0.015, 1], [tOut - 0.015, -1]] as Array<[number, number]>) {
        k.face(part, [[a, t, deck(a) + zo], [b, t, deck(b) + zo], [b, t, deck(b) + zo + h], [a, t, deck(a) + zo + h]], [0, out, 0], rail,
          info('rail', a * U, b * U, 0, h, sl.i), wallFrame(t, out));
      }
      k.face(part, [[a, tOut - 0.015, deck(a) + zo + h], [b, tOut - 0.015, deck(b) + zo + h], [b, tOut + 0.015, deck(b) + zo + h], [a, tOut + 0.015, deck(a) + zo + h]], [0, 0, 1], rail);
    }
  }
  k.glow.lines.push([k.m([sa, tOut + edge * 0.016, deck(sa) + H - 0.7]), k.m([sb, tOut + edge * 0.016, deck(sb) + H - 0.7])]);
  if (st.parapet === 'painted') {
    // A lattice between the rails, painted.
    k.solid(part, 1.8);
    const mid = (sa + sb) / 2;
    for (const [a, b] of [[sa, mid], [mid, sb]]) {
      for (const [z0, z1] of [[H * 0.45 + 0.9, H - 1.4], [H - 1.4, H * 0.45 + 0.9]]) {
        k.face(part, [[a, tOut, deck(a) + z0], [a, tOut, deck(a) + z0 + 0.8], [b, tOut, deck(b) + z1 + 0.8], [b, tOut, deck(b) + z1]], [0, edge, 0], rail, info('rail', 0, 1, 0, 1, 2));
      }
    }
  }
}

/* ---- laying a piece ------------------------------------------------------------------------------------ */

const GROW = 0.3;
/** The ink of the bridges: the kit's, a step browner for timber. */
export const BRIDGE_INK: RGB = mix(hex('#5f5148'), hex('#5a3a30'), 0.35);

/**
 * A piece's solids onto `g`, its transform pixels at zoom one from the
 * piece's middle (times the bake's scale): each solid's inked edges stroked
 * twice the ink wide, its faces filled a hair over them nearest last, lit
 * and painted; the loose drawings in their turn.
 */
export function layPiece(g: Ctx, e: Eye, pm: PieceModel, st: BridgeStyle, ink = 0.7, moss = 0): void {
  const mossy = moss > 0 && st.family === 'stone';
  const parts = pm.parts.slice();
  const near = (p: BPart): number => {
    const pts = p.faces.length ? p.faces.flatMap((f) => f.pts) : p.reach ?? [];
    if (!pts.length) return 0;
    let s = 0;
    for (const q of pts) s += dot(q, e.toward);
    return s / pts.length;
  };
  const depth = new Map(parts.map((p) => [p, near(p)]));
  parts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || depth.get(a)! - depth.get(b)!);
  const base = g.getTransform();
  const px2 = Math.abs(base.a * base.d - base.b * base.c);
  const grow = GROW / Math.sqrt(px2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const part of parts) {
    if (part.draw) { part.draw(g, e); continue; }
    const seen = part.faces.filter((f) => dot(f.n, e.toward) > 1e-6);
    if (!seen.length) continue;
    seen.sort((a, b) => avgNear(a, e) - avgNear(b, e));
    const scr = seen.map((f) => f.pts.map((q) => proj(e, q)));
    // The ink round the solid: its inked edges, twice the ink wide, the faces filled over so only its rim is left.
    // Each face's inked edges run on as one line, joined round, and end square where they meet a cut, so no cap pokes past it into the next slice.
    const rim = new Path2D();
    seen.forEach((f, i) => {
      const pts = scr[i];
      const n = pts.length;
      const from = f.ink.findIndex((on, j) => on && !f.ink[(j + n - 1) % n]);
      if (from < 0) {
        if (!f.ink[0]) return;
        pts.forEach(([x, y], j) => (j ? rim.lineTo(x, y) : rim.moveTo(x, y)));
        rim.closePath();
        return;
      }
      let open = false;
      for (let q = 0; q < n; q++) {
        const j = (from + q) % n;
        if (!f.ink[j]) { open = false; continue; }
        const a = pts[j], b = pts[(j + 1) % n];
        if (!open) { rim.moveTo(a[0], a[1]); open = true; }
        rim.lineTo(b[0], b[1]);
      }
    });
    g.strokeStyle = css(BRIDGE_INK);
    g.lineWidth = ink * 2 + 2 * grow;
    g.lineCap = 'butt';
    g.stroke(rim);
    g.lineCap = 'round';
    seen.forEach((f, i) => {
      const pts = scr[i];
      const L = lightOf(e, f.n);
      const fill = faceColour(f.tone, L);
      g.beginPath();
      grown(pts, grow).forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = css(fill);
      g.fill();
      const p = painter(st, f.info);
      // And the moss over whatever the material paints, on a stone bridge (`mossPaint`).
      const green = mossy && !!f.info && MOSS_ON.has(f.info.role);
      if ((p || green) && f.frame && f.info) {
        let a2 = 0;
        for (let j = 0; j < pts.length; j++) { const q = pts[j], r = pts[(j + 1) % pts.length]; a2 += q[0] * r[1] - r[0] * q[1]; }
        if (Math.abs(a2) * 0.5 * px2 >= 6) {
          g.save();
          g.clip();
          const [ox, oy] = proj(e, f.frame.o), [ax, ay] = proj(e, f.frame.a), [bx, by] = proj(e, f.frame.b);
          g.transform(ax, ay, bx, by, ox, oy);
          if (p) p(g, { e, L, fill, base }, f.info, st);
          if (green) mossPaint(g, f.info, moss);
          g.restore();
        }
      }
    });
  }
}

/* ---- moss ---------------------------------------------------------------------------------------------- */

/** The faces moss is laid on: where it climbs from the foot, where it hangs from an edge, and along a coping's top. */
const MOSS_FOOT = new Set<Role>(['pier', 'wall', 'post', 'parapet']);
const MOSS_LIP = new Set<Role>(['cornice', 'ring']);
const MOSS_ON = new Set<Role>([...MOSS_FOOT, ...MOSS_LIP, 'cap', 'plinth']);
const ROLE_SALT: Partial<Record<Role, number>> = { pier: 3, wall: 5, post: 7, parapet: 11, cornice: 13, ring: 17, cap: 19, plinth: 23 };

/** Value noise along a face, nought to one: the same clumps at every stage, so moss spreads rather than moves. */
function clumpAt(x: number, y: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number): number => hashOf(a + 4096, b + 4096, 0, salt);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Moss on a face of a stone bridge at `stage` of `PAVE_STAGES`, in the
 * face's own frame (`FaceInfo`, units), over whatever its material paints:
 * cushions climbing from the foot of a pier, a wall, a newel or a parapet;
 * a row hanging from the underside of a cornice or an arch ring; clumps
 * along the top of a coping. Clumped by noise along the face off where it
 * is on the bridge, so slices join and a stage only adds to the last.
 */
export function mossPaint(g: Ctx, f: FaceInfo, stage: number): void {
  const upto = Math.min(stage, PAVE_STAGES) / PAVE_STAGES;
  if (upto <= 0) return;
  const salt = ROLE_SALT[f.role] ?? 29;
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1);
  const y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  const cover = 0.62 * Math.pow(upto, 0.8);
  const cs: Cushion[] = [];
  const step = 1.3;
  for (let x = Math.floor(x0 / step) * step; x <= x1 + step; x += step) {
    const xi = Math.round(x / step);
    const clump = clumpAt(x / 9, salt * 0.37, salt) + 0.12 * hashOf(xi + 4096, 0, salt, 43);
    if (clump >= cover) continue;
    const deep = Math.min(1, (cover - clump) / 0.2);
    if (MOSS_FOOT.has(f.role)) {
      // Up from the foot in a band, higher in the heart of a clump; and specks in the joints above it.
      const rise = 1.2 + 9 * deep * upto;
      for (let y = y0 + 0.5, j = 0; y < Math.min(y1, y0 + rise); y += 1.5, j++) {
        const t = (y - y0) / rise;
        if (hashOf(xi + 4096, j, salt, 47) > 0.92 - 0.45 * t) continue;
        cs.push([x + (hashOf(xi + 4096, j, salt, 53) - 0.5) * 1.6, y, (0.75 + 0.75 * deep) * (1 - 0.35 * t)]);
      }
    } else if (MOSS_LIP.has(f.role)) {
      // Along the underside of the edge, a few hanging lower where it is heaviest.
      cs.push([x, y0 + 0.4 + hashOf(xi + 4096, 1, salt, 59) * 0.6, 0.6 + 0.7 * deep]);
      if (deep > 0.55 && hashOf(xi + 4096, 2, salt, 59) < 0.4) cs.push([x, y0 - 0.6 - deep * 1.4, 0.5 + 0.4 * deep]);
    } else {
      // Along the top of a coping or a plinth: down its middle and on its edges.
      const span = y1 - y0;
      cs.push([x, y0 + span * (0.25 + 0.5 * hashOf(xi + 4096, 3, salt, 61)), Math.min(span * 0.45, 0.7 + 0.8 * deep)]);
      if (deep > 0.5 && hashOf(xi + 4096, 4, salt, 61) < 0.5) cs.push([x + 0.6, y0 + span * 0.1, Math.min(span * 0.3, 0.5 + 0.5 * deep)]);
    }
  }
  if (cs.length) cushions(g, cs);
}

const avgNear = (f: BFace, e: Eye): number => {
  let s = 0;
  for (const q of f.pts) s += dot(q, e.toward);
  return s / f.pts.length;
};

function grown(pts: ReadonlyArray<[number, number]>, d: number): Array<[number, number]> {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const n1x = (p[1] - a[1]) / l1, n1y = -(p[0] - a[0]) / l1, n2x = (b[1] - p[1]) / l2, n2y = -(b[0] - p[0]) / l2;
    let mx = n1x + n2x, my = n1y + n2y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) return [p[0], p[1]];
    mx /= ml; my /= ml;
    const k = Math.min(2, 1 / Math.max(0.5, mx * n1x + my * n1y));
    return [p[0] + sgn * mx * d * k, p[1] + sgn * my * d * k];
  });
}

/** Every point a piece reaches, for the size of its picture. */
export const piecePoints = (pm: PieceModel): V3[] => pm.parts.flatMap((p) => [...p.faces.flatMap((f) => f.pts), ...(p.reach ?? [])]);

/** The rune line and the runes of a piece, as the night's mask: drawn solid on `g` (pixels at zoom one from its middle). */
export function layGlowMask(g: Ctx, e: Eye, glow: Glow): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.6;
  for (const line of glow.lines) {
    g.beginPath();
    line.forEach((q, i) => { const [x, y] = proj(e, q); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  for (const r of glow.runes) {
    const [x, y] = proj(e, r.at);
    glyphPath(g, r.glyph, x, y, r.s * 2.25);
    g.lineWidth = 1;
    g.stroke();
  }
  for (const l of glow.lamps) {
    const [x, y] = proj(e, l);
    g.beginPath();
    g.arc(x, y, 3, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();
  }
}

/* ---- painters every material may use ------------------------------------------------------------------- */

/** Ashlar: courses `course` units high, joints staggered `len` long, each stone its own hair of tone. */
export function ashlarPaint(course: number, len: number, joint = 0.16): BridgePainter {
  return (g, k, f) => {
    const T = rand(f.seed * 7 + 3);
    const dark = css(mix(k.fill, hex('#5a4e5e'), 0.38), 0.75);
    const lite = css(mix(k.fill, [255, 250, 238], 0.5), 0.45);
    const y0 = Math.floor(f.y0 / course) * course, y1 = f.y1 + course;
    const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1);
    g.lineWidth = joint;
    for (let y = y0, row = Math.floor(f.y0 / course); y < y1; y += course, row++) {
      // Each stone a step paler or deeper.
      const off = (row % 2) * len * 0.5;
      for (let x = Math.floor((x0 - off) / len) * len + off; x < x1; x += len) {
        const v = T();
        if (v < 0.3) { g.fillStyle = css(mix(k.fill, [255, 250, 240], 0.08), 0.6); g.fillRect(x, y, len, course); }
        else if (v > 0.8) { g.fillStyle = css(mix(k.fill, hex('#6e5a70'), 0.07), 0.6); g.fillRect(x, y, len, course); }
        g.strokeStyle = dark;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + course); g.stroke();
      }
      g.strokeStyle = dark;
      g.beginPath(); g.moveTo(x0 - 1, y); g.lineTo(x1 + 1, y); g.stroke();
      g.strokeStyle = lite;
      g.beginPath(); g.moveTo(x0 - 1, y - joint); g.lineTo(x1 + 1, y - joint); g.stroke();
    }
  };
}

/** Voussoirs: radial joints across a ring `n` to the unit of its run, its middle at nought. */
export function voussoirPaint(every: number): BridgePainter {
  return (g, k, f) => {
    const dark = css(mix(k.fill, hex('#5a4e5e'), 0.4), 0.8);
    g.strokeStyle = dark;
    g.lineWidth = 0.16;
    const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1);
    for (let x = Math.floor(x0 / every) * every; x <= x1 + every; x += every) {
      g.beginPath();
      g.moveTo(x, f.y0 - 4);
      g.lineTo(x, f.y1 + 6);
      g.stroke();
    }
  };
}

/** Boards across a deck, `w` units wide, laid across its run. */
export function boardPaint(w: number): BridgePainter {
  return (g, k, f) => {
    const T = rand(f.seed * 5 + 1);
    const dark = css(mix(k.fill, hex('#4a3640'), 0.45), 0.8);
    for (let x = Math.floor(Math.min(f.x0, f.x1) / w) * w; x < Math.max(f.x0, f.x1); x += w) {
      const v = T();
      if (v < 0.35) { g.fillStyle = css(mix(k.fill, [255, 248, 234], 0.1), 0.6); g.fillRect(x, f.y0 - 1, w, f.y1 - f.y0 + 2); }
      else if (v > 0.75) { g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.1), 0.6); g.fillRect(x, f.y0 - 1, w, f.y1 - f.y0 + 2); }
      g.strokeStyle = dark;
      g.lineWidth = 0.22;
      g.beginPath(); g.moveTo(x, f.y0 - 1); g.lineTo(x, f.y1 + 1); g.stroke();
    }
  };
}

/** Setts or flags on a stone deck: a grid `w` along by `h` across, staggered. */
export function settPaint(w: number, h: number): BridgePainter {
  return (g, k, f) => {
    const dark = css(mix(k.fill, hex('#5a4e5e'), 0.3), 0.55);
    g.strokeStyle = dark;
    g.lineWidth = 0.18;
    const y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
    for (let y = Math.floor(y0 / h) * h, r = 0; y < y1; y += h, r++) {
      g.beginPath(); g.moveTo(f.x0 - 1, y); g.lineTo(f.x1 + 1, y); g.stroke();
      const off = (Math.abs(Math.round(y / h)) % 2) * w * 0.5;
      for (let x = Math.floor((f.x0 - off) / w) * w + off; x < f.x1; x += w) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); }
    }
  };
}

/** A rune cut in a keystone, inlaid in the runes' gold. */
export function keyRune(glyph: string): BridgePainter {
  return (g, k, f) => {
    const x = (f.x0 + f.x1) / 2, y = (f.y0 + f.y1) / 2, s = Math.min(f.x1 - f.x0, f.y1 - f.y0) * 0.32;
    cut(g, k.fill, s * 0.28, () => glyphPath(g, glyph, x, y, s));
    glyphPath(g, glyph, x, y, s);
    g.strokeStyle = RUNE_GOLD;
    g.lineWidth = s * 0.16;
    g.stroke();
  };
}

/** The rune line along a coping's outer face: a groove with gold laid in it, little runes along it. */
export function runeLine(glyph: string): BridgePainter {
  return (g, k, f) => {
    const y = (f.y0 + f.y1) / 2;
    g.strokeStyle = css(mix(k.fill, hex('#5a4e5e'), 0.35), 0.8);
    g.lineWidth = 0.32;
    g.beginPath(); g.moveTo(f.x0 - 1, y); g.lineTo(f.x1 + 1, y); g.stroke();
    g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.3), 0.75);
    g.lineWidth = 0.14;
    g.stroke();
    const every = 10;
    for (let x = Math.ceil(Math.min(f.x0, f.x1) / every) * every; x < Math.max(f.x0, f.x1); x += every) {
      glyphPath(g, glyph, x, y, 0.45);
      g.strokeStyle = css(hex(RUNE_GOLD), 0.8);
      g.lineWidth = 0.12;
      g.stroke();
    }
  };
}

/** A painter of one role or another, by role. */
export const byRole = (m: Partial<Record<Role, BridgePainter>>, any?: BridgePainter): Partial<Record<Role, BridgePainter>> & { any?: BridgePainter } => ({ ...m, any });

/** A material's pastel tones off its colour (`MaterialDef.color`): lit toward cream, shade toward the island's lilac dusk. */
export function pastel(c: readonly number[], lift = 0.25, dusk = 0.5): Tone {
  const rgb: RGB = [c[0], c[1], c[2]];
  return { lit: mix(rgb, [255, 246, 232], lift), shade: mix(mix(rgb, hex('#6a6080'), dusk), [0, 0, 0], 0.05) };
}

export { add, sub, DECK };
