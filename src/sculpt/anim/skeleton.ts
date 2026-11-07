/**
 * A low-poly body's skeleton as the clip player sees it (the asset `tools/sculpt/lowrig.mjs` writes): its posed bones, the
 * clip's turns carried onto them, and the procedural layer done on the posed bones in the world -- the arms kept off the
 * body, the feet kept planted (the legs bent to reach them), the head turned to look.
 *
 * The mesh's frame: x the body's left, y up, z forward. The helpers (`kind: 'helper'`) are left to `../lowpoly.ts`
 * `posed`, which drives them from the posed bones as it always has.
 */
import { add, axisAngle, between, col, cross, dot, euler, I3, mm, mv, quat, qmat, sub, tr, type Euler, type M3, type Q, type V } from './math';

export interface AnimBone { name: string; p: number; kind: 'control' | 'helper'; head: V; R: M3 }
export interface AnimAsset {
  who?: string; floor: number; verts: number[]; bones: AnimBone[];
  game: { armIn: number; armSwing?: [number, number]; armSwingAt?: number };
}
export type Body = 'man' | 'woman';
/** The most of its length a planted leg is stretched to (bone-straight, its knee is the rig's straightest): nearly locked. */
const REACH = 0.998;

/** A pose as the player blends it: each bone's local turn (in the body's own bone frame) and the body's shift, mesh units. */
export interface Pose { q: Array<Q | undefined>; move: V }
/** Where the feet are planted: each ankle's place and each foot's turn in the world. */
export interface Plant { at: [V, V]; W: [M3, M3] }
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
  /** The procedural layer on a pose: arms kept out (by `armsOut` more than the body's own), feet planted; locals out. */
  finish(pose: Pose, o?: { plant?: Plant; armsOut?: number }): { local: Array<M3 | undefined>; move: V };
  /** Where a pose stands its feet. */
  plantOf(pose: Pose): Plant;
}

/** The skeleton of a body, with the man's (`canon`) bone frames the clips are authored in. */
export function skeleton(A: AnimAsset, canon: AnimAsset): Skeleton {
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

  function plantOf(pose: Pose): Plant {
    const F = fk(toLocal(pose), pose.move);
    // each foot laid flat as it stands at rest, only turned about the upright as the stance turns it
    const flat = (i: number): M3 => {
      const f = mv(mm(F[i].W, tr(bones[i].R)), [0, 0, 1]);
      return mm(axisAngle([0, 1, 0], (Math.atan2(f[0], f[2]) * 180) / Math.PI), bones[i].R);
    };
    return { at: [F[LEG[0].foot].P, F[LEG[1].foot].P], W: [flat(LEG[0].foot), flat(LEG[1].foot)] };
  }

  function finish(pose: Pose, o: { plant?: Plant; armsOut?: number } = {}): { local: Array<M3 | undefined>; move: V } {
    const L = toLocal(pose);
    let F = fk(L, pose.move);
    // the arms kept off the body (as lowpoly.ts fromGame): seen from the chest, each upper arm and forearm turned out until
    // it leans in no further than the body's rule allows, further as it swings forward or back
    const chest = mm(F[CHEST].W, tr(bones[CHEST].R));
    for (const i of ARM) {
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
        if (dot(r, r) > reach * reach && q >= 0) drop = Math.max(drop, -r[1] - Math.sqrt(q));
      }
      const move: V = [pose.move[0], pose.move[1] - drop, pose.move[2]];
      pose = { q: pose.q, move };
      F = fk(L, move);
      for (let s = 0; s < 2; s++) {
        const { thigh, calf, foot } = LEG[s], target = o.plant.at[s];
        const H = F[thigh].P, K = F[calf].P, A0 = F[foot].P;
        const hingeW = mm(F[thigh].W, REL[calf]), a = col(hingeW, 0);
        const u = sub(K, H), v = sub(A0, K), vpar = dot(a, v), vperp = sub(v, [a[0] * vpar, a[1] * vpar, a[2] * vpar]), w = cross(a, v);
        const D = Math.hypot(...sub(target, H));
        const c = (D * D - dot(u, u) - dot(v, v)) / 2 - dot(u, a) * vpar, A1 = dot(u, vperp), B1 = dot(u, w), M = Math.hypot(A1, B1);
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
      }
    }
    return { local: L, move: pose.move };
  }

  return { body, bones, at, height, local, world, fk, finish, plantOf };
}
