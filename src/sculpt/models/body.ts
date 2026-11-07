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
  BAND_CLOSE, BAND_GAME, STAMP_MARGIN, band, capsule, clip, clipBy, curveStamp, disc, ellipsoid, firstOf, modelOf, roundBox, sphere, stamped, sub, unit, add, torus, tube, wedge,
  type Material, type Model, type Prim, type Stamp, type V3,
} from '../sdf';

/** The materials, by index. */
export const M = { skin: 0, hair: 1, white: 2, iris: 3, pupil: 4, glint: 5, brow: 6, lip: 7, shirt: 8, trousers: 9, shoe: 10, sole: 11, mouth: 12, teeth: 13, trim: 14, lash: 15, shorts: 16, hairLight: 17, hairGlint: 18, crease: 19, face: 20, hand: 21, lid: 22, ear: 23, faceUnder: 24, poncho: 25, gold: 26, hairCut: 27, hairTop: 28, hairUnder: 29 } as const;

/** What the body wears: the game's undershirt and trousers, or the reference sheet's shorts over bare skin. */
export type Wear = 'base' | 'shorts';

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: [number, number, number]): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mixHex = (a: string, b: string, t: number): string => { const A = hex(a), B = hex(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); };
/** The renderer's ink of a colour: toward a warm dark, never lighter than half. */
const inkOf = (a: string): string => { const A = hex(a), m = hex(mixHex(a, '#281c1a', 0.62)); return toHex([Math.min(m[0], A[0] * 0.5), Math.min(m[1], A[1] * 0.5), Math.min(m[2], A[2] * 0.5)]); };

export function bodyMaterials(look: Look): Material[] {
  // A look may name a colour outright (the studio's sheet colours) rather than a swatch.
  const skin = look.skin.startsWith('#') ? look.skin : skinColour(look), hair = look.hairColour.startsWith('#') ? look.hairColour : hairColour(look), eye = eyeColour(look);
  const out: Material[] = [];
  // Skin a touch warmer than the swatch, the pastel of the kit.
  out[M.skin] = { colour: mixHex(skin, '#f2b48c', 0.15), skin: true };
  out[M.hair] = { colour: hair };
  out[M.white] = { colour: mixHex(skin, '#f8f4ec', 0.7), eye: true };
  out[M.iris] = { colour: mixHex(eye, '#2a1a18', 0.2), eye: true };
  // The base's eye: a dark slate rectangle, the look's eye colour a tint in it.
  out[M.pupil] = { colour: mixHex(eye, '#262a33', 0.85), eye: true };
  out[M.glint] = { colour: '#fffaf0', eye: true };
  // The brow: a deep warm brown, the hair's colour toward the skin's ink.
  out[M.brow] = { colour: mixHex(mixHex(hair, inkOf(out[M.skin].colour), 0.7), '#7a4a30', 0.3) };
  out[M.lash] = { colour: mixHex(hair, '#2a1a24', 0.7) };
  out[M.shorts] = { colour: '#454a54' };
  // The hair's highlight shape, a lilac of the hair's own, and the teal that streaks two clumps, as the sheet's palette.
  out[M.hairLight] = { colour: mixHex(hair, '#b69de2', 0.5) };
  out[M.hairGlint] = { colour: mixHex(hair, '#5fb3ae', 0.55) };
  // A cut's planes (the styles made one by one): the hair's own colour, three tones by the plane's turn to the light, no
  // ink between two planes (the edge of the hair against the skin is still inked).
  out[M.hairCut] = { colour: hair, noCrease: true };
  // Its planes facing up a lighter warm of the hair's own, and the edge where its thickness shows a dark of it.
  out[M.hairTop] = { colour: mixHex(hair, '#f2cdb4', 0.3), noCrease: true };
  out[M.hairUnder] = { colour: mixHex(hair, '#1c100c', 0.45), noCrease: true };
  out[M.lip] = { colour: mixHex(skin, '#a4484a', 0.42) };
  // The undershirt a pastel cream, the trousers a dusty slate-teal, the shoes caramel: the kit's pastel base, no splash yet.
  out[M.shirt] = { colour: '#ecdcb8' };
  out[M.trousers] = { colour: '#6f8390' };
  out[M.shoe] = { colour: '#a8794f' };
  out[M.sole] = { colour: '#6e4e3a' };
  out[M.mouth] = { colour: '#5a2a3c' };
  out[M.teeth] = { colour: '#fbf6ea' };
  out[M.trim] = { colour: '#d4c3a0', noCrease: true };
  // The poncho: the sheet's cream, its border and sun sigil the sheet's gold.
  out[M.poncho] = { colour: '#ece0d2' };
  out[M.gold] = { colour: '#dcab5a', noCrease: true };
  // The groove between two fingers: the ink rule, a dark of the skin's own colour.
  out[M.crease] = { colour: inkOf(out[M.skin].colour) };
  // The face's planes shade soft (the shadow tone only well away from the light); the mitt has no ink inside its edge.
  out[M.face] = { ...out[M.skin], soft: true, noCrease: true };
  out[M.ear] = { ...out[M.skin], noInk: true, thinInk: true, soft: true };
  // The nose's underside and under the jaw: the ordinary three tones, so they take the shadow a lit face's planes do not.
  out[M.faceUnder] = { ...out[M.skin], noCrease: true };
  out[M.brow].noCrease = true; out[M.pupil].noCrease = true;
  out[M.hand] = { ...out[M.skin], noInk: true, soft: true };
  // The eye's top edge, a lighter slate, so the rectangle reads set in.
  out[M.lid] = { colour: mixHex(out[M.pupil].colour, out[M.skin].colour, 0.45), eye: true, noCrease: true };
  return out;
}

export function bodyModel(P: Proportions, rest: Bones, look: Look, wear: Wear = 'base'): Model {
  const prims: Prim[] = [];
  const H = P.head;
  const bare = wear === 'shorts';
  // How far toward a woman's masses: the pectorals round into breasts, the lats, deltoids and trapezius lighten, the hips round.
  const f = P.fem, woman = f >= 0.5;
  /** A clothed material, or skin where the body is bare. */
  const cm = (m: number): number => (bare && (m === M.shirt || m === M.trousers || m === M.shoe || m === M.sole || m === M.trim) ? M.skin : m);
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
  // The mouth: a closed smile, one dark line curving up at its corners, stamped on the face; a little lower-lip volume under it.
  const mz = hz(0.27), my = hy(0.9);
  const mouthPts: V3[] = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((u) => [u * H * 0.155, my - u * u * 0.16, mz + u * u * H * 0.05] as V3);
  prims.push(stamped(face, { at: curveStamp(mouthPts, H * 0.022, M.mouth, [0, 1, 0]), band: BAND_GAME }));
  prims.push(capsule([-H * 0.1, my - 0.03, mz - H * 0.05], [H * 0.1, my - 0.03, mz - H * 0.05], H * 0.032, H * 0.032, { m: M.lip, bone: 'jaw', blend: 0.1, band: BAND_GAME, name: 'lower lip' }));
  prims.push(ellipsoid([0, hy(0.22), hz(0.1)], [P.headW * 0.5, P.headD * 0.5, H * 0.14], { m: M.skin, bone: 'jaw', blend: 0.3, name: 'chin' }));
  // Cheek planes, so the shadow shape has a plane to sit on.
  for (const s of [-1, 1]) prims.push(ellipsoid([s * P.headW * 0.6, hy(0.45), hz(0.4)], [H * 0.2, H * 0.18, H * 0.17], { m: M.skin, bone: 'head', blend: 0.3, band: BAND_GAME, name: 'cheek' }));
  // The brow ridge across the eyes, and the nose: a bridge from between the brows to a soft round tip.
  prims.push(capsule([-P.headW * 0.55, hy(0.7), hz(0.68)], [P.headW * 0.55, hy(0.7), hz(0.68)], H * 0.09, H * 0.09, { m: M.skin, bone: 'head', blend: 0.3, band: BAND_GAME, name: 'brow ridge' }));
  prims.push(capsule([0, hy(0.86), hz(0.6)], [0, hy(1.0), hz(0.44)], H * 0.04, H * 0.05, { m: M.skin, bone: 'head', blend: 0.14, band: BAND_GAME, name: 'nose' }));
  prims.push(sphere([0, hy(1.0), hz(0.41)], H * 0.065, { m: M.skin, bone: 'head', blend: 0.2, band: BAND_GAME, name: 'nose tip' }));
  // Ears: flattened eggs on the sides, a little back.
  for (const s of [-1, 1]) prims.push(ellipsoid([s * P.headW * 0.97, hy(-0.12), hz(0.5)], [H * 0.05, H * 0.1, H * 0.13], { m: M.skin, bone: 'head', blend: 0.08, band: BAND_GAME, name: 'ear' }));
  // Eyes: an almond -- a white egg cut by a curved upper lid and a curved lower one, the upper lid line a dark stamp thickening
  // toward the outer corner -- with a large dark iris, a pupil and one glint; a thick tapered brow on the ridge over it.
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const e = at(rest, `eye${k}`);
    const ew = H * 0.15, hUp = H * 0.082, hLo = H * 0.06;
    const tOf = (x: number): number => ((x - e[0]) * s) / ew;
    const zHi = (x: number): number => { const t = tOf(x); return e[2] + hUp * Math.max(0, 1 - t * t) * (1 + 0.12 * t); };
    const zLo = (x: number): number => { const t = tOf(x); return e[2] - hLo * Math.max(0, 1 - t * t); };
    const white = ellipsoid([e[0], e[1] - H * 0.03, e[2]], [ew * 1.04, H * 0.085, H * 0.11], { m: M.white, bone: `eye${k}`, band: BAND_GAME, name: 'eye' });
    const cut = clipBy(white, (p) => Math.max(p[2] - zHi(p[0]), zLo(p[0]) - p[2], (e[1] - p[1]) * 0.5));
    const fwd: V3 = unit([s * 0.1, 1, 0.05]);
    const irisC: V3 = [e[0] + s * ew * 0.04, e[1] + H * 0.075, e[2] - H * 0.004];
    const ir = H * 0.052;
    const lash: Stamp = (p) => { const t = tOf(p[0]); if (Math.abs(t) > 1.05) return undefined; const w = H * (0.014 + 0.024 * Math.max(0, Math.min(1, (t + 1) / 2))); return { m: M.lash, d: w - (zHi(p[0]) - p[2]) }; };
    prims.push(stamped(cut,
      { at: lash, band: BAND_GAME },
      { at: disc([irisC[0] - s * ir * 0.3, irisC[1], irisC[2] + ir * 0.35], ir * 0.26, M.glint, fwd), band: BAND_CLOSE },
      { at: disc(irisC, ir * 0.45, M.pupil, fwd), band: BAND_CLOSE },
      { at: disc(irisC, ir, M.iris, fwd), band: BAND_GAME },
    ));
    const b = at(rest, `brow${k}`);
    prims.push(tube([[b[0] - s * H * 0.09, b[1] + 0.05, b[2] - H * 0.02], [b[0] + s * H * 0.06, b[1] + 0.02, b[2] + H * 0.03], [b[0] + s * H * 0.21, b[1] - 0.06, b[2] - H * 0.005]], (t) => H * (0.05 - 0.024 * t), { m: M.brow, bone: `brow${k}`, blend: 0.04, band: BAND_GAME, name: 'brow' }, 6));
  }
  // Hair: a slight volume over the skull, cut at the hairline in front and down from the temples to the nape behind, and chunky
  // wedges over it -- three big ones swept to the body's left over the brow, a mass over the crown, a mass over each ear, a mass
  // down the nape on the chain -- each a ribbon with one shadow shape, and a few thin strands as accents.
  const hairline: V3 = [0, hy(0.6), hz(0.86)];
  const volume = ellipsoid([0, hy(-0.08), hz(0.7)], [P.headW * 1.04, P.headD * 1.02, H * 0.42], { m: M.hair, bone: 'head', name: 'hair volume' });
  prims.push(clip(volume, [hairline, unit([0, 0.6, -1])], [[0, headJ[1], hz(0.56)], unit([0, 0.3, -1])]));
  const W = (pts: V3[], w0: number, w1: number, h0: number, h1: number, up: V3, bone = 'head', band = BAND_GAME, bl = 0.12): Prim =>
    wedge(pts, (t) => H * (w0 + (w1 - w0) * t), (t) => H * (h0 + (h1 - h0) * t), up, { m: M.hair, bone, blend: bl, band, name: 'wedge' }, 8);
  // The fringe ends over the brow, clear of the eyes; the longest wedge reaches the left temple.
  prims.push(W([[P.headW * 0.3, hy(0.1), hz(1.03)], [-P.headW * 0.12, hy(0.6), hz(1.0)], [-P.headW * 0.6, hy(0.66), hz(0.89)]], 0.3, 0.12, 0.11, 0.03, [0, 0.6, 1]));
  prims.push(W([[P.headW * 0.55, hy(0.0), hz(0.99)], [P.headW * 0.25, hy(0.6), hz(0.95)], [-P.headW * 0.08, hy(0.8), hz(0.9)]], 0.28, 0.12, 0.1, 0.03, [0, 0.6, 1]));
  prims.push(W([[P.headW * 0.72, hy(-0.1), hz(0.93)], [P.headW * 0.72, hy(0.42), hz(0.89)], [P.headW * 0.68, hy(0.66), hz(0.86)]], 0.26, 0.11, 0.1, 0.03, [0.4, 0.5, 1]));
  prims.push(W([[-P.headW * 0.45, hy(0.25), hz(1.0)], [0, hy(-0.3), hz(1.08)], [P.headW * 0.45, hy(-0.65), hz(0.92)]], 0.36, 0.3, 0.11, 0.07, [0, 0, 1]));
  prims.push(W([[P.headW * 0.1, hy(-0.3), hz(1.0)], [P.headW * 0.22, hy(-0.22), hz(1.14)], [P.headW * 0.34, hy(-0.1), hz(1.2)]], 0.12, 0.04, 0.07, 0.025, [0, 1, 0]));
  // The side masses end at the top of the ear; the nape mass is short, on the chain.
  for (const s of [-1, 1]) prims.push(W([[s * P.headW * 0.7, hy(0.25), hz(0.94)], [s * P.headW * 0.98, hy(-0.05), hz(0.78)], [s * P.headW * 0.96, hy(-0.3), hz(0.64)]], 0.26, 0.14, 0.09, 0.05, [s, 0, 0.3]));
  const h0 = at(rest, 'hair0'), h1 = at(rest, 'hair1');
  prims.push(W([[h0[0], h0[1] + 0.1, h0[2] + H * 0.2], [h1[0], h1[1] - 0.02, h1[2] + H * 0.1], [h1[0], h1[1] - 0.08, h1[2] - H * 0.04]], 0.46, 0.28, 0.12, 0.07, [0, -1, 0], 'hair0', 0 as 0));
  prims.push(W([[h1[0] + H * 0.12, h1[1] - 0.02, h1[2] + H * 0.04], [h1[0] + H * 0.08, h1[1] - 0.08, h1[2] - H * 0.06], [h1[0], h1[1] - 0.12, h1[2] - H * 0.14]], 0.18, 0.09, 0.07, 0.035, [0, -1, 0], 'hair1'));
  // Fine strands close up.
  const strand = (pts: V3[], r0: number, r1: number): Prim => tube(pts, (t) => r0 + (r1 - r0) * t, { m: M.hair, bone: 'head', blend: 0.06, band: BAND_CLOSE, name: 'strand' }, 6);
  prims.push(strand([[-P.headW * 0.35, hy(0.82), hz(0.78)], [-P.headW * 0.5, hy(0.86), hz(0.64)]], H * 0.03, H * 0.012));
  prims.push(strand([[P.headW * 0.45, hy(0.76), hz(0.78)], [P.headW * 0.56, hy(0.78), hz(0.64)]], H * 0.03, H * 0.012));
  prims.push(strand([[-P.headW * 0.05, hy(0.9), hz(0.8)], [-P.headW * 0.12, hy(0.95), hz(0.68)]], H * 0.028, H * 0.01));

  /* ---- neck and torso ---------------------------------------------------------------- */
  const neckJ = at(rest, 'neck'), chestJ = at(rest, 'chest'), spA = at(rest, 'spineA'), pelvisJ = at(rest, 'pelvis');
  prims.push(capsule([neckJ[0], neckJ[1] + 0.05, neckJ[2] - 0.3], [headJ[0], headJ[1] + 0.1, headJ[2] + H * 0.12], P.r.neck, P.r.neck * 0.92, { m: M.skin, bone: 'neck', bone2: 'head', split: { from: neckJ, axis: [0, 0, 1], span: P.headJ + 0.2 }, blend: 0.3, name: 'neck' }));
  const waistZ = spA[2] + 0.2 + 0.25 * f;
  // The shorts, bare: from the hips to mid-thigh; the trousers, clothed: everything below the waist.
  const shortsTop = pelvisJ[2] + 0.3, shortsHem = at(rest, 'hip0')[2] - P.thigh * 0.46;
  const shorts: Stamp = band(shortsHem, shortsTop, M.shorts);
  const shirtAbove: Stamp = bare ? band(shortsTop, 99, M.skin) : band(waistZ, 99, M.shirt);
  const trousersBelow: Stamp = bare ? shorts : band(-99, waistZ, M.trousers);
  const Z = P.chest + P.armAt;
  // The woman's top, bare: a band over the chest and a strap each side over the shoulder, in the shorts' cloth.
  // The bra's cups rise from a V at the sternum to the straps at the outside; its back is a band.
  const braLow = chestJ[2] + Z * 0.22, braBack = chestJ[2] + Z * 0.5;
  const strapAt = (s: number): V3[] => [[s * P.r.chest * 0.55, chestJ[1] + P.r.chest * 0.5, chestJ[2] + Z * 0.86], [s * P.r.chest * 0.62, chestJ[1] + 0.05, neckJ[2] - 0.25], [s * P.r.chest * 0.55, chestJ[1] - P.r.chest * 0.5, braBack]];
  const topBand: Stamp = (p) => {
    const front = p[1] > chestJ[1] + 0.1;
    const x = Math.min(1, Math.abs(p[0]) / (P.r.chest * 0.55));
    const zTop = front ? chestJ[2] + Z * (0.42 + 0.44 * x) : braBack;
    const d = Math.min(p[2] - braLow, zTop - p[2]);
    return d > -STAMP_MARGIN ? { m: M.shorts, d } : undefined;
  };
  const straps: Stamp = firstOf(...[-1, 1].map((s) => curveStamp(strapAt(s), 0.15, M.shorts)));
  const top = (p: Prim): Prim => (bare && woman ? stamped(p, { at: straps }, { at: topBand }) : p);
  if (bare && woman) for (const s of [-1, 1]) prims.push(tube(strapAt(s), () => 0.07, { m: M.shorts, bone: 'chest', blend: 0.05, band: BAND_GAME, name: 'strap' }, 6));
  // The torso: the ribcage a broad egg deepest at the back; the pectorals two planes on its front; the abdomen a block below them
  // down to the waist; the back a V from the shoulders in to the waist with a lat each side under the arm; the waist narrow; the
  // pelvis in the shorts or the trousers.
  const chest = ellipsoid([0, chestJ[1] - 0.1, chestJ[2] + Z * 0.55], [P.r.chest, P.r.chest * 0.62, Z * 0.5], { m: cm(M.shirt), bone: 'chest', blend: 0.4, name: 'chest' });
  prims.push(top(chest));
  // The pectorals, two planes on the ribcage's front; on a woman, two rounds set lower and closer, standing further out.
  const tilt: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0.08], [0, -0.08, 1]];
  for (const s of [-1, 1]) prims.push(top(woman
    ? ellipsoid([s * P.r.chest * 0.42, chestJ[1] + P.r.chest * 0.62, chestJ[2] + Z * 0.46], [P.r.chest * 0.4, P.r.chest * 0.42, P.r.chest * 0.4], { m: cm(M.shirt), bone: 'chest', blend: 0.2, band: 0, name: 'breast' }, tilt)
    : roundBox([s * P.r.chest * 0.5, chestJ[1] + P.r.chest * (0.48 + 0.2 * f), chestJ[2] + Z * 0.55], [P.r.chest * (0.48 - 0.1 * f), P.r.chest * (0.12 + 0.2 * f), Z * 0.22], 0.22, { m: cm(M.shirt), bone: 'chest', blend: 0.15, band: 0, name: 'pectoral' }, tilt)));
  prims.push(roundBox([0, chestJ[1] + P.r.chest * 0.36, chestJ[2] + Z * 0.05], [P.r.waist * 0.62, P.r.chest * 0.16, Z * 0.3], 0.3, { m: cm(M.shirt), bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + Z * 0.2], axis: [0, 0, -1], span: P.chest }, blend: 0.4, name: 'abdomen' }));
  prims.push(top(ellipsoid([0, chestJ[1] - P.r.chest * 0.42, chestJ[2] + Z * 0.62], [P.r.chest * (1.02 - 0.12 * f), P.r.chest * 0.3, Z * 0.42], { m: cm(M.shirt), bone: 'chest', blend: 0.4, name: 'upper back' })));
  for (const s of [-1, 1]) prims.push(top(capsule([s * P.r.chest * (0.98 - 0.08 * f), chestJ[1] - P.r.chest * 0.2, chestJ[2] + Z * 0.48], [s * P.r.waist * 0.72, spA[1] - P.r.waist * 0.25, spA[2] + 0.2], P.r.chest * 0.42 * (1 - 0.4 * f), P.r.waist * 0.3 * (1 - 0.3 * f), { m: cm(M.shirt), bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + Z * 0.3], axis: [0, 0, -1], span: P.chest }, blend: 0.45, name: 'lat' })));
  if (!bare) prims.push(torus([0, neckJ[1], neckJ[2] - 0.18], [0, 0, 1], [1, 0, 0], P.r.neck + 0.06, 0.13, { m: M.shirt, bone: 'chest', blend: 0.15, band: BAND_GAME, name: 'collar' }));
  prims.push(top(capsule([0, chestJ[1] - 0.1, chestJ[2] + Z * 0.3], [0, spA[1], spA[2] + 0.1], P.r.chest * (1.07 - 0.37 * f), P.r.waist * (1.16 - 0.2 * f), { m: cm(M.shirt), bone: 'chest', bone2: 'spineB', split: { from: [0, 0, chestJ[2] + 0.4], axis: [0, 0, -1], span: P.chest }, blend: 0.4, name: 'ribs' })));
  prims.push(stamped(ellipsoid([0, spA[1], spA[2] + 0.1 + 0.25 * f], [P.r.waist, P.r.waist * 0.74, P.spine * 0.9], { m: cm(M.shirt), bone: 'spineA', blend: 0.4, name: 'waist' }), { at: trousersBelow }));
  prims.push(stamped(ellipsoid([0, pelvisJ[1] - 0.05, pelvisJ[2] - 0.55 - 0.5 * f], [P.r.pelvis * (1 - 0.05 * f), P.r.pelvis * (0.78 - 0.1 * f), 1.3 * (1 + 0.15 * f)], { m: bare ? M.shorts : M.trousers, bone: 'pelvis', blend: 0.4, name: 'pelvis' }), { at: shirtAbove }));
  // The hips' rounds, on a woman.
  if (f > 0.3) for (const s of [-1, 1]) {
    prims.push(stamped(sphere([s * P.r.pelvis * 0.72, pelvisJ[1] - 0.1, pelvisJ[2] - 1.5], P.r.pelvis * 0.4 * f, { m: bare ? M.shorts : M.trousers, bone: 'pelvis', blend: 0.35, name: 'hip' }), { at: shirtAbove }));
    prims.push(stamped(sphere([s * P.r.pelvis * 0.4, pelvisJ[1] - P.r.pelvis * 0.42, pelvisJ[2] - 1.55], P.r.pelvis * 0.34 * f, { m: bare ? M.shorts : M.trousers, bone: 'pelvis', blend: 0.3, name: 'seat' }), { at: shirtAbove }));
  }
  if (!bare) prims.push(ellipsoid([0, spA[1] - 0.02, waistZ], [P.r.waist * 1.03, P.r.waist * 0.75, 0.18], { m: M.sole, bone: 'spineA', blend: 0.05, band: BAND_GAME, name: 'waistband' }));

  /* ---- arms and hands ----------------------------------------------------------------- */
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const sh = at(rest, `arm${k}`), el = at(rest, `elbow${k}`), wr = at(rest, `wrist${k}`);
    // The shoulder's round, in the shirt's short sleeve, and the slope of the trapezius from the neck down to it.
    // The deltoid, a round over the shoulder joint; the trapezius sloping from the neck to it.
    const dr = P.r.upper * (1 - 0.2 * f);
    prims.push(ellipsoid(add(sh, [s * 0.15, 0, 0.12]), [dr * 1.15, dr * 1.1, dr * 1.35], { m: cm(M.shirt), bone: `arm${k}`, blend: 0.25, name: 'deltoid' }));
    prims.push(top(capsule([s * 0.5, neckJ[1] - 0.2, neckJ[2] - 0.1], [sh[0] * 0.7, sh[1] - 0.25, sh[2] + 0.35], 0.5 * (1 - 0.25 * f), 0.32 * (1 - 0.25 * f), { m: cm(M.shirt), bone: 'chest', blend: 0.35, name: 'trapezius' })));
    // Upper arm: the sleeve stamped on its top half; a biceps on its front and the arm narrowing to the elbow.
    const axis = unit(sub(el, sh));
    const upper = capsule(sh, el, P.r.upper, P.r.upper * 0.7, { m: M.skin, bone: `arm${k}`, bone2: `elbow${k}`, split: { from: along(sh, el, 0.72), axis, span: P.upper * 0.28 }, blend: 0.22, name: 'upper arm' });
    const alongArm = (p: V3): number => (p[0] - sh[0]) * axis[0] + (p[1] - sh[1]) * axis[1] + (p[2] - sh[2]) * axis[2];
    const sleeve: Stamp = (p) => ({ m: cm(M.shirt), d: P.upper * 0.42 - alongArm(p) });
    const hem: Stamp = (p) => { const t = alongArm(p); return { m: cm(M.trim), d: Math.min(t - P.upper * 0.34, P.upper * 0.42 - t) }; };
    prims.push(bare ? upper : stamped(upper, { at: hem, band: BAND_GAME }, { at: sleeve }));
    prims.push(ellipsoid(add(along(sh, el, 0.48), [0, P.r.upper * 0.3, 0]), [P.r.upper * 0.7, P.r.upper * 0.75, P.upper * 0.3], { m: M.skin, bone: `arm${k}`, blend: 0.3, name: 'biceps' }, [[1, 0, 0], [0, 1, 0], axis]));
    prims.push(sphere(el, P.r.fore * 1.08, { m: M.skin, bone: `elbow${k}`, blend: 0.2, name: 'elbow' }));
    const fl = unit(sub(wr, el));
    prims.push(tube([el, along(el, wr, 0.3), wr], (t) => (t < 0.3 ? P.r.fore * (0.92 + 0.3 * t) : P.r.fore * 1.01 + (P.r.wrist - P.r.fore * 1.01) * ((t - 0.3) / 0.7)), { m: M.skin, bone: `elbow${k}`, bone2: `wrist${k}`, split: { from: along(el, wr, 0.78), axis: fl, span: P.lower * 0.22 }, blend: 0.2, name: 'forearm' }, 8));
    // The hand, in its bones' own frames: a palm block off the wrist, the fingers as one curved group off the knuckles (four fingers
    // close up), the thumb a mass set across from the palm's inner edge.
    const wax = axesOf(`wrist${k}`), fax = axesOf(`fing${k}`);
    const W = P.r.wrist;
    prims.push(roundBox(inBone(`wrist${k}`, [0, 0.05, -P.palm * 0.5]), [W * 0.42, W * 1.02, P.palm * 0.52], 0.18, { m: M.skin, bone: `wrist${k}`, blend: 0.22, name: 'palm' }, wax));
    prims.push(sphere(inBone(`wrist${k}`, [-s * W * 0.25, W * 0.6, -P.palm * 0.3]), W * 0.5, { m: M.skin, bone: `wrist${k}`, blend: 0.25, name: 'thumb mass' }));
    const F = P.finger;
    prims.push(roundBox(inBone(`fing${k}`, [0, 0.05, -F * 0.5]), [W * 0.36, W * 0.98, F * 0.52], 0.17, { m: M.skin, bone: `fing${k}`, blend: 0.14, band: 0, until: BAND_GAME, name: 'fingers' }, fax));
    for (let f = 0; f < 4; f++) {
      const y = (f - 1.5) * W * 0.5 + 0.05;
      const l = F * (f === 1 ? 1 : f === 2 ? 0.96 : f === 0 ? 0.86 : 0.78);
      // The knuckle row curves: the middle fingers start a touch further out.
      const dz = -F * 0.04 * (1.5 - Math.abs(f - 1.5));
      const base = inBone(`fing${k}`, [0, y, dz]), mid = inBone(`fing${k}`, [0, y, dz - l * 0.56]);
      const tip1 = inBone(`fing${k}`, [0, y, dz - l]);
      prims.push(capsule(base, mid, W * 0.24, W * 0.22, { m: M.skin, bone: `fing${k}`, blend: 0.1, band: BAND_CLOSE, name: 'finger' }));
      prims.push(capsule(mid, tip1, W * 0.22, W * 0.17, { m: M.skin, bone: `fing${k}`, blend: 0.1, band: BAND_CLOSE, name: 'fingertip' }));
    }
    prims.push(capsule(inBone(`thumb${k}`, [0, 0, 0.1]), inBone(`thumb${k}`, [0, 0, -F * 0.5]), W * 0.32, W * 0.27, { m: M.skin, bone: `thumb${k}`, blend: 0.18, name: 'thumb' }));
    prims.push(capsule(inBone(`thumb${k}`, [0, 0, -F * 0.5]), inBone(`thumb${k}`, [0, 0, -F * 0.92]), W * 0.26, W * 0.19, { m: M.skin, bone: `thumb${k}`, blend: 0.12, band: BAND_GAME, name: 'thumb tip' }));
  }

  /* ---- legs and feet ------------------------------------------------------------------ */
  for (let k = 0; k < 2; k++) {
    const hip = at(rest, `hip${k}`), knee = at(rest, `knee${k}`), ank = at(rest, `ankle${k}`);
    // The thigh narrows to the knee, the knee's round stands a little proud, the shin swells at the calf and narrows to the ankle.
    const legM = bare ? M.skin : M.trousers;
    const thigh = capsule(add(hip, [0, 0, 0.3]), knee, P.r.thigh, P.r.thigh * (0.52 - 0.06 * f), { m: legM, bone: `hip${k}`, bone2: `knee${k}`, split: { from: along(hip, knee, 0.74), axis: unit(sub(knee, hip)), span: P.thigh * 0.26 }, blend: 0.2, name: 'thigh' });
    prims.push(bare ? stamped(thigh, { at: shorts }) : thigh);
    // The quadriceps on the front of the thigh, and the knee's round standing proud.
    const quad = ellipsoid(add(along(hip, knee, 0.42), [0, P.r.thigh * 0.28, 0]), [P.r.thigh * 0.7, P.r.thigh * 0.8, P.thigh * 0.28], { m: legM, bone: `hip${k}`, blend: 0.25, name: 'quadriceps' }, [[1, 0, 0], [0, 1, 0], unit(sub(hip, knee))]);
    prims.push(bare ? stamped(quad, { at: shorts }) : quad);
    prims.push(sphere(add(knee, [0, 0.05, 0]), P.r.shin * 0.75, { m: legM, bone: `knee${k}`, blend: 0.1, name: 'knee' }));
    prims.push(ellipsoid(add(knee, [0, P.r.shin * 0.62, 0.05]), [P.r.shin * 0.5, P.r.shin * 0.3, P.r.shin * 0.6], { m: legM, bone: `knee${k}`, blend: 0.06, band: BAND_GAME, name: 'kneecap' }));
    const sl = unit(sub(ank, knee));
    prims.push(tube([knee, along(knee, ank, 0.3), add(ank, [0, 0, 0.1])], (t) => (t < 0.3 ? P.r.shin * (0.75 + 1.33 * t) : P.r.shin * 1.15 + (P.r.ankle * 1.05 - P.r.shin * 1.15) * Math.pow((t - 0.3) / 0.7, 1 + 0.6 * f)), { m: legM, bone: `knee${k}`, bone2: `ankle${k}`, split: { from: along(knee, ank, 0.8), axis: sl, span: P.shin * 0.2 }, blend: 0.22, name: 'shin' }, 8));
    prims.push(sphere(ank, P.r.ankle, { m: M.skin, bone: `ankle${k}`, blend: 0.15, name: 'ankle' }));
    // The foot in a soft shoe (or bare): heel and instep off the ankle, the toes off the ball so they bend; a darker sole under.
    const soleStamp: Stamp = (p, n) => ({ m: M.sole, d: Math.max(-0.45 - n[2], 0.14 - p[2]) });
    const foot = roundBox(inBone(`ankle${k}`, [0, P.foot * 0.22, -P.sole * 0.5 + 0.02]), [P.r.ankle * 1.0, P.foot * 0.42, P.sole * 0.5], 0.2, { m: cm(M.shoe), bone: `ankle${k}`, blend: 0.3, name: 'foot' }, axesOf(`ankle${k}`));
    const toes = roundBox(inBone(`toe${k}`, [0, P.foot * 0.2, -0.17]), [P.r.ankle * 1.0, P.foot * 0.26, P.sole * 0.3], 0.18, { m: cm(M.shoe), bone: `toe${k}`, blend: 0.22, name: 'toes' }, axesOf(`toe${k}`));
    prims.push(bare ? foot : stamped(foot, { at: soleStamp }));
    prims.push(bare ? toes : stamped(toes, { at: soleStamp }));
  }
  return modelOf(prims, bodyMaterials(look));
}
