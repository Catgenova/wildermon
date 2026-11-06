/**
 * The base body: a person in a plain fitted undershirt, plain trousers and
 * soft shoes, sculpted against the rest skeleton at any proportions. A head
 * with a face (eyes that blink, brows, a nose, ears, a mouth), hair as
 * locks, a neck, a torso, arms with hands that have a thumb and fingers,
 * legs with knees and ankles, feet with toes that bend. Garments go over it
 * as layers of their own, later.
 *
 * Everything is placed off the rest skeleton (`rest`), so a joint is where
 * the rig's joint is and the skinning follows.
 */
import { eyeColour, hairColour, skinColour, type Look } from '../../game/look';
import { at, along, type Bones, type Proportions } from '../rig';
import {
  BAND_CLOSE, BAND_GAME, band, capsule, clip, curveStamp, disc, ellipsoid, modelOf, roundBox, sphere, stamped, sub, unit, cross, add, mul,
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
  out[M.iris] = { colour: eye };
  out[M.pupil] = { colour: mixHex(eye, '#1a1016', 0.75) };
  out[M.glint] = { colour: '#fffaf0' };
  out[M.brow] = { colour: mixHex(hair, '#16100e', 0.3) };
  out[M.lip] = { colour: mixHex(skin, '#a4484a', 0.4) };
  // The undershirt a warm chalk, the trousers a dusty slate-teal, the shoes caramel: the kit's pastel base, no splash yet.
  out[M.shirt] = { colour: '#efe4cf' };
  out[M.trousers] = { colour: '#6f8390' };
  out[M.shoe] = { colour: '#a8794f' };
  out[M.sole] = { colour: '#6e4e3a' };
  out[M.mouth] = { colour: '#5a2a3c' };
  out[M.teeth] = { colour: '#fbf6ea' };
  out[M.trim] = { colour: '#d9ccb4' };
  return out;
}

export function bodyModel(P: Proportions, rest: Bones, look: Look): Model {
  const prims: Prim[] = [];
  const H = P.head;
  const headJ = at(rest, 'head');
  const hz = (f: number): number => headJ[2] + H * f;

  /* ---- head ------------------------------------------------------------------------- */
  // Cranium and face: two eggs, the lower narrower, blended into one head; the chin on the jaw so the mouth can open.
  prims.push(ellipsoid([0, headJ[1] - P.headD * 0.05, hz(0.6)], [P.headW, P.headD * 0.98, H * 0.44], { m: M.skin, bone: 'head', name: 'cranium' }));
  prims.push(ellipsoid([0, headJ[1] + P.headD * 0.12, hz(0.34)], [P.headW * 0.86, P.headD * 0.82, H * 0.36], { m: M.skin, bone: 'head', blend: 0.45, name: 'face' }));
  prims.push(ellipsoid([0, headJ[1] + P.headD * 0.22, hz(0.1)], [P.headW * 0.5, P.headD * 0.5, H * 0.14], { m: M.skin, bone: 'jaw', blend: 0.3, name: 'chin' }));
  // Nose: bridge to tip, and a small round at the tip.
  const noseTop: V3 = [0, headJ[1] + P.headD * 0.82, hz(0.52)], noseTip: V3 = [0, headJ[1] + P.headD * 1.0, hz(0.4)];
  prims.push(capsule(noseTop, noseTip, H * 0.045, H * 0.075, { m: M.skin, bone: 'head', blend: 0.1, band: BAND_GAME, name: 'nose' }));
  // Ears: flattened eggs on the sides, a little back.
  for (const s of [-1, 1]) {
    prims.push(ellipsoid([s * P.headW * 0.96, headJ[1] - P.headD * 0.12, hz(0.5)], [H * 0.06, H * 0.12, H * 0.16], { m: M.skin, bone: 'head', blend: 0.08, band: BAND_GAME, name: 'ear' }));
  }
  // Eyes: a white ball with the iris, pupil and a glint stamped on its front; a lid over it that blinks; a brow above.
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const e = at(rest, `eye${k}`);
    const r = H * 0.105;
    const fwd: V3 = unit([s * 0.12, 1, 0.05]);
    const irisC = add(e, mul(fwd, r));
    const eye = sphere(e, r, { m: M.white, bone: `eye${k}`, band: BAND_GAME, name: 'eye' });
    const glintC = add(irisC, [ -s * r * 0.22, 0, r * 0.26]);
    prims.push(stamped(eye,
      { at: disc(glintC, r * 0.13, M.glint, fwd), band: BAND_CLOSE },
      { at: disc(irisC, r * 0.3, M.pupil, fwd), band: BAND_GAME },
      { at: disc(irisC, r * 0.62, M.iris, fwd), band: BAND_GAME },
    ));
    // The lid: a shell a shade bigger than the eye, kept above the eye's middle and in front, hinged at the eye.
    const lid = sphere(e, r * 1.1, { m: M.skin, bone: `lid${k}`, band: BAND_GAME, name: 'lid' });
    prims.push(clip(lid, [[e[0], e[1], e[2] - r * 0.1], [0, 0, -1]], [e, [0, -1, 0]]));
    // Lash line: a dark edge along the lid's rim, close up.
    prims.push(stamped(clip(sphere(e, r * 1.12, { m: M.brow, bone: `lid${k}`, band: BAND_CLOSE, name: 'lash' }), [[e[0], e[1], e[2] - r * 0.1], [0, 0, -1]], [[e[0], e[1], e[2] + r * 0.12], [0, 0, 1]], [e, [0, -1, 0]])));
    const b = at(rest, `brow${k}`);
    const bw = H * 0.17;
    prims.push(capsule([b[0] - s * bw, b[1] - 0.02, b[2] - H * 0.01], [b[0] + s * bw * 0.9, b[1] - 0.06, b[2] + H * 0.03], H * 0.035, H * 0.028, { m: M.brow, bone: `brow${k}`, band: BAND_GAME, name: 'brow' }));
  }
  // The mouth: a smile stamped across the face, the lip a little fuller close up.
  const mz = hz(0.27), my = headJ[1] + P.headD * 0.92;
  const smilePts: V3[] = [-1, -0.5, 0, 0.5, 1].map((u) => [u * H * 0.19, my - Math.abs(u) * 0.12, mz + u * u * H * 0.045] as V3);
  const facePrim = prims[1];
  prims[1] = stamped(facePrim, { at: curveStamp(smilePts, H * 0.028, M.lip, [0, 1, 0]), band: BAND_GAME });
  // Hair: a cap over the cranium cut at the hairline, a fringe of locks swept to the body's left, locks over the ears, and the back in two links that swing.
  const hairline: V3 = [0, headJ[1] + P.headD * 0.55, hz(0.78)];
  const cap = ellipsoid([0, headJ[1] - P.headD * 0.12, hz(0.66)], [P.headW * 1.1, P.headD * 1.06, H * 0.48], { m: M.hair, bone: 'head', name: 'hair cap' });
  prims.push(clip(cap, [hairline, unit([0, 0.55, -1])]));
  const lock = (a: V3, b: V3, ra: number, rb: number, bone = 'head', band = BAND_GAME): Prim => capsule(a, b, ra, rb, { m: M.hair, bone, blend: 0.18, band, name: 'lock' });
  const crown: V3 = [0, headJ[1] - P.headD * 0.1, hz(1.04)];
  // Fringe: three locks from the crown down over the brow, swept across.
  prims.push(lock(crown, [-P.headW * 0.55, headJ[1] + P.headD * 0.78, hz(0.72)], H * 0.16, H * 0.1));
  prims.push(lock([P.headW * 0.2, headJ[1] + P.headD * 0.2, hz(1.0)], [P.headW * 0.1, headJ[1] + P.headD * 0.95, hz(0.66)], H * 0.15, H * 0.09));
  prims.push(lock([P.headW * 0.4, headJ[1] + P.headD * 0.1, hz(0.98)], [P.headW * 0.78, headJ[1] + P.headD * 0.7, hz(0.7)], H * 0.14, H * 0.08));
  // A cowlick up off the crown.
  prims.push(lock([P.headW * 0.1, headJ[1] - P.headD * 0.2, hz(1.0)], [P.headW * 0.3, headJ[1] - P.headD * 0.05, hz(1.2)], H * 0.1, H * 0.03));
  // Side locks over the ears.
  for (const s of [-1, 1]) prims.push(lock([s * P.headW * 0.85, headJ[1] + P.headD * 0.1, hz(0.9)], [s * P.headW * 1.02, headJ[1] - P.headD * 0.1, hz(0.5)], H * 0.14, H * 0.08));
  // Back locks on the hair chain.
  const h0 = at(rest, 'hair0'), h1 = at(rest, 'hair1');
  prims.push(lock([h0[0], h0[1] + 0.15, h0[2] + H * 0.1], h1, H * 0.22, H * 0.16, 'hair0', 0 as 0));
  prims.push(lock(h1, add(h1, [0, -0.1, -H * 0.3]), H * 0.16, H * 0.06, 'hair1'));
  // Fine strands close up.
  prims.push(lock([-P.headW * 0.3, headJ[1] + P.headD * 0.85, hz(0.75)], [-P.headW * 0.45, headJ[1] + P.headD * 0.9, hz(0.6)], H * 0.035, H * 0.015, 'head', BAND_CLOSE));
  prims.push(lock([P.headW * 0.5, headJ[1] + P.headD * 0.72, hz(0.74)], [P.headW * 0.62, headJ[1] + P.headD * 0.74, hz(0.62)], H * 0.035, H * 0.012, 'head', BAND_CLOSE));

  /* ---- neck and torso ---------------------------------------------------------------- */
  const neckJ = at(rest, 'neck'), chestJ = at(rest, 'chest'), spA = at(rest, 'spineA'), spB = at(rest, 'spineB'), pelvisJ = at(rest, 'pelvis');
  prims.push(capsule([neckJ[0], neckJ[1] + 0.05, neckJ[2] - 0.3], [headJ[0], headJ[1] + 0.1, headJ[2] + H * 0.12], P.r.neck, P.r.neck * 0.92, { m: M.skin, bone: 'neck', bone2: 'head', split: { from: neckJ, axis: [0, 0, 1], span: P.headJ + 0.2 }, blend: 0.3, name: 'neck' }));
  const waistZ = spA[2] + 0.2;
  const shirtAbove: Stamp = band(waistZ, 99, M.shirt);
  const trousersBelow: Stamp = band(-99, waistZ, M.trousers);
  // The chest: a broad egg, its top at the collarbones; a cream shirt with the neck open to the skin.
  const chest = ellipsoid([0, chestJ[1] + 0.1, chestJ[2] + P.armAt * 0.45], [P.r.chest, P.r.chest * 0.62, P.armAt * 1.0], { m: M.shirt, bone: 'chest', blend: 0.35, name: 'chest' });
  const collar: Stamp = (p) => (p[2] > neckJ[2] - 0.45 && Math.hypot(p[0] / 0.9, (p[2] - neckJ[2] + 0.2) / 0.7) < 1 && p[1] > -0.2 ? M.skin : undefined);
  const collarTrim: Stamp = (p) => (p[2] > neckJ[2] - 0.6 && Math.hypot(p[0] / 1.05, (p[2] - neckJ[2] + 0.2) / 0.85) < 1 && p[1] > -0.2 ? M.trim : undefined);
  prims.push(stamped(chest, { at: collar }, { at: collarTrim, band: BAND_GAME }));
  // Ribs to waist: a tube narrowing from the chest to the waist, then the waist itself, and the pelvis in trousers.
  prims.push(capsule([0, chestJ[1] + 0.05, chestJ[2] + 0.4], [0, spA[1], spA[2] + 0.1], P.r.chest * 0.82, P.r.waist, { m: M.shirt, bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + 0.4], axis: [0, 0, -1], span: P.chest }, blend: 0.4, name: 'ribs' }));
  prims.push(stamped(ellipsoid([0, spA[1], spA[2] + 0.1], [P.r.waist, P.r.waist * 0.72, P.spine * 0.9], { m: M.shirt, bone: 'spineA', blend: 0.4, name: 'waist' }), { at: trousersBelow }));
  prims.push(stamped(ellipsoid([0, pelvisJ[1] - 0.05, pelvisJ[2] - 0.55], [P.r.pelvis, P.r.pelvis * 0.74, 1.25], { m: M.trousers, bone: 'pelvis', blend: 0.4, name: 'pelvis' }), { at: shirtAbove }));
  // Waistband: a thin darker band at the waistline, game band up.
  prims.push(stamped(ellipsoid([0, spA[1] - 0.02, waistZ], [P.r.waist * 1.03, P.r.waist * 0.75, 0.18], { m: M.sole, bone: 'spineA', blend: 0.05, band: BAND_GAME, name: 'waistband' })));
  void spB;

  /* ---- arms and hands ----------------------------------------------------------------- */
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const sh = at(rest, `arm${k}`), el = at(rest, `elbow${k}`), wr = at(rest, `wrist${k}`);
    // The shoulder's round, in the shirt's short sleeve.
    prims.push(sphere(add(sh, [s * 0.1, 0, 0.1]), P.r.upper * 1.3, { m: M.shirt, bone: `arm${k}`, blend: 0.4, name: 'shoulder' }));
    // Upper arm: skin, the sleeve stamped on its top half.
    const upper = capsule(sh, el, P.r.upper, P.r.upper * 0.82, { m: M.skin, bone: `arm${k}`, bone2: `elbow${k}`, split: { from: along(sh, el, 0.72), axis: unit(sub(el, sh)), span: P.upper * 0.28 }, blend: 0.25, name: 'upper arm' });
    const axis = unit(sub(el, sh));
    const sleeve: Stamp = (p) => (((p[0] - sh[0]) * axis[0] + (p[1] - sh[1]) * axis[1] + (p[2] - sh[2]) * axis[2]) < P.upper * 0.42 ? M.shirt : undefined);
    const hem: Stamp = (p) => { const t = (p[0] - sh[0]) * axis[0] + (p[1] - sh[1]) * axis[1] + (p[2] - sh[2]) * axis[2]; return t >= P.upper * 0.34 && t < P.upper * 0.42 ? M.trim : undefined; };
    prims.push(stamped(upper, { at: hem, band: BAND_GAME }, { at: sleeve }));
    prims.push(sphere(el, P.r.fore * 1.02, { m: M.skin, bone: `elbow${k}`, blend: 0.25, name: 'elbow' }));
    prims.push(capsule(el, wr, P.r.fore, P.r.wrist, { m: M.skin, bone: `elbow${k}`, bone2: `wrist${k}`, split: { from: along(el, wr, 0.78), axis: unit(sub(wr, el)), span: P.lower * 0.22 }, blend: 0.25, name: 'forearm' }));
    // The hand: a palm, thin across the body, the thumb forward and in, the fingers down.
    const wrist = rest[`wrist${k}`];
    const ax: [V3, V3, V3] = [[wrist.m[0], wrist.m[3], wrist.m[6]], [wrist.m[1], wrist.m[4], wrist.m[7]], [wrist.m[2], wrist.m[5], wrist.m[8]]];
    const inFrame = (o: V3): V3 => add(wr, add(add(mul(ax[0], o[0]), mul(ax[1], o[1])), mul(ax[2], o[2])));
    prims.push(roundBox(inFrame([0, 0.05, -P.palm * 0.5]), [P.r.wrist * 0.55, P.r.wrist * 1.05, P.palm * 0.5], 0.18, { m: M.skin, bone: `wrist${k}`, blend: 0.22, name: 'palm' }, ax));
    const kn = at(rest, `fing${k}`), tip = at(rest, `fingTip${k}`);
    const fdir = unit(sub(tip, kn));
    // Far and at the game's zooms, the four fingers are one shape; close up, four.
    prims.push(roundBox(inFrame([0, 0.05, -P.palm - P.finger * 0.5]), [P.r.wrist * 0.42, P.r.wrist * 1.0, P.finger * 0.5], 0.2, { m: M.skin, bone: `fing${k}`, bone2: `fingTip${k}`, split: { from: kn, axis: fdir, span: P.finger }, blend: 0.15, band: 0, until: BAND_GAME, name: 'fingers' }, ax));
    for (let f = 0; f < 4; f++) {
      const y = (f - 1.5) * P.r.wrist * 0.52;
      const l = P.finger * (f === 0 || f === 3 ? 0.85 : 1);
      const base = inFrame([0, y + 0.05, -P.palm + 0.05]);
      const mid = add(base, mul(fdir, l * 0.55)), end = add(base, mul(fdir, l));
      prims.push(capsule(base, mid, P.r.wrist * 0.23, P.r.wrist * 0.21, { m: M.skin, bone: `fing${k}`, blend: 0.12, band: BAND_CLOSE, name: 'finger' }));
      prims.push(capsule(mid, end, P.r.wrist * 0.21, P.r.wrist * 0.17, { m: M.skin, bone: `fingTip${k}`, blend: 0.12, band: BAND_CLOSE, name: 'fingertip' }));
    }
    const th = at(rest, `thumb${k}`), tht = at(rest, `thumbTip${k}`);
    const thEnd = add(tht, mul(unit(sub(tht, th)), P.finger * 0.45));
    prims.push(capsule(th, tht, P.r.wrist * 0.3, P.r.wrist * 0.25, { m: M.skin, bone: `thumb${k}`, blend: 0.18, band: BAND_GAME, name: 'thumb' }));
    prims.push(capsule(tht, thEnd, P.r.wrist * 0.25, P.r.wrist * 0.19, { m: M.skin, bone: `thumbTip${k}`, blend: 0.12, band: BAND_GAME, name: 'thumb tip' }));
  }

  /* ---- legs and feet ------------------------------------------------------------------ */
  for (let k = 0; k < 2; k++) {
    const hip = at(rest, `hip${k}`), knee = at(rest, `knee${k}`), ank = at(rest, `ankle${k}`);
    prims.push(capsule(add(hip, [0, 0, 0.3]), knee, P.r.thigh, P.r.thigh * 0.72, { m: M.trousers, bone: `hip${k}`, bone2: `knee${k}`, split: { from: along(hip, knee, 0.74), axis: unit(sub(knee, hip)), span: P.thigh * 0.26 }, blend: 0.35, name: 'thigh' }));
    prims.push(sphere(knee, P.r.shin * 1.05, { m: M.trousers, bone: `knee${k}`, blend: 0.25, name: 'knee' }));
    prims.push(capsule(knee, add(ank, [0, 0, 0.1]), P.r.shin, P.r.ankle * 1.15, { m: M.trousers, bone: `knee${k}`, bone2: `ankle${k}`, split: { from: along(knee, ank, 0.8), axis: unit(sub(ank, knee)), span: P.shin * 0.2 }, blend: 0.25, name: 'shin' }));
    prims.push(sphere(ank, P.r.ankle, { m: M.skin, bone: `ankle${k}`, blend: 0.15, name: 'ankle' }));
    // The foot in a soft shoe: heel and instep off the ankle, the toes off the ball so they bend; a darker sole under.
    const ankle = rest[`ankle${k}`];
    const fax: [V3, V3, V3] = [[ankle.m[0], ankle.m[3], ankle.m[6]], [ankle.m[1], ankle.m[4], ankle.m[7]], [ankle.m[2], ankle.m[5], ankle.m[8]]];
    const inF = (o: V3): V3 => add(ank, add(add(mul(fax[0], o[0]), mul(fax[1], o[1])), mul(fax[2], o[2])));
    const soleStamp: Stamp = (p, n) => (n[2] < -0.45 || p[2] < 0.14 ? M.sole : undefined);
    prims.push(stamped(roundBox(inF([0, P.foot * 0.22, -P.sole * 0.5 + 0.02]), [P.r.ankle * 1.15, P.foot * 0.42, P.sole * 0.5], 0.22, { m: M.shoe, bone: `ankle${k}`, blend: 0.3, name: 'foot' }, fax), { at: soleStamp }));
    const toe = rest[`toe${k}`];
    const tax: [V3, V3, V3] = [[toe.m[0], toe.m[3], toe.m[6]], [toe.m[1], toe.m[4], toe.m[7]], [toe.m[2], toe.m[5], toe.m[8]]];
    const tj = at(rest, `toe${k}`);
    const inT = (o: V3): V3 => add(tj, add(add(mul(tax[0], o[0]), mul(tax[1], o[1])), mul(tax[2], o[2])));
    prims.push(stamped(roundBox(inT([0, P.foot * 0.2, -0.17]), [P.r.ankle * 1.2, P.foot * 0.26, P.sole * 0.38], 0.24, { m: M.shoe, bone: `toe${k}`, blend: 0.28, name: 'toes' }, tax), { at: soleStamp }));
  }
  void cross;
  return modelOf(prims, bodyMaterials(look));
}
