import { kitOf, type Anim, type Kind, type Piece } from './beasts';
import { place, type Mat, type Mesh, type Palette, type V3, type Xf } from './figure';
import { HYBRID_LOOKS } from './hybridlooks';

/**
 * A hybrid's model (`game/hybridlist.ts`), made from its two parents' at the same stage rather than modelled by hand:
 * one parent's body and the other's markings and colours.
 *
 *   * **Body**, from its first parent: its bones and how they move, every piece of it, its size, its shadow and stride,
 *     its glow and what it throws about at its task, a strike and evolving.
 *   * **Markings**, from its second parent: what that one's head carries that is not the head itself or a part of its
 *     face -- a crown, a crest, horns, a cap, a hat, leaves, a wreath -- and its ears, each taken off where it stands on
 *     that parent's head and put where it stands on this one's, scaled to its head (`graft`). The body parent's own
 *     head things give way to them: its crown to the other's crown, its ears to the other's ears.
 *   * **Colours**: the hybrid's own variants (`SpeciesDef.variants`, its markings parent's colours) through each
 *     parent's own palette, the body parent's for its pieces and the markings parent's for the pieces it gave, so a
 *     leaf of one stays a leaf of its own green on the other's head (`palette`).
 */

/** Standing still, the pose both parents are measured in. */
const STILL: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
/** The bones a head's own things hang from besides the head: its ears or antennae, and a crest, a crown or a cap on a bone of its own, or eye stalks. */
const EAR_BONES = new Set(['ear0', 'ear1', 'earL', 'earR', 'ant0', 'ant1']);
const CROWN_BONES = new Set(['crest', 'crown', 'cap', 'tent0', 'tent1']);
/** What on a head is the head itself or a part of its face, and never taken: the skull, a muzzle, a beak, teeth, a trunk. */
const FACE = new Set(['head', 'headq', 'muzzle', 'beak', 'bill', 'teeth', 'chin', 'jaw', 'trunk', 'held', 'cheek', 'whiskers', 'brows']);
const isEar = (p: Piece): boolean => EAR_BONES.has(p.bone) || /^ear[01LR]$/.test(p.key);
/** Eye stalks: taken from a markings parent, never given way by a body parent (its eyes may be on them). */
const isStalk = (p: Piece): boolean => p.bone === 'tent0' || p.bone === 'tent1';
/** A head thing of a kind: on its head, an ear or a crown bone, and not part of the face. */
const headThing = (p: Piece): boolean => (p.bone === 'head' || EAR_BONES.has(p.bone) || CROWN_BONES.has(p.bone)) && !FACE.has(p.key);
/** A back of plates, bricks or crystals over a body (`back` on a lizard's trunk), taken onto a body that has one of its own. */
const isBack = (p: Piece): boolean => p.key === 'back';
/** Everything a markings parent may give. */
const marking = (p: Piece): boolean => headThing(p) || isBack(p);
/**
 * Colours a piece the markings parent gave may be moved to, where the body parent's pieces use the colour it is drawn
 * in under another name: names no wildermon is drawn in, lit as a coat is (none of the metals, whose shadows go cool).
 */
const SPARE: readonly Mat[] = [
  'cloth', 'clothDark', 'lining', 'leather', 'leatherDark', 'leatherLit', 'wood', 'woodDark', 'grip', 'string', 'lace',
  'tunic', 'trim', 'trousers', 'boot', 'cuff', 'sole', 'belt', 'hair', 'brow', 'stubble', 'shaved', 'rein', 'haft', 'fletch',
];

type Box = { lo: V3; hi: V3 };
const boxOf = (vs: readonly V3[]): Box => {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const v of vs) for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i], v[i]);
    hi[i] = Math.max(hi[i], v[i]);
  }
  return { lo, hi };
};
const mid = (b: Box): V3 => [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
const span = (b: Box): V3 => [Math.max(1e-3, b.hi[0] - b.lo[0]), Math.max(1e-3, b.hi[1] - b.lo[1]), Math.max(1e-3, b.hi[2] - b.lo[2])];

/** A bone's frame undone: a point in the body's space back into the bone's own. */
function unplace(x: Xf, w: V3): V3 {
  const [a, b, c, d, e, f, g, h, i] = x.m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const inv = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  const p: V3 = [w[0] - x.t[0], w[1] - x.t[1], w[2] - x.t[2]];
  return [inv[0] * p[0] + inv[1] * p[1] + inv[2] * p[2], inv[3] * p[0] + inv[4] * p[1] + inv[5] * p[2], inv[6] * p[0] + inv[7] * p[1] + inv[8] * p[2]];
}
/** A direction through a frame, and back out of another. */
const turn = (from: Xf, to: Xf, d: V3): V3 => {
  const o: V3 = [0, 0, 0];
  const w = place({ m: from.m, t: o }, d);
  return unplace({ m: to.m, t: o }, w);
};

/** A piece of a kind as it stands, by its key, the first of `keys` it has: its bone and its corners' box in the body's space. */
function anchor(kit: readonly Piece[], bones: Record<string, Xf>, keys: readonly string[]): { bone: string; box: Box } | null {
  for (const key of keys) {
    const p = kit.find((q) => q.key === key && bones[q.bone]);
    if (p) return { bone: p.bone, box: boxOf(p.mesh.v.map((v) => place(bones[p.bone], v))) };
  }
  return null;
}
/**
 * A parent's pieces at a level of detail, and its bones standing, made once however many hybrids it is a parent of
 * (a Sapgnaw is three hybrids' body): the field guide draws every hybrid at once, and each build is a parent's whole body.
 */
const builds = new WeakMap<Kind, Map<number, Piece[]>>();
const built = (k: Kind, lod: number, key?: string): Piece[] => {
  // Under the parent's own key, its pieces are the ones its own drawing keeps (`kitOf`), built once for both.
  if (key) return kitOf(key, k, lod);
  let byLod = builds.get(k);
  if (!byLod) builds.set(k, (byLod = new Map()));
  let kit = byLod.get(lod);
  if (!kit) byLod.set(lod, (kit = k.build(lod)));
  return kit;
};
const stood = new WeakMap<Kind, Record<string, Xf>>();
const still = (k: Kind): Record<string, Xf> => {
  let b = stood.get(k);
  if (!b) stood.set(k, (b = k.bones(STILL)));
  return b;
};
/** The most across a head thing is carried at, against the head it goes on (corner to corner). */
const HEAD_MOST = 1.5;
/** All of a kind standing, every piece on a bone. */
const whole_ = (kit: readonly Piece[], bones: Record<string, Xf>): Box =>
  boxOf(kit.filter((p) => bones[p.bone]).flatMap((p) => p.mesh.v.map((v) => place(bones[p.bone], v))));
/** What a kind's body is measured by, the first it has: its body, torso, hips, shell, abdomen, thorax or foot. */
const BODY_KEYS = ['body', 'torso', 'hips', 'shell', 'abd', 'thorax', 'foot', 'skirt', 'waist', 'hide'];
/** Where a tail is rooted: its first tail bone. */
const TAIL_BONES = ['tail0', 'tail', 't0_0'];
const isTail = (p: Piece): boolean => /^(tail\d*|t0_\d+)$/.test(p.bone) || /^tail\d*$/.test(p.key);

/** What a graft is: the markings parent's pieces, moved onto the body parent, and the body's own that give way to them. */
interface Graft {
  pieces: Piece[];
  drop: Set<string>;
}

/**
 * One of the markings parent's big shapes, carried over whole (`HybridLook.parts`): its pieces by key, onto the body
 * parent's head, body or tail, at a size of the body's own and moved by a share of the body's box; and which of the
 * body's own pieces give way to it.
 */
export interface HybridPart {
  keys: readonly string[];
  to: 'head' | 'body' | 'tail';
  /**
   * What it is placed and sized against on the body: the piece each parent's body is measured by (`BODY_KEYS`), or,
   * `whole`, all of each parent standing (for a shape much bigger than the body it came off).
   */
  fit?: 'whole';
  /** Over the size the two parents' boxes give it. */
  scale?: number;
  /** Moved by these shares of the body parent's box, along its three axes. */
  shift?: V3;
  /** Turned this many degrees about its middle, its top toward the body's back: a shell onto a body that stands upright. */
  tilt?: number;
  /** The body parent's pieces that give way to it; a tail always gives way to a tail. */
  drop?: readonly string[];
}
/** How a hybrid is put together beyond its markings parent's head things and back: its big shapes, and whether its back is taken. */
export interface HybridLook {
  parts?: readonly HybridPart[];
  /** False to keep the body parent's own back (`isBack`). */
  back?: boolean;
  /** False to keep the body parent's own ears, where they are its big shape. */
  ears?: boolean;
}

/** Pieces of the markings parent carried onto the body parent: each corner through `to`, and hung on `bone`. */
function carry(taken: readonly Piece[], mb: Record<string, Xf>, onto: Xf, bone: string, to: (w: V3, pc: V3, across: number) => V3, at: readonly string[],
  recolour: (m: Mat) => Mat): Piece[] {
  const keyOf = (key: string): string => `x:${key}`;
  const takenKeys = new Set(taken.map((p) => p.key));
  const refs = (x: string | string[] | undefined): string | string[] | undefined => {
    if (x === undefined) return undefined;
    const out = (Array.isArray(x) ? x : [x]).map((s) => (takenKeys.has(s) ? keyOf(s) : at.includes(s) ? s : null)).filter((s): s is string => !!s);
    return out.length ? out : undefined;
  };
  const moveMesh = (m: Mesh, xf: Xf, pc: V3, across: number): Mesh => ({
    v: m.v.map((v) => unplace(onto, to(place(xf, v), pc, across))),
    f: m.f.map((f) => ({ ...f, m: recolour(f.m) })),
    e: m.e,
  });
  return taken.map((p): Piece => {
    const xf = mb[p.bone];
    const box = boxOf(p.mesh.v.map((v) => place(xf, v)));
    const pc = mid(box), across = Math.hypot(...span(box));
    return {
      key: keyOf(p.key),
      mesh: moveMesh(p.mesh, xf, pc, across),
      bone,
      ...(p.shut ? { shut: moveMesh(p.shut, xf, pc, across) } : {}),
      ...(p.bias !== undefined ? { bias: p.bias } : {}),
      ...(p.convex !== undefined ? { convex: p.convex } : {}),
      ...(refs(p.after) ? { after: refs(p.after) } : {}),
      ...(refs(p.under) ? { under: refs(p.under) } : {}),
      ...(p.front ? { front: turn(xf, onto, p.front) } : {}),
      ...(p.shown ? { shown: p.shown } : {}),
      ...(p.lines !== undefined ? { lines: p.lines } : {}),
      ...(p.airy !== undefined ? { airy: p.airy } : {}),
      ...(p.rim !== undefined ? { rim: p.rim } : {}),
      ...(p.even !== undefined ? { even: p.even } : {}),
      ...(p.thin !== undefined ? { thin: p.thin } : {}),
      ...(p.chain !== undefined ? { chain: keyOf(p.chain) } : {}),
      ...(p.sheen !== undefined ? { sheen: recolour(p.sheen) } : {}),
    };
  });
}

/**
 * The markings parent's pieces of one region, off where they stand on it and onto the body parent: head things against
 * each one's skull (the `head` piece), and a back or a big shape against each one's body (`BODY_KEYS`). Each piece's
 * middle is set where it stands against its own parent's box, on the body parent's box, and the piece is scaled about it
 * by how the two boxes compare (the cube root of their ratio, so a crown on a narrow head is not squashed flat), then
 * hung on the bone the body parent's box is on, so it moves with it. A tail goes root to root instead, at the size the
 * two bodies give it, on the body parent's first tail bone, so it swings as that one's did.
 */
function region(body: Kind, marks: Kind, bodyKit: readonly Piece[], markKit: readonly Piece[], at: 'head' | 'body' | 'tail', takes: (p: Piece) => boolean,
  recolour: (m: Mat) => Mat, part?: HybridPart): Piece[] {
  const bb = still(body), mb = still(marks);
  const keys = at === 'head' ? ['head'] : BODY_KEYS;
  const to = anchor(bodyKit, bb, keys), from = anchor(markKit, mb, keys);
  if (!to || !from) return [];
  const taken = markKit.filter((p) => takes(p) && mb[p.bone]);
  if (!taken.length) return [];
  // A big shape on the body is placed and sized against the whole of each parent, the rest against the piece they are measured by.
  const whole = part?.fit === 'whole' && at === 'body';
  const tb = whole ? whole_(bodyKit, bb) : to.box, fb = whole ? whole_(markKit, mb) : from.box;
  const ct = mid(tb), cf = mid(fb), st = span(tb), sf = span(fb);
  const r: V3 = [st[0] / sf[0], st[1] / sf[1], st[2] / sf[2]];
  const k = Math.cbrt(r[0] * r[1] * r[2]) * (part?.scale ?? 1);
  const shift = part?.shift ?? [0, 0, 0];
  const off: V3 = [shift[0] * st[0], shift[1] * st[1], shift[2] * st[2]];
  // Turned about its own middle, its top toward the body's back, for a shell going onto a body that stands upright.
  const a = ((part?.tilt ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const tilt = (d: V3): V3 => [d[0], d[1] * ca - d[2] * sa, d[1] * sa + d[2] * ca];
  if (at !== 'tail') {
    // A head thing never more than `HEAD_MOST` times across the head it goes on, however big it was on its own.
    const most = !part && at === 'head' ? HEAD_MOST * Math.hypot(...st) : Infinity;
    return carry(taken, mb, bb[to.bone], to.bone, (w, pc, across) => {
      const d = tilt([w[0] - pc[0], w[1] - pc[1], w[2] - pc[2]]);
      const kk = Math.min(k, most / across);
      return [0, 1, 2].map((i) => ct[i] + (pc[i] - cf[i]) * r[i] + d[i] * kk + off[i]) as V3;
    }, at === 'head' ? ['head'] : [], recolour);
  }
  // Root to root: the markings' first tail bone onto the body's, or the back of the body's box for one with no tail.
  const fromBone = TAIL_BONES.find((b) => mb[b]);
  const fromRoot = fromBone ? mb[fromBone].t : mid(boxOf(taken.flatMap((p) => p.mesh.v.map((v) => place(mb[p.bone], v)))));
  const tailBone = TAIL_BONES.find((b) => bb[b]);
  let toRoot: V3;
  if (tailBone) toRoot = bb[tailBone].t;
  else {
    const head = anchor(bodyKit, bb, ['head']);
    const fwd: V3 = head ? [mid(head.box)[0] - ct[0], mid(head.box)[1] - ct[1], 0] : [1, 0, 0];
    const n = Math.hypot(fwd[0], fwd[1]) || 1;
    toRoot = [ct[0] - (fwd[0] / n) * st[0] * 0.45, ct[1] - (fwd[1] / n) * st[1] * 0.45, ct[2]];
  }
  const bone = tailBone ?? to.bone;
  return carry(taken, mb, bb[bone], bone, (w) => {
    const d = tilt([w[0] - fromRoot[0], w[1] - fromRoot[1], w[2] - fromRoot[2]]);
    return [0, 1, 2].map((i) => toRoot[i] + d[i] * k + off[i]) as V3;
  }, [], recolour);
}

/**
 * The markings parent's head things onto the body parent's head, its back onto the body parent's back where both have
 * one, and its big shapes (`HybridLook.parts`).
 */
function graft(body: Kind, marks: Kind, bodyKit: readonly Piece[], markKit: readonly Piece[], recolour: (m: Mat) => Mat, look: HybridLook): Graft {
  const takes = (p: Piece): boolean => headThing(p) && (look.ears !== false || !isEar(p));
  const head = region(body, marks, bodyKit, markKit, 'head', takes, recolour);
  const back = look.back !== false && bodyKit.some(isBack) ? region(body, marks, bodyKit, markKit, 'body', isBack, recolour) : [];
  // The body's own give way: its ears to the other's ears or antennae, its crown things to the other's, its back to the other's back.
  const gave = head.length > 0;
  const ears = gave && markKit.some((p) => takes(p) && isEar(p));
  const crown = gave && markKit.some((p) => takes(p) && !isEar(p) && !isStalk(p));
  const drop = new Set(bodyKit.filter((p) => (headThing(p) && !isStalk(p) && ((isEar(p) && ears) || (!isEar(p) && crown))) || (isBack(p) && back.length > 0))
    .map((p) => p.key));
  const parts: Piece[] = [];
  for (const part of look.parts ?? []) {
    const keys = new Set(part.keys);
    const got = region(body, marks, bodyKit, markKit, part.to, (p) => keys.has(p.key), recolour, part);
    if (!got.length) continue;
    parts.push(...got);
    for (const k of part.drop ?? []) drop.add(k);
    if (part.to === 'tail') for (const p of bodyKit) if (isTail(p)) drop.add(p.key);
  }
  return { pieces: [...head, ...back, ...parts], drop };
}

/** The colours a kind's pieces are drawn in. */
const matsOf = (kit: readonly Piece[]): Set<Mat> => {
  const out = new Set<Mat>();
  for (const p of kit) {
    for (const f of p.mesh.f) out.add(f.m);
    if (p.sheen) out.add(p.sheen);
  }
  return out;
};

/**
 * A hybrid's model at one stage: `body`'s, with `marks`'s head things on its head and its back on its back (`graft`), and each parent's
 * palette for its own pieces.
 */
export function hybridKind(body: Kind, marks: Kind, look: HybridLook = {}, keys: readonly [string?, string?] = []): Kind {
  const [bodyKey, marksKey] = keys;
  // Worked out once, off the first build asked for: which of the markings' colours the body uses too, and where they go.
  let moved: Map<Mat, Mat> | null = null;
  let given: Set<Mat> = new Set();
  let lastLod = 0;
  const recolouring = (): Map<Mat, Mat> => {
    if (moved) return moved;
    const bodyKit = built(body, lastLod, bodyKey), markKit = built(marks, lastLod, marksKey);
    const used = matsOf(bodyKit.filter((p) => !marking(p) || p.key === 'head'));
    const wanted = new Set((look.parts ?? []).flatMap((p) => p.keys));
    given = matsOf(markKit.filter((p) => marking(p) || wanted.has(p.key)));
    const spare = SPARE.filter((m) => !used.has(m) && !given.has(m));
    moved = new Map();
    for (const m of given) if (used.has(m) && spare.length) moved.set(m, spare.shift()!);
    return moved;
  };
  const recolour = (m: Mat): Mat => recolouring().get(m) ?? m;
  return {
    ...body,
    build: (lod) => {
      lastLod = lod;
      const bodyKit = built(body, lod, bodyKey);
      const g = graft(body, marks, bodyKit, built(marks, lod, marksKey), recolour, look);
      return [...bodyKit.filter((p) => !g.drop.has(p.key)), ...g.pieces];
    },
    palette: (coat, mark) => {
      const pal: Palette = { ...body.palette(coat, mark) };
      const theirs = marks.palette(coat, mark);
      // The markings' colours the body does not use, under their own names; those it does, under the spare names.
      const to = recolouring();
      for (const m of given) pal[to.get(m) ?? m] = theirs[m];
      return pal;
    },
  };
}

/** A hybrid's models at each of its stages, from its parents' at the same stage, put together as its look says. */
export function hybridStages(body: { kind: Kind; stages?: readonly [Kind, Kind] }, marks: { kind: Kind; stages?: readonly [Kind, Kind] }, look: HybridLook = {},
  ids: readonly [string?, string?] = []): { kind: Kind; stages?: readonly [Kind, Kind] } {
  const at = (l: { kind: Kind; stages?: readonly [Kind, Kind] }, s: number): Kind => (s > 0 ? l.stages?.[s - 1] ?? l.kind : l.kind);
  // Each parent's pieces under the key its own drawing keeps them under at that stage (`wildermonKind`).
  const key = (l: { stages?: readonly [Kind, Kind] }, id: string | undefined, s: number): string | undefined =>
    (id === undefined ? undefined : s > 0 && l.stages ? `${id}@${s}` : id);
  const one = (s: number): Kind => hybridKind(at(body, s), at(marks, s), look, [key(body, ids[0], s), key(marks, ids[1], s)]);
  return { kind: one(0), stages: [one(1), one(2)] };
}

/** A hybrid's models at each stage, by its id, as its look says (`HYBRID_LOOKS`). */
export const hybridLine = (id: string, body: { kind: Kind; stages?: readonly [Kind, Kind] }, marks: { kind: Kind; stages?: readonly [Kind, Kind] }, a?: string, b?: string) =>
  hybridStages(body, marks, HYBRID_LOOKS[id], [a, b]);
