import {
  add, beat, bend, bipedBones, clamp, coatPalette, cross, curve, cyc, darker, disc, drift, eyes, lerp, lighter, merge, mirrored, mix, moved, onEgg,
  orb, orbAlong, paint, pastel, scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { mesh, onScreen, place, type Mat, type Mesh, type Palette, type RGB, type V3, type View } from './figure';
import { blade, cut } from './beastkit';
import { GLYPHS } from './runestone';
import { glower } from './wild-upright';
import { MONSTER_GROWTH } from './monster-size';

/**
 * The goblin, in Runecut's look: three subspecies, one for each of the goblin's variants (`GOBLINS`,
 * `SpeciesDef.subspecies`), the Scrapper, the Raider and the Hexer Goblin. Asked for: "Orc all 3, goblin all 3, ship".
 *
 * Each is the same knee-high body on the same upright bones (two legs, the hips, the chest, a neck and a head, an arm
 * each side, the blade in the right hand) at the same size, with the same health, blow and speed: they differ in look
 * and in how they strike. What is the kit's about them: chunky soft masses, a chalky pastel skin lit in three steps,
 * gear in the island's own iron, brass, hide and bone, the runes of the runestones cut into what they carry -- gold,
 * mint or red -- and a strike each of its own, with a pale slash through the air where the blade went.
 *
 *   A, the Scrapper Goblin: wiry and hunched, a ragged top-knot, notched ears and a brass ring through one, a patched
 *      tunic too big for it with a ragged hem on a rope belt with a bone charm and a pouch, a strap of dark hide across
 *      it, bandaged wrists and ankles, and a broad notched cleaver with gold runes scratched down its flat, held out
 *      before it; it chops overhead, and the edge throws gold sparks.
 *   B, the Raider Goblin: a plum hood with a drooping point and a short cape, its ears out through the hood, a round
 *      hide shield painted with a red rune held up on its left arm and a curved blade in its right; it sweeps the
 *      blade across from over the shield, turning through the blow.
 *   C, the Hexer Goblin: low and long-armed, darker of skin, mint eyes, a horned skull worn on its head with two
 *      feathers, mint runes painted on its face, chest, back and wrists, a necklace of teeth with a rune-stone hung
 *      from it, a kilt of hide and bone strips, and a hooked knife of mint glass; it lunges and stabs, and the knife
 *      flashes a mint star.
 *
 * Kept clear of itself: every arm and blade path through a strike, a standing loop, a walk and a run was searched a
 * twentieth at a time for none of it inside the head or the body (`tools/goblin-shot.mjs --frames` draws them); a
 * blade or an arm raised past the head from behind is hidden by it; each limb is rounded over at its joint; the tunic
 * and the jerkin below the belt go over the thighs, and the Raider's cape over its back.
 */

/* ---- small things -------------------------------------------------------------------- */

/** The corners of a flat shape, in the order that makes it face out along `n`. */
function outward(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}

/** A face's own frame on a surface facing `n`: across it and up it, `up` being the way that is up as near as the surface allows. */
function frameOn(n: V3, up: V3): { u: V3; w: V3 } {
  let u = cross(up, n);
  if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = cross([0, 1, 0], n);
  u = unit(u);
  return { u, w: unit(cross(n, u)) };
}

/**
 * A rune of the runestones' (`GLYPHS`) painted on a flat face at `c` facing `n`, `s` from its middle to its top, each
 * stroke `w` thick: an open stroke one decal along the whole of it, mitred at its bends, and a closed one a decal for each
 * of its sides. `lit`, it is drawn in its full light whichever way it faces.
 */
function rune(name: string, c: V3, n: V3, up: V3, s: number, w: number, m: Mat, lit = true): Disc[] {
  const { u, w: v } = frameOn(n, up);
  const at = (x: number, y: number): V3 => add(add(c, scale(u, x * s)), scale(v, y * s));
  const out: Disc[] = [];
  const band = (pts: V3[]): void => {
    const K = pts.length, left: V3[] = [], right: V3[] = [];
    for (let q = 0; q < K; q++) {
      const d0 = q > 0 ? unit(sub(pts[q], pts[q - 1])) : null, d1 = q < K - 1 ? unit(sub(pts[q + 1], pts[q])) : null;
      const d = unit(add(d0 ?? d1!, d1 ?? d0!));
      // Pushed out square to the line's way at this corner, further at a bend so the stroke keeps its width.
      const along = d0 && d1 ? Math.max(0.5, d0[0] * d[0] + d0[1] * d[1] + d0[2] * d[2]) : 1;
      const side = scale(unit(cross(n, d)), w / along);
      // Each end carried a little past its point, so a stroke's end is square across it rather than a point.
      const p = q === 0 ? sub(pts[q], scale(d, w * 0.6)) : q === K - 1 ? add(pts[q], scale(d, w * 0.6)) : pts[q];
      left.push(add(p, side));
      right.push(sub(p, side));
    }
    out.push({ v: outward([...left, ...right.reverse()], n), m, lit });
  };
  for (const st of GLYPHS[name] ?? []) {
    const pts = st.pts.map(([x, y]) => at(x, y));
    if (!st.closed) band(pts);
    else for (let q = 0; q < pts.length; q++) band([pts[q], pts[(q + 1) % pts.length]]);
  }
  return out;
}

/** A closed ring of tube round a line through `c` along `axis`, `r` across and `w` thick: an earring, a belt, a band. */
function hoop(c: V3, axis: V3, r: number, w: number, n: number, m: Mat, sides = 4): Mesh {
  const { u, w: v } = frameOn(unit(axis), [0, 0, 1]);
  const pts = Array.from({ length: n + 1 }, (_, q) => add(c, add(scale(u, Math.cos((q / n) * TAU) * r), scale(v, Math.sin((q / n) * TAU) * r))));
  return tube(pts, w, w, sides, m, { start: false, end: false });
}

/** Only the faces of a mesh whose material says so, and those faces given another. */
function only(m: Mesh, keep: (mat: Mat) => Mat | null): Mesh {
  const f = [] as Mesh['f'];
  for (const face of m.f) {
    const to = keep(face.m);
    if (to) f.push({ ...face, m: to });
  }
  return mesh(m.v, f);
}

/** The same mesh turned inside out: the inside of a hood or a cape, seen past its edge. */
const insideOut = (m: Mesh): Mesh => mesh(m.v, m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- a look, as numbers ---------------------------------------------------------------- */

type Look = 'A' | 'B' | 'C';

interface Gob {
  look: Look;
  spec: BipedSpec;
  head: { c: V3; r: V3 };
  /** The way out of the head to the right eye; its size; how tall. */
  eye: { dir: V3; size: number; tall: number; pupil: number; iris?: Mat };
  /** The ear's root, bend and tip out of the head's middle (right side); its widths along it; a notch bitten from it. */
  ear: { root: V3; mid: V3; tip: V3; w: number[]; notch?: boolean; ring?: boolean };
  /** The nose: how long, how far it hooks down. */
  nose: { len: number; r: number; hook: number };
  /** Widths of the arm and leg tubes; the hand's and the foot's sizes. */
  armW: [number, number];
  legW: [number, number];
  hand: number;
  foot: [number, number];
}

/** The live goblin's bones, which every look keeps to within a few degrees. */
const BASE_SPEC: BipedSpec = {
  high: 1.0,
  leg: { at: [0.34, 0, -0.1], len: [0.46, 0.46, 0.1], rest: [16, -32] },
  chest: { at: [0, 0, 0.18], lean: 20 },
  neck: { at: [0, 0.12, 1.02], len: 0.2, lean: 0 },
  head: { pitch: -8 },
  arm: { at: [0.68, 0.1, 0.8], len: [0.5, 0.5], rest: [10, 16, 30] },
  swing: [32, 46],
  waddle: 6,
  armSwing: 24,
};

const LOOKS: Record<Look, Gob> = {
  A: {
    look: 'A',
    spec: { ...BASE_SPEC, chest: { at: [0, 0, 0.18], lean: 24 }, head: { pitch: 0 } },
    head: { c: [0, 0.16, 0.6], r: [0.98, 0.9, 0.82] },
    eye: { dir: [0.64, 0.74, 0.16], size: 0.29, tall: 1.0, pupil: 0.3 },
    ear: { root: [0.7, -0.05, 0.25], mid: [1.18, -0.42, 0.5], tip: [1.78, -1.0, 0.86], w: [0.36, 0.36, 0.28, 0.14, 0.01], notch: true, ring: true },
    nose: { len: 0.5, r: 0.16, hook: 0.2 },
    armW: [0.18, 0.17], legW: [0.22, 0.19], hand: 0.23, foot: [0.23, 0.6],
  },
  B: {
    look: 'B',
    spec: { ...BASE_SPEC, chest: { at: [0, 0, 0.18], lean: 18 }, head: { pitch: -2 }, waddle: 4 },
    head: { c: [0, 0.14, 0.58], r: [0.94, 0.88, 0.82] },
    eye: { dir: [0.62, 0.76, 0.12], size: 0.27, tall: 0.92, pupil: 0.26 },
    ear: { root: [0.74, -0.08, 0.22], mid: [1.3, -0.24, 0.22], tip: [1.9, -0.5, 0.16], w: [0.32, 0.31, 0.24, 0.12, 0.01], ring: true },
    nose: { len: 0.46, r: 0.15, hook: 0.14 },
    armW: [0.19, 0.18], legW: [0.23, 0.2], hand: 0.22, foot: [0.23, 0.56],
  },
  C: {
    look: 'C',
    spec: {
      ...BASE_SPEC, high: 0.92, leg: { at: [0.36, 0, -0.1], len: [0.44, 0.44, 0.1], rest: [22, -42] }, chest: { at: [0, 0, 0.18], lean: 32 }, head: { pitch: -2 },
      neck: { at: [0, 0.14, 1.0], len: 0.2, lean: 6 }, arm: { at: [0.66, 0.1, 0.8], len: [0.58, 0.56], rest: [14, 18, 34] }, waddle: 8, armSwing: 20,
    },
    head: { c: [0, 0.16, 0.56], r: [0.96, 0.9, 0.8] },
    eye: { dir: [0.62, 0.76, 0.1], size: 0.32, tall: 0.95, pupil: 0.24, iris: 'water' },
    ear: { root: [0.72, -0.06, 0.2], mid: [1.22, -0.44, 0.32], tip: [1.82, -0.96, 0.36], w: [0.36, 0.36, 0.27, 0.13, 0.01], notch: true },
    nose: { len: 0.58, r: 0.15, hook: 0.3 },
    armW: [0.16, 0.15], legW: [0.2, 0.17], hand: 0.24, foot: [0.22, 0.6],
  },
};

/* ---- the body every look has ------------------------------------------------------------- */

/** A hand: a palm and three fingers fanned forward and down from it, clawed at the tips. */
function hand(r: number, n: number, mat: Mat = 'coat'): Mesh {
  const len = r * 1.2;
  return merge(
    orbAlong([0, r * 0.3, -r * 0.4], [0, 0.4, -1], [r * 0.95, r * 0.8, r], n - 4, 3, mat),
    ...[0, 1, 2].map((q) => {
      const a = (q / 2 - 0.5) * 0.9;
      const root: V3 = [Math.sin(a) * r * 0.6, r * 0.55, -r * 0.9];
      const mid = add(root, [Math.sin(a) * len * 0.35, len * 0.35, -len * 0.4]), tip = add(root, [Math.sin(a) * len * 0.6, len * 0.45, -len * 0.95]);
      return taper([0, 0.6, 1].map((t) => bend(root, mid, tip, t)), r * 0.26, r * 0.12, 4, (ring) => (ring >= 1 ? 'claw' : mat));
    }),
  );
}

/** A long bare foot, three toes at its end. */
function foot(r: number, len: number, n: number, mat: Mat = 'coat'): Mesh {
  return merge(
    orbAlong([0, len * 0.3, -r * 0.55], [0, 1, 0], [r * 1.05, len * 0.6, r * 0.6], n - 3, 4, mat),
    ...[-1, 1].map((s) => orbAlong([s * r * 0.45, len * 0.8, -r * 0.7], [s * 0.2, 1, -0.2], [r * 0.4, r * 0.42, r * 0.32], 4, 3, mat)),
  );
}

/**
 * One part of a limb down its bone from the joint: rounded over at the top, so bent away from what it hangs from it shows
 * a knuckle of itself and not a hole, `len` long, `w` across at the joint, half way and the end; open at the end, where
 * the next part goes on. `mat` is each band's, `ring` nought for the first below the joint.
 */
function limbPart(len: number, w: [number, number, number], n: number, mat: (ring: number) => Mat): Mesh {
  return tube([[0, 0, w[0] * 0.8], [0, 0, w[0] * 0.35], [0, 0, 0], [0, 0, -len * 0.45], [0, 0, -len]], [w[0] * 0.5, w[0] * 0.9, w[0], w[1], w[2]],
    [w[0] * 0.5, w[0] * 0.9, w[0], w[1], w[2]], n, (ring) => mat(Math.max(0, ring - 2)), { seam: 'end' });
}

/** Arms and legs on the upright bones, each tube's band made of what `armMat`/`legMat` say (`ring` nought at the joint). */
function limbs(s: Gob, n: number, o: { arm?: (part: 0 | 1, ring: number) => Mat; leg?: (part: 0 | 1, ring: number) => Mat; handMat?: Mat; footMat?: Mat }): Piece[] {
  const S = s.spec, out: Piece[] = [];
  const armMat = o.arm ?? (() => 'coat'), legMat = o.leg ?? (() => 'coat');
  const h = hand(s.hand, n, o.handMat), f = foot(s.foot[0], s.foot[1], n, o.footMat);
  // Thin enough that eight round is as round as ten.
  const m = n - 2;
  // Raised past the head, what of an arm is behind it is hidden by it.
  const hide = [{ c: s.head.c, r: scale(s.head.r, 0.97) }];
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    const [a0, a1] = S.arm.len, [w0, w1] = s.armW;
    out.push(
      { key: `arm${k}`, mesh: limbPart(a0, [w0 * 1.08, w0, w0 * 0.92], m, (ring) => armMat(0, ring)), bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: true, hide, hideIn: 'head' },
      { key: `fore${k}`, mesh: limbPart(a1, [w1, w1 * 1.04, w1 * 0.9], m, (ring) => armMat(1, ring)), bone: `elbow${k}`, bias: 0.035, after: 'body', front, convex: true, hide, hideIn: 'head' },
      { key: `hand${k}`, mesh: sd < 0 ? mirrored(h) : h, bone: `hand${k}`, bias: 0.04, after: 'body', front, hide, hideIn: 'head' },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    const [l0, l1] = S.leg.len, [w0, w1] = s.legW;
    out.push(
      { key: `${key}0`, mesh: limbPart(l0, [w0 * 1.1, w0, w0 * 0.9], m, (ring) => legMat(0, ring)), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front, convex: true },
      { key: `${key}1`, mesh: limbPart(l1, [w1, w1 * 0.95, w1 * 0.85], m, (ring) => legMat(1, ring)), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(f) : f, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/**
 * The face: big glowering eyes, a long hooked nose, and a wide grin cut right across the lower face -- a dark mouth
 * with a row of teeth hung from its top and a fang up from each corner. In the head's frame.
 */
function face(s: Gob, n: number, k: number): { skull: Mesh; face: Mesh; look: (shut: boolean) => Mesh; brows: Mesh } {
  const H = s.head, E = s.eye;
  const skull = merge(
    orb(H.c, H.r, n, k + 1, 'coat'),
    // Cheeks and a jaw a little out past the skull's egg, so the grin has somewhere to sit and the face is wider low down.
    orb(add(H.c, [0, H.r[1] * 0.42, -H.r[2] * 0.36]), [H.r[0] * 0.8, H.r[1] * 0.56, H.r[2] * 0.5], n - 3, k - 1, 'coat'),
  );
  const { lids, brows } = glower(H.c, H.r, E.dir, E.size, { tall: E.tall, drop: 0.44, slope: 0.36, brow: 0.085 });
  // The nose: out of the face between the eyes and down, hooked at its end.
  const N = s.nose, root = add(H.c, [0, H.r[1] * 0.86, -H.r[2] * 0.02]);
  const tip = add(root, [0, N.len, -N.hook - N.len * 0.25]), midN = add(root, [0, N.len * 0.75, 0.06]);
  const nose = taper(curve(root, midN, tip, 4), N.r, N.r * 0.32, 6, 'coat');
  // The mouth, on the lower egg (the jaw's): its top edge a wide smile, its bottom further down in the middle.
  const J = { c: add(H.c, [0, H.r[1] * 0.42, -H.r[2] * 0.36]), r: [H.r[0] * 0.8, H.r[1] * 0.56, H.r[2] * 0.5] as V3 };
  const N8 = 8, spread = 0.82;
  const topAt = (f: number): { p: V3; n: V3 } => onEgg(J.c, J.r, [Math.sin(f * spread), Math.cos(f * spread) * 0.95, -0.08 + 0.34 * f * f]);
  const lowAt = (f: number): { p: V3; n: V3 } => onEgg(J.c, J.r, [Math.sin(f * spread) * 0.92, Math.cos(f * spread) * 0.95, -0.4 + 0.66 * f * f]);
  const fs = Array.from({ length: N8 + 1 }, (_, q) => -1 + (2 * q) / N8);
  const lift = (o: { p: V3; n: V3 }, d: number): V3 => add(o.p, scale(o.n, d));
  const mouthV = [...fs.map((f) => lift(topAt(f), 0.02)), ...fs.slice(1, -1).reverse().map((f) => lift(lowAt(f), 0.02))];
  const mid = onEgg(J.c, J.r, [0, 1, -0.2]);
  const marks: Disc[] = [{ v: outward(mouthV, mid.n), m: 'nose' }];
  // Teeth hung from the top edge, the two middle ones longest, a gap where one is missing.
  const teeth: Array<[number, number]> = s.look === 'C' ? [[-0.5, 0.15], [-0.18, 0.2], [0.14, 0.2], [0.46, 0.14]] : [[-0.56, 0.13], [-0.3, 0.17], [-0.06, 0.2], [0.42, 0.16], [0.64, 0.12]];
  for (const [f, len] of teeth) {
    const a = topAt(f - 0.08), b = topAt(f + 0.08), o = topAt(f);
    const down = unit(sub(lowAt(f).p, o.p));
    marks.push({ v: outward([lift(a, 0.03), lift(b, 0.03), add(lift(o, 0.03), scale(down, len))], o.n), m: 'tooth' });
  }
  // A fang up from each corner of the jaw, out over the lip.
  for (const f of [-0.7, 0.7]) {
    const o = lowAt(f), up = unit(sub(topAt(f).p, o.p)), along = unit(sub(lowAt(f + 0.1).p, lowAt(f - 0.1).p));
    marks.push({ v: outward([lift(o, 0.035), add(lift(o, 0.035), scale(along, 0.11)), add(add(lift(o, 0.035), scale(along, 0.04)), scale(up, 0.22))], o.n), m: 'tooth' });
  }
  const look = (shut: boolean): Mesh => merge(eyes(H.c, H.r, E.dir, E.size, { tall: E.tall, shut, iris: E.iris ?? 'bloom', pupil: E.pupil, rim: 0, glint: 0.3 }), lids);
  return { skull, face: merge(nose, paint(marks)), look, brows };
}

/** An ear, long and pointed and swept out from the side of the head, pink inside; notched, and ringed in brass, if the look says. */
function ear(s: Gob, side: number, n: number): Mesh {
  const H = s.head, E = s.ear;
  const at = (p: V3): V3 => add(H.c, [side * p[0], p[1], p[2]]);
  const root = at(E.root), mid = at(E.mid), tip = at(E.tip);
  const along = unit(sub(tip, root)), up: V3 = [side * 0.45, 0.35, 0.82];
  const facing = unit(sub(up, scale(along, along[0] * up[0] + along[1] * up[1] + along[2] * up[2])));
  const thick = [0.16, 0.15, 0.12, 0.07, 0.01];
  // A bite out of the edge two thirds of the way out: the width there dips.
  const w = E.notch && side > 0 ? [E.w[0], E.w[1], E.w[2] * 0.62, E.w[3] * 1.2, E.w[4]] : E.w;
  const lift = thick[1] + (thick[2] - thick[1]) * 0.6 + 0.01;
  const out: Mesh[] = [
    tube(curve(root, mid, tip, 4), w, thick, n, 'coat', { up }),
    paint([disc(add(bend(root, mid, tip, 0.4), scale(facing, lift)), facing, E.w[1] * 0.92, 0.15, 6, 'inner', { up: cross(facing, along) })]),
  ];
  if (E.ring && side < 0) out.push(hoop(bend(root, mid, tip, 0.58), facing, 0.13, 0.035, 6, 'crystal', 3));
  return merge(...out);
}

/* ---- each look's gear --------------------------------------------------------------------- */

/** Where along the blade arm's hand each look's blade is held, and how it is turned (`moved`). */
const GRIP: Record<Look, { at: V3; yaw: number; pitch: number; roll: number }> = {
  A: { at: [0, 0.1, -0.12], yaw: -58, pitch: -50, roll: 0 },
  B: { at: [0, 0.1, -0.12], yaw: -50, pitch: -50, roll: 0 },
  C: { at: [0, 0.08, -0.12], yaw: -6, pitch: -84, roll: 0 },
};


/** Edge profiles along the blade: how far along, and how far out from the back the edge is. */
const CLEAVER: Array<[number, number]> = [[0.08, 0.26], [0.3, 0.36], [0.5, 0.38], [0.6, 0.2], [0.68, 0.38], [0.9, 0.4], [1.0, 0.24], [1.08, 0.38], [1.24, 0.38], [1.34, 0.12]];

function bladeA(n: number): Mesh {
  // A broad cleaver of iron, its back straight, two notches bitten out of its edge and the edge ground bright; gold runes
  // scratched down both flats; a grip bound in rag, a brass ring for a guard.
  const back = -0.16;
  const body = blade(CLEAVER.map(([y, e]) => [0, y, (e + back) / 2] as V3), CLEAVER.map(([, e]) => (e - back) / 2), [1, 0, 0], { mat: 'stone', rib: 'stoneDark', fold: 0.03, thick: 0.07 });
  const EDGE = [CLEAVER[0], CLEAVER[2], CLEAVER[4], CLEAVER[5], CLEAVER[7], CLEAVER[8]];
  const edge = blade(EDGE.map(([y, e]) => [0, y, e - 0.045] as V3), EDGE.map(() => 0.045), [1, 0, 0], { mat: 'spot', fold: 0, thick: 0.085 });
  const runes: Disc[] = [];
  for (const sd of [1, -1]) {
    const nn: V3 = [sd, 0, 0];
    runes.push(...rune('kenaz', [sd * 0.045, 0.42, 0.08], nn, [0, 1, 0], 0.09, 0.022, 'flame'), ...rune('thurisaz', [sd * 0.045, 0.82, 0.1], nn, [0, 1, 0], 0.1, 0.022, 'flame'));
  }
  return merge(
    body, edge, paint(runes),
    tube([[0, 0.04, -0.17], [0, 0.04, 0.2]], 0.055, 0.055, 4, 'crystal'),
    tube([[0, 0.02, 0], [0, -0.14, 0], [0, -0.3, 0]], 0.065, 0.065, 5, (ring) => (ring === 1 ? 'muzzle' : 'leatherDark')),
    orb([0, -0.33, 0], 0.075, 5, 3, 'crystal'),
  );
}

function bladeB(n: number): Mesh {
  // A curved blade, a scimitar's, broad toward its point and its back curving up; the edge ground bright; a brass guard.
  const pts = curve([0, 0.05, 0], [0, 0.75, -0.02], [0, 1.32, 0.3], 6);
  const ws = [0.1, 0.13, 0.15, 0.17, 0.17, 0.13, 0.02];
  const body = blade(pts, ws, [1, 0, 0], { mat: 'stone', rib: 'stoneDark', fold: 0.03, thick: 0.06 });
  // The edge along the bottom of the curve.
  const edgePts = pts.slice(0, -1).map((p, q) => add(p, [0, 0.02, -ws[q] + 0.035]));
  const edge = blade(edgePts, ws.slice(0, -1).map(() => 0.035), [1, 0, 0], { mat: 'spot', fold: 0, thick: 0.075 });
  return merge(
    body, edge,
    tube([[-0.0, 0.03, -0.18], [0, 0.03, 0.2]], 0.05, 0.05, 5, 'crystal'),
    tube([[0, 0.02, 0], [0, -0.28, 0]], 0.06, 0.06, 5, 'leatherDark'),
    orb([0, -0.31, 0], 0.07, 6, 3, 'crystal'),
  );
}

function bladeC(n: number): Mesh {
  // A hooked knife of mint glass, its edge a paler mint, on a hilt of bone bound in hide, a tooth for a pommel.
  const pts = curve([0, 0.04, 0], [0, 0.62, 0.0], [0, 0.96, 0.24], 5);
  const ws = [0.08, 0.12, 0.13, 0.12, 0.08, 0.02];
  return merge(
    blade(pts, ws, [1, 0, 0], { mat: 'water', rib: 'crystalDark', fold: 0.05, thick: 0.06 }),
    blade(pts.slice(0, -1).map((p, q) => add(p, [0, 0.01, -ws[q] + 0.03])), ws.slice(0, -1).map(() => 0.03), [1, 0, 0], { mat: 'glint', fold: 0, thick: 0.07 }),
    tube([[0, 0.03, 0], [0, -0.12, 0], [0, -0.3, 0]], [0.07, 0.06, 0.065], [0.07, 0.06, 0.065], 5, (ring) => (ring === 1 ? 'leatherDark' : 'horn')),
    taper([[0, -0.3, 0], [0, -0.42, -0.06]], 0.06, 0.01, 5, 'tooth'),
  );
}

/** A blade put in the hand as the look holds it. */
function held(s: Gob, n: number): Mesh {
  const g = GRIP[s.look], m0 = s.look === 'A' ? bladeA(n) : s.look === 'B' ? bladeB(n) : bladeC(n);
  const k = s.look === 'A' ? 1.18 : s.look === 'B' ? 1.08 : 1.05, m = mesh(m0.v.map((p) => scale(p, k)), m0.f);
  return moved(m, g.at, g.yaw, g.pitch, g.roll);
}
/** The blade's tip in the hand's frame. */
const tips = new Map<Look, V3>();
function tipInHand(s: Gob): V3 {
  const had = tips.get(s.look);
  if (had) return had;
  // The corner of the held blade furthest along it from the grip.
  const g = GRIP[s.look], v = held(s, 6).v;
  const along = moved(mesh([[0, 1, 0]], []), [0, 0, 0], g.yaw, g.pitch, g.roll).v[0];
  let best = v[0], most = -Infinity;
  for (const p of v) {
    const d = (p[0] - g.at[0]) * along[0] + (p[1] - g.at[1]) * along[1] + (p[2] - g.at[2]) * along[2];
    if (d > most) { most = d; best = p; }
  }
  tips.set(s.look, best);
  return best;
}
/* ---- each look, built ----------------------------------------------------------------------- */

function buildGob(s: Gob, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = s.head, hide = [{ c: H.c, r: H.r }];
  const F = face(s, n, k);
  const pieces: Piece[] = [];
  const headExtra: Mesh[] = [];
  // What is worn on the head and hung on the chest, in the head's and the body's pieces.
  const crown: Mesh[] = [];
  const worn: Mesh[] = [];
  let ears: Piece[] = [
    { key: 'ear0', mesh: ear(s, -1, n), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ear(s, 1, n), bone: 'head', bias: 0.21, after: 'head', hide },
  ];
  let body: Mesh;
  let hips: Mesh;
  let arm: ((part: 0 | 1, ring: number) => Mat) | undefined;
  let leg: ((part: 0 | 1, ring: number) => Mat) | undefined;
  // The tunic or jerkin below the belt, drawn over the tops of the thighs from every side, as the Hexer's kilt is.
  let skirt: Mesh | undefined;
  if (s.look === 'A') {
    // A tunic too big for it, of a hide gone pale, with a mint patch stitched on its chest and another on its back, a rope belt
    // with a bone charm and a pouch hung off it; a top-knot of dark hair tied in a brass ring.
    // The tunic above the belt on the body; below it, a piece of its own (\`skirt\`) over the thighs, its hem ragged: every other
    // corner of the bottom ring drawn up and in.
    const tunic = tube([[0, 0.03, 0.02], [0, 0.04, 0.55], [0, 0.02, 0.95], [0, 0, 1.12]], [0.74, 0.68, 0.56, 0.32], [0.66, 0.6, 0.5, 0.3], n, 'leather', { up: [0, 1, 0], start: false });
    const hem = tube([[0, 0, -0.46], [0, 0.03, 0.1]], [0.72, 0.745], [0.64, 0.665], n, 'leather', { up: [0, 1, 0], start: false, end: false });
    const patches: Disc[] = [
      disc([0.24, 0.66, 0.58], [0.3, 1, 0.05], 0.2, 0.17, 4, 'petal', { spin: 0.25 }),
      disc([-0.2, -0.6, 0.4], [-0.3, -1, 0], 0.22, 0.2, 4, 'leatherDark', { spin: 0.6 }),
    ];
    const belt = tube([[0, 0.02, 0.08], [0, 0.02, 0.2]], 0.78, 0.7, n, 'bark', { up: [0, 1, 0] });
    const hung = merge(
      orb([0.3, 0.68, 0.14], [0.11, 0.08, 0.09], 5, 3, 'bark'),
      // The bone charm, a fang hung off the knot.
      taper([[0.33, 0.72, 0.06], [0.36, 0.76, -0.16], [0.3, 0.74, -0.3]], 0.05, 0.015, 5, 'horn'),
      // The pouch, on the left hip.
      orbAlong([-0.68, 0.18, -0.05], [0, 0, 1], [0.17, 0.15, 0.2], 6, 3, 'leatherDark'),
    );
    // A strap of dark hide across it from the right hip over the left shoulder, a scabbard's that has lost its scabbard.
    const strap = tube([[0.52, 0.5, 0.2], [0.06, 0.68, 0.6], [-0.36, 0.52, 0.98], [-0.44, 0, 1.14], [-0.34, -0.52, 0.95], [0.1, -0.64, 0.55], [0.52, -0.52, 0.2]], 0.075, 0.035, 4, 'leatherDark', { start: false, end: false });
    body = merge(tunic, paint(patches), belt, strap);
    skirt = merge(mesh(hem.v.map((p, q) => (q < n && q % 2 === 1 ? [p[0] * 0.9, p[1] * 0.9, p[2] + 0.2] as V3 : p)), hem.f),
      paint([disc([-0.36, 0.58, -0.18], [-0.5, 1, -0.1], 0.13, 0.1, 5, 'leatherDark')]), hung);
    hips = orb([0, 0, 0], [0.56, 0.48, 0.44], n - 2, k - 1, 'leatherDark');
    // Rag wound round each forearm, two bands of it.
    arm = (part, ring) => (part === 1 && (ring === 1 || ring === 2) ? 'muzzle' : 'coat');
    leg = (part, ring) => (part === 1 && ring === 1 ? 'muzzle' : 'coat');
    // The top-knot: three locks swept up and back from the crown, tied at their root.
    const top = add(H.c, [0, -0.2, H.r[2] * 0.92]);
    crown.push(
      ...[[-0.2, -0.4], [0.05, -0.55], [0.26, -0.36]].map(([x, y]) => taper(curve(top, add(top, [x * 0.6, y * 0.4, 0.46]), add(top, [x * 1.4, y * 1.4, 0.6]), 2), 0.15, 0.02, 5, 'hair')),
      hoop(add(top, [0, -0.04, 0.14]), [0, -0.3, 1], 0.13, 0.045, 6, 'crystal', 4),
    );
  } else if (s.look === 'B') {
    // A plum hood over the head with a drooping point, ears out through it; a short cape off the shoulders; a hide jerkin
    // under it, a sash of mint at the waist; leather wraps on the forearms and the shins.
    // The jerkin above the sash on the body, and below it a piece of its own over the thighs (\`skirt\`).
    const jerk = tube([[0, 0.03, 0.05], [0, 0.04, 0.55], [0, 0.02, 0.95], [0, 0, 1.12]], [0.72, 0.68, 0.56, 0.32], [0.64, 0.6, 0.5, 0.3], n, 'leather', { up: [0, 1, 0], start: false });
    const sash = tube([[0, 0.02, 0.1], [0, 0.02, 0.24]], 0.77, 0.69, n, 'petal', { up: [0, 1, 0] });
    skirt = merge(
      tube([[0, 0, -0.38], [0, 0.03, 0.12]], [0.66, 0.725], [0.6, 0.645], n, 'leather', { up: [0, 1, 0], start: false, end: false }),
      taper([[-0.46, 0.5, 0.14], [-0.5, 0.56, -0.12], [-0.46, 0.52, -0.34]], 0.1, 0.06, 4, 'petal'),
    );
    // The cape: the back two thirds of a ring round the shoulders, flaring down to the hips, plum without and darker within.
    const ringsZ = [1.08, 0.86, -0.3], ringsW = [0.52, 0.8, 0.98], ringsH = [0.42, 0.66, 0.82], ringsY = [-0.02, -0.06, -0.2];
    const nn = n + 2;
    const whole = tube(ringsZ.map((z, q) => [0, ringsY[q], z] as V3), ringsW, ringsH, nn, (_r, j) => {
      const a = ((j + 1) / nn) * TAU;
      // Facet j's middle is at angle a from the +x axis toward +y (the front): kept where it is round the back.
      return Math.sin(a) < 0.25 ? 'cap' : 'glint';
    }, { up: [0, 1, 0], start: false, end: false });
    // The ring is wound facing in (its rings run down), so its outside is the ring turned inside out.
    const cape = only(insideOut(whole), (m) => (m === 'cap' ? 'cap' : null));
    const lining = only(whole, (m) => (m === 'cap' ? 'membrane' : null));
    // Over the body and the jerkin's skirt seen from behind, under them from in front; the hood over it (`hood`).
    pieces.push({ key: 'cape', mesh: merge(cape, lining), bone: 'chest', bias: 0.02, after: ['body', 'skirt'], front: [0, -1, 0] });
    body = merge(jerk, sash);
    hips = orb([0, 0, 0], [0.6, 0.52, 0.48], n - 2, k - 1, 'leatherDark');
    arm = (part, ring) => (part === 1 && ring >= 1 ? 'leatherDark' : 'coat');
    leg = (part, ring) => (part === 1 && ring >= 1 ? 'leatherDark' : 'coat');
    // The hood: an egg a little bigger than the skull, open at the face, and its point drooping down the back.
    const back = H.c[1] - H.r[1] * 1.1, front = H.c[1] + H.r[1] * 0.52;
    const ys = [back, H.c[1] - H.r[1] * 0.68, H.c[1] - H.r[1] * 0.05, front];
    const prof = ys.map((y) => Math.sqrt(Math.max(0.04, 1 - ((y - H.c[1]) / (H.r[1] * 1.12)) ** 2)));
    const hood = tube(ys.map((y) => [0, y, H.c[2] + 0.1] as V3), prof.map((p) => p * H.r[0] * 1.1), prof.map((p) => p * H.r[2] * 1.16), n,
      'cap', { up: [0, 0, 1], end: false });
    const point = taper(curve(add(H.c, [0, -H.r[1] * 0.9, H.r[2] * 0.7]), add(H.c, [0, -H.r[1] * 1.5, H.r[2] * 0.85]), add(H.c, [0.1, -H.r[1] * 2.0, H.r[2] * 0.25]), 3), 0.3, 0.03, 6, 'cap');
    pieces.push({ key: 'hood', mesh: merge(hood, point), bone: 'head', bias: 0.205, after: ['head', 'cape'] });
    // The ears out through the hood: what of them is inside it hidden by it.
    const hoodSolid = [{ c: [0, H.c[1] - 0.12, H.c[2] + 0.14] as V3, r: [H.r[0] * 1.06, H.r[1] * 1.06, H.r[2] * 1.14] as V3 }];
    ears = ears.map((e) => ({ ...e, after: ['head', 'hood'], hide: hoodSolid }));
    // The shield on the left forearm, its face out and forward: hide on a rim of iron, a red rune painted on it, an iron boss.
    const R = 0.62;
    const shield = merge(
      tube([[0, 0, 0], [-0.1, 0, 0]], R, R, 10, 'stone', { up: [0, 0, 1] }),
      tube([[-0.1, 0, 0], [-0.13, 0, 0]], R * 0.86, R * 0.86, 10, 'shell', { up: [0, 0, 1], start: false }),
      orbAlong([-0.13, 0, 0], [-1, 0, 0], [0.17, 0.17, 0.1], 5, 3, 'stone'),
      paint([
        ...rune('algiz', [-0.135, 0, 0.02], [-1, 0, 0], [0, 0, 1], 0.42, 0.06, 'ember', false),
        ...[0, 1, 2, 3, 4, 5].map((q) => disc(add([-0.105, 0, 0], [0, Math.cos((q / 6) * TAU + 0.5) * R * 0.93, Math.sin((q / 6) * TAU + 0.5) * R * 0.93]), [-1, 0, 0], 0.04, 0.04, 4, 'spot', { lit: true })),
      ]),
    );
    pieces.push({ key: 'shield', mesh: moved(moved(shield, [0, 0, 0], 0, 0, -55), [-0.32, 0.1, -0.1], 0, 0, 0), bone: 'elbow0', bias: 0.08, after: ['fore0', 'hand0', 'body'], front: [-1, 0.6, 0] });
  } else {
    // Bare to the waist, mint runes painted on its chest and belly; a necklace of teeth with a rune-stone hung from it; a skirt of
    // hide strips; a horned skull worn on its head, two feathers stuck in it.
    const chestV = tube([[0, 0, -0.32], [0, 0.05, 0.3], [0, 0.04, 0.9], [0, 0, 1.1]], [0.6, 0.64, 0.54, 0.3], [0.54, 0.58, 0.48, 0.28], n, 'coat', { up: [0, 1, 0] });
    const paintC: Disc[] = [
      ...rune('tiwaz', [0, 0.62, 0.48], [0, 1, 0.15], [0, 0, 1], 0.2, 0.035, 'water'),
      ...[-1, 1].flatMap((sd) => rune('kenaz', [sd * 0.3, 0.52, 0.86], [sd * 0.35, 1, 0.3], [0, 0, 1], 0.1, 0.03, 'water')),
      ...rune('algiz', [0, -0.58, 0.55], [0, -1, 0.1], [0, 0, 1], 0.2, 0.035, 'water'),
    ];
    const teeth = Array.from({ length: 5 }, (_, q) => {
      const a = ((q - 2) / 2) * 1.0, c: V3 = [Math.sin(a) * 0.4, 0.12 + Math.cos(a) * 0.36, 0.94];
      return taper([c, add(c, [Math.sin(a) * 0.04, Math.cos(a) * 0.05, -0.16])], 0.045, 0.01, 3, 'tooth');
    });
    const cord = tube(Array.from({ length: 6 }, (_, q) => { const a = ((q - 2.5) / 2.5) * 1.2; return [Math.sin(a) * 0.42, 0.12 + Math.cos(a) * 0.38, 0.97 - 0.03 * Math.cos(a)] as V3; }), 0.03, 0.03, 4, 'leatherDark', { start: false, end: false });
    const stone = merge(
      tube([[0, 0.5, 0.97], [0, 0.7, 0.62]], 0.025, 0.025, 3, 'leatherDark'),
      orbAlong([0, 0.72, 0.42], [0, 1, 0.1], [0.22, 0.09, 0.27], 6, 3, 'stoneDark'),
      paint(rune('ingwaz', [0, 0.82, 0.43], [0, 1, 0.1], [0, 0, 1], 0.18, 0.035, 'water')),
    );
    body = merge(chestV, paint(paintC));
    worn.push(cord, stone, ...teeth);
    hips = orb([0, 0, 0], [0.6, 0.52, 0.46], n - 2, k - 1, 'leatherDark');
    // A skirt of strips hung round the hips, alternately hide and bone-pale, each a flat blade down from the belt.
    // One flared band round the hips, a dark belt at its top, its strips a pair of facets each, hide and bone-pale by turns,
    // and its hem cut into points: every other corner of the bottom ring drawn up.
    const sk12 = 12;
    const band = tube([[0, 0, 0.2], [0, 0, 0.06], [0, 0.02, -0.46]], [0.64, 0.66, 0.84], [0.56, 0.58, 0.74], sk12,
      (ring, j) => (ring === 0 ? 'leatherDark' : (j >> 1) % 3 === 1 ? 'horn' : 'leather'), { up: [0, 1, 0], start: false, end: false });
    const hem = mesh(band.v.map((p, q) => (q >= sk12 * 2 && q % 2 === 1 ? [p[0] * 0.92, p[1] * 0.92, p[2] + 0.2] as V3 : p)), band.f);
    pieces.push({ key: 'skirt', mesh: hem, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips'] });
    arm = (part, ring) => (part === 1 && ring === 1 ? 'mark' : 'coat');
    leg = () => 'coat';
    // Warpaint: a mint stroke down each cheek from under the eye and a dot on the brow; a band on each forearm (the `mark` above, lit).
    const warp: Disc[] = [];
    for (const sd of [1, -1]) {
      const e = onEgg(H.c, H.r, [sd * 0.78, 0.6, -0.12]), e2 = onEgg(H.c, H.r, [sd * 0.82, 0.52, -0.38]);
      const d = unit(sub(e2.p, e.p)), side = scale(unit(cross(e.n, d)), 0.045);
      warp.push({ v: outward([add(e.p, add(side, scale(e.n, 0.03))), add(e2.p, add(side, scale(e2.n, 0.03))), add(e2.p, sub(scale(e2.n, 0.03), side)), add(e.p, sub(scale(e.n, 0.03), side))], e.n), m: 'water', lit: true });
    }
    const brow = onEgg(H.c, H.r, [0, 0.62, 0.6]);
    warp.push(...rune('diamond', add(brow.p, scale(brow.n, 0.03)), brow.n, [0, -0.3, 1], 0.09, 0.025, 'water'));
    headExtra.push(paint(warp));
    // The skull: a bone-white cap over the crown, two dark sockets looking forward, two horns curling up and out, and two feathers.
    const sk = add(H.c, [0, -0.16, H.r[2] * 0.82]);
    crown.push(
      orb(sk, [H.r[0] * 0.62, H.r[1] * 0.62, 0.32], n - 2, k - 1, 'horn'),
      orbAlong(add(sk, [0, H.r[1] * 0.5, 0.12]), [0, 1, 0.6], [0.26, 0.24, 0.2], n - 4, 3, 'horn'),
      paint([-1, 1].map((sd) => disc(add(sk, [sd * 0.13, H.r[1] * 0.64, 0.2]), [sd * 0.25, 0.8, 0.6], 0.075, 0.085, 6, 'nose'))),
      ...[-1, 1].map((sd) => taper(curve(add(sk, [sd * 0.4, 0.05, 0.14]), add(sk, [sd * 0.95, 0.15, 0.5]), add(sk, [sd * 0.8, -0.1, 1.0]), 3), 0.14, 0.02, 4, (ring) => (ring >= 2 ? 'hornDark' : 'horn'))),
      ...[[0.2, -0.3], [-0.12, -0.38]].map(([x, tilt]) => taper(curve(add(sk, [x, -0.3, 0.24]), add(sk, [x * 1.4, -0.55, 0.62]), add(sk, [x * 1.9, -0.85 + tilt, 0.86]), 2), 0.13, 0.02, 4, (ring) => (ring >= 1 && x < 0 ? 'cap' : 'feather'), 0.35, [0, 0.6, 0.4])),
    );
  }
  const blade1 = held(s, n);
  pieces.push(
    { key: 'hips', mesh: hips, bone: 'body', bias: 0 },
    ...(skirt ? [{ key: 'skirt', mesh: skirt, bone: 'chest', bias: 0.012, after: ['ll0', 'lr0', 'hips', 'body'] }] : []),
    { key: 'body', mesh: merge(body, ...worn), bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.4], k: 0.04 } },
    { key: 'head', mesh: merge(F.skull, F.face, F.look(false), ...headExtra, ...crown), shut: merge(F.skull, F.face, F.look(true), ...headExtra, ...crown), bone: 'head', bias: 0.2 },
    { key: 'brows', mesh: F.brows, bone: 'head', bias: 0.21, after: 'head', hide },
    ...ears,
    // The blade over the hand and the body; and, raised past the head from behind, what of it is behind the head hidden by it.
    { key: 'sword', mesh: blade1, bone: 'hand1', bias: 0.05, after: ['hand1', 'body'], front: [1, 0.4, 0], hide: [{ c: H.c, r: scale(H.r, 0.97) }], hideIn: 'head' },
    ...limbs(s, n, { arm, leg }),
  );
  return pieces;
}

/* ---- how each one moves ------------------------------------------------------------------ */

/** When in a strike (nought to one) the blade lands. */
const HIT = 0.46;

/** How far through each part of a strike: drawing back, the chop, and coming back to stand. */
function strikeOf(t: number): { back: number; chop: number; home: number } {
  const back = smooth(clamp(t / 0.36));
  const chop = smooth(clamp((t - 0.34) / (HIT - 0.34)));
  const home = smooth(clamp((t - 0.62) / 0.38));
  return { back, chop, home };
}

type Tri = [number, number, number];
const mix3 = (a: Tri, b: Tri, t: number): Tri => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/**
 * The blade arm (forward, out, elbow, past how it hangs) at each moment of a strike, for each look: held ready, drawn back,
 * and at the blow. Each fitted to put the hand and the blade where it wants them and searched along the whole of the
 * blow, a twentieth at a time, for a path that keeps the arm and the blade clear of the head and the body: the
 * Scrapper's cleaver held out before it, raised high and chopped down ahead of it; the Raider's blade out low at its
 * side, raised over the shield and swept across; the Hexer's knife held point down in its fist, drawn back to its hip
 * and driven forward and down.
 */
const ARM: Record<Look, { ready: Tri; back: Tri; hit: Tri }> = {
  A: { ready: [60, 24, -10], back: [100, -30, 20], hit: [50, 30, 0] },
  B: { ready: [20, -20, 66], back: [70, -30, 35], hit: [84, 52, -10] },
  C: { ready: [28, -20, 70], back: [-50, 24, 110], hit: [88, -16, -10] },
};

function posed(s: Gob): (a: Anim) => Bones {
  const A = ARM[s.look];
  return (a) => bipedBones(s.spec, a, (p: BipedPose) => {
    const t = a.t;
    // The blade held ready, going or standing, swinging a little with the stride.
    const sw = p.arms[1][0];
    p.arms[1] = [A.ready[0] + sw * 0.3, A.ready[1], A.ready[2]];
    if (s.look === 'B') {
      // The shield up before it, clear of its face.
      p.arms[0] = [p.arms[0][0] * 0.15 + 24, 24, 58];
    } else if (s.look === 'C') {
      // The other hand hung low and open, a little out.
      p.arms[0] = [p.arms[0][0] * 0.5 + 8, p.arms[0][1] + 10, p.arms[0][2] + 8];
    }
    const act = a.act?.kind === 'strike' ? a.act.t : -1;
    if (act >= 0) {
      const { back, chop, home } = strikeOf(act);
      const up = back * (1 - chop), down = chop * (1 - home);
      p.arms[1] = mix3(mix3(mix3(A.ready, A.back, back), A.hit, chop), A.ready, home);
      if (s.look === 'A') {
        // An overhead chop: leant back with the cleaver up, then the whole body brought down behind it, a step in.
        p.arms[0] = [p.arms[0][0] + 30 * up - 20 * down, p.arms[0][1] + 20 * up, p.arms[0][2] + 20 * up];
        p.chest = [p.chest[0] - 12 * up + 22 * down, p.chest[1] - 10 * up + 12 * down, p.chest[2]];
        p.head = [p.head[0] + 8 * up - 10 * down, p.head[1] * 0.3, p.head[2]];
        p.lift += 0.12 * up - 0.06 * down;
        if (a.go <= 0) p.legs = [[p.legs[0][0] - 10 * down, 0.1 * up, 0], [p.legs[1][0] + 26 * down, 0.25 * up, 0]];
      } else if (s.look === 'B') {
        // A sweep from behind the shield: turned away with the blade up over it, then turned through the blow, the shield
        // pushed out at the end of it.
        p.arms[0] = [p.arms[0][0] + 18 * down, p.arms[0][1] - 8 * up, p.arms[0][2] - 14 * down];
        p.chest = [p.chest[0] - 6 * up + 14 * down, p.chest[1] - 6 * up + 8 * down, p.chest[2] + 16 * up - 20 * down];
        p.head = [p.head[0] + 4 * up - 6 * down, p.head[1] * 0.3 - 10 * up + 10 * down, p.head[2]];
        p.lift += 0.04 * up;
        if (a.go <= 0) p.legs = [[p.legs[0][0] + 8 * up - 6 * down, 0.15 * up, 0], [p.legs[1][0] - 6 * up + 22 * down, 0.1 * up, 0]];
      } else {
        // A lunge: crouched low with the knife drawn back to its hip and the free hand's claws out before it, then sprung
        // forward off its back foot, the knife driven down ahead of it.
        p.arms[0] = [p.arms[0][0] + 50 * up + 20 * down, p.arms[0][1] + 16 * up, p.arms[0][2] + 30 * up];
        p.chest = [p.chest[0] - 8 * up + 16 * down, p.chest[1] + 8 * up - 6 * down, p.chest[2] + 14 * up - 10 * down];
        p.head = [p.head[0] + 6 * up - 4 * down, p.head[1] * 0.3, p.head[2]];
        p.lift += -0.12 * up + 0.16 * down;
        if (a.go <= 0) p.legs = [[p.legs[0][0] + 6 * up - 22 * down, 0.4 * up, 0], [p.legs[1][0] - 4 * up + 34 * down, 0.4 * up + 0.15 * down, 0]];
      }
      p.jaw = up;
      return;
    }
    if (a.go > 0) return;
    if (s.look === 'A') {
      // Shifty: a quick look to one side, held and snapped back, then the other; and now and then the cleaver brought down off the
      // shoulder and slapped into the other palm.
      const glance = (at: number[]): number => Math.min(1, 2 * beat(t, at, 2.4));
      const shift = glance([0.6, 9.4, 16.8]) - glance([5.4, 13.6, 21.2]) + 0.15 * drift(t, 1.3);
      p.head[1] = 16 * shift;
      p.neck[1] = 5 * shift;
      const slap = beat(t, [4.0, 12.8, 20.1], 1.1);
      p.arms[1] = [p.arms[1][0] + 10 * slap, p.arms[1][1] - 34 * slap, p.arms[1][2] + 6 * slap];
      p.arms[0] = [p.arms[0][0] + 40 * slap, p.arms[0][1] - 10 * slap, p.arms[0][2] + 50 * slap];
      p.legs = p.legs.map((l) => [l[0] + 6 * (0.5 + 0.5 * cyc(t, 3)), l[1] + 0.12 * (0.5 + 0.5 * cyc(t, 3)), l[2]] as [number, number, number]);
    } else if (s.look === 'B') {
      // Crouched behind its shield, looking over it to one side and the other, and now and then rapping the blade on the rim.
      const peek = beat(t, [2.0, 11.0, 18.5], 3.0) - beat(t, [6.5, 15.0], 3.0);
      p.head[1] = 12 * peek + 6 * drift(t, 0.4);
      p.neck[1] = 4 * peek;
      const rap = beat(t, [8.6, 21.0], 0.9) * (0.6 + 0.4 * Math.abs(Math.sin(t * TAU * 2.2)));
      p.arms[1] = [p.arms[1][0] + 40 * rap, p.arms[1][1] - 28 * rap, p.arms[1][2] + 40 * rap];
      p.legs = p.legs.map((l) => [l[0] + 10, l[1] + 0.2, l[2]] as [number, number, number]);
      p.lift -= 0.04;
    } else {
      // Swaying low from foot to foot, the head cocked one way and the other, and the free hand lifted to the rune-stone now and
      // then, its fingers working over it.
      p.roll += 4 * cyc(t, 2);
      p.head[2] += 14 * cyc(t, 2, 1.2);
      p.head[1] = 10 * drift(t, 2.1);
      const charm = beat(t, [3.0, 13.0, 19.5], 2.6);
      p.arms[0] = [p.arms[0][0] + 50 * charm, p.arms[0][1] + 38 * charm, p.arms[0][2] + 26 * charm + 8 * charm * Math.sin(t * TAU * 3)];
      p.legs = p.legs.map((l) => [l[0] + 4 * cyc(t, 2), l[1] + 0.1, l[2]] as [number, number, number]);
    }
  });
}

/** A pale slash through the air behind the blade's tip, from the top of the chop to just past it. */
function slash(g: CanvasRenderingContext2D, view: View, s: Gob, bones: (a: Anim) => Bones, a: Anim, front: boolean): void {
  const t = a.act?.kind === 'strike' ? a.act.t : -1;
  if (t < 0.34 || t > 0.78 || !front) return;
  const tip = tipInHand(s), inner = scale(tip, 0.55);
  const from = Math.max(0.34, Math.min(t, HIT) - 0.14), to = Math.min(t, HIT + 0.04);
  if (to <= from) return;
  // The swept band between the tip's path and a point half way down the blade, newest end brightest.
  const outer: Array<[number, number]> = [], inn: Array<[number, number]> = [];
  for (let q = 0; q <= 7; q++) {
    const b = bones({ ...a, act: { kind: 'strike', t: lerp(from, to, q / 7) } });
    outer.push(onScreen(view, place(b.hand1, tip)));
    inn.push(onScreen(view, place(b.hand1, inner)));
  }
  const fade = 1 - clamp((t - HIT - 0.04) / 0.28);
  g.save();
  for (let q = 1; q < outer.length; q++) {
    const k = q / (outer.length - 1);
    // Thin at the old end, full at the new: the inner edge drawn toward the outer as it gets older.
    const w = 0.25 + 0.75 * k;
    const ia = [lerp(outer[q - 1][0], inn[q - 1][0], w - 0.1), lerp(outer[q - 1][1], inn[q - 1][1], w - 0.1)];
    const ib = [lerp(outer[q][0], inn[q][0], w), lerp(outer[q][1], inn[q][1], w)];
    g.fillStyle = `rgba(255,250,236,${(0.15 + 0.55 * k) * fade})`;
    g.beginPath();
    g.moveTo(outer[q - 1][0], outer[q - 1][1]);
    g.lineTo(outer[q][0], outer[q][1]);
    g.lineTo(ib[0], ib[1]);
    g.lineTo(ia[0], ia[1]);
    g.closePath();
    g.fill();
  }
  // A bright edge along the tip's path.
  g.strokeStyle = `rgba(255,255,250,${0.85 * fade})`;
  g.lineWidth = 0.08;
  g.lineCap = 'round';
  g.beginPath();
  outer.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // At the blow, where the tip lands: the Scrapper's cleaver throws gold sparks off its edge, the Hexer's knife a mint star
  // of its runes' light. The Raider's sweep is its band alone.
  const since = t - HIT;
  if (since >= -0.02 && since < 0.24 && s.look !== 'B') {
    const [x, y] = outer[outer.length - 1], u = clamp((since + 0.02) / 0.26), al = (1 - u) * fade;
    if (s.look === 'A') {
      g.strokeStyle = `rgba(255,214,120,${al})`;
      g.lineWidth = 0.07;
      for (let q = 0; q < 5; q++) {
        const ang = -Math.PI * (0.15 + 0.17 * q), r0 = 0.15 + 0.7 * u, r1 = r0 + 0.25 * (1 - u);
        g.beginPath();
        g.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
        g.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
        g.stroke();
      }
    } else {
      const r = 0.3 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.6)), w = r * 0.22;
      g.fillStyle = `rgba(160,255,222,${0.9 * al})`;
      g.beginPath();
      for (let q = 0; q < 8; q++) {
        const ang = (q / 8) * TAU, rr = q % 2 ? w : r;
        g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.9);
      }
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

/* ---- the kinds ------------------------------------------------------------------------------ */

/** Each look's colours over the variant's: a moss-green skin a step off the grass, and the kit's iron, brass, hide and bone. */
function paletteOf(s: Gob): Kind['palette'] {
  const target: RGB = s.look === 'A' ? [152, 184, 96] : s.look === 'B' ? [138, 170, 110] : [124, 156, 100];
  return (coat, mark) => {
    const skin = mix(pastel(coat, 90), target, 0.7);
    const own: Partial<Palette> = {
      coat: skin, coatLight: lighter(skin, 0.25), coatDark: [72, 60, 70], lid: darker(skin, 0.42),
      inner: [236, 160, 168], nose: [86, 46, 66], tooth: [252, 246, 226], bloom: [255, 214, 92], eye: [52, 30, 44],
      claw: [86, 70, 72], hair: [82, 64, 86],
      leather: [192, 140, 98], leatherDark: [134, 92, 76], bark: [196, 164, 112], muzzle: [238, 226, 200],
      stone: [138, 147, 164], stoneDark: [110, 118, 140], spot: [240, 246, 252], crystal: [226, 192, 108],
      flame: [244, 184, 70], petal: [150, 214, 194], horn: [240, 230, 204], hornDark: [196, 180, 150],
      cap: [128, 96, 146], membrane: [92, 70, 108], shell: [240, 226, 196], ember: [210, 84, 80],
      water: [140, 238, 206], crystalDark: [84, 180, 158], glint: [236, 255, 248], mark: [140, 238, 206],
      feather: [240, 196, 120], featherDark: [150, 110, 90],
    };
    if (s.look === 'C') own.cap = [210, 108, 96];
    return coatPalette(coat, mark, own, 90);
  };
}

function goblinKind(s: Gob): Kind {
  const bones = posed(s);
  return {
    bones,
    build: (lod) => buildGob(s, lod),
    palette: paletteOf(s),
    shadow: [1.1, 1.0],
    stride: 1.7,
    size: 2.0 * MONSTER_GROWTH,
    blinks: 3,
    acts: ['strike'],
    extra: (g, view, b, a, under) => slash(g, view, s, bones, a, !under),
  };
}

/** The three goblins, by letter. */
export const GOBLIN_RUNECUT: Record<Look, Kind> = { A: goblinKind(LOOKS.A), B: goblinKind(LOOKS.B), C: goblinKind(LOOKS.C) };
/**
 * The goblin's subspecies, one for each of its variants in their order (`SpeciesDef.subspecies`): the Scrapper, the
 * Raider and the Hexer Goblin. The line draws a goblin as its variant's (`wildermonKind`).
 */
export const GOBLINS: readonly Kind[] = [GOBLIN_RUNECUT.A, GOBLIN_RUNECUT.B, GOBLIN_RUNECUT.C];