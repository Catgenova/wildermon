import {
  add, beat, bipedBones, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, eyes, lerp, lighter, merge, mirrored, mix, onEgg,
  orb, orbAlong, paint, pastel, scale, sub, taper, TAU, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones,
  type Disc, type Kind, type Piece,
} from './beasts';
import { mesh, onScreen, place, type Mat, type Mesh, type Palette, type V3, type View, type Xf } from './figure';
import { blade, cut, hump, ramp } from './beastkit';
import { GLYPHS } from './runestone';
import { MONSTER_GROWTH } from './monster-size';
import { glower } from './wild-upright';

/**
 * The orc's three subspecies in Runecut's look, one for each of its variants
 * (`SpeciesDef.subspecies`, `ORCS` in their order): every orc is one of them,
 * by the variant the island puts it out in. All three are the same size
 * (`Kind.size`), stand on the bones every upright monster stands on
 * (`bipedBones`), and each has its loop standing about and a strike of its own.
 *
 * - The Runebrand Orc (A): hunched, a hill of shoulder on bowed legs, its
 *   head low and thrust out, a crest of spikes down its skull; runes branded
 *   into its chest, back and arm, burning amber; a great cleaver in its fist,
 *   brought down overhead.
 * - The Ironshield Orc (B): upright and square in a steel cuirass, a
 *   horned helm with a gold rune band, stacked pauldrons, a red war-cloth; a
 *   round shield on the left arm with one big rune on it, and a bearded axe.
 *   Its runes are inlaid in gold, not lit.
 * - The War-chanter Orc (C): lean and stooped under a shaggy hide mantle, runes
 *   painted up its arms and chest in a glowing teal, a necklace of teeth; a
 *   totem staff taller than it, a horned skull and a rune crystal at its
 *   head, slammed into the ground in a ring of light.
 *
 * All three are built as every wildermon is: soft chunky masses in their
 * pastel tones, three steps of light, one weight of ink. The runes are the
 * runestones' own glyphs (`GLYPHS`), laid on as decals in two strokes -- a
 * wide one in the groove's colour and a narrow one down its middle -- as a
 * runestone's are cut and lit.
 */

/* ---- shared pieces --------------------------------------------------------------- */

/** A tube's profile: each ring's height, half its width, half its depth, and how far forward its middle is. */
type Ring = [number, number, number, number];

/** A trunk of rings up the z axis, its flat toward the front. */
const trunk = (rings: readonly Ring[], n: number, mat: Mat | ((ring: number, j: number) => Mat)): Mesh =>
  tube(rings.map(([z, , , y]) => [0, y, z] as V3), rings.map(([, w]) => w), rings.map(([, , h]) => h), n, mat, { up: [0, 1, 0] });

/** Half the width, half the depth and the forward of a trunk at a height, between its rings. */
function ringAt(rings: readonly Ring[], z: number): [number, number, number] {
  let i = 0;
  while (i < rings.length - 2 && rings[i + 1][0] < z) i++;
  const a = rings[i], b = rings[i + 1], k = clamp((z - a[0]) / (b[0] - a[0] || 1));
  return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
}

/** A point on a trunk at a height and `deg` round from its right toward its front, and the way out of it there. */
function onTrunk(rings: readonly Ring[], z: number, deg: number, lift = 0): { p: V3; n: V3 } {
  const at = (zz: number, d: number): V3 => {
    const [w, h, y] = ringAt(rings, zz), t = d * (Math.PI / 180);
    return [w * Math.cos(t), y + h * Math.sin(t), zz];
  };
  const p = at(z, deg);
  const n = unit(cross(sub(at(z, deg + 2), at(z, deg - 2)), sub(at(z + 0.02, deg), at(z - 0.02, deg))));
  return { p: add(p, scale(n, lift)), n };
}

/** A flat shape's corners in the order that makes it face out along `n`. */
function facing(v: V3[], n: V3, m: Mat, lit?: boolean): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v, m, lit };
}

/**
 * A rune laid on a surface at `c` facing `n`, `size` from its middle to its top with its top toward `up`: one of the
 * runestones' glyphs, each stroke a band `w` wide in `groove` and a narrower one down its middle in `light`, both lit
 * whichever way they are turned (`lit`), as a rune burning in a stone is; or, unlit, as gold inlaid in iron.
 */
function rune(glyph: string, c: V3, n: V3, up: V3, size: number, w: number, groove: Mat, light: Mat, lit = true): Disc[] {
  const u = unit(sub(up, scale(n, dot(up, n)))), across = unit(cross(u, n));
  const at = (x: number, y: number, lift: number): V3 => add(add(c, scale(n, lift)), add(scale(across, x * size), scale(u, y * size)));
  const out: Disc[] = [];
  for (const [ww, m, lift] of [[w, groove, 0.012], [w * 0.45, light, 0.022]] as Array<[number, Mat, number]>) {
    for (const st of GLYPHS[glyph] ?? []) {
      const pts = st.closed ? [...st.pts, st.pts[0]] : st.pts;
      for (let q = 0; q + 1 < pts.length; q++) {
        const a = at(pts[q][0], pts[q][1], lift), b = at(pts[q + 1][0], pts[q + 1][1], lift);
        const d = unit(sub(b, a)), side = scale(unit(cross(n, d)), ww / 2), ext = scale(d, ww * 0.35);
        out.push(facing([add(sub(a, ext), side), add(add(b, ext), side), sub(add(b, ext), side), sub(sub(a, ext), side)], n, m, lit));
      }
    }
  }
  return out;
}

/** A rune on a trunk at a height and a way round it, its top up the trunk. */
const runeOnTrunk = (rings: readonly Ring[], glyph: string, z: number, deg: number, size: number, w: number, groove: Mat, light: Mat, lit = true): Disc[] => {
  const { p, n } = onTrunk(rings, z, deg);
  return rune(glyph, p, n, [0, 0, 1], size, w, groove, light, lit);
};

/** A rune round a limb's bone (down -z), at `z` along it and `deg` round from its right toward its front, `r` out. */
function runeOnLimb(glyph: string, z: number, deg: number, r: number, size: number, w: number, groove: Mat, light: Mat): Disc[] {
  const t = deg * (Math.PI / 180), n: V3 = [Math.cos(t), Math.sin(t), 0];
  return rune(glyph, scale(n, r), n, [0, 0, 1], size, w, groove, light).map((d) => ({ ...d, v: d.v.map((p) => add(p, [0, 0, z])) }));
}

/** An open hand: a palm and four fingers fanned forward and down from it, the thumb in, their tips dark. */
function hand(r: number, len: number, n: number, mat: Mat = 'coat', tip: Mat = 'claw'): Mesh {
  return merge(
    orbAlong([0, r * 0.3, -r * 0.4], [0, 0.4, -1], [r * 0.9, r * 0.8, r], Math.max(6, n - 4), 4, mat),
    ...[0, 1, 2, 3].map((q) => {
      const a = (q / 3 - 0.5) * 1.1;
      const root: V3 = [Math.sin(a) * r * 0.6, r * 0.55, -r * 0.9];
      const mid = add(root, [Math.sin(a) * len * 0.4, len * 0.45, -len * 0.3]), end = add(root, [Math.sin(a) * len * 0.7, len * 0.75, -len * 0.8]);
      return taper(curve(root, mid, end, 3), r * 0.25, r * 0.08, 4, (ring) => (ring >= 3 ? tip : mat));
    }),
  );
}

/** A fist, closed round a grip that runs across the front of it along x: a knuckled lump and a thumb over the grip. */
function fist(r: number, n: number, mat: Mat = 'coat'): Mesh {
  return merge(
    orbAlong([0, r * 0.2, -r * 0.55], [0, 0.3, -1], [r * 1.0, r * 0.95, r * 1.05], Math.max(6, n - 4), 3, mat),
    // The knuckles, a ridge across the front of the fist, a little lumpy.
    tube([-0.62, -0.2, 0.2, 0.62].map((x) => [x * r, r * 0.78, -r * 0.92] as V3), [0.24, 0.27, 0.27, 0.24].map((w) => w * r), [0.26, 0.29, 0.29, 0.26].map((w) => w * r), 6, mat),
    orbAlong([r * 0.62, r * 0.55, -r * 0.5], [0.3, 0.6, -0.4], [r * 0.24, r * 0.4, r * 0.24], 4, 3, mat),
  );
}

/** A bare foot: a soft lump forward of the ankle, with toes, their nails dark. */
const bareFoot = (r: number, len: number, n: number, mat: Mat = 'coat'): Mesh => merge(
  orbAlong([0, len * 0.32, -r * 0.55], [0, 1, 0], [r * 1.05, len * 0.6, r * 0.6], Math.max(6, n - 4), 3, mat),
  ...[-1, 0, 1].map((q) => taper([[q * r * 0.55, len * 0.78, -r * 0.8], [q * r * 0.6, len * 0.98, -r * 0.92]], r * 0.2, r * 0.07, 4, 'claw')),
);

/** A boot: a soft toe forward of the ankle in dark leather, an iron cap over the toe, and a cuff. */
const boot = (r: number, len: number, n: number): Mesh => merge(
  orbAlong([0, len * 0.3, -r * 0.55], [0, 1, 0], [r * 1.08, len * 0.62, r * 0.66], Math.max(6, n - 4), 3, 'leatherDark'),
  orbAlong([0, len * 0.62, -r * 0.6], [0, 1, 0.15], [r * 0.95, len * 0.34, r * 0.52], Math.max(6, n - 4), 3, 'metalDark'),
  tube([[0, 0, 0.0], [0, 0, 0.22]], r * 0.98, r * 0.98, n, 'leather'),
);

/**
 * Arms and legs on the upright bones: an upper and a lower tube down each, a hand and a foot, and whatever is worn on
 * each (`wear`, by the bone it is on: `elbow0` a bracer, `ll1` a greave), merged into that bone's piece.
 */
function limbs(o: {
  n: number; arm: [number, number]; armW: [number, number]; hands: [Mesh, Mesh]; leg: [number, number]; legW: [number, number]; foot: Mesh;
  armMat?: Mat; legMat?: Mat; wear?: Record<string, Mesh>;
  /**
   * The head's egg on its bone, and the pieces on the head: an arm raised past it is drawn over them where it is before the head,
   * and under them, and hidden by the head, where it is behind it.
   */
  head?: { c: V3; r: V3 }; heads?: string[];
}): Piece[] {
  const out: Piece[] = [];
  const worn = (bone: string, m: Mesh): Mesh => (o.wear?.[bone] ? merge(m, o.wear[bone]) : m);
  const past: Partial<Piece> = o.head ? { after: ['body', ...(o.heads ?? ['head'])], hide: [o.head], hideIn: 'head' } : { after: 'body' };
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    out.push(
      { key: `arm${k}`, mesh: worn(`arm${k}`, tube([[0, 0, 0.12], [0, 0, -o.arm[0]]], [o.armW[0], o.armW[0] * 0.9], [o.armW[0], o.armW[0] * 0.9], o.n, o.armMat ?? 'coat', { seam: 'both' })), bone: `arm${k}`, bias: 0.03, front, convex: !o.wear?.[`arm${k}`], ...past },
      { key: `fore${k}`, mesh: worn(`elbow${k}`, tube([[0, 0, 0.05], [0, 0, -o.arm[1]]], [o.armW[1], o.armW[1] * 0.86], [o.armW[1], o.armW[1] * 0.86], o.n, o.armMat ?? 'coat', { seam: 'both' })), bone: `elbow${k}`, bias: 0.035, front, convex: !o.wear?.[`elbow${k}`], ...past },
      { key: `hand${k}`, mesh: o.hands[k], bone: `hand${k}`, bias: 0.04, front, ...past },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    out.push(
      { key: `${key}0`, mesh: worn(`${key}0`, tube([[0, 0, 0.12], [0, 0, -o.leg[0]]], [o.legW[0], o.legW[0] * 0.9], [o.legW[0], o.legW[0] * 0.9], o.n, o.legMat ?? 'coat', { seam: 'both' })), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front, convex: !o.wear?.[`${key}0`] },
      { key: `${key}1`, mesh: worn(`${key}1`, tube([[0, 0, 0.05], [0, 0, -o.leg[1]]], [o.legW[1], o.legW[1] * 0.92], [o.legW[1], o.legW[1] * 0.92], o.n, o.legMat ?? 'coat', { seam: 'both' })), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: !o.wear?.[`${key}1`] },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(o.foot) : o.foot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** Bands round a limb's bone from `z0` down to `z1` (negative, down the bone), `r` round, alternating two leathers. */
const wraps = (z0: number, z1: number, r: number, bands: number, n: number, a: Mat = 'leather', b: Mat = 'leatherDark'): Mesh =>
  merge(...Array.from({ length: bands }, (_, q) => {
    const t0 = z0 + ((z1 - z0) * q) / bands, t1 = z0 + ((z1 - z0) * (q + 0.92)) / bands;
    return tube([[0, 0, t0], [0, 0, t1]], r, r, n, q % 2 ? b : a);
  }));

/** A flap of hide or cloth hanging from the belt at `y` (out front, or out back for less than nought), `w` half wide, down to `z`. */
const flap = (y: number, w: number, z: number, n: number, mat: Mat | ((ring: number, j: number) => Mat)): Mesh =>
  tube([[0, y, 0.02], [0, y * 1.05, z * 0.5], [0, y * 1.08, z * 0.84], [0, y * 1.1, z]], [w, w * 0.96, w * 0.82, w * 0.34], [0.07, 0.065, 0.06, 0.05], n, mat, { up: [0, Math.sign(y), 0] });

/**
 * Things hanging from the belt -- a flap, a strap, a strip of hide -- each swung out about where it hangs from, just as
 * far as it must to clear the legs as they stride: so a knee coming up lifts the flap before it rather than going through
 * it. Each is a run of the mesh's corners (`from`, `count`), where it hangs from (`at`, in the body's frame), the way out
 * it swings (`out`, level), how far down it hangs and how wide it is.
 */
interface Hanger { from: number; count: number; at: V3; out: V3; len: number; w: number }

/** Hanging things put together as one mesh, and each one's run of corners (`Hanger`). */
function hung(items: ReadonlyArray<{ m: Mesh; at: V3; out: V3; len: number; w: number }>): { mesh: Mesh; hang: Hanger[] } {
  let from = 0;
  const hang = items.map((it) => {
    const h = { from, count: it.m.v.length, at: it.at, out: unit([it.out[0], it.out[1], 0]), len: it.len, w: it.w };
    from += it.m.v.length;
    return h;
  });
  return { mesh: merge(...items.map((it) => it.m)), hang };
}

/** The bones of a moment, worked out once for all the hanging things on it. */
const bonesFor = new WeakMap<Anim, Bones>();

/** A point turned `phi` about the line through `at` along `k` (unit). */
function turnAbout(p: V3, at: V3, k: V3, phi: number): V3 {
  const v = sub(p, at), c = Math.cos(phi), s = Math.sin(phi);
  return add(at, add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c))));
}

/**
 * How a piece on the body bone of hanging things swings (`Piece.bent`): each one turned out, about the line it hangs from,
 * by the least of a run of angles at which every point down its middle and its two edges is clear of each thigh and shin
 * (`legs`) by the leg's width and its own thickness.
 */
function swingClear(bones: (a: Anim) => Bones, hang: readonly Hanger[], legs: Limbs): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    let b = bonesFor.get(a);
    if (!b) { b = bones(a); bonesFor.set(a, b); }
    const body = b.body;
    const inBody = (p: V3): V3 => into(body, sub(p, body.t));
    const segs: Array<[V3, V3, number]> = [];
    for (const key of ['ll', 'lr']) {
      const hip = inBody(b[`${key}0`].t), knee = inBody(b[`${key}1`].t), ankle = inBody(b[`${key}2`].t);
      segs.push([hip, knee, legs.legW[0]], [knee, ankle, legs.legW[1]]);
    }
    const clear = (p: V3): boolean => segs.every(([s0, s1, r]) => {
      const d = sub(s1, s0), t = clamp(dot(sub(p, s0), d) / (dot(d, d) || 1));
      const q = add(s0, scale(d, t));
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > r + 0.07;
    });
    const out = [...v] as V3[];
    for (const h of hang) {
      const k = unit(cross(h.out, [0, 0, 1])), across = cross([0, 0, 1], h.out);
      let phi = 0;
      for (let step = 0; step <= 16; step++) {
        phi = (step / 16) * 1.4;
        const down: V3 = [h.out[0] * Math.sin(phi), h.out[1] * Math.sin(phi), -Math.cos(phi)];
        let ok = true;
        for (const s of [0.35, 0.65, 1]) {
          for (const x of [-0.7, 0, 0.7]) if (!clear(add(add(h.at, scale(down, s * h.len)), scale(across, x * h.w)))) { ok = false; break; }
          if (!ok) break;
        }
        if (ok) break;
      }
      if (phi > 0) for (let q = h.from; q < h.from + h.count; q++) out[q] = turnAbout(v[q], h.at, k, phi);
    }
    return out;
  };
}

/** A flap from the belt (`flap`'s numbers) as one hanging thing, swung clear of the legs as a whole. */
const flapClear = (bones: (a: Anim) => Bones, m: Mesh, f: readonly [number, number, number], legs: Limbs): ((v: readonly V3[], a: Anim) => V3[]) =>
  swingClear(bones, [{ from: 0, count: m.v.length, at: [0, f[0], 0.02], out: [0, Math.sign(f[0]), 0], len: -f[2], w: f[1] }], legs);

/** A mesh with the faces whose middles `keep` turns down taken out: a mantle open at the front. */
function only(m: Mesh, keep: (c: V3) => boolean): Mesh {
  return mesh(m.v, m.f.filter((f) => {
    const c: V3 = [0, 0, 0];
    for (const i of f.i) { c[0] += m.v[i][0] / f.i.length; c[1] += m.v[i][1] / f.i.length; c[2] += m.v[i][2] / f.i.length; }
    return keep(c);
  }));
}

/** A kind's arms and legs: the lengths and widths of the upper and lower of each, its fist, and its foot (how wide, how long). */
interface Limbs { arm: [number, number]; armW: [number, number]; leg: [number, number]; legW: [number, number]; hand: number; foot: [number, number] }

/** One arm's pose moved toward another by `k`. */
const toward = (a: readonly number[], b: readonly number[], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const STILL: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };

/** A way in a bone's frame, from the body's. */
const into = (x: Xf, d: V3): V3 => {
  const m = x.m;
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
};
/** A way in the body's frame, from a bone's. */
const outOf = (x: Xf, d: V3): V3 => {
  const m = x.m;
  return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[3] * d[0] + m[4] * d[1] + m[5] * d[2], m[6] * d[0] + m[7] * d[1] + m[8] * d[2]];
};

/**
 * Something held in a hand, built along its own z (the haft, from the grip) with its edge or face toward its own y, put
 * in the hand's frame so that standing still it points `dir` in the body's frame with its edge toward `edge`: so a staff
 * stands upright in the fist however the arm is bent. Also gives where a point of it is in the hand's frame.
 */
function heldIn(hand: Xf, grip: V3, dir: V3, edge: V3): { mesh: (m: Mesh) => Mesh; pt: (p: V3) => V3 } {
  const z = unit(into(hand, dir)), e = into(hand, edge);
  const y = unit(sub(e, scale(z, dot(e, z)))), x = cross(y, z);
  const pt = (p: V3): V3 => add(grip, add(add(scale(x, p[0]), scale(y, p[1])), scale(z, p[2])));
  return { mesh: (m) => mesh(m.v.map(pt), m.f), pt };
}

/** The face every one of them glowers with: small eyes under heavy brows, a flat broad nose, an underbite on the jaw bone, tusks up out of it. */
interface Face { c: V3; r: V3; eye: V3; eyeSize: number; brow: number; jaw: [V3, V3]; tusk: number; nose: [number, number] }

function orcHead(F: Face, n: number, k: number, iris: Mat = 'bloom'): { head: Mesh; shut: Mesh; brows: Mesh; jaw: Mesh } {
  const skull = orb(F.c, F.r, n, k, 'coat');
  const { lids, brows } = glower(F.c, F.r, F.eye, F.eyeSize, { tall: 0.9, drop: 0.42, slope: 0.42, brow: F.brow });
  const nose = merge(
    orbAlong(add(F.c, [0, F.r[1] * 0.98, -F.r[2] * 0.08]), [0, 1, 0.1], [F.nose[0], F.nose[1], F.nose[1] * 1.05], 6, 3, 'coatDark'),
    paint([-1, 1].map((s) => disc(add(F.c, [s * F.nose[0] * 0.42, F.r[1] * 0.98 + F.nose[1] * 0.75, -F.r[2] * 0.2]), [s * 0.2, 0.6, -0.8], F.nose[0] * 0.22, F.nose[0] * 0.16, 5, 'nose'))),
  );
  const look = (shut: boolean): Mesh => merge(eyes(F.c, F.r, F.eye, F.eyeSize, { tall: 0.9, shut, iris, pupil: 0.34, rim: 0 }), lids);
  const [jc, jr] = F.jaw;
  // The underbite: a jaw jutting out under the face, its lip a darker skin, the tusks up out of its corners past the lip, and
  // small teeth along the lip between them.
  const jaw = merge(
    orbAlong(add(F.c, jc), [0, 1, -0.3], jr, Math.max(7, n - 3), 4, 'coatDark'),
    ...[1, -1].map((s) => {
      const root = add(F.c, [s * jr[0] * 0.62, jc[1] + jr[1] * 0.45, jc[2] + jr[2] * 0.3]);
      return taper(curve(root, add(root, [s * 0.06, F.tusk * 0.32, F.tusk * 0.45]), add(root, [s * 0.16, F.tusk * 0.18, F.tusk]), 3), F.tusk * 0.24, F.tusk * 0.05, 5, 'tooth');
    }),
    paint([-0.5, -0.17, 0.17, 0.5].map((x) => {
      const { p, n: nn } = onEgg(add(F.c, jc), jr, [x, 0.9, 0.42]);
      return facing([add(p, [-jr[0] * 0.09, 0.02, 0]), add(p, [jr[0] * 0.09, 0.02, 0]), add(p, [0, 0.02, jr[2] * 0.42])], nn, 'tooth', true);
    })),
  );
  return { head: merge(skull, nose, look(false)), shut: merge(skull, nose, look(true)), brows, jaw };
}

/** An ear, pointed and laid back, turned out so it shows its length seen side on; dark inside. */
function ear(F: Face, s: number, len: number, n: number, notch = false): Mesh {
  const root = add(F.c, [s * F.r[0] * 0.9, -0.02, 0.08]), mid = add(F.c, [s * (F.r[0] + len * 0.35), -len * 0.35, 0.22]), tip = add(F.c, [s * (F.r[0] + len * 0.7), -len * 0.75, 0.42]);
  const up: V3 = [s * 0.55, 0.45, 0.7];
  const along = unit(sub(tip, root)), face = unit(sub(up, scale(along, dot(along, up))));
  const w = notch ? [0.22, 0.2, 0.08, 0.12, 0.01] : [0.22, 0.2, 0.15, 0.08, 0.01];
  return merge(
    tube(curve(root, mid, tip, 4), w, [0.07, 0.07, 0.06, 0.04, 0.01], Math.max(6, n - 4), 'coat', { up }),
    paint([disc(add(curve(root, mid, tip, 4)[1], scale(face, 0.075)), face, len * 0.2, 0.07, 6, 'inner', { up: cross(face, along) })]),
  );
}

/** A rune's light over the body: where it is on its bone and which way its face looks, how wide, how strong. */
interface RuneLight { bone: string; p: V3; n: V3; r: number; a: number }

/** The runes' light, each only while its face is toward the viewer, added over the body. */
function runeLights(g: CanvasRenderingContext2D, view: View, b: Bones, list: readonly RuneLight[], c: readonly [number, number, number], k: number): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const l of list) {
    const xf = b[l.bone];
    if (!xf) continue;
    const face = clamp((dot(outOf(xf, l.n), view.T) - 0.05) / 0.4);
    const al = clamp(l.a * k * face, 0, 0.8);
    if (al <= 0.01) continue;
    const [x, y] = onScreen(view, place(xf, l.p));
    const grad = g.createRadialGradient(x, y, 0, x, y, l.r);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`);
    grad.addColorStop(0.45, `rgba(${c[0]},${c[1]},${c[2]},${(al * 0.35).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = grad;
    g.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
  }
  g.restore();
}

/**
 * The smear of a blow: where the blade was over the last stretch of the strike up to `to` -- the band between its tip and
 * a point nearer the grip -- fading back along it, and gone a little after.
 */
function sweep(g: CanvasRenderingContext2D, view: View, bones: (t: number) => Bones, t: number, bone: string, tip: V3, root: V3, from: number, to: number, rgb: string): void {
  if (t < from || t > to + 0.16) return;
  const fade = 1 - ramp(t, to, to + 0.16);
  const tips: Array<[number, number]> = [], roots: Array<[number, number]> = [];
  const now = Math.min(t, to);
  for (let q = 0; q <= 6; q++) {
    const tt = now - (q / 6) * Math.min(now - from, 0.09);
    const b = bones(tt);
    tips.push(onScreen(view, place(b[bone], tip)));
    roots.push(onScreen(view, place(b[bone], root)));
  }
  g.save();
  for (let q = 0; q < 6; q++) {
    const k = 1 - q / 6;
    g.fillStyle = `rgba(${rgb},${(0.55 * fade * k).toFixed(3)})`;
    g.beginPath();
    g.moveTo(tips[q][0], tips[q][1]);
    g.lineTo(tips[q + 1][0], tips[q + 1][1]);
    g.lineTo(roots[q + 1][0], roots[q + 1][1]);
    g.lineTo(roots[q][0], roots[q][1]);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** The same moment with the strike `t` of the way through. */
const struck = (a: Anim, t: number): Anim => ({ ...a, act: { kind: 'strike', t } });

/** The hide and the hard things every proposal shares in its palette: leather, iron, bone, the eyes' amber. */
const GEAR: Partial<Palette> = {
  leather: [168, 122, 98], leatherDark: [118, 86, 80], leatherLit: [206, 166, 132],
  metal: [150, 160, 178], metalDark: [104, 110, 130], metalLit: [236, 240, 248], wood: [156, 114, 86], woodDark: [118, 84, 66],
  tooth: [248, 240, 216], bloom: [255, 198, 92], nose: [70, 52, 62], claw: [92, 72, 80],
};

/* ---- A: the Runebrand brute ------------------------------------------------------- */

const A_SPEC: BipedSpec = {
  high: 1.32,
  leg: { at: [0.52, 0, -0.1], len: [0.62, 0.62, 0.12], rest: [12, -24] },
  chest: { at: [0, 0, 0.22], lean: 26 },
  neck: { at: [0, 0.5, 1.66], len: 0.2, lean: 22 },
  head: { pitch: -14 },
  arm: { at: [1.6, 0.12, 1.38], len: [0.95, 0.9], rest: [10, 20, 22] },
  swing: [24, 32],
  waddle: 7,
  armSwing: 16,
};

/** The brute's trunk: a waist going up into a hill of shoulder, and a hump of muscle behind the neck the head sits low in front of. */
const A_RINGS: Ring[] = [
  [-0.32, 0.74, 0.62, 0.02], [0.15, 0.9, 0.74, 0.08], [0.62, 1.12, 0.9, 0.14], [1.05, 1.4, 0.98, 0.14], [1.42, 1.5, 0.94, 0.06],
  [1.72, 1.3, 0.8, -0.04], [1.92, 0.86, 0.56, -0.06], [2.02, 0.12, 0.1, -0.06],
];
const A_FACE: Face = { c: [0, 0.2, 0.42], r: [0.64, 0.64, 0.58], eye: [0.5, 0.82, 0.3], eyeSize: 0.15, brow: 0.11, jaw: [[0, 0.5, -0.3], [0.56, 0.4, 0.3]], tusk: 0.5, nose: [0.2, 0.13] };
/** When the cleaver lands, as a share of the strike. */
const A_HIT = 0.44;
/** The pieces on its head, which an arm or what it holds goes over or under as a whole (`limbs`). */
const A_HEADS = ['head', 'jaw', 'brows', 'ear0', 'ear1', 'crest'];
const A_LIMBS: Limbs = { arm: [0.95, 0.9], armW: [0.44, 0.42], leg: [0.62, 0.62], legW: [0.46, 0.4], hand: 0.38, foot: [0.38, 0.8] };
/** The hide flaps before and behind: how far out from the hips each hangs (behind, less than nought), half its width, how far down. */
const A_FLAPS: Array<[number, number, number]> = [[0.62, 0.5, -0.72], [-0.56, 0.56, -0.66]];
/** The brute's cleaver, along its own z from the grip: how far its blade's spine runs, and its depth at each step (edge to spine). */
const A_BLADE = { z0: 0.5, z1: 1.95, depth: [0.62, 0.66, 0.5, 0.68, 0.68, 0.62] };

function bruteBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6);
  const R = A_RINGS;
  // Bare from the belt up: the pecs and a lighter belly, a strap across from the right shoulder to the left hip with a brass ring,
  // and the runes branded into it -- the thorn big over the breastbone, the torch on the right of the chest, the hearth-rune across
  // the back between the shoulders -- burning amber.
  const strapPts = [[1.64, 52], [1.34, 66], [1.0, 82], [0.66, 104], [0.32, 128]].map(([z, d]) => onTrunk(R, z, d, 0.035).p);
  const chest = merge(
    trunk(R, n, (ring, j) => (ring >= 1 && ring <= 3 && Math.abs(((j + 1) / (n)) * TAU - Math.PI * 0.5) < 0.75 ? 'belly' : 'coat')),
    ...[-1, 1].map((s) => orbAlong(add(onTrunk(R, 1.22, 90 - s * 34).p, [0, -0.2, 0]), [s * 0.3, 1, -0.2], [0.52, 0.36, 0.38], 6, 3, 'coat')),
    tube(strapPts, 0.14, 0.05, 5, 'leatherDark', { up: [0, 1, 0.4] }),
    orbAlong(add(strapPts[2], [0, 0.04, 0]), [0, 1, 0], [0.14, 0.05, 0.14], 6, 3, 'fitting'),
    paint([
      ...runeOnTrunk(R, 'thurisaz', 1.18, 118, 0.32, 0.11, 'ember', 'flame'),
      ...runeOnTrunk(R, 'kenaz', 1.38, 64, 0.2, 0.08, 'ember', 'flame'),
      ...runeOnTrunk(R, 'othala', 1.32, 270, 0.38, 0.11, 'ember', 'flame'),
      ...runeOnTrunk(R, 'tiwaz', 0.72, 225, 0.2, 0.08, 'ember', 'flame'),
    ]),
  );
  // The belt: thick leather with a round brass buckle; a hide flap hanging before and behind, stitched with a patch.
  const belt = merge(
    tube([[0, 0.04, -0.16], [0, 0.04, 0.1]], 0.86, 0.76, n, 'leatherDark', { up: [0, 1, 0] }),
    orbAlong([0, 0.82, -0.03], [0, 1, 0], [0.21, 0.07, 0.19], 7, 3, 'fitting'),
    paint(rune('thurisaz', [0, 0.9, -0.03], [0, 1, 0], [0, 0, 1], 0.12, 0.05, 'leatherDark', 'leatherDark')),
  );
  const fore = merge(flap(...A_FLAPS[0], 6, 'leather'), paint([disc([0.18, 0.72, -0.4], [0, 1, 0], 0.17, 0.15, 4, 'mark', { spin: 0.4 })]));
  const back = flap(...A_FLAPS[1], 6, 'leather');
  const skirt = tube([[0, 0.02, 0.04], [0, 0.03, -0.32]], [0.88, 0.96], [0.72, 0.8], n, (_r, j) => (j % 3 ? 'leatherDark' : 'leather'), { up: [0, 1, 0] });
  // The left shoulder: a leather pad strapped on with three bone spikes out of it.
  const pad = merge(
    orbAlong([-1.5, 0.06, 1.6], [-0.7, 0, 1], [0.6, 0.62, 0.3], n, 3, 'leatherDark'),
    orbAlong([-1.52, 0.06, 1.64], [-0.7, 0, 1], [0.44, 0.46, 0.28], 7, 3, 'leather'),
    ...[[-0.24, 0.5], [0.14, 0.62], [0.5, 0.44]].map(([y, l]) => taper(curve([-1.65, y, 1.78], [-1.9, y - 0.04, 1.78 + l * 0.6], [-2.05, y - 0.14, 1.78 + l], 2), 0.11, 0.02, 5, 'tooth')),
  );
  const F = A_FACE;
  const face = orcHead(F, n, k);
  // War paint: a band of red ochre across the eyes, and three claw-stripes down the left cheek.
  const daub = paint([
    ...[1, -1].map((s) => { const { p, n: nn } = onEgg(F.c, F.r, [s * 0.5, 0.82, 0.3]); return disc(add(p, scale(nn, 0.012)), nn, 0.27, 0.13, 7, 'mark', { up: [0, 0, 1] }); }),
    ...[0, 1, 2].map((q) => { const { p, n: nn } = onEgg(F.c, F.r, [-0.66 - q * 0.08, 0.7 - q * 0.08, -0.12]); return disc(add(p, scale(nn, 0.012)), nn, 0.035, 0.15, 5, 'mark', { up: [0, 0, 1] }); }),
  ]);
  // A crest of stiff dark spikes from the brow back over the crown; brass rings on the tusks; an iron ring through the right ear's notch.
  const crest = merge(...[[0.5, 0.92, 0.36], [0.2, 1.06, 0.46], [-0.12, 1.08, 0.5], [-0.44, 0.98, 0.44], [-0.72, 0.76, 0.34], [-0.9, 0.46, 0.24]].map(([y, z, l]) => {
    const root = add(F.c, [0, y * F.r[1], z * F.r[2] * 0.95]);
    return taper([root, add(root, [0, -l * 0.55, l * 0.85])], 0.15, 0.02, 5, 'hair');
  }));
  const ears = (s: number): Mesh => merge(ear(F, s, 0.64, n, s > 0), s > 0 ? tube(curve(add(F.c, [0.98, -0.3, 0.32]), add(F.c, [1.06, -0.24, 0.2]), add(F.c, [1.0, -0.36, 0.14]), 3), 0.035, 0.035, 4, 'metal') : null);
  const rings = merge(...[1, -1].map((s) => {
    const root = add(F.c, [s * F.jaw[1][0] * 0.62, F.jaw[0][1] + F.jaw[1][1] * 0.45, F.jaw[0][2] + F.jaw[1][2] * 0.3]);
    return tube([add(root, [s * 0.04, F.tusk * 0.2, F.tusk * 0.24]), add(root, [s * 0.05, F.tusk * 0.24, F.tusk * 0.36])], F.tusk * 0.22, F.tusk * 0.22, 6, 'fitting');
  }));
  // The cleaver: a slab of dark iron a hand deep and longer than its arm, on a short haft bound in leather; the edge ground bright
  // and bitten once, a hole through it near the tip, and the torch burned into its flat.
  const B = A_BLADE, steps = B.depth.length;
  const spineZ = (q: number): number => B.z0 + (q / (steps - 1)) * (B.z1 - B.z0);
  const cleaver = merge(
    tube([[0, 0, -0.42], [0, 0, B.z0 + 0.1]], 0.08, 0.08, 6, 'wood'),
    wraps(-0.36, 0.14, 0.095, 2, 6),
    orb([0, 0, -0.46], 0.12, 6, 3, 'fitting'),
    blade(B.depth.map((d, q) => [0, d / 2 - 0.05, spineZ(q)] as V3), B.depth.map((d) => d / 2), [1, 0, 0], { mat: 'metal', rib: 'metal', fold: 0, thick: 0.11 }),
    blade(B.depth.map((d, q) => [0, d - 0.08, spineZ(q)] as V3), B.depth.map((d) => (d < 0.6 ? 0.01 : 0.045)), [1, 0, 0], { mat: 'metalLit', fold: 0, thick: 0.13 }),
    blade([[0, -0.07, B.z0 - 0.02], [0, -0.07, B.z1]], [0.035, 0.035], [1, 0, 0], { mat: 'metalDark', fold: 0, thick: 0.13 }),
    paint([1, -1].flatMap((s) => [
      disc([s * 0.066, 0.12, B.z1 - 0.2], [s, 0, 0], 0.1, 0.1, 7, 'metalDark', { up: [0, 1, 0] }),
      ...rune('kenaz', [s * 0.066, 0.24, (B.z0 + B.z1) / 2 - 0.1], [s, 0, 0], [0, 0, 1], 0.24, 0.08, 'ember', 'flame'),
    ])),
  );
  const hold = bruteHold();
  const hide = [{ c: F.c, r: F.r }];
  return [
    { key: 'hips', mesh: orb([0, 0, 0], [0.8, 0.62, 0.5], 7, 3, 'leatherDark'), bone: 'body', bias: 0 },
    { key: 'skirt', mesh: skirt, bone: 'body', bias: 0.015, after: ['ll0', 'lr0', 'hips'] },
    { key: 'flap0', mesh: fore, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips', 'skirt'], front: [0, 1, 0], bent: flapClear(bruteBones, fore, A_FLAPS[0], A_LIMBS) },
    { key: 'flap1', mesh: back, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips', 'skirt'], front: [0, -1, 0], bent: flapClear(bruteBones, back, A_FLAPS[1], A_LIMBS) },
    { key: 'body', mesh: merge(chest, belt), bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.8], k: 0.06 } },
    { key: 'pad', mesh: pad, bone: 'chest', bias: 0.06, after: ['body', 'arm0'] },
    { key: 'head', mesh: merge(face.head, daub), shut: merge(face.shut, daub), bone: 'head', bias: 0.2 },
    { key: 'jaw', mesh: merge(face.jaw, rings), bone: 'jaw', bias: 0.205, after: 'head' },
    { key: 'brows', mesh: face.brows, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear0', mesh: ears(-1), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ears(1), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'crest', mesh: crest, bone: 'head', bias: 0.19, hide },
    { key: 'cleaver', mesh: hold.mesh(cleaver), bone: 'hand1', bias: 0.05, after: ['hand1', ...A_HEADS], front: [1, 0.4, 0], hide, hideIn: 'head' },
    ...limbs({
      n, ...A_LIMBS, head: hide[0], heads: A_HEADS, hands: [fist(A_LIMBS.hand, n), fist(A_LIMBS.hand, n)], foot: bareFoot(A_LIMBS.foot[0], A_LIMBS.foot[1], n),
      wear: {
        elbow0: wraps(-0.3, -0.75, 0.46, 3, Math.max(7, n - 4)),
        elbow1: merge(tube([[0, 0, -0.48], [0, 0, -0.82]], 0.45, 0.45, n, 'leatherDark'), paint(runeOnLimb('tiwaz', -0.65, 60, 0.46, 0.12, 0.06, 'ember', 'flame'))),
        arm1: paint(runeOnLimb('kenaz', -0.38, 20, 0.47, 0.18, 0.075, 'ember', 'flame')),
      },
    }),
  ];
}

/** How the brute holds its cleaver: hanging from the fist down past its knee and out ahead, the edge forward. */
function bruteHold(): ReturnType<typeof heldIn> {
  return heldIn(bruteBones(STILL).hand1, [0, 0.06, -0.3], unit([0.36, 0.34, 0.87]), [1, 0, -0.3]);
}
let A_TIP: { tip: V3; root: V3 } | undefined;

/** Where the brute's runes are and which way they look, for their light. */
const A_LIGHTS: RuneLight[] = [
  { bone: 'chest', ...onTrunk(A_RINGS, 1.18, 118, 0.05), r: 0.8, a: 0.36 },
  { bone: 'chest', ...onTrunk(A_RINGS, 1.38, 64, 0.05), r: 0.5, a: 0.26 },
  { bone: 'chest', ...onTrunk(A_RINGS, 1.32, 270, 0.05), r: 0.8, a: 0.34 },
].map((l) => ({ bone: l.bone, p: l.p, n: l.n, r: l.r, a: l.a }));

function bruteBones(a: Anim): Bones {
  return bipedBones(A_SPEC, a, (p: BipedPose) => {
    // The cleaver carried low in the right fist; at a run, up and ready. The left fist hanging heavy and out from the hip.
    const run = a.gait * a.go;
    // Out from the side as it runs, so the cleaver is carried clear of its jaw; the chest reared a little, so a knee coming up
    // does not go into its belly.
    p.arms[1] = [p.arms[1][0] * 0.5 + 4 + 18 * run, p.arms[1][1] + 10 + 14 * run, p.arms[1][2] + 6 + 14 * run];
    p.chest[0] -= 8 * run;
    p.arms[0] = [p.arms[0][0], p.arms[0][1] + 8, p.arms[0][2] + 10];
    if (a.act?.kind === 'strike') {
      const t = a.act.t;
      // Up over its head and back, the chest reared and the jaw open; down onto what it strikes with the whole of its weight; and up out of it.
      const wind = ramp(t, 0.02, 0.32) * (1 - ramp(t, A_HIT - 0.1, A_HIT));
      const chop = ramp(t, A_HIT - 0.1, A_HIT) * (1 - ramp(t, 0.72, 1));
      // The arm goes up out to the side of the head, not past it, and the cleaver back over the shoulder. On the move its legs keep
      // to their stride and its chest bows less, so its knees are clear of its belly.
      const still = 1 - a.go;
      p.arms[1] = toward(toward(p.arms[1], [160, -26, 38], wind), [54, 26, 10], chop);
      // Swung out to the side on the way up and on the way down, so the upper arm goes round the shoulder, not through it.
      // (Out is away from the body below the level of the shoulder and toward it above, so it is turned by how far up the arm is.)
      const away = Math.cos((p.arms[1][0] + A_SPEC.arm.rest[0]) * (Math.PI / 180));
      p.arms[1][1] += away * (40 * Math.sin(Math.PI * ramp(t, 0.02, 0.32)) * (1 - chop) + 50 * Math.sin(Math.PI * ramp(t, A_HIT - 0.1, A_HIT)));
      p.arms[0] = toward(p.arms[0], [26, 26, 34], Math.max(wind, chop));
      p.chest[0] += (-18 * wind + 22 * chop) * (1 - 0.8 * a.go);
      p.chest[2] += -16 * wind + 14 * chop;
      p.head[0] += 14 * wind - 8 * chop;
      p.head[1] -= 10 * wind;
      p.jaw = Math.max(wind, 0.7 * chop);
      p.legs[0][0] += 12 * chop * still;
      p.legs[1][0] -= 8 * chop * still;
      p.legs[0][1] += 0.12 * chop * still;
      p.legs[1][1] += 0.12 * chop * still;
      return;
    }
    if (a.go > 0) return;
    const t = a.t;
    // Heavy breaths through the shoulders; a slow look round; and twice a loop a bellow, head up and jaw open, the fists out and the
    // cleaver lifted.
    const heave = cyc(t, 5);
    p.chest[0] += 4 * heave;
    p.arms[0][1] += 4 * heave;
    const round = beat(t, [3.0, 15.0], 3.2) - beat(t, [9.0, 20.6], 2.8);
    const held = Math.abs(round);
    p.head[1] = 0.5 * p.head[1] * (1 - held) + 16 * round;
    p.neck[1] = 0.5 * p.neck[1] * (1 - held) + 5 * round;
    const roar = beat(t, [6.2, 18.0], 1.8);
    p.head[0] += 22 * roar;
    p.chest[0] -= 10 * roar;
    p.jaw = roar;
    p.arms[0] = [p.arms[0][0] + 22 * roar, p.arms[0][1] + 26 * roar, p.arms[0][2] + 30 * roar];
    p.arms[1] = [p.arms[1][0] + 34 * roar, p.arms[1][1] + 14 * roar, p.arms[1][2] + 24 * roar];
    p.legs = p.legs.map((l) => [l[0], l[1] + 0.1 * roar, l[2]] as [number, number, number]);
  });
}

const ORC_A: Kind = {
  bones: bruteBones,
  build: bruteBuild,
  palette: (coat, mark) => {
    // Jade: the variants' grey-green taken to a cool pale green, lighter and bluer than the grass it stands on.
    const hide = mix(pastel(coat, 150), [138, 190, 164], 0.62);
    return coatPalette(coat, mark, {
      ...GEAR,
      coat: hide, coatLight: lighter(hide, 0.2), coatDark: darker(hide, 0.26), belly: mix(hide, [214, 228, 200], 0.4), lid: darker(hide, 0.42),
      inner: darker(hide, 0.38), hair: [92, 64, 98], mark: [200, 104, 88], fitting: [222, 184, 104],
      ember: [228, 126, 58], flame: [255, 228, 152],
    }, 150);
  },
  shadow: [1.8, 1.4],
  stride: 1.5,
  size: 4.1 * MONSTER_GROWTH,
  blinks: 5,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    if (under) return;
    const hit = a.act?.kind === 'strike' ? hump(a.act.t, A_HIT, 0.22) : 0;
    runeLights(g, view, b, A_LIGHTS, [255, 168, 78], 1 + 1.4 * hit);
    if (a.act?.kind !== 'strike') return;
    A_TIP ??= ((h) => ({ tip: h.pt([0, 0.6, A_BLADE.z1]), root: h.pt([0, 0.3, A_BLADE.z0 + 0.3]) }))(bruteHold());
    sweep(g, view, (t) => bruteBones(struck(a, t)), a.act.t, 'hand1', A_TIP.tip, A_TIP.root, A_HIT - 0.12, A_HIT, '255,226,170');
  },
};

/* ---- B: the Ironshield veteran ---------------------------------------------------- */

const B_SPEC: BipedSpec = {
  high: 1.5,
  leg: { at: [0.5, 0, -0.1], len: [0.7, 0.7, 0.12], rest: [8, -14] },
  chest: { at: [0, 0, 0.25], lean: 10 },
  neck: { at: [0, 0.2, 1.8], len: 0.24, lean: 6 },
  head: { pitch: -4 },
  arm: { at: [1.42, 0.08, 1.5], len: [0.85, 0.8], rest: [6, 28, 20] },
  swing: [24, 36],
  waddle: 4,
  armSwing: 14,
};

/** The veteran's trunk: a deep chest in a steel cuirass over a leather waist. */
const B_RINGS: Ring[] = [
  [-0.3, 0.78, 0.66, 0.02], [0.18, 0.92, 0.76, 0.06], [0.62, 1.16, 0.9, 0.12], [1.12, 1.28, 0.94, 0.1], [1.56, 1.32, 0.86, 0.02],
  [1.84, 0.94, 0.62, -0.02], [1.98, 0.3, 0.24, -0.02],
];
const B_FACE: Face = { c: [0, 0.16, 0.48], r: [0.66, 0.66, 0.62], eye: [0.52, 0.82, 0.24], eyeSize: 0.15, brow: 0.1, jaw: [[0, 0.52, -0.34], [0.58, 0.42, 0.3]], tusk: 0.52, nose: [0.2, 0.13] };
const B_HIT = 0.46;
const B_HEADS = ['head', 'jaw', 'brows', 'ear0', 'ear1', 'helm'];
const B_LIMBS: Limbs = { arm: [0.85, 0.8], armW: [0.38, 0.34], leg: [0.7, 0.7], legW: [0.4, 0.34], hand: 0.32, foot: [0.34, 0.74] };
const B_FLAPS: Array<[number, number, number]> = [[0.62, 0.42, -0.86], [-0.56, 0.48, -0.8]];
/** The shield on the left forearm's bone: its middle, and the way its face looks. */
const B_SHIELD = { at: [-0.12, 0.1, -0.92] as V3, n: unit([-0.42, 0.12, -0.9]) };
/** The bearded axe along its own z from the grip: the haft's length and where the head is on it. */
const B_AXE = { top: 2.05, head: 1.72 };

function veteranBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6);
  const R = B_RINGS;
  // The cuirass: steel from the ribs up, the leather of the jerkin under it at the waist, a gold band at its lower edge, gold rivets
  // down its middle and the warrior's rune inlaid in gold over the heart; the same rune on its back.
  const steel = (ring: number): Mat => (ring >= 2 ? 'metal' : 'leather');
  const chest = merge(
    trunk(R, n, steel),
    tube([0.5, 0.62].map((z) => [0, ringAt(R, z)[2], z] as V3), [ringAt(R, 0.5)[0] + 0.03, ringAt(R, 0.62)[0] + 0.03], [ringAt(R, 0.5)[1] + 0.03, ringAt(R, 0.62)[1] + 0.03], n + 2, 'fitting', { up: [0, 1, 0] }),
    paint([
      ...runeOnTrunk(R, 'tiwaz', 1.12, 90, 0.34, 0.1, 'fitting', 'rivet', false),
      ...runeOnTrunk(R, 'tiwaz', 1.12, 270, 0.3, 0.09, 'fitting', 'rivet', false),
      ...[0.82, 1.48].flatMap((z) => [60, 120].map((d) => { const { p, n: nn } = onTrunk(R, z, d, 0.01); return disc(p, nn, 0.05, 0.05, 6, 'rivet', { lit: true }); })),
    ]),
    // A gold-edged collar of steel round the top of the cuirass.
    tube([[0, -0.02, 1.8], [0, -0.02, 1.96]], [1.0, 0.72], [0.68, 0.5], n, (ring, j) => (j % 3 ? 'metalDark' : 'fitting'), { up: [0, 1, 0], start: false }),
  );
  const belt = merge(
    tube([[0, 0.04, -0.14], [0, 0.04, 0.1]], 0.84, 0.74, n, 'leatherDark', { up: [0, 1, 0] }),
    orbAlong([0, 0.8, -0.02], [0, 1, 0], [0.18, 0.06, 0.16], 6, 3, 'fitting'),
  );
  // The war-cloth: red, hanging before and behind from the belt, its hem a darker red, the home-rune on it in gold.
  const hem = (ring: number): Mat => (ring >= 2 ? 'clothDark' : 'cloth');
  const fore = merge(flap(...B_FLAPS[0], 6, hem), paint(rune('othala', [0, 0.72, -0.36], [0, 1, 0], [0, 0, 1], 0.2, 0.07, 'fitting', 'rivet', false)));
  const back = flap(...B_FLAPS[1], 6, hem);
  // Under the cloth, a skirt of leather straps studded with steel, each hanging on its own.
  const skirt = hung(Array.from({ length: 8 }, (_, q) => {
    const t = ((q + 0.5) / 8) * TAU, o: V3 = [Math.cos(t) * 0.84, 0.03 + Math.sin(t) * 0.72, 0], out = unit([o[0], o[1] - 0.03, 0]);
    const end = add(o, add(scale(out, 0.1), [0, 0, -0.5]));
    const m = merge(tube([o, end], [0.24, 0.22], [0.045, 0.04], 4, q % 2 ? 'leatherDark' : 'leather', { up: out }), paint([disc(add(add(o, scale(sub(end, o), 0.6)), scale(out, 0.05)), out, 0.06, 0.06, 5, 'metal', { lit: true })]));
    return { m, at: o, out, len: 0.5, w: 0.22 };
  }));
  // Pauldrons: three lames of steel stacked down each shoulder, each edged in its dark, gold rivets on the top one.
  const pauldron = (s: number): Mesh => merge(...[0, 1].map((q) => {
    const c: V3 = [s * (1.42 + q * 0.1), 0.06, 1.72 - q * 0.3];
    const ax = unit([s * (0.7 + q * 0.25), 0, 1]);
    return merge(
      orbAlong(c, ax, [0.64 - q * 0.06, 0.62 - q * 0.06, 0.26], 7, 3, 'metal'),
      orbAlong(sub(c, scale(ax, 0.05)), ax, [0.67 - q * 0.06, 0.65 - q * 0.06, 0.2], 7, 2, q ? 'metalDark' : 'fitting'),
    );
  }), paint([-0.3, 0, 0.3].map((y) => disc([s * 1.46, 0.06 + y, 1.97], [s * 0.4, 0, 1], 0.05, 0.05, 6, 'rivet', { lit: true }))));
  const F = B_FACE;
  const face = orcHead(F, n, k);
  // War paint in the cloth's red: a stripe down from each eye over the cheek.
  const daub = paint([1, -1].map((s) => { const { p, n: nn } = onEgg(F.c, F.r, [s * 0.56, 0.78, 0.02]); return disc(add(p, scale(nn, 0.012)), nn, 0.07, 0.22, 6, 'cloth', { up: [0, 0, 1] }); }));
  // The helm: a steel cap down to the brow, a gold band round its rim with runes in it, a bar down over the nose, and two horns swept
  // out and up from its sides.
  const H = (z: number, f: number): [number, number] => [F.r[0] * f, F.r[1] * f];
  const capRings: Array<[number, number]> = [[0.42, 1.02], [0.56, 0.96], [0.7, 0.84], [0.84, 0.64], [0.96, 0.34], [1.0, 0.04]];
  const helm = merge(
    tube(capRings.map(([z]) => add(F.c, [0, -0.04, z * F.r[2] + 0.06])), capRings.map(([z, f]) => H(z, f)[0]), capRings.map(([z, f]) => H(z, f)[1]), n, 'metal', { up: [0, 1, 0] }),
    tube([add(F.c, [0, -0.04, 0.3]), add(F.c, [0, -0.04, 0.48])], F.r[0] * 1.06, F.r[1] * 1.06, n + 2, 'fitting', { up: [0, 1, 0] }),
    paint([90, 45, 135].flatMap((d, i) => {
      const t = d * (Math.PI / 180), nn: V3 = [Math.cos(t), Math.sin(t), 0];
      return rune(['algiz', 'tiwaz', 'tiwaz'][i], add(F.c, [Math.cos(t) * F.r[0] * 1.06, -0.04 + Math.sin(t) * F.r[1] * 1.06, 0.39]), nn, [0, 0, 1], 0.08, 0.035, 'metalDark', 'metalDark', false);
    })),
    tube([add(F.c, [0, F.r[1] * 1.02, 0.42]), add(F.c, [0, F.r[1] * 1.1, 0.24]), add(F.c, [0, F.r[1] * 1.14, 0.06])], [0.08, 0.07, 0.05], 0.04, 5, 'metal', { up: [0, 1, 0] }),
    ...[1, -1].map((s) => taper(curve(add(F.c, [s * F.r[0] * 0.9, -0.04, 0.56]), add(F.c, [s * 1.36, -0.02, 0.62]), add(F.c, [s * 1.42, 0.2, 1.3]), 5), 0.19, 0.03, 5, (ring) => (ring >= 4 ? 'hornDark' : 'horn'))),
  );
  // The shield, on the left forearm: an oak round painted red in two halves with the protection-rune across it in gold, an iron rim,
  // rivets round it and an iron boss in the middle.
  const SR = 0.78, ST = 0.08;
  const shieldLocal = merge(
    tube([[0, 0, -ST], [0, 0, ST]], SR, SR, 14, (_r, j) => (j < 7 ? 'wood' : 'woodDark')),
    tube([[0, 0, -ST - 0.02], [0, 0, ST + 0.02]], SR + 0.06, SR + 0.06, 14, 'metal', { start: false, end: false }),
    orb([0, 0, ST], [0.2, 0.2, 0.14], 8, 3, 'metal'),
    paint([
      ...rune('algiz', [0, 0, ST + 0.005], [0, 0, 1], [0, 1, 0], SR * 0.68, 0.16, 'cloth', 'rivet'),
      ...Array.from({ length: 8 }, (_, q) => { const t = (q / 8) * TAU + 0.2; return disc([Math.cos(t) * SR * 0.86, Math.sin(t) * SR * 0.86, ST + 0.01], [0, 0, 1], 0.045, 0.045, 5, 'rivet', { lit: true }); }),
    ]),
  );
  // Gripped in the left fist, its face out ahead of the forearm and a little to the left, so it is before the chest.
  const fz = B_SHIELD.n, fy = unit(sub([0, 1, 0], scale(fz, fz[1]))), fx = cross(fy, fz);
  const shield = mesh(shieldLocal.v.map((p) => add(B_SHIELD.at, add(add(scale(fx, p[0]), scale(fy, p[1])), scale(fz, p[2])))), shieldLocal.f);
  // The axe: an ash haft, a bearded head of steel -- its edge ground bright and running down into the beard -- and a spike behind.
  const A = B_AXE;
  // Its head's outline down the haft: at each height, from the haft out to the edge.
  const head: Array<[number, number, number]> = [[0.36, 0.06, 0.56], [0.16, 0.06, 0.8], [-0.06, 0.08, 0.86], [-0.28, 0.3, 0.86], [-0.5, 0.6, 0.8]];
  const axe = merge(
    tube([[0, 0, -0.5], [0, 0, A.top]], 0.07, 0.07, 6, 'wood'),
    wraps(-0.3, 0.12, 0.085, 2, 6),
    blade(head.map(([z, y0, y1]) => [0, (y0 + y1) / 2, A.head + z] as V3), head.map(([, y0, y1]) => (y1 - y0) / 2), [1, 0, 0], { mat: 'metal', rib: 'metal', fold: 0, thick: 0.08 }),
    blade(head.map(([z, , y1]) => [0, y1 - 0.035, A.head + z] as V3), head.map(() => 0.045), [1, 0, 0], { mat: 'metalLit', fold: 0, thick: 0.1 }),
    taper([[0, -0.06, A.head], [0, -0.42, A.head + 0.06]], 0.1, 0.02, 5, 'metal'),
    orb([0, 0, A.top], 0.09, 6, 3, 'fitting'),
    paint([1, -1].flatMap((s) => rune('tiwaz', [s * 0.05, 0.3, A.head], [s, 0, 0], [0, 0, 1], 0.14, 0.05, 'fitting', 'rivet', false))),
  );
  const hold = veteranHold();
  const hide = [{ c: F.c, r: F.r }];
  return [
    { key: 'hips', mesh: orb([0, 0, 0], [0.82, 0.64, 0.56], 7, 3, 'leatherDark'), bone: 'body', bias: 0 },
    { key: 'skirt', mesh: skirt.mesh, bone: 'body', bias: 0.015, after: ['ll0', 'lr0', 'hips'], bent: swingClear(veteranBones, skirt.hang, B_LIMBS) },
    { key: 'flap0', mesh: fore, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips', 'skirt'], front: [0, 1, 0], bent: flapClear(veteranBones, fore, B_FLAPS[0], B_LIMBS) },
    { key: 'flap1', mesh: back, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips', 'skirt'], front: [0, -1, 0], bent: flapClear(veteranBones, back, B_FLAPS[1], B_LIMBS) },
    { key: 'body', mesh: merge(chest, belt), bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.8], k: 0.04 } },
    { key: 'paul0', mesh: pauldron(-1), bone: 'chest', bias: 0.06, after: ['body', 'arm0'] },
    { key: 'paul1', mesh: pauldron(1), bone: 'chest', bias: 0.06, after: ['body', 'arm1'] },
    { key: 'head', mesh: merge(face.head, daub), shut: merge(face.shut, daub), bone: 'head', bias: 0.2 },
    { key: 'jaw', mesh: face.jaw, bone: 'jaw', bias: 0.205, after: 'head' },
    { key: 'brows', mesh: face.brows, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear0', mesh: ear(F, -1, 0.56, n), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ear(F, 1, 0.56, n), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'helm', mesh: helm, bone: 'head', bias: 0.22, after: ['head', 'brows', 'ear0', 'ear1'] },
    { key: 'shield', mesh: shield, bone: 'elbow0', bias: 0.06, after: ['fore0', 'hand0', 'body', 'paul0', ...B_HEADS], front: B_SHIELD.n, hide, hideIn: 'head' },
    { key: 'axe', mesh: hold.mesh(axe), bone: 'hand1', bias: 0.05, after: ['hand1', ...B_HEADS], front: [1, 0.4, 0], hide, hideIn: 'head' },
    ...limbs({
      n, ...B_LIMBS, head: hide[0], heads: B_HEADS, hands: [fist(B_LIMBS.hand, n), fist(B_LIMBS.hand, n)], foot: boot(B_LIMBS.foot[0], B_LIMBS.foot[1], n),
      wear: {
        elbow1: merge(tube([[0, 0, -0.3], [0, 0, -0.76]], [0.38, 0.4], [0.38, 0.4], n, 'leatherDark'), tube([[0, 0, -0.42], [0, 0, -0.6]], 0.41, 0.41, n, 'metal')),
        ll1: tube([[0, 0, -0.06], [0, 0, -0.5]], [0.37, 0.33], [0.37, 0.33], n, 'metal'),
        lr1: tube([[0, 0, -0.06], [0, 0, -0.5]], [0.37, 0.33], [0.37, 0.33], n, 'metal'),
      },
    }),
  ];
}

/** How the veteran holds its axe: upright at its side, head up by the shoulder, the edge forward. */
function veteranHold(): ReturnType<typeof heldIn> {
  return heldIn(veteranBones(STILL).hand1, [0, 0.04, -0.28], unit([0.32, 0.26, 0.92]), [0, 1, 0]);
}
let B_TIP: { tip: V3; root: V3 } | undefined;

function veteranBones(a: Anim): Bones {
  return bipedBones(B_SPEC, a, (p: BipedPose) => {
    // The shield carried up before the left of its chest, the axe at its right side, the forearm forward; at a run, both higher.
    const run = a.gait * a.go;
    // Both forearms kept low enough, and the arms far enough out, that a swing forward does not bring a fist up into a pauldron.
    p.arms[0] = [p.arms[0][0] * 0.3 + 26, p.arms[0][1] - 3 + 6 * run, p.arms[0][2] + 56 - 6 * run];
    p.arms[1] = [p.arms[1][0] * 0.5 + 4 + 6 * run, p.arms[1][1] - 4 + 16 * run, p.arms[1][2] + 52];
    if (a.act?.kind === 'strike') {
      const t = a.act.t;
      // The shield thrust out ahead and the axe up and back over the right shoulder; the step in behind the shield and the axe brought
      // down across it from high on the right to low on the left; and back behind the shield.
      const wind = ramp(t, 0.02, 0.32) * (1 - ramp(t, B_HIT - 0.12, B_HIT));
      const chop = ramp(t, B_HIT - 0.12, B_HIT) * (1 - ramp(t, 0.74, 1));
      const guard = ramp(t, 0.0, 0.2) * (1 - ramp(t, 0.8, 1));
      p.arms[0] = toward(p.arms[0], [64, -2, 30], guard);
      // The axe arm goes up out to the side of the helm, its elbow open, and comes down across in front of it, not through it.
      const still = 1 - a.go;
      p.arms[1] = toward(toward(p.arms[1], [150, -22, 40], wind), [70, 18, 10], chop);
      // Round the shoulder on the way up and down, not through it (out is toward the body once the arm is over the shoulder).
      const away = Math.cos((p.arms[1][0] + B_SPEC.arm.rest[0]) * (Math.PI / 180));
      p.arms[1][1] += away * (56 * Math.sin(Math.PI * ramp(t, 0.02, 0.32)) * (1 - chop) + 40 * Math.sin(Math.PI * ramp(t, B_HIT - 0.12, B_HIT)));
      p.chest[2] += -22 * wind + 26 * chop;
      p.chest[0] += (-6 * wind + 14 * chop) * (1 - 0.5 * a.go);
      p.head[1] += 4 * wind - 8 * chop;
      p.head[0] += 8 * chop;
      p.jaw = 0.6 * Math.max(wind, chop);
      p.legs[0][0] += 14 * guard * still;
      p.legs[1][0] -= 10 * guard * still;
      p.legs[0][1] += 0.1 * chop * still;
      p.legs[1][1] += 0.1 * chop * still;
      return;
    }
    if (a.go > 0) return;
    const t = a.t;
    // Steady: slow breaths, a look round the field, and twice a loop the haft of the axe beaten on the rim of the shield.
    p.chest[0] += 2 * cyc(t, 4);
    const round = beat(t, [2.0, 13.0], 3.0) - beat(t, [7.6, 19.0], 3.0);
    const held = Math.abs(round);
    p.head[1] = 0.5 * p.head[1] * (1 - held) + 22 * round;
    p.neck[1] = 0.5 * p.neck[1] * (1 - held) + 6 * round;
    const bang = beat(t, [10.2, 22.0], 1.6);
    const knock = bang * (0.5 + 0.5 * Math.sin(t * TAU * 2.5));
    p.arms[1] = [p.arms[1][0] + 46 * bang + 8 * knock, p.arms[1][1] - 6 * bang, p.arms[1][2] + 20 * bang];
    p.arms[0] = [p.arms[0][0] + 8 * bang, p.arms[0][1] - 4 * bang, p.arms[0][2]];
    p.chest[2] += -10 * bang;
  });
}

const ORC_B: Kind = {
  bones: veteranBones,
  build: veteranBuild,
  palette: (coat, mark) => {
    // Olive: the variants' grey-green taken to a warm yellow-green, so the skin stands off the steel; the war-cloth a madder red.
    const hide = mix(pastel(coat, 90), [164, 176, 116], 0.6);
    return coatPalette(coat, mark, {
      ...GEAR,
      coat: hide, coatLight: lighter(hide, 0.2), coatDark: darker(hide, 0.28), lid: darker(hide, 0.4), inner: darker(hide, 0.36),
      cloth: [206, 98, 92], clothDark: [158, 70, 76], fitting: [222, 184, 100], rivet: [252, 226, 150], horn: [238, 226, 198], hornDark: [150, 120, 104],
      metal: [168, 178, 196], metalDark: [118, 126, 148], wood: [176, 132, 96], woodDark: [150, 108, 80],
    }, 214);
  },
  shadow: [1.6, 1.3],
  stride: 1.5,
  size: 4.1 * MONSTER_GROWTH,
  blinks: 5,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    if (under || a.act?.kind !== 'strike') return;
    B_TIP ??= ((h) => ({ tip: h.pt([0, 0.62, B_AXE.head - 0.1]), root: h.pt([0, 0.1, B_AXE.head - 0.1]) }))(veteranHold());
    sweep(g, view, (t) => veteranBones(struck(a, t)), a.act.t, 'hand1', B_TIP.tip, B_TIP.root, B_HIT - 0.14, B_HIT, '236,242,252');
  },
};

/* ---- C: the War-chanter ------------------------------------------------------------- */

const C_SPEC: BipedSpec = {
  high: 1.62,
  leg: { at: [0.4, 0, -0.1], len: [0.76, 0.74, 0.12], rest: [10, -20] },
  chest: { at: [0, 0, 0.22], lean: 22 },
  neck: { at: [0, 0.36, 1.62], len: 0.3, lean: 16 },
  head: { pitch: -12 },
  arm: { at: [1.12, 0.1, 1.4], len: [0.88, 0.84], rest: [8, 16, 20] },
  swing: [22, 34],
  waddle: 4,
  armSwing: 14,
};

/** The chanter's trunk: lean, ribbed, narrower at the shoulder than the others, stooped. */
const C_RINGS: Ring[] = [
  [-0.3, 0.62, 0.54, 0.0], [0.2, 0.7, 0.58, 0.04], [0.7, 0.88, 0.68, 0.08], [1.15, 1.06, 0.74, 0.06], [1.48, 1.1, 0.7, 0.0],
  [1.72, 0.8, 0.52, -0.04], [1.84, 0.2, 0.16, -0.04],
];
const C_FACE: Face = { c: [0, 0.18, 0.46], r: [0.6, 0.62, 0.6], eye: [0.5, 0.82, 0.28], eyeSize: 0.15, brow: 0.1, jaw: [[0, 0.5, -0.32], [0.54, 0.42, 0.3]], tusk: 0.56, nose: [0.18, 0.12] };
const C_HIT = 0.5;
const C_HEADS = ['head', 'jaw', 'brows', 'ear0', 'ear1', 'knot'];
const C_LIMBS: Limbs = { arm: [0.88, 0.84], armW: [0.34, 0.3], leg: [0.76, 0.74], legW: [0.34, 0.29], hand: 0.32, foot: [0.32, 0.72] };
/** The chanter's hide cloak: from the small of its back up over its shoulders, open at the front. */
const C_MANTLE: Ring[] = [[0.4, 0.74, 0.66, -0.12], [0.8, 0.92, 0.78, -0.08], [1.2, 1.16, 0.86, -0.05], [1.56, 1.26, 0.84, -0.04], [1.78, 1.04, 0.68, -0.06], [1.92, 0.56, 0.42, -0.06]];
/** The totem staff along its own z from the grip: how far down to its foot, and up to the skull at its head. */
const C_STAFF = { foot: -1.25, top: 2.25 };

function chanterBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6);
  const R = C_RINGS;
  // Bare and lean, the runes of war painted up it in teal: lightning down the breastbone, the warrior's rune on each side of the
  // ribs, and the thorn on the back. A necklace of teeth on a cord.
  const neck = curve(onTrunk(R, 1.62, 10, 0.05).p, onTrunk(R, 1.28, 90, 0.08).p, onTrunk(R, 1.62, 170, 0.05).p, 6);
  const chest = merge(
    trunk(R, n, (ring, j) => (ring >= 1 && ring <= 3 && Math.abs(((j + 1) / (n)) * TAU - Math.PI * 0.5) < 0.6 ? 'belly' : 'coat')),
    tube(neck, 0.035, 0.035, 4, 'leatherDark'),
    ...neck.slice(1, -1).map((p, q) => taper([p, add(p, [0, 0.06, -0.2 - (q % 2) * 0.08])], 0.06, 0.015, 4, 'tooth')),
    paint([
      ...runeOnTrunk(R, 'sowilo', 0.98, 90, 0.36, 0.1, 'water', 'crystal'),
      ...runeOnTrunk(R, 'tiwaz', 0.85, 40, 0.18, 0.07, 'water', 'crystal'),
      ...runeOnTrunk(R, 'tiwaz', 0.85, 140, 0.18, 0.07, 'water', 'crystal'),
      ...runeOnTrunk(R, 'thurisaz', 0.95, 270, 0.3, 0.09, 'water', 'crystal'),
    ]),
  );
  // The mantle: a shaggy hide over the shoulders and down the back, open at the front, tufted along its edge.
  const MR = C_MANTLE;
  const mantle = merge(
    // Open at both ends as well as at the front: a cap across its hem would be a dark disc before the chest when it leans into a run.
    only(tube(MR.map(([z, , , y]) => [0, y, z] as V3), MR.map(([, w]) => w), MR.map(([, , h]) => h), n + 2, (ring) => (ring >= 4 ? 'featherDark' : 'feather'), { up: [0, 1, 0], start: false, end: false }),
      // Over the shoulders and down the back, and no further forward than the back of the neck: not a collar round the throat.
      (c) => c[1] < Math.min(0.12 + (c[2] - 1.0) * 0.55, 0.16)),
    // The war-rune painted big across the back of the hide, in the same glowing teal.
    paint(runeOnTrunk(MR, 'dagaz', 1.12, 270, 0.34, 0.11, 'water', 'crystal')),
    // Shag across the back under the shoulders, and the ragged hem.
    ...Array.from({ length: 7 }, (_, q) => {
      const d = 210 + q * 20, { p, n: nn } = onTrunk(MR, 1.6, d, 0.0);
      return taper([p, add(p, add(scale(nn, 0.24), [0, 0, -0.3]))], 0.15, 0.02, 4, q % 2 ? 'feather' : 'featherDark');
    }),
    ...Array.from({ length: 7 }, (_, q) => {
      const d = 204 + q * 22, { p, n: nn } = onTrunk(MR, 0.42, d, 0.02);
      return taper([p, add(p, add(scale(nn, 0.12), [0, 0, -0.22 - 0.3 * Math.abs(Math.sin(d * (Math.PI / 180))) - (q % 2) * 0.1]))], 0.16, 0.02, 4, q % 2 ? 'featherDark' : 'feather');
    }),
    ...Array.from({ length: 9 }, (_, q) => {
      const d = -30 + q * 30, { p, n: nn } = onTrunk(MR, 1.84 - 0.3 * Math.abs(Math.cos(d * (Math.PI / 180))), d, 0.02);
      if (Math.sin(d * (Math.PI / 180)) > 0.55) return null;
      return taper([p, add(p, add(scale(nn, 0.36), [0, 0, 0.22 + (q % 2) * 0.12]))], 0.17, 0.02, 4, q % 2 ? 'featherDark' : 'feather');
    }),
  );
  const belt = tube([[0, 0.04, -0.12], [0, 0.04, 0.08]], 0.7, 0.62, n, 'leatherDark', { up: [0, 1, 0] });
  // A kilt of hide strips, each hanging on its own.
  const strips = hung([-150, -110, -70, -30, 30, 70, 110, 150, 190, 230, 270, 310].map((d, q) => {
    const t = d * (Math.PI / 180), o: V3 = [Math.cos(t) * 0.7, Math.sin(t) * 0.62, 0];
    const out = unit([o[0], o[1], 0]), long = 0.42 + (q % 3) * 0.08;
    return { m: tube([add(o, [0, 0, 0]), add(o, add(scale(out, 0.08), [0, 0, -long]))], [0.17, 0.14], [0.04, 0.035], 4, q % 2 ? 'leatherDark' : 'leather', { up: out }), at: o, out, len: long, w: 0.15 };
  }));
  const F = C_FACE;
  const face = orcHead(F, n, k, 'crystal');
  // War paint: a teal band across the eyes and the protection-rune up the brow; a long topknot swept back, tied with a bone pin.
  const paintFace = paint([
    ...rune('algiz', onEgg(F.c, F.r, [0, 0.62, 0.78]).p, onEgg(F.c, F.r, [0, 0.62, 0.78]).n, [0, -0.3, 1], 0.14, 0.06, 'water', 'crystal'),
    ...[1, -1].map((s) => { const { p, n: nn } = onEgg(F.c, F.r, [s * 0.62, 0.72, 0.02]); return disc(add(p, scale(nn, 0.01)), nn, 0.2, 0.06, 6, 'water', { lit: true, up: [0, 0, 1] }); }),
  ]);
  const knot = merge(
    orb(add(F.c, [0, -0.2, 0.62]), [0.2, 0.2, 0.2], 7, 3, 'hair'),
    tube(curve(add(F.c, [0, -0.36, 0.7]), add(F.c, [0, -0.86, 0.66]), add(F.c, [0, -0.92, -0.2]), 4), [0.15, 0.14, 0.12, 0.1, 0.04], [0.15, 0.14, 0.12, 0.1, 0.04], 5, 'hair'),
    orb(add(F.c, [0, -0.86, 0.36]), 0.1, 5, 3, 'crystal'),
    orb(add(F.c, [0, -0.9, 0.02]), 0.09, 5, 3, 'tooth'),
    taper([add(F.c, [-0.3, -0.2, 0.7]), add(F.c, [0.3, -0.2, 0.74])], 0.04, 0.03, 4, 'tooth'),
  );
  // The totem: a gnarled staff; a crossbar near its head hung with two little rune tablets and red ribbons; a horned skull at its head
  // with a teal crystal set between the horns.
  const S = C_STAFF, top = S.top;
  const SK = 1.4, skullC: V3 = [0, 0.1, top + 0.24];
  const sk = (v: V3): V3 => add(skullC, scale(v, SK));
  const tablet = (x: number, glyph: string): Mesh => {
    const c: V3 = [x, 0.02, top - 0.72];
    return merge(
      tube([add(c, [0, 0, 0.3]), add(c, [0, 0, 0.12])], 0.02, 0.02, 4, 'leatherDark'),
      tube([add(c, [0, 0, 0.12]), add(c, [0, 0, -0.16])], 0.1, 0.035, 4, 'stone', { up: [0, 1, 0] }),
      paint(rune(glyph, add(c, [0, 0.04, -0.02]), [0, 1, 0], [0, 0, 1], 0.09, 0.04, 'water', 'crystal')),
    );
  };
  const staff = merge(
    tube([[0, 0, S.foot], [0.04, 0.02, -0.3], [-0.03, 0, 0.6], [0.04, -0.02, 1.4], [0, 0, top - 0.1]], [0.07, 0.08, 0.075, 0.08, 0.09], [0.07, 0.08, 0.075, 0.08, 0.09], 6, 'wood'),
    wraps(-0.25, 0.2, 0.095, 3, 6, 'cloth', 'leatherDark'),
    tube([[-0.42, 0, top - 0.42], [0.42, 0, top - 0.42]], 0.05, 0.05, 5, 'woodDark'),
    tablet(-0.34, 'kenaz'), tablet(0.34, 'algiz'),
    ...[-0.2, 0.2].map((x) => tube([[x, 0, top - 0.42], [x * 1.3, 0.04, top - 0.85], [x * 1.1, 0.08, top - 1.15]], [0.06, 0.05, 0.03], 0.012, 4, 'cloth', { up: [0, 1, 0] })),
    orbAlong(skullC, [0, 1, 0.15], scale([0.26, 0.3, 0.24], SK), 7, 3, 'tooth'),
    orbAlong(sk([0, 0.3, -0.06]), [0, 1, -0.1], scale([0.15, 0.2, 0.12], SK), 5, 3, 'tooth'),
    paint([1, -1].map((s) => disc(sk([s * 0.11, 0.27, 0.05]), [s * 0.4, 1, 0.1], 0.07 * SK, 0.06 * SK, 6, 'eye'))),
    ...[1, -1].map((s) => taper(curve(sk([s * 0.2, -0.04, 0.12]), sk([s * 0.62, -0.1, 0.18]), sk([s * 0.66, 0.06, 0.66]), 3), 0.1 * SK, 0.02, 5, (ring) => (ring >= 3 ? 'hornDark' : 'horn'))),
    orbAlong(sk([0, -0.02, 0.42]), [0, 0, 1], scale([0.1, 0.1, 0.2], SK), 6, 3, 'crystal'),
  );
  const hold = chanterHold();
  const hide = [{ c: F.c, r: F.r }];
  return [
    { key: 'hips', mesh: orb([0, 0, 0], [0.7, 0.58, 0.5], 7, 3, 'leatherDark'), bone: 'body', bias: 0 },
    { key: 'strips', mesh: strips.mesh, bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips'], bent: swingClear(chanterBones, strips.hang, C_LIMBS) },
    { key: 'body', mesh: merge(chest, belt), bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.8], k: 0.05 } },
    // Drawn after the head where it is before it (from behind), and hidden by the head where it is behind it.
    { key: 'mantle', mesh: mantle, bone: 'chest', bias: 0.03, after: ['body', 'arm0', 'arm1', 'staff', 'fore1', 'hand1', ...C_HEADS], front: [0, -1, 0], hide, hideIn: 'head' },
    { key: 'head', mesh: merge(face.head, paintFace), shut: merge(face.shut, paintFace), bone: 'head', bias: 0.2 },
    { key: 'jaw', mesh: face.jaw, bone: 'jaw', bias: 0.205, after: 'head' },
    { key: 'brows', mesh: face.brows, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear0', mesh: ear(F, -1, 0.7, n), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ear(F, 1, 0.7, n), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'knot', mesh: knot, bone: 'head', bias: 0.19, hide },
    { key: 'staff', mesh: hold.mesh(staff), bone: 'hand1', bias: 0.05, after: ['hand1', ...C_HEADS], front: [1, 0.4, 0], hide, hideIn: 'head' },
    ...limbs({
      n, ...C_LIMBS, head: hide[0], heads: C_HEADS, hands: [hand(C_LIMBS.hand, 0.4, n), fist(0.3, n)], foot: bareFoot(C_LIMBS.foot[0], C_LIMBS.foot[1], n),
      wear: {
        arm0: paint(runeOnLimb('laguz', -0.4, 150, 0.31, 0.16, 0.06, 'water', 'crystal')),
        arm1: paint(runeOnLimb('laguz', -0.4, 30, 0.31, 0.16, 0.06, 'water', 'crystal')),
        elbow0: merge(wraps(-0.45, -0.8, 0.29, 3, Math.max(7, n - 4), 'leather', 'leatherDark'), paint(runeOnLimb('ingwaz', -0.22, 90, 0.27, 0.12, 0.05, 'water', 'crystal'))),
        elbow1: wraps(-0.45, -0.8, 0.29, 3, Math.max(7, n - 4), 'leather', 'leatherDark'),
        ll0: paint(runeOnLimb('kenaz', -0.4, 100, 0.33, 0.14, 0.06, 'water', 'crystal')),
        lr0: paint(runeOnLimb('kenaz', -0.4, 80, 0.33, 0.14, 0.06, 'water', 'crystal')),
        ll1: wraps(-0.25, -0.62, 0.29, 2, Math.max(7, n - 4), 'leather', 'leatherDark'),
        lr1: wraps(-0.25, -0.62, 0.29, 2, Math.max(7, n - 4), 'leather', 'leatherDark'),
      },
    }),
  ];
}

/** How the chanter holds its staff: upright before its right shoulder, its foot on the ground. */
function chanterHold(): ReturnType<typeof heldIn> {
  return heldIn(chanterBones(STILL).hand1, [0, 0.02, -0.25], [0.06, 0.04, 1], [0, 1, 0]);
}
let C_HEAD: { crystal: V3; foot: V3 } | undefined;
const C_LIGHTS: RuneLight[] = [
  { bone: 'chest', ...onTrunk(C_RINGS, 0.98, 90, 0.05), r: 0.8, a: 0.36 },
  { bone: 'chest', ...onTrunk(C_MANTLE, 1.12, 270, 0.06), r: 0.9, a: 0.36 },
  { bone: 'chest', ...onTrunk(C_RINGS, 0.95, 270, 0.05), r: 0.7, a: 0.3 },
].map((l) => ({ bone: l.bone, p: l.p, n: l.n, r: l.r, a: l.a }));

function chanterBones(a: Anim): Bones {
  return bipedBones(C_SPEC, a, (p: BipedPose) => {
    // The staff upright in the right fist before the shoulder, the forearm forward; the left hand open at its side.
    const run = a.gait * a.go;
    p.arms[1] = [p.arms[1][0] * 0.3 + 14 + 4 * run, p.arms[1][1] + 16, p.arms[1][2] + 62];
    p.arms[0] = [p.arms[0][0], p.arms[0][1] + 10, p.arms[0][2] + 20];
    if (a.act?.kind === 'strike') {
      const t = a.act.t;
      // The staff lifted high, still upright, the chanter reared back with its left hand flung up; stamped down so its foot strikes the
      // ground; the left hand thrust out ahead over it, palm first.
      const wind = ramp(t, 0.02, 0.34) * (1 - ramp(t, C_HIT - 0.1, C_HIT));
      const slam = ramp(t, C_HIT - 0.1, C_HIT) * (1 - ramp(t, 0.76, 1));
      const [f1, o1, e1] = p.arms[1];
      // Both lifted out to the sides of the head, not past it: the staff hand up and out, the left hand flung up wide.
      const still = 1 - a.go;
      p.arms[1] = toward(toward(p.arms[1], [f1 + 40, o1 - 14, e1 - 40], wind), [f1 - 4, o1 + 4, e1 + 4], slam);
      p.arms[0] = toward(toward(p.arms[0], [128, -40, 14], wind), [78, 16, 6], slam);
      const away = Math.cos((p.arms[0][0] + C_SPEC.arm.rest[0]) * (Math.PI / 180));
      p.arms[0][1] += away * 40 * (Math.sin(Math.PI * ramp(t, 0.02, 0.34)) * (1 - slam) + Math.sin(Math.PI * ramp(t, C_HIT - 0.1, C_HIT)));
      p.chest[0] += (-16 * wind + 10 * slam) * (1 - 0.5 * a.go);
      p.head[0] += 18 * wind - 10 * slam;
      p.jaw = Math.max(wind, slam);
      p.legs[0][0] += 12 * slam * still;
      p.legs[1][0] -= 10 * slam * still;
      p.legs[0][1] += 0.1 * slam * still;
      p.legs[1][1] += 0.1 * slam * still;
      return;
    }
    if (a.go > 0) return;
    const t = a.t;
    // Chanting: the staff lifted and thumped down on a slow beat, the head nodding to it and the left hand raised, open, swaying; and
    // twice a loop thrown back with the jaw wide, both arms up.
    const thump = Math.max(0, Math.sin((t * TAU * 12) / 24));
    p.arms[1][0] += 10 * thump;
    p.head[0] += 6 * thump;
    const raise = 0.5 + 0.5 * cyc(t, 3);
    p.arms[0] = [p.arms[0][0] + 44 * raise, p.arms[0][1] + 28 * raise + 6 * cyc(t, 12), p.arms[0][2] + 52 * raise];
    const cry = beat(t, [8.0, 20.0], 2.0);
    p.head[0] += 26 * cry;
    p.chest[0] -= 14 * cry;
    p.jaw = Math.max(p.jaw, cry);
    // The left arm flung up and out to the side, above the shoulder and clear of the head.
    p.arms[0] = toward(p.arms[0], [24, 112, 14], cry);
    p.arms[1] = [p.arms[1][0] + 30 * cry, p.arms[1][1], p.arms[1][2]];
  });
}

/** How strongly the chanter's paint glows: steady, flaring at its cry and at the blow (steady so that standing about it is kept as few pictures). */
function chantGlow(a: Anim): number {
  if (a.act?.kind === 'strike') return 1 + 1.6 * hump(a.act.t, C_HIT, 0.24);
  return 1 + 0.8 * beat(a.t, [8.0, 20.0], 2.0);
}

const ORC_C: Kind = {
  bones: chanterBones,
  build: chanterBuild,
  palette: (coat, mark) => {
    // Ash: the variants' grey-green taken paler and greyer, a dead green that stands off the grass by having so little colour; the
    // paint a teal that glows.
    const hide = mix(pastel(coat, 120), [150, 166, 148], 0.7);
    return coatPalette(coat, mark, {
      ...GEAR,
      coat: hide, coatLight: lighter(hide, 0.2), coatDark: darker(hide, 0.26), belly: mix(hide, [226, 210, 196], 0.4), lid: darker(hide, 0.4), inner: darker(hide, 0.36),
      hair: [70, 58, 74], feather: [150, 122, 100], featherDark: [112, 90, 80], cloth: [204, 96, 88], stone: [214, 210, 200],
      water: [56, 168, 170], crystal: [170, 250, 236], horn: [226, 214, 186], hornDark: [140, 116, 104], eye: [58, 36, 54],
    }, 30);
  },
  shadow: [1.5, 1.2],
  stride: 1.5,
  size: 4.1 * MONSTER_GROWTH,
  blinks: 5,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    C_HEAD ??= ((h) => ({ crystal: h.pt([0, 0.08, C_STAFF.top + 0.6]), foot: h.pt([0, 0, C_STAFF.foot]) }))(chanterHold());
    const k = chantGlow(a);
    if (under) {
      // At the blow, a ring of teal light going out over the ground from where the staff's foot came down.
      if (a.act?.kind !== 'strike' || a.act.t < C_HIT - 0.02) return;
      const u = clamp((a.act.t - C_HIT + 0.02) / 0.45), at = place(b.hand1, C_HEAD.foot);
      const [x, y] = onScreen(view, [at[0], at[1], 0]);
      const r = 0.4 + 1.6 * u;
      g.save();
      g.strokeStyle = `rgba(150,250,230,${(0.8 * (1 - u)).toFixed(3)})`;
      g.lineWidth = 0.16 * (1 - u) + 0.04;
      g.beginPath();
      g.ellipse(x, y, r * Math.hypot(view.ex[0], view.ey[0]), r * Math.hypot(view.ex[1], view.ey[1]), 0, 0, TAU);
      g.stroke();
      g.restore();
      return;
    }
    runeLights(g, view, b, C_LIGHTS, [110, 240, 220], k);
    runeLights(g, view, b, [{ bone: 'hand1', p: C_HEAD.crystal, n: view.T, r: 0.9, a: 0.4 }].map((l) => ({ ...l, n: into(b.hand1, view.T) })), [120, 250, 230], k);
  },
};

/* ---- the three ---------------------------------------------------------------------- */

/** The orc's subspecies, one for each of its variants in their order: the Runebrand, the Ironshield and the War-chanter Orc. */
export const ORCS: readonly Kind[] = [ORC_A, ORC_B, ORC_C];

/**
 * What each subspecies' body is, as solids, in `ORCS`' order, for the tool that looks for an arm, a leg or what is held
 * passing through it (`tools/orc/clip.ts`): the trunk's rings on the chest, the hips and the head, lumps on the chest
 * (pauldrons), the flaps hanging from the belt, a cloak's rings, the limbs, and the pieces held.
 */
export interface OrcShape {
  trunk: readonly Ring[]; hips: { c: V3; r: V3 }; face: Face; limbs: Limbs; flaps: ReadonlyArray<[number, number, number]>;
  lumps: ReadonlyArray<{ bone: string; c: V3; r: V3 }>; cloak?: readonly Ring[]; held: readonly string[];
}
export const ORC_SHAPES: readonly OrcShape[] = [
  { trunk: A_RINGS, hips: { c: [0, 0, 0], r: [0.8, 0.62, 0.5] }, face: A_FACE, limbs: A_LIMBS, flaps: A_FLAPS, lumps: [], held: ['cleaver'] },
  {
    trunk: B_RINGS, hips: { c: [0, 0, 0], r: [0.82, 0.64, 0.56] }, face: B_FACE, limbs: B_LIMBS, flaps: B_FLAPS,
    lumps: [-1, 1].map((s) => ({ bone: 'chest', c: [s * 1.42, 0.06, 1.72] as V3, r: [0.62, 0.6, 0.26] as V3 })), held: ['axe', 'shield'],
  },
  { trunk: C_RINGS, hips: { c: [0, 0, 0], r: [0.7, 0.58, 0.5] }, face: C_FACE, limbs: C_LIMBS, flaps: [], lumps: [], cloak: C_MANTLE, held: ['staff'] },
];
