/**
 * The low-poly male and female bodies (`tools/sculpt/lowarm.mjs` buildArmBody) on their own rigs
 * (`tools/sculpt/lowrig.mjs`), as `lowrig.mjs` writes them to `assets/lowmale.json` and `assets/lowfemale.json`: drawn
 * flat (each polygon its own corners and its own normal) by the GPU skinning path (`./gl`), posed from the figure's rig
 * each frame. The figure's bones (`bonesOf`, with the body's own proportions) are taken onto ours as `fromGame` in
 * `lowrig.mjs` takes them (each control bone turned as its figure bone has turned from the fitted rest, our own joints
 * kept; the arms kept off the body, hers turned further out as they swing, the ankles and toes as hinges on the body's
 * own axes, the thumbs closed toward the palm), the helpers driven from those, and the body stood on its lowest sole.
 * Shaded as the review renders shade it: one colour a polygon, from its normal in view space, by the light fitted for
 * that body (`tools/sculpt/lowlight-<who>.json`, written by `tools/sculpt/lowlight.py`), in the look's skin. A hairstyle
 * made for the low-poly bodies (`tools/sculpt/lowhair.mjs`, `./assets/lowhair.json`: so far 'swept') is drawn with the
 * body, on the head bone, in three tones of the look's hair colour (its valleys a fourth, darker), the body's scalp
 * under it shaved; any other style draws no hair yet.
 */
import MALE_ASSET from './assets/lowmale.json';
import FEMALE_ASSET from './assets/lowfemale.json';
import HAIR_ASSET from './assets/lowhair.json';
import MALE_LIGHT from '../../tools/sculpt/lowlight-male.json';
import FEMALE_LIGHT from '../../tools/sculpt/lowlight-female.json';
import { sculptRig, viewOf, type FigurePose, type Rig } from '../render/figure';
import { DEFAULT_LOOK } from '../game/look';
import { STRIDE, type Baked } from './bake';
import { M, bodyMaterials } from './models/body';
import { bonesOf, FEMALE, heightOf, MALE, REST_EXTRAS, relaxedIdle, type Bones, type Proportions } from './rig';
import { humanProportions } from './human';
import { SH_TERMS, type LowLight, type SculptDraw } from './gl';
import type { Material } from './sdf';

type M3 = number[];
type V = [number, number, number];
type Q = [number, number, number, number];
interface Bone { name: string; p: number; kind: 'control' | 'helper'; head: V; R: M3; from?: number; drive?: 'half' | 'twist' | 'wrist' | 'untwist'; f?: number; game?: string }
interface Asset {
  floor: number; T: M3; verts: number[]; polys: Array<[number[], number, number[]?]>; tris: number[]; weights: number[][]; soles: number[];
  bones: Bone[]; rest: Pick<Rig, 'arm' | 'elbow' | 'hand' | 'leg' | 'knee'>;
  game: { armIn: number; thumbCurl: number; armSwing?: [number, number]; armSwingAt?: number };
}

/** A hairstyle on one body (`tools/sculpt/lowhair.mjs` gameHair): its vertices, polygons and triangles (corners, polygon),
 * each polygon's material (4 the hair, 5 the hair in a valley, 3 the buzzed sides' patches), each vertex's (bone, weight) pairs, and the body's
 * polygons drawn shaved. */
interface HairAsset { verts: number[]; polys: number[][]; mat: number[]; tris: number[]; weights: number[][]; shave: number[] }
const HAIRS = HAIR_ASSET as unknown as Record<'male' | 'female', Record<string, HairAsset>>;

/* ---- 3x3 rotations (row-major) and quaternions [w, x, y, z], as lowrig.mjs ------------------------------------- */
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mm = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const mv = (m: M3, v: V): V => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const tr = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const col = (m: M3, k: number): V => [m[k], m[3 + k], m[6 + k]];
function axisAngle(a: V, deg: number): M3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1, [x, y, z] = [a[0] / l, a[1] / l, a[2] / l];
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
/** A local pose from [rx, ry, rz] degrees: Rz · Rx · Ry. */
const euler = (rx: number, ry = 0, rz = 0): M3 => mm(axisAngle([0, 0, 1], rz), mm(axisAngle([1, 0, 0], rx), axisAngle([0, 1, 0], ry)));
function quat(m: M3): Q {
  const t = m[0] + m[4] + m[8];
  let q: Q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [0.25 * s, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [(m[7] - m[5]) / s, 0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[2] - m[6]) / s, (m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s]; }
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
const qmat = ([w, x, y, z]: Q): M3 => [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
const qmul = (a: Q, b: Q): Q => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qinv = (q: Q): Q => [q[0], -q[1], -q[2], -q[3]];
function qpow(q: Q, t: number): Q {
  if (q[0] < 0) q = [-q[0], -q[1], -q[2], -q[3]];
  const a = Math.acos(Math.min(1, q[0])), s = Math.sin(a);
  if (s < 1e-9) return [1, 0, 0, 0];
  const k = Math.sin(a * t) / s;
  return [Math.cos(a * t), q[1] * k, q[2] * k, q[3] * k];
}
/** The twist about the bone's own axis (local y), and the swing left: q = swing · twist. */
function swingTwist(q: Q): { swing: Q; twist: Q } {
  let t: Q = [q[0], 0, q[2], 0];
  const l = Math.hypot(t[0], t[2]);
  t = l < 1e-9 ? [1, 0, 0, 0] : [t[0] / l, 0, t[2] / l, 0];
  return { swing: qmul(q, qinv(t)), twist: t };
}
const angleOf = (q: Q): number => (2 * Math.acos(Math.min(1, Math.abs(q[0]))) * 180) / Math.PI;

/** The low-poly woman's height, sole to crown, as a share of the low-poly man's. */
export const WOMAN_OF_MAN = 0.85;

/** One body: its asset, the figure's proportions it is posed with, and its height as a share of the base man's. */
function lowBody(A: Asset, P: Proportions, share: number, hairs: Record<string, HairAsset>): { baked: (style: string) => Baked; bones: (pose: FigurePose) => Float32Array } {
  const BONES = A.bones;
  const AT = new Map(BONES.map((b, i) => [b.name, i]));

  /* ---- the rig's rest, done once ----------------------------------------------------------------------------------- */
  const REL = BONES.map((b) => (b.p >= 0 ? mm(tr(BONES[b.p].R), b.R) : b.R));
  const OFF = BONES.map((b) => (b.p >= 0 ? mv(tr(BONES[b.p].R), sub(b.head, BONES[b.p].head)) : b.head));
  const T = A.T;

  interface Frame { W: M3; P: V }
  /** Each bone's world rotation and head for a local pose (bone index -> 3x3), the helpers driven, as lowrig.mjs posed(). */
  function posed(local: Array<M3 | undefined>): Frame[] {
    const out: Frame[] = [];
    BONES.forEach((b, i) => {
      let L = local[i] ?? I3;
      if (b.kind === 'helper' && b.from !== undefined && local[b.from]) {
        const q = quat(local[b.from] as M3), f = b.f ?? 0.5;
        if (b.drive === 'half') L = qmat(qpow(q, f));
        else if (b.drive === 'untwist') L = qmat(qpow(swingTwist(q).twist, -f));
        else if (b.drive === 'wrist') { const { swing, twist } = swingTwist(q); L = qmat(qmul(qpow(swing, f), twist)); }
        else if (b.drive === 'twist') { const tw = qmat(qpow(swingTwist(q).twist, f)), Rr = mm(tr(b.R), BONES[b.from].R); L = mm(Rr, mm(tw, tr(Rr))); }
      }
      if (b.p < 0) { out.push({ W: mm(b.R, L), P: b.head }); return; }
      const pa = out[b.p];
      out.push({ W: mm(pa.W, mm(REL[i], L)), P: add(pa.P, mv(pa.W, OFF[i])) });
    });
    return out;
  }

  /** Our local pose from the figure's bones posed and at the fitted rest, as lowrig.mjs fromGame(). */
  function fromGame(gPosed: Bones, gRest: Bones): Array<M3 | undefined> {
    const D = (g: string): M3 => mm(tr(T), mm(mm(gPosed[g].m, tr(gRest[g].m)), T));
    const half = (a: M3, b: M3): M3 => mm(a, qmat(qpow(quat(mm(tr(a), b)), 0.5)));
    const Wd: Array<M3 | undefined> = [];
    BONES.forEach((b, i) => {
      if (b.kind !== 'control' || !b.game) return;
      let d: M3;
      if (b.game === 'neck+head/2') d = half(D('neck'), D('head'));
      else if (b.game.endsWith('/2')) { const g = b.game.slice(0, -2); d = half(D(g.replace('fing', 'wrist')), D(g)); }
      else d = D(b.game);
      Wd[i] = mm(d, b.R);
    });
    // the arms kept off the body: turned out, with all below, until they lean in no further than at rest, seen from the chest
    const chest = D('chest');
    const below = (i: number): number[] => { const o = [i]; for (let k = 0; k < o.length; k++) BONES.forEach((c, j) => { if (c.p === o[k] && c.kind === 'control') o.push(j); }); return o; };
    for (const s of ['l', 'r']) for (const seg of ['upperarm', 'lowerarm']) {
      const i = AT.get(`${seg}_${s}`) as number, b = BONES[i], w = Wd[i];
      if (!w) continue;
      const r0 = col(b.R, 1), side = Math.sign(r0[0]), v = mv(tr(chest), col(w, 1));
      // (hers further out as it swings forward or back, as lowrig.mjs swingOut)
      const sw = A.game.armSwing ? A.game.armSwing[v[2] > 0 ? 0 : 1] * Math.min(1, Math.abs(v[2]) / (A.game.armSwingAt ?? 0.5)) : 0;
      const xmin = Math.min(0.95, Math.abs(r0[0]) * A.game.armIn + sw);
      if (side * v[0] >= xmin) continue;
      const k = Math.sqrt((1 - xmin * xmin) / Math.max(1e-9, v[1] * v[1] + v[2] * v[2]));
      const ax = cross(v, [side * xmin, v[1] * k, v[2] * k]), ang = (Math.asin(Math.min(1, Math.hypot(ax[0], ax[1], ax[2]))) * 180) / Math.PI;
      if (ang < 1e-6) continue;
      const C = mm(chest, mm(axisAngle(ax, ang), tr(chest)));
      for (const j of below(i)) if (Wd[j]) Wd[j] = mm(C, Wd[j] as M3);
    }
    // locals, parents first
    const W: M3[] = [], pose: Array<M3 | undefined> = [];
    BONES.forEach((b, i) => {
      if (b.kind !== 'control') return;
      const base = b.p >= 0 && W[b.p] ? mm(W[b.p], REL[i]) : b.R;
      const want = Wd[i] ?? base;
      pose[i] = mm(tr(base), want);
      W[i] = want;
    });
    // the ankles and the balls of the feet as hinges about their own bend axes; the balls only bend up
    for (const [s, k] of [['l', 0], ['r', 1]] as const) {
      for (const [bone, g, up] of [[`foot_${s}`, `ankle${k}`, `knee${k}`], [`ball_${s}`, `toe${k}`, `ankle${k}`]]) {
        if (!gPosed[g] || !gPosed[up]) continue;
        const i = AT.get(bone) as number, b = BONES[i];
        const q = quat(mm(D(g), tr(D(up)))), a = angleOf(q), sg = Math.sign(q[0] || 1);
        const pw = Wd[b.p];
        const X = mv(pw ? mm(pw, tr(BONES[b.p].R)) : I3, col(b.R, 0));
        pose[i] = euler((bone.startsWith('ball') ? 1 : Math.sign(dot([q[1] * sg, q[2] * sg, q[3] * sg], X))) * a);
      }
    }
    // the thumbs: closed toward the palm by the figure thumb's angle from its hand
    for (const [s, k] of [['l', 0], ['r', 1]] as const) {
      if (!gPosed[`thumb${k}`]) continue;
      const a = angleOf(quat(mm(tr(D(`wrist${k}`)), D(`thumb${k}`))));
      pose[AT.get(`thumb_01_${s}`) as number] = euler(a);
      pose[AT.get(`thumb_02_${s}`) as number] = euler(a * A.game.thumbCurl);
      pose[AT.get(`thumb_03_${s}`) as number] = euler(a * A.game.thumbCurl);
    }
    return pose;
  }

  /* ---- the body as the GPU draws it ----------------------------------------------------------------------------------- */
  const FLOOR: V = [0, A.floor, 0];
  /** Mesh units to the figure's: the body's height, sole to crown, `share` of the base man's. */
  let SCALE = 0;
  function scale(): number {
    if (!SCALE) {
      let top = -Infinity;
      for (let i = 1; i < A.verts.length; i += 3) top = Math.max(top, A.verts[i]);
      SCALE = (heightOf(humanProportions(0)) * share) / (top - A.floor);
    }
    return SCALE;
  }
  /** A mesh point in the figure's frame: x the body's right, y forward, z up, the floor at z 0. */
  const toGame = (p: V): V => { const s = scale(), q = mv(T, sub(p, FLOOR)); return [q[0] * s, q[1] * s, q[2] * s]; };
  const vert = (i: number): V => [A.verts[i * 3], A.verts[i * 3 + 1], A.verts[i * 3 + 2]];

  const BAKED = new Map<string, Baked>();
  /**
   * The body laid out for the GPU, with the hairstyle's hair if it has one: every polygon its own corners, each with the
   * polygon's normal, so it is drawn flat. The hair's vertices follow the body's; its polygons take the hair's material
   * (`M.hairCut`, three tones; in a valley `M.hairValley`, a step darker), the body's shaved polygons the scalp's (`M.hairUnder`).
   */
  function lowBaked(style: string): Baked {
    const hair = hairs[style], key = hair ? style : '';
    const done = BAKED.get(key);
    if (done) return done;
    const t0 = performance.now();
    const nBody = A.verts.length / 3, nPolys = A.polys.length;
    const shaved = new Set(hair ? hair.shave : []);
    // the body and the hair as one list of vertices, polygons ([corners, material, outline]), weights and triangles
    const allVerts = hair ? A.verts.concat(hair.verts) : A.verts;
    const allPolys: Array<[number[], number, number[]?]> = A.polys.map(([v, m, nv], pi) => [v, shaved.has(pi) ? 3 : m, nv]);
    if (hair) hair.polys.forEach((v, j) => allPolys.push([v.map((i) => i + nBody), hair.mat[j]]));
    const allWeights = hair ? A.weights.concat(hair.weights) : A.weights;
    const allTris = hair ? A.tris.concat(hair.tris.map((x, k) => (k % 4 === 3 ? x + nPolys : x + nBody))) : A.tris;
    const at = (i: number): V => [allVerts[i * 3], allVerts[i * 3 + 1], allVerts[i * 3 + 2]];
    const MATS = [M.skin, M.hair, M.pupil, M.hairUnder, M.hairCut, M.hairValley];
    const corner = new Map<string, number>();
    const verts: number[] = [], tris: number[] = [], faceSkin: number[] = [];
    // Each polygon's weights, its corners' summed, the heaviest four kept: one turn for the face's normal at every corner.
    const faceWeights = allPolys.map(([v]) => {
      const sum = new Map<number, number>();
      for (const i of v) { const w = allWeights[i]; for (let j = 0; j < w.length; j += 2) sum.set(w[j], (sum.get(w[j]) ?? 0) + w[j + 1]); }
      const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((t, [, w]) => t + w, 0) || 1;
      const out = [0, 0, 0, 0, 0, 0, 0, 0];
      top.forEach(([b, w], j) => { out[j] = b; out[4 + j] = w / tot; });
      return out;
    });
    const normals = allPolys.map(([v, , nv]) => {
      const pts = (nv ?? v).map((i) => toGame(at(i)));
      let n: V = [0, 0, 0];
      for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      return [n[0] / l, n[1] / l, n[2] / l] as V;
    });
    const idx = (i: number, pi: number): number => {
      const key = `${pi}:${i}`;
      let k = corner.get(key);
      if (k !== undefined) return k;
      k = verts.length / STRIDE;
      corner.set(key, k);
      const p = toGame(at(i)), n = normals[pi], mat = MATS[allPolys[pi][1]] ?? M.skin, w = allWeights[i];
      const bi = [0, 0, 0, 0], bw = [0, 0, 0, 0];
      for (let j = 0; j < 4 && j * 2 < w.length; j++) { bi[j] = w[j * 2]; bw[j] = w[j * 2 + 1]; }
      verts.push(p[0], p[1], p[2], n[0], n[1], n[2], mat, ...bi, ...bw, mat, -1);
      faceSkin.push(...faceWeights[pi]);
      return k;
    };
    for (let t = 0; t < allTris.length; t += 4) { const pi = allTris[t + 3]; tris.push(idx(allTris[t], pi), idx(allTris[t + 1], pi), idx(allTris[t + 2], pi)); }
    const baked: Baked = { band: 1, verts: Float32Array.from(verts), tris: Uint32Array.from(tris), nVerts: verts.length / STRIDE, nTris: tris.length / 3, bones: BONES.map((b) => b.name), ms: performance.now() - t0, grid: [0, 0, 0], cell: 0, faceSkin: Float32Array.from(faceSkin) };
    BAKED.set(key, baked);
    return baked;
  }

  let G_REST: Bones | null = null;
  /** The figure's bones at the rest fitted to the body's (lowrig.mjs fitRest), for the turns the figure's bones make from it. */
  function gameRest(): Bones {
    if (!G_REST) {
      const r = { ...sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look: DEFAULT_LOOK }).rest, ...structuredClone(A.rest) } as Rig;
      G_REST = bonesOf(r, P, [], REST_EXTRAS);
    }
    return G_REST;
  }

  /** The figure's rig for a pose: stood doing nothing, the sculpt's own idle (as `sculptScene`); otherwise the figure's. */
  function rigFor(pose: FigurePose): Rig {
    const figure = sculptRig(pose).rig;
    const idle = !pose.moving && !pose.working && !pose.swimming && !pose.driving && !pose.emote && !pose.cast;
    return idle ? relaxedIdle(figure, pose.phase / 6, pose.facing) : figure;
  }

  /** The skinning matrices for a pose (3x4 rows per bone, the figure's frame), the body stood on its lowest sole. */
  function lowBones(pose: FigurePose): Float32Array {
    const local = fromGame(bonesOf(rigFor(pose), P, [], REST_EXTRAS), gameRest());
    const F = posed(local);
    // each bone's skinning turn and shift in the mesh's frame: v -> S v + t
    const S = F.map((f, i) => mm(f.W, tr(BONES[i].R)));
    const t = F.map((f, i) => sub(f.P, mv(S[i], BONES[i].head)));
    // stood on the lowest sole: the sole's vertices skinned
    let low = Infinity;
    for (const vi of A.soles) {
      const v = vert(vi), w = A.weights[vi];
      let y = 0;
      for (let j = 0; j < w.length; j += 2) { const b = w[j]; y += w[j + 1] * (dot([S[b][3], S[b][4], S[b][5]], v) + t[b][1]); }
      low = Math.min(low, y);
    }
    const dy = A.floor - low, s = scale();
    const out = new Float32Array(BONES.length * 12);
    BONES.forEach((_, i) => {
      const Ag = mm(T, mm(S[i], T));
      const sh = mv(T, add(sub(add(mv(S[i], FLOOR), t[i]), FLOOR), [0, dy, 0]));
      out.set([Ag[0], Ag[1], Ag[2], sh[0] * s, Ag[3], Ag[4], Ag[5], sh[1] * s, Ag[6], Ag[7], Ag[8], sh[2] * s], i * 12);
    });
    return out;
  }

  return { baked: lowBaked, bones: lowBones };
}

const BODIES = { man: lowBody(MALE_ASSET as unknown as Asset, MALE, 1, HAIRS.male), woman: lowBody(FEMALE_ASSET as unknown as Asset, FEMALE, WOMAN_OF_MAN, HAIRS.female) };

/** A fitted light's coefficients ([channel][term], nought to 255) as the shader takes them: per term, red, green and blue nought to one. */
function shOf(fit: { global: number[][] }): Float32Array {
  const out = new Float32Array(SH_TERMS * 3);
  for (let k = 0; k < SH_TERMS; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = fit.global[c][k] / 255;
  return out;
}
const SH = { man: shOf(MALE_LIGHT), woman: shOf(FEMALE_LIGHT) };
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
/** The look's skin over the default look's, which the light was fitted to the review renders' skin for, per channel. */
let FITTED: [number, number, number] | null = null;
function toneOf(materials: Material[]): [number, number, number] {
  const a = hexRgb(materials[M.skin].colour), b = (FITTED ??= hexRgb(bodyMaterials(DEFAULT_LOOK)[M.skin].colour));
  return [a[0] / b[0], a[1] / b[1], a[2] / b[2]];
}

/** Whether a look is drawn as a low-poly body: a man or a woman (neither keeps the sculpted base). */
export const hasLowBody = (look: { gender: string }): boolean => look.gender === 'man' || look.gender === 'woman';

/** Everything a draw needs for a pose (`drawSculptGL`): the man's body for a man, the woman's for a woman. */
export function lowScene(pose: FigurePose): SculptDraw {
  const look = pose.look ?? DEFAULT_LOOK;
  const facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  const who = look.gender === 'woman' ? 'woman' : 'man', body = BODIES[who];
  const materials = [...bodyMaterials(look)], low: LowLight = { sh: SH[who], tone: toneOf(materials) };
  // the hairstyle's hair (none drawn for a style not made yet) in three tones of the look's hair colour (a fourth,
  // darker, in its valleys), its shave the skin toward that colour
  const hair = materials[M.hair].colour;
  materials[M.hairCut] = { colour: hair, ramp: true, noCrease: true };
  materials[M.hairValley] = { colour: hair, ramp: true, valley: true, noCrease: true };
  materials[M.hairUnder] = { colour: hair, shave: true };
  return { baked: body.baked(look.hair), bones: body.bones(pose), materials, view: viewOf(facing), blink: 0, low };
}
