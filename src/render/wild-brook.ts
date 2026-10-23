import {
  add, beat, coatPalette, cross, curve, disc, merge, orbAlong, paint, quadBonesOf, scale, smile, step, TAU, tube, unit,
  type Kind, type MatOf, type Piece,
} from './beasts';
import { blade, cut, pawMesh, quadPieces } from './beastkit';
import { onScreen, place, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { pawed, trot } from './wild-paws';

/** The kinds of the brooks, the bogs and the hedges: the wadd. */

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

