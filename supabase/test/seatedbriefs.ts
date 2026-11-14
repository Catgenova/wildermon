/**
 * The undergarment shows on a body sat down.
 *
 * Reported with a picture: "this angle is missing bottoms" -- a woman in her undergarment alone at a cart's reins, seen
 * from in front, her band showing and her briefs not, the lap bare. The briefs were drawn: on a seat as low as a cart's
 * box the knees come up level with the hips, and the sat clips held them together, so from in front (the game's camera
 * looks down at a body some twenty degrees) the knees and the thighs hid the whole of the briefs, the crotch with them.
 * The clips now part the knees (`src/sculpt/anim/clips/seated.ts` KNEES_OUT).
 *
 * In node, with no browser: each body with nothing on its legs (no gear at all: the undergarment, `outfitOf`) sat in
 * every seat the game has -- a cart's and a wagon's box at the reins, standing and going, a rowing boat's thwart at the
 * oars, a sailing boat's stern sheets at the tiller (each where `driverOn` puts the driver, every way round to the
 * camera), a saddle with the legs down and drawn up, and sat on the ground meditating -- is drawn as the GPU draws it
 * (`lowScene`: the bake's triangles skinned by its bones, projected and depth-tested as `src/sculpt/gl.ts` does, what is
 * behind a mount's barrel left out), and of the screen the body covers, the pixels the briefs win are counted. Every
 * seat and facing shows at least `LEAST` of them; the woman's band too; and every one of the undergarment's triangles
 * is in the bake.
 */
import { lowScene } from '../../src/sculpt/lowpoly';
import { M } from '../../src/sculpt/models/body';
import { STRIDE } from '../../src/sculpt/bake';
import { HEIGHT_SCALE } from '../../src/render/iso';
import { DEFAULT_LOOK } from '../../src/game/look';
import { driverOn, pieceView } from '../../src/render/furniture';
import type { FigurePose, Seat } from '../../src/render/figure';
import MALE from '../../src/sculpt/assets/lowmale.json';
import FEMALE from '../../src/sculpt/assets/lowfemale.json';
import { check, finish } from './harness';

/** Raster pixels a screen pixel at zoom one, each way. */
const PX = 6;
/**
 * The least of the briefs a sat body shows, and of her band, in screen pixels at zoom one: twenty pixels at zoom four.
 * Stood, the woman's briefs show 3.8 side on and her band 1.2 from behind; at the reins seen from in front, before the
 * knees were parted, her briefs showed 0.4.
 */
const LEAST = 1.25;
/** The undergarment's pieces: briefs on both bodies; her band. */
type Piece = 'briefs' | 'band';

/** A saddle as the renderer puts a rider on a mount (`src/render/renderer.ts` SADDLE). */
const SADDLE: Seat = { hands: 'reins', up: 0, astride: true, grip: [0, 7.5, 2.5] };

interface Shown { briefs: number; band: number; tris: Record<Piece, number> }

/** The pixels each piece of the undergarment wins in a body drawn as `pose`, and its triangles in the bake. */
function shown(pose: FigurePose): Shown {
  const d = lowScene(pose), { baked, bones, view } = d;
  const V = baked.verts, n = baked.nVerts, t = baked.tris;
  // the box the GPU draws a body in (`gl.ts` BOX), at PX a pixel
  const L = -42, T0 = -66, W = 84 * PX, H = 80 * PX;
  const P = new Float64Array(n * 3), S = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    // skinned as the vertex shader skins: each bone's 3x4 rows, by the vertex's weights
    const o = i * STRIDE, p = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = V[o + 11 + k];
      if (w <= 0) continue;
      const b = Math.round(V[o + 7 + k]) * 12;
      for (let r = 0; r < 3; r++) p[r] += w * (bones[b + r * 4] * V[o] + bones[b + r * 4 + 1] * V[o + 1] + bones[b + r * 4 + 2] * V[o + 2] + bones[b + r * 4 + 3]);
    }
    P.set(p, i * 3);
    S[i * 3] = (p[0] * view.ex[0] + p[1] * view.ey[0] - L) * PX;
    S[i * 3 + 1] = (p[0] * view.ex[1] + p[1] * view.ey[1] - p[2] * HEIGHT_SCALE - T0) * PX;
    S[i * 3 + 2] = -(p[0] * view.T[0] + p[1] * view.T[1] + p[2] * view.T[2]);
  }
  // what is behind the egg left out (`SculptDraw.hide`: a mount's barrel), as the fragment shader leaves it
  const hidden = (q: number[]): boolean => {
    if (!d.hide) return false;
    const { c, r } = d.hide, o = [0, 1, 2].map((k) => (q[k] - c[k]) / r[k]), dv = [0, 1, 2].map((k) => view.T[k] / r[k]);
    const a = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2, b = o[0] * dv[0] + o[1] * dv[1] + o[2] * dv[2], cc = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - 1, disc = b * b - a * cc;
    return disc > 0 && (-b + Math.sqrt(disc)) / a > 0;
  };
  // the undergarment's triangles, and which piece: the band is the higher of two runs of them at rest, apart by a gap
  const under = (k: number): boolean => V[t[k * 3] * STRIDE + 6] === M.under;
  const restZ = (k: number): number => (V[t[k * 3] * STRIDE + 2] + V[t[k * 3 + 1] * STRIDE + 2] + V[t[k * 3 + 2] * STRIDE + 2]) / 3;
  const zs = Array.from({ length: baked.nTris }, (_, k) => k).filter(under).map(restZ).sort((a, b) => a - b);
  let cut = Infinity, gap = 0.5;
  for (let j = 1; j < zs.length; j++) if (zs[j] - zs[j - 1] > gap) { gap = zs[j] - zs[j - 1]; cut = (zs[j] + zs[j - 1]) / 2; }
  const pieceOf = (k: number): Piece | null => (under(k) ? (restZ(k) < cut ? 'briefs' : 'band') : null);
  const zb = new Float64Array(W * H).fill(Infinity), id = new Int32Array(W * H).fill(-1);
  for (let k = 0; k < baked.nTris; k++) {
    const [a, b, c] = [t[k * 3], t[k * 3 + 1], t[k * 3 + 2]];
    const ax = S[a * 3], ay = S[a * 3 + 1], bx = S[b * 3], by = S[b * 3 + 1], cx = S[c * 3], cy = S[c * 3 + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(ay, by, cy))); py <= Math.min(H - 1, Math.ceil(Math.max(ay, by, cy))); py++) {
      for (let px = Math.max(0, Math.floor(Math.min(ax, bx, cx))); px <= Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))); px++) {
        const X = px + 0.5, Y = py + 0.5;
        const w0 = ((bx - X) * (cy - Y) - (by - Y) * (cx - X)) / area, w1 = ((cx - X) * (ay - Y) - (cy - Y) * (ax - X)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * S[a * 3 + 2] + w1 * S[b * 3 + 2] + w2 * S[c * 3 + 2], at = py * W + px;
        // (depth tested LEQUAL, as the GPU's)
        if (z > zb[at]) continue;
        if (d.hide && hidden([0, 1, 2].map((r) => w0 * P[a * 3 + r] + w1 * P[b * 3 + r] + w2 * P[c * 3 + r]))) continue;
        zb[at] = z;
        id[at] = k;
      }
    }
  }
  const won: Record<Piece, number> = { briefs: 0, band: 0 }, tris: Record<Piece, number> = { briefs: 0, band: 0 };
  for (let k = 0; k < baked.nTris; k++) { const p = pieceOf(k); if (p) tris[p]++; }
  for (const k of id) { const p = k >= 0 ? pieceOf(k) : null; if (p) won[p]++; }
  return { briefs: won.briefs / PX / PX, band: won.band / PX / PX, tris };
}

/** A body of `gender` with nothing on, facing `facing`, sat as `sat` says. */
const body = (gender: 'man' | 'woman', facing: number, sat: Partial<FigurePose>, id: string): FigurePose => ({
  id, phase: 3, moving: false, gait: 0, facing, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender }, gear: {}, ...sat,
});

/** Every seat, by name, each way round to the camera: its facing and the pose sat there. */
function seats(): Array<[string, number, Partial<FigurePose>]> {
  const out: Array<[string, number, Partial<FigurePose>]> = [];
  for (const kind of ['large_cart', 'wagon', 'rowing_boat', 'sailing_boat']) {
    for (let rotation = 0; rotation < 8; rotation++) {
      const at = driverOn(kind, pieceView('s', rotation));
      if (!at) throw new Error(`nobody sits in a ${kind}`);
      out.push([kind, at.facing, { driving: true, seat: at.seat }]);
      if (kind === 'large_cart') out.push([`${kind} going`, at.facing, { driving: true, seat: at.seat, moving: true }]);
    }
  }
  for (let f = 0; f < 8; f++) {
    out.push(['saddle', f, { driving: true, seat: SADDLE }]);
    out.push(['saddle, legs drawn up', f, { driving: true, seat: { ...SADDLE, tuck: 1 } }]);
    out.push(['meditating', f, { working: true, job: 'meditate' }]);
  }
  return out;
}

console.log('--- the undergarment in the bake');
for (const [gender, A] of [['man', MALE], ['woman', FEMALE]] as const) {
  // each painted polygon's triangles in the game's copy of the body (`tools/sculpt/lowunder.mjs`)
  const painted = new Set((A.polys as Array<[number[], number]>).flatMap(([, m], i) => (m === 9 ? [i] : [])));
  let want = 0;
  for (let k = 3; k < A.tris.length; k += 4) if (painted.has(A.tris[k])) want++;
  const s = shown(body(gender, 0, {}, `bake ${gender}`));
  check(`${gender}: every triangle of the undergarment is in the bake with nothing on`, s.tris.briefs + s.tris.band === want, `${s.tris.briefs + s.tris.band} of ${want}`);
  check(`${gender}: ${gender === 'woman' ? 'briefs and a band' : 'briefs and no band'}`, s.tris.briefs > 0 && (gender === 'woman') === s.tris.band > 0, JSON.stringify(s.tris));
}

console.log('--- sat, every seat and facing');
for (const gender of ['woman', 'man'] as const) {
  const least: Record<string, { briefs: [number, number]; band: [number, number] }> = {};
  for (const [name, facing, sat] of seats()) {
    const s = shown(body(gender, facing, sat, `${gender}|${name}|${facing}`));
    const l = (least[name] ??= { briefs: [Infinity, 0], band: [Infinity, 0] });
    if (s.briefs < l.briefs[0]) l.briefs = [s.briefs, facing];
    if (s.band < l.band[0]) l.band = [s.band, facing];
  }
  for (const [name, l] of Object.entries(least)) {
    const at = (f: number): string => `facing ${Math.round(f * 100) / 100}`;
    check(`${gender}, ${name}: the briefs show from every side`, l.briefs[0] >= LEAST, `least ${l.briefs[0].toFixed(2)} at ${at(l.briefs[1])}`);
    if (gender === 'woman') check(`${gender}, ${name}: the band shows from every side`, l.band[0] >= LEAST, `least ${l.band[0].toFixed(2)} at ${at(l.band[1])}`);
  }
}

finish('the undergarment shows on a body sat down');
