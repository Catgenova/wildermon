import {
  add, beat, coatPalette, cross, curve, cyc, darker, DEG, disc, dot, lighter, merge, mix, moved, orb, orbAlong, paint, pastel, quadBonesOf, scale, smile, step, sub, taper, TAU, tube, unit,
  type Anim, type Kind, type MatOf, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, pawMesh, quadPieces, under } from './beastkit';
import { mesh, onScreen, place, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { pawed, trot } from './wild-paws';

/**
 * The kinds of the brooks, the bogs and the hedges: the embra, the bogga,
 * the bevere, the wadd, the holla, the plucka and the middun.
 */

/* ---- shared by these kinds ---------------------------------------------------------- */

/**
 * A tail's links, each a tube left open where it goes into the one before it
 * and started a little way up inside it, so that whatever the body is drawn
 * between them there is no ring round the tail at a joint: `r` the radius at
 * each joint from the root to the tip, `len` each link's length, and `flat`
 * how deep it is against how wide.
 */
function linked(r: readonly number[], len: number, n: number, mat: MatOf, flat = 1): Mesh[] {
  return r.slice(0, -1).map((r0, q) => {
    const w = [r0, r0, r[q + 1]];
    return tube([[0, 0.12, 0], [0, 0, 0], [0, -len, 0]], w, w.map((x) => x * flat), n, mat, { seam: q === r.length - 2 ? 'start' : 'both' });
  });
}

/**
 * A muzzle out in front of the eyes, a ball along the way the head faces
 * (tipped a little nose-down): its middle `at` forward and `z` up, `r`
 * across it, up it and along it; a nose on its upper front and a mouth
 * under that, facing out of it.
 */
function muzzle(o: { at: number; z?: number; r: V3; nose: number; mouth?: number; mat?: Mat }, n: number, k: number): Mesh {
  const c: V3 = [0, o.at, o.z ?? -0.12];
  const fwd = unit([0, 1, -0.12]), up = unit(cross([1, 0, 0], fwd));
  const toward = (a: number): V3 => unit(add(scale(fwd, o.r[2] * Math.cos(a)), scale(up, o.r[1] * Math.sin(a))));
  const on = (a: number): V3 => add(c, add(scale(fwd, o.r[2] * Math.cos(a)), scale(up, o.r[1] * Math.sin(a))));
  const nd = toward(0.55);
  return merge(
    orbAlong(c, fwd, o.r, n, k, o.mat ?? 'muzzle'),
    orbAlong(add(on(0.55), scale(nd, -o.nose * 0.25)), nd, [o.nose, o.nose * 0.7, o.nose * 0.75], 6, 3, 'nose'),
    smile(add(on(-0.62), scale(toward(-0.62), -0.02)), toward(-0.62), o.mouth ?? 0.26),
  );
}

/** A mesh from corners and faces, each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: V3[], faces: Array<{ i: number[]; m: Mat; want: V3; soft?: boolean; decal?: boolean }>): Mesh {
  return mesh(v, faces.map((q) => {
    let nx = 0, ny = 0, nz = 0;
    for (let a = 0; a < q.i.length; a++) {
      const p = v[q.i[a]], r = v[q.i[(a + 1) % q.i.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    const i = nx * q.want[0] + ny * q.want[1] + nz * q.want[2] < 0 ? [...q.i].reverse() : q.i;
    return { i, m: q.m, soft: q.soft, decal: q.decal };
  }));
}

/**
 * Lights drawn over a body, each only while the side it is on is toward the
 * viewer: bright in the middle, gone at the edge, added to what is under it.
 * For lights set in a flank, which a body's own glow (`Kind.glow`) would show
 * through the body from the far side as well.
 */
function flankLights(g: CanvasRenderingContext2D, view: View, list: ReadonlyArray<{ p: V3; n: V3; r: number; c: RGB; a: number }>): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const l of list) {
    if (l.n[0] * view.T[0] + l.n[1] * view.T[1] + l.n[2] * view.T[2] <= 0.05) continue;
    const [x, y] = onScreen(view, l.p);
    const grad = g.createRadialGradient(x, y, 0, x, y, l.r);
    const c = `${l.c[0] | 0},${l.c[1] | 0},${l.c[2] | 0}`;
    grad.addColorStop(0, `rgba(${c},${l.a})`);
    grad.addColorStop(0.45, `rgba(${c},${l.a * 0.35})`);
    grad.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grad;
    g.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
  }
  g.restore();
}

/* ---- the bogga ----------------------------------------------------------------------- */

/**
 * A bogga: a flat-tailed wallower, dark to the shoulder from the black
 * ground it works. A lily pad sits on its head like a hat, a flower in it;
 * its legs are dipped in mud, and its tail is a paddle.
 */
const BOGGA_BASE = pawed({ high: 1.3, len: 3.0, legs: 0.75, neck: 0.35, lean: 75, swing: [20, 34], ears: [70, 20], tail: [0.5, 20, 0] });
const BOGGA_SPEC: QuadSpec = { ...BOGGA_BASE, ears: { at: [0.8, -0.3, 0.5], out: 42, back: 26 }, graze: 21, nose: 10 };
const BOGGA_HEAD = { c: [0, 0.4, 0.05] as V3, r: [1.2, 1.1, 0.95] as V3 };
/** The trunk's rings: short and round, a barrel on four stout legs. */
const BOGGA_BODY = { y: [-1.55, -1.3, -0.7, 0, 0.7, 1.25, 1.5], z: [0.1, 0.15, 0.2, 0.2, 0.2, 0.22, 0.25], w: [0.3, 1.15, 1.32, 1.35, 1.32, 1.15, 0.3], h: [0.25, 0.72, 0.82, 0.85, 0.82, 0.72, 0.25] };

/** A lily pad: a round leaf `r` across with a slit cut to its middle, lying flat, its veins running out from the middle. */
function lilyPad(r: number, n: number): Mesh {
  const notch = 0.52, th = 0.06;
  const v: V3[] = [[0, 0, th / 2], [0, 0, -th / 2]];
  const rim = (j: number): number => notch / 2 + ((TAU - notch) * j) / n;
  for (let j = 0; j <= n; j++) v.push([Math.cos(rim(j)) * r, Math.sin(rim(j)) * r, th / 2]);
  for (let j = 0; j <= n; j++) v.push([Math.cos(rim(j)) * r, Math.sin(rim(j)) * r, -th / 2]);
  const T = (j: number): number => 2 + j, B = (j: number): number => 3 + n + j;
  const faces: Array<{ i: number[]; m: Mat; want: V3 }> = [];
  for (let j = 0; j < n; j++) {
    const a = (rim(j) + rim(j + 1)) / 2;
    faces.push({ i: [0, T(j), T(j + 1)], m: 'leaf', want: [0, 0, 1] });
    faces.push({ i: [1, B(j), B(j + 1)], m: 'leafDark', want: [0, 0, -1] });
    faces.push({ i: [T(j), T(j + 1), B(j + 1), B(j)], m: 'leafDark', want: [Math.cos(a), Math.sin(a), 0] });
  }
  faces.push({ i: [0, 1, B(0), T(0)], m: 'leafDark', want: [Math.sin(rim(0)), -Math.cos(rim(0)), 0] });
  faces.push({ i: [0, T(n), B(n), 1], m: 'leafDark', want: [-Math.sin(rim(n)), Math.cos(rim(n)), 0] });
  const veins = paint([1, 2, 3, 4, 5].map((q) => {
    const a = notch / 2 + ((TAU - notch) * q) / 6, d: V3 = [Math.cos(a), Math.sin(a), 0], s: V3 = [-Math.sin(a) * 0.025, Math.cos(a) * 0.025, 0];
    return { v: [add(scale(d, r * 0.12), s), add(scale(d, r * 0.8), scale(s, 0.4)), add(scale(d, r * 0.8), scale(s, -0.4)), add(scale(d, r * 0.12), scale(s, -1))].map((p) => add(p, [0, 0, th / 2 + 0.005])), m: 'leafDark' as Mat };
  }));
  return merge(wound(v, faces), veins);
}

/** A water lily at `at`: five petals opening upward and out, a cup round a yellow heart. */
function waterLily(at: V3, len: number): Mesh {
  const petals = [0, 1, 2, 3, 4].map((q) => {
    const a = (q / 5) * TAU + 0.3, d: V3 = [Math.cos(a), Math.sin(a), 0];
    return blade(curve(add(at, scale(d, len * 0.1)), add(add(at, scale(d, len * 0.55)), [0, 0, len * 0.2]), add(add(at, scale(d, len)), [0, 0, len * 0.72]), 3), [len * 0.12, len * 0.34, len * 0.36, len * 0.1], [-d[0] * 0.6, -d[1] * 0.6, 1], { fold: 0.3, mat: 'petal', thick: 0.03 });
  });
  return merge(...petals, orb(add(at, [0, 0, len * 0.3]), [len * 0.36, len * 0.36, len * 0.26], 6, 3, 'bloom'));
}

function boggaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = BOGGA_HEAD, B = BOGGA_BODY;
  // A broad, round hippo's muzzle, well out in front of the eyes.
  const face = muzzle({ at: 1.32, z: -0.2, r: [0.78, 0.55, 0.58], nose: 0.2, mouth: 0.36 }, n, k);
  const pad = moved(lilyPad(0.78, lod ? 12 : 9), [0, 0.02, 0.95], 64, -8, 7);
  // The lily grows out of the pad toward its back, on the right, where it shows from the side.
  const lily = moved(waterLily([0.14, -0.3, 0.03], 0.36), [0, 0.02, 0.95], 0, -8, 7);
  // The mud: the lower third of it, to a wavy line along each flank, laid over the trunk.
  const ring = (y: number): [number, number, number] => {
    let q = 0;
    while (q < B.y.length - 2 && B.y[q + 1] < y) q++;
    const t = (y - B.y[q]) / (B.y[q + 1] - B.y[q]);
    return [B.z[q] + (B.z[q + 1] - B.z[q]) * t, B.w[q] + (B.w[q + 1] - B.w[q]) * t, B.h[q] + (B.h[q + 1] - B.h[q]) * t];
  };
  const rows = lod ? 16 : 11, cols = lod ? 8 : 6;
  const mv: V3[] = [];
  const mf: Array<{ i: number[]; m: Mat; want: V3; soft?: boolean }> = [];
  for (let q = 0; q <= rows; q++) {
    const y = -1.5 + (2.96 * q) / rows, [z, w, h] = ring(y);
    // The line the mud comes up to rises and falls along the flank, a splash's width at a time.
    const edge = -0.02 + 0.22 * Math.sin(y * 3.4 + 0.6);
    for (let j = 0; j <= cols; j++) {
      const a = Math.PI + edge + ((Math.PI - 2 * edge) * j) / cols;
      mv.push([Math.cos(a) * -w * 1.02, y, z + Math.sin(a) * h * 1.02]);
    }
  }
  for (let q = 0; q < rows; q++) for (let j = 0; j < cols; j++) {
    const i = q * (cols + 1) + j;
    const p = mv[i];
    mf.push({ i: [i, i + 1, i + cols + 2, i + cols + 1], m: 'coatDark', want: [p[0], 0, p[2] - 0.2], soft: true });
  }
  const mud = wound(mv, mf);
  // The tail: one broad paddle, flat and a little thick, lifted off the ground behind.
  const paddle = tube([[0, 0.12, 0], [0, 0, 0], [0, -0.3, 0], [0, -0.62, 0], [0, -0.9, 0], [0, -1.04, 0]], [0.24, 0.24, 0.36, 0.42, 0.34, 0.12], [0.11, 0.11, 0.1, 0.09, 0.08, 0.05], n, 'coatDark', { up: [0, 0, 1], seam: 'start' });
  const paw = pawMesh(0.3, n, k, 'coatDark');
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: 0.85, h: 0.75, len: 0.35 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.7, 0.47, 0.42], size: 0.3, rim: 0.12 }, blush: [[0.84, 0.36, -0.2], 0.2] },
    ear: earMesh(0.32, 0.26, n),
    tail: [paddle],
    fore: { upper: [0.3, -0.39, 0.36, 0.33], lower: [0, -0.34, 0.32, 0.3], foot: paw, mat: 'coatDark' },
    hind: { upper: [0.3, -0.42, 0.4, 0.34], lower: [0, -0.42, 0.32, 0.3], foot: paw, mat: 'coatDark' },
    extras: [
      { key: 'mud', mesh: mud, bone: 'trunk', bias: 0.003, after: 'body' },
      { key: 'pad', mesh: pad, bone: 'head', bias: 0.24, after: ['head', 'ear0', 'ear1'] },
      { key: 'lily', mesh: lily, bone: 'head', bias: 0.25, after: 'pad', thin: true, airy: true },
    ],
  });
  return pieces;
}

export const BOGGA: Kind = {
  bones: quadBonesOf(BOGGA_SPEC, (p, a) => {
    trot(p, a);
    p.roll += a.go * 4 * Math.sin((a.u % 1) * TAU);
    // A contented wallow: a slow roll from side to side.
    if (a.go <= 0) p.roll += 5 * cyc(a.t, 2);
  }),
  build: boggaBuild,
  palette: (coat, mark) => {
    // The coat a shade lighter than its variant says, so it stands off the grass; its dark is the mud it wallows in.
    const base = coatPalette(coat, mark, {}, 30), c = lighter(base.coat, 0.18);
    return { ...base, coat: c, coatLight: lighter(c, 0.2), coatDark: [104, 86, 80], lid: darker(c, 0.42), muzzle: lighter(mix(c, base.mark, 0.5), 0.14), leaf: [156, 212, 128], leafDark: [104, 160, 96], petal: [248, 196, 220], bloom: [250, 224, 120] };
  },
  shadow: [2.1, 1.5],
  stride: 1.0,
  size: 2.05,
};

/* ---- the wadd ------------------------------------------------------------------------ */

/**
 * A wadd: a slick-furred swimmer with webbed feet and a rudder of a tail, the
 * one thing on the island that will take a rider across deep water. Its ears
 * are fins, and a row of pale lights runs down each flank, as in deep water.
 */
const WADD_SPEC = pawed({ high: 1.15, len: 3.4, legs: 0.7, neck: 0.5, lean: 55, swing: [24, 40], ears: [30, 34], tail: [0.55, -4, -6] });
const WADD_HEAD = { c: [0, 0.4, 0.1] as V3, r: [1.1, 1.05, 0.9] as V3 };
/** Where along each flank its lights are, front to back. */
const WADD_LIGHTS = [1.15, 0.4, -0.35, -1.1];
/** When in the loop a light runs down each flank, front to back, and how long it takes. */
const WADD_PULSE = 6, WADD_PULSE_LEN = 1.2;
/** When in the loop it shakes the water off, standing. */
const WADD_SHAKE = [10.4, 21.3];
/** Where each foot is in a bound, at a run: the fore pair together, then the hind pair. */
const WADD_BOUND = [0.5, 0.56, 0, 0.06];

/** How bright each of its lights is, nought to one, as the pulse passes down the flank. */
const waddPulse = (t: number, q: number): number => {
  const d = (((t % WADD_PULSE) + WADD_PULSE) % WADD_PULSE) - (q / (WADD_LIGHTS.length - 1)) * WADD_PULSE_LEN * 0.6;
  return Math.exp(-((d - 0.25) ** 2) / 0.06);
};

function waddBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = WADD_HEAD;
  const face = muzzle({ at: 1.38, r: [0.56, 0.42, 0.46], nose: 0.15, mouth: 0.24 }, n, k);
  // The lights: four down each flank, each a pale disc with a bright middle.
  const lights = paint(WADD_LIGHTS.flatMap((y) => [1, -1].flatMap((s) => [
    disc([s * 1.07, y, 0.18], [s, 0, 0.25], 0.17, 0.17, 8, 'crystal', { lit: true }),
    disc([s * 1.09, y, 0.18], [s, 0, 0.25], 0.08, 0.08, 6, 'spot', { lit: true }),
  ])));
  // A fin for an ear: swept back from its root, cupped, and turned out so it shows its face side on.
  const fin = blade(curve([0, 0.04, -0.05], [0, -0.08, 0.45], [0, -0.4, 0.86], 4), [0.17, 0.28, 0.28, 0.2, 0.03], [0, 1, 0], { fold: 0.42, mat: 'water', rib: 'crystal', thick: 0.05 });
  // The tail tapers out of the body, carried a little low, and ends in a rudder: a fin swept back and up from its tip, low and
  // cupped enough that from in front or behind it is a small fin over the tail rather than a spike standing up behind the head.
  const links = linked([0.55, 0.4, 0.26, 0.12], 0.62, n, 'coat');
  const rudder = blade(curve([0, -0.3, -0.12], [0, -0.6, 0.12], [0, -0.92, 0.42], 3), [0.12, 0.3, 0.26, 0.05], [1, 0, 0], { fold: 0.3, mat: 'water', rib: 'crystal', thick: 0.06 });
  const pieces = quadPieces({
    n, k,
    body: { y: [-1.9, -1.62, -0.85, 0, 0.85, 1.5, 1.82], z: [0.15, 0.17, 0.2, 0.2, 0.2, 0.25, 0.3], w: [0.55, 0.95, 1.08, 1.1, 1.06, 0.92, 0.35], h: [0.5, 0.72, 0.8, 0.82, 0.8, 0.72, 0.32], belly: true },
    // The neck shallow from front to back, so that side on its back edge stays inside the head and the back rather than showing
    // as a dark tick over the shoulder.
    neck: { w: 0.78, h: 0.42, len: 0.5 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.7, 0.5, 0.4], size: 0.3, rim: 0.12 }, blush: [[0.84, 0.4, -0.3], 0.2] },
    ear: fin,
    earTurn: 45,
    tail: [links[0], links[1], merge(links[2], rudder)],
    fore: { upper: [0.3, -0.36, 0.34, 0.28], lower: [0, -0.32, 0.28, 0.26], foot: pawMesh(0.3, n, k, 'coatDark') },
    hind: { upper: [0.3, -0.39, 0.38, 0.3], lower: [0, -0.39, 0.28, 0.26], foot: pawMesh(0.32, n, k, 'coatDark') },
    extras: [{ key: 'lights', mesh: lights, bone: 'trunk', bias: 0.005, after: 'body' }],
  });
  return pieces;
}

export const WADD: Kind = {
  // Grazing, its long neck bowed well down and its head carried nearer level, so the nod at the grass stays within twenty degrees.
  bones: quadBonesOf({ ...WADD_SPEC, graze: 40, nose: 8, bow: 18 }, (p, a) => {
    trot(p, a);
    const w = a.u - Math.floor(a.u);
    if (a.go > 0) {
      // The long body rippling as it goes, as it does in the water.
      p.neck[1] += a.go * 10 * Math.sin(w * TAU);
      p.tail[1] -= a.go * 20 * Math.sin(w * TAU + 0.8);
      if (a.gait > 0.5) {
        // At a run it lopes, as an otter does on land: the fore feet together and then the hind, the back arching and
        // stretching between, and all four off the ground after the hind feet push.
        const amp = 44;
        p.legs = WADD_BOUND.map((o) => step(a.u + o, 0.3, amp));
        p.pitch = 9 * Math.sin(w * TAU + Math.PI / 2);
        // Off the ground only between the pairs: after the hind feet push, and a little after the fore.
        const air = (from: number, len: number): number => (w >= from && w < from + len ? Math.sin(((w - from) / len) * Math.PI) : 0);
        p.lift = 0.9 * air(0.36, 0.14) + 0.35 * air(0.86, 0.14);
        p.squash = 0.06 * Math.cos(w * TAU * 2);
        p.neck[0] -= 8 * Math.sin(w * TAU + Math.PI / 2);
        p.tail[0] += 12 * Math.sin(w * TAU - 0.6);
      }
      return;
    }
    // Standing, now and then it shakes the water off: a quick roll one way and the other, the fins flicking.
    const shake = beat(a.t, WADD_SHAKE, 0.5);
    if (shake > 0) {
      const sw = Math.sin((a.t % 1) * TAU * 3);
      p.roll += 12 * shake * sw * (1 - a.graze);
      p.head[2] -= 16 * shake * sw * (1 - a.graze);
      p.ears[0][0] += 30 * shake;
      p.ears[1][0] += 30 * shake;
    }
  }),
  build: waddBuild,
  palette: (coat, mark) => coatPalette(coat, mark, { water: [160, 214, 232], crystal: [196, 250, 240], spot: [250, 255, 250] }, 190),
  shadow: [2.3, 1.3],
  stride: 0.9,
  size: 1.65,
  leaps: [false, true],
  // Its lights glowing, each only from the side it is on; standing, a brighter light runs down each flank now and then.
  extra: (g, view, b, a, under) => {
    if (under) return;
    const m = b.trunk.m;
    flankLights(g, view, WADD_LIGHTS.flatMap((y, q) => {
      const k = a.go > 0 ? 0 : waddPulse(a.t, q);
      return [1, -1].map((s) => ({ p: place(b.trunk, [s * 1.1, y, 0.18]), n: [m[0] * s + m[2] * 0.25, m[3] * s + m[5] * 0.25, m[6] * s + m[8] * 0.25] as V3, r: 0.75 + 0.35 * k, c: [150, 240, 230] as RGB, a: 0.32 + 0.45 * k }));
    }));
  },
};

/* ---- the holla ----------------------------------------------------------------------- */

/**
 * A holla: a barrel of a creature with a throat pouch that holds more water
 * than you would credit -- clear, so you can see it slop -- and little fins
 * for ears; it carries the shore to your barrels.
 */
const HOLLA_BASE = pawed({ high: 1.6, len: 2.4, legs: 1.0, neck: 0.35, lean: 55, swing: [22, 36], ears: [30, 30], tail: [0.3, 10, 0] });
/** Grazing, it puts its head down to drink: its bill to the ground, its pouch pressed on the ground under it (`HOLLA_PRESS`). */
const HOLLA_SPEC: QuadSpec = { ...HOLLA_BASE, graze: 44, nose: 8, bow: 16 };
const HOLLA_HEAD = { c: [0, 0.35, 0.15] as V3, r: [1.0, 0.95, 0.85] as V3 };
/** The pouch under its chin: where its middle is and how big it is, and how high in it the water comes. */
const HOLLA_POUCH = { c: [0, 0.74, -0.94] as V3, r: [0.8, 0.72, 0.64] as V3, level: 0.06 };
/**
 * How much flatter the pouch is pressed as it rests on the ground while the holla drinks, and how much wider it spreads: pressed
 * straight down, which in the head's own frame is tipped back by as far as the head is carried nose-down to drink (`tip`, degrees).
 */
const HOLLA_PRESS = { down: 0.42, out: 0.16, tip: 18 };

/** How far the water in the pouch is tipped against the head, in radians: the body rolls with its waddle, and the water stays level. */
const hollaSlop = (a: Anim): number => {
  const w = a.u - Math.floor(a.u);
  return -(a.go * 10 * Math.sin(w * TAU) + (1 - a.go) * 5 * cyc(a.t, 4)) * 1.3 * (Math.PI / 180);
};

function hollaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = HOLLA_HEAD, P = HOLLA_POUCH;
  const face = merge(
    // The face drawn out in front of the eyes, so there is coat in front of them seen side on, and out of the lower front of it a
    // flat bill, broad and well out in front.
    orbAlong([0, 0.95, 0.12], [0, 1, 0], [0.62, 0.48, 0.55], n, k, 'coat'),
    orbAlong([0, 1.42, -0.1], [0, 1, -0.1], [0.56, 0.2, 0.6], n, k, 'bill'),
    paint([1, -1].map((s) => disc([s * 0.12, 1.76, 0.04], [0, 0.2, 1], 0.045, 0.03, 5, 'nose'))),
  );
  // The pouch: a clear skin with a glint on it, and the water in it, whose top stays level as the head rolls.
  const skin = merge(
    orb(P.c, P.r, n + 1, k, 'spot'),
    paint([disc(add(P.c, [0.36, 0.4, 0.36]), [0.45, 0.6, 0.6], 0.15, 0.1, 6, 'glint', { lit: true })]),
  );
  // The water: the pouch's lower part, a bowl open at the top, so the clear skin shows over it and the water's edge is its level.
  const bottom = P.c[2] - P.r[2] * 0.97, top = P.c[2] + P.level, rings = 5;
  const zs = Array.from({ length: rings + 1 }, (_, q) => bottom + 0.02 + ((top - bottom - 0.02) * q) / rings);
  const across = (z: number): number => 0.97 * Math.sqrt(Math.max(0.02, 1 - ((z - P.c[2]) / P.r[2]) ** 2));
  const water = tube(zs.map((z) => [P.c[0], P.c[1], z] as V3), zs.map((z) => P.r[0] * across(z)), zs.map((z) => P.r[1] * across(z)), n + 1, 'water', { seam: 'end' });
  // Grazing, the pouch resting on the ground as the head goes down to it: pressed flatter and spread wider, its top where it was.
  const up: V3 = [0, -Math.sin(HOLLA_PRESS.tip * DEG), Math.cos(HOLLA_PRESS.tip * DEG)];
  const crown = add(P.c, scale(up, P.r[2]));
  const pressed = (v: readonly V3[], a: Anim): V3[] => {
    const g = a.graze;
    if (g <= 0) return [...v];
    const down = 1 - HOLLA_PRESS.down * g, out = 1 + HOLLA_PRESS.out * g;
    return v.map((p) => {
      const d = sub(p, crown), along = dot(d, up);
      return add(crown, add(scale(up, along * down), scale(sub(d, scale(up, along)), out)));
    });
  };
  // Its level tipped against the head as the head rolls, the bowl's rim going up on one side and down on the other.
  const slop = (v: readonly V3[], a: Anim): V3[] => {
    const t = Math.tan(hollaSlop(a));
    return v.map((p) => [p[0], p[1], p[2] + (p[0] - P.c[0]) * t * Math.max(0, (p[2] - bottom) / (top - bottom))] as V3);
  };
  // A fin for an ear, broad and carried up enough to read as an ear from in front and behind as well as side on.
  const fin = blade(curve([0, 0.04, -0.05], [0, -0.08, 0.35], [0, -0.3, 0.68], 4), [0.18, 0.26, 0.26, 0.18, 0.04], [0, 1, 0], { fold: 0.4, mat: 'water', rib: 'water', thick: 0.05 });
  // Flat feet, webbed, a softer orange than the bill.
  const foot = orbAlong([0, 0.26 * 0.35, -0.14 + 0.26 * 0.32], [0, 1, 0], [0.28, 0.1, 0.36], n, k, 'pad');
  return quadPieces({
    n, k,
    body: { y: [-1.55, -1.3, -0.6, 0, 0.6, 1.25, 1.5], z: [0.2, 0.25, 0.3, 0.3, 0.3, 0.3, 0.3], w: [0.3, 1.0, 1.2, 1.25, 1.2, 1.0, 0.3], h: [0.3, 0.85, 1.0, 1.05, 1.0, 0.86, 0.3] },
    // The neck shallow from front to back, so that side on its back edge stays inside the head and the back rather than showing
    // as a dark tick over the shoulder.
    neck: { w: 0.8, h: 0.45, len: 0.35 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.8, 0.32, 0.42], size: 0.32, rim: 0.12 }, blush: [[0.86, 0.4, -0.25], 0.2] },
    ear: fin,
    earTurn: 45,
    tail: [orb([0, -0.2, 0.04], 0.28, n, k, 'mark')],
    fore: { upper: [0.3, -0.52, 0.3, 0.26], lower: [0, -0.46, 0.26, 0.24], foot },
    hind: { upper: [0.3, -0.56, 0.34, 0.28], lower: [0, -0.56, 0.26, 0.24], foot },
    extras: [
      { key: 'pouch', mesh: skin, bone: 'head', bias: 0.18, bent: pressed },
      { key: 'water', mesh: water, bone: 'head', bias: 0.181, after: 'pouch', bent: (v, a) => pressed(slop(v, a), a) },
    ],
  });
}

export const HOLLA: Kind = {
  bones: quadBonesOf(HOLLA_SPEC, (p, a) => {
    trot(p, a);
    // The water slopping: a waddle that rolls it from side to side.
    p.roll += a.go * 6 * Math.sin((a.u % 1) * TAU);
    if (a.go <= 0) p.head[2] += 5 * cyc(a.t, 4);
  }),
  build: hollaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, { water: [110, 180, 225], bill: [246, 186, 124], pad: [226, 176, 136], spot: [228, 244, 250], nose: [150, 96, 90] }, 205),
  shadow: [2.0, 1.6],
  stride: 1.1,
  size: 2.6,
};

/* ---- the plucka ---------------------------------------------------------------------- */

/**
 * A plucka: a long-armed climber of the orchard's edge with hands like a
 * child's and a tail it hangs by. Its ears are leaves, its tail is ringed
 * with leaf-green, and the tuft at the end of it is a bunch of berries.
 */
const PLUCKA_BASE = pawed({ high: 1.55, len: 2.0, legs: 0.95, neck: 0.3, lean: 18, swing: [26, 42], ears: [30, 25], tail: [0.4, 5, 24] });
/** Carried nose-up on arms longer than its legs, as a thing that climbs does on the ground. */
const PLUCKA_TILT = 14;
const PLUCKA_SPEC: QuadSpec = {
  ...PLUCKA_BASE,
  // Its arms long, carried a little forward of straight down and bent at the elbow.
  fore: { ...PLUCKA_BASE.fore, len: [0.8, 0.72, 0.14], rest: [15 - PLUCKA_TILT, -35, 0] },
  hind: { ...PLUCKA_BASE.hind, rest: [22 - PLUCKA_TILT, -44, 0] },
  // Its tail carried out behind and curling up at the end, low enough that from in front the berries stay behind its head.
  tail: { ...PLUCKA_BASE.tail!, links: 4, len: 0.36 },
  ears: { at: [0.55, -0.2, 0.85], out: 30, back: 25 },
  // Foraging, it crouches to pick at the ground (`PLUCKA_CROUCH`): the chest let down a little and the short neck bent right down,
  // rather than the body tipped over onto its long arms.
  graze: 90,
  bow: 12,
  nose: 10,
};
/**
 * How it crouches to forage: each arm swung forward (degrees) and folded under the chest (as a leg folds at the top of a
 * stride), so its long arms let the chest down to where the head reaches the grass; and the hind legs folded a little more,
 * so the haunches come down too and all four feet stay on the ground.
 */
const PLUCKA_CROUCH = { arm: 79, fold: 1.39, haunch: 0.25 };
const PLUCKA_HEAD = { c: [0, 0.25, 0.25] as V3, r: [1.1, 1.0, 1.0] as V3 };

function pluckaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = PLUCKA_HEAD;
  const face = merge(
    // A pale heart of a face, as a little climber has, standing out in front of the eyes, and a nub of a muzzle out in front of
    // that with the nose on its end.
    orbAlong([0, 0.72, 0.12], [0, 1, 0], [0.7, 0.62, 0.78], n, k, 'mark'),
    muzzle({ at: 1.3, z: -0.16, r: [0.42, 0.32, 0.42], nose: 0.11, mouth: 0.2, mat: 'mark' }, n, k),
  );
  // A leaf for an ear, on a short stalk, twisted along its length so it shows its face from the side and from in front.
  const ear = merge(
    tube([[0, 0, -0.05], [0, 0, 0.14]], 0.06, 0.06, 5, 'stem', { seam: 'start' }),
    blade(curve([0, 0, 0.12], [0, -0.04, 0.42], [0, 0, 0.72], 4), [0.06, 0.18, 0.2, 0.15, 0.02], [0, 1, 0], { twist: -0.87, fold: 0.26, mat: 'leaf', rib: 'leafDark' }),
  );
  const ring = (q: number): 'leaf' | 'coat' => (q % 2 ? 'leaf' : 'coat');
  const tail = [
    taper([[0, 0, 0], [0, -0.36, 0]], 0.13, 0.12, 6, (r) => ring(r)),
    taper([[0, 0, 0], [0, -0.36, 0]], 0.12, 0.11, 6, (r) => ring(r + 1)),
    taper([[0, 0, 0], [0, -0.36, 0]], 0.11, 0.1, 6, (r) => ring(r)),
    // The tuft at the end is a bunch of berries.
    merge(taper([[0, 0, 0], [0, -0.26, 0]], 0.1, 0.08, 6, 'leaf'), ...([[0, -0.4, 0], [0.16, -0.32, 0.1], [-0.15, -0.33, 0.1], [0.02, -0.3, 0.24]] as V3[]).map((c) => orb(c, 0.16, 6, 3, 'petal'))),
  ];
  // A hand: a small palm, turned out a little, with two fat fingers in front of it.
  const hand = (out: number): Mesh => moved(merge(
    orbAlong([0, 0.1, -0.08], [0, 1, 0], [0.3, 0.16, 0.36], n, k, 'mark'),
    ...[-0.1, 0.1].map((x) => orb([x, 0.44, -0.1], 0.1, 5, 3, 'mark')),
  ), [0, 0, 0], out);
  const pieces = quadPieces({
    n, k,
    body: { y: [-1.15, -0.95, -0.45, 0.1, 0.6, 0.95, 1.12], z: [0.1, 0.15, 0.22, 0.3, 0.4, 0.48, 0.52], w: [0.25, 0.82, 0.98, 1.0, 0.96, 0.8, 0.25], h: [0.25, 0.72, 0.84, 0.86, 0.82, 0.7, 0.25], belly: true },
    neck: { w: 0.6, h: 0.6, len: 0.3 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.78, 0.45, 0.3], size: 0.36, rim: 0.12 }, blush: [[0.86, 0.4, -0.24], 0.2] },
    ear,
    earTurn: 20,
    tail,
    fore: { upper: [0.3, -0.8, 0.22, 0.18], lower: [0, -0.72, 0.18, 0.16], foot: hand(-30) },
    hind: { upper: [0.3, -0.53, 0.36, 0.28], lower: [0, -0.53, 0.26, 0.22], foot: hand(0) },
  });
  // The leaf ears lined lightly, in a dark of their own green, so they read as leaves and not as ink; the forearms in the darker
  // coat, so the pale hands at the ends of them read as hands and not as socks.
  return pieces.map((pc) => (pc.key === 'ear0' || pc.key === 'ear1' ? { ...pc, thin: true, airy: true }
    : pc.key === 'fl1' || pc.key === 'fr1' ? { ...pc, mesh: mesh(pc.mesh.v, pc.mesh.f.map((f) => ({ ...f, m: 'coatDark' as Mat }))) } : pc));
}

export const PLUCKA: Kind = {
  bones: quadBonesOf(PLUCKA_SPEC, (p, a) => {
    trot(p, a);
    // Nose-up on its long arms, but not while it is down picking at the ground.
    p.pitch += PLUCKA_TILT * (1 - a.graze);
    // Foraging, crouched, and its tail carried out behind rather than up over its back.
    const gz = a.graze;
    for (const i of [0, 1]) {
      p.legs[i][0] += (PLUCKA_CROUCH.arm - p.legs[i][0]) * gz;
      p.legs[i][1] += (PLUCKA_CROUCH.fold - p.legs[i][1]) * gz;
    }
    p.legs[2][1] += PLUCKA_CROUCH.haunch * gz;
    p.legs[3][1] += PLUCKA_CROUCH.haunch * gz;
    p.tail[0] -= 35 * gz;
    // Standing, up on its haunches now and then to look round, the tail's berries swinging.
    if (a.go <= 0) {
      const up = beat(a.t, [7.5, 18.2], 2.4) * (1 - a.graze);
      p.pitch += 30 * up;
      p.legs[0][0] += 30 * up;
      p.legs[1][0] += 30 * up;
      p.neck[0] -= 20 * up;
      p.tail[2] += 10 * cyc(a.t, 5);
    }
  }),
  build: pluckaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, { leaf: [168, 216, 112], leafDark: [112, 170, 80], stem: [130, 150, 90], petal: [214, 70, 110], nose: [150, 90, 100] }, 30),
  shadow: [1.6, 1.1],
  stride: 1.2,
  size: 1.75,
};

/* ---- the middun ---------------------------------------------------------------------- */

/**
 * A middun: a low, patient scavenger in a round, banded shell like a
 * woodlouse's, which eats what everything else has given up on; what comes
 * out the other end is the best thing that ever happened to a field, and
 * flowers grow out of its shell to prove it.
 */
const MIDDUN_SPEC: QuadSpec = { ...pawed({ high: 1.1, len: 2.6, legs: 0.6, neck: 0.45, lean: 70, swing: [22, 34], ears: [60, 20], tail: [0.25, 0, 0] }), nose: 11 };
const MIDDUN_HEAD = { c: [0, 0.35, 0.05] as V3, r: [1.0, 0.95, 0.85] as V3 };
/** When in the loop, standing, it chews on something, and for how long. */
const MIDDUN_MUNCH = [2.6, 8.9, 14.7, 20.3];

function middunBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = MIDDUN_HEAD;
  // The shell: plates from the tail forward, each one's back edge flared and lapped over the front of the one behind it, as a
  // woodlouse's are, so its outline is scalloped and a dark lap shows between every plate.
  const segs = lod ? 7 : 6, y0 = -1.6, y1 = 1.25, mid = (y0 + y1) / 2, half = (y1 - y0) / 2 + 0.1;
  const dome = (y: number): number => Math.sqrt(Math.max(0.06, 1 - ((y - mid) / half) ** 2));
  const rings: V3[] = [], rw: number[] = [], rh: number[] = [];
  for (let q = 0; q < segs; q++) {
    const a = y0 + ((y1 - y0) * q) / segs, b = y0 + ((y1 - y0) * (q + 1)) / segs;
    for (const [y, k] of [[a + 0.001, 1.06], [b - 0.06, 0.88]] as Array<[number, number]>) {
      rings.push([0, y, 0.12 + 0.1 * dome(y)]);
      rw.push(1.32 * dome(y) * k);
      rh.push(0.98 * dome(y) * k);
    }
  }
  const shell = tube(rings, rw, rh, lod ? 12 : 10, (ring, j) => (under(lod ? 12 : 10, j, 1.1) ? 'coatDark' : ring % 2 ? 'shellDark' : (ring >> 1) % 2 ? 'shell' : 'coatLight'));
  // Three flowers where the dome is highest, each a cup of petals round a yellow heart on a stalk leaning out, so they show from
  // the side as well as from above.
  const top = (x: number, y: number): number => 0.12 + 0.1 * dome(y) + 0.98 * dome(y) * Math.sqrt(Math.max(0, 1 - (x / (1.32 * dome(y))) ** 2));
  const flowers = merge(...([[0.42, -0.62], [-0.4, 0.05], [0.3, 0.62]] as Array<[number, number]>).map(([x, y]) => {
    const c: V3 = [x, y, top(x, y) - 0.05];
    const lean: V3 = [Math.sign(x) * 0.34, 0, 0.94];
    const head = add(c, scale(lean, 0.34));
    return merge(tube([c, head], 0.07, 0.07, 5, 'stem', { seam: 'start' }), waterLily(head, 0.3));
  }));
  // A pig's snout: a round muzzle with a flat pink end, two nostrils in it, and a small mouth under.
  const face = merge(
    orbAlong([0, 1.12, -0.1], [0, 1, -0.15], [0.44, 0.38, 0.42], n, k, 'muzzle'),
    paint([disc([0, 1.53, -0.16], [0, 1, -0.15], 0.27, 0.21, 10, 'inner'), disc([0.08, 1.55, -0.15], [0, 1, -0.15], 0.045, 0.06, 5, 'nose'), disc([-0.08, 1.55, -0.15], [0, 1, -0.15], 0.045, 0.06, 5, 'nose')]),
    smile([0, 1.36, -0.42], [0, 1, -0.6], 0.2),
  );
  return quadPieces({
    n, k,
    body: { y: [-1.5, -1.25, -0.6, 0, 0.6, 1.15, 1.4], z: [0.05, 0.08, 0.1, 0.1, 0.1, 0.1, 0.1], w: [0.25, 0.95, 1.1, 1.15, 1.1, 0.95, 0.3], h: [0.2, 0.5, 0.56, 0.58, 0.56, 0.5, 0.2] },
    neck: { w: 0.62, h: 0.58, len: 0.45 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.76, 0.48, 0.38], size: 0.28, rim: 0.12 }, blush: [[0.86, 0.38, -0.3], 0.17] },
    ear: earMesh(0.3, 0.24, n),
    fore: { upper: [0.25, -0.32, 0.22, 0.2], lower: [0, -0.28, 0.2, 0.18], foot: pawMesh(0.2, n, k, 'coatDark') },
    hind: { upper: [0.25, -0.35, 0.24, 0.2], lower: [0, -0.32, 0.2, 0.18], foot: pawMesh(0.2, n, k, 'coatDark') },
    extras: [
      { key: 'shell', mesh: shell, bone: 'trunk', bias: 0.04, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'] },
      { key: 'flowers', mesh: flowers, bone: 'trunk', bias: 0.06, after: ['body', 'shell'], thin: true, airy: true },
    ],
  });
}

export const MIDDUN: Kind = {
  bones: quadBonesOf(MIDDUN_SPEC, (p, a) => {
    trot(p, a);
    // Many small steps under the shell, which bobs; standing, now and then a satisfied munch.
    p.lift += a.go * 0.06 * Math.abs(Math.sin((a.u % 1) * TAU * 2));
    if (a.go <= 0) p.head[0] += 3 * Math.sin(a.t * Math.PI * 4) * Math.min(1, 3 * beat(a.t, MIDDUN_MUNCH, 1.5)) * (1 - a.graze);
  }),
  build: middunBuild,
  palette: (coat, mark) => {
    const m = pastel(mark, 34);
    return coatPalette(coat, mark, { shell: lighter(m, 0.1), shellDark: darker(m, 0.3), coatLight: lighter(m, 0.24), stem: [140, 190, 100], petal: [244, 168, 204], bloom: [250, 214, 110], inner: [238, 170, 180] }, 34);
  },
  shadow: [1.9, 1.4],
  stride: 1.5,
  size: 1.85,
};
