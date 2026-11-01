import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import {
  css, domeOf, eyeOf, facing, hump, inPlane, jitter, kneeOf, len3, mirroredMesh, mixV, nearSide, onShell, pxOf, ramp, strip, swirlOn,
  thrown, wound, type Shell,
} from './wild-moss';

/**
 * The log line: the Lognib, a small rhinoceros beetle of a hermit crab under a high domed shell of overlapping plates,
 * cream-gold with olive moss patches, on six short dark legs banded in gold, a cream face plate with big dark eyes and one
 * dark curved horn sweeping up and back off its head, tipped gold; which grows into the Timbersplit, bigger and longer on
 * longer armoured legs, its dome mossy on top and edged cream, a broad notched crest up off its back, a pointed gold head
 * plate over a small eye, and its horn a crescent blade curving forward and up, dark, edged gold, toothed along the inside;
 * and then the Beammaster, big and heavy, a cream band with a green swirl round its dome, a tall notched crest, thick
 * armoured forelegs and a massive crescent saw of a horn. The species is still `carra` underneath, as saves and the database
 * know it: the timber maker.
 *
 * All three are built by one set of functions from a description of the stage (`Log`), on the shell, the moss and the eyes of
 * the moss line (`./wild-moss`). Its front is `y`, its right `x`, up `z`. Six legs, three a side, go in two sets of three by
 * turns -- a scuttle; each foot stays where it was put while it is down.
 *
 * At its task it works a log in front of it: the Lognib gets its forelegs over a log lying across before it and drags it back,
 * twice; the Timbersplit and the Beammaster rear, bring the horn down into a log lying along before them and saw it down
 * through, shavings flying, till it falls apart in two.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Three legs a side, front to back: hips across, up and along; each foot's turn from straight out (degrees, forward positive); the leg's two parts; how far out a foot stands; how thick; the forelegs' thickness over the rest. */
interface Legs { x: number; z: number; ys: number[]; fan: number[]; upper: number; lower: number; reach: number; thick: number; fore: number }

/** The Lognib's horn: a curved spike off the top of its head (head frame): root, bend, tip, and how thick at its root. */
interface Spike { root: V3; mid: V3; tip: V3; w: number }

/**
 * The bigger two's horn: a crescent blade on a stem up off the snout (head frame). `c` is the middle of its arc, `R` its outer
 * radius; it runs from `a1` (degrees from forward, toward up: its upper tip, swept back) over the top and down to `a0` (its lower
 * tip, forward); `w` how deep the blade is at its deepest; `teeth` along its inside; the stem from `root` up into it.
 */
interface Crescent { c: V3; R: number; a0: number; a1: number; w: number; teeth: number; root: V3; stem: number }

/** The crest up off its back: how far along the shell its foot is, how high it stands, how long back, how wide its foot. */
interface Crest { u: number; h: number; back: number; foot: number }

/** The log it works: lying across before it (the Lognib's) or along (the bigger two's); a log or a squared beam; its radius or half-side; its length. */
interface Prop { across: boolean; beam: boolean; r: number; len: number }

interface Log {
  stage: 0 | 1 | 2;
  /** How high its middle is carried, standing. */
  high: number;
  shell: Shell;
  /** The body under it: dark brown, in rings. */
  belly: { c: V3; r: V3 };
  /** The head: its middle on the body, its half-sizes, the right eye's way out of it and its size. */
  head: { at: V3; r: V3; eye: V3; size: number };
  spike: Spike | null;
  crescent: Crescent | null;
  crest: Crest | null;
  /** Moss cushions along its top: from and to (along), how wide (radians either side of the top), how big, how many rows. */
  moss: { from: number; to: number; wide: number; deep: number; clumps: number } | null;
  /** Olive patches on its plates: how many to a plate a side, and how big. */
  patches: { n: number; big: number };
  /** The Beammaster's cream band round the foot of its dome, with a green swirl on it. */
  band: boolean;
  legs: Legs;
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; bob: number; sway: number };
  prop: Prop;
  size: number;
}

/** A Lognib: small, a high dome of three plates, one horn up and back off its head, a big-eyed cream face, short legs. */
const LOGNIB_LOOK: Log = {
  stage: 0,
  high: 0.2,
  shell: { y0: -0.58, y1: 0.66, cut: 0.9, w: 0.56, h: 0.4, z0: 0.0, segs: 3, step: 0.07, lo: 0.3, flare: 0.5, p: 2.0 },
  belly: { c: [0, 0.04, -0.03], r: [0.33, 0.48, 0.16] },
  head: { at: [0, 0.6, -0.04], r: [0.2, 0.18, 0.17], eye: [0.42, 0.85, 0.1], size: 0.05 },
  spike: { root: [0, 0.08, 0.12], mid: [0, 0.36, 0.58], tip: [0, -0.14, 0.68], w: 0.11 },
  crescent: null,
  crest: null,
  moss: null,
  patches: { n: 2, big: 0.13 },
  band: false,
  legs: { x: 0.3, z: -0.05, ys: [0.26, 0.0, -0.26], fan: [52, 6, -48], upper: 0.17, lower: 0.21, reach: 0.35, thick: 0.07, fore: 1 },
  gait: { sweep: [0.2, 0.28], duty: [0.58, 0.5], lift: [0.06, 0.08], bob: 0.018, sway: 3 },
  prop: { across: true, beam: false, r: 0.11, len: 0.56 },
  size: 5.4,
};

/** A Timbersplit: longer, on longer armoured legs; moss on its dome, a notched crest, a pointed gold head plate, a crescent blade. */
const TIMBERSPLIT_LOOK: Log = {
  stage: 1,
  high: 0.4,
  shell: { y0: -0.88, y1: 0.9, cut: 0.88, w: 0.82, h: 0.5, z0: 0.04, segs: 4, step: 0.05, lo: 0.22, flare: 0.45, p: 2.1 },
  belly: { c: [0, 0.04, -0.05], r: [0.56, 0.72, 0.22] },
  head: { at: [0, 0.98, -0.02], r: [0.24, 0.3, 0.22], eye: [0.62, 0.6, 0.12], size: 0.045 },
  spike: null,
  crescent: { c: [0, 0.28, 0.16], R: 0.54, a0: -22, a1: 150, w: 0.36, teeth: 6, root: [0, 0.24, -0.02], stem: 0.1 },
  crest: { u: 0.8, h: 0.46, back: 0.62, foot: 0.3 },
  moss: { from: 0.08, to: 0.9, wide: 0.7, deep: 0.12, clumps: 10 },
  patches: { n: 2, big: 0.17 },
  band: false,
  legs: { x: 0.46, z: -0.06, ys: [0.36, -0.04, -0.44], fan: [48, 4, -50], upper: 0.32, lower: 0.42, reach: 0.64, thick: 0.11, fore: 1.1 },
  gait: { sweep: [0.26, 0.36], duty: [0.6, 0.52], lift: [0.06, 0.09], bob: 0.022, sway: 2.5 },
  prop: { across: false, beam: false, r: 0.17, len: 1.0 },
  size: 5.0,
};

/** A Beammaster: big and heavy, a cream band with a swirl round its dome, moss on top, a tall crest, thick forelegs, a massive saw-horn. */
const BEAMMASTER_LOOK: Log = {
  stage: 2,
  high: 0.48,
  shell: { y0: -1.18, y1: 1.12, cut: 0.88, w: 1.1, h: 0.7, z0: 0.04, segs: 4, step: 0.05, lo: 0.2, flare: 0.45, p: 2.1 },
  belly: { c: [0, 0.04, -0.06], r: [0.74, 0.92, 0.28] },
  head: { at: [0, 1.22, 0.0], r: [0.32, 0.38, 0.28], eye: [0.62, 0.6, 0.12], size: 0.055 },
  spike: null,
  crescent: { c: [0, 0.36, 0.22], R: 0.8, a0: -24, a1: 150, w: 0.54, teeth: 8, root: [0, 0.3, -0.02], stem: 0.14 },
  crest: { u: 0.78, h: 0.62, back: 0.86, foot: 0.42 },
  moss: { from: 0.06, to: 0.9, wide: 0.66, deep: 0.15, clumps: 12 },
  patches: { n: 1, big: 0.2 },
  band: true,
  legs: { x: 0.6, z: -0.1, ys: [0.48, -0.06, -0.6], fan: [48, 4, -50], upper: 0.38, lower: 0.5, reach: 0.78, thick: 0.15, fore: 1.3 },
  gait: { sweep: [0.3, 0.42], duty: [0.64, 0.54], lift: [0.07, 0.1], bob: 0.028, sway: 2 },
  prop: { across: false, beam: true, r: 0.2, len: 1.2 },
  size: 5.2,
};

/* ---- shapes ---------------------------------------------------------------------------- */

/** A flat slab from an outline in the plane square to `x` (its `y` and `z`), `t` thick: its two faces and its edge, all of `m`. */
function slab(outline: Array<[number, number]>, t: number, m: Mat, edge: Mat = m): Mesh {
  const n = outline.length, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const [y, z] of outline) v.push([t / 2, y, z]);
  for (const [y, z] of outline) v.push([-t / 2, y, z]);
  f.push({ i: Array.from({ length: n }, (_, q) => q), m });
  want.push([1, 0, 0]);
  f.push({ i: Array.from({ length: n }, (_, q) => n + q), m });
  want.push([-1, 0, 0]);
  let area = 0;
  for (let j = 0; j < n; j++) { const [y0, z0] = outline[j], [y1, z1] = outline[(j + 1) % n]; area += y0 * z1 - y1 * z0; }
  const turn = area > 0 ? 1 : -1;
  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    f.push({ i: [j, j2, n + j2, n + j], m: edge });
    want.push([0, turn * (outline[j2][1] - outline[j][1]), -turn * (outline[j2][0] - outline[j][0])]);
  }
  return mesh(v, wound(v, f, want));
}
/** A painted shape on both faces of a slab `t` thick, from its outline. */
function onSlab(outline: Array<[number, number]>, t: number, m: Mat, out: Disc[]): void {
  for (const sd of [1, -1]) out.push(facing(outline.map(([y, z]) => [sd * (t / 2 + 0.003), y, z] as V3), [sd, 0, 0], m));
}

/* ---- the shell and what is on it ---------------------------------------------------------- */

/** The moss line's dome, cream only round its rim: the band along each plate's back edge gold as the rest. */
function plated(S: Shell, m: Mesh): Mesh {
  return mesh(m.v, m.f.map((f) => {
    if (f.m === 'shellDark') return { ...f, m: 'mark' as Mat };
    if (f.m !== 'mark') return f;
    const z = f.i.reduce((t, i) => t + m.v[i][2], 0) / f.i.length;
    return z > S.z0 + S.h * 0.16 ? { ...f, m: 'coat' as Mat } : f;
  }));
}

/** A blob painted on the shell round `u`, `ph`: `ru` along and `rp` round, ragged. */
function blobOn(S: Shell, u: number, ph: number, ru: number, rp: number, id: number, m: Mat, out: Disc[], lo = 0, hi = S.cut): void {
  const c = onShell(S, u, ph), ring: V3[] = [];
  for (let q = 0; q < 16; q++) {
    const a = (q / 16) * TAU, rr = 0.55 + 0.35 * jitter(id * 5 + Math.floor(q / 2)) + 0.25 * jitter(id * 7 + q) + 0.2 * Math.sin(a * 3 + id);
    const at = onShell(S, clamp(u + Math.cos(a) * ru * rr, lo, hi), ph + Math.sin(a) * rp * rr);
    ring.push(add(at.p, scale(at.n, 0.008)));
  }
  out.push(facing(ring, c.n, m));
}

/**
 * Its plates' markings: olive moss patches high on each plate's flanks; the Beammaster's cream band round the foot of its dome
 * with a big green swirl on each flank.
 */
function shellMarks(s: Log): Mesh {
  const S = s.shell, out: Disc[] = [];
  const L = S.cut / S.segs;
  if (s.band) {
    // A broad cream band round the lower dome, along both flanks, the swirl on it over the middle plates.
    for (const sd of [1, -1]) {
      for (let j = 0; j < S.segs; j++) {
        const ring: V3[] = [];
        const u0 = j * L + L * 0.16, u1 = (j + 1) * L - 0.012;
        const lo = sd > 0 ? 0.02 : Math.PI - 0.82, hi = sd > 0 ? 0.82 : Math.PI - 0.02;
        for (let q = 0; q <= 6; q++) ring.push(onShell(S, lerp(u0, u1, q / 6), hi - (sd > 0 ? 0.08 * Math.sin(Math.PI * q / 6) : 0)).p);
        for (let q = 6; q >= 0; q--) ring.push(onShell(S, lerp(u0, u1, q / 6), lo).p);
        const c = onShell(S, (u0 + u1) / 2, (lo + hi) / 2);
        out.push(facing(ring.map((p) => add(p, scale(unit(sub(p, [0, p[1], S.z0])), 0.006))), c.n, 'mark'));
      }
      const ph = sd > 0 ? 0.44 : Math.PI - 0.44;
      swirlOn(S, S.cut * 0.42, ph, 0.36, 0.06, sd, out, 'spot');
    }
  }
  // Olive patches on each plate, each side, high on it; on the Beammaster's above its band.
  for (let j = 0; j < S.segs; j++) {
    for (const sd of [1, -1]) {
      for (let e = 0; e < s.patches.n; e++) {
        const id = j * 13 + e * 5 + (sd > 0 ? 0 : 3);
        const u = (j + 0.4 + 0.35 * jitter(id)) * L;
        const ph0 = s.band ? 1.08 : s.moss ? 0.55 + 0.4 * e : 0.45 + 0.55 * e;
        const ph = ph0 + 0.25 * (jitter(id + 1) - 0.5);
        blobOn(S, u, sd > 0 ? ph : Math.PI - ph, L * s.patches.big * 2.2, s.patches.big * (1.2 + 0.6 * jitter(id + 2)), id, 'spot', out, j * L + L * 0.17, (j + 1) * L - 0.01);
      }
    }
  }
  // The Lognib's: a patch over the top of each plate too.
  if (!s.moss) for (let j = 0; j < S.segs; j++) blobOn(S, (j + 0.6) * L, Math.PI / 2 + 0.2 * (jitter(j + 40) - 0.5), L * 0.25, 0.3, 60 + j, 'spot', out, j * L + L * 0.17, (j + 1) * L - 0.01);
  return paint(out);
}

/** The body under the shell: dark brown, in creased rings. */
function bellyOf(s: Log, n: number, k: number): Mesh {
  const B = s.belly;
  const m = orb(B.c, B.r, n + 2, k, 'bark');
  const out: Disc[] = [];
  for (let q = 0; q < 6; q++) {
    const y = B.c[1] + B.r[1] * lerp(-0.75, 0.7, q / 5);
    for (const sd of [1, -1]) {
      const e = onEgg(B.c, B.r, [sd * 0.9, (y - B.c[1]) / B.r[1], -0.2]);
      out.push(disc(add(e.p, scale(e.n, 0.008)), e.n, B.r[0] * 0.08, B.r[2] * 0.7, 6, 'hornDark'));
    }
  }
  return merge(m, paint(out));
}

/**
 * A cushion of moss: a low mound of soft round tufts, each dark at its foot with a bright yellow-green top, round `c` on a
 * surface facing `n`, `R` across.
 */
function cushionOf(c: V3, n: V3, R: number, id: number, fine: boolean): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (len3(x) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const out: Mesh[] = [], flecks: Disc[] = [];
  const lump = (p: V3, r: V3, j: number): void => {
    out.push(orbAlong(p, z, r, fine ? 8 : 6, 3, 'moss'));
    // Bright yellow-green on its top, in flecks.
    for (let e = 0; e < (fine ? 4 : 2); e++) {
      const a = jitter(j * 7 + e) * TAU, k = 0.25 + 0.45 * jitter(j * 3 + e);
      const at = onEgg(p, [r[0], r[1], r[2]], add(add(scale(x, Math.cos(a) * k), scale(y, Math.sin(a) * k)), scale(z, 1)));
      const wz = unit(at.n);
      flecks.push(disc(add(at.p, scale(wz, 0.004)), wz, r[0] * (0.22 + 0.12 * jitter(j + e)), r[0] * (0.16 + 0.08 * jitter(j * 2 + e)), 6, 'leaf', { up: z }));
    }
  };
  lump(c, [R * 0.95, R * 0.9, R * 0.4], id);
  const n2 = fine ? 4 : 3;
  for (let q = 0; q < n2; q++) {
    const a = (q / n2) * TAU + jitter(id + q) * 1.2, rr = R * (0.45 + 0.15 * jitter(id * 3 + q)), r = R * (0.32 + 0.12 * jitter(id * 7 + q));
    lump(add(add(c, add(scale(x, Math.cos(a) * rr), scale(y, Math.sin(a) * rr))), scale(z, R * 0.2)), [r, r, r * 0.7], id * 5 + q + 1);
  }
  return merge(...out, paint(flecks));
}

/** The moss along its top: cushions from `from` to `to`, the widest over its middle, set either side of the ridge by turns. */
function mossOf(s: Log, fine: boolean): Mesh {
  const S = s.shell, M = s.moss!, out: Mesh[] = [];
  const across = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
  for (let q = 0; q < M.clumps; q++) {
    const k = M.clumps > 1 ? q / (M.clumps - 1) : 0.5;
    const swell = Math.sin(Math.PI * clamp(lerp(0.08, 0.92, k)));
    across.forEach((a, j) => {
      const id = 90 + q * 11 + j;
      if (Math.abs(a) > 0.5 + 0.75 * swell || jitter(id + 3) < 0.06) return;
      const u = clamp(lerp(M.from, M.to, k + (jitter(id) - 0.5) * 0.7 / M.clumps), 0.02, 0.98) * S.cut;
      const side = a * M.wide * (0.85 + 0.2 * jitter(id + 1)) * (0.6 + 0.4 * swell);
      const at = onShell(S, u, Math.PI / 2 - side);
      const R = M.deep * (0.8 + 0.4 * swell) * (0.8 + 0.4 * jitter(id + 2)) * (Math.abs(a) > 1 ? 0.8 : 1);
      out.push(cushionOf(add(at.p, scale(at.n, R * 0.05)), at.n, R, id, fine));
    });
  }
  return merge(...out);
}

/**
 * The crest up off its back: a broad leaf of a fin standing along its middle, its foot in the moss, rising to a tip swept far
 * back and a lesser one forward, its top edge between them notched; gold, edged cream, a green patch in it.
 */
function crestOf(s: Log): Mesh {
  const C = s.crest!, S = s.shell;
  const at = onShell(S, C.u * S.cut, Math.PI / 2);
  const H = C.h, B = C.back, F = C.foot, top = S.z0 + S.h;
  // How high the shell's ridge is at `y`.
  const ridge = (y: number): number => onShell(S, clamp((y - S.y0) / (S.y1 - S.y0), 0.01, S.cut), Math.PI / 2).p[2];
  // The outline: a sickle of a fin up off the shell, leaning back, its leading edge rising to a short hooked tip forward and two
  // notches over it, its top running back to a long point (along from its foot, up from the top of the shell).
  const o: Array<[number, number]> = [
    [F * 0.34, -9], [F * 0.3, H * 0.34], [F * 0.2, H * 0.6], [F * 0.62, H * 0.94], [F * 0.22, H * 0.84], [F * 0.16, H * 0.98],
    [-B * 0.04, H * 0.9], [-B * 0.12, H * 1.03], [-B * 0.36, H * 1.08], [-B * 0.7, H * 1.04], [-B, H * 0.92],
    [-B * 0.74, H * 0.8], [-B * 0.5, H * 0.62], [-B * 0.32, H * 0.4], [-B * 0.24, -9],
  ];
  const outline = o.map(([y, z]): [number, number] => {
    // Leaning back the higher it goes.
    const yy = at.p[1] + y - (z === -9 ? 0 : z) * 0.35;
    return [yy, z === -9 ? at.p[2] - 0.05 : Math.max(top + z, ridge(yy) + 0.02)];
  });
  const t = 0.035 + 0.02 * s.stage;
  const body = slab(outline, t, 'mark', 'shellDark');
  const marks: Disc[] = [];
  // Gold within a cream edge, and an olive patch in the middle of it.
  const mid: [number, number] = [at.p[1] - B * 0.15 - H * 0.2, top + H * 0.6];
  const inset = (k: number): Array<[number, number]> => outline.map(([y, z]) => [lerp(y, mid[0], k), lerp(z, mid[1], k)]);
  onSlab(inset(0.14).map(([y, z]) => [y, Math.max(z, at.p[2] + 0.02)]), t, 'coatLight', marks);
  const low = outline.filter(([, z]) => z < top + H * 0.55).map(([y, z]): [number, number] => [lerp(y, mid[0], 0.2), Math.max(z, at.p[2] + 0.02)]);
  if (low.length > 2) for (const sd of [1, -1]) marks.push(facing(low.map(([y, z]) => [sd * (t / 2 + 0.006), y, z] as V3), [sd, 0, 0], 'spot'));
  return merge(body, paint(marks));
}

/* ---- the head ------------------------------------------------------------------------- */

/**
 * The Lognib's head: a cream face plate, rounded, a little flat in front, a moss fleck on its brow; big dark eyes either side of
 * its face, amber in them, a glint in each; a small dark mouth.
 */
function faceHead(s: Log, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, r = H.r, c: V3 = [0, 0, 0];
  const b = orb(c, r, n + 2, k + 1, 'mark');
  // Flattened a little in front and drawn down to a blunt muzzle.
  const skull = mesh(b.v.map((p): V3 => {
    const d = p[1] / r[1];
    return [p[0] * (1 - 0.12 * Math.max(0, d)), p[1] * (d > 0 ? 0.86 : 1), p[2] - r[2] * 0.12 * Math.max(0, d) ** 2];
  }), b.f);
  const back = orb([0, -r[1] * 0.45, -r[2] * 0.1], [r[0] * 0.9, r[1] * 0.6, r[2] * 0.85], n, k, 'bark');
  const marks: Disc[] = [];
  const brow = onEgg(c, r, [0.3, 0.4, 1]);
  marks.push(disc(add(brow.p, scale(brow.n, 0.008)), brow.n, r[0] * 0.2, r[1] * 0.16, 7, 'spot', { up: [0, 1, 0] }));
  const cheek = onEgg(c, r, [-0.75, 0.5, -0.35]);
  marks.push(disc(add(cheek.p, scale(cheek.n, 0.008)), cheek.n, r[0] * 0.14, r[1] * 0.1, 6, 'spot'));
  for (const sd of [1, -1]) {
    const e = onEgg(c, r, [sd * H.eye[0], H.eye[1], H.eye[2]]);
    const p = add(e.p, scale(e.n, 0.008));
    if (shut) marks.push(disc(p, e.n, H.size * 1.1, H.size * 0.25, 8, 'hornDark', { up: [0, 0, 1] }));
    else eyeOf(p, e.n, H.size, marks, true);
  }
  const m0 = onEgg(c, r, [-0.22, 1, -0.6]), m1 = onEgg(c, r, [0, 1, -0.5]), m2 = onEgg(c, r, [0.22, 1, -0.6]);
  marks.push(strip(add(m0.p, scale(m0.n, 0.008)), add(m1.p, scale(m1.n, 0.008)), m1.n, 0.007, 'hornDark'), strip(add(m1.p, scale(m1.n, 0.008)), add(m2.p, scale(m2.n, 0.008)), m1.n, 0.007, 'hornDark'));
  return merge(back, skull, paint(marks));
}

/**
 * The bigger two's head: a dark brown face, a gold plate over it from its crown forward to a point over the snout with two
 * spikes up off its back edge, a gold plate under each eye pointed down, and a small amber eye in a dark socket between.
 */
function armourHead(s: Log, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, r = H.r;
  const fr: V3 = [r[0] * 0.84, r[1] * 0.92, r[2] * 0.8], fc: V3 = [0, 0, -r[2] * 0.12];
  const face = orb(fc, fr, n + 2, k, 'bark');
  // A snout out in front, dark.
  const snout = orbAlong([0, r[1] * 0.7, -r[2] * 0.2], [0, 1, -0.1], [r[0] * 0.5, r[1] * 0.45, r[2] * 0.45], n, k, 'bark');
  // The plate: an egg over the top, its front pulled forward and down to a point, cut away below its middle.
  const b = orb([0, 0, 0], r, n + 4, k + 2, 'coat');
  const v = b.v.map((p): V3 => {
    const d: V3 = [p[0] / r[0], p[1] / r[1], p[2] / r[2]];
    const fwd = Math.max(0, d[1]) ** 2 * Math.max(0, 1 - Math.abs(d[0]) * 1.2);
    // A ridge along its top, and its front drawn out to a point over the snout.
    return [p[0] * (1.08 - 0.4 * fwd), p[1] + r[1] * 0.75 * fwd, p[2] - r[2] * 0.5 * fwd + r[2] * 0.22 * Math.max(0, d[2]) * (1 - Math.abs(d[0]))];
  });
  const kept: Face[] = [];
  for (const f of b.f) {
    const mid = scale(f.i.reduce((t, i) => add(t, b.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d: V3 = [mid[0] / r[0], mid[1] / r[1], mid[2] / r[2]];
    if (d[2] < 0.12 && !(d[1] > 0.6 && Math.abs(d[0]) < 0.45 && d[2] > -0.3)) continue;
    kept.push(f);
  }
  const plate = mesh(v, kept);
  const bits: Mesh[] = [];
  // Two spikes up off its back edge, and a ridge of a third over its brow.
  for (const sd of [1, -1]) {
    // A broad pointed plate up off the back of the crown, swept back, flat to the side.
    const o: Array<[number, number]> = [[-r[1] * 0.2, r[2] * 0.45], [-r[1] * 0.75, r[2] * 1.75], [-r[1] * 0.95, r[2] * 0.3]];
    const fin = slab(o, r[0] * 0.12, 'coat', 'shellDark');
    const tip = paint([1, -1].map((x) => facing([[x * r[0] * 0.07, -r[1] * 0.75, r[2] * 1.75], [x * r[0] * 0.07, -r[1] * 0.5, r[2] * 1.2], [x * r[0] * 0.07, -r[1] * 0.82, r[2] * 1.1]], [x, 0, 0], 'mark')));
    bits.push(mesh(merge(fin, tip).v.map(([x, y, z]): V3 => [sd * r[0] * 0.5 + x + sd * (z - r[2] * 0.5) * 0.18, y, z]), merge(fin, tip).f));
  }
  // The cheek plates: a pointed gold plate under each eye, down and back.
  const cheek = (sd: number): Mesh => {
    const e = onEgg(fc, fr, [sd * 0.9, 0.35, -0.5]);
    const o = add(e.p, scale(e.n, 0.02));
    const down = unit([sd * 0.2, -0.35, -1]), along = unit([0, 1, -0.1]);
    const pts: V3[] = [add(o, scale(along, r[1] * 0.42)), add(o, scale(down, r[2] * 0.12)), add(add(o, scale(down, r[2] * 0.75)), scale(along, -r[1] * 0.15)), add(o, scale(along, -r[1] * 0.4))];
    const nn = e.n;
    const t = 0.02;
    const v2: V3[] = [...pts.map((p) => add(p, scale(nn, t))), ...pts.map((p) => sub(p, scale(nn, t)))];
    const f: Face[] = [{ i: [0, 1, 2, 3], m: 'coat' }, { i: [4, 5, 6, 7], m: 'coat' }];
    const want: V3[] = [nn, scale(nn, -1)];
    for (let j = 0; j < 4; j++) { f.push({ i: [j, (j + 1) % 4, 4 + ((j + 1) % 4), 4 + j], m: 'shellDark' }); want.push(sub(scale(add(pts[j], pts[(j + 1) % 4]), 0.5), o)); }
    return mesh(v2, wound(v2, f, want));
  };
  bits.push(cheek(1), cheek(-1));
  const marks: Disc[] = [];
  const top = onEgg([0, 0, r[2] * 0.06], r, [0, 0.45, 1]);
  marks.push(disc(add(top.p, scale(top.n, 0.012)), top.n, r[0] * 0.3, r[1] * 0.22, 8, 'spot', { up: [0, 1, 0] }));
  const eyes: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg(fc, fr, [sd * H.eye[0], H.eye[1], H.eye[2]]);
    const p = add(e.p, scale(e.n, 0.01));
    if (shut) eyes.push(disc(p, e.n, H.size * 1.2, H.size * 0.3, 8, 'hornDark', { up: [0, 0, 1] }));
    else eyeOf(p, e.n, H.size, eyes, true);
  }
  return merge(face, snout, paint(eyes), plate, paint(marks), ...bits);
}

/** The Lognib's horn: thick at its root on the top of its head, curving up and back to a point; dark brown, its tip gold. */
function spikeOf(s: Log, n: number): Mesh {
  const H = s.spike!;
  const N = 8;
  const pts = curve(H.root, H.mid, H.tip, N);
  const ws = pts.map((_, q) => H.w * (1 - 0.9 * (q / N) ** 1.1) + 0.004);
  return tube(pts, ws, ws.map((x) => x * 1.15), Math.max(6, n - 2), (ring) => (ring >= N - 2 ? 'coat' : ring >= N - 3 ? 'horn' : 'hornDark'));
}

/** The crescent's outline, head frame (along, up): its outer edge from upper tip to lower, and its inner edge, toothed. */
interface Moon { outer: Array<[number, number]>; gold: Array<[number, number]>; pale: Array<[number, number]>; inner: Array<[number, number]> }
function moonOf(C: Crescent): Moon {
  const N = 26, out: Moon = { outer: [], gold: [], pale: [], inner: [] };
  for (let q = 0; q <= N; q++) {
    const k = q / N, a = lerp(C.a1, C.a0, k) * DEG;
    const w = C.w * Math.sin(Math.PI * Math.min(1, 0.03 + k * 0.97)) ** 0.75 + 0.004;
    const tooth = k > 0.18 && k < 0.9 ? frac(k * C.teeth * 1.25) : 0;
    const bite = w * (1 - 0.34 * tooth * Math.min(1, w / (C.w * 0.4)));
    const at = (d: number): [number, number] => [C.c[1] + (C.R - d) * Math.cos(a), C.c[2] + (C.R - d) * Math.sin(a)];
    out.outer.push(at(0));
    out.gold.push(at(w * 0.13));
    out.pale.push(at(w * 0.7));
    out.inner.push(at(bite));
  }
  return out;
}
/**
 * The bigger two's horn: a stem up off the snout, dark, into a crescent blade that runs from a tip swept back over its head up
 * over the top and forward down to a tip before it; dark brown, a gold band along its back, pale toward its inside, toothed
 * along its inside.
 */
function crescentOf(s: Log, n: number): Mesh {
  const C = s.crescent!, M = moonOf(C);
  const t = C.R * 0.1, N = M.outer.length;
  // As strips across it, outer edge to inner, each a band of its own colour: gold along its back, dark, pale toward its teeth.
  const bands: Array<[Array<[number, number]>, Mat]> = [[M.outer, 'coat'], [M.gold, 'horn'], [M.pale, 'mark'], [M.inner, 'mark']];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const sd of [1, -1]) for (const [line] of bands) for (const [y, z] of line) v.push([sd * t / 2 * (line === M.outer || line === M.inner ? 0.7 : 1), y, z]);
  const at = (sd: number, b: number, q: number): number => (sd > 0 ? 0 : bands.length * N) + b * N + q;
  for (const sd of [1, -1]) for (let b = 0; b < bands.length - 1; b++) for (let q = 0; q < N - 1; q++) {
    f.push({ i: [at(sd, b, q), at(sd, b, q + 1), at(sd, b + 1, q + 1), at(sd, b + 1, q)], m: bands[b][1] });
    want.push([sd, 0, 0]);
  }
  // Its edges: the back and the teeth, and its two ends.
  const L = bands.length - 1;
  for (let q = 0; q < N - 1; q++) {
    for (const b of [0, L]) {
      const [y0, z0] = bands[b][0][q], [y1, z1] = bands[b][0][q + 1];
      f.push({ i: [at(1, b, q), at(1, b, q + 1), at(-1, b, q + 1), at(-1, b, q)], m: b ? 'mark' : 'coatDark' });
      const mid: V3 = [0, (y0 + y1) / 2 - C.c[1], (z0 + z1) / 2 - C.c[2]];
      want.push(b ? scale(mid, -1) : mid);
    }
  }
  const blade0 = mesh(v, wound(v, f, want));
  // The stem: from the snout up into the blade, near its upper end.
  const j = Math.round(M.inner.length * 0.5), [ty, tz] = M.inner[j], [gy, gz] = M.pale[j];
  const top: V3 = [0, lerp(ty, gy, 0.6), lerp(tz, gz, 0.6)];
  const stem = tube(curve(C.root, mixV(C.root, top, 0.5), top, 5), [C.stem * 1.15, C.stem, C.stem * 0.85, C.stem * 0.7, C.stem * 0.6, C.stem * 0.5],
    [C.stem * 1.0, C.stem * 0.9, C.stem * 0.8, C.stem * 0.65, C.stem * 0.55, C.stem * 0.45], Math.max(6, n - 2), (ring) => (ring >= 4 ? 'horn' : 'hornDark'));
  return merge(stem, blade0);
}
/** Points along the crescent's inside and its lower tip, head frame, for where it bites. */
function edgeOf(s: Log): V3[] {
  const M = moonOf(s.crescent!);
  return M.inner.filter((_, q) => q > M.inner.length * 0.35).map(([y, z]) => [0, y, z] as V3);
}

/* ---- legs ----------------------------------------------------------------------------- */

/** A leg's upper part, along `y` from its hip to its knee: dark brown, a gold plate over its outside. */
function upperOf(s: Log, w: number): Mesh {
  const L = s.legs.upper;
  const bone = tube([[0, -w, 0], [0, L * 0.3, w * 0.08], [0, L * 0.7, w * 0.08], [0, L + w * 0.2, 0]],
    [w * 0.9, w * 1.05, w, w * 0.85], [w * 0.85, w, w * 0.95, w * 0.8], 8, 'bark', { seam: 'start' });
  const out: Mesh[] = [bone, orb([0, L, 0], w * 0.9, 8, 4, 'hornDark')];
  out.push(orbAlong([0, L * 0.55, w * 0.45], [0, 1, 0.15], [w * 1.12, w * 0.75, L * 0.34], 7, 3, 'coat'));
  return merge(...out);
}
/**
 * A leg's lower part, from the knee along `y` to the tip of its foot: a gold cuff at the knee, cream at its lip, a dark brown
 * shin in rings, and a cream claw curving to a point; the bigger two's with a pointed gold plate down over the shin.
 */
function lowerOf(s: Log, w0: number): Mesh {
  const L = s.legs.lower, w = w0 * 0.95;
  const ys = [-w * 0.3, L * 0.1, L * 0.24, L * 0.4, L * 0.52, L * 0.6, L * 0.72, L * 0.84, L * 0.94, L - 0.004];
  const ws = [w * 1.12, w * 1.25, w * 1.08, w * 1.0, w * 1.0, w * 1.18, w * 1.08, w * 0.8, w * 0.42, 0.006];
  const mats: Mat[] = s.stage ? ['bark', 'bark', 'bark', 'bark', 'coat', 'mark', 'mark', 'mark', 'mark'] : ['coat', 'coat', 'mark', 'bark', 'coat', 'mark', 'mark', 'mark', 'mark'];
  const shin = tube(ys.map((y, q) => [0, y, q >= 6 ? -w * 0.2 * (q - 5) : w * 0.08] as V3), ws, ws.map((x) => x * 0.9), 7, (ring) => mats[Math.min(ring, mats.length - 1)]);
  const out: Mesh[] = [shin];
  // Rings in the dark of the shin.
  const rings: Disc[] = [];
  for (const y of s.stage ? [0.14, 0.28, 0.42] : [0.46]) for (const sd of [1, -1]) rings.push(disc([sd * w * 1.02, L * y, 0], [sd, 0, 0.2], w * 0.25, w * 0.9, 6, 'hornDark', { up: [0, 1, 0] }));
  // A dark streak down the outside of the claw.
  for (const sd of [1, -1]) rings.push(facing([[sd * w * 1.0, L * 0.64, w * 0.1], [sd * w * 0.82, L * 0.8, -w * 0.1], [sd * w * 0.3, L * 0.95, -w * 0.62], [sd * w * 0.86, L * 0.74, w * 0.3]], [sd, 0, 0.2], 'claw'));
  out.push(paint(rings));
  if (s.stage > 0) {
    // A pointed gold plate over the top of the shin, down to a point, on both faces.
    for (const sd of [1, -1]) {
      const pts: V3[] = [[sd * w * 0.7, L * 0.12, w * 0.9], [sd * w * 1.15, L * 0.2, w * 0.2], [sd * w * 1.05, L * 0.62, -w * 0.05], [sd * w * 0.45, L * 0.36, w * 1.0]];
      rings.length = 0;
      out.push(paint([facing(pts, [sd, 0, 0.6], 'coat'), facing([pts[0], lerp3(pts[0], pts[1], 0.5), lerp3(pts[0], pts[2], 0.35), lerp3(pts[0], pts[3], 0.5)], [sd, 0, 0.6], 'mark')]));
    }
    out.push(orbAlong([0, L * 0.34, w * 0.55], [0, 1, -0.2], [w * 1.1, w * 0.7, L * 0.26], 7, 3, 'coat'));
  }
  return merge(...out);
}
const lerp3 = (a: V3, b: V3, k: number): V3 => mixV(a, b, k);

/* ---- the log it works --------------------------------------------------------------------- */

/** One half of a log split along its length (its right half, `x` over nought): bark round, pale where it split, rings at its ends. */
function halfLog(P: Prop, fine: boolean): Mesh {
  const r = P.r, L = P.len, N = fine ? 9 : 6, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const ys = [-L / 2, -L / 6, L / 6, L / 2];
  for (const y of ys) for (let q = 0; q <= N; q++) {
    const a = -Math.PI / 2 + (q / N) * Math.PI;
    v.push([r * Math.cos(a) * (1 + 0.04 * Math.sin(q * 2.3 + y * 9)), y, r + r * Math.sin(a)]);
  }
  const C = N + 1;
  for (let j = 0; j < ys.length - 1; j++) for (let q = 0; q < N; q++) {
    f.push({ i: [j * C + q, j * C + q + 1, (j + 1) * C + q + 1, (j + 1) * C + q], m: 'stem' });
    const a = -Math.PI / 2 + ((q + 0.5) / N) * Math.PI;
    want.push([Math.cos(a), 0, Math.sin(a)]);
  }
  // The split face, and the two ends.
  const last = (ys.length - 1) * C;
  f.push({ i: [0, N, last + N, last], m: 'inner' });
  want.push([-1, 0, 0]);
  f.push({ i: Array.from({ length: C }, (_, q) => q), m: 'cap' });
  want.push([0, -1, 0]);
  f.push({ i: Array.from({ length: C }, (_, q) => last + q), m: 'cap' });
  want.push([0, 1, 0]);
  const body = mesh(v, wound(v, f, want));
  const marks: Disc[] = [];
  for (const sd of [1, -1]) {
    for (const k of [0.66, 0.33]) {
      const ring: V3[] = [];
      for (let q = 0; q <= 8; q++) {
        const a = -Math.PI / 2 + (q / 8) * Math.PI;
        ring.push([r * k * Math.cos(a), sd * (L / 2 + 0.003), r + r * k * Math.sin(a)]);
      }
      for (let q = 1; q < ring.length; q++) marks.push(strip(ring[q - 1], ring[q], [0, sd, 0], 0.004 + 0.002 * k, 'pad'));
    }
  }
  // Grain along the split face.
  for (const z of [0.5, 1.0, 1.5]) marks.push(strip([-0.003, -L / 2 + 0.02, r * z], [-0.003, L / 2 - 0.02, r * z + 0.01], [-1, 0, 0], 0.003, 'pad'));
  return merge(body, paint(marks));
}
/** One half of a squared beam split along its length (its right half): planed faces, rings at its ends. */
function halfBeam(P: Prop): Mesh {
  const r = P.r, L = P.len, h = r * 1.7;
  const v: V3[] = [];
  for (const y of [-L / 2, L / 2]) for (const [x, z] of [[0, 0], [r, 0], [r, h], [0, h]] as Array<[number, number]>) v.push([x, y, z]);
  const f: Face[] = [
    { i: [0, 1, 5, 4], m: 'stem' }, { i: [1, 2, 6, 5], m: 'stem' }, { i: [2, 3, 7, 6], m: 'tooth' }, { i: [3, 0, 4, 7], m: 'inner' },
    { i: [0, 1, 2, 3], m: 'cap' }, { i: [4, 5, 6, 7], m: 'cap' },
  ];
  const want: V3[] = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 1, 0]];
  const body = mesh(v, wound(v, f, want));
  const marks: Disc[] = [];
  for (const sd of [1, -1]) {
    for (const k of [0.75, 0.45, 0.2]) {
      const c: V3 = [0, sd * (L / 2 + 0.003), h * 0.5];
      const ring: V3[] = [];
      for (let q = 0; q <= 8; q++) { const a = -Math.PI / 2 + (q / 8) * Math.PI; ring.push(add(c, [r * k * Math.cos(a), 0, h * 0.5 * k * Math.sin(a)])); }
      for (let q = 1; q < ring.length; q++) marks.push(strip(ring[q - 1], ring[q], [0, sd, 0], 0.005, 'pad'));
    }
  }
  for (const z of [0.3, 0.6, 0.85]) marks.push(strip([r + 0.003, -L / 2 + 0.03, h * z], [r + 0.003, L / 2 - 0.03, h * z + 0.015], [1, 0, 0], 0.004, 'pad'));
  for (const x of [0.35, 0.7]) marks.push(strip([r * x, -L / 2 + 0.03, h + 0.003], [r * x + 0.01, L / 2 - 0.03, h + 0.003], [0, 0, 1], 0.004, 'pad'));
  return merge(body, paint(marks));
}
/** The Lognib's log: whole, lying across, bark round it and two bands of moss, rings at its ends. */
function wholeLog(P: Prop, fine: boolean): Mesh {
  const right = halfLog(P, fine);
  const both = merge(right, mirroredMesh(right));
  // Turned to lie along `x`, and a band of moss round it either side of its middle.
  const turnedM = mesh(both.v.map(([x, y, z]): V3 => [y, -x, z]), both.f);
  const bands = [-0.22, 0.24].map((k) => tube([[P.len * k - 0.02, 0, P.r], [P.len * k + 0.02, 0, P.r]], P.r * 1.08, P.r * 1.08, fine ? 10 : 7, 'moss'));
  return merge(turnedM, ...bands);
}

/** A shaving: a thin ribbon of wood curled round on itself, lying on the ground at `c`, its axis along `d` (two-sided). */
function curlOf(c: V3, d: V3, R: number, turns: number, w: number, fine: boolean): Mesh {
  const N = fine ? 14 : 8, v: V3[] = [], f: Face[] = [];
  const ax = unit(d), side = unit(cross([0, 0, 1], ax));
  for (let q = 0; q <= N; q++) {
    const k = q / N, a = k * turns * TAU, rr = R * (1 - 0.55 * k);
    const p = add(add(c, scale(side, Math.sin(a) * rr - R * 0.2)), add([0, 0, rr * (1 - Math.cos(a)) * 0.9 + 0.004], scale(ax, w * 0.6 * k)));
    v.push(add(p, scale(ax, -w / 2)), add(p, scale(ax, w / 2)));
  }
  for (let q = 0; q < N; q++) {
    const i = [q * 2, q * 2 + 1, q * 2 + 3, q * 2 + 2];
    f.push({ i, m: q % 3 === 0 ? 'tooth' : 'cap' }, { i: [...i].reverse(), m: 'tooth' });
  }
  return mesh(v, f);
}
/** Shavings and curls on the ground round where it works, and a scatter of chips. */
function pileOf(s: Log, fine: boolean): Mesh {
  const P = s.prop, out: Mesh[] = [];
  const n = 5 + 3 * s.stage;
  for (let q = 0; q < n; q++) {
    const a = jitter(q + 200) * TAU, side = q % 2 ? 1 : -1;
    const x = side * (P.r * (1.6 + 1.6 * jitter(q + 210))), y = (jitter(q + 220) - 0.5) * P.len * 1.1;
    out.push(curlOf([x, y, 0], [Math.cos(a), Math.sin(a), 0], P.r * (0.32 + 0.2 * jitter(q + 230)), 1.2 + 0.5 * jitter(q + 240), P.r * 0.38, fine));
  }
  const chips: Disc[] = [];
  for (let q = 0; q < 10 + 4 * s.stage; q++) {
    const a = jitter(q + 300) * TAU, rr = P.r * (1.3 + 2.2 * jitter(q + 310));
    chips.push(disc([Math.cos(a) * rr, (jitter(q + 320) - 0.5) * P.len * 1.2, 0.004], [0, 0, 1], P.r * (0.12 + 0.1 * jitter(q)), P.r * 0.07, 5, q % 3 ? 'cap' : 'tooth', { up: [Math.cos(a * 3), Math.sin(a * 3), 0] }));
  }
  return merge(...out, paint(chips));
}

/* ---- its moves, in time ------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it: the Lognib's toss of its horn, the bigger two's chop. */
export const LOG_HITS: readonly number[] = [0.5, 0.56, 0.6];
/** When it is gathered for the blow, as a share of the strike. */
export const LOG_STRIKE = { gather: 0.36 } as const;
/**
 * A go at its task, as shares of it. The Lognib's: its grip on the log (`grip`), its two heaves back (`drags`, each from and
 * to). The bigger two's: rearing (`raise`), the blade's bite (`bite`), the saw strokes down through (`saws`), the log falling
 * apart (`split`) and the horn lifted (`lift`). Either way the worked log is gone at `gone`. It loops, so a go and the next
 * are one.
 */
export const LOG_WORK = {
  grip: 0.12, drags: [[0.18, 0.4], [0.56, 0.78]] as const,
  raise: [0.08, 0.3] as const, bite: 0.38, saws: [0.46, 0.54, 0.62] as const, split: 0.7, lift: [0.72, 0.88] as const, gone: 0.92,
} as const;
/** When it looks itself over, standing about, in seconds into its loop. */
export const LOG_LOOKS: readonly number[] = [5.2, 16.4];

/* ---- its pose ------------------------------------------------------------------------------- */

interface Pose {
  /** The body over the ground: along, up, and its turns (degrees). */
  y: number; z: number; pitch: number; roll: number; yaw: number;
  /** The head's own turns on the body: pitch, yaw, roll. */
  head: [number, number, number];
  /** How far forward the front feet are put, for a lunge, in leg lengths. */
  reach: number;
  /** The Lognib's forefeet on its log, nought to one; and how far the log has come back. */
  grip: number;
  drag: number;
}

/** The standing pose: breathing, looking about, now and then looking itself over. */
function standPose(s: Log, a: Anim): Pose {
  const t = a.t, still = 1 - a.go;
  const look = beat(t, LOG_LOOKS as number[], 1.6) * still;
  return {
    y: 0, z: s.high + 0.008 * cyc(t, 6) + 0.006 * (a.breath - 0.5), pitch: 0.8 * cyc(t, 6, 1), roll: 0.6 * cyc(t, 3), yaw: 4 * drift(t) * still,
    head: [4 * cyc(t, 5) * still - 8 * look, 14 * drift(t, 1.3) * still * (1 - look) + 20 * look * Math.sin((t - LOG_LOOKS[0]) * 2.4), 5 * drift(t, 2) * still],
    reach: 0, grip: 0, drag: 0,
  };
}

/** Going: bobbing a little at each set of three coming down, rolling over them; the head forward. */
function goPose(s: Log, p: Pose, a: Anim): void {
  const g = smooth(a.go), G = s.gait, w = frac(a.u), run = a.gait;
  if (g <= 0) return;
  p.z -= g * (G.bob * (0.5 + 0.5 * Math.cos(TAU * 2 * w - 0.6)) * (1 + 0.3 * run) + 0.02 * run);
  p.pitch += g * (-1.5 * run + 1 * Math.sin(TAU * 2 * w - 1.2));
  p.roll += g * G.sway * Math.sin(TAU * w);
  p.head = [lerp(p.head[0], -3 + 3 * Math.sin(TAU * 2 * w), g), lerp(p.head[1], 0, g), lerp(p.head[2], -3 * Math.sin(TAU * w), g)];
}

/** A strike, by stage: the Lognib ducks and tosses its horn up through the blow; the bigger two rear and chop the blade down. */
function strikePose(s: Log, p: Pose, t: number): void {
  const hit = LOG_HITS[s.stage], G = LOG_STRIKE.gather;
  const gather = ramp(t, 0.02, G) * (1 - ramp(t, G, hit));
  const thrust = ramp(t, G, hit) * (1 - ramp(t, hit + 0.12, 0.98));
  if (s.spike) {
    p.y += -0.05 * gather + 0.12 * thrust;
    p.z += -0.03 * gather + 0.02 * thrust;
    p.pitch += -4 * gather + 4 * thrust;
    p.head[0] += -26 * gather + 30 * thrust;
    p.reach = 0.2 * thrust;
    return;
  }
  p.y += -0.05 * gather + 0.12 * thrust;
  p.z += 0.05 * gather - 0.02 * thrust;
  p.pitch += 10 * gather - 6 * thrust;
  p.head[0] += 24 * gather - 30 * thrust;
  p.reach = 0.12 * thrust;
}

/** How far into its task it is: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));

/** The bigger two's head pitch at its task: looking down at the log, reared, the blade at the log's top, and down through it. */
interface Chop { look: number; reared: number; bite: number; through: number }

/**
 * A go at its task. The Lognib puts its forelegs over the log and heaves back on it twice, letting go and stepping up to it
 * between. The bigger two rear, bring the blade down onto the log, saw it down through in three strokes, and lift it as the log
 * falls apart.
 */
function workPose(s: Log, chop: Chop | null, p: Pose, t: number, graze: number): void {
  const d = downOf(t, graze), W = LOG_WORK;
  if (!chop) {
    const grip = ramp(t, 0.03, W.grip) * (1 - ramp(t, W.gone - 0.06, W.gone));
    const heave = W.drags.reduce((k, [a, b]) => k + ramp(t, a, b) * (1 - ramp(t, b + 0.04, b + 0.14)), 0);
    const drag = W.drags.reduce((k, [a, b]) => k + ramp(t, a, b), 0) / W.drags.length;
    p.y += d * -0.07 * heave;
    p.z -= d * (0.03 * grip - 0.01 * heave);
    p.pitch += d * (-5 * grip + 4 * heave);
    p.head[0] = lerp(p.head[0], -18 * grip + 6 * heave, d);
    p.head[1] *= 1 - d;
    p.grip = d * grip;
    p.drag = d * drag;
    return;
  }
  const raise = ramp(t, W.raise[0], W.raise[1]), down = ramp(t, W.raise[1] + 0.02, W.bite);
  const through = W.saws.reduce((k, x) => k + ramp(t, x - 0.06, x), 0) / W.saws.length;
  const lift = ramp(t, W.lift[0], W.lift[1]);
  let hp = lerp(chop.look, chop.reared, raise);
  hp = lerp(hp, chop.bite, down);
  hp = lerp(hp, chop.through, through);
  hp = lerp(hp, chop.look, lift);
  const saw = W.saws.reduce((k, x) => k + hump(t, x - 0.03, 0.04), 0);
  p.head[0] = lerp(p.head[0], hp, d);
  p.head[1] *= 1 - d;
  p.head[2] *= 1 - d;
  p.pitch += d * (6 * raise * (1 - down) - 3 * down * (1 - lift));
  p.z += d * (0.04 * raise * (1 - down) - 0.015 * down * (1 - lift));
  p.y += d * (0.025 * saw - 0.02 * raise * (1 - down));
}

/** Evolving: crouched under the burst, drawn up tall at the turn, horn raised, a shake, and settled. */
function evolvePose(s: Log, p: Pose, t: number): void {
  const crouch = ramp(t, 0, 0.1) * (1 - ramp(t, 0.14, 0.32)), up = ramp(t, 0.16, 0.46) * (1 - ramp(t, 0.62, 0.88)), shake = hump(t, 0.54, 0.1);
  p.z += -0.05 * crouch + 0.06 * up;
  p.pitch += 9 * up;
  p.roll += 3 * shake * Math.sin(t * 60);
  p.head[0] += -12 * crouch + 22 * up;
}

function poseOf(s: Log, chop: Chop | null, a: Anim): Pose {
  const p = standPose(s, a);
  goPose(s, p, a);
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, chop, p, act.t, a.graze);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
  else if (a.graze > 0 && a.go < 1) workPose(s, chop, p, 0.05, a.graze * (1 - a.go));
  return p;
}

/* ---- its bones ---------------------------------------------------------------------------- */

const hipOf = (s: Log, i: number, sd: number): V3 => [sd * s.legs.x, s.legs.ys[i], s.legs.z];
/** Which of the two sets of three a leg is in: the front and back on one side with the middle on the other. */
const setOf = (i: number, sd: number): number => (i + (sd > 0 ? 0 : 1)) % 2;

/** Where a foot is on the ground: out from its hip and fanned round standing; going, swept back while down and brought forward while up. */
function footOf(s: Log, i: number, sd: number, a: Anim, reach: number): V3 {
  const L = s.legs, fan = L.fan[i] * DEG, h = hipOf(s, i, sd);
  const rest: V3 = [h[0] + sd * Math.cos(fan) * L.reach, h[1] + Math.sin(fan) * L.reach + (i === 0 ? reach * (L.upper + L.lower) : 0), 0];
  if (a.go <= 0 || a.act) return rest;
  const G = s.gait, run = a.gait, g = smooth(a.go);
  const duty = lerp(G.duty[0], G.duty[1], run), sweep = lerp(G.sweep[0], G.sweep[1], run), high = lerp(G.lift[0], G.lift[1], run);
  const ph = frac(a.u + setOf(i, sd) * 0.5);
  let dy = 0, up = 0;
  if (ph < duty) dy = sweep * (0.5 - ph / duty);
  else {
    const u = (ph - duty) / (1 - duty);
    dy = sweep * (smooth(u) - 0.5);
    up = high * Math.sin(Math.PI * u);
  }
  return [rest[0], rest[1] + g * dy, g * up];
}

/** Where the log lies before the Lognib, along (body frame), when it takes hold of it. */
const logSpot = (s: Log): number => s.head.at[1] + s.head.r[1] * 0.75 + s.prop.r * 0.9;

/** The head's frame at a pose, for working out where its blade comes down. */
function headAt(s: Log, z: number, pitch: number, hp: number): Xf {
  const body = joint(ROOT, [0, 0, z], pitch, 0, 0);
  return joint(body, s.head.at, hp, 0, 0);
}
/** The lowest of the blade's edge at a head pitch, at the pose it bites in: its height and how far along it is. */
function lowest(s: Log, hp: number, pts: V3[]): { z: number; y: number } {
  const H = headAt(s, s.high - 0.015, -3, hp);
  let z = Infinity, y = 0;
  for (const pt of pts) { const w = place(H, pt); if (w[2] < z) { z = w[2]; y = w[1]; } }
  return { z, y };
}
/** The head pitch that puts the blade's lowest at `goal`, searched between level and well down. */
function pitchFor(s: Log, goal: number, pts: V3[]): number {
  let lo = -85, hi = 40;
  for (let q = 0; q < 40; q++) {
    const m = (lo + hi) / 2;
    if (lowest(s, m, pts).z > goal) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

function logBones(s: Log): (a: Anim) => Bones {
  const P = s.prop, tall = P.beam ? P.r * 1.7 : P.r * 2;
  let chop: Chop | null = null, spot = logSpot(s);
  if (s.crescent) {
    const pts = edgeOf(s);
    const bite = pitchFor(s, tall + 0.005, pts), through = pitchFor(s, tall * 0.3, pts);
    chop = { look: bite + 8, reared: bite + 30, bite, through };
    spot = lowest(s, bite, pts).y;
  }
  return (a) => {
    const p = poseOf(s, chop, a);
    const body = joint(ROOT, [0, p.y, p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    b.head = joint(body, s.head.at, p.head[0], p.head[2], p.head[1]);
    b.shadow = shadowOf(body, Math.max(0, p.z - s.high) * 2);
    const flat = joint(ROOT, [0, 0, 0], 0, 0, p.yaw);
    // Where the Lognib's log lies: before it, drawn back with it as it heaves.
    const logAt = place(flat, [0, spot - p.drag * 0.14, 0]);
    const up: V3 = [0, 0, 1];
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const hip = place(body, hipOf(s, i, sd));
        let foot = footOf(s, i, sd, a, p.reach);
        if (i === 0 && p.grip > 0) {
          // Over the log: on its top, toward its near side, either side of the middle.
          const on = add(logAt, place({ m: flat.m, t: [0, 0, 0] }, [sd * P.len * 0.22, -P.r * 0.45, P.r * 1.75]));
          foot = mixV(foot, on, smooth(p.grip));
        }
        const kn = kneeOf(hip, foot, s.legs.upper, s.legs.lower, up);
        const N = cross(sub(foot, hip), up);
        const upper = inPlane(hip, sub(kn, hip), N), lower = inPlane(kn, sub(foot, kn), N);
        b[`leg${i}${q}0`] = upper;
        b[`leg${i}${q}1`] = lower;
        const tip: Xf = { m: lower.m, t: foot };
        if (i === 0) b[`f${sd > 0 ? 'r' : 'l'}2`] = tip;
        if (i === 2) b[`h${sd > 0 ? 'r' : 'l'}2`] = tip;
      }
    }
    // The log it works, there while it works; the bigger two's falling apart in two at the split, and gone into the stores.
    const act = a.act, W = LOG_WORK;
    const working = act?.kind === 'work' ? act.t : a.graze > 0 && a.go < 1 ? 0.05 : -1;
    if (working >= 0) {
      const t = working, d = act?.kind === 'work' ? downOf(act.t, a.graze) : a.graze;
      const there = smooth((d - 0.05) / 0.35) * (t > W.gone ? 1 - ramp(t, W.gone, 1) : 1) * (act ? ramp(t, 0, 0.08) : 1);
      const k = Math.max(0.02, there);
      if (s.spike) b.prop = { m: scale9(flat.m, k), t: logAt };
      else {
        const apart = ramp(t, W.split, W.split + 0.08);
        const at = place(flat, [0, spot, 0]);
        for (const [key, sd] of [['propR', 1], ['propL', -1]] as Array<[string, number]>) {
          const o = joint(ROOT, add(at, place({ m: flat.m, t: [0, 0, 0] }, [sd * P.r * 0.55 * apart, 0, 0])), 0, sd * 28 * apart, p.yaw);
          b[key] = { m: scale9(o.m, k), t: o.t };
        }
        const pile = smooth((t - W.bite) / 0.25) * there;
        if (pile > 0.02) b.pile = { m: scale9(flat.m, pile), t: at };
      }
    }
    return b;
  };
}
const scale9 = (m: Xf['m'], k: number): Xf['m'] => m.map((x) => x * k) as Xf['m'];

/* ---- its pieces --------------------------------------------------------------------------- */

function logBuild(s: Log, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), nb = cut(lod, 16, 24), fine = lod > 0;
  const pieces: Piece[] = [];
  const S = s.shell;
  const shellSolid = { c: [0, lerp(S.y0, S.y1, S.cut / 2), S.z0] as V3, r: [S.w * 0.9, (S.y1 - S.y0) * 0.42, S.h * 0.88] as V3 };
  pieces.push({ key: 'shell', mesh: merge(plated(S, domeOf(S, nb, fine)), shellMarks(s)), bone: 'body', bias: 0 });
  pieces.push({ key: 'belly', mesh: bellyOf(s, n, k), bone: 'body', bias: -0.02, under: ['shell'] });
  if (s.moss) pieces.push({ key: 'moss', mesh: mossOf(s, fine), bone: 'body', bias: 0.02, after: ['shell'] });
  if (s.crest) pieces.push({ key: 'crest', mesh: crestOf(s), bone: 'body', bias: 0.025, after: ['shell', 'moss'] });
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.85) };
  if (s.crescent) {
    // A dark neck the head is set into, under the shell's front edge.
    const H = s.head;
    pieces.push({ key: 'neck', mesh: orb([0, H.at[1] - H.r[1] * 0.6, H.at[2] - H.r[2] * 0.1], [H.r[0] * 1.3, H.r[1] * 0.8, H.r[2] * 1.1], n + 2, k, 'bark'), bone: 'body', bias: 0.01, after: ['belly'], under: ['head'] });
    pieces.push({ key: 'head', mesh: armourHead(s, n, k, false), shut: armourHead(s, n, k, true), bone: 'head', bias: 0.04, front: [0, 1, 0], after: ['belly', 'neck'] });
    pieces.push({ key: 'horn', mesh: crescentOf(s, n), bone: 'head', bias: 0.05, after: ['head'], hide: [headSolid], hideIn: 'head' });
  } else {
    pieces.push({ key: 'head', mesh: faceHead(s, n, k, false), shut: faceHead(s, n, k, true), bone: 'head', bias: 0.04, front: [0, 1, 0], after: ['belly'] });
    pieces.push({ key: 'horn', mesh: spikeOf(s, n), bone: 'head', bias: 0.05, after: ['head', 'shell'], hide: [headSolid], hideIn: 'head' });
  }
  // Legs, the forelegs the thicker.
  for (let i = 0; i < 3; i++) {
    const w = s.legs.thick * (i === 0 ? s.legs.fore : 1);
    const up = upperOf(s, w), low = lowerOf(s, w);
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, lf: V3 = [sd, 0, 0];
      pieces.push(
        { key: `leg${i}${q}0`, mesh: sd > 0 ? up : mirroredMesh(up), bone: `leg${i}${q}0`, bias: 0.01, after: 'belly', front: lf, hide: [shellSolid], hideIn: 'body' },
        { key: `leg${i}${q}1`, mesh: sd > 0 ? low : mirroredMesh(low), bone: `leg${i}${q}1`, bias: 0.015, after: [`leg${i}${q}0`, 'belly'], front: lf, hide: [shellSolid], hideIn: 'body', thin: s.stage === 0 },
      );
    }
  }
  // What it works.
  const shown = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go < 1);
  if (s.spike) pieces.push({ key: 'prop', mesh: wholeLog(s.prop, fine), bone: 'prop', bias: 0.06, shown });
  else {
    const half = s.prop.beam ? halfBeam(s.prop) : halfLog(s.prop, fine);
    pieces.push({ key: 'propR', mesh: half, bone: 'propR', bias: 0.06, shown });
    pieces.push({ key: 'propL', mesh: mirroredMesh(half), bone: 'propL', bias: 0.06, shown });
    pieces.push({ key: 'pile', mesh: pileOf(s, fine), bone: 'pile', bias: -0.03, shown: (a) => a.act?.kind === 'work' });
  }
  return pieces;
}

/* ---- what it throws about ----------------------------------------------------------------- */

const WOOD: readonly RGB[] = [[236, 200, 146], [222, 176, 118], [246, 222, 180]];
const BARK: RGB = [104, 72, 46];

/** A shaving in the air: a small curl of pale wood, inked. */
function shaving(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.6 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  for (let q = 0; q <= 14; q++) {
    const a = (q / 14) * TAU * 1.3, rr = r * (1 - 0.6 * (q / 14));
    const px2 = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
    if (q) g.lineTo(px2, py); else g.moveTo(px2, py);
  }
  g.lineWidth = Math.max(0.9 * px, r * 0.42);
  g.lineCap = 'round';
  g.strokeStyle = css(mix(c, [90, 60, 30], 0.55), al);
  g.stroke();
  g.lineWidth = Math.max(0.5 * px, r * 0.26);
  g.strokeStyle = css(c, al);
  g.stroke();
  g.restore();
}
/** A chip of bark or wood: a small inked splinter. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.4 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-r, -r * 0.2);
  g.lineTo(r, -r * 0.35);
  g.lineTo(r * 0.8, r * 0.3);
  g.lineTo(-r * 0.9, r * 0.25);
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = Math.max(0.5 * px, r * 0.18);
  g.strokeStyle = css(mix(c, [40, 26, 14], 0.65), al * 0.9);
  g.stroke();
  g.restore();
}

/** Its task: bark chips off the Lognib's log as it heaves; shavings and chips flying off the bigger two's at each stroke and the split. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Log, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = LOG_WORK, T = ACT_SECS.work, mid = b.body.t, big = 0.6 + 0.3 * s.stage;
  const d = downOf(t, a.graze);
  if (d < 0.05) return;
  const P = s.prop;
  const src = b.prop ?? b.propR;
  if (!src) return;
  const c = add(b.propL ? mixV(b.propR.t, b.propL.t, 0.5) : src.t, [0, 0, (P.beam ? P.r * 1.7 : P.r * 2) * 0.9]);
  const beats = s.spike ? W.drags.map(([x]) => x + 0.06) : [W.bite, ...W.saws, W.split];
  beats.forEach((at, q) => {
    const since = (t - at) * T;
    if (since < 0 || since > 0.5) return;
    const n = s.spike ? 4 : 6 + 2 * s.stage;
    for (let e = 0; e < n; e++) {
      const ang = jitter(q * 9 + e) * TAU, sp = (0.3 + 0.6 * jitter(q * 7 + e)) * big;
      const p = thrown(c, [Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6, (1.0 + 0.7 * jitter(e + q)) * big], since, 7);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (s.spike || e % 3 === 2) chip(g, x, y, 0.03 * big, ang + since * 9, s.spike ? BARK : WOOD[e % 3], 1 - since / 0.5);
      else shaving(g, x, y, 0.045 * big, ang + since * 7, WOOD[e % 3], 1 - since / 0.5);
    }
  });
}

/** A strike landing: chips off the blow. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Log, b: Bones, t: number, front: boolean): void {
  const since = (t - LOG_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.45) return;
  const big = 0.6 + 0.35 * s.stage, mid = b.body.t;
  const at = place(b.head, s.crescent ? [0, s.crescent.c[1] + s.crescent.R * 0.6, s.crescent.c[2] - s.crescent.R * 0.6] : s.spike!.tip);
  for (let q = 0; q < 6 + 3 * s.stage; q++) {
    const ang = jitter(q + 11) * TAU, sp = (0.5 + 0.8 * jitter(q + 3)) * big;
    const p = thrown(at, [Math.cos(ang) * sp, Math.sin(ang) * sp + 0.3, (1.2 + jitter(q + 5)) * big], since, 9);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2) shaving(g, x, y, 0.04 * big, ang + since * 12, WOOD[q % 3], 1 - smooth((since - 0.25) / 0.2));
    else chip(g, x, y, 0.03 * big, ang + since * 12, WOOD[q % 3], 1 - smooth((since - 0.25) / 0.2));
  }
}

/** Evolving: shavings and chips swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Log, b: Bones, t: number, front: boolean): void {
  const big = 0.7 + 0.35 * s.stage, mid = b.body.t, S = s.shell;
  const al = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (al <= 0) return;
  const rx = S.w * 1.6 + 0.25 * big, ry = (S.y1 - S.y0) * 0.75 + 0.25 * big, high = (S.h + s.high) * 1.8 + 0.4 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.body, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.6 - s.high * 0.5]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3) shaving(g, x, y, 0.05 * big * (1 - 0.4 * u), ang * 2, WOOD[q % 3], al * ramp(u, 0, 0.15));
    else chip(g, x, y, 0.04 * big * (1 - 0.4 * u), ang * 2, q % 2 ? BARK : WOOD[0], al * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function logKind(s: Log): Kind {
  const bones = logBones(s);
  return {
    bones,
    build: (lod) => logBuild(s, lod),
    // The variant's coat is its shell's gold and its markings the cream of its plates' edges and its face; its moss, its body's
    // brown, its horn and the wood it works the same on every variant.
    palette: (coat, mark) => {
      // Deeper than the variant's own, as the light lifts it: the sheet's orange gold, and its peach cream.
      const shell = mix(coat, [226, 138, 0], 0.85), cream = mix(mark, [238, 188, 124], 0.7);
      return coatPalette(coat, mark, {
        coat: shell,
        coatDark: mix(shell, [120, 80, 30], 0.35),
        coatLight: mix(shell, [255, 214, 120], 0.4),
        mark: cream,
        shellDark: mix(shell, [110, 70, 30], 0.4),
        spot: [112, 112, 38],
        belly: [46, 30, 22],
        bark: [64, 42, 30],
        horn: [104, 66, 42],
        hornDark: [62, 40, 28],
        claw: [60, 40, 28],
        moss: [92, 112, 32],
        leaf: [172, 190, 58],
        leafDark: [70, 94, 26],
        eye: [34, 24, 16],
        crystal: [176, 112, 36],
        glint: [255, 254, 244],
        stem: [170, 116, 70],
        cap: [236, 194, 136],
        inner: [244, 212, 160],
        tooth: [246, 222, 178],
        pad: [176, 128, 80],
        lid: mix(cream, [120, 96, 60], 0.4),
      } as Partial<ReturnType<Kind['palette']>>);
    },
    shadow: [(s.legs.ys[0] - s.legs.ys[2]) * 0.5 + s.legs.reach * 0.9 + 0.15, s.legs.x + s.legs.reach * 0.9],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[222, 176, 80], [244, 226, 186]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const LOGNIB = logKind(LOGNIB_LOOK);
export const TIMBERSPLIT = logKind(TIMBERSPLIT_LOOK);
export const BEAMMASTER = logKind(BEAMMASTER_LOOK);
