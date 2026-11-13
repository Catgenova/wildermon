/**
 * A low-poly body's skeleton as the clip player sees it (the asset `tools/sculpt/lowrig.mjs` writes): its posed bones, the
 * clip's turns carried onto them, and the procedural layer done on the posed bones in the world -- the arms kept off the
 * body, the feet kept planted (the legs bent to reach them), the head turned to look.
 *
 * The mesh's frame: x the body's left, y up, z forward. The helpers (`kind: 'helper'`) are left to `../lowpoly.ts`
 * `posed`, which drives them from the posed bones as it always has.
 */
import { add, axisAngle, between, col, cross, dot, euler, I3, len, mm, mv, quat, qmat, scl, slerp, sub, tr, unit, type Euler, type M3, type Q, type V } from './math';
import type { Foot, GripAt, HandAt, Side } from './clip';

export interface AnimBone { name: string; p: number; kind: 'control' | 'helper'; head: V; R: M3 }
export interface AnimAsset {
  who?: string; floor: number; verts: number[]; bones: AnimBone[];
  /** The vertices of the soles. */
  soles?: number[];
  game: { armIn: number; armSwing?: [number, number]; armSwingAt?: number };
}
export type Body = 'man' | 'woman';
/**
 * The procedural layer's inputs (`Skeleton.finish`): where the feet are planted; how much further out the arms are kept;
 * both hands on one handle (`grip`, with what is `held`); or the arms as keyed (`free`), the hands in `hands` reached to
 * their places, each fist closed on the tool in it (`tools`); or each fist in `reach` put on a place given in the mesh's own
 * units and frame (a seat's reins, oars or tiller: `../index.ts` seatedLocal), its grip along `way`.
 */
export interface FinishOptions { plant?: Plant; armsOut?: number; grip?: GripAt; held?: Held; free?: boolean; hands?: Partial<Record<Side, HandAt>>; tools?: Partial<Record<Side, Held>>; reach?: Partial<Record<Side, { at: V; way: V }>> }
/** The most of its length a planted leg is stretched to (bone-straight, its knee is the rig's straightest): nearly locked. */
const REACH = 0.998;
/** The share of its reach over which a leg in the air straightens softly toward its foot's place (`finish`). */
const SOFT = 0.08;

/** A pose as the player blends it: each bone's local turn (in the body's own bone frame) and the body's shift, mesh units. */
export interface Pose { q: Array<Q | undefined>; move: V }
/**
 * Where the feet are planted: each ankle's place and each foot's turn in the world; for a foot rolled up onto its toes,
 * the toes' turn in the world (kept flat on the ground) and how far they are held to it (1: wholly); and how far each
 * foot is off the ground (1: in the air, where it is reached for without the hips let down to it).
 */
export interface Plant {
  at: [V, V]; W: [M3, M3];
  ball?: [{ W: M3; w: number } | undefined, { W: M3; w: number } | undefined];
  air?: [number, number];
}
export interface Frame { W: M3; P: V }

export interface Skeleton {
  body: Body;
  bones: AnimBone[];
  at: Map<string, number>;
  /** Sole to crown, mesh units. */
  height: number;
  /** A turn authored in the man's bone frame (`./clip.ts`), as this body's local turn of the bone. */
  local(bone: number, e: Euler): Q;
  /** A turn about an axis of the mesh's frame (x left, y up, z forward) through the bone, as its local turn. */
  world(bone: number, axis: V, deg: number): Q;
  /** The control bones' world turns and heads for local turns (bone index -> 3x3) and a shift. */
  fk(local: Array<M3 | undefined>, move: V): Frame[];
  /**
   * The procedural layer on a pose: arms kept out (by `armsOut` more than the body's own), or for both hands on one
   * handle (`grip`, `./clip.ts` Clip.grip) the left reached to the right's handle instead; feet planted; locals out.
   */
  finish(pose: Pose, o?: FinishOptions): { local: Array<M3 | undefined>; move: V };
  /** Where each fist closes on what is held (or a handle): its socket's place and frame, and the grip's way toward the thumb. */
  gripOf(F: Frame[], held?: Held): Array<{ at: V; R: M3; way: V }>;
  /** Where a pose stands its feet. */
  plantOf(pose: Pose): Plant;
  /** Mesh units to one of the game's (`../../render/iso` UNITS_PER_TILE to a tile): this body's height over its height in the game. */
  perGame: number;
  /**
   * The feet keyed by a clip (`Clip.feet`) from where a stance stands them: each moved forward by `z` strides of `stride`
   * game units, in toward the middle by `inward` body heights and up by `lift`, and pitched toe up about the back of its
   * heel or heel up about the ball of the foot (the toes then kept flat while it is on the ground).
   */
  step(base: Plant, feet: [Foot, Foot], stride: number, inward?: number): Plant;
}

/** Body heights a foot is lifted off the ground over which its toes are let go of it, and it counts as in the air. */
const TOE_LET_GO: [number, number] = [0.004, 0.05];
const AIR = 0.01;
/** How far in from the roots of the fingers, on the palm's side, a fist closes round a handle: body heights. */
const PALM = 0.012;
/** The most of its length a reached arm is stretched to: the elbow never quite straight, so the side it bends to stays defined. */
const REACH_ARM = 0.975;
/** The most a held prop's far end is let down onto the ground by turning the right wrist down (`GripAt.rest`): degrees. */
const DOWN = 40;
/**
 * The furthest in toward the chest (the cosine from straight out) the left elbow is put to line its forearm up with its
 * hand, by body: hers kept further out, off her chest.
 */
const ELBOW_IN: Record<Body, number> = { man: -0.1, woman: 0.2 };
/** Game units between the fists on a handle when nothing held says. */
const GAP = 0.76;

/**
 * A prop held in both hands (`./clip.ts` Clip.grip), as its asset gives it for a body: each hand's socket at rest (mesh
 * units and axes; R's columns x along the hand toward the knuckles, y along the grip toward the thumb), and along the
 * prop's own y (game units) the lead (right) fist's place, the other's and its point; game units to a mesh unit.
 */
export interface Held {
  sockets: Record<'l' | 'r', { o: V; R: M3; curl?: Record<string, Euler> }>; lead: number; second: number; tip: number; scale: number;
  /** Its points near the far end (its own frame, game units: x across the edge, y along it), of which the lowest is kept off the ground; the point alone if not given. */
  ends?: V[];
  /** A hand tool's point that meets the work (its own frame, game units): what the work clip strikes with or holds to it. */
  contact?: V;
  /**
   * How far its far end is let down onto the ground where the clip lets it down (`GripAt.rest` times this; 1 when not
   * given): the long sword's point rests on the ground at the swing's rest and drag; a pickaxe (0) keeps its head off it.
   */
  rest?: number;
  /** Where along it (its own y) the slash trail's inner edge is at the blade (`./trail.ts`); a share of the way from the lead fist to the far end where not given. */
  inner?: number;
}
const smooth = (x: number): number => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };

/**
 * The skeleton of a body, with the man's (`canon`) bone frames the clips are authored in, and its height in the game's
 * units (for a clip that keys its feet over the game's ground).
 */
export function skeleton(A: AnimAsset, canon: AnimAsset, gameHeight = 0): Skeleton {
  const bones = A.bones, at = new Map(bones.map((b, i) => [b.name, i]));
  const body: Body = A.who === 'female' ? 'woman' : 'man';
  const REL = bones.map((b) => (b.p >= 0 ? mm(tr(bones[b.p].R), b.R) : b.R));
  const OFF = bones.map((b) => (b.p >= 0 ? mv(tr(bones[b.p].R), sub(b.head, bones[b.p].head)) : b.head));
  // the man's frame of each bone carried into this one's: a turn E in his is C E Cᵀ in this body's, C = Rᵀ R_man
  const CANON = new Map(canon.bones.map((b) => [b.name, b.R]));
  const C = bones.map((b) => { const Rm = CANON.get(b.name); return Rm ? mm(tr(b.R), Rm) : I3; });
  let top = -Infinity;
  for (let i = 1; i < A.verts.length; i += 3) top = Math.max(top, A.verts[i]);
  const height = top - A.floor;
  const control = bones.map((b, i) => (b.kind === 'control' ? i : -1)).filter((i) => i >= 0);

  const local = (i: number, e: Euler): Q => quat(mm(C[i], mm(euler(e), tr(C[i]))));
  const world = (i: number, axis: V, deg: number): Q => quat(mm(tr(bones[i].R), mm(axisAngle(axis, deg), bones[i].R)));

  function fk(L: Array<M3 | undefined>, move: V): Frame[] {
    const out: Frame[] = [];
    for (const i of control) {
      const b = bones[i], l = L[i] ?? I3;
      if (b.p < 0) { out[i] = { W: mm(b.R, l), P: add(b.head, move) }; continue; }
      const pa = out[b.p];
      out[i] = { W: mm(pa.W, mm(REL[i], l)), P: add(pa.P, mv(pa.W, OFF[i])) };
    }
    return out;
  }
  /** A bone's local turn that puts it at world turn W, under its parent as posed. */
  const localFor = (F: Frame[], i: number, W: M3): M3 => { const b = bones[i]; return b.p < 0 ? mm(tr(b.R), W) : mm(tr(mm(F[b.p].W, REL[i])), W); };
  const toLocal = (pose: Pose): Array<M3 | undefined> => pose.q.map((q) => (q ? qmat(q) : undefined));

  const LEG = (['l', 'r'] as const).map((s) => ({ thigh: at.get(`thigh_${s}`) as number, calf: at.get(`calf_${s}`) as number, foot: at.get(`foot_${s}`) as number }));
  const ARM = (['l', 'r'] as const).flatMap((s) => [at.get(`upperarm_${s}`) as number, at.get(`lowerarm_${s}`) as number]);
  const CHEST = at.get('spine_03') as number;

  /*
   * The hands on a handle: each fist's socket (`Held.sockets`, or where a fist closes by default: across the palm against
   * the roots of the fingers, toward the thumb), carried by its hand bone.
   */
  const HANDS = (['l', 'r'] as const).map((s) => {
    const upper = at.get(`upperarm_${s}`) as number, lower = at.get(`lowerarm_${s}`) as number, hand = at.get(`hand_${s}`) as number, fing = at.get(`fingers_01_${s}`) as number;
    const R = bones[hand].R, root = mv(tr(R), sub(bones[fing].head, bones[hand].head));
    // the default socket in the hand's own frame: x along the hand, y across it toward the thumb (+x of the right hand, -x
    // of the left), on the palm's side (+z, which the fingers curl toward)
    const t = s === 'r' ? 1 : -1, x: V = [0, 1, 0], y: V = [t, 0, 0], z = cross(x, y);
    return { upper, lower, hand, o: [0, root[1], root[2] + PALM * height] as V, R: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]] };
  });
  /** A held prop's sockets in each hand's own frame (they are given at rest, in the mesh's frame), kept per prop. */
  const SOCKETS = new WeakMap<Held, Array<{ o: V; R: M3 }>>();
  const socketsOf = (held?: Held): Array<{ o: V; R: M3 }> => {
    if (!held) return HANDS;
    let k = SOCKETS.get(held);
    if (!k) SOCKETS.set(held, (k = HANDS.map((h, j) => { const sk = held.sockets[j ? 'r' : 'l'], Rb = bones[h.hand].R; return { o: mv(tr(Rb), sub(sk.o, bones[h.hand].head)), R: mm(tr(Rb), sk.R) }; })));
    return k;
  };
  function gripOf(F: Frame[], held?: Held): Array<{ at: V; R: M3; way: V }> {
    const so = socketsOf(held);
    return HANDS.map((h, j) => { const R = mm(F[h.hand].W, so[j].R); return { at: add(F[h.hand].P, mv(F[h.hand].W, so[j].o)), R, way: col(R, 1) }; });
  }
  /**
   * Both hands on what is held (`Clip.grip`): first the right wrist turned up, about the level line square to the grip, as
   * far as keeps the lowest of the prop's far end (`Held.ends`, or its point) `ground` off the ground, or turned down as
   * far as lets it down onto the ground by `rest` of the way (`DOWN` at most); then the left hand
   * put on the grip where its place is, closed on it as its socket says (the same frame as the right's), the elbow bent
   * about its hinge to reach, the upper arm swung onto it and turned about the line from the shoulder so the elbow stays
   * on the side it was keyed on.
   */
  function twoHands(L: Array<M3 | undefined>, F: Frame[], move: V, grip: GripAt, held: Held | undefined, floor: number): Frame[] {
    const [lh, rh] = HANDS, so = socketsOf(held), scale = held?.scale ?? (perGame ? 1 / perGame : 16.5 / height);
    // the fists closed on the grip as the prop's sockets say (turns in this body's own bone frames)
    if (held) for (const side of ['l', 'r'] as const) for (const [b, e] of Object.entries(held.sockets[side].curl ?? {})) { const i = at.get(`${b}_${side}`); if (i !== undefined) L[i] = euler(e); }
    F = fk(L, move);
    // the lowest of its far end, and how fast a turn up about the level line square to the grip lifts it
    const lowest = (): { low: number; rise: number; k: V } | undefined => {
      const g = gripOf(F, held)[1], ax = cross(g.way, [0, 1, 0]);
      if (len(ax) < 1e-6) return undefined;
      const k = unit(ax);
      let low = Infinity, rise = 0;
      for (const p of held?.ends ?? [[0, held?.tip ?? 0, 0] as V]) {
        const r = mv(g.R, scl(sub(p, [0, held?.lead ?? 0, 0]), 1 / scale)), y = g.at[1] + r[1];
        if (y < low) { low = y; rise = cross(k, r)[1]; }
      }
      return { low, rise, k };
    };
    const first = held?.tip ? lowest() : undefined;
    if (first) {
      // kept off the ground; let down onto it as far as `rest` says, the wrist turned down by at most DOWN
      const lo = floor + grip.ground / scale, want = first.low < lo ? lo : first.low + (lo - first.low) * Math.min(1, Math.max(0, grip.rest * (held?.rest ?? 1)));
      let turned = 0;
      for (let n = 0; n < 6; n++) {
        const m = lowest();
        if (!m || Math.abs(m.low - want) < 1e-4 || m.rise <= 1e-6) break;
        const deg = Math.max(-DOWN - turned, Math.min(30, (((want - m.low) / m.rise) * 180) / Math.PI));
        if (Math.abs(deg) < 1e-3) break;
        turned += deg;
        L[rh.hand] = localFor(F, rh.hand, mm(axisAngle(m.k, deg), F[rh.hand].W));
        F = fk(L, move);
      }
    }
    const g = gripOf(F, held)[1], W = mm(g.R, tr(so[0].R));
    const want = sub(add(g.at, scl(g.way, -((held ? held.lead - held.second : GAP) / scale))), mv(W, so[0].o));
    const S = F[lh.upper].P, E0 = F[lh.lower].P;
    // the elbow: bent about its hinge until the wrist is as far from the shoulder as the place wanted (or straight)
    const a = col(mm(F[lh.upper].W, REL[lh.lower]), 0), u = sub(F[lh.lower].P, S), v = sub(F[lh.hand].P, F[lh.lower].P);
    const vpar = dot(a, v), vperp = sub(v, scl(a, vpar)), A1 = dot(u, vperp), B1 = dot(u, cross(a, v)), M = Math.hypot(A1, B1);
    const D = Math.min(Math.hypot(...sub(want, S)), REACH_ARM * Math.sqrt(dot(u, u) + dot(v, v) + 2 * (dot(u, a) * vpar + M)));
    if (M > 1e-9) {
      const c = (D * D - dot(u, u) - dot(v, v)) / 2 - dot(u, a) * vpar, phi = Math.atan2(B1, A1), d = Math.acos(Math.max(-1, Math.min(1, c / M)));
      // straight at phi; bent the way the elbow bends (+x), never back past straight
      L[lh.lower] = mm(axisAngle([1, 0, 0], ((phi + d) * 180) / Math.PI), L[lh.lower] ?? I3);
      F = fk(L, move);
    }
    // the whole arm then turned about the shoulder so the wrist is on the line to the place and the elbow on the side it
    // was keyed on (leant out from the body by a quarter of the upper arm's length, so a keyed elbow passing near the line
    // from the shoulder to the hand does not flip it round): the elbow put where it must be, the arm's frame (shoulder to
    // wrist, shoulder to elbow) turned onto that one
    const outW = mv(mm(F[CHEST].W, tr(bones[CHEST].R)), [1, 0, 0]), E0b = add(E0, scl(outW, 0.25 * len(u)));
    const n = unit(sub(want, S)), off = (p: V): V => { const r = sub(p, S); return sub(r, scl(n, dot(r, n))); };
    let pole = off(E0b);
    if (len(pole) < 1e-6) pole = off(add(S, outW));
    pole = unit(pole);
    // and drawn toward the side that lines the forearm up with the hand on the grip (the elbow away from where the hand
    // points), as far as `lineUp` says, so the wrist is bent as little as the reach allows
    const lineUp = scl(off(add(S, col(W, 1))), -1);
    // (never so far that the elbow turns in toward the chest: less of the way where it would)
    const k = Math.min(1, Math.max(0, grip.lineUp)), outN = unit(off(add(S, outW)));
    if (k > 0 && len(lineUp) > 1e-6) {
      const at = (w: number): V => add(scl(pole, 1 - w), scl(unit(lineUp), w)), fits = (w: number): boolean => { const p2 = at(w); return len(p2) > 1e-3 && dot(unit(p2), outN) >= Math.min(ELBOW_IN[body], dot(pole, outN)); };
      // the most of the way that keeps it (found by halving, so it changes smoothly as the pose does)
      let w = k;
      if (!fits(k)) { let lo = 0, hi = k; for (let n = 0; n < 14; n++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; } w = lo; }
      if (w > 1e-4) pole = unit(at(w));
    }
    const K1 = F[lh.lower].P, W1 = F[lh.hand].P, la = len(sub(K1, S)), lb = len(sub(W1, K1)), lw = Math.max(1e-6, len(sub(W1, S)));
    const ca = Math.max(-1, Math.min(1, (la * la + lw * lw - lb * lb) / (2 * la * lw))), Ke = add(S, scl(add(scl(n, ca), scl(pole, Math.sqrt(1 - ca * ca))), la));
    const frame = (x: V, y: V): M3 => { const X = unit(x), Y = unit(sub(y, scl(X, dot(y, X)))), Z = cross(X, Y); return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; };
    L[lh.upper] = localFor(F, lh.upper, mm(mm(frame(n, sub(Ke, S)), tr(frame(sub(W1, S), sub(K1, S)))), F[lh.upper].W));
    F = fk(L, move);
    L[lh.hand] = localFor(F, lh.hand, W);
    return fk(L, move);
  }

  /**
   * One hand reached to a place (`Clip.hands`): its fist's socket (the tool's in it, or the default) put at `at` (mesh
   * units), its grip along `way`, its knuckles as near the forearm's way as that allows (the wrist bent least); the elbow
   * bent about its hinge to reach, the upper arm swung onto the line and turned about it so the elbow stays on the side it
   * was keyed on (as `twoHands` reaches the left). Twice over, the second time from the forearm the first put. With
   * `knuckles` (`HandAt.knuckles`) the knuckles point that way instead, square to the grip.
   */
  function reachTo(L: Array<M3 | undefined>, F: Frame[], move: V, s: 0 | 1, at: V, way: V, held?: Held, knuckles?: V): Frame[] {
    const h = HANDS[s], so = socketsOf(held)[s], y = unit(way);
    const frame = (x: V, yy: V): M3 => { const X = unit(x), Y = unit(sub(yy, scl(X, dot(yy, X)))), Z = cross(X, Y); return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; };
    for (let n = 0; n < 2; n++) {
      const fore = knuckles ?? unit(sub(F[h.hand].P, F[h.lower].P)), x = sub(fore, scl(y, dot(fore, y)));
      const X = len(x) > 1e-6 ? unit(x) : unit(cross(y, [0, 0, 1])), Z = cross(X, y);
      const G: M3 = [X[0], y[0], Z[0], X[1], y[1], Z[1], X[2], y[2], Z[2]], W = mm(G, tr(so.R));
      const want = sub(at, mv(W, so.o));
      const S = F[h.upper].P, E0 = F[h.lower].P;
      const a = col(mm(F[h.upper].W, REL[h.lower]), 0), u = sub(F[h.lower].P, S), v = sub(F[h.hand].P, F[h.lower].P);
      const vpar = dot(a, v), vperp = sub(v, scl(a, vpar)), A1 = dot(u, vperp), B1 = dot(u, cross(a, v)), M = Math.hypot(A1, B1);
      const D = Math.min(Math.hypot(...sub(want, S)), REACH_ARM * Math.sqrt(dot(u, u) + dot(v, v) + 2 * (dot(u, a) * vpar + M)));
      if (M > 1e-9) {
        const c = (D * D - dot(u, u) - dot(v, v)) / 2 - dot(u, a) * vpar, phi = Math.atan2(B1, A1), d = Math.acos(Math.max(-1, Math.min(1, c / M)));
        L[h.lower] = mm(axisAngle([1, 0, 0], ((phi + d) * 180) / Math.PI), L[h.lower] ?? I3);
        F = fk(L, move);
      }
      const outW = scl(mv(mm(F[CHEST].W, tr(bones[CHEST].R)), [1, 0, 0]), s === 0 ? 1 : -1), E0b = add(E0, scl(outW, 0.25 * len(u)));
      const nn = unit(sub(want, S)), off = (p: V): V => { const r = sub(p, S); return sub(r, scl(nn, dot(r, nn))); };
      let pole = off(E0b);
      if (len(pole) < 1e-6) pole = off(add(S, outW));
      pole = unit(pole);
      const K1 = F[h.lower].P, W1 = F[h.hand].P, la = len(sub(K1, S)), lb = len(sub(W1, K1)), lw = Math.max(1e-6, len(sub(W1, S)));
      const ca = Math.max(-1, Math.min(1, (la * la + lw * lw - lb * lb) / (2 * la * lw))), Ke = add(S, scl(add(scl(nn, ca), scl(pole, Math.sqrt(1 - ca * ca))), la));
      L[h.upper] = localFor(F, h.upper, mm(mm(frame(nn, sub(Ke, S)), tr(frame(sub(W1, S), sub(K1, S)))), F[h.upper].W));
      F = fk(L, move);
      L[h.hand] = localFor(F, h.hand, W);
      F = fk(L, move);
    }
    return F;
  }

  function plantOf(pose: Pose): Plant {
    const F = fk(toLocal(pose), pose.move);
    // each foot laid flat as it stands at rest, only turned about the upright as the stance turns it
    const flat = (i: number): M3 => {
      const f = mv(mm(F[i].W, tr(bones[i].R)), [0, 0, 1]);
      return mm(axisAngle([0, 1, 0], (Math.atan2(f[0], f[2]) * 180) / Math.PI), bones[i].R);
    };
    // each ankle as high as stands its own sole on the ground (the stance's turns at the hips lift one foot more than
    // the other: the body stood on the lower would leave the higher in the air)
    const on = (s: number): V => { const P = F[LEG[s].foot].P; return [P[0], FOOT[s].ankle[1] - (FOOT[s].sole - A.floor), P[2]]; };
    return { at: [on(0), on(1)], W: [flat(LEG[0].foot), flat(LEG[1].foot)] };
  }

  function finish(pose: Pose, o: FinishOptions = {}): { local: Array<M3 | undefined>; move: V } {
    const L = toLocal(pose);
    // each fist closed on the tool in it, as its socket says (turns in this body's own bone frames)
    for (const [side, held] of Object.entries(o.tools ?? {}) as Array<[Side, Held | undefined]>) for (const [b, e] of Object.entries(held?.sockets[side].curl ?? {})) { const i = at.get(`${b}_${side}`); if (i !== undefined) L[i] = euler(e); }
    let F = fk(L, pose.move);
    if (o.grip) {
      // the ground where the planted feet stand on it (a stance's feet can stand a little off the rest's floor)
      const up = o.plant ? Math.min(...LEG.map((g, s) => (o.plant as Plant).at[s][1] - bones[g.foot].head[1])) : 0;
      F = twoHands(L, F, pose.move, o.grip, o.held, A.floor + up);
    }
    // the arms kept off the body (as lowpoly.ts fromGame): seen from the chest, each upper arm and forearm turned out until
    // it leans in no further than the body's rule allows, further as it swings forward or back
    const chest = mm(F[CHEST].W, tr(bones[CHEST].R));
    for (const i of o.grip || o.free ? [] : ARM) {
      const b = bones[i], r0 = col(b.R, 1), side = Math.sign(r0[0]), v = mv(tr(chest), col(F[i].W, 1));
      const sw = A.game.armSwing ? A.game.armSwing[v[2] > 0 ? 0 : 1] * Math.min(1, Math.abs(v[2]) / (A.game.armSwingAt ?? 0.5)) : 0;
      const xmin = Math.min(0.95, Math.abs(r0[0]) * A.game.armIn + sw + (o.armsOut ?? 0));
      if (side * v[0] >= xmin) continue;
      const k = Math.sqrt((1 - xmin * xmin) / Math.max(1e-9, v[1] * v[1] + v[2] * v[2]));
      const ax = cross(v, [side * xmin, v[1] * k, v[2] * k]), ang = (Math.asin(Math.min(1, Math.hypot(ax[0], ax[1], ax[2]))) * 180) / Math.PI;
      if (ang < 1e-6) continue;
      L[i] = localFor(F, i, mm(mm(chest, mm(axisAngle(ax, ang), tr(chest))), F[i].W));
      F = fk(L, pose.move);
    }
    // the feet planted: each knee bent about its own hinge until the hip reaches the ankle's place, the thigh swung onto it,
    // the foot turned back to how it stood
    if (o.plant) {
      // the hips lowered just enough that neither leg has to stretch past REACH of its length to its ankle's place
      let drop = 0;
      for (let s = 0; s < 2; s++) {
        const { thigh, calf, foot } = LEG[s], H = F[thigh].P, a = col(mm(F[thigh].W, REL[calf]), 0);
        // the farthest the ankle goes, the knee turned straight about its hinge
        const u = sub(F[calf].P, H), v = sub(F[foot].P, F[calf].P), vpar = dot(a, v), vperp = sub(v, [a[0] * vpar, a[1] * vpar, a[2] * vpar]);
        const far = dot(u, u) + dot(v, v) + 2 * (dot(u, a) * vpar + Math.hypot(dot(u, vperp), dot(u, cross(a, v))));
        const reach = REACH * Math.sqrt(far);
        const r = sub(o.plant.at[s], H), q = r[1] * r[1] - dot(r, r) + reach * reach;
        if (dot(r, r) > reach * reach && q >= 0) drop = Math.max(drop, (1 - (o.plant.air?.[s] ?? 0)) * (-r[1] - Math.sqrt(q)));
      }
      const move: V = [pose.move[0], pose.move[1] - drop, pose.move[2]];
      pose = { q: pose.q, move };
      F = fk(L, move);
      for (let s = 0; s < 2; s++) {
        const { thigh, calf, foot } = LEG[s], target = o.plant.at[s];
        const H = F[thigh].P, K = F[calf].P, A0 = F[foot].P;
        const hingeW = mm(F[thigh].W, REL[calf]), a = col(hingeW, 0);
        const u = sub(K, H), v = sub(A0, K), vpar = dot(a, v), vperp = sub(v, [a[0] * vpar, a[1] * vpar, a[2] * vpar]), w = cross(a, v);
        const A1 = dot(u, vperp), B1 = dot(u, w), M = Math.hypot(A1, B1);
        let D = Math.hypot(...sub(target, H));
        // a foot in the air reached for softly: the knee straightened ever more slowly as it nears straight, never snapped
        const air = o.plant.air?.[s] ?? 0;
        if (air > 0) {
          const R = REACH * Math.sqrt(dot(u, u) + dot(v, v) + 2 * (dot(u, a) * vpar + M)), R0 = R * (1 - SOFT);
          if (D > R0) D += air * (R0 + R * SOFT * (1 - Math.exp(-(D - R0) / (R * SOFT))) - D);
        }
        const c = (D * D - dot(u, u) - dot(v, v)) / 2 - dot(u, a) * vpar;
        if (M > 1e-9) {
          const phi = Math.atan2(B1, A1), d = Math.acos(Math.max(-1, Math.min(1, c / M)));
          // straight at phi (the farthest the ankle goes); bent forward below it, never back past it
          const th = ((phi - d) * 180) / Math.PI;
          L[calf] = mm(axisAngle([1, 0, 0], th), L[calf] ?? I3);
          F = fk(L, pose.move);
        }
        const swing = between(sub(F[foot].P, H), sub(target, H));
        L[thigh] = localFor(F, thigh, mm(swing, F[thigh].W));
        F = fk(L, pose.move);
        L[foot] = localFor(F, foot, o.plant.W[s]);
        F = fk(L, pose.move);
        const toe = o.plant.ball?.[s], bi = FOOT[s].ballBone;
        if (toe && bi >= 0) {
          const want = quat(localFor(F, bi, toe.W));
          L[bi] = qmat(toe.w >= 1 ? want : slerp(quat(L[bi] ?? I3), want, toe.w));
          F = fk(L, pose.move);
        }
      }
    }
    // the hands reached to their places, in the frame the feet stand in (the ground where they stand on it)
    if (o.hands) {
      const up = o.plant ? Math.min(...LEG.map((g, s) => (o.plant as Plant).at[s][1] - bones[g.foot].head[1])) : 0;
      for (const [side, h] of Object.entries(o.hands) as Array<[Side, HandAt]>) {
        const s = side === 'l' ? 0 : 1, p: V = [h.at[0] * height, A.floor + up + h.at[1] * height, h.at[2] * height];
        F = reachTo(L, F, pose.move, s, p, h.way, o.tools?.[side], h.knuckles);
      }
    }
    for (const [side, h] of Object.entries(o.reach ?? {}) as Array<[Side, { at: V; way: V }]>) F = reachTo(L, F, pose.move, side === 'l' ? 0 : 1, h.at, h.way);
    return { local: L, move: pose.move };
  }

  // each foot's ankle, ball and the back of its heel at rest: the heel the sole's hindmost point on that side; its sole's lowest
  const FOOT = LEG.map(({ foot }) => {
    const ballBone = bones.findIndex((b) => b.p === foot && b.kind === 'control'), ankle = bones[foot].head, ball = ballBone >= 0 ? bones[ballBone].head : ankle;
    let heel: V = [ankle[0], A.floor, ankle[2]], sole = Infinity;
    for (const vi of A.soles ?? []) {
      const p: V = [A.verts[vi * 3], A.verts[vi * 3 + 1], A.verts[vi * 3 + 2]];
      if (Math.sign(p[0]) !== Math.sign(ankle[0])) continue;
      if (p[2] < heel[2]) heel = p;
      sole = Math.min(sole, p[1]);
    }
    // (and its sole's lowest point at rest)
    return { ankle, ball, heel, ballBone, sole: Number.isFinite(sole) ? sole : A.floor };
  });
  const perGame = gameHeight > 0 ? height / gameHeight : 0;

  function step(base: Plant, feet: [Foot, Foot], stride: number, inward = 0): Plant {
    const out: Plant = { at: [base.at[0], base.at[1]], W: [base.W[0], base.W[1]], ball: [undefined, undefined], air: [0, 0] };
    for (let s = 0; s < 2; s++) {
      const f = feet[s], g = FOOT[s], { foot } = LEG[s];
      // the foot's turn from rest on the ground (about the upright only), and where its ankle is put flat
      const S = mm(base.W[s], tr(bones[foot].R));
      const flat = add(base.at[s], [-Math.sign(g.ankle[0]) * inward * height, f.lift * height, f.z * stride * perGame]);
      // pitched about the back of the heel (toe up) or the ball of the foot (heel up), across the foot
      const pivot = add(flat, mv(S, sub(f.pitch >= 0 ? g.heel : g.ball, g.ankle)));
      const P = axisAngle(mv(S, [1, 0, 0]), -f.pitch);
      out.at[s] = add(pivot, mv(P, sub(flat, pivot)));
      out.W[s] = mm(P, base.W[s]);
      // up on the toes on the ground, the toes kept flat on it
      (out.air as [number, number])[s] = smooth(f.lift / AIR);
      const w = f.pitch < 0 ? 1 - smooth((f.lift - TOE_LET_GO[0]) / (TOE_LET_GO[1] - TOE_LET_GO[0])) : 0;
      if (w > 0 && g.ballBone >= 0) (out.ball as NonNullable<Plant['ball']>)[s] = { W: mm(S, bones[g.ballBone].R), w };
    }
    return out;
  }

  return { body, bones, at, height, local, world, fk, finish, gripOf, plantOf, perGame, step };
}
