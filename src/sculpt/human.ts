/**
 * The human base: MakeHuman's body (CC0, see NOTICE.md) as `tools/sculpt/base.mjs`
 * wrote it to `assets/human.json`, a man and a woman on one topology at three
 * bands, with the rig's weights already on our bones. Here it is carried from
 * MakeHuman's rest (an A-pose, legs apart) onto our rig's rest by each bone's
 * frame, blended between the man and the woman by how far toward a woman's
 * frame the look goes, and laid out as a bake the GPU draws (`./gl`).
 */
import type { Look } from '../game/look';
import ASSET from './assets/human.json';
import { STRIDE, type Baked } from './bake';
import { M } from './models/body';
import { at, lerpProportions, type Bones, type Proportions } from './rig';
import type { Band, V3 } from './sdf';
import type { Wear } from './index';

interface AssetBand { band: number; verts: number; tris: number[]; man: number[]; woman: number[]; region: number[]; bw: number[]; stamp: number[] }
interface Asset { height: number; bones: string[]; frames: Record<'man' | 'woman', Record<string, number[]>>; proportions: Record<'man' | 'woman', Proportions>; bands: AssetBand[] }
const A = ASSET as unknown as Asset;
/** The base's height, sole to crown, in units. */
export const HUMAN_HEIGHT = A.height;

/** Nought a man, one a woman, half for neither. */
export const femOf = (look: Look): number => (look.gender === 'woman' ? 1 : look.gender === 'man' ? 0 : 0.5);

const PROPS = new Map<number, Proportions>();
/** The base's proportions, measured from its skeleton, `fem` of the way from the man's to the woman's. */
export function humanProportions(fem: number): Proportions {
  let p = PROPS.get(fem);
  if (!p) { p = lerpProportions({ ...A.proportions.man, id: 'man', fem: 0 }, { ...A.proportions.woman, id: 'woman', fem: 1 }, fem, fem === 0 ? 'man' : fem === 1 ? 'woman' : `fem${fem}`); PROPS.set(fem, p); }
  return p;
}

/** Where each of our bones points at rest, from the joint to the next, or along its own frame where there is no next. */
const CHILD: Record<string, string | V3> = {
  pelvis: 'spineA', spineA: 'spineB', spineB: 'chest', chest: 'neck', neck: 'head', head: [0, 0, 1], jaw: [0, 0.7, -0.7],
};
for (const k of [0, 1]) Object.assign(CHILD, {
  [`eye${k}`]: [0, 1, 0], [`clav${k}`]: `arm${k}`, [`arm${k}`]: `elbow${k}`, [`elbow${k}`]: `wrist${k}`, [`wrist${k}`]: `fing${k}`, [`fing${k}`]: [0, 0, -1], [`index${k}`]: [0, 0, -1],
  [`thumb${k}`]: [0, 0, -1], [`hip${k}`]: `knee${k}`, [`knee${k}`]: `ankle${k}`, [`ankle${k}`]: `toe${k}`, [`toe${k}`]: [0, 1, 0],
});
const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The rotation taking unit `a` onto unit `b` by the shortest turn, as a row-major 3x3. */
function turn(a: V3, b: V3): number[] {
  const v = cross(a, b), c = dot(a, b), s = Math.hypot(v[0], v[1], v[2]);
  if (s < 1e-9) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  const [x, y, z] = [v[0] / s, v[1] / s, v[2] / s], t = 1 - c;
  return [c + x * x * t, x * y * t - z * s, x * z * t + y * s, y * x * t + z * s, c + y * y * t, y * z * t - x * s, z * x * t - y * s, z * y * t + x * s, c + z * z * t];
}

/**
 * What the clothed and the bare looks put on each part: a base material and one stamp with its signed distance, the stamp
 * winning where the distance is positive. Clothed, the body is skin with the shoe stamped under the ankle, and the clothes
 * are cloth lofted over it (`./cloth`). Bare, everything is skin with the shorts (and the woman's top, the same cloth)
 * stamped on.
 */
function dress(wear: Wear, fem: number, P: Proportions, rest: Bones): (region: number, bone: string, p: V3, irisD: number) => [number, number, number] {
  const armZ = at(rest, 'arm0')[2], hipZ = at(rest, 'hip0')[2], pelvisZ = at(rest, 'pelvis')[2], spA = at(rest, 'spineA')[2], neckZ = at(rest, 'neck')[2], ankleZ = at(rest, 'ankle0')[2];
  const shortsTop = pelvisZ + 0.3, shortsHem = hipZ - P.thigh * 0.46;
  const braLow = armZ - 2.3, braTop = armZ - 0.6;
  void spA; void neckZ;
  const arm = (bone: string): boolean => /^(clav|arm|elbow|wrist|fing|index|thumb)/.test(bone);
  const leg = (bone: string): boolean => /^(hip|knee|ankle|toe)/.test(bone);
  return (region, bone, p, irisD) => {
    // The face, the hands and the hair drawn over the base: an eye's dark rectangle, a brow, hair, the groove between two fingers.
    if (region === 6) return [M.pupil, M.pupil, -1];
    if (region === 7) return [M.lid, M.lid, -1];
    if (region === 8) return [M.brow, M.brow, -1];
    if (region === 9) return [M.hair, M.hairLight, irisD];
    if (region === 12) return [M.hair, M.hairGlint, irisD];
    if (region === 13) return [M.crease, M.crease, -1];
    if (region === 1) return [M.face, M.face, -1];
    if (region === 2) return [M.hand, M.hand, -1];
    if (region === 14) return [M.ear, M.ear, -1];
    if (region === 15) return [M.faceUnder, M.faceUnder, -1];
    if (wear === 'shorts') {
      let d = region === 1 || region === 2 || region === 3 || arm(bone) ? -1 : Math.min(p[2] - shortsHem, shortsTop - p[2]);
      if (fem >= 0.5 && !arm(bone) && region === 0 && p[2] > shortsTop + 0.5) {
        // The woman's top: a band at the back, cups rising from a V at the sternum toward the straps.
        const front = p[1] > 0.2, x = Math.min(1, Math.abs(p[0]) / 1.1);
        const top = front ? braLow + (braTop - braLow) * (0.75 + 0.5 * x) : braTop;
        d = Math.max(d, Math.min(p[2] - braLow, top - p[2]));
      }
      return [M.skin, M.shorts, d];
    }
    if (region === 3 || leg(bone)) return [M.skin, M.shoe, ankleZ + 0.1 - p[2]];
    return [M.skin, M.skin, -1];
  };
}

/** The base at a band, carried onto `rest` (our rig at the asset's proportions), in the look's wear, as a bake. */
export function humanBaked(fem: number, band: Band, rest: Bones, order: string[], wear: Wear, bald = false): Baked {
  const t0 = performance.now();
  const ab = A.bands[band];
  const P = humanProportions(fem);
  const n = ab.verts;
  // Each bone's carry: our joint, and the turn from MakeHuman's bone onto ours.
  const carry = A.bones.map((name) => {
    const fm = A.frames.man[name], fw = A.frames.woman[name];
    const f = fm.map((x, i) => x + (fw[i] - x) * fem);
    const mhHead: V3 = [f[0], f[1], f[2]], mhAxis = unit([f[3] - f[0], f[4] - f[1], f[5] - f[2]]);
    const c = CHILD[name];
    const joint = at(rest, name);
    let ourAxis: V3;
    if (typeof c === 'string') ourAxis = unit([at(rest, c)[0] - joint[0], at(rest, c)[1] - joint[1], at(rest, c)[2] - joint[2]]);
    else { const m = rest[name].m; ourAxis = unit([m[0] * c[0] + m[1] * c[1] + m[2] * c[2], m[3] * c[0] + m[4] * c[1] + m[5] * c[2], m[6] * c[0] + m[7] * c[1] + m[8] * c[2]]); }
    return { joint, mhHead, R: turn(mhAxis, ourAxis), slot: order.indexOf(name) };
  });
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v: V3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) v[k] = (ab.man[i * 3 + k] + (ab.woman[i * 3 + k] - ab.man[i * 3 + k]) * fem) / 500;
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 4; j++) {
      const w = ab.bw[i * 8 + j * 2 + 1] / 255; if (!w) continue;
      const c = carry[ab.bw[i * 8 + j * 2]];
      const d: V3 = [v[0] - c.mhHead[0], v[1] - c.mhHead[1], v[2] - c.mhHead[2]], R = c.R;
      x += w * (c.joint[0] + R[0] * d[0] + R[1] * d[1] + R[2] * d[2]);
      y += w * (c.joint[1] + R[3] * d[0] + R[4] * d[1] + R[5] * d[2]);
      z += w * (c.joint[2] + R[6] * d[0] + R[7] * d[1] + R[8] * d[2]);
    }
    // Bald (the look's hairstyle, or bare for the reference sheets: the pictures are, and the hair would count against the
    // overlap) folds the hair's shell and clumps into the head's joint, where they draw nothing.
    if ((bald || wear === 'shorts') && (ab.region[i] === 9 || ab.region[i] === 12)) { const h = at(rest, 'head'); x = h[0]; y = h[1]; z = h[2]; }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
  }
  // Smooth normals from the carried mesh. The head and the hands share no vertices between facets, so they stay flat.
  const nrm = new Float32Array(n * 3);
  const tris = Uint32Array.from(ab.tris);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const e1: V3 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2: V3 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const fn = cross(e1, e2);
    for (const i of [a, b, c]) { nrm[i] += fn[0]; nrm[i + 1] += fn[1]; nrm[i + 2] += fn[2]; }
  }
  // Smoothed twice over the neighbours, so the cel shading's shapes fall on the body's forms, not on the decimation's facets.
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < tris.length; t += 3) { const a = tris[t], b = tris[t + 1], c = tris[t + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
  for (let pass = 0; pass < 2; pass++) {
    const sm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x = nrm[i * 3] * 2, y = nrm[i * 3 + 1] * 2, z = nrm[i * 3 + 2] * 2;
      for (const j of nb[i]) { x += nrm[j * 3]; y += nrm[j * 3 + 1]; z += nrm[j * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1; sm[i * 3] = x / l; sm[i * 3 + 1] = y / l; sm[i * 3 + 2] = z / l;
    }
    nrm.set(sm);
  }
  const stampOf = new Map<number, number>();
  for (let i = 0; i < ab.stamp.length; i += 2) stampOf.set(ab.stamp[i], ab.stamp[i + 1] / 1000);
  const put = dress(wear, fem, P, rest);
  const verts = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const p: V3 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const nn = unit([nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]]);
    const [mat, stampMat, stampDist] = put(ab.region[i], A.bones[ab.bw[i * 8]], p, stampOf.get(i) ?? -1);
    verts.set([p[0], p[1], p[2], nn[0], nn[1], nn[2], mat], o);
    for (let j = 0; j < 4; j++) { verts[o + 7 + j] = carry[ab.bw[i * 8 + j * 2]].slot; verts[o + 11 + j] = ab.bw[i * 8 + j * 2 + 1] / 255; }
    verts[o + 15] = stampMat; verts[o + 16] = stampDist;
  }
  return { band, verts, tris, nVerts: n, nTris: tris.length / 3, bones: order, ms: performance.now() - t0, grid: [0, 0, 0], cell: 0 };
}
