import {
  beat, clamp, coatPalette, curve, DEG, disc, merge, moved, orbAlong, paint, pastel, quadBones, quadPose, smile, taper, tube,
  type Anim, type Bones, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, earMesh, pawMesh, quadPieces, type QuadLook } from './beastkit';
import { mesh, place, type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';

/**
 * The wild ones and the workers: the grubba. (The cobbe is the brick line
 * now, in `./wild-brick`, and the rowl the vine line, in `./wild-vine`.)
 */

/* ---- what they share ----------------------------------------------------------------- */

/**
 * `quadPieces`, with each eye left out once the head is turned so far from
 * it that it would be a sliver on the head's far edge: with the eyes set as
 * far round the head as they must be for a clear profile, the far one is
 * nearly edge on three-quarters on, and is painted past the outline there as
 * a line of its colour. It goes while the near side of the head is turned
 * more than about half toward the viewer (`Face.unless`).
 */
function quadWithEyes(o: QuadLook): Piece[] {
  const pieces = quadPieces(o);
  const mats = new Set<Mat>(['eyeWhite', 'eye', 'glint', 'lid', o.head.eye.iris ?? 'eye']);
  const sided = (m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    if (!f.decal || !mats.has(f.m)) return f;
    const x = f.i.reduce((s, i) => s + m.v[i][0], 0);
    return { ...f, unless: [x < 0 ? 0.1 : -0.1, 0, 0] as V3 };
  }));
  for (const pc of pieces) {
    if (pc.key !== 'head') continue;
    pc.mesh = sided(pc.mesh);
    if (pc.shut) pc.shut = sided(pc.shut);
  }
  return pieces;
}

/** How bright a colour looks (its luma), nought to 255: the island's grass is 177. */
const luma = (c: RGB): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/**
 * A variant's colour made `rich` times as strong and then lighter by as little as brings it to `least` once it is painted
 * (`pastel`, with the kind's `grey`): scaled up rather than mixed with white, which keeps its hue, where mixing it with white
 * greys it. A kind whose variants are all one sort of brown then paints them as as many browns, not as one taupe.
 */
function brought(c0: RGB, grey: number, least: number, rich = 1): RGB {
  const y = luma(c0);
  const c = c0.map((x) => clamp(y + (x - y) * rich, 0, 255)) as RGB;
  const up = (k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  let k = 1;
  while (k < 3 && luma(pastel(up(k), grey)) < least) k += 0.02;
  return up(k);
}

/** How far over the ground a leg's sole is, at its toe or its heel, whichever is lower, as `quadBones` stands a body on them. */
const soleOf = (b: Bones, key: string, leg: QuadSpec['fore']): number =>
  Math.min(...[leg.toe?.[0] ?? 0.3, -(leg.toe?.[1] ?? 0.3)].map((y) => place(b[`${key}2`], [0, y, -leg.len[2]])[2]));

/**
 * A kind on four legs, its bones posed from its spec and its own pose laid
 * over that, as `quadBonesOf` has it -- but grazing with all four feet on the
 * ground, its fore legs drawn back under its chest and folded there. The
 * chest bowed to the grass tips the body up behind, and stood on its fore
 * feet alone it would have its hind ones in the air; so the fore legs are
 * drawn back by `tuck` degrees and folded as far as it takes to let the chest
 * down till the hind feet are down too -- but never past the forearm lying
 * level, for folded further the knee is the lowest thing under the chin and
 * shows there as a pale wedge. Whatever they cannot take up, the body is
 * tipped back by, toward level, the head kept at its pitch and the neck bowed
 * the further to keep the head down at the grass: where folding the fore legs
 * as deep as it took, knee or no knee, would have put it.
 */
function grazing(s: QuadSpec, own: (p: QuadPose, a: Anim) => void, tuck = 0): (a: Anim) => Bones {
  return (a) => {
    const p = quadPose(s, a);
    own(p, a);
    if (a.graze <= 0 || a.go >= 1) return quadBones(s, p);
    const g = a.graze, pitch = p.pitch, nod = p.head[0], bow = p.neck[0];
    // Tipped back from its bow by `back` degrees, the neck bowed `more`, and the fore legs folded `e` more and drawn back by `drawn`.
    const pose = (back: number, more: number, e: number, drawn = tuck): Bones => quadBones(s, {
      ...p, pitch: pitch + back, head: [nod - back, p.head[1], p.head[2]], neck: [bow + more, p.neck[1]],
      legs: p.legs.map((l, i) => (i < 2 ? [l[0] - drawn * g, l[1] + e * g, l[2]] : l) as [number, number, number]),
    });
    const down = (b: Bones): boolean => Math.min(soleOf(b, 'hl', s.hind), soleOf(b, 'hr', s.hind)) <= 0.01;
    // How far a forearm is swung back from hanging straight down, in degrees, from a quarter turn forward to three back: past a right
    // angle, its knee is lower than its paw.
    const swung = (b: Bones, k: string): number => {
      const d = place(b[k], [0, 0, -1]), sw = Math.atan2(b[k].t[1] - d[1], b[k].t[2] - d[2]) / DEG;
      return sw < -90 ? sw + 360 : sw;
    };
    // The last `x` that `past` is not true of and the first that it is, between `lo` where it is not and `hi` where it is.
    const turn = (lo: number, hi: number, past: (x: number) => boolean): [number, number] => {
      for (let q = 0; q < 7; q++) { const mid = (lo + hi) / 2; if (past(mid)) hi = mid; else lo = mid; }
      return [lo, hi];
    };
    const headAt = pose(0, 0, turn(0, 1.4, (e) => down(pose(0, 0, e, 0)))[1], 0).head.t[2];
    // Unfolded by this much, the fore legs are straight: they are never unfolded further, which would bend the knees the wrong way.
    const straight = -Math.min(p.legs[0][1], p.legs[1][1]) / g;
    // The most the fore legs fold at a tip: till each forearm slopes only a little down to its paw, 84 degrees from hanging straight
    // down. It swings back evenly as the leg folds, so two poses say where that is.
    const most = (back: number): number => {
      const b0 = pose(back, 0, 0), b1 = pose(back, 0, 1);
      return Math.max(straight, Math.min(...['fl1', 'fr1'].map((k) => {
        const s0 = swung(b0, k), by = ((swung(b1, k) - s0 + 540) % 360) - 180;
        return by > 0 ? (84 - s0) / by : 1.4;
      })));
    };
    let back = 0, e = most(0);
    if (down(pose(0, 0, e))) e = turn(straight, e, (x) => down(pose(0, 0, x)))[1];
    else {
      back = turn(0, Math.max(0, -pitch), (x) => down(pose(x, 0, most(x))))[1];
      e = most(back);
    }
    // The neck bowed no further than hanging straight down.
    const more = turn(0, Math.max(0, 172 - (s.neck.lean + bow) + pitch + back), (m) => pose(back, m, e).head.t[2] <= headAt)[1];
    return pose(back, more, e);
  };
}

/* ---- the grubba ---------------------------------------------------------------------- */

/**
 * A grubba: a squat, hump-shouldered rooter. Its hump is an old stump it has
 * grown into, bark and all, with a toadstool on it; two small tusks like
 * mattock heads curl up beside its snout.
 */
const GRUBBA_SPEC = { ...pawed({ high: 1.55, len: 3.0, legs: 1.0, neck: 0.4, lean: 70, swing: [20, 36], ears: [40, 20], tail: [0.3, -30, -10] }), graze: 22, nose: 8, bow: 14 };
const GRUBBA_HEAD = { c: [0, 0.35, 0.05] as V3, r: [1.0, 0.95, 0.85] as V3 };
/** Where the stump stands on its back, how tall it is over the back, and how far its cut top is tipped back. */
const STUMP = { at: [0, 0.45, 1.05] as V3, high: 0.62, tip: 8 };

function grubbaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = GRUBBA_HEAD;
  const snout = merge(
    // A long pig's snout carried at the eyes' height, so side on there is snout in front of the eye; a pink disc on its end.
    taper([[0, 0.8, -0.04], [0, 1.62, -0.08]], 0.44, 0.4, n, 'coat'),
    orbAlong([0, 1.64, -0.08], [0, 1, 0], [0.38, 0.34, 0.1], n, 3, 'inner'),
    paint([1, -1].map((s) => disc([s * 0.14, 1.75, -0.06], [0, 1, 0], 0.07, 0.1, 6, 'nose'))),
    smile([0, 1.56, -0.44], [0, 1, -0.5], 0.26),
    // Tusks: stout at the root, curling up the snout's sides past its top and flattening as they go into a blade like a mattock's
    // head, broad along the snout and thin across it, so that side on it shows whole.
    ...[1, -1].map((s) => tube(curve([s * 0.3, 1.2, -0.36], [s * 0.66, 1.3, -0.3], [s * 0.64, 1.36, 0.46], 4),
      [0.17, 0.14, 0.12, 0.15, 0.22], [0.17, 0.12, 0.09, 0.07, 0.06], 6, 'tooth', { up: [1, 0, 0] })),
  );
  // The stump: bark in ridges down its sides, rooted onto the back, its top cut and tipped back, with the rings of its years on it.
  const S = STUMP, top = S.high;
  const stump = moved(merge(
    tube([[0, 0, -0.25], [0, 0, 0.05], [0, 0, top * 0.6], [0, 0, top]], [0.78, 0.66, 0.6, 0.56], [0.7, 0.6, 0.54, 0.5], n,
      (ring, j) => (ring === 3 ? 'mark' : j % 2 ? 'bark' : 'stoneDark')),
    paint([[0.46, 'stoneDark'], [0.41, 'mark'], [0.26, 'stoneDark'], [0.21, 'mark'], [0.06, 'stoneDark']].map(([r, m], q) =>
      disc([0, 0, top + 0.005 + q * 0.004], [0, 0, 1], r as number, (r as number) * 0.9, 10, m as Mat))),
    ...[0.5, 2.2, 3.6, 5.1].map((t) => taper(curve([Math.cos(t) * 0.5, Math.sin(t) * 0.46, 0.08], [Math.cos(t) * 0.82, Math.sin(t) * 0.74, -0.02], [Math.cos(t) * 1.02, Math.sin(t) * 0.92, -0.26], 2), 0.18, 0.04, 5, 'bark')),
  ), S.at, 0, -S.tip);
  // The toadstool on it: a piece of its own, so the stump's cut top is never painted over it.
  const toadstool = moved(merge(
    taper([[0.24, 0.1, top - 0.05], [0.26, 0.12, top + 0.26]], 0.07, 0.06, 5, 'spot'),
    orbAlong([0.26, 0.12, top + 0.3], [0.1, 0, 1], [0.26, 0.26, 0.14], n, 3, 'cap'),
    paint([[0.3, 0.02], [0.16, 0.22], [0.36, 0.24]].map(([x, y]) => disc([x + 0.02, y + 0.06, top + 0.43], [0.05, 0.05, 1], 0.05, 0.05, 5, 'spot'))),
  ), S.at, 0, -S.tip);
  return quadWithEyes({
    n, k,
    body: { y: [-1.75, -1.5, -0.8, 0, 0.8, 1.4, 1.7], z: [0.1, 0.18, 0.25, 0.3, 0.4, 0.45, 0.4], w: [0.25, 0.95, 1.15, 1.2, 1.25, 1.1, 0.3], h: [0.25, 0.78, 0.9, 0.95, 1.02, 0.92, 0.3], belly: true },
    neck: { w: 0.85, h: 0.8, len: 0.4 },
    head: { c: H.c, r: H.r, face: snout, eye: { dir: [0.78, 0.5, 0.26], size: 0.32, rim: 0.12 }, blush: [[0.8, 0.46, -0.28], 0.2] },
    ear: earMesh(0.45, 0.34, n, { tilt: 0.25 }),
    tail: [merge(taper(curve([0, 0, 0], [0, -0.2, 0.1], [0, -0.3, 0.3], 2), 0.07, 0.05, 5, 'coat'))],
    fore: { upper: [0.3, -0.52, 0.36, 0.3], lower: [0, -0.46, 0.3, 0.28], foot: pawMesh(0.28, n, k, 'coatDark') },
    hind: { upper: [0.18, -0.56, 0.34, 0.3], lower: [0, -0.56, 0.28, 0.26], foot: pawMesh(0.26, n, k, 'coatDark') },
    extras: [
      { key: 'hump', mesh: stump, bone: 'trunk', bias: 0.04, after: 'body' },
      { key: 'toadstool', mesh: toadstool, bone: 'trunk', bias: 0.05, after: 'hump' },
    ],
  });
}

export const GRUBBA: Kind = {
  bones: grazing(GRUBBA_SPEC, (p, a) => {
    trot(p, a);
    // Rooting: the snout down and shoving, the rump up. Grazing, with its snout at the grass already, it shoves only a little deeper.
    if (a.go <= 0) {
      const root = beat(a.t, [6.4, 18.8], 1.6) * (1 - 0.7 * a.graze);
      p.neck[0] += 25 * root * (0.8 + 0.2 * Math.sin(a.t * Math.PI * 6));
      p.head[0] -= 15 * root;
      p.pitch -= 6 * root;
    }
  }, 40),
  build: grubbaBuild,
  // Its coat lifted to a little lighter than the grass, so it stands off it and the brown stump stands off the coat, and its browns
  // made richer, so its variants come out a tan, a ginger, a dun and a caramel.
  palette: (coat, mark) => coatPalette(brought(coat, 26, 180, 1.5), mark, { bark: [150, 112, 86], stoneDark: [112, 84, 66], tooth: [250, 244, 228], inner: [238, 168, 176], nose: [150, 80, 96], cap: [224, 92, 84], spot: [252, 246, 234] }, 26),
  shadow: [2.1, 1.4],
  stride: 1.1,
  size: 1.85,
};
