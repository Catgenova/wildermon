import {
  add, beat, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, hex, lerp, lighter, merge, mirrored, mix, onEgg, orb, orbAlong, paint,
  pastel, quadBones, quadPose, scale, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, pawMesh, quadPieces, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { MONSTER_GROWTH } from './monster-size';
import { GLYPHS } from './runestone';

/**
 * The dragon: there is one at a time, and it is one of three subspecies, by
 * its variant (`SpeciesDef.subspecies`, `DRAGONS` in that order), each a body
 * of its own at the same size (`size`), with the same light (`glow`), turns,
 * standing loop, walk and run, and a strike drawn (`acts`).
 *
 *   The Runewing Dragon: a winged wyrm, its great bat wings held spread over
 *   its back, gold rune channels down its spine and along their fingers, a
 *   rune in each panel; it rears, raises its wings and breathes fire.
 *
 *   The Runestone Drake: low and broad, its back laid with slabs of
 *   runestone, a rune cut in each, and great wings of grey stone on square
 *   bones, a rune cut down each finger and in each panel; it breathes gold,
 *   and as it draws breath the runes light from its tail to its wingtips.
 *
 *   The Stormcoil Dragon: a long sky-dragon hovering, a wave down a long tail,
 *   rune bands round it, fins and whiskers, and two great fans of long fins
 *   for wings, a band of runes across each; it beats them and lifts off the
 *   ground as it runs, and spits a bolt of lightning.
 *
 * Every pair of wings is one bat's wing built open (`batWing`, `finWing`),
 * folded at the wrist as far as it is shut (`foldAbout`) and turned on the
 * shoulder from laid back along the flank to spread out over the back
 * (`wingFrame`); `wingReach` puts the corners of the wings at their widest
 * into the box the island cuts every picture of the kind to.
 *
 * Drawn in the island's light and ink like every wildermon (`render` in
 * `./figure`), in Runecut's colours: the runes in the runestones' gold
 * (`RUNE_EDGE`, `RUNE_GOLD`, `RUNE_WHITE` in `./runestone`), the stone in a
 * runestone's cream.
 */

/* ---- shared ---------------------------------------------------------------------------- */

/** The runestones' gold, as a wildermon's colours: the edge of a rune's light, its middle, and its white heart. */
const RUNE_EDGE: RGB = [214, 140, 52];
const RUNE_GOLD: RGB = hex('#ffd98c');
const RUNE_WHITE: RGB = hex('#fffbea');
/** A runestone's cream stone, and its shade. */
const STONE: RGB = hex('#ddcdb3');
const INK = 'rgba(95,81,72,0.95)';

/** Up and down in a strike: nought outside `a`..`d`, up from `a` to `b`, held to `c`, down to `d`. */
function hump(t: number, a: number, b: number, c: number, d: number): number {
  if (t <= a || t >= d) return 0;
  if (t < b) return smooth((t - a) / (b - a));
  if (t <= c) return 1;
  return 1 - smooth((t - c) / (d - c));
}

/**
 * A rune painted on a surface: each stroke of the glyph (`GLYPHS` in `./runestone`) a band `w` across, at `c`, facing `n`,
 * its top toward `up`, `s` from its middle to its top.
 */
function runeOn(name: string, c: V3, n: V3, up: V3, s: number, w: number, m: Mat, lift = 0.03): Disc[] {
  const nn = unit(n);
  const u = unit(sub(up, scale(nn, dot(up, nn))));
  const x = cross(u, nn);
  const at = (p: readonly [number, number]): V3 => add(add(c, scale(nn, lift)), add(scale(x, p[0] * s), scale(u, p[1] * s)));
  const out: Disc[] = [];
  for (const st of GLYPHS[name] ?? []) {
    const pts = st.closed ? [...st.pts, st.pts[0]] : st.pts;
    for (let q = 0; q + 1 < pts.length; q++) out.push(band(at(pts[q]), at(pts[q + 1]), nn, w, m));
  }
  return out;
}

/** A band from `p` to `q` on a surface facing `n`, `w` across, its ends run on by half that so bands meet at a corner. */
function band(p: V3, q: V3, n: V3, w: number, m: Mat): Disc {
  const d = sub(q, p), l = Math.hypot(d[0], d[1], d[2]) || 1;
  const along = scale(d, (w * 0.5) / l);
  const side = scale(unit(cross(n, d)), w * 0.5);
  const a = sub(p, along), b = add(q, along);
  let v: V3[] = [sub(a, side), sub(b, side), add(b, side), add(a, side)];
  if (dot(cross(sub(v[1], v[0]), sub(v[2], v[0])), n) < 0) v = v.reverse();
  return { v, m, lit: true };
}

/** A line of bands along points on a surface, each facing its own way out. */
function channel(pts: readonly V3[], ns: readonly V3[], w: number, m: Mat): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q + 1 < pts.length; q++) out.push(band(pts[q], pts[q + 1], unit(add(ns[q], ns[q + 1])), w, m));
  return out;
}

/** A rune twice over: its edge in the runestones' amber, wide, and its middle in their gold over it. */
function glowingRune(name: string, c: V3, n: V3, up: V3, s: number, w: number, lift = 0.03): Disc[] {
  return [...runeOn(name, c, n, up, s, w * 1.9, 'ember', lift), ...runeOn(name, c, n, up, s, w, 'flame', lift + 0.012)];
}

/** Rings along a body (where along it, how high its middle is, how wide and how deep), and a point on it `th` round from the top. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
function ringAt(R: Rings, y: number): { z: number; w: number; h: number } {
  let q = 0;
  while (q < R.y.length - 2 && R.y[q + 1] < y) q++;
  const k = clamp((y - R.y[q]) / (R.y[q + 1] - R.y[q]));
  return { z: lerp(R.z[q], R.z[q + 1], k), w: lerp(R.w[q], R.w[q + 1], k), h: lerp(R.h[q], R.h[q + 1], k) };
}
function onRings(R: Rings, y: number, th: number, out = 0): { p: V3; n: V3 } {
  const r = ringAt(R, y);
  const n = unit([Math.sin(th) / r.w, 0, Math.cos(th) / r.h]);
  return { p: add([Math.sin(th) * r.w, y, r.z + Math.cos(th) * r.h], scale(n, out)), n };
}

/** A flat thing a little thick, from a polygon of corners nearly in one plane: a wing's membrane between its fingers. */
function sheet(poly: readonly V3[], thick: number, mat: Mat): Mesh {
  const n = poly.length;
  const N = normalOf(poly);
  const v: V3[] = [...poly.map((p) => add(p, scale(N, thick))), ...poly.map((p) => add(p, scale(N, -thick)))];
  const f: Face[] = [
    { i: Array.from({ length: n }, (_, q) => q), m: mat },
    { i: Array.from({ length: n }, (_, q) => 2 * n - 1 - q), m: mat },
    ...Array.from({ length: n }, (_, q): Face => ({ i: [q, n + q, n + ((q + 1) % n), (q + 1) % n], m: mat })),
  ];
  const c = centreOf(poly);
  f.forEach((face) => {
    const pts = face.i.map((i) => v[i]);
    if (dot(normalOf(pts), sub(centreOf(pts), c)) < 0 && face.i.length === 4) face.i.reverse();
  });
  if (dot(normalOf(f[0].i.map((i) => v[i])), N) < 0) f[0].i.reverse();
  if (dot(normalOf(f[1].i.map((i) => v[i])), N) > 0) f[1].i.reverse();
  return mesh(v, f);
}
function normalOf(pts: readonly V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit([x, y, z]);
}
const centreOf = (pts: readonly V3[]): V3 => scale(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / pts.length);

/** A point `x` in a bone's frame, and a way `d` in it, in the world. */
const turnOf = (b: Xf, d: V3): V3 => [b.m[0] * d[0] + b.m[1] * d[1] + b.m[2] * d[2], b.m[3] * d[0] + b.m[4] * d[1] + b.m[5] * d[2], b.m[6] * d[0] + b.m[7] * d[1] + b.m[8] * d[2]];

/** A spike: a four-sided point from a root `w` across along `pts`, flattened side to side by `flat`. */
const spike = (pts: readonly V3[], w: number, m: MatOrFn, flat = 0.55): Mesh => taper(pts, w, 0.02, 4, m, flat, [1, 0, 0]);
type MatOrFn = Mat | ((ring: number, j: number) => Mat);

/** Light added over a body: its own radial glow, as `Kind.glow` lays it. */
type Light = { p: V3; r: number; c: RGB; a: number };

/**
 * A gout of fire, drawn by hand over the body (or under it, breathed away from the viewer): puffs along a line from the
 * mouth, growing as they go, each in three of the runestones' colours -- amber, gold, white -- inked round the whole.
 */
function gout(g: CanvasRenderingContext2D, view: View, from: V3, dir: V3, len: number, k: number, t: number, cols: readonly [RGB, RGB, RGB], seed = 0): void {
  if (k <= 0.01) return;
  const N = 13;
  // Each puff: where along the gout it is (nought at the mouth), its middle on the screen, and its radius there.
  const at = (s: number, i: number): [number, number, number] => {
    const wob = Math.sin(i * 2.3 + t * 17 + seed) * 0.22 * s;
    const p = add(add(from, scale(dir, len * s)), [wob, -wob, wob * 0.5]);
    const [x, y] = onScreen(view, p);
    const fade = s > 0.75 ? Math.max(0, 1 - (s - 0.75) / 0.3) : 1;
    return [x, y, (0.3 + 1.25 * s) * fade * (0.55 + 0.45 * k)];
  };
  const layer = (kr: number, back: number, upTo: number, fill: string, stroke = 0): void => {
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const s = (i + frac(t * 4 + seed)) / N - back;
      if (s < 0 || s > Math.min(upTo, k * 1.05)) continue;
      const [x, y, r] = at(s, i);
      if (r <= 0.01) continue;
      g.moveTo(x + r * kr, y);
      g.arc(x, y, r * kr, 0, TAU);
    }
    if (stroke) {
      g.lineWidth = stroke;
      g.strokeStyle = INK;
      g.stroke();
    }
    g.fillStyle = fill;
    g.fill();
  };
  const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  g.save();
  layer(1, 0, 1.1, css(cols[0]), 0.14);
  layer(0.68, 0.035, 0.95, css(cols[1]));
  layer(0.36, 0.07, 0.7, css(cols[2]));
  g.restore();
}
const frac = (x: number): number => x - Math.floor(x);

/**
 * A colour pushed `k` times as far from its own grey: the coat as saturated as the revamped wildermon's are (the
 * Bastiondrake's terracotta), where the island's pastel of a dark variant comes out a dusty mid.
 */
function richer(c: RGB, k: number): RGB {
  const g = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => Math.max(0, Math.min(255, g + (x - g) * k))) as RGB;
}

/** Smoke from the nostrils, standing: two small soft puffs rising and thinning, round the loop. */
function smoke(g: CanvasRenderingContext2D, view: View, b: Xf, nostrils: readonly V3[], t: number, col: RGB): void {
  g.save();
  for (let q = 0; q < nostrils.length; q++) {
    for (let i = 0; i < 2; i++) {
      const age = frac(t / 3 + i * 0.5 + q * 0.23);
      const p = add(place(b, nostrils[q]), [0, 0, 0.3 + age * 1.6]);
      const [x, y] = onScreen(view, p);
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.32 * (1 - age) * smooth(age * 6)).toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, 0.16 + age * 0.45, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

/**
 * A dragon's underside in plates: the belly and the throat in its markings' cream, banded across in two shades of it, and
 * wider round the underside than a wildermon's belly, so the plates show from the side.
 */
function plated(pieces: Piece[], R: Rings, n: number, neck: { w: number; h: number; len: number }): void {
  const plate = (ring: number, j: number): Mat => (under(n, j, 1.2) ? (ring % 2 ? 'belly' : 'mark') : 'coat');
  pieces.find((p) => p.key === 'body')!.mesh = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, n, (ring, j) => (ring > 0 && ring < R.y.length - 1 ? plate(ring, j) : 'coat'));
  // The neck's front is its +y side as it leans forward: its plates there.
  const front = (ring: number, j: number): Mat => (Math.abs(((j + 1) / n) * TAU - Math.PI * 0.5) < 1.0 ? (ring % 2 ? 'belly' : 'mark') : 'coat');
  const pts: V3[] = [0, 0.25, 0.5, 0.75, 1].map((f): V3 => [0, f === 1 ? 0.05 : 0, -0.3 + f * (neck.len + 0.3)]);
  pieces.find((p) => p.key === 'neck')!.mesh = tube(pts, neck.w, neck.h, n, front, { seam: 'both' });
}

/* ---- the Runewing Dragon --------------------------------------------------------------------- */

const A_SPEC: QuadSpec = {
  high: 3.0,
  fore: { at: [1.15, 1.95, -0.55], len: [1.1, 1.0, 0.26], rest: [8, -14, 0], fold: [50, 80], toe: [0.6, 0.2] },
  hind: { at: [1.25, -1.85, -0.45], len: [1.3, 1.2, 0.26], rest: [30, -55, 0], fold: [40, 65], toe: [0.6, 0.2] },
  neck: { at: [0, 2.55, 0.6], len: 2.2, lean: 30 },
  head: { pitch: -2 },
  tail: { at: [0, -2.9, 0.35], links: 6, len: 0.95, lift: 4, curl: -2, sway: 18 },
  swing: [18, 32],
  graze: 30,
  nose: 14,
  bow: 10,
  rock: 5,
};
const A_BODY: Rings = { y: [-3.0, -2.6, -1.6, 0, 1.6, 2.5, 2.95], z: [0.25, 0.3, 0.32, 0.38, 0.48, 0.58, 0.62], w: [0.5, 1.3, 1.65, 1.8, 1.75, 1.4, 0.55], h: [0.45, 1.15, 1.42, 1.52, 1.5, 1.25, 0.5] };
const A_HEAD = { c: [0, 0.35, 0.3] as V3, r: [1.22, 1.3, 1.02] as V3 };
const A_EYE: V3 = [0.62, 0.62, 0.45];

/** The wings' shape, the right one, in its bone's frame: the arm out to the wrist, four fingers, and where the membrane meets the body. */
const W_E: V3 = [2.3, 0.4, 0.15], W_F: V3[] = [[5.4, 0.85, 0.6], [5.1, -1.75, -0.4], [3.85, -3.4, 0.3], [2.1, -3.75, -0.2]], W_B: V3 = [0.05, -2.5, -0.2];

/** A wing at `k` times that size: its wrist, its four finger tips, and where its membrane meets the body. */
interface Wing { E: V3; F: V3[]; B: V3; k: number }
const wingOf = (k: number): Wing => ({ E: scale(W_E, k), F: W_F.map((f) => scale(f, k)), B: scale(W_B, k), k });

/** A wing's four panels of membrane, each scalloped at its trailing edge, the last from the arm back to the body. */
function panelsOf(W: Wing): V3[][] {
  const mid = (a: V3, b: V3, inset: number): V3 => { const m = scale(add(a, b), 0.5); return add(m, scale(sub(W.E, m), inset)); };
  return [
    [W.E, W.F[0], mid(W.F[0], W.F[1], 0.2), W.F[1]],
    [W.E, W.F[1], mid(W.F[1], W.F[2], 0.2), W.F[2]],
    [W.E, W.F[2], mid(W.F[2], W.F[3], 0.18), W.F[3]],
    [[0, 0, 0], W.E, W.F[3], mid(W.F[3], W.B, 0.15), W.B],
  ];
}

/**
 * A bat's wing, the right one, built open: an arm to the wrist, four fingers from it, membrane between, a claw at the wrist.
 * `square`, its bones cut square, as stone is; `thick`, how heavy they are against the Runewing's.
 */
function batWing(W: Wing, o: { membrane: Mat; finger: Mat; arm: Mat; claw: Mat; square?: boolean; thick?: number; sheetThick?: number }): Mesh {
  const t = (o.thick ?? 1) * W.k, sides = o.square ? 4 : 5;
  const bone = (a: V3, b: V3, r0: number, r1: number, m: Mat): Mesh => (o.square ? tube([a, b], [r0, r1], [r0 * 0.8, r1 * 0.8], 4, m, { up: [0, 0, 1] }) : taper([a, b], r0, r1, sides, m));
  return merge(
    bone([0, 0, 0], W.E, 0.26 * t, 0.17 * t, o.arm),
    ...W.F.map((F, q) => bone(W.E, F, (0.15 - q * 0.015) * t, 0.04 * t, o.finger)),
    ...panelsOf(W).map((P) => sheet(P, (o.sheetThick ?? 0.03) * W.k, o.membrane)),
    orb(W.E, 0.22 * t, sides + 1, 3, o.arm),
    taper([W.E, add(W.E, scale([0.25, 0.55, 0.15], W.k))], 0.1 * t, 0.01, 4, o.claw),
  );
}

/** The pieces of a pair of wings on the bones `wing0` and `wing1`, folded by `fold`, the left the right's mirror. */
function wingPair(key: string, mesh: Mesh, fold: (v: readonly V3[], a: Anim) => V3[], after: string[], bias = 0.05, shown?: (a: Anim) => boolean): Piece[] {
  return [
    { key: `${key}0`, mesh: mirrored(mesh), bone: 'wing0', bias, after, front: [-1, 0, 0.3], bent: fold, shown },
    { key: `${key}1`, mesh, bone: 'wing1', bias, after, front: [1, 0, 0.3], bent: fold, shown },
  ];
}

/**
 * Nothing drawn: corners only, where the wings reach fully spread and raised, on the body, so the box a kind's pictures are
 * cut to (`reachOf` in `./beasts`, measured standing at the start of its loop) holds them stretched and striking as well as
 * as they stand. Shown only at that moment, which is never a picture the island keeps of it standing or going.
 */
function wingReach(W: Wing, at: V3, downs: readonly number[]): Piece {
  const v: V3[] = [];
  for (const side of [1, -1]) {
    for (const d of downs) {
      const f = wingFrame({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, at, side, 1, d);
      for (const p of [W.E, ...W.F, W.B]) v.push(place(f, [p[0] * side, p[1], p[2]]));
    }
  }
  return { key: 'reach', mesh: mesh(v, []), bone: 'body', shown: (a) => a.t === 0 && !a.act };
}

/** A head of a dragon: the skull, a long snout with its nostrils and the roof of its mouth, fangs, brows, slit eyes, open or shut. */
function dragonHead(n: number, k: number, H: { c: V3; r: V3 }, eye: V3, shut: boolean, o: { snout: V3; snoutAt: V3; brow: Mat; iris: Mat; size: number; fangs: number }): Mesh {
  const parts: Mesh[] = [orb(H.c, H.r, n + 1, k + 1, 'coat')];
  // The snout a wedge: wide and deep at the skull, narrowing and flattening to a blunt end.
  const S = o.snout;
  parts.push(tube([-0.75, 0, 0.6, 0.98].map((f, q): V3 => add(o.snoutAt, [0, f * S[1], [0.06, 0, -0.04, -0.08][q]])), [1.05, 0.92, 0.74, 0.46].map((f) => f * S[0]),
    [1.1, 0.96, 0.8, 0.52].map((f) => f * S[2]), n, (ring, j) => (ring > 0 && under(n, j, 0.7) ? 'lid' : 'coat')));
  const tip = add(o.snoutAt, [0, o.snout[1] * 0.92, 0]);
  const fangs: Mesh[] = [];
  for (const s of [1, -1]) {
    fangs.push(taper([add(tip, [s * o.snout[0] * 0.55, -0.35, -o.snout[2] * 0.55]), add(tip, [s * o.snout[0] * 0.55, -0.3, -o.snout[2] * 0.55 - 0.3 * o.fangs])], 0.085 * o.fangs, 0.012, 4, 'tooth'));
    fangs.push(taper([add(tip, [s * o.snout[0] * 0.72, -0.85, -o.snout[2] * 0.5]), add(tip, [s * o.snout[0] * 0.72, -0.82, -o.snout[2] * 0.5 - 0.26 * o.fangs])], 0.07 * o.fangs, 0.012, 4, 'tooth'));
  }
  parts.push(...fangs);
  const decals: Disc[] = [];
  // Nostrils: two small embers at the end of the snout.
  for (const s of [1, -1]) {
    decals.push(disc(add(tip, [s * S[0] * 0.2, S[1] * 0.07, S[2] * 0.36]), [s * 0.2, 1, 0.5], 0.1, 0.06, 6, 'ember', { lit: true }));
  }
  // The eyes: a slit of dark down an iris of fire, or the lid shut over it; a heavy brow sloping down to the snout over each.
  for (const s of [1, -1]) {
    const e = onEgg(H.c, H.r, [eye[0] * s, eye[1], eye[2]]);
    const on = add(e.p, scale(e.n, 0.03));
    const toward = unit(cross([0, 0, 1], e.n));
    if (shut) {
      decals.push(disc(add(on, [0, 0, -o.size * 0.15]), e.n, o.size * 1.1, o.size * 0.32, 8, 'lid'));
    } else {
      decals.push(disc(on, e.n, o.size, o.size * 0.82, 9, o.iris, { lit: true }));
      decals.push(disc(add(on, scale(e.n, 0.012)), e.n, o.size * 0.16, o.size * 0.72, 6, 'eye'));
      // The lid, a cut across the top of it falling toward the snout: a glare rather than a stare.
      const up = unit(sub([0, 0, 1], scale(e.n, e.n[2])));
      const nose = scale(toward, s), A = o.size * 1.2, B = o.size * 1.05;
      const at = (x: number, y: number): V3 => add(add(on, scale(e.n, 0.02)), add(scale(nose, x), scale(up, y)));
      let lid = [...[0, 1, 2, 3, 4, 5].map((q) => at(Math.cos((q / 5) * Math.PI) * A, Math.sin((q / 5) * Math.PI) * B + B * 0.1)), at(-A, B * 0.25), at(A, -B * 0.45)];
      if (dot(normalOf(lid), e.n) < 0) lid = lid.reverse();
      decals.push({ v: lid, m: 'lid' });
    }
    const browPts = [-1.2, 0, 1.25].map((f) => {
      const d = onEgg(H.c, H.r, [eye[0] * s * (1 - f * 0.12), eye[1] + f * 0.3, eye[2] + 0.28 - f * 0.12]);
      return add(d.p, scale(d.n, 0.05));
    });
    parts.push(tube(browPts, [0.1, 0.18, 0.12], [0.08, 0.14, 0.09], 5, o.brow));
  }
  parts.push(paint(decals));
  return merge(...parts);
}

function runewingBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 12), k = cut(lod, 5, 7);
  const H = A_HEAD;
  const headOpts = { snout: [0.8, 1.3, 0.5] as V3, snoutAt: [0, 1.55, 0.0] as V3, brow: 'stoneDark' as Mat, iris: 'ember' as Mat, size: 0.25, fangs: 1.1 };
  const head = dragonHead(n, k, H, A_EYE, false, headOpts), headShut = dragonHead(n, k, H, A_EYE, true, headOpts);
  // The lower jaw, on its own bone from the hinge under the ears: teeth up along its edge.
  const jaw = merge(
    orbAlong([0, 1.05, 0.02], [0, 1, 0.08], [0.6, 1.1, 0.22], n, 4, 'coatDark'),
    orbAlong([0, 1.15, 0.1], [0, 1, 0.08], [0.46, 0.8, 0.1], n, 3, 'tongue'),
    ...[1, -1].flatMap((s) => [0.6, 1.1, 1.55].map((y) => taper([[s * 0.42 * (1.1 - y * 0.2), y, 0.05], [s * 0.42 * (1.1 - y * 0.2), y + 0.02, 0.26]], 0.06, 0.01, 4, 'tooth'))),
  );
  // Horns: two great ones swept back off the brow, ringed; two small ones under them; a crest of spikes down the back of the skull.
  const horns = merge(
    ...[1, -1].map((s) => taper(curve([s * 0.48, 0.05, 0.78], [s * 0.85, -0.85, 1.25], [s * 0.7, -1.85, 1.1], 5), 0.24, 0.03, 6, (r) => (r % 2 ? 'horn' : 'hornDark'))),
    ...[0, 1, 2].map((q) => spike([[0, 0.25 - q * 0.45, 0.88 - q * 0.08], [0, -0.05 - q * 0.45, 1.3 - q * 0.1]], 0.14, 'stoneDark')),
  );
  // Spikes down the spine, two rows of rune channels either side of them, and a rune on each flank, all on the trunk.
  const R = A_BODY;
  const spines: Mesh[] = [];
  const runes: Disc[] = [];
  for (let i = 0; i < 6; i++) {
    const y = -2.45 + i * 0.92;
    const top = onRings(R, y, 0);
    const tall = 0.55 + 0.3 * Math.sin(((y + 3) / 6) * Math.PI);
    spines.push(spike([add(top.p, [0, 0.25, -0.12]), add(top.p, [0, -0.15, tall * 0.6]), add(top.p, [0, -0.45, tall])], 0.26, (r) => (r ? 'stoneDark' : 'coatDark')));
  }
  for (const s of [1, -1]) {
    const path = Array.from({ length: 11 }, (_, q) => onRings(R, -2.75 + q * 0.53, s * 0.36, 0.02));
    runes.push(...channel(path.map((p) => p.p), path.map((p) => p.n), 0.16, 'ember'), ...channel(path.map((p) => add(p.p, scale(p.n, 0.012))), path.map((p) => p.n), 0.07, 'flame'));
    for (const [y, name] of [[-1.9, 'thurisaz'], [-0.5, 'algiz'], [0.9, 'kenaz']] as Array<[number, string]>) {
      const at = onRings(R, y, s * 1.28, 0.02);
      runes.push(...glowingRune(name, at.p, at.n, [0, 0, 1], 0.4, 0.075));
    }
  }
  // Down the top of the neck, the channel and spikes go on; along each link of the tail, a spike and the channel.
  const neckSpines = merge(...[0.3, 0.95, 1.6].map((z, q) => spike([[0, -0.6, z], [0, -0.95, z + 0.12], [0, -1.15 + q * 0.02, z + 0.25]], 0.2, 'stoneDark')));
  const neckChannel = paint([
    ...channel([0, 0.4, 0.8, 1.2, 1.6, 2.0].map((z) => [0, -0.86, z] as V3), Array(6).fill([0, -1, 0.15] as V3), 0.16, 'ember'),
    ...channel([0, 0.4, 0.8, 1.2, 1.6, 2.0].map((z) => [0, -0.875, z] as V3), Array(6).fill([0, -1, 0.15] as V3), 0.07, 'flame'),
  ]);
  const tailLinks = Array.from({ length: 6 }, (_, q) => {
    const r0 = 0.72 - q * 0.11, r1 = Math.max(0.1, 0.72 - (q + 1) * 0.11);
    const link = tube([[0, 0.1, 0], [0, -1.0, 0]], [r0, r1], [r0 * 0.9, r1 * 0.9], n, (ring, j) => (under(n, j, 1.0) ? 'mark' : 'coat'), { seam: 'start' });
    const sp = spike([[0, -0.2, r0 * 0.75], [0, -0.55, r0 * 0.75 + 0.35 - q * 0.03], [0, -0.75, r0 * 0.75 + 0.5 - q * 0.05]], 0.16 - q * 0.015, 'stoneDark');
    const ch = paint([band([0, 0.05, r0 * 0.92], [0, -0.95, r1 * 0.92], [0, 0, 1], 0.14, 'ember'), band([0, 0.05, r0 * 0.94], [0, -0.95, r1 * 0.94], [0, 0, 1], 0.06, 'flame')]);
    if (q < 5) return merge(link, sp, ch);
    // The last carries a spade, a rune cut in it.
    const spade = blade([[0, -0.7, 0], [0, -1.35, 0], [0, -2.0, 0]], [0.5, 0.74, 0.02], [0, 0, 1], { mat: 'stoneDark', rib: 'coatDark', fold: 0.05, thick: 0.09 });
    return merge(link, spade, paint(glowingRune('tiwaz', [0, -1.3, 0.13], [0, 0, 1], [0, -1, 0], 0.3, 0.06)));
  });
  // A wing: an arm to the wrist, four fingers from it, membrane between them scalloped at the trailing edge, a gold channel down
  // the middle of each panel and a rune in it, on both faces.
  const W = A_WING;
  const wingRunes: Disc[] = [];
  const PANEL_RUNES = ['sowilo', 'algiz', 'laguz', 'kenaz'];
  panelsOf(W).forEach((P, q) => {
    const N = normalOf(P), c = centreOf(P);
    const tipward = unit(sub(q === 3 ? W.F[3] : P[2], W.E));
    for (const side of [1, -1]) {
      const nn = scale(N, side), lift = 0.05 * W.k;
      wingRunes.push(...glowingRune(PANEL_RUNES[q], add(c, scale(tipward, 0.2 * W.k)), nn, tipward, (q === 3 ? 0.36 : 0.42) * W.k, 0.075, lift));
      const vein = [W.E, add(W.E, scale(sub(c, W.E), 0.55))];
      if (q < 3) {
        wingRunes.push(band(add(vein[0], scale(nn, lift)), add(vein[1], scale(nn, lift)), nn, 0.15, 'ember'));
        wingRunes.push(band(add(vein[0], scale(nn, lift + 0.012)), add(vein[1], scale(nn, lift + 0.012)), nn, 0.065, 'flame'));
      }
    }
  });
  const wing = merge(batWing(W, { membrane: 'membrane', finger: 'coatDark', arm: 'coat', claw: 'horn' }), paint(wingRunes));
  const claws = (r: number): Mesh => merge(pawMesh(r, n, k, 'coat', 0.26), ...[-0.27, 0, 0.27].map((x) => taper([[x, 0.6, -0.2], [x * 1.3, 0.95, -0.26]], 0.11, 0.02, 4, 'horn')));
  const pieces = quadPieces({
    n, k,
    body: { ...R, belly: true },
    neck: { w: 0.86, h: 0.92, len: 2.2 },
    head: { c: H.c, r: H.r, eye: { dir: A_EYE, size: 0.01 } },
    tail: tailLinks,
    fore: { upper: [0.5, -1.1, 0.8, 0.56], lower: [0, -1.0, 0.54, 0.46], foot: claws(0.56) },
    hind: { upper: [0.7, -1.3, 0.98, 0.66], lower: [0, -1.2, 0.56, 0.46], foot: claws(0.6) },
    extras: [
      { key: 'jaw', mesh: jaw, bone: 'maw', bias: 0.19, under: 'head' },
      { key: 'horns', mesh: horns, bone: 'head', bias: 0.22, after: ['head'] },
      { key: 'spines', mesh: merge(...spines), bone: 'trunk', bias: 0.02, after: ['body'] },
      { key: 'runes', mesh: paint(runes), bone: 'trunk', bias: 0.025, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'], breathes: { c: [0, 0, 0], k: 0.04 } },
      { key: 'nspines', mesh: merge(neckSpines, neckChannel), bone: 'neck', bias: 0.01, after: 'neck' },
      ...wingPair('wing', wing, (v, a) => foldAbout(v, A_WING.E, 1 - runewingOpen(a)), ['body', 'spines', 'runes']),
      wingReach(A_WING, A_SHOULDER, [-0.7, 0.4]),
    ],
    breath: 0.04,
  });
  // The head as it is made here, open-eyed and shut, in place of the plain one.
  const hd = pieces.find((p) => p.key === 'head')!;
  hd.mesh = head;
  hd.shut = headShut;
  plated(pieces, R, n, { w: 0.86, h: 0.92, len: 2.2 });
  return pieces;
}

/**
 * A wing folded as a bat folds one: the arm stays, and each finger is turned back about the wrist `E` toward the last, its
 * membrane gathered between them, as far as the wing is `shut`.
 */
function foldAbout(v: readonly V3[], E: V3, shut: number): V3[] {
  if (shut <= 0.001) return v as V3[];
  const back = -100 * (Math.PI / 180);
  // The left wing is the right one's mirror: folded the same way about its own wrist.
  return v.map((q) => {
    const sx = q[0] < 0 ? -1 : 1;
    const p: V3 = [q[0] * sx, q[1], q[2]];
    const f = foldOne(p);
    return [f[0] * sx, f[1], f[2]];
  });
  function foldOne(p: V3): V3 {
    const w = clamp(p[0] / E[0]);
    const dx = p[0] - E[0], dy = p[1] - E[1], r = Math.hypot(dx, dy);
    if (w <= 0 || r < 1e-6) return p;
    const th = Math.atan2(dy, dx), to = back + (th - back) * 0.14;
    const t2 = lerp(th, to, shut * w), r2 = r * (1 - 0.18 * shut * w);
    // The fingers kept a little apart as they gather, each panel lying over the next.
    const z = p[2] * (1 - 0.6 * shut) + (th - back) * 0.12 * shut * w;
    return [E[0] + Math.cos(t2) * r2, E[1] + Math.sin(t2) * r2, z];
  }
}

/** The 3 by 3 product of two turns, row by row. */
function mm3(a: readonly number[], b: readonly number[]): number[] {
  const o: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return o;
}
/**
 * A right wing's frame on the body, `open` nought to one: shut, its arm up from the shoulder with the fingers hanging back
 * along the flank; open, out to the side and up, its membrane to the sky. `down` beats it down (a strike's buffet).
 */
function wingFrame(body: Xf, at: V3, side: number, open0: number, down: number): Xf {
  // The arm swings out sooner than the fingers spread: half open, it is most of the way out to the side.
  const open = 1 - (1 - clamp(open0)) ** 2;
  const xs: V3 = [0.3, -0.35, 0.89], xo: V3 = [0.82, -0.22, 0.52 - 0.45 * down];
  const ys: V3 = [0, 0.93, 0.36], yo: V3 = [0.05, 0.94, -0.18];
  const x = unit([lerp(xs[0], xo[0], open), lerp(xs[1], xo[1], open), lerp(xs[2], xo[2], open)]);
  let y: V3 = [lerp(ys[0], yo[0], open), lerp(ys[1], yo[1], open), lerp(ys[2], yo[2], open)];
  y = unit(sub(y, scale(x, dot(x, y))));
  const z = cross(x, y);
  const S = [side, 1, 1];
  const M = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]].map((m, q) => m * S[Math.floor(q / 3)] * S[q % 3]);
  const o = place(body, [side * at[0], at[1], at[2]]);
  return { m: mm3(body.m, M) as Xf['m'], t: o };
}

/** The Runewing's wings: a third again as big as a plain wing, from the tops of its shoulders. */
const A_WING = wingOf(1.32), A_SHOULDER: V3 = [1.05, 1.4, 1.0];

/** When a strike rears, lunges and breathes, as shares of it. */
const STRIKE = { rear: [0, 0.22, 0.3, 0.45], lunge: [0.3, 0.45, 0.75, 0.95], jaw: [0.28, 0.42, 0.8, 0.96], fire: [0.36, 0.5, 0.82, 0.98] } as const;
const phase = (a: Anim, w: readonly [number, number, number, number]): number => (a.act?.kind === 'strike' ? hump(a.act.t, w[0], w[1], w[2], w[3]) : 0);

/** How far open the wings are: a little lifted standing and stretched wide now and then, half out at a run, flared to strike. */
function runewingOpen(a: Anim): number {
  const stretch = a.go > 0 ? 0 : smooth(beat(a.t, [6.0, 17.5], 3.0) * 1.4);
  // Standing, half open and held out behind its shoulders, as a bat's are; drawn in walking; half out and beating at a run.
  const stand = 0.8 + 0.04 * cyc(a.t, 7) + 0.2 * stretch;
  const base = lerp(stand, lerp(0.55, 0.78 + 0.1 * Math.sin(a.u * TAU * 2), a.gait), smooth(a.go));
  return Math.max(base, phase(a, STRIKE.rear), 0.85 * phase(a, STRIKE.lunge));
}
/** Raised high as it rears and held up through the breath; beaten at a run. */
function runewingDown(a: Anim): number {
  const run = a.go * a.gait * 0.4 * Math.sin(a.u * TAU * 2);
  return run - 0.6 * phase(a, STRIKE.rear) - 0.25 * phase(a, STRIKE.lunge);
}

function runewingOwn(p: QuadPose, a: Anim): void {
  const w = a.u - Math.floor(a.u);
  if (a.go > 0) {
    p.neck[0] += 4 * Math.sin(w * TAU * 2) * a.go;
    p.tail[1] += 14 * Math.sin(w * TAU + 1) * a.go;
  } else {
    p.neck[1] += 16 * cyc(a.t, 2);
    p.tail[1] += 18 * cyc(a.t, 3);
    p.tail[2] += 4 * cyc(a.t, 5);
    const s = smooth(beat(a.t, [6.0, 17.5], 3.0) * 1.4);
    p.neck[0] -= 16 * s;
    p.head[0] += 12 * s;
    p.jaw = 0.25 * s;
  }
  strikeOwn(p, a, 1);
}

/** A strike on four legs: up on the hind legs with the head back, then down and forward with the jaw wide. */
function strikeOwn(p: QuadPose, a: Anim, k: number): void {
  const rear = phase(a, STRIKE.rear), lunge = phase(a, STRIKE.lunge), jaw = phase(a, STRIKE.jaw);
  if (!rear && !lunge && !jaw) return;
  p.pitch += k * (13 * rear - 4 * lunge);
  p.neck[0] += -22 * rear + 26 * lunge;
  p.neck[1] *= 1 - Math.max(rear, lunge);
  p.head[0] += 16 * rear - 22 * lunge;
  p.head[1] *= 1 - Math.max(rear, lunge);
  p.tail[0] += 10 * rear;
  p.jaw = Math.max(p.jaw, jaw);
}

/** The bones of a dragon on four legs: the jaw on its own hinge, and the wings, if it has them, from its shoulders. */
/** Where a kind's wings are on its body, how far open they are, and how far beaten down (raised, less than nought). */
interface WingRig { at: V3; open: (a: Anim) => number; down: (a: Anim) => number }
function quadDragonBones(spec: QuadSpec, own: (p: QuadPose, a: Anim) => void, hinge: V3, gape: number, wings?: WingRig,
  more?: (b: Bones, p: QuadPose, a: Anim) => void): (a: Anim) => Bones {
  return (a) => {
    const p = quadPose(spec, a);
    own(p, a);
    const b = quadBones(spec, p);
    b.maw = joint(b.head, hinge, -gape * p.jaw);
    if (wings) {
      const open = wings.open(a), down = wings.down(a);
      for (let q = 0; q < 2; q++) b[`wing${q}`] = wingFrame(b.body, wings.at, q ? 1 : -1, open, down);
    }
    more?.(b, p, a);
    return b;
  };
}

/** The mouth, in the head's frame, and which way its breath goes out of it. */
const A_MOUTH: V3 = [0, 2.65, -0.4], A_AIM: V3 = [0, 1, -0.12];

export const RUNEWING: Kind = {
  bones: quadDragonBones(A_SPEC, runewingOwn, [0, 0.35, -0.3], 34, { at: A_SHOULDER, open: runewingOpen, down: runewingDown }),
  build: runewingBuild,
  palette: (coat, mark) => {
    // Deeper than a wildermon's pastel, so it reads as the thing to keep away from: its coat halfway from its variant's own
    // colour to the island's pastel of it, its wings in its markings' pastel, its belly the cream of bone.
    const c = richer(mix(coat, pastel(coat, 250), 0.45), 1.45);
    const m = pastel(mark, 250);
    return coatPalette(coat, mark, {
      coat: c, coatDark: darker(c, 0.24), coatLight: lighter(c, 0.15), lid: darker(c, 0.45),
      mark: mix(hex('#e8d2b0'), c, 0.5), belly: mix(hex('#e8d2b0'), c, 0.62), membrane: mix(m, darker(c, 0.25), 0.5),
      stone: lighter(c, 0.08), stoneDark: darker(c, 0.42), horn: [240, 226, 200], hornDark: [205, 186, 156], tooth: [250, 244, 226],
      tongue: [168, 72, 76], ember: RUNE_EDGE, flame: RUNE_GOLD, bloom: RUNE_WHITE, nose: darker(c, 0.4),
    }, 250);
  },
  shadow: [4.8, 2.4],
  stride: 0.7,
  size: 4.2 * MONSTER_GROWTH,
  blinks: 6,
  acts: ['strike'],
  glow: (b, a) => {
    const t = b.trunk ?? b.body;
    const fire = phase(a, STRIKE.fire);
    const out: Light[] = [];
    // The channels' light, climbing the spine: each rune on its own beat, a little after the one behind it.
    for (const [q, y] of [-1.9, -0.5, 0.9].entries()) {
      const pulse = 0.09 + 0.05 * cyc(a.t, 4, -q * 0.9) + 0.12 * fire;
      for (const s of [1, -1]) out.push({ p: place(t, onRings(A_BODY, y, s * 1.28, 0.1).p), r: 1.0, c: RUNE_EDGE, a: pulse });
    }
    if (b.head) for (const s of [1, -1]) out.push({ p: place(b.head, onEgg(A_HEAD.c, A_HEAD.r, [A_EYE[0] * s, A_EYE[1], A_EYE[2]]).p), r: 0.45, c: RUNE_EDGE, a: 0.4 });
    if (fire && b.maw) out.push({ p: place(b.head, A_MOUTH), r: 2.6, c: [255, 170, 80], a: 0.4 * fire });
    return out;
  },
  extra: (g, view, b, a, under) => {
    if (!b.head) return;
    const fire = phase(a, STRIKE.fire);
    if (fire > 0) {
      const dir = unit(turnOf(b.head, A_AIM));
      const away = dot(dir, view.T) < -0.25;
      if (away === under) gout(g, view, place(b.head, A_MOUTH), dir, 4.6, fire, a.act?.t ?? 0, [[228, 104, 62], [250, 170, 72], RUNE_GOLD]);
    } else if (!under && a.go === 0) {
      smoke(g, view, b.head, [[0.25, 2.3, 0.15], [-0.25, 2.3, 0.15]], a.t, [222, 214, 220]);
    }
  },
};

/* ---- the Runestone Drake ---------------------------------------------------------------- */

const B_SPEC: QuadSpec = {
  high: 2.75,
  fore: { at: [1.35, 1.9, -0.6], len: [1.05, 0.95, 0.28], rest: [8, -14, 0], fold: [45, 70], toe: [0.65, 0.25] },
  hind: { at: [1.45, -1.8, -0.5], len: [1.2, 1.1, 0.28], rest: [28, -52, 0], fold: [38, 60], toe: [0.65, 0.25] },
  neck: { at: [0, 2.6, 0.45], len: 1.55, lean: 46 },
  head: { pitch: -4 },
  tail: { at: [0, -2.9, 0.25], links: 5, len: 1.0, lift: -2, curl: -3, sway: 14 },
  swing: [16, 28],
  graze: 30,
  nose: 14,
  bow: 8,
  rock: 3,
};
const B_BODY: Rings = { y: [-3.1, -2.7, -1.6, 0, 1.6, 2.55, 3.0], z: [0.15, 0.2, 0.25, 0.3, 0.38, 0.45, 0.48], w: [0.55, 1.5, 1.95, 2.1, 2.0, 1.6, 0.6], h: [0.45, 1.1, 1.35, 1.42, 1.4, 1.2, 0.5] };
const B_HEAD = { c: [0, 0.35, 0.25] as V3, r: [1.3, 1.28, 1.0] as V3 };
const B_EYE: V3 = [0.66, 0.58, 0.35];
/** The standing stones down its spine: where along the back each stands, how tall, and the rune cut in either face. */
const B_STONES: ReadonlyArray<[number, number, string]> = [[-2.2, 1.0, 'kenaz'], [-0.95, 1.55, 'algiz'], [0.45, 1.85, 'tiwaz'], [1.75, 1.4, 'sowilo']];
/** The slabs laid down either flank: where along it, how far round from the top, and how big. */
const B_SLABS: ReadonlyArray<[number, number, number]> = [[-2.3, 0.75, 0.55], [-1.1, 0.7, 0.72], [0.25, 0.68, 0.78], [1.55, 0.72, 0.7], [-1.7, 1.25, 0.5], [-0.4, 1.2, 0.62], [0.95, 1.22, 0.58]];
const B_SLAB_RUNES = ['thurisaz', 'laguz', 'mannaz', 'ingwaz', 'dagaz', 'othala', 'staff'];

/** A standing stone: square in section, thinner than it is wide, narrowing to a blunt point, its foot sunk into what it stands on. */
function standingStone(foot: V3, tall: number, wide: number, thick: number, lean: number): Mesh {
  const pts: V3[] = [add(foot, [0, 0, -0.3]), add(foot, [0, -lean * 0.4, tall * 0.62]), add(foot, [0, -lean, tall])];
  return tube(pts, [thick, thick * 0.92, thick * 0.4], [wide, wide * 0.86, wide * 0.25], 4, 'stone', { up: [0, 1, 0] });
}

/** How far the runes are lit, a strike drawing breath: each slab from the tail forward, `at` of the way along. */
function litAt(a: Anim, at: number): number {
  if (a.act?.kind !== 'strike') return 0;
  return hump(a.act.t, 0.02 + at * 0.3, 0.1 + at * 0.3, 0.86, 0.98);
}

function runestoneBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 12), k = cut(lod, 5, 7);
  const H = B_HEAD;
  const headOpts = { snout: [0.95, 1.15, 0.6] as V3, snoutAt: [0, 1.5, -0.05] as V3, brow: 'stoneDark' as Mat, iris: 'ember' as Mat, size: 0.25, fangs: 1.2 };
  const R = B_BODY;
  // A slab of runestone over the brow, a rune in it; two horns of stone, square and blunt, back off it; a stone on each cheek.
  const brow = onEgg(H.c, H.r, [0, 0.55, 0.85]);
  const crown = merge(
    tube([add(brow.p, [0, 0.55, -0.15]), add(brow.p, [0, -0.1, 0.12]), add(brow.p, [0, -0.85, 0.12])], [0.42, 0.55, 0.5], [0.12, 0.16, 0.14], 4, 'stone', { up: [0, 0, 1] }),
    ...[1, -1].map((s) => tube(curve([s * 0.62, -0.1, 0.62], [s * 1.0, -0.75, 1.05], [s * 1.05, -1.55, 1.05], 3), [0.24, 0.2, 0.14, 0.05], [0.24, 0.2, 0.14, 0.05], 4, 'stone')),
    ...[1, -1].map((s) => tube([[s * 1.05, 0.2, -0.05], [s * 1.45, -0.2, -0.05], [s * 1.6, -0.6, -0.15]], [0.2, 0.15, 0.04], [0.2, 0.15, 0.04], 4, 'stone')),
  );
  const crownRune = paint(glowingRune('ingwaz', add(brow.p, [0, 0.0, 0.3]), [0, 0.15, 1], [0, 1, 0], 0.3, 0.06, 0.02));
  const jaw = merge(
    tube([[0, 0.25, -0.12], [0, 1.0, -0.12], [0, 1.85, -0.1]], [0.78, 0.7, 0.42], [0.28, 0.26, 0.2], n, 'coatDark'),
    orbAlong([0, 1.2, 0.05], [0, 1, 0.05], [0.5, 0.7, 0.12], n, 3, 'tongue'),
    ...[1, -1].flatMap((s) => [0.7, 1.25, 1.7].map((y) => tube([[s * 0.55 * (1.15 - y * 0.25), y, 0.08], [s * 0.55 * (1.15 - y * 0.25), y, 0.3]], [0.08, 0.04], [0.08, 0.04], 4, 'tooth'))),
  );
  // The stones down its spine, the runes in their faces lit; moss at their feet.
  const stones: Mesh[] = [], stoneRunes: Disc[] = [], moss: Mesh[] = [];
  for (const [y, tall, name] of B_STONES) {
    const top = onRings(R, y, 0);
    const wide = 0.48 + tall * 0.08, thick = 0.2;
    stones.push(standingStone(top.p, tall, wide, thick, 0.25));
    for (const s of [1, -1]) stoneRunes.push(...glowingRune(name, add(top.p, [s * (thick * 0.95 + 0.01), -0.12, tall * 0.48]), [s, 0, 0], [0, -0.15, 1], tall * 0.22, 0.06, 0.02));
    moss.push(orb(add(top.p, [0.3, 0.35, 0.05]), [0.3, 0.26, 0.14], 6, 3, 'moss'), orb(add(top.p, [-0.28, -0.4, 0.05]), [0.26, 0.3, 0.13], 6, 3, 'moss'));
  }
  // The slabs: thick plates of stone laid on its flanks, each with a rune cut in it, dark until it breathes.
  const slabs: Mesh[] = [], cutRunes: Disc[] = [], litRunes: Disc[] = [];
  for (const s of [1, -1]) {
    B_SLABS.forEach(([y, th, size], q) => {
      const at = onRings(R, y, s * th, 0.02);
      const up = unit(sub([0, 0, 1], scale(at.n, at.n[2])));
      // A tile of stone, square-cut and bevelled, its face a little smaller than its foot.
      // Each turned a little on the flank from the next, as stones are laid by hand.
      const tw = (((q * 37) % 7) - 3) * 0.06 * s;
      const spin = (v: V3): V3 => add(scale(v, Math.cos(tw)), scale(cross(at.n, v), Math.sin(tw)));
      slabs.push(tube([add(at.p, scale(at.n, -0.08)), add(at.p, scale(at.n, 0.1)), add(at.p, scale(at.n, 0.2))], [size * 0.78, size * 0.76, size * 0.62], [size * 0.68, size * 0.66, size * 0.52], 4, 'stone', { up: spin([0, 1, 0]), turn: 0.5 }));
      const face = add(at.p, scale(at.n, 0.2));
      const name = B_SLAB_RUNES[q];
      const top: V3 = spin(up[2] > 0.3 ? up : [0, 1, 0]);
      cutRunes.push(...runeOn(name, face, at.n, top, size * 0.48, 0.09, 'stoneDark', 0.012));
      litRunes.push(...glowingRune(name, face, at.n, top, size * 0.48, 0.1, 0.014));
    });
  }
  const tailLinks = Array.from({ length: 5 }, (_, q) => {
    const r0 = 0.85 - q * 0.13, r1 = Math.max(0.2, 0.85 - (q + 1) * 0.13);
    const link = tube([[0, 0.1, 0], [0, -1.0, 0]], [r0, r1], [r0 * 0.85, r1 * 0.85], n, (ring, j) => (under(n, j, 1.0) ? 'mark' : 'coat'), { seam: 'start' });
    const plate = orbAlong([0, -0.45, r0 * 0.78], [0, -0.2, 1], [r0 * 0.6, r0 * 0.75, 0.12], 6, 3, 'stone');
    if (q < 4) return merge(link, plate);
    // The end of it a boulder of runestone, spiked, a rune either side of it.
    const club = merge(orb([0, -1.25, 0.05], [0.72, 0.8, 0.62], 7, 4, 'stone'), ...[0, 1, 2, 3].map((r) => {
      const a = (r / 4) * TAU + 0.4;
      return tube([[Math.cos(a) * 0.55, -1.25, 0.05 + Math.sin(a) * 0.45], [Math.cos(a) * 0.95, -1.3, 0.05 + Math.sin(a) * 0.8]], [0.16, 0.03], [0.16, 0.03], 4, 'stone');
    }));
    return merge(link, plate, club, paint([...glowingRune('sowilo', [0.73, -1.25, 0.1], [1, 0, 0], [0, 0, 1], 0.3, 0.06), ...glowingRune('sowilo', [-0.73, -1.25, 0.1], [-1, 0, 0], [0, 0, 1], 0.3, 0.06)]));
  });
  const claws = (r: number): Mesh => merge(pawMesh(r, n, k, 'coat', 0.28), ...[-0.3, 0, 0.3].map((x) => tube([[x, 0.62, -0.18], [x * 1.25, 0.98, -0.26]], [0.12, 0.02], [0.12, 0.02], 4, 'stoneDark')));
  // Wings of stone: bones cut square, heavy, a membrane of grey runestone between them, a rune cut down each finger and in each
  // panel, both faces, dark until it draws breath and then lit with the slabs.
  const W = B_WING;
  const stoneWing = batWing(W, { membrane: 'membrane', finger: 'stone', arm: 'stone', claw: 'stoneDark', square: true, thick: 1.35, sheetThick: 0.045 });
  const wingCut: Disc[] = [], wingLit: Disc[] = [];
  const FINGER_RUNES = ['tiwaz', 'algiz', 'kenaz', 'laguz'];
  const PANEL_B = ['sowilo', 'ingwaz', 'othala', 'dagaz'];
  for (const side of [1, -1]) {
    W.F.forEach((F, q) => {
      const along = unit(sub(F, W.E)), N: V3 = [0, 0, side], r = (0.15 - q * 0.015) * 1.35 * W.k * 0.8;
      for (const f of [0.5]) {
        const at = add(add(W.E, scale(sub(F, W.E), f)), scale(N, r + 0.02));
        const nm = FINGER_RUNES[(q + (f > 0.5 ? 1 : 0)) % 4];
        wingCut.push(...runeOn(nm, at, N, along, 0.26 * W.k, 0.07, 'stoneDark', 0.004));
        wingLit.push(...glowingRune(nm, at, N, along, 0.26 * W.k, 0.06, 0.004));
      }
    });
    panelsOf(W).forEach((P, q) => {
      const nn = scale(normalOf(P), side), c = centreOf(P), up = unit(sub(q === 3 ? W.F[3] : P[2], W.E)), lift = 0.065 * W.k;
      wingCut.push(...runeOn(PANEL_B[q], c, nn, up, 0.42 * W.k, 0.09, 'stoneDark', lift));
      wingLit.push(...glowingRune(PANEL_B[q], c, nn, up, 0.42 * W.k, 0.08, lift));
    });
  }
  const pieces = quadPieces({
    n, k,
    body: { ...R, belly: true },
    neck: { w: 1.05, h: 1.05, len: 1.55 },
    head: { c: H.c, r: H.r, eye: { dir: B_EYE, size: 0.01 } },
    tail: tailLinks,
    fore: { upper: [0.5, -1.0, 0.9, 0.62], lower: [0, -0.95, 0.6, 0.5], foot: claws(0.62) },
    hind: { upper: [0.7, -1.2, 1.05, 0.72], lower: [0, -1.1, 0.62, 0.52], foot: claws(0.65) },
    extras: [
      { key: 'jaw', mesh: jaw, bone: 'maw', bias: 0.19, under: 'head' },
      { key: 'crown', mesh: merge(crown, crownRune), bone: 'head', bias: 0.22, after: ['head'] },
      { key: 'slabs', mesh: merge(...slabs, paint(cutRunes)), bone: 'trunk', bias: 0.02, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'], breathes: { c: [0, 0, 0], k: 0.03 } },
      { key: 'lit', mesh: paint(litRunes), bone: 'trunk', bias: 0.025, after: ['slabs'], breathes: { c: [0, 0, 0], k: 0.03 }, shown: (a) => litAt(a, 0.5) >= 0.5 },
      { key: 'stones', mesh: merge(...stones, paint(stoneRunes), ...moss), bone: 'trunk', bias: 0.03, after: ['body', 'slabs'] },
      ...wingPair('wing', merge(stoneWing, paint(wingCut)), foldB, ['body', 'slabs', 'stones']),
      ...wingPair('wlit', paint(wingLit), foldB, ['body', 'slabs', 'stones'], 0.055, (a) => litAt(a, 0.75) >= 0.5),
      wingReach(B_WING, B_SHOULDER, [-0.7, 0.3]),
    ],
    breath: 0.03,
  });
  const hd = pieces.find((p) => p.key === 'head')!;
  hd.mesh = dragonHead(n, k, H, B_EYE, false, headOpts);
  hd.shut = dragonHead(n, k, H, B_EYE, true, headOpts);
  plated(pieces, R, n, { w: 1.05, h: 1.05, len: 1.55 });
  return pieces;
}

/** Heavy: no rearing; its head lowered and swung back as it draws breath, then thrust forward with the jaw wide. */
/** The drake's wings: a fifth again as big as a plain wing, from the tops of its broad shoulders. */
const B_WING = wingOf(1.22), B_SHOULDER: V3 = [1.3, 1.35, 1.0];
const foldB = (v: readonly V3[], a: Anim): V3[] => foldAbout(v, B_WING.E, 1 - stoneOpen(a));
/** Mantled standing, a stone canopy half over its back; drawn in going; raised wide as it draws breath. */
function stoneOpen(a: Anim): number {
  const stretch = a.go > 0 ? 0 : smooth(beat(a.t, [6.0, 17.5], 3.0) * 1.4);
  const base = lerp(0.72 + 0.03 * cyc(a.t, 7) + 0.28 * stretch, lerp(0.5, 0.68 + 0.08 * Math.sin(a.u * TAU * 2), a.gait), smooth(a.go));
  return Math.max(base, phase(a, B_STRIKE.draw), 0.9 * phase(a, B_STRIKE.thrust));
}
function stoneDown(a: Anim): number {
  return a.go * a.gait * 0.25 * Math.sin(a.u * TAU * 2) - 0.55 * phase(a, B_STRIKE.draw) - 0.2 * phase(a, B_STRIKE.thrust) + 0.15 * (1 - smooth(a.go));
}
const B_STRIKE = { draw: [0, 0.2, 0.32, 0.45], thrust: [0.32, 0.45, 0.8, 0.95], jaw: [0.34, 0.45, 0.82, 0.96], fire: [0.4, 0.52, 0.84, 0.98] } as const;
function runestoneOwn(p: QuadPose, a: Anim): void {
  const w = a.u - Math.floor(a.u);
  if (a.go > 0) {
    p.neck[0] += 3 * Math.sin(w * TAU * 2) * a.go;
    p.tail[1] += 10 * Math.sin(w * TAU + 1) * a.go;
    p.roll += 2 * Math.sin(w * TAU) * a.go;
  } else {
    p.neck[1] += 14 * cyc(a.t, 2);
    p.tail[1] += 12 * cyc(a.t, 3);
    // A deep breath now and then, head raised, the jaw a little open.
    const s = smooth(beat(a.t, [6.0, 17.5], 3.0) * 1.4);
    p.neck[0] -= 12 * s;
    p.head[0] += 8 * s;
    p.jaw = 0.3 * s;
  }
  const draw = phase(a, B_STRIKE.draw), thrust = phase(a, B_STRIKE.thrust), jaw = phase(a, B_STRIKE.jaw);
  if (!draw && !thrust && !jaw) return;
  p.pitch += 4 * draw - 5 * thrust;
  p.lift += 0.25 * draw;
  p.neck[0] += -18 * draw + 18 * thrust;
  p.neck[1] *= 1 - Math.max(draw, thrust);
  p.head[0] += 14 * draw - 12 * thrust;
  p.head[1] *= 1 - Math.max(draw, thrust);
  p.tail[0] += 12 * draw;
  p.jaw = Math.max(p.jaw, jaw);
  p.squash = 0.05 * thrust;
}
const B_MOUTH: V3 = [0, 2.6, -0.45], B_AIM: V3 = [0, 1, -0.16];

export const RUNESTONE_DRAKE: Kind = {
  bones: quadDragonBones(B_SPEC, runestoneOwn, [0, 0.3, -0.3], 32, { at: B_SHOULDER, open: stoneOpen, down: stoneDown }),
  build: runestoneBuild,
  palette: (coat, mark) => {
    // Its hide its variant's colour halfway to the pastel, between stones of a runestone's cream; its runes in their gold.
    // A shade darker than the others: its green variant as light as they come out is the island's grass.
    const c = darker(richer(mix(coat, pastel(coat, 250), 0.5), 1.35), 0.14);
    return coatPalette(coat, mark, {
      coat: c, coatDark: darker(c, 0.22), lid: darker(c, 0.45), mark: mix(hex('#e3d3b8'), c, 0.5), belly: mix(hex('#e3d3b8'), c, 0.62),
      stone: STONE, stoneDark: hex('#7d6c66'), moss: hex('#7dad7d'), membrane: mix(hex('#9d8f88'), c, 0.22),
      tooth: [246, 238, 220], tongue: [160, 70, 74], ember: RUNE_EDGE, flame: RUNE_GOLD, bloom: RUNE_WHITE, nose: darker(c, 0.4),
    }, 250);
  },
  shadow: [4.9, 2.7],
  stride: 0.7,
  size: 4.2 * MONSTER_GROWTH,
  blinks: 6,
  acts: ['strike'],
  glow: (b, a) => {
    const t = b.trunk ?? b.body;
    const out: Light[] = [];
    // The standing stones' runes, each breathing a little after the one behind it, so the light climbs its back.
    B_STONES.forEach(([y, tall], q) => {
      const top = onRings(B_BODY, y, 0).p;
      out.push({ p: place(t, add(top, [0, 0, tall * 0.5])), r: 1.1, c: RUNE_EDGE, a: 0.1 + 0.07 * Math.max(0, cyc(a.t, 3, -q * 0.8)) + 0.15 * litAt(a, q / 4) });
    });
    // Drawing breath, each slab lit in turn from the tail to the head.
    if (a.act?.kind === 'strike') {
      for (const s of [1, -1]) {
        for (const [y, th] of B_SLABS) {
          const lit = litAt(a, (y + 3) / 6);
          if (lit > 0.02) out.push({ p: place(t, onRings(B_BODY, y, s * th, 0.3).p), r: 0.9, c: RUNE_EDGE, a: 0.14 * lit });
        }
      }
      const fire = phase(a, B_STRIKE.fire);
      if (fire && b.head) out.push({ p: place(b.head, B_MOUTH), r: 2.6, c: [255, 200, 110], a: 0.4 * fire });
    }
    if (b.head) for (const s of [1, -1]) out.push({ p: place(b.head, onEgg(B_HEAD.c, B_HEAD.r, [B_EYE[0] * s, B_EYE[1], B_EYE[2]]).p), r: 0.45, c: RUNE_EDGE, a: 0.4 });
    return out;
  },
  extra: (g, view, b, a, under) => {
    if (!b.head) return;
    const fire = phase(a, B_STRIKE.fire);
    if (fire > 0) {
      const dir = unit(turnOf(b.head, B_AIM));
      const away = dot(dir, view.T) < -0.25;
      if (away === under) gout(g, view, place(b.head, B_MOUTH), dir, 4.4, fire, a.act?.t ?? 0, [[236, 170, 64], RUNE_GOLD, RUNE_WHITE], 0.4);
    }
  },
};

/* ---- the Stormcoil Dragon -------------------------------------------------------------------- */

const C_LINKS = 10;
const C_SPEC: QuadSpec = {
  high: 2.6,
  fore: { at: [0.95, 1.7, -0.45], len: [0.95, 0.85, 0.24], rest: [10, -18, 0], fold: [50, 80], toe: [0.6, 0.2] },
  hind: { at: [1.0, -1.55, -0.4], len: [1.05, 1.0, 0.24], rest: [28, -55, 0], fold: [40, 65], toe: [0.6, 0.2] },
  neck: { at: [0, 2.3, 0.45], len: 2.6, lean: 22 },
  head: { pitch: -2 },
  tail: { at: [0, -2.45, 0.2], links: C_LINKS, len: 0.86, lift: 2, curl: 1.5, sway: 0 },
  ears: { at: [0.7, -0.45, 0.35], out: 55, back: 70 },
  swing: [18, 26],
  graze: 30,
  nose: 14,
  bow: 10,
  rock: 4,
};
const C_BODY: Rings = { y: [-2.6, -2.2, -1.2, 0, 1.2, 2.1, 2.55], z: [0.15, 0.18, 0.22, 0.28, 0.35, 0.42, 0.45], w: [0.72, 0.9, 1.0, 1.04, 1.0, 0.9, 0.58], h: [0.7, 0.88, 0.96, 0.98, 0.96, 0.86, 0.56] };
const C_HEAD = { c: [0, 0.3, 0.3] as V3, r: [1.05, 1.18, 0.92] as V3 };
const C_EYE: V3 = [0.62, 0.62, 0.42];
/** Each link of the tail: how thick at its root. */
const cTail = (q: number): number => 0.9 * (1 - q / (C_LINKS + 1.5));

/** A ring of rune band round a tube: `r` across and `h` up, at `y` along it (`z` its middle), with marks cut across it. */
function bandRound(y: number, z: number, r: number, h: number, w: number, sides = 10): Disc[] {
  const out: Disc[] = [];
  const pt = (t: number, lift: number): { p: V3; n: V3 } => {
    const n = unit([Math.cos(t) / r, 0, Math.sin(t) / h]);
    return { p: add([Math.cos(t) * r, y, z + Math.sin(t) * h], scale(n, lift)), n };
  };
  for (let q = 0; q < sides; q++) {
    const a = pt((q / sides) * TAU, 0.03), b = pt(((q + 1) / sides) * TAU, 0.03);
    out.push(band(a.p, b.p, unit(add(a.n, b.n)), w * 1.9, 'ember'));
    const a2 = pt((q / sides) * TAU, 0.045), b2 = pt(((q + 1) / sides) * TAU, 0.045);
    out.push(band(a2.p, b2.p, unit(add(a.n, b.n)), w, 'flame'));
    // A short cut across the band at every other side: the marks of a rune ring rather than a plain hoop.
    if (q % 2 === 0) {
      const m = pt(((q + 0.5) / sides) * TAU, 0.05);
      out.push(band(add(m.p, [0, -w * 2.2, 0]), add(m.p, [0, w * 2.2, 0]), m.n, w * 0.9, 'flame'));
    }
  }
  return out;
}

function stormBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 12), k = cut(lod, 5, 7);
  const H = C_HEAD;
  const headOpts = { snout: [0.66, 1.5, 0.44] as V3, snoutAt: [0, 1.5, 0.04] as V3, brow: 'coatDark' as Mat, iris: 'ember' as Mat, size: 0.24, fangs: 0.9 };
  const R = C_BODY;
  // Antlers: two branched horns up and back off the brow, three tines each.
  const antler = (s: number): Mesh => {
    const main = curve([s * 0.45, -0.05, 0.75], [s * 0.75, -0.55, 1.6], [s * 0.55, -1.35, 2.15], 4);
    return merge(
      taper(main, 0.15, 0.04, 5, 'horn'),
      taper([bendAt(main, 0.35), add(bendAt(main, 0.35), [s * 0.45, 0.35, 0.45])], 0.08, 0.02, 4, 'horn'),
      taper([bendAt(main, 0.65), add(bendAt(main, 0.65), [s * 0.45, 0.1, 0.5])], 0.07, 0.02, 4, 'horn'),
    );
  };
  // Whiskers: two long ones from either side of the snout, sweeping back and down; a beard of fins under the jaw.
  const whisker = (s: number, up: number): Mesh => taper(curve([s * 0.45, 2.45, -0.05 + up], [s * 1.9, 2.1, 0.75 + up * 2], [s * 2.5, 0.5, 0.35 + up * 3], 6), 0.085, 0.02, 4, 'membrane');
  const head = { open: dragonHead(n, k, H, C_EYE, false, headOpts), shut: dragonHead(n, k, H, C_EYE, true, headOpts) };
  const jaw = merge(
    tube([[0, 0.25, -0.1], [0, 1.0, -0.1], [0, 1.9, -0.08]], [0.55, 0.5, 0.3], [0.22, 0.2, 0.15], n, 'coatDark'),
    orbAlong([0, 1.2, 0.04], [0, 1, 0.05], [0.36, 0.68, 0.1], n, 3, 'tongue'),
    blade([[0, 0.9, -0.2], [0, 0.6, -0.65], [0, 0.2, -1.05]], [0.22, 0.2, 0.02], [1, 0, 0], { mat: 'mark', rib: 'membrane', fold: 0.1, thick: 0.05 }),
  );
  // A mane of fins down the back of the skull, swept back, the middle one longest.
  const mane = merge(...[[0, 1.0], [0.42, 0.75], [-0.42, 0.75]].map(([x, l]) => blade([[x, -0.2, 0.75], [x * 1.3, -0.75, 0.95 + l * 0.2], [x * 1.6, -1.35 * l - 0.2, 0.9 + l * 0.15], [x * 1.8, -1.8 * l - 0.3, 0.75]], [0.2, 0.26, 0.18, 0.02], [x ? Math.sign(x) * 0.6 : 1, 0, 0.6], { mat: 'mark', rib: 'membrane', fold: 0.12, thick: 0.05 })));
  // Fins down the spine, flame-shaped, in its markings' colour; the rune bands round the trunk.
  const fins: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const y = -2.1 + i * 1.0;
    const top = onRings(R, y, 0).p;
    fins.push(blade([add(top, [0, 0.35, -0.1]), add(top, [0, 0.05, 0.6]), add(top, [0, -0.4, 1.0]), add(top, [0, -0.8, 1.12])], [0.42, 0.38, 0.22, 0.02], [1, 0, 0], { mat: 'mark', rib: 'membrane', fold: 0.12, thick: 0.06 }));
  }
  const bands: Disc[] = [];
  for (const y of [-1.4, 1.2]) {
    const r = ringAt(R, y);
    bands.push(...bandRound(y, r.z, r.w, r.h, 0.11));
  }
  // The neck: two bands, fins down its back.
  const neckBits = merge(
    paint([...bandRound(0.6, 0, 0.88, 0.9, 0.1, 10).map(rotNeck), ...bandRound(1.75, 0, 0.82, 0.86, 0.1, 10).map(rotNeck)]),
    ...[0.35, 1.05, 1.75].map((z) => blade([[0, -0.72, z - 0.25], [0, -1.05, z + 0.05], [0, -1.3, z + 0.3]], [0.3, 0.24, 0.02], [1, 0, 0], { mat: 'mark', rib: 'membrane', fold: 0.12, thick: 0.05 })),
  );
  // The tail: links narrowing to a tuft of fins, a fin on each, a band round every other.
  const tailLinks = Array.from({ length: C_LINKS }, (_, q) => {
    const r0 = cTail(q), r1 = cTail(q + 1);
    const link = tube([[0, 0.12, 0], [0, -0.9, 0]], [r0, r1], [r0 * 0.92, r1 * 0.92], n, (ring, j) => (under(n, j, 1.0) ? 'mark' : 'coat'), { seam: 'start' });
    const fin = blade([[0, 0.05, r0 * 0.8], [0, -0.3, r0 * 0.8 + 0.42 - q * 0.02], [0, -0.75, r0 * 0.8 + 0.5 - q * 0.03]], [0.3 - q * 0.015, 0.25 - q * 0.012, 0.02], [1, 0, 0], { mat: 'mark', rib: 'membrane', fold: 0.12, thick: 0.05 });
    const ring = q % 3 === 1 ? paint(bandRound(-0.4, 0, (r0 + r1) / 2, (r0 + r1) / 2 * 0.92, 0.1, 9)) : null;
    if (q < C_LINKS - 1) return merge(link, fin, ring);
    const tuft = merge(...[-0.5, 0, 0.5].map((x) => blade([[0, -0.6, 0], [x * 0.5, -1.2, 0.15], [x, -1.9, 0.1]], [0.22, 0.26, 0.02], [0, 0, 1], { mat: 'mark', rib: 'membrane', fold: 0.1, thick: 0.05 })));
    return merge(link, fin, tuft);
  });
  const claws = (r: number): Mesh => merge(pawMesh(r, n, k, 'coat', 0.24), ...[-0.24, 0, 0.24].map((x) => taper([[x, 0.55, -0.16], [x * 1.3, 0.95, -0.24]], 0.1, 0.015, 4, 'horn')));
  // Fins from the elbows of the fore legs, swept back.
  const elbowFin = (s: number): Mesh => blade([[s * 0.35, 0, -0.6], [s * 0.5, -0.4, -0.75], [s * 0.6, -0.85, -0.7]], [0.2, 0.18, 0.02], [s, 0, 0], { mat: 'mark', rib: 'membrane', fold: 0.12, thick: 0.05 });
  const pieces = quadPieces({
    n, k,
    body: { ...R, belly: true },
    neck: { w: 0.82, h: 0.86, len: 2.6 },
    head: { c: H.c, r: H.r, eye: { dir: C_EYE, size: 0.01 } },
    tail: tailLinks,
    fore: { upper: [0.45, -0.95, 0.56, 0.44], lower: [0, -0.85, 0.42, 0.36], foot: claws(0.48) },
    hind: { upper: [0.6, -1.05, 0.68, 0.5], lower: [0, -1.0, 0.44, 0.36], foot: claws(0.5) },
    extras: [
      { key: 'jaw', mesh: jaw, bone: 'maw', bias: 0.19, under: 'head' },
      { key: 'antlers', mesh: merge(antler(1), antler(-1), mane), bone: 'head', bias: 0.22, after: ['head'] },
      { key: 'whiskers', mesh: merge(whisker(1, 0), whisker(-1, 0), whisker(1, -0.18), whisker(-1, -0.18)), bone: 'head', bias: 0.23, after: ['head', 'jaw'], thin: true },
      { key: 'fins', mesh: merge(...fins), bone: 'trunk', bias: 0.02, after: ['body'] },
      { key: 'bands', mesh: paint(bands), bone: 'trunk', bias: 0.025, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'], breathes: { c: [0, 0, 0], k: 0.04 } },
      { key: 'nbits', mesh: neckBits, bone: 'neck', bias: 0.01, after: 'neck' },
      { key: 'efin0', mesh: elbowFin(-1), bone: 'fl0', bias: 0.015, after: ['body'] },
      { key: 'efin1', mesh: elbowFin(1), bone: 'fr0', bias: 0.015, after: ['body'] },
      ...wingPair('wing', finWing(C_WING), foldC, ['body', 'fins', 'bands', 'neck', 'nbits']),
      wingReach(C_WING, C_SHOULDER, [-0.8, 0.7]),
    ],
    breath: 0.04,
  });
  const hd = pieces.find((p) => p.key === 'head')!;
  hd.mesh = head.open;
  hd.shut = head.shut;
  // The neck in an S, back from the shoulders and forward again under the head.
  pieces.find((p) => p.key === 'neck')!.mesh = tube([[0, 0, -0.3], [0, 0.3, 0.7], [0, -0.15, 1.6], [0, 0.05, 2.6]], [0.9, 0.86, 0.8, 0.76], [0.92, 0.88, 0.82, 0.78], n, (ring, j) => (ring > 0 && under(n, j, 0.8) ? 'mark' : 'coat'), { seam: 'both' });
  return pieces;
}
const bendAt = (pts: readonly V3[], t: number): V3 => pts[Math.round(t * (pts.length - 1))];
/** A disc of the neck's, laid round the neck bone's own length (its z) rather than along y. */
function rotNeck(d: Disc): Disc {
  // A quarter turn about x: along y becomes up z, and up becomes back (-y), the neck's back.
  return { ...d, v: d.v.map((p) => [p[0], -p[2], p[1]] as V3) };
}

/** How far it is off the ground: hovering a little standing, lifting clear as it runs, as a sky-dragon swims the air. */
function stormLift(a: Anim): number {
  const stand = 1.0 + 0.25 * (0.5 + 0.5 * cyc(a.t, 8));
  return lerp(stand, lerp(0.25, 1.5 + 0.25 * Math.sin(a.u * TAU * 2), a.gait), smooth(a.go));
}
/**
 * A sky-dragon's wing: an arm to the wrist, and a fan of long fins from the arm and the wrist in its markings' colour, each
 * banded near its tip with a ring of runes, lying in the wing's plane as a bat's fingers do, so it folds as they do.
 */
function finWing(W: Wing): Mesh {
  const parts: Mesh[] = [taper([[0, 0, 0], W.E], 0.24 * W.k, 0.15 * W.k, 5, 'coat'), orb(W.E, 0.2 * W.k, 6, 3, 'coat')];
  const decals: Disc[] = [];
  // From the wrist, toward each finger's tip and between them; from the arm, two shorter ones back toward the body.
  const tips: V3[] = [W.F[0], scale(add(W.F[0], W.F[1]), 0.5), W.F[1], scale(add(W.F[1], W.F[2]), 0.5), W.F[2], W.F[3]];
  const roots: V3[] = [...tips.map(() => W.E), scale(W.E, 0.62), scale(W.E, 0.3)];
  const ends: V3[] = [...tips.map((t, q) => add(W.E, scale(sub(t, W.E), 1.05 - q * 0.02))), add(scale(W.E, 0.62), scale(sub(W.F[3], W.E), 0.8)), add(scale(W.E, 0.3), scale(sub(W.B, [0, 0, 0]), 1.05))];
  roots.forEach((r, q) => {
    const e = ends[q], d = sub(e, r), wide = (0.36 + 0.04 * (q % 2)) * W.k;
    const pts = [0, 0.35, 0.82, 1].map((f): V3 => add(r, add(scale(d, f), [0, 0, Math.sin(f * Math.PI) * 0.08 * W.k])));
    parts.push(blade(pts, [wide * 0.4, wide, wide * 0.75, 0.02], [0, 0, 1], { mat: 'membrane', rib: 'mark', fold: 0.08, thick: 0.05 }));
    // The band of runes across it near its tip, on both faces.
    const at = add(r, scale(d, 0.74)), across = unit(cross([0, 0, 1], d)), half = wide * 0.78;
    for (const side of [1, -1]) {
      const N: V3 = [0, 0, side], lift = add(at, [0, 0, side * 0.075]);
      decals.push(band(sub(lift, scale(across, half)), add(lift, scale(across, half)), N, 0.17, 'ember'), band(sub(add(lift, [0, 0, side * 0.012]), scale(across, half)), add(add(lift, [0, 0, side * 0.012]), scale(across, half)), N, 0.07, 'flame'));
    }
  });
  return merge(...parts, paint(decals));
}
const C_WING = wingOf(1.25), C_SHOULDER: V3 = [0.78, 1.45, 0.72];
const foldC = (v: readonly V3[], a: Anim): V3[] => foldAbout(v, C_WING.E, 1 - stormOpen(a));
/** Spread wide as it hovers, rippling; beaten slowly walking and hard as it flies at a run; flung up as it coils to strike. */
function stormOpen(a: Anim): number {
  const base = lerp(0.84 + 0.06 * cyc(a.t, 6), lerp(0.7, 0.92, a.gait), smooth(a.go));
  return Math.max(base, phase(a, C_STRIKE.coil), 0.9 * phase(a, C_STRIKE.lunge));
}
function stormDown(a: Anim): number {
  const beat = Math.sin(a.u * TAU) * lerp(0.25, 0.65, a.gait) * smooth(a.go);
  return beat + 0.15 * cyc(a.t, 6) * (1 - smooth(a.go)) - 0.55 * phase(a, C_STRIKE.coil) - 0.2 * phase(a, C_STRIKE.lunge);
}
const C_STRIKE = { coil: [0, 0.22, 0.3, 0.42], lunge: [0.3, 0.42, 0.75, 0.95], jaw: [0.3, 0.42, 0.8, 0.96], bolt: [0.4, 0.46, 0.8, 0.92] } as const;
function stormOwn(p: QuadPose, a: Anim): void {
  const w = a.u - Math.floor(a.u);
  p.lift += stormLift(a);
  // Aloft standing, its legs drawn up under it, paddling a little.
  const tuck = 1 - smooth(a.go);
  for (const [i, sw] of [[0, -18], [1, -18], [2, 30], [3, 30]] as Array<[number, number]>) {
    p.legs[i][0] += tuck * (sw + 6 * cyc(a.t, 12, i * 1.7));
    p.legs[i][1] += tuck * 0.55;
  }
  if (a.go > 0) {
    p.neck[0] += 5 * Math.sin(w * TAU * 2) * a.go;
    p.head[0] -= 5 * Math.sin(w * TAU * 2) * a.go;
  } else {
    p.neck[1] += 20 * cyc(a.t, 2);
    p.head[1] += 8 * cyc(a.t, 3);
    const s = smooth(beat(a.t, [6.0, 17.5], 3.0) * 1.4);
    p.neck[0] -= 14 * s;
    p.head[0] += 14 * s;
    p.jaw = 0.4 * s;
  }
  const coil = phase(a, C_STRIKE.coil), lunge = phase(a, C_STRIKE.lunge), jaw = phase(a, C_STRIKE.jaw);
  if (!coil && !lunge && !jaw) return;
  p.lift += 0.8 * coil;
  p.pitch += 8 * coil - 3 * lunge;
  p.neck[0] += -26 * coil + 30 * lunge;
  p.neck[1] *= 1 - Math.max(coil, lunge);
  p.head[0] += 18 * coil - 20 * lunge;
  p.head[1] *= 1 - Math.max(coil, lunge);
  p.jaw = Math.max(p.jaw, jaw);
}
/** The tail in a wave: each link turned from the last, a wave running back down it, sideways and, aloft, up and down. */
function stormTail(b: Bones, p: QuadPose, a: Anim): void {
  const tl = C_SPEC.tail!;
  const go = smooth(a.go), air = clamp(stormLift(a) - 0.4);
  const ph = a.go > 0 ? a.u * TAU : (a.t * TAU) / 4;
  const amp = lerp(22, 20, go), lift = 4 * air + 10 * phase(a, C_STRIKE.coil);
  let prev = joint(b.body, tl.at, -(tl.lift + p.tail[0]), 0, amp * 0.6 * Math.sin(ph));
  b.tail0 = prev;
  for (let q = 1; q < C_LINKS; q++) {
    const yaw = amp * Math.sin(ph - q * 0.62) * (0.55 + q * 0.05);
    // Lying low along the ground at the root, its end lifted clear of it.
    const pitch = -tl.curl + (q > C_LINKS - 4 ? 6 : 0) + (7 + lift * 0.6) * Math.sin(ph * 0.5 - q * 0.75);
    prev = joint(prev, [0, -tl.len, 0], -pitch, 0, yaw);
    b[`tail${q}`] = prev;
  }
}
const C_MOUTH: V3 = [0, 2.85, -0.35], C_AIM: V3 = [0, 1, -0.18];
const BOLT: readonly [RGB, RGB, RGB] = [hex('#8f9ad8'), hex('#cfe0ff'), RUNE_WHITE];

/** A bolt of lightning from the mouth: a jagged line out along the aim, inked, pale blue round a white core; a flash where it ends. */
function bolt(g: CanvasRenderingContext2D, view: View, from: V3, dir: V3, len: number, k: number, t: number): void {
  if (k <= 0.01) return;
  const N = 11;
  const side = unit(cross(dir, [0, 0, 1]));
  const pts: Array<[number, number]> = [];
  const flick = Math.floor(t * 14);
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * Math.min(1, k * 1.3);
    const j = i === 0 || i === N ? 0 : (i % 2 ? 1 : -1) * (0.35 + 0.3 * Math.abs(Math.sin(i * 12.9898 + flick * 78.233))) * Math.min(1, i / 2);
    pts.push(onScreen(view, add(add(from, scale(dir, len * s)), add(scale(side, j), [0, 0, Math.cos(i * 7.1 + flick) * 0.25 * (i ? 1 : 0)]))));
  }
  const path = (): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  };
  const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  path();
  g.strokeStyle = INK;
  g.lineWidth = 0.78;
  g.stroke();
  g.strokeStyle = css(BOLT[0]);
  g.lineWidth = 0.6;
  g.stroke();
  g.strokeStyle = css(BOLT[1]);
  g.lineWidth = 0.36;
  g.stroke();
  g.strokeStyle = css(BOLT[2]);
  g.lineWidth = 0.15;
  g.stroke();
  // Where it strikes: a burst of short rays and a ring.
  const [ex, ey] = pts[pts.length - 1];
  if (k > 0.6) {
    const r = 0.55 + 0.35 * Math.sin(flick);
    g.beginPath();
    for (let q = 0; q < 6; q++) {
      const ang = (q / 6) * TAU + flick;
      g.moveTo(ex + Math.cos(ang) * r * 0.5, ey + Math.sin(ang) * r * 0.35);
      g.lineTo(ex + Math.cos(ang) * r * 1.5, ey + Math.sin(ang) * r);
    }
    g.strokeStyle = INK;
    g.lineWidth = 0.3;
    g.stroke();
    g.strokeStyle = css(BOLT[1]);
    g.lineWidth = 0.16;
    g.stroke();
  }
  g.restore();
}

export const STORMCOIL: Kind = {
  bones: quadDragonBones(C_SPEC, stormOwn, [0, 0.3, -0.25], 36, { at: C_SHOULDER, open: stormOpen, down: stormDown }, stormTail),
  build: stormBuild,
  palette: (coat, mark) => {
    const c = richer(mix(coat, pastel(coat, 250), 0.5), 1.45);
    const m = pastel(mark, 250);
    return coatPalette(coat, mark, {
      coat: c, coatDark: darker(c, 0.24), lid: darker(c, 0.45), mark: m, membrane: darker(m, 0.25),
      horn: [242, 230, 204], hornDark: [205, 186, 156], tooth: [250, 244, 226], tongue: [168, 72, 76],
      ember: RUNE_EDGE, flame: RUNE_GOLD, bloom: RUNE_WHITE, nose: darker(c, 0.4),
    }, 250);
  },
  shadow: [4.4, 2.0],
  stride: 0.7,
  size: 4.2 * MONSTER_GROWTH,
  blinks: 6,
  acts: ['strike'],
  glow: (b, a) => {
    const t = b.trunk ?? b.body;
    const bolting = phase(a, C_STRIKE.bolt);
    const out: Light[] = [];
    for (const [q, y] of [-1.6, 0, 1.5].entries()) out.push({ p: place(t, [0, y, 1.2]), r: 1.3, c: RUNE_EDGE, a: 0.1 + 0.06 * cyc(a.t, 4, -q * 0.9) + 0.2 * bolting });
    if (b.head) for (const s of [1, -1]) out.push({ p: place(b.head, onEgg(C_HEAD.c, C_HEAD.r, [C_EYE[0] * s, C_EYE[1], C_EYE[2]]).p), r: 0.45, c: RUNE_GOLD, a: 0.45 });
    if (bolting && b.head) out.push({ p: place(b.head, C_MOUTH), r: 2.8, c: [200, 215, 255], a: 0.5 * bolting });
    return out;
  },
  extra: (g, view, b, a, under) => {
    if (!b.head) return;
    const k = phase(a, C_STRIKE.bolt);
    if (k > 0) {
      const dir = unit(turnOf(b.head, C_AIM));
      const away = dot(dir, view.T) < -0.25;
      if (away === under) bolt(g, view, place(b.head, C_MOUTH), dir, 4.6, k, a.act?.t ?? 0);
    }
  },
};

/* ---- the three -------------------------------------------------------------------------- */

/** Each subspecies' body, in the order of the dragon's variants and of its subspecies' names (`SpeciesDef.subspecies`). */
export const DRAGONS: readonly Kind[] = [RUNEWING, RUNESTONE_DRAKE, STORMCOIL];
