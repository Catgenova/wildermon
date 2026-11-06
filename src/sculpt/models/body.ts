/**
 * The base body: a person in a plain fitted undershirt, plain trousers and
 * soft shoes, sculpted against the rest skeleton at any proportions. A head
 * with a face (eyes that blink under a lid line, a brow ridge and brows, a
 * nose with a bridge, cheek planes, a mouth with two lips, ears), hair as
 * locks over a slight volume, a neck, a torso with a chest and a back, arms
 * with elbows and hands that have a palm, a thumb and fingers, legs with
 * knees and calves, feet with toes that bend. Garments go over it as layers
 * of their own, later.
 *
 * Everything is placed off the rest skeleton (`rest`), so a joint is where
 * the rig's joint is and the skinning follows; what belongs to a hand or a
 * foot is placed in that bone's own frame, so it bends with it.
 */
import { eyeColour, hairColour, skinColour, type Look } from '../../game/look';
import { place } from '../../render/figure';
import { at, along, type Bones, type Proportions } from '../rig';
import {
  BAND_CLOSE, BAND_GAME, band, capsule, clip, curveStamp, disc, ellipsoid, modelOf, roundBox, sphere, stamped, sub, unit, add, mul, tube,
  type Material, type Model, type Prim, type Stamp, type V3,
} from '../sdf';

/** The materials, by index. */
export const M = { skin: 0, hair: 1, white: 2, iris: 3, pupil: 4, glint: 5, brow: 6, lip: 7, shirt: 8, trousers: 9, shoe: 10, sole: 11, mouth: 12, teeth: 13, trim: 14 } as const;

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: [number, number, number]): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mixHex = (a: string, b: string, t: number): string => { const A = hex(a), B = hex(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); };

export function bodyMaterials(look: Look): Material[] {
  const skin = skinColour(look), hair = hairColour(look), eye = eyeColour(look);
  const out: Material[] = [];
  out[M.skin] = { colour: skin, skin: true };
  out[M.hair] = { colour: hair };
  out[M.white] = { colour: mixHex(skin, '#f8f4ec', 0.7) };
  out[M.iris] = { colour: mixHex(eye, '#2a1a18', 0.2) };
  out[M.pupil] = { colour: mixHex(eye, '#1a1016', 0.7) };
  out[M.glint] = { colour: '#fffaf0' };
  out[M.brow] = { colour: mixHex(hair, '#16100e', 0.3) };
  out[M.lip] = { colour: mixHex(skin, '#a4484a', 0.42) };
  // The undershirt a pastel cream, the trousers a dusty slate-teal, the shoes caramel: the kit's pastel base, no splash yet.
  out[M.shirt] = { colour: '#ecdcb8' };
  out[M.trousers] = { colour: '#6f8390' };
  out[M.shoe] = { colour: '#a8794f' };
  out[M.sole] = { colour: '#6e4e3a' };
  out[M.mouth] = { colour: '#5a2a3c' };
  out[M.teeth] = { colour: '#fbf6ea' };
  out[M.trim] = { colour: '#d4c3a0' };
  return out;
}

export function bodyModel(P: Proportions, rest: Bones, look: Look): Model {
  const prims: Prim[] = [];
  const H = P.head;
  const headJ = at(rest, 'head');
  const hz = (f: number): number => headJ[2] + H * f;
  const hy = (f: number): number => headJ[1] + P.headD * f;
  /** A point in a bone's rest frame. */
  const inBone = (bone: string, o: V3): V3 => place(rest[bone], o);
  const axesOf = (bone: string): [V3, V3, V3] => { const m = rest[bone].m; return [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]]; };

  /* ---- head ------------------------------------------------------------------------- */
  // Cranium and face: two eggs, the lower narrower, blended into one head; the chin on the jaw so the mouth can open.
  prims.push(ellipsoid([0, hy(-0.05), hz(0.6)], [P.headW, P.headD * 0.98, H * 0.44], { m: M.skin, bone: 'head', name: 'cranium' }));
  const face = ellipsoid([0, hy(0.12), hz(0.34)], [P.headW * 0.86, P.headD * 0.82, H * 0.36], { m: M.skin, bone: 'head', blend: 0.45, name: 'face' });
  // The mouth: the line between the lips, stamped on the face so it reads as one dark line at any zoom.
  const mz = hz(0.27), my = hy(0.9);
  const mouthPts: V3[] = [-1, -0.5, 0, 0.5, 1].map((u) => [u * H * 0.17, my - Math.abs(u) * 0.14, mz + u * u * H * 0.04] as V3);
  prims.push(stamped(face, { at: curveStamp(mouthPts, H * 0.02, M.mouth, [0, 1, 0]), band: BAND_GAME }));
  prims.push(ellipsoid([0, hy(0.22), hz(0.1)], [P.headW * 0.5, P.headD * 0.5, H * 0.14], { m: M.skin, bone: 'jaw', blend: 0.3, name: 'chin' }));
  // Cheek planes, so the shadow shape has a plane to sit on.
  for (const s of [-1, 1]) prims.push(ellipsoid([s * P.headW * 0.58, hy(0.5), hz(0.42)], [H * 0.17, H * 0.17, H * 0.15], { m: M.skin, bone: 'head', blend: 0.35, band: BAND_GAME, name: 'cheek' }));
  // The brow ridge across the eyes, and the nose: a bridge from between the brows to a round tip with nostrils.
  prims.push(capsule([-P.headW * 0.55, hy(0.7), hz(0.68)], [P.headW * 0.55, hy(0.7), hz(0.68)], H * 0.09, H * 0.09, { m: M.skin, bone: 'head', blend: 0.3, band: BAND_GAME, name: 'brow ridge' }));
  prims.push(capsule([0, hy(0.86), hz(0.6)], [0, hy(1.03), hz(0.42)], H * 0.04, H * 0.07, { m: M.skin, bone: 'head', blend: 0.12, band: BAND_GAME, name: 'nose' }));
  for (const s of [-1, 1]) prims.push(sphere([s * H * 0.06, hy(0.98), hz(0.4)], H * 0.045, { m: M.skin, bone: 'head', blend: 0.08, band: BAND_CLOSE, name: 'nostril' }));
  // Ears: flattened eggs on the sides, a little back.
  for (const s of [-1, 1]) prims.push(ellipsoid([s * P.headW * 0.97, hy(-0.12), hz(0.5)], [H * 0.05, H * 0.1, H * 0.13], { m: M.skin, bone: 'head', blend: 0.08, band: BAND_GAME, name: 'ear' }));
  // Eyes: a white ball with the iris (and close up the pupil and a glint) stamped on its front; a lid over it that blinks, with a
  // dark lash line along its rim; a brow above.
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const e = at(rest, `eye${k}`);
    const r = H * 0.12;
    const fwd: V3 = unit([s * 0.1, 1, 0.05]);
    const irisC = add(e, mul(fwd, r));
    const eye = sphere(e, r, { m: M.white, bone: `eye${k}`, band: BAND_GAME, name: 'eye' });
    const glintC = add(irisC, [-s * r * 0.22, 0, r * 0.26]);
    prims.push(stamped(eye,
      { at: disc(glintC, r * 0.14, M.glint, fwd), band: BAND_CLOSE },
      { at: disc(irisC, r * 0.26, M.pupil, fwd), band: BAND_CLOSE },
      { at: disc(irisC, r * 0.6, M.iris, fwd), band: BAND_GAME },
    ));
    const lid = sphere(e, r * 1.1, { m: M.skin, bone: `lid${k}`, band: BAND_GAME, name: 'lid' });
    prims.push(clip(lid, [[e[0], e[1], e[2] - r * 0.05], [0, 0, -1]], [e, [0, -1, 0]]));
    prims.push(clip(sphere(e, r * 1.12, { m: M.brow, bone: `lid${k}`, band: BAND_GAME, name: 'lash' }), [[e[0], e[1], e[2] - r * 0.05], [0, 0, -1]], [[e[0], e[1], e[2] + r * 0.14], [0, 0, 1]], [e, [0, -1, 0]]));
    const b = at(rest, `brow${k}`);
    const bw = H * 0.19;
    prims.push(capsule([b[0] - s * bw, b[1] + 0.04, b[2] - H * 0.02], [b[0] + s * bw * 0.85, b[1] - 0.02, b[2] + H * 0.035], H * 0.045, H * 0.03, { m: M.brow, bone: `brow${k}`, band: BAND_GAME, name: 'brow' }));
  }
  // Lips: the upper a thin arc on the head, the lower fuller on the jaw.
  const lipPts: V3[] = [-1, 0, 1].map((u) => [u * H * 0.15, my - Math.abs(u) * 0.1 - 0.01, mz + H * 0.035 + u * u * H * 0.03] as V3);
  prims.push(tube(lipPts, () => H * 0.028, { m: M.lip, bone: 'head', blend: 0.05, band: BAND_GAME, name: 'upper lip' }, 6));
  prims.push(capsule([-H * 0.12, my - 0.03, mz - H * 0.035], [H * 0.12, my - 0.03, mz - H * 0.035], H * 0.034, H * 0.034, { m: M.lip, bone: 'jaw', blend: 0.05, band: BAND_GAME, name: 'lower lip' }));
  // Hair: a slight volume over the skull, cut at the hairline in front and down from the temples to the nape behind, and locks over it:
  // a swept fringe, locks over the ears, locks down the nape on the chain. Each lock its own shape, so each has its own shadow.
  const hairline: V3 = [0, hy(0.6), hz(0.82)];
  const volume = ellipsoid([0, hy(-0.08), hz(0.7)], [P.headW * 1.04, P.headD * 1.02, H * 0.42], { m: M.hair, bone: 'head', name: 'hair volume' });
  prims.push(clip(volume, [hairline, unit([0, 0.6, -1])], [[0, headJ[1], hz(0.56)], unit([0, 0.3, -1])]));
  const lock = (pts: V3[], r0: number, r1: number, bone = 'head', band = BAND_GAME, bl = 0.1): Prim =>
    tube(pts, (t) => r0 + (r1 - r0) * t, { m: M.hair, bone, blend: bl, band, name: 'lock' }, 8);
  const crown: V3 = [P.headW * 0.1, hy(-0.05), hz(1.06)];
  // The fringe: four locks off the crown sweeping to the body's left over the brow, the longest reaching the temple.
  prims.push(lock([crown, [-P.headW * 0.2, hy(0.55), hz(0.98)], [-P.headW * 0.66, hy(0.68), hz(0.74)]], H * 0.11, H * 0.05));
  prims.push(lock([[P.headW * 0.25, hy(0.2), hz(1.03)], [-P.headW * 0.05, hy(0.78), hz(0.9)], [-P.headW * 0.3, hy(0.9), hz(0.76)]], H * 0.1, H * 0.045));
  prims.push(lock([[P.headW * 0.45, hy(0.15), hz(1.0)], [P.headW * 0.3, hy(0.75), hz(0.9)], [P.headW * 0.12, hy(0.92), hz(0.78)]], H * 0.1, H * 0.045));
  prims.push(lock([[P.headW * 0.62, hy(0.05), hz(0.94)], [P.headW * 0.75, hy(0.5), hz(0.84)], [P.headW * 0.92, hy(0.55), hz(0.7)]], H * 0.095, H * 0.045));
  // A cowlick up off the crown, and a lock lying back over it.
  prims.push(lock([[P.headW * 0.05, hy(-0.3), hz(1.0)], [P.headW * 0.2, hy(-0.25), hz(1.14)], [P.headW * 0.32, hy(-0.15), hz(1.2)]], H * 0.07, H * 0.025));
  prims.push(lock([[-P.headW * 0.3, hy(0.1), hz(1.04)], [-P.headW * 0.55, hy(-0.3), hz(1.0)], [-P.headW * 0.75, hy(-0.6), hz(0.84)]], H * 0.1, H * 0.05));
  // Side locks over the ears, ending at the ear's top; and the far side's.
  for (const s of [-1, 1]) {
    prims.push(lock([[s * P.headW * 0.75, hy(0.15), hz(0.92)], [s * P.headW * 0.98, hy(0.0), hz(0.74)], [s * P.headW * 1.02, hy(-0.15), hz(0.6)]], H * 0.09, H * 0.045));
    prims.push(lock([[s * P.headW * 0.6, hy(-0.4), hz(0.95)], [s * P.headW * 0.9, hy(-0.6), hz(0.74)], [s * P.headW * 0.85, hy(-0.72), hz(0.52)]], H * 0.1, H * 0.05));
  }
  // The nape: three locks on the hair chain, which swings.
  const h0 = at(rest, 'hair0'), h1 = at(rest, 'hair1');
  for (const s of [-1, 0, 1]) {
    const a: V3 = [h0[0] + s * H * 0.22, h0[1] + 0.1, h0[2] + H * 0.15], b: V3 = [h1[0] + s * H * 0.2, h1[1] - 0.05, h1[2] + H * 0.02], c: V3 = [h1[0] + s * H * 0.16, h1[1] - 0.12, h1[2] - H * 0.14];
    prims.push(lock([a, b, c], H * 0.1, H * 0.04, 'hair0', 0 as 0, 0.1));
    void c;
  }
  prims.push(lock([[h1[0], h1[1] - 0.02, h1[2] + H * 0.05], [h1[0] - H * 0.05, h1[1] - 0.1, h1[2] - H * 0.12], [h1[0] - H * 0.1, h1[1] - 0.14, h1[2] - H * 0.22]], H * 0.09, H * 0.035, 'hair1'));
  // Fine strands close up.
  prims.push(lock([[-P.headW * 0.35, hy(0.82), hz(0.78)], [-P.headW * 0.48, hy(0.88), hz(0.66)]], H * 0.03, H * 0.012, 'head', BAND_CLOSE));
  prims.push(lock([[P.headW * 0.5, hy(0.74), hz(0.78)], [P.headW * 0.6, hy(0.76), hz(0.64)]], H * 0.03, H * 0.012, 'head', BAND_CLOSE));

  /* ---- neck and torso ---------------------------------------------------------------- */
  const neckJ = at(rest, 'neck'), chestJ = at(rest, 'chest'), spA = at(rest, 'spineA'), pelvisJ = at(rest, 'pelvis');
  prims.push(capsule([neckJ[0], neckJ[1] + 0.05, neckJ[2] - 0.3], [headJ[0], headJ[1] + 0.1, headJ[2] + H * 0.12], P.r.neck, P.r.neck * 0.92, { m: M.skin, bone: 'neck', bone2: 'head', split: { from: neckJ, axis: [0, 0, 1], span: P.headJ + 0.2 }, blend: 0.3, name: 'neck' }));
  const waistZ = spA[2] + 0.2;
  const shirtAbove: Stamp = band(waistZ, 99, M.shirt);
  const trousersBelow: Stamp = band(-99, waistZ, M.trousers);
  // The chest: a broad egg, its top at the collarbones, deeper at the back where the shoulder blades are.
  const chest = ellipsoid([0, chestJ[1] + 0.05, chestJ[2] + P.armAt * 0.35], [P.r.chest, P.r.chest * 0.68, P.armAt * 0.9], { m: M.shirt, bone: 'chest', blend: 0.35, name: 'chest' });
  // A crew neck: a thin hem of trim round the neck where the shirt meets it.
  const opening = (p: V3, rx: number, rz: number): number => (1 - Math.hypot(p[0] / rx, (p[2] - neckJ[2] - 0.1) / rz)) * Math.min(rx, rz);
  const collarTrim: Stamp = (p) => ({ m: M.trim, d: Math.min(opening(p, 0.82, 0.62), -opening(p, 0.66, 0.46)) });
  prims.push(stamped(chest, { at: collarTrim, band: BAND_GAME }));
  prims.push(capsule([0, chestJ[1] - 0.55, chestJ[2] + P.armAt * 0.9], [0, spA[1] - 0.25, spA[2] + 0.4], P.r.chest * 0.72, P.r.waist * 0.78, { m: M.shirt, bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + 0.6], axis: [0, 0, -1], span: P.chest }, blend: 0.45, name: 'back' }));
  // Ribs to waist: a tube narrowing from the chest to the waist, then the waist itself, and the pelvis in trousers.
  prims.push(capsule([0, chestJ[1] + 0.05, chestJ[2] + 0.4], [0, spA[1], spA[2] + 0.1], P.r.chest * 0.82, P.r.waist, { m: M.shirt, bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + 0.4], axis: [0, 0, -1], span: P.chest }, blend: 0.4, name: 'ribs' }));
  prims.push(stamped(ellipsoid([0, spA[1], spA[2] + 0.1], [P.r.waist, P.r.waist * 0.72, P.spine * 0.9], { m: M.shirt, bone: 'spineA', blend: 0.4, name: 'waist' }), { at: trousersBelow }));
  prims.push(stamped(ellipsoid([0, pelvisJ[1] - 0.05, pelvisJ[2] - 0.55], [P.r.pelvis, P.r.pelvis * 0.74, 1.25], { m: M.trousers, bone: 'pelvis', blend: 0.4, name: 'pelvis' }), { at: shirtAbove }));
  prims.push(ellipsoid([0, spA[1] - 0.02, waistZ], [P.r.waist * 1.03, P.r.waist * 0.75, 0.18], { m: M.sole, bone: 'spineA', blend: 0.05, band: BAND_GAME, name: 'waistband' }));

  /* ---- arms and hands ----------------------------------------------------------------- */
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const sh = at(rest, `arm${k}`), el = at(rest, `elbow${k}`), wr = at(rest, `wrist${k}`);
    // The shoulder's round, in the shirt's short sleeve, and the slope of the trapezius from the neck down to it.
    prims.push(sphere(add(sh, [s * 0.02, 0, -0.3]), P.r.upper * 0.98, { m: M.shirt, bone: `arm${k}`, blend: 0.6, name: 'shoulder' }));
    prims.push(capsule([s * 0.45, neckJ[1] - 0.15, neckJ[2] - 0.25], [sh[0] * 0.8, sh[1] - 0.1, sh[2] - 0.05], 0.62, 0.42, { m: M.shirt, bone: 'chest', blend: 0.55, name: 'trapezius' }));
    // Upper arm: skin, the sleeve stamped on its top half; it narrows to the elbow so the elbow's round shows in the silhouette.
    const axis = unit(sub(el, sh));
    const upper = capsule(sh, el, P.r.upper, P.r.upper * 0.72, { m: M.skin, bone: `arm${k}`, bone2: `elbow${k}`, split: { from: along(sh, el, 0.72), axis, span: P.upper * 0.28 }, blend: 0.22, name: 'upper arm' });
    const alongArm = (p: V3): number => (p[0] - sh[0]) * axis[0] + (p[1] - sh[1]) * axis[1] + (p[2] - sh[2]) * axis[2];
    const sleeve: Stamp = (p) => ({ m: M.shirt, d: P.upper * 0.42 - alongArm(p) });
    const hem: Stamp = (p) => { const t = alongArm(p); return { m: M.trim, d: Math.min(t - P.upper * 0.34, P.upper * 0.42 - t) }; };
    prims.push(stamped(upper, { at: hem, band: BAND_GAME }, { at: sleeve }));
    prims.push(sphere(el, P.r.fore * 1.08, { m: M.skin, bone: `elbow${k}`, blend: 0.2, name: 'elbow' }));
    const fl = unit(sub(wr, el));
    prims.push(tube([el, along(el, wr, 0.3), wr], (t) => (t < 0.3 ? P.r.fore * (0.92 + 0.3 * t) : P.r.fore * 1.01 + (P.r.wrist - P.r.fore * 1.01) * ((t - 0.3) / 0.7)), { m: M.skin, bone: `elbow${k}`, bone2: `wrist${k}`, split: { from: along(el, wr, 0.78), axis: fl, span: P.lower * 0.22 }, blend: 0.2, name: 'forearm' }, 8));
    // The hand, in its bones' own frames: a palm block off the wrist, the fingers as one curved group off the knuckles (four fingers
    // close up), the thumb a mass set across from the palm's inner edge.
    const wax = axesOf(`wrist${k}`), fax = axesOf(`fing${k}`), tax = axesOf(`fingTip${k}`), thax = axesOf(`thumb${k}`), thtax = axesOf(`thumbTip${k}`);
    const W = P.r.wrist;
    prims.push(roundBox(inBone(`wrist${k}`, [0, 0.05, -P.palm * 0.5]), [W * 0.42, W * 1.02, P.palm * 0.52], 0.18, { m: M.skin, bone: `wrist${k}`, blend: 0.22, name: 'palm' }, wax));
    prims.push(sphere(inBone(`wrist${k}`, [-s * W * 0.25, W * 0.6, -P.palm * 0.3]), W * 0.5, { m: M.skin, bone: `wrist${k}`, blend: 0.25, name: 'thumb mass' }));
    const F = P.finger;
    prims.push(roundBox(inBone(`fing${k}`, [0, 0.05, -F * 0.28]), [W * 0.36, W * 0.98, F * 0.3], 0.17, { m: M.skin, bone: `fing${k}`, blend: 0.14, band: 0, until: BAND_GAME, name: 'fingers' }, fax));
    prims.push(roundBox(inBone(`fingTip${k}`, [0, 0.05, -F * 0.22]), [W * 0.3, W * 0.9, F * 0.24], 0.16, { m: M.skin, bone: `fingTip${k}`, blend: 0.14, band: 0, until: BAND_GAME, name: 'fingertips' }, tax));
    for (let f = 0; f < 4; f++) {
      const y = (f - 1.5) * W * 0.5 + 0.05;
      const l = F * (f === 1 ? 1 : f === 2 ? 0.96 : f === 0 ? 0.86 : 0.78);
      // The knuckle row curves: the middle fingers start a touch further out.
      const dz = -F * 0.04 * (1.5 - Math.abs(f - 1.5));
      const base = inBone(`fing${k}`, [0, y, dz]), mid = inBone(`fing${k}`, [0, y, dz - l * 0.56]);
      const tip0 = inBone(`fingTip${k}`, [0, y, 0]), tip1 = inBone(`fingTip${k}`, [0, y, -l * 0.46]);
      prims.push(capsule(base, mid, W * 0.24, W * 0.22, { m: M.skin, bone: `fing${k}`, blend: 0.1, band: BAND_CLOSE, name: 'finger' }));
      prims.push(capsule(tip0, tip1, W * 0.22, W * 0.17, { m: M.skin, bone: `fingTip${k}`, blend: 0.1, band: BAND_CLOSE, name: 'fingertip' }));
    }
    prims.push(capsule(inBone(`thumb${k}`, [0, 0, 0.1]), inBone(`thumb${k}`, [0, 0, -F * 0.5]), W * 0.32, W * 0.27, { m: M.skin, bone: `thumb${k}`, blend: 0.18, name: 'thumb' }));
    prims.push(capsule(inBone(`thumbTip${k}`, [0, 0, 0]), inBone(`thumbTip${k}`, [0, 0, -F * 0.42]), W * 0.26, W * 0.19, { m: M.skin, bone: `thumbTip${k}`, blend: 0.12, band: BAND_GAME, name: 'thumb tip' }));
    void thax; void thtax;
  }

  /* ---- legs and feet ------------------------------------------------------------------ */
  for (let k = 0; k < 2; k++) {
    const hip = at(rest, `hip${k}`), knee = at(rest, `knee${k}`), ank = at(rest, `ankle${k}`);
    // The thigh narrows to the knee, the knee's round stands a little proud, the shin swells at the calf and narrows to the ankle.
    prims.push(capsule(add(hip, [0, 0, 0.3]), knee, P.r.thigh, P.r.thigh * 0.64, { m: M.trousers, bone: `hip${k}`, bone2: `knee${k}`, split: { from: along(hip, knee, 0.74), axis: unit(sub(knee, hip)), span: P.thigh * 0.26 }, blend: 0.3, name: 'thigh' }));
    prims.push(sphere(add(knee, [0, 0.06, 0]), P.r.shin * 1.12, { m: M.trousers, bone: `knee${k}`, blend: 0.22, name: 'knee' }));
    const sl = unit(sub(ank, knee));
    prims.push(tube([knee, along(knee, ank, 0.3), add(ank, [0, 0, 0.1])], (t) => (t < 0.3 ? P.r.shin * (0.92 + 0.5 * t) : P.r.shin * 1.07 + (P.r.ankle * 1.1 - P.r.shin * 1.07) * ((t - 0.3) / 0.7)), { m: M.trousers, bone: `knee${k}`, bone2: `ankle${k}`, split: { from: along(knee, ank, 0.8), axis: sl, span: P.shin * 0.2 }, blend: 0.22, name: 'shin' }, 8));
    prims.push(sphere(ank, P.r.ankle, { m: M.skin, bone: `ankle${k}`, blend: 0.15, name: 'ankle' }));
    // The foot in a soft shoe: heel and instep off the ankle, the toes off the ball so they bend; a darker sole under.
    const soleStamp: Stamp = (p, n) => ({ m: M.sole, d: Math.max(-0.45 - n[2], 0.14 - p[2]) });
    prims.push(stamped(roundBox(inBone(`ankle${k}`, [0, P.foot * 0.22, -P.sole * 0.5 + 0.02]), [P.r.ankle * 1.15, P.foot * 0.42, P.sole * 0.5], 0.22, { m: M.shoe, bone: `ankle${k}`, blend: 0.3, name: 'foot' }, axesOf(`ankle${k}`)), { at: soleStamp }));
    prims.push(stamped(roundBox(inBone(`toe${k}`, [0, P.foot * 0.2, -0.17]), [P.r.ankle * 1.2, P.foot * 0.26, P.sole * 0.38], 0.24, { m: M.shoe, bone: `toe${k}`, blend: 0.28, name: 'toes' }, axesOf(`toe${k}`)), { at: soleStamp }));
  }
  return modelOf(prims, bodyMaterials(look));
}
