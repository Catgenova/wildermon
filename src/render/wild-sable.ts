import {
  ACT_SECS, add, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, merge, mix, orbAlong, paint, scale, smooth, sub,
  TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import {
  badgerBones, BADGER_HITS, barrelSolid, blot, blowFlash, css, domed, earOf, eyesOf, headSolids, hump, jitter,
  left, legPieces, line, mixV, nearSide, onRings, ramp, restOf, specOf, stillPlan, stirOf, strikeBurst, thrown,
  wound, type Badger, type Plan, type Rest, type Stir,
} from './wild-badger';

/**
 * The sable line: the Sablekit, a small badger of a kit, dark brown, a cream face with a dark band through each amber eye and a
 * dark stripe down its muzzle, small round ears, short legs and dark claws, a mantle of layered feathers -- red, orange and
 * cream, tipped dark red -- over its back and down its flanks, and a little wooden tub of a basket strapped on its back with
 * feathers standing up out of it; which grows into the Sableplume, longer and bigger, a tall crest of red, orange and cream
 * feathers fanned up off its back behind a wooden chest-pack bound in brass, a roll of cloth strapped on it, a skirt of feathers
 * down its flanks and a harness buckled in brass; and then the Fletchercrest, big and long, an enormous fan of red and cream
 * feathers sweeping back off its shoulders and down its sides, a woven gold basket of a quiver full of arrows on its back, a
 * leather saddle-flap with a gold leaf on it, a feather charm hanging on a cord at its chest, a cream ruff and strong claws. The
 * species is still `flecha` underneath, as saves and the database know it: the fletcher.
 *
 * Its body, legs, gait, head and strikes are the badger line's (`./wild-badger`), built from a description of the stage
 * (`Sable`, a `Badger` with its feathers and packs). At its task it sits back on its haunches with an arrow shaft held across in
 * its fore paws, trims the feathers at its end with its teeth, three snips, bits of feather falling, then turns the shaft in its
 * paws to bind them on, and holds it up to look along it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** The colours of a feather from its root to its tip, each side of its shaft: red, orange, cream, and cream blushing orange. */
type Scheme = 'red' | 'orange' | 'cream' | 'blush';

/** Rows of feathers lying back over its back and down its flanks: from and to (along it), rows, feathers to a side of a row, how far down round it (radians from the top), how long and wide, how far lifted off it (degrees). */
interface Mantle { from: number; to: number; rows: number; per: number; spread: number; len: number; w: number; lift: number }

/** A fan of long feathers out of its back: its root (along, up), how many to a side in each tier, the tiers' rise (degrees above level, back), how far out (degrees), how long and wide. */
interface Fan { at: number; up: number; tiers: ReadonlyArray<{ n: number; rise: [number, number]; out: [number, number]; len: number; w: number }> }

/** What is strapped on its back: a little tub (`basket`), a brass-bound chest with a roll of cloth (`chest`), or a woven quiver of arrows (`quiver`); where along it, and its half-sizes. */
interface Pack { kind: 'basket' | 'chest' | 'quiver'; at: number; r: V3; tilt: number }

interface Sable extends Badger {
  mantle: Mantle;
  /** Feathers down its flanks below the mantle: from and to (along), how many a side, how long. */
  skirt: { from: number; to: number; n: number; len: number; w: number } | null;
  /** The Sableplume's crest, the Fletchercrest's great fan. */
  fan: Fan | null;
  pack: Pack;
  /** Feathers standing up out of the pack: how many, how long. */
  plume: { n: number; len: number; w: number };
  /** Straps round its girth and over its chest, buckled in brass. */
  harness: boolean;
  /** The Fletchercrest's leather saddle-flap down each flank, with a gold leaf on it. */
  flap: boolean;
  /** The Fletchercrest's charm on a cord at its chest: how long the cord. */
  charm: number;
  /** Cream tufts round the back of its neck: how many, how long. */
  ruff: { n: number; len: number; w: number };
  /** Feathers up off the back of its head, behind the ears: how many, how long. */
  crown: { n: number; len: number };
  /** The arrow it works: how long and how thick. */
  shaft: { len: number; r: number };
}

/** The work timings, nothing of a badger's digging in them. */
const NO_DIG = { snuffle: 0, dig: 0, sniff: 0, mark: 0 };
const NO_PLATES = { from: 0, to: 0, rows: 0, per: 0, spread: 0.9, a: 0, b: 0, t: 0.03, lift: 0 };
const NO_LEAVES = { n: 0, len: 0, from: 0, to: 0 };

/** A Sablekit: a small long badger kit, a mantle of feathers, a little tub of a basket on its back with feathers standing out of it. */
const SABLEKIT_LOOK: Sable = {
  stage: 0,
  body: { y: [-1.04, -0.9, -0.5, 0, 0.46, 0.72, 0.84], z: [-0.02, 0.01, 0.04, 0.06, 0.07, 0.07, 0.05], w: [0.27, 0.45, 0.53, 0.54, 0.51, 0.43, 0.24], h: [0.18, 0.28, 0.33, 0.34, 0.33, 0.28, 0.16] },
  len: 1.18,
  fore: [0.18, 0.17, 0.07], hind: [0.18, 0.17, 0.07], thick: 0.19, hip: 0.56, hindThick: 1.08,
  stand: { fore: [0, 44], hind: [24, -60] },
  paw: 0.14, hindPaw: 0.13,
  claw: { n: 4, len: 0.08, w: 0.03 }, hindClaw: 0.05,
  neck: { at: [0, 0.64, 0.1], len: 0.13, w: 0.36, lean: 74 },
  head: {
    // A long wedge to a pointed nose, broad over the cheeks.
    y: [-0.27, -0.207, -0.072, 0.072, 0.198, 0.306, 0.387, 0.441], z: [0.072, 0.081, 0.072, 0.036, 0, -0.023, -0.034, -0.041],
    w: [0.099, 0.342, 0.396, 0.36, 0.27, 0.18, 0.117, 0.068], h: [0.108, 0.324, 0.36, 0.297, 0.207, 0.135, 0.09, 0.054], pitch: -8,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.22 },
  nose: 0.054,
  eye: { y: 0.09, up: 0.5, size: 0.062, tall: 1.05, lid: 0 },
  ear: { len: 0.13, w: 0.12, out: 58, back: 22, at: [0.42, 1.0] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 0.2, w: 0.08, lift: 16, leaves: 0 },
  gait: { bob: [0.05, 0.06], duty: [0.58, 0.44], swing: [38, 42], step: 0.5, roll: 9, nod: 4, sway: 6, jiggle: 0.5 },
  strike: 0,
  digs: 0,
  work: NO_DIG,
  size: 4.0,
  mantle: { from: 0.5, to: -0.92, rows: 6, per: 6, spread: 1.35, len: 0.42, w: 0.065, lift: 12 },
  skirt: null,
  fan: null,
  pack: { kind: 'basket', at: -0.18, r: [0.24, 0.44, 0.16], tilt: 6 },
  plume: { n: 12, len: 0.6, w: 0.075 },
  harness: false,
  flap: false,
  charm: 0,
  ruff: { n: 12, len: 0.2, w: 0.045 },
  crown: { n: 0, len: 0 },
  shaft: { len: 0.95, r: 0.02 },
};

/** A Sableplume: longer and bigger, a tall crest of feathers, a brass-bound chest on its back with a roll of cloth, a skirt of feathers, a harness. */
const SABLEPLUME_LOOK: Sable = {
  stage: 1,
  body: { y: [-1.42, -1.24, -0.7, -0.05, 0.6, 1.02, 1.2], z: [-0.12, -0.06, 0.02, 0.08, 0.12, 0.1, 0.04], w: [0.4, 0.72, 0.86, 0.88, 0.84, 0.7, 0.36], h: [0.22, 0.4, 0.52, 0.56, 0.56, 0.48, 0.26] },
  len: 2.0,
  fore: [0.33, 0.3, 0.1], hind: [0.33, 0.3, 0.1], thick: 0.28, hip: 0.64, hindThick: 1.06,
  stand: { fore: [8, 50], hind: [24, -62] },
  paw: 0.22, hindPaw: 0.18,
  claw: { n: 4, len: 0.18, w: 0.05 }, hindClaw: 0.1,
  neck: { at: [0, 1.0, 0.16], len: 0.26, w: 0.56, lean: 90 },
  head: {
    y: [-0.42, -0.32, -0.1, 0.13, 0.34, 0.52, 0.65, 0.74], z: [0.12, 0.14, 0.12, 0.06, 0, -0.04, -0.06, -0.07],
    w: [0.16, 0.5, 0.58, 0.53, 0.39, 0.27, 0.18, 0.1], h: [0.17, 0.49, 0.54, 0.45, 0.31, 0.2, 0.13, 0.08], pitch: -12,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.2 },
  nose: 0.078,
  eye: { y: 0.13, up: 0.5, size: 0.074, tall: 1.0, lid: 0.12 },
  ear: { len: 0.19, w: 0.17, out: 56, back: 24, at: [0.42, 1.02] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 0.4, w: 0.14, lift: 6, leaves: 0 },
  gait: { bob: [0.07, 0.09], duty: [0.6, 0.5], swing: [36, 40], step: 0.42, roll: 8, nod: 3, sway: 5, jiggle: 0.45 },
  strike: 1,
  digs: 0,
  work: NO_DIG,
  size: 3.5,
  mantle: { from: 0.95, to: -1.3, rows: 6, per: 6, spread: 1.15, len: 0.74, w: 0.1, lift: 16 },
  skirt: { from: 0.7, to: -1.2, n: 9, len: 0.5, w: 0.13 },
  fan: {
    at: -0.62, up: 0.92,
    tiers: [
      { n: 6, rise: [42, 88], out: [6, 18], len: 1.45, w: 0.17 },
      { n: 6, rise: [30, 76], out: [22, 36], len: 1.3, w: 0.16 },
      { n: 5, rise: [18, 56], out: [40, 54], len: 1.05, w: 0.15 },
    ],
  },
  pack: { kind: 'chest', at: -0.05, r: [0.42, 0.58, 0.3], tilt: 4 },
  plume: { n: 0, len: 0, w: 0 },
  harness: true,
  flap: false,
  charm: 0,
  ruff: { n: 14, len: 0.44, w: 0.08 },
  crown: { n: 0, len: 0 },
  shaft: { len: 1.5, r: 0.03 },
};

/** A Fletchercrest: big and long, an enormous fan of feathers off its shoulders, a woven gold quiver of arrows, a saddle-flap, a charm, a cream ruff. */
const FLETCHERCREST_LOOK: Sable = {
  stage: 2,
  body: { y: [-3.0, -2.66, -1.6, 0, 1.45, 2.3, 2.66], z: [-0.16, -0.04, 0.16, 0.34, 0.44, 0.32, 0.08], w: [0.84, 1.42, 1.76, 1.8, 1.8, 1.52, 0.78], h: [0.42, 0.8, 1.16, 1.32, 1.36, 1.02, 0.46] },
  len: 4.8,
  fore: [1.18, 1.04, 0.36], hind: [1.12, 1.02, 0.34], thick: 1.08, hip: 0.64, hindThick: 1.0,
  stand: { fore: [8, 46], hind: [24, -58] },
  paw: 0.58, hindPaw: 0.48,
  claw: { n: 4, len: 0.62, w: 0.15 }, hindClaw: 0.3,
  neck: { at: [0, 2.3, 0.7], len: 0.8, w: 1.1, lean: 70 },
  head: {
    y: [-0.7, -0.53, -0.12, 0.34, 0.79, 1.17, 1.45, 1.63], z: [0.26, 0.31, 0.26, 0.14, 0.02, -0.06, -0.1, -0.11],
    w: [0.29, 0.92, 1.03, 0.91, 0.66, 0.46, 0.3, 0.17], h: [0.26, 0.88, 0.93, 0.76, 0.52, 0.32, 0.21, 0.12], pitch: -6,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.2 },
  nose: 0.14,
  eye: { y: 0.25, up: 0.5, size: 0.125, tall: 0.92, lid: 0.3 },
  ear: { len: 0.36, w: 0.33, out: 56, back: 26, at: [0.42, 1.04] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 1.1, w: 0.4, lift: 0, leaves: 0 },
  gait: { bob: [0.16, 0.2], duty: [0.62, 0.52], swing: [30, 34], step: 0.34, roll: 6, nod: 2, sway: 5, jiggle: 0.35 },
  strike: 2,
  digs: 0,
  work: NO_DIG,
  size: 1.85,
  mantle: { from: 2.2, to: -2.8, rows: 7, per: 7, spread: 1.1, len: 1.6, w: 0.21, lift: 18 },
  skirt: { from: 1.9, to: -2.5, n: 13, len: 1.25, w: 0.23 },
  fan: {
    at: 1.5, up: 0.9,
    tiers: [
      { n: 6, rise: [22, 56], out: [6, 18], len: 6.2, w: 0.5 },
      { n: 6, rise: [2, 26], out: [16, 30], len: 7.6, w: 0.5 },
      { n: 5, rise: [-18, 2], out: [28, 42], len: 5.4, w: 0.46 },
    ],
  },
  pack: { kind: 'quiver', at: -0.3, r: [0.85, 1.55, 0.52], tilt: 6 },
  plume: { n: 9, len: 1.9, w: 0 },
  harness: true,
  flap: true,
  charm: 1.0,
  ruff: { n: 22, len: 2.2, w: 0.28 },
  crown: { n: 5, len: 1.2 },
  shaft: { len: 3.6, r: 0.07 },
};

/* ---- a feather ------------------------------------------------------------------------ */

/** Each scheme's colours, root to tip: on its right side and its left. */
const SCHEMES: Record<Scheme, readonly [readonly Mat[], readonly Mat[]]> = {
  red: [['petal', 'feather', 'feather', 'feather', 'feather', 'featherDark'], ['cap', 'feather', 'feather', 'feather', 'featherDark', 'featherDark']],
  orange: [['petal', 'cap', 'ember', 'ember', 'ember', 'feather'], ['petal', 'ember', 'ember', 'ember', 'feather', 'feather']],
  cream: [['petal', 'petal', 'petal', 'petal', 'petal', 'ember'], ['petal', 'petal', 'petal', 'petal', 'cap', 'feather']],
  blush: [['petal', 'petal', 'petal', 'cap', 'ember', 'feather'], ['petal', 'petal', 'petal', 'petal', 'cap', 'ember']],
};
/** A feather's stations along it, and its half-width at each, as shares of its length and width. */
const STATIONS = [0, 0.1, 0.3, 0.55, 0.76, 0.9, 1];
const WIDTHS = [0.2, 0.62, 0.92, 1, 0.84, 0.52, 0];

/**
 * A feather from `root` along `dir`, `L` long and `W` across each side of its shaft, its face turned toward `face`: two vanes either
 * side of the shaft, each lifted a little toward its edge, arched along its length by `arch` and drooping by `droop`; coloured
 * root to tip by its scheme. Both its sides drawn, whichever is toward the viewer.
 */
function featherMesh(root: V3, dir: V3, face: V3, L: number, W: number, scheme: Scheme, arch = 0.06, droop = 0.08): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const at = (x: number, s: number): V3 => add(add(add(root, scale(d, s * L)), scale(side, x * W)),
    add(scale(n0, 0.18 * Math.abs(x) * W + arch * L * Math.sin(Math.PI * s * 0.9)), [0, 0, -droop * L * s * s]));
  const [right, leftM] = SCHEMES[scheme];
  // Its face and its back, each a grid of its own sharing its corners, so a feather is inked round its edge and not across it.
  const grid: V3[] = [];
  for (let q = 0; q < STATIONS.length; q++) grid.push(at(-WIDTHS[q], STATIONS[q]), at(0, STATIONS[q]), at(WIDTHS[q], STATIONS[q]));
  const N = grid.length, v: V3[] = [...grid, ...grid], f: Face[] = [], want: V3[] = [];
  for (const [base, out] of [[0, n0], [N, scale(n0, -1)]] as Array<[number, V3]>) {
    for (let q = 0; q < STATIONS.length - 1; q++) {
      const a = base + q * 3, b = base + (q + 1) * 3;
      f.push({ i: [a + 1, a + 2, b + 2, b + 1], m: right[q] });
      want.push(out);
      f.push({ i: [a + 1, b + 1, b, a], m: leftM[q] });
      want.push(out);
    }
  }
  // Its shaft down the middle of either side, a thin dark line from its root to near its tip.
  const rib = scheme === 'cream' ? 'cap' : 'featherDark';
  const ribOn = (k: number): Disc => {
    const lift = scale(n0, k * 0.004 * L);
    return { v: [add(at(-0.07, 0.04), lift), add(at(0.07, 0.04), lift), add(at(0.025, 0.86), lift), add(at(-0.025, 0.86), lift)], m: rib };
  };
  return merge(mesh(v, wound(v, f, want)), paint([ribOn(1), ribOn(-1)]));
}

/** Which scheme a feather is, by a number of its own and where it is: `warm` from nought, mostly cream, to one, mostly red. */
function schemeOf(id: number, warm: number): Scheme {
  // Mostly by where it is, a little by itself: bands of colour, as on the sheet, and not a scatter.
  const w = warm + (jitter(id * 3 + 11) - 0.5) * 0.3, odd = jitter(id * 5 + 2) < 0.5;
  if (w > 0.72) return jitter(id * 7 + 5) < 0.7 ? 'red' : 'orange';
  if (w > 0.48) return odd ? 'orange' : 'blush';
  if (w > 0.26) return odd ? 'blush' : 'cream';
  return 'cream';
}

/** A feather to be stirred: its mesh, its root, a number of its own and how much it stirs. */
type Plume = { mesh: Mesh; root: V3; id: number; k?: number };

/* ---- what grows on its back ---------------------------------------------------------- */

/** A frame on its body: where a point round it is (`th` from its right side, up positive), its way out, along it, and down round it. */
function frameOn(s: Sable, y: number, th: number, sd: number): { p: V3; n: V3; back: V3; down: V3 } {
  const q0 = onRings(s.body, y, th), q = sd > 0 ? q0 : left(q0);
  const back = unit(sub([0, -1, 0], scale(q.n, -q.n[1])));
  // `down` the way round the body away from its top, on either side.
  return { p: q.p, n: q.n, back, down: scale(unit(cross(q.n, back)), sd) };
}

/**
 * The mantle: rows of feathers from the shoulders back to the rump, each row round the back from its top down the flank on either
 * side, each feather lying back along it and down round it a little, lifted off it: red and orange along the top, more cream down
 * the flanks, every one tipped darker. The rows behind lie over the ones in front, as on a bird.
 */
function mantleOf(s: Sable): Plume[] {
  const M = s.mantle, out: Plume[] = [];
  for (let r = 0; r < M.rows; r++) {
    const f = r / Math.max(1, M.rows - 1);
    const y = lerp(M.from, M.to, f);
    const per = M.per + (r % 2);
    for (const sd of [1, -1]) {
      for (let q = 0; q < per; q++) {
        const id = 1000 + r * 37 + q * 5 + (sd > 0 ? 0 : 500);
        const g = (q + (r % 2 ? 0.5 : 0)) / per;
        const th = Math.PI / 2 - g * M.spread - 0.08;
        const F = frameOn(s, y + (jitter(id) - 0.5) * 0.06 * s.len, th, sd);
        // None under the saddle-flap, which lies over the feathers there.
        if (s.flap && y < flapY(s)[0] + 0.04 * s.len && y > flapY(s)[1] && th < FLAP_TH[0] + 0.1 && th > FLAP_TH[1] - 0.1) continue;
        const L = M.len * (0.93 + 0.14 * jitter(id + 1)) * (1 + 0.35 * g) * (1 - 0.15 * f);
        const lift = (M.lift + 5 * jitter(id + 2)) * DEG;
        const dir = unit(add(add(scale(F.back, Math.cos(lift) * (1 - 0.3 * g)), scale(F.n, Math.sin(lift))), scale(F.down, 0.25 + 0.65 * g)));
        const root = add(F.p, scale(F.n, s.len * 0.01));
        const warm = clamp(1.1 - g * 1.0 + 0.15 * (1 - f));
        out.push({ mesh: featherMesh(root, dir, F.n, L, M.w * (0.85 + 0.3 * jitter(id + 3)), schemeOf(id, warm), 0.05, 0.04), root, id, k: 0.6 + 0.6 * g });
      }
    }
  }
  return out;
}

/** The skirt: long feathers down its flanks below the mantle, hanging down and back, mostly cream with red and orange among them. */
function skirtOf(s: Sable): Plume[] {
  const S = s.skirt;
  if (!S) return [];
  const out: Plume[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < S.n; q++) {
      const id = 3000 + q * 7 + (sd > 0 ? 0 : 300);
      const f = q / Math.max(1, S.n - 1);
      const y = lerp(S.from, S.to, f) + (jitter(id) - 0.5) * 0.04 * s.len;
      const F = frameOn(s, y, -0.05 + 0.25 * jitter(id + 1), sd);
      const dir = unit(add(add(scale(F.down, 0.9), scale(F.back, 0.7 + 0.3 * f)), scale(F.n, 0.28)));
      const root = add(F.p, scale(F.n, s.len * 0.012));
      const L = S.len * (0.85 + 0.3 * jitter(id + 2)) * (0.9 + 0.25 * f);
      out.push({ mesh: featherMesh(root, dir, F.n, L, S.w, schemeOf(id, 0.35 + 0.3 * f), 0.05, 0.02), root, id, k: 1 });
    }
  }
  return out;
}

/**
 * The fan: long feathers out of its back in tiers either side, each feather turned out from the middle and leaning back, each
 * tier lower and further out than the one above it, so from in front it is a fan and not an edge; faced out to its side and up.
 */
function fanOf(s: Sable): Plume[] {
  const Fn = s.fan;
  if (!Fn) return [];
  const out: Plume[] = [];
  const B = s.body, top = onRings(B, Fn.at, Math.PI / 2);
  Fn.tiers.forEach((T, ti) => {
    for (const sd of [1, -1]) {
      for (let q = 0; q < T.n; q++) {
        const id = 5000 + ti * 101 + q * 13 + (sd > 0 ? 0 : 50);
        const f = T.n > 1 ? q / (T.n - 1) : 0.5;
        const rise = lerp(T.rise[1], T.rise[0], f) * DEG, outA = lerp(T.out[0], T.out[1], f) * DEG + (jitter(id) - 0.5) * 0.08;
        // Back and up at `rise`, turned out to its side by `out`.
        const dir = unit([sd * Math.sin(outA) * Math.cos(rise), -Math.cos(outA) * Math.cos(rise), Math.sin(rise)]);
        const across = (0.14 + 0.32 * ti) * B.w[3] * (0.8 + 0.4 * f);
        const root: V3 = [sd * across, top.p[1] + (f - 0.5) * 0.12 * s.len - ti * 0.04 * s.len, top.p[2] * Fn.up - ti * 0.12 * B.h[3]];
        // Faced out to the side, a little up and back: what is seen of it from in front and from the side.
        const face = unit(add([sd, 0.15, 0.35], scale(dir, -0.2)));
        // The steepest the shortest, so the fan sweeps back rather than standing up.
        const L = T.len * (0.88 + 0.24 * jitter(id + 1)) * (1 - 0.35 * Math.max(0, Math.sin(rise)));
        const warm = 0.95;
        out.push({ mesh: featherMesh(root, dir, face, L, T.w * (0.9 + 0.2 * jitter(id + 2)), ti === 0 ? schemeOf(id, warm) : q % 2 ? (ti === 2 ? 'blush' : 'cream') : jitter(id + 4) < 0.65 ? 'red' : 'orange', 0.07, 0.17 + 0.03 * ti), root, id, k: 0.7 + 0.2 * ti });
      }
    }
  });
  return out;
}

/** The ruff: cream tufts round the back and sides of its neck, lying back over its shoulders. */
function ruffOf(s: Sable): Plume[] {
  const R = s.ruff, out: Plume[] = [];
  const B = s.body, y = lerp(B.y[5], B.y[6], 0.35);
  for (let q = 0; q < R.n; q++) {
    const id = 7000 + q * 3;
    const g = R.n > 1 ? q / (R.n - 1) : 0.5;
    // Two rows, the second behind the first and longer, round from under one ear over the back of the neck to the other.
    const row = q % 2, th = lerp(-0.45, Math.PI + 0.45, g) + (jitter(id) - 0.5) * 0.2;
    const q0 = onRings(B, y - row * 0.06 * s.len, th);
    const sd = Math.cos(th) >= 0 ? 1 : -1;
    const dir = unit(add(add([0, -1, 0], scale(q0.n, 0.7 + 0.2 * jitter(id + 3))), [0, 0, -0.1]));
    const root = add(q0.p, scale(q0.n, 0.005));
    out.push({ mesh: featherMesh(root, dir, q0.n, R.len * (0.8 + 0.3 * jitter(id + 1)) * (1 + 0.25 * row), R.w, jitter(id + 2) < 0.15 ? 'blush' : 'cream', 0.08, 0.04), root, id: id + sd, k: 0.5 });
  }
  return out;
}

/* ---- what is strapped on it ------------------------------------------------------------ */

/** The pack's frame on its back: its middle and its axes (across, along, up), tilted back a little. */
function packFrame(s: Sable): { c: V3; x: V3; y: V3; z: V3 } {
  const P = s.pack, top = onRings(s.body, P.at, Math.PI / 2);
  const a = P.tilt * DEG;
  const z: V3 = [0, -Math.sin(a), Math.cos(a)], y: V3 = [0, Math.cos(a), Math.sin(a)];
  return { c: add(top.p, scale(z, P.r[2] * 0.55)), x: [1, 0, 0], y, z };
}
const inFrame = (F: { c: V3; x: V3; y: V3; z: V3 }, p: V3): V3 => add(F.c, add(add(scale(F.x, p[0]), scale(F.y, p[1])), scale(F.z, p[2])));
const meshIn = (F: { c: V3; x: V3; y: V3; z: V3 }, m: Mesh): Mesh => mesh(m.v.map((p) => inFrame(F, p)), m.f);

/** A tub of staves, upright, oval, `r` its half-sizes: the staves in two woods, a dark band round it near its foot and at its rim, open at the top, dark inside. */
function tubMesh(r: V3, n: number, staves: (ring: number, j: number) => Mat, rows = 0): Mesh {
  // Either a tub's bands (foot, belly, top and rim), or `rows` even courses of a weave, wider toward the mouth.
  const zs = rows ? Array.from({ length: rows + 1 }, (_, q) => lerp(-r[2], r[2], q / rows)) : [-r[2], -r[2] * 0.7, -r[2] * 0.1, r[2] * 0.55, r[2] * 0.8, r[2]];
  const ks = rows ? zs.map((_, q) => 0.84 + 0.2 * Math.sin((Math.PI / 2) * (q / rows))) : [0.84, 0.92, 1, 1, 1.02, 1.04];
  const last = zs.length - 1;
  return tube(zs.map((z) => [0, 0, z] as V3), ks.map((k) => r[0] * k), ks.map((k) => r[1] * k), n, (ring, j) => (ring >= last ? 'woodDark' : staves(ring, j)), { up: [0, 1, 0] });
}

/** A strap round its body at `y`: a flat band over its skin, all the way round, `w` wide; and a brass buckle on each side. */
function girth(s: Sable, y: number, w: number, buckles: boolean): Mesh {
  const B = s.body, n = 16, pts: V3[] = [];
  const parts: Mesh[] = [];
  // As a ring of quads, a little off the skin.
  const ring = (dy: number): V3[] => Array.from({ length: n }, (_, j) => {
    const q = onRings(B, y + dy, (j / n) * TAU);
    return add(q.p, scale(q.n, 0.012 * s.len + 0.004));
  });
  const a = ring(-w / 2), b = ring(w / 2);
  pts.push(...a, ...b);
  const f: Face[] = [];
  const want: V3[] = [];
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    f.push({ i: [j, j1, n + j1, n + j], m: 'leather' });
    want.push(onRings(B, y, ((j + 0.5) / n) * TAU).n);
  }
  parts.push(mesh(pts, wound(pts, f, want)));
  if (buckles) {
    for (const sd of [1, -1]) {
      const q0 = onRings(B, y, -0.25), q = sd > 0 ? q0 : left(q0);
      const c = add(q.p, scale(q.n, 0.02 * s.len + 0.008));
      parts.push(paint([disc(c, q.n, w * 0.75, w * 0.75, 4, 'metal', { up: [0, 1, 0], spin: Math.PI / 4 }), disc(add(c, scale(q.n, 0.004)), q.n, w * 0.42, w * 0.42, 4, 'leatherDark', { up: [0, 1, 0], spin: Math.PI / 4 })]));
    }
  }
  return merge(...parts);
}

/** A band round the front of its chest from shoulder to shoulder, under its neck: the harness's breast strap, buckled in brass in front. */
function breastStrap(s: Sable, w: number): Mesh {
  const B = s.body, n = 9, y = B.y[5] + 0.02 * s.len;
  const pts: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let j = 0; j <= n; j++) {
    // From the right shoulder down round under the chest to the left one: th from up-right round under.
    const th = lerp(0.6, Math.PI - 0.6, j / n) + Math.PI;
    const q = onRings(B, y + Math.sin(Math.PI * j / n) * 0.06 * s.len, th);
    const c = add(q.p, scale(q.n, 0.015 * s.len + 0.004));
    const along = unit(cross(q.n, [0, 1, 0]));
    pts.push(add(c, [0, w / 2, 0]), add(c, [0, -w / 2, 0]));
    if (j) {
      const b = (j - 1) * 2;
      f.push({ i: [b, b + 1, b + 3, b + 2], m: 'leather' });
      want.push(q.n);
    }
    void along;
  }
  const mid = onRings(B, y + 0.06 * s.len, Math.PI * 1.5);
  const c = add(mid.p, scale(mid.n, 0.02 * s.len + 0.008));
  return merge(mesh(pts, wound(pts, f, want)), paint([disc(c, mid.n, w * 0.8, w * 0.8, 6, 'metal'), disc(add(c, scale(mid.n, 0.004)), mid.n, w * 0.4, w * 0.4, 6, 'metalDark')]));
}

/**
 * The Sablekit's basket: a little tub of staves strapped on its back, two dark bands round it, feathers standing up out of it
 * fanned back and out, a strap round its girth.
 */
function basketOf(s: Sable, n: number): { mesh: Mesh; plumes: Plume[] } {
  const F = packFrame(s), r = s.pack.r;
  const tub = tubMesh(r, Math.max(n, 12), (ring, j) => (ring === 1 || ring === 4 ? 'metal' : j % 2 ? 'wood' : 'bark'));
  const plumes: Plume[] = [];
  for (let q = 0; q < s.plume.n; q++) {
    const id = 9000 + q * 7;
    // In two rows, a fan each: the front row standing up and leaning back, the back row lower and further back; spread side to side.
    const row = q % 2, f = (Math.floor(q / 2) + 0.5 * row) / Math.ceil(s.plume.n / 2) - 0.45;
    const root = inFrame(F, [f * r[0] * 1.4, (row ? -0.35 : 0.2) * r[1], r[2] * 0.5]);
    const rise = (row ? 38 : 62) * DEG + (jitter(id) - 0.5) * 0.3, out = f * 1.9;
    const dir = unit(inFrame({ c: [0, 0, 0], x: F.x, y: F.y, z: F.z }, [Math.sin(out) * Math.cos(rise), -Math.cos(out) * Math.cos(rise), Math.sin(rise)]));
    const face = unit([f >= 0 ? 1 : -1, 0.2, 0.25]);
    plumes.push({ mesh: featherMesh(root, dir, face, s.plume.len * (0.85 + 0.3 * jitter(id + 2)) * (1 - 0.35 * Math.abs(f)), s.plume.w, schemeOf(id, row ? 0.45 : 0.75), 0.07, 0.05), root, id, k: 1.2 });
  }
  return { mesh: merge(meshIn(F, tub), girth(s, s.pack.at + s.pack.r[1] * 0.3, 0.04 * s.len, false)), plumes };
}

/**
 * The Sableplume's chest: a wooden box with rounded corners lying across its back, bound with brass bands round each end and
 * across its middle, brass on its corners, a roll of cream cloth striped red strapped along its top; and its harness, a girth
 * strap either side of it and a breast strap, buckled in brass.
 */
function chestOf(s: Sable, n: number): Mesh {
  const F = packFrame(s), r = s.pack.r;
  // The box: a tube along its back, its section a rounded square, banded brass at its ends and twice between.
  const ys = [-r[1], -r[1] * 0.9, -r[1] * 0.8, -r[1] * 0.2, -r[1] * 0.1, r[1] * 0.1, r[1] * 0.2, r[1] * 0.8, r[1] * 0.9, r[1]];
  const box = tube(ys.map((y) => [0, y, 0] as V3), r[0], r[2], 8, (ring) => (ring === 1 || ring === 4 || ring === 7 ? 'metal' : ring === 0 || ring === 8 ? 'woodDark' : 'wood'), { up: [0, 0, 1], turn: 0 });
  // The roll on top: cream cloth, its ends red, a strap round it at either end.
  const rr = r[2] * 0.4, rl = r[1] * 0.95;
  const roll = tube([-rl, -rl * 0.8, -rl * 0.62, -rl * 0.5, rl * 0.5, rl * 0.62, rl * 0.8, rl].map((y) => [0, y, r[2] + rr * 0.85] as V3), rr, rr, n,
    (ring) => (ring === 0 || ring === 6 ? 'clothDark' : ring === 2 || ring === 4 ? 'leather' : 'cloth'), { up: [0, 0, 1] });
  // Brass on its corners, both sides.
  const corners = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => paint([disc([sx * r[0] * 1.003, sy * r[1] * 0.86, sz * r[2] * 0.62], [sx, 0, 0], r[2] * 0.16, r[2] * 0.16, 4, 'metalLit', { spin: Math.PI / 4 })]))));
  return merge(meshIn(F, merge(box, roll, ...corners)), girth(s, s.pack.at + r[1] * 0.55, 0.05 * s.len, true), girth(s, s.pack.at - r[1] * 0.55, 0.05 * s.len, true), breastStrap(s, 0.05 * s.len));
}

/**
 * The Fletchercrest's quiver: a woven basket wider at its mouth, gold in a diamond weave over a dark ground, banded gold at its
 * rim and foot, full of arrows standing up out of it, fletched red and cream; strapped on with the harness.
 */
function quiverOf(s: Sable, n: number): { mesh: Mesh; arrows: Mesh } {
  const F = packFrame(s), r = s.pack.r;
  // A diamond weave: dark where the two ways of the weave cross, gold between; a dark band at its foot and a gold rim.
  const weave = (ring: number, j: number): Mat => (ring === 0 ? 'woodDark' : ring >= 7 ? 'metalLit' : (j + ring) % 6 === 0 || (j + 60 - ring) % 6 === 0 ? 'woodDark' : 'metal');
  const tub = tubMesh(r, 24, weave, 8);
  const arrows: Mesh[] = [];
  for (let q = 0; q < s.plume.n; q++) {
    const id = 9500 + q * 11;
    const fx = (q % 3) / 2 - 0.5, fy = Math.floor(q / 3) / 2 - 0.5;
    const base: V3 = [fx * r[0] * 0.9, fy * r[1] * 0.9, r[2] * 0.2];
    const lean: V3 = unit([fx * 0.5 + (jitter(id) - 0.5) * 0.25, -0.75 + fy * 0.35, 1]);
    const L = s.plume.len * (0.85 + 0.3 * jitter(id + 1));
    const tip = add(base, scale(lean, L));
    const rr = s.shaft.r;
    const shaft = tube([base, tip], rr, rr, 5, 'grip');
    // Fletching: three narrow feathers round the end of the shaft, red or cream.
    const fl: Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + jitter(id + 2) * TAU;
      const out = unit(cross(lean, [Math.cos(a), Math.sin(a), 0]));
      fl.push(featherMesh(add(base, scale(lean, L * 0.72)), lean, out, L * 0.3, rr * 3.2, q % 2 ? 'red' : 'cream', 0.02, 0));
    }
    // A nock at the end.
    arrows.push(shaft, ...fl, orbAlong(tip, lean, [rr * 1.6, rr * 1.6, rr * 1.4], 5, 3, 'metal'));
  }
  return { mesh: merge(meshIn(F, tub), girth(s, s.pack.at + r[1] * 0.75, 0.04 * s.len, true), breastStrap(s, 0.04 * s.len)), arrows: meshIn(F, merge(...arrows)) };
}

/**
 * The Fletchercrest's saddle-flap down each flank under the quiver: dark leather following the curve of its side, edged in gold,
 * a gold leaf on it.
 */
const flapY = (s: Sable): [number, number] => [s.pack.at + s.pack.r[1] * 0.85, s.pack.at + s.pack.r[1] * 0.05];
/** How far round its flank the flap goes, from its top edge down (radians up from the side). */
const FLAP_TH = [0.85, -0.15] as const;
function flapOf(s: Sable): Mesh {
  const B = s.body, out: Mesh[] = [];
  const [y0, y1] = flapY(s), [th0, th1] = FLAP_TH, ny = 6, nt = 6;
  for (const sd of [1, -1]) {
    const v: V3[] = [], f: Face[] = [], want: V3[] = [];
    const at = (u: number, w: number, lift: number): { p: V3; n: V3 } => {
      const q0 = onRings(B, lerp(y0, y1, u), lerp(th0, th1, w)), q = sd > 0 ? q0 : left(q0);
      return { p: add(q.p, scale(q.n, lift)), n: q.n };
    };
    const lift = 0.07 * s.len;
    for (let a = 0; a <= ny; a++) for (let b = 0; b <= nt; b++) v.push(at(a / ny, b / nt, lift).p);
    for (let a = 0; a < ny; a++) {
      for (let b = 0; b < nt; b++) {
        const i = a * (nt + 1) + b;
        // Its border gold, all but along its top, where it hangs from the quiver.
        f.push({ i: [i, i + 1, i + nt + 2, i + nt + 1], m: b === nt - 1 || a === 0 || a === ny - 1 ? 'metal' : 'leatherDark' });
        want.push(at((a + 0.5) / ny, (b + 0.5) / nt, lift).n);
      }
    }
    out.push(mesh(v, wound(v, f, want)));
    // The leaf.
    const decals: Disc[] = [];
    const c = at(0.5, 0.45, lift + 0.006);
    const L = 0.22 * (y0 - y1);
    // A leaf: a pointed oval along the flap, up and back, and its veins.
    const leafPts: V3[] = [];
    const up = unit(cross(c.n, [0, 1, 0])), along = unit(cross(up, c.n));
    const dirL = unit(add(scale(along, -0.6 * sd), scale(up, sd > 0 ? 0.8 : -0.8)));
    const across = unit(cross(c.n, dirL));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU, x = Math.cos(a) * L, y2 = Math.sin(a) * L * 0.42 * (1 - 0.35 * Math.cos(a));
      leafPts.push(add(c.p, add(scale(dirL, x), scale(across, y2))));
    }
    decals.push({ v: leafPts, m: 'metalLit' });
    out.push(paint(decals));
  }
  return merge(...out);
}

/** The charm: a cord down from the breast strap, a gold bead, and two feathers hanging from it, cream and red. */
function charmOf(s: Sable): { mesh: Mesh; root: V3 } | null {
  if (!s.charm) return null;
  const B = s.body, q = onRings(B, B.y[5] + 0.08 * s.len, -0.35);
  const root = add(q.p, scale(q.n, 0.03 * s.len));
  const L = s.charm, w = 0.02 * s.len;
  const bead: V3 = add(root, [0.02, 0.04, -L * 0.45]);
  const cord = tube([root, add(root, [0.01, 0.03, -L * 0.22]), bead], w * 0.5, w * 0.5, 4, 'string');
  const feathers = [-1, 1].map((sd) => featherMesh(add(bead, [0, 0, -w]), unit([sd * 0.18, 0.05, -1]), [1, 0.3, 0], L * 0.75, w * 3.6, sd > 0 ? 'red' : 'blush', 0.03, 0));
  return { mesh: merge(cord, orbAlong(bead, [0, 0, 1], [w * 1.8, w * 1.8, w * 2.2], 6, 3, 'metal'), ...feathers), root };
}

/** Feathers up off the back of its head, between and behind the ears, swept back: red and orange. */
function crownOf(s: Sable): Plume[] {
  const C = s.crown, H = s.head, out: Plume[] = [];
  for (let q = 0; q < C.n; q++) {
    const id = 8000 + q * 5;
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0;
    const at = onRings(H, lerp(H.y[0], H.y[2], 0.35), Math.PI / 2 - f * 0.7);
    const root = sub(at.p, scale(at.n, 0.02));
    const dir = unit([f * 0.9, -1, 0.85 - Math.abs(f) * 0.5]);
    out.push({ mesh: featherMesh(root, dir, unit([f >= 0 ? 1 : -1, 0.2, 0.4]), C.len * (1 - 0.35 * Math.abs(f)), C.len * 0.12, q % 2 ? 'orange' : 'red', 0.06, 0.04), root, id, k: 1 });
  }
  return out;
}

/* ---- the head ------------------------------------------------------------------------------- */

/**
 * The dark mask down either side of its face: from a third of the way back from its nose, narrow, widening round the eye and
 * on back under the ear, its middle a little lower toward the back; the crown above it and the cheek below cream.
 */
function maskOf(s: Sable, side: number): Disc {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0], c = s.eye.up;
  const ys = Array.from({ length: 9 }, (_, q) => lerp(H.y[0] + len * (s.mask.back - 0.04), H.y[last] - len * 0.2, q / 8));
  const eyeF = (s.eye.y - H.y[0]) / len;
  const shape = (y: number): [number, number] => {
    const f = (y - H.y[0]) / len, d = f - eyeF;
    // Below and above its middle line, in radians round the head: widest at the eye, narrow to a point toward the nose.
    const w = d < 0 ? lerp(0.26, 0.3, clamp(1 + d / 0.25)) : lerp(0.3, 0.04, clamp(d / (1 - 0.2 - eyeF)));
    const mid = c - 0.12 * clamp(-d / 0.3);
    return [mid - w * 0.9, mid + w * 0.85];
  };
  const on = (y: number, th: number): V3 => { const q0 = onRings(H, y, th), q = side > 0 ? q0 : left(q0); return add(q.p, scale(q.n, 0.008)); };
  const v = [...ys.map((y) => on(y, shape(y)[0])), ...[...ys].reverse().map((y) => on(y, shape(y)[1]))];
  const out = side > 0 ? onRings(H, s.eye.y, c).n : left(onRings(H, s.eye.y, c)).n;
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const p = v[q], r = v[(q + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * out[0] + ny * out[1] + nz * out[2] < 0 ? v.reverse() : v, m: 'spot' };
}

/**
 * The head, as rings from the back of the skull to the end of the nose: cream all over its face and crown, the dark of its fur
 * round under the back of it, a dark band from near the nose back through each eye to the ear; on the Sablekit a dark stripe
 * down the top of its muzzle. A dark nose, a mouth line back along the muzzle.
 */
function headOf(s: Sable, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0];
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU), f = (H.y[Math.min(ring, last)] - H.y[0]) / len;
    if (f < s.mask.back) return up > -0.2 ? 'mark' : 'coat';
    return 'muzzle';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.2, H.z[last] - H.h[last] * 0.1];
  const nose = orbAlong(tipC, [0, 1, 0.15], [s.nose * 1.25, s.nose * 0.95, s.nose * 0.95], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.86, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.4, 0.006, -s.nose * 0.1]), [0, 1, 0.1], s.nose * 0.17, s.nose * 0.24, 6, 'pad')));
  const decals: Disc[] = [maskOf(s, 1), maskOf(s, -1)];
  // The Sablekit's stripe: a narrow dark streak along the top of its muzzle, from between its eyes to short of its nose.
  if (s.stage === 0) {
    const ys = Array.from({ length: 6 }, (_, q) => lerp(H.y[0] + len * 0.42, H.y[last] - len * 0.08, q / 5));
    const half = (y: number): number => lerp(0.1, 0.06, (y - ys[0]) / (ys[5] - ys[0]));
    const v = [
      ...ys.map((y) => { const q = onRings(H, y, Math.PI / 2 - half(y)); return add(q.p, scale(q.n, 0.01)); }),
      ...[...ys].reverse().map((y) => { const q = onRings(H, y, Math.PI / 2 + half(y)); return add(q.p, scale(q.n, 0.01)); }),
    ];
    let nz = 0;
    for (let c = 0; c < v.length; c++) { const p = v[c], r = v[(c + 1) % v.length]; nz += (p[0] - r[0]) * (p[1] + r[1]); }
    decals.push({ v: nz < 0 ? v.reverse() : v, m: 'spot' });
  }
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils, paint(decals)];
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], H.y[last] - len * 0.34, f);
      const at = onRings(H, y, -0.6 + 0.3 * f ** 2);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.025, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  parts.push(eyesOf(s, shut));
  void k;
  return merge(...parts);
}

/* ---- the work ----------------------------------------------------------------------------- */

/**
 * A go at its task, as shares of it: up onto its haunches with the shaft in its fore paws by `up`; its head down to the
 * fletching at the shaft's end for each snip of `SNIPS`; the shaft turned in its paws from `BIND` to `bound`; held up and looked
 * along at `LOOK`; and down again by the end (unless it is kept at it).
 */
export const SABLE_WORK = { up: 0.12, snips: [0.2, 0.32, 0.44] as readonly number[], bind: 0.54, bound: 0.8, look: 0.88 } as const;

/** How far up on its haunches it is through a go: eased in and out, or held while it is kept at its task. */
const upOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, SABLE_WORK.up) * (1 - ramp(t, 0.94, 1)));
/** How far into a snip it is: its head brought down to the fletching and back, quick. */
const snipOf = (t: number): number => Math.max(0, ...SABLE_WORK.snips.map((c) => hump(t, c, 0.06)));
/** How far the shaft has been turned in its paws as it binds the feathers on: two whole turns. */
const turnOf = (t: number): number => smooth((t - SABLE_WORK.bind) / (SABLE_WORK.bound - SABLE_WORK.bind)) * 2 * TAU;
/** How far it holds the shaft up to look along it. */
const lookOf = (t: number): number => hump(t, SABLE_WORK.look, 0.07);

/** Where the paws hold the shaft, from under the body's middle: before its chest, as high as its chin, either side of the middle. */
function holdAt(s: Sable, R: Rest, sd: number, up: number, t: number): V3 {
  const L = s.fore[0] + s.fore[1], A = R.ankle[sd > 0 ? 1 : 0];
  const bind = Math.sin(turnOf(t) * 2) * (t > SABLE_WORK.bind && t < SABLE_WORK.bound ? 1 : 0);
  return [A[0] * lerp(1, 0.6, up), A[1] + L * 0.45 * up + L * 0.15 * lookOf(t), A[2] + up * L * (0.85 + 0.3 * lookOf(t)) + sd * L * 0.06 * bind];
}

/**
 * Its pose at its task: reared back onto its haunches, its fore paws up together before its chest holding the shaft, its head
 * bowed to it; dipping to the fletching to snip, turning it in its paws, holding it up.
 */
function workPlan(s0: Badger, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const s = s0 as Sable, plan = stillPlan(R, p);
  const up = upOf(t, a.graze);
  void down;
  plan.roll *= 1 - up;
  p.pitch += up * (18 + 4 * lookOf(t));
  for (const sd of [-1, 1]) {
    const i = sd > 0 ? 1 : 0;
    plan.at[i] = mixV(R.ankle[i], holdAt(s, R, sd, 1, t), up);
    plan.foot[i] = up * 40;
  }
  // Its head bowed over the shaft, dipping to the fletching at its right end at each snip, a nibble; following the turn as it binds.
  const snip = snipOf(t), bind = t > SABLE_WORK.bind && t < SABLE_WORK.bound ? Math.sin(turnOf(t)) : 0;
  p.neck[0] += up * (44 + 26 * snip - 24 * lookOf(t));
  p.head[0] -= up * (2 + 16 * snip - 18 * lookOf(t));
  p.neck[1] -= up * (22 * snip + 4 * bind);
  p.head[2] += up * (8 * snip + 3 * Math.sin(TAU * t * 14) * snip);
  p.tail[0] += up * 10;
  for (const e of p.ears) e[0] += up * 10 * snip;
  return plan;
}

/** The shaft's frame between its paws: its middle, and the way along it, turned toward its right and forward, tipped up. */
function shaftFrame(s: Sable, b: Bones, t: number): Xf {
  const c = scale(add(b.fl2.t, b.fr2.t), 0.5);
  const lift = s.paw * 0.9;
  const mid: V3 = [c[0] - s.shaft.len * 0.12, c[1] + s.paw * 0.9, c[2] + lift];
  const yaw = -4 * DEG, pitch = (14 + 14 * lookOf(t)) * DEG, spin = turnOf(t);
  // Along it (x), its up, and its side, from the body's frame turned about by `yaw`, then tipped up.
  const fwd = unit(place({ m: b.trunk.m, t: [0, 0, 0] }, [0, 1, 0]));
  const flat = unit([fwd[0], fwd[1], 0]), right: V3 = [flat[1], -flat[0], 0];
  const along0 = unit(add(scale(right, Math.cos(yaw)), scale(flat, -Math.sin(yaw))));
  const along = unit(add(scale(along0, Math.cos(pitch)), [0, 0, Math.sin(pitch)]));
  const u0 = unit(cross(along, [0, 0, 1])), v0 = cross(u0, along);
  const u = add(scale(u0, Math.cos(spin)), scale(v0, Math.sin(spin))), v = cross(along, u);
  return { m: [along[0], u[0], v[0], along[1], u[1], v[1], along[2], u[2], v[2]], t: mid };
}

/** The arrow it works on: a shaft, a grey head at its left end, three feathers bound on at its right end with a cream thread. */
function shaftMesh(s: Sable): Mesh {
  const L = s.shaft.len, r = s.shaft.r;
  const shaft = tube([[-L * 0.5, 0, 0], [L * 0.5, 0, 0]], r, r, 5, 'grip', { up: [0, 0, 1] });
  const head = tube([[-L * 0.5 - r * 0.5, 0, 0], [-L * 0.5 - r * 5, 0, 0]], [r * 2.6, 0.001], [r * 1.2, 0.001], 4, 'blade', { up: [0, 0, 1] });
  const fl: Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU, out: V3 = [0, Math.cos(a), Math.sin(a)];
    fl.push(featherMesh([L * 0.5 - r * 1.5, out[1] * r, out[2] * r], [-1, 0, 0], out, L * 0.3, r * 4.2, k === 0 ? 'cream' : 'red', 0.02, 0));
  }
  const wrap = tube([[L * 0.5 - L * 0.34, 0, 0], [L * 0.5 - L * 0.29, 0, 0]], r * 1.35, r * 1.35, 5, 'string', { up: [0, 0, 1] });
  return merge(shaft, head, ...fl, wrap);
}

/* ---- its bones ------------------------------------------------------------------------------ */

/** Its bones: the badger's, sat up at its task, and the shaft between its paws. */
function sableBones(s: Sable): (a: Anim) => Bones {
  const base = badgerBones(s, workPlan, ['strike', 'evolve', 'work']);
  return (a) => {
    const b = base(a);
    const t = a.act?.kind === 'work' ? a.act.t : 0;
    b.shaft = shaftFrame(s, b, t);
    return b;
  };
}

/* ---- the stirring of its feathers ------------------------------------------------------------ */

/** How its feathers stir this moment: how far each sways on its root, how fast, and how far grown (evolving). */
function stirring(s: Sable, a: Anim): { jig: number; at: number; grow: number } {
  let jig = 0.03 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)), at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * s.gait.jiggle * (0.08 + 0.04 * a.gait);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    for (const h of BADGER_HITS[s.strike]) jig += 0.12 * hump(act.t, h + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    jig += 0.05 * snipOf(act.t);
    at = act.t * 40;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.1 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(0.25, jig), at, grow };
}

/** A piece of feathers that stir: each whole, scaled from its root and swayed on it, a beat of its own. */
function stirred(s: Sable, G: Stir, k = 1): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const st = stirring(s, a), jig = st.jig * k, { at, grow } = st;
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i], kk = G.k[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * kk * Math.sin(at + ph), fore = jig * kk * 0.6 * Math.cos(at * 1.3 + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/* ---- its pieces ----------------------------------------------------------------------------- */

/** A stage's pieces: the badger's body, legs and ears with its own head; its feathers, its pack and harness, the shaft it works. */
function sableBuild(s: Sable, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), nh = cut(lod, 10, 16);
  const B = s.body, skull = headSolids(s)[0];
  const R = domed(B);
  const nb = cut(lod, 10, 14);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb, (ring, j) => {
    const up = Math.sin(((j + 1) / nb) * TAU);
    return ring > 1 && ring < R.y.length - 2 && up < -0.55 ? 'coatDark' : 'coat';
  });
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / nb)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.3 * t * t), p[1], p[2] + R.h[q] * 0.08 * t * t] as V3;
  }), barrel.f);
  // The cream of its throat carried down onto its chest.
  const bib = orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.3], [0, 1, -0.5], [B.w[5] * 0.56, B.h[5] * 0.46, B.h[5] * 0.34], n, k, 'belly');
  const shades = paint([1, -1].map((sd) => blot(B, lerp(B.y[0], B.y[6], 0.3), -0.25, 0.14 * s.len * 1.3, 'coatLight', 80 + sd, sd)));
  const solid = barrelSolid(s);
  const extras: Piece[] = [];
  const push = (key: string, list: Plume[], bias: number, after: string[], k2 = 1): void => {
    if (!list.length) return;
    const G = stirOf(list);
    extras.push({ key, mesh: G.mesh, bone: 'trunk', bias, after, hide: [solid], bent: stirred(s, G, k2), even: true });
  };
  push('skirt', skirtOf(s), 0.08, ['body'], 0.8);
  push('mantle', mantleOf(s), 0.1, ['body', 'skirt'], 0.6);
  push('ruff', ruffOf(s), 0.12, ['body', 'mantle'], 0.5);
  if (s.flap) extras.push({ key: 'flap', mesh: flapOf(s), bone: 'trunk', bias: 0.15, after: ['body', 'mantle', 'skirt', 'fan'], hide: [solid] });
  push('fan', fanOf(s), 0.14, ['body', 'mantle'], 0.7);
  if (s.pack.kind === 'basket') {
    const P = basketOf(s, n);
    extras.push({ key: 'pack', mesh: P.mesh, bone: 'trunk', bias: 0.16, after: ['body', 'mantle', 'fan'], hide: [solid] });
    push('plume', P.plumes, 0.18, ['body', 'mantle', 'pack'], 1);
  } else if (s.pack.kind === 'chest') {
    extras.push({ key: 'pack', mesh: chestOf(s, n), bone: 'trunk', bias: 0.16, after: ['body', 'mantle', 'fan', 'ruff'], hide: [solid] });
  } else {
    const Q = quiverOf(s, n);
    extras.push({ key: 'pack', mesh: Q.mesh, bone: 'trunk', bias: 0.16, after: ['body', 'mantle', 'fan', 'flap', 'ruff'], hide: [solid] });
    extras.push({ key: 'arrows', mesh: Q.arrows, bone: 'trunk', bias: 0.18, after: ['pack'], hide: [solid] });
  }
  const charm = charmOf(s);
  if (charm) {
    const G = stirOf([{ mesh: charm.mesh, root: charm.root, id: 77, k: 1.6 }]);
    extras.push({ key: 'charm', mesh: G.mesh, bone: 'trunk', bias: 0.2, after: ['body', 'ruff'], bent: stirred(s, G, 1) });
  }
  const tailW = s.tail.w, tailL = s.tail.len;
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -40,
    tail: [merge(
      tube(curve([0, 0.04, 0], [0, -tailL * 0.5, 0.03], [0, -tailL, -0.02], 2), [tailW, tailW * 0.82, tailW * 0.3], [tailW * 0.9, tailW * 0.74, tailW * 0.3], 5, 'coatDark', { seam: 'start' }),
      ...[-1, 0, 1].map((sd) => featherMesh([0, -tailL * 0.6, tailW * 0.4], unit([sd * 0.4, -1, 0.25]), [sd || 0.3, 0, 1], tailL * 1.1, tailW * 0.7, sd ? 'red' : 'blush', 0.05, 0.05)),
    )],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: orbAlong([0, 0, 0], [0, 1, 0], [0.01, 0.01, 0.01], 3, 3, 'coat') },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: orbAlong([0, 0, 0], [0, 1, 0], [0.01, 0.01, 0.01], 3, 3, 'coat') },
    breath: 0.035,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  const crown = crownOf(s);
  if (crown.length) {
    const G = stirOf(crown);
    pieces.push({ key: 'crown', mesh: G.mesh, bone: 'head', bias: 0.22, after: ['head', 'ear0', 'ear1'], bent: stirred(s, G, 1) });
  }
  pieces.push({ key: 'shaft', mesh: shaftMesh(s), bone: 'shaft', bias: 0.3, after: ['fl2', 'fr2', 'head', 'body'], shown: (a) => a.act?.kind === 'work' });
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, nh, k, false), shut: headOf(s, nh, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib, shades) };
    // The neck's fur: cream on its throat and up its sides, dark round the back of it.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.3 ? 'coat' : 'belly'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- what it lets fall ------------------------------------------------------------------- */

/** The colours of the bits of feather it snips off: red, orange, cream, dark red. */
const BIT_RGB: readonly RGB[] = [[214, 66, 44], [238, 140, 60], [250, 234, 206], [140, 36, 32]];

/** A sliver of feather turning as it falls: a narrow pointed shape, `len` long, turned `ang`, a darker edge. */
function sliver(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB): void {
  if (len <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.3 * Math.abs(Math.cos(ang * 1.7)) - len * 0.06, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.12, -len / 2, 0);
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [60, 24, 20], 0.55));
  g.stroke();
  g.restore();
}

/** How big a stage's bits in the air are drawn, against the Sableplume's: less than in proportion on the small one, so they still read. */
const bigness = (s: Sable): number => 0.3 + 0.7 * (s.len / 2.0);

/**
 * Its work: at each snip, bits of feather cut off the fletching at the shaft's end, falling and turning, drifting, lying on
 * the ground a moment; as it binds, a cream thread going round the fletching.
 */
function workBits(g: CanvasRenderingContext2D, view: View, s: Sable, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  const end: V3 = [s.shaft.len * 0.32, 0, 0];
  const up = upOf(t, a.graze);
  SABLE_WORK.snips.forEach((c, k) => {
    const since = (frac(t - c + 1) % 1) * ACT_SECS.work;
    if (t < c && a.graze < 0.5) return;
    if (since > 0.8) return;
    const from = place(b.shaft, end);
    for (let q = 0; q < 6; q++) {
      const id = k * 17 + q * 5;
      const v: V3 = [(jitter(id) - 0.5) * 1.4 * big, (jitter(id + 1) - 0.3) * 1.0 * big, (0.4 + 0.8 * jitter(id + 2)) * big];
      // Falling slowly, as a feather does, and drifting from side to side.
      const p = thrown(from, v, since, 2.2 * big);
      p[0] += Math.sin(since * 9 + id) * 0.12 * big;
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const gone = 1 - ramp(since, 0.55, 0.8);
      sliver(g, x, y, (0.16 + 0.08 * jitter(id + 3)) * big * gone * up, since * 7 + id, BIT_RGB[(q + k) % BIT_RGB.length]);
    }
  });
  // The thread going round as it binds: a few turns drawn round the fletching's foot.
  if (front && t > SABLE_WORK.bind && t < SABLE_WORK.bound + 0.04) {
    const k = ramp(t, SABLE_WORK.bind, SABLE_WORK.bind + 0.04) * (1 - ramp(t, SABLE_WORK.bound, SABLE_WORK.bound + 0.04));
    const turns = 3, steps = 18, r = s.shaft.r * 1.8, x0 = s.shaft.len * 0.16;
    g.save();
    g.strokeStyle = 'rgb(246,234,206)';
    g.lineWidth = Math.max(0.02, s.shaft.r * 0.8) * k;
    g.beginPath();
    for (let q = 0; q <= steps; q++) {
      const u = q / steps, ang = u * turns * TAU + turnOf(t) * 1.5;
      const [x, y] = onScreen(view, place(b.shaft, [x0 + u * s.shaft.len * 0.06, Math.cos(ang) * r, Math.sin(ang) * r]));
      if (q) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.restore();
  }
}

/**
 * Evolving: a burst of feathers out of its back as it begins, which covers the moment it changes into its new body; then a
 * swirl of feathers going round and up it as its new ones grow.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Sable, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 26; q++) {
      const th = (q / 26) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.4, s.body.y[3] + Math.sin(th) * s.len * 0.3, s.body.h[3] * 0.8]);
      const v: V3 = [Math.cos(th) * (2 + 2 * jitter(q + 3)), Math.sin(th) * (2 + 2 * jitter(q + 5)), 3 + 3 * jitter(q + 7)];
      const p = thrown(from, scale(v, big), since, 5 * big);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      sliver(g, x, y, 0.55 * big * burst, q * 1.3 + since * 8, BIT_RGB[q % BIT_RGB.length]);
    }
  }
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.66, 0.86));
  if (swirl > 0) {
    const rx = s.body.w[3] * 1.35 + 0.3 * big, ry = s.len * 0.75 + 0.3 * big, top = s.body.h[3] * 2 + big;
    for (let q = 0; q < 18; q++) {
      const rise = frac(t * 1.6 + jitter(q + 20));
      const ang = (q / 18) * TAU + t * 9;
      const p = place(b.trunk, [Math.cos(ang) * rx, Math.sin(ang) * ry, -s.body.h[3] * 0.6 + rise * top]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      sliver(g, x, y, 0.45 * big * swirl * Math.sin(rise * Math.PI), ang * 2 + q, BIT_RGB[q % BIT_RGB.length]);
    }
  }
}

/** Light over the whole of it as it evolves: a warm red-gold glow as it begins, and over its back at the turn. */
function sableGlow(s: Sable, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [250, 196, 130], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [255, 210, 150], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function sableKind(s: Sable): Kind {
  const bones = sableBones(s);
  const R = restOf(s, specOf(s));
  const atHits = (a: Anim): Bones[] => BADGER_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  return {
    bones,
    build: (lod) => sableBuild(s, lod),
    // The variant's coat for its fur, its markings for the cream of its face; the sheet's reds, oranges and creams for its
    // feathers, its woods, brass and leather on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [100, 64, 48], 0.7), cream = mix(mark, [220, 184, 134], 0.85);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [40, 26, 22], 0.35),
        coatLight: mix(fur, [196, 150, 112], 0.3),
        mark: cream,
        muzzle: mix(cream, [246, 224, 182], 0.4),
        belly: mix(cream, [232, 210, 176], 0.3),
        spot: mix(fur, [58, 36, 28], 0.4),
        lid: [48, 30, 26],
        nose: [52, 34, 34],
        pad: [26, 18, 18],
        inner: [86, 56, 44],
        eye: [40, 22, 14],
        bloom: [236, 150, 40],
        glint: [255, 253, 246],
        claw: s.stage === 2 ? [236, 222, 192] : [56, 40, 34],
        hornDark: s.stage === 2 ? [176, 150, 120] : [36, 26, 22],
        feather: [184, 38, 26],
        featherDark: [112, 22, 22],
        ember: [226, 100, 34],
        cap: [238, 160, 86],
        petal: [236, 204, 152],
        wood: [156, 102, 58],
        woodDark: [92, 58, 34],
        bark: [130, 84, 48],
        metal: [222, 168, 58],
        metalDark: [140, 96, 34],
        metalLit: [252, 214, 112],
        leather: [104, 64, 42],
        leatherDark: [66, 40, 28],
        cloth: [246, 232, 204],
        clothDark: [196, 64, 46],
        string: [236, 214, 170],
        grip: [214, 172, 112],
        blade: [150, 152, 160],
      }, 30);
    },
    shadow: [s.len * 0.8 + 0.25, s.body.w[4] * 1.05],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are its feathers' red and cream.
    motes: [[226, 84, 52], [250, 226, 190]],
    glow: (b, a) => sableGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      } else if (act.kind === 'work') workBits(g, view, s, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SABLEKIT = sableKind(SABLEKIT_LOOK);
export const SABLEPLUME = sableKind(SABLEPLUME_LOOK);
export const FLETCHERCREST = sableKind(FLETCHERCREST_LOOK);
